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

- **Không đọc lại được model đã chạy.** Frontmatter khai `haiku` và harness nhận agent, nhưng kết quả
  trả về không mang tên model. Nên câu "việc máy móc đã đi model rẻ" hiện dựa vào KHAI BÁO, không dựa
  vào phép đo. Chưa có cách đo trong tầm tay.
- **Chưa đo trên task thật.** Hai lượt trên chạy fixture offline. Số token của một lượt Phase 2 thật có
  subagent so với không có subagent thì cần runbook `docs/token-diet/DO-LAI.md`.
- **Chưa kiểm hành vi khi lỗi hạ tầng.** Hợp đồng dặn "lỗi hạ tầng thì báo lại ngay, đừng thử sửa",
  nhưng cả hai lượt đều thành công nên nhánh đó chưa chạy.
