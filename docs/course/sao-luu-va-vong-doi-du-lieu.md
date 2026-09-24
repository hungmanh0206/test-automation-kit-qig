# Sao lưu và vòng đời dữ liệu

> **1 giờ 30 phút** · Có gì trong tay: vòng học đã chạy ít nhất một chu kỳ · Sau bài này: biết dữ liệu nào mất thì dựng lại được, dữ liệu nào mất là mất hẳn — và có máy canh

**Vấn đề**

Kho tri thức của bạn có vài trăm bản ghi, tích trong sáu tháng: cách dựng từng loại đơn, bản đồ tên
trường giữa ba tầng, lịch sử bug theo module.

Nó không nằm trong repo, vì nó là dữ liệu công ty. Nghĩa là git không giữ nó.

Nghĩa là nếu bạn xoá sai một thư mục, không có bản lùi nào.


**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Bốn loại dữ liệu quý nhất của kit đều nằm ngoài git, nên git không cứu được chúng. |
| **Bài này bạn gõ gì** | Viết máy sao lưu, cho nó từ chối nếu bạn để đích ngay trong repo, rồi khai vòng đời từng loại. |
| **Xong thì được gì** | Mất máy vẫn dựng lại được, vì bạn đã thử khôi phục một lần rồi. |

> Bài này có vài từ mới. Chúng được gọi tên ở **cuối bài**, sau khi bạn đã chạm vào chúng,
> chứ không định nghĩa trước. Gặp từ lạ giữa bài thì đọc tiếp, mục đó sẽ gom lại.

## Bài này bạn sẽ làm gì

Ba việc:

1. Phân loại dữ liệu kit của bạn thành nạp lại được / **mất hẳn** (25 phút).
2. **Xây gate** sao lưu: đích nằm trong repo ⇒ từ chối (25 phút).
3. Khai ngưỡng tỉa **trước khi** dữ liệu tích lại, và chia sẻ kho khi team đông lên (25 phút).

---

## Việc 1 — Hai loại dữ liệu, hai mức lo (25 phút)

Liệt kê mọi thứ kit của bạn sinh ra, rồi hỏi một câu: *mất tệp này thì tôi dựng lại bằng cách nào?*

| Dữ liệu | Mất thì dựng lại thế nào | Loại |
|---|---|---|
| Bộ testcase đã publish | kéo về từ công cụ test-management | **nạp lại được** |
| Kết quả lượt chạy đã đẩy | có trên công cụ, dạng cycle | **nạp lại được** |
| Mã kit (script, gate, test) | git | **nạp lại được** |
| Bug đã log | Backlog | **nạp lại được** |
| **`knowledge/domain/`** — luật đã xác nhận + nguồn | **không có nguồn nào khác** | ⛔ **mất hẳn** |
| **`knowledge/decisions/`** — quyết định + **lý do** | lý do không ở đâu khác | ⛔ **mất hẳn** |
| **`knowledge/fixture/`** — cách dựng dữ liệu | phải mò lại từ đầu | ⛔ **mất hẳn** |
| **`knowledge/leak/`** — bug đã lọt + máy nào lẽ ra bắt | Backlog có bug, không có phần "máy nào lẽ ra bắt" | ⛔ **mất hẳn** |
| `outputs/` — ảnh, video, status từng lượt | chạy lại được (nhưng tốn) | tuỳ |

Bốn dòng ⛔ là toàn bộ lý do bài này tồn tại. Chúng có ba điểm chung, và cả ba đều nguy hiểm:

| Điểm chung | Hệ quả |
|---|---|
| Không có bản sao ở hệ thống nào khác | mất là hết |
| **Không được commit lên git** (Bài 2) | lớp bảo vệ mặc định của mọi thứ khác không áp dụng |
| Tích dần, mỗi ngày một ít | không có lúc nào là "lúc quan trọng" để nhớ sao lưu |

Điểm thứ hai là cái bẫy: bạn quen "code an toàn vì có git", rồi vô thức nghĩ mọi thứ trong thư mục cũng an
toàn. `knowledge/` nằm trong `.gitignore`. Git không giữ nó.

> Ổ cứng hỏng · `git clean -xdf` gõ nhầm · máy mới. Ba chuyện này không hiếm, và mỗi chuyện xoá sạch bốn dòng ⛔.

## Việc 2 — Gate sao lưu: đích trong repo ⇒ từ chối (25 phút)

Sao lưu vào một thư mục **bên trong** repo là không sao lưu gì cả, nó chết cùng repo trong cả ba kịch bản
trên. Nhưng đây là chỗ người ta hay làm, vì nó tiện.

