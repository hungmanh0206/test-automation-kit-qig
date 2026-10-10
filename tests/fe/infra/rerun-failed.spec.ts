import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * @infra — CHẠY LẠI ĐÚNG CASE ĐỎ (phần có máy của H4).
 *
 * SỐ ĐO LÀ LÝ DO DUY NHẤT máy này tồn tại. Trong 4 lượt chạy task thật, `npx playwright test` được gọi
 * **2.076 lần**:
 *
 *     chạy cả file hoặc cả suite : 2.070
 *     có --grep                  :     6
 *     có --last-failed           :     0
 *
 * Rerun chọn lọc được dùng **0,3%**. `04_execute_fe_playwright.md` ĐÃ dặn "rerun đúng case đỏ" từ trước.
 * Số đo nói lời dặn đó không xảy ra — và đó chính là định nghĩa của một luật thiếu máy.
 *
 * HAI CHỖ TỪ CHỐI được khoá ở đây, và cả hai quan trọng hơn phần tiết kiệm:
 *   ① 0 case đỏ ⇒ KHÔNG chạy gì. Chạy lại cả suite "cho chắc" là đúng thứ máy này đi bỏ.
 *   ② Có case đỏ KHÔNG mang TC ID ⇒ TỪ CHỐI dựng grep một phần. Grep thiếu thì agent chạy, thấy xanh,
 *      rồi kết luận đã xử lý hết — trong khi một case đỏ chưa từng được chạy lại. Đây là cùng một lớp
 *      lỗi với `results:summary`, nhưng ở đây nó tệ hơn: `results:summary` chỉ in, còn máy này CHẠY.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const RERUN = path.join(REPO, 'scripts/qa/rerun_failed.js');

type Ca = { title: string; ok: boolean };

function dungJson(cas: Ca[]) {
  const spec = (c: Ca) => ({
    title: c.title,
    file: 'tests/fe/x.spec.ts',
    line: 9,
    tests: [{
      status: c.ok ? 'expected' : 'unexpected',
      results: [{ status: c.ok ? 'passed' : 'failed', errors: [], attachments: [] }],
    }],
  });
  return JSON.stringify({ stats: {}, suites: [{ specs: cas.map(spec) }] });
}

function chay(cas: Ca[], args: string[] = []) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-'));
  const f = path.join(d, 'results.json');
  fs.writeFileSync(f, dungJson(cas), 'utf8');
  try {
    const r = spawnSync(process.execPath, [RERUN, '--file', f, ...args], {
      cwd: REPO, encoding: 'utf8', env: gateEnv() as NodeJS.ProcessEnv,
    });
    return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
}

test.describe('@infra rerun:failed — chạy lại đúng case đỏ, hoặc không chạy gì', () => {
  test('dựng `--grep` đúng tập case đỏ, không lẫn case xanh', () => {
    const r = chay([
      { title: 'A_TC_001 thêm học sinh', ok: false },
      { title: 'A_TC_002 sửa học sinh', ok: true },
      { title: 'A_TC_003 xoá học sinh', ok: false },
    ], ['--dry']);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/--grep A_TC_001\|A_TC_003/);
    expect(r.out, 'case xanh KHÔNG được lọt vào grep').not.toContain('A_TC_002');
  });

  test('① 0 case đỏ: KHÔNG chạy gì, và nói rõ vì sao', () => {
    const r = chay([{ title: 'A_TC_001 ok', ok: true }]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/0 case đỏ ⇒ KHÔNG chạy lại gì cả/);
    expect(r.out, 'phải nêu số đo làm căn cứ, không chỉ phán').toMatch(/2\.070\/2\.076/);
  });

  test('② case đỏ KHÔNG có TC ID: TỪ CHỐI dựng grep một phần', () => {
    /*
     * Phép kiểm quan trọng nhất. Nếu máy này dựng grep thiếu thì nó CHẠY một tập con, trả về xanh, và
     * người đọc kết luận đã xử lý hết. Thà từ chối còn hơn chạy đúng một nửa rồi báo xanh.
     */
    const r = chay([
      { title: 'A_TC_001 có mã', ok: false },
      { title: 'case nay khong co ma', ok: false },
    ]);
    expect(r.code, 'từ chối phải là lỗi dùng sai, không phải đi tiếp').toBe(2);
    expect(r.out).toMatch(/TỪ CHỐI dựng --grep/);
    expect(r.out).toContain('case nay khong co ma');
    expect(r.out, 'phải chỉ đường ra').toMatch(/theo FILE|TC ID vào tiêu đề/);
  });

  test('case SKIP không bị tính là đỏ', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-'));
    const f = path.join(d, 'results.json');
    fs.writeFileSync(f, JSON.stringify({
      suites: [{ specs: [{ title: 'A_TC_001 bỏ qua', file: 'x.ts', line: 1,
        tests: [{ status: 'skipped', results: [{ status: 'skipped' }] }] }] }],
    }), 'utf8');
    try {
      const r = spawnSync(process.execPath, [RERUN, '--file', f], {
        cwd: REPO, encoding: 'utf8', env: gateEnv() as NodeJS.ProcessEnv,
      });
      expect(`${r.stdout}${r.stderr}`).toMatch(/0 case đỏ/);
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('thiếu results.json: báo rõ, exit 2, KHÔNG chạy bừa cả suite', () => {
    const r = spawnSync(process.execPath, [RERUN, '--file', '/khong/co/that.json'], {
      cwd: REPO, encoding: 'utf8', env: gateEnv() as NodeJS.ProcessEnv,
    });
    expect(r.status).toBe(2);
    expect(`${r.stdout}${r.stderr}`).toMatch(/không thấy results\.json/);
  });

  test('prompt execute phải trỏ tới lệnh này, không chỉ dặn suông', () => {
    /*
     * Lời dặn "rerun đúng case đỏ" đã có từ trước và số đo cho thấy nó không xảy ra (0,3%). Một lời dặn
     * không kèm LỆNH LÀM SẴN thì người đọc vẫn phải tự lắp, và họ sẽ chạy lại cả suite cho nhanh.
     */
    const p = fs.readFileSync(path.join(REPO, 'prompt_templates/phase2/04_execute_fe_playwright.md'), 'utf8');
    expect(p, 'prompt chưa trỏ tới npm run rerun:failed').toContain('rerun:failed');
  });
});
