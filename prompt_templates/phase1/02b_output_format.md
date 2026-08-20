# Phase 1 — Output cuối lượt: Summary Report + Export Excel

> Tách khỏi [`02_gen_testcases.md`](02_gen_testcases.md) ngày 14/08/2026 để bỏ **3,7k token** khỏi mọi lượt gen:
> đây là định dạng **output**, không phải luật nội dung case, nên chỉ cần nạp ở CUỐI lượt.
>
> Nội dung dưới đây giữ **nguyên văn** — đã kiểm bảo toàn từng dòng so với bản trước khi tách.
> Mở file này khi: (a) viết Phase 1 Summary Report, (b) export Excel. Cả hai đều có gate đứng sau.

## Phase 1 Summary Report bắt buộc

Sau khi lưu Markdown testcase và export Excel, bắt buộc tạo/cập nhật report riêng:

`<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/reports/phase1-summary.md`

Report phải đủ chi tiết để review chất lượng bộ testcase mà không cần đọc toàn bộ file testcase:

1. **Tổng quan Phase 1**
   - Task key / module / scope.
   - Nguồn requirement đã đọc: Jira, Confluence, Figma, Swagger, file local.
   - Đường dẫn testcase Markdown, Excel đã export và trạng thái `Jira testcase publish: Pending QA confirmation`.
2. **Thống kê testcase**
   - Tổng số testcase đã gen/cập nhật.
   - Số testcase theo loại: Positive / Negative / Boundary / Edge.
   - Số testcase theo nhóm chức năng: lấy động từ phần trước dấu `/` trong cột `Module`; không hardcode danh sách nhóm của một task cụ thể.
   - Report phải liệt kê toàn bộ nhóm thực tế xuất hiện trong testcase, ví dụ với CRUD có thể là `Xem danh sách`, `Tạo`, `Sửa`, `Xóa`; với domain khác có thể là `Đăng nhập`, `Thanh toán`, `Báo cáo`, `Thông báo`,...
   - Số testcase theo layer/site: UI, API, E2E và các app/site thực tế trong scope nếu xác định được.
   - Số testcase theo priority và risk.
3. **Đánh giá Coverage và Quality/Risk**
   - Review bộ testcase automation theo đúng protocol trong section này.
   - Xác định tổng số requirement/business rule/API behavior nằm trong scope.
   - Mapping từng requirement với TC ID tương ứng.
   - Tính coverage bằng công thức:
     `Requirement Coverage = Covered Requirements / Total In-scope Requirements * 100%`
   - Chỉ tính requirement là covered khi có testcase trace rõ ràng, assertion đúng behavior, và testcase không bị skip nếu đã có execution result.
   - Phân loại từng requirement/gap theo risk: `Critical`, `High`, `Medium`, `Low`.
   - Không dùng công thức gap đơn giản kiểu `covered / (covered + gaps)` để thay thế requirement coverage.
   - Không kết luận `PASS` nếu còn bất kỳ open gap Critical/High, dù coverage tổng >= 80%.
   - Kiểm tra chất lượng từng testcase: trace requirement, step executable, expected cụ thể, assertion đúng business rule, phụ thuộc data/env, flaky risk, duplicate/overlap, skip/fail do script/setup.
