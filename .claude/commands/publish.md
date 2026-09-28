---
description: Đồng bộ testcase / kết quả execution với Google Sheet — luôn xem lại bản merge local trước khi ghi đè Sheet thật.
---

Task: **$ARGUMENTS**

> Chỉ truyền đúng `<TASK_KEY>`, không thêm chữ nào — `$ARGUMENTS` đi thẳng vào các script bên dưới.
> Cần khai thêm tham số (QA confirmation, người xác nhận…) thì dùng prompt mẫu ở USER_GUIDE Mục 9.2.

**Publish testcase** (sau khi Phase 1 xuất `.xlsx` canonical) — đọc và làm theo:

1. `prompt_templates/phase1/04_auto_publish_backlog.md` (điểm vào, có khối QA confirmation)
2. `.agent/workflows/phase1_04_auto_publish_backlog.md` (preconditions + các bước Drive MCP)
3. Skill: `.agent/skills/shared/backlog_testcase_publisher/SKILL.md`

**Đồng bộ kết quả execute** (sau Phase 2) — đọc `.agent/workflows/phase2_04_report_and_backlog_gate.md`.
Lệnh merge:

```bash
node scripts/convert_excel/merge_execution_status.js <xlsx-đã-tải-về> <testcase-status.json>
```

Lệnh này **CHỈ ghi đè `.xlsx` LOCAL** (cột `Result`) — chưa đụng Sheet thật. Mở file local **soi lại**
(đúng case đổi, không case nào khác bị đụng) rồi mới `update_file` đè lên Drive; Drive không giữ version
cũ theo mặc định nên đây là bước tương đương "dry-run" của luồng REST ngày trước.

**Dừng khi:** chưa tải bản Sheet mới nhất về trước khi execute (luôn `download_file_content` trước mỗi
lượt Phase 2, không dùng `.xlsx` cũ) · QA chưa xác nhận Excel được phép publish · gate chất lượng của
`merge_execution_status.js` chặn mà chưa `--qa-approved` có chủ đích · chưa soi lại file local trước khi
ghi đè Drive.
