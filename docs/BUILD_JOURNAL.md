# Dựng bộ kit này từ con số 0

> Nhật ký kỹ thuật, viết cho người muốn **tự dựng** một bộ kit QA automation tương tự — ở dự án khác,
> công ty khác. Không phải hướng dẫn sử dụng (cái đó ở [`USER_GUIDE.md`](../USER_GUIDE.md)), không phải
> danh sách thay đổi theo ngày (cái đó ở [`CHANGELOG.md`](../CHANGELOG.md)).
>
> Thứ tài liệu này trả lời: **làm theo thứ tự nào, đo bằng gì, và đã vấp ở đâu.**
>
> **NGUỒN CANONICAL** của nội dung này. Trang thư viện (`docs/library/`) render lại nó ở tab *Hành trình* —
> sửa ở đây rồi chạy `npm run library:build`, đừng sửa ngược.

<!-- meta: version="1" from="2026-07-21" to="2026-09-07" commits="291" -->

## Bối cảnh và bài học lớn nhất

Kit đi từ chỗ không có gì tới trạng thái hiện tại trong **~7,5 tuần** (17/07 → 07/09/2026, **291 commit**):
22 skill · **59 máy kiểm, 38 trong đó CHẶN thật** · 20 chiều coverage · 9 slash command · tự đóng gói và
phát hành được.

Bài học lớn nhất **không phải** danh sách công cụ, mà là **thứ tự** — và thứ tự đó không hiển nhiên:

> Không thể đo *"bộ kiểm của mình có bắt được bug không"* trước khi đã có một suite để đo.
> Nhưng nếu dựng suite mà không sớm đo năng lực phát hiện của nó, thì sẽ tích luỹ hàng nghìn testcase
> trên một giả định chưa bao giờ được kiểm — và đó đúng là chuyện đã xảy ra ở đây.

Cả hành trình chỉ là bốn nhịp lặp lại: **làm năng lực → biến luật thành máy → đo chính cái máy đó →
dọn thứ không còn đúng.** Bảy chặng dưới đây là bốn nhịp ấy chạy nhiều vòng.

---

## Chặng 1 — Làm năng lực trước, chưa có máy nào canh
<!-- era: id="nen" from="2026-07-21" to="2026-07-31" -->

**Vấn đề.** Bắt đầu từ trắng. Nhu cầu trước mắt là *làm được việc*: đọc requirement, sinh testcase, chạy
Playwright, log bug. Ở giai đoạn này quy tắc còn là văn bản dặn nhau, và điều đó chấp nhận được — chưa có
gì để canh thì chưa cần máy canh.

**Đã dựng.**
- `knowledge/` kèm schema — chỗ chứa những gì học được, để nó không mất sau mỗi task.
- `risk_score` / `risk_gate` — Risk-Based Testing: Risk = Likelihood × Impact, chấm theo module.
- **Canonical TestCase parser** (`scripts/lib/testcase/`): một parser duy nhất cho Markdown và XLSX, xoá 4 parser trùng.
- `GateEngine` (interface gate chuẩn + phép cộng dồn) · `EvidenceManager` · `QualityDecision` (GO/NO-GO).
- Bộ gate nền: `preflight_gate` · `output_gate` · `design_gate` · `test_inventory_gate` · `secret_scan` · `audit_ci`.
- `verdict_taxonomy.json` — một nguồn duy nhất cho trạng thái kết quả và ngưỡng rerun.
- **Token Broker** — giữ một phiên SPA đã login sống để lấy token tươi mỗi lần gọi API.
- Ambiguity Gate: còn chỗ mơ hồ thì **dừng, hỏi, không đoán**.

**Đo bằng.** Suite thật đầu tiên: **238 test / 53 file**, verified trên UAT.

**Bẫy đã vấp.**
- `split('|')` làm lệch cột khi ô có dấu `\|` — lý do phải có **một** parser thay vì bốn.
- Spec hạ tầng dưới `tests/support` đọc file **lúc load** làm vỡ collection toàn suite: `--list` ra
  `Total: 0`. Suite rỗng mà runner vẫn xanh — đúng lớp lỗi mà `test_inventory_gate` sinh ra để chặn.
- Token dán tay từ F12 hết hạn sau 30 phút, làm đứt mọi lượt chạy dài. SPA còn phát hiện automation rồi
  loop trang login trắng.

