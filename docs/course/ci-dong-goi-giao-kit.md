# Bài 24 — CI: biến rule thành cổng chặn thật

> **2 giờ 30 phút** · Có gì trong tay: kit hoàn chỉnh có điểm mutation · Sau bài này: kit chạy không cần bạn, và người khác dùng được nó

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Gate chỉ chạy khi bạn nhớ gõ lệnh. Tức là nó chưa thật sự canh cửa. |
| **Bài này bạn gõ gì** | Khai chỗ nào chạy lệnh nào, chặn test ăn theo biến môi trường, và đo xem máy nào không ai gọi. |
| **Xong thì được gì** | Gate tự chạy mỗi lần đẩy code, và không còn máy nào nằm không. |

## Từ mới của bài này

| Từ | Nghĩa gọn |
|---|---|
| **CI** | Máy chủ tự chạy lệnh mỗi lần bạn đẩy code lên |
| **Thừa hưởng biến môi trường** | Test chạy được ở máy bạn chỉ vì shell còn sẵn một biến. Lên CI là đỏ |
| **Độ với tới** | Máy có được gọi từ đâu đó không. Không ai gọi thì coi như không có |

## Bài này bạn sẽ làm gì

Năm việc:

1. Khai phạm vi CI ở một nguồn, và biết máy nào không nên vào CI (30 phút).
2. Chặn lỗi kinh điển: test xanh ở máy bạn vì ăn theo biến môi trường (35 phút).
3. Đo độ với tới của từng máy (30 phút).
4. Phân tầng chung và tầng dự án để mang kit đi được (25 phút).
5. Viết README mà người mới đọc là chạy được (30 phút).

---

## 1. CI không phải "chạy tất cả trên đám mây"

Phản xạ đầu tiên là nhét mọi thứ vào CI. Sai, vì ba lý do:

| Lý do | Cụ thể |
|---|---|
| Máy theo task cần `MA_TASK` | CI không có task nào ⇒ nó luôn KHÔNG ĐO ĐƯỢC ⇒ noise |
| Test E2E cần môi trường UAT + tài khoản | Chạy mỗi commit thì khoá tài khoản (Bài 12) và mutate dữ liệu |
| CI đỏ vì lý do không phải lỗi mã | Người ta học cách bỏ qua CI đỏ — và đó là lúc CI chết |

Nên **khai phạm vi CI bằng một nguồn**, không để mỗi workflow tự chọn:

`.agent/config/ci_scope.json`:

```json
{
  "$schema": "phạm vi CI. MỘT nguồn — workflow đọc từ đây, không tự liệt kê.",
  "moiCommit": {
    "moTa": "Rẻ, tất định, không cần môi trường ngoài. Đỏ ở đây LUÔN là lỗi mã.",
    "lenh": [
      "npm run json:check",
      "npm run quet-secret",
      "npm run gates:kiem",
      "npm run chong-troi",
      "npm run env:no-ambient",
      "npm run gates:reach",
      "npm run branch:parity"
    ]
  },
  "hangDem": {
    "moTa": "Cần môi trường. Chạy theo giờ, không theo commit.",
    "lenh": [
      "npx playwright test tests/smoke",
      "npm run mutation -- --grep @mutation-core"
    ]
  },
  "thuCong": {
    "moTa": "Đắt hoặc cần chọn tham số. Bấm tay.",
    "lenh": [
      "npx playwright test tests/e2e",
      "CROSS_BROWSER=1 npx playwright test tests/smoke",
      "npm run mutation"
    ]
  },
  "khongVaoCi": {
    "moTa": "Máy theo task. Chạy ở phiên làm việc, KHÔNG ở CI.",
    "lenh": ["npm run kiem-dau-vao", "npm run tu-soi", "npm run mo-rong", "npm run tms:push-exec"],
    "lyDo": "cần MA_TASK và artifact của một task cụ thể ⇒ ở CI luôn KHÔNG ĐO ĐƯỢC"
  }
}
```

Và một máy giữ cho khai báo này khớp thực tế:

```js
#!/usr/bin/env node
/*
 * ci-scope.js — mọi npm script phải được XẾP HẠNG trong ci_scope.json.
 *
 * VÌ SAO: script mới thêm mà không xếp hạng thì nó không chạy ở đâu cả, và không ai biết.
 * Đây là cách gate chết lặng lẽ: nó tồn tại, nó đúng, nó không bao giờ được gọi.
 */
'use strict';
const fs = require('fs');
const scope = JSON.parse(fs.readFileSync('.agent/config/ci_scope.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const daXep = new Set();
for (const [khoi, v] of Object.entries(scope)) {
  if (khoi.startsWith('$') || !v.lenh) continue;
  for (const l of v.lenh) {
    const m = l.match(/npm run ([\w:-]+)/);
    if (m) daXep.add(m[1]);
  }
}

// Script hạ tầng không cần xếp hạng — khai TƯỜNG MINH, không đoán theo tên
const MIEN = new Set(['test', 'build', 'library:build', 'gates:index', 'sync:gitlab']);

const chuaXep = Object.keys(pkg.scripts || {}).filter((s) => !daXep.has(s) && !MIEN.has(s));
if (chuaXep.length) {
  console.error(`[ci-scope] ✗ CHẶN — ${chuaXep.length} npm script chưa xếp hạng trong ci_scope.json:`);
  for (const s of chuaXep) console.error('  - ' + s);
  console.error('\nXếp vào moiCommit / hangDem / thuCong / khongVaoCi (kèm lyDo).');
  process.exit(1);
}
console.log(`[ci-scope] ✓ ĐẠT — ${daXep.size} script đã xếp hạng`);
```

## 2. Cái bẫy đắt nhất của CI: thừa hưởng biến môi trường

Chuyện này xảy ra với mọi người một lần, và mất nửa ngày để hiểu:

> Test xanh trên máy bạn. Đỏ trên CI. Mã giống nhau. Môi trường giống nhau.

Nguyên nhân: trên máy bạn, `MA_TASK` và `RUN_ID` đang có trong shell từ lượt chạy tay trước đó. Test đọc
`process.env.MA_TASK`, thấy có, chạy được. Trên CI không có biến đó ⇒ đỏ.

Đây là lỗi của **test**, không phải của CI: test đang phụ thuộc vào thứ nó không tự dựng.

```js
#!/usr/bin/env node
/*
 * env-khong-thua-huong.js — test không được đọc biến môi trường mà chính nó không dựng.
 *
 * ĐO BẰNG CÁCH NÀO: quét mã test tìm process.env.<X>, rồi đối chiếu X với ba danh sách:
 *   - dựng bởi fixture/config  ⇒ OK
 *   - khai trong task.env.example / .env.example ⇒ OK (có tài liệu, người ta biết phải set)
 *   - không thuộc đâu cả ⇒ CHẶN: đây là biến ăn theo shell
 */
'use strict';
const fs = require('fs');
const path = require('path');

const GOC = ['tests'];
const ALLOW = '.agent/config/env-allow.json';
const khai = fs.existsSync(ALLOW) ? JSON.parse(fs.readFileSync(ALLOW, 'utf8')) : { duocPhep: {} };

function quet(d, ra = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) quet(p, ra);
    else if (/\.(ts|js|mjs)$/.test(e.name)) ra.push(p);
  }
  return ra;
}

// Biến do runner/hệ điều hành cấp — không phải phụ thuộc của test
const HE_THONG = new Set(['CI', 'NODE_ENV', 'HOME', 'USERPROFILE', 'PATH', 'TMPDIR', 'TEMP',
  'PW_RETRIES', 'MUTANT', 'MUTATION_RUN', 'PLAYWRIGHT_TEST_BASE_URL']);

const viPham = [];
for (const f of GOC.filter(fs.existsSync).flatMap((g) => quet(g))) {
  const noi = fs.readFileSync(f, 'utf8');
  for (const m of noi.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
    const ten = m[1];
    if (HE_THONG.has(ten) || khai.duocPhep[ten]) continue;
    viPham.push(`${f}: process.env.${ten}`);
  }
}

if (viPham.length) {
  console.error(`[env-thua-huong] ✗ CHẶN — ${viPham.length} biến chưa khai:`);
  for (const v of viPham.slice(0, 20)) console.error('  - ' + v);
  console.error(`\nMỗi biến phải có một dòng trong ${ALLOW} nói AI dựng nó và ở ĐÂU.`);
  console.error('Không khai ⇒ test xanh trên máy dev (biến còn trong shell) và đỏ trên CI.');
  process.exit(1);
}
console.log('[env-thua-huong] ✓ ĐẠT');
```

