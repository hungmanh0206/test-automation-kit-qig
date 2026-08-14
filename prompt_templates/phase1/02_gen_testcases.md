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

# Template bắt buộc (9 cột)

| TC ID | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên | Mức độ rủi ro |

---

# Quy tắc sinh testcase

## 0. Tiết kiệm token và context

- Ưu tiên đọc requirement từ file/link/artifact local; không yêu cầu dán toàn bộ Jira/Confluence/Figma/Swagger vào prompt.
- Nếu đã có `task.md`, raw requirement, snapshot hoặc `reports/phase1-summary.md`, dùng chúng làm nguồn chính và chỉ đọc thêm section còn thiếu.
- Khi tài liệu lớn, chỉ mở phần liên quan đến module, user story, acceptance criteria, screen, endpoint hoặc business rule trong scope.
- Coverage map có thể tạo nội bộ hoặc lưu vào `reports/phase1-summary.md`; không cần paste toàn bộ coverage map vào chat.
- Không đọc file example của task khác trừ khi user yêu cầu dùng example đó làm input.

## 0. Phân nhóm testcase bắt buộc

Testcase phải được phân biệt rõ theo **nhóm chính là business flow** để QA review, export Excel và publish Xray/Jira dễ lọc.

Vẫn giữ đúng template 9 cột. Không tự thêm cột thứ 10 trong Markdown. Thay vào đó, cột `Module` phải dùng format:

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
- KHÔNG thêm cột label vào bảng testcase. Khi publish Xray/Jira, label để TỐI THIỂU (marker `automation-testcase` + khoá dedup `task-*`/`tc-*`); nhóm chức năng thể hiện qua Xray Test Set và subfolder Test Repository (theo sheet chức năng), KHÔNG dùng label group/layer/risk/priority/xray.
- `Khác` chỉ dùng khi requirement không thuộc nhóm nào rõ ràng và phải giải thích trong Coverage Gaps.

### 0b. TAG CHIỀU trong tiêu đề — BẮT BUỘC, có máy kiểm

Mỗi case ghi thêm **1 tag chiều** vào `Trường hợp kiểm thử`, ngay sau tag loại: `[Positive][Display] Lưới … đúng + đủ cột`. Không thêm cột, không đổi template 9 cột — tag nằm trong chính tiêu đề (cùng cơ chế đang đọc `[Positive]`/`[Negative]`).

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
- Mỗi cell `Tiền điều kiện` phải bắt đầu bằng tag `[PRE-NN]` (có thể nhiều tag) trỏ tới dòng tương ứng trong section `## Setup Strategy (Hợp đồng tiền điều kiện)`. Nhiều TC dùng chung precondition thì dùng chung `PRE-NN`. Xem mục 9.
- BẮT BUỘC kèm mô tả ngắn ngay sau mỗi tag để cell tự đọc được mà không cần kéo xuống catalog, định dạng `[PRE-NN] <mô tả trạng thái ngắn>`. Nhiều precondition thì xuống dòng bằng `<br>`, ví dụ: `[PRE-01] Admin đăng nhập, session hợp lệ<br>[PRE-05] Bản ghi cha tồn tại với 3 mục con`. Mô tả ngắn phải khớp cột `Mô tả trạng thái` của `PRE-NN` trong catalog. Không để tag trơ trụi không mô tả.

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
- Mô tả CHÍNH XÁC: text nào hiển thị, URL chuyển đến đâu, element nào thay đổi
- Bao gồm cả response HTTP nếu là API test
- Với UI, nêu rõ field state: enabled/disabled/readonly/visible/hidden, selected value, validation message, toast, row count, pagination, modal state.
- Với API, nêu rõ status code, schema field quan trọng, business value trong response, error code/message nếu có.
- Với E2E, nêu rõ side-effect ở hệ thống khác: app/site liên quan, integration, notification hoặc data count nếu nằm trong scope.
- Expected không được chỉ ghi "thành công", "báo lỗi", "hiển thị đúng".

✅ ĐÚNG (mỗi bước một dòng, mỗi ý một dòng, ngăn bằng `<br>`):
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
Chỉ dùng đúng các giá trị Priority có trong Jira: `Highest`, `High`, `Medium`, `Low`, `Lowest`. Không dùng `Critical`, `P0`, `P1` hoặc giá trị khác trong cột `Ưu tiên`.

