# Nhập gói QIG QA — Automation & RBT (A) vào Test Automation Kit (B)

> Bước 1 của `PROMPT_import_QIG_RBT_vao_kit.md`. Bảng này là **checkpoint**: chưa sửa file nào ngoài
> `.gitignore` (thêm `_import/`). Duyệt xong mới sang Bước 2.
>
> Gói A: `D:\Project\QIG QA — Automation & RBT-v1.zip` → `_import/qig-qa-automation/` (65 file, gitignored).

## 0. Hai việc phải quyết trước khi làm

### 0.1 Điều kiện DỪNG §0.2 đang BẬT — và user đã chọn đi tiếp

Prompt ghi: *"Kiểm không có story nào đang chạy chạm file shared. Có thì DỪNG."* Hiện cây làm việc có
**29 file đã sửa + 224 file chưa track**. Bảy file mà các hạng mục dưới đây sẽ sửa **đang dở dang**:

| File dở dang | Hạng mục cần sửa nó |
|---|---|
| `scripts/lib/testcase/model.js` | H1 — thêm `techniquesOf()` |
| `scripts/lib/testcase/validate.js` | H1 — check kỹ thuật (hiện **chưa** sửa dở, nhưng nằm cùng module) |
| `scripts/qa/output_gate.js` | H2 — tái dùng kết quả gen-testcase · H3 — đếm `[NeedsVerify]` |
| `scripts/qa/dimension_coverage.js` | H1 — đếm theo kỹ thuật |
| `prompt_templates/phase1/02b_output_format.md` | H1 — bảng phân bố kỹ thuật |
| `scripts/convert_excel/md_to_xlsx.js` | H1 — số đếm theo kỹ thuật |
| `scripts/convert_excel/merge_execution_status.js` | H6 — ghi `Result` cho nhánh chạy tay |

User đã chốt: **cứ làm, tự tránh 7 file đó**. Nhưng phải nói thẳng một hệ quả, vì nó quyết định
hạng mục nào làm được:

> **H1 KHÔNG thể hoàn thành nếu không chạm `model.js` và `validate.js`.** Toàn bộ giá trị của H1 là
> "kỹ thuật thiết kế có máy kiểm", mà máy đó phải sống trong `techniquesOf()` + `validate()`. Làm ở file
> mới thì không gate nào gọi tới, và nó thành đúng thứ prompt cấm: luật không có máy đứng sau.

Ba cách đi, xem §5.

### 0.2 Mã kỹ thuật VA CHẠM với tag chiều — đã đo, không phải phỏng đoán

Prompt cảnh báo `dimensionsOf()` khớp bằng `includes`. Đo bằng máy trên 25 chiều đang khai:

```
[ST] nằm trong chiều "bughistory"   ← b-u-g-h-i-[st]-o-r-y
[ST] nằm trong chiều "dbpersist"    ← d-b-p-e-r-s-i-[st]
[EG] nằm trong chiều "negative"     ← n-[eg]-a-t-i-v-e
[EG] nằm trong chiều "regression"   ← r-[eg]-r-e-s-s-i-o-n
→ 4 va chạm
```

Hàm **hiện tại** an toàn: nó chạy `tag.includes(chiều)`, mà `'st'` không chứa `'bughistory'`. Nguy hiểm
nằm ở hàm **sắp viết**: `techniquesOf()` viết theo cùng kiểu sẽ đọc `[BugHistory]` thành kỹ thuật ST và
`[Negative]` thành EG — tức mọi case negative của mọi bộ TC cũ bỗng "có khai kỹ thuật EG".

**Đề xuất: khớp CHÍNH XÁC, không dùng tiền tố `[T:BVA]`.** Lý do: `tagNamesOf()` đã bóc sẵn từng tag
thành tên rời (`model.js:237`), nên so bằng `===` là đủ và không cần đổi cú pháp tag. Giữ `[BVA]` đúng như
A viết thì QA đọc quen hơn, và không phải sửa tài liệu của A khi tra cứu. Ghi luật này vào config kèm lý do.

## 1. Bảng mapping

Cột **Quyết định**: NHẬN (lấy nguyên ý) · CHỈNH (lấy ý, đổi cách làm cho hợp kit) · BỎ (không nhập).

### H1 — Kỹ thuật thiết kế thành tag có máy kiểm

