# Token diet — đo mốc, và đề xuất đổi thứ tự ưu tiên

> Bước 1 của `PROMPT_giam_token_kit.md`. Đây là **checkpoint**: chưa sửa file prompt nào, chỉ thêm hai máy
> đo và tài liệu này. Duyệt kế hoạch xong mới sang H1.
>
> Máy: `npm run prompt:budget` (tĩnh) · `npm run token:audit` (động). Hệ số 3,2 ký tự mỗi token, cùng hệ số
> `doc_budget.js`. Số sinh ra ở `baseline.static.json` và `baseline.dynamic.json`, không gõ tay.

## 0. Kết luận trước, số sau

Số đo động **không ủng hộ** thứ tự H1 đến H11 trong prompt. Ba hạng mục nhắm vào chỗ gần như không tốn
token. Hạng mục tốn nhất thì prompt chỉ chạm tới một phần.

| Prompt kỳ vọng | Số đo thật |
|---|---|
| Hướng dẫn nạp mỗi lượt là 45 đến 57k token | Đúng nếu đọc hết. Nhưng một lượt chạy task thật chỉ `Read` **0 đến 4 file** tài liệu của kit |
| AI mở ảnh evidence ra xem nên tốn token | Ảnh và video chiếm **0,0%** ở cả bốn lượt đo |
| Tách đoạn "Vì sao" ra sẽ nhẹ đi | Các file prompt nặng chỉ có **~1% dòng** mang dấu hiệu lý-do. Trần của H7 là **3,4k** |
| Bỏ lớp trùng sẽ nhẹ đi | Bản sao trùng ý trên toàn chuỗi chỉ **2,96k token**. Trần của H8 là **~3k** |

Thứ tốn thật là **kết quả lệnh shell đọng trong context**, 62 đến 75% khối lượng. Nó nhân lên theo số
message, vì mỗi message mang lại cả context.

## 1. Đo tĩnh — `npm run prompt:budget`

| Điểm vào | File trong chuỗi | Bắt buộc | Có điều kiện | Chưa phân loại | Đoạn người đọc | TỔNG nếu đọc hết |
|---|---|---|---|---|---|---|
| `/phase1` | 56 | 5,7k | 13,4k | 123,3k | 3,4k | **142,4k** |
| `/partial-rerun` | 47 | 5,6k | 31,0k | 85,7k | 2,6k | **122,3k** |
| `/rerun` | 48 | 5,7k | 34,5k | 80,2k | 2,6k | **120,4k** |
| `/phase2` | 43 | 5,6k | 24,6k | 82,3k | 2,6k | **112,5k** |
| `/publish` | 14 | 5,9k | 0k | 44,8k | 0k | **50,7k** |
| `/ui-debug` | 12 | 5,6k | 0k | 36,9k | 1,3k | **42,5k** |
| `/manual-run` | 7 | 5,7k | 0k | 9,9k | 0,2k | **15,6k** |
| `/explore` | 4 | 5,6k | 0k | 4,6k | 0,1k | **10,2k** |
| `/gates` · `/preflight` | 1 | 5,6k | 0k | 0k | 0k | **5,6k** |

Luật nền auto-load mọi phiên: **5,4k** (`CLAUDE.md` 0,9k và `core_rules.md` 4,5k).

**Cột "Chưa phân loại" KHÔNG phải cột bắt buộc.** Máy chỉ gắn nhãn *có điều kiện* khi CÂU chứa con trỏ có
dấu hiệu điều kiện, kiểu "chỉ khi", "nếu", "khi task có". Phần lớn con trỏ không viết điều kiện ra. Nên
chúng rơi vào đây. Mặc định chúng là bắt buộc sẽ làm con số đẹp lên một cách giả tạo.

Đây chính là việc H2 (`load_map.json`) phải làm. Nó biến 123,3k chưa phân loại thành lời khai máy đọc được.

File nặng nhất, và số đo khớp với ước lượng trong prompt (lệch dưới 15%):

