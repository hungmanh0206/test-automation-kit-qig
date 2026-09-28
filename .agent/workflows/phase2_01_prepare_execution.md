# Phase 2 - Bước 1: Chuẩn Bị Execute

> Xác nhận scope, testcase, env và dữ liệu trước khi generate/chạy automation.

## Mục Đích

Tránh chạy nhầm task, nhầm story hoặc thiếu env khiến testcase bị fail/skip không đúng bản chất.

## Workflow

0. **PREFLIGHT (G1), chạy TRƯỚC MỌI thứ, là forcing gate.** `node scripts/qa/preflight_gate.js --mode phase2 --task <TASK_KEY>` → CHẶN nếu thiếu input bắt buộc (project_context, config JSON malformed) hoặc **testcase canonical local chưa có** (chưa tải Google Sheet / chưa có Excel). Chưa ĐẠT thì DỪNG, đọc rồi sửa input xong mới execute. Đừng chạy trên nền thiếu.
1. Echo lại:
   - `PROJECT_OUTPUT_DIR`
   - `TASK_KEY`
   - `TASK_OUTPUT_DIR`
   - `RUN_ID` nếu có
2. Nếu yêu cầu hiện tại không nêu rõ `TASK_KEY`, không dùng `TASK_KEY` từ `.env` hoặc context cũ để chạy; phải hỏi lại.
3. Đọc artifact local:
   - Nguồn execute: `<TASK_OUTPUT_DIR>/test-cases/from-sheet/*.xlsx`. Agent tải bản MỚI NHẤT từ Google Sheet qua Drive MCP ở Bước 0 (dùng `GOOGLE_SHEET_URL` trong `profiles/<TASK_KEY>/task.env`) TRƯỚC mỗi lượt execute.
   - `<TASK_OUTPUT_DIR>/test-cases/` Markdown chỉ dùng khi cần đọc chi tiết vượt ngoài cell `Tiền điều kiện` (cách dựng chi tiết nằm ở `### Setup Readiness` của `phase1-summary.md`).
   - `<TASK_OUTPUT_DIR>/reports/phase1-summary.md`, gồm `### Setup Readiness` và `### Precondition Execution Matrix`. Dùng để chọn case automatable, case cần hook, hay case blocked trước khi execute.
   - `<TASK_OUTPUT_DIR>/reports/capability-request.md` nếu có. Đó là danh sách capability gap; xem Capability gate ở Rules.
   - `<TASK_OUTPUT_DIR>/task.md`
4. Xác định testcase scope:
   - ALL
   - selected TC IDs
   - UI/API/E2E subset
   - **Thứ tự execute theo risk:** nếu có `<TASK_OUTPUT_DIR>/reports/risk-register.json` (skill `risk_scorer`), execute theo `executeOrder`, tức **module High risk trước** để bắt bug quan trọng sớm, rồi tới Medium và Low.
5. Kiểm tra runtime config:
   - App/API URL
   - credential/token local
   - browser/API dependency
6. Ghi blocker nếu thiếu input bắt buộc không thể tự suy ra.

## Rules

- Không sửa `.env` chung khi có session khác; truyền env theo command nếu cần.
- Không đọc lại toàn bộ requirement thô nếu Phase 1 summary đã đủ.
- **Phase 2 execute LUÔN tải bản Google Sheet mới nhất về trước** (`test-cases/from-sheet/*.xlsx`, qua Drive MCP) rồi execute từ file đó. KHÔNG gọi Drive hay Backlog cho từng case lúc execute. (Excel/Sheet là source of truth khi gen/publish.)
- Không chạy Phase 2 nếu không có testcase đã review.
- Resolve cách dựng precondition theo tag `[<method>]` của từng TC trong scope trước khi execute; thiếu capability thì ghi blocker, KHÔNG dựng bằng DB.
- Definition of Ready (DoR) trước khi execute mỗi TC: precondition rõ + setup method rõ + test data/fixture rõ + verification + cleanup + capability (API/hook/mock/sandbox/fixture) đã tồn tại. Thiếu bất kỳ điều nào → KHÔNG chạy bừa và KHÔNG connect DB: ghi `BLOCKED_SETUP` (capability/contract chưa đủ) hoặc `SKIP_SETUP` (`Manual-only`) kèm missing capability cụ thể.
- Capability gate (DoR cấp task trước Phase 2): nếu tồn tại `reports/capability-request.md` với item chưa `Resolved`/`Accepted`, các TC phụ thuộc capability đó KHÔNG được coi là runnable. Ghi `BLOCKED_SETUP` thay vì cố chạy. Mỗi blocker/SKIP phải gắn 1 Blocker Root Cause (`needs_hook`/`needs_account`/`needs_sandbox`/`spec_mismatch`/`manual_inherent`/`external_dependency` — xem skill `precondition_setup_planner`), KHÔNG gộp chung "backend state".

## Outputs

| Output | Vị trí |
|---|---|
| Execution scope | `task.md` hoặc execution summary draft |
| Blocker nếu có | `<TASK_OUTPUT_DIR>/reports/execution-summary.md` |
