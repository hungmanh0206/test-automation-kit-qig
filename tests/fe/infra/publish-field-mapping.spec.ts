import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/*
 * GÁC ÁNH XẠ TRƯỜNG KHI PUBLISH LÊN AIO.
 *
 * VÌ SAO CÓ FILE NÀY: đo thật trên bộ SAPP-26878 (101 case) ngày 20/08/2026, publish đang ghép
 * `steps[i] ↔ expected[i]` theo CHỈ SỐ PHẲNG. Nhưng prompt gen §6 cho phép mỗi bước có nhiều dòng con
 * `- …`, mà `splitNumbered` trả phẳng (dòng con mang `n = null`). Hậu quả đo được:
 *   - 300/682 dòng kết quả (44,0%) bị `.map()` cắt mất ở 83/101 case;
 *   - và tệ hơn: bước sau NHẬN NHẦM kết quả của bước trước (bước "mở hóa đơn bộ B" mang số của bộ A).
 * Cả hai đều IM LẶNG — publish trả 2xx, không gate nào kêu, người mở case trên AIO không biết mình đang
 * đối chiếu thiếu hay đối chiếu nhầm.
 *
 * Ba luật dưới đây khoá đúng lớp lỗi đó lại. KHÔNG gọi mạng: chỉ đọc mã nguồn + chạy hàm canonical,
 * nên chạy được ở CI không có token AIO.
 */

const REPO = path.resolve(__dirname, '..', '..', '..');
const read = (p: string) => fs.readFileSync(path.join(REPO, p), 'utf8');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { groupNumbered, splitNumbered } = require(path.join(REPO, 'scripts/lib/testcase'));

const PUBLISH = 'scripts/integrations/aio/publish_testcases_aio.js';
const PROMPT = 'prompt_templates/phase1/02_gen_testcases.md';

