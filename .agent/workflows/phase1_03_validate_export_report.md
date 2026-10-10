# Phase 1 - Bước 3: Validate, Export Excel Và Report

> Kiểm tra chất lượng testcase, export Excel và ghi đánh giá coverage/risk.

## Mục Đích

Đảm bảo testcase không chỉ nhiều về số lượng mà còn đạt chất lượng kiểm thử, có coverage rõ và đủ artifact để Phase 2 chạy được.

## Giao việc cho subagent

| Bước | Giao cho | Đầu vào | Chờ đầu ra |
| --- | --- | --- | --- |
| Convert Markdown sang Excel, và ghi kết quả vào cột `Result` | `excel-convert` | đường dẫn `.md`, `.xlsx`, và `testcase-status.json` nếu có | đường dẫn file đã ghi · số dòng · nguyên văn cảnh báo của script |

Nó **chỉ ghi cột `Result`** và **không tự upload lên Drive** — đẩy lên Sheet là việc của luồng chính, sau
khi người xem lại bản merge. Xác minh hợp đồng: `docs/v2.4.1/AGENTS_VERIFY.md`.

## Bó gate cuối phase

`npm run phase1:check -- --task <TASK_KEY>` chạy preflight, scope:anchor, dim:coverage và self-review
trong một lượt. Nó gọi đúng script gốc rồi gom kết quả, không tự kiểm gì.

## Workflow

1. Validate từng testcase:
   - Đủ 11 cột.
   - Step rõ và executable.
   - Expected result cụ thể.
   - Test data không placeholder.
   - Trace được requirement.
   - Assertion intent rõ.
   - Mỗi cell `Tiền điều kiện` có tag `[<method>]` hợp lệ + mô tả trạng thái; một trạng thái không được có 2 cách dựng.
   - **Ép bằng máy (G5 design_gate):** structural (đủ cột canonical) + completeness (ô lõi Module/Trường hợp/Các bước/Ưu tiên/Mức độ rủi ro không rỗng) = **CHẶN**. Chạy `npm run design:gate -- --dir <test-cases/>` (thêm `--with-rows` để check luôn row-quality/oracle); TỰ CHẠY khi convert (Bước 4). Dimension/depth per-module: Bước 6a risk gate.
2. Review coverage:
   - Requirement Coverage = Covered Requirements / Total In-scope Requirements * 100%.
   - Requirement chỉ tính covered nếu có testcase trace rõ, assertion đúng behavior và không skip.
3. Review risk gate:
   - Critical/High gap còn mở thì không kết luận PASS.
   - Core/high-risk flow phải cover đầy đủ.
4. Export Excel cho từng file testcase Markdown:
   ```powershell
   node scripts/convert_excel/md_to_xlsx.js <testcase.md> <testcase.xlsx>
   ```
   - **Design gate (G5) và gate gen-testcase TỰ CHẠY khi convert.**
     (a) `design_gate` CHẶN nếu thiếu cột canonical hoặc rỗng ô lõi.
     (b) Gate gen-testcase CHẶN, tức không tạo xlsx, nếu "Kết quả mong đợi" không khớp số bước, gộp range `1-2.`, ghi trơ "thành công" hay "đúng", hoặc oracle rỗng. Riêng `;`-nhồi-ý và tautology thì chỉ cảnh báo.
     **Gate CHẶN thì tự sửa Markdown rồi convert lại tới khi PASS, không chờ user nhắc.**
     Kiểm trước bằng `npm run design:gate -- --dir <test-cases/> --with-rows`.
5. Ghi trạng thái `Backlog testcase publish: Pending QA confirmation` trong `task.md`.
   - Không publish Backlog trong bước này.
   - Step publish riêng là [phase1_04_auto_publish_backlog.md](phase1_04_auto_publish_backlog.md), chỉ chạy sau khi QA xác nhận Excel.
6. **Ma trận traceability (F8)**: chạy `npm run trace:matrix` (hoặc `node scripts/qa/traceability_matrix.js`) → sinh `reports/traceability-matrix.{md,csv}` join REQ→TC→AUTO→EXEC→BUG từ artifact task; đánh dấu TC **chưa publish / chưa execute**. Ở Phase 1 ma trận là bản coverage (TC+publish); refresh lại sau Phase 2 để có EXEC/BUG đầy đủ.
7. Cập nhật `snapshot_context.json`, `phase1-summary.md` và `task.md`.
6a. **Risk gate (RBT depth):** chạy `TASK_ENV=... npm run risk:gate` (skill `risk_scorer`) đối chiếu testcase với `depthPolicy` theo band. Module **High risk** thiếu độ sâu → CRITICAL = **Critical gap → không PASS** coverage gate (đồng bộ Decision Rules `tc_validator`). Mặc định cảnh báo; `risk:gate:enforce` chặn CI. QA override band / `gate_waiver` trong `risk-register.json` cho ngoại lệ có lý do.
6b. **Chiều coverage (BẮT BUỘC):** `TASK_ENV=... npm run dim:coverage -- --enforce` — thiếu chiều đã khai `required` = CHẶN.
   Đây là thứ duy nhất đo "bộ case có đầy đủ theo chiều" chứ không chỉ đếm số case; bỏ qua thì thiếu-chiều không bao giờ lộ ra.
