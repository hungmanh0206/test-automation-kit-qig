---
name: test_data_generator
description: Sinh test data cụ thể, unique theo RUN_ID, truy vết được và rollback được cho Phase 1 và Phase 2. Dùng khi case cần dữ liệu mới thay vì dữ liệu sẵn có. KHÔNG dùng để dựng state qua DB, và KHÔNG sinh dữ liệu chứa PII khách thật.
---

# Test Data Generator

## Purpose

Tạo hoặc đề xuất test data phục vụ testcase và automation, đảm bảo dữ liệu cụ thể, không trùng khi chạy song song và có cleanup/rollback.

## Responsibilities

| Trách nhiệm | Yêu cầu |
|---|---|
| Positive/negative/boundary/edge | Sinh data theo từng nhóm test. |
| Traceability | Data có prefix/time/random đủ truy vết TC hoặc run. |
| Parallel safety | Data unique, tránh conflict giữa session. |
| Cleanup | Ghi rõ pre-existing, created-by-test, cleanup-required hoặc read-only fixture. |
| Cách dựng | Tag `[<method>]` trong cell `Tiền điều kiện`; chi tiết (source/verification/cleanup) ở `### Setup Readiness` của `phase1-summary.md` |

## Inputs

| Input | Nguồn |
|---|---|
| Testcase | TC ID, module, precondition, data field |
| Requirement | Validation rule, business rule, API schema |
| Runtime scope | `TASK_KEY`, `RUN_ID`, project/site |

## Outputs

| Output | Vị trí |
|---|---|
| Test data table | Testcase Markdown hoặc `reports/phase1-summary.md` |
| Fixture/factory notes | Spec/helper hoặc report liên quan |
| Cleanup plan | Actual result/report khi execute |
| Cách dựng input | Tag `[<method>]` của từng TC (`api`/`factory`/`test_hook`/`ui`/`pre_existing`/`manual`) |

## Khi dùng / KHÔNG dùng

| Dùng | KHÔNG dùng |
|---|---|
| Case cần bản ghi MỚI, chưa có trong môi trường | State dựng được từ dữ liệu sẵn có đã verify tồn tại |
| Cần biến thể theo kỹ thuật (biên, rỗng, ký tự đặc biệt) | Dựng state bằng **DB** — non-negotiable §2, DB chỉ đọc |
| Cần dữ liệu unique để hai lượt chạy không giẫm nhau | Chọn *phương pháp* setup — đó là `precondition_setup_planner` |

⚠️ **Không bao giờ sinh file chứa email hoặc số điện thoại khách thật**, từ bất kỳ nguồn nào — kể cả export
có sẵn. Đây là quy định tổ chức (non-negotiable §1): được yêu cầu xuất file thì phải TỪ CHỐI.

## Máy kiểm

- `npm run secret:scan` — chặn secret bị commit. ⚠️ Nó chỉ quét file ĐƯỢC TRACK, nên dữ liệu sinh ra trong
  `outputs/**` (gitignore) **ngoài tầm nó**.
- `npm run auto:review:enforce` — rule `cred-literal` lấp đúng chỗ đó: credential viết thẳng trong spec,
  kể cả spec ở `outputs/**`.
- `npm run gate:output` — mask PII trong comment và evidence, dùng `PII_PATTERNS` của
  `scripts/qa/lib/output_rules.js`. Đừng khai lại mẫu PII ở đây: một nguồn.
- `RUN_ID` là mắt xích dọn dẹp. Thiếu nó thì dữ liệu hai lượt trùng nhau, và đó là nguồn flaky khó tìm
  nhất — `npm run reliability` chỉ thấy "case chập chờn", không thấy nguyên nhân.

## Decision Rules

- Mỗi testcase phải có data cụ thể hoặc reference rõ tới fixture cụ thể.
- Data tạo mới nên có prefix `auto_<tc_or_feature>_<timestamp>_<random>`.
- Dữ liệu mutate phải có rollback/cleanup hoặc lý do không cleanup được.
- Dữ liệu read-only phải được verify tồn tại trước khi execute.
- Việc phân loại tiền điều kiện và chọn setup method (factory/hook/fixture/mock) do skill `precondition_setup_planner` đảm nhận; skill này tập trung sinh giá trị data cụ thể, unique, traceable.

## Constraints

- Không dùng production data thật nếu không có approve và rollback.
- Không ghi password/token/secret vào testcase/report.
- Không dùng mock data làm mất mục tiêu kiểm thử thật.

## Anti-Patterns

- Data chung chung: “email hợp lệ”, “user bất kỳ”.
- Dùng cùng một entity cố định cho nhiều test chạy song song.
- Không dọn dữ liệu tạo bằng API/UI sau test.
