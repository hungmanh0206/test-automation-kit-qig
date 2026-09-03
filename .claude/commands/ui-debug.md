---
description: Khám phá DOM thật của một màn để tìm locator bền và neo nhãn UI ↔ cột DB — dùng khi màn mới hoặc script_error do locator.
---

Màn / task: **$ARGUMENTS**

Đọc và làm theo: `.agent/skills/phase2/ui_debug_agent/SKILL.md`.

Rule kế thừa (đọc, đừng chép lại): `.agent/rules/locator_strategy.md` · `.agent/rules/playwright_fe.md` ·
`.agent/rules/locator_healing_policy.md` · `.agent/rules/qa_instincts.md`.

Kiểm chất lượng locator đề xuất:

```bash
npm run lint:locator
```

**Dừng khi:** chưa **xác nhận với user** — skill này mở browser vào UAT (mức tự chủ **Never-auto**). Cần
thao tác GHI để tới được màn thì hỏi trước, không tự tạo/sửa/xoá dữ liệu nghiệp vụ.
