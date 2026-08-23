# Heuristic Tours — checklist dò được, không phải gợi ý

> Đi kèm [`reference.md`](reference.md) và [`run_exploratory_session.md`](run_exploratory_session.md).
>
> **Vì sao file này tồn tại**: bản đầu của nhánh exploratory chỉ có **5 gạch đầu dòng** cho tours, và
> SFDPOT chỉ liệt kê 6 chữ cái mà không nói dò gì trong "Platform" hay "Operations". Với người thì đủ —
> con người có trực giác. Với agent thì không: agent không có trực giác, chỉ có instruction. Cùng một
> charter, hai phiên sẽ cho kết quả khác nhau hoàn toàn, và cái khác nhau đó không đo được.
>
> **Cách dùng**: mỗi tour có **phép dò** (làm gì) và **tín hiệu nghi vấn** (nhìn cái gì). Không cần chạy hết
> mọi tour — charter chọn 2–3 tour, nhưng tour nào đã chọn thì đi **hết** phép dò của nó, và ghi lại phép
> nào KHÔNG áp được (vì sao). "Đi cho có" rồi kết luận "không thấy gì" là kiểu vô bằng chứng mà kit cấm.
>
> **Không phải oracle**: tour chỉ dẫn tới chỗ đáng nghi. Kết luận đúng/sai vẫn cần neo (`BR-`/`SM-`/`UI-`…)
> hoặc app tự mâu thuẫn — xem luật oracle trong `RULE_GLOBAL.md`. Không có neo ⇒ ghi `OBSERVATION`.

---

## S — Structure (cấu trúc: cái gì đang có mặt)

| Phép dò | Tín hiệu nghi vấn |
|---|---|
| Kiểm kê MỌI thành phần trên màn: cột bảng, field, nút, tab, filter, badge, tooltip | Có thành phần không nằm trong tài liệu/Figma; hoặc tài liệu có mà màn thiếu |
| Cuộn ngang hết bảng, mở hết section thu gọn, bấm hết tab | Cột bị cắt, section rỗng không có empty-state, tab chết |
| So màn **cùng dữ liệu** ở 2 nơi khác nhau (list vs detail, OPS vs LMS) | Cùng một bản ghi mà hai nơi hiện khác nhau ⇒ đây là *app tự mâu thuẫn*, kết luận được ngay không cần neo ngoài |
| Xem cùng chức năng ở role/quyền khác | Field/nút lẽ ra bị ẩn vẫn hiện; hoặc ẩn nút mà API vẫn cho gọi |

## F — Function (chức năng: nó làm được gì)

| Phép dò | Tín hiệu nghi vấn |
|---|---|
| CRUD đủ 4 nhánh + nhánh **hủy giữa chừng** của từng nhánh | Hủy rồi mà bản ghi vẫn tạo; hoặc xóa xong list chưa cập nhật |
| Làm đúng luồng nhưng **sai thứ tự** (điền field sau trước, bấm Save trước khi chọn bắt buộc) | Nút Save bật khi chưa đủ điều kiện; validate chỉ chạy ở FE |
| Chức năng phụ thuộc nhau: đổi A rồi xem B có cập nhật | Cascade không chạy, hoặc chạy quá tay (xóa cả thứ không liên quan) |
| Thao tác **lặp lại** đúng thứ đã làm (bấm Save 2 lần, submit lại form cũ) | Tạo bản ghi trùng, cộng đôi số tiền, ghi 2 transaction cho 1 lần trả |
| Undo/rollback (nếu có): làm rồi hoàn tác rồi làm lại | Trạng thái không về được, hoặc về nửa vời |

## D — Data (dữ liệu: nhập gì vào)

| Phép dò | Tín hiệu nghi vấn |
|---|---|
| Biên từng field: rỗng · 1 ký tự · max · **max+1** · toàn khoảng trắng | Cắt âm thầm, hoặc lỗi 500 thay vì message |
| Ký tự đặc biệt + Unicode + emoji + tiếng Việt **có dấu** dài | Vỡ layout, mất dấu, encode lỗi khi lưu rồi đọc lại |
| Số: 0 · âm · phần thập phân · rất lớn · dấu phân cách khác (`1,5` vs `1.5`) | Làm tròn sai chiều, lệch tiền, hiển thị `NaN`/`undefined` |
| Ngày: quá khứ · tương lai xa · 29/02 · cuối tháng · định dạng khác | Chấp nhận ngày vô nghĩa, lệch 1 ngày do timezone |
| Dán (paste) thay vì gõ; gõ rồi xóa hết rồi submit | Validate chỉ chạy `onKeyUp` nên paste lọt qua |
| Dữ liệu cũ/không tương thích (bản ghi tạo trước khi có field mới) | Màn vỡ vì field `null`, hoặc hiển thị giá trị mặc định sai |

## P — Platform (nền tảng: chạy ở đâu)

| Phép dò | Tín hiệu nghi vấn |
|---|---|
| Thu nhỏ cửa sổ / mobile viewport (kit có lane `test:mobile-web`) | Cột tràn, nút chồng, không bấm được vì bị che |
| Zoom 80% và 150% | Chữ bị cắt, layout đè nhau |
| Tab thứ hai cùng tài khoản: sửa ở tab A, xem tab B | Ghi đè im lặng, không cảnh báo xung đột |
| Chặn/chậm mạng giữa lúc submit (DevTools throttling) | Không có loading, cho bấm tiếp, gửi 2 request |
| Reload giữa flow nhiều bước; back/forward của browser | Mất dữ liệu đã điền mà không cảnh báo, hoặc quay lại bước cũ với state mới |
| Bookmark/URL trực tiếp vào bước giữa, không qua bước trước | Vào được màn lẽ ra phải có tiền đề |

