# Changelog

> Lịch sử thay đổi **kit dùng chung** (shared). Kit chưa dùng semver → ghi theo **ngày + nhóm chủ đề**,
> nguồn là `git log main` (kèm commit hash để tra ngược).
>
> Vì sao cần file này: mọi thay đổi ở `playwright.config.js`, `package.json`, `scripts/**`, `prompt_templates/**`,
> `.agent/**`, `tests/support/**` đều là **shared change** (xem `RULE_GLOBAL.md` §Shared Change Gate) —
> ảnh hưởng mọi story đang chạy. Mỗi mục ghi **vấn đề → cách chữa**, không chỉ liệt kê tính năng.

## 2026-09-04 (b) — Tài liệu bắt kịp cấu trúc: slash command, tầng DB, và 5 con số đã cũ

**Vấn đề.** README/USER_GUIDE/QUICKSTART không nhắc `.claude/commands/`, `tests/support/setup/db/`,
`ui_debug_agent`, `db.conventions.json`, `locators.schema.json` — người mới đọc tài liệu sẽ không biết
chúng tồn tại. Và tài liệu còn dạy **15 chương dimensions** trong khi thực tế đã **20** (§3–§23): người đọc
mở đúng theo tài liệu sẽ **bỏ sót §22 inbound callback và §23 DB persistence**. CHANGELOG thì dừng ở 20/08.

**Chữa.** README: cây thư mục thêm `.claude/commands/` + `tests/fe/infra/` + `tests/support/setup/db/`,
thêm 2 dòng Main Components (slash command · DB Verification Layer), thêm khối "Slash command" đầu mục
Common Commands. USER_GUIDE: **Mục 9.0** mới (bảng 9 command kèm **điểm dừng** của từng luồng), thêm 2 dòng
vào bảng folder §4, thêm `ui_debug_agent` vào bảng prompt chính. QUICKSTART: mục "Slash Commands" đặt ngay
trước "Run Phase 1" — chỗ người mới gặp đầu tiên. Sửa cả 5 chỗ ghi số cũ.

**Ghi chú kỹ thuật cho lần sau:** file trong repo dùng **CRLF**, nên chuỗi tìm-thay **nhiều dòng** viết bằng
`\n` sẽ **không khớp** (im lặng, không lỗi). Chuẩn hoá EOL trong bộ nhớ rồi ghi lại đúng định dạng gốc.

## 2026-09-04 (a) — Slash command làm điểm vào + skill `ui_debug_agent` + 3 chỗ chồng chéo đã xử lý

**Mới — `.claude/commands/` (9 lệnh).** `/preflight` `/phase1` `/phase2` `/rerun` `/partial-rerun`
`/explore` `/ui-debug` `/gates` `/publish`. Mỗi command là **con trỏ mỏng**: đọc workflow nào · chạy npm
script nào · dừng ở gate nào. Không chép policy (đã có `gate:policy` giữ `RULE_GLOBAL.md` là canonical).
Bỏ `/proof` so với đề bài vì nó chỉ là một npm script lẻ (`mutation:check`) — vi phạm chính nguyên tắc
"không tạo command cho từng script"; `/gates` trỏ `self-review` là bó gate THẬT thay vì dựng bó mới.

**`.gitignore`: `.claude/` → `.claude/*` + `!.claude/commands/`.** Vấn đề: `.claude/` ignore toàn bộ nên
command chỉ tồn tại trên máy người tạo, và test hạ tầng sẽ **đỏ trên CI** vì thư mục không có. Phải dùng
dạng `.claude/*`: git **không đi vào** thư mục đã ignore nên negation cho đường dẫn con vô tác dụng. Đối
chiếu `git add --dry-run`: đúng 9 file `.md`, `settings*.json` vẫn ignore, `secret:scan` sạch.

**Mới — skill `ui_debug_agent` (phase2, Never-auto).** Kit đã có chuẩn locator, máy sửa (healing) và máy
kiểm (`lint:locator`) nhưng **thiếu bước khám phá lúc đầu**, nên agent đoán locator từ tên tính năng — nguồn
`script_error` lớn nhất ở lượt chạy đầu. Đo lại tiền đề: `getByTestId` **0 lần dùng thật** (2 hit duy nhất
nằm trong comment giải thích chính chuyện này), `tests/**` không có `data-testid` nào ⇒ tầng testId của
`locator_strategy.md` là **tầng chết**. Skill **không** viết bảng ưu tiên riêng (trỏ về rule canonical), chỉ
nhắc 4 nguyên tắc kèm dạng `safe_target` bắt buộc, 7 playbook tình huống khó, anti-patterns, 3 output.

**Sửa một điểm của đề bài:** đề mô tả chuỗi lệnh MCP browser. Đo: repo **không khai `mcpServers`** nào ⇒
viết skill gọi tool không tồn tại là "hứa thứ máy không làm được". Giữ nguyên 6 bước và luật (snapshot để
PHÂN TÍCH, screenshot chỉ làm EVIDENCE; resize ngay sau navigate; chờ theo tín hiệu) nhưng cột thực thi là
Playwright chỉ-đọc, kèm **bảng ánh xạ** sang MCP để cài sau là dùng được ngay.

**Máy giữ command khỏi mục rữa** (`slash-commands.spec.ts`, 14 test). `gate:policy` chỉ đo hai chặng
(`workflows` + prompt entry); command là **điểm vào thứ ba** nó chưa biết tới. Kiểm: mọi `npm run X` được
nhắc phải có thật · mọi đường dẫn phải tồn tại · mỗi command phải có `description` một câu và mục "Dừng
khi" · không chép policy và không quá 60 dòng · 4 luồng chạm UAT phải nhắc xác nhận · publish phải dry-run
trước `:apply` · **mọi nhánh trong `branch_parity.json` phải có command cùng tên**. Luật cuối cố ý **không**
nhét command vào `branch_parity.json`: file đó khai "MÁY nào chạy ở nhánh nào" kèm waiver, còn command là
ĐIỂM VÀO — trộn hai khái niệm thì phải viết waiver cho thứ không waive được.

