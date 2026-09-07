# Khoá học: Tự dựng bộ kit QA + AI Agent từ con số 0

> **Đầu ra của khoá:** bạn có một bộ kit chạy được trên dự án thật của mình — sinh testcase, execute, thu
> bằng chứng, log bug, và có **máy kiểm chặn** khi làm sai chuẩn.
>
> **Thứ tự các bài KHÔNG theo thứ tự lịch sử của một kit đã hoàn thiện**, mà theo **thứ bạn có trong tay
> ở mỗi bước**. Từ 0 thì chưa có bug lịch sử để chấm rủi ro, chưa có suite để đo năng lực phát hiện, chưa
> có bộ testcase để đếm độ phủ. Mỗi bài dưới đây vì vậy đều mở đầu bằng dòng *"Có gì trong tay"* — và
> không bài nào phụ thuộc vào dữ liệu mà bài trước chưa tạo ra.

**Đối tượng.** QA/Tester manual muốn dùng AI agent như một cộng sự có kỷ luật, và muốn hiểu bộ kit mình
dùng thay vì chỉ chạy lệnh người khác đưa.

**Cần có trước.** Đọc hiểu được JavaScript cơ bản (không cần viết được) · biết dùng terminal · có một dự án
thật để thực hành, hoặc dùng bộ mẫu của khoá.

**Không dạy trong khoá này.** Lập trình JavaScript từ đầu · kiểm thử hiệu năng và bảo mật chuyên sâu ·
vận hành hạ tầng CI/CD.

**Tổng thời lượng: 44 giờ 30 phút · 20 bài · 6 phần · 123 mục tiêu học tập.**

**Nội dung chi tiết.** **Cả 20 bài đều đã có bài giảng đầy đủ** — tiêu đề bài là **link bấm được**, kèm [tài liệu mẫu thực hành](course/assets/sample-requirement.md). Mỗi bài gồm: lý thuyết có ví dụ đo được · mã chạy được · phần thực hành theo bước · bảng tự kiểm · bài tập về nhà.

---

# PHẦN 1 — NỀN: MÔI TRƯỜNG VÀ KHUNG KIT

## [Bài 1 — Vì sao cần một "bộ kit", không phải chỉ cần prompt giỏi](course/01-vi-sao-can-bo-kit.md)

*Có gì trong tay: chưa có gì.*

✅ Phân biệt ba mức dùng AI trong kiểm thử: hỏi–đáp · AI hỗ trợ từng việc · AI agent chạy cả quy trình.
✅ Hiểu vấn đề cốt lõi khiến prompt giỏi vẫn không đủ: agent làm rất nhanh, nhưng **có xu hướng làm cho nó xanh**, và không có ký ức giữa các task.
✅ Nắm ba thứ một bộ kit bắt buộc phải giải: **kỷ luật** (không gian lận để PASS) · **bộ nhớ** (học được, dùng lại được) · **bằng chứng** (kiểm chứng lại được sau nhiều tuần).
✅ Hiểu khái niệm *forcing function*: luật chỉ có hiệu lực khi có máy chặn được, viết thành văn thì sẽ bị lướt.
✅ Nắm lộ trình cả khoá: chạy tay → testcase có chuẩn → gate máy chặn → bộ nhớ → đo được chính bộ kiểm của mình.
✅ Hiểu vì sao khoá này **không** dựng theo thứ tự lịch sử của một kit đã hoàn thiện.

**1 giờ 30 phút**

## [Bài 2 — Môi trường làm việc: Node, Git, VS Code, AI agent](course/02-moi-truong.md)

*Có gì trong tay: một máy tính trắng.*

✅ Cài Node.js bản LTS, Git, VS Code — và kiểm tra từng cái chạy đúng.
✅ Cài công cụ AI agent (Claude Code hoặc tương đương), đăng nhập, chạy prompt đầu tiên trên một thư mục thật.
✅ Hiểu và cấu hình **permission mode**: vì sao không để agent tự do ghi lên source thật ngay từ đầu.
✅ Tạo repo trên GitHub hoặc GitLab, clone về máy, commit đầu tiên.
✅ Nắm danh sách **không bao giờ commit**: `.env`, token, cookie, khoá riêng, file service-account, dữ liệu khách hàng.
✅ Thực hành: cho agent đọc một file trong repo và tóm tắt — kiểm nó có bị chặn đúng chỗ mình đã cấu hình.

