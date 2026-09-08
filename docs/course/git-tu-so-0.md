# Bài 5 — Git, GitHub/GitLab cho người mới

> **2 giờ** · Có gì trong tay: agent chạy được, quyền đã cấu hình · Sau bài này: kit nằm trên repo, và có máy chặn không cho dữ liệu nhạy cảm đi theo

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Kit là code nhưng chưa có chỗ lưu. Lỡ đưa tri thức nội bộ lên repo là rò rỉ thật. |
| **Bài này bạn gõ gì** | Chạy git init, commit, tạo nhánh, viết .gitignore, rồi viết một máy chặn tệp cấm. |
| **Xong thì được gì** | Kit nằm trên repo, và có máy canh không cho mật khẩu hay dữ liệu công ty đi theo. |

## Từ mới của bài này

| Từ | Nghĩa gọn |
|---|---|
| **Commit** | Một lần chốt: *"tới đây là một mốc"*. Kèm lời giải thích vì sao |
| **Branch** (nhánh) | Bản làm việc song song. Bạn thử một hướng mà không phá bản đang chạy |
| **Được track** | Tệp git đang quản. Tệp **chưa** track thì git chưa biết nó tồn tại |
| **`.gitignore`** | Danh sách tệp git **cố tình bỏ qua** |

## Bài này bạn sẽ làm gì

Năm việc:

1. Đưa kit của bạn thành một repo, commit lần đầu (25 phút).
2. Làm một nhánh, sửa, gộp lại — và hiểu vì sao QA cần việc này (20 phút).
3. Viết `.gitignore` cho ba thư mục cấm (15 phút).
4. **Xây máy chặn**: tệp cấm bị track ⇒ chặn. Rồi tự tay thử phá nó (30 phút).
5. Đẩy lên GitHub/GitLab (20 phút).

---

## Việc 1 — Repo và commit đầu tiên (25 phút)

Vào thư mục kit từ Bài 1:

```bash
cd kit-cua-toi
git init
```

**Bạn sẽ thấy:**

```
Initialized empty Git repository in .../kit-cua-toi/.git/
```

| Bạn thấy gì | Nghĩa là | Làm gì |
|---|---|---|
| Dòng `Initialized empty…` | Xong | Đi tiếp |
| `Reinitialized existing…` | Ở đây đã là repo rồi | Không sao, đi tiếp |
| `git: command not found` | Chưa có Git | Tải ở git-scm.com, cài, **mở terminal mới** |

Khai tên bạn — git ghi nó vào mỗi commit:

```bash
git config user.name "Tên bạn"
git config user.email "email@congty.com"
```

Xem git đang thấy gì:

```bash
git status
```

**Bạn sẽ thấy** danh sách `Untracked files` gồm `scripts/` và `tests/`. *Untracked* nghĩa là git **chưa quản**
chúng — đây là điểm quan trọng nhất của cả bài, và Việc 4 sẽ dựa vào nó.

Chốt mốc đầu tiên:

```bash
git add scripts tests
git commit -m "feat(kit): máy chặn đầu tiên + test đầu tiên

kiem-so-mong-doi.js chặn khi số mong đợi bị đổi thành số app đang trả.
don-hang-bac.js đỏ vì app sai BR-03 thật (485.000 vs 515.000)."
```

**Bạn sẽ thấy** đại ý `2 files changed, N insertions(+)`.

> **Lời commit viết cho người đọc sau 6 tháng**, và người đó thường là bạn. `"update"` hay `"fix"` thì vô
> dụng. Viết **vì sao**, không viết *đã sửa file nào* — git đã biết file nào rồi.

## Việc 2 — Nhánh: thử mà không phá (20 phút)

Bạn muốn siết máy chặn để nó bắt được cả Kiểu B (bài tập Bài 1). Nếu sửa trực tiếp và làm hỏng, bạn mất bản
đang chạy được.

```bash
git checkout -b siet-may-chan
```

**Bạn sẽ thấy:** `Switched to a new branch 'siet-may-chan'`

Sửa `scripts/qa/kiem-so-mong-doi.js`, chạy thử, rồi:

```bash
git add scripts/qa/kiem-so-mong-doi.js
git commit -m "fix(gate): bắt được cả kiểu lấy số mong đợi TỪ app

Trước đó chỉ bắt kiểu đổi số. Đã thử đối chứng âm: file đúng vẫn ra mã 0."
```

Xem hai nhánh khác nhau ra sao:

```bash
git checkout main
node scripts/qa/kiem-so-mong-doi.js tests/api/don-hang-bac.js   # bản cũ
git checkout siet-may-chan
node scripts/qa/kiem-so-mong-doi.js tests/api/don-hang-bac.js   # bản mới
```

Hài lòng thì gộp về:

```bash
git checkout main
git merge siet-may-chan
```

### Vì sao QA cần git — ba lý do cụ thể

| Lý do | Cụ thể |
|---|---|
| **Kit là code** | Máy chặn là chương trình. Sửa hỏng thì phải quay lại được bản chạy được |
| **Testcase là dữ liệu có phiên bản** | Ai đổi kết quả mong đợi của `TC_012`? Khi nào? Vì sao? Git trả lời được. File Excel trên Drive thì không |
| **Bản mẫu là tài sản chung** | Sửa `prompt_templates/` trong khi người khác đang chạy task là phá việc của họ. Nhánh giải chuyện đó |

Lý do thứ hai đáng nhấn: **kết quả mong đợi bị đổi âm thầm là cách một bộ test mất giá trị mà không ai hay.**
Git biến nó thành thứ tra được — `git log -p` trên tệp testcase cho bạn xem từng lần đổi và lời giải thích.

## Việc 3 — `.gitignore` cho ba thư mục cấm (15 phút)

Tạo `.gitignore`:

```gitignore
# ── Dữ liệu nghiệp vụ của công ty ─────────────────────────────
# Không chỉ vì NỘI DUNG. Xem Việc 4: chính TÊN FILE đã tiết lộ lỗi sản phẩm.
knowledge/

# ── Tài khoản, mật khẩu, token ────────────────────────────────
.env
.env.*
profiles/*/task.env
!profiles/task.env.example

# ── Kết quả từng lượt chạy ────────────────────────────────────
# Đổi mỗi lần chạy, và ảnh trong đó có thể chứa dữ liệu khách.
outputs/
test-results/
playwright-report/

# ── Rác công cụ ───────────────────────────────────────────────
node_modules/
.DS_Store
```

Ba khối đầu có **ba lý do khác nhau**, và trộn chúng lại là hiểu sai:

| Thư mục | Lý do cấm | Nếu lỡ commit thì sao |
|---|---|---|
| `knowledge/` | dữ liệu nghiệp vụ + **tên file tiết lộ lỗi** | rò rỉ thông tin nội bộ |
| `profiles/*/task.env` | tài khoản, token | **phải đổi ngay mọi credential**, không chỉ xoá commit |
| `outputs/` | đổi liên tục, có thể chứa dữ liệu khách | repo phình, và có thể rò rỉ PII |

Dòng `!profiles/task.env.example` là ngoại lệ có chủ ý: bản **mẫu** (không có giá trị thật) thì **phải** vào
repo, để người mới biết cần khai những biến gì.

```bash
git add .gitignore
git commit -m "chore(git): cấm knowledge/ · task.env · outputs/ — ba lý do khác nhau"
```

## Việc 4 — Máy chặn, và tự tay thử phá nó (30 phút)

`.gitignore` **không đủ**, vì một lệnh là xuyên qua nó:

```bash
git add -f profiles/DEMO-1/task.env      # -f = force, bỏ qua .gitignore
```

Và `git add -A` trong lúc gấp cũng có thể gom thứ bạn không định. Nên cần **máy chặn**.

