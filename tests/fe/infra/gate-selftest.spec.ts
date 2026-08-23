import { test, expect } from '@playwright/test';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

/*
 * @infra — BA GATE TỪNG KHÔNG CÓ MÁY KIỂM CHÍNH NÓ.
 *
 * Vì sao có file này: `knowledge_backup` · `leak_report` · `spec_gap_report` đều là gate CLI, và đều
 * không test nào chạm tới. Với gate, chế độ hỏng đáng sợ nhất KHÔNG phải "chạy lỗi" — mà là **thoát 0
 * trong khi chẳng đo được gì**: thiếu input mà báo xanh, hoặc từ-chối-an-toàn im lặng thành ghi thật.
 * Ba nhóm test dưới đây khoá đúng chỗ đó, cộng thêm 1 âm-tính (không báo oan) cho mỗi gate.
 *
 * Không chạm dữ liệu thật: backup ghi ra thư mục tạm; ca `--restore` chỉ dùng file `__selftest__` do
 * chính test tạo rồi xoá ở `finally`.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const KB = path.join(REPO, 'scripts/qa/knowledge_backup.js');
const LEAK = path.join(REPO, 'scripts/qa/leak_report.js');
const GAP = path.join(REPO, 'scripts/qa/spec_gap_report.js');

/** Chạy gate như pipeline chạy: node <script> <args>, env tự khai để không phụ thuộc máy chạy test. */
const run = (script: string, args: string[] = [], env: Record<string, string | undefined> = {}) => {
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd: REPO, encoding: 'utf8', env: { ...process.env, ...env } as NodeJS.ProcessEnv,
  });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};

const tmp = (p = 'gate-') => fs.mkdtempSync(path.join(os.tmpdir(), p));

test.describe('@infra knowledge:backup — thứ mất là mất công sức người', () => {
  test('không khai đích ⇒ CHẶN, không âm thầm bỏ qua', () => {
    const r = run(KB, [], { KNOWLEDGE_BACKUP_DIR: '' });
    expect(r.code, 'thoát 0 = người tưởng đã có backup').not.toBe(0);
    expect(r.out).toContain('KNOWLEDGE_BACKUP_DIR');
  });

  test('đích NẰM TRONG repo ⇒ TỪ CHỐI (backup cạnh bản gốc không phải backup)', () => {
    const r = run(KB, ['--out', path.join(REPO, 'outputs', '__selftest_backup__')]);
    expect(r.code).not.toBe(0);
    expect(r.out).toContain('TỪ CHỐI');
    expect(fs.existsSync(path.join(REPO, 'outputs', '__selftest_backup__')), 'không được tạo thư mục nào').toBe(false);
  });

  test('sao lưu thật ⇒ CHỈ store ghi tay, và tự soi lại được', () => {
    const dir = tmp('kb-');
    const r = run(KB, ['--out', dir]);
    test.skip(r.code === 2 && /không có record/.test(r.out), 'máy này chưa có knowledge/ ghi tay');
    expect(r.code, r.out).toBe(0);

    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBe(1);
    const bundle = JSON.parse(fs.readFileSync(path.join(dir, files[0]), 'utf8'));
    expect(bundle.items.length).toBeGreaterThan(0);
    // bugs/ · metrics/ · historical_execution/ nạp lại được từ Jira/AIO ⇒ CỐ Ý không sao lưu.
    const reproducible = bundle.items.filter((i: { rel: string }) => /^(bugs|metrics|historical_execution)\//.test(i.rel));
    expect(reproducible, 'store nạp lại được thì không được phình vào bundle').toEqual([]);

    // --verify: bản sao khớp hiện trạng ⇒ 0
    expect(run(KB, ['--verify', path.join(dir, files[0])]).code, 'bundle vừa tạo phải tự khớp').toBe(0);
  });

  test('--verify phát hiện record ĐÃ MẤT ở hiện trạng', () => {
    const dir = tmp('kb-');
    const bundle = path.join(dir, 'b.json');
    fs.writeFileSync(bundle, JSON.stringify({
      kind: 'sapp-kit-knowledge-backup', version: 1, stores: ['domain'],
      items: [{ rel: 'domain/__khong_bao_gio_ton_tai__.json', content: '{}' }],
    }));
    const r = run(KB, ['--verify', bundle]);
    expect(r.code, 'mất record mà báo xanh thì bản sao vô nghĩa').not.toBe(0);
    expect(r.out).toContain('MẤT');
  });

  test('--restore KHÔNG đè file đang có (bản sao cũ không được ghi lùi bản mới)', () => {
    const target = path.join(REPO, 'knowledge', 'domain', '__selftest_kb__.json');
    const dir = tmp('kb-');
    const bundle = path.join(dir, 'b.json');
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, '{"v":"MOI"}');
      fs.writeFileSync(bundle, JSON.stringify({
        kind: 'sapp-kit-knowledge-backup', version: 1, stores: ['domain'],
        items: [{ rel: 'domain/__selftest_kb__.json', content: '{"v":"CU"}' }],
      }));
      const r = run(KB, ['--restore', bundle]);
      expect(r.code, r.out).toBe(0);
      expect(fs.readFileSync(target, 'utf8'), 'restore đè mất bản mới = làm hỏng đúng thứ nó bảo vệ').toContain('MOI');
    } finally {
      if (fs.existsSync(target)) fs.unlinkSync(target);
    }
  });
});

