import path from 'path';
import { asMatcher } from './match';
import { loadConventions, loadConnection, softDeleteFor, type DbConventions } from './config';
import { PostgresAdapter } from './adapters/postgres';
import { DbGuardError, type DbClient, type Expected, type Row, type Where } from './types';

/*
 * dbVerify.ts — API mà TEST dùng. Ba luật không được nới:
 *
 *  1. DB là oracle PHỤ. Nguồn sự thật là `knowledge/domain/BR-*`/FSD; `expectRow` chỉ so bản ghi với GIÁ
 *     TRỊ ĐÃ KHAI TỪ SPEC. Lấy số từ DB rồi bảo "UI phải giống DB" là tautology — cấm.
 *  2. Không phán được thì báo KHÔNG PHÁN ĐƯỢC. Cột chưa neo, quy ước chưa khai, thiếu `storedZone` ⇒ ném
 *     lỗi nói rõ thiếu gì, KHÔNG đoán. Bug ma "có số từ DB" thuyết phục hơn bug ma thường rất nhiều.
 *  3. Chỉ verify bản ghi do CHÍNH lượt test tạo (lọc theo id/RUN_ID). UAT dùng chung: assert lên dữ liệu
 *     của người khác là nguồn flaky và là đường tạo kết luận sai.
 */

let cached: { client: DbClient; conv: DbConventions } | null = null;

const REPO = path.resolve(__dirname, '..', '..', '..', '..');

/** Mở client theo config + conventions. Dùng chung một kết nối cho cả file test (đóng ở `closeDb`). */
export async function getDb(): Promise<{ client: DbClient; conv: DbConventions }> {
  if (cached) return cached;
  const conv = loadConventions(REPO);
  const conn = loadConnection();                     // mặc định prefix LIB_MASTER_DB_RO — không rơi về user ghi
  if (conn.dialect !== 'postgres') {
    throw new DbGuardError(`Chưa có adapter cho dialect "${conn.dialect}". Hiện chỉ có postgres — thêm adapter thì khai ở đây.`);
  }
  cached = { client: new PostgresAdapter(conn, conv), conv };
  return cached;
}

export async function closeDb(): Promise<void> {
  if (!cached) return;
  await cached.client.close();
  cached = null;
}

export interface Diff { column: string; expected: string; actual: string; why: string }

/** Kết quả so một bản ghi: tách rõ LỆCH và KHÔNG-PHÁN-ĐƯỢC — hai thứ khác nhau về hành động. */
export interface RowCheck { found: boolean; diffs: Diff[]; inconclusive: Diff[]; row: Row | null }

export async function checkRow(entity: string, where: Where, expected: Expected): Promise<RowCheck> {
  const { client } = await getDb();
  const columns = [...new Set([...Object.keys(expected), ...Object.keys(where)])];
  const row = await client.findOne(entity, where, { columns });
  if (!row) return { found: false, diffs: [], inconclusive: [], row: null };

  const diffs: Diff[] = [];
  const inconclusive: Diff[] = [];
  for (const [col, exp] of Object.entries(expected)) {
    const r = asMatcher(exp).compare(row[col]);
    if (r.verdict === 'match') continue;
    if (r.verdict === 'inconclusive') { inconclusive.push({ column: col, expected: asMatcher(exp).describe(), actual: String(row[col]), why: r.why }); continue; }
    diffs.push({ column: col, expected: r.expected, actual: r.actual, why: r.why });
  }
  return { found: true, diffs, inconclusive, row };
}

const fmtDiffs = (list: Diff[]) => list.map((d) => `  ${d.column}: mong ${d.expected} · thực tế ${d.actual}  ← ${d.why}`).join('\n');

/**
 * Bản ghi tồn tại và khớp giá trị theo SPEC.
 * Ném lỗi có ĐỦ chênh lệch từng cột — "không khớp" chung chung thì dev không sửa được gì.
 */
export async function expectRow(entity: string, where: Where, expected: Expected): Promise<Row> {
  const res = await checkRow(entity, where, expected);
  if (!res.found) throw new Error(`expectRow("${entity}") KHÔNG tìm thấy bản ghi với ${JSON.stringify(where)}`);
  if (res.inconclusive.length) {
    throw new Error(
      `expectRow("${entity}") KHÔNG PHÁN ĐƯỢC ${res.inconclusive.length} trường (thiếu quy ước, không phải lệch giá trị):\n${fmtDiffs(res.inconclusive)}`,
    );
  }
  if (res.diffs.length) throw new Error(`expectRow("${entity}") lệch ${res.diffs.length} trường:\n${fmtDiffs(res.diffs)}`);
  return res.row as Row;
}

/**
 * Xoá MỀM đúng quy ước. Bảng khai `mode: none` ⇒ TỪ CHỐI phán (ở đó xoá là xoá cứng, dùng `expectAbsent`).
 * Đo 27/08/2026: `deleted_at` chỉ có ở 9/16 bảng — nên đoán quy ước là sai ở gần một nửa số bảng.
 */
