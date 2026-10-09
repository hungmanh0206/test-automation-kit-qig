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

/** Hai trang US, CÙNG mã `BR-07` nhưng luật khác hẳn — đúng hình dạng gặp thật trên CSDL-26878. */
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
 * BA trạng thái. Luật của kit: "không phán được" KHÔNG thành PASS. Im lặng exit 0 khi
 * chưa đủ dữ kiện là phát ra tín hiệu "đã kiểm và sạch" trong khi thật ra chưa kiểm được.
 */
test('không có tài liệu lành thì là KHÔNG PHÁN ĐƯỢC, không phải đạt', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-index-trong-'));
  const f = cites(dir, 'Case kiểm BR-01.\n');
  const r = run(dir, ['--verify', f, '--enforce']);
  expect(r.out).toContain('KHÔNG PHÁN ĐƯỢC');
  expect(r.code).toBe(2);
});

test('testcase không nhắc neo nào cũng là KHÔNG PHÁN ĐƯỢC', () => {
  const dir = docsFixture();
  const f = cites(dir, 'Case này không trích neo nào cả.\n');
  const r = run(dir, ['--verify', f, '--enforce']);
  expect(r.out).toContain('KHÔNG PHÁN ĐƯỢC');
  expect(r.code).toBe(2);
});

/*
 * Ngưỡng entity theo TỈ LỆ, không theo số đếm. Bản đầu dùng `entity > 0` và đã vứt hai file spec
 * chính của một task vì đúng 1 và 3 entity, rồi quay sang kết tội testcase trích luật không tồn tại.
 */
test('một entity lẻ trong file lớn KHÔNG loại file đó khỏi chỉ mục', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-index-ent-'));
  fs.writeFileSync(path.join(dir, 'to.md'), `# Spec lớn

## Page ID: 910001
## Version: v1 (2026-01-01)

| BR | Rule | AC |
| --- | --- | --- |
| BR-42 | Một quy tắc quan trọng, có m&ocirc;̣t entity sót | AC-4.2 |

${'Chữ nghiệp vụ dài dòng để file đủ lớn. '.repeat(120)}
`, 'utf8');
  const r = run(dir, ['--cite', 'BR-42']);
  expect(r.code).toBe(0);
  expect(r.out).toContain('to.md:8');
});

/*
 * Tài liệu KHÔNG mang page id vẫn phải vào chỉ mục. Trích dẫn chỉ cần file kèm số dòng. Đo thật:
 * một task có 108 KB spec lành nhưng tên file không chứa id, và cả hai máy coi như task không có
 * tài liệu nào.
 */
test('tài liệu không có page id vẫn trích dẫn được', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-index-noid-'));
  fs.writeFileSync(path.join(dir, 'spec_bao-luu.md'), `# Spec không có id

| BR | Rule |
| --- | --- |
| BR-77 | Quy tắc nằm trong file không có page id |

${'Chữ nghiệp vụ. '.repeat(60)}
`, 'utf8');
  const r = run(dir, ['--cite', 'BR-77']);
  expect(r.code).toBe(0);
  expect(r.out).toContain('spec_bao-luu.md:5');
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

/*
 * Tiền tố `NT-PH` và `LH` của tài liệu nghiệp vụ CSDL (vault QEMIS, tab `Lớp`): business rule đánh
 * `NT-PH-01`, mã chức năng đánh `LH-01.1`. Trước 25/09/2026 `ANCHOR_RE` không nhận hai tiền tố này —
 * đo thật trên CSDL-9002: cả bộ spec ra `0 neo`, nghĩa là mọi `oracle_ref` của task đó không tra ngược
 * được, và theo RULE_GLOBAL §3 thì không chấm PASS/FAIL được, chỉ còn OBSERVATION. Hai test dưới giữ
 * chỗ đó khỏi bị thu lại lặng lẽ khi có người dọn regex.
 */
function docsCsdlFixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-index-csdl-'));
  fs.writeFileSync(path.join(dir, 'ho-so-lop.md'), `# Hồ sơ lớp

| Mã CN | Tên chức năng | Màn hình |
| --- | --- | --- |
| LH-01.1 | Xem danh sách lớp học | Hồ sơ lớp học |
| LH-01.7 | Sao chép lớp môn | Xếp môn học cho lớp |

| # | Business rule | Cấp áp dụng |
| --- | --- | --- |
| NT-PH-01 | Một lớp học thuộc đúng một phân hiệu | MN / TH / THCS |
| NT-PH-06 | Tên lớp duy nhất trong phạm vi một phân hiệu và một năm học | MN / TH / THCS |

${'Chữ nghiệp vụ dài dòng để file đủ lớn. '.repeat(60)}
`, 'utf8');
  return dir;
}

test('nhận tiền tố NT-PH và LH của tài liệu CSDL, ra đúng file kèm số dòng', () => {
  const dir = docsCsdlFixture();

  const rule = run(dir, ['--cite', 'NT-PH-06']);
  expect(rule.code).toBe(0);
  expect(rule.out).toMatch(/ho-so-lop\.md:11/);
  expect(rule.out).toContain('Tên lớp duy nhất trong phạm vi một phân hiệu');

  /* Mã chức năng có phần thập phân: `LH-01.1` phải ăn trọn `01.1`, không cắt thành `LH-01`. */
  const cn = run(dir, ['--cite', 'LH-01.1']);
  expect(cn.code).toBe(0);
  expect(cn.out).toMatch(/ho-so-lop\.md:5/);
  expect(cn.out).toContain('Xem danh sách lớp học');
});

