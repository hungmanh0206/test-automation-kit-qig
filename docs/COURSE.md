# Tự xây Automation Test Kit từ con số 0

> **Định vị:** từ testcase đầu tiên đến một QA workflow có AI Agent hỗ trợ, và mang chính bộ kit đó
> sang dự án tiếp theo. Playwright không phải mục tiêu học, nó là công cụ để làm một việc lớn hơn.

---

## Bạn sẽ học gì ở đây

Tài liệu này không lấy Playwright làm mục tiêu học. Playwright là công cụ chúng ta sử dụng để làm một
việc lớn hơn: **tự xây một Automation Test Kit từ một thư mục rỗng.**

Bạn sẽ bắt đầu bằng một testcase rất nhỏ. Sau đó, từng vấn đề thực tế xuất hiện sẽ buộc chúng ta bổ
sung thêm một phần vào bộ kit:

```text
Testcase đầu tiên
      ↓
Configuration
      ↓
Test Data
      ↓
Fixture & Setup
      ↓
FE / API Automation
      ↓
Evidence & Report
      ↓
Requirement
      ↓
Test Design
      ↓
Coverage
      ↓
Execution
      ↓
Triage
      ↓
CI
      ↓
Knowledge & Learning
      ↓
Reusable Kit
```

Đến cuối tài liệu, thứ bạn có không chỉ là một repository chứa nhiều testcase. Bạn sẽ có một bộ kit
có thể làm nền tảng cho dự án khác.

---

## Câu hỏi xuyên suốt tài liệu

> **Một testcase chạy xanh thực sự chứng minh được điều gì?**

Application hiển thị `544000`. Test của bạn expected `544000`. Test chạy xanh.

Nhưng `544000` có thực sự đúng không?

Nếu expected được lấy từ chính giá trị application đang trả thì testcase đó chỉ chứng minh một điều:
**application bằng chính nó.** Nó chưa chứng minh application đúng requirement.

Đây là kiểu vấn đề mà chúng ta sẽ liên tục gặp trong quá trình xây bộ kit. Test chạy được chưa đủ.
Chúng ta còn phải biết:

- Expected lấy từ đâu?
- Requirement có đủ rõ không?
- Test data có đáng tin không?
- Testcase đã phủ đúng rủi ro chưa?
- Một lần Fail là lỗi sản phẩm hay lỗi automation?
- Evidence có đủ để người khác kiểm chứng không?
- AI Agent có đang sửa test đúng hay chỉ đang cố làm nó xanh?

Mỗi phần của kit được thêm vào để trả lời một trong những câu hỏi đó.

---

## Ai phù hợp với tài liệu này

Tài liệu được viết cho QA đã biết những khái niệm kiểm thử cơ bản như testcase, expected result, bug
và quy trình QA, nhưng chưa có nhiều kinh nghiệm automation.

**Bắt buộc:** biết khái niệm kiểm thử cơ bản (testcase, expected result, bug, quy trình QA) · dùng được máy tính ở mức thao tác file và terminal · Node.js 18+.
**Không bắt buộc:** kinh nghiệm Playwright · kinh nghiệm CI/CD · kinh nghiệm automation · là developer · có dự án thật. Tài liệu này đi kèm [app thực hành](course/assets/app-thuc-hanh/README.md) chạy trên máy bạn.

⚠️ **Nói thẳng:** trong quá trình học bạn sẽ đọc, chạy và sửa JavaScript ở mức cần thiết để tự xây bộ
kit. Mục tiêu không phải biến bạn thành developer. Mục tiêu là bạn đủ hiểu code để **kiểm soát
automation của chính mình**.

---

## Bạn sẽ dựng cái gì

Ở giai đoạn đầu, bộ automation chỉ biết chạy testcase:

```text
Testcase  →  Run  →  Pass / Fail
```

Khi hoàn thiện, flow sẽ trở thành:

```text
Requirement → Test Design → Automation → Execution → Evidence → Triage
    → Bug / Observation → Rerun → Knowledge  ↺
```

Ở từng điểm quan trọng, chúng ta sẽ dần xây các **Quality Gate**: những kiểm tra tự động giúp ngăn một
số kết luận sai trước khi chúng đi sang bước tiếp theo.

Ví dụ. Bạn yêu cầu AI Agent sửa một testcase đang Fail. Agent thấy application trả `544000`, nên nó
đổi expected thành `544000`. Test lập tức xanh. Nhưng bộ kit chặn lại:

```console
$ node scripts/qa/kiem-so-mong-doi.js tests/api/don-hang-bac.js
[kiem] ✗ CHẶN
        File chứa 544000 — đây là số application đang trả,
        không phải số được suy ra từ requirement.
        Expected phải có nguồn độc lập với application.
$ echo "mã thoát = $?"
mã thoát = 1
```

Đây là một nguyên tắc quan trọng của tài liệu: **AI có thể hỗ trợ thực hiện công việc QA, nhưng AI
không được tự tạo ra sự thật mà testcase dùng làm chuẩn.**

Nói rõ để bạn không chờ nhầm chỗ: máy chặn ở trên bạn viết ở **Bài 13**, khi đã có bảng testcase để nó
soi. Còn máy chặn *đầu tiên* thì có sớm hơn nhiều, ở **Bài 2**, và nó canh một chuyện khác: không cho
tệp cấm lọt lên repo. Bài 1 và Bài 4 gieo sẵn ý tưởng bằng tay trước khi có máy nào cả.

---

## Bốn mốc hoàn thành

Bạn không cần học hết toàn bộ tài liệu mới có thứ sử dụng được.

| Mốc | Tới bài | Cộng dồn | Dừng ở đây bạn đã có |
|---|---|---|---|
| ① Automation đầu tiên | hết Bài 4 | ~7.5 giờ | Một testcase automation chạy thật trên app thực hành. Quan trọng hơn: bạn đọc được vì sao nó Pass hoặc Fail, và biết cách chứng minh testcase có khả năng phát hiện lỗi |
| ② Thành Automation Test Kit ⭐ | hết Bài 11 | ~22.5 giờ | Configuration tách khỏi testcase · test data được tạo chủ động · fixture dựng và dọn precondition · FE và API automation · screenshot, video và report. Đây là mốc bộ automation đủ cấu trúc để áp dụng vào dự án thật |
| ③ Thành QA Workflow | hết Bài 17 | ~38.5 giờ | Automation không còn bắt đầu bằng locator mà bắt đầu từ requirement. Testcase truy được nguồn của expected, và một lần Failed phải được phân loại trước khi trở thành Bug |
| ④ Thành Reusable QA Kit | hết Bài 29 | ~66 giờ | Kit vào CI, đo được reliability, tích luỹ knowledge, và được đóng gói. Bài cuối không dùng lại project cũ: bạn mang kit sang dự án thứ hai với requirement, UI, API và dữ liệu khác |

Mốc ② là mốc quan trọng nhất. Dừng ở đó là một lựa chọn hợp lý, không phải làm dở: bộ kit lúc đó đã
đủ cấu trúc để dùng trong dự án thật, và ba phần sau giải quyết những câu hỏi chỉ xuất hiện khi kit
đã chạy được một thời gian.

