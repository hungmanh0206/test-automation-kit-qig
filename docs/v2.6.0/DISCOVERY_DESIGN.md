# v2.6.0 — Bước 0 của Phase 1: Khám phá hệ thống (System Discovery)

> **Viết cho:** maintainer kit duyệt thiết kế này trước khi có dòng code nào. Đây là checkpoint duy nhất
> của đợt v2.6.0 (§1 của prompt). Chưa duyệt thì chưa viết script, chưa chạm UAT.
>
> Mốc token đo trước: [`TOKEN.md`](TOKEN.md). Nhánh `feat/v2.6.0`, nền `60cc648`.

## 0. Bốn chỗ phép đo đã bác tiền đề của prompt

Đọc xong prompt tôi đi đo trước khi thiết kế. Bốn chỗ phải nói ngay, vì chúng đổi phạm vi:

**① Khoản tiết kiệm token không nằm ở chỗ prompt nói.** §T lập luận discovery làm Phase 1 rẻ hơn vì agent
thôi "đọc tài liệu lớn" và thôi "mở MCP dò từng màn". Đo phiên Phase 1 thuần (`4970d32b`): Read chiếm
51,3% token kết quả **nhưng 9/27 lượt Read là tài liệu CỦA KIT** (3 thẻ chạy + 6 thẻ chiều) — discovery
không thay thế được hướng dẫn của chính kit. Và phiên đó có **0 lượt** Playwright MCP, 0 token ảnh: không
có gì để cắt. Phiên lớn (`fe6d3da6`) thì chi phí trội là **bash 75,3%**, mà discovery lại THÊM một bước
chạy script. Chi tiết và ba chỗ cắt được thật: `TOKEN.md` §3.

→ **Đề nghị đổi tuyên bố của đợt này:** không hứa "Phase 1 rẻ hơn". Hứa đúng hai thứ đo được: *mẫu số
coverage thôi tự khai* và *agent không phải đọc nguyên tài liệu để biết hệ thống có gì*. §T.9 vẫn giữ làm
điều kiện DỪNG, nhưng nếu nó đỏ thì lý do đã biết trước, không phải phát hiện muộn.

**② 12 thứ "phải tái dùng" đều có, nhưng đường dẫn trong prompt sai 5/12.** Không phải lỗi quan trọng, chỉ
là thiết kế phải trích đúng:

| Prompt ghi | Thật ở |
|---|---|
| `scripts/utils/screen_snapshot.js` | `scripts/utils/ui/screen_snapshot.js` |
| `scripts/utils/safe_target.js` | `scripts/utils/ui/safe_target.js` |
| `scripts/utils/ensure_expanded.js` | `scripts/utils/ui/ensure_expanded.js` |
| `scripts/qa/env_signals.js` | `scripts/utils/runtime/env_signals.js` |
| `scripts/qa/docs_index.js` | `scripts/phase1/docs_index.js` |
| `session_cache.js` · `tokenBroker` | `scripts/utils/auth/session_cache.js` · `scripts/utils/auth/pick_token.js` |

**③ `ui_components.json` khai 18 loại field nhưng chỉ 6 component** — `data_table` · `crud` ·
`permission` · `modal` · `toast` · `status_flow`. §A2 đòi crawler nhận diện thêm **phân trang, bộ lọc,
tab**, ba thứ KHÔNG có code trong file đó. Quyết định cần duyệt ở §C3.

**④ `dimension_manifest.json` là file THEO TASK**, ở `<task>/requirements/dimension_manifest.json`
(`scope_anchor.js:159`), không phải config của kit. Mọi gate §B3 nối vào đó phải theo hai tầng, vì task cũ
không có file này (`scope_anchor.js:164` đang cảnh báo đúng chuyện đó).

## 1. Kiến trúc

### 1.1. Luồng dữ liệu

