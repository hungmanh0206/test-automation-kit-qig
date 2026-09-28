# Prompt Re-run - Chạy lại bug và testcase fail

> Prompt chuẩn để chạy Re-run: chạy lại testcase fail hoặc Backlog bug đã fix, cập nhật bằng chứng/trạng thái khi kết quả PASS thật.

## Mục đích

Dùng prompt này khi cần chạy lại testcase fail trước đó hoặc verify Backlog bug sau khi Dev fix. Rerun chỉ xử lý bug/case đã có kết quả execute trước đó; không dùng để kiểm tra, đồng bộ hoặc xử lý tài liệu nguồn mới.

## Khi nào dùng

| Tình huống | Dùng prompt này |
|---|---|
| Re-run testcase fail trước đó | Có |
| Xác minh Backlog bug đã fix | Có |
| Re-run bug Backlog và chuyển `Done` nếu PASS thật | Có |
| Sửa locator do lỗi automation khi đang rerun bug | Chỉ khi không đổi requirement/design/API |
| tài liệu nguồn/Backlog requirement đổi | Không, không thuộc rerun |
| Figma/UIUX đổi | Không, không thuộc rerun |
| Swagger/OpenAPI/API behavior đổi | Không, không thuộc rerun |
| Chạy lại toàn bộ Phase 2 từ đầu | Không, dùng `prompt_templates/run_phase2_template.md` |

## Đầu vào

| Đầu vào | Bắt buộc | Ghi chú |
|---|---|---|
| `PROJECT_OUTPUT_DIR` | Có | Thư mục output gốc của project. |
| `TASK_KEY` | Có | Phạm vi task/feature. |
| `TESTCASE_SOURCE` | Không bắt buộc | Mặc định tải testcase liên quan từ Google Sheet về local trước khi rerun (xem dưới); `excel` để dùng Excel local. |
| `PUSH_EXECUTION` | Không bắt buộc | `1` để đồng bộ trạng thái các TC vừa rerun lên Google Sheet. |
| `RUN_ID` | Không bắt buộc | Bắt buộc nếu rerun song song cùng một `TASK_KEY`. |
| `TC_IDS_OR_N/A` | Không bắt buộc | Danh sách testcase cần rerun. |
| `BACKLOG_BUG_KEYS_OR_N/A` | Không bắt buộc | Bug cần verify hoặc giữ mở. |
| `RERUN_SCOPE_OR_ERROR` | Không bắt buộc | Lỗi, vấn đề setup, vấn đề locator hoặc phạm vi cần xử lý trong rerun bug. |

## Đầu ra

| Đầu ra | Vị trí |
|---|---|
| Report rerun | `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/reports/rerun/` |
| Evidence được cập nhật | `test-results/artifacts/` hoặc Backlog attachment/comment khi đủ điều kiện |
| Trạng thái Backlog được cập nhật | Chỉ chuyển `Done` khi testcase `PASS` thật và có evidence ảnh/video |
| Task/report được cập nhật | `task.md`, `reports/execution-summary.md` hoặc rerun report liên quan |

## Quy trình