Về mốc ④, có một tiêu chí nghiệm thu thẳng thắn: nếu sang dự án thứ hai mà vẫn phải sửa phần lớn tầng
chung, thì kit của bạn chưa thực sự dùng lại được.

---

## Bốn cấp độ

Năm phần ở mục lục là cách chia để tra. Còn thứ nên nằm trong đầu bạn khi học thì đơn giản hơn nhiều,
chỉ bốn chữ:

**Automate → Build → Control → Evolve**

| Cấp độ | Bài | Câu bạn nói được sau cấp độ này |
|---|---|---|
| **1 · AUTOMATE** | 1–4 | Tôi chạy được test và tôi hiểu kết quả của nó |
| **2 · BUILD** | 5–11 | Tôi có một Test Kit |
| **3 · CONTROL** | 12–20 | Tôi có một QA workflow được enforce trong team |
| **4 · EVOLVE** | 21–29 | Tôi mở rộng, đo được độ tin cậy, tích luỹ learning và chứng minh reuse |

Và một điều cần nói thẳng ngay đây, để bạn không tự đặt cho mình một cái đích sai:

> **Hết cấp độ 3 là đã đủ dùng trong một team thật.** Cấp độ 4 không phải phần "làm cho kit chạy
> được", nó trả lời một câu khó hơn: kit có tự đo được độ tin cậy của chính nó, mở rộng được tới đâu,
> và có tốt lên sau mỗi sprint không.

---

## Bạn làm được gì sau khi đọc hết

Làm hết tài liệu này, bạn có thể:

✅ Dựng một project automation từ thư mục rỗng: Node, Playwright, cấu trúc thư mục, lệnh chạy
✅ Tách environment và test data ra khỏi testcase, để một bộ test chạy được trên nhiều dự án
✅ Dựng tiền điều kiện bằng fixture và factory thay vì click tay, và dọn sạch sau mỗi lượt chạy
✅ Viết automation cho cả giao diện lẫn API, và biết khi nào nên dùng cái nào
✅ Chụp ảnh có khoanh đỏ, quay video từng bước, che dữ liệu khách, rồi ráp thành report đọc được
✅ Đi từ requirement ra test scenario trước khi mở trình soạn thảo
✅ Đo độ phủ theo chiều và theo rủi ro, thay vì đếm số lượng testcase
✅ Phân loại một lượt fail trước khi tạo bug: sản phẩm, test, dữ liệu, hay môi trường
✅ Đưa testcase và kết quả lên hệ quản lý test dùng chung cho cả team
✅ Dựng CI chạy gate mỗi lần push, và regression hằng đêm
✅ Xử lý test chập chờn bằng số đo, không bằng cảm giác
✅ Tích luỹ knowledge qua từng sprint để lượt chạy sau khôn hơn lượt trước
✅ Đóng gói tất cả thành một bộ kit, rồi mang sang một dự án hoàn toàn mới trong một buổi

---

## Một vòng QA mà bộ kit sẽ hỗ trợ

Toàn bộ tài liệu xoay quanh sáu chặng. Mười lăm bước ở mục đầu trang là cách kể theo **thứ bạn xây
thêm**; sáu chặng dưới đây là cách kể theo **việc bạn làm mỗi task**.

Khi kit trưởng thành, giữa các chặng xuất hiện những điều kiện kiểm soát. Trong tài liệu, chúng được
gọi là **Quality Gate**.

| # | Chặng | Bạn đưa vào | Ra được gì | Cổng chặn ở cuối chặng | Học ở |
|---|---|---|---|---|---|
| 1 | Đọc yêu cầu | tài liệu, Figma, API | bảng luật `BR-` + danh sách chỗ mơ hồ | requirement còn mơ hồ ⇒ chưa sinh testcase | Bài 12, 15 |
| 2 | Thiết kế testcase | bảng `BR-` đã chốt | bộ case có nguồn | expected không có nguồn ⇒ chưa execute | Bài 13–14 |
| 3 | Execute | bộ case + môi trường | kết quả từng case | testcase đã chạy mà không có evidence ⇒ chưa kết luận | Bài 9–11, 16 |
| 4 | Thu thập evidence | thao tác thật trên sản phẩm | ảnh có khoanh đỏ, video từng bước | evidence sai định dạng hoặc chưa che dữ liệu khách ⇒ chặn | Bài 11 |
| 5 | Triage | case đỏ | phán quyết + tầng lỗi | Failed chưa xác định được tầng lỗi ⇒ chưa tạo Bug | Bài 17, 19 |
| 6 | Học lại từ kết quả | bug + kết quả lượt chạy | tri thức + điểm rủi ro mới | knowledge không có nguồn ⇒ không được dùng cho lượt sau | Bài 26–27 |

Chặng 6 quay về chặng 1 của task sau. Đó là chỗ kit **tốt lên** thay vì chỉ chạy lại.

Mục tiêu của gate không phải làm quy trình phức tạp hơn. Mục tiêu là biến những nguyên tắc QA quan
trọng từ *"QA nên nhớ làm điều này"* thành **"nếu chưa làm điều này, hệ thống không cho đi tiếp."**

---

## Khác gì một tutorial Automation thông thường

| | Tutorial Automation thông thường | Tài liệu này |
|---|---|---|
| Điểm bắt đầu | `test('login', ...)` | Requirement |
| Mục tiêu | Viết và chạy script | Xây kết quả kiểm thử đáng tin |
| Expected | Giá trị dùng để assert | Phải truy được về nguồn |
| Khi test đỏ | Debug cho test xanh | Triage trước khi kết luận |
| Test data | Dữ liệu phục vụ script | Một phần phải được kiểm soát |
| Evidence | Screenshot khi cần | Một phần của execution |
| AI | Sinh testcase và code nhanh hơn | Làm việc trong rule và gate |
| Kết quả cuối | Automation của một sản phẩm | Kit làm nền cho nhiều dự án |

Playwright vẫn quan trọng. AI Agent cũng quan trọng. Nhưng cả hai đều chỉ là công cụ.

**Câu hỏi cốt lõi:** làm thế nào để QA có thể tin vào kết quả mà bộ automation của mình tạo ra?

---

## App thực hành: bạn có gì để test ngay từ Bài 1

Cả tài liệu thực hành trên một app duy nhất. [Vận hành lớp học](course/assets/app-thuc-hanh/README.md), Node
thuần, `node server.js` là chạy, không cài gì.

Nó có đúng 3 bug cài sẵn, cố ý, mỗi bug đại diện một loại điểm mù:

| Bug | Tầng | Bộ kiểm mù vì | Bạn bắt được ở |
|---|---|---|---|
| Phí dịch vụ so mốc trên số sai | backend | chỉ test dữ liệu đẹp, không test biên | Bài 1 (bằng tay) · Bài 10 |
| Các số trên màn hình không cộng đúng | frontend | kiểm từng trường, không kiểm quan hệ giữa các trường | Bài 9 · Bài 13 |
| Sửa được đơn đã xác nhận qua API | backend | chỉ test một tầng, giao diện đã ẩn nút | Bài 10 · Bài 16 |

