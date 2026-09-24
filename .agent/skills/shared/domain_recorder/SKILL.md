---
name: domain_recorder
description: Ghi business rule ĐÃ ĐƯỢC XÁC NHẬN vào knowledge/domain/ (versioned, có source + examples cụ thể, trace covered_by) để oracle của testcase luôn trích được nguồn thay vì suy từ app.
---

# Domain Recorder — lưu "đúng là gì", không chỉ lưu "cái đã sai"

## Purpose

Kit **cấm oracle tautological**: expected phải lấy từ spec/business rule, KHÔNG suy từ app đang chạy
(prompt gen §12/§13, `output_gate.looksTautology`). Nhưng nếu knowledge chỉ lưu **bug history** (cái đã sai)
mà không lưu **business truth** (cái đúng), agent buộc phải đọc lại Backlog/tài liệu nguồn mỗi lần — dễ miss —
hoặc suy từ app, rơi đúng vào tautology bị cấm.

Skill này lấp chỗ đó: mỗi rule nghiệp vụ **đã được người có thẩm quyền chốt** → 1 file JSON trong
`knowledge/domain/` (schema ở `knowledge/SCHEMA.md` §domain/), tái dùng xuyên task.

## Điều kiện ghi (BẮT BUỘC)

Chỉ ghi khi **cả 3** thoả:
1. **Đã được xác nhận** bởi `BA` / `Dev` / `QA-Lead` / `PO` — không ghi phỏng đoán của agent.
2. **Truy nguyên được**: `source` trỏ tài liệu + mục cụ thể, hoặc "BA confirm <ngày>". Không có nguồn → không ghi.
3. **Kiểm được**: ≥1 `examples` dạng `{input, expected}` với **số/giá trị cụ thể** (không "hiển thị đúng").

Chưa đủ 3 điều kiện thì rule vẫn thuộc `reports/phase1-clarifications.md` (đang chờ làm rõ), **không** vào knowledge.

## Điểm bắt tự nhiên nhất: sau khi Ambiguity Gate RESOLVED

Câu trả lời của BA/QA cho `reports/phase1-clarifications.md` **chính là business truth vừa được xác nhận**.
Ngay sau khi gate chuyển `AMBIGUITY_GATE: RESOLVED` (workflow `phase1_01_prepare_context.md` bước 7):

1. Với mỗi câu Blocking đã được trả lời → chuyển thành 1 rule `domain/` (hoặc bump version rule đã có).
2. Điền `source` = "clarification <TASK_KEY> Q<n> + <ai> confirm <ngày>" (hoặc tài liệu gốc nếu câu trả lời trích tài liệu).
3. Khi sinh testcase, TC nào dùng rule làm oracle thì thêm TC ID vào `covered_by` của rule đó.

Nguồn khác cũng hợp lệ: rule mới trong FSD/BRD đã được BA chốt · quyết định trong buổi review · dev
xác nhận hành vi đúng khi triage bug (khi đó `confirmed_by: Dev`).

## Vòng đời (không chỉ ghi thêm)

| Tình huống | Làm gì |
|---|---|
| BA đổi rule | **Bump `version`**, cập nhật `confirmed_at`/`source`, set `supersedes: <id>@v<n-1>` |
| Rule cũ còn cần để giải thích test cũ | Giữ file, đổi `status: superseded` (mỗi `id` chỉ được **1** bản `active`) |
| Rule bị bỏ hẳn | `status: deprecated` + ghi lý do trong `source` |
| TC đã execute TRƯỚC `confirmed_at` mới | TC **stale** → phải chạy lại (script báo) |

## Kiểm tra

```bash
npm run domain:check                 # validate schema + PII + trace covered_by + stale
npm run domain:check -- --enforce    # lỗi schema/PII → exit 1
node scripts/qa/domain_rules.js --index   # đưa rule vào knowledge/index.json (tra theo module/tag)
```

`--trace` báo `covered_by` trỏ TC **không tồn tại** (rule tưởng đã test nhưng không) và rule `active`
mà `covered_by` rỗng (**coverage gap**: có sự thật nghiệp vụ nhưng chưa ai test).

## Constraints

- **Suggest-only**: knowledge không tự quyết PASS/FAIL; agent/QA đọc rồi quyết.
- **Không PII/secret** (validator chặn email/SĐT).
- **Không mô tả UI/label** ở đây — oracle hiển thị thuộc `requirements/ui_catalog.md` (per-task).
- **Không lưu thứ tính được** (coverage %, pass rate) — tính lại từ nguồn.
- Rule phát biểu ở mức **nghiệp vụ**, không nhắc tên hệ thống/URL cụ thể nếu tránh được.

## Anti-Patterns

- Ghi rule do agent tự suy từ app đang chạy (đúng thứ tautology mà kit cấm).
- `examples.expected` chung chung ("đúng", "thành công") → rule vô dụng làm oracle.
- Sửa nội dung rule mà **không** bump `version` → TC stale không bị phát hiện.
- Để `covered_by` rỗng mãi → rule không bao giờ được test, KB thành tài liệu chết.

## Related

- `knowledge/SCHEMA.md` §`domain/` — schema đầy đủ.
- [[learning_recorder]] — ghi **cái đã sai** (bug/root cause); skill này ghi **cái đúng**. Hai nửa của learning loop.
- `.agent/workflows/phase1_01_prepare_context.md` bước 7 (Ambiguity Gate) — điểm bắt rule.
- prompt gen `02_gen_testcases.md` §12/§13 — nơi oracle phải trích nguồn.
