# Bài 4 — Claude Code: cài đặt và chế độ an toàn

> **2 giờ** · Có gì trong tay: kiến trúc đã vẽ, chưa có repo · Sau bài này: agent chạy được trên repo của bạn, và bạn biết nó bị chặn ở đâu

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Cho agent tự do sửa source thật là chuyện chỉ cần sai một lần cũng đủ mệt. |
| **Bài này bạn gõ gì** | Cài công cụ, đặt chế độ quyền, rồi thử bảo agent xoá một thư mục xem quyền có chặn không. |
| **Xong thì được gì** | Agent chạy được trên repo của bạn, và bạn biết chắc nó bị chặn ở chỗ nào. |

## Từ mới của bài này

| Từ | Nghĩa gọn |
|---|---|
| **Chế độ quyền** (permission mode) | Cấu hình quyết định agent được tự làm gì, và việc gì phải hỏi bạn trước |
| **Nghiệm thu** | Cài xong thì chạy một lệnh để chứng minh nó hoạt động, không tin lời khai |

## Bài này bạn sẽ làm gì

Bốn việc:

1. Cài công cụ, và nghiệm thu từng cái bằng một câu lệnh (25 phút).
2. Đặt chế độ quyền cho agent (30 phút).
3. Tạo repo, viết `.gitignore` trước cả README (20 phút).
4. Thử bảo agent xoá thư mục, xem quyền có chặn không (25 phút).

---

## Việc 1 — Cài và nghiệm thu (25 phút)

Từ bài này trở đi có một thói quen: cài xong thì chạy một lệnh chứng minh nó hoạt động. Đừng tin lời khai
của trình cài đặt.

### Node.js

Cài bản **LTS**. Đừng lấy bản Current, vì thư viện thường chưa theo kịp.

```bash
node --version    # phải in ra v20.x hoặc v22.x
npm --version
```

Cài xong mà gõ `node` vẫn báo không tìm thấy thì mở lại terminal. Trên Windows thì mở lại cả VS Code.

### Git

```bash
git --version
git config --global user.name "Tên Bạn"
git config --global user.email "email@congty.com"
```

Hai lệnh `config` không phải tuỳ chọn. Thiếu chúng thì commit không có tác giả, và sau này không truy được
ai sửa gì.

### VS Code

Cài xong thì mở thư mục làm việc bằng **File → Open Folder**.

Nghe hiển nhiên, nhưng đây là nguyên nhân số một của lỗi "AI không tìm thấy file". Mở sai cấp thư mục thì
agent không nhìn thấy repo.

### Công cụ agent

Tài liệu này viết theo Claude Code. Nguyên tắc thì áp được cho mọi agent chạy trong terminal hoặc IDE.

```bash
claude --version
```

Đăng nhập theo luồng của công cụ. Rồi chạy prompt đầu tiên trên một thư mục thật, đừng chạy trên thư mục trống:

```
Đọc file README.md trong thư mục này và tóm tắt trong 3 câu. Không sửa gì cả.
```

Nó tóm tắt được thì agent đang nhìn đúng thư mục. Nó nói không tìm thấy file thì bạn đang mở sai cấp.

## Việc 2 — Chế độ quyền (30 phút)

Đây là phần quan trọng nhất của bài.

Agent đọc file được, ghi file được, xoá file được, và chạy lệnh terminal được. Trên source thật của công ty
thì đó là quyền rất lớn.

Công cụ nào cũng có ít nhất ba mức:

| Mức | Agent làm gì | Dùng khi nào |
|---|---|---|
| Hỏi trước mỗi việc | Mỗi lần ghi file hoặc chạy lệnh đều xin phép | Tuần đầu. Và mãi mãi, khi làm trên nhánh chính |
| Tự động trong phạm vi cho phép | Được ghi và chạy trong danh sách đã khai. Ngoài danh sách thì hỏi | Khi bạn đã biết nó hay làm gì |
| Tự do | Không hỏi gì | Chỉ trên nhánh riêng, thư mục nháp, hoặc trong container |

Hãy bắt đầu ở mức 1. Không phải vì agent nguy hiểm, mà vì bạn cần nhìn thấy nó định làm gì trong mười lần
đầu. Đó là cách nhanh nhất để hiểu nó nghĩ kiểu gì.

Ba thứ nên chặn ngay từ đầu, bất kể bạn đang ở mức nào:

- Lệnh xoá hàng loạt, kiểu `rm -rf` hoặc xoá cả thư mục.
- Lệnh git làm mất việc: `reset --hard`, `push --force`, `checkout --` lên file đang sửa.
- Mọi thứ chạm vào môi trường thật của khách hàng.

Lý do đơn giản. Agent bị từ chối một lệnh thì nó chỉ đi đường khác, bạn mất vài giây. Agent chạy trúng một
lệnh xoá thì bạn mất việc cả buổi. Hai bên không cân nhau, nên mặc định phải là hỏi trước.

## Việc 3 — Repo và commit đầu tiên (20 phút)

Tạo repo rỗng trên GitHub hoặc GitLab. Để **private** nếu là việc công ty. Rồi:

```bash
git clone <đường-dẫn-repo>
cd <tên-repo>

printf 'node_modules/\n.env\n.env.*\n!.env.example\noutputs/\nknowledge/\nprofiles/*/task.env\n' > .gitignore
printf '# Bộ kit QA của tôi\n\nĐang dựng theo tài liệu hướng dẫn.\n' > README.md

npm init -y
git add .gitignore README.md package.json
git commit -m "chore: khởi tạo repo — .gitignore, README, package.json"
git push
```

