import { DbGuardError, WRITE_PRIVILEGES, type GrantRow } from './types';

/*
 * guard.ts — CHỨNG MINH USER LÀ READ-ONLY, bằng cách ĐỌC QUYỀN chứ không thử ghi.
 *
 * VÌ SAO KHÔNG THỬ GHI (đã đo, 27/08/2026):
 *  - `CREATE TEMP TABLE` KHÔNG chứng minh được gì trên Postgres: quyền `TEMPORARY` mặc định được GRANT cho
 *    `PUBLIC` trên mọi database, nên một role CHỈ có SELECT vẫn tạo temp table thành công. Dùng nó làm probe
 *    ⇒ cấu hình ĐÚNG lại bị từ chối, và người dùng sẽ quay về user full quyền — tức probe đẩy người ta về
 *    đúng chỗ nguy hiểm. (`SELECT 1 INTO #tmp` của MSSQL cùng vấn đề.)
 *  - Thử ghi vào bảng THẬT thì khi user có quyền, probe đã MUTATE UAT — trái luật "xác nhận trước mỗi lượt
 *    chạm UAT".
 * Đọc catalog thì dứt khoát VÀ định lượng. Đo thật trên `một DB UAT thật`: user `uat_app_user` có
 * INSERT/UPDATE/DELETE/TRUNCATE trên **232 bảng** — con số đó DBA sửa được ngay, khác hẳn "probe ghi được".
 */

/*
 * Tập quyền ghi nay khai ở `types.ts` (một nguồn) và adapter phải chuẩn hoá về tập đó — xem ghi chú
 * `TỪ VỰNG QUYỀN` ở types.ts. Khai lại ở đây là mở đường cho hai bản trôi khỏi nhau.
 */
export { WRITE_PRIVILEGES };

export interface ReadOnlyProof {
  readonly: boolean;
  /** Quyền ghi tìm thấy, gộp theo loại: `{ INSERT: 232, DELETE: 232 }`. */
  writeGrants: Record<string, number>;
  /** Bảng có quyền ghi — cắt còn tối đa 10 tên để thông điệp không thành bãi text. */
  sampleTables: string[];
  totalGrantRows: number;
}

/**
 * Suy ra bằng chứng read-only từ danh sách grant. Hàm THUẦN — test được không cần DB.
 * `scope` (tuỳ chọn): chỉ xét những bảng này. Không truyền ⇒ xét toàn bộ grant đọc được.
 */
export function proveReadOnlyFromGrants(grants: GrantRow[], scope?: string[]): ReadOnlyProof {
  const inScope = scope && scope.length
    ? grants.filter((g) => scope.includes(g.table))
    : grants;
  const writeGrants: Record<string, number> = {};
  const tables = new Set<string>();
  for (const g of inScope) {
    const p = String(g.privilege || '').toUpperCase();
    if (!(WRITE_PRIVILEGES as readonly string[]).includes(p)) continue;
    writeGrants[p] = (writeGrants[p] || 0) + 1;
    tables.add(g.table);
  }
  return {
    readonly: Object.keys(writeGrants).length === 0,
    writeGrants,
    sampleTables: [...tables].sort().slice(0, 10),
    totalGrantRows: inScope.length,
  };
}

/**
 * CHẶN nếu user không phải read-only. Thông điệp phải đủ để DBA hành động ngay: quyền nào, bao nhiêu bảng,
 * và câu SQL tạo role đúng — chứ không phải "hãy dùng read-only user".
 */
export function assertReadOnly(proof: ReadOnlyProof, ctx: { database?: string; user?: string } = {}): void {
  if (proof.readonly) {
    if (proof.totalGrantRows === 0) {
      throw new DbGuardError(
        'Không đọc được dòng quyền nào từ catalog ⇒ KHÔNG kết luận "read-only". '
        + 'Phép đo hỏng (sai schema/không đủ quyền đọc catalog) chứ không phải bằng chứng an toàn.',
      );
    }
    return;
  }
  const who = [ctx.user && `user "${ctx.user}"`, ctx.database && `database "${ctx.database}"`].filter(Boolean).join(' · ');
  const detail = Object.entries(proof.writeGrants).sort().map(([p, n]) => `${p}=${n} bảng`).join(' · ');
  throw new DbGuardError(
    `TỪ CHỐI nối tầng kiểm DB: ${who || 'user hiện tại'} CÓ QUYỀN GHI (${detail}).\n`
    + `  Bảng ví dụ: ${proof.sampleTables.join(', ')}${proof.sampleTables.length >= 10 ? ' …' : ''}\n`
    + '  Đây là điều kiện tiên quyết, không phải cảnh báo: guard trong code chỉ bảo vệ khi code chạy đúng,\n'
    + '  còn quyền DB bảo vệ cả khi ai đó gọi trực tiếp bằng psql/DBeaver.\n'
    + '  Xin DBA cấp login chỉ đọc (T-SQL / SQL Server):\n'
    + '    CREATE LOGIN [<ten>_readonly] WITH PASSWORD = \'<...>\';\n'
    + `    USE [${ctx.database || '<db>'}];\n`
    + '    CREATE USER [<ten>_readonly] FOR LOGIN [<ten>_readonly];\n'
    + '    ALTER ROLE db_datareader ADD MEMBER [<ten>_readonly];\n'
    + '    -- KHÔNG thêm vào db_datawriter / db_ddladmin / db_owner.\n'
    + '    DENY INSERT, UPDATE, DELETE, ALTER, CONTROL TO [<ten>_readonly];',
  );
}