4. **Format bắt buộc cho phần review trong Phase 1 summary**
   - `### Coverage Summary`
     `| Metric | Value | Comment |`
   - `### Risk-based Gate`
     `| Condition | Status | Reason |`
   - `### High/Critical Gaps`
     `| Gap | Risk | Impact | Required Action | Gate Blocking |`
   - `### Testcase Quality Issues`
     `| Testcase | Issue | Severity | Recommendation |`
   - `### Setup Readiness`
     `| Automation Readiness | Số PRE | Số TC ảnh hưởng | Ghi chú/Blocker |`
     Thống kê tổng hợp theo `Ready` / `Needs hook` / `Manual-only`; liệt kê rõ các `PRE-NN = Needs hook` (kèm hook đề xuất) và `Manual-only` (kèm lý do) vì đây là input cho gate Phase 2.
   - `### Precondition Execution Matrix`
     `| TC ID | Precondition | Type | Setup Method | Verification | Cleanup | Readiness | Blocker |`
     BẮT BUỘC. Một dòng cho MỖI TC trong scope, suy ra bằng cách join danh sách testcase với catalog `## Setup Strategy (Hợp đồng tiền điều kiện)`:
     - `Precondition`: `PRE-NN` (kèm mô tả ngắn); nếu TC dùng nhiều precondition thì liệt kê tất cả.
     - `Type`: giá trị `Precondition Type`.
     - `Setup Method`: giá trị `Setup Strategy` (`api`/`factory`/`test_hook`/`ui`/`pre_existing`/`manual`).
     - `Verification`: giá trị `Setup Verification`.
     - `Cleanup`: giá trị `Cleanup/Rollback`.
     - `Readiness`: `Ready` / `Needs hook` / `Manual-only`.
     - `Blocker`: missing capability cụ thể nếu `Needs hook` (hook/mock/sandbox nào còn thiếu) hoặc lý do nếu `Manual-only`; để `-` nếu `Ready`.
     Mục tiêu: trước Phase 2, QA/Automation nhìn vào matrix là biết ngay case nào automatable (`Ready`), case nào cần hook (`Needs hook`), case nào blocked (`Manual-only`/có Blocker).
   - `### Final Decision`
     Kết luận chỉ dùng một trong các trạng thái: `PASS`, `CONDITIONAL PASS`, `FAIL`, `BLOCKED`.
   - `Final Decision` phải có lý do ngắn gọn và điều kiện cần làm để đạt chuẩn nếu chưa `PASS`.
5. **Quality Gate**
   - Chỉ kết luận `PASS` khi thỏa tất cả:
     - Overall requirement coverage >= 80%.
     - Core/high-risk flows được cover đầy đủ.
     - Không còn open question Critical/High.
     - Không có testcase quan trọng bị skip.
     - Testcase có assertion rõ ràng, không chỉ kiểm tra UI/API response chung chung.
     - Negative case, permission/security case, rollback/error case được cover nếu nằm trong scope.
   - Kết luận `CONDITIONAL PASS` nếu coverage đủ ngưỡng và flow chính đã cover, nhưng còn gap/risk Medium/Low hoặc assumption cần xác nhận.
   - Kết luận `FAIL` nếu thiếu coverage cho flow quan trọng/high-risk, còn gap Critical/High, hoặc testcase quality không đủ tin cậy.
   - Kết luận `BLOCKED` nếu thiếu requirement/spec/testcase/execution data khiến không thể đánh giá trung thực.
6. **Checklist hoàn tất Phase 1**
   - Markdown testcase tồn tại.
   - Excel testcase tồn tại.
   - Phase 1 summary report tồn tại và có `### Setup Readiness` + `### Precondition Execution Matrix` (1 dòng/TC trong scope).
   - Section `## Setup Strategy (Hợp đồng tiền điều kiện)` tồn tại; mọi precondition trong bảng testcase có tag `[PRE-NN]` map tới catalog; không còn `PRE-NN` mồ côi.
   - Nếu matrix còn `Needs hook`/`Manual-only`: `reports/capability-request.md` tồn tại và liệt kê capability còn thiếu (loại/endpoint/PRE/TC/owner).
   - `task.md` đã được cập nhật đường dẫn output và trạng thái chờ QA xác nhận trước khi publish Jira testcase.

