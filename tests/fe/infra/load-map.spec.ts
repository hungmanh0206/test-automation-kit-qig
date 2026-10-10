import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/*
 * @infra — BẢN ĐỒ NẠP THEO ĐIỀU KIỆN (H2 của token-diet).
 *
 * Vì sao có file này: `npm run prompt:budget` đo chuỗi của `/phase1` ra 56 file, 143,2k token nếu đọc hết.
 * Trong đó chỉ 5,7k bắt buộc và 13,5k khai điều kiện rõ; **124k rơi vào cột chưa-phân-loại**, vì câu chứa
 * con trỏ không viết điều kiện ra. Máy không đọc được điều kiện thì agent phải đoán, và đoán rộng tay là
 * nạp hết.
 *
 * NÓI RÕ GIÁ TRỊ THẬT, vì dễ bị hiểu sai: đo động cho thấy một lượt chạy task thật chỉ `Read` 0 đến 4 file
 * tài liệu của kit, nên lợi ích token TRỰC TIẾP của H2 nhỏ. Giá trị là biến 124k chưa-phân-loại thành LỜI
 * KHAI máy kiểm được. Hai phép kiểm dưới đây là chỗ lời khai đó có hiệu lực:
 *   ① Mọi đường dẫn trong bản đồ phải tồn tại — bản đồ trỏ vào hư không thì tệ hơn không có bản đồ.
 *   ② Mọi file prompt trên đĩa phải có mặt trong bản đồ — thêm file mà không khai điều kiện nạp thì nó
 *      quay về đúng trạng thái "không ai biết khi nào cần đọc".
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MAP = require(path.join(REPO, '.agent/config/load_map.json'));

/** Mọi đường dẫn file mà bản đồ nhắc tới, gộp từ cả ba chỗ khai. */
function moiDuongDan(): string[] {
  const out: string[] = [];
  for (const [ten, l] of Object.entries<Record<string, unknown>>(MAP.luong)) {
    if (typeof l.diem_vao === 'string') out.push(l.diem_vao);
    for (const f of (l.bat_buoc as string[] | undefined) || []) out.push(f);
    for (const c of (l.co_dieu_kien as { file: string }[] | undefined) || []) out.push(c.file);
    const anh = l.anh_xa as Record<string, string> | undefined;
    if (anh) for (const f of Object.values(anh)) out.push(f);
    expect(ten.length, 'tên luồng rỗng').toBeGreaterThan(0);
  }
  return out;
}

/** Mọi file prompt trên đĩa. */
function moiFilePrompt(): string[] {
  const goc = path.join(REPO, 'prompt_templates');
  const out: string[] = [];
  const di = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) di(p);
      else if (e.name.endsWith('.md')) out.push(path.relative(REPO, p).replace(/\\/g, '/'));
    }
  };
  di(goc);
  return out.sort();
}

test.describe('@infra load_map — điều kiện nạp phải là lời khai, không phải phỏng đoán', () => {
  test('① mọi đường dẫn trong bản đồ đều TỒN TẠI', () => {
    const chet = moiDuongDan().filter((f) => !fs.existsSync(path.join(REPO, f)));
    expect(chet, `đường dẫn chết trong load_map: ${chet.join(', ')}`).toEqual([]);
  });

  test('② mọi file prompt trên đĩa đều CÓ MẶT trong bản đồ', () => {
    /*
     * Phép kiểm quan trọng nhất. Mất nó thì ai thêm một file prompt mới sẽ không phải khai điều kiện nạp,
     * và file đó quay về đúng trạng thái 124k chưa-phân-loại mà H2 đi xử.
     */
    const trongMap = new Set(moiDuongDan());
    const moCoi = moiFilePrompt().filter((f) => !trongMap.has(f));
    expect(moCoi, `file prompt chưa khai trong load_map: ${moCoi.join(', ')}`).toEqual([]);
  });

  test('mỗi mục có điều kiện phải NÓI điều kiện, không để trống', () => {
    for (const [ten, l] of Object.entries<Record<string, unknown>>(MAP.luong)) {
      for (const c of (l.co_dieu_kien as { file: string; khi?: string }[] | undefined) || []) {
        expect(String(c.khi || '').length, `${ten} · ${c.file}: thiếu điều kiện \`khi\``).toBeGreaterThan(15);
      }
    }
  });

  test('20 chiều coverage khớp ĐÚNG khoá của dimension_manifest', () => {
    /*
     * Ánh xạ chiều là chỗ H2 tiết kiệm thật: 20 file chiều, task chỉ mở chiều mình khai `required`. Nhưng
     * nó chỉ hoạt động nếu khoá ở đây khớp khoá mà `dim:coverage` đọc. Lệch một khoá là một chiều không
     * bao giờ được mở, và không ai thấy.
     */
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const covSrc = fs.readFileSync(path.join(REPO, 'scripts/qa/dimension_coverage.js'), 'utf8');
    const anh = MAP.luong.phase1_chieu_coverage.anh_xa as Record<string, string>;
    const khoa = Object.keys(anh);
    expect(khoa.length, 'phải đủ 20 chiều').toBe(20);
    for (const k of khoa) {
      expect(covSrc, `khoá chiều "${k}" không có trong dimension_coverage.js`).toContain(`'${k}'`);
    }
    for (const f of Object.values(anh)) {
      expect(fs.existsSync(path.join(REPO, f)), `file chiều không tồn tại: ${f}`).toBe(true);
    }
  });

  test('bản đồ tuyên bố rõ GIỚI HẠN của chính nó', () => {
    /*
     * Dễ bị trích dẫn sai thành "H2 giảm 124k token". Không phải. Con số token trực tiếp nhỏ, vì lượt chạy
     * thật chỉ đọc 0 đến 4 file tài liệu. Giới hạn đó phải nằm trong chính file config.
     */
    expect(MAP._khong_phai_de_giam_token_truoc_tien, 'thiếu lời tuyên bố giới hạn').toBeTruthy();
    expect(String(MAP._khong_phai_de_giam_token_truoc_tien)).toMatch(/0 đến 4 file/);
    expect(String(MAP._dieu_kien_viet_the_nao), 'phải nói rõ điều kiện nào CHƯA có máy kiểm')
      .toMatch(/chỉ người kiểm được/);
  });

  test('một file có thể bắt buộc ở luồng này và có điều kiện ở luồng khác', () => {
    /*
     * `04_execute_fe_playwright.md` bắt buộc ở phase2 nhưng có điều kiện ở rerun. Nếu spec gộp hai luồng
     * rồi đòi tính duy nhất thì nó sẽ bắt oan đúng trường hợp hợp lệ này.
     */
    const fe = 'prompt_templates/phase2/04_execute_fe_playwright.md';
    expect((MAP.luong.phase2.bat_buoc as string[])).toContain(fe);
    expect((MAP.luong.rerun.co_dieu_kien as { file: string }[]).map((c) => c.file)).toContain(fe);
    expect(MAP._bay_da_biet, 'cái bẫy này phải được ghi lại trong config').toMatch(/TỪNG luồng/);
  });
});
