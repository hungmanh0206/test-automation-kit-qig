import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/*
 * @infra — mã `[PRE-NN]` phải neo được vào catalog Setup Strategy.
 *
 * Vì sao cần: mã tiền điều kiện giờ chỉ là TEXT trong case — trước đây mỗi mã là một issue riêng nên thiếu là thấy ngay
 * trên Jira. Nay tiền điều kiện chỉ là TEXT trong case ⇒ mã trỏ vào hư không vẫn publish trót lọt, và
 * Phase 2 không có gì để dựng. Luật đã ghi trong prompt gen từ lâu ("mô tả khớp catalog") nhưng chưa có máy.
 *
 * Test chạy trên doc canonical dựng tại chỗ (không cần file/mạng), và kiểm CẢ HAI CHIỀU + không báo oan.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { validate } = require(path.join(REPO, 'scripts/lib/testcase'));

const HEADERS = ['TC ID', 'Module', 'Trường hợp kiểm thử', 'Tiền điều kiện', 'Dữ liệu Test', 'Các bước thực hiện', 'Kết quả mong đợi', 'Ưu tiên', 'Severity'];
const tc = (id: string, pre: string) => ({
  tcId: id, module: 'M', title: '[Positive] x', precondition: pre, data: '-',
  steps: ['1. mở màn'], expected: ['1. thấy màn'], priority: 'High', risk: 'Major', dimensions: [],
});
const doc = (tests: object[], setup: object[]) => ({ source: 'xlsx', headers: HEADERS, tests, setup, groups: ['G'], warnings: [] });

test.describe('@infra [PRE-NN] ↔ catalog Setup Strategy', () => {
  test('mã case trích dẫn mà catalog KHÔNG khai ⇒ CHẶN, và nêu đúng mã + case đầu tiên', () => {
    const v = validate(doc([tc('TC_1', '[PRE-01] đã đăng nhập'), tc('TC_2', '[PRE-99] chưa khai ở đâu')], [{ preId: 'PRE-01', desc: 'đã đăng nhập' }]));
    const hit = v.problems.filter((p: string) => /PRE-99/.test(p));
    expect(hit.length, 'phải chặn mã lạc').toBe(1);
    expect(hit[0]).toContain('TC_2');
  });

  test('mã khai trong catalog mà không case nào dùng ⇒ CẢNH BÁO (rác lượt trước), KHÔNG chặn', () => {
    const v = validate(doc([tc('TC_1', '[PRE-01] đã đăng nhập')], [{ preId: 'PRE-01', desc: 'x' }, { preId: 'PRE-77', desc: 'rác' }]));
    expect(v.problems.filter((p: string) => /PRE-/.test(p))).toEqual([]);
    expect(v.warnings.some((w: string) => /PRE-77/.test(w))).toBe(true);
  });

  test('KHÔNG báo oan: file chỉ-testcase (không có catalog) thì không phán gì về mã', () => {
    const v = validate(doc([tc('TC_1', '[PRE-42] gì cũng được')], []));
    expect(v.problems.filter((p: string) => /PRE-/.test(p))).toEqual([]);
    expect(v.warnings.filter((w: string) => /PRE-/.test(w))).toEqual([]);
  });

  test('KHÔNG báo oan: nhiều mã trên một case, khai đủ thì im lặng', () => {
    const v = validate(doc([tc('TC_1', '[PRE-01] a<br>[PRE-02] b')], [{ preId: 'PRE-01', desc: 'a' }, { preId: '[PRE-02] b', desc: 'b' }]));
    expect(v.problems.filter((p: string) => /PRE-/.test(p))).toEqual([]);
  });
  test('catalog thiếu hẳn cột Cleanup/Verification/Type ⇒ CẢNH BÁO cấp bộ, đúng 1 dòng (không spam từng row)', () => {
    const setup = Array.from({ length: 5 }, (_, i) => ({ preId: `PRE-0${i + 1}`, desc: 'x', method: 'ui' }));
    const tests = setup.map((s2, i) => tc(`TC_${i}`, `[${s2.preId}] x`));
    const v = validate(doc(tests, setup));
    const hit = v.warnings.filter((w: string) => /Catalog Setup Strategy thiếu hẳn cột/.test(w));
    expect(hit.length, 'phải gọn 1 dòng cho cả bộ, không phải 5 dòng').toBe(1);
    expect(hit[0]).toContain('Cleanup/Rollback');
    expect(hit[0]).toContain('đo trên 5 dòng');
    expect(v.problems.filter((x: string) => /Catalog/.test(x)), 'cảnh báo, KHÔNG chặn — bộ cũ không bị khoá cứng').toEqual([]);
  });

  test('KHÔNG báo oan: catalog có đủ cột thì im lặng', () => {
    const setup = [{ preId: 'PRE-01', desc: 'x', method: 'api', type: 'state_exist', verification: 'GET /x trả 200', cleanup: 'xoá bằng API' }];
    const v = validate(doc([tc('TC_1', '[PRE-01] x')], setup));
    expect(v.warnings.filter((w: string) => /Catalog Setup Strategy/.test(w))).toEqual([]);
  });

  test('quan hệ TC↔mã suy được từ cột Tiền điều kiện — không cần cột giữ tay "Linked TC IDs"', () => {
    // Chính vì suy được nên template đã bỏ cột đó: giữ tay chỉ tạo chỗ để lệch.
    const v = validate(doc([tc('TC_1', '[PRE-01] a'), tc('TC_2', '[PRE-01] a')], [{ preId: 'PRE-01', desc: 'a', method: 'ui' }]));
    expect(v.problems.filter((x: string) => /PRE-/.test(x)), 'hai TC dùng chung một mã là bình thường').toEqual([]);
    expect(v.warnings.filter((w: string) => /không case nào dùng/.test(w))).toEqual([]);
  });
  test('bộ MỚI (không catalog): cell thiếu tag cách dựng ⇒ CHẶN, tag [db] cũng CHẶN', () => {
    const noTag = validate(doc([tc('TC_1', 'Order đã ở TO_PURCHASE')], []));
    expect(noTag.problems.some((x: string) => x.includes('thiếu tag cách dựng')), 'thiếu tag phải chặn').toBe(true);
    const db = validate(doc([tc('TC_2', '[db] Order đã ở TO_PURCHASE')], []));
    expect(db.problems.some((x: string) => x.includes('không thuộc')), 'dựng state bằng DB bị cấm').toBe(true);
  });

  test('bộ MỚI đúng chuẩn: nhiều tag tách bằng <br> vẫn hợp lệ', () => {
    const v = validate(doc([tc('TC_1', '[pre_existing] Lớp CFA1-01 có ≥2 activity<br>[api] Order ở TO_PURCHASE')], []));
    expect(v.problems.filter((x: string) => x.includes('tag cách dựng') || x.includes('không thuộc'))).toEqual([]);
  });

  test('bộ CŨ (có catalog) KHÔNG bị luật tag chạm — không phá bộ đang chạy', () => {
    const v = validate(doc([tc('TC_1', '[PRE-01] đã đăng nhập')], [{ preId: 'PRE-01', desc: 'đã đăng nhập', method: 'ui' }]));
    expect(v.problems.filter((x: string) => x.includes('tag cách dựng'))).toEqual([]);
  });

  test('một trạng thái hai cách dựng ⇒ CẢNH BÁO (thứ thay cho dedup của mã cũ)', () => {
    const v = validate(doc([tc('TC_1', '[api] Order ở TO_PURCHASE'), tc('TC_2', '[ui] Order ở TO_PURCHASE')], []));
    expect(v.warnings.some((w: string) => w.includes('cách dựng khác nhau'))).toBe(true);
    expect(v.problems.filter((x: string) => x.includes('cách dựng khác nhau')), 'cảnh báo, không chặn').toEqual([]);
  });
});

/*
 * @infra — THANG ƯU TIÊN & LOẠI CASE phải khớp thứ AIO thật sự nhận.
 *
 * Đo 20/08/2026: AIO `casePriorities` = Critical|High|Medium|Low|Lowest, còn Jira = Highest|…. Kit trước
 * đây dùng tên Jira nên publisher (map theo TÊN, không có khoá `highest`) đẩy mọi case `Highest` về
 * fallback Medium — 14 case của một bộ bị hạ ưu tiên âm thầm. Nay canonical dùng `Critical`, `Highest`
 * chỉ còn là alias có cảnh báo, và đường log bug tự map `Critical → Highest` cho Jira.
 */