test.describe('@infra publish AIO — ánh xạ bước ↔ kết quả', () => {
  test('groupNumbered gộp dòng con vào bước của nó và KHÔNG mất chữ nào', () => {
    const cell = '1. Mở màn A\n2. Bấm Lưu, hiển thị:\n- Toast "Đã lưu"\n- Nút Lưu disabled\n- Row count = 3\n3. Đóng màn';
    const parts = splitNumbered(cell);
    const blocks = groupNumbered(parts);

    // 3 bước ⇒ đúng 3 khối, dù có 6 phần tử phẳng
    expect(parts.length).toBe(6);
    expect(blocks.length).toBe(3);
    expect(blocks.map((b: any) => b.n)).toEqual([1, 2, 3]);

    // khối 2 phải nuốt trọn 3 dòng con — đây chính là phần từng bị vứt
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

  test('publish KHÔNG được ghép expected theo chỉ số phẳng', () => {
    const src = read(PUBLISH);
    // ca hỏng cũ: expectedResult: lineText((t.expected || [])[n])
    expect(src, 'ghép theo chỉ số phẳng làm lệch bước và cắt mất dòng con')
      .not.toMatch(/expectedResult:\s*lineText\(\(t\.expected\s*\|\|\s*\[\]\)\[n\]\)/);
    expect(src, 'phải ghép theo KHỐI bằng groupNumbered').toContain('groupNumbered(t.expected');
    expect(src, 'bước cũng phải lấy theo khối để số khối hai bên khớp nhau').toContain('groupNumbered(t.steps');
  });

  test('thang Ưu tiên của publish phủ đủ 5 giá trị canonical + alias cũ', () => {
    const src = read(PUBLISH);
    const m = src.match(/const PRIORITY = \{([^}]+)\}/);
    expect(m, 'không thấy bảng PRIORITY').toBeTruthy();
    const map = m![1];
    for (const k of ['critical', 'high', 'medium', 'low', 'lowest']) {
      expect(map, `thiếu "${k}" ⇒ mọi case mức đó rơi về default 3 (Medium) một cách im lặng`).toContain(`${k}:`);
    }
    // `highest` là tên thang Jira của bộ TC cũ — bỏ đi là 28 case của một bộ rơi về Medium
    expect(map, 'giữ alias "highest" cho bộ TC cũ').toContain('highest:');
  });

  /*
   * Tiêu đề gửi AIO = nội dung thuần. Khối `[Positive][BEData][BR-…]` là tín hiệu cho MÁY
   * (dim:coverage, luật ORACLE) và ở lại Excel canonical; người mở case trên AIO không phải đọc nó.
   * Cắt được vì mọi gate đọc local trước (`[test-cases, ...mirrors]`, dedup first-wins) và
   * dim:coverage/bug_tc_matcher chỉ đọc `.md` còn mirror ghi `.xlsx`.
   */
  test('title gửi lên AIO cắt khối tag ĐẦU chuỗi, giữ bracket giữa câu', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { displayTitle } = require(path.join(REPO, PUBLISH));

    expect(displayTitle('[Positive][BEData][BR-SAPSYNC-001] Cross-app - Tạo BP - Sinh mã C + CCCD'))
      .toBe('Cross-app - Tạo BP - Sinh mã C + CCCD');

    // bracket GIỮA câu là nội dung thật (tên trường trên phiếu) — cắt là mất nghĩa
    expect(displayTitle('[Positive][Calc][BR-X-001] Kiểm [FBP] Ngày ghi nhận - đúng ngày'))
      .toBe('Kiểm [FBP] Ngày ghi nhận - đúng ngày');

    // tiêu đề toàn tag: thà giữ nguyên còn hơn gửi title RỖNG lên AIO (không xoá được case)
    expect(displayTitle('[Positive][Calc][BR-Y-002]')).toBe('[Positive][Calc][BR-Y-002]');
    expect(displayTitle('')).toBe('');
  });

  test('payload publish dùng displayTitle, không dùng t.title thô', () => {
    const src = read(PUBLISH);
    expect(src, 'title thô mang cả khối tag lên AIO').not.toMatch(/title:\s*String\(t\.title\s*\|\|\s*''\)\.slice/);
    expect(src).toMatch(/title:\s*displayTitle\(t\.title\)/);
  });

  /*
   * TAG RA CỘT RIÊNG (21/08/2026) — lớp lỗi: gate nào TỰ regex tag từ tiêu đề sẽ IM LẶNG khi tiêu đề
   * sạch. Đã dính thật: `validate.js` đọc `tc.title.match(/\[..\]/g)` nên 45 cảnh báo tag↔loại của bộ
   * SAPP-26878 tụt về 0 mà không có một dòng lỗi nào. Nguồn tag DUY NHẤT là `tc.dimensions` của model
   * (hợp của cột `Tag` và tiêu đề) — hai test dưới khoá đúng chỗ đó.
   */
  test('model lấy tag từ CỘT `Tag` và từ tiêu đề — cả hai đời bộ TC', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { buildTestCase } = require(path.join(REPO, 'scripts/lib/testcase'));
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
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { buildTestCase, validate } = require(path.join(REPO, 'scripts/lib/testcase'));
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
     * ồn những bộ có trước luật. Đo thật: bật cho tất cả thì 8 bộ cũ kêu (`OPS - ` 95/95, `Mobile - `
     * 96/96, `LMS-Pro Staging - ` 34/36…) — đúng lỗi, nhưng không ai sinh lại để sửa.
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

  /*
   * FIELD TAGS trên AIO — lớp lỗi: gửi SAI HÌNH DẠNG thì AIO trả 200 rồi bỏ im lặng.
   * Kit từng kết luận "AIO không lưu tags" sau khi thử 3 dạng phẳng [{ID,name}]/[{name}]/[ID];
   * spec (`CaseTag` trong openapi.json) quy định tag LỒNG trong khoá `tag`: [{ tag: { ID, name } }].
   * Đo lại 21/08/2026: dạng lồng lưu thật, đọc lại có associationID.
   */
  test('tagNamesOf: cột `Tag` là nguồn, bộ cũ lấy khối ĐẦU tiêu đề, không hốt ngoặc giữa câu', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { tagNamesOf } = require(path.join(REPO, 'scripts/lib/testcase'));

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

  test('publish gắn tag dạng LỒNG CaseTag, không dùng dạng phẳng', () => {
    const src = read(PUBLISH);
    expect(src, 'dạng phẳng nhận 200 rồi bị AIO bỏ im lặng').toMatch(/\{ tag: \{ ID:/);
    expect(src, 'phải bảo đảm tag có trong registry trước khi gắn').toContain('ensureTags');
    expect(src, 'registry chỉ nhận body MẢNG').toMatch(/'POST', '\/tag', missing\.map/);
  });

  test('pull đọc tên tag ở x.tag.name (round-trip không mất cột Tag)', () => {
    const src = read('scripts/integrations/aio/pull_testcases_aio.js');
    expect(src, "lấy x.name sẽ ra cột rỗng mà không báo lỗi").toMatch(/\(\(x && x\.tag\) \|\| \{\}\)\.name/);
    expect(src, 'HEADERS của mirror phải có cột Tag').toMatch(/'Loại case', 'Tag'/);
  });

  test('tài liệu AIO không còn khẳng định sai là tags không lưu được', () => {
    for (const f of ['scripts/integrations/aio/aio_client.js', 'scripts/integrations/aio/README.md']) {
      const src = read(f);
      expect(src, `${f}: niềm tin sai này từng làm kit bỏ hẳn Field Tags`)
        .not.toMatch(/tags[^\n]{0,40}KHÔNG lưu|tags[^\n]{0,40}không lưu được/);
    }
  });

  /*
   * ĐỐI SOÁT TỪNG TRƯỜNG (21/08/2026), nguồn ↔ bản ghi thật trên AIO: 10/12 khớp, HAI trường rơi im lặng —
   *   - `Module` (chở mã US): publish không gửi đi đâu, mà pull lại bịa lại từ đường dẫn folder cha
   *     ⇒ round-trip ra giá trị KHÁC nguồn mà không ai thấy sai;
   *   - `Mức độ rủi ro`/Severity: AIO không có field (customFields rỗng).
   * Cả hai nay trú trong `description` — field AIO bỏ trống, đã thử ghi/đọc lại được.
   */
  test('publish đẩy Module vào CUSTOM FIELD của AIO, tra ID theo tên', () => {
    const src = read(PUBLISH);
    expect(src, 'Module phải có đích thật, không thì rơi im lặng').toMatch(/customFields: moduleFieldId/);
    expect(src, 'hình dạng ghi được là [{ ID, value }]').toMatch(/\[\{ ID: moduleFieldId, value:/);
    expect(src, 'tra ID theo TÊN — hardcode ID chỉ đúng trong 1 project')
      .toMatch(/customFields \|\| \[\]\)\.find\(\(f\) => String\(f\.name \|\| ''\)\.toLowerCase\(\) === 'module'\)/);
    expect(src, 'không còn nhồi Severity vào description — Severity là thuộc tính của bug')
      .not.toMatch(/Severity: \$\{/);
  });

  test('pull đọc Module từ custom field, KHÔNG lấy đường dẫn folder làm chuẩn', () => {
    const src = read('scripts/integrations/aio/pull_testcases_aio.js');
    expect(src).toContain('function moduleOf(');
    expect(src, 'folder cha chỉ là dự phòng — nó ra tên nhánh khác hẳn Module của nguồn')
      .toMatch(/moduleOf\(c\) \|\| folderPath/);
    expect(src, 'mirror không còn cột Severity').not.toMatch(/'Ưu tiên', 'Mức độ rủi ro'/);
  });

  /*
   * BỎ CỘT SEVERITY (21/08/2026). Severity là thuộc tính của BUG. Việc duy nhất nó gánh là risk band;
   * `bandOf` lấy max(risk, priority) mà `PRIO_RANK` lại THIẾU khoá `critical` ⇒ bỏ cột thì 28 case
   * `Ưu tiên: Critical` của SAPP-26878 tụt band high → low (5 trục mở rộng còn 1) — sai đúng chiều
   * nguy hiểm nhất. Vá PRIO_RANK rồi thì bỏ cột làm đổi band 0/1977 case toàn repo.
   */
  test('PRIO_RANK phủ đủ 5 mức ưu tiên của AIO — thiếu `critical` là hạ band case quan trọng nhất', () => {
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

  /*
   * YÊU CẦU "PUSH PHẢI MAPPING ĐÚNG TẤT CẢ CÁC TRƯỜNG" — hai lớp máy, vì HTTP 2xx KHÔNG chứng minh
   * mapping đúng: lượt publish trả `TẠO 0 · CẬP NHẬT 101 · LỖI 0` vẫn để `Module` rỗng và từng cắt
   * 300/682 dòng kết quả. Lớp ① chặn cột không có đích TRƯỚC khi ghi (AIO không có API xoá);
   * lớp ② đọc lại từng case rồi so từng trường.
   */
  test('MAPPING khai đích cho MỌI cột của template 10 cột', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MAPPING, LOCAL_ONLY, checkStructure } = require(path.join(REPO, 'scripts/integrations/aio/verify_fields_aio'));
    const cols = MAPPING.map((m: any) => m.col);
    for (const need of ['TC ID', 'Loại case', 'Tag', 'Module', 'Trường hợp kiểm thử', 'Tiền điều kiện',
      'Dữ liệu Test', 'Các bước thực hiện', 'Kết quả mong đợi', 'Ưu tiên', 'Nhóm chức năng']) {
      expect(cols, `cột "${need}" không khai đích ⇒ sẽ rơi im lặng khi push`).toContain(need);
    }
    // mỗi cột local-only phải có LÝ DO, không được để rỗng
    for (const [k, why] of Object.entries(LOCAL_ONLY)) {
      expect(String(why).length, `"${k}" khai local-only mà không nói vì sao`).toBeGreaterThan(20);
    }
    // template 10 cột hiện hành: 0 cột mồ côi
    expect(checkStructure(['TC ID', 'Loại case', 'Tag', 'Module', 'Trường hợp kiểm thử', 'Tiền điều kiện',
      'Dữ liệu Test', 'Các bước thực hiện', 'Kết quả mong đợi', 'Ưu tiên'])).toEqual([]);
    // cột lạ PHẢI bị bắt
    expect(checkStructure(['TC ID', 'Người kiểm'])).toEqual(['Người kiểm']);
    // bộ cũ: Severity/TC gốc/Ghi chú Phase 2 được miễn, không báo mồ côi
    expect(checkStructure(['TC ID', 'Mức độ rủi ro', 'TC gốc', 'Ghi chú Phase 2'])).toEqual([]);
  });

  test('publish chặn cột mồ côi TRƯỚC khi ghi lên AIO', () => {
    const src = read(PUBLISH);
    expect(src, 'phải gọi checkStructure trước vòng ghi').toContain("require('./verify_fields_aio')");
    expect(src).toMatch(/const orphan = checkStructure\(doc\.headers\)/);
    // gate phải đứng TRƯỚC vòng lặp ghi, không thì chặn xong đã kịp tạo case (AIO không xoá được)
    expect(src.indexOf('checkStructure(doc.headers)')).toBeLessThan(src.indexOf('for (const [i, t] of tests.entries())'));
  });

  /*
   * FOLDER ROOT LỒNG SÂU — `ensureFolder` dựng đường dẫn từ GỐC cây, nên gặp root cùng tên đang nằm
   * lồng sâu hơn thì nó tạo root THỨ HAI ở cấp gốc và dọn hết case sang cây mới; cây cũ thành RỖNG,
   * mà AIO KHÔNG có API xoá folder. Im lặng tuyệt đối: publish vẫn báo `LỖI 0` vì việc GHI CASE không
   * sai — chỉ CHỖ ĐẶT sai. Đo thật 27/08/2026: bộ SAPP-26878 sinh 3 cây trùng tên (#148, #171, #192).
   */
  test('publish tìm root đang có ở MỌI độ sâu trước khi tạo cây mới', () => {
    const src = read(PUBLISH);
    expect(src, 'phải soi folderMap trước khi ensureFolder').toMatch(/const hits = Object\.keys\(before\)\.filter/);
    expect(src, 'nhận cả root nằm lồng sâu hơn, không chỉ root ở cấp gốc')
      .toMatch(/k === rootName \|\| k\.endsWith\('\/' \+ rootName\)/);
    // rootName/rootSegs phải gán lại được, nếu khai const thì nhánh dùng-lại ném TypeError lúc chạy
    expect(src).toMatch(/let rootName = arg\('folder-root'/);
    expect(src).toMatch(/let rootSegs = rootName\.split/);
    // guard đứng TRƯỚC ensureFolder, không thì đã kịp tạo cây rác
    expect(src.indexOf('const hits = Object.keys(before)'))
      .toBeLessThan(src.indexOf("await aio.ensureFolder('testcase', [...rootSegs, g])"));
  });

  test('nhiều folder trùng tên root thì DỪNG, không đoán', () => {
    const src = read(PUBLISH);
    expect(src, 'AIO không xoá được folder ⇒ đoán sai là sai vĩnh viễn')
      .toMatch(/if \(hits\.length > 1\) \{[\s\S]{0,400}process\.exit\(1\)/);
    expect(src, 'phải in ra từng cây kèm ID để người chạy chỉ rõ').toMatch(/hits\.forEach\(\(h\) => console\.error/);
  });

  test('prompt gen phát biểu HỢP ĐỒNG bước ↔ kết quả để tác giả và consumer hiểu giống nhau', () => {
    const p = read(PROMPT);
    expect(p).toContain('HỢP ĐỒNG bước ↔ kết quả');
    expect(p, 'phải nói rõ khối = dòng đánh số + các dòng con của nó').toMatch(/dòng đánh số N \+ MỌI dòng con/);
    expect(p, 'phải cấm consumer zip theo chỉ số phẳng').toContain('groupNumbered');
  });
});