**2 giờ**

## [Bài 3 — Khung kit tối thiểu: mấy thư mục và hai file quan trọng nhất](course/03-khung-kit-toi-thieu.md)

*Có gì trong tay: repo trống, agent chạy được.*

✅ Dựng cây thư mục và hiểu vai trò từng nhánh: cấu hình · rule · skill · workflow · prompt · script kiểm · test · bộ nhớ · profile theo task · output.
✅ Viết file **luôn-trong-ngữ-cảnh** (`CLAUDE.md` hoặc tương đương): ngắn dưới 20 dòng, chỉ chứa điều không-thương-lượng. Hiểu vì sao dài hơn là mất tác dụng.
✅ Viết file rule **canonical** đầu tiên, và hiểu quan hệ *canonical ↔ bản tóm*.
✅ Đặt quy ước cô lập ngay từ đầu: mã task · thư mục output theo task · file credentials riêng theo task.
✅ Hiểu vì sao ba thứ này phải làm **trước tất cả**: mọi thứ sau đều đọc qua chúng, thêm sau là phải sửa lại hết.
✅ Thực hành: yêu cầu agent làm một việc nhỏ và kiểm nó có tuân file non-negotiables.

**2 giờ**

## [Bài 4 — Prompt và token: nói cho đúng, và đo cái mình đưa vào](course/04-prompt-va-token.md)

*Có gì trong tay: khung kit, một rule canonical.*

✅ Cấu trúc prompt cho việc dài: vai trò · đầu vào · ràng buộc · định dạng đầu ra · **điều kiện dừng**.
✅ Hiểu vì sao câu "hãy cẩn thận" không có tác dụng, và loại câu nào thì có.
✅ **Ambiguity Gate**: gộp mọi chỗ mơ hồ thành một danh sách câu hỏi, dừng chờ trả lời, **không đoán**.
✅ Đo tài liệu đầu vào **trước** khi đọc: khi nào đọc thẳng, khi nào giao subagent trích ra.
✅ Bẫy thật: tài liệu nhiều tab hoặc nhiều bản — đọc thiếu mà không có tín hiệu nào báo.
✅ Thực hành so sánh: cùng một requirement, chạy prompt sơ sài và prompt có ràng buộc, đối chiếu kết quả.

**2 giờ**

---

# PHẦN 2 — TESTCASE CÓ KỶ LUẬT

## [Bài 5 — Mô hình testcase canonical](course/05-mo-hinh-testcase-canonical.md)

*Có gì trong tay: khung kit, cách viết prompt.*

✅ Chọn tập cột bắt buộc cho testcase của bạn (khoá này dùng 7 cột) và hiểu vì sao **mỗi** cột tồn tại.
✅ Hiểu vì sao chỉ được có **một** bộ đọc testcase dùng chung cho Markdown và Excel.
✅ Phân biệt **Ưu tiên** (thứ tự làm trước sau) với **Severity** (hậu quả nếu lỗi xảy ra) — và vì sao severity thực chất là thuộc tính của *bug*, không phải của *testcase*.
✅ Viết tay 10 testcase theo template, xuất ra Excel.
✅ Bẫy thật: tách cột bằng dấu `|` làm lệch dữ liệu khi trong ô có ký tự thoát.
✅ Hiểu "source of truth": khi nào Excel là nguồn, khi nào công cụ test-management là nguồn.

**2 giờ**

## [Bài 6 — Từ requirement ra testcase bằng AI agent](course/06-tu-requirement-ra-testcase.md)

*Có gì trong tay: template testcase, 10 case viết tay để so.*

✅ Bóc requirement thành hai thứ dùng được: **phạm vi** và **business rule kiểm được**.
✅ Sinh testcase bằng agent với ràng buộc định dạng, rồi đối chiếu với 10 case bạn tự viết ở bài 5.
✅ Dừng đúng lúc ở Ambiguity Gate thay vì gen bừa với giả định.
✅ Nhận ra ba dấu hiệu testcase **không execute được**: thiếu dữ liệu cụ thể · expected không đo được · tiền điều kiện mơ hồ.
✅ Thực hành trên tài liệu thật của dự án bạn, hoặc bộ tài liệu mẫu của khoá.
✅ Hiểu vì sao review của người **không** bị thay thế: agent đề xuất, người quyết coverage đủ hay chưa.

