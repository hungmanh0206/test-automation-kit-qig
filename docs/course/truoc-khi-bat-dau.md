# Bài 0 — Trước khi bắt đầu

> **1 giờ** · Có gì trong tay: chưa có gì · Sau bài này: app thực hành chạy được trên máy bạn, và bạn hiểu 10 từ mà 20 bài sau sẽ dùng liên tục

## Bài này bạn sẽ làm gì

Năm việc, mỗi việc gõ tay:

1. Kiểm máy bạn đã có Node.js chưa (5 phút).
2. Chạy **app thực hành** và mở nó trên trình duyệt (10 phút).
3. Tạo một đơn hàng bằng tay, ghi lại bốn con số (15 phút).
4. Học 10 từ mà cả tài liệu này sẽ dùng — bằng ví dụ, không bằng định nghĩa (30 phút).
5. Xem trước **cây thư mục** của bộ kit bạn sắp dựng (10 phút).

Hết bài này bạn **chưa** viết dòng test nào. Nhưng bạn sẽ có một app để test, và biết mình đang nói về cái gì.

## Tài liệu này dành cho ai

| Dành cho bạn nếu | Chưa dành cho bạn nếu |
|---|---|
| Bạn làm QA/tester, hoặc muốn làm | Bạn chưa từng đọc một bảng testcase nào — hãy học kiểm thử tay trước |
| Bạn từng viết testcase bằng tay (Excel, Google Sheet cũng được) | Bạn muốn "AI tự test hộ" mà không phải kiểm lại — tài liệu này dạy điều ngược lại |
| Bạn đọc được code đơn giản, kiểu `if (a > b) { … }` | Bạn chưa từng thấy code nào — dành 1–2 tuần học JavaScript cơ bản trước, rồi quay lại |
| Bạn đã dùng AI (ChatGPT, Claude…) để nhờ việc | |

**Không cần biết trước:** Playwright, CI/CD, Docker, cách gọi API, cách viết gate. Tài liệu này dạy từng thứ khi
tới lúc cần.

## Việc 1 — Kiểm Node.js (5 phút)

Node.js là thứ chạy JavaScript ngoài trình duyệt. App thực hành và mọi máy kiểm bạn sắp viết đều cần nó.

Mở terminal (Windows: bấm `Win`, gõ `Terminal`, Enter) rồi gõ:

```bash
node --version
```

**Bạn sẽ thấy** một dòng kiểu:

```
v20.11.1
```

| Bạn thấy gì | Nghĩa là | Làm gì |
|---|---|---|
| `v20.x` hoặc cao hơn | Đủ dùng | Đi tiếp |
| `v18.x` | Vẫn dùng được | Đi tiếp |
| `v16.x` hoặc thấp hơn | Quá cũ, sẽ lỗi lạ ở Bài 9 | Cài lại bản mới từ nodejs.org |
| `node: command not found` hoặc `'node' is not recognized` | Chưa có Node | Vào nodejs.org, tải bản **LTS**, cài xong **mở terminal mới** rồi gõ lại |

> Mẹo: sau khi cài, **phải mở cửa sổ terminal mới**. Cửa sổ đang mở không biết là bạn vừa cài gì.

## Việc 2 — Chạy app thực hành (10 phút)

Cả tài liệu thực hành trên **một** app duy nhất: một cửa hàng bán hàng bé xíu, chạy trên máy bạn.

**Vì sao không thực hành trên app của công ty bạn?** Ba lý do rất thực tế: bạn phải xin quyền; bạn có thể
làm hỏng dữ liệu người khác đang dùng; và quan trọng nhất — bạn **không biết app đó có bao nhiêu bug**, nên
khi bộ kiểm của bạn xanh, bạn không biết là app đúng hay là bộ kiểm mù.

App thực hành thì bạn **biết trước**: nó có đúng **3 bug cài sẵn**.

Gõ:

```bash
node docs/course/assets/app-thuc-hanh/server.js
```

**Bạn sẽ thấy** đúng hai dòng:

```
Cửa hàng mini đang chạy: http://localhost:4010
Dừng: Ctrl + C
```

