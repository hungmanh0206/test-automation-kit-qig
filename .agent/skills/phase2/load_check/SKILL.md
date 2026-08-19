---
name: load_check
description: Chạy load/stress/soak (Loại B, nhiều VU) qua k6 — wrapper mỏng, parse summary → report. k6 là binary NGOÀI (không phải npm dep). Never-auto, chỉ non-prod, cap khiêm tốn. Loại A single-user dùng perf_check.
---

# Load Check (Loại B — load/stress/soak qua k6)

## Purpose

Đo **load thật nhiều VU** (throughput, điểm gãy, soak) — thứ Playwright KHÔNG làm được (lái browser thật, quá nặng để giả nghìn VU). `scripts/qa/load_check.js` là **wrapper mỏng** cho k6: chạy k6 → parse summary JSON → `reports/load-report.{md,json}` → dashboard.

**Phân biệt:** Loại A (single-user: response time/vitals/render/resource so ngưỡng) đã do **`perf_check.js`** phủ trong kit. Loại B (nhiều VU) mới cần tool ngoài — đây.

## k6 là binary NGOÀI (không phải dependency)

Không `npm install k6`. Cài: `choco install k6` / `brew install k6` / apt (xk6) / hoặc `--docker` (image `grafana/k6`). **Thiếu k6 → script SKIP sạch** (không FAIL, in hướng dẫn cài) → giữ Node-thuần: k6 opt-in, KHÔNG vào `package.json` deps.

## Mức tự chủ: Never-auto + AN TOÀN NẶNG

Load test tạo **tải thật** → có thể **làm nghẽn/sập chính UAT** (hoặc thảm hoạ: nhắm nhầm prod). Vì vậy:
- **Chỉ chạy khi user yêu cầu** + `--confirm-nonprod` (hoặc `LOAD_CHECK_CONFIRM=1`). Không có → từ chối.
- **CHẶN prod**: target trông giống production → từ chối (không cờ nào mở prod).
- **Cap khiêm tốn mặc định** (`--vus 5 --duration 30s`); tăng có chủ đích. **Đừng chạy tải lớn trên UAT dùng chung** khi người khác đang test (phối hợp trước).
- Dùng tài khoản/data test, endpoint non-prod.

## Inputs / chạy

```
TASK_ENV=profiles/<TASK>/task.env node scripts/qa/load_check.js --script tests/load/example.load.js --confirm-nonprod
  [--base <url>] [--vus 5] [--duration 30s] [--docker] [--enforce] [--out <dir>]
```
- k6 script: template `tests/load/example.load.js` — điền endpoint + **`thresholds` từ NFR/SLA** (k6 native → verdict). Giữ VU/duration modest.
- `--enforce`: exit≠0 khi threshold breach (cho CI). Mặc định report + exit 0.
- **Auth**: k6 nuốt system env mặc định → biến trong `TASK_ENV` (vd `OPS_ACCESS_TOKEN`) đọc thẳng bằng `__ENV.<TÊN>` trong script, không cần cờ riêng. Lấy token **1 lần trong `setup()`** rồi chia cho mọi VU — để mỗi VU tự login là đâm vào login throttle/lockout.

## Profile tải: `stages` trong script vs cap của wrapper

k6 cho **CLI flag đè `options` trong script**. Wrapper vì thế KHÔNG được vô điều kiện truyền `--vus/--duration`, nếu không `stages` (ramping) bị làm **phẳng** mà không báo gì — stress/spike/soak chạy ra load thường nhưng report vẫn "PASS".

| Tình huống | Wrapper làm gì |
|---|---|
| Script khai `stages`/`scenarios`, KHÔNG truyền `--vus/--duration` | nhường profile cho script (report ghi `profileSource: script` + đỉnh VU) |
| Script khai profile NHƯNG có truyền `--vus/--duration` | vẫn đè (ý người chạy thắng) + **cảnh báo** ramping bị làm phẳng |
| Script khai `vus`/`duration` **trần** (không stages) | vẫn đè bằng cap + **cảnh báo** thời lượng thật khác cái script khai |
| Script không khai gì | giữ cap mặc định `5 VU / 30s` |

⚠️ Bẫy hay gặp: viết soak `duration: '20m'` bằng `options.duration` trần → wrapper đè còn **30s**, rồi kết luận "chạy 20 phút không thấy degradation". Soak/stress **phải** khai bằng `stages`.

