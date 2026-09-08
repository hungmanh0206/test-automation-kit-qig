# Bài 6 — Tách môi trường khỏi testcase

> **2 giờ** · Có gì trong tay: cấu trúc thư mục đã dựng, URL và tài khoản vẫn nằm trong code · Sau bài này: testcase không cần biết nó đang chạy ở dự án nào

**Vấn đề**

Bộ test của bạn đang chạy trên môi trường thử nghiệm của OPS.

Tuần sau bạn được giao thêm việc trên LMS. Khác hệ, khác địa chỉ, khác cả cách đăng nhập: OPS thì
form rồi cookie, còn LMS thì token qua Keycloak.

Nếu để chuyển sang hệ thứ hai bạn phải sửa `page.goto('https://...')` trong tám mươi testcase, thì
thứ bạn đang có không phải một bộ kit.


**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | URL, tài khoản và nơi ghi kết quả đang gắn cứng với dự án hiện tại. Mai chuyển sang sản phẩm khác là phải sửa nhiều nơi. |
| **Bài này bạn gõ gì** | Tách cấu hình ra khỏi testcase, viết một hàm nạp duy nhất, và khai danh sách biến được phép đọc. |
| **Xong thì được gì** | Đổi dự án bằng cách đổi một file cấu hình, không đụng vào testcase. |

> Bài này có vài từ mới. Chúng được gọi tên ở **cuối bài**, sau khi bạn đã chạm vào chúng,
> chứ không định nghĩa trước. Gặp từ lạ giữa bài thì đọc tiếp, mục đó sẽ gom lại.

## Bài này bạn sẽ làm gì

Ở Bài 4 bạn viết được một test. Nhưng có một vấn đề: URL, tài khoản đăng nhập và nơi ghi kết quả
hiện vẫn gắn với dự án đang dùng.

Nếu ngày mai bạn chuyển bộ automation này sang một sản phẩm khác, bạn sẽ phải sửa code ở nhiều nơi.
Và sửa ở nhiều nơi thì sẽ có chỗ bị bỏ sót.

Đây là lúc cần tách cấu hình ra khỏi testcase.

Bốn việc:

1. Đếm xem hiện có bao nhiêu chỗ gắn cứng (20 phút).
2. Ba tầng cấu hình và ranh giới giữa chúng (30 phút).
3. Viết một hàm nạp duy nhất (40 phút).
4. **Xây gate:** biến lạ thì chặn, không im lặng chạy sai (30 phút).

---

## Việc 1 — Đếm chỗ gắn cứng (20 phút)

Trước khi sửa, đo đã. Mở test của bạn và tìm mọi giá trị chỉ đúng với dự án hiện tại:

```bash
grep -rn "localhost:4010\|http://\|https://" tests/ playwright.config.js
```

**Bạn sẽ thấy** ít nhất hai chỗ: `baseURL` trong config, và có thể vài chỗ trong test. Với bộ test
thật của một dự án đang chạy, con số này thường là vài chục.

Bốn nhóm giá trị luôn phải tách ra, và lý do khác nhau:

| Nhóm | Ví dụ | Vì sao phải tách |
|---|---|---|
| Địa chỉ | `baseURL`, endpoint API | Mỗi môi trường một địa chỉ, mỗi dự án một bộ |
| Danh tính | tài khoản, mật khẩu, token | Là bí mật. Không được nằm trong repo |
| Nơi ghi kết quả | thư mục output | Mỗi task một thư mục, không đè lên nhau |
| Hằng số nghiệp vụ | mốc miễn phí dịch vụ | Mỗi sản phẩm một luật |

Nhóm cuối hay bị bỏ quên. Nó không trông giống "cấu hình", nó trông giống một con số bình thường
trong test. Nhưng mang bộ test sang sản phẩm khác thì nó là thứ sai đầu tiên, và sai im lặng.

## Việc 2 — Ba tầng cấu hình (30 phút)

Không phải mọi cấu hình đều cùng loại. Ba tầng, ba vòng đời:

| Tầng | Nằm ở | Đổi khi nào | Có commit không |
|---|---|---|---|
| Mặc định của kit | `.env.example` | Hiếm khi | **Có**, để người mới biết cần khai gì |
| Cấu hình dự án | `.env` | Khi đổi dự án | **Không** |
| Cấu hình một task | `profiles/<MÃ-TASK>/task.env` | Mỗi task | **Không** |

