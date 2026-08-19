# Global Rules

> Quy tắc bắt buộc để giữ Test Automation Kit an toàn, nhất quán và dễ audit.

> ## 📍 ĐỌC THEO MỤC — đừng nạp cả file
>
> File này ~27.000 ký tự (**≈ 12–17k token**). Nạp trọn mỗi lượt là lãng phí: **74% nội dung áp cho MỌI phase**,
> phần riêng Phase 1 chỉ 7% và Phase 2 chỉ 19% — nên chia file theo phase gần như không tiết kiệm được gì
> (đọc Phase 1 vẫn = 81% bản đầy đủ), lại thêm N chỗ để drift. Cách đúng là **đọc đúng mục cần**.
>
> Thứ tự nên dùng: `CLAUDE.md` (6 non-negotiables, auto-load) → `.agent/rules/core_rules.md` (digest ~4–5k
> token, mỗi gạch đầu dòng ghi sẵn `(Đầy đủ: RULE_GLOBAL §…)`) → **chỉ mở mục dưới đây khi cần chi tiết**.
>
> | Cần gì | Mở mục |
> |---|---|
> | Secret, PII, mask evidence | [§Security](#security) |
> | `TASK_KEY`/`PROJECT_OUTPUT_DIR`, nơi ghi output | [§Project And Output](#project-and-output) |
> | Nhiều story chạy song song, đụng file dùng chung | [§Parallel Story Safety](#parallel-story-safety) · [§Shared Change Gate](#shared-change-gate) |
> | Sửa/đặt automation ở đâu | [§Task-Scoped Automation Code](#task-scoped-automation-code) · [§Automation Promote Review](#automation-promote-review) |
> | **Phase 1** — requirement mơ hồ, hỏi trước khi gen | [§Analysis & Ambiguity Gate](#analysis--ambiguity-gate-phase-1--đọc-kỹ-hỏi-trước-khi-gen) |
> | **Phase 2** — 5 trục mở rộng quanh case + luật đóng vòng | [§5 trục mở rộng](#5-trục-mở-rộng-quanh-case--luật-đóng-vòng-phase-2--có-máy-đứng-sau) |
> | **Phase 1** — chiều coverage: khai phạm vi, gắn tag, máy đếm | [§Chiều coverage](#chiều-coverage-phase-1--khai-phạm-vi-gắn-tag-có-máy-đếm) |
> | **Phase 2** — chạy sao cho thông suốt, không TODO/SKIP bừa | [§Execution Discipline](#execution-discipline-kỷ-luật-thực-thi--chạy-thông-suốt) |
> | Ghi kết quả, verdict, rerun | [§Execute Results](#execute-results) |
> | Lỗi thuộc FE hay BE | [§Phân tầng lỗi FE hay BE](#phân-tầng-lỗi-fe-hay-be--bắt-buộc-kiểm-api-trước-khi-kết-luận) |
> | Ảnh/video, định dạng, highlight | [§Evidence](#evidence--quy-chuẩn-bắt-buộc) |
> | Viết comment trên Test Run | [§Comment kết quả](#comment-kết-quả-test-execution--quy-chuẩn-trình-bày) |
> | Được phép log bug chưa | [§Jira Bug Gate](#jira-bug-gate) |
> | DB, capability tự chạy | [§Executable QA capabilities](#executable-qa-capabilities-autonomy--safety) |
> | Dọn file tạm | [§Cleanup Rules](#cleanup-rules) |

## Purpose

Tài liệu này định nghĩa các rule chung áp dụng cho mọi workflow, prompt, skill, script và report trong kit.

## When To Use

| Scenario | Apply These Rules |
|---|---|
| Sinh testcase | Có |
| Publish testcase Jira | Có |
| Execute automation | Có |
| Log Jira bug | Có |
| Rerun bug đã fix | Có |
| Viết report/output | Có |
| Dọn file tạm | Có |

## Inputs

| Input | Source |
|---|---|
| Task profile (giá trị ĐỘNG per-task) | `profiles/<TASK_KEY>/task.env` (`TASK_ENV=...`). Sinh từ template `profiles/task.env.example`. |
| Project output root | `PROJECT_OUTPUT_DIR` (trong task.env) |
| Task scope | `TASK_KEY` (trong task.env) |
| Parallel run scope | `RUN_ID` nếu chạy nhiều session cùng `TASK_KEY` |
| Runtime secrets (TĨNH, dùng chung) | `.env.local`, `.env`, CI env hoặc secret store (base URL + API key Figma/Confluence/Jira/Xray/HubSpot) |
| Workflow-specific context | Prompt template hoặc `.agent/config/project_context.md` |

**Tạo profile task (một lần, chỉ 1 lệnh):** khi user yêu cầu "Tạo profile cho `<TASK_KEY>`" → chạy `node scripts/utils/create_profile.js <TASK_KEY> [--project-output outputs/<PROJECT>]` (hoặc `npm run profile:create -- <TASK_KEY>`). Lệnh copy `profiles/task.env.example` → `profiles/<TASK_KEY>/task.env`, prefill `TASK_KEY`+`JIRA_STORY_KEY`, KHÔNG ghi đè nếu đã tồn tại; QA điền credential + link. Profile CHỈ chứa giá trị động: `PROJECT_OUTPUT_DIR, TASK_KEY, JIRA_STORY_KEY, JIRA_STORY_URL, CONFLUENCE_REQUIREMENT_URL, CONFLUENCE_BRD_URL, FIGMA_FILE_URL, GOOGLE_DOCUMENT_ID, GOOGLE_SHEET_URL, LMS_USERNAME/PASSWORD/API_TOKEN, OPS_USERNAME/PASSWORD/API_TOKEN` (+ assignee/HubSpot per-task nếu cần). File task.env KHÔNG commit (gitignore `profiles/**/task.env`).

## Outputs

| Output | Rule |
|---|---|
| Markdown/report | Tiếng Việt chuẩn có dấu, UTF-8, không lộ secret. |
| Test results | Nằm dưới `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-results/`. |
| Evidence | Chỉ **ảnh/video** làm evidence (xem §"Evidence — Quy chuẩn bắt buộc"); `trace/log` là diagnostic local, KHÔNG phải evidence. Lưu đúng scope task. |
| Jira testcase publish | Step riêng trong phạm vi Phase 1; chỉ publish từ Excel canonical sau khi QA xác nhận. Excel là source of truth khi gen/publish; **Phase 2 execute mặc định lấy nguồn từ Xray** (`TESTCASE_SOURCE=xray`, kéo về canonical local `from-xray/*.xlsx`), `excel` là opt-out. |
| Jira bug | Chỉ tạo khi fail đã được xác nhận là product/API bug. |
| Testcase (md/Excel) | Cột "Kết quả mong đợi" đánh số **KHỚP từng bước** (bước 1→KQ 1, 2→2…), xuống dòng `<br>`; **CẤM gộp range** kiểu `1-2.`/`2-3.`; không ghi chung chung ("thành công"/"đúng"). Áp cả khi gen VÀ khi chỉnh sửa TC thủ công. Chi tiết: prompt gen Phase 1 §6. |

## Rules

### Language

- Giao tiếp, phân tích, report và delivery note mặc định dùng tiếng Việt chuẩn có dấu.
- Tên biến, hàm, class và file nên dùng tiếng Anh.
- Technical terms, endpoint, method, enum/status và code identifier có thể giữ nguyên tiếng Anh.
- Comment trong code chỉ thêm khi giúp hiểu logic không hiển nhiên.

### Security

- Không in API key, password, token, cookie, private key hoặc connection string ra chat, logs, Markdown, testcase output hoặc reports.
- Không commit `.env`, `.env.local`, service-account JSON hoặc file chứa credential thật.
- Nếu secret từng bị chia sẻ hoặc commit, phải rotate trong provider console.
- Không dùng direct DB connection trong workflow chuẩn của kit. Ngoại lệ DUY NHẤT: read-only verify/chẩn đoán trên **UAT DB** qua guarded client `tests/support/setup/db/uatPgClient.ts` (read-only: chỉ SELECT trong transaction READ ONLY). Chỉ cấu hình credential kho UAT (`LIB_MASTER_DB_*`) — kho UAT/PROD tách biệt, không cấu hình creds thì không truy cập được. Vẫn cấm biến generic `TEST_DB_*`/`TEST_DATABASE_URL`/`DATABASE_URL`/`PG*` và mọi import `pg` ngoài client đó. DB là oracle PHỤ (verify/chẩn đoán): KHÔNG dựng/mutate state, KHÔNG phải evidence Jira, KHÔNG thay oracle từ spec; PII đọc ra phải mask + cấm export file.
- Không yêu cầu AI đọc toàn bộ source backend để execute testcase. Phase 2 chỉ dùng UI/API public-business contract, artifact Phase 1, credential test, fixture có sẵn, test hook/sandbox nếu team cung cấp.

### Project And Output

- Project name, URL, domain, Jira key và module name phải lấy từ config/env/prompt.
- Không hardcode theo project cụ thể trong workflow hoặc script dùng chung.
- `PROJECT_OUTPUT_DIR` là output root bắt buộc, ví dụ `outputs/<YOUR_PROJECT>`.
- `TASK_KEY` là scope của task/feature và luôn nằm dưới `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/`.
- Playwright report, evidence và results nằm dưới `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-results/**`.
- Nếu chạy nhiều session cùng một `TASK_KEY`, bắt buộc truyền `RUN_ID` qua env/CLI để output execute nằm dưới `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-results/runs/<RUN_ID>/`.
- Khi có `RUN_ID`, execution/rerun/Jira local report nên nằm dưới `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/reports/runs/<RUN_ID>/`.
- Khi có `RUN_ID`, không cập nhật trực tiếp testcase Markdown/Excel chính trong `test-cases/` trong lúc execute; ghi `Status`, `Actual Result` và `Evidence` vào run-scoped report/status trước. Chỉ merge ngược vào testcase chính khi user chọn run đó làm kết quả canonical.
- `RUN_ID` chỉ được chứa chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.

### Parallel Story Safety

- Mỗi story nên chạy trong một conversation AI riêng để giữ context sạch.
- Câu lệnh đầu tiên của mỗi conversation phải nêu rõ `TASK_KEY`.
- Trước mọi thao tác ghi file hoặc chạy command, agent phải echo scope:
  - `PROJECT_OUTPUT_DIR`
  - `TASK_KEY`
  - `TASK_OUTPUT_DIR`
  - `RUN_ID` nếu có
  - Workflow/phase đang chạy
- Nếu scope echo không khớp yêu cầu user, phải dừng trước khi ghi file/chạy lệnh.
- Không sửa `.env` hoặc `.env.local` chung khi có session khác đang chạy.
- Với command execute/report/Jira, ưu tiên truyền `PROJECT_OUTPUT_DIR`, `TASK_KEY` và `RUN_ID` qua env hoặc CLI args từng lệnh.
- Không chạy song song cùng một `TASK_KEY` nếu không có `RUN_ID`.
- Không chạy song song các workflow có ghi đè requirement/testcase chính của cùng một `TASK_KEY`, trừ khi user xác nhận chiến lược merge riêng.
- Không sửa shared config/helper như `playwright.config.js`, `package.json`, runtime helper hoặc common prompt khi story khác đang execute, trừ khi user xác nhận đây là thay đổi chung.

### Phase-Separated Story Execution

- Mỗi story không bắt buộc chạy liền một mạch. Luồng chuẩn là:
  `Requirement -> Generate Testcase -> Excel (source of truth) -> QA confirmation -> Auto Publish Jira -> chờ Dev implement -> Phase 2 -> chờ Dev fix bug nếu có -> Re-run`.
- Sau bước generate testcase, Excel trong `<TASK_OUTPUT_DIR>/test-cases/` là source of truth khi **gen/publish**. Nội dung testcase phải sửa ở Excel rồi re-publish — không sửa trực tiếp trên Xray làm nguồn authoring.
- **Phase 2 execute mặc định lấy nguồn từ Xray** (`TESTCASE_SOURCE=xray`): kéo về canonical local `<TASK_OUTPUT_DIR>/test-cases/from-xray/*.xlsx` rồi execute từ đó (Xray publish TỪ Excel nên nhất quán). `TESTCASE_SOURCE=aio` đọc `<TASK_OUTPUT_DIR>/test-cases/from-aio/*.xlsx` (kéo bằng `npm run aio:pull:write -- --story <KEY>`; cùng bộ cột/định dạng nên parser canonical không phân biệt nguồn). `TESTCASE_SOURCE=excel` (opt-out) đọc `<TASK_OUTPUT_DIR>/test-cases/*.xlsx`. Dù nguồn nào, execute đọc file canonical LOCAL — không gọi Jira/Xray cho từng case.
- Auto Publish Jira là step riêng trong phạm vi Phase 1, chạy bằng prompt riêng sau khi QA xác nhận Excel/testcase. Không publish Jira thật khi chưa có QA confirmation rõ ràng.
- Test management tool là Xray: testcase publish mặc định tạo Xray `Test` issue (`JIRA_TESTCASE_ISSUE_TYPE=Test`), không dùng generic `Test Case` nếu project đã cấu hình Xray.
- **Đang chuyển Xray → AIO Tests** (Xray đóng băng sau 21/08/2026). Công tắc DUY NHẤT là `TEST_MANAGEMENT_TOOL` (`xray` | `aio`). Đặt `aio` thì 4 script Xray (`publish_testcases` · `push_test_execution` · `update_xray_steps` · `cleanup_xray_tests`) **tự CHẶN kèm lệnh AIO thay thế** — đây là forcing function, không phải quy ước, vì hai bộ script ăn CHUNG đầu vào nên chạy nhầm KHÔNG báo lỗi mà ghi trót lọt vào sai hệ thống. Trên AIO: case **không phải Jira issue** (mất Test Set/link-requirement/assignee/precondition-issue), Test Execution → **Cycle**, Test Plan → **thư mục cycle**, và evidence neo được xuống **từng bước**. Không có API xoá ⇒ mọi script mặc định dry-run, sai phải dọn tay trên UI. Chi tiết: `scripts/integrations/aio/README.md`.
- Publish testcase lên Jira phải đọc từ Excel canonical. Chạy dry-run trước nếu cần preview; publish thật chỉ khi QA/user approve. Ghi kết quả vào `<TASK_OUTPUT_DIR>/reports/jira-testcase-publish-summary.md`.
- Phase 1 có thể tự động hóa gần như toàn bộ phần thiết kế testcase khi input đủ. Phase 2 chỉ execute phần có thể chạy an toàn qua UI/API public hoặc setup capability đã có; case không dựng được state qua API/factory/hook/fixture/sandbox an toàn thì ghi `Manual-only`, `SKIP_SETUP` hoặc `BLOCKED_SETUP` kèm capability còn thiếu — KHÔNG dùng DB để DỰNG state thay thế (DB chỉ được read-only verify trên UAT, xem ngoại lệ ở trên).
- Mỗi case chưa tự động hoá được phải gắn 1 Blocker Root Cause (`needs_hook`/`needs_account`/`needs_sandbox`/`spec_mismatch`/`manual_inherent`/`external_dependency`), không gộp chung thành "backend state" (xem skill `precondition_setup_planner`). Capability gap (`needs_hook`/`needs_account`/`needs_sandbox`) phải đưa vào `reports/capability-request.md` và được review như Definition of Ready trước khi kickoff Phase 2. Pass rate phải kèm unassisted pass rate (loại các case cần người can thiệp giữa chừng) để không che giấu chi phí human-in-the-loop.
- Khi bắt đầu mỗi phase mới, agent phải đọc lại artifact canonical của task hiện tại:
  - `task.md`
  - `reports/phase1-summary.md` nếu chạy Phase 2
  - `reports/execution-summary.md` hoặc Jira bug log nếu chạy Re-run
- Không dùng context hội thoại cũ làm source chính nếu artifact local đã có; artifact dưới `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/` là nguồn chuẩn.
- Không reuse `TASK_KEY`, `RUN_ID`, testcase scope hoặc Jira bug scope từ phase/story khác nếu user chưa nhắc lại rõ.
- Nếu user không nêu `TASK_KEY` trong yêu cầu hiện tại, agent không được dùng `TASK_KEY` từ `.env`, `.env.local` hoặc context cũ để quyết định scope; phải hỏi lại hoặc dừng.
- `.env` chỉ là nguồn runtime config sau khi scope đã được user xác nhận, không phải nguồn quyết định story đang chạy.
- Nếu Phase 2 hoặc Re-run bắt đầu sau thời gian chờ Dev, phải echo lại scope trước khi ghi file/chạy command, dù cùng conversation.

### Task-Scoped Automation Code

- Khi nhiều story có thể chạy song song, automation mới sinh cho một story phải ưu tiên nằm trong phạm vi task:
  `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/automation/`
- Nếu bắt buộc ghi vào `tests/fe/` hoặc `tests/api/`, file spec phải có namespace theo `TASK_KEY`, ví dụ `<TASK_KEY>.spec.js`.
- Nếu chạy song song cùng một `TASK_KEY`, spec/output thử nghiệm phải thêm `RUN_ID` hoặc nằm trong run-scoped folder.
- Setup layer (factory/hook/fixture/cleanup/contract) dùng chung ở `tests/support/setup/`. Setup mới của một story tạo trước ở `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/automation/setup/`, reuse tối đa `tests/support/setup/`; chỉ promote phần generic vào shared khi đã ổn định. Setup layer không dựng/mutate state bằng DB; chỉ được read-only verify qua guarded client `tests/support/setup/db/uatPgClient.ts` (UAT, read-only, chỉ SELECT).
- Không sửa shared helper/page object/fixture/config nếu có session khác đang execute, trừ khi user xác nhận đây là thay đổi chung.
- Nếu cần sửa shared helper để fix automation thật, phải ghi rõ trong report: file đã sửa, story bị ảnh hưởng, scope regression cần rerun.
- Không để spec task-specific mặc định thành shared regression suite nếu chưa qua review/merge.

### Shared Change Gate

- Shared files gồm `tests/fe/**`, `tests/api/**`, `tests/support/**`, `playwright.config.js`, `package.json`, runtime helper, fixture/page object/helper dùng chung và prompt/rule chung.
- Trước khi sửa shared file, agent phải xác định đây là thay đổi task-specific hay thay đổi chung.
- Nếu là thay đổi task-specific, ưu tiên chuyển sang `<TASK_OUTPUT_DIR>/automation/` thay vì sửa shared file.
- Nếu là thay đổi chung, phải có xác nhận rõ của user hoặc ghi blocker chờ xác nhận.
- Khi đã sửa shared file, execution summary phải ghi: file đã sửa, lý do, story có thể bị ảnh hưởng, scope regression đã chạy hoặc chưa chạy.

- **Gate mới mà CHẶN theo một quy ước MỚI ⇒ quy ước đó phải được viết vào file này (canonical) trong CÙNG thay đổi.** Nếu không, người dùng bị chặn bởi một luật **không tồn tại trong nguồn rule** — và ai chỉ đọc `CLAUDE.md → core_rules` sẽ không bao giờ biết luật đó. Đã xảy ra thật: `dim:coverage --enforce`, `output_gate` (bằng chứng theo tag) và `domain:trace-back` chặn/cảnh báo theo quy ước **tag chiều**, trong khi từ "chiều" xuất hiện **0 lần** ở `RULE_GLOBAL.md`, `core_rules.md`, README, USER_GUIDE, QUICKSTART suốt 3 ngày.
  - Đây là luật cho NGƯỜI, cố ý **không** làm thành máy kiểm: bản máy ("mọi npm script gate phải được canonical nhắc TÊN") đo ra **19/24 script sẽ báo oan** — `secret:scan` chặn theo §Security, quy tắc *có* nhưng tên lệnh *không*, và như vậy mới đúng. Biến canonical thành danh mục lệnh còn tệ hơn.
  - Kiểm bằng mắt khi review: gate mới chặn cái gì → cái đó có nằm ở §nào trong file này không?

### Automation Promote Review

- Task-scoped automation không tự động trở thành regression suite chung.
- Sau khi Phase 2 PASS ổn định, có thể đề xuất promote automation vào `tests/fe/` hoặc `tests/api/`.
- Setup helper task-scoped ở `<TASK_OUTPUT_DIR>/automation/setup/` chỉ promote vào `tests/support/setup/` khi đã generic (không gắn một task) và có review/approval.
- Promote chỉ thực hiện khi đã có review/approval rõ.
- Khi promote, file core phải namespace theo `TASK_KEY` và không làm mất task-scoped artifact gốc.
- Nếu chưa approve promote, giữ automation trong `<TASK_OUTPUT_DIR>/automation/` và report là task-scoped only.

### Analysis & Ambiguity Gate (Phase 1 — đọc kỹ, hỏi trước khi gen)

1. **Đọc tài liệu THẬT KỸ, KHÔNG qua loa.** Mọi tài liệu được cấp (BRD/spec/requirement, Jira, Confluence, Figma, Swagger, doc) phải đọc kỹ TOÀN BỘ phần **trong scope** — mọi mục, **bảng, ghi chú, footnote, comment, phụ lục** liên quan — không lướt tiêu đề rồi đoán (phần ngoài scope được lướt để tiết kiệm token; nhưng trong scope thì không được qua loa). Bóc hết: acceptance criteria, business rule, validation, enum/giá trị, state & transition, edge case, xử lý lỗi, phân quyền/role, biên. **Đối chiếu chéo** các nguồn (Jira ↔ BRD ↔ Figma ↔ Swagger); mâu thuẫn thì **NÊU RA**, không tự chọn bừa. Phân biệt rõ "tài liệu ghi thật" vs "agent suy luận" — phần suy luận/mờ chính là nguyên liệu cho câu hỏi làm rõ.
2. **Chốt hỏi-đáp làm rõ TRƯỚC khi gen testcase (gate cứng).** Sau phân tích, TRƯỚC khi sinh bất kỳ testcase nào: gom **MỌI** điểm mờ/phân vân thành **MỘT** danh sách câu hỏi đánh số (`Q1, Q2…`) trong `<TASK_OUTPUT_DIR>/reports/phase1-clarifications.md`; mỗi câu bám **spec cụ thể** (giá trị/URL/element/điều kiện/enum/oracle) + **assumption mặc định đề xuất** + **phần scope bị chặn** nếu chưa trả lời. Phân loại **Blocking** (Critical/High: acceptance mơ hồ, giá trị/enum/oracle thiếu, rule validation, biên/state chưa định nghĩa, phạm vi in/out) vs **Non-blocking** (Medium/Low: có default hợp lý). Ghi cả hai loại để QA thấy hết điểm mờ.
3. **Blocking chưa trả lời → KHÔNG gen phần đó.** Ghi `AMBIGUITY_GATE: PENDING` vào `task.md` và **DỪNG**, chờ QA/BA trả lời (hoặc tick chấp nhận assumption). TUYỆT ĐỐI không tự đoán qua điểm Blocking rồi gen. Chỉ khi mọi câu Blocking đã RESOLVED → **phân tích lại + chỉnh** coverage map/scope theo câu trả lời → đặt `AMBIGUITY_GATE: RESOLVED` → mới bắt đầu gen. Câu Blocking không được trả lời → phần scope đó ghi "chờ làm rõ" ở Coverage Gaps, KHÔNG gen case cho nó. Medium/Low không chặn: tự áp assumption (ghi rõ) + Coverage Gaps, vẫn gen.

### Chiều coverage (Phase 1 — khai phạm vi, gắn tag, có máy đếm)

Bộ testcase có **hai trục**: *module/màn* trả lời "test **ở đâu**", *chiều* trả lời "hỏi **loại câu hỏi nào**" (validate field · hiển thị · công thức · BE conformance · guard · bảo mật · hiệu năng · change-impact…). Phủ kín trục thứ nhất mà trống một ô trục thứ hai thì bộ **vẫn trông đầy đủ** — và đó là đường mà bug thật đã lọt (đo trên một bộ 530 case: §6 E2E **0 case**, §17 change-impact **0–1**, case hiển thị **≈12%** dù mục đó là BẮT BUỘC).

1. **Khai phạm vi chiều TRƯỚC khi gen.** `<TASK_OUTPUT_DIR>/requirements/dimension_manifest.json`: mỗi chiều là `"required"` hoặc `"n/a"`, và **`n/a` PHẢI có lý do** trong `na_reasons`. Khai `n/a` cho chiều mà artifact chứng minh là có (vd có `requirements/figma/**` mà khai `design: n/a`) ⇒ **CHẶN**.
2. **Mỗi case gắn TAG CHIỀU trong tiêu đề**, cạnh tag loại: `[Positive][Display] …`. Không thêm cột — tag nằm trong cột `Trường hợp kiểm thử`. Bảng chiều→tag ở `prompt_templates/phase1/02_gen_testcases.md` §0b; nội dung từng chiều ở `prompt_templates/phase1/dimensions/`.
3. **Gắn tag rồi thì `Kết quả mong đợi` phải mang BẰNG CHỨNG của chiều đó** — `[Calc]` cần giá trị số tự tính · `[Display]` cần chuỗi trích nguyên văn/mẫu định dạng/danh sách cột · `[Guard]` cần mã 4xx hoặc "bị chặn" **kèm** "dữ liệu không đổi" · `[BEData]` cần tên property hoặc phân biệt `null`/rỗng/`0` · `[Resilience]` cần "lần hai/trùng" **kèm số** · `[Perf]` cần ngưỡng có đơn vị. Tag chứng minh **có mặt**, bằng chứng mới chứng minh **đủ sâu** (§0b-bis).
4. **Case có oracle nghiệp vụ phải trỏ về rule**: `[Positive][Calc][BR-RECIPBANK-001] …`. `npm run domain:trace-back` cảnh báo case thiếu ref, bắt ref trỏ id không tồn tại, và `--apply` tự append `covered_by` cho rule.
5. **Máy kiểm:** `npm run dim:coverage` (`-- --enforce` để chặn) · `npm run domain:trace-back` · `output_gate --mode gen-testcase` (bằng chứng theo tag). Bộ **chưa có tag** thì `dim:coverage` **tự từ chối chặn** thay vì báo oan — nhưng đó là trạng thái *chưa được gác*, không phải *đã đạt*.

### Execution Discipline (Kỷ luật thực thi — chạy thông suốt)

Áp dụng khi execute (Phase 2, Re-run, Partial Rerun). Mục tiêu: **tối đa coverage mỗi lượt, tối thiểu gián đoạn**. Vi phạm = execute lắt nhắt, đứt đoạn, phải làm lại.

1. **Batch tối đa mỗi lượt — KHÔNG lắt nhắt.** Trước khi chạy, liệt kê TẤT CẢ case khả thi của đợt rồi gom vào ÍT script toàn diện phủ NHIỀU case; case độc lập chạy song song. CẤM kiểu "mỗi case một script / một vòng rồi dừng-báo". Một lượt phải verify được nhiều case, không phải 1–2 cái.
2. **KHÔNG mặc định `TODO`/`SKIP` khi CHƯA THỬ.** Trước khi đánh 1 case là chưa chạy: (a) rà và DÙNG HẾT fixture/Deal ID/tài khoản/data đã được cấp trong task — không bỏ sót input đã nhận; (b) case negative/lỗi → **tự tạo input để tái hiện** (vd ID không tồn tại, giá trị biên) thay vì chờ fixture; (c) drive thật UI/API rồi mới kết luận. Chỉ để `TODO`/`BLOCKED` khi **chặn thật**: capability chưa có (payment/sandbox chưa reconcile, account phân quyền), fixture đặc thù chưa được cấp, hoặc cần BA/dev làm rõ scope / fix bug. Khi để lại phải ghi **lý do cụ thể + điều kiện để chạy được** (không ghi chung chung).
3. **KHÔNG hỏi lắt nhắt.** Việc read-only / verify / tạo fixture trong quyền hạn đã thiết lập → thực thi ngay, không xin xác nhận từng bước ("chạy luôn không?"). Nếu buộc phải hỏi (thiếu input hoặc cần quyết định nghiệp vụ) → **GOM toàn bộ câu hỏi + input cần thiết vào MỘT lần**, không hỏi rải rác.
4. **Báo cáo gộp, ít vòng.** Chỉ dừng để báo khi đã xong MỘT CỤM lớn hoặc gặp chặn thật; không tường thuật từng thao tác nhỏ. Mỗi lần báo = nhiều kết quả.
5. Ranh giới không đổi: vẫn tuân thủ **Jira Bug Gate**, **Evidence**, **PII/Security**, **Parallel Story Safety**, **Shared Change Gate** — siết coverage/tốc độ KHÔNG được nới các gate này.

### 5 trục mở rộng quanh case + luật đóng vòng (Phase 2 — có máy đứng sau)

Bug **không sống theo dòng testcase** mà sống theo **bề mặt** (màn × luồng × trạng thái). Đo trên một task thật:
69 bug, gần như tất cả do NGƯỜI báo trong khi kit chạy xanh — nguyên nhân là execute chỉ bám đúng chữ trong case.

1. **Mỗi case đã execute phải được mở rộng theo 5 trục**, mỗi trục có máy: ① field cùng khối (`spec:extract` →
   `ui_conformance_check`) · ② cùng giá trị khác nơi hiển thị (`xsurf:diff`) · ③ chuỗi lưu trữ
   `form→payload→API→UI` (`probe:persist`) · ④ nhánh/biến thể và ⑤ trạng thái kế cận (`fixture:matrix`).
2. **Chiều ngược là bắt buộc:** `spec:gap` — section/field build CÓ mà tài liệu KHÔNG NHẮC. Section chưa được khai
   nghĩa là **chưa ai soi**, KHÔNG phải "đã kiểm và không sao"; mỗi dòng là câu hỏi cho BA, phải ghi vào `reports/`.
3. **"Chưa kiểm được" phải được nói ra, không được im lặng thành đạt.** Dưới 2 bề mặt đọc được · chuỗi khuyết điểm
   đo · ô ma trận trống · section chưa khai — tất cả là trạng thái *chưa kiểm*, phải xuất hiện trong báo cáo.
4. **Kết luận sai lệch phải chỉ ra MẮT ĐỨT, không nói "hệ thống lưu sai".** Ghi giá trị từng điểm
   (`form 1.000.000 → payload 1000000 → API 0`) ⇒ nêu được TẦNG lỗi; payload là bằng chứng khách quan nên bug
   không bị bounce qua lại giữa FE và BE.
5. **Đóng vòng: bug do người ngoài tìm ra là LỖI CỦA MÁY.** Với mỗi bug đó phải trả lời được *"máy nào lẽ ra bắt
   được?"* — (a) có máy mà không chạy ⇒ ghi vì sao (thiếu catalog/fixture/chưa bind) và sửa; (b) có máy đã chạy mà
   vẫn lọt ⇒ bổ sung luật **kèm test khoá luật**; (c) không có máy nào ⇒ ghi đề xuất máy mới vào `reports/`.
   CẤM kết thúc bằng "sẽ chú ý hơn" — chú ý không phải forcing function. Máy đo: `leak:report --require-machine`.
6. **ĐIỀU KIỆN SỐNG CÒN — mở rộng phải có ORACLE, nếu không thì KHÔNG được kết luận.** Khi mở sang field lân cận
   / bề mặt khác, kit phải biết **cái đúng là gì**. Không có nguồn thì mặc định "app đang hiện thế là đúng" ⇒
   tautology **nhân theo số trục**, tạo ra PASS giả nhìn rất thuyết phục. Ba loại kết luận, không có loại thứ tư:
   - `EXPANSION_FINDING` — app **tự mâu thuẫn với chính nó** (lệch giữa 2 bề mặt · mắt đứt trong chuỗi lưu trữ ·
     field thừa/thiếu so tài liệu). Không cần oracle ngoài, vì hai nơi cùng nguồn mà khác nhau thì chắc chắn một
     nơi sai. Log bug được, **KHÔNG phải verdict của case gốc** (cố ý không map Xray — trộn vào là pass-rate mất nghĩa).
   - `PASS`/`FAIL` — **chỉ khi** có `oracle_ref` hợp lệ (`BR-`/`SM-`/`PM-`/`SS-`/`DM-`/`UI-`) và `expected` lấy từ đó.
   - `OBSERVATION` — không có neo. **Nhất quán ≠ đúng**: 4 điểm khớp nhau vẫn có thể sai cả 4 (ca thật: USD không
     quy đổi, `form/payload/api/ui` đều `10` trong khi đúng là `260.500`). Bắt buộc kèm câu hỏi mở; không vào pass-rate.
   Máy ép: `scripts/lib/expansion/finding.js` tự hạ cấp PASS→OBSERVATION khi thiếu neo; `self_review` **CHẶN** nếu
   file finding có PASS/FAIL không neo (kể cả bị sửa tay).
7. **Độ sâu theo RISK BAND, không mở 5 trục cho mọi case.** Chi phí là thật: 1 task đang **1021 file / 136 MB**
   evidence; mở đủ trục cho một bộ 530 case ước lượng **~3740 lượt tải trang · ~9,4 giờ · ~335 MB**. Band lấy **cái
   nặng hơn** giữa `Mức độ rủi ro` và `Ưu tiên`: high → đủ trục runtime · medium → ③+⑤ · low → ③. Xem chi phí TRƯỚC
   khi chạy: `npm run expansion:plan`.
8. **Phân vai Phase 1 / Phase 2 — đừng làm trùng.** ①field ②surface ③persist ⑥lặp-đồng-thời ⑦chiều-ngược **cần
   runtime** (DOM/response thật) ⇒ Phase 2. ④nhánh ⑤trạng-thái-kế-cận **đoán trước được từ tài liệu**
   (permission matrix, state machine) ⇒ **case do Phase 1 sinh** (§10 Cross-layer Guard) để được đếm coverage và
   publish lên TCM; Phase 2 chỉ đo **ô nào chạy được** (`fixture:matrix --discover`). Thứ chỉ sống ở execute thì
   chỉ lượt chạy đó biết.
9. **ASSERT tín hiệu môi trường, không chỉ dùng để triage.** Mỗi lượt execute đã mở trang thật và gọi API thật ⇒
   đang có sẵn kho tín hiệu mà **không case nào assert**: JS exception (`pageerror`) · request **4xx/5xx chạy nền**
   (UI xanh trong khi một API phụ đang 500) · response **lệch contract** (`tests/support/setup/contracts/`) ·
   rác dữ liệu còn lại sau cleanup. Đây là bắt bug gần-như-miễn-phí: không thêm case, không thêm lượt tải trang, và
   bắt được cả bug **không liên quan** tới case đang chạy. Máy: `scripts/utils/runtime/env_signals.js`
   (`attachEnvSignals(page)`), đã cắm vào `ui_conformance_check` + `cross_surface_diff`; script execute của task
   phải cắm tương tự. Kỷ luật: `pageerror` là **zero-tolerance** (có exception là finding, dù case PASS); 4xx do
   case negative CỐ Ý gây ra thì phải **khai trước** bằng `expect4xx(rx, why)` — không khai thì bị tính là tín hiệu
   lạ; console.error của tracking/cert môi trường chỉ là **ghi chú**, không phải deviation.
10. **CHỨNG MINH bộ kiểm bắt được bug, đừng giả định (`mutation:check`).** Mọi máy khác *cố bắt thêm bug*; máy này
    **đo năng lực phát hiện**: cố ý tiêm lỗi ở tầng `page.route()` (**không chạm dữ liệu UAT**) rồi xem bộ kiểm có
    đỏ không. Mutant **sống sót = vùng mù CÓ BẰNG CHỨNG**, không phải phỏng đoán. Đo lần đầu 19/08 trên
    `ui_conformance_check`: **mutation score 0/4 = 0%** — bóp `convertible_amount` thành 0 / xoá hẳn / chia nửa /
    đổi kiểu đều **không bị phát hiện**, vì máy đó kiểm **kiểm kê field**, không kiểm **giá trị**. Cùng lượt đo cho
    thấy phép so 2 bề mặt (trục ②) sẽ bắt **4/4** ⇒ kết luận có số: kiểm-kê-field và kiểm-giá-trị là **hai việc
    khác nhau**, phải chạy cả hai. Hai bẫy bắt buộc tránh khi dùng: (a) mutation phải tiêm được thật — API trả tiền
    dạng **chuỗi** làm 4/5 mutant vô hiệu ở lượt đầu, "0%" khi đó là harness hỏng chứ không phải phát hiện;
    (b) nếu mutation chặn cả request của app LẪN request xác minh của máy kiểm thì hai bên cùng bị bóp ⇒ không bao
    giờ lệch (tautology ở tầng harness) — phải bỏ route SAU khi app load rồi mới đọc nguồn sạch. Chạy **định kỳ**
    (nightly/mỗi release), không phải mỗi PR.
11. **NHÂN NHƯỢNG phải để lại dấu — `PASS_WITH_DEVIATION`.** Rủi ro đặc thù của agent: gặp trở ngại thì có xu hướng
    **làm cho nó chạy** (chờ thêm · retry · đổi locator · refresh · đi đường khác), và mỗi lần như vậy là **một bug
    tiềm năng bị lấp** — nút bị overlay che (bug thật) biến thành "chờ thêm 3s rồi bấm được" (case xanh). Kit đã gác
    chặt phần locator (`locator_healing_policy`) nhưng nhân nhượng **dạng rộng** thì chưa. Luật: mọi lệch khỏi kịch
    bản phải ghi vào sổ (`scripts/lib/expansion/deviation.js` → `newLedger(tcId).note(kind, why)`); case chỉ pass
    **sau khi** lệch ⇒ verdict `PASS_WITH_DEVIATION`, phải **liệt kê deviation trong Actual**, và xếp vào diện nghi
    vấn cần review. `self_review` cảnh báo khi Actual kể chuyện lệch kịch bản mà case ghi PASS trơn — chỉ cảnh báo
    vì đây là suy từ văn xuôi: đo thật cho thấy **không đối chiếu kịch bản thì 2/2 cảnh báo đều oan** (từ khoá
    "Retry"/"tải lại trang" là nội dung của chính case), nên phải đối chiếu với bước của case trước khi nghi.
12. **FLAKY chỉ được gọi là flaky khi nêu được CƠ CHẾ — nếu không thì `SUSPECT_REAL_BUG`.** Cơ chế flaky triage có
    thể đang **chôn bug thật**: race condition · cache · timezone lúc chuyển ngày đều trông y như flaky, và retry 3
    lần có 1 lần xanh là bị dán nhãn flaky rồi bỏ qua. Phải nêu cơ chế cụ thể (animation chưa xong · race giữa 2
    request · cache CDN · đổi ngày lúc 00:00) **và cách chứng minh**; không nêu được thì giữ `SUSPECT_REAL_BUG`
    (vẫn loggable). Metric phải theo dõi: **% flaky đã xác định được nguyên nhân** — tỷ lệ thấp nghĩa là đang chôn bug.
13. **ĐỦ ASSERTION — mỗi điều kiện trong "Kết quả mong đợi" phải có một verification + bằng chứng.** Một expected
    như *"tổng 540.000đ, đúng format có dấu phân cách, số dư giảm tương ứng"* chứa **3** assertion; execute kiểm 1
    rồi ghi PASS thì 2 cái còn lại lọt êm — đây là cơ chế lọt **cơ học** phổ biến nhất. Đo trên một bộ 530 case
    thật: trung bình **2.30** dòng expected/case · **31%** case có ≥3 assertion · **9%** nhồi nhiều điều kiện trong
    MỘT dòng · và **68%** case ghi **ít verification hơn số assertion** (135 case lệch ≥2). Luật: Phase 1 tách
    assertion **nguyên tử** (mỗi điều kiện 1 dòng, cấm nhồi "A, và B, đồng thời C"); Phase 2 mỗi dòng expected phải
    có bằng chứng tương ứng. `self_review` **cảnh báo** theo tỉ lệ này — cố ý chưa chặn vì `steps[]` chỉ là *proxy*
    của số verification, chặn ngay sẽ làm đỏ 2/3 bản ghi mà chưa chắc thiếu kiểm thật.
14. **Log bug phải khai nguồn phát hiện** `--found-by kit|human`: nhãn `auto-bug` chỉ chứng minh ai LOG, không phải
   ai TÌM — không phân biệt được thì tỉ lệ rò không đo được.

### Execute Results

Sau mỗi testcase đã execute, cập nhật testcase/report với:

| Field | Requirement |
|---|---|
| `Status` | `PASS`, `FAIL` hoặc `SKIP`. |
| `Actual Result` | Kết quả quan sát được, không ghi chung chung. |
| `Evidence` | **Bắt buộc cho MỌI case đã execute (PASS và FAIL)** + **MỌI step** (mỗi step có status PASS/FAIL riêng và ảnh riêng). Case `TODO`/chưa chạy không cần. Capture bằng `scripts/utils/evidence_recorder.js`; ảnh/video dưới `test-results/artifacts/<TC_ID>/`. Phải tuân thủ đầy đủ mục **Evidence — Quy chuẩn bắt buộc** bên dưới. |

Với testcase `FAIL`, `Actual Result` phải có:

| Required Detail | Why It Matters |
|---|---|
| Step fail | Xác định điểm lỗi. |
| Expected result | Xác nhận rule đang kiểm. |
| Actual UI/API result | Chứng minh behavior thực tế. |
| Main error message | Hỗ trợ dev debug. |
| Evidence path | Đảm bảo audit và Jira triage. |

### Phân tầng lỗi FE hay BE — bắt buộc kiểm API trước khi kết luận

Khi log bug, **CẤM gán tầng lỗi chỉ bằng quan sát giao diện**. Nhìn UI sai chỉ chứng minh *có* lỗi, không chứng minh lỗi *nằm ở đâu*.

| Bước | Yêu cầu |
|---|---|
| 1. Bắt API thật | Bắt response của **chính API mà màn đang xem gọi** (`page.on('response', ...)` trong Playwright, hoặc tab Network của DevTools). **Không đoán** tên endpoint. |
| 2. Đối chiếu | So giá trị trong response với nguồn spec (màn nguồn, HubSpot, FSD). |
| 3. Kết luận tầng | BE trả **sai/thiếu** → **BE** (`api_bug`). Response **đã đúng và đủ** mà UI hiện sai → **FE**. UI gửi payload thiếu dù người dùng nhập đủ → **FE**. BE nhận payload hợp lệ mà xử lý sai → **BE**. |
| 4. Khi chưa bắt được API | **Không gán tầng** — ghi rõ *chưa xác định tầng*, tuyệt đối không đoán. |

Evidence cho bug **so sánh hai nơi** (vd Ops vs Checkout, form vs payload, order vs HubSpot) phải là **ảnh GHÉP cả hai trong cùng một hình**, khoanh vùng từng bên và ghi rõ giá trị mỗi bên — không đính hai ảnh rời hoặc chỉ một phía.

Gán sai tầng khiến ticket đi nhầm người và bị dev bounce lại, mất trọn một vòng lặp. Chi tiết máy-đọc: `.agent/config/verdict_taxonomy.json` mục `beVsFe`.

### Evidence — Quy chuẩn bắt buộc

Áp dụng cho MỌI case đã execute (PASS và FAIL) và MỌI step. Vi phạm bất kỳ điểm nào bên dưới = evidence KHÔNG hợp lệ, KHÔNG được đưa vào report/push Xray/Jira.

1. **Chỉ ảnh hoặc video — cấm file dữ liệu thô.** Evidence hợp lệ chỉ là ảnh (`.png/.jpg/.jpeg/.webp`) hoặc video (`.mp4/.webm`). TUYỆT ĐỐI KHÔNG dùng `.json`, `.md`, `.txt`, `.log`, `.html`, `.csv`, `trace.zip` hay file dữ liệu thô nào làm evidence của case/step — kể cả `order_state.json`, `api_response.json`, execution summary. Cần chứng minh dữ liệu API/DB/state thì **chụp ảnh màn UI** hiển thị dữ liệu đó (hoặc màn có giá trị tương ứng), không đính file dữ liệu.
2. **Highlight đúng element đang kiểm.** Mỗi ảnh phải khoanh (tham số `highlight` của `evidence_recorder`) đúng phần tử của step đó: nút / field / dòng bảng / nhãn / thông báo / giá trị. Cấm ảnh full-page chung chung không chỉ rõ điểm kiểm.
3. **Mask PII khách hàng.** Che (mask) mọi dữ liệu nhạy cảm của khách trong ảnh/video: email, số điện thoại, họ tên, địa chỉ, mã định danh cá nhân — kể cả khi nằm trong `<input>`. Dùng tham số `mask` của `evidence_recorder`. Đồng bộ rule bảo mật: artifact KHÔNG được để lộ email/SĐT/PII khách. (Dữ liệu của hệ thống/công ty như STK công ty, hotline không bắt buộc che.)
4. **Video cho case phức tạp.** Case nhiều bước hoặc tương tác động — thanh toán qua cổng ngoài, trạng thái cập nhật bất đồng bộ, luồng qua nhiều màn, iframe/popup, drag & drop / upload — PHẢI quay video (giống evidence khi log bug) đính kèm cùng ảnh step, để tái hiện được hành vi. Case đơn giản (1 màn, kiểm hiển thị) thì ảnh highlight là đủ.
5. **Verify đúng màn trước khi chấp nhận.** Sau khi chụp, PHẢI mở ảnh/kiểm nội dung để chắc chắn evidence đúng màn/kết quả của case: KHÔNG phải trang lỗi (404/500/blank/timeout/"can't find that page"), KHÔNG phải màn sai bước, KHÔNG phải trạng thái loading dở, KHÔNG phải cổng/màn của bước khác. Sai màn → sửa selector/điều hướng và chụp lại; không push evidence sai.
6. **Mỗi case dùng evidence của chính nó.** Không mượn/tham chiếu ảnh của case khác, không dùng placeholder. Nếu không re-drive được (order đã tiêu, link chết…) thì dùng đúng ảnh gốc thật của chính case đó và ghi rõ lý do không re-capture — không thay bằng ảnh không đúng nội dung.
7. **Lưu đúng nơi + gắn đủ.** Ảnh/video dưới `test-results/artifacts/<TC_ID>/`; đường dẫn ghi vào `Evidence` của case và của TỪNG step (mỗi step: status PASS/FAIL riêng + ảnh riêng).

### Comment kết quả (Test Execution) — Quy chuẩn trình bày

Field `comment` của mỗi case (trong `testcase-status.json`, đẩy lên Test Run của Xray) là chỗ QA đọc để hiểu kết quả — phải gọn, dễ nhìn, KHÔNG dán debug.

1. **Văn xuôi gọn, không debug.** Comment là 1–2 câu mô tả kết quả quan sát được. CẤM dán dấu vết kỹ thuật: `key=value` (`editable=false`, `disabled=true`, `atGateway=true`, `match=true`), dump state kiểu `A→A` / `tx 2→2` / `paid 6000000→6000000`, mảng regex/selector, `val="…"`, `matched=[…]`. Viết lại thành ý người đọc hiểu.
2. **Không lặp trạng thái ở đầu comment.** KHÔNG mở đầu bằng `[PASS]`/`[FAIL]`/`[PASSED]`/`[Positive]`/`[Negative]` — status đã có badge riêng trên Test Run. (Kit tự thêm tag cho SKIP/BLOCKED/EXECUTING để phân biệt "TO DO" — đừng tự viết tag đó.)
3. **Caveat tách dòng riêng.** Điều cần QA xác nhận thêm / giới hạn / phụ thuộc Dev → xuống dòng mới, mở đầu bằng `Lưu ý:` (đừng nhồi vào cùng câu kết quả).
4. **Nhiều ý → gạch đầu dòng.** Nếu case kiểm nhiều điểm, mỗi điểm một dòng `- …` thay vì câu chạy dài một mạch.
5. **Số/tiền ở dạng người đọc.** Viết `6.000.000đ`, `23tr`, ngày `2026-07-13` — không để số thô `6000000`, không để timestamp máy.
6. **Không placeholder / con trỏ file.** CẤM comment kiểu `Xem xxx_results.json`, `TODO`, `(auto)` — phải là nội dung thật của kết quả. Không nhét ID thô (order/deal) trừ khi cần cho truy vết, và nếu cần thì rút gọn.
7. **Case FAILED:** comment nêu rõ **kỳ vọng vs thực tế** ở bước lỗi (ngắn gọn), chi tiết bước/evidence để ở `steps[]`/`failedStep` (không nhồi hết vào comment).

### Jira Bug Gate

Jira bug gate khác với Jira testcase publish. Jira testcase publish diễn ra sau Excel/Phase 1 để mirror testcase lên Jira; Jira bug chỉ diễn ra sau Phase 2 khi fail đã được xác nhận là product/API bug.

- Không log Jira nếu case đang `SKIP`.
- Không log Jira nếu fail do prompt/test/setup/data/env/dependency.
- Không log Jira nếu chưa rerun đủ để loại trừ flaky issue.
- Jira evidence chỉ dùng ảnh hoặc video khi log/upload bug.
- Không upload `.md`, `.txt`, `.log`, `.json`, `trace.zip` hoặc execution summary làm Jira evidence trừ khi user yêu cầu riêng.

### Executable QA capabilities (autonomy & safety)

Các năng lực chạy thật trong `scripts/qa/` + `exploratory/` phải khai rõ mức tự chủ và tuân ràng buộc an toàn:

- **Autonomy Gate**: Suggest-only (learning_recorder, risk_score, git_impact, scope_planner) · threshold-gated (locator healing `LOCATOR_HEAL=1`, perf advisory, risk_gate `--enforce`) · never-auto (exploratory, security_check, load_check — chỉ chạy khi user yêu cầu tường minh).
- **Non-destructive & non-prod**: `security_check` chỉ GET/read-only + `--confirm-nonprod`; `load_check` non-prod + cap + `--confirm-nonprod`; fuzzing/exploit/brute-force/ZAP là Manual-only opt-in có phê duyệt người. TUYỆT ĐỐI không chạy trên production.
- **Mask PII/secret** trong mọi report (security/knowledge/dashboard); không ghi credential/PII khách hàng.
- **Learning data chỉ ghi fact đã qua gate** (bug đã qua Jira gate); band/risk máy chấm luôn cho phép QA override.
- **Output Quality Gate (THỰC THI, không phải prose)**: `scripts/qa/output_gate.js` + `scripts/qa/lib/output_rules.js` biến rule chất lượng thành check máy — `push_test_execution.js` tự chạy trước khi push (comment gọn/không debug, mọi step có status + evidence ảnh/video, video cho case phức tạp). Vi phạm → CHẶN; agent tự sửa trong session, không chờ nhắc. `--qa-approved` bỏ qua có chủ đích (log lại). Bug/Test Execution **bắt buộc qua script kit**, không tạo tay MCP/API.
- **Không thêm dependency nặng**: axe-core (npm) đủ cho a11y; k6 là binary ngoài (Docker/PATH, không vào deps), thiếu → skip sạch.

## Workflow

```text
Read config/env
↓
Run selected workflow
↓
Write outputs under PROJECT_OUTPUT_DIR/TASK_KEY
↓
Validate status/evidence/report
↓
Clean temporary files
```

## Cleanup Rules

Trước khi kết thúc task, scan workspace root và subfolder cấp 1 để dọn file tạm/debug rõ ràng. Không xóa deliverable hoặc dữ liệu người dùng chưa được phép xóa.

**Dump ad-hoc KHÔNG ghi vào repo root.** Mọi dump chẩn đoán (swagger/OpenAPI, response API, id tạm, snapshot) phải ghi vào **thư mục scratchpad của session** (hoặc `<TASK_OUTPUT_DIR>/` nếu là artifact cần giữ) — ghi ra root repo là rác lọt lưới, và các dump này thường chứa **email/SĐT/PII trong giá trị mẫu** → chỉ cần một lần `git add .` là commit lộ PII (đã xảy ra thật: nhiều file `scratch_*` dump API/swagger sót ở root repo sau một task, chưa được gitignore).

| Pattern | Meaning |
|---|---|
| `*_debug.txt` | Debug dump tạm. |
| `debug_output.txt`, `*_output.txt` | Output dump tạm. |
| `*.tmp`, `*.temp` | File tạm. |
| `page_snapshot.md`, `snapshot_*.md` | Browser snapshot tạm. |
| `dom_dump.txt`, `html_dump.html` | DOM dump tạm. |
| `network_requests.txt`, `console_log.txt` | Network/console log tạm. |
| `scratch_*` (MỌI đuôi: `.py/.js/.ts/.json/.txt/…`) | Script nháp **và dump ad-hoc** (swagger/API response/id tạm). |

Không xóa:

| Path/Pattern | Reason |
|---|---|
| `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-results/**` | Deliverable của task hiện tại. |
| `logs/`, `artifacts/` | Có thể là output được yêu cầu. |
| `node_modules/`, `.git/`, `target/`, `build/` | Dependency/build/system folders. |
| `*.config.ts`, `*.config.js`, `package.json`, `.gitignore` | Project config. |
| File user yêu cầu giữ lại | User-owned data. |

## Examples

| Good | Bad |
|---|---|
| `PROJECT_OUTPUT_DIR=outputs/<YOUR_PROJECT>` | Hardcode `outputs/lms-operations-automation` trong template chung. |
| Evidence path dưới `test-results/artifacts/` | Screenshot tạm ở workspace root. |
| Bug Jira có steps, expected, actual, evidence | Bug Jira từ case skip hoặc lỗi setup. |

## References

| Document | Purpose |
|---|---|
| [README.md](README.md) | Architecture và overview. |
| [QUICKSTART.md](QUICKSTART.md) | Setup và chạy lần đầu. |
| `.agent/rules/` | Rule chi tiết theo domain. |
| `prompt_templates/run_phase_re-run_template.md` | Prompt canonical cho Re-run bug/case fail và cập nhật evidence/status. |
