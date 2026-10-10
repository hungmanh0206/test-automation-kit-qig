# v2.6.0 §T.1 — Mốc token trước khi thêm Bước 0

> Đo 11/10/2026 trên `feat/v2.6.0` (HEAD `60cc648`). Mọi số dưới đây là **số đo bằng máy**, lệnh chạy lại
> được ghi kèm. Đây là mốc để §T.9 so trước/sau; không phải mục tiêu.

## 1. Số đo tĩnh — `npm run prompt:budget`

Phần **nạp bắt buộc** của mỗi luồng (thứ mọi lượt đều trả, dù task to hay nhỏ):

| Luồng | Bắt buộc | Trần (`luong`) | Mốc (`moc`) | Chỗ trống dưới trần |
|---|---|---|---|---|
| `phase1` | **28.070** | 31.000 | 28.074 | 2.930 |
| `phase2` | 29.004 | 32.000 | 29.006 | 2.996 |
| `publish` | 6.561 | 9.000 | 6.561 | 2.439 |
| `rerun` | 9.240 | 12.000 | 9.240 | 2.760 |
| `start` | 4.575 | 5.000 | 4.575 | 425 |

Luật nền auto-load: **~3.9k token** (`CLAUDE.md` + `.agent/rules/core_rules.md`) — mọi luồng đều mang.

**Hệ quả cho v2.6.0:** chỗ trống dưới trần là 2.930 token, nhưng `moc` chặt hơn trần — phần bắt buộc
**tăng so với 28.074 là CHẶN**, dù còn dưới trần. Nên `phase1_000_system_discovery.md` buộc phải khai
`co_dieu_kien` trong `load_map.json` (`luong.phase1.co_dieu_kien`, đang có 4 file, khuôn
`{file, khi}`). Khai `bat_buoc` là đỏ gate ngay lúc thêm.

Lệnh: `npm run prompt:budget` · chốt lại mốc: `node scripts/qa/prompt_budget.js --moc`

## 2. Số đo động — `npm run token:audit`

### 2.1. Không có phiên Phase 1 "sạch" để làm mốc — và đó là một giới hạn thật

`token:audit --list` cho 13 transcript, trong đó **5 phiên `CHẠY TASK`**. Đếm dấu vết phase trong từng
phiên (`run_phase1_template` · `02_gen_testcases` · `scope:anchor` so với `04_execute_fe_playwright` ·
`run_phase2_template`):

| Phiên | message | dấu Phase 1 | dấu Phase 2 | dùng được làm mốc Phase 1? |
|---|---|---|---|---|
| `4970d32b` | 543 | 19 | **0** | ✅ Phase 1 thuần — mốc chính |
| `fe6d3da6` | 6.534 | 149 | 30 | ⚠️ nặng Phase 1 nhưng có trộn |
| `048dfbb4` | 7.735 | 95 | 62 | ❌ trộn |
| `6422c2d9` | 7.976 | 73 | 38 | ❌ trộn |
| `b124ddca` | 8.455 | 53 | 26 | ❌ trộn |

Phiên thật đi liền Phase 1 → Phase 2 trong một lượt, nên **không có phiên nào chỉ-Phase-1 ở quy mô lớn**.
Mốc chính vì vậy là `4970d32b` (nhỏ, nhưng sạch), và `fe6d3da6` đi kèm làm đối chứng quy mô lớn. §T.9 phải
so **trên CÙNG một task**, không so hai phiên khác nhau — hai phiên khác task thì chênh lệch đọc ra được
là chênh lệch của task, không phải của discovery.

### 2.2. `4970d32b` — Phase 1 thuần (mốc chính)

543 message · context trung bình **~385.8k token/message** · cache-hit 98,6%.

| Nguồn token kết quả | ~token | % |
|---|---|---|
| **Read file** | **61.5k** | **51.3%** |
| bash khác | 35.3k | 29.4% |
| tìm kiếm | 7.1k | 5.9% |
| output gate | 4.0k | 3.4% |
| ExitPlanMode | 4.0k | 3.3% |
| ghi file | 3.9k | 3.3% |
| output playwright test | 2.3k | 2.0% |
| Agent (subagent) | 1.0k | 0.8% |
| MCP khác | 0.5k | 0.4% |

Lượt gọi tool: Bash **131** · Edit 45 · Read 27 · Write 22 · Grep 14 · obsidian MCP **10** · Agent 3.

Top mẫu shell: `node -e` 20 (15,3%) · `node --experimental-strip-types` 16 · `grep` 12 · `sed` 11 ·
`npx playwright test` 9 · `md_to_xlsx.js` 8 · `ls` 7.

