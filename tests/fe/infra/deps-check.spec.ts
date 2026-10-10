import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * @infra — MỖI DEPENDENCY PHẢI CÓ NƠI DÙNG, HOẶC CÓ MỘT DÒNG GIẢI THÍCH.
 *
 * VÌ SAO GATE NÀY RA ĐỜI, và đây là một bài học về tiền đề chứ không về dependency:
 *
 * Một lượt rà độc lập (10/10/2026) kết luận `xlsx` là dep chết — khai bằng URL tới CDN SheetJS,
 * `npm ci` trả 403 sau proxy, và `grep` trong `scripts/` + `tests/` không thấy ai `require`. Kết luận
 * đó SAI: có 11 file dùng nó, nằm trong `outputs/**` (lớp PROJECT, gitignore). Gỡ theo kết luận đó là
 * làm gãy automation của một task đang chạy.
 *
 * Nhưng cùng lượt rà lại BỎ SÓT một dep chết thật: `form-data`. Không ai `require` nó, và chỗ duy nhất
 * dùng `new FormData()` là GLOBAL của Node (sàn Node của kit là 20). `axios` vẫn kéo nó theo dạng phụ
 * thuộc gián tiếp, nên gỡ dep trực tiếp không đổi gì lúc chạy.
 *
 * Cái thiếu không phải một lần `grep` rộng hơn. Là MỘT CHỖ KHAI: dep này dùng ở đâu, vì sao khai bằng
 * URL, và gỡ được khi nào. Nên gate không chỉ tìm dep chết — nó bắt mọi dep không tự chứng minh được
 * phải có một dòng trong `.agent/config/deps_allow.json`. Lần rà sau đọc dòng đó thay vì đoán lại.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const DEPS = path.join(REPO, 'scripts/qa/deps_check.js');

/** Cây giả tối thiểu: `package.json` + `deps_allow.json` + một file mã, đã `git init` và `git add`. */
function cayGia(pkg: object, allow: object, ma = '// khong dung gi\n') {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'deps-'));
  fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');
  fs.mkdirSync(path.join(d, '.agent', 'config'), { recursive: true });
  fs.writeFileSync(path.join(d, '.agent', 'config', 'deps_allow.json'), JSON.stringify(allow, null, 2), 'utf8');
  fs.mkdirSync(path.join(d, 'src'), { recursive: true });
  fs.writeFileSync(path.join(d, 'src', 'a.js'), ma, 'utf8');
  /*
   * `git init` + `add` là BẮT BUỘC: phép kiểm lấy danh sách file bằng `git ls-files`, và không có git
   * thì nó thoát 0 với "KHÔNG PHÁN ĐƯỢC" — fixture sẽ xanh mà chẳng đo gì cả.
   */
  const g = (...a: string[]) => execFileSync('git', a, { cwd: d, encoding: 'utf8', stdio: 'pipe' });
  g('init', '-q');
  g('config', 'user.email', 'x@example.invalid');
  g('config', 'user.name', 'x');
  g('add', '-A');
  return d;
}

