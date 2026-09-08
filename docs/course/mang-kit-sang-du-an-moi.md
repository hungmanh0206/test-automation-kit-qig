# Bài 29 — Final Challenge: mang Kit sang một dự án hoàn toàn mới

> **2 giờ 30 phút** · Có gì trong tay: một bản phát hành đã nghiệm thu · Sau bài này: kit chạy trên dự án thật của bạn — lần đầu rời app thực hành

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Dự án thứ hai tới. Bạn sợ phải làm lại từ đầu. |
| **Bài này bạn gõ gì** | Chia ba loại giữ nguyên, sửa cấu hình, viết mới. Viết lại phần đăng nhập. Chạy trọn một vòng. |
| **Xong thì được gì** | Kit chạy trên dự án thật của bạn, và bắt được ít nhất một bug thật ở đó. |

> Bài này có vài từ mới. Chúng được gọi tên ở **cuối bài**, sau khi bạn đã chạm vào chúng,
> chứ không định nghĩa trước. Gặp từ lạ giữa bài thì đọc tiếp, mục đó sẽ gom lại.

## Bài này bạn sẽ làm gì

Bốn việc:

1. Phân ba loại: giữ nguyên · cấu hình · thay (25 phút).
2. **Xây gate** canh ranh giới hai tầng (25 phút).
3. Khớp cơ chế đăng nhập, việc tốn công nhất, luôn luôn (40 phút).
4. Chạy trọn một vòng thật trên dự án bạn (30 phút).

---

## Việc 1 — Ba loại, không phải hai (25 phút)

Người ta hay chia hai: "dùng lại được" và "phải viết mới". Thực tế có **ba**, và loại giữa là loại đông nhất:

| Loại | Là gì | Ví dụ | Công sức |
|---|---|---|---|
| **Giữ nguyên** | mang sang không sửa một chữ | `scripts/lib/**`, mọi máy chặn, `phan-quyet.json`, `tests/support/evidence.js` | 0 |
| **Cấu hình** | giữ mã, đổi dữ liệu khai báo | `chieu-phu.json`, `risk_model.json`, `mutants.json`, `anh-xa-luu-tru.json`, `ci_scope.json` | thấp |
| **Thay** | phải viết mới cho dự án này | đăng nhập, `factory.js`, page object, `tests/e2e/**` | **cao** |

Nhìn theo tỉ lệ thì kit đã trả công: **giữ nguyên** chiếm phần lớn số dòng, **thay** chiếm phần lớn thời gian.

`.agent/config/kit-layers.md`:

