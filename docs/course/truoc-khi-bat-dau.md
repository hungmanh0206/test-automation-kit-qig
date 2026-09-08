# Trước khi bắt đầu

> **1 giờ** · Có gì trong tay: chưa có gì · Sau bài này: app thực hành chạy được trên máy bạn, và bạn hiểu 10 từ sẽ gặp suốt các bài sau

**Vấn đề**

Bạn đọc tới dòng thứ ba của một tài liệu automation và gặp ba từ chưa từng nghe: fixture,
assertion, oracle.

Bạn tra từ thứ nhất. Định nghĩa của nó dùng thêm hai từ lạ nữa.

Ba mươi phút sau bạn đã mở bảy tab và chưa gõ dòng nào.


**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Bạn muốn dựng bộ kit nhưng chưa có gì để thử. Mấy từ sắp gặp cũng chưa rõ nghĩa. |
| **Bài này bạn gõ gì** | Kiểm máy có Node chưa, chạy app thực hành, rồi tạo một đơn hàng bằng tay. |
| **Xong thì được gì** | App chạy trên máy bạn. 10 từ vựng hiểu qua ví dụ. Và một bug bạn tự tìm ra sau 40 phút. |

## Bài này bạn sẽ làm gì

Năm việc, việc nào cũng gõ tay:

1. Xem máy đã có Node.js chưa (5 phút).
2. Chạy app thực hành, mở nó trên trình duyệt (10 phút).
3. Tạo một đơn hàng bằng tay, ghi lại bốn con số (15 phút).
4. Học 10 từ sẽ gặp suốt các bài sau. Học qua ví dụ, không học định nghĩa (30 phút).
5. Xem trước cây thư mục của bộ kit bạn sắp dựng (10 phút).

Hết bài này bạn chưa viết dòng test nào. Nhưng bạn có một app để test, và biết mình đang nói về cái gì.

## Tài liệu này dành cho ai

| Hợp với bạn nếu | Chưa hợp nếu |
|---|---|
| Bạn làm QA, hoặc đang muốn làm | Bạn chưa từng đọc một bảng testcase nào. Học kiểm thử tay trước đã |
| Bạn từng viết testcase bằng tay, Excel hay Google Sheet đều được | Bạn muốn AI test hộ rồi khỏi kiểm lại. Tài liệu này dạy ngược lại |
| Bạn đọc được code đơn giản kiểu `if (a > b) { … }` | Bạn chưa từng thấy code. Dành một hai tuần học JavaScript cơ bản rồi quay lại |
| Bạn đã dùng ChatGPT hay Claude để nhờ việc | |

Không cần biết trước Playwright, CI/CD, Docker, cách gọi API hay cách viết gate. Tới lúc cần thì có bài dạy.

## Việc 1 — Xem máy có Node.js chưa (5 phút)

Node.js là thứ chạy JavaScript ngoài trình duyệt. App thực hành cần nó, và mọi máy kiểm bạn sắp viết cũng cần.

Mở terminal. Trên Windows thì bấm `Win`, gõ `Terminal`, Enter. Rồi gõ:

```bash
node --version
```

Bạn sẽ thấy một dòng kiểu:

```
v20.11.1
```

| Bạn thấy gì | Nghĩa là | Làm gì |
|---|---|---|
| `v20.x` trở lên | Đủ dùng | Đi tiếp |
| `v18.x` | Vẫn chạy được | Đi tiếp |
| `v16.x` trở xuống | Quá cũ, sẽ gặp lỗi khó hiểu ở Bài 9 | Cài lại bản mới ở nodejs.org |
| `node: command not found` hoặc `'node' is not recognized` | Máy chưa có Node | Vào nodejs.org, tải bản LTS, cài xong thì mở terminal mới rồi gõ lại |

Chỗ hay vấp: cài xong mà gõ vẫn báo không tìm thấy. Lý do là cửa sổ terminal đang mở không biết bạn vừa cài
gì. Đóng nó, mở cái mới.

## Việc 2 — Chạy app thực hành (10 phút)

Cả tài liệu này thực hành trên một app duy nhất: một cửa hàng bán hàng bé xíu, chạy ngay trên máy bạn.

