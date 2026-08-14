# Chiều coverage: Security Coverage

> Tag bắt buộc trong tiêu đề case: **`[Security]`** · Mở khi: **scope có auth/role/dữ liệu người khác (IDOR, mass-assignment, injection)**
> Tách khỏi [`02_gen_testcases.md`](../02_gen_testcases.md) 14/08/2026. Nội dung giữ NGUYÊN VĂN.
> Chiều khác tham chiếu trong bài thì mở file tương ứng ở cùng thư mục — danh sách đủ ở bảng điều hướng của `02`.

## 15. Security Coverage (BẮT BUỘC — mở rộng ngoài XSS/auth cơ bản)

Ngoài special-char ở field (mục 3) và unauthorized/forbidden cơ bản (mục 5, 10), mỗi scope có dữ liệu/quyền phải cân nhắc các nhóm sau (sinh TC nếu applicable):

- **AuthN token**: không token / token sai-hỏng / hết hạn / token của user khác → BE chặn đúng (401/403), không rò dữ liệu.
- **AuthZ dọc (privilege escalation)**: role thấp gọi thẳng API/URL chức năng role cao → 403; UI ẩn nút KHÔNG đủ, phải chặn ở BE.
- **AuthZ ngang (IDOR)**: user A đổi id trong path/body/query sang resource của user B (hoặc org/tenant khác) → 403/404, KHÔNG trả data của B. BẮT BUỘC cho mọi endpoint có id resource.
- **Injection**: SQL/NoSQL ở field & query param (`' OR '1'='1`), XSS stored (lưu `<script>` rồi mở lại ở màn khác), XSS reflected (echo qua search/error), command/template injection nếu input đi tới hệ thống ngoài → phải bị escape/chặn, không thực thi.
- **Mass assignment / over-posting**: gửi thêm field không được phép (`role`, `isAdmin`, `status`, `price`, `ownerId`...) vào body create/update → BE bỏ qua, KHÔNG cho ghi đè.
- **Sensitive data exposure**: response/UI/log/URL không lộ password/token/hash/secret/PII vượt quyền; PII phải mask; không đẩy secret qua query string.
- **File upload security** (nếu có upload): file thực thi (`.php/.exe/.svg` có script), sai MIME giả extension, path traversal tên file (`../../`), file quá lớn, zip bomb → bị từ chối/khử trùng.
- **Rate limiting / brute force** (nếu applicable): lặp login sai/OTP/endpoint nhạy cảm nhiều lần → khóa/chậm/captcha, không brute force vô hạn.
- **Session/logout**: sau logout token cũ vô hiệu; đổi mật khẩu → session cũ vô hiệu (nếu spec); cookie nhạy cảm `HttpOnly`/`Secure` nếu kiểm được.
- **CORS/headers** (nếu applicable & kiểm an toàn được): CORS không cho origin lạ đọc dữ liệu có auth.

Ràng buộc thể hiện ở UI luôn phải có TC bypass thẳng BE (đồng bộ mục 10). Nhóm không áp dụng / không kiểm an toàn được ở môi trường test → `N/A + lý do` trong Coverage Gaps.

> **Executable ở Phase 2 (BASIC, non-destructive):** security headers/cookie flags, truy cập chưa auth (401/403), ma trận authz + IDOR (2 tài khoản test), sensitive-data exposure, transport http→https chạy thật bằng `scripts/qa/security_check.js` (skill `security_check`, **GET/read-only, never-auto, cần `--confirm-nonprod`**). Control → PASS/FAIL; exposure → finding (mask PII). **Fuzzing/khai thác SQLi-XSS/brute-force/rate-limit → Manual-only + OWASP ZAP opt-in**, chỉ chạy khi có phê duyệt người + target non-prod. Thiếu 2 tài khoản test → authz/IDOR = `needs_account`.
