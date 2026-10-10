import { test, expect } from '@playwright/test';
import path from 'path';

/*
 * @infra — TƯỜNG LỬA GHI (v2.6.0 §A3 · §D2). Đây là **điều kiện DỪNG tuyệt đối** của cả đợt v2.6.0:
 * chưa chứng minh được ở đây là chặn 100% request ghi thì KHÔNG được chạm UAT, không ngoại lệ.
 *
 * VÌ SAO AN TOÀN PHẢI NẰM Ở TẦNG NETWORK. Kit A dặn agent "mở form xem field là đủ, KHÔNG bấm Save".
 * Lời dặn đó đúng mà không kiểm được, và một lượt bò tự động bấm hàng trăm phần tử — trong đó có nút mà
 * nhãn không giống nút ghi: icon thùng rác không có chữ, "Tiếp tục" ở bước cuối wizard, "Đồng ý" trong
 * modal. Nên danh sách nút cấm bấm là lớp phòng vệ THỨ HAI; lớp thứ nhất là abort theo method.
 *
 * ĐO BẰNG `store`, KHÔNG ĐO BẰNG SỐ REQUEST BỊ CHẶN. Số request bị chặn chỉ chứng minh tường lửa có
 * CHẠY. Thứ phải chứng minh là nó có TÁC DỤNG — tức bản ghi trong fixture không đổi. Fixture vì vậy là
 * một server có trạng thái thật, và app có ba đường ghi khác nhau để không chứng minh nhầm một đường:
 *   ① `fetch` DELETE  (nút Xoá trên mỗi dòng lưới)
 *   ② `fetch` POST    (nút "Ghi lại qua API" ở form)
 *   ③ submit form POST (nút "Lưu" — đường KHÔNG qua `fetch`, dễ bị bỏ sót nhất)
 */
const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'discovery-app', 'server.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fixture = require(FIXTURE);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fw = require(path.resolve(__dirname, '..', '..', '..', 'scripts', 'qa', 'discovery', 'write_firewall.js'));

type Srv = { url: string; store: { truong: unknown[]; soLanGhi: number; nhatKyGhi: unknown[] }; reset(): void; close(): Promise<void> };

let srv: Srv;
test.beforeAll(async () => { srv = await fixture.start(); });
test.afterAll(async () => { await srv.close(); });
test.beforeEach(() => { srv.reset(); });