7. **Capability / Test-Hook Request (handoff Dev) — BẮT BUỘC khi còn `Needs hook`/`Manual-only`**

   Nếu `### Precondition Execution Matrix` có bất kỳ dòng `Needs hook` hoặc `Manual-only`, sinh file handoff:

   `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/reports/capability-request.md`

   Mục tiêu: gom mọi blocker thành MỘT danh sách capability để gửi Dev/BE/DevOps, thay vì để rải rác trong matrix và bị phát hiện lại ở từng task. Đây là input Definition of Ready trước Phase 2. Nếu tất cả `PRE-NN` đều `Ready`, chỉ ghi 1 dòng "Không có capability gap" (không cần bảng).

   Nội dung bắt buộc:
   - `## Tổng quan`: bảng đếm `Ready` / `Needs hook` / `Manual-only` (số PRE + số TC ảnh hưởng) — khớp `### Setup Readiness`.
   - `## Capability cần bổ sung`: bảng
     `| # | Loại | Tên/Endpoint đề xuất | Mục đích (state cần dựng) | PRE liên quan | TC bị chặn | Owner đề xuất | Trạng thái |`
     - `Loại` ∈ `test_hook` | `account/role` | `sandbox` | `api` | `config`. KHÔNG có `DB` (kit không nối DB — xem `RULE_GLOBAL.md`).
     - `Tên/Endpoint đề xuất`: cụ thể — vd `POST /test-hooks/<domain>/seed-*` theo contract `tests/support/setup/hooks/README.md`, hoặc "account role X có quyền Y", hoặc "sandbox VNPay/Zoom".
     - `Mục đích`: state cần dựng và vì sao `api`/`ui`/`fixture` không làm được an toàn.
     - `PRE liên quan` / `TC bị chặn`: trace ngược từ matrix.
     - `Owner đề xuất`: Dev/BE/DevOps/QA-Lead.
     - `Trạng thái`: mặc định `Requested`.
   - `## Ghi chú`: nhắc non-prod guard bắt buộc cho test hook; đây là gate capability trước Phase 2.

   Cập nhật đường dẫn `reports/capability-request.md` vào `task.md`.

## Export Excel bắt buộc

Sau khi lưu file Markdown testcase:
1. Export file Markdown sang Excel `.xlsx` bằng script có sẵn:
   ```bash
   node scripts/convert_excel/md_to_xlsx.js <testcase.md> <testcase.xlsx>
   ```
2. File Excel phải nằm cùng thư mục với file Markdown và dùng cùng basename.
   Ví dụ:
   ```bash
   node scripts/convert_excel/md_to_xlsx.js <PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-cases/exam_crud_test_cases.md <PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-cases/exam_crud_test_cases.xlsx
   ```
3. File Excel phải có cột `Nhóm chức năng`, sheet `Summary`, sheet `Test Cases`, và các sheet riêng theo nhóm nếu converter hỗ trợ.
4. Nếu có nhiều file Markdown testcase, export từng file có bảng `TC ID` sang một file `.xlsx` tương ứng.
5. Sau khi export, kiểm tra file `.xlsx` tồn tại và cập nhật đường dẫn Excel vào `task.md` hoặc summary output.
6. Nếu thiếu dependency `exceljs`, báo rõ blocker; không bỏ qua bước Excel và không coi Phase 1 hoàn tất.
7. Sau khi export Excel, coi file Excel là source of truth **khi gen/publish** (Phase 2 execute mặc định lấy nguồn từ AIO Tests, `TESTCASE_SOURCE=aio`).
8. Không publish Jira trong prompt sinh testcase. Ghi trạng thái `Jira testcase publish: Pending QA confirmation`; Auto Publish Jira là step riêng trong phạm vi Phase 1 và chỉ chạy bằng `prompt_templates/phase1/04_auto_publish_jira.md` sau khi QA xác nhận Excel.
9. Sau khi export Excel, tạo/cập nhật `reports/phase1-summary.md` theo format Phase 1 Summary Report ở trên.
10. Cập nhật `task.md` với đường dẫn Markdown testcase, Excel testcase, trạng thái chờ QA xác nhận publish Jira và Phase 1 summary report.

---

# Quy tắc quan trọng