| Ý của A | Kit đã có ở đâu | Quyết định | Lý do | Máy kiểm sẽ là gì |
|---|---|---|---|---|
| 6 mã kỹ thuật `EP·BVA·DT·ST·UC·EG` (`SKILL.md:134`) | `02_gen_testcases.md:415-418` chỉ **nhắc tên** 4 kỹ thuật, không đo gì | **NHẬN** | Kit nhắc nhưng không có gì đo xem case có thật sự thiết kế theo kỹ thuật đó | `.agent/config/design_techniques.json` làm nguồn duy nhất, theo mẫu `case_types.json` |
| Điều kiện BẮT BUỘC kích hoạt từng kỹ thuật (`SKILL.md:494-498`) | **Chưa có** | **NHẬN** | Đây là phần giá trị nhất của A: nó biến "nên dùng BVA" thành "có field min/max thì PHẢI có BVA" | `dim:coverage` (hoặc script mới): kỹ thuật bị kích hoạt mà 0 case ⇒ CHẶN |
| Biên test tại `min-1, min, max, max+1` | **Chưa có** | **NHẬN** | Đo được bằng máy | CẢNH BÁO khi `[BVA]` thiếu một trong 4 điểm biên |
| `[BVA]` mà data không ở biên = 0 điểm | **Chưa có** | **CHỈNH** | Heuristic này dễ báo oan: "biên" của ngày, chuỗi, số là ba kiểu khác nhau | Viết heuristic rồi **ĐO tỉ lệ báo oan trên bộ TC thật trước**, đạt thì CHẶN, không đạt thì để CẢNH BÁO |
| Mã kỹ thuật nằm TRONG `TC ID` (`LOGIN-EP-001`) | `TC ID` của kit đã publish hàng nghìn case lên Sheet | **BỎ** | Luật 0.5 của prompt cấm đổi format `TC ID` | — |
| Cột `Technique` riêng | Template 10 cột, luật 0.5 cấm thêm cột | **CHỈNH** | Thông tin mới đi vào cột `Tag`, như chiều coverage đang làm | `[BVA]` đứng cạnh `[Boundary][Validation][BR-XXX-001]` |

### H2 — Rubric 8 tiêu chí thành máy chấm

| Tiêu chí A | Kit đã có ở đâu | Quyết định | Máy kiểm sẽ là gì |
|---|---|---|---|
| 1. Rõ ràng, mỗi step 1 hành động | `output_gate.js:289` đã chặn gộp range (`1-2.`) | **CHỈNH** | Thêm: phát hiện step gộp nhiều hành động (dấu hiệu: nhiều động từ mệnh lệnh trong một số) |
| 2. Expected đo được | **ĐÃ CÓ** — `output_rules.js:269` `VAGUE_EXPECTED` chặn "thành công/hiển thị đúng/hoạt động…"; `output_gate.js:286` chặn Expected rỗng; `:288` cảnh báo tautology | **TÁI DÙNG** | Không viết lại. `tc_review` gọi lại kết quả gate |
| 3. Độc lập | **ĐÃ CÓ** — `validate.js:209` bắt buộc `Tiền điều kiện` mở đầu bằng tag cách dựng | **CHỈNH** | Thêm: phát hiện câu tham chiếu "sau khi chạy TC khác" |
| 4. Data cụ thể | **ĐÃ CÓ** — check placeholder đang chạy | **TÁI DÙNG** | — |
| 5. Truy vết (cột `REQ ID`) | Kit dùng `oracle_ref` (`BR-`/`SM-`/`UI-`) + `domain:trace-back` | **CHỈNH** | Thay "cột REQ ID" bằng oracle-ref. A không có khái niệm oracle độc lập |
| 6. Đúng trọng tâm | Một phần ở gate run-on | **CHỈNH** | Máy: Expected trải nhiều mục tiêu, tiêu đề có 2 hành vi. Phần còn lại AI chấm |
| 7. Đủ 6 thành phần ISTQB | Kit **không có** cột `Actor/Role`, `Context` | **CHỈNH mạnh** | Không thêm cột. Đọc Actor và Context **từ `Tiền điều kiện`**. Cấm actor chung chung ("Người dùng"/"User"/"Tester") |
| 8. Kỹ thuật khai đúng | — | **NHẬN** | Dùng kết quả H1 |
| Thang 0–2, tối đa 16; 13–16 dùng được · 8–12 cần sửa · 0–7 viết lại | **Chưa có** | **NHẬN** | Ngưỡng đặt ở config, `tc:review:enforce` CHẶN |
| Tiêu chí máy không phán được | — | **CHỈNH** | Ghi `AI` và để agent chấm. **Không cộng "không phán được" thành đạt** — đây là luật nền của kit |

### H3 — Đối chiếu evidence đầu vào (chỗ A va với kit nặng nhất)

