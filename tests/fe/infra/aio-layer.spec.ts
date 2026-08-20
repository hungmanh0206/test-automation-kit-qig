import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

/*
 * @infra — tầng AIO Tests: hai thứ vừa vá, khoá lại để không trôi.
 *
 * 1. REPORT DO MÁY GHI. Tài liệu hứa `reports/aio-testcase-publish-summary.md` từ lâu, nhưng không script
 *    nào tạo — nó ghi "agent tự ghi". Hệ quả: mỗi lượt một định dạng khác, `traceability_matrix` không có gì
 *    để đối soát, và lần sau không ai biết bộ này publish bằng cây folder nào.
 * 2. CÂY FOLDER NHIỀU CẤP. `ensureFolder` nhận mảng segment tuỳ ý, nhưng publisher chỉ truyền [root, nhóm]
 *    ⇒ bộ testcase cũ (cây 3 cấp) không thêm case vào được. Test này khoá việc "root có dấu / thì tách segment".
 *
 * Chạy offline: KHÔNG gọi AIO (chỉ nạp module + gọi hàm ghi file).
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const publisher = require(path.join(REPO, 'scripts/integrations/aio/publish_testcases_aio.js'));

test.describe('@infra AIO — report publish là việc của MÁY', () => {
  test('writeReport ghi ra reports/aio-testcase-publish-summary.md với số liệu thật', () => {
    const pod = fs.mkdtempSync(path.join(os.tmpdir(), 'aio-report-'));
    const task = 'KIT-AIO-REPORT';
    const prev = { pod: process.env.PROJECT_OUTPUT_DIR, task: process.env.TASK_KEY };
    process.env.PROJECT_OUTPUT_DIR = pod;
    process.env.TASK_KEY = task;
    try {
      publisher.writeReport({
        created: 2, updated: 1, failed: 0, errors: [], tests: [1, 2, 3],
        groups: ['Checkout', 'Hiển thị'], rootName: 'BỘ A/Nhóm B', file: '/x/y/bo-a.xlsx', story: 'SAPP-1',
      });
      const out = path.join(pod, 'tasks', task, 'reports', 'aio-testcase-publish-summary.md');
      expect(fs.existsSync(out), 'phải ghi ra report, không để agent tự ghi').toBe(true);
      const md = fs.readFileSync(out, 'utf8');
      expect(md).toContain('proven=3');                    // created + updated
      expect(md).toContain('tạo 2');
      expect(md).toContain('cập nhật 1');
      expect(md).toContain('BỘ A/Nhóm B/{Checkout, Hiển thị}');
      expect(md).toContain('bo-a.xlsx');
    } finally {
      if (prev.pod === undefined) delete process.env.PROJECT_OUTPUT_DIR; else process.env.PROJECT_OUTPUT_DIR = prev.pod;
      if (prev.task === undefined) delete process.env.TASK_KEY; else process.env.TASK_KEY = prev.task;
      fs.rmSync(pod, { recursive: true, force: true });
    }
  });

  test('có LỖI thì report nêu ra, và marker gate đếm đúng phần broken', () => {
    const pod = fs.mkdtempSync(path.join(os.tmpdir(), 'aio-report-'));
    const prev = { pod: process.env.PROJECT_OUTPUT_DIR, task: process.env.TASK_KEY };
    process.env.PROJECT_OUTPUT_DIR = pod;
    process.env.TASK_KEY = 'KIT-AIO-ERR';
    try {
      publisher.writeReport({ created: 0, updated: 0, failed: 2, errors: ['TC_1: HTTP 400 bad', 'TC_2: HTTP 500'], tests: [1, 2], groups: ['G'], rootName: 'R', file: '/a/b.xlsx', story: '' });
      const md = fs.readFileSync(path.join(pod, 'tasks', 'KIT-AIO-ERR', 'reports', 'aio-testcase-publish-summary.md'), 'utf8');
      expect(md).toContain('broken=2');
      expect(md).toContain('TC_1: HTTP 400 bad');
      expect(md).toContain('(không)');                     // story trống phải nói rõ, không im lặng
    } finally {
      if (prev.pod === undefined) delete process.env.PROJECT_OUTPUT_DIR; else process.env.PROJECT_OUTPUT_DIR = prev.pod;
      if (prev.task === undefined) delete process.env.TASK_KEY; else process.env.TASK_KEY = prev.task;
      fs.rmSync(pod, { recursive: true, force: true });
    }
  });

  test('publisher KHÔNG tự chạy khi bị require (guard require.main)', () => {
    // Nếu thiếu guard, chính dòng require ở đầu file này đã làm CLI chạy và process.exit(2) vì thiếu --file.
    expect(typeof publisher.main, 'main phải export ra để test được').toBe('function');
    expect(typeof publisher.writeReport).toBe('function');
  });
});

/*
 * @infra — AIO LÀ SOURCE OF TRUTH ⇒ mirror local phải chứng minh được là còn TƯƠI.
 *
 * Vì sao thành máy: execute đọc mirror `from-aio/*.xlsx` (cố ý — để chạy offline và không đốt rate limit),
 * nhưng nội dung đó là AIO *lúc pull*. QA sửa expected giữa buổi, hoặc người chạy quên pull, thì verdict
 * được chấm theo expected CŨ mà mọi thứ vẫn xanh. `updatedDate` có sẵn cho mọi case trong payload list nên
 * phép so này chỉ tốn MỘT lượt đọc.
 */