```markdown
# Hai tầng của kit

## Tầng CHUNG — dùng lại mọi dự án. SỬA CÓ CÂN NHẮC.

| Đường dẫn | Là gì |
|---|---|
| `scripts/lib/**` | thư viện: đọc/ghi testcase, verdict, khung gate |
| `scripts/qa/**` | máy chặn — không phụ thuộc dự án |
| `scripts/utils/**` | máy tư vấn |
| `.agent/config/phan-quyet.json` | danh mục phán quyết |
| `.agent/config/knowledge-schema.json` | hình dạng bản ghi tri thức |
| `.agent/rules/**` `CLAUDE.md` `LUAT-DAY-DU.md` | luật |
| `prompt_templates/**` `.claude/commands/**` | bản mẫu, điểm vào |
| `tests/support/**` | fixture, evidence, video, cửa tới tầng lưu trữ |

Sửa tầng này ảnh hưởng MỌI task đang chạy. Quy tắc: chỉ sửa khi không có task nào đang mở,
hoặc sửa theo hướng CHỈ THÊM, không đổi hành vi cũ.

## Tầng DỰ ÁN — mỗi dự án tự viết. SỬA THOẢI MÁI.

| Đường dẫn | Là gì |
|---|---|
| `.agent/config/chieu-phu.json` | chiều nào áp cho dự án này |
| `.agent/config/risk_model.json` | trọng số rủi ro của dự án này |
| `.agent/config/mutants.json` | mutant theo API của dự án này |
| `.agent/config/anh-xa-luu-tru.json` | ánh xạ trường của dự án này |
| `.agent/config/ci_scope.json` | lệnh nào chạy ở đâu |
| `tests/e2e/**` `tests/api/**` `tests/smoke/**` | test của dự án này |
| `knowledge/**` | tri thức nghiệp vụ. ⛔ KHÔNG commit |
| `profiles/<TASK>/task.env` | cấu hình từng task. ⛔ KHÔNG commit |

## Kiểm

`npm run layers:check -- --diff` đọc `git diff --name-only` và CẢNH BÁO khi một thay đổi
cắt qua cả hai tầng.
```

## Việc 2 — Gate canh ranh giới (25 phút)

Vì sao cần máy: một commit sửa cả hai tầng là commit không mang đi được. Dự án khác muốn lấy phần chung
thì phải tách tay, và họ sẽ tách sai.

Áp công thức 5 câu hỏi (Bài 15):

| # | | |
|---|---|---|
| 1 | Chặn kiểu sai nào | commit trộn hai tầng ⇒ không tách được để mang đi |
| 2 | Đo cái gì | `git diff --name-only` xếp vào hai tầng theo `kit-layers.md` |
| 3 | Cửa nào | trước khi commit (hoặc ở CI, hạng mọi commit) |
| 4 | Không đo được | không phải repo git, hoặc diff rỗng ⇒ mã 2 |
| 5 | Đối chứng | diff chỉ tầng chung ⇒ qua · chỉ tầng dự án ⇒ qua · **trộn** ⇒ chặn · file lạ ⇒ mã 2 |

```js
#!/usr/bin/env node
/*
 * layers-check.js — một thay đổi không được cắt qua cả tầng CHUNG lẫn tầng DỰ ÁN.
 *
 * VÌ SAO: commit trộn hai tầng thì dự án khác muốn lấy phần chung phải tách tay, và họ tách sai.
 * Tách ra hai commit tốn 30 giây; tách sai tốn một buổi debug ở dự án khác.
 *
 * KHÔNG PHÂN LOẠI ĐƯỢC thì trả mã 2, KHÔNG đoán theo tên — đoán sai làm gate bắt oan,
 * và gate bắt oan thì mất uy tín (Bài 24).
 *
 * Mã thoát: 0 = một tầng · 1 = trộn hai tầng · 2 = không đo được
 */
'use strict';
const { execSync } = require('child_process');

