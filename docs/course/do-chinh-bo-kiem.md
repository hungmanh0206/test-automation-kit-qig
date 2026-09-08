# Bài 21 — Mutation Testing: đo suite có bắt được bug không ⭐

> **3 giờ** · Có gì trong tay: suite đã chạy nhiều lượt, có evidence, có lịch sử · Sau bài này: bạn biết bộ kiểm của mình **bắt được bao nhiêu phần trăm** lỗi thật — bằng số, không bằng cảm giác

Đây là bài trọng tâm của cả tài liệu. Mười tám bài trước dựng ra một bộ kiểm. Bài này trả lời câu hỏi mà không ai
hỏi cho tới khi đã muộn: **bộ kiểm đó có bắt được lỗi không?**

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Cả bộ pass hết. Nhưng không biết là app đúng hay bộ kiểm của bạn không nhìn thấy gì. |
| **Bài này bạn gõ gì** | Cố tình làm sai dữ liệu app trả về, rồi đếm xem suite có đỏ lên không. |
| **Xong thì được gì** | Có con số cho biết bộ kiểm bắt được bao nhiêu phần trăm. Đây là bài quan trọng nhất. |

## Từ mới của bài này

| Từ | Nghĩa gọn |
|---|---|
| **Tiêm lỗi** | Cố tình làm sai dữ liệu app trả về, để xem suite có đỏ lên không |
| **Mutant sống sót** | Bạn làm app sai mà suite vẫn xanh. Nghĩa là suite không nhìn thấy lỗi đó |
| **Đối chứng** | Thử một ca biết chắc kết quả, để biết máy đo có hoạt động không |

## Bài này bạn sẽ làm gì

Sáu việc:

1. Hiểu vì sao câu "toàn bộ case PASS" gần như không nói lên điều gì (20 phút).
2. Viết máy tiêm lỗi vào app đang chạy, rồi đếm suite có đỏ không (45 phút).
3. Đọc điểm 0 cho đúng. Nó không có nghĩa suite của bạn tệ (25 phút).
4. Nhận ba cái bẫy của chính máy đo, bẫy nào cũng cho ra số đẹp giả (30 phút).
5. Mở 5 hướng quanh mỗi case, và biết khi nào không được kết luận (30 phút).
6. Chốt luật: bug do người ngoài tìm ra là lỗi của máy (30 phút).

---

## 1. "Toàn bộ 120 case PASS" nghĩa là gì?

Nó nghĩa là **một** trong hai điều, và bạn không phân biệt được:

| Khả năng | Xác suất thực tế |
|---|---|
| Ứng dụng đúng, và suite của bạn đủ nhạy để phát hiện nếu nó sai | ? |
| Suite của bạn **không nhạy** — nó sẽ xanh dù ứng dụng sai | ? |

Xanh là **cùng một dấu hiệu** cho cả hai. Đây chính là vấn đề đã bàn ở Bài 10 (oracle tautology) nhưng ở
tầm **cả bộ**: bạn không đo được năng lực phát hiện của bộ kiểm bằng cách chạy nó trên ứng dụng đúng.

Câu chuyện quen thuộc: suite xanh suốt sprint, rồi một QA khác (hoặc khách) tìm ra bug ở đúng luồng suite đã
"phủ". Câu hỏi đúng lúc đó **không** phải "sao dev để lọt", mà là:

> Case nào lẽ ra phải đỏ mà lại xanh, và vì sao nó xanh?

## 2. Cách duy nhất để đo: làm ứng dụng sai có kiểm soát

Nguyên tắc đến từ **mutation testing** trong kiểm thử đơn vị, nhưng ở đây ta không đổi mã nguồn ứng dụng (ta
không có quyền, và không nên). Ta **can thiệp ở tầng mạng**: dùng `page.route()` của Playwright để sửa response
trên đường về trình duyệt.

```
Trình duyệt  ←─── response ĐÃ SỬA ─── page.route()  ←─── response thật ─── Backend
```

Ứng dụng thật vẫn nguyên. Nhưng với **trình duyệt** thì nó đang trả sai. Nếu case của bạn không đỏ, case của
bạn sẽ **không** phát hiện được đúng lỗi đó khi nó xảy ra thật.

Một mutant = một cách làm sai cụ thể. Bốn họ mutant đáng tiêm nhất, xếp theo giá trị:

| Họ | Tiêm gì | Lỗi thật tương ứng |
|---|---|---|
| **Giá trị** | Đổi một số trong response (`total`, `amount`) | Sai công thức, sai làm tròn, sai đơn vị |
| **Trường** | Xoá một trường, hoặc đổi tên nó | Backend đổi hợp đồng, mapping BE↔FE lệch |
| **Trạng thái** | Đổi `status`/`enum` sang giá trị khác | Sai chuyển trạng thái, sai điều kiện hiển thị |
| **Hình dạng** | Trả mảng rỗng, trả `null`, trả bớt một phần tử | Không xử lý ca rỗng, phân trang sai |

## 3. Máy tiêm lỗi

`.agent/config/mutants.json`. Mutant khai bằng **dữ liệu**, không hardcode trong mã:

```json
{
  "$schema": "danh mục mutant. Mỗi mutant = một cách làm ứng dụng sai có kiểm soát.",
  "mutants": [
    {
      "id": "M01-total-lech",
      "ho": "gia-tri",
      "urlPattern": "**/api/v1/orders/*",
      "sua": [{ "duong": "data.total_amount", "phepBien": "cong", "luong": 1000 }],
      "moTa": "Tổng tiền lệch 1.000đ — mô phỏng sai làm tròn hoặc sai công thức",
      "caseKyVong": ["TC_012", "TC_013", "TC_045"]
    },
    {
      "id": "M02-xoa-truong-cccd",
      "ho": "truong",
      "urlPattern": "**/api/v1/contacts/*",
      "sua": [{ "duong": "data.identity_number", "phepBien": "xoa" }],
      "moTa": "Backend bỏ trường CCCD — mô phỏng đổi hợp đồng không thông báo",
      "caseKyVong": ["TC_021"]
    },
    {
      "id": "M03-trang-thai-sai",
      "ho": "trang-thai",
      "urlPattern": "**/api/v1/orders/*",
      "sua": [{ "duong": "data.status", "phepBien": "dat", "giaTri": "DRAFT" }],
      "moTa": "Đơn đã thanh toán mà trả DRAFT — mô phỏng sai chuyển trạng thái",
      "caseKyVong": ["TC_030", "TC_031"]
    },
    {
      "id": "M04-danh-sach-rong",
      "ho": "hinh-dang",
      "urlPattern": "**/api/v1/orders?*",
      "sua": [{ "duong": "data.items", "phepBien": "dat", "giaTri": [] }],
      "moTa": "Danh sách rỗng trong khi phải có bản ghi",
      "caseKyVong": ["TC_005", "TC_006"]
    },
    {
      "id": "M05-bot-mot-phan-tu",
      "ho": "hinh-dang",
      "urlPattern": "**/api/v1/orders?*",
      "sua": [{ "duong": "data.items", "phepBien": "botCuoi" }],
      "moTa": "Thiếu một bản ghi — lỗi phân trang hay gặp và RẤT hay lọt",
      "caseKyVong": ["TC_005"]
    }
  ]
}
```

> `caseKyVong` là **dự đoán của bạn** về case nào phải đỏ. Nó có giá trị riêng: khi máy chạy xong, so dự đoán
> với thực tế cho bạn biết bạn **hiểu sai suite của mình ở đâu**.

`scripts/qa/tiem-loi.js`:

```js
#!/usr/bin/env node
/*
 * tiem-loi.js — đo năng lực phát hiện của suite bằng cách tiêm lỗi có kiểm soát.
 *
 * CÁCH ĐO: với mỗi mutant, chạy lại suite (hoặc tập case liên quan) với MUTANT=<id>.
 *   Suite ĐỎ  ⇒ mutant BỊ DIỆT   ⇒ suite phát hiện được lỗi loại này ✓
 *   Suite XANH ⇒ mutant SỐNG SÓT ⇒ suite MÙ với lỗi loại này ✗
 *
 * Điểm = số mutant bị diệt / tổng số mutant.
 *
 * BẮT BUỘC CHẠY TRÊN LƯỢT NỀN XANH: nếu suite đã đỏ từ trước thì mọi mutant đều "bị diệt" giả.
 * Đây là bẫy số 1 ở mục 5.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CAU_HINH = '.agent/config/mutants.json';
const args = process.argv.slice(2);
const lay = (t) => { const i = args.indexOf(t); return i >= 0 ? args[i + 1] : null; };
const chiMot = lay('--mutant');
const grep = lay('--grep');
const raDir = lay('--out') || 'outputs/mutation';

if (!fs.existsSync(CAU_HINH)) {
  console.error('[tiem-loi] KHÔNG ĐO ĐƯỢC: thiếu ' + CAU_HINH);
  process.exit(2);
}
const { mutants } = JSON.parse(fs.readFileSync(CAU_HINH, 'utf8'));
const chon = chiMot ? mutants.filter((m) => m.id === chiMot) : mutants;
if (!chon.length) { console.error('[tiem-loi] không có mutant nào khớp'); process.exit(2); }

/** Chạy suite một lượt. Trả về { do, soFail, soPass, tongKetQua } — hoặc null nếu KHÔNG ĐO ĐƯỢC. */
function chayMotLuot(env, nhan) {
  const ketQuaFile = path.join(raDir, `results-${nhan}.json`);
  fs.mkdirSync(raDir, { recursive: true });

  const pwArgs = ['playwright', 'test', '--reporter=json'];
  if (grep) pwArgs.push('--grep', grep);

  const r = spawnSync('npx', pwArgs, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      ...env,
      // Mutation run KHÔNG được thử lại — thử lại làm nhoè tín hiệu: case đỏ ở lượt 1
      // rồi xanh ở lượt 2 sẽ được báo là PASS và mutant sống sót GIẢ.
      PW_RETRIES: '0',
      // Mutation run KHÔNG ghi evidence và KHÔNG đẩy kết quả đi đâu — nó không phải lượt chạy thật
      MUTATION_RUN: '1'
    }
  });

  let bao = null;
  try { bao = JSON.parse(r.stdout); }
  catch { /* reporter json không ra được — có thể suite crash trước khi chạy */ }

  if (!bao) {
    console.error(`  KHÔNG ĐO ĐƯỢC lượt "${nhan}": reporter json không đọc được`);
    console.error('  ' + (r.stderr || '').split('\n').slice(0, 5).join('\n  '));
    return null;
  }
  fs.writeFileSync(ketQuaFile, JSON.stringify(bao, null, 2));

  const ketQua = [];
  const diQua = (specs) => {
    for (const s of specs || []) {
      for (const t of s.tests || []) {
        const r0 = (t.results || [])[t.results.length - 1] || {};
        ketQua.push({ ten: s.title, trangThai: r0.status });
      }
    }
  };
  const duyet = (suites) => { for (const s of suites || []) { diQua(s.specs); duyet(s.suites); } };
  duyet(bao.suites);

  const soFail = ketQua.filter((k) => k.trangThai === 'failed' || k.trangThai === 'timedOut').length;
  const soPass = ketQua.filter((k) => k.trangThai === 'passed').length;
  return { do: soFail > 0, soFail, soPass, tongKetQua: ketQua };
}

/* ── BƯỚC 1: lượt nền. Không có nền xanh thì phép đo vô nghĩa ───────────────── */
console.log('[tiem-loi] BƯỚC 1 — lượt nền (không tiêm gì). Nền phải XANH.');
const nen = chayMotLuot({}, 'baseline');
if (!nen) process.exit(2);
console.log(`  nền: ${nen.soPass} pass · ${nen.soFail} fail`);

if (nen.do) {
  console.error('\n[tiem-loi] ✗ KHÔNG ĐO ĐƯỢC — lượt nền đã ĐỎ.');
  console.error('  Suite đang đỏ từ trước thì MỌI mutant đều "bị diệt" và điểm sẽ là 100% GIẢ.');
  console.error('  Case đỏ ở nền: ' +
    nen.tongKetQua.filter((k) => k.trangThai !== 'passed').map((k) => k.ten).slice(0, 8).join(' · '));
  console.error('  Sửa nền cho xanh, hoặc --grep vào tập case đang xanh, rồi đo lại.');
  process.exit(2);
}
if (nen.soPass === 0) {
  console.error('\n[tiem-loi] ✗ KHÔNG ĐO ĐƯỢC — nền xanh nhưng 0 case chạy.');
  console.error('  Suite rỗng cũng "xanh". Kiểm --grep hoặc cấu hình testMatch.');
  process.exit(2);
}

/* ── BƯỚC 2: từng mutant ───────────────────────────────────────────────────── */
const bang = [];
for (const m of chon) {
  console.log(`\n[tiem-loi] BƯỚC 2 — ${m.id} (${m.ho}): ${m.moTa}`);
  const kq = chayMotLuot({ MUTANT: m.id }, m.id);

  if (!kq) { bang.push({ ...m, ketCuc: 'KHONG_DO_DUOC' }); continue; }

  // Bẫy số 2: mutant có thật sự được TIÊM không? Xem mục 5.
  const daTiem = fs.existsSync(path.join(raDir, `tiem-${m.id}.flag`));
  if (!daTiem) {
    console.error('  ⚠ KHÔNG ĐO ĐƯỢC: không có dấu vết mutant được áp dụng.');
    console.error('    urlPattern có khớp request nào không? Ứng dụng có gọi API đó trong tập case này không?');
    bang.push({ ...m, ketCuc: 'KHONG_DO_DUOC' });
    continue;
  }

  const doDo = kq.tongKetQua.filter((k) => k.trangThai !== 'passed').map((k) => k.ten);
  const ketCuc = kq.do ? 'BI_DIET' : 'SONG_SOT';
  console.log(`  ${ketCuc === 'BI_DIET' ? '✓ BỊ DIỆT' : '✗ SỐNG SÓT'} — ${kq.soFail} case đỏ`);
  if (doDo.length) console.log('    đỏ: ' + doDo.slice(0, 6).join(' · '));
  bang.push({ ...m, ketCuc, caseDo: doDo });
}

/* ── BƯỚC 3: bảng điểm ─────────────────────────────────────────────────────── */
const diet = bang.filter((b) => b.ketCuc === 'BI_DIET');
const song = bang.filter((b) => b.ketCuc === 'SONG_SOT');
const mu = bang.filter((b) => b.ketCuc === 'KHONG_DO_DUOC');
const doDuoc = diet.length + song.length;

console.log('\n' + '─'.repeat(70));
console.log(`[tiem-loi] ĐIỂM: ${diet.length}/${doDuoc} mutant bị diệt` +
  (doDuoc ? ` (${Math.round((diet.length / doDuoc) * 100)}%)` : ''));
if (mu.length) console.log(`  ${mu.length} mutant KHÔNG ĐO ĐƯỢC — không tính vào mẫu số`);

if (song.length) {
  console.log(`\n  ${song.length} MUTANT SỐNG SÓT — suite MÙ với các lỗi này:`);
  for (const s of song) {
    console.log(`  ✗ ${s.id} — ${s.moTa}`);
    console.log(`     bạn dự đoán ${(s.caseKyVong || []).join(', ') || '(không dự đoán)'} sẽ đỏ. Nó đã KHÔNG đỏ.`);
  }
}

// So dự đoán với thực tế — chỗ này nói bạn HIỂU SAI suite của mình ở đâu
const lechDuDoan = diet.filter((d) =>
  (d.caseKyVong || []).length && !(d.caseKyVong || []).some((k) => (d.caseDo || []).some((t) => t.includes(k))));
if (lechDuDoan.length) {
  console.log(`\n  ${lechDuDoan.length} mutant bị diệt bởi case KHÁC với dự đoán:`);
  for (const l of lechDuDoan) {
    console.log(`  · ${l.id}: dự đoán ${l.caseKyVong.join(', ')} · thực tế ${(l.caseDo || []).slice(0, 3).join(' · ')}`);
  }
  console.log('    Nghĩa là case bạn TƯỞNG phủ lỗi này thì không phủ. Đọc lại oracle của nó.');
}

fs.writeFileSync(path.join(raDir, 'diem.json'), JSON.stringify({
  ngay: new Date().toISOString(), nen: { soPass: nen.soPass }, bang,
  diem: doDuoc ? diet.length / doDuoc : null
}, null, 2));
console.log(`\nBảng đầy đủ: ${path.join(raDir, 'diem.json')}`);
```

