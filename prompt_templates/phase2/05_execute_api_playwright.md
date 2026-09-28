# Prompt Phase 2 - Thực thi Playwright API

> Chạy: `Đọc file này và chạy với TASK_KEY=<TASK_KEY>`. Rule: non-negotiables ở `CLAUDE.md` (đã auto-load). Digest: `.agent/rules/core_rules.md`. Chỉ mở `RULE_GLOBAL.md` **ở đúng mục cần** (mỗi gạch đầu dòng của digest có ghi `§`) — đừng nạp cả file.

> ⚡ **Kỷ luật execute (RULE_GLOBAL §"Execution Discipline"):**
>
> - Batch NHIỀU case trong 1 lượt: ÍT script toàn diện, chạy song song, không "mỗi case 1 vòng".
> - KHÔNG mặc định TODO hay SKIP khi chưa thử. Dùng hết fixture, deal, account đã cấp; case negative thì tự tạo input.
> - KHÔNG hỏi lắt nhắt: gom câu hỏi 1 lần.
> - Báo cáo gộp, ít vòng.

> 🛑 **CHECKLIST 6 KHỐI — xác nhận TRƯỚC KHI execute** (forcing function; `output_gate` sẽ **CHẶN** nếu output vi phạm — đọc & làm, đừng lướt):
> 1. **Nguồn & scope** — `TASK_KEY`+`PROJECT_OUTPUT_DIR` có; đọc testcase canonical LOCAL (tải mới nhất từ Google Sheet qua Drive MCP) + `.agent/config/project_context.md` + catalog Setup Strategy. KHÔNG dựa hội thoại cũ.
> 2. **Oracle độc lập** — mỗi case có "Kết quả mong đợi" cụ thể (status code/field/giá trị theo API contract). Oracle rỗng hoặc app==app (tautology) → DỪNG, lấy giá trị spec. *(gate: oracle-rỗng = CHẶN · tautology = cảnh báo)*
> 3. **Batch & drive thật** — gom NHIỀU case/ÍT script chạy song song; dùng hết fixture/deal/account; case negative tự tạo input (payload lỗi, ID không tồn tại). KHÔNG TODO/SKIP khi chưa thử.
> 4. **Phân tầng kết quả** — mỗi case → PASS/FAIL/SKIP/BLOCKED_SETUP/SKIP_SETUP. FAIL phải PHÂN TẦNG: product/API bug vs `setup_failure` vs infra/flaky. "Không phán được" KHÔNG thành PASS. *(gate: FAIL thiếu tầng-lỗi = CHẶN)*
> 5. **Loại flaky** — FAIL rerun 2–3 lần loại flaky/setup TRƯỚC khi kết luận product/API bug / log Backlog.
> 6. **Evidence** — mọi case (PASS+FAIL)+step có ảnh/video đúng màn (response/assertion hiển thị), highlight, mask PII; case phức tạp có video. CẤM `.json/.md/.log`. *(gate: thiếu evidence/step-status = CHẶN)*

> 📋 **Attestation (G6) — sau execute, ghi vào `testcase-status.json`:** field `attestation` = `{ "oracleSource": "<sheet|spec|api-contract>", "executed": <số case đã chạy>, "allEvidenceAttached": true, "failuresClassified": true, "rerunDone": true }`. Gate ĐỐI CHIẾU tự-khai với sự thật (executed thật, evidence, tầng-lỗi) — lệch = cảnh báo. Khai ĐÚNG, đừng tick suông.

> 🧩 **Helper (tuỳ chọn) — `scripts/utils/test_context.js`:** automation standalone có thể `const ctx = createTestContext({ taskKey, tcId })` để gom sẵn 1 chỗ: `ctx.evidence()` (EvidenceRecorder đúng task/run), `ctx.onCleanup(fn)`/`ctx.runCleanup()` (dọn data LIFO), `ctx.taskOutputDir`/`ctx.metadata` — thay vì tự wire rời rạc.

