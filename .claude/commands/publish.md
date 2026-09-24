---
description: Đồng bộ testcase / kết quả execution với Google Sheet — luôn xem lại bản merge local trước khi ghi đè Sheet thật.
---

Task: **$ARGUMENTS**

> Google Sheet đã ngưng dùng (22/09/2026, thay bằng Google Sheet). Đồng bộ giờ đi qua Google Drive MCP —
> không phải npm script gọi REST, nên KHÔNG có cặp lệnh dry-run/`:apply` như trước. An toàn nằm ở việc
> agent luôn REVIEW file local trước khi đẩy đè lên Drive (Drive không giữ version cũ theo mặc định).

**Publish testcase** (sau khi Phase 1 xuất `.xlsx` canonical):
1. `search_files` tìm file đã tồn tại trên Drive (theo tên chuẩn hoá từ TASK_KEY); có thì chuẩn bị
   `update_file`, chưa có thì `create_file` (upload `.xlsx`, để Drive tự convert sang Sheets thật).
2. **Xem lại** tên file + project đích TRƯỚC khi gọi — đây là bước tương đương "dry-run" cũ.
3. Ghi `viewUrl` trả về vào `profiles/<TASK_KEY>/task.env` (`GOOGLE_SHEET_URL`).

**Đồng bộ kết quả execute** (sau Phase 2):
```bash
node scripts/convert_excel/merge_execution_status.js <xlsx-đã-tải-về> <testcase-status.json>
```
Lệnh này CHỈ ghi đè `.xlsx` LOCAL (cột `Result`) — chưa đụng Sheet thật. **Mở file local soi lại** (đúng
case đổi, không case nào khác bị đụng) rồi mới `update_file` đè lên Drive.

**Dừng khi:** chưa tải bản Sheet mới nhất về trước khi execute (agent phải luôn `download_file_content`
trước mỗi lượt Phase 2, không dùng bản `.xlsx` cũ) · gate chất lượng của `merge_execution_status.js` chặn
mà chưa `--qa-approved` có chủ đích · chưa soi lại file local trước khi `update_file`.
