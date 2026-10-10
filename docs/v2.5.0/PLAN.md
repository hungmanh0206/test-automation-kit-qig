# v2.5.0 — Bảng kế hoạch G1–G4 (CHECKPOINT: chờ duyệt)

> Bước 1 của `PROMPT_v2.5.0`. Mọi hạng mục đã **grep kit trước** theo luật nền mục 9 ("có gì rồi thì không
> làm lại"), và đã đọc file nguồn của A được nêu trong từng mục.
>
> **Chưa làm gì ngoài bảng này.** Nhánh `feat/v2.5.0` đã tạo, cây sạch.

## Cách đọc cột "Làm gì"

| Mã | Nghĩa |
| --- | --- |
| **NHẬN** | Lấy của A gần như nguyên vẹn, chỉ đổi cho khớp luật B |
| **CHỈNH** | Lấy ý của A nhưng đổi bản chất một chỗ, vì nó va luật B |
| **NÂNG CẤP** | B đã có, chỉ bổ sung phần thiếu |
| **MỚI** | Cả A và B đều chưa có |
| **BỎ** | Đề xuất không làm, kèm lý do |

Cột token: ước tính phần thêm vào **phần nạp BẮT BUỘC** của một luồng. `0` nghĩa là nạp có điều kiện
hoặc chỉ là script, không vào phần bắt buộc. Gate `prompt:budget --enforce` so với `moc` nên mọi số khác 0
đều phải cắt bù.

---

## G1 — Lấy cái tốt của A bù cho B

| Mã | Kit đã có gì | Làm gì | Máy kiểm | Token |
| --- | --- | --- | --- | --- |
| **G1.1** Báo cáo release go/no-go | `results:summary` chỉ tóm tắt MỘT lượt chạy; `release:verify` kiểm bản đóng gói, không phải chất lượng test. Không có gì gộp nhiều task thành một mốc | **NHẬN** — skill `shared/release_summary` + `scripts/qa/release_summary.js`. Giữ của A: 7 tiêu chí exit chốt TRƯỚC khi xem kết quả, vùng chưa test đứng trước mọi tỉ lệ, BLOCKED/SKIP không tính PASS, manual và automation báo riêng, QA khuyến nghị chứ không quyết | Từ chối chạy khi thiếu `exit_criteria.json`, hoặc khi file đó có `mtime` SAU dữ liệu kết quả. Spec: thiếu tiêu chí · sửa tiêu chí sau kết quả · hai nguồn số mâu thuẫn phải báo ra | 0 |
| **G1.2** Phân tích lượt chạy và xu hướng | `reliability_index.js` (96 dòng, TRI theo case) và `metrics_collect.js` (146 dòng, KPI mỗi lượt) đã có. `summarize_results.js` đã tóm tắt một lượt | **NÂNG CẤP** — chỉ thêm phần thiếu: ngưỡng BLOCKED (<5% bình thường · 5–20% nêu đầu báo cáo · >20% KHÔNG kết luận chất lượng), SKIP do thao tác phá huỷ là **nợ kiểm thử** liệt kê riêng, cảnh báo dữ liệu bẩn, xu hướng giữa các lượt. Chỉ so khi **cùng nguồn TC** | Spec: BLOCKED 25% → không được kết luận chất lượng. Nguồn TC đổi giữa hai lượt → báo ra, không so số thô | 0 |
| **G1.3** Requirement và khám phá hệ thống | `requirements_analyzer` chỉ **2.840 byte** — mỏng thật. `system_mapper`, `spec_extract.js` (395 dòng) đã có | **NHẬN + CHỈNH.** Nhận của A: đọc network thụ động, 3 mức bằng chứng phân quyền (đã kiểm chứng · suy từ màn cấu hình · chưa có căn cứ), bản đồ phủ tài liệu, thứ tự ưu tiên khi nguồn mâu thuẫn, phân biệt "không đề cập" với "không áp dụng". **CHỈNH bản chất:** thứ A gọi là "UI thực tế" chỉ được làm **sự thật quan sát**, KHÔNG được làm oracle — muốn thành oracle phải qua Ambiguity Gate rồi vào `knowledge/` có người xác nhận | `domain:check` đã có "oracle ma". Thêm: ô "chưa có căn cứ" không được làm tròn thành "không có quyền" | 0 |
| **G1.3b** Danh mục requirement | B truy vết bằng `oracle_ref`; A dùng `REQ-*` | **CHỈNH** — **không thêm hệ mã thứ hai.** Chỉ thêm nhật ký đổi rule vào `knowledge/domain/CHANGELOG`: ngày · nguồn · rule · loại · TC cần xử lý. Rule bỏ thì đổi trạng thái, không xoá | `domain:check` cảnh báo rule đổi version mà không có dòng nhật ký | 0 |
| **G1.4** Review code automation | `lint:locator` đã gác locator. Không có gì chấm 6 nhóm còn lại | **NHẬN** — `scripts/qa/automation_review.js` (`auto:review`, `auto:review:enforce`), tái dùng `locator_lint.js` cho phần locator. Máy bắt được: hard sleep, `console.log` sót, locator viết thẳng trong spec, data hardcode, credential trong code, test không assertion, assertion yếu (`toHaveURL(/./)`, `length > 0`). Phần không phán được thì gắn cờ AI. Chặn bàn giao theo A: hard sleep · không assertion · XPath vị trí · lộ credential | Spec cho từng loại, kèm âm bản (fixture sạch phải xanh) | 0 |
| **G1.5** Quy ước Playwright và report | `playwright_fe.md` chỉ 1,8 KB | **NÂNG CẤP + BỎ một phần.** Thêm: Page Object, spec không gọi `page.locator` trực tiếp, chuẩn hoá khoảng trắng trước khi so text, selector dễ vỡ phải ghi chú, tên test là hành vi tiếng Việt, cấm `test.only`/`test.skip` sót, step đặt tên `Arrange:`/`Act:`/`Assert:`. **BỎ:** phần Selenium và Appium, viewport riêng cho MCP, bắt buộc Allure, luật chụp ảnh cuối test (luật 4 của B mạnh hơn) | Các quy ước đo được giao `auto:review` (G1.4) | 0 |
| **G1.6** Sinh test API từ Swagger, và mock UI | `test:api` chạy spec API; `spec_extract.js` đọc OpenAPI. Không có bộ sinh, không có lớp mock UI | **NHẬN + 3 luật mới.** Skill `phase2/api_test_generator` (bỏ phần REST Assured của A) và `phase2/ui_mocking` (`page.route`). Ba luật chống mock lệch mà **A chưa có**: response mock lấy từ `routeFromHAR` hoặc schema OpenAPI chứ không bịa · mock phải qua validate schema, sai thì CHẶN · case dùng mock gắn `[Mock]` và chỉ kết luận về FE | Gate chặn case `[Mock]` có `Loại case` là API/Database, hoặc tự nhận PASS cho phần backend | 0 |
| **G1.7** Chạy tay dễ dùng hơn | `manual-run/` đã có, chặt nhưng khó dùng | **NÂNG CẤP** — tự SKIP thao tác phá huỷ trên môi trường dùng chung (danh sách dấu hiệu trong config), fail rồi chạy tiếp (dừng khi 3 case liên tiếp fail cùng nguyên nhân hạ tầng), sổ dữ liệu đã tạo và dọn, ghi kết quả ngay sau mỗi case, báo tiến độ mỗi 5–10 case. Giữ nguyên luật B: ảnh mọi step, rerun 2–3 lần, verdict taxonomy | `manual:check` kiểm sổ dữ liệu: có bản ghi tạo ra mà không có dòng dọn và không có lý do → cảnh báo | 0 |
| **G1.8** Vòng đời retest của bug | `bug_claim.js` đã có cổng. Không có 4 trạng thái retest | **NHẬN** — `FIXED` / `NOT_FIXED` / `PARTIAL` / `CANNOT_VERIFY` khai trong `verdict_taxonomy.json`. Giữ luật của A: lịch sử retest là phần **duy nhất** được thêm vào bug sau khi đã log; mọi mục khác là bằng chứng tại thời điểm phát hiện, không sửa cho khớp build mới | `CANNOT_VERIFY` không bao giờ chuyển Backlog sang Done. Bug thiếu Build/Version → `bug:claim` CHẶN | 0 |
| **G1.9** Mỗi output class ít nhất một lần | `combinatorial_matrix` (4.410 byte) có pairwise | **NÂNG CẤP** — pairwise phủ cặp giá trị nhưng không bảo đảm phủ mọi kết quả đầu ra. Thêm luật + máy kiểm | Ma trận có output class không xuất hiện → CHẶN | 0 |

## G2 — B tốt hơn A nhưng chưa thật sự tốt

| Mã | Kit đã có gì | Làm gì | Máy kiểm | Token |
| --- | --- | --- | --- | --- |
| **G2.1** Skill mỏng | Đã đo: `flaky_test_analyzer` 1.987 B · `test_data_generator` 2.532 B · `requirements_analyzer` 2.840 B · `tc_validator` 3.846 B | **NÂNG CẤP** 5 skill theo khuôn Purpose · Khi dùng / KHÔNG dùng · Inputs · Quy trình · Decision rules · Máy kiểm · Anti-pattern. Luôn **trỏ** về rule, không chép rule vào skill | `skills:lint` của G3.3 gác khuôn này | 0 (skill nạp có điều kiện) |
| **G2.2** Evidence cho test API | Luật 4 chỉ nhận ảnh/video. `scripts/utils/evidence/` có `manifest.js`, `sanitize.js` — **chưa có** bộ render thẻ API | **NÂNG CẤP, không nới luật.** `api_card.js` tự render request và response (đã che PII) thành PNG ngay trong lúc chạy spec. **Luật 4 giữ nguyên là ảnh** — chỉ đổi cách tạo ra ảnh | `output_gate` nhận loại ảnh này cho case `Loại case = API`, và kiểm ảnh có đủ method, URL, status, khối body | 0 |
| **G2.3** Bộ nhớ khởi đầu rỗng | `seed:knowledge` + `seed:knowledge:apply` + `knowledge:backup` đã có | **NÂNG CẤP** — `knowledge:bootstrap` dựng khung `system` và `domain` từ bước khám phá (G1.3) và từ Backlog. Mọi bản ghi ở trạng thái `draft`, phải có người xác nhận mới thành `active` | Bản ghi `draft` không được dùng để kết luận | 0 |

## G3 — Cả A và B đều thiếu

| Mã | Kit đã có gì | Làm gì | Máy kiểm | Token |
| --- | --- | --- | --- | --- |
| **G3.1** Gate hợp đồng API theo OpenAPI | `spec_extract.js` (395 dòng) đọc OpenAPI; `cross_surface_diff.js` (263 dòng) so bề mặt. Chưa có validate response thật với schema | **NÂNG CẤP** — validate mọi response bắt được trong Phase 2 với schema của endpoint. Lệch thì ghi `EXPANSION_FINDING` kèm `oracle_ref` trỏ schema. Có OpenAPI thì đây là **oracle độc lập sẵn có** cho chiều §14 BEData | Spec: response lệch schema → finding có `oracle_ref`, không phải verdict case gốc | 0 |
| **G3.2** Kiểm thông báo và email | **Không có gì** (`grep mailpit/mailhog` → rỗng) | **MỚI** — adapter opt-in cho hộp thư test, làm capability verify cho `precondition_setup_planner`. Thiếu capability → `BLOCKED_SETUP` với root cause `needs_sandbox`. **Không bao giờ đọc hộp thư thật** | Spec: thiếu capability → BLOCKED_SETUP, không phải PASS | 0 |
| **G3.3** Chất lượng mô tả skill | `skills_index.js` có `--check` nhưng không chấm chất lượng mô tả | **MỚI** — `skills:lint`: mô tả ≥ 80 ký tự, có cả "dùng khi" và "KHÔNG dùng khi", có ít nhất một máy kiểm hoặc ghi rõ vì sao không có. Wikilink và đường dẫn trong skill phải tồn tại. Thêm `skill-trigger.spec.ts` offline chống trùng mô tả | Hai tầng: skill cũ chỉ cảnh báo một release | 0 |
| **G3.4** Chọn bộ regression | `select_tests.js` (129 dòng) chọn theo git diff | **NÂNG CẤP** — thêm: đề xuất smoke/regression theo risk band + lịch sử bug, gộp case trùng giữa các task, báo case automation đã ổn định đủ N lượt để đề nghị promote (vẫn cần người duyệt) | Spec cho từng phần bổ sung | 0 |
| **G3.5** Điểm vào cho người mới | `profile:create` đã có | **MỚI** — `/start` hỏi đúng 5 điều, tạo profile, chạy preflight, chỉ lệnh tiếp theo | Spec: 5 câu hỏi, và không bỏ qua preflight | **+~0,3k** cho luồng mới `start` (luồng riêng, không đụng phase1/phase2) |

## G4 — Khắc phục điểm yếu của B

| Mã | Kit đã có gì | Làm gì | Máy kiểm | Token |
| --- | --- | --- | --- | --- |
| **G4.1** Tài liệu lệch thực tế | **Đã xác nhận 2 chỗ sai**: `.agent/workflows/phase1_03_validate_export_report.md:26` ghi "Đủ 11 cột" · `phase1_generate_tc.md:54` ghi "template 11 cột". Bản đúng là **10 cột canonical** (`tc_validator/SKILL.md:16` đã ghi đúng và giải thích: Excel SAU publish mới có 11) | **CHỈNH** — sửa 2 chỗ. Đổi tên bước "publish Backlog" thành Google Sheet cho đúng việc. Skill `backlog_testcase_publisher` thêm alias `testcase_publisher`, giữ thư mục cũ làm con trỏ | **Máy chống tái phát:** mọi con số "N cột" trong `.agent/**` phải khớp số cột canonical. ⚠️ `COL` trong `model.js` là **bảng khớp tên 12 khoá**, không phải danh sách 10 cột — nên cần khai một nguồn số duy nhất trước, nếu không gate này tự nó sai | 0 |
| **G4.2** Dữ liệu dự án cũ sót ở lớp generic | **Đo được: 16 chỗ** nhắc `OPS`/`ant-design`/`Metronic` trong `.agent/**` + `prompt_templates/**` + `RULE_GLOBAL.md`; `RULE_GLOBAL.md:206` còn `CSDL-26878` | **CHỈNH** — thay bằng ví dụ trung tính, giữ số đo lịch sử nhưng bỏ tên dự án. Thêm `project_terms.deny.json` + gate quét lớp generic, gắn vào `package:kit` | Có từ cấm trong lớp generic → không đóng gói được | 0 |
| **G4.3** Luật nặng và khó học | `core_rules.md` **16.935 byte** (~4,5k token, auto-load mọi phiên). Đã kiểm: **không chỗ nào** bắt đọc cả `RULE_GLOBAL.md`; 15 file trỏ tới nó theo mục | **NÂNG CẤP** — rút `core_rules.md` về mỗi mục một dòng + con trỏ §. Đây cũng là **nguồn cắt bù chính** cho mọi hạng mục khác | `rule_parity` chứng minh không mất luật nào. **Đây là điều kiện DỪNG của prompt** | **âm** — mục tiêu cắt ≥1k |
| **G4.4** Thiếu đường cho dự án không Playwright | Không ghi gì | **CHỈNH** — README mục "Giới hạn": kit chỉ dành cho Playwright, mobile chỉ mức mobile-web. Nói thẳng thay vì để người dùng tự phát hiện | Không cần máy | 0 |

---

## Tổng token và cách cắt bù

| Luồng | Mốc hiện tại | Dự kiến thêm | Cách bù |
| --- | --- | --- | --- |
| `phase1` | 29.589 | 0 | — |
| `phase2` | 30.519 | 0 | — |
| `publish` | 8.074 | 0 | — |
| `rerun` | 10.753 | 0 | — |
| `start` (mới) | — | ~0,3k | luồng riêng, khai mốc mới lúc tạo |

**Nguyên tắc đã áp:** mọi skill và prompt mới khai `co_dieu_kien` trong `load_map.json`; nội dung dài nằm ở
workflow (không thuộc phần bắt buộc). G4.3 là nguồn bù nếu có hạng mục nào phát sinh token.

## Ba chỗ tôi đề nghị bạn quyết

1. **G4.1 cần một nguồn số cột duy nhất trước.** `COL` trong `model.js` là bảng khớp tên **12 khoá**, không
   phải danh sách 10 cột canonical. Dựng gate "mọi số N cột phải khớp canonical" mà không có nguồn số thì
   chính gate đó sai. Đề xuất: khai `canonicalColumns` trong `model.js` rồi gate đọc từ đó.
2. **G1.3 là hạng mục nặng nhất** — nguồn của A là `requirements-analyzer/SKILL.md` **58.820 byte** và
   `discover_system.md` **33.085 byte**, và phần khám phá hệ thống trùng phạm vi với **v2.6.0** (cả một bản
   dành riêng cho discovery). Đề xuất: v2.5.0 chỉ làm phần *requirement analysis*, để phần *khám phá hệ
   thống* cho v2.6.0 — tránh làm hai lần rồi phải gỡ.
3. **Thứ tự làm.** Đề xuất **G4.3 trước tiên** (rút `core_rules`), vì nó tạo ngân sách token cho mọi hạng
   mục sau. Rồi G4.1/G4.2 (sửa cái sai đang có), rồi G1, G2, G3.

## HOÃN: G3.1 (gate hợp đồng API theo OpenAPI) — chốt 11/10/2026

**Không làm ở v2.5.0.** Lý do là một phép đo cộng một câu xác nhận của chủ dự án:

- Đo 10/10/2026: **0 file OpenAPI/Swagger** trong cả 5 task; **0 spec** trong `tests/api/`; và **không
  script nào của kit parse OpenAPI** (kế hoạch ghi `spec_extract.js` đọc OpenAPI — câu đó SAI).
- Chủ dự án xác nhận 11/10/2026: *"hiện tại chưa hề có API từ swagger, tôi mới chỉ để tạm biến để sau này
  có thể dùng thôi"* — tức `OPS_SWAGGER_URL`/`LMS_SWAGGER_URL` là chỗ dành sẵn, không phải nguồn đang có.

Không có schema thì không có oracle, nên gate này sẽ **xanh mà không gác gì** — đúng lớp lỗi kit đi chặn ở
mọi chỗ khác. Và phần "so hình dạng response với build trước" thì **không phải oracle** (app so với app),
nó đã có nhà ở v2.8.0 §L dưới dạng `EXPANSION_FINDING`; làm ở đây là làm hai lần rồi phải gỡ.

**Điều kiện mở lại:** có file OpenAPI thật trong `requirements/swagger/**`, HOẶC discovery của v2.6.0 sinh
được danh mục API (`api_inventory.json`) — nguồn thứ hai còn đúng hơn, vì nó là endpoint app THẬT SỰ gọi.

⚙️ Máy nhắc: `tests/fe/infra/ui-mocking.spec.ts` neo con số 0 đó. Ngày có file OpenAPI đầu tiên, test đỏ và
người sửa buộc phải đọc lại quyết định này.

## Không có hạng mục nào tôi đề nghị BỎ

Sau khi đọc nguồn của A, không mục nào va luật B đến mức phải bỏ. Bốn chỗ va thì **chỉnh được**, và đã ghi
trong cột "Làm gì": G1.3 (UI thực tế không được làm oracle), G1.3b (không thêm hệ mã thứ hai), G1.5 (bỏ
Selenium/Appium/Allure), G1.6 (thêm 3 luật chống mock lệch mà A không có).
