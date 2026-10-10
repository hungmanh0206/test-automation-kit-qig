import fs from 'fs';
import path from 'path';

/*
 * _cfg — ĐƯỜNG DẪN CONFIG CHO SPEC HẠ TẦNG, có bản `.example` làm phương án hai.
 *
 * VÌ SAO CÓ FILE NÀY (đo 10/10/2026, trên bản ĐÃ ĐÓNG GÓI chứ không phải trên cây làm việc):
 *
 * `.agent/config/risk_model.json` và `db.conventions.json` thuộc lớp PROJECT, nên `package_kit.js` chỉ
 * mang bản `.example`. Nhưng ba spec hạ tầng lại `require` thẳng bản THẬT. Hệ quả: trong gói,
 * `tests/fe/infra` CHẾT NGAY LÚC COLLECT —
 *
 *     Error: Cannot find module '<goi>/.agent/config/risk_model.json'
 *       at fe/infra/depth-band-policy.spec.ts:27
 *
 * nên người nhận kit gõ `npx playwright test tests/fe/infra` lần đầu là thấy bộ kiểm không chạy nổi.
 * Và vì chưa ai chạy bộ infra TRONG gói, chuyện này sống qua hai bản phát hành.
 *
 * Điều đang kiểm là PHẦN CHUNG (vd `depthPolicy`), mà phần chung có y nguyên ở cả hai bản. Nên lấy bản
 * `.example` khi thiếu bản thật là ĐÚNG, không phải nới lỏng.
 *
 * KHÔNG trả về rỗng khi thiếu cả hai: ném lỗi nói rõ tên file. Trả rỗng là biến một config thiếu thành
 * một test xanh, đúng thứ cả đợt v2.4.1 này đi sửa.
 */

/** Đường dẫn config, ưu tiên bản thật rồi tới `.example`. Thiếu cả hai ⇒ ném lỗi nói rõ. */
export function duongCfg(repo: string, ten: string): string {
  const that = path.join(repo, '.agent', 'config', ten);
  if (fs.existsSync(that)) return that;

  const i = ten.lastIndexOf('.');
  const vd = path.join(repo, '.agent', 'config', `${ten.slice(0, i)}.example${ten.slice(i)}`);
  if (fs.existsSync(vd)) return vd;

  throw new Error(
    `[_cfg] thiếu CẢ HAI \`.agent/config/${ten}\` và bản \`.example\`. `
    + 'Spec này kiểm phần CHUNG của config nên bản `.example` là đủ — nhưng không có bản nào thì '
    + 'không kiểm được gì, và trả rỗng ở đây là biến config thiếu thành test xanh.',
  );
}

/** Đọc + parse config theo `duongCfg`. */
export function docCfg(repo: string, ten: string): any {
  return JSON.parse(fs.readFileSync(duongCfg(repo, ten), 'utf8'));
}
