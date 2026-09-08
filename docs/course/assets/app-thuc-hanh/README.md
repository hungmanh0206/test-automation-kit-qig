# Vận hành lớp học — app thực hành của tài liệu này

Một app vận hành lớp học bé xíu, chạy trên máy bạn. Cả tài liệu dùng **app này** để thực hành, nên bạn
không cần xin quyền vào hệ thống của công ty, không sợ phá dữ liệu ai, và không phải đợi ai.

## Nó làm việc gì

Một trung tâm luyện thi mở lớp theo khoá. Học viên học không kịp thì đăng ký **học lại** ở khoá sau, và lúc
đó hệ thống phải **cắt hạn truy cập lớp cũ** lại cho khớp lớp mới. Người vận hành làm việc đó ở màn
**Lớp › Học viên**, và cũng ở đó họ **gia hạn** thêm ngày cho học viên có lý do chính đáng.

Chọn đúng nghiệp vụ này là cố ý: quy tắc nghe rất gọn khi đọc — *cắt hạn lớp cũ về sát ngày lớp mới khai
giảng* — nhưng lúc kiểm thì lộ ra bốn nhánh, một cái biên, và một chỗ **rất dễ lấy sai mốc**. Đó là hình
dạng của phần lớn việc thật.

## Chạy nó

Cần **Node.js 18 trở lên**. Không cần cài thêm gì.

```bash
node docs/course/assets/app-thuc-hanh/server.js
```

Bạn sẽ thấy đúng hai dòng này:

```
Vận hành lớp học đang chạy: http://localhost:4010
Dừng: Ctrl + C
```

Mở `http://localhost:4010` trên trình duyệt. Bạn thấy ba khối: chọn **lớp**, bảng **học viên trong lớp**,
và khối **đồng bộ học lại** — chọn học viên, bấm **Xem hạn mới** để tính trước, rồi **Áp dụng hạn mới**.
Menu `⋮` ở cuối mỗi hàng có *Gia hạn* và *Lịch sử*.

Dừng server: bấm `Ctrl + C` ở cửa sổ terminal đang chạy nó.

## Ba điều cần biết

1. **Dữ liệu nằm trong bộ nhớ.** Tắt server là mất hết, chạy lại là sạch trơn. **Bạn không phá được gì** —
   cứ thử thoải mái.
2. **`POST /api/reset` dựng lại dữ liệu ban đầu.** Bạn sẽ dùng nó ở Bài 10 để mỗi test bắt đầu từ trạng
   thái sạch.
3. **App này có 3 bug cài sẵn, cố ý.**

## Vì sao app lại có bug cài sẵn

Vì nếu bạn thực hành trên một app **đúng hoàn toàn**, thì bộ kiểm của bạn sẽ luôn xanh — và bạn không có
cách nào biết nó xanh vì app đúng, hay xanh vì bộ kiểm của bạn không phát hiện được gì. Hai thứ đó cho
**cùng một dấu hiệu**.

App này biết trước là có **đúng 3 bug**. Nên:

> Bộ kiểm của bạn bắt được 0/3 ⇒ lỗi ở **bộ kiểm**, không ở app.

Đó gọi là **đối chứng**, và nó là ý tưởng trung tâm của cả tài liệu.

## Ba bug đó là gì?

**Đừng đọc đáp án.** Hãy tự tìm — đó chính là bài thực hành.

- Bug **1** tìm được ở Bài 7 (viết được kết quả mong đợi độc lập với app).
- Bug **2** tìm được ở Bài 8 hoặc Bài 12 (nhìn kỹ màn hình, cộng thử các số đang hiện).
- Bug **3** tìm được ở Bài 18 (chỉ hiện ra khi bạn gọi thẳng API, không hiện qua giao diện).

Đáp án nằm ở [`BUGS.md`](BUGS.md), **mở sau khi bạn đã làm hết Phần 3**. Mở sớm thì bạn mất bài học lớn
nhất của tài liệu.

## Nguồn của mọi kết luận đúng/sai

[`spec.md`](spec.md) — đặc tả. Mỗi luật có một mã (`BR-01`, `UI-04`…).

Khi bạn nói "chỗ này sai", bạn phải chỉ được **mã luật** nó vi phạm. Không chỉ được thì bạn chưa chứng minh
được gì cả — bạn chỉ đang thấy lạ. Tài liệu sẽ nhắc lại điều này rất nhiều lần.
