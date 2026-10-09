import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * @infra — RUBRIC 8 TIÊU CHÍ (`tc:review`).
 *
 * Rủi ro lớn nhất của một máy chấm điểm không phải là nó chấm sai, mà là nó **chấm cái gì cũng đạt**. Lúc đó
 * nó không còn là máy chấm, nó là máy phát chứng chỉ — và mọi người tin vào con số nó in ra.
 *
 * Nên trọng tâm file này là ĐỐI CHỨNG ÂM: với mỗi tiêu chí máy nhận là "đo đủ", bơm vào đúng một lỗi của
 * tiêu chí đó rồi đòi điểm phải tụt. Thiếu phần này thì "96,3%" chỉ là một con số đẹp không ai kiểm được.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const SCRIPT = path.join(REPO, 'scripts/qa/tc_review.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const CFG = require(path.join(REPO, '.agent/config/tc_review.json'));

const HEAD = [
  '| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |',
  '|---|---|---|---|---|---|---|---|---|---|',
].join('\n');

/** Một dòng ĐẠT mọi tiêu chí máy đo được — các test dưới chỉ làm hỏng đúng một ô. */
const OK: Record<string, string> = {
  id: 'M_TC_001',
  loai: 'Functional',
  tag: '[Positive][Validation][BR-X-001]',
  module: 'Hồ sơ',
  title: 'Lưu hồ sơ khi điền đủ ô bắt buộc',
  tien: '[api] Đã đăng nhập vai Trường, có 1 hồ sơ nháp',
  data: 'Mã lớp = 6A1',
  buoc: '1. Mở màn Hồ sơ<br>2. Bấm Ghi',
  expected: '1. Màn hiện form<br>2. Hiện thông báo "Lưu thành công" và lưới có dòng 6A1',
  uu: 'High',
};

/** Dựng task tạm có bộ testcase rồi chạy `tc_review.js` đúng như pipeline chạy. */
function chay(rows: Record<string, string>[], args: string[] = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tcrev-'));
  const taskDir = path.join(root, 'tasks', 'T-1');
  fs.mkdirSync(path.join(taskDir, 'test-cases'), { recursive: true });
  const body = rows.map((r) => `| ${[r.id, r.loai, r.tag, r.module, r.title, r.tien, r.data, r.buoc, r.expected, r.uu].join(' | ')} |`).join('\n');
  fs.writeFileSync(path.join(taskDir, 'test-cases', 'bo.md'), `# bộ\n\n${HEAD}\n${body}\n`, 'utf8');
  try {
    const r = spawnSync(process.execPath, [SCRIPT, ...args], {
      cwd: REPO,
      encoding: 'utf8',
      env: { ...gateEnv(), PROJECT_OUTPUT_DIR: root, TASK_KEY: 'T-1' } as NodeJS.ProcessEnv,
    });
    const report = path.join(taskDir, 'reports', 'tc-review.md');
    return {
      code: r.status,
      out: `${r.stdout || ''}${r.stderr || ''}`,
      report: fs.existsSync(report) ? fs.readFileSync(report, 'utf8') : '',
    };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

/** Điểm của một TC đọc từ report, dạng `| M_TC_001 | 12/14 | …`. */
const diemCua = (report: string, id: string): string => {
  const line = report.split(/\r?\n/).find((l) => l.startsWith(`| ${id} `));
  return line ? (line.split('|')[2] || '').trim() : '';
};

test.describe('@infra tc:review — rubric 8 tiêu chí, và nó phải BIẾT TRƯỢT', () => {
  test('case đạt mọi tiêu chí máy đo được ⇒ điểm tối đa', () => {
    const r = chay([OK]);
    expect(r.code, 'không --enforce thì không chặn').toBe(0);
    expect(diemCua(r.report, 'M_TC_001'), 'bộ chưa dùng tag kỹ thuật ⇒ mẫu số 14, không phải 16').toBe('14/14');
  });

  test('ĐỐI CHỨNG ÂM ①: bước gộp range ⇒ tiêu chí 1 về 0', () => {
    const r = chay([{ ...OK, buoc: '1-2. Mở màn rồi bấm Ghi' }]);
    expect(diemCua(r.report, 'M_TC_001')).toBe('12/14');
    expect(r.report).toContain('1-ro-rang');
  });

  test('ĐỐI CHỨNG ÂM ②: Expected chung chung ⇒ tiêu chí 2 về 0', () => {
    const r = chay([{ ...OK, expected: '1. Thành công<br>2. Hiển thị đúng' }]);
    expect(diemCua(r.report, 'M_TC_001')).toBe('12/14');
    expect(r.report).toContain('2-expected-do-duoc');
  });

  test('ĐỐI CHỨNG ÂM ③: Tiền điều kiện thiếu tag cách dựng ⇒ tiêu chí 3 tụt', () => {
    const r = chay([{ ...OK, tien: 'Đã đăng nhập vai Trường' }]);
    expect(diemCua(r.report, 'M_TC_001')).toBe('13/14');
    expect(r.report).toContain('3-doc-lap');
  });

  test('ĐỐI CHỨNG ÂM ③b: phụ thuộc case khác chạy trước ⇒ tiêu chí 3 về 0', () => {
    const r = chay([{ ...OK, tien: '[api] Sau khi chạy TC M_TC_000' }]);
    expect(r.report).toContain('phụ thuộc case khác');
  });

  test('ĐỐI CHỨNG ÂM ④: data còn placeholder ⇒ tiêu chí 4 về 0', () => {
    const r = chay([{ ...OK, data: 'Mã lớp = <điền sau>' }]);
    expect(diemCua(r.report, 'M_TC_001')).toBe('12/14');
    expect(r.report).toContain('4-data-cu-the');
  });

  test('ĐỐI CHỨNG ÂM ⑤: không có oracle-ref ⇒ tiêu chí 5 về 0', () => {
    const r = chay([{ ...OK, tag: '[Positive][Validation]' }]);
    expect(diemCua(r.report, 'M_TC_001')).toBe('12/14');
    expect(r.report).toContain('5-truy-vet');
  });

  test('ĐỐI CHỨNG ÂM ⑦: actor chung chung ⇒ tiêu chí 7 về 0', () => {
    const r = chay([{ ...OK, tien: '[api] Người dùng đã đăng nhập' }]);
    expect(diemCua(r.report, 'M_TC_001')).toBe('12/14');
    expect(r.report).toContain('7-actor-context');
  });

  test('HAI TẦNG: bộ chưa dùng tag kỹ thuật ⇒ tiêu chí 8 là n/a, KHÔNG phải 0 điểm', () => {
    /*
     * Cho 0 điểm là phạt bộ cũ vì một luật ra đời sau nó. Mẫu số phải co lại từ 16 xuống 14, không thì mọi
     * bộ cũ tự động mất 2 điểm và gate này bị tắt trong một ngày.
     */
    const r = chay([OK]);
    expect(r.out).toContain('n/a');
    expect(diemCua(r.report, 'M_TC_001')).toBe('14/14');
  });

  test('HAI TẦNG: bộ ĐÃ dùng tag kỹ thuật ⇒ mẫu số thành 16, case thiếu tag mất điểm', () => {
    const r = chay([
      { ...OK, id: 'M_TC_001', tag: '[Positive][Validation][BVA][BR-X-001]' },
      { ...OK, id: 'M_TC_002' },
    ]);
    expect(diemCua(r.report, 'M_TC_001'), 'case có tag kỹ thuật').toBe('16/16');
    expect(diemCua(r.report, 'M_TC_002'), 'case thiếu tag trong bộ đã dùng').toBe('14/16');
  });

  test('TC TRÙNG (cùng bước + cùng dữ liệu) được nêu ra để cân nhắc gộp', () => {
    const r = chay([{ ...OK, id: 'M_TC_001' }, { ...OK, id: 'M_TC_002' }]);
    expect(r.out).toContain('TRÙNG');
    expect(r.report).toContain('M_TC_001 ≡ M_TC_002');
  });

  test('--enforce CHẶN khi có case dưới ngưỡng, và im khi không có', () => {
    const te = { ...OK, buoc: '1-2. gộp', expected: 'Thành công', tien: 'x', data: '<TBD>', tag: '[Positive]' };
    const xau = chay([te], ['--enforce']);
    expect(xau.code, 'case hỏng mọi tiêu chí phải CHẶN').toBe(1);

    const tot = chay([OK], ['--enforce']);
    expect(tot.code, 'bộ đạt thì không được chặn oan').toBe(0);
  });

  test('ngưỡng đọc từ config, KHÔNG hardcode trong script', () => {
    const src = fs.readFileSync(SCRIPT, 'utf8');
    expect(src, 'script phải đọc .agent/config/tc_review.json').toContain('tc_review.json');
    expect(CFG.nguong.can_sua).toBeGreaterThan(0);
    expect(CFG.nguong.tot).toBeGreaterThan(CFG.nguong.can_sua);
  });

  test('tiêu chí máy chỉ đo MỘT PHẦN phải được khai rõ ở config', () => {
    /*
     * Khai ở đây mới có tác dụng: người đọc report biết chỗ nào còn cần mắt người. Không khai thì con số
     * tổng trông như đã kiểm hết, và đó đúng là cách một máy chấm thành máy phát chứng chỉ.
     */
    const motPhan = Object.entries(CFG._tieu_chi)
      .filter(([k]) => !k.startsWith('_'))
      .filter(([, v]) => (v as { may_do_duoc: string }).may_do_duoc === 'mot_phan')
      .map(([k]) => k);
    expect(motPhan, 'tiêu chí 6 và 7 là hai chỗ máy không phán hết được').toEqual(
      ['6-dung-trong-tam', '7-actor-context'],
    );
  });
});
