# Bài 2 — Dựng môi trường làm việc cho Automation

> **1 giờ 30 phút** · Có gì trong tay: đã chơi với app thực hành, chưa có repo · Sau bài này: repo chạy được, và có máy canh không cho tệp cấm lọt lên

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Chỉ cần một lần `git add .` lúc chưa có `.gitignore` là đủ đẩy token hoặc dữ liệu khách lên repo. Lịch sử git thì không xoá sạch được dễ dàng. |
| **Bài này bạn gõ gì** | Cài ba công cụ và nghiệm thu từng cái, tạo repo, rồi viết máy canh tệp cấm. |
| **Xong thì được gì** | Một repo có người gác cổng, thay vì một lời dặn nhau cẩn thận hơn. |

## Từ mới của bài này

| Từ | Nghĩa gọn |
|---|---|
| **Nghiệm thu** | Cài xong thì chạy một lệnh để chứng minh nó hoạt động, không tin lời khai |
| **Tệp cấm** | Tệp không bao giờ được commit: bí mật, dữ liệu khách, kết quả chạy |
| **Git track** | Git đang theo dõi tệp này. Thêm vào `.gitignore` sau đó KHÔNG gỡ nó ra |

## Bài này bạn sẽ làm gì

Bốn việc:

1. Cài ba công cụ, và nghiệm thu từng cái bằng một câu lệnh (25 phút).
2. Tạo repo, viết `.gitignore` trước cả README (20 phút).
3. Năm loại dữ liệu không bao giờ commit (15 phút).
4. **Xây gate:** máy canh tệp cấm, và tự tay thử phá nó (30 phút).

---

## Việc 1 — Cài và nghiệm thu (25 phút)

Từ bài này trở đi có một thói quen: cài xong thì chạy một lệnh chứng minh nó hoạt động. Đừng tin lời khai
của trình cài đặt.

### Node.js

Cài bản **LTS**. Đừng lấy bản Current, vì thư viện thường chưa theo kịp.

```bash
node --version    # phải in ra v20.x hoặc v22.x
npm --version
```

Cài xong mà gõ `node` vẫn báo không tìm thấy thì mở lại terminal. Trên Windows thì mở lại cả VS Code.

### Git

```bash
git --version
git config --global user.name "Tên Bạn"
git config --global user.email "email@congty.com"
```

Hai lệnh `config` không phải tuỳ chọn. Thiếu chúng thì commit không có tác giả, và sau này không truy được
ai sửa gì.

### VS Code

Cài xong thì mở thư mục làm việc bằng File → Open Folder.

Nghe hiển nhiên, nhưng mở sai cấp thư mục là nguyên nhân số một của lỗi "không tìm thấy file" ở mọi
công cụ chạy trong terminal, kể cả Playwright ở Bài 3.

## Việc 2 — Repo và commit đầu tiên (20 phút)

Tạo repo rỗng trên GitHub hoặc GitLab. Để **private** nếu là việc công ty. Rồi:

```bash
git clone <đường-dẫn-repo>
cd <tên-repo>

printf 'node_modules/\n.env\n.env.*\n!.env.example\noutputs/\nknowledge/\nprofiles/*/task.env\n' > .gitignore
printf '# Bộ kit QA của tôi\n\nĐang dựng theo tài liệu hướng dẫn.\n' > README.md

npm init -y
git add .gitignore README.md package.json
git commit -m "chore: khởi tạo repo — .gitignore, README, package.json"
git push
```

`npm init -y` tạo ra `package.json`. Từ giờ mọi lệnh bạn viết đều khai vào đó, ở mục `scripts`. Lý do là để
người khác gõ `npm run <tên>` thay vì phải nhớ đường dẫn dài. Bài 2 sẽ thêm lệnh đầu tiên vào đây.

Để ý thứ tự: `.gitignore` được viết trước cả README. Đó là cố ý. Chỉ cần một lần `git add .` lúc chưa có
`.gitignore` là đủ đẩy thứ không nên đẩy lên, mà lịch sử git thì không xoá sạch được dễ dàng.

## Việc 3 — Năm loại không bao giờ commit (15 phút)

| Loại | Ví dụ | Vì sao |
|---|---|---|
| Bí mật hệ thống | token, mật khẩu, cookie, khoá API, file khoá dịch vụ | Lọt vào lịch sử là phải đổi lại toàn bộ |
| Dữ liệu khách | email, số điện thoại, tên, địa chỉ, ảnh chưa che | Rò rỉ thật, không phải rủi ro trên lý thuyết |
| Kết quả chạy | thư mục output, ảnh và video bằng chứng | Nặng, và hay chứa dữ liệu khách |
| Bộ nhớ dự án | thư mục `knowledge/` sau này | Dữ liệu công ty. Đối xử như `.env` |
| File tạm | dump API, script nháp | Hay chứa "dữ liệu mẫu" mà thật ra là dữ liệu thật |