**2 giờ 30 phút**

## [Bài 7 — Oracle: dựa vào đâu mà bảo cái này sai](course/07-oracle.md)

*Có gì trong tay: một bộ testcase do agent sinh.*

✅ Hiểu **oracle độc lập**: cơ sở phán đúng/sai phải nằm ngoài hệ thống đang test, và phải trích được nguồn.
✅ Nhận diện **tautology** (lấy chính bản build làm expected) — dạng lộ và dạng tinh vi.
✅ Hiểu vì sao đây là lỗi nguy hiểm nhất: test luôn xanh, coverage đẹp, không ai nghi ngờ.
✅ **Fixture phân biệt**: muốn chứng minh "trường này lấy từ nguồn nào" thì hai nguồn phải KHÁC giá trị.
✅ Thực hành: sửa 5 expected yếu trong bộ của bạn thành expected có neo về tài liệu.
✅ Biết ghi gì khi không neo được — và vì sao "không phán được" **không** được thành PASS.

**2 giờ**

## [Bài 8 — Coverage theo chiều, không theo số lượng](course/08-coverage-theo-chieu.md)

*Có gì trong tay: bộ testcase có oracle neo được.*

✅ Hiểu hai trục của một bộ case: **module** (test ở đâu) và **chiều** (hỏi loại câu hỏi nào).
✅ Nắm các chiều hay bị bỏ trống nhất: hiển thị · công thức · dữ liệu backend trả về · guard phân quyền · đồng thời · tác dụng phụ · ảnh hưởng lan.
✅ Khai chiều nào bắt buộc cho task, và **ghi lý do** khi khai một chiều là không áp dụng.
✅ Gắn tag chiều vào tiêu đề testcase để về sau đếm được bằng máy.
✅ Tự đếm bộ của mình: đang trống hẳn chiều nào.
✅ Hiểu bẫy trung tâm: bộ phủ kín mọi module mà trống một chiều thì **vẫn trông đầy đủ**.

**2 giờ**

---

# PHẦN 3 — CHẠY THẬT VÀ BẰNG CHỨNG

## [Bài 9 — Playwright và locator bền](course/09-playwright-va-locator-ben.md)

*Có gì trong tay: bộ testcase đã review.*

✅ Cài Playwright, chạy test đầu tiên, hiểu cấu trúc một spec.
✅ Nắm chiến lược locator theo tầng ưu tiên, và **kiểm xem app của bạn có phát test id hay không** — nếu không thì tầng đó là tầng chết.
✅ **Đọc DOM thật** để tìm locator, thay vì đoán từ tên tính năng — đây là nguồn lỗi script lớn nhất ở lượt chạy đầu.
✅ Hiểu vì sao `.first()`, `.nth(N)`, click theo toạ độ, và regex quét cả trang đều là dấu hiệu "tôi không biết mình đang chạm vào cái gì".
✅ Thực hành: viết 3 test cho 3 màn, không dùng locator mơ hồ nào.
✅ Xử lý ba nguồn chập chờn phổ biến: animation chưa xong · chờ thời gian thay vì chờ trạng thái · toạ độ lấy trước khi layout ổn định.

**2 giờ 30 phút**

## [Bài 10 — Tiền điều kiện: dựng dữ liệu mà không phá môi trường](course/10-tien-dieu-kien.md)

*Có gì trong tay: 3 test chạy được.*

✅ Bốn cách dựng trạng thái: factory · hook · fixture · mock — và vì sao **không** dùng câu lệnh database.
✅ Hiểu hậu quả cụ thể của việc dựng bằng database: tạo ra trạng thái mà luồng ứng dụng thật không sinh ra được ⇒ **bug ma**.
✅ Ba mức sẵn sàng: chạy được ngay · cần Dev làm hook · chỉ làm tay được — và mỗi mức dẫn tới trạng thái kết quả nào.
✅ Viết hợp đồng tiền điều kiện: dựng thế nào · verify thế nào · dọn thế nào.
✅ Nguyên tắc **non-destructive**: xác nhận trước mỗi lượt chạm môi trường dùng chung.
✅ Dữ liệu tự tạo phải **nhận diện được** và **dọn được**, không để lại bản ghi mồ côi.

**2 giờ**

## [Bài 11 — Verdict và phân tầng lỗi](course/11-verdict-va-phan-tang-loi.md)

