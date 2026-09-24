import { Connection, Request, TYPES, type ConnectionConfiguration } from 'tedious';

/**
 * Guarded READ-ONLY SQL Server client cho kho DB UAT — cửa DUY NHẤT được phép mở kết nối DB.
 *
 * (Trước 24/09/2026 file này tên `uatPgClient.ts` và dùng PostgreSQL. DB nghiệp vụ thật là **SQL Server
 * 2019** — đo bằng gói TDS pre-login trả type `0x04`, trong khi gói `SSLRequest` kiểu Postgres bị server
 * đóng kết nối. Toàn bộ tầng đã chuyển sang T-SQL; `pg` đã gỡ khỏi dependencies.)
 *
 * Vai trò: oracle PHỤ để verify/chẩn đoán khi UI/API không expose được state
 * (vd phân biệt "field trống do FE" vs "do BE", kiểm dữ liệu có persist không).
 * KHÔNG dùng để dựng/mutate state (setup precondition vẫn qua api/factory/test_hook/fixture),
 * KHÔNG phải evidence (evidence vẫn là ảnh UI), KHÔNG thay oracle từ spec.
 *
 * ⚠️ HAI ĐIỀU KHÁC HẲN BẢN POSTGRES — ĐỌC TRƯỚC KHI SỬA:
 *
 *   1. **T-SQL KHÔNG có `BEGIN TRANSACTION READ ONLY`.** Bản Postgres dựa vào chốt phía server: dù user
 *      full quyền, Postgres vẫn tự ném khi gặp câu ghi trong transaction read-only. SQL Server không có
 *      thứ tương đương (`SET TRANSACTION ISOLATION LEVEL` chỉ đổi mức khoá, không chặn ghi).
 *      ⇒ **`assertReadOnlySql` là lớp chặn DUY NHẤT trong tiến trình này.** Nới nó là mở toang.
 *
 *   2. **Account đang dùng là `dbo` (toàn quyền).** Đo 24/09/2026 trên DB nghiệp vụ UAT: login `csdl`
 *      thuộc `db_owner` + `db_datawriter` + `db_ddladmin`, có đủ INSERT/UPDATE/DELETE/ALTER/CONTROL/
 *      TAKE OWNERSHIP trên 888 bảng. Chủ dự án đã quyết giữ account này và yêu cầu "cẩn trọng khi dùng"
 *      (xem `safety.requireReadonlyUser=false` trong `.agent/config/db.conventions.json`).
 *      ⇒ Sự cẩn trọng đó phải nằm trong CODE, không nằm trong trí nhớ: mọi câu đi qua `assertReadOnlySql`.
 *
 * Các lớp còn giữ nguyên:
 *  - `SET LOCAL`-tương đương: `requestTimeout` giới hạn thời gian mỗi câu; không log password/conn string.
 *  - Chỉ đọc env `LIB_MASTER_DB_*` (không đụng `DATABASE_URL`/`SQLSERVER_*`/`TEST_DB_*`).
 *  - Tùy chọn: `LIB_MASTER_DB_ALLOWED_HOSTS` giới hạn host, `LIB_MASTER_DB_DENY_HOST_PATTERNS` chặn mẫu.
 */

/** Prefix env mặc định. DB khác dùng prefix 'LIB_MASTER_DB2', 'LIB_MASTER_DB3'… (so nhiều bản). */
export const DEFAULT_DB_PREFIX = 'LIB_MASTER_DB';
/** Env kết nối bắt buộc theo prefix — thiếu bất kỳ cái nào ⇒ coi như chưa bật (dormant). */
const requiredKeys = (prefix: string) =>
  [`${prefix}_HOST`, `${prefix}_PORT`, `${prefix}_NAME`, `${prefix}_USERNAME`, `${prefix}_PASSWORD`] as const;

export interface UatDbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  /** Tùy chọn: nếu non-empty, chỉ cho kết nối host trong danh sách. */
  allowedHosts: string[];
  /** Tùy chọn: nếu non-empty, chặn host/dbname chứa các mẫu này. */
  denyPatterns: string[];
  ssl: boolean;
  statementTimeoutMs: number;
}

/** Lỗi guard DB — nêu rõ nguyên nhân dừng (config thiếu / host không hợp lệ / query không read-only). */
export class UatDbGuardError extends Error {
  constructor(message: string) {
    super(`[uatDbClient] ${message}`);
    this.name = 'UatDbGuardError';
  }
}

function splitCsv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** true nếu đủ env kết nối để dùng DB verify (caller có thể skip gracefully nếu false). */
export function isUatDbConfigured(prefix: string = DEFAULT_DB_PREFIX): boolean {
  return requiredKeys(prefix).every((k) => (process.env[k] ?? '').trim() !== '');
}

