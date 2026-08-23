# Prompt Phase 1 - Sinh testcase

> Chạy: `Đọc file này và chạy với TASK_KEY=<TASK_KEY>`. Rule: non-negotiables ở `CLAUDE.md` (đã auto-load). Digest: `.agent/rules/core_rules.md`. Chỉ mở `RULE_GLOBAL.md` **ở đúng mục cần** (mỗi gạch đầu dòng của digest có ghi `§`) — đừng nạp cả file.

# Vai trò
Bạn là Senior QA Engineer với 10 năm kinh nghiệm, chuyên về Risk-Based Testing và Test Automation.

# Nhiệm vụ
Phân tích requirement và sinh bộ test cases đầy đủ, chi tiết theo template chuẩn.
Test cases phải đủ chi tiết để automation script thực thi chính xác mà không cần đoán thêm bất kỳ thông tin nào.
Mục tiêu là coverage cao nhất có thể trong scope đã cung cấp, bao gồm happy path, negative, boundary, edge, permission, error state, data sync và regression-sensitive flows.

# Bước 0 — BẮT BUỘC trước khi gen: đọc kỹ + chốt hỏi-đáp làm rõ

> **Gate cứng. TUYỆT ĐỐI KHÔNG viết testcase nào trước khi hoàn tất bước này.** Canonical: `RULE_GLOBAL.md` §"Analysis & Ambiguity Gate"; workflow: `.agent/workflows/phase1_01_prepare_context.md`.

1. **Đọc tài liệu THẬT KỸ, KHÔNG qua loa** — toàn bộ phần **trong scope** của requirement/BRD/Figma/Swagger/Jira: mọi mục, **bảng, ghi chú, footnote, comment, phụ lục** liên quan (phần ngoài scope thì lướt — không mâu thuẫn với mục "Tiết kiệm token" bên dưới). Bóc hết acceptance criteria, business rule, validation, enum/giá trị, state & transition, edge, xử lý lỗi, phân quyền, biên. **Đối chiếu chéo** các nguồn; mâu thuẫn thì nêu ra, không tự chọn bừa. Phân biệt "tài liệu ghi thật" vs "tôi suy luận".
2. **Gom MỌI điểm mờ/phân vân thành MỘT danh sách câu hỏi** `Q1, Q2…` ghi `<TASK_OUTPUT_DIR>/reports/phase1-clarifications.md` — mỗi câu bám **spec cụ thể** (giá trị/URL/element/điều kiện/enum/oracle), kèm **assumption mặc định đề xuất** + **scope bị chặn** nếu chưa trả lời. Phân loại **Blocking** (Critical/High) vs **Non-blocking** (Medium/Low, có default). Ghi cả hai loại để QA thấy hết điểm mờ.
3. Còn câu **Blocking** → ghi `AMBIGUITY_GATE: PENDING` vào `task.md`, **DỪNG** chờ QA/BA trả lời (hoặc tick chấp nhận assumption). **KHÔNG tự đoán qua Blocking rồi gen.**
4. Mọi Blocking đã RESOLVED → **phân tích lại + chỉnh** coverage map/scope theo câu trả lời → đặt `AMBIGUITY_GATE: RESOLVED` → mới bắt đầu gen. Câu Blocking không được trả lời → phần scope đó ghi "chờ làm rõ" ở Coverage Gaps, **KHÔNG gen** case cho nó.
5. Medium/Low không chặn: tự áp assumption (ghi rõ) + Coverage Gaps, vẫn gen.

# Ngữ cảnh
- Dự án: [TÊN DỰ ÁN] (App 1 / App)
- Module: [TÊN MODULE]
- Requirement: [PATH/LINK REQUIREMENT hoặc nội dung ngắn liên quan trực tiếp; ưu tiên path/link thay vì dán tài liệu dài]
- URL hệ thống: [URL STAGING]
- Loại test: [UI E2E / API / E2E]

# Template bắt buộc (10 cột)

| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |

## Cột `Loại case` — 9 loại, KHÁC hẳn `Nhóm chức năng`

Hai trục khác nhau, đừng lẫn:
- **Nhóm chức năng** (sheet/cột riêng) = *"test Ở ĐÂU"* — màn/luồng nghiệp vụ → thành **folder** trên AIO.
- **Loại case** = *"KIỂM THỬ KIỂU GÌ"* → thành **Case Type** trên AIO, dùng để **lọc và báo cáo**.

**Thứ tự xét:** Xét CHUYÊN BIỆT trước, `Functional` là mặc định CUỐI CÙNG khi không khớp loại nào. Thứ tự xét: Security → Accessibility → Performance → Database → API → UI → E2E → Integration → Functional. Một case chỉ mang ĐÚNG MỘT loại; nếu thấy hợp 2 loại thì case đang gộp 2 mục đích — tách case, đừng chọn bừa.

| # | Loại | Định nghĩa | Tag thường đi kèm | Chọn khi | KHÔNG chọn khi |
|---|---|---|---|---|---|
| 1 | **`Security`** | Kiểm kiểm soát truy cập và bảo vệ dữ liệu: ai được làm gì, dữ liệu nào bị lộ. | `[Security]` `[Guard]` | IDOR · leo thang quyền · ma trận role×action (đặc biệt ô DENY) · mass-assignment · lộ field nội bộ · header/cookie bảo mật. | Bị chặn theo rule NGHIỆP VỤ chứ không theo quyền → `Functional`. |
| 2 | **`Accessibility`** | Kiểm khả năng tiếp cận: dùng được bằng bàn phím và trình đọc màn hình. | `[A11y]` | label/aria · tương phản màu · thứ tự focus · điều hướng bàn phím · axe-core. | Chỉ sai bố cục/thẩm mỹ → `UI`. |
| 3 | **`Performance`** | Kiểm thời gian phản hồi và khả năng chịu tải, SO VỚI NGƯỠNG ĐÃ KHAI. | `[Perf]` | Có ngưỡng SLA/NFR cụ thể · danh sách nhiều bản ghi · LCP/TTFB · tải đồng thời. | Không có ngưỡng để so → KHÔNG sinh case, ghi N/A. Case perf không neo ngưỡng là case không phán được. |
| 4 | **`Database`** | Kiểm dữ liệu THỰC SỰ được lưu đúng ở tầng lưu trữ (read-only verify). | `[SideEffect]` | Persist đúng giá trị (không làm tròn/cắt/lệch timezone) · side-effect sang bảng khác · dữ liệu rác sau cleanup. | Chỉ kiểm qua API mà không truy DB → `API`. |
| 5 | **`API`** | Kiểm hợp đồng và dữ liệu ở tầng API, độc lập UI. | `[API]` `[BEData]` | Status code · schema/contract · field trong response (`null` vs `""` vs thiếu key) · mã lỗi · phân trang · payload. | Gọi API chỉ để DỰNG dữ liệu rồi kiểm trên màn → `UI`/`Functional`. |
| 6 | **`UI`** | Kiểm thứ người dùng NHÌN THẤY: bố cục, hiển thị, hình học, trạng thái màn, responsive. | `[UI]` `[Display]` `[Design]` | Đối chiếu Figma/UI contract · format hiển thị · empty/loading/error state · text dài tràn · breakpoint · element đè nhau · visual regression. | Dữ liệu hiển thị sai do BE TÍNH sai → `Functional`; do API TRẢ sai → `API`. |
| 7 | **`E2E`** | Luồng xuyên nhiều màn hoặc nhiều hệ thống, mô phỏng hành trình người dùng thật. | `[E2E]` | Chuỗi ≥3 màn HOẶC đi qua ≥2 app/hệ thống · kiểm kết quả CUỐI chuỗi. | Chỉ một màn dù nhiều bước → `Functional`. |
| 8 | **`Integration`** | Kiểm ĐIỂM NỐI giữa module hoặc với hệ thống bên ngoài — nơi hai bên bàn giao dữ liệu. | `[Export]` | Đồng bộ 2 module · webhook/callback · bên thứ ba (cổng thanh toán, SMS, ERP) · import/export liên hệ thống. | Luồng xuyên màn nhưng CÙNG một hệ thống → `E2E`. |
| 9 | **`Functional`** | Kiểm hành vi nghiệp vụ đúng/sai theo rule: logic, validation, luồng trong một chức năng. Là MẶC ĐỊNH khi không khớp loại chuyên biệt nào. | `[Validation]` `[Calc]` `[Resilience]` `[Ordering]` `[Impact]` | Validate field · tính toán · rule nghiệp vụ · luồng thao tác thông thường · regression theo thay đổi · chịu lỗi/gián đoạn · thứ tự thao tác. | Trọng tâm là hiển thị → `UI`; là contract API → `API`; là quyền → `Security`. |