`.agent/config/env-allow.json`:

```json
{
  "duocPhep": {
    "MA_TASK": { "aiDung": "người dùng đặt qua profiles/<TASK>/task.env", "khaiO": "profiles/task.env.example" },
    "THU_MUC_KET_QUA": { "aiDung": "người dùng đặt qua task.env", "khaiO": "profiles/task.env.example" },
    "APP_BASE_URL": { "aiDung": "task.env", "khaiO": "profiles/task.env.example" },
    "TEST_USER": { "aiDung": "task.env", "khaiO": "profiles/task.env.example" },
    "TEST_PASS": { "aiDung": "task.env", "khaiO": "profiles/task.env.example" }
  }
}
```

### Nghiệm thu ở **hai** môi trường

Đây là luật đi kèm:

> Một máy chỉ được coi là xong khi nó cho **cùng một kết quả** ở máy cá nhân và ở CI.

Cách thử nhanh mà không cần đợi CI: chạy với môi trường sạch.

```bash
# Bash — chạy test trong môi trường trống trơn, chỉ giữ những gì tường minh
env -i PATH="$PATH" HOME="$HOME" npx playwright test tests/smoke
```

```powershell
# PowerShell — xoá biến khả nghi khỏi phiên hiện tại rồi chạy
'MA_TASK','RUN_ID','THU_MUC_KET_QUA' | ForEach-Object { Remove-Item "env:$_" -ErrorAction SilentlyContinue }
npx playwright test tests/smoke
```

Đỏ ở đây nghĩa là nó cũng sẽ đỏ trên CI — và bạn biết trước mười lăm phút thay vì sau nửa ngày.

## 3. Độ với tới: máy không ai gọi thì bằng không có

Bạn có hơn ba mươi máy. Câu hỏi: **bao nhiêu cái thật sự chạy?**

Một máy chỉ có tác dụng nếu **với tới được từ một điểm vào**: một npm script được gọi bởi CI, hoặc bởi
workflow/prompt mà agent đọc, hoặc bởi slash command.

```js
#!/usr/bin/env node
/*
 * gates-voi-toi.js — mỗi máy phải với tới được từ một điểm vào, trong tối đa 2 chặng.
 *
 *   chặng 1: file máy ← được gọi bởi một npm script
 *   chặng 2: npm script ← được nhắc trong CI, workflow, prompt template, hoặc slash command
 *
 * ĐO BẰNG TÊN NPM SCRIPT, không bằng tên file — vì tài liệu nhắc lệnh, không nhắc đường dẫn.
 * Máy task-scope không cần vào CI, nhưng PHẢI với tới từ workflow.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const scope = JSON.parse(fs.readFileSync('.agent/config/ci_scope.json', 'utf8'));

// chặng 1: file → script
const scriptCuaFile = {};
for (const [ten, lenh] of Object.entries(pkg.scripts || {})) {
  for (const m of String(lenh).matchAll(/(scripts\/[\w/.-]+\.js)/g)) {
    (scriptCuaFile[m[1]] = scriptCuaFile[m[1]] || []).push(ten);
  }
}

// chặng 2: script → tài liệu / CI
function docHet(d, ra = []) {
  if (!fs.existsSync(d)) return ra;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) docHet(p, ra);
    else if (/\.(md|ya?ml)$/.test(e.name)) ra.push(p);
  }
  return ra;
}
const vanBan = docHet('.github').concat(docHet('.agent/workflows'), docHet('prompt_templates'),
  docHet('.claude/commands'), ['README.md'].filter(fs.existsSync))
  .map((f) => fs.readFileSync(f, 'utf8')).join('\n');

const trongCiScope = new Set(JSON.stringify(scope).match(/npm run ([\w:-]+)/g)?.map((s) => s.slice(8)) || []);

const mayFiles = fs.readdirSync('scripts/qa').filter((f) => f.endsWith('.js')).map((f) => 'scripts/qa/' + f);
const coLap = [];
for (const f of mayFiles) {
  const noi = fs.readFileSync(f, 'utf8');
  // Chỉ tính MÁY — file thư viện không cần điểm vào
  if (!/process\.exit\(/.test(noi)) continue;

  const scripts = scriptCuaFile[f.replace(/\\/g, '/')] || [];
  if (!scripts.length) { coLap.push(`${f}: không npm script nào gọi (chặng 1 đứt)`); continue; }
  const voiToi = scripts.some((s) => trongCiScope.has(s) || vanBan.includes('npm run ' + s));
  if (!voiToi) coLap.push(`${f}: script ${scripts.join('|')} không được CI/workflow/prompt nào nhắc (chặng 2 đứt)`);
}

console.log(`[voi-toi] ${mayFiles.length} file · kiểm ${Object.keys(scriptCuaFile).length} liên kết`);
if (coLap.length) {
  console.error(`\n[voi-toi] ✗ CHẶN — ${coLap.length} máy không với tới được:`);
  for (const c of coLap) console.error('  - ' + c);
  console.error('\nMáy đúng mà không ai gọi thì bằng không có. Nối nó vào một điểm vào.');
  process.exit(1);
}
console.log('[voi-toi] ✓ ĐẠT — mọi máy đều với tới được');
```

