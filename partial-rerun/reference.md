# Partial Rerun Reference

> Tài liệu tham chiếu duy nhất cho nhánh phụ xử lý thay đổi nội dung requirement/design/API.

## Mục đích

`partial-rerun` là nhánh phụ độc lập. Chỉ dùng khi tài liệu nguồn đã đổi nội dung sau khi đã có testcase hoặc execution result.

Nhánh này không thuộc Main Flow, không tự chạy, không block Phase 1/Phase 2/Re-run và có thể xóa mà Main Flow vẫn hoạt động.

## Khi nào dùng

| Tình huống | Hành động |
|---|---|
| Jira/Confluence/Figma/Swagger đổi nội dung nhưng link/path giữ nguyên | Chạy `run_requirement_prepare_review.md`. |
| Đã có Human Review approve testcase thay đổi | Chạy `run_requirement_apply_approved.md`. |
| Đã merge Excel/testcase thay đổi và cần đồng bộ lại Google Sheet | Re-publish Sheet (`update_file` qua Drive MCP) — không cần bước cleanup riêng, lần ghi đè kế tiếp tự phản ánh đúng Excel. `run_testcase_cleanup.md` giờ chỉ còn cần khi muốn unlink stale Test khỏi Story/Task (optional). |
| Chưa có testcase baseline | Chạy Phase 1 chính, không dùng partial rerun. |
| Dev fix bug đã log | Dùng Re-run chính, không dùng partial rerun. |
| Cần log Jira bug | Chuyển về Phase 2/Main Flow bug triage, không log trực tiếp từ partial rerun. |

## Luồng chuẩn

```text
Tài liệu nguồn đổi nội dung
↓
Prepare Review
↓
Diff + Impact + Draft testcase
↓
Human Review
↓
Apply Approved
↓
Merge testcase đã approve
↓
Re-publish Google Sheet (update_file qua Drive MCP — ghi đè toàn workbook)
↓
Optional Cleanup — unlink stale Test khỏi Story/Task (nếu QA yêu cầu)
↓
Tải lại từ Sheet → Partial Execute subset
↓
Đồng bộ execution status lên Sheet (subset)
↓
PASS hoặc bug candidate handoff về Main Flow
```

## Phase con 1: Prepare Review

Entry point:

```text
partial-rerun/run_requirement_prepare_review.md
```

Mục tiêu:

- So sánh nội dung mới với snapshot/baseline cũ của cùng link/path.
- Tạo diff theo requirement/API/design/data section.
- Mapping diff tới requirement, business rule, API/UI/data behavior và TC ID.
- Phân loại risk: `Critical`, `High`, `Medium`, `Low`.
- Gán lifecycle: `ACTIVE`, `UPDATED`, `DEPRECATED`, `NEW`, `NEED_REVIEW`.
- Sinh testcase draft cho `UPDATED` và `NEW`.
- Tách testcase `DEPRECATED` riêng.
- Tạo `review-checklist.md`.
- Dừng tại `WAITING_FOR_HUMAN_REVIEW`.

Output chính:

```text
<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/change/
├── snapshots/
├── diffs/
├── impact/
└── regen/
```

## Phase con 2: Apply Approved

Entry point:

```text
partial-rerun/run_requirement_apply_approved.md
```

Mục tiêu:

- Chỉ chạy khi có Human Review approve.
- Merge testcase theo lifecycle đã approve.
- Export/update Excel nếu testcase chính thay đổi.
- **Re-publish Google Sheet**: Excel canonical đã merge TC `UPDATED` + `NEW` → agent `update_file` qua Drive MCP ghi đè toàn workbook (không cần dedup theo key riêng, không có khái niệm folder).
- Chọn subset execute: testcase `NEW`, `UPDATED`, và testcase bị ảnh hưởng. Execute từ bản Sheet mới nhất (tải lại qua Drive MCP về canonical local).
- Không chạy full regression mặc định.
- Execute thật subset đã chọn.
- **Đồng bộ execution status lên Sheet** cho subset đã execute (`merge_execution_status.js` rồi `update_file`, như các phase khác).
- Tạo bug candidate package nếu có fail nghi product bug.
- Không log Jira trực tiếp.

Output chính:

```text
<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/change/
├── regen/merge-summary.md
└── partial-execution/
    ├── selected-tc-list.txt
    ├── execution-summary.md
    ├── bug-candidates.md
    └── artifacts/
<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/reports/jira-testcase-publish-summary.md (re-publish Step 2b — agent tự ghi sau update_file)
<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/reports/aio-execution-summary.md (execution sync — Step 6b)
<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/reports/jira-testcase-cleanup-summary.md (nếu chạy cleanup unlink)
```

