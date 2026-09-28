# Phase 1 - Bước 1: Chuẩn Bị Context

> Xác nhận scope và thu thập đủ nguồn requirement/design/API trước khi sinh testcase.

## Mục Đích

Đảm bảo agent hiểu đúng task, project output, nguồn tài liệu và phạm vi kiểm thử trước khi tạo testcase.

## Inputs

| Input | Nguồn |
|---|---|
| `TASK_KEY` | User prompt hoặc env |
| `PROJECT_OUTPUT_DIR` | Env hoặc `.agent/config/project_context.md` |
| Requirement/story | Backlog, tài liệu nguồn hoặc artifact local |
| UI/API spec | Figma, Swagger/OpenAPI hoặc artifact local |

## Workflow

1. Echo lại `PROJECT_OUTPUT_DIR`, `TASK_KEY`, `TASK_OUTPUT_DIR`.
2. Nếu yêu cầu hiện tại không nêu rõ `TASK_KEY`, không dùng `TASK_KEY` từ `.env` hoặc context cũ để chạy; phải hỏi lại.
3. Đọc `.agent/config/project_context.md` nếu có.
4. Đọc artifact local trước:
   - `<TASK_OUTPUT_DIR>/task.md`
   - `<TASK_OUTPUT_DIR>/requirements/`
   - `<TASK_OUTPUT_DIR>/reports/phase1-summary.md` nếu đã có
5. Chỉ fetch Backlog/tài liệu nguồn/Figma/Swagger khi artifact local thiếu hoặc user yêu cầu refresh.
6. **Đọc THẬT KỸ, KHÔNG qua loa** toàn bộ tài liệu (mọi mục, bảng, ghi chú, footnote, comment, phụ lục); bóc hết AC/business rule/validation/enum/state & transition/edge/xử lý lỗi/phân quyền/biên; đối chiếu chéo các nguồn và **nêu mâu thuẫn**. Rồi xác định in-scope requirement/business rule/API behavior.
7. **Ambiguity Gate (BẮT BUỘC — gate cứng, chặn sinh testcase):**
   - Rà mâu thuẫn / thiếu rule bắt buộc / expected result không rõ / thiếu data-behavior để sinh case executable.
   - Nếu CÓ điểm mơ hồ mức **Critical/High** thì xuất **danh sách Q&A đánh số** `Q1, Q2...` vào `<TASK_OUTPUT_DIR>/reports/phase1-clarifications.md`. Mức Critical/High nghĩa là ảnh hưởng core flow, ảnh hưởng tính tiền hay bảo mật, hoặc không thể sinh expected đúng.
     Mỗi câu gồm ba phần: câu hỏi rõ ràng, **assumption mặc định đề xuất** tức điều agent sẽ giả định nếu QA đồng ý, và phần scope bị chặn nếu chưa trả lời.
   - Ghi `AMBIGUITY_GATE: PENDING` vào `task.md` và **DỪNG** — chờ QA/BA trả lời hoặc xác nhận chấp nhận assumption.
   - Chỉ khi mọi câu Critical/High đã `RESOLVED`, tức có câu trả lời hoặc QA tick chấp nhận assumption, mới được **phân tích lại và chỉnh** coverage map cùng scope theo câu trả lời. Sau đó đổi `AMBIGUITY_GATE: RESOLVED` rồi mới sang `phase1_02`. KHÔNG gen bằng hiểu biết cũ trước khi chỉnh theo câu trả lời.
   - **Ghi business rule vừa được xác nhận vào `knowledge/domain/`** (skill `domain_recorder`): câu trả lời của BA/QA CHÍNH LÀ business truth — mỗi rule 1 file JSON có `source` + `examples {input, expected}` cụ thể + `version`. Đây là nguồn oracle tái dùng xuyên task, thay vì mỗi lần phải đọc lại Backlog/tài liệu nguồn (dễ miss) hoặc suy từ app (tautology bị cấm). Kiểm: `npm run domain:check`.
   - **Ghi bản đồ hệ thống vào `knowledge/system/`**, dùng skill `system_mapper`. FSD và BRD gần như luôn có **bảng trạng thái** cùng **ma trận phân quyền**: chuyển chúng thành `state_machine` và `permission_matrix`. Thấy API hay component dùng bởi ≥2 module thì ghi `shared_surface`.
     Bản đồ này khác `domain/` ở chỗ nó **sinh ra nghĩa vụ test**. Cặp state không khai thì phải chứng minh bị chặn, ô ngoài `allow` thì phải trả 403. Nó cũng cho phép trả lời "bug hay đúng thiết kế" bằng trích dẫn.
     Kiểm bằng `npm run system:check`, thêm `--task <TASK_KEY>` để bắt `covered_by` trỏ TC không tồn tại.
   - Điểm mơ hồ Medium/Low KHÔNG chặn, nhưng **vẫn phải liệt kê** trong `phase1-clarifications.md` và đánh dấu Non-blocking, để QA thấy hết điểm mờ. QA không trả lời thì tự áp assumption mặc định, ghi vào Coverage Gaps, và vẫn sinh case.

## Rules

- Không sửa `.env` chung khi có thể truyền env theo command.
- Không fetch lại toàn bộ tài liệu nếu snapshot/local summary đã đủ.
- Không tự chuyển sang `partial-rerun`; chỉ dùng nhánh đó khi user yêu cầu xử lý tài liệu đã đổi.
- **KHÔNG tự giả định qua mơ hồ Critical/High rồi sinh case** — phải qua Ambiguity Gate (đối lập với "assume + note" cho mọi mức). Assumption chỉ được tự áp cho mức Medium/Low.

## Outputs

| Output | Vị trí |
|---|---|
| Requirement artifact/cache | `<TASK_OUTPUT_DIR>/requirements/` |
| Context summary | `<TASK_OUTPUT_DIR>/task.md` hoặc `phase1-summary.md` |
| Ambiguity clarifications (Q&A) | `<TASK_OUTPUT_DIR>/reports/phase1-clarifications.md` (khi gate PENDING) |
| Trạng thái gate | `task.md`: `AMBIGUITY_GATE: PENDING/RESOLVED` |
