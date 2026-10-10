---
name: tc_validator
description: Validate testcase Phase 1 theo template 10 cột, coverage/risk gate và khả năng execute automation.
---

# TC Validator

## Purpose

Kiểm tra testcase sau khi sinh/cập nhật để đảm bảo đủ chi tiết, trace requirement rõ và sẵn sàng cho Phase 2 automation.

## Responsibilities

| Trách nhiệm | Yêu cầu |
|---|---|
| Format | Bắt buộc đủ **10 cột** canonical (gồm `Loại case` và `Tag`) — khớp `RULE_GLOBAL.md`. Đừng ghi 11: Excel SAU publish có 11 cột vì exporter thêm `Nhóm chức năng`, còn `.md` mà skill này kiểm thì có 10. |
| Data | Test data cụ thể, traceable, không placeholder. |
| Steps | Step rõ ràng, executable, không gom quá nhiều hành vi trong một dòng. |
| Expected | Expected cụ thể, map đúng business rule/API/UI state. |
| Coverage | Đánh giá requirement coverage và risk-based gate. |
| Risk depth (RBT) | Không chỉ soi % coverage: module **High risk** (theo `### Scope Suggestion`/`risk-register.md`) phải đạt **độ sâu** theo `depthPolicy` trong `.agent/config/risk_model.json` (nguồn duy nhất, mặc định High minCount 10 + edge/boundary/security). High risk mà nông → gap, không PASS. **Chạy được:** `npm run risk:gate` (skill `risk_scorer`) — bản executable của gate này; `risk:gate:enforce` chặn CI khi CRITICAL High. |
| Design techniques | Kiểm áp đúng kỹ thuật khi applicable: entity có vòng đời trạng thái → có **State Transition** (ma trận status × action, gồm transition hợp lệ + bị chặn); logic tổ hợp nhiều điều kiện → có **Decision Table** (đủ combination + nhánh else/default). Applicable mà thiếu → gap. |
| Logic/Data/Security/Perf | Soi 4 dimension hay bị bỏ (mục 13-16 của rule): logic/tính toán có oracle **giá trị cụ thể** + so khớp/delta dữ liệu; field trống nghi ngờ có TC đối chiếu response BE (null/rỗng/thiếu/0); endpoint có id có TC IDOR + injection/mass-assignment/data-exposure; SLA/large-dataset/concurrent khi có ngưỡng. Thiếu mà applicable → ghi gap, không PASS im lặng. |

## Inputs

| Input | Nguồn |
|---|---|
| Testcase Markdown | `<TASK_OUTPUT_DIR>/test-cases/*.md` |
| Requirement summary | `requirements/`, `reports/phase1-summary.md`, `task.md` |
| Rules | `prompt_templates/phase1/02_gen_testcases.md` |

## Outputs

| Output | Vị trí |
|---|---|
| Validation findings | Phase 1 summary hoặc `task.md` |
| Required fixes | TC ID, issue, severity, recommendation |

## Khi dùng / KHÔNG dùng

| Dùng | KHÔNG dùng |
|---|---|
| Đã sinh xong bộ TC, trước khi publish | Chấm CHẤT LƯỢNG từng dòng case — đó là `tc_reviewer` |
| Cần biết bộ đã đủ cột và đủ chiều chưa | Chấm verdict sau khi execute — đó là `gate:output` |
| Cần biết module risk cao có bị nông không | Khi chưa neo MẪU SỐ (`scope:anchor`): % trên mẫu số tự khai là vô nghĩa |

⚠️ **Mẫu số phải neo TRƯỚC.** Không có `requirements/scope_inventory.md` thì "coverage 95%" chỉ là 95% của
danh mục do chính agent đặt ra, và "đủ" chỉ còn nghĩa "tôi thấy đủ". `npm run scope:anchor:init` đi trước
mọi con số ở skill này.

## Máy kiểm

- `npm run design:gate` — chặn bộ TC kém trước khi publish.
- `npm run dim:coverage -- --enforce` — chiều nào `required` mà chưa có case thì CHẶN; chiều khai `n/a`
  phải kèm lý do, và lý do đã bị bác ở task trước thì không dùng lại được.
- `npm run tc:review:enforce` — chấm chất lượng từng dòng, việc KHÁC với skill này.
- `npm run scope:anchor` — mẫu số. Đọc nó trước khi tin bất kỳ tỉ lệ nào.

> **Số cột canonical là 10, không phải 11.** Nguồn duy nhất: `CANONICAL_COLS` trong
> `scripts/lib/testcase/model.js`. Excel SAU publish có nhiều cột hơn (exporter thêm `Nhóm chức năng`,
> `Result`, `Note`…) — lẫn "bản xuất" với "template" là cách con số sai sống sót, và nó đã sống trong hai
> workflow tới 10/10/2026.

## Decision Rules

- Requirement coverage = covered requirements / total in-scope requirements * 100%.
- Requirement chỉ covered khi có testcase trace rõ, assertion đúng behavior và không skip nếu đã có execution result.
- **Coverage % đủ ngưỡng nhưng module High risk còn nông (thiếu edge/negative/boundary theo density) → KHÔNG PASS** (gate depth, không chỉ gate %).
- Nếu còn gap Critical/High, không kết luận PASS.
- Testcase duplicate/overlap chỉ giữ khi khác risk/data/expected rõ ràng.

## Constraints

- Không sửa expected result để làm testcase đẹp hơn.
- Không chấp nhận testcase thiếu data/step/expected cụ thể.
- Không coi API testcase hợp lệ nếu thiếu method, endpoint, expected status/body.

## Anti-Patterns

- “Dữ liệu hợp lệ” không có giá trị cụ thể.
- Expected chung chung như “hệ thống hoạt động đúng”.
- **Kết quả mong đợi gộp range (`1-2.`/`2-3.`) thay vì đánh số KHỚP từng bước (bước 1→KQ 1, 2→2…) — CẤM; mỗi bước 1 dòng, xuống dòng `<br>`.**
- Coverage PASS chỉ vì số lượng testcase nhiều.
