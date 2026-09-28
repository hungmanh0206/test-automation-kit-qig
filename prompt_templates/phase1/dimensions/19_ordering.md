# Chiều coverage: Ordering / Sequence Coverage

> Tag bắt buộc trong tiêu đề case: **`[Ordering]`**.
> Mở khi **luồng có ≥2 bước mà người dùng có thể làm SAI THỨ TỰ, quay lui, hoặc làm xen kẽ**.
>
> Thêm 20/08/2026 sau khi đo: toàn kit chỉ **1 file** nhắc "thứ tự thao tác". Đây là chiều yếu nhất trong
> nhóm thời gian và môi trường.

## 19. Ordering / Sequence Coverage

Kit vốn mạnh ở **"làm gì"** (field nào, giá trị nào, trạng thái nào) nhưng yếu ở **"làm theo thứ tự nào"**.
Bug loại này không lộ ra khi chạy đúng kịch bản một mạch. Nó chỉ lộ khi người thật bấm lộn xộn: điền B trước
A, quay lại sửa bước trước, mở hai tab làm xen kẽ, bấm Back rồi Submit lại.

Khác các chiều đã có:
- **§8 Resilience** lo *đồng thời* (hai request đua nhau, callback trùng) — ở đây là **tuần tự nhưng sai thứ tự**.
- **§10 Guard** lo *trạng thái bất hợp pháp bị chặn* — ở đây lo *đường đi tới trạng thái đó*.
- **§13 Business Logic** lo *kết quả tính đúng* — ở đây lo *kết quả có phụ thuộc thứ tự nhập hay không*.

### Bước 1 — Liệt kê các bước có RÀNG BUỘC thứ tự
Với mỗi form hay luồng nhiều bước, ghi ra cặp `(A phải trước B)` và **vì sao**. Hai ví dụ thật trong repo này:

- Add Transaction phải chọn **Transaction Type → Payment Type → Payment Method**, vì dropdown sau phụ thuộc
  dropdown trước.
- Màn Add Lesson cần **Learning Method, ngày và giờ có TRƯỚC** thì ô Teacher mới bật.

Không có ràng buộc nào ⇒ ghi `N/A: các bước độc lập` vào Coverage Gaps, **đừng sinh case bừa**.

### Bước 2 — Sinh case cho 5 dạng đảo thứ tự
Mỗi dạng dưới đây là một câu hỏi phải có case trả lời (chỉ mở dạng nào áp dụng được):

1. **Làm ngược (B trước A).** Chọn giá trị ở bước sau khi bước trước còn trống → phải bị chặn hoặc disable,
   KHÔNG được cho qua rồi hỏng ở bước cuối.
2. **Quay lui rồi sửa.** Hoàn tất tới bước N, quay lại đổi bước 1 → giá trị phụ thuộc phải **reset hoặc
   tính lại**, không được giữ giá trị cũ đã hết hiệu lực. *(Chính là lớp bug `VNPAY_TC_49`.)*
3. **Bỏ dở giữa chừng rồi quay lại.** Rời màn, F5 hay Back giữa luồng thì state phải sạch hoặc khôi phục
   đúng. Không được nửa vời, kiểu đã trừ số dư mà chưa tạo bản ghi.
4. **Xen kẽ hai bối cảnh.** Mở 2 tab cùng luồng, thao tác đan xen → tab sau không được ghi đè kết quả tab trước
   một cách âm thầm.
5. **Thứ tự có làm đổi kết quả không.** Nhập cùng bộ dữ liệu theo 2 thứ tự khác nhau → kết quả cuối phải
   **giống hệt**. Lệch = có state ẩn phụ thuộc thứ tự.

### Bước 3 — Oracle
Expected phải nói rõ **cơ chế**, không nói "hệ thống xử lý đúng":
- bị chặn: nêu control bị `disabled` / thông báo cụ thể / mã lỗi.
- reset: nêu **ô nào** về giá trị nào (rỗng hay auto-chọn lựa chọn hợp lệ duy nhất — hai thứ khác nhau).
- bất biến: nêu **giá trị nào** phải bằng nhau giữa hai thứ tự.

> ⚠️ Case chiều này là **chuỗi thao tác** ⇒ evidence phải là **video** (RULE_GLOBAL §evidence), ảnh tĩnh
> không tả được diễn biến. Gate output sẽ chặn nếu thiếu.
