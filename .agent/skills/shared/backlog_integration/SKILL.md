---
name: backlog_integration
description: Fetch/read Backlog và source liên quan khi workflow yêu cầu context từ Backlog/Figma. (tài liệu nguồn tạm ngoài phạm vi — chờ chuyển sang Google Docs/Sheet.)
---

# Backlog Integration

> Tên thư mục skill (`backlog_integration`) giữ nguyên sau khi tổ chức chuyển hệ bug-tracking cũ → Backlog (22/09/2026) — đổi
> tên thư mục sẽ phá mọi chỗ gọi `Skill(shared:backlog_integration)`. Nội dung bên dưới đã cập nhật cho
> Backlog; script thật nằm ở `scripts/integrations/backlog/`.

## Purpose

Đọc hoặc fetch context Backlog/Figma phục vụ Phase 1/Phase 2 khi user cung cấp link hoặc workflow yêu cầu.
Tài liệu requirement/BA KHÔNG còn fetch bằng script: tài liệu nay soạn trong Obsidian vault, đưa sang
`<TASK_OUTPUT_DIR>/docs/` dưới dạng Markdown rồi đọc trực tiếp.

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

## Khi dùng / KHÔNG dùng

| Dùng | KHÔNG dùng |
|---|---|
| Cần nội dung issue/story làm context cho Phase 1 | **Log bug** — đó là `backlog_bug_reporter` |
| Cần lấy issue con của một issue cha | Publish testcase — testcase đi **Google Sheet**, không đi Backlog |
| Artifact local đã cũ hơn issue thật | Artifact local đã đủ: fetch lại là tốn lượt mà không thêm gì |

⚠️ **Ảnh dán trong description KHÔNG ra ở API attachments.** Đo được: ảnh paste trực tiếp vào mô tả issue
không xuất hiện trong danh sách attachment mà API trả về — muốn xem phải mở web UI. Kết luận "issue không
có ảnh" từ API là kết luận sai.

## Máy kiểm

- `npm run integration:check` — kiểm cấu hình (không gọi mạng). `npm run integration:check:live` — kiểm
  kết nối thật. Chạy cái đầu trước: thiếu biến môi trường thì lỗi mạng chỉ là triệu chứng.
- `npm run gate:policy` — gác NO-LEGACY-TOOLS. Backlog là công cụ SỐNG của kit nên nó KHÔNG nằm trong
  danh sách công cụ đã bỏ; đừng suy ngược rằng vì vậy mọi việc đều đi Backlog. (Danh sách đó không chép
  lại ở đây: chính `gate:policy` chặn mọi bề mặt của kit nhắc tên chúng, kể cả một câu đang giải thích
  luật — đã dính thật khi viết dòng này.)

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
