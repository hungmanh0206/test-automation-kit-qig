---
name: ui_debug_agent
description: Khám phá DOM thật của một màn để tìm locator bền và neo nhãn UI ↔ cột DB — dùng khi màn mới, khi locator vỡ, hoặc khi debug script_error.
---

# UI Debug Agent

## Purpose

Kit đã có **chuẩn** locator (`locator_strategy.md`), **máy sửa** khi vỡ (`locator_healing_agent`) và **máy
kiểm** chất lượng (`lint:locator`) — nhưng thiếu bước **khám phá lúc đầu**. Không có nó, agent đoán locator
từ tên tính năng, và đó là nguồn `script_error` lớn nhất ở lượt chạy đầu.

Vì sao buộc phải inspect DOM thật: **đo trên repo, `getByTestId` xuất hiện 0 lần dùng thật** (2 hit duy nhất
đều nằm trong comment giải thích chính chuyện này), và `tests/**` không có `data-testid` nào. App là
ant-design + Metronic → **không phát test id**. Tầng 5 của `locator_strategy.md` là **tầng chết**; locator bền
chỉ lấy được bằng cách đọc DOM.

## Mức tự chủ: **Never-auto**

Skill này mở browser vào UAT ⇒ theo `CLAUDE.md` §2 phải **xác nhận với user trước mỗi lượt chạm UAT**.

- Chỉ đọc và tương tác **ở mức cần để tìm locator** (điều hướng, mở tab, mở dropdown để đọc option).
- **KHÔNG** tạo/sửa/xoá dữ liệu nghiệp vụ. Cần thao tác GHI để tới được màn ⇒ **hỏi trước**.
- Mở form sửa/tạo **không** đổi dữ liệu; chỉ bấm Save/Next/Finish/Confirm mới đổi ⇒ công cụ khám phá không
  được có lệnh bấm những nút đó.

## When to Use

- Màn mới **chưa có Page Object**.
- Locator vỡ mà `locator_healing_agent` trả confidence thấp (`BLOCKED_SETUP`).
- Cần **neo cột DB vào nhãn UI** cho `fieldMap` (§23 DB persistence).
- Cần hiểu DOM để chia Page Object đúng scope.
- Debug `script_error`: không tìm thấy element · click bị chặn · timeout · match nhiều phần tử.

**KHÔNG dùng khi:** chỉ cần chạy test (→ Phase 2) · dò rủi ro nghiệp vụ (→ `exploratory/`).

## Inputs

| Cần | Ở đâu |
|---|---|
| `TASK_KEY` + `PROJECT_OUTPUT_DIR` | bắt buộc, theo luật scope |
| Creds | `profiles/<TASK>/task.env` — **KHÔNG** đọc `.env` chung |
| Session sẵn có | fixture / `session_cache` — đừng đăng nhập lại nếu đã có |
| Chuẩn locator | `.agent/rules/locator_strategy.md` (canonical) |

## Sáu bước khám phá — theo đúng thứ tự

| # | Bước | Vì sao đúng thứ tự đó |
|---|---|---|
| 1 | `navigate` | — |
| 2 | `resize(1920,1080)` | **Ngay sau navigate.** Locator theo layout đổi theo viewport; resize sau khi đã đọc là đọc lại từ đầu |
| 3 | `wait_for(<tín hiệu>)` | Chờ theo **tín hiệu** (element/response/URL), **không** theo thời gian — `waitForTimeout` bị `playwright_fe.md` cấm |
| 4 | `snapshot` | **Accessibility tree, có `ref`** — đây là thứ để **PHÂN TÍCH** |
| 5 | `interact(ref)` | Chỉ khi cần mở modal/dropdown để thấy control |
| 6 | `screenshot` | Chỉ để làm **EVIDENCE**, **không** để chọn locator |

**Luật cứng:** `snapshot` để phân tích · `screenshot` để làm bằng chứng. Chọn locator từ ảnh là đoán — ảnh
không mang tên accessible, không mang cấu trúc DOM.

### Chạy 6 bước đó bằng gì

