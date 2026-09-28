# Re-run - Bước 2: Chạy Lại Và Verify

> Chạy lại testcase liên quan tới bug đã fix và xác minh PASS/FAIL/SKIP.

## Mục Đích

Xác nhận fix của Dev bằng execution thật, evidence rõ và không pass ảo.

## Workflow

1. Chạy targeted test theo TC ID/spec/endpoint đã mapping.
2. Capture evidence:
   - Ảnh cho case đơn giản.
   - Video cho flow phức tạp hoặc ảnh không đủ chứng minh behavior.
3. Phân loại kết quả:
   - PASS thật.
   - FAIL còn lỗi product.
   - FAIL do setup/automation/data.
   - SKIP/blocker.
4. Nếu fail do automation/setup/data, sửa root cause hợp lý và rerun targeted.
5. Không chuyển Backlog Done nếu chưa PASS thật.

6. **GATE MÁY — chạy TRƯỚC khi sang bước 3 (comment/Done Backlog), không phải kiểm bằng mắt:**
   `node scripts/qa/output_gate.js --mode test-execution --status <TASK_OUTPUT_DIR>/test-results/runs/<RUN_ID>/testcase-status.json`
   Vì sao nhánh này CẦN nó nhất: rerun là nhánh **trực tiếp chuyển bug sang Done**, tức hậu quả cao nhất
   trong cả kit. Vậy mà trước 23/08/2026 nó là nhánh DUY NHẤT không có gate máy nào, trong khi Phase 2 có
   `output_gate` tự chạy trong `push_test_execution` còn Phase 1 có `design_gate`.

   Gate bắt đúng những thứ dễ trượt lúc "dev đã fix rồi, đóng bug cho xong":

   - evidence không phải ảnh hoặc video
   - step thiếu status
   - comment dính debug
   - case phức tạp mà chỉ có ảnh tĩnh
   - FAIL không phân tầng
   - **FAIL tầng product hoặc api chưa khai `reruns` đạt ngưỡng taxonomy** (`verdict_taxonomy.rerun.min`)
   Gate CHẶN ⇒ tự sửa trong session rồi chạy lại tới PASS, KHÔNG chờ user nhắc.

7. **Mở rộng quanh vùng vừa fix (BẮT BUỘC với bug band High/Medium):**
   `TASK_ENV=... npm run expansion:plan -- --task <TASK_KEY>` rồi chạy tối thiểu **trục ③ (bền vững sau
   mutation — reload/đọc lại bản ghi)** và **trục ⑤ (trạng thái kế cận)**.
   Vì sao: fix thường tạo regression ở chỗ *lân cận* chứ không ở chính case đã map. Rerun mà chỉ chạy đúng
   TC cũ thì đo được "chỗ này đã đúng", không đo được "chỗ bên cạnh còn đúng không".
   Finding mở rộng chỉ được ghi PASS/FAIL khi có `oracle_ref`; không có neo thì là `OBSERVATION`
   (`npm run expansion:plan -- --audit --enforce` gác đúng luật này).


## Rules

- Không bỏ assertion để đạt PASS.
- Không đổi expected result nếu chưa có requirement xác nhận.
- Không coi SKIP là PASS.
- Evidence phải là ảnh/video không trắng và đúng bug/case.

## Outputs

| Output | Vị trí |
|---|---|
| Re-run result | `<TASK_OUTPUT_DIR>/reports/rerun/` hoặc run folder |
| PASS/FAIL evidence | `<TASK_OUTPUT_DIR>/test-results/` |
| Classification | Rerun report |
