# §23 — DB Persistence Coverage (bản ghi dưới DB sau khi UI đổi dữ liệu)

> Tag bắt buộc trong tiêu đề case: **`[DbPersist]`**. Loại case: **Database**.
>
> Mở khi case có **Create**, **Update** hoặc **Delete** dữ liệu. Kể cả xoá mềm, kể cả thao tác chỉ đổi 1 field.

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

**② Chỉ dùng cột ĐÃ NEO, và neo theo ĐÚNG MÀN.** `db.conventions.json → fieldMap` có **hai bản đồ**:

- `fieldMap.byScreen` — **cột DB → nhãn UI**, khoá theo màn. **8 màn** đã neo: `SERVICE_FEE` (8 cột) ·
  `CORE` (4) · `CORE_LIST` (5) · `SERVICE_FEE_LIST` (4) · `ADD_ON_LIST` (5) · `CORE_HUBSPOT` (1) ·
  `SERVICE_FEE_HUBSPOT` (1) · `CORE_EDIT` (1).
  Khoá theo màn vì CÙNG một cột có nhãn khác nhau. `original_price` là **"Gross Amount"** ở CORE nhưng
  **"Gross Price"** ở SERVICE_FEE. `final_price` **chưa neo** ở tab Overview của CORE mà **đã neo**
  ("Net Amount") ở màn danh sách. `sync_status` chỉ có ở **tab Hubspot Information**, không có ở Overview.
  Nên kết luận "cột này không hiển thị" khi mới xem một tab là kết luận thiếu.
- `fieldMap.valueMaps` — **giá trị enum DB → nhãn tiếng Việt**, khoá `"<bảng>.<cột>"`. Đã neo
  `status` (6/6 enum — đủ), `sync_status` (2/2 — đủ), `service_fee_type` (6 enum — **đủ cho màn Service Fee**;
  3 enum `DANG_KY_CBE`/`MUA_TAI_KHOAN_CERT`/`MUA_TAI_KHOAN_BECKER` chỉ tồn tại ở đơn **ADD_ON** nên phải neo
  ở màn add-on). Luật neo: **hàm** (1 enum → 1 nhãn) **và đơn ánh** (2 enum không dùng chung nhãn). Khối
  `_coverage` **bắt buộc** nói rõ đủ/thiếu — bẫy đã dính: neo từ 50 hàng đầu rồi tưởng xong, trong khi DB có
  9 enum mà 50 hàng chỉ thấy 6.
- `notDisplayed` — cột **không phải field**: `order_type` quyết định route/màn, khoá màn trong `byScreen`
  chính là giá trị của nó. Để chung với `unanchored` thì cứ tưởng còn việc phải làm.
- `rates` (tách khỏi `money`) — `service_fee_rate` (max 20) và `fixed_discount` (5/10/15) là **tỉ lệ**, không
  phải tiền. Gọi `money()` lên tỉ lệ thì thông điệp thành "lệch 5 đồng" cho một phần trăm.

Tra bản đồ **phải đi qua helper** `uiLabelOfColumn(conv, screen, column)` và
`uiLabelOfValue(conv, 'bảng.cột', enum)` trong `config.ts` — hai hàm này **NÉM** khi cột/enum chưa neo hoặc
khi bạn hỏi nhãn của màn khác. Đọc `conv.fieldMap` trực tiếp là bỏ mất lớp chặn đó.

Cột trong `unanchored` thì **KHÔNG được dùng để phán**. Hiện có **4 mục**, mỗi mục ghi rõ **cần fixture gì**.
Đoán sai cột thì kết luận vẫn ra, lại **có số từ DB** nên trông thuyết phục hơn bug ma thường.

Cần thêm cột thì neo trước bằng fixture phân biệt. Nhãn chỉ được neo khi giá trị của nó **phân biệt** được với
mọi cột cùng loại trên **toàn bộ** hàng đo, xem `fieldMap._how_to_reanchor`. Đừng suy từ tên cột.