**Nếu bạn dựng lại.** Ba thứ nên làm **trước tất cả**, vì mọi thứ sau đều đọc qua chúng: **một** parser
canonical cho testcase · **một** file khai trạng thái kết quả · và gate chống suite-rỗng-vẫn-xanh. Ba cái
này rẻ, nhưng thêm sau thì phải sửa mọi thứ đã viết dựa trên chúng.

---

## Chặng 2 — Khép vòng học, và gắn nó vào chỗ không thể quên
<!-- era: id="vong-hoc" from="2026-08-04" to="2026-08-06" -->

**Vấn đề.** Mỗi task học được vài điều rồi mất sạch. Cụ thể hơn: `bugCount` **luôn bằng 0** nên bảng risk
chỉ còn một tín hiệu là `failRate` — tức Risk-Based Testing đang chạy trên nửa dữ liệu.

**Đã dựng.**
- `learn_task` — biến kết quả execute của một task thành KPI và snapshot theo module.
- `learn_reporter` — **Playwright reporter**, tự thu sau *mỗi* lần chạy test.
- `learn_bugs` — nạp bug từ Jira về `knowledge/bugs/`, idempotent.
- `select_tests` dùng dữ liệu học thật: xếp hạng file theo `(fail + 0.5×flaky)/runs`.

**Đo bằng.** Backfill 16 task → **12 KPI run + 9 snapshot**; dashboard từ rỗng lên **9 snapshot / 84 module**;
`risk_score` thoát cold-start. Nghiệm thu `learn_bugs` trên một task thật: **0 bug → 7 bug, 9 snapshot**.

**Bẫy đã vấp.**
- Định gắn việc thu dữ liệu vào `globalTeardown` — **không dùng được**: đo thật thì teardown chạy *trước*
  khi reporter `json` ghi `results.json`. Phải khai reporter ở **cuối** danh sách.
- `metrics_collect` đọc `results[last].status`, nhưng test `skipped` có `results` **rỗng** ⇒ **15/26 record
  thành `unknown`**, làm hỏng chính tín hiệu reliability nó sinh ra.
- `self_review` đòi KPI cả với task execute bằng script tự chế (không sinh `results.json`) ⇒ **chặn oan**.

**Nếu bạn dựng lại.** Gắn việc thu dữ liệu vào **reporter**, đừng gắn vào một lệnh phải nhớ gọi. Việc gì
phải nhớ thì sớm muộn sẽ quên, và dữ liệu học là thứ mất im lặng — không ai phát hiện ra là nó thiếu.

---

## Chặng 3 — Biến luật thành máy, và đo trước khi cắt
<!-- era: id="luat-thanh-may" from="2026-08-10" to="2026-08-14" -->

**Vấn đề.** Quy tắc đã viết đủ, nhưng không ai bị chặn khi vi phạm. Đo ra hai con số khiến cả cách nghĩ đổi:
**11 lệnh gate CHƯA TỪNG được chạy** — chúng chỉ nằm ở tầng `workflows` mà điểm vào không trỏ tới; và
**8/11 prompt bước bị mồ côi**, trong đó 4 cái không nơi nào trỏ tới. Nghĩa là ai làm đúng theo điểm vào
thì không bao giờ chạy `self-review`, `preflight`, `output_gate`, `decisions:check`.

**Đã dựng.**
- `gate:policy` — chặn lệnh gate chỉ-nằm-ở-workflow, prompt bước mồ côi, rule mồ côi, skill lệch tên.
- Bảng **"Gate bắt buộc chạy"** ở mỗi điểm vào: *khi nào · lệnh gì · nó chặn hoặc sinh ra gì*.
- `dim:coverage` — đếm case theo chiều coverage, chặn khi thiếu chiều task khai là bắt buộc.
- `doc:budget` — đo tài liệu **trước** khi đọc.
- `bug_tc_matcher` — đề xuất testcase cho bug thiếu nhãn.
- `knowledge:backup` — sao lưu những store không nạp lại được từ nguồn máy.

**Đo bằng.** **26/57 bug** đang ở diện `(unmapped)` nên log rồi vẫn không làm sâu thêm test lượt sau; sau khi
có bản đồ do người chốt: **57/57 bug có module**. Bảng risk thì **17/18 dòng đầu là phantom** — Impact cao
với 0 bug — vì cấu hình khai tên module bằng tiếng Anh trong khi dữ liệu dùng tên canonical tiếng Việt.
Quy định *đã có* trong ghi chú của file cấu hình, nhưng **không có máy kiểm**.

