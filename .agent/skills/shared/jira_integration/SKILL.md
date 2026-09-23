---
name: jira_integration
description: Fetch/read Backlog và source liên quan khi workflow yêu cầu context từ Backlog/Figma. (Confluence tạm ngoài phạm vi — chờ chuyển sang Google Docs/Sheet.)
---

# Backlog Integration

> Tên thư mục skill (`jira_integration`) giữ nguyên sau khi tổ chức chuyển Jira→Backlog (22/09/2026) — đổi
> tên thư mục sẽ phá mọi chỗ gọi `Skill(shared:jira_integration)`. Nội dung bên dưới đã cập nhật cho
> Backlog; script thật nằm ở `scripts/integrations/backlog/`.

## Purpose

Đọc hoặc fetch context Backlog/Figma phục vụ Phase 1/Phase 2 khi user cung cấp link hoặc workflow yêu cầu.
Confluence (`fetch_confluence.js`/`publish_confluence_page.js`) vẫn còn trong `scripts/integrations/backlog/`
nhưng KHÔNG chạy được — biến `CONFLUENCE_*` đã bị xoá khỏi `.env`, chờ quyết chuyển sang Google Docs/Sheet.

## Responsibilities

| Trách nhiệm | Yêu cầu |
|---|---|
| Fetch | Dùng script/MCP phù hợp để lấy issue/design trong scope. |
| Cache | Lưu raw/snapshot dưới `<TASK_OUTPUT_DIR>/requirements/`. |
| Redact | Không ghi token/cookie/secret vào output. |
| Scope | Chỉ đọc issue/node liên quan, tránh raw source quá lớn. |

## Inputs

| Input | Nguồn |
|---|---|
| Backlog/Figma link | Prompt/user request |
| Env config | `.env.local`, `.env`, CI env (`BACKLOG_BASE_URL`, `BACKLOG_API_KEY`, `FIGMA_API_KEY`...) |
| Task scope | `PROJECT_OUTPUT_DIR`, `TASK_KEY` |

## Outputs

| Output | Vị trí |
|---|---|
| Requirement artifact | `<TASK_OUTPUT_DIR>/requirements/backlog/` |
| Fetch summary | `task.md` hoặc `reports/phase1-summary.md` |

## Decision Rules

- Dùng local artifact nếu đã đủ thay vì fetch lại.
- Nếu thiếu quyền/link chết, ghi blocker rõ.
- Nếu source content đổi sau baseline, chuyển sang partial-rerun khi user yêu cầu; không tự chèn vào Main Flow.
- Backlog KHÔNG có khái niệm Epic — dùng `--epic <KEY>` của `backlog_fetcher.js` để lấy issue con (subtask) của một issue cha, đây là tương đương gần nhất.

## Constraints

- Không log Backlog bug từ skill này.
- Không in credential hoặc raw response chứa secret.
- Không fetch toàn bộ project nếu chỉ cần một issue.

## References

- `scripts/integrations/backlog/backlog_fetcher.js`: fetch issue/project issues/parent-children từ Backlog.
- `scripts/integrations/backlog/check_connection.js`: kiểm cấu hình + live connection.
- `scripts/integrations/backlog/fetch_confluence.js`, `publish_confluence_page.js`: NGOÀI PHẠM VI hiện
  tại (Confluence chưa migrate) — đừng gọi, sẽ lỗi thiếu env.
- `scripts/lib/confluence/storage_to_markdown.js`: bộ đổi storage sang Markdown dùng chung cho đường fetch
  Confluence cũ. Giữ bảng, danh sách, heading và khối code. Sửa cách đọc tài liệu thì sửa ở đây, đừng
  viết lại regex gỡ thẻ trong fetcher (test `confluence-markdown.spec.ts` chặn việc đó).
