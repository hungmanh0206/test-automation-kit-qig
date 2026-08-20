# Run Requirement Apply Approved

> Phase 2 của Requirement Change Management: merge testcase đã được Human Review approve và partial execute subset bị ảnh hưởng.

## Purpose

Dùng prompt này sau khi Phase 1 đã tạo review package và Human Review đã approve rõ ràng.

Phase này chỉ xử lý phần đã approve. Nó không đọc lại tài liệu nguồn để regenerate mới, không tự mở rộng scope và không chạy full regression mặc định.

## When To Use

| Scenario | Use This Prompt |
|---|---|
| `review-checklist.md` đã được Human Review approve | Yes |
| Cần merge testcase `UPDATED`, `NEW`, `DEPRECATED` đã approve | Yes |
| Cần partial execute testcase bị ảnh hưởng sau merge | Yes |
| Review đang `REJECTED` hoặc `NEED_CLARIFICATION` | No |
| Chưa chạy Phase 1 Prepare Review | No |
| Cần detect tài liệu mới | No, dùng `run_requirement_prepare_review.md` |

## Inputs

| Input | Required | Notes |
|---|---|---|
| `PROJECT_OUTPUT_DIR` | Yes | Ví dụ `outputs/<YOUR_PROJECT>`. |
| `TASK_KEY` | Yes | Task/feature scope. |
| `RUN_ID` | Optional | Bắt buộc nếu partial execute song song cùng một `TASK_KEY`. |
| `HUMAN_REVIEW_STATUS` | Yes | `APPROVED` hoặc `APPROVED_WITH_RISK`. |
| `APPROVED_REVIEW_FILE` | Yes | Path tới `change/regen/review-checklist.md` đã được review. |
| `APPROVED_TC_IDS` | Recommended | Nếu bỏ trống, lấy từ review checklist. |
| `EXECUTION_SCOPE_NOTE` | Optional | Ghi chú nếu QA Lead muốn mở rộng subset. |
| `REPUBLISH_XRAY` | Optional | `1` (mặc định nếu testcase từng publish) — re-publish TC UPDATED+NEW lên **AIO Tests** sau merge (Step 2b). Tên biến giữ nguyên cho tương thích ngược. |
| `TESTCASE_SOURCE` | Optional | `aio` (mặc định) hoặc `excel` (`xray` = legacy). `aio`: sau re-publish, pull TC affected từ AIO làm nguồn execute; `excel`: execute từ Excel local đã merge. |
| `PUSH_XRAY_EXECUTION` | Optional | `1` (mặc định như các phase) — tạo **cycle** trên AIO sau execute (Step 6b). Tên biến giữ nguyên cho tương thích ngược. |
| Thư mục cycle | Optional | `--folder "<Tên sprint>"` để nhóm cycle theo sprint (AIO KHÔNG có Test Plan). |

## Gate Before Running

Chỉ chạy nếu tất cả điều kiện đúng:

| Gate | Required Result |
|---|---|
| Review file tồn tại | Yes |
| `HUMAN_REVIEW_STATUS` | `APPROVED` hoặc `APPROVED_WITH_RISK` |
| Approved TC list rõ ràng | Yes |
| Không còn Critical/High `NEED_REVIEW` | Yes |
| Source link/path không đổi từ Phase 1 | Yes |
| Draft testcase trace được tới source change | Yes |

Nếu bất kỳ gate nào fail, dừng và ghi stop reason. Không merge, không execute.

## Files To Read

| Priority | File |
|---:|---|
| 1 | `APPROVED_REVIEW_FILE` |
| 2 | `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/change/impact/impact-matrix.md` |
| 3 | `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/change/impact/affected-tc-map.json` |
| 4 | `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/change/regen/regenerated_test_cases.md` |
| 5 | `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/change/regen/deprecated_test_cases.md` |
| 6 | `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/change/snapshots/snapshot_context.json` |
| 7 | Official testcase Markdown trong `test-cases/` |

## Workflow

### Step 0: Echo Scope

Trước khi merge, ghi file hoặc chạy command, bắt buộc echo:

