# Báo cáo nhập gói QIG QA — Automation & RBT vào Test Automation Kit

> Bước cuối của `PROMPT_import_QIG_RBT_vao_kit.md`. Bảng quyết định từng mục ở
> [`MAPPING.md`](MAPPING.md). Phát hành kèm đợt này: **v2.3.0**.
>
> Gói nguồn: `QIG QA — Automation & RBT-v1.zip`, 65 file, giải nén vào `_import/` (gitignored, không
> commit). Lượt nhập chạy ngày 09/10/2026 trên nhánh `chore/mssql-migration-and-legacy-cleanup`.

## 1. Kết quả một dòng

Sáu hạng mục đều xong, mỗi hạng mục có máy kiểm đứng sau. **Hai luật của gói nguồn bị bỏ** vì chúng
chống lại luật đã có của kit, và **hai thứ không chép lại** vì kit đã có thứ mạnh hơn. Ba lỗi lộ ra trong
lúc làm, trong đó hai lỗi do chính máy của kit bắt.

| Hạng mục | Thứ được thêm | Máy kiểm |
|---|---|---|
| H1 Kỹ thuật thiết kế | 6 mã ISTQB thành tag ở cột `Tag` | `validate.js` (2 tầng) · `dim:coverage` |
| H2 Rubric 8 tiêu chí | `tc:review` chấm từng case | `scripts/qa/tc_review.js` |
| H3 Thứ tự nguồn oracle | `RULE_GLOBAL` mục mới · tag `[NeedsVerify]` | `design:gate` cảnh báo, `--publish` CHẶN |
| H4 Loại field và component | 18 loại field · 6 component | `dim:coverage` (2 tầng) · test drift config ↔ tài liệu |
| H5 Mode CHECKLIST | Sub-mode của `05_manual_quick.md` | `design:gate --mode checklist` (4 tiêu chí) |
| H6 Nhánh chạy tay | `manual-run/` never-auto | `manual:check` · ủy quyền `output_gate` |

## 2. Hai luật của gói nguồn BỊ BỎ

Đây là phần quan trọng nhất của báo cáo, vì nhập nguyên văn hai luật này sẽ làm kit **yếu đi** mà vẫn
trông như vừa được bổ sung.

### 2.1 "DOM thật thắng ảnh, ảnh thắng tài liệu"

Gói nguồn xếp thứ tự nguồn là `DOM > ảnh > tài liệu`, và nói rõ *"tài liệu nói một đằng ảnh một nẻo thì
ảnh thắng"*.

**Luật đó bị đảo.** DOM và ảnh **chính là app đang kiểm**. Lấy chúng làm `Kết quả mong đợi` là app bằng
app, đúng thứ `CLAUDE.md` mục 3 cấm. Làm theo thì mọi case hiển thị tự khẳng định mình đúng, và cả một lớp
bug lệch so với đặc tả vĩnh viễn không bắt được.

Bản của kit: ba hạng nguồn, trong đó ảnh và DOM **chỉ chốt sự thật quan sát** (nhãn, option, giá trị mặc
định, `disabled` hay không tick). Nhưng **không bỏ hạng 3**: ảnh độ phân giải thường không phân biệt nổi
`disabled` với không tick, nên có chỗ chỉ DOM mới chốt được. Lệch giữa hai hạng thì thành **câu hỏi
Ambiguity Gate** — chọn bừa bên nào cũng là quyết định nghiệp vụ mà QA không có quyền.

### 2.2 "Chỉ chụp ảnh khi FAIL"

`CLAUDE.md` mục 4 đòi ảnh hoặc video cho **mọi** case đã execute, cả PASS, và mọi step. Luật của gói nguồn
tiết kiệm được dung lượng, nhưng nó bỏ đúng thứ làm PASS kiểm toán được: một case PASS không có evidence
là một lời khai, không phải một kết luận.

Giữ luật của kit, và `output_gate --mode test-execution` là chỗ nó được thi hành — kể cả cho nhánh chạy
tay mới.

