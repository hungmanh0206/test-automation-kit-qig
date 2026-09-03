import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/*
 * Máy giữ `.claude/commands/*` khỏi MỤC RỮA.
 *
 * Command là CON TRỎ: nó chỉ nói "đọc workflow nào · chạy npm script nào · dừng ở gate nào". Con trỏ không
 * có máy sau lưng thì sẽ trôi — đổi tên một npm script hoặc di chuyển một workflow là command chỉ dẫn sai,
 * và **không ai biết** vì chẳng có gì chạy nó.
 *
 * `gate:policy` (F3) chỉ đo hai chặng: `.agent/workflows/*` + `prompt_templates/run_phase*.md`. Command là
 * ĐIỂM VÀO THỨ BA mà nó chưa biết tới — file này bịt đúng chỗ đó.
 *
 * Và một luật nội dung: command KHÔNG được chép policy/rule. Kit đã có `gate:policy` ép RULE_GLOBAL.md là
 * canonical; chép luật vào command là tạo nguồn policy thứ hai, kiểu drift đắt nhất.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const DIR = path.join(REPO, '.claude', 'commands');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SCRIPTS: Record<string, string> = require(path.join(REPO, 'package.json')).scripts;

const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith('.md')) : [];
const body = (f: string) => fs.readFileSync(path.join(DIR, f), 'utf8');

test.describe('@infra slash commands — con trỏ phải trỏ đúng chỗ', () => {
  test('có thư mục command và ít nhất 5 lệnh', () => {
    expect(fs.existsSync(DIR), 'thiếu .claude/commands/').toBe(true);
    expect(files.length, `chỉ có ${files.length} command`).toBeGreaterThanOrEqual(5);
  });

  test('mỗi command có frontmatter `description` MỘT CÂU', () => {
    for (const f of files) {
      const b = body(f);
      expect(b.startsWith('---\n'), `${f}: thiếu frontmatter`).toBe(true);
      const fm = b.slice(4, b.indexOf('\n---', 4));
      const desc = (fm.match(/^description:\s*(.+)$/m) || [])[1];
      expect(desc, `${f}: thiếu description`).toBeTruthy();
      expect(String(desc).length, `${f}: description quá ngắn, user không biết lệnh làm gì`).toBeGreaterThan(30);
      expect(String(desc).split('\n').length, `${f}: description phải một dòng`).toBe(1);
    }
  });

  test('MỌI npm script được nhắc phải có trong package.json', () => {
    /*
     * Đây là luật đắt nhất của file này: đổi tên script mà quên command thì command dạy người ta chạy một
     * lệnh không tồn tại. Đo chứ không tin.
     */
    const missing: string[] = [];
    for (const f of files) {
      for (const m of body(f).matchAll(/npm run ([a-z0-9:_-]+)/g)) {
        if (!SCRIPTS[m[1]]) missing.push(`${f} → npm run ${m[1]}`);
      }
    }
    expect(missing, `npm script không tồn tại: ${missing.join(' | ')}`).toEqual([]);
  });

  test('MỌI đường dẫn workflow/rule/skill được nhắc phải tồn tại', () => {
    const missing: string[] = [];
    for (const f of files) {
      const re = /`((?:\.agent|prompt_templates|exploratory|partial-rerun|scripts|tests|outputs)\/[A-Za-z0-9_<>/.-]+\.(?:md|js|ts|json))`/g;
      for (const m of body(f).matchAll(re)) {
        if (m[1].includes('<')) continue;                       // mẫu có placeholder <TASK> — không kiểm
        if (!fs.existsSync(path.join(REPO, m[1]))) missing.push(`${f} → ${m[1]}`);
      }
    }
    expect(missing, `đường dẫn không tồn tại: ${missing.join(' | ')}`).toEqual([]);
  });

  test('mỗi command phải nói ĐIỀU KIỆN DỪNG (không chỉ liệt kê lệnh)', () => {
    for (const f of files) {
      expect(body(f), `${f}: thiếu mục "Dừng khi" — command không có điều kiện dừng thì agent chạy tới hết`)
        .toMatch(/Dừng khi/);
    }
  });

  test('command KHÔNG được chép policy (giữ 1 nguồn: RULE_GLOBAL.md)', () => {
    /*
     * Dấu hiệu chép luật: command dài, hoặc lặp lại nguyên văn các câu non-negotiable. Ngưỡng dòng đặt
     * rộng tay (60) — mục đích là chặn việc dán cả workflow vào command, không phải bắt lỗi văn phong.
     */
    for (const f of files) {
      const b = body(f);
      const lines = b.split('\n').length;
      expect(lines, `${f}: ${lines} dòng — quá dài cho một con trỏ, khả năng đã chép nội dung workflow`).toBeLessThan(60);
      for (const banned of ['Bảo mật tuyệt đối', 'Không gian lận để PASS', 'Evidence bắt buộc']) {
        expect(b, `${f}: chép nguyên văn mục policy "${banned}" ⇒ tạo nguồn policy thứ hai`).not.toContain(banned);
      }
    }
  });

  test('luồng chạm UAT phải nhắc XÁC NHẬN trước (CLAUDE.md §2)', () => {
    for (const f of ['phase2.md', 'rerun.md', 'explore.md', 'ui-debug.md']) {
      if (!files.includes(f)) continue;
      expect(body(f), `${f}: luồng này chạm UAT mà không nhắc xác nhận với user`).toMatch(/xác nhận/i);
    }
  });

  test('mỗi NHÁNH khai trong branch_parity.json phải có command cùng tên', () => {
    /*
     * Vì sao kiểm ở ĐÂY chứ không nhét command vào `branch_parity.json`: file đó khai "MÁY nào phải chạy ở
     * nhánh nào" kèm waiver có lý do. Command không phải máy — nó là ĐIỂM VÀO. Trộn hai khái niệm thì phải
     * viết waiver cho những thứ không waive được. Ở đây chỉ cần một luật: có nhánh thì phải có đường vào.
     * Hôm nay 4/4 có; mai ai thêm nhánh thứ 5 mà quên điểm vào thì đỏ ngay, kèm tên nhánh.
     */
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const parity = require(path.join(REPO, '.agent/config/branch_parity.json'));
    const branches = Object.keys(parity.branches || {});
    expect(branches.length, 'branch_parity không khai nhánh nào').toBeGreaterThan(0);
    const missing = branches.filter((b) => !files.includes(`${b}.md`));
    expect(missing, `nhánh không có slash command: ${missing.join(', ')} (thiếu .claude/commands/<nhánh>.md)`).toEqual([]);
  });

  test('publish phải nhắc dry-run TRƯỚC `:apply`', () => {
    if (!files.includes('publish.md')) return;
    const b = body('publish.md');
    expect(b).toMatch(/dry-run/i);
    expect(b.indexOf('aio:publish\n'), 'dry-run phải xuất hiện trước :apply').toBeLessThan(b.indexOf('aio:publish:apply'));
  });
});

