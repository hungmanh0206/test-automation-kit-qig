# Prompt chạy Phase 1 - Sinh testcase

> Chạy: `Đọc file này và chạy với TASK_KEY=<TASK_KEY>`. Rule: non-negotiables ở `CLAUDE.md` (đã auto-load). Digest: `.agent/rules/core_rules.md`. Chỉ mở `RULE_GLOBAL.md` **ở đúng mục cần** (mỗi gạch đầu dòng của digest có ghi `§`) — đừng nạp cả file.

Dùng prompt này để collect context và sinh/cập nhật testcase. Đây là template dùng chung, phải thay các placeholder trước khi chạy. Không execute automation trong Phase 1.

## Bản đồ prompt Phase 1 — file này là ĐIỂM VÀO DUY NHẤT

Chỉ cần đọc file này; nó chỉ ra mở file nào ở bước nào. **Không nạp sẵn cả 7 file** — mở đúng cái đang cần, đúng lúc cần (riêng `02_gen_testcases.md` đã 77KB, dù đã tách 3,7k phần định dạng output sang `02b`).

| Prompt | Bắt buộc? | Mở khi nào |
|---|---|---|
| [`phase1/01_setup_engine_fetch_docs.md`](phase1/01_setup_engine_fetch_docs.md) | khuyến nghị | **Bước 1** — checklist đọc tài liệu đầy đủ + spec `snapshot_context.json`. Bước 1 dưới đây chỉ tóm ý |
| [`phase1/02_gen_testcases.md`](phase1/02_gen_testcases.md) | **BẮT BUỘC** | **Bước 3** — toàn bộ chuẩn sinh TC: 10 cột canonical, `Ưu tiên` §7/§7b (KHÔNG còn cột Severity), 18 nhóm coverage, cách dựng tiền điều kiện |
| [`phase1/dimensions/*.md`](phase1/dimensions/) | **mở đúng chiều `required`** | **Bước 3, sau khi khai manifest** — 15 chương chiều coverage (§3–§17), tách khỏi `02` (14/08/2026) để không gánh 9,9k cho chiều task không dùng. Thứ tự: khai `requirements/dimension_manifest.json` → mở file các chiều `required` → sinh case có tag §0b → `npm run dim:coverage -- --enforce`. Bảng chiều→tag→file→"mở khi" nằm ở §3–17 của `02` |
| [`phase1/02b_output_format.md`](phase1/02b_output_format.md) | **BẮT BUỘC ở CUỐI lượt** | **Bước cuối** — Phase 1 Summary Report + Export Excel. Tách khỏi `02` (14/08/2026) để bỏ **3,7k token** khỏi lúc đang sinh case: đây là định dạng OUTPUT, không phải luật nội dung case. Cả hai đều có gate đứng sau (`design_gate` trong `md_to_xlsx`, `self_review` đọc Summary Report) nên bỏ qua là bị chặn |
| [`phase1/03_gen_test_data.md`](phase1/03_gen_test_data.md) | khi cần | Cần **bảng test data riêng** + `DataGenerator` cho Phase 2 (4 nhóm data, đặt tên traceable, `Data State` khớp Setup Strategy). Nếu chỉ cần cột "Dữ liệu Test" trong TC thì §4 của `02` là đủ |
| [`phase1/04_auto_publish_backlog.md`](phase1/04_auto_publish_backlog.md) | **BẮT BUỘC** khi publish | **Bước sau QA duyệt** — đẩy TC lên **Google Sheet** qua Drive MCP |
| [`phase1/05_manual_quick.md`](phase1/05_manual_quick.md) | nhánh thay thế | Requirement đã RÕ và chỉ cần bộ TC **chạy tay** nhanh — KHÔNG nhắm automation. Requirement còn mơ hồ hoặc cần TC cho automation thì **đừng** dùng nhánh này |
| [`phase1/06_cross_module.md`](phase1/06_cross_module.md) | khi cần | Scope chạm nhiều module/hệ thống, cần ma trận tổ hợp (skill `combinatorial_matrix` cũng gọi file này) |

**Chi tiết từng bước** nằm ở [`.agent/workflows/phase1_generate_tc.md`](../.agent/workflows/phase1_generate_tc.md), gồm khuôn mẫu output, Coverage Map, Precondition Execution Matrix và capability-request. Đó là file tổng quan, bên trong liệt kê đủ step `phase1_01` đến `phase1_04`.