Thứ tự nạp: mặc định trước, dự án đè lên, task đè lên trên cùng.

Vì sao cần tầng thứ ba, khi hai tầng nghe đã đủ. Vì hai task có thể chạy cùng lúc trên hai môi
trường khác nhau. Một task test trên môi trường staging, một task test trên môi trường thử nghiệm của
sprint sau. Nếu cả hai cùng đọc một file `.env` thì task này đổi cấu hình là task kia hỏng, mà hỏng
theo kiểu khó thấy: test vẫn chạy, chỉ là chạy nhầm chỗ.

Tạo `.env.example` và commit nó:

```bash
# .env.example — bản mẫu. Copy thành .env rồi điền giá trị thật.
BASE_URL=
API_URL=
TAI_KHOAN=
MAT_KHAU=
THU_MUC_KET_QUA=./outputs
```

Rồi `.gitignore` đã chặn `.env` từ Bài 2. Kiểm lại cho chắc:

```bash
git check-ignore -v .env
```

**Bạn sẽ thấy** nó in ra dòng luật trong `.gitignore` đang chặn. Không in gì tức là chưa chặn, quay
lại Bài 2 sửa.

### Cấu hình theo task

```
profiles/
└── DEMO-1/
    └── task.env          ⛔ không commit
```

```bash
MA_TASK=DEMO-1
BASE_URL=http://localhost:4010
THU_MUC_KET_QUA=./outputs
```

Vì sao mỗi task một thư mục riêng chứ không phải một file `task-DEMO-1.env` chung một chỗ: vì task
còn có thứ khác ngoài biến môi trường, và Bài 11 sẽ thêm vào đây. Dựng sẵn hình dạng đúng thì sau
không phải chuyển.

## Việc 3 — Một hàm nạp duy nhất (40 phút)

Điều quan trọng nhất của bài này: **testcase không được tự đọc biến môi trường**. Nếu mỗi test tự gọi
`process.env.BASE_URL` thì bạn vẫn có cấu hình rải khắp nơi, chỉ là rải dưới một cái tên khác.

Một cửa duy nhất. Tạo `scripts/lib/config.js`:

```js
'use strict';
const fs = require('fs');
const path = require('path');

const GOC = path.resolve(__dirname, '..', '..');

/* Đọc file dạng KEY=value. Không dùng thư viện ngoài cho việc 15 dòng. */
function docEnv(duongDan) {
  if (!fs.existsSync(duongDan)) return {};
  const ra = {};
  for (const dong of fs.readFileSync(duongDan, 'utf8').split('\n')) {
    const s = dong.trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf('=');
    if (i < 0) continue;
    ra[s.slice(0, i).trim()] = s.slice(i + 1).trim();
  }
  return ra;
}

/*
 * Nạp theo tầng: mặc định → dự án → task. Tầng sau đè tầng trước.
 *
 * KHÔNG nạp biến của môi trường đang chạy (process.env) vào đây. Lý do đã trả giá thật: tiến
 * trình con thừa hưởng biến của tiến trình cha, nên một biến còn sót từ lượt chạy trước làm test
 * xanh trên máy dev và đỏ trên CI. Cấu hình phải đến từ file khai được, đọc được, so được.
 */
function napCauHinh(maTask) {
  const gop = {
    ...docEnv(path.join(GOC, '.env.example')),
    ...docEnv(path.join(GOC, '.env')),
    ...(maTask ? docEnv(path.join(GOC, 'profiles', maTask, 'task.env')) : {}),
  };

  const thieu = ['BASE_URL', 'THU_MUC_KET_QUA'].filter((k) => !gop[k]);
  if (thieu.length) {
    throw new Error(
      `Thiếu cấu hình bắt buộc: ${thieu.join(', ')}\n` +
      `Copy .env.example thành .env rồi điền, hoặc khai trong profiles/${maTask || '<MÃ>'}/task.env`
    );
  }
  return gop;
}

/* Nơi ghi kết quả của MỘT task. Mỗi task một thư mục, không đè lên nhau. */
function thuMucKetQua(cauHinh, maTask) {
  return path.join(cauHinh.THU_MUC_KET_QUA, 'tasks', maTask);
}

module.exports = { napCauHinh, thuMucKetQua };
```

Nối vào `playwright.config.js`:

```js
const { napCauHinh } = require('./scripts/lib/config');
const cauHinh = napCauHinh(process.env.MA_TASK);

module.exports = {
  use: { baseURL: cauHinh.BASE_URL },
  // ... phần còn lại từ Bài 3
};
```

