---
description: Execute testcase của một task (Phase 2) — dựng automation, chạy thật trên UAT, chấm verdict theo taxonomy.
---

Task: **$ARGUMENTS**

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
