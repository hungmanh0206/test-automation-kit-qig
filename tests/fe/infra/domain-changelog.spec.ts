import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * @infra — NHẬT KÝ ĐỔI RULE (v2.5.0 G1.3b), nhận ý của A nhưng CHỈNH một chỗ bản chất.
 *
 * A dùng hệ mã `REQ-*` để truy vết requirement. B KHÔNG nhập nó: kit đã truy vết bằng `oracle_ref`, và
 * hai hệ mã song song là hai nguồn sẽ lệch nhau. Nên hạng mục này chỉ lấy phần A làm tốt hơn thật: **ghi
 * lại mỗi lần rule đổi**.
 *
 * GREP TRƯỚC KHI VIẾT cho thấy kit ĐÃ có gần hết: `version`, `status` + `invalidated_reason` (gỡ rule phải
 * đổi trạng thái, không xoá — đã gác từ trước), seal `content_sha` (sửa nội dung mà không bump
 * `confirmed_at` thì CHẶN), `covered_by`. Thiếu đúng một mắt xích:
 *
 *   `version` nói rule ĐÃ ĐỔI. `covered_by` nói TC nào ĐANG PHỦ rule.
 *   KHÔNG cái nào nói ĐỔI GÌ, và TC nào có expected bị lệch VÌ lần đổi này.
 *
 * Số đo 10/10/2026: 118 rule, **32 rule ở version ≥ 2** (30 ở v2, 1 ở v3, 1 ở v5) — rule đã đổi ít nhất
 * 32 lần mà không một dòng nào ghi lại. Vì vậy mức là CẢNH BÁO: chặn ngay là làm đỏ 32 rule rồi gate bị
 * tắt, đúng lớp lỗi "gate báo oan thì người ta tắt nó".
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const DR = path.join(REPO, 'scripts/qa/domain_rules.js');

const RULE = (over: Record<string, unknown> = {}) => ({
  id: 'BR-HOCSINH-002',
  module: 'Học sinh',
  rule: 'Email phải đúng định dạng có ký tự @ và tên miền',
  source: 'FSD v3 §4.2',
  confirmed_by: 'BA',
  confirmed_at: '2026-10-01',
  version: 2,
  status: 'active',
  covered_by: ['CSDL_HS_TC_088'],
  examples: [{ input: 'abc', expected: 'CHẶN, thông báo định dạng email' }],
  ...over,
});

function chay(rules: Record<string, unknown>[], changelog?: string) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'domchg-'));
  rules.forEach((r, i) => fs.writeFileSync(path.join(d, `r${i}.json`), JSON.stringify(r, null, 2), 'utf8'));
  if (changelog !== undefined) fs.writeFileSync(path.join(d, 'CHANGELOG.md'), changelog, 'utf8');
  /*
   * `--enforce` ở MỌI lượt: `domain:check` theo hai tầng của kit, không có cờ đó thì nó chỉ báo cáo và
   * luôn exit 0. Cảnh báo vẫn không chặn kể cả khi có `--enforce`, nên test cảnh báo vẫn mong exit 0 —
   * bản đầu của spec này quên cờ và 2 test "phải CHẶN" nhận exit 0.
   */
  const r = spawnSync(process.execPath, [DR, '--validate', '--enforce', '--dir', d], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}`, d };
}

const DONG = (id = 'BR-HOCSINH-002', ver = '1→2') => `# Nhật ký đổi rule

