import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * @visual — LANE visual regression (bộ chụp RIÊNG, tất định).
 *
 * Không tái dùng ảnh evidence: ảnh evidence là full-page, dữ liệu động, và mask PII bằng cách SỬA DOM ⇒ mỗi lần
 * chạy một ảnh khác, diff luôn ≠ 0. Lane này chụp riêng với `freeze()` + `mask` khai ở lớp task.
 *
 * GIỚI HẠN: oracle ở đây là "bản build đã được chấp nhận lần trước" ⇒ bắt **regression**, KHÔNG bắt cái sai từ đầu.
 * Lượt chạy đầu chỉ **tạo baseline** = **chưa kiểm gì**, phải soi ảnh trước khi nhận.
 *
 * MỘT TEST CHO MỖI MÀN — không gộp: bản đầu gộp 4 màn vào 1 test thì (a) cả 4 dùng chung hạn 30s nên màn thứ 4
 * timeout, và (b) một màn lỗi là mất luôn kết quả các màn sau. Tách ra thì mỗi màn có hạn riêng và báo cáo chỉ đúng
 * chỗ hỏng.
 *
 * Chạy: TASK_ENV=… npx playwright test tests/fe/visual --update-snapshots   (lần đầu, sau khi SOI ảnh)
 *       TASK_ENV=… npx playwright test tests/fe/visual                      (các lần sau: so baseline)
 */
const rc = require(path.resolve(__dirname, '../../../scripts/utils/runtime_config.js'));
const vis = require(path.resolve(__dirname, '../../../scripts/utils/ui/visual.js'));
const { login } = require(path.resolve(__dirname, '../../../scripts/qa/ui_conformance_check.js'));

/*
 * THIẾU ENV THÌ KHÔNG ĐƯỢC NÉM Ở CẤP MODULE.
 *
 * `getTaskKey()` ném khi thiếu `TASK_KEY`, và lời ném đó xảy ra lúc Playwright QUÉT file. Một spec ném
 * lúc quét là cả lượt liệt kê chết, nên panel Testing của VS Code hiện TRỐNG — trông y như chưa cài gì.
 * Đo 09/10/2026: đúng file này làm `playwright test --list` ra "0 tests in 0 files".
 *
 * Nuốt lỗi rồi báo xanh thì còn tệ hơn. Nên: không định vị được thư mục task ⇒ `targets` = null, và
 * `test.skip` ngay dưới sẽ bỏ qua KÈM LÝ DO. Bỏ qua có lý do thì đọc log là biết; ném lúc quét thì
 * không ai biết gì ngoài một panel trống.
 */
let taskDir = '';
try {
  taskDir = path.join(rc.REPO_ROOT, rc.getProjectOutputDir(), 'tasks', rc.getTaskKey());
} catch (e) { /* thiếu PROJECT_OUTPUT_DIR hoặc TASK_KEY — xử ở test.skip bên dưới */ }
const targets = taskDir ? vis.loadTargets(fs, path, taskDir) : null;

test.describe('@visual so ảnh với baseline đã được chấp nhận', () => {
  // Không có config ⇒ CHƯA ĐO ĐƯỢC. Cố ý không tạo test rỗng rồi báo xanh (0 màn mà xanh là false-green).
  test.skip(!taskDir, 'thiếu PROJECT_OUTPUT_DIR hoặc TASK_KEY ⇒ không định vị được thư mục task để đọc baseline');
  test.skip(!targets, 'chưa có requirements/visual_targets.json ⇒ CHƯA ĐO ĐƯỢC (không phải PASS). Khai {screens:[{name,url,mask?[]}]} rồi chạy lại.');
  test.skip(!!targets && !targets.screens.length, 'visual_targets.json không có màn hợp lệ (cần name + url)');

  for (const s of (targets ? targets.screens : [])) {
    test(`màn: ${s.name}`, async ({ page }) => {
      // Mỗi màn ~1 goto + settle + chụp; 90s là dư cho màn chậm mà vẫn phát hiện được treo thật.
      test.setTimeout(s.timeoutMs || 90_000);
      const base = (process.env.OPS_BASE_URL || '').replace(/\/+$/, '');
      await login(page, targets!.login);
      await page.setViewportSize({ width: s.width || 1440, height: s.height || 900 });
      await page.goto(/^https?:/.test(s.url) ? s.url : base + s.url, { waitUntil: 'networkidle', timeout: 60_000 });
      const did = await vis.freeze(page, { settle: s.settle || 1500 });
      // eslint-disable-next-line no-console
      console.log(`[visual] ${s.name}: ${did.join(' · ')} · mask ${(s.mask || []).length} vùng`);
      await expect(page).toHaveScreenshot(`${s.name.replace(/[^A-Za-z0-9]+/g, '_')}.png`, vis.captureOptions(page, s.mask, s));
    });
  }
});