**Mới — `.agent/config/locators.schema.json` + `locator-knowledge.spec.ts`.** Skill mới yêu cầu ghi vào
`knowledge/locators/` nhưng store đang có **đúng một file**; không chốt schema thì mỗi lượt ghi một kiểu.
Schema **không thiết kế mới** — chép hình dạng file đã dùng được. Gate: field bắt buộc không rỗng · không
field lạ · tên file `<màn>__<quirk>.json` · ngưỡng độ dài chống "điền cho có" (`why` cao nhất vì không có
cơ chế thì lần sau người ta lại thử cách cũ) · `status: active` mà thiếu `confirmed_by` là **đỏ** · store
rỗng thì **skip** (knowledge/** gitignore nên máy mới clone không có file — đỏ ở đó là đỏ oan).

## 2026-09-04 — `snapshotScreen` đang MÙ ant-select + radio và không mask PII (lớp GENERIC)

**Vì sao đáng chạm lớp GENERIC:** `scripts/utils/ui/screen_snapshot.js` **không** phải util nằm không —
`scripts/qa/ui_conformance_check.js` dùng nó, nên các lượt UI-conformance đang chạy trên một instrument mù
một phần. Ba lỗ đã đo:

1. **ant-select** — OPS là ant-design, dropdown là `div` và `input.value` bên trong **rỗng** ⇒ **mọi** giá
   trị dropdown vô hình. Đây chính là chỗ suýt làm kết luận "form không có `payment_method`".
2. **radio/checkbox** — giá trị ở `checked`, không ở `value`; đọc `value` là ra giá trị ô **chưa chọn**.
3. **PII** — snapshot ghi nhãn+giá trị ra JSON mà không che gì. Đã rò thật ở tầng task: **100 email + 100
   SĐT** nằm trong một file requirements.

**Chữa.** Thêm khối `controls` (3 loại ô, kèm `label`/`kind`/`disabled`). Mask **mặc định BẬT**: email theo
MẪU, họ tên/ngày sinh/CCCD theo **NHÃN**, ô bảng theo **HEADER CỘT** (cột Email/Phone không có nhãn kề bên
nên mask-theo-nhãn không tới được — đúng chỗ đã rò). **Cố ý không** mask theo hình dạng số chung: luật
`\d{9,12}` từng che luôn **Deal ID** (11 chữ số) — khoá dùng để nối UI với DB. Xuất `normNumber()`: màn CORE
hiện `"60 000 000"` còn màn Add-on hiện `"5.000.000"`, hàm so chỉ bỏ khoảng trắng thì **trượt 129/133 hàng**.

**Hai lỗi do test mới bắt được** (không phải lỗi fixture): `labelFor` nhặt **chữ hiển thị của control khác**
làm nhãn (ô "Recipient Bank Account" nhận nhãn "Trả góp"); và `labelsLoose` chưa mask nên **họ tên/email của
khách lọt vào danh sách "nhãn"**.

## 2026-08-27 → 09-04 — DB Verification Layer (§23): đọc bản ghi để KHOANH TẦNG lỗi

**Vấn đề.** UI và API không đủ để nói bản ghi đã lưu đúng: response thường **echo lại request**, còn FE thì
format lại giá trị. Bảy lớp lỗi (đổi kiểu số · lệch múi giờ · text bị cắt · xoá mềm hỏng · bảng liên quan
không đổi · double-submit · rollback sai) đều **UI xem như đúng**.

**Mới — `tests/support/setup/db/`.** Read-only tuyệt đối, 4 lớp chặn: đọc quyền từ catalog (chứ **không**
probe-ghi — `CREATE TEMP TABLE` chứng minh sai vì Postgres cấp `TEMPORARY` cho PUBLIC) · session
`default_transaction_read_only` · lint câu lệnh · allowlist host. So sánh theo **NGHĨA**: `money()` (cùng
khái niệm tiền, hai kiểu lưu: `bigint` và `varchar`) · `instant()` · `text()`. Có **trạng thái thứ ba**
`inconclusive` — "không đo được" KHÔNG thành PASS (39/39 cột thời gian là `timestamp WITHOUT time zone`,
chưa khai `storedZone` thì so mốc là đoán).

**Bản đồ cột↔nhãn khoá THEO MÀN** (`.agent/config/db.conventions.json`, 8 màn). Hai lý do, cả hai đo được:
cùng một cột có nhãn khác nhau giữa hai màn (`original_price` = "Gross Amount" ở CORE nhưng "Gross Price" ở
SERVICE_FEE); và **cùng một nhãn có thể là hai cột khác nhau** ("Paid Amount" ở tab Overview là tiền đã trả
thật, ở form `/edit` là cột `deposit`). Cột **chưa neo thì KHÔNG được dùng để phán** — đoán sai cột vẫn ra
kết luận, lại **có số từ DB** nên trông thuyết phục hơn bug ma thường. Tra bản đồ **phải qua**
`uiLabelOfColumn`/`uiLabelOfValue` — hai hàm **ném** khi cột/enum chưa neo hoặc khi hỏi nhãn của màn khác.

**Neo được mà KHÔNG cần fixture:** `fieldmap.candidates.spec.ts` hỏi DB xem đơn nào **sẵn có** đã tự phân
biệt — 6/8 cột treo có bản ghi thật, không phải tạo dữ liệu. Trước đó cả 8 cột bị ghi "cần fixture" chỉ vì
kết luận dựa trên 6 đơn mở tay.

**`preflight_gate` chặn ở cửa vào** (`scripts/qa/lib/db_verify_preflight.js`, 28 test). Trước đó
`db.conventions.json` không được gate nào nhắc tới ⇒ thiếu config/creds chỉ lộ ra khi spec đã chạy, và
thông điệp lúc đó là lỗi kỹ thuật chứ không phải "bạn thiếu input". **Chỉ kiểm khi task KHAI dùng** (manifest
`db_persistence`, hoặc tag `[DbPersist]`) — kiểm vô điều kiện là chặn oan mọi task không đụng DB, và gate
chặn oan thì bị tắt sau hai lần. Phần **sống** đọc quyền thật: có quyền ghi ⇒ chặn; **đọc được 0 dòng quyền
cũng chặn** (phép đo hỏng, không phải "sạch").

**Từ vựng quyền chuẩn hoá ở ADAPTER** (`types.ts`: `Privilege` + `normalizePrivilege`). `guard.ts` từng so
bằng đúng chữ SQL; Postgres/MySQL dùng chữ đó nên "chạy tốt", nhưng Mongo gọi hành động ghi là
`insert`/`update`/`remove`/`drop` ⇒ thêm adapter Mongo là guard **không thấy quyền ghi nào** và kết luận
"read-only" cho một user ghi được. Kèm gate seam: `dbVerify.ts` không được chứa SQL · `guard.ts` không được
import adapter · adapter phải chuẩn hoá ở **mọi** chỗ trả `GrantRow`.

**Bốn lỗ hổng loại "vẫn xanh mà nghĩa đã sai" đã bịt:** `loadConventions()` dựng lại object theo allowlist
nên khối `fieldMap` khai trong JSON mà code **không bao giờ thấy** (9 test đỏ vì `undefined`) — nay khối lạ
⇒ **ném** kèm tên khối · gate §23 còn khoá theo tên khoá **cũ** không tồn tại · regex §23 bị escape ăn
(`\bdeleted_at\b` thành `0x08`) làm luật nhận `deleted_at` **hỏng âm thầm**, và xoá ký tự lạ thì gate xanh
lại mà **mất word-boundary** ⇒ thêm test chạy CLI thật đếm §23 · test cũ khoá `storedZone` phải **trống**
trong khi đã đo được `UTC`.

**Cột tỉ lệ tách khỏi tiền** (`rates`): `service_fee_rate` max 20 và `fixed_discount` 5/10/15 — biên độ 0..20
không thể là VND. Để trong `money` thì `money()` vẫn "chạy" nhưng nói *"lệch 5 đồng"* cho một tỉ lệ.

**Mới — `prompt_templates/phase1/dimensions/23_db_persistence.md`** (và §22 inbound callback). Tổng số chương
dimensions: **15 → 20**.
## 2026-08-20 (d) — 9 Case Type có ĐỊNH NGHĨA: một nguồn, và publisher hết đường hạ ngầm

**User mở rộng 6 → 9 loại** kèm định nghĩa đầy đủ từng loại (định nghĩa · tag đi kèm · "chọn khi" · **"KHÔNG chọn khi"**). Đối chiếu `GET /config`: AIO có đúng 9 — `UI(1) Integration(2) Functional(3) API(4) Performance(5) Security(6) Database(7) E2E(8) Accessibility(9)`; `Unit` là tên cũ của id 1, đã đổi thành `UI` nên **1.399 case đã publish giữ nguyên ID**, không phải migrate.

**Vấn đề — danh sách nằm ở 5 chỗ.** `validate.js` (regex) · converter (comment + message) · prompt gen (bảng) · publisher · test. Mở rộng bằng cách sửa tay 5 chỗ là 5 cơ hội để một chỗ còn 6 — và chỗ đó sẽ **CHẶN theo bảng cũ trong khi tài liệu dạy bảng mới**. Chữa: [`.agent/config/case_types.json`](.agent/config/case_types.json) là **nguồn duy nhất**, mọi nơi đọc file đó; bảng trong prompt và mọi test đều sinh/kiểm từ nó. Đã dính ngay lần đầu: `precondition-catalog.spec.ts` là chỗ duy nhất còn chép tay 6 giá trị và nó **đỏ đúng lúc** — bằng chứng cách làm này có răng.

**Vấn đề — publisher hạ ngầm về `Functional`.** Gặp tên loại không resolve được, bản cũ in một dòng `⚠` rồi **vẫn ghi lên AIO** với `Functional`. Cảnh báo trôi mất trong log của lệnh đẩy hàng trăm case, còn dữ liệu thì sai vĩnh viễn — **AIO không có API xoá**. Đúng cơ chế đã làm 14 case `Highest` tụt xuống Medium. Chữa: bỏ hằng `CASE_TYPE_FALLBACK`, gom lỗi trên **toàn bộ** danh sách rồi **DỪNG TRƯỚC vòng ghi** (dừng giữa vòng để lại nửa bộ trên AIO không dọn được), in kèm danh sách tên AIO đang có. Đã chạy thật: bộ đã khai đủ (SAPP-26878) dry-run **qua**; bộ chưa khai (SAPP-24395) **CHẶN** và **gọi tên từng TC ID**.

**Mới — cảnh báo tag ↔ loại.** Case gắn `[Security]` mà khai `Functional` thì kêu, kèm trỏ tới mục "KHÔNG chọn khi" của loại được gợi ý. **Cảnh báo chứ không chặn**, có lý do: chính bảng 9 loại liệt kê các ca chồng lấn HỢP LỆ (`[Display]` nhưng lỗi do BE tính sai ⇒ `Functional` chứ không phải `UI`) — chặn ở đây là phạt đúng những case phân loại tinh nhất, và dạy người ta gán tag cho khớp gate thay vì suy nghĩ. Case mang **nhiều** tag ánh xạ được thì im lặng: bản thân tag đã không quyết được loại.

Kèm: test khoá **mọi tag trong bảng phải là tag chiều CÓ THẬT** của kit (`TAG_OF`) — bảng dạy một tag mà `dim:coverage` không biết thì bảng và gate đánh nhau, người dùng lãnh đủ.

**Chi phí phải nói rõ:** gate publisher chặn cả việc **publish lại** 12 bộ cũ (chưa có cột). Lối ra là kéo lại mirror (`aio:pull:write` nay mang Case Type về) hoặc điền cột. Mirror cũ **không** dùng được: bản của SAPP-13964 có **63/63 case trống loại** vì được kéo trước khi pull có cột này.

Test: `case-type-gate.spec.ts` 16 · khối `Loại case` ở `expansion-gates.spec.ts` 7 · `precondition-catalog.spec.ts` cập nhật. Toàn bộ infra **227/227**, lint 0 error, `gate:policy` 4/4.

## 2026-08-20 (c) — trục PHÂN LOẠI của case: khai chứ không đoán; + máy gác vệ sinh mù `.md`

**Vấn đề 1 — Case Type trên AIO là trường chết.** AIO có sẵn 6 Case Type (`Unit`·`Integration`·`Functional`·`API`·`Performance`·`Security`) nhưng Excel canonical không có cột nào mang nó, nên publisher **SUY** từ tên nhóm chức năng. Đo trên 1.399 case đã publish: **96% rơi về `Functional`**, `Integration` và `Performance` = **0** ⇒ mọi phép lọc/báo cáo theo Case Type là vô nghĩa. Gốc của lỗi là ép **hai trục** làm một: nhóm chức năng trả lời *"thuộc mảng nghiệp vụ nào"* (→ thư mục), Case Type trả lời *"kiểm thử kiểu gì"*.

Chữa: thêm cột `Loại case` vào template (9→10 cột) + gate **CHẶN ở biên SINH case** (`md_to_xlsx.js`), KHÔNG thêm vào `REQUIRED_COLS`. Chỗ chặn là quyết định có đo: `validate()` là bộ đọc dùng chung — siết ở đó thì **cả 9 bộ TC cũ (đều 9 cột) đỏ oan** trong khi không ai làm sai; đo lại sau khi sửa: **13 bộ cũ, 0 bộ bị chặn vì cột mới** (523 vi phạm của SAPP-23439 là tag `Tiền điều kiện` có từ trước, 0 dòng liên quan). Một luật một chỗ: converter lo *cột vắng mặt*, `validate.js` lo *giá trị sai*.

**Vấn đề 2 — thang ưu tiên hạ cấp âm thầm.** Canonical dùng tên thang **Jira** (`Highest`) trong khi AIO đứng đầu bằng `Critical`; publisher map theo TÊN, không có khoá `highest` nên rơi fallback `|| 3` = Medium ⇒ **14 case của một bộ bị hạ ưu tiên mà không ai biết**. Chữa: canonical đổi sang `Critical|High|Medium|Low|Lowest`; `Highest` còn là alias **có cảnh báo** để không phá bộ đang chạy; đường log bug tự map ngược `Critical → Highest` cho Jira.

**Vấn đề 3 — máy gác vệ sinh nguồn mù với `.md`.** Máy gác ký tự điều khiển lạc chỉ quét `.js/.ts/.json` dưới `scripts/` + `tests/`. Quét lại **toàn bộ file đã track** thì lòi ra: chính `CHANGELOG.md` — đoạn văn **ĐANG MÔ TẢ** cái bẫy "escape bị heredoc ăn" — tự giữ **5 ký tự `0x08` thật**, và không máy nào kêu kể từ lúc viết. Chữa: mở phạm vi sang `.md` + `prompt_templates/` · `.agent/` · `partial-rerun/` + 6 doc gốc ở thư mục repo. Prompt và rule là bề mặt **ĐIỀU KHIỂN HÀNH VI** — escape hỏng ở đó làm luật im lặng không khớp y hệt như trong code. Đối chứng âm đã chạy: bơm 1 file `.md` bẩn vào `prompt_templates/` → gate **ĐỎ đúng file**, gỡ ra thì xanh (gate không chỉ sống trên fixture).

**Luật vào canonical trong CÙNG đợt** (RULE_GLOBAL §Shared Change Gate): quy ước `Loại case` + thang ưu tiên đã viết vào `RULE_GLOBAL.md` và digest `core_rules.md`. Lần commit gate đầu tiên tôi quên — đúng lớp lỗi mà điều luật đó sinh ra để chống: gate chặn người dùng theo một luật **không tồn tại trong nguồn rule**.

Kèm: `skills:index` tái sinh không còn bẩn cây — bản `INDEX.md` trong repo từng bị **sửa tay** (`**AIO Tests**`) trong khi nguồn `SKILL.md` để trơn, nên mỗi lần chạy đúng lệnh tái sinh là mất sửa tay. Đưa phần định dạng về NGUỒN; chạy 2 lần liên tiếp cây sạch.

Test: `tests/fe/infra/case-type-gate.spec.ts` (11 test) + khối `Loại case` trong `expansion-gates.spec.ts` + `cli-guard.spec.ts` mở rộng. Toàn bộ infra **215/215**, lint 0 error, `gate:policy` 4/4.

Commit: `045bcdc` · `5785f51` · `a041956` · `4067d94` · `04fca86`.

> **Cùng ngày nhưng CHƯA ghi vào file này** (luồng khác, không phải đợt này): `6056916` `4ec0b6a` `0a4c8a0` (precondition thành MỘT TRƯỜNG, bỏ mã `PRE-NN`), `64e7d22` (mirror AIO phải chứng minh còn tươi), `3fb94f9` (status không phải verdict bị đẩy thành "Not Run"), `ff8cc36` (`trace:matrix` crash + self-review báo oan task backend).

## 2026-08-20 (b) — BỎ HẲN Xray: xoá 14 file, 1 công tắc, 42 biến env, và cấm cả cái tên

User chốt: *"bây giờ cũng không cần giữ Xray nữa, tôi cần sạch và kể cả comment"*. Trước đó kit đang ở
trạng thái "AIO là đường chính, Xray là legacy có nhãn" — nghĩa là vẫn còn hai lối, vẫn còn 375 chỗ nhắc
tên công cụ cũ trên các bề mặt làm việc. Mỗi chỗ như vậy là một **đường mòn**: dẫn người/agent đi tìm lệnh
không còn tồn tại, cấu hình biến không ai đọc, hoặc tưởng còn hai lựa chọn để cân.

**ĐÓNG BĂNG BẰNG CHỨNG TRƯỚC KHI XOÁ** (việc phải làm đầu tiên, vì sau khi bỏ Xray thì không còn nguồn để
chạy lại phép đối soát): `aio:reconcile` chạy full trên **15/15** Test Execution — Run **2103/2103**,
trạng thái **`Failed=47 Not Run=70 Passed=1986`** khớp hai đầu, mỗi cycle có số case phân biệt = số run
(không case nào bị chồng attempt), Test Plan **2/2** → 2 thư mục cycle với 16/17 cycle nằm đúng chỗ (cái
ngoài là `Ad hoc` của hệ thống). Số liệu ở đây là bản lưu cuối cùng — công cụ sinh ra nó cũng đã bị xoá.

**Removed — 14 file**:
- `scripts/integrations/jira/`: `xray_cloud.js` · `publish_testcases.js` · `pull_testcases.js` ·
  `push_test_execution.js` · `update_xray_steps.js` · `cleanup_xray_tests.js` · `create_test_plan.js` ·
  `unassign_all_tests.js` · `cleanup_precondition_requirement_links.js`
- `scripts/integrations/aio/`: `migrate_testcases.js` · `migrate_execution.js` · `reconcile_migration.js`
  (di trú đã xong và đã đối soát ⇒ ba script này không còn việc)
- `scripts/integrations/tms.js` — **công tắc không còn gì để chuyển**: một tool thì không cần switch. Kéo
  theo: bỏ `TEST_MANAGEMENT_TOOL` khỏi env/doc, bỏ `assertTool` khỏi mọi entrypoint, bỏ khối test tương ứng.
- `docs/user-guide-images/xray-traceability.png`
- 9 npm script (`jira:testcase-publish*`, `jira:testcase-cleanup*`, `aio:migrate-*`, `aio:reconcile`).

**Changed — nơi Xray từng có VAI TRÒ THẬT, phải thay bằng thứ khác chứ không chỉ xoá chữ**:
- `traceability_matrix.js`: cột `Xray` đọc `reports/jira-testcase-publish.json` (artefact Xray) → cột
  **`PUBLISH`** suy từ mirror `test-cases/from-aio/*.xlsx`. Vẫn offline, vẫn giữ được flag `chưa-publish`.
- `seed_knowledge_from_jira.js`: bỏ hẳn nhánh `--with-execution` (nó đọc Xray GraphQL). Seed bug từ Jira
  giữ nguyên.
- `verdict_taxonomy.json`: bỏ cột `xray` (10 status) — còn 1 cột `aio`, đúng tinh thần 1-nguồn.
- `PUSH_XRAY_EXECUTION` → **`PUSH_EXECUTION`**, `REPUBLISH_XRAY` → **`REPUBLISH_TESTCASES`**;
  `from-xray` khỏi `TESTCASE_MIRROR_DIRS`; `xrayKey` → `caseKey` trong `test_context`.
- `.env` thật + `.env.example`: **42 biến `XRAY_*`** bị xoá (3 ở .env, 39 ở example) sau khi đo rằng
  KHÔNG script nào còn đọc chúng. Đối soát .env: 65 biến còn lại, hash `KEY=VALUE` khớp hệt (chỉ mất đúng
  phần Xray), `integration:check:live` vẫn 4/4 service OK.
- `partial-rerun/run_xray_test_cleanup.md` → **`run_testcase_cleanup.md`** + sửa 11 nơi trỏ tới.
- Sơ đồ `main-flow`/`phase1`/`phase2`/`partial-rerun`/`phase-selection` sinh lại theo AIO; `jira/README.md`
  viết lại chỉ còn phần thật sự còn: fetch requirement · log bug · publish Confluence.

**Changed — luật gate: từ "đừng dạy như đường chính" sang CẤM TUYỆT ĐỐI.** `gate:policy` cũ có cửa thoát
`legacy`, và chính cửa đó để sót 12 chỗ dạy lệnh đã bị xoá. Luật mới (`NO-XRAY`) chặn **mọi** lần xuất hiện
của cái tên trên bề mặt làm việc (prompt · workflow · skill · rule · scripts · tests · doc gốc ·
`.env.example`), KHÔNG soi `CHANGELOG.md`/`outputs/`/`knowledge/` vì đó là **lịch sử** — xoá đi là xoá dấu
vết việc đã làm. Miễn trừ đúng **hai** file: luật và test khoá luật (ở đó cái tên xuất hiện với vai trò "thứ
bị cấm"); miễn theo đường dẫn cụ thể để không thành lỗ hổng mở rộng dần.

**Đo được**: 375 chỗ → **0**. Ba test khoá luật: repo thật sạch · một dòng nhắc lại là CHẶN · lịch sử KHÔNG
bị soi (test này còn assert CHANGELOG *phải* còn dấu vết, nếu không thì chính nó vô nghĩa).

**Nghiệm thu**: `gate:policy` 4/4 xanh · **169/169** spec infra xanh · lint 0 error · typecheck sạch ·
`preflight` phase2 ĐẠT trên task thật · `aio:pull` dry-run vẫn đọc đúng 50 case · `integration:check:live`
4/4. Kit giờ chỉ còn **một** công cụ test-management, và không còn chỗ nào nhắc cái đã bỏ.


## 2026-08-20 — Xray → AIO Tests: đóng nốt LỚP TÀI LIỆU + dựng máy kiểm TMS-drift

Bối cảnh: **GĐ1–GĐ5 đã chuyển xong ở tầng CODE** (`715f8e4`, `ac49e7a`, `d5ce910`, `92ab7df`, merge `6446dd6`):
8 script trong `scripts/integrations/aio/`, công tắc duy nhất `TEST_MANAGEMENT_TOOL` mặc định `aio`
(`scripts/integrations/tms.js`), 5 entrypoint Xray **tự chặn** kèm lệnh thay thế, gate nhận cả
`from-xray`/`from-aio`. CHANGELOG chưa có mục cho đợt đó — mục này ghi bù, cùng với phần còn thiếu.

**Vấn đề đo được (20/08/2026)**: code có răng nhưng **tài liệu thì không gì gác** — 23 file hướng dẫn
(~250 lần nhắc) vẫn dạy Xray là đường chính: `prompt_templates/phase1/04_auto_publish_jira.md` 41 lần nhắc
Xray / 1 lần nhắc AIO, `run_phase2_template.md` 25/5, `USER_GUIDE.md` 69/0, `README.md` 24/0,
`QUICKSTART.md` 16/0. `.agent/workflows/phase2_01_prepare_execution.md` **tự mâu thuẫn** (dòng 19 nói mặc
định `aio`, dòng 39 nói mặc định `xray`). Nghĩa là **agent chạy đúng theo prompt sẽ đụng thẳng cửa chặn**
vừa dựng, còn người đọc thì học sai mô hình. Đúng kiểu lỗ hổng kit gặp nhiều lần: thiếu MÁY KIỂM, không
thiếu quy định.

**Changed — lớp tài liệu (AIO là đường chính, Xray xuống mục "LEGACY")**:
- Viết lại: `prompt_templates/phase1/04_auto_publish_jira.md`, `.agent/workflows/phase1_04_auto_publish_jira.md`,
  `.agent/skills/shared/jira_testcase_publisher/SKILL.md`, `partial-rerun/run_xray_test_cleanup.md`,
  §5.5.0–5.5.2 của `USER_GUIDE.md` (mô hình Case → Cycle → Run thay Test → Test Plan → Test Execution),
  §13b của `run_phase2_template.md`, mục "Mô hình Traceability" của `README.md`.
- Sửa "mặc định là Xray" → "mặc định là AIO" ở `RULE_GLOBAL.md`, `.agent/rules/core_rules.md`,
  4 workflow Phase 1/2, 2 prompt execute, 3 template run, 3 file `partial-rerun`, `QUICKSTART.md`,
  `.agent/config/project_context.md`, `verdict_taxonomy.json` (chú thích), `skills/INDEX.md`.
- Glossary web `docs/library/src/**` (+ build lại `index.html`): status ánh xạ sang **AIO** thay Xray
  (`aio:` thay `xray:`, `BLOCKED_SETUP → Blocked` thay vì bị ép thành "TO DO"), `XRAY_MODEL` → `TMS_MODEL`.
- `profiles/task.env.example`: nói rõ `JIRA_XRAY_ASSIGNEE`/`XRAY_EXECUTION_DONE_STATUS` **chỉ còn tác dụng ở
  đường legacy** (case/cycle AIO không phải Jira issue nên không có assignee/workflow).
- `.env`: khai **tường minh** `TEST_MANAGEMENT_TOOL=aio` + `TESTCASE_SOURCE=aio` thay vì sống nhờ default.

**Fixed — CI đang sẽ đỏ mà chưa ai chạy tới**: `.github/workflows/integration-check.yml` gọi
`npm run jira:testcase-publish:dry-run`, mà lệnh đó **tự chặn** khi tool là `aio` ⇒ job chắc chắn fail.
Nay: env `AIO_API_TOKEN` thay `XRAY_CLIENT_*`, bước dry-run chuyển sang `npm run aio:publish` (tự tìm Excel
canonical của task, không có thì bỏ qua chứ không fail giả).

**Added — live-check AIO trong `integration:check:live`**: trước đây nhãn ghi "Jira/Confluence/Xray" nhưng
**không có** phép kiểm Xray nào. Nay có `testAio()` gọi `GET /project/<KEY>/config` — và **coi body rỗng là
lỗi**, vì rate limit của AIO trả body rỗng chứ không phải 429 (đặc tính đã đo). Nghiệm thu thật: 4/4 service OK.

**Added — máy kiểm `TMS-DRIFT` trong `gate:policy`** (`scripts/qa/policy_source_check.js`): chặn 2 luật trên
tài liệu hướng dẫn (`prompt_templates/**`, `.agent/**`, `partial-rerun/**`, `docs/library/src/**`, README /
QUICKSTART / USER_GUIDE / RULE_GLOBAL / CLAUDE):
1. dòng dạy lệnh Xray legacy (`jira:testcase-publish`, `jira:testcase-cleanup`, 5 script Xray);
2. dòng mô tả `xray` là **mặc định**.
Thoát bằng cách ghi rõ trên CHÍNH dòng đó: `legacy`/`đóng băng`/`--test-management-tool xray`.
- **Chống báo oan**: bỏ TÊN BIẾN `*_XRAY_*`/`XRAY_*` trước khi soi — `PUSH_XRAY_EXECUTION` giữ tên cho tương
  thích ngược nhưng nay điều khiển đường AIO; không loại thì **3/15 hit đầu là oan**, mà gate báo oan thì
  người ta tắt gate chứ không sửa nội dung.
- **Có răng thật**: lượt đầu bắt **15 dòng** tôi tự sót (12 thật + 3 oan) — trong đó `README.md` còn 3 lệnh
  publish Xray ở bảng Common Commands, `partial-rerun` còn 2 lệnh cleanup, glossary còn 2 `cmd:`.
- **Đối chứng âm**: bơm lại bản CŨ của `04_auto_publish_jira.md` từ `git show HEAD:` ⇒ gate ra **4 hit**;
  phục hồi ⇒ xanh. Không dựa fixture, chạy trên nội dung thật.
- `partial-rerun` được thêm vào `SEARCH_ROOTS` của check "npm script mồ côi": nó là **điểm vào** thật, thiếu
  nó thì lệnh chỉ còn nằm ở mục LEGACY của nhánh phụ sẽ bị báo mồ côi oan.

**Added — 4 test khoá luật** (`tests/fe/infra/gates.spec.ts`): repo thật phải sạch · dòng vi phạm phải bị chặn ·
dòng có nhãn legacy KHÔNG bị chặn · tên biến `PUSH_XRAY_EXECUTION` KHÔNG bị coi là "dạy Xray". Probe là **file
thật** ghi vào root đang được quét rồi xoá trong `finally` (gate đọc đĩa). Nghiệm thu: **53/53** spec gates xanh.

**Đính chính trong cùng ngày — di trú dữ liệu ĐÃ XONG, không phải "chưa chạy"**: bản đầu của mục này ghi
`aio:migrate-tc`/`aio:migrate-exec` "chưa apply lần nào", suy ra từ việc **không có artefact di trú nào trong
`outputs/`**. Đo trực tiếp trên AIO thì ngược lại — vắng báo cáo không có nghĩa là vắng dữ liệu:

| Đối tượng | Xray | AIO |
|---|---|---|
| Testcase | 1399 (10 task) | **1399** case · 100% có `automationKey` · tất cả `Published` |
| Cây folder | 103 folder theo task | **117** folder, sâu 3 cấp (giữ cấu trúc Test Repository) |
| Test Execution → Cycle | 15 | **15/15** có cycle |
| Test Run | 2103 | **2103** · mỗi cycle có số case phân biệt = số run |
| Trạng thái run | `Failed=47 Not Run=70 Passed=1986` | **giống hệt** |

Tức bẫy "khớp theo tiêu đề làm mất 12 run" đã được xử lý xong trước đó (563/563 case phân biệt ở cả 2
execution lớn nhất).

**Added — `scripts/integrations/aio/reconcile_migration.js` + `npm run aio:reconcile`** (chỉ đọc): biến phép
đo trên thành **lệnh thường trực**. Lý do: hai script migrate báo "XONG" theo số việc **gửi đi**, không đọc lại
đích — bản đầu từng mất 12 run mà log vẫn xanh. Sau **21/08/2026** (Xray đóng băng) phát hiện thiếu thì không
còn nguồn chạy lại, nên phép đếm hai đầu phải chạy được bất cứ lúc nào. Đo 3 lớp mất dữ liệu khác nhau: số
run · số case phân biệt trong cycle (chống chồng attempt) · trạng thái run. Ghi rõ **giới hạn**: 0/15 lệch nên
**nhánh báo đỏ chưa gặp ca thật** — muốn thử răng thì thêm 1 run trên Xray rồi chạy lại trước khi migrate.
- Bẫy đọc gặp ngay khi làm: trạng thái run **không** ở `record.status` mà ở
  `record.runs[<attempt cuối>].testRunStatus.name` — đọc sai chỗ ra `?=2103` mà API vẫn trả 200 (đúng đặc
  tính #9 đã ghi trong README module).

## 2026-08-19 (r) — mở đường CHẶN cho ②: verification theo ASSERTION, không theo bước

Lượt (n) đo được 68% case ghi ít verification hơn số assertion, nhưng **cố ý chỉ cảnh báo** vì `steps[]` là *proxy*
(bằng chứng theo **bước**, không theo **assertion**). Lượt này tạo ra dữ liệu đúng chiều để gate được phép chặn.

**Added — `scripts/lib/testcase/assertions.js`**:
- `deriveAssertions(tc)` sinh khung assertion **từ chính "Kết quả mong đợi"** (mỗi dòng = 1 assertion, bỏ số đánh
  dòng của format canonical) ⇒ adoption gần như không tốn công.
- Hợp đồng dữ liệu **tùy chọn** trong bản ghi execution: `assertions: [{text, verified, evidence, note?}]`.
- `auditCase/auditExecution`: **có dữ liệu thì CHẶN** (`verified=true` mà thiếu `evidence` ⇒ chặn · chưa `verified`
  mà không nêu lý do ⇒ chặn); bản ghi **cũ không có field này thì không bị phạt**, chỉ báo tỉ lệ áp dụng. Đây là
  cách duy nhất siết dần mà không làm đỏ 2/3 bản ghi lịch sử.

**Đo trên bộ 530 case: 1217 assertion nguyên tử**, trong đó **191 dòng (16%) còn nhồi nhiều điều kiện**.
`deriveAssertions` chỉ **đánh dấu** `compound`, **không tự tách** theo dấu phẩy — tự tách sẽ cắt sai đúng những câu
có số ("Tổng 1.234.567đ, đúng định dạng"), và một gate cắt sai thì mất uy tín ngay lần đầu.

**Bẫy `\b` với chữ có dấu — lần thứ TƯ trong phiên.** `/,\s*(và|kèm)\b/` không bao giờ khớp ", và" vì "à" không
phải word-char ⇒ `compound` luôn false. Đáng ghi: **máy gác vệ sinh source không bắt được loại này**, vì `\b` ở đây
**hợp lệ về cú pháp**, chỉ sai ngữ nghĩa với tiếng Việt. Bài học: có lớp lỗi chỉ **test hành vi** mới bắt được, không
lint nào thay được — nên mỗi luật mới phải có test khẳng định nó **thật sự khớp** trên dữ liệu tiếng Việt.

Suite hạ tầng: 138 → **145 test**.

## 2026-08-19 (t) — lane visual: 1 test/màn (4 màn tất định) + nối `uiContract` từ bindings

**Fixed — gộp nhiều màn vào 1 test là sai thiết kế.** Bản đầu loop 4 màn trong MỘT test ⇒ (a) cả 4 dùng chung hạn
30s nên màn thứ 4 **timeout**, (b) một màn lỗi là mất luôn kết quả các màn sau. Nay **mỗi màn một test** (hạn riêng
90s, khai được `timeoutMs`), báo cáo chỉ đỏ đúng chỗ hỏng.

**Nghiệm thu lại trên 4 màn** (2 Chuyển nhượng + 2 Chuyển đổi, UAT read-only): lượt 1 tạo **4 baseline**, lượt 2 so
lại **4/4 PASS với 0 mask** ⇒ capture tất định trên cả 4. Vẫn giữ nguyên cảnh báo: pass ở lượt 2 chứng minh **tất
định**, KHÔNG chứng minh màn **đúng**.

**Fixed — `uiContract` sinh ra mà không có đường tới checker.** `spec_extract` không truyền `uiContract`/`visualMask`
từ bindings sang catalog ⇒ contract `UI-*` vừa xây **không cách nào được tiêu thụ** khi catalog là bản tự sinh. Đã
truyền tiếp. Cố ý **chưa bind contract nào**: contract đầu tiên mới curate 2 khối từ canvas mockup, bind vào màn
không đúng sẽ sinh rừng FAIL giả — đúng tinh thần "máy đề xuất, người chốt". Đã ghi chú cách dùng vào bindings.

## 2026-08-19 (s) — visual regression: bộ chụp riêng, và ĐO tất định thay vì tin là tất định

**Added — lane `tests/fe/visual/` + `scripts/utils/ui/visual.js`.** Ảnh evidence hiện có (~1000/ task) **không dùng
làm baseline được**: full-page · dữ liệu động · mask PII bằng cách **sửa DOM** ⇒ mỗi lần chạy một ảnh khác, diff luôn
≠ 0 và đội sẽ học cách bỏ qua. `freeze()` triệt 4 nguồn bất định (animation/transition · caret · lazy-load · scrollbar)
và **in ra đã can thiệp những gì**; `captureOptions()` mặc định **không** full-page (càng dài càng nhiễu), ngưỡng
`maxDiffPixelRatio 0.01`, `mask` khai ở **lớp task** (`requirements/visual_targets.json`).

**Nghiệm thu tất định bằng 2 lượt chạy thật, không bằng lập luận**: lượt 1 tạo baseline 2 màn (UAT, read-only) →
lượt 2 so lại **PASS** với **0 mask** ⇒ capture tất định trên 2 màn đó. (Pass ở lượt 2 chỉ chứng minh *tất định*,
KHÔNG chứng minh màn *đúng* — oracle ở đây là chính build.)

**Giới hạn ghi thẳng vào luật**: oracle = "bản build đã được chấp nhận lần trước" ⇒ bắt **regression**, **không** bắt
cái sai từ đầu. Nên nó **bổ trợ**, không thay `UI-*` contract và không thay assert hình học. Không có
`visual_targets.json` ⇒ lane **skip kèm lý do** ("CHƯA ĐO ĐƯỢC"), tuyệt đối không tính PASS.

**KHÔNG commit baseline** (`.gitignore`): (1) ảnh chụp màn UAT có tên/email/CCCD — dù là dữ liệu `IT test` vẫn là dữ
liệu khách, mà commit là publish sang 2 remote; (2) baseline Playwright gắn OS/browser (`-chromium-desktop-win32`)
nên commit từ máy Windows thì CI Linux vẫn phải chụp lại — cam kết sai chỗ.

3 test offline (DOM giả lập) khoá kỷ luật chụp: `freeze` đưa animation về `0s` + về đầu trang · `captureOptions`
không full-page + có ngưỡng · `loadTargets` loại màn thiếu `url` và **đếm số bị loại**.

## 2026-08-19 (q) — nối `UI-*` vào checker (FE có neo) + ⑤ biến thiên data theo RUN_ID

**Nối contract vào máy — mắt xích cuối của chuỗi FE.** Có contract mà **không gì tiêu thụ** thì nó là gánh nặng chứ
không phải oracle. `ui_conformance_check` giờ nhận `screen.uiContract`: nạp `knowledge/system/UI-*.json`, đi qua
`aliases` (tên design ≠ tên build) rồi đối chiếu tập nhãn từng khối. Deviation sinh ra mang **`oracle_ref`** ⇒ theo
luật mục 6 mới được phép PASS/FAIL; trước đó mọi phát hiện FE chỉ có thể là OBSERVATION.

Ba trạng thái tách bạch, mỗi cái một nghĩa khác nhau:
- `contract.label-missing` — design có nhãn, build thiếu ⇒ **có neo**, kết luận được.
- `contract.no-container` — design có khối mà **không định vị được** trên build ⇒ hoặc build thiếu khối, hoặc thiếu
  alias; **chưa kết luận**, không được coi là đã đối chiếu.
- `contract.missing` — khai `uiContract` mà file không tồn tại ⇒ báo, **không im lặng coi như đã đối chiếu design**.

Cố ý **chưa bind contract thật vào màn thật**: `UI-ORDERDETAIL-001` mới curate 2 khối, bind sai màn sẽ sinh một rừng
FAIL giả. Test dùng DOM + contract giả lập, gồm ca **có alias thì khớp / không alias thì nói chưa đối chiếu được**.

**⑤ `scripts/lib/expansion/variation.js` — xoay data nhưng TÁI LẬP.** Dùng đúng một bộ data mỗi lượt thì độ phủ
**đóng băng**: 20 lượt vẫn 1 hình dạng, trong khi bug nằm ở hình dạng khác (0 · số âm · chuỗi dài có dấu · ngày
29/31 · count 0). Xoay trong **cùng lớp tương đương** ⇒ 20 lượt phủ 20 hình dạng mà **không thêm case nào**.

Điều kiện sống còn là **tái lập**: seed bằng `RUN_ID` (cùng `RUN_ID` ⇒ cùng data). Random thuần làm bug *"biến mất
khi chạy lại"* — phá nguyên tắc rerun 2–3 lần và biến **bug thật thành flaky**, tức là đổi một lỗ hổng lấy một lỗ
hổng khác. `plan()` in ra `_runId` và **nói thẳng** khi thiếu `RUN_ID` ("mọi lượt sẽ giống nhau, độ phủ đóng băng").
Kèm điều kiện đi cùng ghi vào luật: xoay data thì phải siết **teardown/janitor**, vì UAT dùng chung — xoay mà không
dọn là đổi bug-lọt lấy **rác dữ liệu**.

Suite hạ tầng của `main`: 128 → **138 test** (10 test mới).

> **Đính chính số liệu:** con số "153" tôi báo lúc đầu là đo khi working tree đang ở nhánh `feat/xray-to-aio-migration` của user — nó gộp cả spec của nhánh đó. Số đúng trên `main` là **138**. Xem mục sự cố dưới đây.

### Sự cố cùng lượt: commit rơi vào nhánh của user

Giữa phiên, working tree bị chuyển sang nhánh **`feat/xray-to-aio-migration`** (nhánh AIO của user, chỉ có local). Tôi **không kiểm nhánh trước khi commit** ⇒ commit cuối rơi vào nhánh đó, trong khi `git push github main:main` lại đẩy bản **cũ** của `main`: GitLab có (cherry-pick theo sha), **GitHub thiếu**, và commit của tôi nằm lẫn trong nhánh tính năng của user.

Sửa không mất gì: backup file WIP → `git reset --keep HEAD~1` trên nhánh user (**`--keep`** giữ được thay đổi chưa commit; `--hard` sẽ xoá mất WIP `bug_reporter.js`) → `git checkout main` → `git cherry-pick` → push GitHub. Nghiệm thu: nhánh user về đúng 5 commit AIO, `diff -q` xác nhận WIP nguyên vẹn, 3 cây đồng bộ.

Luật rút ra: **trước mỗi commit phải `git branch --show-current`** — working tree là của user, họ có thể đổi nhánh bất cứ lúc nào; và sau push phải **so 3 sha** thay vì tin dòng "pushed".

## 2026-08-19 (p) — ④ oracle FE: Figma → `UI-*` contract, và lý do KHÔNG tự động hoá nốt

**Added — `npm run ui:contract`** (`scripts/qa/figma_to_ui_contract.js`) + `knowledge/system` nhận `type:
"ui_contract"` (prefix `UI-`, đã có sẵn trong `ORACLE_RE` của `finding.js`). Đây là fix **gốc** của bất đối xứng
oracle: BE có Swagger nên assert `total = 540000`; FE chỉ có Figma nên assert thoái hoá thành `toBeVisible()`.

**Đo thật trên canvas Figma của task (115 MB, 27.968 node, 2.221 TEXT) — và kết luận là KHÔNG tự động hoá nốt:**
- Lượt trích đầu: 12 khối, hầu hết **rác** — tiêu đề kiểu `"Or"`, `"File supported: .jpg"`, nhãn lẫn số callout `1/2/3`.
- Sau khi lọc (bỏ callout · bỏ chú thích >48 ký tự/tên file · tiêu đề phải ngắn, không kết thúc `.`/`:`): còn 7 khối
  — **vẫn lẫn** tiêu đề `"Drag & Drop your file here"` và một khối **trộn nhãn của 2 màn**. Nguyên nhân bản chất:
  canvas là **bảng mockup nhiều màn cạnh nhau**, nhóm theo trục Y sẽ tràn.
- ⇒ Thiết kế lại thành **máy đề xuất, người chốt**: mặc định xuất **bản nháp** (`reports/ui-contract-draft.md`,
  `proven=0`, nói rõ *chưa phải oracle*); `--write` **từ chối** nếu không có `--sections` do người curate.
  Ghi thẳng bản thô = tạo **oracle GIẢ** — tệ hơn không có oracle, vì mọi so sánh sau đó sai *một cách tự tin*.
- Nghiệm thu 2 chiều: `--write` không có `--sections` ⇒ **từ chối**; có bản curate ⇒ ghi được và **qua `system:check`**
  (schema bắt luôn thiếu `version`). Contract thật đầu tiên: `UI-ORDERDETAIL-001` (2 khối · 12 nhãn), nằm trong
  `knowledge/` nên **không commit** (dữ liệu công ty, đúng luật).

**Added — máy gác VỆ SINH MÃ NGUỒN** (`cli-guard.spec.ts`): quét `scripts/` + `tests/` tìm ký tự điều khiển lạc
(0x08/0x0B/0x0C/0x1B). Lý do rất cụ thể: escape đi qua shell/heredoc bị biến thành **ký tự thật** nằm trong regex —
trong phiên này tôi mắc **3 lần với `\b`** (`output_rules`, `spec_extract`, `figma_to_ui_contract`) và 2 lần với
`
`; script vẫn chạy êm nhưng luật **không bao giờ khớp**. Lần này chính test `cli-guard` bắt được thiếu
`require.main` guard (lỗi thứ 6 cùng loại) — máy gác viết ra hôm nay đã trả nợ ngay trong ngày.

Suite hạ tầng: 137 → **143 test**.

## 2026-08-19 (o) — ③ nightly + ④ FE: assert hình học và text dài tiếng Việt

**③ Nightly.** Job CI `detection-proof` (`.gitlab-ci.yml`, schedule/manual, `allow_failure: true`) chạy
`npm run proof:nightly`. Lý do là job **riêng, định kỳ**: mutation tiêm lỗi rồi mở lại từng màn nên đắt, và mục
tiêu của nó không phải bắt bug của lần push này mà **đo xem bộ kiểm còn bắt được bug hay không**. Thiếu
`DETECTION_CATALOG` thì in **"CHƯA ĐO ĐƯỢC"** chứ không im lặng xanh. Mốc để so: kiểm-kê-field **0/4** · trục ② **3/4**.
`gate:policy` bắt đúng lúc thêm (`proof:nightly` mồ côi) ⇒ đã trỏ từ README + CI, và CI gọi **npm script** chứ không
gọi thẳng file (một nguồn).

**④ FE — `scripts/utils/ui/geometry.js`.** Gốc rễ là **bất đối xứng oracle**: BE có Swagger (máy đọc được) nên
assert `total = 540000`; FE chỉ có Figma nên assertion thoái hoá thành `toBeVisible()`. Ba test trong bộ mới dựng
đúng cảnh **`toBeVisible()` xanh mà người dùng không dùng được**: element **bị đè** · **chữ trắng trên nền trắng** ·
nội dung **bị truncate**. Thêm: ngoài viewport · kích thước 0 · touch target < 44px (chỉ kiểm khi được yêu cầu, để
không báo oan desktop) · và một test **chống báo oan** (element lành ⇒ không nói gì).

Các phép này là **bất biến tự thân** — không cần Figma vẫn khẳng định được là sai — nên KHÔNG rơi vào tautology
"đúng vì app đang hiện thế". Đó cũng là lý do làm nhóm này trước khi làm Figma→`UI-*` contract.

**Text dài tiếng Việt (`LONG_VI`)**: tiếng Việt dài hơn tiếng Anh ~20–30% **và có dấu** (dòng cao hơn) nên layout
thiết kế cho text ngắn sẽ vỡ — tên người, địa chỉ, tên khoá học, ghi chú. Mẫu theo đúng quy ước đặt tên dữ liệu test
(bắt đầu `IT test`). `inspectLongText` bắt tràn khung cha; test kèm ca **khung đủ rộng ⇒ không coi là lỗi**.

Suite hạ tầng: 126 → **135 test**.

## 2026-08-19 (n) — ② đủ assertion: đo được 68% case kiểm thiếu điều kiện

Việc ② trong thứ tự đã chốt. Trước khi viết luật thì **đo** — vì đây là loại gate rất dễ báo oan.

**Số đo trên bộ 530 case + bản ghi execution thật:**

| Chỉ số | Giá trị |
|---|---|
| Trung bình dòng expected / case | **2.30** |
| Case có **≥3 assertion** | **164 (31%)** |
| Case **nhồi nhiều điều kiện trong MỘT dòng** | **50 (9%)** |
| Case ghi **ít verification hơn số assertion** | **363 (68%)** |
| Trong đó lệch **≥2** | **135** |

⇒ Cơ chế "expected có 3 điều kiện, execute kiểm 1, PASS ngầm sai" là **có thật và phổ biến**, không phải giả thuyết.

**Added — `self_review` cảnh báo độ đủ assertion** + luật vào `RULE_GLOBAL` mục 13 và digest `core_rules`. **Cố ý
chưa chặn**: `steps[]` chỉ là *proxy* của số verification (nó là bằng chứng theo bước, không theo assertion), nên
chặn ngay sẽ làm đỏ 2/3 bản ghi mà chưa chắc thiếu kiểm thật. Muốn chặn thì phải có trường verification **theo
assertion** — việc của vòng sau.

**Lỗi vận hành, lần thứ tư cùng loại:** escape `
?
` đi qua heredoc bị biến thành **ký tự CR/LF thật** nằm trong
regex ⇒ script chết ngay khi load. Sửa bằng cách dựng backslash qua `chr(92)`. Luật tôi tự đặt vẫn đúng và tôi vẫn
vi phạm: **nội dung có escape thì ghi bằng Write/Edit, đừng đi qua shell.**

## 2026-08-19 (m) — bịt vùng mù "giá trị biến mất": trục ② từ 2/4 lên 3/4

Tiếp đúng thứ tự đã chốt, việc ① là bịt vùng mù mà mutation vừa chứng minh.

**Added — `mustHaveValue` (oracle từ cột `Required` của FSD).** `spec_extract` sinh danh sách field mà tài liệu ghi
`M` (bắt buộc) hoặc `◎` (hệ thống hiển thị tự động) **và không kèm điều kiện** ⇒ trống là đáng nghi. Đây là oracle
THẬT của tài liệu, không phải suy từ app. Trên 4 màn đã bind: **57 field**. Ghi chú: chỉ **1/69** field là `M`, phần
lớn là `◎` — nên nếu chỉ lấy `M` thì luật gần như vô dụng; đó là lý do lấy cả `◎`-không-điều-kiện.

**Đo rồi mới quyết mức độ:** check `empty-value` bắn **3 finding** (D.O.B · Số CCCD/Hộ chiếu × 2 màn · Deal ID Đã
Thanh Toán Phí) và **cả 3 đều là fixture rỗng thật** (`data.dob` của API cũng không có). Nên để mức **ghi chú**
(`info.empty-value`), không phải deviation — tự nó không kết luận được; việc chứng minh thuộc phép so UI↔API. Tổng
deviation giữ nguyên **17**, không bị lạm phát bởi mục không hành động được.

**Fixed — phép đo năng lực trục ② (lần thứ ba mới đúng).** Ba lần đo cùng một thứ, mỗi lần sửa cách đo:
`4/4` (harness **tự chấm mình** bằng phép so chữ số) → `2/4` (dùng hàm thật, nhưng tra theo *giá trị bị bóp*) →
**`3/4`** (tra theo **TÊN FIELD** rồi so giá trị UI với nguồn sạch). Chốt được nhờ một lượt **chẩn đoán** thay vì
đoán tiếp: khi xoá `convertible_amount`, FE render **`0đ`** — không trống, không mất nhãn — nên mọi phép tra theo
"giá trị bị bóp" đều trượt.

| Mutant | Trục ② | Chi tiết máy in ra |
|---|---|---|
| `zero_out` | ✅ | UI `0đ` (core 0) ↔ nguồn sạch `6000000` |
| `drop_field` | ✅ **mới bắt được** | UI `0đ` ↔ nguồn sạch `6000000` — vùng mù đã bịt |
| `halve_number` | ✅ | UI `3.000.000đ` ↔ nguồn sạch `6000000` |
| `stringify_num` | ❌ | UI `6.000.000đ` ↔ nguồn sạch `6000000` — **không bắt là ĐÚNG**: FE absorb đổi kiểu, không có gì lệch để thấy |

Bài học phương pháp (lần thứ hai trong ngày): **con số dịch chuyển vì cách đo được sửa, không vì hệ thống đổi** —
nên báo cáo phải in ra *đã so cái gì với cái gì*, để người đọc tự kiểm được kết luận.

## 2026-08-19 (l) — hai cơ chế lọt chưa ai gác: NHÂN NHƯỢNG và FLAKY chôn bug thật

**Added — `PASS_WITH_DEVIATION`** (`scripts/lib/expansion/deviation.js` + verdict taxonomy). Rủi ro đặc thù của
agent: gặp trở ngại thì *làm cho nó chạy* — chờ thêm · retry · đổi locator · refresh · đi đường khác. Nút bị overlay
che (**bug thật**) biến thành "chờ thêm 3s rồi bấm được" (**case xanh**). Kit đã gác chặt phần locator
(`locator_healing_policy`) nhưng nhân nhượng **dạng rộng** thì chưa có gì gác. Nay: `newLedger(tcId).note(kind, why)`
ghi sổ; pass **sau khi** lệch ⇒ `PASS_WITH_DEVIATION` + **bắt buộc liệt kê deviation trong Actual**.

**Added — `SUSPECT_REAL_BUG`**: cơ chế flaky triage có thể đang **chôn bug thật** (race · cache · timezone lúc
chuyển ngày đều trông y như flaky; retry 3 lần có 1 lần xanh là bị dán nhãn flaky rồi bỏ qua). Luật:
**chưa nêu được CƠ CHẾ thì chưa được gọi là flaky** — giữ `SUSPECT_REAL_BUG` (vẫn loggable). Metric cần theo dõi:
**% flaky đã xác định được nguyên nhân**.

**Đo trên bản ghi execution thật (563 case) — và hai lần tự bắt lỗi của chính check này:**
1. Bản ghi ghi `PASSED` còn check so với `PASS` ⇒ **bỏ qua sạch 563 case** rồi trả về 0. Đúng loại "scanner quét
   rỗng vẫn báo ✓". Sửa: chuẩn hoá qua **synonyms của taxonomy**.
2. Sau khi sửa, ra 2 cảnh báo — soi thì **2/2 đều OAN**: "Retry" là chủ đề của `TC_034` (test retry sau sync fail),
   "tải lại trang" là bước của `TC_462` (tua đồng hồ rồi reload để xem bộ đếm). Sửa: **đối chiếu với kịch bản của
   chính case** trước khi nghi ⇒ còn **1** (`TC_462`, ranh giới: reload là kỹ thuật nhưng không có trong bước viết,
   nên vẫn đáng ghi là deviation).

Vì thế phần audit văn xuôi để **cảnh báo**, không chặn; cơ chế thật là **sổ ledger** trong script execute. Đây là
lần thứ ba trong phiên việc "suy từ văn xuôi" báo oan (trước đó: `forbiddenSections`, `self_review` #10) — mô hình
đã rõ: máy kiểm máy phải dựa vào **hợp đồng dữ liệu**, không dựa vào từ khoá trong câu người viết.

Suite hạ tầng: 119 → **126 test**.

## 2026-08-19 (k) — chạy mutation qua HÀM THẬT của trục ②: 2/4, không phải 4/4 (đính chính)

**Đính chính số tôi vừa báo:** lượt trước harness tự viết phép so chữ số của riêng nó rồi kết luận "trục ② sẽ bắt
**4/4**" — tức là **harness tự chấm mình**, đúng loại tautology mà cả vòng này sinh ra để chống. Nay `mutation_check`
gọi **hàm thật** của `cross_surface_diff` (`pairsOf` + `core`), và con số đúng là **2/4**.

| Mutant | Trục ② (hàm thật) | Vì sao |
|---|---|---|
| `zero_out` | ✅ bắt | UI `0đ` ↔ nguồn sạch `6000000` |
| `halve_number` | ✅ bắt | UI `3.000.000đ` ↔ nguồn sạch `6000000` |
| `drop_field` | ❌ **không bắt** | field mất ⇒ **không nhãn UI nào mang giá trị** để đặt cạnh nhau |
| `stringify_num` | ❌ không bắt | FE tự parse `"6000000.0"` rồi render y như cũ ⇒ ở field này mutation **vô hại thật**, không phải vùng mù |

**Vùng mù mới, có bằng chứng: "giá trị biến mất / hiện rỗng".** `drop_field` lọt qua **cả ① lẫn ②**: ① kiểm *tập
nhãn* nên nhãn vẫn còn ⇒ xanh; ② cần *một giá trị để so* nên không có gì để so ⇒ xanh. Trớ trêu là chính luật tôi
nới ngày 17/08 (nhận khẳng định **RỖNG** là oracle hiển thị hợp lệ) làm lớp này vô hình. Bịt được bằng ③persist
(payload có field, response không) hoặc bằng oracle "field này BẮT BUỘC có giá trị" — chưa làm, ghi vào phần còn lại.

Bài học phương pháp: **thước đo cũng phải được kiểm bằng máy thật, không bằng phép suy của chính nó.**

## 2026-08-19 (j) — (3) mutation check: bộ kiểm KHÔNG bắt được bug giá trị, đo được 0/4

Đây là thứ đáng giá nhất trong ba việc, và nó ra **tin xấu** — đúng bản chất của một negative control.

**Added — `scripts/qa/mutation_check.js`** (`npm run mutation:check`): tiêm lỗi ở tầng `page.route()` (**không chạm
dữ liệu UAT, không ghi gì lên server**) rồi xem máy kiểm có đỏ. 5 mutant nhắm đúng các lớp bug **đã từng lọt thật**:
`zero_out` (SAPP-28310/28376) · `drop_field` (SAPP-28404/28442) · `halve_number` · `stringify_num` (`540000` →
`"540000.0"`) · `rename_label` (lớp "Phone" vs "Phone number").

**Kết quả đo trên UAT — `mutation score = 0/4 = 0%`.** Bóp `convertible_amount` thành 0, **xoá hẳn**, chia nửa, đổi
kiểu: `ui_conformance_check` **không thấy gì**. Nguyên nhân không phải máy hỏng mà là **phạm vi**: nó kiểm *kiểm kê
field/nhãn*, KHÔNG kiểm *giá trị*. Đây đúng là giới hạn "gate kiểm HÌNH DẠNG chứ không kiểm SỰ THẬT" mà trước đó
tôi chỉ **nghi** — giờ có số.

Cùng lượt đo, harness kiểm luôn năng lực **trục ②**: UI hiển thị giá trị bị bóp trong khi API đọc lại (sạch) trả
giá trị gốc ⇒ **4/4 mutant sẽ bị bắt**. Kết luận có bằng chứng: **kiểm-kê-field và kiểm-giá-trị là hai việc khác
nhau**; xanh cái này không nói được gì về cái kia.

**Ba bẫy của chính harness, đã sửa và ghi vào luật:**
1. **Không tiêm được mà tưởng là phát hiện.** Lượt đầu 4/5 mutant "không tiêm được" vì API trả tiền dưới dạng
   **chuỗi** (`"900000"`) mà hàm mutate đòi `typeof === 'number'`. "0%" lúc đó là **harness hỏng**, không phải vùng
   mù. Nay nhận cả hai kiểu và giữ nguyên kiểu gốc.
2. **Tautology ở tầng harness.** Nếu route bóp cả request của app LẪN request xác minh thì hai bên cùng bị bóp ⇒
   không bao giờ lệch ⇒ trục ② "không bắt được" một cách GIẢ. Nay bỏ route **sau khi app load** rồi mới đọc nguồn sạch.
3. Chỉ chặn endpoint **nghiệp vụ** (lượt đầu bóp cả `analytics.tiktok.com` và `/api/v1/me` — vô nghĩa), và phân biệt
   **"sống sót"** với **"không liên quan"** (giá trị không hiển thị trên màn đang kiểm) — score chỉ tính trên mutant
   có liên quan, nếu không thì con số vô nghĩa.

**Added — `tests/fe/infra/cli-guard.spec.ts`**: quét toàn bộ `scripts/qa/*.js`; script nào có CLI + `module.exports`
mà thiếu `require.main === module` guard thì **đỏ**. Lý do rất cụ thể: trong cùng phiên tôi mắc lỗi này ở **ba** file
(`cross_surface_diff`, `fixture_matrix`, `mutation_check`) — lỗi lặp lại thì phải có máy gác, không dựa vào nhớ.

Suite hạ tầng: 110 → **119 test**.

## 2026-08-19 (i) — (2) ASSERT tín hiệu môi trường: collector đầu tiên của kit

**Đính chính trước:** trước hôm nay kit **không có collector nào** — `grep pageerror scripts/ tests/support/` = 0.
`qa_instincts.md` chỉ *dặn* agent tự soi console/Network khi điều tra, mà dặn không phải forcing function. Nên ý
này không "chỉ cần assert", mà phải viết collector.

**Added — `scripts/utils/runtime/env_signals.js`**: `attachEnvSignals(page)` nghe 4 loại tín hiệu — `pageerror`
(JS exception, **zero-tolerance**) · console.error · request **4xx/5xx chạy nền** · **lệch contract** (chỉ kiểm
endpoint mà task KHAI contract, không tự đoán schema). Kèm `expect4xx(rx, why)` để case negative khai trước 4xx cố
ý, và `toFindings()` đổi tín hiệu thành `EXPANSION_FINDING` (JS chết / API 500 trong khi UI báo bình thường **là**
app tự mâu thuẫn ⇒ không cần oracle ngoài).

Đã cắm vào `ui_conformance_check` + `cross_surface_diff` — **không thêm lượt tải trang nào** vì hai máy này vốn đã
mở đúng các màn đó.

**Đo thật trên UAT (4 màn Order Detail):** 0 JS exception · 0 request 4xx/5xx · 4 `console.error` và cả 4 là
`ERR_CERT_AUTHORITY_INVALID` — **artifact môi trường/cert, không phải lỗi sản phẩm**. Nên chúng vào diện *ghi chú*,
không phải deviation. Đây là kết quả đáng tin theo hướng ngược: máy chạy mà **không** bịa ra finding.

**Fixed ngay trong lượt cắm:** tôi push `info.console-error` vào mảng `dev` trong khi chỗ tách `info.` nằm phía
trên ⇒ ghi chú bị đếm thành deviation (17 → **21**). Đã đưa về `infos`, số trở lại **17**. Bài học lặp lại: thêm
tín hiệu mới phải kiểm **con số tổng trước/sau**, không chỉ xem log có dòng mới.

**Added — 5 test** dựng đủ 4 loại tín hiệu (`page.setContent` + `page.route`), trong đó 2 test khoá phần **chống
báo oan**: tracking bên thứ ba (gtag 404) và 4xx đã khai trước đều KHÔNG tính là tín hiệu lạ — nhưng 4xx cố ý vẫn
phải được ghi lại, không im lặng. Suite hạ tầng: 105 → **110**.

## 2026-08-19 (h) — ĐIỀU KIỆN SỐNG CÒN của phần mở rộng: oracle, verdict riêng, risk band

Phản hồi review chỉ đúng một lỗi **đang có thật** trong thứ vừa build: mở rộng quanh case mà không có nguồn thì
kit mặc định *"app đang hiện thế là đúng"* ⇒ tautology **nhân theo số trục**, sản xuất PASS giả. Bằng chứng nằm
trong test của chính tôi: `persistence_probe` trả `ok: true` cho ca SAPP-28403 (USD không quy đổi) — `form/payload/
api/ui` khớp cả 4 ở giá trị `10` trong khi đúng phải `260.500`. **Tên field `ok` chính là mầm PASS giả.**

**Added — `scripts/lib/expansion/finding.js`** (hạt nhân): ba loại kết luận, không có loại thứ tư —
`EXPANSION_FINDING` (app **tự mâu thuẫn**: lệch giữa 2 bề mặt · mắt đứt chuỗi · field thừa/thiếu — không cần oracle
ngoài vì hai nơi cùng nguồn mà khác nhau thì chắc chắn một nơi sai) · `PASS`/`FAIL` (**chỉ khi** có `oracle_ref`
hợp lệ `BR-|SM-|PM-|SS-|DM-|UI-`) · `OBSERVATION` (không neo ⇒ **nhất quán ≠ đúng**, bắt buộc kèm `open_question`).
Máy **tự hạ cấp** PASS→OBSERVATION khi thiếu neo, và `oracle_ref` sai dạng bị bỏ (không nhận id tự bịa).

**Added — verdict taxonomy** (`.agent/config/verdict_taxonomy.json`): `EXPANSION_FINDING` + `OBSERVATION`. Cả hai
**cố ý `xray: null`** — trộn finding mở rộng vào execution status sẽ làm pass-rate mất nghĩa và triage lẫn lộn;
báo riêng ở `reports/expansion-findings.md`.

**Added — risk band, làm CÙNG LÚC chứ không để sau** (`scripts/lib/expansion/depth.js` + `npm run expansion:plan`):
chi phí là thật — 1 task đang **1021 file / 136 MB** evidence, và mở đủ trục cho bộ **530 case** ước lượng
**~3740 lượt tải trang · ~9,4 giờ · ~335 MB**. Band lấy **cái nặng hơn** giữa `Mức độ rủi ro` và `Ưu tiên`
(Minor + Ưu tiên High vẫn là đường chính ⇒ high): high → đủ trục runtime · medium → ③+⑤ · low → ③. Đo trên bộ 530:
**high 172 · medium 301 · low 57**.

**Changed — phân vai Phase 1 / Phase 2** (chỉnh kiến trúc theo review, tránh làm trùng `§10 Cross-layer Guard`):
①field ②surface ③persist ⑥lặp-đồng-thời ⑦chiều-ngược **cần runtime** ⇒ Phase 2 · ④nhánh ⑤trạng-thái **đoán trước
được** từ permission matrix / state machine ⇒ **case sinh ở Phase 1** (để được đếm coverage + publish TCM). Nửa
KHÔNG đẩy về Phase 1 được: *ô nào có dữ liệu để chạy* — đó là sự thật của **môi trường**, và chính là lý do case
④⑤ chìm vào SKIP ⇒ Phase 2 giữ `fixture:matrix --discover`.

**Enforcement:** `self_review` đọc thẳng `test-results/expansion_findings.json` và **CHẶN** khi có PASS/FAIL không
neo (bắt được cả file do script tự chế sinh hoặc sửa tay) · cảnh báo số `OBSERVATION` còn treo. Nghiệm thu 2 chiều:
file thật (2 OBSERVATION, 0 vi phạm) ⇒ chỉ cảnh báo; sửa tay 1 finding lên `PASS` ⇒ **CHẶN** đúng.

**Fixed:** `persistence_probe.ok` → `consistent` (+ console đổi thành *"NHẤT QUÁN — chưa phải PASS"*). Lúc đổi tên,
patch của tôi áp nửa vời làm marker `proven` đọc field không tồn tại ⇒ báo cáo ra `proven=0`; bắt được nhờ soi lại
marker sau khi chạy, không phải nhờ đọc code.

Suite hạ tầng: 86 → **105 test** (16 test mới cho luật oracle + risk band, và 3 test cũ đổi theo tên mới).

## 2026-08-19 (g) — trục ③ có chuỗi THẬT + đổi cách gate đọc báo cáo (dòng máy thay vì sniff văn xuôi)

**Đo chuỗi 4 điểm thật trên UAT** (user xác nhận mutation): đơn Bảo lưu *IT test uiBL*, sửa `Service Fee` qua form
Edit rồi đối chiếu `form → payload → API → UI`.

- Kết quả: **4/4 điểm khớp** (`1.431.539` ở cả 4 điểm) ⇒ chuỗi lành, probe KHÔNG bịa mắt đứt.
- **Net-zero đã xác minh**: `900000` → đo → **hoàn nguyên về đúng `900000`** (script tự kiểm và in ra).
- Lượt đầu **không bắt được request nào** — hoá ra form Edit là **wizard** (`Cancel/Next/Đồng bộ thông tin`, không
  có "Save"), nên cú bấm rơi vào hư không. May là nhờ vậy **không sửa gì**. Đã sửa thành `Next…→Finish→Confirm`.

**Fixed — cách gate đọc báo cáo.** Chốt chống "có file là xong" ở check #10 ban đầu **sniff văn xuôi** nên match
chữ *"đo thiếu điểm"* trong dòng tổng kết (giá trị **0**) và báo oan đúng báo cáo SẠCH. Đổi thành **hợp đồng
máy–gate**: mỗi máy tự phát một dòng máy-đọc-được ở đầu báo cáo

```
<!-- gate: proven=N inconclusive=M broken=K -->
```

(`persistence_probe` · `cross_surface_diff` · `fixture_matrix` · `spec_gap_report`), và check #10 chỉ cảnh báo khi
**proven=0**. Nghiệm thu 2 chiều: báo cáo thật (`proven=1/14/21`) ⇒ **✓ OK 5/5 trục**; báo cáo dựng với `proven=0`
⇒ chốt nổ đúng.

**Fixed — mask PII khi chụp evidence:** regex chỉ bắt `@` và số ≥9 chữ số nên **để hở `D.O.B`**. Đã bổ sung dạng
`dd/mm/yyyy`. (Ảnh của lượt này là contact tổng hợp *IT test*, không phải khách thật.)

## 2026-08-19 (f) — luật mở rộng phạm vi: bịt đường vào còn thiếu + gắn MÁY

Rà lại câu "luật đã được ghi chưa" thì thấy **ghi rồi nhưng chưa tới được mọi đường vào**: có ở `RULE_GLOBAL`
§5 trục, digest `core_rules.md`, và `phase2/04_execute_fe_playwright.md` — **thiếu** ở `CLAUDE.md` (file auto-load
mọi session), `phase2/05_execute_api_playwright.md`, và mô tả routing trong `run_phase2_template.md`. Nghĩa là
execute **nhánh API** hoặc người đọc bản đồ prompt sẽ không thấy luật.

**Added:**
- `CLAUDE.md` mục 3 (non-negotiable, luôn trong ngữ cảnh): "execute KHÔNG chỉ bám chữ trong case — mở rộng 5 trục
  + chiều ngược `spec:gap`; bug người ngoài tìm ra = **lỗi của máy**".
- `phase2/05_execute_api_playwright.md`: lát cắt 5 trục áp cho tầng API — trục ③ (ghi payload + response, không
  dừng ở `200 OK`), trục ② (API ↔ UI ↔ list), trục ④⑤ (`--discover` trước khi bỏ case vì "không có data"), và
  guard theo trạng thái (gọi thẳng API cho hành động UI đã chặn — việc chỉ API test làm được).
- `run_phase2_template.md`: mô tả routing của cả 2 prompt execute nêu rõ "5 trục mở rộng" (bản đồ prompt phải
  phản ánh nội dung mới, không thì agent skim bản đồ sẽ bỏ qua).
- **`self_review` check #10 — "5 trục mở rộng (máy nào đã chạy)"**: luật không có máy thì trôi. Check này KHÔNG
  chấm "đã mở rộng đủ chưa" (không đo được) mà chấm thứ đo được: **artefact của từng máy có tồn tại không**. Đo
  trên SAPP-24395: **4/5 trục có artefact**, trục ③ chưa (đúng — mới backtest offline, chưa ghi chuỗi thật).
  Có `requirements/cross_surface.json`/`fixture_matrix.json` mà chưa có báo cáo ⇒ **CHẶN** (khai phạm vi rồi bỏ dở).
- **Chốt chống "có file là xong"**: báo cáo tồn tại nhưng nội dung toàn "chưa kiểm được" thì vẫn cảnh báo. Lý do
  rất cụ thể: chính tôi vừa cân nhắc tạo một artefact khuyết để check #10 xanh, nên bịt luôn đường đó. Nghiệm thu
  bằng kiểm soát ngược: dựng báo cáo yếu ⇒ chốt nổ đúng.

## 2026-08-19 (e) — B3→B7: đủ 5 trục có máy + luật đóng vòng

Hoàn tất chương trình chống lọt bug (B0–B7). Mỗi trục có **máy đứng sau**, và mọi máy đều tách được "khớp" với
"chưa kiểm được" — vì im lặng ở chỗ chưa kiểm là cách lọt bug rẻ nhất.

**B3 `spec:gap`** — chiều ngược build→tài liệu. Conformance chỉ hỏi "tài liệu khai gì, build có đủ không"; chiều
này hỏi ngược. Đo 4 màn: 14 section khớp · **2 vùng mù** (`Order Info`, `Payment Info` của Chuyển đổi) · 9 section
có field mọc thêm. Backtest tự nhiên: máy nêu ra `Pay-back` — field trước đây người phải tự mò (TC_337). Xác minh
FSD gốc: §4.3.1.6 thật sự chỉ khai **1 field** cho `Order Amount` trong khi build có **9** ⇒ tài liệu thiếu.

**B4 `probe:persist`** — chuỗi `form→payload→API→UI` (13/69 bug). Engine sinh **giá trị mồi phân biệt**, so 4 điểm,
chỉ ra **mắt đứt + tầng lỗi**. Backtest 4 bug thật: SAPP-28310 (`payload→api`, thành 0) · SAPP-28376
(`form→payload`) · SAPP-28442 (mất hẳn khỏi payload) · SAPP-28403 (lệch bậc độ lớn) — đúng cả 4, và **không bịa**
mắt đứt trên chuỗi lành. Test bắt được bẫy trong API của tôi: chuỗi đo THIẾU điểm ban đầu trả `ok:true`.

**B5 `xsurf:diff`** — cùng giá trị, khác nơi hiển thị (**21/69 bug**, trục rò nhiều nhất). Lượt chạy thật đầu tiên
lộ 2 lỗi của chính tool: so format UI vs API là vô nghĩa (`600.000đ` vs `600000`), và hai ô trống vẫn ra "✓ khớp".
Sửa: chỉ so định dạng giữa các bề mặt UI; dưới 2 bề mặt đọc được ⇒ **CHƯA KIỂM ĐƯỢC**.

**B6 `fixture:matrix`** — nhánh × trạng thái (**42/69 bug**). Lý do 2 trục này rò rất tầm thường: không có dữ liệu
để thử nên case chìm vào SKIP. `--discover` đếm fixture đang có THẬT qua list API — và việc dò đã **sửa luôn thiết
kế ma trận của tôi**: môi trường có 5 trạng thái (`PURCHASING`, `PARTIALLY_PAID`, `CANCEL`) chứ không phải 3.
Kết quả: 6 nhánh × 5 trạng thái = 30 ô → **21 CÓ · 9 n/a kèm lý do đo được · 0 trống**.

**B7 luật + máy đóng vòng.** Viết 5 trục vào `prompt_templates/phase2/04_execute_fe_playwright.md`, canonical vào
`RULE_GLOBAL.md §5 trục mở rộng` (+ TOC, digest ở `core_rules.md`). Luật cốt lõi: **bug do người ngoài tìm ra là
LỖI CỦA MÁY** — phải trả lời "máy nào lẽ ra bắt được?"; không có máy thì đề xuất máy mới, CẤM kết thúc bằng "sẽ
chú ý hơn". Máy đứng sau: `leak:report --require-machine`. Đo thật: **29 bug do người tìm · 26 đã quy được về máy
· 3 chưa** — và 1 trong 3 (`SAPP-28651` thiếu section VNPay) hoá ra có máy nhưng **chưa bind màn**, đúng nhánh (a)
của luật.

**Kỷ luật lặp lại 2 lần trong phiên:** thiếu `require.main === module` guard làm `require()` trong test khiến CLI
tự `exit(2)`. Đã vá cả hai file.

Suite hạ tầng: 69 → **85 test** (thêm 16: backtest persistence 7 · cross-surface 4 · fixture matrix 5).

## 2026-08-19 (d) — trả nợ B2: biên section theo CẤP tiêu đề + bản đồ tên đo bằng máy

Hai món nợ của B2, cả hai đều vá theo **số đo trên UAT**, không theo suy đoán.

**Nợ 1 — khối con lồng trong khối.** `closest('.collapsible-section__container')` leo lên khối CHA nên khối con
`Deal Information` kiểm kê ăn luôn field của cả tab (12 nhãn, **6 field "thừa" oan**). Luật đúng là luật duy nhất
phân biệt được cha/con: **một section kết thúc ở nơi tiêu đề CÙNG CẤP HOẶC CAO HƠN tiếp theo bắt đầu**, với "cấp"
= (độ đậm, cỡ chữ) — đo thật: cha `w700/16px`, con `w600/16px`. Áp luật này vào **cả ba** đường định vị (selector
của app · heuristic hàng · fallback). Vá xong lại lộ lớp cuối: layout **phẳng** (tiêu đề con và các hàng là anh
em) thì **không tổ tiên nào** là container ⇒ thêm đường thứ tư: quét **DẢI ANH EM** từ tiêu đề tới tiêu đề cùng
cấp kế tiếp. Kết quả: 12 nhãn → **9 nhãn đúng dải**, extra 6 → 3.

> Ba lần sai liên tiếp ở đúng một chỗ (no-container oan → ôm cả tab → hút field khối bên cạnh) là lý do thêm
> `tests/fe/infra/section-scope.spec.ts`: DOM giả lập bằng `page.setContent`, tái hiện từng layout đã gây lỗi.
> Mắt đọc code không bắt được ba lỗi đó; test bắt trong 1 giây.

**Nợ 2 — tên khối tài liệu ≠ tên build.** Thay vì đoán, thêm hai thứ:
- `ui_conformance_check` giờ ghi **`surface.json`**: bề mặt THẬT của màn — danh sách section (kèm cấp tiêu đề) và
  tập nhãn của từng section. Khối cha không có nhãn nào vẫn được giữ (nó có thật, và cần để biết cấp bậc).
- `spec:extract --suggest-aliases <surface.json>`: ghép tài liệu↔build theo **độ trùng tập nhãn (Jaccard ≥ 0.5)**.
  Nghiệm thu: máy tự tìm lại **đúng 3 alias** tôi đã suy tay trước đó (trùng 0.6 / 0.8 / 0.67) và **không** đề
  xuất bừa cho 2 tên còn lại — vì trên build **không có khối nào khớp**. Cố ý **chỉ đề xuất**, người chốt rồi dán
  vào bindings (giống `bug:tc-match` không có `--apply`).
- Kèm sản phẩm phụ đúng hướng **B3**: 4 khối **có trên build mà tài liệu không nhắc** (`Order Info`, `Payment
  Info`, `Transfer Information`, `Data Synchronized to Hubspot` của luồng Chuyển đổi) — hạt giống cho chiều ngược.

**Trạng thái lượt chạy chốt (4 màn Order Detail):** 17 deviation — `fields.missing` 6 · `fields.extra` 6 ·
`fields.label-text` 4 · `no-container` 1. Không còn deviation nào sinh do máy ôm sai vùng. Nội dung đáng chú ý:
tài liệu ghi **`Phone`** còn build ghi **`Phone number`** (4 màn — MỘT câu hỏi BA, không phải 8 bug) · thừa
**`Địa chỉ`** ở Customer Info đơn Chuyển đổi (đúng lớp STT 42, **máy tự tìm**) · thừa `Service Fee Rate` · thiếu
**`Trạng thái đồng bộ`** ở khối đồng bộ về HubSpot (2 màn) · khối ĐỒNG BỘ VỀ HUBSPOT của Chuyển đổi thừa 7 field.

Suite hạ tầng: 64 → **69 test** (5 test mới cho định vị section + đề xuất alias).

## 2026-08-19 (c) — đưa B0/B1 vào commit (trước đó chỉ nằm trong working copy)

Rà lại chương trình chống lọt bug thì phát hiện **B0 và B1 chưa hề được commit**: `scripts/qa/leak_report.js`
còn **untracked**, và check #9 "độ phủ bề mặt" chỉ tồn tại trong working copy của `self_review.js`. Đây đúng
lớp tai nạn đã xảy ra một lần với `knowledge/**` (đổi nhánh là mất sạch), nên đưa vào commit ngay.

- **`scripts/qa/leak_report.js`** (mới): đếm bug theo **nguồn phát hiện** (`found-by-kit` / `found-by-human`) và
  theo **5 trục mở rộng quanh case** để biết nên xây máy nào trước. Đo SAPP-24395: 69 bug — 46 chưa phân loại
  nguồn; theo trục: field 11 · surface 21 · persist 13 · branch 20 · state 22 · không khớp 17.
- **`scripts/qa/self_review.js` check #9**: gate cũ chỉ hỏi *"có catalog mà chưa chạy?"* ⇒ **không khai catalog
  là cách né hợp lệ**. Nay so bảng *Phân nhóm testcase* với `ui_catalog.json`. Đo thật: **28 nhóm chức năng ·
  catalog 5 màn · 23 nhóm không có màn nào**. Để **P1 warning** có chủ đích (đo artifact thật trước rồi mới quyết
  chặn), vì chặn ngay sẽ làm đỏ mọi task cũ.

**Còn nằm ngoài commit có chủ đích:** cờ `--found-by kit|human` của `bug_reporter.js` — file đó là WIP của user
và có luật **không commit**. Hệ quả phải nói rõ: `leak_report.js` đọc được nhãn nguồn, nhưng **gắn** nhãn khi log
bug mới thì phụ thuộc một file chưa vào repo.

## 2026-08-19 (b) — chạy catalog tự sinh trên UAT: 3 lỗ định vị nữa, và máy tự tìm ra bug đầu tiên

Chạy `ui_conformance_check` với catalog **tự sinh từ FSD** lên UAT (read-only, 4 màn Order Detail Chuyển
nhượng/Chuyển đổi). Lượt đầu ra 16 deviation — **soi từng cái** thì phần lớn là lỗi định vị của chính máy, không
phải lỗi build. Ba lỗ, mỗi lỗ vá xong đều đo lại:

1. **`no-container` báo oan.** `Transfer Source Package Info` có mặt rõ ràng trên màn mà máy báo không thấy:
   heuristic "hàng = con có đúng 2 con lá" cho **rows = 0 ở mọi cấp** vì nhãn/giá trị lồng sâu hơn. Thêm (a)
   `sectionContainerSelector` — gợi ý DOM của app, khai ở **bindings lớp task** (`.collapsible-section__container`),
   và (b) fallback generic: leo tới tổ tiên cuối cùng **trước khi số nhãn nhảy vọt ≥2×** (đo được 13 → 13 → 52,
   mốc nhảy chính là lúc ôm luôn khối bên cạnh).
2. **Bản vá (1) làm mọi thứ TỆ HƠN** — container đúng nhưng bộ đọc nhãn chỉ soi `el.children`, nên card bọc trả
   **0 nhãn** và toàn bộ field bị báo THIẾU oan (`build có: []` khắp báo cáo). Sửa: quét **sâu** tìm hàng
   nhãn→giá trị ở mọi độ sâu. Sau vá: đọc đúng 6/6 nhãn `Customer Info`, 6/6 `Transfer Source Package Info`.
3. **Tên khối trong tài liệu ≠ tên trên build.** FSD ghi "THÔNG TIN ĐỒNG BỘ TỪ HUBSPOT" / "Thông tin trên Deal",
   OPS render "Data Synchronized from Hubspot" / "Deal Information" ⇒ khớp theo tên tài liệu thì **không bao giờ**
   định vị được. Thêm `sectionAliases` (dữ liệu quan sát của task, đo bằng probe read-only). Tên **chưa có alias**
   được tách sang `_forbidden_unaliased` và ghi rõ **"CHƯA kiểm được"** thay vì nằm im trong danh sách đã-gác.
4. **`forbiddenSections` báo oan khối dùng chung.** Khối có ở mọi loại đơn (ĐỒNG BỘ TỪ/VỀ HUBSPOT) bị tố là
   "của loại đơn khác". Lấy ngưỡng từ **phổ đo được**: dùng-chung xuất hiện ở 5–37 màn, tên đặc trưng chỉ 1–2 màn
   ⇒ **≥3 màn = dùng chung, loại khỏi forbidden**. Ngưỡng nằm giữa hai cụm, không phải số chọn bừa.

**Máy tự tìm được bug đầu tiên** (không ai chỉ trước): Order Detail đơn **Chuyển đổi** có field **"Địa chỉ"** ở
khối Customer Info — đúng lớp bug STT 42 vốn do người báo trên đơn Chuyển nhượng (SAPP-28608, đã Done). Kèm 3
phát hiện cùng lớp: nhãn build **"Phone number"** trong khi tài liệu ghi **"Phone"** (4 màn), khối Service Info
thừa **"Service Fee Rate"**, và khối ĐỒNG BỘ VỀ HUBSPOT **thiếu "Trạng thái đồng bộ"**.

**Nghiệm thu STT 42/43/53/54 — chưa đạt, và tiêu chí của tôi có chỗ sai:** STT 42 và 43 **đã được fix trên UAT**
nên không thể "bắt lại" — dùng bug đã Done làm phép thử là sai từ đầu; bằng chứng máy chạy đúng lớp đó là nó tìm
ra **ca mới** ở trên. STT 53 (`Course Conversion Info`) trên đơn đang thử **không render** (build có "Course
Package") — chưa phân biệt được lệch-tên-tài-liệu hay thiếu section thật, cần BA/dev. STT 54 **không kiểm được
bằng tên**: tên build của khối "Thông tin Deal trừ" chưa biết (phải lấy từ evidence của bug gốc).

**Còn nợ:** container cho **khối con lồng trong khối** (`Deal Information` nằm trong `Data Synchronized from
Hubspot` ⇒ `closest()` leo quá cao và sinh extra oan) · alias cho "Thông tin Deal trừ" / "Thông tin chuyển đổi".

## 2026-08-19 — B2 chống lọt bug: FSD tự sinh ui_catalog (888 field), backtest lộ 5 lỗ

**Vấn đề (B0 đã đo):** `ui_conformance_check.js` chỉ kiểm được màn nào **người** chịu khai tay vào `ui_catalog.json`. Task SAPP-24395 có **28 nhóm chức năng** nhưng catalog chỉ **5 màn** ⇒ 23 nhóm không có gì kiểm, và bề mặt cứ rộng ra khi máy kiểm đứng yên. Khai tay 49 bảng field là việc không ai làm.

**Added — `scripts/qa/spec_extract.js`** (`npm run spec:extract`): đọc chính bảng *"Mô tả chi tiết các trường"* mà FSD đã có sẵn (khuôn 8 cột) → `screens.json` → `ui_catalog.json`. Đo trên FSD thật: **42 bảng · 47 tab · 257 section · 888 field**. Từ chối sinh catalog khi thiếu `--bindings` (URL/fixture là dữ liệu TASK, script không đoán) và **luôn in số màn chưa có binding** — 54 màn đang mù, nói ra thay vì để tưởng đã phủ.

**Nghiệm thu đã tự ràng từ đầu:** catalog tự sinh phải bắt lại được **STT 42/43/53/54** mà không biết trước. Tôi viết parser xong mới mở 4 mục đó ra. Chính phép nghiệm thu này lộ **5 lỗ**, cả 5 đều vô hình nếu chỉ đọc code:

1. **`mode:'superset'` giết phép bắt field THỪA.** Phải bật superset để né báo-thiếu-oan cho field điều kiện — nhưng nó tắt luôn `fields.extra`, tức đúng lớp bug của STT 42 (Order Detail thừa "Địa chỉ"). Sửa: thêm **`optionalFields`** vào `ui_conformance_check.js` — miễn trừ **đích danh** từng field điều kiện, `superset` chỉ còn dùng cho nhãn lặp động không liệt kê được ("Phí dịch vụ lần 1..N").
2. **Loại nhầm 78 field.** Bản đầu coi `dropdown/combobox/checkbox/tag` là "control không nhãn" — đó là **nơi bug hay sống** (SAPP-28311 Service Fee không phải Combobox, SAPP-28318 dropdown thiếu option). Nay chỉ loại `button/icon/link`.
3. **Key trùng giữa các file.** FSD copy-paste nên mục "4.3.1.6" tồn tại ở **cả** file Chuyển đổi lẫn Chuyển nhượng ⇒ binding trỏ một URL nhưng lấy tập field của **loại đơn khác** (đúng lớp "26 deviation giả"). Nay key mang tiền tố file.
4. **Section lạ không ai bắt.** STT 54 là màn mọc thêm **cả một khối** của loại đơn khác ("Thông tin Deal trừ" trên tab Hub Info của Chuyển nhượng) — kiểm-kê-field không chạm tới vì field của màn vẫn đủ. Thêm `forbiddenSections` (sinh từ spec: section cùng tab nhưng thuộc **màn khác**) + check `sections.unexpected`. Bản heuristic đầu lọc theo *file* nên vừa **bỏ sót đúng STT 54** vừa **tố oan** một section của chính màn — sửa thành lọc theo **khoá màn**.
5. **Nhãn lặp trong tài liệu.** FSD ghi `Phone` hai lần trong một khối ⇒ so-tập vô nghĩa. Nay gộp và nêu ra để hỏi BA (`_doc_duplicates`).

**Kiểm chéo offline (mạnh hơn tự tin):** so catalog tự sinh với catalog **viết tay** — màn *Add-on Order Detail / Overview* khớp **chính xác 3/3 section (6/6, 7/7, 4/4)**, kể cả giữ đúng `Net Price` (field mà bug #19 tố thiếu) và loại đúng `Note` có điều kiện. Chỗ lệch ở màn Create là **auto đúng hơn bản tay**: bản tay đưa `Deal ID Đã Thanh Toán Phí` (FSD ghi rõ "chỉ hiển thị khi có giá trị") vào tập phải-có ⇒ sẽ báo thiếu oan với mọi deal thường.

**Added — `tests/fe/infra/spec-extract.spec.ts`** (8 test, suite hạ tầng 56 → 64): mỗi test khoá đúng một lỗ ở trên, kèm fixture FSD thu nhỏ giữ nguyên các đặc điểm đã gây lỗi (heading in nghiêng, số mục trùng 2 file, nhãn lặp, field điều kiện).

**Bẫy lặp lại lần thứ ba:** ký tự `\b` bị công cụ trung gian biến thành **backspace (0x08)** nằm trong regex ⇒ `Button` không bao giờ khớp mà script vẫn chạy êm. Lần này phát hiện nhờ soi số (0 control giữa 119 button). Đã quét cả repo, không còn 0x08 lạc.

**Trạng thái nghiệm thu:** 3/4 mục (42/43/54) đã chứng minh được **catalog hỏi đúng câu** ở mức offline; STT 53 cần một fixture order Chuyển đổi để bind. Cả 4 mục **chưa** chạy thật trên UAT — đó là bước kế tiếp và cần xác nhận trước khi chạm UAT.

## 2026-08-17 — chạy 3 gate mới trên NỘI DUNG THẬT: 4 luật báo oan, đã vá

**Vấn đề:** `dim:coverage`, Lớp 1 (bằng-chứng-tối-thiểu-theo-tag) và `domain:trace-back` tới giờ **chỉ được thử trên fixture do tôi tự dựng** — mà fixture thì luôn xanh, nó được viết để khớp luật. Nên tôi viết **28 testcase Order Bảo lưu** có tag chiều thật (oracle từ `BR-BAOLUU-001…007`, `BR-TXN-003…005`) rồi chạy 3 gate đó lên. Lượt đo lộ ra **4 luật báo oan** — cả 4 vô hình với fixture.

**Fixed — bằng chứng tối thiểu (`scripts/qa/lib/output_rules.js`):**
- `[display]` **không nhận khẳng định RỖNG**. "Refund Amount rỗng" bị đòi thêm bằng chứng, trong khi §12 prompt gen nêu thẳng *"giá trị để trống đúng nghĩa"* là thứ phải kiểm.
- `[guard]` áp bằng chứng **nhánh CHẶN cho cả nhánh CHO PHÉP**: case `[Positive][Guard]` không có 4xx nào để nêu mà vẫn bị đòi "403/409 hoặc dữ liệu không đổi". Nay tách: nhánh CHẶN đòi mã lỗi/dữ-liệu-không-đổi, nhánh CHO PHÉP đòi thông báo nguyên văn hoặc giá trị cụ thể.
- Kết quả trên bộ pilot: **4/20 cảnh báo → 0**, và **4/4 cảnh báo ban đầu là oan**.

**Fixed — `scripts/qa/domain_rules.js`:**
- Kiểm ghost-ref phán **ngoài thẩm quyền**: trỏ `--tc-dir` vào một bộ hẹp (`BL_TC_*`) làm **13 rule** bị tố *"covered_by trỏ TC KHÔNG TỒN TẠI"*, chỉ vì `covered_by` của chúng trỏ `OPS_PAY_TC_*` nằm ở bộ canonical khác. Nguy hiểm thật: người đọc có thể đi xoá `covered_by` đúng. Nay chỉ kiểm khi lượt quét **chứa cùng họ TC ID**, và **in ra phần không kiểm được** thay vì im lặng báo ✓.
- Luật *"`examples[].expected` phải chứa chữ số"* quá thô: "Refund Amount = rỗng", "Edit: CHẶN", "VietQR theo tài khoản SCMA" đều đối chiếu được mà không có số nào (**9 báo oan**). Đảo chiều — không đòi dấu hiệu cụ thể, mà bắt đúng thứ cần bắt: expected chỉ nói "thành công/đúng/hợp lệ" rồi hết. Tổng: **26 cảnh báo → 2**, cả 2 đều đúng.

**Bẫy kỹ thuật đáng ghi:** `\b` trong regex JS **không dùng được với chữ có dấu** — "đ"/"ẩ" không phải word-char nên `\b` đứng trước "để trống" là biên **không bao giờ khớp**; luật im lặng mà trông như vẫn chạy. Bản vá đầu của tôi mắc đúng lỗi này và **test mới bắt được ngay** — đó là lý do phải khoá luật bằng test chứ không tin mắt.

**Added — test khoá 2 luật mới** (`tests/fe/infra/gates.spec.ts`, 54 → 56 test): `[display]` nhận rỗng nhưng vẫn bắt "hiển thị đúng thông tin"; `[guard]` phân biệt nhánh allow/deny. Kiểm soát ngược: 3 case expected mơ hồ vẫn bị bắt đủ 3 → nới luật **không** làm cùn luật. Bộ 530 thật: **0 CHẶN**, không sinh chặn mới.

**`dim:coverage` bắt gap trong nội dung do CHÍNH TÔI viết:** 20 case đầu phủ 7/15 chiều; khi buộc khai manifest thật thì 4 chiều 0-case **không khai `n/a` được** (UI có lưới/filter/sort · API vì quy tắc "test cả UI lẫn API" · E2E vì Create→Checkout→Thanh toán là chuỗi thật · Change Impact vì đơn Bảo lưu dùng chung Transaction List + property "lần đóng"). `--enforce` **chặn (exit 1)** → bổ sung 8 case. 4 chiều `n/a` có lý do kiểm chứng được, trong đó `security` = **BA chưa cấp ma trận role/permission** (cùng nguyên nhân khiến 24 case bộ 530 đang treo).

**Quyết định — CHƯA bật chặn toàn cục.** Tỷ lệ trượt Lớp 1 sau khi trừ báo oan là 0%, nhưng **không dùng để quyết được**: 28 case này do tôi viết với 10 rule mở sẵn trước mắt ⇒ đó là **trần**, không phải tỷ lệ điển hình. Căn cứ để bật chỉ có một nguồn: **một lượt Phase 1 chạy bình thường** rồi đo lại. Giữ **cảnh báo, không chặn** cho tới lúc đó.

## 2026-08-14 (l) — backup knowledge: cấu hình thật + chốt chặn "quên chạy"

Đích đã chốt: **local ngoài repo** (`D:/kit-knowledge-backup`) — user chọn, cố ý **KHÔNG** đưa business rule nội bộ lên cloud dù OneDrive có sẵn trên máy. `KNOWLEDGE_BACKUP_DIR` đặt trong `.env` (machine-local, gitignored) và ghi vào `.env.example` cho máy mới. Bundle đầu tiên: **15 file**.

**Mối nguy thật, nói cho đúng:** không phải hỏng ổ cứng mà là **tai nạn git** — và nó **đã xảy ra trong chính phiên này**: đổi nhánh lúc sync GitLab xoá sạch `knowledge/**` vừa được gitignore, phải `git restore --source=2d383e1^` lấy lại **87 file**. Lần đó cứu được vì file còn trong history; nay đã bỏ track hoàn toàn nên **cùng tai nạn = mất vĩnh viễn**. Vì vậy đích local (ngoài repo) đã chống đúng lớp nguy hiểm nhất — không cần cloud.

**Added — chốt chặn ở `self_review`** (gate trước finalize, đúng lúc vừa sinh record mới): có record ghi tay mà **chưa cấu hình đích** → nhắc · đã cấu hình mà **chưa có bundle nào** → nhắc · bundle mới nhất **quá 7 ngày** → nhắc. Nghiệm thu 2 nhánh: vừa backup xong thì **im**; xoá biến môi trường thì nhắc đúng *"15 record knowledge GHI TAY … CHƯA cấu hình"*.

Kiểm chỗ dễ hỏng: script **tự đọc `.env`** qua `runtime_config` — nếu không thì cấu hình vừa đặt là vô ích (đã chạy không truyền biến để xác nhận).

**Lỗi vận hành của tôi ở commit này:** lệnh sửa CHANGELOG viết trong `node -e` bên trong heredoc → **shell ăn backtick**, script chết, nên `d2f7dd7` commit thiếu mục này (phải bổ sung ở commit sau). Đây là **lần thứ ba** trong ngày backtick bị shell ăn. Bài học đã rõ: nội dung có backtick thì **dùng Edit tool**, đừng đi qua shell.

## 2026-08-14 (k) — sao lưu store KHÔNG nạp lại được + stale theo lịch cho rule

Review chỉ ra bảng "nạp lại" của `SCHEMA.md` đặt hai thứ **khác loại** cạnh nhau, và đúng:

| | Store | Mất thì sao |
|---|---|---|
| Nạp lại được | `bugs/` · `historical_execution/` · `metrics/` | 1 lệnh là có lại (Jira / test-results) |
| **KHÔNG** nạp lại được | `domain/` `system/` `decisions/` `setup_recipes/` `environment/` `locators/` + `bug_tc_map.json` | **Làm lại công sức người** |

Đo: **15 file** thuộc loại thứ hai, và vì `knowledge/**` bị gitignore nên chúng tồn tại trên **ĐÚNG MỘT máy — không remote nào có bản nào**. Tôi đã ghi rủi ro này rất cẩn thận cho `bug_tc_map.json` nhưng **bỏ sót đúng ba store đắt nhất**. Chi phí chỉ tăng theo thời gian và **không sửa được sau khi mất**.

**Added — `npm run knowledge:backup`.** Bundle JSON + sha từng record · `--verify` so bundle với hiện trạng · `--restore` **chỉ ghi file còn THIẾU, không đè** (bản trên đĩa có thể mới hơn bundle; khác nội dung thì chỉ BÁO). **TỪ CHỐI** khi thiếu đích và khi đích **nằm trong repo** — backup cùng chỗ bản gốc thì không phải backup, còn tạo nguy cơ commit đúng dữ liệu đã quyết định không commit. Cố ý **không** sao lưu `bugs/`/`historical_execution/`/`metrics/`: nạp lại được, thêm vào chỉ làm phình bundle và làm mờ thông điệp.
Nghiệm thu **trọn vòng**: backup 15 file → verify KHỚP → xoá 2 file (rule đắt nhất + `bug_tc_map`) → verify **exit 1, nêu đúng tên** → restore → verify KHỚP, nội dung **giống từng byte**; sửa file trên đĩa rồi restore → **không bị đè**; sau khi sửa 1 record thì `--verify` báo đúng *"đã sửa sau lần sao lưu"*.

**Added — `domain:check` stale THEO LỊCH (`--stale-months`, mặc định 9).** Khác stale cũ: cái cũ nổ khi **có người sửa rule** (rule đổi sau lần execute → TC phải chạy lại); cái mới nổ khi **KHÔNG ai làm gì** — rule active không ai chạm N tháng thì oracle có thể đã lạc hậu, và nó im lặng vì không sự kiện nào kích hoạt. Rule lạc hậu tệ hơn không có rule: mọi TC dựa vào nó sai theo mà vẫn xanh.
Tự bắt lỗi: `Number(x) || 9` làm `--stale-months 0` **rơi về 9 âm thầm** (0 là falsy) — phát hiện đúng lúc nghiệm thu ngưỡng.

**Fixed — doc drift** review nêu: khối "Thư mục" của SCHEMA thiếu `setup_recipes/`, `environment/`, `metrics/`, `bug_tc_map.json`.

## 2026-08-14 (j) — mắt xích còn hở: chiều TC → rule, và recipe tái dùng được

Hai review về knowledge. Tôi kiểm từng khẳng định trước khi làm — **đúng gần hết**, và một con số làm luận điểm chính mạnh hơn cả cách nó được trình bày.

**Lỗ hổng #1 — chiều TC → rule không có gì kiểm.** `--trace` đã kiểm chiều rule→TC (rule nào chưa có test). Chiều ngược thì `output_gate`/`design_gate` **0 lần** nhắc tới `domain/`/`BR-`, và canonical **không có cột nguồn oracle**. Đo trên bộ 530: **0/530 case** nhắc bất kỳ id rule nào — dù `§12` prompt gen **đã yêu cầu** "ghi id rule vào Kết quả mong đợi/Assumptions" từ trước. Trong đó **47 case có expected mang giá trị số/tiền/%** (chắc chắn có oracle nghiệp vụ) và **0** trỏ rule. ⇒ Quy định có, **tuân thủ 0%**, không máy nào gác.

**Đã KHÔNG chọn 2/3 phương án review đề xuất, kèm lý do:**
- *Thêm cột "Nguồn oracle"* → phá format 9 cột mà `md_to_xlsx`/publish/pull/validate đều khoá theo, và bộ 530 đã chốt không tái cấu trúc.
- *Auto `covered_by` qua `learning_recorder`* → nó là Suggest-only, tức lại phụ thuộc "agent nhớ chạy" — đúng cái đã đo là thất bại.

**Làm cách thứ tư: mang id rule vào TAG tiêu đề**, dùng lại hạ tầng tag chiều dựng cùng ngày:
```
[Positive][Calc][BR-RECIPBANK-001] TK nhận theo chương trình + mốc 01/01/2026
[Negative][Guard][SM-ORDER-001]    Đã thanh toán → Chờ thanh toán phải bị CHẶN
```
`model.oracleRefsOf()` đọc `BR-`/`SM-`/`PM-`/`SS-`/`DM-` từ tiêu đề — **không đổi format**. `npm run domain:trace-back`: (a) case mang tag cần-oracle (`calc/bedata/display/security/guard`) mà không trỏ id → cảnh báo *"expected lấy từ đâu?"*; (b) trỏ id không tồn tại → *"oracle ma"*; (c) `--apply` **tự append `covered_by`** ⇒ hết phụ thuộc người nhớ điền. Một tín hiệu gác **hai chiều**.
Nghiệm thu bằng fixture 3 case: append đúng 1, cảnh báo đúng case thiếu ref, bắt đúng ghost ref; `--apply` ghi thật rồi hoàn nguyên. Trên bộ 530 (chưa có tag) nó **nói rõ "CHƯA GÁC ĐƯỢC"** thay vì báo OK — im lặng ở đó chính là lỗi nó sinh ra để chống.

**Recipe tái dùng được (review #2).** Xác minh: `SR-ORDER-001` **không có** `applies_when`/`used_by`, và `howto_store` chỉ có `--check`/`--index` — không có tra cứu. Thêm: `applies_when` (điều kiện áp được), `used_by` (TC đã dựng state thành công = bằng chứng recipe còn dùng được, cùng khuôn `covered_by`), và `npm run howto:find -- "<precondition>"`. Chạy đúng luồng review mô tả: `PRE-03: Deal phải là loại Chuyển nhượng` → tra → `SR-ORDER-001` khớp 4 từ, hiện `applies_when` + `used_by` → **người** tự quyết.
**Cố ý KHÔNG có "match confidence"** dù review đề nghị: một điểm `0.72` trông đáng tin hơn thực tế và mời người ta bỏ qua bước đọc — mà trong ngày 14/08/2026 chấm-điểm/suy-diễn trên văn bản tiếng Việt đã sai **3 lần liên tiếp** (suy module bug 4/9 sai · `label→module` 5/17 đa nghĩa · suy chiều coverage đánh đổi recall↔precision). Xếp theo **số từ khớp**, in ra thứ để ĐỌC.
`entity/state` + `input_requirements` thì **hoãn** — cấu trúc chỉ trả lãi khi có nhiều recipe và có người truy vấn thật; hiện N=1.

**Hai lỗi nhỏ review nêu — đều đúng, đã sửa** (xem mục (k) cùng ngày).

## 2026-08-14 (i) — `docs:budget`: đo tài liệu TRƯỚC khi đọc (và bắt 2 bẫy đo được thật)

Việc #3 trong danh sách ("giao subagent đọc tài liệu lớn"). Nhưng "tài liệu lớn" là thứ **chỉ hiện ra sau khi đã đọc xong**, tức đã muộn — nên thứ cần làm trước là **đo**.

**Added — `scripts/qa/doc_budget.js` (`npm run docs:budget`).** Đo `requirements/` của task theo KÝ TỰ (không theo byte: UTF-8 tiếng Việt ~1,5 byte/ký tự nên đếm byte phóng đại ~50% và đẩy tài liệu qua ngưỡng oan) rồi phán từng file: `<8k` đọc trực tiếp · `8–25k` chỉ đọc mục cần · `>25k` **giao subagent** (`--contract` in hợp đồng trích xuất: trả JSON theo `knowledge/SCHEMA.md`, mọi rule phải có `source` tới đúng tab/mục, chỗ tài liệu không trả lời được thì vào `open_questions` — cấm suy diễn lấp chỗ trống; kết quả vẫn phải qua `domain:check`/`system:check`).

**Đo trên task thật — con số nói thay lời:** 54 tài liệu, **~38.600k token nếu đọc hết**, trong đó `figma_node_6-5.json` **37.500k** (nặng gấp **~3.180×** toàn bộ prompt gen 11,8k). Không ai đọc nổi file đó, mà nó đang nằm trong `requirements/`.

**Hai bẫy mà tool bắt được, cả hai đều tồn tại thật:**
1. **Tài liệu có nhiều bản** — FSD có cả `.json` 504k lẫn `.md` 108k; sheet mapping `.json` 56k + `.md` 33k; `tabs/` và `tabs_20260807/` là hai lần export. Bỏ bản dư = **~670k token** không mất một chữ nào.
2. **⚠⚠ Bản cũ NHỎ HƠN HẲN bản mới = bản THIẾU nội dung**, không phải "bản khác ngày".

**Tự bắt lỗi nguy hiểm trong chính tool** — bản đầu tôi cho tiêu chí "đọc bản NHẸ NHẤT", và nó khuyên đọc bản FSD **6,6k** thay vì **108k**. 6,6k chính là các bản export **bị cắt còn 1/15 tab** từ trước khi vá `includeTabsContent` **sáng cùng ngày** (mục (b)). Tức tool suýt khuyên đọc thiếu spec — đúng cái bug vừa sửa. Tiêu chí đúng: cùng basename khác **định dạng** → ưu tiên `.md`; cùng định dạng khác lần export → ưu tiên **mới nhất theo mtime**; và nếu bản mới lớn hơn hẳn thì **nói to** rằng bản cũ là bản thiếu.

Nối vào `phase1/01_setup_engine_fetch_docs.md` (+0,5k) và bảng gate của `run_phase1`. Ghi rõ trong prompt: giao subagent **KHÔNG** giảm tổng token (subagent nạp lại luật + ngữ cảnh), nó đổi lấy việc luồng chính không chứa nguyên văn tài liệu — nói thẳng để không ai kỳ vọng sai.

## 2026-08-14 (h) — auth reuse: cơ chế đã có nhưng 32/33 spec không đi qua

**Bối cảnh.** Tôi từng nói "UAT login throttle chặn cứng việc song song hoá Phase 2". **Sai** — cơ chế né throttle đã có từ trước (`session_cache` + `ensureOpsAuth` + `tokenBroker`). Nhưng đo ra thì nó **chưa được lắp**: **1 spec** dùng `ensureOpsAuth`, **32 file gọi thẳng `loginOps`** ⇒ mỗi lần chạy vẫn login lại. Thêm nữa `playwright.config.js` không có `globalSetup` và `session_cache` không có lock ⇒ **khởi động lạnh với N worker = N lần login đồng thời**, đúng cái lockout mà cache sinh ra để tránh.

**Changed — đưa cache vào THẲNG `loginOps`, không sửa 32 spec.** Sửa ở điểm vào thì không ai bypass được bằng cách quên — cùng nguyên tắc forcing-function của kit; chữ ký giữ nguyên nên **0 spec phải sửa**. Bản thuần tách thành `loginOpsForm` (dùng khi cố ý test luồng login; `ensureOpsAuth` nay gọi bản này để không lồng hai lớp cache). Cache tươi → seed cookies + localStorage **trước mọi navigation** rồi mở base; nếu vẫn bị đẩy về `/auth/login` thì xoá cache và login form. Kill-switch `AUTH_REUSE=0` cho hành vi y như trước; TTL đổi qua `AUTH_TTL_MINUTES` (mặc định 25′ < token TTL 30′).

**Added — `sessionCache.withLock`.** Lock bằng `mkdir` (atomic trên cả Windows lẫn POSIX, không cần thư viện). Lock cũ hơn `staleMs` bị **thu hồi** — nếu không thì một lần crash treo mọi lần chạy sau. Hết `timeoutMs` thì **vẫn chạy** `fn`: thà login trùng một lần còn hơn làm cả suite fail vì không lấy được lock.

**KHÔNG thêm `globalSetup`** dù nó cũng chữa được thundering-herd: globalSetup sẽ **login UAT vô điều kiện ở mọi lần chạy**, kể cả suite infra không cần auth — trái rule "xác nhận trước mỗi lượt chạm UAT". Lock giải đúng vấn đề đó mà không thêm một lượt chạm nào.

**Nghiệm thu**
- Offline (`tests/fe/infra/auth-session-lock.spec.ts`, 4 pass, **không chạm UAT, không cần creds**): quyết định tươi/hết-hạn; 5 lượt đồng thời → max 1 trong vùng găng và **đúng 1 lần "login"**; lock rác bị thu hồi; hết timeout vẫn chạy và báo rõ `gotLock=false`.
- **Liên tiến trình** (thứ mà test trong-một-tiến-trình KHÔNG chứng minh được): 5 process node song song → log ra **1 LOGIN + 4 REUSE**, max 1 process trong vùng găng.
- Regression: `tests/fe/infra` **30/30 pass**, `typecheck`/`lint` exit 0, 30 file gọi `loginOps` không phải sửa dòng nào.
- ✅ **UAT thật (đã chạy, user xác nhận chạm UAT): 2/2 pass** — `tests/fe/auth/auth-evidence.smoke.spec.ts`. Cache key thật ghi 35 cookie + `actToken`/`refreshToken`. Kill-switch `AUTH_REUSE=0` vẫn giữ để trở về hành vi cũ nếu cần.

**Hai lỗi của chính thay đổi này, phát hiện KHI chạy smoke** (không phải do đọc lại code):
1. **Tôi đã copy logic seed thành bản thứ hai.** Smoke cũ chỉ nghiệm thu bản trong `ensureOpsAuth`; bản trong `loginOps` là code chưa ai chứng minh chạy. Hai bản sao của cùng một logic khó (thứ tự `addInitScript`, chọn origin, cách xác minh) chắc chắn phân kỳ. → Tách `tests/fe/support/auth/seedSession.ts` làm **một bản duy nhất**, cả hai đường gọi vào đó; đặt ở module thứ ba để không sinh import vòng (`opsAuth` đã import `opsLogin`).
2. **Smoke cũ KHÔNG phủ `loginOps`** — nó gọi `ensureOpsAuth` với key riêng, trong khi `loginOps` mới là hàm 30 spec thật sự dùng. → Thêm test riêng cho `loginOps`. Bằng chứng "không login lại" là **`savedAt` không đổi sau lượt 2** (chọn cách đo này vì `loginOps` trả `void` — giữ chữ ký để 30 spec không phải sửa nên không đọc được "method" như `ensureOpsAuth`). Tốn đúng **1 lần login** cho cả 2 lượt.

## 2026-08-14 (g) — vá rủi ro do chính nhát cắt (f) sinh ra: khai `n/a` sai

Tách 15 chương thành file rời sinh ra một rủi ro mới: agent đọc **một dòng trigger** rồi khai `n/a`, trong khi trước đây đọc tuần tự sẽ **vô tình gặp** chương đó và nhận ra là cần. Chốt chặn cũ chỉ là "n/a phải có lý do" — tức trông chờ người review đọc.

**Added — đối chiếu manifest ↔ ARTIFACT THẬT** trong `dimension_coverage.js`. Không suy diễn văn bản (cách đó đã bị loại ở (d)), mà dựa vào **sự tồn tại của artifact** — một sự thật kiểm được:

| Khai `n/a` cho | Bị CHẶN nếu tồn tại |
|---|---|
| §11 Design | `requirements/figma/**` |
| §12 Display | `requirements/ui_catalog.{json,md}` |
| §14 BEData | `field_mapping*` trong `requirements/` |
| §5 API | `requirements/swagger/**` |
| §17 Impact | `requirements/git-impact.md` \| `knowledge/system/` có `shared_surface` |
| §10 Guard | `knowledge/system/` có `state_machine` |
| §15 Security | `knowledge/system/` có `permission_matrix` |

**Chiều ngược lại KHÔNG suy được** và script cố ý im lặng ở đó: artifact vắng **không** chứng minh chiều đó không áp dụng (có thể chỉ là chưa ai kéo Figma/swagger về). Chỉ chặn khi artifact **có** mà manifest nói `n/a`.

Chặn **độc lập** với việc thiếu case, và chạy được **cả ở chế độ GỢI Ý** — vì bằng chứng không phụ thuộc phân loại case. Artifact có mà chưa khai `required` thì cảnh báo (không chặn).

**Nghiệm thu trên task thật** (SAPP-24395 có `figma/` + `ui_catalog.json` + `field_mapping*`): manifest cố ý khai `design_figma: "n/a"` và `display_conformance: "n/a"` → không `--enforce` thì báo 2 XUNG ĐỘT + exit 0; có `--enforce` thì **exit 1**. Cảnh báo "chưa khai required" cũng nổ đúng cho §10 Guard nhờ `knowledge/system/` có `state_machine`.

Ghi vào §0b của prompt gen thành bảng, kèm câu nói rõ chiều nào suy được / chiều nào không — để agent biết `n/a` sẽ bị đối chiếu, không phải chỉ để review đọc.

## 2026-08-14 (f) — tách 15 chiều coverage thành file rời: 24,6k → 14,9–20,4k tuỳ task

Nhát cắt thứ hai, làm được vì (d) đã có gate đếm case theo tag đứng sau OUTPUT. §3–§17 nằm **liền nhau** trong file nên cắt sạch; §18 Self-check **ở lại** (nó là gate đóng lượt, không phải một chiều).

`prompt_templates/phase1/dimensions/` — 15 file, mỗi file 0,2–2,3k, mỗi file mở đầu bằng **tag bắt buộc** + **"mở khi nào"** (trigger copy từ chính tiêu đề chương, không tự bịa). Trong `02` còn lại **bảng điều hướng** §·chiều·tag·mở-khi·file.

| Lượt gen | Token | So với 24,6k |
|---|---|---|
`02_gen_testcases.md` (nạp mọi lượt) | **11,8k** | — |
Task **nặng** (payment: §3,4,12,13,14,15,17) | 11,8 + 8,6 = **20,4k** | −4,2k (**17%**) |
Task **nhẹ** (mobile UI: §4,11,12) | 11,8 + 3,1 = **14,9k** | −9,7k (**39%**) |

Nói thẳng: task dùng gần hết chiều thì tiết kiệm ít (17%) — đúng như đã cảnh báo trước khi cắt, không phải "về vài k". Lợi ích lớn thứ hai lại **không phải token**: giờ **bắt buộc khai `dimension_manifest.json` TRƯỚC khi gen** (để biết mở file nào), nên phạm vi chiều thành một tuyên bố tường minh có lý do cho từng `n/a`, và `dim:coverage --enforce` đếm lại ở cuối. Trước đây phạm vi chiều là thứ ngầm định trong đầu người gen.

**G1 bảo toàn nội dung:** 555 loại dòng · **MẤT 0**.

**8 con trỏ lệch đã sửa** (script in rõ 8/8 áp dụng, không replace im lặng): `run_phase1` ×3, `02b_output_format` ×2, `06_cross_module`, `.agent/rules/qa_instincts.md`, `.agent/skills/phase1/git_impact_analyzer/SKILL.md`. Các "mục N" **nội bộ** trong `02` giải một lần bằng quy ước ghi ngay trong bảng điều hướng (`N = 3…17` ⇒ `dimensions/`; mục 0–2 và 18 vẫn ở `02`) thay vì sửa hàng chục câu.

## 2026-08-14 (e) — cắt 3,8k khỏi prompt gen, có kiểm bảo toàn từng dòng

Sau khi (d) dựng xong gate chiều đứng sau output, việc cắt prompt mới an toàn. Cắt phần **an toàn nhất trước**: `Phase 1 Summary Report` + `Export Excel` — hai mục này là hướng dẫn **định dạng output ở cuối lượt**, KHÔNG phải luật về nội dung case, nên không cần nằm trong context suốt lúc đang sinh case. Chúng nằm liền nhau ở cuối file nên là một nhát cắt đuôi sạch.

| | Trước | Sau |
|---|---|---|
`02_gen_testcases.md` (nạp mọi lượt gen) | 24,6k tok | **20,8k** |
`02b_output_format.md` (chỉ nạp ở cuối lượt) | — | 3,9k |

**G1 — kiểm bảo toàn nội dung, không tin "nhìn có vẻ ổn".** So tập dòng không rỗng của bản gốc với hợp của hai file mới: **671 loại dòng · MẤT 0**. Cần thật, vì trong đợt này đã 2 lần backtick bị shell ăn và 1 lần dòng bị dangling sau khi Edit.

**Ba con trỏ lệch phát hiện lúc rà** (một cái hỏng từ trước, không do nhát cắt): `run_phase1` ghi "không nạp sẵn cả **6** file" (thực tế 7) và "`02_gen_testcases.md` đã **89KB**" (nay 77KB) → sửa; và câu "áp dụng quality gate trong section Phase 1 report **bên dưới**" — `run_phase1` **không có mục report nào**, tức con trỏ đã trỏ vào hư không từ trước → nay trỏ đúng `02b_output_format.md`.

`02b` được khai trong bảng "Bản đồ prompt" là **BẮT BUỘC ở CUỐI lượt**, kèm lý do bỏ qua sẽ bị chặn (`design_gate` chạy trong `md_to_xlsx`, `self_review` đọc Summary Report).

**Còn lại của việc cắt:** 9,9k của 15 chương theo chiều (§3–§17) giờ đã có gate đứng sau nên cắt được — nhưng chưa làm, vì lợi ích thật chỉ **11–27%** tuỳ task và phải sửa cả cơ chế điều hướng để nạp đúng chiều theo scope. Cắt tiếp hay không là quyết định đánh đổi, không phải việc dọn dẹp.

## 2026-08-14 (d) — 15 chiều coverage của Phase 1 chưa có MÁY nào gác

**Bối cảnh.** Câu hỏi đặt ra là cắt `02_gen_testcases.md` (24,1k token) theo mục để tiết kiệm token, với điều kiện **chất lượng không được giảm**. Đo trước khi cắt, và hai con số đổi hẳn kết luận:

1. **Tiết kiệm ít hơn tưởng.** Chia mục: **12,5k (52%) là luật xuyên suốt mọi case** (cột 1–9, phân nhóm, coverage map, self-check §18, Summary Report, Export Excel) — không cắt được; chỉ **9,9k (41%)** là 15 chương theo chiều (§3–§17). Task thật dùng 5–6 chiều ⇒ bỏ được **2,6–6,6k = 11–27%**, không phải "về vài k" như tôi nói trước đó. Y hệt kết luận đã đo với `RULE_GLOBAL` (74% xuyên suốt → chỉ tiết kiệm 7–19%).
2. **Cắt bây giờ thì chất lượng CHẮC CHẮN giảm**, vì `design_gate` **không kiểm chiều nào** (chỉ `requirements`), `tc_validator` cũng không, và nhãn chiều duy nhất tồn tại là `positive/negative/edge/boundary`. Nghĩa là thứ **duy nhất** làm 15 chiều xảy ra là agent đọc được §3–§17. Cơ chế đó vốn đã yếu: §12 là BẮT BUỘC và luôn được nạp mà cả cụm bug "thiếu trường/thừa cột/lệch nhãn" vẫn lọt.

⇒ Đảo thứ tự: **dựng gate chiều trước, cắt prompt sau.**

**Added — `scripts/qa/dimension_coverage.js` (`npm run dim:coverage`)**
Đếm case theo 15 chiều trên bộ **đã sinh** rồi chặn nếu thiếu chiều mà `requirements/dimension_manifest.json` khai `required`. Đảo phụ thuộc: kiểm ở **output**, không tin agent nhớ nạp mục nào ⇒ sau này cắt prompt thì "mất text" không còn đồng nghĩa "mất chiều".

**Hai chế độ, và đây là phần quan trọng nhất:** ban đầu tôi định suy chiều từ văn bản, nhưng đo trên bộ 530 case thật thì **suy diễn không đủ tin để chặn** — recall thiếu (§5 API đếm **0** trong khi có 17 case nhắc "api") và precision kém (§12 nhận cả `[Positive] Chọn Next → hiển thị màn Confirm`, vì **"hiển thị" là động từ chuẩn của MỌI expected tiếng Việt**; nới pattern thì §12 phồng 17 → 106). Nên: chế độ **NHÃN** (case mang tag chiều) mới được `--enforce`; chế độ **GỢI Ý** thì script **tự từ chối chặn** (exit 2) kèm đường ra — chặn bằng số liệu không đáng tin là cách nhanh nhất để gate mất uy tín. `--enforce` cũng bị từ chối khi chưa có manifest, vì lúc đó không ai khai chiều nào bắt buộc.

**Bẫy tiếng Việt ghi lại để không ai đạp lại:** bỏ dấu thì `nhan` (nhãn/label) **trùng luôn `nhận`** trong "ghi nhận", "TK nhận", "HV nhận" — thêm nó vào pattern làm §12 phồng gấp 6 lần.

**Changed — `DIMENSION_TAGS` (`scripts/lib/testcase/model.js`, lib DÙNG CHUNG)**
Thêm 13 tag chiều (`validation/ui/api/export/resilience/sideeffect/guard/design/display/calc/bedata/perf/impact`) cạnh 7 tag cũ. **Additive, đã nghiệm thu trên bộ 530**: `dimensions` parse ra y nguyên `positive=393 · negative=101 · edge=19 · boundary=12`, không tag mới nào khớp nhầm (đã liệt kê toàn bộ token `[...]` đang có để kiểm — `[Constraint]`, `[Product/Combo]`, `[CX]`… đều không trùng).

**Added — §0b prompt gen (+0,5k token):** bảng chiều → tag, kèm lý do bắt buộc. Case phủ nhiều chiều thì nhiều tag; chiều n/a phải kèm **lý do** trong manifest (thiếu lý do là bị cảnh báo — bỏ chiều im lặng đúng là thứ gate này sinh ra để chặn).

**Nghiệm thu bằng fixture** (không tin suông): bộ 2 case gắn `[Display]`/`[Validation]`, manifest yêu cầu thêm `security` → gate vào chế độ NHÃN, đếm đúng, `perf: n/a` được tôn trọng, thiếu `security` → **exit 1**; cảnh báo "n/a không có lý do" cũng nổ đúng.

**Chưa làm:** bộ 530 hiện tại chưa có tag nên gate chạy ở chế độ gợi ý (báo cáo, không chặn) — nó sẽ chặn từ bộ testcase **gen mới** trở đi. Và việc cắt `02_gen_testcases.md` vẫn để ngỏ: cắt được an toàn ngay là `Phase 1 Summary Report` + `Export Excel` = **3,7k**, vì đó là hướng dẫn định dạng output cuối lượt, không phải luật nội dung case.

## 2026-08-14 (c) — spec dạng Google Sheet: đọc được mà KHÔNG cần credential

**Bối cảnh.** BA gửi spec dạng Google Sheet liên tục (bảng mapping field↔property, biểu phí, mã môn, luồng đồng bộ). Nhưng `sheet_reader.js` đi qua Sheets API nên đòi credential, và đo 14/08/2026 thì **cả ba đường đều chết**: `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` rỗng · `GOOGLE_API_KEY` rỗng · token OAuth của `google_doc` chỉ có scope `documents.readonly`+`drive.readonly` mà **Drive API đang bị TẮT** ở GCP project. Kết quả: spec dạng sheet nằm ngoài tầm đọc của mọi phase.

**Added — `scripts/integrations/google_sheet/sheet_fetch_public.js`**
Tải sheet đang bật link chia sẻ về `.xlsx` qua `/export?format=xlsx` — chỉ cần quyền đọc-bằng-link, đúng dạng link BA vẫn gửi. **Chặn cái bẫy im lặng**: sheet KHÔNG chia sẻ thì Google trả **200 + HTML trang đăng nhập**, lưu ra thành "file .xlsx" hỏng và mọi bước sau báo lỗi ở chỗ khác hẳn nguyên nhân. Script kiểm magic bytes `PK` và báo đúng nguyên nhân + cách xử lý. Giới hạn ghi rõ trong header: đây là ảnh TĨNH, không có comment/suggested edit.

**Added — `scripts/convert_excel/xlsx_to_md.js`** (chiều ngược của `md_to_xlsx.js`)
`.xlsx` → Markdown đọc được: cắt vùng dữ liệu thật (sheet của BA hay 1000×30 mà chỉ ~20 dòng có dữ liệu ⇒ không cắt thì md phình toàn dấu `|` rỗng và ngốn context), giữ hyperlink dạng `[text](url)` (link trong sheet thường trỏ tới spec khác — mất link là mất đường lần tiếp, đã gặp: bảng mapping TK nhận phí nằm sau đúng một link như vậy).

**Hai lỗi tự bắt được khi chạy thật** (kể lại vì đều là lớp lỗi hay lặp):
- **Ô gộp**: bản đầu tôi *fill-down phỏng đoán* theo hàng trên → nhân bản luôn header thành `↑ ↑ ↑ STT` trên sheet 1001 dòng. Sửa: dùng metadata `cell.isMerged`/`cell.master` của ExcelJS — chính xác, không đoán.
- **Hyperlink lồng richText**: `v.text` lại là object ⇒ `String()` cho ra `[object Object]` và **mất nhãn link**. Phải gỡ thêm một lớp.

## 2026-08-14 (b) — `doc_reader` đọc Google Doc nhiều tab chỉ được TAB ĐẦU, im lặng

**Bối cảnh.** Một câu hỏi treo 4 ngày ("TK nhận phí dịch vụ xác định theo chương trình hay theo loại tài khoản thi?") tưởng là *thiếu tài liệu, phải hỏi BA*. Hoá ra tài liệu đã trả lời từ đầu — **kit không đọc được**.

`documents.get` **thiếu `includeTabsContent: true`** thì Google Docs trả về `body` của **tab ĐẦU TIÊN** và **không báo gì**: không lỗi, không cờ, không field cảnh báo.

| | Trước | Sau |
|---|---|---|
| Nội dung | 441 paragraph · **18.5 KB** | **345.6 KB** (18.6×) |
| Số tab | 1 | **15** (7 mức 1 + 8 tab con lồng) |
| Chứa quy tắc đang tìm? | **KHÔNG** (0 lần) | **CÓ** (25 lần) |

Đây là dạng hỏng tệ nhất trong việc tra tài liệu: agent đọc, không thấy, rồi kết luận **"tài liệu không quy định"** — trong khi nó nằm ở tab 4.1. Đúng loại "cắt cụt im lặng" mà `RULE_GLOBAL` cấm, nhưng lần này chính tooling của kit vi phạm.

**Fixed**
- `includeTabsContent: true` + `flattenTabs()` **đệ quy** (tab lồng qua `childTabs` — chỉ đọc mức 1 là mất 8 tab con).
- Renderer (`docToMarkdown`/`docToPlainText`) chạy trên **mọi** tab, mỗi tab một heading `## Tab: <tên>` theo độ sâu; tách `contentToMarkdown()` ra khỏi `docToMarkdown()` để dùng lại cho từng tab.
- **Log số tab + tên tab** mỗi lần đọc ⇒ nhìn output là biết đã lấy đủ hay chưa, không phải tin vào im lặng.

**Kết quả nghiệp vụ.** Rule `BR-ADDONBANK-001` ("tài khoản thi CBE ⇒ MB SAPP", nguồn: cột bình luận trong sheet bug) bị **bác bỏ bằng tài liệu gốc**: sheet mapping khai `Recipient Bank Account ← tai_khoan_nhan_phi_dich_vu` (trục **chương trình × mốc 01/01/2026**) còn loại tài khoản thi đi qua property KHÁC (`loai_phi_dich_vu`) và chỉ quyết định *loại đơn*. Ghi rule đúng `BR-RECIPBANK-001` với `covered_by` thật (`TC_133/134/135/136/360`) — hết `covered_by` rỗng. Không bug nào phải rút lại. **Bài học ghi vào rule:** lời văn trong cột bình luận của sheet bug **không ngang hàng** FSD/mapping sheet; để nó làm oracle thì lượt gen sau sinh case sai rồi log bug không tồn tại.

## 2026-08-14 — 42% lịch sử bug vô hình với risk, và bảng risk thì toàn dòng phantom

**Bối cảnh.** `risk_score` LOẠI bug không có `module` khỏi bảng (đúng chủ ý — xem §"(unmapped)"), nhưng đo thật thì **26/57 bug** đang ở diện đó vì thiếu label TC trên Jira ⇒ **log bug rồi vẫn không làm sâu thêm test lượt sau**.

**Hai cách tự động đã thử và LOẠI** (ghi lại để không ai làm lại):
- *Suy module từ tiêu đề bug*: 9 ca "trông chắc", soi ra **≥4 sai rõ ràng** (vd "Add-on Order không đồng bộ HubSpot" bị gán "Check tiền & Ghi nhận doanh thu"). Module SAI tệ hơn `(unmapped)`: nó bơm Likelihood cho module vô can VÀ vẫn để module thật mỏng.
- *Bảng tra `label → module`*: chấm trên 30 bug đã có module thật → **5/17 label đa nghĩa**, và toàn là loại phổ biến nhất (`be` trải 6 module; `re-verify`/`reopened` 3 module). Label thực tế là nhãn **quy trình**, không phải nhãn chức năng.

**Added — `scripts/qa/bug_tc_matcher.js` (`npm run bug:tc-match`): đề xuất, KHÔNG tự ghi**
Ghép bug với TC canonical bằng trùng lặp từ khoá có idf trên `module+title+steps+expected`. **Tự kiểm bằng `--all`** trên 30 bug đã map — và chính con số đó quyết định thiết kế: argmax module đúng **40%** (⇒ không cho tự chốt), module thật có trong top-12 **73%**, đúng TC trong top-12 **67%** (⇒ đủ làm danh sách ứng viên cho người đọc). Vì vậy script **không có chế độ `--apply`**.

**Added — `knowledge/bug_tc_map.json`: nguồn thứ ba, người chốt, có `basis` kiểm lại được**
Hai hạng không trộn: **A** = `tc_id` khi expected của TC nói thẳng hành vi bug phá (module lấy theo TC ⇒ không đoán); **B** = `module` + `coverage_gap` khi **không TC nào** phát biểu hành vi đó. Kết quả: **19 hạng A + 7 hạng B → 57/57 bug có module, `(unmapped)` = 0**. `learn_bugs` đọc file này SAU label/description.

**Fixed — 3 lỗ hổng lộ ra khi làm**
- **`tc_id` sai làm record đóng băng vĩnh viễn.** Nhánh backfill chỉ chạy khi `tc_id` **rỗng**, nên bug mang label mã không tồn tại (thật: `..._TC_560` khi bộ chỉ tới `TC_530`) đứng mãi ở `(unmapped)` mà nhìn record lại tưởng đã map. Giờ mã không tra ra module thì bản đồ tay **thắng**, và ghi rõ đã ghi đè mã nào.
- **Bảng risk toàn dòng phantom.** `impact.modules` khai **18 tên tiếng Anh** (Payment/Order/…) trong khi bug + snapshot dùng tên module canonical (tiếng Việt) ⇒ **17/18 dòng đầu bảng có Impact cao với 0 bug**, còn **23 module có dữ liệu thật** rơi về `Impact=default` nên band chặn trần Medium — `executeOrder` chỉ sai chỗ. Quy định *đã có* trong `_note` của `risk_model.json` ("tên module phải khớp cột `Module` của testcase") nhưng **không có máy kiểm**. Thêm cảnh báo lệch tên (chỉ nổ khi có phantom **và** có module dữ liệu thiếu Impact) + khai đủ 33 tên canonical. Sau sửa: mọi module có dữ liệu đều `config.module`, cảnh báo tắt.
- **Key `_...` trong config thành module giả.** `ensure()` chạy trên MỌI key của `impact.modules` nên thêm một dòng ghi chú là bảng mọc dòng `_canonical_note` với Impact là chuỗi. Giờ bỏ qua key `_`-prefix.

**Added — cảnh báo MẤT `bug_tc_map.json`.** Đây là store duy nhất trong `knowledge/` **không nạp lại được từ nguồn máy**. Mất file một mình chưa hỏng (record đã giữ `module`); hỏng khi mất file **rồi** nạp lại `bugs/` từ Jira. `learn_bugs` cảnh báo khi thiếu file mà đang có bug `(unmapped)` — đã nghiệm thu bằng cách gỡ file + set 1 record về `(unmapped)`.

**Added — 1 dòng vào `§12` prompt gen: field DẪN XUẤT phải bị KHOÁ theo nguồn.** 7 hạng B chia làm 3 lớp trống (chi tiết ở `coverage-gap-tu-bug-khong-co-TC.md`), trong đó lớp "conformance liệt kê CÓ field nhưng không phát biểu ràng buộc giá trị" là lỗ hổng **quy tắc** thật: case "form hiển thị đủ field X" **PASS ngay cả khi field đó cho chọn tự do** ⇒ `SAPP-28420` (modal Add Transaction cho chọn pháp nhân khác order) không TC nào bắt. Hai lớp còn lại (định dạng, chức năng không có TC) thì `§12` **đã có** quy tắc — lỗi là bộ 530 không áp dụng, nên không thêm rule trùng.

## 2026-08-13 (b) — 11 lệnh gate chưa từng được chạy, vì chỉ nằm ở tầng workflows

**Bối cảnh.** Định hướng ban đầu cho hai tầng (`prompt_templates/phaseN/` vs `.agent/workflows/`) là "co workflow lại thành bảng neo step ↔ skill". **May là đo trước khi cắt** — kế hoạch đó sẽ xoá mất một thứ không ai ngờ.

Quét lệnh (`npm run …` / `node scripts/…`) trong workflows rồi đối chiếu với `prompt_templates`: **11 lệnh gate chỉ tồn tại ở tầng workflows**, mà `run_phase2` **không trỏ tới workflow nào** và `run_phase1` chỉ nhắc 1 lần. Nghĩa là ai theo đúng điểm vào thì **không bao giờ chạy chúng**:

| Điểm vào thiếu | Lệnh vắng mặt | Hậu quả thật |
|---|---|---|
| `run_phase2` | `npm run self-review` (**G9**) | Không có lượt tự soi trước finalize — gate gộp preflight+design+row-quality+execution không chạy |
| `run_phase2` | `npm run learn -- --scan`, `npm run learn:bugs:apply` | **Đồng bộ trạng thái bug từ Jira không bao giờ chạy** ⇒ risk model tính vòng-đời-bug trên trạng thái cũ. Quan sát khớp: 9 bug local còn ghi `In Staging` trong khi Jira đã `Done`. *(Đính chính bản đầu viết "vòng học ĐỨT" — NÓI QUÁ: `learn_reporter` đã gắn sẵn trong `playwright.config.js` nên snapshot/metrics vẫn thu **tự động** sau mỗi lần chạy test. Chỉ phần **bug sync** và **backfill `--scan`** là thủ công, và chính hai cái đó vắng ở điểm vào.)* |
| `run_phase2` | `preflight_gate --mode phase2` (**G1**), `gate:output` (**G2**), `decisions:check` | Execute trên nền sai; output sai chuẩn không bị chặn; log lại đúng bug đã Rejected |
| `run_phase1` | `design:gate`, `risk:gate`, `trace:matrix`, `risk`, `domain:check`, `system:check` | Không đối chiếu độ sâu theo band rủi ro, không có ma trận REQ↔TC, không tra business rule đã xác nhận |

**Fixed**
- Thêm bảng **"Gate bắt buộc chạy"** vào cả `run_phase1` và `run_phase2`: *khi nào · lệnh · nó chặn/sinh ra gì*. Giờ đọc mỗi điểm vào là biết phải chạy gì, không cần biết tầng workflows tồn tại.

**Added — `gate:policy` chặn lệnh gate chỉ-nằm-ở-workflow**
Mọi `npm run …`/`node scripts/…` xuất hiện trong `.agent/workflows/phaseN_*` phải có mặt ở `run_phase{N}` tương ứng. **Phân giải bí danh qua `package.json`** — `npm run trace:matrix` và `node scripts/qa/traceability_matrix.js` được coi là MỘT, nếu không thì cùng một gate viết hai kiểu sẽ báo thiếu oan (đo thật: 2/4 "thiếu" ban đầu chỉ là bí danh). Nghiệm thu: thêm `npm run reliability` vào một workflow → exit 1 đúng thông báo → hoàn nguyên → xanh.

**Chưa làm — và lý do đổi ý:** *không* co tầng workflows nữa. Chúng không phải bản trùng của `prompt_templates` mà là **nơi chứa chi tiết từng bước + lệnh gate**; co lại là mất nội dung thật. Quan hệ đúng của hai tầng giờ là canonical/digest có máy kiểm — y như `RULE_GLOBAL.md` ↔ `core_rules.md`.

## 2026-08-13 — `run_phase*` thành ĐIỂM VÀO thật: chỉ đọc 1 file là đủ điều hướng

**Bối cảnh.** Câu hỏi: "thay vì bắt đọc từng bước, chỉ bắt đọc `run_phase` thì có hợp lý không?". Đo trước khi trả lời — và hoá ra hợp lý về nguyên tắc nhưng **làm ngay lúc đó thì mất 47KB kỷ luật execute**: `run_phase2_template.md` **không hề trỏ** tới `04_execute_fe_playwright.md` (264 dòng) lẫn `05_execute_api_playwright.md` (135 dòng). Ai chỉ đọc `run_phase2` là execute mà thiếu toàn bộ phản xạ điều tra `qa_instincts`, luật khoanh tầng lỗi FE/BE, oracle mapping phải nêu cả hai giá trị, yêu cầu chạy `ui_conformance_check` và chuẩn evidence. Nghịch lý cho thấy tầng điều hướng hỏng: thứ **duy nhất** trỏ tới prompt execute FE lại là `.agent/rules/qa_instincts.md` — một file *rule* dẫn tới *prompt*, còn bản điều phối thì không.

Đo tổng: **8/11 prompt bước mồ côi** khỏi `run_phase`, trong đó **4 cái không nơi nào trỏ tới** (`01_setup_engine_fetch_docs`, `03_gen_test_data`, `05_manual_quick`, `06_triage_review`).

**Added — bảng "Bản đồ prompt" ở đầu mỗi `run_phase`**
- Mỗi prompt bước có 1 dòng: **bắt buộc hay không** + **mở khi nào**. Phân biệt rõ 3 loại thay vì gộp làm một: *bước chính bắt buộc* (`02_gen_testcases`, `04_auto_publish_jira`, hai executor, `08_log_bug_jira`), *nhánh thay thế* (`05_manual_quick` — chỉ khi cần TC chạy tay, requirement đã rõ), *công cụ khi cần* (`03_gen_test_data`, `06_cross_module`, `06_triage_review`, `07_triage_flaky` — bản thân 2 file triage đã tự khai "không bắt buộc").
- **Chọn ROUTER chứ không GỘP**, vì gộp thì riêng `02_gen_testcases.md` đã **89KB/844 dòng** — mọi session Phase 1 phải gánh nó kể cả khi chỉ chạy bước publish. Router thì đọc `run_phase2` (350 dòng) + đúng executor đang dùng (264 FE *hoặc* 135 API) thay vì cả 1087 dòng của phase 2 — rẻ hơn ~40% và nạp đúng lúc cần.
- Con trỏ đặt **ở cả bảng đầu file lẫn ngay tại bước** (`run_phase2` bước 3 ghi "MỞ NGAY BÂY GIỜ", không để đọc sau khi đã viết script xong). `run_phase_re-run_template.md` cũng nối vào 2 executor + `07_triage_flaky` trước khi tới `08_log_bug_jira`.

**Added — `gate:policy` chặn prompt bước mồ côi**
Mọi `prompt_templates/phase*/*.md` phải có đường vào từ một `run_phase*`. Trỏ được qua `.agent/workflows/` hoặc SKILL thì tính là hợp lệ nhưng **hạ xuống cảnh báo** (đến được nhưng người đọc `run_phase` không thấy). Cùng khuôn với gate rule-mồ-côi. Nghiệm thu: tạo `99_zz_dummy.md` → exit 1 đúng thông báo → xoá → xanh. Sau khi vá: **11/11 prompt đều có đường vào**.

**Chưa làm (chờ định hướng):** `prompt_templates/phaseN/` và `.agent/workflows/phaseN_NN_*` (15 file) đang là **hai tầng cùng mô tả "các bước của phase"** — mùi kiến trúc thật, nhưng gộp/tách là quyết định động vào cách chạy task nên tách riêng.

## 2026-08-12 (g) — chiều "bền vững dữ liệu sau mutation": kiểm tầng bản ghi, không đẻ TC mới

**Bối cảnh (đo, không phỏng đoán).** Câu hỏi "gen testcase đã có case kiểm DB chưa?" → **chưa, 0/1901 TC**. Chuỗi `db_readonly` xuất hiện **0 lần** trong toàn bộ `outputs/`, kể cả ở cột `Setup Verification` mà prompt vốn đã mời dùng. Trên bộ lớn nhất (563 TC): **415 case mutation**, **177 (43%)** có đọc lại — nhưng đọc lại qua **chính đường đọc của app** (list/detail/`GET`/HubSpot), tức *cùng một stack vừa ghi tự nói là đã ghi*.

Năng lực thì có sẵn và chặt: `uatPgClient.ts` mở `BEGIN TRANSACTION READ ONLY` (Postgres tự chặn INSERT/UPDATE/DDL kể cả khi DB user full quyền), lint chặn `pg_read_file`/`lo_export`/`EXPLAIN ANALYZE`/stacked query, `statement_timeout`, allowlist host. `RULE_GLOBAL` cũng đã cho phép ("DB là oracle **PHỤ**"). Khoảng trống nằm đúng ở chỗ: **lúc gen không có chiều nào bắt nghĩ tới**.

**Added — prompt gen §13b "Bền vững dữ liệu sau mutation"**
- **KHÔNG tạo TC riêng cho việc kiểm DB** — chỉ thêm một dòng verification (`db_readonly: SELECT … FROM … WHERE …` + kết quả cụ thể) vào chính case create/edit/delete đã có. Rải khắp nơi làm test dính schema, đổi tên cột là gãy hàng loạt.
- Chỉ **5 tình huống** kích hoạt, đều là chỗ UI/API *không thể* phân biệt: **soft vs hard delete** (xoá xong UI hết thấy và `GET` 404 y hệt nhau ở cả hai kiểu) · **cascade/bản ghi mồ côi** (màn cha không hiển thị bản ghi con) · **field không render** (`sync_status`, cột audit) · **ghi trùng** (lưới có phân trang/sort/filter nên dễ không thấy; `count(*)` thấy ngay) · **trường dẫn xuất lệch bản ghi gốc** (đúng lớp bug ledger 1 giao dịch mà `total_due` trừ 2 lần).
- Ranh giới giữ nguyên: read-only qua guarded client, **không** dựng state, **không** phải evidence, **không** thay oracle từ spec, mask PII. Kèm cảnh báo ngược: **DB đúng ≠ sản phẩm đúng** — assert DB xanh rất dễ ru ngủ và che bug FE, nên nó **bổ sung** chứ không thay assert trên UI.
- §9 `Setup Verification` thêm con trỏ phân biệt "verify tiền điều kiện đã dựng xong" vs "verify kết quả sau mutation".

**Added — `design_gate` cảnh báo (không chặn)**
Bộ có case **XOÁ** mà không case nào dùng `db_readonly` → nhắc §13b. Mức cảnh báo vì công cụ không biết case đó có thật sự cần xuống tầng bản ghi hay không (nhiều "xoá" chỉ là gỡ item khỏi form). Đo trước khi chọn: **11/17 bộ** có case xoá thật, cả 11 đều chưa dùng `db_readonly` — một dòng nhắc mỗi bộ, không phải tiếng ồn theo từng dòng. **Cố ý loại "huỷ/cancel"**: đo ra 111/131 case ở bộ time-off khớp chữ "huỷ" nhưng đó là chuyển TRẠNG THÁI, không phải xoá bản ghi — nếu không loại thì cảnh báo thành rác. Nghiệm thu: bộ 530 TC → cảnh báo đúng `45 case XOÁ`; bộ không có case xoá → im.

## 2026-08-12 (f) — vá advisory `brace-expansion` + khoá tên skill bằng gate

**Fixed**
- **`audit:ci` đỏ thật** (`exit 1`): `brace-expansion` dính advisory DoS (unbounded expansion → OOM). Đo hiện trạng: `low 0 · moderate 2 · **high 1** · critical 0`. `npm audit fix` xử sạch phần `high`; `package.json` **không đổi** (chỉ transitive), `package-lock.json` lệch 24 dòng. Sau vá: `high 0`, `audit:ci` exit 0. Còn 2 `moderate` trong `exceljs` — chưa chạm vì gate chỉ chặn từ `high` và bản vá của nó cần bump major.
- **Bẫy gặp khi vá, ghi lại để không mắc lại**: `npm audit fix --omit=dev` **xoá luôn devDependencies khỏi `node_modules`** (mất `typescript`, `eslint`) ⇒ `typecheck` và `lint` chuyển đỏ ngay sau đó, trông y như bản vá làm hỏng code. Không phải vậy — chạy `npm install` là khôi phục, bản vá vẫn giữ. Nếu chỉ nhìn "audit xanh rồi" mà không chạy lại toàn bộ gate thì sẽ đẩy một môi trường hỏng lên CI.
- **5/21 skill lệch frontmatter `name` với tên thư mục** (`git_impact_analyzer` ghi `git-impact-analyzer`, tương tự `requirements_analyzer`, `locator_healing_agent`, `qa_automation_engineer`, `learning_recorder`). Tra cứu skill dùng **tên thư mục** — đó là tên prompt/workflow/`INDEX.md` nhắc tới — nên frontmatter lệch làm người đọc file tưởng skill tên khác. Đã đồng bộ cả 5 + sinh lại `INDEX.md` (21 skill, hết cảnh báo). Kiểm trước khi sửa: không consumer nào trỏ bằng tên gạch-ngang (chỉ chính dòng cảnh báo trong `INDEX.md` và 1 comment) nên đổi là an toàn.

**Added**
- **`gate:policy` chặn skill lệch tên.** `skills_index.js` phát hiện được chuyện này từ lâu nhưng **chỉ cảnh báo, exit 0**, nên 5 skill lệch tồn đọng mãi — đúng bài học "quy ước không có máy chặn thì không tự khỏi". Blast radius sau khi dọn = 0 nên chặn là an toàn. Nghiệm thu: đổi tạm 1 skill về gạch-ngang → exit 1 kèm đúng thông báo → hoàn nguyên → xanh.

**Nghiệm thu chung:** `audit:ci` · `typecheck` · `lint` · `secret:scan` · `gate:policy` · `preflight` đều exit 0; infra 26/26.

## 2026-08-12 (e) — `knowledge/` thành dữ liệu công ty, không commit; và LICENSE sai chủ sở hữu

**Bối cảnh.** Rà `LICENSE` thì phát hiện nó vào repo từ commit baseline đầu tiên (`1dbe982`) và **chưa ai sửa**, nên vẫn mang tên chủ sở hữu của template scaffold gốc. Kiểm rộng ra thì lộ việc quan trọng hơn: **mirror GitHub đang PUBLIC** (`gh repo view` → `visibility: PUBLIC`, `licenseInfo: mit`), tức mọi thứ tracked đang công khai dưới MIT.

**Fixed**
- `LICENSE`: đặt lại chủ sở hữu → `SAPP - Nguyễn Hùng Mạnh`. **Không** đổi loại giấy phép (vẫn MIT) — đó là quyết định của chủ sở hữu, không phải việc của kit.
- **`knowledge/**` không còn được commit.** Mọi store trong đó là thông tin nội bộ của dự án đang test, không phải phần "kit": `bugs/` tiêu đề defect sản phẩm (và tên FILE sinh từ slug tiêu đề nên **chính đường dẫn đã mô tả defect**), `domain/` + `system/` business rule & bản đồ hệ thống, `locators/` selector của app, `historical_execution/` + `metrics/` lịch sử pass/fail kèm tên testcase, `examples/` là bug thật backfill từ task cũ (`SAPP-26276`) chứ không phải mẫu generic. Repo giữ lại **`SCHEMA.md`** (đã có 8 khối JSON mẫu `PROJ-123` nên hình dạng entry vẫn được tài liệu hoá) + các `.gitkeep`.
- **`index.json` cũng bị loại** — giữ nó là chỉ bịt một nửa, vì trường `file` của 44 entry `bug` chứa đúng slug tiêu đề defect. Kèm theo: `learn_bugs` **thôi ghi entry `type: 'bug'`** vào index và dọn sạch entry cũ — đã kiểm toàn bộ reader của index, **không nơi nào lọc `type === 'bug'`**, entry đó là ghi-mà-không-ai-đọc (`risk_score` và `decisions` đọc thẳng thư mục).
- **`preflight_gate`: `knowledge/index.json` từ `require` → `recommend`.** Nó là artifact SINH RA (`domain:index`/`system:index`/`decisions --index`/`learn --scan`); gate đòi một file generated + không-commit thì clone mới và CI sẽ đỏ vì thiếu **dữ liệu**, không phải thiếu **khung** — đúng kiểu false-block mà comment ngay trên manifest đã cảnh báo.

**Nghiệm thu bản clone mới** (dời sạch 72 file dữ liệu ra ngoài rồi chạy đúng bộ gate của CI): `preflight` · `lint` · `typecheck` · `secret:scan` · `gate:policy` · `risk` · `dashboard` **đều exit 0**; `risk` báo trung thực `(0 bug, 10 snapshot làm dữ liệu)` thay vì âm thầm coi như không có rủi ro. Dữ liệu đã hoàn nguyên đủ, không mất file nào (`root_causes/` và `locators/` vốn chỉ có `.gitkeep`).

**Đã soát cái gì KHÔNG lộ:** `outputs/` chỉ track `.gitkeep` (không có task data nào), `profiles/` chỉ track `task.env.example`, `reports/` không track, `secret:scan` xanh, và không có email/SĐT khách thật trong file tracked (các hit chỉ là email maintainer trong `package-lock.json` + mẫu tổng hợp `user@domain.tld`).

## 2026-08-12 (d) — rule "phải bắt API trước khi gán tầng FE/BE" có máy đứng sau

**Bối cảnh.** Khối rule phân tầng FE/BE (`RULE_GLOBAL` §Phân tầng lỗi + dòng digest G4b trong `core_rules` + mục `beVsFe` trong `verdict_taxonomy.json`) đang nằm chưa commit, và cả hai tài liệu gọi `beVsFe` là *"chi tiết máy-đọc"*. Grep ra: **không script nào đọc `beVsFe`** — nó là dữ liệu chết, còn `output_gate` thì chỉ chặn FAIL *không nêu tầng*, chứ không kiểm việc tầng đó có được **chứng minh bằng API** hay không. Tức là rule mạnh nhất của khối đang ở đúng trạng thái mà cả đợt này đi sửa: quy ước không có forcing function, lại còn tự nhận là đã có.

**Added**
- **`output_rules.lintBeVsFeLayer`** — bug có prefix `[FE]`/`[BE]` (đã gán tầng) mà description KHÔNG có dấu vết API cụ thể (method+path, `/api/v…`, `endpoint`/`swagger`/`curl`/`payload`, hoặc mã status **có từ ngữ cảnh**) ⇒ nêu ra. Lời nhắc lấy **từ `beVsFe.howTo`** trong JSON nên config thành nguồn thật, không còn là mục nằm không. Module giữ nguyên tính thuần: config **truyền vào**, không tự đọc file.
- **`output_gate.gateBugWarnings`** — kênh cảnh báo riêng cho mode bug. Cố ý **không** đổi chữ ký `gateBug` vì `bug_reporter.js` đang gọi nó và mong nhận mảng string.
- **`tests/fe/infra/bug-layer-gate.spec.ts`** (6 ca, tổng infra 26/26).

**Mức: CẢNH BÁO, không chặn — đo trước khi chọn.** Chạy luật lên **99 bug auto-bug thật** trên Jira: cả 99 đều có gán tầng, trong đó **71 (72%)** không có dấu vết API trong description. Chặn ngay là đỏ oan gần ba phần tư. Theo tiền lệ `locator_lint`: cảnh báo trước, siết sau khi thói quen đã đổi.

**Fixed (lỗi của chính luật này, do test bắt được)**
- `STATUS_CODE` bản đầu dùng `[45]\d\d` trần ⇒ **số tiền Việt `5.400.000đ` khớp cụm `400`** (đứng sau dấu chấm nên vẫn thoả `\b`) ⇒ bug chỉ nói về số tiền bị coi là "đã bắt API" và **lọt** cảnh báo. Giờ mã status phải có từ ngữ cảnh (`HTTP`/`status`/`mã lỗi`/`trả về`). Bỏ luôn `\bresponse\b` trần khỏi `API_TRACE` vì từ đó xuất hiện trong văn xuôi quá dễ. Con số blast radius báo ở trên là con số **sau** khi sửa (67% → 72%).

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
