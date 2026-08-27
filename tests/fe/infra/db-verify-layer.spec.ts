import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { money, instant, text, exact, asMatcher } from '../../support/setup/db/match';
import { normalizePrivilege } from '../../support/setup/db/types';
import { proveReadOnlyFromGrants, assertReadOnly, assertReadOnlyQuery, assertHostAllowed, WRITE_PRIVILEGES } from '../../support/setup/db/guard';
import { loadConventions, softDeleteFor, loadConnection } from '../../support/setup/db/config';
import { DbGuardError, type GrantRow } from '../../support/setup/db/types';

/*
 * @infra — TẦNG KIỂM DỮ LIỆU DB, giai đoạn 1–2 (không cần kết nối).
 *
 * Ba thứ được khoá ở đây, và cả ba đều xuất phát từ SỐ ĐO trên `sapp-platform-uat` (27/08/2026):
 *  ① `proveReadOnly` phải ĐỌC QUYỀN, không thử ghi. `CREATE TEMP TABLE` không chứng minh được gì trên
 *     Postgres (quyền TEMPORARY mặc định cấp cho PUBLIC) ⇒ probe kiểu đó sẽ TỪ CHỐI OAN một role read-only
 *     đúng chuẩn, và người dùng sẽ quay về user full quyền.
 *  ② So sánh phải type-aware: `orders.final_price` là `bigint`, `transaction_orders.amount` là
 *     `character varying`. So thô ⇒ đỏ hàng loạt dù DB lưu đúng.
 *  ③ Không phán được thì trả `inconclusive`: 39/39 cột thời gian là `timestamp WITHOUT time zone`, nên
 *     thiếu `storedZone` thì so mốc thời gian là ĐOÁN.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');

/* Fixture đi qua `normalizePrivilege` như adapter thật — fixture bỏ qua bước chuẩn hoá là test một đường,
 * production chạy một đường khác. */
const grant = (table: string, privilege: string): GrantRow => ({ table, privilege: normalizePrivilege(privilege) });

test.describe('@infra db guard — chứng minh read-only bằng ĐỌC QUYỀN', () => {
  test('user chỉ có SELECT ⇒ ĐẠT (role read-only đúng chuẩn không được bị từ chối oan)', () => {
    const proof = proveReadOnlyFromGrants([grant('orders', 'SELECT'), grant('transactions', 'SELECT')]);
    expect(proof.readonly).toBe(true);
    expect(() => assertReadOnly(proof)).not.toThrow();
  });

  test('user có INSERT ⇒ CHẶN, và nêu ĐÚNG SỐ bảng để DBA sửa được ngay', () => {
    // Mô phỏng đúng hiện trạng đo được: full quyền trên 232 bảng.
    const grants: GrantRow[] = [];
    for (let i = 0; i < 232; i += 1) for (const p of ['SELECT', ...WRITE_PRIVILEGES]) grants.push(grant(`t${i}`, p));
    const proof = proveReadOnlyFromGrants(grants);
    expect(proof.readonly).toBe(false);
    expect(proof.writeGrants.INSERT).toBe(232);
    expect(proof.writeGrants.TRUNCATE).toBe(232);

    let err: Error | null = null;
    try { assertReadOnly(proof, { user: 'sapp_platform_uat', database: 'sapp-platform-uat' }); } catch (e) { err = e as Error; }
    expect(err, 'phải chặn').toBeTruthy();
    expect(err).toBeInstanceOf(DbGuardError);
    expect(err!.message).toContain('INSERT=232');
    expect(err!.message, 'phải kèm SQL tạo role, không chỉ nói "hãy dùng read-only user"').toContain('GRANT SELECT ON ALL TABLES');
  });

  test('REFERENCES/TRIGGER KHÔNG tính là quyền ghi (không đổi dữ liệu trực tiếp)', () => {
    const proof = proveReadOnlyFromGrants([grant('orders', 'SELECT'), grant('orders', 'REFERENCES'), grant('orders', 'TRIGGER')]);
    expect(proof.readonly, 'siết quá thì role read-only hợp lệ cũng bị chặn').toBe(true);
  });

  test('0 dòng quyền ⇒ CHẶN vì PHÉP ĐO HỎNG, không phải "an toàn"', () => {
    const proof = proveReadOnlyFromGrants([]);
    expect(proof.readonly).toBe(true);          // không tìm thấy quyền ghi…
    expect(() => assertReadOnly(proof), '…nhưng không đọc được gì thì không được kết luận').toThrow(/KHÔNG kết luận/);
  });

  test('`scope` giới hạn đúng phạm vi bảng đang xét', () => {
    const grants = [grant('orders', 'SELECT'), grant('audit_dump', 'INSERT')];
    expect(proveReadOnlyFromGrants(grants).readonly, 'xét toàn bộ ⇒ thấy INSERT').toBe(false);
    expect(proveReadOnlyFromGrants(grants, ['orders']).readonly, 'chỉ xét orders ⇒ sạch').toBe(true);
  });
});

