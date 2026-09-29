#!/usr/bin/env node
'use strict';

/*
 * package_kit.js — đóng gói bản phát hành SẠCH của kit vào `dist/`.
 *
 * NGUYÊN TẮC DUY NHẤT: gói chỉ chứa **lớp GENERIC** theo `.agent/config/kit-layers.md`. Lớp PROJECT không
 * được lọt, vì hai lý do khác nhau và đều nghiêm trọng:
 *   · SECRET/PII — `.env*`, `profiles/<TASK>/task.env`, `knowledge/**`, `outputs/**` là dữ liệu công ty.
 *   · ORACLE SAI — `.agent/config/db.conventions.json` chứa schema + bản đồ cột↔nhãn ĐO TỪ DB của MỘT dự án
 *     (đo được: tên bảng thật, host DB, và nhãn tiếng Việt của màn nội bộ). Phát cho dự án
 *     khác là đưa họ một bản đồ cột sai mà vẫn "có số từ DB" — đúng cách tạo bug ma thuyết phục nhất. Nên
 *     gói mang `db.conventions.example.json`, không mang bản thật.
 *
 * SAU KHI ĐÓNG GÓI, QUÉT LẠI CHÍNH GÓI. Không tin danh sách loại trừ: một đường dẫn viết sai là gói lộ dữ
 * liệu, và gói phát ra ngoài là đường rò khó thu hồi nhất. Phát hiện ⇒ **xoá gói + exit 1**.
 *
 * KHÔNG THÊM DEPENDENCY: nén bằng `tar` (có sẵn trên Windows 10+ và mọi runner Linux). Cố ý không dùng `.zip`
 * — `zip` không có trong git-bash trên máy Windows, còn thêm `archiver` thì lock lệch (cây đang có 4.0.2).
 *
 * Dùng: node scripts/qa/package_kit.js [--out dist]
 * Exit: 0 đạt · 1 gói bẩn/thiếu file bắt buộc · 2 dùng sai.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');

/* ── Lớp GENERIC: những gì ĐƯỢC mang đi ────────────────────────────────────────────────────────────────── */
const KEEP_DIRS = [
  '.agent/rules', '.agent/skills', '.agent/workflows',
  'scripts', 'prompt_templates', 'partial-rerun', 'exploratory',
  'tests/support', 'tests/fe/infra', 'tests/fe/fixtures', 'tests/fe/pages', 'tests/fe/visual', 'tests/fixtures',
  '.claude/commands', '.github/workflows',
  /*
   * Ảnh của USER_GUIDE. Thiếu thư mục này thì tài liệu onboarding chính của kit hiện 10 ẢNH VỠ ngay
   * lần mở đầu tiên. Đo 19/09/2026: gói không mang `docs/` nào, trong khi `USER_GUIDE.md` nhúng đúng
   * 10 ảnh ở đây. Ảnh đã gỡ sạch nhận diện công ty nên mang đi được.
   */
  'docs/user-guide-images',
];
const KEEP_FILES = [
  '.gitlab-ci.yml', 'playwright.config.js', 'package.json', 'package-lock.json',
  'tsconfig.json', 'eslint.config.js', '.nvmrc', '.gitignore', '.env.example',
  'profiles/task.env.example', 'knowledge/SCHEMA.md',
  'README.md', 'QUICKSTART.md', 'USER_GUIDE.md', 'RULE_GLOBAL.md', 'CHANGELOG.md', 'CLAUDE.md',
  /*
   * Danh mục 80 máy của kit. Hai lý do phải mang theo, cả hai đo được:
   *   · `README.md` trỏ tới file này, không mang là link hỏng ngay ở tài liệu đầu tiên;
   *   · `gate:policy` trong gói ĐỎ vì `writing:lint:docs` không bề mặt nào nhắc — GATES.md là nơi
   *     duy nhất nhắc nó, nên bỏ file này ra là tự làm hỏng phép kiểm 1-nguồn-policy của chính gói.
   * Nội dung là catalogue sinh tự động từ chính source, không mang dữ liệu dự án.
   */
  '.agent/config/GATES.md',
  '.agent/config/kit-layers.md', '.agent/config/verdict_taxonomy.json',
  '.agent/config/case_types.json', '.agent/config/branch_parity.json', '.agent/config/ci_scope.json',
  '.agent/config/ci_parity.json',
  '.agent/config/locators.schema.json',
  /*
   * CẤU HÌNH MÁY MÓC — lớp GENERIC, phải đi theo gói.
   *
   * Luật "chỉ mang .example, loại mọi config THẬT" viết ra để chặn dữ liệu dự án, nhưng nó loại nhầm
   * cả cấu hình mà chính máy của kit cần để chạy. Đo 19/09/2026: giải nén gói rồi chạy suite thì
   * 25 test ĐỎ, phần lớn là ENOENT đúng mấy file này (`writing_style.json`, `env_lanes.json`).
   * Người nhận gõ `npm test` lần đầu thấy 25 đỏ mà không hiểu vì sao.
   *
   * Cả 5 file đã soi: không chứa host, bảng DB, credential hay PII. Chỗ nhắc mã task chỉ là TIỀN LỆ
   * cho luật (kiểu "bug CSDL-28776 bị Rejected vì đọc thiếu chữ"), giữ lại thì luật mới có căn cứ.
   */
  '.agent/config/writing_style.json',
  '.agent/config/env_lanes.json',
  '.agent/config/bug_claim.json',
  '.agent/config/retention.json',
  '.agent/config/library-drift.allow.json',
];

