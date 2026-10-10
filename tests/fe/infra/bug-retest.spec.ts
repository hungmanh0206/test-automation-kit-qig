import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * @infra — VÒNG ĐỜI RETEST CỦA BUG (v2.5.0 G1.8), nhận của A (`qig-qa-automation`).
 *
 * KIT TRƯỚC ĐỢT NÀY KHÔNG CÓ KHÁI NIỆM NÀY. `verdict_taxonomy.json` có 10 trạng thái, tất cả là verdict
 * của một CASE trong một lượt chạy; không có gì diễn tả "bug này đã fix chưa trên build mới". Nên câu trả
 * lời đó sống trong hội thoại, không có trạng thái nào máy đọc được, và `CANNOT_VERIFY` — không dựng lại
 * được tình huống — rất dễ bị nói thành "đã fix".
 *
 * LUẬT GỐC CỦA A, phần đáng giá nhất: **lịch sử retest là phần DUY NHẤT được thêm vào một bug sau khi đã
 * log.** Mọi mục khác là bằng chứng TẠI THỜI ĐIỂM PHÁT HIỆN; sửa `expected`/`actual`/tầng cho khớp build
 * mới là xoá dấu vết của chính thứ đã được báo. Gác bằng băm khối bằng chứng (`_chot`).
 *
 * HAI MỨC, và ranh giới dựa trên SỐ ĐO (10/10/2026):
 *  · 0 trong 107 claim đang có mang `retest` ⇒ đòi `build` cho MỌI lượt retest là chặn cứng mà không làm
 *    đỏ một claim cũ nào.
 *  · 0 trong 107 claim có trường `build` ⇒ đòi `build` cho mọi claim sẽ làm đỏ 105 claim đang sống, nên
 *    mức đó ở `warn` kèm cờ `requireBuild`, và khi còn `warn` thì gate PHẢI nói là chưa được gác.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const BC = path.join(REPO, 'scripts/qa/bug_claim.js');
const BC_CFG = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/bug_claim.json'), 'utf8'));
const NHOM_PHAN_CHUNG: string[] = Object.keys(BC_CFG.falsification.requiredCategories);

/** Claim tối thiểu ĐỦ qua mọi phép kiểm cũ, để test này chỉ đo phần retest. */
function claimDat(extra: Record<string, unknown> = {}) {
  return {
    id: 'CLAIM-TC_1',
    tc_id: 'TC_1',
    summary: 'Ô Email nhận giá trị không có @ mà vẫn lưu',
    status: 'confirmed',
    build: '2026.10.1',
    oracle: { type: 'BR', ref: 'BR-HS-012', quote: 'Email phải đúng định dạng có ký tự @ và tên miền' },
    expected: 'Chặn lưu và hiện thông báo định dạng email',
    actual: 'Lưu thành công, không thông báo gì',
    reruns: [{ at: '2026-10-09T01:00:00Z', result: 'fail' }, { at: '2026-10-09T01:10:00Z', result: 'fail' }],
    layer: 'be',
    layer_probe: 'Response POST /api/hoc-sinh trả 200 với email "abc" — server không validate',
    instrument: { control_type: 'input', read_method: 'đọc value' },
    fixture_path: 'ui',
    /*
     * Nhóm phản chứng lấy TỪ CHÍNH CONFIG, không viết tay: bản đầu của fixture này liệt kê 3 nhóm tôi
     * nhớ được và thiếu 3 nhóm thật (`doc_outdated`, `instrument`, `fixture`) ⇒ 6 test đỏ vì fixture sai,
     * không vì luật sai. Danh sách nhóm là thứ sẽ còn đổi, nên test phải đọc nó thay vì chép nó.
     */
    falsified: NHOM_PHAN_CHUNG.map((category) => ({
      category,
      hypothesis: `Có thể nguyên nhân thật thuộc nhóm ${category} chứ không phải lỗi sản phẩm`,
      measurement: 'đọc lại GET /api/hoc-sinh/123 sau 2 lượt, response trả email "abc" — ảnh outputs/x/evidence/01.png',
      result: 'đã loại, lỗi vẫn còn',
    })),
    retest: [],
    ...extra,
  };
}

/** Cây tạm: claim nằm đúng chỗ `bug_claim` tìm, và có config của repo thật. */
function cayTam(claims: Record<string, unknown>[]): { d: string; env: NodeJS.ProcessEnv } {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'retest-'));
  const claimDir = path.join(d, 'tasks/TASK-1/reports/bug-claims');
  fs.mkdirSync(claimDir, { recursive: true });
  claims.forEach((c, i) => fs.writeFileSync(path.join(claimDir, `c${i}.json`), JSON.stringify(c, null, 2), 'utf8'));
  return { d, env: { ...gateEnv(), PROJECT_OUTPUT_DIR: d, TASK_KEY: 'TASK-1' } };
}

