'use strict';

/*
 * TƯỜNG LỬA GHI cho Bước 0 — Khám phá hệ thống (v2.6.0 §A3).
 *
 * ĐIỀU KIỆN DỪNG CỦA CẢ ĐỢT: chưa chứng minh được trên fixture là chặn 100% request ghi thì KHÔNG chạm
 * UAT. Nên file này viết TRƯỚC crawler, và spec của nó là spec đầu tiên phải xanh.
 *
 * Vì sao an toàn của discovery phải nằm ở TẦNG NETWORK, không nằm ở lời dặn:
 *   Kit A dặn agent "mở form xem field là đủ, KHÔNG bấm Save". Lời dặn đó đúng nhưng không kiểm được, và
 *   một lượt bò tự động thì bấm hàng trăm phần tử — trong đó có nút mà nhãn không giống nút ghi (icon
 *   thùng rác không có chữ, "Tiếp tục" ở bước cuối wizard, link "Xác nhận" trong toast). Danh sách nút
 *   cấm bấm là lớp phòng vệ THỨ HAI. Lớp thứ nhất là: mọi request không phải GET/HEAD/OPTIONS bị abort
 *   trước khi ra mạng, và không có cờ nào tắt được.
 *
 * BA LỚP, theo thứ tự đáng tin cậy giảm dần:
 *   ① `page.route('**\/*')` abort theo method        — tất định, không phụ thuộc nhãn hay DOM
 *   ② danh sách nút cấm bấm theo accessible name     — chặn trước khi bấm, để không phá state phía client
 *   ③ chặn tải file và cửa sổ ngoài domain           — hai đường rò còn lại
 *
 * Request bị chặn KHÔNG chỉ là log an toàn, nó là DỮ LIỆU: "nút này ghi dữ liệu". Mỗi bản ghi mang nút
 * đã gây ra nó, để `fuse` biết màn nào có hành vi ghi và để đề xuất bổ sung `nut_cam_bam`.
 */
const fs = require('fs');
const path = require('path');

const CFG_PATH = path.resolve(__dirname, '..', '..', '..', '.agent', 'config', 'discovery.json');

function napCfg(duongDan) {
  const p = duongDan || CFG_PATH;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const k of ['tuong_lua', 'nut_cam_bam', 'nhan_dien_prod']) {
    if (!j[k]) throw new Error(`[firewall] ${p} thiếu khối \`${k}\` — tường lửa KHÔNG chạy với config khuyết, vì khuyết nghĩa là một lớp phòng vệ im lặng biến mất.`);
  }
  return j;
}

/**
 * Chuẩn hoá nhãn để so sánh: NFC → bỏ dấu → hạ chữ → gom khoảng trắng.
 *
 * Vì sao NFC trước: nhãn tiếng Việt trong DOM có cả dạng tổ hợp (`o` + dấu) và dạng dựng sẵn (`ố`). Hai
 * chuỗi "Xoá" trông y hệt nhau mà `===` trả false. Kit đã trả giá cho chuyện này nhiều lần ở phép đo UI.
 */
