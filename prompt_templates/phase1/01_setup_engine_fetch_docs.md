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
> **Google Doc là nguồn spec: đọc bằng `npm run gdoc:read -- --doc-id <ID> --out <file.md>`**, đừng copy tay.
> Hai bẫy đã trả giá thật, script này đã vá cả hai — copy tay thì mất cả hai:
> - **Nhiều TAB bị cắt IM LẶNG**: thiếu `includeTabsContent` thì API chỉ trả tab đầu (đo thật: 18.5KB so với
>   345KB toàn tài liệu). Script log ra số tab đọc được — đọc log đó, đừng bỏ qua.
> - **Spec bổ sung của BA nằm ở nội dung TÔ MÀU / suggested**, không phải văn xuôi thường; phải đọc
>   `textRun.backgroundColor` mới thấy. Bỏ qua là bỏ nguyên nhóm yêu cầu mới nhất.
> `scripts/integrations/google_sheet/` (đọc Sheet qua REST/service-account) là **LEGACY, không dùng ở bước này**: testcase canonical nay là Excel trong
> `<TASK_OUTPUT_DIR>/test-cases/`, publish lên Google Sheet qua Drive MCP (khác cơ chế — xem skill `jira_testcase_publisher`). Dòng này chỉ nói về việc ĐỌC spec từ Google Sheet của stakeholder, không phải publish testcase.

3. **⚠⚠ Bản cũ NHỎ HƠN HẲN bản mới** = bản **thiếu nội dung**, không phải "bản khác ngày". Đọc nó là đọc thiếu spec. *(Đã xảy ra thật: export Google Doc trước khi vá `includeTabsContent` chỉ lấy 1/15 tab — 6,6k thay vì 108k.)*

> ⚠️ Giao subagent **KHÔNG** làm giảm tổng token (subagent phải nạp lại luật + ngữ cảnh). Nó đổi lấy việc **luồng chính không chứa nguyên văn tài liệu**, nên phần sau của lượt không bị bóp. Đừng kỳ vọng sai.

# SAU KHI FETCH: soát tài liệu — `npm run docs:health -- --task <TASK_KEY>`

**Tài liệu hỏng không tự báo là nó hỏng.** File vẫn có chữ, vẫn có tiêu đề, đọc vào vẫn hợp lý.

Đo thật trên một task: 14 trên 23 trang đã bị sửa sau ngày fetch. Hai file fetch về rỗng. Mười ba file
mất sạch bảng. AC của dự án này nằm trong bảng. Mất bảng là đọc thiếu điều kiện chấp nhận mà
không hề biết.

Bốn phép đo: **LỆCH BẢN**, **RỔNG**, **MẤT BẢNG**, **CÒN ENTITY**.
Thấy MẤT BẢNG hay CÒN ENTITY thì **fetch lại**. Đừng đọc bản đó.

# TRƯỚC KHI TRÍCH LUẬT: lập chỉ mục neo — `npm run docs:index -- --task <TASK_KEY>`

Mọi neo phải **tra ngược được** về file kèm số dòng.
Tra một neo bằng `npm run docs:cite -- --task <TASK_KEY> BR-07`.

Hai điều lệnh này nói mà đọc tay không thấy:
- **Neo không tra được** nghĩa là chưa có căn cứ để phán, chứ không phải "chắc ở đâu đó".
- **Neo MƠ HỒ** là cùng mã nhưng luật khác nhau giữa các trang. Đo thật: `NFR-02` một bên là kỳ
  khoá sổ, bên kia là chênh lệch deferred revenue. Viết kèm trang, kiểu `US-01 BR-07`.

# Checklist kiểm tra
- [ ] **Đã chạy `npm run docs:budget`** và xử lý đúng 3 mục trên (không đọc bản thiếu, không đọc bản dư, tài liệu >25k thì giao trích xuất).
- [ ] Đã đọc **toàn bộ** tài liệu (không lướt); bóc đủ AC/rule/validation/enum/state/edge/phân quyền/biên; mâu thuẫn giữa các nguồn đã ghi ra.
- [ ] **Đã chạy `npm run docs:health`** và không còn file RỔNG / MẤT BẢNG / CÒN ENTITY (thấy thì fetch lại).
- [ ] **Đã chạy `npm run docs:index`** — mọi neo định dùng làm oracle đều tra ngược được về file kèm số dòng.
- [ ] Tài liệu đủ để sinh testcase.
- [ ] Domain tag đúng: App 1 / App 2 / Cross-app.
- [ ] Requirement, UI và API context đã được liên kết rõ.
- [ ] Sẵn sàng cho bước sinh testcases.

# Đầu ra
- File: `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/test-cases/snapshot_context.json`
- Summary: module list, user story count, endpoints analyzed, UI flows analyzed.
