# Nâng bản kit cho một dự án đang dùng

> Dành cho **dự án nhận kit**, không phải người phát triển kit. Câu hỏi duy nhất tài liệu này trả lời:
> *nâng bản này có phải sửa gì trong dự án của tôi không, và làm thế nào để biết chắc?*

## Đọc số version trước khi làm gì

Kit dùng **semver**, bump theo **lần phát hành** (không theo commit):

| Đổi | Nghĩa với dự án của bạn |
|---|---|
| **MAJOR** `2.x → 3.0.0` | **Bạn BUỘC phải sửa** lớp PROJECT: đổi tên config, đổi hợp đồng script, hoặc bỏ một `npm script` bạn đang gọi. Đọc mục CHANGELOG của bản đó trước khi nâng |
| **MINOR** `2.0 → 2.1.0` | Thêm năng lực/gate. Nâng lên là chạy được ngay |
| **PATCH** `2.0.0 → 2.0.1` | Sửa lỗi, không đổi hợp đồng |

Chi tiết từng bản ở [CHANGELOG.md](../CHANGELOG.md) — mỗi mục viết theo **vấn đề → cách chữa**, nên đọc được
cả lý do chứ không chỉ danh sách tính năng.

## Ranh giới: cái gì là của kit, cái gì là của bạn

Nguồn duy nhất: [`.agent/config/kit-layers.md`](../.agent/config/kit-layers.md). Nâng bản = **ghi đè lớp
GENERIC**, **không đụng** lớp PROJECT.

| Của KIT — ghi đè được | Của BẠN — giữ nguyên |
|---|---|
| `.agent/{rules,skills,workflows}/**` | `.agent/config/project_context.md` |
| `scripts/**` · `prompt_templates/**` | `.agent/config/db.conventions.json` · `risk_model.json` |
| `tests/support/**` · `tests/fe/{infra,fixtures}/**` | `tests/fe/<domain>/**` · `tests/fe/auth/**` · `tests/api/**` |
| `.claude/commands/**` · `.github/workflows/**` | `knowledge/**` · `profiles/**` · `outputs/**` · `.env` |
| `playwright.config.js` · `tsconfig.json` · `eslint.config.js` | |

Gói phát hành **cố ý không mang** lớp PROJECT — kể cả `db.conventions.json`: bản đồ cột↔nhãn của dự án khác
dùng cho dự án bạn là một **oracle sai** mà vẫn "có số từ DB", đúng kiểu kết luận sai trông thuyết phục nhất.
Gói mang `db.conventions.example.json` để bạn tự đo.

## Đường 1 — nhận qua gói phát hành (khuyến nghị)

```bash
# 1. Tải kit-<version>.tar.gz từ Releases, giải nén ra thư mục tạm
tar -xzf kit-2.1.0.tar.gz -C /tmp

# 2. Ghi đè CHỈ lớp GENERIC (ví dụ dùng rsync; Windows dùng robocopy hoặc copy tay theo bảng trên)
rsync -a --delete /tmp/kit-2.1.0/.agent/rules/      .agent/rules/
rsync -a --delete /tmp/kit-2.1.0/.agent/skills/     .agent/skills/
rsync -a --delete /tmp/kit-2.1.0/.agent/workflows/  .agent/workflows/
rsync -a --delete /tmp/kit-2.1.0/scripts/           scripts/
rsync -a --delete /tmp/kit-2.1.0/prompt_templates/  prompt_templates/
rsync -a --delete /tmp/kit-2.1.0/tests/support/     tests/support/
rsync -a --delete /tmp/kit-2.1.0/tests/fe/infra/    tests/fe/infra/
rsync -a           /tmp/kit-2.1.0/.claude/commands/ .claude/commands/
cp /tmp/kit-2.1.0/{package.json,package-lock.json,playwright.config.js,tsconfig.json,eslint.config.js} .

# 3. Cài lại và KIỂM
npm ci
npm run preflight        # phát hiện thiếu/lệch config
npm run gate:policy      # phát hiện lệch nguồn policy
```

**`--delete` có chủ ý** cho các thư mục GENERIC: bản mới xoá một rule/skill mà bạn giữ lại bản cũ thì kit chạy
theo hai luật khác nhau. Với `.claude/commands/` thì **không** `--delete`, vì bạn có thể tự thêm command riêng.

## Đường 2 — merge từ upstream (nếu dự án dùng git chung gốc)

```bash
git remote add upstream <url-repo-kit>     # một lần
git fetch upstream --tags
git merge v2.1.0
```

Ít xung đột vì dự án hầu như không sửa lớp GENERIC. Xung đột nếu có sẽ nằm ở `package.json` (bạn thêm script
riêng) và các file config bạn đã điền — **giữ bản của bạn** ở lớp PROJECT, **lấy bản upstream** ở lớp GENERIC.

## Sau khi nâng: hai lệnh bắt buộc

```bash
npm run preflight        # thiếu input bắt buộc? config parse được? (thiếu file thì gate in luôn lệnh cp từ bản mẫu)
npm run gate:policy      # RULE_GLOBAL còn là nguồn canonical? cơ chế mới đã được nối vào workflow/prompt chưa?
```

Cả hai chạy **offline**, không chạm UAT, không cần secret. Chúng bắt đúng loại lệch mà nâng bản hay sinh ra:
config cũ thiếu khoá mới, hoặc gate mới chưa được điểm-vào nào gọi.

Muốn chắc hơn nữa thì chạy `npx playwright test tests/fe/infra` — bộ spec **tự kiểm kit**, chạy offline.

## Lần đầu nhận kit (chưa từng dùng)

Gói không mang lớp PROJECT nên `preflight` sẽ **chặn** cho tới khi bạn khai context của dự án — đó là **đúng**,
không phải lỗi. Gate in luôn lệnh cần chạy, đại ý:

```bash
cp .agent/config/project_context.example.md .agent/config/project_context.md
cp .env.example .env
cp profiles/task.env.example profiles/<TASK_KEY>/task.env
# cần tầng kiểm DB (§23)? copy rồi ĐO LẠI trên DB của bạn:
cp .agent/config/db.conventions.example.json .agent/config/db.conventions.json
```

Rồi đọc [QUICKSTART.md](../QUICKSTART.md).