| Ý của A | Kit đã có ở đâu | Quyết định | Lý do |
|---|---|---|---|
| Thứ tự tin cậy `DOM thật > Ảnh evidence > Tài liệu chữ` (`SKILL.md:162`) | `CLAUDE.md` §3: oracle phải **độc lập theo spec**, CẤM app==app | **CHỈNH — đảo ngược** | DOM và ảnh của build **là chính cái app đang kiểm**. Lấy nó làm chuẩn đúng/sai chính là tautology kit cấm |
| "Tài liệu ghi một đằng, ảnh một nẻo → ảnh thắng" (`:174`) | Ambiguity Gate đã có, `phase1_01_prepare_context.md:29` | **CHỈNH** | Lệch nguồn ⇒ **thành câu hỏi Ambiguity Gate**, không tự chọn bên |
| Thứ tự dựng oracle mới | — | **NHẬN (viết lại)** | `knowledge/domain/` đã xác nhận > spec, Figma > ảnh hoặc DOM của build. Ảnh/DOM chỉ **chốt sự thật quan sát** (nhãn, option, mặc định, disabled), không phán đúng/sai |
| 4 nhóm TC bắt buộc có nguồn chống lưng (`:184`) | **Chưa có** | **NHẬN** | Bố cục · nhãn nguyên văn · giá trị mặc định · định dạng hiển thị |
| Tag `@NeedsVerify` khi thiếu evidence (`:179`) | **Chưa có** | **NHẬN (đổi cú pháp)** | Thành `[NeedsVerify]` cho khớp cột `Tag`. `/publish` CHẶN khi còn, trừ `--qa-approved` |
| Script đọc DOM (option, selectedIndex, checked/disabled, fieldOrder) (`:199`) | `ui_debug_agent` đã có | **NHẬN** | Đưa vào skill dạng công thức tái dùng — **đúng thứ cũng cần cho H4 của prompt giảm token** |
| "Checkbox xám mờ = disabled → có business rule phụ thuộc" (`:218`) | **Chưa có** | **NHẬN** | Vào `dimensions/03_field_validation.md`: sinh case cả hai chiều + mở câu hỏi |
| "Chưa mở evidence thì chưa được ghi dòng TC đầu tiên" | — | **BỎ** | Kit chạy Phase 1 từ spec, nhiều task không có thư mục evidence. Áp cứng sẽ chặn oan |

### H4 — Checklist field và component

| Ý của A | Kit đã có ở đâu | Quyết định | Ghi chú |
|---|---|---|---|
| 15 loại field (`SKILL.md:455-470`) | `dimensions/03_field_validation.md` | **CHỈNH** | Gộp vào, **khử trùng** với nội dung đang có. Đo token trước/sau; phình quá `doc_budget` thì tách file tra cứu |
| 6 component: Table/List · CRUD · Permission · Modal · Toast · Status flow (`:477-486`) | `dimensions/04_ui.md`, `13_business_logic`, `15_security`, `23_db_persistence` | **CHỈNH** | Chia theo chiều phù hợp, không dồn một file |
| "Component không áp dụng → ghi 'Không áp dụng', KHÔNG lặng lẽ bỏ qua" | `dimension_manifest.json` đã có cơ chế khai `n/a` + lý do | **NHẬN** | Khớp sẵn với cơ chế đang có |
| `field-inventory.spec.ts` có inventory loại field | Đã có | **NHẬN** | Thêm check mức CẢNH BÁO: field loại X có trong inventory mà 0 case `[Validation]` |

#### H4 đã làm — và hai chỗ lệch với prompt, nói thẳng

**Danh mục ra 18 loại field, không phải 15.** 15 loại của A hợp 10 loại kit vốn có, trùng 7. Ba loại chỉ
kit có (`Date/Month filter` · `Time (HH:mm)` · `Computed/derived`) giữ nguyên, vì chúng đến từ bug thật đã
gặp. Tám loại của A là mới hẳn: Phone · Checkbox/Radio · Textarea · OTP/MFA · Date range · Rich text ·
Multi-select · Range slider. Bảy loại trùng thì chỉ lấy **trục còn thiếu** (SQL injection ở Text; nhiều `@`
và case sensitivity ở Email; overflow và leading zero ở Number; toggle hiện/ẩn và confirm ở Password; tên
file đặc biệt ở File upload), không chép lại dòng.

