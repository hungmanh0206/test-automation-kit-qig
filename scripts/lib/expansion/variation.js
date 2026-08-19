/**
 * variation.js — XOAY DATA THEO `RUN_ID`, nhưng vẫn tái lặp được.
 *
 * VÌ SAO CÓ FILE NÀY: mỗi lượt chạy dùng **đúng một bộ data** thì độ phủ **đóng băng** — sau 20 lượt vẫn chỉ chạm
 * đúng 1 hình dạng dữ liệu, trong khi bug thường nằm ở hình dạng khác (số 0, số âm, biên, chuỗi dài, ký tự đặc
 * biệt, ngày đầu/cuối tháng). Xoay vòng trong **cùng lớp tương đương** thì sau 20 lượt phủ 20 hình dạng mà
 * **không thêm một case nào**.
 *
 * ĐIỀU KIỆN SỐNG CÒN: phải **tái lặp**. Random thuần làm bug "biến mất khi chạy lại" — thứ đó phá nguyên tắc
 * rerun 2–3 lần của kit và biến bug thật thành flaky. Nên seed bằng `RUN_ID` (giá trị đã có trong mọi lượt chạy):
 * cùng `RUN_ID` ⇒ cùng data, đổi `RUN_ID` ⇒ đổi hình dạng. Bug xuất hiện thì **chạy lại đúng RUN_ID đó** để tái hiện.
 */

/** Băm chuỗi → số nguyên không âm (FNV-1a, đủ tốt và ổn định giữa các lần chạy/máy). */
function hash(str) {
  let h = 0x811c9dc5;
  const s = String(str == null ? '' : str);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Chọn 1 phần tử trong LỚP TƯƠNG ĐƯƠNG theo seed. Cùng (class, seed) ⇒ luôn cùng kết quả.
 * @param {string} className tên lớp (để 2 lớp khác nhau không xoay trùng pha)
 * @param {Array} values các giá trị **tương đương về nghiệp vụ** (nếu không tương đương thì đây là sai chỗ dùng)
 * @param {string} runId seed — mặc định lấy `process.env.RUN_ID`
 */
function pick(className, values, runId = process.env.RUN_ID || '') {
  if (!Array.isArray(values) || !values.length) throw new Error(`variation.pick("${className}"): cần mảng giá trị không rỗng`);
  return values[hash(`${className}::${runId}`) % values.length];
}

/** Chọn nhiều lớp một lượt — trả về object phẳng, dễ log vào Actual để người sau tái hiện. */
function plan(classes, runId = process.env.RUN_ID || '') {
  const out = { _runId: runId || '(không có RUN_ID — mọi lượt sẽ giống nhau, độ phủ đóng băng)' };
  for (const [name, values] of Object.entries(classes || {})) out[name] = pick(name, values, runId);
  return out;
}

/**
 * Bộ lớp tương đương dùng chung — mỗi lớp là các giá trị **cùng ý nghĩa nghiệp vụ** nhưng khác HÌNH DẠNG.
 * Chỗ này là nơi độ phủ thật sự tăng: cùng một case, mỗi lượt chạm một hình dạng khác.
 */
const CLASSES = {
  // tiền hợp lệ: tròn · lẻ · rất nhỏ · rất lớn (bắt lỗi format/rounding/overflow)
  money_valid: [1000000, 1234567, 1000, 999999999],
  // tiền biên/nghi vấn: 0 · âm · thập phân (nhiều bug thất thu nằm ở đây)
  money_edge: [0, -1000000, 1000.5],
  // chuỗi tên: ngắn · dài có dấu · có ký tự đặc biệt (theo quy ước dữ liệu test)
  name_shape: ['IT test A', 'IT test Nguyễn Hoàng Thị Phương Quỳnh Nhược Nguyệt Ánh', "IT test O'Brien-Nguyễn (Jr.)"],
  // ngày: đầu tháng · cuối tháng · 29/02 · đổi năm (bắt lỗi timezone/biên tháng)
  date_shape: ['01', '28', '29', '31'],
  // số lượng bản ghi: rỗng · 1 · nhiều (bắt lỗi empty-state/pagination)
  count_shape: [0, 1, 25],
};

module.exports = { hash, pick, plan, CLASSES };
