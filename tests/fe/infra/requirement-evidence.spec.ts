import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * @infra — BẰNG CHỨNG CỦA MỘT YÊU CẦU (v2.5.0 G1.3). Nhận của A, nhưng CHỈNH một chỗ bản chất.
 *
 * A cho phép requirement lấy từ "UI thực tế" đi thẳng vào test case. Ở B thì KHÔNG: app không bao giờ là
 * chuẩn đúng-sai của chính nó, vì so app với app luôn PASS kể cả khi app sai. Đường đi đúng của một quan
 * sát: quan sát → câu hỏi Ambiguity Gate → BA/tài liệu chốt → `knowledge/domain` có `confirmed_by`.
 *
 * KIT CẤM CHUYỆN ĐÓ BẰNG CHỮ Ở NHIỀU NƠI, nhưng đo 10/10/2026 thì `domain:check` CHỈ đòi `source` khác
 * rỗng — một rule khai `source: "quan sát trên app"` đi qua sạch, rồi mọi case trỏ tới nó là tautology mà
 * không gate nào biết. Đó là phần G1.3 lấp.
 *
 * VÀ MỘT LỖ THIẾT KẾ CỦA CHÍNH B: schema `PM-*` ghi "ô role×action không có trong `allow` = DENY". Câu đó
 * gộp "BA đã nói là cấm" với "chưa ai hỏi tới" vào một — mà hai thứ đó ngược nhau về hệ quả. Khẳng định
 * 403 ở một ô chưa ai chốt là tự bịa ra một yêu cầu, và nếu app cho phép thì bug log ra là bug BỊA. Đúng
 * thứ đã suýt xảy ra một lần (`feedback_tien_de_mot_nua_la_ket_luan_sai`).
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const DR = path.join(REPO, 'scripts/qa/domain_rules.js');
const SM = path.join(REPO, 'scripts/qa/system_map.js');

const RULE = (over: Record<string, unknown> = {}) => ({
  id: 'BR-HOCSINH-002',
  module: 'Học sinh',
  rule: 'Email phải đúng định dạng có ký tự @ và tên miền',
  source: 'FSD v3 §4.2',
  confirmed_by: 'BA',
  confirmed_at: '2026-10-01',
  version: 1,
  status: 'active',
  covered_by: ['CSDL_HS_TC_088'],
  examples: [{ input: 'abc', expected: 'CHẶN, thông báo định dạng email' }],
  ...over,
});

function chayDomain(rules: Record<string, unknown>[]) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'reqev-'));
  rules.forEach((r, i) => fs.writeFileSync(path.join(d, `r${i}.json`), JSON.stringify(r, null, 2), 'utf8'));
  const r = spawnSync(process.execPath, [DR, '--validate', '--enforce', '--dir', d], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}`, d };
}

const PM = (over: Record<string, unknown> = {}) => ({
  id: 'PM-HOCSINH-001',
  type: 'permission_matrix',
  modules: ['Học sinh'],
  roles: ['Admin', 'GiaoVien'],
  actions: ['view', 'delete'],
  allow: { Admin: ['view', 'delete'], GiaoVien: ['view'] },
  deny_expected: 'HTTP 403 và dữ liệu không đổi',
  covered_by: {},
  source: 'FSD §7 Ma trận phân quyền',
  confirmed_by: 'BA',
  confirmed_at: '2026-10-01',
  version: 1,
  status: 'active',
  ...over,
});

function chaySystem(recs: Record<string, unknown>[]) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'reqpm-'));
  recs.forEach((r, i) => fs.writeFileSync(path.join(d, `m${i}.json`), JSON.stringify(r, null, 2), 'utf8'));
  const r = spawnSync(process.execPath, [SM, '--validate', '--enforce', '--dir', d], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}`, d };
}