# Vai trò
Bạn là Senior API Test Engineer dùng Playwright API mode.

# Nhiệm vụ
Thực thi BE API testcases bằng Playwright request context, không mở browser.

# Đầu vào
- Swagger URL: [SWAGGER_URL_OR_ENV_KEY]
- Base URL: [BASE_URL_OR_ENV_KEY]
- Auth: lấy động từ API login hoặc env, không hardcode token.
  - **App KHÔNG có login API sạch**, vì SPA tự refresh token trong trình duyệt. Dùng **Token Broker** (`tests/fe/support/auth/tokenBroker.ts`): giữ 1 phiên SPA đã login sống bằng helper login của app, rồi gọi `brokerRequest(page, method, url, {data})`. Token lấy TƯƠI từ chính request SPA gửi, và 401 hoặc 403 sẽ tự reload, refresh, retry.

    **KHÔNG dán `*_API_TOKEN` thủ công, KHÔNG mở DevTools copy lại giữa chừng.** Chỉ cần user và password trong `task.env`. Execute không đứt khi access token hết hạn giữa lượt chạy.
- Project Context: `.agent/config/project_context.md`
- Env Template: `.env.example`
- Project Output: `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/`
- RUN_ID: optional; bắt buộc nếu chạy song song cùng một `TASK_KEY`.
  Khi có `RUN_ID`, không sửa testcase Markdown/Excel chính trong lúc execute; ghi status/actual/evidence vào run-scoped report/status.
- Swagger env: `App 1_SWAGGER_URL`, `APP2_SWAGGER_URL`
- API base env: `App 1_API_BASE_URL`, `APP2_API_BASE_URL`
- Testcases: nguồn canonical local `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/test-cases/from-sheet/*.xlsx` — agent tải bản MỚI NHẤT về từ Google Sheet qua Drive MCP ở Bước 0 TRƯỚC mỗi lượt execute. Execute đọc file local — không gọi Drive/Backlog cho từng case.

# Precondition Resolution Pass (bắt buộc, chạy TRƯỚC khi generate/execute)
> 📚 **TRA KHO HỌC TRƯỚC KHI TỰ MÒ.** Rẻ hơn mò lại nhiều lần, và đây là chỗ 80% thời gian bị tiêu.
> - **`knowledge/setup_recipes/`** — đã có ai dựng state này chưa? Đọc `steps` (ĐÚNG THỨ TỰ) + `pitfalls` (thứ chỉ biết sau khi vấp) + `verification`. Dựng xong mà chưa verify thì coi như chưa có state.
> - **`knowledge/environment/`** — đọc trước khi kết luận "app lỗi". Token TTL, login throttle và lockout, headless trắng, quirk toolchain đều nằm ở đây. Fail vì mấy thứ này là `setup_failure` hoặc `infra`, KHÔNG phải product bug.
> - **`knowledge/locators/`** — element khó (menu ⋮, popup, cổng thanh toán): đọc `symptom` xem có khớp triệu chứng đang gặp không, rồi làm theo `technique`. Fail ngắt quãng thường là SAI KỸ THUẬT THAO TÁC, không phải flaky vô cớ.
> - **`knowledge/system/`** type `data_model` — `test_implication` cho biết mô hình dữ liệu bắt test phải làm khác đi thế nào (vd sau mutation phải resolve theo TÊN, không dùng lại id).
>
> Vấp xong mà kho chưa có record thì **ghi thêm** (`npm run howto:check` → `howto:index`) — đó là lúc thông tin còn tươi nhất.


Cho toàn bộ selected TC, chạy pass này trước khi sinh hoặc chạy bất kỳ spec nào:

