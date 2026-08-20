import { test, expect } from '@playwright/test';
import {
  isUatDbConfigured,
  queryUatReadonly,
  assertReadOnlySql,
  assertHostGuards,
  loadUatDbConfig,
  UatDbGuardError,
} from './uatPgClient';

/**
 * Check connect DB verify (guarded, READ-ONLY) — chạy khi đã điền LIB_MASTER_DB_* trong profile task.
 *
 * Mục đích: xác nhận creds đúng + trỏ đúng kho DB test riêng, VÀ guard vẫn giữ nghiêm
 * dù DB user có FULL quyền (ghi/DDL). Mọi truy cập đi qua tests/support/setup/db/uatPgClient.ts.
 *
 * Chạy riêng spec này (PowerShell):
 *   $env:TASK_ENV='profiles/SAPP-14127/task.env'; npx playwright test tests/support/setup/db/connection.check.spec.ts
 * Bash:
 *   TASK_ENV=profiles/SAPP-14127/task.env npx playwright test tests/support/setup/db/connection.check.spec.ts
 *
 * Thiếu creds ⇒ dormant (skip), không fail — an toàn khi chạy chung suite của task khác.
 */
test.describe('DB verify — check connect (read-only, guarded)', () => {
  test.skip(
    !isUatDbConfigured(),
    'Chưa cấu hình LIB_MASTER_DB_* (HOST/NAME/USERNAME/PASSWORD) trong profile → DB verify dormant.',
  );

  test('kết nối được + đọc được (SELECT 1)', async () => {
    const rows = await queryUatReadonly<{ ok: number }>('SELECT 1 AS ok');
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].ok)).toBe(1);
  });

  test('echo danh tính kết nối (xác nhận đúng DB/user + là PostgreSQL)', async () => {
    const rows = await queryUatReadonly<{ db: string; usr: string; ver: string }>(
      'SELECT current_database() AS db, current_user AS usr, version() AS ver',
    );
    const info = rows[0];
    // Log để bạn đối chiếu bằng mắt đang trỏ đúng kho DB test riêng. Không PII, không export file.
    // eslint-disable-next-line no-console
    console.log(`[db-check] database=${info.db} user=${info.usr}`);
    // eslint-disable-next-line no-console
    console.log(`[db-check] server=${info.ver}`);
    expect(info.db, 'current_database() rỗng?').toBeTruthy();
    expect(info.ver, 'Không phải PostgreSQL?').toContain('PostgreSQL');
  });

  test('guard chặn ghi dù user full quyền (lint từ chối câu không phải đọc)', () => {
    // Với DB full quyền, guard là lớp chặn DUY NHẤT — xác nhận nó từ chối câu ghi TRƯỚC khi mở kết nối.
    expect(() => assertReadOnlySql('UPDATE user_hubspot_classes SET progress = 0')).toThrow(
      UatDbGuardError,
    );
    expect(() => assertReadOnlySql('DELETE FROM user_hubspot_classes')).toThrow(UatDbGuardError);
    // Stacked query (đọc rồi lén ghi) cũng phải bị chặn.
    expect(() => assertReadOnlySql('SELECT 1; DROP TABLE user_hubspot_classes')).toThrow(
      UatDbGuardError,
    );
  });

  test('guard CHẶN kho UAT chung (db-uat.sapp.edu.vn) — chỉ localhost mới qua', () => {
    // Lấy đúng allowlist/deny từ profile task hiện tại (env đã nạp).
    const cfg = loadUatDbConfig();

    // Host hiện tại (localhost) phải hợp lệ.
    expect(() => assertHostGuards(cfg)).not.toThrow();

    // Giả lập config trỏ về kho UAT chung ở .env → phải bị chặn (allowlist + deny-pattern).
    const shared = { ...cfg, host: 'db-uat.sapp.edu.vn', database: 'sapp-platform-uat' };
    expect(() => assertHostGuards(shared)).toThrow(UatDbGuardError);
  });
});
