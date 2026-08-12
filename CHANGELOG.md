# Changelog

> Lịch sử thay đổi **kit dùng chung** (shared). Kit chưa dùng semver → ghi theo **ngày + nhóm chủ đề**,
> nguồn là `git log main` (kèm commit hash để tra ngược).
>
> Vì sao cần file này: mọi thay đổi ở `playwright.config.js`, `package.json`, `scripts/**`, `prompt_templates/**`,
> `.agent/**`, `tests/support/**` đều là **shared change** (xem `RULE_GLOBAL.md` §Shared Change Gate) —
> ảnh hưởng mọi story đang chạy. Mỗi mục ghi **vấn đề → cách chữa**, không chỉ liệt kê tính năng.

## 2026-08-12 (c) — rule mồ côi bị chặn bằng máy, và `.agent/rules/` tự giải thích được mình

**Bối cảnh.** Rà tiếp cấu trúc rule sau câu hỏi "sao có cả folder `rules` lẫn `RULE_GLOBAL.md`". Kết luận về tầng hoá: **giữ nguyên 3 tầng** (`CLAUDE.md` auto-load → `core_rules.md` digest → `RULE_GLOBAL.md` canonical) vì mỗi tầng bị một ràng buộc khác, gộp đằng nào cũng lỗ; và **không** dời `RULE_GLOBAL.md` vào `.agent/rules/` vì đang bị 20+ file trỏ tới (kể cả `.claude/settings.json`, task doc trong `outputs/`). Nhưng phần **playbook** thì có lỗ thật.

**Fixed — 2 rule mồ côi, và bản thứ hai không ai canh**
- Đo số nơi *thực sự dẫn agent tới đọc* từng file trong `.agent/rules/`: `qa_instincts` (4 nơi), `locator_strategy` (skill + **`self_review.js`** trích khi chặn), `locator_healing_policy` (skill + workflow) đều ổn — nhưng **`playwright_fe.md` và `playwright_api.md` chỉ được `AUDIT_REFERENCES.md`** nhắc tới, mà file đó tự khai là *bản kiểm kê*, không đưa ai tới đọc. Tệ hơn: chính `prompt_templates/phase2/04_execute_fe_playwright.md` — nơi cần chúng nhất — lại **tự chép lại** một phần rule của chúng (POM, `waitForTimeout`, thứ tự ưu tiên locator) ⇒ tồn tại bản thứ hai, không ai canh, drift âm thầm.
- Nối lại theo đúng cách `qa_instincts` đang được nối: prompt `04` và `05` mở section kỹ thuật bằng khối **"Playbook bắt buộc đọc"**, gọi tên đúng phần prompt KHÔNG nhắc lại (§Assertions + §Anti-Patterns của `playwright_api.md`; §Wait Strategy + §Test Structure của `playwright_fe.md`). Bỏ chuỗi ưu tiên locator chép tay trong prompt → trỏ về bảng §Priority của `locator_strategy.md` (danh sách CÓ THỨ TỰ là loại dễ drift nhất). Nuance "chờ ngắn chỉ để ổn định ảnh evidence" chuyển **vào** `playwright_fe.md` để không mất khi bỏ bản chép.

**Added**
- **`gate:policy` chặn rule mồ côi.** Mỗi `.agent/rules/*.md` phải được ít nhất một chỗ trong `prompt_templates/`, `.agent/skills/`, `.agent/workflows/`, `scripts/`, `exploratory/` hoặc `CLAUDE.md` trỏ tới. **Cố ý KHÔNG tính `AUDIT_REFERENCES.md` và `CHANGELOG.md`** — nhắc tên mà không đưa ai tới đọc thì không phải consumer. Cùng lớp vấn đề mà `.agent/skills/INDEX.md` đã chống cho skill, nay chống cho rule. Nghiệm thu: tạo `zz_dummy_orphan.md` → exit 1 đúng thông báo → xoá → xanh.
- **`.agent/rules/README.md`** — dòng đầu nói thẳng đây *không* phải bộ rule đầy đủ và canonical ở root; bảng phân biệt 1 policy vs 5 playbook kèm **ai dẫn tới đọc**; và 3 điều `gate:policy` sẽ chặn khi thêm file mới. Câu trả lời sẵn cho người tiếp theo mở thư mục này.

## 2026-08-12 (b) — `policy_source_check` canh cả `CLAUDE.md`, và danh sách đuôi evidence chỉ còn 1 nguồn

**Bối cảnh.** Câu hỏi "sao có cả folder `rules` lẫn `RULE_GLOBAL.md`?" hoá ra chạm một lỗ thật. Cấu trúc 3 tầng là có chủ ý — `CLAUDE.md` (12 dòng, Claude Code **tự nạp mọi session**) → `.agent/rules/core_rules.md` (digest, mỗi bullet trỏ `(Đầy đủ: RULE_GLOBAL §…)`) → `RULE_GLOBAL.md` (canonical, 291 dòng) — và `policy_source_check` (F3) vốn đã canh tầng 2↔3. Nhưng nó **không kiểm tầng 1**, đúng cái tầng luôn ở trong ngữ cảnh nên lệch ở đó ảnh hưởng lớn nhất. *(Lưu ý: 5/6 file trong `.agent/rules/` là playbook theo chủ đề — locator, playwright FE/API, qa_instincts — không trùng gì; chỉ `core_rules.md` mới cùng phạm vi với `RULE_GLOBAL.md`.)*

