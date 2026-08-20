import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { isUatDbConfigured, queryUatReadonly } from './uatPgClient';

/**
 * SAPP-14127 verify — DÙNG LẠI 1 slot DB (mặc định LIB_MASTER_DB).
 *   MODE=save  : tính flag "before" trên DB hiện tại (+HubSpot) + fingerprint → LƯU JSON (ngoài DB, bền qua restore).
 *   MODE=check : NẠP JSON, so fingerprint (cảnh báo nếu DB chưa đổi), đối chiếu flag → 4 câu + file MD.
 * Quy trình: chạy save trên DB "before" → restore DB "after" đè lên (cùng tên) → chạy check.
 * Read-only. EXISTS-based (miễn nhiễm nhân đôi dòng). Không xuất Email/SĐT.
 */
const MODE = process.env.MODE || 'save';
const DB = { dbPrefix: process.env.VERIFY_DB_PREFIX || 'LIB_MASTER_DB' };
const DIR = path.join('outputs', 'lms-operations-automation', process.env.TASK_KEY || 'SAPP-14127');
const FLAGS_PATH = path.join(DIR, 'before-flags.json');
const FP_TABLES = ['users', 'user_hubspot_deals', 'user_hubspot_classes', 'classes', 'class_user_instances'];
const DELETE_GROUP = new Set(['NORMAL', 'REASSIGNED', 'RETAKING', 'MOVED_IN', 'BE_TRANSFERED']);
const SENTINELS = new Set(['', 'không', 'không tặng kèm', 'n/a', 'na', '-', 'none', 'null']);
const HS = axios.create({ baseURL: process.env.HUBSPOT_BASE_URL, headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` }, timeout: 30_000 });
const qs = (s: string) => `'${s.replace(/'/g, "''")}'`;
const mdTable = (rows: string[][], head: string[]) =>
  rows.length ? [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n') : '_(không có)_';

const dropped = new Set<string>();
function normCodes(raw?: string | null): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const p of String(raw).split(';')) {
    const t = p.trim();
    if (!t) continue;
    if (/\s/.test(t) || SENTINELS.has(t.toLowerCase())) { dropped.add(t); continue; }
    out.push(t);
  }
  return out;
}
async function fingerprint() {
  const fp: Record<string, { n: string; h: string | null }> = {};
  for (const t of FP_TABLES) {
    const [r] = await queryUatReadonly<{ n: string; h: string | null }>(
      `SELECT count(*)::text n, md5(coalesce(string_agg(md5(x::text), '' ORDER BY x.id), '')) h FROM ${t} x`, [], DB);
    fp[t] = r;
  }
  return fp;
}
async function fetchDealsWon(ids: string[], won: Set<string>) {
  const byId = new Map<string, { codes: Set<string>; won: boolean }>();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data } = await HS.post('/crm/v3/objects/deals/batch/read', { properties: ['dealstage', 'lop_dang_ky_cloned_', 'lop_dang_ky_tang_kem'], inputs: chunk.map((id) => ({ id })) });
    for (const r of data.results || []) {
      const p = r.properties || {};
      const w = won.has(String(p.dealstage));
      byId.set(r.id, { won: w, codes: w ? new Set([...normCodes(p.lop_dang_ky_cloned_), ...normCodes(p.lop_dang_ky_tang_kem)]) : new Set() });
    }
    if (i % 1000 === 0) console.log(`  HubSpot ${i + chunk.length}/${ids.length}`); // eslint-disable-line no-console
  }
  return byId;
}
async function classifyAfter(rows: { uid: string; code: string; cid: string }[]) {
  const m = new Map<string, string>();
  if (!rows.length) return m;
  const uniq = new Map<string, [string, string]>();
  for (const r of rows) uniq.set(`${r.uid}|${r.cid}`, [r.uid, r.cid]);
  const vals = [...uniq.values()].map(([u, c]) => `(${qs(u)}::uuid, ${qs(c)}::uuid)`).join(',');
  const res = await queryUatReadonly<{ uid: string; cid: string; active: boolean; anyrow: boolean }>(
    `SELECT v.uid::text uid, v.cid::text cid,
            EXISTS(SELECT 1 FROM class_user_instances c WHERE c.user_id=v.uid AND c.class_id=v.cid AND c.deleted_at IS NULL) active,
            EXISTS(SELECT 1 FROM class_user_instances c WHERE c.user_id=v.uid AND c.class_id=v.cid) anyrow
       FROM (VALUES ${vals}) v(uid, cid)`, [], DB);
  for (const x of res) m.set(`${x.uid}|${x.cid}`, x.active ? 'active' : x.anyrow ? 'soft-deleted' : 'gone');
  return m;
}