**Bẫy đã vấp.**
- **Hai cách tự động đã thử và LOẠI**, ghi lại để không ai làm lại: suy module từ tiêu đề bug → 9 ca
  "trông chắc", soi ra **≥4 sai rõ ràng**; bảng tra `label → module` → **5/17 label đa nghĩa**, và toàn là
  loại phổ biến nhất. Module SAI tệ hơn `(unmapped)`: nó bơm Likelihood cho module vô can mà vẫn để module
  thật mỏng. Vì vậy tool chỉ **đề xuất**, không có chế độ `--apply`.
- Suýt cắt sai kiến trúc: kế hoạch "co tầng workflows lại thành bảng neo" sẽ **xoá mất 47KB kỷ luật
  execute** — may là đo trước khi cắt.

**Nếu bạn dựng lại.** Mỗi luật viết ra phải trả lời được ngay hai câu: **máy nào chặn nó**, và **máy đó
được gọi từ điểm vào nào**. Luật không có máy là lời dặn; máy không có ai gọi thì cũng vậy. Và **đo trước
khi cắt** bất cứ tầng nào — con số hay nói ngược với trực giác.

---

## Chặng 4 — Đo chính bộ kiểm, và nhận tin xấu
<!-- era: id="do-bo-kiem" from="2026-08-17" to="2026-08-19" -->

**Vấn đề.** Kit đang **giả định** suite bắt được bug, mà chưa bao giờ chứng minh. Câu "cover đầy đủ mà vẫn
lọt" chỉ có thể phỏng đoán. Đây là chặng quan trọng nhất của cả hành trình.

**Đã dựng.**
- `mutation_check` — **negative control**: cố ý tiêm lỗi ở tầng `page.route()` (không chạm dữ liệu server)
  rồi xem máy kiểm có đỏ. 5 mutant nhắm đúng các lớp bug **đã từng lọt thật**: bóp về 0 · xoá field ·
  chia nửa · đổi kiểu số thành chuỗi · đổi nhãn.
- **5 trục mở rộng quanh case**, mỗi trục một máy: `cross_surface_diff` (cùng giá trị khác nơi hiển thị) ·
  `persistence_probe` (chuỗi form → payload → API → UI) · `fixture_matrix` (nhánh × trạng thái kế cận).
- `spec_extract` (FSD → catalog) · `spec_gap_report` (chiều ngược: build có mà tài liệu không nhắc) ·
  `figma_to_ui_contract` (biến thiết kế thành oracle máy đọc được) · `leak_report`.
- Verdict riêng cho phần mở rộng, để nó không trộn vào pass-rate của execution.

**Đo bằng.** **Mutation score = 0/4 = 0%.** Bóp giá trị thành 0, xoá hẳn, chia nửa, đổi kiểu — bộ kiểm hiển
thị **không thấy gì**. Nguyên nhân không phải máy hỏng mà là **phạm vi**: nó kiểm *kiểm kê field và nhãn*,
KHÔNG kiểm *giá trị*. Cùng lượt đo, trục "so hai bề mặt" bắt **4/4**. Kết luận có bằng chứng:
**kiểm-kê-field và kiểm-giá-trị là hai việc khác nhau; xanh cái này không nói được gì về cái kia.**

**Bẫy đã vấp.** Ba bẫy nằm ở **chính harness đo**, và cả ba đều tạo ra con số sai theo hướng nguy hiểm:
1. **Không tiêm được mà tưởng là phát hiện.** Lượt đầu 4/5 mutant "không tiêm được" vì API trả tiền dưới
   dạng **chuỗi** trong khi hàm mutate đòi `number`. Con số "0%" lúc đó là **harness hỏng**, không phải
   vùng mù thật.
2. **Tautology ở tầng harness.** Nếu route bóp cả request của app **lẫn** request xác minh thì hai bên cùng
   bị bóp, không bao giờ lệch, và trục so-hai-bề-mặt bị kết luận "không bắt được" một cách **giả**.
3. Phải phân biệt **"mutant sống sót"** với **"mutant không liên quan"** (giá trị không hiển thị trên màn
   đang kiểm) — không phân biệt thì điểm số vô nghĩa.

