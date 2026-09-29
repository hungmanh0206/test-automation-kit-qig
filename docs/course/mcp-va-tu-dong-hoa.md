# MCP Server và tự động hoá quanh công việc

> **1 giờ 30 phút** · Có gì trong tay: CI đang gác cổng · Sau bài này: agent đọc được dữ liệu ngoài qua một cửa, với quyền tối thiểu, và bạn biết ranh giới nào không được tự động hoá

**Vấn đề**

Agent của bạn cần đọc ticket trên hệ quản lý việc, đọc bản thiết kế, và đọc dữ liệu deal bên
hệ CRM.

Cách nhanh nhất là để mỗi chỗ tự gọi API của nó. Bạn viết ba đoạn code, mỗi đoạn tự lo token và phân
trang theo một kiểu.

Rồi một trong ba API đổi cách xác thực. Bạn phải tìm ra nó nằm ở mấy chỗ.


**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Mỗi chỗ tự gọi API riêng nên mật khẩu rải khắp nơi, và không ai biết agent được làm gì. |
| **Bài này bạn gõ gì** | Lập một bảng khai server, quyền, ai duyệt. Rồi viết gate chặn quyền ghi chưa ai duyệt. |
| **Xong thì được gì** | Agent lấy dữ liệu ngoài qua một cửa duy nhất, quyền vừa đủ, và rõ chỗ nào phải người bấm. |

> Bài này có vài từ mới. Chúng được gọi tên ở **cuối bài**, sau khi bạn đã chạm vào chúng,
> chứ không định nghĩa trước. Gặp từ lạ giữa bài thì đọc tiếp, mục đó sẽ gom lại.

## Bài này bạn sẽ làm gì

Ba việc:

1. Gom mọi cửa vào dữ liệu ngoài về một nơi khai (25 phút).
2. **Xây gate**: server có quyền ghi phải khai lý do + ai duyệt (30 phút).
3. Vạch ranh giới tự động hoá, và đặt lịch chạy + thông báo (25 phút).

---

## Việc 1 — Một cửa vào, không phải mười (25 phút)

Không có MCP, mỗi chỗ tự gọi API: một script gọi Backlog, một prompt bảo agent "đọc tài liệu nguồn", một tệp khác
gọi Figma. Bốn hệ quả, đều đắt:

| Hệ quả | Cụ thể |
|---|---|
| Mỗi chỗ tự xử lý token | token rải rác, và đó là đường rò rỉ |
| Mỗi chỗ tự xử lý phân trang | chỗ nhớ, chỗ quên — đọc thiếu không có tín hiệu (Bài 1) |
| API đổi thì sửa mười chỗ | và bạn chỉ tìm ra chín |
| Không ai biết agent đang được phép làm gì | câu hỏi *"nó có xoá được issue không?"* không trả lời được |

`.agent/config/mcp_config.md`. Một bảng, và nó là canonical:

```markdown
# MCP server của dự án

| Server | Dùng để | Biến môi trường | Quyền | Ai duyệt quyền ghi |
|---|---|---|---|---|
| Backlog | Đọc yêu cầu, tạo bug | `BACKLOG_BASE_URL` `BACKLOG_API_KEY` | đọc + **tạo bug** | QA Lead, 08/09/2026 |
| tài liệu nguồn | Đọc tài liệu đặc tả | dùng chung với Backlog | **chỉ đọc** | — |
| Google Drive/Docs | Đọc tài liệu BA gửi | `GOOGLE_*` | **chỉ đọc** | — |
| Figma | Đọc thiết kế: chữ hiển thị, token màu | `FIGMA_TOKEN` | **chỉ đọc** | — |
| Slack | Gửi thông báo kết quả | `SLACK_WEBHOOK` | **chỉ ghi vào 1 kênh** | QA Lead, 08/09/2026 |

## Quy tắc

1. **Mặc định là chỉ đọc.** Mọi quyền ghi phải có một dòng trong cột cuối — ai duyệt, ngày nào.
2. Token nằm ở `.env` hoặc `profiles/<TASK>/task.env` — **không** khai trong file này.
3. Không server nào được cấp quyền **xoá**. Dọn dẹp là việc của người.
4. Tài liệu nhiều tab: PHẢI bật tuỳ chọn đọc hết tab. Không bật thì chỉ được tab đầu và
   **không có thông báo nào** (Bài 1).
5. Đo cỡ tài liệu trước khi đọc (Bài 1). Vượt ngưỡng thì giao subagent trích.
```

