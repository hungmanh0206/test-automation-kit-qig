import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * @infra — CHẾ ĐỘ `--compact` CỦA GATE (H5 của token-diet).
 *
 * Vì sao: đo bằng `npm run token:audit` trên 4 lượt chạy task thật thì `output gate` chiếm 4,3 đến 8,9%
 * khối lượng kết quả tool, khoảng 54k token mỗi lượt. Đo thật trên bộ 265 case của CSDL-9003:
 * 10.696 byte xuống 1.870 byte, giảm 82%.
 *
 * ĐIỀU DUY NHẤT THỰC SỰ PHẢI CHỨNG MINH: `--compact` là cách IN KHÁC, không phải cách LỌC.
 *
 *   Một chế độ in gọn mà bỏ sót vi phạm thì tệ hơn hẳn chế độ dài: người chạy thấy ít dòng hơn, tưởng
 *   bộ sạch hơn, và cái bị bỏ sót không ai biết. Nên spec này khoá TẬP (mã, TC ID) phải bằng nhau giữa
 *   hai chế độ, và tổng số vi phạm phải bằng nhau. Mất phép kiểm đó thì cả hạng mục H5 thành rủi ro
 *   thuần: tiết kiệm 82% output bằng cách đánh mất một phần sự thật.
 *
 * Và một điều nữa đã suýt sai khi làm: `design_gate` có HAI khối in cảnh báo giống nhau từng ký tự (một
 * ở nhánh checklist, một ở `main`). Bản đầu chỉ chuyển được khối đầu, nên `--compact` không có tác dụng
 * gì mà cũng không báo lỗi. Test cuối file đo BYTE để bắt đúng lớp lỗi đó.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const DESIGN = path.join(REPO, 'scripts/qa/design_gate.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const engine = require(path.join(REPO, 'scripts/qa/lib/gate_engine.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const CFG = require(path.join(REPO, '.agent/config/gate_codes.json'));

const HEAD = [
  '| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |',
  '|---|---|---|---|---|---|---|---|---|---|',
].join('\n');

/** Dòng testcase thiếu ô lõi ⇒ sinh vi phạm CHẶN thật, không phải vi phạm bịa. */
const dongLoi = (id: string) =>
  `| ${id} | Functional | [Positive][Validation] | M/validate | ${id} kiểm ô Họ tên | [api] Đã đăng nhập | x=1 |  | 1. Hiện đúng | High |`;

function chayDesign(ids: string[], compact: boolean) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-'));
  const f = path.join(d, 'bo.md');
  fs.writeFileSync(f, `# bộ\n\n${HEAD}\n${ids.map(dongLoi).join('\n')}\n`, 'utf8');
  try {
    const r = spawnSync(process.execPath, [DESIGN, '--file', f, ...(compact ? ['--compact'] : [])], {
      cwd: REPO, encoding: 'utf8', env: gateEnv() as NodeJS.ProcessEnv,
    });
    return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
}

/** Tập (mã, TC ID) đọc từ output COMPACT, kể cả dòng gộp. */
function tapTuCompact(out: string): Set<string> {
  const tap = new Set<string>();
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/^\s*[-~]\s+([A-Z][A-Z0-9_]*)\s+·\s+(.*)$/);
    if (!m) continue;
    const ma = m[1];
    const sau = m[2];
    const gop = sau.match(/^và \d+ case cùng lỗi(?::\s*(.*))?$/);
    if (gop) {
      for (const id of (gop[1] || '').split(/,\s*/).filter(Boolean)) tap.add(`${ma}|${id}`);
      continue;
    }
    const id = (sau.match(/^([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_TC_\d+)\s+·/) || [])[1];
    tap.add(`${ma}|${id || ''}`);
  }
  return tap;
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `M_TC_${String(i + 1).padStart(3, '0')}`);