```
profiles/<TASK>/task.env ──┐
                           ├─→ [0] preflight: nhận diện prod, đòi --confirm-nonprod
knowledge/system/discovery/└─→ [1] crawl.js ──── BFS menu/link/tab/accordion
  <build_id>/ (cache)            │  mọi request đi qua write_firewall.js (A3)
                                 │  mỗi màn: screen_snapshot + dấu vân tay DOM
                                 ├─→ [2] roles.js ──── lặp [1] theo từng vai trò
                                 ├─→ [3] api_inventory.js ── nghe thụ động, chuẩn hoá path
                                 ↓
                            [4] fuse.js  ←── docs_index · spec_extract · knowledge/ · OpenAPI (nếu có)
                                 ↓
          ┌──────────────────────┼───────────────────────┐
          ↓                      ↓                       ↓
   system_map.json        injection_surface.json     questions.md
   (máy đọc)              (A9.1)                     (Ambiguity Gate)
          ↓
   system_map.md (SINH, không viết tay) + summary.txt (thứ DUY NHẤT agent đọc)
```

**Agent chỉ đọc `summary.txt`.** Mọi thứ khác là JSON cho máy, mở theo mục bằng `--section <tên>`.

### 1.2. Thành phần, và cái nào viết mới

| Thành phần | Trạng thái | Tái dùng gì |
|---|---|---|
| `scripts/qa/discovery/crawl.js` | **MỚI** | `ui/screen_snapshot.js` (nhãn/cột/giá trị) · `ui/ensure_expanded.js` (mở accordion) · `ui/safe_target.js` (chống bấm mơ hồ) |
| `scripts/qa/discovery/write_firewall.js` | **MỚI** | logic nhận diện prod của `security_check.js` / `load_check.js` (cả hai đã có `--confirm-nonprod`) |
| `scripts/qa/discovery/roles.js` | **MỚI** | `auth/session_cache.js` · `auth/pick_token.js` |
| `scripts/qa/discovery/api_inventory.js` | **MỚI** | — (không có gì tương đương; `spec_extract.js` KHÔNG đọc OpenAPI, xem §1.3) |
| `scripts/qa/discovery/fuse.js` | **MỚI** | `phase1/docs_index.js` · `qa/spec_extract.js` · `qa/system_map.js` (schema `PM-*`/`SM-*`/`SS-*`) |
| `scripts/qa/discovery/injection_surface.js` | **MỚI** | `.agent/config/ui_components.json` (18 loại field) |
| Che PII trong JSON và ảnh | **tái dùng** | `utils/evidence/sanitize.js` + `PII_PATTERNS` (`qa/lib/output_rules.js`) |
| `.agent/config/discovery.schema.json` | **MỚI** | khuôn theo `knowledge/SCHEMA.md` |
| `.claude/commands/discover.md` | **MỚI** | con trỏ mỏng <60 dòng; khai `branch_parity.json`; `slash-commands.spec.ts` |
| `.agent/workflows/phase1_000_system_discovery.md` | **MỚI** | <1,5k token, khai `co_dieu_kien` |

### 1.3. Một chỗ prompt giả định sai, đã xác nhận với bạn trước đó

§A5 nói "có OpenAPI thì so hai chiều". **Dự án hiện KHÔNG có OpenAPI** — bạn đã nói rõ biến đó chỉ để tạm
cho sau này. Nên nhánh OpenAPI của `api_inventory.js` viết theo kiểu *có thì dùng, không có thì nói là
không có*, và **không** có spec nào đòi nó phải xanh. Lý do viết bài học này ra: ở v2.5.0 đã có một hạng
mục (G1.6) thu hẹp vì đo ra 0 file swagger — đừng lặp lại việc xây nhánh cho 0 đầu vào.

### 1.4. Schema `system_map.json` (rút gọn)

