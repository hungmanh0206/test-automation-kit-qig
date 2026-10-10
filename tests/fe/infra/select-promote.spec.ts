import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * @infra — CHỌN BỘ REGRESSION (v2.5.0 G3.4): ứng viên promote, và register phantom.
 *
 * PHÉP ĐO ĐỔI HẲN HAI TRONG BỐN PHẦN CỦA HẠNG MỤC. Kế hoạch đòi bốn thứ; đo nguồn dữ liệu trước khi viết:
 *   · theo risk band          → CÓ nguồn (15 file `risk-register.json`) nhưng nguồn ĐANG SAI, xem dưới;
 *   · theo lịch sử bug        → `knowledge/bugs` có **0 file**. `historical_execution` (18 file) có
 *                               failRate theo module, và `risk_score` đã dùng nó — không viết lại;
 *   · gộp case trùng giữa task → đo 391 tiêu đề riêng biệt, **0 tiêu đề xuất hiện ở ≥2 task** ⇒ KHÔNG có
 *                               gì để gộp. Viết bộ gộp cho 0 ca là code không ai chạy;
 *   · đề nghị promote case ổn định → `tc-history` có **8.436 bản ghi**, và `reliability_index` đã tính
 *                               TRI/rank/quarantine ⇒ chỉ cần một GÓC NHÌN, không cần script mới.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const RI = path.join(REPO, 'scripts/qa/reliability_index.js');
const ST = path.join(REPO, 'scripts/qa/select_tests.js');

/** tc-history tạm: `file` quyết định case đó đã ở suite dùng chung hay chưa. */
function history(rows: { key: string; file: string; n: number; status?: string }[]) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'promote-'));
  const L: string[] = [];
  rows.forEach((r) => {
    for (let i = 0; i < r.n; i += 1) {
      L.push(JSON.stringify({ at: `2026-10-0${(i % 9) + 1}T00:00:00Z`, key: r.key, file: r.file, title: r.key, status: r.status || 'passed', flaky: false }));
    }
  });
  fs.writeFileSync(path.join(d, 'tc.jsonl'), `${L.join('\n')}\n`, 'utf8');
  return d;
}

