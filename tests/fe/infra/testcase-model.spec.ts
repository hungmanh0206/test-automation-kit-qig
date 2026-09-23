import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/*
 * MÔ HÌNH TESTCASE CANONICAL (scripts/lib/testcase) + GATE TAG/PRIORITY GẮN VỚI NÓ.
 *
 * Tách ra 22/09/2026 từ `publish-field-mapping.spec.ts` khi AIO Tests ngưng dùng (thay bằng Google Sheet —
 * xem plan migrate): phần lớn file cũ khoá SHAPE payload publish lên AIO (CaseTag lồng, custom field
 * Module, folder hierarchy, story-link) — không còn đối tượng để test, đã xoá cùng
 * `scripts/integrations/aio/**`. Các test GIỮ LẠI ở đây không phụ thuộc AIO — chúng khoá đúng
 * `scripts/lib/testcase/model.js`/`validate.js` (đọc bằng TÊN cột, không theo hệ thống đích), gate `Tag`
 * của `md_to_xlsx.js`, và cách tính risk band từ Ưu tiên — tất cả vẫn đúng nguyên với luồng Sheet mới.
 */

const REPO = path.resolve(__dirname, '..', '..', '..');
const read = (p: string) => fs.readFileSync(path.join(REPO, p), 'utf8');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { groupNumbered, splitNumbered, buildTestCase, validate, tagNamesOf } = require(path.join(REPO, 'scripts/lib/testcase'));

const PROMPT = 'prompt_templates/phase1/02_gen_testcases.md';

test.describe('@infra hợp nhất bước ↔ kết quả (groupNumbered) — nguồn cho MỌI consumer đọc steps/expected', () => {
  test('groupNumbered gộp dòng con vào bước của nó và KHÔNG mất chữ nào', () => {
    const cell = '1. Mở màn A\n2. Bấm Lưu, hiển thị:\n- Toast "Đã lưu"\n- Nút Lưu disabled\n- Row count = 3\n3. Đóng màn';
    const parts = splitNumbered(cell);
    const blocks = groupNumbered(parts);

    // 3 bước ⇒ đúng 3 khối, dù có 6 phần tử phẳng
    expect(parts.length).toBe(6);
    expect(blocks.length).toBe(3);
    expect(blocks.map((b: any) => b.n)).toEqual([1, 2, 3]);

    // khối 2 phải nuốt trọn 3 dòng con — đây chính là phần từng bị vứt khi consumer zip theo chỉ số phẳng
    expect(blocks[1].lines).toHaveLength(4);
    expect(blocks[1].text).toContain('Toast "Đã lưu"');
    expect(blocks[1].text).toContain('Row count = 3');

    // bất biến quan trọng nhất: KHÔNG mất chữ
    const lost = parts.length - blocks.reduce((a: number, b: any) => a + b.lines.length, 0);
    expect(lost, 'gộp khối không được làm mất dòng nào').toBe(0);
  });

  test('dòng con đứng TRƯỚC dòng đánh số đầu tiên cũng không bị nuốt', () => {
    const blocks = groupNumbered(splitNumbered('- ghi chú mở đầu\n1. Bước một'));
    expect(blocks).toHaveLength(2);
    expect(blocks[0].n).toBeNull();
    expect(blocks[0].text).toBe('ghi chú mở đầu');
  });

  test('prompt gen phát biểu HỢP ĐỒNG bước ↔ kết quả để tác giả và consumer hiểu giống nhau', () => {
    const p = read(PROMPT);
    expect(p).toContain('HỢP ĐỒNG bước ↔ kết quả');
    expect(p, 'phải nói rõ khối = dòng đánh số + các dòng con của nó').toMatch(/dòng đánh số N \+ MỌI dòng con/);
    expect(p, 'phải cấm consumer zip theo chỉ số phẳng').toContain('groupNumbered');
  });
});

