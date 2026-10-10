# FSD — QA Discovery Fixture (tài liệu GIẢ, dùng cho test offline)

> **Tệp này cố ý THIẾU màn `/bao-cao`.** Màn đó tồn tại thật trong app fixture và bò tới được, nên nó
> phải rơi vào ô `undocumented_present` của bản đồ phủ tài liệu — đúng **vùng mù chính** mà §A6 muốn
> chỉ ra. Đừng "sửa" tệp này cho đủ: thiếu là chủ đích, và có một spec gác chuyện đó.
>
> Tệp cũng cố ý khai một màn **không tồn tại** (`/hoc-sinh`) để kiểm ô `documented_missing`.

## 1. Phạm vi

Hệ thống quản lý danh mục trường và lớp. Hai vai trò: `admin` và `nhanvien`.

## 2. Màn hình

### 2.1. Tổng quan — `/`

Trang chủ, liệt kê đường dẫn tới các danh mục. Không có dữ liệu nhập.

### 2.2. Hồ sơ trường — `/truong`

Lưới danh sách có **phân trang** (3 dòng mỗi trang), **bộ lọc theo cấp học**, và **ô tìm kiếm** theo mã
hoặc tên.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `ma` | chuỗi | mã trường, định dạng `<cấp>-<số>` |
| `ten` | chuỗi | nguyên văn tên trường |
| `cap` | enum | `MN` · `TH` · `THCS` · `THPT` |
| `trangThai` | enum | `dang_hoat_dong` · `tam_dung` · `giai_the` |
| `siSo` | số nguyên | ≥ 0 |

Bấm tiêu đề cột để sắp xếp. **Tài liệu không nói rõ** tham số sort nhận giá trị nào — đây đúng là chỗ
§A9.6 yêu cầu thành câu hỏi cho Ambiguity Gate, không tự đặt expected.

Mỗi dòng có nút **Xoá**.

### 2.3. Chi tiết trường — `/truong/{id}`

Ba tab: Thông tin chung · Hạ tầng · Đội ngũ. Một accordion "Lịch sử thay đổi".

### 2.4. Hồ sơ lớp — `/lop`

Lưới danh sách. Sắp xếp **chỉ nhận ba cột**: `ten`, `khoi`, `id`. Giá trị ngoài danh sách đó bị server
từ chối (HTTP 400).

### 2.5. Thêm trường — `/them-truong`

Form nhập. Ô **Tên trường** là bắt buộc, dài 3–120 ký tự. Các ô còn lại không bắt buộc.
Nút **Lưu** để ghi, nút **Xoá bản nháp** mở hộp thoại xác nhận.

### 2.6. Hồ sơ học sinh — `/hoc-sinh`

Quản lý danh sách học sinh theo lớp.

> ⚠️ Màn này **chưa build** trong app fixture ⇒ phải rơi vào ô `documented_missing`.

### 2.7. Cấu hình hệ thống — `/admin`

Chỉ vai trò `admin` được dùng.

> ⚠️ Tài liệu nói "chỉ `admin`", nhưng server fixture **không kiểm quyền** ở route này. Lệch giữa tài
> liệu và hành vi quan sát được ⇒ `EXPANSION_FINDING`, và là câu hỏi mức Critical.

## 3. Phân quyền

| Màn | `admin` | `nhanvien` |
|---|---|---|
| `/` · `/truong` · `/lop` · `/them-truong` | ✅ | ✅ |
| `/admin` | ✅ | ❌ |

## 4. API

Danh mục endpoint ở `openapi.json` cạnh tệp này.
