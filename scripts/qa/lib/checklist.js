'use strict';

/*
 * checklist.js — parser và gate cho CHECKLIST RÀ TAY (sub-mode của `05_manual_quick.md`).
 *
 * VÌ SAO TÁCH KHỎI parser testcase canonical: checklist KHÔNG phải bộ testcase. Nó có 7 cột khác hẳn
 * (`# · ✅ · Hạng mục · Kết quả kỳ vọng · Priority · REQ ID · TC ID liên quan`), không có Tiền điều kiện,
 * không có Các bước, và mỗi mục cố ý CHỈ một dòng. Nhét nó vào `scripts/lib/testcase` thì một trong hai
 * bên phải chịu khuôn của bên kia, và bên chịu sẽ là checklist — nó sẽ bị đòi đủ 10 cột canonical rồi
 * chết ngay dòng đầu.
 *
 * NHƯNG KHÔNG VIẾT LẠI LUẬT ĐÃ CÓ: bộ từ "kết quả kỳ vọng chung chung" dùng lại nguyên
 * `vagueExpectedLines` của `output_rules.js`. Hai danh sách từ cấm là hai danh sách lệch nhau.
 *
 * GIỚI HẠN ĐÃ ĐO, nói trước: tiêu chí "critical path đủ" KHÔNG đo được bằng cách máy tự nhận ra luồng nào
 * là sống còn. Máy chỉ gác được LỜI KHAI: checklist phải khai dòng `Luồng sống còn:`, và mỗi luồng đã khai
 * phải có ít nhất một mục P1. Đoán hộ luồng nào quan trọng là dò chữ, và dò chữ trên tiếng Việt đã gây
 * dương tính giả nhiều lần.
 */

const fs = require('fs');
const path = require('path');
const { vagueExpectedLines } = require(path.resolve(__dirname, 'output_rules'));

const CFG = require(path.resolve(__dirname, '..', '..', '..', '.agent', 'config', 'checklist_types.json'));
const UIC = require(path.resolve(__dirname, '..', '..', '..', '.agent', 'config', 'ui_components.json'));

const fold = (s) => String(s || '').normalize('NFC').trim();
const khongDau = (s) => fold(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Bóc một dòng bảng Markdown thành mảng ô. Trả `null` nếu không phải dòng bảng. */
function oCuaDong(line) {
  const t = String(line || '').trim();
  if (!t.startsWith('|')) return null;
  return t.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => fold(c));
}

const laDongPhanCach = (cells) => cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));

/** Tìm loại checklist trong một chuỗi tiêu đề. Khớp theo `ten` rồi `code`, không dấu, không phân biệt hoa thường. */
function loaiTu(chuoi) {
  const s = khongDau(chuoi);
  for (const t of CFG.types) {
    if (s.includes(khongDau(t.ten))) return t;
  }
  for (const t of CFG.types) {
    if (s.includes(t.code.replace(/_/g, '-')) || s.includes(t.code)) return t;
  }
  return null;
}

/**
 * Đọc một file checklist Markdown.
 *
 * Nhận dạng bằng tiêu đề mức 2 có chữ "Checklist". Không có tiêu đề đó thì `found: false` — file này
 * không phải checklist và gate phải bỏ qua, không được báo lỗi oan (cùng cách `design_gate` bỏ qua file
 * không có bảng testcase).
 */
