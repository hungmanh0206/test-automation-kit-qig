---
name: system_mapper
description: Ghi bản đồ HỆ THỐNG đã xác nhận vào knowledge/system/ (state machine · ma trận phân quyền · surface dùng chung) để trả lời được "hành vi này là bug hay đúng thiết kế" và "sửa chỗ này phải regression đâu" mà không suy từ app.
---

# System Mapper — bản đồ hệ thống, không phải tài liệu để ngắm

## Purpose

[[domain_recorder]] lưu **"giá trị đúng là gì"**. Nhưng nhiều câu hỏi khi test không về giá trị mà về **hệ thống**:

| Câu hỏi thật gặp | Không có bản đồ thì | Có bản đồ thì |
|---|---|---|
| "API cho huỷ order đã PAID — bug hay đúng thiết kế?" | app cho làm ⇒ tưởng hợp pháp (tautology) hoặc log bug đoán → dev bounce | `SM-ORDER-001` không khai `PAID → CANCELLED` ⇒ **bug có nguồn trích dẫn** |
| "GV gọi được endpoint Admin — lỗ hổng?" | phải đi hỏi lại | `PM-*` ô `Teacher × cancel` không trong `allow` ⇒ phải 403 |
| "sửa API này regression những gì?" | đoán theo tên module | `SS-*.consumers` liệt kê đúng module phải chạy lại |

Điểm khác biệt so với tài liệu thường: bản đồ này **sinh ra nghĩa vụ test**. Cặp state không khai = phải chứng
minh bị chặn; ô `deny` = phải có case guard. `system_map.js` liệt kê đúng những nghĩa vụ còn trống.

## Điều kiện ghi (BẮT BUỘC)

Giống `domain/`: (1) **đã được** `BA`/`Dev`/`QA-Lead`/`PO` chốt — không ghi phỏng đoán của agent;
(2) **truy nguyên được** — `source` trỏ tài liệu + mục cụ thể (hoặc "Dev confirm <ngày>"); (3) **kiểm được** —
`illegal_verified.expected` / `deny_expected` phải có mã lỗi, tên state, hoặc số cụ thể.

> ⚠️ **Cấm dựng bản đồ bằng cách thử API rồi ghi lại kết quả.** Đó là chép hành vi app thành "thiết kế" —
> nếu app đang sai thì bản đồ hợp thức hoá luôn cái sai, và mọi TC sau đó không bao giờ bắt được bug đó.
> Bản đồ đến từ **spec/người chốt**; app là thứ bị đem ra đối chiếu.

## 3 loại (schema đầy đủ: `knowledge/SCHEMA.md` §`system/`)

- **`state_machine`** (`SM-<SLUG>-<NNN>`) — `states`/`initial`/`terminal` + `transitions[]` chỉ khai **cái hợp pháp**
  + `illegal_verified[]` (cặp bất hợp pháp đã có case chặn). Ưu tiên khai `terminal` cho đúng: chuyển ra khỏi state
  chốt (đã thanh toán, đã huỷ, đã khoá) là chỗ sinh bug toàn vẹn dữ liệu.
- **`permission_matrix`** (`PM-<SLUG>-<NNN>`) — `roles` × `actions`, `allow` là **whitelist** (ô không khai = deny),
  `deny_expected` là oracle chung cho mọi case guard.
- **`shared_surface`** (`SS-<SLUG>-<NNN>`) — API/component/bảng/job dùng bởi **≥2** module: `consumers` +
  `paths` (glob code, để đối chiếu git-impact) + `risk_note` ("sửa cái này thì hỏng chỗ nào").

## Điểm bắt

1. **Đọc tài liệu (Phase 1)**: FSD/BRD gần như luôn có bảng trạng thái + ma trận phân quyền → chuyển thành record.
2. **Sau Ambiguity Gate RESOLVED**: câu trả lời của BA về luồng trạng thái/quyền là bản đồ vừa được chốt.
3. **Khi triage bug**: dev nói "cái này chặn ở BE rồi, không cho phép" → đó là 1 cặp bất hợp pháp được xác nhận
   (`confirmed_by: Dev`) — ghi vào `illegal_verified` kèm TC vừa chứng minh.
4. **Khi lập scope regression**: phát hiện 2+ module dùng chung 1 API/component → ghi `shared_surface` ngay,
   lần sau khỏi phải suy lại.

## Dùng

```bash
npm run system:check                      # validate + ma trận state + nghĩa vụ test còn trống
npm run system:check -- --enforce         # lỗi schema/PII → exit 1
npm run system:check -- --task <TASK_KEY> # đối chiếu covered_by với TC ID thật của task (bắt TC ma)
node scripts/qa/system_map.js --impact "POST /api/v1/orders"   # ai phải regression nếu sửa surface này
node scripts/qa/system_map.js --index     # đưa bản đồ vào knowledge/index.json
```

`--gaps` xếp `‼` trước: cặp bất hợp pháp **xuất phát từ state terminal** và ô **DENY** chưa có case — đây là
nhóm sinh bug nghiêm trọng nhất (doanh thu, phân quyền) và cũng là nhóm bị bỏ sót nhiều nhất.

## Vòng đời

Giống `domain/`: rule đổi → **bump `version`** + `supersedes: <id>@v<n-1>`, bản cũ `status: superseded`
(mỗi `id` chỉ **1** bản `active`). Đổi `states`/`allow` mà không bump version thì TC cũ không bị phát hiện là stale.

## Constraints

- **Suggest-only**: bản đồ không tự quyết PASS/FAIL; agent/QA đọc rồi quyết.
- **Không PII/secret** (validator chặn email/SĐT). Không ghi URL/credential môi trường.
- Phát biểu ở mức **nghiệp vụ**; tên state/action lấy đúng chữ trong spec để đối chiếu được với UI/API.
- **Không lưu thứ tính được** (số case, coverage %) — tính lại từ nguồn.

## Anti-Patterns

- Dựng `transitions` bằng cách bấm thử app → hợp thức hoá bug thành thiết kế.
- Khai `transitions` cho **cả** cặp bất hợp pháp (kiểu "ghi cho đủ") → mất hẳn khả năng suy ra nghĩa vụ guard.
- `expected` chung chung ("không được", "báo lỗi") → không kiểm được, validator chặn.
- `shared_surface` chỉ 1 consumer → không phải surface dùng chung, chỉ làm nhiễu.
- Ghi bản đồ rồi để `covered_by` rỗng mãi → biết mà không test, tệ hơn không biết.

## Related

- `knowledge/SCHEMA.md` §`system/` — schema + ví dụ đầy đủ.
- [[domain_recorder]] — "giá trị đúng là gì"; skill này — "hệ thống được phép làm gì". Hai nửa của oracle.
- [[learning_recorder]] — ghi cái đã sai (bug/root cause).
- `prompt_templates/phase1/02_gen_testcases.md` §12 — nơi tra bản đồ khi sinh case guard/permission/negative.
- `.agent/workflows/phase2_04_report_and_jira_gate.md` — trước khi log bug "hệ thống cho phép X" phải trích `SM-*`/`PM-*`.