```text
PROJECT_OUTPUT_DIR=<value>
TASK_KEY=<value>
TASK_OUTPUT_DIR=<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>
RUN_ID=<value-or-N/A>
Workflow=Partial Rerun Phase 2 Apply Approved Change
```

Nếu `TASK_KEY` không khớp yêu cầu user, dừng ngay. Nếu yêu cầu hiện tại của user không nêu rõ `TASK_KEY`, không dùng `TASK_KEY` từ `.env` hoặc context cũ để chạy; phải hỏi lại. Nếu partial execute song song cùng một `TASK_KEY`, bắt buộc dùng `RUN_ID`.

Khi có `RUN_ID`, partial execution artifacts/report cho run đó nằm dưới:

```text
<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-results/runs/<RUN_ID>/
<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/reports/runs/<RUN_ID>/
```

Khi có `RUN_ID`, không ghi đè testcase Markdown/Excel chính trong lúc partial execute; chỉ ghi run-scoped report/status. Merge testcase chính vẫn chỉ theo approved change, không theo kết quả execute tạm.

### Step 1: Validate Approval

Kiểm:

- Reviewer decision rõ ràng.
- TC ID được approve.
- Không có blocker Critical/High.
- `APPROVED_WITH_RISK` có risk note.
- Không merge item `REJECTED` hoặc `NEED_CLARIFICATION`.

### Step 2: Merge Approved Testcase

Merge theo lifecycle:

| Lifecycle | Action |
|---|---|
| `ACTIVE` | Giữ nguyên. |
| `UPDATED` | Replace testcase tương ứng theo TC ID nếu approved. |
| `DEPRECATED` | Chuyển sang deprecated/archive section, giữ audit trail. |
| `NEW` | Append vào testcase chính theo ID convention. |
| `NEED_REVIEW` | Không merge. |

Sau merge:

- Export/update Excel nếu Markdown testcase chính thay đổi.
- Update `snapshot_context.json`.
- Ghi `change/regen/merge-summary.md`.
- Nếu Excel thay đổi và testcase đã từng publish lên TMS, ghi rõ recommended next step: chạy `partial-rerun/run_xray_test_cleanup.md` (Deprecate case rời Excel) sau khi re-publish.

### Step 2b: Re-publish testcase lên AIO (TC UPDATED + NEW)

Chỉ chạy khi testcase đã từng publish lên TMS (có `reports/aio-testcase-publish-summary.md`, hoặc `reports/jira-testcase-publish.json` với bộ cũ) và `REPUBLISH_XRAY != 0`. Mục đích: đẩy phần thay đổi lên AIO để AIO khớp Excel và làm **nguồn execute**.

- Chạy `aio:publish` **chỉ cho TC UPDATED + NEW đã approve** — dedup theo `automationKey` (= TC ID) đảm bảo **update case cũ + tạo case mới**, KHÔNG re-create toàn bộ (quan trọng vì **AIO không có API xoá**):

```powershell
npm run aio:publish -- --file <TASK_OUTPUT_DIR>/test-cases/<file>.xlsx --story <JIRA_STORY_KEY> --only <UPDATED+NEW TC_IDs> --folder-root "<base folder như lần publish trước>"
npm run aio:publish:apply -- --file <...>.xlsx --story <JIRA_STORY_KEY> --only <UPDATED+NEW TC_IDs> --folder-root "<base folder như lần publish trước>" --qa-approved
```

- Dùng lại **đúng `--folder-root`** như lần publish gốc; nhóm chức năng thành subfolder cấp 2 (`<root>/<nhóm>`) nên TC NEW tự vào đúng chỗ. ⚠ Bộ migrate từ Xray có cây 3 cấp — `aio:publish` chỉ dựng 2 cấp, nên với bộ đó hãy vá tại chỗ bằng `--only`.
- Dry-run là **mặc định**: xác nhận số update/created + cây folder đúng, rồi mới `aio:publish:apply ... --qa-approved`.
- Precondition đi theo case (field `precondition`), không cần flag riêng — AIO không có Precondition issue.
- Nếu testcase CHƯA từng publish lên AIO → bỏ qua bước này (chạy `TESTCASE_SOURCE=excel`).