test.describe('@infra skill ui_debug_agent', () => {
  const SKILL = path.join(REPO, '.agent/skills/phase2/ui_debug_agent/SKILL.md');

  test('tồn tại, và frontmatter `name` khớp TÊN THƯ MỤC', () => {
    /*
     * `skills_index.js` khoá theo TÊN THƯ MỤC (prompt/workflow nhắc skill bằng tên thư mục), nên lệch
     * frontmatter không làm index sai — nhưng lệch thì người đọc file lại tưởng skill tên khác.
     */
    expect(fs.existsSync(SKILL)).toBe(true);
    const b = fs.readFileSync(SKILL, 'utf8');
    expect((b.match(/^name:\s*(\S+)/m) || [])[1]).toBe(path.basename(path.dirname(SKILL)));
  });

  test('khai Never-auto + xác nhận UAT, và KHÔNG chép bảng ưu tiên locator', () => {
    const b = fs.readFileSync(SKILL, 'utf8');
    expect(b, 'phải khai mức tự chủ Never-auto').toMatch(/Never-auto/);
    expect(b, 'phải nhắc xác nhận trước khi chạm UAT').toMatch(/xác nhận với user/);
    expect(b, 'phải trỏ về nguồn canonical').toContain('.agent/rules/locator_strategy.md');
    // Chép bảng ưu tiên = tạo luật song song. Bảng đó có 6 tầng đánh số ở locator_strategy.md.
    expect(b, 'skill chép bảng ưu tiên locator ⇒ luật song song').not.toMatch(/\|\s*5\s*\|\s*`?getByTestId/);
  });

  test('có đủ 4 dạng safe_target, 7 playbook, và mục phân loại verdict', () => {
    const b = fs.readFileSync(SKILL, 'utf8');
    for (const m of ['safe_target.section', 'safe_target.one', 'safe_target.clickVerified', 'safe_target.readValue']) {
      expect(b, `thiếu ${m}`).toContain(m);
    }
    // Khoá vào NỘI DUNG, không vào định dạng markdown: lần đầu tôi khoá cả dấu in đậm nên gate tự đỏ.
    for (const p of ['đăng nhập', 'dialog', 'iframe', 'Shadow DOM', 'lazy load', '//tr[3]/td[2]', 'overlay']) {
      expect(b, `playbook thiếu tình huống: ${p}`).toContain(p);
    }
    for (const v of ['script_error', 'setup_failure', 'product bug']) expect(b).toContain(v);
    expect(b, 'phải cấm log Jira từ skill này').toMatch(/KHÔNG log Jira/);
  });

  test('3 output bắt buộc đều có mặt', () => {
    const b = fs.readFileSync(SKILL, 'utf8');
    expect(b, 'thiếu bảng locator đề xuất').toMatch(/Sentinel nghiệm thu/);
    expect(b, 'thiếu yêu cầu ghi knowledge/locators').toContain('knowledge/locators/');
    expect(b, 'thiếu fieldMap theo màn').toMatch(/fieldMap.*theo MÀN|byScreen/);
  });

  test('không hứa tool không có: nếu nhắc MCP thì phải nói repo CHƯA cài + cách chạy thật', () => {
    /*
     * Bản task ban đầu mô tả chuỗi lệnh MCP browser (navigate/snapshot/…). Đo: repo không khai `mcpServers`
     * nào. Skill mà chỉ dẫn tool không tồn tại thì không ai làm theo được — nên nếu còn nhắc MCP, bắt buộc
     * phải nói rõ tình trạng và ánh xạ sang cơ chế đang dùng thật.
     */
    const b = fs.readFileSync(SKILL, 'utf8');
    if (!/MCP/.test(b)) return;
    expect(b, 'nhắc MCP mà không nói repo chưa cài').toMatch(/chưa cài browser MCP/i);
    expect(b, 'phải có ánh xạ sang Playwright đang dùng').toContain('ariaSnapshot');
  });
});
