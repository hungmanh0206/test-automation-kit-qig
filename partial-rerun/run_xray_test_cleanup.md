# Run Testcase Cleanup (AIO Tests)

> Đồng bộ **vòng đời** testcase trên TMS sau khi Partial Rerun đã merge testcase thay đổi được Human Review approve. Tên file giữ nguyên (`run_xray_test_cleanup.md`) cho tương thích ngược với các prompt đang trỏ tới, nhưng **đích đến là AIO Tests** từ GĐ5.

## Purpose

Dùng prompt này khi Excel source of truth đã thay đổi sau publish, thường sau `partial-rerun/run_requirement_apply_approved.md`.

Prompt này chỉ đồng bộ **lifecycle** của case theo Excel hiện tại. Nó không regenerate testcase, không execute, không log bug Jira và không xoá case.

> **Trên AIO, "cleanup" = đổi `caseStatus` sang `Deprecated`, KHÔNG phải xoá.** AIO không có API xoá case — nhưng `GET /config` có `caseStatuses`: Draft · Under Review · Published · **Deprecated**. Chuyển sang Deprecated thì **giữ được lịch sử run** (xoá là mất), mà người đọc vẫn thấy ngay case nào không còn hiệu lực. Hai chiều: TC rời Excel → Deprecated; TC quay lại Excel → trả về Published (tắt bằng `--no-restore`).

**Quan trọng — cleanup ≠ publish:** cleanup CHỈ đổi trạng thái case. Việc **tạo case mới + update case cũ (cả steps)** là do bước **re-publish** `npm run aio:publish:apply` (Step 2b của partial-rerun). Cleanup xong mà chưa re-publish thì case mới vẫn chưa có trên AIO — script sẽ in dòng `ⓘ … TC có trong Excel mà CHƯA có trên AIO`.

## When To Use

| Scenario | Use This Prompt |
|---|---|
| Excel đã bỏ bớt TC sau Partial Rerun Apply Approved | Yes |
| Excel restore TC từng bị Deprecated | Yes |
| Đã publish testcase lên AIO trước đó | Yes |
| Chỉ mới chạy Phase 1 lần đầu | No, chưa cần cleanup |
| Chưa có Human Review approval cho thay đổi testcase | No |
| Muốn xoá cứng case | No (AIO không có API xoá; xoá cũng làm mất lịch sử run) |

## Inputs

| Input | Required | Notes |
|---|---|---|
| `PROJECT_OUTPUT_DIR` | Yes | Ví dụ `outputs/<YOUR_PROJECT>`. |
| `TASK_KEY` | Yes | Task/feature scope. |
| `JIRA_STORY_KEY` | Yes | Story/Task parent như `SAPP-3255` — dùng để khoanh **phạm vi** case (`jiraRequirementIDs`). |
| Excel canonical | Yes | `--file <TASK_OUTPUT_DIR>/test-cases/<file>.xlsx` — nguồn quyết định TC nào còn active. |
| `HUMAN_REVIEW_STATUS` | Yes for apply | `APPROVED` hoặc `APPROVED_WITH_RISK`. |
| `APPROVED_REVIEW_FILE` | Recommended | Path tới `change/regen/review-checklist.md`. |
| `MODE` | Yes | `DRY_RUN` hoặc `APPLY`. |
| `AIO_API_TOKEN` | Yes for apply | Token AIO Tests. |

## Gate Before Apply

Chỉ apply thật nếu tất cả điều kiện đúng:

| Gate | Required Result |
|---|---|
| Excel source of truth đã update sau approved merge | Yes |
| Human Review approval rõ ràng | Yes |
| Đã từng publish testcase lên AIO trước đó | Yes |
| Dry-run cleanup đã được review | Yes |
| QA xác nhận apply cleanup | Yes |

Nếu thiếu bất kỳ gate nào, chỉ được chạy dry-run hoặc dừng.

## Workflow

### Step 0: Echo Scope

Trước khi đọc Excel hoặc gọi cleanup script, echo:

```text
PROJECT_OUTPUT_DIR=<value>
TASK_KEY=<value>
TASK_OUTPUT_DIR=<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>
Workflow=Partial Rerun - Testcase Cleanup (AIO)
MODE=<DRY_RUN|APPLY>
```

Nếu `TASK_KEY` không khớp yêu cầu user, dừng ngay.

### Step 1: Validate Artifacts

Kiểm tra:

- `<TASK_OUTPUT_DIR>/test-cases/*.xlsx`
- `<TASK_OUTPUT_DIR>/reports/aio-testcase-publish-summary.md` nếu đã publish
- `<TASK_OUTPUT_DIR>/change/regen/merge-summary.md` nếu cleanup đến từ partial rerun
- `APPROVED_REVIEW_FILE` nếu user cung cấp

Không sửa `.env` hoặc `.env.local` chung khi có session khác đang chạy.

### Step 2: Dry-run

Luôn chạy dry-run trước (mặc định — không ghi gì):

```powershell
npm run aio:deprecate-stale -- --story <JIRA_STORY_KEY> --file <TASK_OUTPUT_DIR>/test-cases/<file>.xlsx
# [--folder-root "<tên gốc>"] nếu muốn khoanh phạm vi theo cây folder thay vì story
# [--no-restore] nếu KHÔNG muốn tự trả case về Published khi TC quay lại Excel
```

Review output:

| Dòng | Nghĩa |
|---|---|
| `→ chuyển Deprecated : n` | Case đã publish nhưng TC ID không còn trong Excel. |
| `→ trả về Published : n` | Case đang Deprecated có TC ID quay lại Excel. |
| `ⓘ n TC có trong Excel mà CHƯA có trên AIO` | Thiếu publish — chạy `npm run aio:publish:apply`, không phải việc của cleanup. |
| `Không có gì phải đổi.` | Excel và AIO đã khớp. |

### Step 3: Apply Approved

Chỉ chạy apply khi QA/Human Review xác nhận:

```powershell
npm run aio:deprecate-stale:apply -- --story <JIRA_STORY_KEY> --file <...>.xlsx
```

Script tự **đối soát sau khi ghi** (`ĐỐI SOÁT: n/n case đã sang Deprecated`) — nếu còn sót thì báo, đừng bỏ qua dòng đó.

## Lifecycle Rules

- Excel là source of truth cho testcase active **khi cleanup** (quyết định TC nào còn/không còn active).
- Ở context cleanup, AIO là mirror của Excel; ở context **execute** (Phase 2 / partial execute), AIO là **nguồn** — hai context khác nhau, không mâu thuẫn.
- Không xoá case (không có API, và xoá là mất lịch sử run). Trạng thái `Deprecated` là cách duy nhất được dùng.
- TC quay lại Excel → trả về `Published`; muốn giữ nguyên Deprecated thì `--no-restore`.
- Phạm vi phải khoanh theo `--story` hoặc `--folder-root` — không quét toàn project, để không đụng case của story khác.
- Enum trạng thái lấy từ `GET /config` của chính AIO, không hardcode.
- Không log Jira bug từ partial rerun.

## Outputs

| Output | Location |
|---|---|
| Cleanup summary (agent tự ghi) | `<TASK_OUTPUT_DIR>/reports/aio-deprecate-summary.md` |
| Task tracking update | `<TASK_OUTPUT_DIR>/task.md` |

## Final Response

Trả lời ngắn:

- Mode đã chạy.
- Tổng case đã scan trong phạm vi story/folder.
- Planned/Applied deprecate, restore + kết quả đối soát.
- Số TC còn thiếu trên AIO (nếu có) → nhắc re-publish.
- Đường dẫn cleanup summary.
- Blocker nếu có.

## Example

```text
Đọc partial-rerun/run_xray_test_cleanup.md và chạy:
PROJECT_OUTPUT_DIR=outputs/<YOUR_PROJECT>
TASK_KEY=<TASK_KEY>
JIRA_STORY_KEY=<JIRA_STORY_KEY>
HUMAN_REVIEW_STATUS=APPROVED
MODE=DRY_RUN
```

## Đường Xray (LEGACY)

Xray đóng băng sau **21/08/2026**. Bản cũ gắn/gỡ label stale (`deprecated,out-of-scope,stale-from-excel`) trên Xray Test:

```powershell
npm run jira:testcase-cleanup:dry-run -- --project-output <PROJECT_OUTPUT_DIR> --task <TASK_KEY> --story <JIRA_STORY_KEY> --test-management-tool xray
```

Lệnh này tự chặn khi `TEST_MANAGEMENT_TOOL=aio`. Chi tiết (label set, `--unlink` stale khỏi Story/Task) nằm trong header `scripts/integrations/jira/cleanup_xray_tests.js`; **đừng phát triển thêm ở nhánh này**.
