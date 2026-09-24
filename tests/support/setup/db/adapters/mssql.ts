import { Connection, Request, TYPES, type ConnectionConfiguration } from 'tedious';
import { assertHostAllowed, assertReadOnlyQuery, proveReadOnlyFromGrants, assertReadOnly } from '../guard';
import { DbGuardError, type DbClient, type GrantRow, type QueryOpts, type Row, type Where, type WhereOp, normalizePrivilege } from '../types';
import type { DbConnection, DbConventions } from '../config';

/*
 * adapters/mssql.ts — dịch `Where` (ngữ nghĩa) sang T-SQL, và giữ các lớp bảo vệ.
 *
 * ĐÂY LÀ BẢN THAY THẾ `adapters/postgres.ts` (bỏ 24/09/2026). DB nghiệp vụ thật là **SQL Server 2019**
 * (DB nghiệp vụ UAT), không phải PostgreSQL — đo bằng gói TDS pre-login trả type `0x04`, còn gói
 * `SSLRequest` kiểu Postgres thì server đóng kết nối.
 *
 * KHÁC BIỆT QUAN TRỌNG SO VỚI BẢN POSTGRES — đọc trước khi sửa:
 *
 *   1. **KHÔNG có `SET default_transaction_read_only`.** Postgres có chốt ở mức SESSION khiến server tự ném
 *      khi gặp câu ghi, kể cả superuser. T-SQL KHÔNG có thứ tương đương: `SET TRANSACTION ISOLATION LEVEL`
 *      chỉ đổi mức khoá, `SET TRANSACTION READ ONLY` không tồn tại. Hệ quả: với SQL Server, **lint câu truy
 *      vấn (`assertReadOnlyQuery`) là lớp chặn CHÍNH, không phải lớp phụ.** Vì thế mọi câu — kể cả câu do
 *      adapter tự sinh — đều phải đi qua `run()`, và `run()` lint vô điều kiện. Đừng thêm đường tắt.
 *
 *   2. **Định danh bọc `[...]`, tham số `@pN`.** Postgres dùng `"..."` và `$N`. tedious bắt buộc khai KIỂU
 *      cho từng tham số, nên có `addParam()` suy kiểu từ giá trị JS.
 *
 *   3. **`SELECT TOP (n)` thay cho `LIMIT n`.** T-SQL không có LIMIT. `TOP` phải đứng ngay sau SELECT nên
 *      `selectSql()` dựng câu theo thứ tự khác bản Postgres.
 *
 *   4. **Không có quyền đối tượng tên `TRUNCATE`.** `TRUNCATE TABLE` chỉ cần `ALTER`. Xem ghi chú
 *      `WRITE_PRIVILEGES` ở `types.ts` — thiếu điều này thì user `db_ddladmin` bị kết luận sai là read-only.
 *
 *   5. **`TRUE`/`FALSE` không phải hằng boolean trong T-SQL** — dùng `(1=1)` / `(1=0)`.
 *
 * `SELECT *` KHÔNG được khuyến khích: `opts.columns` nên khai khi bảng có PII. Không lấy về thì không có
 * đường lộ qua log/screenshot — mạnh hơn và rẻ hơn là sanitize sau.
 */

const IDENT = /^[a-z_][a-z0-9_$]*$/i;

/** Chặn SQL injection qua TÊN bảng/cột: định danh chỉ được ký tự an toàn, rồi vẫn bọc `[...]`. */
function ident(name: string): string {
  const s = String(name);
  if (!IDENT.test(s)) throw new DbGuardError(`Tên bảng/cột không hợp lệ: "${s}" (chỉ chữ, số, _ , $ và không bắt đầu bằng số).`);
  return `[${s}]`;
}

const isOp = (v: unknown): v is WhereOp =>
  !!v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && typeof (v as WhereOp).op === 'string';

/**
 * Dịch `Where` → mệnh đề T-SQL + params. Giá trị trần = `eq`; `null` trần = `IS NULL`.
 * Tham số đánh tên `@p1, @p2…` (tedious không nhận `$1`).
 */
