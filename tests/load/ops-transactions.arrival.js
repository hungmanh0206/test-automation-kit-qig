// Arrival-rate k6 (Loại B) — giữ SỐ REQUEST/GIÂY cố định theo từng bậc. READ-ONLY, non-prod.
// Chạy: npm run load -- --script tests/load/ops-transactions.arrival.js --base <url> --confirm-nonprod
//   ⚠ KHÔNG truyền --vus/--duration (CLI k6 đè scenarios).
//
// VÌ SAO CẦN, KHI ĐÃ CÓ stress.js:
//   Script VU-based giữ số VU cố định → mỗi VU gửi xong mới gửi tiếp. Server chậm đi thì VU phải chờ lâu hơn,
//   nên TẢI TỰ GIẢM: bài test tự bảo vệ server và che mất vấn đề (thấy latency nhích lên thay vì thấy hàng đợi vỡ).
//   Arrival-rate giữ đúng req/s bất kể server nhanh chậm — giống người dùng thật (họ không chờ nhau).
//
// ĐỌC KẾT QUẢ: `dropped_iterations` là chỉ số quan trọng nhất ở đây. >0 nghĩa là k6 đã cạn maxVUs và
// KHÔNG duy trì nổi rate mục tiêu — tức hệ thống không hấp thụ kịp. Latency đẹp mà dropped>0 = vẫn hỏng.
import http from 'k6/http';
import exec from 'k6/execution';
import { Trend } from 'k6/metrics';
import { check } from 'k6';

const BASE = (__ENV.BASE_URL || '').replace(/\/$/, '');
const TOKEN = __ENV.OPS_LOAD_TOKEN || __ENV.OPS_API_TOKEN || '';
const STEP = 45; // giây mỗi bậc — phải khớp stages bên dưới để chia Trend đúng bậc

// Rate hiện tại không đọc được trực tiếp từ runtime → chia theo mốc thời gian của từng bậc.
const r = [new Trend('dur_r10'), new Trend('dur_r20'), new Trend('dur_r40'), new Trend('dur_r60')];

export const options = {
  scenarios: {
    steps: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      // Trần VU: rate cao + server chậm ⇒ k6 cần thêm VU để giữ nhịp. Chặn ở đây để bài test không
      // tự leo thang vô hạn trên UAT dùng chung; cạn trần thì k6 drop iteration (và ta ĐỌC được điều đó).
      maxVUs: 60,
      stages: [
        { duration: '45s', target: 10 },
        { duration: '45s', target: 20 },
        { duration: '45s', target: 40 },
        { duration: '45s', target: 60 },
      ],
    },
  },
  thresholds: {
    // Hai van an toàn: lỗi nhiều, HOẶC chậm tới mức kéo lê hệ thống → k6 tự dừng.
    http_req_failed: [{ threshold: 'rate<0.10', abortOnFail: true, delayAbortEval: '20s' }],
    http_req_duration: [{ threshold: 'p(95)<2000', abortOnFail: true, delayAbortEval: '20s' }],
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
  const step = Math.min(3, Math.floor(exec.instance.currentTestRunDuration / 1000 / STEP));
  r[step].add(res.timings.duration);
  if (res.status !== 200) console.log(`[${Math.round(exec.instance.currentTestRunDuration / 1000)}s] STATUS=${res.status} ${Math.round(res.timings.duration)}ms body=${String(res.body).slice(0, 150)}`);
  check(res, { 'status 200': (x) => x.status === 200, 'không 401': (x) => x.status !== 401 });
  // KHÔNG sleep: arrival-rate tự điều tiết nhịp gửi; thêm sleep là làm sai chính mô hình tải.
}