```jsonc
{
  "build_id": "<hash cấu hình + ngày>", "generated_at": "2026-10-11T…", "mode": "task|system|delta",
  "target": { "base_url_host": "<chỉ host, KHÔNG path có token>", "is_nonprod_confirmed": true },
  "modules": [{ "ten_ui": "<nguyên văn>", "prefix_de_xuat": "HS", "routes": ["…"], "risk_so_bo": "cao" }],
  "screens": [{
    "route": "/C2/HoSoTruong", "title_observed": "…", "loai": "danh_sach|form|dashboard|bao_cao",
    "fields": [{ "label": "…", "code_loai": "text", "required": true, "maxlength": 50,
                 "pattern": "…", "so_option": 12, "disabled": false }],
    "components": ["data_table", "modal"], "evidence": "screens/<slug>.png"
  }],
  "apis": [{ "method": "GET", "path_chuan": "/api/truong/:id", "status_quan_sat": [200, 403],
             "goi_tu": ["/C2/HoSoTruong"], "response_shape": { "ma": "string", "trangThai": "enum" } }],
  "roles": [{ "ten": "…", "nguon": "task.env" }],
  "role_route_matrix": [{ "role": "…", "route": "…", "quan_sat": "an|hien_disabled|vao_duoc",
                          "muc_bang_chung": "verified|config|unknown" }],
  "doc_coverage": [{ "vung": "…", "o": "documented_present|undocumented_present|documented_missing",
                     "muc_phu": "day_du|mot_phan|trang|nghi_loi_thoi", "nguon": "…" }],
  "crawl_completeness": { "route_toi_duoc": 42, "route_phat_hien": 57,
                          "khong_toi_duoc": { "needs_account": 8, "captcha": 3, "error": 1,
                                              "budget": 3, "firewall": 0 } },
  "status": "observed"
}
```

**Mọi bản ghi mang `status: "observed"`.** Không bản ghi nào của discovery được là oracle. Muốn thành
oracle thì qua Ambiguity Gate hoặc có người xác nhận, rồi mới vào `knowledge/domain` / `knowledge/system`
với `confirmed_by` — và từ 11/10/2026 `confirmed_by` có thêm giá trị `Van-ban-phap-quy` cho neo là văn bản
còn hiệu lực (xem `knowledge/SCHEMA.md`). Đây là chỗ B khác A về nguyên tắc: A cho phép REQ lấy từ "UI
thực tế" đi thẳng vào test case.

## 2. Ba chế độ

| Chế độ | Khi dùng | Phạm vi | Trần token agent đọc |
|---|---|---|---|
| `task` (mặc định) | Đầu mỗi Phase 1 | Module của task + lân cận 1 bước | **≤ 2k** |
| `delta` | Build mới, trước regression | Chỉ phần khác so với snapshot gần nhất | **≤ 1k** |
| `system` | Nhận dự án mới | Toàn app, theo giới hạn lượt bò | **≤ 4k** |

### 2.1. Ước tính token `summary.txt` cho từng chế độ

Ước theo 3,2 ký tự/token, cùng hệ số `prompt_budget`:

| Phần của summary | `task` | `delta` | `system` |
|---|---|---|---|
| Đầu đề: build_id, mode, host, nonprod | 60 | 60 | 60 |
| Đếm: module/màn/API/vai trò | 80 | 40 | 120 |
| Độ đầy đủ lượt bò + lý do không tới được | 150 | 60 | 200 |
| Bảng màn (dòng 1 dòng/màn, `task` ~12 màn · `system` ~60 màn, rút còn top 25) | 700 | — | 1.600 |
| Ô `undocumented_present` (vùng mù — không rút gọn) | 400 | 150 | 900 |
| Điểm nhập injection ưu tiên cao (A9) | 300 | 120 | 600 |
| Câu hỏi Critical/High | 250 | 150 | 400 |
| Khác biệt so với snapshot trước | — | 400 | — |
| **Tổng ước tính** | **~1,9k** | **~0,9k** | **~3,9k** |

Cả ba sát trần, nên spec §D1 phải kiểm trần trên fixture **lớn** (không phải fixture 3 màn), và script
phải tự rút gọn theo thứ tự ưu tiên khi vượt: giữ vùng mù và câu hỏi, cắt bảng màn trước.

## 3. An toàn

