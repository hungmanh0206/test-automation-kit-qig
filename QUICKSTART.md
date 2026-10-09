# Quick Start

> Hướng dẫn setup và chạy Test Automation Kit lần đầu cho project mới.

## Prerequisites

| Check | Requirement |
|---|---|
| ✅ | Node.js `>=20` và `npm`/`npx` (khớp `engines` trong `package.json` và `.nvmrc`). |
| ✅ | Playwright browser runtime. |
| ✅ | AI Agent hoặc IDE có quyền đọc workspace. |
| ✅ | Token/quyền truy cập Backlog, tài liệu nguồn, Figma nếu Phase 1 cần fetch tài liệu. Google Sheet/Google Drive dùng qua Drive MCP đã kết nối sẵn trong phiên chat (không cần token riêng). |
| ✅ | Credential test cho app/API trong môi trường dev/staging (vd `OPS_BASE_URL`/`OPS_LOGIN_URL`/`OPS_USERNAME`/`OPS_PASSWORD` trong `.env`). |
| ✅ | MCP config cho `figma`, `playwright` nếu dùng AI Agent tích hợp MCP; Google Drive dùng connector có sẵn của Claude, không cần khai trong `mcp_config.md`. Tài liệu nguồn đọc từ Markdown trong task folder (đưa sang từ Obsidian vault). |
| ➕ | (Optional) Docker hoặc k6 — chỉ cần khi chạy **load test Loại B** (`npm run load`); thiếu thì lệnh tự skip sạch. |
| ➕ | (Optional) 2 tài khoản test quyền khác nhau (vd `OPS_USERNAME_LOW`/`OPS_USERNAME_HIGH`) trong `task.env` — cho ma trận authz/IDOR của `npm run security`. |
| ❌ | DB credential/connection string không cần và không dùng trong workflow chuẩn. |

## Setup

| Step | Action | Command/File |
|---:|---|---|
| 1 | Clone repo | GitHub: `git clone https://github.com/hungmanh0206/test-automation-kit-qig.git` · GitLab (cần VPN + SSH key): `git clone git@gitlab.example.com:tester/test_automation_test_kit_v2.git`. **Hai nhánh KHÁC NHAU có chủ ý** — xem mục *Hai remote* bên dưới |
| 2 | Vào workspace | `cd <YOUR_PROJECT>` |
| 3 | Cài dependencies | `npm ci` — KHÔNG dùng `npm install`, phải theo lockfile |
| 4 | Cài Playwright browsers | `npx playwright install` |
| 5 | Tạo env local | Copy `.env.example` thành `.env.local` hoặc `.env` |
| 6 | Cấu hình MCP | Xem mục **MCP** trong `USER_GUIDE.md` (bảng server và dùng khi nào). Bản cụ thể của mỗi đội nằm ở `.agent/config/mcp_config.md` — file này mang endpoint riêng nên KHÔNG đi theo gói, tự tạo |
| 7 | Cấu hình project context | `cp .agent/config/project_context.example.md .agent/config/project_context.md` rồi điền theo dự án. **Chưa có file này thì `preflight` CHẶN** — cố ý, để kit không chạy trên ngữ cảnh trống |
| 8 | Cấu hình risk model | `cp .agent/config/risk_model.example.json .agent/config/risk_model.json` rồi chỉnh Impact theo module của bạn. Thiếu thì `dim:coverage` mất ngưỡng theo chiều |
| 9 | Bật 2 hook forcing-function | `.claude/settings.json` là **local, gitignored** nên KHÔNG đi theo clone, tức hook đang TẮT. Copy đoạn JSON trong `scripts/qa/hooks/README.md` vào `.claude/settings.json` rồi mở `/hooks` một lần. `preflight` có cảnh báo chỗ này, không chặn |
| 10 | Kiểm lại | `npx playwright test tests/fe/infra` — bộ tự-kiểm của kit, phải xanh hết trước khi dùng thật |

## Hai remote — clone bên nào cũng được, số đo giống nhau

Trước đây nhánh GitLab cố ý bị gỡ 2 file so với GitHub. Hai file đó nay đã bị **xoá khỏi cả hai bên**
(mã của một dự án cũ, viết cho Postgres nên chỉ SKIP trên DB hiện tại), nên `gitlab_strip.json` rỗng và
hai cây **hết phân kỳ**. Cơ chế strip vẫn giữ: lần sau có đường dẫn nào chỉ được nằm ở một nhánh thì khai
vào file đó, đừng gỡ tay.

