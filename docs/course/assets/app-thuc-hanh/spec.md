# Đặc tả — Vận hành lớp học

> Đây là **spec**: bản mô tả app *phải* làm gì. Cả tài liệu sẽ neo mọi kết luận đúng/sai vào file này.
>
> Mỗi luật có một **mã** (`BR-xx`, `UI-xx`). Khi bạn nói "chỗ này sai", bạn phải chỉ được mã luật nó vi
> phạm. Không chỉ được mã nào thì bạn chưa chứng minh được gì — bạn chỉ đang thấy lạ.

## 1. Bối cảnh

Một trung tâm luyện thi mở lớp theo khoá. Mỗi lớp có thời hạn: học viên vào học được từ ngày bắt đầu tới
ngày kết thúc, sau đó mất quyền truy cập.

Học viên học không kịp thì **đăng ký học lại** ở khoá sau. Lúc đó hệ thống phải **cắt hạn lớp cũ** lại cho
khớp với lớp mới — không để hai lớp cùng mở, cũng không cắt sớm hơn cần thiết.

Người vận hành làm việc này ở màn **Lớp › Học viên**.

## 2. Dữ liệu

### Lớp

| Mã | Tên | Loại | Bắt đầu | Kết thúc |
|---|---|---|---|---|
| `CFA01` | CFA Level 1 — khoá Xuân | Lớp chính | 01/03/2026 | 31/07/2026 |
| `CFA02` | CFA Level 1 — khoá Thu | Lớp chính | 01/09/2026 | 31/12/2026 |
| `CFA02F` | CFA Level 1 — Foundation khoá Thu | Foundation | 01/07/2026 | 31/08/2026 |
| `CFA03` | CFA Level 1 — khoá Thu (lớp 2) | Lớp chính | 01/09/2026 | 31/12/2026 |
| `ACCA01` | ACCA F2 — khoá Xuân | Lớp chính | 01/03/2026 | 31/07/2026 |
| `ACCA02` | ACCA F2 — khoá Thu | Lớp chính | 01/09/2026 | 31/12/2026 |

**Foundation** và **Revision** là lớp đi kèm: cùng môn, học trước hoặc học ôn, nhưng **không phải lớp
chính**. Sự phân biệt này quan trọng — `BR-02` dựa vào đúng nó.

### Học viên

| Mã | Tên |
|---|---|
| `HV01` | Nguyễn Văn A |
| `HV02` | Trần Thị B |
| `HV03` | Lê Văn C |

### Đơn học lại đang chờ đồng bộ

| Học viên | Lớp cũ | Đã được xếp vào lớp mới |
|---|---|---|
| `HV01` | `CFA01` | `CFA02F` (Foundation, 01/07) và `CFA02` (Lớp chính, 01/09) |
| `HV02` | `CFA03` | `CFA02` (Lớp chính, 01/09) |
| `HV03` | `ACCA01` | `ACCA02` (Lớp chính, 01/09) |

## 3. Luật cắt hạn khi học lại

| Mã | Luật |
|---|---|
| **BR-01** | Ghi danh mới có **Loại** = **Thường** |
| **BR-02** | **Lớp mốc** là lớp mới **loại Lớp chính** có ngày bắt đầu **sớm nhất**. Lớp **Foundation** và **Revision** **không** được dùng làm mốc |
| **BR-03** | **Hạn mới của lớp cũ** = ngày bắt đầu của **lớp mốc** **trừ 1 ngày** |
| **BR-04** | Áp hạn mới theo **cả hai chiều**: kể cả khi hạn hiện tại **sớm hơn** hạn mới, tức là có kéo dài thời hạn đã hết |
| **BR-05** | Chặn hạn âm: nếu hạn mới **sớm hơn** ngày bắt đầu của lớp cũ thì hạn mới = **ngày bắt đầu lớp cũ** |
| **BR-06** | Học viên **chưa được xếp vào lớp mới nào** thì **giữ nguyên** hạn lớp cũ — không cắt, không kéo dài |

> **`BR-02` nói mốc lấy theo _Lớp chính_**, không phải theo lớp bắt đầu sớm nhất. Đọc kỹ dòng này.

