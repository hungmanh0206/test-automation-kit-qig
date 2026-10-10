import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';
import rules from '../../../scripts/qa/lib/output_rules';

/*
 * @infra — ẢNH EVIDENCE NHÚNG INLINE Ở DƯỚI CÙNG DESCRIPTION BUG BACKLOG.
 *
 * Yêu cầu 10/10/2026: ảnh phải hiện ngay trong bug, không bắt người đọc bấm sang khung attachment rồi tự
 * ghép xem ảnh nào ứng bước nào.
 *
 * BA THỨ ĐƯỢC KHOÁ Ở ĐÂY, và cả ba đều là chỗ đã từng hoặc sẽ hỏng IM LẶNG:
 *
 *   ① CÚ PHÁP PHẢI SUY TỪ `textFormattingRule`, KHÔNG GHI CỨNG. Tài liệu Nulab nói rõ: đổi quy tắc định
 *      dạng thì ảnh VẪN còn đính kèm nhưng đoạn mã hiển thị ảnh NGỪNG CHẠY. Ghi cứng `![image][…]` là hẹn
 *      trước một ngày mọi bug mất ảnh mà không máy nào kêu — đúng họ với lỗi `**đậm**` từng tin suông
 *      (xem ghi chú 06/10/2026 trong `bug_reporter.js`).
 *
 *   ② KHỐI ẢNH KHÔNG ĐƯỢC CÓ TIÊU ĐỀ IN ĐẬM. Prompt 08 §Description CẤM thêm mục `Evidence`, và
 *      `lintBugHeadings` CHẶN description khác 4 mục. Nên khối ảnh phải là ảnh trần. Test này đối chiếu
 *      bằng CHÍNH `lintBugHeadings`, không tự đếm lại — hai bản đếm thì sớm muộn lệch nhau.
 *
 *   ③ VIDEO KHÔNG NHÚNG ĐƯỢC. `.mp4/.webm` không render inline ở Backlog; nhúng nó chỉ in ra một dòng mã
 *      hỏng giữa bug. Nó vẫn là attachment bình thường.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const REPORTER = path.join(REPO, 'scripts/integrations/backlog/bug_reporter.js');
const PROMPT08 = path.join(REPO, 'prompt_templates/phase2/08_log_bug_backlog.md');

const PAYLOAD = {
  preconditions: 'Đã đăng nhập đơn vị TEST 1',
  steps: ['Mở màn Hồ sơ học sinh', 'Bấm Ghi'],
  actualResult: 'Không hiện thông báo',
  expectedResult: 'Hiện thông báo trùng mã',
  tcId: 'CSDL_HS_TC_117',
  layer: 'fe',
};

/** Dựng description trong một tiến trình con — module đọc TASK_KEY ngay lúc nạp, nên phải có env. */
function moTa(quyTac: string, anh: string[]) {
  const js = `
    const m = require(${JSON.stringify(REPORTER)});
    m.datQuyTacChu(${JSON.stringify(quyTac)});
    process.stdout.write(m.buildBugDescription({ ...${JSON.stringify(PAYLOAD)}, anh: ${JSON.stringify(anh)} }));
  `;
  const r = spawnSync(process.execPath, ['-e', js], {
    cwd: REPO,
    encoding: 'utf8',
    env: gateEnv({ TASK_KEY: 'T-1', PROJECT_OUTPUT_DIR: 'outputs/CSDL' }),
  });
  return { out: r.stdout || '', warn: r.stderr || '', code: r.status };
}

/** Các tiêu đề in đậm của description, theo đúng cách `output_gate` bóc chúng. */
function tieuDe(desc: string) {
  return desc.split('\n')
    .map((l) => l.match(/^\*\*(.+?):\*\*$/))
    .filter(Boolean)
    .map((m) => (m as RegExpMatchArray)[1]);
}