Đo ngày 29/09/2026:

| | GitHub | GitLab |
|---|---|---|
| file được track | 483 | 483 |
| `npx playwright test tests/fe/infra` | **696 test · 0 đỏ** | **696 test · 0 đỏ** |
| `npm run ci:scope` đếm | 58 spec | 58 spec |

**Số của bạn khác bảng này là có gì đó sai** — đừng bỏ qua. Test bỏ qua đều tự khai lý do khi chạy.

Một ngoại lệ hợp lệ: **tổng luôn là 664**, nhưng phần bỏ qua đổi theo dữ liệu bạn có.
Clone mới thì `knowledge/` rỗng nên vài test tự bỏ qua; khôi phục bundle `knowledge:backup` xong thì
chúng chạy thật. Đó là ĐÚNG, không phải lệch.

## Thứ KHÔNG đi theo clone

| Thư mục | Sau khi clone | Hệ quả |
|---|---|---|
| `knowledge/` | chỉ có `SCHEMA.md` | **mất toàn bộ bộ nhớ học** |
| `profiles/` | chỉ có `task.env.example` | không có credential nào |
| `outputs/` | rỗng | không có kết quả task cũ |
| `.claude/settings.json` | không có | 2 hook forcing-function TẮT (bước 9) |
| bộ nhớ của agent | không có | nằm **ngoài repo hoàn toàn** — đọc mục ngay dưới |

`knowledge/` bị gitignore có chủ ý, vì mirror GitHub là public. Nhưng theo `knowledge/SCHEMA.md`, một
phần trong đó **không nạp lại được từ nguồn máy**: `domain/`, `system/`, `decisions/`, `setup_recipes/`,
`environment/`, `locators/` và `bug_tc_map.json` là công sức người ghi tay.

Máy mới cần dùng tiếp bộ nhớ đó thì: máy cũ chạy `npm run knowledge:backup` (đích **ngoài** repo), chép
bundle sang rồi khôi phục. Phần nạp lại được thì `npm run learn:bugs:apply` (từ Backlog) và
`npm run learn -- --scan` (từ `test-results/`).

### Bộ nhớ của agent không nằm trong repo

Ngoài `knowledge/`, agent còn một kho ghi nhớ riêng trong thư mục `.claude` ở home của bạn:
`~/.claude/projects/<đường-dẫn-đã-mã-hoá>/memory/`. Kho này không phải một phần của repo.
`npm run knowledge:backup` **không** chạm tới nó.

Chỗ dễ hiểu nhầm nhất: kho này khoá theo **đường dẫn thư mục làm việc**, không theo dự án.
Cùng một bộ kit đặt ở hai thư mục khác nhau sẽ có hai kho riêng, không thấy nhau.

| Tình huống | Nhớ hay không |
|---|---|
| Task mới, vẫn chạy trong **cùng** thư mục | nhớ đủ |
| Clone sang thư mục khác, máy khác, hoặc chỉ đổi tên thư mục | bắt đầu từ 0 |

Thứ vẫn theo mọi thư mục là `~/.claude/CLAUDE.md`, tức quy tắc cá nhân. Còn `CLAUDE.md` trong repo
là quy tắc dự án và có đi theo clone.

Muốn mang sang máy mới thì chép tay thư mục `memory/` đó. Kho cũ bỏ lâu không dùng thì nên xoá
thay vì chép. Nó giữ nguyên hiểu biết đã hết hạn và không có cơ chế tự hết hạn.

## Inputs

| Input | Required | Notes |
|---|---|---|
| `PROJECT_OUTPUT_DIR` | Yes | Ví dụ: `outputs/<YOUR_PROJECT>`. |
| `TASK_KEY` | Yes | Scope folder, ví dụ: `<TASK_KEY>`. |
| Backlog Story/Task | Optional | Cần nếu Phase 1 fetch Backlog, hoặc Phase 2 log Backlog bug. |
| tài liệu nguồn Requirement | Optional | Cần nếu requirement nằm trên tài liệu nguồn. |
| Figma URL/API key | Optional | Cần nếu testcase phụ thuộc UI design. |
| Swagger/OpenAPI URL | Optional | Cần cho API testcase hoặc API automation. |
| App/API credentials | Yes for execution | Không ghi secret vào Markdown/report. |

## Environment Checklist

