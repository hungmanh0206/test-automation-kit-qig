# Chiều coverage: Cross-layer Guard Coverage

> Tag bắt buộc trong tiêu đề case: **`[Guard]`**.
> Mở khi **có ràng buộc phải bị CHẶN ở tầng khác**, tức 403, 409, hoặc trạng thái bất hợp pháp.
>
> Tách khỏi [`02_gen_testcases.md`](../02_gen_testcases.md) 14/08/2026. Mục ma trận phân quyền thêm 09/10/2026.
> Chiều khác tham chiếu trong bài thì mở file tương ứng ở cùng thư mục. Danh sách đủ ở bảng điều hướng của `02`.

## 10. Cross-layer Guard Coverage
Với mỗi ràng buộc thể hiện ở UI (disable/ẩn action theo status/role, field readonly):
- Phải có testcase negative bypass qua API/URL trực tiếp và kỳ vọng backend chặn (403/422), không chỉ kiểm UI ẩn/disable.

## Permission / Role — ma trận là MẪU SỐ, không phải gợi ý

Component `permission` trong [`.agent/config/ui_components.json`](../../../.agent/config/ui_components.json).
Scope có từ hai vai trở lên thì "đã kiểm phân quyền" chỉ có nghĩa khi có **ma trận liệt kê đủ ô**. Không có
ma trận thì số case là hàm của việc nhớ tới đâu, không phải hàm của spec.

1. **Lập ma trận `vai × hành động`** từ requirements. Khai vào `knowledge/system/` dạng
   `permission_matrix`. Artifact đó là thứ `dim:coverage` đọc để **CHẶN** khi manifest khai `security: n/a`.
2. **Mỗi ô ALLOW là 1 case**: vai đó làm được hành động đó. Mỗi ô DENY cũng là 1 case: bị chặn, kèm thông
   báo hoặc mã lỗi cụ thể.
3. **Ba tầng chặn phải kiểm riêng**. Hở tầng nào cũng là bug, và chúng độc lập nhau:
   - UI ẩn hoặc disable đúng theo vai.
   - Vào URL trực tiếp khi không có quyền thì không mở được màn.
   - Gọi API trái quyền thì BE trả 403, không chỉ dựa vào UI ẩn.
4. **Rút gọn ma trận thì phải ghi lý do**: gộp vai nào với vai nào, và vì sao gộp được. Rút gọn lặng lẽ
   thì mẫu số biến mất, và coverage trở lại thành con số tự khai.
5. **Thiếu tài khoản test cho một vai** thì ghi `needs_account` vào Coverage Gaps. Không đổi thành PASS.

Leo thang quyền dọc, IDOR ngang và mass-assignment là **mục 15**. Chiều này lo ràng buộc có bị chặn ở tầng
khác hay không. Mục 15 lo tấn công có khai thác được hay không.