```js
#!/usr/bin/env node
/*
 * kiem-file-cam.js — không tệp cấm nào được git TRACK.
 *
 * VÌ SAO KHÔNG DỰA VÀO .gitignore: `git add -f` xuyên qua nó, và .gitignore chỉ áp cho tệp CHƯA track —
 * tệp đã track một lần rồi thì thêm vào .gitignore cũng vô tác dụng, git vẫn theo dõi nó mãi.
 *
 * ĐO CÁI GÌ: danh sách tệp git ĐANG track (git ls-files), không phải nội dung .gitignore.
 * Đo khai báo thì chỉ biết ý định; đo tệp đang track thì biết SỰ THẬT.
 *
 * Mã thoát:  0 = sạch  ·  1 = có tệp cấm bị track (CHẶN)  ·  2 = không đo được
 */
'use strict';
const { execSync } = require('child_process');

/* Mẫu cấm. Khai TƯỜNG MINH kèm lý do — người sau đọc là hiểu, không phải đoán. */
const CAM = [
  { re: /^knowledge\//, ly: 'dữ liệu nghiệp vụ của công ty; chính tên file cũng tiết lộ lỗi sản phẩm' },
  { re: /(^|\/)\.env($|\.)/, ly: 'chứa credential' },
  { re: /(^|\/)task\.env$/, ly: 'credential theo task' },
  { re: /^outputs\//, ly: 'kết quả từng lượt chạy, có thể chứa PII của khách' },
  { re: /^test-results\//, ly: 'artifact của runner' },
  { re: /\.(pem|p12|pfx|key)$/, ly: 'khoá riêng' },
  { re: /service-account.*\.json$/, ly: 'khoá service account' }
];
/* Ngoại lệ CÓ CHỦ Ý: bản mẫu không có giá trị thật thì PHẢI vào repo. */
const CHO_PHEP = [/^profiles\/task\.env\.example$/, /\.env\.example$/];

let dsFile;
try {
  dsFile = execSync('git ls-files', { encoding: 'utf8' }).split('\n').map((s) => s.trim()).filter(Boolean);
} catch (e) {
  console.error('[file-cam] KHÔNG ĐO ĐƯỢC: không chạy được git ls-files — đây có phải repo git?');
  process.exit(2);
}
if (!dsFile.length) {
  console.error('[file-cam] KHÔNG ĐO ĐƯỢC: git chưa track tệp nào. Chạy git add trước.');
  process.exit(2);
}

const viPham = [];
for (const f of dsFile) {
  if (CHO_PHEP.some((r) => r.test(f))) continue;
  const hit = CAM.find((c) => c.re.test(f));
  if (hit) viPham.push({ f: f, ly: hit.ly });
}

console.log(`[file-cam] kiểm ${dsFile.length} tệp đang được git track`);
if (!viPham.length) {
  console.log('[file-cam] ✓ ĐẠT — không tệp cấm nào bị track.');
  process.exit(0);
}

console.error(`\n[file-cam] ✗ CHẶN — ${viPham.length} tệp cấm đang bị track:`);
for (const v of viPham) console.error(`  - ${v.f}\n      lý do cấm: ${v.ly}`);
console.error('\nBỎ TRACK (giữ tệp trên đĩa):  git rm --cached <tệp>');
console.error('Nếu tệp đó đã từng được PUSH và chứa credential thì xoá commit KHÔNG đủ —');
console.error('phải ĐỔI credential đó ngay, vì nó đã nằm trong lịch sử ở máy người khác.');
process.exit(1);
```

Thêm lệnh:

```json
{
  "scripts": {
    "kiem:file-cam": "node scripts/qa/kiem-file-cam.js"
  }
}
```

### Thử nó — ba lần

**Lần 1 — repo sạch.**

```bash
npm run kiem:file-cam; echo "mã thoát = $?"
```

**Bạn sẽ thấy:**

```
[file-cam] kiểm 3 tệp đang được git track
[file-cam] ✓ ĐẠT — không tệp cấm nào bị track.
mã thoát = 0
```

**Lần 2 — đối chứng dương: tự tay phá.** Tạo một tệp giả (⚠ **giá trị giả, đừng dùng token thật**):

```bash
mkdir -p profiles/DEMO-1
printf 'APP_BASE_URL=http://localhost:4010\nTEST_PASS=day-la-mat-khau-gia\n' > profiles/DEMO-1/task.env
git add -f profiles/DEMO-1/task.env
npm run kiem:file-cam; echo "mã thoát = $?"
```

**Bạn sẽ thấy:**

```
[file-cam] ✗ CHẶN — 1 tệp cấm đang bị track:
  - profiles/DEMO-1/task.env
      lý do cấm: credential theo task

BỎ TRACK (giữ tệp trên đĩa):  git rm --cached <tệp>
...
mã thoát = 1
```

Dọn theo đúng hướng dẫn máy vừa in:

```bash
git rm --cached profiles/DEMO-1/task.env
npm run kiem:file-cam; echo "mã thoát = $?"      # phải về 0
```

**Lần 3 — đối chứng âm cho ngoại lệ.** Bản mẫu **phải** đi qua được:

```bash
printf 'APP_BASE_URL=\nTEST_USER=\nTEST_PASS=\n' > profiles/task.env.example
git add profiles/task.env.example
npm run kiem:file-cam; echo "mã thoát = $?"      # phải là 0
```

Nếu ra `1` thì máy của bạn **bắt oan** — và Bài 28 nói kỹ vì sao bắt oan còn tệ hơn không có máy: người ta sẽ
học cách tắt nó đi.

### Bài học đắt nhất của bài này

> Không phải *nội dung* của `knowledge/` mới nguy hiểm. **Chính tên tệp đã tiết lộ.**

Một thư mục tri thức có thể chứa những tệp tên kiểu:

```
knowledge/domain/tinh-phi-sai-khi-khach-hang-vang.md
knowledge/decisions/khong-chan-thanh-toan-trung-vi-chua-kip-sprint.md
```

Chỉ cần chạy `git ls-files` trên một repo công khai là người ngoài biết sản phẩm của bạn có lỗi gì và bạn cố
ý bỏ qua điều gì — **mà không cần mở một tệp nào.**

Đây là lý do `kiem-file-cam.js` đo **danh sách tệp đang track**, không đo nội dung. Máy quét secret (Bài 11)
đọc nội dung; máy này đọc **tên**. Hai lớp khác nhau, và lớp tên là lớp hay bị bỏ.