**Script mẫu trong kit** (đổi endpoint theo dự án):
| File | Profile | Dùng khi |
|---|---|---|
| `tests/load/example.load.js` | cap wrapper | template khởi đầu |
| `tests/load/ops-transactions.load.js` | constant 5 VU | baseline hồi quy |
| `tests/load/ops-transactions.stress.js` | ramp 5→20 VU | nhìn hình dạng đường cong theo tải |
| `tests/load/ops-transactions.soak.js` | 3 VU × 20′ | tìm degradation/rò tài nguyên |

Hai script sau tách `Trend` theo **băng VU** / **khoảng thời gian** — summary gộp cả run che mất xu hướng, mà xu hướng mới là thứ cần đọc. Cả hai đặt van an toàn `abortOnFail` (lỗi > 10% thì k6 tự dừng, không dội tải vào service đang gãy).

Nhường quyền cho script = **mất cap an toàn** → wrapper cảnh báo khi profile dựng > 50 VU. Đọc `profile`/`profileSource` trong `load-report.json` để biết tải THẬT đã chạy là gì.

## Baseline hồi quy — `--baseline-id <id>`

Số perf chỉ có nghĩa khi **so theo thời gian**, mà `load-report.md` nằm trong `outputs/` (gitignore, xoá theo task) nên không so được. `--baseline-id` append 1 dòng vào `knowledge/metrics/perf-baselines.jsonl` — **local-only** như mọi store trong `knowledge/`.

```bash
npm run load -- --script tests/load/<x>.load.js --base <url> --baseline-id <id> --confirm-nonprod
```

- Ghi kèm **điều kiện đo** (`env`, `profile`, `k6` version, `measured_at`) — so 2 bản ghi khác điều kiện là so nhầm; wrapper cảnh báo khi điều kiện lệch.
- Cờ `clean` = không lỗi + không trượt ngưỡng. **Chỉ bản ghi `clean` mới được dùng làm mốc**; lượt hỏng vẫn lưu (là dữ liệu) nhưng không phải mốc.
- Lần đo sau in delta p95 so với bản `clean` gần nhất cùng `id`.
- Ngưỡng hồi quy suy từ baseline thì khai vào block `thresholds` của k6 script kèm comment trỏ `id` — **ghi rõ là ngưỡng hồi quy, KHÔNG phải SLA** (không có NFR thì không được bịa số).
- 1 mẫu chưa đủ: đo vài lượt khác thời điểm để biết biên độ dao động rồi mới chốt mốc.

## Outputs

| Output | Vị trí |
|---|---|
| Load report | `<TASK_OUTPUT_DIR>/reports/load-report.md` + `load-report.json` (+ `k6-summary.json`) |
| Baseline (opt-in) | `knowledge/metrics/perf-baselines.jsonl` — 1 dòng/lần đo, local-only |

## Decision Rules

- Ngưỡng lấy từ NFR/SLA khai trong k6 `thresholds` (đừng bịa số). Không có threshold → report metric, không verdict.
- Verdict PASS/FAIL = k6 threshold ok flags.
- Không chạy nếu chưa `--confirm-nonprod`; không chạy trên prod.

## Constraints

- k6 KHÔNG vào `package.json` deps (binary ngoài); thiếu → skip sạch.
- Không nhét k6 vào runner Playwright (`tests/load/` bị testIgnore trong playwright.config).
- Không chạy tải lớn không kiểm soát trên môi trường dùng chung.
- Không nhắm production trong mọi trường hợp.

## Anti-Patterns

- Dùng Playwright/Katalon để giả lập nghìn VU (sai công cụ — Katalon là functional UI/API, không phải load).
- Chạy load mặc định/auto trong pipeline mà không xác nhận non-prod.
- VU/duration lớn trên UAT dùng chung không phối hợp → tự DoS.
- Bịa ngưỡng thay vì lấy từ NFR.
- Truyền `--vus/--duration` cho script có `stages` rồi tưởng đã chạy stress — thực tế là load phẳng, kết luận "chịu được tải" là SAI.
- Soak dài hơn TTL token (30′ ở UAT) mà không refresh → 401 hàng loạt, đọc nhầm thành hệ thống gãy dưới tải.

## Related

- [[perf_check]] — Loại A single-user (trong kit, Playwright). load_check là Loại B (tool ngoài).
- mục 16 `prompt_templates/phase1/02_gen_testcases.md` (load = opt-in tool ngoài).
- JMeter là lựa chọn thay thế nếu team đã chuẩn hoá; k6 hợp kit JS/CLI/CI hơn. Katalon KHÔNG phải load tool.
