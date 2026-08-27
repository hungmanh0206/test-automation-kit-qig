import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { money, instant, text, exact, asMatcher } from '../../support/setup/db/match';
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

const grant = (table: string, privilege: string): GrantRow => ({ table, privilege });

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
    // storedZone để trống có chủ đích ⇒ instant() phải inconclusive (test ở trên đã khoá).
    expect(conv.timestamps.storedZone || '').toBe('');
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

test.describe('@infra fieldMap — cột chưa neo KHÔNG được dùng để phán', () => {
  /*
   * Bản đồ cột↔field neo bằng fixture phân biệt (27/08/2026, 4 đơn thật, đọc UI read-only).
   * Test này khoá đúng một điều: `unanchored` phải LUÔN được khai và không được rỗng-vì-quên. Cột chưa neo
   * mà đem đi kết luận "UI đúng + DB sai = bug persist" thì sinh ra bug ma CÓ SỐ TỪ DB — thuyết phục hơn
   * bug ma thường, và đúng lớp sai đã làm 10 ticket bị reject ngày 23–24/08.
   */
  test('mỗi cột tiền/enum của bảng lõi phải nằm ở anchored HOẶC unanchored — không được bỏ lửng', () => {
    const conv = loadConventions(REPO);
    const fm = (conv as unknown as { fieldMap?: { entity: string; anchored: Record<string, string>; unanchored: Record<string, string> } }).fieldMap;
    expect(fm, 'thiếu `fieldMap` ⇒ không ai biết cột nào neo được').toBeTruthy();
    const decided = new Set([...Object.keys(fm!.anchored), ...Object.keys(fm!.unanchored)]);
    const moneyCols = (conv.money?.entities || {})[fm!.entity] || [];
    for (const col of moneyCols) {
      expect(decided.has(col), `cột tiền "${col}" chưa được QUYẾT (anchored/unanchored)`).toBe(true);
    }
  });

  test('mỗi cột `unanchored` phải nói RÕ vì sao chưa neo (để biết cần fixture gì)', () => {
    const conv = loadConventions(REPO);
    const fm = (conv as unknown as { fieldMap: { unanchored: Record<string, string> } }).fieldMap;
    for (const [col, why] of Object.entries(fm.unanchored)) {
      expect(String(why).trim().length, `"${col}" thiếu lý do`).toBeGreaterThan(15);
    }
  });

  test('nhãn UI của cột đã neo phải là chuỗi thật, không rỗng/không phải số', () => {
    const conv = loadConventions(REPO);
    const fm = (conv as unknown as { fieldMap: { anchored: Record<string, string> } }).fieldMap;
    expect(Object.keys(fm.anchored).length, 'neo được ít nhất vài cột').toBeGreaterThanOrEqual(5);
    for (const [col, label] of Object.entries(fm.anchored)) {
      expect(label.replace(/[^A-Za-zÀ-ỹ]/g, '').length, `nhãn của "${col}" trông như số/rỗng: "${label}"`).toBeGreaterThanOrEqual(2);
    }
  });
});
