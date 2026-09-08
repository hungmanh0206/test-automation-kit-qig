# Bài 19 — Khi nào một lần Fail thực sự trở thành Bug?

> **2 giờ** · Có gì trong tay: một phát hiện đã qua triage và xác nhận là lỗi sản phẩm · Sau bài này: bug đi đúng người, đủ thông tin, và Dev không phải hỏi lại

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Bug log lên bị trả về với lý do "không tái hiện được", hoặc nằm im vì gán nhầm người. |
| **Bài này bạn gõ gì** | Bốn phần bắt buộc của một bug report, cách gán theo tầng lỗi, và một máy tạo bug từ kết quả chạy. |
| **Xong thì được gì** | Bug Dev đọc là làm được, và một đường rerun sau khi fix. |

## Từ mới của bài này

| Từ | Nghĩa gọn |
|---|---|
| **Triage** | Chặng phân loại giữa "test đỏ" và "bug". Bỏ chặng này thì Dev trả về |
| **Tầng lỗi** | Lỗi nằm ở giao diện, ở phía sau, ở dữ liệu, hay ở môi trường |
| **Bug ma** | Bug không tồn tại, sinh ra vì tiền điều kiện dựng sai |
| **Rerun** | Chạy lại sau khi Dev fix, để xác nhận |

## Bài này bạn sẽ làm gì

Bốn việc:

1. Từ Failed tới Bug: chặng nằm giữa (20 phút).
2. Bốn phần bắt buộc, không thêm (35 phút).
3. Gán đúng người theo tầng lỗi (30 phút).
4. Rerun, và một cái bẫy về thời điểm (35 phút).

---

## Việc 1 — Chặng nằm giữa (20 phút)

Một testcase Failed chưa đồng nghĩa với một Bug.

Bài 17 đã dựng chặng triage. Đây là chỗ dùng kết quả của nó. Trước khi tạo defect, năm câu hỏi phải
có câu trả lời:

| # | Câu hỏi | Trả lời "không" thì |
|---|---|---|
| 1 | Kết quả mong đợi có đúng không? | Sửa testcase, không log bug |
| 2 | Dữ liệu test có hợp lệ không? | Sửa fixture, không log bug |
| 3 | Môi trường có ổn định không? | Chờ rồi chạy lại |
| 4 | Có phải test chập chờn không? | Sửa test, không log bug |
| 5 | Chạy lại có tái hiện không? | Chưa đủ căn cứ để log |

Câu 1 là câu hay bị bỏ nhất, và nó tốn nhiều thời gian của Dev nhất. Test đỏ vì hai con số khác nhau,
và một trong hai sai. Phản xạ là tin con số trong testcase. Nhưng testcase cũng do người viết, và
người thì đọc nhầm tài liệu.

Câu 2 dẫn tới thứ Bài 8 gọi là **bug ma**: tiền điều kiện dựng bằng đường tắt, tạo ra một trạng thái
sản phẩm không bao giờ tự sinh ra được. Sản phẩm xử lý sai trạng thái đó là chuyện dễ hiểu, và nó
không phải bug.

Chỉ khi cả năm câu đều "có" thì mới sang bước sau.

## Việc 2 — Bốn phần bắt buộc (35 phút)

Một bug report Dev không phải hỏi lại gồm đúng bốn phần. Không thêm.

```markdown
## Mô tả
Đơn hàng ở trạng thái CONFIRMED vẫn sửa được qua API. Vi phạm BR-07.

## Các bước tái hiện
1. Tạo đơn: POST /api/orders  { khachId: "KH02", items: [{ sanPhamId: "SP01", soLuong: 1 }] }
2. Xác nhận đơn: POST /api/orders/<id>/confirm
3. Sửa đơn: PATCH /api/orders/<id>  { items: [{ sanPhamId: "SP01", soLuong: 99 }] }

## Kết quả mong đợi
Bước 3 bị từ chối với mã 4xx. Nguồn: spec.md BR-07 — "Đơn ở trạng thái CONFIRMED không được sửa."

## Kết quả thực tế
Bước 3 trả về HTTP 200. Đơn đã đổi số lượng thành 99.
```

