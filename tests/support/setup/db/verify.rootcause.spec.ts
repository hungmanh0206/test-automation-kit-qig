import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { queryUatReadonly } from './uatPgClient';

/**
 * Root-cause SAPP-14127: giải thích vì sao before-flag CHƯA được áp / bị áp sai ở after.
 * before = LIB_MASTER_DB (postgres) | after = DB1 (set qua env tạm bên dưới). Read-only, DB-only.
 */
const DIR = path.join('outputs', 'lms-operations-automation', process.env.TASK_KEY || 'SAPP-14127');
const saved = JSON.parse(fs.readFileSync(path.join(DIR, 'before-flags.json'), 'utf8'));
// after = DB1 (cùng server localhost:5432)
process.env.LIB_MASTER_DBAFT_HOST = 'localhost';
process.env.LIB_MASTER_DBAFT_PORT = '5432';
process.env.LIB_MASTER_DBAFT_NAME = process.env.AFTER_DB_NAME || 'DB1';
process.env.LIB_MASTER_DBAFT_USERNAME = 'postgres';
process.env.LIB_MASTER_DBAFT_PASSWORD = '0206';
const BEFORE = { dbPrefix: 'LIB_MASTER_DB' };
const AFTER = { dbPrefix: 'LIB_MASTER_DBAFT' };
const qs = (s: string) => `'${s.replace(/'/g, "''")}'`;
const COMPLETED = `CASE WHEN (c.learning_progress->>'total_course_sections_completed') ~ '^[0-9]+$' THEN (c.learning_progress->>'total_course_sections_completed')::int ELSE 0 END`;
const mdTable = (rows: (string | number)[][], head: string[]) =>
  rows.length ? [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n') : '_(không có)_';

test('root-cause câu 1-4', async () => {
  test.setTimeout(300_000);

  // ===== Câu 1: 24 mã lớp còn thiếu — mã có tồn tại trên OPS (classes) không? =====
  const p1 = saved.addClassCode as { uid: string; deal: string; code: string }[];
  const v1 = p1.map((r) => `(${qs(r.deal)}, ${qs(r.code)})`).join(',');
  const a1 = await queryUatReadonly<{ did: string; code: string; active: boolean; in_classes: boolean }>(
    `SELECT v.did did, v.code code,
       EXISTS(SELECT 1 FROM user_hubspot_classes c JOIN user_hubspot_deals d ON d.id=c.user_hubspot_deal_id WHERE d.hubspot_deal_id=v.did AND c.class_code=v.code AND c.deleted_at IS NULL) active,
       EXISTS(SELECT 1 FROM classes cl WHERE cl.code=v.code) in_classes
     FROM (VALUES ${v1}) v(did, code)`, [], AFTER);
  const a1m = new Map(a1.map((x) => [`${x.did}|${x.code}`, x]));
  const c1missing = p1.filter((r) => !a1m.get(`${r.deal}|${r.code}`)?.active);
  const c1_noClass = c1missing.filter((r) => !a1m.get(`${r.deal}|${r.code}`)?.in_classes); // OPS chưa có mã → đúng (không tự tạo)
  const c1_realGap = c1missing.filter((r) => a1m.get(`${r.deal}|${r.code}`)?.in_classes);   // OPS đã có mà vẫn thiếu

  // ===== Câu 2: 93 HV plain vẫn active — vì sao command KHÔNG xóa? =====
  const rp = saved.removePlain as { uid: string; code: string; cid: string }[];
  const v2 = rp.map((r) => `(${qs(r.uid)}::uuid, ${qs(r.cid)}::uuid, ${qs(r.code)})`).join(',');
  const a2 = await queryUatReadonly<{ uid: string; cid: string; active: boolean; type_now: string | null; completed_now: number | null; code_on_deal: boolean }>(
    `SELECT v.uid::text uid, v.cid::text cid,
       EXISTS(SELECT 1 FROM class_user_instances c WHERE c.user_id=v.uid AND c.class_id=v.cid AND c.deleted_at IS NULL) active,
       (SELECT string_agg(DISTINCT upper(c.type), ',') FROM class_user_instances c WHERE c.user_id=v.uid AND c.class_id=v.cid AND c.deleted_at IS NULL) type_now,
       (SELECT max(${COMPLETED}) FROM class_user_instances c WHERE c.user_id=v.uid AND c.class_id=v.cid AND c.deleted_at IS NULL) completed_now,
       EXISTS(SELECT 1 FROM user_hubspot_classes uc JOIN user_hubspot_deals d ON d.id=uc.user_hubspot_deal_id WHERE d.user_id=v.uid AND uc.class_code=v.code AND uc.deleted_at IS NULL) code_on_deal
     FROM (VALUES ${v2}) v(uid, cid, code)`, [], AFTER);
  const a2m = new Map(a2.map((x) => [`${x.uid}|${x.cid}`, x]));
  const c2 = rp.map((r) => ({ ...r, a: a2m.get(`${r.uid}|${r.cid}`) })).filter((r) => r.a?.active); // 93 vẫn active
  const c2_progress = c2.filter((r) => (r.a!.completed_now ?? 0) > 0);                 // giờ đã có progress → giữ đúng
  const c2_onDeal = c2.filter((r) => (r.a!.completed_now ?? 0) === 0 && r.a!.code_on_deal); // command coi lớp vẫn trên deal
  const c2_typeChg = c2.filter((r) => (r.a!.completed_now ?? 0) === 0 && !r.a!.code_on_deal && !/NORMAL|REASSIGNED|RETAKING|MOVED_IN|BE_TRANSFERED/.test(r.a!.type_now || ''));
  const c2_gap = c2.filter((r) => !c2_progress.includes(r) && !c2_onDeal.includes(r) && !c2_typeChg.includes(r)); // không lý do rõ → command bỏ sót

  // ===== Câu 3: 59 HV phải giữ nhưng bị xóa — lý do giữ (before) là gì? =====
  const kp = saved.keep as { uid: string; code: string; cid: string }[];
  const v3 = kp.map((r) => `(${qs(r.uid)}::uuid, ${qs(r.cid)}::uuid)`).join(',');
  // trạng thái after
  const a3 = await queryUatReadonly<{ uid: string; cid: string; active: boolean }>(
    `SELECT v.uid::text uid, v.cid::text cid, EXISTS(SELECT 1 FROM class_user_instances c WHERE c.user_id=v.uid AND c.class_id=v.cid AND c.deleted_at IS NULL) active FROM (VALUES ${v3}) v(uid, cid)`, [], AFTER);
  const a3m = new Map(a3.map((x) => [`${x.uid}|${x.cid}`, x.active]));
  // lý do giữ ở before (postgres): type + progress
  const b3 = await queryUatReadonly<{ uid: string; cid: string; type_b: string | null; completed_b: number | null }>(
    `SELECT v.uid::text uid, v.cid::text cid,
       (SELECT string_agg(DISTINCT upper(c.type), ',') FROM class_user_instances c WHERE c.user_id=v.uid AND c.class_id=v.cid AND c.source_type='SYNC_DEAL_WON' AND c.deleted_at IS NULL) type_b,
       (SELECT max(${COMPLETED}) FROM class_user_instances c WHERE c.user_id=v.uid AND c.class_id=v.cid AND c.source_type='SYNC_DEAL_WON' AND c.deleted_at IS NULL) completed_b
     FROM (VALUES ${v3}) v(uid, cid)`, [], BEFORE);
  const b3m = new Map(b3.map((x) => [`${x.uid}|${x.cid}`, x]));
  const c3 = kp.map((r) => ({ ...r, b: b3m.get(`${r.uid}|${r.cid}`) })).filter((r) => a3m.get(`${r.uid}|${r.cid}`) === false); // 59 bị xóa
  const c3_progress = c3.filter((r) => (r.b?.completed_b ?? 0) > 0);   // đang học mà bị xóa → NGHIÊM TRỌNG
  const c3_keepType = c3.filter((r) => (r.b?.completed_b ?? 0) === 0); // giữ vì type (Reserved/Retook/...) mà bị xóa

  // ===== Câu 4: 357 HV chưa thêm — có phải thành viên lớp cùng CODE (class_id khác) không? =====
  const ad = saved.addStudent as { uid: string; code: string; cid: string }[];
  const v4 = ad.map((r) => `(${qs(r.uid)}::uuid, ${qs(r.cid)}::uuid, ${qs(r.code)})`).join(',');
  const a4 = await queryUatReadonly<{ uid: string; cid: string; active_exact: boolean; member_anycode: boolean; classes_with_code: number }>(
    `SELECT v.uid::text uid, v.cid::text cid,
       EXISTS(SELECT 1 FROM class_user_instances c WHERE c.user_id=v.uid AND c.class_id=v.cid AND c.deleted_at IS NULL) active_exact,
       EXISTS(SELECT 1 FROM class_user_instances c JOIN classes cl ON cl.id=c.class_id WHERE c.user_id=v.uid AND cl.code=v.code AND c.deleted_at IS NULL) member_anycode,
       (SELECT count(*) FROM classes cl WHERE cl.code=v.code) classes_with_code
     FROM (VALUES ${v4}) v(uid, cid, code)`, [], AFTER);
  const a4m = new Map(a4.map((x) => [`${x.uid}|${x.cid}`, x]));
  const c4 = ad.map((r) => ({ ...r, a: a4m.get(`${r.uid}|${r.cid}`) })).filter((r) => !r.a?.active_exact); // 357 chưa vào đúng class_id
  const c4_otherClassId = c4.filter((r) => r.a?.member_anycode);        // ĐÃ ở lớp cùng code (class_id khác) → flag over-count
  const c4_multiClass = c4.filter((r) => !r.a?.member_anycode && (r.a?.classes_with_code ?? 0) > 1); // code map nhiều class → chọn nhầm class_id
  const c4_genuine = c4.filter((r) => !r.a?.member_anycode && (r.a?.classes_with_code ?? 0) <= 1);   // thật sự chưa thêm

  const report = `# Root-cause SAPP-14127 — giải thích nguyên nhân (before=postgres → after=DB1)

- ${new Date().toISOString()} · read-only · không Email/SĐT.

## Câu 1 — 24 mã lớp chưa thêm: phân theo mã có trên OPS chưa
| Nhóm | Số | Ý nghĩa |
| --- | --- | --- |
| OPS **chưa có** mã lớp | **${c1_noClass.length}** | Command KHÔNG tự tạo mã lớp — **đúng theo rule**, không phải lỗi |
| OPS **đã có** mã mà vẫn thiếu | **${c1_realGap.length}** | Gap thật — đáng kiểm |

### Gap thật (OPS đã có mã nhưng chưa thêm vào user_hubspot_classes)
${mdTable(c1_realGap.map((r) => [r.uid, r.deal, r.code]), ['user_id', 'hubspot_deal_id', 'class_code'])}

## Câu 2 — 93 HV (plain) chưa bị xóa: NGUYÊN NHÂN
| Nhóm nguyên nhân | Số | Giải thích |
| --- | --- | --- |
| progress ≠ 0 ở after | **${c2_progress.length}** | HV giờ đã có tiến độ học → giữ lại là **đúng** (không nên xóa) |
| Mã lớp vẫn trên deal ở after | **${c2_onDeal.length}** | Command coi lớp còn trên deal (đã sync lại) → không xóa (đúng logic) |
| type đã đổi khỏi nhóm-xóa | **${c2_typeChg.length}** | type after không thuộc {NORMAL,REASSIGNED,...} → không xóa |
| **Không lý do rõ → command BỎ SÓT** | **${c2_gap.length}** | progress=0, không trên deal, type vẫn nhóm-xóa mà chưa xóa → **gap thật** |

### Danh sách "command bỏ sót" (câu 2)
${mdTable(c2_gap.map((r) => [r.uid, r.code, r.cid, r.a!.type_now || '', r.a!.completed_now ?? 0]), ['user_id', 'class_code', 'class_id', 'type_after', 'completed_after'])}

## Câu 3 — 59 HV phải GIỮ nhưng bị XÓA: NGUYÊN NHÂN
| Nhóm | Số | Mức độ |
| --- | --- | --- |
| Giữ vì **progress ≠ 0** (đang học) mà bị xóa | **${c3_progress.length}** | 🔴 NGHIÊM TRỌNG — xóa HV đang học (mất dữ liệu học tập) |
| Giữ vì **type** (Reserved/Retook/Moved_out/Transfered_to) mà bị xóa | **${c3_keepType.length}** | 🟠 Command dùng tập type khác spec |

### 🔴 Xóa HV ĐANG HỌC (progress≠0) — ưu tiên cao nhất
${mdTable(c3_progress.map((r) => [r.uid, r.code, r.cid, r.b?.type_b || '', r.b?.completed_b ?? 0]), ['user_id', 'class_code', 'class_id', 'type_before', 'completed_before'])}

### 🟠 Xóa HV thuộc type-giữ (progress=0)
${mdTable(c3_keepType.map((r) => [r.uid, r.code, r.cid, r.b?.type_b || '', r.b?.completed_b ?? 0]), ['user_id', 'class_code', 'class_id', 'type_before', 'completed_before'])}

## Câu 4 — 357 HV chưa thêm vào lớp: NGUYÊN NHÂN
| Nhóm | Số | Giải thích |
| --- | --- | --- |
| ĐÃ là thành viên lớp **cùng code** (class_id khác) | **${c4_otherClassId.length}** | Flag của tôi over-count (1 code map nhiều class instance) → **không phải gap** |
| code map **nhiều class** (chọn nhầm class_id) | **${c4_multiClass.length}** | Cần map đúng class_id theo nghiệp vụ |
| Thật sự **chưa thêm** | **${c4_genuine.length}** | Gap thật (hoặc điều kiện add của command khác) |

### Thật sự chưa thêm (câu 4)
${mdTable(c4_genuine.map((r) => [r.uid, r.code, r.cid]), ['user_id', 'class_code', 'class_id'])}
`;
  fs.writeFileSync(path.join(DIR, 'verify-rootcause.md'), report, 'utf8');
  const L = (s: string) => console.log(s); // eslint-disable-line no-console
  L(`Câu1: OPS-chưa-có=${c1_noClass.length} (đúng) | gap-thật=${c1_realGap.length}`);
  L(`Câu2: progress≠0=${c2_progress.length} | onDeal=${c2_onDeal.length} | typeChg=${c2_typeChg.length} | BỎ-SÓT=${c2_gap.length}`);
  L(`Câu3: 🔴progress≠0-bị-xóa=${c3_progress.length} | 🟠type-giữ-bị-xóa=${c3_keepType.length}`);
  L(`Câu4: đã-ở-lớp-cùng-code=${c4_otherClassId.length} | multi-class=${c4_multiClass.length} | gap-thật=${c4_genuine.length}`);
  L(`File: ${path.join(DIR, 'verify-rootcause.md')}`);
});
