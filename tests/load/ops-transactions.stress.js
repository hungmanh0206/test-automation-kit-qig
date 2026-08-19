// Stress ramp k6 (Loại B) — OPS danh sách giao dịch. READ-ONLY, non-prod.
// Chạy: npm run load -- --script tests/load/ops-transactions.stress.js --base <url> --confirm-nonprod
//   ⚠ KHÔNG truyền --vus/--duration: CLI của k6 đè `stages` → ramp bị làm phẳng thành load thường.
//
// MỤC ĐÍCH: nhìn HÌNH DẠNG đường cong p95 theo mức tải, KHÔNG phải "tìm điểm gãy". Trên UAT dùng chung
// với DEV, cố tình làm gãy là làm hỏng môi trường của người khác. Ramp thoải, dừng ở 20 VU.
import http from 'k6/http';
import exec from 'k6/execution';
import { Trend } from 'k6/metrics';
import { check, sleep } from 'k6';

const BASE = (__ENV.BASE_URL || '').replace(/\/$/, '');
const TOKEN = __ENV.OPS_LOAD_TOKEN || __ENV.OPS_API_TOKEN || '';

// Summary gộp toàn run không cho biết p95 ở TỪNG mức VU — mà đó mới là thứ dựng ra đường cong.
// Tách Trend theo băng VU để đọc được "5 VU bao nhiêu, 20 VU bao nhiêu" trong 1 lần chạy.
const band = { '05': new Trend('dur_vu05'), 10: new Trend('dur_vu10'), 15: new Trend('dur_vu15'), 20: new Trend('dur_vu20') };
const bandOf = (v) => (v <= 6 ? '05' : v <= 11 ? 10 : v <= 16 ? 15 : 20);

export const options = {
  stages: [
    { duration: '40s', target: 5 },
    { duration: '40s', target: 10 },
    { duration: '40s', target: 15 },
    { duration: '40s', target: 20 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    // VAN AN TOÀN: lỗi vượt 10% thì k6 TỰ DỪNG — không ngồi dội tải vào một service đang gãy.
    // delayAbortEval để không abort vì vài lỗi lẻ ở giây đầu khi pool kết nối chưa ấm.
    http_req_failed: [{ threshold: 'rate<0.10', abortOnFail: true, delayAbortEval: '15s' }],
  },
};

export function setup() {
  if (!TOKEN) throw new Error('Thiếu OPS_LOAD_TOKEN — export token tươi trước khi chạy.');
  return { token: TOKEN };
}

export default function (data) {
  const res = http.get(`${BASE}/api/v1/product-orders/transactions?page_index=1&page_size=20`, {
    headers: { Authorization: `Bearer ${data.token}` },
  });
  band[bandOf(exec.instance.vusActive)].add(res.timings.duration);
  check(res, { 'status 200': (r) => r.status === 200, 'không 401': (r) => r.status !== 401 });
  sleep(1);
}
