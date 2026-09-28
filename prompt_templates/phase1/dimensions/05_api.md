# Chiều coverage: API Coverage Checklist

> Tag bắt buộc trong tiêu đề case: **`[API]`** · Mở khi: **scope có endpoint API cần kiểm trực tiếp**
> Tách khỏi [`02_gen_testcases.md`](../02_gen_testcases.md) 14/08/2026. Nội dung giữ NGUYÊN VĂN.
> Chiều khác tham chiếu trong bài thì mở file tương ứng ở cùng thư mục — danh sách đủ ở bảng điều hướng của `02`.

## 5. API Coverage Checklist
Mỗi endpoint liên quan trong Swagger phải có testcase cho các nhóm sau nếu applicable:
- Success request với query/path/body cụ thể.
- Required field missing.
- Invalid format/type.
- Duplicate/conflict/business rule violation.
- Not found với id không tồn tại.
- Unauthorized thiếu token.
- Forbidden role không đủ quyền.
- Response schema/business values quan trọng.
- **HTTP-level contract**: gọi endpoint bằng **method không cho phép** (kỳ vọng `405`, KHÔNG phải `404`/`500`); `Content-Type` sai hoặc thiếu (kỳ vọng `415`); body vượt giới hạn (`413`/chặn có kiểm soát, KHÔNG `500`). Lỗi kiểu này hay bị bỏ vì test chỉ đi "đường đẹp".
- **Boundary của payload và query.** Đây là biên ở tầng API, khác §3 vốn viết cho field UI. Các biên cần phủ:

  - chuỗi đúng max với max+1
  - số âm và `0`
  - mảng rỗng `[]` với thiếu key
  - `page=0`, `page=-1`, `page` vượt tổng số trang
  - `page_size` vượt max cho phép
  - ngày sai định dạng hoặc không tồn tại

  Mỗi biên **1 TC riêng**, không gộp.
- **Idempotency / double-submit**: gửi **lặp cùng payload** (POST tạo, approve, cancel, upload)
  ⚠ Đây là idempotency phía **mình GỬI**. Khi hệ thống **NHẬN** callback bên thứ ba (VNPay/VietQR/HubSpot/SAP) thì dùng **§22** [`22_inbound_callback.md`](22_inbound_callback.md): ở đó mình không kiểm soát số lần/thứ tự gửi, và đã có bug thật (Paid Amount cộng đôi, CSDL-28236). → KHÔNG tạo bản ghi/giao dịch trùng; retry sau timeout → không nhân đôi side-effect. Bắc cầu §8 (Resilience) nhưng phải có **ở cấp endpoint**.
- **Contract / backward-compat** (khi endpoint đã có consumer): field mới phải **optional**; KHÔNG đổi kiểu/bỏ field cũ mà không kiểm; enum thêm giá trị mới không làm vỡ consumer. Bắc cầu §17 (Change Impact) — ở đây là case cấp endpoint.
- **Rate-limit / concurrency** (nếu applicable): endpoint nhạy cảm (login/OTP/thanh toán) gọi dồn dập → khoá/chậm/`429` chứ không brute-force vô hạn; N request đồng thời lên cùng resource → không oversell/double-count. Chi tiết ở §15 và §16; liệt kê ở đây để không bị bỏ sót khi chỉ bám checklist API.
