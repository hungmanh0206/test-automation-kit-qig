# Bài 5 — Khi một testcase bắt đầu trở thành một project

> **1 giờ 30 phút** · Có gì trong tay: một test chạy được, mọi thứ nằm trong một file · Sau bài này: bộ khung thư mục mà mọi bài sau sẽ lấp đầy

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Một file test thì ổn. Đến file thứ mười thì bạn copy một đoạn cũ sang, sửa một bản, quên bản kia. |
| **Bài này bạn gõ gì** | Dựng cây thư mục bốn nhóm, và đặt quy ước tên file. |
| **Xong thì được gì** | Một bộ khung mà mọi bài sau chỉ việc đặt đúng chỗ, không phải nghĩ lại. |

> Bài này có vài từ mới. Chúng được gọi tên ở **cuối bài**, sau khi bạn đã chạm vào chúng,
> chứ không định nghĩa trước. Gặp từ lạ giữa bài thì đọc tiếp, mục đó sẽ gom lại.

## Bài này bạn sẽ làm gì

Bốn việc:

1. Xem một file duy nhất hỏng ở đâu (20 phút).
2. Dựng cây thư mục bốn nhóm (20 phút).
3. Đặt tên file test để sáu tháng sau vẫn tìm được (25 phút).
4. Đặt quy ước cô lập theo task (25 phút).

---

## Việc 1 — Một file hỏng ở đâu (20 phút)

Bài 4 bạn có một file test. Nó ổn. Thả thêm chín file nữa vào cùng chỗ thì bốn chuyện xảy ra, và
không chuyện nào lộ ra ngay:

| Chuyện | Lộ ra khi nào |
|---|---|
| Đoạn đăng nhập bị copy sang từng file | Sửa một bản, quên tám bản còn lại |
| Không biết file nào kiểm luật nào | Requirement đổi, không biết phải sửa ở đâu |
| Code dựng dữ liệu nằm lẫn với code kiểm | Sửa cách dựng dữ liệu làm đỏ cả những test không liên quan |
| Không chạy riêng được một nhóm | Mỗi lần muốn kiểm một thứ phải chạy cả bộ |

Để thấy tận mắt, làm thử: copy file test của Bài 4 thành ba bản, mỗi bản đổi một chút dữ liệu.

**Bạn sẽ thấy** ba file giống nhau tới 80%. Ba dòng mở trang, ba đoạn chọn khách, ba đoạn chọn sản
phẩm. Giờ đổi nhãn ô "Khách hàng" trên giao diện thành "Người mua" và đếm xem bạn phải sửa mấy chỗ.

Đó là toàn bộ lý do của bài này. Không phải để gọn gàng, mà để **một thay đổi chỉ phải sửa ở một chỗ**.

## Việc 2 — Dựng cây thư mục (20 phút)

```text
kit-cua-toi/
├── .agent/
│   ├── config/          # cấu hình cho MÁY đọc: danh mục, ngưỡng, mô hình rủi ro
│   ├── rules/           # luật cho agent
│   ├── skills/          # năng lực chuyên biệt, agent mở khi cần
│   └── workflows/       # các bước của từng chặng
├── prompt_templates/    # điểm vào: chạy một chặng thì đọc file nào
├── scripts/qa/          # máy chặn
├── tests/               # test tự động
├── knowledge/           # bộ nhớ dự án. Không đưa lên git
├── profiles/<TASK>/     # tài khoản riêng theo task. Không đưa lên git
├── outputs/             # kết quả theo task. Không đưa lên git
├── CLAUDE.md            # file luật ngắn, agent luôn nhìn thấy
└── LUAT-DAY-DU.md       # file luật đầy đủ, tra khi cần
```

Bốn nhánh cuối không đưa lên git: `knowledge`, `profiles/*/task.env`, `outputs`, và `.env`. Chúng là dữ liệu,
không phải mã. Trộn hai loại này vào nhau là nguồn của cả rò rỉ lẫn xung đột.

Tạo khung:

```bash
mkdir -p .agent/config .agent/rules .agent/skills .agent/workflows \
         prompt_templates scripts/qa tests knowledge profiles outputs
printf '# Bộ nhớ dự án\n\nKhông đưa lên git. Đây là dữ liệu công ty.\n' > knowledge/README.md
```

## Việc 3 — Đặt tên file test (25 phút)

Sáu tháng sau, ai đó hỏi *"case kiểm giảm giá theo hạng khách nằm ở đâu"*. Bạn có 200 file.

Ba cách đặt tên, và cách thứ ba trả lời được câu trên:

| Cách | Ví dụ | Tìm bằng cách nào |
|---|---|---|
| Theo màn hình | `trang-tao-don.spec.js` | Phải mở ra đọc, vì một màn có mười luật |
| Theo số thứ tự | `test-01.spec.js` | Không tìm được |
| Theo **luật nghiệp vụ** | `br-03-giam-gia-theo-hang.spec.js` | `grep BR-03` ra ngay |

Quy ước nên dùng:

```
tests/e2e/<mã-luật>-<mô-tả-ngắn>.spec.js
```

Và bên trong file, tên test mang luôn mã luật:

```js
const { test } = require('@playwright/test');

test('BR-03: khách hạng Bạc được giảm 3% trên tạm tính', async ({ page }) => {
  // ...
});
```

Hai lợi ích, và cái thứ hai mới là cái đáng giá:

1. Tìm được bằng `grep`, không phải mở từng file.
2. Khi test đỏ, dòng báo lỗi **tự nó nói luật nào bị phá**. Người đọc CI không cần mở source.

