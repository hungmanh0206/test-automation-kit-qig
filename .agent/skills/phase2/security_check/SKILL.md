---
name: security_check
description: Kiểm security BASIC non-destructive (headers/cookie, unauth, authz/IDOR 2 tài khoản, exposure) qua GET read-only trên UAT. Control → PASS/FAIL; exposure → finding (mask PII). Never-auto, cần xác nhận non-prod.
---

# Security Check (Basic, non-destructive)

## Purpose

Biến phần **deterministic** của mục 15 thành đo thật: `scripts/qa/security_check.js` kiểm security
headers + cookie flags, truy cập chưa auth, ma trận authz + IDOR (2 tài khoản test), dò sensitive-data
exposure. Chỉ **phát hiện**, không khai thác.

## Mức tự chủ: Never-auto + yêu cầu authorize

- **Chỉ chạy khi user yêu cầu tường minh** và truyền `--confirm-nonprod` (hoặc `SECURITY_CHECK_CONFIRM=1`)
  — xác nhận target **NON-PROD** và được phép kiểm thử. Không có xác nhận → script từ chối chạy.
- Control xác định → PASS/FAIL. Exposure (heuristic) → FINDING review (không verdict cứng).

## RANH GIỚI AN TOÀN (BẮT BUỘC)

- **Chỉ GET / read-only**; KHÔNG mutate dữ liệu.
- **KHÔNG** fuzzing, **KHÔNG** khai thác SQLi/XSS làm đổi dữ liệu, **KHÔNG** brute-force/đập rate-limit (dễ sập UAT).
- Fuzzing/quét sâu → **OWASP ZAP opt-in**, Manual-only, chỉ chạy khi có phê duyệt người + target non-prod rõ.
- **Chỉ dùng tài khoản test** (A/B) và resource của chính account test — KHÔNG probe resource khách hàng thật.
- **Report MASK mọi PII/secret** (không dump raw) — theo org rule (không xuất Email/SĐT khách) + posture mask-PII.

## Inputs / chạy

```
TASK_ENV=profiles/<TASK>/task.env node scripts/qa/security_check.js --catalog <.../security_catalog.json> --confirm-nonprod
```
Catalog: block `security` — `requiredHeaders`, `protectedEndpoints`, `highPrivEndpoints`, `idorEndpoints`,
`auth` (login lấy token), `accounts.low/high` (env tài khoản test), `sensitiveKeys`. Schema ở `scripts/qa/README.md`.

## Outputs

| Output | Vị trí |
|---|---|
| Security report | `<TASK_OUTPUT_DIR>/reports/security-report.md` + `security-report.json` |

## Khi dùng / KHÔNG dùng

| Dùng | KHÔNG dùng |
|---|---|
| Scope có auth, phân quyền, hoặc dữ liệu cá nhân | Môi trường chưa khai rõ là non-prod (thiếu `--confirm-nonprod` ⇒ TỪ CHỐI) |
| Có đủ **hai** tài khoản test (low + high) | Chỉ có một tài khoản ⇒ authz/IDOR là `NEEDS_ACCOUNT`, KHÔNG phải FAIL |
| Cần kiểm header, cookie, unauth, IDOR ở mức cơ bản | Pentest sâu, fuzzing, brute-force, DoS — Manual-only, opt-in, có người duyệt |

⚠️ **Never-auto.** Skill này chạm UAT nên theo non-negotiable §2 phải **xác nhận với user trước MỖI lượt**.
Không có lượt "chạy thử cho nhanh".

⚠️ **`NEEDS_ACCOUNT` không phải FAIL, và cũng không phải PASS.** Thiếu tài khoản thì phép đo chưa xảy ra —
đúng nguyên tắc "không phán được KHÔNG thành PASS". Route nó qua `precondition_setup_planner` như một
capability còn thiếu.

## Máy kiểm

- `npm run security` — bộ kiểm cơ bản, chỉ GET read-only, cần `--confirm-nonprod`.
- `npm run dim:coverage -- --enforce` — chiều `security` khai `n/a` mà scope có auth/quyền thì CHẶN.
- `npm run system:check` — ô `role × action` trong `PM-*` đang ở mức `unknown` thì **KHÔNG được dùng làm
  oracle**: khẳng định 403 ở một ô chưa ai chốt là tự bịa ra một yêu cầu, và bug log ra là bug bịa.
- `npm run gate:output` — exposure finding phải mask PII trước khi vào report.

> **Phát hiện có sẵn trong môi trường thì đừng nhân bản nó.** Đã đo một lần: payload XSS lưu trữ nằm trong
> UAT hơn một năm, nên mọi case XSS chạy sau đó đều "phát hiện" lại cùng một thứ. Một phát hiện, một bug —
> không phải một bug mỗi case.

## Decision Rules

- Headers PASS/FAIL so **tập header khai trong catalog** (không hardcode universal — tránh false-positive SPA/API).
- Unauth: protected endpoint không token → PASS nếu 401/403 + không trả data.
- AuthZ vertical: low role gọi high-priv → PASS nếu 403. IDOR: low đọc resource user khác → PASS nếu 403/404.
- **Thiếu 2 tài khoản test** (`accounts.low/high` + env) → authz/IDOR = `NEEDS_ACCOUNT` (không phải FAIL); route như `needs_account` (precondition_setup_planner + capability-request).
- Exposure → FINDING (đã mask), để review, không PASS/FAIL cứng.

## Constraints

- Không chạy nếu chưa `--confirm-nonprod`.
- Không mutate, không fuzzing/brute-force.
- Không ghi raw PII/secret vào report.
- Không thay pentest chuyên sâu (ZAP/Burp) — đó là Manual-only opt-in.

## Anti-Patterns

- Biến script thành pentest tool (fuzz/exploit/brute-force).
- Hardcode danh sách header bắt buộc → false-positive.
- Probe resource người dùng thật thay vì account test.
- Dump raw token/PII vào report.

## Related

- `scripts/qa/accessibility_check.js` — cùng khuôn.
- [[perf_check]] — cặp non-functional executable.
- [[precondition_setup_planner]] — `needs_account` khi thiếu 2 tài khoản test.
- mục 15 `prompt_templates/phase1/02_gen_testcases.md`.
- [[learning_recorder]] — ghi security finding đã confirm theo module (risk-based).
