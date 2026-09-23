import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/*
 * Lưới cho bộ đổi Confluence storage → Markdown.
 *
 * Bối cảnh: hai fetcher từng đổi HTML sang text bằng `.replace(/<[^>]+>/g, ' ')`, và
 * `fetch_confluence.js` gộp thêm `\s+` nên cả trang thành một dòng. Bảng biến mất, mà AC của dự án
 * nằm trong bảng — agent đọc spec không thấy điều kiện chấp nhận và không có tín hiệu nào báo.
 *
 * File này chốt hai thứ: bộ đổi giữ được bảng, VÀ hai fetcher thật sự gọi bộ đổi đó. Thiếu vế thứ
 * hai thì ai cũng có thể viết lại một dòng gỡ thẻ trong fetcher và test vẫn xanh.
 */

const REPO = path.resolve(__dirname, '../../..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const conv = require(path.join(REPO, 'scripts/lib/confluence/storage_to_markdown.js'));
const { storageToMarkdown } = conv as { storageToMarkdown: (h: string) => string };

const TABLE_PAGE = [
  '<h2>1. Mục đích</h2>',
  '<p>Màn hình quản lý đơn hàng cho phép nhân viên tạo đơn.</p>',
  '<h2>2. Acceptance Criteria</h2>',
  '<table><tbody>',
  '<tr><th>ID</th><th>Điều kiện</th><th>Kết quả mong đợi</th></tr>',
  '<tr><td>AC-01</td><td>Đơn còn hạn</td><td>Nút Thanh toán hiển thị</td></tr>',
  '<tr><td>AC-02</td><td>Đơn hết hạn</td><td>Nút Thanh toán bị ẩn</td></tr>',
  '</tbody></table>',
].join('');

test('bảng Confluence ra bảng markdown, không bị làm phẳng', () => {
  const md = storageToMarkdown(TABLE_PAGE);
  const rows = md.split('\n').filter((l) => l.trim().startsWith('|'));
  expect(rows.length, `phải có 4 dòng bảng, thực tế:\n${md}`).toBe(4);
  expect(rows[0]).toContain('Kết quả mong đợi');
  expect(rows[1]).toMatch(/^\|( --- \|)+$/);
  expect(rows[2]).toContain('AC-01');
  expect(rows[3]).toContain('Nút Thanh toán bị ẩn');
});

test('nội dung AC trong bảng còn nguyên chữ, không dính vào nhau', () => {
  const md = storageToMarkdown(TABLE_PAGE);
  expect(md).toContain('Đơn hết hạn');
  // Lỗi cũ: gỡ thẻ thành khoảng trắng rồi gộp, hai ô cạnh nhau dính thành một câu vô nghĩa.
  expect(md).not.toContain('Đơn còn hạn Nút Thanh toán hiển thị');
});

test('trang có bảng KHÔNG được gộp thành một dòng', () => {
  const md = storageToMarkdown(TABLE_PAGE);
  expect(md.split('\n').length).toBeGreaterThan(5);
});

test('heading thành ký hiệu markdown theo đúng cấp', () => {
  const md = storageToMarkdown('<h1>Tổng quan</h1><h3>Chi tiết</h3>');
  expect(md).toContain('# Tổng quan');
  expect(md).toContain('### Chi tiết');
});

test('danh sách giữ dấu đầu dòng thay vì thành một câu dài', () => {
  const md = storageToMarkdown('<ul><li>Bước một</li><li>Bước hai</li></ul>');
  expect(md).toContain('- Bước một');
  expect(md).toContain('- Bước hai');
  const md2 = storageToMarkdown('<ol><li>Đầu</li><li>Sau</li></ol>');
  expect(md2).toContain('1. Đầu');
  expect(md2).toContain('2. Sau');
});

test('ô nhiều đoạn dùng <br>, và dấu | trong nội dung không phá bảng', () => {
  const md = storageToMarkdown(
    '<table><tbody><tr><td>A</td><td><p>Dòng 1</p><p>Dòng 2</p></td></tr>'
    + '<tr><td>B</td><td>Chọn Nam | Nữ</td></tr></tbody></table>',
  );
  expect(md).toContain('Dòng 1<br>Dòng 2');
  expect(md).toContain('Chọn Nam &#124; Nữ');
  for (const line of md.split('\n').filter((l) => l.startsWith('|'))) {
    expect(line.split('|').length, `số cột lệch ở dòng: ${line}`).toBe(4);
  }
});

test('bảng không có <th> vẫn ra cú pháp markdown hợp lệ', () => {
  const md = storageToMarkdown('<table><tbody><tr><td>Trường</td><td>Kiểu</td></tr>'
    + '<tr><td>email</td><td>text</td></tr></tbody></table>');
  const rows = md.split('\n').filter((l) => l.trim().startsWith('|'));
  expect(rows[1]).toMatch(/^\|( --- \|)+$/);
});

test('entity được giải mã, và &amp;lt; không biến thành thẻ', () => {
  const md = storageToMarkdown('<p>A&nbsp;B &amp; C &amp;lt;D&gt;</p>');
  expect(md).toContain('A B & C &lt;D>');
});

test('không còn thẻ HTML nào rò ra output (trừ <br> trong ô bảng)', () => {
  const md = storageToMarkdown(
    '<ac:structured-macro ac:name="info"><ac:rich-text-body><p>Lưu ý quan trọng</p>'
    + '</ac:rich-text-body></ac:structured-macro><p><strong>Đậm</strong> và <em>nghiêng</em></p>',
  );
  expect(md).toContain('Lưu ý quan trọng');   // macro gỡ vỏ nhưng GIỮ ruột
  expect(md).toContain('Đậm');
  expect(md.replace(/<br>/g, '')).not.toMatch(/<[a-zA-Z/]/);
});

test('liên kết trang giữ lại tiêu đề trang được trỏ tới', () => {
  const md = storageToMarkdown('<p>Xem <ac:link><ri:page ri:content-title="FS Thanh toán" /></ac:link></p>');
  expect(md).toContain('FS Thanh toán');
});

test('khối mã giữ nguyên văn trong CDATA', () => {
  const md = storageToMarkdown(
    '<ac:structured-macro ac:name="code"><ac:plain-text-body>'
    + '<![CDATA[GET /api/v1/orders?status=PAID]]></ac:plain-text-body></ac:structured-macro>',
  );
  expect(md).toContain('GET /api/v1/orders?status=PAID');
  expect(md).toContain('```');
});

/*
 * Đo trên 6 trang US thật: nguồn có 66 dòng Given/When/Then trong macro code, bản cũ giữ được 0.
 * Lý do là `<[^>]+>` ăn trọn `<![CDATA[ ... ]]>` khi ruột không chứa dấu `>` — cả khối AC biến mất.
 */
test('AC dạng Gherkin trong macro code không bị nuốt', () => {
  const md = storageToMarkdown(
    '<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">gherkin</ac:parameter>'
    + '<ac:plain-text-body><![CDATA[Given đơn đã thanh toán\nWhen gọi đồng bộ\n'
    + 'Then tạo Incoming Payment]]></ac:plain-text-body></ac:structured-macro>',
  );
  for (const kw of ['Given đơn đã thanh toán', 'When gọi đồng bộ', 'Then tạo Incoming Payment']) {
    expect(md, 'khối CDATA bị nuốt').toContain(kw);
  }
});

/* 13 entity ký hiệu này đếm được trong corpus thật, `&rarr;` một mình 256 lần. */
test('ký hiệu toán và mũi tên ra đúng chữ, không để nguyên entity', () => {
  const md = storageToMarkdown('<p>Chuyển khoản &rarr; Incoming Payment; số tiền &ge; 0 &ne; rỗng &le; hạn mức</p>');
  expect(md).toContain('Chuyển khoản → Incoming Payment');
  expect(md).toContain('≥');
  expect(md).toContain('≠');
  expect(md).toContain('≤');
  expect(md).not.toMatch(/&[A-Za-z]+;/);
});

test('input rỗng hoặc null trả chuỗi rỗng, không ném', () => {
  expect(storageToMarkdown('')).toBe('');
  expect(storageToMarkdown(null as unknown as string)).toBe('');
});

/*
 * Chống tái phát. Bug nằm ở chỗ mỗi fetcher tự gỡ thẻ. Nếu ai đó viết lại một dòng gỡ thẻ trong
 * fetcher thì các test trên vẫn xanh vì chúng chỉ chạm module. Hai test dưới nhìn vào SOURCE fetcher.
 */
const FETCHERS = [
  'scripts/phase1/fetch_confluence_children.js',
  'scripts/integrations/backlog/fetch_confluence.js',
];

test('cả hai fetcher đều gọi bộ đổi dùng chung', () => {
  for (const rel of FETCHERS) {
    const src = fs.readFileSync(path.join(REPO, rel), 'utf8');
    expect(src, `${rel} không require storage_to_markdown`).toContain('storage_to_markdown');
  }
});

test('không fetcher nào còn tự gỡ thẻ HTML bằng regex riêng', () => {
  for (const rel of FETCHERS) {
    const src = fs.readFileSync(path.join(REPO, rel), 'utf8');
    const offenders = src.split('\n')
      .map((line, i) => ({ line, n: i + 1 }))
      .filter((x) => /replace\(\s*\/<\[\^>\]\+>\//.test(x.line));
    expect(offenders.map((o) => `${rel}:${o.n}`), 'gỡ thẻ phải nằm trong module dùng chung').toEqual([]);
  }
});
