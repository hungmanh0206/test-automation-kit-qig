# Phase 2 - Bước 2: Generate Hoặc Update Automation

> Sinh/cập nhật Playwright spec/helper đúng testcase, ưu tiên task-scoped automation để chạy song song nhiều story an toàn.

## Mục Đích

Tạo automation có assertion thật, locator/API contract ổn định và không làm giảm chất lượng testcase. Khi nhiều story chạy song song, tránh ghi đè spec/helper của story khác.

## Precondition Resolution Pass (bắt buộc, TRƯỚC khi generate)

Chạy pass này cho toàn bộ selected TC trước khi sinh/cập nhật spec. Selected TC lấy từ **nguồn canonical local theo `TESTCASE_SOURCE`**: mặc định `test-cases/from-aio/*.xlsx` (aio), hoặc `test-cases/*.xlsx` (excel).

1. Đọc selected TC từ nguồn canonical local (theo `TESTCASE_SOURCE`: mặc định `from-aio/*.xlsx`), sau đó đọc `### Precondition Execution Matrix` (và catalog `## Setup Strategy` trong Markdown khi cần chi tiết).
2. Map `Setup Method` của từng TC: `api`/`factory`/`test_hook`/`pre_existing`/`ui`/`manual`.
3. Reuse setup layer dùng chung `tests/support/setup/` (factories/hooks/fixtures/cleanup/contracts); phần đặc thù story tạo task-scoped ở `<TASK_OUTPUT_DIR>/automation/setup/` (namespace `RUN_ID` khi song song); không sửa shared khi story khác đang chạy; không thêm DB client/DB query mới (chỉ dùng guarded client `db/uatPgClient.ts` cho read-only verify UAT).
4. Verify precondition theo `Setup Verification` trước khi chạy assertion chính.
5. Setup/verify fail → `setup_failure` (sửa setup, không phải product bug, không log Jira). `Needs hook` thiếu hook → BLOCKED + đề xuất hook; `Manual-only` → SKIP hợp lệ.
6. Cleanup theo `Cleanup/Rollback` scope `RUN_ID` sau khi chạy.

## Workflow

1. Chọn đúng loại automation:
   - Web UI: Playwright Test.
   - API: Playwright request context.
   - E2E: phối hợp UI/API theo testcase.
2. Xác định vị trí automation:
   - Mặc định dùng `<TASK_OUTPUT_DIR>/automation/`.
   - Nếu cần chạy bằng core suite, dùng file có namespace theo `TASK_KEY`, ví dụ `tests/fe/<TASK_KEY>.spec.js`.
   - Nếu chạy song song cùng một `TASK_KEY`, thêm `RUN_ID` vào folder/file thử nghiệm.
3. Với UI:
   - Inspect DOM thực tế.
   - Ưu tiên locator theo role/label/test id.
   - Tránh selector fragile nếu có lựa chọn ổn định hơn.
4. Với API:
   - Đọc Swagger/OpenAPI hoặc artifact local.
   - Validate status, schema, business field và error contract.
5. Chuẩn hóa test data:
   - Unique theo `TASK_KEY`/timestamp hoặc `RUN_ID` khi cần.
   - Có cleanup/rollback nếu tạo dữ liệu.
6. Không xóa assertion quan trọng hoặc đổi expected result tùy tiện.

7. **GATE CHẤT LƯỢNG CODE — chạy TRƯỚC khi execute, không phải sau khi vỡ:**
   `npm run lint:locator` (soi mới) → `npm run lint:locator:enforce` (CHẶN nếu phát sinh P0 mới so với baseline).
   Phase 1 có `design_gate` chặn testcase kém; khâu sinh CODE trước đây KHÔNG có gate tương đương, nên code
   brittle chỉ lộ ra lúc chạy — và lúc đó nó lộ ra dưới dạng "FAIL" trông như bug sản phẩm.
   Gate bắt: click theo toạ độ · `force: true` · regex trên `body.innerText` · `querySelectorAll('*')` ·
   `.first()`/`.nth()` ở cấp trang · hard-wait ≥5s · **XPath** · **assertion yếu** (`toBeTruthy()` trên giá
   trị đọc từ app — pass với BẤT KỲ chuỗi khác rỗng, kể cả giá trị sai).
   Bỏ qua phải CÓ LÝ DO: `// locator-lint-disable-next-line <lý do>` ngay trên dòng.
   Runtime làm đúng: `scripts/utils/ui/safe_target.js` (`one`/`section`/`clickVerified`/`readValue`).

