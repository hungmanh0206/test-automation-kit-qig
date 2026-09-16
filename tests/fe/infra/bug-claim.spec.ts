import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * Máy `bug:claim` chặn "phát hiện bug sai rồi phải rút lời".
 *
 * Bối cảnh, chủ repo chỉ ra 16/09/2026: ở Phase 2 agent báo "phát hiện bug, có log không", user hỏi
 * lại "chắc chưa", agent kiểm lại rồi rút. Gốc là lỗi THỨ TỰ: bar khẳng định bug nằm ở
 * `phase2_04` với khoảng tám điều kiện, còn lời nói ra ở `phase2_03` với hai điều kiện.
 *
 * File này khoá hành vi của máy bằng đối chứng âm. Một gate chỉ xanh trên đường tốt thì chưa chứng
 * minh được gì: phải thấy nó ĐỎ đúng chỗ, và đỏ với thông báo chỉ ra được việc cần làm.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const MACHINE = path.join(REPO, 'scripts', 'qa', 'bug_claim.js');

/** Chạy máy trong một task NHÁP ngoài repo, để không chạm outputs thật. */
function run(tmp: string, args: string[] = ['--check']) {
  const r = spawnSync(process.execPath, [MACHINE, ...args], {
    cwd: REPO,
    encoding: 'utf8',
    env: gateEnv({ PROJECT_OUTPUT_DIR: tmp, TASK_KEY: 'CLAIM-TEST' }),
  });
  return { code: r.status === null ? 1 : r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

function mkTask(): { root: string; claims: string; results: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bugclaim-'));
  const task = path.join(root, 'tasks', 'CLAIM-TEST');
  const claims = path.join(task, 'reports', 'bug-claims');
  const results = path.join(task, 'test-results');
  fs.mkdirSync(claims, { recursive: true });
  fs.mkdirSync(results, { recursive: true });
  return { root, claims, results };
}

/** Claim hợp lệ đầy đủ — mọi test dưới đây làm hỏng đúng MỘT chỗ từ bản này. */
const validClaim = () => ({
  id: 'CLAIM-TC_001',
  tc_id: 'TC_001',
  summary: 'Paid Amount cong doi khi callback lap lai',
  status: 'claimed',
  oracle: { type: 'FSD', ref: 'FSD 4.2.3', quote: 'Moi giao dich da xac nhan chi duoc cong dung mot lan' },
  expected: 'Paid Amount = 2.000.000',
  actual: 'Paid Amount = 4.000.000',
  reruns: [{ at: '2026-09-16T09:10:00Z', result: 'fail' }, { at: '2026-09-16T09:22:00Z', result: 'fail' }],
  layer: 'be',
  layer_probe: 'GET /api/v1/orders/1774127 tra paid_amount=4000000, UI cung hien the nen lech o BE',
  instrument: { control_type: 'cell bang', read_method: 'doc textContent theo chi so cot lay tu th' },
  fixture_path: 'api',
  falsified: [
    { category: 'doc_outdated', hypothesis: 'FSD co the cu hon build', measurement: 'Confluence version API page 233701377 tra v35 ngay 12/09/2026', result: 'FSD moi hon build' },
    { category: 'instrument', hypothesis: 'Doc nham cell vi bang co cot an', measurement: 'doi chieu chi so cot tu th: 7/11, doc lai bang GET /transactions', result: 'hai nguon cung gia tri' },
    { category: 'fixture', hypothesis: 'Deal dung khong tu nhien', measurement: 'tao qua UI OPS luong Next-Finish-Confirm, order_id=88213', result: 'fixture di dung luong app' },
  ],
});

const writeClaim = (dir: string, name: string, obj: unknown) => fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(obj, null, 2), 'utf8');

test.describe('@infra bug:claim — kiểm chứng phải đi trước lời nói', () => {
  test('claim đầy đủ thì QUA', () => {
    const t = mkTask();
    writeClaim(t.claims, 'TC_001', validClaim());
    const r = run(t.root);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('1 claim hợp lệ');
  });

  test('thiếu oracle độc lập thì CHẶN — app không được làm oracle của chính nó', () => {
    const t = mkTask();
    const c = validClaim();
    (c as Record<string, unknown>).oracle = { type: '', ref: '', quote: '' };
    writeClaim(t.claims, 'TC_001', c);
    const r = run(t.root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('oracle.type');
  });

  test('rerun không ổn định thì CHẶN — đó là flaky, chưa phải bug', () => {
    const t = mkTask();
    const c = validClaim();
    c.reruns = [{ at: '2026-09-16T09:10:00Z', result: 'fail' }, { at: '2026-09-16T09:22:00Z', result: 'pass' }];
    writeClaim(t.claims, 'TC_001', c);
    const r = run(t.root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('không ổn định');
  });

  test('thiếu một nhóm phản chứng thì CHẶN', () => {
    const t = mkTask();
    const c = validClaim();
    c.falsified = c.falsified.filter((f) => f.category !== 'instrument');
    writeClaim(t.claims, 'TC_001', c);
    const r = run(t.root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('instrument');
  });

  test('phản chứng không dẫn PHÉP ĐO thì CHẶN', () => {
    /*
     * Đây là chỗ chống làm-cho-có. Máy đếm được ba nhóm nhưng không đọc được ý định, nên nó đòi mỗi
     * phản chứng phải dẫn số, lệnh, endpoint hoặc đường dẫn file. Bịa một phép đo khó hơn bịa một câu.
     */
    const t = mkTask();
    const c = validClaim();
    c.falsified[1].measurement = 'toi da kiem tra lai va thay dung roi';
    writeClaim(t.claims, 'TC_001', c);
    const r = run(t.root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('PHÉP ĐO');
  });

  test('fixture dựng thẳng DB thì CHẶN', () => {
    const t = mkTask();
    const c = validClaim();
    c.fixture_path = 'db';
    writeClaim(t.claims, 'TC_001', c);
    const r = run(t.root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('fixture_path');
  });

  test('CHIỀU NGƯỢC: case chấm product_bug mà không có claim thì CHẶN', () => {
    /* Nửa quan trọng nhất. Chỉ kiểm claim đã viết thì bỏ lọt claim KHÔNG viết, mà đó mới là lỗi cần chặn. */
    const t = mkTask();
    fs.writeFileSync(path.join(t.results, 'testcase-status.json'), JSON.stringify({
      tests: [{ id: 'TC_099', status: 'FAIL', failureLayer: 'product_bug' }],
    }), 'utf8');
    const r = run(t.root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('TC_099');
    expect(r.out).toContain('KHÔNG có claim');
  });

  test('claim đã RÚT mà verdict chưa hạ thì CHẶN, và nói đúng việc cần làm', () => {
    const t = mkTask();
    writeClaim(t.claims, 'TC_001', {
      id: 'C1', tc_id: 'TC_001', summary: 'Paid Amount cong doi', status: 'withdrawn',
      withdrawn_reason: 'FSD v35 moi hon build, con so cu la tai lieu het han', withdrawn_by_check: 'doc_outdated',
    });
    fs.writeFileSync(path.join(t.results, 'testcase-status.json'), JSON.stringify({
      tests: [{ id: 'TC_001', status: 'FAIL', failureLayer: 'product_bug' }],
    }), 'utf8');
    const r = run(t.root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('ĐÃ RÚT');
    expect(r.out).toContain('sửa verdict');
  });

  test('claim RÚT chỉ cần lý do và tên phép kiểm, không bắt đủ trường', () => {
    /*
     * Cố ý nới ở đây. Mục đích của bản ghi rút là ĐẾM ĐƯỢC lỗi, không phải phạt việc thành thật.
     * Bắt nó đầy đủ thì lần sau sẽ không ai ghi, và ta quay lại chỗ cũ: lỗi vô hình, không đo được.
     */
    const t = mkTask();
    writeClaim(t.claims, 'TC_001', {
      id: 'C1', tc_id: 'TC_001', summary: 'Paid Amount cong doi', status: 'withdrawn',
      withdrawn_reason: 'doc lai bang API thay UI hien dung, dung cu doc sai cell', withdrawn_by_check: 'instrument',
    });
    const r = run(t.root);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('1 đã rút');
  });

  test('--report đếm tỉ lệ rút và phép kiểm nào bắt được', () => {
    const t = mkTask();
    writeClaim(t.claims, 'TC_001', validClaim());
    writeClaim(t.claims, 'TC_002', {
      id: 'C2', tc_id: 'TC_002', summary: 'Hạn checkout sai', status: 'withdrawn',
      withdrawn_reason: 'FSD ghi 24h la tai lieu cu, build dung 720h', withdrawn_by_check: 'doc_outdated',
    });
    const r = run(t.root, ['--report']);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('tỉ lệ rút: 50%');
    expect(r.out).toContain('doc_outdated');
  });
});
