import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/*
 * @infra — ĐỘ SÂU MỞ RỘNG THEO BAND (H10, phần đã được duyệt).
 *
 * BA THỨ ĐƯỢC KHOÁ, và cái thứ nhất là cái đắt nhất vì nó là một lỗi ĐÃ XẢY RA HAI LẦN:
 *
 *   ① THIẾU BAND KHÔNG ĐƯỢC RƠI XUỐNG TẦNG MỎNG NHẤT. `depth.js` trước đây kết thúc bằng `return 'low'`
 *      kèm comment "gồm cả trường hợp 2 cột đều rỗng: mặc định mỏng nhất". Theo bảng H10, band Low nghĩa
 *      là không mở rộng, rerun một lần, chỉ ảnh cuối — ba điều đó không được quyết bởi một ô trống.
 *      Và header chính file đó đã ghi một lỗi CÙNG HỌ ngày 21/08/2026: thiếu khoá `critical` làm 28 case
 *      ưu tiên cao nhất tụt từ high xuống low, "sai đúng chiều nguy hiểm nhất".
 *
 *   ② MỘT NGUỒN cho danh sách trục. `risk_model.json` và `depth.js` phải khớp. Khai hai nơi thì nơi bị
 *      quên sẽ là nơi không ai đọc, và độ sâu thật khác độ sâu đã duyệt.
 *
 *   ③ RERUN VÀ EVIDENCE KHÔNG ĐỔI. H10 được duyệt CHỈ ở hàng mở rộng. Rerun là bộ lọc flaky, không phải
 *      độ sâu; cắt nó đổi nghĩa của verdict. Ảnh đo được 0,0% khối lượng kết quả tool ở cả bốn lượt chạy
 *      task thật, nên cắt evidence không tiết kiệm token nào. Test này chặn việc lặng lẽ cắt chúng sau này.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const depth = require(path.join(REPO, 'scripts/lib/expansion/depth.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const RISK = require(path.join(REPO, '.agent/config/risk_model.json'));

const BANDS = ['high', 'medium', 'low'] as const;

test.describe('@infra độ sâu mở rộng theo band', () => {
  test('① thiếu band KHÔNG được xử lý trong im lặng — gate phải TỪ CHỐI', () => {
    /*
     * Đã thử đổi mặc định sang 'high' cho an toàn, và `expansion-oracle.spec.ts` ĐỎ: nó khoá đúng hành
     * vi "thiếu cả hai cột ⇒ mỏng nhất, không tự cho là High", kèm lý do thật — tự thăng band là tự nhân
     * chi phí mở rộng và có thể chặn oan bộ TC cũ.
     *
     * Hai lý lẽ hoà được, vì vấn đề thật không phải CHỌN BAND NÀO mà là ĐOÁN TRONG IM LẶNG. Nên hợp đồng
     * là: `bandOf` giữ mặc định mỏng, `thieuBand` nhận ra, và GATE từ chối chạy. Không máy nào quyết hộ.
     */
    expect(depth.bandOf({}), 'mặc định giữ nguyên, không tự thăng band').toBe('low');
    expect(depth.thieuBand({}), 'nhưng PHẢI nhận ra được').toBe(true);
    expect(depth.thieuBand({ priority: '', risk: '' })).toBe(true);
    expect(depth.thieuBand({ priority: 'Cao' }), 'giá trị lạ cũng là không đọc được').toBe(true);
    expect(depth.thieuBand({ priority: 'Low' }), 'đọc được thì không kêu').toBe(false);
    expect(depth.thieuBand({ risk: 'Minor' })).toBe(false);
  });

  test('band đọc được thì vẫn đúng như cũ', () => {
    /*
     * Đo trên 950 case thật của 4 task: high 654 · medium 254 · low 42, và 0 case thiếu band. Lượt này
     * KHÔNG đổi phân bố một case nào — đó là điều kiện để nói H10 không phá gì đang chạy.
     */
    expect(depth.bandOf({ priority: 'Critical' })).toBe('high');
    expect(depth.bandOf({ priority: 'High' })).toBe('high');
    expect(depth.bandOf({ priority: 'Medium' })).toBe('medium');
    expect(depth.bandOf({ priority: 'Low' })).toBe('low');
    expect(depth.bandOf({ priority: 'Lowest' })).toBe('low');
    expect(depth.bandOf({ risk: 'Minor' }), 'cột risk cũ vẫn đọc được cho 17 bộ TC cũ').toBe('low');
    expect(depth.bandOf({ risk: 'Minor', priority: 'High' }), 'lấy cái NẶNG hơn trong hai cột').toBe('high');
  });

  test('② MỘT NGUỒN — risk_model.depthPolicy khớp PLAN của depth.js', () => {
    for (const b of BANDS) {
      const ten = b[0].toUpperCase() + b.slice(1);
      const cfg = RISK.depthPolicy[ten];
      expect(cfg, `depthPolicy thiếu band ${ten}`).toBeTruthy();
      expect(cfg.expansionAxes, `${ten}: trục trong config lệch PLAN của depth.js`).toEqual(depth.PLAN[b]);
    }
    expect(RISK.depthPolicy.UNKNOWN.expansionAxes, 'UNKNOWN đi theo Low, và gate TỪ CHỐI thay vì tự đoán')
      .toEqual(depth.PLAN.low);
    expect(RISK.depthPolicy._UNKNOWN_bang_High, 'quyết định này phải ghi kèm lý do, vì nó từng bị đảo một lần')
      .toMatch(/TU CHOI|TỪ CHỐI/);
    expect(RISK.depthPolicy._nguon_truc, 'quy ước một nguồn phải ghi trong config').toMatch(/depth\.js/);
  });

  test('độ sâu phải GIẢM DẦN theo band, không đảo chiều', () => {
    expect(depth.PLAN.high.length).toBeGreaterThan(depth.PLAN.medium.length);
    expect(depth.PLAN.medium.length).toBeGreaterThanOrEqual(depth.PLAN.low.length);
    expect(depth.axesFor({ priority: 'High' })).toEqual(depth.PLAN.high);
    expect(depth.axesFor({ priority: 'Low' })).toEqual(depth.PLAN.low);
  });

  test('band Low vẫn giữ trục `persist`, và chỗ lệch với bảng H10 được ghi lại', () => {
    /*
     * Bảng trong H10_PROPOSAL ghi band Low là "không mở rộng". Ở đây Low giữ đúng MỘT trục `persist`.
     * Bỏ nó tiết kiệm gần như bằng 0 (42/950 case, và `persist` là trục rẻ nhất vì không phải drive lại
     * UI) nhưng làm mất tầng kiểm DUY NHẤT ở mức bản ghi cho đúng nhóm case ít ai soi. Một chỗ lệch có
     * chủ ý thì phải ghi ra, nếu không lần sau nó bị đọc thành lỗi.
     */
    expect(depth.PLAN.low).toEqual(['persist']);
    expect(RISK.depthPolicy._lech_voi_bang_H10, 'lệch mà không ghi lý do là lệch im lặng').toBeTruthy();
    expect(String(RISK.depthPolicy._lech_voi_bang_H10)).toMatch(/persist/);
  });

  test('③ H10 KHÔNG được cắt rerun — ngưỡng rerun không nằm trong depthPolicy', () => {
    /*
     * Khoá theo HƯỚNG: không có khoá nào dạng rerun trong depthPolicy. Ngày nào ai thêm `rerunCount` theo
     * band là ngày test này đỏ, và người đó phải quay lại đọc vì sao.
     */
    for (const ten of ['High', 'Medium', 'Low', 'UNKNOWN']) {
      const keys = Object.keys(RISK.depthPolicy[ten] || {});
      const rerun = keys.filter((k) => /rerun|retry|lanchay/i.test(k));
      expect(rerun, `${ten}: rerun KHÔNG được khai theo band — nó là bộ lọc flaky, không phải độ sâu`).toEqual([]);
    }
    expect(RISK.depthPolicy._expansionAxes, 'quyết định giữ rerun phải ghi kèm lý do').toMatch(/rerun/i);
  });

  test('③ H10 KHÔNG được cắt evidence — luật 4 của CLAUDE.md còn nguyên', () => {
    const claude = fs.readFileSync(path.join(REPO, 'CLAUDE.md'), 'utf8');
    expect(claude, 'luật evidence đòi ảnh hoặc video cho MỌI case đã execute').toMatch(/PASS và FAIL/);
    for (const ten of ['High', 'Medium', 'Low', 'UNKNOWN']) {
      const keys = Object.keys(RISK.depthPolicy[ten] || {});
      expect(keys.filter((k) => /evidence|anh|video/i.test(k)),
        `${ten}: độ dày evidence KHÔNG được khai theo band`).toEqual([]);
    }
  });

  test('`expansion:plan --enforce` CHẶN khi có case thiếu band', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/expansion_plan.js'), 'utf8');
    expect(src, 'không gọi thieuBand thì case thiếu band bị xử lý trong im lặng').toContain('thieuBand');
    expect(src).toMatch(/KHÔNG đọc được band/);
    expect(src, 'kêu mà không chặn thì cảnh báo sẽ bị bỏ qua').toMatch(/--enforce[\s\S]{0,80}process\.exit\(1\)/);
    expect(src, 'và phải nói rõ hậu quả: tầng mỏng nhất').toMatch(/TẦNG MỎNG NHẤT/);
  });

  test('`expansion:audit` đọc ĐÚNG tên trường TC ID', () => {
    /*
     * Bug đã sửa trong lượt này: `readCases` đọc `t.id` — một trường KHÔNG tồn tại — nên map luôn rỗng,
     * MỌI case báo `unknown`, và mọi dòng "NẾU SIẾT TIẾP" hiện 0/6 đỏ. Một máy đo RỖNG mà kết quả trông
     * yên tâm, trong khi nó là máy dùng để quyết có siết gate hay không. Sau khi sửa: 288 case band high,
     * và hai luật hiện lên đỏ thật.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/expansion_audit.js'), 'utf8');
    expect(src, 'phải đọc tcId của model canonical').toMatch(/t\.tcId/);
    const dong = src.split(/\r?\n/).find((l) => l.includes('const id = String('));
    expect(dong, 'không tìm thấy dòng đọc id').toBeTruthy();
    expect(String(dong).indexOf('t.tcId'), 'tcId phải đứng TRƯỚC t.id trong chuỗi fallback')
      .toBeLessThan(String(dong).indexOf('t.id ||') >= 0 ? String(dong).indexOf('t.id ||') : 1e9);
  });
});