8. **Case Create/Update/Delete ⇒ kiểm CẢ bản ghi dưới DB (chiều §23, tag `[DbPersist]`):**
   `tests/support/setup/db/dbVerify.ts` — `expectRow` · `expectSoftDeleted` · `expectAbsent` · `expectCount` ·
   `snapshot`+`expectNoChange`. So sánh bằng matcher theo NGHĨA (`money`/`instant`/`text`), KHÔNG so thô:
   cùng khái niệm tiền mà bảng đơn lưu `final_price` kiểu `bigint` còn bảng giao dịch lưu `amount` kiểu
   `varchar` ⇒ so thô đỏ hàng loạt dù DB lưu đúng.
   Vì sao bắt buộc: response API thường ECHO lại request và FE format lại giá trị, nên 7 lớp lỗi (đổi kiểu
   số · lệch múi giờ · cắt `varchar(n)` · xoá mềm hỏng · bảng liên quan không đổi · double-submit · rollback
   sai) đều "UI thấy đúng". Riêng *xoá mềm* và *bảng liên quan* gần như không phát hiện được qua UI.
   BỐN ràng buộc (chi tiết ở `prompt_templates/phase1/dimensions/23_db_persistence.md`):
   - DB là oracle **PHỤ** — nguồn sự thật vẫn là FSD/`BR-*`. Lấy số từ DB rồi bảo "UI phải giống DB" là tautology.
     Giá trị chính là KHOANH TẦNG: UI đúng + DB sai ⇒ BE lưu sai; UI sai + DB đúng ⇒ FE render sai.
   - Chỉ dùng cột **ĐÃ NEO** trong `.agent/config/db.conventions.json → fieldMap.anchored` (hiện 7 cột). Cột
     ở `unanchored` (11 cột) KHÔNG được dùng để phán — đoán sai cột thì kết luận vẫn ra, lại có số từ DB.
   - Chỉ verify bản ghi do CHÍNH lượt test tạo (`id`/`RUN_ID`); `snapshot`/`expectNoChange` phải khai `columns`.
   - DB **KHÔNG phải evidence** (evidence vẫn là ảnh/video); và KHÔNG dựng precondition bằng DB.
   Điều kiện chạy: `profiles/<TASK>/task.env` có `LIB_MASTER_DB_RO_*` (role CHỈ ĐỌC). Nghiệm thu role:
   `INFRA_VERIFY=1 … npx playwright test tests/support/setup/db/readonly.verify.spec.ts --project=infra-verify`


## Rules

- Không mock/stub logic chính nếu testcase cần validate behavior thật.
- Không hardcode secret, credential hoặc token trong spec.
- Không sửa shared helper/page object/fixture/config nếu story khác đang execute, trừ khi user xác nhận.
- Nếu phải sửa shared helper, ghi rõ trong report: file đã sửa, lý do, story bị ảnh hưởng và regression scope đã rerun.
- Không để spec task-specific mặc định thành shared regression suite nếu chưa qua review/merge.

## Outputs

| Output | Vị trí |
|---|---|
| Precondition Resolution result | Execution summary mục `Precondition Resolution` (setup method/verify/blocker/cleanup theo TC) |
| Task-scoped spec/helper | `<TASK_OUTPUT_DIR>/automation/` |
| Core spec nếu được approve | `tests/fe/<TASK_KEY>.spec.*` hoặc `tests/api/<TASK_KEY>.spec.*` |
| Test data helper | Theo vị trí hiện có của project, ưu tiên namespace theo `TASK_KEY` |
| Notes về assumption/shared changes | `task.md` hoặc execution summary |
