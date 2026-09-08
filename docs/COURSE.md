# Hướng dẫn: Tự dựng bộ kit QA + AI Agent từ con số 0

> **Định vị:** không dạy dùng kit có sẵn — dạy **tự xây** một nền tảng QA do AI agent điều phối,
> hiểu vì sao từng cơ chế tồn tại, và có kit riêng mang đi mọi dự án.

---

## Bạn sẽ dựng cái gì

Một **bộ kit** — tập hợp luật + máy kiểm để bạn giao việc kiểm thử cho AI mà vẫn tin được kết quả.

Cụ thể là thế này. Bạn bảo agent sửa cho test pass; nó sửa xong; và **máy của bạn chặn lại**:

```console
$ node scripts/qa/kiem-so-mong-doi.js tests/api/don-hang-bac.js
[kiem] ✗ CHẶN — file chứa 515000, đây là số APP đang trả, không phải số spec.
        Số mong đợi phải tính từ spec.md, không phải copy từ app.
$ echo "mã thoát = $?"
mã thoát = 1
```

Ba dòng đó là toàn bộ ý tưởng: **agent không cố ý gian lận**, nó chỉ đang làm cho test xanh theo cách nhanh
nhất. Máy chặn là thứ đứng giữa.

Hết tài liệu này bạn có ba thứ:

| Thứ | Nghĩa là |
|---|---|
| **~10 máy chặn tự viết** | Bạn hiểu từng dòng, sửa được khi nó chặn sai |
| **Một quy trình gõ được một dòng** | `/phase2 PROJ-1234` chạy đúng thứ tự, không phải nhớ 6 lệnh |
| **Con số chứng minh nó hoạt động** | Không phải "tôi thấy ổn" mà là "suite bắt được 4/5 lỗi tiêm vào" |

Và quan trọng nhất cho câu hỏi *"tôi test nhiều dự án thì sao?"*: kit tách làm **hai tầng** — tầng **chung**
mang đi mọi dự án không sửa một chữ, tầng **dự án** thì mỗi nơi khai lại một file cấu hình. Sang dự án mới
mất một buổi, không phải viết lại từ đầu.

---

## Bốn mốc dừng được

Đừng nhìn 59 giờ rồi nản. Tài liệu chia thành **bốn mốc**, và **dừng ở mốc nào cũng đã có thứ dùng được**.

| Mốc | Tới bài | Cộng dồn | Dừng ở đây bạn đã có |
|---|---|---|---|
| **① Biết nghi ngờ** | hết Bài 5 | ~9.5 giờ | Repo có máy canh · một test đỏ **đúng chỗ** · và bạn đã tận mắt thấy agent làm cho test xanh sai |
| **② Dùng được thật** ⭐ | hết Bài 13 | ~27.5 giờ | Bộ case có kết quả mong đợi truy về tài liệu · chạy tự động · có ảnh/video · mỗi lỗi biết thuộc tầng nào. **Đây là điểm áp được vào dự án thật** |
| **③ Đo được chính mình** | hết Bài 21 | ~45.5 giờ | Kit nhớ được việc đã làm, tự chấm rủi ro, và **chứng minh bằng số** rằng bộ kiểm bắt được bug |
| **④ Mang đi được** | hết Bài 29 | ~59 giờ | CI gác cổng · bản phát hành nghiệm thu được · kit chạy trên dự án thứ hai |

**Mốc ② là mốc quan trọng nhất.** Nhiều người dừng ở đó và dùng cả năm — hoàn toàn hợp lý. Mốc ③ và ④ là
khi bạn muốn *chứng minh* kit tốt lên, và muốn người khác dùng được nó.

---

## Khác gì các khoá AI Testing hiện có

| | Khoá phổ biến trên thị trường | Tài liệu này |
|---|---|---|
| Trọng tâm | Manual testing + AI hỗ trợ | **Automation + AI agent tự thực thi** |
| Kết quả | Biết dùng bộ skill được tặng | **Có kit tự xây, hiểu từng dòng** |
| Chất lượng đầu ra | Dựa vào prompt tốt | **Dựa vào cổng kiểm tra chặn được** |
| Đo hiệu quả | Cảm nhận | **Số liệu: mutation score, reliability index** |
| Còn lại được gì sau đó | Dùng được một công cụ | **Thiết kế được hệ thống chất lượng** |

**Câu hỏi cốt lõi:** AI viết test rất nhanh — nhưng làm sao biết test đó **đúng** và **thực sự bắt được bug**?

---

## Bạn làm được gì sau khi đọc hết

Làm hết tài liệu này, bạn có thể:

✅ Hiểu **6 kiểu sai âm thầm** khi để AI làm QA, và cách chặn từng kiểu bằng máy
✅ Tự xây kit AI Agent Testing riêng: rules · skills · workflows · commands · gates
✅ Biến quy tắc chất lượng thành **cổng kiểm tra chạy được** thay vì văn bản bị đọc lướt
✅ Thiết lập kỷ luật oracle — chặn AI tự lấy giá trị app làm chuẩn đối chiếu
✅ Sinh test case theo **nhiều chiều phủ** có ngưỡng định lượng theo mức rủi ro
✅ Chạy automation Playwright có bằng chứng, phân tầng lỗi, tự phục hồi locator có kiểm soát
✅ Kiểm song song **UI ↔ Database** để bắt lỗi "báo thành công nhưng lưu sai"
✅ Xây knowledge base tích luỹ, có phiên bản, tự cập nhật mô hình rủi ro
✅ **Chứng minh** bộ test có bắt được bug bằng mutation testing — không phỏng đoán
✅ Thiết lập CI/CD: gate tự chạy mọi push, regression nightly, đóng gói phát hành kit
✅ Mang kit sang dự án mới trong một buổi, không viết lại từ đầu

---

## Yêu cầu đầu vào

**Bắt buộc:** biết cơ bản về kiểm thử (test case, bug, quy trình QA) · dùng được máy tính ở mức thao tác file/terminal · Node.js 18+.
**Không bắt buộc:** biết code (tài liệu này dạy từ đầu ở mức cần thiết) · biết Playwright · biết CI/CD · **có dự án thật** — tài liệu này đi kèm [app thực hành](course/assets/app-thuc-hanh/README.md) chạy trên máy bạn.

⚠️ **Nói thẳng:** đây **không** phải kiểu "AI làm hộ, bạn ngồi xem". Bạn sẽ phải đọc code, hiểu logic
gate, và tự sửa khi nó chặn sai. Nếu chỉ muốn dùng AI viết test case nhanh hơn thì có khoá nhẹ hơn phù hợp hơn.

---

## App thực hành: bạn có gì để test ngay từ Bài 0