Bốn quy tắc, mỗi cái đến từ một lần bị trả về:

**Các bước phải khớp fixture thật.** Viết *"tạo một đơn hàng"* thì Dev tạo theo cách của họ, gặp trạng
thái khác, không tái hiện được, và trả về. Ghi đúng lời gọi bạn đã dùng.

**Kết quả mong đợi phải trích nguồn.** Câu *"đáng lẽ phải bị chặn"* là ý kiến. Câu *"spec.md BR-07 nói
không được sửa"* là căn cứ. Không có nguồn thì cuộc trao đổi biến thành tranh luận ai đúng.

**Kết quả thực tế phải là quan sát, không phải suy diễn.** Ghi `HTTP 200, đơn đã đổi`. Đừng ghi
*"thiếu guard trạng thái ở backend"*, đó là chẩn đoán, và chẩn đoán sai thì Dev mất thời gian đi theo
hướng bạn chỉ.

**Đừng thêm phần thứ năm.** Không "đề xuất cách fix", không "mức độ ảnh hưởng ước tính", không bình
luận kèm. Chúng làm loãng bốn phần trên, và phần lớn là phỏng đoán.

### Bằng chứng đính kèm

Bài 11 đã lo phần này. Nhắc lại hai điều dễ quên:

- Ảnh phải **khoanh đỏ** đúng chỗ sai kèm nhãn ngắn. Ảnh chụp trơn của một màn dày dữ liệu thì Dev
  không biết nhìn vào đâu.
- Lỗi thể hiện qua **chuỗi thao tác** thì phải là video, không phải ảnh tĩnh. Ảnh tĩnh chỉ hợp với
  lỗi trạng thái.

## Việc 3 — Gán đúng người theo tầng lỗi (30 phút)

Bug gán nhầm người thì nằm im vài ngày rồi mới được chuyển, và thời gian đó không lấy lại được.

Bài 17 đã khai bảy tầng lỗi trong `phan-quyet.json`. Dùng chúng để định tuyến:

| Tầng lỗi | Dấu hiệu | Gán cho |
|---|---|---|
| Hiển thị | API trả đúng, màn hình hiện sai | Frontend |
| Nghiệp vụ | API trả sai ngay từ đầu | Backend |
| Dữ liệu | Sai chỉ với một bộ dữ liệu cụ thể | Backend, kèm bộ dữ liệu |
| Môi trường | Sai trên một môi trường, đúng ở môi trường khác | Hạ tầng |

Cách khoanh tầng rẻ nhất là thứ bạn đã có từ Bài 10: đọc cả hai tầng rồi so.

```bash
node scripts/qa/doi-chieu-luu-tru.js ui.json luu-tru.json
# → giamGia: màn hình 8000 · tầng lưu trữ 8750 ⇒ lỗi tầng HIỂN THỊ
```

Dòng đó trả lời luôn câu "gán cho ai".

Đặt tiền tố vào tiêu đề để người nhận biết ngay khi lướt danh sách:

```
[FE] Giảm giá hiển thị 8.000 trong khi giá trị lưu là 8.750
[BE] Đơn CONFIRMED vẫn sửa được qua PATCH — vi phạm BR-07
```

Một lỗi dính cả hai tầng thì giao **backend trước**. Lý do thực dụng: sửa dữ liệu ở dưới xong thì
frontend thường đúng theo, còn sửa hiển thị trước là che mất lỗi thật.

## Việc 4 — Rerun, và cái bẫy thời điểm (35 phút)

Dev báo đã fix. Bạn chạy lại. Xanh. Đóng bug.

Có một cái bẫy ở đây, và nó đã cắn thật.