**③ Chỉ verify bản ghi do CHÍNH lượt test tạo** (lọc theo `id`/`RUN_ID`). UAT dùng chung: assert lên dữ liệu
người khác là nguồn flaky và là đường ra kết luận sai. `snapshot`/`expectNoChange` **bắt buộc khai `columns`**
— job nền chạm `updated_at` sẽ làm đỏ oan nếu so cả hàng.

**④ DB KHÔNG phải evidence.** Evidence vẫn là ảnh/video màn hình đúng chuẩn; số liệu DB đi vào phần nhận
định dưới dạng số đo (`hs_net_amount = 0`, `deleted_at IS NULL`). Và không dựng precondition bằng DB.

## Cửa vào: preflight CHẶN trước khi chạy

Khai chiều này trong `dimension_manifest.json` (hoặc dùng tag `[DbPersist]`) là **bật thêm một nhóm kiểm ở
preflight**:

```
node scripts/qa/preflight_gate.js --mode phase2 --task <TASK_KEY>
```

Nhóm đó chặn khi: thiếu `.agent/config/db.conventions.json` · conventions không parse được · thiếu
`softDelete.default`/`idColumn`/`safety` · `safety.requireReadonlyUser: false` · `fieldMap.byScreen` rỗng ·
thiếu `profiles/<TASK>/task.env` hoặc thiếu khoá `LIB_MASTER_DB_RO_*` · HOST khớp `denyHostPatterns` · HOST
không có trong `allowedHosts`. Và nó **đọc quyền thật từ catalog**: user có bất kỳ quyền ghi nào ⇒ CHẶN;
**đọc được 0 dòng quyền cũng CHẶN** (phép đo hỏng, không phải "sạch"). Không kết nối được DB cũng chặn — task
cần §23 mà không tới được DB thì không chạy được; đường thoát tường minh là `--skip-db-live`.

Tên user **không** phải bằng chứng: user không có chữ `readonly`/`_ro` chỉ bị **cảnh báo**, vì chặn theo tên
là chặn theo phỏng đoán.

## Neo thêm cột: HỎI DB TRƯỚC, đừng tạo fixture ngay

`tests/support/setup/db/fieldmap.candidates.spec.ts` hỏi DB: **đơn nào SẴN CÓ mà giá trị cột đó tự phân biệt**
với mọi cột cùng loại. Vòng 3 (28/08) chạy phép này ra kết quả: **6/8 cột treo có bản ghi thật** ⇒ neo được mà
**không chạm dữ liệu UAT**, chỉ còn `custom_price` là thật sự cần fixture. Trước đó cả 8 cột đều bị ghi "cần
fixture" chỉ vì 6 đơn mở tay không đủ đa dạng — *"6 đơn tôi mở"* không phải *"mọi đơn"*.

Hai bẫy khi viết truy vấn tìm ứng viên:

- Dùng `IS DISTINCT FROM`, **không** `<>` / `NOT IN (...)`. Với NULL thì `<>` trả NULL nên hàng bị loại oan,
  và `NOT IN` có NULL thì kết quả **rỗng** — rồi kết luận "DB không có đơn nào" trong khi có.
- Tìm theo **GIÁ TRỊ**, không theo **NHÃN**. Hỏi "có nhãn nào chứa chữ deposit không?" là bỏ sót: app hoàn
  toàn có thể hiện con số đó dưới nhãn khác. Đúng cách: lấy mọi cặp (nhãn → giá trị) trên màn, chuẩn hoá số,
  rồi hỏi "giá trị này khớp cột DB nào" — và chỉ neo khi khớp **đúng một** cột.

**Form giữ giá trị ở `input.value`, KHÔNG ở `textContent`.** OPS còn dùng **ant-select**, vốn là `div` chứ
không phải `<select>`, nên `input.value` của nó **rỗng**. Radio và checkbox thì `value` là hằng số của từng ô,
nên đọc `value` là ra giá trị của ô **chưa chọn**. Bản đọc form đầu tiên báo `select=0` ở **mọi** form OPS — đó
là **instrument mù**, không phải "form không có field". Phải đọc `.ant-select-selection-item` và trạng thái
`checked`; đọc xong mới được kết luận "cột này không hiển thị".