## Việc 5 — Đẩy lên GitHub/GitLab (20 phút)

Tạo repo trống trên GitHub hoặc GitLab (**Private** — kit chứa quy ước nội bộ), rồi:

```bash
git remote add origin <đường-dẫn-repo-của-bạn>
git branch -M main
git push -u origin main
```

| Bạn thấy gì | Nghĩa là | Làm gì |
|---|---|---|
| `Branch 'main' set up to track…` | Xong | Mở repo trên web kiểm |
| `Authentication failed` | Cần token, không phải mật khẩu | Tạo Personal Access Token trong cài đặt tài khoản, dùng nó làm mật khẩu |
| `remote origin already exists` | Đã khai remote rồi | `git remote set-url origin <đường-dẫn>` |
| `Updates were rejected` | Repo trên server đã có commit | `git pull --rebase origin main` rồi push lại |

**Kiểm bằng mắt trên web** — và đây là bước không được bỏ:

- Có thấy `knowledge/` không? **Không được thấy.**
- Có thấy `profiles/DEMO-1/task.env` không? **Không được thấy.**
- Có thấy `profiles/task.env.example` không? **Phải thấy.**

Ba câu này là nghiệm thu thật cho Việc 3 và Việc 4. Máy chặn nói "sạch" là một chuyện; **mắt bạn nhìn thấy
repo trên web** là chuyện khác, và lần đầu thì nên làm cả hai.

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .git/                             ← MỚI · git khởi tạo (không phải tệp bạn sửa)
├── .gitignore                        ← MỚI · 3 khối, 3 LÝ DO khác nhau
├── package.json                      ← SỬA · thêm lệnh kiem:file-cam
├── profiles/
│   ├── task.env.example              ← MỚI · bản mẫu, PHẢI vào repo
│   └── DEMO-1/task.env               ·  có trên đĩa, ⛔ KHÔNG vào repo
└── scripts/qa/
    ├── kiem-so-mong-doi.js           ·  từ Bài 1
    └── kiem-file-cam.js              ← MỚI · đo tệp ĐANG TRACK, không đo .gitignore
```

## Tự kiểm

1. `.gitignore` có `outputs/` rồi, nhưng `outputs/x.json` vẫn bị git theo dõi. Vì sao? Sửa thế nào?
2. Vì sao máy chặn đo **danh sách tệp đang track** thay vì đọc `.gitignore`?
3. Ba thư mục cấm — nêu **ba lý do khác nhau**, không gộp thành "vì nhạy cảm".
4. Vì sao `profiles/task.env.example` **phải** vào repo?
5. Lỡ push một tệp chứa token thật lên repo — xoá commit là đủ chưa? Vì sao?
6. `git ls-files` trên repo công khai tiết lộ được gì **mà không cần mở tệp nào**?
7. Lệnh nào xuyên qua `.gitignore`? Máy chặn của bạn có bắt được nó không? Bạn đã **thử** chưa?

## Bài tập về nhà (25 phút)

1. Thêm vào `kiem-file-cam.js` một mẫu cấm nữa phù hợp dự án bạn — ví dụ `*.sql` (dump dữ liệu), hoặc
   `evidence/` nếu bạn để bằng chứng ngoài `outputs/`. Ghi **lý do** cho mẫu mới.
2. Với mỗi mẫu cấm, làm **đủ hai** phép thử: một tệp phải bị chặn, một tệp gần giống phải **đi qua**.
   Ví dụ với `*.sql`: `dump.sql` bị chặn, còn `scripts/migrations/001-init.sql` thì tuỳ bạn — nhưng phải
   **quyết định** và khai vào `CHO_PHEP` nếu cho qua.
3. Chạy `git log --oneline` và đọc lại chính lời commit của bạn. Có cái nào chỉ ghi "update" không? Từ giờ
   viết **vì sao**.

Bước 2 là bước hay bị bỏ, và nó là toàn bộ giá trị: một máy chặn chỉ biết chặn thì sẽ chặn cả thứ đúng, và
lúc đó người ta thêm `--no-verify` — thế là bạn mất luôn cái máy.

## Đọc thêm

- Bài 11 — [bộ gate nền](bo-gate-nen.md): máy quét secret đọc **nội dung**; máy ở bài này đọc **tên tệp**.
  Cần cả hai.
- Bài 24 — [CI](ci-dong-goi-giao-kit.md): `kiem:file-cam` là ứng viên hạng *mọi commit* — rẻ, tất định,
  không chạm môi trường nào.
- Bài 28 — [khi kit chặn sai](mot-nguon-va-may-chong-troi.md): ngoại lệ phải có lý do và ngày.
