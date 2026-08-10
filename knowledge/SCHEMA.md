# Knowledge Base — Schema

> Bộ nhớ học (learning loop) của kit. Lưu **fact đã xác nhận**, dùng lại xuyên task.
> Truy vấn ở giai đoạn này theo **module/tag** qua `index.json` (JSON thuần, KHÔNG vector store).

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

- `type`: `business_rule` | `bug` | `root_cause` | `historical_execution` | `locator`.
- Tra theo module = lọc `entries` theo `module`; tra theo tag = lọc theo `tags`.
- Mỗi lần thêm/cập nhật entry file → cập nhật `entries` tương ứng + `updated_at`.
