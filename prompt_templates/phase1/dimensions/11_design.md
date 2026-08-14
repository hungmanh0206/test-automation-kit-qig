# Chiều coverage: Design/Visual Compliance Coverage

> Tag bắt buộc trong tiêu đề case: **`[Design]`** · Mở khi: **task CÓ thiết kế Figma để đối chiếu**
> Tách khỏi [`02_gen_testcases.md`](../02_gen_testcases.md) 14/08/2026. Nội dung giữ NGUYÊN VĂN.
> Chiều khác tham chiếu trong bài thì mở file tương ứng ở cùng thư mục — danh sách đủ ở bảng điều hướng của `02`.

## 11. Design/Visual Compliance Coverage (đối chiếu Figma) — nếu task có thiết kế
Ngoài kiểm chức năng, nếu task có Figma/design thì phải có testcase đối chiếu **độ trung thực thiết kế ở mức token** cho các component chính (button, modal, input, header, menu item, table, card):
- **Màu (color token)**: background / text / border của component so mã màu Figma (hex/rgb).
- **Typography**: font-family, font-size, font-weight, line-height theo Figma.
- **Bo góc & viền**: border-radius, border width.
- **Kích thước**: width/height component so Figma.
- **Spacing**: padding trong component + khoảng cách (gap) giữa các component.
- **Bố cục/alignment**: thứ tự & căn chỉnh (VD `Cancel` bên trái / `Confirm` bên phải), các phần tử cùng hàng.
- **Trạng thái**: token cho state (hover/active/disabled/selected) nếu design có.

Nguyên tắc:
- Lấy token expected từ đúng **Figma node/frame** của màn (fills, `style.fontSize/fontWeight`, `cornerRadius`, `itemSpacing`/`padding`, `absoluteBoundingBox`). KHÔNG tự bịa màu/size.
- Phase 2 verify bằng `getComputedStyle` + `boundingBox` so token, dùng **dung sai** (VD màu lệch ≤8/kênh, radius ±2px, size ±8px, font-size ±1px).
- **Kiểm vị trí TƯƠNG ĐỐI** (thứ tự, alignment, gap giữa components), KHÔNG so toạ độ x/y tuyệt đối của canvas Figma → tránh false-fail do responsive/scroll/dynamic data.
- Nếu task KHÔNG có Figma/design → ghi `N/A + lý do` trong Coverage Gaps; không bỏ qua im lặng.