1. Đọc selected TC từ nguồn canonical local `test-cases/from-sheet/*.xlsx` (đã tải từ Google Sheet ở Bước 0). Cách dựng precondition lấy từ **tag `[<method>]`** ở đầu cell `Tiền điều kiện`; chi tiết (endpoint/payload/fixture id · verification · cleanup) đọc `### Setup Readiness` trong `reports/phase1-summary.md`, và tra `knowledge/setup_recipes/` trước khi tự mò. Bộ testcase CŨ chưa có tag thì đọc `### Precondition Execution Matrix` như trước.
2. Với mỗi selected TC, lấy `Setup Method` **từ tag `[<method>]` ở đầu cell `Tiền điều kiện`** (bộ cũ chưa có tag thì đọc `### Precondition Execution Matrix` của `phase1-summary.md`), rồi map:
   - `api` → gọi business/public test API theo `Setup Source`.
   - `factory`/`test_hook` → dùng factory/hook tương ứng.
   - `pre_existing`/`pre_existing_fixture` → verify fixture tồn tại, không tạo mới.
   - `ui` → chỉ setup qua UI khi không có API/factory và vẫn đúng mục tiêu testcase.
   - `manual` (`Readiness=Manual-only`) → không tự setup, đánh dấu SKIP hợp lệ kèm lý do.
3. Reuse setup layer dùng chung `tests/support/setup/` (factories/hooks/fixtures/cleanup/contracts); phần đặc thù story tạo task-scoped trong `<TASK_OUTPUT_DIR>/automation/setup/` (namespace theo `RUN_ID` nếu chạy song song). Không sửa shared khi story khác đang chạy. Không thêm DB client/DB query mới (chỉ dùng guarded client `db/uatDbClient.ts` cho read-only verify UAT). Setup/verify fail ném/được phân loại `SetupFailure` → `setup_failure`.
4. Verify precondition theo `Setup Verification` TRƯỚC khi gọi request chính/assertion. Verify fail thì KHÔNG chạy bước test chính.
5. Nếu setup/verify fail → phân loại `setup_failure` (KHÔNG phải product/API bug, KHÔNG log Backlog): sửa setup/data/auth/hook/env rồi rerun. `Readiness=Needs hook` mà capability (hook/mock/sandbox) chưa có → `BLOCKED_SETUP` + nêu missing capability cụ thể. `Readiness=Manual-only` → `SKIP_SETUP` + lý do.
6. Sau khi chạy xong (PASS/FAIL), cleanup theo `Cleanup/Rollback`, scope theo `RUN_ID`; ghi rõ data đã dọn / lý do không dọn được.

Ghi kết quả vào execution summary mục `Precondition Resolution`: mỗi TC → setup method, verify pass/fail, blocker (nếu có), cleanup status. Chỉ khi precondition đã verify đạt mà response vẫn sai contract mới được phân loại product/API bug.
Nếu precondition chỉ có thể DỰNG bằng DB hoặc backend internal state → `Manual-only`/`BLOCKED_SETUP` + manual steps (không dựng state bằng DB). VERIFY state có thể dùng read-only UAT DB qua guarded client `tests/support/setup/db/uatDbClient.ts` (read-only, chỉ SELECT) khi API/UI không expose.

# Các bước thực thi
1. Echo `PROJECT_OUTPUT_DIR`, `TASK_KEY`, `TASK_OUTPUT_DIR`, `RUN_ID` nếu có; nếu sai task thì dừng.
2. Đọc `.agent/config/project_context.md` và testcase API từ nguồn canonical local `test-cases/from-sheet/*.xlsx`.
3. Chạy `Precondition Resolution Pass` (section ở trên) cho toàn bộ selected TC trước khi generate/execute. Dùng Swagger spec từ App 1 hoặc App 2 theo testcase; KHÔNG tự đoán payload nếu contract đã có.
4. Gọi request.post/get/put/delete theo từng TC.
5. Assert status code, response body schema, headers và response time.
6. Cập nhật testcase output: Status + Actual Result + Evidence/log path.
   Nếu có `RUN_ID`, chỉ cập nhật run-scoped report/status, không ghi trực tiếp testcase Markdown/Excel chính.
   - Với API FAIL thuần, chụp ảnh visual evidence page hiển thị request/response đã redact (log text chỉ để debug local, KHÔNG phải evidence).
   - Khi log Backlog cho API FAIL, không upload log/text/markdown/JSON; nếu cần attachment Backlog, render visual evidence page hoặc screenshot response summary đã sanitize.
   - Với API FAIL nằm trong UI/E2E flow hoặc cần chứng minh hành vi người dùng, kèm screenshot fail; flow phức tạp cần video.
