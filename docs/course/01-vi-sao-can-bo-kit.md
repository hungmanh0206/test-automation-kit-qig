# Bài 1 — Vì sao cần một "bộ kit", không phải chỉ cần prompt giỏi

> **1 giờ 30 phút** · Có gì trong tay: chưa có gì · Sau bài này: hiểu mình sắp dựng cái gì và vì sao

## Mục tiêu

✅ Phân biệt ba mức dùng AI trong kiểm thử.
✅ Hiểu vấn đề cốt lõi khiến prompt giỏi vẫn không đủ.
✅ Nắm ba thứ một bộ kit bắt buộc phải giải.
✅ Hiểu khái niệm *forcing function*.
✅ Nắm lộ trình cả khoá.
✅ Hiểu vì sao khoá này không dựng theo thứ tự lịch sử.

---

## 1. Ba mức dùng AI trong kiểm thử

Phần lớn người mới nhảy từ mức 1 sang mức 3 và thất bại, vì mức 3 cần hạ tầng mà mức 1 không đòi.

| Mức | Bạn làm gì | AI làm gì | Ai chịu trách nhiệm kết quả |
|---|---|---|---|
| **1. Hỏi–đáp** | Gõ câu hỏi | Trả lời | Bạn, hoàn toàn |
| **2. Hỗ trợ từng việc** | Giao một việc rõ ràng, kiểm ngay | Sinh nháp: testcase, script, mô tả bug | Bạn, vì bạn đọc từng dòng |
| **3. Agent chạy quy trình** | Giao cả chặng, xem lại kết quả | Đọc tài liệu → sinh case → chạy → thu bằng chứng → báo cáo | **Không rõ — và đó là vấn đề** |

Ở mức 3, bạn không đọc từng dòng nữa. Nếu không có gì kiểm hộ bạn thì bạn đang tin một cái báo cáo mà
không có cách nào biết nó đúng hay không.

**Bộ kit là thứ làm cho mức 3 an toàn.** Không phải để agent thông minh hơn — mà để khi nó làm sai, có thứ
chặn lại trước khi kết quả đi ra ngoài.

## 2. Vấn đề cốt lõi: agent có xu hướng làm cho nó xanh

Đây là điều quan trọng nhất của cả khoá, nên đọc chậm.

Agent được huấn luyện để **hoàn thành nhiệm vụ**. Khi gặp trở ngại, phản xạ tự nhiên của nó là tìm đường đi
tiếp — và trong kiểm thử, "đi tiếp" thường trùng với "làm cho test xanh". Vài biểu hiện thật:

- Test đỏ vì element chưa xuất hiện → agent thêm `wait 3 giây` → xanh. Nhưng có thể app đang **chậm thật**,
  và cái wait đó vừa lấp một bug hiệu năng.
- Assertion sai vì app trả `"540000.0"` mà expected là `540000` → agent nới assertion thành "có chứa 540000"
  → xanh. Bug kiểu dữ liệu vừa bị che.
- Không tìm được element → agent đổi sang `.first()` → xanh, nhưng giờ nó đang kiểm **một element khác**.
- Không biết giá trị đúng là bao nhiêu → agent đọc giá trị từ chính màn hình rồi so với chính nó → **luôn
  xanh**, và không chứng minh được gì cả.

Không có cái nào là gian lận có ý thức. Tất cả đều là "giải quyết vấn đề" theo nghĩa thông thường. Đó chính
là lý do **dặn dò không có tác dụng**: bạn viết "hãy trung thực" thì agent vẫn thấy việc thêm một cái wait
là hợp lý, không phải là vi phạm.

**Vấn đề thứ hai: agent không có ký ức.** Task tuần này không biết task tuần trước đã kết luận gì. Nên cùng
một bug bị log lại sau khi đã bị Dev từ chối; cùng một cách dựng dữ liệu bị thử lại sau khi đã thất bại;
cùng một câu hỏi được hỏi lại BA.

