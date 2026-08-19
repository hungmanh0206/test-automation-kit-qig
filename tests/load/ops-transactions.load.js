// Load test k6 (Loại B) — OPS: danh sách giao dịch. READ-ONLY, non-prod.
// Chạy: npm run load -- --script tests/load/ops-transactions.load.js --base <OPS_API_BASE_URL> --confirm-nonprod
//
// AUTH: k6 nuốt system env mặc định → token lấy từ môi trường (TASK_ENV/shell), KHÔNG hardcode.
//   Token TTL ~30' ở UAT → lấy 1 lần trong setup() rồi chia cho mọi VU. TUYỆT ĐỐI không để mỗi VU tự
//   login: 5 VU login liên tục là dính throttle/lockout, và đo ra thời gian của form login chứ không phải API.
// AN TOÀN: chỉ GET (không tạo/sửa/xoá dữ liệu UAT). Giữ VU/duration khiêm tốn vì UAT dùng chung với DEV.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = (__ENV.BASE_URL || '').replace(/\/$/, '');
const TOKEN = __ENV.OPS_LOAD_TOKEN || __ENV.OPS_API_TOKEN || '';
const PAGE_SIZE = __ENV.PAGE_SIZE || '20';

export const options = {
  // KHÔNG khai stages ở đây: đây là baseline load PHẲNG, để wrapper áp cap mặc định (5 VU / 30s).
  // Muốn stress/spike/soak → viết script riêng có `stages` và chạy KHÔNG kèm --vus/--duration.
  thresholds: {
    // Ngưỡng CHỨC NĂNG (không phải SLA): request phải thành công thì số đo mới có nghĩa.
    http_req_failed: ['rate<0.01'],
    // NGƯỠNG HỒI QUY — KHÔNG PHẢI SLA. Dự án chưa có NFR cho endpoint này; số dưới đây suy từ baseline
    // id "ops-transactions" (knowledge/metrics/perf-baselines.jsonl), 4 mẫu clean ngày 2026-08-12,
    // k6 v2.2.0, profile 5 VU/30s, env uat:
    //     p95    : 252–356 ms (median 291) → biên độ 36%
    //     median : 180–217 ms (median 190) → biên độ 19%
    // p95 quá nhiễu ở cỡ mẫu/thời lượng này → gác chính đặt ở MEDIAN (ổn định gấp đôi), p95 để xa cho
    // khỏi flap. Mục đích là bắt HỒI QUY (chậm đi rõ rệt so với chính mình), không phải phán "đủ nhanh".
    // Có NFR thật thì thay bằng NFR và xoá đoạn này.
    http_req_duration: ['med<300', 'p(95)<500'],
  },
};

export function setup() {
  if (!TOKEN) throw new Error('Thiếu OPS_LOAD_TOKEN/OPS_API_TOKEN — export token tươi trước khi chạy.');
  return { token: TOKEN };
}

export default function (data) {
  const res = http.get(`${BASE}/api/v1/product-orders/transactions?page_index=1&page_size=${PAGE_SIZE}`, {
    headers: { Authorization: `Bearer ${data.token}` },
    tags: { endpoint: 'product-orders/transactions' },
  });
  check(res, {
    'status 200': (r) => r.status === 200,
    'không rỗng': (r) => r.body && r.body.length > 100,
    // 401 giữa chừng = token hết hạn, KHÔNG phải hệ thống gãy dưới tải — tách ra để đọc report không nhầm.
    'không 401 (token còn hạn)': (r) => r.status !== 401,
  });
  sleep(1);
}
