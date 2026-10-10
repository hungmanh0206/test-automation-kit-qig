# Skills Index (SINH TỰ ĐỘNG — đừng sửa tay)

> Sinh bởi `node scripts/qa/skills_index.js --write`. Skill của kit nằm ở `.agent/skills/**` — KHÔNG phải
> `.claude/skills/`, nên harness không tự phát hiện. Bảng này là cách agent biết skill nào có và nằm ở đâu.

| Skill | Nhóm | File | Dùng khi |
|---|---|---|---|
| `combinatorial_matrix` | phase1 | `.agent/skills/phase1/combinatorial_matrix/SKILL.md` | Sinh ma trận tổ hợp (Pairwise mặc định) từ các chiều (dimensions) + values + constraints, map expected cho từng bộ. Chống nổ case — KHÔNG full Cartesian mặc định. Dùng cho cross-module/nhiều biến kết hợp. |
| `git_impact_analyzer` | phase1 | `.agent/skills/phase1/git_impact_analyzer/SKILL.md` | Đọc git diff của branch/PR gắn TASK_KEY, liệt kê file/module thay đổi và phân loại vào 7 bề mặt dùng chung của mục 17 — cấp dữ liệu diff thật làm input cho Bước 1 mục 17 thay vì đọc code đoán. Suggest-only. |
| `requirements_analyzer` | phase1 | `.agent/skills/phase1/requirements_analyzer/SKILL.md` | Phân tích requirement/UI/API artifact để tạo scope, business rule và coverage input cho Phase 1. |
| `risk_scorer` | phase1 | `.agent/skills/phase1/risk_scorer/SKILL.md` | Risk-Based Testing có thực thi — chấm Risk = Likelihood × Impact per module từ knowledge/ + config, sinh risk-register (Suggest-only), và gate depth theo band (default cảnh báo, --enforce chặn). QA override band. |
| `tc_reviewer` | phase1 | `.agent/skills/phase1/tc_reviewer/SKILL.md` | Chấm chất lượng bộ testcase theo rubric 8 tiêu chí (0-2 điểm mỗi tiêu chí) — máy chấm 6, người chấm 2. Dùng trước khi publish, hoặc khi nhận bàn giao một bộ TC không phải mình viết. |
| `tc_validator` | phase1 | `.agent/skills/phase1/tc_validator/SKILL.md` | Validate testcase Phase 1 theo template 10 cột, coverage/risk gate và khả năng execute automation. |
| `flaky_test_analyzer` | phase2 | `.agent/skills/phase2/flaky_test_analyzer/SKILL.md` | Phân tích testcase Playwright flaky và đề xuất/sửa root cause trong phạm vi an toàn. |
| `lighthouse_check` | phase2 | `.agent/skills/phase2/lighthouse_check/SKILL.md` | Điểm Lighthouse thật (Performance/Accessibility/SEO/Best-practices) chạy qua CDP bằng playwright-lighthouse; verdict advisory theo dải điểm chuẩn. Opt-in nặng (skip nếu chưa cài), never-auto + non-prod, evidence PNG bảng điểm. |
| `load_check` | phase2 | `.agent/skills/phase2/load_check/SKILL.md` | Chạy load/stress/soak (Loại B, nhiều VU) qua k6 — wrapper mỏng, parse summary → report. k6 là binary NGOÀI (không phải npm dep). Never-auto, chỉ non-prod, cap khiêm tốn. Loại A single-user dùng perf_check. |
| `locator_healing_agent` | phase2 | `.agent/skills/phase2/locator_healing_agent/SKILL.md` | Khi locator ACTION fail lúc execute, thử fallback chain và tự áp dụng nếu confidence cao (accessible name exact + role + vùng DOM); ghi lịch sử vào knowledge/locators/. KHÔNG heal locator assertion. Threshold-gated, opt-in LOCATOR_HEAL=1. |
| `perf_check` | phase2 | `.agent/skills/phase2/perf_check/SKILL.md` | Đo performance thật (web vitals + API SLA + large-dataset + resource weight) qua Playwright, so ngưỡng catalog → verdict advisory. Median N lần chống flaky. Threshold-gated, không thêm dependency. |
| `qa_automation_engineer` | phase2 | `.agent/skills/phase2/qa_automation_engineer/SKILL.md` | Generate, update và execute Playwright UI/API automation cho Phase 2. |
| `security_check` | phase2 | `.agent/skills/phase2/security_check/SKILL.md` | Kiểm security BASIC non-destructive (headers/cookie, unauth, authz/IDOR 2 tài khoản, exposure) qua GET read-only trên UAT. Control → PASS/FAIL; exposure → finding (mask PII). Never-auto, cần xác nhận non-prod. |
| `ui_debug_agent` | phase2 | `.agent/skills/phase2/ui_debug_agent/SKILL.md` | Khám phá DOM thật của một màn để tìm locator bền và neo nhãn UI ↔ cột DB — dùng khi màn mới, khi locator vỡ, hoặc khi debug script_error. |
| `backlog_bug_reporter` | shared | `.agent/skills/shared/backlog_bug_reporter/SKILL.md` | Log Backlog sub-bug từ testcase FAIL đã xác nhận sau Phase 2. |
| `backlog_integration` | shared | `.agent/skills/shared/backlog_integration/SKILL.md` | Fetch/read Backlog và source liên quan khi workflow yêu cầu context từ Backlog/Figma. (tài liệu nguồn tạm ngoài phạm vi — chờ chuyển sang Google Docs/Sheet.) |
| `backlog_testcase_publisher` | shared | `.agent/skills/shared/backlog_testcase_publisher/SKILL.md` | Publish testcase từ Excel canonical lên **Google Sheet** sau Phase 1 (qua Drive MCP: search_files/create_file/update_file). |
| `decision_recorder` | shared | `.agent/skills/shared/decision_recorder/SKILL.md` | Ghi LÝ DO của quyết định QA đã chốt vào knowledge/decisions/ (false positive, by design, override risk, PASS-kèm-note, cách test) và TRA CỨU nó trước khi log bug, để không kết luận lại từ đầu và không log lại bug đã bị Rejected. |
| `domain_recorder` | shared | `.agent/skills/shared/domain_recorder/SKILL.md` | Ghi business rule ĐÃ ĐƯỢC XÁC NHẬN vào knowledge/domain/ (versioned, có source + examples cụ thể, trace covered_by) để oracle của testcase luôn trích được nguồn thay vì suy từ app. |
| `learning_recorder` | shared | `.agent/skills/shared/learning_recorder/SKILL.md` | Ghi fact đã qua gate (bug đã confirm, root cause, snapshot pass/fail) vào knowledge/ để tái dùng xuyên task. Suggest-only — chỉ lưu dữ liệu, không tự kết luận risk/PASS-FAIL. |
| `precondition_setup_planner` | shared | `.agent/skills/shared/precondition_setup_planner/SKILL.md` | Phân loại tiền điều kiện, chọn setup method (factory/hook/fixture/mock), ghi verification + cleanup, đánh dấu readiness/blocker và Definition of Ready cho Setup Strategy contract. |
| `release_summary` | shared | `.agent/skills/shared/release_summary/SKILL.md` | Gộp kết quả nhiều lượt chạy của MỘT MỐC (release/sprint/UAT) thành khuyến nghị go/no-go có căn cứ, đối chiếu với tiêu chí exit đã chốt TRƯỚC khi xem kết quả. Dùng khi sắp bàn giao một mốc và cần nói với PM "có nên release không". KHÔNG dùng cho một lượt chạy đơn lẻ (dùng results:summary) hay để kiểm bản đóng gói (dùng release:verify). |
| `system_mapper` | shared | `.agent/skills/shared/system_mapper/SKILL.md` | Ghi bản đồ HỆ THỐNG đã xác nhận vào knowledge/system/ (state machine · ma trận phân quyền · surface dùng chung) để trả lời được "hành vi này là bug hay đúng thiết kế" và "sửa chỗ này phải regression đâu" mà không suy từ app. |
| `test_data_generator` | shared | `.agent/skills/shared/test_data_generator/SKILL.md` | Sinh test data cụ thể, unique, traceable và rollback được cho Phase 1/Phase 2. |

> 24 skill. Thiếu description: 0.
