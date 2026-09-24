# Locator Strategy

> Chiến lược locator cho Playwright UI automation.
> **Gate máy-kiểm:** `npm run lint:locator` (chặn vi phạm P0 MỚI so với baseline) · runtime dùng
> `scripts/utils/ui/safe_target.js`. Vi phạm ở đây không phải "chưa đẹp" — nó là nguyên nhân số 1
> khiến script bấm/đọc nhầm đối tượng rồi **log bug sai**.

## Hợp đồng "không-đoán" (No-guess targeting) — BẮT BUỘC

Bốn quy tắc dưới đây thắng mọi lý do "cho nhanh":

1. **Neo scope TRƯỚC, tìm control SAU.** Xác định section/card/row/dialog chứa control (theo tiêu đề,
   nhãn, nội dung của chính hàng đó) rồi mới query bên trong. CẤM tìm control ở cấp trang rồi hy vọng
   trúng. → `safe_target.section(page, '<Tiêu đề>', { siblings: [...] })`.
2. **Mơ hồ = LỖI, không chọn bừa.** Locator match > 1 phần tử thì phải **thu hẹp**, KHÔNG `.first()`.
   → `safe_target.one(locator)` ném `script_error` kèm danh sách match.
3. **Hành động phải NGHIỆM THU.** Sau click/chọn, assert dấu hiệu kết quả (sentinel) mới đi tiếp; bật
   nhầm modal/dropdown thì đóng lại và báo lỗi. → `safe_target.clickVerified(page, target, { expect })`,
   panel/accordion dùng `scripts/utils/ui/ensure_expanded.js`.
4. **Đọc giá trị phải có neo.** CẤM regex trên `document.body.innerText`. → `safe_target.readValue(scope, label)`.

Trước chuỗi thao tác dài: `safe_target.assertScreen(page, { url | heading })` để chắc đang đúng màn.

## Priority

| Ưu tiên | Locator |
|---:|---|
| 1 | `getByRole()` với accessible name |
| 2 | `getByLabel()` cho form field |
| 3 | `getByPlaceholder()` khi label không có |
| 4 | `getByText()` cho text/action rõ ràng |
| 5 | `getByTestId()` khi app có test id ổn định |
| 6 | CSS scoped locator khi không có semantic locator |

XPath và selector dựa vào layout chỉ dùng khi không còn lựa chọn tốt hơn và phải ghi lý do.

## CẤM (gate P0 — `lint:locator` chặn khi phát sinh mới)

| Anti-pattern | Vì sao nguy hiểm | Thay bằng |
|---|---|---|
| `mouse.click(x, y)` | Toạ độ lệch khi scroll/animation/đổi viewport; không biết đã bấm trúng gì | locator có nghĩa trong scope đã neo |
| `force: true` | **Bỏ qua actionability** (bị che/disabled/ngoài màn) → bấm xuyên overlay trúng thứ khác | chờ điều kiện thật (`waitFor`, `toBeEnabled`); nếu buộc dùng thì phải assert danh tính element trước + nghiệm thu sau |
| `.first()` ở cấp trang | "Nhiều match thì lấy đại cái đầu" — đúng cơ chế bắt nhầm | thu hẹp scope, hoặc `safe_target.one()` |
| `body.innerText.match(...)` | Vớ nhầm số/nhãn của section khác → **oracle sai → bug sai** | `readValue(scope, label)` |
| `querySelectorAll('*')` rồi lọc theo text | Trúng phần tử cha/hàng xóm là chuyện thường | query trong scope đã neo |
| `.nth(i)` ở cấp trang (P1) | Phụ thuộc thứ tự DOM, đổi layout là lệch | neo theo nội dung/nhãn của đúng hàng-mục |
| `waitForTimeout` dài (P1) | Che locator/điều kiện sai, làm lỗi thật khó lộ | chờ điều kiện cụ thể |

Cần ngoại lệ thật thì ghi `// locator-lint-disable-next-line <lý do>` ngay TRÊN dòng (bắt buộc có lý do).

## Rules

- Locator phải match đúng element cần thao tác/assert.
- Ưu tiên locator theo nghĩa người dùng nhìn thấy.
- Không dùng CSS class động, hash class, `nth-child` hoặc XPath tuyệt đối nếu có lựa chọn ổn định hơn.
- Inspect DOM thực tế trước khi sửa locator.
- Verify locator ở nhiều state: loading, loaded, empty, có data, modal/dropdown.

## Khi FAIL: phân loại trước khi kết luận (chống log bug sai)

- **Rerun KHÔNG loại được sai-element**: bắt nhầm element thì fail **lặp lại ổn định**, trông y hệt product bug.
- Trước khi kết luận `product_bug`/`api_bug`, phải chứng minh **đã thao tác đúng đối tượng**:
  evidence highlight đúng element **và** (xác minh lại bằng một đường định vị độc lập **hoặc** thao tác tay).
- Không chứng minh được → `failureLayer: script_error` (`.agent/config/verdict_taxonomy.json`,
  `loggableAsBug: false`) → **KHÔNG log Backlog**, sửa script rồi chạy lại.
- Lỗi do `safe_target` ném ra đã mang tiền tố `[script_error]` để phân loại đúng ngay.

## Anti-Patterns

- Đoán locator từ tài liệu mà không inspect UI.
- Copy locator cũ sau khi UI đổi mà không verify.
- Bỏ assertion UI vì locator khó.
- Dùng hard wait để che locator sai.
- Thấy fail lặp lại là kết luận product bug mà chưa loại `script_error`.
