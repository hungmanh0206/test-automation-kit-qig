import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * @infra — `run:analysis` (v2.5.0 G1.2): lượt chạy này CÓ ĐỦ MẪU SỐ để kết luận chất lượng không?
 *
 * Kit đã có `metrics_collect` (KPI mỗi lượt), `reliability_index` (độ tin cậy mỗi case) và
 * `summarize_results` (tóm tắt một lượt). Không có gì đọc **tỉ lệ BLOCKED** rồi quyết định xem lượt đó còn
 * đủ mẫu số để nói về chất lượng hay chưa.
 *
 * NGƯỠNG ĐƯỢC ĐO LẠI, KHÔNG CHÉP SUÔNG. Hai mức 5% và 20% lấy từ A, rồi đối chiếu 78 file
 * `testcase-status.json` của repo: trong 11 lượt có từ 20 case trở lên, 3 lượt dưới 5%, 4 lượt trong dải
 * 5–20%, và **4 lượt vượt 20%** (20.5 · 21.7 · 22.2 · 28.9%). Một ngưỡng mà mọi lượt đều nằm cùng một bên
 * thì không phân biệt được gì; ở đây nó chia tập làm ba phần thật, và `CSDL-9004` ở 28.9% bị CHẶN.
 *
 * HAI PHÉP KIỂM HIỆN CHƯA CÓ DỮ LIỆU THẬT, và script phải nói ra chứ không báo xanh:
 *  · nợ kiểm thử — 0 case SKIP trong toàn bộ 78 file status;
 *  · xu hướng — chưa có lịch sử cho task nào.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const RA = path.join(REPO, 'scripts/qa/run_analysis.js');

/** Dựng file status với phân bố verdict cho trước. */
function status(by: Record<string, number>, extra: Record<string, unknown>[] = []) {
  const tests: Record<string, unknown>[] = [];
  let i = 0;
  for (const [st, n] of Object.entries(by)) {
    for (let k = 0; k < n; k += 1) { i += 1; tests.push({ tcId: `TC_${String(i).padStart(3, '0')}`, status: st }); }
  }
  return { taskKey: 'TASK-1', generatedAt: '2026-10-10T00:00:00Z', tests: [...tests, ...extra] };
}

function chay(doc: unknown, argv: string[] = ['--enforce'], hist?: string) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'runan-'));
  const f = path.join(d, 'testcase-status.json');
  fs.writeFileSync(f, JSON.stringify(doc), 'utf8');
  const h = hist || path.join(d, 'hist.jsonl');
  const r = spawnSync(process.execPath, [RA, '--status', f, '--history', h, ...argv], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}`, d, h };
}

test.describe('@infra run:analysis — dải BLOCKED', () => {
  test('dưới 5% ⇒ không nêu riêng, ĐẠT', () => {
    const r = chay(status({ PASS: 96, BLOCKED_SETUP: 4 }));
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/4\.0%.*dưới 5\.0%/s);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('5–20% ⇒ phải NÊU NGAY ĐẦU báo cáo, nhưng KHÔNG chặn', () => {
    const r = chay(status({ PASS: 86, BLOCKED_SETUP: 14 }));
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/NÊU NGAY ĐẦU báo cáo/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('trên 20% ⇒ CHẶN, và nói rõ đây là "chưa đủ để phán", không phải "lượt chạy sai"', () => {
    const r = chay(status({ PASS: 70, BLOCKED_SETUP: 30 }));
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/KHÔNG được kết luận chất lượng/);
    expect(r.out, 'phân biệt rõ hai chuyện khác nhau').toMatch(/không phải "lượt chạy sai"/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('`BLOCKED` được chuẩn hoá qua `synonyms`, KHÔNG bằng bảng riêng', () => {
    /*
     * Dữ liệu thật dùng `BLOCKED` trong khi taxonomy khai `BLOCKED_SETUP`; `synonyms` đã nối hai cái đó.
     * Nếu script tự lập bảng ánh xạ thì có hai bảng cùng nghĩa, và chúng sẽ trôi.
     */
    const r = chay(status({ PASS: 70, BLOCKED: 30 }));
    expect(r.code, `\`BLOCKED\` phải được tính là blocked:\n${r.out}`).toBe(1);
    const src = fs.readFileSync(RA, 'utf8');
    expect(/['"]BLOCKED['"]\s*:\s*['"]BLOCKED_SETUP['"]/.test(src),
      'ánh xạ BLOCKED→BLOCKED_SETUP chỉ được khai ở verdict_taxonomy').toBe(false);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('ngưỡng đọc TỪ CONFIG, không hardcode', () => {
    const src = fs.readFileSync(RA, 'utf8');
    expect(src).toMatch(/CFG\.blockedBands/);
    const cfg = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/run_analysis.json'), 'utf8'));
    expect(cfg.blockedBands.binhThuong).toBeGreaterThan(0);
    expect(cfg.blockedBands.neuDauBaoCao).toBeGreaterThan(cfg.blockedBands.binhThuong);
    expect(JSON.stringify(cfg), 'config phải ghi SỐ ĐO làm căn cứ, không chọn ngưỡng theo cảm tính').toMatch(/28\.9/);
  });
});

