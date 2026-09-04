import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { gateEnv } from './_gate_env';

/*
 * HỢP ĐỒNG ENV — `.env.example` phải khai ĐÚNG những gì code đọc, không thừa không thiếu.
 *
 * VÌ SAO CẦN (đo 04/09/2026). `.env.example` **được đóng gói** cùng kit, nên nó là tài liệu chính thức về
 * "dự án phải khai biến gì". Đo ra hai lỗi ngược nhau, cả hai đều làm người nhận làm sai:
 *
 *   ① Khoá CHẾT: `RELEASE_VERSION=` khai trong bản mẫu mà **không code/CI nào đọc**. Người nhận điền vào rồi
 *      tưởng đã cấu hình xong một thứ — trong khi nó không có tác dụng gì. Version thật lấy từ
 *      `package.json`.
 *   ② Khoá THIẾU: `.env` thật dùng `JIRA_uat_ASSIGNEE` — một khoá **không ai đọc** (đúng tên là
 *      `JIRA_FE_ASSIGNEE`/`JIRA_BE_ASSIGNEE`). Bản mẫu không khai nên không ai phát hiện được sự lệch đó.
 *
 * Hai luật dưới đây biến "bản mẫu đúng" thành phép kiểm, thay vì trông vào việc ai đó nhớ cập nhật nó.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const EXAMPLE = path.join(REPO, '.env.example');

const keysOf = (file: string): string[] => {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .map((l) => (l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/) || [])[1])
    .filter(Boolean) as string[];
};

/** Toàn bộ source có thể đọc env (không gồm chính bản mẫu và tài liệu). */
function sourceBlob(): string {
  const roots = ['scripts', 'tests', '.agent', 'prompt_templates', '.github', 'partial-rerun', 'exploratory'];
  const parts: string[] = [];
  const walk = (dir: string) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!/^(node_modules|\.git)$/.test(e.name)) walk(p); continue; }
      if (!/\.(js|mjs|cjs|ts|md|ya?ml|json)$/i.test(e.name)) continue;
      try { parts.push(fs.readFileSync(p, 'utf8')); } catch (err) { /* bỏ qua file không đọc được */ }
    }
  };
  roots.forEach((r) => walk(path.join(REPO, r)));
  for (const f of ['playwright.config.js', '.gitlab-ci.yml', 'package.json']) {
    try { parts.push(fs.readFileSync(path.join(REPO, f), 'utf8')); } catch (e) { /* không có */ }
  }
  return parts.join('\n');
}

/*
 * TÊN ENV GHÉP ĐỘNG — bộ đo phải thấy chúng, không thì nó báo "chết" cho khoá đang dùng.
 *
 * Đã suýt sai thật: `uatPgClient.ts` dựng tên bằng `${prefix}_HOST` với prefix mặc định `LIB_MASTER_DB`, nên
 * 6 khoá `LIB_MASTER_DB_{HOST,PORT,NAME,USERNAME,PASSWORD,SSL}` KHÔNG hề chết — nhưng tìm theo chuỗi literal
 * thì không thấy, và bộ đo bản đầu của tôi định khuyên xoá chúng. Cùng lớp lỗi "instrument mù" đã gặp ở
 * ant-select: phép đo không thấy ≠ thứ đó không tồn tại.
 */
