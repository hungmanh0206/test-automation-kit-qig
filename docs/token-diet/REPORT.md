# Token diet — báo cáo cuối

> Mục 6 của `PROMPT_giam_token_kit.md`. Chi tiết số liệu ở [`BASELINE.md`](BASELINE.md),
> [`AFTER.md`](AFTER.md) và [`H10_PROPOSAL.md`](H10_PROPOSAL.md). Phát hành kèm đợt này: **v2.4.0**.

## 1. Một dòng

Đợt này **không giảm được số đo tĩnh** — nó tăng 1k. Thứ giảm thật là **output của gate (−83%)**, và thứ
có giá trị hơn cả token là **ba lỗ hổng đúng-sai** tìm thấy trong lúc đi đo.

## 2. Bảng trước và sau

| Phép đo | Trước | Sau |
|---|---|---|
| Chuỗi tĩnh `/phase1` nếu đọc hết | 142,4k | **143,4k** (tăng, xem mục 5) |
| Hướng dẫn BẮT BUỘC `/phase1` | không đo được | **29,8k** |
| Output gate trên bộ 265 case thật | 10.696 byte | **1.811 byte (−83%)** |
| Case band high tra được, trên 388 case đã execute | **0** | **288** |
| Ảnh evidence rỗng ruột bị bắt | **0 máy nào** | 12/1.935 phát hiện được |
| Chi phí một lượt chạy thật | 494 đến 515k context mỗi message | **chưa đo lại** (chạm UAT, cần xác nhận) |

## 3. Bảng H1 đến H11

| | Trạng thái | File chính | Mức giảm đo được | Gate hoặc spec mới |
|---|---|---|---|---|
| H1 bàn giao theo phiên | xong | `.agent/config/handoff.json` · `preflight_gate.js` | chưa đo (nhân tử chi phối) | `handoff-gate.spec.ts` (8) |
| H2 load_map | xong | `.agent/config/load_map.json` | ~0 trực tiếp | `load-map.spec.ts` (6) |
| H3 ảnh evidence | xong | `scripts/qa/lib/evidence_quality.js` | 0 token, lỗ hổng đúng-sai | `evidence-quality.spec.ts` (6) |
| H4 bản tóm tắt kết quả | xong | `scripts/qa/summarize_results.js` | trần ~620k, chưa đo thực | `results-summary.spec.ts` (10) |
| H5 gate in gọn | xong | `lib/gate_engine.js` · `gate_codes.json` | **−83%** | `compact-mode.spec.ts` (9) |
| H6 model routing | xong, có giới hạn | `.claude/agents/` | ảnh hưởng GIÁ | `agent-routing.spec.ts` (4) |
| H7 tách thẻ chạy | hoãn | — | trần 3,4k | — |
| H8 bỏ lớp trùng | không làm | — | trần thật 143 token | — |
| H9 ngân sách token | xong | `.agent/config/prompt_budget.json` | 0 hôm nay, chống trôi | `prompt-budget.spec.ts` (9) |
| H10 độ sâu theo band | xong phần đã duyệt | `risk_model.json` · `depth.js` | gián tiếp | `depth-band-policy.spec.ts` (9) |
| H11 làn nhẹ Phase 2 | không làm | — | — | — |

**61 test mới.** H7, H8 và H11 không làm, và cả ba đều có lý do đo được chứ không phải hết giờ.

## 4. Ba lỗ hổng ĐÚNG-SAI, đáng kể hơn phần token

Không hạng mục nào trong prompt nhắm vào chúng. Chúng lộ ra vì đi đo.

**Ảnh trắng dùng làm evidence cho case PASS.** `CSDL_HSTRUONG_TC_138/step-01-passed.png` là 1280×720, 4 KB,
trắng hoàn toàn. `CSDL_NHANSU_TC_121/step-01-failed.png` là trang lỗi HTTP 503. Đã mở mắt kiểm cả hai.

**Máy đo độ phủ mở rộng báo RỖNG mà kết quả trông yên tâm.** `expansion_audit` đọc `t.id`, một trường
không tồn tại. Mọi case báo `unknown`, mọi luật "nếu siết tiếp" hiện 0/6 đỏ. Sau khi vá, luật **đang áp**
hiện 1/6 đỏ: CSDL-9003 có 164 case execute, 118 band high, 0/5 trục mở rộng.