test.describe('@infra run:analysis — nợ kiểm thử và dữ liệu bẩn', () => {
  test('SKIP vì PHÁ HUỶ tách riêng khỏi SKIP thường', () => {
    const r = chay(status({ PASS: 90 }, [
      { tcId: 'TC_X1', status: 'SKIP', comment: 'Bỏ qua vì case này xoá bản ghi thật trên UAT, không hoàn tác được' },
      { tcId: 'TC_X2', status: 'SKIP', comment: 'Chưa có tài khoản vai trò Sở để dựng tiền đề' },
    ]));
    expect(r.out).toMatch(/NỢ KIỂM THỬ: 1 case/);
    expect(r.out).toContain('TC_X1');
    expect(r.out, 'SKIP vì thiếu tiền đề KHÔNG phải nợ kiểm thử').not.toContain('TC_X2');
    expect(r.out, 'phải nói vì sao hai thứ đó khác nhau').toMatch(/KHÔNG tự chạy ở lượt sau/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('0 case SKIP ⇒ nói CHƯA GÁC GÌ, KHÔNG nói đạt', () => {
    /* Trạng thái THẬT của repo: 0 case SKIP trong toàn bộ 78 file status. */
    const r = chay(status({ PASS: 100 }));
    expect(r.out).toMatch(/CHƯA GÁC GÌ/);
    expect(r.out).toMatch(/không phải đạt/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('dữ liệu bẩn là TÍN HIỆU, không phải verdict — và không chặn', () => {
    const r = chay(status({ PASS: 90 }, [
      { tcId: 'TC_D1', status: 'PASS', comment: 'Lưới còn sót dữ liệu của lượt trước nên khớp có thể do trùng' },
    ]));
    expect(r.code, 'tín hiệu thì không chặn').toBe(0);
    expect(r.out).toMatch(/DỮ LIỆU BẨN/);
    expect(r.out).toMatch(/KHÔNG phải một verdict/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });
});

test.describe('@infra run:analysis — xu hướng chỉ khi CÙNG nguồn TC', () => {
  test('cùng tập `tcId` ⇒ so được, và in đúng độ lệch', () => {
    const d1 = chay(status({ PASS: 90, BLOCKED_SETUP: 10 }), ['--write']);
    const r = chay(status({ PASS: 95, BLOCKED_SETUP: 5 }), ['--write'], d1.h);
    expect(r.out).toMatch(/xu hướng \(cùng nguồn TC/);
    expect(r.out, 'BLOCKED giảm 5').toMatch(/BLOCKED -5/);
    [d1.d, r.d].forEach((x) => fs.rmSync(x, { recursive: true, force: true }));
  });

  test('tập `tcId` ĐỔI ⇒ TỪ CHỐI so số thô, và nói vì sao', () => {
    /*
     * Đây là luật đáng giá nhất của phần xu hướng: "pass rate tăng 4%" qua hai nguồn khác nhau có thể chỉ
     * là đã bỏ bớt case khó. Không có phép kiểm này thì con số trend trông thuyết phục mà vô nghĩa.
     */
    const d1 = chay(status({ PASS: 90, BLOCKED_SETUP: 10 }), ['--write']);
    const r = chay(status({ PASS: 50, BLOCKED_SETUP: 5 }), ['--write'], d1.h);
    expect(r.out).toMatch(/nguồn TC đã ĐỔI/);
    expect(r.out).toMatch(/100 → 55 case/);
    expect(r.out, 'phải nói hậu quả, không chỉ báo khác').toMatch(/bỏ bớt case khó/);
    expect(r.out, 'và KHÔNG được in dòng so sánh').not.toMatch(/cùng nguồn TC/);
    [d1.d, r.d].forEach((x) => fs.rmSync(x, { recursive: true, force: true }));
  });

  test('dấu vân tay nguồn TC KHÔNG dùng mtime hay băm file canonical', () => {
    /*
     * `TESTCASE_SOURCE=sheet` tải lại bản xlsx mỗi lượt; bản tải lại đổi byte dù nội dung không đổi. Lấy
     * mtime hoặc băm file làm dấu vân tay thì luật "chỉ so khi cùng nguồn" sẽ KHÔNG BAO GIỜ cho so — gate
     * thành vô dụng theo chiều ngược lại.
     */
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { dauVanTay } = require('../../../scripts/qa/run_analysis.js');
    const a = dauVanTay([{ tcId: 'B' }, { tcId: 'A' }]);
    const b = dauVanTay([{ tcId: 'A' }, { tcId: 'B' }]);
    expect(a.hash, 'thứ tự case KHÔNG được làm đổi dấu vân tay').toBe(b.hash);
    expect(dauVanTay([{ tcId: 'A' }]).hash, 'tập case khác thì dấu vân tay phải khác').not.toBe(a.hash);
    /*
     * Quét dạng CODE (`.mtime…`, `statSync(`), không quét chữ "mtime": bản đầu của phép kiểm này dùng
     * `/mtime|statSync/` và nó bắt đúng câu CHÚ THÍCH giải thích vì sao không được dùng mtime. Lần thứ tư
     * trong phiên một phép quét đi bắt câu cảnh báo về chính nó (trước đó: `column-count`,
     * `old-project-refs`, `auto:review`). Quy tắc rút ra: phép kiểm trên mã nguồn phải neo vào CÚ PHÁP.
     */
    const src = fs.readFileSync(RA, 'utf8');
    expect(/\.mtimeMs?\b|statSync\s*\(/.test(src), 'không được dùng mtime làm dấu vân tay nguồn').toBe(false);
  });

  test('`--write` là tuỳ chọn — không có nó thì KHÔNG ghi lịch sử', () => {
    const r = chay(status({ PASS: 100 }));
    expect(fs.existsSync(r.h), 'bộ phân tích không được tự ghi khi chưa ai yêu cầu').toBe(false);
    fs.rmSync(r.d, { recursive: true, force: true });
  });
});

test.describe('@infra run:analysis — repo thật, và cấu hình thiếu', () => {
  test('chạy được trên dữ liệu THẬT, và dải báo đúng', () => {
    /* Hai lượt thật, hai dải khác nhau — chứng minh ngưỡng phân biệt được trên dữ liệu của chính dự án. */
    const ca: [string, RegExp][] = [
      ['outputs/CSDL/tasks/CSDL-9003/test-results/testcase-status.json', /13\.9%.*NÊU NGAY ĐẦU/s],
      ['outputs/CSDL/tasks/CSDL-9004/test-results/testcase-status.json', /28\.9%.*KHÔNG được kết luận/s],
    ];
    for (const [f, mong] of ca) {
      const p = path.join(REPO, f);
      if (!fs.existsSync(p)) { test.skip(true, `không có ${f} trên máy này — dữ liệu lớp PROJECT`); return; }
      const r = spawnSync(process.execPath, [RA, '--status', p], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
      expect(`${r.stdout}${r.stderr}`, f).toMatch(mong);
    }
  });

  test('0 case ⇒ KHÔNG phán được, và nói rõ đây không phải đạt', () => {
    const r = chay({ taskKey: 'T', tests: [] });
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/KHÔNG phán được/);
    expect(r.out).toMatch(/không phải đạt/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('`run_analysis.json` có trong ALLOW của `package:kit`', () => {
    /*
     * `.agent/config/*` là DENY mặc định. Thiếu khai thì bản đóng gói báo "CHƯA ĐƯỢC GÁC" — đúng lớp lỗi
     * mà `config_load.js` được dựng ra để chống, và đã xảy ra thật với 16 file.
     */
    const pk = fs.readFileSync(path.join(REPO, 'scripts/qa/package_kit.js'), 'utf8');
    expect(pk).toContain('.agent/config/run_analysis.json');
  });
});
