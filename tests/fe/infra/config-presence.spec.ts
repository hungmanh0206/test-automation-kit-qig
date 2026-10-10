import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * @infra — CONFIG CỦA MỘT GATE PHẢI CÓ MẶT, VÀ THIẾU THÌ PHẢI KÊU.
 *
 * LỖI THẬT đã tái hiện 10/10/2026, và nó sống qua hai bản phát hành:
 *
 *   `.agent/config/na_reasons_rejected.json` chưa bao giờ được `git add`. `package_kit.js` chỉ đóng gói
 *   file ĐÃ git track, nên bản phát hành không có nó. `dimension_coverage.js` đọc bằng
 *   `try { … } catch { return [] }`, nên thiếu file ⇒ danh sách rỗng ⇒ gate "lý do n/a trùng lập luận
 *   ĐÃ BỊ BÁC" KHÔNG BAO GIỜ chặn, và không một dòng nào báo. Trên máy dev thì xanh, vì file đang nằm
 *   untracked ngay cạnh.
 *
 * Đo tiếp trên chính bản đóng gói thì ra một tầng sâu hơn: `.agent/config/*` là DENY mặc định, ALLOW
 * theo danh sách, và danh sách đó thiếu 10 file mà `scripts/**` có đọc. Ba trong số đó nạp bằng
 * `require()` — nên gói KHÔNG NẠP NỔI `md_to_xlsx.js`, và `npx playwright test tests/fe/infra` trong gói
 * chết ngay lúc collect.
 *
 * HAI KIỂU HỎNG, và kiểu thứ hai TỆ HƠN:
 *   · `require()` thiếu file ⇒ NỔ. Có người sửa.
 *   · `try/catch` thiếu file ⇒ TẮT PHÉP KIỂM rồi đi tiếp. Bảng vẫn xanh, không ai biết.
 *
 * Spec này gác cả hai, và gác bằng cách đối chiếu BA nguồn độc lập với nhau: cây git · danh sách đóng
 * gói trong `package_kit.js` · chính `scripts/**`. Một nguồn nói khác hai nguồn còn lại thì đỏ.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const CFG_DIR = path.join(REPO, '.agent', 'config');
const DIM = path.join(REPO, 'scripts/qa/dimension_coverage.js');

/*
 * Lớp PROJECT nằm TRONG thư mục GENERIC, nên phải khai theo TÊN — không suy được theo thư mục cha.
 * Danh sách này CHÍNH LÀ bản khai: thêm một config lớp PROJECT thì thêm tên vào đây kèm lý do, còn
 * không khai thì spec coi là GENERIC và đòi nó có trong gói.
 */
const LOP_PROJECT: Record<string, string> = {
  'project_context.md': 'khai Sites + env key của dự án — bản generic là `project_context.example.md`',
  'db.conventions.json': 'bản đồ cột↔nhãn ĐO TỪ DB của dự án; dùng cho dự án khác là oracle SAI',
  'risk_model.json': 'trọng số impact theo module của dự án — `depthPolicy` (phần chung) có y nguyên ở bản `.example`',
  'impact-map.json': 'bản đồ ảnh hưởng theo cây source của dự án',
  'dashboard.branding.json': 'tên và màu thương hiệu của dự án',
  'locator-lint-baseline.json': 'mốc nợ locator đếm trên spec của dự án',
  'writing-lint-baseline.json': 'mốc nợ văn phong đếm trên tài liệu hiện có',
  'na_reasons_rejected.project.json': 'dẫn chứng bác bỏ theo mã task của dự án',
  'mcp_config.md': 'khai server MCP theo máy, không phải nội dung kit',
};

/*
 * ĐƯỜNG DẪN TRONG DANH SÁCH ĐÓNG GÓI, bóc từ chuỗi CÓ NHÁY — không so chuỗi con.
 *
 * Bản đầu của spec này dùng `pk.includes('.agent/config/x.json')`, và nó khớp CẢ COMMENT: chính ghi
 * chú trong `package_kit.js` có nhắc `design_techniques.json`, nên phép so luôn thấy "có" dù dòng khai
 * đã bị cắt. Âm bản ở cuối file đã bắt đúng lỗi này — đó là việc của một âm bản.
 */
