# Exploratory - Chạy Phiên Khám Phá (Never-auto)

> Entry point nhánh phụ Exploratory. Chỉ chạy khi **user yêu cầu tường minh**. Xem `exploratory/reference.md`.

## Mục Đích

Dò rủi ro mà testcase đã review chưa phủ, trong một timebox có định hướng (charter), rồi sinh draft +
observation + crash log để QA review — KHÔNG tự kết luận PASS/FAIL, KHÔNG tự thêm vào coverage.

## Điều kiện chạy (BẮT BUỘC)

1. User yêu cầu rõ ràng một phiên exploratory (nêu scope/màn/luồng hoặc charter).
2. Có môi trường + account test hợp lệ (từ profile/task.env), đúng rule DB read-only.
3. Không nhằm thay thế Phase 1/Phase 2.

## Workflow

0. **Chọn vùng dò BẰNG DỮ LIỆU** (đừng chọn theo cảm tính — người ta hay chọn vùng mình quen, tức vùng đã an toàn):
   `TASK_ENV=profiles/<TASK>/task.env npm run explore:charter` → 3 charter ứng viên xếp theo điểm đáng-nghi
   (band risk + bug lịch sử + độ mỏng testcase − vùng đã dò gần đây), mỗi cái kèm LÝ DO TỪNG SỐ và tour đề xuất.
   Máy đề xuất, **QA chọn**. Không có `reports/risk-register.json` thì chạy `npm run risk` trước.
1. **Lập charter**: ghi `<TASK_OUTPUT_DIR>/exploratory/session-charter.md` — scope, mục tiêu dò, timebox (vd 30–60'), heuristic tours dự định (SFDPOT/CRUD-boundary/Interruption/Permission/Money — xem reference).
2. **Khám phá theo tour**: chọn 2–3 tour từ [`tours.md`](tours.md) và đi HẾT phép dò của tour đã chọn (phép không áp được thì ghi rõ vì sao); thao tác thật trên UI/API trong scope.
3. **Ghi Observation log** (`observations.md`): mô tả quan sát + bước tái hiện + evidence (ảnh/video); nếu không tái hiện được, ghi rõ "không tái hiện".
4. **Ghi Crash log** (`crash-log.md`): mọi crash/exception/500/JS error tái hiện được, kèm bước lặp lại chính xác.
5. **Sinh Draft testcase** (`draft-testcases.md`): các case đáng chính thức hoá, viết ở dạng gần chuẩn Phase 1 (module, tiền điều kiện, bước, expected dự kiến) — đánh dấu rõ **DRAFT — chưa qua tc_validator, chưa tính coverage**.
6. **Handoff**: 
7. **Kiểm phiên** (bắt buộc trước handoff): `npm run explore:check:enforce` (hoặc `explore:check` để xem trước) — CHẶN nếu thiếu file, quan sát
   thiếu bước tái hiện/evidence, có PII, hoặc draft lọt vào `test-cases/`. Cảnh báo nếu draft chưa có neo
   (`oracle_ref`/app tự mâu thuẫn) — đó là tiêu chí "đáng chính thức hoá".
8. **Đóng vòng học**: `npm run explore:close -- --areas "<vùng đã dò>" --tours "<tour đã dùng>"` → ghi
   `knowledge/explorations/` để phiên sau KHÔNG dò lại chỗ cũ (và `explore:charter` trừ điểm vùng đó).
   - Draft đáng giá → đưa vào Phase 1 backlog, chạy `tc_validator` + mục 17 để chính thức hoá.
   - Nghi product bug → chuyển Main Flow Phase 2 bug triage (rerun + evidence + gate), KHÔNG log Jira ở đây.

## Rules

- Timebox rõ; hết timebox thì dừng và tổng kết, không dò vô hạn.
- Không kết luận PASS/FAIL chính thức; observation ≠ verdict.
- Không mutate business data không rollback được; không gửi mail/side-effect thật nếu không kiểm soát được.
- Không dựng state bằng DB (chỉ verify read-only UAT qua guarded client như rule chung).
- Không ghi secret/PII vào bất kỳ file output nào.
- Draft KHÔNG được tính vào coverage cho tới khi qua `tc_validator` + mục 17.

## Outputs

| Output | Vị trí |
|---|---|
| Session charter | `<TASK_OUTPUT_DIR>/exploratory/session-charter.md` |
| Observation log | `<TASK_OUTPUT_DIR>/exploratory/observations.md` |
| Crash log | `<TASK_OUTPUT_DIR>/exploratory/crash-log.md` |
| Draft testcase (chưa tính coverage) | `<TASK_OUTPUT_DIR>/exploratory/draft-testcases.md` |
| Evidence | `<TASK_OUTPUT_DIR>/exploratory/artifacts/` |