*Có gì trong tay: test chạy được, có dữ liệu dựng đúng luồng.*

✅ Khai **một file duy nhất** cho mọi trạng thái kết quả và ngưỡng chạy lại — không hardcode rải rác.
✅ Phân tầng lỗi khi test đỏ: lỗi sản phẩm · lỗi API · lỗi dựng dữ liệu · lỗi script · chập chờn · hạ tầng. Chỉ hai loại đầu đáng log cho Dev.
✅ **Chạy lại 2–3 lần** trước khi kết luận, và hiểu vì sao đúng con số đó.
✅ Nhận diện lỗi script: **fail lặp lại rất ổn định** nhưng làm tay theo đúng các bước thì lại đúng.
✅ Hai trạng thái rất dễ bỏ qua: *pass nhờ lệch khỏi kịch bản* (thêm wait, đổi locator cho nó chạy) và *fail chưa giải thích được cơ chế* — cả hai đều đang chôn bug thật.
✅ Log bug: đủ bốn phần, gán đúng tầng FE/BE sau khi đã đọc response thật.

**2 giờ 30 phút**

## [Bài 12 — Evidence kiểm chứng được](course/12-evidence.md)

*Có gì trong tay: kết quả chạy có verdict và tầng lỗi.*

✅ Quy chuẩn định dạng: chỉ ảnh hoặc video. Log, JSON, trace **không phải** bằng chứng.
✅ **Khoanh đỏ đúng element kèm nhãn ngắn** — hiểu vì sao ảnh chụp trơn hay bị Dev trả bug về.
✅ Biết khi nào buộc phải quay **video**: lỗi chỉ lộ qua chuỗi thao tác, cascade, xử lý bất đồng bộ, kéo thả.
✅ Mask PII, và bẫy thật: che chữ hiển thị **không** che được giá trị nằm trong ô nhập liệu.
✅ Vì sao case **PASS** cũng phải có evidence.
✅ Thực hành: chụp có highlight và quay video có banner từng bước bằng Playwright, rồi tự mở ảnh ra soi lại.

**2 giờ**

---

# PHẦN 4 — BIẾN LUẬT THÀNH MÁY

## [Bài 13 — Viết cái gate đầu tiên của bạn](course/13-viet-gate-dau-tien.md)

*Có gì trong tay: một vòng làm việc hoàn chỉnh — case, chạy, verdict, evidence. Giờ mới có thứ để canh.*

✅ Hiểu vì sao đến bài này mới viết gate: chưa có artifact thật thì gate không có gì để đọc.
✅ Viết một gate đọc artifact thật của bạn và **thoát mã 1** khi phát hiện vi phạm.
✅ Chạy nó trên **nội dung thật**, rồi soi **từng** cảnh báo: thật hay oan.
✅ Nguyên tắc: cảnh báo oan thì sửa **LUẬT**, không sửa dữ liệu cho vừa luật.
✅ **Negative control**: cố ý tiêm lỗi vào để chứng minh gate thật sự bắt được — gate chưa từng đỏ là gate chưa được nghiệm thu.
✅ Chọn mức: mặc định cảnh báo, chỉ nâng lên chặn khi đã đo đủ để chắc không báo oan hàng loạt.
✅ Hiểu vì sao **báo oan tệ hơn không có gate**: đỏ oan vài lần là cả team bắt đầu bỏ qua tín hiệu đỏ.

**2 giờ 30 phút**

## [Bài 14 — Bộ gate nền](course/14-bo-gate-nen.md)

*Có gì trong tay: một gate tự viết, đã chứng minh có răng.*

✅ Gate chống **suite rỗng vẫn xanh** — lớp lỗi nguy hiểm nhất vì nó không tạo ra tín hiệu nào.
✅ Gate kiểm đủ input và cấu hình **trước** khi chạy cả một phase.
✅ Gate soi **thiết kế** bộ testcase: đủ cột, đủ chất lượng từng dòng.
✅ Gate soi **output** trước khi đẩy lên Jira hoặc công cụ test-management.
✅ Quét secret trên các file đã được track.
✅ Nối tất cả vào **một lệnh gộp** để chạy trước khi kết thúc một task.
✅ Thực hành: cố tình làm sai từng thứ, xác nhận đúng gate nào đỏ.

**2 giờ 30 phút**

