#!/usr/bin/env node
/**
 * probe_to_page.js — biến artifact KHÁM PHÁ thành bản đồ field DÙNG ĐƯỢC cho spec.
 *
 * ===================================================================================================
 * VÌ SAO CÓ FILE NÀY
 * ===================================================================================================
 *
 * Kit có đủ hai đầu mà thiếu khúc giữa:
 *
 *   · đầu khám phá — `ui_debug_agent` dò DOM thật, đẻ ra `_probe/form-<cấp>.fields.json`
 *     (mỗi field: số thứ tự, nhãn, id, kiểu, bắt buộc, maxlength, validator)
 *   · đầu chạy — spec Playwright neo element bằng `[id$="<đuôi id>"]`
 *
 * Khúc giữa hiện là NGƯỜI GÕ LẠI BẰNG TAY. Đo 09/10/2026 trên CSDL-9003: `lib/csdl9003Form.ts` có bảng
 * `O` gõ tay ~42 ô, trong khi probe đã đo 58–72 ô cho MỖI cấp trong 5 cấp. Và chính comment trong bảng
 * tay đó ghi lại hai lần trả giá:
 *
 *     "bản đồ đầu tiên của tôi bỏ sót, và phép đọc ngược 31 trường không nhìn thấy chúng —
 *      mẫu số là danh sách do CHÍNH TÔI khai ra"
 *     "bản dò đầu tiên trỏ nhầm vào ô ẩn vì nó chỉ loại type=hidden"
 *
 * Cả hai đều là bệnh mẫu-số-tự-khai: bản đồ do người gõ thì "đủ" chỉ có nghĩa "người gõ thấy đủ".
 * Script này lấy mẫu số từ phép ĐO, không từ trí nhớ.
 *
 * ===================================================================================================
 * NÓ KHÔNG LÀM ĐƯỢC GÌ — đọc trước khi tin
 * ===================================================================================================
 *
 *  1. `hidden` của probe KHÔNG bắt được ô ẩn bằng CSS. Đo: `form-trung-hoc-pho-thong.fields.json` khai
 *     `hidden=true: 0`, trong khi bảng tay ghi rõ `tbThonXom` "tồn tại trong trang nhưng đang bị ẩn
 *     (ẩn bằng CSS)". Vậy field sinh ra ở đây CÓ THỂ là ô ẩn. Muốn chắc thì phải đo lại trên DOM sống.
 *  2. Nó KHÔNG biết field nằm ở tab nào. Bảng tay có cột `tab` vì đã trả giá: "điền một lượt mà không
 *     chuyển tab thì 13 ô trượt". Probe hiện không ghi tab ⇒ cột đó vẫn phải do người điền.
 *  3. Nó KHÔNG phải oracle. `validators` chép lại chuỗi app tự hiện; dùng nó làm kỳ vọng là app==app.
 *     Kỳ vọng phải neo vào đặc tả (`BR-`/`SM-`/`UI-`).
 *  4. `required` lấy từ cờ `required` của probe (mốc số thứ tự ĐỎ trên màn) — KHÔNG suy từ việc có hay
 *     không có validator. Suy ngược như vậy là sai nhân quả, đã có note riêng về chuyện này.
 *
 * ===================================================================================================
 * DÙNG
 * ===================================================================================================
 *
 *   node scripts/qa/probe_to_page.js --probe <thư mục _probe> --out <file .ts>
 *   node scripts/qa/probe_to_page.js --probe <thư mục _probe> --doi-chieu <file .ts có bảng tay>
 *
 * `--doi-chieu` không sinh gì cả: nó chỉ so bảng tay với phép đo rồi in ra chỗ lệch.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------------------------
// Tham số
// ---------------------------------------------------------------------------------------------

function layThamSo(ten, macDinh = null) {
  const i = process.argv.indexOf(ten);
  if (i === -1) return macDinh;
  const v = process.argv[i + 1];
  if (!v || v.startsWith('--')) throw new Error(`Thiếu giá trị cho ${ten}`);
  return v;
}

/** Quá hạn: bản probe cũ hơn ngần này ngày thì mọi kết luận rút từ nó phải kèm nghi ngờ. */
const NGUONG_CU = Number(layThamSo('--han', '7'));