Vì sao phải là app có bug biết trước: nếu thực hành trên app đúng hoàn toàn thì bộ kiểm của bạn luôn xanh,
và bạn không có cách nào biết nó xanh vì app đúng hay vì bộ kiểm mù. Hai thứ đó cho cùng một dấu hiệu.
Biết trước "có 3 bug" nghĩa là bắt được 0/3 thì lỗi ở bộ kiểm, không ở app. Đó là đối chứng, và nó là
ý tưởng trung tâm của cả tài liệu này.

Nguồn phán đúng/sai là [`spec.md`](course/assets/app-thuc-hanh/spec.md). Mọi luật có mã (`BR-01`…`UI-04`).
Nói "chỗ này sai" mà không chỉ được mã luật thì chưa chứng minh được gì.

---

## Cấu trúc thư mục của bộ kit

Đây là thư mục bạn có sau khi làm hết. Đọc trước một lượt, không cần hiểu hết. Mục đích là khi bài
học nói "viết file này", bạn biết nó nằm ở đâu và cạnh cái gì. Mỗi nhánh ghi bài nào tạo ra nó.

```
kit-cua-toi/
├── package.json                      ← Bài 2  · khai mọi lệnh `npm run ...`
├── playwright.config.js              ← Bài 3  · 13 tuỳ chọn quyết định chất lượng
├── .gitignore                        ← Bài 2  · ba thư mục không bao giờ commit
├── README.md                         ← Bài 28 · người mới đọc là chạy được
├── CHANGELOG.md                      ← Bài 28 · kit cũng có phiên bản
├── CLAUDE.md                         ← Bài 15 · luật agent PHẢI đọc mỗi phiên (dưới 20 dòng)
├── LUAT-DAY-DU.md                    ← Bài 15 · bản luật đầy đủ; CLAUDE.md là bản rút gọn có pointer
│
├── .agent/                           ← "bộ não": luật, cấu hình, năng lực
│   ├── rules/
│   │   └── core_rules.md             ← Bài 15 · digest, canonical là LUAT-DAY-DU.md
│   ├── skills/                       ← Bài 15 · năng lực theo vai (không tự nạp)
│   ├── workflows/                    ← Bài 15 · quy trình từng phase
│   └── config/
│       ├── phan-quyet.json           ← Bài 17 · 7 phán quyết + 7 tầng lỗi + ngưỡng rerun
│       ├── chieu-phu.json            ← Bài 14 · chiều nào áp cho dự án này, `n/a` phải kèm lý do
│       ├── mo-rong-truc.json         ← Bài 16 · 7 trục + số trục tối thiểu theo mức rủi ro
│       ├── anh-xa-luu-tru.json       ← Bài 10 · một nguồn cho 3 tên gọi của cùng một trường
│       ├── knowledge-schema.json     ← Bài 26 · trường bắt buộc · 4 trạng thái · hạn tái xác nhận
│       ├── risk_model.json           ← Bài 27 · trọng số rủi ro + khối cold-start
│       ├── vong-doi-du-lieu.json     ← Bài 27 · giữ bao lâu, tỉa thế nào, kèm LÝ DO
│       ├── nguong-metrics.json       ← Bài 25 · ngưỡng khoảng cách + mốc xếp hạng độ tin cậy
│       ├── mutants.json              ← Bài 25 · các lỗi cố tình tiêm để đo suite
│       ├── ci_scope.json             ← Bài 20 · lệnh nào chạy ở đâu (một nguồn cho CI)
│       ├── env-allow.json            ← Bài 6  · biến môi trường nào được đọc, ai dựng nó
│       └── kit-layers.md             ← Bài 29 · ranh giới tầng CHUNG ↔ tầng DỰ ÁN
│
├── .claude/
│   └── commands/                     ← Bài 16 · gõ `/phase2 <MÃ>` thay vì 6 lệnh
│
├── prompt_templates/                 ← Bài 15 · bản mẫu ra lệnh cho agent
│   ├── phase1/                       ·  requirement → test case
│   └── phase2/                       ·  execute → bằng chứng → bug
│
├── scripts/
│   ├── lib/                          ← THƯ VIỆN — không tự chạy được
│   │   ├── testcase/                 ·  Bài 13 · đọc/ghi bảng testcase, xuất Excel
│   │   ├── verdict.js                ·  Bài 17 · đọc taxonomy, ánh xạ trạng thái
│   │   └── gate.js                   ·  Bài 24 · khung chung cho mọi máy chặn
│   ├── utils/                        ← MÁY TƯ VẤN — trả lời câu hỏi, KHÔNG chặn
│   │   └── do-tai-lieu.js            ·  Bài 12 · đo tài liệu → khuyến nghị chiến lược
│   └── qa/                           ← MÁY CHẶN — mỗi file tự chạy, thoát mã 0/1/2
│       ├── kiem-so-mong-doi.js       ·  Bài 13 · máy chặn đầu tiên, 12 dòng
│       ├── kiem-file-cam.js          ·  Bài 2  · tệp cấm bị git track ⇒ chặn
│       ├── gate-mo-ho.js             ·  Bài 15 · chưa chốt mơ hồ thì không cho sinh case
│       ├── dem_chieu.js              ·  Bài 14 · chiều bắt buộc chưa đủ ngưỡng ⇒ chặn
│       ├── gate-bang-chung.js        ·  Bài 11 · case đã chạy mà không có ảnh/video ⇒ chặn
│       ├── doi-chieu-luu-tru.js      ·  Bài 10 · so UI với nơi lưu, khoanh tầng lỗi
│       ├── gate-mo-rong.js           ·  Bài 16 · không neo được vào mã luật ⇒ OBSERVATION
│       ├── doi-soat-truong.js        ·  Bài 18 · 2xx không chứng minh mapping đúng
│       ├── kiem-domain.js            ·  Bài 26 · rule không có `nguon` ⇒ cấm ghi
│       ├── kiem-tri-thuc.js          ·  Bài 26 · chặn ở cửa ĐỌC: thiếu source · mâu thuẫn · quá hạn
│       ├── sao-luu-knowledge.js      ·  Bài 27 · đích sao lưu nằm TRONG repo ⇒ từ chối
│       ├── do-metrics.js             ·  Bài 25 · clean vs eventual + KHOẢNG CÁCH lệ thuộc retry
│       ├── tiem-loi.js               ·  Bài 25 · đo chính bộ kiểm bằng tiêm lỗi
│       ├── sinh-dashboard.js         ·  Bài 11 · 1 tệp .html tự chứa, tự kiểm 0 host ngoài
│       ├── cham-rui-ro.js            ·  Bài 27 · tính điểm rủi ro, ép độ sâu theo band
│       ├── gates-voi-toi.js          ·  Bài 20 · máy không ai gọi thì bằng không có
│       ├── chong-troi.js             ·  Bài 24 · chống luật bị trôi, allowlist chặn khối lạ
│       └── tu-soi.js                 ·  Bài 24 · gọi mọi máy chặn một lượt
│
├── tests/
│   ├── support/                      ← HẠ TẦNG TEST — không phải test
│   │   ├── fixtures/                 ·  Bài 8  · dựng/dọn dữ liệu, gắn mutant
│   │   ├── factory.js                ·  Bài 7  · tạo dữ liệu qua API, prefix "IT test"
│   │   ├── evidence.js               ·  Bài 11 · chụp có khoanh đỏ, che PII
│   │   ├── video.js                  ·  Bài 11 · quay có banner từng bước
│   │   └── setup/db/                 ·  Bài 10 · cửa DUY NHẤT tới database, 4 lớp an toàn
│   ├── e2e/                          ← Bài 4  · test qua giao diện
│   ├── api/                          ← Bài 10 · test gọi thẳng API
│   ├── mobile-web/                   ← Bài 21 · cùng suite, khác viewport và cách chạm
│   ├── a11y/                         ← Bài 22 · kiểm khả năng tiếp cận
│   ├── load/                         ← Bài 23 · kịch bản tải
│   └── smoke/                        ← Bài 20 · tập nhẹ chạy hàng đêm
│
├── .github/workflows/                ← Bài 20 · CI đọc ci_scope.json, KHÔNG tự liệt kê lệnh
│
├── knowledge/                        ← Bài 26 · bộ nhớ dự án. ⛔ KHÔNG commit
├── profiles/
│   └── <MÃ-TASK>/task.env            ← Bài 6  · URL + tài khoản theo task. ⛔ KHÔNG commit
└── outputs/                          ← kết quả mỗi lượt chạy. ⛔ KHÔNG commit
    └── tasks/<MÃ-TASK>/
        ├── requirements/             ·  Bài 12 · tài liệu đã bóc thành bảng luật
        ├── test-cases/               ·  Bài 13 · bảng case canonical đã sinh
        ├── test-results/             ·  Bài 17 · phán quyết từng case + tầng lỗi
        ├── evidence/                 ·  Bài 11 · ảnh và video
        └── reports/                  ·  Bài 11 · report cho người đọc
```

