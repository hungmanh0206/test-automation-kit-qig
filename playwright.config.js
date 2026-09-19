const { defineConfig, devices } = require('@playwright/test');
const {
  getProjectOutputDir,
  getRunId,
  getTaskKey,
  getTaskOutputDir,
  getTestResultsDir,
  loadEnvFiles,
} = require('./scripts/utils/runtime_config');

loadEnvFiles();

// --- Lane strategy (QUAN TRỌNG) ---------------------------------------------------------------
// Trong Playwright, `project` = NHÂN BẢN suite (mỗi project chạy lại mọi test khớp phạm vi), KHÔNG
// phải chia việc. Nên: lane PR mặc định chỉ `chromium-desktop`; cross-browser là LÀN RIÊNG bật bằng
// env (nightly/manual) → tránh nhân 3× số lượt chạy + 3× evidence + 3× nhiễu flaky trên mọi PR.
const CROSS_BROWSER = process.env.CROSS_BROWSER === '1';
// Khi suite lớn: chỉ chạy tập critical trên engine phụ, vd CROSS_BROWSER_GREP='@cross-browser'
// rồi tag `test('checkout @cross-browser', …)`. Bỏ trống = engine phụ chạy full lane desktop.
const XB_GREP = process.env.CROSS_BROWSER_GREP ? new RegExp(process.env.CROSS_BROWSER_GREP) : null;
// Spec hạ tầng/diagnostic dưới tests/support/** (cần DB/creds riêng, có spec đọc file lúc load) —
// KHÔNG thuộc lane suite; chạy có chủ đích bằng INFRA_VERIFY=1.
const INFRA_VERIFY = process.env.INFRA_VERIFY === '1';

// Dùng CHUNG cho MỌI project desktop — quên ignore ở 1 engine là mobile-web/load/support bị phủ chéo.
// (`load/` hiện cũng không khớp testMatch `*.spec.*`, giữ ignore làm lớp chắn dự phòng.)
const desktopIgnore = ['**/mobile-web/**', '**/load/**', '**/support/**'];
const desktop = (name, device, extra = {}) => ({ name, testIgnore: desktopIgnore, use: { ...devices[device] }, ...extra });

const projectOutputDir = getProjectOutputDir();
const taskKey = getTaskKey();
const taskOutputDir = getTaskOutputDir({ projectOutputDir, taskKey });
const runId = getRunId();
const testResultsDir = getTestResultsDir({ taskOutputDir, runId });

/*
 * --- Cấu hình runner (thêm 23/08/2026 sau khi ĐO) -----------------------------------------------
 * Trước đó KHÔNG khai một tuỳ chọn nào trong 13 tuỳ chọn dưới đây ⇒ chạy toàn bộ mặc định. Hai chỗ
 * mặc định đó phá đúng cơ chế cao cấp mà kit đã đầu tư:
 *
 * ① `forbidOnly` (mặc định false) — ĐƯỜNG FALSE-GREEN CÒN SỐNG. Đo thật: cắm 1 `test.only` vào
 *    `tests/fe/infra/assertions.spec.ts` rồi chạy → `test_inventory_gate` báo **HAS_TESTS · 535 test**
 *    (vì `--list` vẫn liệt kê hết), còn run thật chạy **1 test** và kết luận **"1 passed"**. Nghĩa là
 *    38 gate còn lại nhìn đâu cũng thấy xanh trong khi 534 test không hề chạy.
 * ② `retries` (mặc định 0) — Playwright chỉ gắn `flaky` cho test PASS SAU RETRY. Không retry ⇒
 *    `results.json` không bao giờ có `flaky` ⇒ `metrics_collect.js` ghi `flaky=0` ⇒ `reliability_index`
 *    (TRI = pass sạch/tổng, flakyRate, quarantine) luôn tính trên dữ liệu rỗng. Máy có, nguyên liệu không.
 *
 * Các giá trị khác chọn theo môi trường UAT thật (chậm, có login OIDC), không lấy mặc định của docs.
 */
const CI = !!process.env.CI;

