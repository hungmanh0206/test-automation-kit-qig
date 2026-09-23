# Run Testcase Cleanup (Google Sheet)

> Tên file giữ nguyên (`run_testcase_cleanup.md`) cho tương thích ngược với các prompt đang trỏ tới. Đích đến trước là AIO Tests (vòng đời `caseStatus`), giờ là **Google Sheet** — mô hình cleanup đã đổi hẳn, không còn khái niệm "deprecate case".

## Purpose

Trên AIO Tests trước đây, "cleanup" nghĩa là đổi `caseStatus` case bị bỏ khỏi Excel sang `Deprecated` (không có API xoá). **Trên Google Sheet, việc này không còn cần thiết**: mỗi lần re-publish (`update_file` qua Drive MCP) là ghi đè **toàn bộ workbook** theo đúng Excel canonical hiện tại — case nào không còn trong Excel thì tự động không còn trong Sheet ở lần ghi đè kế tiếp, không cần bước trung gian nào.

**Vì vậy: sau khi merge testcase đã approve (`partial-rerun/run_requirement_apply_approved.md` Step 2b), chỉ cần re-publish là đủ — không cần chạy prompt này để "dọn" case cũ.**

## Khi nào vẫn cần prompt này

Chỉ còn một việc còn lại chưa tự động theo Sheet: **unlink liên kết Test ↔ Story/Task trên Backlog** (nếu kit từng ghi liên kết đó khi publish) khi case bị bỏ khỏi Excel. Đây là thao tác optional, chỉ làm khi QA yêu cầu rõ.

| Scenario | Use This Prompt |
|---|---|
| Excel đã bỏ bớt TC sau Partial Rerun Apply Approved | Không cần — re-publish Sheet (Step 2b) đã tự đủ. |
| Cần unlink Test khỏi Story/Task trên Backlog cho TC đã bỏ | Yes, nếu QA yêu cầu rõ. |
| Chưa có Human Review approval cho thay đổi testcase | No |
| Muốn "xoá" testcase khỏi Sheet | Không cần thao tác riêng — ghi đè Excel rồi re-publish là đủ. |

## Workflow (khi QA yêu cầu unlink)

### Step 0: Echo Scope

```text
PROJECT_OUTPUT_DIR=<value>
TASK_KEY=<value>
TASK_OUTPUT_DIR=<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>
Workflow=Partial Rerun - Testcase Cleanup (Google Sheet)
```

Nếu `TASK_KEY` không khớp yêu cầu user, dừng ngay.

### Step 1: Validate Artifacts

Kiểm tra:

- `<TASK_OUTPUT_DIR>/test-cases/*.xlsx` (Excel canonical hiện tại)
- `GOOGLE_SHEET_URL` trong `profiles/<TASK_KEY>/task.env` (đã publish trước đó chưa)
- `<TASK_OUTPUT_DIR>/change/regen/merge-summary.md` nếu cleanup đến từ partial rerun (danh sách TC bị bỏ)

### Step 2: Xác nhận Sheet đã đúng Excel

- So `GOOGLE_SHEET_URL` (`search_files`/`read_file_content` qua Drive MCP) với Excel canonical hiện tại — nếu chưa re-publish, làm Step 2b của `run_requirement_apply_approved.md` trước.
- Case bị bỏ khỏi Excel mà vẫn còn trên Sheet ⇒ chưa re-publish, không phải lỗi cleanup.

### Step 3: Unlink (nếu QA yêu cầu)

Ghi rõ trong report: TC ID nào bị bỏ, có liên kết Story/Task nào cần unlink trên Backlog, và xác nhận QA đã yêu cầu — đây là thao tác thủ công trên Backlog, không có script tự động đi kèm kit.

## Rules

- Excel là source of truth cho testcase active — Sheet chỉ phản chiếu đúng Excel sau mỗi lần re-publish.
- Không "xoá" gì trên Sheet theo nghĩa API riêng — ghi đè toàn workbook là cơ chế duy nhất.
- Không log Backlog bug từ partial rerun.

## Outputs

| Output | Location |
|---|---|
| Cleanup summary (agent tự ghi, nếu có unlink) | `<TASK_OUTPUT_DIR>/reports/aio-deprecate-summary.md` |
| Task tracking update | `<TASK_OUTPUT_DIR>/task.md` |

## Final Response

Trả lời ngắn:

- Sheet đã khớp Excel canonical hay chưa (đã re-publish chưa).
- Unlink Backlog đã làm (nếu có) hoặc xác nhận không cần.
- Đường dẫn cleanup summary nếu có.
- Blocker nếu có.
