# Knowledge Base — Schema

> Bộ nhớ học (learning loop) của kit. Lưu **fact đã xác nhận**, dùng lại xuyên task.
> Truy vấn ở giai đoạn này theo **module/tag** qua `index.json` (JSON thuần, KHÔNG vector store).

> ## ⛔ Nội dung `knowledge/` KHÔNG được commit — đối xử như `.env`
>
> `.gitignore` loại toàn bộ dữ liệu trong đây; repo chỉ giữ **file này** (`SCHEMA.md`) và các `.gitkeep`.
> Lý do: mọi store ở đây là thông tin nội bộ của dự án đang test, **không phải phần "kit"** —
> `bugs/` là tiêu đề defect sản phẩm (và tên FILE sinh từ slug tiêu đề nên chính *đường dẫn* đã mô tả defect),
> `domain/` + `system/` là business rule và bản đồ hệ thống, `locators/` là selector của app,
> `historical_execution/` + `metrics/` là lịch sử pass/fail kèm tên testcase, `examples/` là bug thật backfill
> từ một task cũ. `index.json` trỏ tới tất cả những thứ trên nên cũng bị loại — giữ lại là chỉ bịt được một nửa.
> Mirror GitHub là **public**, nên đây là ranh giới bắt buộc.
>
> **Mất file không phải mất dữ liệu** — mỗi store nạp lại được từ nguồn thật:
>
> | Store | Nạp lại bằng | Nguồn thật |
> |---|---|---|
> | `bugs/` | `npm run learn:bugs:apply` | Jira |
> | `historical_execution/` | `npm run learn -- --scan` | `test-results/` của task |
> | `metrics/` | sinh tự động khi chạy test | test run |
> | `domain/`, `system/`, `decisions/`, `root_causes/` | ghi tay rồi `npm run domain:index` · `system:index` · `decisions --index` | FSD / BA / dev xác nhận |
> | `domain/` · `system/` · `decisions/` · `setup_recipes/` · `environment/` · `locators/` | ⛔ **KHÔNG nạp lại được** — dòng "ghi tay rồi `*:index`" ở trên nói về cách DỰNG LẠI INDEX, không phải cách lấy lại NỘI DUNG. "Nguồn thật: FSD/BA/dev xác nhận" **không phải nguồn máy truy vấn lại được** — mất là **làm lại công sức người**. Đo 14/08/2026: **15 file** thuộc diện này, và vì `knowledge/**` bị gitignore nên chúng tồn tại trên **ĐÚNG MỘT máy**. Sao lưu: `npm run knowledge:backup` (bắt buộc đích NGOÀI repo). | không có nguồn máy |
> | `bug_tc_map.json` | ⛔ **KHÔNG nạp lại được** — là phán đoán của người (đọc TC rồi chốt). Record trong `bugs/` đã backfill thì vẫn giữ `module`, nên mất file *một mình* chưa hỏng gì ngay; hỏng khi **mất file RỒI nạp lại `bugs/` từ Jira** — lúc đó 26 mapping biến mất và bug quay về `(unmapped)`. `learn_bugs` cảnh báo nếu thiếu file mà đang có bug `(unmapped)`. Giữ bản sao ngoài repo. | không có nguồn máy |
>
> Đã nghiệm thu bản clone mới (dời sạch 72 file dữ liệu ra ngoài): `preflight` · `lint` · `typecheck` ·
> `secret:scan` · `gate:policy` · `risk` · `dashboard` **đều exit 0**, và `risk` báo trung thực
> `(0 bug, … snapshot làm dữ liệu)` chứ không âm thầm coi như không có rủi ro. `preflight_gate` đã chuyển
> `knowledge/index.json` từ **require → recommend** vì đó là artifact sinh ra, đòi nó là false-block.

## ⛔ Chính sách sao lưu — BẮT BUỘC, và phải làm TRƯỚC khi tích luỹ

Bảng trên chia knowledge làm hai loại **rất khác nhau về rủi ro**, và trước đây trình bày như nhau nên dễ hiểu sai:

| | Store | Mất thì sao |
|---|---|---|
| **Nạp lại được** | `bugs/` · `historical_execution/` · `metrics/` · `index.json` | Chạy 1 lệnh là có lại (Jira / test-results / test run) |
| **KHÔNG nạp lại được** | `domain/` · `system/` · `decisions/` · `setup_recipes/` · `environment/` · `locators/` · `bug_tc_map.json` | **Làm lại công sức người.** Không nguồn máy nào trả lại |

Đo 14/08/2026: **15 file** thuộc loại thứ hai. Và vì toàn bộ `knowledge/**` bị gitignore (mirror GitHub là public), chúng tồn tại trên **ĐÚNG MỘT máy — không remote nào có bản nào**. Hôm nay 15 file; sau 6 tháng là hàng trăm business rule đã được BA xác nhận. **Chi phí của việc này chỉ tăng theo thời gian, và không sửa được sau khi mất.**

```bash
KNOWLEDGE_BACKUP_DIR=<thư mục NGOÀI repo> npm run knowledge:backup
npm run knowledge:backup -- --verify <bundle.json>     # so bundle với hiện trạng
npm run knowledge:backup -- --restore <bundle.json>    # CHỈ ghi file còn THIẾU, không đè
```