Vì sao không thực hành trên app của công ty? Ba lý do. Bạn phải xin quyền. Bạn có thể làm hỏng dữ liệu người
khác đang dùng. Và lý do lớn nhất: bạn không biết app đó có bao nhiêu bug. Nên khi bộ kiểm của bạn báo xanh,
bạn không biết là app đúng hay là bộ kiểm không nhìn thấy gì.

Với app thực hành thì bạn biết trước. Nó có đúng 3 bug, cài sẵn, cố ý.

Gõ:

```bash
node docs/course/assets/app-thuc-hanh/server.js
```

Bạn sẽ thấy đúng hai dòng:

```
Cửa hàng mini đang chạy: http://localhost:4010
Dừng: Ctrl + C
```

Mở trình duyệt vào `http://localhost:4010`. Trang có chữ Cửa hàng mini ở trên. Bên dưới là khung
**Tạo đơn hàng** với ô chọn khách, ô chọn sản phẩm, ô số lượng và nút **Thêm**.

| Bạn thấy gì | Nghĩa là | Làm gì |
|---|---|---|
| Hai dòng trên, và trang mở được | Xong | Đi tiếp |
| `Error: listen EADDRINUSE` | Cổng 4010 đang bị chương trình khác chiếm | Gõ `PORT=4011 node docs/course/assets/app-thuc-hanh/server.js` rồi mở cổng 4011 |
| `Cannot find module` | Bạn đang đứng sai thư mục | `cd` về thư mục gốc của repo, gõ lại nguyên đường dẫn trên |
| Trang trắng, có chữ "Không nối được server" | Server đã tắt | Nhìn lại cửa sổ terminal. Bạn có vừa bấm `Ctrl + C` không? |

Để cửa sổ terminal này chạy suốt buổi. Muốn gõ lệnh khác thì mở cửa sổ thứ hai.

Đây là chỗ làm người mới bối rối nhất trong ngày đầu: một cửa sổ để app chạy, một cửa sổ để bạn làm việc.

## Việc 3 — Tạo một đơn hàng bằng tay (15 phút)

Trước khi tự động hoá cái gì, hãy làm bằng tay một lần. Không phải cho có. Lý do đơn giản là bạn không tự
động hoá được thứ bạn chưa từng làm.

Trên trang web:

1. Ô **Khách hàng**, chọn `Trần Thị B — hạng Bạc`.
2. Ô **Sản phẩm**, chọn `Bàn gỗ — 250.000 đ`.
3. Ô **Số lượng**, sửa thành `2`.
4. Bấm **Thêm**.

Một dòng hiện ra trong bảng giỏ hàng, và bốn con số hiện ra bên dưới. Ghi lại đã:

| Nhãn | Số bạn thấy trên màn hình |
|---|---|
| Tạm tính | |
| Giảm giá | |
| Phí giao hàng | |
| Tổng cộng | |

Giờ mở file [`spec.md`](assets/app-thuc-hanh/spec.md). Đây là đặc tả, tức là bản mô tả app *phải* làm gì.
Đọc bốn luật `BR-01` đến `BR-04`, rồi tự tính bốn con số đó bằng máy tính tay:

- `BR-01` Tạm tính = 250.000 × 2 = **500.000**
- `BR-02` Giảm giá cho hạng Bạc là 3% = 500.000 × 3% = **15.000**
- `BR-03` Tạm tính là 500.000, từ 500.000 trở lên thì miễn phí giao hàng, nên phí = **0**
- `BR-04` Tổng cộng = 500.000 − 15.000 + 0 = **485.000**

So với bảng bạn vừa ghi.

Hai bên không khớp. Màn hình hiện Phí giao hàng **30.000 đ** và Tổng cộng **515.000 đ**.

Bạn vừa tìm ra một trong ba bug, bằng tay, ở phút thứ 40. Nhưng cách bạn tìm ra nó mới là chỗ đáng nhớ:

> Bạn không hỏi app xem nó tính đúng chưa. Bạn tự tính từ đặc tả, rồi mới so.

