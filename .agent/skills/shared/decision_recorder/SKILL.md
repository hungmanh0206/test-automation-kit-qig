---
name: decision_recorder
description: Ghi LÝ DO của quyết định QA đã chốt vào knowledge/decisions/ (false positive, by design, override risk, PASS-kèm-note, cách test) và TRA CỨU nó trước khi log bug, để không kết luận lại từ đầu và không log lại bug đã bị Rejected.
---

# Decision Recorder — lưu "vì sao đã kết luận thế", không chỉ lưu kết luận

## Purpose

Kit đã lưu được: "cái đúng" ([[domain_recorder]]), "hệ thống được phép làm gì" ([[system_mapper]]),
"cái đã sai" ([[learning_recorder]]). Còn thiếu thứ **đắt nhất**: **vì sao đã kết luận như thế**.

| Quyết định đã chốt | Không lưu thì lần sau |
|---|---|
| "triệu chứng X không phải bug — dev đã đọc code, Jira Rejected" | **log lại đúng bug đó** → dev bounce, mất uy tín cả bộ report |
| "case Y ghi PASS kèm note vì vướng data/env, không phải defect" | **FAIL đỏ oan** hoặc log bug sai layer |
| "module Z hạ band High→Medium vì lý do nghiệp vụ" | mỗi lần chạy `risk` lại phải override tay |
| "cách test W không dùng được (lý do kỹ thuật cụ thể)" | mò lại từ đầu, tốn đúng số giờ đã tốn lần trước |

Hiện chúng nằm trong output của task rồi **chết theo task** — hoặc chỉ còn trong đầu người làm.

## BẮT BUỘC: tra trước khi kết luận

Trước khi log bug (và trước khi chốt một case là FAIL do product):

```bash
node scripts/qa/decisions.js --check "<triệu chứng đúng như mình vừa thấy>" [--module <Module>]
```

Nếu ra một quyết định `false_positive`/`by_design` khớp triệu chứng ⇒ **KHÔNG log lại**. Muốn log thì phải
có **bằng chứng MỚI khác lần trước** (spec đã đổi, dev fix rồi hồi quy, điều kiện khác) — và ghi rõ điểm khác đó
trong bug, nếu không dev sẽ đóng lại y như lần trước.

> Không khớp ≠ được phép bỏ qua điều tra. Chỉ nghĩa là chưa ai từng kết luận (hoặc chưa ai ghi lại).

## Khi nào ghi

1. **Bug bị Rejected / Won't Do / "đúng thiết kế"** — ghi ngay khi dev trả lời, kèm **lý do dev đưa ra**
   (`decided_by: Dev`). `npm run decisions:check` sẽ nêu tên (`‼`) mọi bug `Rejected` chưa có lý do lưu lại.
2. **Case ghi PASS kèm note** vì vướng data/env (không phải defect) → `type: blocked_pass`, khoanh `scope.tc_ids`.
3. **QA override risk band** → `type: risk_override`, khoanh `scope.modules`. `npm run risk` sẽ nhắc lại
   override này ở lần chạy sau (suggest-only — vẫn không tự đổi band).
4. **Chốt cách test sau khi thử thất bại** → `type: test_approach` (vd sandbox không hỗ trợ, phải verify bằng API).
   Loại này thường **tạm thời** ⇒ đặt `expires_at` để buộc kiểm lại, thay vì thành sự thật vĩnh viễn.

## Điều kiện ghi

- `rationale` phải nêu **VÌ SAO** (bằng chứng / ai xác nhận / code-spec nào). Dưới 20 ký tự = **CHẶN** —
  bản ghi không có lý do thì lần sau vẫn phải điều tra lại, tức là vô dụng.
- `subject` viết đúng **triệu chứng như lần đầu gặp** (chữ mình sẽ dùng để tìm), không viết kiểu tổng kết.
- `false_positive` **phải** do `Dev`/`BA`/`QA-Lead`/`PO` chốt — agent/QA **không** tự kết luận. Ghi bừa loại này
  là **dập luôn một bug THẬT** ở task sau: nguy hiểm hơn hẳn việc không ghi gì.
- `scope` phải có ≥1 trong `modules`/`tc_ids`/`bug_keys` — không khoanh thì quyết định bị áp sai chỗ.
- Không PII/secret (validator chặn email/SĐT).

## Vòng đời

Điều kiện đổi (dev fix, spec đổi, sandbox mở lại) → **không sửa đè**: đặt bản cũ `status: superseded` rồi ghi
bản mới. `expires_at` quá hạn mà còn `active` → cảnh báo phải kiểm lại. Mỗi `id` chỉ **1** bản `active`.

## Dùng

```bash
npm run decisions:check                  # validate + bug Rejected chưa có lý do + quyết định quá hạn
npm run decisions:check -- --enforce     # lỗi schema/PII → exit 1
node scripts/qa/decisions.js --check "<triệu chứng>" --module Payment
node scripts/qa/decisions.js --index     # đưa vào knowledge/index.json
```

## Anti-Patterns

- Ghi `false_positive` bằng suy luận của chính mình → lần sau bug thật bị bỏ qua.
- `rationale` kiểu "dev nói không phải bug" mà không có lý do → không tái sử dụng được, chỉ là tin nghe lại.
- Ghi quyết định tạm thời **không** `expires_at` → hạn chế tạm thời hoá thành luật vĩnh viễn.
- Sửa đè bản ghi cũ khi điều kiện đổi → mất lịch sử, không giải thích được kết quả test cũ.
- Dùng `decisions/` để lưu bug (đã có `bugs/`) hoặc business rule (đã có `domain/`).

## Related

- `knowledge/SCHEMA.md` §`decisions/` — schema đầy đủ.
- [[learning_recorder]] · [[domain_recorder]] · [[system_mapper]] — 3 nửa còn lại của bộ nhớ.
- `.agent/workflows/phase2_04_report_and_jira_gate.md` bước 4 — điểm tra cứu bắt buộc trước khi log bug.
