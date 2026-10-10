import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mrc = require('../../../scripts/qa/manual_run_check.js');

/*
 * @infra — NHÁNH CHẠY TAY DỄ DÙNG HƠN (v2.5.0 G1.7), nhận của A.
 *
 * SỐ ĐO NÓI THẲNG VÌ SAO HẠNG MỤC NÀY CẦN. Đo 10/10/2026: bộ TC có **524 case `[manual]` riêng biệt**
 * (đã bỏ thư mục archive) và **0 phiên chạy tay** từng được tạo. 524 case đã khai là cần chạy tay, và
 * chưa case nào có verdict từ đường đó. Nhánh `manual-run/` chặt nhưng khó dùng — 0 phiên chính là bằng
 * chứng của "khó dùng", không phải của "không cần".
 *
 * BA PHÉP KIỂM MỚI, tất cả là CẢNH BÁO chứ không chặn, và mỗi cái có lý do riêng để không chặn:
 *  · sổ dữ liệu — có bản ghi cố ý giữ làm tiền đề cho lượt sau, đó là lựa chọn HỢP LỆ miễn là nói ra;
 *  · chuỗi lỗi hạ tầng — máy đọc file kết quả SAU khi lượt đã xong nên không dừng được lượt đang chạy;
 *  · thao tác phá huỷ — có case mà thao tác xoá chính là thứ phải kiểm, chặn chúng là chặn đúng phần
 *    cần test nhất.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');

const TC_MD = `| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|---|---|---|---|
| TC_001 | UI |  | HS | Mở màn danh sách | [manual] captcha không có đường tắt | — | 1. Mở màn | 1. Màn mở đúng | High |
| TC_002 | UI |  | HS | Xoá học sinh đã chọn | [manual] captcha không có đường tắt | — | 1. Chọn dòng<br>2. Bấm Xoá học sinh | 1. Hiện xác nhận<br>2. Dòng mất khỏi lưới | High |
`;

const SESSION = (soDuLieu = '') => `# Lượt chạy tay — T1

- Người chạy: Nguyễn Văn A
- Ngày: 10/10/2026
- Môi trường: UAT, https://uat.example.gov.vn
- Build / Version: 2026.10.08-rc2
${soDuLieu}`;

function cay(opts: { session?: string; tests?: Record<string, unknown>[] } = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'manrun-'));
  fs.mkdirSync(path.join(d, 'manual-run'), { recursive: true });
  fs.mkdirSync(path.join(d, 'test-results'), { recursive: true });
  fs.mkdirSync(path.join(d, 'test-cases'), { recursive: true });
  fs.writeFileSync(path.join(d, 'test-cases/bo.md'), TC_MD, 'utf8');
  fs.writeFileSync(path.join(d, 'manual-run/session.md'), opts.session ?? SESSION(), 'utf8');
  fs.writeFileSync(path.join(d, 'test-results/testcase-status.json'), JSON.stringify({
    taskKey: 'T1',
    attestation: { oracleSource: 'TC canonical', executed: true, allEvidenceAttached: true, failuresClassified: true, rerunDone: true },
    tests: opts.tests ?? [],
  }), 'utf8');
  return d;
}

const w = (d: string) => (mrc.kiem(d).warnings || []) as string[];

test.describe('@infra manual:check — sổ dữ liệu đã tạo', () => {
  test('chưa có khối sổ ⇒ CẢNH BÁO "CHƯA ĐƯỢC GÁC", không im lặng', () => {
    const d = cay();
    expect(w(d).some((x) => /Sổ dữ liệu đã tạo.*CHƯA ĐƯỢC GÁC/.test(x)), w(d).join('\n')).toBe(true);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('đã TẠO mà cột dọn trống và KHÔNG có lý do ⇒ CẢNH BÁO', () => {
    const d = cay({
      session: SESSION(`
## Sổ dữ liệu đã tạo

| TC ID | Bản ghi đã tạo | Đã dọn | Lý do nếu chưa dọn |
|---|---|---|---|
| TC_001 | 1 học sinh mã QA-001 | | |
`),
    });
    const hit = w(d).filter((x) => /khai ĐÃ TẠO bản ghi/.test(x));
    expect(hit.length, w(d).join('\n')).toBe(1);
    expect(hit[0]).toMatch(/1 dòng/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ÂM BẢN: đã dọn, hoặc chưa dọn NHƯNG có lý do ⇒ KHÔNG cảnh báo', () => {
    const d = cay({
      session: SESSION(`
## Sổ dữ liệu đã tạo

| TC ID | Bản ghi đã tạo | Đã dọn | Lý do nếu chưa dọn |
|---|---|---|---|
| TC_001 | 1 học sinh mã QA-001 | có | |
| TC_002 | 1 lớp QA10A1 | chưa | giữ làm tiền đề cho lượt sau, đã thống nhất với chủ dự án |
`),
    });
    expect(w(d).filter((x) => /khai ĐÃ TẠO bản ghi/.test(x)), w(d).join('\n')).toEqual([]);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('CẢNH BÁO chứ không CHẶN — giữ lại là lựa chọn hợp lệ', () => {
    const d = cay({
      session: SESSION(`
## Sổ dữ liệu đã tạo

| TC ID | Bản ghi đã tạo | Đã dọn | Lý do nếu chưa dọn |
|---|---|---|---|
| TC_001 | 1 học sinh mã QA-001 | | |
`),
    });
    const r = mrc.kiem(d);
    expect((r.problems || []).filter((p: string) => /ĐÃ TẠO bản ghi/.test(p)), 'không được nằm ở problems').toEqual([]);
    fs.rmSync(d, { recursive: true, force: true });
  });
});

test.describe('@infra manual:check — chuỗi lỗi hạ tầng liên tiếp', () => {
  const fail = (id: string, layer: string) => ({ tcId: id, status: 'FAIL', failureLayer: layer, comment: 'đỏ', evidence: 'e/a.png' });

  test('3 case LIÊN TIẾP cùng tầng hạ tầng ⇒ CẢNH BÁO, và nói các verdict sau đáng nghi', () => {
    const d = cay({ tests: [fail('TC_001', 'setup_failure'), fail('TC_002', 'setup_failure'), fail('TC_003', 'setup_failure')] });
    const hit = w(d).filter((x) => /LIÊN TIẾP cùng tầng/.test(x));
    expect(hit.length, w(d).join('\n')).toBe(1);
    expect(hit[0], 'phải nói đây là MỘT nguyên nhân, không phải 3 lỗi khác nhau').toMatch(/không phải 3 lỗi khác nhau/);
    expect(hit[0]).toMatch(/đáng nghi/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ÂM BẢN: 2 case liên tiếp ⇒ chưa tới ngưỡng, KHÔNG cảnh báo', () => {
    const d = cay({ tests: [fail('TC_001', 'setup_failure'), fail('TC_002', 'setup_failure')] });
    expect(w(d).filter((x) => /LIÊN TIẾP cùng tầng/.test(x)), w(d).join('\n')).toEqual([]);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ÂM BẢN: 3 case đỏ nhưng tầng KHÁC nhau ⇒ KHÔNG cảnh báo', () => {
    /* Ba lỗi khác nhau là ba lỗi thật, không phải hạ tầng sập. Gộp chúng lại là làm mất ba phát hiện. */
    const d = cay({ tests: [fail('TC_001', 'setup_failure'), fail('TC_002', 'product_bug'), fail('TC_003', 'script_error')] });
    expect(w(d).filter((x) => /LIÊN TIẾP cùng tầng/.test(x)), w(d).join('\n')).toEqual([]);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ÂM BẢN: 3 case `product_bug` liên tiếp ⇒ KHÔNG cảnh báo (không phải tầng hạ tầng)', () => {
    const d = cay({ tests: [fail('TC_001', 'product_bug'), fail('TC_002', 'product_bug'), fail('TC_003', 'product_bug')] });
    expect(w(d).filter((x) => /LIÊN TIẾP cùng tầng/.test(x)), w(d).join('\n')).toEqual([]);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('chuỗi bị NGẮT bởi một case xanh thì đếm lại từ đầu', () => {
    const d = cay({
      tests: [fail('TC_001', 'setup_failure'), { tcId: 'TC_002', status: 'PASS', comment: 'ok', evidence: 'e/b.png' }, fail('TC_003', 'setup_failure')],
    });
    expect(w(d).filter((x) => /LIÊN TIẾP cùng tầng/.test(x)), w(d).join('\n')).toEqual([]);
    fs.rmSync(d, { recursive: true, force: true });
  });
});