Riêng [`phase1_00_scope_planning.md`](../.agent/workflows/phase1_00_scope_planning.md) dùng khi cần khoanh scope và chấm risk trước. Thứ tự bước cùng lệnh gate thì lấy ở ngay file này.

## Gate bắt buộc chạy trong Phase 1

Trước đây các lệnh này **chỉ nằm trong `.agent/workflows/phase1_*`** mà file điểm-vào này không trỏ tới ⇒ ai theo đúng `run_phase1` thì không bao giờ chạy chúng. Luôn truyền `TASK_ENV=profiles/<TASK_KEY>/task.env`.

| Khi nào | Lệnh | Nó chặn/sinh ra gì |
|---|---|---|
| **Ngay sau khi kéo tài liệu về, TRƯỚC khi đọc** | `npm run docs:budget` (thêm `--contract` nếu có file >25k) | Đo từng tài liệu → đọc trực tiếp / chỉ mục cần / **giao subagent trích**. Bắt luôn 2 bẫy đo được thật: tài liệu có **nhiều bản** (đọc bản dư = tốn ~670k token vô ích) và **bản cũ nhỏ hơn hẳn bản mới = bản THIẾU nội dung** (đọc nó là đọc thiếu spec) |
| **Đầu phase, TRƯỚC khi sinh case** | `npm run scope:anchor:init` → điền `requirements/scope_inventory.md` | **Neo MẪU SỐ trước, sinh case sau.** Mỗi mục phạm vi kèm nguồn (file#anchor). Không có danh mục thì mọi con số coverage về sau là % của một mẫu số do chính agent đặt ra |
| Đầu phase, trước khi phân tích | `npm run risk` | Risk register theo module — quyết định độ sâu test (RBT). Không có thì gen dàn đều, chỗ rủi ro cao bị test nông |
| Khi chuẩn bị context | `npm run domain:check` · `npm run system:check` | Đối chiếu business rule + bản đồ hệ thống đã xác nhận trong `knowledge/` — đây là nguồn oracle độc lập, tra trước để không suy oracle từ app (tautology) |
| Sau khi QA duyệt Excel | Agent `search_files` → `create_file`/`update_file` qua Drive MCP | Đẩy TC lên Google Sheet. **Luôn review nội dung `.xlsx` local trước khi ghi đè**; chi tiết ở `phase1/04_auto_publish_backlog.md` |
| Ngay sau khi export Excel (bước 7) | tự chạy trong `md_to_xlsx` | **`design_gate` (G5)** CHẶN nếu thiếu cột canonical / rỗng ô lõi / bộ có case hiển thị mà thiếu `ui_catalog.json` |
| Sau export | `npm run design:gate` | Chạy tay khi muốn soi trước lúc convert |
| **Ngay khi có bộ testcase** | `npm run domain:trace-back` → sửa xong thì `npm run domain:trace-back -- --apply` | **Chiều TC→rule** (trước đây KHÔNG gì kiểm): case mang tag cần-oracle (`[Calc]/[BEData]/[Display]/[Security]/[Guard]`) mà không trỏ `[BR-…]`/`[SM-…]` → cảnh báo "expected lấy từ đâu?"; trỏ id không tồn tại → "oracle ma"; `--apply` **tự append `covered_by`**. Đo: bộ 530 hiện tại **0/530** case trỏ rule dù §12 đã yêu cầu từ lâu |
| **Ngay khi có bộ testcase, TRƯỚC khi QA duyệt** | `npm run dim:coverage` → khai `requirements/dimension_manifest.json` → `npm run dim:coverage -- --enforce` | **CHẶN nếu thiếu chiều coverage** (§3–§17) mà manifest khai `required`. Đây là gate duy nhất kiểm 15 chiều — `design_gate` KHÔNG kiểm chiều nào. Điều kiện: case phải mang **tag chiều** (§0b); chưa có tag thì gate tự từ chối chặn thay vì báo oan |
| Sau export | `npm run risk:gate` | Đối chiếu độ sâu testcase với `depthPolicy` theo band rủi ro |
| **Ngay khi có bộ testcase** | `npm run bugs:checklist` | Error Guessing từ **bug đã từng xảy ra** ở module này (`knowledge/bugs/`). Bug lặp lại là bug rẻ nhất để bắt; không tra kho thì mỗi sprint lại vấp đúng chỗ cũ |
| **Sau khi có bộ testcase + đã trích spec** | `npm run spec:gap` (thêm `--enforce` khi có `catalog_bindings.json`) | **Chiều ngược spec→case**: khối/field tài liệu (hoặc build) NÊU mà bộ case chưa phủ. `--enforce` chỉ chặn khi có **khối build hoàn toàn chưa được khai** (vùng mù thật); field lẻ mọc thêm ⇒ cảnh báo, vì tài liệu chậm cập nhật không phải vùng mù |
| Sau export | `npm run trace:matrix` | Sinh `reports/traceability-matrix.md` — REQ ↔ TC, lộ requirement chưa có case nào |
| Trước khi kết thúc phase | `npm run gate:policy` | Rule/skill/prompt mồ côi, lệch tên, lệch danh sách đuôi evidence |
| **Ngay khi có bộ testcase + đã viết summary** | `npm run scope:anchor:enforce` | **CHẶN khi mẫu số chưa neo**: `dimension_manifest.json` thiếu `reviewed_by` (agent tự khai `n/a` = tự thu hẹp phạm vi) · "Tổng requirement in-scope" không khớp `scope_inventory.md` · `ui_catalog` lấy từ build mà không đánh `"oracle": "OBSERVATION"` · **số case đổi ≥10% so lượt trước mà danh mục KHÔNG đổi** (⇒ lượt trước sinh thiếu, phải ghi `knowledge/bugs/`) · kết luận `PASS` khi chưa neo. `--record` ghi sổ để lượt sau so được |
| **Trước khi finalize — gate gộp CÓ RĂNG** | `npm run self-review:enforce -- --task <TASK_KEY>` | Gộp preflight + design + row-quality + **neo mẫu số** → **exit 1 khi còn CHẶN**. Trước đây câu này **chỉ có ở `run_phase2`**, nên Phase 1 không có gate gộp nào có răng: đó là lý do một bộ case kết luận được `CONDITIONAL PASS` trong khi mẫu số coverage do chính nó tự đặt |
| Khi bộ case có chiều **hiển thị/UI** | `TASK_ENV=... npm run ui:conformance` | Đối chiếu **field thật trên build** với danh mục màn (`ui_catalog.json`) — lộ field bịa, field thiếu, nhãn lệch. Đây là thứ duy nhất kiểm "case hiển thị có khớp màn thật" trước khi ai đó execute |
| **Cuối phase — BÁO CÁO ĐÃ HỌC GÌ** | `npm run learn:report -- --task <TASK_KEY> --write` | Sinh `reports/learning-summary.md` (đã học + CHƯA học). Phase 1 học ít record hơn Phase 2 nhưng **đúng loại quý nhất**: câu trả lời của BA sau Ambiguity Gate là business truth vừa được xác nhận |

> 🗣️ **BẮT BUỘC: kể lại NGAY TRONG HỘI THOẠI, đừng chỉ ghi file.** Cuối phase nói thẳng **ba phần**:
> 1. **Đã học gì.** Record mới hoặc cập nhật trong `knowledge/**`, đặc biệt `domain/` và `system/` sinh từ
>    câu trả lời BA. Mỗi câu Blocking đã RESOLVED phải để lại record, và `self_review` kiểm từng câu.
>    Kèm cả **memory vừa lưu hoặc sửa, và lý do lưu**.
> 2. **Đã sửa gì** — thay đổi thật, có số đo. Không "đã cải thiện", "đã tối ưu".
> 3. **Còn thiếu gì.** Nêu lỗ hổng **đo được**: câu hỏi BA còn `PENDING` kèm phần scope bị chặn theo, rule
>    có `covered_by` rỗng, requirement chưa có TC nào (xem `traceability-matrix.md`), màn chưa khai trong
>    `ui_catalog.json`.
>
> Nêu cả phần "còn thiếu" dù nó làm báo cáo trông kém đẹp — **đó mới là phần user dùng để quyết việc tiếp theo**.
> File chỉ là chỗ LƯU, không phải cách THÔNG BÁO.

## Prompt mẫu để chạy

> Copy khối dưới đây, thay placeholder rồi gửi cho agent.

```text
Chạy Phase 1 cho module/task sau: collect context và sinh/update testcases.

Project:
- Project là toàn bộ LMS + Operations automation workspace.
- Phạm vi hiện tại là module/task/feature được cung cấp bên dưới.
- Backlog key hoặc module name chỉ là task/feature scope, không phải tên project.

Phạm vi:
- Module/Feature: [MODULE_FEATURE]
- Task key/scope folder: [TASK_KEY]
- Site liên quan: [LMS / Operations / LMS + Operations]

Input links: (lấy từ profile của task — profiles/[TASK_KEY].env; chỉ điền trực tiếp ở đây khi muốn override profile)
- Backlog Epic: [BACKLOG_EPIC_URL]
- Backlog Story/Task: [BACKLOG_STORY_URL]
- tài liệu nguồn Requirement: [REQUIREMENT_DOC]
- Figma: [FIGMA_FILE_URL]
- LMS URL: [LMS_BASE_URL]
- Operations URL: [OPS_BASE_URL]
- LMS Swagger URL: [LMS_SWAGGER_URL]
- Operations Swagger URL: [OPS_SWAGGER_URL]
- Other docs/files: [OTHER_DOCS hoặc N/A]

Run profile (chạy song song an toàn):
- Mỗi task dùng profile riêng profiles/[TASK_KEY]/task.env chứa GIÁ TRỊ ĐỘNG (scope, link cụ thể của task, tài khoản OPS/LMS theo task, `GOOGLE_SHEET_URL`); giá trị TĨNH (Figma/tài liệu nguồn/Backlog/HubSpot key + base URL) giữ ở .env chung.
- Truyền TASK_ENV=profiles/[TASK_KEY]/task.env cho MỌI command; không đọc TASK_KEY từ .env chung, không sửa .env/.env.local chung.
- Chi tiết: QUICKSTART.md (mục Parallel Story Safety).

Context/config:
- Đọc `.agent/config/project_context.md` nếu có.
- Đọc `.env.example` để biết env keys cần có.
- Credential/token thật lấy từ `.env.local` hoặc `.env`, không ghi vào markdown/log/report.
- Backlog testcase publish: KHÔNG publish trong prompt này. Auto Publish Backlog là step riêng trong phạm vi Phase 1, chỉ chạy bằng `prompt_templates/phase1/04_auto_publish_backlog.md` sau khi QA xác nhận Excel.
- Công cụ test management nếu chạy step publish riêng: **Google Sheet** qua Drive MCP (agent search_files/create_file/update_file, không cần token — dùng MCP đã kết nối sẵn trong phiên chat).
- Step publish (04) đẩy lên **Google Sheet**: file `.xlsx` do `md_to_xlsx.js` xuất ra chính là nội dung Sheet (dashboard + 1 sheet/nhóm chức năng) — không ánh xạ field riêng, upload nguyên file.
- Testcase cleanup: KHÔNG cleanup trong prompt này. Sheet tự phản ánh đúng Excel ở mỗi lần re-publish (ghi đè toàn workbook) — không cần bước lifecycle riêng. Nếu cần unlink Test↔Story/Task trên Backlog, xem `partial-rerun/run_testcase_cleanup.md`.
- Tất cả Markdown/report/task log phải dùng tiếng Việt chuẩn có dấu, encoding UTF-8. Không dùng tiếng Việt không dấu và không để ký tự lỗi encoding/mojibake.

Parallel story safety:
- Trước khi ghi file hoặc chạy command, bắt buộc echo scope:
  `PROJECT_OUTPUT_DIR`, `TASK_KEY`, `TASK_OUTPUT_DIR`, `RUN_ID` nếu có, và phase đang chạy.
- Nếu yêu cầu hiện tại của user không nêu rõ `TASK_KEY`, không dùng `TASK_KEY` từ `.env` hoặc context cũ để chạy; phải hỏi lại.
- Nếu `TASK_KEY` echo ra không khớp task user yêu cầu, dừng ngay; không ghi file/chạy lệnh.
- Không sửa `.env` hoặc `.env.local` chung khi có session khác đang chạy.
- Ưu tiên truyền `PROJECT_OUTPUT_DIR` và `TASK_KEY` qua env/CLI từng command.
- Không chạy Phase 1 song song cùng một `TASK_KEY` vì Phase 1 ghi requirement/testcase/report chính.
- Nếu cần thử nhiều hướng cho cùng story, dùng task branch/suffix riêng, ví dụ `<TASK_KEY>-draft-a`, rồi Human Review trước khi merge về task chính.

Nguyên tắc tiết kiệm token:
- Ưu tiên đọc link/file theo đường dẫn và lưu raw artifacts vào `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/requirements/`; không paste toàn bộ Backlog/tài liệu nguồn/Figma/Swagger vào chat hoặc report.
- Nếu đã có requirement artifact, snapshot hoặc `reports/phase1-summary.md` local, dùng làm nguồn chính và chỉ đọc raw docs khi summary chưa đủ.
- Chỉ mở section/anchor/page/API path liên quan tới `[MODULE_FEATURE]`; không đọc toàn bộ tài liệu lớn nếu scope chỉ là một module/flow.
- Không đọc các file `run_phase*_example_*` trừ khi user yêu cầu rõ hoặc đang cần so sánh example.
- Final cho user chỉ tóm tắt output path, tổng testcase, coverage, blocker; chi tiết đầy đủ nằm trong file report local.

Nguyên tắc chất lượng khi tối ưu:
- Tiết kiệm token không được làm giảm coverage, độ chi tiết testcase, độ đúng của expected result hoặc khả năng execute ở Phase 2.
- Nếu summary/cache/local artifact không đủ để xác nhận rule, field, permission, API contract hoặc expected result, phải đọc thêm nguồn gốc liên quan thay vì đoán.
- Không được bỏ qua source quan trọng chỉ để giảm số file đọc.
- Output ít token với user, nhưng file Markdown/Excel/report local phải đầy đủ, rõ ràng và có thể review độc lập.
- Nếu có trade-off giữa tiết kiệm token và chất lượng testcase, ưu tiên chất lượng testcase.

Output:
- Output root bắt buộc lấy từ `PROJECT_OUTPUT_DIR`.
- Nếu không có `PROJECT_OUTPUT_DIR`, dừng và yêu cầu user cung cấp; không dùng fallback hardcode.
- Nếu không có `TASK_KEY`, dừng và yêu cầu user cung cấp; không dùng fallback từ `BACKLOG_STORY_KEY` hoặc task cũ.
- Output cho scope này phải nằm trong:
  `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/`

Phase 1 tasks:
1. Fetch/read Backlog, tài liệu nguồn, Figma, Swagger/OpenAPI và file local nếu được cung cấp. **Đọc THẬT KỸ, KHÔNG qua loa** phần trong scope — mọi mục/bảng/ghi chú/footnote/comment liên quan; bóc đủ AC/rule/validation/enum/state/edge/phân quyền/biên; đối chiếu chéo nguồn và nêu mâu thuẫn (raw content lưu local, không dán vào prompt; phần ngoài scope thì lướt). Canonical: `RULE_GLOBAL.md` §"Analysis & Ambiguity Gate".
1b. **Ambiguity Gate (gate cứng):** sau khi đọc nguồn, rà mâu thuẫn/thiếu rule bắt buộc/expected không rõ. Nếu có điểm mơ hồ Critical/High → xuất Q&A đánh số + assumption mặc định ra `reports/phase1-clarifications.md`, ghi `AMBIGUITY_GATE: PENDING` vào `task.md` và DỪNG chờ QA/BA. KHÔNG sinh testcase khi gate PENDING. Chi tiết: `.agent/workflows/phase1_01_prepare_context.md` bước 7.
2. Phân tích requirement, UI design, API docs và context dự án.
2b. **UI Conformance Catalog (BẮT BUỘC nếu scope có màn UI)**: với mỗi màn/bảng/danh sách/field trong scope, trích **NGUYÊN VĂN từ FS/Figma** ra `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/requirements/ui_catalog.md` — mỗi phần tử → (tên cột/label chính xác, format dữ liệu, số cột + thứ tự, field bắt buộc, empty-state/placeholder/label nút/tiêu đề, token style nếu có Figma). Đây là **nguồn-sự-thật cho expected của mọi case hiển thị** ở cả Phase 1 (sinh case) lẫn Phase 2 (assert). CẤM lấy expected hiển thị từ build đang chạy (chống oracle tautological). Chi tiết ở [`phase1/dimensions/12_display.md`](phase1/dimensions/12_display.md).
3. Sinh hoặc cập nhật manual testcases.
4. Bao gồm UI, API và E2E testcases khi phù hợp.
5. Với tiền điều kiện phức tạp: **TRA `knowledge/setup_recipes/` TRƯỚC khi tự nghĩ cách dựng** — `npm run howto:find -- "<mô tả precondition>"`. Recipe cũ mang `applies_when` (điều kiện áp được) + `pitfalls` (thứ chỉ biết sau khi vấp) + `used_by` (TC đã dựng thành công = bằng chứng còn dùng được) ⇒ đọc rồi TỰ quyết tái dùng. Không kết quả **không** nghĩa là không dựng được, chỉ nghĩa là chưa ai ghi lại — dựng xong thì ghi recipe mới (skill `precondition_setup_planner`). Sau đó mới đề xuất setup qua UI/API public-business contract, fixture hoặc test hook/sandbox nếu có; không đề xuất DB để DỰNG state hoặc đọc toàn bộ source backend. `Setup Verification` có thể dùng read-only UAT DB qua guarded client (read-only, chỉ SELECT) khi API/UI không expose state.
6. Lưu testcase Markdown output dưới:
   `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/test-cases/`
7. Export mỗi file testcase Markdown có bảng `TC ID` sang Excel `.xlsx` cùng thư mục, cùng basename, bằng command:
   `node scripts/convert_excel/md_to_xlsx.js <testcase.md> <testcase.xlsx>`
   Ví dụ:
   `node scripts/convert_excel/md_to_xlsx.js <PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/test-cases/[TESTCASE_BASENAME].md <PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/test-cases/[TESTCASE_BASENAME].xlsx`
8. Coi Excel đã export là source of truth khi gen/publish (Phase 2 execute mặc định từ Google Sheet) và chuẩn bị trạng thái `Pending QA confirmation` cho step Auto Publish testcase.
   - Không publish Backlog trong prompt này.
   - Sau khi QA xác nhận Excel/testcase đạt, chạy prompt riêng:
     `prompt_templates/phase1/04_auto_publish_backlog.md`
   - Excel là source-of-truth khi GEN/PUBLISH. Phase 2 **execute mặc định đọc từ Google Sheet** → **publish (step 04) là bước cần trước Phase 2**; Phase 2 tự tải Sheet về canonical local qua Drive MCP để chạy. Muốn chạy thuần Excel local thì đặt `TESTCASE_SOURCE=excel`.
   - Nếu Excel thay đổi sau khi đã publish, chỉ cần re-publish (ghi đè Sheet) — không cần lifecycle riêng như công cụ test-management cũ; xem `partial-rerun/run_testcase_cleanup.md` nếu chỉ cần unlink Backlog.
9. Lưu requirement/context artifacts dưới:
   `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/requirements/`
10. Cập nhật:
   `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/task.md`
   Trong `task.md`, ghi rõ đường dẫn Markdown testcase, Excel testcase đã export và trạng thái `Backlog testcase publish: Pending QA confirmation`.
11. Sinh/cập nhật Phase 1 report dưới:
   `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/reports/phase1-summary.md`
   Report phải đầy đủ và có thể review độc lập, bao gồm:
   - Tổng số testcase đã gen/cập nhật.
   - Số testcase theo loại: Positive / Negative / Boundary / Edge.
   - Số testcase theo nhóm chức năng: lấy động từ phần trước dấu `/` trong cột `Module`; không hardcode danh sách nhóm của một task cụ thể.
   - Report phải liệt kê toàn bộ nhóm thực tế xuất hiện trong testcase. Ví dụ CRUD có thể có `Xem danh sách`, `Tạo`, `Sửa`, `Xóa`; domain khác có thể có `Đăng nhập`, `Thanh toán`, `Báo cáo`, `Thông báo`,...
   - Số testcase theo layer/site: UI, API, E2E và các app/site thực tế trong scope nếu xác định được.
   - Coverage matrix tóm tắt requirement/business rule/API endpoint -> TC ID.
   - Review bộ testcase theo 2 góc độ `Coverage` và `Quality/Risk`, áp dụng quality gate ở [`phase1/02b_output_format.md`](phase1/02b_output_format.md) (trước đây câu này ghi "section Phase 1 report **bên dưới**" — con trỏ HỎNG từ trước khi tách, vì `run_phase1` không có mục report nào) và hướng dẫn chi tiết ở `prompt_templates/phase1/02_gen_testcases.md`.
   - Requirement Coverage phải tính theo công thức:
     `Requirement Coverage = Covered Requirements / Total In-scope Requirements * 100%`
   - Requirement chỉ được tính là covered nếu có testcase trace rõ ràng, assertion đúng behavior, và không bị skip nếu đã có execution result.
   - Phân loại từng requirement/gap theo risk: `Critical`, `High`, `Medium`, `Low`.
   - Không dùng công thức đếm gap kiểu `covered / (covered + gaps)` để thay thế coverage requirement.
   - Không kết luận `PASS` nếu còn open gap Critical/High, dù coverage tổng >= 80%.
   - Đánh giá testcase quality: trace requirement, step executable, expected cụ thể, assertion đúng business rule, phụ thuộc data/env, flaky risk, duplicate/overlap, skip/fail do script/setup.
   - Report bắt buộc có đúng các section:
     `### Coverage Summary`
     `| Metric | Value | Comment |`
     `### Risk-based Gate`
     `| Condition | Status | Reason |`
     `### High/Critical Gaps`
     `| Gap | Risk | Impact | Required Action | Gate Blocking |`
     `### Testcase Quality Issues`
     `| Testcase | Issue | Severity | Recommendation |`
     `### Final Decision`
   - `Final Decision` chỉ được dùng một trong: `PASS`, `CONDITIONAL PASS`, `FAIL`, `BLOCKED`.
   - Chỉ kết luận `PASS` khi coverage >= 80%, core/high-risk flows được cover đầy đủ, không còn open question Critical/High, không có testcase quan trọng bị skip, assertion rõ ràng, và negative/permission/rollback/error case được cover nếu nằm trong scope.
   - Coverage gaps, assumptions, rủi ro còn lại và testcase đề xuất bổ sung nếu có.
12. Cập nhật `task.md` để ghi rõ đường dẫn report Phase 1 và trạng thái chờ QA xác nhận trước khi publish Backlog testcase.

Yêu cầu testcase output:
- Mỗi testcase phải có precondition, test data, steps và expected result rõ ràng.
- Cột `Tiền điều kiện` phải dùng định dạng `[<method>] <mô tả trạng thái>` (nhiều precondition tách bằng `<br>`), method ∈ `api`|`factory`|`test_hook`|`ui`|`pre_existing`|`manual` — KHÔNG có `db`.
  - Cùng một trạng thái phải dùng **mô tả giống hệt và cùng method** ở mọi testcase — đây là thứ thay cho dedup của mã cũ; `design:gate` chặn cell thiếu tag và cảnh báo khi một trạng thái có 2 cách dựng.
- Xác định site/layer của từng testcase: [SITES] / UI / API / E2E.
- Xác định loại testcase: UI / API / E2E.
- Phân nhóm rõ từng testcase theo nhóm chính là business flow trong cột `Module` với format:
  `[Nhóm chức năng] / [User Story hoặc màn hình/API/flow cụ thể]`.
  Nhóm chức năng phải suy ra từ domain/scope và ưu tiên business flow, không phải layer kỹ thuật. Với CRUD có thể dùng `Xem danh sách`, `Tạo`, `Sửa`, `Xóa`; với API/E2E/permission gắn với flow cụ thể thì vẫn đặt vào nhóm flow đó, ví dụ `Tạo / API POST ...`, `Tạo / App 1 tạo bản ghi -> App 2 sync`, `Sửa / Permission role teacher cannot edit`. Chỉ dùng `API`, `E2E/Cross-app`, `Permission/Security` làm nhóm chính khi testcase không thuộc business flow cụ thể nào.
- Không thêm cột label vào bảng testcase. Nhóm chức năng thể hiện bằng **sheet riêng** trong workbook, TC ID ở cột `ID_TC`.
- Sau bảng testcase, thêm section `## Phân nhóm testcase` mapping nhóm chức năng -> phạm vi -> TC ID -> tổng.
- API testcase phải reference method + endpoint + expected status/body.
- Phải vét cạn UI edge/boundary theo các dimension ở [`phase1/dimensions/`](phase1/dimensions/) (mục 3 Field-Level mở rộng: Date/Month, Time HH:mm, Computed/derived, File upload boundary; mục 7 Export/Import file output; mục 8 Resilience/Concurrency; mục 9 Side-effect/Notification; mục 10 Cross-layer guard; mục 11 Design/Visual compliance — token Figma; **mục 12 Display/Field Conformance — tên cột exact, format từng field, số cột + thứ tự, field bắt buộc, empty-state; expected trích từ `ui_catalog.md`/tài liệu, KHÔNG từ build**). Dimension không áp dụng phải ghi `N/A + lý do` trong Coverage Gaps.
- File Excel phải được tạo thành công sau khi file Markdown hoàn tất; Excel phải có cột/sheet phân nhóm để lọc theo các nhóm thực tế trong cột `Module`. Mỗi nhóm chức năng nên là một sheet riêng — tên sheet sẽ trở thành subfolder Test Repository khi publish (bỏ qua sheet `Summary`, `Test Cases`); catalog precondition đặt ở sheet `Setup Contracts`. Nếu thiếu dependency `exceljs`, báo rõ blocker và không coi Phase 1 là hoàn tất.
- Sau khi Excel tạo thành công, không publish Backlog trong prompt này. Ghi trạng thái `Pending QA confirmation`; step publish thật chạy bằng prompt riêng sau khi QA xác nhận.
- Phase 1 report phải được tạo/cập nhật sau khi Markdown và Excel testcase hoàn tất; không coi Phase 1 hoàn tất nếu thiếu report này.
- `task.md`, testcase Markdown và Phase 1 report phải viết bằng tiếng Việt chuẩn có dấu; technical terms, endpoint, command, enum/status có thể giữ nguyên tiếng Anh.
- Không execute automation trong Phase 1.

Điều kiện dừng:
- **Dừng sớm nếu Ambiguity Gate PENDING**: nếu có mơ hồ Critical/High, dừng ngay sau khi xuất `reports/phase1-clarifications.md` + `AMBIGUITY_GATE: PENDING`; KHÔNG sinh testcase cho tới khi QA/BA resolve.
- Dừng sau khi sinh/cập nhật testcase Markdown, export Excel, sinh/cập nhật Phase 1 report và cập nhật task log.
- Chờ review trước khi chuyển Phase 2.
- Trước khi dừng, tự kiểm tra: testcase có đủ precondition/data/steps/expected, coverage chính >= 80% hoặc có gap rõ, không còn gap Critical/High nếu muốn kết luận PASS, Excel mở được và là source of truth khi gen/publish (Phase 2 execute mặc định từ Google Sheet), publish testcase đang ở trạng thái `Pending QA confirmation`, report/task log tiếng Việt chuẩn có dấu, không có placeholder hoặc encoding lỗi.
- Trước khi dừng, chạy `Self-check vét cạn biên` (mục 18 — vẫn ở [`phase1/02_gen_testcases.md`](phase1/02_gen_testcases.md); mục 12–17 đã dời sang [`phase1/dimensions/`](phase1/dimensions/)): mỗi input đủ EP/BVA; filter/list có biên ngày/tháng/năm nhuận; export verify cấu trúc file + mapping + empty + dataset lớn; side-effect có negative; UI guard có cross-layer check; entity có status có đủ ma trận status x action; computed field có TC derivation + biên; nếu có Figma thì component chính có TC design compliance (token màu/font/radius/spacing/alignment); **mỗi màn có bảng/field có case Display Conformance (tên cột exact + format + số cột/thứ tự + field bắt buộc + empty-state, expected từ `ui_catalog.md`/tài liệu — mục 12)**; **logic/tính toán có oracle giá trị cụ thể + so khớp/delta dữ liệu (mục 13); field trống nghi ngờ đối chiếu response BE, phân biệt null/rỗng/thiếu/0 (mục 14); IDOR/privilege/injection/mass-assignment/data-exposure (mục 15); SLA/large-dataset/concurrent khi có ngưỡng (mục 16); change impact: story đụng bề mặt dùng chung (data/endpoint/component/rule/status/permission) → regression smoke cho feature bị ảnh hưởng + backward-compat, cái nghi ghi `QA confirm` (mục 17)**. Mục thiếu phải ghi vào Coverage Gaps.

Extra instruction:
- [ANY_EXTRA_REQUEST hoặc N/A]
```
