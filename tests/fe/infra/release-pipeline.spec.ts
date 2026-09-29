import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { gateEnv } from './_gate_env';

/*
 * Máy kiểm cho luồng phát hành kit (version · package · verify · release) và cho parity hai nền CI.
 *
 * VÌ SAO CẦN, nói bằng số: `release:verify` lần chạy đầu tiên **fail 2/13 bước** — `gate:policy` (hai npm
 * script mới chưa ai nhắc tới) và `preflight` (kỳ vọng viết sai). Nghĩa là luồng phát hành cũng cần được
 * canh như mọi thứ khác trong kit; nó không tự đúng chỉ vì mới viết.
 *
 * Các test ở đây chạy OFFLINE: không đóng gói thật (chậm), chỉ kiểm những bất biến mà một luồng phát hành
 * hỏng sẽ phá vỡ trước tiên.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const read = (p: string) => fs.readFileSync(path.join(REPO, p), 'utf8');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PKG = require(path.join(REPO, 'package.json'));

test.describe('@infra phát hành kit — version', () => {
  test('package.json có version hợp semver', () => {
    expect(PKG.version, 'không có version thì không phát hành được, và dự án không biết mình đang ở bản nào').toBeTruthy();
    expect(String(PKG.version)).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?$/);
  });

  test('CHANGELOG có mục cho version hiện tại', () => {
    const cl = read('CHANGELOG.md');
    const v = String(PKG.version).replace(/\./g, '\\.');
    expect(new RegExp(`^##\\s.*v${v}(\\s|$|\\D)`, 'm').test(cl),
      `CHANGELOG thiếu mục v${PKG.version} — phát hành mà không ghi thay đổi thì dự án nhận bản mới không biết đã đổi gì`).toBe(true);
  });

  test('3 npm script của luồng phát hành đều có', () => {
    for (const s of ['version:check', 'package:kit', 'release:verify']) {
      expect(PKG.scripts[s], `thiếu npm script "${s}"`).toBeTruthy();
    }
  });
});

test.describe('@infra phát hành kit — gói chỉ mang lớp GENERIC', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const kit = require(path.join(REPO, 'scripts/qa/package_kit.js'));

  test('danh sách gói KHÔNG chứa đường dẫn lớp PROJECT', () => {
    /*
     * Đây là luật đắt nhất của file này. Lỗi đã thật: bản đề bài xếp `db.conventions.json` vào GENERIC, mà
     * file đó chứa schema + bản đồ cột↔nhãn ĐO TỪ DB của MỘT dự án. Phát cho dự án khác là đưa họ một oracle
     * SAI mà vẫn "có số từ DB" — kiểu bug ma thuyết phục nhất.
     */
    const files: string[] = kit.collect();
    expect(files.length, 'không thu được file nào').toBeGreaterThan(100);

    const forbidden = [
      '.agent/config/db.conventions.json',
      '.agent/config/project_context.md',
      '.env',
    ];
    for (const f of forbidden) {
      expect(files, `"${f}" là lớp PROJECT, KHÔNG được đóng gói`).not.toContain(f);
    }
    const badPrefix = files.filter((f) => /^(outputs|reports|test-results|dist|knowledge\/(?!SCHEMA\.md)|profiles\/(?!task\.env\.example))/.test(f)
      && !f.endsWith('.gitkeep'));
    expect(badPrefix, `đường dẫn lớp PROJECT lọt vào gói: ${badPrefix.join(', ')}`).toEqual([]);
    // Không được mang spec cần DB/màn của dự án — chúng KHÔNG THỂ pass ở dự án khác.
    const projectSpecs = files.filter((f) => /^tests\/support\/setup\/db\/.*\.spec\.ts$/.test(f) || /^tests\/fe\/infra\/db-verify-.*\.spec\.ts$/.test(f));
    expect(projectSpecs, `spec chạy trên DB của dự án này lọt vào gói: ${projectSpecs.join(', ')}`).toEqual([]);
  });

  test('gói mang ĐỦ bản .example để dự án tự khai config', () => {
    const files: string[] = kit.collect();
    for (const f of ['.env.example', 'profiles/task.env.example',
      '.agent/config/project_context.example.md', '.agent/config/db.conventions.example.json']) {
      expect(files, `thiếu bản mẫu "${f}" — người nhận sẽ không biết phải tạo file gì`).toContain(f);
    }
  });

  test('gói mang đủ file GENERIC bắt buộc để chạy được', () => {
    const files: string[] = kit.collect();
    for (const f of ['package.json', 'package-lock.json', 'playwright.config.js', 'tsconfig.json',
      'eslint.config.js', 'CLAUDE.md', 'RULE_GLOBAL.md', 'CHANGELOG.md',
      '.agent/config/kit-layers.md', '.agent/config/verdict_taxonomy.json', 'knowledge/SCHEMA.md']) {
      expect(files, `thiếu "${f}"`).toContain(f);
    }
  });

  test('luật quét gói: CHẶN ở file dữ liệu, CẢNH BÁO ở code (không chặn oan)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pkgscan-'));
    fs.writeFileSync(path.join(tmp, 'a.json'), '{"entity":"ic_payment_orders"}');
    fs.writeFileSync(path.join(tmp, 'b.ts'), '// ví dụ: ic_payment_orders lưu tiền dạng bigint');
    fs.writeFileSync(path.join(tmp, 'c.md'), 'tài liệu kể lại db-uat.example.vn');
    const r = kit.scanPackage(tmp, ['a.json', 'b.ts', 'c.md']);
    fs.rmSync(tmp, { recursive: true, force: true });
    expect(r.hits.join(' '), 'file DỮ LIỆU mang tên bảng của dự án phải CHẶN').toMatch(/a\.json/);
    expect(r.hits.join(' '), 'code chỉ NHẮC trong comment thì không được chặn').not.toMatch(/b\.ts/);
    expect(r.warns.join(' '), 'code nhắc tên bảng phải được cảnh báo').toMatch(/b\.ts/);
    expect([...r.hits, ...r.warns].join(' '), 'tài liệu .md kể ví dụ là giá trị của tài liệu, không phải rò rỉ').not.toMatch(/c\.md/);
  });

  /*
   * `.md` ở `prompt_templates/` và `.agent/` KHÁC mọi `.md` khác: agent THI HÀNH chúng, nên tên bảng của
   * dự án A trong đó là oracle sai đặt vào tay dự án B. Gói `kit-2.1.1` đã phát ra ngoài kèm đúng lỗi này.
   */
  test('.md lớp GENERIC (prompt/workflow) mang tên bảng dự án thì CHẶN, .md khác thì không', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pkgscan2-'));
    const sub = path.join(tmp, 'prompt_templates', 'phase1');
    fs.mkdirSync(sub, { recursive: true });
    fs.writeFileSync(path.join(sub, 'd.md'), 'DB này: `ic_payment_orders` không có cột audit.');
    fs.writeFileSync(path.join(tmp, 'e.md'), 'README kể lại `ic_payment_orders` như một ví dụ.');
    const r = kit.scanPackage(tmp, ['prompt_templates/phase1/d.md', 'e.md']);
    fs.rmSync(tmp, { recursive: true, force: true });
    expect(r.hits.join(' '), 'prompt template mang tên bảng dự án phải CHẶN').toMatch(/d\.md/);
    expect([...r.hits, ...r.warns].join(' '), '.md ngoài hai thư mục đó vẫn được kể ví dụ').not.toMatch(/e\.md/);
  });
});