7. Chạy selected API suite/TC IDs/endpoints trước; chỉ chạy toàn bộ API suite khi mode yêu cầu ALL hoặc vừa sửa shared API client/auth/schema helper.
   Automation mới sinh mặc định ghi dưới `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/automation/`; chỉ ghi vào `tests/api/` khi cần core suite và file đã namespace theo `[TASK_KEY]`.
8. Với case FAIL/SKIP/flaky, sửa nguyên nhân không thuộc product bug rồi rerun targeted ít nhất 2 vòng; chỉ full rerun khi thay đổi shared layer.
9. Sau mỗi vòng chạy, phân tích PASS/FAIL/SKIP và nguyên nhân fail/skip.
10. PASS -> next TC khi assertion thực sự validate đúng status/schema/body/business rule.
11. FAIL -> retry/auto-heal nếu lỗi do auth/setup/data/mock/dependency/timeout/test code; sau khi sửa phải rerun.
12. Nếu FAIL còn lại là product/API contract issue, rerun case fail theo ngưỡng `.agent/config/verdict_taxonomy.json` §rerun (min–max, hiện 2–3 lần) để loại trừ flaky/setup trước khi kết luận.
13. SKIP chỉ được phép khi không thể chạy sau khi đã thử sửa setup/data/dependency hợp lý; report phải ghi TC ID, lý do skip, có thể sửa để chạy được không.
14. Backlog bug chỉ xử lý sau khi execution report hoàn tất, fail đã được rerun/xác nhận và user/prompt cho phép.

# 5 trục mở rộng quanh case — phần áp cho tầng API (BẮT BUỘC)

Luật đầy đủ: **`RULE_GLOBAL.md` §5 trục mở rộng quanh case**. Execute API chỉ bám đúng chữ trong case thì lọt đúng
những lớp bug mà API là nơi CHỨNG MINH được:

- **Trục 3 — chuỗi lưu trữ.** Không dừng ở `200 OK`: ghi lại **payload đã gửi** và **response đọc lại**, rồi so với
  giá trị đã nhập. `npm run probe:persist -- --seed money` sinh giá trị mồi **phân biệt** (không tròn, không 0) để
  "trùng nhau" không thể là ngẫu nhiên; `--chains` chỉ ra **mắt đứt** ⇒ nói được TẦNG lỗi. API trả success mà bản
  ghi không được tạo / field bị lưu 0 là lớp bug đã xảy ra thật nhiều lần.
- **Trục 2 — cùng giá trị, khác nơi hiển thị.** Giá trị API trả về phải khớp UI/list/tab đồng bộ. `npm run
  xsurf:diff` đọc được cả 3 loại bề mặt (nhãn trên màn · cột lưới · API+jsonPath). Case API PASS mà màn hiển thị
  khác thì bug vẫn ra production.
- **Trục 4/5 — nhánh & trạng thái.** Cùng endpoint với loại đơn/tiền tệ khác, và với bản ghi ở trạng thái kế cận
  (đã hủy / hoàn / thanh toán một phần) thì còn đúng? `npm run fixture:matrix -- --discover` cho biết môi trường
  đang CÓ dữ liệu ở ô nào — đừng bỏ case vì "không có data" khi chưa dò.
