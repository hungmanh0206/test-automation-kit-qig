# `.agent/rules/` — đọc dòng này trước

**Thư mục này KHÔNG phải bộ rule đầy đủ.** Rule canonical nằm ở **[`RULE_GLOBAL.md`](../../RULE_GLOBAL.md) tại root repo** — mâu thuẫn với bất cứ gì ở đây thì theo `RULE_GLOBAL.md`.

Sở dĩ tách 3 tầng vì mỗi tầng bị một ràng buộc khác nhau, gộp lại đằng nào cũng lỗ:

| Tầng | File | Vì sao phải là tầng riêng |
|---|---|---|
| 1 | [`CLAUDE.md`](../../CLAUDE.md) (root) | Claude Code **tự nạp mọi session, mọi lượt** ⇒ buộc cực ngắn, chỉ chứa điều không-thương-lượng. Nhồi canonical vào đây là đốt context vĩnh viễn. |
| 2 | [`core_rules.md`](core_rules.md) | Digest cho agent đọc khi vào phase. Mỗi gạch đầu dòng kết bằng `(Đầy đủ: RULE_GLOBAL §…)`. |
| 3 | [`RULE_GLOBAL.md`](../../RULE_GLOBAL.md) (root) | **Canonical**, 24 mục. Không đưa vào thư mục này vì đang bị 20+ file trỏ tới (kể cả `.claude/settings.json` và task doc trong `outputs/`) — dời là dứt link, lợi không bù rủi ro. |

## Hai loại file ở đây, đừng lẫn

| File | Loại | Ai dẫn agent tới đọc |
|---|---|---|
| `core_rules.md` | **policy** (tầng 2) | `CLAUDE.md` · gate `policy_source_check.js` |
| `qa_instincts.md` | playbook — phản xạ điều tra khi execute | prompt phase2 `04`/`05` · skill `qa_automation_engineer` · `exploratory/` |
| `locator_strategy.md` | playbook — chọn/neo locator (bảng §Priority là NGUỒN) | skill `locator_healing_agent` · `self_review.js` trích dẫn khi chặn |
| `locator_healing_policy.md` | playbook — xử lý khi locator FAIL lúc execute | skill `locator_healing_agent` · workflow `phase2_03` |
| `playwright_fe.md` | playbook — wait strategy, POM, anti-pattern UI | prompt phase2 `04` §Quy tắc kỹ thuật Playwright |
| `playwright_api.md` | playbook — assertion discipline, anti-pattern API | prompt phase2 `05` §Quy tắc kỹ thuật API |

Playbook **không** trùng `RULE_GLOBAL.md`: canonical không chứa nội dung locator/idiom Playwright.

## Thêm file mới vào đây thì phải làm gì

`gate:policy` (`node scripts/qa/policy_source_check.js`, đã chạy trong cả `.gitlab-ci.yml` và `static-check.yml`) sẽ **CHẶN** nếu:

1. **File mồ côi** — không prompt/skill/workflow/script/`CLAUDE.md` nào trỏ tới. Nhắc tên trong `AUDIT_REFERENCES.md` (kiểm kê) hoặc `CHANGELOG.md` (lịch sử) **không tính**, vì hai file đó không đưa ai tới đọc.
2. `core_rules.md` mất dòng khai `RULE_GLOBAL.md` là canonical.
3. Tài liệu liệt kê đuôi file evidence lệch với hằng số `VISUAL_EXT` trong `scripts/qa/lib/output_rules.js` (nguồn duy nhất, cũng là thứ thật sự chặn).

Lý do có mấy gate này: đã xảy ra thật — `playwright_fe.md`/`playwright_api.md` từng chỉ được bản kiểm kê nhắc tới trong khi prompt execute tự chép lại một phần rule của chúng, tức tồn tại bản thứ hai không ai canh.
