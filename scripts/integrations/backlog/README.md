# Backlog And Figma Integration Scripts

> Script Node.js dùng chung để **fetch requirement** (Backlog/Figma), **log bug Backlog**. Test-management
> (testcase/execution) KHÔNG ở đây — nó thuộc `scripts/integrations/aio/` (Google Sheet là app Backlog
> Marketplace, không tương thích Backlog — xem cảnh báo ở cuối file).
>
> Migrated từ hệ bug-tracking cũ → Backlog ngày 22/09/2026 — thư mục đã đổi tên theo công cụ mới, nhưng README này vẫn ở
> cùng vị trí tương đối trong repo. Tài liệu requirement/BA không fetch bằng script nữa — soạn trong Obsidian vault rồi
> đưa sang `<TASK_OUTPUT_DIR>/docs/` dưới dạng Markdown.

## Purpose

Các script trong thư mục này hỗ trợ Phase 1 fetch requirement từ Backlog/Figma, và Phase 2 log bug Backlog có điều kiện. Mọi việc liên quan tới testcase/execution (publish · pull · push kết quả · vòng đời case) nằm ở [`../aio/`](../aio/README.md).

## When To Use

| Tình huống | Script |
|---|---|
| Lấy requirement/spec từ Backlog (issue · issue con của một issue cha) | `backlog_fetcher.js` |
| Lấy tài liệu từ tài liệu nguồn | `fetch_tai_lieu_nguon.js` (NGOÀI PHẠM VI — chưa chạy được) |
| Lấy design/metadata từ Figma | `fetch_figma.js` · `probe_figma.js` |
| Log bug Backlog sau khi execute (đủ điều kiện + đã rerun) | `bug_reporter.js` |
| Publish USER_GUIDE lên tài liệu nguồn cho team | `publish_tai_lieu_nguon_page.js` (NGOÀI PHẠM VI — chưa chạy được) |
| Kiểm cấu hình/kết nối trước khi gọi API | `check_connection.js` |

## Files

| File | Purpose |
|---|---|
| `backlog_fetcher.js` | Fetch Backlog issues/project issues/parent-children (không có JQL — filter theo field). |
| `fetch_tai_lieu_nguon.js` | Fetch trang tài liệu nguồn by `DOC_PAGE_ID`. NGOÀI PHẠM VI hiện tại. |
| `fetch_figma.js` | Fetch Figma file/node and save raw JSON + summary. |
| `probe_figma.js` | Verify access to Figma file/node. |
| `publish_tai_lieu_nguon_page.js` | Publish/update một trang tài liệu nguồn từ Markdown. NGOÀI PHẠM VI hiện tại. |
| `bug_reporter.js` | Create Backlog child bug/sub-bug from failed tests. |
| `check_connection.js` | Kiểm env + live connection (Backlog · Google Sheet · Figma) mà không in secret. |
| `utils.js` | Shared helpers (load env, auth params, format issue, resolve user id…). |

## Environment

Đặt ở `.env` chung của repo (hoặc `.env.local`); **không** commit:

| Nhóm | Biến |
|---|---|
| Backlog | `BACKLOG_BASE_URL`/`BACKLOG_URL` · `BACKLOG_API_KEY` · `BACKLOG_PROJECT_KEY` · `BACKLOG_STORY_KEY` |
| Bug | `BACKLOG_BUG_ISSUE_TYPE` (mặc định `Sub-bug`, resolve theo TÊN issue type có thật trong project) · `BACKLOG_FE_ASSIGNEE` · `BACKLOG_BE_ASSIGNEE` · `BACKLOG_DEV_ASSIGNEE` · `BACKLOG_SPRINT_FIELD_ID` (optional, id số custom field copy từ Story) |
| Figma | `FIGMA_API_KEY` · `FIGMA_FILE_KEY`/`FIGMA_FILE_URL` · `FIGMA_NODE_ID` |
| Google Sheet (dùng bởi `check_connection`, có thể không còn dùng được — xem cảnh báo dưới) | `GOOGLE_SHEET_CREDENTIALS` · `GOOGLE_SHEET_ID` (mặc định `BACKLOG_PROJECT_KEY`) |

