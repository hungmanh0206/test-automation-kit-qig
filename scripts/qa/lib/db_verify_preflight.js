/*
 * db_verify_preflight.js — CHẶN Ở CỬA VÀO cho tầng kiểm dữ liệu DB (§23), thay vì để lỗi nổ lúc chạy test.
 *
 * VÌ SAO CÓ FILE NÀY. Đo 28/08/2026: `.agent/config/db.conventions.json` KHÔNG được tham chiếu ở đâu ngoài
 * `tests/support/setup/db/config.ts` + `guard.ts`. Nghĩa là task khai dùng §23 mà thiếu config, thiếu creds,
 * hoặc trỏ vào host sai thì chỉ biết khi spec đã chạy tới — muộn, và thông điệp lúc đó là lỗi kỹ thuật
 * ("cannot read property of undefined") chứ không phải "bạn thiếu input". Đúng loại lỗ hổng mà preflight tồn
 * tại để bịt.
 *
 * CHỈ KIỂM KHI TASK KHAI DÙNG. Kiểm vô điều kiện là chặn oan mọi task không đụng DB — và một gate chặn oan
 * thì bị tắt sau hai lần, rồi mất luôn tác dụng thật.
 *
 * TÁCH TĨNH / SỐNG:
 *   - `checkDbVerifyStatic` sync, không mạng → gọi được từ `runPreflight` (harness hook cũng gọi hàm đó).
 *   - `checkDbReadonlyLive` async, có mạng → chỉ CLI gọi. Bằng chứng read-only là thứ phải ĐO, không phải
 *     thứ tin theo tên user.
 */
const fs = require('fs');
const path = require('path');

const DB_CONV = '.agent/config/db.conventions.json';
const DB_CRED_KEYS = ['HOST', 'NAME', 'USERNAME', 'PASSWORD'];
/** Quyền đủ để ĐỔI dữ liệu. Giữ khớp với `WRITE_PRIVILEGES` ở tests/support/setup/db/types.ts. */
const WRITE_PRIVILEGES = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'];

/**
 * Task có KHAI dùng §23 không? Hai nguồn khai: manifest chiều, và tag `[DbPersist]` trong testcase .md.
 * @param {string} root gốc repo
 * @param {{task:string, projectOutputDir:string, testcaseDirs?:Function}} o
 */
function detectDbVerifyDeclared(root, { task, projectOutputDir, testcaseDirs = null }) {
  if (!task || !projectOutputDir) return { declared: false, why: '' };
  const taskDir = path.resolve(root, projectOutputDir, 'tasks', task);

  const man = path.join(taskDir, 'requirements', 'dimension_manifest.json');
  if (fs.existsSync(man)) {
    try {
      const m = JSON.parse(fs.readFileSync(man, 'utf8'));
      const d = (m.dimensions || {}).db_persistence;
      if (d === 'required' || d === true || (d && typeof d === 'object' && d.required)) {
        return { declared: true, why: 'dimension_manifest khai db_persistence = required' };
      }
    } catch (e) { /* manifest hỏng: bước parse JSON của preflight đã chặn riêng */ }
  }

  const dirs = testcaseDirs ? testcaseDirs(taskDir) : [path.join(taskDir, 'test-cases')];
  for (const d of dirs) {
    let files = [];
    try { files = fs.readdirSync(d).filter((f) => /\.md$/i.test(f)); } catch (e) { continue; }
    for (const f of files) {
      // Chỉ đọc .md — .xlsx là nhị phân, bản canonical đã có gate riêng của nó.
      try {
        if (/\[DbPersist\]/i.test(fs.readFileSync(path.join(d, f), 'utf8'))) {
          return { declared: true, why: `testcase ${f} có tag [DbPersist]` };
        }
      } catch (e) { /* file không đọc được: bỏ qua, không phán */ }
    }
  }
  return { declared: false, why: '' };
}

