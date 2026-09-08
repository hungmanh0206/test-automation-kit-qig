# Đi tiếp sau khi làm hết

> **1 giờ 30 phút** · Có gì trong tay: kit chạy trên dự án thật, đã va chạm và tinh chỉnh · Sau bài này: biết dừng xây ở đâu, và biết thêm gì khi nào

**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Kit chạy được rồi. Giờ bạn không biết nên xây thêm hay dừng lại. |
| **Bài này bạn gõ gì** | Rà nhịp bảo trì, và tự chấm kit của mình bằng 10 câu trả lời được bằng số. |
| **Xong thì được gì** | Biết dừng ở đâu, thêm gì khi nào, và cách phân biệt kit đang tốt lên với kit chỉ đang chạy. |

## Bài này bạn sẽ làm gì

Bốn việc:

1. Nhận ra vì sao **dừng xây** là bước tiếp theo đúng (20 phút).
2. Danh sách thứ không nên thêm, dù nghe hay (20 phút).
3. Ba hướng đáng học tiếp, và **dấu hiệu** cho biết đã tới lúc (25 phút).
4. Chốt nhịp bảo dưỡng và tự chấm kit của bạn (25 phút).

---

## Việc 1 — Dừng xây, chuyển sang dùng (20 phút)

Bạn vừa dựng khoảng mười máy chặn và một quy trình chạy được. Cảm giác tự nhiên lúc này là **xây tiếp**: thêm
gate, thêm chiều, thêm tự động hoá. Đó là bẫy.

Kit chỉ chứng minh được giá trị khi nó chạy trên việc thật đủ nhiều lần để va chạm:

| Thứ chỉ lộ ra khi dùng thật | Không dùng thì |
|---|---|
| Gate nào bắt oan | bạn tưởng nó hoàn hảo |
| Gate nào không bao giờ nổ | bạn tưởng nó đang canh |
| Chỗ nào chậm tới mức người ta muốn bỏ qua | bạn không biết chỗ đó tồn tại |
| Luật nào người ta lách, và lách bằng cách nào | ... |

Dòng cuối quan trọng nhất. Khi ai đó lách một luật, cách họ lách nói cho bạn biết luật đó sai ở đâu, và
đó là dữ liệu bạn không mua được bằng cách nghĩ thêm.

> Ba tháng dùng thật dạy bạn nhiều hơn ba tháng xây thêm. Nhưng chỉ khi bạn *ghi lại* những gì va chạm —
> nếu không thì ba tháng đó chỉ là ba tháng.

Nên việc tiếp theo không phải "xây gì nữa", mà là: **chạy 10 task thật, và mỗi task ghi một dòng vào
`knowledge/`** (Bài 26). Sau 10 task, đọc lại 10 dòng đó — chúng sẽ nói cho bạn biết phải xây gì tiếp, cụ thể
hơn mọi phỏng đoán hôm nay.

## Việc 2 — Những thứ không nên thêm (20 phút)

| Nghe hay | Thực tế | Trừ khi |
|---|---|---|
| **Thêm framework thứ hai** (Cypress cạnh Playwright) | hai bộ locator, hai cách chờ, hai báo cáo, hai chỗ để bug lọt | bạn có một loại app mà bộ hiện tại không chạy nổi |
| **Công cụ trùng chức năng** (thêm dashboard thứ hai) | hai nguồn số, và khi lệch thì không ai biết cái nào đúng | không bao giờ |
| **Tự động hoá log bug** | bug sai làm mất niềm tin của đội dev, mất rất lâu để lấy lại (Bài 20) | không bao giờ |
| **Gate cho mọi thứ** | gate nổ liên tục ⇒ người ta học cách bỏ qua ⇒ mọi gate mất tác dụng | gate mới phải chặn một kiểu sai đã xảy ra thật |
| **Phủ 100% chiều cho mọi module** | thời gian chạy nổ, và độ sâu ở chỗ rủi ro cao bị cắt để bù | không bao giờ — độ sâu bám rủi ro (Bài 14) |
| **Báo cáo hàng ngày cho stakeholder** | tuần thứ hai không ai đọc | có sự kiện: sắp phát hành, sự cố |