| Key | Purpose |
|---|---|
| `PROJECT_OUTPUT_DIR=outputs/<YOUR_PROJECT>` | Output root của project. |
| `TASK_KEY=<TASK_KEY>` | Scope folder của task/feature. |
| `RUN_ID=<safe-run-id>` | Optional; bắt buộc khi chạy song song nhiều session cùng `TASK_KEY`. |
| `BACKLOG_BASE_URL`, `BACKLOG_USERNAME`/`BACKLOG_EMAIL`, `BACKLOG_API_KEY`, `BACKLOG_PROJECT_KEY` | Backlog integration (bug logging + fetch tài liệu nguồn/Figma). |
| `GOOGLE_SHEET_URL` | Link Google Sheet đã publish testcase (ghi trong `profiles/<TASK_KEY>/task.env` sau Phase 1 Auto Publish); dùng để agent tìm đúng file khi re-publish hoặc tải bản mới nhất về execute. |
| `BACKLOG_STORY_KEY` / `--story` | Metadata liên kết case ↔ Story/Task; ghi trong report, không có field riêng trên Sheet (Sheet không phải issue tracker). |
| Nguồn testcase Phase 2 (mặc định) | Agent tải bản Google Sheet mới nhất qua Drive MCP về `test-cases/from-sheet/*.xlsx` trước mỗi lượt execute (không cần token — dùng Drive MCP có sẵn trong phiên chat); `TESTCASE_SOURCE=excel` là opt-out khi chưa publish. |
| `PUSH_EXECUTION=confirm` | Đồng bộ kết quả execute vào cột `Result` của Sheet (`merge_execution_status.js` rồi `update_file`) sau khi QA duyệt preview. |
| `DOC_URL` | Requirement source nếu dùng tài liệu nguồn. |
| `FIGMA_API_KEY` | Figma fetch nếu dùng design source. |
| `<APP>_BASE_URL`, `<APP>_LOGIN_URL` | UI automation. |
| `<APP>_USERNAME`, `<APP>_PASSWORD` | Test account. |
| `<APP>_API_BASE_URL`, `<APP>_SWAGGER_URL` | API automation. |
| `PW_TRACE`, `PW_VIDEO` | Debug trace/video. |

## Verify Installation

| Check | Command | Expected Result |
|---|---|---|
| Node | `node -v` | Version `>=20`. |
| NPM | `npm -v` | Version printed without error. |
| Playwright | `npx playwright --version` | Playwright version printed. |
| Backlog dry check | `npm run integration:check` | Connection/config check completes. |
| Task test wrapper | `npm run test:task -- --help` | Usage is printed without executing tests. |

## Slash Commands (điểm vào)

Mỗi luồng có một slash command trong `.claude/commands/`. Gõ trong Claude Code — nhanh hơn dán prompt:

```text
/preflight <TASK_KEY>       # kiểm input/config bắt buộc trước khi bắt đầu
/phase1 <TASK_KEY>          # sinh testcase
/phase2 <TASK_KEY>          # execute automation
/rerun <TASK_KEY>           # chạy lại case của bug đã fix
/partial-rerun <TASK_KEY>   # requirement đổi (review trước, apply sau)
/explore <phạm vi>          # exploratory session có charter
/ui-debug <màn>             # khám phá DOM tìm locator bền
/gates <TASK_KEY>           # bó gate trước khi finalize
/publish <TASK_KEY>         # đẩy Google Sheet qua Drive MCP (review trước khi ghi đè)
```

Command chỉ là **con trỏ** tới workflow và prompt thật + danh sách gate; nội dung luồng vẫn ở
`prompt_templates/` và `.agent/workflows/`. Ba điểm dừng bắt buộc mà command nào cũng nhắc:

- **Ambiguity Gate** ở Phase 1 — còn mơ hồ thì hỏi trước, không đoán rồi sinh testcase.
- **Xác nhận trước khi chạm UAT** ở Phase 2 / rerun / explore / ui-debug.
- **Review nội dung local trước khi ghi đè Sheet thật** khi publish.

## Run Phase 1

Use [prompt_templates/run_phase1_template.md](prompt_templates/run_phase1_template.md), fill placeholders, then ask the agent to run Phase 1 only.

```text
Chạy Phase 1 cho project <YOUR_PROJECT>.
Module/Feature: <YOUR_FEATURE>
Task key/scope folder: <TASK_KEY>
Input: Backlog <BACKLOG_STORY_URL>, tài liệu nguồn <DOC_URL>, Figma <FIGMA_FILE_URL>, Swagger <SWAGGER_URL>
Output: <PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/
Chỉ sinh testcase, export Excel và summary; không publish lên Sheet và không execute automation.
```