**Fixed — cùng một danh sách nằm ở 5 nơi với 4 nội dung khác nhau**
- `CLAUDE.md`: `png/jpg/webp` (**thiếu `.jpeg`**) · `core_rules.md` + `RULE_GLOBAL.md`: `png/jpg/jpeg/webp` · **thông báo lỗi** của `output_gate`: `png/jpg/webp/gif` · **code thực thi** `output_rules.VISUAL_EXT`: `png/jpe?g/webp/gif/bmp/mp4/webm/mov/m4v`. Tức `.jpeg` bị tầng auto-load cấm nhưng máy cho qua, còn `.mov/.m4v/.bmp` máy cho qua mà không tài liệu nào nhắc — và `output_gate` in ra danh sách khác chính code của nó.
- `VISUAL_EXT`/`VIDEO_EXT` giờ **export** kèm `extListText()` **sinh danh sách cho người đọc TỪ regex**; `output_gate` in từ đó thay vì viết tay.
- `policy_source_check` thêm: `CLAUDE.md` phải trỏ `RULE_GLOBAL.md`; và **so danh sách đuôi trong cả 3 tài liệu với hằng số trong code** — nêu đuôi code không nhận, hoặc nêu `.jpg` mà thiếu `.jpeg`, là **CHẶN**. Gate chạy thử: bắt đúng `CLAUDE.md` thiếu `.jpeg` → sửa → xanh. Đã có sẵn trong `.gitlab-ci.yml` + `static-check.yml` nên hiệu lực ngay.

**Đã chốt — siết danh sách về `png/jpg/jpeg/webp` + `mp4/webm`.** Tiêu chí chọn không phải "có phải ảnh không" mà là **reviewer xem được NGAY trong Jira, không phải tải về**: `.bmp/.mov/.m4v` vốn không có mime trong uploader nên đi Jira dưới dạng `application/octet-stream` ⇒ không preview ⇒ evidence mất tác dụng; `.gif` preview được nhưng 256 màu làm bệt khung đỏ + nhãn, mà chuỗi thao tác đã có luật bắt **video** riêng. Đo trước khi siết: 2224 file evidence thật gồm **png 2182 · webm 28 · jpg 14 · gif/bmp/mov/m4v = 0** ⇒ blast radius bằng 0. Siết xong tài liệu và code khớp tuyệt đối (`RULE_GLOBAL` vốn đã ghi đúng danh sách này).
- **Mime map gộp về 1 nguồn.** `push_test_execution.contentTypeOf` từng là bản chép tay riêng — chính chỗ đó cho phép "gate nhận đuôi mà uploader không gắn nổi nhãn". Giờ `MIME_BY_EXT`/`mimeOf` ở `output_rules` và uploader gọi vào đó.
- **Ràng buộc mới có máy giữ:** mọi đuôi `VISUAL_EXT` cho qua **phải có mime thật**; thiếu là `gate:policy` CHẶN. Đã nghiệm thu bằng cách cố tình thêm `.bmp` → exit 1 kèm đúng thông báo → hoàn nguyên → xanh.

## 2026-08-12 — `learn_bugs` nhận dạng bug theo Jira key, không theo tiêu đề

**Bối cảnh.** Định dùng `knowledge/bugs` làm danh sách bug cần re-verify thì phát hiện chính dữ liệu đó sai: hai record khác nhau cùng `id`, và một bug Jira đã `Done` mà local vẫn ghi `In Staging`.

**Fixed**
- **Danh tính bug = `slugify(summary)`.** Record được tìm bằng tên file `TASK__slug-tiêu-đề.json`, nên **sửa tiêu đề bug trên Jira là slug đổi ⇒ coi như bug mới ⇒ tạo record trùng**, còn record cũ bị bỏ rơi và **đóng băng trạng thái mãi mãi**. Hậu quả không nhìn thấy được: `risk_score` đếm 1 bug thành 2 (Likelihood phồng) và **vòng đời bug** (weight theo `jira_status` + decay) tính trên trạng thái sai — tức hai cơ chế vừa xây xong đều đang ăn dữ liệu bẩn. Giờ khớp theo **`id` = Jira key** (bất biến), quét cả thư mục để lập chỉ mục theo id; tiêu đề đổi thì **cập nhật tại chỗ** và ghi rõ dòng `✎`. Đo: `mới 3 → 2` (một cái là `SAPP-28420` đổi tiêu đề, đã có record).
- **Cảnh báo id trùng.** Trước đây trùng id không ai biết. Giờ báo to kèm tên 2 file. Dọn thật 1 cặp: record "[FE] Combo Version History filter Product" chính là **Vấn đề 3 của cùng ticket `SAPP-28395`** bị ghi thành bug riêng.
- **Log đồng bộ vô dụng: in `X → X`.** Gán `cur.jira_status = jiraStatus` **trước** khi dựng câu log nên old/new luôn giống nhau (`Done → Done`, `In Staging → In Staging`) — không đọc được gì đã đổi. Giờ chụp giá trị cũ trước khi gán. Lộ ngay **9 bug đã chuyển `Done`** mà local còn giữ `In Staging`.
- **Index bug không dọn entry mồ côi + không cập nhật `status`.** Khối ghi `index.json` chạy dưới điều kiện `APPLY && created.length` nên lượt chỉ-xoá hoặc chỉ-đổi-trạng-thái không chạm index ⇒ index trỏ vào file đã xoá và giữ `status` cũ. Giờ điều kiện là `APPLY`, dọn entry `type: 'bug'` trỏ file không tồn tại (đồng nhất với indexer domain/system/decisions đã có), và cập nhật cả record vừa đổi trạng thái. Dọn thật 1 entry mồ côi → index 62 entry, 0 mồ côi.