**Ba chỗ người mới hay xếp sai** — phân biệt bằng một câu hỏi, không bằng cảm giác:

| Thư mục | Chứa gì | Câu hỏi phân loại |
|---|---|---|
| `scripts/lib/` | thư viện, code dùng chung | *"Gõ `node <file>` có chạy được không?"* Không ⇒ vào `lib/` |
| `scripts/qa/` | máy chặn, tự chạy được | Có, và nó báo lỗi rồi thoát khác 0 ⇒ vào `qa/` |
| `tests/support/` | hạ tầng test, không phải test | Không có `test(...)` trong file ⇒ vào `support/` |

**Ba thư mục ⛔ không bao giờ commit**, và lý do khác nhau:

| Thư mục | Vì sao |
|---|---|
| `knowledge/` | dữ liệu nghiệp vụ của công ty, và chính tên file đã tiết lộ lỗi sản phẩm (Bài 2) |
| `profiles/*/task.env` | tài khoản, mật khẩu, token |
| `outputs/` | kết quả từng lượt chạy, đổi liên tục, và chứa ảnh có thể có dữ liệu khách |

> Bạn không phải tạo cây này ngay. Mỗi bài tạo đúng phần của nó, và mỗi bài giảng đều kết thúc bằng khối
> **"Cây thư mục sau bài này"** để bạn đối chiếu xem mình có đang đi đúng đường không.

---

## PHẦN 1 — Từ Manual QA đến Automation đầu tiên (7.5 giờ)

`CẤP ĐỘ 1 · AUTOMATE`

> **Xong phần này bạn có:** một testcase thực sự chạy, và bạn hiểu dấu xanh hay đỏ của nó có ý nghĩa gì

Bạn bắt đầu từ requirement và manual testing, sau đó tự tạo repository, cài Playwright và viết
testcase automation đầu tiên.

### [Bài 1 — Trước khi automate: một testcase đúng trông như thế nào?](course/automation-test-kit-la-gi.md) *(2h · dễ)* ⭐

*Có gì trong tay: chưa có gì.*

- **Thực hành:** nhận việc, đọc đặc tả, tự tính kết quả TRƯỚC khi bấm, rồi tìm ra bug đầu tiên ở phút thứ 40 mà không dùng công cụ nào
- Dựng thêm một bộ dữ liệu phân biệt được hai giải thích, để nghi ngờ thành bằng chứng
- Đếm thời gian bốn mươi phút cho một bộ, rồi tự thấy vì sao cần automation
- Vòng 5 chặng, và chặng duy nhất máy KHÔNG làm được
- Ba thứ hay bị gọi lẫn: một bộ test, một automation project, và một test kit
- 10 từ vựng, mỗi từ gắn vào đúng việc bạn vừa làm, gọi tên ở CUỐI bài chứ không định nghĩa trước
- Đào sâu: [chi phí và giới hạn thật](course/chi-phi-va-gioi-han.md) của việc dựng kit

### [Bài 2 — Dựng môi trường làm việc cho Automation](course/moi-truong.md) *(1.5h · dễ)*

*Có gì trong tay: đã chơi với app thực hành, chưa có repo.*

- Cài Node, Git, VS Code, và nghiệm thu từng cái bằng một câu lệnh chứ không tin trình cài đặt
- Tạo repo, viết `.gitignore` trước cả README, và hiểu vì sao thứ tự đó là cố ý
- Năm loại dữ liệu không bao giờ commit, kèm một chuyện có thật về 7 file nháp
- **Xây gate:** `kiem-file-cam.js` chặn tệp cấm bị git track
- Đào sâu: [git từ số 0](course/git-tu-so-0.md) cho người chưa từng dùng commit và nhánh

### [Bài 3 — Cho Playwright chạy testcase đầu tiên](course/playwright-du-an-dau-tien.md) *(2h · dễ)*

*Có gì trong tay: repo rỗng có `.gitignore` và `package.json`.*

- Cài Playwright, chạy test mẫu, và đọc được đầu ra của nó
- 13 tuỳ chọn trong `playwright.config.js` quyết định chất lượng bộ test, đi từng cái một
- Ba tuỳ chọn khiến CI xanh giả nếu đặt sai, và cách đặt đúng
- Chạy có giao diện và chạy không giao diện, khi nào dùng cái nào

### [Bài 4 — Viết testcase automation đầu tiên có khả năng bắt lỗi](course/testcase-automation-dau-tien.md) *(2h · vừa)* ⭐

*Có gì trong tay: Playwright đã cài, `playwright.config.js` đã cấu hình.*

- Viết test đầu tiên cho luồng cắt hạn học lại trên app thực hành
- **Thực hành:** làm nó đỏ có chủ đích trước, rồi mới làm cho xanh, để biết nó thật sự đang kiểm
- Ba cách viết assertion, và cách nào chứng minh được nhiều nhất
- Đọc một lượt chạy đỏ: đọc từ dòng nào, bỏ qua dòng nào

---

## PHẦN 2 — Từ Automation Project đến Test Kit (15 giờ)

`CẤP ĐỘ 2 · BUILD`