/*
 * Lớp PROJECT nằm TRONG thư mục GENERIC ⇒ phải loại theo tên, không thể loại theo thư mục cha.
 * `.agent/config/*` chỉ mang bản `.example.*` + danh sách trên; mọi file config THẬT khác đều bị loại.
 */
const DENY = [
  /(^|\/)node_modules(\/|$)/,
  /^outputs\//, /^reports\//, /^test-results\//, /^dist\//, /(^|\/)\.git(\/|$)/,
  // `.env.example` PHẢI được giữ (nó là bản mẫu, lớp GENERIC). Luật cũ `/^\.env(\..*)?$/` giết luôn nó.
  /^\.env$/, /^\.env\.(?!example$)/, /(^|\/)\.env$/, /^\.claude\/settings/,
  /^profiles\/(?!task\.env\.example$)/,
  /^knowledge\/(?!SCHEMA\.md$)(?!.*\.gitkeep$)/,
  /^tests\/api\//, /^tests\/mobile-web\//,
  /^tests\/fe\/(auth|support|order|transaction)\//,
  /\.spec\.ts-snapshots\//,           // ảnh baseline visual là của dự án, không phải của kit
  /*
   * Spec CHẠY THẬT trên DB/màn của dự án này ⇒ lớp PROJECT, dù nằm trong thư mục GENERIC.
   * Chúng truy vấn bảng thật trên DB thật và assert nhãn UI tiếng Việt của app nội bộ: mang
   * sang dự án khác thì KHÔNG THỂ pass, và một spec đỏ-vì-sai-dự-án còn tệ hơn không có spec (người nhận sẽ
   * học cách bỏ qua màu đỏ). Kit vẫn mang ĐỘNG CƠ của tầng DB (`types/match/guard/config/dbVerify/adapters`)
   * + `db.conventions.example.json`; phần NEO là việc mỗi dự án tự đo.
   */
  /^tests\/support\/setup\/db\/.*\.spec\.ts$/,
  /^tests\/fe\/infra\/db-verify-.*\.spec\.ts$/,
];

const rel = (p) => path.relative(REPO, p).split(path.sep).join('/');

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(path.join(REPO, dir), { withFileTypes: true }); } catch (e) { return out; }
  for (const e of entries) {
    const r = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(r, out);
    else out.push(r);
  }
  return out;
}

function collect() {
  const files = new Set();
  for (const d of KEEP_DIRS) for (const f of walk(d)) files.add(f);
  for (const f of KEEP_FILES) if (fs.existsSync(path.join(REPO, f))) files.add(f);
  // Bản .example.* của mọi config + mọi .gitkeep (giữ khung thư mục cho người nhận).
  for (const f of walk('.agent/config')) if (/\.example\.[a-z]+$/.test(f)) files.add(f);
  for (const f of walk('knowledge')) if (f.endsWith('.gitkeep')) files.add(f);
  return [...files].filter((f) => !DENY.some((re) => re.test(f))).sort();
}

/*
 * Quét gói bằng ĐÚNG luật của secret_scan (`lib/secret_patterns.js` — một nguồn), CỘNG thêm marker lớp
 * PROJECT. Không dùng regex email/SĐT trên source: bản đầu làm vậy và báo oan 4 chỗ hợp lệ (email tác giả
 * trong package-lock, placeholder trong .env.example, chuỗi mẫu trong sanitize.js, URL SSH git@host). PII
 * của khách nằm ở outputs/knowledge/profiles — đã loại theo CẤU TRÚC.
 */
