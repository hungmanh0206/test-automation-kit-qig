import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/*
 * @infra — ĐỊNH TUYẾN MODEL THEO LOẠI VIỆC (H6 của token-diet).
 *
 * GIỚI HẠN PHẢI ĐỌC TRƯỚC, vì nó quyết định test này kiểm được gì:
 *
 *   KHÔNG xác minh được end-to-end trong phiên hiện tại. Danh sách agent được nạp vào system prompt lúc
 *   PHIÊN BẮT ĐẦU, nên file thêm giữa phiên không xuất hiện. `claude agents` của bản 2.1.285 quản
 *   BACKGROUND agent, là tính năng khác, nên cũng không dùng để kiểm được.
 *
 *   Vậy test này kiểm thứ kiểm được: KHUÔN của file, và LỜI HỨA trong đó có khớp thứ repo thật sự có
 *   hay không. Phần "Claude Code có nhận agent này không" phải xác nhận bằng một phiên mới, và việc đó
 *   ghi trong USER_GUIDE chứ không giả vờ đã kiểm ở đây.
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
      for (const k of ['name', 'description', 'model', 'tools']) {
        expect(String(a.fm[k] || '').length, `${a.file}: thiếu khoá \`${k}\``).toBeGreaterThan(0);
      }
      expect(a.fm.name, `${a.file}: \`name\` phải khớp tên file`).toBe(a.file.replace(/\.md$/, ''));
      expect(a.fm.model, `${a.file}: model "${a.fm.model}" lạ`).toMatch(MODEL_RE);
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
});