**Status flow KHÔNG nhập checklist.** `12_display.md` đã có `state_machine`, và nó mạnh hơn checklist của A:
nó bắt **mọi** cặp không khai là bất hợp pháp, và đòi expected lấy từ `illegal_verified.expected` thay vì
câu "bị chặn". Viết checklist song song chỉ tạo nguồn thứ hai để lệch nhau. Chỉ neo tên component vào đó.
CRUD lifecycle cũng vậy: 4 trong 7 chặng của A đã có chỗ ở `13b` và `23_db_persistence`, nên phần nhập
vào là **ba chặng chưa chiều nào lo** (nhánh Cancel của hộp xoá · xoá bản ghi đang được tham chiếu · ba
kiểu trùng ở field unique).

**Chỗ lệch 1 — check theo loại field KHÔNG làm được như prompt mô tả.** Prompt viết: "field loại X có trong
inventory mà bộ TC không có case `[Validation]` nào cho nó". Đã đo: `field-inventory.spec.ts` và
`ui_conformance_check.js` kiểm kê **TÊN** field của từng màn (`expectedFields` là mảng chuỗi nhãn), **không
có thuộc tính LOẠI**. Inventory theo loại field vì vậy không tồn tại, và suy loại từ tên nhãn là dò chữ.
Nên mẫu số phải do người khai (`field_types` trong manifest), và máy chỉ kiểm được hai điều: mã lạ thì
CHẶN, và số loại khai nhiều hơn số case `[Validation]` thì cảnh báo. Nó **không** biết case nào thuộc loại
nào, và câu cảnh báo in kèm giới hạn đó.

**Chỗ lệch 2 — cửa component cho artifact nằm SAU cửa chiều.** Đo khi viết test: khai
`permission: n/a` mà `knowledge/system/` có `permission_matrix` thì cửa **chiều** (`security: n/a`) chặn
trước và script thoát, nên cửa component không chạy tới. Cửa component vì thế chỉ bắt được ca mà cửa chiều
không bắt: **chiều khai `required` mà component khai `n/a`**. Test khoá đúng ca đó.

**Đo token trước và sau** (`node scripts/qa/doc_budget.js`, ngưỡng đọc-trực-tiếp là 8.0k):

| File chiều | Trước | Sau |
|---|---|---|
| `03_field_validation.md` | 1.0k | 1.9k |
| `04_ui.md` | 0.6k | 1.3k |
| `10_guard.md` | 0.2k | 0.7k |
| `12_display.md` | 2.1k | 2.2k |
| `13_business_logic.md` | 2.5k | 3.0k |
| **tổng** | **6.3k** | **9.1k** |

Không file nào tới ngưỡng, nên **không tách file con**. Nhưng cộng thêm 2.8k là thật, và nó đi ngược mục
tiêu của `PROMPT_giam_token_kit.md`. Mỗi task chỉ nạp những chiều mình khai `required`, nên phần phải trả
thật là 1-2 file, không phải cả 2.8k.

### H5 — Mode CHECKLIST

| Ý của A | Kit đã có ở đâu | Quyết định | Máy kiểm |
|---|---|---|---|
| 4 loại checklist + quy mô (`SKILL.md:773-778`) | `05_manual_quick.md` (Phase 1) | **NHẬN** | Thêm **sub-mode**, không tạo pipeline mới |
| Smoke 10–20 · Post-hotfix 5–15 · Regression 20–40 · Release 30–60 | — | **NHẬN** | Ngưỡng đặt ở config |
| Gate 4 tiêu chí (`:841`) | Tiêu chí 1 **ĐÃ CÓ** (`VAGUE_EXPECTED`) | **CHỈNH** | `design_gate --mode checklist`: ① tái dùng bộ từ cấm ② luồng sống còn ③ mỗi component ≥1 mục hoặc "không áp dụng" ④ số mục trong ngưỡng, vượt ⇒ CHẶN + gợi ý tách |

### H6 — Nhánh chạy tay cho case `Manual-only`

| Ý của A | Kit đã có ở đâu | Quyết định | Luật kit ĐÈ luật A |
|---|---|---|---|
| Luồng `navigate → wait → snapshot → interact → screenshot` | Phase 2 ghi `SKIP_SETUP` rồi dừng | **NHẬN** | Tạo `manual-run/` theo mẫu `exploratory/`, nhánh **never-auto** |
| A chỉ chụp ảnh khi FAIL | `CLAUDE.md` §4: ảnh/video cho **mọi step của mọi case**, cả PASS | **BỎ luật của A** | `output_gate --mode test-execution` đã chặn sẵn (`output_gate.js:128`) |
| Verdict của A | `verdict_taxonomy.json` là nguồn duy nhất | **BỎ luật của A** | FAIL phải rerun 2–3 lần rồi qua Bug Claim Gate |
| Ghi kết quả | `merge_execution_status.js` | **NHẬN** | ⚠ File này đang dở dang — xem §0.1 |

