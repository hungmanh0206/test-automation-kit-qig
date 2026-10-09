'use strict';

/*
 * validate — kiểm STRUCTURAL (đủ cột canonical) + COMPLETENESS (ô lõi không rỗng) trên TestCaseDoc.
 * Superset của design_gate.gateDesign (GĐ 1b sẽ cho design_gate delegate về đây). Row-quality/oracle
 * (KQ khớp bước, range, tautology) vẫn ở output_rules — validate KHÔNG lặp lại, chỉ structural/completeness.
 */

const path = require('path');
const m = require('./model');

/*
 * 9 Case Type — ĐỌC từ `.agent/config/case_types.json`, KHÔNG chép danh sách vào đây.
 *
 * Vì sao đọc file: danh sách này từng nằm hardcode ở 5 chỗ (validate · converter · prompt gen · publisher ·
 * test). Khi user mở rộng 6 → 9 loại, chép tay nghĩa là 5 cơ hội để một chỗ vẫn còn 6 — và chỗ đó sẽ CHẶN
 * theo bảng cũ trong khi tài liệu dạy bảng mới. Một nguồn thì không có "chỗ đó".
 *
 * `legacy` = tên còn tồn tại trên Google Sheet nhưng không thuộc 9 loại đã chốt (hiện: `Unit`): NHẬN kèm cảnh báo để
 * dữ liệu cũ không đỏ, nhưng case sinh mới không được dùng.
 */
const TECHNIQUE_CODES = require('../../../.agent/config/design_techniques.json')
  .techniques.map((t) => t.code);
const CASE_TYPES = require(path.join(__dirname, '..', '..', '..', '.agent', 'config', 'case_types.json'));
const CASE_TYPE_NAMES = CASE_TYPES.types.map((t) => t.name);
const CASE_TYPE_SET = new Set(CASE_TYPE_NAMES.map((n) => n.toLowerCase()));
const CASE_TYPE_LEGACY = new Set(Object.keys(CASE_TYPES.legacy || {}).map((n) => n.toLowerCase()));
/** tag (chữ thường, không ngoặc) → tên loại. Dùng cho check "tag nói một đằng, loại khai một nẻo". */
const TAG_TO_TYPE = new Map();
for (const t of CASE_TYPES.types) for (const tag of t.tags || []) TAG_TO_TYPE.set(tag.toLowerCase(), t.name);

const REQUIRED_COLS = [
  ['TC ID', m.COL.tcId], ['Module', m.COL.module], ['Trường hợp kiểm thử', m.COL.title],
  ['Tiền điều kiện', m.COL.precondition], ['Các bước thực hiện', m.COL.steps],
  ['Kết quả mong đợi', m.COL.expected], ['Ưu tiên', m.COL.priority],
];
// ô lõi mỗi TC không được rỗng (KQ mong đợi để output_rules lo oracle-rỗng; precondition/data có thể rỗng hợp lệ)
/*
 * `Severity`/`Mức độ rủi ro` KHÔNG còn là cột bắt buộc (bỏ 21/08/2026).
 *
 * Severity là thuộc tính của BUG, không phải của testcase — chấm nó lúc viết case là đoán trước hậu quả
 * của một lỗi chưa xảy ra. Việc duy nhất nó còn gánh trong kit là risk band (độ sâu mở rộng), mà band
 * lấy `Math.max(risk, priority)`; sau khi vá `PRIO_RANK` thiếu khoá `critical`, đo trên 1977 case toàn
 * repo: bỏ cột này làm đổi band **0 case**. Tức nó dư thật, chỉ đang che lỗi thang ưu tiên.
 * `COL.risk` vẫn giữ trong model để 17 bộ TC cũ (còn cột này) parse không lỗi.
 */
const REQUIRED_FIELDS = [['module', 'Module'], ['title', 'Trường hợp kiểm thử'], ['stepsRaw', 'Các bước thực hiện'], ['priority', 'Ưu tiên']];

// GIÁ TRỊ hợp lệ. `Ưu tiên` phải là 1 trong 5 priority CÓ THẬT trên Backlog: bug được log lấy Priority TỪ CHÍNH
// cột này (prompt `08_log_bug_backlog.md`), giá trị lạ (`Critical`, `P0`…) ⇒ Backlog không set được ⇒ bug rơi về
// default, mất luôn tín hiệu ưu tiên. Trước đây prompt §7/§8 có quy định nhưng KHÔNG có gì kiểm.
/*
 * Thang ƯU TIÊN canonical = thang của công cụ cũ: Critical|High|Medium|Low|Lowest.
 * `Highest` là tên của BACKLOG (và của bộ TC cũ) — vẫn NHẬN để không phá bộ đang chạy, nhưng cảnh báo:
 * publisher map theo TÊN nên trước đây mọi `Highest` rơi về fallback Medium (đo: 14 case của một bộ).
 * Đường log bug tự map `Critical → Highest` khi ghi Backlog, nên canonical không cần theo tên Backlog.
 */
