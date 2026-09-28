# Chiều coverage: Security Coverage

> Tag bắt buộc trong tiêu đề case: **`[Security]`** · Mở khi: **scope có auth/role/dữ liệu người khác (IDOR, mass-assignment, injection)**
> Tách khỏi [`02_gen_testcases.md`](../02_gen_testcases.md) 14/08/2026. Nội dung giữ NGUYÊN VĂN.
> Chiều khác tham chiếu trong bài thì mở file tương ứng ở cùng thư mục — danh sách đủ ở bảng điều hướng của `02`.

## 15. Security Coverage (BẮT BUỘC — mở rộng ngoài XSS/auth cơ bản)

Ngoài special-char ở field (mục 3) và unauthorized/forbidden cơ bản (mục 5, 10), mỗi scope có dữ liệu/quyền phải cân nhắc các nhóm sau (sinh TC nếu applicable):

- **AuthN token**: không token / token sai-hỏng / hết hạn / token của user khác → BE chặn đúng (401/403), không rò dữ liệu.
- **AuthZ dọc (privilege escalation)**: role thấp gọi thẳng API/URL chức năng role cao → 403; UI ẩn nút KHÔNG đủ, phải chặn ở BE.
- **AuthZ ngang (IDOR)**: user A đổi id trong path/body/query sang resource của user B (hoặc org/tenant khác) → 403/404, KHÔNG trả data của B. BẮT BUỘC cho mọi endpoint có id resource.
- **Injection.** Tất cả phải bị escape hoặc chặn chứ không được thực thi:
  - SQL và NoSQL ở field cùng query param (`' OR '1'='1`).
  - XSS stored: lưu `<script>` rồi mở lại ở màn khác.
  - XSS reflected: echo qua search hoặc error.
  - Command và template injection, nếu input đi tới hệ thống ngoài.
- **Mass assignment / over-posting**: gửi thêm field không được phép (`role`, `isAdmin`, `status`, `price`, `ownerId`...) vào body create/update → BE bỏ qua, KHÔNG cho ghi đè.
- **Sensitive data exposure**: response/UI/log/URL không lộ password/token/hash/secret/PII vượt quyền; PII phải mask; không đẩy secret qua query string.
- **File upload security** (nếu có upload): file thực thi (`.php/.exe/.svg` có script), sai MIME giả extension, path traversal tên file (`../../`), file quá lớn, zip bomb → bị từ chối/khử trùng.
- **Rate limiting / brute force** (nếu applicable): lặp login sai/OTP/endpoint nhạy cảm nhiều lần → khóa/chậm/captcha, không brute force vô hạn.
- **Session/logout**: sau logout token cũ vô hiệu; đổi mật khẩu → session cũ vô hiệu (nếu spec); cookie nhạy cảm `HttpOnly`/`Secure` nếu kiểm được.
- **CORS/headers** (nếu applicable & kiểm an toàn được): CORS không cho origin lạ đọc dữ liệu có auth.

Ràng buộc thể hiện ở UI luôn phải có TC bypass thẳng BE (đồng bộ mục 10). Nhóm không áp dụng / không kiểm an toàn được ở môi trường test → `N/A + lý do` trong Coverage Gaps.

> **Executable ở Phase 2, mức BASIC và non-destructive.** Chạy thật bằng `scripts/qa/security_check.js`, skill `security_check`, chỉ **GET read-only, never-auto, cần `--confirm-nonprod`**. Phạm vi: security header cùng cookie flag, truy cập chưa auth trả 401 hoặc 403, ma trận authz kèm IDOR với 2 tài khoản test, sensitive-data exposure, và transport http sang https.
>
> Control thì kết luận PASS hoặc FAIL. Exposure thì ghi finding, nhớ mask PII.
>
> **Fuzzing, khai thác SQLi và XSS, brute-force, rate-limit đều là Manual-only, kèm OWASP ZAP opt-in.** Chỉ chạy khi có phê duyệt người và target là non-prod. Thiếu 2 tài khoản test thì authz cùng IDOR ghi `needs_account`.
