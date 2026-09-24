import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * @infra — mọi script CLI trong `scripts/**` phải có `require.main === module` guard.
 *
 * Vì sao thành test: trong CÙNG một phiên tôi mắc lỗi này ở **ba** file khác nhau (`cross_surface_diff.js`,
 * `fixture_matrix.js`, `mutation_check.js`). Hậu quả không hiển nhiên: `require()` file đó trong test làm CLI chạy
 * và tự `process.exit(2)` vì thiếu tham số — test chết mà nhìn như lỗi test, mất thời gian truy sai chỗ.
 * Đo 20/08/2026 — phạm vi cũ CHỈ soi `scripts/qa/`, nên cả tầng `scripts/integrations/` nằm ngoài tầm và
 * 5/5 script Google Sheet thiếu guard mà test vẫn xanh. Nguy hơn nhóm qa: mấy file đó có `--apply` ghi vào hệ thống
 * KHÔNG có API xoá. Nay quét cả `scripts/` theo đệ quy.
 *
 * Đây là loại lỗi lặp lại ⇒ phải có máy gác, không dựa vào nhớ.
 */
const SCRIPTS_DIR = path.resolve(__dirname, '../../../scripts');

/** Mọi file .js dưới scripts/ (đệ quy) — trước đây chỉ đọc MỘT tầng của scripts/qa. */
const allScripts = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return e.name === 'node_modules' ? [] : allScripts(p);
  return e.name.endsWith('.js') ? [p] : [];
});

test('@infra script CLI nào gọi process.exit ở top-level thì phải có require.main guard', () => {
  const offenders: string[] = [];
  for (const abs of allScripts(SCRIPTS_DIR)) {
    const f = path.relative(SCRIPTS_DIR, abs).split(path.sep).join('/');
    const src = fs.readFileSync(abs, 'utf8');
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
 *
 * PHẠM VI GỒM CẢ `.md`, và đó là lỗ hổng có thật chứ không phải phòng xa: bản trước chỉ quét `.js/.ts/.json`
 * dưới `scripts/` + `tests/`, nên khi chính `CHANGELOG.md` — đoạn văn ĐANG MÔ TẢ cái bẫy này — bị nuốt escape
 * và giữ 5 ký tự 0x08 thật, không máy nào kêu (đo 20/08/2026). Prompt template và `.agent/rules` còn nguy hơn:
 * chúng là bề mặt ĐIỀU KHIỂN HÀNH VI, một escape hỏng ở đó làm luật im lặng không khớp y như trong code.
 * `outputs/`, `knowledge/`, `node_modules/` đứng ngoài: dữ liệu chạy thật, không phải nguồn kit.
 */
test('@infra source không chứa ký tự điều khiển lạc (TOÀN BỘ dải C0, trừ tab/LF/CR)', () => {
  const REPO = path.resolve(__dirname, '../../../');
  const roots = ['scripts', 'tests', 'prompt_templates', '.agent', 'partial-rerun'].map((d) => path.join(REPO, d));
  // File cấu hình CI nằm NGOÀI các thư mục trên ⇒ phải kể tên riêng, không thì lọt (đã lọt thật).
  const extraFiles = ['.gitlab-ci.yml'].map((f) => path.join(REPO, f)).filter((f) => fs.existsSync(f));
  const bad: string[] = [];
  const check = (p: string) => {
    const src = fs.readFileSync(p, 'utf8');
    /*
     * QUÉT TOÀN BỘ dải C0, không phải danh sách chọn lọc. Bản cũ liệt đúng 4 ký tự (0x08/0x0B/0x0C/0x1B)
     * nên một byte 0x01 nằm trong `.gitlab-ci.yml` đi qua êm — và nó làm GitLab KHÔNG TẠO NỔI pipeline
     * (yaml invalid, 0 jobs) suốt 5 commit. Danh sách chọn lọc luôn thiếu đúng ký tự của lần sau.
     */
    const m = src.match(new RegExp('[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]'));
    if (m) bad.push(`${path.relative(REPO, p).split(path.sep).join('/')} (ký tự 0x${m[0].charCodeAt(0).toString(16)})`);
  };
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!/^(node_modules|\.git)$/.test(e.name)) walk(p); continue; }
      if (/\.(js|ts|mjs|cjs|json|md)$/.test(e.name)) check(p);
    }
  };
  roots.forEach(walk);
  extraFiles.forEach(check);
  // Doc gốc ở thư mục repo — CHANGELOG là nơi đã dính, đừng để nó ngoài tầm lần nữa.
  for (const f of ['CHANGELOG.md', 'README.md', 'USER_GUIDE.md', 'QUICKSTART.md', 'RULE_GLOBAL.md', 'CLAUDE.md']) {
    const abs = path.join(REPO, f);
    if (fs.existsSync(abs)) check(abs);
  }
  expect(bad, `ký tự điều khiển lạc — gần như luôn là escape bị shell/heredoc ăn: ${bad.join(', ')}`).toEqual([]);
});
