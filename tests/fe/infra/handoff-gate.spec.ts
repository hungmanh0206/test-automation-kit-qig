import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

/*
 * @infra — BÀN GIAO GIỮA PHASE (H1 của token-diet).
 *
 * VÌ SAO H1 ĐỨNG ĐẦU DANH SÁCH, và con số là lý do duy nhất: đo trên 4 lượt chạy task thật (CSDL-9001 đến
 * 9004) bằng `npm run token:audit` thì cache-hit là 98,5 đến 99,0%, context trung bình 494 đến 515k token
 * MỖI message, và một lượt có 6.121 đến 7.682 message. Chi phí tỉ lệ với context nhân số message. Chạy cả
 * Phase 1 và Phase 2 trong một phiên nghĩa là Phase 2 trả tiền cho hội thoại của Phase 1 ở mọi message còn
 * lại. Cắt phiên là cách DUY NHẤT hạ nhân tử context; cắt tài liệu prompt chỉ đổi được 2% của 500k.
 *
 * BA THỨ ĐƯỢC KHOÁ:
 *   ① Mức CẢNH BÁO, không CHẶN. Bộ task cũ không có file bàn giao nào. Một gate làm đỏ mọi task cũ sẽ bị
 *      tắt trong một ngày, và lúc đó luật mất hẳn. Nhưng phải KÊU: im lặng thì "chưa chạy phase trước" và
 *      "quên ghi bàn giao" trông giống hệt nhau.
 *   ② Khuôn bàn giao đọc từ config, không chép vào test. Thêm mục vào `handoff.json` là test tự đòi.
 *   ③ Prompt và slash command phải NÓI RA việc này. Máy kêu mà không chỗ nào dạy cách làm thì người chạy
 *      chỉ thấy một cảnh báo không biết xử lý thế nào.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { checkHandoff, taskDirCua } = require(path.join(REPO, 'scripts/qa/preflight_gate.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const CFG = require(path.join(REPO, '.agent/config/handoff.json'));

/** Nội dung bàn giao ĐỦ MỤC, dựng từ config để thêm mục là test tự theo. */
const duMuc = (them = '') =>
  `${CFG.truong.map((t: { neo: string }) => `${t.neo}\nnội dung thật ở đây\n`).join('\n')}${them}`;

function dungTask(files: Record<string, string> = {}) {
  const pod = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-'));
  const taskDir = path.join(pod, 'tasks', 'T-1');
  fs.mkdirSync(path.join(taskDir, 'handoff'), { recursive: true });
  for (const [f, body] of Object.entries(files)) fs.writeFileSync(path.join(taskDir, f), body, 'utf8');
  return { pod, taskDir };
}

function chay(mode: string, files: Record<string, string> = {}) {
  const { pod, taskDir } = dungTask(files);
  try { return checkHandoff(REPO, { mode, taskDir }) as string[]; } finally { fs.rmSync(pod, { recursive: true, force: true }); }
}

const loc = (xs: string[], re: RegExp) => xs.filter((x) => re.test(x));