**9/27 lượt Read đi vào tài liệu CỦA KIT**, và đó là:

| Lượt | File |
|---|---|
| 1 | `prompt_templates/run_phase1_template.md` |
| 1 | `prompt_templates/phase1/02_gen_testcases.md` |
| 1 | `prompt_templates/phase1/02b_output_format.md` |
| 1 mỗi file | `dimensions/` : `06_e2e` · `08_resilience` · `12_display` · `13_business_logic` · `19_ordering` · `23_db_persistence` |

### 2.3. `fe6d3da6` — đối chứng quy mô lớn

6.534 message · context trung bình ~508.6k · bash **75.3%** · output gate 8.8% ·
**0/130 lượt Read đi vào tài liệu kit**.

## 3. Ba tiền đề của §T, đối chiếu với số đo

§T nói discovery làm **tổng token Phase 1 giảm**, vì "agent không phải tự mò hệ thống, tự đọc tài liệu
lớn, hay mở MCP dò từng màn nữa". Đối chiếu từng vế:

| Tiền đề của §T | Số đo | Kết luận |
|---|---|---|
| "tự đọc tài liệu lớn" tốn nhiều | Read = **51,3%** token kết quả ở phiên Phase 1 thuần | ✅ ĐÚNG về tỉ lệ, nhưng xem cột bên |
| …và discovery cắt được phần đó | **9/27 lượt Read là tài liệu CỦA KIT** (3 thẻ chạy + 6 thẻ chiều), không phải đặc tả hệ thống | ⚠️ **CẮT KHÔNG ĐƯỢC**: đó là hướng dẫn của kit, discovery không thay thế được. Đặc tả hệ thống đọc qua obsidian MCP — chỉ **10/131+27 lượt** |
| "mở MCP dò từng màn" tốn nhiều | Phiên Phase 1 thuần có **0 lượt** Playwright MCP, 0 token ảnh/video | ❌ **KHÔNG CÓ GÌ ĐỂ CẮT** ở phiên này |
| phiên lớn tốn vì mò hệ thống | `fe6d3da6`: bash **75,3%**, Read-tài-liệu-kit **0** | ❌ Chi phí trội là **bash**, không phải đọc tài liệu |

**Nói thẳng:** khoản tiết kiệm mà discovery có thể lấy được ở Phase 1 **nhỏ hơn giả định của §T**, và nó
không nằm ở "đọc tài liệu lớn". Discovery lại **thêm** một bước chạy script (tức thêm lượt bash — đúng
nhóm đang trội ở phiên lớn). Vì vậy §T.9 ("tổng token Phase 1 không giảm thì chưa phát hành") là một điều
kiện DỪNG có thật, không phải thủ tục.

Ba chỗ discovery thật sự cắt được, và phải đo riêng từng chỗ ở §E:

1. **`scope_anchor`** — agent đang tự liệt kê danh mục màn/chức năng. Lấy từ discovery thì bỏ được vòng
   hỏi-đáp dựng mẫu số, và quan trọng hơn là bỏ được cái mẫu số **tự khai**.
2. **`ui_debug_agent`** — màn đã có dấu vân tay thì không dò lại. Phiên Phase 1 thuần chưa dùng tới nó
   (0 lượt), nên khoản này **chỉ hiện ở phiên trộn/Phase 2**: ở đó mới có chi phí dò DOM.
3. **Nhắm đúng đoạn tài liệu** — thay vì đọc cả note đặc tả. Trần này nhỏ (10 lượt MCP) nhưng là phần
   discovery thay thế đúng nghĩa.

**Chốt phạm vi tuyên bố:** v2.6.0 **không** được hứa "Phase 1 rẻ hơn". Nó hứa đúng hai thứ đo được:
mẫu số coverage thôi tự khai, và agent không phải đọc nguyên tài liệu để biết hệ thống có gì. Nếu §E đo ra
tổng token tăng, phải báo con số tăng kèm nguyên nhân, không được làm tròn thành "tương đương".

## 4. Lệnh đo lại

```bash
npm run prompt:budget                              # số đo tĩnh, mọi luồng
node scripts/qa/prompt_budget.js --moc             # in JSON để chốt lại moc
npm run token:audit -- --list                      # danh sách transcript
npm run token:audit -- --transcript 4970d32b-6a9c-4de9-9baa-7fdcfb8ad3d7.jsonl
npm run token:audit -- --transcript fe6d3da6-8f30-414a-b3ec-e03b0677af89.jsonl
```