| Level | Khi nào |
|---|---|
| **Highest** | Chức năng cốt lõi, hệ thống không dùng được nếu fail, mất dữ liệu hoặc ảnh hưởng bảo mật nghiêm trọng |
| **High** | Tính năng chính, ảnh hưởng nghiệp vụ lớn hoặc block nhóm người dùng quan trọng |
| **Medium** | Tính năng phụ, ảnh hưởng một nhóm người dùng nhưng có workaround |
| **Low** | Edge case, ảnh hưởng ít, không block luồng chính |
| **Lowest** | Lỗi nhỏ/cosmetic, typo, hiển thị phụ hoặc tác động rất thấp |

### 7b. Ma trận Severity × Priority — bảng quyết định

Severity chấm trước (§8, theo hậu quả). Priority = **lấy Severity làm mốc rồi dịch theo bối cảnh**:

| Dịch | Khi nào (đủ 1 điều kiện là dịch) |
|---|---|
| **+1 bậc** | khách/đối tác nhìn thấy trực tiếp · dính tiền đang chạy thật · sắp go-live/demo trong sprint · người dùng cuối không có cách nào đi vòng |
| **giữ nguyên** | không rơi vào 2 nhóm còn lại |
| **−1 bậc** | chức năng **chưa bật** cho người dùng · chỉ xảy ra ở nhánh cấu hình hiếm · có workaround dễ và đã hướng dẫn được · chức năng đã có lịch bỏ/thay thế |

**Ma trận hợp lệ** (● mặc định · ○ hợp lệ, nêu lý do dịch bậc trong `Assumptions` · ⚠ phải giải trình, gate cảnh báo):

| Severity ↓ / Priority → | Highest | High | Medium | Low | Lowest |
|---|---|---|---|---|---|
| **Blocker** | ● | ○ | ⚠ | ⚠ | ⚠ |
| **Critical** | ○ | ● | ○ | ⚠ | ⚠ |
| **Major** | ○ | ○ | ● | ○ | ⚠ |
| **Minor** | ⚠ | ○ | ○ | ● | ○ |
| **Trivial** | ⚠ | ⚠ | ○ | ○ | ● |

**Đọc ma trận:**
- **Đường chéo ● là mặc định** — không có lý do dịch bậc thì chọn ô này.
- **Ô ⚠ không bị cấm**, nhưng phải viết lý do. Hai ô ⚠ hay đúng nhất trong thực tế: `Blocker` + `Medium/Low` (mất dữ liệu ở chức năng **chưa bật** cho ai) và `Minor/Trivial` + `Highest` (sai hiển thị ở **màn khách nhìn thấy lúc trả tiền**). Không có lý do ⇒ một trong hai cột đang chấm sai.
- **Đừng hạ Severity để ô trông "đẹp"**. Phạm vi hẹp, chưa ai dùng, sắp bỏ — tất cả đều là lý do hạ **Priority**, không phải hạ Severity. Đây là lỗi chấm sai phổ biến nhất.
- Nếu trong một bộ testcase mà Severity và Priority **luôn trùng nhau ở mọi dòng** thì một trong hai cột đang được điền máy móc — bảng này vô dụng khi đó.

> ⚙️ **Có máy kiểm** (`design_gate` → `scripts/lib/testcase/validate.js`): giá trị ngoài 5 mức trên = **CHẶN**. Lý do không phải hình thức: bug log lên Jira lấy `Priority` **từ chính cột này** (`08_log_bug_jira.md`), giá trị lạ ⇒ Jira không set được ⇒ bug rơi về default, mất luôn tín hiệu ưu tiên.

## 8. Severity (cột thứ 8 — tên cũ "Mức độ rủi ro")

Severity = **hậu quả NẾU case này fail**. Khác §7 `Ưu tiên` (= thứ tự sửa). Hai trục tách nhau là bình thường:
lỗi cosmetic ở màn thanh toán trước ngày demo = `Trivial` + ưu tiên `High`; mất dữ liệu ở module sprint này
không ai dùng = `Blocker` + ưu tiên `Medium`.

**Chấm bằng CÂY QUYẾT ĐỊNH — đi từ trên xuống, dừng ở câu ĐÚNG đầu tiên. Không chấm theo cảm giác.**