## O — Operations (vận hành: người thật dùng thế nào)

| Phép dò | Tín hiệu nghi vấn |
|---|---|
| Đi theo **một ca nghiệp vụ thật từ đầu tới cuối** (không nhảy bước) | Chỗ đứt mạch giữa 2 module mà từng module đều "đúng" |
| Làm việc như người bận: bỏ giữa dở, quay lại sau, làm 2 việc song song | State kẹt, bản ghi treo ở trạng thái trung gian |
| Quyền thấp nhất và quyền cao nhất cùng làm một việc | Thiếu chặn ở tầng API (ẩn nút không phải phân quyền) |
| Dữ liệu đông: list nhiều trang, filter/sort/search kết hợp | Phân trang lệch, sort không giữ khi đổi trang, đếm sai tổng |
| Xuất/nhập (export/import) rồi đối chiếu với màn | Số trên file khác số trên màn |
| Thứ gửi ra ngoài (mail/thông báo/webhook) | Gửi trùng, gửi sai người, nội dung còn placeholder |

## T — Time (thời gian: khi nào thì khác)

| Phép dò | Tín hiệu nghi vấn |
|---|---|
| Thao tác ở mốc **23:59 → 00:00**, đầu/cuối tháng, đầu/cuối năm | Bản ghi rơi sai kỳ, báo cáo lệch ngày |
| Timezone lệch (đổi giờ máy hoặc tài khoản khác vùng) | Hiển thị lệch giờ, so sánh ngày sai |
| Năm nhuận 29/02 và các mốc DST nếu vùng có | Không nhận ngày hợp lệ |
| Để phiên **hết hạn** giữa lúc điền form rồi mới submit | Mất dữ liệu, hoặc submit thành công với token đã hết hạn |
| Chờ đủ lâu để job nền chạy (mail hẹn giờ, đồng bộ) rồi xem lại | Job không chạy, chạy 2 lần, hoặc chạy trước khi dữ liệu sẵn |
| Hai thao tác **cùng lúc** trên cùng bản ghi (2 tab / 2 người) | Không có khoá, ghi đè im lặng |

---

## Tour bổ sung (ngoài SFDPOT)

### CRUD + boundary
Chạy CRUD với biên của **từng field** trong cùng một bản ghi, không chỉ field chính. Chú ý: field bắt buộc bị bỏ trống ở *bước sau* (đã qua validate bước trước).

### Interruption
Back · refresh · double-submit · mất mạng · đóng tab giữa lúc lưu · bấm Esc khi modal đang gọi API. Tín hiệu: bản ghi tạo nửa vời, không có bản ghi nhưng tiền đã trừ, list và detail nói khác nhau.

### Permission / URL bypass
Gọi trực tiếp URL/endpoint ngoài quyền (kit chỉ **GET** khi dò, theo `security_check`). Tín hiệu: 200 thay vì 403; hoặc 403 ở UI mà API vẫn trả dữ liệu.

### Money / number
Làm tròn (0.5 lên hay xuống), âm, số rất lớn, cộng dồn nhiều lần, đổi đơn vị/tiền tệ, chiết khấu chồng nhau. Tín hiệu: tổng ≠ tổng các phần, lệch 1 đồng, số âm ở chỗ không được âm.

### Ngược chiều (reverse)
Không hỏi "app có làm đúng thứ tài liệu nói?" mà hỏi **"app đang làm gì mà tài liệu KHÔNG nói?"** — field lạ, trạng thái lạ, endpoint lạ trong network tab. Đây là chiều hay lộ ra thứ chưa ai từng viết case.

---

## Ghi chép: mỗi phép dò để lại dấu

Với mỗi tour đã chọn, `observations.md` phải trả lời được:

1. **Đã dò phép nào** — liệt kê theo bảng trên; phép không áp được thì ghi *vì sao* (vd "không có job nền trong scope").
2. **Thấy gì** — mô tả quan sát, kèm **bước tái hiện** và evidence ảnh/video (highlight đúng chỗ, mask PII).
3. **Neo được không** — có `oracle_ref` (`BR-`/`SM-`/`UI-`…) hoặc app tự mâu thuẫn ⇒ phát hiện thật; không neo ⇒ `OBSERVATION` + câu hỏi mở cho BA.

## Dừng sớm — không phải hết giờ mới dừng

| Tình huống | Hành động |
|---|---|
| Gặp crash/500/mất dữ liệu **tái hiện được** | **DỪNG dò**, chuyển triage ngay (Phase 2). Dò tiếp trên hệ thống đang lỗi thì mọi quan sát sau đó đều đáng nghi. |
| Một tour đã ra ≥5 quan sát cùng gốc | Dừng tour đó, ghi nhận gốc chung — 20 quan sát cùng một nguyên nhân không giá trị hơn 1 |
| Môi trường không ổn định (login lỗi, deploy giữa phiên) | Dừng, ghi `setup_failure`, hẹn phiên khác. Đừng biến sự cố môi trường thành "phát hiện" |
| Hết timebox | Dừng và tổng kết, kể cả đang dở |