const duongTrongGoi = (pk: string) => new Set(
  [...pk.matchAll(/'(\.agent\/config\/[^']+)'/g)].map((m) => m[1]),
);

const tracked = () => new Set(
  execFileSync('git', ['ls-files', '.agent/config'], { cwd: REPO, encoding: 'utf8' })
    .trim().split(/\r?\n/).filter(Boolean).map((x) => x.trim()),
);

/** Config mà `scripts/**` có nhắc tên — nguồn thứ ba, độc lập với hai nguồn kia. */
function configDuocDoc() {
  const files = execFileSync('git', ['ls-files', 'scripts'], { cwd: REPO, encoding: 'utf8' })
    .trim().split(/\r?\n/).filter((f) => f.endsWith('.js'));
  const src = files.map((f) => fs.readFileSync(path.join(REPO, f), 'utf8')).join('\n');
  return fs.readdirSync(CFG_DIR)
    .filter((f) => /\.(json|md)$/.test(f) && !f.startsWith('.') && !/\.example\./.test(f))
    .filter((f) => src.includes(f));
}

test.describe('@infra config của gate — phải có mặt, thiếu thì phải kêu', () => {
  test('mọi config GENERIC mà script có đọc đều được git track', () => {
    const tr = tracked();
    const thieu = configDuocDoc()
      .filter((f) => !(f in LOP_PROJECT))
      .filter((f) => !tr.has(`.agent/config/${f}`));
    expect(thieu, 'file không track thì KHÔNG vào được bản phát hành — và gate đọc nó sẽ tắt im lặng').toEqual([]);
  });

  test('mọi config GENERIC mà script có đọc đều nằm trong danh sách ĐÓNG GÓI', () => {
    /*
     * Track thôi KHÔNG đủ: `.agent/config/*` là DENY mặc định trong `package_kit.js`. Đây đúng là chỗ
     * 10 file đã rơi, trong đó 3 file `require()` làm gói không nạp nổi `md_to_xlsx.js`.
     */
    const goi = duongTrongGoi(fs.readFileSync(path.join(REPO, 'scripts/qa/package_kit.js'), 'utf8'));
    const thieu = configDuocDoc()
      .filter((f) => !(f in LOP_PROJECT))
      .filter((f) => !goi.has(`.agent/config/${f}`));
    expect(thieu, 'thiếu trong gói ⇒ người nhận kit chạy lần đầu là đỏ, hoặc tệ hơn là gate tắt im lặng').toEqual([]);
  });

  test('config lớp PROJECT phải có bản `.example` để gói vẫn chạy được', () => {
    const thieu = Object.keys(LOP_PROJECT)
      .filter((f) => fs.existsSync(path.join(CFG_DIR, f)))
      .filter((f) => {
        const i = f.lastIndexOf('.');
        return !fs.existsSync(path.join(CFG_DIR, `${f.slice(0, i)}.example${f.slice(i)}`));
      });
    /*
     * `mcp_config.md` và hai file baseline là trạng thái theo máy, không có bản mẫu nào có nghĩa — nên
     * chúng được miễn. Khai ra ở đây thay vì lặng lẽ bỏ qua.
     */
    const mien = [
      'mcp_config.md', 'locator-lint-baseline.json', 'writing-lint-baseline.json',
      /* Lập luận chung đã nằm ở bản GENERIC `na_reasons_rejected.json`, nên bản `.project` không cần
       * bản mẫu nữa: thiếu nó thì gate vẫn chặn đủ, chỉ là thông báo không dẫn được ca cụ thể. */
      'na_reasons_rejected.project.json',
    ];
    expect(thieu.filter((f) => !mien.includes(f))).toEqual([]);
  });

  test('THIẾU file: nói rõ phép kiểm nào CHƯA ĐƯỢC GÁC, không im lặng', () => {
    /*
     * Đo THẮNG vào `napConfigGate` với một đường dẫn không tồn tại.
     *
     * Bản đầu thử giả `REPO_ROOT` qua env để chạy cả `dimension_coverage.js` — KHÔNG được: root suy từ
     * `__dirname` chứ không đọc env, nên lượt đó vẫn thấy config thật và phép đo không đo gì cả. Đường đi
     * tích hợp đã có `dimension-threshold.spec.ts` giữ; ở đây giữ HỢP ĐỒNG của máy đọc config.
     */
    const js = `
      const c = require(${JSON.stringify(path.join(REPO, 'scripts/qa/lib/config_load.js'))});
      const v = c.napConfigGate({
        duong: ${JSON.stringify(path.join(REPO, '.agent', 'config', 'khong-he-co-file-nay.json'))},
        nhan: 'khong-he-co-file-nay.json',
        phepKiem: 'PHEP_KIEM_GIA_DE_DO',
        khiThieu: { rejected: [] },
      });
      console.log('TRA VE', JSON.stringify(v));
    `;
    const r = spawnSync(process.execPath, ['-e', js], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    const err = `${r.stderr || ''}`;
    expect(err, 'thiếu config mà không nói gì là đúng lỗi đã sửa').toContain('CHƯA ĐƯỢC GÁC');
    expect(err, 'phải nói RÕ phép kiểm nào mất hiệu lực').toContain('PHEP_KIEM_GIA_DE_DO');
    // Vẫn trả giá trị đã khai để máy gọi không sụp: KÊU khác với NỔ, và cũng khác với IM.
    expect(`${r.stdout || ''}`).toContain('TRA VE {"rejected":[]}');
    expect(r.status, 'thiếu file thì KÊU, không chặn — chặn là việc của JSON hỏng').toBe(0);
  });

  test('JSON HỎNG: CHẶN (exit 1) — không được coi như danh sách rỗng', () => {
    /* Dùng trực tiếp `config_load` để đo đúng hợp đồng, không phải đo đường đi vòng qua gate. */
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-hong-'));
    const f = path.join(d, 'x.json');
    fs.writeFileSync(f, '{ "rejected": [', 'utf8');
    const js = `
      const c = require(${JSON.stringify(path.join(REPO, 'scripts/qa/lib/config_load.js'))});
      c.napConfigGate({ duong: ${JSON.stringify(f)}, nhan: 'x.json', phepKiem: 'thu' });
      console.log('KHONG NEN TOI DAY');
    `;
    try {
      const r = spawnSync(process.execPath, ['-e', js], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
      expect(r.status, 'JSON hỏng phải CHẶN').toBe(1);
      expect(`${r.stdout || ''}`).not.toContain('KHONG NEN TOI DAY');
      expect(`${r.stderr || ''}`).toContain('HỎNG JSON');
    } finally {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });

  test('ÂM BẢN: bỏ một config GENERIC khỏi danh sách đóng gói thì spec phải bắt được', () => {
    /*
     * Chứng minh hai test đầu KHÔNG vô nghĩa. Không sửa file thật: dựng lại đúng phép so trên một bản
     * `package_kit.js` đã bị cắt một dòng.
     */
    const pk = fs.readFileSync(path.join(REPO, 'scripts/qa/package_kit.js'), 'utf8');
    const nan = pk.replace("  '.agent/config/design_techniques.json',\n", '');
    const goi = duongTrongGoi(nan);
    expect(nan, 'fixture phải khác bản thật, nếu không thì phép so này vô nghĩa').not.toBe(pk);
    const thieu = configDuocDoc()
      .filter((f) => !(f in LOP_PROJECT))
      .filter((f) => !goi.has(`.agent/config/${f}`));
    expect(thieu, 'cắt một dòng khỏi danh sách thì phép so phải phát hiện').toContain('design_techniques.json');
  });

  test('`.agent/config/*.project.json` KHÔNG được track và KHÔNG được vào gói', () => {
    const tr = tracked();
    const lotTrack = [...tr].filter((f) => f.endsWith('.project.json'));
    expect(lotTrack, 'lớp PROJECT mang mã task của dự án — track là phát cho dự án khác').toEqual([]);
    const gi = fs.readFileSync(path.join(REPO, '.gitignore'), 'utf8');
    expect(gi).toContain('.agent/config/*.project.json');
  });
});
