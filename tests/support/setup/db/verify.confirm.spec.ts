import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { isUatDbConfigured, queryUatReadonly } from './uatPgClient';

/** TẠM THỜI — đối chiếu report với TRẠNG THÁI DB HIỆN TẠI: các hành động đã thực hiện chưa. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function rowsOf(md: string, keyContains: string): string[][] {
  const lines = md.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith('## ') && l.includes(keyContains));
  if (start < 0) return [];
  const out: string[][] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('## ')) break;
    if (!l.startsWith('|')) continue;
    if (l.includes('---') || /\|\s*user_id\s*\|/.test(l)) continue;
    out.push(l.split('|').slice(1, -1).map((c) => c.trim()));
  }
  return out;
}

test('confirm trạng thái DB hiện tại vs report', async () => {
  test.skip(!isUatDbConfigured(), 'Chưa cấu hình LIB_MASTER_DB_*.');
  test.setTimeout(120_000);
  const reportPath = path.join('outputs', 'lms-operations-automation', process.env.TASK_KEY || 'SAPP-14127', 'verify-report.md');
  const md = fs.readFileSync(reportPath, 'utf8');

  const part1 = rowsOf(md, '[Part 1]'); // user_id | hubspot_deal_id | class_code
  const rem = [...rowsOf(md, '[Part 2a-1]'), ...rowsOf(md, '[Part 2a-2]')]; // user_id | class_code | class_id | ...
  const part2b = rowsOf(md, '[Part 2b]'); // user_id | class_code | class_id

  // ---- Part 1: các (deal, class_code) này đã CÓ (active) trong user_hubspot_classes chưa? (kỳ vọng 0) ----
  const p1vals = part1
    .filter((r) => r[1] && r[2])
    .map((r) => `('${r[1].replace(/'/g, "''")}', '${r[2].replace(/'/g, "''")}')`)
    .join(',');
  const [p1] = await queryUatReadonly<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM user_hubspot_classes c JOIN user_hubspot_deals d ON d.id = c.user_hubspot_deal_id
      WHERE c.deleted_at IS NULL AND (d.hubspot_deal_id, c.class_code) IN (${p1vals})`,
  );
  console.log(`[Part 1] flagged=${part1.length} | hiện đã có active trong DB=${p1.n}  (kỳ vọng 0 = CHƯA thêm)`); // eslint-disable-line no-console

  // ---- Part 2a: các (user_id, class_id) này hiện còn ACTIVE (chưa xóa) không? (kỳ vọng = tổng) ----
  const remPairs = rem.filter((r) => UUID.test(r[0]) && UUID.test(r[2]));
  const remVals = remPairs.map((r) => `('${r[0]}'::uuid, '${r[2]}'::uuid)`).join(',');
  const [p2a] = await queryUatReadonly<{ n: string }>(
    `SELECT count(*)::text AS n FROM class_user_instances
      WHERE deleted_at IS NULL AND (user_id, class_id) IN (${remVals})`,
  );
  console.log(`[Part 2a] flagged xóa=${remPairs.length} | hiện còn ACTIVE trong DB=${p2a.n}  (kỳ vọng = flagged = CHƯA xóa)`); // eslint-disable-line no-console

  // ---- Part 2b: các (user_id, class_id) này hiện đã là thành viên ACTIVE chưa? (kỳ vọng 0) ----
  const p2bPairs = part2b.filter((r) => UUID.test(r[0]) && UUID.test(r[2]));
  const p2bVals = p2bPairs.map((r) => `('${r[0]}'::uuid, '${r[2]}'::uuid)`).join(',');
  const [p2b] = await queryUatReadonly<{ n: string }>(
    `SELECT count(*)::text AS n FROM class_user_instances
      WHERE deleted_at IS NULL AND (user_id, class_id) IN (${p2bVals})`,
  );
  console.log(`[Part 2b] flagged thêm=${p2bPairs.length} | hiện đã là thành viên active=${p2b.n}  (kỳ vọng 0 = CHƯA thêm)`); // eslint-disable-line no-console

  // Chẩn đoán bất thường:
  const [dup] = await queryUatReadonly<{ n: string }>(
    `SELECT count(*)::text AS n FROM (
        SELECT hubspot_deal_id FROM user_hubspot_deals GROUP BY hubspot_deal_id HAVING count(*) > 1) t`,
  );
  console.log(`- hubspot_deal_id có >1 dòng user_hubspot_deals: ${dup.n}`); // eslint-disable-line no-console
  // Part 1 xét ở GRAIN user (mã có active ở BẤT KỲ deal nào của user): còn "đã có" mấy cái?
  const p1u = part1.filter((r) => UUID.test(r[0]) && r[2]).map((r) => `('${r[0]}'::uuid, '${r[2].replace(/'/g, "''")}')`).join(',');
  const [p1user] = await queryUatReadonly<{ n: string }>(
    `SELECT count(*)::text AS n FROM (VALUES ${p1u}) v(uid, code)
      WHERE EXISTS (SELECT 1 FROM user_hubspot_classes c JOIN user_hubspot_deals d ON d.id = c.user_hubspot_deal_id
                     WHERE c.deleted_at IS NULL AND d.user_id = v.uid AND c.class_code = v.code)`,
  );
  console.log(`- Part 1 xét theo GRAIN user: ${p1user.n}/${part1.length} mã thực ra đã có active ở deal khác của cùng HV`); // eslint-disable-line no-console
});