function scanPackage(root, files) {
  const sp = require(path.resolve(__dirname, 'lib', 'secret_patterns'));
  const { PATTERNS, CRED_FILE, CRED_CONTENT } = sp;
  // Marker tên bảng suy từ quy ước DB của CHÍNH `root` — xem `markersFromConventions` để biết vì sao.
  const PROJECT_MARKERS = [...sp.PROJECT_MARKERS, ...sp.markersFromConventions(root)];
  const hits = [];
  const warns = [];
  for (const f of files) {
    if (CRED_FILE.test(path.basename(f))) {
      let body = '';
      try { body = fs.readFileSync(path.join(root, f), 'utf8'); } catch (e) { /* nhị phân */ }
      if (CRED_CONTENT.test(body)) { hits.push(`${f} — tên VÀ nội dung kiểu credential`); continue; }
    }
    if (/\.(png|jpe?g|webp|mp4|webm|xlsx|zip|gz|ico|woff2?|ttf)$/i.test(f)) continue;
    let body;
    try { body = fs.readFileSync(path.join(root, f), 'utf8'); } catch (e) { continue; }
    for (const p of PATTERNS) if (p.re.test(body)) hits.push(`${f} — secret: ${p.name}`);

    /*
     * Marker lớp PROJECT — CHẶN hay CẢNH BÁO tuỳ LOẠI FILE, vì hại của hai loại khác nhau hẳn:
     *
     *   · File DỮ LIỆU (.json/.yml) mang tên bảng/host của dự án ⇒ **CHẶN**. Đây đúng ca `db.conventions.json`:
     *     người nhận sẽ dùng nó làm oracle và ra kết luận sai mà vẫn "có số từ DB".
     *   · File CODE/tài liệu chỉ NHẮC tên bảng trong comment/ví dụ ⇒ **CẢNH BÁO**. Ví dụ `types.ts` giải thích
     *     "cùng khái niệm tiền, hai kiểu lưu" bằng bảng thật — đó là tri thức có ích, không phải oracle. Chặn
     *     ở đây là chặn oan, và gate báo oan một lần là mất uy tín vĩnh viễn.
     *
     * Bản `.example.*` và `.md` bỏ qua: chúng TỒN TẠI để kể ví dụ có thật.
     *
     * NGOẠI LỆ — `.md` dưới `prompt_templates/` và `.agent/` thì KHÔNG bỏ qua, và là CHẶN.
     * Hai thư mục đó được `kit-layers.md` khai là lớp GENERIC với ràng buộc nguyên văn "phải KHÔNG chứa tên
     * hệ thống/task/URL của dự án cụ thể". Khác biệt không nằm ở đuôi file mà ở VAI TRÒ: `README.md` là thứ
     * người ĐỌC, còn prompt template và workflow là thứ agent THI HÀNH — chúng đóng vai oracle y như file
     * dữ liệu, nên cùng mức chặn.
     *
     * Đo 19/09/2026: luật cũ bỏ qua mọi `.md` nên gói `kit-2.1.1` phát ra ngoài kèm mục
     * "Hai giới hạn ĐÃ ĐO của DB NÀY" trong `prompt_templates/phase1/dimensions/23_db_persistence.md`,
     * khẳng định một bảng cụ thể không có cột audit. Người nhận ở dự án khác đọc đó là sự thật về DB
     * của họ. Sau khi khái quát hoá lại: 0 hit trên toàn bộ `prompt_templates/**` và `.agent/**`, nên bật
     * mức CHẶN không báo oan file nào đang có.
     *
     * Muốn giữ ví dụ thì khái quát hoá tên ("bảng đơn", "bảng giao dịch") — đó cũng đúng thứ luật lớp đòi.
     */
    const laGenericDoc = /^(prompt_templates|\.agent)\//.test(f.split(path.sep).join('/'));
    if (/\.md$/.test(f) && laGenericDoc) {
      for (const m of PROJECT_MARKERS) {
        if (m.re.test(body)) hits.push(`${f} — lớp GENERIC (prompt/workflow agent THI HÀNH) mang ${m.name}`);
      }
      continue;
    }
    if (/\.md$|\.example\./.test(f)) continue;
    const isData = /\.(json|ya?ml)$/i.test(f);
    for (const m of PROJECT_MARKERS) {
      if (!m.re.test(body)) continue;
      if (isData) hits.push(`${f} — lớp PROJECT lọt vào gói (file DỮ LIỆU): ${m.name}`);
      else warns.push(`${f} — nhắc ${m.name} trong code/comment (cảnh báo, không chặn)`);
    }
  }
  return { hits, warns };
}