/**
 * Kiểm TĨNH cấu hình DB verify. Hàm thuần theo nghĩa: mọi I/O đi qua tham số tiêm được nên test được.
 * @returns {{problems:string[], warnings:string[]}}
 */
function checkDbVerifyStatic(root, { task, declared, why, readFile = null, exists = null }) {
  if (!declared) return { problems: [], warnings: [] };
  const rd = readFile || ((f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null));
  const ex = exists || ((f) => fs.existsSync(f));
  const problems = [];
  const warnings = [];

  const convPath = path.resolve(root, DB_CONV);
  let conv = null;
  if (!ex(convPath)) {
    problems.push(`DB verify: task khai dùng §23 (${why}) nhưng THIẾU ${DB_CONV} — không có quy ước thì mọi kết luận từ DB là đoán.`);
  } else {
    try { conv = JSON.parse(rd(convPath)); } catch (e) { problems.push(`DB verify: PARSE_FAILURE ${DB_CONV} (${e.message})`); }
  }

  if (conv) {
    if (!conv.softDelete || !conv.softDelete.default) problems.push(`DB verify: ${DB_CONV} thiếu softDelete.default`);
    if (!conv.idColumn) problems.push(`DB verify: ${DB_CONV} thiếu idColumn`);
    if (!conv.safety) {
      problems.push(`DB verify: ${DB_CONV} thiếu khối safety`);
    } else if (conv.safety.requireReadonlyUser === false) {
      problems.push('DB verify: safety.requireReadonlyUser = false — TẮT lớp bảo vệ chính. "UAT non-destructive + DB read-only" là non-negotiable của kit; muốn đổi thì sửa CLAUDE.md trước, không tắt lặng lẽ ở config.');
    }
    if (!Object.keys((conv.fieldMap || {}).byScreen || {}).length) {
      problems.push(`DB verify: ${DB_CONV} chưa có fieldMap.byScreen — chưa neo cột nào thì KHÔNG được phán bằng DB. Đoán sai cột thì kết luận vẫn ra, lại CÓ SỐ từ DB nên trông thuyết phục hơn bug ma thường.`);
    }
  }

  // Creds ở profiles/<TASK>/task.env. KHÔNG in giá trị — chỉ nói thiếu khoá nào.
  const envPath = path.resolve(root, 'profiles', task, 'task.env');
  const raw = rd(envPath);
  if (raw === null) {
    problems.push(`DB verify: THIẾU profiles/${task}/task.env — creds DB phải nằm ở task.env, KHÔNG ở .env chung (luật isolation của kit).`);
    return { problems, warnings };
  }

  const miss = DB_CRED_KEYS.filter((k) => !new RegExp(`^LIB_MASTER_DB_RO_${k}=\\S`, 'm').test(raw));
  if (miss.length) problems.push(`DB verify: task.env thiếu ${miss.map((k) => `LIB_MASTER_DB_RO_${k}`).join(', ')}`);

  const host = String(((raw.match(/^LIB_MASTER_DB_RO_HOST=(.*)$/m) || [])[1] || '')).trim();
  const user = String(((raw.match(/^LIB_MASTER_DB_RO_USERNAME=(.*)$/m) || [])[1] || '')).trim();

  if (host && conv && conv.safety) {
    for (const bad of conv.safety.denyHostPatterns || []) {
      if (host.toLowerCase().includes(String(bad).toLowerCase())) {
        problems.push(`DB verify: HOST "${host}" khớp denyHostPatterns "${bad}" — CẤM trỏ tầng kiểm dữ liệu vào môi trường đó.`);
      }
    }
    const allow = conv.safety.allowedHosts || [];
    if (allow.length && !allow.includes(host)) {
      problems.push(`DB verify: HOST "${host}" không có trong safety.allowedHosts (${allow.join(', ')}) — thêm host có chủ ý, đừng để lọt host lạ.`);
    }
  }

  /*
   * Tên user KHÔNG chứng minh được quyền, chỉ là dấu hiệu — nên CẢNH BÁO, không CHẶN. Chặn theo tên là chặn
   * theo phỏng đoán, và một role read-only đặt tên khác quy ước sẽ bị chặn oan. Bằng chứng thật: đọc quyền.
   */
  if (user && !/readonly|read_only|_ro(_|$)/i.test(user)) {
    warnings.push(`DB verify: user "${user}" không có dấu hiệu read-only trong tên — đó KHÔNG phải bằng chứng; để phép đọc quyền chạy (đừng dùng --skip-db-live).`);
  }

  return { problems, warnings };
}

