# Bài 18 — Đưa testcase ra khỏi máy cá nhân

> **2 giờ** · Có gì trong tay: testcase và kết quả vẫn đang nằm local · Sau bài này: cả team đọc chung một nguồn, và giữ được đường truy ngược về requirement

**Vấn đề**

Bạn vừa có 120 testcase, tất cả nằm trong repo của bạn.

Một QA khác trong đội hỏi: *"case nào đang cover BR-017?"*

Bạn trả lời: *"để tôi mở file ra tìm."*

Đó là lúc bạn nhận ra bộ testcase của bạn chỉ tồn tại với người biết mở đúng file.

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Kết quả nằm trên máy bạn. Team không thấy, và mỗi lần chạy lại là mất lịch sử lần trước. |
| **Bài này bạn gõ gì** | Đẩy testcase lên công cụ chung, đối chiếu lại từng ô, rồi đẩy kết quả thành một đợt chạy. |
| **Xong thì được gì** | Cả team nhìn chung một chỗ. Và bạn biết API trả 200 chưa chứng minh dữ liệu vào đúng ô. |

> Bài này có vài từ mới. Chúng được gọi tên ở **cuối bài**, sau khi bạn đã chạm vào chúng,
> chứ không định nghĩa trước. Gặp từ lạ giữa bài thì đọc tiếp, mục đó sẽ gom lại.

## Bài này bạn sẽ làm gì

Năm việc:

1. Chốt bốn nguyên tắc trước khi nối bất cứ hệ thống nào (20 phút).
2. Viết lệnh publish, mặc định chạy thử chứ không ghi thật (35 phút).
3. Viết máy đối soát từng ô sau khi publish (35 phút).
4. Đẩy kết quả thành một lượt chạy có lịch sử (30 phút).
5. Đối soát độ tươi trước khi execute, để không chấm theo bản cũ (20 phút).

> **Bộ kit này dùng AIO Tests làm bản hiện thực mẫu.** Team bạn dùng Xray, Zephyr hay một hệ khác
> thì các lời gọi API khác đi, còn bốn nguyên tắc ở Việc 2 và ba máy ở Việc 4–6 thì giữ nguyên. Đừng
> đọc bài này như hướng dẫn dùng một sản phẩm. Một kit để dùng cho nhiều dự án thì không được khoá
> vào một nhà cung cấp.

---

## Việc 1 — Vấn đề: kit đang chỉ chạy trên máy bạn

Bộ case nằm trong repo. Kết quả nằm ở `outputs/`. Bằng chứng nằm trên đĩa của bạn.

Ba hệ quả:

| Hệ quả | Cụ thể |
|---|---|
| Team không thấy | QA Lead phải mở repo của bạn, hoặc tin lời bạn kể |
| Không có lịch sử | Lượt chạy tuần trước bị ghi đè bởi lượt tuần này |
| Bug không nối về case | Dev nhận bug, không biết case nào phủ nó |

Tích hợp là để cả team đọc cùng một nguồn, và để lịch sử không mất.

## Việc 2 — Nguyên tắc trước khi nối bất cứ hệ thống nào

Bốn nguyên tắc, và mỗi cái đến từ một lần mất mát:

| Nguyên tắc | Vì sao |
|---|---|
| **Luôn dry-run trước** | Đẩy nhầm 500 case lên công cụ dùng chung thì rất khó rút lại |
| **Kiểm công cụ có API xoá không** | Nếu không thì mọi lần đẩy là vĩnh viễn — dry-run thành bắt buộc, không phải cẩn thận thừa |
| **2xx không chứng minh mapping đúng** | Xem mục 4 |
| **Một chiều rõ ràng** | Chốt rõ chiều nào là nguồn ở giai đoạn nào (Bài 13 mục 5) |

> Kinh nghiệm cụ thể: công cụ test-management mà kit này dùng không có API xoá. Nên "dọn dẹp" nghĩa là
> chuyển trạng thái sang `Deprecated`, không phải xoá. Hoá ra điều đó **tốt hơn**: giữ case nghĩa là giữ nguyên
> lịch sử các lượt chạy đã gắn vào nó. Nhưng nó cũng nghĩa là đẩy nhầm thì sống với nó mãi.

