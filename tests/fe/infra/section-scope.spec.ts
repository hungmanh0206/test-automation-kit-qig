import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { gateEnv } from './_gate_env';

/**
 * @infra — hợp đồng ĐỊNH VỊ SECTION của `ui_conformance_check`.
 *
 * Vì sao có file này: chỗ định vị section đã sai **3 lần liên tiếp** trên UAT thật, mỗi lần theo một kiểu khác —
 * (1) heuristic "hàng 2 con lá" trả no-container dù khối có thật, (2) sửa xong thì container ôm cả tab nên đọc 0
 * nhãn / báo thiếu-hết, (3) khối con lồng trong khối hút field của khối bên cạnh. Mắt đọc code không bắt được ba
 * lỗi này; DOM giả lập thì bắt trong 1 giây. Mỗi test dưới đây tái hiện đúng một layout đã gây lỗi.
 */

const CHECKER = path.resolve(__dirname, '../../../scripts/qa/ui_conformance_check.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-dynamic-require, global-require
const { stampSection, surfaceOf } = require(CHECKER);

/** Layout 1 — khối phẳng có hàng "nhãn/giá trị" là 2 con lá (kiểu heuristic cũ xử được). */
const HTML_ROWS = `<div class="wrap">
  <div class="sec"><div class="hd"><span style="font-weight:700;font-size:16px">Customer Info</span></div>
    <div class="body">
      <div class="row"><span>Mã hồ sơ</span><span>123</span></div>
      <div class="row"><span>Full name</span><span>IT test</span></div>
      <div class="row"><span>Email</span><span>a@b.c</span></div>
    </div>
  </div>
  <div class="sec"><div class="hd"><span style="font-weight:700;font-size:16px">Service Info</span></div>
    <div class="body">
      <div class="row"><span>Type of Service Fee</span><span>Chuyển đổi</span></div>
      <div class="row"><span>Recipient Bank Account</span><span>Tài khoản SAA</span></div>
    </div>
  </div>
</div>`;

/** Layout 2 — khối CON lồng trong khối CHA: cha w700, con w600, các con nằm PHẲNG cạnh nhau. */
const HTML_NESTED = `<div class="outer">
  <span style="font-weight:700;font-size:16px">Data Synchronized from Partner</span>
  <span style="font-weight:600;font-size:16px">Thông tin hồ sơ</span>
  <div class="row"><span>Mã hồ sơ</span><span>1</span></div>
  <div class="row"><span>Full name</span><span>x</span></div>
  <div class="row"><span>Email</span><span>y</span></div>
  <span style="font-weight:600;font-size:16px">Transfer Information</span>
  <div class="row"><span>Converted Course Packages</span><span>p</span></div>
  <div class="row"><span>Convertible Amount</span><span>9</span></div>
</div>`;

test.describe('@infra định vị section (ui_conformance_check.stampSection)', () => {
  test('khối phẳng thông thường: lấy đúng khối của mình, không lấn khối bên cạnh', async ({ page }) => {
    await page.setContent(HTML_ROWS);
    const st = await stampSection(page, 'Customer Info', 'm1', '.sec');
    expect(st.ok).toBe(true);
    const labels = await page.$eval('[data-uicheck="m1"]', (el) => [...el.querySelectorAll('.row')]
      .map((r) => (r.children[0] as HTMLElement).textContent));
    expect(labels).toEqual(['Mã hồ sơ', 'Full name', 'Email']);
    expect(labels, 'không được hút field của Service Info').not.toContain('Recipient Bank Account');
  });

  test('KHỐI CON lồng trong khối: chỉ lấy tới tiêu đề CÙNG CẤP kế tiếp', async ({ page }) => {
    await page.setContent(HTML_NESTED);
    // `.outer` là container mà app khai — nhưng nó bọc CẢ HAI khối con ⇒ phải bị từ chối.
    const st = await stampSection(page, 'Thông tin hồ sơ', 'm2', '.outer');
    expect(st.ok).toBe(true);
    expect(st.via, 'layout phẳng ⇒ phải dùng dải anh em, không dùng container của app').toBe('sibling-range');
    const labels = await page.$$eval('[data-uicheck-row="m2"]', (els) => els
      .map((r) => (r.children[0] as HTMLElement).textContent));
    expect(labels).toEqual(['Mã hồ sơ', 'Full name', 'Email']);
    expect(labels, 'field của Transfer Information KHÔNG được lọt vào').not.toContain('Convertible Amount');
  });

  test('khối CHA vẫn được phép chứa các khối con (cấp thấp hơn không phải biên)', async ({ page }) => {
    await page.setContent(HTML_NESTED);
    const st = await stampSection(page, 'Data Synchronized from Partner', 'm3', '.outer');
    expect(st.ok).toBe(true);
    // Cha bọc cả 2 khối con ⇒ tập nhãn phải gồm cả hai.
    const sel = st.via === 'sibling-range' ? '[data-uicheck-row="m3"]' : '[data-uicheck="m3"] .row';
    const labels = await page.$$eval(sel, (els) => els.map((r) => (r.children[0] as HTMLElement).textContent));
    expect(labels).toContain('Mã hồ sơ');
    expect(labels).toContain('Convertible Amount');
  });

  test('surfaceOf: gom nhãn theo section thật, phân biệt được cấp tiêu đề', async ({ page }) => {
    await page.setContent(HTML_NESTED);
    const secs = await surfaceOf(page);
    const byName = Object.fromEntries(secs.map((s: any) => [s.heading, s]));
    expect(Object.keys(byName)).toContain('Thông tin hồ sơ');
    expect(byName['Thông tin hồ sơ'].labels).toEqual(['Mã hồ sơ', 'Full name', 'Email']);
    expect(byName['Transfer Information'].labels).toEqual(['Converted Course Packages', 'Convertible Amount']);
    expect(byName['Thông tin hồ sơ'].rank, 'con phải thấp cấp hơn cha')
      .toBeLessThan(byName['Data Synchronized from Partner'].rank);
  });
});

test.describe('@infra spec_extract --suggest-aliases', () => {
  test('ghép tên tài liệu ↔ tên build theo độ trùng nhãn, và CHỈ đề xuất (không tự ghi)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alias-'));
    fs.writeFileSync(path.join(dir, '11_x.md'), `# t

## 4.4. MÀN X

#### 4.4.1. View Order Detail

##### 4.4.1.2. Mô tả chi tiết các trường

| **#** | **Field** | **Label** | **Required** | **Data type** | **Input** | **Validation** | **Description** |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **TAB 2: SYNC INFORMATION** |  |  |  |  |  |  |  |
| **Thông tin trên Deal** |  |  |  |  |  |  |  |
| 1 | ma_ho_so | Mã hồ sơ | M | Number | x |  | d |
| 2 | full_name | Full name | ◎ | Text | x |  | d |
| 3 | email | Email | ◎ | Text | x |  | d |
`);
    const bindings = path.join(dir, 'b.json');
    fs.writeFileSync(bindings, JSON.stringify({
      screens: { 'f11:4.4.1#tab_2_sync_information': { name: 'X Sync', url: '/x' } },
    }));
    const surface = path.join(dir, 'surface.json');
    fs.writeFileSync(surface, JSON.stringify({
      'X Sync': [
        { heading: 'Thông tin hồ sơ', rank: 60016, labels: ['Mã hồ sơ', 'Full name', 'Email'] },
        { heading: 'Khối lạ', rank: 70016, labels: ['Aaa', 'Bbb', 'Ccc'] },
      ],
    }));
    const out = execFileSync(process.execPath, [
      path.resolve(__dirname, '../../../scripts/qa/spec_extract.js'),
      '--docs', dir, '--bindings', bindings, '--suggest-aliases', surface,
    ], { encoding: 'utf8', env: gateEnv() });
    expect(out, 'phải đề xuất đúng cặp theo trùng nhãn').toContain('"Thông tin trên Deal" → "Thông tin hồ sơ"');
    expect(out, 'khối build không khớp tài liệu phải được nêu cho chiều ngược').toContain('Khối lạ');
    // Không được tự ghi vào bindings — người chốt.
    expect(JSON.parse(fs.readFileSync(bindings, 'utf8')).sectionAliases).toBeUndefined();
  });
});
