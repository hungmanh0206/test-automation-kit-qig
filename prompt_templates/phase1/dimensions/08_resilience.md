# Chiều coverage: Resilience / Concurrency / Interaction Coverage

> Tag bắt buộc trong tiêu đề case: **`[Resilience]`** · Mở khi: **có thao tác đồng thời, callback/retry, hoặc trạng thái đua nhau**
> Tách khỏi [`02_gen_testcases.md`](../02_gen_testcases.md) 14/08/2026. Nội dung giữ NGUYÊN VĂN.
> Chiều khác tham chiếu trong bài thì mở file tương ứng ở cùng thư mục — danh sách đủ ở bảng điều hướng của `02`.

## 8. Resilience / Concurrency / Interaction Coverage
Cho mỗi action async (submit/export/approve/upload), nếu applicable:
- Mất mạng/timeout giữa chừng -> báo lỗi, không crash, không tạo bản ghi mồ côi.
- Double-click / double-submit -> không tạo 2 bản ghi / 2 file trùng.
- Lặp lại thao tác đã hoàn tất (idempotency), vd Cancel nhiều lần liên tiếp.
- Loading/disabled state đúng trong lúc chờ.
