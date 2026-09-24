---
name: backlog_testcase_publisher
description: Publish testcase từ Excel canonical lên **Google Sheet** sau Phase 1 (qua Drive MCP: search_files/create_file/update_file).
---

# Testcase Publisher (Google Sheet)

> Tên skill giữ nguyên `backlog_testcase_publisher` cho tương thích ngược (đường dẫn được nhiều file khác trỏ tới), nhưng đích đến giờ là **Google Sheet**, không còn bug-tracker nào.

## Purpose

Publish bộ testcase đã được QA xác nhận từ Excel canonical lên **Google Sheet** (qua Google Drive MCP) để QA/Dev review, track và làm nguồn cho Phase 2 execute. File `.xlsx` do `md_to_xlsx.js` xuất ra ở `<TASK_OUTPUT_DIR>/test-cases/` **chính là** nội dung Sheet — không có bước ánh xạ field/model riêng: upload lên Drive là xong, Drive tự convert `.xlsx` → Google Sheets. Publish là step riêng trong phạm vi Phase 1; không cần lifecycle cleanup (Deprecated) như công cụ test-management cũ — mỗi lần sync là ghi đè toàn bộ, case bị xoá khỏi Excel tự nhiên biến mất khỏi Sheet ở lần sync sau.

## Responsibilities

| Trách nhiệm | Yêu cầu |
|---|---|
| Source | Chỉ đọc Excel `.xlsx` đã export từ Phase 1 (`md_to_xlsx.js`) — chính là nội dung sẽ lên Sheet, không ánh xạ field nào khác. |
| QA gate | Chỉ publish thật khi có QA confirmation rõ ràng. |
| Tìm file đã tồn tại | `mcp__claude_ai_Google_Drive__search_files` theo tên chuẩn hoá từ `TASK_KEY` trong folder task trên Drive. |
| Publish | Có rồi → `update_file` (ghi đè, giữ nguyên `fileId`/link, không tạo file trùng); chưa có → `create_file` (upload `.xlsx`, để Drive tự convert sang Google Sheets, không set `disableConversionToGoogleType`). |
| Lưu link | Ghi `viewUrl`/link Drive trả về vào `profiles/<TASK_KEY>/task.env` field `GOOGLE_SHEET_URL`. |
| Không có lifecycle riêng | Không có khái niệm Deprecated/case status trên Sheet — Excel là canonical, Sheet chỉ là bản hiển thị/đồng bộ. Excel bỏ TC nào thì lần `update_file` sau Sheet cũng mất TC đó. |
| No hard delete thủ công | Không tự xoá dòng trên Sheet qua UI — sửa ở Excel canonical rồi re-publish (`update_file`) để tránh lệch nguồn. |

## Inputs

| Input | Nguồn |
|---|---|
| Excel testcase | `<TASK_OUTPUT_DIR>/test-cases/*.xlsx` (output của `md_to_xlsx.js`) |
| Story/epic liên kết | `BACKLOG_STORY_KEY` (nếu cần ghi chú liên kết, không bắt buộc để publish) |
| Google Sheet URL đã publish trước đó | `profiles/<TASK_KEY>/task.env` field `GOOGLE_SHEET_URL` (nếu có — dùng để `search_files`/`update_file` đúng file, tránh tạo trùng) |
| Rules | `RULE_GLOBAL.md`, active prompt |

## Outputs

| Output | Vị trí |
|---|---|
| Google Sheet | Drive, link lưu ở `profiles/<TASK_KEY>/task.env` (`GOOGLE_SHEET_URL`) |
| Publish summary | Agent tự ghi vào execution summary / `task.md` (file nào tạo/cập nhật, link) |

## Commands

Không có script CLI riêng (khác công cụ cũ) — publish là thao tác agent làm trực tiếp qua MCP trong phiên chat:

1. `mcp__claude_ai_Google_Drive__search_files` — tìm file Sheet đã publish trước đó (theo `GOOGLE_SHEET_URL` đã lưu, hoặc theo tên chuẩn hoá từ `TASK_KEY`).
2. Có → `mcp__claude_ai_Google_Drive__update_file` (upload `.xlsx` mới nhất, ghi đè). Chưa có → `mcp__claude_ai_Google_Drive__create_file`.
3. Ghi/​cập nhật `GOOGLE_SHEET_URL` trong `profiles/<TASK_KEY>/task.env`.

Đồng bộ kết quả execute ngược lại Sheet (Phase 2) dùng script thật (không qua MCP để ghi cell):

```bash
node scripts/convert_excel/merge_execution_status.js <local .xlsx> <TASK_OUTPUT_DIR>/test-results/testcase-status.json
```
rồi agent `update_file` đẩy bản đã merge lên Drive.

## Decision Rules

- Không publish từ Markdown nếu Excel đã tồn tại; Excel là canonical source, Sheet chỉ là bản đồng bộ.
- Không publish thật nếu QA chưa xác nhận — publish là ghi đè file thật trên Drive, không có dry-run tách riêng (review trước khi `update_file`/`create_file` chính là bước soát).
- **Luôn review nội dung `.xlsx` local trước khi ghi đè Sheet** — Drive MCP không có "sửa 1 ô", ghi đè là ghi đè cả file.
- Sheet không có folder/tag/Cycle/Run/custom field như công cụ test-management cũ — đây là đổi mô hình dữ liệu, không phải đổi tên. Đừng đi tìm các khái niệm đó rồi kết luận "thiếu".
- Nhóm chức năng thể hiện bằng sheet riêng trong cùng workbook (`md_to_xlsx.js` đã tạo 1 sheet/nhóm), không phải folder.
- Nếu chưa có `GOOGLE_SHEET_URL` và không tìm thấy file qua `search_files`, tạo mới bằng `create_file` rồi lưu link — không đoán ID file.
- Nếu publish lỗi một phần (network/quyền), giữ Excel và báo blocker; không sửa testcase để khớp lỗi publish.
- Phase 2 execute LUÔN tải bản Sheet mới nhất về `test-cases/from-sheet/*.xlsx` qua `download_file_content` trước khi execute — không có khái niệm nguồn opt-in/opt-out (`TESTCASE_SOURCE`) như trước.
- Việc upload/download chỉ làm được khi **agent đang chạy trong phiên chat** (MCP không gọi được từ script CLI/CI headless) — đây là đánh đổi có chủ ý, không phải thiếu sót.

## Anti-Patterns

- Tạo testcase trực tiếp trên Sheet khi chưa có Excel canonical.
- Sửa nội dung case trực tiếp trên Sheet (UI Google Sheets) thay vì sửa Excel rồi re-publish — `update_file` ghi đè toàn phần nên bản sửa tay trên Sheet sẽ mất.
- Ghi đè Sheet (`update_file`) khi chưa review nội dung `.xlsx` local sắp upload.
- Trộn testcase publish với Backlog bug logging sau Phase 2 — hai việc khác nhau, khác đích (Sheet vs Backlog).
- Giả lập/viết code service-account hoặc OAuth mới cho việc này — auth dùng đúng Drive MCP đã kết nối sẵn trong phiên chat; nếu cần automation headless không có Claude, đó là việc khác, quay lại `scripts/integrations/google_sheet/` (scaffolding service-account có sẵn nhưng chưa wire) làm điểm bắt đầu.