Cả tài liệu thực hành trên **một** app duy nhất — [Cửa hàng mini](course/assets/app-thuc-hanh/README.md), Node
thuần, `node server.js` là chạy, không cài gì.

Nó **có đúng 3 bug cài sẵn, cố ý**, mỗi bug đại diện một loại điểm mù:

| Bug | Tầng | Bộ kiểm mù vì | Bạn bắt được ở |
|---|---|---|---|
| Phí giao hàng so mốc trên số sai | backend | chỉ test dữ liệu đẹp, không test **biên** | Bài 0 (bằng tay) · Bài 9 |
| Các số trên màn hình không cộng đúng | frontend | kiểm từng trường, không kiểm **quan hệ** giữa các trường | Bài 10 · Bài 13 |
| Sửa được đơn đã xác nhận qua API | backend | chỉ test **một tầng** — giao diện đã ẩn nút | Bài 15 · Bài 16 |

Vì sao phải là app **có bug biết trước**: nếu thực hành trên app đúng hoàn toàn thì bộ kiểm của bạn luôn xanh,
và bạn không có cách nào biết nó xanh vì app đúng hay vì bộ kiểm mù — hai thứ đó cho **cùng một dấu hiệu**.
Biết trước "có 3 bug" nghĩa là bắt được 0/3 thì **lỗi ở bộ kiểm, không ở app**. Đó là **đối chứng**, và nó là
ý tưởng trung tâm của cả tài liệu này.

Nguồn phán đúng/sai là [`spec.md`](course/assets/app-thuc-hanh/spec.md) — mọi luật có mã (`BR-01`…`UI-04`).
Nói "chỗ này sai" mà không chỉ được mã luật thì chưa chứng minh được gì.

---

## Một vòng làm việc trông thế nào

Sáu chặng, đi một chiều, và **mỗi chặng có một cổng chặn**. Không qua cổng thì không sang chặng sau —
đó là toàn bộ khác biệt giữa một bộ kit và một đống script.

| # | Chặng | Bạn đưa vào | Ra được gì | Cổng chặn ở cuối chặng | Học ở |
|---|---|---|---|---|---|
| 1 | Đọc yêu cầu | tài liệu, Figma, API | bảng luật `BR-` + danh sách chỗ mơ hồ | **Ambiguity Gate** — còn mơ hồ chặn thì dừng | Bài 7–8 |
| 2 | Sinh testcase | bảng `BR-` đã chốt | bộ case canonical | **Oracle Gate** — expected không trỏ nguồn thì chặn | Bài 9–11 |
| 3 | Chạy thật | bộ case + môi trường | kết quả từng case | **Evidence Gate** — chạy rồi mà không ảnh/video thì chặn | Bài 12–13 |
| 4 | Mở rộng quanh case | case đã chạy | phát hiện ngoài kịch bản | **Gate mở rộng** — không neo mã luật thì hạ xuống `OBSERVATION` | Bài 14–15 |
| 5 | Báo lỗi | phát hiện có bằng chứng | bug có tầng lỗi | **Human gate** — người bấm, không phải máy | Bài 16 |
| 6 | Học lại | bug + kết quả lượt chạy | tri thức + điểm rủi ro mới | **Gate tri thức** — bản ghi không nguồn thì cấm ghi | Bài 17–19 |

Chặng 6 quay về chặng 1 của task sau — đó là chỗ kit **tốt lên** thay vì chỉ chạy.

---

## Cấu trúc thư mục của bộ kit

Đây là thư mục bạn có **sau khi làm hết**. Đọc trước một lượt, không cần hiểu hết — mục đích là khi bài
học nói "viết file này", bạn biết nó nằm ở đâu và cạnh cái gì. Mỗi nhánh ghi **bài nào tạo ra nó**.