Quy tắc 3 đáng nhấn: không cấp quyền xoá cho bất cứ server nào. Không phải vì agent hay xoá bừa, mà vì
xoá là hành động không hoàn tác được, và không có lợi ích nào đủ để đánh đổi. Dọn dẹp thì đổi trạng thái
(`Deprecated`, `Closed`), đừng xoá.

## Việc 2 — Gate: quyền ghi phải có người duyệt (30 phút)

Bảng trên là văn bản. Văn bản thì trôi. Ai đó thêm một server, cấp quyền ghi, và không ai để ý.

Áp công thức 5 câu hỏi (Bài 15):

| # | | |
|---|---|---|
| 1 | Chặn kiểu sai nào | quyền ghi/xoá được cấp mà không ai duyệt, và không ai biết |
| 2 | Đo cái gì | bảng trong `mcp_config.md`: mọi dòng có quyền ghi phải có ai duyệt + ngày; không dòng nào có quyền xoá |
| 3 | Cửa nào | mọi commit (rẻ, tất định, không chạm mạng) |
| 4 | Không đo được | thiếu tệp, hoặc bảng không parse được ⇒ mã 2 |
| 5 | Đối chứng | thêm dòng ghi không người duyệt ⇒ chặn · dòng chỉ đọc ⇒ **qua** · dòng có "xoá" ⇒ chặn |