**Ý nghĩa thực tế:** danh sách "bug cần re-verify" từ 13 (dữ liệu local) về **1** (`SAPP-28411`, In Staging) — 9 cái đã `Done`, 3 cái dev chưa deploy, 1 cái Rejected đã có quyết định giải thích. Nếu tin dữ liệu cũ thì sẽ đi test lại 9 bug đã xong.

## 2026-08-11 — `ui_conformance_check` dùng được trên màn thật, và không được phép báo cáo sai

**Bối cảnh.** Đem khối `fields` ra chạy thật trên 5 màn của một task UAT (lượt 2, sau lượt 1 chỉ phủ 2 lưới). Ba lỗ hổng lộ ra ngay, đều thuộc kiểu **công cụ trả về số liệu trông như thật nhưng là rác** — nguy hơn công cụ báo lỗi.

**Fixed**
- **Login rỗng vẫn chạy tiếp ⇒ 26 deviation GIẢ.** Chạy thiếu `TASK_ENV` nên env rơi về `.env` (không có creds OPS), `page.fill` nhận chuỗi rỗng, app đứng ở màn login, và mọi màn sau đó đọc ra **0 cột / 0 field** → report in ra "thiếu toàn bộ cột" y hệt một app hỏng thật. Giờ `login()` **chặn sớm 2 lớp**: creds rỗng → lỗi ngay (kèm hướng dẫn truyền `TASK_ENV`); submit xong còn thấy ô password → lỗi "vẫn ở màn login, ĐỪNG đọc report lần này" (bắt cả sai creds lẫn throttle/lockout).
- **Fatal giữa đường vẫn `exit 0`.** Chưa đo được màn nào thì `totalDeviations = 0` ⇒ exit 0 ⇒ trông như PASS. Giờ fatal → **exit 2** (`0` khớp · `1` có deviation · `2` KHÔNG ĐO ĐƯỢC). Đúng nguyên tắc "không phán được KHÔNG thành PASS".
- **Lệch hoa/thường sinh cả `missing` lẫn `extra`.** `Full Name` vs `Full name`, `Số CCCD/Hộ chiếu` vs `Số CCCD/ Hộ chiếu` — mỗi lệch chữ ra 2 dòng, nhấn chìm tín hiệu thật (thiếu field, sai NGÔN NGỮ nhãn). Giờ so khớp theo khoá chuẩn hoá, lệch chữ gom **1 dòng `fields.label-text`/section**. Trên màn thật: 5 dòng nhiễu → còn 2 phát hiện thật (`Address` vs `Địa chỉ` giữa 2 màn; `Phone` vs `Phone number`).

**Added**
- **`fields[].headingText`** — neo section theo **tiêu đề đang hiển thị** thay vì selector. Section trên màn detail render bằng `div` không class ổn định nên khai selector là giòn, mà CSS thuần không chọn được theo text (`:has-text()` là selector riêng Playwright, `document.querySelector` không hiểu). Tool resolve trong trang → dán `data-uicheck` → chọn bằng CSS thuần. Chọn tổ tiên có **nhiều hàng nhãn→giá trị nhất** trong 6 cấp (lấy cả card thì dính field khối khác ⇒ báo thừa oan; lấy quá hẹp ⇒ báo thiếu oan).
- **Fallback đọc nhãn cho layout div** — section không có `<label>` nào thì selector chặt trả rỗng và **mọi field bị báo thiếu**. Rơi về cặp leaf-node liền kề (cùng cách `screen_snapshot` xử layout div), chỉ khi catalog không tự khai `labelSelector`.
- **Kênh `info.*`** — ghi chú cách đo (vd `info.loose-labels`), in ra report nhưng **không tính deviation**; nếu tính thì gate đỏ vì cách render của FE, không phải vì lỗi.
- Regression `tests/fe/infra/field-inventory.spec.ts` +2 ca (13/13 xanh): layout div neo theo `headingText` phải thiếu **đúng 1 field** chứ không thiếu hết; `headingText` không có trên màn → `fields.no-container` chứ không âm thầm bỏ qua section.
- `scripts/qa/README.md` — tài liệu hoá khối `fields[]` (trước đây có code mà không có doc), bảng loại deviation đầy đủ, **mã thoát**, và nhắc truyền `TASK_ENV`.

**Fixed — mắt xích HỌC bị đứt bởi một file lock của Excel**
- `learn_task` / `domain_rules` / `system_map` quét `test-cases/*.xlsx` và ăn phải **`~$tên.xlsx`** — file LOCK do Excel sinh ra khi workbook đang mở, không phải zip. ExcelJS ném lỗi **async** nên lọt khỏi `try/catch` sync và **giết cả tiến trình**: `learn:bugs:apply` chết ngay, không thu được gì. Giờ bỏ qua `~$*` / `.~*`.
- Cùng chỗ đó lộ ra lỗi **im lặng** nặng hơn: `parseXlsx` là **async** mà cả 3 hàm gọi đều **sync, không `await`** ⇒ `doc` là Promise, `doc.tests` luôn `undefined` ⇒ **đường xlsx chưa từng đóng góp gì** cho map module / tập TC ID mà không báo một chữ. Đo blast radius: **mọi task có `.xlsx` đều có `.md` kèm** nên chưa mất dữ liệu — nhưng task nào chỉ có `.xlsx` là gate mù mà không ai biết. Giờ phát hiện thenable → **cảnh báo to** nêu rõ file bị bỏ và phải dùng bản `.md`. (Sửa tận gốc = chuyển 3 hàm + chỗ gọi top-level sang async; ghi lại trong comment để không rơi.)
- Sau khi vá: `learn:bugs:apply` chạy được → **+11 bug record**, đồng bộ 2 trạng thái (SAPP-28365 `Rejected` → `Done`, xác nhận trực tiếp trên Jira). `decisions:check` từ "1 bug Rejected chưa có lý do" về **sạch**. `risk` chạy trên 43 bug · 100 module · 9 High, và vẫn nói thẳng 23 bug chưa map module.

