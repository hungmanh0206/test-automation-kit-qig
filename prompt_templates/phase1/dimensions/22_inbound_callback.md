# §22 — Inbound Callback / Webhook Coverage (phía **NHẬN**)

> Tag bắt buộc trong tiêu đề case: **`[Callback]`**.
> Mở khi **hệ thống NHẬN request từ bên thứ ba**: cổng thanh toán VNPay hay VietQR, HubSpot, SAP, nhà cung
> cấp SMS hoặc mail. Kể cả khi request đó chỉ "báo kết quả".

## Vì sao chiều này tồn tại (đo được, không phải phòng xa)

Kit đã có idempotency ở **§5 API** và **§8 Resilience**, nhưng cả hai nhìn từ phía **mình là người GỬI**
("bấm Cancel 2 lần", "double-submit form"). **§9 Side-effect** nhìn webhook **đi ra** ("app gửi noti/webhook").
Chưa chiều nào đứng ở vị trí **mình là người NHẬN** — nơi mình không kiểm soát số lần gửi, thứ tự gửi, hay
nội dung gửi.

Bằng chứng đây là lỗ thật ở dự án này:
`knowledge/bugs/dự án trước-24395__be-callback-thanh-toan-trung-lap-lam-paid-amount.json` — cổng thanh toán gọi
callback **trùng**, hệ thống cộng `Paid Amount` **hai lần** (CSDL-28236). Bug đó do **người** phát hiện
khi dựng fixture, không do máy nào bắt. Theo luật của kit ("bug do người ngoài tìm ra = lỗi của máy"),
đúng cái phải vá là **chỗ này**: không có checklist nào dạy sinh case "gửi lại callback y hệt".

## Nguyên tắc gốc

Bên thứ ba hứa **at-least-once**, không hứa **exactly-once**. Nghĩa là:
- Cùng một sự kiện **sẽ** đến ≥2 lần (retry khi timeout, retry khi mình trả 5xx, người vận hành bấm resend).
- Thứ tự đến **không** bảo đảm (`success` có thể đến trước `pending`).
- Payload là **input của người ngoài** ⇒ phải coi là không tin cậy như mọi input khác.

Oracle của chiều này **không** ở response mình trả về, mà ở **trạng thái sau khi nhận**: số dư, số tiền đã
thu, số bản ghi giao dịch, trạng thái đơn. Chỉ assert "callback trả 200" là **tautology** — 200 là thứ
mình tự trả.

## Checklist — mỗi dòng là một case, không phải gợi ý

| # | Ca | Cách dựng | Oracle (đo ở đâu) |
|---|---|---|---|
| 1 | **Callback TRÙNG y hệt** (cùng payload, cùng transaction ref) gửi 2–3 lần | POST lại đúng body đã gửi | `Paid Amount` / số dư **không đổi sau lần 1**; danh sách transaction có **đúng 1** bản ghi. Đây là ca đã đẻ CSDL-28236 |
| 2 | **Chữ ký/HMAC SAI** (sửa 1 ký tự trong `vnp_SecureHash`) | đổi 1 byte của hash | Bị **từ chối**, và **KHÔNG** ghi nhận tiền. Trả 200 mà vẫn ghi = lỗ nghiêm trọng nhất |
| 3 | **Thiếu hẳn chữ ký** | bỏ field hash | Từ chối; không ghi |
| 4 | **Replay payload CŨ** (callback hợp lệ của giao dịch đã đóng, gửi lại sau N giờ) | lưu payload cũ, gửi lại | Từ chối hoặc no-op; không cộng tiền lần nữa; không mở lại đơn đã đóng |
| 5 | **Sai thứ tự**: `success` đến TRƯỚC `pending`/`processing` | gửi đảo thứ tự | Trạng thái cuối phải là **success** (không bị `pending` đến sau ghi đè) |
| 6 | **Số tiền trong callback ≠ số tiền đơn** (thừa/thiếu) | sửa `vnp_Amount` | Không tự ghi nhận theo số của callback; xử theo rule đã khai (từ chối, hoặc ghi phần dư để hoàn — xem `BR` của bài) |
| 7 | **Mã tham chiếu không tồn tại / thuộc đơn khác** | đổi `vnp_TxnRef` | Từ chối; **không** gắn tiền vào đơn khác (đây là IDOR ở tầng callback) |
| 8 | **Đơn đã ở trạng thái cuối** (đã huỷ / đã hết hạn) mà callback success đến | dựng đơn expired rồi gửi callback | Theo rule: từ chối hoặc hoàn — nhưng **phải xác định**, không được vừa huỷ vừa ghi tiền |
| 9 | **Mình trả 5xx** ⇒ bên gửi retry | chặn/timeout xử lý rồi để retry đến | Sau retry vẫn **đúng 1** lần ghi nhận (idempotent theo `transaction ref`, không theo thời điểm) |
| 10 | **Hai callback ĐỒNG THỜI** cùng ref | gửi song song | Không double-count (khoá/`unique constraint`, không phải "check rồi ghi") |

## Bẫy khi test chiều này

- **Không có UI để dựng** ⇒ phải gọi thẳng endpoint callback. Đó là lý do chiều này gần như luôn là case
  **API**, và phải khai tiền điều kiện `[api]` (xem quy ước `[<method>]` trong ô Tiền điều kiện).
- **UAT non-destructive**: callback ghi tiền là **mutate**. Chỉ chạy trên đơn do chính lượt test tạo, và
  **xác nhận trước mỗi lượt chạm UAT** (CLAUDE.md §2). Không bao giờ replay callback của đơn thật.
- **Đọc trạng thái bằng API, đừng chỉ nhìn UI**: UI có thể cache/chậm; số tiền đã thu phải đọc từ endpoint
  transaction (bài học `overpay-auto-refund`: list transaction phải gọi `/transactions`).
- **Đừng lấy chính response callback làm oracle.** Nó do mình trả ⇒ app==app.

## Liên quan

- §5 API (idempotency phía GỬI) · §8 Resilience (đồng thời/retry) · §9 Side-effect (webhook ĐI RA)
- §15 Security cho ca 2/3/7 (chữ ký, IDOR) — case có thể mang **cả 2 tag**
- `knowledge/bugs/dự án trước-24395__be-callback-thanh-toan-trung-lap-lam-paid-amount.json` (bug gốc)