> Lần đầu chạy máy này trên kit thật, nó tìm ra **bốn** gate viết xong, đúng, có test, và **chưa bao giờ chạy**
> vì không ai thêm chúng vào workflow.

## 4. Kiểm ngang nhánh

Kit sống ở nhiều nhánh, và mỗi nhánh có vòng đời riêng. Nhánh `rerun` phải có gate chất lượng output; nhánh
`phase1` phải có validator testcase. Khai bằng dữ liệu:

`.agent/config/branch_parity.json`:

```json
{
  "$schema": "máy nào PHẢI với tới được từ workflow của nhánh nào.",
  "nhanh": {
    "phase1": { "batBuoc": ["tc:validate", "policy:check", "json:check"] },
    "phase2": { "batBuoc": ["kiem-dau-vao", "self-review", "mo-rong", "policy:check"] },
    "rerun":  { "batBuoc": ["self-review", "mo-rong", "bugs:checklist"] },
    "finalize": { "batBuoc": ["self-review", "tms:verify-fields", "secret:scan"] }
  }
}
```

Máy kiểm đọc file workflow của từng nhánh và đối chiếu. Cùng kiểu như `gates-voi-toi.js`, nên tôi không lặp
lại mã. Điểm cần nhớ: **khai bằng dữ liệu, kiểm bằng máy**. Viết trong tài liệu "nhánh rerun phải chạy
self-review" là dặn dò; file JSON + máy đọc nó là forcing function.

## 5. Đóng gói: tầng chung vs tầng theo dự án

Khi giao kit cho người khác, câu hỏi đầu tiên của họ là *"cái nào tôi phải sửa?"*. Trả lời bằng một ranh giới
rõ ràng:

`.agent/config/kit-layers.md`:

```markdown
# Hai tầng của kit

## Tầng CHUNG — dùng lại được ở mọi dự án. SỬA CÓ CÂN NHẮC.

| Đường dẫn | Là gì |
|---|---|
| `scripts/lib/**` | Thư viện: đọc/ghi testcase, verdict, gate helper |
| `scripts/qa/*_gate.js` `scripts/qa/tiem-loi.js` | Máy kiểm không phụ thuộc dự án |
| `.agent/config/phan-quyet.json` | Danh mục verdict |
| `.agent/rules/core_rules.md` `CLAUDE.md` `LUAT-DAY-DU.md` | Luật |
| `tests/support/**` | Fixture, factory, evidence, video |

Sửa tầng này thì ảnh hưởng MỌI task đang chạy. Quy tắc: chỉ sửa khi không có task nào đang mở, hoặc sửa
theo hướng chỉ thêm, không đổi hành vi cũ.

## Tầng THEO DỰ ÁN — mỗi dự án tự viết. SỬA THOẢI MÁI.

| Đường dẫn | Là gì |
|---|---|
| `.agent/config/chieu-phu.json` | Chiều nào áp cho dự án này |
| `.agent/config/risk_model.json` | Trọng số rủi ro của dự án này |
| `.agent/config/mutants.json` | Mutant theo API của dự án này |
| `tests/e2e/**` `tests/smoke/**` | Test của dự án này |
| `knowledge/**` | Tri thức nghiệp vụ. KHÔNG commit (dữ liệu công ty) |
| `profiles/<TASK>/task.env` | Cấu hình từng task. KHÔNG commit |

## Kiểm tra: một task "sửa chung" chỉ được chạm tầng CHUNG

`npm run layers:check -- --diff` đọc `git diff --name-only` và cảnh báo khi một thay đổi cắt qua cả hai tầng.
```

Và ba thứ **không bao giờ** vào repo:

```gitignore
# Dữ liệu công ty
knowledge/
# Cấu hình + creds theo task
profiles/*/task.env
.env
# Output của lượt chạy
outputs/
test-results/
playwright-report/
```

## 6. README mà người mới đọc là chạy được

Đây là thứ quyết định kit của bạn có được ai dùng hay không. Cấu trúc đã chứng minh hiệu quả:

```markdown
# <Tên kit>