> **Xong phần này bạn có:** một Automation Test Kit có cấu trúc đủ để sử dụng trong dự án thật

Bạn giải quyết từng vấn đề xuất hiện khi số lượng testcase bắt đầu tăng: configuration, test data,
fixture, FE, API, evidence và reporting.

### [Bài 5 — Khi một testcase bắt đầu trở thành một project](course/cau-truc-project.md) *(1.5h · dễ)*

*Có gì trong tay: một test chạy được, mọi thứ nằm trong một file.*

- Vì sao một file duy nhất hỏng ở testcase thứ mười, không phải thứ hai
- Bốn nhóm thư mục và câu hỏi phân loại cho từng nhóm
- Đặt tên file test sao cho sáu tháng sau vẫn tìm được
- **Cây thư mục sau bài này** là bộ khung mọi bài sau sẽ lấp đầy

### [Bài 6 — Tách môi trường khỏi testcase](course/environment-va-config.md) *(2h · vừa)*

*Có gì trong tay: cấu trúc thư mục đã dựng, URL và tài khoản vẫn nằm trong code.*

- Vấn đề trước: chuyển bộ automation sang sản phẩm khác thì phải sửa code ở nhiều nơi
- Tách cấu hình khỏi testcase: `.env`, `profiles/<MÃ-TASK>/task.env`, và vì sao không dùng chung một `.env`
- Một hàm nạp cấu hình duy nhất, để testcase không cần biết mình đang chạy ở dự án nào
- **Xây gate:** khai `env-allow.json`, biến môi trường lạ thì chặn thay vì im lặng chạy sai

### [Bài 7 — Để testcase tự sở hữu dữ liệu của nó](course/test-data.md) *(2h · vừa)* ⭐

*Có gì trong tay: config đã tách, dữ liệu test vẫn gõ tay trong từng test.*

- Ba cách sai kinh điển: dùng dữ liệu có sẵn trên môi trường, hardcode id, và dùng chung một bản ghi cho nhiều test
- Factory tạo dữ liệu qua API, đặt tiền tố nhận diện được, và trả về đúng thứ test cần
- Dọn dữ liệu sau khi chạy, và ba lớp an toàn để không xoá nhầm
- Dữ liệu ngẫu nhiên đến đâu thì dừng, vì sao random hoàn toàn làm test không lặp lại được

### [Bài 8 — Dựng precondition ổn định với Fixture](course/fixture-va-setup.md) *(2h · vừa)*

*Có gì trong tay: factory tạo được dữ liệu, mỗi test vẫn tự gọi tay.*

- Testcase ghi *"Precondition: học viên đang ở loại Học lại"*, câu hỏi đúng không phải selector của nút Gia hạn mà là làm sao dựng được trạng thái đó một cách ổn định
- Fixture, hook, cleanup, setup contract: bốn khái niệm, mỗi cái một ví dụ chạy được
- Bốn cách dựng tiền điều kiện xếp theo thứ tự ưu tiên, và vì sao dựng bằng database là cách tệ nhất
- **Bug ma:** khi tiền điều kiện dựng sai, sản phẩm xử lý sai theo, và bạn log một bug không tồn tại

### [Bài 9 — Viết UI automation ít gãy hơn](course/fe-automation.md) *(2.5h · vừa)*

*Có gì trong tay: fixture dựng được state, test vẫn hay đỏ vì không tìm thấy element.*

- Sáu mẫu định vị element ẩu, và vì sao mỗi mẫu là dấu hiệu bạn không thật sự biết mình đang chạm vào element nào
- Thang ưu tiên khi chọn locator, và vì sao `data-testid` không phải lúc nào cũng đứng đầu
- Chờ đúng cách: chờ điều kiện chứ không chờ thời gian
- **Xây gate:** `lint-locator` chặn mẫu ẩu mới, không bắt sửa hết lịch sử

### [Bài 10 — Kiểm rule phía sau giao diện bằng API](course/api-automation.md) *(2.5h · vừa)*

*Có gì trong tay: bộ test FE chạy được, mọi kiểm tra đều đi qua giao diện.*

- Ba việc API test làm tốt hơn hẳn UI test, và một việc nó không làm được
- Gọi API trong Playwright: `request` context, tái dùng token, và tách khỏi trình duyệt
- **Thực hành:** bắt bug thứ ba của app thực hành, thứ mà giao diện đã ẩn nút nên UI test không thấy
- **Xây gate:** `doi-chieu-luu-tru.js` so cái UI hiện với cái tầng lưu trữ giữ, để khoanh tầng lỗi
- Đào sâu: [UI và tầng lưu trữ](course/ui-va-tang-luu-tru.md) cho trường hợp báo thành công nhưng lưu sai

### [Bài 11 — Khi test Fail, bằng chứng của bạn ở đâu?](course/evidence-va-report.md) *(2.5h · vừa)* ⭐

*Có gì trong tay: FE và API đều chạy, kết quả vẫn chỉ có trong console.*

- Vì sao ảnh chụp trơn bị Dev trả về, và cách khoanh đỏ đúng element kèm nhãn
- Che dữ liệu khách, kể cả `input.value` mà `textContent` không chạm tới được
- Khi nào ảnh không đủ và phải quay video có banner từng bước
- **Xây gate:** `gate-bang-chung.js` chặn case đã chạy mà không có ảnh hoặc video
- Đào sâu: [dashboard và báo cáo](course/dashboard-va-bao-cao.md), một tệp `.html` tự chứa, không gọi host ngoài

---

## PHẦN 3 — Từ Testcase đến QA Workflow (16 giờ)

`CẤP ĐỘ 3 · CONTROL`

> **Xong phần này bạn có:** automation trở thành một phần của quy trình QA, thay vì một tập script độc lập

Bạn quay lại thứ đáng lẽ phải đứng trước automation: **requirement**. Bóc business rule, thiết kế
testcase có nguồn, đánh giá coverage, giao một phần công việc cho AI Agent, và triage failure trước
khi tạo bug.

### [Bài 12 — Trước khi viết test: expected của bạn đến từ đâu?](course/dung-bat-dau-bang-code.md) *(2h · vừa)*

*Có gì trong tay: bộ automation chạy được, nhưng chưa ai hỏi nó đang kiểm cái gì.*

- Ba câu hỏi phải trả lời được trước khi automation một testcase: đang kiểm điều gì, rủi ro nào cần phủ, kết quả nào được xem là đúng
- Bóc một requirement nhiều nguồn thành bảng luật có mã `BR-`
- Xử lý khi tài liệu, Figma và API nói ba thứ khác nhau
- **Xây máy tư vấn:** `do-tai-lieu.js` đo tài liệu rồi khuyến nghị chiến lược, cảnh báo chứ không chặn

### [Bài 13 — Thiết kế testcase có nguồn đáng tin](course/thiet-ke-testcase.md) *(2.5h · vừa)* ⭐

*Có gì trong tay: bảng luật `BR-` đã bóc từ requirement.*