```
kit-cua-toi/
├── CLAUDE.md                         ← Bài 2  · luật agent PHẢI đọc mỗi phiên (dưới 20 dòng)
├── LUAT-DAY-DU.md                    ← Bài 2  · bản luật đầy đủ; CLAUDE.md là bản rút gọn có pointer
├── README.md                         ← Bài 26 · người mới đọc là chạy được
├── CHANGELOG.md                      ← Bài 26 · kit cũng có phiên bản
├── package.json                      ← Bài 4  · khai mọi lệnh `npm run ...`
├── playwright.config.js              ← Bài 12 · 13 tuỳ chọn quyết định chất lượng
├── .gitignore                        ← Bài 5  · ba thư mục không bao giờ commit
│
├── .agent/                           ← "bộ não": luật, cấu hình, năng lực
│   ├── rules/
│   │   └── core_rules.md             ← Bài 2  · digest, canonical là LUAT-DAY-DU.md
│   ├── skills/                       ← Bài 6  · năng lực theo vai (không tự nạp)
│   ├── workflows/                    ← Bài 6  · quy trình từng phase
│   └── config/
│       ├── phan-quyet.json     ← Bài 13 · 7 phán quyết + 7 tầng lỗi + ngưỡng rerun
│       ├── chieu-phu.json   ← Bài 11 · chiều nào áp cho dự án này, `n/a` phải kèm lý do
│       ├── mo-rong-truc.json         ← Bài 14 · 7 trục + số trục tối thiểu theo mức rủi ro
│       ├── anh-xa-luu-tru.json       ← Bài 15 · một nguồn cho 3 tên gọi của cùng một trường
│       ├── knowledge-schema.json     ← Bài 18 · trường bắt buộc · 4 trạng thái · hạn tái xác nhận
│       ├── risk_model.json           ← Bài 19 · trọng số rủi ro + khối cold-start
│       ├── vong-doi-du-lieu.json     ← Bài 20 · giữ bao lâu, tỉa thế nào, kèm LÝ DO
│       ├── nguong-metrics.json       ← Bài 22 · ngưỡng khoảng cách + mốc xếp hạng độ tin cậy
│       ├── mutants.json              ← Bài 21 · các lỗi cố tình tiêm để đo suite
│       ├── ci_scope.json             ← Bài 24 · lệnh nào chạy ở đâu (một nguồn cho CI)
│       ├── env-allow.json            ← Bài 24 · biến môi trường nào được đọc, ai dựng nó
│       └── kit-layers.md             ← Bài 27 · ranh giới tầng CHUNG ↔ tầng DỰ ÁN
│
├── .claude/
│   └── commands/                     ← Bài 16 · gõ `/phase2 <MÃ>` thay vì 6 lệnh
│
├── prompt_templates/                 ← Bài 6  · bản mẫu ra lệnh cho agent
│   ├── phase1/                       ·  requirement → test case
│   └── phase2/                       ·  execute → bằng chứng → bug
│
├── scripts/
│   ├── lib/                          ← THƯ VIỆN — không tự chạy được
│   │   ├── testcase/                 ·  Bài 9  · đọc/ghi bảng testcase, xuất Excel
│   │   ├── verdict.js                ·  Bài 13 · đọc taxonomy, ánh xạ trạng thái
│   │   └── gate.js                   ·  Bài 11 · khung chung cho mọi máy chặn
│   ├── utils/                        ← MÁY TƯ VẤN — trả lời câu hỏi, KHÔNG chặn
│   │   └── do-tai-lieu.js            ·  Bài 3  · đo tài liệu → khuyến nghị chiến lược
│   └── qa/                           ← MÁY CHẶN — mỗi file tự chạy, thoát mã 0/1/2
│       ├── kiem-so-mong-doi.js       ·  Bài 1  · máy chặn đầu tiên, 12 dòng
│       ├── kiem-file-cam.js          ·  Bài 5  · tệp cấm bị git track ⇒ chặn
│       ├── gate-mo-ho.js         ·  Bài 8  · chưa chốt mơ hồ thì không cho sinh case
│       ├── gate-oracle.js            ·  Bài 10 · giá trị tính toán không trỏ nguồn ⇒ chặn
│       ├── dem_chieu.js              ·  Bài 11 · chiều bắt buộc chưa đủ ngưỡng ⇒ chặn
│       ├── gate-bang-chung.js          ·  Bài 13 · case đã chạy mà không có ảnh/video ⇒ chặn
│       ├── doi-chieu-luu-tru.js      ·  Bài 15 · so UI với nơi lưu, khoanh tầng lỗi
│       ├── gate-mo-rong.js           ·  Bài 14 · không neo được vào mã luật ⇒ OBSERVATION
│       ├── doi-soat-truong.js        ·  Bài 16 · 2xx không chứng minh mapping đúng
│       ├── kiem-domain.js            ·  Bài 17 · rule không có `nguon` ⇒ cấm ghi
│       ├── kiem-tri-thuc.js         ·  Bài 18 · chặn ở cửa ĐỌC: thiếu source · mâu thuẫn · quá hạn
│       ├── sao-luu-knowledge.js      ·  Bài 20 · đích sao lưu nằm TRONG repo ⇒ từ chối
│       ├── do-metrics.js             ·  Bài 22 · clean vs eventual + KHOẢNG CÁCH lệ thuộc retry
│       ├── sinh-dashboard.js         ·  Bài 23 · 1 tệp .html tự chứa, tự kiểm 0 host ngoài
│       ├── cham-rui-ro.js            ·  Bài 19 · tính điểm rủi ro, ép độ sâu theo band
│       ├── tiem-loi.js               ·  Bài 21 · đo chính bộ kiểm bằng tiêm lỗi
│       ├── gates-voi-toi.js          ·  Bài 24 · máy không ai gọi thì bằng không có
│       ├── chong-troi.js           ·  Bài 28 · chống luật bị trôi, allowlist chặn khối lạ
│       └── tu-soi.js            ·  Bài 11 · gọi mọi máy chặn một lượt
│
├── tests/
│   ├── support/                      ← HẠ TẦNG TEST — không phải test
│   │   ├── fixtures/                 ·  Bài 12 · dựng/dọn dữ liệu, gắn mutant
│   │   ├── factory.js                ·  Bài 12 · tạo dữ liệu qua API, prefix "IT test"
│   │   ├── evidence.js               ·  Bài 13 · chụp có khoanh đỏ, che PII
│   │   ├── video.js                  ·  Bài 13 · quay có banner từng bước
│   │   └── setup/db/                 ·  Bài 15 · cửa DUY NHẤT tới database, 4 lớp an toàn
│   ├── api/                          ← Bài 1  · test gọi thẳng API
│   ├── e2e/                          ← Bài 12 · test qua giao diện
│   └── smoke/                        ← Bài 24 · tập nhẹ chạy hàng đêm
│
├── .github/workflows/                ← Bài 24 · CI đọc ci_scope.json, KHÔNG tự liệt kê lệnh
│
├── knowledge/                        ← Bài 17-18 · bộ nhớ dự án. ⛔ KHÔNG commit
├── profiles/
│   └── <MÃ-TASK>/task.env            ← Bài 4  · URL + tài khoản theo task. ⛔ KHÔNG commit
└── outputs/                          ← kết quả mỗi lượt chạy. ⛔ KHÔNG commit
    └── tasks/<MÃ-TASK>/
        ├── test-cases/               ·  bảng case canonical đã sinh
        ├── test-results/             ·  phán quyết từng case + tầng lỗi
        └── evidence/                 ·  ảnh và video
```

**Ba chỗ người mới hay xếp sai** — phân biệt bằng một câu hỏi, không bằng cảm giác:

| Thư mục | Chứa gì | Câu hỏi phân loại |
|---|---|---|
| `scripts/lib/` | thư viện, code dùng chung | *"Gõ `node <file>` có chạy được không?"* **Không** ⇒ vào `lib/` |
| `scripts/qa/` | máy chặn, tự chạy được | **Có**, và nó **báo lỗi rồi thoát khác 0** ⇒ vào `qa/` |
| `tests/support/` | hạ tầng test, không phải test | Không có `test(...)` trong file ⇒ vào `support/` |

**Ba thư mục ⛔ không bao giờ commit**, và lý do khác nhau:

| Thư mục | Vì sao |
|---|---|
| `knowledge/` | dữ liệu nghiệp vụ của công ty — và **chính tên file** đã tiết lộ lỗi sản phẩm (Bài 5) |
| `profiles/*/task.env` | tài khoản, mật khẩu, token |
| `outputs/` | kết quả từng lượt chạy, đổi liên tục, và chứa ảnh có thể có dữ liệu khách |

> Bạn **không phải tạo cây này ngay**. Mỗi bài tạo đúng phần của nó, và mỗi bài giảng đều kết thúc bằng khối
> **"Cây thư mục sau bài này"** để bạn đối chiếu xem mình có đang đi đúng đường không.

---

## PHẦN 1 — Nền tảng tư duy (5.5 giờ)

> **Xong phần này bạn có:** một máy chặn 12 dòng chạy được — và bạn đã tận mắt thấy agent làm cho test xanh trong khi app vẫn sai

### [Bài 0 — Trước khi bắt đầu](course/truoc-khi-bat-dau.md) *(1h · dễ)*

*Có gì trong tay: chưa có gì.*