Luồng Phase 1 chuẩn:

```text
Requirement
↓
Generate Testcase
↓
Excel (Source of truth khi gen/publish)
↓
QA xác nhận
↓
Auto Publish → Google Sheet (qua Drive MCP)
```

**Trước khi QA xác nhận, chạy 2 gate chiều coverage:**

```text
npm run dim:coverage                      # lấy khung requirements/dimension_manifest.json rồi khai required / n-a KÈM lý do
npm run dim:coverage -- --enforce         # thiếu chiều khai required = CHẶN
npm run domain:trace-back                 # case có oracle nghiệp vụ mà không trỏ [BR-…]/[SM-…]
```

Bộ testcase có **hai trục**: *module* = test **ở đâu**, *chiều* = hỏi **loại câu hỏi nào** (validate · hiển thị · công thức · BE conformance · guard · bảo mật · perf · change-impact). Phủ kín module mà trống một chiều thì bộ vẫn *trông* đầy đủ. Mỗi case gắn **tag chiều** trong tiêu đề (`[Positive][Display] …`); 20 chương nội dung ở [`prompt_templates/phase1/dimensions/`](prompt_templates/phase1/dimensions/); luật đầy đủ ở [RULE_GLOBAL §Chiều coverage](RULE_GLOBAL.md).

Auto Publish là step riêng trong phạm vi Phase 1. Excel là source of truth khi gen/publish. Khi chạy Phase 2, agent **luôn tải bản Google Sheet mới nhất qua Drive MCP** về canonical local (`test-cases/from-sheet/*.xlsx`) rồi execute từ đó; `TESTCASE_SOURCE=excel` là opt-out khi chưa publish.

## Phase 1 - Auto Publish Testcase (Google Sheet)

Chỉ chạy sau khi QA đã xác nhận Excel/testcase được phép publish. Dùng prompt riêng [prompt_templates/phase1/04_auto_publish_backlog.md](prompt_templates/phase1/04_auto_publish_backlog.md) (tên file giữ nguyên cho tương thích ngược, nội dung là luồng Google Sheet).

Publish không phải npm script — là thao tác agent làm trực tiếp qua Google Drive MCP trong phiên chat:

1. **Review nội dung `.xlsx` local** trước khi ghi đè Sheet thật (Drive MCP không "sửa 1 ô", ghi đè là ghi đè cả file).
2. `search_files` tìm Sheet đã publish trước đó (theo `GOOGLE_SHEET_URL` trong `profiles/<TASK_KEY>/task.env`, nếu có).
3. Có rồi → `update_file` (ghi đè, giữ nguyên link). Chưa có → `create_file` (upload, Drive tự convert sang Google Sheets).
4. Ghi/cập nhật link trả về vào `profiles/<TASK_KEY>/task.env` (`GOOGLE_SHEET_URL`).

Re-publish sau khi sửa Excel là lặp lại đúng 4 bước trên (bước 3 sẽ luôn là `update_file` vì Sheet đã tồn tại) — không cần dedup theo key riêng, ghi đè toàn workbook tự nhiên phản ánh đúng Excel hiện tại.

Nhóm chức năng thành **sheet riêng** trong workbook (1 sheet cho mỗi nhóm, dựng từ `md_to_xlsx.js`); TC ID nằm ở cột `ID_TC`. Sheet không phải issue tracker nên **không có** Test Set, requirement issue-link, Precondition issue riêng, assignee hay label — tiền điều kiện nằm trong cột `Tiền điều kiện` của chính sheet. Chi tiết mô hình: [.agent/skills/shared/backlog_testcase_publisher/SKILL.md](.agent/skills/shared/backlog_testcase_publisher/SKILL.md).

## Partial Rerun - Cleanup testcase

Khi Excel source of truth thay đổi sau khi đã publish, cleanup thuộc nhánh phụ Partial Rerun. **Không còn lifecycle riêng** như công cụ TMS cũ: re-publish (bước ở trên) ghi đè toàn workbook nên case bị bỏ khỏi Excel tự động biến mất khỏi Sheet ngay lần ghi đè kế tiếp. Dùng prompt riêng [partial-rerun/run_testcase_cleanup.md](partial-rerun/run_testcase_cleanup.md) chỉ khi còn việc unlink liên kết Test↔Story/Task trên Backlog (optional, cần QA yêu cầu rõ).

## Parallel Story Safety

