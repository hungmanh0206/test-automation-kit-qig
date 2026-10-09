# Prompt Phase 1 - Manual QUICK (sinh nhanh testcase thủ công)

> Chạy: `Đọc file này và chạy với TASK_KEY=<TASK_KEY>`. Rule non-negotiables ở `CLAUDE.md`, đã auto-load. Digest ở `.agent/rules/core_rules.md`.
> Chỉ mở `RULE_GLOBAL.md` **ở đúng mục cần**, vì mỗi gạch đầu dòng của digest đã ghi sẵn `§`. Đừng nạp cả file.
> Nhánh nhẹ, thân thiện với manual. KHÔNG thay pipeline chính (01 đến 04). Dùng khi cần bộ TC để **chạy tay**.

# Khi nào dùng

- Requirement đã RÕ (không có mơ hồ Critical/High) và cần bộ testcase để **QA chạy tay** nhanh, không nhắm automation Phase 2.
- Smoke/khám nhanh một màn/flow; hoặc case bản chất manual (`Manual-only`: thao tác vật lý, file thật rất lớn, tương tác ngoài tầm automation).

**KHÔNG dùng khi:** requirement còn mơ hồ → chạy pipeline chính (Ambiguity Gate ở `phase1_01`); hoặc cần TC đủ chi tiết cho automation → dùng `02_gen_testcases.md`.

# Nguyên tắc (giữ governance)

- Vẫn **không placeholder** ở Dữ liệu Test. Expected phải **cụ thể và trích từ tài liệu**, không lấy từ build, để chống tautology.
- Tiền điều kiện ghi dạng **thao tác tay** mà QA tự dựng được (KHÔNG cần factory/hook/Setup Strategy contract của automation).
- Expected viết **gọn, đủ để người đọc phán PASS hay FAIL**. Không cần chi tiết từng micro-step như bản automation.
- Vẫn phủ đủ 4 loại (Positive/Negative/Boundary/Edge) ở mức hợp lý theo risk; không cần vét 16 dimension như automation.
- Nếu trong lúc viết phát hiện mơ hồ Critical/High → DỪNG, chuyển pipeline chính (Ambiguity Gate). Manual QUICK không bỏ qua checkpoint.

# Template manual (có cột thực thi tay)

| TC ID | Nhóm chức năng | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước | Kết quả mong đợi | Ưu tiên | Kết quả thực tế | Pass/Fail | Ghi chú |
|---|---|---|---|---|---|---|---|---|---|---|

- `Nhóm chức năng`: business flow (như pipeline chính: `Đăng nhập`, `Tạo`, `Thanh toán`...).
- Ba cột `Kết quả thực tế`, `Pass/Fail` và `Ghi chú` thì **để trống khi sinh**. QA điền lúc chạy tay.
- Header file ghi: `Tester: ______  Ngày chạy: ______  Môi trường/URL: ______`.
- TC ID format như chính: `[PROJECT]_[MODULE]_TC_[NNN]`.

# Workflow

1. Xác nhận requirement rõ (nếu mơ hồ Critical/High → dừng, chuyển pipeline chính).
2. Sinh TC theo template manual ở trên, phủ Positive/Negative/Boundary/Edge theo risk.
3. Lưu Markdown: `<TASK_OUTPUT_DIR>/test-cases/<basename>_manual.md`.
4. Export Excel: `node scripts/convert_excel/md_to_xlsx.js <...>_manual.md <...>_manual.xlsx`. File xuất ra có sẵn cột thực thi để QA điền.
5. Ghi 1 dòng vào `task.md`: đường dẫn bộ manual + ghi rõ đây là **manual QUICK** (không phục vụ Phase 2 automation trừ khi được nâng cấp qua `02_gen_testcases.md` + `tc_validator`).

# Outputs

| Output | Vị trí |
|---|---|
| Testcase manual Markdown | `<TASK_OUTPUT_DIR>/test-cases/<basename>_manual.md` |
| Testcase manual Excel (có cột thực thi) | Cùng thư mục, cùng basename |
| Task tracking | `<TASK_OUTPUT_DIR>/task.md` |

