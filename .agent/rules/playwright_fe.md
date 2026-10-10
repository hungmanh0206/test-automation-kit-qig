# Playwright FE Rules

> Rule cho UI/E2E automation bằng Playwright. Phần nào ĐO ĐƯỢC thì có máy gác, và cột máy ghi rõ ở dưới —
> quy ước không có máy gác thì sau vài sprint không còn ai theo.

## Browser And Debug

- Khi debug UI, dùng viewport desktop `1920x1080`.
- Debug locator trên UI thật trước khi commit spec.
- Headless phù hợp cho CI hoặc khi test đã ổn định.

## Wait Strategy

- Dùng auto-waiting và web-first assertions.
- Không dùng `waitForTimeout()` làm wait chính. Ngoại lệ DUY NHẤT: chờ ngắn để **ổn định ảnh evidence** (animation/settle) — không dùng nó thay cho một condition.
- Dùng condition cụ thể: visible, enabled, URL, response, toast, modal state.
- ⚙️ Máy: `auto:review` bắt ngủ cứng 1–5s, `lint:locator` bắt từ 5s trở lên. Buộc phải ngủ thì ghi lý do bằng `// auto-review-disable-next-line <lý do>` — marker không có lý do vẫn bị tính.

## Evidence

- Bắt buộc cho MỌI case đã execute (PASS và FAIL) + MỌI step; chỉ ảnh/video (cấm `.json/.md/.log/.txt/.html/.csv/trace.zip`). Highlight đúng element, mask PII khách, đúng màn (không 404/blank/loading).
- Case phức tạp (nhiều bước, async, cross-app, iframe) → quay video.
- Screenshot/video trắng → rerun, hoặc render trang hiển thị data rồi CHỤP THÀNH ẢNH (bản `.html` không dùng làm evidence).
- Backlog attachment chỉ ảnh/video; trace/log để local debug. Chi tiết: RULE_GLOBAL §"Evidence — Quy chuẩn bắt buộc".

## Test Structure

- **Page Object cho mọi màn, không chỉ cho flow lặp lại.** Locator nằm rải trong spec thì UI đổi một nhãn là phải sửa hàng trăm chỗ.
- **Spec KHÔNG gọi `page.locator` trực tiếp** — đi qua Page Object hoặc `safe_target.one()/section()`.
  ⚙️ Máy: `auto:review -- --include-tasks` đếm (`spec-page-locator`). Đo 10/10/2026: **1381 lượt ở 254/354 spec theo task**, suite dùng chung chỉ ~6 lượt và cả 6 là spec kiểm chính bộ locator. Luật này là **P1 và chỉ đo tầng task** — 1381 dòng không phải 1381 lỗi, nhưng con số đó là mốc cho thư viện bước dùng lại ở v2.8.0.
- Page object không chứa business assertion quan trọng; assertion nằm ở test.
- Test data phải unique, traceable, cleanup được.
- Không dùng UI test để mutate dữ liệu thật nếu không rollback.
- **Mỗi test phải có khẳng định.** ⚙️ Máy: `auto:review` rule `no-assert` CHẶN. Helper `assertX`/`expectX` được tính là khẳng định. Chưa phán được thì `test.skip(true, "<lý do>")`, đừng để test rỗng xanh.
- **Tên test là HÀNH VI, viết tiếng Việt có dấu**, không phải mã TC trần. `test('CSDL_HS_TC_004')` không nói được case đó kiểm gì; mã TC để trong tiêu đề kèm hành vi thì `rerun:failed` vẫn dựng được `--grep`.
- **Đặt tên step theo `Arrange:` / `Act:` / `Assert:`** trong `test.step`. Khi lượt chạy đỏ, report chỉ đúng bước nào vỡ thay vì một khối phẳng.
- **Selector dễ vỡ phải ghi chú ngay trên dòng** kèm lý do, không ghi chú thì `lint:locator` tính là vi phạm.

## So sánh text

- **Chuẩn hoá trước khi so**: `trim()`, gộp khoảng trắng liên tiếp, và `normalize('NFC')` cho tiếng Việt.
  Hai chuỗi hiển thị y hệt nhau vẫn khác nhau về byte khi dấu được tổ hợp khác cách — đó là nguồn "FAIL" trông như bug sản phẩm.
- **Đọc đúng chỗ**: form giữ giá trị ở `input.value`, không ở `textContent`; dropdown của app hiện tại là Telerik nên phải đọc control tương ứng. Đọc sai chỗ rồi kết luận "màn không có field X" là **instrument mù**, không phải phát hiện.

## Report

- `results:summary` cho MỘT lượt chạy · `run:analysis` để biết lượt đó có đủ mẫu số để phán · `release:summary` cho khuyến nghị go/no-go của một mốc. Ba việc khác nhau, đừng dùng lẫn.
- ⚙️ `test.only` lọt vào spec được track là false-green nặng nhất: `--list` vẫn liệt kê đủ nên mọi gate khác đều xanh trong khi run thật chỉ chạy một test. `ci:scope` chặn chuyện đó trước khi push.
- Không bắt buộc Allure hay bất kỳ reporter ngoài nào. Report của Playwright cộng evidence ảnh/video là đủ cho luật của kit.

## Anti-Patterns

- Xóa assertion UI để chuyển case sang PASS.
- API-only verify cho testcase yêu cầu UI behavior mà không có review.
- Full suite mặc định khi selected testcase đủ.
- `toHaveURL(/./)` hoặc đếm `> 0` làm oracle — khớp mọi trang khác rỗng, mọi lưới không rỗng. ⚙️ `auto:review` chặn.
- Để `console.log` sót lại trong spec: log lượt chạy ngập thì dòng báo lỗi thật của Playwright bị che.
- Viết credential thẳng trong spec. `secret:scan` chỉ quét file ĐƯỢC TRACK, nên spec ở `outputs/**` (gitignore) hoàn toàn ngoài tầm nó — `auto:review` rule `cred-literal` lấp chỗ đó.

## Không thuộc phạm vi kit

Kit chỉ dành cho **Playwright**. Không có Selenium, không có Appium, không có lớp mobile-native — mobile
chỉ tới mức **mobile-web** (viewport nhỏ trong cùng một browser). Dự án cần mobile-native thì cần một kit
khác, và nói ra chỗ này rẻ hơn để người dùng tự phát hiện sau khi đã dựng xong profile.