Dòng gate cho mọi thứ đáng nhấn, vì nó là cách kit tự sát phổ biến nhất:

> Mỗi gate mới phải chỉ ra được một lần sai đã xảy ra thật mà nó sẽ chặn. Không chỉ ra được thì đó là gate
> phòng thủ tưởng tượng, nó thêm ma sát mà không đổi lấy gì.

Và một câu để kiểm tra chính mình:

> Gate nào chưa từng nổ trong 3 tháng? Nó đang canh một thứ không xảy ra, hay nó hỏng và bạn không biết?
> Câu trả lời chỉ có được bằng đối chứng dương: tiêm đúng lỗi nó phải bắt, xem nó có đỏ không.

## Việc 3 — Ba hướng đáng học tiếp, và dấu hiệu (25 phút)

Đừng học vì nghe hay. Học khi thấy **dấu hiệu**.

### Contract testing

| | |
|---|---|
| **Dấu hiệu** | Test đỏ vì backend đổi response mà không ai báo, ≥ 2 lần trong một quý |
| **Giải** | Chốt hợp đồng giữa FE và BE; ai phá hợp đồng thì CI của **họ** đỏ, không phải test của bạn |
| **Vì sao đúng lúc** | Bạn đã có Bài 18 (đối soát từng trường) và Bài 10 (UI ↔ nơi lưu) — đó là contract test làm bằng tay |
| **Chưa cần nếu** | backend đổi hợp đồng dưới 1 lần/quý — chi phí dựng lớn hơn cái được |

### Performance engineering

| | |
|---|---|
| **Dấu hiệu** | Có test đỏ vì **chậm**, không phải vì sai; hoặc người dùng than chậm mà bạn không có số |
| **Giải** | Đo có phương pháp: p95, tải đồng thời, ngưỡng khai trước |
| **Bẫy** | **Đừng bịa SLA.** Không có ngưỡng do sản phẩm chốt thì kết quả là *advisory*, không phải PASS/FAIL — đúng luật "không neo thì là `OBSERVATION`" (Bài 16) |
| **Chưa cần nếu** | chưa ai than, và chưa có test nào đỏ vì chậm |

### Observability

| | |
|---|---|
| **Dấu hiệu** | Bug chỉ xảy ra ở môi trường thật và bạn không tái hiện được |
| **Giải** | Log/trace/metric ở sản phẩm để nhìn được chuyện gì đã xảy ra lúc đó |
| **Vì sao liên quan QA** | Bạn là người cần nó nhất: không tái hiện được thì không kiểm được, và bug bị đóng là "not reproducible" |
| **Chưa cần nếu** | bug nào cũng tái hiện được ở UAT |

Ba dấu hiệu trên đều có dạng chung: một lớp bug bạn đang không xử lý được bằng công cụ hiện có. Không có
dấu hiệu thì học cũng được, nhưng đừng đưa vào kit, kit chỉ chứa thứ đang giải một vấn đề thật.

## Việc 4 — Nhịp bảo dưỡng và tự chấm (25 phút)

### Bốn nhịp

| Nhịp | Việc | Bỏ thì hỏng thế nào |
|---|---|---|
| **Mỗi lượt chạy** | Đọc kết quả gate — đừng bỏ qua CẢNH BÁO | cảnh báo bị bỏ đủ lâu sẽ thành nền, và bạn mất một lớp tín hiệu |
| **Mỗi sprint** | Cập nhật `knowledge/` · rà bug đã lọt: *máy nào lẽ ra phải bắt?* (Bài 25) | tri thức không ghi thì mất khi người đi |
| **Mỗi tháng** | `npm run mutation` toàn bộ · so điểm tháng trước · chạy sao lưu | điểm tụt = có oracle vừa bị làm yếu, và bạn phát hiện sau 6 tháng |
| **Mỗi quý** | Rà **ngoại lệ** trong mọi allowlist: cái nào còn cần? · rà gate chưa từng nổ | ngoại lệ tích lại tới khi gate không chặn gì nữa |

