import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * Test cho gate `Loại case` — case sinh mới phải TỰ XÁC ĐỊNH 1 trong 9 loại đã chốt.
 *
 * Danh sách KHÔNG chép vào test: đọc thẳng `.agent/config/case_types.json` — nguồn duy nhất. Chép vào đây
 * nghĩa là khi bảng đổi (6 → 9 hôm 20/08/2026), test vẫn xanh với bảng cũ và không ai biết chỗ nào còn sót.
 *
 * Luật nằm ở HAI chỗ, có chủ đích, và test này canh cả hai để không ai gộp nhầm về một:
 *   - CỘT VẮNG MẶT  → `scripts/convert_excel/md_to_xlsx.js` (biên SINH case; bộ TC cũ 9 cột không convert
 *     lại nên không bị đỏ oan).
 *   - GIÁ TRỊ SAI    → `scripts/lib/testcase/validate.js` (bộ đọc DÙNG CHUNG, chặn ở design gate).
 * Ghép hai luật vào một chỗ là hoặc đỏ oan 9 bộ cũ, hoặc thả lọt giá trị rác — đã đo, không phải phỏng đoán.
 */

const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line global-require
const CASE_TYPES = require(path.join(REPO, '.agent', 'config', 'case_types.json'));
const CONVERT = path.join(REPO, 'scripts', 'convert_excel', 'md_to_xlsx.js');
const node = process.execPath;

/* spawnSync chứ không execFileSync: cảnh báo của gate đi ra **stderr**, mà execFileSync chỉ trả stdout khi
 * exit 0 — dùng nó thì test "--lenient phải KÊU" đỏ oan vì không nhìn thấy tiếng kêu. */