test.describe('@infra phát hành kit — workflow release', () => {
  const wf = () => read('.github/workflows/release.yml');

  test('trigger đúng: tag v* + workflow_dispatch với dry_run mặc định true', () => {
    const b = wf();
    expect(b).toMatch(/tags: \['v\*'\]/);
    expect(b).toMatch(/workflow_dispatch:/);
    /*
     * `dry_run` mặc định TRUE là bất biến, không phải sở thích: đúng nếp `:apply` / `--qa-approved` của kit —
     * mặc định an toàn, muốn ghi thật thì phải nói ra.
     */
    expect(b).toMatch(/dry_run:[\s\S]*?default: true/);
  });

  test('release:verify là CỔNG trước khi tạo Release', () => {
    const b = wf();
    const iVerify = b.indexOf('release:verify');
    const iRelease = b.indexOf('action-gh-release');
    expect(iVerify, 'workflow không gọi release:verify').toBeGreaterThan(-1);
    expect(iRelease, 'workflow không tạo Release').toBeGreaterThan(-1);
    expect(iVerify, 'tạo Release TRƯỚC khi verify ⇒ phát hành bản chưa chứng minh chạy được').toBeLessThan(iRelease);
  });

  test('KHÔNG dùng secret của UAT/Sheet/Backlog — cần secret là đã thiết kế sai', () => {
    const b = wf();
    for (const s of ['OPS_', 'AIO_', 'BACKLOG_', 'TAI_LIEU_', 'LIB_MASTER_DB']) {
      expect(b, `release.yml nhắc secret "${s}" — luồng này chỉ đọc repo + đóng gói, không chạm UAT`).not.toContain(s);
    }
  });

  test('không tự bump version, không tự sửa CHANGELOG', () => {
    const b = wf();
    expect(b, 'workflow tự ghi CHANGELOG ⇒ mất dấu vết ai quyết định gì').not.toMatch(/>>\s*CHANGELOG\.md|npm version /);
  });
});

