---
description: Đẩy testcase / kết quả execution lên AIO — luôn dry-run trước, chỉ apply sau khi đối chiếu.
---

Task: **$ARGUMENTS**

Thứ tự bắt buộc — **dry-run trước, `:apply` sau**:

```bash
npm run aio:publish                 # dry-run: xem sẽ tạo/sửa gì
npm run aio:publish:apply           # chỉ khi dry-run đúng ý
npm run aio:verify-fields           # 2xx KHÔNG chứng minh mapping đúng — phải đối chiếu field
```

Đẩy kết quả chạy: `aio:push-exec` (dry-run) → `aio:push-exec:apply`.
Kéo bản canonical về trước khi execute: `aio:pull:write` → `aio:verify:enforce`.

**Dừng khi:** chưa chạy dry-run · task chạy lại mà testcase đã có trên AIO (lượt đó dừng ở Excel, không
publish) · `aio:verify-fields` báo lệch field.