| # | Câu hỏi phân biệt | Nếu ĐÚNG |
|---|---|---|
| 1 | Có **mất/sai dữ liệu không hồi được**, **sai số tiền/doanh thu**, **lộ dữ liệu người khác**, hoặc **hệ thống/luồng chính không dùng được** và KHÔNG có đường vòng? | **Blocker** |
| 2 | Luồng chính sai/không hoàn thành được, nhưng **có đường vòng** (thao tác khác, sửa tay, làm lại) — hoặc dữ liệu sai nhưng **phát hiện và sửa được** trước khi ảnh hưởng tiền/đối soát? | **Critical** |
| 3 | Một **chức năng phụ** sai, hoặc luồng chính sai ở **nhánh điều kiện hẹp** (1 loại đơn, 1 role, 1 cấu hình) — người dùng vẫn làm được việc chính? | **Major** |
| 4 | **Hiển thị/nội dung sai** nhưng dữ liệu bên dưới ĐÚNG: sai nhãn, sai định dạng, sai đơn vị hiển thị, thiếu/thừa trường, sai thứ tự, sai thông báo? | **Minor** |
| 5 | Chỉ **thẩm mỹ**: lệch spacing/màu/căn lề, typo không gây hiểu sai, tooltip thiếu? | **Trivial** |

**Quy tắc phân định khi lưỡng lự (bắt buộc áp dụng, theo thứ tự):**
1. **Tiền và dữ liệu thắng mọi thứ** — dính tiền/doanh thu/đối soát mà sai SỐ ⇒ tối thiểu `Critical`, sai không hồi được ⇒ `Blocker`. Sai đơn vị/định dạng *hiển thị* mà số lưu vẫn đúng ⇒ `Minor` (đừng đẩy lên vì thấy chữ "tiền").
2. **Có đường vòng hay không** là ranh giới `Blocker` / `Critical`. Phải viết đường vòng đó ra trong `Kết quả mong đợi`/`Assumptions`; không nêu được ⇒ coi là không có.
3. **Phạm vi hẹp không hạ severity của hậu quả** — chỉ hạ khi hậu quả nhẹ. 1 role mất dữ liệu vẫn là `Blocker`. Phạm vi hẹp thuộc §7 `Ưu tiên`.
4. **Case negative/guard** lấy severity theo **hậu quả nếu guard KHÔNG chặn** (vd thu vượt trên đơn đã trả đủ ⇒ `Critical`), không phải theo độ khó tái hiện.
5. **Không suy severity từ Impact của module.** Impact ở `risk_model.json` dùng cho risk band cấp module; severity là hậu quả của **chính case này**.

**Ví dụ đã chốt (dùng làm mốc so sánh):**

| Tình huống thật | Severity | Vì sao |
|---|---|---|
| Callback thanh toán trùng làm Paid Amount cộng đôi, đối soát lệch | Blocker | sai số tiền, đã ghi nhận, không tự hồi |
| Đơn đã trả đủ vẫn tạo được giao dịch thu thêm (guard thiếu) | Critical | sai tiền nhưng phát hiện/hủy được trước đối soát |
| Đồng bộ sang hệ ngoài lấy nhầm nguồn (Contact vs Deal) nên field sai người | Critical | dữ liệu sai bản chất, phải sửa lại thủ công |
| Order gia hạn thiếu 1 option trong dropdown tính phí | Major | chức năng phụ / nhánh hẹp, việc chính vẫn chạy |
| Discount 10 USD hiển thị "10đ" (giá trị lưu vẫn đúng) | Minor | sai đơn vị HIỂN THỊ, dữ liệu dưới đúng |
| Section thiếu trường `Net Price` | Minor | thiếu thông tin hiển thị, không sai dữ liệu |
| Lệch spacing giữa checkbox và các box còn lại | Trivial | thuần thẩm mỹ |

> ⚙️ **Có máy kiểm**: giá trị ngoài `Blocker|Critical|Major|Minor|Trivial` = **CHẶN** (thang cũ `High|Medium|Low` vẫn tạm nhận cho bộ TC cũ, kèm cảnh báo 1 lần/file — bộ cũ **không cần** chuyển). Ghi giá trị Severity vào cột `Ưu tiên` = **CHẶN** (sai cột). Hai cột §7/§8 **không được nói ngược nhau**: `Blocker/Critical` + ưu tiên `Low/Lowest`, hoặc `Minor/Trivial` + ưu tiên `Highest` ⇒ **cảnh báo**.
> ⚠️ **Jira hiện CHƯA có field Severity** → giá trị này chỉ sống trong testcase + report, **KHÔNG** đẩy lên Jira. `Priority` của bug vẫn lấy từ cột §7.

## 9. Setup Strategy (Hợp đồng tiền điều kiện) — BẮT BUỘC