**Thiếu band thì case rơi xuống tầng mỏng nhất, trong im lặng.** Nay `expansion:plan --enforce` từ chối chạy.

## 5. Vì sao số tĩnh TĂNG

H1 đến H6 **thêm** hướng dẫn: bàn giao giữa phase, con trỏ load_map, cách đọc bản tóm tắt. Hai hạng mục
duy nhất làm việc **cắt** là H7 và H8, và cả hai bị hoãn sau khi đo trần của chúng.

Đây là kết quả đúng chứ không phải thất bại, vì chuỗi tĩnh chưa bao giờ là đòn bẩy: một lượt chạy task
thật chỉ `Read` **0 đến 4 file** tài liệu của kit.

## 6. Bằng chứng chất lượng không tụt

| Phép kiểm | Kết quả |
|---|---|
| `tests/fe/infra` | **771/771** xanh |
| `gate-selftest` + `mutation-check` | 35/35 — gate cũ vẫn biết đỏ |
| `design:gate` trên bộ 265 case | 0 CHẶN, không đổi kiểu |
| `writing:lint --docs` | 102/102 trong mốc |
| `gate:policy` · `gates:index:check` · `library:drift` · `version:check` | ĐẠT trong worktree sạch |

**Không gate nào bị nới.** Lượt này thêm bốn đường chặn: ảnh rỗng ruột, thiếu band, ngân sách hướng dẫn,
và `n/a` component không lý do.

## 7. Năm lần tôi sai, và fixture hoặc gate bắt được

Ghi lại vì mỗi lần đều để lại một test, và test đó mới là thứ giữ bài học.

1. **Ba lần đo mốc đầu đều sai**: gộp phiên sửa kit với phiên chạy task · phân loại phiên bằng "có đọc
   prompt không" · dùng hệ số 3,6 thay vì 3,2.
2. **`--compact` vô tác dụng mà không báo lỗi**: `design_gate` có hai khối in giống nhau từng ký tự,
   `replace` chỉ trúng khối đầu. Nay có test đo BYTE.
3. **Chế độ "gọn" to hơn chế độ đầy đủ** ở 3 đến 6 vi phạm, vì dòng chú thích dài 125 byte.
4. **`--grep` bỏ sót case đỏ không có TC ID** — agent chạy lại, thấy xanh, kết luận xong.
5. **Nói sai hai tiền đề trong tài liệu**: *"bộ canonical không còn cột rủi ro"* là quyết định có chủ ý
   từ 21/08/2026 kèm phép đo, không phải lỗ hổng; và *"`screenshot: 'only-on-failure'` trái luật 4"* sai,
   vì cơ chế của luật 4 là `evidence_recorder.js`. Cả hai đã đính chính tại chỗ.

## 8. Thói quen khuyên team áp dụng

1. **`/clear` giữa các phase.** Ghi `handoff/<phase>.md` rồi mở phiên mới. Đây là việc có đòn bẩy lớn nhất,
   và nó không cần code gì thêm.
2. **Gọi đúng slash command**, đừng mô tả việc bằng văn xuôi — command đã trỏ sẵn vào `load_map`.
3. **Không dán tài liệu nguyên văn vào chat.** Để file trên đĩa rồi trỏ đường dẫn; `doc_budget` sẽ nói
   nên đọc thẳng hay giao subagent.
4. **Đọc `results:summary`, không đọc `results.json`.** Và rerun đúng case đỏ.

## 9. Còn lại

1. **Chạy lại task mốc CSDL-9003** rồi `token:audit` — cần xác nhận vì chạm UAT. Đây là số duy nhất còn
   thiếu để nói "giảm bao nhiêu phần trăm mỗi lượt".
2. **Xác minh subagent** bằng `/agents` ở một phiên mới.
3. **H7** quyết lại bằng số sau bước 1.
4. **Tag** `v2.3.0` và `v2.4.0`, và gộp hai nhánh vào `main`.
