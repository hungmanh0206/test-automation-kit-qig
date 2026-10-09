# Global Rules

> Quy tắc bắt buộc để giữ Test Automation Kit an toàn, nhất quán và dễ audit.

> ## 📍 ĐỌC THEO MỤC — đừng nạp cả file
>
> File này ~27.000 ký tự (**≈ 12–17k token**). Nạp trọn mỗi lượt là lãng phí: **74% nội dung áp cho MỌI phase**,
> phần riêng Phase 1 chỉ 7% và Phase 2 chỉ 19%. Nên chia file theo phase gần như không tiết kiệm được gì,
> vì đọc Phase 1 vẫn bằng 81% bản đầy đủ, lại thêm N chỗ để drift. Cách đúng là **đọc đúng mục cần**.
>
> Thứ tự nên dùng: `CLAUDE.md` (6 non-negotiables, auto-load) → `.agent/rules/core_rules.md` (digest ~4–5k
> token, mỗi gạch đầu dòng ghi sẵn `(Đầy đủ: RULE_GLOBAL §…)`) → **chỉ mở mục dưới đây khi cần chi tiết**.
>
> | Cần gì | Mở mục |
> |---|---|
> | Secret, PII, mask evidence | [§Security](#security) |
> | `TASK_KEY`/`PROJECT_OUTPUT_DIR`, nơi ghi output | [§Project And Output](#project-and-output) |
> | Nhiều story chạy song song, đụng file dùng chung | [§Parallel Story Safety](#parallel-story-safety) · [§Shared Change Gate](#shared-change-gate) |
> | Sửa/đặt automation ở đâu | [§Task-Scoped Automation Code](#task-scoped-automation-code) · [§Automation Promote Review](#automation-promote-review) |
> | **Phase 1** — requirement mơ hồ, hỏi trước khi gen | [§Analysis & Ambiguity Gate](#analysis--ambiguity-gate-phase-1--đọc-kỹ-hỏi-trước-khi-gen) |
> | **Phase 2** — 5 trục mở rộng quanh case + luật đóng vòng | [§5 trục mở rộng](#5-trục-mở-rộng-quanh-case--luật-đóng-vòng-phase-2--có-máy-đứng-sau) |
> | **Phase 1** — chiều coverage: khai phạm vi, gắn tag, máy đếm | [§Chiều coverage](#chiều-coverage-phase-1--khai-phạm-vi-gắn-tag-có-máy-đếm) |
> | **Phase 2** — chạy sao cho thông suốt, không TODO/SKIP bừa | [§Execution Discipline](#execution-discipline-kỷ-luật-thực-thi--chạy-thông-suốt) |
> | Ghi kết quả, verdict, rerun | [§Execute Results](#execute-results) |
> | Lỗi thuộc FE hay BE | [§Phân tầng lỗi FE hay BE](#phân-tầng-lỗi-fe-hay-be--bắt-buộc-kiểm-api-trước-khi-kết-luận) |
> | Ảnh/video, định dạng, highlight | [§Evidence](#evidence--quy-chuẩn-bắt-buộc) |
> | Viết comment trên Test Run | [§Comment kết quả](#comment-kết-quả-test-execution--quy-chuẩn-trình-bày) |
> | Được phép log bug chưa | [§Backlog Bug Gate](#backlog-bug-gate) |
> | DB, capability tự chạy | [§Executable QA capabilities](#executable-qa-capabilities-autonomy--safety) |
> | Dọn file tạm | [§Cleanup Rules](#cleanup-rules) |

<!-- MỤC-LỤC:BẮT-ĐẦU — sinh bởi `npm run rule:toc`. Đừng sửa tay. -->

| # | Mục | Dòng | ~token | Tra nhanh |
|---|---|---|---|---|
| 1 | [Purpose](#purpose) | 69-72 | 30 | npm run rule -- 1 |
| 2 | [When To Use](#when-to-use) | 73-84 | 61 | npm run rule -- 2 |
| 3 | [Inputs](#inputs) | 85-97 | 332 | npm run rule -- 3 |
| 4 | [Outputs](#outputs) | 98-142 | 743 | npm run rule -- 4 |
| 5 | &nbsp;&nbsp;[Giọng văn output](#giọng-văn-output) | 110-142 | 451 | npm run rule -- 5 |
| 6 | [Rules](#rules) | 143-630 | 12155 | npm run rule -- 6 |
| 7 | &nbsp;&nbsp;[Language](#language) | 145-151 | 80 | npm run rule -- 7 |
| 8 | &nbsp;&nbsp;[Security](#security) | 152-165 | 498 | npm run rule -- 8 |
| 9 | &nbsp;&nbsp;[Project And Output](#project-and-output) | 166-177 | 284 | npm run rule -- 9 |
| 10 | &nbsp;&nbsp;[Parallel Story Safety](#parallel-story-safety) | 178-194 | 260 | npm run rule -- 10 |
| 11 | &nbsp;&nbsp;[Phase-Separated Story Execution](#phase-separated-story-execution) | 195-221 | 1975 | npm run rule -- 11 |
| 12 | &nbsp;&nbsp;[Task-Scoped Automation Code](#task-scoped-automation-code) | 222-232 | 314 | npm run rule -- 12 |
| 13 | &nbsp;&nbsp;[Shared Change Gate](#shared-change-gate) | 233-247 | 391 | npm run rule -- 13 |
| 14 | &nbsp;&nbsp;[Automation Promote Review](#automation-promote-review) | 248-256 | 160 | npm run rule -- 14 |
| 15 | &nbsp;&nbsp;[Analysis & Ambiguity Gate (Phase 1 — đọc kỹ, hỏi trước khi gen)](#analysis-ambiguity-gate-phase-1-đọc-kỹ-hỏi-trước-khi-gen) | 257-262 | 500 | npm run rule -- 15 |
| 16 | &nbsp;&nbsp;[Chiều coverage (Phase 1 — khai phạm vi, gắn tag, có máy đếm)](#chiều-coverage-phase-1-khai-phạm-vi-gắn-tag-có-máy-đếm) | 263-283 | 544 | npm run rule -- 16 |
| 17 | &nbsp;&nbsp;[Execution Discipline (Kỷ luật thực thi — chạy thông suốt)](#execution-discipline-kỷ-luật-thực-thi-chạy-thông-suốt) | 284-293 | 452 | npm run rule -- 17 |
| 18 | &nbsp;&nbsp;[5 trục mở rộng quanh case + luật đóng vòng (Phase 2 — có máy đứng sau)](#5-trục-mở-rộng-quanh-case-luật-đóng-vòng-phase-2-có-máy-đứng-sau) | 294-514 | 4055 | npm run rule -- 18 |
| 19 | &nbsp;&nbsp;[Execute Results](#execute-results) | 515-534 | 224 | npm run rule -- 19 |
| 20 | &nbsp;&nbsp;[Phân tầng lỗi FE hay BE — bắt buộc kiểm API trước khi kết luận](#phân-tầng-lỗi-fe-hay-be-bắt-buộc-kiểm-api-trước-khi-kết-luận) | 535-549 | 307 | npm run rule -- 20 |
| 21 | &nbsp;&nbsp;[Evidence — Quy chuẩn bắt buộc](#evidence-quy-chuẩn-bắt-buộc) | 550-561 | 629 | npm run rule -- 21 |
| 22 | &nbsp;&nbsp;[Comment kết quả (Test Execution) — Quy chuẩn trình bày](#comment-kết-quả-test-execution-quy-chuẩn-trình-bày) | 562-573 | 396 | npm run rule -- 22 |
| 23 | &nbsp;&nbsp;[Bug Claim Gate — kiểm chứng phải đi TRƯỚC lời nói](#bug-claim-gate-kiểm-chứng-phải-đi-trước-lời-nói) | 574-607 | 530 | npm run rule -- 23 |
| 24 | &nbsp;&nbsp;[Backlog Bug Gate](#backlog-bug-gate) | 608-617 | 154 | npm run rule -- 24 |
| 25 | &nbsp;&nbsp;[Executable QA capabilities (autonomy & safety)](#executable-qa-capabilities-autonomy-safety) | 618-630 | 397 | npm run rule -- 25 |
| 26 | [Workflow](#workflow) | 631-644 | 43 | npm run rule -- 26 |
| 27 | [Cleanup Rules](#cleanup-rules) | 645-672 | 388 | npm run rule -- 27 |
| 28 | [Examples](#examples) | 673-680 | 80 | npm run rule -- 28 |
| 29 | [References](#references) | 681-689 | 84 | npm run rule -- 29 |

> Cả file ~15379 token. Tra MỘT mục thay vì đọc cả file: npm run rule -- <số|từ khoá>
<!-- MỤC-LỤC:KẾT-THÚC -->

## Purpose

Tài liệu này định nghĩa các rule chung áp dụng cho mọi workflow, prompt, skill, script và report trong kit.

## When To Use

| Scenario | Apply These Rules |
|---|---|
| Sinh testcase | Có |
| Publish testcase Backlog | Có |
| Execute automation | Có |
| Log Backlog bug | Có |
| Rerun bug đã fix | Có |
| Viết report/output | Có |
| Dọn file tạm | Có |

## Inputs

| Input | Source |
|---|---|
| Task profile (giá trị ĐỘNG per-task) | `profiles/<TASK_KEY>/task.env` (`TASK_ENV=...`). Sinh từ template `profiles/task.env.example`. |
| Project output root | `PROJECT_OUTPUT_DIR` (trong task.env) |
| Task scope | `TASK_KEY` (trong task.env) |
| Parallel run scope | `RUN_ID` nếu chạy nhiều session cùng `TASK_KEY` |
| Runtime secrets (TĨNH, dùng chung) | `.env.local`, `.env`, CI env hoặc secret store (base URL + API key Figma/Backlog/Google Sheet) |
| Workflow-specific context | Prompt template hoặc `.agent/config/project_context.md` |

**Tạo profile task (một lần, chỉ 1 lệnh):** khi user yêu cầu "Tạo profile cho `<TASK_KEY>`" → chạy `node scripts/utils/create_profile.js <TASK_KEY> [--project-output outputs/<PROJECT>]` (hoặc `npm run profile:create -- <TASK_KEY>`). Lệnh copy `profiles/task.env.example` → `profiles/<TASK_KEY>/task.env`, prefill `TASK_KEY`+`BACKLOG_STORY_KEY`, KHÔNG ghi đè nếu đã tồn tại; QA điền credential + link. Profile CHỈ chứa giá trị động: `PROJECT_OUTPUT_DIR, TASK_KEY, BACKLOG_STORY_KEY, BACKLOG_STORY_URL, REQUIREMENT_DOC, BRD_DOC, FIGMA_FILE_URL, GOOGLE_DOCUMENT_ID, GOOGLE_SHEET_URL, LMS_USERNAME/PASSWORD/API_TOKEN, OPS_USERNAME/PASSWORD/API_TOKEN` (+ assignee per-task nếu cần). File task.env KHÔNG commit (gitignore `profiles/**/task.env`).

## Outputs

| Output | Rule |
|---|---|
| Giọng văn mọi output | Viết như QA viết cho người đọc, không như máy sinh. Chi tiết ở §"Giọng văn output" ngay dưới. |
| Markdown/report | Tiếng Việt chuẩn có dấu, UTF-8, không lộ secret. |
| Test results | Nằm dưới `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-results/`. |
| Evidence | Chỉ **ảnh/video** làm evidence (xem §"Evidence — Quy chuẩn bắt buộc"); `trace/log` là diagnostic local, KHÔNG phải evidence. Lưu đúng scope task. |
| Testcase publish (Google Sheet) | Step riêng trong phạm vi Phase 1; chỉ publish từ Excel canonical sau khi QA xác nhận (publish qua Google Drive MCP). Excel là source of truth khi gen/publish; **Phase 2 execute mặc định lấy nguồn từ Google Sheet** (`TESTCASE_SOURCE=sheet`, kéo về canonical local `from-sheet/*.xlsx`), `excel` là opt-out. |
| Backlog bug | Chỉ tạo khi fail đã được xác nhận là product/API bug. |
| Testcase (md/Excel) | Cột "Kết quả mong đợi" đánh số **KHỚP từng bước** (bước 1→KQ 1, 2→2…), xuống dòng `<br>`; **CẤM gộp range** kiểu `1-2.`/`2-3.`; không ghi chung chung ("thành công"/"đúng"). Áp cả khi gen VÀ khi chỉnh sửa TC thủ công. Chi tiết: prompt gen Phase 1 §6. |

### Giọng văn output

Áp cho **mọi thứ người khác đọc**: testcase, thân bug Backlog, comment Backlog, report, tài liệu hướng dẫn,
và cả phần trình bày trong hội thoại. Không áp cho comment trong code.

Luật này không đến từ cảm nhận. Ngày 08/09/2026 đã so 34 bài `docs/course/**` được người viết tay lại
cho tự nhiên với 50 file prompt và workflow chưa viết lại, rồi lấy đúng những dấu hiệu phân biệt được.
Hai giả thuyết trực giác đều bị số đo bác. Từ vựng hype kiểu máy chỉ xuất hiện 2 lần trong 180 nghìn từ.
Còn mật độ bôi đậm thì bản viết tay lại cao hơn bản chưa sửa.

| Việc phải làm | Trung vị bản viết tay lại | Bản chưa sửa |
|---|---|---|
| Không viết tắt bằng gạch chéo. "ảnh hoặc video", không phải "ảnh/video" | 0 lần trên 1000 từ | 13.7 |
| Câu dài quá 35 từ thì cắt thành hai câu | 1.2 | 3.4 |
| Ký hiệu thay bằng chữ: "khoảng" thay `≈`, "nên" thay `⇒` | 4.8 | 13.0 |
| Gạch dài không dùng để nối mệnh đề; tách câu mới | 5.7 | 10.1 |
| Câu trung bình dưới 15 từ | 13.8 từ | 17.6 |

Ba việc nữa, không đo bằng mật độ nhưng cùng gốc:

- Tiếng Việt trước, thuật ngữ Anh trong ngoặc. "Agent con (subagent)", không phải "Subagent".
- Chỗ nào đáng có số thì phải có số. "36 trên 93 đơn" thay cho "nhiều đơn".
- Kết quả mong đợi của testcase phải là điều kiểm được. "Cột Paid Amount hiện 2.000.000", không phải
  "Hệ thống sẽ hiển thị đúng số tiền".

Máy kiểm: `npm run writing:lint <file>`. Ngưỡng ở `.agent/config/writing_style.json` đặt ở **mức cao
nhất** của 34 bài mẫu, không phải phân vị 75. Mốc mà đánh 25% mẫu là mốc sai, vì mẫu chính là đích.
Nghĩa của gate: không được tệ hơn bản người viết tay. Cả 34 bài đạt, còn report tôi viết cùng ngày thì
vượt 4 trục.

Máy này soi **output của lượt làm việc** và không nằm trong CI. Ép viết lại tài liệu cũ của repo là
việc khác, và không làm.

## Rules

### Language

- Giao tiếp, phân tích, report và delivery note mặc định dùng tiếng Việt chuẩn có dấu.
- Tên biến, hàm, class và file nên dùng tiếng Anh.
- Technical terms, endpoint, method, enum, status và code identifier có thể giữ nguyên tiếng Anh.
- Comment trong code chỉ thêm khi giúp hiểu logic không hiển nhiên.

### Security

- Không in API key, password, token, cookie, private key hoặc connection string ra chat, logs, Markdown, testcase output hoặc reports.
- Không commit `.env`, `.env.local`, service-account JSON hoặc file chứa credential thật.
- Nếu secret từng bị chia sẻ hoặc commit, phải rotate trong provider console.
- Không dùng direct DB connection trong workflow chuẩn của kit. Ngoại lệ DUY NHẤT: read-only verify và chẩn đoán trên **UAT DB** qua guarded client `tests/support/setup/db/uatDbClient.ts` (read-only: chỉ SELECT, chặn bằng lint trong client). Chỉ cấu hình credential kho UAT (`LIB_MASTER_DB_*`) — kho UAT/PROD tách biệt, không cấu hình creds thì không truy cập được. Vẫn cấm biến generic `TEST_DB_*`/`TEST_DATABASE_URL`/`DATABASE_URL`/`PG*` và mọi import `tedious` ngoài client đó. DB là oracle PHỤ (verify và chẩn đoán): KHÔNG dựng hay mutate state, KHÔNG phải evidence Backlog, KHÔNG thay oracle từ spec; PII đọc ra phải mask + cấm export file.

- **SQL KÈM TESTCASE — dự án nặng CSDL thì viết sẵn câu truy vấn để QA chạy tay được.** Đặt câu `SELECT` ở "Các bước thực hiện", giá trị hoặc số dòng kỳ vọng ở "Kết quả mong đợi". Ba luật do máy gác (`npm run gate:gen-testcase`):
  ① **chỉ `SELECT`** — câu `UPDATE`/`DELETE`/`INSERT`/`TRUNCATE`… ở thế lệnh-để-chạy là **CHẶN**, vì người copy đi chạy là mutate UAT;
  ② **không literal PII** — email hay số điện thoại thật trong câu SQL là **CHẶN**, dùng tham số (`:email`) hoặc lọc theo id của chính lượt test;
  ③ case mang `[DbPersist]` mà không có `SELECT` nào thì **cảnh báo**.
  TRÍCH DẪN hành vi của proc (vd nêu `DELETE FROM …` để nói proc đó xoá cứng) **không** bị chặn — gate phân biệt bằng marker chạy đứng trước. Chi tiết và ví dụ: `prompt_templates/phase1/dimensions/23_db_persistence.md` mục *KÈM CÂU SQL*.
- Không yêu cầu AI đọc toàn bộ source backend để execute testcase. Phase 2 chỉ dùng UI/API public-business contract, artifact Phase 1, credential test, fixture có sẵn, test hook và sandbox nếu team cung cấp.

### Project And Output

- Project name, URL, domain, Backlog key và module name phải lấy từ config/env/prompt.
- Không hardcode theo project cụ thể trong workflow hoặc script dùng chung.
- `PROJECT_OUTPUT_DIR` là output root bắt buộc, ví dụ `outputs/<YOUR_PROJECT>`.
- `TASK_KEY` là scope của task hoặc feature và luôn nằm dưới `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/`.
- Playwright report, evidence và results nằm dưới `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-results/**`.
- Nếu chạy nhiều session cùng một `TASK_KEY`, bắt buộc truyền `RUN_ID` qua env/CLI để output execute nằm dưới `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-results/runs/<RUN_ID>/`.
- Khi có `RUN_ID`, execution/rerun/Backlog local report nên nằm dưới `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/reports/runs/<RUN_ID>/`.
- Khi có `RUN_ID`, không cập nhật trực tiếp testcase Markdown/Excel chính trong `test-cases/` trong lúc execute; ghi `Status`, `Actual Result` và `Evidence` vào run-scoped report và status trước. Chỉ merge ngược vào testcase chính khi user chọn run đó làm kết quả canonical.
- `RUN_ID` chỉ được chứa chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.

### Parallel Story Safety

- Mỗi story nên chạy trong một conversation AI riêng để giữ context sạch.
- Câu lệnh đầu tiên của mỗi conversation phải nêu rõ `TASK_KEY`.
- Trước mọi thao tác ghi file hoặc chạy command, agent phải echo scope:
  - `PROJECT_OUTPUT_DIR`
  - `TASK_KEY`
  - `TASK_OUTPUT_DIR`
  - `RUN_ID` nếu có
  - Workflow/phase đang chạy
- Nếu scope echo không khớp yêu cầu user, phải dừng trước khi ghi file hay chạy lệnh.
- Không sửa `.env` hoặc `.env.local` chung khi có session khác đang chạy.
- Với command execute/report/Backlog, ưu tiên truyền `PROJECT_OUTPUT_DIR`, `TASK_KEY` và `RUN_ID` qua env hoặc CLI args từng lệnh.
- Không chạy song song cùng một `TASK_KEY` nếu không có `RUN_ID`.
- Không chạy song song các workflow có ghi đè requirement và testcase chính của cùng một `TASK_KEY`, trừ khi user xác nhận chiến lược merge riêng.
- Không sửa shared config và helper như `playwright.config.js`, `package.json`, runtime helper hoặc common prompt khi story khác đang execute, trừ khi user xác nhận đây là thay đổi chung.

### Phase-Separated Story Execution

- Mỗi story không bắt buộc chạy liền một mạch. Luồng chuẩn là:
  `Requirement -> Generate Testcase -> Excel (source of truth) -> QA confirmation -> Auto Publish Backlog -> chờ Dev implement -> Phase 2 -> chờ Dev fix bug nếu có -> Re-run`.
- Sau bước generate testcase, Excel trong `<TASK_OUTPUT_DIR>/test-cases/` là source of truth khi **gen và publish**. Nội dung testcase phải sửa ở Excel rồi re-publish — không sửa trực tiếp trên Google Sheet làm nguồn authoring (`PUT .../detail` ghi đè toàn phần nên bản sửa tay sẽ mất khi re-publish).
- **Phase 2 execute mặc định lấy nguồn từ Google Sheet** (`TESTCASE_SOURCE=sheet`): tải bản Sheet mới nhất qua Drive MCP về canonical local `<TASK_OUTPUT_DIR>/test-cases/from-sheet/*.xlsx` rồi execute từ đó. Nhất quán vì publish đi TỪ Excel, và parser canonical không phân biệt nguồn do hai bên cùng bộ cột và định dạng. `TESTCASE_SOURCE=excel` (opt-out) đọc `<TASK_OUTPUT_DIR>/test-cases/*.xlsx`. Dù nguồn nào, execute đọc file canonical LOCAL — không gọi Sheet/Backlog cho từng case.
- Auto Publish testcase là step riêng trong phạm vi Phase 1, chạy bằng prompt riêng sau khi QA xác nhận Excel/testcase. Không publish thật khi chưa có QA confirmation rõ ràng. Sheet ghi đè toàn bộ mỗi lần sync, nên phải soi bản Excel trước khi upload.
- **Test management tool là Google Sheet** — công cụ DUY NHẤT của kit. Không có tầng script tích hợp riêng: Excel canonical dựng bằng `scripts/convert_excel/md_to_xlsx.js`, đưa lên và tải về đều qua Drive MCP, kết quả execution ghép lại bằng `npm run merge:execution-status`. Tức publish là thao tác NGƯỜI bấm, không có lệnh tự ghi. Gate `gate:policy` CHẶN mọi tài liệu nhắc lại công cụ cũ, kể cả dạng lệnh viết thường.
- Publish testcase lên Backlog phải đọc từ Excel canonical. Chạy dry-run trước nếu cần preview; publish thật chỉ khi QA/user approve. Ghi kết quả vào `<TASK_OUTPUT_DIR>/reports/backlog-testcase-publish-summary.md`.
- **KHÔNG có cột `Severity`/`Mức độ rủi ro` trong bộ testcase** (bỏ 21/08/2026). Severity là thuộc tính của **BUG**, không phải của testcase. Chấm nó lúc viết case là đoán trước hậu quả của một lỗi chưa xảy ra, nên nó luôn được chấm bằng cảm tính. Bug thật vẫn có Severity, lấy lúc log bug chứ không lấy từ testcase. Việc duy nhất cột này còn gánh trong kit là **risk band**, thứ quyết định độ sâu mở rộng 5 trục. Mà `bandOf()` lấy `max(risk, priority)`. Sau khi vá `PRIO_RANK` thiếu khoá `critical`, đo trên **1977 case toàn repo: bỏ cột này làm đổi band 0 case**. `Ưu tiên` (`Critical|High|Medium|Low|Lowest`) một mình đủ quyết band. `COL.risk` vẫn giữ trong `model.js` để 17 bộ TC cũ còn cột đó parse không lỗi, và các cross-check ma trận §7b tự bỏ qua khi cột vắng.
- **Tiêu đề case = NỘI DUNG, tag ở cột `Tag`** — template testcase là **10 cột**: `TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên`. Khối `[<Loại>][<Chiều>][<Oracle-ref>]` (vd `[Positive][Calc][BR-SAPSYNC-004]`) ghi ở cột `Tag`, **KHÔNG** ghi vào `Trường hợp kiểm thử`. Tiêu đề phải **tự đủ nghĩa** khi không có tag, tức chở đủ **ba thông tin**: *đối tượng hoặc màn*, *hành động hoặc điều kiện*, *kết quả cụ thể đo được*. Thường gói trong **2 đoạn** nối ` - `, vì đối tượng và hành động hay dính liền. Ví dụ: `Tạo Business Partner - Sinh mã KH đúng cú pháp C + CCCD khi khách Cá nhân chưa có BP`. **KHÔNG** đòi đúng 3 đoạn: bản đầu của luật này viết "3 đoạn" trong khi đoạn thứ nhất của ví dụ chính là `Cross-app` — tức cái tiền tố hằng số mà cùng luật đó CẤM. Hai câu tự đá nhau; đếm đoạn không phải thước đo, **đủ ba thông tin** mới là. CẤM **tiền tố hằng số**. Đo thật: `Cross-app - ` gắn cho 101/101 case của CSDL-26878 nên không phân biệt được gì, mà thông tin đó đã nằm ở `Loại case` và tên folder. Cũng cấm đoạn kết quả chung chung kiểu "hoạt động đúng", và cấm để nghĩa của case phụ thuộc vào tag. Giữ được `[...]` GIỮA câu khi đó là tên trường thật (`Kiểm [FBP] Ngày ghi nhận…`) — chỉ khối ngoặc **liền nhau ở đầu** mới bị coi là tag. Bộ TC cũ **không phải sửa**: `scripts/lib/testcase/model.js` lấy HỢP của cột `Tag` và tiêu đề nên cả hai đời đều đo được, còn `displayTitle()` ở `publish qua Drive MCP.js` cắt khối tag đầu chuỗi trước khi đẩy Google Sheet. Máy kiểm: `tests/fe/infra/publish-field-mapping.spec.ts`.
- **Case sinh mới phải TỰ KHAI `Loại case`** — đúng một trong **9 loại** đã chốt: `Security` · `Accessibility` · `Performance` · `Database` · `API` · `UI` · `E2E` · `Integration` · `Functional`. Định nghĩa, tag đi kèm và bảng **"chọn khi / KHÔNG chọn khi"** của từng loại nằm ở [`.agent/config/case_types.json`](.agent/config/case_types.json) — **nguồn duy nhất**, mọi nơi khác đọc file đó. Xét CHUYÊN BIỆT trước, `Functional` là mặc định cuối; một case mang ĐÚNG MỘT loại, hợp 2 loại nghĩa là case đang gộp 2 mục đích ⇒ tách case. Đây là trục KHÁC `Nhóm chức năng` (nhóm = *"thuộc mảng nghiệp vụ nào"* → thư mục; loại = *"kiểm thử kiểu gì"* → Case Type, dùng để lọc và báo cáo). Bỏ trống thì máy phải ĐOÁN: đo trên 1.399 case đã publish, cách suy từ tên nhóm đẩy **96% về `Functional`**, `Integration` và `Performance` = **0** — lọc theo Case Type trên Google Sheet thành vô dụng.
  - Chặn ở **biên sinh case** (`md_to_xlsx.js`), KHÔNG ở `REQUIRED_COLS`: bộ TC cũ đều 9 cột, siết ở bộ đọc dùng chung thì cả 9 bộ đỏ oan mà không ai sai. Bộ cũ giữ nguyên, chỉ khai khi có dịp sinh lại.
  - Giá trị ngoài 6 loại do `validate.js` chặn ở design gate. Lối thoát `--lenient` vẫn convert được nhưng **phải in cảnh báo** — bỏ qua trong im lặng thì lối thoát thành lối mòn.
- **Thang `Ưu tiên` là `Critical|High|Medium|Low|Lowest`** (khớp Google Sheet), KHÔNG phải thang Backlog. `Highest` vẫn được nhận cho bộ cũ nhưng kèm cảnh báo; khi log bug kit tự map `Critical → Highest` cho Backlog. Lý do siết: publisher map theo TÊN, không có khoá `highest` nên trước đây mọi case `Highest` rơi về fallback Medium — **14 case của một bộ bị hạ ưu tiên âm thầm**.
- Phase 1 có thể tự động hóa gần như toàn bộ phần thiết kế testcase khi input đủ. Phase 2 chỉ execute phần chạy được an toàn qua UI, qua API public, hoặc qua setup capability đã có. Case không dựng được state qua API, factory, hook, fixture hay sandbox an toàn thì ghi `Manual-only`, `SKIP_SETUP` hoặc `BLOCKED_SETUP`, kèm capability còn thiếu. KHÔNG dùng DB để DỰNG state thay thế: DB chỉ được read-only verify trên UAT, xem ngoại lệ ở trên.
- Mỗi case chưa tự động hoá được phải gắn 1 Blocker Root Cause (`needs_hook`/`needs_account`/`needs_sandbox`/`spec_mismatch`/`manual_inherent`/`external_dependency`), không gộp chung thành "backend state" (xem skill `precondition_setup_planner`). Capability gap (`needs_hook`/`needs_account`/`needs_sandbox`) phải đưa vào `reports/capability-request.md` và được review như Definition of Ready trước khi kickoff Phase 2. Pass rate phải kèm unassisted pass rate (loại các case cần người can thiệp giữa chừng) để không che giấu chi phí human-in-the-loop.
- Khi bắt đầu mỗi phase mới, agent phải đọc lại artifact canonical của task hiện tại:
  - `task.md`
  - `reports/phase1-summary.md` nếu chạy Phase 2
  - `reports/execution-summary.md` hoặc Backlog bug log nếu chạy Re-run
- Không dùng context hội thoại cũ làm source chính nếu artifact local đã có; artifact dưới `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/` là nguồn chuẩn.
- Không reuse `TASK_KEY`, `RUN_ID`, testcase scope hoặc Backlog bug scope từ phase hoặc story khác nếu user chưa nhắc lại rõ.
- Nếu user không nêu `TASK_KEY` trong yêu cầu hiện tại, agent không được dùng `TASK_KEY` từ `.env`, `.env.local` hoặc context cũ để quyết định scope; phải hỏi lại hoặc dừng.
- `.env` chỉ là nguồn runtime config sau khi scope đã được user xác nhận, không phải nguồn quyết định story đang chạy.
- Nếu Phase 2 hoặc Re-run bắt đầu sau thời gian chờ Dev, phải echo lại scope trước khi ghi file hay chạy command, dù cùng conversation.

### Task-Scoped Automation Code

- Khi nhiều story có thể chạy song song, automation mới sinh cho một story phải ưu tiên nằm trong phạm vi task:
  `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/automation/`
- Nếu bắt buộc ghi vào `tests/fe/` hoặc `tests/api/`, file spec phải có namespace theo `TASK_KEY`, ví dụ `<TASK_KEY>.spec.js`.
- Nếu chạy song song cùng một `TASK_KEY`, spec và output thử nghiệm phải thêm `RUN_ID` hoặc nằm trong run-scoped folder.
- Setup layer (factory/hook/fixture/cleanup/contract) dùng chung ở `tests/support/setup/`. Setup mới của một story tạo trước ở `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/automation/setup/`, reuse tối đa `tests/support/setup/`; chỉ promote phần generic vào shared khi đã ổn định. Setup layer không dựng hay mutate state bằng DB; chỉ được read-only verify qua guarded client `tests/support/setup/db/uatDbClient.ts` (UAT, read-only, chỉ SELECT).
- Không sửa shared helper, page object, fixture, config nếu có session khác đang execute, trừ khi user xác nhận đây là thay đổi chung.
- Nếu cần sửa shared helper để fix automation thật, phải ghi rõ trong report: file đã sửa, story bị ảnh hưởng, scope regression cần rerun.
- Không để spec task-specific mặc định thành shared regression suite nếu chưa qua review/merge.

### Shared Change Gate

- Shared files gồm `tests/fe/**`, `tests/api/**`, `tests/support/**`, `playwright.config.js`, `package.json`, runtime helper, fixture, page object, helper dùng chung và prompt cùng rule chung.
- Trước khi sửa shared file, agent phải xác định đây là thay đổi task-specific hay thay đổi chung.
- Nếu là thay đổi task-specific, ưu tiên chuyển sang `<TASK_OUTPUT_DIR>/automation/` thay vì sửa shared file.
- Nếu là thay đổi chung, phải có xác nhận rõ của user hoặc ghi blocker chờ xác nhận.
- Khi đã sửa shared file, execution summary phải ghi: file đã sửa, lý do, story có thể bị ảnh hưởng, scope regression đã chạy hoặc chưa chạy.

- **Gate mới CHẶN theo quy ước MỚI thì quy ước đó phải vào file canonical này, trong CÙNG thay đổi.**
  Nếu không, người dùng bị chặn bởi một luật **không tồn tại trong nguồn rule**. Ai chỉ đọc `CLAUDE.md` rồi `core_rules` sẽ không biết luật đó.

  Đã xảy ra thật với `dim:coverage --enforce`, `output_gate` và `domain:trace-back`. Cả ba chặn hoặc cảnh báo theo quy ước **tag chiều**, trong khi từ "chiều" xuất hiện **0 lần** ở `RULE_GLOBAL.md`, `core_rules.md`, README, USER_GUIDE và QUICKSTART suốt 3 ngày.
  - Đây là luật cho NGƯỜI, cố ý **không** làm thành máy kiểm. Bản máy ("mọi npm script gate phải được canonical nhắc TÊN") đo ra **19/24 script sẽ báo oan**. Ví dụ `secret:scan` chặn theo §Security: quy tắc *có* nhưng tên lệnh *không*, và như vậy mới đúng. Biến canonical thành danh mục lệnh còn tệ hơn.
  - Kiểm bằng mắt khi review: gate mới chặn cái gì → cái đó có nằm ở §nào trong file này không?

### Automation Promote Review

- Task-scoped automation không tự động trở thành regression suite chung.
- Sau khi Phase 2 PASS ổn định, có thể đề xuất promote automation vào `tests/fe/` hoặc `tests/api/`.
- Setup helper task-scoped ở `<TASK_OUTPUT_DIR>/automation/setup/` chỉ promote vào `tests/support/setup/` khi đã generic (không gắn một task) và có review/approval.
- Promote chỉ thực hiện khi đã có review và approval rõ.
- Khi promote, file core phải namespace theo `TASK_KEY` và không làm mất task-scoped artifact gốc.
- Nếu chưa approve promote, giữ automation trong `<TASK_OUTPUT_DIR>/automation/` và report là task-scoped only.

### Analysis & Ambiguity Gate (Phase 1 — đọc kỹ, hỏi trước khi gen)

1. **Đọc tài liệu THẬT KỸ, KHÔNG qua loa.** Mọi tài liệu được cấp (BRD, spec, requirement, Backlog, tài liệu nguồn, Figma, Swagger, doc) phải đọc kỹ TOÀN BỘ phần **trong scope**. Nghĩa là mọi mục, kèm **bảng, ghi chú, footnote, comment, phụ lục** liên quan, không lướt tiêu đề rồi đoán. Phần ngoài scope được lướt để tiết kiệm token, nhưng trong scope thì không được qua loa. Bóc hết: acceptance criteria, business rule, validation, enum và giá trị, state & transition, edge case, xử lý lỗi, phân quyền và role, biên. **Đối chiếu chéo** các nguồn (Backlog ↔ BRD ↔ Figma ↔ Swagger); mâu thuẫn thì **NÊU RA**, không tự chọn bừa. Phân biệt rõ "tài liệu ghi thật" vs "agent suy luận" — phần suy luận và chỗ mờ chính là nguyên liệu cho câu hỏi làm rõ.
2. **Chốt hỏi-đáp làm rõ TRƯỚC khi gen testcase (gate cứng).** Sau phân tích, TRƯỚC khi sinh testcase, gom **MỌI** điểm mờ thành **MỘT** danh sách câu hỏi đánh số (`Q1, Q2…`) trong `<TASK_OUTPUT_DIR>/reports/phase1-clarifications.md`. Mỗi câu bám **spec cụ thể** (giá trị, URL, element, điều kiện, enum, oracle), kèm **assumption mặc định đề xuất** và **phần scope bị chặn** nếu chưa trả lời. Phân loại **Blocking** (Critical/High: acceptance mơ hồ, giá trị/enum/oracle thiếu, rule validation, biên và state chưa định nghĩa, phạm vi in và out) vs **Non-blocking** (Medium/Low: có default hợp lý). Ghi cả hai loại để QA thấy hết điểm mờ.
3. **Blocking chưa trả lời → KHÔNG gen phần đó.** Ghi `AMBIGUITY_GATE: PENDING` vào `task.md` và **DỪNG**, chờ QA/BA trả lời (hoặc tick chấp nhận assumption). TUYỆT ĐỐI không tự đoán qua điểm Blocking rồi gen. Chỉ khi mọi câu Blocking đã RESOLVED → **phân tích lại + chỉnh** coverage map và scope theo câu trả lời → đặt `AMBIGUITY_GATE: RESOLVED` → mới bắt đầu gen. Câu Blocking không được trả lời → phần scope đó ghi "chờ làm rõ" ở Coverage Gaps, KHÔNG gen case cho nó. Medium/Low không chặn: tự áp assumption (ghi rõ) + Coverage Gaps, vẫn gen.

### Chiều coverage (Phase 1 — khai phạm vi, gắn tag, có máy đếm)

Bộ testcase có **hai trục**. *Module hoặc màn* trả lời "test **ở đâu**". *Chiều* trả lời "hỏi **loại câu hỏi nào**": validate field, hiển thị, công thức, BE conformance, guard, bảo mật, hiệu năng, change-impact. Phủ kín trục thứ nhất mà trống một ô trục thứ hai thì bộ **vẫn trông đầy đủ**, và đó là đường mà bug thật đã lọt. Đo trên một bộ 530 case: §6 E2E **0 case**, §17 change-impact **0–1**, case hiển thị **≈12%** dù mục đó là BẮT BUỘC.

1. **Khai phạm vi chiều TRƯỚC khi gen.** `<TASK_OUTPUT_DIR>/requirements/dimension_manifest.json`: mỗi chiều là `"required"` hoặc `"n/a"`, và **`n/a` PHẢI có lý do** trong `na_reasons`. Khai `n/a` cho chiều mà artifact chứng minh là có (vd có `requirements/figma/**` mà khai `design: n/a`) ⇒ **CHẶN**.
2. **Mỗi case gắn TAG CHIỀU trong tiêu đề**, cạnh tag loại: `[Positive][Display] …`. Không thêm cột — tag nằm trong cột `Trường hợp kiểm thử`. Bảng chiều→tag ở `prompt_templates/phase1/02_gen_testcases.md` §0b; nội dung từng chiều ở `prompt_templates/phase1/dimensions/`.
3. **Gắn tag rồi thì `Kết quả mong đợi` phải mang BẰNG CHỨNG của chiều đó.** Cụ thể:

   | Tag | Bằng chứng bắt buộc trong `Kết quả mong đợi` |
   |---|---|
   | `[Calc]` | giá trị số tự tính |
   | `[Display]` | chuỗi trích nguyên văn, mẫu định dạng, danh sách cột |
   | `[Guard]` | mã 4xx hoặc "bị chặn" **kèm** "dữ liệu không đổi" |
   | `[BEData]` | tên property, hoặc phân biệt `null` với rỗng với `0` |
   | `[Resilience]` | "lần hai hoặc trùng" **kèm số** |
   | `[Perf]` | ngưỡng có đơn vị |

   Tag chứng minh **có mặt**, bằng chứng mới chứng minh **đủ sâu** (§0b-bis).
4. **Case có oracle nghiệp vụ phải trỏ về rule**: `[Positive][Calc][BR-RECIPBANK-001] …`. `npm run domain:trace-back` cảnh báo case thiếu ref, bắt ref trỏ id không tồn tại, và `--apply` tự append `covered_by` cho rule.
5. **Máy kiểm:** `npm run dim:coverage` (`-- --enforce` để chặn) · `npm run domain:trace-back` · `output_gate --mode gen-testcase` (bằng chứng theo tag). Bộ **chưa có tag** thì `dim:coverage` **tự từ chối chặn** thay vì báo oan — nhưng đó là trạng thái *chưa được gác*, không phải *đã đạt*.

### Execution Discipline (Kỷ luật thực thi — chạy thông suốt)

Áp dụng khi execute (Phase 2, Re-run, Partial Rerun). Mục tiêu: **tối đa coverage mỗi lượt, tối thiểu gián đoạn**. Vi phạm = execute lắt nhắt, đứt đoạn, phải làm lại.

1. **Batch tối đa mỗi lượt — KHÔNG lắt nhắt.** Trước khi chạy, liệt kê TẤT CẢ case khả thi của đợt rồi gom vào ÍT script phủ NHIỀU case. Case độc lập thì chạy song song. CẤM kiểu "mỗi case một script / một vòng rồi dừng-báo". Một lượt phải verify được nhiều case, không phải 1–2 cái.
2. **KHÔNG mặc định `TODO`/`SKIP` khi CHƯA THỬ.** Trước khi đánh 1 case là chưa chạy, làm đủ ba việc. (a) Rà và DÙNG HẾT fixture, khoá nối, tài khoản, data đã được cấp trong task, không bỏ sót input đã nhận. (b) Case negative và lỗi thì **tự tạo input để tái hiện** (vd ID không tồn tại, giá trị biên) thay vì chờ fixture. (c) Drive thật UI hoặc API rồi mới kết luận. Chỉ để `TODO`/`BLOCKED` khi **chặn thật**: capability chưa có (payment sandbox chưa reconcile, account phân quyền), fixture đặc thù chưa được cấp, hoặc cần BA/dev làm rõ scope / fix bug. Khi để lại phải ghi **lý do cụ thể + điều kiện để chạy được** (không ghi chung chung).
3. **KHÔNG hỏi lắt nhắt.** Việc read-only / verify / tạo fixture trong quyền hạn đã thiết lập → thực thi ngay, không xin xác nhận từng bước ("chạy luôn không?"). Nếu buộc phải hỏi (thiếu input hoặc cần quyết định nghiệp vụ) → **GOM toàn bộ câu hỏi + input cần thiết vào MỘT lần**, không hỏi rải rác.
4. **Báo cáo gộp, ít vòng.** Chỉ dừng để báo khi đã xong MỘT CỤM lớn hoặc gặp chặn thật; không tường thuật từng thao tác nhỏ. Mỗi lần báo = nhiều kết quả.
5. Ranh giới không đổi: vẫn tuân thủ **Backlog Bug Gate**, **Evidence**, **PII/Security**, **Parallel Story Safety**, **Shared Change Gate** — siết coverage hay tốc độ KHÔNG được nới các gate này.

### 5 trục mở rộng quanh case + luật đóng vòng (Phase 2 — có máy đứng sau)

Bug **không sống theo dòng testcase** mà sống theo **bề mặt** (màn × luồng × trạng thái). Đo trên một task thật:
69 bug, gần như tất cả do NGƯỜI báo trong khi kit chạy xanh — nguyên nhân là execute chỉ bám đúng chữ trong case.

1. **Mỗi case đã execute phải được mở rộng theo 5 trục**, mỗi trục có máy riêng:

   | Trục | Máy |
   |---|---|
   | ① field cùng khối | `spec:extract` → `ui_conformance_check` |
   | ② cùng giá trị khác nơi hiển thị | `xsurf:diff` |
   | ③ chuỗi lưu trữ `form→payload→API→UI` | `probe:persist` |
   | ④ nhánh và biến thể, ⑤ trạng thái kế cận | `fixture:matrix` |
2. **BẮT BUỘC lập kế hoạch TRƯỚC — máy chặn.** Task có case band **high** đã execute mà chưa có
   `reports/expansion-plan.md` thì `self-review` **CHẶN**. Chạy `npm run expansion:plan` (chỉ đọc Excel, vài
   giây, không mở browser): nó in ra "task này ~N lượt tải · ~M phút · ~K MB" để QA **chốt phạm vi**. Không mở
   trục nào cũng được — nhưng phải là một QUYẾT ĐỊNH có ghi lý do, không phải bỏ qua trong im lặng.
   Cố ý KHÔNG chặn "đã mở đủ trục chưa". Đo 19/08/2026 trên 9 task (1014 case, 382 band high): 7/9 task có
   **0/5 trục**, còn task duy nhất đủ 5/5 lại có **3 báo cáo `proven=0`**. Chặn theo "có artefact" chỉ dạy nhau
   chạm file cho có. `npm run expansion:audit` đo lại con số đó bất cứ lúc nào để quyết định siết tiếp bằng SỐ.
3. **Báo cáo trục có mà `proven=0` là CHẶN** — artefact rỗng nghĩa không phải là đã soi. Chỉ áp cho 4 báo cáo
   trục; `expansion-findings`/`mutation-check`/`ui-contract-draft` nằm ngoài vì với chúng `proven=0` nghĩa là
   "đã soi mà không thấy gì" — một kết quả hợp lệ.
4. **Chiều ngược là bắt buộc:** `spec:gap` — section hoặc field build CÓ mà tài liệu KHÔNG NHẮC. Section chưa được khai
   nghĩa là **chưa ai soi**, KHÔNG phải "đã kiểm và không sao"; mỗi dòng là câu hỏi cho BA, phải ghi vào `reports/`.
5. **"Chưa kiểm được" phải được nói ra, không được im lặng thành đạt.** Bốn thứ sau đều là trạng thái
   *chưa kiểm* và phải xuất hiện trong báo cáo:

   - dưới 2 bề mặt đọc được
   - chuỗi khuyết điểm đo
   - ô ma trận trống
   - section chưa khai

6. **Kết luận sai lệch phải chỉ ra MẮT ĐỨT, không nói "hệ thống lưu sai".** Ghi giá trị từng điểm
   (`form 1.000.000 → payload 1000000 → API 0`) thì nêu được TẦNG lỗi. Payload là bằng chứng khách quan nên bug
   không bị bounce qua lại giữa FE và BE.
5. **Đóng vòng: bug do người ngoài tìm ra là LỖI CỦA MÁY.** Với mỗi bug đó phải trả lời được
   *"máy nào lẽ ra bắt được?"*, theo ba nhánh:

   - Có máy mà không chạy: ghi vì sao (thiếu catalog, thiếu fixture, chưa bind) rồi sửa.
   - Có máy đã chạy mà vẫn lọt: bổ sung luật **kèm test khoá luật**.
   - Không có máy nào: ghi đề xuất máy mới vào `reports/`.

   CẤM kết thúc bằng "sẽ chú ý hơn" — chú ý không phải forcing function. Máy đo: `leak:report --require-machine`.
6. **THỨ TỰ NGUỒN KHI DỰNG ORACLE. Ảnh và DOM của build KHÔNG phải nguồn đúng-sai.**

   | Hạng | Nguồn | Dùng để làm gì |
   |---|---|---|
   | 1 | Business rule đã xác nhận trong `knowledge/domain/` | Dựng oracle. Chỉ hạng này phán đúng-sai được |
   | 2 | Spec, FSD, Figma | Dựng oracle khi rule chưa vào knowledge |
   | 3 | Ảnh chụp hoặc DOM của build | Chỉ chốt sự thật quan sát. Nhãn, option, giá trị mặc định, disabled hay không tick |

   Hạng 3 KHÔNG được dùng làm chuẩn đúng-sai. Ảnh và DOM chính là app đang kiểm. Lấy chúng làm expected
   là app bằng app, đúng thứ mục dưới cấm.

   Nhưng cũng đừng bỏ hạng 3. Ảnh độ phân giải thường không phân biệt nổi disabled với không tick, nên
   có chỗ chỉ DOM mới chốt được.

   **Lệch giữa hai hạng thì thành CÂU HỎI Ambiguity Gate.** Không tự chọn bên. Tài liệu nói một đằng mà
   build hiện một nẻo là tín hiệu tài liệu lỗi thời, hoặc build sai. Chọn bừa bên nào cũng là quyết định
   nghiệp vụ mà QA không có quyền.

   **Bốn nhóm case BẮT BUỘC có nguồn chống lưng**, vì đoán sai là fail giả hàng loạt: bố cục và thứ tự,
   nhãn nguyên văn, giá trị mặc định, định dạng hiển thị. Không trỏ được tới hạng 1, hạng 2, hay một lần
   đọc DOM cụ thể thì case phải mang `[NeedsVerify]`.

   Máy đo: `design:gate` cảnh báo khi còn tag đó, và `design:gate --publish` thì CHẶN.
   Tag sinh ra để tồn tại trong lúc Phase 1 chạy. Chặn sớm thì người ta gỡ tag thay vì đi tìm bằng chứng.
   Lên Sheet rồi thì cả đội đọc case như một khẳng định chắc chắn.

7. **ĐIỀU KIỆN SỐNG CÒN — mở rộng phải có ORACLE, nếu không thì KHÔNG được kết luận.** Khi mở sang field lân cận
   / bề mặt khác, kit phải biết **cái đúng là gì**. Không có nguồn thì mặc định "app đang hiện thế là đúng" ⇒
   tautology **nhân theo số trục**, tạo ra PASS giả nhìn rất thuyết phục. Ba loại kết luận, không có loại thứ tư:
   - `EXPANSION_FINDING` — app **tự mâu thuẫn với chính nó** (lệch giữa 2 bề mặt · mắt đứt trong chuỗi lưu trữ ·
     field thừa hoặc thiếu so tài liệu). Không cần oracle ngoài, vì hai nơi cùng nguồn mà khác nhau thì chắc chắn một
     nơi sai. Log bug được, **KHÔNG phải verdict của case gốc** (cố ý không map sang status run của TMS — trộn vào là pass-rate mất nghĩa).
   - `PASS`/`FAIL` — **chỉ khi** có `oracle_ref` hợp lệ (`BR-`/`SM-`/`PM-`/`SS-`/`DM-`/`UI-`) và `expected` lấy từ đó.
   - `OBSERVATION` — không có neo. **Nhất quán ≠ đúng**: 4 điểm khớp nhau vẫn có thể sai cả 4 (ca thật: USD không
     quy đổi, `form/payload/api/ui` đều `10` trong khi đúng là `260.500`). Bắt buộc kèm câu hỏi mở; không vào pass-rate.
   Máy ép: `scripts/lib/expansion/finding.js` tự hạ cấp PASS→OBSERVATION khi thiếu neo; `self_review` **CHẶN** nếu
   file finding có PASS/FAIL không neo (kể cả bị sửa tay).
8. **Độ sâu theo RISK BAND, không mở 5 trục cho mọi case.** Chi phí là thật: một task đang giữ
   **1021 file, 136 MB** evidence. Mở đủ trục cho một bộ 530 case ước lượng **~3740 lượt tải trang, ~9,4 giờ,
   ~335 MB**. Band lấy **cái nặng hơn** giữa `Mức độ rủi ro` và `Ưu tiên`: high thì đủ trục runtime, medium thì
   ③ và ⑤, low thì ③. Xem chi phí TRƯỚC
   khi chạy: `npm run expansion:plan`.
9. **Phân vai Phase 1 / Phase 2 — đừng làm trùng.** ①field ②surface ③persist ⑥lặp-đồng-thời ⑦chiều-ngược **cần
   runtime** (DOM/response thật) ⇒ Phase 2. ④nhánh ⑤trạng-thái-kế-cận **đoán trước được từ tài liệu**
   (permission matrix, state machine) nên là **case do Phase 1 sinh** (§10 Cross-layer Guard), để được đếm
   coverage và publish lên TCM. Phase 2 chỉ đo **ô nào chạy được** (`fixture:matrix --discover`). Thứ chỉ sống ở execute thì
   chỉ lượt chạy đó biết.
10. **ASSERT tín hiệu môi trường, không chỉ dùng để triage.** Mỗi lượt execute đã mở trang thật và gọi API thật,
   nên đang có sẵn một kho tín hiệu mà **không case nào assert**:

   - JS exception (`pageerror`)
   - request **4xx/5xx chạy nền**, tức UI xanh trong khi một API phụ đang 500
   - response **lệch contract** (`tests/support/setup/contracts/`)
   - rác dữ liệu còn lại sau cleanup
 Đây là bắt bug gần-như-miễn-phí: không thêm case, không thêm lượt tải trang, và
   bắt được cả bug **không liên quan** tới case đang chạy. Máy: `scripts/utils/runtime/env_signals.js`
   (`attachEnvSignals(page)`), đã cắm vào `ui_conformance_check` + `cross_surface_diff`; script execute của task
   phải cắm tương tự. Kỷ luật: `pageerror` là **zero-tolerance**, có exception là finding dù case PASS. 4xx do
   case negative CỐ Ý gây ra thì phải **khai trước** bằng `expect4xx(rx, why)`, không khai thì bị tính là tín hiệu
   lạ. Còn console.error của tracking và cert môi trường chỉ là **ghi chú**, không phải deviation.
11. **CHỨNG MINH bộ kiểm bắt được bug, đừng giả định (`mutation:check`).** Mọi máy khác *cố bắt thêm bug*.
    Máy này **đo năng lực phát hiện**: cố ý tiêm lỗi ở tầng `page.route()` (**không chạm dữ liệu UAT**) rồi xem
    bộ kiểm có đỏ không. Mutant **sống sót = vùng mù CÓ BẰNG CHỨNG**, không phải phỏng đoán. Đo lần đầu 19/08 trên
    `ui_conformance_check`: **mutation score 0/4 = 0%**. Bóp `convertible_amount` thành 0, xoá hẳn, chia nửa hay
    đổi kiểu đều **không bị phát hiện**, vì máy đó kiểm **kiểm kê field** chứ không kiểm **giá trị**. Cùng lượt đo
    cho thấy phép so 2 bề mặt (trục ②) bắt được **4/4**. Kết luận có số: kiểm-kê-field và kiểm-giá-trị là
    **hai việc khác nhau**, phải chạy cả hai.

    Hai bẫy bắt buộc tránh khi dùng:

    - **Mutation phải tiêm được thật.** API trả tiền dạng **chuỗi** làm 4/5 mutant vô hiệu ở lượt đầu. "0%" khi
      đó là harness hỏng, không phải phát hiện.
    - **Đừng bóp cả hai phía.** Nếu mutation chặn cả request của app LẪN request xác minh của máy kiểm thì hai
      bên cùng bị bóp nên không bao giờ lệch, tức tautology ở tầng harness. Phải bỏ route SAU khi app load rồi
      mới đọc nguồn sạch.
 Chạy **định kỳ**
    (nightly hoặc mỗi release), không phải mỗi PR.
12. **NHÂN NHƯỢNG phải để lại dấu, bằng `PASS_WITH_DEVIATION`.** Rủi ro đặc thù của agent là gặp trở ngại thì
    có xu hướng **làm cho nó chạy**: chờ thêm, retry, đổi locator, refresh, đi đường khác. Mỗi lần như vậy là
    **một bug tiềm năng bị lấp**. Nút bị overlay che là bug thật, mà biến thành "chờ thêm 3s rồi bấm được" thì
    case xanh. Kit đã gác
    chặt phần locator (`locator_healing_policy`) nhưng nhân nhượng **dạng rộng** thì chưa. Luật: mọi lệch khỏi kịch
    bản phải ghi vào sổ (`scripts/lib/expansion/deviation.js` → `newLedger(tcId).note(kind, why)`). Case chỉ pass
    **sau khi** lệch thì verdict là `PASS_WITH_DEVIATION`, phải **liệt kê deviation trong Actual**, và xếp vào
    diện nghi vấn cần review. `self_review` cảnh báo khi Actual kể chuyện lệch kịch bản mà case ghi PASS trơn. Chỉ cảnh báo thôi,
    vì đây là suy từ văn xuôi. Đo thật cho thấy **không đối chiếu kịch bản thì 2/2 cảnh báo đều oan**: từ khoá
    "Retry" và "tải lại trang" chính là nội dung của case. Nên phải đối chiếu với bước của case trước khi nghi.
13. **FLAKY chỉ được gọi là flaky khi nêu được CƠ CHẾ. Không nêu được thì `SUSPECT_REAL_BUG`.** Cơ chế flaky
    triage có thể đang **chôn bug thật**: race condition, cache, timezone lúc chuyển ngày đều trông y như flaky.
    Retry 3 lần có 1 lần xanh là bị dán nhãn flaky rồi bỏ qua. Phải nêu cơ chế cụ thể (animation chưa xong, race
    giữa 2 request, cache CDN, đổi ngày lúc 00:00) **và cách chứng minh**. Không nêu được thì giữ
    `SUSPECT_REAL_BUG`, vẫn loggable. Metric phải theo dõi: **% flaky đã xác định được nguyên nhân** — tỷ lệ thấp nghĩa là đang chôn bug.
14. **ĐỦ ASSERTION.** Mỗi điều kiện trong "Kết quả mong đợi" phải có một verification kèm bằng chứng.
    Ví dụ expected *"tổng 540.000đ, đúng format có dấu phân cách, số dư giảm tương ứng"* chứa **3** assertion.
    Execute kiểm 1 rồi ghi PASS thì 2 cái còn lại lọt êm. Đây là cơ chế lọt **cơ học** phổ biến nhất.


    Đo trên một bộ 530 case thật:

    - trung bình **2.30** dòng expected mỗi case
    - **31%** case có ≥3 assertion
    - **9%** nhồi nhiều điều kiện trong MỘT dòng
    - **68%** case ghi **ít verification hơn số assertion**, trong đó 135 case lệch ≥2


    Luật: Phase 1 tách assertion **nguyên tử**, mỗi điều kiện 1 dòng, cấm nhồi "A, và B, đồng thời C".
    Phase 2 thì mỗi dòng expected phải có bằng chứng tương ứng. `self_review` **cảnh báo** theo tỉ lệ này khi bản ghi chỉ có `steps[]` (*proxy*).
    **Muốn CHẶN thì phải có dữ liệu đúng chiều**: khai `assertions: [{text, verified, evidence, note?}]` trong bản
    ghi execution (`scripts/lib/testcase/assertions.js` · `deriveAssertions(tc)` sinh khung từ chính expected).
    Khi field đó CÓ, gate **chặn** thật. `verified=true` mà thiếu `evidence` thì chặn. Chưa `verified` mà không
    nêu lý do cũng chặn. Bản ghi cũ không có field này thì **không bị phạt**, chỉ báo tỉ lệ áp dụng.

    Đo trên bộ 530: **1217 assertion nguyên tử**, trong đó **191 dòng (16%) còn nhồi nhiều điều kiện**.
    `deriveAssertions` chỉ **đánh dấu** `compound`, KHÔNG tự tách theo dấu phẩy. Tự tách sẽ cắt sai đúng những
    câu có số như "1.234.567đ, đúng định dạng".
14. **FE: assert HÌNH HỌC, không chỉ `toBeVisible()`.** Gốc rễ là **bất đối xứng oracle**. Backend có contract
    máy đọc được (Swagger) nên assertion là `total = 540000`. Frontend chỉ có Figma, tức hình ảnh, nên assertion
    thoái hoá thành `toBeVisible()` hoặc `toContainText()`.

    Mà `toBeVisible()` vẫn **PASS** khi element bị **đè lên**, nằm ngoài viewport, cao 0 đến 2px, **chữ trùng màu
    nền**, hoặc bị **truncate**. Bug FE sống ở **hình học và thị giác** còn kit lại assert **cấu trúc DOM**.
    Khoảng cách đó chính là chỗ bug FE lọt.

    Máy: `scripts/utils/ui/geometry.js`, gồm `inspectGeometry` và `inspectLongText`. Các phép này là **bất biến
    tự thân**, tức không cần Figma vẫn khẳng định được là sai, nên KHÔNG rơi vào tautology.

    Kèm theo là **text dài tiếng Việt**. Tiếng Việt dài hơn tiếng Anh khoảng 20% đến 30% và có dấu nên dòng cao
    hơn, khiến layout thiết kế cho text ngắn bị vỡ. Dùng `LONG_VI` (tên, địa chỉ, khoá học, ghi chú) cho ít nhất
    các màn có nhập tên và địa chỉ. Đây là ổ bug mà testcase gen từ tài liệu gần như **không bao giờ** nghĩ tới.
15. **ORACLE FE phải là contract có id, không phải "hình trong Figma".** Biến design thành
    `knowledge/system/UI-*.json` (`type: ui_contract`) rồi dùng id đó làm `oracle_ref`. Đó là cách duy nhất để FE
    có nguồn NGOÀI app. Không có nó thì mọi phép kiểm FE là so app với chính nó. Máy: `npm run ui:contract`.

    **Kỷ luật bắt buộc, đo được chứ không phải cẩn thận quá:** canvas Figma là **bảng mockup nhiều màn cạnh
    nhau**, và chú thích cùng số callout cũng in đậm. Trích thô sẽ ra tiêu đề kiểu *"Drag & Drop your file here"*
    và khối **trộn nhãn của 2 màn**.

    Nên máy **chỉ thu hẹp**, từ 173 node TEXT xuống 7 khối ứng viên, rồi xuất **bản nháp**. `--write` chỉ chấp
    nhận `--sections` do NGƯỜI curate, kèm `--confirmed-by` và `--confirmed-at`. Ghi thẳng bản trích thô là tạo
    **oracle GIẢ**, tệ hơn không có oracle, vì mọi so sánh sau đó sai **một cách tự tin**.

    Contract phải có `aliases`, vì tên design thường khác tên build, và có `extraction` ghi rõ máy trích hay
    người gõ, để người sau biết mức tin cậy.
16. **BIẾN THIÊN DATA theo `RUN_ID`: xoay nhưng phải TÁI LẬP.** Dùng đúng một bộ data mỗi lượt thì độ phủ
    **đóng băng**. 20 lượt vẫn chỉ chạm 1 hình dạng, trong khi bug nằm ở hình dạng khác: 0, số âm, biên, chuỗi
    dài có dấu, ngày 29 hoặc 31.

    Xoay vòng trong **cùng lớp tương đương** (`scripts/lib/expansion/variation.js`) thì 20 lượt phủ 20 hình dạng
    mà **không thêm case nào**.

    Bắt buộc seed bằng `RUN_ID`, để cùng `RUN_ID` thì cùng data. Random thuần làm bug "biến mất khi chạy lại",
    phá nguyên tắc rerun 2 đến 3 lần, và biến **bug thật thành flaky**. Ghi `plan()` vào Actual để người sau tái
    hiện đúng lượt đó.

    Kèm một điều kiện đi cùng: xoay data thì phải siết **teardown và janitor**. Môi trường UAT dùng chung, xoay
    mà không dọn là đổi bug-lọt lấy **rác dữ liệu**.
17. **VISUAL REGRESSION: bộ chụp RIÊNG, tất định, và phải nói rõ nó KHÔNG bắt được gì.**
    Ảnh evidence, khoảng 1000 tấm mỗi task, **không dùng làm baseline được**. Chúng là full-page, có dữ liệu
    động, và mask PII bằng cách **sửa DOM**. Mỗi lần chạy ra một ảnh khác nên diff luôn khác 0, rồi đội sẽ học
    cách bỏ qua.

    Lane riêng: `tests/fe/visual/` cùng `scripts/utils/ui/visual.js`. `freeze()` triệt animation, transition,
    caret và lazy-load. `captureOptions()` mặc định **không** full-page, `maxDiffPixelRatio 0.01`, và `mask`
    vùng động khai ở **lớp task** `requirements/visual_targets.json`.

    **Giới hạn phải nói trước:** oracle ở đây là "bản build đã được chấp nhận lần trước". Nó bắt
    **regression**, KHÔNG bắt cái sai từ đầu. Nên nó **bổ trợ**, không thay contract FE `UI-*` và không thay
    assert hình học.

    Lượt chạy đầu chỉ **tạo baseline**, nghĩa là **CHƯA kiểm gì**, phải soi ảnh trước khi nhận. Không có
    `visual_targets.json` thì lane **skip kèm lý do**, tuyệt đối không tính là PASS.

    **KHÔNG commit baseline.** Ảnh chứa dữ liệu khách, và baseline gắn OS cùng browser (`-win32`), nên commit
    từ máy Windows thì CI Linux vẫn phải chụp lại.
18. **Log bug phải khai nguồn phát hiện** `--found-by kit|human`: nhãn `auto-bug` chỉ chứng minh ai LOG, không phải
   ai TÌM — không phân biệt được thì tỉ lệ rò không đo được.

### Execute Results

Sau mỗi testcase đã execute, cập nhật testcase và report với:

| Field | Requirement |
|---|---|
| `Status` | `PASS`, `FAIL` hoặc `SKIP`. |
| `Actual Result` | Kết quả quan sát được, không ghi chung chung. |
| `Evidence` | **Bắt buộc cho MỌI case đã execute (PASS và FAIL)** + **MỌI step** (mỗi step có status PASS/FAIL riêng và ảnh riêng). Case `TODO`/chưa chạy không cần. Capture bằng `scripts/utils/evidence_recorder.js`; ảnh/video dưới `test-results/artifacts/<TC_ID>/`. Phải tuân thủ đầy đủ mục **Evidence — Quy chuẩn bắt buộc** bên dưới. |

Với testcase `FAIL`, `Actual Result` phải có:

| Required Detail | Why It Matters |
|---|---|
| Step fail | Xác định điểm lỗi. |
| Expected result | Xác nhận rule đang kiểm. |
| Actual UI/API result | Chứng minh behavior thực tế. |
| Main error message | Hỗ trợ dev debug. |
| Evidence path | Đảm bảo audit và Backlog triage. |

### Phân tầng lỗi FE hay BE — bắt buộc kiểm API trước khi kết luận

Khi log bug, **CẤM gán tầng lỗi chỉ bằng quan sát giao diện**. Nhìn UI sai chỉ chứng minh *có* lỗi, không chứng minh lỗi *nằm ở đâu*.

| Bước | Yêu cầu |
|---|---|
| 1. Bắt API thật | Bắt response của **chính API mà màn đang xem gọi** (`page.on('response', ...)` trong Playwright, hoặc tab Network của DevTools). **Không đoán** tên endpoint. |
| 2. Đối chiếu | So giá trị trong response với nguồn spec (màn nguồn, FSD, BR). |
| 3. Kết luận tầng | BE trả **sai/thiếu** → **BE** (`api_bug`). Response **đã đúng và đủ** mà UI hiện sai → **FE**. UI gửi payload thiếu dù người dùng nhập đủ → **FE**. BE nhận payload hợp lệ mà xử lý sai → **BE**. |
| 4. Khi chưa bắt được API | **Không gán tầng** — ghi rõ *chưa xác định tầng*, tuyệt đối không đoán. |

Evidence cho bug **so sánh hai nơi** phải là **ảnh GHÉP cả hai trong cùng một hình**, khoanh vùng từng bên và ghi rõ giá trị mỗi bên. Ví dụ màn quản trị với màn người dùng, form với payload, đơn với hệ ngoài. Không đính hai ảnh rời, cũng không chỉ một phía.

Gán sai tầng khiến ticket đi nhầm người và bị dev bounce lại, mất trọn một vòng lặp. Chi tiết máy-đọc: `.agent/config/verdict_taxonomy.json` mục `beVsFe`.

### Evidence — Quy chuẩn bắt buộc

Áp dụng cho MỌI case đã execute (PASS và FAIL) và MỌI step. Vi phạm bất kỳ điểm nào bên dưới = evidence KHÔNG hợp lệ, KHÔNG được đưa vào report hay push Sheet/Backlog.

1. **Chỉ ảnh hoặc video — cấm file dữ liệu thô.** Evidence hợp lệ chỉ là ảnh (`.png/.jpg/.jpeg/.webp`) hoặc video (`.mp4/.webm`). TUYỆT ĐỐI KHÔNG dùng `.json`, `.md`, `.txt`, `.log`, `.html`, `.csv`, `trace.zip` hay file dữ liệu thô nào làm evidence của case hoặc step — kể cả `order_state.json`, `api_response.json`, execution summary. Cần chứng minh dữ liệu API/DB/state thì **chụp ảnh màn UI** hiển thị dữ liệu đó (hoặc màn có giá trị tương ứng), không đính file dữ liệu.
2. **Highlight đúng element đang kiểm.** Mỗi ảnh phải khoanh (tham số `highlight` của `evidence_recorder`) đúng phần tử của step đó: nút / field / dòng bảng / nhãn / thông báo / giá trị. Cấm ảnh full-page chung chung không chỉ rõ điểm kiểm.
3. **Mask PII khách hàng.** Che mọi dữ liệu nhạy cảm của khách trong ảnh hoặc video: email, số điện thoại, họ tên, địa chỉ, mã định danh cá nhân. Kể cả khi nằm trong `<input>`. Dùng tham số `mask` của `evidence_recorder`. Đồng bộ rule bảo mật: artifact KHÔNG được để lộ email, SĐT hay PII khách. Dữ liệu của hệ thống và công ty, như STK công ty hay hotline, không bắt buộc che.
4. **Video cho case phức tạp.** Case nhiều bước hoặc tương tác động PHẢI quay video, giống evidence khi log bug, đính kèm cùng ảnh step để tái hiện được hành vi. Cụ thể: thanh toán qua cổng ngoài, trạng thái cập nhật bất đồng bộ, luồng qua nhiều màn, iframe hoặc popup, drag & drop, upload. Case đơn giản một màn chỉ kiểm hiển thị thì ảnh highlight là đủ.
5. **Verify đúng màn trước khi chấp nhận.** Sau khi chụp, PHẢI mở ảnh và kiểm nội dung để chắc chắn evidence đúng màn và đúng kết quả của case. KHÔNG phải trang lỗi (404, 500, blank, timeout, "can't find that page"). KHÔNG phải màn sai bước, không phải trạng thái loading dở, không phải cổng hay màn của bước khác. Sai màn thì sửa selector và điều hướng rồi chụp lại. Không push evidence sai.
6. **Mỗi case dùng evidence của chính nó.** Không mượn hay tham chiếu ảnh của case khác, không dùng placeholder. Nếu không re-drive được (order đã tiêu, link chết…) thì dùng đúng ảnh gốc thật của chính case đó và ghi rõ lý do không re-capture — không thay bằng ảnh không đúng nội dung.
7. **Lưu đúng nơi + gắn đủ.** Ảnh/video dưới `test-results/artifacts/<TC_ID>/`; đường dẫn ghi vào `Evidence` của case và của TỪNG step (mỗi step: status PASS/FAIL riêng + ảnh riêng).

### Comment kết quả (Test Execution) — Quy chuẩn trình bày

Field `comment` của mỗi case (trong `testcase-status.json`, đẩy lên run của Google Sheet) là chỗ QA đọc để hiểu kết quả — phải gọn, dễ nhìn, KHÔNG dán debug.

1. **Văn xuôi gọn, không debug.** Comment là 1–2 câu mô tả kết quả quan sát được. CẤM dán dấu vết kỹ thuật: `key=value` (`editable=false`, `disabled=true`, `atGateway=true`, `match=true`), dump state kiểu `A→A` / `tx 2→2` / `paid 6000000→6000000`, mảng regex và selector, `val="…"`, `matched=[…]`. Viết lại thành ý người đọc hiểu.
2. **Không lặp trạng thái ở đầu comment.** KHÔNG mở đầu bằng `[PASS]`/`[FAIL]`/`[PASSED]`/`[Positive]`/`[Negative]` — status đã có badge riêng trên Test Run. (Kit tự thêm tag cho SKIP/BLOCKED/EXECUTING để phân biệt "TO DO" — đừng tự viết tag đó.)
3. **Caveat tách dòng riêng.** Điều cần QA xác nhận thêm / giới hạn / phụ thuộc Dev → xuống dòng mới, mở đầu bằng `Lưu ý:` (đừng nhồi vào cùng câu kết quả).
4. **Nhiều ý → gạch đầu dòng.** Nếu case kiểm nhiều điểm, mỗi điểm một dòng `- …` thay vì câu chạy dài một mạch.
5. **Số/tiền ở dạng người đọc.** Viết `6.000.000đ`, `23tr`, ngày `2026-07-13` — không để số thô `6000000`, không để timestamp máy.
6. **Không placeholder / con trỏ file.** CẤM comment kiểu `Xem xxx_results.json`, `TODO`, `(auto)` — phải là nội dung thật của kết quả. Không nhét ID thô (order hoặc deal) trừ khi cần cho truy vết, và nếu cần thì rút gọn.
7. **Case FAILED:** comment nêu rõ **kỳ vọng vs thực tế** ở bước lỗi (ngắn gọn), chi tiết bước và evidence để ở `steps[]`/`failedStep` (không nhồi hết vào comment).

### Bug Claim Gate — kiểm chứng phải đi TRƯỚC lời nói

Luật này sinh ra từ một lỗi lặp lại, chủ repo chỉ ra ngày 16/09/2026. Ở Phase 2 tôi báo "phát hiện
bug, có log không". Bạn hỏi lại "chắc chưa", tôi kiểm lại rồi rút lời. Phát hiện kỹ thuật sai ngay từ
đầu. Câu hỏi của người dùng đang làm việc mà gate lẽ ra phải làm.

Gốc là lỗi thứ tự, không phải bất cẩn. Bar để khẳng định một bug nằm ở bước `phase2_04` với khoảng tám
điều kiện. Nhưng lời nói ra ở bước `phase2_03`, nơi chỉ đòi hai điều kiện là rerun đủ vòng và thu
evidence. Nói trước khi qua gate thì mọi câu hỏi đều ép làm sớm phần còn lại.

Ba luật:

1. **Không được dùng chữ "bug" trong hội thoại trước khi có claim qua máy.** Viết
   `<TASK_OUTPUT_DIR>/reports/bug-claims/<TC_ID>.json` rồi chạy `npm run bug:claim`. Tạo nháp bằng
   `npm run bug:claim:new -- --new <TC_ID>`. Trước đó chỉ được gọi là **quan sát bất thường**.
   Câu hỏi đặt cho người dùng khi đó chỉ còn là "có log không", không phải "có phải bug không".

2. **Phải cố chứng minh mình sai, và phải dẫn phép đo.** Claim bắt buộc có đủ ba nhóm phản chứng.
   Mỗi nhóm là một false positive đã xảy ra thật. Nhóm một là tài liệu cũ hơn build. Nhóm hai là dụng
   cụ đọc sai. Nhóm ba là fixture dựng không tự nhiên. Mỗi phản chứng phải dẫn một phép đo cụ thể,
   không phải một câu khẳng định.

3. **Đổi phán quyết phải có phép đo mới.** Khi bị hỏi "chắc chưa", trả lời từ bản ghi claim, không mở
   lại điều tra từ đầu. Nếu đổi ý thì bắt buộc nói rõ hai thứ: trường nào trong claim bị bác, và phép
   đo nào bác nó. Rút lời chung chung là không được phép. Claim rút thì ghi `status: withdrawn` kèm
   `withdrawn_by_check`, và phải hạ verdict trong `testcase-status.json` cho khớp.

Máy: `npm run bug:claim` chặn hai chiều. Chiều xuôi là claim thiếu trường. Chiều ngược là case đã chấm
`product_bug` hoặc `api_bug` mà không có claim nào, tức đã phán mà chưa kiểm chứng.

Giới hạn cần biết: máy đếm được ba phản chứng nhưng không đọc được ý định. `npm run bug:claim:report`
đếm tỉ lệ claim bị rút và phép kiểm nào bắt được nhiều nhất. Con số đó mới nói được kỷ luật có thật hay
chỉ là thủ tục.

### Backlog Bug Gate

Backlog bug gate khác với Backlog testcase publish. Backlog testcase publish diễn ra sau Excel/Phase 1 để mirror testcase lên Backlog; Backlog bug chỉ diễn ra sau Phase 2 khi fail đã được xác nhận là product/API bug.

- Không log Backlog nếu case đang `SKIP`.
- Không log Backlog nếu fail do prompt/test/setup/data/env/dependency.
- Không log Backlog nếu chưa rerun đủ để loại trừ flaky issue.
- Backlog evidence chỉ dùng ảnh hoặc video khi log hoặc upload bug.
- Không upload `.md`, `.txt`, `.log`, `.json`, `trace.zip` hoặc execution summary làm Backlog evidence trừ khi user yêu cầu riêng.

### Executable QA capabilities (autonomy & safety)

Các năng lực chạy thật trong `scripts/qa/` + `exploratory/` phải khai rõ mức tự chủ và tuân ràng buộc an toàn:

- **Autonomy Gate**: Suggest-only (learning_recorder, risk_score, git_impact, scope_planner) · threshold-gated (locator healing `LOCATOR_HEAL=1`, perf advisory, risk_gate `--enforce`) · never-auto (exploratory, security_check, load_check — chỉ chạy khi user yêu cầu tường minh).
- **Non-destructive & non-prod**: `security_check` chỉ GET/read-only + `--confirm-nonprod`; `load_check` non-prod + cap + `--confirm-nonprod`; fuzzing/exploit/brute-force/ZAP là Manual-only opt-in có phê duyệt người. TUYỆT ĐỐI không chạy trên production.
- **Mask PII/secret** trong mọi report (security/knowledge/dashboard); không ghi credential/PII khách hàng.
- **Learning data chỉ ghi fact đã qua gate** (bug đã qua Backlog gate); band risk máy chấm luôn cho phép QA override.
- **Output Quality Gate là THỰC THI, không phải prose.** `scripts/qa/output_gate.js` cùng `scripts/qa/lib/output_rules.js` biến rule chất lượng thành check máy. `push_test_execution.js` tự chạy nó trước khi push: comment phải gọn và không debug, mọi step có status kèm evidence ảnh hoặc video, case phức tạp phải có video.

  Vi phạm thì CHẶN, và agent tự sửa trong session chứ không chờ nhắc. `--qa-approved` bỏ qua có chủ đích và được log lại. Bug cùng Test Execution **bắt buộc qua script kit**, không tạo tay bằng MCP hay API.
- **Không thêm dependency nặng**: axe-core (npm) đủ cho a11y; k6 là binary ngoài (Docker/PATH, không vào deps), thiếu → skip sạch.

## Workflow

```text
Read config/env
↓
Run selected workflow
↓
Write outputs under PROJECT_OUTPUT_DIR/TASK_KEY
↓
Validate status/evidence/report
↓
Clean temporary files
```

## Cleanup Rules

Trước khi kết thúc task, scan workspace root và subfolder cấp 1 để dọn file tạm và file debug rõ ràng. Không xóa deliverable hoặc dữ liệu người dùng chưa được phép xóa.

**Dump ad-hoc KHÔNG ghi vào repo root.** Mọi dump chẩn đoán, gồm swagger hay OpenAPI, response API, id tạm, snapshot, phải ghi vào **thư mục scratchpad của session**. Artifact cần giữ thì ghi vào `<TASK_OUTPUT_DIR>/`.

Ghi ra root repo là rác lọt lưới. Các dump này thường chứa **email, SĐT và PII trong giá trị mẫu**, nên chỉ cần một lần `git add .` là commit lộ PII. Đã xảy ra thật: nhiều file `scratch_*` dump API và swagger sót ở root repo sau một task, chưa được gitignore.

| Pattern | Meaning |
|---|---|
| `*_debug.txt` | Debug dump tạm. |
| `debug_output.txt`, `*_output.txt` | Output dump tạm. |
| `*.tmp`, `*.temp` | File tạm. |
| `page_snapshot.md`, `snapshot_*.md` | Browser snapshot tạm. |
| `dom_dump.txt`, `html_dump.html` | DOM dump tạm. |
| `network_requests.txt`, `console_log.txt` | Network/console log tạm. |
| `scratch_*` (MỌI đuôi: `.py/.js/.ts/.json/.txt/…`) | Script nháp **và dump ad-hoc** (swagger/API response/id tạm). |

Không xóa:

| Path/Pattern | Reason |
|---|---|
| `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/test-results/**` | Deliverable của task hiện tại. |
| `logs/`, `artifacts/` | Có thể là output được yêu cầu. |
| `node_modules/`, `.git/`, `target/`, `build/` | Dependency/build/system folders. |
| `*.config.ts`, `*.config.js`, `package.json`, `.gitignore` | Project config. |
| File user yêu cầu giữ lại | User-owned data. |

## Examples

| Good | Bad |
|---|---|
| `PROJECT_OUTPUT_DIR=outputs/<YOUR_PROJECT>` | Hardcode tên project cụ thể trong template chung. |
| Evidence path dưới `test-results/artifacts/` | Screenshot tạm ở workspace root. |
| Bug Backlog có steps, expected, actual, evidence | Bug Backlog từ case skip hoặc lỗi setup. |

## References

| Document | Purpose |
|---|---|
| [README.md](README.md) | Architecture và overview. |
| [QUICKSTART.md](QUICKSTART.md) | Setup và chạy lần đầu. |
| `.agent/rules/` | Rule chi tiết theo domain. |
| `prompt_templates/run_phase_re-run_template.md` | Prompt canonical cho Re-run bug/case fail và cập nhật evidence/status. |