- Đích **phải ở ngoài repo** — script **từ chối** ghi vào trong repo (backup cùng chỗ bản gốc thì không phải backup, và tạo nguy cơ commit đúng dữ liệu đã quyết định không commit). Trỏ tới: thư mục Drive/OneDrive đồng bộ · working copy của **private** repo · ổ ngoài.
- Bundle **cố ý KHÔNG chứa** `bugs/`, `historical_execution/`, `metrics/` — sao lưu thứ nạp lại được chỉ làm phình bundle và làm mờ thông điệp.
- `--restore` **không bao giờ đè**: file trên đĩa có thể mới hơn bundle; khác nội dung thì chỉ BÁO để người quyết định.
- Bundle là **dữ liệu nội bộ** (business rule + kết luận nội bộ) — giữ ở nơi riêng tư, đừng đưa lên repo public.
- Nghiệm thu 14/08/2026: backup 15 file → verify KHỚP → xoá 2 file (rule + `bug_tc_map`) → verify **exit 1 và nêu đúng tên** → restore → verify KHỚP, nội dung **giống từng byte**; sửa file trên đĩa rồi restore → **không bị đè**.

## Nguyên tắc

- **Chỉ ghi fact đã qua gate.** Bug chỉ ghi sau khi qua Jira gate ở
  `.agent/workflows/phase2_04_report_and_jira_gate.md` (đã loại flaky/setup/data/prompt).
- **Suggest-only.** Knowledge Base là dữ liệu tham chiếu, không tự đưa ra kết luận PASS/FAIL
  hay tự thay đổi scope. Người đọc (QA/agent) quyết định.
- **Không secret / không PII khách hàng.** Không ghi email/số điện thoại khách hàng, credential,
  connection string. Chỉ mô tả bug/module/root cause ở mức kỹ thuật.
- **JSON thuần.** Mỗi entry là 1 file JSON; `index.json` là index phẳng để tra theo module/tag.

## Thư mục

```
knowledge/
├── domain/               # business rule ĐÃ XÁC NHẬN (nền của oracle) — versioned, trace covered_by
├── system/               # bản đồ HỆ THỐNG: state machine · ma trận phân quyền · surface dùng chung
├── decisions/            # LÝ DO của quyết định đã chốt (false positive / by design / override / cách test)
├── bugs/                 # 1 file JSON / bug đã confirm là product issue (qua gate)
├── root_causes/          # root cause đã xác định, gắn module/file
├── setup_recipes/        # LÀM SAO dựng được state (SR-*) — công thức fixture đã chạy được, kèm pitfalls
├── environment/          # quirk hạ tầng/env/toolchain (ENV-*) — thứ chỉ biết sau khi vấp
├── locators/             # KỸ THUẬT thao tác UI (UI-*) + lịch sử locator từng bị heal
├── historical_execution/ # snapshot pass/fail theo module theo thời gian (input cho Dashboard)
├── metrics/              # số đo sinh khi chạy test (thời lượng, flaky rate…) — máy ghi, không ghi tay
├── bug_tc_map.json       # bug → TC/module chốt bằng tay (KHÔNG nạp lại được — xem §bug_tc_map.json)
├── index.json            # index phẳng: tra cứu theo module/tag
├── examples/             # dữ liệu MẪU minh hoạ (không phải learning data thật — xem examples/README.md)
└── SCHEMA.md             # file này
```

> `knowledge/` (live) khởi tạo **rỗng** cho dự án mới; `learning_recorder` điền dần khi chạy task thật.
> Muốn xem Dashboard có số liệu: copy `examples/*` vào các thư mục tương ứng rồi `npm run dashboard`.

## `bugs/<TASK_KEY>__<slug>.json`

```json
{
  "id": "PROJ-123",
  "bug": "Timezone hiển thị sai ở Report",
  "module": "Report",
  "tags": ["timezone", "report", "display"],
  "root_cause_ref": "root_causes/report-timezone-utc.json",
  "task_key": "PROJ-123",
  "detected_phase": "phase2",
  "confirmed_via_gate": true,
  "jira_status": "Open",
  "created_at": "2026-07-21"
}
```

| Field | Bắt buộc | Ý nghĩa |
|---|---|---|
| `id` | ✓ | Jira key hoặc id nội bộ của bug. |
| `bug` | ✓ | Mô tả ngắn (tiếng Việt, 1 dòng). |
| `module` | ✓ | Module nghiệp vụ (khớp cột `Module` của testcase). |
| `tags` | ✓ | Tag tra cứu (kebab/lowercase). |
| `root_cause_ref` |  | Đường dẫn tương đối tới file trong `root_causes/` (nếu đã xác định). |
| `task_key` | ✓ | TASK_KEY phát hiện bug. |
| `detected_phase` | ✓ | `phase1` \| `phase2` \| `rerun`. |
| `confirmed_via_gate` | ✓ | Luôn `true` — chỉ ghi khi đã qua Jira gate. |
| `jira_status` | ✓ | `Open` \| `In Progress` \| `Done` (đồng bộ khi rerun chuyển Done). |
| `created_at` | ✓ | ISO date (YYYY-MM-DD). |
| `tc_id` |  | Mã TC canonical mà bug này PHÁ. Nguồn: label Jira → mã nêu trong description → `bug_tc_map.json` (xem dưới). |
| `_coverage_gap` |  | Chỉ có ở bug **không TC nào phát biểu hành vi bị phá**: ghi đã tra những TC nào và tại sao không khớp. Có field này = ứng viên TC ưu tiên cao (đã có bằng chứng defect thật). |