6c. **Error Guessing từ bug lịch sử:** `TASK_ENV=... npm run bugs:checklist` — đối chiếu bộ case với bug đã từng xảy ra ở module này.
   Bug lặp lại là bug rẻ nhất để bắt; không tra kho thì mỗi sprint lại vấp lại.
6e. **Chất lượng từng case (rubric 8 tiêu chí):** `TASK_ENV=... npm run tc:review:enforce` (skill `tc_reviewer`).
   Sáu tiêu chí máy chấm đủ, hai tiêu chí máy chỉ chấm một phần và gắn cờ `AI` — **không được coi cờ đó là đạt**.
   Các gate trên đo bộ case có ĐỦ không; gate này đo từng case có DÙNG ĐƯỢC không. Thiếu nó thì một bộ phủ đủ chiều
   vẫn có thể gồm toàn case mơ hồ, và không gì nói ra điều đó. Báo cáo ở `reports/tc-review.md`.
6d. **Chiều ngược (spec → case):** `TASK_ENV=... npm run spec:gap` — thứ tài liệu NÊU mà bộ case chưa phủ.
   Cả 3 lệnh chỉ đọc artefact local, không gọi mạng, nên chạy được cả khi offline.
6b. Sinh **Traceability Matrix** tường minh `<TASK_OUTPUT_DIR>/reports/traceability-matrix.md` — bảng `| REQ-ID | Requirement/AC | Risk | TC ID (trace) | Status |` (1 dòng/requirement in-scope; `Status` ∈ `Covered`/`Partial`/`Gap`). Hỗ trợ Gap Analysis: requirement `Gap`/`Partial` mức Critical/High phải khớp `### High/Critical Gaps` trong summary. Đây là artifact riêng, chi tiết hơn Coverage Matrix tóm tắt trong summary.
7. Nếu `### Precondition Execution Matrix` còn dòng `Needs hook`/`Manual-only`, sinh `reports/capability-request.md` (handoff Dev/BE/DevOps): gom capability còn thiếu (loại `test_hook`/`account`/`sandbox`/`api`/`config`, endpoint/tên đề xuất, PRE + TC bị chặn, owner). KHÔNG dùng DB để thay thế. Format chi tiết ở [prompt_templates/phase1/02_gen_testcases.md](../../prompt_templates/phase1/02_gen_testcases.md); contract test hook ở [tests/support/setup/hooks/README.md](../../tests/support/setup/hooks/README.md).

## Quality Gate

| Điều kiện | Bắt buộc |
|---|---|
| Overall requirement coverage >= 80% | Có |
| Core/high-risk flow covered | Có |
| Không còn Critical/High open question | Có |
| Không có testcase quan trọng bị skip | Có |
| Negative/security/rollback case trong scope được cover | Có |
| Mọi precondition có tag `[<method>]` đủ để Phase 2 dựng (chi tiết ở `### Setup Readiness`) | `design:gate` chặn cell thiếu tag |
| Phase 1 summary có `### Precondition Execution Matrix` (1 dòng/TC trong scope) | Có |
| Nếu matrix còn `Needs hook`/`Manual-only` thì `reports/capability-request.md` tồn tại | Có (nếu applicable) |

## Outputs

| Output | Vị trí |
|---|---|
| Testcase Markdown final | `<TASK_OUTPUT_DIR>/test-cases/` |
| Testcase Excel | Cùng thư mục testcase |
| Coverage/Risk summary | `<TASK_OUTPUT_DIR>/reports/phase1-summary.md` |
| Traceability matrix (REQ × TC × Risk × Status) | `<TASK_OUTPUT_DIR>/reports/traceability-matrix.md` |
| Capability / Test-Hook Request | `<TASK_OUTPUT_DIR>/reports/capability-request.md` (khi còn `Needs hook`/`Manual-only`) |
| Snapshot context | `<TASK_OUTPUT_DIR>/test-cases/snapshot_context.json` |
| Task tracking | `<TASK_OUTPUT_DIR>/task.md` |