## Việc 3 — Publish: một chiều, có dry-run

```js
#!/usr/bin/env node
/*
 * publish-testcase.js — đẩy bộ testcase canonical lên công cụ test-management.
 *
 * MẶC ĐỊNH LÀ DRY-RUN. Phải thêm --apply mới ghi thật, và --qa-approved để khẳng định QA đã xác nhận Excel.
 *
 * VÌ SAO HAI CỜ, KHÔNG PHẢI MỘT: --apply là "tôi muốn ghi thật"; --qa-approved là "bộ case đã được người
 * duyệt". Gộp làm một thì lần nào cũng gõ cả hai theo phản xạ, và cờ mất nghĩa.
 */
'use strict';
const fs = require('fs');
const { docMarkdown, kiemTra } = require('../lib/testcase');

const args = process.argv.slice(2);
const lay = (ten) => { const i = args.indexOf(ten); return i >= 0 ? args[i + 1] : null; };
const APPLY = args.includes('--apply');
const APPROVED = args.includes('--qa-approved');

const file = lay('--file');
const story = lay('--story');
const folderRoot = lay('--folder-root') || 'Tự động';

if (!file || !story) {
  console.error('Dùng: node scripts/qa/publish-testcase.js --file <tc.md> --story <KEY> [--folder-root "A/B"] [--apply --qa-approved]');
  process.exit(2);
}
const token = process.env.TMS_API_TOKEN;
const base = process.env.TMS_BASE_URL;
if (!token || !base) {
  console.error('[publish] KHÔNG ĐO ĐƯỢC: thiếu TMS_API_TOKEN hoặc TMS_BASE_URL');
  process.exit(2);
}
if (APPLY && !APPROVED) {
  console.error('[publish] CHẶN: --apply mà không có --qa-approved. Bộ case phải được QA xác nhận trước.');
  process.exit(1);
}

let cases;
try { cases = docMarkdown(fs.readFileSync(file, 'utf8')); }
catch (e) { console.error('[publish] KHÔNG ĐO ĐƯỢC: ' + e.message); process.exit(2); }

// Kiểm cấu trúc TRƯỚC khi đẩy — đẩy dữ liệu sai lên công cụ không xoá được là chuyện tệ
const loi = kiemTra(cases);
if (loi.length) {
  console.error(`[publish] CHẶN: ${loi.length} vấn đề cấu trúc, sửa trước khi đẩy:`);
  for (const l of loi.slice(0, 10)) console.error('  - ' + l);
  process.exit(1);
}

/** Ánh xạ case canonical → payload của công cụ. ĐÂY là chỗ mapping có thể sai — mục 4 sẽ đối soát. */
function sangPayload(c) {
  return {
    title: c.title,
    automationKey: c.tcId,                       // TC ID của ta nằm ở đây
    precondition: c.precondition,
    steps: c.steps.split('\n').filter(Boolean).map((s, i) => ({
      index: i + 1,
      action: s.replace(/^\d+\.\s*/, ''),
      expected: (c.expected.split('\n')[i] || '').replace(/^\d+\.\s*/, '')
    })),
    priority: c.priority,
    folder: `${folderRoot}/${c.module}`,
    jiraRequirementIDs: [story]
  };
}

async function main() {
  console.log(`[publish] ${cases.length} case · story ${story} · ` +
    (APPLY ? 'GHI THẬT' : 'DRY-RUN (thêm --apply --qa-approved để ghi thật)'));

  if (!APPLY) {
    for (const c of cases.slice(0, 3)) {
      console.log('\n--- xem trước payload ---');
      console.log(JSON.stringify(sangPayload(c), null, 2));
    }
    console.log(`\n… và ${Math.max(0, cases.length - 3)} case nữa.`);
    console.log('\nKiểm: automationKey đúng TC ID? steps ghép đúng cặp action↔expected? folder đúng module?');
    return;
  }

  let ok = 0;
  const that = [];
  for (const c of cases) {
    const r = await fetch(`${base}/api/cases`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(sangPayload(c))
    });
    if (r.ok) ok++;
    else that.push(`${c.tcId}: ${r.status} ${(await r.text()).slice(0, 120)}`);
    // Nghỉ giữa các lần gọi — đẩy 500 case liên tục sẽ bị chặn tần suất
    await new Promise((res) => setTimeout(res, Number(process.env.TMS_THROTTLE_MS || 200)));
  }
  console.log(`\n[publish] thành công ${ok}/${cases.length}`);
  if (that.length) {
    console.error(`[publish] ${that.length} thất bại:`);
    for (const t of that.slice(0, 10)) console.error('  - ' + t);
  }
  console.log('\n⚠ BƯỚC BẮT BUỘC TIẾP THEO: npm run tms:verify-fields — 2xx KHÔNG chứng minh mapping đúng.');
  if (that.length) process.exit(1);
}

main().catch((e) => { console.error('[publish] lỗi: ' + e.message); process.exit(1); });
```