function main() {
  const argv = process.argv.slice(2);
  const outDir = path.join(REPO, (argv.indexOf('--out') >= 0 && argv[argv.indexOf('--out') + 1]) || 'dist');

  let version;
  try { version = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).version; } catch (e) { version = ''; }
  if (!version) { console.error('[package] package.json thiếu `version` — chạy `npm run version:check` trước.'); process.exit(2); }

  const files = collect();
  if (!files.length) { console.error('[package] không thu được file nào — danh sách KEEP sai?'); process.exit(2); }

  // Kiểm gói HỤT: những file GENERIC mà thiếu thì người nhận không chạy nổi.
  const MUST = ['package.json', 'package-lock.json', 'playwright.config.js', 'tsconfig.json', 'eslint.config.js',
    'README.md', 'CLAUDE.md', 'RULE_GLOBAL.md', 'CHANGELOG.md', '.agent/config/kit-layers.md',
    '.agent/config/verdict_taxonomy.json', 'knowledge/SCHEMA.md', 'profiles/task.env.example', '.env.example'];
  const missing = MUST.filter((f) => !files.includes(f));

  // Dựng staging rồi nén — tar theo danh sách file để không lẫn thứ khác.
  fs.mkdirSync(outDir, { recursive: true });
  const stage = fs.mkdtempSync(path.join(require('os').tmpdir(), 'kitpkg-'));
  const rootName = `kit-${version}`;
  for (const f of files) {
    const dst = path.join(stage, rootName, f);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(REPO, f), dst);
  }

  // QUÉT LẠI CHÍNH GÓI (trên staging, trước khi nén — phát hiện thì không có gói nào ra đời).
  const { hits: leaks, warns: markerWarns } = scanPackage(path.join(stage, rootName), files);

  const outFile = path.join(outDir, `${rootName}.tar.gz`);
  if (!leaks.length) {
    /*
     * `-f` phải là TÊN FILE TƯƠNG ĐỐI, chạy với cwd = outDir. Truyền đường dẫn Windows tuyệt đối thì GNU tar
     * hiểu `D:` là HOST TỪ XA (cú pháp rsh cũ) và báo "Cannot connect to D: resolve failed". Cách này chạy
     * đúng với cả GNU tar (git-bash, runner Linux) lẫn bsdtar, không cần cờ `--force-local`.
     */
    execFileSync('tar', ['-czf', `${rootName}.tar.gz`, '-C', stage, rootName], { cwd: outDir, stdio: ['ignore', 'pipe', 'pipe'] });
  }
  const bytes = leaks.length ? 0 : fs.statSync(outFile).size;
  fs.rmSync(stage, { recursive: true, force: true });

  console.log(`[package] ${files.length} file · ${(bytes / 1048576).toFixed(2)} MB · ${rel(outFile)}`);
  if (missing.length) console.log(`[package] ⚠ GENERIC còn thiếu trong gói (nêu ra để người quyết, KHÔNG tự thêm): ${missing.join(', ')}`);
  if (markerWarns.length) {
    console.log(`[package] ⚠ ${markerWarns.length} file code/comment còn nhắc tên bảng/host của dự án (không chặn):`);
    markerWarns.slice(0, 8).forEach((w) => console.log(`    ~ ${w}`));
  }

  if (leaks.length) {
    if (fs.existsSync(outFile)) fs.rmSync(outFile);
    console.log('\n[package] ✗ GÓI BẨN — đã KHÔNG tạo file. Secret/PII tìm thấy:');
    leaks.slice(0, 20).forEach((h) => console.log(`  - ${h}`));
    console.log('\n[package] BLOCK.');
    process.exit(1);
  }
  if (missing.length) { console.log('\n[package] ✗ THIẾU file GENERIC bắt buộc.'); process.exit(1); }
  console.log('\n[package] ✓ ĐẠT');
  process.exit(0);
}

module.exports = { collect, scanPackage, KEEP_DIRS, KEEP_FILES, DENY };
if (require.main === module) main();