/**
 * Suy kết luận từ các dòng quyền đọc được. Hàm THUẦN — test được không cần DB.
 * @param {{privilege_type:string, n:number}[]} rows
 */
function readonlyVerdictFromRows(rows, user) {
  if (!rows || !rows.length) {
    return [`DB verify (live): user "${user}" KHÔNG đọc được dòng quyền nào ⇒ PHÉP ĐO HỎNG, không phải "sạch". Không kết luận read-only.`];
  }
  const bad = rows.filter((x) => WRITE_PRIVILEGES.includes(String(x.privilege_type).toUpperCase()));
  if (bad.length) {
    return [`DB verify (live): user "${user}" CÓ quyền ghi (${bad.map((x) => `${x.privilege_type}=${x.n} bảng`).join(', ')}) — tầng kiểm dữ liệu bắt buộc read-only. Xin DBA cấp role chỉ SELECT.`];
  }
  return [];
}

/**
 * BẰNG CHỨNG read-only SỐNG. Không kết nối được ⇒ VẪN CHẶN: task cần §23 mà không tới được DB thì không
 * chạy được, và "không phán được" KHÔNG thành PASS. Đường thoát tường minh: `--skip-db-live`.
 */
async function checkDbReadonlyLive(root, { task, clientFactory = null }) {
  const envPath = path.resolve(root, 'profiles', task, 'task.env');
  if (!fs.existsSync(envPath)) return [`DB verify (live): không thấy profiles/${task}/task.env`];
  const raw = fs.readFileSync(envPath, 'utf8');
  const v = (k) => String(((raw.match(new RegExp(`^LIB_MASTER_DB_RO_${k}=(.*)$`, 'm')) || [])[1] || '')).trim();
  const cfg = { host: v('HOST'), port: Number(v('PORT') || 5432), database: v('NAME'), user: v('USERNAME'), password: v('PASSWORD') };
  if (!cfg.host || !cfg.user) return ['DB verify (live): thiếu HOST/USERNAME nên không đọc được quyền'];

  let make = clientFactory;
  if (!make) {
    let Client;
    try { ({ Client } = require('pg')); } catch (e) { return ['DB verify (live): không nạp được module pg']; }
    make = (c) => new Client({ ...c, connectionTimeoutMillis: 6000, statement_timeout: 6000, ssl: false });
  }
  const client = make(cfg);
  try {
    await client.connect();
    const r = await client.query("SELECT privilege_type, COUNT(*)::int n FROM information_schema.role_table_grants WHERE grantee = current_user AND table_schema = 'public' GROUP BY 1");
    return readonlyVerdictFromRows(r.rows, cfg.user);
  } catch (e) {
    return [`DB verify (live): không kết nối được ${cfg.host}/${cfg.database} (${e.message}). Task khai dùng §23 nên đây là CHẶN — bật VPN rồi chạy lại, hoặc --skip-db-live nếu cố ý bỏ qua phép đo này.`];
  } finally {
    try { await client.end(); } catch (e) { /* đã đóng */ }
  }
}

module.exports = { detectDbVerifyDeclared, checkDbVerifyStatic, checkDbReadonlyLive, readonlyVerdictFromRows, DB_CONV, WRITE_PRIVILEGES };