| ~token | Trong đó "người đọc" | File | Prompt ước lượng |
|---|---|---|---|
| 13,9k | 0,9k | `prompt_templates/phase1/02_gen_testcases.md` | ~16k |
| 13,1k | 0k | `prompt_templates/run_phase2_template.md` | ~15k |
| 11,3k | 0k | `prompt_templates/phase2/04_execute_fe_playwright.md` | ~12k |
| 8,3k | 0k | `prompt_templates/run_phase1_template.md` | ~9,5k |
| 8,1k | 0k | `prompt_templates/phase2/08_log_bug_backlog.md` | ~8,4k |
| 6,5k | 0k | `prompt_templates/phase2/05_execute_api_playwright.md` | ~7,4k |
| 4,5k | 0k | `.agent/rules/core_rules.md` | ~5,3k |

Cột giữa là chỗ quan trọng: **ba file nặng nhất có 0k đoạn "người đọc"**. Chúng nặng vì **mệnh lệnh**, không
vì lý do dài dòng. Đo thêm bằng tay trên ba file đó: 10, 6 và 5 dòng mang dấu hiệu lý-do trên 556, 407 và
379 dòng, tức **1%**.

### Trùng ý giữa các lớp

106 câu dài từ 60 ký tự xuất hiện ở hai file trở lên. Tổng token của các **bản sao** là **2.961**. Phần lớn
là dòng boilerplate đầu file chiều, kiểu *"Tách khỏi 02_gen_testcases.md 14/08/2026"* (15 file) và *"Chỉ mở
RULE_GLOBAL.md ở đúng mục cần"* (7 file). Có vài chỗ trùng thật đáng gộp. Đó là cách đọc tag `[<method>]`
của Tiền điều kiện (75 token, 2 file), và luật setup layer dùng chung (68 token, 2 file).

## 2. Đo động — `npm run token:audit`

Bốn lượt chạy task thật, **n = 4 chứ không phải 1**:

| Phiên | Task | message | cache-hit | Context TB mỗi message | `bash khác` | `output gate` | Ảnh và video | `Read` tài liệu kit |
|---|---|---|---|---|---|---|---|---|
| 048dfbb4 | CSDL-9001 | 7.510 | 98,6% | ~500,6k | 599,7k (63,0%) | 60,0k (6,3%) | 0,1k (0,0%) | **4 / 313** |
| 6422c2d9 | CSDL-9002 | 7.609 | 98,5% | ~515,2k | 697,2k (62,0%) | 48,4k (4,3%) | 0k (0,0%) | **0 / 305** |
| b124ddca | CSDL-9003 | 7.682 | 98,7% | ~494,6k | 583,9k (72,7%) | 54,2k (6,7%) | 0,1k (0,0%) | **2 / 405** |
| fe6d3da6 | CSDL-9004 | 6.121 | 99,0% | ~497,7k | 556,8k (75,2%) | 66,1k (8,9%) | 0k (0,0%) | **0 / 117** |

Chi tiết lượt mốc **CSDL-9003**: input 21,1k · output 8.787,8k · cache read **3.752,3M** · cache create
47.521,4k. Lượt gọi tool: Bash **2.799** · Edit 469 · Read 405 · Write 388 · Monitor 215.

### Token đi đâu, trên lượt mốc

| Nguồn | ~token kết quả | % |
|---|---|---|
| `bash khác` | 583,9k | **72,7%** |
| `output gate` | 54,2k | 6,7% |
| ghi file | 47,9k | 6,0% |
| `Read file` | 39,3k | 4,9% |
| `output playwright test` | 36,3k | 4,5% |
| Monitor | 20,3k | 2,5% |
| Drive MCP | 7,5k | 0,9% |
| tìm kiếm | 6,0k | 0,8% |
| ảnh và video | 0,1k | **0,0%** |