test.describe('@infra tường lửa — 0 request ghi lọt, và FIXTURE KHÔNG ĐỔI', () => {
  test('ĐƯỜNG ① fetch DELETE: nút Xoá trên lưới → bị abort, bản ghi còn nguyên', async ({ page }) => {
    const bb = await fw.install(page);
    const truocSo = srv.store.truong.length;

    await page.goto(`${srv.url}/truong`);
    await page.locator('button.nguyhiem', { hasText: 'Xoá' }).first().click();
    await page.waitForTimeout(300);

    expect(bb.chan.length, 'phải có đúng 1 request ghi bị chặn').toBeGreaterThanOrEqual(1);
    expect(bb.chan.some((c: { method: string }) => c.method === 'DELETE')).toBe(true);
    expect(srv.store.soLanGhi, 'server KHÔNG được nhận lượt ghi nào').toBe(0);
    expect(srv.store.truong.length, 'số bản ghi không đổi').toBe(truocSo);
  });

  test('ĐƯỜNG ② fetch POST qua API: bị abort, không bản ghi mới', async ({ page }) => {
    const bb = await fw.install(page);
    await page.goto(`${srv.url}/them-truong`);
    await page.locator('#ten').fill('Trường của gate');
    await page.getByRole('button', { name: 'Ghi lại qua API' }).click();
    await page.waitForTimeout(300);

    expect(bb.chan.some((c: { method: string }) => c.method === 'POST')).toBe(true);
    expect(srv.store.soLanGhi).toBe(0);
    expect(srv.store.truong.map((r: { ten?: string }) => r.ten)).not.toContain('Trường của gate');
  });

  test('ĐƯỜNG ③ submit form POST (nút "Lưu") — đường KHÔNG qua fetch, dễ bỏ sót nhất', async ({ page }) => {
    /*
     * Một `page.route` viết cẩu thả chỉ bắt XHR/fetch và để navigation request đi thẳng. Form submit là
     * navigation. Nếu chỉ test hai đường trên thì tường lửa "xanh" mà vẫn ghi được dữ liệu thật.
     */
    const bb = await fw.install(page);
    await page.goto(`${srv.url}/them-truong`);
    await page.locator('#ten').fill('Ghi bằng form submit');
    await page.getByRole('button', { name: 'Lưu' }).click();
    await page.waitForTimeout(400);

    expect(bb.chan.some((c: { method: string }) => c.method === 'POST'), 'navigation POST cũng phải bị chặn').toBe(true);
    expect(srv.store.soLanGhi, 'form submit KHÔNG được ghi').toBe(0);
    expect(srv.store.nhatKyGhi.length).toBe(0);
  });

  test('cả ba đường trong MỘT lượt: `soRequestGhiLot` = 0', async ({ page }) => {
    const bb = await fw.install(page);
    const truoc = JSON.stringify(srv.store.truong);

    await page.goto(`${srv.url}/truong`);
    await page.locator('button.nguyhiem', { hasText: 'Xoá' }).first().click();
    await page.goto(`${srv.url}/them-truong`);
    await page.getByRole('button', { name: 'Ghi lại qua API' }).click();
    await page.locator('#ten').fill('x');
    await page.getByRole('button', { name: 'Lưu' }).click();
    await page.waitForTimeout(500);

    expect(bb.soRequestGhiLot, 'KHÔNG request ghi nào được cho qua').toBe(0);
    expect(srv.store.soLanGhi).toBe(0);
    expect(JSON.stringify(srv.store.truong), 'dữ liệu fixture nguyên vẹn từng ký tự').toBe(truoc);
    expect(bb.tomTat().request_ghi_lot).toBe(0);
  });

  test('GET KHÔNG bị chặn oan — tường lửa quá tay thì lượt bò ra dữ liệu rỗng', async ({ page }) => {
    /*
     * Phép đối chứng ngược, quan trọng ngang phép thuận: một tường lửa chặn tất cả thì mọi test trên đều
     * xanh, mà discovery lại không đọc được gì và báo "app không có API" — một kết luận sai trông như
     * một lượt bò sạch.
     */
    const bb = await fw.install(page);
    await page.goto(`${srv.url}/truong`);
    await page.waitForTimeout(300);
    const get = bb.choQua.filter((r: { method: string; url: string }) => r.method === 'GET');
    expect(get.length, 'GET phải đi qua').toBeGreaterThan(0);
    expect(get.some((r: { url: string }) => r.url.includes('/api/truong')), 'kể cả GET tới API').toBe(true);
    expect(await page.locator('table tbody tr').count(), 'và trang vẫn render được dữ liệu').toBeGreaterThan(0);
  });

  test('đăng nhập là ngoại lệ DUY NHẤT — POST /login đi qua', async ({ page }) => {
    /* Không mở thì không bò được gì sau màn login. Ngoại lệ khai theo khuôn đường dẫn, không theo phỏng đoán. */
    const bb = await fw.install(page);
    await page.goto(srv.url);
    await page.getByRole('button', { name: 'Đổi vai trò' }).click();
    await page.waitForTimeout(400);

    expect(bb.choQua.some((r: { method: string; ngoai_le?: string }) => r.method === 'POST' && r.ngoai_le === 'dang_nhap'),
      'POST /login phải được cho qua kèm nhãn ngoại lệ').toBe(true);
    expect(bb.chan.some((c: { url: string }) => c.url.includes('/login')), 'và KHÔNG bị ghi vào sổ chặn').toBe(false);
    await expect(page.locator('#vaiTro')).toHaveText('admin');
  });

  test('request ghi bị chặn phải QUY ĐƯỢC cho nút gây ra nó — đó là dữ liệu, không chỉ là log', async ({ page }) => {
    const bb = await fw.install(page);
    await page.goto(`${srv.url}/truong`);
    bb.datNutDangBam('Xoá');
    await page.locator('button.nguyhiem', { hasText: 'Xoá' }).first().click();
    await page.waitForTimeout(300);

    expect(bb.chan[0].nut).toBe('Xoá');
    expect(bb.tomTat().nut_co_hanh_vi_ghi, 'tóm tắt phải nêu nút nào ghi dữ liệu').toContain('Xoá');
  });
});