1. **KHÔNG dùng placeholder** — mọi dữ liệu phải cụ thể
2. **Mỗi field một TC riêng** — không gộp validation nhiều field
3. **Kết quả mong đợi phải chính xác** — không chung chung
4. **Các bước đủ chi tiết** để automation thực thi không cần hỏi thêm
5. **Bao phủ đủ 4 loại**: Positive, Negative, Boundary, Edge
6. Output bằng **Tiếng Việt** (trừ technical terms)
7. **Điểm mờ Blocking (Critical/High) → PHẢI qua Gate làm rõ (Bước 0) TRƯỚC khi gen**: gom câu hỏi vào `reports/phase1-clarifications.md`, đặt `AMBIGUITY_GATE: PENDING`, DỪNG chờ trả lời; **KHÔNG tự suy diễn, KHÔNG gen** phần bị chặn. RESOLVED xong mới phân tích lại rồi gen
8. Chỉ điểm mờ **Medium/Low** mới được tự áp assumption (ghi rõ assumption + Coverage Gap) rồi tiếp tục; **KHÔNG** áp cho Critical/High (những thứ đó phải chờ trả lời)
9. Không tạo testcase quá ngắn để tăng số lượng. Chất lượng chi tiết và khả năng execute ở Phase 2 quan trọng hơn số lượng thuần túy
10. Không được để trống endpoint/method/status ở API testcase
10b. **Oracle hiển thị phải từ tài liệu**: expected cho tên cột/label/format/thứ tự/empty-state trích verbatim từ FS/Figma, KHÔNG suy từ build (chống tautological). Mỗi màn có bảng/field phải có dimension Conformance ([`dimensions/12_display.md`](dimensions/12_display.md)): tên cột exact, format từng field, số cột + thứ tự, field bắt buộc
10c. **Không chỉ UI/field — phải phủ logic/dữ liệu/bảo mật/hiệu năng** (mục 13–16 ở [`dimensions/`](dimensions/), nếu applicable): kết quả tính toán bằng **giá trị cụ thể** + biên làm tròn và so khớp/delta dữ liệu (mục 13); phân biệt `null`/rỗng/thiếu/`0` và mapping BE→UI cho field trống nghi ngờ (mục 14); IDOR/privilege/injection/mass-assignment/data-exposure (mục 15); SLA/large-dataset/concurrent khi có ngưỡng (mục 16). Dimension không áp dụng → `N/A + lý do` ở Coverage Gaps, KHÔNG bỏ im lặng. Expected của logic/data là **oracle độc lập tự tính**, KHÔNG lấy từ build
11. Không được để steps/expected thành một câu dài; phải xuống dòng hoặc đánh số rõ ràng trong cell
12. Khi chạy trong repo này, phải xuất thêm file Excel `.xlsx` từ testcase Markdown trước khi kết thúc Phase 1
13. Mỗi testcase phải có nhóm chức năng rõ ràng trong cột `Module`; Excel export phải thể hiện được nhóm đó để lọc/review
14. Không coi Phase 1 hoàn tất nếu thiếu `reports/phase1-summary.md` hoặc report không có tổng testcase, breakdown theo loại, `Coverage Summary`, `Risk-based Gate`, `High/Critical Gaps`, `Testcase Quality Issues` và `Final Decision`
15. Không coi Phase 1 hoàn tất nếu testcase/report/task log dùng tiếng Việt không dấu hoặc bị lỗi encoding/mojibake
16. Không coi Phase 1 hoàn tất nếu thiếu section `## Setup Strategy (Hợp đồng tiền điều kiện)`, hoặc còn precondition không có `[PRE-NN]`, hoặc `Setup Source` chung chung không đủ để Phase 2 setup/manual rõ
17. `Setup Source` cho strategy `api` phải dựa trên Swagger đã fetch ở `requirements/swagger/`; nếu không có cách setup thì đánh dấu `Needs hook` hoặc `Manual-only` thay vì bịa endpoint
18. Sau khi Excel tạo thành công, KHÔNG publish Jira trong prompt này; ghi `Pending QA confirmation`. Auto Publish testcase chạy bằng prompt riêng sau khi QA xác nhận. Excel là source of truth khi gen/publish; Phase 2 execute mặc định lấy nguồn từ AIO Tests (`TESTCASE_SOURCE=aio`, kéo về canonical local `from-aio/*.xlsx`), `excel` là opt-out, `xray` là legacy