## [Bài 15 — Một nguồn, và máy chống trôi](course/15-mot-nguon-va-may-chong-troi.md)

*Có gì trong tay: bộ gate nền đang chạy.*

✅ Nguyên tắc **canonical source**: mỗi loại thông tin đúng một nguồn thật, nơi khác chỉ được trỏ về.
✅ Phân biệt canonical với bản tóm, và vì sao bản tóm được phép diễn đạt lại nhưng không được nói khác.
✅ Gate chống **mồ côi**: lệnh hoặc tài liệu không nơi nào trỏ tới thì sẽ không ai chạy — máy không ai gọi thì bằng không có máy.
✅ **Danh mục máy tự sinh từ source**: không liệt kê được thì không kiểm toán được, và không ai biết một gate đã âm thầm tụt thành cảnh báo.
✅ Allowlist (danh sách miễn trừ) phải **ghi lý do**, và **khối lạ phải bị chặn** — khoá viết sai thì vô hình với code.
✅ Thực hành: thêm một lệnh mới, xác nhận gate mồ côi bắt được, rồi nối nó vào đúng điểm vào.

**2 giờ**

---

# PHẦN 5 — BỘ NHỚ VÀ VÒNG HỌC

## [Bài 16 — Bộ nhớ dự án: làm gì khi chưa có dữ liệu nào](course/16-bo-nho-du-an.md)

*Có gì trong tay: kit có kỷ luật, nhưng chưa có ký ức.*

✅ Năm store và câu hỏi mỗi store trả lời: rule đúng là gì · hệ thống được phép làm gì · vì sao đã kết luận như thế · làm sao dựng được trạng thái đó · quirk môi trường nào hay làm test hỏng.
✅ **Chính bài này giải bài toán "từ 0 không có dữ liệu"**: seed từ lịch sử Jira có sẵn · ghi tay những rule đã được xác nhận · và chấp nhận để trống **có kiểm soát** thay vì bịa cho đầy.
✅ Hiểu vì sao bộ nhớ này là **dữ liệu công ty**: không commit, và phải sao lưu ra ngoài repo.
✅ Thu dữ liệu **tự động**: gắn vào reporter của test runner, đừng gắn vào một lệnh phải nhớ gọi.
✅ Chỉ số theo thời gian: độ tin cậy từng testcase · tỉ lệ chập chờn · cách ly test bất ổn ra khỏi luồng phán quyết.
✅ Thực hành: ghi 3 rule đã xác nhận và 1 recipe dựng state, rồi dùng lại chúng ở lượt sinh case sau.

**2 giờ 30 phút**

## [Bài 17 — Risk-Based Testing khi chưa có lịch sử bug](course/17-risk-based-testing.md)

*Có gì trong tay: bộ nhớ đã có mầm dữ liệu.*

✅ Công thức Risk = Likelihood × Impact, và mỗi vế lấy từ nguồn nào.
✅ **Xử lý cold start**: chấm rủi ro khi chưa có bug nào — dùng gì thay cho lịch sử, và khi nào thì tin được con số.
✅ Gate độ sâu theo band rủi ro: phần nguy hiểm phải sâu hơn, mặc định chỉ cảnh báo.
✅ Bẫy đo được thật: tên module trong cấu hình lệch tên trong dữ liệu ⇒ bảng rủi ro đầy **dòng ma** (điểm cao, 0 bug) trong khi module có dữ liệu thật thì rơi về mặc định.
✅ Hiểu vì sao công cụ **đề xuất** module cho bug thì không được tự ghi: gán sai module còn tệ hơn để trống.
✅ Quyền override của người, kèm nghĩa vụ ghi lý do.

**2 giờ**

---

# PHẦN 6 — TÍCH HỢP, ĐO CHÍNH MÌNH, GIAO KIT

## [Bài 18 — Tích hợp: test-management, Jira, MCP, và điểm vào gõ được](course/18-tich-hop.md)

*Có gì trong tay: kit chạy trọn vòng trên máy cá nhân.*

✅ Publish testcase lên công cụ test-management, **luôn dry-run trước** — và kiểm xem công cụ đó có API xoá hay không trước khi đẩy thật.
✅ **Đối soát từng trường sau publish**: trả về 2xx chỉ chứng minh request được nhận, không chứng minh mapping đúng.
✅ Đẩy kết quả thành một lượt chạy có lịch sử, evidence neo xuống **từng bước** của case.
✅ Đối soát độ tươi: chạy trên bản sao cũ nghĩa là chấm theo expected đã bị sửa.
✅ Cấu hình MCP server cho Jira, Google Sheet và các nguồn tài liệu.
✅ Gói trình tự "phải đọc file nào, chạy gate nào" thành **slash command** — biến thứ phải nhớ thành thứ gõ được một dòng.

