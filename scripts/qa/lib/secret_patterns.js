'use strict';

/*
 * secret_patterns — MỘT NGUỒN cho luật nhận diện secret.
 *
 * Vì sao tách ra: `secret_scan.js` (quét repo) và `package_kit.js` (quét chính gói phát hành) hỏi cùng một
 * câu hỏi. Chép luật sang chỗ thứ hai là tạo hai bản sẽ trôi khỏi nhau — và bản trôi chậm hơn sẽ là bản
 * canh cái cửa nguy hiểm hơn (gói phát ra ngoài không thu hồi được).
 *
 * Ghi chú kèm luật (đừng bỏ khi sửa): `CRED_FILE` khớp TÊN rồi phải XÁC NHẬN `CRED_CONTENT`. Chỉ tên là
 * không đủ — `.*-key.json` bắt luôn `knowledge/system/sap-sync__dealid-key.json` (một record nghiệp vụ) và
 * báo oan ngay lần chạy đầu. Gate báo oan một lần là mất uy tín vĩnh viễn.
 */

/** Secret thật — mỗi mẫu phải là thứ KHÔNG thể xuất hiện hợp lệ trong source. */
const PATTERNS = [
  { name: 'private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----/ },
  { name: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'github-token', re: /\bgh[pousr]_[0-9A-Za-z]{36,}\b/ },
  { name: 'gitlab-token', re: /\b(?:glpat|glrt)-[0-9A-Za-z_-]{20,}\b/ },
  { name: 'slack-token', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { name: 'google-service-account-key', re: /"private_key"\s*:\s*"-----BEGIN/ },
  { name: 'generic-secret-assign', re: /(?:password|passwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*['"][^'"\s]{12,}['"]/i },
  /*
   * DÒNG KIỂU FILE .env — giá trị KHÔNG có dấu nháy.
   *
   * Luật ngay trên đòi `['"]…['"]`, nên nó đúng với JSON và JS nhưng MÙ với chính hình dạng nguy hiểm
   * nhất: `OPS_PASSWORD=Tr4nsAct!on9xKp`. Đo 19/09/2026: tạo `.env.uat` chứa OPS_PASSWORD + BACKLOG_API_KEY,
   * `git add`, rồi chạy gate — gate báo OK. Cùng lúc `.gitignore` chỉ chặn `.env`, `.env.local`,
   * `.env.*.local`, `.env.bak*`, nên `.env.uat` cũng không bị chặn. Hai lỗ khớp nhau thành một đường
   * commit creds UAT lên mirror public mà mọi cửa đều xanh.
   *
   * Neo hẹp có chủ ý để không báo oan: khoá phải VIẾT HOA từ đầu dòng (hình dạng của file env), không bắt
   * `const apiKey = req.body.apiKey` trong source. Bộ lọc PLACEHOLDER ở `secret_scan.js` vẫn áp dụng, nên
   * `OPS_PASSWORD=your-password-here` và `${OPS_PASSWORD}` không tính.
   */
  { name: 'env-assign-unquoted', re: /^(?:export\s+)?[A-Z][A-Z0-9_]*(?:PASSWORD|PASSWD|SECRET|TOKEN|APIKEY|API_KEY|CREDENTIAL)[A-Z0-9_]*\s*=\s*[^\s'"#]{8,}\s*$/ },
];

const CRED_FILE = /^(service_account.*\.json|.*oauth-credentials.*\.json|token\.json.*|credentials\.json|.*-key\.json)$/i;
const CRED_CONTENT = /"private_key"\s*:|BEGIN (RSA |EC )?PRIVATE KEY|"client_secret"\s*:|"refresh_token"\s*:/;

/*
 * DẤU HIỆU LỚP PROJECT — chỉ dùng khi quét GÓI PHÁT HÀNH, không dùng khi quét repo (repo ĐƯƠNG NHIÊN có
 * những thứ này). Đây không phải secret; nó là **oracle của dự án khác**: phát bản đồ cột/host của dự án A
 * cho dự án B là đưa họ kết luận sai mà vẫn "có số từ DB".
 *
 * CỐ Ý KHÔNG dùng regex email/SĐT khi quét source: source hợp lệ đầy email mẫu (`your-email@company.com`),
 * email tác giả trong `package-lock.json`, URL SSH `git@host`, và chuỗi mẫu trong `sanitize.js`. Bản đầu của
 * `package_kit` dùng regex email và báo oan đúng 4 chỗ đó — PII của khách nằm ở `outputs/**`, `knowledge/**`,
 * `profiles/**`, mà những đường đó bị loại theo CẤU TRÚC rồi.
 */
const PROJECT_MARKERS = [
  { name: 'host DB của dự án', re: /\bdb-uat\.[a-z0-9.-]+\b/i },
];

/*
 * TÊN BẢNG phải lấy TỪ CHÍNH DỰ ÁN, không hardcode.
 *
 * Bản trước ghi cứng tiền tố bảng của một dự án vào đây. Hệ quả có hai đầu và đầu nào cũng tệ: dự án đó đi
 * rồi thì marker thành luật chết, không chặn được gì; còn dự án mới thì tên bảng của họ KHÔNG nằm trong
 * marker nên gói vẫn phát ra ngoài kèm tên bảng thật của họ. Nay suy từ `db.conventions.json` — nơi mỗi dự
 * án đã phải khai bảng của mình rồi, nên marker tự đúng theo dự án đang chạy mà không ai phải nhớ cập nhật.
 *
 * Chưa khai bảng nào ⇒ trả rỗng. Đó là trạng thái đúng: không có gì để rò thì không chặn oan.
 */
function markersFromConventions(root) {
  let conv;
  try {
    conv = JSON.parse(require('fs').readFileSync(
      require('path').join(root, '.agent', 'config', 'db.conventions.json'), 'utf8'));
  } catch (e) { return []; }
  const names = new Set();
  const take = (o) => { for (const k of Object.keys(o || {})) if (!k.startsWith('_')) names.add(k); };
  take((conv.softDelete || {}).byEntity);
  take((conv.money || {}).entities);
  take((conv.rates || {}).entities);
  take(conv.relations);
  if ((conv.fieldMap || {}).entity) names.add(conv.fieldMap.entity);
  for (const k of Object.keys((conv.fieldMap || {}).valueMaps || {})) {
    if (!k.startsWith('_') && k.includes('.')) names.add(k.split('.')[0]);
  }
  return [...names]
    .filter((n) => /^[A-Za-z_][A-Za-z0-9_]{2,}$/.test(n))
    .map((n) => ({ name: `bảng DB của dự án (${n})`, re: new RegExp(`\\b${n}\\b`) }));
}

module.exports = { PATTERNS, CRED_FILE, CRED_CONTENT, PROJECT_MARKERS, markersFromConventions };
