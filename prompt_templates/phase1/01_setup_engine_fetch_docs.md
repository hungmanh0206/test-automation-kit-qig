# Prompt Phase 1 - Thu thập tài liệu nguồn

> Chạy: `Đọc file này và chạy với TASK_KEY=<TASK_KEY>`. Rule: non-negotiables ở `CLAUDE.md` (đã auto-load). Digest: `.agent/rules/core_rules.md`. Chỉ mở `RULE_GLOBAL.md` **ở đúng mục cần** (mỗi gạch đầu dòng của digest có ghi `§`) — đừng nạp cả file.

# Vai trò
Bạn là QA Engineer thiết lập AI Core Engine để phân tích tài liệu dự án.

# Nhiệm vụ
Kết nối nguồn tài liệu, tiếp nhận requirement và chuẩn bị context cho việc sinh testcases.

> **ĐỌC THẬT KỸ, KHÔNG QUA LOA.** Mọi tài liệu phải đọc TOÀN BỘ (mọi mục, bảng, ghi chú, footnote, comment, phụ lục), bóc hết acceptance criteria / business rule / validation / enum / state & transition / edge / xử lý lỗi / phân quyền / biên; đối chiếu chéo các nguồn và **nêu mâu thuẫn**. Đọc lướt → phân tích lệch → câu hỏi làm rõ sai/thiếu → testcase kém. (Canonical: `RULE_GLOBAL.md` §"Analysis & Ambiguity Gate".)

# Đầu vào
- Project: [YOUR_PROJECT_NAME]
- Task key/scope folder: [TASK_KEY]
- Module/Feature: [MODULE_OR_FEATURE]
- Sites: [App 1 / App 2 / Cross-app]
- Project Context: `.agent/config/project_context.md`
- Project Output: `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/`

# Các bước thực hiện
1. Đọc `.agent/config/project_context.md`.
2. Đọc `.env.example` để biết env keys cần có, không đọc/ghi secret vào output.
3. Fetch/read Jira story hoặc epic nếu có.
4. Fetch/read Confluence BA docs hoặc SOP nếu có.
5. Fetch/read Figma design nếu có.
6. Fetch app/site liên quan Swagger spec nếu có, sau đó parse endpoints và schema.
7. Liên kết logic BA docs, Jira story, Figma flow và API docs.
8. Lưu context vào `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/test-cases/snapshot_context.json`.

# TRƯỚC KHI ĐỌC: đo tài liệu — `npm run docs:budget`

**Chạy trước, đọc sau.** Tài liệu ở dự án này lớn hơn cảm giác rất nhiều, và "to" chỉ hiện ra khi đã đọc xong thì đã muộn. Đo thật trên một task: **54 tài liệu · ~38.600k token nếu đọc hết** — trong đó một file Figma JSON **37.500k** (nặng gấp ~3.180× toàn bộ prompt gen) và FSD tồn tại cả bản `.json` 504k lẫn `.md` 108k.

Lệnh in ra 3 thứ:
1. **Ngưỡng việc-nên-làm** cho từng file: `<8k` đọc trực tiếp · `8–25k` chỉ đọc mục cần · `>25k` **giao subagent** trích rồi chỉ nhận phần đã trích (thêm `--contract` để lấy hợp đồng trích xuất dán cho subagent: trả JSON theo `knowledge/SCHEMA.md`, mọi rule phải có `source` tới đúng tab/mục, chỗ tài liệu không trả lời được thì cho vào `open_questions` — **cấm suy diễn lấp chỗ trống**).
2. **Tài liệu có NHIỀU BẢN** — cùng nội dung khác định dạng (`.json` vs `.md`) hoặc nhiều lần export. Chỉ đọc bản nên đọc; đo thật tiết kiệm ~670k token mà không mất chữ nào.
3. **⚠⚠ Bản cũ NHỎ HƠN HẲN bản mới** = bản **thiếu nội dung**, không phải "bản khác ngày". Đọc nó là đọc thiếu spec. *(Đã xảy ra thật: export Google Doc trước khi vá `includeTabsContent` chỉ lấy 1/15 tab — 6,6k thay vì 108k.)*

> ⚠️ Giao subagent **KHÔNG** làm giảm tổng token (subagent phải nạp lại luật + ngữ cảnh). Nó đổi lấy việc **luồng chính không chứa nguyên văn tài liệu**, nên phần sau của lượt không bị bóp. Đừng kỳ vọng sai.

# Checklist kiểm tra
- [ ] **Đã chạy `npm run docs:budget`** và xử lý đúng 3 mục trên (không đọc bản thiếu, không đọc bản dư, tài liệu >25k thì giao trích xuất).
- [ ] Đã đọc **toàn bộ** tài liệu (không lướt); bóc đủ AC/rule/validation/enum/state/edge/phân quyền/biên; mâu thuẫn giữa các nguồn đã ghi ra.
- [ ] Tài liệu đủ để sinh testcase.
- [ ] Domain tag đúng: App 1 / App 2 / Cross-app.
- [ ] Requirement, UI và API context đã được liên kết rõ.
- [ ] Sẵn sàng cho bước sinh testcases.

# Đầu ra
- File: `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/test-cases/snapshot_context.json`
- Summary: module list, user story count, endpoints analyzed, UI flows analyzed.
