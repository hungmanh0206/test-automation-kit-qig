import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { canTaiLieu } from './_trong_repo';

/*
 * @infra — ĐỊNH TUYẾN MODEL THEO LOẠI VIỆC (H6 của token-diet).
 *
 * ĐÃ XÁC MINH ĐƯỢC (10/10/2026) — đính chính ghi chú cũ ở chính chỗ này.
 *
 *   Bản trước viết "KHÔNG xác minh được end-to-end", và lúc đó đúng: danh sách agent nạp vào system
 *   prompt lúc PHIÊN BẮT ĐẦU, nên file thêm GIỮA phiên không xuất hiện. Nhưng đó là vấn đề THỜI ĐIỂM
 *   chứ không phải vấn đề của file — và nó suýt bị chẩn đoán nhầm thành "frontmatter hỏng".
 *
 *   Sau khi harness nạp lại, cả hai agent xuất hiện và đã được GỌI THẬT trên fixture offline:
 *   `test-runner` trả đúng hợp đồng 3 phần (18 PASS, khớp 11+7 khi đối chiếu độc lập), `excel-convert`
 *   ghi đúng 2 case vào `.xlsx` và trả NGUYÊN VĂN cảnh báo của script. Chi tiết, và phần CHƯA đo được
 *   (model thật đã chạy là gì), nằm ở `docs/v2.4.1/AGENTS_VERIFY.md`.
 *
 *   Test này vẫn kiểm KHUÔN và LỜI HỨA — đó là thứ một spec offline kiểm được ở MỌI lượt chạy.
 *
 * VÌ SAO H6 ĐỨNG GẦN CUỐI: đo bằng `token:audit` cho thấy nó ảnh hưởng GIÁ, không ảnh hưởng số token
 * trong context. Nó không nằm trong nhóm có trần đo được như H1, H4, H5.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const DIR = path.join(REPO, '.claude/agents');

/** Model được phép khai. Việc máy móc đi model rẻ; việc cần suy luận KHÔNG giao cho subagent. */
const MODEL_RE = /^(haiku|sonnet|opus|fable)$/;

type Agent = { file: string; fm: Record<string, string>; body: string };

function docAgents(): Agent[] {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR).filter((f) => f.endsWith('.md')).map((f) => {
    const raw = fs.readFileSync(path.join(DIR, f), 'utf8');
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    expect(m, `${f}: thiếu khối frontmatter --- ... ---`).toBeTruthy();
    const fm: Record<string, string> = {};
    for (const line of String(m![1]).split(/\r?\n/)) {
      const kv = line.match(/^([a-z_]+):\s*(.*)$/i);
      if (kv) fm[kv[1]] = kv[2].trim();
    }
    return { file: f, fm, body: String(m![2]) };
  });
}

