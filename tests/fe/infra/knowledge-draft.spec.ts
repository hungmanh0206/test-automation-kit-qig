import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * @infra — `status: draft` và `knowledge:bootstrap` (v2.5.0 G2.3).
 *
 * LỖ LÀM CẢ HẠNG MỤC NÀY BẤT KHẢ THI TRƯỚC ĐÓ: không có cách nào ghi một bản ghi CHƯA ai xác nhận.
 * `status` chỉ nhận `active|superseded|deprecated|invalid`, và `confirmed_by` BẮT BUỘC ∈
 * `BA|Dev|QA-Lead|PO`. Nghĩa là một khung mới dựng — thứ chưa hỏi BA — không thể tồn tại trong kho. Dự án
 * mới có `knowledge/` rỗng thì nó Ở LẠI RỖNG, vì bước đầu tiên đã bị chặn.
 *
 * `draft` được MIỄN `confirmed_by` và `rule`, nhưng ĐỔI LẠI bị chặn mọi đường thành oracle. Đây cũng là
 * nền mà v2.6.0 và v2.8.0 đều cần ("ứng viên ở dạng `draft`, chỉ `active` khi có `confirmed_by`").
 *
 * `knowledge:bootstrap` CỐ Ý KHÔNG sinh nội dung rule: sinh câu rule từ text Backlog hay từ app là chế
 * oracle — đúng thứ `domain:check` vừa CHẶN ở G1.3. Nó chỉ dựng khung rỗng kèm CÂU HỎI.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const DR = path.join(REPO, 'scripts/qa/domain_rules.js');
const SM = path.join(REPO, 'scripts/qa/system_map.js');
const KB = path.join(REPO, 'scripts/qa/knowledge_bootstrap.js');

const DRAFT = (over: Record<string, unknown> = {}) => ({
  id: 'BR-HOCSINH-900',
  module: 'Học sinh',
  status: 'draft',
  rule: '',
  todo: 'Hỏi BA: email của học sinh có bắt buộc duy nhất trong toàn trường không?',
  covered_by: [],
  version: 1,
  ...over,
});

