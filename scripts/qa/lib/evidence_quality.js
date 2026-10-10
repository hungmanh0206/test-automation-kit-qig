'use strict';

/*
 * evidence_quality.js — bắt ẢNH EVIDENCE RỖNG RUỘT (H3 của token-diet).
 *
 * VÌ SAO, và đây là hai ca THẬT trong repo này chứ không phải tình huống nghĩ ra:
 *
 *   · `CSDL_HSTRUONG_TC_138/step-01-passed.png` — 1280×720, 4 KB, **trắng hoàn toàn**. Nó là evidence
 *     của một step đã chấm `passed`.
 *   · `CSDL_NHANSU_TC_121/step-01-failed.png` — 1280×720, 9 KB, nội dung là **trang lỗi HTTP 503**
 *     "Service Unavailable". Không phải màn đang kiểm.
 *
 *   Và commit `a39c7df` ghi thêm một ca nữa: "ảnh evidence của nó là popup trắng đang quay spinner",
 *   trên một case vẫn PASS.
 *
 * `CLAUDE.md` mục 4 đòi ảnh **đúng màn**. Nhưng "có file ảnh" và "ảnh đúng màn" là hai chuyện, và từ
 * trước tới nay không máy nào phân biệt — nên một case PASS kèm ảnh trắng đi qua mọi cửa.
 *
 * CÁCH ĐO, và vì sao không dùng phương sai pixel: giải nén PNG cần thư viện, mà kit cố ý không thêm
 * dependency cho một phép kiểm. Dùng **byte trên mỗi pixel** của chính file PNG — ảnh gần như một màu nén
 * xuống rất nhỏ, ảnh có nội dung thì không.
 *
 * NGƯỠNG LẤY TỪ SỐ ĐO, không từ cảm tính. Đo 10/10/2026 trên **1.935 ảnh evidence step** của 4 task thật:
 *
 *   min 0,0046 · p1 0,0289 · p5 0,0398 · p25 0,0625 · trung vị 0,0851 · max 0,4018
 *
 * Có một KHOẢNG TRỐNG rõ: cao nhất trong nhóm nghi ngờ là 0,0095, thấp nhất của nhóm còn lại là 0,0289.
 * Ngưỡng 0,02 nằm giữa khoảng trống đó, bắt đúng 12/1.935 ảnh (0,6%). Đã mở mắt kiểm hai đầu: ảnh dưới
 * ngưỡng là trắng và là trang 503; ảnh ngay trên ngưỡng (0,0223) là màn đo DB có nội dung thật.
 *
 * GIỚI HẠN, nói rõ: đây là heuristic về ĐỘ NÉN, không phải phép đọc nội dung. Nó KHÔNG phát hiện được ảnh
 * chụp đúng độ phức tạp nhưng sai màn. Việc đó cần oracle, không cần thêm ngưỡng.
 */

const fs = require('fs');

/** Ngưỡng byte-trên-pixel. Dưới mức này coi là ảnh rỗng ruột. Xem khối trên để biết nó từ đâu ra. */
const NGUONG_BPP = 0.02;

/** Số ảnh đã đo khi đặt ngưỡng, giữ lại để lần sau biết mẫu số. */
const MAU_SO_DA_DO = 1935;

/** Đọc kích thước PNG từ header IHDR. Trả `null` nếu không phải PNG đọc được. */
function docPng(file) {
  let b;
  try { b = fs.readFileSync(file); } catch (e) { return null; }
  if (b.length < 24) return null;
  // Chữ ký PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b[0] !== 0x89 || b[1] !== 0x50 || b[2] !== 0x4e || b[3] !== 0x47) return null;
  const w = b.readUInt32BE(16);
  const h = b.readUInt32BE(20);
  if (!w || !h) return null;
  return { w, h, bytes: b.length, bpp: b.length / (w * h) };
}

/**
 * Ảnh có rỗng ruột không.
 * Trả `{ ngheo: boolean, ly_do?: string, do?: object }`. File không đọc được hoặc không phải PNG thì
 * KHÔNG kết luận — `ngheo: false` kèm `ly_do` nói rõ là không đo được, chứ không im lặng cho qua.
 */
function anhNgheo(file) {
  const m = docPng(file);
  if (!m) return { ngheo: false, ly_do: 'không đọc được header PNG — không phải PNG, hoặc file hỏng. KHÔNG kết luận.' };
  if (m.bpp >= NGUONG_BPP) return { ngheo: false, do: m };
  const kb = Math.round(m.bytes / 1024);
  return {
    ngheo: true,
    do: m,
    ly_do: `${m.w}×${m.h} mà chỉ ${kb} KB (${m.bpp.toFixed(4)} byte/pixel, ngưỡng ${NGUONG_BPP}). `
      + 'Ảnh gần như một màu: nhiều khả năng là màn trắng, spinner, hoặc trang lỗi — không phải màn đang kiểm.',
  };
}

module.exports = { docPng, anhNgheo, NGUONG_BPP, MAU_SO_DA_DO };
