import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * @infra — mọi script CLI trong `scripts/qa/` phải có `require.main === module` guard.
 *
 * Vì sao thành test: trong CÙNG một phiên tôi mắc lỗi này ở **ba** file khác nhau (`cross_surface_diff.js`,
 * `fixture_matrix.js`, `mutation_check.js`). Hậu quả không hiển nhiên: `require()` file đó trong test làm CLI chạy
 * và tự `process.exit(2)` vì thiếu tham số — test chết mà nhìn như lỗi test, mất thời gian truy sai chỗ.
 * Đây là loại lỗi lặp lại ⇒ phải có máy gác, không dựa vào nhớ.
 */
const QA_DIR = path.resolve(__dirname, '../../../scripts/qa');

test('@infra script CLI nào gọi process.exit ở top-level thì phải có require.main guard', () => {
  const offenders: string[] = [];
  for (const f of fs.readdirSync(QA_DIR).filter((x) => x.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(QA_DIR, f), 'utf8');
    // File có CLI (đọc process.argv và exit) nhưng KHÔNG có guard và cũng KHÔNG export gì ⇒ bỏ qua (không ai require).
    const hasCli = /process\.argv/.test(src) && /process\.exit\(/.test(src);
    const hasGuard = /require\.main\s*===\s*module/.test(src);
    const isRequirable = /module\.exports/.test(src);
    if (hasCli && isRequirable && !hasGuard) offenders.push(f);
  }
  expect(offenders, `những file này export ra ngoài mà CLI vẫn chạy khi require: ${offenders.join(', ')}`).toEqual([]);
});

/**
 * @infra — VỆ SINH MÃ NGUỒN: không được có ký tự điều khiển lạc trong source.
 *
 * Vì sao thành máy gác: escape `\b` / `\r` / `\n` đi qua shell/heredoc bị biến thành **ký tự điều khiển thật**
 * (backspace 0x08, CR, LF) nằm luôn trong regex — script vẫn chạy êm nhưng luật KHÔNG BAO GIỜ khớp. Trong một
 * phiên tôi mắc đúng lỗi này **3 lần với `\b`** (`output_rules`, `spec_extract`, `figma_to_ui_contract`) và 2 lần
 * với `\r\n`. Lỗi lặp lại thì phải có máy gác, không dựa vào nhớ.
 */
test('@infra source không chứa ký tự điều khiển lạc (0x08/0x0B/0x0C/0x1B)', () => {
  const roots = [path.resolve(__dirname, '../../../scripts'), path.resolve(__dirname, '../../../tests')];
  const bad: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.(js|ts|mjs|cjs|json)$/.test(e.name)) continue;
      const src = fs.readFileSync(p, 'utf8');
      const m = src.match(/[\x08\x0B\x0C\x1B]/);
      if (m) bad.push(`${path.relative(process.cwd(), p)} (ký tự 0x${m[0].charCodeAt(0).toString(16)})`);
    }
  };
  roots.forEach(walk);
  expect(bad, `ký tự điều khiển lạc — gần như luôn là escape bị shell/heredoc ăn: ${bad.join(', ')}`).toEqual([]);
});
