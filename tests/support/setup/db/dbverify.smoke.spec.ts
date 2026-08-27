import { test, expect } from '@playwright/test';
import { isUatDbConfigured } from './uatPgClient';
import { getDb, closeDb, checkRow, expectRow, expectSoftDeleted, expectNotDeleted, expectCount, snapshot, expectNoChange, expectAudit } from './dbVerify';
import { money, text, instant } from './match';
import { buildWhere } from './adapters/postgres';
import { DbGuardError } from './types';

/*
 * SMOKE THẬT trên `sapp-platform-uat` — chỉ ĐỌC, và chỉ đọc bản ghi CÓ SẴN (không tạo/không sửa gì).
 * Mục đích: chứng minh adapter + dbVerify chạy được với DB thật, và các chốt an toàn/từ-chối-phán có hiệu
 * lực. Đây KHÔNG phải test nghiệp vụ — nghiệp vụ nằm ở case §23 sau khi neo bản đồ cột.
 *
 * Chạy: INFRA_VERIFY=1 TASK_ENV=profiles/SAPP-24395/task.env … --project=infra-verify
 */
const PREFIX = 'LIB_MASTER_DB_RO';
const ORDERS = 'ic_payment_orders';
const TX = 'ic_payment_transaction_orders';

test.describe('@infra-verify dbVerify trên DB thật', () => {
  test.skip(!isUatDbConfigured(PREFIX), `chưa khai ${PREFIX}_*`);
  test.afterAll(async () => { await closeDb(); });

  test('kết nối đi qua ĐỦ 4 lớp: quyền · session read-only · lint · host guard', async () => {
    const { client, conv } = await getDb();
    expect(client.dialect).toBe('postgres');
    expect(conv.safety.requireReadonlyUser, 'phải BẬT — tắt là bỏ lớp bảo vệ chính').toBe(true);
    const g = await client.grants();
    expect(g.length, 'đọc được quyền qua adapter').toBeGreaterThan(0);
    expect(g.every((x) => x.privilege === 'SELECT'), 'role phải chỉ có SELECT').toBe(true);
  });

  test('findMany chỉ lấy CỘT ĐÃ KHAI (không SELECT *) — PII không vào memory', async () => {
    const { client } = await getDb();
    const rows = await client.findMany(ORDERS, { deleted_at: { op: 'null' } }, { columns: ['id', 'status', 'final_price'], limit: 3 });
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(Object.keys(r).sort()).toEqual(['final_price', 'id', 'status']);
      expect(Object.keys(r), 'không được kéo về cột PII').not.toContain('email');
      expect(Object.keys(r)).not.toContain('phone_number');
    }
  });

  test('findOne khớp NHIỀU bản ghi ⇒ CHẶN, không chọn bừa bản đầu', async () => {
    const { client } = await getDb();
    await expect(client.findOne(ORDERS, { deleted_at: { op: 'null' } }, { columns: ['id'] }))
      .rejects.toThrow(/mơ hồ|khớp \d+ bản ghi/);
  });

  test('so tiền type-aware trên DỮ LIỆU THẬT: bigint (orders) và varchar (transactions)', async () => {
    const { client } = await getDb();
    const [order] = await client.findMany(ORDERS, { final_price: { op: 'notnull' } }, { columns: ['id', 'final_price'], limit: 1 });
    test.skip(!order, 'UAT chưa có order nào có final_price');
    // Lấy chính giá trị DB rồi so lại — ở ĐÂY là hợp lệ vì đang kiểm COMPARATOR, không phải kiểm nghiệp vụ.
    const res = await checkRow(ORDERS, { id: order.id }, { final_price: money(String(order.final_price)) });
    expect(res.diffs, JSON.stringify(res.diffs)).toEqual([]);

    const [tx] = await client.findMany(TX, { amount: { op: 'notnull' } }, { columns: ['id', 'amount'], limit: 1 });
    if (tx) {
      const r2 = await checkRow(TX, { id: tx.id }, { amount: money(String(tx.amount)) });
      expect(r2.diffs, 'amount là varchar — money() phải xử được chuỗi').toEqual([]);
    }
  });

  test('lệch tiền ⇒ nói rõ LỆCH BAO NHIÊU ĐỒNG', async () => {
    const { client } = await getDb();
    const [o] = await client.findMany(ORDERS, { final_price: { op: 'notnull' } }, { columns: ['id', 'final_price'], limit: 1 });
    test.skip(!o, 'UAT chưa có order nào có final_price');
    const wrong = BigInt(String(o.final_price)) + 1_000_000n;
    await expect(expectRow(ORDERS, { id: o.id }, { final_price: money(wrong) })).rejects.toThrow(/lệch .*đồng/);
  });

  test('thời gian: thiếu `storedZone` ⇒ báo KHÔNG PHÁN ĐƯỢC, tuyệt đối không phán sai', async () => {
    const { client } = await getDb();
    const [o] = await client.findMany(ORDERS, { deleted_at: { op: 'null' } }, { columns: ['id', 'created_at'], limit: 1 });
    test.skip(!o, 'UAT trống');
    const res = await checkRow(ORDERS, { id: o.id }, { created_at: (await import('./match')).instant('2026-01-01T00:00:00Z') });
    expect(res.inconclusive.length, 'phải là inconclusive, không phải diff').toBe(1);
    expect(res.inconclusive[0].why).toContain('storedZone');
    expect(res.diffs, 'không được coi là lệch giá trị').toEqual([]);
  });

  test('xoá mềm: bảng CÓ quy ước thì kiểm được; bảng khai `none` thì TỪ CHỐI phán', async () => {
    const { client } = await getDb();
    const [alive] = await client.findMany(ORDERS, { deleted_at: { op: 'null' } }, { columns: ['id'], limit: 1 });
    test.skip(!alive, 'UAT trống');
    await expect(expectNotDeleted(ORDERS, { id: alive.id })).resolves.toBeUndefined();
    await expect(expectSoftDeleted(ORDERS, { id: alive.id })).rejects.toThrow(/CÒN SỐNG|không đạt/);

    // 7 bảng nối không có `deleted_at` ⇒ phải từ chối, không được đoán.
    await expect(expectSoftDeleted('ic_payment_order_product_instances', { order_id: alive.id }))
      .rejects.toThrow(/mode: none|KHÔNG có cột xoá mềm/);
  });

  test('expectCount cho bảng liên quan (cha–con)', async () => {
    const { client } = await getDb();
    const [o] = await client.findMany(ORDERS, { deleted_at: { op: 'null' } }, { columns: ['id'], limit: 1 });
    test.skip(!o, 'UAT trống');
    const n = await client.count(TX, { order_id: o.id });
    await expect(expectCount(TX, { order_id: o.id }, n)).resolves.toBeUndefined();
    await expect(expectCount(TX, { order_id: o.id }, n + 5)).rejects.toThrow(/mong \d+, thực tế/);
  });

  test('snapshot + expectNoChange: không đổi ⇒ đạt; và BẮT BUỘC khai columns', async () => {
    const { client } = await getDb();
    const [o] = await client.findMany(ORDERS, { deleted_at: { op: 'null' } }, { columns: ['id'], limit: 1 });
    test.skip(!o, 'UAT trống');
    const cols = ['status', 'final_price'];
    const before = await snapshot(ORDERS, { id: o.id }, cols);
    await expect(expectNoChange(ORDERS, { id: o.id }, before, cols)).resolves.toBeUndefined();
    await expect(snapshot(ORDERS, { id: o.id }, [])).rejects.toThrow(/phải khai `columns`/);
  });

  test('expectAudit TỪ CHỐI — DB này không có audit hành động người dùng', async () => {
    await expect(expectAudit()).rejects.toThrow(/không dùng được/);
  });

  test('text() bắt được giá trị lệch trên cột thật', async () => {
    const { client } = await getDb();
    const [o] = await client.findMany(ORDERS, { status: { op: 'notnull' } }, { columns: ['id', 'status'], limit: 1 });
    test.skip(!o, 'UAT trống');
    const res = await checkRow(ORDERS, { id: o.id }, { status: text(`${String(o.status)}_SAI`) });
    expect(res.diffs.length).toBe(1);
  });
});