Chỉ nhận đúng 9 giá trị trên (đúng chính tả, đúng hoa/thường không bắt buộc). Sai giá trị = **CHẶN** ở design gate; bỏ trống = **CHẶN** ở bước convert md→xlsx. Nguồn duy nhất của bảng này: `.agent/config/case_types.json` — sửa ở đó, đừng sửa bảng.

**Cách chọn khi phân vân** — đọc dòng "KHÔNG chọn khi" của loại bạn đang định gán TRƯỚC, vì nó nói thẳng ca dễ nhầm. Ba câu hỏi tách được hầu hết ca:
1. *Nếu bug xảy ra, ai sửa và sửa ở đâu?* → FE dựng màn = `UI` · BE trả sai = `API` · rule nghiệp vụ = `Functional` · tầng lưu = `Database`.
2. *Bỏ UI đi thì case còn chạy được không?* → còn = `API`/`Database` · không = `UI`/`Functional`/`E2E`.
3. *Case này đi qua mấy màn, mấy hệ thống?* → ≥3 màn hoặc ≥2 app = `E2E` · đúng điểm bàn giao giữa 2 bên = `Integration` · 1 màn = `Functional`.

Một case mang **đúng một** loại. Thấy hợp 2 loại nghĩa là case đang gộp 2 mục đích — **tách case**, đừng chọn bừa; case gộp cũng làm `Kết quả mong đợi` không khớp số bước và bị gate chặn ở chỗ khác.

> **Vì sao có cột này:** trước đây kit **suy** loại từ tên nhóm chức năng. Đo trên 1.399 case đã publish:
> **96% rơi về `Functional`**, `Integration` và `Performance` = **0** ⇒ lọc theo Case Type trên AIO vô dụng,
> và người đọc báo cáo dễ kết luận nhầm rằng bộ test không có mảng tích hợp. Ép trục "ở đâu" ra trục
> "loại nào" thì sai là tất yếu — nên nay là cột **người khai**, không suy. Publisher cũng đã bỏ
> fallback ngầm: tên không khớp AIO thì **DỪNG**, không đẩy lên với nhãn `Functional`.

---

# Quy tắc sinh testcase

## 0. Tiết kiệm token và context

- Ưu tiên đọc requirement từ file/link/artifact local; không yêu cầu dán toàn bộ Jira/Confluence/Figma/Swagger vào prompt.
- Nếu đã có `task.md`, raw requirement, snapshot hoặc `reports/phase1-summary.md`, dùng chúng làm nguồn chính và chỉ đọc thêm section còn thiếu.
- Khi tài liệu lớn, chỉ mở phần liên quan đến module, user story, acceptance criteria, screen, endpoint hoặc business rule trong scope.
- Coverage map có thể tạo nội bộ hoặc lưu vào `reports/phase1-summary.md`; không cần paste toàn bộ coverage map vào chat.
- Không đọc file example của task khác trừ khi user yêu cầu dùng example đó làm input.

## 0. Phân nhóm testcase bắt buộc

Testcase phải được phân biệt rõ theo **nhóm chính là business flow** để QA review, export Excel và publish AIO Tests dễ lọc (nhóm chức năng → folder AIO).

Vẫn giữ đúng template 10 cột — KHÔNG tự thêm cột thứ 11. Thay vào đó, cột `Module` phải dùng format:

`[Nhóm chức năng] / [User Story hoặc màn hình/API/flow cụ thể]`

`Nhóm chức năng` là nhóm chính theo business flow, không phải layer kỹ thuật thuần túy. Nhóm phải được suy ra từ domain/scope hiện tại, không hardcode theo một task cụ thể.

Nguyên tắc đặt nhóm:
- Dùng tên nhóm nghiệp vụ mà QA/BA/dev trong scope đó có thể review và lọc được.
- Với CRUD/admin tool, có thể dùng các nhóm như `Xem danh sách`, `Xem chi tiết`, `Tạo`, `Sửa`, `Xóa`.
- Với domain khác, thay bằng nhóm phù hợp, ví dụ: `Đăng nhập`, `Đăng ký`, `Thanh toán`, `Giỏ hàng`, `Quản lý hồ sơ`, `Tìm kiếm`, `Thông báo`, `Báo cáo`, `Cấu hình`, `Import/Export`.
- Với API testcase, nếu endpoint phục vụ rõ một business flow thì nhóm chính vẫn là business flow đó, ví dụ `Tạo / API POST /api/v1/examination`, không tách thành nhóm chính `API`.
- Chỉ dùng nhóm chính `API` khi testcase kiểm endpoint/platform behavior không thuộc flow nghiệp vụ cụ thể nào.
- Với E2E/cross-app, nếu flow có business flow rõ thì nhóm chính vẫn là flow đó, ví dụ `Tạo / App 1 tạo bản ghi -> App 2 sync`; chỉ dùng `E2E/Cross-app` khi flow chính là sync/tích hợp đa hệ thống.
- Với permission/security, nếu permission gắn với flow rõ thì nhóm chính vẫn là flow đó, ví dụ `Sửa / Permission role teacher cannot edit`; chỉ dùng `Permission/Security` khi testcase chủ yếu kiểm auth/role/security độc lập.
- KHÔNG thêm cột label vào bảng testcase. AIO case không phải Jira issue nên **không có label**: nhóm chức năng thể hiện qua **folder AIO** (`<root>/<nhóm chức năng>`, dựng từ sheet chức năng), TC ID nằm ở `automationKey`.
- `Khác` chỉ dùng khi requirement không thuộc nhóm nào rõ ràng và phải giải thích trong Coverage Gaps.

### 0b. TAG CHIỀU ở cột `Tag` — BẮT BUỘC, có máy kiểm