| Rule | Required Behavior |
|---|---|
| Mỗi story | Dùng một conversation AI riêng. |
| Run profile | Mỗi task dùng `profiles/<TASK_KEY>/task.env` (giá trị động: scope, link story/figma cụ thể, `GOOGLE_SHEET_URL`); giá trị tĩnh dùng chung mọi task (Backlog/Figma key, `OPS_*`) giữ ở `.env` chung. Truyền `TASK_ENV=profiles/<TASK_KEY>/task.env` cho mọi command. |
| Scope echo | Agent phải echo `PROJECT_OUTPUT_DIR`, `TASK_KEY`, `TASK_OUTPUT_DIR` trước khi ghi file/chạy lệnh. |
| Shared env | Không sửa `.env`/`.env.local` khi session khác đang chạy; ưu tiên profile qua `TASK_ENV` thay vì sửa `.env` chung. |
| Command env | Truyền `PROJECT_OUTPUT_DIR` và `TASK_KEY` qua từng command nếu cần override. |
| Cùng `TASK_KEY` song song | Bắt buộc thêm `RUN_ID`, ví dụ `RUN_ID=run-20260616-01`. |
| Phase-separated flow | Chạy Phase 1, chờ Dev implement, chạy Phase 2, chờ Dev fix bug nếu có, rồi Re-run. |
| Automation code | Ưu tiên spec/helper story-specific dưới `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/automation/`. |

Khi có `RUN_ID`, Playwright results/report/artifacts nằm dưới:

```text
<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-results/runs/<RUN_ID>/
```

Local execution/rerun/Backlog summary cho cùng run nên nằm dưới:

```text
<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/reports/runs/<RUN_ID>/
```

## Run Phase 2

Use [prompt_templates/run_phase2_template.md](prompt_templates/run_phase2_template.md), fill execution mode and testcase scope.

```text
Chạy Phase 2 cho project <YOUR_PROJECT>.
Task key/scope folder: <TASK_KEY>
Execution mode: SELECTED_TESTCASES
Selected TC IDs: <TC_ID_1>, <TC_ID_2>
Generate/update Playwright script nếu cần, execute, auto-heal, tạo local report.
Không tạo Backlog bug thật nếu chưa được xác nhận.
Nguồn testcase: tải Google Sheet mới nhất qua Drive MCP về test-cases/from-sheet/ (mặc định) rồi execute, hoặc TESTCASE_SOURCE=excel (test-cases/*.xlsx) nếu chưa publish.
```

## Run Task-Scoped Playwright

Ưu tiên các command này khi chạy test cho một story hoặc task cụ thể để tránh dùng nhầm `TASK_KEY` từ `.env` cũ:

```text
npm run test:task -- --project-output <PROJECT_OUTPUT_DIR> --task <TASK_KEY>
npm run test:task:fe -- --project-output <PROJECT_OUTPUT_DIR> --task <TASK_KEY>
npm run test:task:api -- --project-output <PROJECT_OUTPUT_DIR> --task <TASK_KEY>
```

## Run Rerun

Use [prompt_templates/run_phase_re-run_template.md](prompt_templates/run_phase_re-run_template.md) only for failed testcase or Backlog bug Re-run after Dev fix.

```text
Chạy rerun bug cho project <YOUR_PROJECT>.
Task key/scope folder: <TASK_KEY>
Backlog bug keys: <BUG-1>, <BUG-2>
TC IDs: <TC_ID_1>, <TC_ID_2>
Chỉ Re-run bug/case liên quan, không đồng bộ tài liệu mới trong bước này.
```

## View Reports

| Report | Path |
|---|---|
| Task summary | `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/task.md` |
| Testcase Markdown | `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-cases/*.md` |
| Testcase Excel | `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-cases/*.xlsx` |
| Capability / Test-Hook Request | `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/reports/capability-request.md` (khi còn `Needs hook`/`Manual-only`) |
| Google Sheet publish summary | `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/reports/backlog-testcase-publish-summary.md` |
| Testcase cleanup (unlink Backlog) | `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/reports/backlog-testcase-cleanup-summary.md` |
| Playwright HTML | `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-results/playwright-report/` |
| Execution results | `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-results/execution-results.md` |
| Execution summary | `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/reports/execution-summary.md` |
| Rerun report | `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/reports/rerun/` |

## QA Checks (executable — chạy thật, so ngưỡng/contract)

Tái dùng login và catalog; kết quả ghi `<TASK_OUTPUT_DIR>/reports/` và lên dashboard. Chi tiết + catalog schema: `scripts/qa/README.md`.

