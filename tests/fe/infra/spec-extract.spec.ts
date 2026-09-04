import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { gateEnv } from './_gate_env';

/**
 * @infra — hợp đồng của `scripts/qa/spec_extract.js` (FSD → screens.json → ui_catalog.json).
 *
 * Mọi luật dưới đây SINH RA TỪ ĐO TRÊN FSD THẬT của SAPP-24395 (49 bảng field), không phải từ suy đoán. Mỗi
 * `test` tương ứng một lần luật đó đã báo oan hoặc bỏ sót trong lượt đo đầu — giữ test để không ai nới ngược.
 */

const SCRIPT = path.resolve(__dirname, '../../../scripts/qa/spec_extract.js');

/** Bảng field FSD thu nhỏ nhưng giữ ĐÚNG các đặc điểm đã gây lỗi: heading in nghiêng, field điều kiện,
 *  control Button, nhãn lặp, số mục trùng giữa hai file. */
const FSD_A = `# (Untitled)

## 4.4.1. QUẢN LÝ ORDER CHUYỂN NHƯỢNG

#### 4.4.1.1.5. View Order Detail

##### *4.4.1.1.5.2. Mô tả chi tiết các trường*

| **#** | **Field** | **Label** | **Required** | **Data type** | **Input** | **Validation** | **Description** |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **TAB 2: HUBSPOT INFORMATION** |  |  |  |  |  |  |  |
| **Customer Info** [tham khảo](https://docs.google.com/x) |  |  |  |  |  |  |  |
| 1 | deal_id | Deal ID | M | Number | User nhập |  | ID deal |
| 2 | full_name | Full Name | ◎ | Text | Đồng bộ từ Deal |  | Tên học viên |
| 3 | phone_number | Phone | ◎ | Text | Đồng bộ từ Deal |  | SĐT |
| 4 | phone_number | Phone | ◎ | Number | Đồng bộ từ Deal |  | SĐT (dòng lặp của tài liệu) |
| 5 | deal_id_fee_lost | Deal ID Đã Thanh Toán Phí | ◎ | Number | Đồng bộ từ Deal Hệ thống chỉ hiển thị trong trường hợp trường này có giá trị |  | Deal lost |
| 6 |  | Đồng bộ lại | - | Button |  |  | Nút đồng bộ |
| 7 | phi_dich_vu_lan_# | Phí dịch vụ lần # | ◎ | Number | Theo từng giao dịch |  | Số tiền từng lần |
`;

/** File thứ hai dùng LẠI số mục "4.4.1.1.5" (FSD thật có copy-paste kiểu này) và có một section riêng. */
const FSD_B = `# (Untitled)

## 4.3.1. QUẢN LÝ ORDER CHUYỂN ĐỔI

#### 4.4.1.1.5. View Order Detail

##### 4.4.1.1.5.2. Mô tả chi tiết các trường

| **#** | **Field** | **Label** | **Required** | **Data type** | **Input** | **Validation** | **Description** |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **TAB 2: HUBSPOT INFORMATION** |  |  |  |  |  |  |  |
| **Thông tin Deal trừ** |  |  |  |  |  |  |  |
| 1 | deal_tru | Deal trừ | ◎ | Text | Đồng bộ |  | Deal bị trừ |
| 2 | so_tien_tru | Số tiền trừ | ◎ | Number | Đồng bộ |  | Số tiền |
`;

function run(dir: string, extra: string[] = []) {
  const out = path.join(dir, 'screens.json');
  const args = [SCRIPT, '--docs', dir, '--out', out, ...extra];
  const stdout = execFileSync(process.execPath, args, { encoding: 'utf8', env: gateEnv() });
  return { stdout, screens: JSON.parse(fs.readFileSync(out, 'utf8')).screens as any[] };
}

let dir = '';
test.beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'specx-'));
  fs.writeFileSync(path.join(dir, '11_chuyen_nhuong.md'), FSD_A);
  fs.writeFileSync(path.join(dir, '10_chuyen_doi.md'), FSD_B);
});

