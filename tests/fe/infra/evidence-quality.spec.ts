import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';

/*
 * @infra — ẢNH EVIDENCE RỖNG RUỘT (H3 của token-diet).
 *
 * "Có file ảnh" và "ảnh đúng màn" là hai chuyện, và cho tới nay không máy nào phân biệt — nên một case
 * PASS kèm ảnh trắng đi qua mọi cửa. Hai ca THẬT trong repo này, cả hai đã mở mắt kiểm:
 *
 *   · `CSDL_HSTRUONG_TC_138/step-01-passed.png` — 1280×720, 4 KB, TRẮNG HOÀN TOÀN, của step `passed`.
 *   · `CSDL_NHANSU_TC_121/step-01-failed.png` — 1280×720, 9 KB, nội dung là trang lỗi HTTP 503.
 *
 * NGƯỠNG KHÔNG ĐƯỢC ĐỔI BẰNG CẢM TÍNH. Nó đến từ 1.935 ảnh evidence thật, và có một khoảng trống rõ
 * trong phân bố: nhóm nghi ngờ cao nhất 0,0095, nhóm còn lại thấp nhất 0,0289. Test dưới khoá cả hai
 * mép của khoảng trống đó — ai muốn đổi ngưỡng phải đo lại, không chỉ sửa số.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const evq = require(path.join(REPO, 'scripts/qa/lib/evidence_quality.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const gate = require(path.join(REPO, 'scripts/qa/output_gate.js'));

/** Dựng PNG thật (không giả byte) với kích thước và độ "nhiễu" điều khiển được. */
function taoPng(w: number, h: number, nhieu: boolean): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0; // filter type 0
    for (let x = 0; x < w; x++) {
      /*
       * Nhiễu tất định trên 5% số dòng. Đo ra 0,1151 byte/pixel, gần trung vị thật của 1.935 ảnh
       * evidence (0,0851). Bản đầu dùng `(x*prime + y*prime)` trên mọi pixel và nó nén xuống 0,0187 —
       * DƯỚI ngưỡng 0,02, nên chính "ảnh có nội dung" của fixture lại bị bắt. Fixture không giống dữ
       * liệu thật thì nó đang kiểm một thứ khác với thứ đang chạy.
       */
      let v = 0xff;
      if (nhieu && y % 20 === 0) {
        let z = (x * 73856093) ^ (y * 19349663);
        z = (z ^ (z >>> 13)) * 1274126177;
        v = (z >>> 5) & 0xff;
      }
      raw[o++] = v; raw[o++] = v; raw[o++] = v;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit, truecolour
  const chunk = (ten: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([Buffer.from(ten, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([len, body, crc]);
  };
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* CRC32 cho chunk PNG — bảng dựng một lần. */
const BANG = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = BANG[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function ghiTam(buf: Buffer): { f: string; dir: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eq-'));
  const f = path.join(dir, 'step-01-passed.png');
  fs.writeFileSync(f, buf);
  return { f, dir };
}

test.describe('@infra evidence rỗng ruột — "có ảnh" khác "ảnh đúng màn"', () => {
  test('ảnh gần như một màu: BẮT', () => {
    const { f, dir } = ghiTam(taoPng(1280, 720, false));
    try {
      const r = evq.anhNgheo(f);
      expect(r.ngheo, 'ảnh trắng 1280×720 phải bị bắt').toBe(true);
      expect(r.ly_do, 'phải nêu số đo, không chỉ phán').toMatch(/byte\/pixel/);
      expect(r.ly_do).toMatch(/1280×720/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('CHỐNG BÁO OAN — ảnh có nội dung: THA', () => {
    const { f, dir } = ghiTam(taoPng(1280, 720, true));
    try {
      expect(evq.anhNgheo(f).ngheo, 'ảnh nhiễu nén kém, phải đi qua').toBe(false);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('không đọc được thì KHÔNG kết luận, và nói rõ là không đo được', () => {
    /*
     * Im lặng cho qua và "đã kiểm, đạt" trông giống hệt nhau trên báo cáo. File hỏng phải nói ra.
     */
    const r = evq.anhNgheo(path.join(os.tmpdir(), 'khong-co-that.png'));
    expect(r.ngheo).toBe(false);
    expect(r.ly_do, 'phải nói rõ là KHÔNG kết luận').toMatch(/KHÔNG kết luận/);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eq-'));
    const f = path.join(dir, 'gia.png');
    try {
      fs.writeFileSync(f, Buffer.from('day khong phai png, chi la chu'));
      expect(evq.anhNgheo(f).ngheo, 'file không phải PNG cũng không được kết luận bừa').toBe(false);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('NGƯỠNG đến từ số đo, và hai mép khoảng trống được khoá', () => {
    /*
     * Ngưỡng 0,02 nằm giữa khoảng trống đo được: nhóm nghi ngờ cao nhất 0,0095, nhóm còn lại thấp nhất
     * 0,0289. Ai đổi ngưỡng ra ngoài khoảng đó là đang đổi kết luận trên dữ liệu đã đo, và phải đo lại.
     */
    expect(evq.NGUONG_BPP).toBeGreaterThan(0.0095);
    expect(evq.NGUONG_BPP).toBeLessThan(0.0289);
    expect(evq.MAU_SO_DA_DO, 'phải giữ mẫu số đã đo, nếu không lần sau không ai biết ngưỡng dựa vào đâu')
      .toBeGreaterThan(1000);
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/lib/evidence_quality.js'), 'utf8');
    expect(src, 'giới hạn phải ghi trong chính file: nó KHÔNG đọc được nội dung')
      .toMatch(/heuristic về ĐỘ NÉN/);
    expect(src, 'và phải nói rõ nó không bắt được ảnh sai màn').toMatch(/sai màn/);
  });

  test('output_gate CHẶN case PASS kèm ảnh rỗng ruột, và không chặn ảnh thật', () => {
    const xau = ghiTam(taoPng(1280, 720, false));
    const tot = ghiTam(taoPng(1280, 720, true));
    try {
      const chay = (ev: string) => gate.gateTestExecution({
        tests: [{
          tcId: 'T_001', status: 'PASS', comment: '- mở màn và kiểm nhãn',
          evidence: [ev], steps: [{ status: 'PASS', comment: '- bước 1', evidence: [ev] }],
        }],
      });
      const do_ = chay(xau.f).problems.filter((p: string) => /RỖNG RUỘT/.test(p));
      expect(do_.length, 'đúng MỘT dòng, không báo trùng cho cùng một file').toBe(1);
      expect(do_[0]).toContain('T_001');
      expect(chay(tot.f).problems.filter((p: string) => /RỖNG RUỘT/.test(p)), 'ảnh thật phải sạch').toEqual([]);
    } finally {
      fs.rmSync(xau.dir, { recursive: true, force: true });
      fs.rmSync(tot.dir, { recursive: true, force: true });
    }
  });

  test('file evidence KHÔNG có trên đĩa thì bỏ qua im lặng, không báo hai lần', () => {
    /*
     * Thiếu file đã có luật khác lo. Báo hai lần cho cùng một chuyện là tiếng ồn, và tiếng ồn làm người
     * đọc bỏ qua cả dòng thật.
     */
    const r = gate.gateTestExecution({
      tests: [{
        tcId: 'T_002', status: 'PASS', comment: '- ok',
        evidence: ['khong/co/that/step-01.png'],
        steps: [{ status: 'PASS', comment: '- b1', evidence: ['khong/co/that/step-01.png'] }],
      }],
    });
    expect(r.problems.filter((p: string) => /RỖNG RUỘT/.test(p))).toEqual([]);
  });
});