Repo này **chưa cài browser MCP** (đo: `.claude/settings*.json` không khai `mcpServers` nào). Nên bước 1–6
thực hiện bằng **script Playwright chỉ-đọc** — mẫu đã dùng thật ở tầng task:
`outputs/<project>/tasks/<TASK>/automation/_form_reader.js` (đọc form), `_status_label_map.js` (đọc lưới),
`_db_field_map.js` (đọc trang chi tiết). Ánh xạ:

| Bước | Playwright (đang dùng) | MCP browser (nếu sau này cài) |
|---|---|---|
| navigate | `page.goto(url, { waitUntil: 'networkidle' })` | `navigate_page` |
| resize | `newContext({ viewport: { width: 1920, height: 1080 } })` | `resize_page` |
| wait_for | `page.waitForURL` / `waitForResponse` / `locator.waitFor()` | `wait_for` |
| snapshot | `page.locator('body').ariaSnapshot()` | `take_snapshot` (trả `uid`) |
| interact | `getByRole(...).click()` trong scope đã neo | `click`/`fill` theo `uid` |
| screenshot | `page.screenshot()` sau khi mask PII | `take_screenshot` |

Cài MCP browser rồi thì đổi cột, **giữ nguyên thứ tự và luật** — chúng không phụ thuộc công cụ.

## Bốn nguyên tắc phải áp khi khám phá

Chuẩn đầy đủ ở `.agent/rules/locator_strategy.md` (**nguồn canonical — không chép bảng ưu tiên vào đây**).
Mọi locator đề xuất **phải kèm dạng `safe_target`** tương ứng:

| Nguyên tắc | Dạng bắt buộc |
|---|---|
| Neo **scope TRƯỚC**, tìm control SAU | `safe_target.section(page, '<Tiêu đề>', { siblings: [...] })` |
| **Mơ hồ = LỖI**, cấm `.first()` | `safe_target.one(locator)` |
| Hành động phải **NGHIỆM THU** (sentinel) | `safe_target.clickVerified(page, target, { expect })` |
| Đọc giá trị phải **có neo**, cấm regex trên `innerText` | `safe_target.readValue(scope, label)` |

Trước chuỗi thao tác dài: `safe_target.assertScreen(page, { url | heading })`.

## Bảy tình huống khó — playbook

| Tình huống | Cách làm |
|---|---|
| **Trang cần đăng nhập** | Dùng fixture / `session_cache`. Creds từ `profiles/<TASK>/task.env`, **KHÔNG** đọc `.env` chung |
| **Modal / dialog** | Neo scope vào chính dialog (`getByRole('dialog')`), **không** tìm ở cấp trang — cùng nhãn thường có cả ở trang nền |
| **iframe** | `frameLocator()`; ghi quirk vào `knowledge/locators/` vì lần sau không ai đoán ra |
| **Shadow DOM** | Playwright xuyên shadow với locator semantic; CSS descendant thì **không** — nếu buộc dùng CSS, neo vào host rồi mới xuống |
| **SPA / lazy load** | Chờ **tín hiệu** (response của API màn đó, hoặc element đích `waitFor()`), không chờ thời gian. SPA render im lặng trang khác khi route sai — **route sai KHÔNG trả 404**, đo bằng lưới/tiêu đề/API |
| **Bảng, danh sách lặp** | Neo theo **nội dung** (`getByRole('row').filter({ hasText })`) rồi mới xuống ô. **CẤM** `//tr[3]/td[2]`. Cần cột theo vị trí thì lấy chỉ số từ `<th>`, đừng hardcode |
| **Bị overlay / toast che** | Chờ nó tắt bằng **sentinel** (`toast.waitFor({ state: 'detached' })`). **CẤM** `force: true` — click xuyên overlay là bỏ qua đúng thứ app đang nói |

## Anti-Patterns