| Hàng rào | Cách làm | Chứng minh bằng |
|---|---|---|
| **Tường lửa ghi** | `page.route('**/*')`: method ∉ `GET/HEAD/OPTIONS` ⇒ `abort`, trừ endpoint đăng nhập/refresh khai trong config. Mỗi request bị chặn ghi lại kèm nút gây ra nó | Spec: fixture có nút Xoá + form Lưu ⇒ **0 request ghi lọt**, bản ghi fixture không đổi |
| **Danh sách nút cấm bấm** | Theo accessible name: Lưu/Ghi · Xoá · Duyệt · Gửi · Thanh toán · Đăng xuất · Import · Huỷ + biến thể EN. Chặn cả tải file và mở cửa sổ ngoài domain | Spec: crawler đi qua màn có đủ 8 nút ⇒ không bấm nút nào trong danh sách |
| **Chặn prod** | Tái dùng nhận diện prod của `security_check.js`/`load_check.js`. Bắt buộc `--confirm-nonprod` | Spec: chạy không có cờ ⇒ **từ chối**, exit ≠ 0 |
| **Giới hạn lượt bò** | Config: số trang tối đa, độ sâu, 1–2 luồng, độ trễ, thời gian tối đa | Spec: hết giới hạn giữa chừng ⇒ báo đúng phần chưa tới, **không** báo 100% |
| **Captcha/OTP** | Dừng nhánh đó, ghi `needs_account` / `manual_inherent` | Đã biết: captcha QEMIS mỗi lượt, và profile dùng chung giữa task làm login trượt chéo |
| **Không chạm UAT khi phát triển** | Mọi spec chạy trên fixture offline `tests/fe/fixtures/discovery-app/` | §D3 |
| **PII** | JSON lấy **hình dạng**, không lấy giá trị; nhãn PII thì che. Ảnh che theo `sanitize.js`. `secret:scan` trên đầu ra | Spec: JSON đầu ra không khớp `PII_PATTERNS` |
| **DB** | Discovery **không** nối DB. Không bao giờ | §A9.5 |

**Điều kiện DỪNG tuyệt đối:** tường lửa ghi chưa chứng minh được trên fixture là chặn 100% request ghi
thì **không chạy UAT**, không ngoại lệ.

## 4. A9 — Bản đồ điểm nhập và phủ injection

Lý do riêng cho dự án này: back-end là SQL Server và tài khoản có quyền `dbo` (đã ghi nhận), nên một lỗ
injection lọt là rủi ro dữ liệu thật. Mục tiêu là **kiểm chứng ứng dụng có xử lý input đúng cách**
(tham số hoá / escape / từ chối) — **không** phải hướng dẫn tấn công, và vẫn là sự thật quan sát.

### 4.1. `injection_surface.json` — máy liệt kê, không để người nhớ

```jsonc
{
  "build_id": "…",
  "diem_nhap": [{
    "id": "IS-001",
    "nhom": "sort|filter|search|paging|date_range|export_filter|import_file|api_path|api_body|second_order",
    "diem": "tham số sort của lưới Hồ sơ trường",
    "o": "/C2/HoSoTruong",            // màn hoặc endpoint
    "kieu_khai_bao": "string tự do | enum cố định | int",
    "di_toi_db": true,                 // SUY từ api_inventory, không khẳng định
    "uu_tien": "critical|high|medium|low",
    "muc_bang_chung": "observed|inferred",
    "vi_sao_uu_tien": "cột sort nhận chuỗi tự do và đi vào ORDER BY — chỗ khó tham số hoá nhất",
    "second_order_cap": { "nhap_o": "/C2/ThemTruong#tenTruong", "xuat_hien_o": "/C2/BaoCao" }
  }]
}
```

Bảng ưu tiên, theo thứ tự dự án hay bỏ sót:

| Nhóm | Ưu tiên mặc định | Vì sao |
|---|---|---|
| `sort` / cột hiển thị | **critical** | `ORDER BY` là chỗ khó tham số hoá nhất; thư viện ORM thường để hở đúng chỗ này |
| `import_file` | **critical** | nội dung Excel đi thẳng vào DB, và kit đã biết bảng lỗi import của QEMIS rỗng ⇒ phản hồi mù |
| `api_path` / `api_body` | high | mảng id và trường lồng nhau hay không được validate |
| `second_order` | high | giá trị nhập ở màn A xuất hiện trong truy vấn của màn B — chỉ phát hiện được khi cùng giá trị thấy ở hai màn trong **cùng** lượt bò |
| `filter` / `search` / `date_range` | high | đường vào phổ biến nhất |
| `export_filter` | medium | thường dùng lại truy vấn của lưới |
| `paging` | medium | thường là int |

