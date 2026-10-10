import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { money, instant, text, exact, asMatcher } from '../../support/setup/db/match';
import { normalizePrivilege } from '../../support/setup/db/types';
import { proveReadOnlyFromGrants, assertReadOnly, assertReadOnlyQuery, assertHostAllowed, WRITE_PRIVILEGES } from '../../support/setup/db/guard';
import { assertReadOnlySql } from '../../support/setup/db/uatDbClient';
import { loadConventions, softDeleteFor, loadConnection } from '../../support/setup/db/config';
import { DbGuardError, type GrantRow } from '../../support/setup/db/types';
import { docCfg } from './_cfg';

/*
 * @infra — TẦNG KIỂM DỮ LIỆU DB, giai đoạn 1–2 (không cần kết nối).
 *
 * Ba thứ được khoá ở đây, và cả ba đều xuất phát từ SỐ ĐO trên `app-platform-uat` (27/08/2026):
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

/*
 * QUY ƯỚC GIẢ, dựng riêng cho các luật về `fieldMap`.
 *
 * Vì sao KHÔNG kiểm những luật đó trên file thật của repo: `db.conventions.json` là **dữ liệu của một dự án
 * cụ thể**, không phải hành vi của kit. Bản trước khoá thẳng tên cột và tên màn của một dự án vào test, nên
 * khi dự án đổi thì 10 test đỏ — mà thứ chúng cần chứng minh (bản đồ phải khoá theo màn, enum phải đơn ánh,
 * chưa neo thì phải NÉM chứ đừng trả nhãn màn khác) không hề đổi. Kiểm trên fixture thì các luật đó đúng với
 * MỌI dự án, còn file thật chỉ còn phải đạt các luật về HÌNH DẠNG — và được phép rỗng khi chưa neo.
 *
 * Fixture cố ý dựng đúng các bẫy đã từng làm sai kết luận:
 *   - `gia_goc` mang HAI nhãn khác nhau ở hai màn (lý do bản đồ phải khoá theo màn),
 *   - `thanh_tien` neo ở màn danh sách nhưng KHÔNG neo ở màn chi tiết,
 *   - `tien_coc` chỉ neo ở màn sửa, trong khi màn chi tiết cũng có nhãn trùng chữ nhưng khác nghĩa,
 *   - `gia_tuy_chon` treo, kèm lý do có số đo.
 */
