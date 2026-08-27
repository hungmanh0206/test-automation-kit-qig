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
 * ĐO THẬT (sapp-platform-uat, 27/08/2026) đã bác một giả định của bản thiết kế đầu:
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
  if (!c.softDelete || !c.softDelete.default) throw new DbGuardError('`softDelete.default` bắt buộc (mode: timestamp|boolean|status|none).');
  if (!c.idColumn) throw new DbGuardError('`idColumn` bắt buộc.');
  if (!c.safety) throw new DbGuardError('`safety` bắt buộc (requireReadonlyUser, statementTimeoutMs, maxRows).');
  return {
    softDelete: c.softDelete,
    timestamps: c.timestamps || {},
    audit: c.audit,
    idColumn: c.idColumn,
    money: c.money,
    safety: {
      requireReadonlyUser: c.safety.requireReadonlyUser !== false,   // mặc định BẬT — tắt phải khai tường minh
      allowedHosts: c.safety.allowedHosts,
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
    dialect: (String(env[`${prefix}_DIALECT`] || 'postgres') as Dialect),
    host: String(env[`${prefix}_HOST`]),
    port,
    database: String(env[`${prefix}_NAME`]),
    user: String(env[`${prefix}_USERNAME`]),
    password: String(env[`${prefix}_PASSWORD`]),
    ssl: String(env[`${prefix}_SSL`] || '').toLowerCase() === 'true',
  };
}
