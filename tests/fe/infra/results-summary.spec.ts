import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * @infra — BẢN TÓM TẮT KẾT QUẢ TEST (H4 của token-diet).
 *
 * Vì sao H4 đứng thứ hai trong thứ tự đã duyệt: đo bằng `npm run token:audit` trên 4 lượt chạy task thật,
 * `bash khác` cộng `output playwright test` chiếm 62 đến 75% khối lượng kết quả tool. Đây là hạng mục có
 * trần cao nhất, khoảng 620k token mỗi lượt.
 *
 * ĐIỀU QUAN TRỌNG NHẤT ĐƯỢC KHOÁ Ở ĐÂY, và nó là một luật an toàn chứ không phải một luật tiết kiệm:
 *
 *   BẢN TÓM TẮT KHÔNG ĐƯỢC LÀM MẤT MỘT CASE ĐỎ NÀO. Tóm tắt mà bỏ sót một FAIL thì tệ hơn hẳn không có
 *   tóm tắt: agent đọc "3 FAIL", xử lý 3, rồi kết luận xong — trong khi case thứ tư chưa ai nhìn. Nên
 *   trần số dòng được phép CẮT, nhưng phải nói rõ đã cắt bao nhiêu, và tổng số FAIL luôn đúng.
 *
 *   Cùng lý lẽ cho `--grep`: case đỏ không có TC ID thì grep bỏ sót nó, và máy phải KÊU chuyện đó. Im
 *   lặng ở đó dẫn tới đúng cái kết luận sai ở trên.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const SUM = path.join(REPO, 'scripts/qa/summarize_results.js');

type Ca = { title: string; ok: boolean; soLan?: number };

/** Dựng `results.json` đúng khuôn Playwright, chỉ đổi tập case. */
function dungJson(cas: Ca[]) {
  const spec = (c: Ca) => ({
    title: c.title,
    file: 'tests/fe/x.spec.ts',
    line: 9,
    tests: [{
      status: c.ok ? 'expected' : 'unexpected',
      results: Array.from({ length: c.soLan ?? 1 }, () => ({
        status: c.ok ? 'passed' : 'failed',
        // Mã màu ANSI CỐ Ý có trong fixture: Playwright thật in nó, và nếu không bóc thì bản tóm tắt
        // dính rác điều khiển terminal.
        errors: c.ok ? [] : [{ message: '\u001b[31mError: expect(received).toBe(expected)\u001b[0m\n  Expected: 5\n  at foo.ts:3' }],
        attachments: c.ok ? [] : [{ contentType: 'image/png', path: '/tmp/a.png' }],
      })),
    }],
  });
  return JSON.stringify({
    stats: { duration: 4000, expected: cas.filter((c) => c.ok).length, unexpected: cas.filter((c) => !c.ok).length },
    suites: [{ specs: cas.map(spec) }],
  });
}

function chay(cas: Ca[], args: string[] = []) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-'));
  const f = path.join(d, 'results.json');
  fs.writeFileSync(f, dungJson(cas), 'utf8');
  try {
    const r = spawnSync(process.execPath, [SUM, '--file', f, ...args], {
      cwd: REPO, encoding: 'utf8', env: gateEnv() as NodeJS.ProcessEnv,
    });
    return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
}

const do3 = (): Ca[] => [
  { title: 'A_TC_001 thêm học sinh', ok: false },
  { title: 'A_TC_002 sửa học sinh', ok: false },
  { title: 'A_TC_003 xoá học sinh', ok: false },
  { title: 'A_TC_004 lọc lưới', ok: true },
];

