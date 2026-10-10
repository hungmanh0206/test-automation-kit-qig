import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * @infra — `release:summary` (v2.5.0 G1.1): khuyến nghị go/no-go có căn cứ, và KHÔNG tự quyết.
 *
 * Kit có `results:summary` (một lượt chạy) và `release:verify` (bản đóng gói chạy được). Thiếu thứ ở
 * giữa: gộp nhiều lượt của một mốc rồi đối chiếu với tiêu chí exit.
 *
 * LUẬT ĐÁNG GIÁ NHẤT CỦA A, và cũng là luật DỄ LÁCH NHẤT: tiêu chí exit chốt TRƯỚC khi xem kết quả. Chỉ
 * cần mở file tiêu chí ra hạ một ngưỡng là báo cáo "đạt". Nên máy gác đúng chỗ đó bằng `mtime`, và đó là
 * một trong hai thứ duy nhất `--enforce` chặn.
 *
 * `--enforce` CỐ Ý KHÔNG CHẶN VÌ NO-GO. Quyết định release là của PM/PO — họ cân thêm áp lực thị trường,
 * hợp đồng, chi phí trễ hạn mà QA không nắm. Một gate chặn pipeline vì QA khuyến nghị NO-GO là gate đang
 * giành quyền quyết định; test dưới đây khoá đúng tính chất đó.
 *
 * ĐO 10/10/2026, và đây là lý do có nhãn "KHÔNG ĐO ĐƯỢC": `testcase-status.json` không có `priority`,
 * không có `module`; `knowledge/bugs` có 0 file ⇒ **5 trong 7** tiêu chí của A hiện không đo được từ
 * artifact của kit. Ghi "Đạt" cho chúng là nói sai; bỏ chúng đi là che mất phần chưa đo.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const RS = path.join(REPO, 'scripts/qa/release_summary.js');

function cay(opts: { tests?: Record<string, unknown>[]; trace?: string } = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'relsum-'));
  fs.mkdirSync(path.join(d, 'tasks/T1/test-results'), { recursive: true });
  fs.mkdirSync(path.join(d, 'tasks/T1/reports'), { recursive: true });
  const tests = opts.tests || [
    ...Array.from({ length: 95 }, (_, i) => ({ tcId: `TC_${i + 1}`, status: 'PASS', runId: 'auto-1' })),
    ...Array.from({ length: 5 }, (_, i) => ({ tcId: `TC_${96 + i}`, status: 'FAIL', runId: 'auto-1' })),
  ];
  fs.writeFileSync(path.join(d, 'tasks/T1/test-results/testcase-status.json'),
    JSON.stringify({ taskKey: 'T1', tests }), 'utf8');
  if (opts.trace) fs.writeFileSync(path.join(d, 'tasks/T1/reports/traceability-matrix.md'), opts.trace, 'utf8');
  return d;
}

const env = (d: string) => ({ ...gateEnv(), PROJECT_OUTPUT_DIR: d, TASK_KEY: 'T1' });