test.describe('@infra parity hai nền CI', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const parity = require(path.join(REPO, '.agent/config/ci_parity.json'));

  test('cơ chế khai `both` phải có mặt ở CẢ hai nền', () => {
    for (const [name, files] of Object.entries(parity.both as Record<string, string[]>)) {
      if (name.startsWith('_')) continue;
      for (const f of files) {
        expect(fs.existsSync(path.join(REPO, f)), `parity "${name}": thiếu ${f}`).toBe(true);
      }
    }
  });

  test('mỗi waiver phải có LÝ DO đủ dài và ĐƯỜNG QUAY LẠI', () => {
    /*
     * Waiver không có `revisit` thì nó là "quên" có giấy phép. Ngưỡng độ dài `why` cố ý thấp — mục đích là
     * chặn ô một dòng cho có, không phải bắt lỗi văn phong.
     */
    for (const [name, w] of Object.entries(parity.waivers as Record<string, Record<string, string>>)) {
      if (name.startsWith('_')) continue;
      expect(String(w.why || '').length, `waiver "${name}" thiếu lý do cụ thể`).toBeGreaterThan(80);
      expect(w.revisit, `waiver "${name}" thiếu \`revisit\` — không có đường quay lại thì waiver là vĩnh viễn`).toBeTruthy();
      expect(w.since, `waiver "${name}" thiếu \`since\``).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(['github', 'gitlab'], `waiver "${name}": platform lạ`).toContain(w.platform);
    }
  });

  test('waiver `release` còn hiệu lực thì GitLab KHÔNG được có stage release (khai mà vẫn nối = lệch ngược)', () => {
    if (!parity.waivers.release) return;
    expect(read('.gitlab-ci.yml'), 'đã nối release cho GitLab thì XOÁ waiver đi').not.toMatch(/^release:/m);
  });
});