test.describe('@infra manual:check — liệt kê thao tác phá huỷ', () => {
  test('case `[manual]` có bước phá huỷ ⇒ LIỆT KÊ để người chạy thấy trước', () => {
    const d = cay();
    const hit = w(d).filter((x) => /THAO TÁC PHÁ HUỶ/.test(x));
    expect(hit.length, w(d).join('\n')).toBe(1);
    expect(hit[0], 'phải gọi tên đúng case, không báo chung chung').toContain('TC_002');
    expect(hit[0], 'và KHÔNG được gọi case không có dấu hiệu').not.toContain('TC_001');
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('chỉ LIỆT KÊ, KHÔNG tự hạ verdict', () => {
    /*
     * Có case mà thao tác xoá CHÍNH LÀ thứ phải kiểm (TC_002 ở fixture là "Xoá học sinh đã chọn"). Chặn
     * hoặc tự đổi verdict cho chúng là chặn đúng phần cần test nhất.
     */
    const d = cay({ tests: [{ tcId: 'TC_002', status: 'PASS', comment: 'xoá được, dòng mất khỏi lưới', evidence: 'e/c.png' }] });
    const r = mrc.kiem(d);
    expect((r.problems || []).filter((p: string) => /PHÁ HUỶ/.test(p)), 'không được nằm ở problems').toEqual([]);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('danh sách dấu hiệu đọc TỪ CONFIG, và config ghi SỐ ĐO làm căn cứ', () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/manual_run.json'), 'utf8'));
    expect(cfg.thaoTacPhaHuy.signals.length).toBeGreaterThan(5);
    expect(JSON.stringify(cfg), 'phải ghi số đo, không chọn danh sách theo cảm tính').toMatch(/xóa 20|xoá 24/);
    expect(JSON.stringify(cfg), 'và ghi lý do vì sao chỉ liệt kê, không tự chặn').toMatch(/KHÔNG tự hạ verdict|_khong_tu_dong_chan/);
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/manual_run_check.js'), 'utf8');
    expect(src, 'script không được khai lại danh sách dấu hiệu').not.toMatch(/signals\s*=\s*\[/);
  });
});

test.describe('@infra manual:check — số đo nền của hạng mục', () => {
  test('repo THẬT: 0 phiên chạy tay, trong khi bộ TC có hàng trăm case `[manual]`', () => {
    /*
     * Neo số đo vào máy. Ngày có phiên chạy tay đầu tiên, test này đỏ — và lúc đó câu "nhánh này chưa ai
     * dùng" trong config lẫn trong chú thích không còn đúng, phải cập nhật.
     */
    const ra: string[] = [];
    const di = (d: string, s = 0) => {
      if (s > 6) return;
      let es: fs.Dirent[];
      try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of es) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { if (!/^(test-results|playwright-report|node_modules)$/.test(e.name)) di(p, s + 1); }
        else if (e.name === 'session.md' && /manual-run/.test(p)) ra.push(path.relative(REPO, p));
      }
    };
    di(path.join(REPO, 'outputs'));
    expect(ra, 'có phiên chạy tay đầu tiên ⇒ cập nhật câu "0 phiên" ở config và spec này').toEqual([]);

    const cfg = fs.readFileSync(path.join(REPO, '.agent/config/manual_run.json'), 'utf8');
    expect(cfg, 'config phải ghi số đo đó làm lý do tồn tại của hạng mục').toMatch(/524 case/);
    expect(cfg).toMatch(/0 phiên chạy tay/);
  });

  test('tài liệu chạy tay có đủ năm điểm dễ-dùng của A', () => {
    const doc = fs.readFileSync(path.join(REPO, 'manual-run/run_manual_execution.md'), 'utf8');
    expect(doc, 'ghi kết quả NGAY sau mỗi case').toMatch(/ngay sau mỗi case|NGAY sau mỗi case/);
    expect(doc, 'báo tiến độ theo lô').toMatch(/tiến độ/);
    expect(doc, 'fail rồi chạy tiếp, dừng khi chuỗi hạ tầng').toMatch(/chạy tiếp/);
    expect(doc, 'sổ dữ liệu đã tạo').toMatch(/Sổ dữ liệu đã tạo/);
    expect(doc, 'thao tác phá huỷ trên môi trường dùng chung').toMatch(/phá huỷ/);
    /* Và giữ nguyên luật của B — không được nới khi làm cho dễ dùng. */
    expect(doc, 'ảnh mọi step').toMatch(/Mỗi step một ảnh/);
    expect(doc, 'rerun 2-3 lần').toMatch(/rerun 2 đến 3 lần|rerun 2–3/);
  });
});