function chay(d: string, argv: string[] = ['--enforce']) {
  const r = spawnSync(process.execPath, [RS, ...argv], { cwd: REPO, encoding: 'utf8', env: env(d) });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

/** Chốt tiêu chí TRƯỚC kết quả: lùi mtime của file tiêu chí về trước file status. */
function chotTruoc(d: string) {
  const p = path.join(d, 'tasks/T1/reports/exit_criteria.json');
  const s = path.join(d, 'tasks/T1/test-results/testcase-status.json');
  const t = fs.statSync(s).mtime.getTime() / 1000 - 3600;
  fs.utimesSync(p, t, t);
}

test.describe('@infra release:summary — tiêu chí chốt TRƯỚC kết quả', () => {
  test('thiếu `exit_criteria.json` ⇒ TỪ CHỐI, và "không có tiêu chí" KHÔNG thành "đạt mọi tiêu chí"', () => {
    const d = cay();
    const r = chay(d);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/TỪ CHỐI/);
    expect(r.out, 'phải chỉ đúng lệnh để dựng').toMatch(/--init/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('tiêu chí MỚI HƠN kết quả ⇒ TỪ CHỐI (chốt sau là hợp thức hoá kết quả)', () => {
    const d = cay();
    chay(d, ['--init']);
    const p = path.join(d, 'tasks/T1/reports/exit_criteria.json');
    const t = Date.now() / 1000 + 60;
    fs.utimesSync(p, t, t);
    const r = chay(d);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/MỚI HƠN/);
    expect(r.out, 'phải dẫn CẢ HAI mốc thời gian, không báo chung chung').toMatch(/tiêu chí:.*\n.*kết quả/s);
    expect(r.out, 'và chỉ đường đúng: ghi ngoại lệ, không hạ ngưỡng').toMatch(/ngoaiLe|đừng sửa ngưỡng/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('chốt TRƯỚC ⇒ chạy được', () => {
    const d = cay();
    chay(d, ['--init']);
    chotTruoc(d);
    const r = chay(d);
    expect(r.code, r.out).toBe(0);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('`--init` TỪ CHỐI ghi đè file đã có — không xoá tiêu chí người ta đã chốt', () => {
    const d = cay();
    expect(chay(d, ['--init']).code).toBe(0);
    const r = chay(d, ['--init']);
    expect(r.code, r.out).toBe(2);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('bộ mặc định phải TỰ KHAI là mặc định, cho tới khi có người xác nhận', () => {
    const d = cay();
    chay(d, ['--init']);
    chotTruoc(d);
    const r = chay(d);
    expect(r.out).toMatch(/MẶC ĐỊNH CỦA AGENT, chưa có người xác nhận/);

    const p = path.join(d, 'tasks/T1/reports/exit_criteria.json');
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    j.laMacDinh = false; j.nguoiXacNhan = 'PM A'; j.ngayXacNhan = '2026-10-10';
    fs.writeFileSync(p, JSON.stringify(j, null, 2), 'utf8');
    chotTruoc(d);
    expect(chay(d).out, 'đã xác nhận thì không còn cảnh báo mặc định').toMatch(/xác nhận bởi PM A/);
    fs.rmSync(d, { recursive: true, force: true });
  });
});

test.describe('@infra release:summary — "không đo được" KHÔNG thành "đạt"', () => {
  test('5 tiêu chí không có nguồn ⇒ ghi KHÔNG ĐO ĐƯỢC, và tính vào lý do NO-GO', () => {
    const d = cay();
    chay(d, ['--init']);
    chotTruoc(d);
    const r = chay(d);
    /*
     * Đếm trong BẢNG, không đếm cả output: dòng ĐỀ XUẤT cũng chứa chữ "KHÔNG ĐO ĐƯỢC", nên bản đầu của
     * phép đếm này ra 6 thay vì 5. Phép đếm trên văn bản tự do thì phải neo vào hình dạng DÒNG.
     */
    const dongBang = r.out.split('\n').filter((d) => /^\s+\d+\s+KHÔNG ĐO ĐƯỢC/.test(d));
    expect(dongBang.length, 'thiếu nguồn: bugs(2) · priority · req · module ⇒ 5 tiêu chí').toBe(5);
    expect(r.out, 'và dòng ĐỀ XUẤT phải cộng đúng số đó').toMatch(/5 tiêu chí KHÔNG ĐO ĐƯỢC/);
    expect(r.out, 'và phải nói thẳng nguyên tắc').toMatch(/"không đo được" KHÔNG thành đạt/);
    expect(r.out, 'không được ghi Đạt cho tiêu chí thiếu nguồn').not.toMatch(/Đạt\s+Bug Critical/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('tiêu chí ĐO ĐƯỢC thì chấm thật: 95/100 ⇒ pass rate Đạt, BLOCKED Đạt', () => {
    const d = cay();
    chay(d, ['--init']);
    chotTruoc(d);
    const r = chay(d);
    expect(r.out).toMatch(/Đạt\s+Pass rate toàn bộ TC đã chạy.*95\.0%/s);
    expect(r.out).toMatch(/Đạt\s+Tỉ lệ BLOCKED.*0\.0%/s);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('"gần đạt" là KHÔNG đạt — 89% so với ngưỡng 90%', () => {
    const d = cay({
      tests: [
        ...Array.from({ length: 89 }, (_, i) => ({ tcId: `TC_${i + 1}`, status: 'PASS' })),
        ...Array.from({ length: 11 }, (_, i) => ({ tcId: `TC_${90 + i}`, status: 'FAIL' })),
      ],
    });
    chay(d, ['--init']);
    chotTruoc(d);
    expect(chay(d).out).toMatch(/Không đạt\s+Pass rate toàn bộ TC đã chạy.*89\.0%/s);
    fs.rmSync(d, { recursive: true, force: true });
  });
});

test.describe('@infra release:summary — vùng chưa test, mẫu số, và hai nguồn lệch', () => {
  test('vùng CHƯA TEST in TRƯỚC mọi tỉ lệ', () => {
    const d = cay({ trace: '> TC: 103 · execute: 100\n\n| REQ | TC |\n|---|---|\n| R1 | TC_101 |\n| R1 | TC_102 |\n| R1 | TC_103 |\n' });
    chay(d, ['--init']);
    chotTruoc(d);
    const r = chay(d);
    const iChua = r.out.indexOf('Vùng CHƯA TEST');
    const iTiLe = r.out.indexOf('Đối chiếu tiêu chí exit');
    expect(iChua, 'phải có mục vùng chưa test').toBeGreaterThan(-1);
    expect(iChua, 'và nó phải đứng TRƯỚC bảng tỉ lệ').toBeLessThan(iTiLe);
    expect(r.out).toMatch(/3\/3 TC trong traceability KHÔNG có trong kết quả/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('BLOCKED/SKIP không tính là PASS và cũng không tính vào "đã chạy"', () => {
    const d = cay({
      tests: [
        ...Array.from({ length: 50 }, (_, i) => ({ tcId: `TC_${i + 1}`, status: 'PASS' })),
        ...Array.from({ length: 50 }, (_, i) => ({ tcId: `TC_${51 + i}`, status: 'BLOCKED' })),
      ],
    });
    chay(d, ['--init']);
    chotTruoc(d);
    const r = chay(d);
    /* 50 PASS / 50 đã chạy = 100%, KHÔNG phải 50/100 = 50%. Mẫu số phải được nói rõ. */
    expect(r.out).toMatch(/\(50\/50 đã chạy\)/);
    expect(r.out, 'phải nói mẫu số thật, để không ai đọc 100% thành "mọi case đều pass"').toMatch(/mẫu số thật là 50\/100/);
    expect(r.out).toMatch(/Không đạt\s+Tỉ lệ BLOCKED.*50\.0%/s);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('HAI NGUỒN SỐ lệch nhau ⇒ phải nói ra, không chọn một cái', () => {
    /*
     * Lệch này có thật trên repo: `CSDL-9003/reports/traceability-matrix.md` ghi "TC: 255 · execute: 0"
     * trong khi `testcase-status.json` có 245 case với 151 PASS. Không có phép kiểm này thì báo cáo sẽ
     * lấy một trong hai con số rồi trình bày như sự thật duy nhất.
     */
    const d = cay({ trace: '> TC: 2 · execute: 0\n\n| REQ | TC |\n|---|---|\n| R1 | TC_1 |\n| R1 | TC_2 |\n' });
    chay(d, ['--init']);
    chotTruoc(d);
    const r = chay(d);
    expect(r.out).toMatch(/LỆCH: traceability-matrix có 2 TC, testcase-status có 100/);
    expect(r.out).toMatch(/LỆCH: traceability-matrix ghi "execute: 0"/);
    expect(r.out).toMatch(/KHÔNG được chọn một cái rồi báo như sự thật duy nhất/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('manual và automation: KHÔNG tách được thì NÓI RÕ, không bịa', () => {
    const d = cay();
    chay(d, ['--init']);
    chotTruoc(d);
    const r0 = chay(d);
    expect(r0.out).toMatch(/KHÔNG tách được/);
    expect(r0.out, 'và chỉ đúng đường khai báo').toMatch(/manualRunIdPrefix/);

    const p = path.join(d, 'tasks/T1/reports/exit_criteria.json');
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    j.manualRunIdPrefix = ['auto-'];   // fixture dùng runId `auto-1` cho mọi case
    fs.writeFileSync(p, JSON.stringify(j, null, 2), 'utf8');
    chotTruoc(d);
    expect(chay(d).out, 'khai rồi thì tách được').toMatch(/manual 100 case · automation 0 case/);
    fs.rmSync(d, { recursive: true, force: true });
  });
});

test.describe('@infra release:summary — QA khuyến nghị, PM quyết', () => {
  test('NO-GO vẫn exit 0 — gate KHÔNG giành quyền quyết định release', () => {
    const d = cay({
      tests: Array.from({ length: 100 }, (_, i) => ({ tcId: `TC_${i + 1}`, status: 'FAIL' })),
    });
    chay(d, ['--init']);
    chotTruoc(d);
    const r = chay(d);
    expect(r.out).toMatch(/ĐỀ XUẤT: NO-GO/);
    expect(r.code, 'NO-GO là KHUYẾN NGHỊ — chặn pipeline vì nó là giành quyền của PM').toBe(0);
    expect(r.out).toMatch(/Quyết định release là của PM\/PO/);
    expect(r.out, 'exit code phải nói rõ nó không phụ thuộc go\\/no-go').toMatch(/KHÔNG quyết định exit code/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('đầu ra luôn là "ĐỀ XUẤT", không bao giờ là lệnh', () => {
    const d = cay();
    chay(d, ['--init']);
    chotTruoc(d);
    const r = chay(d);
    expect(r.out).toMatch(/ĐỀ XUẤT/);
    for (const cam of ['Cấm release', 'cấm release', 'không được release']) {
      expect(r.out, `không được viết "${cam}"`).not.toContain(cam);
    }
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('skill `release_summary` có trong INDEX, và nói rõ khi nào KHÔNG dùng', () => {
    const idx = fs.readFileSync(path.join(REPO, '.agent/skills/INDEX.md'), 'utf8');
    expect(idx).toContain('release_summary');
    const sk = fs.readFileSync(path.join(REPO, '.agent/skills/shared/release_summary/SKILL.md'), 'utf8');
    expect(sk, 'phải phân biệt với results:summary và release:verify').toMatch(/results:summary/);
    expect(sk).toMatch(/release:verify/);
    expect(sk, 'và phải ghi số đo làm căn cứ cho nhãn KHÔNG ĐO ĐƯỢC').toMatch(/5 trong 7|5\/7/);
  });
});