test.describe('@infra nút cấm bấm — lớp phòng vệ thứ hai', () => {
  const cfg = fw.napCfg();

  test('khớp đúng các nhãn ghi, cả tiếng Việt lẫn tiếng Anh', () => {
    for (const n of ['Lưu', 'Ghi lại', 'Xoá', 'Xóa', 'Huỷ', 'Duyệt', 'Thanh toán', 'Đăng xuất', 'Save', 'Delete', 'Approve']) {
      expect(fw.laNutCamBam(n, cfg), `"${n}" phải bị cấm bấm`).toBeTruthy();
    }
  });

  test('KHÔNG chặn oan nhãn chỉ-đọc có chứa chuỗi con của nhãn ghi', () => {
    /*
     * Ba tầng sai đã đi qua khi viết hàm này:
     *   `includes('ghi')`  → trúng cả "Đăng ký", "Nghi vấn" ⇒ chặn oan, lượt bò mất màn;
     *   `=== `             → bỏ sót "Lưu và đóng";
     *   ranh giới từ       → sửa được hai cái trên, nhưng VẪN chặn oan "Ghi chú" (ở đó "ghi" đứng thành
     *                        từ riêng thật). Đây là ca đỏ thật khi chạy spec lần đầu, 1/8 nhãn.
     * Chỗ này KHÔNG giải được bằng regex khéo hơn: "Ghi" là nút lưu thật của QEMIS ở cả 5 cấp, mà
     * "Ghi chú" là nhãn chỉ-đọc — cùng một từ, hai nghĩa. Nên phải khai NGOẠI LỆ tường minh.
     */
    for (const n of ['Ghi chú', 'Ghi nhận', 'Lưu ý', 'Đăng ký', 'Nghi vấn', 'Xem chi tiết', 'Tải lại trang', 'Lọc', 'Tìm kiếm', 'Quay lại']) {
      expect(fw.laNutCamBam(n, cfg), `"${n}" KHÔNG được bị chặn`).toBeNull();
    }
    expect(fw.laNutCamBam('Lưu và đóng', cfg), '"Lưu và đóng" vẫn phải bị chặn').toBeTruthy();
    expect(fw.laNutCamBam('Ghi', cfg), '"Ghi" trần vẫn phải bị chặn — QEMIS có nút này ở cả 5 cấp').toBeTruthy();
  });

  test('ngoại lệ chỉ-đọc phải KHAI TƯỜNG MINH trong config, không ẩn trong regex', () => {
    /*
     * Một ngoại lệ ẩn trong biểu thức là một lỗ không ai đọc ra. Khai thành danh sách thì nó nằm trong
     * diff, và lượt sau thêm/bớt là chuyện thấy được. Config cũng phải ghi VÌ SAO ngoại lệ không làm yếu
     * an toàn — nó là lớp thứ hai, lớp thứ nhất vẫn abort theo method.
     */
    expect(Array.isArray(cfg.nhan_chi_doc_khong_chan)).toBe(true);
    expect(cfg.nhan_chi_doc_khong_chan).toContain('ghi chú');
    expect(cfg._ngoai_le_co_an_toan_khong, 'phải ghi vì sao ngoại lệ an toàn').toMatch(/LOP THU HAI|lớp thứ hai/i);
  });

  test('nhãn tiếng Việt tổ hợp (NFD) khớp y như dạng dựng sẵn (NFC)', () => {
    /* Hai chuỗi "Xoá" trông y hệt mà `===` trả false. Kit đã trả giá cho chuyện này nhiều lần khi đo UI. */
    const nfd = 'Xoá';
    expect(nfd).not.toBe('Xoá');
    expect(fw.laNutCamBam(nfd, cfg), 'dạng tổ hợp phải khớp').toBeTruthy();
  });

  test('`duocBam()` từ chối và GHI SỔ, không im lặng', async ({ page }) => {
    const bb = await fw.install(page);
    expect(bb.duocBam('Xem chi tiết')).toBe(true);
    expect(bb.duocBam('Xoá')).toBe(false);
    expect(bb.nutDaChan).toHaveLength(1);
    expect(bb.nutDaChan[0].khop).toBeTruthy();
  });
});