test.describe('@infra bàn giao giữa phase — cảnh báo, không chặn', () => {
  test('② khuôn đọc từ config, và config khai đủ thứ máy cần', () => {
    expect(CFG.max_token, 'mốc độ dài phải là số, không phải lời dặn').toBeGreaterThan(0);
    expect(CFG.truong.length, 'bốn mục: trạng thái, artifact, việc còn mở, lệnh tiếp theo').toBe(4);
    for (const t of CFG.truong) {
      expect(String(t.neo)).toMatch(/^##\s/);
      expect(String(t.y || '').length, `${t.ten}: thiếu lời giải thích mục này để làm gì`).toBeGreaterThan(20);
    }
    expect(Object.keys(CFG.phase)).toEqual(['phase1', 'publish', 'phase2', 'rerun']);
    expect(CFG._truoc_la_canh_bao, 'quyết định mức CẢNH BÁO phải ghi trong config kèm lý do').toMatch(/CẢNH BÁO/);
  });

  test('① phase trước CHƯA có bàn giao: kêu, và nói rõ vì sao hội thoại cũ không dùng được', () => {
    const r = chay('phase2');
    const p = loc(r, /chưa có handoff\/phase1\.md/);
    expect(p.length).toBe(1);
    expect(p[0], 'phải nói hội thoại cũ không qua gate nào').toMatch(/không qua gate/);
    expect(p[0], 'và mất chi tiết sau khi nén').toMatch(/nén/);
  });

  test('mỗi phase đòi đúng phase TRƯỚC của nó, không đòi bừa', () => {
    expect(loc(chay('phase2'), /phase1\.md/).length, 'phase2 ← phase1').toBe(1);
    expect(loc(chay('rerun'), /phase2\.md/).length, 'rerun ← phase2').toBe(1);
    expect(loc(chay('publish'), /phase1\.md/).length, 'publish ← phase1').toBe(1);
    expect(chay('phase1'), 'phase1 là phase đầu, không có gì trước nó').toEqual([]);
  });

  test('CHỐNG BÁO OAN — có bàn giao đủ mục thì im lặng hoàn toàn', () => {
    const r = chay('phase2', { 'handoff/phase1.md': duMuc(), 'handoff/phase2.md': duMuc() });
    expect(r, 'một gate báo oan một lần là mất uy tín vĩnh viễn').toEqual([]);
  });

  test('bàn giao thiếu mục: kêu đúng tên mục thiếu', () => {
    const thieu = `${CFG.truong[0].neo}\nchỉ có mục đầu\n`;
    const r = chay('phase2', { 'handoff/phase1.md': duMuc(), 'handoff/phase2.md': thieu });
    const p = loc(r, /thiếu mục/);
    expect(p.length).toBe(1);
    for (const t of CFG.truong.slice(1)) expect(p[0]).toContain(t.ten);
    expect(p[0]).not.toContain(CFG.truong[0].ten);
  });

  test('bàn giao vượt mốc độ dài: kêu, vì nó đang thành bản báo cáo thứ hai', () => {
    const dai = duMuc('x'.repeat(CFG.max_token * 3.2 + 500));
    const r = chay('phase2', { 'handoff/phase1.md': duMuc(), 'handoff/phase2.md': dai });
    const p = loc(r, /vượt mốc/);
    expect(p.length).toBe(1);
    expect(p[0]).toContain(String(CFG.max_token));
    expect(p[0], 'phải chỉ chỗ đặt nội dung dài').toMatch(/reports\//);
  });

  test('không có TASK_KEY hoặc PROJECT_OUTPUT_DIR thì KHÔNG đoán thư mục task', () => {
    expect(taskDirCua('', 'T-1')).toBeNull();
    expect(taskDirCua('outputs/X', '')).toBeNull();
    expect(chay('phase2', {}).length).toBeGreaterThan(0);          // có taskDir ⇒ kiểm
    expect(checkHandoff(REPO, { mode: 'phase2', taskDir: null })).toEqual([]);   // không có ⇒ im
  });

  test('③ prompt và slash command phải DẠY cách làm, không chỉ để máy kêu', () => {
    /*
     * Mất phép kiểm này thì máy vẫn kêu nhưng không chỗ nào nói phải ghi gì và ghi vào đâu. Người chạy
     * gặp một cảnh báo không biết xử lý, và cách xử lý nhanh nhất của họ sẽ là bỏ qua nó.
     */
    for (const f of ['prompt_templates/run_phase1_template.md', 'prompt_templates/run_phase2_template.md',
      'prompt_templates/run_phase_re-run_template.md']) {
      const t = fs.readFileSync(path.join(REPO, f), 'utf8');
      expect(t, `${f}: không nhắc ghi bàn giao`).toMatch(/handoff\//);
      expect(t, `${f}: không nhắc /clear giữa hai phase`).toContain('/clear');
    }
    for (const f of ['.claude/commands/phase2.md', '.claude/commands/rerun.md', '.claude/commands/publish.md']) {
      const t = fs.readFileSync(path.join(REPO, f), 'utf8');
      expect(t, `${f}: không nhắc đọc handoff đầu lượt`).toMatch(/handoff\//);
      expect(t, `${f}: không nói rõ hội thoại cũ KHÔNG phải nguồn`).toMatch(/KHÔNG phải nguồn/);
    }
  });
});