| Bước | Hành động |
|---:|---|
| 1 | Echo scope `PROJECT_OUTPUT_DIR`, `TASK_KEY`, `TASK_OUTPUT_DIR`, `RUN_ID` nếu có; nếu sai task thì dừng. |
| 1b | **Mặc định**: agent `download_file_content` Google Sheet mới nhất về local trước khi rerun (qua Drive MCP, dùng `GOOGLE_SHEET_URL` trong `profiles/<TASK_KEY>/task.env`). Dùng `test-cases/from-sheet/*.xlsx` làm nguồn expected. Nếu report cảnh báo TC thiếu steps thì dừng và báo user. Bỏ qua bước này nếu `TESTCASE_SOURCE=excel`. |
| 2 | Xác định rerun type: failed testcase, fixed Backlog bug hoặc automation/setup issue trong phạm vi bug rerun. |
| 3 | Đọc report/task artifact gần nhất theo file priority bên dưới. |
| 4 | Rerun targeted scope trước, không chạy full suite nếu không cần. |
| 5 | Nếu fail/skip do automation/setup/data/env, sửa root cause và rerun lại. |
| 5b | **GATE MÁY, BẮT BUỘC trước bước 6** — `node scripts/qa/output_gate.js --mode test-execution --status <TASK_OUTPUT_DIR>/test-results/runs/<RUN_ID>/testcase-status.json`. Rerun là nhánh **trực tiếp chuyển bug sang Done** — hậu quả cao nhất của cả kit — mà tới 23/08/2026 nó là nhánh DUY NHẤT không có gate máy. Gate bắt: evidence không phải ảnh/video · step thiếu status · comment dính debug · case phức tạp thiếu video · FAIL không phân tầng · FAIL tầng product/api chưa khai `reruns` ≥ `verdict_taxonomy.rerun.min`. CHẶN ⇒ tự sửa trong session rồi chạy lại, không chờ user nhắc. |
| 5c | **Mở rộng quanh vùng vừa fix** (bug band High/Medium): `TASK_ENV=... npm run expansion:plan -- --task <TASK_KEY>` rồi chạy tối thiểu trục ③ (bền vững sau mutation) + trục ⑤ (trạng thái kế cận). Fix tạo regression ở chỗ LÂN CẬN, không ở chính case đã map; rerun chỉ chạy TC cũ thì không đo được điều đó. Finding không có `oracle_ref` ⇒ `OBSERVATION`, không phải PASS. |
| 6 | Nếu `PASS` thật cho Backlog bug đã fix, attach evidence **đã annotate** + comment ngắn gọn **nhúng ảnh inline** rồi chuyển bug sang `Done` (chi tiết ở mục "Re-run bug Backlog đã được fix"). |
| 7 | Nếu `FAIL`, `SKIP` hoặc `BLOCKED`, giữ bug mở, ghi lý do vào report local; nếu user yêu cầu thì comment tag Dev + evidence annotate (đỏ = điểm lỗi). |
| 7b | **Sau khi rerun xong — TỰ ĐỒNG BỘ lên Sheet, KHÔNG cần QA xác nhận** (re-run là mốc verify rõ ràng; trừ `PUSH_EXECUTION=0`): cập nhật `test-results[/runs/RUN_ID]/testcase-status.json` cho các TC vừa chạy — **case FAIL phải kèm `steps[]`/`failedStep` + evidence bước lỗi** → `node scripts/convert_excel/merge_execution_status.js <local .xlsx> test-results/runs/<RUN_ID>/testcase-status.json --only <TC_IDs>` rồi agent `update_file` qua Drive MCP luôn (không chờ QA). **Cơ chế chung** (hai gate trước khi ghi · status-map từ `verdict_taxonomy.json` cột `sheet` · guard 0-conclusive · loại case `carriedOver`) **giống Phase 2 §13b** (`run_phase2_template.md`) — không lặp lại ở đây. **Đặc thù re-run:** mỗi lượt ghi đè lại đúng cột `Result` của TC vừa chạy trên cùng Sheet — không có khái niệm cycle/lần riêng như công cụ test-management cũ. |
| 7c | **Sau khi bug sang Done** — `TASK_ENV=... npm run bugs:checklist` cho module vừa fix: "lỗi cùng lớp còn chỗ nào dính?". Đúng thời điểm vàng (root cause còn nóng); chỗ nghi ghi vào rerun report mục "Cùng lớp — cần kiểm", KHÔNG tự mở bug mới ở nhánh rerun. |
| 8 | Lặp lại cho đến khi toàn bộ bug trong scope đã `Done` hoặc còn blocker/product fail cần Dev xử lý. |

## An toàn khi chạy song song nhiều story

- Không sửa `.env` hoặc `.env.local` chung khi có session khác đang chạy.
- Nếu yêu cầu hiện tại của user không nêu rõ `TASK_KEY`, không dùng `TASK_KEY` từ `.env` hoặc context cũ để chạy; phải hỏi lại.
- Mỗi command rerun phải truyền đúng `PROJECT_OUTPUT_DIR`, `TASK_KEY` và `RUN_ID` nếu cần.
- Nếu chạy song song cùng một `TASK_KEY`, bắt buộc dùng `RUN_ID`.
- Khi có `RUN_ID`, đọc/ghi Playwright output dưới:
  `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/test-results/runs/[RUN_ID]/`
- Khi có `RUN_ID`, ghi rerun summary dưới:
  `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/reports/runs/[RUN_ID]/`
- Khi có `RUN_ID`, không ghi đè testcase Markdown/Excel chính trong lúc rerun; ghi kết quả vào run-scoped rerun summary/status.

## Thứ tự ưu tiên đọc file

Đọc theo thứ tự ưu tiên để tiết kiệm token:

| Ưu tiên | File/Artifact |
|---:|---|
| 1 | `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/task.md` |
| 2 | `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/reports/execution-summary.md` hoặc report rerun gần nhất |
| 3 | Backlog bug mapping local: `reports/backlog_bug_log.md`, `reports/execution-summary.md`, `task.md` |
| 4 | Testcase/spec/helper liên quan trực tiếp tới `TC_ID`, endpoint hoặc locator |
| 5 | Artifact trực tiếp: `results.json`, `phase2-status.json`, `error-context.md`, screenshot/video path |
| 6 | Raw requirement/design/API chỉ đọc khi cần xác nhận expected result của bug/case đang rerun; không kiểm tra source change trong rerun |

> 🗣️ **BẮT BUỘC — kể lại NGAY TRONG HỘI THOẠI, đừng chỉ ghi file.** Cuối lượt rerun nói thẳng **ba phần**:
> 1. **Đã học gì.** Record mới hoặc cập nhật trong `knowledge/**`. Đặc biệt là `decisions/` khi rerun cho ra
>    kết luận "không phải bug", và `root_causes/` khi đã xác định được gốc.
>    Kèm cả **memory vừa lưu hoặc sửa, và lý do lưu**.
> 2. **Đã sửa gì** — thay đổi thật, có số đo. Không "đã cải thiện", "đã tối ưu".
> 3. **Còn thiếu gì** — lỗ hổng **đo được**: bug rerun vẫn FAIL và vì sao · bug thiếu `tc_id` (bị `risk_score`
>    loại khỏi bảng) · bug chưa có `root_cause_ref` · case còn `BLOCKED_SETUP` và thiếu capability nào.
>
> Lấy số bằng `npm run learn:report -- --task <TASK_KEY> --write`, nhưng nêu cả phần "còn thiếu" dù nó làm báo
> cáo trông kém đẹp — **đó mới là phần user dùng để quyết việc tiếp theo**. File chỉ là chỗ LƯU, không phải
> cách THÔNG BÁO.

**Chi tiết từng bước**: [`.agent/workflows/rerun.md`](../.agent/workflows/rerun.md) — file tổng quan, bên trong liệt kê đủ 3 step `rerun_01…03`.

**Prompt execute**: rerun vẫn chạy test thật nên kỷ luật execute áp y như Phase 2 — mở [`phase2/04_execute_fe_playwright.md`](phase2/04_execute_fe_playwright.md) (case UI) và/hoặc [`phase2/05_execute_api_playwright.md`](phase2/05_execute_api_playwright.md) (case API) khi bắt đầu chạy lại. Nếu FAIL **không ổn định giữa các lần**, mở [`phase2/07_triage_flaky.md`](phase2/07_triage_flaky.md) để phân biệt flaky vs bug thật **trước khi** động tới `08_log_bug_backlog.md`. Bản đồ đầy đủ ở `run_phase2_template.md` §Bản đồ prompt Phase 2.

## Quy tắc tiết kiệm token

- Không paste lại toàn bộ testcase, requirement, Swagger, Playwright report, trace, DOM hoặc execution summary vào câu trả lời.
- Ưu tiên đọc file theo đường dẫn và chỉ mở đoạn liên quan bằng search/line range.
- Chỉ đọc sâu các file liên quan trực tiếp tới `TC_ID`, endpoint, locator, module hoặc error đang xử lý.
- Nếu đã có report/snapshot local, dùng report/snapshot làm source chính thay vì đọc lại raw requirement lớn.
- Mọi raw artifact lớn phải lưu vào file local dưới `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/reports/rerun/`.
- Final chỉ tóm tắt đường dẫn và kết quả, không paste diff dài hoặc raw log lớn.
- Không sinh/cập nhật testcase theo tài liệu mới trong rerun.
- Không chạy toàn suite nếu chỉ cần verify subset.
- Chỉ chạy full suite khi thay đổi shared helper, auth/setup hoặc user yêu cầu.

## Quy tắc chất lượng

- Tiết kiệm token không được làm giảm độ tin cậy rerun.
- Không được bỏ sót bug còn mở, bỏ qua evidence hoặc tạo `PASS` ảo.
- Nếu report/snapshot local không đủ để xác định TC ID, expected result, Backlog mapping hoặc root cause, phải đọc thêm testcase gốc, requirement/API/design hoặc Backlog issue liên quan.
- Nếu expected result không còn đủ rõ trong artifact hiện tại, ghi blocker hoặc yêu cầu xác nhận; không tự xử lý tài liệu mới trong rerun.
- Nếu targeted rerun không đủ chứng minh phạm vi ảnh hưởng, mở rộng scope rerun hợp lý.
- Không kết thúc rerun chỉ vì số liệu tổng quan đẹp nếu vẫn còn Backlog bug mở, case `SKIP` chưa rõ lý do hoặc evidence `PASS` chưa đủ.
- Nếu có trade-off giữa ít token và xác nhận bug fix chắc chắn, ưu tiên xác nhận chắc chắn.