Áp công thức 5 câu hỏi (Bài 15):

| # | | |
|---|---|---|
| 1 | Chặn kiểu sai nào | sao lưu vào chỗ chết cùng bản gốc ⇒ tưởng có sao lưu mà không có |
| 2 | Đo cái gì | đường dẫn đích sau khi resolve tuyệt đối có nằm trong thư mục repo không |
| 3 | Cửa nào | ngay trong lệnh sao lưu, trước khi ghi byte nào |
| 4 | Không đo được | chưa khai `KNOWLEDGE_BACKUP_DIR` ⇒ mã 2 |
| 5 | Đối chứng | đích trong repo ⇒ chặn · đích ngoài repo ⇒ qua · đích là symlink trỏ ngược vào repo ⇒ **chặn** |

```js
#!/usr/bin/env node
/*
 * sao-luu-knowledge.js — sao lưu kho tri thức RA NGOÀI repo.
 *
 * VÌ SAO TỪ CHỐI ĐÍCH TRONG REPO: sao lưu vào chỗ chết cùng bản gốc thì không phải sao lưu.
 * Ổ cứng hỏng, `git clean -xdf` gõ nhầm, hay máy mới — cả ba xoá luôn cả hai bản.
 * Đây là ca "tưởng có mà không có", nguy hiểm hơn "biết là không có".
 *
 * Mã thoát:  0 = sao lưu xong  ·  1 = lỗi khi ghi  ·  2 = cấu hình sai / không đo được
 */
'use strict';
const fs = require('fs');
const path = require('path');

const KHO = process.env.KNOWLEDGE_DIR || 'knowledge';
const DICH = process.env.KNOWLEDGE_BACKUP_DIR;

if (!DICH) {
  console.error('[sao-luu] KHÔNG ĐO ĐƯỢC: chưa khai KNOWLEDGE_BACKUP_DIR.');
  console.error('  Khai một đường dẫn NGOÀI repo — ổ khác, thư mục đồng bộ đám mây, hoặc ổ mạng.');
  process.exit(2);
}
if (!fs.existsSync(KHO)) {
  console.error(`[sao-luu] KHÔNG ĐO ĐƯỢC: không thấy ${KHO}/`);
  process.exit(2);
}

/* realpath để bắt cả symlink trỏ ngược vào repo — đường dẫn "nhìn thì ngoài" mà thật ra ở trong. */
const that = (p) => { try { return fs.realpathSync(p); } catch (e) { return path.resolve(p); } };
const REPO = that(process.cwd());
const DICH_THAT = that(DICH);

if (DICH_THAT === REPO || DICH_THAT.startsWith(REPO + path.sep)) {
  console.error('[sao-luu] ✗ TỪ CHỐI: đích sao lưu nằm TRONG repo.');
  console.error(`  repo : ${REPO}`);
  console.error(`  đích : ${DICH_THAT}`);
  console.error('  Sao lưu vào chỗ chết cùng bản gốc thì không phải sao lưu — nó chỉ làm bạn YÊN TÂM SAI.');
  process.exit(2);
}

const nhan = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const raDir = path.join(DICH_THAT, 'knowledge-' + nhan);

/** Chép đệ quy. Không dùng lệnh hệ điều hành để chạy được trên cả Windows lẫn Linux. */
function chep(tu, den) {
  fs.mkdirSync(den, { recursive: true });
  let n = 0;
  for (const e of fs.readdirSync(tu, { withFileTypes: true })) {
    const a = path.join(tu, e.name), b = path.join(den, e.name);
    if (e.isDirectory()) n += chep(a, b);
    else { fs.copyFileSync(a, b); n++; }
  }
  return n;
}

let soTep;
try { soTep = chep(KHO, raDir); }
catch (e) { console.error('[sao-luu] ✗ lỗi khi ghi: ' + e.message); process.exit(1); }

/* Bản kê: để lần khôi phục sau biết bản này có gì, không phải mở từng tệp. */
const ke = { ngay: new Date().toISOString(), nguon: that(KHO), soTep: soTep, repo: REPO };
fs.writeFileSync(path.join(raDir, '_ban-ke.json'), JSON.stringify(ke, null, 2));

console.log(`[sao-luu] ✓ ${soTep} tệp → ${raDir}`);

/* Tỉa bản cũ theo luật đã khai. Không khai thì KHÔNG tỉa — mặc định là giữ, vì xoá nhầm
   bản sao lưu là lỗi không sửa được. */
const GIU = Number(process.env.KNOWLEDGE_BACKUP_KEEP || 0);
if (GIU > 0) {
  const ds = fs.readdirSync(DICH_THAT).filter((d) => d.startsWith('knowledge-')).sort();
  const boDi = ds.slice(0, Math.max(0, ds.length - GIU));
  for (const d of boDi) fs.rmSync(path.join(DICH_THAT, d), { recursive: true, force: true });
  if (boDi.length) console.log(`  tỉa ${boDi.length} bản cũ, giữ lại ${GIU} bản gần nhất`);
} else {
  console.log('  (chưa khai KNOWLEDGE_BACKUP_KEEP ⇒ không tỉa bản nào)');
}
```