## Việc 4 — Đối soát từng trường: 2xx không chứng minh gì

Đây là mục quan trọng nhất của bài.

`201 Created` chỉ chứng minh request được nhận. Nó không chứng minh:

- Trường của bạn vào đúng trường của công cụ.
- Giá trị không bị biến đổi (thang giá trị khác, cắt độ dài, chuẩn hoá).
- Trường không nằm trong danh sách cho phép ghi — bị bỏ qua âm thầm.

> Chuyện thật: bộ case dùng `Highest` cho Ưu tiên (thang Jira), nhưng công cụ map theo **tên** và thang của nó
> là `Critical`. Kết quả: 14 case rơi về `Medium`. Mặc định. API trả `201` cho cả 14 case. Log trông hoàn
> hảo. Không ai biết cho tới khi có người mở công cụ ra xem.

```js
#!/usr/bin/env node
/*
 * doi-soat-truong.js — đọc LẠI từ công cụ và so với nguồn, TỪNG TRƯỜNG.
 *
 * VÌ SAO BẮT BUỘC SAU MỖI LƯỢT PUBLISH: 2xx chỉ nói request được nhận. Trường ngoài danh sách cho phép
 * ghi bị BỎ QUA ÂM THẦM, và giá trị ngoài thang bị rơi về mặc định — cả hai đều trả 2xx.
 *
 * Hai mức: --structure-only chỉ so tập trường (chạy được ở CI không cần token đầy đủ);
 * mặc định so cả GIÁ TRỊ.
 */
'use strict';
const fs = require('fs');
const { docMarkdown } = require('../lib/testcase');

const args = process.argv.slice(2);
const file = args[args.indexOf('--file') + 1];
const CHI_CAU_TRUC = args.includes('--structure-only');
if (!file) { console.error('Dùng: node scripts/qa/doi-soat-truong.js --file <tc.md> [--structure-only]'); process.exit(2); }

const base = process.env.TMS_BASE_URL, token = process.env.TMS_API_TOKEN;
if (!base || !token) { console.error('[doi-soat] KHÔNG ĐO ĐƯỢC: thiếu TMS_BASE_URL/TMS_API_TOKEN'); process.exit(2); }

const nguon = docMarkdown(fs.readFileSync(file, 'utf8'));

/** Trường nào phải khớp, và cách so. So chuẩn hoá khoảng trắng, KHÔNG chuẩn hoá nội dung. */
const DOI_CHIEU = [
  { ten: 'title', lay: (c) => c.title, layTms: (t) => t.title },
  { ten: 'precondition', lay: (c) => c.precondition, layTms: (t) => t.precondition },
  { ten: 'priority', lay: (c) => c.priority, layTms: (t) => t.priority },
  { ten: 'soBuoc', lay: (c) => String(c.steps.split('\n').filter(Boolean).length),
    layTms: (t) => String((t.steps || []).length) }
];
const chuan = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

async function main() {
  const lech = [];
  const khongThay = [];

  for (const c of nguon) {
    const r = await fetch(`${base}/api/cases?automationKey=${encodeURIComponent(c.tcId)}`,
      { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) { console.error('[doi-soat] KHÔNG ĐO ĐƯỢC: API trả ' + r.status); process.exit(2); }
    const ds = await r.json();
    const tms = Array.isArray(ds) ? ds[0] : ds;
    if (!tms) { khongThay.push(c.tcId); continue; }

    for (const d of DOI_CHIEU) {
      const a = chuan(d.lay(c));
      const b = chuan(d.layTms(tms));
      if (CHI_CAU_TRUC) {
        // Chỉ kiểm trường CÓ TỒN TẠI, không so giá trị
        if (a && !b) lech.push(`${c.tcId}.${d.ten}: nguồn có giá trị, công cụ TRỐNG ⇒ trường bị bỏ qua`);
      } else if (a !== b) {
        lech.push(`${c.tcId}.${d.ten}: nguồn="${a.slice(0, 40)}" ≠ công cụ="${b.slice(0, 40)}"`);
      }
    }
  }

  console.log(`[doi-soat] ${nguon.length} case · chế độ ${CHI_CAU_TRUC ? 'cấu trúc' : 'cấu trúc + giá trị'}`);
  if (khongThay.length) console.log(`  ${khongThay.length} case KHÔNG tìm thấy trên công cụ: ${khongThay.slice(0, 10).join(' ')}`);

  if (lech.length || khongThay.length) {
    console.error(`\n[doi-soat] ✗ ${lech.length + khongThay.length} vấn đề:`);
    for (const l of lech.slice(0, 20)) console.error('  - ' + l);
    console.error('\nLệch giá trị thường là: thang giá trị khác · trường ngoài danh sách cho phép ghi · ' +
      'độ dài bị cắt. Sửa MAPPING, đừng sửa nguồn cho vừa công cụ.');
    process.exit(1);
  }
  console.log('[doi-soat] ✓ ĐẠT — mọi trường khớp nguồn.');
}
main().catch((e) => { console.error('[doi-soat] lỗi: ' + e.message); process.exit(1); });
```

