# Danh mục GATE của kit

> **SINH TỰ ĐỘNG** bởi `node scripts/qa/gate_index.js --write`. Đừng sửa tay — `--check` sẽ chặn khi
> bảng lệch source. Cột **Mức** suy từ code: `exit 1` = CHẶN · ghi artifact = SINH · chỉ in = BÁO CÁO.

Tổng **76** máy — **52 CHẶN** · 16 SINH (ghi artifact) · 8 BÁO CÁO (chỉ in).

SINH/BÁO CÁO **không phải gate bị nới** — chúng không kiểm vi phạm. Ví dụ `bugs:checklist` in brief bug
lịch sử, còn việc CHẶN nằm ở `dim:coverage` (chiều `bug_history` §20).

| Mức | npm script | Chặn/kiểm cái gì | File | Gọi từ |
|---|---|---|---|---|
| CHẶN | `library:build` | ghép src/ thành docs/library/index.html (một file duy nhất, self-contained). | `docs/library/build.js` | README.md |
| CHẶN | `merge:execution-status` | ghi kết quả execute (testcase-status.json) NGƯỢC vào cột `Result` của file | `scripts/convert_excel/merge_execution_status.js` | RULE_GLOBAL.md |
| CHẶN | `backlog:bug-report`, `backlog:bug-report:dry-run` | Create Backlog Sub-bug issues for failed Playwright test cases. | `scripts/integrations/backlog/bug_reporter.js` | README.md · .github/workflows · .agent/skills · prompt_templates |
| CHẶN | `integration:check`, `integration:check:live` | const axios = require('axios'); | `scripts/integrations/backlog/check_connection.js` | .gitlab-ci.yml · README.md · USER_GUIDE.md · QUICKSTART.md · .github/workflows · tests/fe/infra |
| CHẶN | `gdoc:read` | Đọc nội dung từ Google Docs | `scripts/integrations/google_doc/doc_reader.js` | prompt_templates |
| CHẶN | `audit:ci` | npm audit cho CI, phân biệt rõ 2 tình huống: | `scripts/qa/audit_ci.js` | .gitlab-ci.yml · README.md · .github/workflows |
| CHẶN | `bug:claim`, `bug:claim:new`, `bug:claim:report` | một phát hiện bug phải QUA MÁY trước khi được nói thành lời. | `scripts/qa/bug_claim.js` | RULE_GLOBAL.md · .agent/workflows · prompt_templates · tests/fe/infra |
| CHẶN | `ci:scope` | MÁY ĐỨNG SAU LUẬT "CI generic KHÔNG tự chạm UAT". | `scripts/qa/ci_scope_check.js` | .gitlab-ci.yml · QUICKSTART.md · .github/workflows · tests/fe/infra |
| CHẶN | `course:maturity`, `course:maturity:check` | sinh khối "Bộ kit của bạn đang ở đâu" cho từng bài giảng. | `scripts/qa/course_maturity.js` | .gitlab-ci.yml · .github/workflows |
| CHẶN | `course:numbers` | CHẶN "ví dụ trong bài giảng không khớp sản phẩm thực hành". | `scripts/qa/course_numbers.js` | .gitlab-ci.yml · .github/workflows |
| CHẶN | `design:gate` | round-3) — Gate CHẤT LƯỢNG THIẾT KẾ testcase (Phase 1), THỰC THI. | `scripts/qa/design_gate.js` | README.md · USER_GUIDE.md · scripts/qa/README.md · .agent/workflows · prompt_templates · partial-rerun · .claude/commands · tests/fe/infra |
| CHẶN | `expansion:audit` | ĐO ĐỘ PHỦ 5 TRỤC trên MỌI task đã execute, để quyết định siết gate bằng SỐ. | `scripts/qa/expansion_audit.js` | RULE_GLOBAL.md · .claude/commands |
| CHẶN | `json:check` | kiểm MỌI file .json ĐANG ĐƯỢC TRACK có parse được không. | `scripts/qa/json_check.js` | .gitlab-ci.yml · .github/workflows |
| CHẶN | `leak:report` | đo "kit đang rò bao nhiêu và rò kiểu gì" (baseline cho mọi cải tiến sau). | `scripts/qa/leak_report.js` | RULE_GLOBAL.md · README.md · .agent/workflows · .agent/rules · prompt_templates · tests/fe/infra |
| CHẶN | `learn:bugs`, `learn:bugs:apply` | nối mắt xích còn ĐỨT: bug đã log Backlog → knowledge/bugs/ (+ root_causes ref, index). | `scripts/qa/learn_bugs.js` | README.md · USER_GUIDE.md · QUICKSTART.md · scripts/qa/README.md · .agent/workflows · prompt_templates |
| CHẶN | `library:drift` | CHẶN "thư viện thuật ngữ đã trôi khỏi repo". | `scripts/qa/library_drift.js` | .gitlab-ci.yml · README.md · .github/workflows |
| CHẶN | `gate:output`, `gate:output:fix`, `gate:gen-testcase` | Gate chất lượng output THỰC THI, tự chạy trước khi push Backlog/Sheet. | `scripts/qa/output_gate.js` | RULE_GLOBAL.md · README.md · scripts/qa/README.md · .agent/workflows · .agent/rules · prompt_templates · .claude/commands |
| CHẶN | `package:kit` | đóng gói bản phát hành SẠCH của kit vào `dist/`. | `scripts/qa/package_kit.js` | README.md · .github/workflows · tests/fe/infra |
| CHẶN | `gate:policy` | giữ 1 NGUỒN policy duy nhất: RULE_GLOBAL.md là canonical. | `scripts/qa/policy_source_check.js` | .gitlab-ci.yml · RULE_GLOBAL.md · README.md · USER_GUIDE.md · .github/workflows · .agent/rules · prompt_templates · .claude/commands · tests/fe/infra |
| CHẶN | `preflight`, `preflight:lanes` | round-3) — CHẶN "miss đọc file / input hỏng" TRƯỚC khi workflow chạy. | `scripts/qa/preflight_gate.js` | .gitlab-ci.yml · README.md · USER_GUIDE.md · QUICKSTART.md · scripts/qa/README.md · .github/workflows · .agent/workflows · prompt_templates · .claude/commands · tests/fe/infra |
| CHẶN | `rule`, `rule:toc` | tra RULE_GLOBAL.md THEO MỤC, thay vì đọc cả file. | `scripts/qa/rule_lookup.js` | .gitlab-ci.yml · RULE_GLOBAL.md · CLAUDE.md · README.md · USER_GUIDE.md · scripts/qa/README.md · .github/workflows · .agent/workflows · .agent/rules · .agent/skills · prompt_templates · exploratory · partial-rerun · .claude/commands · tests/fe/infra |
| CHẶN | `secret:scan` | quet secret bi commit nham tren cac file DA TRACK trong git. | `scripts/qa/secret_scan.js` | .gitlab-ci.yml · RULE_GLOBAL.md · README.md · .github/workflows · tests/fe/infra |
| CHẶN | `seed:knowledge`, `seed:knowledge:apply` | Seed Knowledge từ lịch sử Backlog (Suggest-only, DRY-RUN mặc định). | `scripts/qa/seed_knowledge_from_backlog.js` | README.md · scripts/qa/README.md |
| CHẶN | `skills:index`, `skills:index:check` | sinh bảng tra skill từ frontmatter của `.agent/skills/**\/SKILL.md`. | `scripts/qa/skills_index.js` | .gitlab-ci.yml · README.md · .github/workflows |
| CHẶN | `trace:matrix` | sinh ma trận REQ → TC → AUTO → EXEC → BUG dạng artifact. | `scripts/qa/traceability_matrix.js` | README.md · .agent/workflows · prompt_templates |
| CHẶN | `ui:conformance` | "visual oracle" tự động. | `scripts/qa/ui_conformance_check.js` | prompt_templates |
| CHẶN | `release:verify` | CHỨNG MINH bản phát hành chạy được từ con số 0. Đây là thước đo chính của cả luồng CD, | `scripts/qa/verify_release.js` | README.md · .github/workflows · tests/fe/infra |
| CHẶN | `version:check` | CHẶN phát hành thiếu sót. | `scripts/qa/version_check.js` | README.md · .github/workflows · tests/fe/infra |
| CHẶN | `writing:lint`, `writing:lint:docs` | output phải đọc như QA viết, không như máy viết. | `scripts/qa/writing_lint.js` | RULE_GLOBAL.md · tests/fe/infra |
| CHẶN | `profile:create` | Tạo profile task từ template: profiles/task.env.example -> profiles/<TASK_KEY>/task.env | `scripts/utils/create_profile.js` | RULE_GLOBAL.md · README.md · USER_GUIDE.md |
| CHẶN | `user-guide:images` | User Guide board renderer (HTML/CSS + Playwright) | `scripts/utils/generate_user_guide_images.mjs` | README.md · tests/fe/infra |
| CHẶN | `test:task`, `test:task:fe`, `test:task:api` | const { spawn } = require('child_process'); | `scripts/utils/run_playwright_task.js` | README.md · USER_GUIDE.md · QUICKSTART.md · prompt_templates |
| CHẶN | `sync:gitlab` | đẩy `main` sang nhánh GitLab, TRỪ những đường dẫn khai trong | `scripts/utils/sync_gitlab.js` | tests/fe/infra |
| CHẶN (có cờ --enforce) | `xsurf:diff` | TRỤC 2: **cùng một giá trị, khác nơi hiển thị**. | `scripts/qa/cross_surface_diff.js` | RULE_GLOBAL.md · README.md · .agent/rules · prompt_templates |
| CHẶN (có cờ --enforce) | `decisions:check`, `decisions:index` | quản lý `knowledge/decisions/`: LÝ DO của những quyết định QA đã chốt. | `scripts/qa/decisions.js` | README.md · USER_GUIDE.md · .agent/workflows · .agent/skills · prompt_templates |
| CHẶN (có cờ --enforce) | `dim:coverage` | đếm case theo 15 CHIỀU coverage của `prompt_templates/phase1/02_gen_testcases.md` | `scripts/qa/dimension_coverage.js` | RULE_GLOBAL.md · README.md · USER_GUIDE.md · QUICKSTART.md · .agent/workflows · .agent/rules · prompt_templates · partial-rerun · .claude/commands · tests/fe/infra |
| CHẶN (có cờ --enforce) | `domain:check`, `domain:index`, `domain:trace-back` | quản lý `knowledge/domain/` (business rule đã XÁC NHẬN = nền của oracle). | `scripts/qa/domain_rules.js` | RULE_GLOBAL.md · README.md · USER_GUIDE.md · QUICKSTART.md · .agent/workflows · .agent/rules · .agent/skills · prompt_templates · partial-rerun · tests/fe/infra |
| CHẶN (có cờ --enforce) | `expansion:plan` | QUYẾT TRƯỚC KHI CHẠY: case nào mở rộng trục nào, và tốn bao nhiêu. | `scripts/qa/expansion_plan.js` | RULE_GLOBAL.md · README.md · .agent/workflows · .agent/rules · prompt_templates · .claude/commands · tests/fe/infra |
| CHẶN (có cờ --enforce) | `explore:check`, `explore:check:enforce`, `explore:close` | MÁY cho nhánh exploratory: kiểm phiên + đóng vòng học. | `scripts/qa/explore_session.js` | exploratory · .claude/commands |
| CHẶN (có cờ --enforce) | `fixture:matrix` | TRỤC 4 + 5: **nhánh/biến thể** × **trạng thái kế cận** (42/69 bug của CSDL-24395). | `scripts/qa/fixture_matrix.js` | RULE_GLOBAL.md · README.md · .agent/rules · prompt_templates |
| CHẶN (có cờ --enforce) | `gates:index`, `gates:index:check` | sinh DANH MỤC GATE của kit từ chính source, không viết tay. | `scripts/qa/gate_index.js` | .gitlab-ci.yml · README.md · .github/workflows |
| CHẶN (có cờ --enforce) | `howto:check`, `howto:index`, `howto:find` | quản lý 2 store trả lời câu hỏi "LÀM SAO tới được đó": | `scripts/qa/howto_store.js` | README.md · prompt_templates |
| CHẶN (có cờ --enforce) | `lighthouse` | điểm Performance / Accessibility / SEO / Best-practices thật, chạy qua CDP. | `scripts/qa/lighthouse_check.js` | README.md · USER_GUIDE.md · scripts/qa/README.md · .github/workflows · .agent/skills · prompt_templates · tests/fe/infra |
| CHẶN (có cờ --enforce) | `load` | wrapper MỎNG cho k6 (Loại B: load/stress/soak nhiều VU). Loại A (single-user) dùng perf_check.js. | `scripts/qa/load_check.js` | RULE_GLOBAL.md · CLAUDE.md · README.md · USER_GUIDE.md · QUICKSTART.md · scripts/qa/README.md · .github/workflows · .agent/workflows · .agent/rules · .agent/skills · prompt_templates · exploratory · partial-rerun · .claude/commands · tests/fe/infra |
| CHẶN (có cờ --enforce) | `lint:locator`, `lint:locator:enforce` | GATE chống "bắt sai element → log sai bug". | `scripts/qa/locator_lint.js` | README.md · .agent/workflows · .agent/rules · .agent/skills · prompt_templates · .claude/commands · tests/fe/infra |
| CHẶN (có cờ --enforce) | `mutation:check`, `proof:nightly` | NEGATIVE CONTROL: cố ý tiêm lỗi rồi xem máy kiểm có ĐỎ không. | `scripts/qa/mutation_check.js` | .gitlab-ci.yml · RULE_GLOBAL.md · README.md · .github/workflows · .agent/workflows · .agent/rules · prompt_templates · .claude/commands · tests/fe/infra |
| CHẶN (có cờ --enforce) | `probe:persist` | TRỤC 3: chuỗi lưu trữ `form → payload → đọc lại (API) → UI`. | `scripts/qa/persistence_probe.js` | RULE_GLOBAL.md · README.md · .agent/rules · prompt_templates |
| CHẶN (có cờ --enforce) | `risk:gate`, `risk:gate:enforce` | ép Risk-Based Testing: đối chiếu testcase với depthPolicy theo band trong risk-register. | `scripts/qa/risk_gate.js` | README.md · USER_GUIDE.md · QUICKSTART.md · .github/workflows · .agent/workflows · .agent/skills · prompt_templates · .claude/commands |
| CHẶN (có cờ --enforce) | `scope:anchor`, `scope:anchor:enforce`, `scope:anchor:init` | NEO MẪU SỐ của Phase 1. | `scripts/qa/scope_anchor.js` | prompt_templates |
| CHẶN (có cờ --enforce) | `self-review`, `self-review:enforce` | Lượt 2: đối chiếu CHECKLIST trước finalize (ADVISORY). | `scripts/qa/self_review.js` | RULE_GLOBAL.md · README.md · USER_GUIDE.md · scripts/qa/README.md · .agent/workflows · prompt_templates · .claude/commands · tests/fe/infra |
| CHẶN (có cờ --enforce) | `spec:gap` | CHIỀU NGƯỢC: build CÓ mà tài liệu KHÔNG NHẮC (B3 của chương trình chống lọt bug). | `scripts/qa/spec_gap_report.js` | RULE_GLOBAL.md · CLAUDE.md · README.md · .agent/workflows · .agent/rules · prompt_templates · tests/fe/infra |
| CHẶN (có cờ --enforce) | `system:check`, `system:index` | quản lý `knowledge/system/`: bản đồ HỆ THỐNG đã được xác nhận. | `scripts/qa/system_map.js` | README.md · USER_GUIDE.md · .agent/workflows · .agent/skills · prompt_templates · partial-rerun |
| SINH | `docs:index`, `docs:cite` | mỗi neo yêu cầu trong tài liệu phải TRA NGƯỢC ĐƯỢC về file và số dòng. | `scripts/phase1/docs_index.js` | README.md · USER_GUIDE.md · prompt_templates · tests/fe/infra |
| SINH | `accessibility` | tái dùng hạ tầng của ui_conformance_check.js (login/pre-steps/catalog schema | `scripts/qa/accessibility_check.js` | README.md · USER_GUIDE.md · QUICKSTART.md · scripts/qa/README.md · .agent/rules · .agent/skills · prompt_templates |
| SINH | `dashboard` | đọc dữ liệu ĐÃ CÓ (knowledge/ + flaky-triage.md), KHÔNG thu thập lại, | `scripts/qa/dashboard_generate.js` | .gitlab-ci.yml · RULE_GLOBAL.md · README.md · USER_GUIDE.md · QUICKSTART.md · scripts/qa/README.md · .github/workflows · .agent/workflows · .agent/skills · prompt_templates · tests/fe/infra |
| SINH | `dep:graph` | GỘP traceability + impact-map thành 1 graph query-được. | `scripts/qa/dependency_graph.js` | README.md · scripts/qa/README.md |
| SINH | `explore:charter` | CHỌN VÙNG DÒ BẰNG DỮ LIỆU, không bằng cảm tính. | `scripts/qa/explore_charter.js` | exploratory · .claude/commands |
| SINH | `ui:contract` | biến DESIGN thành ORACLE MÁY ĐỌC ĐƯỢC (`knowledge/system/UI-*.json`). | `scripts/qa/figma_to_ui_contract.js` | RULE_GLOBAL.md · README.md · .agent/rules |
| SINH | `knowledge:backup` | sao lưu / khôi phục các store knowledge KHÔNG NẠP LẠI ĐƯỢC. | `scripts/qa/knowledge_backup.js` | .gitlab-ci.yml · README.md · QUICKSTART.md · .github/workflows · .agent/workflows · prompt_templates · tests/fe/infra |
| SINH | `learn:report` | trả lời câu "chạy task này thì đã HỌC được gì?". | `scripts/qa/learn_report.js` | README.md · prompt_templates |
| SINH | `learn`, `learn:backfill` | MẮT XÍCH HỌC còn thiếu: biến kết quả execute của 1 task thành learning data. | `scripts/qa/learn_task.js` | RULE_GLOBAL.md · README.md · USER_GUIDE.md · QUICKSTART.md · scripts/qa/README.md · .agent/workflows · .agent/skills · prompt_templates |
| SINH | `metrics:collect` | thu KPI mỗi lần chạy test → knowledge/metrics/ (tích luỹ theo thời gian). | `scripts/qa/metrics_collect.js` | README.md |
| SINH | `perf` | biến mục 16 (Performance/SLA) thành ĐO THẬT, so ngưỡng catalog → verdict. | `scripts/qa/perf_check.js` | RULE_GLOBAL.md · README.md · USER_GUIDE.md · QUICKSTART.md · scripts/qa/README.md · .github/workflows · .agent/workflows · .agent/skills · prompt_templates · tests/fe/infra |
| SINH | `reliability` | Test Reliability Index (TRI) per-testcase + flaky quarantine. | `scripts/qa/reliability_index.js` | .gitlab-ci.yml · README.md · scripts/qa/README.md · .github/workflows · .agent/workflows · tests/fe/infra |
| SINH | `risk` | Risk-Based Testing CÓ THỰC THI (Suggest-only). | `scripts/qa/risk_score.js` | .gitlab-ci.yml · RULE_GLOBAL.md · CLAUDE.md · README.md · USER_GUIDE.md · QUICKSTART.md · scripts/qa/README.md · .github/workflows · .agent/workflows · .agent/rules · .agent/skills · prompt_templates · exploratory · partial-rerun · .claude/commands · tests/fe/infra |
| SINH | `security` | biến phần deterministic của mục 15 thành ĐO THẬT. | `scripts/qa/security_check.js` | .gitlab-ci.yml · RULE_GLOBAL.md · README.md · USER_GUIDE.md · QUICKSTART.md · scripts/qa/README.md · .github/workflows · .agent/workflows · .agent/rules · .agent/skills · prompt_templates · exploratory · tests/fe/infra |
| SINH | `spec:extract` | bảng field trong FSD (markdown) → `screens.json` → (tuỳ chọn) `ui_catalog.json`. | `scripts/qa/spec_extract.js` | RULE_GLOBAL.md · README.md · .agent/rules · prompt_templates |
| SINH | `inventory:gate` | Chống "CI false green" (F1). | `scripts/qa/test_inventory_gate.js` | README.md |
| BÁO CÁO | `docs:health` | trả lời "tài liệu tôi đang đọc có còn đúng không" bằng MỘT LỆNH. | `scripts/phase1/docs_health.js` | prompt_templates |
| BÁO CÁO | `bug:tc-match` | ĐỀ XUẤT (không tự ghi) TC canonical cho bug đang `module: "(unmapped)"`. | `scripts/qa/bug_tc_matcher.js` | README.md · .claude/commands |
| BÁO CÁO | `bugs:checklist` | biến `knowledge/bugs/` thành CHECKLIST lúc SINH CASE (chiều §20 Error Guessing). | `scripts/qa/bugs_checklist.js` | .agent/workflows · prompt_templates · .claude/commands · tests/fe/infra |
| BÁO CÁO | `docs:budget` | đo TÀI LIỆU đầu vào của task rồi nói rõ: đọc trực tiếp, hay GIAO SUBAGENT trích ra rồi chỉ | `scripts/qa/doc_budget.js` | README.md · prompt_templates |
| BÁO CÁO | `(không npm — đăng ký ở playwright.config.js)` | Playwright reporter TỰ ĐỘNG thu learning data sau MỖI lần chạy test. | `scripts/qa/learn_reporter.js` | playwright.config.js (tự động) |
| BÁO CÁO | `quality:decision` | Quality Decision Engine, capstone). Gộp tín hiệu chất lượng → 1 quyết định | `scripts/qa/quality_decision.js` | README.md · scripts/qa/README.md |
| BÁO CÁO | `select:tests` | Intelligent Test Selection từ git diff. | `scripts/qa/select_tests.js` | README.md · USER_GUIDE.md |
| BÁO CÁO | `report` | const { spawnSync } = require('child_process'); | `scripts/show_report.js` | .gitlab-ci.yml · RULE_GLOBAL.md · CLAUDE.md · README.md · USER_GUIDE.md · QUICKSTART.md · scripts/qa/README.md · .github/workflows · .agent/workflows · .agent/rules · .agent/skills · prompt_templates · exploratory · partial-rerun · .claude/commands · tests/fe/infra |
