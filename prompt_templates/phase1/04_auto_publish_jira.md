# Prompt Phase 1 - Auto Publish Testcase (AIO Tests)

> Chạy: `Đọc file này và chạy với TASK_KEY=<TASK_KEY>`. Rule: non-negotiables ở `CLAUDE.md` (đã auto-load). Digest: `.agent/rules/core_rules.md`. Chỉ mở `RULE_GLOBAL.md` **ở đúng mục cần** (mỗi gạch đầu dòng của digest có ghi `§`) — đừng nạp cả file.

Dùng prompt này như một step riêng trong phạm vi Phase 1, chỉ sau khi Phase 1 đã sinh testcase, export Excel và QA đã xác nhận Excel/testcase đủ điều kiện publish. Không dùng prompt này để log bug Jira.

> **Công cụ test management: AIO Tests** (`TEST_MANAGEMENT_TOOL=aio`, mặc định từ GĐ5 — Xray đóng băng sau 21/08/2026). Lệnh Xray cũ (`npm run jira:testcase-publish`) **tự CHẶN** kèm lệnh thay thế, nên không phải nhớ. Khác biệt mô hình + 9 đặc tính đã đo của AIO: `scripts/integrations/aio/README.md`. Chạy đường Xray legacy (chỉ để đọc/đối chiếu dữ liệu cũ): xem mục cuối file.