function chuanHoa(s) {
  return String(s == null ? '' : s)
    .normalize('NFC')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Nhãn này có nằm trong danh sách nút cấm bấm? Khớp theo TỪ trọn, không khớp chuỗi con.
 *
 * NGOẠI LỆ CHỈ-ĐỌC xét TRƯỚC. Lý do đo được khi viết hàm này: `"ghi"` phải nằm trong danh sách vì QEMIS
 * có nút **"Ghi"** ở cả 5 cấp học — đó là nút lưu thật. Nhưng `"ghi"` cũng đứng thành TỪ RIÊNG trong
 * những nhãn chỉ-đọc (`"Ghi chú"`, `"Ghi nhận"`), nên khớp theo ranh giới từ chặn oan chúng và làm lượt
 * bò MẤT MÀN. Bỏ `"ghi"` thì mất nút lưu thật ở 5 cấp. Nên: giữ, và khai ngoại lệ tường minh trong
 * config.
 *
 * Ngoại lệ KHÔNG làm yếu an toàn, vì đây là lớp phòng vệ thứ hai: nếu một nhãn trong danh sách ngoại lệ
 * hoá ra có ghi dữ liệu thì request ghi của nó vẫn bị lớp thứ nhất (abort theo method) chặn. Giá của
 * ngoại lệ là độ phủ lượt bò, không phải an toàn.
 */
function laNutCamBam(nhan, cfg) {
  const n = chuanHoa(nhan);
  if (!n) return null;
  for (const mien of (cfg.nhan_chi_doc_khong_chan || [])) {
    if (n === chuanHoa(mien)) return null;
  }
  for (const cam of cfg.nut_cam_bam) {
    const c = chuanHoa(cam);
    if (!c) continue;
    /*
     * Khớp theo RANH GIỚI TỪ, không `includes`. Lý do đo được: `includes('ghi')` trúng cả "Ghi chú",
     * "Đăng ký", "Nghi vấn" — chặn oan ba nhãn chỉ-đọc và làm lượt bò mất màn. Còn `=== ` thì bỏ sót
     * "Lưu và đóng". Ranh giới từ bắt đúng cả hai phía.
     */
    if (new RegExp(`(^|[^a-z0-9])${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(n)) return cam;
  }
  return null;
}

/**
 * Host này có được phép bò không? Trả `{ duoc, vi_sao }`.
 *
 * HAI chiều, không một chiều: phải khớp dấu hiệu non-prod VÀ không khớp dấu hiệu prod. Host không khớp
 * dấu hiệu nào ⇒ TỪ CHỐI. "Không phán được" không thành "được phép" — cùng luật với verdict (CLAUDE.md §3).
 */
function kiemTarget(url, cfg, coCo) {
  const nd = cfg.nhan_dien_prod;
  let host;
  try { host = new URL(String(url)).host.toLowerCase(); } catch (e) {
    return { duoc: false, vi_sao: `URL không đọc được: ${String(url).slice(0, 80)}` };
  }
  const prod = (nd.dau_hieu_prod || []).filter((d) => host.includes(String(d).toLowerCase()));
  if (prod.length) return { duoc: false, vi_sao: `host "${host}" khớp dấu hiệu PROD (${prod.join(', ')}) — tuyệt đối không bò`, host };
  const np = (nd.dau_hieu_non_prod || []).filter((d) => host.includes(String(d).toLowerCase()));
  if (!np.length) {
    return { duoc: false, vi_sao: `host "${host}" KHÔNG khớp dấu hiệu non-prod nào (${(nd.dau_hieu_non_prod || []).join(', ')}) — không đoán, hãy thêm dấu hiệu vào \`discovery.json\` nếu host này thật sự là non-prod`, host };
  }
  if (!coCo) {
    return { duoc: false, vi_sao: `host "${host}" trông là non-prod (khớp: ${np.join(', ')}) nhưng THIẾU cờ ${nd.can_co_co} (hoặc ${nd.bien_moi_truong}=1). Dấu hiệu tên host không thay được một lượt xác nhận của người.`, host };
  }
  return { duoc: true, vi_sao: `host "${host}" khớp non-prod (${np.join(', ')}) và đã có ${nd.can_co_co}`, host };
}

/** Khuôn glob đơn giản (`**`, `*`) → RegExp. Dùng cho `endpoint_dang_nhap_cho_phep`. */
function globRe(g) {
  const esc = String(g).replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${esc.replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*')}$`, 'i');
}

/**
 * Gắn tường lửa vào một `page` của Playwright.
 *
 * Trả về một `bienBan` (sổ ghi) sống suốt lượt bò:
 *   `chan`      — request ghi đã bị abort, kèm nút gây ra nó
 *   `nutDaChan` — lượt bấm đã bị từ chối vì nhãn nằm trong danh sách
 *   `taiFile` / `cuaSoNgoai` — hai đường rò còn lại
 *
 * `datNutDangBam(nhan)` do crawler gọi NGAY TRƯỚC khi bấm, để quy được request cho nút nào. Không có nó
 * thì sổ vẫn đúng về số lượng nhưng mất phần "nút nào ghi dữ liệu" — tức mất phần dữ liệu có giá trị nhất.
 */
async function install(page, tuyChon) {
  const cfg = (tuyChon && tuyChon.cfg) || napCfg(tuyChon && tuyChon.cfgPath);
  const tl = cfg.tuong_lua;
  const methodOk = new Set((tl.method_cho_phep || []).map((m) => String(m).toUpperCase()));
  const loginRe = (tl.endpoint_dang_nhap_cho_phep || []).map(globRe);
  const domainChoPhep = (tuyChon && tuyChon.domainChoPhep) || [];

  const bienBan = {
    chan: [], nutDaChan: [], taiFile: [], cuaSoNgoai: [], choQua: [],
    nutDangBam: null,
    datNutDangBam(nhan) { this.nutDangBam = nhan == null ? null : String(nhan); },
    /** Nhãn này có bị cấm bấm? Crawler PHẢI gọi trước mỗi lượt bấm. */
    duocBam(nhan) {
      const cam = laNutCamBam(nhan, cfg);
      if (cam) { this.nutDaChan.push({ nhan: String(nhan), khop: cam, luc: Date.now() }); return false; }
      return true;
    },
    get soRequestGhiLot() { return this.choQua.filter((r) => !methodOk.has(r.method)).length; },
    tomTat() {
      return {
        request_ghi_bi_chan: this.chan.length,
        request_ghi_lot: this.soRequestGhiLot,
        nut_bi_tu_choi: this.nutDaChan.length,
        tai_file_bi_chan: this.taiFile.length,
        cua_so_ngoai_bi_chan: this.cuaSoNgoai.length,
        nut_co_hanh_vi_ghi: [...new Set(this.chan.map((c) => c.nut).filter(Boolean))],
      };
    },
  };

  await page.route('**/*', async (route) => {
    const req = route.request();
    const method = String(req.method() || '').toUpperCase();
    const url = req.url();

    if (methodOk.has(method)) { bienBan.choQua.push({ method, url }); return route.continue(); }

    // Ngoại lệ DUY NHẤT: đăng nhập / refresh token, khai tường minh theo khuôn đường dẫn.
    if (loginRe.some((re) => re.test(url))) {
      bienBan.choQua.push({ method, url, ngoai_le: 'dang_nhap' });
      return route.continue();
    }

    bienBan.chan.push({ method, url, nut: bienBan.nutDangBam, luc: Date.now() });
    return route.abort('blockedbyclient');
  });

  if (tl.chan_tai_file) {
    page.on('download', (d) => {
      bienBan.taiFile.push({ ten: d.suggestedFilename(), url: d.url() });
      d.cancel().catch(() => {});
    });
  }

  if (tl.chan_cua_so_ngoai_domain) {
    page.on('popup', async (p) => {
      const u = p.url();
      let host = '';
      try { host = new URL(u).host; } catch (e) { host = ''; }
      const trongDomain = domainChoPhep.some((d) => host.endsWith(String(d)));
      if (!trongDomain) { bienBan.cuaSoNgoai.push({ url: u, host }); await p.close().catch(() => {}); }
    });
  }

  return bienBan;
}

module.exports = { install, laNutCamBam, kiemTarget, chuanHoa, napCfg, globRe };