Đo thêm: `bash khác` **phân bố phẳng**, không có lệnh nào to. Gom theo từ khoá đầu lệnh trên cả bốn lượt
thì lệnh nặng nhất là `cd` (1.983 lượt, 616k, trung bình 0,3k mỗi lượt), rồi `node` (1.179 lượt, 373k),
`sed` (627 lượt, 336k). **Không lệnh nào vượt 0,6k mỗi lượt.** Nên chặn trần output từng lệnh sẽ không
được gì: vấn đề là **số lượt**, không phải độ dài một lượt.

### Cơ chế nhân lên

Cache-hit 98,5 đến 99,0% nghĩa là gần như toàn bộ context được đọc lại ở **mỗi** message. Context trung
bình ~500k, số message 6.121 đến 7.682. Nên chi phí tỉ lệ với **context × số message**. Cả hai nhân tử đều
do khối lượng kết quả tool quyết định.

Cắt 10k token tài liệu đổi được 2% của 500k. Cắt 300 lượt shell đổi được cả context lẫn số message.

## 3. Đề xuất thứ tự mới, kèm trần đo được

Prompt cho phép đề xuất thứ tự khác nếu số đo động nói khác. Nó nói khác.

| Thứ tự | Hạng mục | Nhắm vào | Trần ĐO ĐƯỢC | Ghi chú |
|---|---|---|---|---|
| 1 | **H1** phiên riêng mỗi phase, bàn giao bằng file | context × message, tức cả hai nhân tử | Chưa đo trực tiếp, nhưng là nhân tử chi phối | Cắt phiên là cách duy nhất hạ `context TB` khỏi mốc 500k |
| 2 | **H4** tóm tắt kết quả, rerun chọn lọc, bớt snapshot | `bash khác` cộng `playwright test`: 62 đến 75% | **~620k mỗi lượt** | Hạng mục đáng giá nhất trong danh sách. Nên mở rộng thành "bớt SỐ LƯỢT shell", không chỉ tóm tắt output |
| 3 | **H5** gate in gọn `--compact` | `output gate` 4,3 đến 8,9% | **~54k mỗi lượt** | Rõ ràng, rủi ro thấp, có spec tương đương chứng minh không mất vi phạm |
| 4 | **H10** độ sâu theo band | số lượt chạy và rerun | Gián tiếp nhưng lớn | Checkpoint riêng, cần duyệt. Ít trục mở rộng nghĩa là ít lượt shell |
| 5 | **H2** `load_map.json` | `Read file` 4,9% | ~39k | Giá trị chính **không phải** token: nó biến 123,3k "chưa phân loại" thành lời khai máy đọc được |
| 6 | **H9** gate ngân sách token | chống trôi về sau | 0 ngay | Giữ lại thành quả, đáng làm dù không giảm gì hôm nay |
| 7 | **H3** máy chụp và kiểm evidence | ảnh: **0,0% token** | **~0 token** | Vẫn nên làm, nhưng **vì lý do khác**: hiện agent phải tự viết code chụp, và `screenshot: 'only-on-failure'` trái luật 4 của `CLAUDE.md`. Đó là lỗi đúng-sai, không phải lỗi token |
| 8 | **H6** chọn model theo việc | giá, không phải số token | Chưa đo | Cần kiểm cú pháp `.claude/agents/` của bản Claude Code đang dùng trước |
| 9 | **H7** tách thẻ chạy và tài liệu lý do | đoạn "người đọc" 3,4k | **~3,4k** | **Đề xuất HOÃN.** Trần 3,4k, mà cái giá là `rule_parity.js` cộng rủi ro mất luật khi tách 5 file nặng |
| 10 | **H8** bỏ lớp trùng | bản sao 2,96k | **~3k** | **Đề xuất thu hẹp**: chỉ gộp vài chỗ trùng thật (tag `[<method>]`, setup layer), không tái cấu trúc cả bốn lớp |
| 11 | **H11** làn nhẹ Phase 2 | tuỳ chọn | - | Giữ nguyên là đề xuất giấy cho user quyết |

