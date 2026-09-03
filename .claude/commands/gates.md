---
description: Chạy bó gate trước khi finalize/publish một task — checklist gộp preflight + design + row-quality + execution + attestation.
---

Task: **$ARGUMENTS**

```bash
npm run self-review -- --task $ARGUMENTS
```

Gate lẻ khi cần xem riêng nguyên nhân: `gate:output` · `gate:gen-testcase` · `design:gate` ·
`dim:coverage` · `expansion:audit` · `bugs:checklist` · `gate:policy` · `mutation:check`.

**Dừng khi:** còn dòng CHẶN. Sửa nội dung cho đúng luật — **không** nới ngưỡng gate, không dùng cờ bỏ qua
để cho xanh. Gate báo oan thì sửa **luật** (kèm kiểm-âm), đừng tắt gate.