### Thử nó — ba lần

```bash
# Lần 1 — chưa khai đích
node scripts/qa/sao-luu-knowledge.js; echo "mã thoát = $?"      # phải là 2
```

```bash
# Lần 2 — đích TRONG repo (ca hay làm nhất)
KNOWLEDGE_BACKUP_DIR=./backup node scripts/qa/sao-luu-knowledge.js; echo "mã thoát = $?"
```

**Bạn sẽ thấy:**

```
[sao-luu] ✗ TỪ CHỐI: đích sao lưu nằm TRONG repo.
  repo : /.../kit-cua-toi
  đích : /.../kit-cua-toi/backup
  Sao lưu vào chỗ chết cùng bản gốc thì không phải sao lưu — nó chỉ làm bạn YÊN TÂM SAI.
mã thoát = 2
```

```bash
# Lần 3 — đích ngoài repo (đối chứng âm: PHẢI chạy được)
KNOWLEDGE_BACKUP_DIR=~/sao-luu-kit node scripts/qa/sao-luu-knowledge.js; echo "mã thoát = $?"
```

Ra `0` và có thư mục `knowledge-<ngày>` kèm `_ban-ke.json`.

> Lần 3 là đối chứng âm, và nó quan trọng đúng bằng lần 2. Máy chỉ biết từ chối thì bạn sẽ tắt nó.

### Khôi phục — thử **một lần**, ngay bây giờ

Sao lưu chưa từng khôi phục là sao lưu chưa được nghiệm thu. Làm ngay:

```bash
mv knowledge knowledge-cu                                # giấu bản gốc
cp -r ~/sao-luu-kit/knowledge-<ngày>/ knowledge          # khôi phục
rm knowledge/_ban-ke.json
npm run kiem:knowledge                                   # gate Bài 26 phải ĐẠT
```

Đạt thì bản sao lưu dùng được thật. Xong thì trả lại: `rm -rf knowledge && mv knowledge-cu knowledge`.

## Việc 3 — Khai ngưỡng tỉa trước, và chia sẻ kho (25 phút)

### Vì sao phải khai trước

Ngưỡng tỉa khai sau khi dữ liệu đã tích thì bạn quyết định trong tình huống tệ nhất: đĩa đầy, cần dọn
gấp, và mọi tệp đều "có vẻ cần". Lúc đó người ta xoá theo ngày, và ngày không liên quan gì tới giá trị.

`.agent/config/vong-doi-du-lieu.json`:

```json
{
  "$schema": "vòng đời từng loại dữ liệu. KHAI TRƯỚC khi dữ liệu tích lại.",
  "loai": {
    "knowledge": { "giuBanSaoLuu": 10, "tia": "không bao giờ",
      "lyDo": "mất hẳn — không hệ thống nào khác có" },
    "outputs-evidence": { "giuNgay": 90, "tia": "theo ngày",
      "lyDo": "nạp lại được bằng cách chạy lại, nhưng tốn; 90 ngày đủ cho vòng đối chất với dev" },
    "outputs-status": { "giuNgay": 365, "tia": "theo ngày",
      "lyDo": "nhẹ, và là đầu vào của metrics 12 tháng (Bài 25)" },
    "mutation-diem": { "giuNgay": 0, "tia": "không bao giờ",
      "lyDo": "mốc so sánh theo tháng; tỉa là mất đường xu hướng" },
    "test-results-raw": { "giuNgay": 14, "tia": "theo ngày",
      "lyDo": "artifact của runner, sinh lại mỗi lượt chạy" }
  }
}
```

Hai dòng `"tia": "không bao giờ"` là hai dòng đáng nhìn kỹ: chúng nhỏ, và chúng là thứ không mua lại được.
Tỉa thứ nhẹ mà quý là lỗi kinh điển của dọn dẹp gấp.