- Kiểm Node.js và đọc được thông báo lỗi khi thiếu — mỗi bước có khối *"Bạn sẽ thấy"* và bảng xử lý khi thấy khác
- Chạy app thực hành, mở trên trình duyệt, hiểu vì sao cần **hai** cửa sổ terminal
- **Thực hành:** tạo một đơn hàng bằng tay, tự tính kết quả từ `spec.md`, và **tìm ra bug đầu tiên ở phút thứ 40** — không dùng công cụ nào
- 10 từ vựng của cả tài liệu này, mỗi từ **một ví dụ lấy từ việc vừa làm**, không phải một định nghĩa
- **Cây thư mục toàn kit xem trước** — mỗi nhánh ghi rõ bài nào tạo ra nó
- Phân biệt `scripts/lib` (thư viện) · `scripts/qa` (máy chặn) · `tests/support` (hạ tầng test) bằng một câu hỏi
- Ba thư mục không bao giờ commit và vì sao

### [Bài 1 — Vì sao "prompt giỏi" là không đủ](course/vi-sao-can-bo-kit.md) *(1.5h · dễ)*

*Có gì trong tay: app thực hành đang chạy, 10 từ vựng.*

- Ba giới hạn của manual và automation truyền thống: test đủ mà vẫn lọt bug · AI sinh nhanh nhưng không ổn định · việc lặp ngốn thời gian
- **6 kiểu sai âm thầm khi AI làm QA:** oracle tự thoả mãn · đọc lướt rule · false-green · flaky chôn bug thật · học dữ liệu sai · gate không được gọi
- **Thực hành:** viết test tự động đầu tiên (15 dòng, không cài gì) bắt đúng bug đã tìm ở Bài 0
- **Thực hành:** bảo agent *"sửa cho nó pass đi"* và **xem nó gian lận trên máy mình** — 3 kiểu: đổi số mong đợi · lấy số mong đợi từ chính app · nới điều kiện
- Câu hỏi một-dòng phát hiện test vô nghĩa: *"nếu app sai, dòng này có đỏ không?"*
- Tự chứng minh **dặn dò trong prompt không đảm bảo** — chạy 3–4 lần cho ra kết quả khác nhau
- **XÂY gate:** máy chặn đầu tiên (12 dòng), thử 3 lần ra 3 mã thoát — `0` đạt · `1` chặn · `2` không đo được
- Nguyên tắc xuyên suốt tài liệu: **rule không phải lời dặn — sai chuẩn thì phải chặn được**
- Phân biệt: AI hỗ trợ tester → AI agent thực thi → nền tảng có gate

### [Bài 2 — Kiến trúc một QA platform](course/khung-kit-toi-thieu.md) *(1.5h · dễ)*

*Có gì trong tay: một máy chặn 12 dòng, kinh nghiệm thấy agent gian lận.*

- 5 lớp: bộ não (rules/skills/workflows) · runtime (scripts/tests) · knowledge · config · output/CI
- Vì sao tách lớp: cái gì dùng chung mọi dự án, cái gì thuộc dự án
- Vòng đời: requirement → gate → execute → evidence → bug → học lại
- Viết file **luôn-trong-ngữ-cảnh** (`CLAUDE.md`): ngắn dưới 20 dòng, chỉ chứa điều không-thương-lượng — và vì sao dài hơn là mất tác dụng
- Quy ước cô lập ngay từ đầu: mã task · thư mục output theo task · file credentials riêng theo task
- **Thực hành:** vẽ kiến trúc cho dự án của chính bạn

### [Bài 3 — Chi phí và giới hạn thật](course/chi-phi-va-gioi-han.md) *(1h · dễ)*

*Có gì trong tay: khung kit, một rule canonical.*

- Model/token/credits: cái gì đắt, cái gì rẻ, đo bằng cách nào
- Vì sao giao việc cho subagent làm **tăng** tổng token nhưng vẫn đáng
- Ngân sách tài liệu: tài liệu 300 KB thì xử lý thế nào
- Bẫy thật: tài liệu nhiều tab hoặc nhiều bản — đọc thiếu mà **không có tín hiệu nào báo**

---

## PHẦN 2 — Dựng môi trường (6 giờ)

> **Xong phần này bạn có:** repo trên GitHub, agent chạy có kiểm soát, và một máy canh không cho dữ liệu nhạy cảm lọt lên repo

### [Bài 4 — Claude Code: cài đặt và chế độ an toàn](course/moi-truong.md) *(2h · dễ)*

*Có gì trong tay: kiến trúc đã vẽ, chưa có repo.*

- Cài Claude Code, gói cần dùng, chạy prompt đầu tiên
- **Permission/approval mode** — vì sao không bao giờ để agent tự do trên source thật
- Hook: bơm context đầu phiên · chặn khi ghi file sai chuẩn
- **Thực hành:** bảo agent xoá thư mục `docs/` và **kiểm quyền có chặn nó lại** — thí nghiệm này quan trọng hơn nó nghe

### [Bài 5 — Git, GitHub/GitLab cho người mới](course/git-tu-so-0.md) *(2h · dễ)*

*Có gì trong tay: agent chạy được, có quyền đã cấu hình.*

- Git từ số 0: commit, branch, push, pull request
- Vì sao QA cần git: kit là code, test case là dữ liệu có phiên bản
- `.gitignore` và **bài học đắt nhất**: dữ liệu học chứa tên bug thật — chính đường dẫn file đã tiết lộ lỗi sản phẩm
- **Thực hành:** đưa kit của bạn lên repo, và chứng minh ba thư mục cấm không đi theo

### [Bài 6 — Prompt, Skill, Rule, Command: phân biệt và dùng đúng](course/prompt-va-token.md) *(2h · dễ)*

*Có gì trong tay: repo có kit tối thiểu.*

- **Rule** = luật bất biến · **Skill** = năng lực theo vai · **Workflow** = quy trình · **Command** = điểm vào
- Sai lầm phổ biến: nhồi tất cả vào một file 500 dòng → agent đọc lướt
- Nguyên tắc **một nguồn sự thật**: policy ở một nơi, chỗ khác chỉ trỏ tới
- Cấu trúc prompt cho việc dài: vai trò · đầu vào · ràng buộc · định dạng đầu ra · **điều kiện dừng**
- Bảng "câu không tác dụng ↔ câu có tác dụng"
- **Thực hành:** viết rule đầu tiên + skill đầu tiên cho dự án bạn

---

## PHẦN 3 — Phase 1: Requirement → Test Case (10.5 giờ)

> **Xong phần này bạn có:** bộ testcase mà kết quả mong đợi **truy được về tài liệu**, không phải lấy từ chính app

### [Bài 7 — Phân tích requirement đa nguồn](course/tu-requirement-ra-testcase.md) *(2.5h · vừa)*

