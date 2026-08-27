import { Client, type ClientConfig, type QueryResultRow } from 'pg';
import { assertHostAllowed, assertReadOnlyQuery, proveReadOnlyFromGrants, assertReadOnly } from '../guard';
import { DbGuardError, type DbClient, type GrantRow, type QueryOpts, type Row, type Where, type WhereOp } from '../types';
import type { DbConnection, DbConventions } from '../config';

/*
 * adapters/postgres.ts — dịch `Where` (ngữ nghĩa) sang SQL, và giữ CẢ BỐN lớp bảo vệ.
 *
 * Thứ tự lớp (theo thiết kế đã chốt — quyền DB là lớp CHÍNH, không phải guard trong code):
 *   1. Quyền DB read-only     → `proveReadOnly()` lúc kết nối, đọc catalog (không thử ghi)
 *   2. Lint câu truy vấn      → `assertReadOnlyQuery` trên MỌI câu, kể cả câu do adapter tự sinh
 *   3. TRANSACTION READ ONLY  → cộng thêm `default_transaction_read_only` ở mức SESSION
 *   4. Host/DB guard          → allowlist + deny `prod|live`
 *
 * `SELECT *` KHÔNG được dùng: `opts.columns` bắt buộc ở `findOne/findMany` khi bảng có PII. Không lấy về
 * thì không có đường lộ qua log/screenshot — mạnh hơn và rẻ hơn là sanitize sau.
 */

const IDENT = /^[a-z_][a-z0-9_$]*$/i;

/** Chặn SQL injection qua TÊN bảng/cột: định danh chỉ được là ký tự an toàn, rồi vẫn bọc `"…"`. */
function ident(name: string): string {
  const s = String(name);
  if (!IDENT.test(s)) throw new DbGuardError(`Tên bảng/cột không hợp lệ: "${s}" (chỉ chữ, số, _ , $ và không bắt đầu bằng số).`);
  return `"${s}"`;
}

const isOp = (v: unknown): v is WhereOp =>
  !!v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && typeof (v as WhereOp).op === 'string';

/** Dịch `Where` → mệnh đề SQL + params. Giá trị trần = `eq`; `null` trần = `IS NULL` (đúng ngữ nghĩa SQL). */
export function buildWhere(where: Where, startIndex = 1): { clause: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  let i = startIndex;
  const ph = () => `$${i++}`;

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
          // `IN ()` không hợp lệ SQL. Tập rỗng ⇒ mệnh đề luôn sai (in) / luôn đúng (nin) — nói ra bằng hằng.
          parts.push(raw.op === 'in' ? 'FALSE' : 'TRUE');
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
  return { clause: parts.length ? parts.join(' AND ') : 'TRUE', params };
}

function selectSql(entity: string, where: Where, opts: QueryOpts, maxRows: number): { sql: string; params: unknown[] } {
  const cols = opts.columns && opts.columns.length ? opts.columns.map(ident).join(', ') : '*';
  const { clause, params } = buildWhere(where);
  const order = opts.orderBy && opts.orderBy.length
    ? ` ORDER BY ${opts.orderBy.map((o) => `${ident(o.column)} ${o.dir === 'desc' ? 'DESC' : 'ASC'}`).join(', ')}`
    : '';
  const limit = Math.min(opts.limit ?? maxRows, maxRows);
  return { sql: `SELECT ${cols} FROM ${ident(entity)} WHERE ${clause}${order} LIMIT ${limit}`, params };
}

export class PostgresAdapter implements DbClient {
  readonly dialect = 'postgres' as const;

  private client: Client | null = null;

  constructor(private readonly conn: DbConnection, private readonly conv: DbConventions) {}

  private async connected(): Promise<Client> {
    if (this.client) return this.client;

    assertHostAllowed({ host: this.conn.host, database: this.conn.database }, {
      allowedHosts: this.conv.safety.allowedHosts,
      denyHostPatterns: this.conv.safety.denyHostPatterns,
    });

    const cfg: ClientConfig = {
      host: this.conn.host,
      port: this.conn.port,
      database: this.conn.database,
      user: this.conn.user,
      password: this.conn.password,
      ssl: this.conn.ssl ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 10_000,
      statement_timeout: this.conv.safety.statementTimeoutMs,
    };
    const c = new Client(cfg);
    await c.connect();

    /*
     * Lớp 3 ở mức SESSION: mọi transaction trong session này là read-only, KỂ CẢ superuser. Đây là chốt của
     * máy chủ, không phải của code — nên nó còn hiệu lực cả khi một hàm nào đó quên gọi lint.
     */
    await c.query('SET default_transaction_read_only = on');

    if (this.conv.safety.requireReadonlyUser) {
      const g = await c.query<{ table_name: string; privilege_type: string }>(
        `SELECT table_name, privilege_type FROM information_schema.role_table_grants
          WHERE grantee = current_user AND table_schema = 'public'`,
      );
      const proof = proveReadOnlyFromGrants(g.rows.map((r) => ({ table: r.table_name, privilege: r.privilege_type })));
      try {
        assertReadOnly(proof, { user: this.conn.user, database: this.conn.database });
      } catch (e) {
        await c.end().catch(() => { /* đóng được thì tốt, không thì vẫn phải ném lỗi gốc */ });
        throw e;
      }
    }

    this.client = c;
    return c;
  }

  private async run<T extends QueryResultRow>(sql: string, params: unknown[]): Promise<T[]> {
    assertReadOnlyQuery(sql);                       // lint CẢ câu do adapter tự sinh — không tự tin vào chính mình
    const c = await this.connected();
    const res = await c.query<T>(sql, params as unknown[]);
    return res.rows;
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
    return this.run<QueryResultRow>(sql, params);
  }

  async count(entity: string, where: Where): Promise<number> {
    const { clause, params } = buildWhere(where);
    const rows = await this.run<{ n: string }>(`SELECT count(*)::text AS n FROM ${ident(entity)} WHERE ${clause}`, params);
    return Number(rows[0]?.n ?? 0);
  }

  async grants(): Promise<GrantRow[]> {
    const rows = await this.run<{ table_name: string; privilege_type: string }>(
      `SELECT table_name, privilege_type FROM information_schema.role_table_grants
        WHERE grantee = current_user AND table_schema = 'public'`,
      [],
    );
    return rows.map((r) => ({ table: r.table_name, privilege: r.privilege_type }));
  }

  async close(): Promise<void> {
    const c = this.client;
    this.client = null;
    if (c) await c.end();
  }
}