function chay(claims: Record<string, unknown>[], argv = ['--check']) {
  const { d, env } = cayTam(claims);
  const r = spawnSync(process.execPath, [BC, ...argv], { cwd: REPO, encoding: 'utf8', env });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}`, d };
}

/** Băm khối bằng chứng — gọi chính hàm của script để test không tự dựng lại công thức. */
function bam(c: Record<string, unknown>): string {
  const r = spawnSync(process.execPath, ['-e',
    `const m=require(${JSON.stringify(BC.replace(/\\/g, '/'))});process.stdout.write(m.bamBangChung(JSON.parse(process.argv[1])))`,
    JSON.stringify(c)], { encoding: 'utf8', env: gateEnv() });
  return String(r.stdout || '').trim();
}

test.describe('@infra retest — 4 trạng thái, một nguồn', () => {
  test('`verdict_taxonomy.json` là nguồn DUY NHẤT của 4 trạng thái', () => {
    const vt = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/verdict_taxonomy.json'), 'utf8'));
    expect(Object.keys(vt.retest.states).sort()).toEqual(['CANNOT_VERIFY', 'FIXED', 'NOT_FIXED', 'PARTIAL']);
    /* Chỉ FIXED được đóng bug — ba trạng thái còn lại không, kể cả PARTIAL. */
    expect(Object.entries(vt.retest.states).filter(([, v]) => (v as { coTheDong: boolean }).coTheDong).map(([k]) => k))
      .toEqual(['FIXED']);

    /* Chặn đường lùi: `bug_claim.json` KHÔNG được khai lại bảng trạng thái này. */
    const bcCfg = fs.readFileSync(path.join(REPO, '.agent/config/bug_claim.json'), 'utf8');
    for (const s of ['CANNOT_VERIFY', 'NOT_FIXED', 'PARTIAL']) {
      expect(bcCfg, `${s} chỉ được khai ở verdict_taxonomy — hai bảng cùng nghĩa là nguồn trôi`).not.toContain(s);
    }
  });

  test('claim ĐẠT thì vẫn ĐẠT — thêm luật mới không làm đỏ claim hợp lệ', () => {
    const r = chay([claimDat()]);
    expect(r.code, r.out).toBe(0);
    fs.rmSync(r.d, { recursive: true, force: true });
  });
});

test.describe('@infra retest — từng luật và ÂM BẢN', () => {
  test('trạng thái lạ bị CHẶN, và gate nói ra 4 trạng thái hợp lệ', () => {
    const r = chay([claimDat({
      _chot: { hash: '' },
      retest: [{ at: '2026-10-10T00:00:00Z', build: '2026.10.2', result: 'DA_FIX', evidence: 'a/b.png' }],
    })]);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('CANNOT_VERIFY');
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('lượt retest thiếu `build` ⇒ CHẶN (không qua cờ hai tầng)', () => {
    const c = claimDat({ retest: [{ at: '2026-10-10T00:00:00Z', result: 'FIXED', evidence: 'a/b.png' }] });
    const r = chay([{ ...c, _chot: { hash: bam(c) } }]);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/retest\[0\].*thiếu `build`/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('evidence của retest phải là ẢNH/VIDEO — `.json`/`.md` bị CHẶN (non-negotiable §4)', () => {
    for (const ev of ['reports/retest.json', 'reports/retest.md', 'logs/run.log', 'trace.zip']) {
      const c = claimDat({ retest: [{ at: '2026-10-10T00:00:00Z', build: '2026.10.2', result: 'FIXED', evidence: ev }] });
      const r = chay([{ ...c, _chot: { hash: bam(c) } }]);
      expect(r.code, `${ev} KHÔNG được nhận làm evidence:\n${r.out}`).toBe(1);
      fs.rmSync(r.d, { recursive: true, force: true });
    }
    /* Và ảnh thì ĐƯỢC — nếu không thì luật này chỉ chặn chứ không cho đường nào đi. */
    const okc = claimDat({ retest: [{ at: '2026-10-10T00:00:00Z', build: '2026.10.2', result: 'FIXED', evidence: 'evidence/retest-01.png' }] });
    const ok = chay([{ ...okc, _chot: { hash: bam(okc) } }]);
    expect(ok.code, ok.out).toBe(0);
    fs.rmSync(ok.d, { recursive: true, force: true });
  });

  test('`PARTIAL` phải nói RÕ phần nào còn sai', () => {
    const c = claimDat({ retest: [{ at: '2026-10-10T00:00:00Z', build: '2026.10.2', result: 'PARTIAL', evidence: 'e/01.png' }] });
    const r = chay([{ ...c, _chot: { hash: bam(c) } }]);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/con_sai/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('`CANNOT_VERIFY` KHÔNG đóng được bug — "không phán được" không thành đã-sửa', () => {
    for (const st of ['CANNOT_VERIFY', 'NOT_FIXED']) {
      const c = claimDat({ dong: true, retest: [{ at: '2026-10-10T00:00:00Z', build: '2026.10.2', result: st, evidence: 'e/01.png' }] });
      const r = chay([{ ...c, _chot: { hash: bam(c) } }]);
      expect(r.code, `${st} không được đóng bug:\n${r.out}`).toBe(1);
      expect(r.out).toMatch(/coTheDong|đóng bug/);
      fs.rmSync(r.d, { recursive: true, force: true });
    }
    /* ÂM BẢN: `FIXED` thì đóng được. Không có vế này thì luật trên có thể đang chặn tất cả. */
    const c2 = claimDat({ dong: true, retest: [{ at: '2026-10-10T00:00:00Z', build: '2026.10.2', result: 'FIXED', evidence: 'e/01.png' }] });
    const ok = chay([{ ...c2, _chot: { hash: bam(c2) } }]);
    expect(ok.code, ok.out).toBe(0);
    fs.rmSync(ok.d, { recursive: true, force: true });
  });
});

test.describe('@infra retest — khối bằng chứng KHÔNG được sửa sau khi có retest', () => {
  const RT = [{ at: '2026-10-10T00:00:00Z', build: '2026.10.2', result: 'NOT_FIXED', evidence: 'e/01.png' }];

  test('có retest mà chưa chốt ⇒ CHẶN, và chỉ đúng lệnh để chốt', () => {
    const r = chay([claimDat({ retest: RT })]);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/bug:claim:chot/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('ĐÃ chốt rồi SỬA `expected` ⇒ CHẶN, kèm cả hai mã băm', () => {
    const goc = claimDat({ retest: RT });
    const h = bam(goc);
    const r = chay([{ ...goc, _chot: { hash: h }, expected: 'ĐỔI: giờ tôi nói kỳ vọng khác cho khớp build mới' }]);
    expect(r.code, r.out).toBe(1);
    expect(r.out, 'phải dẫn băm đã chốt và băm hiện tại, không báo chung chung').toContain(h);
    expect(r.out).toMatch(/DUY NHẤT được thêm/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('ÂM BẢN: sửa `summary` hoặc thêm lượt retest thì KHÔNG bị chặn', () => {
    /*
     * Băm cố ý KHÔNG gồm `summary`/`status`/`retest`: tiêu đề còn sửa chính tả được, trạng thái phải đổi
     * được, và retest chính là phần được phép thêm. Băm cả chúng thì luật thành "không được chạm gì", và
     * người ta sẽ xoá `_chot` để làm việc.
     */
    const goc = claimDat({ retest: RT });
    const h = bam(goc);
    const r1 = chay([{ ...goc, _chot: { hash: h }, summary: 'Sửa chính tả tiêu đề bug' }]);
    expect(r1.code, `sửa summary KHÔNG được chặn:\n${r1.out}`).toBe(0);
    fs.rmSync(r1.d, { recursive: true, force: true });

    const r2 = chay([{
      ...goc,
      _chot: { hash: h },
      retest: [...RT, { at: '2026-10-11T00:00:00Z', build: '2026.10.3', result: 'FIXED', evidence: 'e/02.png' }],
    }]);
    expect(r2.code, `thêm lượt retest KHÔNG được chặn:\n${r2.out}`).toBe(0);
    fs.rmSync(r2.d, { recursive: true, force: true });
  });

  test('`--chot` ghi băm một lần, và TỪ CHỐI chốt lại khi bằng chứng đã đổi', () => {
    const { d, env } = cayTam([claimDat({ retest: RT })]);
    const f = path.join(d, 'tasks/TASK-1/reports/bug-claims/c0.json');

    const r1 = spawnSync(process.execPath, [BC, '--chot'], { cwd: REPO, encoding: 'utf8', env });
    expect(r1.status, `${r1.stdout}${r1.stderr}`).toBe(0);
    const sau = JSON.parse(fs.readFileSync(f, 'utf8'));
    expect(sau._chot.hash, 'phải ghi băm vào file').toHaveLength(16);
    expect(spawnSync(process.execPath, [BC, '--check'], { cwd: REPO, encoding: 'utf8', env }).status,
      'chốt xong thì --check phải ĐẠT').toBe(0);

    /* Chốt lại sau khi đã đổi bằng chứng = ghi đè dấu vết lần phát hiện ⇒ TỪ CHỐI. */
    sau.actual = 'ĐỔI: mô tả khác hẳn';
    fs.writeFileSync(f, JSON.stringify(sau, null, 2), 'utf8');
    const r2 = spawnSync(process.execPath, [BC, '--chot'], { cwd: REPO, encoding: 'utf8', env });
    expect(r2.status, `${r2.stdout}${r2.stderr}`).toBe(1);
    expect(`${r2.stdout}${r2.stderr}`).toMatch(/ĐÃ chốt|bug MỚI/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('`--chot` là lệnh RIÊNG — `--check` không được tự sửa file nó đang kiểm', () => {
    const { d, env } = cayTam([claimDat({ retest: RT })]);
    const f = path.join(d, 'tasks/TASK-1/reports/bug-claims/c0.json');
    const truoc = fs.readFileSync(f, 'utf8');
    spawnSync(process.execPath, [BC, '--check'], { cwd: REPO, encoding: 'utf8', env });
    expect(fs.readFileSync(f, 'utf8'), 'bộ kiểm tự sửa file thì lần sau không ai tin nó đã kiểm cái gì').toBe(truoc);
    fs.rmSync(d, { recursive: true, force: true });
  });
});

test.describe('@infra retest — hai tầng của `build`, và kit không có đường đóng bug', () => {
  test('claim không có retest mà thiếu `build` ⇒ CẢNH BÁO "CHƯA ĐƯỢC GÁC", gộp MỘT dòng', () => {
    const { build, ...khongBuild } = claimDat() as Record<string, unknown> & { build?: string };
    void build;
    const r = chay([khongBuild, { ...khongBuild, id: 'CLAIM-TC_2', tc_id: 'TC_2' }]);
    expect(r.code, 'mức `warn` thì KHÔNG chặn').toBe(0);
    expect(r.out).toMatch(/CHƯA ĐƯỢC GÁC/);
    /*
     * Gộp một dòng: bản đầu in mỗi file một dòng và trên một task thật nó ra 23 dòng y hệt nhau. Một cảnh
     * báo lặp 23 lần thì người đọc cuộn qua — tức nó không còn là cảnh báo.
     */
    expect(r.out.split('\n').filter((d) => /CHƯA ĐƯỢC GÁC/.test(d)).length, 'phải gộp, không in mỗi file một dòng').toBe(1);
    expect(r.out).toMatch(/2 claim thiếu `build`/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('cờ `requireBuild` có đường SIẾT, và lý do hai tầng là một SỐ ĐO', () => {
    const raw = fs.readFileSync(path.join(REPO, '.agent/config/bug_claim.json'), 'utf8');
    expect(raw).toMatch(/"requireBuild":\s*"(warn|block)"/);
    expect(raw, 'phải ghi số đo làm căn cứ chọn mức, không chọn theo cảm tính').toMatch(/0 trong 107/);
    expect(raw, 'và phải nói điều kiện để siết').toMatch(/block/);
  });

  test('KIT KHÔNG có đường nào ĐỔI trạng thái issue Backlog', () => {
    /*
     * Luật của A là "`CANNOT_VERIFY` không bao giờ chuyển Backlog sang Done". Đo thật: kit chỉ ĐỌC trạng
     * thái (lọc `statusId: [1, 2]` để chống trùng khi log bug) và KHÔNG có lời gọi nào ghi `statusId`.
     * Nên luật đó hiện được bảo đảm bằng CẤU TRÚC, không phải bằng một phép kiểm runtime — và test này
     * khoá cấu trúc đó lại: ai thêm đường đóng issue sẽ làm test này đỏ và phải tự viết phép kiểm kèm theo.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/integrations/backlog/bug_reporter.js'), 'utf8');
    const ghiStatus = /(?:PATCH|PUT|POST)[^\n]{0,120}statusId\s*:/i.test(src)
      || /statusId\s*:\s*(?!\[)/.test(src.replace(/statusId: \[1, 2\]/g, ''));
    expect(ghiStatus, 'kit vừa có đường đổi status Backlog ⇒ phải viết phép kiểm "CANNOT_VERIFY không đóng bug" ở ĐÓ').toBe(false);
  });
});
