# Xác minh subagent — trước khi nối vào workflow

> Đo 10/10/2026. Điều kiện của phần C: **không nối một subagent chưa chứng minh được là chạy đúng hợp đồng.**

## Vì sao phải xác minh trước

`.claude/agents/test-runner.md` và `excel-convert.md` được tạo ở v2.4.0, và `REPORT.md` lúc đó ghi
"chưa xác minh". Một subagent tồn tại trên đĩa không có nghĩa là Claude Code nhận nó: nó có thể sai
frontmatter, sai tên model, hoặc không bao giờ được chọn. Nối một thứ chưa chạy vào workflow là tạo
một bước ma — luồng trông có vẻ đã giao việc, thực tế vẫn làm tay.

## Một chẩn đoán sai đã được loại bỏ

Ở nửa đầu phiên 10/10/2026, **cả hai subagent KHÔNG có** trong danh sách agent khả dụng. Lúc đó tôi đã
suýt kết luận là file hỏng. Nguyên nhân thật là **thời điểm**: hai file được tạo *trong chính phiên đó*
(commit `e2c61e7`), mà danh sách agent chỉ đọc lúc phiên khởi động. Sau khi harness nạp lại, cả hai
xuất hiện đúng tên và đúng mô tả.

Ghi lại vì nó là một bẫy lặp được: **thiếu trong danh sách ≠ file sai**. Kiểm thời điểm trước khi sửa file.

## Kết quả xác minh

| Mục | test-runner | excel-convert |
| --- | --- | --- |
| Được Claude Code nhận | đạt | đạt |
| `model` khai trong frontmatter | `haiku` | `haiku` |
| Model thật đã chạy | **không đọc lại được** (xem Giới hạn) | **không đọc lại được** |
| Chạy được trên fixture offline | đạt | đạt |
| Trả đúng hợp đồng đầu ra | đạt — 3 phần | đạt — đường dẫn, số dòng, cảnh báo nguyên văn |
| Giữ ranh giới "KHÔNG" | đạt | đạt |
| Lượt tool | 3 | 4 |
| Token của subagent | 16.634 | 17.718 |

### test-runner

Chạy `tests/fe/infra/deps-check.spec.ts` + `config-presence.spec.ts` (fixture local, không chạm UAT).

Trả về: `Total: 18 PASS, 0 FAIL, 0 SKIP`, không có case đỏ, không cần rerun.

**Đối chiếu độc lập:** 18 = 11 (deps-check) + 7 (config-presence). Khớp chính xác. Không đọc `results.json`
thô, không mở ảnh, không chấm verdict — đúng bốn ranh giới trong hợp đồng.

### excel-convert

Chuyển một fixture Markdown 2 case, 10 cột, sang `.xlsx`.

**Đối chiếu độc lập** (mở lại file bằng `exceljs`, không tin lời khai): sheet `M` có đúng 2 dòng `T1`/`T2`
với nội dung khớp nguồn; `.md` nguồn không bị sửa; không có lượt upload nào. Nó trả **nguyên văn** hai
cảnh báo của script (`[preflight] knowledge chưa có bản sao`, `[design] bộ chưa được gác theo kỹ thuật
thiết kế`) thay vì tóm tắt lại hay tự đoán cách chữa — đúng ranh giới cuối của hợp đồng.

Nó cũng **từ chối làm việc 2** vì lượt này không có `testcase-status.json`, và nói ra lý do.

## Vì sao việc này tiết kiệm token

Mỗi lượt gọi tool trong context chính là một message kèm cả context (~510k token, cache-hit 98,5%).
Hai lượt trên tốn **16,6k và 17,7k token** trong context RIÊNG của subagent; context chính chỉ nhận
bản tóm tắt vài trăm token.

Đây là lý do nối subagent vào đúng hai chỗ máy móc nhất của Phase 2 (chạy spec, convert Excel): không
phải để đi nhanh hơn, mà để vòng lặp đọc-kết-quả không nằm trong context chính.

## Giới hạn, nói thẳng

- **Model đã chạy: KHÔNG PHÁN ĐƯỢC, và đây là lý do dứt khoát chứ không phải chưa thử.**

  Đã truy ba chỗ:

  | Nguồn | Có tên model không |
  | --- | --- |
  | Kết quả trả về của lượt gọi (`toolUseResult`) | không — chỉ có `status`, `agentId`, `agentType`, `handback` |
  | Lượt nội bộ của subagent trong transcript phiên cha | không có mặt; mọi dòng `model=` trong vùng đó là lượt của phiên CHA |
  | Transcript riêng của subagent | không tồn tại; không file `.jsonl` nào được ghi vào lúc đó |

  Thứ DUY NHẤT trong transcript có số theo model là bản ghi `cost-state`, và nó là TÍCH LUỸ của cả
  phiên. Một con số tích luỹ không quy được cho lượt nào: phải lấy HIỆU giữa hai mốc ôm sát lượt cần
  hỏi. Đo 10/10/2026 thì mốc cuối ở dòng 21.367 còn hai lượt subagent ở dòng 29.527 và 29.564, tức
  **không có mốc nào sau chúng**. Lượt `haiku` 2.153 token đã có từ dòng 253, tức TRƯỚC mọi lượt
  subagent, nên cũng không quy được cho chúng.

  Nên câu "việc máy móc đã đi model rẻ" hiện dựa vào KHAI BÁO trong frontmatter, không dựa vào phép đo.
  Nói rõ thế, thay vì để người đọc tưởng đã kiểm.

  **Cách đo khi có điều kiện:** `npm run token:audit -- --model` lấy hiệu model-usage giữa hai mốc
  `cost-state` ôm quanh từng lượt gọi subagent, và in thẳng `KHÔNG PHÁN ĐƯỢC` khi thiếu mốc. Điều kiện
  để nó phán được: phải có một mốc `cost-state` SAU lượt gọi, và hai mốc phải đủ sát để hiệu không lẫn
  lượt của phiên cha. Mốc do harness ghi theo sự kiện riêng của nó, không gọi ra được — nên phép đo này
  chạy được hay không là chuyện may rủi của từng phiên, và máy nói rõ khi nó không phán được.
- **Chưa đo trên task thật.** Hai lượt trên chạy fixture offline. Số token của một lượt Phase 2 thật có
  subagent so với không có subagent thì cần runbook `docs/token-diet/DO-LAI.md`.
- **Chưa kiểm hành vi khi lỗi hạ tầng.** Hợp đồng dặn "lỗi hạ tầng thì báo lại ngay, đừng thử sửa",
  nhưng cả hai lượt đều thành công nên nhánh đó chưa chạy.