Cùng phiên đó tôi mắc **cùng một lỗi ở ba file** (thiếu guard `require.main === module`), nên thêm luôn một
test hạ tầng quét toàn bộ `scripts/qa/`: lỗi lặp lại thì phải có máy gác, không dựa vào nhớ.

**Nếu bạn dựng lại.** Dựng negative control **sớm**, ngay khi có suite đủ để đo — nhưng luôn **nghi con số
đầu tiên của chính harness**. Ở đây con số đầu tiên sai ba lần liên tiếp, và mỗi lần đều sai theo hướng
làm mình yên tâm hoặc hoảng loạn không đúng chỗ.

---

## Chặng 5 — Dọn công cụ: bỏ nửa vời tệ hơn không bỏ
<!-- era: id="don-cong-cu" from="2026-08-20" to="2026-08-20" -->

**Vấn đề.** Kit đang ở trạng thái "công cụ mới là đường chính, công cụ cũ là legacy có nhãn". Nghe hợp lý,
nhưng đo ra **375 chỗ** còn nhắc tên công cụ cũ trên các bề mặt làm việc. Mỗi chỗ như vậy là một **đường
mòn**: dẫn người hoặc agent đi tìm lệnh không còn tồn tại, hoặc tưởng còn hai lựa chọn để cân.

**Đã dựng.**
- Bỏ hẳn: xoá **14 file**, **1 công tắc chuyển công cụ**, **42 biến môi trường**, **9 npm script**.
- Gate **cấm cả cái tên** trên mọi bề mặt làm việc — không tha cho dòng có nhãn `legacy`.
- Thay ở những chỗ công cụ cũ có **vai trò thật**: cột traceability chuyển sang suy từ mirror; bỏ nhánh
  seed đọc API cũ; `verdict_taxonomy` bỏ một cột, còn đúng một cột.

**Đo bằng.** Việc **đầu tiên** phải làm là **đóng băng bằng chứng trước khi xoá**, vì sau khi bỏ thì không
còn nguồn để chạy lại phép đối soát: đối soát full **15/15** execution — **2103/2103 run** khớp hai đầu,
`Failed=47 · Not Run=70 · Passed=1986`. Con số đó là bản lưu cuối cùng: công cụ sinh ra nó cũng đã bị xoá.

**Bẫy đã vấp.** Chỗ công cụ cũ có vai trò thật thì phải **thay bằng thứ khác**, không phải chỉ xoá chữ —
nếu chỉ xoá thì gate xanh mà năng lực mất. Và gate cấm-tên ban đầu **bỏ sót đuôi `.sh` và `.html`**: nó báo
✓ trong khi vẫn còn vi phạm thật.

**Nếu bạn dựng lại.** Khi bỏ một công cụ: **đối soát và đóng băng bằng chứng trước**, rồi mới xoá. Và đừng
bỏ nửa vời — giữ "legacy có nhãn" nghĩa là giữ hai lối, mà hai lối thì người mới sẽ đi lối sai.

---

## Chặng 6 — Mở tầng kiểm mới, sau khi biết tầng cũ mù ở đâu
<!-- era: id="tang-moi" from="2026-08-27" to="2026-09-04" -->

**Vấn đề.** Không có case nào kiểm bản ghi thật trong database — đo được **0/1901 testcase**, và chuỗi
`db_readonly` xuất hiện **0 lần** trong toàn bộ output. Nhưng con số đáng ngại hơn nằm ở chỗ khác: trên bộ
lớn nhất (563 case) có **415 case mutation**, trong đó **177 (43%)** *có* đọc lại — nhưng đọc lại qua
**chính đường đọc của app**. Tức cùng một stack vừa ghi thì tự nói là đã ghi.

**Đã dựng.**
- Tầng kiểm DB (chiều §23): adapter Postgres · `dbVerify` · guard **chỉ đọc** · so sánh theo kiểu dữ liệu ·
  bản đồ cột ↔ field neo bằng **fixture phân biệt**.
- **9 slash command** làm điểm vào gõ được: `/phase1` `/phase2` `/rerun` `/partial-rerun` `/publish`
  `/preflight` `/gates` `/explore` `/ui-debug`.
- Skill `ui_debug_agent` — bước **khám phá DOM thật** trước khi viết locator.

