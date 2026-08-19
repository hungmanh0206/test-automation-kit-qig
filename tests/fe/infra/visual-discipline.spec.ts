import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * @infra — kỷ luật CHỤP TẤT ĐỊNH của lane visual.
 *
 * Vì sao cần test: visual regression chỉ có giá trị khi ảnh **tất định**. Nếu còn animation/caret/lazy-load thì diff
 * là nhiễu, và đội sẽ học cách bỏ qua nó — tệ hơn không có. Test dưới đây kiểm bằng DOM giả lập (không chạm UAT).
 */
const vis = require(path.resolve(__dirname, '../../../scripts/utils/ui/visual.js'));

test.describe('@infra visual — triệt nguồn bất định', () => {
  test('freeze(): tắt animation/transition/caret và lazy-load xong rồi về đầu trang', async ({ page }) => {
    await page.setContent(`<style>@keyframes k{from{opacity:0}to{opacity:1}} .a{animation:k 3s infinite}</style>
      <div class="a" style="height:3000px">dài</div><input value="x">`);
    const did = await vis.freeze(page, { settle: 100 });
    expect(did.join(' ')).toMatch(/tắt animation/);
    expect(did.join(' ')).toMatch(/lazy-load/);
    const dur = await page.evaluate(() => getComputedStyle(document.querySelector('.a')!).animationDuration);
    expect(dur, 'animation phải bị đưa về 0s').toBe('0s');
    expect(await page.evaluate(() => window.scrollY), 'phải về đầu trang sau khi kéo').toBe(0);
  });

  test('captureOptions(): mặc định KHÔNG full-page và có ngưỡng diff', async ({ page }) => {
    await page.setContent('<div id="a">x</div>');
    const o = vis.captureOptions(page, ['#a']);
    expect(o.animations).toBe('disabled');
    expect(o.caret).toBe('hide');
    expect(o.fullPage, 'full-page càng dài càng dễ nhiễu ⇒ mặc định tắt').toBe(false);
    expect(o.maxDiffPixelRatio).toBe(0.01);
    expect(o.mask).toHaveLength(1);
  });

  test('loadTargets(): không có config ⇒ null (để lane báo CHƯA ĐO ĐƯỢC, không phải PASS)', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vis-'));
    expect(vis.loadTargets(fs, path, d)).toBeNull();
    fs.mkdirSync(path.join(d, 'requirements'), { recursive: true });
    fs.writeFileSync(path.join(d, 'requirements', 'visual_targets.json'),
      JSON.stringify({ screens: [{ name: 'ok', url: '/x' }, { name: 'thieu url' }] }));
    const t = vis.loadTargets(fs, path, d);
    expect(t.screens, 'màn thiếu url phải bị loại, không âm thầm chụp sai').toHaveLength(1);
    expect(t.invalid, 'và phải ĐẾM số màn bị loại để người khai biết').toBe(1);
  });
});