const run = (args: string[]) => {
  const r = spawnSync(node, args, { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}` };
};

const H9 = '| TC ID | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên | Mức độ rủi ro |\n|---|---|---|---|---|---|---|---|---|\n';
const H10 = '| TC ID | Loại case | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên | Mức độ rủi ro |\n|---|---|---|---|---|---|---|---|---|---|\n';
const TAIL = 'M | [Positive][Display] Lưới đơn hiển thị đủ cột | [ui] Đã đăng nhập OPS, ở màn Danh sách đơn | - | 1. Mở màn Danh sách đơn | 1. Lưới hiện đúng 3 cột "Mã đơn" / "Khách hàng" / "Tổng tiền" | Critical | Major |';
const NEG = 'M | [Negative][Validation] Mã đơn không tồn tại | [ui] Đã đăng nhập OPS, ở màn Danh sách đơn | Mã: ZZZ-000 | 1. Gõ "ZZZ-000" rồi Enter | 1. Lưới rỗng, hiện "Không tìm thấy đơn hàng" | Medium | Minor |';

/** Ghi 1 file .md rồi trả về [đường dẫn vào, đường dẫn ra]. */
function fixture(body: string): [string, string] {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'casetype-'));
  const md = path.join(dir, 'tc.md');
  fs.writeFileSync(md, `# TC\n\n${body}`, 'utf8');
  return [md, path.join(dir, 'out.xlsx')];
}

test.describe('gate Loại case', () => {
  test('THIẾU cột `Loại case` → CHẶN convert', () => {
    const [md, out] = fixture(`${H9}| T1 | ${TAIL}\n| T2 | ${NEG}\n`);
    const r = run([CONVERT, md, out]);
    expect(r.code, 'thiếu cột mà vẫn convert được = gate không tồn tại').toBe(1);
    expect(r.out).toContain('[gate loại-case]');
    expect(fs.existsSync(out), 'đã chặn thì KHÔNG được đẻ file ra').toBe(false);
  });

  test('giá trị ngoài 9 loại → CHẶN ở design gate (validate.js), không phải ở converter', () => {
    const [md, out] = fixture(`${H10}| T1 | Regression | ${TAIL}\n| T2 | API | ${NEG}\n`);
    const r = run([CONVERT, md, out]);
    expect(r.code).toBe(1);
    expect(r.out).toContain('không thuộc 9 loại đã chốt');
  });

  for (const v of CASE_TYPES.types.map((t: any) => t.name)) {
    test(`\`${v}\` là giá trị hợp lệ → convert ĐI QUA`, () => {
      const [md, out] = fixture(`${H10}| T1 | ${v} | ${TAIL}\n| T2 | ${v} | ${NEG}\n`);
      const r = run([CONVERT, md, out]);
      expect(r.code, `gate chặn oan "${v}" — đây là 1 trong 9 loại khai ở case_types.json`).toBe(0);
      expect(fs.existsSync(out)).toBe(true);
    });
  }

  test('cột `Loại case` đi được tới file xlsx — gate vô nghĩa nếu convert nuốt cột', async () => {
    const [md, out] = fixture(`${H10}| T1 | Integration | ${TAIL}\n| T2 | API | ${NEG}\n`);
    expect(run([CONVERT, md, out]).code).toBe(0);

    // eslint-disable-next-line global-require
    const canonical = require(path.join(REPO, 'scripts', 'lib', 'testcase'));
    const doc = await canonical.parseXlsx(out);
    expect(doc.tests.map((t: any) => t.caseType)).toEqual(['Integration', 'API']);
  });

  test('`Critical` là mức ưu tiên hợp lệ — thang AIO đứng đầu bằng Critical, không phải Highest', () => {
    const [md, out] = fixture(`${H10}| T1 | Functional | ${TAIL}\n| T2 | API | ${NEG}\n`);
    const r = run([CONVERT, md, out]);
    expect(r.code, 'Critical bị chặn = thang ưu tiên vẫn kẹt ở chuẩn Jira cũ').toBe(0);
  });

  test('lối thoát --lenient vẫn convert được (cho bộ cũ), nhưng phải KÊU', () => {
    const [md, out] = fixture(`${H9}| T1 | ${TAIL}\n| T2 | ${NEG}\n`);
    const r = run([CONVERT, md, out, '--lenient']);
    expect(r.code).toBe(0);
    expect(r.out, 'bỏ qua gate mà im lặng = lối thoát biến thành lối mòn').toContain('[gate loại-case]');
  });
  /*
   * TAG ↔ LOẠI: CẢNH BÁO, KHÔNG CHẶN — và đây là lựa chọn có lý do, không phải nương tay.
   * Chính bảng 9 loại liệt kê các ca chồng lấn HỢP LỆ ở mục "KHÔNG chọn khi": `[Display]` mà lỗi do BE
   * tính sai thì đúng loại là `Functional` chứ không phải `UI`. Chặn ở đây là phạt đúng những case được
   * phân loại tinh nhất, và dạy người ta né gate bằng cách gán tag cho khớp thay vì suy nghĩ.
   */
  test('tag gợi một loại mà cột khai loại khác → CẢNH BÁO, vẫn convert được', () => {
    const sec = 'M | [Negative][Security] Người dùng role Sale mở đơn của người khác | [ui] Đã đăng nhập OPS bằng tài khoản Sale | orderId của phòng ban khác | 1. Mở thẳng URL chi tiết đơn đó | 1. Bị chặn, hiện "Không có quyền truy cập" và dữ liệu đơn không đổi | High | Major |';
    const [md, out] = fixture(`${H10}| T1 | Functional | ${sec}
| T2 | API | ${NEG}
`);
    const r = run([CONVERT, md, out]);
    expect(r.code, 'chồng lấn tag/loại là ca hợp lệ — chặn là phạt oan').toBe(0);
    expect(r.out, 'lệch mà im lặng thì cột này lại thành trường điền bừa').toContain('tag chiều gợi `Security`');
  });

  test('mang NHIỀU tag ánh xạ được thì im lặng — bản thân tag đã không quyết được loại', () => {
    const multi = 'M | [Positive][Display][Calc] Tổng tiền hiển thị đúng công thức | [ui] Đã đăng nhập OPS, ở màn Chi tiết đơn | Đơn 2 dòng: 1.000.000 + 500.000 | 1. Mở màn Chi tiết đơn | 1. Ô "Tổng tiền" hiện 1.500.000đ | High | Major |';
    // T2 khai `Functional` cho khớp tag `[Validation]`: nếu để lệch, cảnh báo của T2 sẽ làm test này
    // tưởng T1 kêu — đúng lượt chạy đầu đã dính, fixture phải cô lập đúng dòng đang kiểm.
    const [md, out] = fixture(`${H10}| T1 | API | ${multi}
| T2 | Functional | ${NEG}
`);
    const r = run([CONVERT, md, out]);
    expect(r.code).toBe(0);
    expect(r.out, 'hai tag trỏ hai loại khác nhau — đoán tiếp là đoán bừa').not.toContain('tag chiều gợi');
  });
});
