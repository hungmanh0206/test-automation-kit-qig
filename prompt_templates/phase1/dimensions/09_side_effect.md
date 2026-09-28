# Chiều coverage: Side-effect / Notification Coverage

> Tag bắt buộc trong tiêu đề case: **`[SideEffect]`** · Mở khi: **hành động sinh mail/thông báo/task/webhook**
> Tách khỏi [`02_gen_testcases.md`](../02_gen_testcases.md) 14/08/2026. Nội dung giữ NGUYÊN VĂN.
> Chiều khác tham chiếu trong bài thì mở file tương ứng ở cùng thư mục. Danh sách đủ ở bảng điều hướng của `02`.

## 9. Side-effect / Notification Coverage
Với mỗi side-effect (email, in-app noti, webhook, sync sang hệ thống khác), nếu applicable:
> ⚠ Chiều này là webhook **ĐI RA** (mình gửi). Webhook/callback **ĐI VÀO** (mình nhận từ bên thứ ba) là **§22** [`22_inbound_callback.md`](22_inbound_callback.md), lo chữ ký, replay, trùng, sai thứ tự.
- Đúng người nhận (gửi đúng đối tượng, KHÔNG gửi cho người không liên quan).
- Thời điểm phát sinh (gửi ngay sau commit, không delay quá ngưỡng).
- KHÔNG phát sinh khi thao tác fail/validate lỗi (negative).
- Nội dung/format đúng spec.
