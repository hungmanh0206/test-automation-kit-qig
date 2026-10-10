import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * @infra — `matrix:coverage` (v2.5.0 G1.9): pairwise phủ CẶP GIÁ TRỊ, không phủ KẾT QUẢ.
 *
 * Ma trận pairwise bảo đảm mọi cặp giá trị giữa hai chiều bất kỳ xuất hiện ít nhất một lần, và đó là lý do
 * nó rẻ. Nhưng nó KHÔNG bảo đảm mọi lớp kết quả xuất hiện: một chức năng có 3 kết quả theo spec hoàn toàn
 * có thể chỉ được chạm 2, và bảng coverage vẫn báo "pairwise 100%".
 *
 * ⚠️ ĐO 10/10/2026 — PHẢI NÓI RA: repo có **0 file `*_matrix.md`** trong cả 5 task. 11 file tên "matrix"
 * đều là `traceability-matrix` hoặc `fixture-matrix`, việc khác hẳn. Tức skill `combinatorial_matrix` chưa
 * từng sinh artifact nào, và gate này HIỆN CHƯA GÁC DỮ LIỆU THẬT NÀO — nó chỉ có hiệu lực từ file ma trận
 * đầu tiên. Vì vậy nó được viết để KHÔNG BAO GIỜ in "ĐẠT" khi chưa có gì để gác, và test dưới đây khoá
 * đúng tính chất đó: một gate không gác gì mà báo xanh thì tệ hơn là không có gate.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const MC = path.join(REPO, 'scripts/qa/matrix_coverage.js');

const KHOI = `## Lớp kết quả

| Mã | Lớp kết quả | oracle_ref |
|---|---|---|
| OC-1 | Lưu thành công | BR-HS-001 |
| OC-2 | Chặn vì sai định dạng email | BR-HS-012 |
| OC-3 | Chặn vì trùng mã định danh | BR-HS-016 |
`;

const BANG = (ma: string[]) => `## Ma trận

| # | Cấp học | Email | Lớp kết quả | Kết quả mong đợi |
|---|---|---|---|---|
${ma.map((m, i) => `| ${i + 1} | THCS | hợp lệ | ${m} | kết quả theo spec |`).join('\n')}
`;