**Kết quả trên màn thật:** 2 section khớp spec 100% (Order Amount 6/6; Add-on Product Info 4/4 — xác nhận một bug "thiếu Net Price" đã được fix), 4 phát hiện mới về lệch nhãn/điều kiện hiển thị, và **2 nghi vấn bị loại bằng dữ liệu trước khi thành bug oan** (địa chỉ nghi đọc từ property `d_o_b`: hoá ra tài liệu ghi sai tên property, app đúng).

## 2026-08-10 (b) — Bịt 4 lỗ hổng làm lọt cụm bug BE↔FE mapping và UI

**Bối cảnh (đo, không phỏng đoán).** Đối chiếu 26 bug trong sheet tổng hợp của một dự án thật với 25 bug automation đã log. *(Đính chính 2026-08-11: bản đầu ghi "bắt 8 / lọt 13" — SAI. QA xác nhận **cả 26 bug trong sheet đều do người tìm**, không phải automation; nhãn `auto-bug` chỉ chứng minh bug được TẠO qua tooling của kit, không chứng minh ai PHÁT HIỆN. Không có dữ liệu "ai tìm ra" thì **không được báo tỷ lệ phát hiện** — phần dưới giữ nguyên vì 4 cụm nguyên nhân được suy từ NỘI DUNG bug, không phụ thuộc con số đó.)* 26 bug gom thành 4 cụm có nguyên nhân hệ thống. Điểm chung cay đắng: prompt §12/§14 **vốn đã yêu cầu đúng** những thứ này, nhưng không có gì kiểm việc có làm hay không — bộ 530 case thật chỉ **12%** là case hiển thị, không ai dựng catalog, và `field_mapping*.md` nằm sẵn trong task mà chưa từng dùng để so từng field. Nên lần này **mỗi yêu cầu đều kèm artifact kiểm được hoặc gate chặn**.

**Added**
- `ui_conformance_check` — khối **`fields`**: kiểm kê **TẬP field của một section** (missing / extra / order; `mode: superset` khi catalog mới trích một phần). `table` chỉ phủ cột bảng, `texts` chỉ kiểm từng nhãn đã biết ⇒ cả hai **không** phát hiện được "section thiếu một trường" hay "màn mọc thêm trường lạ". Guard CLI (`require.main`) + export `checkScreen` để test được. Regression `tests/fe/infra/field-inventory.spec.ts` (5/5) tái tạo đúng 2 bug đã lọt + ca hai màn lệch nhãn.
- `output_rules.lintMappingOracle` (cắm vào `output_gate`) — **CHẶN** kết luận mapping/đồng bộ ở mức "có dữ liệu" (`populate` / `map đủ field` / `hiển thị đúng`), **CẢNH BÁO** khi chỉ liệt kê giá trị một phía rồi kết luận `sync_status = SUCCESS`; miễn cho case negative có mã lỗi cụ thể. Field lấy **nhầm nguồn vẫn populate** — đó là lý do lớp bug này PASS mãi. Đo: 119 case mapping đã PASS → **16 chặn · 74 cảnh báo**.
- `output_rules.lintStrayAnomaly` (cắm vào `output_gate`) — case **PASS** có từ nghi vấn (`nghi`, `có vẻ`, `chưa rõ`, `cần xác nhận`…) mà không trỏ tới **bug Jira** / **câu hỏi BA-Dev** / **`DEC-*`** = CHẶN. Đã xảy ra thật: ghi chú "nghi thiếu cấu hình X" nằm lại trong comment, sau đó chính chỗ đó là bug do người khác tìm. Đo: **6/497** case PASS (1,2%) — đủ ít để không thành tiếng ồn.
- `self_review` check #7 **vùng chưa kiểm** — có case SKIP/BLOCKED/TO-DO thì phải có mục "Vùng chưa kiểm" trong `reports/*.md` **hoặc** quyết định `test_approach` trong `knowledge/decisions` phủ chúng; không có = CHẶN. Chống đúng ca đã mất cả một họ màn hình vì gặp tường fixture rồi đi tiếp trong khi báo cáo vẫn xanh.

- `design_gate` — bộ testcase có case hiển thị mà THIẾU `requirements/ui_catalog.json` = **CHẶN** (catalog rỗng hoặc màn chưa khai `expectedColumns`/`fields[]` cũng báo). Trước đây yêu cầu dựng catalog chỉ nằm trong prompt nên không ai làm. Ngoại lệ cho task cũ: `--no-catalog` (phải nêu lý do ở report) hoặc `--qa-approved`. Blast radius đo thật: chặn đúng 1/2 task — chính task đã để lọt cụm bug UI (61 case hiển thị, không catalog); task còn lại không ảnh hưởng.
- `self_review` check #8 — case thuộc nhóm HIỂN THỊ mà kết luận chỉ dẫn chứng API (không dấu vết đọc trên màn) = **CHẶN**; ghép record status với testcase canonical theo `tcId` để phân loại. Chạy API cho case màn hình thì lỗi render/mapping FE **bất khả** lộ ra. Đo: 2–3/59 case hiển thị — ít và chính xác.

