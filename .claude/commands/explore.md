---
description: Mở một phiên exploratory testing có charter — dò rủi ro nghiệp vụ ngoài phạm vi case đã viết.
---

Phạm vi / charter: **$ARGUMENTS**

Đọc: `exploratory/run_exploratory_session.md` (kèm `exploratory/tours.md` chọn tour, `exploratory/reference.md`).

Gate bắt buộc:

```bash
npm run explore:charter
npm run explore:check
npm run explore:close
```

**Dừng khi:** chưa **xác nhận với user** trước lượt chạm UAT · chưa khai charter (phiên không charter thì
không đo được đã dò gì) · phát hiện nghi bug nhưng chưa có oracle độc lập → ghi `OBSERVATION`, không log bug.
