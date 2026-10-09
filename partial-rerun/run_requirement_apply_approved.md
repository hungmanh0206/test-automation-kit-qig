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
| `REPUBLISH_TESTCASES` | Optional | `1` (mặc định nếu testcase từng publish) — re-publish (ghi đè) **Google Sheet** sau merge (Step 2b). |
| `TESTCASE_SOURCE` | Optional | Mặc định tải lại từ Google Sheet sau re-publish làm nguồn execute; `excel` để execute từ Excel local đã merge (chưa publish). |
| `PUSH_EXECUTION` | Optional | `1` (mặc định như các phase) — đồng bộ status execute lên Sheet sau execute (Step 6b). |

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
- Nếu Excel thay đổi và testcase đã từng publish lên TMS, ghi rõ recommended next step: chạy `partial-rerun/run_testcase_cleanup.md` (Deprecate case rời Excel) sau khi re-publish.

### Step 2a: PHIÊN BẢN HOÁ ORACLE + gate nội dung (BẮT BUỘC, TRƯỚC khi publish)

Nhánh này tồn tại vì **requirement đổi nội dung**. Nếu chỉ cập nhật testcase mà không cập nhật kho tri
thức thì oracle trong `knowledge/` vẫn là bản CŨ — lần sau agent sinh case sẽ dùng rule lỗi thời, và
`--stale` cũng không phát hiện được vì `confirmed_at` không đổi. Đây là lúc **duy nhất** biết chắc rule nào
đã đổi VÀ đã có người duyệt (`HUMAN_REVIEW_STATUS = APPROVED`), nên là thời điểm đúng để phiên bản hoá.

1. **Business rule đổi ⇒ record MỚI, không sửa tại chỗ:**
   - Tạo `knowledge/domain/<BR-ID>.json` với `version: <N+1>`, `supersedes: "<BR-ID>@v<N>"`,
     `confirmed_at: <ngày duyệt>`, `source` trỏ đúng tài liệu/câu trả lời BA của lượt này.
   - Bản cũ: `status: superseded` (giữ lại — lịch sử oracle là thứ dùng để giải thích verdict cũ).
   - Sửa tại chỗ là mất khả năng trả lời "hôm đó case PASS theo rule nào".
2. **Bảng trạng thái / ma trận quyền đổi** ⇒ cập nhật `knowledge/system/` (`state_machine`,
   `permission_matrix`) theo cùng nguyên tắc version.
3. Chạy máy kiểm, theo thứ tự:

```powershell
npm run domain:check                 # schema + PII + trùng id@version + supersedes có khai chưa
npm run domain:index                 # dựng lại index sau khi thêm record
npm run system:check ; npm run system:index
npm run domain:check -- --stale      # TC đã execute TRƯỚC khi rule đổi ⇒ PHẢI chạy lại
npm run domain:trace-back            # case UPDATED/NEW có trỏ đúng id rule mới chưa
```

4. `--stale` trả về TC nào thì **ghi vào `change/regen/merge-summary.md` mục "TC cần rerun vì oracle đổi"**
   và chuyển sang nhánh `rerun` cho đúng những TC đó. Không im lặng bỏ qua: TC pass theo rule cũ mà rule đã
   đổi thì kết quả cũ **không còn giá trị**.
5. **Gate nội dung cho phần vừa merge** — Phase 1 bắt buộc qua, nhánh này trước đây không:

```powershell
npm run design:gate                                  # cột canonical, ô lõi rỗng, ui_catalog khi có case hiển thị
TASK_ENV=... npm run dim:coverage -- --enforce        # chiều required + NGƯỠNG theo risk band
TASK_ENV=... npm run tc:review:enforce                 # rubric 8 tiêu chí trên từng case NEW/UPDATED
```

   Vì sao cần: TC `NEW`/`UPDATED` ở đây đi **thẳng lên Sheet**. Không có gate nội dung thì case thiếu cột/rỗng
   ô lõi/không có oracle vẫn publish được — trong khi cùng loại case đó bị chặn ở Phase 1.

### Step 2b: Re-publish testcase lên Google Sheet (TC UPDATED + NEW)

Chỉ chạy khi testcase đã từng publish lên Sheet (có `GOOGLE_SHEET_URL` trong `profiles/<TASK_KEY>/task.env`) và `REPUBLISH_TESTCASES != 0`. Mục đích: đẩy phần thay đổi lên Sheet để Sheet khớp Excel và làm **nguồn execute**.