> **Hai thứ `output_gate --mode bug` CẢNH BÁO khi log bug** (đo 14/08/2026 nên mới thêm):
> - **Thiếu TC ID** (field `tcId` hoặc label `*_TC_<số>`) — đó là SỢI DÂY DUY NHẤT nối bug về module. Không có thì bug rơi vào `(unmapped)` và `risk_score` **LOẠI khỏi bảng** ⇒ log rồi cũng không làm tăng Likelihood, không ảnh hưởng độ sâu test lượt sau. Thực trạng lúc thêm: **24/46 bug** đang như vậy.
> - **Đã nêu nguyên nhân trong description mà chưa có `root_cause_ref`** — `root_causes/` lúc đó có **0 file**, nên không trả lời được "lỗi này cùng nguyên nhân với bug nào", và cùng một gốc bị log lại nhiều lần.

> **Nguồn ghi (provenance).** Bug ghi bởi `learning_recorder` (chạy task qua kit) không có field `source`
> và `detected_phase ∈ {phase1,phase2,rerun}`. Bug **seed từ lịch sử Jira** (`scripts/qa/seed_knowledge_from_jira.js`)
> thêm `source: "jira-seed"`, `detected_phase: "historical"`, kèm optional `jira_resolution` + `resolved_at`
> (chỉ seed bug có resolution = fix thật). `confirmed_via_gate` vẫn `true` (bug đã resolved là product bug đã xác nhận).
> `risk_score.js` đếm mọi bug theo `module` (không lọc theo `source`) nên seed cấp Likelihood ngay; `source` để QA/audit phân biệt.

### `bug_tc_map.json` — nguồn thứ ba để nối bug về module (chốt bằng tay)

Label Jira và mã nêu trong description đều phụ thuộc người log bug **nhớ ghi**. Đo 14/08/2026: **26/57 bug**
không có cả hai ⇒ `(unmapped)` ⇒ ngoài bảng risk. Không sửa được bằng máy — đã thử và **loại cả hai cách**:
suy module từ tiêu đề (≥4/9 sai), và bảng tra `label → module` (5/17 label đa nghĩa; `be` trải 6 module, vì
label thực tế là nhãn **quy trình** chứ không phải nhãn chức năng). Nên nguồn cuối là người chốt, có `basis`
để kiểm lại.

```json
{
  "version": 1,
  "map": {
    "PROJ-201": { "tc_id": "MOD_TC_216", "basis": "Expected TC_216 liệt kê nguyên văn 3 nhãn ...; bug hiện raw enum ..." },
    "PROJ-202": { "module": "Quản lý Transaction", "coverage_gap": "TC_175 chỉ liệt kê form CÓ field ..., không phát biểu ràng buộc ...", "basis": "Defect ở modal Add Transaction ⇒ module theo màn." }
  }
}
```

**Hai hạng, không trộn:**

| Hạng | Khai gì | Điều kiện |
|---|---|---|
| A | `tc_id` | Đọc cột **Kết quả mong đợi** của TC đó thấy nó phát biểu ĐÚNG hành vi bug phá. `module` lấy theo TC ⇒ không phải đoán. |
| B | `module` + `coverage_gap` | KHÔNG TC nào phát biểu hành vi đó. `basis` phải nói module suy theo màn/tầng nào, `coverage_gap` phải liệt kê **đã tra những TC nào**. |

- Sinh ứng viên: `npm run bug:tc-match` (ghép theo idf trên `module+title+steps+expected`; tự kiểm bằng `--all`).
  Đo trên 30 bug đã map: argmax module đúng **40%** — KHÔNG đủ để tự chốt; module thật có trong top-12 **73%**
  ⇒ dùng làm danh sách ứng viên cho người đọc, và script **không có chế độ tự ghi**.
- Áp: `npm run learn:bugs:apply`. Bản đồ đứng SAU label/description; nếu label Jira trỏ mã **không tồn tại**
  trong bộ canonical thì bản đồ **thắng** (đã gặp: label `..._TC_560` khi bộ chỉ tới `TC_530` làm record đóng
  băng ở `(unmapped)` vĩnh viễn, vì nhánh backfill chỉ chạy khi `tc_id` rỗng).
- File này **KHÔNG commit** (`.gitignore`) — nó ghép Jira key với module nghiệp vụ, là dữ liệu nội bộ như `bugs/`.

## `domain/<module-lowercase>__<slug>.json` — Business rule đã XÁC NHẬN (nền của mọi oracle)

**Vì sao cần:** rule của kit **cấm oracle tautological** (expected phải lấy từ spec/business rule, KHÔNG
suy từ app đang chạy — xem prompt gen §12/§13, `output_gate.looksTautology`). Nhưng nếu KB không lưu
"đúng là gì" thì mỗi lần agent phải đọc lại Jira/Confluence (dễ miss) hoặc suy từ app (rơi đúng vào
tautology bị cấm). `domain/` là chỗ lưu **sự thật nghiệp vụ đã được xác nhận**, để oracle luôn **trích được nguồn**.