export async function expectSoftDeleted(entity: string, where: Where): Promise<void> {
  const { client, conv } = await getDb();
  const rule = softDeleteFor(conv, entity);
  if (rule.mode === 'none') {
    throw new DbGuardError(
      `"${entity}" khai \`softDelete.mode: none\` — bảng này KHÔNG có cột xoá mềm, nên không thể kiểm "đã xoá mềm". `
      + 'Dùng `expectAbsent()` nếu spec là xoá cứng, hoặc khai đúng quy ước vào `db.conventions.json`.',
    );
  }
  const col = rule.column;
  if (!col) throw new DbGuardError(`"${entity}": \`softDelete.column\` chưa khai.`);

  const cond: Where = { ...where };
  if (rule.mode === 'timestamp') cond[col] = { op: 'notnull' };
  else if (rule.mode === 'boolean') cond[col] = true;
  else cond[col] = rule.deletedValue ?? 'DELETED';

  const n = await client.count(entity, cond);
  if (n !== 1) {
    const alive = await client.count(entity, { ...where, ...(rule.mode === 'timestamp' ? { [col]: { op: 'null' } } : {}) });
    throw new Error(
      `expectSoftDeleted("${entity}") không đạt: khớp ${n} bản ghi ĐÃ xoá mềm, và ${alive} bản ghi CÒN SỐNG.\n`
      + `  Quy ước: ${col} (${rule.mode}). UI báo "xoá thành công" mà DB còn sống = xoá mềm hỏng — đúng lớp bug UI không thấy được.`,
    );
  }
}

/** Bản ghi CÒN sống (chưa xoá mềm). */
export async function expectNotDeleted(entity: string, where: Where): Promise<void> {
  const { client, conv } = await getDb();
  const rule = softDeleteFor(conv, entity);
  const cond: Where = { ...where };
  if (rule.mode === 'timestamp' && rule.column) cond[rule.column] = { op: 'null' };
  else if (rule.mode === 'boolean' && rule.column) cond[rule.column] = false;
  const n = await client.count(entity, cond);
  if (n < 1) throw new Error(`expectNotDeleted("${entity}") không đạt: 0 bản ghi còn sống khớp ${JSON.stringify(where)}`);
}

/** Bản ghi KHÔNG tồn tại (xoá cứng). */
export async function expectAbsent(entity: string, where: Where): Promise<void> {
  const { client } = await getDb();
  const n = await client.count(entity, where);
  if (n !== 0) throw new Error(`expectAbsent("${entity}") không đạt: vẫn còn ${n} bản ghi khớp ${JSON.stringify(where)}`);
}

/** Số bản ghi con — dùng cho "bảng liên quan đổi/không đổi đúng kỳ vọng". */
export async function expectCount(entity: string, where: Where, n: number): Promise<void> {
  const { client } = await getDb();
  const got = await client.count(entity, where);
  if (got !== n) throw new Error(`expectCount("${entity}") mong ${n}, thực tế ${got} (where=${JSON.stringify(where)})`);
}

/**
 * Ảnh chụp các cột CẦN THEO DÕI. Cố ý BẮT BUỘC khai `columns`: chụp cả hàng rồi so tất cả sẽ đỏ oan trên
 * UAT dùng chung (job nền chạm `updated_at`, người khác sửa cột khác). Chỉ theo dõi cột mà thao tác đang
 * test lẽ ra chạm tới.
 */
export async function snapshot(entity: string, where: Where, columns: string[]): Promise<Row | null> {
  if (!columns || !columns.length) {
    throw new DbGuardError('snapshot() phải khai `columns` — chụp cả hàng thì `expectNoChange` sẽ đỏ oan vì cột người khác/job nền chạm.');
  }
  const { client } = await getDb();
  return client.findOne(entity, where, { columns });
}

/**
 * NEGATIVE — quan trọng nhất trong cả tầng này: thao tác FAIL thì DB không được đổi.
 * So đúng các cột đã chụp, không so cả hàng.
 */
export async function expectNoChange(entity: string, where: Where, before: Row | null, columns: string[]): Promise<void> {
  const after = await snapshot(entity, where, columns);
  if (before === null && after === null) return;
  if (before === null || after === null) {
    throw new Error(`expectNoChange("${entity}") không đạt: bản ghi ${before === null ? 'XUẤT HIỆN' : 'BIẾN MẤT'} sau thao tác lẽ ra fail.`);
  }
  const changed = columns.filter((c) => String(before[c]) !== String(after[c]));
  if (changed.length) {
    throw new Error(
      `expectNoChange("${entity}") không đạt: ${changed.length} cột ĐÃ ĐỔI sau thao tác lẽ ra fail (rollback không đúng):\n`
      + changed.map((c) => `  ${c}: ${String(before[c])} → ${String(after[c])}`).join('\n'),
    );
  }
}

/**
 * Bảng này KHÔNG có audit hành động người dùng (đo 27/08/2026: `ic_payment_orders` và
 * `ic_payment_transaction_orders` không có cột nào ghi người sửa; `ic_payment_webhook_logs` là log webhook).
 * Nên hàm này TỪ CHỐI thay vì trả kết quả rỗng — hứa kiểm audit khi không có cột audit là hứa suông.
 */
export async function expectAudit(): Promise<never> {
  const { conv } = await getDb();
  throw new DbGuardError(
    `expectAudit() không dùng được: \`audit.supported\` = ${String((conv.audit as { supported?: boolean } | undefined)?.supported ?? false)}. `
    + 'DB này không có bảng audit hành động người dùng, và 2 bảng lõi không có cột người sửa. '
    + 'Chiều §23 chỉ kiểm `updated_at` có nhảy (dùng `expectRow` với `updated_at: { op: "notnull" }` hoặc so snapshot).',
  );
}