test.describe('@infra spec_extract — trích bảng field FSD', () => {
  test('đọc được bảng dù heading bị bọc in nghiêng, và giữ số mục trong specRef', () => {
    const { screens } = run(dir);
    const cn = screens.find((s) => s.section === 'Customer Info');
    expect(cn, 'phải trích được section Customer Info').toBeTruthy();
    // "##### *4.4.1.1.5.2. …*" — dấu * làm rụng số mục ở bản đầu.
    expect(cn.specRef).toContain('4.4.1.1.5.2');
    expect(cn.tab).toBe('TAB 2: HUBSPOT INFORMATION');
  });

  test('tên section bị dính markdown link thì lấy phần tên, không lấy URL', () => {
    const { screens } = run(dir);
    expect(screens.some((s) => /docs\.google/.test(s.section || '')), 'không được để URL vào tên section').toBe(false);
    expect(screens.some((s) => s.section === 'Customer Info')).toBe(true);
  });

  test('phân loại field: điều kiện / lặp động / control — mỗi loại một nhãn riêng', () => {
    const { screens } = run(dir);
    const f = screens.find((s) => s.section === 'Customer Info').fields;
    const by = (label: string) => f.find((x: any) => x.label === label);
    expect(by('Deal ID Đã Thanh Toán Phí').conditional, '"chỉ hiển thị trong trường hợp…" = có điều kiện').toBe(true);
    expect(by('Phí dịch vụ lần #').dynamic, 'nhãn có # = lặp theo giao dịch').toBe(true);
    expect(by('Đồng bộ lại').control, 'Data type Button = control, không đọc bằng nhãn').toBe(true);
    // Field thường KHÔNG được gắn nhãn nào trong ba loại trên.
    expect(by('Full Name').conditional).toBeUndefined();
    expect(by('Full Name').control).toBeUndefined();
  });

  test('dropdown/combobox/checkbox KHÔNG bị coi là control (đó là nơi bug hay sống)', () => {
    const d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'specx2-'));
    fs.writeFileSync(path.join(d2, '01_x.md'), `# t

## 1.1. MÀN X

#### 1.1.1. Create

##### 1.1.1.2. Mô tả chi tiết các trường

| **#** | **Field** | **Label** | **Required** | **Data type** | **Input** | **Validation** | **Description** |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Service Info** |  |  |  |  |  |  |  |
| 1 | service_fee | Service Fee | M | Combobox (editable) | User chọn |  | Phí |
| 2 | method | Calculation Method | M | Dropdown select | User chọn |  | Cách tính |
| 3 | included | Included in Course Payment | O | Checkbox | User tick |  | Cờ |
`);
    const out = path.join(d2, 's.json');
    execFileSync(process.execPath, [SCRIPT, '--docs', d2, '--out', out], { encoding: 'utf8', env: gateEnv() });
    const fields = (JSON.parse(fs.readFileSync(out, 'utf8')).screens as any[])[0].fields;
    for (const label of ['Service Fee', 'Calculation Method', 'Included in Course Payment']) {
      expect(fields.find((f: any) => f.label === label).control, `${label} phải KHÔNG bị loại`).toBeUndefined();
    }
  });

  test('key mang cả file: hai file dùng lại cùng số mục thì không được đè nhau', () => {
    const { screens } = run(dir);
    const keys = screens.filter((s) => /4\.4\.1\.1\.5/.test(s.key)).map((s) => s.key);
    expect(new Set(keys).size, 'cùng số mục ở 2 file phải ra 2 key khác nhau').toBeGreaterThan(1);
    expect(keys.every((k) => /^f\d+:/.test(k))).toBe(true);
  });

  test('sinh catalog: field điều kiện thành optionalFields, KHÔNG tắt phép bắt field thừa', () => {
    const b = path.join(dir, 'b.json');
    const cat = path.join(dir, 'cat.json');
    fs.writeFileSync(b, JSON.stringify({
      screens: { 'f11:4.4.1.1.5#tab_2_hubspot_information': { name: 'CN Hub', url: '/x' } },
    }));
    run(dir, ['--bindings', b, '--catalog', cat]);
    const c = JSON.parse(fs.readFileSync(cat, 'utf8'));
    const sec = c.screens[0].fields.find((f: any) => f.headingText === 'Customer Info');
    expect(sec.optionalFields, 'field điều kiện phải được miễn trừ ĐÍCH DANH').toContain('Deal ID Đã Thanh Toán Phí');
    expect(sec.expectedFields).not.toContain('Deal ID Đã Thanh Toán Phí');
    expect(sec.expectedFields).not.toContain('Đồng bộ lại');           // control
    // Nhãn lặp trong tài liệu phải gộp và được nêu ra để hỏi BA.
    expect(sec.expectedFields.filter((x: string) => x === 'Phone')).toHaveLength(1);
    expect(sec._doc_duplicates).toContain('Phone');
    // `superset` CHỈ vì có field lặp động — và khi đó phải nói rõ lý do.
    if (sec.mode === 'superset') expect(sec._superset_why).toMatch(/lặp động/);
  });

  test('section của MÀN KHÁC: chưa có alias thì KHÔNG được coi là đã kiểm', () => {
    // Đo thật 19/08: FSD viết tên khối bằng tiếng Việt, OPS render tiếng Anh ("Thông tin trên Deal" →
    // "Deal Information"). Tìm theo tên tài liệu thì không bao giờ ra ⇒ không có alias thì phải NÓI RÕ là chưa
    // kiểm được, chứ không được xếp vào danh sách đã-gác.
    const b = path.join(dir, 'b2.json');
    const cat = path.join(dir, 'cat2.json');
    fs.writeFileSync(b, JSON.stringify({
      screens: { 'f11:4.4.1.1.5#tab_2_hubspot_information': { name: 'CN Hub', url: '/x' } },
    }));
    run(dir, ['--bindings', b, '--catalog', cat]);
    const c = JSON.parse(fs.readFileSync(cat, 'utf8'));
    const s0 = c.screens[0];
    expect(s0._forbidden_unaliased, 'tên chỉ có trong tài liệu phải bị nêu là CHƯA kiểm được').toContain('Thông tin Deal trừ');
    expect(s0.forbiddenSections || [], 'chưa có alias thì không được coi là đã gác').not.toContain('Thông tin Deal trừ');
  });

  test('có alias thì section lạ trở thành kiểm được, và dùng tên trên BUILD', () => {
    const b = path.join(dir, 'b3.json');
    const cat = path.join(dir, 'cat3.json');
    fs.writeFileSync(b, JSON.stringify({
      sectionAliases: { 'Thông tin Deal trừ': 'Deduction Deal Info' },
      screens: { 'f11:4.4.1.1.5#tab_2_hubspot_information': { name: 'CN Hub', url: '/x' } },
    }));
    run(dir, ['--bindings', b, '--catalog', cat]);
    const s0 = JSON.parse(fs.readFileSync(cat, 'utf8')).screens[0];
    expect(s0.forbiddenSections || []).toContain('Deduction Deal Info');
    expect(s0.forbiddenSections || [], 'section của CHÍNH màn không được nêu').not.toContain('Customer Info');
  });

  test('không có bindings thì TỪ CHỐI sinh catalog (không đoán URL)', () => {
    let failed = false;
    try {
      execFileSync(process.execPath, [SCRIPT, '--docs', dir, '--catalog', path.join(dir, 'nope.json')], { encoding: 'utf8', stdio: 'pipe' });
    } catch (e: any) {
      failed = true;
      expect(String(e.stderr)).toContain('TỪ CHỐI');
    }
    expect(failed, 'thiếu bindings phải thoát lỗi, không im lặng sinh catalog rỗng').toBe(true);
  });
});
