---
description: Chạy lại các case liên quan tới bug đã fix và cập nhật kết quả (Re-run) — không sinh testcase mới.
---

Task: **$ARGUMENTS**

> Chỉ truyền đúng `<TASK_KEY>`, **không kèm bug key** — `$ARGUMENTS` đi thẳng vào
> `preflight_gate.js --task`, thêm chữ là gate nhận sai task rồi chặn. Bug/case cần rerun thì nói ở
> câu tiếp theo ("rerun bug SAPP-123"), hoặc dùng prompt mẫu ở USER_GUIDE Mục 9.2.

Đọc: `prompt_templates/run_phase_re-run_template.md` → `.agent/workflows/rerun.md`
(→ `rerun_01_map_bug_to_testcase.md` · `rerun_02_rerun_and_verify.md` · `rerun_03_update_backlog_and_report.md`).

Gate bắt buộc:

```bash
node scripts/qa/preflight_gate.js --mode phase2 --task $ARGUMENTS
npm run bug:tc-match
npm run expansion:plan
npm run gate:output
npm run bugs:checklist
```

**Dừng khi:** chưa xác nhận chạm UAT · kết quả rerun cách thời điểm comment quá xa (deploy có thể lật
ngược kết quả — xác nhận sát giờ) · map bug→case còn ở mức "đề xuất" mà chưa ai duyệt.
