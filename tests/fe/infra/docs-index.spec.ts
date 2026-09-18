import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * Lưới cho `docs:index` — máy bắt mọi neo yêu cầu phải tra ngược được về file và số dòng.
 *
 * Kit đã bắt buộc PASS/FAIL phải kèm `oracle_ref`, nhưng máy cũ chỉ kiểm HÌNH DẠNG chuỗi. Viết
 * `BR-99` khi tài liệu không có mục đó vẫn qua cửa. Đây là cách sinh ra một kết luận nghe rất có căn
 * cứ mà không neo vào đâu cả.
 *
 * Hai test quan trọng nhất ở đây là ĐỐI CHỨNG ÂM và CHỐNG BÁO OAN. Một máy chỉ biết nói "đạt" thì vô
 * dụng; một máy kêu vào chỗ viết đúng thì sẽ bị tắt.
 */

const REPO = path.resolve(__dirname, '../../..');
const GATE = path.join(REPO, 'scripts/phase1/docs_index.js');

function run(dir: string, extra: string[]) {
  try {
    return {
      code: 0,
      out: execFileSync('node', [GATE, '--dir', dir, ...extra], {
        cwd: REPO, encoding: 'utf8', env: gateEnv(), stdio: ['ignore', 'pipe', 'pipe'],
      }),
    };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status, out: `${err.stdout || ''}${err.stderr || ''}` };
  }
}

/** Hai trang US, CÙNG mã `BR-07` nhưng luật khác hẳn — đúng hình dạng gặp thật trên SAPP-26878. */
function docsFixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-index-'));
  const pad = 'Nội dung đủ dài để không bị coi là rỗng. '.repeat(12);
  fs.writeFileSync(path.join(dir, 'us01.md'), `# US-01: Tạo Business Partner

## Page ID: 900001
## Version: v3 (2026-08-17)

| BR | Rule | AC |
| --- | --- | --- |
| BR-01 | Mã khách hàng ghép từ số định danh | AC-1.1 |
| BR-07 | Thất bại thì gửi email cho kế toán | AC-1.5 |

${pad}
`, 'utf8');
  fs.writeFileSync(path.join(dir, 'us13.md'), `# US-13: Chuyển nhượng

## Page ID: 900013
## Version: v2 (2026-09-03)

| BR | Rule | AC |
| --- | --- | --- |
| BR-07 | Rollback bằng cách hủy chứng từ đã tạo | AC-13.7 |

${pad}
`, 'utf8');
  return dir;
}

function cites(dir: string, body: string): string {
  const f = path.join(dir, `tc-${Math.random().toString(36).slice(2)}.md`);
  fs.writeFileSync(f, body, 'utf8');
  return f;
}

test('lập chỉ mục và trích dẫn ra đúng file kèm số dòng', () => {
  const r = run(docsFixture(), ['--cite', 'BR-01']);
  expect(r.code).toBe(0);
  expect(r.out).toMatch(/us01\.md:8/);
  expect(r.out).toContain('Mã khách hàng ghép từ số định danh');
});

/* ĐỐI CHỨNG ÂM: neo bịa phải bị gọi tên, không được im lặng cho qua. */
test('neo tài liệu KHÔNG có thì nói thẳng là không tra được', () => {
  const r = run(docsFixture(), ['--cite', 'BR-99']);
  expect(r.code).toBe(1);
  expect(r.out).toContain('KHÔNG TRA ĐƯỢC');
});

test('--verify bắt đúng neo bịa và bỏ qua neo thật', () => {
  const dir = docsFixture();
  const f = cites(dir, 'Case kiểm US-01 BR-07 và AC-1.1, cộng thêm BR-99 với AC-9.9.\n');
  const r = run(dir, ['--verify', f]);
  expect(r.out).toContain('BR-99');
  expect(r.out).toContain('AC-9.9');
  expect(r.out).not.toMatch(/^\s+AC-1\.1\s/m);
});

test('--enforce mới exit 1; mặc định là báo cáo nên exit 0', () => {
  const dir = docsFixture();
  const f = cites(dir, 'Neo bịa BR-99.\n');
  expect(run(dir, ['--verify', f]).code).toBe(0);
  expect(run(dir, ['--verify', f, '--enforce']).code).toBe(1);
});

/*
 * `BR-07` ở US-01 nói về email khi lỗi, ở US-13 nói về rollback. Trích trần mã đó chưa chỉ ra luật
 * nào, nên máy phải nói ra. Trên task thật có 8 neo như vậy, trong đó `NFR-02` một bên là kỳ khoá sổ,
 * bên kia là chênh lệch deferred revenue.
 */
test('cùng mã mà luật khác nhau giữa hai trang thì báo MƠ HỒ', () => {
  const r = run(docsFixture(), ['--cite', 'BR-07']);
  expect(r.out).toContain('MƠ HỒ');
  expect(r.out).toContain('2 trang');
});

test('thu hẹp bằng --in thì hết mơ hồ và ra đúng một trang', () => {
  const r = run(docsFixture(), ['--cite', 'BR-07', '--in', '900013']);
  expect(r.out).toContain('Rollback bằng cách hủy chứng từ');
  expect(r.out).not.toContain('gửi email cho kế toán');
  expect(r.out).not.toContain('MƠ HỒ');
});

/*
 * CHỐNG BÁO OAN. Bản đầu đòi `US-xx` nằm sát ngay trước neo, đếm ra 76 chỗ "không phạm vi" mà đọc lại
 * thì phần lớn viết đúng. Luật đúng là có `US-xx` đứng trước TRÊN CÙNG DÒNG.
 */
test('neo đã có US-xx trước nó trên cùng dòng thì không bị kêu mơ hồ', () => {
  const dir = docsFixture();
  const f = cites(dir, '| TC_001 | Tạo BP / US-01 Business Partner | kiểm theo BR-07 |\n');
  const r = run(dir, ['--verify', f]);
  expect(r.out).not.toContain('MƠ HỒ');
});

test('cùng mã nhưng CÙNG nội dung ở hai trang thì không phải mơ hồ', () => {
  const dir = docsFixture();
  const same = '| NFR-01 | Ghi thẳng không qua bước duyệt | Mọi US |';
  for (const [f, id] of [['a.md', '900021'], ['b.md', '900022']]) {
    fs.writeFileSync(path.join(dir, f), `# T\n\n## Page ID: ${id}\n## Version: v1 (2026-01-01)\n\n`
      + `| ID | Rule | Áp dụng |\n| --- | --- | --- |\n${same}\n\n${'chữ '.repeat(120)}\n`, 'utf8');
  }
  const r = run(dir, ['--cite', 'NFR-01']);
  expect(r.out).not.toContain('MƠ HỒ');
});

/*
 * Trích dẫn cần SỐ DÒNG. File do bộ đổi cũ sinh ra dồn cả trang vào một dòng, trỏ vào "dòng 1" của
 * một trang 8 KB thì không phải trích dẫn. Trang nào có bản tốt hơn thì phải lấy bản đó.
 */
test('mỗi trang chỉ lấy MỘT bản, và là bản giữ được bảng', () => {
  const dir = docsFixture();
  fs.writeFileSync(path.join(dir, 'us01-ban-cu.md'),
    `# US-01 bản cũ\n\n## Page ID: 900001\n\nBR-01 Mã khách hàng BR-07 Thất bại ${'chữ '.repeat(200)}\n`, 'utf8');
  const r = run(dir, ['--cite', 'BR-01']);
  expect(r.out).toContain('us01.md:8');
  expect(r.out).not.toContain('us01-ban-cu.md');
});
