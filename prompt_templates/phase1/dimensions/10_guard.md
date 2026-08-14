# Chiều coverage: Cross-layer Guard Coverage

> Tag bắt buộc trong tiêu đề case: **`[Guard]`** · Mở khi: **có ràng buộc phải bị CHẶN ở tầng khác (403/409/trạng thái bất hợp pháp)**
> Tách khỏi [`02_gen_testcases.md`](../02_gen_testcases.md) 14/08/2026. Nội dung giữ NGUYÊN VĂN.
> Chiều khác tham chiếu trong bài thì mở file tương ứng ở cùng thư mục — danh sách đủ ở bảng điều hướng của `02`.

## 10. Cross-layer Guard Coverage
Với mỗi ràng buộc thể hiện ở UI (disable/ẩn action theo status/role, field readonly):
- Phải có testcase negative bypass qua API/URL trực tiếp và kỳ vọng backend chặn (403/422), không chỉ kiểm UI ẩn/disable.