| Ngày | Rule | Version | Loại đổi | Nguồn | TC cần xử lý |
|---|---|---|---|---|---|
| 2026-10-10 | ${id} | ${ver} | siết điều kiện | FSD v3 §4.2 | CSDL_HS_TC_088 |
`;

test.describe('@infra domain:check — nhật ký đổi rule', () => {
  test('version ≥ 2 mà KHÔNG có nhật ký ⇒ CẢNH BÁO', () => {
    const r = chay([RULE()]);
    expect(r.out).toMatch(/CHANGELOG\.md/);
    expect(r.out, 'phải nói rõ `covered_by` KHÔNG thay được mắt xích này').toMatch(/covered_by.*ĐANG phủ/);
    expect(r.out, 'và chỉ đúng khuôn một dòng').toMatch(/\| ngày \| BR-…/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('CẢNH BÁO chứ không CHẶN — 32/118 rule đang thiếu, chặn là tắt gate', () => {
    const r = chay([RULE()]);
    expect(r.code, 'exit 0: đây là cảnh báo').toBe(0);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('ÂM BẢN: có dòng nhật ký đúng id + version ⇒ KHÔNG cảnh báo', () => {
    const r = chay([RULE()], DONG());
    expect(r.out, r.out).not.toMatch(/CHANGELOG\.md/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('ÂM BẢN: version 1 (chưa đổi lần nào) ⇒ KHÔNG đòi nhật ký', () => {
    const r = chay([RULE({ version: 1 })]);
    expect(r.out, r.out).not.toMatch(/CHANGELOG\.md/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('dòng nhật ký của version KHÁC không tính — phải khớp version ĐÍCH', () => {
    /*
     * Một dòng ghi cho `1→2` không nói gì về lần đổi `2→3`. Khớp lỏng theo id sẽ làm rule v3 trông như
     * đã có nhật ký, và đó đúng là chỗ mắt xích bị mất.
     */
    const r = chay([RULE({ version: 3 })], DONG('BR-HOCSINH-002', '1→2'));
    expect(r.out, 'v3 chưa có dòng ⇒ vẫn phải cảnh báo').toMatch(/CHANGELOG\.md/);
    fs.rmSync(r.d, { recursive: true, force: true });

    const ok = chay([RULE({ version: 3 })], DONG('BR-HOCSINH-002', '2→3'));
    expect(ok.out, 'có dòng cho v3 ⇒ sạch').not.toMatch(/CHANGELOG\.md/);
    fs.rmSync(ok.d, { recursive: true, force: true });
  });

  test('dòng nhật ký của rule KHÁC không tính', () => {
    const r = chay([RULE()], DONG('BR-HSLOP-017', '1→2'));
    expect(r.out).toMatch(/CHANGELOG\.md/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('GỘP một dòng khi nhiều rule thiếu — không in mỗi rule một dòng', () => {
    /*
     * Bản đầu push từng rule và ra 32 dòng gần như y nhau trên repo thật. Cùng lỗi đã gặp ở `bug_claim`
     * (23 dòng cảnh báo thiếu `build`). Cảnh báo lặp 32 lần thì người đọc cuộn qua.
     */
    const r = chay([
      RULE(), RULE({ id: 'BR-HOCSINH-003' }), RULE({ id: 'BR-HOCSINH-004' }),
      RULE({ id: 'BR-HOCSINH-005' }), RULE({ id: 'BR-HOCSINH-006' }),
    ]);
    const dong = r.out.split('\n').filter((d) => /CHANGELOG\.md/.test(d));
    expect(dong.length, 'phải gộp thành MỘT dòng').toBe(1);
    expect(dong[0]).toMatch(/^.*5 rule có/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });
});

test.describe('@infra domain:check — KHÔNG thêm hệ mã thứ hai', () => {
  test('kit không nhận `REQ-*` làm id rule', () => {
    /*
     * Đây là chỗ B CHỈNH bản chất so với A. Hai hệ mã song song (`oracle_ref` của B và `REQ-*` của A) là
     * hai nguồn truy vết, và chúng sẽ lệch nhau. `ID_RE` của kit chỉ nhận `BR-<MODULE>-<NNN>`.
     */
    const r = chay([RULE({ id: 'REQ-HOCSINH-002' })]);
    expect(r.code, 'id sai format phải CHẶN').toBe(1);
    expect(r.out).toMatch(/sai format/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('`knowledge/SCHEMA.md` khai khuôn nhật ký, và nói rõ vì sao không thêm `REQ-*`', () => {
    const sc = fs.readFileSync(path.join(REPO, 'knowledge/SCHEMA.md'), 'utf8');
    expect(sc).toMatch(/domain\/CHANGELOG\.md/);
    expect(sc, 'phải khai đủ 6 cột').toMatch(/Ngày \| Rule \| Version \| Loại đổi \| Nguồn \| TC cần xử lý/);
    expect(sc, 'và ghi rõ lý do KHÔNG thêm hệ mã thứ hai').toMatch(/REQ-\*/);
    expect(sc, 'kèm số đo làm căn cứ chọn mức cảnh báo').toMatch(/32\/118/);
  });

  test('luật "rule bỏ thì đổi status, không xoá" ĐÃ có máy gác từ trước', () => {
    /* Không viết lại — chỉ chứng minh nó còn hiệu lực, để không ai thêm bản thứ hai. */
    const r = chay([RULE({ status: 'invalid' })]);
    expect(r.code, 'thiếu `invalidated_reason` phải CHẶN').toBe(1);
    expect(r.out).toMatch(/invalidated_reason/);
    expect(r.out).toMatch(/invalidated_at/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('repo THẬT: 32 rule ở version ≥ 2 — số đo trong tài liệu phải còn đúng', () => {
    /*
     * Neo số đo vào máy. Khi ai đó bắt đầu ghi nhật ký, con số này tụt và tài liệu phải cập nhật theo.
     * Cho sai số rộng (±8) để một vài rule mới không làm đỏ oan.
     */
    const dir = path.join(REPO, 'knowledge/domain');
    if (!fs.existsSync(dir)) { test.skip(true, 'máy này chưa có knowledge/domain (lớp PROJECT)'); return; }
    let n = 0;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        if (Number.isInteger(j.version) && j.version >= 2) n += 1;
      } catch { /* file hỏng đã có phép kiểm riêng */ }
    }
    expect(Math.abs(n - 32), `đếm được ${n} rule ở version >= 2 (tài liệu ghi 32) ⇒ cập nhật số trong SCHEMA.md`).toBeLessThanOrEqual(8);
  });
});