**Đo bằng.** Bản đồ cột: **7 cột neo được**, **11 cột khai rõ là CHƯA neo** — khai chưa neo cũng là thông
tin, tốt hơn im lặng. `storedZone = UTC` là con số đo được, không phải giả định.

**Bẫy đã vấp.** `getByTestId` có **0 lần dùng thật** trong repo (2 chỗ khớp đều nằm trong comment giải thích
đúng chuyện này). App dựng bằng ant-design cộng Metronic nên **không phát test id** — nghĩa là tầng cuối của
chiến lược locator là **tầng chết**. Không đọc DOM thật thì agent đoán locator từ tên tính năng, và đó là
nguồn lỗi script lớn nhất ở lượt chạy đầu.

**Nếu bạn dựng lại.** Đừng thêm tầng kiểm mới trước khi trả lời được *"tầng hiện có mù chỗ nào"*. Con số
43% đọc-lại-bằng-chính-app là toàn bộ lý do tầng DB tồn tại — không có con số đó thì việc thêm nó chỉ là
cảm giác "nên có".

---

## Chặng 7 — Kit tự phát hành được, và tự liệt kê được chính mình
<!-- era: id="phat-hanh" from="2026-09-04" to="2026-09-07" -->

**Vấn đề.** Kit được phát cho nhiều dự án và sửa rất thường xuyên, mà không có số phiên bản. Ba hệ quả:
không biết dự án nào đang ở bản nào (có bản vá quan trọng cũng không có đường thông báo) · không có mốc để
quay lui · và bản phát ra không trả lời được câu hỏi duy nhất người nhận cần — *nâng bản này có phải sửa gì
ở phần riêng của dự án không*. Chỉ MAJOR/MINOR nói được điều đó; ngày tháng thì không.

**Đã dựng.**
- `version:check` · `package:kit` (đóng gói **chỉ phần dùng chung**) · `release:verify` (giải nén vào thư
  mục sạch rồi cài lại từ đầu).
- `gates:index` — **danh mục gate tự sinh từ source**, kèm mức chặn suy từ code.
- `rule` / `rule:toc` — tra quy tắc theo mục thay vì đọc cả file.

**Đo bằng.** CI: job kiểm tĩnh **527s → 24–28s**. Trace job thật nói: một lệnh audit chiếm **421s = 93%**
toàn job, còn 12 gate cộng lại chỉ **5s**. Và chỗ đáng đọc nhất: **thứ chậm chưa bao giờ là audit, mà là
audit-SAU-KHI-cài-dependency** — cùng lockfile, cùng kết quả, nhưng có `node_modules` thì mất 421s, không có
thì **1,3s**. Danh mục gate đếm được **59 máy: 38 CHẶN · 15 SINH · 6 BÁO CÁO**.

**Bẫy đã vấp.**
- Một **nút bấm-là-đỏ** trên CI: job kiểm kết nối đọc credentials từ file không được track nên trên CI
  *không thể* xanh. Vì là job thủ công, GitLab tự gán `allow_failure` ⇒ pipeline hiện vàng và lỗi im lặng.
  Cách chữa **không** phải dùng `allow_failure` để biến đỏ thành vàng — mà là để job chỉ **tồn tại** khi
  thật sự có credentials. Một nút luôn-đỏ là cách nhanh nhất dạy người ta bỏ qua CI.
- Mọi suy đoán về "CI chậm ở đâu" đều **sai**, vì đo bằng thời lượng container thay vì đọc trace từng bước.
- Bốn "phát hiện" đầu tiên của danh mục gate đều là lỗi của **bảng**, không của kit — phải hiệu chuẩn danh
  mục trước khi tin số nó đưa ra.

**Nếu bạn dựng lại.** Việc "kit tự phát hành được" nên làm **muộn** — nó chỉ có nghĩa khi đã có thứ đáng
phát. Nhưng **đánh số phiên bản** thì nên làm sớm, vì nó rẻ và không có nó thì không có đường quay lui.

---

## Sáu nguyên tắc rút ra

1. **Luật cần máy.** Quy tắc viết thành văn thì người đọc sẽ lướt, agent càng lướt. Khi phát hiện một lỗ
   hổng chất lượng, câu hỏi đầu tiên không phải "viết thêm quy định gì" mà **"cái này kiểm bằng máy được
   không"**. Đo nhiều lần đều ra cùng kết luận: lỗ hổng thường là thiếu máy kiểm, không thiếu quy định.