const CONV_FIXTURE = {
  idColumn: 'id',
  softDelete: {
    default: { mode: 'timestamp', column: 'deleted_at' },
    byEntity: { don_hang_chi_tiet: { mode: 'none' } },
  },
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at', storedZone: 'UTC' },
  audit: { supported: false },
  money: { entities: { don_hang: ['gia_goc', 'thanh_tien', 'tien_coc', 'gia_tuy_chon'] } },
  rates: { entities: { don_hang: ['ty_le_phi', 'giam_gia_co_dinh'] }, unitUnknown: ['giam_gia_co_dinh'] },
  relations: {},
  safety: { requireReadonlyUser: true, allowedHosts: [], denyHostPatterns: ['prod'], statementTimeoutMs: 5000, maxRows: 500 },
  fieldMap: {
    entity: 'don_hang',
    byScreen: {
      CHI_TIET: { _route: '/don-hang/<id>/chi-tiet', gia_goc: 'Giá gốc', trang_thai: 'Trạng thái' },
      DANH_SACH: { _route: '/don-hang?page=1', id: 'Mã đơn hàng', gia_goc: 'Giá niêm yết', thanh_tien: 'Thành tiền' },
      SUA: { _route: '/don-hang/<id>/sua', tien_coc: 'Tiền đã trả', ty_le_phi: 'Tỉ lệ phí' },
    },
    unanchored: {
      gia_tuy_chon: 'ĐO toàn bộ 132 bản ghi non-null trên màn chi tiết: không bản ghi nào có gia_tuy_chon khác mọi cột tiền khác ⇒ chưa phân biệt được, cần fixture đặt giá riêng.',
      giam_gia_co_dinh: 'ĐO 2 bản ghi trên 3 màn (chi tiết, danh sách, form sửa): không màn nào hiện giá trị 10 hay 15 ⇒ chưa xác định được đơn vị.',
    },
    notDisplayed: {
      loai_man: 'Quyết định ROUTE chứ không hiện dưới dạng một field. Khoá màn trong byScreen CHÍNH LÀ giá trị cột này.',
    },
    valueMaps: {
      _coverage: 'ĐẦY ĐỦ, nói rõ từng cột: don_hang.trang_thai = 3/3 enum của DB, đo độc lập trên cả hai màn danh sách và cho kết quả trùng nhau. Vì sao phải đọc hai màn: trang đầu của một màn chỉ thấy 2/3 enum — bản đồ THIẾU mà trông như đủ.',
      'don_hang.trang_thai': { CHO_DUYET: 'Chờ duyệt', DA_DUYET: 'Đã duyệt', TU_CHOI: 'Từ chối' },
      _deviations: {
        'don_hang.trang_thai@DANH_SACH': 'Màn danh sách hiện enum thô TU_CHOI thay vì nhãn "Từ chối". Giữ ở đây chứ không ghi vào bản đồ, vì ghi vào là lấy chính cái sai làm chuẩn rồi assert theo nó. Chưa log bug vì chưa đối chiếu được với bản thiết kế.',
      },
    },
    _method_enum_by_groups:
      'Neo cột enum không hiện dạng chuỗi: lấy HAI NHÓM bản ghi cùng màn khác nhau ở cột đó, tìm nhãn nào có ở mọi bản ghi cả hai nhóm, không đổi trong từng nhóm, và khác nhau giữa hai nhóm. Mỗi nhóm phải từ 3 đơn của các đối tượng KHÁC NHAU — hai bản ghi gần-bản-sao làm mọi phép so nhóm ra kết quả giả.',
  },
};