### Chia sẻ kho khi team đông lên

Một người thì `knowledge/` nằm trên máy bạn là đủ. Ba người trở lên thì có ba câu hỏi mới:

| Câu hỏi | Cách rẻ |
|---|---|
| Ai cũng thấy tri thức mới? | một repo **riêng, private** cho `knowledge/`, mỗi máy `git pull` |
| Hai người ghi mâu thuẫn thì sao? | gate Bài 26 bắt "hai bản cùng `active`" — chạy nó ở **cửa đọc**, mỗi máy tự chạy |
| Ai được sửa? | ai cũng **thêm** được; đổi `active` → `superseded`/`invalid` thì cần người thứ hai duyệt |

Điểm cần cẩn thận: repo riêng cho `knowledge/` phải **private**, và vẫn áp `kiem-file-cam.js`, vì nó chứa
đúng thứ Bài 2 nói là không được để lộ, kể cả qua tên tệp.

> Đừng nhét `knowledge/` thành submodule của repo kit. Nghe gọn, nhưng người clone kit sẽ vô tình kéo cả kho
> tri thức về, và bạn mất đúng ranh giới mình vừa dựng.

## Gọi tên những gì bạn vừa làm

| Từ | Nghĩa gọn |
|---|---|
| **Nạp lại được** | Mất thì kéo lại từ nguồn gốc (Backlog, công cụ test-management, git) |
| **Do người tạo** | Không có nguồn nào khác. Mất là **mất hẳn** |
| **Tỉa** (prune) | Xoá bớt dữ liệu cũ theo luật đã khai trước |

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .agent/config/
│   └── vong-doi-du-lieu.json         ← MỚI · giữ bao lâu, tỉa thế nào, kèm LÝ DO từng loại
└── scripts/qa/
    └── sao-luu-knowledge.js          ← MỚI · đích trong repo ⇒ exit 2 (kể cả qua symlink)

<ngoài repo>
└── ~/sao-luu-kit/                    ← MỚI · nơi bản sao thật sự sống
    └── knowledge-2026-09-08-10-30-00/
        ├── domain/ · decisions/ · fixture/ · leak/
        └── _ban-ke.json              ·  bản kê để lần khôi phục biết bản này có gì
```

Đây là bài duy nhất trong tài liệu này có nhánh nằm ngoài repo, và đó chính là nội dung của bài.

## Tự kiểm

1. Kể bốn loại dữ liệu **mất hẳn** trong kit. Vì sao git không cứu được chúng?
2. Vì sao để bản sao lưu trong thư mục repo lại *"nguy hiểm hơn không sao lưu"*?
3. Vì sao gate dùng `realpath` chứ không chỉ so chuỗi đường dẫn?
4. Sao lưu chưa từng khôi phục thì gọi là gì? Bạn đã thử chưa?
5. Vì sao ngưỡng tỉa phải khai trước khi dữ liệu tích lại?
6. Hai loại nào `"tia": "không bao giờ"`? Chúng có điểm gì chung?
7. Vì sao không nên để `knowledge/` thành submodule của repo kit?

## Bài tập về nhà (25 phút)

1. Khai `KNOWLEDGE_BACKUP_DIR` trỏ ra ngoài repo. Chạy sao lưu. Kiểm bằng mắt là tệp có ở đó thật.
2. Khôi phục thật theo Việc 2, và chạy `kiem-tri-thuc.js` trên bản khôi phục. Đạt mới tính là xong.
3. Điền `vong-doi-du-lieu.json` cho dự án bạn. Với **mỗi** loại, viết `lyDo`, nếu không viết nổi lý do thì
   bạn chưa biết dữ liệu đó dùng làm gì, và đó là thứ cần biết trước khi quyết giữ hay xoá.
4. Đặt một nhắc lịch **hàng tuần** chạy sao lưu. Không tự động hoá được thì nhắc tay còn hơn không có gì —
   nhưng ghi vào nhịp bảo dưỡng (Bài 29) để nó không phụ thuộc trí nhớ.

## Đọc thêm

- Bài 26 — [knowledge base có kỷ luật](knowledge-base.md): bản `superseded` là thứ sao lưu phải
  giữ, vì nó trả lời *"lượt chạy tháng trước dùng luật nào?"*.
- Bài 25 — metrics: `outputs-status` giữ 365 ngày là để có đường xu hướng 12 tháng.
- Bài 2 — [Git](git-tu-so-0.md): vì sao chính **tên tệp** trong `knowledge/` cũng là dữ liệu nhạy cảm.