test.describe('@infra chặn prod — hai chiều, và "không rõ" KHÔNG thành "được phép"', () => {
  const cfg = fw.napCfg();

  test('host non-prod + có cờ ⇒ cho phép', () => {
    for (const u of ['https://qemis-uat.example.vn/', 'http://localhost:3000/', 'https://app-staging.example.vn/']) {
      expect(fw.kiemTarget(u, cfg, true).duoc, `${u} phải được phép`).toBe(true);
    }
  });

  test('host non-prod mà THIẾU cờ ⇒ từ chối', () => {
    const r = fw.kiemTarget('https://qemis-uat.example.vn/', cfg, false);
    expect(r.duoc).toBe(false);
    expect(r.vi_sao).toMatch(/THIẾU cờ --confirm-nonprod/);
    expect(r.vi_sao, 'và nói rõ dấu hiệu tên host không thay được xác nhận của người').toMatch(/không thay được một lượt xác nhận/);
  });

  test('host có dấu hiệu PROD ⇒ từ chối, kể cả khi có cờ', () => {
    for (const u of ['https://qemis.prod.example.vn/', 'https://www.example.vn/', 'https://production.example.vn/']) {
      const r = fw.kiemTarget(u, cfg, true);
      expect(r.duoc, `${u} phải bị từ chối`).toBe(false);
      expect(r.vi_sao).toMatch(/khớp dấu hiệu PROD/);
    }
  });

  test('host KHÔNG khớp dấu hiệu nào ⇒ TỪ CHỐI, không đoán', () => {
    /*
     * Đây là chỗ dễ làm sai nhất: một host lạ rất dễ được coi là "chắc là UAT". Nhưng discovery BÒ cả
     * app, nên gõ sai host một lần là duyệt hàng trăm trang trên hệ thống thật. "Không phán được" không
     * thành "được phép" — cùng luật với verdict (CLAUDE.md §3).
     */
    const r = fw.kiemTarget('https://qemis.example.vn/', cfg, true);
    expect(r.duoc).toBe(false);
    expect(r.vi_sao).toMatch(/KHÔNG khớp dấu hiệu non-prod nào/);
    expect(r.vi_sao, 'và chỉ đúng chỗ sửa').toMatch(/discovery\.json/);
  });

  test('kit TRƯỚC v2.6.0 chỉ có CỜ, không có nhận diện host — ghi lại để không ai tưởng đã có', () => {
    /*
     * `security_check.js:58` và `load_check.js:46` chỉ đọc `--confirm-nonprod`; grep toàn repo không có
     * heuristic hostname nào. Thiết kế §3 bản đầu viết "tái dùng nhận diện prod của security_check" —
     * câu đó NÓI QUÁ, và đã sửa. Phép kiểm này giữ cho lần sau không ai viết lại câu đó.
     */
    expect(cfg.nhan_dien_prod.dau_hieu_prod.length, 'phải có dấu hiệu prod thật').toBeGreaterThan(0);
    expect(cfg.nhan_dien_prod.dau_hieu_non_prod.length).toBeGreaterThan(0);
    expect(cfg.nhan_dien_prod._khong_ro_thi_sao).toMatch(/TỪ CHỐI/);
  });
});

test.describe('@infra config — khuyết là KHÔNG CHẠY, không chạy với một lớp bị thiếu', () => {
  test('thiếu khối `tuong_lua` ⇒ ném, không im lặng bỏ qua', () => {
    const fs = require('fs');
    const os = require('os');
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fwcfg-'));
    const p = path.join(d, 'discovery.json');
    try {
      fs.writeFileSync(p, JSON.stringify({ nut_cam_bam: [], nhan_dien_prod: {} }), 'utf8');
      expect(() => fw.napCfg(p)).toThrow(/thiếu khối `tuong_lua`/);
      fs.writeFileSync(p, JSON.stringify({ tuong_lua: {}, nhan_dien_prod: {} }), 'utf8');
      expect(() => fw.napCfg(p)).toThrow(/thiếu khối `nut_cam_bam`/);
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('OPTIONS được cho qua — chặn nó là tự làm vỡ mọi lệnh gọi chéo origin', () => {
    const cfg = fw.napCfg();
    expect(cfg.tuong_lua.method_cho_phep).toContain('OPTIONS');
    expect(cfg.tuong_lua._vi_sao_co_options, 'phải ghi vì sao').toMatch(/preflight|Preflight/);
  });
});
