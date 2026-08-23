# CI/CD — Test Automation Kit

4 workflow GitHub Actions (bản GitLab tương đương ở `.gitlab-ci.yml` root). Dùng GitHub thì xoá `.gitlab-ci.yml`, và ngược lại.

## Workflows

| File | Trigger | Vai trò | Cần secret? |
|---|---|---|---|
| `static-check.yml` | **mỗi push/PR** | **preflight config/context integrity (G1)** + `node --check` toàn bộ script + validate JSON config/knowledge + dry-run an toàn (dashboard rỗng, risk cold-start, security-guard từ chối). Bắt vỡ tooling. | ❌ Không |
| `integration-check.yml` | **manual** | Kiểm kết nối Jira/Confluence/**AIO Tests** + **dry-run** publish/bug (KHÔNG ghi thật). | ✅ JIRA/AIO/CONFLUENCE |
| `task-execute.yml` | **manual** (dispatch task_key/suite) | Phase 2 task-scoped, sharded + risk-gate + artifact theo task. Chỉ chạy spec **đã committed**. | ✅ OPS (+JIRA nếu cần) |
| `ci.yml` | **nightly + manual** (KHÔNG every-push) | Live regression sharded → gộp 1 HTML report. `--pass-with-no-tests` khi chưa có spec. | ✅ OPS |

> **Vì sao chia vậy:** kit là AI-agent-driven; Phase 1/2 do agent sinh testcase/automation (CI không tái tạo được), và automation per-task nằm trong `outputs/` (gitignored). Nên **regression thật chỉ có nghĩa sau khi promote spec ổn định vào `tests/fe|api`** (human gate). Trong lúc đó, `static-check` là CI giá trị-thật-ngay.

## Secrets (Settings → Secrets and variables → Actions)

| Secret | Dùng cho |
|---|---|
| `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` | integration check, dry-run publish/bug |
| `AIO_API_TOKEN` | AIO Tests (test-management tool mặc định; Xray đóng băng sau 21/08/2026) |
| `CONFLUENCE_URL`, `CONFLUENCE_USERNAME`, `CONFLUENCE_API_TOKEN` | integration check Confluence |
| `OPS_BASE_URL`, `OPS_USERNAME`, `OPS_PASSWORD` | login khi execute FE/regression |
| ~~`METRICS_PUSH_TOKEN`~~ *(BỎ 23/08/2026)* | Từng bật commit-back metrics vào `knowledge/metrics/`. Không dùng nữa: `knowledge/**` đã bỏ track (dữ liệu công ty) nên `git add` không stage được gì — tính năng chết mà job vẫn xanh. KPI ngắn hạn ở artifact; dài hạn `npm run knowledge:backup`. **Xoá biến này khỏi CI variables nếu đã tạo.** |

CI nạp qua **env từ secrets**, KHÔNG tạo file `.env` (đúng rule kit: không commit secret/token/cookie).

> **Khai nhanh (GitLab):** `bash scripts/ci/set-gitlab-variables.sh` (dry-run) → `--apply` để set thật. Script đọc `.env.local` (+ `--ops-from <profile>` cho OPS) và đẩy qua `glab` — chạy **trên máy bạn** sau `glab auth login`; token/password set masked+protected, KHÔNG in giá trị. Cần `glab` cài sẵn.

## Persistence metrics (F10/F11 — artifact-only từ 23/08/2026)

KPI (`runs.jsonl`) + độ tin cậy per-TC (`tc-history.jsonl`) + reliability index chỉ có nghĩa khi **tích luỹ xuyên run**, mà mỗi CI checkout là ephemeral. Kit từng chọn **Option A: commit-back vào `knowledge/metrics/`**. Cách đó **đã bỏ**, vì nó lặng lẽ chết:

- Commit `2d383e1` bỏ track `knowledge/**` (dữ liệu công ty, đối xử như `.env`) ⇒ `git add knowledge/metrics/...` không stage được gì.
- Đoạn script có `|| true` + `git diff --cached --quiet` nên job **vẫn xanh** và in `(persistence) metrics khong doi` — người đọc log tin là "không có gì thay đổi", trong khi thực tế **không còn tích luỹ gì cả**.

Hiện tại:
- **Ngắn hạn**: KPI nằm trong artifact của job `merge-report` (`knowledge/metrics/`, giữ 2 tuần).
- **Dài hạn**: `KNOWLEDGE_BACKUP_DIR=<thư mục NGOÀI repo> npm run knowledge:backup` — `preflight` cảnh báo khi kho có record không-nạp-lại-được mà chưa khai đích sao lưu.
- **`METRICS_PUSH_TOKEN` không còn được đọc.** Nếu đã tạo Project Access Token cho việc này thì **xoá khỏi CI Variables** (và revoke token) — biến sống mà không ai dùng là bề mặt tấn công không lý do.
- Muốn lịch sử dài hạn **ngay trong CI** thì phải dựng backend ngoài repo (bucket/DB/private repo riêng). Đó là quyết định của chủ repo — kit không tự chọn hộ, và không giả vờ đang làm việc đó.

## An toàn (bắt buộc)

- **Không auto publish/log Jira**: publish testcase / log bug thật cần `--qa-approved` (hành động local). CI chỉ dry-run. Muốn publish thật trong CI → tạo **GitHub Environment có required reviewers** rồi mới thêm job publish vào đó.
- **Secrets chỉ cho protected branch, KHÔNG expose cho fork PR** (tránh lỗ hổng `pull_request_target`). `static-check` (chạy trên PR) cố ý **không dùng secret**.
- **Live regression chỉ non-prod, không every-push**: hit UAT thật → để nightly/manual, không mutate dữ liệu UAT (đúng rule non-destructive). `OPS_BASE_URL` phải trỏ UAT/staging.
- **Mobile-native (Appium) không nằm trong CI này**: cần runner riêng (Android emulator trên Linux; iOS cần macOS runner / device farm).

## Gotchas kỹ thuật

- `playwright.config.js` **throw nếu thiếu `PROJECT_OUTPUT_DIR` + `TASK_KEY`** khi load → các job chạy `playwright test` đã set sẵn 2 biến này (`outputs/ci` + `CI-REGRESSION` cho regression; theo input cho task-execute).
- `--pass-with-no-tests` cần `@playwright/test >= 1.44` (kit dùng `^1.60` → OK).
- Sharding: mỗi shard set `RUN_ID` riêng → output không đè; các shard xuất `--reporter=blob`, job cuối `merge-reports --reporter=html` gộp 1 HTML.
- GitLab: `parallel: 4` + `--shard=$CI_NODE_INDEX/$CI_NODE_TOTAL`, image `mcr.microsoft.com/playwright` (browser cài sẵn — đổi tag khớp version).