## Cache và output

| Đầu ra | Mẫu đường dẫn |
|---|---|
| Rerun folder | `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/reports/rerun/` |
| Markdown summary | `<YYYYMMDD-HHMMSS>-[rerun-type].md` |
| Machine-readable summary | `<YYYYMMDD-HHMMSS>-[rerun-type].json` |

## Quy tắc cập nhật file

- Sửa tối thiểu đúng file liên quan.
- Không refactor ngoài phạm vi rerun.
- Không đổi expected result nếu chưa có requirement/API/design xác nhận.
- Không cập nhật testcase/automation theo tài liệu mới trong rerun, trừ lỗi automation/setup cần sửa để bug rerun chạy được và không làm đổi business expectation.
- Không xóa assertion quan trọng để làm test pass.
- Không dùng mock/stub làm mất mục tiêu kiểm thử thật.
- Không ghi secret/token/password/cookie/API key vào code/report/log.

## Chiến lược rerun

| Bước | Quy tắc |
|---:|---|
| 1 | Ưu tiên chạy lại testcase `FAIL` trước đó theo `TC_ID` hoặc Backlog bug mapping. |
| 2 | Chạy targeted test trước theo `TC_ID`, file spec hoặc endpoint liên quan. |
| 3 | Với lỗi locator/flaky/setup đã sửa, rerun targeted 2 lần nếu chi phí thấp. |
| 4 | Chỉ chạy full suite khi thay đổi helper dùng chung hoặc có rủi ro regression rộng. |
| 5 | Nếu command fail do environment/auth/dependency, ghi blocker rõ trong report local và không log Backlog product bug. |

## Quality gate theo từng lần rerun

| Trạng thái | Yêu cầu |
|---|---|
| `PASS` | Có assertion thật và evidence ảnh/video không trắng khi liên quan Backlog bug. |
| `FAIL` | Có actual result mới, phân loại nguyên nhân và evidence/local artifact đủ rõ. |
| `SKIP` | Có lý do cụ thể và đánh giá có thể sửa để chạy được không. |
| `BLOCKED` | Ghi rõ blocker, owner hoặc điều kiện cần để chạy tiếp. |

## Re-run bug Backlog đã được fix

| Điều kiện | Quy tắc |
|---|---|
| Mapping Backlog/TC | Chỉ xử lý khi có mapping rõ giữa `BACKLOG_BUG_KEY` và `TC_ID`. |
| Testcase PASS thật | Execute thật, không skip, không pass do bỏ assertion/mock sai/sửa expected tùy tiện. |
| Bug đã fix | Upload/add evidence ảnh/video, comment Re-run PASS, chuyển Backlog bug sang `Done`. |
| Testcase FAIL/SKIP | Không chuyển Backlog sang `Done`; ghi report local. |
| Evidence | Chỉ dùng `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.mp4`, `.webm`. |

Khi testcase `PASS` thật:

1. **Chụp lại evidence và ANNOTATE**: khoanh vùng + nhãn ngắn, **xanh lá = điểm đã đúng/đã fix** (đối chiếu tài liệu). Nếu đang cập nhật lại evidence cũ → **xóa attachment cũ rồi upload bản mới** (không để trùng nhiều bản trên 1 bug). Kỹ thuật annotate + replace: xem `prompt_templates/phase2/08_log_bug_backlog.md`, mẫu `outputs/**/automation/annotate_*.js`.
2. Upload/add evidence ảnh/video (đã annotate) vào Backlog bug.
3. **Comment ngắn gọn, dễ nhìn** (không viết đoạn dài):
   - 1 dòng tiêu đề trạng thái, vd `✅ Re-run PASS: [TC_ID] đã chạy lại sau fix`.
   - Gạch đầu dòng các điểm đã đúng nếu nhiều ý.
   - **Đính kèm ảnh evidence vào comment** qua `attachmentId[]` của `POST /api/v2/issues/:id/comments`, và ghi rõ trong comment "xem ảnh đính kèm". Backlog không có cú pháp nhúng inline đã verify — đừng đoán cú pháp.
