import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/*
 * @infra — SUB-MODE CHECKLIST của `05_manual_quick.md` (H5).
 *
 * BỐN THỨ ĐƯỢC KHOÁ Ở ĐÂY. Cái thứ tư mới là cái đắt nhất, vì nó là một lỗi ĐÃ XẢY RA:
 *   ① DRIFT. Bảng ngưỡng trong prompt phải khớp `checklist_types.json`. Người ta sửa bảng trong prompt
 *      chứ không sửa config, và từ hôm đó máy gác theo ngưỡng khác với ngưỡng con người đang đọc.
 *   ② Ô tick phải TRỐNG lúc sinh. Checklist xuất ra kèm dấu tick là kết quả bịa: chưa ai chạy mà đã có
 *      đáp án. Đây là `CLAUDE.md` mục không gian lận để PASS, áp vào một khuôn output mới.
 *   ③ Số tự khai ở tiêu đề phải khớp số máy đếm — chỗ mẫu số trôi dễ nhất.
 *   ④ KHÔNG DÒ CHỮ để kiểm luồng sống còn. Bản đầu của gate so tên luồng với văn bản các mục P1, và nó
 *      báo oan NGAY trên fixture hợp lệ đầu tiên: luồng "Phân quyền" được phủ bởi mục P1 "Đăng nhập vai
 *      Phòng, mở URL trực tiếp → bị chặn", mà mục đó không chứa chữ "phân quyền". Tên luồng là khái niệm
 *      nghiệp vụ, nhãn mục là thao tác cụ thể, hai thứ CỐ Ý khác chữ nhau. Test `luồng được phủ bởi mục
 *      KHÔNG cùng chữ` giữ đúng bài học đó; mất nó thì ai cũng có thể "đơn giản hoá" về lại dò chữ.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cl = require(path.join(REPO, 'scripts/qa/lib/checklist.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const CFG = require(path.join(REPO, '.agent/config/checklist_types.json'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const UIC = require(path.join(REPO, '.agent/config/ui_components.json'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { vagueExpectedLines } = require(path.join(REPO, 'scripts/qa/lib/output_rules.js'));

const PROMPT = path.join(REPO, 'prompt_templates/phase1/05_manual_quick.md');

const HEAD = [
  '| # | ✅ | Hạng mục kiểm tra | Kết quả kỳ vọng | Priority | REQ ID | TC ID liên quan |',
  '|---|---|---|---|---|---|---|',
].join('\n');

type Muc = { so: number; nhan: string; kyVong: string; p?: string; tick?: string };

const MUC_MAU: Muc[] = [
  { so: 1, nhan: 'Đăng nhập tài khoản quản trị trường, cấp THCS', kyVong: 'Vào màn Danh sách, góc phải hiện tên đơn vị', p: 'P1' },
  { so: 2, nhan: 'Đăng nhập sai mật khẩu 5 lần liên tiếp', kyVong: 'Hiện thông báo "Tài khoản tạm khoá"', p: 'P2' },
  /* Mục P1 của nhóm Phân quyền. CỐ Ý không chứa chữ "phân quyền" — đây là ca báo oan đã xảy ra. */
  { so: 3, nhan: 'Đăng nhập vai Phòng, mở URL thêm học sinh trực tiếp', kyVong: 'Bị chặn, về trang thông báo không có quyền', p: 'P1' },
];