## 3. Hai thứ KHÔNG chép lại, vì kit đã có thứ mạnh hơn

| Của gói nguồn | Kit đã có | Vì sao không chép |
|---|---|---|
| Checklist `Status flow` | `state_machine` trong `knowledge/system/` | `state_machine` bắt **mọi** cặp không khai là bất hợp pháp, và đòi expected lấy từ `illegal_verified.expected` thay vì câu "bị chặn". Checklist song song chỉ tạo nguồn thứ hai để lệch nhau |
| Checklist `CRUD lifecycle` | `13b` + `23_db_persistence` | 4 trong 7 chặng đã có chỗ (double-submit, FAIL không đổi DB, xoá mềm, bảng liên quan). Chỉ nhập **ba chặng chưa chiều nào lo** |

Ba chặng đã nhập: nhánh Cancel của hộp xác nhận xoá · xoá bản ghi đang được tham chiếu · ba kiểu trùng ở
field unique.

## 4. Ba lỗi lộ ra trong lúc làm

Ghi lại vì mỗi lỗi để lại một test, và test đó là thứ giữ bài học.

### 4.1 Dò chữ để kiểm "luồng sống còn" — báo oan ngay fixture đầu tiên

Tiêu chí 2 của mode CHECKLIST là *"mọi luồng sống còn đều có ít nhất một mục P1"*. Bản đầu so tên luồng
với văn bản các mục P1. Nó **báo oan trên checklist hợp lệ đầu tiên**: luồng `Phân quyền` được phủ bởi mục
P1 *"Đăng nhập vai Phòng, mở URL thêm học sinh trực tiếp, bị chặn, về trang không có quyền"* — mục đó
không chứa chữ "phân quyền" nào.

Tên luồng là **khái niệm nghiệp vụ**, nhãn mục là **thao tác cụ thể**. Hai thứ cố ý khác chữ nhau, nên so
chữ sai từ tiền đề. Bản sửa bắt khai hai đầu: luồng phải là một `### Nhóm:` có thật, và nhóm đó phải có
mục P1. Máy đối chiếu hai lời khai, không suy diễn.

### 4.2 Cảnh báo luôn đúng là cảnh báo vô dụng

`manual_run_check.js` truyền mảng `tests` vào `output_gate` thay vì cả document, nên `doc.attestation`
vĩnh viễn `undefined` và cảnh báo *"chưa có attestation"* bắn ra ở **mọi** lượt, kể cả lượt đã khai đủ.
`output_gate` bắt được chuyện này ngay lần chạy fixture đầu.

### 4.3 Danh sách gõ tay thì lạc hậu ở lần dùng tiếp theo

`slash-commands.spec.ts` liệt kê cứng 4 command "chạm UAT phải nhắc xác nhận". Nhánh `manual-run` chạm
UAT bằng tay nhưng không nằm trong danh sách, nên **thoát** khỏi phép kiểm đó. Nay danh sách được **suy
ra** từ dấu hiệu "thân command có nhắc UAT", kèm một chốt mẫu số để phép kiểm không đi qua một cách rỗng.

Cùng file đó còn bắt một lỗi khác của lượt này: *"mỗi nhánh khai trong `branch_parity.json` phải có command
cùng tên"*. Comment của test viết sẵn từ trước: *"mai ai thêm nhánh thứ 5 mà quên điểm vào thì đỏ ngay"*.

## 5. Giới hạn ĐƯỢC TUYÊN BỐ

Ba chỗ máy làm **ít hơn** điều gói nguồn mô tả. Ghi ra để không ai tưởng đã được gác kín.