Đó là ý tưởng chạy suốt tài liệu này. Nếu bạn hỏi app "tổng cộng bao nhiêu" rồi lấy chính câu trả lời đó
đem so, thì lúc nào cũng khớp. Và khớp kiểu đó không chứng minh được gì.

> ⚠ Đừng mở `BUGS.md` vội. Trong đó là đáp án cả 3 bug. Tự tìm ra chúng là phần đáng giá nhất.

## Việc 4 — Mười từ (30 phút)

Mười từ này sẽ gặp lại rất nhiều lần. Mỗi từ có một ví dụ lấy từ đúng việc bạn vừa làm ở Việc 3.

### 1. Testcase

Một lần kiểm cụ thể, viết ra để người khác làm lại được. Nó phải nói rõ: kiểm cái gì, cần chuẩn bị gì trước,
làm những bước nào, và đúng thì ra sao.

Việc 3 vừa rồi là một testcase, chỉ là bạn chưa viết nó ra giấy. Bài 13 dạy cách viết.

### 2. Kết quả mong đợi độc lập (oracle)

Con số hoặc trạng thái đúng, tính ra mà không dùng tới app.

`485.000` là kết quả mong đợi độc lập, vì bạn tính nó từ `spec.md` bằng máy tính tay. Còn `515.000` thì
không, vì đó là app tự nói về chính nó.

Giống đi mua gạo. Bạn không cân gạo bằng cân của người bán rồi hỏi người bán xem cân có đúng không. Bạn mang
cân riêng đi. Cái cân riêng đó là oracle.

Đây là từ quan trọng nhất trong mười từ. Bài 13 dành cả hai tiếng chỉ để nói về nó.

### 3. Bản gốc (canonical)

Bản được coi là thật. Mọi bản khác phải sinh ra từ nó, và không được sửa riêng.

`spec.md` là bản gốc cho câu hỏi "đúng là gì". Nếu bạn chép luật ra một file khác rồi sửa file đó, hai file
sẽ lệch nhau. Lúc đó không ai biết bản nào mới đúng.

Giống giấy khai sinh. Bản chính chỉ một tờ, photo bao nhiêu bản cũng được. Nhưng sửa trên bản photo thì bản
photo sai, chứ bản chính vẫn thế.

### 4. Máy kiểm (gate)

Một đoạn chương trình đọc kết quả làm việc của bạn, thấy sai chuẩn thì chặn lại. Chặn, chứ không phải nhắc.

Ví dụ bạn sẽ viết ở Bài 17: một máy đọc danh sách case đã chạy, thấy case nào ghi PASS mà không kèm ảnh
chứng minh thì nó báo lỗi và không cho đi tiếp.

Giống cửa soát vé. Nhân viên có thể nhắc "nhớ mua vé nhé". Còn cửa soát vé thì không mở.

### 5. Lời dặn và máy chặn (forcing function)

Luật mà không có máy đứng sau thì chỉ là lời dặn. Lời dặn thì sẽ có lúc bị bỏ qua. Không phải vì ai xấu, mà
vì lúc gấp thì người ta quên.

"Nhớ chụp ảnh mỗi case nhé" là lời dặn. Máy chặn khi case không có ảnh mới là forcing function.

Cả tài liệu này là chuyện biến lời dặn thành máy chặn.

### 6. Phán quyết (verdict)

Kết luận về một case sau khi chạy. Không chỉ có PASS với FAIL:

| Phán quyết | Nghĩa |
|---|---|
| `PASS` | Chạy được, và khớp kết quả mong đợi |
| `FAIL` | Chạy được, nhưng không khớp. Có thể là bug thật |
| `BLOCKED` | Không chạy được vì thứ khác chặn, ví dụ app sập hoặc không đăng nhập được |
| `SETUP_FAILURE` | Không chạy được vì chuẩn bị dữ liệu hỏng. Lỗi của bạn, không phải bug của app |

Điều cần nhớ: "không kết luận được" thì không được ghi thành PASS. Bài 17 dạy cách phân loại.

### 7. Bằng chứng (evidence)

Ảnh hoặc video chứng minh case đã chạy thật, và kết quả đúng như bạn nói.