**Cột enum không hiện dạng chuỗi** (vd `payment_method`) thì đối chiếu theo giá trị là vô dụng. Phải **so hai
nhóm** đơn cùng màn, khác nhau đúng ở cột đó. Chỉ nhận nhãn nào thoả cả ba: *(a)* có ở mọi đơn của cả hai nhóm,
*(b)* không đổi trong từng nhóm, *(c)* khác nhau giữa hai nhóm.

**Mỗi nhóm phải có ≥3 đơn của KHÁCH KHÁC NHAU.** Lượt đo đầu chỉ dùng 2+2 đơn, ra **4 nhãn "phân biệt được"**,
kể cả `Status = "Split bill"` so với `"None"` nghe rất thuyết phục. Tất cả **biến mất** khi thay cặp
gần-bản-sao, tức cùng khách cùng số tiền, bằng đơn của khách khác.

**Cột không phải field nhập thì phải TRUY NGUỒN, đừng đọc thêm màn.** `payment_method` không có ở 6 loại màn:
Overview, List, List Transaction, Hubspot, form sửa, và form tạo cả 3 loại đơn.

Hai giả thuyết bị bác bằng số đo. DB **không có** cột hay bảng nào tên split hoặc installment. Và giá trị
**không tương quan** với số đợt thanh toán: 68 đơn INSTALLMENT có 0 giao dịch, trong khi đơn ONETIME có tới 5.

Manh mối thật nằm ở **schema**. Bảng có cột song sinh `forced_payment_method` và `payment_page_url`, nghĩa là
giá trị do người học chọn ở **trang thanh toán**, OPS chỉ có thể *ép*. Đọc thêm màn OPS nữa là vô ích. Đọc
`information_schema` rẻ hơn và trả lời đúng câu hỏi.

Kết quả có giá trị nhất của vòng 3 lại là một câu **phủ định**. `deposit` có đơn phân biệt, 1.000.000 và
1.500.000, mà **con số đó không xuất hiện ở bất kỳ nhãn nào** trên tab Overview. Lý do treo vì thế đổi từ
*"trùng giá trị"* sang *"màn này không hiển thị"*. Hai việc phải làm hoàn toàn khác nhau.

## Hai giới hạn ĐÃ ĐO trên DỰ ÁN THAM CHIẾU (đừng hứa thứ máy không làm được)

> Hai mục dưới là số đo của MỘT dự án cụ thể, chép lại để kể **hình dạng của giới hạn**, không phải
> sự thật về DB của bạn. Phải tự đo lại trên `information_schema` của dự án mình rồi mới khai
> `conventions`. Dùng lại con số ở đây là lấy oracle của dự án khác.

- **Không có audit hành động người dùng.** Bảng đơn và bảng giao dịch KHÔNG có cột nào ghi người sửa;
  bảng log webhook chỉ là log. ⇒ Ca #5 chỉ kiểm `updated_at`,
  `expectAudit()` sẽ **từ chối** thay vì trả kết quả rỗng.
- **39/39 cột thời gian là `timestamp WITHOUT time zone`**, nên dữ liệu không mang offset.
  `conventions.timestamps.storedZone = "UTC"`, xác định 27/08/2026 bằng phép đo READ-ONLY. Bản ghi mới nhất
  của 4 bảng độc lập đều nằm khoảng 30 phút TRƯỚC giờ UTC thực tế; nếu app ghi +07 thì chúng phải ở tương lai
  khoảng 6,5 giờ. Chưa khai `storedZone` thì `instant()` trả **`inconclusive`**, và đó là câu trả lời đúng chứ
  không phải lỗi.

  DB lưu tới **mili giây** còn spec thường ghi tới giây, nên dùng `instant(v, { toleranceMs: 1000 })` cho đúng
  mức spec quy định. Thiếu dung sai thì lệch 825ms cũng thành FAIL.

## Liên quan

§5 API (idempotency phía gửi), §8 Resilience, §9 Side-effect (webhook đi ra), §14 BE Response Conformance
(so **response**, còn §23 so **bản ghi**), §22 Inbound Callback (callback ghi tiền thì nên có cả §23).
