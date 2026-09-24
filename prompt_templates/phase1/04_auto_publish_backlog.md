# Prompt Phase 1 - Auto Publish Testcase (Google Sheet)

> Chạy: `Đọc file này và chạy với TASK_KEY=<TASK_KEY>`. Rule: non-negotiables ở `CLAUDE.md` (đã auto-load). Digest: `.agent/rules/core_rules.md`. Chỉ mở `RULE_GLOBAL.md` **ở đúng mục cần** (mỗi gạch đầu dòng của digest có ghi `§`) — đừng nạp cả file.
>
> Tên file (`04_auto_publish_backlog.md`) giữ nguyên sau khi Google Sheet ngưng dùng (22/09/2026, thay bằng Google
> Sheet) để không phá mọi chỗ trỏ tới file này; nội dung bên dưới đã cập nhật cho Sheet.

Dùng prompt này như một step riêng trong phạm vi Phase 1, chỉ sau khi Phase 1 đã sinh testcase, export Excel và QA đã xác nhận Excel/testcase đủ điều kiện publish. Không dùng prompt này để log bug Backlog.

> **Công cụ lưu testcase: Google Sheet** (thay Google Sheet — app Backlog Marketplace, không tương thích Backlog).
> Khác biệt lớn nhất so với công cụ cũ: **không có folder/tag/custom-field riêng** — Sheet CHÍNH LÀ file Excel
> canonical (dashboard + 1 sheet/nhóm chức năng, xem `scripts/convert_excel/md_to_xlsx.js`), nên "publish"
> chỉ là UPLOAD FILE, không phải map từng field sang một schema khác.

