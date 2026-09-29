import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

/*
 * @infra — nhánh EXPLORATORY: từ "toàn văn bản" thành có MÁY.
 *
 * Vì sao thành test: trước đây mọi rule của nhánh này ("phải có bước tái hiện", "evidence là ảnh/video",
 * "không PII", "draft KHÔNG được vào coverage") chỉ là lời dặn trong 2 file .md — không gì kiểm, nên chất
 * lượng phiên phụ thuộc hoàn toàn vào việc agent hôm đó nghĩ ra được gì. Đo: `reference.md` 80 dòng, tours
 * 5 gạch đầu dòng, SFDPOT chỉ liệt kê 6 chữ.
 *
 * Test này khoá hai thứ: (a) máy kiểm phiên có RĂNG và không báo oan, (b) bộ đề xuất charter chấm điểm theo
 * dữ liệu chứ không theo cảm tính — kể cả ca "không khớp được module nào" phải lộ ra thay vì im lặng.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const session = require(path.join(REPO, 'scripts/qa/explore_session.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const charter = require(path.join(REPO, 'scripts/qa/explore_charter.js'));

/** Phiên tối thiểu ĐẠT chuẩn — dùng làm nền rồi bẻ từng thứ một. */
const GOOD = {
  'session-charter.md': '# Charter\nScope: màn Checkout. Timebox: 45 phút. Tour: Data, Time.\n',
  'observations.md': '## Tổng tiền lệch 1 đồng\n1. Mở Checkout\n2. Nhập 1.000.000\nEvidence: evidence/a.png\n',
  'crash-log.md': '## 500 khi submit 29/02\n1. Chọn 29/02/2027\n2. Submit\nEvidence: evidence/b.png\n',
  'draft-testcases.md': '## Draft: chặn số tiền rỗng\noracle_ref: BR-PAY-014\n',
};

const mkSession = (files: Record<string, string>) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'explore-'));
  const ex = path.join(dir, 'exploratory');
  fs.mkdirSync(ex, { recursive: true });
  for (const [f, body] of Object.entries(files)) if (body !== null) fs.writeFileSync(path.join(ex, f), body);
  return { root: dir, ex };
};

test.describe('@infra exploratory — máy kiểm phiên', () => {
  test('phiên đủ chuẩn ⇒ KHÔNG báo oan', () => {
    const { ex } = mkSession(GOOD);
    const r = session.check(ex);
    expect(r.problems, JSON.stringify(r.problems)).toEqual([]);
  });

  test('quan sát thiếu bước tái hiện ⇒ CHẶN (người sau không kiểm lại được)', () => {
    const { ex } = mkSession({ ...GOOD, 'observations.md': '## Nút Save bật sai\nThấy nút sáng.\nEvidence: evidence/a.png\n' });
    expect(session.check(ex).problems.some((p: string) => p.includes('bước tái hiện'))).toBe(true);
  });

  test('"không tái hiện" được ghi rõ ⇒ KHÔNG chặn (trung thực vẫn hợp lệ)', () => {
    const { ex } = mkSession({ ...GOOD, 'observations.md': '## Nút Save bật sai\nKhông tái hiện được ở lần 2.\nEvidence: evidence/a.png\n' });
    expect(session.check(ex).problems.filter((p: string) => p.includes('bước tái hiện'))).toEqual([]);
  });

  test('evidence là .md/.json ⇒ CHẶN (chỉ ảnh/video mới là evidence)', () => {
    const { ex } = mkSession({ ...GOOD, 'observations.md': '## Lệch tiền\n1. Mở màn\nEvidence: logs/state.json\n' });
    expect(session.check(ex).problems.some((p: string) => p.includes('evidence ảnh/video'))).toBe(true);
  });

  test('charter thiếu timebox/scope ⇒ CHẶN', () => {
    const { ex } = mkSession({ ...GOOD, 'session-charter.md': '# Charter\nDò thử vài chỗ.\n' });
    const p = session.check(ex).problems.join(' | ');
    expect(p).toContain('timebox');
    expect(p).toContain('scope');
  });

  test('PII trong output ⇒ CHẶN (không có ngoại lệ cho exploratory)', () => {
    const { ex } = mkSession({ ...GOOD, 'observations.md': `${GOOD['observations.md']}Liên hệ khach@gmail.com\n` });
    expect(session.check(ex).problems.some((p: string) => p.includes('PII'))).toBe(true);
  });

  test('draft lọt vào test-cases/ ⇒ CHẶN (đó là đường vào coverage)', () => {
    const { root, ex } = mkSession(GOOD);
    fs.mkdirSync(path.join(root, 'test-cases'), { recursive: true });
    fs.writeFileSync(path.join(root, 'test-cases', 'draft-exploratory.md'), '# draft');
    expect(session.check(ex).problems.some((p: string) => p.includes('coverage'))).toBe(true);
  });

  test('draft chưa có neo ⇒ CẢNH BÁO, không chặn (tiêu chí "đáng chính thức hoá")', () => {
    const { ex } = mkSession({ ...GOOD, 'draft-testcases.md': '## Draft: nút Save\n(chưa có neo)\n' });
    const r = session.check(ex);
    expect(r.problems.filter((p: string) => p.includes('neo'))).toEqual([]);
    expect(r.warnings.some((w: string) => w.includes('chưa có neo'))).toBe(true);
  });

  test('thiếu file của phiên ⇒ CHẶN từng file, không im lặng', () => {
    const { ex } = mkSession({ ...GOOD, 'crash-log.md': null as unknown as string });
    expect(session.check(ex).problems.some((p: string) => p.includes('crash-log.md'))).toBe(true);
  });
});

