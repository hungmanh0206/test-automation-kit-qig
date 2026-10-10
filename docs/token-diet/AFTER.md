# Token diet — đo lại, và một kết quả đi ngược kỳ vọng

> Mục 4 của `PROMPT_giam_token_kit.md`. Số sinh bằng `npm run prompt:budget` và `npm run token:audit`,
> ghi ở `after.static.json`. So với `BASELINE.md`.

## 0. Kết quả thẳng

**Số đo TĨNH không giảm. Nó tăng nhẹ.** Đó không phải thất bại. Nhưng phải nói trước, vì nó đi ngược
cách người ta hay đọc một đợt "giảm token".

| Điểm vào | Chuỗi tĩnh TRƯỚC | SAU | Đổi |
|---|---|---|---|
| `/phase1` | 142,4k | 143,4k | **+1,0k** |
| `/phase2` | 112,5k | 113,4k | +0,9k |
| `/rerun` | 120,4k | 121,4k | +1,0k |
| `/partial-rerun` | 122,3k | 123,0k | +0,7k |
| `/publish` | 50,7k | 51,2k | +0,5k |

Lý do: H1 đến H6 **thêm hướng dẫn**, gồm bàn giao giữa phase, con trỏ load_map, cách đọc bản tóm tắt.
Và **không hạng mục nào cắt chữ**. H7 với H8 là hai hạng mục duy nhất làm việc cắt, cả hai đã hoãn và
thu hẹp có lý do đo được.

`BASELINE.md` đã nói trước ở mục 0: *"một lượt chạy task thật chỉ `Read` 0 đến 4 file tài liệu của
kit"*. Chuỗi tĩnh **chưa bao giờ là đòn bẩy**. Đo lại chỉ để xác nhận nó vẫn không phải.

## 1. Chỗ thật sự đổi

| Phép đo | Trước | Sau | Cách đo |
|---|---|---|---|
| Output gate trên bộ 265 case thật | 10.696 byte | **1.811 byte** | `design_gate --dir` có và không có `--compact` |
| Hướng dẫn BẮT BUỘC của `/phase1` | **không đo được** | **29,8k** | `prompt:budget --enforce` theo `bat_buoc` của `load_map` |
| Ảnh evidence rỗng ruột | **không máy nào bắt** | bắt 12/1.935 ảnh | `evidence_quality.js`, ngưỡng từ số đo |
| Band của case đã execute | **0/388 tra được** | **288 band high, 9 không tra được** | `expansion:audit` sau khi vá `t.id` thành `t.tcId` |
| Case thiếu band | xuống tầng mỏng nhất, im lặng | `expansion:plan --enforce` **CHẶN** | `thieuBand()` |
| Ngân sách hướng dẫn | không có | **CHẶN** ở CI cả hai remote | `prompt:budget --enforce` |

Hai dòng giữa đáng chú ý hơn phần token. Chúng là **lỗ hổng đúng-sai**, không phải lỗ hổng chi phí.
Ảnh trắng dùng làm evidence cho case PASS. Và một máy đo band báo rỗng mà kết quả trông yên tâm.

## 2. Chi phí một lượt chạy thật — CHƯA đo lại

Prompt mục 4.2 yêu cầu chạy lại **cùng task mốc** rồi `token:audit` trên transcript mới. **Chưa làm**.
Lý do là một ràng buộc, không phải quên: lượt đó **chạm UAT**, và `CLAUDE.md` mục 2 đòi xác nhận trước
mỗi lượt chạm. Chưa có xác nhận thì chưa chạy.

Runbook đầy đủ ở [`DO-LAI.md`](DO-LAI.md), kèm lý do nó phải chạy ở một **phiên mới**.

Nên bảng trước-sau cho `context trung bình mỗi message` và `cache read` hiện **để trống có chủ ý**.
Mốc cũ đã có trong `baseline.dynamic.json`: 4 lượt, context 494 đến 515k mỗi message. Chạy lại chỉ
cần một lệnh.

Dự đoán, ghi ra để sau đối chiếu được chứ không phải để tin. H1 là hạng mục duy nhất đụng tới nhân tử
`context × số message`. Nếu Phase 1 và Phase 2 tách phiên thật thì đó là chỗ số sẽ đổi. H4 và H5 giảm
khối lượng kết quả tool, tức giảm tốc độ phình chứ không reset context.

## 3. Chất lượng không tụt

| Phép kiểm | Kết quả |
|---|---|
| `tests/fe/infra` | **768 xanh · 1 đỏ · 2 bỏ qua** trên tổng 771 (xem đính chính dưới bảng) |
| `gate-selftest` + `mutation-check` | 35/35 xanh — gate cũ **vẫn biết đỏ** sau khi sửa |
| `design:gate` trên bộ 265 case của CSDL-9003 | 0 CHẶN · 35 cảnh báo, **không đổi kiểu** so với trước |
| `dim:coverage` cùng bộ | 265 testcase · 20 chiều · manifest CÓ, không vi phạm mới |
| `writing:lint --docs` | 102/102 trong mốc |
| `gate:policy` · `gates:index:check` · `library:drift` | ĐẠT, đo trong worktree sạch ở HEAD |

