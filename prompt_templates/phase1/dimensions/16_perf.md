# Chiều coverage: Performance / Load / Stress Coverage

> Tag bắt buộc trong tiêu đề case: **`[Perf]`** · Mở khi: **requirement có SLA, hoặc scope có dữ liệu lớn/đồng thời**
> Tách khỏi [`02_gen_testcases.md`](../02_gen_testcases.md) 14/08/2026. Nội dung giữ NGUYÊN VĂN.
> Chiều khác tham chiếu trong bài thì mở file tương ứng ở cùng thư mục — danh sách đủ ở bảng điều hướng của `02`.

## 16. Performance / Load / Stress Coverage (sinh khi requirement có SLA hoặc scope có dữ liệu lớn/đồng thời)

Kit thiên functional; nhóm này CHỈ sinh khi có ngưỡng/tải trong scope hoặc rủi ro cao, và **ghi rõ ngưỡng lấy từ đâu** (SLA/NFR/spec). Không có ngưỡng → `N/A + lý do`, KHÔNG bịa số.

> **Executable ở Phase 2:** phần deterministic (web vitals, API response time so SLA, large-dataset render, resource weight) chạy thật bằng `scripts/qa/perf_check.js` (skill `perf_check`, threshold-gated, median N lần) — ngưỡng khai trong catalog `perf`. Verdict là **advisory** (UAT nhiễu), không tự thành product bug. **Điểm Lighthouse** (Performance/Accessibility/SEO/Best-practices) chạy qua CDP bằng `scripts/qa/lighthouse_check.js` (skill `lighthouse_check`, **opt-in nặng** — cần `npm i -D playwright-lighthouse lighthouse`, `--confirm-nonprod`, verdict advisory theo dải điểm chuẩn); evidence là ảnh bảng điểm.

- **Response time / SLA**: endpoint/màn quan trọng phản hồi trong ngưỡng NFR (vd list < 2s). TC đo thời gian thực tế so ngưỡng đã nêu.
- **Large dataset**: list/table/export với ≥100 (hoặc ngưỡng spec) bản ghi — render/pagination/scroll không mất dòng, không timeout, không treo (bắc cầu mục 7).
- **Pagination/virtual scroll**: trang lớn không nhân đôi/nhảy dòng; thời gian chuyển trang ổn định.
- **Concurrent action**: N user/N request đồng thời lên cùng resource (đặt chỗ, trừ kho, duyệt) → không oversell/double-count, tranh chấp xử lý đúng (bắc cầu mục 8).
- **Payload/limit**: input/list ở kích thước tối đa cho phép không hỏng response; vượt max → chặn có kiểm soát, không `500`.
- **Symptom N+1/slow**: thao tác trên list lớn không phình thời gian phi tuyến nếu quan sát được.

**Load thật, tức nhiều VU (Loại B: load, stress, soak)** thì dùng tool tải chuyên, opt-in qua `scripts/qa/load_check.js` với skill `load_check`, vốn là wrapper của k6.

k6 là binary NGOÀI, không phải npm dep, thiếu thì skip sạch. Nó **never-auto, chỉ chạy non-prod, cap khiêm tốn**, và KHÔNG nhét vào runner Playwright. k6 hợp kit hơn JMeter, còn **Katalon KHÔNG phải load tool**.

Loại A single-user gồm timing, vitals, render, resource thì dùng `perf_check.js`. Ngưỡng lấy từ NFR, khai trong k6 `thresholds`.