export function buildWhere(where: Where, startIndex = 1): { clause: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  let i = startIndex;
  const ph = () => `@p${i++}`;

  for (const [col, raw] of Object.entries(where || {})) {
    const c = ident(col);
    if (!isOp(raw)) {
      if (raw === null) { parts.push(`${c} IS NULL`); continue; }
      parts.push(`${c} = ${ph()}`); params.push(raw); continue;
    }
    switch (raw.op) {
      case 'eq': parts.push(`${c} = ${ph()}`); params.push(raw.value); break;
      case 'ne': parts.push(`${c} <> ${ph()}`); params.push(raw.value); break;
      case 'gt': parts.push(`${c} > ${ph()}`); params.push(raw.value); break;
      case 'gte': parts.push(`${c} >= ${ph()}`); params.push(raw.value); break;
      case 'lt': parts.push(`${c} < ${ph()}`); params.push(raw.value); break;
      case 'lte': parts.push(`${c} <= ${ph()}`); params.push(raw.value); break;
      case 'null': parts.push(`${c} IS NULL`); break;
      case 'notnull': parts.push(`${c} IS NOT NULL`); break;
      case 'like': parts.push(`${c} LIKE ${ph()}`); params.push(raw.value); break;
      case 'in':
      case 'nin': {
        const list = Array.isArray(raw.value) ? raw.value : [];
        if (!list.length) {
          // `IN ()` không hợp lệ. Tập rỗng ⇒ luôn sai (in) / luôn đúng (nin). T-SQL không có TRUE/FALSE.
          parts.push(raw.op === 'in' ? '(1=0)' : '(1=1)');
          break;
        }
        const phs = list.map(() => ph()).join(', ');
        parts.push(`${c} ${raw.op === 'in' ? 'IN' : 'NOT IN'} (${phs})`);
        params.push(...list);
        break;
      }
      default:
        throw new DbGuardError(`Toán tử không hỗ trợ: "${(raw as { op: string }).op}"`);
    }
  }
  return { clause: parts.length ? parts.join(' AND ') : '(1=1)', params };
}

function selectSql(entity: string, where: Where, opts: QueryOpts, maxRows: number): { sql: string; params: unknown[] } {
  const cols = opts.columns && opts.columns.length ? opts.columns.map(ident).join(', ') : '*';
  const { clause, params } = buildWhere(where);
  const order = opts.orderBy && opts.orderBy.length
    ? ` ORDER BY ${opts.orderBy.map((o) => `${ident(o.column)} ${o.dir === 'desc' ? 'DESC' : 'ASC'}`).join(', ')}`
    : '';
  const limit = Math.min(opts.limit ?? maxRows, maxRows);
  // T-SQL: TOP đứng ngay sau SELECT, không có LIMIT ở cuối.
  return { sql: `SELECT TOP (${limit}) ${cols} FROM ${ident(entity)} WHERE ${clause}${order}`, params };
}

/**
 * Suy kiểu tedious từ giá trị JS. tedious BẮT BUỘC khai kiểu cho tham số — không như `pg` tự đoán.
 * Chuỗi dùng `NVarChar` (DB này toàn `nvarchar`, dùng `VarChar` là mất dấu tiếng Việt).
 */
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
  req.addParameter(name, TYPES.NVarChar, String(v));
}

export class MssqlAdapter implements DbClient {
  readonly dialect = 'mssql' as const;

  private conn2: Connection | null = null;

  constructor(private readonly conn: DbConnection, private readonly conv: DbConventions) {}

  private async connected(): Promise<Connection> {
    if (this.conn2) return this.conn2;

    assertHostAllowed({ host: this.conn.host, database: this.conn.database }, {
      allowedHosts: this.conv.safety.allowedHosts,
      denyHostPatterns: this.conv.safety.denyHostPatterns,
    });

    const cfg: ConnectionConfiguration = {
      server: this.conn.host,
      authentication: {
        type: 'default',
        options: { userName: this.conn.user, password: this.conn.password },
      },
      options: {
        port: this.conn.port,
        database: this.conn.database,
        encrypt: !!this.conn.ssl,
        trustServerCertificate: true,
        connectTimeout: 15_000,
        requestTimeout: this.conv.safety.statementTimeoutMs,
        rowCollectionOnRequestCompletion: true,
        useColumnNames: false,
      },
    };

    const c: Connection = await new Promise((resolve, reject) => {
      const x = new Connection(cfg);
      x.on('connect', (err) => (err ? reject(err) : resolve(x)));
      x.on('error', (err) => reject(err));
      x.connect();
    });

    /*
     * Audit: host/db/user thôi. TUYỆT ĐỐI không log password hay connection string.
     * Cảnh báo to khi user không phải read-only — quyết định của chủ dự án là dùng account toàn quyền
     * (xem `requireReadonlyUser` ở db.conventions.json), nên dòng này là thứ duy nhất nhắc người chạy.
     */
    // eslint-disable-next-line no-console
    console.log(`[mssql] connected host=${this.conn.host} db=${this.conn.database} user=${this.conn.user}`);

    if (this.conv.safety.requireReadonlyUser) {
      try {
        const proof = proveReadOnlyFromGrants(await this.readGrants(c));
        assertReadOnly(proof, { user: this.conn.user, database: this.conn.database });
      } catch (e) {
        await new Promise<void>((r) => { c.on('end', () => r()); c.close(); }).catch(() => { /* vẫn ném lỗi gốc */ });
        throw e;
      }
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        '[mssql] ⚠ requireReadonlyUser=false — KHÔNG kiểm quyền DB. '
        + 'Chốt an toàn duy nhất là lint `assertReadOnlyQuery` trong tiến trình này; '
        + 'gọi DB trực tiếp bằng SSMS/sqlcmd thì không có gì chặn.',
      );
    }