### Step 3: Optional Testcase Cleanup — Deprecate (chạy SAU Step 2b re-publish)

> Cleanup CHỈ gắn label stale/restore cho TC bị **bỏ khỏi Excel** — KHÔNG tạo/không update TC (việc đó do Step 2b re-publish). Chạy sau re-publish để dọn TC không còn hợp lệ.

Chỉ chạy khi tất cả điều kiện đúng:

- Excel/testcase canonical đã merge theo Human Review approval.
- Testcase đã từng publish lên AIO (hoặc Xray, với bộ cũ) trước đó.
- QA/Human Review xác nhận muốn cleanup mirror.

Mặc định chỉ dry-run:

```powershell
npm run aio:deprecate-stale -- --story <JIRA_STORY_KEY> --file <TASK_OUTPUT_DIR>/test-cases/<file>.xlsx
```

Apply thật chỉ khi có approval riêng:

```powershell
npm run aio:deprecate-stale:apply -- --story <JIRA_STORY_KEY> --file <...>.xlsx
```

Không xoá case. Case rời khỏi Excel chỉ được chuyển `caseStatus` sang **Deprecated** (`npm run aio:deprecate-stale`), giữ nguyên lịch sử run; TC quay lại Excel thì trả về Published.

### Step 4: Select Partial Execution Scope

Chỉ chọn:

- TC `NEW` đã merge.
- TC `UPDATED` đã merge.
- TC affected theo `affected-tc-map.json`.
- TC liên quan trực tiếp theo shared API/helper nếu impact matrix chứng minh có ảnh hưởng.

Không chạy full regression mặc định.

Full regression chỉ khi:

- Business flow đổi lớn.
- API contract đổi diện rộng.
- UI/navigation/component shared đổi diện rộng.
- QA Lead yêu cầu rõ.

Output:

```text
change/partial-execution/selected-tc-list.txt
```

**Nguồn execute (mặc định `TESTCASE_SOURCE=aio`):** sau Step 2b re-publish, kéo testcase từ AIO về canonical local để execute (AIO là source of truth khi execute):

```powershell
npm run aio:pull:write -- --story <JIRA_STORY_KEY>
```

→ execute từ `test-cases/from-aio/*.xlsx` (chỉ chạy subset TC affected đã chọn). Nếu `TESTCASE_SOURCE=excel`: execute từ Excel local đã merge.

### Step 5: Execute And Capture Evidence

Thực hiện trực tiếp theo rule trong `partial-rerun/reference.md`.

Yêu cầu:

- Execute thật subset đã chọn.
- Không skip để làm đẹp pass rate.
- Nếu skip, ghi TC ID, lý do, có thể fix để chạy không.
- Capture evidence ảnh/video phù hợp (log chỉ là diagnostic local).
- Với flow phức tạp, ưu tiên video evidence nếu screenshot không đủ mô tả.

Output:

```text
change/partial-execution/execution-summary.md
change/partial-execution/bug-candidates.md
change/partial-execution/artifacts/
```

### Step 6: Classify Result

| Status | Meaning |
|---|---|
| `PASS` | Testcase chạy đúng expected mới đã approve. |
| `FAIL_PRODUCT_CANDIDATE` | Có khả năng bug product/API, cần triage theo Main Flow trước khi log Jira. |
| `FAIL_TEST_SETUP` | Fail do setup/data/env/auth/automation. |
| `SKIP_BLOCKED` | Skip có lý do hợp lệ và không thể tránh ngay. |
| `NEED_REVIEW` | Expected/source vẫn chưa đủ rõ, không merge/execute tiếp. |

### Step 6b: Đẩy kết quả lên AIO — tạo cycle (khi `PUSH_XRAY_EXECUTION=1`)

Sau khi phân loại, tạo **cycle** trên AIO cho **subset đã execute** — như các phase khác:

- Ghi `test-results[/runs/<RUN_ID>]/testcase-status.json` cho subset đã execute (status theo canonical trong `.agent/config/verdict_taxonomy.json`; bản ghi `FAIL` kèm step-level + evidence bước lỗi).
- Tạo cycle (và thư mục cycle theo sprint):