## 2. Những thứ của A KHÔNG nhập

| Thứ | Lý do |
|---|---|
| Markdown canonical | Kit dùng **Excel canonical + Google Sheet**. Đổi nguồn sự thật là đổi cả pipeline publish |
| Bảng 19 cột tiếng Anh | Luật 0.5: không thêm cột vào template 10 cột |
| Mã kỹ thuật trong `TC ID` | Hàng nghìn case đã publish; đổi `TC ID` là mất truy vết và làm hỏng chống trùng |
| "Ảnh thắng tài liệu" làm oracle | app==app, `CLAUDE.md` §3 cấm. Đã chỉnh ở H3 |
| Auto-heal 5 vòng không hỏi user, có dòng "Assertion fail → cập nhật assertion" | Đây là **sửa expected cho pass**, `CLAUDE.md` §6 cấm thẳng. Kit giữ `locator_healing_policy.md` |
| Chỉ chụp ảnh khi FAIL | Trái §4 |
| Jira/Xray | Kit đã gỡ sạch, có `gate:policy` NO-LEGACY-TOOLS canh. Nhập lại là tự làm đỏ CI |
| Selenium, Appium, framework scaffold | Ngoài phạm vi đợt này |
| `export_testcases_xlsx.py` | Kit có `md_to_xlsx.js`, đã có gate toàn vẹn `.xlsx` |

## 3. Chỗ kit ĐÃ LÀM — không làm lại

Prompt yêu cầu ghi rõ để khỏi tốn công:

| A đề xuất | Kit đã có |
|---|---|
| Expected phải đo được | `output_rules.js:269` `VAGUE_EXPECTED` + `output_gate.js:286,288` |
| Hỏi cho hết mơ hồ trước khi sinh case | Ambiguity Gate, `phase1_01_prepare_context.md:29` (gate cứng) |
| Mỗi step một hành động, đánh số | `output_gate.js:289` chặn gộp range |
| Tiền điều kiện phải dựng được | `validate.js:209` bắt buộc tag cách dựng |
| Data không được placeholder | Check placeholder đang chạy |
| Component không áp dụng phải khai | `dimension_manifest.json` + `dim:coverage --enforce` |
| Phủ theo chiều | 25 chiều trong `DIMENSION_TAGS`, có `dim:coverage` |

## 4. Bộ TC cũ không được đỏ oan — mẫu hai tầng

Luật 0.6 của prompt. Mẫu có sẵn ở `case-type-gate.spec.ts` + `validate.js:105-109`: giá trị ngoài danh sách
⇒ CHẶN, tên CŨ ⇒ CẢNH BÁO kèm lý do, và `--lenient` vẫn convert được **nhưng phải KÊU**.

Áp cho H1: bộ **chưa có case nào** mang tag kỹ thuật ⇒ gate tự từ chối chặn, in rõ "bộ này CHƯA ĐƯỢC GÁC
theo kỹ thuật thiết kế". Bộ **đã có ít nhất một** ⇒ case thiếu tag = CHẶN, mã lạ = CHẶN.

## 5. Ba cách đi với 7 file dở dang — cần user chọn

| | Cách làm | Được | Mất |
|---|---|---|---|
| **A** | Bạn commit 7 file đang dở trước, rồi tôi làm đủ H1–H6 | Làm được trọn vẹn, có mốc sạch để `mutation_check` chứng minh gate mới biết đỏ | Bạn phải dừng việc đang làm để chốt |
| **B** | Tôi làm H2–H5 trước (ít chạm 7 file nhất), để H1 và H6 lại | Không đụng việc của bạn | H2 tiêu chí 8 phụ thuộc H1 nên chấm thiếu; H6 không ghi được `Result` |
| **C** | Tôi làm hết, phần chạm 7 file thì tách hunk như đã làm hôm nay | Xong trong một lượt | Tách hunk trên 7 file cùng lúc rủi ro hơn hẳn 2 file; và `validate.js` sẽ bị sửa đồng thời hai phía |

**Đề xuất: A.** Lý do không phải ngại va chạm, mà vì Bước 4 của prompt đòi *"chạy `mutation_check` để chứng
minh mỗi gate mới biết đỏ"*. Không có mốc sạch thì câu "gate mới có răng" là lời khẳng định không kiểm được —
đúng thứ kit này tồn tại để chặn.

Chọn B thì tôi bắt đầu được ngay, và H1/H6 chờ bạn chốt xong 7 file.