/** Dựng checklist Markdown. Mỗi tham số là MỘT biến đổi, để test chỉ đổi đúng thứ nó đang đo. */
function dung(o: {
  loai?: string; soKhai?: number | null; muc?: Muc[]; luong?: string[] | null;
  nhomCuoi?: string; components?: string[][] | null; kyNhan?: boolean;
} = {}) {
  const muc = o.muc ?? MUC_MAU;
  const loai = o.loai ?? 'Smoke';
  const soKhai = o.soKhai === undefined ? muc.length : o.soKhai;
  const luong = o.luong === undefined ? ['Đăng nhập', 'Phân quyền'] : o.luong;
  const nhomCuoi = o.nhomCuoi ?? 'Phân quyền';
  const kyNhan = o.kyNhan ?? true;
  const comps = o.components === undefined
    ? UIC.components.map((c: { ten: string }, i: number) => (i === 0
      ? [c.ten, '1', '—']
      : [c.ten, '—', 'Module này không có thành phần đó, đã rà ngày 09/10/2026.']))
    : o.components;

  const dong = (m: Muc) =>
    `| ${m.so} | ${m.tick ?? '☐'} | ${m.nhan} | ${m.kyVong} | ${m.p ?? 'P2'} | BR-01 | — |`;

  const parts: string[] = ['# Checklist rà tay'];
  if (luong) parts.push('', `**Luồng sống còn:** ${luong.join(' · ')}`);
  parts.push('', `## Quản lý học sinh — Checklist ${loai}${soKhai == null ? '' : ` (${soKhai} mục · ~15 phút)`}`);
  parts.push('', '### Nhóm: Đăng nhập', '', HEAD, ...muc.slice(0, -1).map(dong));
  parts.push('', `### Nhóm: ${nhomCuoi}`, '', HEAD, dong(muc[muc.length - 1]));
  if (comps) {
    parts.push('', '## Component đã rà', '', '| Component | Mục số | Không áp dụng vì |', '|---|---|---|',
      ...comps.map((r) => `| ${r.join(' | ')} |`));
  }
  if (kyNhan) {
    parts.push('', '## Ký nhận', '', '| Môi trường | Build / Version | Người thực hiện | Ngày | Kết quả (Pass/Fail/Blocked) |',
      '|---|---|---|---|---|', '|  |  |  |  |  |');
  }
  return `${parts.join('\n')}\n`;
}

const chay = (md: string) => cl.gateChecklist(cl.parseChecklist(md));
const loc = (xs: string[], re: RegExp) => xs.filter((x) => re.test(x));

/** Bộ mục đủ số lượng cho một loại, giữ nguyên 3 mục đầu (để nhóm và P1 vẫn đúng). */
const nhanBan = (n: number): Muc[] => {
  const out = [...MUC_MAU];
  for (let i = out.length; i < n; i++) {
    out.push({ so: i + 1, nhan: `Lọc lưới theo Khối ${i}`, kyVong: `Số dòng khớp nhãn tổng, ${i} kết quả`, p: 'P3' });
  }
  // Mục cuối phải thuộc nhóm cuối, nên đổi chỗ mục P1 của Phân quyền về cuối.
  const pq = out.splice(2, 1)[0];
  out.push(pq);
  return out.map((m, i) => ({ ...m, so: i + 1 }));
};

