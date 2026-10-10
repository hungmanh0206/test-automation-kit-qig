---
name: requirements_analyzer
description: Phân tích requirement/UI/API artifact để tạo scope, business rule và coverage input cho Phase 1.
---

# Requirements Analyzer

## Purpose

Chuyển Backlog/tài liệu nguồn/Figma/Swagger/local artifact thành requirement summary, business rule, open question và coverage input phục vụ sinh testcase.

## Responsibilities

| Trách nhiệm | Yêu cầu |
|---|---|
| Scope | Xác định module, user story, screen, endpoint, role và data behavior trong scope. |
| Trace | Mapping requirement/business rule/API behavior tới testcase hoặc gap. |
| Risk | Phân loại rule/gap theo `Critical`, `High`, `Medium`, `Low`. |
| Setup input | Từ Swagger/API spec, xác định endpoint/payload có thể dùng để setup precondition (input cho Setup Strategy contract của testcase). |
| Question | Ghi open question khi tài liệu mâu thuẫn hoặc thiếu expected result. |
| Impact/Affected area | Nhận diện "bề mặt dùng chung" story đụng tới (data/entity/field, endpoint, component/rule, status/enum, calc/report, permission, job/event) và feature khác phụ thuộc — input cho Change Impact / Regression Ripple (mục 17); cái không suy được → flag "QA confirm". |

## Inputs

| Input | Nguồn |
|---|---|
| Requirement | Backlog, tài liệu nguồn, file local |
| UI design | Figma hoặc screenshot/spec local |
| API spec | Swagger/OpenAPI |
| Project context | `.agent/config/project_context.md` |

## Outputs

| Output | Vị trí |
|---|---|
| Requirement summary | `<TASK_OUTPUT_DIR>/requirements/` hoặc `reports/phase1-summary.md` |
| Coverage input | Requirement/API/UI behavior -> TC/gap mapping |
| Setup source candidates | Endpoint/payload/fixture từ Swagger phục vụ Setup Strategy contract |
| Open questions | `task.md` hoặc Phase 1 summary |

## Thứ tự ưu tiên khi hai nguồn nói ngược nhau

Hai nguồn mâu thuẫn thì **không chọn bừa, và cũng không lấy app ra phân xử**. Thứ tự:

| # | Nguồn | Ghi chú |
|---|---|---|
| 1 | **BA/PO xác nhận** (có ngày, ghi vào `knowledge/domain`) | Thắng mọi nguồn khác, kể cả tài liệu |
| 2 | **Văn bản pháp quy / quy định gốc** | TT32/2018, TT28/2020… — nguồn ngoài dự án, không ai sửa được cho tiện |
| 3 | **FSD/BRD bản mới nhất** | Ghi rõ phiên bản và mục; bản cũ không dùng để phản bác bản mới |
| 4 | **Figma / UI spec** | Chỉ là oracle cho **hiển thị**, không cho nghiệp vụ |
| 5 | **Bộ testcase chuẩn của hệ thống** | Dùng để tìm vùng SÓT, **không** để lấy expected |
| ⛔ | **App đang chạy** | **KHÔNG BAO GIỜ là oracle.** Xem mục dưới |

Mâu thuẫn chưa phân xử được thì nó là **câu hỏi Blocking** ở `reports/phase1-clarifications.md`, không phải
một lựa chọn im lặng.

## "UI thực tế" là SỰ THẬT QUAN SÁT, không phải oracle

Đây là chỗ kit khác `qig-qa-automation` về nguyên tắc: A cho phép requirement lấy từ "UI thực tế" đi thẳng
vào test case. Ở đây thì **không** — app không bao giờ là chuẩn đúng-sai của chính nó, vì so app với app
luôn PASS, kể cả khi app sai.

Đường đi đúng của một quan sát: **quan sát → câu hỏi Ambiguity Gate → BA/tài liệu chốt → `knowledge/domain`
có `confirmed_by` → mới thành oracle.**

⚙️ `npm run domain:check` **CHẶN** rule khai `source` lấy app làm nguồn ("quan sát trên app", "theo app
hiện tại", "UI thực tế", "như app đang hiển thị"). Đo 10/10/2026: 0 trong 118 rule thật mắc lỗi này, nên
luật xanh ngay — nó chặn đường lùi, không dọn nợ.

## "Không đề cập" KHÁC "không áp dụng"

Hai câu nghe giống nhau và hệ quả ngược nhau:

- **"Tài liệu không đề cập"** = chưa có căn cứ. KHÔNG kết luận được gì, kể cả kết luận "không cần test".
- **"Không áp dụng"** = đã có căn cứ rằng chuyện đó không tồn tại trong phạm vi này.

Rule khai đặc tả im lặng vẫn hợp lệ — **nếu nêu được một neo độc lập**: thuộc tính toàn vẹn phổ quát, văn
bản pháp quy, BA/dev xác nhận, hoặc bộ testcase chuẩn của hệ thống. Dừng ở "đặc tả không đề cập" thì rule
chỉ còn là suy đoán.
⚙️ `domain:check` cảnh báo đúng ca đó. Bốn rule trong repo khai đặc tả im lặng và cả bốn đều nêu neo —
chúng là mẫu đúng, và danh sách dấu hiệu của gate được lấy từ chính chúng.

## Ba mức bằng chứng cho phân quyền

Khi dựng ma trận quyền (`PM-*` của [[system_mapper]]), mỗi ô `role × action` phải mang một trong ba mức:
**đã kiểm chứng** (`allow` / `deny_verified`) · **suy từ màn cấu hình** (`deny_inferred` + `inferred_from`)
· **chưa có căn cứ** (`unknown`).

**Ô `unknown` KHÔNG được làm tròn thành "không có quyền".** Khẳng định 403 ở một ô chưa ai chốt là tự bịa
ra một yêu cầu, và nếu app cho phép thì bug log ra là **bug bịa**. Chi tiết và máy gác:
`knowledge/SCHEMA.md` §`permission_matrix`.

## Bản đồ phủ tài liệu

Mỗi vùng của tài liệu phải rơi vào một trong bốn ô, và **ô nào cũng phải có người đọc** — không ô nào được
im lặng:

| | Có trong tài liệu | Không có trong tài liệu |
|---|---|---|
| **Có TC** | phủ đủ | TC dựa trên gì? Nếu là quan sát app ⇒ chưa có oracle |
| **Không có TC** | **vùng SÓT** — mẫu số của `scope:anchor` | vùng mù: phải hỏi BA |

Mẫu số của vùng sót lấy từ `npm run scope:anchor`, không tự liệt kê — số tự khai thì "đủ" chỉ còn nghĩa
"tôi thấy đủ".

## Decision Rules

- Ưu tiên artifact local/snapshot trước khi fetch raw source lớn.
- Chỉ đọc section/source liên quan đến scope.
- Requirement chỉ được coi là clear khi có expected behavior đủ để sinh testcase executable.
- Nếu link/path source thay đổi sau baseline, đó là partial-rerun concern, không tự thay main source.

## Constraints

- Không tự suy diễn expected result khi requirement mơ hồ.
- Không hardcode task/project cụ thể vào template chung.
- Không ghi secret vào requirement artifact/report.

## Anti-Patterns

- Paste toàn bộ raw tài liệu nguồn/Figma/Swagger vào chat.
- Bỏ qua permission/error/rollback/API side-effect trong coverage input.
- Bỏ qua vùng ảnh hưởng ngoài scope khi story đụng data/endpoint/component/rule/status/permission dùng chung (change impact — mục 17).
- Coi số lượng testcase cao là coverage tốt nếu thiếu core/high-risk rule.