test.describe('@infra leak:report — không đo được thì phải nói, không được báo "0 rò"', () => {
  const BLANK = { JIRA_STORY_KEY: '', TASK_KEY: '', JIRA_BASE_URL: '', JIRA_EMAIL: '', JIRA_API_TOKEN: '' };

  test('thiếu story ⇒ CHẶN (báo cáo rỗng dễ bị đọc thành "không lọt bug nào")', () => {
    const r = run(LEAK, [], BLANK);
    expect(r.code).not.toBe(0);
    expect(r.out).toContain('story');
  });

  test('có story nhưng thiếu credential Jira ⇒ CHẶN, nói rõ thiếu gì', () => {
    const r = run(LEAK, ['--story', 'SAPP-1'], BLANK);
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/JIRA_BASE_URL|JIRA_API_TOKEN/);
  });
});

test.describe('@infra spec:gap — vùng mù thật thì chặn, tài liệu chậm thì chỉ cảnh báo', () => {
  /** Bộ 3 file tối thiểu: spec khai gì · build có gì · bindings nối tên nào. */
  const fixture = (o: { spec: unknown[]; surface: unknown; bindings: unknown }) => {
    const d = tmp('gap-');
    const w = (n: string, v: unknown) => { const p = path.join(d, n); fs.writeFileSync(p, JSON.stringify(v)); return p; };
    return {
      screens: w('screens.json', { screens: o.spec }),
      surface: w('surface.json', o.surface),
      bindings: w('bindings.json', o.bindings),
    };
  };
  const BIND = { screens: { 'checkout': { name: 'Màn Checkout' } } };
  const args = (f: ReturnType<typeof fixture>, extra: string[] = []) =>
    ['--screens', f.screens, '--surface', f.surface, '--bindings', f.bindings, ...extra];

  test('thiếu input ⇒ CHẶN exit 2, không im lặng ra báo cáo trắng', () => {
    const r = run(GAP, ['--screens', path.join(tmp(), 'khong-co.json')]);
    expect(r.code).toBe(2);
    expect(r.out).toContain('thiếu');
  });

  test('build có khối KHÔNG được khai ở tài liệu ⇒ --enforce CHẶN', () => {
    const f = fixture({
      spec: [{ key: 'checkout', section: 'Thông tin thanh toán', fields: [{ label: 'Số tiền' }] }],
      surface: { 'Màn Checkout': [{ heading: 'Ưu đãi áp dụng', labels: ['Mã giảm giá', 'Giá trị giảm'] }] },
      bindings: BIND,
    });
    const r = run(GAP, args(f, ['--enforce']));
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('Ưu đãi áp dụng');
  });

  test('khối được khai dưới TÊN KHÁC (alias) ⇒ KHÔNG báo oan', () => {
    const f = fixture({
      spec: [{ key: 'checkout', section: 'Ưu đãi', fields: [{ label: 'Mã giảm giá' }, { label: 'Giá trị giảm' }] }],
      surface: { 'Màn Checkout': [{ heading: 'Ưu đãi áp dụng', labels: ['Mã giảm giá', 'Giá trị giảm'] }] },
      bindings: { ...BIND, sectionAliases: { 'Ưu đãi': 'Ưu đãi áp dụng' } },
    });
    expect(run(GAP, args(f, ['--enforce'])).code, 'alias đã khai mà vẫn chặn = gate mất uy tín').toBe(0);
  });

  test('chỉ MỌC THÊM field trong khối đã khai ⇒ cảnh báo, KHÔNG chặn', () => {
    const f = fixture({
      spec: [{ key: 'checkout', section: 'Ưu đãi áp dụng', fields: [{ label: 'Mã giảm giá' }] }],
      surface: { 'Màn Checkout': [{ heading: 'Ưu đãi áp dụng', labels: ['Mã giảm giá', 'Giá trị giảm'] }] },
      bindings: BIND,
    });
    const r = run(GAP, args(f, ['--enforce']));
    expect(r.code, 'tài liệu chậm cập nhật không phải vùng mù').toBe(0);
    expect(r.out).toContain('Giá trị giảm');
  });

  test('khối cha chỉ có 1 nhãn ⇒ không tính vùng mù (không có field nào để soi)', () => {
    const f = fixture({
      spec: [{ key: 'checkout', section: 'Thông tin thanh toán', fields: [{ label: 'Số tiền' }] }],
      surface: { 'Màn Checkout': [{ heading: 'Nhóm gộp', labels: ['Chi tiết'] }] },
      bindings: BIND,
    });
    expect(run(GAP, args(f, ['--enforce'])).code).toBe(0);
  });
});

