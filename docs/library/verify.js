#!/usr/bin/env node
/**
 * verify.js — nghiệm thu trang đã build bằng Playwright THẬT, không phải đọc code rồi đoán.
 * Chạy: node docs/library/build.js && node docs/library/verify.js
 *
 * Vì sao nằm trong repo chứ không phải thư mục tạm: mỗi lần kit đổi thì trang phải build và kiểm lại;
 * để ở thư mục tạm thì lần sau mất script, và người sau lại kiểm bằng mắt.
 *
 * Thoát 0 = mọi phép kiểm đạt · 1 = có phép kiểm hỏng (in rõ cái nào).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));

const FILE = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');
const SHOTS = process.env.SHOTS_DIR || null;   // đặt biến này nếu muốn lưu ảnh

// Chữ ký vùng TRUNG TÂM canvas. Góc trên-trái vốn trống nên so ở đó là vô nghĩa —
// đã từng làm phép kiểm "tự quay" báo sai vì lý do này.
const SIG = `(() => {
  const c = document.querySelector('#graph'); if (!c) return 'no-canvas';
  const g = c.getContext('2d');
  const w = Math.floor(c.width * 0.5), h = Math.floor(c.height * 0.5);
  const d = g.getImageData(Math.floor(c.width * 0.25), Math.floor(c.height * 0.25), w, h).data;
  let n = 0, s = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 12) { n++; s += i; }
  return n + ':' + s;
})()`;

const fails = [];
const ok = (name, cond, got) => {
  if (cond) console.log('  ✓ ' + name);
  else { console.log('  ✗ ' + name + (got !== undefined ? '  → ' + JSON.stringify(got) : '')); fails.push(name); }
};

(async () => {
  const browser = await chromium.launch();
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('requestfailed', r => errs.push('REQFAIL: ' + r.url()));

  await p.goto(FILE, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1100);
  const shot = n => SHOTS ? p.screenshot({ path: path.join(SHOTS, n) }) : Promise.resolve();

  console.log('\n[1] Nạp trang');
  ok('không có lỗi console / pageerror / request hỏng', errs.length === 0, errs);
  /* Đừng chốt số tab bằng hằng số — thêm tab là phép kiểm đỏ oan (đã xảy ra khi thêm tab Hành trình).
     Kiểm quan hệ thay vì con số: mỗi nút tab phải có đúng một panel tương ứng, và ngược lại. */
  const tabModes = await p.$$eval('.mode', (ns) => ns.map((n) => n.dataset.mode));
  const panelIds = await p.$$eval('.panel', (ns) => ns.map((n) => n.id.replace(/^p-/, '')));
  ok('mỗi tab có đúng một panel và ngược lại',
     tabModes.length > 0 && tabModes.length === panelIds.length &&
     tabModes.every((m) => panelIds.includes(m)),
     { tabModes, panelIds });
  ok('canvas 3D đã vẽ', (await p.evaluate(SIG)).split(':')[0] !== '0');
  await shot('01-graph.png');

  console.log('\n[2] Bản đồ 3D');
  const a = await p.evaluate(SIG); await p.waitForTimeout(900);
  const b = await p.evaluate(SIG); await p.waitForTimeout(900);
  const c = await p.evaluate(SIG);
  ok('tự quay: 3 khung liên tiếp khác nhau', a !== b && b !== c);
  const bx = await p.locator('#graph').boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await p.mouse.down();
  await p.mouse.move(bx.x + bx.width / 2 + 200, bx.y + bx.height / 2 + 50, { steps: 10 });
  await p.mouse.up();
  await p.waitForTimeout(600);
  const d1 = await p.evaluate(SIG); await p.waitForTimeout(1400);
  ok('kéo một lần rồi thì tự quay DỪNG hẳn', d1 === await p.evaluate(SIG));
  const before = (await p.evaluate(SIG)).split(':')[0] | 0;
  await p.locator('#legend .lg').first().click(); await p.waitForTimeout(500);
  ok('ẩn một cụm thì số pixel giảm', ((await p.evaluate(SIG)).split(':')[0] | 0) < before);
  await p.locator('#legend .lg').first().click(); await p.waitForTimeout(300);
  await p.locator('#z3d').click(); await p.waitForTimeout(1200);
  ok('nút chuyển sang chế độ phẳng', await p.locator('#z3d').innerText() === '2D');
  const f1 = await p.evaluate(SIG); await p.waitForTimeout(1300);
  ok('chế độ phẳng KHÔNG tự quay', f1 === await p.evaluate(SIG));
  await p.locator('#z3d').click(); await p.waitForTimeout(1200);
  ok('quay lại được chế độ 3D', await p.locator('#z3d').innerText() === '3D');

  console.log('\n[3] Tra cứu A–Z');
  await p.locator('.mode[data-mode="az"]').click(); await p.waitForTimeout(400);
  const total = await p.locator('.tcard').count();
  ok('có thẻ thuật ngữ', total > 100, total);
  ok('MỌI thẻ có dòng "vì sao"', await p.locator('.tcard p.why:not(:empty)').count() === total);
  ok('MỌI thẻ ghi nguồn trong repo', await p.locator('.tcard .cfoot:not(:empty)').count() === total);
  await p.fill('#q', 'oracle doc lap'); await p.waitForTimeout(300);
  ok('tìm không dấu ra được từ có chữ đ', await p.locator('.tcard').count() > 0);
  await p.locator('.tcard').first().click(); await p.waitForTimeout(400);
  ok('drawer mở đúng mục', await p.locator('#dTitle').innerText() === 'Oracle độc lập');
  ok('drawer có khối "vì sao"', await p.locator('#secWhy:not([hidden])').count() === 1);
  ok('drawer có khối "dùng thế nào"', await p.locator('#dHow li').count() > 0);
  ok('drawer có ví dụ và bẫy', await p.locator('#secEx:not([hidden])').count() === 1
      && await p.locator('#secTrap:not([hidden])').count() === 1);
  ok('drawer có khái niệm liên quan', await p.locator('#dRel button').count() > 0);
  await shot('02-drawer.png');
  await p.locator('#dClose').click(); await p.waitForTimeout(250);
  await p.fill('#q', 'expansion_plan'); await p.waitForTimeout(300);
  await p.locator('.tcard').filter({ hasText: 'expansion_plan' }).first().click(); await p.waitForTimeout(350);
  ok('gate có lệnh thì hiện khối Lệnh', await p.locator('#secCmd:not([hidden])').count() === 1);
  await p.locator('#dClose').click(); await p.fill('#q', '');
  await p.selectOption('#catSel', 'gate'); await p.waitForTimeout(300);
  const gates = await p.locator('.tcard').count();
  ok('lọc theo nhóm chạy đúng', gates > 30 && gates < total, gates);
  await p.selectOption('#catSel', ''); await p.waitForTimeout(200);
  await shot('03-az.png');

  console.log('\n[4] Tab Hướng dẫn');
  await p.locator('.mode[data-mode="guide"]').click(); await p.waitForTimeout(400);
  const steps = await p.locator('.fstep').count();
  ok('có stepper luồng chính', steps >= 10, steps);
  ok('mỗi chặng đều có cổng chặn', await p.locator('.fgate').count() === steps);
  ok('có thẻ chuẩn bị', await p.locator('#guideSetup .scard').count() > 0);
  ok('có bảng lỗi thường gặp', await p.locator('.trow').count() > 10);
  ok('có checklist', await p.locator('.ckbox').count() === 2);
  await shot('04-guide.png');

  console.log('\n[5] Tab Readme');
  await p.locator('.mode[data-mode="readme"]').click(); await p.waitForTimeout(400);
  ok('có kiến trúc theo tầng', await p.locator('.arow').count() > 5);
  ok('có cây thư mục', await p.locator('.trow2').count() > 10);
  ok('có mô hình AIO Tests', await p.locator('.xrow').count() === 5);
  const cmdRows = await p.locator('.cmdrow').count();
  ok('có bảng lệnh đầy đủ', cmdRows >= 45, cmdRows);
  ok('có quy ước 3 mức', await p.locator('.prbox').count() === 3);
  await shot('05-readme.png');

  console.log('\n[5a] Tab Tự dựng kit (dẫn xuất từ docs/COURSE.md)');
  await p.locator('.mode[data-mode="course"]').click(); await p.waitForTimeout(500);
  const lessons = await p.locator('.clesson').count();
  ok('có các bài', lessons >= 15, lessons);
  ok('có các phần', await p.locator('#cParts .subhead').count() >= 4);

  /* Thống kê ở đầu tab phải KHỚP thứ hiện ngay dưới nó.
   *
   * Người rà tìm ra bốn con số mâu thuẫn, và chúng nằm đúng chỗ dễ thấy nhất: header ghi "5 phần"
   * cạnh một tiêu đề gõ cứng "8 phần"; header ghi "14 gate tự xây" cạnh cây thư mục liệt kê 18 tệp.
   * Người đọc thấy hai con số cạnh nhau thì mất tin ngay, và không có phép kiểm nào bắt được. */
  const soThongKe = async (nhan) => {
    const t = await p.locator(`#cStats >> text=${nhan}`).first()
      .locator('xpath=..').innerText().catch(() => '');
    const m = /(\d+)/.exec(t);
    return m ? Number(m[1]) : null;
  };
  const stPhan = await soThongKe('phần');
  const soPhanThat = await p.locator('#cParts .subhead').count();
  ok(`thống kê "phần" khớp số phần hiện ra (${stPhan} = ${soPhanThat})`, stPhan === soPhanThat);

  const stMay = await soThongKe('máy chặn tự viết');
  /* Đếm từ NGUỒN, không đọc lại DOM. Hai lý do: `innerText` chuẩn hoá khoảng trắng nên phép đo theo
     độ thụt của cây ra 0, và đọc lại DOM thì phép kiểm chỉ đang so trang với chính nó. So với
     docs/COURSE.md mới là một thước độc lập. */
  const mdSrc = fs.readFileSync(path.join(__dirname, '..', 'COURSE.md'), 'utf8');
  const cayText = (mdSrc.match(/## Cấu trúc thư mục của bộ kit[\s\S]*?```\n([\s\S]*?)```/) || [, ''])[1];
  const dongCay = cayText.split('\n');
  const iQa = dongCay.findIndex((d) => /qa\/\s/.test(d));
  let mayTrongCay = 0;
  if (iQa >= 0) {
    const sau = (d) => d.search(/[a-zA-Z0-9_.]/);
    for (let k = iQa + 1; k < dongCay.length; k++) {
      const d = dongCay[k];
      if (!d.trim()) continue;
      if (sau(d) <= sau(dongCay[iQa])) break;
      if (/[a-z0-9_.-]+\.js\s/.test(d)) mayTrongCay++;
    }
  }
  ok(`thống kê "máy chặn" khớp cây thư mục (${stMay} = ${mayTrongCay})`,
    stMay !== null && mayTrongCay > 0 && stMay === mayTrongCay);

  const stTh = await soThongKe('lượt thực hành');
  const thThat = await p.locator('.cgoals li.cpractice').count();
  ok(`thống kê "thực hành" khớp số callout (${stTh} = ${thThat})`, stTh === thThat);

  /* Không tiêu đề nào trên trang được gõ cứng một con số về phần hoặc bài. */
  /* Bỏ số thứ tự mục ở đầu tiêu đề (badge .num) trước khi soi. Bản đầu bắt cả "10 Bài chi tiết bổ
     trợ" và báo oan: số 10 đó là thứ tự mục trên trang, không phải một phép đếm bài. */
  const soCung = await p.locator('.subhead').allInnerTexts();
  const cungLech = soCung
    .map((t) => t.replace(/^\s*\d+\s*/, ''))
    .filter((t) => /\b\d+\s*(phần|bài)\b/i.test(t));
  ok('không tiêu đề nào gõ cứng số phần/bài', cungLech.length === 0, cungLech.join(' · '));
  ok('mỗi bài có dòng "có gì trong tay"', await p.locator('.clesson .chave').count() === lessons);
  ok('mỗi bài có thời lượng', await p.locator('.clesson .cdur').count() === lessons);
  /* Mỗi PHẦN phải khai số giờ — thiếu thì bảng tổng thời lượng của khoá nói dối. */
  ok('mỗi phần có số giờ', await p.locator('#cParts .subhead .cphours').count()
    === await p.locator('#cParts .subhead').count());
  ok('có nội dung từng bài', await p.locator('.cgoals li').count() >= 80);
  ok('bài đã có bài giảng được đánh dấu', await p.locator('.clesson.ready').count() >= 1);
  /* Hai bài trọng tâm (Oracle, Mutation) phải nhận ra được bằng mắt, không phải đọc hết mới thấy. */
  ok('bài trọng tâm được đánh dấu ⭐', await p.locator('.clesson.star').count() >= 2);
  /* Bullet "phải gõ" khác bullet "chỉ đọc" — đây là thứ phân biệt khoá học với mục lục. */
  ok('có callout Thực hành', await p.locator('.cgoals li.cpractice').count() >= 5);
  ok('có callout XÂY gate', await p.locator('.cgoals li.cgate').count() >= 5);
  /* Ba thứ người mới cần THẤY trước khi đọc: kit chặn trông ra sao · dừng ở đâu vẫn có thứ
     dùng được · bài nào phải ngồi kỹ. Thiếu một trong ba là quay lại tình trạng 'bức tường thời lượng'. */
  ok('có ảnh terminal cho thấy kit chặn', await p.locator('#cDemo .dchan').count() >= 1);
  const soMoc = await p.locator('#cMoc .mcbox').count();
  ok('có các mốc dừng được', soMoc >= 3, soMoc);
  ok('có đúng MỘT mốc trọng tâm', await p.locator('#cMoc .mcbox.key').count() === 1);
  ok('mỗi phần có dòng xong-phần-này-bạn-có',
     await p.locator('#cParts .pxong').count() === await p.locator('#cParts .subhead').count());
  ok('mỗi bài có huy hiệu mức khó', await p.locator('.clesson .cmuc').count() === lessons);
  ok('mức khó có đủ 3 bậc',
     (await p.$$eval('.clesson .cmuc', (ns) => new Set(ns.map((n) => n.textContent)).size)) === 3);
  /* Hai khối TRỰC QUAN: lộ trình có thanh giờ theo tỉ lệ, và vòng làm việc 6 chặng.
     Kiểm quan hệ chứ không kiểm con số cứng — thêm/bớt phần là phép kiểm đỏ oan. */
  const soPhan = await p.locator('#cParts .subhead').count();
  ok('lộ trình có đủ phần', await p.locator('#cRoad .rdpart').count() === soPhan);
  ok('mỗi phần trong lộ trình có thanh giờ', await p.locator('#cRoad .rdbar i').count() === soPhan);
  ok('thanh giờ có bề rộng khác nhau',
     (await p.$$eval('#cRoad .rdbar i', (ns) => new Set(ns.map((n) => n.style.width)).size)) > 1);
  ok('mỗi bài có một chấm trong lộ trình', await p.locator('#cRoad .rddot').count() === lessons);
  /* Bấm chấm phải nhảy tới đúng thẻ bài — nếu không thì lộ trình chỉ là hình trang trí. */
  await p.locator('#cRoad .rddot').nth(3).click(); await p.waitForTimeout(400);
  ok('bấm chấm thì làm nổi đúng thẻ bài', await p.locator('.clesson.nhay').count() === 1);
  const chang = await p.locator('#cFlow .wfstep').count();
  ok('vòng làm việc có các chặng', chang >= 4, chang);
  ok('MỌI chặng đều có cổng chặn', await p.locator('#cFlow .wfgate').count() === chang);
  ok('có ghi chú vòng lặp quay lại', await p.locator('#cFlow .wfloop').count() === 1);
  ok('có bảng so sánh với khoá khác', await p.locator('#cCompare .ccmp').count() >= 4);
  ok('có 3 bug đối chứng của app thực hành', await p.locator('#cBugs .cbug').count() === 3);
  ok('có mục tiêu cấp khoá', await p.locator('#cOutcomes li').count() >= 8);
  ok('có quyết định thiết kế khoá', await p.locator('#cDecisions .cdec').count() >= 5);
  ok('có mục bạn-có-gì-sau-khi-làm-hết', await p.locator('#cDeliver li').count() >= 5);
  /* Bài chi tiết bổ trợ (không đánh số) phải NÊU RA — bài giảng tồn tại mà không ai dẫn tới thì
     bằng không tồn tại, và người đọc không có đường nào tìm ra nó. */
  ok('bài chi tiết bổ trợ được nêu', await p.locator('#cOrphans .corphan').count() >= 4);
  await shot('05a-course.png');

  console.log('\n[6] Flashcard & Đề luyện');
  await p.locator('.mode[data-mode="flash"]').click(); await p.waitForTimeout(400);
  await p.locator('#flip').click(); await p.waitForTimeout(200);
  ok('lật thẻ ra đáp án', (await p.locator('.fcans h3').innerText()).length > 0);
  await p.locator('#yes').click(); await p.waitForTimeout(200);
  ok('chấm điểm chạy', await p.locator('#fcScore').innerText() === 'Điểm 1');
  await p.locator('.mode[data-mode="chal"]').click(); await p.waitForTimeout(350);
  ok('đề luyện có 6 trục', await p.locator('.slot').count() === 6);
  const v0 = await p.locator('.slot .vl').allInnerTexts();
  await p.locator('.slot .lockbtn').first().click();
  let held = true, changed = 0;
  for (let i = 0; i < 6; i++) {
    await p.locator('#roll').click(); await p.waitForTimeout(80);
    const now = await p.locator('.slot .vl').allInnerTexts();
    if (now[0] !== v0[0]) held = false;
    for (let k = 1; k < now.length; k++) if (now[k] !== v0[k]) changed++;
  }
  ok('khoá giữ nguyên tiêu chí qua 6 lần random', held);
  ok('các trục khác vẫn đổi', changed > 0, changed);

  console.log('\n[7] Theme & thiết bị');
  await p.locator('.mode[data-mode="graph"]').click(); await p.waitForTimeout(400);
  await p.locator('#themeBtn').click(); await p.waitForTimeout(500);
  ok('bật được dark mode', await p.evaluate(() => document.documentElement.getAttribute('data-theme')) === 'dark');
  ok('canvas vẫn vẽ ở dark mode', (await p.evaluate(SIG)).split(':')[0] !== '0');
  await shot('06-dark.png');

  const rp = await (await browser.newContext({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce' })).newPage();
  rp.on('pageerror', e => errs.push('RM PAGEERROR: ' + e.message));
  await rp.goto(FILE, { waitUntil: 'networkidle' }); await rp.waitForTimeout(900);
  const g1 = await rp.evaluate(SIG); await rp.waitForTimeout(1300);
  ok('prefers-reduced-motion: KHÔNG tự quay', g1 === await rp.evaluate(SIG));
  ok('prefers-reduced-motion: vẫn vẽ', g1.split(':')[0] !== '0');

  const mp = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  mp.on('pageerror', e => errs.push('MOBILE PAGEERROR: ' + e.message));
  await mp.goto(FILE, { waitUntil: 'networkidle' }); await mp.waitForTimeout(1000);
  ok('mobile: canvas vẽ được', (await mp.evaluate(SIG)).split(':')[0] !== '0');
  const noHScroll = async () => !(await mp.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 1));
  ok('mobile: bản đồ không tràn ngang', await noHScroll());
  /* Tab course có lộ trình cuộn NGANG và cây thư mục monospace — hai thứ hay đẩy tràn cả trang.
     Cuộn ngang trong KHUNG RIÊNG thì được; đẩy body tràn thì không. */
  for (const m of ['az', 'guide', 'readme', 'course']) {
    await mp.locator('.mode[data-mode="' + m + '"]').click(); await mp.waitForTimeout(500);
    ok('mobile: tab ' + m + ' không tràn ngang', await noHScroll());
  }
  ok('mobile: lộ trình cuộn ngang trong khung riêng', await mp.evaluate(() => {
    const r = document.querySelector('#cRoad');
    return !!r && r.scrollWidth > r.clientWidth && getComputedStyle(r).overflowX === 'auto';
  }));

  console.log('\n[8] Tự chứa (CSP của Artifact chặn mọi host ngoài)');
  const html = require('fs').readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const urls = [...new Set(html.match(/https?:\/\/[^"' )]+/g) || [])];
  ok('không gọi ra host ngoài nào', urls.length === 0, urls);
  ok('không còn lỗi nào phát sinh trong cả lượt', errs.length === 0, errs);

  await browser.close();

  /* [9] Luật của KIT áp lên chính trang này.
     Nguồn của trang nằm trong phạm vi quét của policy_source_check (ROOTS có docs/library/src), nên
     "trang chạy đúng" chưa đủ — nó còn phải không vi phạm luật kit. Đã suýt lọt một lần: hai chỗ nhắc
     tên công cụ test-management cũ, chỉ lộ ra khi chạy tay `npm run gate:policy`. */
  console.log('\n[9] Gate của kit áp lên nguồn trang');
  const { spawnSync } = require('child_process');
  const runGate = (name, args) => {
    const r = spawnSync(process.execPath, args, { cwd: path.join(__dirname, '..', '..'), encoding: 'utf8' });
    const out = (r.stdout || '') + (r.stderr || '');
    return { code: r.status, out };
  };
  const drift = runGate('library:drift', [path.join(__dirname, '..', '..', 'scripts', 'qa', 'library_drift.js')]);
  ok('library:drift — trang khớp repo', drift.code === 0,
     drift.code === 0 ? undefined : drift.out.split('\n').filter((l) => l.startsWith('  - ')));
  const policy = runGate('gate:policy', [path.join(__dirname, '..', '..', 'scripts', 'qa', 'policy_source_check.js')]);
  const tmsHit = /công cụ đã bỏ/.test(policy.out);
  ok('gate:policy — nguồn trang không vi phạm luật một-công-cụ', !tmsHit,
     tmsHit ? policy.out.split('\n').filter((l) => /công cụ đã bỏ/.test(l)) : undefined);
  console.log('\n' + (fails.length ? '✗ HỎNG ' + fails.length + ' phép kiểm: ' + fails.join(' · ')
                                    : '✓ Tất cả phép kiểm đạt'));
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('LỖI KHI CHẠY:', e.message); process.exit(1); });