Tag ghi ở **cột `Tag`**, KHÔNG ghi vào tiêu đề. Mỗi case: `[<Loại>][<Chiều>][<Oracle-ref>]` — ví dụ `[Positive][Display][BR-GRID-001]`.

> **Đổi từ 21/08/2026.** Trước đây tag nằm TRONG `Trường hợp kiểm thử` vì template khoá 9 cột, thêm cột là phá mọi consumer. Lý do đó hết hiệu lực: `Loại case` đã thành cột thứ 10, và consumer nay đọc theo TÊN cột qua `colIndex()` chứ không theo vị trí. Tag là tín hiệu cho **máy**; bắt người mở case ra chạy phải lướt qua 3 khối ngoặc mới tới nội dung là đặt sai chỗ.
>
> `model.js` lấy **HỢP** của cột `Tag` và tiêu đề, nên bộ TC cũ (tag còn trong tiêu đề) vẫn đo được — không phải đi sửa lại bộ đã publish.

| Chiều (mục) | Tag | Chiều (mục) | Tag |
|---|---|---|---|
| §3 Field validation | `[Validation]` | §12 Display/Field conformance | `[Display]` |
| §4 UI (lưới/filter/sort/empty) | `[UI]` | §13 Business logic / tính toán | `[Calc]` |
| §5 API | `[API]` | §14 BE response conformance | `[BEData]` |
| §6 E2E | `[E2E]` | §15 Security | `[Security]` |
| §7 Export/Import | `[Export]` | §16 Performance/Load | `[Perf]` |
| §8 Resilience/Concurrency | `[Resilience]` | §17 Change impact/Regression | `[Impact]` |
| §9 Side-effect/Notification | `[SideEffect]` | §10 Cross-layer guard | `[Guard]` |
| §11 Design compliance (Figma) | `[Design]` | | |

**Vì sao bắt buộc:** `npm run dim:coverage -- --enforce` đếm case **theo tag** rồi chặn nếu thiếu chiều mà `requirements/dimension_manifest.json` khai là `required`. Không có tag thì gate rơi về chế độ GỢI Ý (suy từ văn bản) và **tự từ chối chặn** — vì đo trên bộ 530 case thật, suy diễn vừa thiếu recall (§5 đếm 0 dù có 17 case nhắc "api") vừa kém precision (§12 nhận cả case điều hướng, do "hiển thị" là động từ chuẩn của MỌI expected tiếng Việt). Tag là đường duy nhất để chiều coverage được **máy** gác, thay vì phụ thuộc việc bạn có đọc §3–§17 hay không.

Case phủ nhiều chiều thì ghi nhiều tag (`[Negative][Validation][Security]`). Chiều không áp dụng cho task thì khai `"n/a"` **kèm lý do** trong `dimension_manifest.json` — bỏ chiều mà không nói vì sao sẽ bị cảnh báo.

### 0b-ter. TIÊU ĐỀ = NỘI DUNG, và phải TỰ ĐỦ NGHĨA

Tag đã ra cột riêng, nên tiêu đề không còn chỗ dựa: đọc một mình nó phải hiểu được case kiểm gì và **đúng là thế nào**. Ba đoạn nối bằng ` - `:

```
<Đối tượng/màn> - <Hành động hoặc điều kiện> - <Kết quả cụ thể đo được>
```

```
✓ Tạo Business Partner trên SAP B1 - Sinh mã KH đúng cú pháp C + CCCD khi khách Cá nhân chưa có BP
✓ Ghi nhận giao dịch tiền về - Tiền mặt NEU sinh Incoming Payment với G/L 111101
✓ Cập nhật Business Partner - Định danh CCCD đổi thì tạo BP MỚI, không update BP cũ
```

**Bốn lỗi bị chặn — mỗi lỗi đều từng xảy ra thật:**

| Lỗi | Ví dụ SAI | Vì sao chặn |
|---|---|---|
| Đoạn kết quả nói chung chung | `… - Hệ thống hoạt động đúng` | Đọc tiêu đề không biết oracle là gì ⇒ người chạy phải mò cả cột `Kết quả mong đợi` mới biết mình đang kiểm gì |
| **Tiền tố hằng số** | `Cross-app - …` gắn cho **101/101** case | Một trường mà mọi dòng cùng giá trị thì KHÔNG phân biệt được gì. Nó chỉ chiếm chỗ và đẩy nội dung thật ra xa. Thông tin đó thuộc `Loại case` (`E2E`/`Integration`) và tên folder, không thuộc tiêu đề |
| Dựa vào tag để đủ nghĩa | `Chặn khi khoá sổ` (nghĩa nằm ở `[Negative]`) | Tag giờ ở cột khác; tiêu đề mất tag là mất nghĩa |
| Lặp lại tên nhóm/folder | `Business Partner - Business Partner - …` | Nhóm đã là folder trên AIO, nhắc lại là dư |

**Vẫn được để `[...]` GIỮA câu** khi đó là tên trường thật trên giao diện/tài liệu — `Kiểm [FBP] Ngày ghi nhận doanh thu - …`. Chỉ khối ngoặc **liền nhau ở đầu chuỗi** mới bị coi là tag.

`publish_testcases_aio.js` còn một lớp chắn cuối: `displayTitle()` cắt khối tag ở đầu tiêu đề trước khi đẩy lên AIO, để bộ TC cũ vẫn ra tiêu đề sạch mà không phải sửa lại nguồn.

### 0b-bis. Gắn tag rồi thì `Kết quả mong đợi` phải MANG BẰNG CHỨNG của chiều đó

Tag chứng minh case **có mặt** ở chiều đó; nó **không** chứng minh case assert đủ sâu. `output_gate --mode gen-testcase` nay kiểm tiếp:

| Tag | Expected phải có ít nhất | Thiếu thì sao |
|---|---|---|
`[Calc]` | **giá trị SỐ tự tính** (kết quả công thức) | *"tính đúng Net Price"* không phải oracle |
`[Display]` | **chuỗi trích nguyên văn** trong ngoặc kép, **mẫu định dạng** (`dd/mm/yyyy`, `hh:mm`), hoặc **danh sách cột** | case PASS cả khi hiển thị sai |
`[Guard]` | **mã trạng thái** (403/409…) **hoặc** "bị chặn" **kèm** "dữ liệu không đổi" | *"bị chặn"* không chứng minh dữ liệu còn nguyên |
`[BEData]` | **tên property/field** cụ thể, hoặc phân biệt `null`/rỗng/thiếu key/`0` | *"map đúng"* không kiểm được |
`[Resilience]` | nêu **lần gọi thứ hai/trùng/đồng thời** **kèm kết quả bằng số** | không phân biệt được idempotent thật |
`[Perf]` | **ngưỡng có đơn vị** (`ms`/`s`/`p95`) | không phán được đạt/không đạt |
`[Validation]` | **thông báo lỗi trích nguyên văn** hoặc **giá trị biên** | — |

Chiều khác (`[UI]` `[API]` `[E2E]` `[Export]` `[SideEffect]` `[Design]` `[Impact]`) **cố ý không khai luật** — chưa phát biểu được "bằng chứng tối thiểu" một cách chính xác thì thà không gác, còn hơn gác bằng luật mơ hồ rồi báo oan.

