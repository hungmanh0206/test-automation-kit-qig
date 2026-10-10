# Đo lại chi phí một lượt chạy thật — runbook

> Đây là việc còn thiếu duy nhất của `PROMPT_giam_token_kit.md` mục 4.2. Nó **phải chạy ở một PHIÊN MỚI**,
> và lý do nằm ở mục 1. Mọi thứ khác đã chuẩn bị sẵn, nên lượt đo chỉ còn làm theo mục 3.

## 1. Vì sao không đo được ở phiên đang mở

`npm run token:audit -- --list` phân loại phiên bằng số lượt ghi vào `outputs/*/tasks/`. Phiên làm đợt
token-diet này được chính nó xếp là **`SỬA KIT`**, 7.327 message, context trung bình **519,4k mỗi message**.

Chạy task trong phiên đó hỏng theo ba đường, và cả ba đều kiểm được:

1. `token:audit` xếp nó vào rổ `SỬA KIT`. Đó đúng là lỗi đã mắc ở lần đo mốc thứ nhất, và nó cho ra con
   số sai hẳn một bậc.
2. Nó bắt đầu từ 519k context có sẵn, nên đo được chi phí **của phiên bảo trì**, không phải của Phase 2.
3. H1 — hạng mục cần đo — quy định *"mỗi phase một phiên"*. Đo nó từ trong một phiên 7.327 message là đo
   đúng thứ ngược lại.

## 2. Tiền đề đã kiểm, ngày 10/10/2026

| Thứ | Trạng thái |
|---|---|
| `profiles/CSDL-9003/task.env` | có |
| `outputs/CSDL/tasks/CSDL-9003/test-cases/` | có `quan_ly_hoc_sinh.md` và `.xlsx` |
| `preflight_gate --mode phase2 --task CSDL-9003` | **ĐẠT** |
| Mốc cũ để so | `docs/token-diet/baseline.dynamic.json`, phiên `b124ddca` |

## 3. Các bước

**Mở một phiên Claude Code MỚI** ở gốc repo, rồi:

```bash
# 1. Xác nhận chạm UAT trước — CLAUDE.md mục 2 đòi xác nhận cho TỪNG lượt chạm.
#    Lượt này chạy thật trên QEMIS UAT.

# 2. Chạy Phase 2 của task mốc, đúng đường đang dùng.
#    /phase2 CSDL-9003

# 3. Xong thì ghi bàn giao rồi đo. Lệnh đo:
npm run token:audit -- --list
#    Tìm phiên vừa chạy, xác nhận cột "Loại" là CHẠY TASK rồi mới đo nó:
npm run token:audit -- --transcript <phien-vua-roi>.jsonl --json
npm run secret:scan
```

Nếu cột `Loại` **không** phải `CHẠY TASK` thì dừng: hoặc lượt chạy chưa ghi vào `outputs/*/tasks/`, hoặc
phiên đó có lẫn việc sửa kit. Đo tiếp chỉ ra một con số không so được với mốc.

## 4. So với mốc nào

Mốc là phiên `b124ddca`, cùng task CSDL-9003:

| Phép đo | Mốc cũ | Lượt mới |
|---|---|---|
| message | 7.682 | |
| context trung bình mỗi message | 494,6k | |
| cache read | 3.752,3M | |
| output | 8.787,8k | |
| `bash khác` | 583,9k (72,7%) | |
| `output gate` | 54,2k (6,7%) | |
| `Read` vào tài liệu kit | 2 / 405 lượt Read | |

**Dòng đáng nhìn nhất là `context trung bình mỗi message`.** H1 là hạng mục duy nhất đụng tới nhân tử đó.
Nếu Phase 1 và Phase 2 chạy hai phiên riêng thì đây là chỗ số phải tụt; nếu nó không tụt thì H1 chưa thật
sự được áp dụng, chứ không phải H1 vô dụng.

Dòng `output gate` nên tụt theo H5 (đo rời đã ra −83%). Dòng `bash khác` nên tụt theo H4 nếu lượt mới dùng
`results:summary` và rerun chọn lọc.

## 5. Ghi kết quả vào đâu

Điền bảng mục 4 vào `docs/token-diet/AFTER.md` mục 2, chỗ hiện đang để trống có chủ ý. Rồi cập nhật
`REPORT.md` mục 2 và mục 9.

## 6. Lưu ý về so sánh

Hai lượt sẽ **không giống hệt nhau** về số case chạy, vì UAT đổi theo thời gian và một số case phụ thuộc
dữ liệu. Nên so **tỉ lệ** (phần trăm theo nguồn) và **context trung bình mỗi message**, đừng so tổng tuyệt
đối. Tổng tuyệt đối phụ thuộc số case, mà số case thì không kiểm soát được giữa hai lượt.
