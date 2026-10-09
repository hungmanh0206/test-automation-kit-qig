# Manual-run — Chạy tay case `Manual-only` (Never-auto)

> Entry point nhánh phụ Manual-run. Chỉ chạy khi **user yêu cầu tường minh**. Ranh giới và luật ở
> [`manual-run/reference.md`](reference.md). Rule non-negotiables ở `CLAUDE.md`, đã auto-load.

## Mục đích

Chạy nốt những case mà Phase 2 đã ghi `SKIP_SETUP` vì khai `[manual]`, để chúng có **verdict thật** thay
vì nằm mãi ở trạng thái chưa chạy. `SKIP_SETUP` là lời khai *"chưa chạy"*, không phải kết luận.

## Điều kiện chạy (BẮT BUỘC)

1. User yêu cầu rõ ràng một lượt chạy tay, nêu task và tập case.
2. Bộ TC canonical có mặt ở `<TASK_OUTPUT_DIR>/test-cases/`, và case định chạy **đã khai `[manual]`**.
3. Có môi trường và account test hợp lệ từ `profiles/<TASK>/task.env`.
4. Xác nhận trước mỗi lượt chạm UAT. Nhánh này chạm UAT bằng tay nên rule đó áp nguyên.

Case chưa khai `[manual]` thì **dừng**. Sửa lời khai ở Phase 1 kèm lý do, hoặc mở
`reports/capability-request.md` để xin hook. Không chạy tay rồi khai ngược lại.

## Workflow

0. **Lấy danh sách case `[manual]`.** Đọc ô Tiền điều kiện của bộ canonical, lọc dòng mở đầu bằng
   `[manual]`. Ghi ra danh sách kèm lý do đã khai, để biết mình đang chạy gì và vì sao nó không tự động được.
1. **Mở sổ phiên** `<TASK_OUTPUT_DIR>/manual-run/session.md` theo khuôn dưới. Bốn trường bắt buộc, điền
   trước khi chạy chứ không điền sau.
2. **Lập kế hoạch mở rộng**: `TASK_ENV=profiles/<TASK>/task.env npm run expansion:plan`. Chạy tay **không**
   miễn mục 3 của `CLAUDE.md`. Trục nào không áp được bằng tay thì ghi lý do, đừng bỏ im lặng.
3. **Chạy từng case**, theo đúng các bước trong ô `Các bước thực hiện`. Mỗi step một ảnh, highlight element
   đang kiểm, mask PII khách. Case nhiều thao tác thì **quay video**.
4. **Kết luận theo oracle của case**, lấy từ ô `Kết quả mong đợi`. Không phán theo cảm nhận, và không lấy
   chính giao diện làm chuẩn đúng sai.
5. **FAIL thì rerun 2 đến 3 lần** loại flaky và loại lỗi setup, rồi phân tầng `failureLayer`. Chỉ tầng
   `product_bug` và `api_bug` được log Backlog, và phải qua Bug Claim Gate.
6. **Ghi kết quả** vào `<TASK_OUTPUT_DIR>/test-results/testcase-status.json`. Khuôn dùng chung với Phase 2,
   không có khuôn riêng cho chạy tay. File phải có khối `attestation` ở mức gốc, năm cờ:
   `oracleSource` · `executed` · `allEvidenceAttached` · `failuresClassified` · `rerunDone`. Thiếu khối đó
   thì `output_gate` cảnh báo, vì nó là chỗ người chạy tự khai để gate đối chiếu lại.
7. **Kiểm phiên**: `npm run manual:check` để xem trước, rồi `npm run manual:check:enforce` trước khi đẩy.
8. **Trước finalize**: `npm run self-review:enforce -- --task <TASK_KEY>`.
9. **Ghi về cột Result**: `node scripts/convert_excel/merge_execution_status.js <xlsx> <status.json>`, đúng
   như lượt automation.

## Khuôn `session.md`

Bốn trường này là thứ máy đọc. Thiếu trường nào thì lượt chạy không truy được về ai, trên build nào.

```markdown
# Lượt chạy tay — <TASK_KEY>

- Người chạy: Nguyễn Văn A
- Ngày: 09/10/2026
- Môi trường: UAT, https://uat.example.gov.vn
- Build / Version: 2026.10.08-rc2

## Case trong lượt này

| TC ID | Lý do khai `[manual]` | Verdict |
|---|---|---|
| CSDL_HS_TC_088 | Captcha không có đường tắt trong UAT | PASS |

## Ghi chú

Chỗ nào lệch so với dự kiến thì ghi ở đây, kèm TC ID.
```

Placeholder không tính là đã điền. `TBD`, `n/a`, dấu gạch, hay `______` đều bị bắt.

## Rules

- **Evidence cho mọi case đã execute, cả PASS**, và mọi step. Ảnh hoặc video, không phải log hay JSON.
  Luật bên ngoài chỉ chụp khi FAIL là luật **bị bỏ**, xem `reference.md`.
- Verdict chỉ lấy trong `.agent/config/verdict_taxonomy.json`. Không tự đặt.
- Không mutate dữ liệu UAT ngoài phạm vi case. Không dựng state bằng DB.
- Không ghi secret hay PII khách vào bất kỳ file output nào, kể cả sổ phiên.
- Không sinh case mới ở nhánh này. Thấy vùng đáng dò thì chuyển sang [`exploratory/`](../exploratory/reference.md).
- Không nới oracle để case đi qua. Không phán được thì ghi `BLOCKED`, không ghi `PASS`.

## Outputs

| Output | Vị trí |
|---|---|
| Sổ phiên | `<TASK_OUTPUT_DIR>/manual-run/session.md` |
| Kết quả | `<TASK_OUTPUT_DIR>/test-results/testcase-status.json` |
| Evidence | `<TASK_OUTPUT_DIR>/test-results/artifacts/` |