test.describe('@infra tag chiều — nguồn DUY NHẤT là tc.dimensions, không tự regex tiêu đề', () => {
  /*
   * TAG RA CỘT RIÊNG (21/08/2026) — lớp lỗi: gate nào TỰ regex tag từ tiêu đề sẽ IM LẶNG khi tiêu đề
   * sạch. Đã dính thật: `validate.js` đọc `tc.title.match(/\[..\]/g)` nên 45 cảnh báo tag↔loại của bộ
   * SAPP-26878 tụt về 0 mà không có một dòng lỗi nào. Nguồn tag DUY NHẤT là `tc.dimensions` của model
   * (hợp của cột `Tag` và tiêu đề) — các test dưới khoá đúng chỗ đó.
   */
  test('model lấy tag từ CỘT `Tag` và từ tiêu đề — cả hai đời bộ TC', () => {
    const H11 = ['TC ID', 'Loại case', 'Tag', 'Module', 'Trường hợp kiểm thử', 'Tiền điều kiện',
      'Dữ liệu Test', 'Các bước thực hiện', 'Kết quả mong đợi', 'Ưu tiên', 'Mức độ rủi ro'];
    const nw = buildTestCase(H11, ['TC_1', 'Integration', '[Positive][Calc][BR-X-001]', 'M',
      'Tạo BP - hợp lệ - ra mã đúng', '', '', '1. a', '1. b', 'Critical', '']);
    expect(nw.dimensions).toEqual(expect.arrayContaining(['positive', 'calc']));
    expect(nw.oracleRefs).toEqual(['BR-X-001']);
    expect(nw.title, 'tiêu đề bộ mới phải sạch tag').toBe('Tạo BP - hợp lệ - ra mã đúng');

    // bộ CŨ: 10 cột, tag còn trong tiêu đề — không được mất tín hiệu
    const H10 = H11.filter((h) => h !== 'Tag');
    const old = buildTestCase(H10, ['TC_2', 'Functional', 'M',
      '[Negative][Guard][SM-Y-002] Chặn - khi khoá sổ - báo lỗi', '', '', '1. a', '1. b', 'High', '']);
    expect(old.dimensions).toEqual(expect.arrayContaining(['negative', 'guard']));
    expect(old.oracleRefs).toEqual(['SM-Y-002']);
  });

  test('validate KHÔNG tự regex tag từ tiêu đề (nguồn duy nhất: tc.dimensions)', () => {
    // bỏ comment trước khi soi: chính phần giải thích của validate.js có nhắc `tc.title.match(...)`
    const src = read('scripts/lib/testcase/validate.js')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '');
    expect(src, 'regex tag trên tiêu đề sẽ im lặng khi tag đã ra cột `Tag`')
      .not.toContain('title.match(');
    expect(src, 'phải lấy tag qua tc.dimensions của model').toMatch(/tc\.dimensions \|\| \[\]/);
  });

  test('validate bắt được tiền tố hằng số và tag ghi hai chỗ', () => {
    const H = ['TC ID', 'Loại case', 'Tag', 'Module', 'Trường hợp kiểm thử', 'Tiền điều kiện',
      'Dữ liệu Test', 'Các bước thực hiện', 'Kết quả mong đợi', 'Ưu tiên', 'Mức độ rủi ro'];
    const mk = (id: string, tag: string, title: string) =>
      buildTestCase(H, [id, 'Functional', tag, 'M', title, 'p', 'd', '1. a', '1. b', 'High', 'Major']);
    const doc = (tests: any[]) => ({ tests, setup: [], headers: H, warnings: [] });

    const constPrefix = validate(doc([1, 2, 3, 4, 5, 6].map((i) =>
      mk(`TC_${i}`, '[Positive][Calc][BR-X-001]', `Cross-app - việc ${i} - kết quả ${i}`)))).warnings;
    expect(constPrefix.some((w: string) => /tiền tố hằng số/.test(w)),
      'mọi case cùng một tiền tố ⇒ tiền tố không phân biệt được gì').toBe(true);

    /*
     * ĐA SỐ, không phải TOÀN BỘ. Bản đầu dùng `every()` và bị bộ thử bắt: một case lệch (còn sót
     * `[Positive]` ở đầu tiêu đề) là tắt cả check, trong khi 5/6 case vẫn mang tiền tố vô nghĩa.
     */
    const oneOutlier = [mk('TC_0', '[Positive][Calc][BR-X-001]', '[Positive] Cross-app - việc 0 - kq 0')]
      .concat([1, 2, 3, 4, 5].map((i) => mk(`TC_${i}`, '[Positive][Calc][BR-X-001]', `Cross-app - việc ${i} - kq ${i}`)));
    expect(validate(doc(oneOutlier)).warnings.some((w: string) => /tiền tố hằng số/.test(w)),
      'một case lệch KHÔNG được tắt check').toBe(true);

    /*
     * Bộ CŨ (không có cột `Tag`) KHÔNG bị nag — đúng tiền lệ lúc thêm `Loại case`: luật mới không làm
     * ồn những bộ có trước luật.
     */
    const H10 = H.filter((h) => h !== 'Tag');
    const legacy = [1, 2, 3, 4, 5, 6].map((i) => buildTestCase(H10,
      [`TC_${i}`, 'Functional', 'M', `[Positive] OPS - việc ${i} - kq ${i}`, 'p', 'd', '1. a', '1. b', 'High', 'Major']));
    expect(validate({ tests: legacy, setup: [], headers: H10, warnings: [] }).warnings
      .some((w: string) => /tiền tố hằng số/.test(w)), 'bộ chưa có cột `Tag` thì miễn').toBe(false);

    const both = validate(doc([mk('TC_9', '[Negative][Guard][SM-Y-002]', '[Negative] Chặn - x - y')])).warnings;
    expect(both.some((w: string) => /CẢ cột `Tag` lẫn đầu tiêu đề/.test(w))).toBe(true);

    // bộ sạch: KHÔNG được kêu oan
    const clean = validate(doc([1, 2, 3, 4, 5].map((i) =>
      mk(`TC_${i}`, '[Positive][Calc][BR-X-001]', `Đối tượng ${i} - hành động - kết quả cụ thể`)))).warnings;
    expect(clean.filter((w: string) => /tiền tố hằng số|CẢ cột `Tag`/.test(w))).toHaveLength(0);
  });

  test('tagNamesOf: cột `Tag` là nguồn, bộ cũ lấy khối ĐẦU tiêu đề, không hốt ngoặc giữa câu', () => {
    expect(tagNamesOf('[Positive][BEData][BR-SAPSYNC-001]', 'Tạo BP - hợp lệ - ra mã đúng'))
      .toEqual(['Positive', 'BEData', 'BR-SAPSYNC-001']);

    // `[FBP]` giữa câu là TÊN TRƯỜNG trên phiếu — hốt vào thành tag là bịa nhãn không ai khai
    expect(tagNamesOf('[Positive][Calc]', 'Kiểm [FBP] Ngày ghi nhận - x - y')).toEqual(['Positive', 'Calc']);
    expect(tagNamesOf('', '[Positive][Calc][BR-X-001] Kiểm [FBP] Ngày - x - y'))
      .toEqual(['Positive', 'Calc', 'BR-X-001']);

    expect(tagNamesOf('[Positive]', '[positive] a [Calc]'), 'bỏ trùng không phân biệt hoa thường')
      .toEqual(['Positive']);
    expect(tagNamesOf('', 'Tạo BP - hợp lệ - ra mã')).toEqual([]);
  });

  /*
   * GATE `Tag` ở BIÊN SINH CASE. Đo thật: bỏ hẳn cột `Tag` thì md_to_xlsx và output_gate đều exit 0;
   * chốt duy nhất còn lại là `dim:coverage --enforce` (exit 2) nhưng nó chỉ được gọi theo prompt, KHÔNG
   * có trong CI. Không tag thì gate chiều còn rơi về chế độ GỢI Ý và tự từ chối chặn ⇒ mất im lặng cả
   * luật phủ chiều lẫn luật oracle.
   */
  test('md_to_xlsx chặn bộ sinh mới không có tag chiều', () => {
    const src = read('scripts/convert_excel/md_to_xlsx.js');
    expect(src, 'thiếu gate này thì bộ không tag lọt cả hai cửa').toContain('[gate tag]');
    expect(src, 'phải đo bằng tagNamesOf, không tự regex').toContain('canonical.tagNamesOf(t.tags, t.title)');
    expect(src, 'vẫn phải cho phép bỏ qua có chủ đích như các gate khác').toMatch(/\[gate tag\][\s\S]{0,900}QA_APPROVED/);
  });
});

