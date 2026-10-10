import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * @infra — `/start` (v2.5.0 G3.5): cửa vào cho người mới.
 *
 * VẤN ĐỀ NÓ CHỮA, và nó đo được: kit có **95 gate** và **25 skill**, không cái nào auto-load. Người mới
 * không biết bắt đầu từ đâu, và đường sai thì tốn cả lượt — `profile:create` đã có nhưng không ai biết nó
 * là bước đầu, và `preflight` thì dễ bị bỏ qua vì nó chưa chặn gì lúc chưa có input.
 *
 * `/start` KHÔNG thêm luật nào. Nó chỉ hỏi 5 điều rồi chỉ sang lệnh có sẵn. Hai thứ phải gác:
 *   ① ĐÚNG 5 câu hỏi — ít hơn thì thiếu thứ phải biết trước, nhiều hơn thì nó thành một workflow;
 *   ② KHÔNG được bỏ bước `preflight` — đó là chỗ bắt thiếu input và config hỏng.
 *
 * Mỗi câu hỏi phải có HẬU QUẢ ĐO ĐƯỢC, không phải "cho đủ bộ": `TASK_KEY`/`PROJECT_OUTPUT_DIR` là đúng
 * hai biến `requireValue` chặn · nguồn đặc tả là mẫu số coverage · captcha quyết định CI có tự đăng nhập
 * được không · một tài khoản thì case phân quyền ra `NEEDS_ACCOUNT` chứ không FAIL.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const CMD = path.join(REPO, '.claude/commands/start.md');
const body = () => fs.readFileSync(CMD, 'utf8');

test.describe('@infra /start — đúng 5 câu hỏi', () => {
  test('bảng câu hỏi có ĐÚNG 5 dòng, đánh số 1–5', () => {
    /*
     * Ít hơn 5 thì thiếu một thứ phải biết TRƯỚC khi chạy. Nhiều hơn thì `/start` thành một workflow, và
     * nó mất đúng công dụng "người mới hỏi một lần rồi chạy được".
     */
    const dong = body().split('\n').filter((d) => /^\| *[1-9] *\|/.test(d));
    expect(dong.length, `đếm được ${dong.length} câu hỏi`).toBe(5);
    expect(dong.map((d) => d.split('|')[1].trim())).toEqual(['1', '2', '3', '4', '5']);
  });

  test('mỗi câu hỏi phải nói VÌ SAO phải biết trước, không chỉ hỏi', () => {
    /* Câu hỏi không có lý do thì người mới trả lời cho xong, và giá trị của bước này về 0. */
    for (const d of body().split('\n').filter((x) => /^\| *[1-9] *\|/.test(x))) {
      const vs = d.split('|')[3] || '';
      expect(vs.trim().length, `câu "${d.split('|')[2].trim().slice(0, 40)}" thiếu lý do`).toBeGreaterThan(40);
    }
  });

  test('hai biến bắt buộc được gọi đúng tên, và nói rõ là ĐÚNG HAI', () => {
    /*
     * Đo được ở `.agent/config/env_lanes.json`: `requireValue` chỉ gác `PROJECT_OUTPUT_DIR` và `TASK_KEY`.
     * Người mới hay tưởng phải điền hết mọi biến trong `task.env.example` rồi mới chạy được.
     */
    const b = body();
    expect(b).toContain('TASK_KEY');
    expect(b).toContain('PROJECT_OUTPUT_DIR');
    expect(b, 'phải nói rõ chỉ có HAI biến bị chặn').toMatch(/đúng\*{0,2} hai|ĐÚNG HAI|đúng hai/i);
  });

  test('gom MỘT lần hỏi, không hỏi lắt nhắt', () => {
    /* Luật chung của kit: buộc hỏi thì gom hết vào một lần (RULE_GLOBAL §Execution Discipline). */
    expect(body()).toMatch(/gom thành\s*\*{0,2}MỘT lần hỏi/i);
  });
});

