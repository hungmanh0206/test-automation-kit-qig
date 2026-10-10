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

**Điều kiện tiên quyết:** band phải **đọc được**. Hiện nó không đọc được một cách đáng tin, xem mục 2.

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

## 2. ĐIỀU KIỆN TIÊN QUYẾT — band chưa đọc được đáng tin

Ba phép đo, cùng chỉ về một chỗ.

**Một.** Bộ canonical **không còn cột `Mức độ rủi ro`**. Đo: **950/950 case (100%)** có ô `risk` rỗng.
Header thật của bộ CSDL-9003 là 11 cột và không có cột rủi ro nào. Nên band hiện suy **hoàn toàn** từ
`Ưu tiên`.

**Hai.** `scripts/lib/expansion/depth.js:36` ghi rõ hành vi khi thiếu dữ liệu:

> `return 'low';  // gồm cả trường hợp 2 cột đều rỗng: mặc định mỏng nhất`

Hôm nay chưa cháy: 950/950 case có `Ưu tiên` hợp lệ, **0 giá trị lạ**. Nhưng nếu H10 được duyệt thì một ô
`Ưu tiên` để trống sẽ **âm thầm** đưa case xuống band Low, và theo bảng H10 nghĩa là: không mở rộng, rerun
một lần, chỉ ảnh kết quả cuối. Một ô trống không được phép quyết ba điều đó.

**Ba.** Hai máy đang **nói ngược nhau** về band của cùng tập case. `bandOf()` đọc Markdown ra
high 654 · medium 254 · low 42. `expansion:audit` đọc Excel canonical lại báo:

```
Tổng: 388 case đã execute · 0 case band high · 388 case không tra được band
```

Tức ở đường Excel, **100% case không tra được band**. Chưa rõ vì tra sai khoá hay vì Excel thiếu cột, và
phải biết trước khi gắn một chính sách độ sâu lên nó.

**Việc phải làm trước, rẻ:** chọn một nguồn band duy nhất và làm nó đọc được, rồi `expansion:audit` phải
báo đúng phân bố thay vì 100% không tra được. Ngoài ra, đổi mặc định khi thiếu dữ liệu: **thiếu band thì
coi như High**, hoặc CHẶN bắt khai. Mặc định mỏng nhất là mặc định sai hướng cho một gate an toàn.

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
