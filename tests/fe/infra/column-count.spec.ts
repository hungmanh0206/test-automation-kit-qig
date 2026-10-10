import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CANONICAL_COLS, COL } = require('../../../scripts/lib/testcase/model.js');

/*
 * @infra — MỌI CON SỐ "N CỘT" TRONG KIT PHẢI KHỚP MỘT NGUỒN.
 *
 * LỖI THẬT, đo 10/10/2026: `.agent/workflows/phase1_03_validate_export_report.md` ghi "Đủ 11 cột" và
 * `phase1_generate_tc.md` ghi "template 11 cột", trong khi template Markdown canonical có **10**. Hai tài
 * liệu dạy sai cho người đọc, và không gì đỏ vì không ai đối chiếu.
 *
 * GỐC CỦA CON SỐ 11: Excel SAU publish có nhiều cột hơn (exporter thêm `Nhóm chức năng`, `Result`,
 * `Note`…). Lẫn "bản xuất" với "template" là cách con số sai sống sót — `tc_validator/SKILL.md` đã ghi
 * đúng và giải thích chỗ lẫn này từ trước, nhưng hai file kia không đọc nó.
 *
 * VÌ SAO GATE PHẢI ĐỌC `CANONICAL_COLS`, KHÔNG ĐỌC `COL`: `COL` là bảng KHỚP TÊN cột, 12 khoá, gồm cả
 * `risk` của bộ cũ đã bỏ. Một gate đọc `Object.keys(COL).length` sẽ ra 12 và tự nó sai — đúng lớp lỗi
 * "gate xanh mà không gác gì". Nên v2.5.0 khai `CANONICAL_COLS` làm nguồn trước, rồi mới dựng gate.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const SO_COT: number = CANONICAL_COLS.length;

/**
 * Con số cột được KHAI LÀ CANONICAL.
 *
 * Chỉ bắt khi số đứng NGAY CẠNH chữ `template` hoặc `canonical`. Bản đầu chỉ đòi DÒNG có chứa hai chữ
 * đó, và nó báo oan 4 chỗ ĐÚNG: "6 cột mới" của ISTQB, "2 cột" của một bảng khác, "9 cột" của bộ cũ, và
 * chính câu GIẢI THÍCH "Đừng ghi 11: Excel SAU publish có 11 cột" — tức gate đi bắt đúng câu đã cảnh báo
 * về lỗi này. Một gate báo oan thì người ta tắt nó, chứ không sửa theo nó.
 */
const RE_SO_COT = /(?:template|canonical)\s*\*{0,2}\s*(\d+)\s*cột|(\d+)\s*cột\s*\*{0,2}\s*canonical/gi;

const soKhai = (s: string): number[] => [...s.matchAll(RE_SO_COT)].map((m) => Number(m[1] || m[2]));

/** Mọi `.md` của lớp GENERIC mà con số cột có thể trôi vào. */
function fileGeneric(): string[] {
  const ra: string[] = [];
  const di = (d: string, sau = 0) => {
    if (sau > 6) return;
    let es: fs.Dirent[];
    try { es = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
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

test.describe('@infra số cột canonical — một nguồn, không trôi', () => {
  test('`CANONICAL_COLS` khớp đúng header trong prompt sinh case', () => {
    /*
     * Hai nơi giữ cùng một sự thật thì sớm muộn lệch nhau. Nên neo chúng vào nhau: nguồn SỐ ở
     * `model.js`, nguồn CHỮ là header trong prompt, và test này bắt chúng phải khớp.
     */
    const p = path.join(REPO, 'prompt_templates/phase1/02_gen_testcases.md');
    const header = fs.readFileSync(p, 'utf8').replace(/\r\n?/g, '\n').split('\n')
      .find((d) => d.startsWith('| TC ID |'));
    expect(header, 'không thấy header canonical trong prompt sinh case').toBeTruthy();

    const cot = header!.split('|').map((x) => x.trim()).filter(Boolean);
    expect(cot, 'header trong prompt phải khớp `CANONICAL_COLS` của model.js').toEqual(CANONICAL_COLS);
  });

  test('KHÔNG file GENERIC nào khai số cột khác canonical', () => {
    const xau: string[] = [];
    for (const f of fileGeneric()) {
      const t = fs.readFileSync(f, 'utf8').replace(/\r\n?/g, '\n');
      for (const so of soKhai(t)) {
        if (so === SO_COT) continue;
        xau.push(`${path.relative(REPO, f).split(path.sep).join('/')}: khai ${so} cột`);
      }
    }
    expect(xau, `số cột canonical là ${SO_COT} — chỗ nào khai khác thì dạy sai cho người đọc`).toEqual([]);
  });

  test('ÂM BẢN: con số sai phải bị bắt, chuyện khác thì không', () => {
    /* Chứng minh phép quét không vô nghĩa, sau khi đã siết nó vì báo oan. */
    expect(soKhai('Sinh testcase theo template 11 cột, phân nhóm'), 'phải bắt con số sai').toEqual([11]);
    expect(soKhai('Đủ **10 cột** canonical'), 'phải đọc được cả dạng in đậm').toEqual([10]);
    expect(soKhai('Sáu thành phần ISTQB thành 6 cột mới'), 'KHÔNG được bắt chuyện khác').toEqual([]);
    expect(soKhai('Đừng ghi 11: Excel SAU publish có 11 cột'), 'KHÔNG được bắt câu giải thích').toEqual([]);
  });

  test('`CANONICAL_COLS` là nguồn số, KHÔNG phải `COL`', () => {
    /* Chặn đường lùi: ai đó thấy `COL` tiện tay rồi dùng nó làm nguồn số thì gate tự sai mà vẫn xanh. */
    expect(Object.keys(COL).length, 'COL là bảng khớp TÊN, số khoá của nó KHÁC số cột canonical').not.toBe(SO_COT);
    expect(SO_COT).toBe(10);
    const src = fs.readFileSync(path.join(REPO, 'scripts/lib/testcase/model.js'), 'utf8');
    expect(src, 'phải ghi rõ vì sao không dùng COL làm nguồn số').toContain('không phải danh sách cột');
  });
});
