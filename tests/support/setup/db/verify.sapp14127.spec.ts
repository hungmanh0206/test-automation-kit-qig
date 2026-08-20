import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { isUatDbConfigured, queryUatReadonly } from './uatPgClient';

/**
 * VERIFY SAPP-14127 — Đồng bộ lại data bảng user_hubspot_classes (DRY-RUN, READ-ONLY).
 *
 * Chỉ ĐÁNH DẤU hành động cần làm (thêm/xóa), KHÔNG thực thi ghi. HubSpot & DB đều read-only.
 * Xuất 1 file báo cáo markdown (KHÔNG chứa email/SĐT — tuân thủ org rule #1).
 *
 * Driver: DB-driven (từ user_hubspot_deals → đọc ngược HubSpot đối chiếu) — đúng phạm vi
 * "HV có hubspot ID → deal WON của họ".
 *
 * Chạy: $env:TASK_ENV='profiles/SAPP-14127/task.env'; npx playwright test tests/support/setup/db/verify.sapp14127.spec.ts
 * Mẫu:  thêm  $env:VERIFY_DEAL_LIMIT='300'  để chạy thử N deal gần nhất trước khi quét toàn bộ.
 */

const DELETE_GROUP = new Set(['NORMAL', 'REASSIGNED', 'RETAKING', 'MOVED_IN', 'BE_TRANSFERED']);
const SENTINELS = new Set(['', 'không', 'không tặng kèm', 'n/a', 'na', '-', 'none', 'null']);