test.describe('@infra mode CHECKLIST — khuôn output và 4 tiêu chí', () => {
  test('① DRIFT — bảng ngưỡng trong prompt khớp checklist_types.json', () => {
    const md = fs.readFileSync(PROMPT, 'utf8');
    expect(md, 'prompt phải nêu lệnh chạy gate').toContain('--mode checklist');
    for (const t of CFG.types) {
      const dong = md.split(/\r?\n/).find((l) => l.includes(`**${t.ten}**`) && l.startsWith('|'));
      expect(dong, `prompt thiếu dòng cho loại ${t.ten}`).toBeTruthy();
      expect(String(dong), `${t.ten}: ngưỡng số mục trong prompt lệch config`).toContain(`${t.min} đến ${t.max}`);
      expect(String(dong), `${t.ten}: thời gian trong prompt lệch config`).toContain(`${t.phut} phút`);
    }
  });

  test('config khai đủ và nhất quán', () => {
    expect(CFG.types.map((t: { code: string }) => t.code)).toEqual(['smoke', 'post_hotfix', 'regression', 'release']);
    for (const t of CFG.types) {
      expect(t.min, `${t.code}: min phải nhỏ hơn max`).toBeLessThan(t.max);
      expect(String(t.muc_dich || '').length).toBeGreaterThan(15);
    }
    expect(CFG.priorities).toEqual(['P1', 'P2', 'P3']);
    expect(CFG._gioi_han_da_do, 'giới hạn của tiêu chí 2 phải ghi trong config').toMatch(/KHÔNG đo được/);
  });

  test('CHỐNG BÁO OAN — checklist hợp lệ thì 0 CHẶN, 0 cảnh báo', () => {
    const r = chay(dung({ muc: nhanBan(10) }));
    expect(r.problems, 'một gate báo oan một lần là mất uy tín vĩnh viễn').toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.itemCount).toBe(10);
  });

  test('④ KHÔNG DÒ CHỮ — luồng được phủ bởi mục P1 KHÔNG cùng chữ vẫn phải ĐẠT', () => {
    /*
     * Ca báo oan đã xảy ra, giữ lại nguyên hình. Mục P1 duy nhất của nhóm "Phân quyền" là "Đăng nhập vai
     * Phòng, mở URL thêm học sinh trực tiếp" — không có chữ "phân quyền" nào. Dò chữ thì đỏ; đối chiếu
     * TÊN NHÓM thì xanh. Mất test này là mất luôn bài học.
     */
    const md = dung({ muc: nhanBan(10) });
    expect(md, 'fixture phải giữ đúng đặc tính: nhãn mục không chứa tên luồng').not.toMatch(/Hạng mục.*\n.*phân quyền/i);
    const r = chay(md);
    expect(loc(r.problems, /sống còn|Phân quyền/)).toEqual([]);
  });

  test('luồng khai mà KHÔNG có `### Nhóm` tương ứng: CHẶN', () => {
    const r = chay(dung({ muc: nhanBan(10), luong: ['Đăng nhập', 'Thanh toán'] }));
    const p = loc(r.problems, /Thanh toán/);
    expect(p.length).toBe(1);
    expect(p[0], 'phải nói rõ máy đối chiếu tên nhóm, không dò chữ').toMatch(/TÊN NHÓM/);
  });

  test('nhóm là luồng sống còn mà không mục nào P1: CHẶN', () => {
    const muc = nhanBan(10).map((m) => ({ ...m, p: m.p === 'P1' ? 'P2' : m.p }));
    const r = chay(dung({ muc, luong: ['Đăng nhập', 'Phân quyền'] }));
    expect(loc(r.problems, /KHÔNG mục nào P1/).length).toBe(2);
  });

  test('thiếu hẳn dòng `Luồng sống còn`: CHẶN, và nói rõ vì sao không đoán hộ', () => {
    const r = chay(dung({ muc: nhanBan(10), luong: null }));
    const p = loc(r.problems, /Luồng sống còn/);
    expect(p.length).toBe(1);
    expect(p[0]).toMatch(/dò chữ/);
  });

  test('② Ô TICK đã có dấu lúc sinh: CHẶN', () => {
    const muc = nhanBan(10);
    muc[0] = { ...muc[0], tick: '✅' };
    const r = chay(dung({ muc }));
    const p = loc(r.problems, /ô tick/i);
    expect(p.length).toBe(1);
    expect(p[0], 'phải gọi đúng tên vấn đề: kết quả bịa').toMatch(/bịa/);
  });

  test('ô tick trống ở mọi dạng khai trong config đều được nhận', () => {
    for (const t of CFG.o_tick_trong) {
      const muc = nhanBan(10);
      muc[0] = { ...muc[0], tick: t };
      expect(loc(chay(dung({ muc })).problems, /ô tick/i), `"${t}" là ô trống hợp lệ`).toEqual([]);
    }
  });

  test('③ số tự khai ở tiêu đề lệch số máy đếm: CHẶN', () => {
    const r = chay(dung({ muc: nhanBan(10), soKhai: 14 }));
    const p = loc(r.problems, /khai 14 mục nhưng đếm được 10/);
    expect(p.length).toBe(1);
    expect(p[0], 'phải nêu đúng cơ chế trôi: sửa bảng rồi quên sửa tiêu đề').toMatch(/quên sửa tiêu đề/);
  });

  test('① DÙNG LẠI bộ từ cấm của output_gate, không viết danh sách thứ hai', () => {
    const muc = nhanBan(10);
    muc[0] = { ...muc[0], kyVong: 'hoạt động đúng' };
    const r = chay(dung({ muc }));
    expect(loc(r.problems, /chung chung/).length).toBe(1);
    expect(vagueExpectedLines('hoạt động đúng').length, 'cùng một từ phải trúng ở cả hai gate').toBe(1);
  });

  test('thiếu Kết quả kỳ vọng hoặc thiếu Priority: CHẶN', () => {
    const a = nhanBan(10); a[1] = { ...a[1], kyVong: '' };
    expect(loc(chay(dung({ muc: a })).problems, /thiếu `Kết quả kỳ vọng`/).length).toBe(1);

    const b = nhanBan(10); b[1] = { ...b[1], p: '' };
    expect(loc(chay(dung({ muc: b })).problems, /thiếu Priority/).length).toBe(1);

    const c = nhanBan(10); c[1] = { ...c[1], p: 'Cao' };
    expect(loc(chay(dung({ muc: c })).problems, /Priority "CAO" lạ/).length).toBe(1);
  });

  test('nhãn có BƯỚC ĐÁNH SỐ: CHẶN, vì đó là testcase chứ không phải mục checklist', () => {
    const muc = nhanBan(10);
    muc[1] = { ...muc[1], nhan: '1. Mở màn danh sách 2. Bấm Thêm 3. Điền form rồi Ghi' };
    const r = chay(dung({ muc }));
    expect(loc(r.problems, /bước đánh số/).length).toBe(1);

    const motSo = nhanBan(10);
    motSo[1] = { ...motSo[1], nhan: 'Đăng nhập sai mật khẩu 5 lần liên tiếp' };
    expect(loc(chay(dung({ muc: motSo })).problems, /bước đánh số/), 'một con số lẻ KHÔNG phải bước').toEqual([]);
  });

  test('vượt max: CHẶN kèm gợi ý tách · dưới min: chỉ CẢNH BÁO', () => {
    const vuot = chay(dung({ loai: 'Post-hotfix', muc: nhanBan(16) }));
    const p = loc(vuot.problems, /vượt ngưỡng/);
    expect(p.length).toBe(1);
    expect(p[0], 'chặn thì phải chỉ đường ra').toMatch(/Tách theo module/);

    const thieu = chay(dung({ loai: 'Regression', muc: nhanBan(10) }));
    expect(loc(thieu.problems, /ngưỡng/), 'module nhỏ thật thì ít mục là đúng').toEqual([]);
    expect(loc(thieu.warnings, /dưới ngưỡng/).length).toBe(1);
  });

  test('tiêu đề KHÔNG khai loại: CHẶN, vì không có ngưỡng nào áp được', () => {
    const r = chay(dung({ loai: 'rà nhanh', muc: nhanBan(10) }));
    const p = loc(r.problems, /KHÔNG khai loại/);
    expect(p.length).toBe(1);
    expect(p[0]).toContain('Smoke');
  });

  test('mọi mã loại trong config đều nhận ra được từ tiêu đề', () => {
    for (const t of CFG.types) {
      expect(cl.loaiTu(`Checklist ${t.ten} (10 mục)`)?.code, `không nhận ra ${t.ten}`).toBe(t.code);
    }
    expect(cl.loaiTu('Checklist gì đó'), 'chuỗi lạ phải trả null, không đoán bừa').toBeNull();
  });

  test('③ bảng Component: thiếu bảng, thiếu dòng, hoặc dòng rỗng cả hai cột đều CHẶN', () => {
    const khongBang = chay(dung({ muc: nhanBan(10), components: null }));
    expect(loc(khongBang.problems, /Thiếu bảng `Component`/).length).toBe(1);
    expect(loc(khongBang.problems, /[Ii]m lặng/)[0], 'phải nói vì sao không được im lặng').toMatch(/quên rà/);

    const thieuDong = UIC.components.slice(1).map((c: { ten: string }) => [c.ten, '1', '—']);
    const r2 = chay(dung({ muc: nhanBan(10), components: thieuDong }));
    const p2 = loc(r2.problems, /chưa có dòng trong bảng Component/);
    expect(p2.length).toBe(1);
    expect(p2[0], 'phải kèm điều kiện kích hoạt để người đọc tự quyết').toMatch(/kích hoạt khi/);

    const rong = UIC.components.map((c: { ten: string }) => [c.ten, '—', '—']);
    expect(loc(chay(dung({ muc: nhanBan(10), components: rong })).problems, /không ghi mục nào/).length)
      .toBe(UIC.components.length);
  });

  test('lý do không áp dụng quá ngắn cũng bị bắt', () => {
    const ngan = UIC.components.map((c: { ten: string }, i: number) => (i === 0 ? [c.ten, '1', '—'] : [c.ten, '—', 'không có']));
    const r = chay(dung({ muc: nhanBan(10), components: ngan }));
    expect(r.problems.length).toBe(UIC.components.length - 1);
  });

  test('thiếu bảng ký nhận: CẢNH BÁO, không chặn', () => {
    const r = chay(dung({ muc: nhanBan(10), kyNhan: false }));
    expect(loc(r.problems, /ký nhận/)).toEqual([]);
    expect(loc(r.warnings, /ký nhận/).length).toBe(1);
  });

  test('file KHÔNG phải checklist: bỏ qua sạch, không báo oan', () => {
    const r = chay('# Ghi chú\n\nMột đoạn văn bình thường, không có bảng nào.\n');
    expect(r.found).toBe(false);
    expect(r.problems).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
});
