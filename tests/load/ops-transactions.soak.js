// Soak k6 (Loại B) — giữ tải NHẸ trong thời gian DÀI để tìm degradation/rò tài nguyên. READ-ONLY, non-prod.
// Chạy: npm run load -- --script tests/load/ops-transactions.soak.js --base <url> --confirm-nonprod
//   ⚠ KHÔNG truyền --vus/--duration (sẽ đè stages → soak co lại thành 30s và kết luận vô nghĩa).
//
// TTL TOKEN: token UAT sống ~30' → soak để 20' và PHẢI lấy token tươi ngay trước khi chạy. Không refresh
// giữa chừng: token chết sẽ ra 401 hàng loạt, đọc nhầm thành "hệ thống gãy khi chạy lâu". Check 'không 401'
// bên dưới là để phân biệt đúng hai chuyện đó.
import http from 'k6/http';
import exec from 'k6/execution';
import { Trend, Counter } from 'k6/metrics';
import { check, sleep } from 'k6';

const BASE = (__ENV.BASE_URL || '').replace(/\/$/, '');
const TOKEN = __ENV.OPS_LOAD_TOKEN || __ENV.OPS_API_TOKEN || '';

// Degradation chỉ lộ ra khi so ĐẦU với CUỐI. Summary gộp cả run sẽ che mất xu hướng, nên chia theo phút thứ mấy.
const q = [new Trend('dur_q1_0_5m'), new Trend('dur_q2_5_10m'), new Trend('dur_q3_10_15m'), new Trend('dur_q4_15_20m')];
const unauth = new Counter('resp_401');

export const options = {
  // PHẢI tách 2 chặng: `[{duration:'20m', target:3}]` là RAMP 0→3 VU trải suốt 20 phút (đa số thời gian
  // chạy 1 VU), KHÔNG phải giữ 3 VU. Soak cần GIỮ tải ổn định thì mới so được đầu run với cuối run.
  stages: [
    { duration: '20s', target: 3 }, // lên tải
    { duration: '20m', target: 3 }, // GIỮ — đây mới là phần soak
  ],
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.10', abortOnFail: true, delayAbortEval: '30s' }],
  },
};

export function setup() {
  if (!TOKEN) throw new Error('Thiếu OPS_LOAD_TOKEN — export token tươi NGAY TRƯỚC khi chạy soak.');
  return { token: TOKEN };
}

export default function (data) {
  const res = http.get(`${BASE}/api/v1/product-orders/transactions?page_index=1&page_size=20`, {
    headers: { Authorization: `Bearer ${data.token}` },
  });
  const min = exec.instance.currentTestRunDuration / 60000;
  q[Math.min(3, Math.floor(min / 5))].add(res.timings.duration);
  if (res.status === 401) unauth.add(1);
  // Soak abort giữa chừng mà không biết vì mã gì thì mất luôn manh mối — ghi ra ngay tại trận.
  if (res.status !== 200) console.log(`[${Math.round(exec.instance.currentTestRunDuration / 1000)}s] STATUS=${res.status} ${Math.round(res.timings.duration)}ms body=${String(res.body).slice(0, 150)}`);
  check(res, { 'status 200': (r) => r.status === 200, 'không 401': (r) => r.status !== 401 });
  sleep(2);
}
