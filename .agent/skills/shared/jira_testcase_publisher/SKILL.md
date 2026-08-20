---
name: jira_testcase_publisher
description: Publish testcase từ Excel canonical lên AIO Tests sau Phase 1 (npm run aio:publish); cleanup lifecycle (Deprecate) thuộc partial-rerun khi Excel thay đổi.
---

# Testcase Publisher (AIO Tests)

> Tên skill giữ nguyên `jira_testcase_publisher` cho tương thích ngược (AIO Tests là app trong Jira), nhưng đích đến là **AIO Tests**.

## Purpose

Publish bộ testcase đã được QA xác nhận từ Excel lên **AIO Tests** để QA/Dev review, track và làm nguồn cho Phase 2 execute. Excel trong `<TASK_OUTPUT_DIR>/test-cases/` là source of truth khi **authoring/publish** (sửa nội dung ở Excel rồi re-publish); Phase 2 execute mặc định đọc từ AIO (`TESTCASE_SOURCE=aio`). Publish là step riêng trong phạm vi Phase 1. Khi Excel thay đổi sau publish, cleanup lifecycle thuộc nhánh phụ `partial-rerun/run_testcase_cleanup.md`.

## Responsibilities

| Trách nhiệm | Yêu cầu |
|---|---|
| Source | Chỉ đọc Excel `.xlsx` đã export từ Phase 1, ưu tiên sheet `Test Cases`. |
| QA gate | Chỉ publish thật khi có QA confirmation rõ ràng **và** `--qa-approved`. |
| Publish | Tạo/cập nhật **case** trên AIO: `title`, `steps[]`, `precondition`, `priority`, `type`, `scriptType` (bắt buộc khi có steps). |
| Khoá liên kết | `TC ID` → **`automationKey`** (KHÔNG dùng `tags`: AIO trả 200 nhưng không lưu — đã đo). Story → `jiraRequirementIDs`. |
| Nhóm chức năng | → **folder** `<root>/<nhóm>` (cây **2 cấp**, dựng TỪ Excel, không hardcode danh sách tên). |
| Tiền điều kiện | Nằm trong field `precondition` của chính case; mã `[PRE-NN]` giữ trong text để tra chéo (AIO không có Precondition issue dùng chung). |
| Safety | **Mặc định dry-run**; chỉ `--apply` mới ghi. AIO **KHÔNG có API xoá** ⇒ sai là phải dọn tay trên UI. |
| Deduplicate | Theo `automationKey`: đã có → UPDATE (`mergePut`, vì `PUT .../detail` ghi đè toàn phần), chưa có → tạo. Chạy lại không tạo trùng. |
| Cleanup | Khi Excel bỏ TC đã publish: `npm run aio:deprecate-stale` → đổi `caseStatus` sang **Deprecated** (giữ lịch sử run), sau Human Review approval. |
| No hard delete | Không xoá case (và cũng không có API để xoá). |
| Report | Tự ghi kết quả publish local dưới `<TASK_OUTPUT_DIR>/reports/` — script AIO không tự ghi report. |

## Inputs

| Input | Nguồn |
|---|---|
| Excel testcase | `<TASK_OUTPUT_DIR>/test-cases/*.xlsx` qua CLI `--file` |
| Jira story (requirement) | `JIRA_STORY_KEY` hoặc CLI `--story` |
| Công cụ TMS | `TEST_MANAGEMENT_TOOL=aio` (mặc định) |
| Token AIO | `AIO_API_TOKEN` (bắt buộc) — Jira API token KHÔNG dùng được |
| Project/endpoint | `AIO_PROJECT_KEY` (mặc định `JIRA_PROJECT_KEY`) · `AIO_BASE_URL` · `AIO_THROTTLE_MS` |
| Gốc cây folder | CLI `--folder-root` (mặc định `JIRA_STORY_KEY`, fallback tên file Excel) |
| Rules | `RULE_GLOBAL.md`, active prompt |

## Outputs

| Output | Vị trí |
|---|---|
| Case trên AIO Tests | Project AIO theo env |
| Publish summary | `<TASK_OUTPUT_DIR>/reports/aio-testcase-publish-summary.md` (agent tự ghi) |
| Cleanup summary | `<TASK_OUTPUT_DIR>/reports/aio-deprecate-summary.md` (agent tự ghi) |

## Commands

Dry-run (mặc định — không ghi gì lên AIO):

```bash
npm run aio:publish -- --file <TASK_OUTPUT_DIR>/test-cases/<file>.xlsx --story <JIRA_STORY_KEY>
# [--limit 5] [--only TC_001,TC_007] [--folder-root "<tên gốc>"] [--throttle 130]
```

Publish thật (sau khi QA duyệt và đã soi dry-run):

```bash
npm run aio:publish:apply -- --file <...>.xlsx --story <JIRA_STORY_KEY> --qa-approved
```

Cleanup lifecycle khi Excel bỏ bớt TC (partial-rerun, sau Human Review):

```bash
npm run aio:deprecate-stale                # xem trước
npm run aio:deprecate-stale:apply          # đổi caseStatus sang Deprecated
```

## Decision Rules

- Không publish từ Markdown nếu Excel đã tồn tại; Excel là canonical source.
- Không publish thật nếu QA chưa xác nhận `APPROVED`; script cũng đòi `--qa-approved` (hoặc `JIRA_TESTCASE_QA_APPROVED=1`) khi `--apply`.
- **Luôn xem dry-run trước** — nhất là danh sách folder sẽ tạo: tên nhóm lệch/typo phải sửa trước khi ghi, vì folder/case tạo rồi không xoá được qua API.
- Case AIO **không phải Jira issue** ⇒ không có Test Set, requirement issue-link/panel Test Coverage, Precondition issue riêng, Test Type, assignee, label. Đừng đi tìm rồi kết luận "thiếu".
- Nhóm chính lấy từ cột `Nhóm chức năng` (fallback đoạn đầu `Module`) và thể hiện bằng folder AIO.
- Nếu Excel không còn TC ID đã publish, dùng `aio:deprecate-stale` (Deprecated), không xoá.
- Nếu token/quyền chưa sẵn sàng, ghi blocker hoặc chỉ dry-run; không tạo case mơ hồ.
- Nếu publish lỗi một phần, giữ Excel và report local làm source; không sửa testcase để khớp lỗi publish.
- Bộ testcase cũ có cây folder sâu 3 cấp, còn `aio:publish` chỉ dựng 2 cấp ⇒ thêm case vào bộ đó thì vá tại chỗ (`--only`), đừng publish lại cả bộ.
- Phase 2 execute mặc định lấy nguồn từ AIO (`TESTCASE_SOURCE=aio`, kéo về canonical local `from-aio/*.xlsx` bằng `npm run aio:pull:write`); `excel` là opt-out.

## Anti-Patterns

- Tạo testcase trên TMS trực tiếp từ requirement khi chưa có Excel.
- Sửa nội dung case trực tiếp trên UI AIO thay vì sửa Excel rồi re-publish — `PUT .../detail` ghi đè toàn phần nên bản sửa tay sẽ mất.
- Chạy `--apply` khi chưa soi dry-run (không có API xoá để lùi).
- Đưa TC ID vào `tags` (AIO trả 200 nhưng không lưu) hoặc ghép `[TC] <ID> -` vào `title`.
- Khớp case theo **tiêu đề** thay vì `automationKey` — nhiều case trùng tiêu đề ở nhóm khác nhau (đã mất 12 run khi migrate).
- Publish lại cả bộ chỉ để thêm vài case (đè folder/cây, tốn rate limit).
- Trộn testcase publish với Jira bug logging sau Phase 2.
