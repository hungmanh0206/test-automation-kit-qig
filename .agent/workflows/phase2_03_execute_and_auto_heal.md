# Phase 2 - Bước 3: Execute Và Auto-Heal

> Chạy test thật, phân tích fail/skip/flaky và sửa root cause thuộc automation/setup.

## Mục Đích

Giảm skip/fail giả, đảm bảo case pass thật sự validate đúng behavior và fail còn lại được phân loại rõ.

## Workflow

1. Chạy targeted test theo scope đã xác nhận.
2. Lưu result/evidence dưới task output hoặc run-scoped folder.
3. Phân loại từng case:
   - PASS
   - FAIL
   - SKIP
   - FLAKY/BLOCKED nếu cần
   - `setup_failure`: fail ở bước setup/verify precondition (Precondition Resolution Pass) — sửa setup rồi rerun, KHÔNG kết luận product bug, KHÔNG log Jira.
   - `BLOCKED_SETUP` / `SKIP_SETUP`: precondition chưa đủ Definition of Ready (thiếu capability API/hook/mock/sandbox/fixture hoặc contract chưa đủ) — ghi missing capability cụ thể, không connect DB, không phải product bug, không log Jira.
4. Với FAIL/SKIP do automation/setup/data/auth/timeout/dependency:
   - Sửa root cause.
   - Rerun targeted.
   - Không đổi expected result khi chưa có bằng chứng requirement sai.
   - Nếu FAIL do locator không tìm thấy element **và** `LOCATOR_HEAL=1`: áp dụng `.agent/rules/locator_healing_policy.md` (skill `locator_healing_agent`, threshold-gated). Chỉ heal locator bước ACTION/điều hướng với confidence cao (accessible name exact + role + vùng DOM) → ghi `locator_auto_healed: true` vào Auto-heal notes + lịch sử `knowledge/locators/`. Locator bước ASSERTION hoặc confidence thấp → KHÔNG heal, phân loại `setup_failure`/escalate như `BLOCKED_SETUP`.
5. Với fail nghi product bug:
   - Rerun đủ vòng để loại flaky/setup.
   - Thu evidence ảnh/video phù hợp (log/response chỉ là diagnostic local).
   - **Viết bug claim TRƯỚC khi nói chữ "bug" ra ngoài** (RULE_GLOBAL §Bug Claim Gate):
     `npm run bug:claim:new -- --new <TC_ID>` để tạo nháp, điền đủ, rồi `npm run bug:claim` để kiểm.
     Chưa qua máy thì chỉ được gọi là **quan sát bất thường**, và câu hỏi cho user là "có log không",
     không phải "có phải bug không".
     Vì sao bước này ở đây chứ không ở `phase2_04`: bar khẳng định bug nằm ở 04 với khoảng tám điều
     kiện, nhưng lời nói ra ở 03 với hai điều kiện. Chính khoảng lệch đó đẻ ra những lần phát hiện
     sai rồi phải rút lời.

## Đo suite có bắt được bug không (band high, định kỳ)

`TASK_ENV=... npm run mutation:check -- --catalog <ui_catalog.json>` — bóp méo response ở tầng `page.route()`
rồi xem suite có ĐỎ không. Đây là thứ DUY NHẤT trả lời "suite xanh vì app đúng, hay vì suite không kiểm gì".
Không chạm dữ liệu thật (chỉ méo response trên đường về browser). Không đưa vào CI vì cần app sống + catalog;
chạy khi task có case band *high*, hoặc sau khi sửa assertion diện rộng. Mutant "survived" = chỗ suite mù.

## Rules

- Không skip testcase chỉ để tăng pass rate.
- Mỗi skip phải có TC ID, lý do, khả năng fix và quyết định đã ưu tiên fix hay chưa.
- Evidence ảnh/video không được trắng hoặc không liên quan testcase.
- Case phức tạp mà ảnh không mô tả đủ thì cần video.
- Không coi pass nếu assertion chỉ kiểm tra trang/API “có phản hồi” chung chung.
- Locator healing (nếu bật `LOCATOR_HEAL=1`) chỉ để chạm tới assertion, KHÔNG đụng phán quyết PASS/FAIL; không heal locator assertion; assertion vẫn fail sau heal = bug thật, report bình thường.

## Outputs

| Output | Vị trí |
|---|---|
| Playwright result | `<TASK_OUTPUT_DIR>/test-results/` |
| Evidence | `<TASK_OUTPUT_DIR>/test-results/artifacts/` hoặc run folder |
| Auto-heal notes | Execution summary |
| Fail/skip classification | Execution summary (gồm `setup_failure` tách khỏi product bug) |
| Cleanup status | Execution summary mục `Precondition Resolution` (rollback theo `RUN_ID`) |
| Locator heal history (nếu bật) | `knowledge/locators/` + nhãn `locator_auto_healed` trong Auto-heal notes |
