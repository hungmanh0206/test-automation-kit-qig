# Prompt Phase 2 - Ghi bug Backlog

> Chạy: `Đọc file này và chạy với TASK_KEY=<TASK_KEY>`. Rule non-negotiables ở `CLAUDE.md`, đã auto-load. Digest ở `.agent/rules/core_rules.md`.
> Chỉ mở `RULE_GLOBAL.md` **ở đúng mục cần**, vì mỗi gạch đầu dòng của digest đã ghi sẵn `§`. Đừng nạp cả file.
>
> Tên file `08_log_bug_backlog.md` giữ nguyên sau khi tổ chức chuyển hệ bug-tracking cũ sang Backlog
> (22/09/2026), để không phá mọi chỗ trỏ tới file này. Nội dung bên dưới đã cập nhật cho Backlog.

Dùng prompt này như một bước con của Phase 2, chỉ chạy sau khi đã execute testcase, auto-heal và sinh local execution summary PASS/FAIL/SKIP. Không chạy prompt này như một phase độc lập.

Prompt này chỉ để log Backlog bug sau execute. Phase 1 hiện KHÔNG publish testcase lên đâu (publish đã dừng — xem quyết định 22/09/2026); `prompt_templates/phase1/04_auto_publish_backlog.md` đang chờ cập nhật theo, đừng chạy.