- Agent `mcp__claude_ai_Google_Drive__update_file` với `.xlsx` canonical đã merge (TC `UPDATED` + `NEW` đã approve nằm sẵn trong đó) — ghi đè toàn workbook, không cần dedup theo key riêng như công cụ test-management cũ vì không có khái niệm "tạo trùng".
- **Review nội dung `.xlsx` local trước khi ghi đè** — Drive MCP không "sửa 1 ô", ghi đè là ghi đè cả file.
- Precondition đi theo case (cột `Tiền điều kiện`), không cần flag riêng.
- Nếu testcase CHƯA từng publish lên Sheet → bỏ qua bước này (chạy `TESTCASE_SOURCE=excel`), hoặc publish lần đầu theo `.agent/workflows/phase1_04_auto_publish_backlog.md`.

### Step 3: Optional Cleanup — Unlink stale Test khỏi Story/Task (chạy SAU Step 2b re-publish)

> Sheet không có khái niệm case status/deprecate — case bị bỏ khỏi Excel tự động biến mất khỏi Sheet ngay ở Step 2b (ghi đè toàn workbook). Bước này CHỈ còn cần khi muốn unlink liên kết Test↔Story/Task trên Backlog, không liên quan tới TMS.

Chỉ chạy khi tất cả điều kiện đúng:

- Excel/testcase canonical đã merge theo Human Review approval.
- Testcase đã từng publish lên Sheet trước đó.
- QA/Human Review xác nhận muốn unlink.

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

**Nguồn execute:** sau Step 2b re-publish, agent `download_file_content` Sheet mới nhất về canonical local qua Drive MCP để execute (Sheet là bản đã ghi đè ở Step 2b, khớp Excel vừa merge):

→ execute từ `test-cases/from-sheet/*.xlsx` (chỉ chạy subset TC affected đã chọn). Nếu `TESTCASE_SOURCE=excel`: execute từ Excel local đã merge (chưa publish).

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
| `FAIL_PRODUCT_CANDIDATE` | Có khả năng bug product/API, cần triage theo Main Flow trước khi log Backlog. |
| `FAIL_TEST_SETUP` | Fail do setup/data/env/auth/automation. |
| `SKIP_BLOCKED` | Skip có lý do hợp lệ và không thể tránh ngay. |
| `NEED_REVIEW` | Expected/source vẫn chưa đủ rõ, không merge/execute tiếp. |

### Step 6b: Đồng bộ kết quả lên Google Sheet (khi `PUSH_EXECUTION=1`)

Sau khi phân loại, đồng bộ status cho **subset đã execute** — như các phase khác:

- Ghi `test-results[/runs/<RUN_ID>]/testcase-status.json` cho subset đã execute (status theo canonical trong `.agent/config/verdict_taxonomy.json`; bản ghi `FAIL` kèm step-level + evidence bước lỗi).
- Merge vào `.xlsx` local rồi ghi đè Sheet:

```powershell
node scripts/convert_excel/merge_execution_status.js <local .xlsx> test-results[/runs/<RUN_ID>]/testcase-status.json --only <selected TC_IDs>
```
→ agent soi lại file đã merge → `update_file` qua Drive MCP.

- **Chỉ gồm subset đã execute** (partial), không phải toàn bộ task — dùng `--only` để giới hạn.
- Cơ chế chung (status-map theo cột `sheet`, gate `output_gate`/`plan_guard`, filter `carriedOver`/non-verdict) **giống Phase 2 §13b** — xem `prompt_templates/run_phase2_template.md`, không lặp lại ở đây.

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

Không log Backlog trực tiếp trong Partial Rerun. Backlog chỉ được log sau khi user chuyển sang Main Flow bug triage và thỏa Backlog gate của Phase 2 chính.

## Hard Rules

- Không chạy nếu thiếu Human Review approval.
- Không merge testcase `NEED_REVIEW`.
- Không execute testcase `NEED_REVIEW`.
- Không đọc tài liệu nguồn để tự regenerate lại trong Phase 2.
- Không chạy full regression mặc định.
- Không log Backlog bug trực tiếp từ Partial Rerun này.
- Không unlink Test khỏi Story/Task trên Backlog nếu chưa có QA approval riêng.
- Re-publish (Step 2b) ghi đè **toàn workbook** đã merge TC UPDATED + NEW — review nội dung local trước khi `update_file`.
- Execute + đồng bộ execution chỉ cho **subset affected/UPDATED/NEW đã chọn**, không toàn bộ.
- Nếu có `FAIL_PRODUCT_CANDIDATE`, phải tạo `bug-candidates.md` thay vì log Backlog.
- Không sửa expected result sau approval nếu không có review lại.

## Final Response

Trả lời ngắn:

- Review file đã dùng.
- TC đã merge.
- Re-publish Sheet summary (link Sheet, có ghi đè hay không) nếu chạy Step 2b.
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