function chay(files: Record<string, string>, argv = ['--enforce']) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mtxcov-'));
  for (const [n, body] of Object.entries(files)) fs.writeFileSync(path.join(d, n), body, 'utf8');
  const r = spawnSync(process.execPath, [MC, '--dir', d, ...argv], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}`, d };
}

test.describe('@infra matrix:coverage — phủ lớp kết quả', () => {
  test('phủ đủ 3 lớp ⇒ ĐẠT', () => {
    const r = chay({ 'a_matrix.md': `# M\n\n${KHOI}\n${BANG(['OC-1', 'OC-2', 'OC-3'])}` });
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/3\/3 lớp kết quả có bộ phủ/);
    expect(r.out).toMatch(/✓ ĐẠT/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('thiếu MỘT lớp ⇒ CHẶN, và gọi đúng mã lớp còn thiếu', () => {
    const r = chay({ 'a_matrix.md': `# M\n\n${KHOI}\n${BANG(['OC-1', 'OC-2'])}` });
    expect(r.code, r.out).toBe(1);
    expect(r.out, 'phải gọi tên lớp thiếu, không báo chung chung').toContain('OC-3');
    expect(r.out, 'và nói vì sao pairwise không bảo đảm chuyện này').toMatch(/phủ cặp giá trị, không phủ kết quả/);
    expect(r.out, 'OC-1/OC-2 đã phủ thì KHÔNG được nêu là thiếu').not.toMatch(/`OC-1`[^\n]*KHÔNG có bộ nào/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('lớp thiếu `oracle_ref` ⇒ CHẶN — mẫu số tự khai thì gate gác vô nghĩa', () => {
    const khoiThieu = KHOI.replace('| OC-2 | Chặn vì sai định dạng email | BR-HS-012 |', '| OC-2 | Chặn vì sai định dạng email |  |');
    const r = chay({ 'a_matrix.md': `# M\n\n${khoiThieu}\n${BANG(['OC-1', 'OC-2', 'OC-3'])}` });
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/OC-2.*oracle_ref|oracle_ref.*OC-2/s);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('bảng dùng mã CHƯA KHAI ⇒ CHẶN (sai chính tả, hoặc lớp chưa khai)', () => {
    const r = chay({ 'a_matrix.md': `# M\n\n${KHOI}\n${BANG(['OC-1', 'OC-2', 'OC-3', 'OC-9'])}` });
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('OC-9');
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('khai lớp mà bảng KHÔNG có cột `Lớp kết quả` ⇒ CHẶN — khai mà không truy được', () => {
    const bangKhongCot = `## Ma trận

| # | Cấp học | Email | Kết quả mong đợi |
|---|---|---|---|
| 1 | THCS | hợp lệ | Lưu được |
`;
    const r = chay({ 'a_matrix.md': `# M\n\n${KHOI}\n${bangKhongCot}` });
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/KHÔNG có cột/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });
});

test.describe('@infra matrix:coverage — "không có gì để gác" KHÔNG thành "đạt"', () => {
  test('0 file ma trận ⇒ nói rõ CHƯA GÁC GÌ, và KHÔNG in ĐẠT', () => {
    /* Đây là trạng thái THẬT của repo hôm nay: 0 file `*_matrix.md` trong cả 5 task. */
    const r = chay({}, ['--enforce']);
    expect(r.code, 'không có gì để gác thì không chặn oan').toBe(0);
    expect(r.out).toMatch(/CHƯA GÁC GÌ/);
    expect(r.out, 'và phải nói thẳng đây không phải đạt').toMatch(/KHÔNG phải đạt/);
    expect(r.out, 'tuyệt đối không được in ĐẠT').not.toMatch(/✓ ĐẠT/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('có file nhưng KHÔNG khai lớp nào ⇒ cảnh báo CHƯA ĐƯỢC GÁC, không in ĐẠT', () => {
    /*
     * Bản đầu của gate in "✓ ĐẠT" cho đúng ca này — báo xanh cho tình huống nó không làm gì. Hai tầng:
     * file chưa khai thì chỉ CẢNH BÁO (không chặn ma trận cũ), nhưng không được nói là đạt.
     */
    const r = chay({ 'a_matrix.md': `# M\n\n${BANG(['', ''])}` });
    expect(r.code, 'ma trận cũ chưa khai thì không chặn').toBe(0);
    expect(r.out).toMatch(/CHƯA ĐƯỢC GÁC/);
    expect(r.out).not.toMatch(/✓ ĐẠT/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('repo THẬT: 0 file `*_matrix.md` — số đo trong chú thích phải còn đúng', () => {
    /*
     * Neo số đo vào máy. Ngày có file ma trận đầu tiên, test này đỏ và người sửa sẽ phải cập nhật cả chú
     * thích "gate chưa gác dữ liệu thật nào" — câu đó lúc ấy không còn đúng nữa.
     */
    const ra: string[] = [];
    const di = (d: string, sau = 0) => {
      if (sau > 5) return;
      let es: fs.Dirent[];
      try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of es) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) di(p, sau + 1);
        else if (/_matrix\.md$/i.test(e.name)) ra.push(p);
      }
    };
    di(path.join(REPO, 'outputs'));
    expect(ra, 'có file ma trận đầu tiên ⇒ cập nhật chú thích của gate và của spec này').toEqual([]);
  });
});

test.describe('@infra matrix:coverage — bộ đọc bảng markdown', () => {
  test('`\\b` KHÔNG được dùng sau chữ có dấu — đã làm gate im lặng bỏ qua một file khai đủ', () => {
    /*
     * Lỗi thật lúc dựng: `RE_KHOI` viết `…kết quả)\b` và KHÔNG khớp `## Lớp kết quả`, vì `ả` không phải
     * word-char trong regex JS nên `\b` giữa `ả` và hết dòng là giữa hai ký tự non-word. Gate báo "chưa có
     * khối khai" cho một file khai đủ ba lớp. Cùng họ với `\bOPS\b` và `\btest(` trong cùng phiên.
     */
    const src = fs.readFileSync(MC, 'utf8');
    const xau = [...src.matchAll(/\/\^?[^/\n]*[^\x00-\x7F]\\b/g)].map((m) => m[0]);
    expect(xau, '`\\b` ngay sau ký tự có dấu thì không bao giờ khớp').toEqual([]);
  });

  test('chỉ nhận bảng CÓ dòng gạch header — hàng `|…|` rời không phải bảng', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { docBang } = require('../../../scripts/qa/matrix_coverage.js');
    expect(docBang('| a | b |\nmột dòng văn\n'), 'thiếu dòng gạch ⇒ không phải bảng').toEqual([]);
    const b = docBang('| a | b |\n|---|---|\n| 1 | 2 |\n');
    expect(b).toHaveLength(1);
    expect(b[0].header).toEqual(['a', 'b']);
    expect(b[0].rows).toEqual([['1', '2']]);
  });
});
