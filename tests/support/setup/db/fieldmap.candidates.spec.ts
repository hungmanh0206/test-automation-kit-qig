import { test } from '@playwright/test';
import { queryUatReadonly, isUatDbConfigured } from './uatDbClient';

/*
 * TÌM ỨNG VIÊN NEO — bước TRƯỚC khi nghĩ đến fixture.
 *
 * Lý do tồn tại: 11 cột bị ghi "chưa neo" vì trong 6 ĐƠN đo tay, giá trị của chúng trùng cột khác hoặc NULL.
 * Nhưng "6 đơn tôi mở" không phải "mọi đơn": DB có hàng nghìn đơn, rất có thể đã có đơn mà cột đó tự phân
 * biệt. Hỏi DB trước thì neo được mà KHÔNG chạm dữ liệu UAT; chỉ cột nào DB cũng không có mới cần fixture.
 *
 * Chạy: INFRA_VERIFY=1 TASK_ENV=profiles/CSDL-24395/task.env … --project=infra-verify
 */
const PREFIX = 'LIB_MASTER_DB_RO';
const ORDERS = 'ic_payment_orders';
const MONEY = ['original_price', 'automatic_price', 'total_discount', 'deposit', 'final_price',
  'custom_price', 'service_fee', 'fee_per_month', 'service_fee_rate', 'fixed_discount'];

test.skip(!isUatDbConfigured(PREFIX), `chưa khai ${PREFIX}_*`);

test('cột tiền đang treo: có đơn nào giá trị TỰ PHÂN BIỆT không?', async () => {
  for (const target of ['deposit', 'custom_price', 'fee_per_month', 'fixed_discount']) {
    /*
     * "Phân biệt" = khác MỌI cột tiền khác trong CÙNG hàng. Dùng `IS DISTINCT FROM` chứ không `<>`/`NOT IN`:
     * với NULL thì `<>` trả NULL (hàng bị loại oan) còn `IS DISTINCT FROM` trả TRUE — mà khác NULL đúng là
     * phân biệt được. Đây là chỗ dễ sai nhất: dùng `NOT IN (...)` có NULL là kết quả rỗng, rồi kết luận
     * "DB không có đơn nào" trong khi có.
     */
    const cond = MONEY.filter((c) => c !== target).map((c) => `"${target}" IS DISTINCT FROM "${c}"`).join(' AND ');
    const rows = await queryUatReadonly<{ id: string; order_type: string; v: string; created_at: string }>(
      `SELECT id::text, order_type::text, "${target}"::text AS v, created_at::text
         FROM ${ORDERS}
        WHERE "${target}" IS NOT NULL AND "${target}"::numeric <> 0 AND deleted_at IS NULL AND ${cond}
        ORDER BY created_at DESC LIMIT 5`,
      [], { dbPrefix: PREFIX });
    console.log(`[cand] ${target.padEnd(15)} ${rows.length ? `${rows.length} đơn ứng viên` : 'KHÔNG có đơn nào ⇒ cần fixture'}`);
    for (const r of rows) console.log(`         ${r.id}  ${String(r.order_type).padEnd(14)} ${target}=${r.v}  ${r.created_at.slice(0, 10)}`);
  }
});

test('cột không-phải-tiền đang treo: có giá trị gì trong DB?', async () => {
  for (const target of ['order_type', 'payment_method', 'sync_status', 'full_name', 'service_fee_type']) {
    const rows = await queryUatReadonly<{ v: string; n: string }>(
      `SELECT COALESCE("${target}"::text, '<NULL>') AS v, COUNT(*)::text AS n
         FROM ${ORDERS} WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
      [], { dbPrefix: PREFIX });
    const nonNull = rows.filter((r) => r.v !== '<NULL>');
    console.log(`[cand] ${target.padEnd(17)} ${nonNull.length ? `${nonNull.length} giá trị thật: ${nonNull.map((r) => `${r.v}(${r.n})`).join(' ')}` : 'TOÀN NULL ⇒ app không ghi cột này'}`);
  }
});