test.describe('@infra G1.3 — "UI thực tế" KHÔNG được làm oracle', () => {
  test('rule lấy APP làm `source` ⇒ CHẶN, và nói đường đi đúng', () => {
    for (const s of [
      'Quan sát trên app: ô Email cho nhập chuỗi không có @',
      'Theo app hiện tại thì nút Ghi bị khoá',
      'Lấy từ UI thực tế của màn danh sách',
      'Như app đang hiển thị ở lưới',
    ]) {
      const r = chayDomain([RULE({ source: s })]);
      expect(r.code, `phải CHẶN: ${s}\n${r.out}`).toBe(1);
      expect(r.out).toMatch(/app KHÔNG bao giờ là chuẩn đúng-sai của chính nó/);
      expect(r.out, 'phải chỉ đường đi đúng, không chỉ cấm').toMatch(/Ambiguity Gate/);
      fs.rmSync(r.d, { recursive: true, force: true });
    }
  });

  test('ÂM BẢN: nguồn tài liệu thật ⇒ KHÔNG chặn', () => {
    for (const s of [
      'FSD v3 §4.2',
      'Vault QEMIS kho BR: "20 - Cấp học/02 - THCS/BR.md"',
      'TT32/2018 — BR-TT32-010',
      'BA XÁC NHẬN 08/10/2026',
      'Bộ testcase chuẩn của hệ thống Testcase_CSDL_2026-2027.xlsx',
    ]) {
      const r = chayDomain([RULE({ source: s })]);
      expect(r.code, `KHÔNG được chặn: ${s}\n${r.out}`).toBe(0);
      fs.rmSync(r.d, { recursive: true, force: true });
    }
  });

  test('repo THẬT: 0/118 rule lấy app làm nguồn — luật này chặn đường lùi, không dọn nợ', () => {
    const dir = path.join(REPO, 'knowledge/domain');
    if (!fs.existsSync(dir)) { test.skip(true, 'máy này chưa có knowledge/domain (lớp PROJECT)'); return; }
    const xau: string[] = [];
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        if (/quan sát (?:trên|từ) (?:app|ứng dụng)|theo (?:app|ứng dụng) hiện tại|UI thực tế/i.test(String(j.source || ''))) xau.push(f);
      } catch { /* file hỏng có phép kiểm riêng */ }
    }
    expect(xau, 'có rule lấy app làm nguồn ⇒ phải chuyển nó về câu hỏi Ambiguity Gate').toEqual([]);
  });
});

