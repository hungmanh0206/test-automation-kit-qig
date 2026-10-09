import { test, expect } from '@playwright/test';
import path from 'path';

/*
 * @infra — KỸ THUẬT THIẾT KẾ (EP · BVA · DT · ST · UC · EG) có máy kiểm.
 *
 * Vì sao có file này: `02_gen_testcases.md` §2 vốn đã NHẮC TÊN bốn kỹ thuật, nhưng không gì đo xem case có
 * thật sự được thiết kế theo kỹ thuật đó hay không. Nhắc tên là lời dặn, và lời dặn không có máy đứng sau
 * thì lần nào quên cũng không ai biết.
 *
 * HAI THỨ ĐƯỢC KHOÁ Ở ĐÂY, và cái thứ hai mới là cái dễ mất:
 *   ① Hai tầng: bộ CHƯA dùng quy ước thì KHÔNG đỏ (nhưng phải KÊU) · bộ ĐÃ dùng thì thiếu tag là CHẶN.
 *   ② Khớp CHÍNH XÁC, không `includes()`. Đo trên 25 chiều đang khai: `[ST]` là chuỗi con của `bughistory`
 *      và `dbpersist`; `[EG]` là chuỗi con của `negative` và `regression`. Viết `techniquesOf()` theo kiểu
 *      `includes()` như `dimensionsOf()` thì MỌI case `[Negative]` của MỌI bộ cũ bỗng "đã khai kỹ thuật EG" —
 *      một luật mới tự bịa ra dữ liệu để chấm chính nó.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const m = require(path.join(REPO, 'scripts/lib/testcase/model.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { validate } = require(path.join(REPO, 'scripts/lib/testcase/validate.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const CFG = require(path.join(REPO, '.agent/config/design_techniques.json'));

const H = ['TC ID', 'Loại case', 'Tag', 'Module', 'Trường hợp kiểm thử', 'Tiền điều kiện',
  'Dữ liệu Test', 'Các bước thực hiện', 'Kết quả mong đợi', 'Ưu tiên'];

/** Một dòng testcase hợp lệ, chỉ thay ô `Tag` và ô `Dữ liệu Test`. */
const row = (id: string, tag: string, data = 'x = 1') =>
  m.buildTestCase(H, [id, 'Functional', tag, 'M', `TH ${id}`, '[api] Đã có dữ liệu', data,
    '1. Mở màn', '1. Hiện đúng', 'High']);
const bo = (rows: unknown[]) => ({ headers: H, tests: rows });
const loc = (xs: string[], re: RegExp) => xs.filter((x) => re.test(x));