Nhịp quý là nhịp bị bỏ nhiều nhất và tốn nhất khi bỏ. Cách làm nó rẻ: bắt mọi ngoại lệ phải có **lý do** và
**ngày** (Bài 24), rồi một máy cảnh báo khi ngoại lệ già hơn 90 ngày. Lúc đó rà quý là đọc một danh sách,
không phải đi soát cả repo.

### Tự chấm kit của bạn

Mười câu. Trả lời được bằng số hoặc bằng lệnh, không bằng cảm giác:

| # | Câu hỏi | Trả lời bằng |
|---|---|---|
| 1 | Kit tôi có bao nhiêu máy chặn? Mỗi cái chặn gì? | `npm run gates:list` — **tự sinh**, không viết tay |
| 2 | Máy nào chưa từng nổ trong 3 tháng? | lịch sử CI |
| 3 | Mutation score tháng này? So tháng trước? | `outputs/metrics/lich-su.json` |
| 4 | Khoảng cách clean ↔ eventual? | `do-metrics.js` |
| 5 | Bao nhiêu ngoại lệ trong allowlist? Cái già nhất bao lâu? | đếm + ngày |
| 6 | Bug lọt gần nhất — **máy nào** lẽ ra phải bắt? | `knowledge/leak/` |
| 7 | Người mới cần bao lâu để chạy được kit? | đã thử clone sạch chưa (Bài 28) |
| 8 | Gate nào bắt oan nhiều nhất? | ai đó đã phải `--qa-approved` mấy lần |
| 9 | Tri thức nào quá hạn tái xác nhận? | `kiem-tri-thuc.js` |
| 10 | Sao lưu gần nhất là khi nào? Đã khôi phục thử chưa? | `_ban-ke.json` |

Câu nào không trả lời được bằng lệnh hoặc bằng số ⇒ đó là thứ đáng xây tiếp, và nó cụ thể hơn mọi phỏng
đoán ở Việc 1.

### Kit tốt lên hay chỉ đang chạy?

Phân biệt bằng một câu:

> Lần gần nhất bạn sửa một oracle và chứng minh bằng phép đo rằng nó có tác dụng là khi nào?

Có câu trả lời ⇒ kit đang tốt lên. Không có ⇒ nó đang chạy, và chạy thì không đủ.

Vòng lặp đóng, đúng bốn bước, và nó là toàn bộ nội dung còn lại sau khoá:

```
bug lọt  →  viết mutant tái hiện  →  sửa oracle  →  mutant chuyển SỐNG SÓT ⟶ BỊ DIỆT
   ↑                                                              │
   └──────────────────  ghi một dòng vào knowledge/leak/  ─────────┘
```

## Cây thư mục sau bài này

```
kit-cua-toi/
├── .agent/config/
│   └── nhip-bao-duong.md             ← MỚI · 4 nhịp + 10 câu tự chấm
├── scripts/qa/
│   └── kiem-ngoai-le.js              ← MỚI · ngoại lệ già hơn 90 ngày ⇒ cảnh báo (không chặn)
└── knowledge/leak/                   ·  từ Bài 26 · mỗi bug lọt một dòng + máy nào lẽ ra bắt
```

`kiem-ngoai-le.js` cảnh báo, không chặn. Cố ý: ngoại lệ già không phải vi phạm, nó là việc cần rà.
Chặn nó sẽ làm người ta xoá ngoại lệ cho xanh, và mất luôn lý do đã ghi.

## Tự kiểm

1. Vì sao "dừng xây, chuyển sang dùng" là bước đúng? Thứ gì chỉ lộ ra khi dùng thật?
2. Kể ba thứ không nên thêm, và điều kiện duy nhất để thêm mỗi thứ.
3. Điều kiện để một gate mới được sinh ra là gì?
4. Gate chưa từng nổ trong 3 tháng, hai khả năng là gì? Phân biệt bằng cách nào?
5. Ba hướng học tiếp, và **dấu hiệu** của từng hướng.
6. Vì sao đo hiệu năng mà không có ngưỡng do sản phẩm chốt thì kết quả là *advisory*?
7. Vì sao `kiem-ngoai-le.js` chỉ cảnh báo mà không chặn?
8. Một câu phân biệt "kit đang tốt lên" với "kit đang chạy" là gì?

