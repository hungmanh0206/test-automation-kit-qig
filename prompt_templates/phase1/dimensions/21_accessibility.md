# Chiều coverage: Accessibility (A11y) Coverage

> Tag bắt buộc trong tiêu đề case: **`[A11y]`**.
> Mở khi **scope có màn UI thao tác được**, tức form, bảng, modal hay menu.
>
> Thêm 20/08/2026. Đo trước khi thêm: kit CÓ `scripts/qa/accessibility_check.js` chạy được, nhưng chỉ **2/22**
> file prompt sinh case nhắc tới a11y. Máy có mà không ai bảo dùng.

## 21. Accessibility Coverage

Đây **không phải** chiều "cho đủ chuẩn". Phần lớn lỗi a11y hay gặp cũng chính là **bug FE thật** mà người
dùng sáng mắt vẫn gặp:

- Thiếu `label` thì trình đọc màn hình không biết ô nào là ô nào, và **automation cũng bắt sai element**.
- Focus order lộn xộn thì thao tác bàn phím vào sai ô.
- Contrast thấp thì chữ trên nền vàng không đọc được trên máy chiếu.

Nên chiều này bắt lỗi **có thật**, không phải formality.

### Bước 1 — Chạy máy trước, đọc kết quả rồi mới viết case

```bash
npm run accessibility -- --catalog requirements/ui_catalog.json   # quét theo catalog màn
npm run accessibility -- --url "<file-or-http>" --no-login          # smoke nhanh 1 trang
```

Máy (axe-core, chạy trên trang đã login) quét phần **tất định**: thiếu label, color contrast, keyboard
navigation, ARIA role. Kết quả ra `accessibility-report.md`. Việc của người là biến
mỗi phát hiện thành case có oracle, và soi tiếp phần máy không thấy.

### Bước 2 — Bốn nhóm case
Chỉ mở nhóm nào áp dụng cho scope:

1. **Nhãn & ngữ nghĩa.** Mỗi input có nhãn gắn đúng (`label for` / `aria-label`); nút icon-only có tên đọc được;
   ảnh có `alt` (ảnh trang trí thì `alt=""`, không bỏ trống thuộc tính).
2. **Bàn phím.** Tab đi qua đúng thứ tự đọc; không có bẫy focus trong modal; **Esc đóng được** modal/dropdown;
   thao tác chính làm được **không cần chuột**. — Đây cũng là cách né `⋮` menu React hay flaky khi click.
3. **Trạng thái & thông báo.** Lỗi validate phải gắn được vào ô lỗi (`aria-describedby`), không chỉ hiện chữ đỏ
   ở đâu đó; trạng thái loading/disabled phải phát ra được, không chỉ đổi màu.
4. **Nhìn thấy được.** Contrast chữ/nền đạt ngưỡng; **không dùng MỖI màu** để truyền thông tin (trạng thái phải
   có chữ hoặc icon kèm); focus ring không bị CSS xoá.

### Bước 3 — Oracle phải cụ thể
Cấm expected kiểu *"màn hình thân thiện với người khuyết tật"*. Phải nêu **thuộc tính và giá trị**:
- `label[for="payment-method"]` tồn tại và trỏ đúng input;
- tab từ ô Amount tới ô Paid Date **không** nhảy qua nút Save;
- contrast chữ trắng trên nền vàng `#FFC107` ≥ ngưỡng máy báo.

> Chiều này giao với **§11 Design** (token màu) và **§12 Display** (nhãn cột). Nếu đã có case ở đó phủ đúng
> khẳng định này thì **đối chiếu TC ID**, đừng sinh case trùng — ghi vào Coverage Gaps là đã phủ ở chiều khác.