test.describe('@infra Ưu tiên → risk band — PRIO_RANK phải phủ đủ 5 mức', () => {
  /*
   * `bandOf` lấy max(risk, priority) mà `PRIO_RANK` lại THIẾU khoá `critical` ⇒ bỏ cột Severity thì 28 case
   * `Ưu tiên: Critical` của SAPP-26878 tụt band high → low (5 trục mở rộng còn 1) — sai đúng chiều
   * nguy hiểm nhất. Vá PRIO_RANK rồi thì bỏ cột làm đổi band 0/1977 case toàn repo.
   */
  test('PRIO_RANK phủ đủ 5 mức ưu tiên — thiếu `critical` là hạ band case quan trọng nhất', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { bandOf } = require(path.join(REPO, 'scripts/lib/expansion/depth'));
    expect(bandOf({ priority: 'Critical' }), 'Critical là đỉnh thang ⇒ phải là band high').toBe('high');
    expect(bandOf({ priority: 'High' })).toBe('high');
    expect(bandOf({ priority: 'Medium' })).toBe('medium');
    expect(bandOf({ priority: 'Low' })).toBe('low');
    expect(bandOf({ priority: 'Lowest' })).toBe('low');
    // bỏ cột Severity không được đổi band khi Ưu tiên đã đủ nghĩa
    expect(bandOf({ priority: 'Critical' })).toBe(bandOf({ priority: 'Critical', risk: 'Blocker' }));
  });

  test('Severity không còn là cột/ô bắt buộc, nhưng check độ sâu vẫn sống', () => {
    const src = read('scripts/lib/testcase/validate.js');
    expect(src, 'còn đòi Severity thì mọi bộ mới đỏ oan').not.toMatch(/\['risk', 'Severity'\]/);
    expect(src, "REQUIRED_COLS không được đòi cột Severity").not.toMatch(/'Severity \| Mức độ rủi ro'/);
    // check "High-risk cần [Boundary]/[Security]" phải neo vào Ưu tiên, không thì im lặng ở bộ mới
    expect(src).toMatch(/highs = doc\.tests\.filter\(\(t\) => \/\^\(critical\|high\)\$\/i\.test/);
  });
});
