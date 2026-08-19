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
