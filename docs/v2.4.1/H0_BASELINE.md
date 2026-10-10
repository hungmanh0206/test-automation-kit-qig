# H0 — MỐC: số LƯỢT shell của một lượt chạy task

> Bảng bên dưới SINH TỪ PHÉP ĐO, không chép tay. Làm lại: `node scripts/qa/token_audit.js --mau`.

## Vì sao đếm số LƯỢT, không đếm độ dài output

Chi phí một lượt chạy tỉ lệ với (context mỗi message) × (số message). Mỗi lượt gọi tool là một
message, và mỗi message kéo theo cả context — đo được ~510k token mỗi message, cache-hit 98,5%.
Nên một lệnh in ra 5 dòng và một lệnh in ra 500 dòng tốn gần như nhau.

Hệ quả: cắt độ dài output là tối ưu đúng chỗ không tốn. Muốn giảm thật thì phải giảm SỐ LƯỢT.

## Hai lỗi đo đã mắc khi dựng bảng này

Ghi lại vì cả hai đều làm bảng nói dịu hẳn đi, và cả hai đều không tự lộ ra.

1. **Gom theo cờ làm phân mảnh.** Bản đầu giữ tới 3 tên cờ trong mẫu, nên `npx playwright test`
   vỡ thành hàng chục mẫu và 59,6% số lượt rơi vào ô "mẫu còn lại". Nay có thêm bảng **gom thô**
   (bỏ cờ, bỏ `cd`) để đếm theo VIỆC chứ không theo cách gọi. Bảng có cờ vẫn giữ, vì nó cho biết
   cùng một việc đang được gọi bằng bao nhiêu kiểu khác nhau.
2. **Tiền tố env thành mẫu lệnh.** `TASK_ENV=profiles/<T>/task.env npx playwright test ...` bị xếp
   vào mẫu `TASK_ENV=profiles/<T>/task.env`, nên **822 lượt `playwright test` biến mất khỏi bảng**.
   Tệ hơn: mỗi task một đường profile nên nó còn tự chia thành nhiều mẫu. Nay bóc cả ba dạng:
   `VAR=v`, `$env:VAR='v';`, `export VAR=v;`.

## Số đo

[token-audit] top mẫu lệnh trên 5 phiên CHẠY TASK (048dfbb4, 4970d32b, 6422c2d9, b124ddca, fe6d3da6) — 11781 lượt shell

| Lượt | % shell | Mẫu lệnh (đã bỏ đối số) |
|---|---|---|
| 914 | 7.8% | `grep` |
| 903 | 7.7% | `node -e` |
| 636 | 5.4% | `sed` |
| 489 | 4.2% | `for` |
| 392 | 3.3% | `printf` |
| 328 | 2.8% | `cd && node -e` |
| 219 | 1.9% | `ls` |
| 217 | 1.8% | `python` |
| 200 | 1.7% | `cd && grep` |
| 169 | 1.4% | `&&` |
| 148 | 1.3% | `cd && sed` |
| 144 | 1.2% | `cd && python` |
| 143 | 1.2% | `cat` |
| 129 | 1.1% | `npx playwright test --config --reporter --workers` |
| 123 | 1.0% | `cd && npx playwright test --config --reporter` |

| Lượt | % shell | Việc (gom thô: bỏ cờ và bỏ cd) |
|---|---|---|
| 1442 | 12.2% | `node -e` |
| 1190 | 10.1% | `grep` |
| 825 | 7.0% | `sed` |
| 822 | 7.0% | `npx playwright test` |
| 731 | 6.2% | `for` |
| 662 | 5.6% | `python` |
| 482 | 4.1% | `printf` |
| 419 | 3.6% | `rm` |
| 413 | 3.5% | `ls` |
| 370 | 3.1% | `&&` |
| 339 | 2.9% | `npx tsc` |
| 337 | 2.9% | `cat` |
| 233 | 2.0% | `echo` |
| 217 | 1.8% | `until` |
| 153 | 1.3% | `Get-Content` |
| 3146 | 26.7% | _(725 việc còn lại)_ |

ĐÁNG LẼ DÙNG TOOL CHUYÊN DỤNG: 3334 lượt (28.3% số lượt shell)
   1476 → Read
   1299 → Grep
    559 → Glob
  Mỗi lượt shell là một message kèm cả context. Đi vòng qua Bash không rẻ hơn, chỉ khó đếm hơn.
