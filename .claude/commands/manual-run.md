---
description: Chạy tay case Manual-only để chúng có verdict thật, thay vì nằm mãi ở SKIP_SETUP. Never-auto, chỉ chạy khi user yêu cầu.
---

Task: **$ARGUMENTS**

Nhánh này chạm UAT bằng tay, nên **xác nhận với user trước mỗi lượt chạm**.

Đọc theo đúng thứ tự:

1. `manual-run/reference.md` — ranh giới, và ba luật của kit đè luật ngoài
2. `manual-run/run_manual_execution.md` — workflow và khuôn `session.md`

Điều kiện vào: case định chạy **đã khai `[manual]`** ở ô Tiền điều kiện của bộ canonical. Chưa khai thì
**dừng** — sửa lời khai ở Phase 1 kèm lý do, hoặc mở `reports/capability-request.md` để xin test hook.
Chạy tay không phải đường lách khi viết automation khó.

Gate bắt buộc:

```bash
npm run expansion:plan
npm run manual:check -- --task $ARGUMENTS
npm run manual:check:enforce -- --task $ARGUMENTS
npm run self-review:enforce -- --task $ARGUMENTS
```

**Dừng khi:** case chưa khai `[manual]`, hoặc `manual:check:enforce` còn CHẶN → **không** ghi kết quả về
cột `Result`.
