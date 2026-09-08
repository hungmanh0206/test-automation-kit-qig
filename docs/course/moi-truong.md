# Bài 4 — Claude Code: cài đặt và chế độ an toàn

> **2 giờ** · Có gì trong tay: một máy tính trắng · Sau bài này: agent chạy được trên repo của bạn, có kiểm soát

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Cho agent tự do sửa source thật là chuyện chỉ cần sai một lần cũng đủ mệt. |
| **Bài này bạn gõ gì** | Cài công cụ, đặt chế độ quyền, rồi thử bảo agent xoá một thư mục xem quyền có chặn không. |
| **Xong thì được gì** | Agent chạy được trên repo của bạn, và bạn biết chắc nó bị chặn ở chỗ nào. |

## Mục tiêu

✅ Cài Node.js LTS, Git, VS Code và kiểm từng cái chạy đúng.
✅ Cài công cụ AI agent, đăng nhập, chạy prompt đầu tiên.
✅ Hiểu và cấu hình permission mode.
✅ Tạo repo, clone về, commit đầu tiên.
✅ Nắm danh sách không bao giờ commit.
✅ Thực hành: kiểm agent có bị chặn đúng chỗ mình cấu hình.

---

## 1. Cài và **nghiệm thu** từng công cụ

Nguyên tắc từ bài này trở đi: **cài xong phải chạy một câu lệnh chứng minh nó hoạt động**. Đây là phiên bản
nhỏ nhất của thứ bạn sẽ làm suốt khoá — không tin lời khai, đo bằng lệnh.

### Node.js

Cài bản **LTS** (đừng bản Current — thư viện thường chưa theo kịp).

```bash
node --version    # phải in ra v20.x hoặc v22.x
npm --version
```

Nếu `node` không tìm thấy sau khi cài: mở lại terminal. Trên Windows, mở lại cả VS Code.

### Git

```bash
git --version
git config --global user.name "Tên Bạn"
git config --global user.email "email@congty.com"
```

Hai lệnh `config` không phải tuỳ chọn — thiếu nó thì commit không có tác giả và về sau không truy được ai sửa gì.

### VS Code

Cài, rồi mở thư mục làm việc bằng **File → Open Folder**. Nghe hiển nhiên nhưng đây là nguyên nhân số một của
lỗi *"AI không tìm thấy file"*: mở sai cấp thư mục thì agent không thấy repo.

## 2. Cài công cụ AI agent

Tài liệu này viết theo Claude Code, nhưng nguyên tắc áp cho mọi agent chạy trong terminal hoặc IDE.

```bash
node --version          # cần đạt bản tối thiểu mà công cụ yêu cầu
# cài theo hướng dẫn chính thức của công cụ, rồi:
claude --version
```

Đăng nhập theo luồng của công cụ. Sau đó **chạy prompt đầu tiên trên một thư mục thật**, không phải thư mục
trống:

```
Đọc file README.md trong thư mục này và tóm tắt trong 3 câu. Không sửa gì cả.
```

Nếu nó tóm tắt được → agent đang thấy đúng thư mục. Nếu nó nói không tìm thấy file → bạn đang mở sai cấp.

## 3. Permission mode — phần quan trọng nhất của bài

Agent có thể **đọc, ghi, xoá file và chạy lệnh terminal**. Trên source thật của công ty, đó là quyền rất lớn.

Hầu hết công cụ có ít nhất ba mức:

| Mức | Hành vi | Dùng khi |
|---|---|---|
| **Hỏi trước mỗi việc** | Mỗi lần ghi file hoặc chạy lệnh đều xin phép | Tuần đầu, và mãi mãi khi làm trên nhánh chính |
| **Tự động trong phạm vi cho phép** | Được ghi/chạy trong danh sách đã khai, ngoài ra phải hỏi | Khi bạn đã biết nó hay làm gì |
| **Tự do** | Không hỏi | Chỉ trên nhánh riêng, thư mục nháp, hoặc container |

**Bắt đầu ở mức 1.** Không phải vì agent nguy hiểm, mà vì bạn cần **thấy** nó định làm gì trong khoảng
mười lần đầu — đó là cách nhanh nhất hiểu nó suy nghĩa thế nào.

Ba thứ nên chặn ngay từ đầu, bất kể mức nào:

- Lệnh xoá hàng loạt (`rm -rf`, xoá thư mục).
- Lệnh git làm mất việc (`reset --hard`, `push --force`, `checkout --` lên file đang sửa).
- Mọi thứ chạm môi trường thật của khách hàng.

> **Quy tắc nhớ đời:** agent bị từ chối một lệnh thì nó chỉ đi đường khác. Agent chạy một lệnh xoá thì bạn
> mất việc. Chi phí hai bên không đối xứng, nên mặc định phải là *hỏi trước*.

## 4. Repo và commit đầu tiên

Tạo repo rỗng trên GitHub hoặc GitLab (đặt **private** nếu là việc công ty), rồi:

```bash
git clone <đường-dẫn-repo>
cd <tên-repo>

printf 'node_modules/\n.env\n.env.*\n!.env.example\noutputs/\nknowledge/\nprofiles/*/task.env\n' > .gitignore
printf '# Bộ kit QA của tôi\n\nĐang dựng theo khoá học.\n' > README.md

git add .gitignore README.md
git commit -m "chore: khởi tạo repo — .gitignore và README"
git push
```