Bộ kiểm thử có máy-chặn cho <dự án>. Agent AI sinh testcase và chạy test; **máy** quyết định
kết quả có được chấp nhận không.

## Chạy trong 5 phút

```bash
git clone <repo> && cd <repo>
npm ci
npx playwright install chromium
cp profiles/task.env.example profiles/DEMO-1/task.env   # điền URL + tài khoản
npm run gates                                            # phải ĐẠT hết trước khi làm gì
```

## Ba điều phải biết trước khi sửa gì

1. **Excel/testcase canonical là nguồn duy nhất.** Mọi tầng khác PARSE từ nó, không copy.
2. **Output của bạn bị máy kiểm.** Sai chuẩn = chặn. Xem `npm run gates:list`.
3. **"Không phán được" KHÔNG thành PASS.** Xem `.agent/config/phan-quyet.json`.

## Vòng làm việc

| Giai đoạn | Lệnh | Ra gì |
|---|---|---|
| Sinh testcase | `/phase1 <KEY>` | Excel canonical + kiểm cấu trúc |
| Publish | `npm run tms:publish -- --apply --qa-approved` | case trên công cụ + đối soát trường |
| Execute | `/phase2 <KEY>` | kết quả + bằng chứng + verdict |
| Đẩy kết quả | `npm run tms:push-exec -- --apply` | cycle có lịch sử |
| Log bug | `npm run bug:report -- --task <KEY>` | bug có tầng lỗi + bằng chứng |

## Danh mục máy

`npm run gates:list` — sinh tự động, KHÔNG viết tay. Nó nói mỗi máy CHẶN gì.

## Khi gate chặn bạn

Đọc thông báo. Nó nói **luật nào** và **sửa ở đâu**. Nếu bạn tin gate sai:

1. Tái hiện bằng một trường hợp nhỏ nhất.
2. **Sửa luật**, đừng thêm ngoại lệ cho riêng mình.
3. Thêm đối chứng âm để lần sau không tái phạm.

Gate bắt oan thì gate mất uy tín, và đó là cách một kit chết.

## Đo bộ kiểm