### 4.2. Gate phủ — đối chiếu bản đồ, không đếm chữ

Hiện `dim:coverage` chấm chiều security bằng **regex trên văn bản**
(`dimension_coverage.js:76`: `/injection|\bxss\b|session|token|…/`). Nghĩa là một case chỉ cần **chứa
chữ** "injection" là chiều đó tính như đã phủ. Đổi thành:

> Mỗi điểm nhập `critical`/`high` trong `injection_surface.json` phải có **một case injection**, hoặc khai
> `N/A` **kèm lý do cụ thể** (ví dụ: *"cột sort là enum cố định phía server, không nhận chuỗi tự do"*).
> Thiếu mà không có lý do ⇒ **CHẶN**.

Hai tầng như mọi gate khác: task **chưa có** discovery thì chỉ cảnh báo *"chưa được gác"* — không in ĐẠT.

### 4.3. Oracle quan sát được, hợp với SQL Server

Mỗi case injection phải ghi oracle nhìn thấy được. Không nhận "không thực thi" làm oracle — đó là app==app.

| Dấu hiệu | ĐẠT (input bị coi là dữ liệu thường) | FAIL |
|---|---|---|
| HTTP status | không 500 | 500, hoặc status đổi theo nội dung chuỗi |
| Thông báo lỗi | **không** lộ lỗi SQL Server ra UI/response | lộ `Incorrect syntax`, `Unclosed quotation mark`, tên bảng/cột, stack trace |
| Cặp điều kiện đúng/sai | **cùng một kết quả** cho cả hai (hệ thống coi cả hai là chuỗi) | kết quả khác nhau ⇒ chuỗi được đọc như mệnh đề logic |
| Hiển thị lại | giá trị nhập hiện **nguyên văn** | bị cắt tại dấu nháy |

Payload giữ ở mức **tối thiểu, vô hại, chỉ để quan sát**: một dấu nháy đơn; một cặp điều kiện đúng/sai.
**Không** đưa vào kit payload đổi dữ liệu, xoá bảng, chờ theo thời gian, hay chồng câu lệnh. Từ điển dấu
hiệu lỗi SQL Server đặt trong config để `dim:coverage` và oracle đọc **cùng một nguồn**.

### 4.4. Phân tầng thực thi

| Nhóm | Phase 2 chạy được? | Nội dung |
|---|---|---|
| **Quan sát an toàn** | ✅ | Chỉ gửi input vô hại ở trên tới endpoint **GET/đọc**, chấm theo §4.3. Không ghi, không xoá, không làm chậm. Mỗi lượt vẫn đi qua tường lửa ghi §3 |
| **Còn lại** | ❌ Manual-only + OWASP ZAP opt-in | Mọi thứ có thể đổi dữ liệu, gây tải, hoặc dựa trên thời gian. Chỉ chạy khi có người phê duyệt và target non-prod rõ ràng |

### 4.5. Ranh giới với tầng DB — nói một lần cho rõ

Nhóm quan sát an toàn **không bao giờ** tự nối DB để "kiểm chứng"; nó chỉ quan sát phản hồi HTTP/UI. Đối
chiếu DB (nếu cần) đi qua `tests/support/setup/db/uatDbClient.ts` — chỉ `SELECT`, và DB **không phải
evidence** (CLAUDE.md §2).

> **Kit kiểm *ứng dụng có chặn injection không*. Kit KHÔNG tự injection vào DB.**

### 4.6. Chỗ không rõ thì hỏi, không đoán

Điểm nhập ưu tiên cao mà tài liệu không nói rõ quy tắc (có cho ký tự đặc biệt không; sort nhận cột tự do
hay enum) ⇒ thành câu hỏi trong `questions.md`, không tự đặt expected.