Điều thứ hai sẽ quay lại ở Bài 18: khi đẩy kết quả lên hệ quản lý test chung, mã luật trong tên test
chính là sợi dây nối ngược từ một lượt chạy về requirement.

> Một lỗi hay gặp: đặt tiền tố hằng số vào mọi tên, kiểu `[AUTO] BR-03: ...`. Tiền tố giống nhau ở
> mọi dòng thì không phân biệt được gì, chỉ tốn chỗ. Phân loại thì dùng tag (`@mobile`, `@smoke`).

## Việc 4 — Cô lập theo task (25 phút)

Ba biến, đặt ngay từ đầu:

| Biến | Ví dụ | Dùng làm gì |
|---|---|---|
| `MA_TASK` | `PROJ-1234` | Mã task, quyết định mọi đường dẫn |
| `THU_MUC_KET_QUA` | `outputs/crm` | Thư mục gốc chứa kết quả |
| `TASK_ENV` | `profiles/PROJ-1234/task.env` | Tài khoản riêng của task |

Mọi kết quả đi vào `<THU_MUC_KET_QUA>/tasks/<MA_TASK>/`, bên trong chia bốn phần:

```
requirements/   tài liệu đầu vào đã tải về
test-cases/     testcase và file Excel
test-results/   kết quả chạy, ảnh, video
reports/        các bản tóm tắt
```

Tạo file mẫu:

```bash
mkdir -p profiles/PROJ-1234
cat > profiles/task.env.example <<'EOF'
# Mẫu. Copy thành profiles/<MÃ-TASK>/task.env rồi điền.
# File task.env thật thì không đưa lên git.
MA_TASK=PROJ-1234
THU_MUC_KET_QUA=outputs/crm
APP_BASE_URL=
APP_USERNAME=
APP_PASSWORD=
EOF
```

Vì sao không dùng một file `.env` chung? Vì có tuần bạn làm hai task cùng lúc. Hai task cần hai bộ tài khoản
và hai thư mục kết quả khác nhau. Dùng chung một file thì task này sửa, task kia hỏng. Và hỏng kiểu im lặng:
agent đăng nhập bằng tài khoản sai rồi vẫn báo cáo bình thường.

## Gọi tên những gì bạn vừa làm

| Từ | Nghĩa gọn |
|---|---|
| **Hạ tầng test** | Code phục vụ việc test nhưng bản thân không phải test |
| **Thư viện** | Code dùng chung, gọi `node <file>` không chạy được |
| **Máy chặn** | File tự chạy được, báo lỗi rồi thoát với mã khác 0 |
| **Cô lập theo task** | Mỗi task một thư mục kết quả riêng, không đè lên nhau |

## Cây thư mục sau bài này

```
kit-cua-toi/
├── CLAUDE.md                     ← MỚI · dưới 20 dòng, agent luôn nhìn thấy
├── LUAT-DAY-DU.md                ← MỚI · bản đầy đủ, một mục Bảo mật
├── .agent/
│   ├── config/                   ← MỚI · để trống, các bài sau sẽ điền
│   ├── rules/                    ← MỚI
│   ├── skills/                   ← MỚI
│   └── workflows/                ← MỚI
├── prompt_templates/             ← MỚI (rỗng) · Bài 15 mới điền vào
├── profiles/
│   └── task.env.example          ← MỚI · bản mẫu, PHẢI đưa lên git
├── knowledge/README.md           ← MỚI · nhắc là thư mục này không lên git
├── scripts/qa/
│   └── kiem-so-mong-doi.js       ·  từ Bài 1
└── tests/api/
    └── don-hang-bac.js           ·  từ Bài 1
```

Để ý `profiles/task.env.example` có đưa lên git, còn `profiles/PROJ-1234/task.env` thì không. Bản mẫu không
chứa giá trị thật, và người mới cần nó để biết phải khai những biến gì.

## Bộ kit của bạn đang ở đâu

```
CẤP ĐỘ 2 · BUILD      bài 1/7 của cấp độ này
████░░░░░░░░░░░░░░░░░░░░░░░░

cả tài liệu           bài 5/29
█████░░░░░░░░░░░░░░░░░░░░░░░
```

**Hết cấp độ 2 bạn nói được:** Tôi có một Test Kit.

Cấp độ này còn 6 bài nữa.

## Tự kiểm

1. Vì sao `CLAUDE.md` phải dưới 20 dòng? Nhồi 400 dòng vào thì hỏng chuyện gì?
2. Hai file luật, file nào quyết khi chúng nói khác nhau?
3. Bốn nhánh nào không đưa lên git? Mỗi nhánh vì lý do gì?
4. Bạn làm hai task cùng lúc, dùng chung `.env`. Chuyện gì hỏng, và vì sao bạn không nhận ra ngay?
5. Cái bẫy ở Việc 4 kiểm điều gì? Agent làm sao thì gọi là tuân?
6. Agent ghi PASS luôn. Vì sao không nên sửa prompt để chữa?

## Bài tập về nhà

Đọc lại `CLAUDE.md` của bạn, đọc từng điều một, và tự hỏi:

> Nếu agent vi phạm điều này, tôi có cách nào biết không?

Điều nào trả lời "không" thì đánh dấu lại. Đó chính là danh sách máy chặn bạn sẽ dựng từ Bài 15 trở đi, và
thứ tự ưu tiên là thứ tự mức nguy hiểm.

## Bài sau

Bài 6 hỏi tiếp: cấu trúc thư mục xong rồi, nhưng URL và tài khoản vẫn nằm trong code. Mai chuyển bộ
automation này sang một sản phẩm khác thì phải sửa bao nhiêu chỗ.