`npm run mutation` — tiêm lỗi có kiểm soát và đếm suite có bắt được không.
Chạy hàng tháng. Điểm tụt = có oracle vừa bị làm yếu đi.
```

Ba đặc điểm của README này đáng chép lại:

1. **Lệnh chạy được ở dòng đầu**, không phải triết lý.
2. **Ba điều phải biết** — không phải ba mươi.
3. **Mục "khi gate chặn bạn"** — vì đó là trải nghiệm đầu tiên của người mới, và nếu nó khó chịu thì họ sẽ đi
   tìm cách vô hiệu gate.

## 7. Nhịp bảo dưỡng

Kit không tự đứng vững. Bốn nhịp:

| Nhịp | Việc | Vì sao |
|---|---|---|
| **Mỗi lượt chạy** | Đọc kết quả gate — đừng bỏ qua CẢNH BÁO | Cảnh báo bị bỏ qua đủ lâu sẽ thành nền |
| **Mỗi sprint** | Cập nhật `knowledge/` từ những gì mới học · rà bug đã lọt (Bài 21 mục 8) | Tri thức không ghi thì mất khi người đi |
| **Mỗi tháng** | `npm run mutation` toàn bộ · so điểm với tháng trước | Điểm tụt = oracle bị làm yếu, thường do sửa test cho xanh |
| **Mỗi quý** | Rà **ngoại lệ** trong mọi allowlist: cái nào còn cần? | Ngoại lệ tích lại cho tới khi gate không chặn gì nữa |

Nhịp cuối là nhịp hay bị bỏ nhất và tốn nhất. Cách làm nó rẻ đi: bắt mọi ngoại lệ phải có **lý do** và **ngày**
(Bài 28), rồi một máy cảnh báo khi ngoại lệ già hơn 90 ngày.

## 8. Nhìn lại toàn bộ tài liệu

Bạn bắt đầu từ con số không. Giờ bạn có:

| Phần | Bạn có gì |
|---|---|
| 1 (bài 1–4) | Môi trường + luật + cách ra lệnh cho agent |
| 2 (bài 5–8) | Testcase canonical + oracle độc lập + độ phủ đo được |
| 3 (bài 9–12) | Automation có locator bền + tiền điều kiện + verdict + bằng chứng |
| 4 (bài 13–15) | Máy kiểm chặn thật + một nguồn + chống trôi |
| 5 (bài 16–17) | Bộ nhớ dự án + ưu tiên theo rủi ro |
| 6 (bài 18–20) | Tích hợp + **phép đo chính bộ kiểm** + CI và đóng gói |

Nếu phải chọn **một** điều mang theo, chọn điều này:

> Một luật không có máy chặn thì không phải luật, nó là lời dặn.
> Và **một máy không có đối chứng âm thì không phải máy — nó là niềm tin.**

Mọi thứ trong tài liệu này là hai câu đó áp vào từng chỗ cụ thể.

---

## Thực hành (75 phút)

### Bước 1 — Xếp hạng phạm vi CI (15 phút)

Viết `ci_scope.json` cho kit của bạn. Xếp **mọi** npm script vào một trong bốn hạng. Với mỗi cái ở
`khongVaoCi`, viết `lyDo` cụ thể.

Rồi chạy `ci-scope.js`. Nếu nó liệt kê script chưa xếp, xếp chúng. Đừng thêm vào `MIEN` cho nhanh.

### Bước 2 — Thử môi trường sạch (15 phút)

Chạy suite trong môi trường trống (mục 2). Nếu đỏ, ghi lại:

| Biến bị thiếu | Test nào phụ thuộc | Đúng ra ai phải dựng nó? |
|---|---|---|

Sửa bằng cách để **fixture** dựng nó, hoặc khai nó vào `env-allow.json` với dòng nói ai dựng và ở đâu. Rồi
viết `env-khong-thua-huong.js` và chạy.

### Bước 3 — Đo độ với tới (15 phút)

Viết `gates-voi-toi.js`, chạy nó. Với mỗi máy cô lập, quyết một trong ba:

- Nối nó vào workflow/CI (nó cần thiết) → sửa `ci_scope.json` hoặc workflow.
- Xoá nó (nó không cần) → xoá luôn npm script.
- Khai miễn (nó là thư viện) → nhưng nếu nó có `process.exit` thì nó **là** máy, không phải thư viện.

### Bước 4 — README (20 phút)

Viết `README.md` theo cấu trúc mục 6. Rồi nghiệm thu nó bằng cách khắt khe nhất:

> Đưa cho một người **chưa từng** thấy kit. Bảo họ làm theo mục "Chạy trong 5 phút", **không hỏi bạn gì**.

Mỗi lần họ phải hỏi, đó là một dòng thiếu trong README. Ghi lại, sửa.

Không có người thử? Làm gần đúng: clone repo vào một thư mục mới hoàn toàn, và làm theo README **đúng từng
chữ**, không dùng kiến thức trong đầu.

### Bước 5 — Workflow CI (10 phút)

`.github/workflows/gates.yml`:

```yaml
name: gates
on: [push, pull_request]
jobs:
  moi-commit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      # Đọc từ ci_scope.json thay vì liệt kê ở đây — một nguồn
      - run: node scripts/qa/chay-hang.js moiCommit
```

Điểm quan trọng: workflow **không liệt kê lệnh**. Nó gọi một script đọc `ci_scope.json`. Thêm gate mới thì sửa
JSON, không sửa YAML — và `ci-scope.js` đảm bảo không bỏ sót.

### Bước 6 — Commit cuối

```bash
git add .agent/config/ci_scope.json .agent/config/env-allow.json .agent/config/branch_parity.json \
        .agent/config/kit-layers.md scripts/qa README.md .github/workflows
git commit -m "feat(ci): phạm vi CI một nguồn + chặn thừa hưởng env + đo độ với tới của máy