**Docs (prompt = chỗ ngăn từ đầu, gate chỉ là lưới cuối)**
- Gen §12: BẮT BUỘC sinh `requirements/ui_catalog.json` — cột **verbatim + đúng thứ tự**, `fields[]` cho **mỗi section**, `texts[]`; màn hiển thị **cùng dữ liệu ở ≥2 chỗ** phải khai cả hai với **cùng** `expectedFields` (lệch nhãn giữa 2 màn chỉ lộ khi cả hai cùng bị đối chiếu với một danh sách).
- Gen §14 thêm **"SAI NGUỒN dù CÓ giá trị"**: expected khai **hai đầu** (`field UI = object.property`); phải chọn data mà 2 nguồn **khác nhau** (trùng giá trị thì case không chứng minh được gì); có bảng field-mapping thì **mỗi dòng = ≥1 case**. Thêm mục **định dạng/đơn vị khi đẩy đi** ("đồng bộ thành công" không chứng minh bên nhận nhận đúng số).
- Execute (phase2/04) §Kỷ luật: cấm kết luận "đồng bộ đúng" (phải ghi giá trị 2 đầu) · **case hiển thị phải execute QUA UI** (chạy API thì lỗi mapping FE bất khả lộ — dùng API để dựng data thì được) · bắt buộc chạy `ui_conformance_check` · anomaly phải có nơi đến · fixture wall phải khai thành "Vùng chưa kiểm".

## 2026-08-10 — Risk phản ánh hiện tại · bản đồ hệ thống sinh nghĩa vụ test

**Changed**
- `risk_score.js` — **vòng đời bug**: Likelihood dùng *bug hiệu dụng* = `statusWeight[jira_status] × 0.5^(tuổi/halfLifeDays)` thay vì đếm mọi bug bằng nhau. Trước đó bug `Done` nửa năm trước vẫn kéo Likelihood y như bug mới mở ⇒ risk model lệch về **quá khứ**: vùng từng-hỏng-đã-fix luôn High, vùng vừa hỏng không nổi lên. Default `Done/Closed 0.4 · Rejected 0.1 · half-life 180 ngày`; thiếu ngày → **không** decay (bảo thủ); `confidence` vẫn theo tín hiệu **thô** nên module nhiều bug cũ không bị tụt về cold-start. Tắt: `halfLifeDays: 0` (hoặc `statusWeight: {}` về hành vi cũ) trong `risk_model.json`. Register in `bug thô→hiệu dụng` (vd `3→1`) + 1 dòng công thức để QA soi được vì sao band đổi. Nghiệm thu dữ liệu thật: 1 module Medium(6) → Low(3) vì cả 7 bug đều `Done` từ 46 ngày trước. (`6483ff3`)

**Added**
- `knowledge/system/` + `scripts/qa/system_map.js` (`npm run system:check` / `system:index`) + skill `system_mapper` — **bản đồ hệ thống đã xác nhận**: `state_machine` · `permission_matrix` · `shared_surface`. Vì sao cần: `domain/` lưu "giá trị đúng là gì", nhưng loại câu hỏi *"API cho huỷ đơn đã thanh toán — bug hay đúng thiết kế?"* / *"role thấp gọi được API role cao — lỗ hổng?"* / *"sửa API này regression đâu?"* thì **không thể** trả lời bằng cách bấm app (app cho làm chính là cái đang nghi sai → tautology), nên thực tế agent hay log bug đoán rồi bị dev bounce.
  Điểm khác tài liệu thường: bản đồ **sinh ra nghĩa vụ test** — cặp `(from,to)` không khai trong `transitions` là bất hợp pháp ⇒ phải có case chứng minh bị chặn; ô role×action ngoài `allow` ⇒ phải 403. `system:check` in ma trận state + liệt kê nghĩa vụ còn trống, xếp `‼` trước cho cặp xuất phát từ state `terminal` (bug toàn vẹn dữ liệu) và ô `DENY` (phân quyền). `--impact "<surface>"` → danh sách module phải regression. `--task` đối chiếu `covered_by` với TC ID thật để bắt **TC ma**.
  Validator chặn: id/type lệch nhau, state ngoài `states`, cặp vừa hợp pháp vừa bất hợp pháp, `expected` không kiểm được ("không được"), `consumers` < 2, thiếu `source`/`confirmed_by`, PII, nhiều bản `active` cùng `id`.