Và phần **áp dụng** mutant, nằm trong fixture của Playwright:

```js
// tests/support/fixtures/mutant.js
/*
 * Fixture áp mutant. Chỉ hoạt động khi có biến MUTANT — lượt chạy thật không bị ảnh hưởng.
 *
 * GHI DẤU VẾT: mỗi lần thật sự sửa được một response thì ghi một file cờ. Máy đo đọc cờ đó để phân biệt
 * "mutant tiêm rồi mà suite vẫn xanh" (SỐNG SÓT — tin cậy) với "mutant chưa tiêm được" (KHÔNG ĐO ĐƯỢC).
 * Thiếu phân biệt này, mọi mutant không khớp URL sẽ bị báo là SỐNG SÓT và điểm sẽ THẤP GIẢ.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const CAU_HINH = '.agent/config/mutants.json';

function layDuong(o, duong) {
  return duong.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
}
function datDuong(o, duong, giaTri) {
  const ks = duong.split('.');
  const cuoi = ks.pop();
  const cha = ks.reduce((a, k) => (a == null ? a : a[k]), o);
  if (cha == null) return false;
  if (giaTri === undefined) delete cha[cuoi]; else cha[cuoi] = giaTri;
  return true;
}

function apDung(body, sua) {
  let daSua = false;
  for (const s of sua) {
    const cu = layDuong(body, s.duong);
    if (cu === undefined && s.phepBien !== 'dat') continue;   // không có trường thì không sửa được
    let moi;
    if (s.phepBien === 'cong') moi = Number(cu) + s.luong;
    else if (s.phepBien === 'dat') moi = s.giaTri;
    else if (s.phepBien === 'xoa') moi = undefined;
    else if (s.phepBien === 'botCuoi') moi = Array.isArray(cu) ? cu.slice(0, -1) : cu;
    else throw new Error('phép biến lạ: ' + s.phepBien);
    if (datDuong(body, s.duong, moi)) daSua = true;
  }
  return daSua;
}

/** Gắn vào page. Gọi ở fixture chung, TRƯỚC mọi điều hướng. */
async function ganMutant(page) {
  const id = process.env.MUTANT;
  if (!id) return;                                  // lượt chạy thật: không làm gì

  const { mutants } = JSON.parse(fs.readFileSync(CAU_HINH, 'utf8'));
  const m = mutants.find((x) => x.id === id);
  if (!m) throw new Error(`SETUP: MUTANT=${id} không có trong ${CAU_HINH}`);

  const raDir = process.env.MUTATION_OUT || 'outputs/mutation';
  fs.mkdirSync(raDir, { recursive: true });

  await page.route(m.urlPattern, async (route) => {
    const res = await route.fetch();                // gọi backend THẬT rồi sửa trên đường về
    const ct = res.headers()['content-type'] || '';
    if (!ct.includes('json')) { await route.fulfill({ response: res }); return; }

    let body;
    try { body = await res.json(); }
    catch { await route.fulfill({ response: res }); return; }

    if (apDung(body, m.sua)) {
      fs.writeFileSync(path.join(raDir, `tiem-${id}.flag`), route.request().url());
    }
    await route.fulfill({ response: res, body: JSON.stringify(body) });
  });
}

module.exports = { ganMutant, apDung };
```

Trong fixture chung:

```js
// tests/support/fixtures/index.js
const base = require('@playwright/test');
const { ganMutant } = require('./mutant');

exports.test = base.test.extend({
  page: async ({ page }, use) => {
    await ganMutant(page);      // vô hiệu khi không có MUTANT
    await use(page);
  }
});
exports.expect = base.expect;
```

## 4. Đọc điểm cho đúng

Đây là chỗ dễ kết luận sai nhất.

### Điểm 0/5 — "suite của tôi tệ"?

**Chưa chắc.** Bốn lý do khiến điểm 0 mà suite vẫn tốt:

| Lý do | Cách phân biệt |
|---|---|
| Mutant chưa được tiêm | File cờ `tiem-*.flag` không có ⇒ máy đã báo KHÔNG ĐO ĐƯỢC, không phải 0 |
| Tập case chạy không đi qua API đó | Chạy `--grep` vào đúng case liên quan rồi đo lại |
| Ứng dụng **không dùng** trường bạn tiêm | Đây là thu hoạch: trường đó có thể là trường chết |
| Mutant quá nhỏ để nhìn thấy | Cộng 1.000đ vào tổng 50 triệu mà UI làm tròn về triệu ⇒ không sai được |

Chỉ khi cả bốn đã loại thì điểm 0 mới nghĩa là **suite mù**. Đây là ứng dụng trực tiếp của luật ở Bài 11:
**KHÔNG ĐO ĐƯỢC không phải là ĐẠT, cũng không phải là VI PHẠM.**

### Điểm 5/5 — "suite của tôi hoàn hảo"?

**Không.** Nó nghĩa là suite bắt được **5 loại lỗi bạn nghĩ ra**. Điểm mutation đo được **năng lực phát hiện
trên tập mutant của bạn** — không hơn. Tập mutant nghèo cho điểm đẹp.

Nên khi đạt điểm cao, việc tiếp theo **không** phải ăn mừng, mà là **thêm mutant khó hơn**:

- Mutant chỉ sai ở **một** trong nhiều bản ghi (không phải cả danh sách).
- Mutant sai ở **nhánh** ít đi (đơn huỷ, đơn hết hạn, khách không có CCCD).
- Mutant sai **chữ hiển thị** thay vì sai số.
- Mutant sai **thứ tự** phần tử.

### Mutant sống sót là **việc cần làm**, không phải điểm trừ

Mỗi mutant sống sót cho bạn một hành động cụ thể:

```
M05 (thiếu một bản ghi) SỐNG SÓT
  → TC_005 chỉ assert "danh sách không rỗng"
  → sửa oracle: assert đúng SỐ bản ghi kỳ vọng, tính độc lập từ dữ liệu đã dựng
```

Đây là vòng lặp cải thiện có **thước đo**: sửa oracle → đo lại → mutant bị diệt.

## 5. Ba cái bẫy của chính máy đo

Máy đo cũng là mã, và nó cũng sai được. Ba bẫy sau **đều cho ra số đẹp giả** — nên chúng nguy hiểm hơn lỗi làm
máy crash.

### Bẫy 1 — nền đỏ ⇒ 100% giả

Nếu suite đã có 3 case đỏ từ trước, thì mọi lượt mutant cũng đỏ, và **mọi** mutant được tính là "bị diệt".
Điểm 100%. Hoàn toàn vô nghĩa.

Máy ở trên chặn bằng cách chạy lượt nền trước và **exit 2** nếu nền đỏ. Đây không phải cẩn thận thừa, đó là
cách đo này chết đi lặng lẽ trong thực tế.

### Bẫy 2 — mutant không tiêm được ⇒ điểm thấp giả

`urlPattern` viết `**/api/orders/*` mà thực tế API là `/api/v1/orders/*` thì `page.route()` không khớp request
nào. Response về nguyên. Suite xanh. Máy báo **SỐNG SÓT**. Bạn đi sửa oracle cho một lỗi chưa từng xảy ra.

Máy ở trên chặn bằng **file cờ**: chỉ khi thật sự sửa được một response mới ghi cờ. Không cờ ⇒ KHÔNG ĐO ĐƯỢC,
và **không tính vào mẫu số**.

### Bẫy 3 — `retries` bật ⇒ mutant sống sót giả

Playwright cấu hình `retries: 2` sẽ chạy lại case đỏ. Với case đỏ vì mutant thì lượt lại **cũng đỏ** — nên bẫy
này không cắn ở đây. Nhưng nó cắn ở chỗ khác: reporter json ghi kết quả **cuối cùng**, và nếu case đỏ vì mutant
mà lượt cuối lại xanh do một lý do khác (dữ liệu đổi giữa các lượt, cache), thì mutant được báo là sống sót.

Máy ở trên đặt `PW_RETRIES: '0'` cho mọi lượt mutation. Mutation run **không** cần chống nhoè, nó cần tín hiệu
sạch.

> Ba bẫy này là ví dụ hoàn hảo cho luật ở Bài 28: **máy nào cũng phải có đối chứng âm**. Trước khi tin điểm
> mutation, hãy tiêm một mutant mà bạn **biết chắc** suite bắt được, và xem máy có báo BỊ DIỆT không. Nếu
> không, máy sai, không phải suite sai.

### Đối chứng âm cho chính máy đo

```bash
# Mutant "chắc chắn bị diệt": phá thẳng trường mà case đang assert
node scripts/qa/tiem-loi.js --mutant M03-trang-thai-sai --grep "TC_030"
# Kỳ vọng: BỊ DIỆT. Nếu ra SỐNG SÓT hoặc KHÔNG ĐO ĐƯỢC ⇒ máy đo hỏng, dừng lại sửa máy.
```

## 6. Mở rộng 5 trục: đo cái suite **không** phủ

Mutation đo suite trên những gì nó **có**. Còn những gì nó **không có** thì sao?

Khi execute một case, đừng chỉ làm đúng chữ trong case. Mở **5 trục** quanh nó:

| Trục | Câu hỏi | Ví dụ |
|---|---|---|
| **1. Field cùng khối** | Các trường khác trong cùng khối/khối form có đúng không? | Case kiểm `Tổng tiền` → kiểm cả `Đã trả`, `Còn lại`, `Phí` |
| **2. Cùng giá trị, khác màn** | Giá trị này còn hiện ở màn nào nữa? Có khớp? | `Tổng tiền` ở màn chi tiết vs ở lưới danh sách vs ở email |
| **3. Chuỗi form → payload → API → UI** | Nhập gì → gửi gì → lưu gì → hiện gì? Có tầng nào biến đổi? | Nhập `1.000.000` → payload `1000000` → API trả `1000000.00` → UI `1.000.000 ₫` |
| **4. Nhánh** | Nhánh khác của cùng luật thì sao? | Case kiểm đơn mới → còn đơn gia hạn, đơn chuyển đổi, đơn huỷ? |
| **5. Trạng thái kế cận** | Trạng thái ngay trước/sau thì hành vi có đúng? | Đơn `PENDING` cho sửa → `PAID` có chặn sửa? `CANCELLED`? |

### Luật quan trọng nhất của mục này

> Kết quả mở rộng chỉ được PASS/FAIL khi có neo oracle (`BR-`, `SM-`, `UI-`…).
> Không có neo thì nó là `OBSERVATION`, không phải kết luận.

Vì sao luật này tồn tại: mở rộng trục 2 thấy màn A hiện `1.000.000` và màn B cũng hiện `1.000.000` — **nhất
quán**. Rất dễ ghi PASS. Nhưng nếu spec nói cả hai phải là `1.100.000` (có phí) thì hai màn **cùng sai** và bạn
vừa ghi PASS cho một bug.

**Nhất quán không phải là bằng chứng của đúng.** Nó chỉ là bằng chứng của cùng-một-nguồn.

```js
#!/usr/bin/env node
/*
 * gate-mo-rong.js — mọi phát hiện mở rộng phải có neo oracle mới được PASS/FAIL.
 *
 * VÌ SAO CẦN MÁY: luật "không neo thì là OBSERVATION" bị vi phạm theo phản xạ — thấy hai màn giống nhau
 * là ghi PASS. Máy này chặn ở cửa ghi kết quả.
 */
'use strict';
const fs = require('fs');
const NEO = /\b(BR|SM|UI|FSD|SPEC)[-_][A-Z0-9-]+/;
const file = process.argv[2];
if (!file || !fs.existsSync(file)) { console.error('[mo-rong] KHÔNG ĐO ĐƯỢC: thiếu file mở rộng'); process.exit(2); }

const ds = JSON.parse(fs.readFileSync(file, 'utf8'));
const TRUC = ['field-cung-khoi', 'cung-gia-tri-khac-man', 'chuoi-form-payload-api-ui', 'nhanh', 'trang-thai-ke-can'];

const loi = [];
for (const p of ds) {
  if (!TRUC.includes(p.truc)) loi.push(`${p.id}: trục lạ "${p.truc}" — phải là một trong ${TRUC.join('|')}`);
  const coNeo = NEO.test(String(p.oracleRef || ''));
  if ((p.ketLuan === 'PASS' || p.ketLuan === 'FAIL') && !coNeo) {
    loi.push(`${p.id}: kết luận ${p.ketLuan} mà KHÔNG có oracle_ref ⇒ phải là OBSERVATION`);
  }
  if (p.ketLuan === 'FAIL' && !p.evidence) loi.push(`${p.id}: FAIL mà không có bằng chứng`);
}

// Độ phủ trục: mở rộng chỉ một trục rồi báo "đã mở rộng" là không đủ
const dem = TRUC.map((t) => ({ t, n: ds.filter((p) => p.truc === t).length }));
console.log('[mo-rong] ' + dem.map((d) => `${d.t}=${d.n}`).join(' · '));
const thieu = dem.filter((d) => d.n === 0).map((d) => d.t);
if (thieu.length >= 3) loi.push(`chỉ mở rộng ${5 - thieu.length}/5 trục — thiếu: ${thieu.join(', ')}`);

if (loi.length) {
  console.error(`\n[mo-rong] ✗ CHẶN — ${loi.length} vấn đề:`);
  for (const l of loi) console.error('  - ' + l);
  console.error('\nNhất quán KHÔNG phải bằng chứng của đúng. Không neo được vào spec thì ghi OBSERVATION.');
  process.exit(1);
}
console.log('[mo-rong] ✓ ĐẠT');
```

## 7. Chiều ngược: `spec:gap`

Năm trục đi từ **case ra ứng dụng**. Còn chiều ngược: từ **ứng dụng ra spec**.

Trong lúc execute, bạn nhìn thấy những thứ **spec không nói gì**:

- Một trường trên UI mà không có dòng nào trong đặc tả.
- Một trạng thái ứng dụng chuyển sang mà tài liệu không liệt kê.
- Một thông báo lỗi mà không ai định nghĩa nội dung.
- Một luật ứng dụng đang áp mà spec im lặng.