## 5. Nối vào quy trình và gate

| # | Gate / bước | Nối thế nào | Mức |
|---|---|---|---|
| 1 | `.agent/workflows/phase1_000_system_discovery.md` | Đặt trước `phase1_00`. Chạy `discover --mode task`, agent đọc **chỉ** summary, DỪNG xin duyệt bản đồ module + prefix trước khi ghi `knowledge/` | mới |
| 2 | `scope_anchor` | Mẫu số phải gồm **mọi màn và API quan sát được** của module task. Loại ra thì phải có lý do | CHẶN (2 tầng) |
| 3 | `dim:coverage` | `n/a` trái với discovery ⇒ CHẶN: có upload mà khai export/import `n/a`; ≥2 vai trò mà khai security `n/a`; field có maxlength mà không có `[BVA]`; có điểm nhập `critical`/`high` mà khai security `n/a` (§4.2) | CHẶN (2 tầng) |
| 4 | `field_types` trong `dimension_manifest.json` | Nay có **mẫu số thật** từ dấu vân tay ⇒ so được số loại field quan sát được với case `[Validation]`. Gỡ một phần giới hạn tuyên bố ở v2.3.0 | CẢNH BÁO → CHẶN sau 1 đợt |
| 5 | Ambiguity Gate | `questions.md` gộp vào `phase1-clarifications.md`. Critical/High chưa trả lời ⇒ giữ `AMBIGUITY_GATE: PENDING` | CHẶN |
| 6 | `risk_score` | Module + surface dùng chung + mật độ API/vai trò làm tín hiệu Impact/Likelihood khi `knowledge/` rỗng. **Đây là lời giải thật cho chỗ vừa đo ở v2.5.0**: `tagWeights` hiện không nổ vì `knowledge/bugs` trống, và discovery là nguồn tín hiệu duy nhất không cần chờ bug | mới |
| 7 | `system_mapper` | Ứng viên `PM-*`/`SM-*`/`SS-*` ở `draft`. `active` chỉ khi có `confirmed_by`. `system:check` cảnh báo `draft` quá N ngày | SINH |
| 8 | `precondition_setup_planner` | Danh mục API cho biết state nào dựng được qua `api` ⇒ giảm `Needs hook` đoán mò | SINH |
| 9 | `ui_debug_agent` / `knowledge/locators` | Dấu vân tay màn là đầu vào dò locator, không mở MCP lại | SINH |
| 10 | `partial-rerun` | `delta` ra danh sách thay đổi ⇒ **đề xuất** nhánh partial-rerun. Chỉ đề xuất | BÁO CÁO |
| 11 | `preflight --mode phase1` | Thiếu discovery, hoặc snapshot cũ hơn build / quá N ngày ⇒ cảnh báo. Cờ config để dự án nâng thành CHẶN | CẢNH BÁO |

## 6. So với `/discover_system` của A — 10 điểm

