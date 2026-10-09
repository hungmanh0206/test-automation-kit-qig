import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * @infra — `[NeedsVerify]`: case chưa có nguồn chống lưng (H3).
 *
 * Luật này có một đặc điểm dễ cài sai, và cài sai thì nó phản tác dụng hoàn toàn:
 *
 *   Tag `[NeedsVerify]` SINH RA ĐỂ TỒN TẠI trong lúc Phase 1 chạy. Nó là cách người viết nói "chỗ này tôi
 *   chưa có bằng chứng". Nếu chặn ngay từ Phase 1 thì ta đang CẤM người ta thừa nhận, và cái họ làm sẽ là
 *   GỠ TAG chứ không phải đi tìm bằng chứng — mất luôn tín hiệu, và bộ TC trông sạch hơn thực tế.
 *
 *   Nên cửa đặt đúng ở ranh giới PUBLISH: lên Sheet rồi thì cả đội đọc case như một khẳng định chắc chắn.
 *
 * File này khoá đúng hai nửa đó. Mất nửa nào thì luật cũng hỏng theo một hướng khác nhau.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const GATE = path.join(REPO, 'scripts/qa/design_gate.js');

const HEAD = [
  '| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |',
  '|---|---|---|---|---|---|---|---|---|---|',
].join('\n');

const row = (id: string, tag: string) =>
  `| ${id} | Functional | ${tag} | M | ${id} nhãn nút Ghi | [api] Đã đăng nhập vai Trường | x=1 | 1. Mở màn | 1. Nút ghi chữ "Ghi" | High |`;

/** Dựng bộ testcase tạm rồi chạy design_gate đúng như pipeline chạy. */
function chay(rows: string[], args: string[] = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nv-'));
  const file = path.join(dir, 'bo.md');
  fs.writeFileSync(file, `# bộ\n\n${HEAD}\n${rows.join('\n')}\n`, 'utf8');
  try {
    const r = spawnSync(process.execPath, [GATE, '--file', file, ...args], {
      cwd: REPO, encoding: 'utf8', env: gateEnv() as NodeJS.ProcessEnv,
    });
    return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test.describe('@infra [NeedsVerify] — cảnh báo khi thiết kế, CHẶN khi publish', () => {
  test('Phase 1: còn [NeedsVerify] ⇒ CẢNH BÁO, KHÔNG chặn', () => {
    /*
     * Nửa quan trọng nhất. Chặn ở đây là cấm người viết thừa nhận mình chưa có bằng chứng, và họ sẽ gỡ tag
     * thay vì đi tìm — bộ TC trông sạch hơn thực tế, mà không ai biết.
     */
    const r = chay([row('M_TC_001', '[Positive][Display][NeedsVerify]')]);
    expect(r.code, 'Phase 1 KHÔNG được chặn vì tag này').toBe(0);
    expect(r.out).toMatch(/NeedsVerify/);
    expect(r.out, 'phải nói rõ publish sẽ chặn, để người viết biết hạn chót').toMatch(/[Pp]ublish/);
  });

  test('Publish: còn [NeedsVerify] ⇒ CHẶN', () => {
    const r = chay([row('M_TC_001', '[Positive][Display][NeedsVerify]')], ['--publish']);
    expect(r.code, 'lên Sheet rồi thì cả đội đọc case như khẳng định chắc chắn').toBe(1);
    expect(r.out).toMatch(/NeedsVerify/);
  });

  test('Publish: KHÔNG còn tag ⇒ đi qua (không chặn oan)', () => {
    const r = chay([row('M_TC_001', '[Positive][Display]')], ['--publish']);
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/NeedsVerify/);
  });

  test('--qa-approved vẫn là lối thoát, nhưng phải để lại dấu trong log', () => {
    const r = chay([row('M_TC_001', '[Positive][Display][NeedsVerify]')], ['--publish', '--qa-approved']);
    expect(r.code, 'QA chịu trách nhiệm thì cho qua').toBe(0);
    expect(r.out, 'nhưng phải ghi lại là đã bỏ qua, không im lặng').toMatch(/qa-approved/);
  });

  test('đếm đúng số case, không đếm nhầm cả bộ', () => {
    const r = chay([
      row('M_TC_001', '[Positive][Display][NeedsVerify]'),
      row('M_TC_002', '[Positive][Display]'),
      row('M_TC_003', '[Negative][Display][NeedsVerify]'),
    ]);
    expect(r.out).toMatch(/2\/3 case mang/);
    expect(r.out).toContain('M_TC_001');
    expect(r.out).toContain('M_TC_003');
  });

  test('luật THỨ TỰ NGUỒN nằm ở RULE_GLOBAL, không chép rải rác', () => {
    /*
     * Gói nguồn quy định ngược hẳn: "DOM thật > ảnh > tài liệu", và "ảnh thắng tài liệu". Kit đảo lại vì
     * DOM và ảnh CHÍNH LÀ app đang kiểm. Luật này phải ở canonical, không thì lần sau ai đọc gói nguồn sẽ
     * làm theo nó mà không biết kit đã quyết khác.
     */
    const rg = fs.readFileSync(path.join(REPO, 'RULE_GLOBAL.md'), 'utf8');
    expect(rg, 'thiếu luật thứ tự nguồn').toMatch(/THỨ TỰ NGUỒN KHI DỰNG ORACLE/);
    expect(rg, 'phải nói rõ ảnh và DOM KHÔNG phán đúng-sai').toMatch(/KHÔNG phải nguồn đúng-sai/);
    expect(rg, 'phải nêu bốn nhóm bắt buộc có nguồn chống lưng').toMatch(/Bốn nhóm case BẮT BUỘC/);
    expect(rg, 'lệch nguồn phải thành câu hỏi, không tự chọn bên').toMatch(/CÂU HỎI Ambiguity Gate/);
  });

  test('luật "ô khoá là business rule chưa ai viết ra" nằm ở chiều field validation', () => {
    const fv = fs.readFileSync(path.join(REPO, 'prompt_templates/phase1/dimensions/03_field_validation.md'), 'utf8');
    expect(fv).toMatch(/disabled/i);
    expect(fv, 'phải đòi case cho CẢ HAI chiều').toMatch(/cả hai chiều/i);
    expect(fv, 'và phải mở câu hỏi chứ không đoán ra rule').toMatch(/Ambiguity Gate/);
  });
});