const PRIORITY_OK = /^(critical|high|medium|low|lowest)$/i;
const PRIORITY_LEGACY = /^highest$/i;
// SEVERITY (thang mới, 5 mức) = hậu quả NẾU lỗi xảy ra. Khác `Ưu tiên` (thứ tự sửa, đẩy vào field Priority
// của Backlog). Trước đây cột này là "Mức độ rủi ro" 3 mức; thang 3 mức vẫn NHẬN để bộ TC cũ không đỏ, nhưng
// deprecated — cảnh báo 1 lần/file (không phải mỗi dòng, tránh 530 dòng nhiễu).
// LƯU Ý: Backlog hiện CHƯA có field Severity → giá trị này giữ ở testcase/report, KHÔNG đẩy lên Backlog.
const SEVERITY_OK = /^(blocker|critical|major|minor|trivial)$/i;
// Giá trị CHỈ có nghĩa ở cột Severity. `Critical` cố ý KHÔNG nằm đây: nó hợp lệ ở cả hai cột.
const SEVERITY_ONLY = /^(blocker|major|minor|trivial)$/i;
const RISK_LEGACY = /^(high|medium|low|cao|trung bình|trung binh|thấp|thap)$/i;
const RISK_OK = new RegExp(`${SEVERITY_OK.source}|${RISK_LEGACY.source}`, 'i');
const RISK_HIGH = /^(blocker|critical|high|cao)$/i;
const RISK_LOW = /^(minor|trivial|low|thấp|thap)$/i;

/**
 * @param {import('./model').TestCaseDoc} doc
 * @returns {{ problems: string[], warnings: string[] }}
 */