test.describe('@infra phát hành kit — script chạy được từ ZIP (không .git)', () => {
  test('version_check.js không gọi git vô điều kiện', () => {
    const src = read('scripts/qa/version_check.js');
    expect(src, 'phải có nhánh xử lý khi KHÔNG có .git — người nhận kit chạy từ gói').toMatch(/hasGit|\.git/);
    expect(src, 'mọi lệnh git phải bọc try/catch').toMatch(/try \{[\s\S]*?execFileSync\('git'/);
  });

  test('3 script phát hành đều chạy được với --help/không tham số mà không crash', () => {
    const { spawnSync } = require('child_process');
    for (const s of ['version_check.js', 'package_kit.js', 'verify_release.js']) {
      const r = spawnSync(process.execPath, ['--check', path.join(REPO, 'scripts/qa', s)], { encoding: 'utf8', env: gateEnv() });
      expect(r.status, `${s} lỗi cú pháp`).toBe(0);
    }
  });

  /*
   * Bảng "Hai remote" trong `QUICKSTART.md` là thứ người cài dùng để tự biết đã lắp đúng chưa. Nó nói thẳng
   * "số của bạn khác bảng này là có gì đó sai", nên bảng sai là tự tạo báo động giả cho mọi người cài.
   *
   * Bảng đã lệch HAI LẦN trong cùng một phiên 19/09/2026, cả hai lần vì thêm một spec. Đó là bằng chứng
   * nó cần máy canh chứ không cần người cẩn thận hơn.
   *
   * CHỈ canh hai con số ĐO ĐƯỢC RẺ và tất định: số file track, và số spec `ci:scope` đếm. Số test xanh
   * thì phải chạy cả bộ mới biết, không đưa vào đây để khỏi biến test này thành thứ tự đỏ theo môi trường.
   * Phía GitLab suy ra bằng danh sách strip, không viết tay.
   */
  test('bảng số đo trong QUICKSTART khớp cây thật (file track · số spec, cả hai remote)', () => {
    /*
     * MỌI điều kiện bỏ qua phải đứng TRƯỚC lần đọc file đầu tiên.
     * Bản trước đọc `gitlab_strip.json` ở dòng đầu rồi mới `test.skip`, nên nó ĐỎ trong gói phát hành —
     * gói cố ý không mang file đó (nó khai đường dẫn riêng của repo này, thuộc lớp PROJECT).
     * Bài học lặp lại lần thứ hai trong cùng một phiên: spec hạ tầng mới phải chạy thử TRONG GÓI, không
     * chỉ trong repo.
     */
    const { spawnSync } = require('child_process');
    const stripPath = path.join(REPO, '.agent/config/gitlab_strip.json');
    test.skip(!fs.existsSync(stripPath), 'gói phát hành không mang gitlab_strip.json (lớp PROJECT) — không có mốc để so');
    const lsFiles = spawnSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    test.skip(lsFiles.status !== 0, 'không có .git (gói phát hành) — không đếm được cây track');

    const qs = fs.readFileSync(path.join(REPO, 'QUICKSTART.md'), 'utf8');
    const strip = JSON.parse(fs.readFileSync(stripPath, 'utf8')).strip as { path: string }[];
    const soFile = String(lsFiles.stdout).split(/\r?\n/).filter((x: string) => x.trim()).length;

    const sc = spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/ci_scope_check.js')], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    const mSpec = String(sc.stdout).match(/(\d+) spec được track/);
    expect(mSpec, 'không đọc được số spec từ ci:scope').not.toBeNull();
    const soSpec = Number(mSpec![1]);

    // Strip chỉ gồm file .spec.ts nên cả hai con số cùng giảm đúng bằng số mục strip.
    const nStrip = strip.length;
    const nSpecStrip = strip.filter((x) => x.path.endsWith('.spec.ts')).length;

    /* Đọc bảng bằng cách tách cột, không bằng một regex dài — regex dài là thứ tự nó hỏng im lặng. */
    const doc = (nhan: string): number[] => {
      const dong = qs.split(/\r?\n/).find((l) => l.startsWith('| ' + nhan));
      expect(dong, `QUICKSTART không còn dòng "${nhan}" — bảng đổi hình thì máy này mù`).toBeTruthy();
      const so = String(dong).split('|').slice(2)
        .map((c) => c.replace(/[^0-9]/g, ''))
        .filter(Boolean)
        .map(Number);
      expect(so.length, `dòng "${nhan}" phải có 2 con số (GitHub, GitLab)`).toBeGreaterThanOrEqual(2);
      return so;
    };

    /*
     * PHẢI biết đang đứng trên CÂY NÀO. Bản đầu của test này ngầm cho rằng luôn là cây GitHub, nên nó ĐỎ
     * ngay khi chạy trên bản clone từ GitLab — đúng nửa số người nhận kit. Một máy kiểm chỉ đúng ở một
     * remote thì tự nó là lỗi "kết quả phụ thuộc môi trường chạy".
     *
     * Dấu hiệu: cây GitLab KHÔNG track các đường dẫn khai trong `gitlab_strip.json`.
     */
    const dangTrack = new Set(String(lsFiles.stdout).split(/\r?\n/).map((x: string) => x.trim()));
    const laGitlab = strip.every((x) => !dangTrack.has(x.path));
    const fileGh = laGitlab ? soFile + nStrip : soFile;
    const specGh = laGitlab ? soSpec + nSpecStrip : soSpec;

    const [fGh, fGl] = doc('file được track');
    expect(fGh, `QUICKSTART khai sai số file track phía GitHub (đang đo trên cây ${laGitlab ? 'GitLab' : 'GitHub'})`).toBe(fileGh);
    expect(fGl, 'QUICKSTART khai sai số file track phía GitLab').toBe(fileGh - nStrip);

    const [sGh, sGl] = doc('`npm run ci:scope` đếm');
    expect(sGh, `QUICKSTART khai sai số spec phía GitHub (đang đo trên cây ${laGitlab ? 'GitLab' : 'GitHub'})`).toBe(specGh);
    expect(sGl, 'QUICKSTART khai sai số spec phía GitLab').toBe(specGh - nSpecStrip);
  });
});