```powershell
npm run aio:push-exec -- --task <TASK_KEY> --only <selected TC_IDs> --folder "<Tên sprint>" [--run-id <RUN_ID>]
npm run aio:push-exec:apply -- --task <TASK_KEY> --only <selected TC_IDs> --folder "<Tên sprint>" [--run-id <RUN_ID>]
```

- **Chỉ gồm subset đã execute** (partial), không phải toàn bộ task.
- AIO KHÔNG có Test Plan: dùng `--folder "<Tên sprint>"` để nhóm cycle. Chạy lại cùng `--cycle-title` thì dùng lại cycle cũ, không đẻ cycle trùng.
- Cơ chế chung (status-map, validate theo `getStatuses`, tên execution, pre-create field bắt buộc, đóng execution) **giống Phase 2 §13b** — xem `prompt_templates/run_phase2_template.md`, không lặp lại ở đây.
- Dry-run trước rồi `--write`.

### Step 7: Bug Candidate Handoff

Nếu có testcase fail và được phân loại `FAIL_PRODUCT_CANDIDATE`, Partial Rerun chỉ tạo bug candidate package.

Output:

```text
change/partial-execution/bug-candidates.md
```

Bug candidate package phải ghi:

| Field | Required |
|---|---|
| TC ID | Yes |
| Expected result | Yes, theo testcase đã Human Review approve |
| Actual result | Yes |
| Evidence | Yes, ảnh/video liên quan (log chỉ là diagnostic) |
| Rerun count | Yes |
| Excluded causes | Yes, data/setup/env/mock/automation/flaky |
| Recommended next step | Yes, chuyển sang Main Flow bug triage nếu đủ điều kiện |

Không log Jira trực tiếp trong Partial Rerun. Jira chỉ được log sau khi user chuyển sang Main Flow bug triage và thỏa Jira gate của Phase 2 chính.

## Hard Rules

- Không chạy nếu thiếu Human Review approval.
- Không merge testcase `NEED_REVIEW`.
- Không execute testcase `NEED_REVIEW`.
- Không đọc tài liệu nguồn để tự regenerate lại trong Phase 2.
- Không chạy full regression mặc định.
- Không log Jira bug trực tiếp từ Partial Rerun này.
- Không cleanup (Deprecate) case trên AIO nếu chưa có QA approval riêng.
- Re-publish (Step 2b) **chỉ TC UPDATED + NEW** (dedup: update theo TC ID + tạo mới), KHÔNG re-create toàn bộ; dùng lại đúng base folder + subfolder-by-sheet.
- Execute + Test Execution chỉ cho **subset affected/UPDATED/NEW đã chọn**, không toàn bộ; Test Plan chỉ **link** (không tạo).
- Nếu có `FAIL_PRODUCT_CANDIDATE`, phải tạo `bug-candidates.md` thay vì log Jira.
- Không sửa expected result sau approval nếu không có review lại.

## Final Response

Trả lời ngắn:

- Review file đã dùng.
- TC đã merge.
- Re-publish AIO summary (updated/created + cây folder) nếu chạy Step 2b.
- TC đã execute (subset).
- Pass/fail/skip.
- Evidence path.
- Test Execution key + Test Plan link nếu chạy Step 6b.
- Cleanup (Deprecate) summary path nếu đã chạy cleanup.
- Bug candidate path nếu có.
- Risk/blocker còn lại.
- Có cần Phase 2/Main Flow triage bug không.

## Example

```text
Đọc partial-rerun/run_requirement_apply_approved.md và chạy:
PROJECT_OUTPUT_DIR=outputs/<YOUR_PROJECT>
TASK_KEY=<TASK_KEY>
HUMAN_REVIEW_STATUS=APPROVED
APPROVED_REVIEW_FILE=outputs/<YOUR_PROJECT>/tasks/<TASK_KEY>/change/regen/review-checklist.md
APPROVED_TC_IDS=<optional comma-separated TC IDs>
```