function chayDomain(recs: Record<string, unknown>[]) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'kdraft-'));
  recs.forEach((r, i) => fs.writeFileSync(path.join(d, `r${i}.json`), JSON.stringify(r, null, 2), 'utf8'));
  const r = spawnSync(process.execPath, [DR, '--validate', '--enforce', '--dir', d], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}`, d };
}

test.describe('@infra draft — miễn trường, nhưng KHÔNG được làm oracle', () => {
  test('draft hợp lệ đi qua, dù KHÔNG có `confirmed_by` và `rule` rỗng', () => {
    const r = chayDomain([DRAFT()]);
    expect(r.code, `draft phải được phép tồn tại:\n${r.out}`).toBe(0);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('draft mà `covered_by` KHÁC rỗng ⇒ CHẶN', () => {
    const r = chayDomain([DRAFT({ covered_by: ['CSDL_HS_TC_088'] })]);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/CHƯA ai chốt thì KHÔNG được làm oracle/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('draft thiếu `todo` ⇒ CHẶN — khung không có câu hỏi chỉ là rác chiếm chỗ', () => {
    const o: Record<string, unknown> = DRAFT();
    delete o.todo;
    const r = chayDomain([o]);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/PHẢI có `todo`/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('draft KHÔNG được seal `content_sha`', () => {
    const r = chayDomain([DRAFT({ content_sha: 'abc123' })]);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/KHÔNG được seal/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('ÂM BẢN: rule ĐÃ CHỐT vẫn bị đòi đủ trường — draft không nới luật cho `active`', () => {
    /* Nếu nhánh draft rò sang `active` thì mọi rule đều lọt, và cả tầng oracle mất nghĩa. */
    const r = chayDomain([DRAFT({ status: 'active' })]);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/confirmed_by/);
    expect(r.out).toMatch(/thiếu `rule`|thiếu `source`/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('`system/` dùng CÙNG khuôn draft, không có mô hình thứ hai', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'kdraft2-'));
    const ok = { id: 'PM-HOCSINH-900', type: 'permission_matrix', modules: ['Học sinh'], status: 'draft', todo: 'Hỏi BA ma trận quyền', covered_by: {} };
    fs.writeFileSync(path.join(d, 'a.json'), JSON.stringify(ok), 'utf8');
    const r1 = spawnSync(process.execPath, [SM, '--validate', '--enforce', '--dir', d], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    expect(r1.status, `${r1.stdout}${r1.stderr}`).toBe(0);

    fs.writeFileSync(path.join(d, 'a.json'), JSON.stringify({ ...ok, covered_by: { 'GiaoVien:delete': ['TC_1'] } }), 'utf8');
    const r2 = spawnSync(process.execPath, [SM, '--validate', '--enforce', '--dir', d], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    expect(r2.status, `${r2.stdout}${r2.stderr}`).toBe(1);
    fs.rmSync(d, { recursive: true, force: true });
  });
});

test.describe('@infra draft — case trỏ vào rule draft thì CHẶN', () => {
  test('tệ hơn "oracle ma", nên nó CHẶN chứ không cảnh báo', () => {
    /*
     * "Oracle ma" (trỏ id không tồn tại) chỉ CẢNH BÁO: người viết biết ngay là thiếu. Trỏ vào `draft` thì
     * rule CÓ THẬT trong kho — nó chỉ chưa ai chốt — nên case sẽ đọc như đã có neo và verdict từ nó sẽ
     * được tin. Đó là lý do mức khác nhau.
     */
    const src = fs.readFileSync(DR, 'utf8');
    const i = src.indexOf('oracle ma');
    const j = src.indexOf("status === 'draft'", i);
    expect(j, 'phép kiểm draft phải nằm cạnh phép kiểm oracle ma').toBeGreaterThan(i);
    const khoi = src.slice(i, j + 400);
    expect(khoi, 'draft phải vào `problems`, không vào `warnings`').toMatch(/problems\.push/);
    expect(khoi).toMatch(/CHƯA ai chốt thì KHÔNG phải oracle/);
  });
});

test.describe('@infra knowledge:bootstrap — danh sách việc, không phải 44 file rỗng', () => {
  function chayKb(argv: string[]) {
    const r = spawnSync(process.execPath, [KB, ...argv], {
      cwd: REPO,
      encoding: 'utf8',
      env: { ...gateEnv(), TASK_KEY: 'CSDL-9003', PROJECT_OUTPUT_DIR: 'outputs/CSDL' },
    });
    return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
  }

  test('DRY-RUN mặc định: in danh sách việc, KHÔNG ghi gì', () => {
    const r = chayKb([]);
    if (/0 module đọc được/.test(r.out)) { test.skip(true, 'máy này không có bộ TC của task (lớp PROJECT)'); return; }
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/DRY-RUN/);
    expect(r.out, 'phải nói rõ phần giá trị nằm ở chính danh sách').toMatch(/DANH SÁCH VIỆC/);
  });

  test('`--apply` KHÔNG kèm phạm vi ⇒ TỪ CHỐI, và nói vì sao', () => {
    /*
     * Đo trên CSDL-9003: 44 module chưa có rule. Dồn hết vào tầng oracle là tạo 44 file rỗng phải bảo
     * trì và một `domain:index` đầy ô trắng — chưa chắc tốt hơn kho rỗng.
     */
    const r = chayKb(['--apply']);
    if (/0 module đọc được/.test(r.out)) { test.skip(true, 'máy này không có bộ TC của task'); return; }
    expect(r.code, r.out).toBe(2);
    expect(r.out).toMatch(/TỪ CHỐI ghi/);
    expect(r.out).toMatch(/--top|--module/);
    expect(r.out, 'phải nói hậu quả, không chỉ cấm').toMatch(/file rỗng phải bảo trì/);
  });

  test('`--apply --top 2` ghi đúng 2, và khung sinh ra ĐI QUA `domain:check`', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-'));
    const r = chayKb(['--apply', '--top', '2', '--dir', d]);
    if (/0 module đọc được/.test(r.out)) { test.skip(true, 'máy này không có bộ TC của task'); fs.rmSync(d, { recursive: true, force: true }); return; }
    expect(r.code, r.out).toBe(0);
    const files = fs.readdirSync(d).filter((f) => f.endsWith('.json'));
    expect(files.length, 'phải ghi đúng 2 khung').toBe(2);

    /* Khung sinh ra phải HỢP SCHEMA — nếu không thì bộ này tạo ra rác mà gate sẽ chặn ngay lượt sau. */
    const v = spawnSync(process.execPath, [DR, '--validate', '--enforce', '--dir', d], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    expect(v.status, `khung tự sinh phải qua domain:check:\n${v.stdout}${v.stderr}`).toBe(0);

    /* Và mỗi khung phải CÓ câu hỏi, `rule` TRỐNG, `covered_by` rỗng. */
    for (const f of files) {
      const j = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'));
      expect(j.status).toBe('draft');
      expect(String(j.rule), 'rule để TRỐNG có chủ đích — điền sẵn một câu đoán là chế oracle').toBe('');
      expect(String(j.todo).length, 'todo phải là câu hỏi thật').toBeGreaterThan(40);
      expect(j.covered_by).toEqual([]);
    }
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('chạy lại KHÔNG ghi trùng (idempotent theo module)', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'kb2-'));
    const r1 = chayKb(['--apply', '--top', '2', '--dir', d]);
    if (/0 module đọc được/.test(r1.out)) { test.skip(true, 'máy này không có bộ TC của task'); fs.rmSync(d, { recursive: true, force: true }); return; }
    const n1 = fs.readdirSync(d).length;
    chayKb(['--apply', '--top', '2', '--dir', d]);
    const n2 = fs.readdirSync(d).length;
    expect(n2, 'lượt hai phải dựng cho module KHÁC, không ghi lại module cũ').toBeGreaterThan(n1);
    const ids = fs.readdirSync(d);
    expect(new Set(ids).size, 'không file nào trùng tên').toBe(ids.length);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('KHÔNG sinh nội dung rule — và mã nguồn nói rõ vì sao', () => {
    const src = fs.readFileSync(KB, 'utf8');
    expect(src).toMatch(/KHÔNG LÀM.*không sinh nội dung rule|không sinh nội dung rule/i);
    expect(src, 'phải nói rõ đó là chế oracle').toMatch(/chế oracle/);
    expect(src, 'và nguồn module là bộ TC canonical, không phải app').toMatch(/KHÔNG suy từ app/);
  });

  test('id có NGHĨA — slug lấy đoạn trước dấu `/`', () => {
    /*
     * Lỗi thật lúc dựng: cột `Module` của bộ TC có dạng "Chuyển lớp / Dữ liệu đi kèm", và nhồi cả vào
     * slug thì 16 ký tự đầu của nhiều module trùng nhau — `BR-THEMMOIHOSOHOCSI-900` với `-901` là hai
     * module KHÁC HẲN, chỉ giống ở phần bị cắt. Id như vậy không nói được nó thuộc về đâu.
     */
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { slug } = require('../../../scripts/qa/knowledge_bootstrap.js');
    expect(slug('Xoá học sinh / 4.1.1 Hồ sơ học sinh (THPT)')).toBe('XOAHOCSINH');
    expect(slug('Chuyển lớp / Dữ liệu đi kèm')).toBe('CHUYENLOP');
    expect(slug('Chuyển lớp / Bộ lọc và nạp lưới'), 'hai biến thể cùng module ⇒ cùng slug').toBe('CHUYENLOP');
  });
});