test.describe('@infra AIO — mirror phải tươi (diff manifest ↔ AIO)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { diff } = require(path.join(REPO, 'scripts/integrations/aio/verify_mirror.js'));
  const man = (cases: object) => ({ pulledAt: new Date().toISOString(), scope: { jiraRequirementIDs: [] }, cases });

  test('case bị SỬA trên AIO sau khi pull ⇒ báo changed (kèm mốc thời gian)', () => {
    const d = diff(man({ TC_1: { key: 'P-TC-1', updatedDate: 100 } }), [{ automationKey: 'TC_1', key: 'P-TC-1', updatedDate: 999 }]);
    expect(d.changed.length).toBe(1);
    expect(d.changed[0]).toMatchObject({ tc: 'TC_1', was: 100, now: 999 });
    expect(d.missing).toEqual([]);
    expect(d.added).toEqual([]);
  });

  test('mirror có case mà AIO KHÔNG còn ⇒ báo missing (bị xoá/deprecate hoặc lọc khác)', () => {
    const d = diff(man({ TC_1: { key: 'P-TC-1', updatedDate: 1 } }), []);
    expect(d.missing).toEqual(['TC_1']);
  });

  test('AIO có case trong phạm vi mà mirror THIẾU ⇒ báo added (thiếu coverage)', () => {
    const d = diff(man({ TC_1: { key: 'P-TC-1', updatedDate: 1 } }), [
      { automationKey: 'TC_1', key: 'P-TC-1', updatedDate: 1 },
      { automationKey: 'TC_2', key: 'P-TC-2', updatedDate: 5 },
    ]);
    expect(d.added).toEqual(['TC_2']);
  });

  test('KHÔNG báo oan: đúng bản vừa pull thì im lặng cả 3 loại', () => {
    const live = [{ automationKey: 'TC_1', key: 'P-TC-1', updatedDate: 7 }, { automationKey: 'TC_2', key: 'P-TC-2', updatedDate: 8 }];
    const d = diff(man({ TC_1: { key: 'P-TC-1', updatedDate: 7 }, TC_2: { key: 'P-TC-2', updatedDate: 8 } }), live);
    expect([d.changed.length, d.missing.length, d.added.length]).toEqual([0, 0, 0]);
  });

  test('KHÔNG báo oan: case NGOÀI phạm vi story không bị tính là thiếu coverage', () => {
    const m = { pulledAt: new Date().toISOString(), scope: { jiraRequirementIDs: ['58184'] }, cases: { TC_1: { key: 'P-TC-1', updatedDate: 1 } } };
    const d = diff(m, [
      { automationKey: 'TC_1', key: 'P-TC-1', updatedDate: 1, jiraRequirementIDs: ['58184'] },
      { automationKey: 'TC_9', key: 'P-TC-9', updatedDate: 2, jiraRequirementIDs: ['99999'] },
    ]);
    expect(d.added, 'case của story khác không phải việc của mirror này').toEqual([]);
  });
});

/*
 * @infra — STATUS KHÔNG PHẢI VERDICT không được lọt vào execution.
 *
 * `verdict_taxonomy` cố ý để `aio: null` cho EXPANSION_FINDING/OBSERVATION: chúng là phát hiện từ mở rộng
 * quanh case, không phải verdict của case gốc. Bản trước của push fallback về "Not Run" ⇒ case ĐÃ chạy bị
 * ghi thành CHƯA chạy và attempt mới đè lên kết quả đang hiển thị (đo bằng dry-run: 3/3 case "khớp", không
 * một lời cảnh báo). Test này khoá cả hai đầu: taxonomy giữ null, và mọi script AIO ghi biên bản.
 */
test.describe('@infra AIO — status không phải verdict + biên bản của máy', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const taxonomy = require(path.join(REPO, '.agent/config/verdict_taxonomy.json'));

  test('EXPANSION_FINDING/OBSERVATION giữ `aio: null` — KHÔNG được map sang trạng thái run nào', () => {
    for (const k of ['EXPANSION_FINDING', 'OBSERVATION']) {
      expect(taxonomy.statuses[k], `taxonomy phải còn ${k}`).toBeTruthy();
      expect(taxonomy.statuses[k].aio, `${k} map sang run status là biến "đã chạy" thành "chưa chạy"`).toBeNull();
    }
  });

  test('push LOẠI status aio=null khỏi payload (không đẩy thành Not Run)', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/integrations/aio/push_execution_aio.js'), 'utf8');
    expect(src, 'phải có hàm nhận biết status không-verdict').toContain('isNonVerdict');
    expect(src, 'phải LỌC khỏi tests trước khi khớp case').toMatch(/tests = tests\.filter\(\(t\) => !isNonVerdict/);
    expect(src, 'phải nói rõ chúng thuộc report mở rộng').toContain('expansion-findings.md');
  });

  test('cả 3 script ghi tay-đổi-dữ-liệu đều tự ghi report (không giao việc của máy cho người)', () => {
    const must = [['publish_testcases_aio.js', 'aio-testcase-publish-summary.md'], ['push_execution_aio.js', 'aio-execution-summary.md'], ['deprecate_stale_aio.js', 'aio-deprecate-summary.md']];
    for (const [file, report] of must) {
      const src = fs.readFileSync(path.join(REPO, 'scripts/integrations/aio', file), 'utf8');
      expect(src, `${file} phải tự ghi ${report}`).toContain(report);
      expect(src, `${file} phải thực sự ghi file`).toContain('writeFileSync');
    }
  });
});