/*
 * ĐỐI CHỨNG ÂM cho chính lần nới này. Thêm tiền tố vào nhóm chọn là nới cửa, nên phải chứng minh cửa
 * cũ vẫn đóng: `BR-SAPSYNC-003` là id knowledge của kit (`knowledge/domain/`, do `domain_rules.js`
 * gác), KHÔNG phải neo tài liệu. Nó lọt vào chỉ mục thì hai hệ mã bị trộn.
 */
test('nới tiền tố nhưng BR-SAPSYNC-003 vẫn KHÔNG thành neo tài liệu', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-index-knowledge-'));
  fs.writeFileSync(path.join(dir, 'spec.md'), `# Spec

| BR | Rule |
| --- | --- |
| BR-01 | Luật thật của trang này |

Đoạn này nhắc tới luật domain BR-SAPSYNC-003 của kit, không phải neo của trang.

${'Chữ nghiệp vụ. '.repeat(80)}
`, 'utf8');

  expect(run(dir, ['--cite', 'BR-01']).code).toBe(0);
  const r = run(dir, ['--cite', 'BR-003']);
  expect(r.code).toBe(1);
  expect(r.out).toContain('KHÔNG TRA ĐƯỢC');
});

/*
 * Tiền tố `NS-BR` và `NS` của note `CSDL - Hồ sơ đội ngũ.md` (vault QEMIS, tab `Đội ngũ`): mã chức năng
 * đánh `NS-01.1`, business rule đánh `NS-BR-01`. Trước 25/09/2026 `ANCHOR_RE` không nhận hai tiền tố này
 * — đo thật trên CSDL-9004: `2 neo · 0 có dòng định nghĩa`, và 2 neo ấy là `BR-192`/`BR-217`, tham chiếu
 * tới một tài liệu BR khác chưa import, không định nghĩa ở đâu trong vault. Tức task chỉ có neo GIẢ.
 *
 * Note đó cố ý KHÔNG dùng `BR-` trần như hai note Hồ sơ trường / Hồ sơ học sinh, vì chính nó đã mang sẵn
 * `BR-192`/`BR-217`. Test dưới giữ đúng lựa chọn đó: `NS-BR-01` phải ra `NS-BR-01`, KHÔNG được rơi thành
 * `BR-01` — mà `BR-01` lại là mã có thật của hai note kia.
 */
function docsDoiNguFixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-index-doingu-'));
  fs.writeFileSync(path.join(dir, 'ho-so-doi-ngu.md'), `# Hồ sơ đội ngũ

| Mã CN | Tên chức năng |
| --- | --- |
| NS-01.3 | Thêm mới hồ sơ đội ngũ |
| NS-01.10 | Quản lý giáo viên theo tổ |

| # | Business rule |
| --- | --- |
| NS-BR-01 | Bộ KEY chống trùng nhân sự gồm bốn thành phần |
| NS-BR-13 | Cán bộ quản lý có tích Tham gia giảng dạy thì Môn dạy bắt buộc |

Trường Số CMND/CCCD nhắc (BR-217) và (BR-192) — mã của tài liệu khác, không định nghĩa ở đây.

${'Chữ nghiệp vụ dài dòng để file đủ lớn. '.repeat(60)}
`, 'utf8');
  return dir;
}

test('nhận tiền tố NS-BR và NS của note đội ngũ, ra đúng file kèm số dòng', () => {
  const dir = docsDoiNguFixture();

  const rule = run(dir, ['--cite', 'NS-BR-13']);
  expect(rule.code).toBe(0);
  expect(rule.out).toMatch(/ho-so-doi-ngu\.md:11/);
  expect(rule.out).toContain('Môn dạy bắt buộc');

  /* Mã chức năng hai chữ số sau dấu chấm: `NS-01.10` phải ăn trọn `01.10`, không cắt thành `NS-01.1`. */
  const cn = run(dir, ['--cite', 'NS-01.10']);
  expect(cn.code).toBe(0);
  expect(cn.out).toMatch(/ho-so-doi-ngu\.md:6/);
  expect(cn.out).toContain('Quản lý giáo viên theo tổ');
});

/*
 * ĐỐI CHỨNG ÂM cho lần nới này — hai cửa phải cùng đóng.
 *
 * 1. `NS-BR-01` KHÔNG được khớp thành `BR-01`. Dấu `-` là ký tự không-từ nên `\b` vẫn đúng ngay trước
 *    chữ `B`; nếu `NS-BR` đứng SAU `BR` trong nhóm chọn thì neo của đội ngũ rơi vào namespace `BR-` của
 *    Hồ sơ trường và Hồ sơ học sinh, và report sẽ trích dẫn sai chức năng mà máy không kêu.
 * 2. `BR-192`/`BR-217` vẫn phải trích ra được (chúng CÓ trong trang) nhưng KHÔNG có dòng định nghĩa —
 *    đây là neo mồ côi mà `--cite` vẫn in ra dòng tham chiếu. Giữ hành vi này hiện hình trong test để
 *    không ai tưởng nhầm là đã xử lý xong.
 */
test('NS-BR-01 không rơi thành BR-01, và BR-192 vẫn là neo mồ côi', () => {
  const dir = docsDoiNguFixture();

  const roi = run(dir, ['--cite', 'BR-01']);
  expect(roi.code).toBe(1);
  expect(roi.out).toContain('KHÔNG TRA ĐƯỢC');

  const mocoi = run(dir, ['--cite', 'BR-192']);
  expect(mocoi.code).toBe(0);
  expect(mocoi.out).toContain('mã của tài liệu khác');
  expect(mocoi.out).not.toMatch(/\| BR-192 \|/);
});