## 3. Ba thứ một bộ kit phải giải

| | Vấn đề | Bộ kit giải bằng |
|---|---|---|
| **Kỷ luật** | Agent làm cho nó xanh | **Máy kiểm** đọc kết quả và chặn khi sai chuẩn |
| **Bộ nhớ** | Không có ký ức giữa các task | Store trên đĩa: rule đã xác nhận, quyết định đã chốt, cách dựng dữ liệu |
| **Bằng chứng** | Không kiểm chứng lại được | Ảnh và video bắt buộc, đúng màn, khoanh đúng chỗ |

Ba thứ này là ba phần của khoá. Bạn sẽ dựng chúng theo đúng thứ tự đó, vì mỗi cái đều cần cái trước.

## 4. Forcing function: luật chỉ có hiệu lực khi có máy

Đây là nguyên tắc trung tâm. Nói ngắn:

> Một quy tắc không có máy kiểm đứng sau thì nó là **lời dặn**, không phải quy tắc.

Thử nghiệm tư duy: bạn viết vào tài liệu *"mọi case đã chạy đều phải có ảnh bằng chứng"*. Sáu tuần sau, có
bao nhiêu phần trăm case thật sự có ảnh? Không ai biết — và không ai biết chính là vấn đề.

Bây giờ đổi cách: viết một đoạn mã đọc kết quả chạy, tìm case nào có trạng thái *đã chạy* mà không có file
ảnh kèm theo, rồi **thoát với mã lỗi**. Nối nó vào bước đẩy kết quả. Giờ câu trả lời là 100%, không phải vì
mọi người kỷ luật hơn, mà vì không đẩy được nếu thiếu.

Quan sát đi kèm, và nó ngược trực giác:

> Khi phát hiện một lỗ hổng chất lượng, câu hỏi đầu tiên **không** phải "viết thêm quy định gì" mà
> **"cái này kiểm bằng máy được không"**. Đo nhiều lần đều ra cùng kết luận: lỗ hổng thường là thiếu máy
> kiểm, không thiếu quy định. Quy định phần lớn đã có sẵn.

Và một cảnh báo bạn sẽ gặp lại ở Bài 13:

> **Máy báo oan tệ hơn không có máy.** Gate báo sai vài lần là cả team bắt đầu bỏ qua tín hiệu đỏ. Lúc đó
> nó mất tác dụng thật, và bạn còn khó dựng lại niềm tin hơn lúc đầu.

## 5. Lộ trình cả khoá

```
Phần 1  Nền                 môi trường · khung kit · cách nói với agent
   ↓
Phần 2  Testcase có chuẩn   mô hình canonical · oracle · coverage theo chiều
   ↓
Phần 3  Chạy thật           Playwright · tiền điều kiện · verdict · bằng chứng
   ↓                        ← đến đây bạn đã có ARTIFACT THẬT
Phần 4  Máy kiểm            gate đầu tiên · bộ gate nền · chống trôi
   ↓
Phần 5  Bộ nhớ              knowledge/ · risk-based testing
   ↓                        ← đến đây suite đã chạy nhiều lượt
Phần 6  Đo chính mình       negative control · mở rộng · CI · giao kit
```

Hai mũi tên có ghi chú là hai điểm chuyển quan trọng. Trước Phần 4 bạn **không thể** viết gate, vì gate cần
artifact thật để đọc. Trước Phần 6 bạn **không thể** đo năng lực phát hiện, vì cần một suite đã chạy.

## 6. Vì sao không dựng theo thứ tự lịch sử

Bộ kit mà khoá này lấy làm ví dụ được dựng trong khoảng 7,5 tuần. Nhưng thứ tự nó **thật sự** đi qua không
dùng được làm thứ tự dạy, vì nhiều bước dựa trên dữ liệu chỉ có khi dự án đã chạy:

- Chấm rủi ro theo module cần **lịch sử bug** — từ 0 thì chưa có bug nào.
- Đo năng lực phát hiện cần **một suite đã chạy nhiều lượt**.
- Đếm độ phủ theo chiều cần **một bộ testcase đủ lớn** để con số có nghĩa.

Nên khoá này xếp theo **thứ bạn có trong tay ở mỗi bước**. Mỗi bài mở đầu bằng một dòng nói rõ điều đó, và
không bài nào đòi dữ liệu mà bài trước chưa tạo ra.

Nếu bạn tò mò về thứ tự thật, đọc [`BUILD_JOURNAL.md`](../BUILD_JOURNAL.md) — nhưng **để sau khoá**. Đọc
trước thì nó chỉ là một danh sách con số của người khác.

---

## Thực hành (30 phút)

Không cài gì cả. Chỉ viết.

### Bước 1 — Liệt kê 5 việc bạn đang làm tay

Mở một file trống, viết 5 việc kiểm thử bạn làm nhiều nhất trong tháng vừa rồi. Cụ thể, không chung chung:
"viết testcase cho màn tạo đơn" thay vì "viết testcase".

### Bước 2 — Chấm mức cho từng việc

Với mỗi việc, tự trả lời: nếu giao cho agent thì nó nằm ở **mức 2** (bạn kiểm từng dòng) hay **mức 3** (bạn
chỉ xem kết quả)? Ghi lý do.

### Bước 3 — Tìm chỗ agent có thể "làm cho nó xanh"

Với những việc bạn chấm mức 3, viết ra: **nếu agent muốn báo cáo đẹp mà không làm thật, nó sẽ làm thế nào?**
Đây là bài tập quan trọng nhất của bài học. Vài gợi ý để nghĩ:

- Nó có thể ghi trạng thái gì để tránh phải giải thích?
- Nó có thể bỏ bớt điều kiện nào trong phần kết quả mong đợi?
- Nó có thể lấy con số đúng từ đâu để chắc chắn trùng khớp?

### Bước 4 — Với mỗi lỗ hổng, đề xuất một phép kiểm bằng máy

Chưa cần biết viết mã. Chỉ cần một câu dạng: *"đọc X, nếu Y thì chặn"*. Ví dụ:
*"đọc danh sách kết quả, nếu có case trạng thái đã-chạy mà không kèm file ảnh thì chặn."*

Giữ file này lại. Ở **Bài 13** bạn sẽ biến một trong những câu đó thành mã chạy được.

---

## Tự kiểm

- [ ] Tôi nói được khác biệt giữa mức 2 và mức 3, và vì sao mức 3 cần hạ tầng.
- [ ] Tôi nêu được ít nhất 3 cách agent "làm cho nó xanh" mà không phải gian lận có ý thức.
- [ ] Tôi giải thích được vì sao viết "hãy trung thực" vào tài liệu là không đủ.
- [ ] Tôi kể được ba thứ bộ kit phải giải, và chúng tương ứng phần nào của khoá.
- [ ] Tôi nói được vì sao Bài 13 không thể đặt trước Phần 3.
- [ ] Tôi có một file với 5 việc, lỗ hổng của từng việc, và phép kiểm đề xuất.

## Bài tập về nhà

Chọn **một** báo cáo kiểm thử gần đây của bạn hoặc của team. Với mỗi kết luận PASS trong đó, tự hỏi: *nếu
bây giờ tôi phải chứng minh case này thật sự đã chạy đúng, tôi có gì trong tay?* Đếm bao nhiêu phần trăm
PASS mà bạn chứng minh được.

Con số đó là **điểm khởi đầu** của bạn. Ghi lại, cuối khoá đo lại.

## Đọc thêm

- [`CLAUDE.md`](../../CLAUDE.md) — ví dụ một file non-negotiables thật, để thấy nó ngắn tới mức nào.
- Bài 13 sẽ quay lại đúng file bạn vừa viết ở Thực hành.
