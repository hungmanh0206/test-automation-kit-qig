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
