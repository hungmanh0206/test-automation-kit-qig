import { test, expect } from '@playwright/test';
import { queryUatReadonly, isUatDbConfigured } from './uatDbClient';
import { normalizePrivilege } from './types';
import { proveReadOnlyFromGrants, assertReadOnly } from './guard';
import type { GrantRow } from './types';

/*
 * NGHIỆM THU ROLE CHỈ-ĐỌC — máy chứng minh điều kiện tiên quyết của tầng kiểm dữ liệu DB.
 *
 * Vì sao là spec THƯỜNG TRÚ chứ không phải lệnh chạy tay một lần: quyền trên DB **đổi được sau lưng**
 * (DBA cấp thêm, role được thừa hưởng từ role cha, thêm member vào `db_datawriter`). Một lần xác nhận hôm
 * nay không nói gì về tháng sau. Chạy lại spec này là cách duy nhất biết role còn sạch.
 *
 * ⚠️ HIỆN TRẠNG 24/09/2026 — SPEC NÀY ĐANG ĐỎ, VÀ ĐỎ LÀ ĐÚNG.
 * Login `csdl` trên DB nghiệp vụ UAT map sang `dbo`, thuộc `db_owner` + `db_datawriter` + `db_ddladmin`.
 * Chủ dự án đã quyết giữ account này (xem `safety.requireReadonlyUser=false` trong db.conventions.json).
 * KHÔNG được "chữa" spec cho xanh bằng cách nới assert — nhiệm vụ của nó là nói ra đúng sự thật đó cho tới
 * khi DBA cấp login chỉ SELECT. Khi có login sạch, spec tự xanh mà không phải sửa dòng nào.
 *
 * ĐÃ CHUYỂN SANG T-SQL (24/09/2026): bản trước dùng `information_schema.role_table_grants` và
 * `has_table_privilege()` của PostgreSQL. SQL Server không có cả hai. Quyền hiệu lực — KỂ CẢ đường thừa
 * hưởng qua role — chỉ đọc đúng bằng `fn_my_permissions()`, nên phép đo "thừa hưởng" nay đã gộp vào phép đo
 * chính thay vì phải làm hai lần như bản Postgres.
 *
 * KHÔNG chạy trong lane suite/nightly (nằm dưới `tests/support/**`, cần `INFRA_VERIFY=1`) và tự SKIP khi
 * chưa khai creds — nên nó không bao giờ làm đỏ CI của người không dùng DB.
 *
 * Chạy:
 *   INFRA_VERIFY=1 TASK_ENV=profiles/<TASK>/task.env TASK_KEY=<TASK> PROJECT_OUTPUT_DIR=<pod> \
 *     npx playwright test tests/support/setup/db/readonly.verify.spec.ts --project=infra-verify
 */
const PREFIX = 'LIB_MASTER_DB_RO';

test.describe('@infra-verify role chỉ-đọc', () => {
  test.skip(!isUatDbConfigured(PREFIX), `chưa khai ${PREFIX}_* trong task.env`);

  test('role KHÔNG có quyền ghi trên bất kỳ bảng nào (tính cả thừa hưởng qua role)', async () => {
    /*
     * `fn_my_permissions(<đối tượng>, 'OBJECT')` trả quyền HIỆU LỰC của principal hiện tại: đã tính cả
     * quyền đến từ role cha (`db_owner`, `db_datawriter`…) và cả `public`. Đây là điểm khác quan trọng so
     * với bản Postgres, nơi `role_table_grants` KHÔNG thấy đường thừa hưởng nên phải đo thêm một lần nữa.
     *
     * Cố ý KHÔNG lọc `permission_name IN (...)` trong SQL: lint `assertReadOnlySql` sẽ chặn câu vì thấy
     * chữ `INSERT`/`DELETE` trong literal. Lọc ở JS qua `normalizePrivilege` cho kết quả y hệt mà không
     * phải nới lint.
     */
    const rows = await queryUatReadonly<{ table_name: string; privilege_type: string }>(
      `SELECT s.name + '.' + t.name AS table_name, p.permission_name AS privilege_type
         FROM sys.tables t
         JOIN sys.schemas s ON s.schema_id = t.schema_id
         CROSS APPLY fn_my_permissions(QUOTENAME(s.name) + '.' + QUOTENAME(t.name), 'OBJECT') p`,
      [],
      { dbPrefix: PREFIX },
    );
    const grants: GrantRow[] = rows.map((r) => ({
      table: r.table_name,
      privilege: normalizePrivilege(r.privilege_type),
    }));
    const proof = proveReadOnlyFromGrants(grants);

    console.log(`[ro-verify] ${grants.length} dòng quyền · read-only: ${proof.readonly ? 'ĐÚNG' : 'SAI'}`
      + (proof.readonly ? '' : ` · ${Object.entries(proof.writeGrants).map(([p, n]) => `${p}=${n}`).join(' ')}`));

    // `assertReadOnly` cũng chặn ca "0 dòng quyền" — đọc được 0 dòng là PHÉP ĐO HỎNG, không phải an toàn.
    expect(() => assertReadOnly(proof, { user: PREFIX })).not.toThrow();
    expect(proof.totalGrantRows, 'phải đọc được quyền SELECT thật, nếu 0 thì role chưa được GRANT gì').toBeGreaterThan(0);
  });

  test('không thuộc role ghi nào ở mức database', async () => {
    /*
     * Lớp đo thứ hai, RẺ và dứt khoát: thành viên của `db_owner`/`db_datawriter`/`db_ddladmin` thì ghi được
     * bất kể quyền đối tượng khai thế nào. `IS_ROLEMEMBER` trả 1/0/NULL (NULL = tên role không hợp lệ).
     */
    const rows = await queryUatReadonly<Record<string, number | null>>(
      `SELECT IS_ROLEMEMBER('db_owner')      AS db_owner,
              IS_ROLEMEMBER('db_datawriter') AS db_datawriter,
              IS_ROLEMEMBER('db_ddladmin')   AS db_ddladmin,
              IS_ROLEMEMBER('db_datareader') AS db_datareader`,
      [],
      { dbPrefix: PREFIX },
    );
    const r = rows[0] || {};
    const writeRoles = ['db_owner', 'db_datawriter', 'db_ddladmin'].filter((k) => r[k] === 1);
    console.log(`[ro-verify] role ghi: ${writeRoles.join(', ') || 'không'} · db_datareader: ${r.db_datareader === 1 ? 'có' : 'không'}`);
    expect(writeRoles, `thuộc role ghi ⇒ chưa thật sự chỉ đọc: ${writeRoles.join(', ')}`).toHaveLength(0);
    expect(r.db_datareader, 'phải thuộc db_datareader để đọc được dữ liệu').toBe(1);
  });

  test('đọc được dữ liệu — role sạch nhưng không đọc nổi thì cũng vô dụng', async () => {
    const rows = await queryUatReadonly<{ n: number }>(
      'SELECT COUNT_BIG(*) AS n FROM INFORMATION_SCHEMA.COLUMNS',
      [],
      { dbPrefix: PREFIX },
    );
    expect(Number(rows[0]?.n ?? 0)).toBeGreaterThan(0);
  });
});