# Sub-mode CHECKLIST (rà tay nhanh, KHÔNG phải bộ testcase)

Thêm 09/10/2026. Đây là **sub-mode của file này**, không phải pipeline mới. Dùng khi cần rà nhanh để
quyết định *có đi tiếp được không*, chứ không cần bộ case để chạy lặp lại.

| Dùng mode nào | Khi nào |
|---|---|
| QUICK (phần trên) | Cần bộ case QA chạy tay, có tiền điều kiện và các bước, chạy lại được ở lượt sau |
| CHECKLIST | Cần rà một lượt rồi kết luận đi hay dừng. Mỗi mục một dòng, verify trong 2 phút |

**Nguồn vào, ưu tiên TC-based.** Đã có bộ TC thì **rút gọn từ bộ đó**, gom các case cùng chủ đề thành một
mục và giữ cột `TC ID liên quan` để truy ngược. Chưa có thì REQ-based, rút mục từ requirements cộng bảng
loại field và bảng component ở `dimensions/`. Sinh lại từ đầu khi đã có bộ TC là tự tạo bản lệch với bộ gốc.

## Bốn loại checklist và quy mô

Ngưỡng lấy từ [`.agent/config/checklist_types.json`](../../.agent/config/checklist_types.json). Bảng dưới
là bản cho người đọc, và có test đối chiếu hai bên để không lệch nhau.

| Loại | Mục đích | Số mục | Chạy tay |
|---|---|---|---|
| **Smoke** | Xác nhận build chạy được, luồng sống còn không vỡ | 10 đến 20 | khoảng 15 phút |
| **Post-hotfix** | Rà vùng ảnh hưởng của bản vá, cộng vùng lân cận | 5 đến 15 | khoảng 10 phút |
| **Regression** | Rà toàn bộ một module trước khi bàn giao | 20 đến 40 | khoảng 45 phút |
| **Release-readiness** | Rà toàn hệ thống trước khi lên production | 30 đến 60 | khoảng 60 phút |

Vượt `max` là **CHẶN**: checklist dài thì mất đúng công dụng rà nhanh, người chạy bỏ giữa hoặc tick cho
xong. Tách theo module, hoặc hạ scope rồi ghi rõ phần đã cắt. Dưới `min` chỉ cảnh báo.

## Khuôn output

Khuôn này là thứ máy đọc. Đổi tên cột hay bỏ khối nào thì gate không đọc được, nên giữ nguyên.

```markdown
**Luồng sống còn:** Đăng nhập · Thêm học sinh · Phân quyền

## <Tên module> — Checklist Smoke (10 mục · ~15 phút)

### Nhóm: Đăng nhập

| # | ✅ | Hạng mục kiểm tra | Kết quả kỳ vọng | Priority | REQ ID | TC ID liên quan |
|---|---|---|---|---|---|---|
| 1 | ☐ | Đăng nhập tài khoản quản trị trường | Vào màn Danh sách, góc phải hiện tên đơn vị | P1 | BR-01 | CSDL_HS_TC_001 |

## Component đã rà

| Component | Mục số | Không áp dụng vì |
|---|---|---|
| Data Table / List | 10 | — |
| Status flow | — | Màn này không có luồng duyệt trạng thái, đã rà ngày … |

## Ký nhận

| Môi trường | Build / Version | Người thực hiện | Ngày | Kết quả (Pass/Fail/Blocked) |
|---|---|---|---|---|
|  |  |  |  |  |
```

Bốn ràng buộc của khuôn:

1. **Dòng `Luồng sống còn:`** liệt kê các luồng sống còn, phân cách bằng dấu `·`. Mỗi luồng phải là một
   `### Nhóm:` có thật trong checklist.
2. **Ô tick để TRỐNG** (`☐`). Checklist xuất ra mà đã có dấu tick là kết quả bịa: chưa ai chạy mà đã có
   đáp án. Gate CHẶN.
3. **Bảng `Component đã rà`** phải có đủ 6 dòng theo
   [`.agent/config/ui_components.json`](../../.agent/config/ui_components.json). Mỗi dòng ghi số mục đã
   phủ, hoặc lý do không áp dụng dài từ 20 ký tự.
