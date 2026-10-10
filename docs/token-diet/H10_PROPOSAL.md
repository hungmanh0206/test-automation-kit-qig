# H10 — Độ sâu theo band rủi ro: đề xuất, kèm một điều kiện tiên quyết

> Checkpoint của `PROMPT_giam_token_kit.md` §H10. Đây là thay đổi **quy trình**, không phải tối ưu kỹ
> thuật, nên nó dừng ở đây chờ bạn quyết. Chỉ phần được duyệt mới làm.
>
> Số trong tài liệu này đo bằng máy trên **950 case thật** của 4 task (CSDL-9001 đến 9004), cộng
> `npm run expansion:audit` trên 6 task đã execute.

## 0. Kết luận trước

Đề xuất **duyệt một phần**, và **một điều kiện tiên quyết phải xử trước**:

| Hàng của H10 | Đề xuất | Vì sao |
|---|---|---|
| Mở rộng 5 trục theo band | **Duyệt, sau điều kiện tiên quyết** | Tiết kiệm thật nhưng vừa phải: 69% case đang là band High nên không đổi gì |
| Rerun khi FAIL theo band | **KHÔNG duyệt** | Đây không phải độ sâu, đây là **bộ lọc flaky**. Cắt nó là đổi nghĩa của verdict |
| Evidence theo band | **Giữ nguyên luật** | Ảnh đo được **0,0%** token. Cắt nó không tiết kiệm gì mà mất khả năng kiểm toán |

**Điều kiện tiên quyết:** đã xử trong lượt này — hai lỗi thật ở mục 2.1 và 2.2. Mục 2.0 ghi lại một
điểm mà bản đầu của tài liệu này nói sai.

## 1. Band hiện phân bố thế nào

Đo trên 950 case của 4 task:

| Band | Số case | Tỉ lệ | H10 đề xuất mở rộng |
|---|---|---|---|
| High | 654 | 68,8% | Đủ 5 trục, **không đổi** |
| Medium | 254 | 26,7% | 5 trục xuống 1 đến 2 trục |
| Low | 42 | 4,4% | Không mở rộng |

Nên mức tiết kiệm của hàng *Mở rộng* là: **4,4% case bỏ hẳn mở rộng**, cộng **26,7% case giảm từ 5 trục
xuống 1 đến 2**. Phần lớn bộ case không đổi gì. Con số này quan trọng vì nó nhỏ hơn hẳn cảm giác ban đầu:
H10 nghe như một cú cắt lớn, nhưng 69% case đang ở band cao nhất.

## 2. ĐIỀU KIỆN TIÊN QUYẾT — hai lỗi thật, và một chỗ tôi nói sai

> **Sửa lại bản đầu của tài liệu này.** Bản đầu nêu ba điểm và gọi cả ba là lỗ hổng. Điểm thứ nhất
> **sai**, xem 2.0. Hai điểm còn lại đúng, và cả hai đã được vá trong lượt này.

### 2.0 Chỗ tôi nói sai: cột `Mức độ rủi ro` vắng là QUYẾT ĐỊNH, không phải lỗ hổng

Bản đầu xếp chuyện này thành điều kiện tiên quyết. Số đo thì đúng: 950/950 case có ô `risk` rỗng.
Nhưng kết luận sai.

`RULE_GLOBAL.md` mục 204 ghi rõ từ **21/08/2026**: cột đó bị **bỏ có chủ ý**. Severity là thuộc tính của
**bug**, không của testcase. Chấm nó lúc viết case là đoán trước hậu quả của một lỗi chưa xảy ra.

Quyết định đó kèm phép đo: *"đo trên 1977 case toàn repo: bỏ cột này làm đổi band 0 case. `Ưu tiên`
một mình đủ quyết band."*

Tôi đọc "100% ô risk rỗng" rồi kết luận là gap. Tôi không tra luật canonical trước. Đúng lớp lỗi mà kit
có một luật riêng cho nó: tra một nguồn rồi kêu "không có neo".