Cột `Tiền điều kiện` chỉ mô tả *trạng thái cần có*. Phase 2 còn cần biết *cách đạt được trạng thái đó* để tự setup thay vì đoán. Vì template giữ đúng 9 cột (không thêm cột thứ 10), thông tin setup được đặt trong một section riêng sau bảng testcase, dạng catalog tái sử dụng theo ID.

Dùng skill `precondition_setup_planner` để phân loại precondition, chọn setup method và đánh dấu readiness/blocker.

Sau `## Phân nhóm testcase`, thêm section bắt buộc `## Setup Strategy (Hợp đồng tiền điều kiện)` gồm bảng:

| Precondition ID | Mô tả trạng thái | Precondition Type | Setup Strategy | Setup Source | Setup Verification | Cleanup/Rollback | Automation Readiness | Linked TC IDs |
|---|---|---|---|---|---|---|---|---|

Quy tắc:
- Mỗi precondition distinct = 1 `PRE-NN` (2-3 chữ số, liên tục). Nhiều TC dùng chung precondition thì dùng chung 1 `PRE-NN`; không lặp lại recipe.
- Mỗi cell `Tiền điều kiện` trong bảng testcase phải bắt đầu bằng tag `[PRE-NN]` kèm mô tả ngắn (`[PRE-NN] <mô tả trạng thái ngắn>`, nhiều tag tách bằng `<br>`) trỏ tới dòng tương ứng trong catalog. Mô tả ngắn phải khớp cột `Mô tả trạng thái` của `PRE-NN`. Mỗi `PRE-NN` trong catalog phải được ít nhất 1 TC tham chiếu.
- `Precondition Type` ∈ `auth_session` | `state_exist` | `state_mutation` | `config` | `pre_existing_fixture` | `none`.
- `Setup Strategy` ∈ `api` | `factory` | `test_hook` | `ui` | `pre_existing` | `manual`. Ưu tiên `pre_existing` → `api`/`factory` → `test_hook` → `ui` → `manual`; không có strategy DB.
- KHÔNG bắt UI dựng tiền điều kiện nếu testcase không nhằm test flow tạo tiền điều kiện đó; setup qua `api`/`factory`/`test_hook`/`pre_existing`, UI chỉ làm behavior chính của case. Mock/test double chỉ dùng cho dependency ngoài scope (fault injection), không mock behavior đang test. Không dùng DB để DỰNG state (chỉ `api`/`factory`/`test_hook`/`pre_existing`); verify state có thể dùng read-only UAT DB qua guarded client (read-only, chỉ SELECT) khi API/UI không expose.
- `Setup Source` phải CỤ THỂ, đủ để Phase 2 dùng trực tiếp, KHÔNG ghi chung chung:
  - `api`: method + endpoint + payload skeleton, ví dụ `POST /api/v1/resources { type:"parent", children:["A","B","C"] }`.
  - `factory`/`test_hook`: tên factory/hook + tham số, ví dụ `userFactory.setActionCount(userId, 2)`.
  - `pre_existing`/`pre_existing_fixture`: định danh fixture cụ thể (id/code/class code), không ghi "user bất kỳ".
  - Endpoint/payload phải lấy từ Swagger đã fetch ở `requirements/swagger/`; KHÔNG bịa endpoint. Nếu Swagger không có cách setup state, đặt `Automation Readiness = Needs hook` hoặc `Manual-only` và ghi rõ hook/manual steps đề xuất.
  - Nếu precondition phụ thuộc precondition khác, ghi `(depends PRE-xx)` trong `Setup Source`.
- `Setup Verification`: cách xác nhận setup thành công TRƯỚC khi assert, ví dụ `GET /api/v1/resources?parentId={id} trả 3 mục con` hoặc `GET /api/v1/users/{id} trả action_count=2`. Nếu API/UI không expose state cần verify: có thể dùng **read-only UAT DB** qua guarded client `tests/support/setup/db/uatPgClient.ts` (read-only, chỉ SELECT) làm verification, ví dụ `db_readonly: SELECT count(*) FROM ... WHERE ...`; nếu cả DB UAT cũng không expose → đặt `Automation Readiness = Needs hook`/`Manual-only`. KHÔNG dùng DB để DỰNG state. *(Đây là verify **tiền điều kiện đã dựng xong chưa**. Verify **kết quả sau khi case chạy mutation** là chuyện khác — xem §13b, và cũng chỉ dùng trong 5 tình huống liệt kê ở đó.)*
- `Cleanup/Rollback`: hành động rollback cụ thể (ưu tiên scope theo `RUN_ID`) hoặc `none` + lý do. `state_mutation` và data tạo mới BẮT BUỘC có cleanup hoặc lý do không cleanup được.
- `Automation Readiness`:
  - `Ready`: Phase 2 tự setup hoàn toàn qua `api`/`factory`/`pre_existing` đã verify được bằng UI/API/fixture/hook an toàn. Phase 2 KHÔNG được skip các TC này vì lý do setup.
  - `Needs hook`: cần test hook/setup endpoint chưa tồn tại. Đây là blocker cần bổ sung; Phase 2 ghi blocker và đề xuất hook, không false-pass, không skip âm thầm.
  - `Manual-only`: setup không thể tự động hóa nếu không can thiệp DB/backend state. Đây là cơ sở DUY NHẤT để Phase 2 skip TC vì setup, và phải kèm lý do/manual steps.