function chayRi(d: string, argv: string[]) {
  const r = spawnSync(process.execPath, [RI, '--in', path.join(d, 'tc.jsonl'), '--out', d, ...argv], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

test.describe('@infra reliability --promote — chỉ đề xuất thứ CHƯA ở suite dùng chung', () => {
  test('LOẠI test đã nằm trong `tests/**` — promote chúng là vô nghĩa', () => {
    /*
     * Bản đầu không lọc và in "669 ứng viên", nghe rất nhiều. Đo lại: **611/669 là `tests/fe/infra`** và
     * 58 là `tests/` khác ⇒ **0 ứng viên là automation theo task**, đúng thứ hạng mục muốn promote. Một
     * con số lớn mà SAI ĐỐI TƯỢNG thì tệ hơn con số 0: nó làm người đọc tin là có 669 việc để làm.
     */
    const d = history([
      { key: 'infra-1', file: 'tests/fe/infra/a.spec.ts', n: 5 },
      { key: 'task-1', file: 'outputs/P/tasks/T/automation/b.spec.ts', n: 5 },
    ]);
    const r = chayRi(d, ['--promote', '--top', '10']);
    expect(r.out).toMatch(/ỨNG VIÊN PROMOTE: 1 case/);
    expect(r.out, 'phải nói đã loại bao nhiêu và vì sao').toMatch(/Đã loại 1 test vốn đã nằm trong suite dùng chung/);
    expect(r.out, 'chỉ case của task được đề xuất').toContain('task-1');
    expect(r.out).not.toContain('infra-1');
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('0 ứng viên ⇒ nói rõ KHÔNG phải lỗi và KHÔNG phải "không có gì để promote"', () => {
    const d = history([{ key: 'infra-1', file: 'tests/fe/infra/a.spec.ts', n: 5 }]);
    const r = chayRi(d, ['--promote']);
    expect(r.out).toMatch(/ỨNG VIÊN PROMOTE: 0 case/);
    expect(r.out).toMatch(/KHÔNG phải lỗi/);
    expect(r.out, 'phải giải thích vì sao tc-history thiếu spec theo task').toMatch(/chưa chạy đủ lượt/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ĐỀ XUẤT, không tự làm — và nói rõ TRI không đo chất lượng oracle', () => {
    /*
     * Một case xanh 3 lượt vẫn có thể xanh vì assertion yếu. Không nói ra thì "ứng viên promote" sẽ được
     * đọc như "đã đủ tốt", và một case oracle yếu lọt vào bộ dùng chung là nhân bản false-green.
     */
    const d = history([{ key: 'task-1', file: 'outputs/P/tasks/T/b.spec.ts', n: 5 }]);
    const r = chayRi(d, ['--promote', '--top', '5']);
    expect(r.out).toMatch(/cần NGƯỜI duyệt/);
    expect(r.out).toMatch(/KHÔNG đo chất lượng oracle/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('`--top` bắt buộc mới in danh sách — không xả cả trăm dòng', () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ key: `t${i}`, file: `outputs/P/tasks/T/s${i}.spec.ts`, n: 4 }));
    const d = history(rows);
    const r0 = chayRi(d, ['--promote']);
    expect(r0.out).toMatch(/Thêm `--top <n>` để xem danh sách/);
    expect(r0.out, 'không in dòng case nào khi chưa có --top').not.toMatch(/lượt · TRI/);
    const r1 = chayRi(d, ['--promote', '--top', '3']);
    expect((r1.out.match(/lượt · TRI/g) || []).length, 'in đúng 3 dòng').toBe(3);
    expect(r1.out).toMatch(/\+9/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('case FAIL hoặc flaky KHÔNG được đề xuất', () => {
    const d = history([
      { key: 'do-1', file: 'outputs/P/tasks/T/x.spec.ts', n: 4, status: 'failed' },
    ]);
    const r = chayRi(d, ['--promote', '--top', '5']);
    expect(r.out).toMatch(/ỨNG VIÊN PROMOTE: 0 case/);
    fs.rmSync(d, { recursive: true, force: true });
  });
});

test.describe('@infra select_tests — register phantom thì nói ra', () => {
  function chaySt(reg: unknown | null, argv: string[]) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'selreg-'));
    fs.mkdirSync(path.join(d, 'tasks/T1/reports'), { recursive: true });
    if (reg) fs.writeFileSync(path.join(d, 'tasks/T1/reports/risk-register.json'), JSON.stringify(reg), 'utf8');
    const r = spawnSync(process.execPath, [ST, ...argv], {
      cwd: REPO, encoding: 'utf8', env: { ...gateEnv(), PROJECT_OUTPUT_DIR: d, TASK_KEY: 'T1' },
    });
    return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}`, d };
  }

  const PHANTOM = { modules: [{ module: 'Payment', band: 'High', drivers: { bugCount: 0, failRate: 0, impactSource: 'config.module' } }] };
  const THAT = { modules: [{ module: 'Học sinh', band: 'High', drivers: { bugCount: 3, failRate: 0.2, impactSource: 'knowledge' } }] };

  test('High band mà 0 bug · 0 failRate · Impact từ config ⇒ CẢNH BÁO', () => {
    /*
     * Đo 11/10/2026 trên `CSDL-9003`: 10 module band High và CẢ 10 đều phantom (`Payment`,
     * `Transaction Management`, `Cash Management`… — module của dự án TRƯỚC còn trong `risk_model.json`),
     * trong khi 18 module CÓ dữ liệu thật bị chặn trần Medium.
     *
     * `risk:score` ĐÃ cảnh báo đúng chuyện đó. Nhưng cảnh báo ở chỗ SINH register không ngăn được việc
     * DÙNG nó — nên phép gác này đứng ở chỗ register được đem ra xếp thứ tự test.
     */
    const r = chaySt(PHANTOM, ['--risk-first']);
    expect(r.out).toMatch(/CẢ 1 đều KHÔNG có tín hiệu nào/);
    expect(r.out, 'phải nói hậu quả: chỉ đường test tới module không tồn tại').toMatch(/module không tồn tại/);
    expect(r.out, 'và chỉ cách sửa đúng chỗ').toMatch(/risk_model\.json/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('CẢNH BÁO, không chặn — điểm theo FILE vẫn là tín hiệu thật', () => {
    /* Chặn `--risk-first` vì register sai là bỏ luôn tín hiệu đúng (`tc-history` theo file). */
    const r = chaySt(PHANTOM, ['--risk-first']);
    expect(r.code, 'không được chặn').toBe(0);
    expect(r.out).toMatch(/Điểm rủi ro theo FILE .* vẫn dùng được/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('ÂM BẢN: register có tín hiệu thật ⇒ KHÔNG cảnh báo', () => {
    const r = chaySt(THAT, ['--risk-first']);
    expect(r.out, r.out).not.toMatch(/KHÔNG có tín hiệu nào/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('ÂM BẢN: không dùng `--risk-first` ⇒ không đọc register, không cảnh báo', () => {
    const r = chaySt(PHANTOM, []);
    expect(r.out, 'không dùng register thì không phán về nó').not.toMatch(/KHÔNG có tín hiệu nào/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('chưa có register ⇒ im lặng, không ném', () => {
    const r = chaySt(null, ['--risk-first']);
    expect(r.code, r.out).toBe(0);
    expect(r.out).not.toMatch(/KHÔNG có tín hiệu nào/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('chú thích đầu file KHÔNG còn câu "chưa auto-lọc"', () => {
    /*
     * Dòng đó mâu thuẫn với chú thích ngay phía dưới trong CÙNG file ("Giờ dùng thật") — đúng lớp lỗi
     * G4.1: hai câu trong một file dạy hai thứ khác nhau, và người đọc tin câu sai.
     */
    /*
     * Neo vào CÂU GỐC (`Ưu tiên High: nếu risk-register có`), không neo vào mảnh chữ "chưa auto-lọc" —
     * vì chính chú thích SỬA LỖI cũng phải dẫn lại mảnh đó để nói nó từng sai, nên phép kiểm lỏng sẽ
     * bắt đúng câu đang chữa lỗi. Lần thứ bảy trong phiên một phép quét bắt câu nói VỀ chính nó.
     */
    const src = fs.readFileSync(ST, 'utf8');
    expect(src, 'câu khẳng định cũ phải bị gỡ').not.toMatch(/Ưu tiên High: nếu risk-register có/);
    expect(src, 'và phải ghi lại là nó từng sai').toMatch(/SAI từ lúc `fileRisk\(\)` được dùng thật/);
  });
});