test.describe('@infra-verify buildWhere — dịch Where sang SQL (không cần DB)', () => {
  test('giá trị trần = eq; null trần = IS NULL', () => {
    const r = buildWhere({ id: 42, deleted_at: null });
    expect(r.clause).toBe('"id" = $1 AND "deleted_at" IS NULL');
    expect(r.params).toEqual([42]);
  });

  test('toán tử: notnull · in · like', () => {
    const r = buildWhere({ deleted_at: { op: 'notnull' }, status: { op: 'in', value: ['a', 'b'] }, name: { op: 'like', value: 'IT test%' } });
    expect(r.clause).toBe('"deleted_at" IS NOT NULL AND "status" IN ($1, $2) AND "name" LIKE $3');
    expect(r.params).toEqual(['a', 'b', 'IT test%']);
  });

  test('`in` với danh sách RỖNG ⇒ FALSE (không sinh `IN ()` sai SQL)', () => {
    expect(buildWhere({ status: { op: 'in', value: [] } }).clause).toBe('FALSE');
    expect(buildWhere({ status: { op: 'nin', value: [] } }).clause).toBe('TRUE');
  });

  test('tên cột lạ ⇒ CHẶN (chống injection qua định danh)', () => {
    expect(() => buildWhere({ 'id; DROP TABLE x': 1 })).toThrow(DbGuardError);
    expect(() => buildWhere({ '"; --': 1 })).toThrow();
  });

  test('where rỗng ⇒ TRUE (không sinh `WHERE` cụt)', () => {
    expect(buildWhere({}).clause).toBe('TRUE');
  });
});