**Vì sao có mục này:** `OPS_PAY_TC_175` liệt kê form Add Transaction **có** field Recipient Bank Account nhưng không phát biểu ràng buộc nào ⇒ case **XANH** trong khi bug `SAPP-28420` (modal cho chọn pháp nhân khác order ⇒ HubSpot ghi sai pháp nhân) vẫn sống. Tag `[Display]` một mình không cứu được ca đó; **bằng chứng tối thiểu** thì cứu được.

> Hiện là **CẢNH BÁO**, chưa chặn. Sẽ bật `--strict` sau khi đo trên bộ gen mới đầu tiên (<10% case thiếu). Đo trên bộ 530 hiện tại: **0 cảnh báo** — vì bộ đó chưa có tag chiều nào, nên luật này không báo oan lấy một ca.

### 0c. TAG NGUỒN ORACLE — case có oracle nghiệp vụ phải trỏ về rule

Case mang tag `[Calc]` `[BEData]` `[Display]` `[Security]` `[Guard]` là case có **oracle NGOÀI app** (giá trị đúng không suy được từ chính app). Những case đó phải **trỏ id knowledge** ngay trong tiêu đề:

```
[Positive][Calc][BR-RECIPBANK-001] TK nhận theo chương trình + mốc 01/01/2026
[Negative][Guard][SM-ORDER-001]    Đã thanh toán → Chờ thanh toán phải bị CHẶN
```

Nhận `BR-` (`knowledge/domain/`) và `SM-`/`PM-`/`SS-`/`DM-` (`knowledge/system/`). **Không thêm cột** — tag nằm trong chính cột `Trường hợp kiểm thử`.

**Máy kiểm:** `npm run domain:trace-back` — (a) case mang tag cần-oracle mà **không trỏ id** nào → cảnh báo *"expected lấy từ đâu?"*; (b) trỏ id **không tồn tại** trong knowledge → *"oracle ma"*; (c) `-- --apply` **tự append `covered_by`** cho rule, hết phụ thuộc người nhớ điền.

**Vì sao bắt buộc:** đo 14/08/2026 trên bộ 530 case thật — **0/530** case nhắc bất kỳ id rule nào, dù §12 đã yêu cầu "ghi id rule vào Kết quả mong đợi/Assumptions" từ trước. Trong đó **47 case có expected mang giá trị số/tiền/%** (chắc chắn có oracle nghiệp vụ) và **0 case** trỏ rule. Chiều `rule → TC` đã có máy kiểm (`--trace`); chiều `TC → rule` thì trước đây **không gì kiểm**, nên một case có expected do agent tự suy sẽ đi qua im lặng — đúng lớp lỗi "quên/đọc lướt" mà cả kit đang chống ở chỗ khác.

> Chưa gắn tag thì `domain:trace-back` **nói rõ là chưa gác được** chứ không báo "OK" — im lặng ở đó chính là lỗi nó sinh ra để chống.

Ví dụ đúng cho cột `Module`:
- `Xem danh sách / US-01 Exam List`
- `Xem chi tiết / US-02 Exam Detail`
- `Tạo / US-03 Create Exam`
- `Sửa / US-04 Edit Exam`
- `Xóa / US-05 Delete Exam`
- `Tạo / API POST /api/v1/examination`
- `Tạo / App 1 tạo bản ghi -> App 2 sync`
- `Permission/Security / Unauthorized access token`
- `Đăng nhập / Login form`
- `Thanh toán / Checkout with saved card`
- `Báo cáo / Export revenue report`

Sau bảng testcase, bắt buộc thêm section `## Phân nhóm testcase` gồm bảng:

| Nhóm chức năng | Phạm vi | TC ID | Tổng |
|---|---|---|---|

Mỗi TC phải thuộc đúng 1 nhóm chính. Không để nhóm mơ hồ như `General`, `Misc`, `Other` nếu có thể map vào nhóm nghiệp vụ rõ ràng.

## 1. TC ID
- Format: `[PROJECT]_[MODULE]_TC_[NNN]`
- Ví dụ: `APP_LOGIN_TC_001`, `APP_ORDER_TC_023`
- Số thứ tự 3 chữ số, liên tục

## 2. Trường hợp kiểm thử
Mô tả rõ ràng, đủ nghiệp vụ, đọc tên case là hiểu được mục tiêu test và điều kiện chính. Không đặt tên chung chung.

Format bắt buộc:
`[Positive|Negative|Boundary|Edge] [Site/Layer] - [Màn hình/API/Flow] - [Hành vi cụ thể] - [Điều kiện dữ liệu/rule]`

Trong đó:
- `Site/Layer`: App 1 / App 2 / Cross-app / API / E2E.
- `Màn hình/API/Flow`: tên màn hình, endpoint hoặc luồng nghiệp vụ.
- `Hành vi cụ thể`: hành động hoặc rule cần verify.
- `Điều kiện dữ liệu/rule`: program, role, state, business rule hoặc edge condition.

Tên case phải bao gồm:
- Loại: [Positive] / [Negative] / [Boundary] / [Edge]
- Site/layer liên quan nếu có nhiều site.
- Màn/endpoint/flow cụ thể.
- Điều kiện dữ liệu chính.

✅ ĐÚNG:
- `[Positive] App 2 - Create bản ghi nghiệp vụ - Lưu thành công khi mã định danh unique và có 1 lịch thi hợp lệ`
- `[Negative] API - POST /api/v1/resources - Chặn tạo bản ghi nghiệp vụ khi thiếu required_field`
- `[Boundary] App 1 - Update Profile - Disable Save khi giá trị ngày mới trùng kỳ hiện tại`

❌ SAI:
- `Kiểm tra tạo exam`
- `Update thành công`
- `Validate form`

## 3. Tiền điều kiện
Liệt kê đầy đủ, cụ thể:
- Trạng thái hệ thống: `Hệ thống đang chạy tại [URL]`
- Trạng thái dữ liệu: `Tài khoản auto_test@test.com đã tồn tại, trạng thái Active`
- Trạng thái người dùng: `Người dùng chưa đăng nhập, đang ở trang /login`
- Không để trống hoặc ghi chung chung "Hệ thống hoạt động bình thường"
- Mỗi cell `Tiền điều kiện` phải mở đầu bằng **tag cách dựng** `[<method>]`, method ∈ `api` | `factory` | `test_hook` | `ui` | `pre_existing` | `manual`; nhiều precondition thì tách bằng `<br>`, mỗi mảnh một tag.
  Định dạng: `[<method>] <mô tả trạng thái cụ thể>` — vd `[api] Order đã ở trạng thái TO_PURCHASE`, `[pre_existing] Lớp CFA1-01 có ≥2 activity`, `[manual] Thẻ NCB sandbox đã bật OTP`.
  **Vì sao tag nằm TRONG cell chứ không ở bảng riêng**: precondition giờ chỉ là một TRƯỜNG của testcase (không còn thực thể/issue riêng), và AIO — nơi Phase 2 kéo testcase về — KHÔNG có field nào chứa "cách dựng". Thứ gì phải sống sót round-trip publish→pull thì phải nằm trong chính text precondition.
  Cùng một trạng thái thì phải cùng một method và **mô tả giống hệt** (đây là thứ thay cho dedup của mã cũ; `design:gate` cảnh báo khi một trạng thái có 2 cách dựng).
  KHÔNG có method `db`: dựng state bằng DB bị cấm (RULE_GLOBAL §UAT non-destructive + DB read-only).

