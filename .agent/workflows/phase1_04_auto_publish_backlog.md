# Phase 1 - Bước 4: Auto Publish Testcase (Google Sheet)

> Publish testcase từ Excel source of truth lên **Google Sheet** (qua Drive MCP) sau khi QA xác nhận. Đây là step riêng trong phạm vi Phase 1, không chạy chung với bước sinh testcase.

## Mục Đích

Đẩy testcase đã được QA xác nhận từ Excel lên Google Sheet để QA/Dev review. Excel là source of truth khi gen/publish; **publish là bước cần TRƯỚC Phase 2** vì Phase 2 execute luôn tải bản Sheet mới nhất về trước khi chạy.

> Công cụ test-management của kit là **Google Sheet** (qua Google Drive MCP), thay cho Google Sheet cũ. File `.xlsx` do `md_to_xlsx.js` xuất ra chính là nội dung Sheet — không có bước ánh xạ field riêng. Chi tiết: skill `backlog_testcase_publisher`.

## Preconditions

| Điều kiện | Bắt buộc |
|---|---|
| Excel testcase đã export | Có |
| `phase1-summary.md` đã có Final Decision | Có |
| QA confirmation rõ ràng | Có |
| Google Drive MCP đã kết nối trong phiên chat | Có |
| Review nội dung `.xlsx` local trước khi ghi đè Sheet | **Bắt buộc** (Drive MCP không "sửa 1 ô" — ghi đè là ghi đè cả file) |

## Giao việc cho subagent

Bước convert Markdown sang Excel trước khi publish giao `excel-convert` (đầu vào: đường dẫn `.md` và
`.xlsx`; đầu ra: đường dẫn file đã ghi, số dòng, nguyên văn cảnh báo). Nó **không tự upload lên Drive** —
đẩy lên Sheet là việc của luồng chính, sau khi người xem lại. Xác minh: `docs/v2.4.1/AGENTS_VERIFY.md`.

## Workflow

1. Echo scope:
   - `PROJECT_OUTPUT_DIR`
   - `TASK_KEY`
   - `TASK_OUTPUT_DIR`
   - phase: `Phase 1 - Auto Publish Testcase (Google Sheet)`
2. Xác nhận QA đã approve Excel/testcase:
   - Nếu prompt/user không ghi rõ `QA confirmation: APPROVED`, dừng chờ xác nhận, chưa ghi lên Sheet.
   - Không tự suy diễn approval từ việc Excel tồn tại.
3. Đọc Excel canonical:
   - `<TASK_OUTPUT_DIR>/test-cases/*.xlsx` (output của `md_to_xlsx.js`, đã có dashboard + 1 sheet/nhóm chức năng).
4. Tìm file Sheet đã publish trước đó (tránh tạo trùng):
   - Có `GOOGLE_SHEET_URL` trong `profiles/<TASK_KEY>/task.env` → `mcp__claude_ai_Google_Drive__search_files` xác nhận file còn tồn tại.
   - Chưa có → `search_files` theo tên chuẩn hoá từ `TASK_KEY` trong folder task trên Drive.
5. Publish qua Drive MCP:
   - File đã có → `mcp__claude_ai_Google_Drive__update_file` (ghi đè, giữ nguyên link).
   - Chưa có → `mcp__claude_ai_Google_Drive__create_file` (upload `.xlsx`, để Drive tự convert sang Google Sheets).
   - Ghi/cập nhật link trả về vào `profiles/<TASK_KEY>/task.env` field `GOOGLE_SHEET_URL`.
6. Cập nhật `task.md` với link Sheet và số liệu (tổng TC, số nhóm/sheet).
7. Đối soát: publish lỗi (quyền/network) → ghi blocker, không bỏ qua; không sửa testcase để khớp lỗi publish.

## Rules

- Không publish từ Markdown khi Excel đã tồn tại; Excel canonical là source of truth, Sheet chỉ là bản đồng bộ.
- Không publish thật nếu thiếu QA confirmation.
- Không sửa nội dung testcase trực tiếp trên Sheet (UI Google Sheets); authoring ở Excel rồi re-publish (`update_file`) — ghi đè toàn phần nên bản sửa tay trên Sheet sẽ mất.
- Sheet không có folder/tag/Cycle/Run/custom field như công cụ test-management cũ — đổi mô hình dữ liệu, không phải đổi tên; đừng đi tìm các khái niệm đó rồi kết luận "thiếu". Nhóm chức năng thể hiện bằng sheet riêng trong cùng workbook.
- Nếu Excel bỏ bớt TC sau publish thì không cần xử lý cleanup riêng, khác công cụ cũ. Lần `update_file` kế tiếp tự phản ánh đúng Excel hiện tại: case bị xoá khỏi Excel cũng biến mất khỏi Sheet.
- Không log bug Backlog trong step này; bug logging thuộc Phase 2.
- Nếu publish lỗi một phần, giữ Excel canonical và ghi rõ lỗi trong report local.
- Việc publish chỉ làm được khi agent đang chạy trong phiên chat (MCP không gọi được từ CI headless) — đánh đổi có chủ ý.

## Outputs

| Output | Vị trí |
|---|---|
| Google Sheet | Drive, link lưu ở `profiles/<TASK_KEY>/task.env` (`GOOGLE_SHEET_URL`) |
| Task tracking update | `<TASK_OUTPUT_DIR>/task.md` |