| 6627 | 56.3% | _(1513 mẫu còn lại)_ |

1528 mẫu khác nhau trên 11781 lượt — trung bình mỗi mẫu lặp 7.7 lần.

## Một đính chính: lệnh của kit KHÔNG phải chỗ tốn

`docs/token-diet/BASELINE.md` từng ghi `output_gate` 354 lượt và `md_to_xlsx` 119 lượt trên 4 task, và
tôi đã định bó chúng lại. Đo lại bằng chính `--mau` thì con số do AGENT gọi là **90** và **51**. Cộng
toàn bộ lệnh của kit lại được **248 lượt trong 11.781, tức 2,1%**.

Hai chỗ số cũ phóng lên:

- Hook `gate_on_write.js` tự chạy `output_gate` sau mỗi lần ghi, và số đó bị cộng vào. Nhưng hook
  `exit 0` IM LẶNG khi đạt, nên nó **không tốn token nào** của context chính. Nó chỉ tốn thời gian máy.
  Debounce hook vì vậy KHÔNG phải một phép giảm token, và đã bỏ khỏi danh sách việc.
- Số cũ đếm trên 4 phiên với cách gom khác, không bóc tiền tố env nên một phần lượt bị xếp nhầm chỗ.

Kết luận ngược với dự định ban đầu: **bó gate lại không phải đòn bẩy chính.** Vẫn làm `phase2:check` vì
nó bớt 4 message ở đúng chỗ ai cũng chạy, và vì chạy rời rất dễ chạy thiếu một bước rồi tưởng đã kiểm
hết. Nhưng trần của nó là 2,1%, và tài liệu này nói thẳng con số đó.

## Đọc bảng này ra việc gì

| Hạng mục | Lượt | Cách chữa | Trạng thái |
| --- | --- | --- | --- |
| `grep`/`sed`/`cat`/`ls` qua Bash | 3.334 (28,3%) | **Đổi tool** — đã có Grep, Read (offset/limit), Glob | luật + số đo mỗi lượt |
| `node -e` một-dòng | 1.442 (12,2%) | **Bó** — việc lặp lại thì thành npm script, đừng viết lại mỗi lượt | chưa làm |
| `npx playwright test` | 822 (7,0%) | **Gộp** — `npm run rerun:failed` chạy đúng case đỏ | máy đã có (v2.4.0) |
| `python` một-dòng | 662 (5,6%) | **Bó** — như `node -e` | chưa làm |
| `for`/`until` vòng lặp shell | 948 (8,0%) | **Gộp** — lệnh nhận `--dir` thay vì lặp từng file | một phần (`output_gate --dir`) |
| `npx tsc` | 339 (2,9%) | **Bó** — gộp vào một lệnh kiểm chung | chưa làm |
| lệnh gate của kit | 248 (2,1%) | **Bó** — `npm run phase2:check` gộp 5 bước thành 1 | xong |

Con số đáng làm nhất là dòng đầu: **28,3% số lượt shell là việc đã có tool chuyên dụng**. Đây không
phải chuyện kiểu cách — mỗi lượt shell là một message kèm cả context, nên đi vòng qua Bash không rẻ
hơn, chỉ khó đếm hơn.

## Cảnh báo tự động

`npm run token:audit` nay in cảnh báo khi một lượt CHẠY TASK vượt ngưỡng trong
`.agent/config/prompt_budget.json` mục `nguong_mot_luot` (2.400 lượt shell · 520k context trung bình
mỗi message), kèm đề xuất cụ thể. Đây là CẢNH BÁO chứ không CHẶN: nó đo một lượt ĐÃ CHẠY RỒI, và
chặn lúc đó không cứu được gì. Nhưng phải kêu, vì một lượt 2.800 lượt shell trông y như một lượt 300
nếu không ai đếm.

## Chưa đo được

Bảng này đếm trên 5 phiên CHẠY TASK đã có trong transcript. Nó KHÔNG trả lời được "sau khi sửa thì
giảm bao nhiêu" — câu đó cần một lượt chạy task MỚI sau khi các thay đổi đã vào, theo runbook
`docs/token-diet/DO-LAI.md`. Trước khi có số đó, mọi con số "đã giảm" chỉ là ước tính.