*Có gì trong tay: rule, skill, prompt template.*

- Đọc Jira / Confluence / Figma / Swagger — mỗi nguồn cho gì, thiếu gì
- **Vì sao 3 nguồn rời rạc không thể RAG chung**: Swagger có cấu trúc · Figma là cây node · chỉ Confluence là văn xuôi
- Gom theo **tính năng**, không theo nguồn — và phơi ra `conflicts` / `gaps`
- Bóc requirement thành hai thứ dùng được: **phạm vi** và **business rule kiểm được** (mã `BR-`)
- Ba dấu hiệu testcase **không execute được**: thiếu dữ liệu cụ thể · expected không đo được · tiền điều kiện mơ hồ
- **Thực hành:** phân tích một requirement thật của bạn, hoặc [tài liệu đặc tả mẫu](course/assets/sample-requirement.md) có **10 vấn đề cài sẵn**

### [Bài 8 — Ambiguity Gate: dừng đúng lúc](course/ambiguity-gate.md) *(1.5h · vừa)*

*Có gì trong tay: một requirement đã bóc thành BR-.*

- Vì sao agent gặp mơ hồ sẽ **đoán** — và đoán sai thì cả bộ test case sai theo
- Phân mức Blocking / Non-blocking, xuất Q&A đánh số kèm assumption đề xuất
- **XÂY gate:** chặn không cho sang bước sinh test case khi chưa chốt
- **Thực hành:** dựng Ambiguity Gate cho dự án bạn

### [Bài 9 — Kỹ thuật thiết kế test case](course/mo-hinh-testcase-canonical.md) *(3h · vừa)*

*Có gì trong tay: requirement đã chốt, không còn mơ hồ blocking.*

- 7 nhóm kỹ thuật: miền giá trị (EP/BVA) · logic (decision table, state transition) · tổ hợp (pairwise) · kinh nghiệm (error guessing) · thời gian & môi trường · phi chức năng
- **Nhóm hay bị bỏ nhất:** concurrency · idempotency · ordering · timezone · volume · persistence
- Mô hình testcase **canonical**: tập cột bắt buộc (tài liệu này dùng 7) và vì sao **mỗi** cột tồn tại
- Vì sao chỉ được có **một** bộ đọc testcase dùng chung cho Markdown và Excel
- Phân biệt **Ưu tiên** (thứ tự làm) với **Severity** (hậu quả) — và vì sao severity là thuộc tính của *bug*, không phải của *testcase*
- Bẫy thật: tách cột bằng dấu `|` làm lệch dữ liệu khi trong ô có ký tự thoát
- Chia thành **chiều phủ** (dimension) để kiểm được bằng máy
- **Thực hành:** sinh test case theo 8 chiều cho màn Tạo đơn hàng của app thực hành — bộ này sẽ bắt được BUG-1 nếu bạn phủ đúng biên

### [Bài 10 — Kỷ luật Oracle: bài học quan trọng nhất](course/oracle.md) *(2h · khó)* ⭐

*Có gì trong tay: một bộ testcase do agent sinh.*

- Vấn đề: AI lấy chính giá trị app đang trả về làm kết quả mong đợi → test **luôn PASS** kể cả khi app sai
- Vì sao nó tệ hơn thiếu test case: nó tạo **cảm giác an toàn sai**, và càng mở rộng càng nhân lên
- Ba dạng tautology tinh vi, không chỉ dạng lộ
- Giải: mọi kết luận PASS/FAIL phải trỏ được về **quy tắc nghiệp vụ đã xác nhận**; không có nguồn → hạ xuống "quan sát", **không kết luận**
- **Nhất quán ≠ đúng** — hai màn cùng hiện một số sai thì vẫn là sai
- **Fixture phân biệt:** muốn chứng minh "trường này lấy từ nguồn nào" thì hai nguồn phải KHÁC giá trị
- **XÂY gate:** chặn test case có giá trị tính toán mà không trỏ nguồn
- **Thực hành:** sửa 5 expected yếu trong bộ của bạn thành expected có neo về tài liệu

### [Bài 11 — Gate chất lượng và đo độ phủ](course/coverage-theo-chieu.md) *(1.5h · vừa)*

*Có gì trong tay: bộ testcase có oracle neo được.*

- Ngưỡng **định lượng** thay vì nhã phân: chiều bắt buộc phải đạt ≥N case theo mức rủi ro
- Risk-based: tính điểm rủi ro từ lịch sử bug + tỷ lệ fail, rồi **ép độ sâu test** theo band
- Vì sao `n/a` phải kèm **lý do bắt buộc** — không thì mọi chiều đều thành `n/a`
- Traceability: requirement → test case → automation → bug
- **XÂY gate:** máy đếm chiều, chặn khi một chiều bắt buộc chưa đủ ngưỡng
- Khung chung cho mọi máy chặn về sau: xem [bộ gate nền](course/bo-gate-nen.md) — `lib/gate.js`, gate tồn kho, quét secret, và lệnh tự soi gộp mọi gate một lượt

---

## PHẦN 4 — Phase 2: Thực thi có kiểm soát (13 giờ)

> **Xong phần này bạn có:** test tự chạy được, có ảnh/video làm bằng chứng, và mỗi lỗi biết nó thuộc tầng nào

### [Bài 12 — Playwright từ số 0](course/playwright-va-locator-ben.md) *(3h · vừa)*

*Có gì trong tay: bộ testcase đã qua gate độ phủ.*

- Cấu trúc framework: Page Object · fixture · config · report
- **13 tuỳ chọn config quyết định chất lượng**: `retries` · `forbidOnly` (chống `test.only` lọt CI) · `timeout` · `fullyParallel`…
- Locator bền: ưu tiên semantic, cấm class động, cấm positional xpath — 4 mẫu locator hớ hênh kèm số đo
- **Bài học thực tế:** app không phát `data-testid` thì locator lấy từ đâu
- Tiền điều kiện: dựng state qua API/factory/hook, **không** bằng DB — xem [bài chi tiết về tiền điều kiện](course/tien-dieu-kien.md) (factory, janitor 3 lớp an toàn, và **bug ma**)
- **Thực hành:** automate case Bài 9 trên app thực hành, chạy thật, thấy nó đỏ vì BUG-1

### [Bài 13 — Bằng chứng và phân tầng lỗi](course/verdict-va-phan-tang-loi.md) *(2.5h · vừa)*

*Có gì trong tay: suite Playwright chạy được.*