- `Linked TC IDs`: danh sách TC dùng precondition này (trace ngược).

Ví dụ catalog:

| PRE-01 | Tài khoản Admin đã đăng nhập, session hợp lệ | auth_session | api | `POST /api/v1/auth/login { username:"<admin>" }` → lưu token | `GET /api/v1/auth/me` trả role=admin | none (session read-only) | Ready | APP_ORDER_TC_001, APP_ORDER_TC_002 |
| PRE-05 | Bản ghi nghiệp vụ "parent" tồn tại với 3 mục con | state_exist | api | `POST /api/v1/resources { type:"parent", children:["A","B","C"] }` (depends PRE-01) | `GET /api/v1/resources?parentId={id}` trả 3 mục con | `DELETE /api/v1/resources/{parentId}` theo RUN_ID | Ready | APP_ORDER_TC_010 |
| PRE-09 | User đã đạt giới hạn thao tác (max 2 lần) | state_mutation | test_hook | `userFactory.setActionCount(userId, 2)` (depends PRE-01) | `GET /api/v1/users/{id}` trả action_count=2 | reset action_count của userId theo RUN_ID | Needs hook | APP_PROFILE_TC_023 |

---

# Yêu cầu coverage và risk

Trước khi sinh TC, thực hiện:

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

15 chương chi tiết đã tách sang [`dimensions/`](dimensions/) để không phải gánh 9,9k token cho chiều mà task không dùng.

> 📌 **Quy ước tham chiếu:** mọi chỗ trong file này (và trong `02b`, `run_phase1`) ghi "**mục N**" với `N = 3…17` đều trỏ tới file tương ứng trong [`dimensions/`](dimensions/) theo bảng dưới. Riêng **mục 18 (Self-check)** và mục 0–2 **vẫn ở file này**.

**THỨ TỰ BẮT BUỘC:** (1) khai `requirements/dimension_manifest.json` — chiều nào `required`, chiều nào `n/a` **kèm lý do**; (2) mở đúng file của các chiều `required`; (3) sinh case có **tag chiều** (§0b); (4) `npm run dim:coverage -- --enforce` chặn nếu thiếu.

Khai `n/a` cho một chiều mà thực tế nó áp dụng = **bỏ chiều có chủ ý**, và lý do bạn ghi sẽ bị đọc lại khi review. Không có gate nào đọc hộ bạn tài liệu — nhưng có gate đếm case theo tag.

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
| TC ID | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên | Mức độ rủi ro |
|---|---|---|---|---|---|---|---|---|
| App 1_LOGIN_TC_001 | Đăng nhập | [Positive] Đăng nhập thành công với email và mật khẩu hợp lệ | [PRE-01] Hệ thống chạy tại [URL], tài khoản auto_login_001@test.com Active, chưa đăng nhập | email: auto_login_001@test.com<br>password: Test@12345 | 1. Navigate đến [URL]/login<br>2. Nhập email: auto_login_001@test.com<br>3. Nhập password: Test@12345<br>4. Click button "Đăng nhập" | 1. Trang /login hiển thị đúng form đăng nhập<br>2. Field email nhận đúng giá trị đã nhập<br>3. Field password hiển thị ký tự ẩn<br>4. Sau khi click, hệ thống:<br>- Hiện loading spinner 1-3s<br>- Redirect /dashboard<br>- Toast "Đăng nhập thành công"<br>- Tên user hiển thị trên header | Highest | High |
```

Sau bảng, thêm:
- **Phân nhóm testcase:** Bảng nhóm chức năng → phạm vi → TC ID → tổng.
- **Setup Strategy (Hợp đồng tiền điều kiện):** Catalog `PRE-NN` theo schema mục 9; mọi precondition trong bảng testcase phải map được tới một `PRE-NN`.
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
