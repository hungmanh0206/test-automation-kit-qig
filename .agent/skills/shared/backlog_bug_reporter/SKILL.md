---
name: backlog_bug_reporter
description: Log Backlog sub-bug từ testcase FAIL đã xác nhận sau Phase 2.
---

# Backlog Bug Reporter

> Tên thư mục skill (`backlog_bug_reporter`) giữ nguyên sau khi tổ chức chuyển hệ bug-tracking cũ → Backlog (22/09/2026) —
> đổi tên thư mục sẽ phá mọi chỗ gọi `Skill(shared:backlog_bug_reporter)`. Nội dung bên dưới đã cập nhật cho
> Backlog; script thật nằm ở `scripts/integrations/backlog/bug_reporter.js`.

## Purpose

Tạo Backlog child issue/sub-bug khi Phase 2 đã chứng minh fail là product/API bug, có expected/actual/evidence rõ và không phải lỗi test/setup.

## Responsibilities

| Trách nhiệm | Yêu cầu |
|---|---|
| Gate | Chỉ log khi fail đã execute thật và rerun đủ để loại flaky/setup. |
| Deduplicate | So sánh bug hiện có bằng TC ID, summary, actual behavior (đọc lại qua `keyword` search — Backlog không có JQL, xem ghi chú trong bug_reporter.js). |
| Description | Backlog description (plain text) chỉ gồm 4 phần: Tiền điều kiện, Bước, Kết quả hiện tại, Kết quả mong muốn. |
| Evidence | Upload ảnh/video (2 bước: `POST /space/attachment` rồi gắn vào issue); cấm `.json/.md/.txt/.log/.html/.csv/trace.zip`. |
| Local log | Ghi kết quả vào report local. |

## Inputs

| Input | Nguồn |
|---|---|
| Results | `<TASK_OUTPUT_DIR>/test-results/results.json` hoặc run-scoped path |
| Evidence | `test-results/artifacts/` |
| Testcase | `test-cases/` |
| Backlog parent | `BACKLOG_STORY_KEY` hoặc CLI `--story` |

## Outputs

| Output | Vị trí |
|---|---|
| Backlog sub-bug | Backlog project configured by env (`BACKLOG_PROJECT_KEY`) |
| Local bug log | `<TASK_OUTPUT_DIR>/reports/` hoặc `reports/runs/<RUN_ID>/` |

## Decision Rules

- Không log nếu testcase đang `SKIP`.
- Không log nếu fail do prompt/test/setup/data/env/dependency/mock/timeout/locator.
- Không log nếu chưa xác nhận expected result đúng.
- Không log nếu evidence ảnh/video thiếu hoặc trắng với bug cần visual proof.
- Nếu bug trùng bug đã có, không tạo mới; ghi mapping vào report.

## Script

```bash
node scripts/integrations/backlog/bug_reporter.js --dry-run --task <TASK_KEY> --story <BACKLOG_STORY_KEY> --project-output <PROJECT_OUTPUT_DIR>
node scripts/integrations/backlog/bug_reporter.js --task <TASK_KEY> --story <BACKLOG_STORY_KEY> --project-output <PROJECT_OUTPUT_DIR>
```

Hoặc qua npm: `npm run backlog:bug-report:dry-run -- --task <TASK_KEY> --story <BACKLOG_STORY_KEY>` / `npm run backlog:bug-report -- ...`.

## Khác biệt so với Backlog (đọc trước khi log lần đầu)

- Priority chỉ 3 mức (High/Normal/Low, không có Critical/Lowest riêng) — Critical/High testcase đều map vào Backlog "High".
- Không có Sprint — set `BACKLOG_SPRINT_FIELD_ID` (id số, không phải tên) nếu project cần copy 1 custom field cụ thể từ Story, để trống thì bỏ qua.
- Không có labels tự do — nguồn phát hiện (`--found-by kit|human`) và marker duplicate-check (`[<tcId>]`) nằm trong summary/description, không phải field riêng.

## Anti-Patterns

- Log Backlog từ partial-rerun trực tiếp.
- Log Backlog cho fail chưa rerun/xác minh.
- Đưa execution summary hoặc markdown vào description.
- Comment Backlog tự động nếu user không yêu cầu hoặc không phải Re-run PASS flow.