function validate(doc) {
  const problems = []; const warnings = [];
  if (!doc || !doc.tests || !doc.tests.length) { problems.push('Không có testcase nào (bảng 9-cột không parse được).'); return { problems, warnings }; }

  // 1) STRUCTURAL — đủ cột canonical.
  for (const [label, matcher] of REQUIRED_COLS) {
    if (m.colIndex(doc.headers || [], matcher) < 0) problems.push(`Bảng testcase THIẾU cột "${label}" (canonical) — downstream sẽ vỡ`);
  }
  // 2) COMPLETENESS — ô lõi không rỗng.
  for (const tc of doc.tests) {
    const id = tc.tcId || '(no-id)';
    for (const [field, label] of REQUIRED_FIELDS) {
      if (!String(tc[field] || '').trim()) problems.push(`${id}: rỗng ô "${label}"`);
    }
  }
  // 2b) VALUE — `Ưu tiên`/`Mức độ rủi ro` phải dùng đúng thang (prompt gen §7/§8).
  for (const tc of doc.tests) {
    const id = tc.tcId || '(no-id)';
    const p = String(tc.priority || '').trim();
    const r = String(tc.risk || '').trim();
    if (p && !PRIORITY_OK.test(p) && !PRIORITY_LEGACY.test(p)) problems.push(`${id}: \`Ưu tiên\` = "${p}" không thuộc thang Critical|High|Medium|Low|Lowest. Giá trị lạ bị mọi consumer bỏ qua âm thầm: Google Sheet map priority theo TÊN (rơi về Medium), Backlog dùng default.`);
    if (p && PRIORITY_LEGACY.test(p)) warnings.push(`${id}: \`Ưu tiên\` = "Highest" là tên thang CŨ (Backlog) — canonical nay dùng **Critical** (khớp Google Sheet). Vẫn nhận, nhưng nên đổi: publisher chỉ map đúng nhờ alias, còn báo cáo/lọc thì hai tên khác nhau làm số liệu tách đôi.`);
    if (r && !RISK_OK.test(r)) problems.push(`${id}: \`Severity\` = "${r}" không thuộc thang Blocker|Critical|Major|Minor|Trivial (§8); thang cũ High|Medium|Low vẫn tạm nhận. Giá trị ngoài cả hai thang bị mọi consumer bỏ qua âm thầm.`);

    /*
     * `Loại case` — CHƯA bắt buộc (mọi bộ TC hiện có đều chưa có cột này; đòi ngay là đỏ toàn bộ).
     * Nhưng ĐÃ KHAI thì phải đúng 1 trong 6 giá trị Google Sheet nhận, không thì consumer bỏ qua âm thầm và ta lại
     * quay về đúng chỗ cũ: case type vô nghĩa. Thiếu cột ⇒ cảnh báo, publish sẽ suy tạm và nói rõ là suy.
     */
    const ct = String(tc.caseType || '').trim();
    const ctLow = ct.toLowerCase();
    if (ct && !CASE_TYPE_SET.has(ctLow) && !CASE_TYPE_LEGACY.has(ctLow)) {
      problems.push(`${id}: \`Loại case\` = "${ct}" không thuộc 9 loại đã chốt — ${CASE_TYPE_NAMES.join('|')}. Định nghĩa + "chọn khi / không chọn khi" của từng loại: \`.agent/config/case_types.json\`.`);
    } else if (ct && CASE_TYPE_LEGACY.has(ctLow)) {
      const why = CASE_TYPES.legacy[Object.keys(CASE_TYPES.legacy).find((k) => k.toLowerCase() === ctLow)];
      warnings.push(`${id}: \`Loại case\` = "${ct}" là tên CŨ, không nằm trong 9 loại đã chốt. ${why} Chọn lại 1 trong: ${CASE_TYPE_NAMES.join('|')}.`);
    }

    /*
     * TAG ↔ LOẠI không được nói ngược nhau. CẢNH BÁO chứ không chặn, có chủ đích: bảng "không chọn khi" của
     * chính 9 loại đã liệt kê những ca chồng lấn HỢP LỆ (vd `[Display]` nhưng lỗi do BE tính sai ⇒ `Functional`,
     * không phải `UI`). Chặn ở đây là phạt đúng những case phân loại TINH nhất. Chỉ xét khi case mang đúng
     * MỘT tag đã ánh xạ được — nhiều tag thì bản thân tag đã không quyết được, im lặng mới đúng.
     */
    /*
     * Nguồn tag phải là `tc.dimensions` của model, KHÔNG tự regex lại tiêu đề.
     * Đã dính thật 21/08/2026: chỗ này từng đọc `tc.title.match(/\[...\]/g)`, nên khi tag chuyển sang
     * cột `Tag` và tiêu đề sạch thì kiểm tra IM LẶNG — 45 cảnh báo tag↔loại của bộ CSDL-26878 tụt về 0
     * mà không có dòng lỗi nào. `dimensions` là HỢP của cột `Tag` và tiêu đề nên đúng cho cả hai đời bộ TC.
     */
    const mapped = [...new Set((tc.dimensions || [])
      .map((d) => TAG_TO_TYPE.get(String(d).toLowerCase()))
      .filter(Boolean))];
    if (ct && CASE_TYPE_SET.has(ctLow) && mapped.length === 1 && mapped[0].toLowerCase() !== ctLow) {
      warnings.push(`${id}: tag chiều gợi \`${mapped[0]}\` nhưng \`Loại case\` khai \`${ct}\`. Không nhất thiết sai — xem mục "không chọn khi" của \`${mapped[0]}\` trong \`.agent/config/case_types.json\`; nếu vẫn giữ \`${ct}\` thì nói rõ lý do ở \`Assumptions\`.`);
    }

    if (p && SEVERITY_ONLY.test(p)) problems.push(`${id}: \`Ưu tiên\` = "${p}" là giá trị SEVERITY, đặt sai cột — \`Ưu tiên\` nhận Critical|High|Medium|Low|Lowest; Blocker/Major/Minor/Trivial thuộc cột \`Severity\`. (\`Critical\` hợp lệ ở CẢ hai cột: nó là đỉnh thang ưu tiên VÀ một mức severity.)`);
  }
  // 2c) CONSISTENCY — 2 cột không được nói ngược nhau. Cảnh báo (không chặn) vì vẫn có ngoại lệ hợp lý,
  // nhưng phải nêu ra: rủi ro High = tài chính/bảo mật/không rollback được, gán ưu tiên thấp là tự mâu thuẫn
  // và bug sinh ra từ case đó sẽ lên Backlog với Priority thấp.
  for (const tc of doc.tests) {
    const id = tc.tcId || '(no-id)';
    const p = String(tc.priority || '').trim();
    const r = String(tc.risk || '').trim();
    if (!p || !r || !PRIORITY_OK.test(p) || !RISK_OK.test(r)) continue;
    // Ô ⚠ của ma trận §7b: không cấm, nhưng phải có lý do dịch bậc — nếu không thì 1 trong 2 cột chấm sai.
    if (/^blocker$/i.test(r) && /^(medium|low|lowest)$/i.test(p)) warnings.push(`${id}: ô ⚠ trong ma trận §7b — \`Severity\` Blocker nhưng \`Ưu tiên\` ${p}. Hợp lệ khi chức năng CHƯA bật cho người dùng / sắp bỏ; phải ghi lý do dịch bậc trong \`Assumptions\`. Đừng hạ Severity cho "đẹp ô" — phạm vi hẹp là lý do hạ Ưu tiên, không phải hạ Severity.`);
    else if (RISK_HIGH.test(r) && /^(low|lowest)$/i.test(p)) warnings.push(`${id}: ô ⚠ trong ma trận §7b — \`Severity\` ${r} (mất dữ liệu/sai tiền/bảo mật) nhưng \`Ưu tiên\` ${p}; ghi lý do dịch bậc hoặc sửa 1 trong 2 cột.`);
    if (RISK_LOW.test(r) && /^(critical|highest)$/i.test(p)) warnings.push(`${id}: ô ⚠ trong ma trận §7b — \`Severity\` ${r} (hiển thị/thẩm mỹ, dữ liệu dưới đúng) nhưng \`Ưu tiên\` Highest. Hợp lệ khi khách nhìn trực tiếp lúc trả tiền / sắp demo; phải ghi lý do trong \`Assumptions\`.`);
  }
  // 2d) THANG CŨ (set-level, 1 lần/file) — bộ TC cũ dùng High/Medium/Low thì nhắc chuyển, KHÔNG chặn và
  // KHÔNG cảnh báo từng dòng (530 dòng cảnh báo = tiếng ồn, sẽ bị lướt).
  {
    const legacy = doc.tests.filter((t) => RISK_LEGACY.test(String(t.risk || '').trim())).length;
    const modern = doc.tests.filter((t) => SEVERITY_OK.test(String(t.risk || '').trim())).length;
    if (legacy && !modern) warnings.push(`Bộ này dùng thang rủi ro CŨ 3 mức (${legacy} TC) — task mới dùng \`Severity\`: Blocker|Critical|Major|Minor|Trivial (§8). Bộ cũ không cần chuyển.`);
    else if (legacy && modern) warnings.push(`Bộ này TRỘN 2 thang: ${modern} TC dùng Severity 5 mức, ${legacy} TC còn thang cũ 3 mức — thống nhất 1 thang trong cùng một bộ để lọc/thống kê không lệch.`);
  }
  /*
   * 2d-bis) KỸ THUẬT THIẾT KẾ (EP · BVA · DT · ST · UC · EG) — HAI TẦNG, theo đúng mẫu `Loại case` ở trên.
   *
   * VÌ SAO Ở CẤP BỘ chứ không cấp dòng: câu hỏi "bộ này đã dùng quy ước kỹ thuật chưa" chỉ trả lời được khi
   * nhìn cả bộ. Hỏi từng dòng thì bộ cũ ra 530 dòng đỏ, và một luật làm đỏ toàn bộ sẽ bị tắt trong một ngày.
   *
   * TẦNG 1 — bộ CHƯA có case nào mang tag kỹ thuật: tự từ chối chặn, nhưng PHẢI KÊU. Im lặng thì không ai
   * biết bộ đang không được gác, và "không ai báo gì" bị đọc nhầm thành "đã đạt".
   * TẦNG 2 — bộ ĐÃ có từ một case trở lên: thiếu tag = CHẶN, mã lạ = CHẶN.
   */
  {
    const coTag = doc.tests.filter((t) => (t.techniques || []).length);
    const maLa = [];
    for (const tc of doc.tests) {
      for (const bad of m.unknownTechniqueTags(tc.tags, tc.title)) {
        maLa.push(`${tc.tcId || '(no-id)'}: \`[${bad}]\``);
      }
    }
    // Mã lạ CHẶN bất kể bộ đã dùng hay chưa: `[XYZ]` không phải quy ước cũ, nó là lỗi gõ hoặc mã tự bịa.
    if (maLa.length) {
      problems.push(`${maLa.length} tag trông như mã kỹ thuật nhưng KHÔNG có trong `
        + `\`.agent/config/design_techniques.json\` (6 mã: ${TECHNIQUE_CODES.join('|')}): ${maLa.slice(0, 6).join(' · ')}`
        + `${maLa.length > 6 ? ` … (+${maLa.length - 6})` : ''}. Sửa mã, hoặc khai thêm vào config kèm điều kiện kích hoạt.`);
    }

    if (!coTag.length) {
      warnings.push(`Bộ này CHƯA ĐƯỢC GÁC theo kỹ thuật thiết kế: 0/${doc.tests.length} case mang tag `
        + `[EP]/[BVA]/[DT]/[ST]/[UC]/[EG]. Gate tự từ chối chặn để bộ cũ không đỏ oan — nhưng cũng nghĩa là `
        + `không gì kiểm được case có thật sự thiết kế theo kỹ thuật nào. Điều kiện bắt buộc dùng từng kỹ `
        + `thuật nằm ở \`.agent/config/design_techniques.json\`.`);
    } else {
      const thieu = doc.tests.filter((t) => !(t.techniques || []).length).map((t) => t.tcId || '(no-id)');
      if (thieu.length) {
        problems.push(`${thieu.length}/${doc.tests.length} case THIẾU tag kỹ thuật, trong khi bộ này ĐÃ dùng `
          + `quy ước (${coTag.length} case có): ${thieu.slice(0, 8).join(', ')}`
          + `${thieu.length > 8 ? ` … (+${thieu.length - 8})` : ''}. Trộn hai quy ước trong một bộ thì mọi `
          + `con số đếm theo kỹ thuật về sau đều là phần của một mẫu số không ai biết.`);
      }

      /*
       * BVA mà dữ liệu test không có giá trị ở biên — mức CẢNH BÁO, cố ý.
       * Heuristic này phải đoán con số trong ô là độ dài, là số lượng hay là ngày, mà ba loại nhìn giống
       * nhau. Chưa đo tỉ lệ báo oan trên bộ TC thật thì chưa được đặt CHẶN (xem `_nguong` trong config,
       * cùng tiền lệ với locator_lint: cảnh báo trước, siết sau khi có số).
       */
      const CO_SO = /\d/;
      const bvaRong = doc.tests
        .filter((t) => (t.techniques || []).includes('BVA'))
        .filter((t) => !CO_SO.test(String(t.data || '')))
        .map((t) => t.tcId || '(no-id)');
      if (bvaRong.length) {
        warnings.push(`${bvaRong.length} case khai \`[BVA]\` mà ô \`Dữ liệu Test\` KHÔNG có con số nào: `
          + `${bvaRong.slice(0, 6).join(', ')}${bvaRong.length > 6 ? ` … (+${bvaRong.length - 6})` : ''}. `
          + `BVA là kiểm tại biên — không nêu giá trị biên cụ thể thì tag chỉ là nhãn dán.`);
      }

      // ST mà không có case nào vừa [ST] vừa [Negative]: mới kiểm đường đi được, chưa kiểm đường phải CHẶN.
      const coST = doc.tests.filter((t) => (t.techniques || []).includes('ST'));
      if (coST.length && !coST.some((t) => (t.dimensions || []).includes('negative'))) {
        warnings.push(`${coST.length} case khai \`[ST]\` nhưng KHÔNG case nào vừa [ST] vừa [Negative] — `
          + `mới kiểm transition đi được, chưa kiểm transition phải bị CHẶN. Nửa sau mới là chỗ bug sống.`);
      }

      // EG phải neo vào một quan sát có thật, không thì nó là cảm tính chứ không phải kỹ thuật.
      const egTreo = doc.tests
        .filter((t) => (t.techniques || []).includes('EG'))
        .filter((t) => !(t.dimensions || []).includes('bughistory') && !(t.oracleRefs || []).length)
        .map((t) => t.tcId || '(no-id)');
      if (egTreo.length) {
        warnings.push(`${egTreo.length} case khai \`[EG]\` mà không kèm \`[BugHistory]\` lẫn oracle-ref: `
          + `${egTreo.slice(0, 6).join(', ')}. Error Guessing phải neo vào quan sát CÓ THẬT, không thì là cảm tính.`);
      }
    }
  }

  /*
   * 2d-ter) [NeedsVerify] — case chưa có nguồn chống lưng (H3).
   *
   * BỐN NHÓM case không được suy diễn, vì đoán sai là fail giả hàng loạt: bố cục và thứ tự · nhãn nguyên
   * văn · giá trị mặc định · định dạng hiển thị. Case thuộc bốn nhóm đó mà không trỏ được tới spec, Figma
   * hay một lần đọc DOM cụ thể thì PHẢI mang `[NeedsVerify]`.
   *
   * Ở ĐÂY CHỈ CẢNH BÁO, cố ý. Tag này SINH RA để tồn tại trong lúc Phase 1 chạy — chặn nó ngay là cấm
   * người viết thừa nhận mình chưa có bằng chứng, và họ sẽ bỏ tag đi thay vì đi tìm bằng chứng.
   * Chỗ CHẶN là lúc PUBLISH: `design:gate --publish` (xem file đó), vì lên Sheet rồi thì cả đội đọc nó
   * như một khẳng định chắc chắn.
   */
  {
    const canXac = doc.tests.filter((t) => (t.tags || '').toLowerCase().includes('needsverify')
      || String(t.title || '').toLowerCase().includes('[needsverify]'));
    if (canXac.length) {
      warnings.push(`${canXac.length}/${doc.tests.length} case mang \`[NeedsVerify]\` — chưa có nguồn chống `
        + `lưng (spec, Figma, hoặc một lần đọc DOM cụ thể): `
        + `${canXac.slice(0, 6).map((t) => t.tcId || '(no-id)').join(', ')}`
        + `${canXac.length > 6 ? ` … (+${canXac.length - 6})` : ''}. `
        + `Publish sẽ CHẶN khi còn tag này — đi tìm nguồn, đừng gỡ tag.`);
    }
  }

  /*
   * 2e) PRE-CODE ↔ CATALOG — mã tiền điều kiện phải neo được vào catalog Setup Strategy.
   * Tiền điều kiện chỉ là TEXT
   * trong case ⇒ mã trỏ vào hư không vẫn publish trót lọt, và Phase 2 KHÔNG có gì để dựng precondition đó.
   * Chỉ kiểm khi file CÓ catalog (`doc.setup`): file chỉ-testcase thì không phán, tránh báo oan.
   */
  if ((doc.setup || []).length) {
    const declared = new Set(doc.setup.map((s) => String(s.preId || '').toUpperCase().match(/PRE-\d+/g) || []).flat());
    const usedBy = new Map();
    for (const tc of doc.tests) {
      for (const code of String(tc.precondition || '').toUpperCase().match(/PRE-\d+/g) || []) {
        if (!usedBy.has(code)) usedBy.set(code, []);
        usedBy.get(code).push(tc.tcId || '(no-id)');
      }
    }
    const orphan = [...usedBy.keys()].filter((c) => !declared.has(c));
    if (orphan.length) {
      problems.push(`${orphan.length} mã tiền điều kiện KHÔNG có trong catalog Setup Strategy: ${orphan.slice(0, 6).map((c) => `[${c}] (vd ${usedBy.get(c)[0]})`).join(', ')}${orphan.length > 6 ? ` …(+${orphan.length - 6})` : ''}. Trên Google Sheet mã chỉ là text trong case — trỏ vào hư không thì Phase 2 không biết dựng gì. Khai vào sheet \`Preconditions\` hoặc sửa mã ở case.`);
    }
    const unused = [...declared].filter((c) => !usedBy.has(c));
    if (unused.length) warnings.push(`${unused.length} mã khai trong catalog mà KHÔNG case nào dùng: ${unused.slice(0, 8).join(', ')}${unused.length > 8 ? ' …' : ''} — hoặc thiếu case, hoặc catalog còn rác của lượt trước.`);

    /*
     * ĐỘ ĐẦY ĐỦ CỦA CATALOG (cấp bộ, 1 dòng — không spam từng row).
     * Template khai 9 cột nhưng bộ thật đo được chỉ có 4 (thiếu Type/Source/Verification/Cleanup/Readiness),
     * và không gì kêu. Thiếu `Cleanup` là thiếu đúng phần khiến precondition dựng-rồi-không-dọn — chính là
     * nguồn của case sau chạy trên state bẩn. Cảnh báo chứ không chặn: bộ cũ không nên bị khoá cứng.
     */
    const has = (f) => doc.setup.some((s) => String(s[f] || '').trim());
    const miss = [['cleanup', 'Cleanup/Rollback'], ['verification', 'Setup Verification'], ['type', 'Precondition Type']].filter(([f]) => !has(f)).map(([, label]) => label);
    if (miss.length) warnings.push(`Catalog Setup Strategy thiếu hẳn cột: ${miss.join(', ')} (đo trên ${doc.setup.length} dòng). Thiếu Cleanup = precondition dựng rồi không dọn ⇒ case sau chạy trên state bẩn; thiếu Verification = không biết đã dựng xong chưa. Template đầy đủ ở prompt gen §Setup Strategy.`);
  }

  /*
   * 2f) PRECONDITION TỰ MÔ TẢ CÁCH DỰNG (áp cho bộ KHÔNG dùng catalog).
   *
   * Precondition giờ chỉ là một trường của testcase — không còn thực thể riêng, không còn sheet. Nhưng
   * Phase 2 vẫn phải biết DỰNG BẰNG GÌ để chọn api/factory/hook/ui hay bỏ sang manual. Chỗ duy nhất
   * sống sót round-trip publish→pull (Google Sheet không có field "cách dựng") là CHÍNH text precondition, nên
   * method đi vào tag đầu cell: `[api] Deal đã ở stage X`.
   *
   * CHẶN khi thiếu/lạ tag: không có nó thì Phase 2 quay lại đoán — và đoán sai ở tầng setup thì mọi
   * verdict sau đó vô nghĩa (fail vì state, không vì sản phẩm). Bộ CÓ catalog thì bỏ qua luật này để
   * không phá bộ cũ.
   */
  if (!(doc.setup || []).length) {
    const METHODS = ['api', 'factory', 'test_hook', 'ui', 'pre_existing', 'manual'];
    const byDesc = new Map();
    for (const tc of doc.tests) {
      const id = tc.tcId || '(no-id)';
      const cell = String(tc.precondition || '').trim();
      if (!cell) continue;                       // ô rỗng đã bị luật (2) chặn, không báo trùng
      for (const part of cell.split(/<br\s*\/?>|\n/).map((x) => x.trim()).filter(Boolean)) {
        const m = part.match(/^\[([a-z_]+)\]\s*(.*)$/i);
        if (!m) {
          problems.push(`${id}: ô \`Tiền điều kiện\` thiếu tag cách dựng — phải mở đầu bằng \`[${METHODS.join('|')}]\` (vd \`[api] Deal đã ở stage Soạn thảo hợp đồng\`). Không có tag thì Phase 2 phải ĐOÁN cách dựng state, và đoán sai ở tầng setup làm mọi verdict sau đó vô nghĩa.`);
          continue;
        }
        const method = m[1].toLowerCase();
        if (!METHODS.includes(method)) {
          problems.push(`${id}: tag cách dựng \`[${m[1]}]\` không thuộc ${METHODS.join('|')}. KHÔNG có \`db\` — dựng state bằng DB bị cấm (RULE_GLOBAL).`);
          continue;
        }
        const desc = m[2].trim().toLowerCase().replace(/\s+/g, ' ');
        if (!desc) problems.push(`${id}: tag [${method}] không kèm mô tả trạng thái — cell phải tự đọc được.`);
        else {
          if (!byDesc.has(desc)) byDesc.set(desc, new Map());
          const mm = byDesc.get(desc);
          if (!mm.has(method)) mm.set(method, []);
          mm.get(method).push(id);
        }
      }
    }
    /*
     * MỘT TRẠNG THÁI — HAI CÁCH DỰNG: dấu hiệu người viết chưa quyết, hoặc copy lệch. Bỏ mã `[PRE-NN]`
     * đồng nghĩa mất dedup, nên đây là máy thay thế: cùng mô tả thì phải cùng method.
     */
    for (const [desc, mm] of byDesc) {
      if (mm.size < 2) continue;
      const detail = [...mm.entries()].map(([k, ids]) => `${k} (${ids.slice(0, 2).join(', ')}${ids.length > 2 ? '…' : ''})`).join(' vs ');
      warnings.push(`Cùng một trạng thái "${desc.slice(0, 60)}" được khai ${mm.size} cách dựng khác nhau: ${detail}. Chọn một cách, nếu thật sự khác nhau thì mô tả phải khác nhau.`);
    }
  }

  // 3) DIMENSION (set-level) — cảnh báo.
  const dims = new Set(doc.tests.flatMap((t) => t.dimensions));
  if (!dims.has('negative')) warnings.push('Bộ testcase chưa có case [Negative] nào — mọi chức năng nên có ≥1 negative');
  /*
   * Neo vào `Ưu tiên`, KHÔNG vào cột Severity đã bỏ — nếu cứ đọc `t.risk` thì bộ mới (không có cột đó)
   * làm check này im lặng: `highs.length` luôn 0 nên không bao giờ cảnh báo. Đúng lớp lỗi đã dính ở
   * `validate.js` khi tag rời tiêu đề. Vẫn nhận `t.risk` để bộ TC cũ giữ nguyên hành vi.
   */
  const highs = doc.tests.filter((t) => /^(critical|high)$/i.test(String(t.priority || '').trim())
    || RISK_HIGH.test(String(t.risk || '').trim()));
  if (highs.length && !dims.has('boundary') && !dims.has('security')) {
    warnings.push(`Có ${highs.length} case High-risk nhưng chưa thấy [Boundary]/[Security] — chạy risk:gate:enforce để ép depth`);
  }
  /*
   * 4) CHẤT LƯỢNG TIÊU ĐỀ (set-level) — cảnh báo.
   *
   * Từ 21/08/2026 tag ra cột `Tag`, nên tiêu đề phải TỰ ĐỦ NGHĨA. Hai lỗi dưới đây đo được bằng máy,
   * và cả hai đều đã xảy ra thật ở bộ CSDL-26878:
   *
   *  (a) TIỀN TỐ HẰNG SỐ — `Cross-app - ` gắn cho 101/101 case. Một trường mà mọi dòng cùng một giá trị
   *      thì không phân biệt được gì; nó chỉ đẩy nội dung thật ra xa. Chỉ kêu khi bộ có ≥5 case và
   *      TOÀN BỘ dùng chung tiền tố — dưới ngưỡng đó thì trùng nhau là chuyện bình thường.
   *  (b) GHI TAG HAI CHỖ — cột `Tag` đã có mà tiêu đề vẫn còn khối ngoặc ở đầu. Không sai kết quả (model
   *      lấy HỢP) nhưng là dấu hiệu bộ đang chuyển dở, và người đọc lại phải lướt qua ngoặc.
   */
  const titles = doc.tests.map((t) => String(t.title || '').trim()).filter(Boolean);
  /*
   * CHỈ áp cho bộ đã theo format mới (có cột `Tag`) — đúng tiền lệ lúc thêm `Loại case`: luật mới không
   * được làm đỏ/ồn những bộ có TRƯỚC luật. Đo thật 21/08/2026: bật cho tất cả thì 8 bộ cũ kêu ngay
   * (`OPS - ` 95/95 · `Mobile - ` 96/96 · `Staging - ` 34/36 …). Chúng đúng là cùng một lỗi,
   * nhưng nag bộ đã publish mà không ai sinh lại chỉ dạy người đọc bỏ qua cảnh báo. Bộ nào sinh lại
   * theo prompt mới sẽ có cột `Tag` và tự vào tầm ngắm.
   */
  const isNewFormat = (doc.headers || []).some((h) => m.COL.tags(m.normalizeHeader(h)));
  if (isNewFormat && titles.length >= 5) {
    /*
     * ĐA SỐ, không phải TOÀN BỘ. Bản đầu đòi `titles.every(...)` và bị chính bộ thử bắt lỗi: chỉ cần
     * MỘT case lệch (vd còn sót `[Positive]` ở đầu) là head khác đi và check tắt hoàn toàn — trong khi
     * 5/6 case vẫn đang mang tiền tố vô nghĩa. Ngưỡng 80% bắt được cả bộ đang dở dang.
     * Bỏ khối tag ở đầu trước khi lấy head, để tag còn sót không che mất tiền tố thật.
     */
    const head = (x) => {
      const bare = x.replace(/^(?:\s*\[[^\]]*\])+\s*/, '');
      const i = bare.indexOf(' - ');
      return i > 0 ? bare.slice(0, i) : '';
    };
    const freq = new Map();
    for (const t of titles) { const h = head(t); if (h) freq.set(h, (freq.get(h) || 0) + 1); }
    const [top, n] = [...freq.entries()].sort((a, b) => b[1] - a[1])[0] || [null, 0];
    if (top && n / titles.length >= 0.8) {
      warnings.push(`${n}/${titles.length} case mở đầu bằng "${top} - " — tiền tố hằng số KHÔNG phân biệt được case nào với case nào. Bỏ đi; thông tin đó thuộc \`Loại case\` và tên nhóm/folder.`);
    }
  }
  const bothPlaces = doc.tests.filter((t) => String(t.tags || '').trim() && /^\s*\[/.test(String(t.title || '')));
  if (bothPlaces.length) {
    warnings.push(`${bothPlaces.length} case ghi tag ở CẢ cột \`Tag\` lẫn đầu tiêu đề (${bothPlaces.slice(0, 3).map((t) => t.tcId).join(', ')}${bothPlaces.length > 3 ? '…' : ''}) — giữ ở cột \`Tag\`, gỡ khỏi tiêu đề.`);
  }

  return { problems, warnings };
}

module.exports = { validate, REQUIRED_COLS, REQUIRED_FIELDS };