```json
{
  "id": "BR-PAYMENT-004",
  "module": "Payment",
  "rule": "Giảm giá VIP và voucher KHÔNG cộng dồn; áp mức lớn hơn",
  "applies_when": "đơn mua mới; KHÔNG áp cho gia hạn",
  "examples": [
    { "input": "VIP 10%, voucher 15%, đơn 600.000", "expected": "giảm 15% = 90.000" }
  ],
  "source": "Confluence Pricing v2 §3.2",
  "confirmed_by": "BA",
  "confirmed_at": "2026-07-20",
  "version": 2,
  "supersedes": "BR-PAYMENT-004@v1",
  "status": "active",
  "covered_by": ["PAY_TC_012", "PAY_TC_013"],
  "tags": ["pricing", "discount"]
}
```

| Field | Bắt buộc | Ý nghĩa |
|---|---|---|
| `id` | ✓ | `BR-<MODULE>-<NNN>` (in hoa, số 3 chữ số). Ổn định qua các version. |
| `module` | ✓ | Module nghiệp vụ (khớp cột `Module` của testcase — để `risk_score`/tra cứu gom đúng). |
| `rule` | ✓ | Phát biểu rule **kiểm được**, 1–2 câu. KHÔNG mô tả màn hình/UI. |
| `applies_when` |  | Điều kiện áp dụng / ngoại lệ (rất hay là nguồn bug bị bỏ sót). |
| `examples` | ✓ | ≥1 cặp `{input, expected}` **cụ thể bằng số/giá trị** — đây là thứ biến rule thành oracle dùng được. |
| `source` | ✓ | Trích dẫn nguồn (tài liệu + mục, hoặc "BA confirm <ngày>"). **Rỗng = không được ghi** (chống rule tự bịa). |
| `confirmed_by` | ✓ | `BA` \| `Dev` \| `QA-Lead` \| `PO` — ai chốt. |
| `confirmed_at` | ✓ | ISO date. Dùng để phát hiện TC đã execute TRƯỚC khi rule đổi → cần re-verify. |
| `version` | ✓ | Bắt đầu `1`; **tăng khi nội dung rule đổi** (không tăng khi chỉ sửa chính tả). |
| `supersedes` |  | `<id>@v<n>` khi bump version. |
| `status` | ✓ | `active` \| `superseded` \| `deprecated` (rule bị bỏ — giữ lại để giải thích test cũ). |
| `covered_by` | ✓ | TC ID lấy rule này làm oracle. **Đây là mắt xích trace ngược**: BA đổi rule → biết ngay TC nào phải cập nhật. Rỗng = rule chưa được test (gap). |
| `tags` |  | Tra cứu (kebab/lowercase). |

**Vòng đời (bắt buộc, không chỉ ghi thêm):**
- Rule đổi → **bump `version`**, set `supersedes`, giữ file cũ nếu cần bằng `status: superseded`.
- `confirmed_at` mới hơn lần execute cuối của TC trong `covered_by` ⇒ TC **stale**, phải chạy lại.
- Kiểm bằng `node scripts/qa/domain_rules.js --trace --stale` (validate schema + PII + trace TC + stale).

**KHÔNG ghi vào đây:** mô tả UI/label (dùng `requirements/ui_catalog.md` per-task) · số liệu tính được
(coverage/pass-rate) · dữ liệu khách/PII · rule chưa ai xác nhận (đang mơ hồ thì thuộc
`reports/phase1-clarifications.md`, chỉ chuyển vào `domain/` **sau khi** được trả lời).

## `system/<slug>.json` — Bản đồ HỆ THỐNG (sinh ra nghĩa vụ test, không chỉ để đọc)

`domain/` trả lời "giá trị đúng là gì". Nhưng nhiều câu hỏi khi test không phải về giá trị mà về **hệ thống**:
*"API cho huỷ order đã PAID — bug hay đúng thiết kế?"*, *"role GV gọi được endpoint của Admin — có phải lỗ hổng?"*,
*"sửa API này thì phải regression module nào?"*. Không có bản đồ thì agent **suy từ app** (app cho làm ⇒ tưởng
hợp pháp — đúng thứ tautology kit cấm) hoặc log bug đoán rồi bị dev bounce.

3 `type`, chung khối governance (`modules`, `source`, `confirmed_by`, `confirmed_at`, `version`, `status`, `supersedes`, `tags`)
giống `domain/`. Kiểm: `npm run system:check`.

### `type: "state_machine"` — id `SM-<SLUG>-<NNN>`