/*
 * LINT CÂU TRUY VẤN. Bản Postgres gọi đây là lớp PHỤ (lớp chính là quyền DB + transaction READ ONLY).
 * Sau khi chuyển sang SQL Server (24/09/2026) điều đó KHÔNG còn đúng: T-SQL không có transaction
 * read-only, và `requireReadonlyUser` đang TẮT — nên đây là lớp chặn CHÍNH. Giữ tinh thần `assertReadOnlySql` của
 * `uatDbClient.ts`: chỉ cho câu ĐỌC, chặn stacked query và các hàm đọc/ghi file, admin.
 */
const READ_HEAD = /^\s*(select|with|explain|show|table)\b/i;
/*
 * T-SQL không có "transaction READ ONLY" như Postgres — SET TRANSACTION ISOLATION LEVEL chỉ đổi mức khoá,
 * KHÔNG chặn ghi. Nghĩa là với SQL Server, lint này là lớp chặn CHÍNH, không phải lớp phụ. Nên danh sách
 * dưới đây phải phủ cả họ thủ tục hệ thống của SQL Server (`xp_*`, `sp_*`), đường ghi file (`openrowset`,
 * `bulk insert`, `opendatasource`), và `into` của `SELECT … INTO <bảng mới>` (tạo bảng thật).
 */
const DANGEROUS_TOKEN = /\b(insert|update|delete|truncate|drop|alter|create|grant|revoke|deny|copy|vacuum|reindex|call|do|merge|replace|backup|restore|shutdown|reconfigure|checkpoint|dbcc|waitfor|load_file|outfile|dumpfile|openrowset|opendatasource|openquery|openxml|bulk\s+insert|xp_[a-z_]+|sp_[a-z_]+|fn_trace_[a-z_]+)\b/i;
/** `SELECT … INTO <bảng>` tạo bảng mới — READ_HEAD không bắt được vì câu vẫn bắt đầu bằng SELECT. */
const SELECT_INTO = /\binto\s+(?!@)[\[#a-z_]/i;

export function assertReadOnlyQuery(sql: string): void {
  const raw = String(sql || '');
  const s = raw.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
  if (!READ_HEAD.test(s)) throw new DbGuardError(`Câu truy vấn không bắt đầu bằng SELECT/WITH/EXPLAIN/SHOW/TABLE: "${raw.slice(0, 60)}…"`);
  // Stacked query: `;` ở giữa (bỏ qua `;` cuối câu) — đường kinh điển để giấu một câu ghi.
  if (/;\s*\S/.test(s.trim())) throw new DbGuardError('Nhiều statement trong một câu (stacked query) — không cho.');
  const hit = DANGEROUS_TOKEN.exec(s);
  if (hit) throw new DbGuardError(`Câu truy vấn chứa từ khoá ghi/nguy hiểm: "${hit[0]}".`);
  if (SELECT_INTO.test(s)) {
    throw new DbGuardError('Câu truy vấn có `SELECT … INTO <bảng>` — tạo bảng thật, không phải câu đọc.');
  }
}

/*
 * HOST GUARD — allow-list + deny-pattern. Giữ nguyên hành vi `assertHostGuards` của `uatDbClient.ts`:
 * bỏ trống thì KHÔNG áp (để không phá cấu hình cũ), nhưng deny-pattern có giá trị thì áp cả host và dbname.
 */
export function assertHostAllowed(
  target: { host: string; database: string },
  cfg: { allowedHosts?: string[]; denyHostPatterns?: string[] } = {},
): void {
  const host = String(target.host || '').toLowerCase();
  const db = String(target.database || '').toLowerCase();
  const allow = (cfg.allowedHosts || []).filter(Boolean).map((h) => h.toLowerCase());
  const deny = (cfg.denyHostPatterns || []).filter(Boolean).map((p) => p.toLowerCase());
  if (allow.length && !allow.some((h) => host === h || host.endsWith(h))) {
    throw new DbGuardError(`Host "${target.host}" không nằm trong allowlist (${allow.join(', ')}).`);
  }
  const hit = deny.find((p) => host.includes(p) || db.includes(p));
  if (hit) throw new DbGuardError(`Host/DB khớp mẫu bị CHẶN: "${hit}" (host="${target.host}", db="${target.database}").`);
}
