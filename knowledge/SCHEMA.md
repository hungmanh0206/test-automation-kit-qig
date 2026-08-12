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
>
> Đã nghiệm thu bản clone mới (dời sạch 72 file dữ liệu ra ngoài): `preflight` · `lint` · `typecheck` ·
> `secret:scan` · `gate:policy` · `risk` · `dashboard` **đều exit 0**, và `risk` báo trung thực
> `(0 bug, … snapshot làm dữ liệu)` chứ không âm thầm coi như không có rủi ro. `preflight_gate` đã chuyển
> `knowledge/index.json` từ **require → recommend** vì đó là artifact sinh ra, đòi nó là false-block.

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
├── locators/             # lịch sử locator từng bị heal (Locator Healing — Giai đoạn 2 mới ghi)
├── historical_execution/ # snapshot pass/fail theo module theo thời gian (input cho Dashboard)
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

> **Nguồn ghi (provenance).** Bug ghi bởi `learning_recorder` (chạy task qua kit) không có field `source`
> và `detected_phase ∈ {phase1,phase2,rerun}`. Bug **seed từ lịch sử Jira** (`scripts/qa/seed_knowledge_from_jira.js`)
> thêm `source: "jira-seed"`, `detected_phase: "historical"`, kèm optional `jira_resolution` + `resolved_at`
> (chỉ seed bug có resolution = fix thật). `confirmed_via_gate` vẫn `true` (bug đã resolved là product bug đã xác nhận).
> `risk_score.js` đếm mọi bug theo `module` (không lọc theo `source`) nên seed cấp Likelihood ngay; `source` để QA/audit phân biệt.

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