## 4. Dữ liệu Test (QUAN TRỌNG NHẤT)
**TUYỆT ĐỐI KHÔNG dùng placeholder** như "email hợp lệ", "mật khẩu đúng", "dữ liệu hợp lệ"

✅ ĐÚNG:
```
email: auto_login_001@test.com
password: Test@12345
```

❌ SAI:
```
email: email hợp lệ
password: mật khẩu đúng
```

Quy tắc cho từng loại dữ liệu:
- **Email dynamic**: `auto_[module]_[NNN]@test.com` → VD: `auto_login_001@test.com`
- **Password valid**: luôn dùng `Test@12345` (đủ uppercase, lowercase, number, special char)
- **Text field**: giá trị cụ thể bằng tiếng Việt hoặc tiếng Anh
- **Empty field**: `""` (để rõ là empty string)
- **Số âm**: `-1`
- **Quá dài**: `"Aaaa..." (201 ký tự)` — ghi rõ số ký tự
- **Special chars**: `"<script>alert(1)</script>"`
- **Whitespace**: `"   "` (3 khoảng trắng)

## 5. Các bước thực hiện
- Đánh số thứ tự: 1, 2, 3...
- Mỗi bước = 1 action cụ thể (không gộp nhiều action)
- Phải bao gồm bước navigate đến URL
- Phải nêu rõ element nào, giá trị nào
- Với UI testcase, phải nêu rõ menu/tab/button/field theo label hiển thị hoặc path cụ thể.
- Với API testcase, steps phải nêu rõ method, endpoint, query/path/body/header cần gửi.
- Với E2E testcase, steps phải nêu rõ chuyển đổi giữa các app/site liên quan, user nào thao tác ở mỗi bước và cần verify sync ở đâu.
- Không dùng steps chung chung như "nhập thông tin hợp lệ", "thực hiện tạo mới", "kiểm tra kết quả".
- Nếu có popup/modal/toast/loading, phải thêm bước quan sát trạng thái đó.
- Nếu case phục vụ Phase 2 automation, steps phải đủ để viết script Playwright/API test trực tiếp.
- Trong cell Markdown, các bước ngăn cách bằng `<br>` (mỗi bước một dòng), không viết liền nhiều bước trên một dòng.

✅ ĐÚNG:
```
1. Mở trình duyệt, navigate đến [URL]/login
2. Tại field "Email", nhập: auto_login_001@test.com
3. Tại field "Mật khẩu", nhập: Test@12345
4. Click button "Đăng nhập"
5. Quan sát kết quả
```

❌ SAI:
```
1. Mở trang login
2. Nhập thông tin đăng nhập
3. Click đăng nhập
```

## 6. Kết quả mong đợi
- **Mỗi bước một dòng kết quả riêng**, đánh số KHỚP với cột `Các bước thực hiện` (bước 1 → kết quả 1, bước 2 → kết quả 2...). KHÔNG gộp nhiều bước vào một mục (cấm kiểu `1-2.`, `1-3.`). Bước chọn/nhập/navigate cũng phải có kết quả tương ứng (ghi phản hồi tức thời có thật: field nhận giá trị, tùy chọn được chọn, trang điều hướng đúng...), KHÔNG bịa assertion ngoài tài liệu.
- **Mỗi ý một dòng**: nếu một bước có nhiều điểm cần kiểm chứng thì tách mỗi ý thành một dòng con `- <ý>`. TUYỆT ĐỐI không nhồi nhiều ý vào một dòng bằng dấu `;`.
- **Xuống dòng bằng `<br>`**: mọi dòng (kết quả từng bước và các ý con) ngăn cách bằng `<br>` để Excel hiển thị nhiều dòng, không viết liền một dòng dài.
- **HỢP ĐỒNG bước ↔ kết quả (đây là chỗ từng làm mất 44% nội dung khi publish):** khối kết quả của bước N = **dòng đánh số N + MỌI dòng con `- …` đứng sau nó** cho tới dòng đánh số kế tiếp. Khối đó là **một đơn vị**: khi publish lên TMS nó đi trọn vào `expectedResult` của đúng bước N.
  - Vì thế ràng buộc đúng là **số dòng ĐÁNH SỐ của cột kết quả = số bước**; số dòng con thì tuỳ ý. KHÔNG phải "số dòng bằng số bước".
  - Consumer **KHÔNG được** ghép `steps[i] ↔ expected[i]` theo chỉ số phẳng: mảng sau `splitNumbered` có dòng con mang `n = null`, ghép kiểu đó vừa lệch bước vừa cắt mất phần dôi. Dùng `groupNumbered()` của `scripts/lib/testcase`.
  - Đo thật trên bộ SAPP-26878 (101 case) trước khi vá: **300/682 dòng kết quả (44,0%) bị vứt ở 83/101 case**, và bước sau nhận nhầm kết quả của bước trước — ví dụ bước "mở hóa đơn bộ B" lại mang con số của bộ A.
- Mô tả CHÍNH XÁC: text nào hiển thị, URL chuyển đến đâu, element nào thay đổi
- Bao gồm cả response HTTP nếu là API test
- Với UI, nêu rõ field state: enabled/disabled/readonly/visible/hidden, selected value, validation message, toast, row count, pagination, modal state.
- Với API, nêu rõ status code, schema field quan trọng, business value trong response, error code/message nếu có.
- Với E2E, nêu rõ side-effect ở hệ thống khác: app/site liên quan, integration, notification hoặc data count nếu nằm trong scope.
- Expected không được chỉ ghi "thành công", "báo lỗi", "hiển thị đúng".

✅ ĐÚNG (mỗi bước MỘT KHỐI: dòng đánh số + các ý con của nó, ngăn bằng `<br>`) — ví dụ dưới có **2 bước** nên cột kết quả có đúng **2 dòng đánh số**, 3 dòng con thuộc về bước 2:
```
1. Trường "Allow split via VNPay?" là Checkbox (không phải dropdown), Optional<br>2. Sau khi tick, hiển thị:<br>- Section "Set up payment via VNPay"<br>- Nút "Add installment" enabled<br>- Ràng buộc: tổng các đợt phải bằng số tiền order
```
❌ SAI (gộp bước + nhồi nhiều ý bằng `;` trên một dòng):
```
1-2. Trường là Checkbox, Optional; hiển thị section VNPay; nút Add enabled; tổng đợt = order
```
- **Với case hiển thị (tên cột/label/format dữ liệu/thứ tự/empty-state/placeholder)**: expected phải **trích nguyên văn từ FS/Figma/tài liệu**, KHÔNG lấy từ build đang chạy (tránh oracle tautological — xem mục 12). Ghi rõ chuỗi/format chuẩn, vd cột `Check-in`, format giờ `hh:mm`, ngày `DD/MM/YYYY hh:mm hh:mm`.

