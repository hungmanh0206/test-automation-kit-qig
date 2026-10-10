---
description: Chạy bó gate trước khi finalize/publish một task — checklist gộp preflight + design + row-quality + execution + attestation.
---

Task: **$ARGUMENTS**

```bash
npm run self-review -- --task $ARGUMENTS
```

Thêm `--compact` vào bất kỳ gate nào để in gọn: mỗi vi phạm một dòng `MÃ · TC ID · ý chính`.
Nó là cách IN khác, không phải cách LỌC — mọi vi phạm vẫn có mặt. Bỏ `--compact` để đọc lại
lời giải thích đầy đủ của một mã.

Gate lẻ khi cần xem riêng nguyên nhân: `gate:output` · `gate:gen-testcase` · `design:gate` ·
`dim:coverage` · `tc:review` · `expansion:audit` · `bugs:checklist` · `gate:policy` · `mutation:check` ·
`unit:stamp` (mọi verdict đã chạy phải khai ĐƠN VỊ đã đo — `unit:stamp:enforce` để chặn).

**Dừng khi:** còn dòng CHẶN. Sửa nội dung cho đúng luật — **không** nới ngưỡng gate, không dùng cờ bỏ qua
để cho xanh. Gate báo oan thì sửa **luật** (kèm kiểm-âm), đừng tắt gate.
