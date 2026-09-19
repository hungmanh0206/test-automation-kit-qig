/**
 * depth.js — mở rộng SÂU BAO NHIÊU theo risk band.
 *
 * VÌ SAO CẦN (lý do là chi phí đo được, không phải "cho gọn"): 1 task thật đang có **1021 file / 136 MB
 * evidence**. Chạy 5 trục cho MỌI case sẽ nhân số đó lên nhiều lần, kéo dài suite và nhân nhiễu flaky — rồi chính
 * cái đống artifact đó làm người đọc bỏ qua báo cáo. Nên độ sâu phải theo **risk band**, không phải theo hứng.
 *
 * Band lấy từ 2 cột đã có trong testcase canonical: `Mức độ rủi ro` (Blocker/Critical/Major/Minor) và
 * `Ưu tiên` (High/Medium/Low). Lấy **cái nặng hơn** trong hai cột — vì một case Minor mà Ưu tiên High thì vẫn là
 * đường tiền/đường chính, không được hạ độ sâu.
 */

const RISK_RANK = { blocker: 3, critical: 3, major: 2, minor: 1 };
/*
 * Thang `Ưu tiên` của AIO là Critical|High|Medium|Low|Lowest — PHẢI có đủ 5, đặc biệt `critical`.
 * Lỗi đo được 21/08/2026: thiếu `critical` nên case ưu tiên CAO NHẤT bị rank 0. Trên SAPP-26878 điều đó
 * ẩn đi vì cột `Mức độ rủi ro` đang gánh; thử bỏ cột đó thì 28 case `Critical` tụt band high → low, tức
 * từ 5 trục mở rộng còn 1 — sai đúng chiều nguy hiểm nhất (case quan trọng nhất bị soi mỏng nhất).
 */
const PRIO_RANK = { critical: 3, high: 3, medium: 2, low: 1, lowest: 1 };

// ①②③ cần runtime; ④⑤ case do Phase 1 sinh (Phase 2 chỉ đo ô nào chạy được); ⑥⑦ chỉ runtime mới thấy.
const PLAN = {
  high: ['field', 'surface', 'persist', 'concurrency', 'reverse'],
  medium: ['persist', 'state'],
  low: ['persist'],
};

/** Trả band 'high' | 'medium' | 'low' từ một testcase canonical. */
function bandOf(tc) {
  const r = RISK_RANK[String(tc && tc.risk || '').trim().toLowerCase()] || 0;
  const p = PRIO_RANK[String(tc && tc.priority || '').trim().toLowerCase()] || 0;
  const n = Math.max(r, p);
  if (n >= 3) return 'high';
  if (n === 2) return 'medium';
  return 'low';                                  // gồm cả trường hợp 2 cột đều rỗng: mặc định mỏng nhất
}

/** Các trục phải mở rộng cho một case. */
function axesFor(tc) {
  return PLAN[bandOf(tc)].slice();
}

/**
 * Ước lượng chi phí một lượt mở rộng, để QUYẾT TRƯỚC KHI CHẠY thay vì phát hiện sau khi đã đầy ổ đĩa.
 * Hệ số đo từ chính kit: mỗi bề mặt ≈ 1 page load ~7s settle; mỗi trục ≈ 1–2 ảnh evidence.
 */
function estimate(tcs) {
  const per = { field: { loads: 1, shots: 1 }, surface: { loads: 3, shots: 1 }, persist: { loads: 3, shots: 2 }, branch: { loads: 1, shots: 1 }, state: { loads: 2, shots: 1 }, concurrency: { loads: 2, shots: 2 }, reverse: { loads: 3, shots: 2 } };
  const bands = { high: 0, medium: 0, low: 0 };
  let loads = 0;
  let shots = 0;
  for (const tc of tcs || []) {
    const b = bandOf(tc);
    bands[b] += 1;
    for (const a of PLAN[b]) { loads += per[a].loads; shots += per[a].shots; }
  }
  return { bands, loads, shots, minutes: Math.round((loads * 9) / 60), mb: Math.round(shots * 0.14 * 10) / 10 };
}

module.exports = { PLAN, bandOf, axesFor, estimate };
