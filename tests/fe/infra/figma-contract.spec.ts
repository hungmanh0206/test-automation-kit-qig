import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * @infra — luật lọc khi biến Figma thành oracle FE.
 *
 * Vì sao phải khoá bằng test: canvas Figma là **bảng mockup nhiều màn cạnh nhau**, rất nhiều rác — chữ chú thích,
 * số callout, ghi chú kỹ thuật cũng in đậm. Đo thật trên canvas 173 node: trích thô ra tiêu đề kiểu "Or" /
 * "File supported: .jpg" và một khối trộn nhãn của 2 màn. Nếu luật lọc trôi thì kit sẽ sinh **oracle GIẢ** — tệ hơn
 * không có oracle, vì mọi so sánh sau đó sai một cách tự tin.
 */
const fig = require(path.resolve(__dirname, '../../../scripts/qa/figma_to_ui_contract.js'));

test.describe('@infra figma → ui_contract: lọc rác canvas', () => {
  test('số callout và chữ quá ngắn KHÔNG phải nhãn', () => {
    for (const t of ['1', '12', '345', 'x', 'ab']) expect(fig.isCallout(t), `"${t}"`).toBe(true);
    for (const t of ['Deal ID', 'Gross Amount', 'Số CCCD/Hộ chiếu']) expect(fig.isCallout(t), `"${t}"`).toBe(false);
  });

  test('chú thích dài / tên file KHÔNG phải nhãn UI', () => {
    expect(fig.isAnnotation('Dung lượng tối đa mỗi file là 500MB. Tối đa 10 file mỗi lần Upload')).toBe(true);
    expect(fig.isAnnotation('File supported: .jpg, .jpeg, .png')).toBe(true);
    expect(fig.isAnnotation('Ảnh chứng minh.png')).toBe(true);
    expect(fig.isAnnotation('Total Amount Due'), 'nhãn thật không được bị loại').toBe(false);
  });

  test('tiêu đề phải NGẮN, không kết thúc bằng dấu câu, không chứa số dài', () => {
    expect(fig.looksLikeHeading('Order Amount')).toBe(true);
    expect(fig.looksLikeHeading('Customer Info')).toBe(true);
    expect(fig.looksLikeHeading('Tệp đính kèm:'), 'kết thúc bằng ":" là nhãn field, không phải tiêu đề khối').toBe(false);
    expect(fig.looksLikeHeading('Frame 1321316443'), 'tên frame kỹ thuật').toBe(false);
  });

  test('groupSections: bỏ khối chỉ có 1 nhãn, gộp trùng, và không nhận callout làm nhãn', () => {
    const texts = [
      { text: 'Order Amount', rank: 70016, x: 0, y: 0 },
      { text: 'Gross Amount', rank: 0, x: 0, y: 10 },
      { text: '1', rank: 0, x: 0, y: 12 },                    // callout
      { text: 'Net Amount', rank: 0, x: 0, y: 20 },
      { text: 'Gross Amount', rank: 0, x: 0, y: 30 },         // trùng
      { text: 'Chỉ một nhãn', rank: 70016, x: 0, y: 40 },
      { text: 'Duy nhất', rank: 0, x: 0, y: 50 },
    ];
    const secs = fig.groupSections(texts);
    expect(secs).toHaveLength(1);
    expect(secs[0].heading).toBe('Order Amount');
    expect(secs[0].labels).toEqual(['Gross Amount', 'Net Amount']);
  });

  test('rankOf: chỉ chữ ĐẬM và ĐỦ LỚN mới là tiêu đề', () => {
    expect(fig.rankOf({ style: { fontWeight: 700, fontSize: 16 } })).toBeGreaterThan(0);
    expect(fig.rankOf({ style: { fontWeight: 400, fontSize: 16 } }), 'không đậm').toBe(0);
    expect(fig.rankOf({ style: { fontWeight: 700, fontSize: 11 } }), 'quá nhỏ').toBe(0);
  });
});
