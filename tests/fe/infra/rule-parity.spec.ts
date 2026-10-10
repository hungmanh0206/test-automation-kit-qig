import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * @infra — RÚT GỌN `core_rules.md` MÀ KHÔNG MẤT LUẬT NÀO.
 *
 * `core_rules.md` auto-load MỌI phiên, nên nó là chỗ đắt nhất của kit — rút gọn nó là nguồn cắt bù
 * chính của v2.5.0. Nhưng rút gọn một file luật là thao tác dễ mất mát nhất, và mất mát KHÔNG tự lộ
 * ra: một luật biến mất thì không gì đỏ, chỉ là vài tháng sau có người làm sai thứ kit từng cấm.
 *
 * PHÉP KIỂM THẬT KHÔNG PHẢI "TÊN LUẬT CÒN ĐÓ". Giữ nguyên cái tên rồi xoá sạch nội dung vẫn qua được
 * phép đó. Phép thật là: **mỗi luật phải có con trỏ GIẢI ĐƯỢC** tới nơi giữ chi tiết — rút gọn hợp lệ
 * nghĩa là chi tiết CHUYỂN đi, không phải BIẾN MẤT.
 *
 * ĐO ĐƯỢC NGAY LÚC DỰNG, và đây là lý do phải làm theo thứ tự này: 7 trong 35 luật trỏ tới mục
 * `RULE_GLOBAL §…` KHÔNG TỒN TẠI, một luật không có con trỏ nào. Rút gọn chúng trước khi vá là xoá
 * luật. Nên v2.5.0 vá nhà trước (thêm 4 mục vào RULE_GLOBAL, trỏ lại 3 cái), rồi mới cắt.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const RP = path.join(REPO, 'scripts/qa/rule_parity.js');
const CORE = path.join(REPO, '.agent/rules/core_rules.md');

function chay(argv: string[] = []) {
  const r = spawnSync(process.execPath, [RP, ...argv], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

test.describe('@infra rule:parity — rút gọn core_rules không được mất luật', () => {
  test('repo hiện tại: ĐẠT, và mọi con trỏ đều giải được', () => {
    const r = chay(['--enforce']);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('không mất luật');
  });

  test('MỖI luật phải có con trỏ, và con trỏ phải trỏ tới thứ CÓ THẬT', () => {
    /*
     * Neo vào chính file: mọi gạch đầu dòng luật phải mang hoặc một `RULE_GLOBAL §…`, hoặc một đường
     * dẫn file. Đây là điều kiện để câu "chi tiết giữ ở RULE_GLOBAL" là thật chứ không phải lời hứa.
     */
    const dong = fs.readFileSync(CORE, 'utf8').replace(/\r\n?/g, '\n').split('\n')
      .filter((d) => /^- \*\*/.test(d));
    expect(dong.length, 'core_rules phải còn luật').toBeGreaterThan(20);
    const khongNeo = dong
      .filter((d) => !/RULE_GLOBAL/.test(d) && !/`[a-zA-Z0-9_./-]+\.(md|json|js|ts)`/.test(d))
      .map((d) => (d.match(/^- \*\*(.+?)\*\*/) || [])[1]);
    expect(khongNeo, 'luật không có con trỏ thì rút gọn là xoá luật').toEqual([]);
  });

  test('ÂM BẢN: xoá một luật ⇒ CHẶN, và gọi đúng tên luật đã mất', () => {
    /*
     * Chứng minh phép kiểm không vô nghĩa. Không sửa file thật: dựng một cây tạm có `core_rules.md`
     * thiếu một luật, rồi chạy `rule_parity` trong đó.
     */
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-'));
    try {
      for (const sub of ['.agent/rules', '.agent/config', 'scripts/qa']) {
        fs.mkdirSync(path.join(d, sub), { recursive: true });
      }
      const goc = fs.readFileSync(CORE, 'utf8').replace(/\r\n?/g, '\n').split('\n');
      const iLuat = goc.findIndex((x) => /^- \*\*/.test(x));
      const tenMat = (goc[iLuat].match(/^- \*\*(.+?)\*\*/) || [])[1];
      fs.writeFileSync(path.join(d, '.agent/rules/core_rules.md'),
        goc.filter((_, i) => i !== iLuat).join('\n'), 'utf8');
      fs.copyFileSync(path.join(REPO, 'RULE_GLOBAL.md'), path.join(d, 'RULE_GLOBAL.md'));
      fs.copyFileSync(path.join(REPO, '.agent/config/rule_parity.json'), path.join(d, '.agent/config/rule_parity.json'));
      fs.copyFileSync(RP, path.join(d, 'scripts/qa/rule_parity.js'));

      const r = spawnSync(process.execPath, [path.join(d, 'scripts/qa/rule_parity.js'), '--enforce'],
        { cwd: d, encoding: 'utf8', env: gateEnv() });
      const out = `${r.stdout || ''}${r.stderr || ''}`;
      expect(r.status, out).toBe(1);
      expect(out).toContain('MẤT LUẬT');
      expect(out, 'phải gọi đúng tên luật đã mất, không báo chung chung').toContain(tenMat!);
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('mốc ghi lại số đo TRƯỚC khi cắt, để lần sau đối chiếu được', () => {
    const m = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/rule_parity.json'), 'utf8'));
    expect(Array.isArray(m.ten_luat) && m.ten_luat.length, 'mốc phải liệt kê tên luật').toBeTruthy();
    expect(m._do_luc_chot?.token_uoc, 'mốc phải mang số token lúc chốt').toBeGreaterThan(0);
    expect(String(m._cach_chot_lai || ''), 'phải nói cách chốt lại, và rằng chốt lại cần lý do').toMatch(/--lock/);
  });

  test('`prompt:budget` ghi nhận phần cắt, và mốc đã hạ theo', () => {
    /* Cắt được mà không hạ mốc thì lần sau có người tiêu lại đúng phần vừa tiết kiệm. */
    const cfg = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/prompt_budget.json'), 'utf8'));
    expect(cfg.moc.phase2, 'mốc phase2 phải đã hạ sau khi rút core_rules').toBeLessThan(30519);
    expect(String(cfg._moc_ha_khi_nao || ''), 'phải ghi lại vì sao hạ mốc').toMatch(/core_rules/);
  });
});
