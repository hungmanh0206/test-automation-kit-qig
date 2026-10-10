---
name: ui_mocking
description: Chặn response bằng page.route để cô lập dependency ngoài scope hoặc inject fault (5xx/timeout/abort), rồi kiểm FE xử lý response đó thế nào. Dùng khi dependency ngoài không sẵn, hoặc cần dựng nhánh lỗi không tạo được thật. KHÔNG dùng để mock chính logic đang kiểm thử, và KHÔNG dùng case mock để kết luận về backend.
---

# UI Mocking — mock là để kiểm FE, không phải để kiểm backend

## Purpose

Chặn response ở tầng network (`page.route`) để: cô lập dependency **ngoài** scope, hoặc dựng nhánh lỗi
(5xx, timeout, abort) mà môi trường thật không tạo được theo yêu cầu.

Kit đã có `tests/support/setup/mocks/externalDependencyMock.ts` làm đúng việc đó. Thiếu là **kỷ luật** —
và đó là phần skill này thêm vào.

## Khi dùng / KHÔNG dùng

| Dùng | KHÔNG dùng |
|---|---|
| Dependency ngoài scope không sẵn trong UAT | Mock chính API của chức năng đang kiểm thử |
| Dựng nhánh 5xx/timeout/abort để xem FE xử lý | Thay cho một precondition dựng được bằng UI/API/factory |
| Kiểm FE hiển thị gì khi response thiếu field | Lấy kết quả mock làm bằng chứng backend đúng |

## Ba luật chống MOCK LỆCH (A không có, B thêm)

Mock lệch là kiểu hỏng nguy hiểm nhất của mocking: **hôm nay backend đổi field, mock vẫn trả bản cũ, case
vẫn XANH**. Ba luật dưới đây tồn tại để chuyện đó không âm thầm.

**1. Response mock KHÔNG ĐƯỢC BỊA.** Nó phải đến từ một trong hai nguồn:
- `page.routeFromHAR()` — HAR ghi lại từ lượt chạy thật, nên hình dạng response là hình dạng thật;
- hoặc schema của endpoint trong OpenAPI, khi dự án có.

Tự gõ một object JSON "nhìn giống response" là cách tạo ra một bản sao sẽ không bao giờ được cập nhật.

**2. Mock phải qua VALIDATE SCHEMA, sai thì CHẶN.** Mock không khớp schema endpoint thì nó đang mô phỏng
một backend KHÔNG TỒN TẠI, và mọi kết luận từ nó là kết luận về một hệ thống tưởng tượng.

⚠️ Giới hạn hiện tại, nói thẳng: **repo có 0 file OpenAPI/Swagger** (đo 10/10/2026, cả 5 task), nên luật
này hiện chỉ áp được cho đường `routeFromHAR`. Khi v2.6.0 sinh ra danh mục API từ discovery thì nó mới có
schema để đối chiếu — đó là lý do kit CHƯA xây bộ sinh test API từ OpenAPI.

**3. Case dùng mock gắn tag `[Mock]`, và chỉ kết luận về FE.**
- ⚙️ `tc_validator` **CHẶN** case có `[Mock]` mà khai `Loại case` = `API` hoặc `Database`: mock không bao
  giờ là bằng chứng về backend, nên khai như vậy là nói sai về chính thứ case đó đo.
- ⚙️ `gate:output` **CHẶN** case `[Mock]` có kết luận phán về backend ("đã lưu vào DB", "API trả đúng",
  "server xử lý đúng"…).
- Phần backend cần một case `API`/`Database` RIÊNG, chạy thật, không mock.

Cả hai gate này là **gác phòng ngừa**: đo 10/10/2026 thì 0 case trong repo mang tag `[Mock]`. Chúng chặn
một mẫu chưa xuất hiện, không đang dọn nợ — và nói ra điều đó thay vì để người đọc tưởng đã có gì được dọn.

## Decision Rules

- Mock dependency NGOÀI scope: được. Mock chức năng ĐANG kiểm thử: không bao giờ.
- Mỗi lượt mock phải ghi rõ trong actual result và trong report — người đọc cần biết số nào đến từ mock.
- Mock không thay được precondition dựng được bằng UI/API/factory/hook. Dựng được mà vẫn mock là tự bỏ
  đường đi thật của app.
- Case `[Mock]` không bao giờ đóng được một bug backend, và cũng không bao giờ chứng minh backend đúng.

## Anti-Patterns

- Gõ tay response JSON "nhìn giống thật" rồi để nó mục dần.
- Mock API của chức năng đang test để case xanh.
- Kết luận "dữ liệu đã lưu đúng" từ một case mock.
- Khai `Loại case = API` cho case mock.
- Mock rồi không ghi vào report, nên lượt sau không ai biết con số đó là mock.

## Related

- `tests/support/setup/mocks/externalDependencyMock.ts` — bộ mock fault injection đã có.
- [[precondition_setup_planner]] — kiểm xem state dựng được bằng đường thật trước khi nghĩ đến mock.
- `.agent/rules/playwright_fe.md` — quy ước Playwright, gồm phần Report.