test.describe('@infra db guard — lint câu truy vấn + host', () => {
  test('chỉ cho câu ĐỌC', () => {
    for (const ok of ['SELECT 1', '  with x as (select 1) select * from x', 'EXPLAIN SELECT 1', 'SHOW TABLES']) {
      expect(() => assertReadOnlyQuery(ok), ok).not.toThrow();
    }
    for (const bad of ['UPDATE orders SET x=1', 'delete from orders', 'TRUNCATE orders', 'DROP TABLE x']) {
      expect(() => assertReadOnlyQuery(bad), bad).toThrow();
    }
  });

  test('stacked query bị chặn, kể cả khi giấu sau comment', () => {
    expect(() => assertReadOnlyQuery('SELECT 1; DELETE FROM orders')).toThrow(/stacked/i);
    expect(() => assertReadOnlyQuery('SELECT 1 -- ok\n; DROP TABLE orders')).toThrow();
  });

  test('`;` cuối câu là hợp lệ (không báo oan)', () => {
    expect(() => assertReadOnlyQuery('SELECT 1;')).not.toThrow();
  });

  test('hàm đọc/ghi file + admin bị chặn', () => {
    for (const bad of ['SELECT pg_read_file(\'/etc/passwd\')', 'SELECT load_file("/etc/passwd")', 'SELECT 1 INTO OUTFILE \'/tmp/x\'']) {
      expect(() => assertReadOnlyQuery(bad), bad).toThrow();
    }
  });

  test('host: allowlist + deny-pattern (prod)', () => {
    const cfg = { allowedHosts: ['db-uat.sapp.edu.vn'], denyHostPatterns: ['prod', 'live'] };
    expect(() => assertHostAllowed({ host: 'db-uat.sapp.edu.vn', database: 'sapp-platform-uat' }, cfg)).not.toThrow();
    expect(() => assertHostAllowed({ host: 'db-prod.sapp.edu.vn', database: 'x' }, cfg)).toThrow();
    // deny áp cả DBNAME — host đúng allowlist nhưng trỏ db production thì vẫn chặn.
    expect(() => assertHostAllowed({ host: 'db-uat.sapp.edu.vn', database: 'sapp-platform-prod' }, cfg)).toThrow(/prod/);
  });

  test('bỏ trống guard ⇒ KHÔNG áp (không phá cấu hình cũ)', () => {
    expect(() => assertHostAllowed({ host: 'bất-kỳ', database: 'x' }, {})).not.toThrow();
  });
});

test.describe('@infra so sánh tiền — bigint vs varchar là CÙNG một khái niệm', () => {
  test('540000 khớp mọi biểu diễn hợp lệ mà DB này thật sự dùng', () => {
    for (const v of [540000, 540000n, '540000', ' 540000 ', '540000.00', '540,000']) {
      expect(money(540000).compare(v).verdict, `${JSON.stringify(String(v))}`).toBe('match');
    }
  });

  test('540000.5 KHÔNG khớp 540000 — "kiểu số bị đổi" là lỗi cần bắt, không phải nhiễu', () => {
    const r = money(540000).compare('540000.5');
    expect(r.verdict).toBe('mismatch');
    expect((r as { why: string }).why).toMatch(/thập phân|kiểu số bị đổi/);
  });

  test('lệch giá trị ⇒ nói rõ lệch BAO NHIÊU ĐỒNG (dev sửa được ngay)', () => {
    const r = money(5_000_000).compare('7000000');
    expect(r.verdict).toBe('mismatch');
    expect((r as { why: string }).why).toContain('2000000');
  });

  test('NULL / chuỗi rác ⇒ mismatch có lý do, không crash', () => {
    expect(money(1).compare(null).verdict).toBe('mismatch');
    expect(money(1).compare('abc').verdict).toBe('mismatch');
  });

  test('số vượt MAX_SAFE_INTEGER ⇒ nói thẳng phải đọc bằng string/bigint', () => {
    const r = money('9007199254740993').compare(9007199254740993);
    expect(['mismatch', 'inconclusive']).toContain(r.verdict);
  });
});

