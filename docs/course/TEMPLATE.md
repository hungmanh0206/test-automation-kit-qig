# Template chuẩn của một bài giảng

> Đây là **nguồn quyết** về hình dạng một bài. `scripts/qa/library_drift.js` kiểm theo file này, nên
> đổi template thì phải đổi cả gate. Bài nào lệch template thì gate chặn.
>
> File này KHÔNG phải một bài giảng, nên nó không đánh số và không nằm trong lộ trình.

## Vì sao có file này

Đo ngày 08/09/2026 trên 43 bài: **43 bài** thiếu khối mở bài bằng vấn đề · **38 bài** định nghĩa
thuật ngữ trước khi người đọc chạm vào nó · **43 bài** không có chỉ báo độ chín · **7 bài** có mục
"Bài sau" chỉ liệt kê nội dung mà không nêu lý do đi tiếp.

Bốn con số đó không phải lỗi của người viết từng bài. Chúng là lỗ trong template: template cũ **không
có ô nào** để chứa bốn thứ này, nên không ai quên — chỉ là không có chỗ đặt.

## Thứ tự các khối, và vì sao đúng thứ tự đó

```
# Bài N — <tiêu đề nói VẤN ĐỀ, không nói CHỦ ĐỀ>

> **<thời lượng>** · Có gì trong tay: … · Sau bài này: …

**Vấn đề**                       ← BẮT BUỘC. Một tình huống cụ thể, 2–6 dòng.
                                   Không định nghĩa gì. Không nhắc tên công cụ.

**Tóm tắt bài này**              ← bảng 3 dòng: đang khổ vì / gõ gì / xong được gì

## Bài này bạn sẽ làm gì         ← danh sách việc, mỗi việc kèm số phút

## Việc 1 — …                    ← mỗi việc có khối "Bạn sẽ thấy" + bảng "Thấy khác"
## Việc 2 — …
## Việc N — …

## Gọi tên những gì bạn vừa làm  ← BẮT BUỘC (trừ 2 bài miễn trừ). Bảng thuật ngữ,
                                   ĐẶT SAU các Việc, không đặt trước.

## Cây thư mục sau bài này       ← chỉ trỏ tới bài ĐỨNG TRƯỚC, không trỏ bài sau

## Bộ kit của bạn đang ở đâu     ← BẮT BUỘC. Sinh tự động từ docs/COURSE.md.
                                   Đừng sửa tay: `npm run course:maturity` ghi lại.

## Tự kiểm
## Bài tập về nhà
## Bài sau                       ← BẮT BUỘC nêu LÝ DO, không chỉ nêu tên bài kế
```

## Luật của từng khối

### Khối "Vấn đề" — mở bài bằng tình huống

Sai:

> Trong bài này chúng ta sẽ tích hợp Google Sheet.

Đúng:

> Bạn vừa có 120 testcase. Một QA khác hỏi *"case nào đang cover BR-017?"*. Bạn trả lời *"để tôi mở
> file local tìm"*.

Ba luật:

- **Không nhắc tên công cụ.** Công cụ xuất hiện sau khi vấn đề đã rõ.
- **Không định nghĩa gì.** Khối này để người đọc *nhận ra mình đang gặp chuyện đó*, không để học.
- **Phải là một tình huống có người trong đó**, không phải một mệnh đề chung.

Kiểm bằng một câu hỏi: đọc xong khối này, người đọc có tự nói được *"ừ, đúng cái này"* chưa?

### Khối thuật ngữ — đặt SAU, không đặt trước

Luật: **không định nghĩa thuật ngữ trước khi người đọc từng chạm vào nó.**

Vì một định nghĩa đọc trước khi có trải nghiệm thì chỉ là chữ. Cùng định nghĩa đó đọc sau khi vừa
làm thì nó gắn vào một việc cụ thể, và nhớ được.

Nên bảng thuật ngữ nằm **sau các Việc**, và mỗi dòng nên trỏ về chỗ người đọc vừa gặp nó:

| Từ | Nghĩa gọn | Bạn vừa gặp nó ở đâu |
|---|---|---|
| **Test Data** | Dữ liệu bạn nhập vào trước khi chạy | Việc 1, lúc chọn học viên `HV01` |
| **Actual Result** | Con số sản phẩm trả về | Việc 1, con số `515.000` |

Cột thứ ba là cột làm khối này khác một từ điển.

**Hai bài được miễn trừ**, khai tường minh:

| Bài | Vì sao miễn |
|---|---|
| `truoc-khi-bat-dau.md` | Bài này DẠY từ vựng làm nội dung chính, nên không có khối riêng |
| `lo-trinh-sau-khoa.md` | Bài khép lại, chỉ nhìn lại và chỉ đường, không giới thiệu từ nào mới |

### Khối độ chín — sinh tự động, đừng sửa tay

Người đọc từ số 0 dễ mất phương hướng ở bài thứ mười bảy. Khối này trả lời hai câu: *tôi đang ở đâu*
và *cấp độ này còn mấy bài*.

Nó **sinh từ `docs/COURSE.md`** bằng `npm run course:maturity`, nên không thể trôi khỏi giáo trình.
Sửa tay thì lượt sinh sau ghi đè, và gate sẽ chặn nếu nội dung lệch.

### Mục "Bài sau" — nêu lý do, không nêu mục lục

Sai:

> Bài 13 nói về thiết kế testcase.

Đúng:

> Bài 13 soi vào cột dễ trông-như-đúng nhất của bảng testcase: Kết quả mong đợi. Cụ thể là câu hỏi
> con số trong đó lấy từ đâu ra.

Luật: **vấn đề cuối bài N phải tạo ra lý do cho bài N+1.** Nếu bài sau chỉ là "chủ đề tiếp theo" thì
hai bài đó chưa nối vào nhau, và người đọc sẽ cảm thấy mình đang học một danh sách chủ đề.

## Những gì template KHÔNG quy định

Số lượng Việc · độ dài từng Việc · có mục "Đào sâu" hay không · có mục "Đọc thêm" hay không. Đây là
quyết định của từng bài, không phải của template.

Template chỉ quy định những chỗ mà **thiếu là người đọc bị ảnh hưởng**, và những chỗ đó đều đo được.