- **Guard theo trạng thái:** gọi thẳng API cho hành động mà UI đã chặn, ví dụ sửa đơn đã thanh toán hay xoá
  giao dịch đã xác nhận. Đây là chỗ API test làm được mà UI test không làm được. Phải kèm bằng chứng
  **dữ liệu không đổi**.

**MỌI LỆCH KHỎI KỊCH BẢN PHẢI GHI SỔ.** Khi bị chặn, xu hướng tự nhiên là *làm cho nó chạy* — chờ thêm, retry,
đổi locator, refresh, đi đường khác. Mỗi lần như vậy có thể đang **lấp một bug**. Ghi bằng
`newLedger(tcId).note('extra-wait', 'lý do')` (`scripts/lib/expansion/deviation.js`); pass **sau khi** lệch ⇒
verdict **`PASS_WITH_DEVIATION`** + liệt kê deviation trong Actual. Và: FAIL bất định mà **chưa nêu được cơ chế**
(race · cache · đổi ngày 00:00 …) thì là **`SUSPECT_REAL_BUG`**, KHÔNG được dán nhãn flaky rồi bỏ qua.

**Đừng giả định bộ kiểm bắt được bug — CHỨNG MINH.** `npm run mutation:check` tiêm lỗi qua `page.route()`
(không chạm dữ liệu UAT) rồi xem máy kiểm có đỏ. Đo lần đầu: máy kiểm-kê-field **0/4** vì nó kiểm *tập field*,
KHÔNG kiểm *giá trị*. Với tầng API nghĩa là: `200 OK` + schema đúng **không** chứng minh giá trị đúng — phải so
giá trị với oracle hoặc so 2 bề mặt. Mutant sống sót = vùng mù có bằng chứng, ghi vào `reports/`.

**TÍN HIỆU MÔI TRƯỜNG — assert, đừng chỉ dùng khi đã fail.** Trang/API đã mở rồi nên nghe thêm **không tốn**
lượt tải nào: `const sig = attachEnvSignals(page)` (`scripts/utils/runtime/env_signals.js`) → cuối case đọc
`sig.report()`. `pageerror` là **zero-tolerance**: có JS exception là finding dù case PASS. 4xx **cố ý** của case
negative phải khai trước `sig.expect4xx(/\/api\/x/, 'lý do')`, không khai thì bị tính là tín hiệu lạ. Bắt được cả
bug KHÔNG liên quan tới case đang chạy (UI xanh mà API phụ 500) — thứ không case nào assert.

**ĐIỀU KIỆN SỐNG CÒN — không có oracle thì KHÔNG kết luận.** Mở rộng mà không có nguồn thì agent sẽ mặc định
"app đang hiện thế là đúng" ⇒ tautology nhân theo số trục. Ba loại kết luận:

- `EXPANSION_FINDING`: app tự mâu thuẫn. Không cần oracle ngoài, log bug được, nhưng **không phải verdict của
  case gốc**.
- `PASS` hoặc `FAIL`: **chỉ khi** có `oracle_ref` trỏ `BR-`, `SM-`, `PM-`, `SS-`, `DM-` hoặc `UI-`.
- `OBSERVATION`: không neo, nên **nhất quán không có nghĩa là đúng**. Ghi kèm câu hỏi mở.
 Máy tự hạ cấp PASS→OBSERVATION khi thiếu neo và `self_review` **CHẶN** nếu file finding có PASS
không neo. Độ sâu theo **risk band** — xem chi phí trước khi chạy: `npm run expansion:plan`.

**Đóng vòng:** bug do người ngoài tìm ra là **lỗi của máy** — phải chỉ ra máy lẽ ra bắt được
(`npm run leak:report -- --require-machine`), không có máy thì đề xuất máy mới. Log bug kèm `--found-by kit|human`.