- **Phân tầng lỗi** — không phải fail nào cũng là bug sản phẩm: lỗi automation · lỗi setup · lỗi môi trường · lỗi dữ liệu · bug thật
- Vì sao phân tầng sai làm mất niềm tin của đội dev
- 7 trạng thái phán quyết, và vì sao **"không phán được" KHÔNG thành PASS**
- Rerun 2–3 lần loại flaky trước khi kết luận; pass-sau-retry là `PASS_WITH_DEVIATION`, không phải `PASS`
- Screenshot / video / trace: chụp gì, khi nào, che dữ liệu nhạy cảm thế nào — xem [bài chi tiết về bằng chứng](course/evidence.md) (khoanh đỏ, che PII cả `input.value`, banner video từng bước)
- **XÂY gate:** không cho đẩy kết quả nếu lỗi chưa phân tầng, hoặc case đã execute mà không có ảnh/video
- **Thực hành:** BUG-2 của app thực hành chỉ hiện ra khi bạn chụp có khoanh đỏ và cộng thử các số trên màn

### [Bài 14 — Chống lọt bug: mở rộng quanh mỗi case](course/chong-lot-bug-7-truc.md) *(2.5h · khó)*

*Có gì trong tay: kết quả đã phân tầng, có bằng chứng.*

- Vì sao test case đầy đủ vẫn lọt: case chỉ phủ cái tài liệu nói
- **7 trục mở rộng:** field cùng khối · cùng giá trị khác nơi hiển thị · chuỗi form→API→DB→UI · biến thể · trạng thái kế cận · đồng thời · chiều ngược
- **Điều kiện sống còn:** mở rộng mà không có oracle = tautology nhân 7 lần
- Không neo được vào mã luật thì kết quả là `OBSERVATION`, không phải PASS/FAIL
- Chiều ngược `spec:gap`: thấy thứ **spec không nói gì** — không phải bug, là lỗ hổng đặc tả
- **XÂY gate:** gate độ sâu theo mức rủi ro để không nổ thời gian chạy

### [Bài 15 — Kiểm song song UI ↔ Database](course/ui-va-tang-luu-tru.md) *(2.5h · khó)*

*Có gì trong tay: bộ case đã mở rộng 7 trục.*

- 7 lỗi chỉ DB verify mới bắt: số bị làm tròn · lệch timezone · text bị cắt · xoá mềm hỏng · bảng liên quan không đổi · tạo trùng · thiếu audit
- **Mô hình an toàn 4 lớp** — và vì sao "read-only user" phải là lớp chính, không phải transaction
- Thiết kế đa DB: interface theo **ngữ nghĩa**, không theo SQL (để Mongo vào được)
- **DB là oracle phụ** — dùng để khoanh tầng lỗi: UI đúng/DB sai = bug lưu · UI sai/DB đúng = bug hiển thị
- Tiền điều kiện **không** được dựng bằng DB, dù DB đang mở
- **Thực hành:** BUG-3 của app thực hành — luật "không được sửa" chỉ thực thi được ở tầng dưới, giao diện ẩn nút không phải thực thi

### [Bài 16 — Bug report và tích hợp](course/tich-hop.md) *(2.5h · vừa)*

*Có gì trong tay: kết quả có bằng chứng, đã phân tầng, đã mở rộng.*

- Bug đủ 4 phần, có bằng chứng, che PII, chạy thử trước khi ghi thật
- **Human gate:** vì sao không bao giờ để AI tự log bug
- Nối công cụ test-management: publish một chiều, mặc định **dry-run**, cần **hai** cờ mới ghi thật
- **`2xx` KHÔNG chứng minh mapping đúng** — trường ngoài danh sách cho phép ghi bị **bỏ qua âm thầm**, giá trị ngoài thang **rơi về mặc định**
- **XÂY gate:** đối soát **từng trường** sau publish; và gate chất lượng đứng ở **cả hai** cửa — lệnh tự soi và đường publish
- Đẩy kết quả thành một cycle có lịch sử, bằng chứng neo xuống từng bước
- Cách chọn công cụ quản lý test case theo chi phí thật

---

## PHẦN 5 — Knowledge & vòng học (8 giờ)

> **Xong phần này bạn có:** kit nhớ được việc đã làm, và tự chấm chỗ nào rủi ro cao để test sâu hơn ở đó

### [Bài 17 — Một QA agent cần học những gì](course/bo-nho-du-an.md) *(2h · vừa)*

*Có gì trong tay: một task đã đi trọn vòng, có bug đã log.*

- 6 nhóm tri thức: nghiệp vụ · hệ thống · lịch sử lỗi · tài sản test · quy ước team · quyết định đã ra
- Phân biệt **năng lực** (dạy một lần, ở rules) và **kinh nghiệm** (tích luỹ, ở knowledge)
- Vì sao thiếu nhóm "nghiệp vụ" thì **không thể** có oracle đúng
- **Câu trả lời cho "từ số 0 thì học từ đâu":** 4 nguồn — bảng `BR-` đã có từ Bài 7 · câu trả lời BA từ Ambiguity Gate · seed từ lịch sử Jira · **rỗng có kiểm soát**
- **XÂY gate:** chặn rule không có `nguồn`, cảnh báo khi nghi có PII

### [Bài 18 — Thiết kế knowledge base có kỷ luật](course/knowledge-base-co-ky-luat.md) *(2.5h · vừa)*

*Có gì trong tay: knowledge base đã có vài chục bản ghi.*

- Schema: `source` rỗng thì **cấm ghi** · `version` + `supersedes` · `covered_by` để truy vết ngược
- **4 trạng thái vòng đời** và khác biệt tinh: `superseded` (nghiệp vụ đổi, kết quả cũ vẫn giá trị) ≠ `invalid` (sai từ đầu, kết quả cũ mất giá trị)
- Chống học sai: phát hiện mâu thuẫn · cảnh báo tri thức quá cũ · tái xác nhận định kỳ
- **Bảo mật:** vì sao knowledge không được commit lên repo công khai
- **XÂY gate:** kiểm tính nhất quán của knowledge trước khi agent được đọc nó

### [Bài 19 — Vòng học khép kín](course/risk-based-testing.md) *(2h · khó)*

*Có gì trong tay: knowledge base có kỷ luật, lịch sử vài lượt chạy.*

- chạy → ghi kết quả → tính lại rủi ro → đổi độ sâu test lần sau
- Error Guessing từ bug lịch sử: mọi lỗi từng xảy ra phải có test case canh
- **Khi chưa có lịch sử bug:** 5 tín hiệu thay thế cho Likelihood, và chế độ cold-start **chỉ cảnh báo, không chặn**
- Bẫy hàng-ma: module có Impact cao mà 0 bug — chỉ nổ khi **cả hai** tín hiệu xuất hiện, không phải một
- Vì sao suy luận bug→module **không có** chế độ `--apply`: đo được đúng 40%
- **Điều không tự động hoá được:** xác nhận của con người — và vì sao đó là cố ý

