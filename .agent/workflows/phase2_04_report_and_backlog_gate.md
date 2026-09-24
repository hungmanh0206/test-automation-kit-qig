# Phase 2 - Bước 4: Report, Promote Review Và Backlog Gate

> Tổng hợp kết quả execute, ghi shared change/promotion status và chỉ log Backlog bug khi case fail đủ điều kiện.

## Mục Đích

Tạo report Phase 2 rõ ràng, không log bug sai do setup/prompt/test data, không upload evidence sai loại lên Backlog và không âm thầm đưa task automation vào regression suite chung.

## Workflow

0. **SELF-REVIEW (G9 — lượt 2 TRƯỚC finalize, advisory):** `npm run self-review -- --task <TASK_KEY>` → checklist GỘP (preflight + design + row-quality + execution output/attestation) trong 1 báo cáo. Còn CHẶN thì SỬA trước; **đừng viết report / log bug khi self-review còn đỏ**. Ở BƯỚC FINALIZE dùng bản CÓ RĂNG: `npm run self-review:enforce -- --task <TASK_KEY>` → **exit 1** khi còn CHẶN. Vì sao cần: bản advisory luôn exit 0, còn `output_gate` ở publish KHÔNG kiểm mở rộng 5 trục một chữ nào ⇒ execute bám đúng chữ trong case rồi đẩy "toàn PASS" thì không gì cản (đã xảy ra thật). Khối "5 trục" xoá bằng `npm run expansion:plan` — vài giây, chỉ đọc Excel.
1. Ghi execution summary:
   - Tổng case.
   - PASS/FAIL/SKIP.
   - Pass rate thô + **unassisted pass rate** (loại các case cần người can thiệp giữa chừng).
   - **Autonomy log**: số vòng execute + số lần nhờ người cấp input (account/URL/data/xác nhận tay); nếu 0 ghi rõ.
   - Lý do skip.
   - Fail classification.
   - **Blocker root cause** cho mỗi SKIP/BLOCKED: `needs_hook`/`needs_account`/`needs_sandbox`/`spec_mismatch`/`manual_inherent`/`external_dependency` + owner/route (skill `precondition_setup_planner`).
   - Lỗi đã sửa.
   - Rủi ro còn lại.
2. Ghi Shared Change Log:
   - Nếu không sửa shared file, ghi `Không sửa shared file`.
   - Nếu có sửa, ghi file đã sửa, lý do, story có thể bị ảnh hưởng và regression scope đã chạy/chưa chạy.
3. Ghi Automation Promotion Status:
   - `Not requested`
   - `Pending review`
   - `Approved and promoted`
   - `Rejected/Deferred`
4. Với từng fail nghi product bug, kiểm tra gate:
   - **TRA `knowledge/decisions/` TRƯỚC**: `node scripts/qa/decisions.js --check "<triệu chứng>" --module <Module>`.
     Nếu khớp một quyết định `false_positive`/`by_design` ⇒ **KHÔNG log lại** (lần trước dev đã kết luận và
     Backlog đã Rejected — log lại là bounce lần hai). Muốn log thì phải có **bằng chứng MỚI khác lần trước**
     (spec đổi / dev đã fix rồi hồi quy / điều kiện khác) và **ghi rõ điểm khác đó** trong bug. Không khớp
     ≠ được bỏ qua điều tra. Sau khi triage xong, quyết định mới (bug bị Rejected, case PASS-kèm-note,
     chốt cách test) phải ghi lại — skill `decision_recorder`, kiểm `npm run decisions:check`.
   - Đã execute thật.
   - Đã rerun đủ để loại flaky/setup/data/prompt issue.
   - **ĐÃ LOẠI `script_error` — bắt buộc, đây là nguồn log-bug-sai số 1.** Rerun **KHÔNG** cứu được lỗi
     bắt sai element: sai locator thì fail **lặp lại ổn định**, trông y hệt product bug. Trước khi log,
     phải chứng minh **đã thao tác đúng đối tượng**: (a) evidence highlight **đúng element** đã tương tác,
     **và** (b) xác minh lại bằng **một đường định vị độc lập** (locator khác/`safe_target.one()`) **hoặc**
     thao tác tay trên UI. Không chứng minh được → `failureLayer: script_error`
     (`.agent/config/verdict_taxonomy.json`, `loggableAsBug: false`) → **KHÔNG log Backlog**, sửa script rồi chạy lại.
     Dấu hiệu nghi script_error: giá trị đọc được thuộc section khác · bấm xong màn không đổi như mong đợi ·
     lỗi biến mất khi làm tay · code dùng `.first()`/`force:true`/`mouse.click(x,y)`/regex `body.innerText`.
   - Expected result đã xác nhận đúng.
   - **Bug dạng "hệ thống CHO PHÉP làm X" phải trích bản đồ `knowledge/system/`** (`SM-*` state machine /
     `PM-*` ma trận quyền) làm nguồn expected. Loại bug này (huỷ đơn đã thanh toán, xoá giao dịch đã xác nhận,
     role thấp gọi được API role cao) **không thể** chứng minh bằng cách bấm app — app cho làm chính là cái
     đang nghi sai, lấy app làm expected là tautology. Chưa có bản đồ ⇒ **hỏi BA/Dev xác nhận trước**, ghi
     `knowledge/system/` (skill `system_mapper`) rồi mới log; hoặc log kèm ghi rõ "chờ BA xác nhận thiết kế".
     Ngược lại, hành vi nằm trong `transitions`/`allow` mà mình tưởng sai thì **không phải bug** — là mình hiểu sai spec.
   - Actual result có evidence rõ.