test.describe('@infra /start — KHÔNG được bỏ preflight', () => {
  test('có lệnh `preflight`, và nói rõ hậu quả nếu bỏ', () => {
    const b = body();
    expect(b).toMatch(/npm run preflight/);
    expect(b, 'phải nói KHÔNG được bỏ bước đó').toMatch(/KHÔNG bỏ bước preflight|KHÔNG bỏ qua bước preflight/);
    expect(b, 'và nói hậu quả: lỗi lộ ra giữa lượt execute như một FAIL giả').toMatch(/trông như bug/);
  });

  test('`preflight` đứng SAU `profile:create` — thứ tự ngược thì nó chặn vì chính profile chưa có', () => {
    const b = body();
    expect(b.indexOf('profile:create')).toBeLessThan(b.indexOf('npm run preflight'));
  });

  test('ba điều kiện DỪNG đều có mặt', () => {
    const b = body();
    expect(b).toMatch(/## Dừng khi/);
    expect(b, 'thiếu câu trả lời').toMatch(/Thiếu câu trả lời/);
    expect(b, 'preflight đỏ').toMatch(/preflight` exit ≠ 0/);
    expect(b, 'profile đã tồn tại').toMatch(/Profile đã tồn tại/);
  });

  test('cảnh báo profile dùng chung giữa hai task', () => {
    /*
     * Đã trả giá thật: phiên của task khác làm bước đổi đơn vị treo, và triệu chứng trông y như lỗi chọn
     * đơn vị của app. Người mới rất dễ chép `task.env` của task bên cạnh cho nhanh.
     */
    expect(body()).toMatch(/đừng lấy giá trị của task khác|dùng chung giữa hai task/);
  });
});

test.describe('@infra /start — lệnh nhắc tới phải chạy được THẬT', () => {
  test('`profile:create` tạo được profile, và KHÔNG ghi đè', () => {
    /*
     * Chạy thật chứ không tin tài liệu: `/start` dạy đúng hai lệnh, và nếu một lệnh không hoạt động như
     * command mô tả thì người mới đi vào đường chết ngay bước đầu.
     */
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'start-'));
    const run = (extra: string[] = []) => spawnSync(process.execPath,
      [path.join(REPO, 'scripts/utils/create_profile.js'), 'TMP-9999', '--project-output', d, ...extra],
      { cwd: REPO, encoding: 'utf8', env: gateEnv() });

    const r1 = run();
    const f = path.join(REPO, 'profiles/TMP-9999/task.env');
    try {
      expect(r1.status, `${r1.stdout}${r1.stderr}`).toBe(0);
      expect(fs.existsSync(f), 'phải tạo được profile').toBe(true);
      expect(fs.readFileSync(f, 'utf8'), 'phải prefill TASK_KEY').toMatch(/TMP-9999/);

      const r2 = run();
      expect(r2.status, 'lượt hai KHÔNG được ghi đè âm thầm').not.toBe(0);
      expect(`${r2.stdout}${r2.stderr}`).toMatch(/đã tồn tại|exists|--force/i);
    } finally {
      fs.rmSync(path.join(REPO, 'profiles/TMP-9999'), { recursive: true, force: true });
      fs.rmSync(d, { recursive: true, force: true });
    }
  });

  test('con số "95 gate · 25 skill" phải còn đúng — nếu lệch thì câu mở đầu dạy sai', () => {
    /*
     * Câu mở đầu của `/start` dùng hai con số để nói "không cần biết hết". Số sai thì nó thành một lời
     * khoe sai, và đó đúng là lớp lỗi G4.1 (tài liệu dạy sai số). Cho sai số ±5 để một gate mới không
     * làm đỏ oan.
     */
    const b = body();
    const nGate = Number((b.match(/(\d+) gate/) || [])[1]);
    const nSkill = Number((b.match(/(\d+) skill/) || [])[1]);

    /*
     * Đọc từ chính BẢNG đã sinh, không đọc stdout của `--check`: trên cây đang sửa dở, `gate_index
     * --check` in cảnh báo "source đang sửa dở" THAY VÌ con số, nên bản đầu của test này SKIP ở mọi lượt
     * chạy local — một test skip âm thầm thì không gác gì.
     */
    /*
     * Đếm MỌI dòng dữ liệu, trừ header và dòng gạch. Bản đầu chỉ khớp `| CHẶN |` và `| CẢNH BÁO |` nên
     * ra 0: bảng thật có bốn mức — `CHẶN` (35), `CHẶN (có cờ --enforce)` (32), `SINH` (18), `BÁO CÁO`
     * (10). Đoán hình dạng bảng rồi đếm là cách tự tạo ra một con số sai.
     */
    const gatesMd = fs.readFileSync(path.join(REPO, '.agent/config/GATES.md'), 'utf8');
    const gateThat = gatesMd.split(/\r?\n/).filter((l) => {
      if (!l.startsWith('| ')) return false;
      const c = l.split('|')[1].trim();
      return c !== 'Mức' && !/^[-: ]+$/.test(c);
    }).length;
    const s = spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/skills_index.js'), '--check'],
      { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    const skillThat = Number((`${s.stdout}${s.stderr}`.match(/(\d+) skill/) || [])[1]);

    expect(gateThat, 'không đếm được dòng gate nào trong GATES.md — sửa phép đếm').toBeGreaterThan(50);
    expect(skillThat, 'không đọc được số skill').toBeGreaterThan(10);
    expect(Math.abs(nGate - gateThat), `command ghi ${nGate} gate, thật là ${gateThat}`).toBeLessThanOrEqual(5);
    expect(Math.abs(nSkill - skillThat), `command ghi ${nSkill} skill, thật là ${skillThat}`).toBeLessThanOrEqual(5);
  });
});