> **ĐÍNH CHÍNH 10/10/2026.** Dòng `tests/fe/infra` ở bảng trên từng ghi **"771/771 xanh"**. Sai hai tầng.
>
> `771` là TỔNG số test, không phải số xanh. Đo lại trên worktree sạch ở đúng tag `v2.4.0`:
> **768 xanh · 1 ĐỎ · 2 bỏ qua**. Test đỏ là `dimension-threshold.spec.ts` — gate "lý do n/a đã bị bác"
> không chặn được vì `.agent/config/na_reasons_rejected.json` chưa bao giờ được `git add`.
>
> Vì sao lọt: số cũ đo trên CÂY LÀM VIỆC, nơi file đó đang nằm untracked ngay cạnh nên gate vẫn chạy.
> Trên bản phát hành thì không có nó. Đây đúng là lớp lỗi mà v2.4.1 đi sửa, và nó xuất hiện ngay trong
> báo cáo của chính đợt trước đó.
>
> Chốt chống tái phát: `release:verify` nay CHẠY THẬT `tests/fe/infra` bên trong gói đã giải nén, và
> `tests/fe/infra/config-presence.spec.ts` đối chiếu ba nguồn độc lập (cây git · danh sách đóng gói ·
> `scripts/**`). Số đo sau khi sửa: **15/15 bước release:verify ĐẠT · 716 xanh · 26 bỏ qua · 0 đỏ trong gói**.


**Không gate nào bị nới.** Ngược lại, lượt này **thêm** đường chặn: ảnh rỗng ruột, thiếu band, ngân sách
hướng dẫn, và `n/a` component không lý do.

Một ngoại lệ duy nhất phải nói rõ: `bandOf` giữ nguyên mặc định `low` khi thiếu cả hai cột. Tôi đã thử
đổi sang `high` và `expansion-oracle.spec.ts` đỏ, vì spec đó khoá hành vi cũ kèm lý do thật. Nên việc
gác chuyển sang gate: `expansion:plan --enforce` từ chối chạy.

## 4. Hạng mục nào đóng góp bao nhiêu

| Hạng mục | Đóng góp đo được | Ghi chú |
|---|---|---|
| H5 `--compact` | **−83%** output gate (10.696 xuống 1.811 byte) | Con số chắc chắn nhất của cả đợt |
| H4 bản tóm tắt | chưa đo trên lượt chạy thật | Trần lý thuyết ~620k, cần mục 2 |
| H1 bàn giao theo phiên | chưa đo | Nhân tử chi phối, cần mục 2 |
| H10 độ sâu theo band | gián tiếp | Ít trục nghĩa là ít lượt shell |
| H2 load_map | ~0 token trực tiếp | Giá trị là biến 124k chưa-phân-loại thành lời khai |
| H9 ngân sách | 0 hôm nay | Chốt chống trôi |
| H3 ảnh rỗng ruột | 0 token | Lỗ hổng đúng-sai, không phải chi phí |
| H6 model routing | ảnh hưởng GIÁ | Chưa xác minh end-to-end, cần phiên mới |
| H7 tách thẻ chạy | **không làm** | Trần 3,4k, rủi ro mất luật cao |
| H8 bỏ lớp trùng | **thu hẹp thành không làm** | Xem mục 5 |

## 5. H8 sau khi đo lại: không còn gì đáng làm

Kế hoạch đã duyệt là *thu hẹp H8, chỉ gộp vài chỗ trùng thật*. Đo lại bằng `prompt:budget --dup`: 106 câu
trùng, tổng token của các **bản sao** là 2.961.

Soi ra thì phần lớn là **boilerplate đầu file chiều**. Ví dụ *"Tách khỏi 02_gen_testcases.md"* ở 15
file, và *"Chỉ mở RULE_GLOBAL.md ở đúng mục cần"* ở 7 file. Những dòng đó **có việc của chúng**: mỗi
file chiều được đọc **độc lập**, nên bỏ đi là người đọc mất ngữ cảnh.

Hai chỗ trùng thật sự đáng gộp cộng lại **143 token**. Đổi 143 token trên một context 500k, giá là một
lần sửa hai file prompt đang chạy. Không đáng, nên **không làm**. Ghi lại ở đây để lần sau không ai đo
lại từ đầu.

## 6. Còn lại

1. **Chạy lại task mốc** (CSDL-9003) rồi `token:audit` — cần xác nhận chạm UAT.
2. **Xác minh subagent** bằng `/agents` ở một phiên mới (H6).
3. **H7** còn để ngỏ. Quyết lại bằng số sau khi có mục 1. Nếu context tụt còn 150k thì 3,4k của H7
   thành 2,3%, và lúc đó nó đáng hơn hôm nay.
