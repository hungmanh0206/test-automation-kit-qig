/*
 * types.ts — hợp đồng của tầng kiểm dữ liệu DB (DB Verification Layer).
 *
 * Interface mô tả Ý ĐỊNH KIỂM TRA, không phải SQL: `query(sql)` khoá test vào một phương ngữ và không cho
 * Mongo vào được. Adapter tự dịch `Where` sang phương ngữ của nó.
 *
 * BA NGUYÊN TẮC ĐÃ CHỐT (đừng nới):
 *  1. DB là oracle PHỤ. Nguồn sự thật là `knowledge/domain/BR-*`; lấy giá trị từ DB rồi so với chính DB là
 *     tautology. Giá trị lớn nhất của kiểm song song là KHOANH TẦNG lỗi (UI đúng + DB sai = bug persist).
 *  2. So sánh phải THEO NGHĨA của field, không so thô. Đo trên `một DB UAT thật` 27/08/2026:
 *     cột thành tiền của bảng đơn là số nguyên, còn cột số tiền của bảng giao dịch là
 *     chuỗi — CÙNG khái niệm tiền, HAI kiểu. So thô thì `540000 !== '540000'` ⇒ báo oan ngay
 *     ngày đầu, rồi sẽ có người bọc `String()` cho hết đỏ và mất luôn khả năng bắt "số bị đổi kiểu".
 *  3. Không phán được thì nói KHÔNG PHÁN ĐƯỢC. Cả 39/39 cột thời gian của DB này là `timestamp WITHOUT
 *     time zone` ⇒ không có offset trong dữ liệu. Nếu chưa khai app ghi theo múi nào thì so mốc thời gian
 *     là đoán — comparator trả `inconclusive`, KHÔNG trả `false`.
 */

export type Dialect = 'mssql' | 'mysql' | 'mongo';

export type WhereOp =
  | { op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'; value: unknown }
  | { op: 'in' | 'nin'; value: unknown[] }
  | { op: 'null' | 'notnull' }
  | { op: 'like'; value: string };

/** Giá trị trần = `eq`. Vd: `{ id: 42, deleted_at: { op: 'null' } }`. */
export type Where = Record<string, unknown | WhereOp>;

export type Row = Record<string, unknown>;

export interface QueryOpts {
  /** CHỈ lấy cột cần so. Không `SELECT *`: PII không vào memory thì không có đường lộ qua log/screenshot. */
  columns?: string[];
  limit?: number;
  orderBy?: { column: string; dir: 'asc' | 'desc' }[];
}

export interface DbClient {
  readonly dialect: Dialect;
  findOne(entity: string, where: Where, opts?: QueryOpts): Promise<Row | null>;
  findMany(entity: string, where: Where, opts?: QueryOpts): Promise<Row[]>;
  count(entity: string, where: Where, opts?: QueryOpts): Promise<number>;
  /** Quyền của user hiện tại — nguồn cho `proveReadOnly`. */
  grants(): Promise<GrantRow[]>;
  close(): Promise<void>;
}

/*
 * TỪ VỰNG QUYỀN — CHUẨN HOÁ Ở ADAPTER, không ở lớp phán.
 *
 * Lỗ hổng đã bịt (28/08/2026): `guard.ts` so quyền bằng đúng chữ SQL (`INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`).
 * Postgres và MySQL dùng đúng những chữ đó nên nhìn thì "chạy tốt", nhưng Mongo gọi hành động ghi là
 * `insert`/`update`/`remove`/`drop` ⇒ thêm adapter Mongo là `guard` **không thấy quyền ghi nào** và kết luận
 * "read-only" cho một user ghi được. Đúng loại lỗ hổng tệ nhất: sai mà mọi phép kiểm đều xanh.
 *
 * Hợp đồng: **adapter PHẢI trả `privilege` theo tập chuẩn dưới đây**, tự dịch từ phương ngữ của nó. Lớp phán
 * (`guard.ts`) chỉ được biết tập chuẩn — không được biết Postgres hay Mongo.
 */
export type Privilege =
  | 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRUNCATE' | 'ALTER' | 'CONTROL' | 'OTHER';

/*
 * Quyền đủ để ĐỔI dữ liệu. `REFERENCES`/`TRIGGER`/`VIEW DEFINITION`/`OTHER` không đổi dữ liệu trực tiếp
 * ⇒ không tính.
 *
 * `ALTER` và `CONTROL` PHẢI nằm trong danh sách này — đo 24/09/2026 trên DB nghiệp vụ UAT (SQL Server 2019):
 * T-SQL KHÔNG có quyền đối tượng tên `TRUNCATE`; `TRUNCATE TABLE` chỉ cần **ALTER** trên bảng, và `CONTROL`
 * bao trùm mọi quyền khác. Nếu chỉ xét INSERT/UPDATE/DELETE/TRUNCATE như bản Postgres thì một user thuộc
 * `db_ddladmin` (có ALTER, xoá trắng bảng được) sẽ bị kết luận là "read-only" — đúng loại lỗ hổng tệ nhất:
 * sai mà mọi phép kiểm đều xanh.
 */
export const WRITE_PRIVILEGES: readonly Privilege[] = [
  'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'ALTER', 'CONTROL',
];

/**
 * Dịch tên quyền của từng phương ngữ sang tập chuẩn. Hàm THUẦN, dùng bởi adapter.
 * Chữ lạ → `OTHER` (không đoán là ghi, cũng không đoán là đọc).
 */
export function normalizePrivilege(raw: string): Privilege {
  const p = String(raw || '').trim().toUpperCase();
  const MAP: Record<string, Privilege> = {
    SELECT: 'SELECT', FIND: 'SELECT', READ: 'SELECT',
    INSERT: 'INSERT',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE', REMOVE: 'DELETE',
    TRUNCATE: 'TRUNCATE', DROP: 'TRUNCATE', DROPCOLLECTION: 'TRUNCATE',
    // T-SQL: không có quyền `TRUNCATE`; ALTER cho phép TRUNCATE TABLE, CONTROL bao trùm mọi quyền.
    ALTER: 'ALTER', CONTROL: 'CONTROL', 'TAKE OWNERSHIP': 'CONTROL',
  };
  return MAP[p] || 'OTHER';
}

/** Một dòng quyền đọc từ catalog (`information_schema.role_table_grants` hoặc tương đương). */
export interface GrantRow {
  /** Bảng (SQL) hoặc collection (Mongo). */
  table: string;
  /** ĐÃ CHUẨN HOÁ qua `normalizePrivilege` — adapter chịu trách nhiệm, không phải lớp phán. */
  privilege: Privilege;
}

/*
 * KẾT QUẢ SO SÁNH — ba trạng thái, không phải hai.
 * `inconclusive` là trạng thái BẮT BUỘC phải có: nó chặn đúng lối "không đo được thì cho là đạt".
 */
export type MatchResult =
  | { verdict: 'match' }
  | { verdict: 'mismatch'; expected: string; actual: string; why: string }
  | { verdict: 'inconclusive'; why: string };

export interface Matcher {
  readonly kind: 'money' | 'instant' | 'text' | 'exact';
  describe(): string;
  compare(actual: unknown): MatchResult;
}

/** Giá trị mong đợi: matcher, hoặc giá trị trần (⇒ so `exact`). */
export type Expected = Record<string, Matcher | unknown>;

export class DbGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DbGuardError';
  }
}