test.describe('@infra so mốc thời gian — cột KHÔNG có timezone', () => {
  test('thiếu `storedZone` ⇒ INCONCLUSIVE, tuyệt đối không phán sai/đúng', () => {
    const r = instant('2026-08-23T23:00+07:00').compare('2026-08-23 16:00:00');
    expect(r.verdict, 'đoán múi giờ = tạo bug ma').toBe('inconclusive');
    expect((r as { why: string }).why).toContain('storedZone');
  });

  test('khai storedZone=UTC ⇒ so đúng mốc, khớp thì match', () => {
    const r = instant('2026-08-23T23:00+07:00', { storedZone: 'UTC' }).compare('2026-08-23 16:00:00');
    expect(r.verdict, JSON.stringify(r)).toBe('match');
  });

  test('lệch tròn giờ ⇒ chỉ thẳng "sai quy đổi múi giờ" (ổ bug của cột không offset)', () => {
    const r = instant('2026-08-23T23:00+07:00', { storedZone: 'UTC' }).compare('2026-08-23 23:00:00');
    expect(r.verdict).toBe('mismatch');
    expect((r as { why: string }).why).toMatch(/múi giờ/);
    expect((r as { why: string }).why).toContain('7 giờ');
  });

  test('storedZone sai định dạng ⇒ inconclusive, không âm thầm coi là UTC', () => {
    const r = instant('2026-08-23T23:00Z', { storedZone: 'Asia/Saigon' }).compare('2026-08-23 23:00:00');
    expect(r.verdict).toBe('inconclusive');
  });
});

test.describe('@infra so text — bắt được "bị cắt do varchar(n)"', () => {
  test('cắt đúng ở giới hạn cột ⇒ nói rõ varchar(n), không chỉ "không khớp"', () => {
    const long = 'A'.repeat(60);
    const r = text(long, { maxLength: 50 }).compare('A'.repeat(50));
    expect(r.verdict).toBe('mismatch');
    expect((r as { why: string }).why).toContain('varchar(50)');
    expect((r as { why: string }).why).toContain('mất 10 ký tự');
  });

  test('phân biệt HOA/thường và NFC/NFD — cùng chữ khác byte', () => {
    expect((text('Ưu đãi').compare('ưu đãi') as { why: string }).why).toContain('HOA/thường');
    const nfd = 'Ưu đãi'.normalize('NFD');
    expect((text('Ưu đãi').compare(nfd) as { why: string }).why).toMatch(/Unicode|NFC/);
  });

  test('khớp verbatim ⇒ match; kiểu khác chuỗi ⇒ mismatch có lý do', () => {
    expect(text('paid').compare('paid').verdict).toBe('match');
    expect(text('paid').compare(42).verdict).toBe('mismatch');
  });
});

