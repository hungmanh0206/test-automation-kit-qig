---
description: Kiểm input/config bắt buộc TRƯỚC khi bắt đầu một phase — thiếu file, JSON hỏng, hoặc chưa có testcase canonical thì chặn.
---

Task: **$ARGUMENTS**

Chạy cửa vào:

```bash
node scripts/qa/preflight_gate.js --mode phase2 --task $ARGUMENTS
```

Đổi `--mode` theo việc đang làm: `phase1` · `phase2` · `publish` · `generic` (CI/static).

Nếu task khai dùng §23 (`db_persistence` trong `dimension_manifest.json`, hoặc testcase có tag
`[DbPersist]`) thì gate còn đọc quyền DB thật; mất VPN thì dùng `--skip-db-live` **và nói ra** là chưa
có bằng chứng read-only.

**Dừng khi:** exit ≠ 0. Đọc từng dòng CHẶN và sửa nguyên nhân — không dùng `--qa-approved` để đi tiếp
trừ khi user yêu cầu tường minh.
