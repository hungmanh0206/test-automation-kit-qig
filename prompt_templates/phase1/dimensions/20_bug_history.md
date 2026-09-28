# Chiều coverage: Error Guessing từ BUG LỊCH SỬ

> Tag bắt buộc trong tiêu đề case: **`[BugHistory]`**.
> Mở khi **`knowledge/bugs/` có entry cùng module với scope**.
>
> Thêm 20/08/2026. Đo trước khi thêm: kho có **58 bug thật**, nhưng KHÔNG prompt sinh case nào biến nó thành
> checklist. Nó chỉ được dùng để **nâng risk** ở `phase1_00_scope_planning.md`.

## 20. Error Guessing từ bug lịch sử

Đây là kỹ thuật bắt bug hiệu quả nhất trong nhóm kinh nghiệm, vì nó không dựa trên lý thuyết mà dựa trên
**lỗi ĐÃ XẢY RA THẬT ở chính sản phẩm này**. Một lỗi đã lọt một lần thì đường lọt đó vẫn còn mở cho tới khi
có case đứng canh.

### Bước 1 — Lấy danh sách bug của module trong scope

```bash
npm run bugs:checklist -- --module "<tên nhóm chức năng>"     # hoặc --task <TASK_KEY>, --tag <tag>
```

Lệnh đọc `knowledge/bugs/*.json` (field `module`, `tags`, `bug`, `task_key`, `backlog_status`) và in ra bug đã
từng xảy ra ở module đó. Không có entry nào ⇒ ghi `N/A: module chưa có bug lịch sử` vào Coverage Gaps.

### Bước 2 — Mỗi bug lịch sử phải quy về MỘT trong ba kết cục

Không được bỏ trống bug nào:

| Kết cục | Khi nào | Phải làm gì |
|---|---|---|
| **Có TC canh** | Bộ hiện tại đã có case bắt được đúng lớp lỗi đó | Ghi TC ID vào cột đối chiếu — **không** sinh case trùng |
| **Sinh TC mới** | Chưa có case nào bắt được | Sinh case `[BugHistory]`, expected bám đúng **triệu chứng đã xảy ra** |
| **Không còn áp dụng** | Feature đã bỏ / rule đã đổi | Ghi lý do vào Coverage Gaps — **không** im lặng bỏ qua |

### Bước 3 — Sinh case theo LỚP lỗi, không chép nguyên bug

Bug cũ là **ví dụ**, không phải case. Từ mỗi bug hãy hỏi *"lớp lỗi này còn chỗ nào khác cũng dính?"*:

- `[BE] Account role bị giới hạn quyền vẫn EXPORT được` → lớp **guard thiếu ở một hành động phụ**. Không chỉ
  test lại Export, mà quét mọi hành động phụ cùng màn (in, tải mẫu, gửi mail) với chính role đó.
- Bug về **giá trị tiền sai** → lớp *lỗi công thức/quy đổi*; kiểm cả các field tiền khác cùng khối.
- Bug về **field biến mất khỏi response** → lớp *mất field*; kiểm các field cùng nhóm trên cùng endpoint.

### Bước 4 — Ưu tiên theo tần suất
Module xuất hiện nhiều lần trong `knowledge/bugs/` là vùng **đã chứng minh là dễ vỡ**. Ưu tiên sinh case ở
đó trước. Cân nhắc nâng `Mức độ rủi ro` của các case liên quan, vì nó ảnh hưởng band mở rộng ở Phase 2.

> ⚠️ Bug mang `backlog_status` là *Rejected* / *false positive* thì **KHÔNG** sinh case canh — canh một thứ không
> phải lỗi là tự tạo case sai. Ghi vào Coverage Gaps để lần sau khỏi soi lại.