test.describe('@infra kỹ thuật thiết kế — danh sách đọc từ config, không chép vào test', () => {
  test('config là NGUỒN DUY NHẤT và khai đủ thứ gate cần', () => {
    const codes = CFG.techniques.map((t: { code: string }) => t.code);
    expect(codes, 'đủ 6 mã ISTQB').toEqual(['EP', 'BVA', 'DT', 'ST', 'UC', 'EG']);
    for (const t of CFG.techniques) {
      expect(String(t.kich_hoat || '').length, `${t.code} thiếu điều kiện kích hoạt`).toBeGreaterThan(20);
      expect(String(t.dau_hieu_may_kiem || '').length, `${t.code} thiếu dấu hiệu máy kiểm được`).toBeGreaterThan(20);
    }
  });

  test('KHỚP CHÍNH XÁC: tag chiều KHÔNG bị đọc thành mã kỹ thuật', () => {
    /*
     * Bốn ca này là bốn va chạm ĐO ĐƯỢC, không phải ví dụ nghĩ ra. Mất phép kiểm này thì ai đó đổi
     * `techniquesOf()` sang `includes()` cho "gọn" và không gì báo — chỉ là từ hôm đó mọi bộ TC cũ đều
     * "đã khai kỹ thuật".
     */
    for (const tag of ['[Negative]', '[Regression]', '[BugHistory]', '[DbPersist]']) {
      expect(m.techniquesOf(tag, ''), `${tag} KHÔNG phải mã kỹ thuật`).toEqual([]);
    }
    expect(m.techniquesOf('[Boundary][Validation][BVA][BR-X-001]', '')).toEqual(['BVA']);
    expect(m.techniquesOf('[ST][Negative]', '')).toEqual(['ST']);
    expect(m.techniquesOf('[bva]', ''), 'hoa/thường không đổi nghĩa').toEqual(['BVA']);
  });

  test('tag NGẮN hợp lệ (UI/API/E2E) không bị báo là mã kỹ thuật lạ', () => {
    /*
     * `ui`, `api`, `e2e` vừa là chiều vừa là loại case, và cả ba khớp khuôn 2-3 chữ HOA. Không trừ ra thì
     * `[UI]` — có mặt ở hàng trăm case — bị CHẶN oan, và một luật làm đỏ bộ cũ sẽ bị tắt trong một ngày.
     */
    for (const tag of ['[UI]', '[API]', '[E2E]']) {
      expect(m.unknownTechniqueTags(tag, ''), `${tag} là tag hợp lệ`).toEqual([]);
    }
    expect(m.unknownTechniqueTags('[XYZ]', ''), 'mã tự bịa phải bị bắt').toEqual(['XYZ']);
  });

  test('TẦNG 1 — bộ CHƯA dùng quy ước: KHÔNG đỏ, nhưng phải KÊU', () => {
    const r = validate(bo([row('T1', '[Positive]'), row('T2', '[Negative]')]));
    expect(loc(r.problems, /kỹ thuật/), 'bộ cũ không được đỏ oan').toEqual([]);
    const keu = loc(r.warnings, /CHƯA ĐƯỢC GÁC/);
    expect(keu.length, 'im lặng thì "không ai báo gì" bị đọc thành "đã đạt"').toBe(1);
  });

  test('TẦNG 2 — bộ ĐÃ dùng mà một case thiếu tag: CHẶN', () => {
    const r = validate(bo([row('T1', '[Positive][BVA]', 'min=0, max=100'), row('T2', '[Negative]')]));
    const chan = loc(r.problems, /THIẾU tag kỹ thuật/);
    expect(chan.length).toBe(1);
    expect(chan[0]).toContain('T2');
  });

  test('mã kỹ thuật LẠ: CHẶN, kể cả khi bộ chưa dùng quy ước', () => {
    const r = validate(bo([row('T1', '[Positive][XYZ]')]));
    const chan = loc(r.problems, /KHÔNG có trong/);
    expect(chan.length, '`[XYZ]` không phải quy ước cũ — nó là lỗi gõ hoặc mã tự bịa').toBe(1);
  });

  test('[BVA] mà `Dữ liệu Test` không có số: CẢNH BÁO, KHÔNG chặn', () => {
    /*
     * Mức này cố ý. Heuristic phải đoán con số trong ô là độ dài, là số lượng hay là ngày — ba loại nhìn
     * giống nhau. Chưa đo tỉ lệ báo oan trên bộ TC thật thì chưa được đặt CHẶN. Đổi mức phải kèm số đo.
     */
    const r = validate(bo([row('T1', '[Boundary][BVA]', 'để trống')]));
    expect(loc(r.problems, /BVA/), 'chưa có số đo báo oan thì chưa được chặn').toEqual([]);
    expect(loc(r.warnings, /\[BVA\]/).length).toBe(1);
    expect(CFG._nguong.bva_data_khong_o_bien, 'mức khai ở config phải khớp hành vi').toBe('canh_bao');
  });

  test('[BVA] CÓ giá trị biên thì im lặng', () => {
    const r = validate(bo([row('T1', '[Boundary][BVA]', 'độ dài = 0, 1, 255, 256')]));
    expect(loc(r.warnings, /\[BVA\]/)).toEqual([]);
  });

  test('[ST] mà không có nhánh bị chặn: CẢNH BÁO', () => {
    const r = validate(bo([row('T1', '[Positive][ST]'), row('T2', '[Positive][ST]')]));
    expect(loc(r.warnings, /\[ST\]/).length, 'mới kiểm đường đi được, chưa kiểm đường phải chặn').toBe(1);

    const ok = validate(bo([row('T1', '[Positive][ST]'), row('T2', '[Negative][ST]')]));
    expect(loc(ok.warnings, /\[ST\]/), 'có nhánh Negative thì im lặng').toEqual([]);
  });

  test('[EG] không neo vào quan sát có thật: CẢNH BÁO', () => {
    const r = validate(bo([row('T1', '[Positive][EG]')]));
    expect(loc(r.warnings, /\[EG\]/).length, 'đoán mà không nêu dựa vào đâu là cảm tính').toBe(1);

    const neoBug = validate(bo([row('T1', '[Positive][EG][BugHistory]')]));
    expect(loc(neoBug.warnings, /\[EG\]/), 'neo vào bug lịch sử thì đạt').toEqual([]);

    const neoOracle = validate(bo([row('T1', '[Positive][EG][BR-HSLOP-004]')]));
    expect(loc(neoOracle.warnings, /\[EG\]/), 'neo vào oracle-ref thì đạt').toEqual([]);
  });

  test('`buildTestCase` mang kỹ thuật ra ngoài để gate khác dùng lại', () => {
    const tc = row('T1', '[Boundary][BVA][BR-X-001]', 'min=0');
    expect(tc.techniques).toEqual(['BVA']);
    expect(tc.dimensions, 'chiều vẫn tính như cũ, không bị kỹ thuật nuốt').toContain('boundary');
    expect(tc.oracleRefs, 'oracle-ref vẫn tính như cũ').toContain('BR-X-001');
  });
});