```text
Chạy step Phase 1 - Auto Publish testcase lên AIO Tests.

Điều kiện bắt buộc trước khi chạy:
- Testcase Markdown đã được sinh/cập nhật.
- Excel testcase đã export thành công và là source of truth.
- `reports/phase1-summary.md` đã có coverage/risk review và Final Decision.
- QA đã xác nhận Excel/testcase được phép publish.
- Nếu QA chưa xác nhận rõ, chỉ được chạy DRY_RUN hoặc dừng chờ xác nhận; không publish thật.

QA confirmation:
- Status: [APPROVED / NOT_APPROVED]
- Người xác nhận: [QA_NAME_OR_ROLE]
- Thời điểm/xác nhận tham chiếu: [CHAT_CONFIRMATION / COMMENT / MEETING_NOTE / N/A]

Phạm vi:
- Task key/scope folder: [TASK_KEY]
- Jira Story/Task parent: [JIRA_STORY_KEY]
- Jira project key: [JIRA_PROJECT_KEY_OR_EMPTY]
- Output root: [PROJECT_OUTPUT_DIR]
- Task output dir: `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/`

Parallel story safety:
- Trước khi đọc Excel hoặc gọi publisher, echo `PROJECT_OUTPUT_DIR`, `TASK_KEY`, `TASK_OUTPUT_DIR`.
- Nếu `TASK_KEY` không khớp task user yêu cầu, dừng ngay.
- Không sửa `.env` hoặc `.env.local` chung khi có session khác đang chạy.

Input artifacts:
- Testcase Excel source of truth:
  `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-cases/*.xlsx`
- Testcase Markdown:
  `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-cases/*.md`
- Phase 1 summary:
  `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/reports/phase1-summary.md`
- Task tracker:
  `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/task.md`

Env/config:
- Đọc biến môi trường từ `.env.local`, `.env` (creds task ở `profiles/<TASK_KEY>/task.env`).
- Không in password, API token, PAT, cookie hoặc private key ra console, markdown, testcase output, report hoặc log.
- Publish thật cần:
  - `TEST_MANAGEMENT_TOOL=aio` (mặc định; nên đặt tường minh trong `.env` cho rõ ràng).
  - `AIO_API_TOKEN` — token AIO Tests (Jira > AIO Tests > API tokens). Jira API token KHÔNG dùng được.
  - `AIO_PROJECT_KEY` (mặc định lấy `JIRA_PROJECT_KEY`) · `AIO_BASE_URL` · `AIO_THROTTLE_MS` nếu bị rate limit.
  - `JIRA_STORY_KEY` hoặc flag `--story [JIRA_STORY_KEY]` → ghi vào `jiraRequirementIDs` của case (đường nối case ↔ story).
  - Flag `--qa-approved` (hoặc `JIRA_TESTCASE_QA_APPROVED=1`) khi `--apply`; thiếu là script CHẶN.
- ⚠ **AIO KHÔNG có API xoá** (case · attachment · run cuối của case · cycle). Publish nhầm là phải vào UI dọn tay từng cái ⇒ mọi lệnh mặc định **dry-run**, chỉ `--apply` mới ghi.
- Ánh xạ cột Excel → field AIO (case AIO KHÔNG phải Jira issue nên không có assignee/label/issue-link):
  - `Trường hợp kiểm thử` → `title` (không thêm prefix `[TC] <ID> -`)
  - `TC ID` → `automationKey` (**không dùng `tags`**: AIO trả 200 nhưng không lưu — đã đo)
  - `Tiền điều kiện` → field `precondition` **trong case** (AIO không có Precondition issue dùng chung; mã `[PRE-NN]` vẫn nằm trong text để tra chéo)
  - `Nhóm chức năng` → **folder** `<root>/<nhóm>` (cây dựng TỪ Excel, không hardcode danh sách tên)
  - `Các bước thực hiện` / `Kết quả mong đợi` → `steps[]` ghép theo số thứ tự · `Dữ liệu Test` → `steps[0].data`
  - `Ưu tiên` → `priority` · nhóm bắt đầu bằng `API` / chứa `security|phân quyền` → `type` tương ứng
- Cây folder chỉ **2 cấp** (`<root>/<nhóm chức năng>`): `--folder-root` mặc định là `[JIRA_STORY_KEY]` (fallback tên file Excel). Bộ testcase migrate từ Xray có cây sâu 3 cấp — muốn thêm case vào bộ cũ thì vá tại chỗ (`--only`), đừng publish lại cả bộ.
- KHÔNG còn (vì AIO case không phải Jira issue): Test Set, requirement issue-link/panel Test Coverage, Precondition issue riêng, Test Type field, assignee, label `group-*`/`tc-*`. Đừng đi tìm rồi kết luận "thiếu".

Mode:
- [DRY_RUN / PUBLISH]
- Mặc định chạy DRY_RUN trước để preview.
- Chỉ chạy PUBLISH khi `QA confirmation Status = APPROVED` và user/prompt hiện tại cho phép ghi thật.

Các bước thực hiện:
1. Echo scope và kiểm tra `TASK_OUTPUT_DIR`.
2. Kiểm tra tồn tại:
   - `test-cases/*.xlsx`
   - `reports/phase1-summary.md`
   - `task.md`
3. Đọc Excel source of truth, ưu tiên sheet `Test Cases`.
4. Xác nhận số lượng testcase đọc được từ Excel khớp kỳ vọng trong `phase1-summary.md` hoặc ghi rõ chênh lệch/blocker.
5. Nếu `QA confirmation Status != APPROVED`:
   - Chạy dry-run nếu cần preview.
   - Không chạy publish thật.
   - Ghi vào `task.md`: `Testcase publish (AIO): Pending QA confirmation`.
6. Chạy dry-run (mặc định, không ghi gì lên AIO):
   `npm run aio:publish -- --file <TASK_OUTPUT_DIR>/test-cases/<file>.xlsx --story [JIRA_STORY_KEY]`
   - `--limit 5` để thử vài case đầu; `--only TC_001,TC_007` để đẩy lại vài case lẻ sau khi sửa Excel.
   - `--folder-root "<tên gốc>"` nếu không muốn lấy `[JIRA_STORY_KEY]` làm gốc cây.
   - `--throttle 130` nếu AIO trả **body rỗng** (đó là rate limit, không phải 429).
7. Review dry-run output:
   - Tổng case đọc từ Excel / số case sẽ xử lý.
   - Danh sách folder sẽ tạo (`<root>/{nhóm...}`) — soi tên nhóm lệch/typo TẠI ĐÂY, vì sau khi tạo không xoá được.
   - Payload mẫu (title, automationKey, precondition, priority, số step).
   - Error/blocker.
8. Nếu mode là `PUBLISH` và QA đã APPROVED, chạy publish thật:
   `npm run aio:publish:apply -- --file <...>.xlsx --story [JIRA_STORY_KEY] --qa-approved`
   - Dedup theo `automationKey`: case đã có thì **UPDATE** (`↻ KEY`), chưa có thì tạo (`✓ KEY`) — chạy lại KHÔNG tạo trùng.
   - `PUT .../detail` là ghi đè toàn phần (script dùng `mergePut`), nên đừng sửa case thẳng trên UI rồi re-publish: bản UI sẽ bị Excel ghi đè.
   - Đọc kỹ dòng tổng `TẠO n · CẬP NHẬT n · LỖI n`; có LỖI thì exit code khác 0.
9. Ghi/cập nhật (script AIO **không** tự ghi report — agent phải tự ghi):
   - `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/reports/aio-testcase-publish-summary.md` — mode, tổng case, created/updated/failed, cây folder, key AIO đại diện.
   - `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/task.md`
10. Final cho user chỉ tóm tắt:
    - Mode đã chạy.
    - Tổng testcase đọc từ Excel.
    - Created / Updated / Error.
    - Đường dẫn publish summary.

Quy tắc bắt buộc:
- Excel là source of truth. Không publish từ Markdown nếu Excel đã tồn tại. Sửa nội dung testcase ở Excel rồi re-publish, KHÔNG sửa thẳng trên AIO.
- Phase 2 execute mặc định lấy nguồn từ **AIO** (`TESTCASE_SOURCE=aio`, kéo về canonical local `test-cases/from-aio/*.xlsx` bằng `npm run aio:pull:write`); `excel` là opt-out; `xray` là legacy. Vì vậy publish là bước cần TRƯỚC Phase 2.
- Không publish thật khi QA chưa xác nhận `APPROVED`, và không bao giờ `--apply` khi chưa xem dry-run.
- Nếu Excel đã bỏ bớt TC sau khi đã publish, prompt này không dọn case cũ; chạy nhánh phụ `partial-rerun/run_xray_test_cleanup.md` (đã chuyển sang `npm run aio:deprecate-stale`) sau Human Review/QA approval. Trên AIO, "cleanup" = đổi `caseStatus` sang **Deprecated** (giữ lịch sử run), KHÔNG phải xoá.
- Không log Jira bug trong prompt này; log bug Jira thuộc `prompt_templates/phase2/08_log_bug_jira.md`.
- Không đưa secret vào report hoặc console.
- Nếu dry-run hoặc publish lỗi, ghi blocker rõ trong publish summary/task.md; không sửa testcase để né lỗi publish.

Extra instruction:
- [ANY_EXTRA_REQUEST hoặc N/A]
```

## Đường Xray (LEGACY — chỉ đọc/đối chiếu dữ liệu cũ)

Xray đóng băng sau **21/08/2026**. `scripts/integrations/jira/publish_testcases.js` vẫn còn để đọc dữ liệu cũ và để `aio/migrate_*.js` dùng lại `xray_cloud.js`, nhưng **tự chặn** khi `TEST_MANAGEMENT_TOOL=aio`. Nếu thật sự cần chạy đường cũ (một lần, có lý do rõ):

- `npm run jira:testcase-publish:dry-run -- --task [TASK_KEY] --story [JIRA_STORY_KEY] --test-management-tool xray`
- Toàn bộ chi tiết Xray (chiều requirement link, Coverable Issue Types, Test Set, `--push-xray-steps`, `--push-xray-preconditions`, Test Repository folder) nằm trong header của script đó + `scripts/integrations/jira/README.md`; **đừng phát triển thêm ở nhánh này**.
- Di trú dữ liệu Xray cũ sang AIO: `npm run aio:migrate-tc` / `npm run aio:migrate-exec` (mặc định dry-run).