### 2.1 Lỗi thật thứ nhất: `expansion:audit` đo RỖNG mà kết quả trông yên tâm

`readCases()` đọc `t.id`, nhưng model canonical phơi ra `t.tcId`. `t.id` là `undefined`, nên map case
luôn rỗng và **mọi** case rơi vào `unknown`. Hệ quả: mọi dòng trong bảng "NẾU SIẾT TIẾP" đều hiện
`0/6 đỏ`. Máy dùng để quyết định có siết gate hay không đang báo "siết cũng chẳng đỏ ai".

Trước và sau khi vá, cùng dữ liệu:

| | Trước | Sau |
|---|---|---|
| case band high | **0** | **288** |
| case không tra được band | **388** | **9** |
| chưa lập kế hoạch (CHẶN, luật ĐANG ÁP) | 0/6 đỏ | **1/6 đỏ** → CSDL-9003 |
| có case high mà 0/5 trục | 0/6 đỏ | **1/6 đỏ** → CSDL-9003 |
| bắt buộc trục persist | 0/6 đỏ | **2/6 đỏ** → CSDL-9003, CSDL-9004 |

Chỗ đáng lo nhất là dòng đầu, không phải hai dòng "siết tiếp". Đó là luật **đang áp**, và nó đáng lẽ
phải đỏ. CSDL-9003 có **164 case đã execute, 118 band high, 0/5 trục mở rộng**, và không kế hoạch nào.

Đây cũng là lời giải cho chuyện "hai máy nói ngược nhau" ở bản đầu. Không phải bất đồng thiết kế.
Chỉ là một bug đọc sai tên trường.

### 2.2 Lỗi thật thứ hai: thiếu band thì rơi xuống tầng MỎNG NHẤT

`scripts/lib/expansion/depth.js` trước đây kết thúc bằng `return 'low'`. Comment ngay đó ghi
*"gồm cả trường hợp 2 cột đều rỗng: mặc định mỏng nhất"*. Theo bảng H10, band Low nghĩa là **không mở
rộng, rerun một lần, chỉ ảnh kết quả cuối**. Một ô trống không được phép quyết ba điều đó.

Và chính header file đó đã ghi một lỗi **cùng họ** ngày 21/08/2026: thiếu khoá `critical` trong
`PRIO_RANK` làm 28 case ưu tiên cao nhất tụt từ high xuống low, *"sai đúng chiều nguy hiểm nhất"*.

Đã đổi mặc định sang `high`, tức chiều an toàn. Thêm `thieuBand()` để `expansion:plan` **kêu** thay vì
im lặng.

Bán kính ảnh hưởng đo được là **0**. Trên 950 case thật, phân bố band không đổi một case nào
(654 · 254 · 42), và 0 case đi vào nhánh mặc định. Đây là lưới chắn cho lần sau, không phải vá nợ cũ.

## 3. Rủi ro sót bug — KHÔNG định lượng được, và đó là một kết quả

Prompt yêu cầu dùng `expansion:audit` cùng lịch sử `knowledge/bugs` để xem bug từng bắt được đến từ trục
nào, ở band nào. Đo xong thì **dữ liệu đó không tồn tại**:

| Nguồn | Trạng thái |
|---|---|
| `knowledge/bugs/` | **Rỗng**, chỉ có `.gitkeep` |
| `knowledge/historical_execution/` | 16 file, nhưng chỉ có pass/fail **tổng theo module**. Không có trục, không có band |
| `expansion:audit` | 388 case execute, **0 case** tra được band |

Theo đúng luật của kit, mẫu số không có thì kết luận không được phát biểu. Nên tôi **không** đưa ra con số
"rủi ro sót bug là X%". Thay vào đó nói rõ: **một nửa của phép đánh đổi này đang trống.** Ai duyệt H10 hôm
nay là duyệt dựa trên phần tiết kiệm đã đo, và phần rủi ro chưa đo.