✅ ĐÚNG:
```
1. Trang /login hiển thị với form đăng nhập, 2 field Email và Mật khẩu
2. Field Email hiển thị giá trị "auto_login_001@test.com"
3. Field Mật khẩu hiển thị ký tự ẩn (●●●●●●●●)
4. Button "Đăng nhập" nhận focus, loading spinner xuất hiện trong 1-3s
5. Redirect đến /dashboard, hiển thị toast "Đăng nhập thành công", header hiển thị tên người dùng
```

❌ SAI:
```
5. Đăng nhập thành công, chuyển trang
```

## 7. Ưu tiên
Chỉ dùng 5 giá trị: `Critical`, `High`, `Medium`, `Low`, `Lowest` (khớp thang priority của AIO Tests). KHÔNG dùng `P0`/`P1`/`Blocker`. Bộ TC cũ ghi `Highest` (tên thang Jira) vẫn được nhận nhưng nên đổi sang `Critical`; khi log bug, kit tự map `Critical → Highest` cho Jira.

| Level | Khi nào |
|---|---|
| **Critical** | Chức năng cốt lõi, hệ thống không dùng được nếu fail, mất dữ liệu hoặc ảnh hưởng bảo mật/tiền |
| **High** | Tính năng chính, ảnh hưởng nghiệp vụ lớn hoặc block nhóm người dùng quan trọng |
| **Medium** | Tính năng phụ, ảnh hưởng một nhóm người dùng nhưng có workaround |
| **Low** | Edge case, ảnh hưởng ít, không block luồng chính |
| **Lowest** | Lỗi nhỏ/cosmetic, typo, hiển thị phụ hoặc tác động rất thấp |

### 7b. Ưu tiên chấm theo HẬU QUẢ nếu case fail, không theo cảm giác

Không còn cột `Severity` trong bộ testcase (bỏ 21/08/2026) — nên **không** còn bước "chấm Severity trước rồi dịch ra Priority". Chấm `Ưu tiên` trực tiếp bằng bảng 5 mức ở §7, tự hỏi: *case này fail thì hậu quả tới đâu, và có đường vòng không?*

> **Vì sao bỏ:** Severity là thuộc tính của **BUG**, không phải của testcase — chấm lúc viết case là đoán trước hậu quả của một lỗi **chưa xảy ra**, nên thực tế luôn bị điền máy móc. Bug thật vẫn có Severity: chấm lúc log bug, cây quyết định nằm ở [`phase2/08_log_bug_jira.md`](../phase2/08_log_bug_jira.md).
>
> Việc duy nhất cột đó còn gánh trong kit là **risk band** (mở rộng 5 trục hay 1 trục). `bandOf()` lấy `max(risk, priority)`; sau khi vá `PRIO_RANK` thiếu khoá `critical`, đo trên **1977 case toàn repo: bỏ cột làm đổi band 0 case** ⇒ `Ưu tiên` một mình đủ quyết định độ sâu. Đừng điền lại cột này "cho chắc": thêm cột lạ sẽ bị gate chặn.

## 9. Cách dựng tiền điều kiện — BẮT BUỘC (tag `[<method>]` trong chính cell)

Cột `Tiền điều kiện` mang **cả hai** thứ Phase 2 cần: *trạng thái cần có* (mô tả) và *cách đạt được* (tag `[<method>]`).
Không còn bảng `## Setup Strategy` riêng và không còn sheet `Preconditions`: precondition là một trường của testcase, giữ ở hai nơi là mở đường cho lệch.

Dùng skill `precondition_setup_planner` để chọn method và phát hiện blocker.

**Ưu tiên method** (đắt dần): `pre_existing` → `api`/`factory` → `test_hook` → `ui` → `manual`.
KHÔNG bắt UI dựng tiền điều kiện nếu testcase không nhằm test chính flow tạo ra trạng thái đó.

**Chi tiết dựng (endpoint/payload/fixture id, cách xác minh, cách dọn) KHÔNG viết vào file testcase** — nó thuộc kho tái dùng `knowledge/setup_recipes/` (mỗi record có `method`, `steps`, `verification`, `pitfalls`, `applies_when`; kiểm bằng `npm run howto:check`). Lý do: cùng một trạng thái thường dùng lại ở nhiều task, còn file testcase thì thuộc một task; nhét recipe vào file testcase là copy nó mãi mãi.
Nếu precondition chưa có recipe và cũng chưa dựng được: đặt tag `[manual]` và nêu blocker ở `### Setup Readiness` của `phase1-summary.md`.

**Readiness suy từ tag, không khai tay**: `pre_existing`/`api`/`factory`/`ui` → *Ready*; `test_hook` → *Needs hook* (cần Dev/BE mở hook, ghi vào handoff); `manual` → *Manual-only* (case đó KHÔNG tự động hoá được, nêu rõ lý do).

## 0. Coverage Map bắt buộc
Tạo coverage map nội bộ trước khi viết testcase. Map phải bao gồm:
- User Story / Business Rule / Acceptance Criteria.
- UI screen/state/action.
- Form field và validation rule.
- API endpoint/method/query/path/body/schema.
- Permission/role.
- Error state và rollback.
- Cross-system sync side-effect.
- Vùng ảnh hưởng ngoài scope: bề mặt dùng chung mà story đụng tới (data/entity/field, endpoint, component/rule, status/enum, calc/report, permission, job/event) và feature khác phụ thuộc (xem mục 17).

Mỗi rule/AC trong scope phải có ít nhất 1 testcase trace được qua tên case hoặc nội dung expected.
Nếu không thể cover rule nào vì thiếu requirement/data/API, vẫn ghi vào phần Coverage Gap sau bảng.

## 1. Xác định Risk Level cho từng chức năng
- **High Risk** → sinh 10-15 TCs, bao phủ toàn bộ edge cases
- **Medium Risk** → sinh 5-10 TCs
- **Low Risk** → sinh 2-5 TCs (happy path + 1-2 negative)

Không giảm số lượng testcase bằng cách gộp nhiều rule khác nhau vào một case nếu việc gộp làm steps/expected mơ hồ.

## 2. Áp dụng kỹ thuật thiết kế TC
- **Equivalence Partitioning (EP)**: chia input thành nhóm valid/invalid
- **Boundary Value Analysis (BVA)**: test giá trị biên (min, min-1, max, max+1)
- **Decision Table**: cho logic nhiều điều kiện kết hợp
- **State Transition**: cho workflow có trạng thái. Với entity có vòng đời trạng thái, BẮT BUỘC sinh đủ ma trận `status x action` (vd View/Edit/Cancel theo từng status), gồm cả action bị chặn ở mỗi status.
- **Không gộp biên vào 1 TC**: mỗi giá trị biên/đại diện partition là 1 TC riêng để steps/expected không mơ hồ.

**Cách dựng — ví dụ mẫu (áp dụng khi applicable, không copy nguyên):**

*Decision Table* (logic nhiều điều kiện → liệt kê ma trận, mỗi combination quan trọng = 1 TC, gồm nhánh else):

| # | ĐK1: có tồn kho | ĐK2: đã thanh toán | Kết quả kỳ vọng |
|---|---|---|---|
| 1 | Có | Có | Cho đặt hàng → 200 |
| 2 | Có | Chưa | Chặn → "Cần thanh toán trước" |
| 3 | Hết | Có/Chưa | Chặn → "Hết hàng" (else, không cần xét ĐK2) |