test.describe('@infra thang Ưu tiên (Critical) + 9 Loại case', () => {
  const mk = (priority: string, risk = 'Major', caseType = '') => doc([{ ...tc('T1', '[api] x'), priority, risk, caseType }], []);

  test('Critical hợp lệ ở cột Ưu tiên (đỉnh thang AIO)', () => {
    expect(validate(mk('Critical')).problems.filter((x: string) => x.includes('Ưu tiên'))).toEqual([]);
  });

  test('Highest vẫn NHẬN nhưng cảnh báo là thang cũ — không phá bộ đang chạy', () => {
    const v = validate(mk('Highest'));
    expect(v.problems.filter((x: string) => x.includes('Ưu tiên'))).toEqual([]);
    expect(v.warnings.some((w: string) => w.includes('thang CŨ'))).toBe(true);
  });

  test('Blocker/Major/Minor/Trivial ở cột Ưu tiên ⇒ CHẶN (đặt sai cột)', () => {
    for (const bad of ['Blocker', 'Major', 'Minor', 'Trivial']) {
      expect(validate(mk(bad)).problems.some((x: string) => x.includes('đặt sai cột')), `${bad} phải bị chặn`).toBe(true);
    }
  });

  test('publisher map Highest → Critical(1), KHÔNG rơi về Medium', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/integrations/aio/publish_testcases_aio.js'), 'utf8');
    expect(src, 'thiếu alias là hạ ưu tiên âm thầm').toMatch(/highest:\s*1/);
    expect(src).toMatch(/critical:\s*1/);
  });

  test('Loại case: 9 giá trị đã chốt thì OK, ngoài 9 thì CHẶN, không khai thì chỉ cảnh báo', () => {
    // Đọc từ nguồn thay vì chép: bảng đã đổi 6 → 9 (20/08/2026) và bản chép tay ở đây là chỗ duy nhất
    // trong kit còn giữ danh sách cũ — nó đỏ đúng lúc, nhưng lần sau thì đừng để nó tồn tại nữa.
    // eslint-disable-next-line global-require
    const CASE_TYPES = require(path.resolve(__dirname, '../../../.agent/config/case_types.json'));
    for (const t of CASE_TYPES.types.map((x: any) => x.name)) {
      expect(validate(mk('High', 'Major', t)).problems.filter((x: string) => x.includes('Loại case')), t).toEqual([]);
    }
    expect(validate(mk('High', 'Major', 'Smoke')).problems.some((x: string) => x.includes('Loại case'))).toBe(true);
    expect(validate(mk('High', 'Major', '')).problems.filter((x: string) => x.includes('Loại case'))).toEqual([]);
  });
});