4b. **Gate chất lượng output — THỰC THI, tự chạy (không phải kiểm bằng mắt).**
   - Test Execution: `npm run gate:output -- --status <testcase-status.json>` **tự chạy `scripts/qa/output_gate.js`** → CHẶN khi comment run-on/dính debug `key=value`, step thiếu status/evidence, evidence không phải ảnh/video, hoặc case phức tạp thiếu video (thêm `--fix` để tự dọn comment).
   - **Gate CHẶN → TỰ SỬA trong session rồi chạy lại tới khi PASS**; KHÔNG ghi kèm vi phạm, KHÔNG chờ user nhắc. Chỉ `--qa-approved` khi QA có lý do rõ (được log).
   - **Bắt buộc tạo bug/ghi kết quả execute QUA script kit** (`bug_reporter.js` cho bug, `merge_execution_status.js` cho status) — KHÔNG sửa tay Result trên Sheets rồi coi như đã ghi (sửa tay = bỏ qua gate → sai 4 phần/evidence/comment).
   - 🔀 **Đồng bộ Google Sheet**: `node scripts/convert_excel/merge_execution_status.js <xlsx đã tải> <testcase-status.json> --task <TASK_KEY>` chạy **cùng gate này** trước khi ghi — merge Pass/Fail/Pending vào cột `Result` của file local, rồi agent `update_file` qua Drive MCP đè lên Sheet. Evidence (ảnh/video) vẫn ở local `test-results/artifacts/`, KHÔNG đính lên Sheet (khác Google Sheet trước đây neo evidence từng bước) — xem `scripts/integrations/backlog/README.md` (mục cảnh báo Google Sheet) và plan migrate công cụ cũ→Sheet.
4a. **Đối soát mở rộng 5 trục:** `TASK_ENV=... npm run expansion:plan -- --audit --enforce` — CHẶN nếu có finding
   ghi PASS/FAIL mà không có `oracle_ref` (nhất quán KHÔNG phải bằng chứng của đúng). `merge_execution_status.js` cũng chặn ở
   `plan_guard`, nhưng chạy ở đây thì biết sớm hơn một bước.
4a2. **Báo cáo rò (leak):** `TASK_ENV=... npm run leak:report` — bug do người ngoài tìm ra thì phải chỉ được máy nào
   lẽ ra bắt được. Không có báo cáo này thì "lọt bug" mãi là chuyện cảm tính.
5. Chạy Backlog dry-run trước.
6. Chỉ log Backlog thật khi user yêu cầu hoặc prompt hiện tại cho phép.
7. Backlog description chỉ gồm:
   - Tiền điều kiện.
   - Bước.
   - Kết quả hiện tại.
   - Kết quả mong muốn.
8. Evidence upload lên Backlog chỉ là ảnh/video.
9. **Thu learning data — BẮT BUỘC sau mọi lần execute** (không phải chỉ khi có bug).

   **Mặc định TỰ ĐỘNG**: reporter `scripts/qa/learn_reporter.js` (khai cuối `reporter` trong `playwright.config.js`)
   tự thu ngay khi `playwright test` kết thúc — không cần gọi tay. Chỉ chạy tay khi execute bằng script tự chế
   (không qua Playwright runner), hoặc reporter bị tắt (`LEARN_AFTER_RUN=0`):

   ```bash
   TASK_ENV=profiles/<TASK_KEY>/task.env npm run learn
   ```

   `scripts/qa/learn_task.js` (idempotent — chạy lại KHÔNG nhân đôi) tự làm:
   - `knowledge/metrics/{runs,tc-history}.jsonl` ← KPI/flaky từ `results.json` (nguồn cho `reliability_index`).
   - `knowledge/historical_execution/<TASK_KEY>__<date>.json` ← snapshot pass/fail **theo module nghiệp vụ**
     (map `tcId → Module` từ testcase canonical) — đây là input `risk_score.js` cộng fail/total để ra Likelihood,
     và là nguồn coverage của `dashboard`. Thiếu bước này ⇒ risk model **mãi cold-start**, dashboard rỗng.
   - `knowledge/index.json` ← entry `historical_execution`.

   `self_review` CHẶN nếu đã execute mà thiếu snapshot/KPI của task (learning loop đứt).