### [Bài 20 — Sao lưu và vòng đời dữ liệu](course/sao-luu-va-vong-doi-du-lieu.md) *(1.5h · dễ)*

*Có gì trong tay: vòng học đã chạy ít nhất một chu kỳ.*

- Phân biệt dữ liệu **nạp lại được** (từ Jira) và dữ liệu **do người tạo** (không nạp lại được)
- Khai ngưỡng tỉa/lưu trữ **trước khi** tích dữ liệu
- **XÂY gate:** sao lưu thoát mã 2 nếu đích sao lưu nằm **trong** repo
- Chia sẻ knowledge khi team đông lên

---

## PHẦN 6 — Chứng minh hiệu quả (5 giờ)

> **Xong phần này bạn có:** con số chứng minh bộ kiểm của bạn bắt được bug — thay cho câu "tôi thấy ổn"

### [Bài 21 — Mutation Testing: đo suite có bắt được bug không](course/do-chinh-bo-kiem.md) *(2.5h · khó)* ⭐

*Có gì trong tay: suite đã chạy nhiều lượt, có lịch sử.*

- Coverage cao **không chứng minh được gì** — bộ test có thể phủ hết mà không bắt được lỗi nào
- Tiêm lỗi vào dữ liệu trả về: đổi số tiền · đổi trạng thái · xoá trường · đổi format
- Suite vẫn xanh = **vùng mù đã được chứng minh**, không còn phỏng đoán
- **Ba cái bẫy của chính máy đo**, cả ba đều cho ra số đẹp giả: nền đỏ ⇒ 100% giả · mutant không tiêm được ⇒ điểm thấp giả · `retries` bật ⇒ tín hiệu nhoè
- Đọc **điểm 0** cho đúng: loại 4 nguyên nhân trước khi kết luận suite mù
- Đọc **điểm 5/5** cho đúng: nó chỉ nói về tập mutant của bạn
- **Thực hành:** chạy mutation trên module của bạn, đọc mutation score, sửa một oracle rồi **đo lại để chứng minh** nó có tác dụng

### [Bài 22 — Metrics và độ tin cậy](course/metrics-va-do-tin-cay.md) *(1.5h · vừa)*

*Có gì trong tay: mutation score gốc đã chốt.*

- Clean pass rate ≠ eventual pass rate — khoảng cách giữa hai đường là **mức lệ thuộc retry**
- Reliability index theo từng test, phân hạng, quarantine
- Vì sao flaky triage có thể **chôn bug thật**, và cách phân biệt
- Phép đo phải liêm chính: `forbidOnly` · bỏ record `skipped` khỏi lịch sử · độ phủ theo ngưỡng tối thiểu mỗi chiều

### [Bài 23 — Dashboard và báo cáo](course/dashboard-va-bao-cao.md) *(1h · dễ)*

*Có gì trong tay: nhiều lượt chạy đã ghi metrics.*

- Xu hướng theo thời gian từ dữ liệu đã có
- Báo cáo cho stakeholder không có quyền vào công cụ
- Vì sao dashboard là **artifact**, không phải nguồn — sửa số trên dashboard là sửa bản photo

---

## PHẦN 7 — CI/CD và phát hành kit (6 giờ)

> **Xong phần này bạn có:** gate tự chạy mỗi lần push, và một bản kit đóng gói được để đưa cho người khác

### [Bài 24 — CI: biến rule thành cổng chặn thật](course/ci-dong-goi-giao-kit.md) *(2.5h · khó)*

*Có gì trong tay: kit đầy đủ, chạy tay được trọn vòng.*

- CI/CD là gì, vì sao QA cần
- Tách đúng: **kiểm tĩnh tự động mọi push** (không chạm môi trường thật) ≠ **việc nặng phải người bấm**
- Khai phạm vi CI bằng **một nguồn** — workflow đọc từ đó, không tự liệt kê
- Chạy song song, sharding, gộp báo cáo
- **Branch protection** — bước biến CI từ "báo cho biết" thành "gác cổng"
- Bẫy: `--pass-with-no-tests` làm 0 test vẫn báo xanh
- Bẫy đắt nhất: test xanh trên máy dev vì **thừa hưởng biến môi trường** của shell, đỏ trên CI
- **XÂY gate:** đo **độ với tới** — máy đúng mà không điểm vào nào gọi thì bằng không có

### [Bài 25 — MCP Server và tự động hoá quanh công việc](course/mcp-va-tu-dong-hoa.md) *(1.5h · vừa)*

*Có gì trong tay: CI đang gác cổng.*

- Nối Jira / Slack / Telegram / Google Sheet
- Lịch chạy tự động + thông báo
- Quyền **tối thiểu**: chỉ đọc, trừ đường tạo bug
- **Ranh giới:** cái gì tự động được, cái gì bắt buộc người duyệt

### [Bài 26 — Đóng gói và phát hành kit](course/dong-goi-va-phat-hanh.md) *(2h · vừa)*

*Có gì trong tay: kit có CI, có tích hợp.*

- Vì sao kit cũng cần version và changelog
- Đóng gói sạch: tách lớp dùng chung khỏi lớp dự án, quét secret trong gói
- **Bước quan trọng nhất:** giải nén vào thư mục sạch → cài lại → chạy gate → **chứng minh bản phát hành thật sự chạy được**
- Viết `README` mà người mới đọc là chạy được — nghiệm thu bằng người thật, hoặc bằng clone sạch
- Dự án khác nhận bản mới thế nào

---

## PHẦN 8 — Áp vào dự án thật (5 giờ)

> **Xong phần này bạn có:** kit chạy trên dự án thật của bạn, và bạn biết phải làm gì khi nó chặn sai

### [Bài 27 — Mang kit sang dự án mới](course/mang-kit-sang-du-an-moi.md) *(2h · vừa)*

*Có gì trong tay: bản phát hành đã nghiệm thu.*

- Phân lớp: cái gì giữ nguyên, cái gì cấu hình, cái gì thay
- Việc tốn công nhất: khớp cơ chế đăng nhập
- **Thực hành:** dựng kit cho dự án bạn đang làm — đây là lần đầu bạn rời app thực hành

### [Bài 28 — Khi kit chặn sai](course/mot-nguon-va-may-chong-troi.md) *(1.5h · vừa)*

*Có gì trong tay: kit đang chạy trên dự án thật.*