## Lifecycle testcase

| Lifecycle | Ý nghĩa | Merge sau approve |
|---|---|---|
| `ACTIVE` | Testcase không bị ảnh hưởng | Giữ nguyên. |
| `UPDATED` | Testcase cần sửa theo thay đổi mới | Replace theo TC ID. |
| `DEPRECATED` | Testcase không còn hợp lệ | Chuyển sang deprecated/archive section. |
| `NEW` | Behavior mới cần testcase mới | Append vào testcase chính. |
| `NEED_REVIEW` | Chưa đủ rõ hoặc còn blocker | Không merge, không execute. |

## Quy tắc merge

- Không replace testcase chính trong Phase 1 Prepare Review.
- Không tự động merge nếu chưa có Human Review.
- Không merge item `REJECTED` hoặc `NEED_CLARIFICATION`.
- Không đổi expected result sau approval nếu chưa review lại.
- Giữ audit trail: source link/path, change reason, TC ID, reviewer decision.

## Quy tắc execute

- Sau merge + re-publish, chỉ partial execute subset bị ảnh hưởng.
- Nguồn execute: tải Google Sheet mới nhất về canonical local (`from-sheet/*.xlsx`) qua Drive MCP rồi execute subset; `excel` local nếu chưa publish.
- Execute xong, đồng bộ status subset lên Sheet (`merge_execution_status.js` → `update_file`, `PUSH_EXECUTION=1`).
- Không chạy full regression mặc định.
- Full regression chỉ khi business flow/API contract/UI shared thay đổi diện rộng hoặc QA Lead yêu cầu.
- Với `RUN_ID`, output execute nằm dưới:

```text
<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-results/runs/<RUN_ID>/
<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/reports/runs/<RUN_ID>/
```

## Cleanup (Deprecate) trong partial rerun

Nếu testcase baseline đã từng publish lên Google Sheet và Apply Approved làm Excel thay đổi:

- **Re-publish (Step 2b) chạy TRƯỚC bất kỳ cleanup nào** — `update_file` ghi đè toàn workbook nên TC mới/update đã có trong lần ghi đè đó; case bị bỏ khỏi Excel cũng tự động biến mất khỏi Sheet ngay lần ghi đè này, không cần bước "deprecate" riêng như AIO cũ.
- Chạy `partial-rerun/run_testcase_cleanup.md` chỉ khi còn việc unlink Test khỏi Story/Task trên Backlog — không còn việc đổi trạng thái case trên TMS (Sheet không có `caseStatus`).
- Không có khái niệm xoá/deprecate case trên Sheet — Excel canonical luôn là nguồn, Sheet chỉ phản chiếu đúng Excel sau mỗi lần re-publish.
- Unlink stale Test khỏi Story/Task là optional, chỉ bật khi QA yêu cầu.
- Excel vẫn là source of truth khi cleanup; Sheet là bản đồng bộ hiển thị.

## Bug candidate handoff

Nếu partial execute phát hiện fail nghi product bug:

- Tạo `change/partial-execution/bug-candidates.md`.
- Ghi TC ID, expected, actual, evidence, rerun count và nguyên nhân đã loại trừ.
- Không log Jira trong partial rerun.
- User/QA chuyển sang Main Flow Phase 2 bug triage nếu muốn log Jira.

## Snapshot schema tối thiểu

`change/snapshots/snapshot_context.json` nên có:

```json
{
  "project_output_dir": "outputs/<YOUR_PROJECT>",
  "task_key": "<TASK_KEY>",
  "sources": [
    {
      "source_id": "confluence-xxx",
      "type": "confluence|jira|figma|swagger|file",
      "url_or_path": "<same-source-link-or-path>",
      "content_hash_before": "<hash>",
      "content_hash_after": "<hash>",
      "last_checked_at": "YYYY-MM-DDTHH:mm:ssZ"
    }
  ],
  "testcases": [
    {
      "tc_id": "<TC_ID>",
      "source_ids": ["confluence-xxx"],
      "lifecycle": "ACTIVE|UPDATED|DEPRECATED|NEW|NEED_REVIEW",
      "risk": "Critical|High|Medium|Low"
    }
  ]
}
```

## Hard Rules

- Không gọi partial-rerun từ Main Flow.
- Không thêm dependency từ Phase 1/Phase 2/Re-run sang partial-rerun.
- Không tự động trigger khi chạy Phase 1/Phase 2.
- Không block Main Flow nếu partial-rerun thiếu file hoặc bị xóa.
- Không log Jira trực tiếp từ partial-rerun.
- Không dùng partial-rerun cho Dev fix bug; dùng Re-run chính.