| Việc | Lệnh | Autonomy / an toàn |
|---|---|---|
| Dashboard tổng hợp (dự án trước DS) | `npm run dashboard` | đọc `knowledge/` → `reports/dashboard.html` |
| Accessibility (axe-core) | `npm run accessibility -- --catalog <ui_catalog.json>` | never-auto; finding review |
| Performance Loại A | `npm run perf -- --catalog <perf_catalog.json>` | threshold-gated; verdict **advisory** (median N) |
| Security basic | `npm run security -- --catalog <security_catalog.json> --confirm-nonprod` | never-auto, **GET/non-prod**, mask PII |
| Load Loại B (k6) | `npm run load -- --script tests/load/example.load.js --confirm-nonprod --docker` | never-auto, **non-prod**, cap; k6/Docker (thiếu → skip) |
| Risk register (RBT) | `npm run risk` | Suggest-only; QA override band |
| Risk gate | `npm run risk:gate` (cảnh báo) · `npm run risk:gate:enforce` (chặn CI) | High-risk thiếu độ sâu → CRITICAL |
| Mobile-web | `npm run test:mobile-web` | device emulation (iPhone/Pixel) |

> **Ambiguity Gate**: Phase 1 tự chặn sinh testcase khi requirement mơ hồ mức Critical/High → xuất `reports/phase1-clarifications.md` chờ QA/BA. Xem USER_GUIDE mục 12.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `node` hoặc `npm` không nhận lệnh | Node chưa cài hoặc PATH chưa reload | Cài Node.js `>=18`, mở terminal mới, chạy `node -v`. |
| Playwright báo thiếu browser | Browser runtime chưa cài | Chạy `npx playwright install`. |
| MCP không kết nối | Token/quyền hoặc MCP config sai | Kiểm tra `.env.local` và IDE MCP settings. |
| Phase 1 không fetch được requirement | URL/quyền Backlog/tài liệu nguồn/Figma sai | Kiểm tra link, token, quyền page/file. |
| Publish testcase bị lỗi | Chưa kết nối Google Drive MCP, hoặc file `.xlsx` local chưa export/lỗi | Kiểm tra MCP còn sống (`search_files` thử), kiểm tra Excel canonical đã export đúng chưa trước khi `create_file`/`update_file` |
| Case cũ vẫn còn trên Sheet sau khi bỏ TC khỏi Excel | Chưa re-publish (ghi đè) sau khi sửa Excel | Chạy lại bước publish (`update_file`) — ghi đè toàn workbook sẽ tự phản ánh đúng Excel hiện tại, không cần thao tác riêng |
| Phase 2 bị `SKIP` nhiều | Auth/data/API/env chưa sẵn sàng hoặc case cần state sâu không có API/hook | Kiểm tra credential, base URL, Swagger URL, fixture/test hook; case thiếu capability an toàn (không dựng được qua API/hook/sandbox) đánh dấu `Needs hook`/`Manual-only` — KHÔNG dùng DB để né (xem `tests/support/setup/hooks/README.md`). |
| Backlog bug không tạo được | Chưa đủ config hoặc chưa được phép log thật | Chạy dry-run trước, kiểm tra `BACKLOG_*` keys. |

## Why It Matters

Quick Start chuẩn giúp project mới có cùng layout output và cùng điều kiện quality gate. Khi output ổn định, Phase 2 và rerun có thể đọc lại artifact cũ mà không tốn token đọc lại toàn bộ requirement.

## References

| Document | Purpose |
|---|---|
| [README.md](README.md) | Landing page và architecture. |
| [RULE_GLOBAL.md](RULE_GLOBAL.md) | Quy tắc global. |
| [prompt_templates/run_phase1_template.md](prompt_templates/run_phase1_template.md) | Template Phase 1. |
| [prompt_templates/phase1/04_auto_publish_backlog.md](prompt_templates/phase1/04_auto_publish_backlog.md) | Prompt riêng cho Auto Publish testcase (Google Sheet) trong Phase 1 sau QA confirmation. |
| [prompt_templates/run_phase2_template.md](prompt_templates/run_phase2_template.md) | Template Phase 2. |
| [prompt_templates/run_phase_re-run_template.md](prompt_templates/run_phase_re-run_template.md) | Template Re-run bug/case fail và Backlog bug đã fix. |
| [partial-rerun/run_testcase_cleanup.md](partial-rerun/run_testcase_cleanup.md) | Prompt optional unlink Test↔Story/Task trên Backlog sau partial rerun approved (re-publish Sheet đã tự đủ đồng bộ). |