Kết quả rerun **hết hạn**. Môi trường thử nghiệm được deploy vài lần một ngày. Bạn chạy lại lúc 14:00
thấy xanh, viết comment lúc 14:40, và giữa hai thời điểm đó có một lần deploy đưa bản khác lên. Comment
của bạn nói về một bản build không còn tồn tại.

Ba việc để tránh:

| Việc | Cụ thể |
|---|---|
| Ghi thời điểm chạy | Không phải thời điểm viết comment |
| Ghi mã bản build | Nếu môi trường có hiển thị |
| Xác nhận sát giờ | Chạy lại rồi viết ngay, đừng để cách nhau nửa tiếng |

Và một quy tắc dễ nhớ: **rerun không phải chạy lại đúng một case đó**. Chạy lại cả nhóm case liên
quan. Một bản fix có thể chữa được case này và làm hỏng case bên cạnh, và bạn sẽ không thấy nếu chỉ
nhìn đúng một dòng.

### Bug bị từ chối thì làm gì

Dev đóng bug với trạng thái Rejected không có nghĩa là bạn sai. Ba khả năng, và cách xử lý khác nhau:

| Lý do từ chối | Nghĩa là | Bạn làm gì |
|---|---|---|
| "Không tái hiện được" | Các bước chưa đủ, hoặc dữ liệu khác | Bổ sung fixture thật, kèm mã lượt chạy |
| "Đúng thiết kế" | Có thể tài liệu bạn đọc đã cũ | Tìm nguồn mới hơn trước khi cãi |
| "Trùng bug cũ" | Đúng thật, hoặc chỉ giống bề ngoài | So kết quả thực tế, không so tiêu đề |

Dòng thứ hai xảy ra thường xuyên hơn người ta tưởng. Tài liệu đặc tả có nhiều phiên bản, và bản bạn
đang đọc có thể không phải bản mới nhất. Kiểm trước khi tranh luận thì rẻ hơn nhiều.

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .agent/config/
│   └── phan-quyet.json           ·  từ Bài 17, nay dùng để định tuyến bug
├── scripts/
│   ├── lib/verdict.js            ·  từ Bài 17
│   └── qa/
│       ├── doi-chieu-luu-tru.js  ·  từ Bài 10, dùng để khoanh tầng
│       └── tao-bug.js            ← MỚI · đọc kết quả chạy, dựng bug 4 phần
└── outputs/tasks/<MÃ>/
    ├── test-results/             ·  từ Bài 17
    └── bugs/                     ← MỚI · bản nháp bug trước khi đẩy lên
```

## Tự kiểm

1. Năm câu hỏi phải trả lời trước khi tạo defect? Câu nào hay bị bỏ nhất?
2. Bug ma là gì, và nó đến từ đâu?
3. Bốn phần bắt buộc của một bug report?
4. Vì sao không nên viết chẩn đoán vào phần "kết quả thực tế"?
5. Vì sao không nên thêm phần thứ năm?
6. Bốn tầng lỗi và người nhận tương ứng?
7. Lỗi dính cả hai tầng thì giao ai trước, và vì sao?
8. Vì sao kết quả rerun có thể hết hạn?
9. Bug bị từ chối với lý do "đúng thiết kế" thì việc đầu tiên nên làm là gì?

## Bài tập về nhà

Mở ba bug gần nhất bạn hoặc team đã log. Với mỗi cái, chấm bốn phần: mô tả, các bước, mong đợi, thực tế.

Đếm xem có bao nhiêu cái mà phần "kết quả mong đợi" **không trích nguồn**. Đó thường là những cái tốn
nhiều lượt trao đổi nhất.

## Bài sau

Bài 20 lo chỗ còn hổng lớn nhất: mọi gate bạn viết tới giờ chỉ chạy khi bạn nhớ chạy. CI biến chúng
thành thứ chạy mỗi lần có người push.