test.describe('@infra results:summary — tóm tắt có trần, nhưng KHÔNG mất case đỏ', () => {
  test('mỗi FAIL một dòng, kèm TC ID, lỗi rút gọn và đường dẫn ảnh', () => {
    const r = chay(do3());
    expect(r.out).toMatch(/3 PASS|1 PASS/);
    expect(r.out).toMatch(/1 PASS · 3 FAIL · 0 SKIP/);
    for (const id of ['A_TC_001', 'A_TC_002', 'A_TC_003']) expect(r.out).toContain(id);
    expect(r.out, 'case xanh KHÔNG được in từng dòng — đó là thứ `dot` đã bỏ đi').not.toContain('A_TC_004');
    expect(r.out, 'phải có đường dẫn ảnh để triage mở đúng chỗ').toMatch(/a\.png/);
  });

  test('BÓC mã màu ANSI — không để rác điều khiển terminal vào context', () => {
    const r = chay(do3());
    // eslint-disable-next-line no-control-regex
    expect(r.out, 'Playwright thật in mã màu; không bóc thì mỗi dòng dính 10 ký tự rác').not.toMatch(/\u001b\[/);
    expect(r.out).toContain('expect(received).toBe(expected)');
  });

  test('KHÔNG MẤT CASE ĐỎ — vượt trần thì cắt nhưng phải nói đã cắt bao nhiêu', () => {
    /*
     * Phép kiểm quan trọng nhất của file này. Mất nó thì ai đó đặt trần thấp cho "gọn", và từ hôm đó
     * bản tóm tắt im lặng bỏ sót case đỏ.
     */
    const r = chay(do3(), ['--max', '2']);
    expect(r.out, 'TỔNG số FAIL phải luôn đúng dù in ra bao nhiêu').toMatch(/3 FAIL/);
    const inRa = ['A_TC_001', 'A_TC_002', 'A_TC_003'].filter((id) => r.out.includes(`✗ ${id}`));
    expect(inRa.length, 'in đúng 2 dòng theo trần').toBe(2);
    expect(r.out, 'và phải nói rõ còn 1 case nữa chưa in').toMatch(/\+1 case đỏ nữa KHÔNG in ra/);
    expect(r.out).toMatch(/--max/);
  });

  test('`--ids` dựng được `--grep` để rerun đúng case đỏ', () => {
    const r = chay(do3(), ['--ids']);
    expect(r.out).toMatch(/--grep "A_TC_001\|A_TC_002\|A_TC_003"/);
    expect(r.out, 'phải nhắc đừng chạy lại cả suite').toMatch(/đừng chạy lại cả suite/);
    expect(r.out).toMatch(/--last-failed/);
  });

  test('case đỏ KHÔNG có TC ID: phải KÊU là `--grep` bỏ sót nó', () => {
    /*
     * Đây là lỗ hổng tôi tự tạo ở bản đầu và fixture bắt được: 3 case đỏ mà grep chỉ có 2 ID. Agent chạy
     * lại theo grep, thấy xanh, rồi kết luận đã xử lý hết — trong khi một case đỏ chưa từng chạy lại.
     */
    const cas: Ca[] = [...do3(), { title: 'case nay khong co ma', ok: false }];
    const r = chay(cas, ['--ids']);
    expect(r.out).toMatch(/4 FAIL/);
    const w = r.out.match(/⚠ (\d+)\/(\d+) case đỏ KHÔNG có TC ID/);
    expect(w, 'thiếu lời cảnh báo bỏ sót').toBeTruthy();
    expect(w![1]).toBe('1');
    expect(w![2]).toBe('4');
    expect(r.out).toContain('case nay khong co ma');
    expect(r.out, 'và chỉ đường ra không sót').toMatch(/--last-failed/);
  });

  test('xanh sau retry được đếm riêng, không lẫn vào FAIL', () => {
    const r = chay([{ title: 'A_TC_001 chập chờn', ok: true, soLan: 3 }]);
    expect(r.out).toMatch(/1 PASS · 0 FAIL/);
    expect(r.out, 'flaky là tín hiệu phải giữ, không được làm tròn thành PASS').toMatch(/1 xanh sau retry/);
  });

  test('không có case đỏ: nói rõ verdict KHÔNG do máy này chấm', () => {
    const r = chay([{ title: 'A_TC_001 ok', ok: true }]);
    expect(r.out).toMatch(/không có case đỏ/);
    expect(r.out, 'tránh ai đó dùng bản tóm tắt thay cho gate verdict').toContain('output_gate');
  });

  test('thiếu file hoặc JSON hỏng: báo rõ, và KHÔNG chặn (đây là máy báo cáo)', () => {
    const r = spawnSync(process.execPath, [SUM, '--file', '/khong/co/that.json'], {
      cwd: REPO, encoding: 'utf8', env: gateEnv() as NodeJS.ProcessEnv,
    });
    expect(r.status, 'máy BÁO CÁO không được chặn pipeline').toBe(0);
    expect(`${r.stdout}${r.stderr}`).toMatch(/không thấy results\.json/);
  });

  test('tìm `results.json` của lượt MỚI NHẤT, kể cả khi nó nằm trong `runs/<id>/`', () => {
    /*
     * LỖI THẬT, phát hiện khi chạy trên UAT ngày 10/10/2026. `playwright.task.config.js` của task ghi
     * kết quả vào `test-results/runs/<RUN_ID>/results.json`, KHÔNG phải `test-results/results.json`.
     * Bản đầu chỉ tìm ở đường thứ hai, nên nó đọc một kết quả CŨ (82 giây trước) mà không báo gì —
     * đúng lớp lỗi tệ nhất: trả lời tự tin bằng dữ liệu của lượt khác.
     *
     * Chọn theo mtime chứ không theo tên, vì RUN_ID do người đặt và không sắp thứ tự được.
     */
    const pod = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-pod-'));
    const tr = path.join(pod, 'tasks', 'T-1', 'test-results');
    fs.mkdirSync(path.join(tr, 'runs', 'luot-cu'), { recursive: true });
    fs.mkdirSync(path.join(tr, 'runs', 'luot-moi'), { recursive: true });

    // Bản ở gốc và bản trong `runs/luot-cu` đều CŨ; bản `runs/luot-moi` là mới nhất.
    fs.writeFileSync(path.join(tr, 'results.json'), dungJson([{ title: 'A_TC_900 cu o goc', ok: false }]), 'utf8');
    fs.writeFileSync(path.join(tr, 'runs', 'luot-cu', 'results.json'), dungJson([{ title: 'A_TC_901 cu', ok: false }]), 'utf8');
    fs.writeFileSync(path.join(tr, 'runs', 'luot-moi', 'results.json'), dungJson([{ title: 'A_TC_902 moi', ok: false }]), 'utf8');
    const gio = Date.now();
    fs.utimesSync(path.join(tr, 'results.json'), gio / 1000 - 600, gio / 1000 - 600);
    fs.utimesSync(path.join(tr, 'runs', 'luot-cu', 'results.json'), gio / 1000 - 300, gio / 1000 - 300);

    try {
      const r = spawnSync(process.execPath, [SUM], {
        cwd: REPO,
        encoding: 'utf8',
        env: { ...gateEnv(), PROJECT_OUTPUT_DIR: pod, TASK_KEY: 'T-1' } as NodeJS.ProcessEnv,
      });
      const out = `${r.stdout || ''}${r.stderr || ''}`;
      expect(out, 'phải đọc lượt MỚI NHẤT').toContain('A_TC_902');
      expect(out, 'không được đọc bản cũ ở gốc').not.toContain('A_TC_900');
      expect(out, 'không được đọc lượt cũ trong runs/').not.toContain('A_TC_901');
    } finally {
      fs.rmSync(pod, { recursive: true, force: true });
    }
  });

  test('prompt execute DẠY đọc bản tóm tắt, và cấm đọc JSON thô', () => {
    const p = fs.readFileSync(path.join(REPO, 'prompt_templates/phase2/04_execute_fe_playwright.md'), 'utf8');
    expect(p).toContain('npm run results:summary');
    expect(p, 'phải cấm Read thẳng results.json').toMatch(/KHÔNG `?Read`? thẳng `?results\.json/);
    expect(p, 'phải dạy rerun đúng case đỏ').toMatch(/Rerun ĐÚNG case đỏ/);
    expect(p, 'và cấm mở ảnh evidence để tự kiểm').toMatch(/KHÔNG mở ảnh evidence/);
  });

  test('skill ui_debug dạy tra knowledge/locators TRƯỚC khi mở MCP', () => {
    const s = fs.readFileSync(path.join(REPO, '.agent/skills/phase2/ui_debug_agent/SKILL.md'), 'utf8');
    expect(s, 'snapshot toàn trang phải là ngoại lệ, không phải mặc định').toMatch(/`snapshot` toàn trang chỉ mở khi/);
    expect(s).toMatch(/TRƯỚC khi mở MCP/);
    expect(s, 'và nêu đúng cái giá: trả tiền hai lần cho cùng một câu trả lời').toMatch(/hai lần/);
  });
});