**2 giờ 30 phút**

## [Bài 19 — Đo chính bộ kiểm của bạn ⭐](course/19-do-chinh-bo-kiem.md)

*Có gì trong tay: suite đã chạy nhiều lượt trên môi trường thật. Đến giờ mới đo được.*

✅ Hiểu vì sao bài này **không thể đặt sớm hơn**: cần một suite đã chạy để có cái mà đo.
✅ Dựng negative control: tiêm lỗi ở **tầng mạng** của trình duyệt — không chạm dữ liệu server, không ghi gì lên hệ thống.
✅ Chọn loại lỗi để tiêm theo đúng các lớp bug **đã từng lọt thật** ở dự án bạn: bóp giá trị về 0 · xoá hẳn trường · đổi kiểu dữ liệu · đổi nhãn.
✅ Đọc kết quả cho đúng: điểm 0 nghĩa là vùng mù đã được **chứng minh**, không còn là phỏng đoán. Và hiểu tại sao *kiểm-kê-trường* với *kiểm-giá-trị* là hai việc khác nhau.
✅ Ba bẫy của **chính harness đo**: không tiêm được mà tưởng là phát hiện · tautology ở tầng harness (bóp cả hai bên nên không bao giờ lệch) · lẫn "mutant sống sót" với "mutant không liên quan".
✅ Mở rộng quanh case thay vì chỉ bám chữ: cùng một giá trị ở hai nơi hiển thị · chuỗi lưu trữ từ form tới API tới UI · nhánh và trạng thái kế cận.
✅ Chiều ngược: **build có gì mà tài liệu không hề nhắc** — và vì sao chiều thuận một mình luôn bỏ trắng vùng đó.

**3 giờ**

## [Bài 20 — CI, đóng gói, và giao kit cho dự án khác](course/20-ci-dong-goi-giao-kit.md)

*Có gì trong tay: kit hoàn chỉnh, đã tự đo được năng lực của mình.*

✅ Quyết định CI chạy gì mỗi lần push, và vì sao CI dùng chung **không được tự chạm** môi trường thật.
✅ Không dùng `allow_failure` để biến đỏ thành vàng — **một nút luôn-đỏ là cách nhanh nhất dạy người ta bỏ qua CI**.
✅ Đo CI bằng **trace từng bước**, không bằng thời lượng container: mọi suy đoán "chậm ở đâu" đều có xác suất sai rất cao.
✅ Ranh giới **dùng chung vs riêng của dự án**, và vì sao đó là chuyện an toàn chứ không phải chuyện gọn gàng: gói mang theo cấu hình của dự án khác thì thành **oracle sai**, mà sai im lặng.
✅ Đánh số phiên bản (không dùng ngày tháng), đóng gói sạch, và **chứng minh gói chạy được từ một thư mục trắng**.
✅ Viết tài liệu nâng bản cho người nhận: changelog nói đã đổi gì, hướng dẫn nâng bản nói **phải tự sửa gì**.

🎉 **KẾT THÚC KHOÁ HỌC**

**2 giờ 30 phút**

---

## Sau khoá học

**Bạn có gì.** Một bộ kit chạy trên dự án thật · bộ testcase có oracle neo được · suite automation có locator
bền · bộ gate máy chặn đã được nghiệm thu bằng negative control · bộ nhớ dự án đang tích luỹ · và con số đo
được về năng lực phát hiện của chính bộ kiểm đó.

**Đọc tiếp.** [`BUILD_JOURNAL.md`](BUILD_JOURNAL.md) — nhật ký dựng bộ kit này trong thực tế, ghi lại thứ tự
đã đi và những chỗ đã vấp. Đọc nó **sau** khoá học sẽ hiểu; đọc trước thì chỉ là danh sách con số của
người khác.

**Điều quan trọng nhất để mang đi.** Bốn nhịp này lặp lại mãi, không có điểm kết thúc:
**làm năng lực → biến luật thành máy → đo chính cái máy đó → dọn thứ không còn đúng.**
