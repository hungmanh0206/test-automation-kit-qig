# Jira, Confluence And Figma Integration Scripts

> Script Node.js dùng chung để **fetch requirement** (Jira/Confluence/Figma), **log bug Jira**, và **publish USER_GUIDE lên Confluence**. Test-management (testcase/execution) KHÔNG ở đây — nó thuộc `scripts/integrations/aio/`.

## Purpose

Các script trong thư mục này hỗ trợ Phase 1 fetch requirement từ Jira/Confluence/Figma, và Phase 2 log bug Jira có điều kiện. Mọi việc liên quan tới testcase/execution (publish · pull · push kết quả · vòng đời case) nằm ở [`../aio/`](../aio/README.md).

## When To Use

| Tình huống | Script |
|---|---|
| Lấy requirement/spec từ Jira (issue · epic · JQL) | `jira_fetcher.js` |
| Lấy tài liệu từ Confluence | `fetch_confluence.js` |
| Lấy design/metadata từ Figma | `fetch_figma.js` · `probe_figma.js` |
| Log bug Jira sau khi execute (đủ điều kiện + đã rerun) | `bug_reporter.js` |
| Publish USER_GUIDE lên Confluence cho team | `publish_confluence_page.js` |
| Kiểm cấu hình/kết nối trước khi gọi API | `check_connection.js` |

## Files

| File | Purpose |
|---|---|
| `jira_fetcher.js` | Fetch Jira issues/epics/JQL results. |
| `fetch_confluence.js` | Fetch Confluence page by `CONFLUENCE_PAGE_ID`. |
| `fetch_figma.js` | Fetch Figma file/node and save raw JSON + summary. |
| `probe_figma.js` | Verify access to Figma file/node. |
| `publish_confluence_page.js` | Publish/update một Confluence page từ Markdown (tự backup bản cũ, có `--dry-run`). |
| `bug_reporter.js` | Create Jira child bug/sub-bug from failed tests. |
| `check_connection.js` | Kiểm env + live connection (Jira · AIO Tests · Confluence · Figma) mà không in secret. |
| `utils.js` | Shared helpers (load env, build headers, resolve accountId…). |

## Environment

Đặt ở `.env` chung của repo (hoặc `.env.local`); **không** commit:

| Nhóm | Biến |
|---|---|
| Jira | `JIRA_BASE_URL`/`JIRA_URL` · `JIRA_EMAIL`/`JIRA_USERNAME` · `JIRA_API_TOKEN`/`JIRA_PAT` · `JIRA_PROJECT_KEY` · `JIRA_STORY_KEY` |
| Bug | `JIRA_BUG_ISSUE_TYPE` · `JIRA_FE_ASSIGNEE` · `JIRA_BE_ASSIGNEE` · `JIRA_SPRINT_FIELD_ID` |
| Confluence | `CONFLUENCE_URL` · `CONFLUENCE_USERNAME` · `CONFLUENCE_API_TOKEN` · `CONFLUENCE_PAGE_ID` |
| Figma | `FIGMA_API_KEY` · `FIGMA_FILE_KEY`/`FIGMA_FILE_URL` · `FIGMA_NODE_ID` |
| AIO Tests (dùng bởi `check_connection`) | `AIO_API_TOKEN` · `AIO_PROJECT_KEY` (mặc định `JIRA_PROJECT_KEY`) |

## Common Commands

| Task | Command |
|---|---|
| Kiểm config | `npm run integration:check` |
| Kiểm config + live connection | `npm run integration:check:live` |
| Fetch Jira issue | `node scripts/integrations/jira/jira_fetcher.js --issue <ISSUE_KEY> --format md` |
| Fetch Jira epic | `node scripts/integrations/jira/jira_fetcher.js --epic <EPIC_KEY> --format md` |
| Fetch by JQL | `node scripts/integrations/jira/jira_fetcher.js --jql "project = <PROJECT_KEY> AND status != Done" --format md` |
| Fetch Confluence | `node scripts/integrations/jira/fetch_confluence.js` |
| Probe Figma | `node scripts/integrations/jira/probe_figma.js` |
| Fetch Figma | `node scripts/integrations/jira/fetch_figma.js` |
| Publish USER_GUIDE lên Confluence (xem trước) | `CONFLUENCE_PAGE_ID=<id> node scripts/integrations/jira/publish_confluence_page.js --dry-run` |
| Jira bug dry-run | `npm run jira:bug-report:dry-run -- --task <TASK_KEY> --story <JIRA_STORY_KEY> --project-output <PROJECT_OUTPUT_DIR>` |
| Create Jira bug | `npm run jira:bug-report -- --task <TASK_KEY> --story <JIRA_STORY_KEY> --project-output <PROJECT_OUTPUT_DIR>` |

## Jira Bug Rules

| Rule | Requirement |
|---|---|
| Parent | Bug must be child/sub-bug under `JIRA_STORY_KEY`. |
| Assignee | Gán theo TẦNG lỗi: `JIRA_FE_ASSIGNEE` (bug FE) · `JIRA_BE_ASSIGNEE` (bug BE); hoặc parent assignee. |
| Title | Prefix with `[FE]` or `[BE]` khớp tầng lỗi. |
| Description | Only `Tiền điều kiện`, `Bước`, `Kết quả hiện tại`, `Kết quả mong muốn`. |
| Evidence | Ảnh/video từ `test-results/artifacts/` — highlight đúng element, mask PII. |

## Security

- Không commit password, API token, cookie hoặc private key.
- Không ghi secret ra console, testcase output, report hoặc Jira description.
- Nếu token từng bị chia sẻ hoặc commit, rotate token đó.

## References

| Document | Purpose |
|---|---|
| [`../aio/README.md`](../aio/README.md) | Test-management: publish/pull testcase, đẩy kết quả execute, vòng đời case. |
| `prompt_templates/phase2/08_log_bug_jira.md` | Jira bug logging rules. |
| `RULE_GLOBAL.md` | Global security and output rules. |