```js
#!/usr/bin/env node
/*
 * kiem-mcp-quyen.js — quyền của MCP server phải khai tường minh và có người duyệt.
 *
 * VÌ SAO CÓ MÁY NÀY: bảng quyền là văn bản, và văn bản trôi. Thêm một server có quyền ghi
 * chỉ mất một dòng markdown, và không ai review dòng đó như review code.
 *
 * ĐO CÁI GÌ: bảng trong mcp_config.md — cột "Quyền" và cột "Ai duyệt quyền ghi".
 * KHÔNG đo cấu hình thật của MCP (máy không với tới được) — đo KHAI BÁO, và luật là
 * khai báo phải khớp thực tế. Đây là giới hạn đã biết, ghi ra để không ai tưởng nó đo nhiều hơn.
 *
 * Mã thoát: 0 = đạt · 1 = có quyền chưa được duyệt (CHẶN) · 2 = không đo được
 */
'use strict';
const fs = require('fs');

const FILE = '.agent/config/mcp_config.md';
if (!fs.existsSync(FILE)) {
  console.error(`[mcp-quyen] KHÔNG ĐO ĐƯỢC: không thấy ${FILE}`);
  console.error('  Chưa khai server nào KHÁC với "không dùng server nào" — nếu thật sự không dùng, tạo file và ghi rõ.');
  process.exit(2);
}

const md = fs.readFileSync(FILE, 'utf8');
const dong = [...md.matchAll(/^\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*$/gm)]
  .map((r) => ({ server: r[1], dungDe: r[2], bien: r[3], quyen: r[4], aiDuyet: r[5] }))
  .filter((r) => r.server && !/^-+$/.test(r.dungDe) && !/^Server$/i.test(r.server));

if (!dong.length) {
  console.error('[mcp-quyen] KHÔNG ĐO ĐƯỢC: không đọc được dòng nào trong bảng — sai quy ước 5 cột?');
  process.exit(2);
}

const CO_GHI = /ghi|tạo|create|write|post|sửa|update/i;
const CO_XOA = /xoá|xóa|delete|remove|drop/i;
const CO_NGAY = /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}/;

const loi = [];
for (const d of dong) {
  const q = d.quyen;

  if (CO_XOA.test(q)) {
    loi.push(`${d.server}: quyền có XOÁ — không server nào được cấp quyền xoá. ` +
      'Dọn dẹp là đổi trạng thái, không phải xoá.');
  }

  // Token không được nằm trong file này — đây là file lên git
  if (/[A-Za-z0-9_-]{24,}/.test(d.bien) && !/^[A-Z_*\s`$.]+$/.test(d.bien.replace(/`/g, ''))) {
    loi.push(`${d.server}: cột biến môi trường trông như chứa GIÁ TRỊ token, không phải TÊN biến`);
  }

  if (!CO_GHI.test(q)) continue;                    // chỉ đọc thì không cần duyệt

  const ai = String(d.aiDuyet || '').trim();
  if (!ai || ai === '—' || ai === '-') {
    loi.push(`${d.server}: có quyền GHI ("${q}") mà cột "Ai duyệt" trống`);
  } else if (!CO_NGAY.test(ai)) {
    loi.push(`${d.server}: người duyệt "${ai}" thiếu NGÀY — sau này không truy được duyệt lúc nào`);
  }
}

const soGhi = dong.filter((d) => CO_GHI.test(d.quyen)).length;
console.log(`[mcp-quyen] ${dong.length} server · ${dong.length - soGhi} chỉ đọc · ${soGhi} có quyền ghi`);
for (const d of dong) console.log(`  ${d.server.padEnd(22)} ${d.quyen}`);

if (loi.length) {
  console.error(`\n[mcp-quyen] ✗ CHẶN — ${loi.length} vấn đề:`);
  for (const l of loi) console.error('  - ' + l);
  process.exit(1);
}
console.log('\n[mcp-quyen] ✓ ĐẠT — mọi quyền ghi đều có người duyệt kèm ngày, không quyền xoá nào.');
```

### Thử nó — bốn lần

| Lần | Sửa gì | Kỳ vọng |
|---|---|---|
| 1 | bảng như mẫu Việc 1 | **`0`** |
| 2 | thêm dòng `Notion \| Ghi báo cáo \| \`NOTION_TOKEN\` \| đọc + ghi \| —` | **`1`** — quyền ghi không người duyệt |
| 3 | đổi quyền dòng Backlog thành `đọc + tạo bug + xoá issue` | **`1`** — có quyền xoá |
| 4 | bảng chỉ toàn dòng **chỉ đọc** | **`0`** |

Lần 4 là đối chứng âm: server chỉ đọc không cần người duyệt, và gate phải cho qua ngay. Bắt duyệt cả dòng
chỉ đọc thì mọi lần thêm server là một vòng thủ tục, và người ta sẽ bỏ file khai báo.

> Máy này đo KHAI BÁO, không đo cấu hình thật. Nó không với tới được cấu hình MCP trên máy bạn. Nên nó
> chặn được *"cấp quyền mà không ai duyệt"*, không chặn được *"khai một đằng cấu hình một nẻo"*. Ghi giới
> hạn này vào chú thích của máy. Gate mà người dùng tưởng nó đo nhiều hơn thực tế là gate nguy hiểm.

## Việc 3 — Ranh giới, lịch chạy, và thông báo (25 phút)

### Cái gì tự động được, cái gì bắt buộc người bấm

Ranh giới không nằm ở *"máy làm nổi không"* — nó nằm ở hậu quả khi máy làm sai:

| Việc | Tự động? | Vì sao |
|---|---|---|
| Kéo requirement, tài liệu về | ✅ | chỉ đọc; sai thì đọc lại |
| Sinh testcase nháp | ✅ | còn qua review của người |
| Chạy suite theo lịch | ✅ | không đổi dữ liệu ai (nếu tiền điều kiện đúng — Bài 9) |
| Sinh báo cáo, dashboard | ✅ | artifact, sinh lại được |
| Gửi thông báo vào một kênh | ✅ | ồn thì tắt |
| **Publish testcase lên công cụ dùng chung** | ❌ | công cụ không có API xoá; đẩy nhầm là sống với nó (Bài 18) |
| **Log bug lên Backlog** | ❌ | bug sai làm mất niềm tin của đội dev, và mất rất lâu để lấy lại |
| **Đổi trạng thái case sang Deprecated** | ❌ | ảnh hưởng lịch sử chạy của người khác |
| **Sửa `knowledge/`** ở mức đổi `active` → `invalid` | ❌ | quyết định "kết quả cũ mất giá trị" (Bài 26) |

Bốn dòng ❌ có chung một tính chất: hậu quả đổ lên người khác, và khó hoàn tác. Đó là định nghĩa dùng
được của human gate, không phải "việc khó".

> Human gate **không phải** là không tin agent. Nó là chỗ đặt trách nhiệm. Bug sai gửi cho Dev thì người chịu
> là bạn, nên người bấm cũng phải là bạn.

### Lịch chạy và thông báo

```yaml
# .github/workflows/hang-dem.yml — chạy theo giờ, KHÔNG theo commit
name: hang-dem
on:
  schedule: [{ cron: '0 19 * * 1-5' }]      # 02:00 giờ VN các ngày trong tuần
  workflow_dispatch: {}                      # bấm tay được — luôn để đường này
jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: node scripts/qa/chay-hang.js hangDem
        env:
          APP_BASE_URL: ${{ secrets.UAT_BASE_URL }}
          TEST_USER: ${{ secrets.UAT_USER }}
          TEST_PASS: ${{ secrets.UAT_PASS }}
      - if: failure()
        run: node scripts/qa/bao-tin.js --kenh qa-alerts --muc do
```

Bốn điều về thông báo, học từ chỗ mọi kênh thông báo đều đi tới:

| Điều | Vì sao |
|---|---|
| **Chỉ báo khi ĐỎ**, không báo khi xanh | báo mỗi ngày thì sau hai tuần không ai đọc nữa |
| Kèm link tới bản chạy, không dán log | log dài làm trôi kênh; link thì mở khi cần |
| Nói cái gì hỏng, không chỉ "build failed" | *"3 case Đồng bộ học lại đỏ ở bước chọn lớp mốc"* mới hành động được |
| Có `workflow_dispatch` | lịch hỏng lúc nào cũng bấm tay chạy lại được |

Dòng đầu là dòng quan trọng nhất: thông báo bị bỏ qua còn tệ hơn không có thông báo, vì nó tạo cảm giác
đang được canh.

## Gọi tên những gì bạn vừa làm

| Từ | Nghĩa gọn |
|---|---|
| **MCP server** | Cầu nối cho agent đọc/ghi một hệ thống ngoài (Backlog, Drive, Figma…) qua một giao diện chung |
| **Quyền tối thiểu** | Cấp đúng cái cần, không hơn. Chỉ đọc là mặc định |
| **Human gate** | Bước bắt buộc có người bấm. Không phải vì máy làm không nổi — vì hậu quả |

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .agent/config/
│   └── mcp_config.md                 ← MỚI · MỘT bảng: server · quyền · AI DUYỆT + ngày
├── scripts/qa/
│   ├── kiem-mcp-quyen.js             ← MỚI · quyền ghi không người duyệt ⇒ chặn; cấm quyền xoá
│   └── bao-tin.js                    ← MỚI · chỉ báo khi ĐỎ, kèm link, nói rõ cái gì hỏng
└── .github/workflows/
    ├── gates.yml                     ·  từ Bài 20 · mọi commit
    └── hang-dem.yml                  ← MỚI · theo lịch, có workflow_dispatch để bấm tay
```

## Tự kiểm

1. Bốn hệ quả của việc mỗi chỗ tự gọi API — kể ra.
2. Vì sao không server nào được cấp quyền xoá? Dọn dẹp thì làm gì?
3. Vì sao server **chỉ đọc** không cần người duyệt, và gate phải cho qua ngay?
4. Máy `kiem-mcp-quyen.js` không đo được cái gì? Vì sao phải ghi giới hạn đó vào chú thích?
5. Ranh giới human gate nằm ở đâu, "việc khó" hay "hậu quả"? Kể 2 việc bắt buộc người bấm.
6. Vì sao chỉ báo khi đỏ? Báo cả khi xanh thì hỏng thế nào?
7. Vì sao workflow theo lịch vẫn phải có `workflow_dispatch`?

## Bài tập về nhà (25 phút)

1. Khai `mcp_config.md` cho dự án bạn. Với **mỗi** server, trả lời thật: *nó đang được cấp quyền gì?*
   Nếu bạn không biết, đó là phát hiện của bài này, đi tìm cho ra.
2. Chạy `kiem-mcp-quyen.js`. Sửa tới khi đạt. Đừng nới gate; hoặc bỏ quyền thừa, hoặc xin duyệt thật.
3. Liệt kê mọi việc kit bạn đang tự động hoá. Với mỗi việc hỏi: *máy làm sai thì hậu quả đổ lên ai, và
   hoàn tác được không?* Việc nào "đổ lên người khác + khó hoàn tác" mà đang tự động ⇒ thêm human gate.

Bước 3 hay lộ ra một hoặc hai chỗ đã tự động hoá vượt ranh giới từ lâu mà không ai nhận ra, thường là đường
publish hoặc đường log bug.

## Đọc thêm

- Bài 18 — [bug report và tích hợp](test-management.md): vì sao publish và log bug đều mặc định dry-run.
- Bài 1 — [chi phí và giới hạn](chi-phi-va-gioi-han.md): đo tài liệu trước khi cho agent đọc qua MCP.
- Bài 20 — [CI](ci-cd.md): `kiem-mcp-quyen` thuộc hạng *mọi commit*.