| # | A | B (thiết kế này) | Bằng chứng sẽ có |
|---|---|---|---|
| 1 | Agent tự bò qua MCP; snapshot vào thẳng hội thoại ⇒ tốn token, mỗi lượt một kết quả | **Script tất định**; agent chỉ đọc `summary.txt` ≤2k | spec kiểm trần summary trên fixture lớn; `token:audit` ở §E |
| 2 | Chỉ thấy phần một tài khoản thấy | `roles.js` bò theo từng vai trò ⇒ ma trận `vai trò × route`, phân biệt **ẩn** với **hiện-nhưng-disabled** | spec: vai trò thấp mở thẳng URL quản trị ⇒ `EXPANSION_FINDING` |
| 3 | API chỉ ghi thụ động, không lập danh mục | `api_inventory.js`: method, path chuẩn hoá `/:id`, status, hình dạng response, enum | spec trên mock API của fixture |
| 4 | Chỉ so với tài liệu văn bản | `fuse.js` gộp UI + network + tài liệu + `knowledge/` + lịch sử bug (OpenAPI: **có thì dùng**, dự án này chưa có — §1.3) | spec: fixture có 1 màn ngoài tài liệu ⇒ `undocumented_present` + sinh câu hỏi |
| 5 | Không có danh mục loại field/component | Dấu vân tay field (`type`, `required`, `maxlength`, `pattern`, số option thật, default, disabled) map về **18 loại field** của `ui_components.json` | spec đếm trên fixture có đủ loại field |
| 6 | Không so được giữa các build | Chế độ `delta` | spec: thêm 1 field ⇒ báo đúng field mới; không đổi ⇒ 0 khác biệt |
| 7 | Không nối vào gate nào | 11 điểm nối ở §5, có mức chặn rõ | bảng `GATES.md` sau đợt |
| 8 | An toàn dựa vào lời dặn | **Tường lửa ghi ở tầng network** + danh sách nút cấm bấm + chặn prod | spec: 0 request ghi lọt, fixture không đổi |
| 9 | Không biết đã bò được bao nhiêu | `crawl_completeness` + lý do theo 5 nhóm; dưới ngưỡng thì mọi số coverage phải ghi kèm cảnh báo | spec: hết giới hạn ⇒ không báo 100% |
| 10 | Đầu ra là Markdown cho người | JSON có schema + `.md` **sinh ra** từ JSON | spec: `.md` sinh lại khớp JSON |

**Ba thứ của A phải giữ nguyên, không được làm mất:** ① ba mức bằng chứng phân quyền (`verified` /
`config` / `unknown`) và luật "ô `unknown` KHÔNG được làm tròn thành không-có-quyền"; ② cấm gọi API trực
tiếp — chỉ quan sát request do UI tự phát sinh; ③ DỪNG xin duyệt trước khi ghi file, vì prefix đã cấp là
bất biến.

**Một chỗ B cố ý KHÔNG theo A:** A cấp prefix ở tầng khám phá và coi đó là bất biến. B **đề xuất** prefix
nhưng không cấp — kit B truy vết bằng `TC ID` + `oracle_ref`, thêm một hệ mã thứ hai là tạo hai nguồn sẽ
lệch nhau (cùng lý do đã từ chối `REQ-*` ở v2.5.0 G1.3b).

## 7. Ba quyết định cần bạn duyệt

**C1 — Đổi tuyên bố token của đợt này** (§0①): không hứa "Phase 1 rẻ hơn", hứa hai thứ đo được. Giữ §T.9
làm điều kiện DỪNG.

**C2 — Thứ tự làm.** Đề xuất: ① fixture offline + tường lửa ghi + spec chứng minh chặn 100% → ② crawl +
dấu vân tay → ③ api_inventory → ④ roles → ⑤ fuse + doc coverage → ⑥ A9 → ⑦ nối gate → ⑧ chạy thật UAT.
Lý do để tường lửa lên đầu: nó là điều kiện DỪNG tuyệt đối, chứng minh được rồi mới có quyền chạm UAT.

**C3 — Ba component thiếu code** (§0③): `phân trang`, `bộ lọc`, `tab` không có trong 6 component của
`ui_components.json`. Hai đường: (a) **thêm vào `ui_components.json`** kèm cột `chieu` — một nguồn, nhưng
làm `dim:coverage` đòi thêm chiều nên phải hai tầng; (b) để crawler báo `observed_unmapped` và không gate.
**Đề xuất (a)**, vì (b) tạo ra một danh mục quan sát được mà không ai dùng.

## 8. Điều kiện DỪNG của đợt

- Tường lửa ghi không chứng minh được trên fixture là chặn **100%** request ghi ⇒ **tuyệt đối không chạy UAT**.
- Muốn làm được thì phải để discovery thành oracle, hoặc phải nới gate.
- Phần nạp bắt buộc của `/phase1` vượt `moc` (28.074), hoặc summary vượt trần §2.1.
- §E đo lại mà tổng token Phase 1 không giảm → báo số và nguyên nhân (đã dự báo ở §0①).
- Bạn chưa xác nhận chạm UAT ở §E.
