# Cửa hàng mini — app thực hành của khoá học

Một app bán hàng bé xíu, chạy trên máy bạn. Cả khoá học dùng **app này** để thực hành, nên bạn
không cần xin quyền vào hệ thống của công ty, không sợ phá dữ liệu ai, và không phải đợi ai.

## Chạy nó

Cần **Node.js 18 trở lên**. Không cần cài thêm gì.

```bash
node docs/course/assets/app-thuc-hanh/server.js
```

Bạn sẽ thấy đúng hai dòng này:

```
Cửa hàng mini đang chạy: http://localhost:4010
Dừng: Ctrl + C
```

Mở `http://localhost:4010` trên trình duyệt. Bạn thấy màn **Tạo đơn hàng**: chọn khách, chọn sản phẩm,
bấm **Thêm**, rồi bấm **Tạo đơn**. Đơn hiện ở bảng dưới.

Dừng server: bấm `Ctrl + C` ở cửa sổ terminal đang chạy nó.

## Ba điều cần biết

1. **Dữ liệu nằm trong bộ nhớ.** Tắt server là mất hết, chạy lại là sạch trơn. **Bạn không phá được gì** —
   cứ thử thoải mái.
2. **`POST /api/reset` xoá sạch mọi đơn.** Bạn sẽ dùng nó ở Bài 10 để mỗi test bắt đầu từ trạng thái sạch.
3. **App này có 3 bug cài sẵn, cố ý.**

## Vì sao app lại có bug cài sẵn

Vì nếu bạn thực hành trên một app **đúng hoàn toàn**, thì bộ kiểm của bạn sẽ luôn xanh — và bạn không có
cách nào biết nó xanh vì app đúng, hay xanh vì bộ kiểm của bạn không phát hiện được gì. Hai thứ đó cho
**cùng một dấu hiệu**.

App này biết trước là có **đúng 3 bug**. Nên:

> Bộ kiểm của bạn bắt được 0/3 ⇒ lỗi ở **bộ kiểm**, không ở app.

Đó gọi là **đối chứng**, và nó là ý tưởng trung tâm của cả khoá.

## Ba bug đó là gì?

**Đừng đọc đáp án.** Hãy tự tìm — đó chính là bài thực hành.

- Bug **1** tìm được ở Bài 7 (viết được kết quả mong đợi độc lập với app).
- Bug **2** tìm được ở Bài 8 hoặc Bài 12 (nhìn kỹ màn hình, cộng thử các số đang hiện).
- Bug **3** tìm được ở Bài 18 (chỉ hiện ra khi bạn gọi thẳng API, không hiện qua giao diện).

Đáp án nằm ở [`BUGS.md`](BUGS.md), **mở sau khi bạn đã làm hết Phần 3**. Mở sớm thì bạn mất bài học lớn
nhất của khoá.

## Nguồn của mọi kết luận đúng/sai

[`spec.md`](spec.md) — đặc tả. Mỗi luật có một mã (`BR-01`, `UI-04`…).

Khi bạn nói "chỗ này sai", bạn phải chỉ được **mã luật** nó vi phạm. Không chỉ được thì bạn chưa chứng minh
được gì cả — bạn chỉ đang thấy lạ. Khoá học sẽ nhắc lại điều này rất nhiều lần.