Đây **không phải bug** — bạn không có neo để nói nó sai. Nó là `spec:gap`: **lỗ hổng đặc tả**. Và nó có giá trị
cao, vì nó là chỗ bug sẽ sinh ra ở sprint sau.

```json
{
  "id": "GAP-003",
  "loai": "spec:gap",
  "quanSat": "Màn chi tiết đơn có trường 'Mã tham chiếu' hiển thị chuỗi 12 ký tự",
  "specNoiGi": "Không có dòng nào trong FSD 4.1.1 nhắc tới trường này",
  "viSaoQuanTrong": "Không biết ai sinh mã, có duy nhất không, có cần kiểm không ⇒ không kiểm được",
  "evidence": "outputs/.../evidence/GAP-003-ma-tham-chieu.png",
  "hoiAi": "BA",
  "trangThai": "cho-tra-loi"
}
```

Đưa `spec:gap` vào cùng đường ra với bug (Bài 13), nhưng **không** log thành bug. Nó là câu hỏi cho BA.

## 8. Luật cuối: bug do người ngoài tìm ra = lỗi của máy

Đây là luật khép lại toàn bộ tài liệu.

Khi có bug lọt ra ngoài — QA khác tìm ra, hay khách báo. Phản xạ tự nhiên là *"case của tôi không phủ chỗ
đó"*. Luật này bác bỏ phản xạ đó và bắt trả lời:

> Máy nào lẽ ra phải bắt được nó, và vì sao nó không bắt?

Ba câu trả lời hợp lệ, mỗi câu ứng một hành động:

| Câu trả lời | Hành động |
|---|---|
| Có case phủ, nhưng oracle yếu ⇒ nó xanh dù sai | Thêm mutant tái hiện bug này · sửa oracle · đo lại tới khi mutant bị diệt |
| Không có case phủ, và có chiều lẽ ra phải sinh ra case đó | Sửa **máy đếm chiều** (Bài 11) để chiều đó không còn báo đủ |
| Không có case phủ, và không chiều nào chỉ tới nó | Thêm **một chiều mới** vào danh mục chiều |

Câu trả lời **không** hợp lệ: *"tôi sẽ để ý hơn"*. Đó là dặn dò, không phải forcing function (Bài 1).

Ghi lại thành một dòng trong `knowledge/`:

```json
{
  "id": "LEAK-2026-09-01",
  "bug": "PROJ-28236",
  "aiTimRa": "khách",
  "mayLeRaPhaiBat": "TC_045 (oracle chỉ assert khác 0, không assert đúng số)",
  "viSaoKhongBat": "Callback trùng cộng đôi Paid Amount — oracle chấp nhận mọi số > 0",
  "daSua": ["thêm mutant M09-cong-doi", "TC_045 assert đúng số tính độc lập"],
  "mutantXacNhan": "M09-cong-doi BỊ DIỆT sau khi sửa"
}
```

Trường `mutantXacNhan` là điểm quan trọng: sửa xong thì **chứng minh bằng phép đo** rằng lần sau lỗi đó sẽ bị
bắt, không phải bằng lời hứa.

---

## Thực hành (100 phút)

### Bước 1 — Nền xanh trước (10 phút)

```bash
npx playwright test --reporter=line
```

Nếu có case đỏ: sửa, hoặc chọn ra tập case đang xanh và dùng `--grep` cho toàn bộ bài này. **Không đo được
trên nền đỏ.**

### Bước 2 — Khai 5 mutant cho ứng dụng của bạn (20 phút)

Mở DevTools Network trên luồng chính, chọn **một** API response, rồi khai 5 mutant — **một mutant mỗi họ**, cộng
thêm một cái bạn nghĩ suite sẽ mù.

Với mỗi mutant, ghi `caseKyVong` **trước khi chạy**. Đây là dự đoán, và nó sẽ được kiểm.

### Bước 3 — Đối chứng âm cho máy đo (15 phút)

**Trước** khi tin bất cứ số nào: chạy mutant mà bạn chắc chắn bị bắt.

```bash
node scripts/qa/tiem-loi.js --mutant <mutant-de-nhat> --grep "<case-truc-tiep>"
```

Ba kết quả, ba nghĩa:

| Kết quả | Nghĩa | Làm gì |
|---|---|---|
| BỊ DIỆT | Máy đo hoạt động | Đi tiếp |
| KHÔNG ĐO ĐƯỢC | `urlPattern` không khớp | Sửa pattern (mở Network xem URL thật) |
| SỐNG SÓT | Máy đo **hoặc** oracle của case đó hỏng | Kiểm cờ `tiem-*.flag` để biết cái nào |

### Bước 4 — Đo cả bộ (20 phút)

```bash
node scripts/qa/tiem-loi.js
```

Điền bảng:

| Mutant | Dự đoán case đỏ | Thực tế | Kết cục |
|---|---|---|---|
| M01 | | | |
| M02 | | | |
| M03 | | | |
| M04 | | | |
| M05 | | | |

**Điểm: ___/___**

Hai câu hỏi quan trọng hơn con số:

1. Mutant nào **sống sót**? Oracle nào yếu?
2. Mutant nào **bị diệt bởi case khác dự đoán**? Case bạn tưởng phủ nó thì phủ gì?

### Bước 5 — Sửa một oracle rồi đo lại (15 phút)