```json
{
  "id": "SM-ORDER-001", "type": "state_machine", "entity": "Order",
  "modules": ["Order", "Payment"],
  "states": ["DRAFT", "TO_PURCHASE", "PAID", "CANCELLED"],
  "initial": "DRAFT", "terminal": ["PAID", "CANCELLED"],
  "transitions": [
    { "from": "DRAFT", "to": "TO_PURCHASE", "trigger": "submit order", "roles": ["Sales"], "guard": "đủ thông tin thanh toán", "covered_by": ["ORDER_TC_012"] }
  ],
  "illegal_verified": [
    { "from": "PAID", "to": "CANCELLED", "expected": "API trả 409, order giữ PAID, doanh thu không đổi", "covered_by": ["ORDER_TC_099"] }
  ],
  "source": "FSD Order §4.2 (bảng Trạng thái đơn) + BA confirm 2026-08-10",
  "confirmed_by": "BA", "confirmed_at": "2026-08-10", "version": 1, "status": "active", "tags": ["revenue"]
}
```

| Field | Ý nghĩa |
|---|---|
| `states` / `initial` / `terminal` | tập state; `terminal` là state "chốt" (⚑) — chuyển ra khỏi nó thường là bug toàn vẹn dữ liệu |
| `transitions[]` | **chỉ khai cái HỢP PHÁP**: `from`, `to`, `trigger` (hành động/API), `roles?`, `guard?`, `covered_by[]` |
| `illegal_verified[]` | cặp bất hợp pháp **đã có case chứng minh bị chặn**: `expected` phải kiểm được (mã 4xx/5xx, state giữ nguyên, số cụ thể) |

**Suy ra nghĩa vụ test**: mọi cặp `(from,to)` không nằm trong `transitions` là **bất hợp pháp** → phải có case
chứng minh hệ thống chặn. `system_map.js` in ma trận + liệt kê cặp còn trống (ưu tiên `‼` cặp xuất phát từ state
`terminal`). Nhờ đó "API cho huỷ order đã PAID" trở thành **bug có nguồn trích dẫn** (`SM-ORDER-001`), không phải phỏng đoán.

### `type: "permission_matrix"` — id `PM-<SLUG>-<NNN>`

```json
{
  "id": "PM-ORDER-001", "type": "permission_matrix", "modules": ["Order"],
  "roles": ["Admin", "Sales", "Teacher"], "actions": ["view", "create", "cancel"],
  "allow": { "Admin": ["view", "create", "cancel"], "Sales": ["view", "create"], "Teacher": [] },
  "deny_expected": "HTTP 403 + dữ liệu không đổi",
  "covered_by": { "Teacher:view": ["ORDER_TC_120"] },
  "source": "FSD Order §7 Ma trận phân quyền", "confirmed_by": "BA",
  "confirmed_at": "2026-08-10", "version": 1, "status": "active", "tags": ["permission"]
}
```

`allow` là **whitelist**: ô role×action không có trong `allow` = **deny** → phải có case guard với oracle
`deny_expected`. `covered_by` khoá dạng `"role:action"`.

### `type: "shared_surface"` — id `SS-<SLUG>-<NNN>`

```json
{
  "id": "SS-ORDERAPI-001", "type": "shared_surface", "surface": "POST /api/v1/orders", "kind": "api",
  "modules": ["Order"], "consumers": ["Order", "Payment", "Convert order"],
  "paths": ["src/orders/**"],
  "risk_note": "3 luồng tạo đơn dùng chung payload — đổi field bắt buộc là hỏng cả 3",
  "covered_by": ["ORDER_TC_012"],
  "source": "Swagger /api/v1/docs-json + Dev confirm 2026-08-10", "confirmed_by": "Dev",
  "confirmed_at": "2026-08-10", "version": 1, "status": "active", "tags": ["api"]
}
```

`kind` ∈ `api|component|table|job|config|library`; `consumers` **≥ 2 module** (1 consumer thì không phải dùng chung).
`paths` (glob code) để đối chiếu git-impact. Tra ai bị ảnh hưởng: `node scripts/qa/system_map.js --impact "<surface>"`.

> Kết quả rỗng **không** nghĩa là an toàn — chỉ nghĩa là chưa ai khai surface đó vào knowledge.

## `decisions/<YYYY-MM-DD>__<slug>.json` — LÝ DO của quyết định đã chốt

`domain/` lưu "cái đúng", `system/` lưu "được phép làm gì", `bugs/`+`root_causes/` lưu "cái đã sai".
Còn thiếu thứ đắt nhất: **vì sao đã kết luận như thế**. Không có nó thì task sau **log lại đúng bug đã bị
Rejected**, **FAIL đỏ oan** case mà lần trước đã chốt là vướng env, hoặc **mò lại** cách test đã thử thất bại.

```json
{
  "id": "DEC-PAYMENT-001",
  "type": "false_positive",
  "subject": "IPN trả về mã 00 nhưng đơn chưa chuyển sang PAID — nghi bug xác nhận thanh toán",
  "decision": "KHÔNG phải bug. Mã 00 của IPN là ACK đã nhận thông báo, không phải xác nhận đã thanh toán.",
  "rationale": "Dev đọc code handler và xác nhận: 00 chỉ ack cho cổng thanh toán biết hệ thống đã nhận callback; việc chuyển PAID nằm ở bước đối soát sau đó. Jira đã Rejected.",
  "evidence": "PROJ-28126 (Rejected) + comment của Dev ngày 2026-07-20",
  "decided_by": "Dev", "decided_at": "2026-07-20",
  "scope": { "modules": ["Payment"], "tc_ids": ["OPS_PAY_TC_301"], "bug_keys": ["PROJ-28126"] },
  "status": "active", "tags": ["ipn"]
}
```