# Quy tắc bắt buộc
- Không được đổi expected status/body tùy tiện để làm test PASS.
- Không được bỏ schema/body assertion quan trọng.
- Không được mock API chính đang cần kiểm thử contract thật, trừ khi testcase là fault injection hoặc dependency ngoài scope.
- Không được skip case vì thiếu data nếu có thể tạo data bằng API/factory và rollback.
- Setup phải theo tag `[<method>]` trong cell `Tiền điều kiện` (chi tiết ở `### Setup Readiness` của `phase1-summary.md` + `knowledge/setup_recipes/`): dựng qua api/factory/test_hook/pre_existing/ui, KHÔNG dựng bằng DB, và phải xác minh state trước khi chạy assertion chính.
- Không dùng direct DB connection, `TEST_DB_*`, `TEST_DATABASE_URL`, `DATABASE_URL`, `PG*` hoặc backend source inspection để làm tiền điều kiện (DỰNG state). Read-only verify/chẩn đoán trên **UAT DB** được phép qua guarded client `tests/support/setup/db/uatDbClient.ts` (chỉ `LIB_MASTER_DB_*`, read-only, chỉ SELECT); DB không phải evidence Backlog, PII phải mask.
- Nếu token/auth/env sai, phải sửa cấu hình và rerun trước khi cân nhắc skip.
- Không coi API execution hoàn tất nếu còn fail do prompt chưa rõ, setup, test data, auth, dependency, timeout hoặc execute flow.

# Verify GIÁ TRỊ dữ liệu BE trả về — không chỉ status/schema (BẮT BUỘC)

**Phải NHẠY BÉN khi execute**: áp phản xạ điều tra trong **`.agent/rules/qa_instincts.md`** — `200` KHÔNG có nghĩa là đúng (đọc body: `errors`/`success:false`/`data` rỗng; GraphQL gần như luôn 200 kể cả khi lỗi). Đọc response message cho 4xx/5xx để phân loại đúng (input test vs auth `BLOCKED` vs BE `FAIL`).

Status `200` + schema đúng KHÔNG đủ để PASS. Bug logic/dữ liệu BE lọt nhiều nhất ở tầng **giá trị**:
- **Value đúng, không chỉ kiểu**: assert đúng GIÁ TRỊ nghiệp vụ trong body (id/tên/số/tổng/trạng thái/quan hệ) so với giá trị đã **tính độc lập**, không chỉ "có field, đúng type".
- **Phân biệt trạng thái rỗng**: `null` vs `""` vs `[]` vs thiếu hẳn key vs `0` theo spec. Field "trống" **trái spec** = bug, KHÔNG bỏ qua.
- **Tính toán/tổng/đếm/pagination**: kết quả tính, `total`/`page`/`hasNext` khớp dữ liệu thực; foreign key resolve đúng tên (không lộ id thô / `undefined`).
- **Data consistency**: cùng dữ liệu ở nhiều endpoint/nhiều màn phải KHỚP nhau — đối chiếu chéo.
- **Sensitive/internal field**: response KHÔNG lộ password/hash/token/PII vượt quyền/internal flag; nếu lộ = **security bug** (log theo mục Security).
- Khi kết quả bất thường/nghi ngờ, đối chiếu lại request đã gửi (query/path/body/header) để loại trừ lỗi test trước khi kết luận product/API bug.

# Evidence & Comment (BẮT BUỘC — theo RULE_GLOBAL)
- Evidence bắt buộc cho MỌI case đã execute (PASS và FAIL) + MỌI step. Hợp lệ CHỈ ảnh/video (`.png/.jpg/.jpeg/.webp/.mp4/.webm`) — CẤM `.json/.md/.txt/.log/.html/.csv/trace.zip`. Với API: chụp ảnh visual evidence page hiển thị response/data đã render; log request/response chỉ là diagnostic local, KHÔNG phải evidence. Mask PII khách + redact token/secret. Luồng phức tạp/cross-app → kèm video.
- `comment` (Test Run) gọn 1–2 câu kết quả; KHÔNG dán debug (key=value, dump response, regex); KHÔNG prefix trạng thái (`[PASS]/[Positive]/[Negative]`); caveat xuống dòng `Lưu ý:`; KHÔNG placeholder `Xem xxx.json`. Chi tiết: RULE_GLOBAL §Evidence + §Comment.