/**
 * Đọc + validate config từ env theo prefix. Ném `UatDbGuardError` nếu thiếu env kết nối/không hợp lệ.
 * Kết nối (HOST/PORT/NAME/USERNAME/PASSWORD) lấy đúng theo prefix.
 * Guard/tuỳ chọn (ALLOWED_HOSTS/DENY_HOST_PATTERNS/SSL/STATEMENT_TIMEOUT_MS) theo prefix, fallback về LIB_MASTER_DB_*.
 */
export function loadUatDbConfig(prefix: string = DEFAULT_DB_PREFIX): UatDbConfig {
  const missing = requiredKeys(prefix).filter((k) => (process.env[k] ?? '').trim() === '');
  if (missing.length) {
    throw new UatDbGuardError(
      `Thiếu env kết nối: ${missing.join(', ')}. DB verify chỉ chạy khi đã cấu hình kho UAT.`,
    );
  }
  const opt = (suffix: string) =>
    process.env[`${prefix}_${suffix}`] ?? process.env[`${DEFAULT_DB_PREFIX}_${suffix}`];

  const port = Number.parseInt(process.env[`${prefix}_PORT`] as string, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new UatDbGuardError(`${prefix}_PORT không hợp lệ: "${process.env[`${prefix}_PORT`]}".`);
  }

  const statementTimeoutMs = Number.parseInt(opt('STATEMENT_TIMEOUT_MS') ?? '5000', 10);

  return {
    host: (process.env[`${prefix}_HOST`] as string).trim(),
    port,
    database: (process.env[`${prefix}_NAME`] as string).trim(),
    user: (process.env[`${prefix}_USERNAME`] as string).trim(),
    password: process.env[`${prefix}_PASSWORD`] as string,
    allowedHosts: splitCsv(opt('ALLOWED_HOSTS')),
    denyPatterns: splitCsv(opt('DENY_HOST_PATTERNS')),
    ssl: (opt('SSL') ?? '').trim().toLowerCase() === 'true',
    statementTimeoutMs:
      Number.isInteger(statementTimeoutMs) && statementTimeoutMs > 0 ? statementTimeoutMs : 5000,
  };
}

/**
 * Guard host tùy chọn: chỉ áp khi bạn tự cấu hình allowlist/deny.
 * Bỏ trống cả hai ⇒ không áp (rào chính là credential kho UAT).
 */
export function assertHostGuards(cfg: UatDbConfig): void {
  const host = cfg.host.toLowerCase();
  const db = cfg.database.toLowerCase();

  if (cfg.allowedHosts.length && !cfg.allowedHosts.includes(host)) {
    throw new UatDbGuardError(
      `Host "${cfg.host}" không nằm trong LIB_MASTER_DB_ALLOWED_HOSTS (${cfg.allowedHosts.join(', ')}).`,
    );
  }
  const hit = cfg.denyPatterns.find((p) => host.includes(p) || db.includes(p));
  if (hit) {
    throw new UatDbGuardError(
      `Host/DB khớp mẫu chặn "${hit}" trong LIB_MASTER_DB_DENY_HOST_PATTERNS. (host="${cfg.host}", db="${cfg.database}")`,
    );
  }
}

/**
 * Hàm/keyword nguy hiểm của SQL Server. Bản Postgres liệt kê `pg_read_file`/`lo_export`/`dblink`…; T-SQL có
 * họ khác hẳn: thủ tục hệ thống `xp_*`/`sp_*` (đặc biệt `xp_cmdshell`), đường đọc-ghi file
 * (`openrowset`, `opendatasource`, `bulk insert`), lệnh quản trị (`dbcc`, `backup`, `restore`,
 * `reconfigure`, `shutdown`) và `waitfor delay` (đường làm treo kết nối).
 */
const DANGEROUS_TOKEN =
  /\b(xp_[a-z0-9_]+|sp_[a-z0-9_]+|fn_trace_[a-z0-9_]+|openrowset|opendatasource|openquery|openxml|bulk\s+insert|dbcc|backup|restore|shutdown|reconfigure|checkpoint|waitfor|kill)\b/i;

/**
 * Lint read-only. **Với SQL Server đây là lớp chặn CHÍNH** (không có transaction READ ONLY phía server),
 * nên đừng nới. Chỉ cho câu ĐỌC, chặn stacked query, `SELECT … INTO`, và họ thủ tục hệ thống.
 */
