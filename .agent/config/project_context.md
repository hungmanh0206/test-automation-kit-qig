# Project Context

> Context không nhạy cảm để agent định hướng trước Phase 1/Phase 2.

## Project Metadata

| Field | Value |
|---|---|
| Project name | `<YOUR_PROJECT_NAME>` |
| Output convention | `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/` |
| Task key convention | Jira key hoặc scope ngắn của feature, ví dụ `<TASK_KEY>` |

## Sites

### LMS

| Field | Env key |
|---|---|
| Base/Login/User/Password | `LMS_BASE_URL`, `LMS_LOGIN_URL`, `LMS_USERNAME`, `LMS_PASSWORD` |
| API/Swagger | `LMS_API_BASE_URL`, `LMS_SWAGGER_URL` |

### OPS

| Field | Env key |
|---|---|
| Base/Login/User/Password | `OPS_BASE_URL`, `OPS_LOGIN_URL`, `OPS_USERNAME`, `OPS_PASSWORD` |
| API/Swagger | `OPS_API_BASE_URL`, `OPS_SWAGGER_URL` |
| Feature URLs | `FEATURE_1_URL`, `FEATURE_2_URL`, `FEATURE_3_URL` |

## Rules

- Không đặt password, token, cookie, private key hoặc secret ở file này.
- Secret phải nằm trong `.env.local`, `.env`, CI env hoặc secret store.
- Không dùng Jira key/domain/module name làm project name; chúng chỉ là `TASK_KEY` hoặc scope.
- Nếu thiếu `PROJECT_OUTPUT_DIR` hoặc input bắt buộc không thể suy ra từ context/env, dừng và hỏi user.

## Quy ước đội (đã chốt — KHÔNG hỏi lại mỗi lần)

> Đây là loại tri thức không thuộc store nào trong `knowledge/` (không phải business rule, không phải bản đồ
> hệ thống, không phải cách dựng state) — nó là **cách đội này thống nhất làm việc**. Trước đây chỉ nằm trong
> trí nhớ của người/agent đã làm lâu, nên người tiếp nhận dự án không có. Ghi ở đây để ai vào cũng thấy.
>
> Điền/sửa theo dự án của bạn — các dòng dưới là ví dụ có thật từ một dự án đang chạy.

| Quy ước | Nội dung |
|---|---|
| **Chạy lại Phase 1 ⇒ KHÔNG push testcase lên Sheet** | Với task đã có testcase publish trước đó (lịch sử: từng publish lên AIO Tests, vd `SAPP-24395` — bộ 530 đã publish và đã execute; nay tương đương là Google Sheet), lượt chạy Phase 1 **lại** là để *đo/kiểm/bổ sung*, **không phải để publish**. Dừng ở Excel + summary; **KHÔNG** chạy `phase1/04_auto_publish_jira.md` (giờ là publish lên Sheet). User chốt 17/08/2026 — không hỏi lại mỗi lần. Muốn publish thì phải có yêu cầu **tường minh** của user cho đúng lượt đó. |
| Cấu trúc publish testcase | Mỗi **nhóm chức năng = 1 sheet riêng** trong cùng workbook Google Sheet (do `md_to_xlsx.js` xuất, upload nguyên file qua Drive MCP). Đây là mặc định, không hỏi lại từng lần. |
| Case regression/change-impact | Xếp vào **nhóm chức năng liên quan**, KHÔNG tách nhóm/subfolder "Regression" riêng. |
| Đặt tên dữ liệu test | Contact/order tạo qua tool phải bắt đầu bằng **`IT test`** + tên ngắn gọn, để phân biệt với dữ liệu thật và dọn được theo tiền tố. |
| Case vướng data/env (không phải defect) | Ghi **PASS kèm comment giải thích trung thực** trên testcase, KHÔNG để FAIL đỏ — FAIL dành cho defect. |
| Trước khi gen testcase | Phân tích tài liệu xong phải **gom câu hỏi làm rõ hỏi trước**, có câu trả lời rồi phân tích lại mới gen. Không đoán chỗ mờ. |
