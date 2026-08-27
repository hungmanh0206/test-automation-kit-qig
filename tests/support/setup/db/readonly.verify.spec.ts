import { test, expect } from '@playwright/test';
import { queryUatReadonly, isUatDbConfigured } from './uatPgClient';
import { normalizePrivilege } from './types';
import { proveReadOnlyFromGrants, assertReadOnly } from './guard';
import type { GrantRow } from './types';

/*
 * NGHIỆM THU ROLE CHỈ-ĐỌC — máy chứng minh điều kiện tiên quyết của tầng kiểm dữ liệu DB.
 *
 * Vì sao là spec THƯỜNG TRÚ chứ không phải lệnh chạy tay một lần: quyền trên DB **đổi được sau lưng**
 * (DBA cấp thêm, role được thừa hưởng từ role cha, `GRANT ... TO PUBLIC` ở đâu đó). Một lần xác nhận hôm
 * nay không nói gì về tháng sau. Chạy lại spec này là cách duy nhất biết role còn sạch.
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

  test('role KHÔNG có quyền ghi trên bất kỳ bảng nào', async () => {
    const rows = await queryUatReadonly<{ table_name: string; privilege_type: string }>(
      `SELECT table_name, privilege_type
         FROM information_schema.role_table_grants
        WHERE grantee = current_user AND table_schema = 'public'`,
      [],
      { dbPrefix: PREFIX },
    );
    const grants: GrantRow[] = rows.map((r) => ({ table: r.table_name, privilege: normalizePrivilege(r.privilege_type) }));
    const proof = proveReadOnlyFromGrants(grants);

    console.log(`[ro-verify] ${grants.length} dòng quyền · read-only: ${proof.readonly ? 'ĐÚNG' : 'SAI'}`
      + (proof.readonly ? '' : ` · ${Object.entries(proof.writeGrants).map(([p, n]) => `${p}=${n}`).join(' ')}`));

    // `assertReadOnly` cũng chặn ca "0 dòng quyền" — đọc được 0 dòng là PHÉP ĐO HỎNG, không phải an toàn.
    expect(() => assertReadOnly(proof, { user: PREFIX })).not.toThrow();
    expect(proof.totalGrantRows, 'phải đọc được quyền SELECT thật, nếu 0 thì role chưa được GRANT gì').toBeGreaterThan(0);
  });

  test('quyền thừa hưởng từ role cha / PUBLIC cũng phải sạch', async () => {
    /*
     * `role_table_grants` với `grantee = current_user` KHÔNG thấy quyền đến qua role cha hoặc qua `PUBLIC`.
     * `has_table_privilege` thì tính CẢ đường thừa hưởng — đây mới là quyền THỰC THI được.
     * Bỏ bước này thì một role "trông sạch" vẫn có thể ghi được, và đó đúng là loại sai im lặng nguy hiểm nhất.
     */
    const rows = await queryUatReadonly<{ n: string }>(
      `SELECT count(*)::text AS n
         FROM information_schema.tables t
        WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
          AND (has_table_privilege(current_user, format('%I.%I', t.table_schema, t.table_name), 'INSERT')
            OR has_table_privilege(current_user, format('%I.%I', t.table_schema, t.table_name), 'UPDATE')
            OR has_table_privilege(current_user, format('%I.%I', t.table_schema, t.table_name), 'DELETE')
            OR has_table_privilege(current_user, format('%I.%I', t.table_schema, t.table_name), 'TRUNCATE'))`,
      [],
      { dbPrefix: PREFIX },
    );
    const writable = Number(rows[0]?.n ?? -1);
    console.log(`[ro-verify] bảng GHI ĐƯỢC (tính cả thừa hưởng): ${writable}`);
    expect(writable, 'còn bảng ghi được ⇒ role chưa thật sự chỉ đọc (kiểm GRANT tới PUBLIC hoặc role cha)').toBe(0);
  });

  test('đọc được dữ liệu — role sạch nhưng không đọc nổi thì cũng vô dụng', async () => {
    const rows = await queryUatReadonly<{ n: string }>(
      "SELECT count(*)::text AS n FROM information_schema.columns WHERE table_schema = 'public'",
      [],
      { dbPrefix: PREFIX },
    );
    expect(Number(rows[0]?.n ?? 0)).toBeGreaterThan(0);
  });
});