## Bài tập khép lại (30 phút)

Ba việc. Làm được cả ba là kit của bạn đứng vững.

1. **Nghiệm thu clone sạch.** Clone repo vào thư mục mới, làm theo `README.md` đúng từng chữ, tới khi
   `npm run gates` ĐẠT. Mọi chỗ phải ứng biến là một chỗ thiếu trong README.

2. **Chốt mốc gốc.** Chạy `npm run mutation` toàn bộ, lưu điểm kèm ngày. Đây là mốc so sánh cho tháng sau.
   Không có mốc thì mọi câu "kit tốt lên" là cảm giác.

3. Đóng vòng lặp bug lọt. Lấy bug gần nhất lọt ra ngoài. Trả lời: máy nào lẽ ra phải bắt? Sửa đúng
   máy đó, và chứng minh bằng một mutant chuyển từ SỐNG SÓT sang BỊ DIỆT. Ghi một dòng vào `knowledge/leak/`
   với trường `mutantXacNhan`.

Việc thứ ba là việc quan trọng nhất trong cả tài liệu này, vì nó là vòng lặp **duy nhất** khiến bộ kiểm tốt lên thay
vì chỉ chạy.

---

## Khép lại

Bạn bắt đầu ở Bài 1 với một app có 3 bug và không có gì khác. Giờ bạn có:

| Phần | Bạn có gì |
|---|---|
| 1 (bài 0–3) | Từ vựng · máy chặn đầu tiên · kiến trúc · ngân sách tài liệu |
| 2 (bài 4–6) | Môi trường · git có máy canh · rule/skill/workflow/command tách bạch |
| 3 (bài 7–11) | Requirement đa nguồn · Ambiguity Gate · kỹ thuật thiết kế case · **oracle** · độ phủ đo được |
| 4 (bài 12–16) | Playwright locator bền · bằng chứng + phân tầng lỗi · 7 trục mở rộng · UI ↔ nơi lưu · tích hợp có đối soát |
| 5 (bài 17–20) | Bộ nhớ dự án · knowledge có phiên bản · vòng học · sao lưu |
| 6 (bài 21–23) | **Phép đo chính bộ kiểm** · metrics · dashboard |
| 7 (bài 24–26) | CI một-nguồn · MCP có quyền tối thiểu · bản phát hành đã nghiệm thu |
| 8 (bài 27–29) | Kit chạy trên dự án thật · xử lý khi gate chặn sai · lộ trình |

Nếu chỉ mang theo được hai điều, mang hai điều này.

Điều thứ nhất. Một quy tắc mà không có máy nào kiểm thì sẽ có lúc bị bỏ qua. Không phải vì ai xấu, mà
vì lúc gấp thì người ta quên. Muốn nó được tuân thật thì phải có thứ chặn lại khi nó bị vi phạm.

Điều thứ hai. Một máy chặn mà bạn chưa từng thử làm sai để xem nó có bắt được không, thì bạn chưa biết
nó có chạy hay không. Bạn chỉ đang tin là nó chạy.

Ba mươi bài vừa rồi là hai điều đó, áp vào từng chỗ cụ thể.

## Đọc thêm

- [`docs/BUILD_JOURNAL.md`](../BUILD_JOURNAL.md) — hồi ký dựng bộ kit thật này: bảy thời kỳ, sáu nguyên tắc,
  bốn điểm mù đã trả giá để biết. Đọc sau khi làm hết, vì giờ bạn đã có ngữ cảnh để nó có nghĩa.
- Thư viện thuật ngữ ở [`docs/library/`](../library/) — tra nhanh mọi luật, máy chặn, phán quyết, kỹ năng.
- Bài 25 — [mutation testing](do-chinh-bo-kiem.md): quay lại đọc mỗi lần điểm tụt.