test.describe('@infra subagent — việc máy móc đi model rẻ', () => {
  test('có agent, và mỗi agent khai đủ name, description, model, tools', () => {
    const list = docAgents();
    expect(list.length, 'chưa có agent nào thì H6 chưa làm gì').toBeGreaterThan(0);
    for (const a of list) {
      for (const k of ['name', 'description', 'tools']) {
        expect(String(a.fm[k] || '').length, `${a.file}: thiếu khoá \`${k}\``).toBeGreaterThan(0);
      }
      expect(a.fm.name, `${a.file}: \`name\` phải khớp tên file`).toBe(a.file.replace(/\.md$/, ''));
      /*
       * `model` là TUỲ CHỌN, cố ý. Việc máy móc đi model rẻ; việc cần suy luận — gỡ một case đỏ, đọc
       * DOM, đoán nguyên nhân — thì KHÔNG được ghim model rẻ, để trống để nó thừa kế model mặc định.
       * Ghim `haiku` cho việc suy luận là rẻ đi một chút, sai đi rất nhiều.
       */
      if (a.fm.model) expect(a.fm.model, `${a.file}: model "${a.fm.model}" lạ`).toMatch(MODEL_RE);
      expect(String(a.fm.description).length, `${a.file}: description phải nói rõ KHI NÀO dùng`)
        .toBeGreaterThan(40);
    }
  });

  test('chỉ giao VIỆC MÁY MÓC — mỗi agent phải tự khai ranh giới', () => {
    /*
     * Phép kiểm quan trọng nhất. Một subagent model rẻ mà được giao việc cần suy luận nghiệp vụ (dựng
     * oracle, triage FAIL, Bug Claim) thì nó sẽ đưa ra kết luận, và kết luận đó trông y hệt kết luận của
     * model mạnh. Rẻ đi một chút, sai đi rất nhiều.
     */
    for (const a of docAgents()) {
      expect(a.body, `${a.file}: thiếu mục Ranh giới`).toMatch(/## Ranh giới/);
      expect(a.body, `${a.file}: phải cấm tự chấm verdict`).toMatch(/KHÔNG (chấm|phán) verdict/);
    }
  });

  test('mọi lệnh npm và script mà agent nhắc tới đều TỒN TẠI', () => {
    /*
     * Agent trỏ vào lệnh không có thì nó sẽ thử, thất bại, rồi tự nghĩ cách khác — đúng thứ không được
     * phép xảy ra ở một model rẻ chạy không ai nhìn.
     */
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require(path.join(REPO, 'package.json'));
    for (const a of docAgents()) {
      for (const m of a.body.matchAll(/npm run ([a-z0-9:_-]+)/g)) {
        expect(pkg.scripts[m[1]], `${a.file}: npm script "${m[1]}" không tồn tại`).toBeTruthy();
      }
      for (const m of a.body.matchAll(/node (scripts\/[^\s`]+\.js)/g)) {
        expect(fs.existsSync(path.join(REPO, m[1])), `${a.file}: script "${m[1]}" không tồn tại`).toBe(true);
      }
    }
  });

  test('USER_GUIDE ghi việc nào chạy model nào, và ghi cả GIỚI HẠN chưa xác minh', () => {
    /*
     * Không ghi giới hạn thì người đọc tưởng H6 đã chạy được. Mà thực tế nó cần một phiên mới để Claude
     * Code nạp định nghĩa agent.
     */
    const ug = fs.readFileSync(path.join(REPO, 'USER_GUIDE.md'), 'utf8');
    expect(ug, 'USER_GUIDE chưa nói gì về định tuyến model').toMatch(/\.claude\/agents\//);
    for (const a of docAgents()) expect(ug, `USER_GUIDE thiếu agent ${a.fm.name}`).toContain(a.fm.name);
    expect(ug, 'phải ghi rõ cần phiên mới mới nạp được định nghĩa agent').toMatch(/phiên mới/);
  });

  test('KHÔNG có subagent mồ côi — mỗi agent phải được NHẮC ở ít nhất một workflow hoặc command', () => {
    /*
     * Một định nghĩa subagent không ai gọi thì nó chỉ chạy khi Claude TỰ chọn theo mô tả — tức là may
     * rủi, không phải quy trình. Đúng tình trạng của `test-runner` và `excel-convert` ở v2.4.0:
     * `REPORT.md` lúc đó ghi "chưa xác minh", và không workflow nào nhắc tới chúng.
     *
     * Nối ở WORKFLOW chứ không ở điểm vào: `.agent/workflows/**` không nằm trong phần nạp bắt buộc nên
     * tốn 0 token, còn `.claude/commands/publish.md` là điểm vào của luồng publish — thêm chữ vào đó là
     * vượt `moc` trong prompt_budget.json.
     */
    const noi = [
      ...fs.readdirSync(path.join(REPO, '.agent/workflows')).map((f) => path.join(REPO, '.agent/workflows', f)),
      ...fs.readdirSync(path.join(REPO, '.claude/commands')).map((f) => path.join(REPO, '.claude/commands', f)),
    ].filter((f) => f.endsWith('.md')).map((f) => fs.readFileSync(f, 'utf8')).join('\n');

    const moCoi = docAgents().filter((a) => !noi.includes(a.fm.name));
    expect(moCoi.map((a) => a.file), 'subagent không ai gọi thì chỉ chạy khi Claude tự chọn — may rủi, không phải quy trình').toEqual([]);
  });

  test('`load_map.json` khai subagent nào dùng ở bước nào, và bước đó phải CÓ THẬT', () => {
    /* Lời khai trỏ vào một file không tồn tại là một bước ma: nhìn thì có quy trình, chạy thì không. */
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const map = require(path.join(REPO, '.agent/config/load_map.json'));
    expect(map.subagent, '`load_map.json` chưa khai mục `subagent`').toBeTruthy();

    for (const a of docAgents()) {
      const k = map.subagent[a.fm.name];
      expect(k, `load_map thiếu khai cho subagent ${a.fm.name}`).toBeTruthy();
      expect(String(k.khong_lam || '').length, `${a.fm.name}: khai thiếu \`khong_lam\` — ranh giới phải đọc được bằng máy`).toBeGreaterThan(10);
      for (const b of k.dung_o_buoc || []) {
        const f = String(b).split(' ')[0];
        expect(fs.existsSync(path.join(REPO, f)), `${a.fm.name}: khai dùng ở "${f}" mà file đó không tồn tại`).toBe(true);
      }
    }
  });

  test('việc CẦN SUY LUẬN không được ghim model rẻ', () => {
    /*
     * `case-debugger` đọc DOM và đoán nguyên nhân — đó là suy luận, không phải việc máy móc. Nó cố ý
     * KHÔNG khai `model` để thừa kế mặc định. Ai đó ghim `haiku` vào đây để tiết kiệm thì test này đỏ.
     */
    const cd = docAgents().find((a) => a.fm.name === 'case-debugger');
    expect(cd, 'thiếu subagent case-debugger — vòng gỡ một case đỏ vẫn nằm trong context chính').toBeTruthy();
    expect(cd!.fm.model, 'case-debugger phải để trống `model` để thừa kế mặc định').toBeFalsy();
    expect(cd!.body, 'phải cấm nới assertion — đây là chỗ dễ gian lận nhất khi gỡ case đỏ')
      .toMatch(/KHÔNG n\u1edbi assertion|KHÔNG nới assertion/);
    expect(cd!.body, 'phải cấm log Backlog').toMatch(/KHÔNG log Backlog/);
  });

  test('kết quả xác minh được GHI LẠI, kèm phần chưa đo được', () => {
    canTaiLieu(REPO, 'docs/v2.4.1/AGENTS_VERIFY.md', 'biên bản xác minh subagent');
    const p = path.join(REPO, 'docs/v2.4.1/AGENTS_VERIFY.md');
    expect(fs.existsSync(p), 'nối subagent mà không ghi lại bằng chứng đã gọi thử').toBe(true);
    const d = fs.readFileSync(p, 'utf8');
    expect(d, 'phải nói rõ còn chưa đo được gì').toContain('Giới hạn');
    expect(d, 'model thật đã chạy là phần chưa đọc lại được — không được khai là đã kiểm').toMatch(/kh\u00f4ng \u0111\u1ecdc l\u1ea1i \u0111\u01b0\u1ee3c|không đọc lại được/);
  });

});
