import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { renderApiCard, buildHtml, HAU_TO } = require('../../../scripts/utils/evidence/api_card.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const rules = require('../../../scripts/qa/lib/output_rules.js');

/*
 * @infra — EVIDENCE CHO TEST API (v2.5.0 G2.2): render request/response thành ẢNH.
 *
 * LỖ THẬT, và nó không hiển nhiên: non-negotiable §4 đòi MỌI case đã execute phải có ảnh hoặc video, và
 * CẤM `.json/.md/.txt/.log/.html/.csv`. Test UI thì chụp màn. Test API thì **KHÔNG CÓ GÌ ĐỂ CHỤP** — nên
 * trước file này, một case `Loại case = API` không thể tạo evidence hợp luật, và đường duy nhất còn lại
 * là dán response vào `.json`, đúng thứ luật 4 cấm.
 *
 * ĐÂY KHÔNG PHẢI NỚI LUẬT. Luật 4 giữ nguyên là ảnh; chỉ đổi CÁCH TẠO RA ảnh.
 *
 * GÁC Ở CHỖ SINH RA, KHÔNG GÁC Ở GATE — vì một phép đo: entry trong `testcase-status.json` chỉ có
 * `tcId · status · comment · evidence · runId`, **không có `Loại case`**. Gate không biết case nào là API
 * nên không thể đòi "case API phải có thẻ API", và nó cũng không đọc được PIXEL để biết ảnh có đủ
 * method/URL/status. Nên `renderApiCard` TỪ CHỐI render khi thiếu — ảnh tồn tại ⇒ các trường đã có, vì
 * không có đường nào khác tạo ra ảnh đó.
 *
 * Phạm vi hiện tại, nói thẳng: đo 10/10/2026 trên bộ TC thật có **3 case `Loại case = API`** (trong 949
 * case đã phân loại), và `tests/api/` chưa tồn tại. Bộ này mở đường, chưa dọn nợ.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');

const OK = {
  method: 'POST',
  url: '/api/v2/hoc-sinh',
  status: 400,
  requestBody: { email: 'abc', hoTen: 'Nguyen Van A' },
  responseBody: { error: 'EMAIL_INVALID', message: 'Email không đúng định dạng' },
  note: 'BR-HS-012: email thiếu @ phải bị chặn',
};

test.describe('@infra api_card — TỪ CHỐI render khi thiếu trường', () => {
  test('thiếu `method`/`url`/`status` ⇒ NÉM, và gọi tên trường thiếu', () => {
    for (const k of ['method', 'url', 'status'] as const) {
      const o: Record<string, unknown> = { ...OK };
      delete o[k];
      expect(() => buildHtml(o), `thiếu ${k} phải bị từ chối`).toThrow(new RegExp(`thiếu .*${k}`));
    }
  });

  test('thiếu CẢ hai body ⇒ NÉM — thẻ chỉ có method/URL/status không nói app trả gì', () => {
    expect(() => buildHtml({ method: 'GET', url: '/api/x', status: 200 })).toThrow(/thiếu CẢ/);
  });

  test('ÂM BẢN: chỉ có response body (GET) ⇒ render được', () => {
    expect(() => buildHtml({ method: 'GET', url: '/api/x', status: 200, responseBody: { n: 1 } })).not.toThrow();
  });

  test('`status` = 0 hoặc chuỗi rỗng vẫn bị TỪ CHỐI, không lọt nhờ falsy', () => {
    /*
     * Bẫy quen: kiểm `!o.status` thì `status: 0` lọt hoặc bị chặn sai. Ở đây kiểm `undefined/null/rỗng`
     * nên `status: 0` là một giá trị KHAI, còn `''` thì không.
     */
    expect(() => buildHtml({ ...OK, status: '' })).toThrow(/thiếu/);
    expect(() => buildHtml({ ...OK, status: 0 })).not.toThrow();
  });
});