### Vì sao hoãn H7 và H8, nói rõ để phản biện được

Hai hạng mục đó **không sai**. Chúng làm prompt dễ đọc hơn, và điều đó có giá trị. Nhưng prompt đặt chúng
dưới nhãn "giảm token". Theo số đo, chúng giảm **tối đa 6,4k** trên một context 500k, tức **1,3%**.

Cái giá là viết `rule_parity.js`, trích danh mục luật từ 5 file nặng, tách đôi từng file, rồi chứng minh
không mất luật nào. Điều kiện DỪNG của chính prompt ghi: *"`rule_parity` báo mất luật mà không tìm được
chỗ đặt lại"* thì dừng. Tức prompt đã biết đây là chỗ rủi ro cao nhất.

Đề xuất: làm H1 đến H6 trước, **đo lại**, rồi quyết H7 và H8 bằng số mới. Sau H1 và H4, nếu context tụt
xuống còn 150k thì 6,4k thành 4,3%. Lúc đó H7 đáng làm hơn hôm nay.

### Một hạng mục prompt KHÔNG có, mà số đo đòi

**H0 — giảm SỐ LƯỢT shell, không chỉ độ dài output.** 2.799 lượt Bash trong một lượt task, phân bố phẳng.
Ba việc cụ thể đo được ngay:

- `output_gate.js` bị gọi **354 lượt** trên bốn task, `md_to_xlsx.js` **119 lượt**. Gộp thành một lượt theo
  thư mục, như `design_gate --dir` đang làm.
- Gom các lệnh đọc nhỏ (`sed -n`, `cat`, `wc`) thành một lượt, hoặc dùng `Read` có `offset`/`limit`.
- `cd` xuất hiện ở 1.983 lệnh ghép. Không phải chi phí tự thân, nhưng nó đánh dấu chỗ nhiều lệnh ghép nhỏ.

Hạng mục này cùng họ với H4 nên gộp vào H4 được. Điều kiện là phạm vi H4 phải mở rõ ra, không chỉ
"tóm tắt kết quả test".

## 4. Giới hạn của chính phép đo này

Nói trước, để không ai dùng số sai chỗ.

| Giới hạn | Hệ quả |
|---|---|
| Phân loại *bắt buộc* và *có điều kiện* dựa vào dấu hiệu văn bản ở CÂU chứa con trỏ | Cột "chưa phân loại" lớn. Phải soi tay khi làm H2, đừng tin cột đó là bắt buộc |
| Nhận dạng đoạn "người đọc" dựa vào tiêu đề mục | Kit viết lý do trong block comment và văn xuôi giữa dòng, nên số 3,4k là **sàn**, không phải trần tuyệt đối |
| `bash khác` là một rổ gộp | Biết tổng, chưa biết lệnh nào bỏ được. Đã gom theo từ khoá đầu lệnh nhưng đó vẫn là nhãn thô |
| Bốn lượt đo đều của một người, một dự án, một giai đoạn kit | Không suy ra được cho dự án khác |
| Transcript bị nén nhiều lần trong phiên | `context TB mỗi message` là mức sau nén, không phải mức đỉnh |

Phép đo **không** ghi nội dung transcript ra file. `baseline.dynamic.json` chỉ có số đếm, tên file và tên
tool. Đã chạy `npm run secret:scan` sau khi ghi.

## 5. Cần duyệt gì

1. **Thứ tự mới** ở mục 3, đặc biệt việc hoãn H7 và việc thu hẹp H8.
2. **Mở phạm vi H4** thành "giảm số lượt shell", gộp H0 ở trên vào.
3. **Giữ H3** dù trần token bằng 0, vì nó sửa một chỗ trái luật 4 của `CLAUDE.md`
   (`screenshot: 'only-on-failure'`).
4. Task mốc để đo lại sau khi sửa: **CSDL-9003**. Lượt đo lại sẽ chạm UAT nên sẽ xin xác nhận riêng.
