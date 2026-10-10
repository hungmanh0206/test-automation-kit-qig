import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rules = require('../../../scripts/qa/lib/output_rules.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { validate } = require('../../../scripts/lib/testcase/validate.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const model = require('../../../scripts/lib/testcase/model.js');

/*
 * @infra — MOCK LỆCH (v2.5.0 G1.6): hôm nay backend đổi field, mock vẫn trả bản cũ, case vẫn XANH.
 *
 * PHÉP ĐO ĐÃ ĐỔI PHẠM VI HẠNG MỤC NÀY, và phải nói ra:
 *  · Kế hoạch ghi `spec_extract.js` đọc OpenAPI. **SAI** — grep toàn `scripts/`: KHÔNG script nào parse
 *    OpenAPI/Swagger. Chúng chỉ nhắc chữ "swagger" làm tín hiệu chiều, hoặc kiểm thư mục có tồn tại.
 *  · Repo có **0 file OpenAPI/Swagger** trong cả 5 task, và `tests/api/` KHÔNG tồn tại (0 spec API).
 *  ⇒ Bộ sinh test API từ OpenAPI KHÔNG được xây ở đợt này: nó sẽ là một skill không ai chạy được. Danh
 *    mục API do discovery của v2.6.0 sinh ra mới là đầu vào đúng cho nó.
 *
 * Phần XÂY là ba luật chống mock lệch mà A không có. Hai trong ba đo được, và chúng là **gác PHÒNG NGỪA**:
 * đo 10/10/2026 thì **0 case trong repo mang tag `[Mock]`**. Chặn một mẫu chưa xuất hiện, không đang dọn
 * nợ — và test này neo cả con số 0 đó lại.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');

/**
 * `validate` nhận một DOC đã parse (`{headers, tests}`), KHÔNG nhận mảng testcase — bản đầu của fixture
 * này truyền mảng nên validate trả đúng một lỗi "bảng 9-cột không parse được" và 4 test đỏ vì fixture
 * sai, không vì luật sai. Dựng `headers` từ `CANONICAL_COLS` để nó không trôi khi bộ cột đổi.
 */
const validateTestcases = (tests: Record<string, unknown>[]) => validate({ headers: model.CANONICAL_COLS, tests });

/** Một testcase đủ trường để `validate` không đỏ vì lý do khác. */
const tc = (over: Record<string, unknown> = {}) => ({
  tcId: 'TC_001',
  title: 'Thêm học sinh với email hợp lệ',
  module: 'Học sinh',
  precondition: '[ui] đã đăng nhập',
  data: 'email abc@x.vn',
  steps: '1. Mở màn thêm mới<br>2. Nhập email<br>3. Bấm Ghi',
  expected: '1. Màn mở đúng<br>2. Ô nhận giá trị<br>3. Lưu được và hiện "Thêm mới thành công"',
  priority: 'High',
  dimensions: [],
  ...over,
});

test.describe('@infra mock lệch — case [Mock] không được phán về backend', () => {
  test('`gate:output`: kết luận chạm backend ⇒ CHẶN', () => {
    for (const c of [
      'Đã lưu thành công vào DB, kiểm lại thấy bản ghi.',
      'API thật trả đúng mã 200 và payload khớp.',
      'Server đã lưu, dữ liệu persist sau reload.',
    ]) {
      const r = rules.lintMockScope({ tag: '[Mock]', comment: c });
      expect(r, `phải chặn: ${c}`).toBeTruthy();
      expect(r.level).toBe('problem');
      expect(r.message, 'phải nói VÌ SAO mock không chứng minh được backend').toMatch(/response ta tự đặt|TỰ ĐẶT/i);
    }
  });

  test('ÂM BẢN: kết luận chỉ về FE ⇒ KHÔNG chặn', () => {
    for (const c of [
      'FE hiện đúng thông báo "Email không đúng định dạng" khi response trả 400.',
      'Lưới giữ nguyên dữ liệu cũ và hiện toast lỗi khi API timeout.',
      'Màn không trắng khi response thiếu field `ten`.',
    ]) {
      expect(rules.lintMockScope({ tag: '[Mock]', comment: c }), `không được chặn: ${c}`).toBeNull();
    }
  });

  test('ÂM BẢN: case KHÔNG có tag [Mock] thì luật này không áp', () => {
    /* Case API thật thì "đã lưu vào DB" là kết luận ĐÚNG — chặn nó là chặn oan. */
    expect(rules.lintMockScope({ tag: '[DbPersist]', comment: 'Đã lưu thành công vào DB.' })).toBeNull();
    expect(rules.lintMockScope({ comment: 'Đã lưu thành công vào DB.' })).toBeNull();
  });

  test('tag nhận cả từ TIÊU ĐỀ, không chỉ cột Tag', () => {
    /*
     * `validate.js` đã trả giá đúng chuyện này 21/08/2026: kiểm tag đọc từ tiêu đề nên khi tag chuyển sang
     * cột `Tag` thì phép kiểm im lặng — 45 cảnh báo tụt về 0 mà không một dòng lỗi.
     */
    expect(rules.lintMockScope({ title: '[Mock] FE xử lý 500', comment: 'Đã lưu vào DB.' })).toBeTruthy();
  });
});

test.describe('@infra mock lệch — `[Mock]` + Loại case API/Database', () => {
  test('CHẶN, và chỉ đúng đường sửa', () => {
    for (const loai of ['API', 'Database']) {
      const r = validateTestcases([tc({ dimensions: ['Mock'], caseType: loai })]);
      const hit = (r.problems || []).filter((p: string) => /\[Mock\]/.test(p));
      expect(hit.length, `${loai} phải bị chặn:\n${(r.problems || []).join('\n')}`).toBe(1);
      expect(hit[0], 'phải chỉ đường: đổi loại + tách một case chạy thật').toMatch(/tách một case/);
    }
  });

  test('ÂM BẢN: `[Mock]` + Loại case UI hoặc Functional ⇒ KHÔNG chặn', () => {
    for (const loai of ['UI', 'Functional']) {
      const r = validateTestcases([tc({ dimensions: ['Mock'], caseType: loai })]);
      expect((r.problems || []).filter((p: string) => /\[Mock\]/.test(p)),
        `${loai} là đường HỢP LỆ cho case mock`).toEqual([]);
    }
  });

  test('ÂM BẢN: Loại case API mà KHÔNG có tag Mock ⇒ KHÔNG chặn', () => {
    const r = validateTestcases([tc({ dimensions: ['ApiContract'], caseType: 'API' })]);
    expect((r.problems || []).filter((p: string) => /\[Mock\]/.test(p))).toEqual([]);
  });

  test('CHẶN chứ không cảnh báo — khác luật tag↔loại ở trên nó', () => {
    /*
     * Luật tag↔loại chỉ CẢNH BÁO, có chủ đích: bảng "không chọn khi" của 9 loại đã liệt kê những ca chồng
     * lấn HỢP LỆ. Ở đây thì không có ca nào hợp lệ — mock không bao giờ là bằng chứng về backend — nên nó
     * phải nằm ở `problems`, không phải `warnings`.
     */
    const r = validateTestcases([tc({ dimensions: ['Mock'], caseType: 'Database' })]);
    expect((r.problems || []).some((p: string) => /\[Mock\]/.test(p))).toBe(true);
    expect((r.warnings || []).some((p: string) => /có tag `\[Mock\]`/.test(p)), 'không được chỉ là cảnh báo').toBe(false);
  });
});

test.describe('@infra mock lệch — số đo và phạm vi đã nói rõ', () => {
  test('repo THẬT: 0 case mang tag `[Mock]` — gác phòng ngừa, không dọn nợ', () => {
    /*
     * Neo con số 0 vào máy. Ngày có case `[Mock]` đầu tiên, test này đỏ và người sửa phải cập nhật câu
     * "gác phòng ngừa" trong skill lẫn trong chú thích của hai gate — lúc đó nó không còn đúng.
     */
    const ra: string[] = [];
    const di = (d: string, sau = 0) => {
      if (sau > 6) return;
      let es: fs.Dirent[];
      try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of es) {
        const p = path.join(d, e.name);
        /*
         * Loại `test-results/`: đó là artifact của LƯỢT CHẠY, không phải testcase. Bản đầu của phép quét
         * này bắt chính `error-context.md` mà lượt test vừa rồi sinh ra — tức nó tự làm mình đỏ. Lần thứ
         * năm trong phiên một phép quét bắt đúng rác của chính nó.
         */
        if (e.isDirectory()) { if (!/^(test-results|playwright-report|node_modules)$/.test(e.name)) di(p, sau + 1); }
        else if (e.name.endsWith('.md') && /\[Mock\]/.test(fs.readFileSync(p, 'utf8'))) ra.push(path.relative(REPO, p));
      }
    };
    di(path.join(REPO, 'outputs'));
    expect(ra, 'có case [Mock] đầu tiên ⇒ cập nhật câu "gác phòng ngừa" ở skill và hai gate').toEqual([]);
  });

  test('repo THẬT: 0 file OpenAPI/Swagger — nên KHÔNG xây bộ sinh test API ở đợt này', () => {
    /*
     * Kế hoạch G1.6 ghi `spec_extract.js` đọc OpenAPI. Grep toàn `scripts/`: KHÔNG script nào parse
     * OpenAPI. Và không task nào có file swagger. Xây bộ sinh từ OpenAPI bây giờ là xây một skill không
     * ai chạy được — danh mục API của discovery (v2.6.0) mới là đầu vào đúng.
     */
    const ra: string[] = [];
    const di = (d: string, sau = 0) => {
      if (sau > 6) return;
      let es: fs.Dirent[];
      try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of es) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { if (!/node_modules/.test(e.name)) di(p, sau + 1); }
        else if (/swagger|openapi/i.test(e.name)) ra.push(path.relative(REPO, p));
      }
    };
    di(path.join(REPO, 'outputs'));
    expect(ra, 'có file OpenAPI đầu tiên ⇒ cân nhắc lại bộ sinh test API, và cập nhật skill `ui_mocking`').toEqual([]);

    const sk = fs.readFileSync(path.join(REPO, '.agent/skills/phase2/ui_mocking/SKILL.md'), 'utf8');
    expect(sk, 'skill phải NÓI RÕ giới hạn đó, không để người đọc tưởng đã có validate schema').toMatch(/0 file OpenAPI/);
  });

  test('skill `ui_mocking` có trong INDEX và nêu đủ ba luật', () => {
    expect(fs.readFileSync(path.join(REPO, '.agent/skills/INDEX.md'), 'utf8')).toContain('ui_mocking');
    const sk = fs.readFileSync(path.join(REPO, '.agent/skills/phase2/ui_mocking/SKILL.md'), 'utf8');
    expect(sk, 'luật 1: không bịa response').toMatch(/routeFromHAR/);
    expect(sk, 'luật 2: validate schema').toMatch(/VALIDATE SCHEMA/);
    expect(sk, 'luật 3: tag [Mock], chỉ kết luận FE').toMatch(/\[Mock\]/);
    expect(sk, 'và phải trỏ tới bộ mock đã có, không khuyên viết lại').toMatch(/externalDependencyMock/);
  });
});