4. Chuyển status Backlog bug sang `Done` bằng transition hợp lệ của project.
5. Cập nhật report local với Backlog key, TC ID, status cũ, status mới, evidence path, comment/transition result.

Khi testcase vẫn `FAIL`/`SKIP` (bug **chưa fix**): không chuyển `Done`, giữ nguyên trạng thái. Nếu user yêu cầu báo lại Dev:

- Comment ngắn gọn, tách nhóm **"Đã đúng" / "Còn lỗi"**, **tag Dev** bằng mention `[~accountid:<id>]`.
- Nhúng evidence đã annotate INLINE, **đỏ = điểm còn lỗi** (nêu rõ sai gì + đúng phải thế nào).
- Ghi actual mới + evidence path vào report local.

Nếu user không yêu cầu, chỉ ghi report local, không comment Backlog mặc định.

## Vòng rerun đến khi bug được fix

Chu trình rerun phải lặp lại cho đến khi tất cả Backlog bug thuộc phạm vi task/story đã được verify `PASS` và chuyển sang `Done`, hoặc còn blocker rõ ràng không thể tự xử lý.

| Bước | Hành động |
|---:|---|
| 1 | Lấy danh sách Backlog bug còn mở theo scope hiện tại. |
| 2 | Xác định TC ID/spec/endpoint liên quan cho từng bug. |
| 3 | Rerun targeted testcase. |
| 4 | Nếu `PASS` thật, attach evidence annotate (xanh = đã đúng) + comment ngắn gọn nhúng ảnh inline, rồi chuyển Backlog bug sang `Done`. |
| 5 | Nếu `FAIL`, giữ bug mở, ghi actual mới/evidence local vào report và chờ Dev fix tiếp; nếu user yêu cầu thì comment tag Dev + evidence annotate (đỏ = điểm lỗi). |
| 6 | Nếu `SKIP`, giữ bug mở, ghi lý do skip và ưu tiên fix nguyên nhân skip nếu thuộc setup/automation. |

Sau mỗi vòng, report local phải gồm:

- Tổng bug trong scope.

- Số bug đã chuyển `Done`.
- Số bug còn `Open/In Progress/To Do`.
- Bug còn fail/skip và lý do.
- Evidence path cho các bug đã `PASS`.

## Ngoài phạm vi: thay đổi tài liệu nguồn

Rerun không xử lý cập nhật tài liệu nguồn và không tự kiểm tra source change. Những việc sau chỉ được xử lý bằng nhánh phụ riêng khi user yêu cầu rõ:

| Change | Reason |
|---|---|
| Requirement/AC/business rule đổi | Expected result và coverage có thể thay đổi. |
| Figma/UIUX flow đổi | Test steps, locator hoặc visual assertion có thể thay đổi. |
| Swagger/OpenAPI đổi | API contract/status/schema có thể thay đổi. |
| Bug cũ có thể không còn valid do spec đổi | Cần re-triage trước khi Re-run. |

## Stop Criteria

Dừng rerun khi:

- Tất cả bug trong scope đã `Done`, hoặc
- Bug vẫn fail do product chưa fix và cần Dev xử lý tiếp, hoặc
- Bị chặn bởi auth/env/dependency/quyền Backlog/evidence không capture được.

## Final Output To User

- Tối đa 8 bullet.
- Gồm phạm vi đã xử lý, file đã sửa, test đã chạy, kết quả, artifact/report path, blocker/rủi ro nếu có.
- Nếu có Re-run Backlog bug, nêu bug nào đã chuyển `Done`, evidence ảnh/video nào đã được comment/attach, bug nào chưa đủ điều kiện.
- Nếu còn Backlog bug chưa `Done`, nêu số lượng còn lại và lý do dừng vòng rerun.
- Không paste diff dài; chỉ dẫn file path.

## Ví dụ

```text
Đọc prompt_templates/run_phase_re-run_template.md và rerun các bug còn mở cho:
PROJECT_OUTPUT_DIR=outputs/<YOUR_PROJECT>
TASK_KEY=<TASK_KEY>
BACKLOG_BUG_KEYS_OR_N/A=<BUG-1>, <BUG-2>
TC_IDS_OR_N/A=<TC_ID_1>, <TC_ID_2>
RERUN_SCOPE_OR_ERROR=N/A
```

## Tài liệu tham chiếu

| Tài liệu | Mục đích |
|---|---|
| `prompt_templates/run_phase2_template.md` | Full Phase 2 execution template. |