Câu cuối trong thông báo lỗi là câu đáng nhớ: sửa mapping, đừng sửa nguồn cho vừa công cụ. Nguồn là
canonical; nếu bạn đổi `Critical` thành `Highest` cho công cụ nhận thì bạn vừa làm hỏng canonical.

## Việc 5 — Đẩy kết quả: một lượt chạy = một cycle

Kết quả cần giữ lịch sử. Mỗi lượt chạy tạo một cycle mới; chạy lại cùng tên thì **dùng lại** cycle cũ và
bỏ qua evidence đã có, thay vì đẻ cycle trùng.

```js
#!/usr/bin/env node
/*
 * day-ket-qua.js — đẩy testcase-status.json thành một cycle trên công cụ test-management.
 *
 * ĐẦU VÀO GIỮ NGUYÊN là testcase-status.json của Bài 17 — Phase 2 không phải đổi cách ghi kết quả,
 * chỉ đích đến là khác.
 *
 * CHẠY GATE TRƯỚC KHI GHI: chất lượng output. Bỏ qua có chủ ý thì --qa-approved.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { TAXONOMY } = require('../lib/verdict');

const args = process.argv.slice(2);
const lay = (t) => { const i = args.indexOf(t); return i >= 0 ? args[i + 1] : null; };
const APPLY = args.includes('--apply');
const BO_QUA_GATE = args.includes('--qa-approved');

const statusFile = lay('--status');
const cycleTitle = lay('--cycle-title') || `Lần ${new Date().toISOString().slice(0, 10)}`;
const folder = lay('--folder') || 'Chưa phân loại';

if (!statusFile) { console.error('Dùng: node scripts/qa/day-ket-qua.js --status <f.json> [--folder "Sprint N"] [--cycle-title "..."] [--apply]'); process.exit(2); }

/* Gate chất lượng ĐỨNG Ở ĐÂY, không chỉ ở lệnh tự soi — vì bỏ qua lệnh tự soi rồi đẩy thẳng thì
   trước đây không gì cản. Cùng một luật, hai cửa. */
if (!BO_QUA_GATE) {
  const g = spawnSync(process.execPath, ['scripts/qa/gate-bang-chung.js', statusFile], { encoding: 'utf8' });
  if (g.status !== 0) {
    console.error(g.stdout + g.stderr);
    console.error('[day-ket-qua] CHẶN bởi gate-bang-chung. Sửa, hoặc --qa-approved nếu cố ý bỏ qua.');
    process.exit(1);
  }
}

const cases = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
const base = process.env.TMS_BASE_URL, token = process.env.TMS_API_TOKEN;
if (!base || !token) { console.error('[day-ket-qua] KHÔNG ĐO ĐƯỢC: thiếu TMS_BASE_URL/TMS_API_TOKEN'); process.exit(2); }

/** Trạng thái canonical → trạng thái run của công cụ. Ánh xạ khai ở TAXONOMY, không hardcode ở đây. */
function sangTms(status) {
  const s = TAXONOMY.statuses[status];
  if (!s) throw new Error(`trạng thái lạ "${status}" — không có trong phan-quyet`);
  return s.tms;
}

async function main() {
  const dem = cases.reduce((a, c) => { a[c.status] = (a[c.status] || 0) + 1; return a; }, {});
  console.log(`[day-ket-qua] cycle "${cycleTitle}" · thư mục "${folder}" · ${cases.length} case`);
  console.log('  ' + Object.entries(dem).map(([k, v]) => `${k}=${v}`).join(' · '));

  if (!APPLY) {
    console.log('\nDRY-RUN. Xem trước 3 run đầu:');
    for (const c of cases.slice(0, 3)) {
      console.log(`  ${c.id}: ${c.status} → ${sangTms(c.status)} · ${(c.evidence || []).length} tệp bằng chứng`);
    }
    console.log('\nThêm --apply để ghi thật.');
    return;
  }

  const rc = await fetch(`${base}/api/cycles`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: cycleTitle, folder })
  });
  if (!rc.ok) { console.error('[day-ket-qua] không tạo được cycle: ' + rc.status); process.exit(1); }
  const cycle = await rc.json();

  let ok = 0;
  for (const c of cases) {
    const rr = await fetch(`${base}/api/cycles/${cycle.id}/runs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ automationKey: c.id, status: sangTms(c.status), note: c.loi || c.lyDo || '' })
    });
    if (!rr.ok) continue;
    const run = await rr.json();

    // Evidence neo xuống TỪNG BƯỚC nếu công cụ hỗ trợ; nếu không thì gắn vào run
    for (const f of c.evidence || []) {
      if (!fs.existsSync(f)) { console.warn(`  ${c.id}: bỏ qua bằng chứng không tồn tại ${f}`); continue; }
      const form = new FormData();
      form.append('file', new Blob([fs.readFileSync(f)]), path.basename(f));
      await fetch(`${base}/api/runs/${run.id}/attachments`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form
      });
    }
    ok++;
  }
  console.log(`\n[day-ket-qua] đã đẩy ${ok}/${cases.length} run vào cycle ${cycle.id}`);
}
main().catch((e) => { console.error('[day-ket-qua] lỗi: ' + e.message); process.exit(1); });
```

> Để ý: gate chất lượng đứng ngay trong đường publish, không chỉ ở lệnh tự soi. Lý do thực dụng: người ta
> bỏ qua lệnh tự soi rồi đẩy thẳng, và nếu gate chỉ ở một cửa thì không gì cản. Cùng một luật, hai cửa,
> và luật dùng chung một module để không trôi.

## Việc 6 — Đối soát độ tươi trước khi execute

Bài 13 mục 5 đã chốt: khi execute thì công cụ test-management là canonical. Nên trước khi chạy, kéo bản mới
nhất về, và **kiểm** bản sao đang có có cũ không.

```js
#!/usr/bin/env node
/* kiem-do-tuoi.js — bản sao testcase local có cũ hơn công cụ không. --enforce thì chặn. */
'use strict';
const fs = require('fs');
const ENFORCE = process.argv.includes('--enforce');
const manifest = 'outputs/demo/tasks/' + process.env.MA_TASK + '/test-cases/from-tms/manifest.json';