Mở trình duyệt vào `http://localhost:4010`. Bạn thấy một trang có chữ **Cửa hàng mini** ở trên, bên dưới là
khung **Tạo đơn hàng** với ô chọn khách hàng, ô chọn sản phẩm, ô số lượng và nút **Thêm**.

| Bạn thấy gì | Nghĩa là | Làm gì |
|---|---|---|
| Hai dòng trên, và trang mở được | Xong | Đi tiếp |
| `Error: listen EADDRINUSE` | Cổng 4010 đang bị chiếm | Gõ `PORT=4011 node docs/course/assets/app-thuc-hanh/server.js` rồi mở cổng 4011 |
| `Cannot find module` | Bạn đang ở sai thư mục | `cd` về thư mục gốc của repo, rồi gõ lại nguyên đường dẫn trên |
| Trang trắng, có chữ *"Không nối được server"* | Server đã tắt | Xem lại cửa sổ terminal — có phải bạn vừa bấm `Ctrl + C`? |

**Để cửa sổ terminal này chạy suốt.** Muốn gõ lệnh khác thì mở cửa sổ terminal **thứ hai**. Đây là điều làm
người mới bối rối nhất trong ngày đầu: một cửa sổ để app chạy, một cửa sổ để bạn làm việc.

## Việc 3 — Tạo một đơn hàng bằng tay (15 phút)

Trước khi tự động hoá bất cứ thứ gì, hãy **làm bằng tay một lần**. Không phải để cho có — mà vì bạn không thể
tự động hoá thứ bạn chưa từng làm.

Trên trang web:

1. Ở ô **Khách hàng**, chọn `Trần Thị B — hạng Bạc`.
2. Ở ô **Sản phẩm**, chọn `Bàn gỗ — 250.000 đ`.
3. Ở ô **Số lượng**, sửa thành `2`.
4. Bấm **Thêm**.

**Bạn sẽ thấy** một dòng xuất hiện trong bảng giỏ hàng, và bốn con số bên dưới hiện ra. Ghi lại:

| Nhãn | Số bạn thấy trên màn hình |
|---|---|
| Tạm tính | |
| Giảm giá | |
| Phí giao hàng | |
| **Tổng cộng** | |

Giờ mở file [`spec.md`](assets/app-thuc-hanh/spec.md) — đây là **đặc tả**: bản mô tả app *phải* làm gì. Đọc
bốn luật `BR-01` đến `BR-04`, rồi **tự tính** bốn con số đó bằng máy tính tay:

- `BR-01` Tạm tính = 250.000 × 2 = **500.000**
- `BR-02` Giảm giá, hạng Bạc 3% = 500.000 × 3% = **15.000**
- `BR-03` Phí giao hàng: Tạm tính **500.000**, từ 500.000 trở lên thì **miễn phí** ⇒ **0**
- `BR-04` Tổng cộng = 500.000 − 15.000 + 0 = **485.000**

So với bảng bạn vừa ghi.

**Chúng không khớp.** Màn hình hiện Phí giao hàng **30.000 đ** và Tổng cộng **515.000 đ**.

Bạn vừa tìm ra một trong ba bug — bằng tay, ở phút thứ 40 của tài liệu này. Và hãy để ý **cách** bạn tìm ra nó:

> Bạn **không** hỏi app xem nó tính đúng chưa. Bạn tự tính bằng đặc tả, rồi mới so.

Đó là toàn bộ ý tưởng của tài liệu này. Nếu bạn hỏi app "tổng cộng bao nhiêu?" rồi so với chính câu trả lời của
nó, bạn luôn được kết quả khớp — và không chứng minh được gì cả.

> ⚠ Đừng mở `BUGS.md`. Trong đó là đáp án cả 3 bug, và tự tìm ra chúng là bài học lớn nhất của khoá.

## Việc 4 — Mười từ (30 phút)

Đây là 10 từ mà 20 bài sau sẽ dùng liên tục. Mỗi từ có một ví dụ lấy từ đúng việc bạn vừa làm ở Việc 3.

### 1. Testcase

