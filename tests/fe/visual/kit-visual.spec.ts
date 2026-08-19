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
 * Lần chạy đầu chỉ **tạo baseline** — Playwright báo fail để buộc người xem ảnh rồi commit; đó là **chưa kiểm gì**,
 * không phải "đã pass".
 *
 * Chạy: TASK_ENV=… npx playwright test tests/fe/visual --update-snapshots   (lần đầu, sau khi SOI ảnh)
 *       TASK_ENV=… npx playwright test tests/fe/visual                      (các lần sau: so baseline)
 */
const rc = require(path.resolve(__dirname, '../../../scripts/utils/runtime_config.js'));
const vis = require(path.resolve(__dirname, '../../../scripts/utils/ui/visual.js'));
const { login } = require(path.resolve(__dirname, '../../../scripts/qa/ui_conformance_check.js'));

const taskDir = path.join(rc.REPO_ROOT, rc.getProjectOutputDir(), 'tasks', rc.getTaskKey());
const targets = vis.loadTargets(fs, path, taskDir);

test.describe('@visual so ảnh với baseline đã được chấp nhận', () => {
  test.skip(!targets, `chưa có requirements/visual_targets.json cho task này ⇒ CHƯA ĐO ĐƯỢC (không phải PASS). Khai {screens:[{name,url,mask?[]}]} rồi chạy lại.`);

  test('mỗi màn khai trong visual_targets phải khớp baseline', async ({ page }) => {
    test.skip(!targets || !targets.screens.length, 'visual_targets.json không có màn hợp lệ (cần name + url)');
    const base = (process.env.OPS_BASE_URL || '').replace(/\/+$/, '');
    await login(page, targets!.login);
    for (const s of targets!.screens) {
      await page.setViewportSize({ width: s.width || 1440, height: s.height || 900 });
      await page.goto(/^https?:/.test(s.url) ? s.url : base + s.url, { waitUntil: 'networkidle', timeout: 60000 });
      const did = await vis.freeze(page, { settle: s.settle || 1500 });
      // eslint-disable-next-line no-console
      console.log(`[visual] ${s.name}: ${did.join(' · ')} · mask ${(s.mask || []).length} vùng`);
      await expect(page).toHaveScreenshot(`${s.name.replace(/[^A-Za-z0-9]+/g, '_')}.png`, vis.captureOptions(page, s.mask, s));
    }
  });
});