| Anti-pattern | Vì sao sai |
|---|---|
| Đoán locator từ **tên tính năng** | Nguồn `script_error` số 1 ở lượt đầu |
| Dùng **screenshot** để chọn locator | Ảnh không mang accessible name lẫn cấu trúc |
| Copy locator cũ **không verify** | Màn đã đổi mà locator vẫn "trông đúng" |
| Class **động**: `.ant-*`, `.css-*`, `.sc-*` | Đổi theo build/thư viện |
| **Positional xpath** | Thêm/xoá một hàng là vỡ |
| `.first()` khi match nhiều | Bắt nhầm phần tử mà test vẫn xanh |
| `force: true` click xuyên overlay | Che mất lỗi thật |
| `waitForTimeout` | Bị `playwright_fe.md` cấm; flaky theo mạng |
| Locator **trần**, không bọc `safe_target` | Mất luôn lớp chặn mơ hồ / nghiệm thu |
| Kết luận "màn không có field X" khi mới đọc `textContent` | **Instrument mù**: form giữ giá trị ở `input.value`; ant-select là `div` (`.ant-select-selection-item`); radio ở trạng thái `checked`. Bộ đọc báo `select=0` ở form OPS ⇒ **sửa công cụ**, không phải kết luận |

## Outputs — bắt buộc đủ 3 thứ

**① Bảng locator đề xuất**

| Scope neo | Locator (dạng `safe_target`) | Sentinel nghiệm thu | Quirk của màn |
|---|---|---|---|

**② Ghi vào `knowledge/locators/`** — không ghi thì sprint sau dò lại đúng màn đó, trái vòng learning.
Một file JSON cho một màn/quirk, tên `<màn>__<quirk>.json`. **Schema chốt ở `.agent/config/locators.schema.json`**
(có máy kiểm: `tests/fe/infra/locator-knowledge.spec.ts`) — field bắt buộc, `why` phải nói CƠ CHẾ, và `status: active`
thì phải có `confirmed_by`. Mẫu tham chiếu: `ops-row-menu__flaky-3-cham.json`.

**③ `fieldMap` theo MÀN** nếu màn có kiểm DB. Giữ đúng luật tầng DB verify — **trỏ, không chép**:
`.agent/config/db.conventions.json` (`fieldMap.byScreen`, `_method`, `_method_enum_by_groups`,
`_instrument_note`) + `prompt_templates/phase1/dimensions/23_db_persistence.md`. Ba điều dễ sai nhất:

- Bản đồ **khoá theo màn** — cùng một cột có nhãn khác nhau giữa hai màn, và **cùng một nhãn có thể là hai
  cột khác nhau** (`"Paid Amount"`: tab Overview = tiền đã trả, form `/edit` = `deposit`).
- Cột **chưa neo thì KHÔNG được dùng để phán** — đoán sai cột vẫn ra kết luận, lại **có số từ DB** nên trông
  thuyết phục hơn bug ma thường.
- **Enum lạ thì NÉM**, không tự dịch (`uiLabelOfValue` đã làm việc đó).

Trước khi dựng fixture để neo, **hỏi DB tìm bản ghi sẵn có**: `tests/support/setup/db/fieldmap.candidates.spec.ts`
(đo thật: 6/8 cột neo được **không cần fixture**).

## Khi vào để gỡ lỗi: phân loại TRƯỚC khi kết luận

Theo `.agent/config/verdict_taxonomy.json`:

| Dấu hiệu | Loại |
|---|---|
| Locator sai/mơ hồ, chờ sai, click bị chặn | `script_error` |
| State chưa dựng (thiếu data, sai precondition) | `setup_failure` |
| App làm sai so với **oracle độc lập theo spec** | nghi **product bug** |

Nghi product bug ⇒ **chuyển Phase 2 triage**. **KHÔNG log Jira từ skill này.**

## Constraints

- **Không tự sửa spec đang chạy.** Chỉ **đề xuất** locator; sửa code là việc của `qa_automation_engineer`.
- **Không tự heal assertion locator.** Việc heal thuộc `locator_healing_agent`, và nó có luật riêng:
  **không bao giờ heal locator dùng để assert** (heal oracle = tự làm test luôn xanh).
- **Không in credential/PII.** Mask ngay trong DOM **trước** khi chụp (theo giá trị · theo nhãn PII ·
  `input.value`), và mask khi đính evidence. Đừng mask theo hình dạng số chung — nó ăn luôn khoá nghiệp vụ
  như Deal ID.
- **Không tạo luật song song.** Mọi thứ về ưu tiên locator, cấm, và heal đều ở `.agent/rules/*`.

## Rules References

`.agent/rules/locator_strategy.md` · `.agent/rules/playwright_fe.md` ·
`.agent/rules/locator_healing_policy.md` · `.agent/rules/qa_instincts.md`