Mọi ngày ở đây tính **ở mức ngày** — không giờ, không múi giờ.

## 4. Luật gia hạn

| Mã | Luật |
|---|---|
| **BR-07** | **Số ngày gia hạn** phải là số nguyên trong khoảng **1–180**. Ngoài khoảng thì chặn, hiện thông báo *"Số ngày gia hạn phải từ 1 đến 180"* |
| **BR-08** | **Lý do gia hạn** là **bắt buộc**, tối đa **60 ký tự** |
| **BR-09** | **Ngày hết hạn** = **thời hạn của ghi danh** + **số ngày gia hạn** |

> `BR-09` nói cộng vào **thời hạn của ghi danh** — tức hạn riêng của học viên đó trong lớp, **không** phải
> hạn của lớp. Hai số này bằng nhau ở phần lớn học viên, nên chỗ này rất dễ trôi qua mà không ai để ý.

## 5. Luật trạng thái học viên

| Mã | Luật |
|---|---|
| **BR-10** | Học viên có **Loại** khác **Thường** thì **không xoá được** khỏi lớp. Mọi yêu cầu xoá phải bị từ chối — **bằng mọi đường, kể cả gọi trực tiếp API** |
| **BR-11** | Loại **Học lại** **không có** đường về **Thường**. Không tồn tại chức năng huỷ học lại |
| **BR-12** | Mỗi lần thời hạn của một ghi danh bị đổi thì ghi **một dòng lịch sử**, lần gần nhất xuất hiện ở **đầu** danh sách |

## 6. Luật hiển thị

| Mã | Luật |
|---|---|
| **UI-01** | Bảng học viên hiện **đúng 7 cột, đúng thứ tự**: `#` · `Học viên` · `Loại` · `Thời hạn` · `Gia hạn (ngày)` · `Ngày hết hạn` · và một cột hành động không có nhãn |
| **UI-02** | Ngày định dạng `dd/mm/yyyy`. Cột **Thời hạn** là **một** cột gộp, dạng `dd/mm/yyyy - dd/mm/yyyy` |
| **UI-03** | Số ngày gia hạn bằng 0 thì hiện dấu **`—`** thay cho số `0` |
| **UI-04** | **Các số đang hiện trên màn phải khớp nhau**: **Ngày hết hạn** đang hiện phải bằng đúng **ngày cuối của cột Thời hạn** đang hiện, cộng **Gia hạn (ngày)** đang hiện |

> **`UI-04` là một luật về _màn hình_, không phải về tính toán.** Backend tính đúng mà màn hình hiện các số
> không khớp nhau thì vẫn là vi phạm — vì người dùng nhìn màn hình, không nhìn backend.

## 7. Bề mặt API

| Đường | Việc |
|---|---|
| `GET /api/lop` · `GET /api/hoc-vien` · `GET /api/don-hoc-lai` | dữ liệu tham chiếu |
| `POST /api/hoc-vien` · `POST /api/lop` · `POST /api/ghi-danh` · `POST /api/don-hoc-lai` | **dựng** dữ liệu cho lượt chạy của bạn |
| `DELETE /api/hoc-vien/:id` · `DELETE /api/lop/:ma` | dọn dữ liệu bạn vừa dựng |
| `GET /api/lop/:ma/hoc-vien` | danh sách ghi danh trong lớp — nguồn của bảng trên màn |
| `POST /api/tinh-han` | **tính** hạn mới, **không ghi gì**. Trả cả lớp mốc đã chọn |
| `POST /api/dong-bo-hoc-lai` | **áp** hạn mới: đổi Loại sang Học lại và ghi hạn |
| `POST /api/gia-han` | gia hạn thêm ngày |
| `GET /api/ghi-danh/:id/lich-su` | lịch sử thay đổi thời hạn |
| `PATCH /api/ghi-danh/:id` · `DELETE /api/ghi-danh/:id` | sửa / xoá một ghi danh |
| `GET /api/_store/ghi-danh` | **chỉ đọc** — bản ghi thật ở tầng lưu trữ |
| `POST /api/reset` | dựng lại dữ liệu ban đầu |