Chọn **một** mutant sống sót. Sửa oracle của case tương ứng theo Bài 10 (tính độc lập, không app==app). Đo lại
đúng mutant đó:

```bash
node scripts/qa/tiem-loi.js --mutant <id> --grep "<case>"
```

Nó phải chuyển từ SỐNG SÓT sang BỊ DIỆT. Đây là lần đầu bạn **chứng minh** một lần sửa oracle có tác dụng —
thay vì tin là có.

### Bước 6 — Mở rộng 5 trục trên một case (15 phút)

Chọn một case đã PASS. Mở 5 trục quanh nó, ghi vào `mo-rong.json`. Với mỗi phát hiện, tự hỏi:

> Tôi có **neo** được nó vào một dòng spec cụ thể không?

Có → `PASS`/`FAIL` kèm `oracleRef`. Không → `OBSERVATION`. Rồi chạy `gate-mo-rong.js`.

Thử ca xấu: đổi một `OBSERVATION` thành `PASS` rồi xoá `oracleRef`, gate phải **chặn**.

### Bước 7 — Commit

```bash
git add .agent/config/mutants.json scripts/qa/tiem-loi.js scripts/qa/gate-mo-rong.js \
        tests/support/fixtures/mutant.js package.json
git commit -m "feat(mutation): đo năng lực phát hiện của suite bằng tiêm lỗi ở page.route()

Nền đỏ ⇒ exit 2 (không phải 100%). Không có cờ tiêm ⇒ KHÔNG ĐO ĐƯỢC, không vào mẫu số.
Mọi lượt mutation chạy với retries=0 để tín hiệu sạch.
gate-mo-rong: phát hiện không có oracle_ref thì là OBSERVATION, không được PASS/FAIL."
```

---

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .agent/config/
│   └── mutants.json              ← MỚI · mutant khai bằng DỮ LIỆU, không hardcode
├── scripts/qa/
│   ├── tiem-loi.js               ← MỚI · nền đỏ ⇒ exit 2; không có cờ tiêm ⇒ KHÔNG ĐO ĐƯỢC
│   └── gate-mo-rong.js           ← MỚI · phát hiện không có oracle_ref ⇒ OBSERVATION
├── tests/support/fixtures/
│   └── mutant.js                 ← MỚI · sửa response ở page.route(), ghi cờ đã tiêm
└── outputs/mutation/
    └── diem.json                 ← MỚI · mốc so sánh cho lần đo tháng sau
```

`outputs/mutation/diem.json` là **mốc so sánh**: tháng sau đo lại, điểm tụt nghĩa là có oracle vừa bị
làm yếu đi. Đừng để nó trong `.gitignore` nếu bạn muốn so theo thời gian, hoặc lưu nó ra ngoài repo.

## Tự kiểm

- [ ] Tôi giải thích được vì sao "toàn bộ PASS" gần như không mang thông tin.
- [ ] Tôi đã chạy **đối chứng âm cho máy đo** trước khi tin điểm của nó.
- [ ] Máy đo của tôi **exit 2** khi nền đỏ, không cho ra 100% giả.
- [ ] Máy đo phân biệt được **SỐNG SÓT** với **KHÔNG ĐO ĐƯỢC**, bằng dấu vết chứ không bằng suy đoán.
- [ ] Mọi lượt mutation chạy với `retries = 0`.
- [ ] Tôi đọc điểm 0 đúng cách: loại 4 nguyên nhân trước khi kết luận suite mù.
- [ ] Tôi hiểu điểm 5/5 chỉ nói về **tập mutant của tôi**, và biết cách thêm mutant khó hơn.
- [ ] Tôi đã sửa một oracle và **đo lại** để chứng minh nó có tác dụng.
- [ ] Tôi mở được 5 trục quanh một case, và biết trục nào tôi hay bỏ.
- [ ] Tôi phân biệt được `FAIL` với `OBSERVATION` với `spec:gap`.
- [ ] Tôi trả lời được: nếu bug lọt ra ngoài, **máy nào** lẽ ra phải bắt?

## Bài tập về nhà

Lấy **một bug thật** đã lọt ra ngoài trong dự án bạn (có thì tốt; không có thì lấy một bug bất kỳ dev đã fix).
Rồi:

1. Viết một mutant tái hiện **đúng** lỗi đó ở tầng response.
2. Chạy nó trên suite **hiện tại**. Nó sống sót hay bị diệt?
3. Nếu sống sót, sửa oracle tới khi bị diệt.
4. Ghi một dòng `LEAK-*` vào `knowledge/` với `mutantXacNhan`.

Làm xong bốn bước này một lần, bạn có một vòng lặp đóng: **bug lọt → mutant → sửa oracle → chứng minh bằng
phép đo**. Đó là thứ phân biệt một bộ kiểm đang tốt lên với một bộ kiểm chỉ đang chạy.

## Đọc thêm

- Bài 24 khép lại: đưa mọi máy này vào CI, và đóng gói kit để người khác dùng được.
- Bài 10 (oracle) và Bài 11 (KHÔNG ĐO ĐƯỢC) là hai bài mà bài này dựa lên hoàn toàn, nếu mục 4 và mục 5 đọc
  thấy khó thì quay lại hai bài đó.
