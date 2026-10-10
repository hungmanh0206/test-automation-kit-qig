---
name: flaky_test_analyzer
description: Phân tích testcase Playwright flaky và đề xuất/sửa root cause trong phạm vi an toàn.
---

# Flaky Test Analyzer

## Purpose

Xử lý testcase lúc pass lúc fail, timeout không ổn định, race condition, data conflict hoặc dependency không ổn định trong Phase 2/Re-run.

## Responsibilities

| Trách nhiệm | Yêu cầu |
|---|---|
| Pattern | So sánh các lần chạy để xác định fail/pass pattern. |
| Root cause | Phân loại timing, locator, data, auth/session, environment, mock hoặc product instability. |
| Fix | Sửa wait condition, locator, fixture, cleanup hoặc setup liên quan. |
| Verify | Rerun targeted nhiều vòng nếu chi phí hợp lý. |

## Inputs

| Input | Nguồn |
|---|---|
| TC/spec fail | User request, `results.json`, `execution-summary.md` |
| Error context | Screenshot, video, trace local, console/network summary |
| Code liên quan | Spec/helper/page object trực tiếp |

## Outputs

| Output | Vị trí |
|---|---|
| Flaky triage | `<TASK_OUTPUT_DIR>/reports/flaky-triage.md` hoặc rerun report |
| Fix scoped | File spec/helper liên quan |
| Rerun result | PASS/FAIL/SKIP + số vòng rerun |

## Khi dùng / KHÔNG dùng

| Dùng | KHÔNG dùng |
|---|---|
| Case lúc pass lúc fail giữa các lượt, cùng một build | Case FAIL **ổn định** — rerun chỉ loại flaky, KHÔNG loại được sai-element (xem dưới) |
| Timeout không đều, race condition, data conflict | Case chưa chạy lần nào (chưa có gì để so pattern) |
| Nghi dependency ngoài scope gây nhiễu | Để làm một case đỏ thành xanh (đó là nới assertion, non-negotiable §6) |

⚠️ **FAIL lặp lại ổn định KHÔNG đồng nghĩa product bug, và cũng không đồng nghĩa flaky.** Rerun loại được
nhiễu thời gian; nó KHÔNG loại được "script bấm/đọc nhầm đối tượng" — lỗi đó sai **ổn định**. Trước khi
kết luận, phải chứng minh đã thao tác đúng element (`lint:locator` + evidence highlight). Đây là chỗ phân
biệt skill này với `case-debugger`: skill này hỏi "có nhiễu không", `case-debugger` hỏi "sai ở đâu".

## Máy kiểm

- `npm run reliability` — chỉ số tin cậy (TRI) theo từng case, dựng từ `knowledge/metrics/tc-history.jsonl`.
  Đây là chỗ biết một case có thật sự chập chờn hay chỉ đỏ một lần.
- `npm run rerun:failed` — chạy lại ĐÚNG case đỏ, không chạy cả suite. Không có TC ID trong tiêu đề thì nó
  TỪ CHỐI dựng `--grep` một phần, thay vì chạy bừa.
- `npm run run:analysis` — 3 case LIÊN TIẾP đỏ cùng tầng hạ tầng là dấu hiệu môi trường sập, không phải 3
  ca flaky khác nhau.
- Ngưỡng rerun là **một nguồn**: `.agent/config/verdict_taxonomy.json` → `rerun`. Đừng chép số vào đây.

> ⚠️ Giới hạn của TRI, đo 23/08/2026 trên kho thật: `metrics_collect` **cố ý KHÔNG ghi** record `skipped`
> vào `tc-history`. Lý do: một lượt có 1548 record thì 1537 là `skipped`, và nếu tính chúng thì TRI của
> 500+ test bị kéo về 0 — tức chỉ số nói "cả bộ chập chờn" trong khi chúng chỉ chưa chạy. Skip KHÔNG nói
> gì về độ tin cậy; số skip vẫn giữ ở mức RUN, chỗ nó có nghĩa.

## Decision Rules

- Đọc đúng failure entry trước, không mở full report nếu chưa cần.
- Ưu tiên wait condition/locator ổn định/setup-cleanup hơn `waitForTimeout`.
- Retry chỉ dùng khi dependency ngoài scope có nhiễu và phải ghi lý do.
- Nếu behavior product thật sự không ổn định, ghi risk/product candidate thay vì che bằng retry.

## Constraints

- Không xóa assertion hoặc giảm expected result để giảm flaky.
- Không đổi testcase UI thành API-only nếu testcase cần verify UI.
- Không log Backlog khi chưa loại trừ setup/test harness.

## Anti-Patterns

- Thêm timeout dài mù quáng.
- Bỏ qua cleanup/data isolation.
- Coi flaky là PASS chỉ vì rerun một lần thành công.