test.describe('@infra G1.3 — "không đề cập" KHÁC "không áp dụng"', () => {
  test('đặc tả im lặng mà KHÔNG nêu neo độc lập ⇒ CẢNH BÁO', () => {
    const r = chayDomain([RULE({ source: 'KHÔNG có trong đặc tả CSDL - Hồ sơ lớp.md' })]);
    expect(r.out).toMatch(/không nêu NEO ĐỘC LẬP/);
    expect(r.out, 'phải phân biệt rõ hai câu đó').toMatch(/"Không đề cập" KHÁC "không áp dụng"/);
    expect(r.code, 'cảnh báo, không chặn — nhận neo bằng đọc chữ thì cách viết khác là báo oan').toBe(0);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('ÂM BẢN: bốn cách nêu neo của 4 rule THẬT đều đi qua', () => {
    /*
     * Danh sách dấu hiệu neo được LẤY TỪ dữ liệu thật, không tự nghĩ: 4 rule trong repo khai đặc tả im
     * lặng và cả 4 đều nêu neo. Chúng là MẪU ĐÚNG của luật này, nên luật phải được dựng để chúng qua.
     */
    for (const s of [
      'KHÔNG có trong đặc tả CSDL - Hồ sơ lớp.md. Ghi lại đây làm oracle an toàn phổ quát sau khi đối chiếu bộ testcase hệ thống',
      'KHÔNG lấy từ đặc tả CSDL — đây là THUỘC TÍNH TOÀN VẸN DỮ LIỆU PHỔ QUÁT, độc lập với ứng dụng',
      'BA XÁC NHẬN 08/10/2026. Đặc tả "CSDL - Hồ sơ lớp.md" KHÔNG có rule nào về lớp ghép',
      'KHÔNG có trong đặc tả; neo là văn bản gốc TT28/2020',
    ]) {
      const r = chayDomain([RULE({ source: s })]);
      expect(r.out, `rule nêu neo rồi vẫn bị cảnh báo:\n${s}`).not.toMatch(/không nêu NEO ĐỘC LẬP/);
      fs.rmSync(r.d, { recursive: true, force: true });
    }
  });

  test('repo THẬT: 4 rule khai đặc tả im lặng, và cả 4 đều qua', () => {
    const dir = path.join(REPO, 'knowledge/domain');
    if (!fs.existsSync(dir)) { test.skip(true, 'máy này chưa có knowledge/domain'); return; }
    const r = spawnSync(process.execPath, [DR, '--validate'], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    expect(`${r.stdout}${r.stderr}`, 'luật mới không được làm đỏ rule nào đang có').not.toMatch(/không nêu NEO ĐỘC LẬP/);
  });
});

test.describe('@infra G1.3 — ba mức bằng chứng của `PM-*`', () => {
  test('ô khai ở CẢ `allow` và `deny_verified` ⇒ CHẶN (hai lời khai ngược nhau)', () => {
    const r = chaySystem([PM({ deny_verified: { GiaoVien: ['view'] } })]);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/hai lời khai ngược nhau/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('`deny_inferred` thiếu `inferred_from` ⇒ CHẶN — suy mà không nói nguồn thì là đoán', () => {
    const r = chaySystem([PM({ deny_inferred: { GiaoVien: ['delete'] } })]);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/inferred_from/);
    fs.rmSync(r.d, { recursive: true, force: true });

    const ok = chaySystem([PM({ deny_inferred: { GiaoVien: ['delete'] }, inferred_from: 'Màn Cấu hình quyền > nhóm Giáo viên, bản ghi ngày 08/10/2026' })]);
    expect(ok.code, ok.out).toBe(0);
    fs.rmSync(ok.d, { recursive: true, force: true });
  });

  test('ô CHƯA phân loại ⇒ CẢNH BÁO `unknown`, và KHÔNG được coi là deny', () => {
    /* `Admin × delete` để trong allow; bỏ `GiaoVien × delete` khỏi mọi nhóm ⇒ nó là `unknown`. */
    const r = chaySystem([PM({ allow: { Admin: ['view', 'delete'], GiaoVien: ['view'] }, deny_verified: { Admin: [] } })]);
    expect(r.out).toMatch(/ô CHƯA phân loại.*`unknown`, KHÔNG phải deny/s);
    expect(r.out, 'phải gọi tên ô, không báo chung chung').toContain('GiaoVien:delete');
    expect(r.out, 'và chỉ đường: đưa vào câu hỏi Ambiguity Gate').toMatch(/Ambiguity Gate/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('`covered_by` trỏ ô `unknown` ⇒ CHẶN — case đó dùng oracle KHÔNG TỒN TẠI', () => {
    const r = chaySystem([PM({
      allow: { Admin: ['view', 'delete'], GiaoVien: ['view'] },
      deny_verified: { Admin: [] },
      covered_by: { 'GiaoVien:delete': ['CSDL_HS_TC_300'] },
    })]);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/oracle KHÔNG TỒN TẠI/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('ÂM BẢN: `covered_by` trỏ ô đã phân loại ⇒ KHÔNG chặn', () => {
    const r = chaySystem([PM({
      deny_verified: { GiaoVien: ['delete'] },
      covered_by: { 'GiaoVien:delete': ['CSDL_HS_TC_300'] },
    })]);
    expect(r.code, r.out).toBe(0);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('ÂM BẢN: record CHƯA dùng ba mức thì không bị đòi — hai tầng', () => {
    /*
     * Repo có 0 record `PM-*`, nhưng luật phải không làm đỏ một record viết theo schema CŨ. Chỉ khi record
     * đã khai `deny_verified`/`deny_inferred` thì mới bị kiểm chặt.
     */
    const r = chaySystem([PM()]);
    expect(r.code, r.out).toBe(0);
    expect(r.out, 'không đòi phân loại khi record chưa dùng ba mức').not.toMatch(/ô CHƯA phân loại/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('schema KHÔNG còn câu "ô không khai = deny"', () => {
    /*
     * Chặn đường lùi: câu đó chính là lỗ thiết kế. Để nó lại thì người đọc vẫn làm tròn `unknown` thành
     * deny, bất kể gate nói gì.
     */
    const sc = fs.readFileSync(path.join(REPO, 'knowledge/SCHEMA.md'), 'utf8');
    expect(sc, 'phải khai đủ ba mức').toMatch(/deny_verified/);
    expect(sc).toMatch(/deny_inferred/);
    expect(sc).toMatch(/\*\*`unknown`\*\*/);
    expect(sc, 'và nói rõ unknown KHÔNG dùng làm oracle').toMatch(/KHÔNG\.\*\*? ?Đưa vào câu hỏi|KHÔNG.*Ambiguity/s);
  });
});

test.describe('@infra G1.3 — skill nói đủ bốn thứ của A', () => {
  const sk = () => fs.readFileSync(path.join(REPO, '.agent/skills/phase1/requirements_analyzer/SKILL.md'), 'utf8');

  test('thứ tự ưu tiên khi nguồn mâu thuẫn, và app KHÔNG ở trong thang', () => {
    const s = sk();
    expect(s).toMatch(/Thứ tự ưu tiên khi hai nguồn nói ngược nhau/);
    expect(s, 'BA xác nhận đứng đầu').toMatch(/BA\/PO xác nhận/);
    expect(s, 'app bị loại khỏi thang bằng ký hiệu chặn, không phải xếp hạng cuối').toMatch(/⛔.*App đang chạy/);
    expect(s, 'mâu thuẫn chưa phân xử là câu hỏi Blocking').toMatch(/câu hỏi Blocking/);
  });

  test('ba mức bằng chứng phân quyền, và "không đề cập" khác "không áp dụng"', () => {
    const s = sk();
    expect(s).toMatch(/Ba mức bằng chứng cho phân quyền/);
    expect(s).toMatch(/KHÔNG được làm tròn thành "không có quyền"/);
    expect(s).toMatch(/"Không đề cập" KHÁC "không áp dụng"/);
  });

  test('bản đồ phủ tài liệu: 4 ô, và mẫu số lấy từ `scope:anchor` chứ không tự liệt kê', () => {
    const s = sk();
    expect(s).toMatch(/Bản đồ phủ tài liệu/);
    expect(s, 'ô vùng mù phải có người đọc, không im lặng').toMatch(/vùng mù/);
    expect(s, 'mẫu số tự khai thì "đủ" chỉ còn nghĩa "tôi thấy đủ"').toMatch(/scope:anchor/);
  });

  test('skill dưới trần 2,5k token, và KHÔNG vào phần nạp bắt buộc', () => {
    /*
     * Luật token: thân skill dưới 2,5k token, và nạp có điều kiện.
     *
     * Phép kiểm "nạp có điều kiện" KHÔNG tra `load_map.json` — bản đầu của test này làm vậy và sai tiền
     * đề: `load_map.json` theo dõi file PROMPT, không theo dõi skill. Skill của kit vốn **không
     * auto-load** (liệt kê ở `.agent/skills/INDEX.md`, mở file mới dùng). Thứ đo được là: skill có mặt
     * trong INDEX để tìm ra được, và `prompt:budget` không thấy nó trong cột bắt buộc của luồng nào.
     */
    const n = sk().replace(/\r\n?/g, '\n').length / 3.2;
    expect(n, `skill ~${Math.round(n)} token, trần 2500`).toBeLessThan(2500);
    expect(fs.readFileSync(path.join(REPO, '.agent/skills/INDEX.md'), 'utf8')).toContain('requirements_analyzer');

    const pb = spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/prompt_budget.js'), '--enforce'],
      { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    const out = `${pb.stdout}${pb.stderr}`;
    expect(pb.status, `prompt:budget phải ĐẠT — skill không được làm phình phần bắt buộc:\n${out}`).toBe(0);
    expect(out).toMatch(/✓ ĐẠT/);
  });
});