test.describe('@infra bug Backlog — ảnh evidence nhúng inline ở dưới cùng', () => {
  test('quy tắc `markdown`: mỗi ảnh một dòng `![image][tên]`, ở DƯỚI CÙNG', () => {
    const { out } = moTa('markdown', ['a.png', 'b.webp']);
    const dong = out.trim().split('\n');
    expect(dong.slice(-2)).toEqual(['![image][a.png]', '![image][b.webp]']);

    // Dưới cùng nghĩa là SAU marker TC. Chuyển được vì `searchExistingBug` tìm marker bằng `.includes()`
    // chứ không đòi nó đứng cuối — đã kiểm lại trước khi chuyển, không tin vào chữ "để ở CUỐI" trong
    // ghi chú cũ.
    expect(out.indexOf('TC: [CSDL_HS_TC_117]')).toBeLessThan(out.indexOf('![image]'));
  });

  test('quy tắc `backlog`: cú pháp ĐỔI sang `#image(tên)` — không ghi cứng markdown', () => {
    /*
     * Đây là tiêu chí ① và là lý do test này tồn tại. Nulab: đổi `textFormattingRule` thì ảnh vẫn đính kèm
     * nhưng mã hiển thị ngừng chạy. Nếu ai đó ghi cứng `![image][…]` cho gọn, test này đỏ ngay.
     */
    const { out } = moTa('backlog', ['a.png']);
    expect(out.trim().split('\n').slice(-1)).toEqual(['#image(a.png)']);
    expect(out).not.toContain('![image]');
  });

  test('cờ đọc không ra: KÊU rõ, rồi mới tạm dùng markdown — không im lặng', () => {
    const { out, warn } = moTa('', ['a.png']);
    expect(warn).toContain('textFormattingRule');
    expect(warn).toMatch(/CHƯA|chưa đọc/);
    expect(out).toContain('![image][a.png]'); // vẫn có ảnh: thà nhúng theo mặc định còn hơn bỏ trắng
  });

  test('VIDEO bị loại khỏi khối nhúng — nhúng nó chỉ ra một dòng mã hỏng', () => {
    const { out } = moTa('markdown', ['a.png', 'c.mp4', 'd.webm']);
    expect(out).toContain('![image][a.png]');
    expect(out).not.toContain('c.mp4');
    expect(out).not.toContain('d.webm');
  });

  test('khối ảnh KHÔNG thêm mục thứ 5 — đối chiếu bằng chính `lintBugHeadings`', () => {
    /* Tiêu chí ②: dùng lại máy gác thật thay vì tự đếm, để test và gate không thể lệch nhau. */
    const { out } = moTa('markdown', ['a.png', 'b.webp']);
    const h = tieuDe(out);
    expect(h).toEqual(['Tiền điều kiện', 'Bước', 'Kết quả hiện tại', 'Kết quả mong muốn']);
    expect(rules.lintBugHeadings(h), 'description có ảnh vẫn phải qua gate 4 mục').toEqual([]);
  });

  test('không có ảnh: description không đổi, không thừa dòng trắng ở cuối', () => {
    const { out } = moTa('markdown', []);
    expect(out).not.toContain('![image]');
    expect(out.endsWith('\n')).toBe(false);
    expect(rules.lintBugHeadings(tieuDe(out))).toEqual([]);
  });

  test('reporter ĐỌC `textFormattingRule` từ API, không ghi cứng cú pháp', () => {
    /*
     * Chặn đường lùi: ai gỡ phép đo cờ đi và ghi cứng một cú pháp thì test trên vẫn có thể xanh nếu họ
     * cũng sửa `datQuyTacChu`. Neo thẳng vào chỗ cờ được ĐỌC.
     */
    const src = fs.readFileSync(REPORTER, 'utf8');
    expect(src, 'phải đọc cờ từ GET /projects').toContain('textFormattingRule');
    expect(src, 'phải cache cờ cùng projectId, không đọc lại mỗi lượt').toContain('quyTacChu');
  });

  test('prompt 08 khai đúng hành vi này — prompt và máy không được lệch', () => {
    const p = fs.readFileSync(PROMPT08, 'utf8');
    expect(p, 'phải nói ảnh tự hiện inline').toMatch(/tự hiện inline/i);
    expect(p, 'phải dặn KHÔNG dán tay').toMatch(/KHÔNG dán tay/);
    expect(p, 'phải nêu cả hai cú pháp theo cờ').toContain('#image(');
    /*
     * Ghi chú "CHƯA VERIFY cú pháp" cũ phải đi, vì nó đã được xác minh và để lại thì lượt sau lại tránh
     * nhúng inline một lần nữa. Nhưng phần COMMENT thì vẫn chưa đo, và prompt phải nói rõ chỗ đó.
     */
    expect(p).not.toMatch(/CHƯA VERIFY cú pháp — trước mắt/);
    expect(p, 'comment vẫn là phần chưa đo — không được khai đã xong').toMatch(/comment.*CHƯA ĐO/s);
  });
});
