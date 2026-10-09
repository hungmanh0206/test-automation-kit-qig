---
description: Execute testcase của một task (Phase 2) — dựng automation, chạy thật trên UAT, chấm verdict theo taxonomy.
---

Task: **$ARGUMENTS**

> **Đầu lượt chỉ đọc hai thứ: `handoff/phase1.md` của task, và artifact canonical.** Hội thoại của
> lượt trước KHÔNG phải nguồn — nó không qua gate nào, và sau một lần nén thì chính nó cũng mất chi
> tiết. Chưa có file bàn giao thì `preflight_gate` sẽ kêu; đọc `reports/` của phase trước thay thế.

Đọc: `prompt_templates/run_phase2_template.md` → `.agent/workflows/phase2_execute.md` (nó dẫn tiếp sang
`phase2_01`…`phase2_04`).

Gate bắt buộc:

```bash
node scripts/qa/preflight_gate.js --mode phase2 --task $ARGUMENTS
npm run expansion:plan
npm run gate:output
npm run self-review -- --task $ARGUMENTS
npm run bugs:checklist
```

**Dừng khi:**
- Chưa **xác nhận với user** trước lượt chạm UAT đầu tiên.
- Có FAIL mà chưa rerun 2–3 lần để loại flaky/setup.
- `self-review` còn CHẶN — sửa nguyên nhân, không nới ngưỡng.