test.describe('@infra config — conventions commit được, creds thì không', () => {
  test('file conventions THẬT của repo hợp lệ và phản ánh schema đã đo', () => {
    const conv = loadConventions(REPO);
    expect(conv.idColumn).toBe('id');
    // 7 bảng nối KHÔNG có deleted_at ⇒ phải khai `none`, không được để rơi vào default.
    expect(softDeleteFor(conv, 'ic_payment_order_product_instances').mode).toBe('none');
    expect(softDeleteFor(conv, 'ic_payment_orders').mode).toBe('timestamp');
    expect(softDeleteFor(conv, 'ic_payment_orders').column).toBe('deleted_at');
    /*
     * Trước 27/08/2026 test này khoá `storedZone` phải TRỐNG (chưa đo được thì `instant()` trả inconclusive —
     * đó là câu trả lời đúng). Nay đã ĐO được bằng phép read-only nên khoá vào giá trị đo: đổi kết luận này
     * thì phải đo lại, không sửa tay. Nhánh "chưa khai ⇒ inconclusive" vẫn được khoá riêng ở test instant().
     */
    expect(conv.timestamps.storedZone, 'đã đo được UTC — xem `timestamps._why` trong conventions').toBe('UTC');
    expect(conv.safety.requireReadonlyUser).toBe(true);
    expect(conv.safety.denyHostPatterns).toContain('prod');
  });

  test('bảng chưa khai ⇒ dùng default, và default phải là thứ ĐO ĐƯỢC (deleted_at)', () => {
    const conv = loadConventions(REPO);
    expect(softDeleteFor(conv, 'bang_chua_khai').mode).toBe('timestamp');
  });

  test('thiếu file conventions ⇒ CHẶN với thông điệp nói rõ phải khai ra file', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'dbconv-'));
    expect(() => loadConventions(empty)).toThrow(/db\.conventions\.json/);
  });

  test('connection: thiếu env ⇒ CHẶN, và KHÔNG rơi về user full quyền', () => {
    let err: Error | null = null;
    try { loadConnection('LIB_MASTER_DB_RO', {}); } catch (e) { err = e as Error; }
    expect(err).toBeTruthy();
    expect(err!.message).toContain('LIB_MASTER_DB_RO_HOST');
    expect(err!.message, 'phải chỉ đúng chỗ đặt creds theo luật task-isolation').toContain('profiles/<TASK_KEY>/task.env');
    expect(err!.message).toContain('cố ý không rơi về user full quyền');
  });

  test('connection đủ env ⇒ đọc đúng, port sai ⇒ chặn', () => {
    const base = {
      LIB_MASTER_DB_RO_HOST: 'db-uat.sapp.edu.vn',
      LIB_MASTER_DB_RO_PORT: '5432',
      LIB_MASTER_DB_RO_NAME: 'sapp-platform-uat',
      LIB_MASTER_DB_RO_USERNAME: 'sapp_qa_readonly',
      LIB_MASTER_DB_RO_PASSWORD: 'x',
    };
    const c = loadConnection('LIB_MASTER_DB_RO', base);
    expect(c).toMatchObject({ dialect: 'postgres', port: 5432, database: 'sapp-platform-uat' });
    expect(() => loadConnection('LIB_MASTER_DB_RO', { ...base, LIB_MASTER_DB_RO_PORT: 'abc' })).toThrow(/PORT/);
  });
});

test.describe('@infra asMatcher — giá trị trần vẫn dùng được', () => {
  test('giá trị trần ⇒ bọc thành exact; matcher ⇒ giữ nguyên', () => {
    expect(asMatcher('paid').kind).toBe('exact');
    expect(asMatcher(money(1)).kind).toBe('money');
    expect(exact('paid').compare('paid').verdict).toBe('match');
    expect((exact('paid').compare(' paid ') as { why: string }).why).toContain('khoảng trắng');
  });
});