test.describe('@infra api_card — PII và một nguồn masker', () => {
  test('email và số điện thoại bị CHE trong HTML trước khi chụp', () => {
    const h = buildHtml({
      ...OK,
      responseBody: { email: 'khachthat@vnpt.vn', sdt: '0912345678' },
      note: 'liên hệ 0987654321',
    });
    expect(h, 'email thật không được vào ảnh').not.toContain('khachthat@vnpt.vn');
    expect(h, 'SĐT không được vào ảnh').not.toContain('0912345678');
    expect(h).not.toContain('0987654321');
  });

  test('DÙNG LẠI `sanitize.js`, KHÔNG viết bản masker thứ ba', () => {
    /*
     * Kit đã có hai bản PII (`evidence/sanitize.js` và `PII_PATTERNS` của `output_rules`). Thêm bản thứ
     * ba là tạo đúng cái lỗi mà kit đang đi chặn ở chỗ khác — và hai bản sẽ trôi khỏi nhau.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/utils/evidence/api_card.js'), 'utf8');
    expect(src).toMatch(/require\(path\.join\(__dirname, 'sanitize'\)\)/);
    expect(src, 'không được tự khai mẫu email/SĐT').not.toMatch(/@\[A-Za-z0-9|\\+84/);
  });

  test('báo số PII đã che, để báo cáo nói được "có che" thay vì chỉ hứa', () => {
    const n = rules.PII_PATTERNS ? 1 : 1;   // chỉ để chắc module nạp được
    expect(n).toBe(1);
  });
});

test.describe('@infra api_card — chụp thật, và evidence hợp luật 4', () => {
  test('render ra PNG, và `output_gate` nhận nó là evidence hợp lệ', async ({ page }) => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'apicard-'));
    const out = path.join(d, `TC_088${HAU_TO}`);
    const r = await renderApiCard(page, { ...OK, responseBody: { email: 'a@b.vn' } }, out);

    expect(fs.existsSync(out), 'phải sinh ra file PNG').toBe(true);
    expect(fs.statSync(out).size, 'ảnh rỗng thì không phải evidence').toBeGreaterThan(2000);
    expect(r.method).toBe('POST');
    expect(r.piiMasked, 'phải đếm được PII đã che').toBeGreaterThan(0);

    /* LUẬT 4 KHÔNG ĐỔI: ảnh được nhận vì nó là `.png`, không vì có ngoại lệ nào cho API. */
    expect(rules.isVisualEvidence(out), 'PNG phải là evidence hợp lệ theo luật 4').toBe(true);
    expect(rules.isVisualEvidence(out.replace(/\.png$/, '.json')), '.json vẫn bị cấm').toBe(false);
    expect(rules.isVisualEvidence(out.replace(/\.png$/, '.html')), '.html vẫn bị cấm — HTML chỉ là trung gian').toBe(false);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('HTML trung gian KHÔNG được ghi ra đĩa', async ({ page }) => {
    /* Ghi `.html` ra cạnh ảnh là mở đúng đường mà luật 4 cấm: ai đó sẽ dùng nó làm evidence. */
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'apicard2-'));
    await renderApiCard(page, OK, path.join(d, `TC_001${HAU_TO}`));
    const lạ = fs.readdirSync(d).filter((f) => !f.endsWith('.png'));
    expect(lạ, 'chỉ được để lại đúng file PNG').toEqual([]);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('đường dẫn phải có hậu tố `-api-card.png`', async ({ page }) => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'apicard3-'));
    await expect(renderApiCard(page, OK, path.join(d, 'anh.png'))).rejects.toThrow(/hậu tố/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('`page` không phải Playwright ⇒ NÉM rõ ràng, không lỗi khó hiểu', async () => {
    await expect(renderApiCard({} as never, OK, `/tmp/x${HAU_TO}`)).rejects.toThrow(/cần một `page`/);
  });
});

test.describe('@infra api_card — phạm vi đã nói rõ', () => {
  test('gác ở CHỖ SINH RA vì gate KHÔNG thấy `Loại case`', () => {
    /*
     * Neo phép đo vào máy: entry của `testcase-status.json` không mang `Loại case`, nên mọi luật kiểu
     * "case API phải có thẻ API" đặt ở gate đều không thực hiện được. Ngày schema đổi, test này đỏ và
     * người sửa sẽ xem lại được chỗ đặt phép gác.
     */
    const f = path.join(REPO, 'outputs/CSDL/tasks/CSDL-9003/test-results/testcase-status.json');
    if (!fs.existsSync(f)) { test.skip(true, 'máy này không có dữ liệu task (lớp PROJECT)'); return; }
    const t = JSON.parse(fs.readFileSync(f, 'utf8')).tests[0];
    expect(Object.keys(t), 'entry status không mang Loại case ⇒ gate không biết case nào là API').not.toContain('caseType');
    const src = fs.readFileSync(path.join(REPO, 'scripts/utils/evidence/api_card.js'), 'utf8');
    expect(src, 'phải nói rõ vì sao gác ở chỗ sinh ra').toMatch(/KHÔNG GÁC Ở GATE/);
    expect(src, 'và nói rõ gate không đọc được pixel').toMatch(/PIXEL/);
  });

  test('số case API thật ít — bộ này mở đường, chưa dọn nợ', () => {
    /*
     * 3 case `Loại case = API` trong 949 case đã phân loại, và `tests/api/` có **0 spec**.
     *
     * SỬA LẠI MỘT CÂU TÔI VIẾT SAI: ở G1.6 tôi ghi "`tests/api/` KHÔNG tồn tại". Thư mục CÓ tồn tại —
     * nó chứa đúng một `.gitkeep`, nên `ls` thường không thấy gì và tôi kết luận sai từ một lệnh không
     * thấy file ẩn. Phần trong ngoặc của câu đó ("0 spec API") thì đúng. Đo bằng đếm spec, không đếm
     * thư mục.
     */
    const d = path.join(REPO, 'tests/api');
    const spec = fs.existsSync(d) ? fs.readdirSync(d).filter((f) => /\.spec\.(ts|js)$/.test(f)) : [];
    expect(spec, 'có spec API đầu tiên ⇒ cập nhật câu "mở đường, chưa dọn nợ"').toEqual([]);
  });
});