Một lần kiểm cụ thể, viết ra để người khác làm lại được. Nó phải trả lời được: kiểm **cái gì**, cần **chuẩn bị
gì** trước, làm **những bước nào**, và **đúng là ra sao**.

> Việc 3 vừa rồi chính là một testcase, chỉ là bạn chưa viết nó ra. Bài 5 sẽ dạy cách viết.

### 2. Kết quả mong đợi độc lập (**oracle**)

Con số/trạng thái đúng, tính ra **không dùng app**.

> `485.000` là kết quả mong đợi độc lập — bạn tính nó từ `spec.md` bằng máy tính tay.
> `515.000` **không** phải — đó là app tự nói về mình.

Ví như đi mua gạo: bạn không cân gạo bằng cân của người bán rồi hỏi người bán xem cân có đúng không. Bạn mang
**cân riêng**. Cái cân riêng đó là oracle.

Đây là từ quan trọng nhất trong 10 từ. Bài 7 dành cả 2 tiếng chỉ cho nó.

### 3. Bản gốc (**canonical**)

Bản được coi là thật; mọi bản khác phải **sinh ra từ nó**, không được sửa riêng.

> `spec.md` là bản gốc cho câu "đúng là gì". Nếu bạn ghi luật ra một file khác rồi sửa file đó, hai file sẽ
> lệch nhau, và không ai biết bản nào đúng.

Ví như giấy khai sinh: bản chính một tờ, photo bao nhiêu cũng được — nhưng sửa trên bản photo thì bản photo
sai, không phải bản chính sai.

### 4. Máy kiểm (**gate**)

Một đoạn chương trình đọc kết quả làm việc của bạn và **chặn lại** nếu sai chuẩn. Không phải cảnh báo — chặn.

> Ví dụ bạn sẽ viết ở Bài 13: một máy đọc danh sách case đã chạy, thấy có case ghi PASS mà không kèm ảnh
> chứng minh thì nó **báo lỗi và không cho đi tiếp**.

Ví như cửa soát vé: nhân viên có thể nhắc "nhớ mua vé nhé"; cửa soát vé thì **không mở**.

### 5. Lời dặn vs. máy chặn (**forcing function**)

Luật không có máy đứng sau thì nó là **lời dặn**, và lời dặn thì sẽ bị bỏ qua — không phải vì ai đó xấu, mà
vì lúc gấp thì người ta quên.

> "Nhớ chụp ảnh mỗi case nhé" = lời dặn.
> Máy chặn khi case không có ảnh = forcing function.

Cả tài liệu này là chuyện biến lời dặn thành máy chặn.

### 6. Phán quyết (**verdict**)

Kết luận về một case sau khi chạy. Không phải chỉ có PASS/FAIL — mà còn:

| Phán quyết | Nghĩa |
|---|---|
| `PASS` | Chạy được, và khớp kết quả mong đợi |
| `FAIL` | Chạy được, nhưng **không** khớp ⇒ có thể là bug thật |
| `BLOCKED` | Không chạy được vì cái khác chặn (app sập, không đăng nhập được) |
| `SETUP_FAILURE` | Không chạy được vì **chuẩn bị dữ liệu thất bại** — lỗi của bạn, không phải bug của app |

Từ quan trọng nhất ở đây: **"không phán được" KHÔNG bằng PASS.** Bài 11 dạy cách phân loại.

### 7. Bằng chứng (**evidence**)

Ảnh hoặc video chứng minh case đã chạy thật và kết quả đúng như bạn nói.

> Ảnh chụp màn hình lúc Tổng cộng hiện `515.000`, có khoanh đỏ vào đúng con số đó.

File `.txt` ghi *"đã test, pass"* **không phải** bằng chứng — nó chỉ là bạn nói lại lần nữa. Bài 12 dạy cách
chụp có khoanh đỏ và che thông tin cá nhân.

### 8. Tiền điều kiện (**precondition**)

Trạng thái phải có **trước** khi bước 1 bắt đầu.

