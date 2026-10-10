'use strict';

/*
 * config_load.js — ĐỌC CONFIG CỦA MỘT GATE, và KHÔNG ĐƯỢC IM LẶNG KHI THIẾU.
 *
 * VÌ SAO CÓ FILE NÀY. Đo 10/10/2026, trên bản ĐÃ ĐÓNG GÓI (`npm run package:kit` rồi giải nén):
 *
 *   · `.agent/config/*` trong `package_kit.js` là DENY mặc định, ALLOW theo danh sách. Danh sách đó
 *     thiếu 16 file mà `scripts/**` có đọc.
 *   · Ba file bị thiếu được nạp bằng `require()` — `design_techniques.json`, `ui_components.json`,
 *     `checklist_types.json` — nên gói KHÔNG nạp nổi `md_to_xlsx.js`, và `npx playwright test
 *     tests/fe/infra` trong gói chết ngay lúc collect: `Cannot find module
 *     '../../../.agent/config/design_techniques.json'`.
 *   · Số còn lại đọc bằng `try { readFileSync } catch { return <rỗng> }`, nên chúng KHÔNG nổ — chúng
 *     tắt phép kiểm rồi đi tiếp. `na_reasons_rejected.json` (gate "lý do n/a đã bị bác") và
 *     `risk_model.json` (`depthPolicy` — nguồn duy nhất của ngưỡng độ sâu) đều thuộc nhóm này.
 *
 * Hai hành vi hỏng rất khác nhau, và nhóm thứ hai TỆ HƠN: nổ thì có người sửa, còn tắt im lặng thì
 * bảng vẫn xanh và không ai biết phép kiểm đã ngừng làm việc. Trên máy dev không thấy gì cả, vì file
 * đang nằm untracked ngay cạnh.
 *
 * NÊN Ở ĐÂY CHỈ CÓ BA NƯỚC, không có nước thứ tư:
 *   ① có file  ⇒ dùng.
 *   ② thiếu    ⇒ KÊU rõ phép kiểm nào CHƯA ĐƯỢC GÁC (hoặc rơi về bản `.example` nếu có, và nói là đã rơi).
 *   ③ JSON hỏng ⇒ CHẶN (exit 1). File hỏng không được phép có cùng hệ quả với một danh sách rỗng hợp lệ.
 */

const fs = require('fs');
const path = require('path');

/** Đọc + parse, phân biệt rõ "không có" với "có mà hỏng". */
function doc(duong) {
  let raw;
  try { raw = fs.readFileSync(duong, 'utf8'); } catch (e) { return { thieu: true }; }
  try { return { data: JSON.parse(raw) }; } catch (e) { return { hong: e.message }; }
}

/**
 * Nạp một file config của gate.
 *
 * @param {object} o
 * @param {string} o.duong       đường dẫn file thật
 * @param {string} o.nhan        tên file để in trong thông báo
 * @param {string} o.phepKiem    phép kiểm nào mất hiệu lực nếu thiếu — câu này đi vào thông báo
 * @param {string} [o.duPhong]   đường dẫn bản `.example` dùng tạm khi thiếu bản thật
 * @param {*}      [o.khiThieu]  giá trị trả khi thiếu và không có dự phòng
 * @param {(m:string)=>void} [o.keu]  nơi in cảnh báo (mặc định stderr)
 * @param {()=>never} [o.chan]   nơi chặn (mặc định process.exit(1))
 */
function napConfigGate(o) {
  const keu = o.keu || ((m) => console.error(m));
  const chan = o.chan || (() => process.exit(1));

  const r = doc(o.duong);
  if (r.hong) {
    keu(`[config] ✗ ${o.nhan} HỎNG JSON: ${r.hong}`);
    keu(`  ${o.duong}`);
    keu('  File hỏng KHÔNG được coi như rỗng — sửa JSON rồi chạy lại.');
    return chan();
  }
  if (!r.thieu) return r.data;

  if (o.duPhong) {
    const d = doc(o.duPhong);
    if (d.hong) {
      keu(`[config] ✗ bản dự phòng ${path.basename(o.duPhong)} HỎNG JSON: ${d.hong}`);
      return chan();
    }
    if (!d.thieu) {
      keu(`[config] ⚠ thiếu ${o.nhan} ⇒ tạm dùng ${path.basename(o.duPhong)}.`);
      keu(`  Phần chung vẫn chạy, nhưng số liệu riêng của dự án thì KHÔNG có. Phép kiểm: ${o.phepKiem}`);
      return d.data;
    }
  }

  keu(`[config] ⚠ thiếu ${o.nhan} ⇒ ${o.phepKiem} CHƯA ĐƯỢC GÁC.`);
  keu('  Không có file thì phép kiểm đó đi qua mà không ai đối chiếu. Đây là lớp GENERIC, phải có trong bản phát hành.');
  return 'khiThieu' in o ? o.khiThieu : null;
}

module.exports = { napConfigGate, doc };
