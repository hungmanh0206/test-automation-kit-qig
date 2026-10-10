import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * @infra — NGÂN SÁCH TOKEN CHO HƯỚNG DẪN CỦA CHÍNH KIT (H9 của token-diet).
 *
 * Vì sao: H1 đến H5 cắt được chi phí một lượt chạy, nhưng không gì giữ lại thành quả. Tài liệu phình trở
 * lại là chuyện của vài tuần, và nó phình bằng cách mỗi lần thêm vài dòng hợp lý.
 *
 * BA THỨ ĐƯỢC KHOÁ:
 *   ① KIỂM-ÂM. Thêm token vào một thẻ chạy thì gate phải ĐỎ. Một gate ngân sách chưa từng đỏ thì không ai
 *      biết nó còn sống — và nó là loại gate dễ chết nhất, vì nó chỉ đỏ khi có người làm tài liệu phình.
 *   ② ĐO THEO LỜI KHAI. Ngân sách tính theo `bat_buoc` trong `load_map.json`, KHÔNG theo cột `batBuoc` mà
 *      `prompt_budget` tự suy. Cột tự suy chỉ nhận file depth 0 nên ra ~5,6k cho mọi điểm vào; chặn theo
 *      nó là chặn theo một phép đo mà chính máy đó đã tuyên bố không đáng tin.
 *   ③ NGƯỠNG ĐẶT TRÊN MỨC HIỆN TẠI. H9 là chốt chống trôi, không phải roi dọn nợ. Ngưỡng đã đỏ ngay hôm
 *      đặt là tiếng ồn, và tiếng ồn thì bị tắt.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const BUDGET = path.join(REPO, 'scripts/qa/prompt_budget.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const CFG = require(path.join(REPO, '.agent/config/prompt_budget.json'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MAP = require(path.join(REPO, '.agent/config/load_map.json'));

const chay = (args: string[] = []) => {
  const r = spawnSync(process.execPath, [BUDGET, ...args], {
    cwd: REPO, encoding: 'utf8', env: gateEnv() as NodeJS.ProcessEnv,
  });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};

/**
 * Dựng CÂY TẠM mang đúng những file mà `load_map` và `prompt_budget` nhắc tới, rồi đo trên đó.
 *
 * Vì sao không sửa file thật rồi trả lại: Playwright chạy song song theo FILE, nên một spec khác đọc
 * `run_phase1_template.md` trong lúc nó đang phình sẽ đỏ ngẫu nhiên. Kiểm-âm không được có tác dụng lề.
 */
function dungCayTam(phinhThem: Record<string, number> = {}) {
  const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-'));
  const chep = (rel: string) => {
    const src = path.join(REPO, rel);
    if (!fs.existsSync(src)) return;
    const dst = path.join(goc, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    const them = phinhThem[rel];
    const body = fs.readFileSync(src, 'utf8');
    fs.writeFileSync(dst, them ? `${body}\n\n<!-- ${'x'.repeat(Math.round(them * 3.2))} -->\n` : body, 'utf8');
  };

  for (const f of ['CLAUDE.md', '.agent/rules/core_rules.md',
    '.agent/config/load_map.json', '.agent/config/prompt_budget.json']) chep(f);
  for (const f of Object.keys(CFG.the_chay)) chep(f);
  for (const l of Object.values<Record<string, unknown>>(MAP.luong)) {
    if (typeof l.diem_vao === 'string') chep(l.diem_vao);
    for (const f of (l.bat_buoc as string[] | undefined) || []) chep(f);
  }
  // `.claude/commands/` cần tồn tại, nếu không máy thoát sớm với exit 2.
  fs.mkdirSync(path.join(goc, '.claude/commands'), { recursive: true });
  for (const f of fs.readdirSync(path.join(REPO, '.claude/commands'))) chep(`.claude/commands/${f}`);
  return goc;
}

test.describe('@infra prompt:budget --enforce', () => {
  test('hôm nay ĐẠT — ngưỡng đặt trên mức hiện tại, không phải mức mong muốn', () => {
    const r = chay(['--enforce']);
    expect(r.code, 'gate ngân sách đỏ ngay hôm đặt là tiếng ồn').toBe(0);
    expect(r.out).toMatch(/✓ ĐẠT/);
    for (const ten of Object.keys(CFG.luong)) expect(r.out).toContain(ten);
  });

  test('② đo theo `bat_buoc` của load_map, không theo cột tự suy', () => {
    const src = fs.readFileSync(BUDGET, 'utf8');
    expect(src, '--enforce phải đọc load_map').toMatch(/load_map\.json/);
    expect(src, 'và phải nói rõ vì sao không dùng cột tự suy').toMatch(/không đáng tin/);
    // Mọi luồng có ngưỡng đều phải tồn tại trong load_map, nếu không ngưỡng đó gác hư không.
    for (const ten of Object.keys(CFG.luong)) {
      expect(MAP.luong[ten], `ngưỡng khai cho luồng "${ten}" mà load_map không có luồng đó`).toBeTruthy();
      expect(MAP.luong[ten].bat_buoc, `${ten}: load_map thiếu khối bat_buoc`).toBeTruthy();
    }
  });

  test('mọi thẻ chạy khai trong ngân sách đều TỒN TẠI', () => {
    for (const f of Object.keys(CFG.the_chay)) {
      expect(fs.existsSync(path.join(REPO, f)), `thẻ chạy không tồn tại: ${f}`).toBe(true);
    }
  });

  test('① KIỂM-ÂM — thêm 5k token vào một thẻ chạy thì ĐỎ', () => {
    /*
     * Phép kiểm quan trọng nhất. Một gate ngân sách chưa từng đỏ thì không ai biết nó còn sống, và nó là
     * loại gate dễ chết nhất: nó chỉ đỏ khi có người làm tài liệu phình.
     */
    const f = Object.keys(CFG.the_chay)[0];
    const goc = dungCayTam({ [f]: 5000 });
    try {
      const r = chay(['--root', goc, '--enforce']);
      expect(r.code, 'phình quá ngưỡng mà gate không đỏ thì gate đã chết').toBe(1);
      expect(r.out).toMatch(/VƯỢT NGƯỠNG/);
      expect(r.out).toContain(f);
      expect(r.out, 'phải chỉ đường ra, và chỉ rõ đường KHÔNG được đi').toMatch(/KHÔNG nới số/);
    } finally {
      fs.rmSync(goc, { recursive: true, force: true });
    }
  });

  test('cây tạm KHÔNG phình thì ĐẠT — chứng minh cây tạm không tự làm đỏ', () => {
    /*
     * Chống dương tính giả của chính phép kiểm-âm: nếu cây tạm thiếu file thì nó đỏ vì chuyện khác, và
     * test trên sẽ xanh vì lý do sai.
     */
    const goc = dungCayTam();
    try {
      const r = chay(['--root', goc, '--enforce']);
      expect(r.code, `cây tạm phải ĐẠT khi không phình. Output: ${r.out.slice(-400)}`).toBe(0);
    } finally {
      fs.rmSync(goc, { recursive: true, force: true });
    }
  });

  test('KIỂM-ÂM thứ hai — vượt ngưỡng của cả LUỒNG thì cũng đỏ', () => {
    /*
     * Hai đường chặn khác nhau: một theo từng thẻ chạy, một theo tổng của luồng. Một luồng có thể vượt
     * tổng trong khi không thẻ nào vượt riêng, nên phải khoá riêng.
     */
    const f = MAP.luong.publish.bat_buoc[0] as string;
    const goc = dungCayTam({ [f]: 4000 });
    try {
      const r = chay(['--root', goc, '--enforce']);
      expect(r.code).toBe(1);
      expect(r.out, 'phải nêu tên luồng vượt, không chỉ tên file').toMatch(/luồng publish/);
    } finally {
      fs.rmSync(goc, { recursive: true, force: true });
    }
  });

  test('thiếu file ngưỡng thì TỪ CHỐI chặn, không im lặng đi qua', () => {
    const goc = dungCayTam();
    try {
      fs.rmSync(path.join(goc, '.agent/config/prompt_budget.json'));
      const r = chay(['--root', goc, '--enforce']);
      expect(r.code, 'không có ngưỡng thì phải exit 2 (dùng sai), không phải 0').toBe(2);
      expect(r.out).toMatch(/TỪ CHỐI --enforce/);
    } finally {
      fs.rmSync(goc, { recursive: true, force: true });
    }
  });

  test('③ ngưỡng và mức hiện tại đều được GHI LẠI trong config', () => {
    /*
     * Không ghi mức hiện tại thì lần sau không ai biết ngưỡng được đặt cao hơn thực tế bao nhiêu, và
     * việc nới ngưỡng sẽ trông như việc bình thường.
     */
    /*
     * ĐỒI NGUỒN, không nới phép kiểm. Mức hiện tại từng nằm trong một CÂU VĂN (`_luong_hien_tai`), và
     * câu đó đã lệch thật: nó ghi phase2 30,4k trong khi số đo là 30.519. Hai chỗ khai cùng một con số
     * thì sớm muộn lệch nhau. Nay mức hiện tại nằm ở `moc` — MÁY ĐỌC ĐƯỢC và chính gate so vào nó —
     * nên đối chiếu vào đó chặt hơn là đòi một câu văn có chứa chứ "phase1".
     */
    expect(Object.keys(CFG.moc || {}), 'thiếu mức hiện tại của từng luồng').toContain('phase1');
    expect(String(CFG._luong_hien_tai), 'phải trỏ về `moc` thay vì ghi lại số lần thứ hai').toMatch(/moc/);
    expect(CFG._the_chay_hien_tai, 'thiếu mức hiện tại của từng thẻ chạy').toMatch(/core_rules/);
    expect(CFG._nguong_dat_o_dau, 'phải ghi vì sao đặt trên mức hiện tại').toMatch(/chống trôi/);
    expect(CFG._khong_noi_nguong, 'phải cấm nới ngưỡng, bằng chữ').toMatch(/KHÔNG nới/);
    expect(String(CFG._nguong_dat_o_dau), 'phải nhắc mục tiêu 18k cần H7, và H7 đã hoãn').toMatch(/18k/);
  });

  test('CI của CẢ HAI remote đều gọi gate này', () => {
    const gh = fs.readFileSync(path.join(REPO, '.github/workflows/static-check.yml'), 'utf8');
    const gl = fs.readFileSync(path.join(REPO, '.gitlab-ci.yml'), 'utf8');
    for (const [ten, t] of [['GitHub', gh], ['GitLab', gl]] as const) {
      expect(t, `${ten} CI không gọi prompt:budget --enforce`).toMatch(/prompt:budget -- --enforce/);
    }
  });

  /*
   * ── MỐC: phần nạp BẮT BUỘC không được TĂNG ────────────────────────────────────────────────────
   *
   * Trần (`luong`) đặt ngay TRÊN mức hiện tại để không đỏ oan ngày đặt. Nhưng chính vì vậy nó còn
   * chỗ trống: đo 10/10/2026, phase1 còn 1,2k và phase2 còn 1,5k dưới trần. Một đợt thêm chữ vẫn đi qua
   * gate mà vẫn làm MỊI phiên đắt hơn. Trần chặn chuyện phình TO; nó không chặn chuyện phình DẦN.
   */
  test('MỐC: mọi luồng trong load_map đều có mốc — thiếu một cái là luồng đó chưa được gác', () => {
    const luong = Object.keys(MAP.luong || {}).filter((t) => (MAP.luong as any)[t].bat_buoc);
    const thieu = luong.filter((t) => typeof (CFG.moc || {})[t] !== 'number');
    expect(thieu, 'luồng không có mốc thì phép kiểm "không được tăng" không áp được vào nó').toEqual([]);
  });

  test('MỐC phải là số ĐÃ ĐO, không phải số mong muốn — đứng dưới trần và khớp số thực', () => {
    /*
     * Mốc đặt cao hơn số thực là cho sẵn chỗ để phình — đúng thứ mốc sinh ra để chặn. Đặt thấp hơn số
     * thực thì gate đỏ ngay hôm đặt, và một gate đỏ sẵn là tiếng ồn rồi bị tắt.
     */
    const r = spawnSync(process.execPath, [BUDGET, '--enforce'], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    const out = `${r.stdout || ''}${r.stderr || ''}`;
    expect(r.status, out).toBe(0);
    for (const t of Object.keys(CFG.moc || {})) {
      expect((CFG.moc as any)[t], `mốc ${t} phải dưới trần`).toBeLessThanOrEqual((CFG.luong as any)[t]);
    }
    expect(out, 'phải in rõ đang so với mốc, không chỉ so với trần').toContain('mốc');
  });

  test('ÂM BẢN: phần bắt buộc vượt mốc 1 token ⇒ CHẶN, dù còn xa trần', () => {
    /*
     * Hạ mốc đi 1 token trên một BẢN COPY của config — tương đương việc thêm đúng 1 token vào phần bắt
     * buộc. Dùng `--cfg` chứ không sửa file thật: sửa rồi hoàn lại mà hỏng giữa đường là để lại một mốc sai.
     */
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'moc-'));
    const f = path.join(d, 'budget.json');

    /*
     * ĐO TRƯỚC RỒI MỚI HẠ MỐC, không hạ từ số đã ghi.
     *
     * Bản đầu làm `moc.phase1 - 1`, và nó im lặng ngừng đo ngay khi luồng đó tụt xuống DƯỚI mốc: hạ mốc
     * đi 1 vẫn còn cao hơn số thực nên không có gì bị chặn, và âm bản XANH trong khi nó không đo gì cả.
     * Đúng lần cắt bù ở v2.4.1 phần D thì phase1 xuống dưới mốc, và test này đỏ — may là nó đỏ.
     */
    const dq = spawnSync(process.execPath, [BUDGET, '--moc'], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    const mm = `${dq.stdout || ''}`.match(/\{[\s\S]*?\}/);
    expect(mm, '`--moc` phải in được số đo hiện tại').toBeTruthy();
    const doDuoc = JSON.parse(mm![0]);

    const nan = JSON.parse(JSON.stringify(CFG));
    nan.moc.phase1 = doDuoc.phase1 - 1;   // thấp hơn số THỰC đúng 1 token
    fs.writeFileSync(f, JSON.stringify(nan, null, 2), 'utf8');
    try {
      const r = spawnSync(process.execPath, [BUDGET, '--enforce', '--cfg', f], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
      const out = `${r.stdout || ''}${r.stderr || ''}`;
      expect(r.status, out).toBe(1);
      expect(out).toContain('TĂNG');
      expect(out, 'phải chỉ đường ra, không chỉ báo sai').toContain('CẮT BÙ');
      expect(out, 'lỗi phải nói về luồng bị đụng, không nói chung chung').toContain('phase1');
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('ÂM BẢN: mốc chết (luồng không còn trong load_map) ⇒ CHẶN', () => {
    /* Một mốc trỏ tới luồng đã bỏ làm bảng số nói dối mà không ai biết. */
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'moc-chet-'));
    const f = path.join(d, 'budget.json');
    const nan = JSON.parse(JSON.stringify(CFG));
    nan.moc['luong-khong-ton-tai'] = 1000;
    fs.writeFileSync(f, JSON.stringify(nan, null, 2), 'utf8');
    try {
      const r = spawnSync(process.execPath, [BUDGET, '--enforce', '--cfg', f], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
      const out = `${r.stdout || ''}${r.stderr || ''}`;
      expect(r.status, out).toBe(1);
      expect(out).toContain('luong-khong-ton-tai');
      expect(out).toContain('mốc chết');
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('`--moc` in được số đo hiện tại để chốt lại — không bắt ai tự đếm', () => {
    const r = spawnSync(process.execPath, [BUDGET, '--moc'], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    const out = `${r.stdout || ''}${r.stderr || ''}`;
    for (const t of Object.keys(MAP.luong || {})) {
      if (!(MAP.luong as any)[t].bat_buoc) continue;
      expect(out, `phải in số đo của ${t}`).toContain(`"${t}"`);
    }
  });


  test('XUỐNG DÒNG không được làm đổi số đo — CRLF và LF phải ra cùng một con số', () => {
    /*
     * LỖI THẬT của chính gate này, bắt được 10/10/2026.
     *
     * `tok()` đếm cả ký tự `\r`. Một file 380 dòng mang theo 380 byte thuần tuý do xuống dòng, khoảng
     * 119 token. `git worktree add` trên Windows checkout ra CRLF, còn vài file trong cây làm việc là LF,
     * nên CÙNG MỘT COMMIT đo ra hai số lệch 175 token.
     *
     * Hậu quả đúng kiểu tệ nhất: mốc chặn OAN người vừa checkout, và KHÔNG chặn người thực sự thêm chữ.
     * `writing_lint.js` đã học đúng bài này từ 28/09/2026 (ghi chú trong `prose()`), gate này thì chưa.
     */
    const noiDung = Array.from({ length: 200 }, (_, i) => `dòng số ${i} có nội dung`).join('\n');
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'eol-'));
    const aLf = path.join(d, 'lf.md');
    const bCrlf = path.join(d, 'crlf.md');
    fs.writeFileSync(aLf, noiDung, 'utf8');
    fs.writeFileSync(bCrlf, noiDung.replace(/\n/g, '\r\n'), 'utf8');

    try {
      /* Gọi thẳng `tok` qua một tiến trình con — đo ĐÚNG hàm gate dùng, không dựng lại phép đếm ở đây. */
      const js = `
        const fs = require('fs');
        const CHARS_PER_TOK = 3.2;
        const src = fs.readFileSync(${JSON.stringify(BUDGET)}, 'utf8');
        const m = src.match(/const tok = ([^;]+);/);
        if (!m) { console.log('KHONG TIM THAY tok'); process.exit(3); }
        const tok = eval(m[1]);
        const a = tok(fs.readFileSync(${JSON.stringify(aLf)}, 'utf8'));
        const b = tok(fs.readFileSync(${JSON.stringify(bCrlf)}, 'utf8'));
        console.log(JSON.stringify({ lf: a, crlf: b }));
      `;
      const r = spawnSync(process.execPath, ['-e', js], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
      const out = `${r.stdout || ''}`.trim();
      expect(out, `${r.stderr || ''}`).toMatch(/^\{/);
      const { lf, crlf } = JSON.parse(out);
      expect(crlf, 'CRLF và LF phải ra cùng số — khác nhau là mốc chặn oan theo kiểu checkout').toBe(lf);
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('MỐC phải đo trên worktree SẠCH, và config phải nói rõ điều đó', () => {
    /* Mốc đo trên cây làm việc là mốc của một cây không ai khác có — đúng lỗi đã mắc một lần ở đây. */
    expect(String(CFG._moc_do_tu_dau || ''), 'config phải khai mốc đo ở đâu').toMatch(/worktree/i);
    expect(String(CFG._moc_do_tu_dau || ''), 'phải ghi lại cả lần đo sai, không xoá dấu vết').toMatch(/CRLF/);
  });

});