    this.conn2 = c;
    return c;
  }

  /** Chạy MỘT câu đọc. Lint vô điều kiện — với SQL Server đây là lớp chặn chính, không có chốt phía server. */
  private async run<T extends Row>(sql: string, params: unknown[]): Promise<T[]> {
    assertReadOnlyQuery(sql);
    const c = await this.connected();
    return this.exec<T>(c, sql, params);
  }

  private exec<T extends Row>(c: Connection, sql: string, params: unknown[]): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const rows: T[] = [];
      const req = new Request(sql, (err) => (err ? reject(err) : resolve(rows)));
      params.forEach((v, idx) => addParam(req, `p${idx + 1}`, v));
      req.on('row', (cols: { value: unknown; metadata: { colName: string } }[]) => {
        const o: Row = {};
        for (const col of cols) o[col.metadata.colName] = col.value;
        rows.push(o as T);
      });
      c.execSql(req);
    });
  }

  async findOne(entity: string, where: Where, opts: QueryOpts = {}): Promise<Row | null> {
    const rows = await this.findMany(entity, where, { ...opts, limit: 2 });
    if (rows.length > 1) {
      throw new DbGuardError(
        `findOne("${entity}") khớp ${rows.length} bản ghi — mơ hồ. Thu hẹp \`where\` (thêm id/RUN_ID). `
        + 'Chọn bừa bản ghi đầu là đúng cơ chế "đọc sai hàng rồi kết luận chắc chắn".',
      );
    }
    return rows[0] ?? null;
  }

  async findMany(entity: string, where: Where, opts: QueryOpts = {}): Promise<Row[]> {
    const { sql, params } = selectSql(entity, where, opts, this.conv.safety.maxRows);
    return this.run<Row>(sql, params);
  }

  async count(entity: string, where: Where): Promise<number> {
    const { clause, params } = buildWhere(where);
    const rows = await this.run<{ n: number }>(
      `SELECT COUNT_BIG(*) AS n FROM ${ident(entity)} WHERE ${clause}`, params,
    );
    return Number(rows[0]?.n ?? 0);
  }

  /*
   * Quyền THEO BẢNG. T-SQL không có `information_schema.role_table_grants`; quyền hiệu lực (kể cả kế thừa
   * qua role như `db_owner`) chỉ đọc đúng bằng `fn_my_permissions(<đối tượng>, 'OBJECT')`.
   *
   * KHÔNG dùng TOP để giới hạn — cắt bớt thì có thể bỏ sót đúng bảng có quyền ghi và kết luận sai là
   * "read-only".
   *
   * Cố ý KHÔNG lọc `permission_name IN ('SELECT','INSERT',…)` trong SQL: chính `assertReadOnlyQuery` sẽ
   * chặn câu này vì nó thấy chữ `INSERT`/`DELETE`/`ALTER` trong literal. Lọc ở JS qua
   * `normalizePrivilege` (chữ lạ → `OTHER`, không tính là ghi) cho kết quả y hệt mà không phải nới lint —
   * nới lint để câu của chính mình đi qua là cách hỏng guard kinh điển.
   *
   * CHI PHÍ: `CROSS APPLY` chạy trên từng bảng (đo được 888 bảng ở DB nghiệp vụ UAT) nên câu này nặng
   * hơn hẳn các câu verify thường. DB lớn có thể cần nâng `safety.statementTimeoutMs` khi gọi `grants()`.
   */
  private GRANTS_SQL = `SELECT s.name AS [schema_name], t.name AS [table_name], p.permission_name
      FROM sys.tables t
      JOIN sys.schemas s ON s.schema_id = t.schema_id
      CROSS APPLY fn_my_permissions(QUOTENAME(s.name) + '.' + QUOTENAME(t.name), 'OBJECT') p`;

  private async readGrants(c: Connection): Promise<GrantRow[]> {
    assertReadOnlyQuery(this.GRANTS_SQL);
    const rows = await this.exec<{ schema_name: string; table_name: string; permission_name: string }>(
      c, this.GRANTS_SQL, [],
    );
    // Chuẩn hoá TẠI ĐÂY: lớp phán chỉ được biết tập quyền chuẩn (xem `TỪ VỰNG QUYỀN` ở types.ts).
    return rows.map((r) => ({
      table: `${r.schema_name}.${r.table_name}`,
      privilege: normalizePrivilege(r.permission_name),
    }));
  }

  async grants(): Promise<GrantRow[]> {
    return this.readGrants(await this.connected());
  }

  async close(): Promise<void> {
    const c = this.conn2;
    this.conn2 = null;
    if (!c) return;
    await new Promise<void>((resolve) => {
      c.on('end', () => resolve());
      c.close();
    });
  }
}