- Gate báo đỏ mà không phải lỗi thật thì làm gì
- **Nguyên tắc:** không nới ngưỡng gate để cho qua — hoặc sửa gate, hoặc ghi miễn trừ **kèm lý do và ngày**
- Gate bắt oan thì gate **mất uy tín**, và đó là cách một kit chết
- Đối chứng âm là bắt buộc: máy nào cũng phải được thử trên một ca **biết chắc phải chặn** và một ca **biết chắc phải cho qua**
- Chống trôi: máy đọc chính khai báo của mình, và danh sách cho phép **chặn khối lạ**
- Cách đo và tinh chỉnh ngưỡng theo va chạm thực tế

### [Bài 29 — Đi tiếp sau khi làm hết](course/lo-trinh-sau-khoa.md) *(1.5h · dễ)*

*Có gì trong tay: kit chạy trên dự án thật, đã va chạm và tinh chỉnh.*

- Vì sao "dừng xây, chuyển sang dùng" là bước tiếp theo đúng
- Những thứ **không** nên thêm dù nghe hay: đa framework · công cụ trùng chức năng
- Khi nào cần: contract testing · performance engineering · observability
- Nhịp bảo dưỡng: mỗi lượt · mỗi sprint · mỗi tháng (đo lại mutation) · mỗi quý (rà **ngoại lệ** trong mọi allowlist)
- Cộng đồng và cập nhật kit dài hạn

---

## Tổng thời lượng: ~59 giờ

| Phần | Giờ |
|---|---|
| 1. Nền tảng tư duy | 5.5 |
| 2. Dựng môi trường | 6 |
| 3. Phase 1 — Test Case | 10.5 |
| 4. Phase 2 — Thực thi | 13 |
| 5. Knowledge & vòng học | 8 |
| 6. Chứng minh hiệu quả | 5 |
| 7. CI/CD & phát hành | 6 |
| 8. Áp dụng thật | 5 |

**30 bài (Bài 0 → Bài 29) · 8 phần.**

---

## Bạn có gì sau khi làm hết

- **Kit tự xây** — khoảng 10 gate cốt lõi, chạy được, hiểu từng dòng
- **Kit đầy đủ làm tham chiếu** — bản chuẩn hoá để đối chiếu và học thêm
- **[App thực hành](course/assets/app-thuc-hanh/README.md)** có 3 bug cài sẵn + [`spec.md`](course/assets/app-thuc-hanh/spec.md) làm nguồn oracle + đáp án
- [Tài liệu đặc tả mẫu](course/assets/sample-requirement.md) có 10 vấn đề cài sẵn để luyện Ambiguity Gate
- Mẫu rules · skills · workflows · commands để tuỳ biến
- Checklist 22 chiều phủ test case
- Bộ prompt mẫu cho từng phase
- Cập nhật kit dài hạn

---

## Tình trạng nội dung chi tiết

**Cả 30 bài (Bài 0 → Bài 29) đều đã có bài giảng đầy đủ** — tiêu đề bài là **link bấm được**. Cộng
4 bài chi tiết bổ trợ không đánh số ở bảng dưới, tổng cộng **34 bài giảng**.

Mỗi bài giảng đầy đủ gồm: **từ mới của bài** · các **Việc** làm theo bước, mỗi việc có khối *"Bạn sẽ thấy"*
và bảng xử lý khi thấy khác · **cây thư mục sau bài này** · bảng tự kiểm · bài tập về nhà · mục **Đào sâu**
không bắt buộc.

**Bài chi tiết bổ trợ (không đánh số)** — không phải bài trong lộ trình, mà là phần đào sâu mà một bài
có số trỏ tới. Tách ra để bài chính không phình, nhưng nội dung vẫn nằm trong tài liệu này:

| Bài chi tiết | Nội dung | Được dạy ở |
|---|---|---|
| [Viết gate đầu tiên](course/viet-gate-dau-tien.md) | Cơ chế `exit 0/1/2`, gate đầy đủ đầu tiên, 3 phép tiêm lỗi để chứng minh nó chặn thật | **Bài 8** — cùng công thức 5 câu hỏi để viết mọi gate |
| [Bộ gate nền](course/bo-gate-nen.md) | `lib/gate.js` dùng chung, gate tồn kho, quét secret, lệnh tự soi gộp mọi gate | **Bài 11** |
| [Tiền điều kiện](course/tien-dieu-kien.md) | `factory.js` (prefix `IT test` + mã task), fixture, janitor 3 lớp an toàn, và **bug ma** | **Bài 12** |
| [Bằng chứng](course/evidence.md) | Chụp có khoanh đỏ, che PII cả `input.value`, banner video từng bước | **Bài 13** |

---

## Quyết định thiết kế tài liệu này — đọc trước khi triển khai

**1. KHÔNG dạy xây cả bộ gate.** Dạy ~10 gate cốt lõi + **mẫu hình chung**, rồi tặng kit đầy đủ.
Bạn xây được thứ của mình, hiểu vì sao, và có bản xịn để lớn dần. Dạy xây hết thì bỏ dở giữa chừng.

**2. Mỗi bài phải trả lời "cơ chế này chặn kiểu sai nào".** Đây là khác biệt lớn nhất so với các khoá
khác: họ dạy *cách làm*, tài liệu này dạy *vì sao phải làm thế và không làm thì hỏng ra sao*. Kiến thức
"vì sao" mới là thứ còn lại sau 2 năm khi công cụ đã đổi.

**3. Dùng lỗi thật của chính mình làm bài học.** Ví dụ đã đưa vào bài: script crash vì thiếu `.git` khi giải
nén ZIP · probe read-only sai vì Postgres cấp quyền `TEMPORARY` cho `PUBLIC` · mục lục tự dời số dòng của
chính nó · lỗi độ ưu tiên toán tử làm một phép kiểm **không bao giờ chạy** mà vẫn báo đạt. Những lỗi này
không có trong sách, và chúng làm tài liệu này đáng tin.

**4. Nói thẳng giới hạn.** Tài liệu này khó, cần đọc code, không phải "AI làm hộ". Nói trước sẽ lọc đúng
đúng người và giảm tỷ lệ bỏ ngang.

**5. Nếu ~59 giờ quá dài:** tách thành hai chặng — **Cơ bản** (Phần 1–4, ~35h, ra được kit chạy được) và
**Nâng cao** (Phần 5–8, ~24h, knowledge + chứng minh + CI/CD + phát hành).

**6. Bổ sung so với bản khung gốc: app thực hành và Bài 0.** Lý do: đối tượng "không bắt buộc biết code,
không bắt buộc có dự án thật" thì đến Bài 1 đã không có gì để gõ. App có **3 bug biết trước** biến mọi
phép đo trong tài liệu này thành phép đo có **đối chứng** — bắt 0/3 thì biết lỗi ở bộ kiểm, không ở app.