Một chuyện có thật đáng nhớ. Bảy file nháp dump API còn sót ở thư mục gốc, chưa ai cho vào `.gitignore`.
Trong đó có một file chứa 24 email và 6 số điện thoại ở phần giá trị mẫu. Một lần `git add .` là xong.

Cách chữa không phải là dặn nhau cẩn thận hơn. Cách chữa là thêm mẫu `scratch_*` vào `.gitignore`.

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

**Lần 2 — đối chứng dương: tự tay phá.** Tạo một tệp giả (⚠ giá trị giả, đừng dùng token thật):

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

**Lần 3 — đối chứng âm cho ngoại lệ.** Bản mẫu phải đi qua được:

```bash
printf 'APP_BASE_URL=\nTEST_USER=\nTEST_PASS=\n' > profiles/task.env.example
git add profiles/task.env.example
npm run kiem:file-cam; echo "mã thoát = $?"      # phải là 0
```

Nếu ra `1` thì máy của bạn **bắt oan** — và Bài 24 nói kỹ vì sao bắt oan còn tệ hơn không có máy: người ta sẽ
học cách tắt nó đi.

### Bài học đắt nhất của bài này

> Nguy hiểm không nằm ở nội dung file trong `knowledge/`. Chính tên file đã đủ để lộ chuyện.

Một thư mục tri thức có thể chứa những tệp tên kiểu:

```
knowledge/domain/tinh-phi-sai-khi-khach-hang-vang.md
knowledge/decisions/khong-chan-thanh-toan-trung-vi-chua-kip-sprint.md
```

Chỉ cần chạy `git ls-files` trên một repo công khai là người ngoài biết sản phẩm của bạn có lỗi gì và bạn cố
ý bỏ qua điều gì, mà không cần mở một tệp nào.

Đó là lý do `kiem-file-cam.js` đo danh sách file đang được git quản, chứ không đọc nội dung. Máy quét mật
khẩu ở Bài 14 mới là cái đọc nội dung. Hai lớp khác nhau, và lớp tên file là lớp hay bị bỏ quên.


## Cây thư mục sau bài này

```
kit-cua-toi/
├── .gitignore                    ← MỚ́I · viết TRƯỚC cả README
├── README.md                     ← MỚ́I · một dòng cũng được, Bài 28 sẽ viết tử tế
├── package.json                  ← MỚ́I · nơi khai mọi lệnh npm run
├── docs/
│   ├── xuat-phat.md              ·  từ Bài 1
│   └── moi-truong.md             ← MỚ́I · dán kết quả nghiệm thu vào đây
└── scripts/qa/
    └── kiem-file-cam.js          ← MỚ́I · tệp cấm bị git track ⇒ chặn
```

Ba file ở gốc và một máy chặn. Đó là toàn bộ repo lúc này, và nó đã có người gác cổng.

## Tự kiểm

1. Vì sao cài xong phải chạy một lệnh kiểm, thay vì tin trình cài đặt?
2. Vì sao `.gitignore` được viết trước README?
3. Kể 5 loại dữ liệu không bao giờ commit, và lý do khác nhau của từng loại.
4. Vì sao `.gitignore` không đủ, phải có thêm máy chặn?
5. Máy chặn đo `git ls-files` chứ không đo nội dung `.gitignore`. Vì sao?
6. Tệp đã bị git track một lần rồi thì thêm vào `.gitignore` có tác dụng không?
7. Ba mã thoát `0`, `1`, `2` nghĩa là gì? Vì sao phải có mã `2`?
8. Bạn chứng minh gate này chặn thật bằng cách nào?

## Bài tập về nhà

Mở lịch sử git của một repo bạn đang tham gia:

```bash
git log --all --name-only --pretty=format: | sort -u | grep -iE '\.env|secret|token|dump|\.sql|khach|customer'
```

Tìm xem có file nào đáng lẽ không nên nằm đó không.

Chưa cần sửa. Gỡ một tệp khỏi lịch sử git là việc lớn và phải bàn với cả team. Chỉ cần biết, và hiểu
vì sao chặn ở cổng rẻ hơn dọn sau rất nhiều.

## Bài sau

Bài 3 cài Playwright và đi qua từng dòng trong file cấu hình. Trong đó có ba tuỳ chọn mà đặt sai là
pipeline báo xanh trong khi không có gì được kiểm.