Ví dụ: ảnh chụp lúc Tổng cộng hiện `515.000`, có khoanh đỏ vào đúng con số đó.

File `.txt` ghi "đã test, pass" thì không tính. Đó chỉ là bạn nói lại lần nữa thôi. Bài 17 dạy cách chụp có
khoanh đỏ và che thông tin cá nhân.

### 8. Tiền điều kiện (precondition)

Trạng thái phải có sẵn trước khi bước 1 bắt đầu.

Muốn test "đơn đã xác nhận thì không sửa được", trước tiên phải có một đơn đã xác nhận. Việc tạo ra nó là
tiền điều kiện, và nó không được tính là một bước của case.

Giống trận bóng. Kẻ vạch sân, dựng cầu môn là làm trước khi trọng tài thổi còi, và không tính là một pha bóng.

### 9. Test chập chờn (flaky)

Test mà cùng một đoạn mã, cùng một app, chạy lần này đỏ lần sau lại xanh.

Nguyên nhân hay gặp nhất là test bấm nút trước khi nút kịp hiện ra.

Loại này khó chịu hơn test luôn đỏ. Test luôn đỏ thì bạn sửa. Test chập chờn thì bạn quen dần với việc chạy
lại cho tới khi xanh. Rồi tới lúc bạn không tin màu nào nữa. Bài 9 và Bài 17 xử lý nó.

### 10. Agent

AI được giao cả một chặng việc, thay vì một câu hỏi. Nó tự đọc tài liệu, tự sinh case, tự chạy, tự viết báo cáo.

Khác biệt nằm ở chỗ này. Khi bạn nhờ AI viết một câu, bạn đọc câu đó rồi mới dùng. Khi bạn giao cả chặng cho
agent, bạn không đọc từng dòng nữa mà chỉ đọc bản báo cáo cuối. Đó chính là chỗ cần máy kiểm.

## Việc 5 — Xem trước cái bạn sắp dựng (10 phút)

Đây là thư mục kit của bạn sau khi làm hết. Đọc lướt một lượt thôi, không cần hiểu hết. Mục đích là để sau
này khi bài học nói "viết file này", bạn biết nó nằm ở đâu và cạnh cái gì.

```
kit-cua-toi/
├── CLAUDE.md                     ← Bài 5  · luật agent phải đọc mỗi lần chạy
├── LUAT-DAY-DU.md                ← Bài 5  · bản luật đầy đủ; CLAUDE.md là bản rút gọn
├── README.md                     ← Bài 28 · người mới đọc là chạy được
├── package.json                  ← Bài 2  · khai mọi lệnh npm run
├── playwright.config.js          ← Bài 9 · cấu hình chạy test
│
├── .agent/                       ← phần "não": luật và cấu hình
│   ├── rules/                    ·  Bài 5
│   └── config/
│       ├── phan-quyet.json       ← Bài 17 · danh mục phán quyết
│       ├── chieu-phu.json        ← Bài 14 · các loại câu hỏi phải phủ
│       ├── risk_model.json       ← Bài 27 · trọng số rủi ro
│       ├── mutants.json          ← Bài 25 · các lỗi cố tình tiêm vào
│       └── ci_scope.json         ← Bài 20 · lệnh nào chạy ở đâu
│
├── .claude/commands/             ← Bài 18 · gõ một dòng thay vì sáu lệnh
│
├── prompt_templates/             ← Bài 15  · bản mẫu ra lệnh cho agent
│
├── scripts/
│   ├── lib/                      ← thư viện dùng chung, không tự chạy
│   │   ├── testcase/             ·  Bài 13  · đọc và ghi bảng testcase
│   │   └── gate.js               ·  Bài 14 · khung chung cho mọi máy kiểm
│   └── qa/                       ← máy kiểm: mỗi file tự chạy được và chặn được
│       ├── kiem-so-mong-doi.js   ·  Bài 1  · máy đầu tiên bạn viết, 12 dòng
│       ├── gate-mo-ho.js         ·  Bài 15  · chưa chốt chỗ mơ hồ thì không cho đi tiếp
│       ├── gate-bang-chung.js    ·  Bài 17 · case chạy rồi mà không ảnh thì chặn
│       └── tiem-loi.js           ·  Bài 25 · đo chính bộ kiểm của bạn
│
├── tests/
│   ├── support/                  ← hạ tầng test, dùng chung mọi test
│   │   ├── factory.js            ·  Bài 9 · tạo dữ liệu qua API
│   │   └── evidence.js           ·  Bài 17 · chụp ảnh có khoanh đỏ
│   ├── api/                      ← Bài 1  · test gọi thẳng API
│   └── e2e/                      ← Bài 9 · test qua giao diện
│
├── knowledge/                    ← Bài 26 · bộ nhớ dự án. Không đưa lên git
├── profiles/<MÃ-TASK>/task.env   ← Bài 2  · URL và tài khoản. Không đưa lên git
└── outputs/                      ← kết quả mỗi lượt chạy. Không đưa lên git
    └── tasks/<MÃ-TASK>/
        ├── test-cases/           ·  bảng case đã sinh
        ├── test-results/         ·  phán quyết từng case
        └── evidence/             ·  ảnh và video
```

