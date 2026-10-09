---
name: tc_reviewer
description: Chấm chất lượng bộ testcase theo rubric 8 tiêu chí (0-2 điểm mỗi tiêu chí) — máy chấm 6, người chấm 2. Dùng trước khi publish, hoặc khi nhận bàn giao một bộ TC không phải mình viết.
---

# TC Reviewer — trả lời được câu "bộ này dùng được chưa"

## Purpose

Kit đã có nhiều gate chặn từng lỗi rời: Expected mơ hồ, step gộp range, thiếu tag cách dựng. Nhưng không
chỗ nào trả lời câu người review hỏi đầu tiên: **bộ này dùng được chưa**. Thiếu câu đó thì chất lượng bộ TC
là cảm nhận của người đọc gần nhất, mà cảm nhận không so sánh được giữa hai lượt, hai task, hai người.

| Không có rubric | Có rubric |
|---|---|
| "Bộ này trông ổn" | 212 case, trung bình 96,3%, 46 case thiếu oracle-ref |
| Người sau review lại từ đầu | Đọc `reports/tc-review.md`, biết ngay chỗ nào chưa đạt |
| Chất lượng trôi mà không ai thấy | So được hai lượt bằng cùng một thước |

## Chạy

```bash
npm run tc:review                  # chấm, in bảng, ghi reports/tc-review.md
npm run tc:review:enforce          # thêm: dưới ngưỡng ⇒ exit 1
```

Ngưỡng ở [`.agent/config/tc_review.json`](../../../config/tc_review.json). Đổi ngưỡng phải kèm số đo trên
bộ TC thật, đừng đổi theo cảm giác.

## Tám tiêu chí, và ai chấm cái nào

| # | Tiêu chí | Máy đo được tới đâu |
|---|---|---|
| 1 | Rõ ràng | **Đủ** — bước đánh số, không gộp range, không dồn từ 3 hành động vào một bước |
| 2 | Expected đo được | **Đủ** — tái dùng `vagueExpectedLines` và `looksTautology` đang chạy |
| 3 | Độc lập | **Đủ** — có tag cách dựng, không tham chiếu case khác chạy trước |
| 4 | Data cụ thể | **Đủ** — ô Dữ liệu Test không còn placeholder |
| 5 | Truy vết | **Đủ** — có oracle-ref để truy ngược về rule |
| 6 | Đúng trọng tâm | **Một phần** — máy bắt dấu hiệu thô ở tiêu đề. Case verify nhiều mục tiêu rời nhau thì người chấm |
| 7 | Actor và Context | **Một phần** — máy bắt actor chung chung. Actor có đúng vai trò thật hay không thì người chấm |
| 8 | Kỹ thuật thiết kế | **Đủ** — dùng kết quả của `design_techniques.json` |

## Ba luật nền, cả ba chống cùng một kiểu tự lừa

**Tái dùng, không viết lại.** Tiêu chí 2 và 4 gọi thẳng luật đang chạy ở `output_rules.js`. Viết lại là có
hai nguồn, và hai nguồn sẽ trôi khỏi nhau. Lúc đó `tc:review` nói một đằng, `gate:gen-testcase` nói một
nẻo, và không ai biết tin bên nào.

**"Máy không phán được" không phải "đạt".** Tiêu chí 6 và 7 gắn cờ `AI`: máy chấm phần đo được, phần còn
lại để người hoặc agent chấm. Cộng điểm cho thứ chưa ai nhìn là cách nhanh nhất biến máy chấm thành máy
phát chứng chỉ.

**Hai tầng.** Bộ chưa dùng tag kỹ thuật thì tiêu chí 8 ghi `n/a` và không tính vào mẫu số, thay vì cho 0
điểm. Cho 0 là phạt bộ cũ vì một luật ra đời sau nó, và một gate phạt oan sẽ bị tắt trong một ngày.

## Khác gì so với gói nguồn

| Gói nguồn | Ở đây | Vì sao |
|---|---|---|
| Thang điểm tuyệt đối trên 16 | **Tỉ lệ** | Mẫu số đổi khi tiêu chí 8 là `n/a`. Giữ thang tuyệt đối thì mọi bộ cũ tự mất 2 điểm |
| Truy vết bằng cột `REQ ID` | **oracle-ref** `BR-`/`SM-`/`UI-` | Kit không thêm cột, và oracle-ref truy ngược được về `knowledge/domain/` |
| Sáu thành phần ISTQB thành 6 cột mới | Đọc Actor và Context **từ `Tiền điều kiện`** | Template 10 cột đã publish hàng nghìn case, thêm cột là phá hợp đồng |

## Đọc kết quả

`<TASK_OUTPUT_DIR>/reports/tc-review.md` có bảng từng TC kèm **trích nguyên văn** chỗ chưa đạt, và danh sách
TC trùng (cùng bước, cùng dữ liệu) để cân nhắc gộp.

Điểm thấp ở tiêu chí 5 thường không phải case viết dở, mà là **rule chưa có mã để neo**. Lúc đó việc cần làm
là ghi rule vào `knowledge/domain/` trước, không phải sửa case.

## Anti-pattern

- Chạy `tc:review` rồi sửa case cho qua ngưỡng mà không đọc chỗ nó chỉ ra. Điểm lên, chất lượng không đổi.
- Coi tiêu chí gắn cờ `AI` là đã đạt vì máy không kêu.
- Hạ ngưỡng trong config để lượt này xanh. Ngưỡng đổi phải kèm số đo, và ghi lý do.
