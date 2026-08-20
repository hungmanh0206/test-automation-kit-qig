# Phase 1 - Bước 4: Auto Publish Testcase (AIO Tests)

> Publish testcase từ Excel source of truth lên **AIO Tests** sau khi QA xác nhận. Đây là step riêng trong phạm vi Phase 1, không chạy chung với bước sinh testcase.

## Mục Đích

Đẩy testcase đã được QA xác nhận từ Excel lên AIO Tests. Excel là source of truth khi gen/publish; **publish là bước cần TRƯỚC Phase 2** vì Phase 2 execute mặc định lấy nguồn từ AIO (`TESTCASE_SOURCE=aio`).

> Công cụ test-management của kit là **AIO Tests**. Đặc tính AIO (không có API xoá, `tags` không lưu, folder 2 cấp…): `scripts/integrations/aio/README.md`.

## Preconditions

| Điều kiện | Bắt buộc |
|---|---|
| Excel testcase đã export | Có |
| `phase1-summary.md` đã có Final Decision | Có |
| QA confirmation rõ ràng | Có |
| `AIO_API_TOKEN` (+ `AIO_PROJECT_KEY`) | Có nếu publish thật |
| Dry-run preview | **Bắt buộc** trước `--apply` (AIO không xoá được) |

## Workflow

1. Echo scope:
   - `PROJECT_OUTPUT_DIR`
   - `TASK_KEY`
   - `TASK_OUTPUT_DIR`
   - phase: `Phase 1 - Auto Publish Testcase (AIO)`
2. Xác nhận QA đã approve Excel/testcase:
   - Nếu prompt/user không ghi rõ `QA confirmation: APPROVED`, chỉ chạy dry-run hoặc dừng chờ xác nhận.
   - Không tự suy diễn approval từ việc Excel tồn tại.
3. Đọc Excel canonical:
   - `<TASK_OUTPUT_DIR>/test-cases/*.xlsx`
   - Ưu tiên sheet `Test Cases`.
   - Nhóm chức năng → folder AIO (cây 2 cấp `<root>/<nhóm>`), TC ID → `automationKey`.
4. Chạy dry-run (mặc định — không ghi gì lên AIO):
   ```powershell
   npm run aio:publish -- --file <TASK_OUTPUT_DIR>/test-cases/<file>.xlsx --story <JIRA_STORY_KEY>
   # [--limit 5] [--only TC_001,TC_007] [--folder-root "<tên gốc>"] [--throttle 130]
   ```
   Soi kỹ danh sách folder sẽ tạo: tên nhóm lệch/typo phải sửa TẠI ĐÂY, tạo rồi thì không xoá được qua API.
5. Chỉ publish thật khi QA/user xác nhận mode `PUBLISH`:
   ```powershell
   npm run aio:publish:apply -- --file <...>.xlsx --story <JIRA_STORY_KEY> --qa-approved
   ```
   Dedup theo `automationKey`: case đã có → UPDATE, chưa có → tạo. Chạy lại không tạo trùng.
6. Cập nhật `task.md` và **tự ghi** publish summary (script AIO không ghi report).
7. Đối soát: `TẠO n · CẬP NHẬT n · LỖI n`; có LỖI thì ghi blocker, không bỏ qua.

## Rules

- Không publish từ Markdown khi Excel đã tồn tại.
- Không publish thật nếu thiếu QA confirmation (`--qa-approved` bắt buộc khi `--apply`).
- Không sửa nội dung testcase trực tiếp trên AIO; authoring ở Excel rồi re-publish. `PUT .../detail` **ghi đè toàn phần** nên bản sửa tay trên UI sẽ mất.
- AIO case KHÔNG phải Jira issue ⇒ không có Test Set, requirement issue-link, Precondition issue riêng, assignee, label. Tiền điều kiện nằm trong field `precondition` của case.
- Nếu Excel bỏ bớt TC sau publish, không xử lý trong step này; chạy `partial-rerun/run_testcase_cleanup.md` (nay dùng `npm run aio:deprecate-stale`) sau Human Review/QA approval — cleanup = `caseStatus` **Deprecated**, KHÔNG hard delete.
- Không log Jira bug trong step này; bug logging thuộc Phase 2.
- Nếu publish lỗi một phần, giữ Excel canonical và ghi rõ lỗi trong report local.

## Outputs

| Output | Vị trí |
|---|---|
| Publish summary | `<TASK_OUTPUT_DIR>/reports/aio-testcase-publish-summary.md` |
| Task tracking update | `<TASK_OUTPUT_DIR>/task.md` |