- Bảy cột của một bảng testcase dùng chung được cho cả người lẫn máy, và vì sao mỗi cột tồn tại
- Kỷ luật oracle: kết quả mong đợi phải trỏ về một mã luật, không được lấy giá trị app đang trả
- **Xây gate:** `kiem-so-mong-doi.js` chặn kết quả mong đợi lấy từ chính giá trị app đang trả
- **Thực hành:** bảo agent sửa cho test pass, xem nó lấy số của app làm chuẩn, và xem máy chặn lại
- Đào sâu: [kỷ luật oracle](course/oracle.md), bài quan trọng nhất của cả tài liệu

### [Bài 14 — Đừng đếm testcase, hãy đo những gì bạn đã phủ](course/coverage-va-risk.md) *(3h · vừa)*

*Có gì trong tay: bộ testcase có oracle, chưa biết đủ hay thiếu.*

- Đếm số testcase không nói được gì về độ phủ, và một ví dụ 300 case phủ đúng một chiều
- Đo phủ theo chiều: khai chiều nào áp cho dự án này, `n/a` phải kèm lý do
- Band rủi ro: cách đọc, và vì sao độ sâu testcase phải theo band (máy chấm điểm dựng ở Bài 27)
- **Xây gate:** `dem_chieu.js` chặn khi chiều bắt buộc chưa đủ ngưỡng

### [Bài 15 — Giao việc sinh testcase cho AI mà không để AI tự đoán](course/phase1-sinh-testcase.md) *(3h · khó)*

*Có gì trong tay: quy tắc thiết kế và đo phủ đã có, làm tay vẫn chậm.*

- Giao việc sinh testcase cho agent, và xem nó tự đoán khi gặp chỗ mơ hồ
- Phân mức mơ hồ chặn và không chặn, viết bộ câu hỏi BA trả lời được trong 2 phút
- **Xây gate:** `gate-mo-ho.js` không cho sinh case khi câu hỏi chặn chưa có câu trả lời
- Công thức 5 câu hỏi để viết mọi gate về sau, dùng lại suốt phần còn lại
- Đào sâu: [viết gate đầu tiên](course/viet-gate-dau-tien.md) · [prompt, skill, rule, command](course/prompt-va-token.md)

### [Bài 16 — Cho AI chạy automation nhưng không được tự kết luận](course/phase2-chay-automation.md) *(3h · khó)*

*Có gì trong tay: bộ testcase đã sinh và đã chốt.*

- Một lượt execute thật gồm những chặng nào, và chặng nào hay bị bỏ
- Không chỉ bám chữ trong case: mở rộng 5 trục quanh mỗi case đã chạy
- Luật sống còn: mở rộng không neo được vào mã luật thì là `OBSERVATION`, không phải PASS hay FAIL
- **Xây gate:** `gate-mo-rong.js` hạ phát hiện không neo xuống `OBSERVATION`
- Gộp cả chuỗi vào một lệnh `/phase2 <MÃ>` thay vì nhớ sáu lệnh

### [Bài 17 — Test đỏ chưa có nghĩa là Bug](course/triage-va-rerun.md) *(2.5h · vừa)* ⭐

*Có gì trong tay: một lượt chạy có case đỏ.*

- Một testcase Failed chưa đồng nghĩa với một Bug, và năm câu hỏi phải trả lời trước khi tạo defect
- Bảy phán quyết và bảy tầng lỗi, khai trong một file để cả người lẫn máy đọc cùng một bảng
- Rerun 2–3 lần để loại chập chờn, và vì sao "không phán được" không được thành PASS
- **Xây gate:** `phan-quyet.json` là nguồn duy nhất, FAIL không khai tầng lỗi thì chặn

---

## PHẦN 4 — Đưa Kit vào Team và CI (6 giờ)

`CẤP ĐỘ 3 · CONTROL`

> **Xong phần này bạn có:** kit bắt đầu hoạt động trong workflow của cả team

Testcase và kết quả được đưa ra khỏi máy cá nhân. Bạn tích hợp test management, bug workflow và CI để
các rule quan trọng không phụ thuộc vào việc một QA có nhớ chạy chúng hay không.

### [Bài 18 — Đưa testcase ra khỏi máy cá nhân](course/test-management.md) *(2h · vừa)*

*Có gì trong tay: testcase và kết quả vẫn đang nằm local.*

- Với team nhỏ thì quản lý local có thể đủ. Khi nhiều QA cùng làm thì cần một nơi chung
- Bộ kit này dùng AIO Tests làm bản hiện thực mẫu. Team dùng Xray, Zephyr hay hệ khác thì nguyên tắc kiến trúc vẫn thế
- Đẩy testcase lên, đẩy kết quả execution lên, và giữ được đường truy ngược về requirement
- **Xây gate:** `doi-soat-truong.js`, vì mã 2xx không chứng minh trường được map đúng

### [Bài 19 — Khi nào một lần Fail thực sự trở thành Bug?](course/bug-workflow-jira.md) *(2h · vừa)*

*Có gì trong tay: một phát hiện đã qua triage và xác nhận là lỗi sản phẩm.*

- Từ Failed tới Bug: chặng triage nằm giữa, và bỏ nó thì Dev trả về
- Một bug report Dev không phải hỏi lại: bốn phần bắt buộc, không thêm
- Gán đúng người theo tầng lỗi, vì bug giao diện và bug backend đi hai đường khác nhau
- Rerun sau khi Dev fix, và một cái bẫy: kết quả rerun hết hạn sau lần deploy kế tiếp

### [Bài 20 — Đừng dựa vào trí nhớ, hãy đưa Gate vào CI](course/ci-cd.md) *(2h · vừa)*

*Có gì trong tay: mọi gate chạy được trên máy bạn, và chỉ khi bạn nhớ chạy.*

- Một luật không có máy kiểm sẽ có lúc bị bỏ qua. Một máy kiểm không ai gọi thì bằng không có
- Khai một nguồn duy nhất cho phạm vi CI, để workflow không tự liệt kê lệnh rồi trôi
- Gate chạy mỗi push, regression chạy hằng đêm, và cách chia hai lane
- **Xây gate:** `gates-voi-toi.js` tìm máy đã mất nơi gọi
- Đào sâu: [MCP và tự động hoá quanh công việc](course/mcp-va-tu-dong-hoa.md)

---

## PHẦN 5 — Mở rộng, đo độ tin cậy và tái sử dụng (21.5 giờ)

`CẤP ĐỘ 4 · EVOLVE`

> **Xong phần này bạn có:** bằng chứng rằng bộ automation vừa xây là một kit dùng lại được, không chỉ là automation của một website

Phần này không phải một khối. Ba nhóm bài, ba loại câu hỏi khác nhau, và **không nhóm nào là điều
kiện để bạn được coi là "biết automation"**:

| Nhóm | Bài | Nhãn | Câu hỏi nó trả lời |
|---|---|---|---|
| Mở rộng bề mặt kiểm thử | 21–23 | `MỞ RỘNG · chọn theo dự án` | Kit còn nhìn được những loại rủi ro nào nữa? |
| Kiểm chính bộ kiểm | 24–25 | `NÂNG CAO` | Tôi có tin chính bộ test của mình không? |
| Tích luỹ learning | 26–27 | `NÂNG CAO` | Kit có nhớ những gì team đã học không? |
| Đóng gói và chứng minh | 28–29 | `KẾT` | Đây là kit dùng lại được, hay chỉ là automation của một website? |