> Muốn test "đơn đã xác nhận thì không sửa được", trước tiên phải **có** một đơn đã xác nhận. Việc tạo ra
> nó là tiền điều kiện, và nó **không** được tính là một bước của case.

Ví như trận đấu: kẻ vạch sân, dựng cầu môn — làm trước khi trọng tài thổi còi, và không tính là một pha bóng.

### 9. Test chập chờn (**flaky**)

Test mà cùng một mã, cùng một app, chạy lần này đỏ lần sau xanh.

> Nguyên nhân hay gặp nhất: test bấm nút trước khi nút hiện ra xong.

Flaky **tệ hơn** test luôn đỏ. Test luôn đỏ thì bạn sửa; test chập chờn thì bạn học cách chạy lại cho tới khi
xanh — và từ đó bạn không tin bất cứ màu nào nữa. Bài 9 và Bài 11 xử lý nó.

### 10. Agent

AI được giao **cả một chặng việc** thay vì một câu hỏi. Nó tự đọc tài liệu, tự sinh case, tự chạy, tự viết
báo cáo.

Khác biệt quan trọng: khi bạn nhờ AI viết một câu, bạn đọc câu đó rồi mới dùng. Khi bạn giao cả chặng cho
agent, **bạn không đọc từng dòng nữa** — bạn đọc bản báo cáo cuối. Và đó chính là chỗ cần máy kiểm.

## Việc 5 — Xem trước cái bạn sắp dựng (10 phút)

Đây là thư mục kit của bạn **sau khi học hết 20 bài**. Đọc qua một lượt, không cần hiểu hết — mục đích là để
sau này khi tôi nói "viết file này", bạn biết nó nằm ở đâu và cạnh cái gì.

```
kit-cua-toi/
├── CLAUDE.md                    ← Bài 3 · luật agent PHẢI đọc mỗi phiên
├── RULE_GLOBAL.md               ← Bài 3 · bản luật đầy đủ (CLAUDE.md là bản rút gọn)
├── README.md                    ← Bài 20 · người mới đọc là chạy được
├── package.json                 ← Bài 2 · khai mọi lệnh `npm run ...`
├── playwright.config.js         ← Bài 9 · cấu hình chạy test
│
├── .agent/                      ← "não" của kit: luật, cấu hình, kỹ năng
│   ├── rules/
│   │   └── core_rules.md        ← Bài 3
│   └── config/
│       ├── verdict_taxonomy.json     ← Bài 11 · danh mục phán quyết
│       ├── dimension-manifest.json   ← Bài 8 · các chiều phải phủ
│       ├── risk_model.json           ← Bài 17 · trọng số rủi ro
│       ├── mutants.json              ← Bài 19 · các lỗi cố tình tiêm
│       └── ci_scope.json             ← Bài 20 · lệnh nào chạy ở đâu
│
├── .claude/
│   └── commands/                ← Bài 18 · gõ `/phase2 ...` thay vì 6 lệnh
│       ├── phase1.md
│       └── phase2.md
│
├── prompt_templates/            ← Bài 4 · bản mẫu ra lệnh cho agent
│   ├── phase1/                  ·  sinh testcase
│   └── phase2/                  ·  chạy test
│
├── scripts/
│   ├── lib/                     ← thư viện dùng chung (KHÔNG tự chạy)
│   │   ├── testcase/            ·  Bài 5 · đọc/ghi bảng testcase
│   │   ├── verdict.js           ·  Bài 11
│   │   └── gate.js              ·  Bài 14 · khung chung cho mọi máy kiểm
│   └── qa/                      ← MÁY KIỂM (mỗi file tự chạy được, chặn được)
│       ├── evidence_gate.js     ·  Bài 13 · máy đầu tiên bạn viết
│       ├── inventory_gate.js    ·  Bài 14
│       ├── self_review.js       ·  Bài 14 · gọi mọi máy kiểm một lượt
│       ├── policy_check.js      ·  Bài 15 · chống luật bị trôi
│       └── tiem-loi.js          ·  Bài 19 · đo chính bộ kiểm
│
├── tests/
│   ├── support/                 ← hạ tầng test (dùng chung mọi test)
│   │   ├── fixtures/            ·  Bài 10 · dựng/dọn dữ liệu
│   │   ├── evidence.js          ·  Bài 12 · chụp ảnh có khoanh đỏ
│   │   └── factory.js           ·  Bài 10 · tạo dữ liệu qua API
│   ├── e2e/                     ← Bài 9 · test qua giao diện
│   └── api/                     ← Bài 18 · test gọi thẳng API
│
├── knowledge/                   ← Bài 16 · bộ nhớ dự án. KHÔNG commit
├── profiles/
│   └── <MÃ-TASK>/task.env       ← Bài 2 · URL + tài khoản. KHÔNG commit
└── outputs/                     ← kết quả mỗi lượt chạy. KHÔNG commit
    └── tasks/<MÃ-TASK>/
        ├── test-cases/          ·  bảng case đã sinh
        ├── test-results/        ·  phán quyết từng case
        └── evidence/            ·  ảnh và video
```