Để ý: **`.gitignore` được viết trước cả README**. Đó là chủ ý — một lần `git add .` khi chưa có `.gitignore`
là đủ để đẩy thứ không nên đẩy lên, và lịch sử git thì không xoá sạch dễ dàng.

## 5. Danh sách không bao giờ commit

| Loại | Ví dụ | Vì sao |
|---|---|---|
| Bí mật hệ thống | token, password, cookie, khoá API, file service-account | Lọt vào lịch sử là phải xoay vòng lại toàn bộ |
| Dữ liệu khách | email, số điện thoại, họ tên, địa chỉ, ảnh chưa che | Rò rỉ thật, không phải rủi ro lý thuyết |
| Kết quả chạy | thư mục output, ảnh và video bằng chứng | Nặng, và thường chứa dữ liệu khách |
| Bộ nhớ dự án | thư mục knowledge sau này | Dữ liệu công ty — đối xử như `.env` |
| File tạm | dump API, script nháp | Hay chứa dữ liệu mẫu là dữ liệu thật |

Đây là mục **1 trong 6 điều không-thương-lượng** mà bạn sẽ viết ở Bài 2.

> Một chuyện thật đáng nhớ: bảy file nháp dump API còn sót ở thư mục gốc, chưa được `.gitignore`. Trong đó
> có dump chứa **24 email và 6 số điện thoại** ở phần giá trị mẫu. Một lần `git add .` là xong. Cách chữa
> không phải "nhớ cẩn thận" mà là **thêm mẫu `scratch_*` vào `.gitignore`** — lại là forcing function.

## 6. Vì sao chưa cài Playwright ở bài này

Bạn sẽ cần nó, nhưng ở **Bài 12**. Cài sớm thì nó nằm đó ba bài không dùng, và bạn mất cơ hội hiểu vì sao cần.
Nguyên tắc của khoá: **cài khi có việc cho nó làm.**

---

## Thực hành (45 phút)

### Bước 1 — Nghiệm thu môi trường

Chạy và dán kết quả vào một file `docs/moi-truong.md` trong repo:

```bash
node --version
npm --version
git --version
git config --get user.name
git config --get user.email
claude --version
```

Sáu dòng đều có kết quả → xong bước này. Thiếu dòng nào thì sửa trước khi đi tiếp.

### Bước 2 — Prompt đầu tiên có kiểm chứng

Yêu cầu agent:

```
Trong thư mục này, tạo file docs/hello.md với nội dung đúng một dòng: "Agent đã ghi được file."
Sau đó đọc lại file và in ra nội dung.
```

Quan sát **ba** thứ:
1. Nó có **xin phép** trước khi ghi không? (nếu không → permission mode đang quá lỏng, sửa lại)
2. Nó có tạo đúng đường dẫn `docs/hello.md` không?
3. Nó có **đọc lại** để tự xác nhận, hay chỉ báo "đã xong"?

Điểm 3 là thứ bạn sẽ đòi hỏi suốt khoá: **báo xong mà không kiểm lại thì chưa xong.**

### Bước 3 — Thử một lệnh nên bị chặn

Yêu cầu agent:

```
Xoá toàn bộ thư mục docs.
```

Kết quả đúng là: nó **hỏi trước**, và bạn **từ chối**. Nếu nó xoá luôn mà không hỏi thì permission mode của
bạn chưa đúng — sửa rồi thử lại. Đây là bài kiểm tra cấu hình, không phải bài kiểm tra agent.

### Bước 4 — Commit

```bash
git add docs/
git commit -m "docs: nghiệm thu môi trường + thử quyền của agent"
git push
```

---

## Cây thư mục sau bài này

```
kit-cua-toi/
├── package.json                  ← MỚI · nơi khai mọi lệnh `npm run ...`
├── playwright.config.js          ← MỚI · bản tối thiểu, sẽ mở rộng ở Bài 13
├── .gitignore                    ← MỚI · chặn 3 thư mục không được commit
├── profiles/
│   └── DEMO-1/task.env           ← MỚI · URL + tài khoản. ⛔ KHÔNG commit
├── scripts/qa/
│   └── kiem-so-mong-doi.js       ·  từ Bài 1
└── tests/api/
    └── don-hang-bac.js           ·  từ Bài 1
```

## Tự kiểm

- [ ] Sáu lệnh kiểm phiên bản đều in ra kết quả.
- [ ] Agent đọc được file trong repo của tôi.
- [ ] Agent **xin phép** trước khi ghi file.
- [ ] Tôi đã thử một lệnh nguy hiểm và nó bị chặn đúng như mong đợi.
- [ ] `.gitignore` của tôi đã có `.env`, `node_modules/`, và thư mục output.
- [ ] Tôi kể được 5 loại dữ liệu không bao giờ commit.
- [ ] Repo của tôi đã có ít nhất 2 commit và đã push lên.

## Bài tập về nhà

Mở lịch sử git của một repo bạn đang tham gia, tìm xem có file nào **đáng lẽ không nên** ở đó không: `.env`,
dump dữ liệu, ảnh chụp có thông tin khách. Không cần sửa — chỉ cần biết. Ở Bài 11 bạn sẽ dựng máy quét việc này.

## Đọc thêm

- Tài liệu permission mode của công cụ bạn dùng — đọc kỹ phần danh sách cho phép, vì Bài 2 sẽ dùng tới.
