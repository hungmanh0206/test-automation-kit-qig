import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { queryUatReadonly } from './uatPgClient';

/**
 * Nghiệm thu dry-run JSON của command đối chiếu DB cũ (postgres = before). Read-only, DB-only.
 * Với mỗi status, kiểm điều kiện DB-checkable có đúng như định nghĩa enum không.
 * (Điều kiện "không trên deal WON" cần HubSpot nên KHÔNG kiểm ở đây — chỉ kiểm phần DB.)
 */
const DIR = path.join('outputs', 'lms-operations-automation', process.env.TASK_KEY || 'SAPP-14127');
const F = path.join('profiles', 'SAPP-14127', 'result_dry_run_resync_user_hubspot_classes_success_1785294432610.json');
const BEFORE = { dbPrefix: 'LIB_MASTER_DB' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const qs = (s: string) => `'${String(s).replace(/'/g, "''")}'`;
// progress=0 trên alias cui
const PZERO = `(CASE WHEN (cui.learning_progress->>'total_course_sections_completed') ~ '^[0-9]+$' THEN (cui.learning_progress->>'total_course_sections_completed')::int ELSE 0 END) = 0`;
const PPOS = PZERO.replace('= 0', '> 0');

function dedupe(pairs: [string, string][]) {
  const m = new Map<string, [string, string]>();
  for (const [u, c] of pairs) if (UUID.test(u) && c) m.set(`${u}|${c}`, [u, c]);
  return [...m.values()];
}

async function validate(pairs: [string, string][], cond: string, sampleN = 0) {
  const use = sampleN && pairs.length > sampleN ? pairs.slice(0, sampleN) : pairs;
  if (!use.length) return { total: pairs.length, checked: 0, ok: 0, viol: [] as any[] };
  const vals = use.map(([u, c]) => `(${qs(u)}::uuid, ${qs(c)})`).join(',');
  const [r] = await queryUatReadonly<{ ok: string }>(
    `SELECT count(*) FILTER (WHERE ${cond})::text ok FROM (VALUES ${vals}) v(uid, code)`, [], BEFORE);
  const viol = await queryUatReadonly<{ uid: string; code: string }>(
    `SELECT v.uid::text uid, v.code code FROM (VALUES ${vals}) v(uid, code) WHERE NOT (${cond}) LIMIT 6`, [], BEFORE);
  return { total: pairs.length, checked: use.length, ok: +r.ok, viol };
}

test('validate dry-run vs DB cũ', async () => {
  test.setTimeout(300_000);
  const d = JSON.parse(fs.readFileSync(F, 'utf8'));
  const addNew: [string, string][] = [], addExisting: [string, string][] = [], notFound: [string, string][] = [], skipNon: [string, string][] = [];
  const toRemove: [string, string][] = [], keptProg: [string, string][] = [], keptType: [string, string][] = [];
  for (const u of d) {
    const uid = u.user_id;
    for (const dl of u.deals || []) {
      const c = dl.cases || {};
      for (const code of c.TO_BE_ADDED_NEW_CLASS_CODE || []) addNew.push([uid, code]);
      for (const code of c.TO_BE_ADDED_EXISTING_CLASS_CODE_NOT_ENROLLED || []) addExisting.push([uid, code]);
      for (const code of c.CLASS_NOT_FOUND_ON_OPS || []) notFound.push([uid, code]);
      for (const code of c.SKIPPED_NON_LESSON_CLASS || []) skipNon.push([uid, code]);
    }
    const sc = (u.stale_class_users || {}).cases || {};
    for (const code of sc.TO_BE_REMOVED || []) toRemove.push([uid, code]);
    for (const code of sc.KEPT_PROGRESS_NOT_ZERO || []) keptProg.push([uid, code]);
    for (const code of sc.KEPT_PROTECTED_TYPE || []) keptType.push([uid, code]);
  }

  // Điều kiện "valid" (đúng như enum) — dùng trong FILTER; tham chiếu v.uid (uuid), v.code (text).
  const SYNC_LESSON = `class_user_instances cui JOIN classes cl ON cl.id=cui.class_id WHERE cui.user_id=v.uid AND cl.code=v.code AND upper(cl.type)='LESSON' AND cui.source_type='SYNC_DEAL_WON' AND cui.deleted_at IS NULL`;
  const conds: Record<string, { pairs: [string, string][]; cond: string; sample?: number; note: string }> = {
    TO_BE_REMOVED: { pairs: dedupe(toRemove), note: 'LESSON+SYNC+active+type=NORMAL+progress=0', cond: `EXISTS(SELECT 1 FROM ${SYNC_LESSON} AND upper(cui.type)='NORMAL' AND ${PZERO})` },
    KEPT_PROGRESS_NOT_ZERO: { pairs: dedupe(keptProg), note: 'LESSON+SYNC+active+progress>0', cond: `EXISTS(SELECT 1 FROM ${SYNC_LESSON} AND ${PPOS})` },
    KEPT_PROTECTED_TYPE: { pairs: dedupe(keptType), note: 'LESSON+SYNC+active+progress=0+type<>NORMAL', cond: `EXISTS(SELECT 1 FROM ${SYNC_LESSON} AND ${PZERO} AND upper(cui.type)<>'NORMAL')` },
    SKIPPED_NON_LESSON_CLASS: { pairs: dedupe(skipNon), note: 'có class code nhưng type<>LESSON', cond: `EXISTS(SELECT 1 FROM classes cl WHERE cl.code=v.code AND upper(cl.type)<>'LESSON')` },
    CLASS_NOT_FOUND_ON_OPS: { pairs: dedupe(notFound), sample: 3000, note: 'KHÔNG có class code trên classes', cond: `NOT EXISTS(SELECT 1 FROM classes cl WHERE cl.code=v.code)` },
    TO_BE_ADDED_NEW_CLASS_CODE: { pairs: dedupe(addNew), note: 'có LESSON class + chưa có trong user_hubspot_classes của HV', cond: `EXISTS(SELECT 1 FROM classes cl WHERE cl.code=v.code AND upper(cl.type)='LESSON') AND NOT EXISTS(SELECT 1 FROM user_hubspot_classes uc JOIN user_hubspot_deals d ON d.id=uc.user_hubspot_deal_id WHERE d.user_id=v.uid AND uc.class_code=v.code AND uc.deleted_at IS NULL)` },
    TO_BE_ADDED_EXISTING_CLASS_CODE_NOT_ENROLLED: { pairs: dedupe(addExisting), note: 'đã có trong user_hubspot_classes + có LESSON class + HV chưa enroll', cond: `EXISTS(SELECT 1 FROM user_hubspot_classes uc JOIN user_hubspot_deals d ON d.id=uc.user_hubspot_deal_id WHERE d.user_id=v.uid AND uc.class_code=v.code AND uc.deleted_at IS NULL) AND EXISTS(SELECT 1 FROM classes cl WHERE cl.code=v.code AND upper(cl.type)='LESSON') AND NOT EXISTS(SELECT 1 FROM class_user_instances cui JOIN classes cl ON cl.id=cui.class_id WHERE cui.user_id=v.uid AND cl.code=v.code AND cui.deleted_at IS NULL)` },
  };

  let md = `# Nghiệm thu dry-run vs DB cũ (postgres) — SAPP-14127\n\n- ${new Date().toISOString()} · read-only · phần "không trên deal WON" không kiểm ở đây (cần HubSpot).\n\n| Status | Tổng | Đã kiểm | Khớp | Vi phạm |\n| --- | --- | --- | --- | --- |\n`;
  const L = (s: string) => console.log(s); // eslint-disable-line no-console
  for (const [name, cfg] of Object.entries(conds)) {
    const r = await validate(cfg.pairs, cfg.cond, cfg.sample);
    const viol = r.checked - r.ok;
    md += `| ${name} | ${r.total} | ${r.checked} | ${r.ok} | ${viol} |\n`;
    L(`${name.padEnd(42)} total=${r.total} checked=${r.checked} OK=${r.ok} VI_PHẠM=${viol}`);
    if (r.viol.length) { md += `\n<sub>${name} — ví dụ vi phạm (${cfg.note}):</sub>\n\n| user_id | class_code |\n| --- | --- |\n` + r.viol.map((x) => `| ${x.uid} | ${x.code} |`).join('\n') + '\n'; }
  }
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, 'validate-dryrun.md'), md, 'utf8');
  L(`File: ${path.join(DIR, 'validate-dryrun.md')}`);
});