const THU_MUC_PROBE = layThamSo('--probe');
const DUONG_RA = layThamSo('--out');
const DOI_CHIEU = layThamSo('--doi-chieu');

if (!THU_MUC_PROBE) {
  console.error('[probe→page] Thiếu --probe <thư mục chứa form-*.fields.json>.');
  process.exit(2);
}
if (!DUONG_RA && !DOI_CHIEU) {
  console.error('[probe→page] Cần --out <file .ts> hoặc --doi-chieu <file .ts>.');
  process.exit(2);
}

// ---------------------------------------------------------------------------------------------
// Chuẩn hoá nhãn tiếng Việt thành khoá
// ---------------------------------------------------------------------------------------------

/**
 * Bỏ dấu bằng NFD rồi gỡ dấu tổ hợp. `đ/Đ` KHÔNG phải nguyên âm có dấu nên NFD không tách được, phải
 * thay tay — quên chỗ này thì "Định danh" ra "inhDanh".
 */
function boDau(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function thanhKhoa(nhan) {
  const tu = boDau(String(nhan || ''))
    .replace(/[^0-9a-zA-Z]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!tu.length) return '';
  return tu
    .map((t, i) => (i === 0 ? t.toLowerCase() : t[0].toUpperCase() + t.slice(1).toLowerCase()))
    .join('');
}

/** Đuôi id mà spec dùng để neo: `[id$="<đuôi>"]`. ASP.NET nối tiền tố bằng `_`, nên lấy đoạn cuối. */
function duoiId(id) {
  const s = String(id || '');
  return s.includes('_') ? s.split('_').pop() : s;
}

// ---------------------------------------------------------------------------------------------
// Đọc probe
// ---------------------------------------------------------------------------------------------

function docProbe(thuMuc) {
  const tep = fs
    .readdirSync(thuMuc)
    .filter((f) => /^form-.*\.fields\.json$/.test(f))
    .sort();
  if (!tep.length) throw new Error(`Không thấy file form-*.fields.json nào trong ${thuMuc}`);

  const theoCap = {};
  const canhBao = [];

  for (const f of tep) {
    const cap = f.replace(/^form-/, '').replace(/\.fields\.json$/, '');
    const thoGoc = JSON.parse(fs.readFileSync(path.join(thuMuc, f), 'utf8'));

    /*
     * GỠ BẢN GHI LẶP NGUYÊN BẢN — chính dữ liệu probe có.
     *
     * Đo 09/10/2026 ở `form-mam-non.fields.json`: "HS tuyển mới" xuất hiện HAI lần, giống nhau từng
     * ký tự (cùng `so: 28`, cùng `id`, cùng `kind`). Đó là script dò bắt trúng một ô hai lượt, không
     * phải hai ô thật. Không gỡ thì bản đồ sinh ra có hai khoá y hệt nhau và khoá sau ĐÈ khoá trước —
     * im lặng, đúng cái bệnh script này sinh ra để chữa.
     */
    const thay = new Set();
    const tho = [];
    let soLap = 0;
    for (const x of thoGoc) {
      const chuKy = `${x.id}|${x.so}|${x.label}|${x.kind}`;
      if (thay.has(chuKy)) { soLap++; continue; }
      thay.add(chuKy);
      tho.push(x);
    }
    if (soLap) canhBao.push(`${cap}: gỡ ${soLap} bản ghi LẶP NGUYÊN BẢN trong chính file probe`);

    // Mục KHÔNG có id là TIÊU ĐỀ KHỐI ("Thông tin cư trú", "Thông tin khác"), không phải field.
    // Bỏ chúng đi, nhưng ĐẾM và báo — bỏ im lặng là lại tự đặt mẫu số.
    const tieuDeKhoi = tho.filter((x) => !x.id);
    const field = tho.filter((x) => x.id);

    const ban = {};
    const dungKhoa = new Map();

    for (const x of field) {
      const nhan = String(x.label || '').normalize('NFC').trim();
      const duoi = duoiId(x.id);
      let khoa = thanhKhoa(nhan) || thanhKhoa(duoi);

      /*
       * NHÃN TRÙNG LÀ CÓ THẬT, và trùng theo một kiểu nguy hiểm. Đo ở THPT: 5 cặp trùng nhãn, mà cặp
       * nào cũng là `rcbTinh` ↔ `rcbTinhOld`, `rcbNoiSinhTinh` ↔ `rcbNoiSinhTinhOld` — app giữ cả biến
       * thể địa chỉ CŨ và MỚI trên cùng một form. Khoá theo nhãn trần thì hai ô đè nhau và bản đồ bốc
       * ô nào là chuyện may rủi, im lặng. Nên: trùng thì GIỮ CẢ HAI, phân biệt bằng đuôi id.
       */
      if (dungKhoa.has(khoa)) {
        const cu = dungKhoa.get(khoa);
        if (ban[khoa]) {
          const khoaCu = `${khoa}__${cu}`;
          ban[khoaCu] = ban[khoa];
          delete ban[khoa];
          canhBao.push(`${cap}: nhãn "${nhan}" trùng ⇒ tách thành ${khoaCu} + ${khoa}__${duoi}`);
        }
        khoa = `${khoa}__${duoi}`;
      }
      dungKhoa.set(thanhKhoa(nhan) || thanhKhoa(duoi), duoi);

      /*
       * CHỐT CUỐI: tách kiểu gì cũng KHÔNG được đè. Hai field trùng cả nhãn LẪN đuôi id thì nhánh tách
       * ở trên đẻ ra đúng một khoá cho cả hai — nên phải có thêm chốt này, và phải BÁO chứ không im.
       */
      if (ban[khoa]) {
        let i = 2;
        while (ban[`${khoa}_${i}`]) i++;
        canhBao.push(`${cap}: khoá "${khoa}" vẫn đụng sau khi tách ⇒ đặt "${khoa}_${i}" (không đè, nhưng ĐÁNG NGỜ — soi lại probe)`);
        khoa = `${khoa}_${i}`;
      }

      ban[khoa] = {
        so: String(x.so ?? ''),
        nhan,
        id: String(x.id),
        duoiId: duoi,
        kieu: String(x.kind || ''),
        batBuoc: !!x.required,
        maxlength: String(x.maxlength || ''),
        an: !!x.hidden,
        validators: Array.isArray(x.validators) ? x.validators : [],
      };
    }

    /*
     * TUỔI CỦA NGUỒN, không phải tuổi của lượt sinh.
     *
     * Đo 09/10/2026 và suýt kết luận ngược: bản đồ sinh ra bảo 6 ô địa chỉ của bảng tay "không tồn tại",
     * nhưng log lượt chạy THẬT ngày 06/10 báo 0 ô không điền được — tức chúng sống. Chênh lệch là vì
     * `form-*.html` chụp ngày 25/09, cũ hơn lượt chạy 11 ngày. Bản đồ sinh từ nguồn cũ thì CŨ THEO, và
     * dấu "sinh lúc" không nói lên điều đó — nó chỉ nói hôm nay tôi bấm nút.
     *
     * Nên đóng dấu mtime của CHÍNH file probe, và kêu khi nó quá hạn.
     */
    /*
     * ĐƠN VỊ của bản dò — thứ quan trọng ngang ngày tháng, và trước 09/10/2026 KHÔNG được ghi ở đâu cả.
     *
     * Chuyện đã xảy ra: bản đồ dựng từ dump của **TEST 1 · Phú Thọ**, spec thật chạy ở **Đức Trí · TP.HCM**,
     * còn script dò thì tự đăng nhập vào **Elite · Hà Nội** — ba đơn vị, không máy nào thấy. Hậu quả đo
     * được: ở TEST 1 có 10 trường mang mốc đỏ bắt buộc, ở Đức Trí có 31. Lấy bản đồ của trường này áp cho
     * trường kia là sai mẫu số ngay từ gốc, mà mọi con số phía sau vẫn trông bình thường.
     */
    const metaPath = path.join(thuMuc, f.replace(/\.fields\.json$/, '.meta.json'));
    let donVi = null;
    if (fs.existsSync(metaPath)) {
      try {
        const m = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        donVi = [m?.dinhDung?.so, m?.dinhDung?.truong].filter(Boolean).join(' · ') || null;
      } catch (e) { donVi = null; }
    }

    const nguonHtml = path.join(thuMuc, f.replace(/\.fields\.json$/, '.html'));
    const mt = fs.existsSync(nguonHtml) ? fs.statSync(nguonHtml).mtime : fs.statSync(path.join(thuMuc, f)).mtime;
    const tuoiNgay = Math.floor((Date.now() - mt.getTime()) / 86400000);

    theoCap[cap] = {
      ban,
      soField: field.length,
      soTieuDe: tieuDeKhoi.length,
      nguon: f,
      chupLuc: mt.toISOString().slice(0, 10),
      tuoiNgay,
      donVi,
    };
  }

  return { theoCap, canhBao };
}

// ---------------------------------------------------------------------------------------------
// Sinh file TS
// ---------------------------------------------------------------------------------------------

function sinhTs({ theoCap, canhBao }, thuMucProbe) {
  const caps = Object.keys(theoCap).sort();
  const nay = new Date().toISOString().slice(0, 10);

  const L = [];
  L.push('/* eslint-disable */');
  L.push('/**');
  L.push(' * SINH TỰ ĐỘNG — ĐỪNG SỬA TAY.');
  L.push(' *');
  L.push(` * Nguồn: ${thuMucProbe.replace(/\\/g, '/')}/form-*.fields.json (artifact của ui_debug_agent)`);
  L.push(` * Sinh lại: npm run probe:page`);
  L.push(` * Sinh lúc: ${nay}  ← ngày BẤM NÚT, không phải ngày biết app`);
  L.push(' *');
  L.push(' * NGÀY CHỤP + ĐƠN VỊ theo từng cấp — hai thứ quyết định bản đồ này tả đúng cái gì:');
  for (const cap of caps) {
    const v = theoCap[cap];
    L.push(` *   ${cap.padEnd(24)} ${v.chupLuc} (${v.tuoiNgay}d)${v.tuoiNgay > NGUONG_CU ? ' ⚠CŨ' : '    '}  ${v.donVi || '⚠ KHÔNG RÕ ĐƠN VỊ'}`);
  }
  const dsDonVi = [...new Set(caps.map((c) => theoCap[c].donVi || 'KHÔNG RÕ'))];
  if (dsDonVi.length > 1) {
    L.push(' *');
    L.push(' * ⚠⚠ BẢN ĐỒ NÀY TRỘN NHIỀU ĐƠN VỊ — các cấp KHÔNG so sánh được với nhau:');
    for (const d of dsDonVi) L.push(` *      · ${d}`);
    L.push(' *   Đo 09/10/2026: cùng cấp THPT, TEST 1 (Phú Thọ) có 10 trường mốc-đỏ bắt buộc, còn Đức Trí');
    L.push(' *   (TP.HCM) có 31. Lấy bản đồ trường này áp cho trường kia là sai mẫu số ngay từ gốc.');
  }
  L.push(' *');
  L.push(' * App đổi sau ngày chụp thì bản đồ này SAI mà không báo. Đã xảy ra: 6 ô địa chỉ của bảng gõ tay');
  L.push(' * từng bị kết luận nhầm là "không tồn tại", chỉ vì bản dump cũ hơn lượt chạy 11 ngày.');
  L.push(' *');
  L.push(' * Sửa tay ở đây sẽ bị lượt sinh sau ghi đè. Màn đổi thì DÒ LẠI rồi sinh lại — đó mới là điểm');
  L.push(' * của cách làm này: bản đồ field luôn là thứ ĐO ĐƯỢC, không phải thứ nhớ được.');
  L.push(' *');
  L.push(' * GIỚI HẠN (đọc trước khi tin):');
  L.push(' *  · `an` (hidden) KHÔNG bắt được ô ẩn bằng CSS — probe chỉ thấy thuộc tính hidden.');
  L.push(' *  · KHÔNG có thông tin TAB. Form này chia tab, và điền không đúng tab thì ô trượt im lặng.');
  L.push(' *  · `validators` là chuỗi app tự hiện ⇒ KHÔNG dùng làm kỳ vọng (app==app). Oracle neo ở đặc tả.');
  L.push(' */');
  L.push('');
  L.push('export interface OField {');
  L.push('  /** Số thứ tự trên màn. Mốc ĐỎ = bắt buộc — đây là neo quyết định, không suy từ validator. */');
  L.push('  so: string;');
  L.push('  nhan: string;');
  L.push('  /** id đầy đủ trong DOM. */');
  L.push('  id: string;');
  L.push('  /** Đuôi id để neo: scope.locator(`[id$="${duoiId}"]`). */');
  L.push('  duoiId: string;');
  L.push('  kieu: string;');
  L.push('  batBuoc: boolean;');
  L.push('  maxlength: string;');
  L.push('  an: boolean;');
  L.push('  validators: string[];');
  L.push('}');
  L.push('');
  L.push(`export type Cap = ${caps.map((c) => `'${c}'`).join(' | ')};`);
  L.push('');
  L.push('export const FORM_HOC_SINH: Record<Cap, Record<string, OField>> = {');
  for (const cap of caps) {
    const { ban, soField, soTieuDe } = theoCap[cap];
    L.push(`  // ${cap}: ${soField} field (+${soTieuDe} tiêu đề khối, không phải field)`);
    L.push(`  '${cap}': {`);
    for (const [khoa, f] of Object.entries(ban)) {
      L.push(`    ${/^[a-zA-Z_$][\w$]*$/.test(khoa) ? khoa : `'${khoa}'`}: ${JSON.stringify(f)},`);
    }
    L.push('  },');
  }
  L.push('};');
  L.push('');
  L.push('/** Đuôi id → selector neo. Dùng chung cho page và FrameLocator (form nằm trong iframe popup). */');
  L.push('export const neo = (f: OField): string => `[id$="${f.duoiId}"]`;');
  L.push('');
  L.push('/** Các ô BẮT BUỘC của một cấp — mẫu số đo được, không phải danh sách tự khai. */');
  L.push('export const oBatBuoc = (cap: Cap): OField[] =>');
  L.push('  Object.values(FORM_HOC_SINH[cap]).filter((f) => f.batBuoc);');
  L.push('');
  if (canhBao.length) {
    L.push('/*');
    L.push(' * NHÃN TRÙNG đã tách khoá (giữ cả hai, phân biệt bằng đuôi id):');
    for (const c of canhBao) L.push(` *  · ${c}`);
    L.push(' */');
    L.push('');
  }
  return L.join('\n');
}

// ---------------------------------------------------------------------------------------------
// Đối chiếu bảng tay ↔ phép đo
// ---------------------------------------------------------------------------------------------

function doiChieu({ theoCap }, duongBanTay) {
  const ts = fs.readFileSync(duongBanTay, 'utf8');

  // Bảng tay có dạng:  tenO: { id: 'rcbKhoi', kieu: 'combo', tab: TAB1 },
  const banTay = new Map();
  const re = /(\w+)\s*:\s*\{\s*id:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(ts))) banTay.set(m[2], m[1]);

  // Hợp của mọi cấp: một đuôi id chỉ cần xuất hiện ở MỘT cấp là nó có thật.
  const doDuoc = new Map();
  for (const [cap, { ban }] of Object.entries(theoCap)) {
    for (const f of Object.values(ban)) {
      if (!doDuoc.has(f.duoiId)) doDuoc.set(f.duoiId, { nhan: f.nhan, caps: [], batBuoc: f.batBuoc });
      doDuoc.get(f.duoiId).caps.push(cap);
    }
  }

  const thieu = [...doDuoc.keys()].filter((d) => !banTay.has(d));
  const khongThayTrenDom = [...banTay.keys()].filter((d) => !doDuoc.has(d));

  console.log('');
  console.log('=== ĐỐI CHIẾU: bảng gõ tay  ↔  phép đo từ probe ===');
  console.log(`  bảng tay      : ${banTay.size} ô`);
  console.log(`  probe đo được : ${doDuoc.size} ô (hợp của ${Object.keys(theoCap).length} cấp)`);
  console.log('');
  console.log(`  ✗ probe CÓ mà bảng tay KHÔNG có : ${thieu.length}`);
  for (const d of thieu.slice(0, 15)) {
    const x = doDuoc.get(d);
    console.log(`      ${d.padEnd(32)} "${x.nhan}"${x.batBuoc ? '  [BẮT BUỘC]' : ''}`);
  }
  if (thieu.length > 15) console.log(`      … còn ${thieu.length - 15} ô nữa`);
  console.log('');
  console.log(`  ? bảng tay CÓ mà probe KHÔNG thấy: ${khongThayTrenDom.length}`);
  for (const d of khongThayTrenDom) console.log(`      ${d.padEnd(32)} (tên trong bảng tay: ${banTay.get(d)})`);
  console.log('');

  const batBuocBiBoSot = thieu.filter((d) => doDuoc.get(d).batBuoc);
  if (batBuocBiBoSot.length) {
    console.log(`  ⚠ Trong số bỏ sót có ${batBuocBiBoSot.length} ô BẮT BUỘC: ${batBuocBiBoSot.join(', ')}`);
    console.log('');
  }
  return { thieu: thieu.length, khongThayTrenDom: khongThayTrenDom.length };
}