- `knowledge/decisions/` + `scripts/qa/decisions.js` (`npm run decisions:check` / `decisions:index`) + skill `decision_recorder` — **lý do của quyết định đã chốt** (`false_positive` · `by_design` · `risk_override` · `blocked_pass` · `wont_fix` · `test_approach`). Kit đang lưu "cái đúng" (`domain/`), "được phép làm gì" (`system/`), "cái đã sai" (`bugs/`) — thiếu đúng thứ đắt nhất: **vì sao đã kết luận thế**. Hệ quả đo được: 2 kết luận quan trọng nhất từng có (một bug IPN được dev verify code rồi Jira Rejected; một bug bị declare false positive sau khi test lại trên fixture dựng đúng luồng) **không có chỗ nào trong kit chứa** ⇒ task sau log lại đúng bug đó.
  - `--check "<triệu chứng>"` (bỏ dấu, ngưỡng ≥2 từ khớp để không nhiễu) — **bắt buộc tra trước khi log bug** (workflow `phase2_04` bước 4). Khớp `false_positive`/`by_design` ⇒ không log lại; muốn log phải có bằng chứng MỚI khác lần trước.
  - Đối chiếu `knowledge/bugs/`: bug `Rejected`/`Won't Do` **chưa có lý do lưu lại** bị nêu tên (`‼`) — đó chính là bug sẽ bị log lại. Quyết định tạm thời quá `expires_at` mà còn `active` → cảnh báo phải kiểm lại (chống "hạn chế tạm thời" hoá thành luật vĩnh viễn).
  - Validator chặn: `rationale` < 20 ký tự (bản ghi không có lý do thì lần sau vẫn phải điều tra lại = vô dụng) · `false_positive` do QA/agent tự chốt (ghi bừa là **dập luôn bug THẬT** ở task sau) · `scope` rỗng · PII · >1 bản `active` cùng id.
  - `risk_score`: nhắc lại QA override đã lưu (`type: risk_override`) ở cuối register — **suggest-only, không tự đổi band**; trước đây override chết theo task nên mỗi lần chạy lại phải override tay.
- `scripts/lib/testcase/validate.js` — kiểm **GIÁ TRỊ** 2 cột `Ưu tiên`/`Mức độ rủi ro` (trước đây `design_gate` chỉ kiểm **rỗng**, nên quy ước §7/§8 trong prompt không có gì ép). `Ưu tiên` ngoài 5 priority Jira = **CHẶN** — không phải hình thức: bug log lên Jira lấy `Priority` **từ chính cột này**, giá trị lạ (`Critical`, `P0`) ⇒ Jira dùng default ⇒ mất tín hiệu ưu tiên. `Mức độ rủi ro` ngoài `High|Medium|Low` = **CHẶN** (`risk:gate` ép độ sâu theo cột này, giá trị lạ bị bỏ qua âm thầm). 2 cột nói ngược nhau (`rủi ro High` + `ưu tiên Low`) = **cảnh báo**. Đo trước khi chọn mức chặn (bài học baseline của `locator_lint`): 1868 TC thật / 20 file → đúng 3 dòng bẩn ⇒ chặn được mà không làm đỏ hàng loạt; bộ 530 TC Payment `0 CHẶN`.

- `self_review` check #6 **knowledge ghi tay** — 3 store mới (`domain/`, `system/`, `decisions/`) máy KHÔNG tự thu được (chỉ người/agent ghi), mà ban đầu chúng chỉ được nhắc bằng 1 dòng trong workflow ⇒ rơi đúng bẫy *"có store, có validator, nhưng không gate nào gọi"* — y hệt lý do `knowledge/` từng rỗng suốt nhiều task. Nay: record đã ghi mà sai schema/PII → **CHẶN** (store rỗng không bao giờ chặn); store rỗng chỉ nhắc **khi có tín hiệu cụ thể** — clarifications đã `RESOLVED` mà `domain/` rỗng · bộ TC có case phân quyền/trạng thái/guard mà `system/` rỗng · bug `Rejected` chưa lưu lý do · quyết định quá `expires_at`. Nghiệm thu 2 task thật: SAPP-21786 → 3 case guard, SAPP-24395 → 41 case; cắm record sai vào store → gate chuyển FAIL đúng như thiết kế.

**Fixed**
- `domain_rules --index` / `system_map --index` / `decisions --index` — chỉ biết **thêm/sửa**, không bao giờ dọn: xoá 1 record thì `index.json` vẫn giữ entry trỏ vào file không còn tồn tại ⇒ tra cứu ra **kết quả ma**. Nay mỗi indexer dọn entry trỏ file đã bị xoá — nhưng **chỉ của type mình** (`business_rule` / `system_map` / `decision`), không đụng type do script khác quản.
- `risk_score` — `(unmapped)` bị xếp như một **module thật**. `learn_bugs` gán nhãn đó cho bug thiếu label `<tcId>` (không tra ra được cột Module); khi nạp 24 bug của một story, 13 bug rơi vào `(unmapped)` ⇒ nó leo lên **High risk 15** và **chen vào `executeOrder`** — chỉ đường test tới một đối tượng không tồn tại, đồng thời che mất sự thật là các module thật đang thiếu tín hiệu. Nay tách khỏi bảng, in thành **cảnh báo dữ liệu** (console + mục cuối register) kèm cách sửa tận gốc (bổ sung label `<tcId>` rồi chạy lại `learn:bugs:apply`).
- `push_test_execution.js` — import Xray bị **nginx 413** khi payload evidence lớn (`client_max_body_size` ~1MB, evidence base64 rất nặng) làm **cả lượt push chết**. Chia batch theo KÍCH THƯỚC payload (`XRAY_IMPORT_MAX_BYTES`, mặc định 600KB); `importExecution` với `testExecutionKey` gộp runs theo `testKey` nên append nhiều lần an toàn. Áp cho **cả 2** đường import-vào-execution-có-sẵn: `--execution-key` và **pre-create** (đường mà project bắt buộc custom field đi qua) — batch một đường thôi thì đường còn lại vẫn 413 đúng lúc payload to. Test đơn lẻ vượt ngưỡng → WARN nêu tên case (không chia nhỏ hơn được, phải giảm evidence).