```text
Chạy bước log bug Backlog trong Phase 2.

Điều kiện bắt buộc trước khi chạy:
- Đã execute testcase.
- Đã auto-heal lỗi automation nếu có.
- Đã cập nhật testcase output với `Status` và `Actual Result`.
- Đã có execution summary phân loại `PASS` / `FAIL` / `SKIP`.
- Testcase FAIL đã được rerun đủ ngưỡng `.agent/config/verdict_taxonomy.json` §rerun (min lần, hiện ≥2–3) hoặc report ghi rõ số lần rerun đủ để loại trừ flaky/setup.
- Execution summary đã loại trừ các nguyên nhân không thuộc product bug: prompt chưa rõ, test data sai/thiếu, setup/environment lỗi, mock/stub sai, dependency chưa sẵn sàng, timeout, locator/test harness/cleanup/auth lỗi.
- Expected result đã được xác nhận đúng bằng requirement/API/design hoặc review hợp lệ.
- Actual result có evidence rõ ràng đã sanitize. Evidence dùng để phân tích local có thể gồm response log, trace, error-context hoặc error message; evidence upload lên Backlog chỉ được là ảnh/video.
- Video evidence không bắt buộc cho mọi bug. Tuy nhiên với case phức tạp mà một ảnh fail không mô tả đủ chuỗi thao tác/trạng thái trước-sau lỗi, phải rerun với video và upload video kèm screenshot nếu có thể.
- Không log Backlog cho testcase đang SKIP hoặc testcase FAIL do test/prompt/setup chưa chuẩn (gồm `setup_failure` từ Precondition Resolution Pass).

Phạm vi:
- Task key/scope folder: [TASK_KEY]
- Backlog Story/Task parent: [BACKLOG_STORY_KEY]
- Backlog project key: [BACKLOG_PROJECT_KEY_OR_EMPTY]
- Output root: [PROJECT_OUTPUT_DIR]
- Task output dir: `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/`
- Run ID nếu đang chạy song song cùng task: [RUN_ID hoặc N/A]

Parallel story safety:
- Trước khi đọc result hoặc gọi bug reporter, echo `PROJECT_OUTPUT_DIR`, `TASK_KEY`, `TASK_OUTPUT_DIR`, `RUN_ID` nếu có.
- Nếu `TASK_KEY` không khớp task user yêu cầu, dừng ngay.
- Không sửa `.env` hoặc `.env.local` chung khi có session khác đang chạy.

Input artifacts:
- Playwright JSON result:
  `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-results/results.json`
- Evidence/artifacts:
  `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-results/artifacts/`
- Nếu có `RUN_ID`, dùng:
  `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-results/runs/<RUN_ID>/results.json`
  `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-results/runs/<RUN_ID>/artifacts/`
- Testcase output:
  `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-cases/`
- Execution summary:
  `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/reports/execution-summary.md`
- Nếu có `RUN_ID`, execution/bug local summary của run nằm dưới:
  `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/reports/runs/<RUN_ID>/`
- Task tracker:
  `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/task.md`

Env/config:
- Đọc biến môi trường từ `.env.local`, `.env`, `scripts/integrations/backlog/.env.local`, `scripts/integrations/backlog/.env`.
- Không in password, API key, cookie hoặc private key ra console, markdown, testcase output, report hoặc log.
- Tạo Backlog thật cần:
  - `BACKLOG_BASE_URL` hoặc `BACKLOG_URL`
  - `BACKLOG_API_KEY`
  - `BACKLOG_STORY_KEY` hoặc flag `--story [BACKLOG_STORY_KEY]`
  - Assignee theo layer bug lấy từ `BACKLOG_FE_ASSIGNEE`, `BACKLOG_BE_ASSIGNEE` hoặc `BACKLOG_DEV_ASSIGNEE`.
  - Nếu không cấu hình assignee riêng, fallback sang assignee của Backlog Story/Task parent khi có.
- `BACKLOG_BUG_ISSUE_TYPE` phải là issue type con `Sub-bug` (tên issue type có thật trong project Backlog — reporter tự resolve tên → id, báo lỗi rõ nếu không khớp). Không dùng `Sub-task` cho bug.
- Khi tạo/update Sub-bug, phải tự động copy `Milestone` và `Category` từ Backlog Story/Task parent `[BACKLOG_STORY_KEY]` (Backlog KHÔNG có Sprint — Milestone là tương đương gần nhất, hướng release chứ không phải iteration).
  - Nếu project cần copy thêm 1 custom field cụ thể từ parent (id số, không phải tên — Backlog không resolve field theo tên như Backlog "Sprint"), cấu hình `BACKLOG_SPRINT_FIELD_ID`.
  - Nếu parent không có `Milestone` hoặc `Category`, bỏ qua field trống và ghi nhận trong summary nếu cần.
- `Priority` của Backlog Sub-bug phải lấy từ cột `Ưu tiên`/`Priority` của testcase. Backlog chỉ có 3 mức cố định: `High`, `Normal`, `Low` — kit tự map `Critical/High → High`, `Medium → Normal`, `Low/Lowest → Low` (mất độ phân giải so với thang 5 mức của testcase, có chủ đích).
- Nếu `BACKLOG_PROJECT_KEY` bỏ trống, không truyền flag `--project`; reporter sẽ suy ra project key từ `BACKLOG_STORY_KEY` khi có thể.

Mode:
- [DRY_RUN / CREATE]
- Mặc định chạy DRY_RUN trước để preview.
- Chỉ chạy CREATE khi user yêu cầu tạo bug thật hoặc prompt Phase 2 hiện tại cho phép thay đổi Backlog.

Các bước thực hiện:
1. Kiểm tra `results.json` tồn tại.
2. Kiểm tra `reports/execution-summary.md` đã có tổng hợp `PASS` / `FAIL` / `SKIP`.
3. Đọc Playwright result và lọc testcase có trạng thái `failed`, `timedOut`, hoặc `interrupted`.
4. Đối chiếu danh sách fail với execution summary để chỉ log bug cho testcase đã được report là FAIL sau auto-heal.
5. Với từng testcase FAIL, kiểm tra điều kiện log bug:
   - Không phải SKIP.
   - Đã rerun đủ ngưỡng (verdict_taxonomy.json §rerun, hiện 2-3 lần) hoặc có ghi nhận rerun đủ trong summary.
   - Không còn nguyên nhân automation/harness/setup/test data/mock/dependency/timeout/auth/locator/cleanup.
   - Expected result đã xác nhận đúng.
   - Evidence rõ ràng và không trắng.
   - Nếu thiếu bất kỳ điều kiện nào, không log Backlog; ghi `Not eligible` vào Backlog Bug Report Log kèm lý do.
6. Xác định đúng Backlog Story/Task parent từ `[BACKLOG_STORY_KEY]`.
   - CREATE phải verify parent issue tồn tại và agent có quyền tạo child issue dưới parent đó.
   - Nếu không tìm thấy parent hoặc parent không đúng task đang test, dừng lại và báo lỗi.
7. Nếu không có testcase fail đủ điều kiện, ghi thêm vào execution summary: `Không có testcase fail đủ điều kiện log Backlog`.
8. Với mỗi testcase fail đủ điều kiện, tổng hợp:
   - TC ID
   - loại bug: `FE` hoặc `BE`
   - tên bug ngắn gọn
   - tiền điều kiện nếu có
   - các bước reproduce
   - kết quả hiện tại
   - kết quả mong muốn
   - số lần đã rerun
   - các nguyên nhân đã loại trừ
   - mức độ ảnh hưởng
   - ghi chú nếu bug có khả năng flaky hoặc phụ thuộc environment
   - Priority từ cột `Ưu tiên`/`Priority` của testcase
   - evidence path: screenshot/video từ lần execute trước đó
   - xác định screenshot đã đủ mô tả lỗi hay cần video; nếu cần video nhưng chưa có, phải ghi rõ blocker và ưu tiên capture lại trước khi log
   - source testcase path
9. Chạy dry-run:
   `node scripts/integrations/backlog/bug_reporter.js --task [TASK_KEY] --story [BACKLOG_STORY_KEY] --project-output [PROJECT_OUTPUT_DIR] --dry-run`
   (hoặc `npm run backlog:bug-report:dry-run -- ...`)
   - Nếu có `RUN_ID`, thêm `--run-id [RUN_ID]`.
   - Nếu có Backlog project key riêng, thêm `--project [BACKLOG_PROJECT_KEY]`.
   - Nếu muốn ép loại bug, thêm `--layer FE` hoặc `--layer BE`.
10. Nếu được phép tạo Backlog thật, chạy:
   `node scripts/integrations/backlog/bug_reporter.js --task [TASK_KEY] --story [BACKLOG_STORY_KEY] --project-output [PROJECT_OUTPUT_DIR]`
   (hoặc `npm run backlog:bug-report -- ...`)
   - Nếu có `RUN_ID`, thêm `--run-id [RUN_ID]`.
   - Nếu có Backlog project key riêng, thêm `--project [BACKLOG_PROJECT_KEY]`.
   - Nếu muốn ép loại bug, thêm `--layer FE` hoặc `--layer BE`.
10b. Hai cờ cho các tình huống mặc định không phủ (thêm 06/10/2026):
   - `--only-priority`: CHỈ điền `Priority`, để TRỐNG `Assignee`/`Milestone`/`Category` cho PM tự phân.
     Mặc định reporter copy Milestone+Category từ parent và DỪNG nếu không resolve được assignee, nên
     muốn bỏ trống thì phải khai cờ — đừng xoá env assignee, vì env ảnh hưởng mọi task khác và nhìn lại
     không biết là cố ý hay quên.
   - `--bug-payload <file.json>`: khai TƯỜNG MINH nội dung bug theo từng TC — `{ "<TC_ID>": { title,
     preconditions, steps, actualResult, expectedResult, screenshot, video } }`, chỉ ghi đè khoá có mặt.
     **Khi nào BẮT BUỘC dùng**: case kiểm nhiều điều mà chỉ trượt một điều. Reporter dựng title từ TÊN
     CASE và tiền điều kiện từ ô tiền điều kiện của case — nên bug sẽ mang tên của điều ĐÃ ĐẠT, và tiền
     điều kiện của đơn vị ghi trong case chứ không phải đơn vị đã chạy thật. Builder không có cách nào
     biết assertion nào trượt.
     `screenshot`/`video` để chỉ đúng ảnh ĐÃ KHOANH VÙNG: `readArtifactInfo` ưu tiên `test-failed-*.png`
     mà ảnh đó Playwright tự chụp, KHÔNG có highlight — trái luật highlight bắt buộc.
     Cấm dùng cờ này để nới nội dung cho dễ nghe: mọi giá trị phải khớp evidence và report local.
   - `--dry-run` giờ in TITLE + DESCRIPTION thật ra console để soát trước khi tạo.

11. Chống duplicate:
   - Backlog KHÔNG có labels tự do — reporter tự tìm bug trùng bằng `keyword` search + marker `TC: [<TC_ID>]` ở CUỐI description (xem bug_reporter.js searchExistingBug). Đây là full-text match, không chính xác tuyệt đối như JQL cũ — review tay nếu nghi ngờ.
   - Nếu đã có bug mở cho TC ID đó, không tạo bug mới; ghi trạng thái duplicate/skipped vào report.
12. Upload evidence:
   - Chỉ upload screenshot hoặc video đã được sinh trong lần execute trước đó.
   - Không upload `trace.zip`, file markdown, file text/log hoặc `error-context.md`; các file này chỉ dùng để đọc context local khi viết description.
   - Với bug đơn giản, screenshot fail không trắng thường là đủ.
   - Với bug phức tạp, nhiều bước, nhiều màn hình, state thay đổi theo thời gian, toast/modal auto-close, async update, drag/drop, pagination/filter debounce, create/edit/delete flow dài, hoặc ảnh tĩnh không thể hiện được nguyên nhân, phải có video evidence nếu môi trường cho phép.
   - Nếu bug phức tạp nhưng chưa capture được video do blocker môi trường/setup, ghi rõ trong execution summary/report local rằng bug cần bổ sung video/re-validation; không được giả vờ evidence đã đủ.
   - Không upload file có chứa secret hoặc credential chưa sanitize.
   - Backlog upload evidence qua 2 bước (`POST /space/attachment` rồi gắn `attachmentId[]` vào issue) — reporter tự làm, không cần thao tác tay.
13. Ghi thêm `Backlog Bug Report Log` vào execution summary.
14. Cập nhật `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/task.md` với tổng số:
    - Created
    - Duplicate/Skipped
    - Error
    - đường dẫn report chi tiết

Quy tắc Backlog issue:
- Bug phải được tạo là child/sub-bug của Backlog Story/Task `[BACKLOG_STORY_KEY]`, work type là `Sub-bug`, không tạo issue độc lập và không dùng `Sub-task`.
- Parent field (`parentIssueId`) của Backlog issue phải trỏ đúng Story/Task `[BACKLOG_STORY_KEY]`.
- `Milestone` và `Category` của Sub-bug phải được điền theo đúng giá trị đang có trên Story/Task parent `[BACKLOG_STORY_KEY]`.
- Không tự chọn Milestone/Category khác parent và không hard-code theo task cụ thể; luôn lấy từ parent issue ở thời điểm log bug.
- `Priority` phải được set theo testcase:
  - Testcase dùng thang `Critical|High|Medium|Low|Lowest`; khi ghi Backlog, kit tự map xuống 3 mức Backlog: `Critical/High → High`, `Medium → Normal`, `Low/Lowest → Low`.
  - Nếu testcase không có priority hợp lệ, không ép field để Backlog dùng default.
- Assignee phải lấy từ cấu hình:
  - FE bug: ưu tiên `BACKLOG_FE_ASSIGNEE`.
  - BE bug: ưu tiên `BACKLOG_BE_ASSIGNEE`.
  - `BACKLOG_DEV_ASSIGNEE` dùng khi muốn ép cùng một assignee cho mọi layer.
  - Nếu không có env assignee, dùng assignee của Backlog Story/Task parent nếu có.
- Đánh dấu (Backlog KHÔNG có labels tự do như Backlog — các thông tin dưới đây nằm trong SUMMARY/DESCRIPTION, không phải field riêng):
  - `TC: [<TC_ID>]` ở DÒNG CUỐI description (truy vết testcase + chống trùng). KHÔNG gắn vào title.
  - `Tầng: [FE]`/`[BE]` ở DÒNG CUỐI description (layer). KHÔNG gắn vào title.
  - `[found-by-kit]`/`[found-by-human]` trong description khi chạy `--found-by kit|human` (nguồn phát hiện).

Form bug bắt buộc:

Title (= Backlog `summary`):
`Tên bug — mô tả đủ để người đọc hiểu ngay lỗi là gì`

**Title CHỈ có tên bug** — không `TASK_KEY`, không `TC_ID`, không mã story, và KHÔNG `[FE]`/`[BE]`. Title là thứ dev
đọc lướt trong danh sách bug, nên nó phải nói được LỖI GÌ chứ không phải mã nào. Chủ dự án chốt 06/10/2026.

> Title trước đây mở đầu bằng `[FE][TC_ID]` vì Backlog không có labels tự do, và BA máy đọc hai dấu đó:
> duplicate-check của reporter, `learn_bugs` (map bug về Module cho risk model), và `lintBeVsFeLayer`
> (gán tầng thì phải có dấu vết API). Nay cả hai dấu ĐÃ DỜI xuống dòng cuối description:
> `TC: [<TC_ID>] · Tầng: [FE]`. Ba máy vẫn chạy. **Đừng gắn lại vào title** — và cũng đừng xoá dòng đó,
> xoá là ba máy lặng lẽ ngừng làm việc mà không cái nào báo lỗi.

Quy tắc chọn prefix title:
- Prefix `[FE]` / `[BE]` trên title phải theo layer/surface của testcase fail tại thời điểm log bug.
- Case execute bằng UI hoặc bug quan sát trực tiếp trên UI dùng `[FE]`, kể cả khi nghi ngờ root cause có thể nằm ở API/backend.
- Case execute trực tiếp API/backend dùng `[BE]`.
- Không tự đổi title UI bug sang `[BE]` chỉ vì phỏng đoán root cause; nếu cần, ghi nhận nghi ngờ root cause trong report/triage local.

Ví dụ:
- `Không đăng nhập được App 2 sau khi submit form`
- `API tạo bản ghi trả sai status khi thiếu required_field`

Description:

**Bốn tên mục phải IN ĐẬM** — `**Tiền điều kiện:**` · `**Bước:**` · `**Kết quả hiện tại:**` ·
`**Kết quả mong muốn:**`. Đo 06/10/2026 qua `GET /api/v2/projects`: project đang dùng
`textFormattingRule = markdown`, nên `**đậm**` render thật. Đổi project sang chế độ `backlog` thì phải
đổi cú pháp thành `''đậm''` — và phải ĐO lại bằng chính API đó chứ đừng đoán.

**Nội dung NGẮN GỌN, SÚC TÍCH, nhưng cực kỳ dễ hiểu.** Người đọc là dev đang sửa, không phải người
nghiệm thu. Mỗi dòng một ý, bỏ chữ đệm, bỏ câu dẫn kiểu "như đã nêu ở trên". Viết dài không làm bug rõ
hơn, nó chỉ làm dev đọc lướt rồi bỏ sót đúng chỗ cần sửa.

Description chỉ được có đúng 4 phần bên dưới, theo đúng thứ tự. Tất cả nội dung phải mô tả theo testcase/requirement đang fail:
1. `Tiền điều kiện`
2. `Bước`
3. `Kết quả hiện tại`
4. `Kết quả mong muốn`

Không thêm các phần khác vào description như `Tham chiếu`, `Reference`, `Evidence`, `Xác nhận trước khi log`, `Mức độ ảnh hưởng`, `Execution summary`, `TC ID`, `Source`, `Generated`, `Finding`, đường dẫn report/file, link tài liệu, bảng kết quả test, hoặc metadata automation. Các thông tin đó nếu cần thì ghi ở execution summary/report local, không đưa vào description.

Tiền điều kiện:
- Nếu có tiền điều kiện, ghi rõ dữ liệu/account/trạng thái cần có.
- Nếu không có, ghi `Không có`.

Bước:
- Bắt buộc dùng danh sách đánh số theo định dạng `1.`, `2.`, `3.` cho từng bước reproduce.
- Không dùng bullet `-`, `*`, `•` cho phần `Bước`.
- Mỗi bước phải là một hành động/kiểm tra cụ thể; không gộp nhiều hành động không liên quan vào cùng một bước.
1. Bước 1 rõ ràng, có dữ liệu test nếu cần.
2. Bước 2 rõ ràng.
3. Bước 3 rõ ràng.

Kết quả hiện tại:
- **Trình bày theo từng ý, mỗi ý một gạch đầu dòng `-` (một dòng riêng), KHÔNG viết một đoạn văn dài dồn nhiều ý.** Bug reporter sẽ render mỗi dòng thành 1 bullet trong description (mục có ≥2 ý → bullet list; 1 ý → 1 đoạn).
  - Tách các ý độc lập: mỗi hiện tượng/quan sát/số liệu là một dòng riêng (vd một dòng cho triệu chứng chính, một dòng cho số liệu minh hoạ, một dòng cho phạm vi ảnh hưởng).
  - Mỗi dòng là một câu/ý gọn; không nhồi nhiều mệnh đề ngăn bằng dấu `;` hay `,` dài lê thê trong cùng một dòng.
  - Không đánh số `1. 2.` (số dành cho mục `Bước`); dùng gạch đầu dòng.
- Mô tả actual result quan sát được khi execute.
- Bắt buộc viết bằng tiếng Việt chuẩn có dấu, chi tiết đủ để dev/BA hiểu lỗi mà không cần mở Playwright stack trace.
- Ưu tiên diễn giải theo hành vi sản phẩm/người dùng nhìn thấy, không paste raw Playwright locator, stack trace, call log hoặc assertion nội bộ vào description.
- Nếu lỗi automation dùng để phát hiện bug, chuyển thành mô tả nghiệp vụ ngắn gọn.
  Ví dụ không ghi: `expect(locator).toBeVisible() failed`, `Call log`, `waiting for getByText(...)`.
  Ví dụ nên ghi: `Sau khi nhập dữ liệu hợp lệ và bấm Save, hệ thống không hiển thị thông báo tạo thành công và vẫn ở màn Create`.
- Nếu là lỗi API/backend, tóm tắt theo ngôn ngữ nghiệp vụ kèm status/error code chính, không dán full response có thể chứa dữ liệu nhạy cảm.
- Không ghi nguyên văn bảng execution summary, bảng kết quả test, hoặc raw JSON response dài vào description.

Kết quả mong muốn:
- **Trình bày theo từng ý, mỗi ý một gạch đầu dòng `-` (một dòng riêng), KHÔNG viết một đoạn văn dài** — cùng quy tắc như `Kết quả hiện tại`. Bug reporter render mỗi dòng thành 1 bullet.
  - Mỗi yêu cầu/kỳ vọng là một dòng riêng; nếu có yêu cầu cho nhiều layer (vd BE cần trả field, FE cần render) thì mỗi layer một dòng.
  - Không đánh số; dùng gạch đầu dòng, câu gọn.
- Mô tả expected result theo testcase/requirement.

Cách truyền dữ liệu cho reporter:
- Khi tổng hợp payload cho `bug_reporter.js`, `actualResult` và `expectedResult` nên là **mảng các ý** (mỗi phần tử một bullet), hoặc chuỗi có các ý ngăn bằng xuống dòng/`<br>`. Reporter tự tách dòng và render bullet list.

Thông tin xác nhận trước khi log:
- Testcase liên quan, số lần rerun, nguyên nhân đã loại trừ, mức độ ảnh hưởng, flaky/environment note phải được ghi trong execution summary/report local.
- Không đưa các thông tin này vào description vì description chỉ có 4 phần bắt buộc ở trên.

Backlog comment:
- Không tự động tạo comment khi log bug hoặc update bug.
- Chỉ tạo comment khi user yêu cầu rõ, hoặc khi có tình huống đặc biệt bắt buộc cần lưu vết, ví dụ cần thông báo blocker/re-validation cho team dev sau khi issue đã tạo, hoặc báo kết quả **re-verify sau khi Dev fix**.
- Nếu bắt buộc phải comment, phải ghi rõ lý do trong execution summary/report local và comment phải ngắn, không chứa secret, không lặp lại nguyên văn description.
- **Format comment (dễ nhìn, ngắn gọn)**: KHÔNG viết một đoạn dài. Dùng cấu trúc:
  - 1 dòng tiêu đề trạng thái, vd `QA re-verify (build staging <ngày>): ✅ Đã fix` hoặc `⚠️ Chưa fix hẳn`.
  - **Gạch đầu dòng cho từng ý**; nếu vừa có phần đúng vừa có phần lỗi thì tách 2 nhóm ("Đã đúng:" / "Còn lỗi (<màn>):"), mỗi nhóm 1-3 bullet ngắn.
  - Tag người cần xử lý: Backlog dùng mention `@<tên đăng nhập>` trong nội dung comment (khác cú pháp `[~accountid:...]` của Backlog). CHƯA VERIFY cú pháp chính xác trên space `enetviet.backlog.com` — kiểm bằng comment thử trước khi dùng thật.
  - **Nhúng ảnh evidence trong comment**: cú pháp nhúng đúng là `![image][tên]` (project đang ở
    `textFormattingRule = markdown`) — xác minh từ tài liệu Nulab, không phải `!filename|width=900!`.
    ĐÃ ÁP DỤNG cho **description** (reporter tự sinh). Còn **comment** thì CHƯA ĐO: ảnh phải là attachment
    của chính comment đó mới phân giải được, và chưa ai thử. Nên comment vẫn đính kèm
    (`attachmentId[]` qua `POST /api/v2/issues/:id/comments`) kèm chữ "xem ảnh đính kèm".

Evidence attachment:
- Evidence không phải là một section trong description.
- Không ghi dòng `Evidence`, `Evidance`, `Evidence summary` hoặc link/file evidence trong description.
- **Ảnh tự hiện inline ở DƯỚI CÙNG description** — reporter sinh dòng nhúng, bạn KHÔNG dán tay.
  Cú pháp theo `textFormattingRule` của project (`markdown` ⇒ `![image][tên]`, `backlog` ⇒ `#image(tên)`),
  reporter đọc cờ đó từ API chứ không ghi cứng. Video không nhúng được, chỉ là attachment.
  Dán markdown ảnh vào ô tiền điều kiện/bước/KQ là nhân đôi ảnh và phá luật 4 mục.
