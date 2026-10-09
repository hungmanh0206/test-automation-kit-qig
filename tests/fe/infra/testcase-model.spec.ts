import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/*
 * MÔ HÌNH TESTCASE CANONICAL (scripts/lib/testcase) + GATE TAG/PRIORITY GẮN VỚI NÓ.
 *
 * Tách ra 22/09/2026 từ `publish-field-mapping.spec.ts` khi Google Sheet ngưng dùng (thay bằng Google Sheet —
 * xem plan migrate): phần lớn file cũ khoá SHAPE payload publish lên Google Sheet (CaseTag lồng, custom field
 * Module, folder hierarchy, story-link) — không còn đối tượng để test, đã xoá cùng
 * `scripts/integrations/aio/**`. Các test GIỮ LẠI ở đây không phụ thuộc Google Sheet — chúng khoá đúng
 * `scripts/lib/testcase/model.js`/`validate.js` (đọc bằng TÊN cột, không theo hệ thống đích), gate `Tag`
 * của `md_to_xlsx.js`, và cách tính risk band từ Ưu tiên — tất cả vẫn đúng nguyên với luồng Sheet mới.
 */

const REPO = path.resolve(__dirname, '..', '..', '..');
const read = (p: string) => fs.readFileSync(path.join(REPO, p), 'utf8');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { groupNumbered, splitNumbered, buildTestCase, validate, tagNamesOf, cleanCell } = require(path.join(REPO, 'scripts/lib/testcase'));

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
   * CSDL-26878 tụt về 0 mà không có một dòng lỗi nào. Nguồn tag DUY NHẤT là `tc.dimensions` của model
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
   * `Ưu tiên: Critical` của CSDL-26878 tụt band high → low (5 trục mở rộng còn 1) — sai đúng chiều
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

