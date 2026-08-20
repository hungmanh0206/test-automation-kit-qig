import { test, expect } from '@playwright/test';
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
});