/** Ghi một bộ quy ước giả ra repo tạm rồi nạp bằng CHÍNH loader thật, không tự dựng object. */
function convFixture(over: Record<string, unknown> = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'convfix-'));
  fs.mkdirSync(path.join(tmp, '.agent', 'config'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.agent', 'config', 'db.conventions.json'),
    JSON.stringify({ ...CONV_FIXTURE, ...over }), 'utf8');
  try { return loadConventions(tmp); } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

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
    try { assertReadOnly(proof, { user: 'uat_app_user', database: 'app-platform-uat' }); } catch (e) { err = e as Error; }
    expect(err, 'phải chặn').toBeTruthy();
    expect(err).toBeInstanceOf(DbGuardError);
    expect(err!.message).toContain('INSERT=232');
    expect(err!.message, 'phải kèm SQL tạo login, không chỉ nói "hãy dùng read-only user"').toContain('ALTER ROLE db_datareader ADD MEMBER');
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

  /*
   * Danh sách đổi theo phương ngữ (24/09/2026): bỏ Postgres nên `pg_read_file`/`lo_export` không còn nghĩa.
   * Họ nguy hiểm của SQL Server là thủ tục hệ thống `xp_*`/`sp_*`, đường đọc-ghi file (`openrowset`,
   * `bulk insert`, `opendatasource`) và lệnh quản trị (`dbcc`, `backup`, `shutdown`).
   */
  test('hàm đọc/ghi file + admin của SQL Server bị chặn', () => {
    const bads = [
      "SELECT * FROM OPENROWSET(BULK 'C:/x.txt', SINGLE_CLOB) AS a",
      "SELECT * FROM OPENDATASOURCE('SQLOLEDB', 'x')",
      "SELECT 1 FROM t WHERE x = 1 AND y IN (SELECT 1) AND xp_cmdshell IS NULL",
      'SELECT load_file("/etc/passwd")',
      "SELECT 1 INTO OUTFILE '/tmp/x'",
      'SELECT 1 INTO [dbo].[bang_moi]',
      "SELECT 1 FROM t WHERE 1=1 DBCC CHECKDB",
    ];
    for (const bad of bads) {
      expect(() => assertReadOnlyQuery(bad), bad).toThrow();
    }
  });

  test('host: allowlist + deny-pattern (prod)', () => {
    const cfg = { allowedHosts: ['db-uat.example'], denyHostPatterns: ['prod', 'live'] };
    expect(() => assertHostAllowed({ host: 'db-uat.example', database: 'app-platform-uat' }, cfg)).not.toThrow();
    expect(() => assertHostAllowed({ host: 'db-prod.example.com', database: 'x' }, cfg)).toThrow();
    // deny áp cả DBNAME — host đúng allowlist nhưng trỏ db production thì vẫn chặn.
    expect(() => assertHostAllowed({ host: 'db-uat.example', database: 'app-platform-prod' }, cfg)).toThrow(/prod/);
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
    expect(softDeleteFor(conv, 'bang_bat_ky').mode).toBe('timestamp');
    expect(softDeleteFor(conv, 'bang_bat_ky').column).toBe('deleted_at');
    /*
     * Bảng khai `none` phải THẮNG default — ở đó xoá là xoá CỨNG nên `expectSoftDeleted` phải từ chối phán.
     * Kiểm trên fixture chứ không trên file thật: `byEntity` của file thật là dữ liệu của dự án, nó được
     * phép rỗng khi chưa ai đo bảng nào thiếu cột xoá mềm. Hành vi "none thắng default" thì không đổi.
     */
    expect(softDeleteFor(convFixture(), 'don_hang_chi_tiet').mode).toBe('none');
    /*
     * Trước 27/08/2026 test này khoá `storedZone` phải TRỐNG (chưa đo được thì `instant()` trả inconclusive —
     * đó là câu trả lời đúng). Nay đã ĐO được bằng phép read-only nên khoá vào giá trị đo: đổi kết luận này
     * thì phải đo lại, không sửa tay. Nhánh "chưa khai ⇒ inconclusive" vẫn được khoá riêng ở test instant().
     */
    expect(conv.timestamps.storedZone, 'đã đo được UTC — xem `timestamps._why` trong conventions').toBe('UTC');
    /*
     * TẮT 24/09/2026 theo quyết định của chủ dự án (login `csdl` là `dbo` trên DB thật). Test khoá vào
     * trạng thái đó ĐỒNG THỜI bắt buộc phải có `_why_requireReadonlyUser` — tắt một chốt an toàn mà không
     * ghi lý do thì gate này đỏ. Xin được login chỉ SELECT thì đổi lại `true`.
     */
    const rawConv = docCfg(REPO, 'db.conventions.json');
    expect(conv.safety.requireReadonlyUser).toBe(false);
    expect(
      String(rawConv.safety._why_requireReadonlyUser || '').length,
      'tắt requireReadonlyUser PHẢI kèm lý do trong `safety._why_requireReadonlyUser`',
    ).toBeGreaterThan(40);
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
      LIB_MASTER_DB_RO_HOST: 'db-uat.example',
      LIB_MASTER_DB_RO_PORT: '5432',
      LIB_MASTER_DB_RO_NAME: 'app-platform-uat',
      LIB_MASTER_DB_RO_USERNAME: 'qa_readonly',
      LIB_MASTER_DB_RO_PASSWORD: 'x',
    };
    const c = loadConnection('LIB_MASTER_DB_RO', base);
    expect(c).toMatchObject({ dialect: 'mssql', port: 5432, database: 'app-platform-uat' });
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
   * Một phép đo thật (27/08/2026) đã bác giả định "một bản đồ cho cả DB": hai màn hiển thị CÙNG một cột
   * dưới HAI nhãn khác nhau. Neo toàn cục thì giao rỗng; bỏ luật giao thì neo SAI MÀN rồi phán chắc chắn
   * trên cột sai. Nên bản đồ BẮT BUỘC có khoá là màn.
   */
  const fieldMap = () => {
    // Dùng KIỂU THẬT từ config.ts, không khai lại inline: khai lại là bản sao trôi khỏi bản gốc lúc nào không hay.
    const conv = loadConventions(REPO);
    expect(conv.fieldMap, 'thiếu `fieldMap` ⇒ không ai biết cột nào neo được').toBeTruthy();
    return conv.fieldMap!;
  };

  test('bản đồ phải khoá THEO MÀN, không phẳng', () => {
    const fx = convFixture().fieldMap!;
    expect(fx.byScreen, 'bản đồ phẳng là neo sai màn').toBeTruthy();
    expect(Object.keys(fx.byScreen).length).toBeGreaterThanOrEqual(2);
    /*
     * File thật được phép RỖNG (chưa neo màn nào), nhưng màn nào ĐÃ khai thì phải có `_route`. Khai nửa vời
     * còn tệ hơn rỗng: rỗng thì `db_verify_preflight` CHẶN, còn nửa vời thì §23 chạy rồi đo trên URL nào
     * không ai biết.
     */
    for (const [screen, cols] of Object.entries(fieldMap().byScreen)) {
      expect(cols._route, `màn ${screen} thiếu \`_route\` — không biết neo trên URL nào`).toBeTruthy();
    }
  });

  test('CÙNG một cột được phép có nhãn KHÁC nhau giữa hai màn (đó là lý do phải khoá theo màn)', () => {
    const fx = convFixture().fieldMap!;
    expect(fx.byScreen.CHI_TIET.gia_goc).toBe('Giá gốc');
    expect(fx.byScreen.DANH_SACH.gia_goc).toBe('Giá niêm yết');
    expect(fx.byScreen.CHI_TIET.gia_goc).not.toBe(fx.byScreen.DANH_SACH.gia_goc);
  });

  test('mỗi cột tiền phải được QUYẾT: neo ở ít nhất 1 màn HOẶC khai unanchored', () => {
    /*
     * Chạy trên CẢ HAI: fixture chứng minh luật có răng, file thật bắt lỗi nếu ai khai cột tiền rồi bỏ lửng.
     * Cột tiền không được quyết là cột lặng lẽ rơi khỏi mọi phép kiểm — nhìn bảng thì tưởng đã phủ hết.
     */
    for (const conv of [convFixture(), loadConventions(REPO)]) {
      const fm = conv.fieldMap!;
      const anchoredCols = new Set(Object.values(fm.byScreen).flatMap((c) => Object.keys(c)).filter((k) => !k.startsWith('_')));
      const treated = new Set([...Object.keys(fm.unanchored || {})].map((k) => k.split('@')[0]));
      for (const col of (conv.money?.entities || {})[fm.entity as string] || []) {
        expect(anchoredCols.has(col) || treated.has(col), `cột tiền "${col}" chưa được quyết`).toBe(true);
      }
    }
  });

  test('cột TỈ LỆ phải ra khỏi danh sách tiền (money() lên tỉ lệ là sai nghĩa)', () => {
    /*
     * ĐO 28/08 trên hai cột tỉ lệ: một cột max 20 (3 giá trị phân biệt), cột kia 5/10/15 — biên độ 0..20
     * không thể là VND. Để chúng trong `money` thì `money()` vẫn "chạy" nhưng thông điệp thành "lệch 5 đồng"
     * cho một tỉ lệ, và gate độ-phủ-cột-tiền đếm sai. Cột nào chưa biết đơn vị phải khai `unitUnknown`.
     */
    const check = (conv: ReturnType<typeof loadConventions>) => {
      for (const [entity, rates] of Object.entries(conv.rates?.entities || {})) {
        const money = (conv.money?.entities || {})[entity] || [];
        for (const r of rates) expect(money, `"${r}" vừa là tiền vừa là tỉ lệ — phải chọn một`).not.toContain(r);
      }
      const allRates = Object.values(conv.rates?.entities || {}).flat();
      for (const u of conv.rates?.unitUnknown || []) {
        expect(allRates, `"${u}" khai unitUnknown thì phải nằm trong rates`).toContain(u);
      }
    };
    // Fixture CÓ khai tỉ lệ ⇒ chứng minh luật tách thật sự có răng.
    const fx = convFixture();
    expect(Object.values(fx.rates?.entities || {}).flat().length).toBeGreaterThan(0);
    check(fx);
    // File thật được phép chưa khai cột nào; khai rồi thì phải theo đúng luật trên.
    check(loadConventions(REPO));
  });

  test('mỗi cột TỈ LỆ cũng phải được QUYẾT (neo / treo / không-hiển-thị)', () => {
    for (const conv of [convFixture(), loadConventions(REPO)]) {
      const fm = conv.fieldMap!;
      const anchored = new Set(Object.values(fm.byScreen).flatMap((c) => Object.keys(c)).filter((k) => !k.startsWith('_')));
      const decided = new Set([...Object.keys(fm.unanchored || {}), ...Object.keys(fm.notDisplayed || {})].map((k) => k.split('@')[0]));
      for (const col of Object.values(conv.rates?.entities || {}).flat()) {
        expect(anchored.has(col) || decided.has(col), `cột tỉ lệ "${col}" chưa được quyết`).toBe(true);
      }
    }
  });

  test('notDisplayed phải rời khỏi unanchored (không đếm hai lần thành việc-phải-làm)', () => {
    for (const fm of [convFixture().fieldMap!, fieldMap()]) {
    for (const col of Object.keys(fm.notDisplayed || {})) {
      if (col.startsWith('_')) continue;
      expect(fm.unanchored[col], `"${col}" vừa notDisplayed vừa unanchored`).toBeUndefined();
      expect(String((fm.notDisplayed || {})[col]).length, `"${col}" phải nói rõ vì sao không hiển thị`).toBeGreaterThan(25);
    } }
  });

  test('valueMaps phải khai ĐỘ PHỦ enum (đủ hay thiếu, thiếu cái nào)', () => {
    /*
     * Bẫy đã dính: neo enum từ 50 hàng đầu rồi tưởng xong. Cột đó có 9 enum mà 50 hàng chỉ thấy 6 —
     * bản đồ THIẾU mà trông như đủ. Nên bắt buộc khai `_coverage` nói rõ đủ hay thiếu.
     */
    const needsCoverage = (maps: Record<string, unknown>) => {
      const keys = Object.keys(maps).filter((k) => !k.startsWith('_'));
      if (!keys.length) return;                // chưa neo enum nào thì chưa có gì để khai độ phủ
      expect(String(maps._coverage || ''), 'thiếu `_coverage`: không ai biết bản đồ enum đã đủ chưa').toMatch(/DAY DU|ĐẦY ĐỦ|đủ/);
      expect(String(maps._coverage).length).toBeGreaterThan(80);
    };
    const fxMaps = (convFixture().fieldMap!.valueMaps || {}) as Record<string, unknown>;
    expect(Object.keys(fxMaps).filter((k) => !k.startsWith('_')).length).toBeGreaterThan(0);
    needsCoverage(fxMaps);
    needsCoverage((fieldMap().valueMaps || {}) as Record<string, unknown>);
  });

  test('lý do treo phải là SỐ ĐO, không phải phỏng đoán (nêu bao nhiêu đơn / màn nào)', () => {
    /*
     * Vòng 5 đổi cả 3 lý do treo từ "không hiển thị" (nghe như phỏng đoán) sang số đo cụ thể: bao nhiêu đơn,
     * màn/tab nào, ứng viên nào đã bị bác bỏ. Luật này giữ chuẩn đó — lý do treo mà không có số thì lần sau
     * không ai biết đã đo tới đâu, và sẽ đo lại từ đầu.
     */
    const un = { ...convFixture().fieldMap!.unanchored, ...fieldMap().unanchored };
    for (const [col, why] of Object.entries(un)) {
      const w = String(why);
      /*
       * `\d` chứ không phải `d`. Bản trước viết `/d/` nên nó kiểm "có chữ cái d" chứ không phải "có chữ số"
       * — mọi lý do treo bằng tiếng Việt có chữ `d` đều lọt, kể cả khi không nêu số nào. Luật vẫn xanh suốt
       * vì văn bản cũ tình cờ có chữ d. Đây đúng loại lỗi mà luật này sinh ra để chặn, nằm ngay trong luật.
       */
      expect(/\d/.test(w), `"${col}": lý do treo không có con số nào (bao nhiêu đơn? bao nhiêu bản ghi?)`).toBe(true);
      expect(/DO |ĐO |Quet|Quét|quet|man |màn |tab /.test(w), `"${col}": lý do treo phải nói ĐO ở đâu`).toBe(true);
    }
  });

  /*
   * Bản trước còn đòi thêm "và PHẢI có máy chạy nó", trỏ vào `fieldmap.anchor.spec.ts`. File đó đã bị xoá:
   * nó viết cho Postgres và khoá cứng vào bảng của một dự án khác, nên trên DB hiện tại nó chỉ SKIP.
   * Bỏ vế đó đi chứ KHÔNG đổi nó thành một file khác cho xanh — khẳng định "có máy chạy" trong khi máy
   * không chạy được chính là thứ luật này sinh ra để chặn. Dựng lại máy neo thì thêm vế đó trở lại.
   */
  test('phương pháp so-hai-nhóm phải được khai rõ ràng', () => {
    const fm = fieldMap() as unknown as { _method_enum_by_groups?: string };
    const m = String(fm._method_enum_by_groups || '');
    expect(m.length, 'conventions chưa khai phương pháp neo cột enum').toBeGreaterThan(80);
    expect(m, 'phải ghi ràng buộc ≥3 bản ghi của đối tượng khác nhau — đây là chỗ đã tạo 4 kết quả giả')
      .toMatch(/3 (don|đơn|ban ghi|bản ghi)/);
  });

  test('mỗi cột unanchored phải nói RÕ vì sao (để biết cần fixture gì)', () => {
    for (const [col, why] of Object.entries({ ...convFixture().fieldMap!.unanchored, ...fieldMap().unanchored })) {
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
    // Fixture CÓ bản đồ giá trị ⇒ luật đơn ánh được chứng minh là có răng, kể cả khi file thật đang rỗng.
    const maps = { ...(convFixture().fieldMap!.valueMaps || {}), ...(fieldMap().valueMaps || {}) };
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
    const maps = { ...(convFixture().fieldMap!.valueMaps || {}), ...(fieldMap().valueMaps || {}) };
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
    const fm = convFixture().fieldMap!;
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
    const fm = convFixture().fieldMap!;
    // `thanh_tien` neo ở màn DANH_SACH nhưng KHÔNG neo ở màn CHI_TIET — hai màn không được lẫn vào nhau.
    expect(fm.byScreen.DANH_SACH, 'fixture thiếu màn danh sách').toBeTruthy();
    expect(fm.byScreen.DANH_SACH.thanh_tien).toBe('Thành tiền');
    expect(fm.byScreen.CHI_TIET.thanh_tien, 'màn chi tiết chưa neo thanh_tien — không được lẫn với màn danh sách').toBeUndefined();
    for (const [screen, cols] of Object.entries(fm.byScreen)) {
      expect(cols._route, `màn "${screen}" phải khai _route để biết đo ở đâu`).toBeTruthy();
    }
  });

  test('uiLabelOfColumn: neo thì trả nhãn, CHƯA neo hoặc SAI MÀN thì NÉM', async () => {
    const { uiLabelOfColumn } = await import('../../support/setup/db/config');
    const conv = convFixture();
    expect(uiLabelOfColumn(conv, 'DANH_SACH', 'thanh_tien')).toBe('Thành tiền');
    expect(uiLabelOfColumn(conv, 'CHI_TIET', 'gia_goc')).toBe('Giá gốc');
    // Cột đang treo ⇒ ném, và phải NÓI RA lý do treo để biết cần fixture gì.
    expect(() => uiLabelOfColumn(conv, 'CHI_TIET', 'gia_tuy_chon')).toThrow(/CHƯA NEO/);
    expect(() => uiLabelOfColumn(conv, 'CHI_TIET', 'gia_tuy_chon')).toThrow(/Lý do đang treo/);
    /*
     * Neo ở màn khác ⇒ vẫn ném, và phải chỉ ra neo ở màn nào. Đây là ca đắt nhất từng gặp: một cột neo ở
     * form sửa dưới nhãn "Tiền đã trả", trong khi màn chi tiết cũng CÓ nhãn chữ giống hệt nhưng khác nghĩa.
     * Im lặng trả nhãn của màn kia là so sai cột mà vẫn ra kết luận.
     */
    expect(() => uiLabelOfColumn(conv, 'CHI_TIET', 'tien_coc')).toThrow(/chỉ neo ở: SUA/);
    expect(() => uiLabelOfColumn(conv, 'CHI_TIET', 'thanh_tien')).toThrow(/chỉ neo ở: DANH_SACH/);
    expect(() => uiLabelOfColumn(conv, 'MAN_LA', 'gia_goc')).toThrow(/chưa có trong fieldMap/);
  });

  test('uiLabelOfValue: enum đã đo thì trả nhãn, enum lạ thì NÉM (không dịch tay)', async () => {
    const { uiLabelOfValue } = await import('../../support/setup/db/config');
    const conv = convFixture();
    expect(uiLabelOfValue(conv, 'don_hang.trang_thai', 'CHO_DUYET')).toBe('Chờ duyệt');
    expect(uiLabelOfValue(conv, 'don_hang.trang_thai', 'DA_DUYET')).toBe('Đã duyệt');
    expect(() => uiLabelOfValue(conv, 'don_hang.trang_thai', 'DA_HUY')).toThrow(/chưa neo nhãn UI/);
    expect(() => uiLabelOfValue(conv, 'don_hang.tinh_thanh', 'HN')).toThrow(/chưa có bản đồ giá trị/);
  });

  test('nhãn đã neo phải là chuỗi thật, không phải số', () => {
    for (const [screen, cols] of Object.entries(convFixture().fieldMap!.byScreen)) {
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

/*
 * @infra — LINT CỦA `uatDbClient.assertReadOnlySql`.
 *
 * VÌ SAO KHỐI NÀY TỒN TẠI (thêm 24/09/2026). Bản Postgres có HAI chốt: `BEGIN TRANSACTION READ ONLY` ở
 * phía server, và lint ở phía client. Chuyển sang SQL Server thì chốt phía server BIẾN MẤT — T-SQL không
 * có transaction read-only. Cộng thêm quyết định giữ account `dbo` (`requireReadonlyUser=false`), lint này
 * trở thành **lớp chặn ghi DUY NHẤT trong tiến trình**. Trước đó nó không có một test nào.
 *
 * Một guard không có test thì không phải guard, chỉ là ý định.
 */
test.describe('@infra assertReadOnlySql — lớp chặn ghi DUY NHẤT sau khi bỏ Postgres', () => {
  test('câu đọc hợp lệ đi qua', () => {
    for (const ok of [
      'SELECT 1',
      'SELECT TOP (10) [TEN] FROM [TRUONG] WHERE [MA] = @p1',
      "WITH x AS (SELECT 1 AS a) SELECT a FROM x",
      'SELECT 1;',
    ]) {
      expect(() => assertReadOnlySql(ok), ok).not.toThrow();
    }
  });

  test('mọi từ khoá GHI/DDL bị chặn', () => {
    for (const bad of [
      "UPDATE TRUONG SET TEN = 'x'",
      "DELETE FROM TRUONG",
      "INSERT INTO TRUONG (TEN) VALUES ('x')",
      'TRUNCATE TABLE TRUONG',
      'DROP TABLE TRUONG',
      'ALTER TABLE TRUONG ADD c INT',
      'CREATE TABLE t (a INT)',
      'MERGE INTO t USING s ON 1=1 WHEN MATCHED THEN UPDATE SET a = 1',
      'GRANT SELECT ON t TO x',
    ]) {
      expect(() => assertReadOnlySql(bad), bad).toThrow();
    }
  });

  test('câu ghi GIẤU SAU một SELECT hợp lệ vẫn bị chặn', () => {
    /* Đường kinh điển: mở đầu bằng SELECT cho qua readStart, rồi nối câu ghi. */
    for (const bad of [
      "SELECT 1; DELETE FROM TRUONG",
      "SELECT 1; UPDATE TRUONG SET TEN = 'x';",
      "SELECT 1 /* vô hại */ ; DROP TABLE TRUONG",
    ]) {
      expect(() => assertReadOnlySql(bad), bad).toThrow();
    }
  });

  test('`SELECT … INTO <bảng>` bị chặn (tạo bảng thật mà vẫn bắt đầu bằng SELECT)', () => {
    for (const bad of [
      'SELECT * INTO [dbo].[bang_moi] FROM TRUONG',
      'SELECT * INTO #tmp FROM TRUONG',
      'SELECT * INTO bang_moi FROM TRUONG',
    ]) {
      expect(() => assertReadOnlySql(bad), bad).toThrow();
    }
  });

  test('thủ tục hệ thống / đọc-ghi file / quản trị của SQL Server bị chặn', () => {
    for (const bad of [
      "SELECT * FROM OPENROWSET(BULK 'C:/x.txt', SINGLE_CLOB) AS a",
      "SELECT * FROM OPENDATASOURCE('SQLOLEDB', 'x')",
      'SELECT 1 FROM t WHERE xp_cmdshell IS NULL',
      'SELECT 1 FROM t WHERE sp_who IS NULL',
      'SELECT 1 WAITFOR DELAY \'00:00:10\'',
      'SELECT 1 DBCC CHECKDB',
      "SELECT 1 BACKUP DATABASE x TO DISK = 'y'",
    ]) {
      expect(() => assertReadOnlySql(bad), bad).toThrow();
    }
  });

  /*
   * Comment bị GỠ trước khi soi — và đó là hành vi ĐÚNG, không phải lỗ hổng:
   *  - từ khoá nằm TRONG comment thì không được thực thi ⇒ chặn nó là báo oan;
   *  - từ khoá nằm SAU comment (nhất là sau `--` xuống dòng) thì CÓ thực thi ⇒ phải chặn.
   * Khoá cả hai chiều để không ai "siết" lint thành hay báo oan, cũng không ai nới thành lọt.
   */
  test('comment: không báo oan, nhưng cũng không cho giấu câu thật sau comment', () => {
    // từ khoá chỉ nằm trong comment ⇒ KHÔNG chặn
    expect(() => assertReadOnlySql('SELECT 1 /* DELETE */ FROM t')).not.toThrow();
    expect(() => assertReadOnlySql('SELECT 1 FROM t -- nhớ DROP bảng tạm sau')).not.toThrow();
    // câu thật nằm sau comment ⇒ CHẶN
    expect(() => assertReadOnlySql('SELECT 1 -- vô hại\nDELETE FROM t')).toThrow();
    expect(() => assertReadOnlySql('SELECT 1 /* vô hại */ DROP TABLE t')).toThrow();
  });

  test('câu rỗng / không bắt đầu bằng câu đọc ⇒ chặn', () => {
    expect(() => assertReadOnlySql('')).toThrow(/rỗng/);
    expect(() => assertReadOnlySql('   ')).toThrow(/rỗng/);
    expect(() => assertReadOnlySql('EXEC sp_help')).toThrow();
  });
});