## Common Commands

| Task | Command |
|---|---|
| Kiểm config | `npm run integration:check` |
| Kiểm config + live connection | `npm run integration:check:live` |
| Fetch Backlog issue | `node scripts/integrations/backlog/backlog_fetcher.js --issue <ISSUE_KEY> --format md` |
| Fetch issue con của issue cha | `node scripts/integrations/backlog/backlog_fetcher.js --epic <PARENT_KEY> --format md` |
| Fetch theo project + keyword | `node scripts/integrations/backlog/backlog_fetcher.js --project <PROJECT_KEY> --keyword "..." --format md` |
| Probe Figma | `node scripts/integrations/backlog/probe_figma.js` |
| Fetch Figma | `node scripts/integrations/backlog/fetch_figma.js` |
| Backlog bug dry-run | `npm run backlog:bug-report:dry-run -- --task <TASK_KEY> --story <BACKLOG_STORY_KEY> --project-output <PROJECT_OUTPUT_DIR>` |
| Create Backlog bug | `npm run backlog:bug-report -- --task <TASK_KEY> --story <BACKLOG_STORY_KEY> --project-output <PROJECT_OUTPUT_DIR>` |

## Backlog Bug Rules

| Rule | Requirement |
|---|---|
| Parent | Bug must be child/sub-bug under `BACKLOG_STORY_KEY` (`parentIssueId`). |
| Assignee | Gán theo TẦNG lỗi: `BACKLOG_FE_ASSIGNEE` (bug FE) · `BACKLOG_BE_ASSIGNEE` (bug BE); hoặc parent assignee. |
| Title | Prefix with `[FE][<TC_ID>]` or `[BE][<TC_ID>]` — TC ID nhúng trong summary vì Backlog không có labels tự do (dùng cho duplicate-check). |
| Description | Plain text, only `Tiền điều kiện`, `Bước`, `Kết quả hiện tại`, `Kết quả mong muốn`. |
| Priority | Backlog chỉ 3 mức cố định (High/Normal/Low) — kit map từ thang 5 mức của testcase (Critical/High→High, Medium→Normal, Low/Lowest→Low). |
| Evidence | Ảnh/video từ `test-results/artifacts/` — highlight đúng element, mask PII. Upload 2 bước (`POST /space/attachment` rồi gắn vào issue). |

## Khác biệt API so với Backlog (đọc trước khi sửa code trong thư mục này)

- Auth qua query param `?apiKey=` (không Basic/Bearer/PAT).
- Body `POST`/`PATCH` là form-urlencoded, không phải JSON.
- `issueTypeId`/`priorityId`/`parentIssueId` là SỐ — phải resolve theo tên/key trước khi gọi API tạo/sửa issue.
- Không có JQL — filter theo field (`projectId[]`, `keyword`, `statusId[]`, `parentIssueId[]`...).
- Không có Sprint (dùng Milestone) và không có labels tự do.

## Security

- Không commit password, API key hoặc private key.
- Không ghi secret ra console, testcase output, report hoặc description.
- Nếu token từng bị chia sẻ hoặc commit, rotate token đó.

## Google Sheet — cảnh báo tương thích

Google Sheet là app trên Backlog Marketplace, xác thực qua hệ Backlog. Sau khi tổ chức chuyển hẳn sang Backlog,
`scripts/integrations/aio/*` vẫn còn gọi API Backlog (`/rest/api/3/issue/{key}`) để resolve numeric id — chưa
migrate, và CHƯA RÕ Google Sheet còn dùng được không nếu Backlog bị bỏ hẳn. Đây là vấn đề kiến trúc riêng, chưa
quyết — không giả định `npm run aio:*` chạy được cho tới khi xác nhận lại.

## References

| Document | Purpose |
|---|---|
| [`../aio/README.md`](../aio/README.md) | Test-management: publish/pull testcase, đẩy kết quả execute, vòng đời case. |
| `prompt_templates/phase2/08_log_bug_backlog.md` | Backlog bug logging rules. |
| `RULE_GLOBAL.md` | Global security and output rules. |