function chay(d: string) {
  const r = spawnSync(process.execPath, [DEPS, '--repo', d], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

const LOCK_CO_HASH = {
  lockfileVersion: 3,
  packages: { 'node_modules/thu': { integrity: 'sha512-giadinhbam' } },
};

test.describe('@infra deps:check — dependency phải có nơi dùng hoặc có lý do', () => {
  test('repo thật hiện tại: ĐẠT', () => {
    const r = spawnSync(process.execPath, [DEPS], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    expect(r.status, `${r.stdout || ''}${r.stderr || ''}`).toBe(0);
  });

  test('dep KHÔNG ai dùng và KHÔNG có miễn trừ ⇒ CHẶN', () => {
    const d = cayGia({ dependencies: { 'khong-ai-dung': '^1.0.0' } }, { mien_tru: {} });
    try {
      const r = chay(d);
      expect(r.code, r.out).toBe(1);
      expect(r.out).toContain('khong-ai-dung');
      expect(r.out, 'phải chỉ đường ra, không chỉ báo sai').toContain('deps_allow.json');
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('dep có miễn trừ kèm `vi_sao` ⇒ ĐẠT', () => {
    const d = cayGia(
      { dependencies: { 'khong-ai-dung': '^1.0.0' } },
      { mien_tru: { 'khong-ai-dung': { noi_dung: 'ngoai cay track', vi_sao: 'co ly do that' } } },
    );
    try { expect(chay(d).code).toBe(0); } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('dep dạng URL mà miễn trừ KHÔNG có `url_ok` ⇒ CHẶN', () => {
    const d = cayGia(
      { dependencies: { thu: 'https://vi-du.invalid/thu-1.0.0.tgz' } },
      { mien_tru: { thu: { noi_dung: 'x', vi_sao: 'y' } } },
    );
    try {
      const r = chay(d);
      expect(r.code, r.out).toBe(1);
      expect(r.out).toContain('url_ok');
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('dep dạng URL mà lockfile KHÔNG có `integrity` ⇒ CHẶN', () => {
    /*
     * Đây là phép kiểm đáng giá nhất của nhóm URL: một tarball không khoá băm có thể đổi nội dung dưới
     * chân mình mà lockfile vẫn "khớp". `url_ok` cho phép đi đường đó, nhưng không cho phép đi mù.
     */
    const d = cayGia(
      { dependencies: { thu: 'https://vi-du.invalid/thu-1.0.0.tgz' } },
      { mien_tru: { thu: { url_ok: true, noi_dung: 'x', vi_sao: 'y' } } },
    );
    try {
      const r = chay(d);
      expect(r.code, r.out).toBe(1);
      expect(r.out).toContain('integrity');
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('dep dạng URL + `url_ok` + lockfile có `integrity` ⇒ ĐẠT', () => {
    const d = cayGia(
      { dependencies: { thu: 'https://vi-du.invalid/thu-1.0.0.tgz' } },
      { mien_tru: { thu: { url_ok: true, noi_dung: 'x', vi_sao: 'y' } } },
    );
    fs.writeFileSync(path.join(d, 'package-lock.json'), JSON.stringify(LOCK_CO_HASH, null, 2), 'utf8');
    execFileSync('git', ['add', '-A'], { cwd: d, stdio: 'pipe' });
    try {
      const r = chay(d);
      expect(r.code, r.out).toBe(0);
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('dep chỉ gọi ở dòng lệnh (npm script) vẫn tính là có nơi dùng', () => {
    /* `eslint`/`lighthouse` không bao giờ bị `require`. Không nhận bề mặt này thì gate báo oan. */
    const d = cayGia({ dependencies: { 'cong-cu': '^1.0.0' }, scripts: { x: 'cong-cu --check' } }, { mien_tru: {} });
    try { expect(chay(d).code, 'gọi ở npm script là một nơi dùng').toBe(0); } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('miễn trừ THỪA (dep đã tự chứng minh) ⇒ cảnh báo, không chặn', () => {
    /*
     * Cảnh báo chứ không chặn, nhưng vẫn phải kêu: một danh sách miễn trừ không ai dọn sẽ dần che đúng
     * thứ nó phải soi — `@eslint/js` đã là một ca như vậy ngay ở lượt đầu.
     */
    const d = cayGia(
      { dependencies: { codung: '^1.0.0' } },
      { mien_tru: { codung: { noi_dung: 'x', vi_sao: 'y' } } },
      "const a = require('codung');\n",
    );
    try {
      const r = chay(d);
      expect(r.code, r.out).toBe(0);
      expect(r.out).toContain('xoá dòng miễn trừ');
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('`xlsx` vẫn còn, và miễn trừ của nó nói rõ nơi dùng + lý do + khi nào gỡ được', () => {
    /*
     * Khoá lại KẾT LUẬN, không chỉ khoá cơ chế. Lượt rà sau rất dễ lặp lại đúng câu "xlsx không ai
     * dùng" rồi gỡ nó. Ba trường dưới đây là câu trả lời sẵn cho lượt đó.
     */
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
    const co = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    expect(co.xlsx, 'xlsx bị gỡ thì automation của task dùng nó sẽ gãy').toBeTruthy();

    const allow = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/deps_allow.json'), 'utf8'));
    const m = allow.mien_tru.xlsx;
    expect(m?.url_ok).toBe(true);
    expect(m?.noi_dung, 'phải nói nơi dùng').toContain('outputs/');
    expect(m?.vi_sao_khong_dung_registry, 'phải nói vì sao không về registry').toMatch(/CVE|lỗ/);
    expect(m?.go_duoc_khi, 'phải nói gỡ được khi nào, không để miễn trừ sống mãi').toBeTruthy();
  });

  test('`form-data` đã được gỡ khỏi dependency TRỰC TIẾP', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
    const co = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    expect(co['form-data'], 'đây là dep chết thật — `new FormData()` là global của Node 20').toBeUndefined();
    const src = fs.readFileSync(path.join(REPO, 'scripts/integrations/backlog/bug_reporter.js'), 'utf8');
    expect(src, 'chỗ dùng phải là global, không phải require').toContain('new FormData()');
    expect(src).not.toMatch(/require\(\s*['"]form-data['"]/);
  });

  test('mục "Mạng cần mở" khai host ngoài registry — người dựng CI phải biết trước', () => {
    const r = fs.readFileSync(path.join(REPO, '.github/workflows/README.md'), 'utf8');
    expect(r).toContain('cdn.sheetjs.com');
    expect(r, 'phải nói thiếu thì sao').toMatch(/403/);
  });
});
