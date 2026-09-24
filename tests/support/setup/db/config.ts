import fs from 'fs';
import path from 'path';
import { DbGuardError, type Dialect } from './types';

/*
 * config.ts — TÁCH LÀM HAI, có lý do:
 *
 *   conventions  →  `.agent/config/db.conventions.json`   ĐƯỢC COMMIT
 *                   Đây là TRI THỨC DỰ ÁN (xoá mềm ở cột nào, tiền ở cột nào, app ghi giờ theo múi nào).
 *                   Cả nhóm phải đọc và review được; gộp chung với creds thì không commit nổi.
 *
 *   connection   →  `profiles/<TASK_KEY>/task.env`         KHÔNG COMMIT
 *                   Secret theo task, đúng luật isolation của kit (DB của task khoá trong task.env, không
 *                   để ở `.env` chung).
 *
 * ĐO THẬT (một DB UAT thật, 27/08/2026) đã bác một giả định của bản thiết kế đầu:
 * `deleted_at` chỉ có ở **9/16** bảng — 7 bảng nối (`*_instances`, `*_promotion_orders`) KHÔNG có cột này.
 * Nên `softDelete` KHÔNG thể là một giá trị toàn cục; phải cho override THEO BẢNG, và bảng nào không khai
 * thì `expectSoftDeleted` phải TỪ CHỐI phán thay vì mặc định đoán `deleted_at`.
 */

export type SoftDeleteMode = 'timestamp' | 'boolean' | 'status' | 'none';

export interface SoftDeleteRule {
  mode: SoftDeleteMode;
  column?: string;
  /** Chỉ dùng khi mode = 'status'. */
  deletedValue?: string;
}

export interface DbConventions {
  softDelete: { default: SoftDeleteRule; byEntity?: Record<string, SoftDeleteRule> };
  timestamps: {
    createdAt?: string;
    updatedAt?: string;
    updatedBy?: string;
    /**
     * Múi giờ mà APP ghi vào cột không-timezone. Bỏ trống ⇒ `instant()` trả `inconclusive`.
     * KHÔNG đặt mặc định: đoán múi giờ là cách tạo bug ma trông rất thuyết phục.
     */
    storedZone?: string;
  };
  audit?: { entity: string; entityCol: string; idCol: string; actionCol: string };
  idColumn: string;
  money?: { entities?: Record<string, string[]> };
  /** Cột là TỈ LỆ/PHẦN TRĂM, không phải tiền — `money()` không áp được (thông điệp "lệch N đồng" là sai nghĩa). */
  rates?: { entities?: Record<string, string[]>; unitUnknown?: string[] };
  fieldMap?: {
    entity: string;
    /** Khoá THEO MÀN: cùng một cột có nhãn khác nhau ở hai màn. */
    byScreen: Record<string, Record<string, string>>;
    /** enum DB → nhãn UI, khoá `"<bảng>.<cột>"`. */
    valueMaps?: Record<string, Record<string, string>>;
    /** Cột CHƯA phân biệt được — helper phải TỪ CHỐI, không được đoán. */
    unanchored: Record<string, string>;
    /** Cột KHÔNG PHẢI field hiển thị (vd `order_type` quyết định route) — không bao giờ neo được bằng đọc màn. */
    notDisplayed?: Record<string, string>;
  };
  safety: {
    requireReadonlyUser: boolean;
    allowedHosts?: string[];
    denyHostPatterns?: string[];
    statementTimeoutMs: number;
    maxRows: number;
  };
}

export interface DbConnection {
  dialect: Dialect;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}

const CONV_PATH = ['.agent', 'config', 'db.conventions.json'];