test.describe('@infra exploratory — charter chọn theo dữ liệu', () => {
  const R = (module: string, band: string) => ({ module, band });

  test('vùng band High + nhiều bug + chưa có case ⇒ điểm cao nhất', () => {
    const ranked = charter.rank({
      risk: { rows: [R('Payment', 'High'), R('Cấu hình hiển thị', 'Low')] },
      bugs: new Map([['payment - ghi nhận doanh thu', 3]]),
      cases: new Map([['cấu hình hiển thị / màu sắc', 40]]),
      explored: new Map(),
    });
    expect(ranked[0].module).toBe('Payment');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  test('vùng vừa dò xong bị TRỪ điểm — để không dò lại chỗ cũ', () => {
    const rows = { risk: { rows: [R('Payment', 'High')] }, bugs: new Map(), cases: new Map() };
    const fresh = charter.rank({ ...rows, explored: new Map([['payment', 1]]) })[0].score;
    const never = charter.rank({ ...rows, explored: new Map() })[0].score;
    expect(fresh).toBeLessThan(never);
  });

  test('khớp module giữa 2 hệ tên (tên ngắn ở risk ↔ tên dài ở testcase)', () => {
    // Nếu so bằng dấu `=` thì 0/101 khớp và MỌI module bị cộng "chưa có case nào" — bảng xếp hạng thành rác.
    const ranked = charter.rank({
      risk: { rows: [R('Order', 'Medium')] },
      bugs: new Map(),
      cases: new Map([['tạo add-on order / chọn version', 12]]),
      explored: new Map(),
    });
    expect(ranked[0].caseCount, 'phải khớp được "Order" với "Tạo Add-on Order / Chọn Version"').toBe(12);
  });

  test('tour đề xuất theo DẤU HIỆU của vùng, không rải đều', () => {
    expect(charter.suggestTours({ module: 'Payment', caseCount: 10 })).toContain('Money/number');
    expect(charter.suggestTours({ module: 'Đồng bộ hệ ngoài', caseCount: 10 })).toContain('T — Time');
    expect(charter.suggestTours({ module: 'Phân quyền', caseCount: 10 })).toContain('Permission/URL bypass');
    expect(charter.suggestTours({ module: 'Gì đó lạ', caseCount: 0 })).toContain('Ngược chiều (reverse)');
  });
});