```text
Chạy step Phase 1 - Auto Publish testcase lên Google Sheet.

Điều kiện bắt buộc trước khi chạy:
- Testcase Markdown đã được sinh/cập nhật.
- Excel testcase đã export thành công và là source of truth.
- `reports/phase1-summary.md` đã có coverage/risk review và Final Decision.
- QA đã xác nhận Excel/testcase được phép publish.
- Nếu QA chưa xác nhận rõ, chỉ được review file local, không upload thật.

QA confirmation:
- Status: [APPROVED / NOT_APPROVED]
- Người xác nhận: [QA_NAME_OR_ROLE]
- Thời điểm/xác nhận tham chiếu: [CHAT_CONFIRMATION / COMMENT / MEETING_NOTE / N/A]

Phạm vi:
- Task key/scope folder: [TASK_KEY]
- Backlog Story/Task parent: [BACKLOG_STORY_KEY]
- Output root: [PROJECT_OUTPUT_DIR]
- Task output dir: `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/`
- Google Drive folder đích: [GOOGLE_DRIVE_FOLDER_URL_OR_ID hoặc N/A — mặc định root Drive của tài khoản đang kết nối MCP]

Parallel story safety:
- Trước khi đọc Excel hoặc gọi MCP, echo `PROJECT_OUTPUT_DIR`, `TASK_KEY`, `TASK_OUTPUT_DIR`.
- Nếu `TASK_KEY` không khớp task user yêu cầu, dừng ngay.
- Không sửa `.env` hoặc `.env.local` chung khi có session khác đang chạy.

Input artifacts:
- Testcase Excel source of truth:
  `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-cases/*.xlsx`
- Testcase Markdown:
  `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-cases/*.md`
- Phase 1 summary:
  `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/reports/phase1-summary.md`
- Task tracker:
  `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/task.md`

Env/config:
- Đọc biến môi trường từ `.env.local`, `.env` (creds task ở `profiles/<TASK_KEY>/task.env`).
- Không in password, API key, cookie hoặc private key ra console, markdown, testcase output, report hoặc log.
- Upload thật cần: kết nối MCP Google Drive của agent đang hoạt động (không phải biến env — MCP là kênh
  riêng của phiên chat, không phải token script đọc). Kiểm bằng cách gọi thử `search_files`/`list_recent_files`
  trước; lỗi kết nối thì DỪNG, báo rõ, không giả vờ đã upload.
- Không còn khái niệm mapping field (Field Tags/custom field/folder hierarchy như công cụ cũ) — Sheet là chính file
  `.xlsx` này, mọi cột (`Loại case`, `Tag`, `Module`, `Ưu tiên`...) đã ở sẵn đúng vị trí, không cần dịch sang
  schema khác.
- `BACKLOG_STORY_KEY` (nếu có) chỉ dùng để ĐẶT TÊN file trên Drive cho dễ tra (vd `<BACKLOG_STORY_KEY> -
  Testcase.xlsx`), không còn ý nghĩa "field liên kết" như `backlogRequirementIDs` của công cụ cũ.

Mode:
- [DRY_RUN / PUBLISH]
- DRY_RUN = chỉ tìm/soi file trên Drive (search_files), KHÔNG gọi create_file/update_file.
- Chỉ chạy PUBLISH khi `QA confirmation Status = APPROVED` và user/prompt hiện tại cho phép ghi thật.

Các bước thực hiện:
1. Echo scope và kiểm tra `TASK_OUTPUT_DIR`.
2. Kiểm tra tồn tại:
   - `test-cases/*.xlsx`
   - `reports/phase1-summary.md`
   - `task.md`
3. Đọc nhanh Excel local để xác nhận số lượng testcase và tên các sheet-theo-nhóm khớp kỳ vọng trong
   `phase1-summary.md`; ghi rõ chênh lệch/blocker nếu có.
4. Nếu `QA confirmation Status != APPROVED`:
   - Chỉ `search_files` để xem file đã tồn tại trên Drive chưa (không ghi gì).
   - Ghi vào `task.md`: `Testcase publish (Google Sheet): Pending QA confirmation`.
5. `search_files` tìm file đã tồn tại trên Drive theo tên (vd chứa `[TASK_KEY]` hoặc `[BACKLOG_STORY_KEY]`).
   - Có → chuẩn bị `update_file` (đè nội dung, GIỮ NGUYÊN `fileId` — không tạo file trùng).
   - Chưa có → chuẩn bị `create_file` (upload `.xlsx`, KHÔNG set `disableConversionToGoogleType` để Drive
     tự convert sang Google Sheets thật).
6. Nếu mode là `PUBLISH` và QA đã APPROVED, gọi `create_file`/`update_file` tương ứng.
   - ⚠️ Drive KHÔNG tự giữ version cũ theo mặc định khi `update_file` — soi kỹ tên/nội dung file TRƯỚC khi
     gọi, không có đường "dry-run" ở tầng API như REST cũ.
   - Ghi lại `id`/`viewUrl` trả về.
7. Ghi `viewUrl` vào `profiles/<TASK_KEY>/task.env` (`GOOGLE_SHEET_URL=`) để Phase 2 biết tải file nào.
8. Cập nhật `task.md`:
   - Mode đã chạy.
   - Tổng testcase trong file.
   - Link Google Sheet (`viewUrl`).
   - Trạng thái: `Google Sheet publish: Done` (hoặc lý do dừng nếu chưa APPROVED).
9. Final cho user chỉ tóm tắt:
   - Mode đã chạy.
   - Tổng testcase trong file.
   - Link Google Sheet.

Quy tắc bắt buộc:
- Excel là source of truth. Sửa nội dung testcase ở Excel local rồi re-upload, KHÔNG sửa cấu trúc case
  (thêm/xoá cột, đổi tên sheet) trực tiếp trên Sheets rồi mong Phase 1 sau đọc lại đúng — QA có thể tự sửa
  GIÁ TRỊ (Result, ghi chú) trên Sheets, nhưng thay đổi CẤU TRÚC phải đi qua Phase 1 re-gen.
- Phase 2 execute LUÔN tải bản Sheet mới nhất về `test-cases/from-sheet/*.xlsx` qua Drive MCP trước khi
  chạy — không có khái niệm mirror cũ/mới như công cụ cũ (bước verify riêng), vì luôn tải lại từ đầu. Đồng bộ
  kết quả execute NGƯỢC lại Sheet dùng `node scripts/convert_excel/merge_execution_status.js` (xem
  `prompt_templates/phase2/04_execute_fe_playwright.md`) rồi `update_file` đè lên Drive.
- Không publish thật khi QA chưa xác nhận `APPROVED`.
- Nếu Excel đã bỏ bớt TC sau khi đã publish, re-upload (`update_file`) sẽ TỰ ĐỘNG phản ánh đúng: case bị xoá
  biến mất khỏi Sheet lần sync sau — không cần bước "deprecate" riêng như công cụ cũ (Sheet ghi đè toàn bộ mỗi lần sync nên
  từng phải đổi status; Sheet chỉ là ghi đè toàn file).
- Không log bug Backlog trong prompt này; log bug thuộc `prompt_templates/phase2/08_log_bug_backlog.md`.
- Không đưa secret vào report hoặc console.
- Nếu upload lỗi (mất kết nối MCP, quyền Drive), ghi blocker rõ trong `task.md`; không sửa testcase để né lỗi.

Extra instruction:
- [ANY_EXTRA_REQUEST hoặc N/A]
```