export function assertReadOnlySql(sql: string): void {
  const trimmed = String(sql || '').trim();
  if (!trimmed) throw new UatDbGuardError('Query rỗng.');

  // Bỏ comment trước khi soi, tránh giấu từ khoá trong `/* */`.
  const s = trimmed.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');

  const readStart = /^(?:\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)*(select|with|values)\b/i;
  if (!readStart.test(trimmed)) {
    throw new UatDbGuardError('Chỉ cho phép câu đọc bắt đầu bằng SELECT/WITH/VALUES (read-only verify).');
  }
  // `SELECT … INTO <bảng>` tạo bảng THẬT mà vẫn bắt đầu bằng SELECT — readStart không bắt được.
  if (/\binto\s+(?!@)[\[#a-z_]/i.test(s)) {
    throw new UatDbGuardError('Không cho phép `SELECT … INTO <bảng>` (tạo bảng thật, không phải câu đọc).');
  }
  // Từ khoá ghi/DDL.
  if (/\b(insert|update|delete|truncate|drop|alter|create|grant|revoke|deny|merge|exec|execute)\b/i.test(s)) {
    const bad = s.match(/\b(insert|update|delete|truncate|drop|alter|create|grant|revoke|deny|merge|exec|execute)\b/i);
    throw new UatDbGuardError(`Không cho phép từ khoá ghi/DDL "${bad?.[1]}".`);
  }
  const bad = s.match(DANGEROUS_TOKEN);
  if (bad) {
    throw new UatDbGuardError(`Không cho phép hàm/keyword nguy hiểm "${bad[1]}" (thủ tục hệ thống, đọc/ghi file hoặc quản trị).`);
  }
  // Chặn nhiều statement (ngăn stacked write): chỉ cho phép 1 dấu ; ở cuối.
  const withoutTrailing = s.trim().replace(/;\s*$/, '');
  if (withoutTrailing.includes(';')) {
    throw new UatDbGuardError('Không cho phép nhiều statement trong một query (chống stacked query).');
  }
}

/** Suy kiểu tedious từ giá trị JS — tedious BẮT BUỘC khai kiểu cho tham số, không như `pg`. */
function addParam(req: Request, name: string, v: unknown): void {
  if (v === null || v === undefined) { req.addParameter(name, TYPES.NVarChar, null); return; }
  if (typeof v === 'number') {
    if (Number.isInteger(v)) req.addParameter(name, TYPES.BigInt, v);
    else req.addParameter(name, TYPES.Float, v);
    return;
  }
  if (typeof v === 'boolean') { req.addParameter(name, TYPES.Bit, v); return; }
  if (v instanceof Date) { req.addParameter(name, TYPES.DateTime2, v); return; }
  if (typeof v === 'bigint') { req.addParameter(name, TYPES.BigInt, v.toString()); return; }
  // NVarChar chứ không VarChar: DB này toàn cột `nvarchar`, dùng VarChar là mất dấu tiếng Việt.
  req.addParameter(name, TYPES.NVarChar, String(v));
}

/**
 * Chạy MỘT câu SELECT read-only trên kho DB UAT, trả về `rows`.
 * Guard chạy trước; kết nối mở/đóng theo từng lần gọi (verify tần suất thấp).
 *
 * Tham số đánh tên `@p1, @p2…` theo thứ tự trong mảng `params` (T-SQL không có `$1`).
 */
export async function queryUatReadonly<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  opts: { dbPrefix?: string } = {},
): Promise<T[]> {
  assertReadOnlySql(sql);
  const cfg = loadUatDbConfig(opts.dbPrefix ?? DEFAULT_DB_PREFIX);
  assertHostGuards(cfg);

  const connCfg: ConnectionConfiguration = {
    server: cfg.host,
    authentication: { type: 'default', options: { userName: cfg.user, password: cfg.password } },
    options: {
      port: cfg.port,
      database: cfg.database,
      encrypt: cfg.ssl,
      trustServerCertificate: true,
      connectTimeout: 15_000,
      requestTimeout: cfg.statementTimeoutMs,
      rowCollectionOnRequestCompletion: true,
    },
  };

  const connection: Connection = await new Promise((resolve, reject) => {
    const c = new Connection(connCfg);
    c.on('connect', (err) => (err ? reject(err) : resolve(c)));
    c.on('error', (err) => reject(err));
    c.connect();
  });

  // Audit: chỉ host/db/user, KHÔNG bao giờ log password/connection string.
  // eslint-disable-next-line no-console
  console.log(`[uatDbClient] connected UAT host=${cfg.host} db=${cfg.database} user=${cfg.user} (read-only lint)`);

  try {
    return await new Promise<T[]>((resolve, reject) => {
      const rows: T[] = [];
      const req = new Request(sql, (err) => (err ? reject(err) : resolve(rows)));
      params.forEach((v, idx) => addParam(req, `p${idx + 1}`, v));
      req.on('row', (cols: { value: unknown; metadata: { colName: string } }[]) => {
        const o: Record<string, unknown> = {};
        for (const col of cols) o[col.metadata.colName] = col.value;
        rows.push(o as T);
      });
      connection.execSql(req);
    });
  } finally {
    await new Promise<void>((resolve) => {
      connection.on('end', () => resolve());
      connection.close();
    });
  }
}