/*
 * PREFLIGHT — hai cảnh báo "im lặng là hỏng". Chúng cảnh báo chứ không chặn, nên nếu logic sai thì
 * KHÔNG ai biết: gate vẫn báo ĐẠT. Vì thế test cả hai chiều (có thì kêu · đủ thì im).
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const preflight = require(path.join(REPO, 'scripts/qa/preflight_gate.js'));

/** Dựng root giả có 2 hook + settings.json tuỳ ý. */
const fakeRoot = (settings: unknown | null) => {
  const root = tmp('pf-');
  fs.mkdirSync(path.join(root, 'scripts/qa/hooks'), { recursive: true });
  fs.writeFileSync(path.join(root, 'scripts/qa/hooks/gate_on_write.js'), '// hook');
  fs.writeFileSync(path.join(root, 'scripts/qa/hooks/inject_context.js'), '// hook');
  if (settings !== null) {
    fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(root, '.claude', 'settings.json'), typeof settings === 'string' ? settings : JSON.stringify(settings));
  }
  return root;
};

test.describe('@infra preflight — harness hook tắt mà không ai biết', () => {
  test('không có .claude/settings.json ⇒ nói ra cả 3 điều (thiếu file + 2 hook đang tắt)', () => {
    const w = preflight.checkHarnessHooks(fakeRoot(null));
    expect(w.length).toBe(3);
    expect(w.join(' ')).toContain('gate_on_write.js');
    expect(w.join(' ')).toContain('inject_context.js');
  });

  test('settings.json khai ĐỦ 2 hook ⇒ IM LẶNG (không báo oan)', () => {
    const root = fakeRoot({ hooks: { PostToolUse: [{ hooks: [{ command: 'node scripts/qa/hooks/gate_on_write.js' }] }], SessionStart: [{ hooks: [{ command: 'node scripts/qa/hooks/inject_context.js' }] }] } });
    expect(preflight.checkHarnessHooks(root)).toEqual([]);
  });

  test('khai THIẾU 1 hook ⇒ chỉ kêu đúng hook còn thiếu', () => {
    const root = fakeRoot({ hooks: { PostToolUse: [{ hooks: [{ command: 'node scripts/qa/hooks/gate_on_write.js' }] }] } });
    const w = preflight.checkHarnessHooks(root);
    expect(w.length).toBe(1);
    expect(w[0]).toContain('inject_context.js');
  });

  test('settings.json hỏng JSON ⇒ coi như TẮT và nói rõ, không im lặng bỏ qua', () => {
    const w = preflight.checkHarnessHooks(fakeRoot('{ hooks: KHONG-PHAI-JSON'));
    expect(w.some((x: string) => x.includes('KHÔNG parse được'))).toBe(true);
    expect(w.length).toBe(3);
  });

  test('hook KHÔNG có trong repo ⇒ không đòi khai (repo cắt gọn vẫn hợp lệ)', () => {
    const root = tmp('pf-');
    fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(root, '.claude', 'settings.json'), '{"hooks":{}}');
    expect(preflight.checkHarnessHooks(root)).toEqual([]);
  });
});

test.describe('@infra preflight — knowledge chưa có bản sao ngoài máy', () => {
  const withKnowledge = (n: number) => {
    const root = tmp('kn-');
    const d = path.join(root, 'knowledge', 'domain');
    fs.mkdirSync(d, { recursive: true });
    for (let i = 0; i < n; i += 1) fs.writeFileSync(path.join(d, `r${i}.json`), '{}');
    return root;
  };

  test('có record ghi tay mà chưa khai KNOWLEDGE_BACKUP_DIR ⇒ CẢNH BÁO kèm số lượng', () => {
    const w = preflight.checkKnowledgeBackup(withKnowledge(3), {});
    expect(w.length).toBe(1);
    expect(w[0]).toContain('3 record');
  });

  test('đã khai đích sao lưu ⇒ IM LẶNG', () => {
    expect(preflight.checkKnowledgeBackup(withKnowledge(3), { KNOWLEDGE_BACKUP_DIR: 'D:/backup' })).toEqual([]);
  });

  test('kho rỗng ⇒ IM LẶNG (chưa có gì thì chưa có gì để mất)', () => {
    expect(preflight.checkKnowledgeBackup(withKnowledge(0), {})).toEqual([]);
    expect(preflight.checkKnowledgeBackup(tmp('kn-'), {})).toEqual([]);
  });
});

