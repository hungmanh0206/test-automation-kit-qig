import { test } from '@playwright/test';
import path from 'path';
import { queryUatReadonly, isUatDbConfigured } from './uatDbClient';
import { loadConventions } from './config';

/*
 * TÌM ỨNG VIÊN NEO — bước TRƯỚC khi nghĩ đến fixture.
 *
 * Lý do tồn tại: một cột bị ghi "chưa neo" thường chỉ vì trong dăm bản ghi mở tay, giá trị của nó trùng cột
 * khác hoặc NULL. Nhưng "vài bản ghi tôi mở" không phải "mọi bản ghi": DB có hàng nghìn, rất có thể đã có
 * bản ghi mà cột đó tự phân biệt. Hỏi DB trước thì neo được mà KHÔNG chạm dữ liệu UAT; chỉ cột nào DB cũng
 * không có mới cần dựng fixture.
 *
 * KHÔNG ghi cứng tên bảng hay tên cột. Mọi thứ đọc từ `db.conventions.json` của chính repo — nơi dự án đã
 * phải khai bảng, cột tiền, cột tỉ lệ và danh sách cột đang treo. Bản trước ghi cứng bảng của một dự án nên
 * dự án sau chạy ra kết quả của dự án trước, hoặc lỗi bảng không tồn tại.
 *
 * Chạy: INFRA_VERIFY=1 TASK_ENV=profiles/<TASK_KEY>/task.env … --project=infra-verify
 */
const PREFIX = 'LIB_MASTER_DB_RO';
const REPO = path.resolve(__dirname, '..', '..', '..', '..');

const conv = (() => { try { return loadConventions(REPO); } catch (e) { return null; } })();
const fm = conv?.fieldMap;
const ENTITY = fm?.entity || '';
/** Cột tiền + cột tỉ lệ của chính bảng đó: đây là tập "cùng loại" để đo phân biệt. */
const NUMERIC = [
  ...((conv?.money?.entities || {})[ENTITY] || []),
  ...((conv?.rates?.entities || {})[ENTITY] || []),
];
/** Cột đang treo, tách làm hai nhóm vì hai câu hỏi khác nhau: "có bản ghi phân biệt không" vs "có giá trị gì". */
const PENDING = Object.keys(fm?.unanchored || {}).filter((k) => !k.startsWith('_')).map((k) => k.split('@')[0]);
const PENDING_NUMERIC = PENDING.filter((c) => NUMERIC.includes(c));
const PENDING_OTHER = PENDING.filter((c) => !NUMERIC.includes(c));

const SOFT = conv?.softDelete?.default?.column || 'deleted_at';
const q = (c: string) => `[${c.replace(/]/g, ']]')}]`;

test.skip(!isUatDbConfigured(PREFIX), `chưa khai ${PREFIX}_*`);
test.skip(!ENTITY || !PENDING.length,
  'db.conventions.json chưa khai `fieldMap.entity` hoặc chưa có cột nào ở `unanchored` — chưa có gì để đi tìm');

test('cột SỐ đang treo: có bản ghi nào giá trị TỰ PHÂN BIỆT không?', async () => {
  for (const target of PENDING_NUMERIC) {
    /*
     * "Phân biệt" = khác MỌI cột cùng loại trong CÙNG hàng, và khác cả khi một bên NULL.
     * Đây là chỗ dễ sai nhất: viết `target <> other` thì hàng có `other` NULL cho ra NULL nên bị loại OAN,
     * rồi kết luận "DB không có bản ghi nào" trong khi có. Nên phải so cả nhánh NULL một cách tường minh.
     */
    const cond = NUMERIC.filter((c) => c !== target)
      .map((c) => `(${q(c)} IS NULL OR ${q(target)} <> ${q(c)})`).join(' AND ');
    const rows = await queryUatReadonly<{ id: string; v: string }>(
      `SELECT TOP 5 CONVERT(varchar(64), ${q(conv!.idColumn)}) AS id, CONVERT(varchar(64), ${q(target)}) AS v
         FROM ${q(ENTITY)}
        WHERE ${q(target)} IS NOT NULL AND ${q(target)} <> 0 AND ${q(SOFT)} IS NULL
          ${cond ? `AND ${cond}` : ''}`,
      [], { dbPrefix: PREFIX });
    console.log(`[cand] ${target.padEnd(20)} ${rows.length ? `${rows.length} bản ghi ứng viên` : 'KHÔNG có bản ghi nào ⇒ cần fixture'}`);
    for (const r of rows) console.log(`         ${r.id}  ${target}=${r.v}`);
  }
});

test('cột KHÔNG phải số đang treo: có giá trị gì trong DB?', async () => {
  for (const target of PENDING_OTHER) {
    const rows = await queryUatReadonly<{ v: string; n: string }>(
      `SELECT TOP 8 COALESCE(CONVERT(varchar(128), ${q(target)}), '<NULL>') AS v, CONVERT(varchar(32), COUNT(*)) AS n
         FROM ${q(ENTITY)} WHERE ${q(SOFT)} IS NULL
        GROUP BY ${q(target)} ORDER BY COUNT(*) DESC`,
      [], { dbPrefix: PREFIX });
    const nonNull = rows.filter((r) => r.v !== '<NULL>');
    console.log(`[cand] ${target.padEnd(20)} ${nonNull.length
      ? `${nonNull.length} giá trị thật: ${nonNull.map((r) => `${r.v}(${r.n})`).join(' ')}`
      : 'TOÀN NULL ⇒ app không ghi cột này'}`);
  }
});