# Quy tắc kỹ thuật API

> **Playbook bắt buộc đọc: `.agent/rules/playwright_api.md`.** Nó chứa những phần mục này KHÔNG nhắc lại, và cũng là chỗ hay bị bỏ:
>
> - **§Assertions.** Luôn assert status. Assert field, schema và business rule. Negative phải assert đúng error code theo spec. Mutation phải verify side-effect.
> - **§Anti-Patterns.** Chỉ assert `res.ok()` cho API business-critical, đổi expected status để pass, bỏ assertion body quan trọng, mock API chính khi cần kiểm contract thật.
> - **Guardrail DB read-only.**
>
> Mâu thuẫn thì theo file đó.

- Dùng request context, không dùng page/browser.
- Token lấy động qua API login hoặc env; không hardcode.
- Site URLs, credential và integration links lấy từ env variables hoặc `.agent/config/project_context.md`.
- API base URL và Swagger URL phải lấy từ `App 1_API_BASE_URL` / `App 1_SWAGGER_URL` hoặc `APP2_API_BASE_URL` / `APP2_SWAGGER_URL`.
- Không ghi password/token vào logs, `task.md` hoặc testcase output.
- Test data: `auto_api_[testName]_[timestamp]@test.com`.
- Validate contract schema bằng zod hoặc `expect().toMatchObject`.
- Sau mỗi TC, bắt buộc cập nhật testcase output với `Status`, `Actual Result`, `Evidence`.
- `Actual Result` của case FAIL phải rõ: endpoint/method, request data chính, expected status/body, actual status/body, assertion error và log/evidence path.
- Khi ghi `testcase-status.json`, **case FAILED phải kèm step nào fail và evidence của bước đó**. Điền `steps[]`, trong đó bước lỗi là `FAILED` kèm `evidence` còn bước chưa chạy là `TODO`. Hoặc dùng shortcut `failedStep` và `failedStepEvidence`, schema ở `run_phase2_template.md`. Nhờ vậy Test Execution hiện đúng bước lỗi thay vì chỉ FAIL tổng.
- API evidence không được chứa bearer token, password, cookie, API key hoặc secret khác; phải redact trước khi ghi file/report/Backlog.
- Nếu testcase API là một phần của luồng phức tạp, nhiều bước hoặc cross-site, lưu thêm video/screenshot từ browser flow liên quan nếu có.
- Backlog attachment chỉ được là ảnh/video. Không upload `.md`, `.txt`, `.log`, `.json`, `.zip`, `trace.zip`, `error-context.md` hoặc execution summary lên Backlog.
- Không ghi actual result chung chung như `API failed`; phải nêu response thực tế quan sát được.

# Đầu ra
- Task-scoped automation mặc định: `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/automation/`
- Core API spec chỉ khi được approve/merge vào regression: `tests/api/[TASK_KEY].api.spec.ts`
- Shared API fixture/helper chỉ sửa khi cần thay đổi chung và đã ghi rõ trong report: `tests/api/fixtures/api-auth.ts`
- `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/test-results/playwright-report/`
- `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/test-results/results.json`
- Nếu có `RUN_ID`, dùng:
  - `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/test-results/runs/[RUN_ID]/playwright-report/`
  - `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/test-results/runs/[RUN_ID]/results.json`
  - `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/test-results/runs/[RUN_ID]/artifacts/`
- Testcase output đã cập nhật Status, Actual Result, Evidence.
- Nếu có `RUN_ID`, Status, Actual Result, Evidence nằm trong run-scoped report/status và không ghi đè testcase Markdown chính.
