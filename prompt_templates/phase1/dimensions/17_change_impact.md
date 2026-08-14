# Chiều coverage: Change Impact / Regression Ripple Coverage

> Tag bắt buộc trong tiêu đề case: **`[Impact]`** · Mở khi: **story thêm/sửa/xoá làm thay đổi thứ DÙNG CHUNG**
> Tách khỏi [`02_gen_testcases.md`](../02_gen_testcases.md) 14/08/2026. Nội dung giữ NGUYÊN VĂN.
> Chiều khác tham chiếu trong bài thì mở file tương ứng ở cùng thư mục — danh sách đủ ở bảng điều hướng của `02`.

## 17. Change Impact / Regression Ripple Coverage (BẮT BUỘC khi story thêm/sửa/xoá làm thay đổi thứ dùng chung)

Bắt lỗi **"sửa 1 feature con → vỡ feature khác"** — thứ requirement của story KHÔNG mô tả nhưng hay gây incident. TÁCH RIÊNG khỏi Side-effect (mục 9 — output của chính action) và Data Consistency (mục 13 — trong scope).

**Bước 1 — Bề mặt dùng chung mà thay đổi ĐỤNG tới.** Nếu có `requirements/git-impact.md` (skill `git_impact_analyzer`), dùng nó làm danh sách bề mặt thay đổi **thực tế từ git diff** làm điểm khởi đầu thay vì chỉ đọc code đoán — vẫn tự soi bổ sung và giữ flag `QA confirm` cho phần không chắc. Nếu thay đổi cô lập (không đụng gì chung) → ghi `N/A: no shared surface` ở Coverage Gaps, KHÔNG sinh bừa. Soi các bề mặt:
- Data/entity/field chung (thêm field, đổi kiểu/default, migration).
- Endpoint/API chung (đổi payload/response/status code).
- Component/validation/business rule/util dùng lại.
- Status/enum chung (thêm/đổi giá trị).
- Calculation/aggregate/report chung nguồn.
- Permission/role/guard chung.
- Job/trigger/event/queue/cron chung.

**Bước 2 — Map feature KHÁC phụ thuộc bề mặt đó** (suy từ code/testcase cũ/requirement/coverage map). Cái không suy được → flag QA (Bước 3).

**Bước 3 — Sinh regression cho feature bị ảnh hưởng (SMOKE, không re-test full):**
- **Smoke flow chính**: mỗi feature bị ảnh hưởng có ≥1 TC xác nhận flow chính vẫn đúng sau thay đổi (vd thêm field vào entity → list/detail/export/search của feature khác vẫn đúng, không lỗi, không lệch cột).
- **Backward-compat**: bản ghi/dữ liệu CŨ (tạo trước thay đổi) vẫn hiển thị/xử lý đúng.
- **Contract**: consumer khác của endpoint không vỡ (field mới optional; KHÔNG đổi kiểu/bỏ field cũ mà không kiểm).
- **Shared rule/calc**: đổi validation/công thức chung → form/flow/report khác dùng lại vẫn đúng theo rule mới, không bị đổi ngoài ý muốn.

**Nguyên tắc:**
- **Theo tỉ lệ**: chỉ ripple khi thật sự đụng bề mặt chung; regression là SMOKE, KHÔNG nhân full-suite cho mọi feature.
- **Flag, không bịa**: feature nghi ảnh hưởng mà thiếu code/spec/testcase cũ để xác minh → ghi `Nghi ảnh hưởng — QA confirm` vào Coverage Gaps; KHÔNG dựng impact ảo, KHÔNG im lặng bỏ qua.
- Mỗi regression case trace rõ: `đụng <bề mặt chung> → ảnh hưởng <feature>`.