if (!fs.existsSync(manifest)) {
  console.error('[do-tuoi] KHÔNG ĐO ĐƯỢC: chưa có bản sao local. Chạy `npm run tms:pull` trước.');
  process.exit(2);
}
const local = JSON.parse(fs.readFileSync(manifest, 'utf8'));
const base = process.env.TMS_BASE_URL, token = process.env.TMS_API_TOKEN;

async function main() {
  // MỘT lệnh list cho cả bộ — đừng gọi từng case, 500 case là 500 request
  const r = await fetch(`${base}/api/cases?story=${encodeURIComponent(local.story)}&fields=automationKey,updatedDate`,
    { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) { console.error('[do-tuoi] KHÔNG ĐO ĐƯỢC: API trả ' + r.status); process.exit(2); }
  const xa = await r.json();

  const cu = [];
  for (const c of xa) {
    const t = local.cases[c.automationKey];
    if (!t) { cu.push(`${c.automationKey}: có trên công cụ mà bản sao local KHÔNG có`); continue; }
    if (new Date(c.updatedDate) > new Date(t)) cu.push(`${c.automationKey}: công cụ mới hơn bản sao local`);
  }

  console.log(`[do-tuoi] ${xa.length} case trên công cụ · bản sao local từ ${local.pulledAt}`);
  if (!cu.length) { console.log('[do-tuoi] ✓ bản sao còn tươi'); return; }

  console.error(`\n[do-tuoi] ${ENFORCE ? '✗ CHẶN' : '⚠ CẢNH BÁO'} — ${cu.length} case lệch:`);
  for (const c of cu.slice(0, 15)) console.error('  - ' + c);
  console.error('\nChạy trên bản sao cũ nghĩa là CHẤM THEO kết quả mong đợi ĐÃ BỊ SỬA. Chạy `npm run tms:pull`.');
  process.exit(ENFORCE ? 1 : 0);
}
main().catch((e) => { console.error('[do-tuoi] lỗi: ' + e.message); process.exit(1); });
```

## Thực hành (75 phút)

### Bước 1 — Khảo sát công cụ của bạn (10 phút)

Trước khi viết mã, trả lời bằng cách đọc tài liệu API của công cụ test-management đang dùng:

| Câu hỏi | Trả lời |
|---|---|
| Có API xoá case không? | |
| Trường nào là khoá để đối chiếu với `TC ID` của tôi? | |
| Thang `Ưu tiên` của nó là gì? Có khớp thang của tôi? | |
| Có chặn tần suất gọi không? Bao nhiêu? | |
| Evidence gắn vào **run** hay vào **từng bước**? | |

Câu 3 là câu hay gây mất mát nhất, xem mục 4.

### Bước 2 — Publish dry-run (15 phút)

Viết `publish-testcase.js`. Chạy **dry-run** trên bộ case của bạn và đọc payload xem trước:

- `automationKey` có đúng `TC ID`?
- `steps` ghép đúng cặp action ↔ expected? (đây là chỗ hay lệch một dòng)
- `folder` có đúng module?

Sửa mapping cho tới khi payload đúng. **Chưa `--apply`.**

### Bước 3 — Publish thật rồi đối soát (20 phút)

Đẩy **5 case** trước (không phải cả bộ):

```bash
npm run tms:publish -- --file <tc.md> --story <KEY> --apply --qa-approved
npm run tms:verify-fields -- --file <tc.md>
```

Nếu đối soát báo lệch. Đây là thu hoạch chính của bài. Ghi lại:

| Trường | Nguồn | Công cụ | Nguyên nhân |
|---|---|---|---|

Rồi sửa **mapping**, đẩy lại, đối soát lại tới khi ĐẠT. Xong mới đẩy cả bộ.

### Bước 4 — Đẩy kết quả (15 phút)

Viết `day-ket-qua.js`. Chạy dry-run, rồi `--apply`. Mở công cụ ra kiểm bằng mắt:

- Cycle có đúng tên?
- Trạng thái từng run có đúng ánh xạ?
- **Bằng chứng có mở được** từ giao diện công cụ?

Rồi thử ca xấu: xoá `evidence` của một case rồi đẩy lại, nó phải **bị `gate-bang-chung` chặn**.

### Bước 5 — Slash command (10 phút)

Viết `.claude/commands/phase2.md` cho đúng trình tự của bạn. Rồi thử: mở phiên mới, gõ `/phase2 PROJ-1234`,
xem agent có nạp đúng file và chạy đúng thứ tự gate không.

### Bước 6 — Commit

```bash
git add scripts/qa .agent/config/mcp_config.md .claude/commands package.json
git commit -m "feat(tms): publish có dry-run 2 cờ + đối soát TỪNG TRƯỜNG + đẩy kết quả thành cycle

2xx không chứng minh mapping đúng ⇒ doi-soat-truong là bước BẮT BUỘC sau publish.
Gate chất lượng đứng ở CẢ hai cửa: lệnh tự soi và đường publish."
```

---

## Gọi tên những gì bạn vừa làm

| Từ | Nghĩa gọn |
|---|---|
| **Dry-run** | Chạy thử để xem sẽ gửi đi cái gì, nhưng chưa gửi thật |
| **Đối soát trường** | Đọc lại từ công cụ rồi so từng ô với nguồn. API trả 200 không thay được bước này |
| **Cycle** | Một lượt chạy được ghi lại trên công cụ, có lịch sử riêng |

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .agent/config/
│   └── mcp_config.md             ← MỚI · một cửa vào cho dữ liệu ngoài, quyền tối thiểu
├── .claude/commands/
│   ├── phase1.md                 ← MỚI · gõ `/phase1 <MÃ>`
│   └── phase2.md                 ← MỚI · nạp đúng file + đúng THỨ TỰ gate
└── scripts/qa/
    ├── publish-testcase.js       ← MỚI · mặc định DRY-RUN, cần 2 cờ mới ghi thật
    ├── doi-soat-truong.js        ← MỚI · BẮT BUỘC sau publish (2xx không chứng minh gì)
    ├── day-ket-qua.js            ← MỚI · một lượt chạy = một cycle có lịch sử
    └── kiem-do-tuoi.js           ← MỚI · bản sao local cũ hơn công cụ ⇒ chặn
```

## Bộ kit của bạn đang ở đâu

```
CẤP ĐỘ 3 · CONTROL      bài 7/9 của cấp độ này
██████████████████████░░░░░░

cả tài liệu           bài 18/29
█████████████████░░░░░░░░░░░
```

**Hết cấp độ 3 bạn nói được:** Tôi có một QA workflow được enforce trong team.

Cấp độ này còn 2 bài nữa.

## Tự kiểm

- [ ] Tôi biết công cụ của mình có API xoá hay không, và điều đó đổi cách tôi làm thế nào.
- [ ] Publish của tôi mặc định **dry-run**, và cần **hai** cờ mới ghi thật.
- [ ] Publish kiểm cấu trúc bộ case trước khi đẩy.
- [ ] Tôi đã chạy đối soát từng trường và đọc kết quả, không chỉ tin `2xx`.
- [ ] Khi lệch, tôi sửa **mapping**, không sửa nguồn cho vừa công cụ.
- [ ] Ánh xạ trạng thái đọc từ **taxonomy**, không hardcode trong script đẩy.
- [ ] Gate chất lượng đứng ở **cả hai** cửa, và dùng chung một module.
- [ ] Tôi đã mở công cụ ra kiểm bằng chứng có mở được từ giao diện.
- [ ] Kiểm độ tươi chặn được ca bản sao local cũ hơn công cụ.
- [ ] Slash command của tôi nạp đúng file và đúng thứ tự gate.

## Bài tập về nhà

Với bộ case **thật** đã publish của dự án bạn (nếu có), chạy đối soát từng trường lên **toàn bộ** và đếm:

1. Bao nhiêu case lệch ít nhất một trường?
2. Trường nào lệch nhiều nhất?

Nếu câu 2 là `Ưu tiên` hoặc một trường có thang giá trị. Gần như chắc chắn thang của bạn không khớp thang
công cụ, và đó là lỗi **im lặng** đã tồn tại từ lượt publish đầu tiên.

## Đọc thêm

- Bài 25 là bài trọng tâm của cả tài liệu: giờ bạn đã có suite chạy nhiều lượt, **đo được** năng lực phát hiện
  của nó.
- [`scripts/integrations/aio/README.md`](../../scripts/integrations/aio/README.md) của kit này, tầng tích hợp
  đầy đủ với một công cụ thật.

## Bài sau

Bài 19 đi nốt đoạn cuối: từ một phát hiện đã qua triage tới một bug mà Dev đọc là làm được, không
phải hỏi lại.