export function loadConventions(repoRoot: string): DbConventions {
  const p = path.join(repoRoot, ...CONV_PATH);
  if (!fs.existsSync(p)) throw new DbGuardError(`Thiếu ${CONV_PATH.join('/')} — quy ước dự án (xoá mềm/timestamp/audit) phải khai ra file, không hardcode trong test.`);
  let raw: unknown;
  try { raw = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { throw new DbGuardError(`${CONV_PATH.join('/')} không parse được: ${(e as Error).message}`); }
  const c = raw as Partial<DbConventions>;

  /*
   * KHỐI LẠ PHẢI BÁO, KHÔNG ĐƯỢC BỎ ÂM THẦM. Hàm này trả về một object DỰNG LẠI theo allowlist, nên khối nào
   * chưa liệt kê ở đây thì code không bao giờ thấy — mà file JSON vẫn có, review vẫn thấy, nên không ai biết.
   * Đã dính đúng một lần: `fieldMap` khai trong JSON, đo cẩn thận, viết cả test — nhưng loader không trả nó
   * nên 9 test đọc `conv.fieldMap` đỏ vì `undefined`. Từ giờ thêm khối vào JSON mà quên nối vào đây thì CHẶN.
   */
  const KNOWN = ['softDelete', 'timestamps', 'audit', 'idColumn', 'money', 'rates', 'relations', 'safety', 'fieldMap'];
  const unknown = Object.keys(raw as object).filter((k) => !k.startsWith('_') && !KNOWN.includes(k));
  if (unknown.length) {
    throw new DbGuardError(
      `${CONV_PATH.join('/')} có khối chưa được loader nối: ${unknown.join(', ')}. `
      + `Thêm vào KNOWN + trả ra trong loadConventions, nếu không khối này vô hình với code (khai mà không dùng được).`,
    );
  }

  if (!c.softDelete || !c.softDelete.default) throw new DbGuardError('`softDelete.default` bắt buộc (mode: timestamp|boolean|status|none).');
  if (!c.idColumn) throw new DbGuardError('`idColumn` bắt buộc.');
  if (!c.safety) throw new DbGuardError('`safety` bắt buộc (requireReadonlyUser, statementTimeoutMs, maxRows).');
  return {
    softDelete: c.softDelete,
    timestamps: c.timestamps || {},
    audit: c.audit,
    idColumn: c.idColumn,
    money: c.money,
    rates: c.rates,
    fieldMap: c.fieldMap,
    safety: {
      requireReadonlyUser: c.safety.requireReadonlyUser !== false,   // mặc định BẬT — tắt phải khai tường minh
      /*
       * Allowlist host ƯU TIÊN env `LIB_MASTER_DB_ALLOWED_HOSTS` (danh sách phẩy), rồi mới tới conventions.
       * Lý do: repo này PUBLIC, mà `db.conventions.json` ĐƯỢC COMMIT — ghi host nội bộ vào đó là đăng địa
       * chỉ hạ tầng lên GitHub. Giá trị thật để ở `.env`/`task.env` (gitignored); conventions chỉ giữ
       * khung. Bỏ trống cả hai ⇒ không áp allowlist (rào chính vẫn là credential).
       */
      allowedHosts: (process.env.LIB_MASTER_DB_ALLOWED_HOSTS || '')
        .split(',').map((h) => h.trim()).filter(Boolean)
        .concat(c.safety.allowedHosts || []),
      denyHostPatterns: c.safety.denyHostPatterns,
      statementTimeoutMs: Number(c.safety.statementTimeoutMs || 5000),
      maxRows: Number(c.safety.maxRows || 500),
    },
  };
}

/** Quy ước xoá mềm của MỘT bảng. Không khai ⇒ trả `none` để hàm gọi TỪ CHỐI phán, không đoán. */
export function softDeleteFor(conv: DbConventions, entity: string): SoftDeleteRule {
  const byEntity = conv.softDelete.byEntity || {};
  return byEntity[entity] || conv.softDelete.default;
}

const REQUIRED = ['HOST', 'PORT', 'NAME', 'USERNAME', 'PASSWORD'] as const;

/**
 * Đọc connection từ env theo prefix (mặc định `LIB_MASTER_DB_RO` — role CHỈ ĐỌC).
 * Cố ý KHÔNG mặc định về `LIB_MASTER_DB` (user full quyền đang có ở `.env` chung): nếu ai đó quên khai role
 * read-only thì phải BÁO THIẾU, chứ không được im lặng rơi về user ghi được cả 232 bảng.
 */
export function loadConnection(prefix = 'LIB_MASTER_DB_RO', env: NodeJS.ProcessEnv = process.env): DbConnection {
  const missing = REQUIRED.filter((k) => !String(env[`${prefix}_${k}`] || '').trim());
  if (missing.length) {
    throw new DbGuardError(
      `Thiếu env kết nối: ${missing.map((k) => `${prefix}_${k}`).join(', ')}.\n`
      + `  Đặt trong \`profiles/<TASK_KEY>/task.env\` (KHÔNG phải \`.env\` chung — DB của task khoá theo task).\n`
      + `  Prefix mặc định là "${prefix}" (role CHỈ ĐỌC) — cố ý không rơi về user full quyền.`,
    );
  }
  const port = Number(env[`${prefix}_PORT`]);
  if (!Number.isInteger(port) || port <= 0) throw new DbGuardError(`${prefix}_PORT không hợp lệ: "${env[`${prefix}_PORT`]}".`);
  return {
    dialect: (String(env[`${prefix}_DIALECT`] || 'mssql') as Dialect),
    host: String(env[`${prefix}_HOST`]),
    port,
    database: String(env[`${prefix}_NAME`]),
    user: String(env[`${prefix}_USERNAME`]),
    password: String(env[`${prefix}_PASSWORD`]),
    ssl: String(env[`${prefix}_SSL`] || '').toLowerCase() === 'true',
  };
}

/*
 * Hai helper dưới đây là chỗ luật "chỉ dùng cột ĐÃ NEO" có RĂNG. Trước đó luật nằm ở văn bản §23, nghĩa là
 * chỉ cần một lượt chạy lỡ dùng `deposit` (đang treo) là phán sai mà không ai chặn. Giờ tra bản đồ phải đi
 * qua hàm, và hàm NÉM khi cột/enum chưa neo — chưa neo thì không có đường nào ra được kết luận.
 */

/** Nhãn UI của một cột DB TRÊN MỘT MÀN. Chưa neo (hoặc neo ở màn khác) ⇒ ném, không trả nhãn màn khác. */
export function uiLabelOfColumn(conv: DbConventions, screen: string, column: string): string {
  const fm = conv.fieldMap;
  if (!fm) throw new DbGuardError('conventions chưa khai `fieldMap` — không có bản đồ thì không phán được cột nào.');
  const cols = fm.byScreen[screen];
  if (!cols) {
    throw new DbGuardError(
      `màn "${screen}" chưa có trong fieldMap.byScreen. Đã neo: ${Object.keys(fm.byScreen).join(', ')}. `
      + 'Dùng nhãn của màn khác là neo sai cột — neo màn này trước bằng fixture phân biệt.',
    );
  }
  const label = cols[column];
  if (label) return label;
  const otherScreens = Object.entries(fm.byScreen).filter(([, c]) => c[column]).map(([s2]) => s2);
  const why = fm.unanchored[`${column}@${screen}`] || fm.unanchored[column];
  throw new DbGuardError(
    `cột "${column}" CHƯA NEO ở màn "${screen}"`
    + (otherScreens.length ? ` (chỉ neo ở: ${otherScreens.join(', ')} — nhãn ở đó KHÁC, không dùng thay được)` : '')
    + (why ? `. Lý do đang treo: ${why}` : '')
    + '. Không được phán bằng cột chưa neo: đoán sai cột thì kết luận vẫn ra, lại có số từ DB nên trông thuyết phục.',
  );
}

/** Nhãn UI ứng với một giá trị enum trong DB, ví dụ `('ic_payment_orders.status', 'PURCHASED')`. */
export function uiLabelOfValue(conv: DbConventions, entityColumn: string, dbValue: string): string {
  const maps = conv.fieldMap?.valueMaps;
  if (!maps || !maps[entityColumn]) {
    throw new DbGuardError(
      `chưa có bản đồ giá trị cho "${entityColumn}". Đã neo: ${Object.keys(maps || {}).filter((k) => !k.startsWith('_')).join(', ') || 'chưa có gì'}.`,
    );
  }
  const label = maps[entityColumn][dbValue];
  if (label) return label;
  throw new DbGuardError(
    `enum "${dbValue}" của "${entityColumn}" chưa neo nhãn UI. Đã neo: ${Object.keys(maps[entityColumn]).join(', ')}. `
    + 'Gặp enum lạ nghĩa là app có trạng thái mà phép đo chưa thấy — đo lại, đừng dịch tay.',
  );
}
