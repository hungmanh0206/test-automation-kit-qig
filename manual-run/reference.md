# Manual-run — Tham chiếu nhánh chạy tay (Never-auto)

> Nhánh phụ. Chỉ chạy khi **user yêu cầu tường minh**. Entry point:
> [`run_manual_execution.md`](run_manual_execution.md).

## Lỗ hổng mà nhánh này đóng

Kit đã biết đánh dấu case không tự động hoá được: tag `[manual]` ở ô Tiền điều kiện, Readiness thành
`Manual-only`, và Phase 2 ghi `SKIP_SETUP`. Rồi **dừng ở đó**.

Hệ quả: case tồn tại trong bộ, không ai chạy, và báo cáo in `SKIP_SETUP` như thể đó là một kết luận.
**`SKIP_SETUP` không phải verdict.** Nó là lời khai *"chưa chạy"*. Nhánh này chạy tay nốt những case đó,
có evidence, có verdict, rồi ghi về cột `Result` qua đúng đường mà Phase 2 đang dùng.

## Ranh giới — đọc trước khi dùng

| Nhánh này LÀ | Nhánh này KHÔNG phải |
|---|---|
| Lượt execute hợp lệ cho case đã khai `[manual]` | Đường lách khi viết automation khó |
| Verdict thật, ghi về cột `Result` | Phiên dò rủi ro. Đó là [`exploratory/`](../exploratory/reference.md) |
| Chạy case ĐÃ CÓ trong bộ canonical | Chỗ sinh case mới |

**Chỗ gian lận mà máy gác.** Không có cửa nào thì nhánh chạy tay thành đường lách: case nào viết
automation khó thì đẩy sang chạy tay, coverage automation tụt mà không ai thấy. Nên `manual:check` CHẶN
khi một case chạy tay không mang `[manual]` trong bộ canonical. Muốn đổi thì sửa lời khai ở Phase 1 kèm lý
do, không đổi ở nhánh này.

## Luật của kit ĐÈ luật bên ngoài

Ba chỗ hay bị nhập sai từ tài liệu chạy tay bên ngoài:

| Luật bên ngoài | Luật kit | Máy thi hành |
|---|---|---|
| Chỉ chụp ảnh khi FAIL | Ảnh hoặc video cho **mọi** case đã execute, cả PASS. Mọi step. `CLAUDE.md` mục 4 | `output_gate --mode test-execution` |
| Verdict tự đặt | Chỉ dùng verdict trong `.agent/config/verdict_taxonomy.json` | `output_gate` |
| FAIL là FAIL | FAIL phải rerun 2 đến 3 lần loại flaky, phải phân tầng `failureLayer`, rồi mới qua Bug Claim Gate | `output_gate` · `bug:claim` |

Chạy tay **không** nới bất kỳ luật nào ở trên. Nó chỉ đổi cách dựng state, không đổi chuẩn kết luận.

## Khi nào một case được khai `[manual]`

Quyết định này thuộc Phase 1, không thuộc nhánh này. Tiêu chí ở
[`precondition_setup_planner`](../.agent/skills/shared/precondition_setup_planner/SKILL.md): không có
capability an toàn nào dựng được state, tức API, factory, test hook, fixture và sandbox đều không dựng
được. **Không dùng DB để thay thế.**

Ví dụ thật thuộc nhóm này: thao tác vật lý trên thiết bị, file thật rất lớn, tương tác với hệ thống bên
thứ ba không có sandbox, captcha không có đường tắt.

Khai `[manual]` chỉ vì **viết automation mất thời gian** là khai sai. Đó là `Needs hook`, và nó phải ra
`reports/capability-request.md` để Dev cấp hook.

## Máy của nhánh này

| Máy | Việc |
|---|---|
| `npm run manual:check` | Xem trước. Gác ranh giới `[manual]`, sổ phiên, và ủy quyền chất lượng output |
| `npm run manual:check:enforce` | Lệch thì exit 1 |
| `output_gate.js --mode test-execution` | Evidence, verdict, comment, FAIL phân tầng |
| `npm run expansion:plan` | Mở rộng quanh case đang chạy. Chạy tay không miễn mục 3 của `CLAUDE.md` |
| `npm run self-review:enforce` | Checklist gộp trước khi finalize lượt execute |

## Outputs

| Output | Vị trí |
|---|---|
| Sổ phiên | `<TASK_OUTPUT_DIR>/manual-run/session.md` |
| Kết quả | `<TASK_OUTPUT_DIR>/test-results/testcase-status.json` |
| Evidence | `<TASK_OUTPUT_DIR>/test-results/artifacts/` |

Khuôn `testcase-status.json` là khuôn **dùng chung với Phase 2**, không có khuôn riêng cho chạy tay. Nhờ
vậy `merge_execution_status.js` ghi cột `Result` y như lượt automation, và báo cáo không phải phân biệt
hai nguồn.
