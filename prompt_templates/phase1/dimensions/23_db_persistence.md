# §23 — DB Persistence Coverage (bản ghi dưới DB sau khi UI đổi dữ liệu)

> Tag bắt buộc trong tiêu đề case: **`[DbPersist]`** · Loại case: **Database**
> Mở khi: case có **Create / Update / Delete** dữ liệu (kể cả xoá mềm, kể cả thao tác chỉ đổi 1 field).

## Vì sao chiều này tồn tại

UI và API **không** đủ để nói bản ghi đã được lưu đúng. Response của API thường **echo lại request**, không
phản ánh hàng đã ghi; còn FE thì format lại giá trị trước khi hiển thị. Bảy lớp lỗi dưới đây **UI xem như
đúng** — chỉ đọc bản ghi mới thấy:

| Lỗi | UI thấy gì |
|---|---|
| Số lưu `540000.0` thay vì `540000` (đổi kiểu) | hiển thị đúng — FE format lại |
| Lệch múi giờ: nhập 23:00 → lưu sang hôm sau | hiển thị đúng — FE convert ngược |
| Text bị cắt do `varchar(n)` | hiển thị đúng **phần đã lưu** |
| Xoá mềm hỏng: UI báo đã xoá, DB `deleted_at` vẫn NULL | "Xoá thành công" |
| Bảng chính đổi, bảng liên quan không đổi | màn hiện tại đúng |
| Double-submit tạo 2 bản ghi | trang 1 chỉ thấy 1 |
| Thao tác FAIL nhưng DB vẫn đổi (rollback sai) | báo lỗi — trông như không có gì xảy ra |

Hai lỗi **xoá mềm** và **bảng liên quan** gần như không thể phát hiện qua UI.

## Công cụ

`tests/support/setup/db/dbVerify.ts` — `expectRow` · `expectSoftDeleted` · `expectNotDeleted` ·
`expectAbsent` · `expectCount` · `snapshot` + `expectNoChange`.
So sánh phải dùng matcher theo NGHĨA: `money()` · `instant()` · `text()` (xem `match.ts`). Quy ước dự án ở
`.agent/config/db.conventions.json`; creds ở `profiles/<TASK>/task.env` prefix `LIB_MASTER_DB_RO_`.

## Checklist — mỗi dòng một case

| # | Ca | Cách kiểm |
|---|---|---|
| 1 | Bản ghi tồn tại / không tồn tại đúng kỳ vọng | `expectRow` / `expectAbsent` |
| 2 | Giá trị khớp **chính xác** — số không đổi kiểu, text không bị cắt, ngày đúng mốc | `money()` · `text(v, { maxLength })` · `instant()` |
| 3 | Xoá mềm đúng quy ước, KHÔNG phải xoá cứng, và không phải "UI ẩn mà DB còn nguyên" | `expectSoftDeleted` |
| 4 | Bảng liên quan đổi/không đổi đúng kỳ vọng | `expectCount` theo `relations` trong conventions |
| 5 | `updated_at` có nhảy sau khi sửa | `snapshot` trước → so sau |
| 6 | **Negative (quan trọng nhất)**: thao tác FAIL ⇒ DB **không đổi gì** | `snapshot` → thao tác → `expectNoChange` |
| 7 | Double-submit không tạo 2 bản ghi | `expectCount(..., 1)` |

## Bốn ràng buộc — vi phạm là tự tạo bug ma

**① DB là oracle PHỤ.** Nguồn sự thật vẫn là FSD/`knowledge/domain/BR-*`. Lấy số từ DB rồi bảo "UI phải
giống DB" là **tautology** — cấm. Giá trị lớn nhất của kiểm song song là **khoanh tầng**:

| UI | DB | Kết luận | `failureLayer` |
|---|---|---|---|
| ✅ | ❌ | BE lưu sai | `product_bug` (BE) |
| ❌ | ✅ | FE render sai | `product_bug` (FE) |
| ❌ | ❌ | Logic sai từ gốc | `product_bug` |

**② Chỉ dùng cột ĐÃ NEO.** `db.conventions.json → fieldMap.anchored` (hiện **7 cột**). Cột trong
`unanchored` (hiện **11 cột**, mỗi cột có ghi lý do) thì **KHÔNG được dùng để phán** — đoán sai cột thì kết
luận vẫn ra, lại **có số từ DB** nên trông thuyết phục hơn bug ma thường. Cần thêm cột thì neo trước bằng
fixture phân biệt (`node outputs/.../automation/_db_field_map.js`), đừng suy từ tên cột.

**③ Chỉ verify bản ghi do CHÍNH lượt test tạo** (lọc theo `id`/`RUN_ID`). UAT dùng chung: assert lên dữ liệu
người khác là nguồn flaky và là đường ra kết luận sai. `snapshot`/`expectNoChange` **bắt buộc khai `columns`**
— job nền chạm `updated_at` sẽ làm đỏ oan nếu so cả hàng.

**④ DB KHÔNG phải evidence.** Evidence vẫn là ảnh/video màn hình đúng chuẩn; số liệu DB đi vào phần nhận
định dưới dạng số đo (`hs_net_amount = 0`, `deleted_at IS NULL`). Và không dựng precondition bằng DB.

## Hai giới hạn ĐÃ ĐO của DB này (đừng hứa thứ máy không làm được)

- **Không có audit hành động người dùng.** `ic_payment_orders` và `ic_payment_transaction_orders` KHÔNG có
  cột nào ghi người sửa; `ic_payment_webhook_logs` là log webhook. ⇒ Ca #5 chỉ kiểm `updated_at`,
  `expectAudit()` sẽ **từ chối** thay vì trả kết quả rỗng.
- **39/39 cột thời gian là `timestamp WITHOUT time zone`.** Khi `conventions.timestamps.storedZone` còn
  trống, `instant()` trả **`inconclusive`** — đó là câu trả lời đúng, không phải lỗi. Xác nhận múi giờ (tạo
  gì đó lúc 23:00 rồi soi giá trị lưu) mới bật được ca #2 phần ngày.

## Liên quan

§5 API (idempotency phía gửi) · §8 Resilience · §9 Side-effect (webhook đi ra) · §14 BE Response Conformance
(so **response**, còn §23 so **bản ghi**) · §22 Inbound Callback (callback ghi tiền ⇒ nên có cả §23).