Ba chỗ đáng để ý ngay từ giờ, vì người mới hay xếp sai:

| Thư mục | Chứa gì | Phân biệt bằng câu hỏi |
|---|---|---|
| `scripts/lib/` | **thư viện** — code dùng chung | *"Gõ `node <file>` có chạy được không?"* Không ⇒ nó ở `lib/` |
| `scripts/qa/` | **máy kiểm** — tự chạy, chặn được | Có, và nó **báo lỗi rồi thoát** ⇒ nó ở `qa/` |
| `tests/support/` | **hạ tầng test** — không phải test | Không có `test(...)` trong file ⇒ nó ở `support/` |

Và ba thư mục **không bao giờ** đưa lên git — `knowledge/` (dữ liệu nghiệp vụ của công ty), `profiles/` (tài
khoản, mật khẩu), `outputs/` (kết quả từng lượt chạy, đổi liên tục). Bài 2 sẽ dựng `.gitignore` cho chúng.

> **Bạn không phải tạo cây này bây giờ.** Mỗi bài tạo đúng phần của nó, và mỗi bài đều có một khối
> **"Cây thư mục sau bài này"** để bạn đối chiếu.

## Tự kiểm

Trả lời được bằng lời của bạn thì đi tiếp. Không được thì đọc lại mục tương ứng.

1. App thực hành đang chạy ở địa chỉ nào? Dừng nó bằng cách nào?
2. Vì sao tài liệu này cho bạn một app **có bug cài sẵn** thay vì một app đúng?
3. Ở Việc 3, `485.000` và `515.000` — số nào là kết quả mong đợi độc lập? Vì sao số kia không phải?
4. "Máy kiểm" khác "lời dặn" ở chỗ nào? Cho một ví dụ ngoài đời.
5. Một case chạy được, app trả số khác spec ⇒ phán quyết gì? Còn case không đăng nhập được nên không chạy
   nổi ⇒ phán quyết gì?
6. Bạn có hai cửa sổ terminal. Cửa nào làm gì?

## Bài tập về nhà (15 phút)

Làm lại Việc 3, nhưng đổi khách sang `Lê Văn C — hạng Vàng` và sản phẩm sang `Đèn bàn — 175.000 đ`, số
lượng `1`.

1. Ghi lại bốn số trên màn hình.
2. Tự tính bốn số đó từ `spec.md`.
3. **Cộng thử các số đang hiện trên màn hình**: số Tạm tính, trừ số Giảm giá, cộng số Phí giao hàng. Có ra
   đúng số Tổng cộng đang hiện không?

Câu 3 là câu quan trọng. Nếu bạn thấy có gì lạ — ghi nó vào một file `ghi-chu.md`, đừng vội kết luận. Bài 7
sẽ dạy bạn cách biến "thấy lạ" thành "chứng minh được sai".

## Bài sau

Bài 1 trả lời câu hỏi: *bạn vừa tìm được bug bằng tay trong 15 phút — vậy giao cho AI thì sao?*

Bạn sẽ tự tay bảo agent test đúng ca đó, và **xem nó làm cho test xanh** dù app sai. Không phải nghe kể —
xem trên máy bạn.