4. **Số mục ở tiêu đề phải khớp số dòng đếm được.** Đây là chỗ mẫu số trôi dễ nhất: sửa bảng rồi quên sửa
   tiêu đề, và báo cáo về sau lấy con số ở tiêu đề.

## Cách viết một mục

- **Một dòng, tối đa 20 từ**, bắt đầu bằng động từ. Thêm, Sửa, Xoá, Lọc, Xuất, Đăng nhập.
- **Verify được trong 2 phút** bởi người chưa đọc requirements.
- **Kỳ vọng phải quan sát được**: nhãn nút, chuỗi thông báo, URL, số dòng. Gate dùng lại đúng bộ từ cấm
  của `output_gate`, nên "hoạt động đúng" hay "hiển thị đúng" là CHẶN.
- **KHÔNG viết bước đánh số.** Mục cần hơn 3 thao tác mới verify được thì nó là testcase: tách ra, hoặc
  chuyển sang mode QUICK ở trên.
- **Dữ liệu cụ thể** ở mục phụ thuộc dữ liệu. Vẫn không placeholder, như phần trên của file này.

| Sai | Đúng |
|---|---|
| Kiểm tra chức năng học sinh hoạt động tốt | Thêm học sinh đủ ô bắt buộc, lớp 6A1 → hiện đầu lưới, đúng họ tên vừa nhập |
| Test phân quyền | Đăng nhập vai Phòng, mở URL thêm học sinh trực tiếp → bị chặn, về trang không có quyền |
| Kiểm tra validate ngày sinh | Nhập ngày sinh 31/02/2015 → hiện lỗi định dạng ngày, ô viền đỏ |

## Gate 4 tiêu chí

```bash
node scripts/qa/design_gate.js --mode checklist --file <checklist.md>
```

| # | Tiêu chí | Mức |
|---|---|---|
| 1 | **Verify được**: mọi mục có kỳ vọng quan sát được, không còn từ chung chung. Có Priority trong P1 P2 P3 | CHẶN |
| 2 | **Luồng sống còn đủ**: mỗi luồng đã khai là một Nhóm có thật, và nhóm đó có ít nhất 1 mục P1 | CHẶN |
| 3 | **Component đủ**: 6 component đều có dòng, kèm số mục hoặc lý do không áp dụng | CHẶN |
| 4 | **Đúng quy mô**: số mục trong ngưỡng của loại, và khớp số tự khai ở tiêu đề | CHẶN |

**Giới hạn của tiêu chí 2, nói trước để không ai tưởng máy làm hộ nhiều hơn thực tế.** Máy KHÔNG tự nhận ra
luồng nào là sống còn. Bản đầu của gate so tên luồng với văn bản các mục P1, và nó báo oan ngay trên
checklist hợp lệ đầu tiên: luồng "Phân quyền" được phủ bởi mục P1 "Đăng nhập vai Phòng, mở URL trực tiếp →
bị chặn", mà mục đó không chứa chữ "phân quyền". Tên luồng là khái niệm nghiệp vụ, nhãn mục là thao tác cụ
thể, hai thứ cố ý khác chữ nhau. Nên máy đối chiếu **tên nhóm**, tức lời khai ở cả hai đầu.

## Lưu ở đâu

| Output | Vị trí |
|---|---|
| Checklist Markdown | `<TASK_OUTPUT_DIR>/test-cases/<basename>_checklist.md` |
| Task tracking | `<TASK_OUTPUT_DIR>/task.md`, ghi rõ loại checklist và số mục |

Checklist **KHÔNG tính vào coverage automation**, và cũng không tính vào coverage của bộ TC. Nó là một lượt
rà, không phải một bộ case. Muốn nó thành case thì đi qua `02_gen_testcases.md` như phần Nâng cấp dưới đây.

# Nâng cấp lên automation (khi cần)

Bộ manual QUICK **chưa tính vào coverage automation**. Muốn tính: đưa qua `02_gen_testcases.md` (bổ sung Setup Strategy contract + expected chi tiết) và `tc_validator` như testcase thường.