const HS = axios.create({
  baseURL: process.env.HUBSPOT_BASE_URL,
  headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` },
  timeout: 30_000,
});

const droppedTokens = new Set<string>();
function normCodes(raw?: string | null): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of String(raw).split(';')) {
    const t = part.trim();
    if (!t) continue;
    if (/\s/.test(t) || SENTINELS.has(t.toLowerCase())) {
      droppedTokens.add(t);
      continue;
    }
    out.push(t);
  }
  return out;
}

async function fetchDealsWon(dealIds: string[], wonStageIds: Set<string>) {
  // map hubspot_deal_id -> { codes:Set, stageId, found } cho deal ĐẠT stage WON hoàn thiện hồ sơ (non-test)
  const byId = new Map<string, { codes: Set<string>; won: boolean }>();
  let notFound = 0;
  const CH = 100;
  for (let i = 0; i < dealIds.length; i += CH) {
    const chunk = dealIds.slice(i, i + CH);
    const { data } = await HS.post('/crm/v3/objects/deals/batch/read', {
      properties: ['dealstage', 'lop_dang_ky_cloned_', 'lop_dang_ky_tang_kem'],
      inputs: chunk.map((id) => ({ id })),
    });
    const found = new Set<string>();
    for (const r of data.results || []) {
      found.add(r.id);
      const p = r.properties || {};
      const won = wonStageIds.has(String(p.dealstage));
      const codes = won
        ? new Set([...normCodes(p.lop_dang_ky_cloned_), ...normCodes(p.lop_dang_ky_tang_kem)])
        : new Set<string>();
      byId.set(r.id, { codes, won });
    }
    for (const id of chunk) if (!found.has(id)) notFound++;
    if ((i / CH) % 10 === 0) console.log(`  HubSpot batch ${i + chunk.length}/${dealIds.length}`); // eslint-disable-line no-console
  }
  return { byId, notFound };
}

test('verify SAPP-14127 (dry-run, read-only) → xuất báo cáo', async () => {
  const DB_PREFIX = process.env.VERIFY_DB_PREFIX || 'LIB_MASTER_DB';
  const DB = { dbPrefix: DB_PREFIX };
  test.skip(!isUatDbConfigured(DB_PREFIX), `Chưa cấu hình ${DB_PREFIX}_*.`);
  test.setTimeout(600_000);
  const LIMIT = parseInt(process.env.VERIFY_DEAL_LIMIT || '0', 10);

  // ---- 0) HubSpot pipelines → stage-id "Hoàn thiện hồ sơ học viên" (non-test) ----
  const { data: pipeData } = await HS.get('/crm/v3/pipelines/deals');
  const wonStageIds = new Set<string>();
  for (const p of pipeData.results || []) {
    if (/test/i.test(p.label)) continue;
    for (const s of p.stages || []) if (/hoàn thiện hồ sơ học viên/i.test(s.label)) wonStageIds.add(String(s.id));
  }
  console.log(`WON stage ids (non-test): ${wonStageIds.size}`); // eslint-disable-line no-console

  // ---- 1) DB reads (read-only) ----
  const deals = await queryUatReadonly<{ deal_uuid: string; user_id: string; hubspot_deal_id: string }>(
    `SELECT id::text AS deal_uuid, user_id::text AS user_id, hubspot_deal_id
       FROM user_hubspot_deals
      WHERE hubspot_deal_id IS NOT NULL
      ORDER BY deal_created_at DESC NULLS LAST` + (LIMIT > 0 ? ` LIMIT ${LIMIT}` : ''),
    [], DB,
  );
  const uhc = await queryUatReadonly<{ deal_uuid: string; class_code: string | null; is_deleted: boolean }>(
    `SELECT user_hubspot_deal_id::text AS deal_uuid, class_code, (deleted_at IS NOT NULL) AS is_deleted
       FROM user_hubspot_classes WHERE user_hubspot_deal_id IS NOT NULL`,
    [], DB,
  );
  const cui = await queryUatReadonly<{
    user_id: string; class_id: string; type: string; source_type: string | null; completed: number; is_deleted: boolean;
  }>(
    `SELECT user_id::text AS user_id, class_id::text AS class_id, upper(type) AS type, source_type,
            CASE WHEN (learning_progress->>'total_course_sections_completed') ~ '^[0-9]+$'
                 THEN (learning_progress->>'total_course_sections_completed')::int ELSE 0 END AS completed,
            (deleted_at IS NOT NULL) AS is_deleted
       FROM class_user_instances`,
    [], DB,
  );
  const classes = await queryUatReadonly<{ id: string; class_code: string }>(
    `SELECT id::text AS id, code AS class_code FROM classes WHERE code IS NOT NULL`,
    [], DB,
  );

  // ---- 2) Index DB ----
  const codeById = new Map<string, string>();
  const idByCode = new Map<string, string>();
  const opsCodes = new Set<string>();
  for (const c of classes) {
    codeById.set(c.id, c.class_code);
    if (!idByCode.has(c.class_code)) idByCode.set(c.class_code, c.id);
    opsCodes.add(c.class_code);
  }
  const uhcActiveByDeal = new Map<string, Set<string>>(); // deal_uuid -> active class_codes
  for (const r of uhc) {
    if (r.is_deleted || !r.class_code) continue;
    if (!uhcActiveByDeal.has(r.deal_uuid)) uhcActiveByDeal.set(r.deal_uuid, new Set());
    uhcActiveByDeal.get(r.deal_uuid)!.add(r.class_code);
  }
  // membership active theo user -> Set(class_id); và cui SYNC_DEAL_WON active theo user
  const memberActive = new Map<string, Set<string>>(); // user_id -> Set(class_id) (mọi nguồn, active)
  const syncRowsByUser = new Map<string, { class_id: string; type: string; completed: number }[]>();
  for (const r of cui) {
    if (r.is_deleted) continue;
    if (!memberActive.has(r.user_id)) memberActive.set(r.user_id, new Set());
    memberActive.get(r.user_id)!.add(r.class_id);
    if (r.source_type === 'SYNC_DEAL_WON') {
      if (!syncRowsByUser.has(r.user_id)) syncRowsByUser.set(r.user_id, []);
      syncRowsByUser.get(r.user_id)!.push({ class_id: r.class_id, type: r.type, completed: r.completed });
    }
  }

  // ---- 3) HubSpot deal codes ----
  const dealIds = deals.map((d) => d.hubspot_deal_id);
  const { byId: hsDeals, notFound } = await fetchDealsWon(dealIds, wonStageIds);

  // per-user union of WON deal codes
  const userDealCodes = new Map<string, Set<string>>();
  let wonQualified = 0;
  for (const d of deals) {
    const hs = hsDeals.get(d.hubspot_deal_id);
    if (!hs || !hs.won) continue;
    wonQualified++;
    if (!userDealCodes.has(d.user_id)) userDealCodes.set(d.user_id, new Set());
    const set = userDealCodes.get(d.user_id)!;
    for (const c of hs.codes) set.add(c);
  }

  // ---- 4) Reconcile ----
  // Part 1: mã lớp trên deal nhưng chưa có (active) trong user_hubspot_classes của deal đó → THÊM
  const addClassCode: { user_id: string; hubspot_deal_id: string; class_code: string }[] = [];
  for (const d of deals) {
    const hs = hsDeals.get(d.hubspot_deal_id);
    if (!hs || !hs.won) continue;
    const present = uhcActiveByDeal.get(d.deal_uuid) ?? new Set<string>();
    for (const code of hs.codes) if (!present.has(code)) addClassCode.push({ user_id: d.user_id, hubspot_deal_id: d.hubspot_deal_id, class_code: code });
  }

  // Part 2a: HV trong lớp (SYNC_DEAL_WON) nhưng lớp KHÔNG có trên deal → XÓA nếu progress=0 & type∈DELETE_GROUP
  // CHỈ xét user thuộc phạm vi deal đã xử lý (có ≥1 dòng user_hubspot_deals). User ngoài phạm vi
  // (có SYNC_DEAL_WON nhưng KHÔNG có deal đã sync) → KHÔNG tự gắn xóa, tách riêng để QA review.
  const scopeUsers = new Set(deals.map((d) => d.user_id));
  let syncUsersOutOfScope = 0;
  const kindOf = (code: string) =>
    /^F-/.test(code) ? 'F- (OPS variant)' : /^R-/.test(code) ? 'R- (OPS variant)' : /\//.test(code) ? 'other' : 'plain';
  const removeStudent: { user_id: string; class_code: string; class_id: string; type: string; completed: number; kind: string }[] = [];
  const keptNotOnDeal: { user_id: string; class_code: string; class_id: string; reason: string }[] = [];
  for (const [userId, rows] of syncRowsByUser) {
    if (!scopeUsers.has(userId)) { syncUsersOutOfScope++; continue; }
    const dealCodes = userDealCodes.get(userId) ?? new Set<string>();
    for (const r of rows) {
      const code = codeById.get(r.class_id) ?? '(class_id không thấy trong classes)';
      if (dealCodes.has(code)) continue; // vẫn có trên deal -> giữ
      if (r.completed === 0 && DELETE_GROUP.has(r.type)) {
        removeStudent.push({ user_id: userId, class_code: code, class_id: r.class_id, type: r.type, completed: r.completed, kind: kindOf(code) });
      } else {
        keptNotOnDeal.push({ user_id: userId, class_code: code, class_id: r.class_id, reason: r.completed !== 0 ? 'progress≠0' : `type=${r.type}` });
      }
    }
  }
  const removePlain = removeStudent.filter((r) => r.kind === 'plain');
  const removeVariant = removeStudent.filter((r) => r.kind !== 'plain');

  // Part 2b: mã lớp trên deal, đã có trong user_hubspot_classes, tồn tại trên OPS, mà HV CHƯA ở lớp → THÊM HV vào lớp
  const addStudent: { user_id: string; class_code: string; class_id: string }[] = [];
  const uhcActiveByUser = new Map<string, Set<string>>();
  for (const d of deals) {
    const present = uhcActiveByDeal.get(d.deal_uuid);
    if (!present) continue;
    if (!uhcActiveByUser.has(d.user_id)) uhcActiveByUser.set(d.user_id, new Set());
    for (const c of present) uhcActiveByUser.get(d.user_id)!.add(c);
  }
  for (const [userId, dealCodes] of userDealCodes) {
    const inUhc = uhcActiveByUser.get(userId) ?? new Set<string>();
    const member = memberActive.get(userId) ?? new Set<string>();
    for (const code of dealCodes) {
      if (!inUhc.has(code)) continue; // "đã được thêm vào user_hubspot_classes"
      if (!opsCodes.has(code)) continue; // "mã lớp đã có trên ops"
      const classId = idByCode.get(code)!;
      if (!member.has(classId)) addStudent.push({ user_id: userId, class_code: code, class_id: classId });
    }
  }

  // ---- 5) Report ----
  const now = new Date().toISOString();
  const mdTable = (rows: string[][], head: string[]) =>
    rows.length ? [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n') : '_(không có)_';

  const report = `# Báo cáo verify SAPP-14127 — Đồng bộ lại \`user_hubspot_classes\` (DRY-RUN)

- Thời điểm: ${now}
- Chế độ: **READ-ONLY / DRY-RUN** — chỉ ĐÁNH DẤU hành động, KHÔNG thực thi thêm/sửa/xóa.
- Nguồn: HubSpot portal ${process.env.HUBSPOT_PORTAL_ID} (read-only) + DB OPS \`${process.env[`${DB_PREFIX}_NAME`]}\` (prefix ${DB_PREFIX}, read-only).
- Bảo mật: báo cáo KHÔNG chứa Email/SĐT khách hàng (chỉ user_id/uuid, deal id, mã lớp).
- Phạm vi deal xử lý: ${deals.length}${LIMIT > 0 ? ` (giới hạn mẫu VERIFY_DEAL_LIMIT=${LIMIT})` : ' (toàn bộ user_hubspot_deals)'}

## Tổng quan
| Chỉ số | Số lượng |
| --- | --- |
| Deal DB xử lý | ${deals.length} |
| Deal đạt WON "Hoàn thiện hồ sơ học viên" (non-test) | ${wonQualified} |
| Deal không tìm thấy trên HubSpot | ${notFound} |
| **[Part 1] Mã lớp cần THÊM vào user_hubspot_classes** | **${addClassCode.length}** |
| **[Part 2a] HV cần XÓA (soft-delete) khỏi lớp — TỔNG** | **${removeStudent.length}** |
| &nbsp;&nbsp;• trong đó mã **plain** (cùng namespace deal — tin cậy cao) | ${removePlain.length} |
| &nbsp;&nbsp;• trong đó mã **F-/R-/khác** (OPS variant — CẦN xác nhận rule mapping) | ${removeVariant.length} |
| [Part 2a] Không xóa dù không còn trên deal (progress≠0 / type giữ) | ${keptNotOnDeal.length} |
| [Part 2a] User có SYNC_DEAL_WON nhưng KHÔNG có deal đã sync (tách QA review, không tự xóa) | ${syncUsersOutOfScope} |
| **[Part 2b] HV cần THÊM vào lớp** | **${addStudent.length}** |

> ⚠️ **Cảnh báo Part 2a (xóa):** so mã lớp \`class_user_instances→classes.code\` với mã trên deal bằng **so chuỗi trực tiếp**.
> Nhóm mã **F-/R-/khác** là lớp nội bộ OPS (foundation/retake) gần như không xuất hiện literal trên deal → dễ bị gắn xóa NHẦM
> nếu 1 mã đăng ký deal thực chất ánh xạ ra nhiều lớp OPS. **Cần dev xác nhận quy tắc ánh xạ** mã đăng ký → mã lớp OPS trước khi tin nhóm này.
> Ngoài ra, nếu HV có deal WON trên HubSpot chưa được sync vào \`user_hubspot_deals\`, "không có trên deal" có thể sai — danh sách này giới hạn theo deal đã sync.

## [Part 1] Mã lớp cần THÊM vào \`user_hubspot_classes\` (${addClassCode.length})
${mdTable(addClassCode.map((r) => [r.user_id, r.hubspot_deal_id, r.class_code]), ['user_id', 'hubspot_deal_id', 'class_code'])}

## [Part 2a-1] HV cần XÓA — mã PLAIN (cùng namespace deal, tin cậy cao) (${removePlain.length})
${mdTable(removePlain.map((r) => [r.user_id, r.class_code, r.class_id, r.type, String(r.completed)]), ['user_id', 'class_code', 'class_id', 'type', 'completed'])}

## [Part 2a-2] HV cần XÓA — mã OPS VARIANT F-/R-/khác (⚠️ cần rule mapping, chưa nên xóa) (${removeVariant.length})
${mdTable(removeVariant.map((r) => [r.user_id, r.class_code, r.class_id, r.type, r.kind]), ['user_id', 'class_code', 'class_id', 'type', 'kind'])}

## [Part 2b] HV cần THÊM vào lớp (${addStudent.length})
${mdTable(addStudent.map((r) => [r.user_id, r.class_code, r.class_id]), ['user_id', 'class_code', 'class_id'])}

## [Part 2a-KEEP] HV KHÔNG xóa dù không còn trên deal — phải GIỮ (${keptNotOnDeal.length})
${mdTable(keptNotOnDeal.map((r) => [r.user_id, r.class_code, r.class_id, r.reason]), ['user_id', 'class_code', 'class_id', 'reason'])}

## Phụ lục — token bị loại khi tách mã lớp (sentinel, không phải mã lớp)
${[...droppedTokens].map((t) => `- \`${t}\``).join('\n') || '_(không có)_'}
`;

  const dbTag = DB_PREFIX === 'LIB_MASTER_DB' ? '' : '_db2';
  const outDir = path.join('outputs', 'lms-operations-automation', process.env.TASK_KEY || 'SAPP-14127');
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, `verify-report${dbTag}${LIMIT > 0 ? `_sample${LIMIT}` : ''}.md`);
  fs.writeFileSync(reportPath, report, 'utf8');

  console.log(`\n==== KẾT QUẢ ====`); // eslint-disable-line no-console
  console.log(`deals=${deals.length} won=${wonQualified} notFound=${notFound}`); // eslint-disable-line no-console
  console.log(`Part1 addClassCode=${addClassCode.length} | Part2a remove=${removeStudent.length} (plain=${removePlain.length}, variant=${removeVariant.length}) | Part2b addStudent=${addStudent.length} | out-of-scope users=${syncUsersOutOfScope}`); // eslint-disable-line no-console
  console.log(`Báo cáo: ${reportPath}`); // eslint-disable-line no-console
});