function dynamicSuffixes(blob: string): string[] {
  const out = new Set<string>();
  // Dạng 1: `${prefix}_SUFFIX` trong template literal.
  for (const m of blob.matchAll(/\$\{[^}]+\}_([A-Z][A-Z0-9_]*)/g)) out.add(m[1]);
  /*
   * Dạng 2: suffix truyền vào HÀM helper dưới dạng string literal — `opt('STATEMENT_TIMEOUT_MS')`,
   * `v('HOST')`. Bản đầu chỉ bắt dạng 1 nên `LIB_MASTER_DB_STATEMENT_TIMEOUT_MS` bị báo chết oan: nó được
   * đọc qua `opt('STATEMENT_TIMEOUT_MS')` trong `uatPgClient`. Cách ghép tên env nhiều kiểu hơn ta tưởng.
   */
  for (const m of blob.matchAll(/['"]([A-Z][A-Z0-9_]{2,})['"]/g)) out.add(m[1]);
  return [...out];
}

/** Khoá được đọc qua tên ghép động? (prefix phải xuất hiện trong code, và suffix phải là suffix động) */
function readDynamically(key: string, blob: string, suffixes: string[]): boolean {
  for (const s of suffixes) {
    if (!key.endsWith(`_${s}`)) continue;
    const prefix = key.slice(0, -(s.length + 1));
    if (prefix && new RegExp(`\\b${prefix}\\b`).test(blob)) return true;
  }
  return false;
}

/*
 * Khoá chỉ để TÀI LIỆU: không code nào đọc, nhưng khai ra là có ích thật — người dùng ghi URL/ID vào đó để
 * tra cứu, và prompt/agent đọc bằng mắt. Danh sách phải NGẮN và mỗi mục có lý do: nó là lối thoát duy nhất
 * của luật ①, dài ra là luật mất tác dụng.
 */
const DOC_ONLY: Record<string, string> = {
  TASK_OUTPUT_DIR: 'dẫn xuất từ PROJECT_OUTPUT_DIR + TASK_KEY; khai ra để người dùng biết nó tồn tại và có thể ghi đè',
  OPS_URL: 'URL gốc của app để người/agent tra cứu; code dùng OPS_BASE_URL cho việc điều hướng thật',
  OPS_LOGIN_URL: 'ghi lại đường đăng nhập cho người mới vào dự án; luồng login thật dựng từ OPS_BASE_URL',
  OPS_SWAGGER_URL: 'nơi tra hợp đồng API khi cần kiểm tầng BE — agent mở bằng tay, không script nào tự gọi',
  LMS_API_BASE_URL: 'ghi lại base URL của LMS-BE để tra khi test giáo viên/học viên; token mượn từ request thật',
  LMS_SWAGGER_URL: 'nơi tra hợp đồng API của LMS — mở bằng tay như OPS_SWAGGER_URL',
  FEATURE_1_URL: 'chỗ ghi 3 màn trọng tâm của dự án để người mới biết bắt đầu từ đâu',
  FEATURE_2_URL: 'màn trọng tâm thứ hai — cùng lý do với FEATURE_1_URL: chỗ ghi để người mới biết bắt đầu từ đâu',
  FEATURE_3_URL: 'màn trọng tâm thứ ba — cùng lý do với FEATURE_1_URL: chỗ ghi để người mới biết bắt đầu từ đâu',
  JIRA_EPIC_URL: 'ghi lại epic đang làm để trích dẫn trong báo cáo; script Jira làm việc theo issue key, không theo URL',
  CONFLUENCE_REQUIREMENT_URL: 'ghi lại trang requirement nguồn để truy nguyên oracle; script Confluence nhận page id',
  HUBSPOT_ENV: 'ghi môi trường HubSpot đang trỏ (staging/prod) để người đọc biết dữ liệu ở đâu ra',
  HUBSPOT_UI_DOMAIN: 'domain UI HubSpot để dựng link cho người xem trong báo cáo',
  HUBSPOT_MCP_PACKAGE: 'ghi lại package MCP HubSpot đang dùng — thông tin môi trường, không phải cấu hình runtime',
};

/*
 * CHẾT THẬT, chờ chủ repo quyết xoá — **hiện RỖNG**.
 *
 * Ngày 04/09/2026 danh sách này có 10 khoá; chủ repo quyết xoá hết (cùng `RELEASE_VERSION` và
 * `JIRA_TESTCASE_ISSUE_TYPE` ở bản mẫu lồng của Jira), nên `.env.example` từ 85 → 75 khoá.
 *
 * Giữ lại cấu trúc RỖNG có chủ ý: lần sau phát hiện khoá chết thì có chỗ khai kèm lý do thay vì im lặng bỏ
 * qua — nhưng test ③ chặn nó ở 0, nên muốn khai phải đồng thời quyết xoá. Nợ không có chỗ trú.
 */
const DEAD_PENDING_DECISION: Record<string, string> = {};

test.describe('@infra hợp đồng env — bản mẫu là tài liệu ĐƯỢC ĐÓNG GÓI, không được dạy sai', () => {
  test('bản mẫu tồn tại và có khoá', () => {
    expect(fs.existsSync(EXAMPLE), 'thiếu .env.example — gói phát hành sẽ không nói được dự án phải khai gì').toBe(true);
    expect(keysOf(EXAMPLE).length).toBeGreaterThan(20);
  });

  test('CHỈ ĐƯỢC CÓ MỘT `.env.example` trong repo', () => {
    /*
     * Trước 04/09/2026 có BỐN: gốc + `jira/` + `google_doc/` + `google_sheet/`. Bản Jira trùng 21/21 khoá
     * với bản gốc, hai bản Google chỉ còn 3 khoá sống. Hai bản mẫu env là hai nguồn SẼ TRÔI khỏi nhau — và
     * chúng đã làm hỏng một phép đo thật: `git grep "khoá nào được đọc"` đếm cả file example, nên 6 khoá
     * CHẾT bị tưởng là sống và tôi đã thêm chúng vào `.env`.
     *
     * Cơ chế nạp env theo thư mục (`<script-dir>/.env.local`) VẪN CÒN — luật này chỉ chặn bản MẪU thứ hai,
     * không chặn file env thật.
     */
    const found: string[] = [];
    const walk = (dir: string) => {
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (!/^(node_modules|\.git|dist|outputs|test-results)$/.test(e.name)) walk(p); continue; }
        if (e.name === '.env.example') found.push(path.relative(REPO, p).split(path.sep).join('/'));
      }
    };
    walk(REPO);
    expect(found, `có ${found.length} file .env.example — phải đúng MỘT ở gốc repo: ${found.join(', ')}`).toEqual(['.env.example']);
  });

  test('không tài liệu/script nào còn trỏ tới bản mẫu lồng đã xoá', () => {
    /*
     * Xoá file mà để nguyên con trỏ thì người đọc đi theo tài liệu vào chỗ trống — tệ hơn cả trước khi xoá.
     * (Đường NẠP `<script-dir>/.env.local` và `.env` thì vẫn hợp lệ, luật này chỉ soi `.env.example`.)
     */
    const { execFileSync } = require('child_process');
    let hits = '';
    try {
      hits = execFileSync('git', ['grep', '-l', '-e', 'integrations/[a-z_]*/\\.env\\.example', '--',
        '*.md', '*.js', '*.ts', '*.yml'], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    } catch (e) { hits = ''; }
    expect(hits.trim(), `còn trỏ tới .env.example lồng đã xoá: ${hits.trim()}`).toBe('');
  });

  test('① KHÔNG có khoá chết MỚI: mọi khoá trong bản mẫu phải được code/CI đọc', () => {
    const blob = sourceBlob();
    const sfx = dynamicSuffixes(blob);
    const dead = keysOf(EXAMPLE).filter((k) => !DOC_ONLY[k] && !DEAD_PENDING_DECISION[k]
      && !new RegExp(`\\b${k}\\b`).test(blob) && !readDynamically(k, blob, sfx));
    expect(dead, `khoá khai trong .env.example mà KHÔNG nơi nào đọc ⇒ người nhận điền vào rồi tưởng đã cấu hình xong: ${dead.join(', ')}. Xoá khỏi bản mẫu, hoặc khai vào DOC_ONLY / DEAD_PENDING_DECISION kèm lý do.`).toEqual([]);
  });

  test('② mọi mục DOC_ONLY và DEAD_PENDING_DECISION phải có lý do viết ra', () => {
    for (const [name, map] of [['DOC_ONLY', DOC_ONLY], ['DEAD_PENDING_DECISION', DEAD_PENDING_DECISION]] as [string, Record<string, string>][]) {
      for (const [k, why] of Object.entries(map)) {
        expect(String(why).length, `${name}["${k}"] thiếu lý do — không có lý do thì nó chỉ là khoá chết được miễn trừ vĩnh viễn`).toBeGreaterThan(25);
      }
    }
  });

  test('③ danh sách chờ-quyết KHÔNG được phình: nó là nợ, không phải chỗ chứa', () => {
    /*
     * Ngưỡng = 0 sau khi dọn xong ngày 04/09. Thêm khoá chết mới vào đây là đỏ ngay ⇒ buộc phải QUYẾT chứ
     * không được hoãn. Nếu để ngưỡng > 0, "chờ quyết" thành nơi mọi khoá chết đi vào rồi ở lại vĩnh viễn.
     */
    const n = Object.keys(DEAD_PENDING_DECISION).length;
    expect(n, `${n} khoá chờ quyết. Ngày 04/09 danh sách này đã được dọn về 0 — thêm khoá chết mới vào đây là dựng lại chỗ trú cho nợ. Xoá khỏi .env.example luôn.`).toBe(0);
  });

  test('④ khoá đã khai chờ-quyết thì PHẢI còn trong bản mẫu (dọn rồi thì xoá cả ở đây)', () => {
    const keys = new Set(keysOf(EXAMPLE));
    const stale = Object.keys(DEAD_PENDING_DECISION).filter((k) => !keys.has(k));
    expect(stale, `đã xoá khỏi .env.example nhưng còn trong DEAD_PENDING_DECISION: ${stale.join(', ')} — xoá luôn để danh sách nợ nói đúng`).toEqual([]);
  });

  test('bản mẫu KHÔNG chứa giá trị thật (nó được đóng gói và phát ra ngoài)', () => {
    const body = fs.readFileSync(EXAMPLE, 'utf8');
    // Token thật / private key / SĐT VN — placeholder thì không khớp mẫu nào trong số này.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PATTERNS } = require(path.join(REPO, 'scripts/qa/lib/secret_patterns.js'));
    for (const p of PATTERNS) {
      expect(p.re.test(body), `.env.example khớp mẫu secret "${p.name}" — bản mẫu chỉ được chứa placeholder`).toBe(false);
    }
    expect(/(?<!\d)0\d{9,10}(?!\d)/.test(body.replace(/0987654321/g, '')), 'SĐT thật trong bản mẫu (0987654321 là placeholder được phép)').toBe(false);
  });

  test('biến THEO TASK phải được chú thích là thuộc profiles/<TASK>/task.env', () => {
    /*
     * `TASK_KEY`/`RUN_ID` khai ở `.env` chung là mở đường cho lượt chạy này ăn scope của task trước. Bản mẫu
     * vẫn khai chúng (tiện khi chỉ chạy một task) nhưng PHẢI nói ra ràng buộc, không thì người dùng làm theo
     * và hỏng lúc chạy song song.
     */
    const body = fs.readFileSync(EXAMPLE, 'utf8');
    const idx = body.indexOf('TASK_KEY=');
    expect(idx, 'bản mẫu không khai TASK_KEY').toBeGreaterThan(-1);
    const before = body.slice(Math.max(0, idx - 600), idx);
    expect(before, 'khai TASK_KEY mà không nhắc profiles/<TASK>/task.env ⇒ dạy người ta phá luật isolation').toMatch(/task\.env/);
  });

  test('profiles/task.env.example cũng phải khai đủ khoá mà code đọc theo prefix', () => {
    const f = path.join(REPO, 'profiles/task.env.example');
    expect(fs.existsSync(f), 'thiếu profiles/task.env.example — gói phát hành không nói được task.env cần gì').toBe(true);
    const keys = keysOf(f);
    // Ba nhóm bắt buộc: app creds · scope · DB read-only (tầng §23 đọc theo prefix LIB_MASTER_DB_RO_).
    for (const need of ['OPS_USERNAME', 'OPS_PASSWORD']) {
      expect(keys.some((k) => k.startsWith(need)), `task.env.example thiếu ${need}*`).toBe(true);
    }
    const body = fs.readFileSync(f, 'utf8');
    expect(body, 'task.env.example phải nhắc prefix LIB_MASTER_DB_RO_ — tầng §23 đọc creds DB theo prefix đó, và preflight CHẶN khi thiếu')
      .toMatch(/LIB_MASTER_DB_RO_/);
  });

  test('không script nào đọc `.env` chung để lấy creds DB của task (phải qua task.env)', () => {
    /*
     * Luật isolation: DB của task khoá trong `profiles/<TASK>/task.env`, không ở `.env` chung. Kiểm bằng máy
     * để nó không trôi: không file nào được đọc thẳng đường dẫn `.env` rồi rút `LIB_MASTER_DB`.
     */
    const { execFileSync } = require('child_process');
    let hits = '';
    try {
      /*
       * Phạm vi CHỈ nơi tiêu thụ (`scripts/`, `tests/support/`) — KHÔNG gồm `tests/fe/infra/`. Lý do: chính
       * file này chứa chuỗi mẫu để tìm, nên quét cả infra thì test tự bắt chính nó. Spec kiểm là NGƯỜI ĐO,
       * không phải nơi tiêu thụ config.
       */
      hits = execFileSync('git', ['grep', '-l', '-e', "readFileSync('.env'", '--', 'scripts', 'tests/support'],
        { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    } catch (e) { hits = ''; }   // git grep exit 1 = không khớp
    expect(hits.trim(), `script đọc thẳng .env chung: ${hits.trim()}`).toBe('');
  });
});