test.describe('@infra --compact — in khác, KHÔNG lọc', () => {
  test('config mã: không trùng mã, regex hợp lệ, mỗi mã có lời giải thích', () => {
    const codes = CFG.codes.map((c: { code: string }) => c.code);
    expect(new Set(codes).size, 'mã trùng nhau thì hai họ vi phạm bị gộp làm một').toBe(codes.length);
    for (const c of CFG.codes) {
      expect(() => new RegExp(c.khop, 'i'), `${c.code}: regex không hợp lệ`).not.toThrow();
      expect(String(c.y || '').length, `${c.code}: thiếu lời giải thích`).toBeGreaterThan(10);
      expect(c.code, 'mã phải là chữ HOA và gạch dưới, để dán vào --grep được').toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
    expect(CFG.nguong_gop).toBeGreaterThan(0);
    expect(CFG._khong_khop_thi_KHAC, 'quyết định không bỏ dòng nào phải ghi trong config').toMatch(/KHAC/);
  });

  test('KHÔNG MẤT DÒNG — thông điệp lạ nhận mã KHAC và vẫn được in', () => {
    expect(engine.maCua('một thông điệp hoàn toàn mới chưa có mã'), 'fallback phải là KHAC').toBe('KHAC');
    const msgs = ['thiếu evidence ở step 2', 'một thông điệp hoàn toàn mới chưa có mã'];
    const { dong, tap } = engine.nenGon(msgs);
    expect(dong.length, 'hai thông điệp vào thì hai dòng ra').toBe(2);
    expect([...tap].some((x) => String(x).startsWith('KHAC|'))).toBe(true);
  });

  test('gộp theo mã: vượt ngưỡng thì gộp, nhưng LIỆT KÊ ĐỦ TC ID còn lại', () => {
    const n = CFG.nguong_gop + 4;
    const msgs = ids(n).map((id) => `bo.md · ${id}: thiếu evidence cho step 1`);
    const { dong, tap } = engine.nenGon(msgs);
    expect(dong.length, `in ${CFG.nguong_gop} dòng rồi 1 dòng gộp`).toBe(CFG.nguong_gop + 1);
    const gop = dong[dong.length - 1];
    expect(gop).toMatch(new RegExp(`và 4 case cùng lỗi`));
    for (const id of ids(n).slice(CFG.nguong_gop)) {
      expect(gop, `dòng gộp phải có ${id}, nếu không là mất case`).toContain(id);
    }
    expect(tap.size, 'tập (mã, TC ID) phải đủ cả 9 case').toBe(n);
  });

  test('TƯƠNG ĐƯƠNG — cùng exit code và cùng TẬP (mã, TC ID)', () => {
    /*
     * Phép kiểm trung tâm của cả hạng mục. Nếu nó đỏ thì `--compact` đang đánh mất sự thật, và lúc đó
     * 82% tiết kiệm không còn ý nghĩa gì.
     */
    const bo = ids(CFG.nguong_gop + 3);
    const day = chayDesign(bo, false);
    const gon = chayDesign(bo, true);

    expect(gon.code, 'exit code phải y hệt').toBe(day.code);
    expect(day.code, 'fixture phải sinh vi phạm CHẶN thật, không thì phép so là rỗng').toBe(1);

    const tapGon = tapTuCompact(gon.out);
    const idsDay = new Set((day.out.match(/M_TC_\d+/g) || []));
    const idsGon = new Set([...tapGon].map((x) => x.split('|')[1]).filter(Boolean));
    expect(idsGon, 'mọi TC ID của chế độ đầy đủ phải còn trong chế độ gọn').toEqual(idsDay);
  });

  test('chế độ đầy đủ KHÔNG đổi một chữ nào', () => {
    /*
     * Mã được gán bằng cách KHỚP vào thông điệp, không bằng cách viết lại thông điệp. Hàng chục spec đang
     * khớp theo chữ trong thông điệp; nếu `--compact` kéo theo việc sửa thông điệp gốc thì chúng đỏ hàng
     * loạt, và một thay đổi trình bày không được phép mang rủi ro đó.
     */
    const day = chayDesign(ids(2), false);
    expect(day.out, 'chế độ đầy đủ không được in mã').not.toMatch(/^\s*-\s+[A-Z_]+\s+·/m);
    expect(day.out).toMatch(/M_TC_001/);
    expect(CFG._cach_lam_va_vi_sao_KHONG_sua_thong_diep).toMatch(/không phải bằng cách viết lại/);
  });

  test('ĐO BYTE — `--compact` phải thật sự ngắn hơn, ở CẢ hai nhánh in', () => {
    /*
     * Bản đầu của tôi chuyển được khối in cảnh báo của nhánh checklist mà KHÔNG chuyển khối của `main()`,
     * vì hai khối giống nhau từng ký tự và `replace` chỉ trúng khối đầu. Không lỗi, không cảnh báo, chỉ
     * là `--compact` vô tác dụng. Đo byte là cách duy nhất bắt được lớp đó.
     */
    const bo = ids(CFG.nguong_gop + 6);
    const day = chayDesign(bo, false).out.length;
    const gon = chayDesign(bo, true).out.length;
    expect(gon, `compact ${gon} byte phải nhỏ hơn đầy đủ ${day} byte`).toBeLessThan(day);
  });

  test('mức giảm phụ thuộc ĐỘ DÀI thông điệp — đo trên thông điệp dài như thực tế', () => {
    /*
     * Fixture ở test trên sinh vi phạm có thông điệp NGẮN ("ô … rỗng"), nên compact chỉ giảm khoảng 12%.
     * Đó không phải lỗi: compact tiết kiệm bằng cách bớt LỜI GIẢI THÍCH, nên nó chỉ đáng giá ở những họ
     * vi phạm có lời giải thích dài. Số 82% đo trên bộ 265 case thật của CSDL-9003 đến từ đúng loại đó.
     *
     * Ghi cả hai con số ra đây, vì một con số không kèm điều kiện sẽ bị trích dẫn sai ở lần sau.
     */
    const daiThat = 'bo.md · M_TC_001: thiếu evidence cho step 2 — mọi case đã execute, kể cả PASS, phải có ảnh '
      + 'đúng màn, highlight element đang kiểm và mask PII khách. Xem CLAUDE.md mục 4 và RULE_GLOBAL §evidence.';
    const msgs = ids(CFG.nguong_gop + 6).map((id) => daiThat.replace('M_TC_001', id));
    const day = msgs.join('\n').length;
    const gon = engine.nenGon(msgs).dong.join('\n').length;
    expect(gon / day, `thông điệp dài thì phải giảm rõ: ${gon}/${day}`).toBeLessThan(0.6);
  });

  test('BẤT BIẾN — compact KHÔNG BAO GIỜ dài hơn đầy đủ, kể cả khi ít vi phạm', () => {
    /*
     * Lỗi đã xảy ra: dòng chú thích "Giải thích đầy đủ của một mã…" in vô điều kiện, nên bộ chỉ có 2 vi
     * phạm ngắn thì chế độ GỌN to hơn chế độ đầy đủ (728 so với 639 byte). Một chế độ tiết kiệm mà tốn
     * thêm là một chế độ không ai bật. Nay chú thích chỉ in từ 3 dòng trở lên.
     *
     * Kiểm ở DẢI, không ở một điểm: 1 case, ít hơn ngưỡng gộp, và nhiều hơn ngưỡng gộp.
     */
    for (const n of [1, 2, CFG.nguong_gop - 1, CFG.nguong_gop + 6]) {
      const bo = ids(n);
      const day = chayDesign(bo, false).out.length;
      const gon = chayDesign(bo, true).out.length;
      expect(gon, `${n} case: compact ${gon} byte KHÔNG được vượt đầy đủ ${day} byte`).toBeLessThanOrEqual(day);
    }
  });

  test('`yChinh` cắt đúng trần và không cắt giữa dòng nhiều dòng', () => {
    const dai = `bo.md · M_TC_001: ${'x'.repeat(400)}`;
    const y = engine.yChinh(dai, 120);
    expect(y.length).toBeLessThanOrEqual(120);
    expect(y.endsWith('…'), 'cắt thì phải có dấu hiệu đã cắt').toBe(true);
    expect(engine.yChinh('dòng một\ndòng hai'), 'nhiều dòng phải thành một dòng').not.toMatch(/\n/);
  });
});