test.describe('@infra cleanCell — Markdown nội dòng KHÔNG được lọt vào Excel/Google Sheet', () => {
  /*
   * VÌ SAO CÓ NHÓM NÀY (đo 30/09/2026 trên bộ CSDL-9004, 150 case, 1500 ô dữ liệu):
   * backtick được bóc 52/52 ô, nhưng **đậm** LỌT NGUYÊN 18/18 ô vào .xlsx. Excel và Google Sheet
   * không render Markdown, nên ô testcase hiện ra đầy dấu sao — người đọc testcase phải đọc rác.
   * Lỗi này không thuộc riêng task nào: mọi bộ case dùng cú pháp đậm đều dính. Khoá lại bằng test
   * để lần gen sau ở task khác không tái diễn.
   */
  const TICK = String.fromCharCode(96);
  const CASES: Array<[string, string, string]> = [
    ['bỏ đậm', 'Ô Mã định danh bị **khoá**, không nhập được', 'Ô Mã định danh bị khoá, không nhập được'],
    ['bỏ đậm nhiều lần trong một ô', '**A** rồi **B** rồi **C**', 'A rồi B rồi C'],
    ['đậm trải qua xuống dòng', 'mở **đầu\ncuối** xong', 'mở đầu\ncuối xong'],
    ['bỏ gạch ngang', 'giá trị ~~cũ~~ đã bỏ', 'giá trị cũ đã bỏ'],
    ['bỏ backtick', `cột ${TICK}MA_NAM_HOC${TICK} là năm học`, 'cột MA_NAM_HOC là năm học'],
    ['đậm lồng backtick', `**cột ${TICK}API_MA_BO${TICK}** để trống`, 'cột API_MA_BO để trống'],
    ['dấu sao LẺ không bị đụng', 'ghi chú (*) xem dưới', 'ghi chú (*) xem dưới'],
    ['phép nhân không bị đụng', 'tổng = 2 * 3 * 4', 'tổng = 2 * 3 * 4'],
    ['một dấu ngã lẻ không bị đụng', 'xấp xỉ ~50 dòng', 'xấp xỉ ~50 dòng'],
  ];
  for (const [ten, vao, ra] of CASES) {
    test(ten, () => { expect(cleanCell(vao)).toBe(ra); });
  }

  test('thẻ <br> thành xuống dòng thật', () => {
    expect(cleanCell('1. một<br>2. hai')).toBe('1. một\n2. hai');
  });

  test('icon bị bóc, nhưng MŨI TÊN thì giữ vì là chữ nghĩa', () => {
    /*
     * Dải stripEmoji cũ (`\u{1F300}+` và `✀-➿`) bỏ sót đúng hai icon hay dùng nhất trong
     * ghi chú: ⚠ U+26A0 (130 lần) và ⛔ U+26D4 (9 lần) — chúng nằm ở khối Misc Symbols U+2600–U+26FF
     * và lọt thẳng ra Excel. Đo 30/09/2026 trên 5 bộ testcase.
     */
    expect(cleanCell('⚠️ Mask PII trước khi chụp')).toBe('Mask PII trước khi chụp');
    expect(cleanCell('⛔ CHƯA EXECUTE ĐƯỢC')).toBe('CHƯA EXECUTE ĐƯỢC');
    expect(cleanCell('🔒 File chứa PII')).toBe('File chứa PII');
    expect(cleanCell('✅ đạt · ❌ không đạt')).toBe('đạt · không đạt');
    // mũi tên là nội dung, không phải trang trí
    expect(cleanCell('màn 1.1 → màn 1.3 ⇒ khác nhau ↔ hai chiều')).toBe('màn 1.1 → màn 1.3 ⇒ khác nhau ↔ hai chiều');
  });

  test('in nghiêng bị bóc, nhưng dấu sao của SQL thì giữ', () => {
    /*
     * `COUNT(*)` và tên cột kiểu `IS_*` / `*_KHONG_DAU` phải sống sót — chúng là nội dung truy vấn thật
     * trong cột Các bước. Nếu luật in-nghiêng ghép hai `(*)` trong cùng một ô thì ăn mất cả đoạn SQL.
     */
    expect(cleanCell('Đặc tả ghi *"tối đa 250 ký tự"* nên chặn')).toBe('Đặc tả ghi "tối đa 250 ký tự" nên chặn');
    expect(cleanCell('BR-C07: *"mã lớp phải khớp<br>- ngoài danh mục thì báo lỗi"* xong'))
      .toBe('BR-C07: "mã lớp phải khớp\n- ngoài danh mục thì báo lỗi" xong');
    expect(cleanCell('SELECT COUNT(*) AS N FROM LOP')).toBe('SELECT COUNT(*) AS N FROM LOP');
    expect(cleanCell('SELECT COUNT(*) FROM A rồi COUNT(*) FROM B')).toBe('SELECT COUNT(*) FROM A rồi COUNT(*) FROM B');
    expect(cleanCell('Danh sách 51 cột IS_* của bảng TRUONG')).toBe('Danh sách 51 cột IS_* của bảng TRUONG');
    expect(cleanCell('phép so chạy trên các cột *_KHONG_DAU nên bỏ dấu')).toBe('phép so chạy trên các cột *_KHONG_DAU nên bỏ dấu');
  });

  test('ghi chú của người viết case KHÔNG được nằm trong "Kết quả mong đợi"', () => {
    /*
     * Người đọc testcase trên Excel/Sheet cần biết KIỂM CÁI GÌ, không cần biết vì sao case ra đời.
     * Đo 30/09/2026 trên 5 bộ đã sinh: 254 dòng loại này lẫn trong ô Kết quả mong đợi.
     * CẢNH BÁO chứ không CHẶN — phân loại là heuristic, chặn nhầm sẽ đẩy người ta đi XOÁ assertion
     * con thật cho qua cửa, đúng thứ RULE_GLOBAL §6 cấm.
     */
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { noteLinesInExpected } = require(path.join(REPO, 'scripts/qa/lib/output_rules'));
    const LA_GHI_CHU = [
      '- Oracle: BR-THPT-A09',
      '- ASSUMPTION Q2: chấm theo bộ KEY 4 thành phần',
      '- OBSERVATION: đặc tả chưa nêu quy tắc này',
      '- Đo DB 28/09/2026: bảng có 4493 dòng NULL',
      '- Cặp đôi với CSDL_HS_TC_064 (cùng luồng)',
      '- Bất kỳ cặp nào hoán đổi cho nhau là FAIL',
    ];
    for (const s of LA_GHI_CHU) {
      expect(noteLinesInExpected(s), `phải nhận ra ghi chú: ${s}`).toHaveLength(1);
    }

    const PHAI_GIU = [
      '1. Hệ thống CHẶN lưu, không tạo bản ghi mới',
      '- Nhãn nút: "Đồng bộ dữ liệu"',                                  // có trích nguyên văn
      '- File kết quả chứa dữ liệu học sinh, không đính vào report',     // ràng buộc an toàn
      '- Mask Họ tên khi chụp evidence',                                 // ràng buộc an toàn
      '- Ô Email vẫn sửa được bình thường',                              // assertion con
      '- STT 1: "Hồ sơ trường"',
    ];
    for (const s of PHAI_GIU) {
      expect(noteLinesInExpected(s), `KHÔNG được coi là ghi chú: ${s}`).toHaveLength(0);
    }
  });

  test('md_to_xlsx.js và model.js phải bóc CÙNG một bộ dấu', () => {
    // Hai bản cài đặt song song. Lệch nhau là .md đọc một kiểu, .xlsx hiện một kiểu khác.
    const xlsx = read('scripts/convert_excel/md_to_xlsx.js');
    const model = read('scripts/lib/testcase/model.js');
    for (const src of [xlsx, model]) {
      expect(src, 'phải bóc **đậm**').toContain('\\*\\*([\\s\\S]*?)\\*\\*');
      expect(src, 'phải bóc ~~gạch~~').toContain('~~([\\s\\S]*?)~~');
      expect(src, 'phải bóc backtick').toContain('([^`]*)');
    }
  });
});