| Field | Ý nghĩa |
|---|---|
| `type` | `false_positive` · `by_design` · `risk_override` · `blocked_pass` · `wont_fix` · `test_approach` |
| `subject` | **TRIỆU CHỨNG** như lần đầu gặp — đây là thứ dùng để tra cứu lần sau, viết đúng chữ mình sẽ tìm |
| `decision` / `rationale` | chốt cái gì / **vì sao** (bằng chứng, ai xác nhận, code/spec nào). `rationale` < 20 ký tự = CHẶN |
| `decided_by` | `BA`\|`Dev`\|`QA-Lead`\|`PO`\|`QA`. `false_positive` **không được** do QA/agent tự chốt |
| `scope` | `{modules, tc_ids, bug_keys}` — phải có ≥1; không khoanh thì quyết định bị áp sai chỗ |
| `expires_at` | tuỳ chọn, cho quyết định **tạm thời** (sandbox chết, chờ vendor). Quá hạn mà còn `active` → cảnh báo phải kiểm lại |

**Tra trước khi log bug** (bắt buộc trong workflow `phase2_04`):

```bash
node scripts/qa/decisions.js --check "<triệu chứng>" [--module <Module>]
npm run decisions:check          # validate + bug Rejected chưa có lý do + quyết định quá hạn
```

`decisions:check` đối chiếu `knowledge/bugs/`: bug `Rejected`/`Won't Do` mà **không** có quyết định giải thích
sẽ bị nêu tên (`‼`) — vì đó chính là bug sẽ được log lại lần sau.

## `setup_recipes/<slug>.json` — LÀM SAO dựng được state (id `SR-<SLUG>-<NNN>`)

**Vì sao cần:** các store khác đều nhớ phía **kết luận** (`domain` giá trị đúng · `system` được phép làm gì ·
`bugs` cái gì hỏng · `decisions` vì sao đã chốt). Nhưng đo trên 80 memory tích luỹ của một dự án đang chạy:
**59% là "cách dựng state/fixture"** — tức phần lớn thời gian thật tiêu ở phía *"làm sao tới được đó"*, mà
trước đây kit KHÔNG có chỗ chứa. `Setup Strategy` chỉ sống trong TỪNG task nên task sau mò lại từ đầu.

```json
{
  "id": "SR-ORDER-001",
  "goal": "Có 1 Deal loại Chuyển nhượng để màn Create render ĐÚNG luồng Chuyển nhượng",
  "modules": ["Order Chuyển nhượng"],
  "method": "fixture-tool",
  "preconditions": ["Contact test đã tồn tại"],
  "steps": ["Tạo contact test", "Tạo deal", "PATCH `loai_phi_dich_vu` NGAY TRƯỚC khi sync", "Bấm Đồng bộ thông tin"],
  "pitfalls": ["PATCH SAU khi sync là vô tác dụng — form ra NHẦM luồng Chuyển đổi", "Deal fixture dùng MỘT LẦN"],
  "verification": "Khối Customer Info hiện đúng contact VÀ loại phí là Chuyển nhượng",
  "cleanup": "Xoá theo tiền tố `IT test`",
  "source": "…", "confirmed_by": "QA", "confirmed_at": "2026-08-14", "version": 1, "status": "active",
  "tags": ["fixture", "hubspot"]
}
```

| Field | Bắt buộc | Ý nghĩa |
|---|---|---|
| `goal` | ✓ | Dựng ra **state gì** — không mô tả thao tác chung chung. |
| `method` | ✓ | `api` \| `ui` \| `factory` \| `test_hook` \| `pre_existing` \| `fixture-tool`. **KHÔNG có `db`** — RULE_GLOBAL cấm dựng state bằng DB; validator chặn cả câu lệnh `INSERT/UPDATE/DELETE/psql` trong `steps`. |
| `steps` | ✓ | Các bước cụ thể, ĐÚNG THỨ TỰ (thứ tự thường chính là chỗ sai). |
| `pitfalls` | ⚠ | **Thứ chỉ biết sau khi đã vấp.** Rỗng = cảnh báo, vì recipe không có cạm bẫy thường chỉ là chép lại tài liệu. |
| `verification` | ✓ | Cách XÁC NHẬN state đã dựng đúng — thiếu thì chạy xong không ai biết có thật không. |
| `cleanup` |  | Dọn thế nào, hoặc vì sao không cần dọn. |
| `applies_when` | ⚠ | **Điều kiện nhận biết recipe này áp được** cho precondition đang gặp — để lượt sau tra ra được thay vì phải đọc hết `steps`. |
| `used_by` | ⚠ | TC ID **đã dựng state bằng recipe này và chạy được** = bằng chứng recipe còn dùng được. Cùng khuôn `covered_by` của domain rule: thiếu "ai đang dựa vào cái này" thì record không biết mình còn đúng hay không. Rỗng = cảnh báo (recipe mới ghi thì bình thường). |

**Tái dùng recipe cho task mới** — `npm run howto:find -- "<precondition>"`:

```
PRE-03: Deal phải là loại Chuyển nhượng
  → npm run howto:find -- "Deal loại Chuyển nhượng"
  → SR-ORDER-001 · khớp: deal, loai, chuyen, nhuong
    áp khi : Precondition cần MỘT Deal pipeline=Chuyển nhượng…
    used_by: OPS_PAY_TC_384, OPS_PAY_TC_396      ← bằng chứng đã chạy được
  → ĐỌC `applies_when` + `pitfalls` rồi TỰ quyết tái dùng
```

> Tra cứu khớp **CHUỖI**, xếp theo **số từ khớp** — cố ý **KHÔNG có điểm tin cậy**. Một con số `0.72` trông đáng tin hơn thực tế và mời người ta bỏ qua bước đọc; mà đo trong ngày 14/08/2026 thì chấm-điểm/suy-diễn trên văn bản tiếng Việt đã sai 3 lần liên tiếp (suy module bug 4/9 sai · `label→module` 5/17 đa nghĩa · suy chiều coverage đánh đổi recall↔precision). Script in ra thứ để ĐỌC, không phán hộ.
> Không có kết quả **không** nghĩa là không dựng được — chỉ nghĩa là chưa ai ghi lại.

## `environment/<slug>.json` — Quirk hạ tầng/env (id `ENV-<SLUG>-<NNN>`)

Loại thứ hai bị thiếu (**21%** số memory): không phải lỗi sản phẩm, nhưng không biết thì test fail một cách
khó hiểu và dễ bị kết luận nhầm thành bug.

| Field | Bắt buộc | Ý nghĩa |
|---|---|---|
| `scope` | ✓ | Env/app nào (UAT OPS, staging LMS…) — quirk sai môi trường là gây hiểu nhầm. |
| `fact` | ✓ | Quirk cụ thể, kiểm được (vd "token TTL ~30 phút; khoá theo SỐ LẦN login"). |
| `impact` | ✓ | Hậu quả nếu không biết — không nêu thì người đọc không rõ vì sao phải quan tâm. |
| `workaround` | ⚠ | Cách né. Rỗng = cảnh báo (biết quirk mà không biết né thì giá trị còn một nửa). |
| `detection` |  | Triệu chứng để nhận ra đang dính quirk này. |

## `locators/<module>__<slug>.json` — KỸ THUẬT thao tác UI (id `UI-<SLUG>-<NNN>`)

Store này có từ lâu nhưng **0 file**, vì schema cũ chỉ chứa selector do `locator_healing_agent` ghi tự động.
Thứ đắt giá lại là **cách thao tác**: selector đúng mà thao tác sai thì vẫn fail — và fail kiểu ngắt quãng,
rất dễ bị gán nhầm là "flaky không rõ nguyên nhân" rồi rerun cho qua.

| Field | Bắt buộc | Ý nghĩa |
|---|---|---|
| `target` | ✓ | Thao tác lên **cái gì** (menu ⋮ trên row, popup xác nhận, nút submit cổng thanh toán…). |
| `symptom` | ✓ | **Triệu chứng khi làm SAI** — không có thì người sau không nhận ra mình đang dính đúng ca này. |
| `technique` | ✓ | Cách đúng, cụ thể tới mức làm theo được. |
| `why` | ⚠ | Vì sao cách cũ hỏng. Rỗng = cảnh báo, vì không giải thích thì người sau dễ "tối ưu" ngược lại. |
| `selector` |  | Nếu có selector ổn định thì ghi; khai mà để rỗng = lỗi. |

## `system/` type `data_model` (id `DM-<SLUG>-<NNN>`)

Loại thứ tư của `system/`. Không phải "giá trị đúng" (`domain/`), không phải "được phép làm gì" — mà là
**cách sản phẩm tổ chức dữ liệu**, thứ quyết định test viết đúng hay sai ngay từ đầu.

| Field | Bắt buộc | Ý nghĩa |
|---|---|---|
| `entity` | ✓ | Mô hình dữ liệu của cái gì. |
| `model` | ✓ | Cách dữ liệu được tổ chức (vd *"version snapshot: mỗi lần sửa sinh bản ghi mới"*). |
| `test_implication` | ✓ | **Mô hình này bắt test phải làm KHÁC đi thế nào** (vd *"sau mutation resolve theo TÊN, không dùng lại id"*). Thiếu trường này thì record chỉ là mô tả, không dùng được. |
| `pitfalls` | ⚠ | Bẫy đã vấp. |

Kiểm 3 store `setup_recipes`/`environment`/`locators`: `npm run howto:check` (`-- --enforce` để chặn) ·
ghi index: `npm run howto:index`. `system/` (gồm `data_model`): `npm run system:check` · `system:index`.

> **Quirk của TOOLCHAIN** (Jira/AIO Tests/HubSpot API) dùng chung `environment/`, chỉ khác `scope` — vd
> `"scope": "Toolchain — AIO Tests API"`. Không tạo store riêng: schema `fact/impact/workaround/detection`
> vừa khít, và tách ra chỉ làm loãng.
>
> **Quy ước đội** (cách publish, đặt tên data test, khi nào ghi PASS-kèm-note) KHÔNG thuộc `knowledge/` —
> chúng nằm ở `.agent/config/project_context.md` §"Quy ước đội".
`self_review` nhắc khi có case `BLOCKED_SETUP`/`SKIP_SETUP`/`setup_failure` mà `setup_recipes/` còn rỗng —
vì bài học từ `locators/`: thêm store mà không có máy nhắc thì store nằm chết.