test(`SAPP-14127 ${MODE} (${DB.dbPrefix})`, async () => {
  test.skip(!isUatDbConfigured(DB.dbPrefix), `Thiếu ${DB.dbPrefix}_*`);
  test.setTimeout(600_000);
  fs.mkdirSync(DIR, { recursive: true });

  if (MODE === 'save') {
    const { data: pipeData } = await HS.get('/crm/v3/pipelines/deals');
    const won = new Set<string>();
    for (const p of pipeData.results || []) { if (/test/i.test(p.label)) continue; for (const s of p.stages || []) if (/hoàn thiện hồ sơ học viên/i.test(s.label)) won.add(String(s.id)); }
    const deals = await queryUatReadonly<{ deal_uuid: string; user_id: string; hubspot_deal_id: string }>(`SELECT id::text deal_uuid, user_id::text user_id, hubspot_deal_id FROM user_hubspot_deals WHERE hubspot_deal_id IS NOT NULL`, [], DB);
    const uhc = await queryUatReadonly<{ deal_uuid: string; class_code: string | null; is_deleted: boolean }>(`SELECT user_hubspot_deal_id::text deal_uuid, class_code, (deleted_at IS NOT NULL) is_deleted FROM user_hubspot_classes WHERE user_hubspot_deal_id IS NOT NULL`, [], DB);
    const cui = await queryUatReadonly<{ user_id: string; class_id: string; type: string; source_type: string | null; completed: number; is_deleted: boolean }>(`SELECT user_id::text user_id, class_id::text class_id, upper(type) type, source_type, CASE WHEN (learning_progress->>'total_course_sections_completed') ~ '^[0-9]+$' THEN (learning_progress->>'total_course_sections_completed')::int ELSE 0 END completed, (deleted_at IS NOT NULL) is_deleted FROM class_user_instances`, [], DB);
    const classes = await queryUatReadonly<{ id: string; class_code: string }>(`SELECT id::text id, code class_code FROM classes WHERE code IS NOT NULL`, [], DB);

    const codeById = new Map<string, string>(); const idByCode = new Map<string, string>(); const opsCodes = new Set<string>();
    for (const c of classes) { codeById.set(c.id, c.class_code); if (!idByCode.has(c.class_code)) idByCode.set(c.class_code, c.id); opsCodes.add(c.class_code); }
    const uhcByDeal = new Map<string, Set<string>>();
    for (const r of uhc) { if (r.is_deleted || !r.class_code) continue; (uhcByDeal.get(r.deal_uuid) ?? uhcByDeal.set(r.deal_uuid, new Set()).get(r.deal_uuid)!).add(r.class_code); }
    const memberActive = new Map<string, Set<string>>(); const syncByUser = new Map<string, { class_id: string; type: string; completed: number }[]>();
    for (const r of cui) { if (r.is_deleted) continue; (memberActive.get(r.user_id) ?? memberActive.set(r.user_id, new Set()).get(r.user_id)!).add(r.class_id); if (r.source_type === 'SYNC_DEAL_WON') (syncByUser.get(r.user_id) ?? syncByUser.set(r.user_id, []).get(r.user_id)!).push({ class_id: r.class_id, type: r.type, completed: r.completed }); }

    const hs = await fetchDealsWon(deals.map((d) => d.hubspot_deal_id), won);
    const userDealCodes = new Map<string, Set<string>>(); let wonQ = 0;
    for (const d of deals) { const x = hs.get(d.hubspot_deal_id); if (!x?.won) continue; wonQ++; const s = userDealCodes.get(d.user_id) ?? userDealCodes.set(d.user_id, new Set()).get(d.user_id)!; for (const c of x.codes) s.add(c); }

    const addClassCode: { uid: string; deal: string; code: string }[] = [];
    for (const d of deals) { const x = hs.get(d.hubspot_deal_id); if (!x?.won) continue; const present = uhcByDeal.get(d.deal_uuid) ?? new Set<string>(); for (const c of x.codes) if (!present.has(c)) addClassCode.push({ uid: d.user_id, deal: d.hubspot_deal_id, code: c }); }
    const kindOf = (c: string) => (/^F-/.test(c) ? 'F-' : /^R-/.test(c) ? 'R-' : /\//.test(c) ? 'other' : 'plain');
    const scope = new Set(deals.map((d) => d.user_id));
    const removePlain: { uid: string; code: string; cid: string }[] = []; const removeVariant: { uid: string; code: string; cid: string }[] = []; const keep: { uid: string; code: string; cid: string }[] = [];
    for (const [uid, rows] of syncByUser) { if (!scope.has(uid)) continue; const dc = userDealCodes.get(uid) ?? new Set<string>(); for (const r of rows) { const code = codeById.get(r.class_id) ?? '(?)'; if (dc.has(code)) continue; if (r.completed === 0 && DELETE_GROUP.has(r.type)) (kindOf(code) === 'plain' ? removePlain : removeVariant).push({ uid, code, cid: r.class_id }); else keep.push({ uid, code, cid: r.class_id }); } }
    const uhcByUser = new Map<string, Set<string>>();
    for (const d of deals) { const p = uhcByDeal.get(d.deal_uuid); if (!p) continue; const s = uhcByUser.get(d.user_id) ?? uhcByUser.set(d.user_id, new Set()).get(d.user_id)!; for (const c of p) s.add(c); }
    const addStudent: { uid: string; code: string; cid: string }[] = [];
    for (const [uid, dc] of userDealCodes) { const inU = uhcByUser.get(uid) ?? new Set<string>(); const mem = memberActive.get(uid) ?? new Set<string>(); for (const code of dc) { if (!inU.has(code) || !opsCodes.has(code)) continue; const cid = idByCode.get(code)!; if (!mem.has(cid)) addStudent.push({ uid, code, cid }); } }

    const fp = await fingerprint();
    const payload = { generatedAt: new Date().toISOString(), dbPrefix: DB.dbPrefix, dbName: process.env[`${DB.dbPrefix}_NAME`], dealsProcessed: deals.length, wonQualified: wonQ, fingerprint: fp, addClassCode, removePlain, removeVariant, keep, addStudent, droppedTokens: [...dropped] };
    fs.writeFileSync(FLAGS_PATH, JSON.stringify(payload, null, 2), 'utf8');
    // eslint-disable-next-line no-console
    console.log(`SAVED before (${payload.dbName}, deals=${deals.length} won=${wonQ}): add=${addClassCode.length} removePlain=${removePlain.length} removeVariant=${removeVariant.length} keep=${keep.length} addStudent=${addStudent.length}`);
    // eslint-disable-next-line no-console
    console.log(`File: ${FLAGS_PATH}`);
  } else {
    const saved = JSON.parse(fs.readFileSync(FLAGS_PATH, 'utf8'));
    const fpNow = await fingerprint();
    const changed = FP_TABLES.filter((t) => saved.fingerprint[t]?.h !== fpNow[t]?.h);
    // eslint-disable-next-line no-console
    console.log(changed.length ? `DB đã ĐỔI so với before ở: ${changed.join(', ')}` : '⚠️ DB CHƯA đổi (vẫn = before) — có thể chưa restore bản after?');

    const p1 = saved.addClassCode as { uid: string; deal: string; code: string }[];
    let c1applied = 0; const c1missing: string[][] = []; const c1absent: string[][] = [];
    if (p1.length) {
      const vals = p1.map((r) => `(${qs(r.deal)}, ${qs(r.code)})`).join(',');
      const res = await queryUatReadonly<{ did: string; code: string; deal_exists: boolean; active: boolean }>(`SELECT v.did did, v.code code, EXISTS(SELECT 1 FROM user_hubspot_deals d WHERE d.hubspot_deal_id=v.did) deal_exists, EXISTS(SELECT 1 FROM user_hubspot_classes c JOIN user_hubspot_deals d ON d.id=c.user_hubspot_deal_id WHERE d.hubspot_deal_id=v.did AND c.class_code=v.code AND c.deleted_at IS NULL) active FROM (VALUES ${vals}) v(did, code)`, [], DB);
      const mp = new Map(res.map((x) => [`${x.did}|${x.code}`, x]));
      for (const r of p1) { const x = mp.get(`${r.deal}|${r.code}`); if (x?.active) c1applied++; else if (!x?.deal_exists) c1absent.push([r.uid, r.deal, r.code]); else c1missing.push([r.uid, r.deal, r.code]); }
    }
    const cPlain = await classifyAfter(saved.removePlain);
    const cKeep = await classifyAfter(saved.keep);
    const cAdd = await classifyAfter(saved.addStudent);
    const P = (a: { uid: string; code: string; cid: string }[]) => a.map((x) => [x.uid, x.code, x.cid]);
    const c2active = saved.removePlain.filter((r: any) => (cPlain.get(`${r.uid}|${r.cid}`) ?? 'gone') === 'active');
    const c3wrong = saved.keep.filter((r: any) => (cKeep.get(`${r.uid}|${r.cid}`) ?? 'gone') !== 'active');
    const c4not = saved.addStudent.filter((r: any) => (cAdd.get(`${r.uid}|${r.cid}`) ?? 'gone') !== 'active');

    const report = `# Verify SAPP-14127 — before (đã lưu) → after (DB restore mới)

- Check lúc: ${new Date().toISOString()} | before lưu lúc: ${saved.generatedAt} (${saved.dbName}, ${saved.dealsProcessed} deal, WON ${saved.wonQualified})
- Fingerprint: ${changed.length ? 'DB ĐÃ đổi (' + changed.join(', ') + ')' : '⚠️ DB CHƯA đổi — có thể chưa restore after'}
- Read-only. Không Email/SĐT.

## Trả lời 4 câu
| Câu hỏi | Flag (before) | Đã áp đúng ở after | Bất thường |
| --- | --- | --- | --- |
| 1. Mã lớp đã THÊM chưa? | ${p1.length} | ${c1applied} | ${c1missing.length} thiếu + ${c1absent.length} deal không có |
| 2. HV đã bị XÓA chưa? (PLAIN đáng tin) | ${saved.removePlain.length} | ${saved.removePlain.length - c2active.length} | ${c2active.length} vẫn active |
| 3. HV vẫn được GIỮ chưa? | ${saved.keep.length} | ${saved.keep.length - c3wrong.length} | ${c3wrong.length} bị xóa (sai) |
| 4. HV đã THÊM vào lớp chưa? | ${saved.addStudent.length} | ${saved.addStudent.length - c4not.length} | ${c4not.length} chưa |

## Câu 1 — mã lớp vẫn THIẾU (${c1missing.length})
${mdTable(c1missing, ['user_id', 'hubspot_deal_id', 'class_code'])}

## Câu 2 — HV PLAIN đáng xóa nhưng VẪN ACTIVE (${c2active.length})
${mdTable(P(c2active), ['user_id', 'class_code', 'class_id'])}

## Câu 3 — HV phải GIỮ nhưng bị XÓA/MẤT (${c3wrong.length})
${mdTable(c3wrong.map((r: any) => [r.uid, r.code, r.cid, cKeep.get(`${r.uid}|${r.cid}`)]), ['user_id', 'class_code', 'class_id', 'bucket'])}

## Câu 4 — HV đáng THÊM nhưng CHƯA (${c4not.length})
${mdTable(c4not.map((r: any) => [r.uid, r.code, r.cid, cAdd.get(`${r.uid}|${r.cid}`)]), ['user_id', 'class_code', 'class_id', 'bucket'])}
`;
    fs.writeFileSync(path.join(DIR, 'verify-4questions-final.md'), report, 'utf8');
    // eslint-disable-next-line no-console
    console.log(`1)add ${c1applied}/${p1.length} | 2)removePlain ${saved.removePlain.length - c2active.length}/${saved.removePlain.length} | 3)keep ${saved.keep.length - c3wrong.length}/${saved.keep.length} | 4)add ${saved.addStudent.length - c4not.length}/${saved.addStudent.length}`);
    // eslint-disable-next-line no-console
    console.log(`File: ${path.join(DIR, 'verify-4questions-final.md')}`);
  }
});