function parseChecklist(md) {
  const lines = String(md || '').split(/\r?\n/);
  const out = {
    found: false,
    type: null,
    tieuDe: '',
    soTuKhai: null,
    phutTuKhai: null,
    luongSongCon: null,
    groups: [],
    items: [],
    components: [],
    coBangKyNhan: false,
  };

  let nhomHienTai = null;
  let trongBangMuc = false;
  let trongBangComponent = false;
  let cotCuaBangMuc = null;

  const batDauNhom = (ten) => { nhomHienTai = { ten, items: [] }; out.groups.push(nhomHienTai); };

  for (const raw of lines) {
    const line = raw;
    const h2 = line.match(/^##\s+(.*)$/);
    const h3 = line.match(/^###\s+(.*)$/);

    if (h2 && /checklist/i.test(h2[1])) {
      out.found = true;
      out.tieuDe = fold(h2[1]);
      out.type = loaiTu(h2[1]);
      const mSo = h2[1].match(/(\d+)\s*mục/i);
      if (mSo) out.soTuKhai = Number(mSo[1]);
      const mPhut = h2[1].match(/(\d+)\s*phút/i);
      if (mPhut) out.phutTuKhai = Number(mPhut[1]);
      trongBangMuc = false; trongBangComponent = false;
      continue;
    }
    if (h3) {
      batDauNhom(fold(h3[1]).replace(/^Nh[óo]m\s*[:：]\s*/i, ''));
      trongBangMuc = false; trongBangComponent = false;
      continue;
    }
    if (h2) {
      // Chỉ tiêu đề có chữ "component" mở vùng bảng component; mọi tiêu đề khác ĐÓNG cả hai vùng.
      trongBangComponent = /component/i.test(h2[1]);
      trongBangMuc = false;
      continue;
    }

    const mLuong = line.match(/^\s*(?:[-*]\s*)?(?:\*\*)?Lu[ồo]ng s[ốo]ng c[òo]n(?:\*\*)?\s*[:：]\s*(.*)$/i);
    if (mLuong) {
      out.luongSongCon = fold(mLuong[1]).split(/·|;|\||,/).map((x) => fold(x.replace(/\*\*/g, ''))).filter(Boolean);
      continue;
    }

    const cells = oCuaDong(line);
    if (!cells) { trongBangMuc = false; continue; }
    if (laDongPhanCach(cells)) continue;

    const dau = khongDau(cells[0]);

    // Đầu bảng mục: ô đầu là `#`, và có cột `Hạng mục`.
    if (dau === '#' && cells.some((c) => /hang muc/.test(khongDau(c)))) {
      trongBangMuc = true; trongBangComponent = false;
      cotCuaBangMuc = cells.map((c) => khongDau(c));
      if (!nhomHienTai) batDauNhom('');
      continue;
    }

    // Đầu bảng component.
    if (/^component$/.test(dau)) { trongBangComponent = true; trongBangMuc = false; continue; }

    // Bảng ký nhận: có cột "Người thực hiện" (hoặc "Người chạy").
    if (cells.some((c) => /nguoi thuc hien|nguoi chay/.test(khongDau(c)))) {
      out.coBangKyNhan = true; trongBangMuc = false; trongBangComponent = false; continue;
    }

    if (trongBangComponent && cells.length >= 2) {
      out.components.push({ ten: cells[0], muc: cells[1] || '', lyDo: cells[2] || '' });
      continue;
    }

    if (trongBangMuc && /^\d+$/.test(dau)) {
      const idx = (ten) => (cotCuaBangMuc || []).findIndex((c) => c.includes(ten));
      const lay = (ten, macDinh) => { const i = idx(ten); return i >= 0 ? (cells[i] || '') : (cells[macDinh] || ''); };
      const it = {
        so: Number(dau),
        tick: cells[1] || '',
        nhan: lay('hang muc', 2),
        kyVong: lay('ky vong', 3),
        priority: lay('priority', 4).toUpperCase().replace(/\s+/g, ''),
        reqId: lay('req', 5),
        tcIds: lay('tc id', 6),
      };
      out.items.push(it);
      if (nhomHienTai) nhomHienTai.items.push(it);
    }
  }

  return out;
}

/** Đếm số từ của một nhãn, sau khi bóc markdown và backtick. */
function soTu(s) {
  return fold(s).replace(/[`*_]/g, '').split(/\s+/).filter(Boolean).length;
}

/** Số lượng mốc "bước đánh số" trong một chuỗi, kiểu `1.` hoặc `2)`. */
function mocBuoc(s) {
  const m = fold(s).match(/(?:^|[\s(])\d+[.)]\s/g);
  return m ? m.length : 0;
}

/**
 * Gate 4 tiêu chí cho một checklist đã parse.
 *
 * Trả `{found, problems, warnings, itemCount}`. Mức CHẶN chỉ dành cho thứ máy biết CHẮC, mức cảnh báo
 * dành cho thứ còn phụ thuộc ngữ cảnh — vì một gate báo oan một lần là mất uy tín vĩnh viễn.
 */
function gateChecklist(cl) {
  const problems = [];
  const warnings = [];
  if (!cl.found) return { found: false, problems, warnings, itemCount: 0 };

  const n = cl.items.length;

  // ── Tiêu chí 4: ĐÚNG QUY MÔ ─────────────────────────────────────────────────────────────────────
  if (!cl.type) {
    problems.push(`Tiêu đề checklist KHÔNG khai loại — phải là một trong ${CFG.types.map((t) => t.ten).join(' · ')}. Không biết loại thì không có ngưỡng số mục nào áp được, và "đủ" lại thành tự nhận.`);
  } else {
    if (n > cl.type.max) {
      problems.push(`${n} mục, vượt ngưỡng ${cl.type.ten} (tối đa ${cl.type.max}, ~${cl.type.phut} phút chạy tay). Checklist dài thì mất đúng công dụng rà nhanh: người chạy bỏ giữa hoặc tick cho xong. Tách theo module, hoặc hạ scope rồi ghi rõ phần đã cắt.`);
    } else if (n < cl.type.min) {
      warnings.push(`${n} mục, dưới ngưỡng ${cl.type.ten} (tối thiểu ${cl.type.min}). Module nhỏ thật thì ít mục là đúng — kiểm lại xem có bỏ sót luồng nào không.`);
    }
  }
  if (cl.soTuKhai == null) {
    warnings.push('Tiêu đề không khai số mục. Nên ghi dạng `(<n> mục · ~<t> phút)` để đối chiếu được.');
  } else if (cl.soTuKhai !== n) {
    problems.push(`Tiêu đề khai ${cl.soTuKhai} mục nhưng đếm được ${n}. Đây là chỗ mẫu số trôi dễ nhất: sửa bảng rồi quên sửa tiêu đề, và báo cáo về sau lấy con số ở tiêu đề.`);
  }
  if (!n) problems.push('Không đọc được mục nào — bảng phải có cột `#` và `Hạng mục kiểm tra`.');

  // ── Tiêu chí 1: VERIFY ĐƯỢC ─────────────────────────────────────────────────────────────────────
  const tickTrong = new Set(CFG.o_tick_trong.map((x) => fold(x)));
  for (const it of cl.items) {
    const nhan = `mục ${it.so}`;
    if (!fold(it.nhan)) problems.push(`${nhan}: ô \`Hạng mục kiểm tra\` rỗng.`);
    if (!fold(it.kyVong)) {
      problems.push(`${nhan}: thiếu \`Kết quả kỳ vọng\` — không có dấu hiệu quan sát được thì người chạy không phán được PASS hay FAIL.`);
    } else {
      const mo = vagueExpectedLines(it.kyVong);
      if (mo.length) problems.push(`${nhan}: kỳ vọng chung chung ("${mo[0]}") — phải nêu dấu hiệu cụ thể trên UI, vd nhãn nút, chuỗi thông báo, URL.`);
    }
    if (it.priority && !CFG.priorities.includes(it.priority)) {
      problems.push(`${nhan}: Priority "${it.priority}" lạ — chỉ nhận ${CFG.priorities.join('/')}.`);
    }
    if (!it.priority) problems.push(`${nhan}: thiếu Priority — không có P1 thì không chứng minh được luồng sống còn đã phủ.`);
    if (!tickTrong.has(fold(it.tick))) {
      problems.push(`${nhan}: ô tick đã có dấu "${fold(it.tick)}" lúc SINH. Checklist xuất ra kèm verdict là kết quả bịa, không ai chạy mà đã có đáp án.`);
    }
    if (mocBuoc(it.nhan) >= 2) {
      problems.push(`${nhan}: nhãn có bước đánh số — mục cần nhiều hơn 3 thao tác mới verify được thì nó là testcase, phải tách hoặc chuyển sang mode QUICK.`);
    }
    if (soTu(it.nhan) > 20) {
      warnings.push(`${nhan}: nhãn ${soTu(it.nhan)} từ, dài hơn mốc 20 — mục dài thì người chạy phải đọc lại hai lần.`);
    }
  }

  // ── Tiêu chí 2: CRITICAL PATH ĐỦ ────────────────────────────────────────────────────────────────
  if (!cl.luongSongCon || !cl.luongSongCon.length) {
    problems.push('Thiếu dòng `Luồng sống còn:` — máy KHÔNG tự biết luồng nào là sống còn của module, và đoán hộ là dò chữ. Khai ra thì mới kiểm được mỗi luồng có mục P1.');
  } else {
    /*
     * KHỚP LUỒNG VỚI NHÓM, KHÔNG DÒ CHỮ TRONG NHÃN MỤC.
     *
     * Bản đầu của chỗ này so tên luồng với văn bản của các mục P1, và nó báo oan NGAY trên fixture hợp lệ
     * đầu tiên: luồng "Phân quyền" được phủ bởi mục P1 "Đăng nhập vai Phòng, mở URL thêm học sinh trực
     * tiếp → bị chặn", mà mục đó không chứa chữ "phân quyền". Tên luồng là khái niệm nghiệp vụ, nhãn mục
     * là thao tác cụ thể — hai thứ cố ý khác chữ nhau, nên so chữ là sai ngay từ tiền đề.
     *
     * Cách đúng: BẮT KHAI HAI ĐẦU. Luồng sống còn phải là một `### Nhóm:` trong checklist, và nhóm đó
     * phải có ít nhất một mục P1. Cả hai đầu đều do người viết khai, nên máy chỉ đối chiếu lời khai.
     */
    for (const l of cl.luongSongCon) {
      const nhom = cl.groups.find((g) => khongDau(g.ten) === khongDau(l));
      if (!nhom) {
        problems.push(`Luồng sống còn "${l}" không có \`### Nhóm: ${l}\` nào trong checklist. Khai luồng mà không có nhóm tương ứng thì không chỉ ra được mục nào phủ nó. (Máy đối chiếu TÊN NHÓM, cố ý không dò chữ trong nhãn mục: tên luồng là khái niệm nghiệp vụ, nhãn mục là thao tác cụ thể.)`);
        continue;
      }
      if (!nhom.items.some((it) => it.priority === 'P1')) {
        problems.push(`Nhóm "${l}" khai là luồng sống còn nhưng KHÔNG mục nào P1. Sống còn thì phải có ít nhất một mục ưu tiên cao nhất.`);
      }
    }
  }

  // ── Tiêu chí 3: COMPONENT ĐỦ ────────────────────────────────────────────────────────────────────
  if (!cl.components.length) {
    problems.push(`Thiếu bảng \`Component\` — ${UIC.components.length} component phải khai từng dòng: hoặc số mục đã phủ, hoặc lý do không áp dụng. Im lặng bỏ qua thì "không áp dụng" và "quên rà" trông giống hệt nhau.`);
  } else {
    const daKhai = cl.components.map((c) => khongDau(c.ten));
    for (const c of UIC.components) {
      const i = daKhai.findIndex((x) => x === khongDau(c.ten));
      if (i < 0) { problems.push(`Component "${c.ten}" chưa có dòng trong bảng Component (kích hoạt khi: ${c.kich_hoat}).`); continue; }
      const row = cl.components[i];
      const coMuc = /\d/.test(row.muc);
      const coLyDo = fold(row.lyDo).replace(/^[—–-]+$/, '').length >= 20;
      if (!coMuc && !coLyDo) {
        problems.push(`Component "${c.ten}": không ghi mục nào đã phủ, cũng không ghi lý do không áp dụng (lý do cần ít nhất 20 ký tự).`);
      }
    }
  }

  if (!cl.coBangKyNhan) {
    warnings.push('Thiếu bảng ký nhận (Môi trường · Build · Người thực hiện · Ngày · Kết quả). Không có nó thì lượt rà không truy được về ai chạy trên build nào.');
  }

  return { found: true, problems, warnings, itemCount: n };
}

function gateChecklistFile(file) {
  const cl = parseChecklist(fs.readFileSync(file, 'utf8'));
  return { ...gateChecklist(cl), type: cl.type };
}

module.exports = { parseChecklist, gateChecklist, gateChecklistFile, CFG, loaiTu, soTu, mocBuoc };