2. **Máy phải chạy trên nội dung thật mới tính là nghiệm thu.** Thử trên dữ liệu mẫu thì luôn xanh, vì dữ
   liệu mẫu khớp đúng giả định của người viết máy. Và phải soi **từng** cảnh báo: ở đây, nhiều lần thì phát
   hiện đầu tiên lại là lỗi của chính máy.
3. **Báo oan tệ hơn không có máy.** Gate báo oan vài lần là cả team bắt đầu bỏ qua tín hiệu đỏ — lúc đó nó
   mất tác dụng thật. Nên mặc định là cảnh báo, và chỉ nâng lên chặn khi đã đo đủ.
4. **Một nguồn cho mỗi loại thông tin.** Nơi khác chỉ được trỏ về. Tài liệu nhiều tầng thì sớm muộn trôi
   khỏi nhau, và người đọc không biết tin chỗ nào.
5. **Miễn trừ phải có lý do, và khối lạ phải bị chặn.** Allowlist không ghi lý do thì thành chỗ giấu nợ.
   Khoá viết sai trong allowlist thì vô hình với code — đó là một lớp lỗi im lặng riêng.
6. **Quyết bằng số đo, không bằng cảm tính.** Mọi lần trong hành trình này mà trực giác đi ngược con số,
   con số đúng: chỗ CI chậm, cách suy module từ tiêu đề, kế hoạch co tầng workflows, và năng lực của bộ kiểm.

## Nếu dựng lại từ 0 — thứ tự tôi khuyên

| # | Việc | Vì sao đặt ở đây |
|---|---|---|
| 1 | Một parser canonical cho testcase · một file khai trạng thái kết quả | Mọi thứ sau đọc qua chúng; thêm sau là sửa lại tất cả |
| 2 | Gate chống suite-rỗng-vẫn-xanh | Lớp lỗi không tạo tín hiệu nào, phải chặn từ đầu |
| 3 | Cấu trúc output theo task + tách credentials theo task | Rẻ lúc đầu, rất đắt khi đã chạy song song nhiều việc |
| 4 | Suite thật đầu tiên (nhỏ thôi) | Cần có thứ để đo trước khi nói về năng lực phát hiện |
| 5 | **Negative control** — tiêm lỗi xem bộ kiểm có đỏ | Càng sớm càng tốt, ngay khi bước 4 xong. Đây là chỗ dễ bỏ qua nhất và trả giá đắt nhất |
| 6 | Thu dữ liệu học gắn vào reporter | Gắn vào lệnh phải nhớ gọi thì sẽ quên |
| 7 | Gate chống lệnh và tài liệu mồ côi | Máy không ai gọi thì bằng không có máy |
| 8 | Danh mục máy tự sinh | Không liệt kê được thì không kiểm toán được |
| 9 | Đánh số phiên bản + đóng gói sạch | Làm muộn cũng được, nhưng đừng không làm |

## Điểm mù của chính tài liệu này

Ghi ra để người đọc biết chỗ nào **không** nên tin:

- **Giai đoạn phôi thai không có hồ sơ.** Commit đầu tiên trong repo là `chore(kit): clean baseline — chỉ
  khung kit, bỏ task outputs & env`, tức lịch sử trước 17/07/2026 đã bị cắt khỏi repo. Những gì xảy ra
  trước mốc đó không được dựng lại ở đây, và tôi **không** suy đoán bù vào.
- **19/59 máy không có khối "vì sao có file này".** Với những máy đó, phần lý do trong tài liệu này suy từ
  commit message chứ không trích từ nguồn — độ tin thấp hơn phần còn lại.
- **Phần lý do quyết định nằm ngoài repo.** Store `knowledge/decisions/` (lý do các kết luận QA đã chốt) là
  dữ liệu công ty, không commit — nên nó không được dùng làm nguồn cho tài liệu này.
- **Số đo là số của một dự án.** Mọi con số ở đây (0/4 mutation score, 43% đọc-lại-bằng-chính-app, 375 chỗ
  còn nhắc công cụ cũ…) đo trên đúng một dự án thật. Chúng minh hoạ **lớp vấn đề**, không phải hằng số để
  mang sang chỗ khác dùng lại.