9b. **Sau khi log bug Backlog (Bước 4)** — nạp bug vào knowledge để `risk_score` có `bugCount`:

   ```bash
   TASK_ENV=profiles/<TASK_KEY>/task.env npm run learn:bugs:apply
   ```

   Lấy bug **từ Backlog** theo label `auto-bug` + story ⇒ chỉ học bug đã qua gate; idempotent (chạy lại chỉ
   đồng bộ `backlog_status`). `self_review` cảnh báo nếu có case FAILED mà `knowledge/bugs/` chưa có entry.

9c. Ghi Knowledge Entry (skill `learning_recorder`, Suggest-only) — **chỉ cho bug đã qua gate ở Bước 4**:
   - Với mỗi bug đã qua gate (đã loại flaky/setup/data/prompt), ghi `knowledge/bugs/<TASK_KEY>__<slug>.json`; nếu đã xác định root cause thì ghi/nối `knowledge/root_causes/<slug>.json` (link 2 chiều).
   - Ghi snapshot pass/fail theo module vào `knowledge/historical_execution/<TASK_KEY>__<date>.json` (lấy số liệu từ execution summary, gồm unassisted pass rate).
   - Cập nhật `knowledge/index.json`.
   - KHÔNG ghi case `BLOCKED_SETUP`/`SKIP_SETUP`/flaky/setup vào `knowledge/bugs/`. Không ghi secret/PII.

9d. **Sao lưu knowledge ghi tay — NGAY SAU 9c, vì lượt này vừa sinh record mới:**
   `KNOWLEDGE_BACKUP_DIR=<thư mục NGOÀI repo> npm run knowledge:backup` → rồi `-- --verify <bundle>`.
   Chỉ sao lưu `domain/ system/ decisions/ setup_recipes/ environment/ locators/ explorations/` — phần
   KHÔNG nạp lại được từ nguồn máy (là công sức xác nhận của BA/dev qua nhiều tháng). `bugs/`,
   `historical_execution/`, `metrics/` CỐ Ý không sao lưu: nạp lại được từ Backlog/Google Sheet.
   Vì sao bắt buộc: `knowledge/**` bị gitignore (dữ liệu công ty) ⇒ **không remote nào giữ hộ**, mất máy
   là mất hẳn. Đây là loại mất mát duy nhất trong kit mà không script nào cứu được.
   Máy nhắc: `preflight` cảnh báo khi có record ghi tay mà chưa khai `KNOWLEDGE_BACKUP_DIR`;
   `self-review` cảnh báo thêm khi đã khai mà **chưa có bundle** hoặc bundle **cũ ≥7 ngày**.

## Rules

- Không log Backlog cho case skip.
- Không log Backlog nếu fail do prompt/test/setup chưa chuẩn.
- Không upload `.md`, `.txt`, `.log`, `.json`, `.zip`, `trace.zip` hoặc execution summary lên Backlog.
- Không tự comment Backlog nếu workflow không yêu cầu comment.
- Không promote task-scoped automation vào `tests/fe/` hoặc `tests/api/` nếu chưa có review/approval rõ.
- Chỉ ghi Knowledge Entry (`knowledge/bugs/`) cho bug đã qua Backlog gate (Bước 4); không ghi setup/flaky/skip vào learning data.

## Outputs

| Output | Vị trí |
|---|---|
| Execution summary | `<TASK_OUTPUT_DIR>/reports/execution-summary.md` (gồm unassisted pass rate + autonomy log + blocker root-cause) |
| Capability gap cập nhật | `<TASK_OUTPUT_DIR>/reports/capability-request.md` (nếu Phase 2 phát hiện thêm `needs_hook`/`needs_account`/`needs_sandbox`) |
| Shared change log | Trong execution summary |
| Automation promotion status | Trong execution summary |
| Backlog dry-run result | Report liên quan |
| Backlog bug log nếu có | Execution summary hoặc local bug log |
| Knowledge entry (bug/root cause) | `knowledge/bugs/`, `knowledge/root_causes/` (chỉ bug đã qua gate) + `knowledge/index.json` |
| Execution snapshot | `knowledge/historical_execution/<TASK_KEY>__<date>.json` |