**Docs**
- Nối bản đồ vào quy trình: prompt `02_gen_testcases.md` §nguồn-sự-thật (sinh case guard/permission/negative từ bản đồ) · workflow `phase1_01` (ghi bản đồ từ bảng trạng thái/ma trận quyền trong FSD) · workflow `phase2_04` (**bug dạng "hệ thống cho phép X" phải trích `SM-*`/`PM-*`**, chưa có bản đồ thì hỏi BA/Dev trước) · `knowledge/SCHEMA.md` §`system/` · README · USER_GUIDE §12.1.
- Cấm rõ trong skill + prompt: **không dựng bản đồ bằng cách thử API rồi ghi lại kết quả** — app đang sai thì bản đồ hợp thức hoá cái sai, TC sau đó vĩnh viễn không bắt được bug đó.
- USER_GUIDE §12.1: sửa mô tả Likelihood đã lỗi thời (`bugCount` → *bug hiệu dụng*).

## 2026-08-06 — Khép vòng học · chống flaky expand · đồng bộ tài liệu

**Added**
- `scripts/qa/learn_bugs.js` (`npm run learn:bugs[:apply]`) — nạp bug từ **Jira** (label `auto-bug` + sub-task của story) vào `knowledge/bugs/` + `index.json`. Trước đó `bugCount` luôn = 0 nên `risk_score` chỉ có `failRate`. Không cần sửa `bug_reporter.js`. Idempotent (đã có → chỉ đồng bộ `jira_status`). Nghiệm thu trên 1 task thật → 7 bug, `risk_score` từ `0 bug` → `7 bug, 9 snapshot`. (`7482523`)
- `scripts/utils/ui/ensure_expanded.js` + regression `tests/fe/infra/ensure-expanded.spec.ts` — mở panel/accordion trên DOM "nhiều icon giống nhau": thử ứng viên → **nghiệm thu bằng sentinel**, tự Escape khi click nhầm modal/dropdown, idempotent, không dùng toạ độ chuột. Thay cho click chevron theo toạ độ (nguồn flaky kinh điển; một task thật đã thử ~8 lần không ổn định). (`683d67e`)
- `select_tests.js` dùng learning data thật: xếp hạng file theo `(fail + 0.5×flaky)/runs`, `--include-risky <N>`, `--risk-first`, cảnh báo test quarantine. Trước đây code ghi rõ *"risk hiện in gợi ý, chưa auto-lọc"*. (`7482523`)

**Fixed**
- `metrics_collect.js`: test `skipped` có `results` **rỗng** nên chỉ đọc `results[last].status` → **15/26 record là `unknown`**, làm hỏng tín hiệu reliability/risk. Fallback `t.status`; đồng thời chuẩn hoá `file` về repo-relative để `select_tests` map được. (`7482523`)
- `self_review`: đòi KPI cả với task execute bằng script tự chế (không sinh `results.json`) → **chặn oan**. Nay chỉ đòi khi task thực sự có `results.json`. (`7482523`)
- `ensure_expanded`: dùng `offsetParent !== null` để kiểm hiển thị làm overlay `position: fixed` (antd/bootstrap) bị coi là ẩn → mất khả năng tự-Escape. Đổi sang `rect + computedStyle`. (`683d67e`)

**Docs**
- `README.md` + `USER_GUIDE.md` đồng bộ cho toàn bộ thay đổi kit-wide gần đây; bù **12 npm script** vốn chưa từng được ghi → nay đủ **51/51**. (`76bf164`)

## 2026-08-04 — Learning loop tự động

**Added**
- `scripts/qa/learn_task.js` (`npm run learn`, `learn:backfill`) — thu KPI + snapshot `historical_execution/<TASK>__<date>.json` với `modules` theo **tên module nghiệp vụ** (map `tcId → Module` từ testcase canonical), cập nhật `index.json`. Idempotent; thời điểm lấy từ artifact nên backfill giữ đúng trend. Backfill 16 task → 12 KPI run + 9 snapshot; `risk_score` thoát cold-start, `dashboard` từ rỗng → 9 snapshot/84 module. (`73391e3`)
- `scripts/qa/learn_reporter.js` — Playwright reporter **tự thu sau mỗi test run**, khai **cuối** danh sách `reporter`. (Đo thật: `globalTeardown` chạy *trước* khi reporter `json` ghi `results.json` nên không dùng được.) Guard: `LEARN_AFTER_RUN=0` · CI · thiếu TASK context · 0 test · run bị ngắt; never-throw. (`4399acf`)
- `self_review` check thứ 4: execute xong mà thiếu snapshot/KPI → **CHẶN** kèm lệnh sửa. (`73391e3`)

**Changed**
- `RULE_GLOBAL` §Cleanup Rules: pattern `scratch_*.py|js|ts` → **`scratch_*` mọi đuôi** + rule "dump ad-hoc ghi vào scratchpad, KHÔNG ghi root repo"; `.gitignore` thêm `scratch_*`. Lý do: 7 file `scratch_*` (dump swagger/API) sót ở root, **chưa gitignore** → một lần `git add .` là commit lộ PII (dump swagger chứa 24 email + 6 SĐT ở giá trị mẫu). (`f6f6cf1`)

## 2026-07-31 — Non-functional sâu · cross-browser lane