module.exports = defineConfig({
  testDir: './tests',
  outputDir: `${testResultsDir}/artifacts`,
  // Lỡ commit `test.only` thì CI ĐỎ, không phải xanh với 1 test. Local vẫn cho dùng để soi 1 case.
  forbidOnly: CI,
  // CI: 2 lần thử lại → sinh tín hiệu `flaky` cho reliability_index/flaky quarantine (xem ② ở trên).
  // Local: 0 — người đang sửa test cần thấy fail ngay, không bị retry che.
  // Retry KHÔNG thay cho luật "rerun 2–3 lần trước khi log bug": đó là rerun có người đọc kết quả.
  retries: CI ? 2 : 0,
  // Runner CI 4 vCPU: cố định 2 worker cho kết quả ổn định (mặc định = cores/2 nhưng phụ thuộc máy).
  workers: CI ? 2 : undefined,
  // Hạ tầng vỡ (hết creds, app sập) thì dừng sớm thay vì đốt 40 phút runner rồi mới báo.
  maxFailures: CI ? 20 : 0,
  /*
   * fullyParallel: MẶC ĐỊNH TẮT, bật bằng `PW_FULLY_PARALLEL=1`. Cố ý không bật sẵn:
   * test trong cùng file của task thật (chuỗi tạo đơn → thanh toán → xác nhận, `batch_*.spec.ts`) được
   * viết với giả định chạy TUẦN TỰ và dùng chung state (đơn vừa tạo, session vừa seed). Những spec đó
   * nằm ở máy người chạy task (không track — xem `ci_scope.json`) nên tôi KHÔNG kiểm được giả định của
   * chúng; bật toàn cục là đổi hành vi dưới chân người khác.
   * Suite `tests/fe/infra` thì thuần (0 file dùng `describe.configure`, không state chung) ⇒ chạy song
   * song an toàn: đặt `PW_FULLY_PARALLEL=1` cho lane đó khi muốn nhanh hơn.
   */
  fullyParallel: process.env.PW_FULLY_PARALLEL === '1',
  // UAT chậm hơn local: 30s mặc định hay hết giờ ở bước login OIDC + first paint của SPA.
  timeout: 90_000,
  expect: {
    // 5s mặc định là nguồn flaky thật trên UAT (bảng render sau 2 request liên tiếp).
    timeout: 10_000,
  },
  reporter: [
    /*
     * `dot` thay vì `list`, vì người đọc output này thường là AGENT, không phải người.
     *
     * Đo 19/09/2026 trên suite hạ tầng 594 test: `list` in 143.542 byte (~35.900 token), `dot` in
     * 10.646 byte (~2.700 token). Giảm 92,6%, và đó là lệnh tốn nhất trong kit — mọi gate cộng lại
     * chỉ 2.635 byte. `list` in một dòng cho MỖI test đã pass, tức trả tiền context cho thông tin
     * "không có gì xảy ra".
     *
     * ĐÃ KIỂM là không mất gì:
     *   · chi tiết case ĐỎ còn nguyên — mã case, giá trị mong đợi, `file:dòng` (dựng case đỏ cố ý để so)
     *   · `results.json` vẫn ghi (bug_reporter.js đọc file này)
     *   · `learn_reporter.js` vẫn chạy (`knowledge/metrics/runs.jsonl` tăng đúng 1 dòng mỗi lượt)
     *   · báo cáo html vẫn sinh
     *   · CI KHÔNG đổi: mọi job đều truyền `--reporter=blob` hoặc `--reporter=html` nên ghi đè dòng này
     *
     * Người ngồi xem trực tiếp muốn thấy tên từng test thì: `PW_REPORTER=list npm test`.
     */
    [process.env.PW_REPORTER || 'dot'],
    ['html', { outputFolder: `${testResultsDir}/playwright-report`, open: 'never' }],
    ['json', { outputFile: `${testResultsDir}/results.json` }],
    // TỰ ĐỘNG thu learning data sau mỗi run (knowledge/metrics + historical_execution) — khỏi phải
    // nhớ gọi `npm run learn`. PHẢI đứng CUỐI: reporter chạy tuần tự, cần json ghi xong results.json
    // trước (đã đo: globalTeardown chạy TRƯỚC json nên KHÔNG dùng được). Tắt: LEARN_AFTER_RUN=0.
    ['./scripts/qa/learn_reporter.js'],
  ],
  use: {
    /*
     * baseURL: cho phép `page.goto('/orders')`. Chỉ khai khi env có — KHÔNG hardcode UAT, vì task chạy
     * bằng `profiles/<TASK>/task.env` và mỗi task có thể trỏ site khác (OPS/LMS/staging).
     * Spec cũ dùng URL tuyệt đối vẫn chạy nguyên (baseURL chỉ áp cho đường dẫn tương đối).
     */
    ...(process.env.OPS_BASE_URL ? { baseURL: process.env.OPS_BASE_URL } : {}),
    /*
     * testIdAttribute: ĐO 23/08/2026 — toàn repo + `knowledge/locators/` KHÔNG có `data-testid`,
     * `data-test`, `data-qa` nào, và 0 lần dùng `getByTestId`. App là ant-design + Metronic, không phát
     * test id. Nên tầng 5 của `locator_strategy.md` (getByTestId) hiện KHÔNG dùng được — không phải vì
     * khai sai tên thuộc tính mà vì app chưa có gì để bám. Để env mở sẵn cho ngày dev thêm test id.
     */
    ...(process.env.PW_TEST_ID_ATTR ? { testIdAttribute: process.env.PW_TEST_ID_ATTR } : {}),
    // Tách khỏi test timeout để chẩn đoán được "chậm ở đâu": hết giờ action ≠ hết giờ điều hướng.
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    screenshot: 'only-on-failure',
    video: process.env.PW_VIDEO || 'off',
    trace: process.env.PW_TRACE || 'off',
  },
  // Desktop chạy tests/ trừ mobile-web|load|support; mobile-web chạy trên thiết bị thật (touch/UA/isMobile).
  // Không để project mobile phủ toàn bộ suite (tránh nhân 3 lần). Task-scoped scripts (automation/*.js)
  // KHÔNG dùng projects này — chúng tự emulate qua browser.newContext({ ...devices[...] }), xem
  // prompt_templates/phase2/04_execute_fe_playwright.md.
  /*
   * Cờ CHỈ DÀNH CHO CHROMIUM. Tắt dấu hiệu automation: một số SPA phát hiện automation rồi chặn
   * redirect OIDC (Keycloak/Auth0/Okta…) hoặc loop trang login trắng. Kèm `addInitScript` override
   * `navigator.webdriver` ở helper login của app.
   *
   * TRƯỚC ĐÂY ĐẶT Ở GLOBAL `use` kèm ghi chú "đã nghiệm thu: không làm Firefox/WebKit vỡ". Ghi chú đó
   * SAI, và sai theo NỀN TẢNG: trên Windows WebKit bỏ qua cờ lạ, còn trên Linux nó từ chối thẳng —
   * `Cannot parse arguments: Unknown option --disable-blink-features=AutomationControlled` — rồi thoát
   * với exit 1. Hậu quả: mọi test webkit trên CI chết ở bước launch, và lane cross-browser hỏng suốt
   * từ lúc thêm cờ. Nó ẩn lâu vì job đó chỉ chạy khi bấm tay.
   *
   * Bài học: "chạy được ở máy tôi" không chứng minh cờ của engine này vô hại với engine khác.
   */
  projects: [
    desktop('chromium-desktop', 'Desktop Chrome', {
      use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--disable-blink-features=AutomationControlled'] } },
    }), // lane mặc định (PR): 1 engine, phản hồi nhanh
    // Lane cross-browser — CHỈ khi CROSS_BROWSER=1 (nightly/manual). WebKit đã có sẵn trong CI vì
    // devices['iPhone 13'] dùng engine webkit; FIREFOX phải thêm vào bước `playwright install`.
    ...(CROSS_BROWSER
      ? [
          desktop('firefox-desktop', 'Desktop Firefox', XB_GREP ? { grep: XB_GREP } : {}),
          desktop('webkit-desktop', 'Desktop Safari', XB_GREP ? { grep: XB_GREP } : {}),
        ]
      : []),
    {
      name: 'iphone-13',
      testDir: './tests/mobile-web',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'pixel-7',
      testDir: './tests/mobile-web',
      use: { ...devices['Pixel 7'] },
    },
    // Opt-in (INFRA_VERIFY=1): spec hạ tầng/diagnostic — không chạy trong lane suite/PR.
    ...(INFRA_VERIFY ? [{ name: 'infra-verify', testDir: './tests/support', use: { ...devices['Desktop Chrome'] } }] : []),
  ],
});