*State Transition* (entity có vòng đời → ma trận `status × action`, gồm cả action bị chặn):

| Status hiện tại | Action | Kỳ vọng (transition hợp lệ hay bị chặn) |
|---|---|---|
| Pending | Approve | → Approved (hợp lệ) |
| Pending | Cancel | → Cancelled (hợp lệ) |
| Approved | Edit | Bị chặn (Approved không cho sửa) — negative TC |
| Cancelled | Approve | Bị chặn — negative TC |

## 3–17. CHIỀU COVERAGE — mở đúng chiều trong `dimensions/`

18 chương chi tiết nằm ở [`dimensions/`](dimensions/) để không phải gánh 9,9k token cho chiều mà task không dùng.

> 📌 **Quy ước tham chiếu:** mọi chỗ trong file này (và trong `02b`, `run_phase1`) ghi "**mục N**" với `N = 3…17, 19…21` đều trỏ tới file tương ứng trong [`dimensions/`](dimensions/) theo bảng dưới. Riêng **mục 18 (Self-check)** và mục 0–2 **vẫn ở file này**.

**THỨ TỰ BẮT BUỘC:** (1) khai `requirements/dimension_manifest.json` — chiều nào `required`, chiều nào `n/a` **kèm lý do**; (2) mở đúng file của các chiều `required`; (3) sinh case có **tag chiều** (§0b); (4) `npm run dim:coverage -- --enforce` chặn nếu thiếu.

Khai `n/a` cho một chiều mà thực tế nó áp dụng = **bỏ chiều có chủ ý**. Và `n/a` **bị máy đối chiếu với artifact có thật** — không phải chỉ để review đọc:

| Khai `n/a` cho | Sẽ bị CHẶN nếu tồn tại |
|---|---|
| §11 Design | `requirements/figma/**` |
| §12 Display | `requirements/ui_catalog.{json,md}` |
| §14 BEData | bảng `field_mapping*` trong `requirements/` |
| §5 API | `requirements/swagger/**` |
| §17 Impact | `requirements/git-impact.md` hoặc `knowledge/system/` có `shared_surface` |
| §10 Guard | `knowledge/system/` có `state_machine` |
| §15 Security | `knowledge/system/` có `permission_matrix` |

Đây là **sự thật kiểm được**, không phải suy diễn: có Figma trong scope thì chiều design áp dụng, hết bàn. Chiều ngược lại KHÔNG đúng — artifact vắng **không** chứng minh chiều đó không áp dụng (có thể chỉ là chưa ai kéo tài liệu về), nên gate im lặng ở ca đó và trách nhiệm vẫn là của bạn.

| § | Chiều | Tag | Mở khi | File |
|---|---|---|---|---|
| §3 | Field-Level Validation | `[Validation]` | scope có form/field nhập liệu (gần như luôn có) | [`03_field_validation.md`](dimensions/03_field_validation.md) |
| §4 | UI Coverage Checklist | `[UI]` | scope có màn UI: lưới/filter/sort/empty-state/loading | [`04_ui.md`](dimensions/04_ui.md) |
| §5 | API Coverage Checklist | `[API]` | scope có endpoint API cần kiểm trực tiếp | [`05_api.md`](dimensions/05_api.md) |
| §6 | E2E Coverage Checklist | `[E2E]` | có luồng xuyên nhiều app/hệ thống | [`06_e2e.md`](dimensions/06_e2e.md) |
| §7 | Export/Import & File Output Coverage | `[Export]` | scope có export/import file | [`07_export_import.md`](dimensions/07_export_import.md) |
| §8 | Resilience / Concurrency / Interaction Coverage | `[Resilience]` | có thao tác đồng thời, callback/retry, hoặc trạng thái đua nhau | [`08_resilience.md`](dimensions/08_resilience.md) |
| §9 | Side-effect / Notification Coverage | `[SideEffect]` | hành động sinh mail/thông báo/task/webhook | [`09_side_effect.md`](dimensions/09_side_effect.md) |
| §10 | Cross-layer Guard Coverage | `[Guard]` | có ràng buộc phải bị CHẶN ở tầng khác (403/409/trạng thái bất hợp pháp) | [`10_guard.md`](dimensions/10_guard.md) |
| §11 | Design/Visual Compliance Coverage | `[Design]` | task CÓ thiết kế Figma để đối chiếu | [`11_design.md`](dimensions/11_design.md) |
| §12 | Display/Field Conformance Coverage | `[Display]` | mọi màn có bảng/danh sách/field — BẮT BUỘC nếu scope có UI | [`12_display.md`](dimensions/12_display.md) |
| §13 | Business Logic / Calculation / Data Consistency Coverage | `[Calc]` | scope có tính toán, rule tổ hợp, hoặc dữ liệu hiển thị ở nhiều nơi | [`13_business_logic.md`](dimensions/13_business_logic.md) |
| §14 | BE Response Data Conformance Coverage | `[BEData]` | mọi màn/endpoint có dữ liệu từ BE — BẮT BUỘC nếu có mapping field | [`14_be_conformance.md`](dimensions/14_be_conformance.md) |
| §15 | Security Coverage | `[Security]` | scope có auth/role/dữ liệu người khác (IDOR, mass-assignment, injection) | [`15_security.md`](dimensions/15_security.md) |
| §16 | Performance / Load / Stress Coverage | `[Perf]` | requirement có SLA, hoặc scope có dữ liệu lớn/đồng thời | [`16_perf.md`](dimensions/16_perf.md) |
| §17 | Change Impact / Regression Ripple Coverage | `[Impact]` | story thêm/sửa/xoá làm thay đổi thứ DÙNG CHUNG | [`17_change_impact.md`](dimensions/17_change_impact.md) |
| §19 | Ordering / Sequence Coverage | `[Ordering]` | luồng có ≥2 bước mà người dùng có thể làm SAI THỨ TỰ / quay lui / xen kẽ | [`19_ordering.md`](dimensions/19_ordering.md) |
| §20 | Error Guessing từ BUG LỊCH SỬ | `[BugHistory]` | `knowledge/bugs/` có entry cùng module với scope (`npm run bugs:checklist`) | [`20_bug_history.md`](dimensions/20_bug_history.md) |
| §21 | Accessibility (A11y) Coverage | `[A11y]` | scope có màn UI thao tác được: form/bảng/modal/menu | [`21_accessibility.md`](dimensions/21_accessibility.md) |
| §22 | Inbound Callback / Webhook (phía NHẬN) | `[Callback]` | hệ thống NHẬN request từ bên thứ ba (VNPay/VietQR, HubSpot, SAP, SMS) — kể cả khi chỉ là "báo kết quả" | [`22_inbound_callback.md`](dimensions/22_inbound_callback.md) |

