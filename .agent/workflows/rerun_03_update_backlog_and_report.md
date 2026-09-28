# Re-run - Bước 3: Cập Nhật Backlog Và Report

> Chuyển Backlog bug sang Done khi PASS thật, hoặc ghi rõ fail/blocker nếu chưa đạt.

## Mục Đích

Giữ Backlog và local report đồng bộ với kết quả re-run thật, có evidence ảnh/video.

## Workflow

1. Nếu PASS thật:
   - Upload/add evidence ảnh/video.
   - Comment Backlog bằng tiếng Việt, ngắn gọn, nêu TC đã pass và evidence.
   - Transition Backlog bug sang Done bằng transition hợp lệ.
   - Cập nhật local rerun report.
   - Đồng bộ Knowledge Base (skill `learning_recorder`, Suggest-only): cập nhật `knowledge/bugs/<...>.json` → `backlog_status: "Done"`; nếu bug có `root_cause_ref`, cập nhật `knowledge/root_causes/<slug>.json` → `status: "resolved"` + `resolved_at` (ISO date); cập nhật `knowledge/index.json`. Chỉ cập nhật entry đã tồn tại, không tạo mới ở bước rerun.
2. Nếu FAIL/SKIP/blocker:
   - Không chuyển Done.
   - Ghi nguyên nhân và evidence local.
   - Không comment Backlog mặc định trừ khi user yêu cầu.
3. **Sau khi bug sang Done — tìm lỗi CÙNG LỚP (thời điểm vàng):**
   `TASK_ENV=... npm run bugs:checklist` cho module của bug vừa đóng.
   Vì sao đúng lúc này: root cause vừa được xác định và còn nóng, nên câu "lỗi cùng lớp này còn chỗ nào
   dính?" trả lời được ngay. Chờ sang sprint sau thì mất ngữ cảnh. Bug lặp lại là bug rẻ nhất để bắt.
   Có chỗ nghi ⇒ ghi vào rerun report (mục "Cùng lớp — cần kiểm"), không tự mở bug mới ở bước rerun.

4. Nếu còn bug mở trong scope:
   - Ghi danh sách còn mở.
   - Chờ Dev fix tiếp rồi lặp lại Re-run.

## Rules

- Backlog evidence chỉ là `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.mp4`, `.webm`.
- Không upload `.md`, `.txt`, `.log`, `.json`, `.zip`, trace raw hoặc execution summary.
- Không sửa Backlog description trong Re-run trừ khi user yêu cầu rõ.
- Nếu thiếu Backlog permission/credential, ghi blocker local thay vì giả lập đã Done.

## Outputs

| Output | Vị trí |
|---|---|
| Backlog comment/transition | Backlog bug |
| Re-run summary | `<TASK_OUTPUT_DIR>/reports/rerun/` |
| Updated task tracking | `<TASK_OUTPUT_DIR>/task.md` |
| Knowledge Base đồng bộ trạng thái | `knowledge/bugs/`, `knowledge/root_causes/`, `knowledge/index.json` (khi bug → Done) |