test.describe('@infra fieldMap — theo MÀN, và cột chưa neo KHÔNG được dùng để phán', () => {
  /*
   * Vòng 2 (27/08/2026) bác giả định "một bản đồ cho cả DB": màn Service Fee và màn Core hiển thị CÙNG một
   * cột dưới HAI nhãn khác nhau — `original_price` là "Gross Amount" ở CORE nhưng "Gross Price" ở
   * SERVICE_FEE. Nếu neo toàn cục thì giao rỗng; nếu bỏ luật giao thì neo SAI MÀN rồi phán chắc chắn trên
   * cột sai. Nên bản đồ BẮT BUỘC có khoá là màn.
   */
  const fieldMap = () => {
    // Dùng KIỂU THẬT từ config.ts, không khai lại inline: khai lại là bản sao trôi khỏi bản gốc lúc nào không hay.
    const conv = loadConventions(REPO);
    expect(conv.fieldMap, 'thiếu `fieldMap` ⇒ không ai biết cột nào neo được').toBeTruthy();
    return conv.fieldMap!;
  };

  test('bản đồ phải khoá THEO MÀN, không phẳng', () => {
    const fm = fieldMap();
    expect(fm.byScreen, 'bản đồ phẳng là neo sai màn').toBeTruthy();
    expect(Object.keys(fm.byScreen).length).toBeGreaterThanOrEqual(2);
    for (const [screen, cols] of Object.entries(fm.byScreen)) {
      expect(cols._route, `màn ${screen} thiếu \`_route\` — không biết neo trên URL nào`).toBeTruthy();
    }
  });

  test('CÙNG một cột được phép có nhãn KHÁC nhau giữa hai màn (đó là lý do phải khoá theo màn)', () => {
    const fm = fieldMap();
    expect(fm.byScreen.SERVICE_FEE.original_price).toBe('Gross Price');
    expect(fm.byScreen.CORE.original_price).toBe('Gross Amount');
    expect(fm.byScreen.SERVICE_FEE.original_price).not.toBe(fm.byScreen.CORE.original_price);
  });

  test('mỗi cột tiền phải được QUYẾT: neo ở ít nhất 1 màn HOẶC khai unanchored', () => {
    const conv = loadConventions(REPO);
    const fm = fieldMap();
    const anchoredCols = new Set(Object.values(fm.byScreen).flatMap((c) => Object.keys(c)).filter((k) => !k.startsWith('_')));
    const unanchored = new Set(Object.keys(fm.unanchored).map((k) => k.split('@')[0]));
    for (const col of (conv.money?.entities || {})[fm.entity] || []) {
      expect(anchoredCols.has(col) || unanchored.has(col), `cột tiền "${col}" chưa được quyết`).toBe(true);
    }
  });

  test('cột TỈ LỆ phải ra khỏi danh sách tiền (money() lên tỉ lệ là sai nghĩa)', () => {
    /*
     * ĐO 28/08: service_fee_rate max=20 (distinct 3), fixed_discount 5/10/15 (3 bản ghi) — biên độ 0..20
     * không thể là VND. Để chúng trong `money` thì `money()` vẫn "chạy" nhưng thông điệp thành "lệch 5 đồng"
     * cho một tỉ lệ, và gate độ-phủ-cột-tiền đếm sai. Cột nào chưa biết đơn vị phải khai `unitUnknown`.
     */
    const conv = loadConventions(REPO);
    const money = conv.money?.entities?.ic_payment_orders || [];
    const rates = conv.rates?.entities?.ic_payment_orders || [];
    expect(rates.length, 'chưa khai cột tỉ lệ nào').toBeGreaterThan(0);
    for (const r of rates) expect(money, `"${r}" vừa là tiền vừa là tỉ lệ — phải chọn một`).not.toContain(r);
    for (const u of conv.rates?.unitUnknown || []) {
      expect(rates, `"${u}" khai unitUnknown thì phải nằm trong rates`).toContain(u);
    }
  });

  test('mỗi cột TỈ LỆ cũng phải được QUYẾT (neo / treo / không-hiển-thị)', () => {
    const conv = loadConventions(REPO);
    const fm = conv.fieldMap!;
    const anchored = new Set(Object.values(fm.byScreen).flatMap((c) => Object.keys(c)).filter((k) => !k.startsWith('_')));
    const decided = new Set([...Object.keys(fm.unanchored), ...Object.keys(fm.notDisplayed || {})].map((k) => k.split('@')[0]));
    for (const col of conv.rates?.entities?.ic_payment_orders || []) {
      expect(anchored.has(col) || decided.has(col), `cột tỉ lệ "${col}" chưa được quyết`).toBe(true);
    }
  });

  test('notDisplayed phải rời khỏi unanchored (không đếm hai lần thành việc-phải-làm)', () => {
    const fm = fieldMap();
    for (const col of Object.keys(fm.notDisplayed || {})) {
      if (col.startsWith('_')) continue;
      expect(fm.unanchored[col], `"${col}" vừa notDisplayed vừa unanchored`).toBeUndefined();
      expect(String((fm.notDisplayed || {})[col]).length, `"${col}" phải nói rõ vì sao không hiển thị`).toBeGreaterThan(25);
    }
  });

  test('valueMaps phải khai ĐỘ PHỦ enum (đủ hay thiếu, thiếu cái nào)', () => {
    /*
     * Bẫy đã dính: neo status/service_fee_type từ 50 hàng đầu rồi tưởng xong. DB có 9 service_fee_type mà
     * 50 hàng chỉ thấy 6 — bản đồ THIẾU mà trông như đủ. Nên bắt buộc khai `_coverage` nói rõ đủ/thiếu.
     */
    const maps = fieldMap().valueMaps || {};
    expect(String(maps._coverage || ''), 'thiếu `_coverage`: không ai biết bản đồ enum đã đủ chưa').toMatch(/DAY DU|ĐẦY ĐỦ|đủ/);
    expect(String(maps._coverage).length).toBeGreaterThan(80);
  });

  test('lý do treo phải là SỐ ĐO, không phải phỏng đoán (nêu bao nhiêu đơn / màn nào)', () => {
    /*
     * Vòng 5 đổi cả 3 lý do treo từ "không hiển thị" (nghe như phỏng đoán) sang số đo cụ thể: bao nhiêu đơn,
     * màn/tab nào, ứng viên nào đã bị bác bỏ. Luật này giữ chuẩn đó — lý do treo mà không có số thì lần sau
     * không ai biết đã đo tới đâu, và sẽ đo lại từ đầu.
     */
    const un = fieldMap().unanchored;
    for (const [col, why] of Object.entries(un)) {
      const w = String(why);
      expect(/d/.test(w), `"${col}": lý do treo không có con số nào (bao nhiêu đơn? bao nhiêu bản ghi?)`).toBe(true);
      expect(/DO |ĐO |Quet|Quét|quet|man |màn |tab /.test(w), `"${col}": lý do treo phải nói ĐO ở đâu`).toBe(true);
    }
  });

  test('phương pháp so-hai-nhóm phải được khai VÀ có máy chạy nó', () => {
    const fm = fieldMap() as unknown as { _method_enum_by_groups?: string };
    const m = String(fm._method_enum_by_groups || '');
    expect(m.length, 'conventions chưa khai phương pháp neo cột enum').toBeGreaterThan(80);
    expect(m, 'phải ghi ràng buộc ≥3 đơn của khách khác nhau — đây là chỗ đã tạo 4 kết quả giả').toMatch(/3 don|3 đơn/);
    const spec = fs.readFileSync(path.join(REPO, 'tests/support/setup/db/fieldmap.anchor.spec.ts'), 'utf8');
    expect(spec, 'khai phương pháp mà không có máy chạy thì chỉ là văn bản').toContain('SO HAI NHÓM');
  });

  test('mỗi cột unanchored phải nói RÕ vì sao (để biết cần fixture gì)', () => {
    for (const [col, why] of Object.entries(fieldMap().unanchored)) {
      expect(String(why).trim().length, `"${col}" thiếu lý do`).toBeGreaterThan(25);
    }
  });

  test('loader KHÔNG được bỏ âm thầm khối lạ (đã dính: fieldMap khai mà code không thấy)', async () => {
    const { loadConventions: load } = await import('../../support/setup/db/config');
    const tmp = path.join(os.tmpdir(), `conv-unknown-${process.pid}`);
    fs.mkdirSync(path.join(tmp, '.agent', 'config'), { recursive: true });
    const real = JSON.parse(fs.readFileSync(path.join(REPO, '.agent', 'config', 'db.conventions.json'), 'utf8'));
    fs.writeFileSync(path.join(tmp, '.agent', 'config', 'db.conventions.json'), JSON.stringify({ ...real, khoiMoi: { a: 1 } }));
    expect(() => load(tmp)).toThrow(/khối chưa được loader nối: khoiMoi/);
    // và bản THẬT của repo thì phải qua được (khối nào cũng đã nối)
    expect(() => load(REPO)).not.toThrow();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('bản đồ GIÁ TRỊ (enum → nhãn) phải ĐƠN ÁNH trong từng cột', () => {
    /*
     * Hai enum dùng chung một nhãn thì nhãn đó không phân biệt được trạng thái ⇒ dùng để phán là ra kết luận
     * sai. Đây chính là luật đã áp lúc đo; kiểm lại ở đây để lần sau ai sửa file tay cũng bị chặn.
     */
    const maps = fieldMap().valueMaps || {};
    const keys = Object.keys(maps).filter((k) => !k.startsWith('_'));
    expect(keys.length, 'chưa neo bản đồ giá trị nào').toBeGreaterThan(0);
    for (const k of keys) {
      expect(k, `khoá valueMaps phải là "<bảng>.<cột>", đang là "${k}"`).toMatch(/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/);
      const pairs = Object.entries(maps[k]).filter(([e]) => !e.startsWith('_'));
      expect(pairs.length, `${k} rỗng`).toBeGreaterThan(0);
      const labels = pairs.map(([, l]) => l);
      expect(new Set(labels).size, `${k}: nhãn trùng nhau ⇒ không đơn ánh: ${JSON.stringify(labels)}`).toBe(labels.length);
      for (const [en, l] of pairs) {
        expect(en, `enum "${en}" phải là HOA_GACH_DUOI`).toMatch(/^[A-Z][A-Z0-9_]*$/);
        expect(l.trim().length, `nhãn của ${en} rỗng`).toBeGreaterThan(0);
      }
    }
  });

  test('nhãn KHÔNG được trùng tên enum (enum thô lọt vào bản đồ = hoặc bug FE, hoặc bản đồ làm cho xong)', () => {
    /*
     * Luật này bắt được một bug thật (28/08): màn Add-on hiện `CHUYEN_DOI` thô thay vì "Chuyển đổi". Nếu cứ
     * ghi CHUYEN_DOI → "CHUYEN_DOI" vào bản đồ thì phép đo sau này lấy chính cái sai làm chuẩn rồi assert
     * theo nó — bug biến thành "hành vi mong đợi". Lệch phải nằm ở `_deviations`, không nằm trong bản đồ.
     */
    const maps = fieldMap().valueMaps || {};
    for (const [key, m] of Object.entries(maps)) {
      if (key.startsWith('_')) continue;
      for (const [en, label] of Object.entries(m as Record<string, string>)) {
        if (en.startsWith('_')) continue;
        expect(label, `${key}: nhãn của "${en}" chính là tên enum ⇒ hoặc app hiện enum thô (bug), hoặc bản đồ chưa đo`).not.toBe(en);
        expect(label, `${key}: nhãn của "${en}" vẫn là HOA_GACH_DUOI`).not.toMatch(/^[A-Z][A-Z0-9_]*$/);
      }
    }
  });

  test('_deviations: khoá phải trỏ vào màn CÓ THẬT và nói rõ lệch gì', () => {
    const fm = fieldMap();
    const dev = (fm.valueMaps || {})._deviations as Record<string, string> | undefined;
    if (!dev) return;                                   // chưa có lệch nào là chuyện bình thường
    for (const [key, why] of Object.entries(dev)) {
      if (key.startsWith('_')) continue;
      expect(key, 'khoá lệch phải là "<bảng>.<cột>@<MÀN>"').toMatch(/^[a-z_]+\.[a-z_]+@[A-Z_]+$/);
      const screen = key.split('@')[1];
      expect(Object.keys(fm.byScreen), `màn "${screen}" trong _deviations không có trong byScreen`).toContain(screen);
      expect(String(why).length, `lệch "${key}" phải ghi rõ hiện tượng + vì sao chưa log`).toBeGreaterThan(80);
    }
  });

  test('màn danh sách và màn chi tiết là HAI màn khác nhau trong bản đồ', () => {
    const fm = fieldMap();
    // `final_price` neo ở SERVICE_FEE (Net Amount) và ở CORE_LIST, nhưng KHÔNG neo ở CORE (tab Overview).
    expect(fm.byScreen.CORE_LIST, 'thiếu màn danh sách CORE').toBeTruthy();
    expect(fm.byScreen.CORE_LIST.final_price).toBe('Net Amount');
    expect(fm.byScreen.CORE.final_price, 'tab Overview của CORE chưa neo final_price — không được lẫn với màn danh sách').toBeUndefined();
    for (const [screen, cols] of Object.entries(fm.byScreen)) {
      expect(cols._route, `màn "${screen}" phải khai _route để biết đo ở đâu`).toBeTruthy();
    }
  });

  test('uiLabelOfColumn: neo thì trả nhãn, CHƯA neo hoặc SAI MÀN thì NÉM', async () => {
    const { loadConventions, uiLabelOfColumn } = await import('../../support/setup/db/config');
    const conv = loadConventions(process.cwd());
    expect(uiLabelOfColumn(conv, 'CORE_LIST', 'final_price')).toBe('Net Amount');
    expect(uiLabelOfColumn(conv, 'SERVICE_FEE', 'original_price')).toBe('Gross Price');
    // Cột đang treo ⇒ ném, và phải NÓI RA lý do treo để biết cần fixture gì.
    expect(() => uiLabelOfColumn(conv, 'CORE', 'deposit')).toThrow(/CHƯA NEO/);
    expect(() => uiLabelOfColumn(conv, 'CORE', 'deposit')).toThrow(/Lý do đang treo/);
    // Neo ở màn khác ⇒ vẫn ném, và phải chỉ ra neo ở màn nào (chứ không im lặng trả nhãn màn kia).
    expect(() => uiLabelOfColumn(conv, 'CORE', 'final_price')).toThrow(/chỉ neo ở: SERVICE_FEE, CORE_LIST/);
    expect(() => uiLabelOfColumn(conv, 'MAN_LA', 'deal_id')).toThrow(/chưa có trong fieldMap/);
  });

  test('uiLabelOfValue: enum đã đo thì trả nhãn, enum lạ thì NÉM (không dịch tay)', async () => {
    const { loadConventions, uiLabelOfValue } = await import('../../support/setup/db/config');
    const conv = loadConventions(process.cwd());
    expect(uiLabelOfValue(conv, 'ic_payment_orders.status', 'PARTIALLY_PAID')).toBe('Đã thanh toán 1 phần');
    expect(uiLabelOfValue(conv, 'ic_payment_orders.service_fee_type', 'BAO_LUU')).toBe('Bảo lưu');
    expect(() => uiLabelOfValue(conv, 'ic_payment_orders.status', 'REFUNDED')).toThrow(/chưa neo nhãn UI/);
    expect(() => uiLabelOfValue(conv, 'ic_payment_orders.province', 'HN')).toThrow(/chưa có bản đồ giá trị/);
  });

  test('nhãn đã neo phải là chuỗi thật, không phải số', () => {
    for (const [screen, cols] of Object.entries(fieldMap().byScreen)) {
      for (const [col, label] of Object.entries(cols)) {
        if (col.startsWith('_')) continue;
        expect(label.replace(/[^A-Za-zÀ-ỹ]/g, '').length, `${screen}.${col} nhãn trông như số: "${label}"`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

test.describe('@infra instant() — thông điệp phải đúng ĐỘ LỚN của độ lệch', () => {
  /*
   * Bản đầu làm tròn ra phút rồi kiểm `% 60 === 0`, nên lệch 825ms cũng ra "lệch 0 giờ — dấu hiệu sai quy
   * đổi múi giờ". Đo thật trên `created_at = 2025-05-08 00:14:55.825`. Thông điệp sai loại còn tệ hơn
   * không có thông điệp: nó phái người đọc đi tìm bug timezone không tồn tại.
   */
  test('lệch mili giây ⇒ nói MS + gợi ý toleranceMs, KHÔNG nói múi giờ', () => {
    const r = instant('2025-05-08T00:14:55Z', { storedZone: 'UTC' }).compare('2025-05-08 00:14:55.825');
    expect(r.verdict).toBe('mismatch');
    expect((r as { why: string }).why).toContain('ms');
    expect((r as { why: string }).why).toContain('toleranceMs');
    expect((r as { why: string }).why, 'đừng vu cho múi giờ').not.toContain('múi giờ');
  });

  test('khai toleranceMs 1s ⇒ khớp (spec chỉ quy định tới giây)', () => {
    const r = instant('2025-05-08T00:14:55Z', { storedZone: 'UTC', toleranceMs: 1000 }).compare('2025-05-08 00:14:55.825');
    expect(r.verdict).toBe('match');
  });

  test('lệch tròn giờ ⇒ VẪN nói múi giờ (không mất tín hiệu thật)', () => {
    const r = instant('2025-05-08T00:14:55Z', { storedZone: 'UTC', toleranceMs: 1000 }).compare('2025-05-08 07:14:55.000');
    expect((r as { why: string }).why).toContain('múi giờ');
    expect((r as { why: string }).why).toContain('7 giờ');
  });

  test('lệch vài giây ⇒ nói giây, không nói ms cũng không nói giờ', () => {
    const r = instant('2025-05-08T00:14:55Z', { storedZone: 'UTC' }).compare('2025-05-08 00:15:20.000');
    expect((r as { why: string }).why).toMatch(/giây/);
    expect((r as { why: string }).why).not.toContain('múi giờ');
  });

  test('conventions đã khai storedZone=UTC (đo được, không đoán)', () => {
    const conv = loadConventions(REPO);
    expect(conv.timestamps.storedZone).toBe('UTC');
  });
});

test.describe('@infra instant() — tín hiệu múi giờ không được mất vì nhiễu mili giây', () => {
  test('lệch 7 giờ + 825ms (DB lưu ms) ⇒ VẪN nói múi giờ', () => {
    // Bản trước kiểm `absMs % 3_600_000 === 0` nên ca này rơi xuống "lệch 420 phút" và mất tín hiệu.
    const r = instant('2025-05-08T00:14:55+07:00', { storedZone: 'UTC' }).compare('2025-05-08 00:14:55.825');
    expect(r.verdict).toBe('mismatch');
    expect((r as { why: string }).why).toContain('múi giờ');
    expect((r as { why: string }).why).toContain('7 giờ');
  });

  test('lệch 25 phút ⇒ vẫn nói phút, KHÔNG vu cho múi giờ', () => {
    const r = instant('2025-05-08T00:14:55Z', { storedZone: 'UTC' }).compare('2025-05-08 00:39:55.000');
    expect((r as { why: string }).why).toContain('phút');
    expect((r as { why: string }).why).not.toContain('múi giờ');
  });
});