- Upload screenshot hoặc video từ `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-results/artifacts/` hoặc `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-results/runs/<RUN_ID>/artifacts/` dưới dạng Backlog attachment riêng.
- Backlog attachment chỉ được là ảnh hoặc video, ví dụ `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.mp4`, `.webm`.
- Không upload `.md`, `.txt`, `.log`, `.json`, `.zip`, `trace.zip`, `error-context.md`, execution summary hoặc bất kỳ file text/diagnostic nào lên Backlog.
- Nếu có nhiều evidence, chỉ upload file ảnh/video liên quan trực tiếp tới testcase fail.
- **VIDEO BẮT BUỘC khi thao tác phức tạp** — nhiều bước, nhiều màn, state đổi theo thời gian,
  toast/modal tự đóng, cập nhật bất đồng bộ, kéo-thả. Một ảnh tĩnh không chở được trình tự, nên dev
  phải tự dựng lại và hay dựng sai. Bug đơn giản một màn một bước thì ảnh là đủ.
- **HIGHLIGHT BẮT BUỘC trên mọi ảnh evidence** — không còn là khuyến nghị. Chủ dự án chốt 06/10/2026.
  Ảnh không khoanh vùng thì dev phải tự dò xem lỗi nằm ở đâu trong một màn đầy dữ liệu, và đó chính là
  lúc ticket bị trả lại hỏi "lỗi ở chỗ nào". Chi tiết cách khoanh: trước khi attach, ảnh nên được khoanh vùng + gắn nhãn để dev/reviewer thấy NGAY điểm cần chú ý thay vì tự dò cả màn.
  - Quy ước màu: **đỏ = điểm còn lỗi** (kèm nhãn ngắn nêu sai gì + đúng phải thế nào, vd "✗ SAI: MM/DD/YYYY — cần DD/MM/YYYY"); **xanh lá = điểm đã đúng/đã fix** (vd "✓ Title cột đúng FS").
  - Cách làm (không cần thư viện ngoài): dùng Playwright inject overlay lên đúng element rồi chụp — với mỗi target lấy `getBoundingClientRect()`, thêm 1 `div` viền màu (absolute theo `scrollX/scrollY`) + 1 `div` nhãn nền màu, sau đó `screenshot({ fullPage: true })`; xoá overlay giữa các lần chụp. Mẫu tham khảo: `outputs/**/automation/annotate_*.js`.
  - Chụp full-page/scroll để không cắt vùng cần highlight (bảng rộng).

