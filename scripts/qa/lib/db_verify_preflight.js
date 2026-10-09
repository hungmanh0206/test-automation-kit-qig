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
/**
 * Quyền đủ để ĐỔI dữ liệu. Giữ khớp với `WRITE_PRIVILEGES` ở tests/support/setup/db/types.ts.
 * ALTER/CONTROL có trong danh sách vì T-SQL không có quyền đối tượng tên TRUNCATE — `TRUNCATE TABLE`
 * chỉ cần ALTER, còn CONTROL bao trùm mọi quyền. Thiếu hai cái này thì user `db_ddladmin` bị kết
 * luận sai là read-only.
 */
const WRITE_PRIVILEGES = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'ALTER', 'CONTROL'];

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
      /*
       * TẮT lớp bảo vệ chính thì mặc định là CHẶN. Nhưng có môi trường thật sự không cấp nổi login
       * chỉ-SELECT — ở đó chặn cứng khiến `self-review:enforce` đỏ vĩnh viễn, và một gate luôn đỏ thì
       * không còn báo động được gì: lần sau có chặn MỚI cũng lẫn vào đó. Nên theo đúng nếp miễn trừ kit
       * đang dùng (`gate_waiver` ở risk_gate.js, `waived` kèm lý do ở policy_source_check.js):
       * miễn trừ phải VIẾT RA ĐƯỢC thì mới tranh luận được, im lặng thì không.
       *
       * Hạ xuống cảnh báo CHỈ KHI đủ cả bốn, thiếu bất kỳ cái nào thì vẫn chặn:
       *   - `nguoi_quyet`  ai chịu trách nhiệm (không phải "team", phải là người)
       *   - `ly_do`        vì sao không cấp được login chỉ-SELECT
       *   - `bu_tru`       lớp chặn thay thế, NÊU TÊN — không nêu tên thì không ai kiểm được nó có thật
       *   - `_canh_bao`    ghi rõ rủi ro còn lại, để không ai đọc miễn trừ rồi tưởng đã an toàn
       * Cố ý KHÔNG kiểm `bu_tru` có chạy không: gate này đọc file, không chạy test. Việc đó là của
       * `tests/fe/infra/db-verify-layer.spec.ts`. Nói quá khả năng của mình cũng là một kiểu bug ma.
       */
      const w = conv.safety.waiver || null;
      const filled = (k) => !!(w && String(w[k] || '').trim());
      const thieu = ['nguoi_quyet', 'ly_do', 'bu_tru', '_canh_bao'].filter((k) => !filled(k));
      if (!w || thieu.length) {
        problems.push(
          'DB verify: safety.requireReadonlyUser = false — TẮT lớp bảo vệ chính. "UAT non-destructive + DB read-only" là non-negotiable của kit. '
          + 'Môi trường không cấp nổi login chỉ-SELECT thì khai MIỄN TRỪ CÓ CHỮ KÝ ở `safety.waiver`, đủ bốn khoá: '
          + '`nguoi_quyet` (một người, không phải "team") · `ly_do` · `bu_tru` (nêu TÊN lớp chặn thay thế) · `_canh_bao` (rủi ro còn lại). '
          + (w ? `Đang thiếu: ${thieu.join(', ')}.` : 'Hiện chưa khai gì.'),
        );
      } else {
        warnings.push(
          `DB verify: safety.requireReadonlyUser = false — MIỄN TRỪ CÓ CHỮ KÝ, không phải đã an toàn. Người quyết: ${String(w.nguoi_quyet).slice(0, 80)}. `
          + `Lớp bù trừ: ${String(w.bu_tru).slice(0, 120)}. Rủi ro còn lại đã ghi trong config — đọc trước khi dựa vào kết luận từ DB.`,
        );
      }
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
  const cfg = { host: v('HOST'), port: Number(v('PORT') || 1433), database: v('NAME'), user: v('USERNAME'), password: v('PASSWORD') };
  if (!cfg.host || !cfg.user) return ['DB verify (live): thiếu HOST/USERNAME nên không đọc được quyền'];

  /*
   * Quyền THEO BẢNG trên SQL Server. T-SQL KHÔNG có `information_schema.role_table_grants` (bản Postgres cũ
   * dùng cái đó) — quyền hiệu lực, kể cả kế thừa qua role như `db_owner`, chỉ đọc đúng bằng
   * `fn_my_permissions(<đối tượng>, 'OBJECT')`. Gộp ngay trong SQL để không kéo về hàng nghìn dòng.
   */
  const SQL = `SELECT p.permission_name AS privilege_type, COUNT(*) AS n
      FROM sys.tables t
      JOIN sys.schemas s ON s.schema_id = t.schema_id
      CROSS APPLY fn_my_permissions(QUOTENAME(s.name) + '.' + QUOTENAME(t.name), 'OBJECT') p
      GROUP BY p.permission_name`;

  if (clientFactory) {
    // Đường tiêm cho test: factory trả { connect, query, end } tối giản.
    const client = clientFactory(cfg);
    try {
      await client.connect();
      const r = await client.query(SQL);
      return readonlyVerdictFromRows(r.rows, cfg.user);
    } catch (e) {
      return [`DB verify (live): không kết nối được ${cfg.host}/${cfg.database} (${e.message}). Task khai dùng §23 nên đây là CHẶN — bật VPN rồi chạy lại, hoặc --skip-db-live nếu cố ý bỏ qua phép đo này.`];
    } finally {
      try { await client.end(); } catch (e) { /* đã đóng */ }
    }
  }

  let tedious;
  try { tedious = require('tedious'); } catch (e) { return ['DB verify (live): không nạp được module tedious']; }

  return new Promise((resolve) => {
    const conn = new tedious.Connection({
      server: cfg.host,
      authentication: { type: 'default', options: { userName: cfg.user, password: cfg.password } },
      options: {
        port: cfg.port,
        database: cfg.database,
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 10000,
        requestTimeout: 20000,
        rowCollectionOnRequestCompletion: true,
      },
    });
    const done = (out) => { try { conn.close(); } catch (e) { /* đã đóng */ } resolve(out); };
    conn.on('connect', (err) => {
      if (err) {
        return done([`DB verify (live): không kết nối được ${cfg.host}/${cfg.database} (${err.message}). Task khai dùng §23 nên đây là CHẶN — bật VPN rồi chạy lại, hoặc --skip-db-live nếu cố ý bỏ qua phép đo này.`]);
      }
      const rows = [];
      const req = new tedious.Request(SQL, (e) => {
        if (e) return done([`DB verify (live): đọc quyền thất bại (${e.message}).`]);
        done(readonlyVerdictFromRows(rows, cfg.user));
      });
      req.on('row', (cols) => {
        const o = {};
        for (const c of cols) o[c.metadata.colName] = c.value;
        rows.push(o);
      });
      conn.execSql(req);
    });
    conn.on('error', (err) => done([`DB verify (live): lỗi kết nối ${cfg.host} (${err.message}).`]));
    conn.connect();
  });
}

module.exports = { detectDbVerifyDeclared, checkDbVerifyStatic, checkDbReadonlyLive, readonlyVerdictFromRows, DB_CONV, WRITE_PRIVILEGES };