Nhóm đầu phụ thuộc dự án: không phải sản phẩm nào cũng cần cùng một độ sâu về mobile, khả năng tiếp
cận hay hiệu năng. Ba nhóm sau thì gần với độ chín của chính bộ kit hơn.

Cuối cùng, bạn tách phần **CHUNG** khỏi phần **DỰ ÁN**, đóng gói kit và mang sang một sản phẩm hoàn
toàn mới.

### [Bài 21 — Desktop xanh chưa có nghĩa Mobile cũng xanh](course/mobile-web.md) *(1.5h · dễ)*

*Có gì trong tay: bộ test chạy trên desktop.*

- Cùng một suite chạy trên viewport điện thoại, và ba thứ hỏng ngay lập tức
- Chạm khác click: `tap()`, cuộn, và element bị bàn phím ảo che
- Khai thiết bị trong config thay vì đặt kích thước tay
- Chọn cái gì chạy trên mobile, vì chạy hết là nhân đôi thời gian mà không nhân đôi giá trị

### [Bài 22 — Máy click được chưa có nghĩa người dùng chạm tới được](course/accessibility.md) *(1.5h · dễ)*

*Có gì trong tay: bộ test FE ổn định.*

- Kiểm khả năng tiếp cận không phải việc thiện nguyện, nó bắt được lỗi thật của giao diện
- Bốn nhóm lỗi máy quét được và bốn nhóm chỉ người kiểm được
- **Thực hành:** rút chuột ra, đi hết một luồng chính bằng bàn phím, ghi lại mọi chỗ bị kẹt
- Ngưỡng chặn và ngưỡng cảnh báo, vì bật hết mức là bị tắt sau một tuần

### [Bài 23 — "Thấy nhanh" không phải là một phép đo](course/performance-va-load.md) *(2h · vừa)*

*Có gì trong tay: bộ test chức năng đầy đủ.*

- Ba câu hỏi hiệu năng khác nhau, và ba loại phép đo tương ứng
- Đo trang bằng số của trình duyệt, không bằng cảm giác "thấy nhanh"
- Kịch bản tải: dựng, chạy, và đọc kết quả mà không kết luận quá tay
- Đừng bịa ngưỡng: chưa có SLA thì báo cáo là tư vấn, không phải phán quyết

### [Bài 24 — Ai kiểm chính các Quality Gate?](course/quality-gates.md) *(2.5h · khó)*

*Có gì trong tay: khoảng mười gate rời rạc, viết theo từng bài.*

- Khung `lib/gate.js` dùng chung, để mọi gate cùng một dạng kết quả và cộng dồn được
- Mã thoát `0`, `1`, `2`, và vì sao gộp `2` vào `0` là cách tự vô hiệu hoá gate
- Đối chứng bắt buộc: mỗi gate phải có một ca phải chặn và một ca phải cho qua
- **Xây gate:** `tu-soi.js` gọi mọi máy một lượt · `chong-troi.js` chặn luật bị trôi
- Đào sâu: [viết gate đầu tiên](course/viet-gate-dau-tien.md) · [một nguồn và máy chống trôi](course/mot-nguon-va-may-chong-troi.md)

### [Bài 25 — Bộ test của bạn đáng tin đến mức nào?](course/flaky-va-do-tin-cay.md) *(3.5h · khó)* ⭐

*Có gì trong tay: bộ test khá lớn, thỉnh thoảng đỏ không rõ lý do.*

- Một test chập chờn làm hai việc xấu cùng lúc, và cái thứ hai nguy hiểm hơn
- Đo tỉ lệ chập chờn bằng số, tách "xanh ngay" và "xanh nhờ chạy lại"
- **Thực hành:** tiêm lỗi vào phản hồi API rồi đếm xem suite có đỏ không, tức là đo chính bộ kiểm
- Bắt được 4/5 lỗi tiêm vào là một con số. "Tôi thấy ổn" thì không
- Đào sâu: [đo chính bộ kiểm](course/do-chinh-bo-kiem.md)

### [Bài 26 — Bộ automation có nhớ những gì team đã học không?](course/knowledge-base.md) *(3h · vừa)*

*Có gì trong tay: đã chạy hàng trăm testcase qua nhiều sprint.*

- Một automation suite thông thường chỉ biết chạy lại. Nó không học được gì từ 500 lần chạy trước
- Sáu loại tri thức đáng giữ, phân theo câu hỏi nó trả lời, và loại nào chiếm quá nửa theo số đo
- Bản ghi phải có nguồn, có trạng thái, và có hạn tái xác nhận
- **Xây gate:** chặn ở cửa ĐỌC chứ không chỉ cửa ghi, vì tri thức sai còn tệ hơn không có
- Đào sâu: [một QA agent cần học những gì](course/bo-nho-du-an.md)

### [Bài 27 — Dùng lịch sử để quyết định lần test tiếp theo](course/learning-loop.md) *(2.5h · vừa)*

*Có gì trong tay: knowledge base có dữ liệu của vài sprint.*

- Vòng khép kín: bug đã log quay lại thành trọng số rủi ro của lượt chạy sau
- Cold start: chưa có lịch sử thì chấm rủi ro bằng gì
- Bẫy dòng ma: tên module lệch làm cả bảng rủi ro thành vô nghĩa. Và vòng đời dữ liệu: giữ bao lâu, tỉa thế nào, mỗi mốc kèm lý do
- Đào sâu: [sao lưu và vòng đời dữ liệu](course/sao-luu-va-vong-doi-du-lieu.md)

### [Bài 28 — Tách thứ thuộc Kit khỏi thứ thuộc Project](course/dong-goi-kit.md) *(2.5h · vừa)*

*Có gì trong tay: kit đầy đủ, chạy tốt trên máy bạn.*

- Ranh giới tầng CHUNG và tầng DỰ ÁN, và vì sao nhầm ranh giới là chuyện an toàn chứ không phải gọn gàng
- Đóng gói chỉ tầng chung, vì gói lẫn cấu hình dự án là phát ra một oracle sai
- **Nghiệm thu gói:** giải nén vào thư mục sạch rồi chạy, đúng trải nghiệm người nhận
- README và CHANGELOG viết cho người chưa từng thấy kit

### [Bài 29 — Final Challenge: mang Kit sang một dự án hoàn toàn mới](course/mang-kit-sang-du-an-moi.md) *(2.5h · vừa)* ⭐

*Có gì trong tay: một bản phát hành đã nghiệm thu.*

- **Thực hành:** làm thật, đầu tới cuối: clone kit → tạo profile → điền environment → thêm requirement → sinh testcase → viết automation → chạy → evidence → report
- Đếm số file phải sửa. Nếu con số lớn hơn dự tính thì ranh giới hai tầng của bạn còn sai chỗ nào
- Ba thứ luôn phải khai lại ở dự án mới, và vì sao không thể tự đoán
- Đây là bài chứng minh lời hứa ban đầu: đây không phải bộ automation cho một website, đây là một kit