Output bắt buộc:
- Console summary không chứa secret.
- Execution summary có bảng:
  `TC ID | Backlog Issue | Status | URL`
- Nếu CREATE fail, report phải ghi rõ lỗi API đã sanitize.
- Nếu DRY_RUN, report/console phải thể hiện rõ là preview và Backlog chưa bị thay đổi.
```

---

## Severity của bug — chấm bằng CÂY QUYẾT ĐỊNH

Severity là **hậu quả THỰC TẾ của lỗi vừa tìm được**, khác `Priority` vốn là thứ tự sửa. Hai trục tách nhau
là bình thường. Lỗi cosmetic ở màn thanh toán trước ngày demo là `Trivial` nhưng ưu tiên `High`. Mất dữ liệu
ở module sprint này không ai dùng là `Blocker` nhưng ưu tiên `Medium`.

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

> ⚠️ **Chỗ này CHƯA có máy kiểm.** Câu "có máy kiểm nên CHẶN" ở bản cũ là của cột `Severity` trong bộ
> testcase. Cột đó đã bỏ, nên gate đó không còn áp vào đây.
> Severity của bug hiện chỉ do người chấm. Dùng đúng thang `Blocker|Critical|Major|Minor|Trivial`, và
> **không** ghi giá trị này vào `Priority`.
> ⚠️ **Backlog hiện CHƯA có field Severity.** Giá trị này chỉ sống trong testcase và report, **KHÔNG** đẩy lên Backlog. `Priority` của bug vẫn lấy từ cột §7, map xuống 3 mức của Backlog là High, Normal, Low.

> **Chuyển về đây 21/08/2026** từ `phase1/02_gen_testcases.md` §8. Trước đó Severity là một cột của bộ
> testcase — sai chỗ: lúc viết case thì lỗi chưa xảy ra, chấm hậu quả là đoán. Chấm ở đây, khi đã có lỗi thật.
> Lưu ý Backlog hiện CHƯA có field Severity ⇒ giá trị này sống trong mô tả bug + report, `Priority` của bug lấy
> từ cột `Ưu tiên` của testcase.