const CHUNG = [
  /^scripts\/(lib|qa|utils)\//,
  /^\.agent\/config\/(phan-quyet|knowledge-schema)\.json$/,
  /^\.agent\/(rules|skills|workflows)\//,
  /^(CLAUDE|LUAT-DAY-DU|README|CHANGELOG)\.md$/,
  /^prompt_templates\//, /^\.claude\/commands\//, /^tests\/support\//,
  /^(package\.json|playwright\.config\.js|\.gitignore)$/, /^\.github\/workflows\//
];
const DU_AN = [
  /^\.agent\/config\/(chieu-phu|risk_model|mutants|anh-xa-luu-tru|ci_scope|env-allow|cold-start-signals|nguong-metrics|vong-doi-du-lieu|mo-rong-truc)\.json$/,
  /^tests\/(e2e|api|smoke|fe|mobile-web)\//, /^knowledge\//, /^profiles\//, /^outputs\//
];
/* Không tính vào phân tầng: tài liệu và artifact — chúng đi kèm cả hai. */
const BO_QUA = [/^docs\//, /^dist\//, /^test-results\//, /^package-lock\.json$/];

let files;
try {
  const dau = process.argv.includes('--staged') ? '--cached' : 'HEAD';
  files = execSync(`git diff --name-only ${dau}`, { encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter(Boolean);
} catch (e) {
  console.error('[layers] KHÔNG ĐO ĐƯỢC: không chạy được git diff — đây có phải repo git?');
  process.exit(2);
}
if (!files.length) {
  console.error('[layers] KHÔNG ĐO ĐƯỢC: không có thay đổi nào để phân tầng.');
  process.exit(2);
}

const chung = [], duAn = [], la = [];
for (const f of files) {
  if (BO_QUA.some((r) => r.test(f))) continue;
  if (CHUNG.some((r) => r.test(f))) chung.push(f);
  else if (DU_AN.some((r) => r.test(f))) duAn.push(f);
  else la.push(f);
}

console.log(`[layers] ${files.length} tệp đổi · CHUNG=${chung.length} · DỰ ÁN=${duAn.length} · chưa phân loại=${la.length}`);

if (la.length) {
  console.error('\n[layers] KHÔNG ĐO ĐƯỢC — chưa phân loại được:');
  for (const f of la) console.error('  - ' + f);
  console.error('\nThêm đường dẫn vào kit-layers.md và vào máy này. ĐỪNG đoán theo tên:');
  console.error('đoán sai làm gate bắt oan, và gate bắt oan thì người ta tắt nó đi.');
  process.exit(2);
}

if (chung.length && duAn.length) {
  console.error('\n[layers] ✗ CHẶN — thay đổi cắt qua CẢ HAI tầng:');
  console.error('  tầng CHUNG:');
  for (const f of chung) console.error('    - ' + f);
  console.error('  tầng DỰ ÁN:');
  for (const f of duAn) console.error('    - ' + f);
  console.error('\nTách thành HAI commit. Dự án khác chỉ lấy commit tầng chung —');
  console.error('trộn lại thì họ phải tách tay, và họ sẽ tách sai.');
  process.exit(1);
}

console.log(`[layers] ✓ ĐẠT — chỉ chạm tầng ${chung.length ? 'CHUNG' : 'DỰ ÁN'}.`);
```

Đối chứng **lần 4** đáng làm nhất: sửa một tệp chưa khai (ví dụ `scripts/ci/mot-gi-do.js`) → phải ra **mã 2**,
không phải mã 0. Máy im lặng cho qua thứ nó không hiểu là máy đang nói dối.

## Việc 3 — Khớp đăng nhập: việc tốn công nhất (40 phút)

Chuyển kit sang dự án mới, 80% thời gian nằm ở đăng nhập. Luôn luôn. App thực hành không có đăng nhập
nên tới giờ bạn chưa gặp.

### Bốn cơ chế hay gặp

| Cơ chế | Dấu hiệu | Cách vào |
|---|---|---|
| Form + cookie phiên | POST form, `Set-Cookie` | điền form một lần, lưu `storageState` |
| Token trong `localStorage` | không có cookie; header `Authorization: Bearer` | lấy token qua API rồi **bơm vào `localStorage`** trước khi vào trang |
| OAuth / SSO qua nhà cung cấp ngoài | chuyển hướng sang miền khác | xin tài khoản **dịch vụ** dùng ROPC/client-credentials; đừng automate màn SSO |
| Có OTP / captcha | có bước xác thực hai lớp | **không** automate — xin tài khoản test được miễn OTP |

Hai dòng cuối là chỗ người mới mất nhiều ngày nhất, và cả hai đều không giải bằng code: giải bằng cách
**xin đúng loại tài khoản**. Hỏi sớm, đừng thử tự vượt.

### Ba ràng buộc phải hỏi trước khi viết dòng nào

| Câu hỏi | Vì sao |
|---|---|
| Token sống bao lâu? | hết hạn giữa lượt chạy ⇒ đỏ rải rác, trông hệt flaky (Bài 25) |
| Sai mật khẩu mấy lần thì **khoá**? | test chạy song song có thể tự khoá tài khoản của chính mình |
| Một tài khoản đăng nhập được mấy nơi cùng lúc? | có hệ thống giới hạn 3 phiên — profile trình duyệt mới ăn một suất, hết suất là `setup_failure`, không phải bug |

Ba câu này lấy mất 5 phút hỏi, và tiết kiệm hàng ngày điều tra "flaky".

```js
// tests/support/auth.js — tầng DỰ ÁN. Mỗi dự án viết lại phần trong, GIỮ nguyên hình dạng.
'use strict';

/*
 * Hình dạng bắt buộc — để mọi máy chặn và fixture của tầng CHUNG dùng được mà không cần biết
 * dự án này đăng nhập kiểu gì:
 *   dangNhap(page)   → đưa page vào trạng thái ĐÃ đăng nhập
 *   layToken()       → trả token cho test tầng API
 *
 * Lỗi setup PHẢI có tiền tố "SETUP:" — nhờ đó verdict xếp vào SETUP_FAILURE, không phải FAIL,
 * và KHÔNG log bug (Bài 17).
 */

async function layToken(request) {
  const u = process.env.TEST_USER, p = process.env.TEST_PASS;
  if (!u || !p) throw new Error('SETUP: thiếu TEST_USER/TEST_PASS trong profiles/<TASK>/task.env');

  const r = await request.post(process.env.AUTH_URL, { data: { username: u, password: p } });
  if (!r.ok()) {
    // 401 lặp lại có thể do tài khoản đã bị KHOÁ vì các lượt trước — nói rõ, đừng để người đọc đoán
    throw new Error(`SETUP: đăng nhập trả ${r.status()}. Kiểm mật khẩu, và kiểm tài khoản có bị khoá không.`);
  }
  const j = await r.json();
  if (!j.access_token) throw new Error('SETUP: response đăng nhập không có access_token');
  return j.access_token;
}

async function dangNhap(page, request) {
  const token = await layToken(request);
  // Bơm token TRƯỚC khi điều hướng — vào trang rồi mới bơm thì app đã kịp đá về màn đăng nhập
  await page.addInitScript((t) => {
    try { window.localStorage.setItem('access_token', t); } catch (e) { /* trang chưa có origin */ }
  }, token);
  await page.goto(process.env.APP_BASE_URL);

  // Xác nhận ĐÃ vào thật, đừng tin là đã vào. Không xác nhận thì mọi case sau đỏ vì cùng một lý do,
  // và bạn đi debug từng case thay vì debug đăng nhập.
  const vaoDuoc = await page.locator('[data-testid="user-menu"]').isVisible().catch(() => false);
  if (!vaoDuoc) throw new Error('SETUP: bơm token xong nhưng không thấy giao diện đã đăng nhập');
  return token;
}

module.exports = { dangNhap, layToken };
```

Ba điều trong đoạn trên là kinh nghiệm, không phải phong cách:

| Điều | Vì sao |
|---|---|
| `addInitScript` trước `goto` | vào trang rồi mới bơm thì app đã kịp đá về màn đăng nhập |
| **Xác nhận đã vào** bằng một element | không xác nhận thì mọi case sau đỏ vì cùng một lý do, và bạn debug nhầm chỗ |
| Mọi lỗi có tiền tố `SETUP:` | xếp vào `SETUP_FAILURE`, không phải `FAIL`, và không log bug |

## Việc 4 — Chạy trọn một vòng thật (30 phút)

Kit chỉ được coi là đã chuyển giao khi nó đi hết một vòng trên dự án thật. Danh sách chuyển giao:

```markdown
## Chuyển giao kit → <Dự án>

### Cấu hình
- [ ] `profiles/<TASK>/task.env`: URL, tài khoản test — **không** dùng `.env` chung
- [ ] `chieu-phu.json`: chiều nào áp, `n/a` nào cũng có lý do
- [ ] `risk_model.json`: module của dự án này; chưa có lịch sử bug ⇒ bật cold-start (Bài 27)
- [ ] `anh-xa-luu-tru.json`: ánh xạ trường UI ↔ nơi lưu (Bài 10)
- [ ] `ci_scope.json`: xếp hạng mọi lệnh
- [ ] `mcp_config.md`: server + quyền + ai duyệt (Bài 20)

### Thay
- [ ] `tests/support/auth.js` — đăng nhập, đã trả lời 3 câu ràng buộc
- [ ] `tests/support/factory.js` — dựng dữ liệu qua API, prefix `IT test` + mã task
- [ ] `mutants.json` — 5 mutant theo API thật (Bài 25)

### Chạy thật MỘT vòng
- [ ] Phase 1: một requirement thật → testcase → `gate-mo-ho` ĐẠT → publish dry-run
- [ ] Phase 2: execute → bằng chứng có khoanh đỏ → verdict có tầng lỗi → `self-review` ĐẠT
- [ ] Log **một** bug thật (human gate: bạn bấm)
- [ ] Đo mutation lần đầu, ghi mốc gốc (Bài 25–22)

### Đối chứng — bước không được bỏ
- [ ] Suite của tôi bắt được **≥1** bug thật của dự án này. Không bắt được cái nào ⇒ chưa xong.
```

Dòng cuối là điều kiện nghiệm thu thật. Kit chạy xanh trên dự án mới không chứng minh gì, đúng nguyên
tắc từ Bài 1: app đúng và bộ kiểm mù cho cùng một dấu hiệu. Trên app thực hành bạn có 3 bug biết trước
làm đối chứng; trên dự án thật, đối chứng là một bug thật.

Chưa có bug nào để bắt? Có hai đường:

| Đường | Cách |
|---|---|
| Lấy bug **đã fix** trong lịch sử | viết mutant tái hiện nó, kiểm suite có đỏ không (Bài 25) |
| Tiêm lỗi vào response | `npm run mutation` — nếu 0/5 mutant bị diệt thì suite đang mù |

## Gọi tên những gì bạn vừa làm

| Từ | Nghĩa gọn |
|---|---|
| **Tầng CHUNG** | Mang đi được mọi dự án. Sửa nó ảnh hưởng mọi task đang chạy |
| **Tầng DỰ ÁN** | Chỉ đúng với dự án này. Sửa thoải mái |
| **Chuyển giao** | Đưa kit vào một dự án tới lúc nó chạy trọn một vòng thật |

## Cây thư mục sau bài này

```
<du-an-cua-ban>/
├── .agent/config/
│   ├── kit-layers.md                 ← MỚI · ranh giới tầng CHUNG ↔ tầng DỰ ÁN
│   ├── chieu-phu.json       ← CẤU HÌNH LẠI cho dự án này
│   ├── risk_model.json               ← CẤU HÌNH LẠI · chưa có bug ⇒ bật cold-start
│   ├── anh-xa-luu-tru.json           ← CẤU HÌNH LẠI · ánh xạ trường thật
│   └── mutants.json                  ← THAY · theo API thật
├── scripts/                          ·  GIỮ NGUYÊN toàn bộ từ bản phát hành
├── tests/
│   ├── support/
│   │   ├── auth.js                   ← THAY · việc tốn công nhất
│   │   └── factory.js                ← THAY · dựng dữ liệu qua API thật
│   └── e2e/                          ← THAY · test của dự án này
└── profiles/<TASK>/task.env          ← MỚI · ⛔ KHÔNG commit
```

## Bộ kit của bạn đang ở đâu

```
CẤP ĐỘ 4 · EVOLVE      bài 9/9 của cấp độ này
████████████████████████████

cả tài liệu           bài 29/29
████████████████████████████
```

**Hết cấp độ 4 bạn nói được:** Tôi mở rộng, đo được độ tin cậy, tích luỹ learning và chứng minh reuse.

Đây là bài cuối của cả tài liệu.

## Tự kiểm

1. Ba loại khi chuyển kit là gì? Loại nào đông nhất về số dòng, loại nào tốn nhiều thời gian nhất?
2. Vì sao commit trộn hai tầng là commit "không mang đi được"?
3. Gate gặp tệp chưa phân loại thì trả mã mấy? Vì sao không đoán theo tên?
4. Bốn cơ chế đăng nhập. Cái nào không nên automate, và giải bằng gì?
5. Ba câu hỏi ràng buộc phải hỏi trước khi viết đăng nhập. Câu nào liên quan tới "trông giống flaky"?
6. Vì sao `addInitScript` phải trước `goto`?
7. Vì sao lỗi đăng nhập phải có tiền tố `SETUP:`?
8. Điều kiện nghiệm thu thật của chuyển giao là gì? Vì sao "chạy xanh" chưa đủ?

## Bài tập về nhà (30 phút)

1. Điền `kit-layers.md` cho dự án bạn. Chạy `layers-check.js` lên thay đổi gần nhất. Có tệp chưa phân loại
   thì khai. Đó chính là những chỗ bạn chưa quyết được nó thuộc tầng nào, và cần quyết.
2. Trả lời ba câu ràng buộc đăng nhập bằng cách hỏi dev/BA, không đoán. Ghi vào
   `knowledge/system/dang-nhap.json` kèm `source` (Bài 26).
3. Chạy trọn danh sách chuyển giao. Tới dòng cuối: suite của bạn bắt được bug thật nào chưa?
   Chưa thì chạy `npm run mutation` và đọc điểm, bạn sẽ biết mình đang mù ở đâu.

## Đọc thêm

- Bài 28 — [đóng gói và phát hành](dong-goi-va-phat-hanh.md): quy trình đưa bản mới sang dự án đang chạy.
- Bài 27 — [risk-based testing](risk-based-testing.md): dự án mới chưa có lịch sử bug ⇒ chế độ cold-start.
- Bài 25 — [mutation testing](do-chinh-bo-kiem.md): cách chứng minh suite trên dự án mới không mù.