---

## Tổng thời lượng: ~66 giờ

| Phần | Giờ |
|---|---|
| 1. Từ Manual QA đến Automation đầu tiên | 7.5 |
| 2. Từ Automation Project đến Test Kit | 15 |
| 3. Từ Testcase đến QA Workflow | 16 |
| 4. Đưa Kit vào Team và CI | 6 |
| 5. Mở rộng, đo độ tin cậy và tái sử dụng | 21.5 |

---

## Bạn có gì sau khi làm hết

- Một bộ automation chạy được trên FE, API và mobile web, có evidence và report
- Một quy trình đi từ requirement tới rerun, mỗi chặng có cổng chặn
- [Tài liệu đặc tả mẫu](course/assets/sample-requirement.md) có 10 vấn đề cài sẵn để luyện Ambiguity Gate
- Mẫu rules · skills · workflows · commands để tuỳ biến
- Bộ prompt mẫu cho từng phase
- Một bản phát hành đã nghiệm thu, và một dự án thứ hai đang chạy trên nó

---

## Tình trạng nội dung chi tiết

**Cả 29 bài (Bài 1 → Bài 29) đều có bài giảng** — tiêu đề bài là link bấm được. Cộng các bài chi tiết
bổ trợ không đánh số ở bảng dưới.

Mỗi bài giảng đầy đủ gồm: từ mới của bài · các **Việc** làm theo bước, mỗi việc có khối *"Bạn sẽ thấy"*
và bảng xử lý khi thấy khác · cây thư mục sau bài này · bảng tự kiểm · bài tập về nhà.

**Bài chi tiết bổ trợ (không đánh số)** — không phải bài trong lộ trình, mà là phần đào sâu mà một bài
có số trỏ tới. Tách ra để bài chính không phình, nhưng nội dung vẫn nằm trong tài liệu này:

| Bài chi tiết | Nội dung | Được dạy ở |
|---|---|---|
| [Trước khi bắt đầu](course/truoc-khi-bat-dau.md) | 10 từ vựng của cả tài liệu, mỗi từ một ví dụ lấy từ việc vừa làm | Bài 1 |
| [Chi phí và giới hạn thật](course/chi-phi-va-gioi-han.md) | Dựng kit tốn bao nhiêu, và ba thứ nó không làm được | Bài 1 |
| [Git từ số 0](course/git-tu-so-0.md) | Commit, nhánh, và máy chặn tệp cấm lọt lên repo | Bài 2 |
| [UI và tầng lưu trữ](course/ui-va-tang-luu-tru.md) | Kiểm song song hai tầng để bắt lỗi báo thành công nhưng lưu sai | Bài 10 |
| [Dashboard và báo cáo](course/dashboard-va-bao-cao.md) | Một tệp `.html` tự chứa, tự kiểm 0 host ngoài | Bài 11 |
| [Kỷ luật oracle](course/oracle.md) | Bài quan trọng nhất: chặn lấy giá trị app làm chuẩn đối chiếu | Bài 13 |
| [Viết gate đầu tiên](course/viet-gate-dau-tien.md) | Cơ chế `exit 0/1/2`, và 3 phép tiêm lỗi để chứng minh gate chặn thật | Bài 15, 24 |
| [Prompt, skill, rule, command](course/prompt-va-token.md) | Bốn thứ hay bị gọi lẫn, phân biệt và dùng đúng | Bài 15 |
| [MCP và tự động hoá](course/mcp-va-tu-dong-hoa.md) | Nối agent với công cụ quanh công việc | Bài 20 |
| [Một nguồn và máy chống trôi](course/mot-nguon-va-may-chong-troi.md) | Khi kit chặn sai, và cách chống luật bị trôi | Bài 24 |
| [Đo chính bộ kiểm](course/do-chinh-bo-kiem.md) | Tiêm lỗi vào phản hồi rồi đếm xem suite có đỏ không | Bài 25 |
| [Một QA agent cần học những gì](course/bo-nho-du-an.md) | Tám loại tri thức, loại nào giá trị nhất theo số đo | Bài 26 |
| [Sao lưu và vòng đời dữ liệu](course/sao-luu-va-vong-doi-du-lieu.md) | Giữ bao lâu, tỉa thế nào, và đích sao lưu không được nằm trong repo | Bài 27 |
| [Đi tiếp sau khi làm hết](course/lo-trinh-sau-khoa.md) | Ba hướng đi tiếp, và cách đọc việc người khác lách luật của bạn | Bài 29 |

---

## Quyết định thiết kế tài liệu này — đọc trước khi triển khai

**1. Trục chính là dây chuyền QA, không phải mục lục của kit.** Người đọc đi theo thứ tự họ gặp vấn
đề: chạy được trước, tổ chức lại sau, rồi mới hỏi automation bắt đầu từ đâu. Trình bày theo bố cục
thư mục của kit thì đọc như một bản liệt kê tính năng.

**2. Mỗi bài mở đầu bằng vấn đề, không bằng công cụ.** Bài 6 không mở bằng *"chúng ta sẽ dùng
dotenv"*, mà mở bằng *"URL và tài khoản đang gắn với dự án hiện tại, mai chuyển sang sản phẩm khác
thì phải sửa nhiều nơi"*. Người đọc hiểu vấn đề trước rồi mới học pattern.

**3. Không dạy cả bộ kit ngay từ bài đầu.** Kit thật có rất nhiều thành phần, nhìn hết một lượt là
ngợp. Phần I và II cố ý không nhắc test management, Jira, AI agent, risk gate hay learning loop.

**4. Công cụ tích hợp là bản hiện thực mẫu, không phải bắt buộc.** AIO Tests và Jira xuất hiện ở
Phần IV như một cách làm, kèm câu nói rõ rằng nguyên tắc kiến trúc vẫn giữ nếu team dùng Xray hay
Zephyr. Kit này để dùng cho nhiều dự án, nên không được khoá vào một nhà cung cấp.

**5. Mỗi bài phải trả lời "cơ chế này chặn kiểu sai nào".** Đây là khác biệt lớn nhất so với tutorial
thông thường: họ dạy *cách làm*, tài liệu này dạy *vì sao phải làm thế và không làm thì hỏng ra sao*.
Kiến thức "vì sao" mới là thứ còn lại sau 2 năm khi công cụ đã đổi.

**6. Dùng lỗi thật của chính mình làm bài học.** Ví dụ đã đưa vào bài: script crash vì thiếu `.git` khi
giải nén ZIP · probe read-only sai vì Postgres cấp quyền `TEMPORARY` cho `PUBLIC` · mục lục tự dời số
dòng của chính nó · lỗi độ ưu tiên toán tử làm một phép kiểm không bao giờ chạy mà vẫn báo đạt.

**7. Nếu ~66 giờ quá dài:** dừng ở Mốc ② (hết Bài 11, ~22.5 giờ) là đã có bộ kit chạy được trong dự
án thật. Phần còn lại là khi bạn muốn cả team dùng chung và muốn kit tốt lên sau mỗi sprint.