// ---------------------------------------------------------------------------------------------

function main() {
  const duLieu = docProbe(THU_MUC_PROBE);

  let coQuaHan = false;
  for (const [cap, v] of Object.entries(duLieu.theoCap)) {
    const cu = v.tuoiNgay > NGUONG_CU;
    if (cu) coQuaHan = true;
    console.log(
      `[probe→page] ${cap.padEnd(26)} ${String(v.soField).padStart(3)} field  (+${v.soTieuDe} tiêu đề khối)` +
      `  · chụp ${v.chupLuc} (${v.tuoiNgay}d)${cu ? '  ⚠ QUÁ HẠN' : ''}`,
    );
  }
  if (coQuaHan) {
    console.log('');
    console.log(`[probe→page] ⚠ Có bản probe cũ hơn ${NGUONG_CU} ngày. Bản đồ sinh từ nguồn cũ thì CŨ THEO:`);
    console.log('             app đổi sau ngày chụp thì nó sai mà KHÔNG báo. Dò lại trước khi tin một kết luận');
    console.log('             kiểu "ô này không tồn tại" — đã có lần kết luận đó sai vì chính chuyện này.');
    console.log('');
  }
  for (const c of duLieu.canhBao) console.log(`[probe→page] ${c}`);

  if (DOI_CHIEU) {
    doiChieu(duLieu, DOI_CHIEU);
    return;
  }

  const ts = sinhTs(duLieu, THU_MUC_PROBE);
  fs.mkdirSync(path.dirname(DUONG_RA), { recursive: true });
  fs.writeFileSync(DUONG_RA, ts, 'utf8');
  const tong = Object.values(duLieu.theoCap).reduce((s, v) => s + v.soField, 0);
  console.log(`[probe→page] ✓ ghi ${DUONG_RA} — ${tong} field / ${Object.keys(duLieu.theoCap).length} cấp`);
}

main();