Ba chỗ người mới hay xếp nhầm. Phân biệt bằng một câu hỏi:

| Thư mục | Chứa gì | Hỏi thế này |
|---|---|---|
| `scripts/lib/` | thư viện, code dùng chung | Gõ `node <file>` có chạy ra gì không? Không thì cho vào `lib/` |
| `scripts/qa/` | máy kiểm, tự chạy được | Có, và nó báo lỗi rồi thoát. Vậy thì cho vào `qa/` |
| `tests/support/` | hạ tầng test, không phải test | File không có `test(...)` thì cho vào `support/` |

Ba thư mục cuối không bao giờ đưa lên git. `knowledge/` chứa dữ liệu nghiệp vụ của công ty. `profiles/` chứa
tài khoản và mật khẩu. `outputs/` là kết quả từng lượt chạy, đổi liên tục. Bài 2 sẽ dựng `.gitignore` cho chúng.

Bạn không phải tạo cây này bây giờ. Mỗi bài tạo đúng phần của nó, và bài nào cũng có khối "Cây thư mục sau
bài này" để bạn đối chiếu.

## Tự kiểm

Trả lời được bằng lời của mình thì đi tiếp. Không trả lời được thì đọc lại mục tương ứng.

1. App thực hành chạy ở địa chỉ nào? Dừng nó thế nào?
2. Vì sao tài liệu này đưa cho bạn một app có bug cài sẵn, thay vì một app đúng?
3. Ở Việc 3, `485.000` và `515.000`, số nào là kết quả mong đợi độc lập? Số kia sai ở chỗ nào?
4. Máy kiểm khác lời dặn ở chỗ nào? Cho một ví dụ ngoài đời.
5. Case chạy được nhưng app trả số khác spec thì ghi phán quyết gì? Case không đăng nhập được nên không chạy
   nổi thì ghi gì?
6. Bạn đang mở hai cửa sổ terminal. Cửa nào làm việc gì?

## Bài tập về nhà (15 phút)

Làm lại Việc 3, nhưng đổi khách sang `Lê Văn C — hạng Vàng`, sản phẩm sang `Đèn bàn — 175.000 đ`, số lượng `1`.

1. Ghi lại bốn số trên màn hình.
2. Tự tính bốn số đó từ `spec.md`.
3. Lấy máy tính cộng thử các số đang hiện: Tạm tính trừ Giảm giá cộng Phí giao hàng. Có ra đúng số Tổng cộng
   đang hiện không?

Câu 3 mới là câu chính. Nếu thấy có gì lạ thì ghi vào một file `ghi-chu.md`, đừng vội kết luận. Bài 13 sẽ dạy
cách biến "thấy lạ" thành "chứng minh được là sai".

## Bài sau

Bài 1 trả lời câu này: bạn vừa tìm ra bug bằng tay trong 15 phút, vậy giao cho AI thì sao?

Bạn sẽ tự tay bảo agent test đúng ca đó, rồi xem nó làm cho test xanh trong khi app vẫn sai. Không phải nghe
kể lại, mà xem trên máy mình.
