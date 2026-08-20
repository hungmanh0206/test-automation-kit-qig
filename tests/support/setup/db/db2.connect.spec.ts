import { test, expect } from '@playwright/test';
import { isUatDbConfigured, queryUatReadonly } from './uatPgClient';

/**
 * Check connect DB2 (prefix LIB_MASTER_DB2_*) + snapshot nhanh before/after so với DB1.
 * Cả hai đều READ-ONLY, guarded (allowlist localhost kế thừa từ LIB_MASTER_DB_*).
 */
const DB2 = { dbPrefix: 'LIB_MASTER_DB2' };

async function snapshot(opts?: { dbPrefix?: string }) {
  const [id] = await queryUatReadonly<{ db: string }>('SELECT current_database() AS db', [], opts);
  const [uhc] = await queryUatReadonly<{ total: string; active: string }>(
    `SELECT count(*)::text total, count(*) FILTER (WHERE deleted_at IS NULL)::text active FROM user_hubspot_classes`,
    [], opts,
  );
  const [cui] = await queryUatReadonly<{ sync_active: string; sync_deleted: string }>(
    `SELECT count(*) FILTER (WHERE source_type='SYNC_DEAL_WON' AND deleted_at IS NULL)::text sync_active,
            count(*) FILTER (WHERE source_type='SYNC_DEAL_WON' AND deleted_at IS NOT NULL)::text sync_deleted
       FROM class_user_instances`,
    [], opts,
  );
  return { db: id.db, uhc, cui };
}

test('check connect DB2 + snapshot before/after', async () => {
  test.skip(!isUatDbConfigured() || !isUatDbConfigured('LIB_MASTER_DB2'), 'Thiếu cấu hình DB1 hoặc DB2.');
  test.setTimeout(120_000);

  const before = await snapshot();       // DB1
  const after = await snapshot(DB2);     // DB2

  // eslint-disable-next-line no-console
  console.log(`DB1 (before) = ${before.db} | DB2 (after) = ${after.db}`);
  // eslint-disable-next-line no-console
  console.log(`user_hubspot_classes  active: DB1=${before.uhc.active}  DB2=${after.uhc.active}  (Δ=${+after.uhc.active - +before.uhc.active})`);
  // eslint-disable-next-line no-console
  console.log(`class_user_instances SYNC_DEAL_WON active : DB1=${before.cui.sync_active}  DB2=${after.cui.sync_active}  (Δ=${+after.cui.sync_active - +before.cui.sync_active})`);
  // eslint-disable-next-line no-console
  console.log(`class_user_instances SYNC_DEAL_WON deleted: DB1=${before.cui.sync_deleted}  DB2=${after.cui.sync_deleted}  (Δ=${+after.cui.sync_deleted - +before.cui.sync_deleted})`);

  expect(after.db, 'DB2 phải là postgres-update').toBe('postgres-update');
  expect(after.db).not.toBe(before.db);
});