ci_scope.json là nguồn duy nhất; workflow đọc nó, không liệt kê lệnh.
env-khong-thua-huong: test đọc biến mà không ai dựng ⇒ xanh máy dev, đỏ CI.
gates-voi-toi: máy đúng mà không điểm vào nào gọi thì bằng không có (tìm ra 4 cái)."
```

---

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .agent/config/
│   ├── ci_scope.json             ← MỚI · MỘT nguồn: lệnh nào chạy ở đâu
│   ├── env-allow.json            ← MỚI · biến nào được đọc, AI dựng nó, ở ĐÂU
│   ├── branch_parity.json        ← MỚI · nhánh nào phải có máy nào
│   └── kit-layers.md             ← MỚI · ranh giới tầng CHUNG ↔ tầng DỰ ÁN
├── .github/workflows/
│   └── gates.yml                 ← MỚI · ĐỌC ci_scope.json, không tự liệt kê lệnh
├── scripts/qa/
│   ├── ci-scope.js               ← MỚI · npm script chưa xếp hạng ⇒ chặn
│   ├── env-khong-thua-huong.js   ← MỚI · test đọc biến không ai dựng ⇒ chặn
│   └── gates-voi-toi.js          ← MỚI · máy không điểm vào nào gọi ⇒ chặn
└── README.md                     ← MỚI · nghiệm thu bằng clone sạch
```

Để ý `gates.yml` **không liệt kê lệnh**: nó đọc `ci_scope.json`. Thêm gate mới thì sửa JSON, không sửa
YAML — và `ci-scope.js` đảm bảo không bỏ sót.

## Tự kiểm

- [ ] Mọi npm script của tôi được xếp hạng, và cái nào không vào CI đều có **lý do**.
- [ ] Workflow CI của tôi **không liệt kê lệnh** — nó đọc từ một nguồn.
- [ ] Suite của tôi chạy được trong môi trường **trống trơn**.
- [ ] Mọi biến môi trường test đọc đều khai được **ai dựng** và **ở đâu**.
- [ ] Mọi máy của tôi **với tới được** từ một điểm vào trong 2 chặng.
- [ ] Tôi phân biệt được tầng **chung** với tầng **theo dự án**, và biết rủi ro khi sửa tầng chung.
- [ ] `knowledge/`, `profiles/*/task.env`, `.env`, `outputs/` đều **không** vào repo.
- [ ] README của tôi đã được thử bởi người (hoặc bằng clone sạch) mà **không cần hỏi tôi**.
- [ ] README có mục "khi gate chặn bạn", và nó dẫn tới sửa luật, không tới thêm ngoại lệ.
- [ ] Tôi có nhịp bảo dưỡng, và **nhịp tháng có đo mutation**.

## Bài tập khép lại

Ba việc, làm được cả ba là kit của bạn đứng vững:

1. **Nghiệm thu clone sạch.** Clone repo vào thư mục mới, làm theo README đúng từng chữ, tới khi
   `npm run gates` ĐẠT. Mọi chỗ phải ứng biến là một chỗ thiếu trong README.

2. **Chốt điểm mutation gốc.** Chạy `npm run mutation` toàn bộ, lưu `diem.json`, ghi ngày. Đây là mốc so
   sánh. Tháng sau đo lại, tụt thì tìm oracle nào bị làm yếu.

3. **Đóng vòng lặp bug lọt.** Lấy bug gần nhất lọt ra ngoài. Trả lời: **máy nào lẽ ra phải bắt?** Rồi sửa
   đúng máy đó, và chứng minh bằng một mutant chuyển từ SỐNG SÓT sang BỊ DIỆT.

Việc thứ ba là việc quan trọng nhất trong cả tài liệu này, vì nó là vòng lặp duy nhất khiến bộ kiểm **tốt lên** thay vì
chỉ **chạy**.

## Đọc thêm

- [`docs/BUILD_JOURNAL.md`](../BUILD_JOURNAL.md) — hồi ký dựng bộ kit thật này: bảy thời kỳ, sáu nguyên tắc,
  và bốn điểm mù đã trả giá để biết. Đọc **sau khi làm hết**, vì giờ bạn đã có ngữ cảnh để nó có nghĩa.
- Thư viện thuật ngữ ở [`docs/library/`](../library/) — tra nhanh mọi luật, máy, verdict, kỹ năng.