Chạy lại test của Bài 4:

```bash
MA_TASK=DEMO-1 npx playwright test
```

**Bạn sẽ thấy** nó chạy y như cũ. Không có gì mới xảy ra, và đó là dấu hiệu tốt: bạn vừa đổi cách
cấu hình đi vào hệ thống mà không đổi hành vi.

| Thấy khác | Nghĩa là | Làm gì |
|---|---|---|
| `Thiếu cấu hình bắt buộc: BASE_URL` | Chưa có `.env` hoặc chưa có `task.env` | Đọc đúng câu thông báo, nó nói luôn chỗ khai |
| `Cannot find module './scripts/lib/config'` | Đường dẫn tương đối sai | Kiểm lại vị trí `playwright.config.js` so với `scripts/` |
| Test đỏ vì `net::ERR_CONNECTION_REFUSED` | `BASE_URL` khai sai cổng | So với cổng app thực hành đang mở |

Để ý câu thông báo lỗi. Nó không nói "thiếu cấu hình" rồi dừng, nó nói **thiếu cái gì** và **khai ở
đâu**. Đây là mẫu chung cho mọi thứ bạn viết từ giờ: người đọc thông báo lỗi phải sửa được ngay mà
không cần mở source ra đọc.

## Việc 4 — Xây gate: biến lạ thì chặn (30 phút)

Có một kiểu hỏng rất khó thấy: bạn gõ nhầm tên biến.

```bash
BASE_UR=http://localhost:4010     # thiếu chữ L
```

Hàm nạp ở trên sẽ bắt được, vì `BASE_URL` nằm trong danh sách bắt buộc. Nhưng với biến không bắt
buộc thì không ai bắt. Nó im lặng nhận giá trị mặc định, test vẫn chạy, và chạy sai.

Chữa bằng cách đảo ngược: khai danh sách biến **được phép**, gặp biến ngoài danh sách thì chặn.

`.agent/config/env-allow.json`:

```json
{
  "batBuoc": ["BASE_URL", "THU_MUC_KET_QUA"],
  "tuyChon": {
    "API_URL": "địa chỉ API, mặc định lấy theo BASE_URL",
    "TAI_KHOAN": "tài khoản đăng nhập, chỉ cần cho test có login",
    "MAT_KHAU": "mật khẩu, KHÔNG commit",
    "MA_TASK": "mã task, quyết định profile nào được nạp"
  }
}
```

Mỗi biến tuỳ chọn phải có mô tả. Không phải để đẹp, mà vì sáu tháng sau bạn sẽ gặp một biến không
nhớ dùng làm gì, và không dám xoá.

`scripts/qa/kiem-cau-hinh.js`:

```js
#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { napCauHinh } = require('../lib/config');

const GOC = path.resolve(__dirname, '..', '..');
const KHAI = JSON.parse(fs.readFileSync(path.join(GOC, '.agent/config/env-allow.json'), 'utf8'));

const maTask = process.argv[2];
let cauHinh;
try {
  cauHinh = napCauHinh(maTask);
} catch (e) {
  console.error('[cau-hinh] ✗ CHẶN — ' + e.message);
  process.exit(1);
}

const duocPhep = new Set([...KHAI.batBuoc, ...Object.keys(KHAI.tuyChon)]);
const la = Object.keys(cauHinh).filter((k) => !duocPhep.has(k));

if (la.length) {
  console.error('[cau-hinh] ✗ CHẶN — biến không có trong danh sách cho phép: ' + la.join(', '));
  console.error('           Gõ nhầm tên thì sửa. Biến mới thật thì khai vào .agent/config/env-allow.json kèm mô tả.');
  process.exit(1);
}

console.log(`[cau-hinh] ✓ ${Object.keys(cauHinh).length} biến, đều đã khai.`);
```

Khai lệnh vào `package.json`:

```json
"scripts": {
  "kiem:cau-hinh": "node scripts/qa/kiem-cau-hinh.js"
}
```

### Đối chứng: chứng minh nó chặn thật

Một gate chưa từng chặn thì bạn chưa biết nó có chạy hay không. Hai phép thử, và **cả hai đều bắt
buộc**:

```bash
# Ca phải CHO QUA
npm run kiem:cau-hinh -- DEMO-1
# → [cau-hinh] ✓ 5 biến, đều đã khai.   (mã thoát 0)

# Ca phải CHẶN — thêm một biến gõ nhầm vào profiles/DEMO-1/task.env
echo "BASE_UR=http://localhost:4010" >> profiles/DEMO-1/task.env
npm run kiem:cau-hinh -- DEMO-1
# → [cau-hinh] ✗ CHẶN — biến không có trong danh sách cho phép: BASE_UR   (mã thoát 1)
```

Rồi xoá dòng vừa thêm.

Chỉ chạy ca thứ nhất thì bạn mới biết gate **không chê bừa**. Phải chạy cả ca thứ hai mới biết nó
**bắt được thật**. Đây là công thức dùng lại cho mọi gate còn lại của tài liệu, và Bài 15 sẽ đặt tên
cho nó.

## Gọi tên những gì bạn vừa làm

| Từ | Nghĩa gọn |
|---|---|
| **Biến môi trường** | Giá trị đưa vào chương trình từ bên ngoài, không nằm trong code |
| **Profile** | Một bộ cấu hình cho một task hoặc một dự án. Mỗi profile một thư mục |
| **Nạp theo tầng** | Đọc nhiều nguồn cấu hình theo thứ tự, nguồn sau đè nguồn trước |
| **Allowlist** | Danh sách những thứ được phép. Nằm ngoài danh sách thì chặn, không im lặng bỏ qua |

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .env.example                  ← MỚI · bản mẫu, CÓ commit
├── .env                          ← MỚI · giá trị thật, ⛔ không commit
├── playwright.config.js          ·  từ Bài 3, nay đọc qua config.js
├── .agent/
│   └── config/
│       └── env-allow.json        ← MỚI · biến nào được đọc, kèm mô tả
├── profiles/
│   └── DEMO-1/
│       └── task.env              ← MỚI · ⛔ không commit
├── scripts/
│   ├── lib/
│   │   └── config.js             ← MỚI · CỬA DUY NHẤT tới cấu hình
│   └── qa/
│       ├── kiem-file-cam.js      ·  từ Bài 2
│       └── kiem-cau-hinh.js      ← MỚI · biến lạ ⇒ chặn
└── tests/
    └── e2e/
        └── tao-don-hang.spec.js  ·  từ Bài 4
```

## Bộ kit của bạn đang ở đâu

```
CẤP ĐỘ 2 · BUILD      bài 2/7 của cấp độ này
████████░░░░░░░░░░░░░░░░░░░░

cả tài liệu           bài 6/29
██████░░░░░░░░░░░░░░░░░░░░░░
```

**Hết cấp độ 2 bạn nói được:** Tôi có một Test Kit.

Cấp độ này còn 5 bài nữa.

## Tự kiểm

1. Bốn nhóm giá trị phải tách khỏi testcase là gì? Nhóm nào hay bị bỏ quên nhất?
2. Ba tầng cấu hình, và thứ tự nạp?
3. Vì sao cần tầng thứ ba (theo task) khi hai tầng nghe đã đủ?
4. Vì sao testcase không được tự gọi `process.env`?
5. Vì sao hàm nạp cố ý **không** đọc biến của môi trường đang chạy?
6. Gate `kiem-cau-hinh` chặn kiểu sai nào mà hàm nạp không chặn được?
7. Vì sao mỗi biến tuỳ chọn bắt buộc phải có mô tả?
8. Hai phép đối chứng của một gate là gì, và bỏ phép nào thì bạn không biết điều gì?

## Bài tập về nhà

Tạo thêm `profiles/DEMO-2/task.env` trỏ tới một cổng khác, ví dụ `4011`. Chạy app thực hành lần thứ
hai ở cổng đó:

```bash
PORT=4011 node docs/course/assets/app-thuc-hanh/server.js
```

Rồi chạy cùng một bộ test trên hai profile:

```bash
MA_TASK=DEMO-1 npx playwright test
MA_TASK=DEMO-2 npx playwright test
```

Không sửa một dòng testcase nào. Nếu bạn phải sửa thì còn một chỗ gắn cứng chưa tách, tìm cho ra.

## Bài sau

Bài 7 hỏi tiếp: cấu hình tách rồi, còn dữ liệu test thì sao. Test của bạn đang dùng khách `HV02` có
sẵn trên app. Chuyện gì xảy ra khi hai test cùng sửa `HV02`, hoặc khi môi trường được reset và
`HV02` biến mất.