## 18. Self-check vét cạn biên (BẮT BUỘC trước khi kết thúc)
Tự rà và ghi vào `reports/phase1-summary.md` (Coverage Gaps) nếu thiếu:
- [ ] Mỗi input đã đủ EP + BVA (min-1/min/max/max+1), không gộp biên vào 1 TC.
- [ ] Mỗi màn list/filter có dynamic data đã test theo count + biên ngày/tháng/năm nhuận.
- [ ] Mỗi export/import đã verify cấu trúc file + mapping cột + empty + dataset lớn.
- [ ] Mỗi side-effect (mail/noti/sync) có ít nhất 1 negative (không phát sinh khi fail).
- [ ] Mỗi UI guard (theo status/role) có 1 cross-layer check (API/URL bypass).
- [ ] Mỗi entity có status đã sinh đủ ma trận status x action (+ no-op edit, + idempotent repeat).
- [ ] Mỗi computed field (deadline/approver/naming/mapping) có TC kiểm derivation + 1 biên.
- [ ] Nếu có Figma: mỗi component chính có TC design compliance (màu/font/radius/spacing/kích thước/alignment) đối chiếu token thiết kế.
- [ ] Nếu scope có mobile web: có TC mobile-web behavior (touch target ≥44px, cử chỉ tap/swipe, hamburger/bottom-sheet, orientation, offline/slow-3G) trên thiết bị thật; không áp dụng → `N/A + lý do` (mục 4).
- [ ] Mỗi màn có bảng/field: đã có case đối chiếu **tên cột (exact)**, **format từng field**, **số cột + thứ tự + đủ tên**, **field bắt buộc**, **empty-state/label/placeholder** — và mọi expected hiển thị được **trích từ tài liệu, KHÔNG từ build** (mục 12).
- [ ] Mỗi giá trị được TÍNH/tổng/đếm/sort có TC verify bằng **con số cụ thể tự tính** + 1 biên làm tròn; mỗi dữ liệu hiển thị ≥2 nơi có TC so khớp; mỗi mutation có TC so **delta** trước/sau (mục 13).
- [ ] Mỗi field trống/`-`/`N/A`/`0` nghi ngờ có TC đối chiếu response BE (phân biệt `null`/`""`/`[]`/thiếu key/`0`), FK resolve đúng tên, pagination `total` khớp — không lấy oracle từ build (mục 14).
- [ ] Mỗi endpoint có id resource có TC IDOR; mỗi chức năng theo role có TC privilege bypass BE; input nhạy cảm có TC injection/XSS stored; body create/update có TC mass-assignment; response không lộ field nhạy cảm (mục 15).
- [ ] Mỗi endpoint có TC **HTTP-level** (method sai → `405`, content-type sai → `415`, body quá lớn → chặn không `500`); **biên payload/query** (max vs max+1, số âm/`0`, `[]` vs thiếu key, `page=0/-1/vượt`, `page_size` vượt max) tách TC riêng; endpoint **mutation** có TC **idempotency/double-submit**; endpoint đã có consumer có TC **backward-compat** (field mới optional, không đổi kiểu/bỏ field cũ); endpoint nhạy cảm có TC **rate-limit/concurrency** — không áp dụng nhóm nào thì ghi `N/A + lý do` (mục 5).
- [ ] Nếu có ngưỡng SLA/tải trong scope: có TC đo response time so ngưỡng, large dataset, concurrent — kèm nguồn ngưỡng; không có ngưỡng thì `N/A + lý do` (mục 16).
- [ ] Nếu story đụng bề mặt dùng chung (data/endpoint/component/rule/status/permission/job): mỗi feature khác bị ảnh hưởng có ≥1 regression smoke + backward-compat; feature nghi ảnh hưởng mà không tự xác minh được đã flag `QA confirm`. Thay đổi cô lập → ghi `N/A: no shared surface` (mục 17).

Nếu một dimension (mục 7-17) không áp dụng cho scope, ghi rõ `N/A + lý do` trong Coverage Gaps thay vì bỏ qua im lặng.

---

# Format output

Xuất kết quả dưới dạng bảng Markdown:

```markdown
| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|---|---|---|
| App 1_LOGIN_TC_001 | Đăng nhập | [Positive] Đăng nhập thành công với email và mật khẩu hợp lệ | [pre_existing] Hệ thống chạy tại [URL], tài khoản auto_login_001@test.com Active, chưa đăng nhập | email: auto_login_001@test.com<br>password: Test@12345 | 1. Navigate đến [URL]/login<br>2. Nhập email: auto_login_001@test.com<br>3. Nhập password: Test@12345<br>4. Click button "Đăng nhập" | 1. Trang /login hiển thị đúng form đăng nhập<br>2. Field email nhận đúng giá trị đã nhập<br>3. Field password hiển thị ký tự ẩn<br>4. Sau khi click, hệ thống:<br>- Hiện loading spinner 1-3s<br>- Redirect /dashboard<br>- Toast "Đăng nhập thành công"<br>- Tên user hiển thị trên header | Critical | High |
```

Sau bảng, thêm:
- **Phân nhóm testcase:** Bảng nhóm chức năng → phạm vi → TC ID → tổng.
- **Tiền điều kiện:** mỗi cell `[<method>] <mô tả trạng thái>` (method ∈ api|factory|test_hook|ui|pre_existing|manual). Chi tiết dựng theo task ghi ở `### Setup Readiness` của `phase1-summary.md`; recipe tái dùng ở `knowledge/setup_recipes/`.
- **Tổng TC:** X (Positive: A, Negative: B, Boundary: C, Edge: D)
- **Coverage:** Danh sách fields đã có TC validation
- **Risk Assessment:** Tóm tắt risk level từng chức năng
- **Coverage Matrix:** Mapping requirement/rule/AC/API endpoint → TC ID
- **Coverage Gaps:** Rule/flow chưa cover, lý do, đề xuất bổ sung
- **Testcase Review:** Đánh giá bộ testcase theo Coverage và Quality/Risk, dùng đúng format trong phần `Phase 1 Summary Report bắt buộc` bên dưới.
- **Assumptions:** Các assumption về data, role, API status code, field label hoặc business behavior

## Ngôn ngữ và encoding bắt buộc

- Toàn bộ testcase Markdown, Excel summary, Phase 1 summary report và `task.md` phải dùng tiếng Việt chuẩn có dấu.
- File phải lưu UTF-8.
- Không dùng tiếng Việt không dấu trong heading/nội dung report.
- Không để ký tự lỗi encoding/mojibake; nếu phát hiện phải sửa lại trước khi coi Phase 1 hoàn tất.
- Technical terms, endpoint, method, command, enum/status, code identifier có thể giữ nguyên tiếng Anh.

## Output cuối lượt — MỞ FILE RIÊNG

> **Phase 1 Summary Report** và **Export Excel** đã tách sang [`02b_output_format.md`](02b_output_format.md).
>
> Vì sao tách: hai mục đó là hướng dẫn **định dạng output ở cuối lượt**, KHÔNG phải luật về nội dung case —
> nên không cần nằm trong context suốt lúc đang sinh case. Đo: **−3,7k token** cho mọi lượt gen (24,6k → 20,9k).
>
> ⚠️ **BẮT BUỘC mở `02b_output_format.md`** khi tới bước viết Summary Report / export Excel. Đây là hai mục
> có gate đứng sau (`design_gate` chạy trong `md_to_xlsx`; `self_review` đọc Summary Report) nên bỏ qua là bị chặn.