Có một mẩu dữ liệu gián tiếp, và nó không trấn an: `expansion:audit` cho thấy trong 6 task đã execute, chỉ
**1 task đủ 5/5 trục**, 3 task 1/5, 2 task 0/5. Nghĩa là mở rộng 5 trục **vốn đã ít xảy ra**. Cắt theo
band sẽ hợp thức hoá tình trạng đó chứ không tạo ra nó — nhưng cũng nghĩa là phần "tiết kiệm" của hàng
*Mở rộng* trên thực tế nhỏ hơn con số lý thuyết ở mục 1.

## 4. Vì sao KHÔNG duyệt hàng Rerun

Rerun 2 đến 3 lần không phải độ sâu kiểm thử. Nó là **bộ lọc flaky**, và nó đứng trước Bug Claim Gate.
Cắt xuống một lần đổi nghĩa của verdict theo hai hướng, cả hai đều tệ:

- Flaky một lần đỏ thành **FAIL thật** rồi thành bug báo oan. Dev mất thời gian, và lần sau họ tin gate ít hơn.
- Lỗi thật chập chờn mà lần duy nhất đó xanh thì thành **PASS**, và bug đi thẳng ra production.

Tiết kiệm đổi lại: 42 case band Low bớt 1 đến 2 lượt chạy, 254 case band Medium bớt 0 đến 1 lượt. Đó là
lượt chạy Playwright, không phải token của agent, và bản tóm tắt của H4 đã cắt phần output của chúng.

`verdict_taxonomy.json` là nguồn duy nhất của verdict. Sửa số lần rerun theo band là sửa nguồn đó, nên nó
không thuộc phạm vi một đợt giảm token.

## 5. Vì sao Evidence giữ nguyên luật

Đây cũng là phương án mặc định mà prompt đề nghị, và số đo xác nhận: **ảnh và video chiếm 0,0%** khối lượng
kết quả tool ở **cả bốn** lượt chạy task đã đo. Agent hiện không mở ảnh ra xem, nên không có token nào để
tiết kiệm ở đây.

Sau H3 thì máy tự chụp, nên chi phí token của agent vẫn là 0. Cắt evidence của band Low chỉ đổi được dung
lượng ổ đĩa, mà mất đúng thứ làm PASS kiểm toán được: `CLAUDE.md` mục 4 đòi ảnh hoặc video cho **mọi** case
đã execute, cả PASS. Giữ nguyên.

## 6. Nếu bạn duyệt phần Mở rộng thì tôi làm gì

1. Xử điều kiện tiên quyết ở mục 2: một nguồn band, `expansion:audit` báo đúng phân bố, và mặc định khi
   thiếu band đổi từ `low` sang `high` hoặc CHẶN.
2. Khai bảng độ sâu vào `depthPolicy` của `.agent/config/risk_model.json` — nơi `risk:gate` đã đọc.
   `expansion:plan --enforce` đọc từ đó, không khai thêm nguồn thứ hai.
3. Sửa `RULE_GLOBAL.md` mục 5 trục cho khớp, và viết spec cho **từng band** cộng một kiểm-âm: case thiếu
   band KHÔNG được rơi xuống tầng mỏng nhất.
4. Đo lại bằng `token:audit` trên CSDL-9003 rồi ghi vào `docs/token-diet/AFTER.md`.

## 7. Ba câu hỏi cần bạn trả lời

1. **Duyệt hàng Mở rộng** (sau điều kiện tiên quyết) không?
2. **Giữ Rerun 2 đến 3 lần** cho mọi band, đúng như đề xuất không? Nếu bạn muốn cắt thì cắt tới đâu, và
   chấp nhận hệ quả nào ở mục 4?
3. **Giữ nguyên luật Evidence** không? Prompt chỉ cho đổi luật 4 của `CLAUDE.md` khi bạn chọn rõ.