| Chỗ | Máy làm được | Máy KHÔNG làm được |
|---|---|---|
| Component | Gác xuất xứ của lời khai: có khai chưa, `n/a` có lý do chưa, lời khai có trái artifact không | **Không đếm được** "component X có mấy case". Component không phải tag, nó là nhóm hành vi rải trên nhiều chiều |
| Loại field | Bắt mã lạ (CHẶN) · so TỔNG số loại khai với TỔNG case `[Validation]` (cảnh báo) | **Không biết case nào thuộc loại nào.** `ui_conformance_check.js` kiểm kê TÊN field chứ không có thuộc tính LOẠI, nên inventory theo loại field không tồn tại — và suy loại từ tên nhãn là dò chữ |
| Luồng sống còn | Đối chiếu tên luồng đã khai với tên nhóm đã khai | **Không tự nhận ra** luồng nào là sống còn. Xem 4.1 |

Một chỗ nữa, thuộc thiết kế chứ không phải thiếu sót: cửa `[NeedsVerify]` đặt ở **publish**, không ở
Phase 1. Tag đó sinh ra để tồn tại trong lúc thiết kế — nó là cách người viết nói *"chỗ này tôi chưa có
bằng chứng"*. Chặn sớm là **cấm người ta thừa nhận**, và cái họ sẽ làm là gỡ tag thay vì đi tìm bằng
chứng: mất tín hiệu, mà bộ TC lại trông sạch hơn thực tế.

## 6. Hai chỗ dọn kèm

Không dọn thì chính lượt nhập này tạo ra đúng cái nó đang chặn ở chỗ khác.

- **`PII_PATTERNS` về một nguồn** ở `scripts/qa/lib/output_rules.js`. Trước đó `explore_session.js` tự
  viết cặp regex đó, và bản đầu của `manual_run_check.js` là bản chép tay **thứ ba**. Hai bản chép tay thì
  sớm muộn lệch nhau, và nhánh nào sửa sau sẽ âm thầm gác lỏng hơn.
- **Danh sách command chạm UAT suy ra thay vì gõ tay** (xem 4.3). Đo trước khi đổi: 5 command nhắc UAT, cả
  5 đều đã nhắc xác nhận, nên cách suy không làm đỏ gì đang xanh.

## 7. Số đo sau lượt nhập

Đo trên **worktree sạch ở HEAD**, không đo trên cây làm việc: cây làm việc đang có hơn 240 file chưa
track và chúng thổi mọi con số lên.

| Phép đo | Trước (v2.2.0) | Sau (v2.3.0) |
|---|---|---|
| Máy kiểm trong `GATES.md` | 79 (55 CHẶN) | **80 (56 CHẶN)** |
| Spec được track (`ci:scope`) | 56 | **59** |
| Test hạ tầng (`tests/fe/infra`) | 664 | **710** |
| File được track | 478 | **488** |
| Nhánh trong `branch_parity.json` | 4 | **5** |
| Slash command | 9 | **10** |
| Thuật ngữ trên trang thư viện | 208 | **209** |

Token của 5 file chiều bị sửa ở H4: tổng **6.3k lên 9.1k** (`doc_budget.js`, ngưỡng đọc-trực-tiếp 8.0k).
Không file nào tới ngưỡng nên **không tách file con**. Phần phải trả thật là 1 đến 2 file mỗi task, vì mỗi
task chỉ nạp những chiều mình khai `required`.

Test mới của lượt này: 11 (H1) · 14 (H2) · 7 (H3) · 12 (H4) · 20 (H5) · 14 (H6) — **78 test**.

## 8. Còn lại

- **`PROMPT_giam_token_kit.md` chưa bắt đầu.** Nó cần một task thật có transcript Phase 1 và Phase 2 làm
  mốc đo trước khi cắt, và hiện chưa có `TASK_KEY` nào được chỉ định. Lưu ý một căng thẳng thật: H4 cộng
  thêm 2.8k token vào các file chiều, đi ngược mục tiêu của prompt đó.
- **Chưa tag `v2.3.0`.** `version_check.js` ĐẠT ở bản 2.3.0 nhưng chưa chạy từ tag, nên phần kiểm khớp
  tag còn bỏ qua.
- Gói nguồn còn một số mục đã quyết **BỎ** từ bước mapping, xem [`MAPPING.md`](MAPPING.md) mục 2.