## `root_causes/<slug>.json`

`<slug>` = `<module-lowercase>-<mô-tả-kebab>`, vd `report-timezone-utc`.

```json
{
  "id": "report-timezone-utc",
  "summary": "Backend convert UTC sai timezone khi render Report",
  "module": "Report",
  "affected_files": [],
  "related_bugs": ["PROJ-123"],
  "status": "open",
  "resolved_at": null
}
```

| Field | Bắt buộc | Ý nghĩa |
|---|---|---|
| `id` | ✓ | Slug, trùng tên file (không đuôi). |
| `summary` | ✓ | Root cause đã xác định (không phải triệu chứng). |
| `module` | ✓ | Module liên quan. |
| `affected_files` |  | File/đường dẫn code liên quan (nếu biết chắc). |
| `related_bugs` | ✓ | Danh sách `id` bug trong `bugs/`. |
| `status` | ✓ | `open` \| `resolved`. |
| `resolved_at` |  | ISO date khi rerun xác nhận PASS thật + Jira Done. |

## `historical_execution/<TASK_KEY>__<YYYY-MM-DD>.json`

Snapshot kết quả execute theo module (input cho Dashboard — Giai đoạn 2).

```json
{
  "task_key": "PROJ-123",
  "date": "2026-07-21",
  "phase": "phase2",
  "unassisted_pass_rate": 0.83,
  "modules": {
    "Report": { "total": 12, "pass": 10, "fail": 2, "skip": 0 },
    "Login":  { "total": 5,  "pass": 5,  "fail": 0, "skip": 0 }
  }
}
```

Nguồn số liệu: `<TASK_OUTPUT_DIR>/reports/execution-summary.md` (đã có unassisted pass rate).

## `locators/<module>__<slug>.json` (Giai đoạn 2 — Locator Healing)

Ghi bởi `locator_healing_agent` khi heal thành công (chỉ locator bước ACTION, confidence cao).
Tuân theo `.agent/rules/locator_healing_policy.md`.

```json
{
  "element": "Nút Lưu ở form Report",
  "module": "Report",
  "target_type": "action",
  "original": "getByRole('button', { name: 'Lưu' })",
  "healed_to": "getByRole('button', { name: 'Lưu thay đổi' })",
  "confidence_basis": ["accessible_name_exact", "same_role", "same_dom_region"],
  "task_key": "PROJ-123",
  "healed_at": "2026-07-21"
}
```

| Field | Ý nghĩa |
|---|---|
| `target_type` | Luôn `"action"` — KHÔNG BAO GIỜ heal locator `assertion` (policy). |
| `original` / `healed_to` | Locator trước/sau heal; `healed_to` không được dùng CSS động/`nth-child`/XPath tuyệt đối. |
| `confidence_basis` | 3 tiêu chí đã thoả: `accessible_name_exact`, `same_role`, `same_dom_region` (phải đủ cả 3). |

## `explorations/<TASK_KEY>__<YYYY-MM-DD>.json` — vùng ĐÃ soi bằng exploratory

Sinh bởi `npm run explore:close`. Trả lời câu hỏi mà trước đây không ai trả lời được: **vùng nào đã được
dò bằng tay rồi?** Thiếu nó thì mỗi sprint lại dò trúng chỗ cũ, và `explore:charter` không có gì để trừ điểm.

| Field | Nghĩa |
|---|---|
| `areas[]` | vùng đã dò (tên module/màn như QA gọi) — khoá để phiên sau tránh |
| `tours[]` | tour đã dùng (theo `exploratory/tours.md`) — dò lại cùng vùng nhưng tour khác thì vẫn có giá trị |
| `counts` | `observations` · `crashes` · `drafts` — độ "được soi" của vùng |
| `charter_excerpt` | 3 dòng đầu charter, để đọc lại biết phiên đó nhắm gì |

**Nạp lại được?** Không — phiên exploratory là thao tác người, không tái tạo từ log. Thuộc nhóm phải sao lưu
(`npm run knowledge:backup`).

## `index.json`

Index phẳng để tra cứu theo module/tag mà không phải quét toàn bộ thư mục.

```json
{
  "version": 1,
  "updated_at": "2026-07-21",
  "entries": [
    {
      "type": "bug",
      "file": "bugs/PROJ-123__timezone-report.json",
      "module": "Report",
      "tags": ["timezone", "report"],
      "task_key": "PROJ-123",
      "status": "Open"
    },
    {
      "type": "root_cause",
      "file": "root_causes/report-timezone-utc.json",
      "module": "Report",
      "tags": ["timezone"],
      "task_key": "PROJ-123",
      "status": "open"
    }
  ]
}
```

- `type`: `business_rule` | `system_map` | `decision` (kèm `subtype`: `state_machine`|`permission_matrix`|`shared_surface`) | `bug` | `root_cause` | `historical_execution` | `locator`.
- Tra theo module = lọc `entries` theo `module`; tra theo tag = lọc theo `tags`.
- Mỗi lần thêm/cập nhật entry file → cập nhật `entries` tương ứng + `updated_at`.