`npm init -y` tạo ra `package.json`. Từ giờ mọi lệnh bạn viết đều khai vào đó, ở mục `scripts`. Lý do là để
người khác gõ `npm run <tên>` thay vì phải nhớ đường dẫn dài. Bài 5 sẽ thêm lệnh đầu tiên vào đây.

Để ý thứ tự: `.gitignore` được viết trước cả README. Đó là cố ý. Chỉ cần một lần `git add .` lúc chưa có
`.gitignore` là đủ đẩy thứ không nên đẩy lên, mà lịch sử git thì không xoá sạch được dễ dàng.

### Năm loại không bao giờ commit

| Loại | Ví dụ | Vì sao |
|---|---|---|
| Bí mật hệ thống | token, mật khẩu, cookie, khoá API, file khoá dịch vụ | Lọt vào lịch sử là phải đổi lại toàn bộ |
| Dữ liệu khách | email, số điện thoại, tên, địa chỉ, ảnh chưa che | Rò rỉ thật, không phải rủi ro trên lý thuyết |
| Kết quả chạy | thư mục output, ảnh và video bằng chứng | Nặng, và hay chứa dữ liệu khách |
| Bộ nhớ dự án | thư mục `knowledge/` sau này | Dữ liệu công ty. Đối xử như `.env` |
| File tạm | dump API, script nháp | Hay chứa "dữ liệu mẫu" mà thật ra là dữ liệu thật |

Một chuyện có thật đáng nhớ. Bảy file nháp dump API còn sót ở thư mục gốc, chưa ai cho vào `.gitignore`.
Trong đó có một file chứa 24 email và 6 số điện thoại ở phần giá trị mẫu. Một lần `git add .` là xong.

Cách chữa không phải là dặn nhau cẩn thận hơn. Cách chữa là thêm mẫu `scratch_*` vào `.gitignore`.

## Việc 4 — Thử một lệnh đáng lẽ phải bị chặn (25 phút)

### Bước 1: agent ghi file được chưa

Yêu cầu agent:

```
Trong thư mục này, tạo file docs/hello.md với nội dung đúng một dòng: "Agent đã ghi được file."
Sau đó đọc lại file và in ra nội dung.
```

Nhìn ba thứ:

1. Nó có xin phép trước khi ghi không? Không xin thì chế độ quyền đang quá lỏng, sửa lại.
2. Nó có tạo đúng đường dẫn `docs/hello.md` không?
3. Nó có đọc lại để tự xác nhận, hay chỉ báo "đã xong"?

Điểm 3 là thứ bạn sẽ đòi hỏi suốt: báo xong mà không kiểm lại thì chưa gọi là xong.

### Bước 2: thử lệnh nguy hiểm

Yêu cầu agent:

```
Xoá toàn bộ thư mục docs.
```

Kết quả đúng là nó hỏi trước, và bạn từ chối. Nếu nó xoá luôn không hỏi thì chế độ quyền của bạn chưa đúng.
Sửa rồi thử lại.

Đây là bài kiểm tra cấu hình của bạn, không phải bài kiểm tra agent.

### Bước 3: commit

```bash
git add docs/
git commit -m "docs: nghiệm thu môi trường + thử quyền của agent"
git push
```

## Việc phụ — vì sao chưa cài Playwright ở bài này

Bạn sẽ cần Playwright, nhưng ở Bài 12. Cài sớm thì nó nằm đó tám bài không ai dùng, và bạn mất cơ hội hiểu
vì sao cần tới nó.

Nguyên tắc chung: cài khi đã có việc cho nó làm.

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .gitignore                    ← MỚI · viết TRƯỚC cả README
├── README.md                     ← MỚI · một dòng cũng được, Bài 26 sẽ viết tử tế
├── package.json                  ← MỚI · nơi khai mọi lệnh npm run
├── CLAUDE.md                     ·  từ Bài 2
├── LUAT-DAY-DU.md                ·  từ Bài 2
├── docs/
│   └── moi-truong.md             ← MỚI · dán kết quả nghiệm thu vào đây
├── profiles/
│   └── task.env.example          ·  từ Bài 2
├── scripts/qa/
│   └── kiem-so-mong-doi.js       ·  từ Bài 1
└── tests/api/
    └── don-hang-bac.js           ·  từ Bài 1
```

## Tự kiểm

1. Vì sao cài xong phải chạy một lệnh kiểm, thay vì tin trình cài đặt?
2. Ba mức quyền là gì? Bạn nên bắt đầu ở mức nào, và vì sao?
3. Ba loại lệnh nên chặn ngay từ đầu?
4. Vì sao chi phí "agent bị chặn oan" và "agent xoá nhầm" không cân nhau?
5. Vì sao `.gitignore` được viết trước README?
6. Kể 5 loại dữ liệu không bao giờ commit.
7. Ở Bước 1, ngoài chuyện nó ghi được file, bạn còn nhìn thứ gì nữa?

## Bài tập về nhà

Mở lịch sử git của một repo bạn đang tham gia. Tìm xem có file nào đáng lẽ không nên nằm ở đó không: `.env`,
dump dữ liệu, ảnh chụp có thông tin khách.

Chưa cần sửa, chỉ cần biết. Bài 5 bạn sẽ dựng máy quét đúng chuyện này.

## Bài sau

Bài 5 dạy git từ đầu: commit, nhánh, và một máy chặn không cho tệp cấm lọt lên repo. Trong đó có bài học đắt
nhất về `knowledge/`: không phải nội dung, mà chính tên file đã tiết lộ lỗi sản phẩm.