test.describe('@infra-verify instant() sau khi khai storedZone=UTC', () => {
  test.skip(!isUatDbConfigured(PREFIX), `chưa khai ${PREFIX}_*`);

  test('so mốc thời gian trên DỮ LIỆU THẬT: đúng UTC ⇒ match, cùng số nhưng +07 ⇒ lệch 7 giờ', async () => {
    const { client, conv } = await getDb();
    expect(conv.timestamps.storedZone, 'conventions phải khai storedZone (đo được, không đoán)').toBe('UTC');

    const [o] = await client.findMany(ORDERS, { deleted_at: { op: 'null' } }, { columns: ['id', 'created_at'], limit: 1 });
    test.skip(!o, 'UAT trống');
    const naive = String(o.created_at instanceof Date ? o.created_at.toISOString().replace(/Z$/, '') : o.created_at).replace(' ', 'T');

    // Đọc giá trị naive như UTC ⇒ phải KHỚP.
    // DB lưu tới mili giây, expected ghi tới giây ⇒ khai dung sai 1s cho ĐÚNG mức spec quy định.
    const ok = await checkRow(ORDERS, { id: o.id }, { created_at: instant(`${naive.slice(0, 19)}Z`, { storedZone: 'UTC', toleranceMs: 1000 }) });
    expect(ok.diffs, JSON.stringify(ok.diffs)).toEqual([]);
    expect(ok.inconclusive, 'đã khai storedZone nên không còn inconclusive').toEqual([]);

    // Cùng số nhưng gán +07 ⇒ mốc thật lệch 7 giờ ⇒ phải BÁO LỆCH, và nói rõ là múi giờ.
    const bad = await checkRow(ORDERS, { id: o.id }, { created_at: instant(`${naive.slice(0, 19)}+07:00`, { storedZone: 'UTC', toleranceMs: 1000 }) });
    expect(bad.diffs.length).toBe(1);
    expect(bad.diffs[0].why).toMatch(/múi giờ|7 giờ/);
  });
});
