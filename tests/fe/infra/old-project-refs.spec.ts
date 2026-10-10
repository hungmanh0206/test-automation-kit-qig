import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/*
 * @infra — LỚP GENERIC NHẮC DỰ ÁN TRƯỚC THÌ PHẢI NÓI RÕ LÀ DỰ ÁN TRƯỚC.
 *
 * LỖI THẬT, đo 10/10/2026 (G4.2). Ba kiểu khác nhau, và chỉ một kiểu là lỗi:
 *
 *  ① CHỈ DẪN nói về app HIỆN TẠI mà sai — `ui_debug_agent` khẳng định "App là ant-design + Metronic"
 *    trong khi app hiện tại là ASP.NET WebForms + Telerik. Kết luận của nó (tầng 5 locator là tầng chết)
 *    vẫn đúng, nhưng LÝ DO sai, và agent suy tiếp từ lý do sai sẽ đi tìm `.ant-select-*` trên một app
 *    không có nó. Đây là LỖI.
 *  ② Bảng trỏ tới FILE KHÔNG TỒN TẠI — `load_check` liệt kê 3 script `ops-transactions.*.js`, mà
 *    `tests/load/` chỉ còn `example.load.js`. Đây là LỖI, cùng lớp với "hai tài liệu dạy sai số cột" ở G4.1.
 *  ③ XUẤT XỨ của một phép đo thật — "đo thật trên OPS: mỗi khối là `div.collapsible-section__container`".
 *    Đây KHÔNG phải lỗi. Xoá chữ "OPS" khỏi những câu này là xoá nguồn của phép đo, biến số đo thành
 *    khẳng định không nguồn — tức làm hỏng đúng thứ kit coi là giá trị cốt lõi.
 *
 * NÊN LUẬT KHÔNG PHẢI "CẤM NHẮC DỰ ÁN CŨ". Luật là: file lớp GENERIC còn nhắc dự án cũ thì phải mang MỘT
 * dấu xuất xứ, để người đọc biết đoạn đó kể về hệ thống nào. Một gate cấm tiệt sẽ buộc người ta xoá kiểu ③,
 * và đó là thiệt hại chứ không phải sửa chữa.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');

/** Tên của dự án TRƯỚC. `\bOPS\b` chỉ bắt chữ đứng riêng — `opsLogin`/`ops-row-menu` là định danh, không bắt. */
const TEN_CU = /\bant-design\b|\bantd\b|\bMetronic\b|\bOPS\b|\bLMS\b/;

/**
 * Dấu xuất xứ. Đủ một trong các cách nói này là file đã tự khai đoạn đó kể về hệ thống nào.
 * Không đòi đúng một câu chữ: đòi câu chữ cố định thì người ta chép câu đó vào cho qua gate.
 */
const DAU_XUAT_XU = /dự án (?:trước|cũ)|xuất xứ|đo (?:thật )?(?:trên|ở) ops|hệ thống trước/i;

/** `.md` của lớp GENERIC — nơi người đọc lấy chỉ dẫn. */
function fileGeneric(): string[] {
  const ra: string[] = [];
  const di = (d: string, sau = 0) => {
    if (sau > 6) return;
    let es: fs.Dirent[];
    try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) di(p, sau + 1);
      else if (e.name.endsWith('.md')) ra.push(p);
    }
  };
  di(path.join(REPO, '.agent'));
  di(path.join(REPO, 'prompt_templates'));
  return ra;
}

test.describe('@infra lớp GENERIC — nhắc dự án trước thì phải khai xuất xứ', () => {
  test('file nào còn nhắc dự án trước đều mang dấu xuất xứ', () => {
    const xau: string[] = [];
    for (const f of fileGeneric()) {
      const t = fs.readFileSync(f, 'utf8').replace(/\r\n?/g, '\n');
      if (!TEN_CU.test(t)) continue;
      if (DAU_XUAT_XU.test(t)) continue;
      const dong = t.split('\n').findIndex((d) => TEN_CU.test(d)) + 1;
      xau.push(`${path.relative(REPO, f).split(path.sep).join('/')}:${dong}`);
    }
    expect(xau, 'nhắc dự án trước mà không khai xuất xứ ⇒ người đọc tưởng đang nói về app hiện tại').toEqual([]);
  });

  test('bảng "script mẫu trong kit" chỉ được trỏ tới file CÓ THẬT', () => {
    /*
     * Phép kiểm cho kiểu ② — và nó tổng quát hơn một lần sửa: mọi đường dẫn `tests/load/*.js` viết trong
     * skill phải tồn tại trên đĩa. Bản trước của bảng này trỏ tới 3 file đã đi theo dự án cũ.
     */
    const sk = path.join(REPO, '.agent/skills/phase2/load_check/SKILL.md');
    const t = fs.readFileSync(sk, 'utf8');
    const duong = [...t.matchAll(/`(tests\/load\/[A-Za-z0-9._-]+\.js)`/g)].map((m) => m[1]);
    expect(duong.length, 'không trích được đường dẫn nào — phép kiểm mất tác dụng, sửa phép trích').toBeGreaterThan(0);
    const thieu = duong.filter((d) => !fs.existsSync(path.join(REPO, d)));
    expect(thieu, 'skill trỏ tới file không tồn tại ⇒ người đọc đi tìm, không thấy, mất lòng tin cả trang').toEqual([]);
  });

  test('ÂM BẢN: phép quét không vô nghĩa', () => {
    expect(TEN_CU.test('App là ant-design + Metronic'), 'phải bắt khẳng định về stack').toBe(true);
    expect(TEN_CU.test('tài khoản OPS/LMS theo task'), 'phải bắt OPS đứng riêng').toBe(true);
    /*
     * Định danh thì KHÔNG bắt — helper login và `ops-row-menu__*.json` là tên thật đang dùng.
     *
     * Mẫu dưới đây CỐ Ý chỉ là tên file, KHÔNG viết thành câu import đầy đủ. `ci:scope` tìm spec chạm UAT
     * bằng cách đọc đường dẫn trong mệnh đề import, và bản đầu của test này đặt một mệnh đề như vậy vào
     * chuỗi mẫu ⇒ gate xếp nó là spec drive UAT. Dương tính giả, nhưng gate KHÔNG có cách nào phân biệt
     * chuỗi trong test với import thật, nên trách nhiệm là của test: đừng viết mệnh đề đó ra.
     *
     * Chú thích này cũng đã phải viết lại một lần, vì bản đầu của NÓ dẫn nguyên văn mệnh đề import để giải
     * thích — và thế là tự gây lại đúng lỗi nó đang cảnh báo. Cùng lớp với `column-count.spec.ts`, nơi gate
     * đi bắt đúng câu đã cảnh báo về lỗi số cột.
     */
    expect(TEN_CU.test('opsLogin.ts · opsAuth.ts'), 'KHÔNG bắt tên định danh').toBe(false);
    expect(TEN_CU.test('ops-row-menu__flaky-3-cham.json'), 'KHÔNG bắt tên file knowledge').toBe(false);
    /* Và dấu xuất xứ phải thật sự nhận ra được các cách nói đang dùng trong kit. */
    expect(DAU_XUAT_XU.test('> **Xuất xứ: dự án TRƯỚC (OPS/LMS), không phải app hiện tại.**')).toBe(true);
    expect(DAU_XUAT_XU.test('Đo thật trên OPS tab Hub Info:')).toBe(true);
    expect(DAU_XUAT_XU.test('App là ant-design + Metronic'), 'câu sai KHÔNG được tự coi là có xuất xứ').toBe(false);
  });
});