/*
 * RELIABILITY/METRICS — `skipped` không phải tín hiệu độ tin cậy.
 * Đo 23/08/2026 trên kho thật: 1548 record = 1537 skipped · 10 failed · 1 passed ⇒ bảng reliability cũ
 * "quarantine 437/438 test, TRI 0, flaky 0". Nguyên nhân: chạy một file lẻ thì 500+ test còn lại được ghi
 * `skipped`, mà TRI = pass sạch / TỔNG. Máy không thiếu dữ liệu — nó KẾT LUẬN SAI trên nhiễu.
 */
test.describe('@infra metrics/reliability — skip không được kéo TRI', () => {
  const RELI = path.join(REPO, 'scripts/qa/reliability_index.js');
  const COLLECT = path.join(REPO, 'scripts/qa/metrics_collect.js');

  const history = (rows: Array<Record<string, unknown>>) => {
    const d = tmp('reli-');
    const f = path.join(d, 'tc-history.jsonl');
    fs.writeFileSync(f, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`);
    return { dir: d, file: f };
  };
  const R = (status: string, extra: Record<string, unknown> = {}) => ({
    at: '2026-08-01T00:00:00.000Z', label: 'x', key: 'tests/a.spec.ts::t1', file: 'tests/a.spec.ts', title: 't1', status, retries: 0, flaky: false, ...extra,
  });

  test('test pass 3 lần + 20 record skip ⇒ KHÔNG quarantine (trước đây bị TRI 0)', () => {
    const h = history([...Array(3)].map(() => R('passed')).concat([...Array(20)].map(() => R('skipped'))));
    const r = run(RELI, ['--in', h.file, '--out', h.dir, '--min-runs', '3']);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('bỏ 20/23');
    const idx = JSON.parse(fs.readFileSync(path.join(h.dir, 'reliability-index.json'), 'utf8'));
    expect(idx.tests[0].runs, 'chỉ đếm lần ĐÃ CHẠY').toBe(3);
    expect(idx.tests[0].tri).toBe(1);
    expect(idx.tests[0].quarantine).toBe(false);
  });

  test('toàn bộ record là skip ⇒ KHÔNG kết luận gì (không phán "cả suite hỏng")', () => {
    const h = history([...Array(5)].map(() => R('skipped')));
    const r = run(RELI, ['--in', h.file, '--out', h.dir]);
    expect(r.out).toContain('KHÔNG có record nào đã chạy');
    expect(fs.existsSync(path.join(h.dir, 'quarantine.json')), 'không được ghi quarantine từ nhiễu').toBe(false);
  });

  test('flaky thật (pass sau retry) VẪN được tính — đó là tín hiệu cần giữ', () => {
    const h = history([R('passed', { retries: 1, flaky: true }), R('passed'), R('passed')]);
    const r = run(RELI, ['--in', h.file, '--out', h.dir, '--min-runs', '3']);
    const idx = JSON.parse(fs.readFileSync(path.join(h.dir, 'reliability-index.json'), 'utf8'));
    expect(idx.tests[0].flakyRate, r.out).toBeGreaterThan(0);
    expect(idx.tests[0].eventualSuccess).toBe(1);
  });

  test('metrics_collect KHÔNG ghi record skip vào tc-history, nhưng vẫn giữ số ở mức run', () => {
    const d = tmp('mc-');
    const results = path.join(d, 'results.json');
    fs.writeFileSync(results, JSON.stringify({
      stats: { expected: 1, unexpected: 0, flaky: 0, skipped: 2, duration: 1000 },
      suites: [{ file: 'a.spec.ts', specs: [
        { title: 'chay', tests: [{ status: 'expected', results: [{ status: 'passed' }] }] },
        { title: 'skip1', tests: [{ status: 'skipped', results: [] }] },
        { title: 'skip2', tests: [{ status: 'skipped', results: [] }] },
      ] }],
    }));
    const r = run(COLLECT, ['--results', results, '--out', d, '--label', 'selftest']);
    expect(r.code, r.out).toBe(0);
    const tc = fs.readFileSync(path.join(d, 'tc-history.jsonl'), 'utf8').trim().split('\n');
    expect(tc.length, 'chỉ 1 dòng: test đã chạy').toBe(1);
    expect(r.out).toContain('bo 2 record');
    const runRec = JSON.parse(fs.readFileSync(path.join(d, 'runs.jsonl'), 'utf8').trim());
    expect(runRec.skipped, 'số skip vẫn phải có ở mức run — chỗ đó nó có nghĩa').toBe(2);
  });
});
