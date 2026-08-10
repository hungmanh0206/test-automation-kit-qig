# Kit layers — ranh giới GENERIC vs PROJECT

> **Vì sao cần file này:** repo vừa là **kit dùng chung** vừa là **workspace của một dự án cụ thể**.
> Không khai ranh giới thì việc "sửa kit" dễ lan vào file của dự án (và ngược lại): sửa generic mà
> chạm spec/helper riêng → kit phát cho dự án khác mang theo rác, còn dự án hiện tại thì bị đổi hành vi
> ngoài ý muốn. Đây là **nguồn tra cứu duy nhất** cho câu hỏi "file này thuộc lớp nào".

## GENERIC — thuộc kit, phát cho MỌI dự án

Phải **không chứa** tên hệ thống/task/URL của dự án cụ thể (xem `RULE_GLOBAL.md`).

```
.agent/**                     rule · workflow · skill · config (trừ project_context.md)
prompt_templates/**           prompt Phase 1/2/rerun
scripts/**                    tooling: qa gate, utils, integrations, convert_excel
tests/support/setup/**        setup layer (factory/hook/fixture/mock/cleanup/contract)
tests/fe/infra/**             spec kiểm hạ tầng kit, chạy trên fixture local (không UAT)
tests/fe/fixtures/**          fixture dùng chung
tests/**/*example*            spec/script mẫu
tests/load/**                 k6 script mẫu
knowledge/SCHEMA.md           schema learning data
README.md · USER_GUIDE.md · QUICKSTART.md · RULE_GLOBAL.md · CHANGELOG.md · CLAUDE.md
playwright.config.js · package.json · eslint/tsconfig · CI (.github/**, .gitlab-ci.yml)
```

## PROJECT — nội dung của dự án đang dùng kit

Được phép chứa tên hệ thống/URL/tài khoản của dự án. **Không** phát kèm khi giao kit cho dự án khác.

```
.agent/config/project_context.md      khai Sites + env key của dự án (bản generic: *.example.md)
.env · .env.local · profiles/**       giá trị động/creds
outputs/**                            artifact theo task (gitignored)
knowledge/{bugs,root_causes,historical_execution,locators,metrics}/**   learning data của dự án
tests/fe/<domain>/**                  spec nghiệp vụ đã promote (vd order/, transaction/)
tests/fe/auth/**                      smoke auth theo app của dự án
tests/fe/support/**                   helper login/auth theo app (trừ fixtures/)
tests/api/**                          spec API của dự án
tests/mobile-web/<TASK>/**            spec mobile-web theo task
```

## Quy tắc làm việc

1. **Task "sửa kit/generic" → CHỈ chạm lớp GENERIC.** Nếu buộc phải sửa file PROJECT (vd nó chặn
   verify), phải **nói rõ trong báo cáo** là đang chạm lớp PROJECT và vì sao — không lặng lẽ gộp vào.
2. **Task của dự án → chạm lớp PROJECT.** Cần đổi lớp GENERIC thì theo `RULE_GLOBAL.md`
   §"Shared Change Gate" (xác nhận user + ghi rõ file/lý do/regression).
3. **Gate `npm run lint:locator`** báo tách 2 lớp; `--enforce` **chỉ chặn** vi phạm mới ở lớp GENERIC
   (lớp PROJECT là trách nhiệm của chủ dự án; thêm `--enforce-project` nếu muốn chặn cả).
4. Khi giao kit cho dự án mới: xoá/không copy lớp PROJECT, giữ nguyên lớp GENERIC, rồi điền
   `project_context.md` từ `project_context.example.md`.