**Added**
- `scripts/qa/lighthouse_check.js` (`npm run lighthouse`) — điểm **Performance/Accessibility/SEO/Best-practices** qua CDP (`playwright-lighthouse`). Opt-in nặng (thiếu dep → skip sạch), never-auto + non-prod, verdict **advisory** theo dải chuẩn, evidence = ảnh bảng điểm. (`2a8ba04`)
- `perf_check --deep` — coverage động JS/CSS, `Performance.getMetrics`, heap, CPU/network throttling qua CDP thô. (`b8cd8e3`)
- **Lane cross-browser**: `CROSS_BROWSER=1` → thêm project `firefox-desktop` + `webkit-desktop`; `CROSS_BROWSER_GREP` cho tập critical; job `cross-browser` (manual) ở cả `.gitlab-ci.yml` và `ci.yml`. Lý do tách lane: `project` trong Playwright = **nhân bản suite**, gộp vào PR sẽ nhân 3× lượt chạy/evidence/nhiễu flaky. (`3ea1769`)

**Fixed**
- `desktopIgnore` dùng chung + thêm `**/support/**`: spec hạ tầng dưới `tests/support` đọc file **lúc load** làm **vỡ collection toàn suite** (`--list` ra `Total: 0` → gate F1 dễ `INFRA_FAILURE`). Sau fix: 238 test/53 file. (`3ea1769`)

## 2026-07-30 — Đọc tài liệu kỹ · siết Ambiguity Gate

- `RULE_GLOBAL` §"Analysis & Ambiguity Gate" (canonical) + digest ở `core_rules`: **đọc tài liệu THẬT KỸ** (mọi mục/bảng/ghi chú/footnote trong scope) và **gom câu hỏi làm rõ TRƯỚC khi gen testcase**; còn điểm Blocking → `AMBIGUITY_GATE: PENDING`, dừng chờ trả lời, **không đoán**. `02_gen_testcases.md` thêm "Bước 0" và bỏ escape *"cứ gen với assumption"* cho mức Critical/High. (`cb380b6`)

## 2026-07-27 — Token Broker (hết gián đoạn vì token 30')

- `tests/fe/support/auth/tokenBroker.ts` + `scripts/utils/auth/pick_token.js` — giữ 1 phiên SPA đã login sống, lấy **token tươi** mỗi lần gọi API (ưu tiên **capture header `Authorization`** thật của SPA), 401/403 → refresh → retry. Bỏ hẳn việc F12 dán `OPS_API_TOKEN`/`LMS_API_TOKEN`; `task.env` chỉ cần user/password. (`f70e786`)
- `tests/fe/support/lmsLogin.ts` + alias app-neutral cho app dùng IdP/OIDC (Keycloak…). **Fix quan trọng**: SPA phát hiện automation → loop trang login trắng; chữa bằng `--disable-blink-features=AutomationControlled` (global, đã nghiệm thu vô hại với Firefox/WebKit) + override `navigator.webdriver`. (`0e3bf79`)

## 2026-07-24 — Architecture hardening V2.1 · Forcing functions round-3

- **Canonical TestCase** (`scripts/lib/testcase/`): 1 parser duy nhất cho Markdown/XLSX, xoá 4 parser trùng; sửa lỗi `split('|')` làm lệch cột khi cell có `\|`. (`9fa14d9`→`9f537c3`)
- **GateEngine** (interface gate chuẩn + aggregate), **EvidenceManager** (sanitize + manifest), **TestContext**, **typed RuntimeConfig**, **Cleanup Manifest**, **DependencyGraph**, **QualityDecision** (GO/NO-GO). (`964efb1`, `6310e27`, `a5d6767`, `ddd6797`)
- **EvidenceRecorder** atomic + parallel-safe (shard per-TC, temp+rename). (`5717dae`)
- **Auth Strategy** — reuse session né throttle/lockout; seed localStorage bằng `addInitScript` **trước** khi SPA boot. (`415827c`, `888fced`)
- **Round-3 G1–G10**: `preflight_gate` (G1), `output_gate` phân tầng lỗi + chống oracle tautology (G2), `CLAUDE.md` non-negotiables (G3), verdict taxonomy 1 nguồn (G4), `design_gate` (G5), attestation-verify chống "tick suông" (G6), SessionStart hook bơm context (G7), bug gate (G8), `self_review` (G9).

## 2026-07-23 — CI integrity · coverage thật · metrics

- **GĐ1 CI integrity**: chống false-green (`test_inventory_gate`, SHARD_EMPTY), risk gate enforce, policy-source check, env pin, `secret_scan` + `audit_ci`, eslint/typecheck.
- **GĐ2 coverage**: suite FE/API thật đầu tiên (Order Total Amount Due, Transaction list, Product-Orders API) — verified UAT; ma trận traceability REQ→TC→AUTO→EXEC→BUG; `select_tests` (F9).
- **GĐ3 metrics**: `metrics_collect` (F11) + `reliability_index` (F10) + persistence commit-back `knowledge/metrics`.
- **Output Quality Gate** thành gate THỰC THI cho Test Execution / gen-testcase / bug + harness hook.

## 2026-07-21 — Knowledge Base · Risk-Based Testing

- `knowledge/` (schema `SCHEMA.md`) + skill `learning_recorder` + `git_impact_analyzer`.
- `risk_score`/`risk_gate` (RBT) + `seed_knowledge_from_jira` (bootstrap từ lịch sử Jira/Xray) + tune `risk_model.json` cho SAPP.
- Rule: "Kết quả mong đợi" đánh số **khớp từng bước**, cấm gộp range.
