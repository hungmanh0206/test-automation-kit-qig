import type { Matcher, MatchResult } from './types';

/*
 * match.ts — SO SÁNH THEO NGHĨA CỦA FIELD.
 *
 * Phải làm TRƯỚC `dbVerify`, vì không có lớp này thì `expectRow` vô dụng: driver trả cùng một giá trị dưới
 * nhiều biểu diễn (`pg` trả `numeric`/`bigint` thành string, `mssql` trả number, Mongo trả Decimal128), nên
 * so thô sẽ đỏ hàng loạt dù DB lưu hoàn toàn đúng.
 *
 * Đo trên một DB UAT thật (27/08/2026) — hai bảng lõi lưu tiền KHÁC KIỂU nhau:
 *   bảng đơn, cột thành tiền          số nguyên
 *   bảng giao dịch, cột số tiền       chuỗi   ← cùng khái niệm tiền, lưu dạng CHUỖI
 * và 39/39 cột thời gian là `timestamp WITHOUT time zone` (không có offset trong dữ liệu).
 */

const fmt = (v: unknown): string => {
  if (v === null) return 'NULL';
  if (v === undefined) return '(không có cột)';
  if (typeof v === 'bigint') return `${v}n`;
  if (v instanceof Date) return `${v.toISOString()} (Date)`;
  if (typeof v === 'object') return JSON.stringify(v);
  return `${typeof v === 'string' ? `"${v}"` : String(v)}`;
};

/* ─── MONEY ────────────────────────────────────────────────────────────────────────────────────────
 * Tiền ở dự án này là số nguyên VND. Chuẩn hoá mọi biểu diễn về BigInt đồng, rồi mới so.
 * CỐ Ý không làm tròn: `540000.5` KHÁC `540000` và phải báo — vì "số bị đổi kiểu rồi mất phần thập phân"
 * đúng là một trong 7 lỗi mà tầng này sinh ra để bắt. Chỉ bỏ qua phần thập phân khi nó bằng 0
 * (`540000.00` = `540000`), đó là biểu diễn, không phải giá trị.
 */
/** Kết quả chuẩn hoá tiền. Shape PHẲNG (không union rời rạc) — `value === null` là "không đọc được". */
interface MoneyParse { value: bigint | null; note?: string; why?: string }

function toMinor(v: unknown): MoneyParse {
  if (v === null || v === undefined) return { value: null, why: 'giá trị NULL/không có cột' };
  if (typeof v === 'bigint') return { value: v };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { value: null, why: `số không hữu hạn (${v})` };
    if (!Number.isInteger(v)) {
      const rounded = Math.round(v);
      if (Math.abs(v - rounded) > 0) return { value: BigInt(rounded), note: `giá trị thực có phần thập phân (${v})` };
    }
    if (!Number.isSafeInteger(v)) return { value: null, why: `vượt Number.MAX_SAFE_INTEGER (${v}) — đọc bằng string/bigint để không mất chữ số` };
    return { value: BigInt(v) };
  }
  if (typeof v === 'object' && v !== null && typeof (v as { toString?: unknown }).toString === 'function') {
    return toMinor(String(v));                       // Decimal128 / Big.js / numeric wrapper
  }
  if (typeof v === 'string') {
    const raw = v.trim();
    if (!raw) return { value: null, why: 'chuỗi rỗng' };
    // Bỏ dấu phân cách nghìn của người đọc; giữ dấu trừ và dấu chấm thập phân.
    const cleaned = raw.replace(/[\s_]/g, '').replace(/(?<=\d),(?=\d{3}\b)/g, '');
    const m = /^(-?\d+)(?:[.,](\d+))?$/.exec(cleaned);
    if (!m) return { value: null, why: `không phải số tiền đọc được: ${fmt(v)}` };
    const whole = BigInt(m[1]);
    if (!m[2] || /^0+$/.test(m[2])) return { value: whole };
    return { value: whole, note: `giá trị thực có phần thập phân khác 0 (.${m[2]})` };
  }
  return { value: null, why: `kiểu không hỗ trợ (${typeof v})` };
}

export function money(expected: number | bigint | string): Matcher {
  /*
   * Dùng shape PHẲNG (`value: bigint | null`) thay vì union rời rạc `{ok:true}|{ok:false}`: union đó không
   * narrow được qua thân closure, và cách chữa bằng `as` chỉ đẩy lỗi sang lúc chạy. Phẳng thì ít khéo hơn
   * nhưng đọc một lần là hiểu, và TypeScript kiểm được.
   */
  const parsed = toMinor(expected);
  const expValue = parsed.value;
  const expError = parsed.why || '';

  return {
    kind: 'money',
    describe: () => (expValue !== null ? `${expValue} (tiền)` : `(mong đợi không đọc được: ${expError})`),
    compare(actual: unknown): MatchResult {
      if (expValue === null) return { verdict: 'inconclusive', why: `giá trị MONG ĐỢI không đọc được: ${expError}` };
      const got = toMinor(actual);
      if (got.value === null) return { verdict: 'mismatch', expected: String(expValue), actual: fmt(actual), why: got.why || 'không đọc được' };
      if (got.value !== expValue) {
        return { verdict: 'mismatch', expected: String(expValue), actual: fmt(actual), why: `lệch ${got.value - expValue} đồng` };
      }
      if (got.note) {
        // Cùng phần nguyên nhưng kiểu lưu đã đổi ⇒ KHÔNG coi là match: đây chính là lỗi cần bắt.
        return { verdict: 'mismatch', expected: String(expValue), actual: fmt(actual), why: `${got.note} — kiểu số bị đổi` };
      }
      return { verdict: 'match' };
    },
  };
}

/* ─── INSTANT ──────────────────────────────────────────────────────────────────────────────────────
 * DB này lưu `timestamp WITHOUT time zone` ⇒ dữ liệu KHÔNG mang offset. Muốn so mốc thời gian thì phải
 * biết app ghi theo múi nào; chưa khai thì đây là ĐOÁN, nên trả `inconclusive` chứ không trả sai/đúng.
 * `storedZone` khai ở `conventions.timestamps.storedZone` (vd 'UTC' hoặc '+07:00').
 */
const ZONE_RE = /^(UTC|Z|[+-]\d{2}:\d{2})$/;

interface NaiveParse { iso: string | null; why?: string }

function parseNaive(v: unknown): NaiveParse {
  if (v instanceof Date) {
    // Driver đã dựng Date từ giá trị naive — nó gán múi của tiến trình, không phải của dữ liệu.
    return { iso: v.toISOString().replace(/Z$/, '') };
  }
  if (typeof v === 'string') {
    const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)/.exec(v.trim());
    if (!m) return { iso: null, why: `không phải mốc thời gian đọc được: ${fmt(v)}` };
    return { iso: `${m[1]}T${m[2].length === 5 ? `${m[2]}:00` : m[2]}` };
  }
  return { iso: null, why: `kiểu không hỗ trợ cho thời gian (${typeof v})` };
}

const offsetMinutes = (zone: string): number => {
  if (zone === 'UTC' || zone === 'Z') return 0;
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(zone);
  if (!m) return NaN;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
};

export function instant(expectedIso: string, opts: { storedZone?: string; toleranceMs?: number } = {}): Matcher {
  const expMs = Date.parse(expectedIso);
  return {
    kind: 'instant',
    describe: () => `${expectedIso} (mốc thời gian)`,
    compare(actual: unknown): MatchResult {
      if (!Number.isFinite(expMs)) return { verdict: 'inconclusive', why: `giá trị MONG ĐỢI không parse được: "${expectedIso}"` };
      const naive = parseNaive(actual);
      if (naive.iso === null) return { verdict: 'mismatch', expected: expectedIso, actual: fmt(actual), why: naive.why || 'không đọc được' };
      const zone = opts.storedZone;
      if (!zone) {
        return {
          verdict: 'inconclusive',
          why: `cột lưu KHÔNG có timezone (39/39 cột của DB này là \`timestamp without time zone\`) và chưa khai `
            + `\`conventions.timestamps.storedZone\` ⇒ không biết "${naive.iso}" là giờ nào. So mốc thời gian lúc này là đoán. `
            + `Khai storedZone ('UTC' hoặc '+07:00') rồi chạy lại.`,
        };
      }
      if (!ZONE_RE.test(zone)) return { verdict: 'inconclusive', why: `\`storedZone\` không hợp lệ: "${zone}" — dùng 'UTC' hoặc dạng '+07:00' (tên vùng như 'Asia/Saigon' KHÔNG hỗ trợ, vì quy đổi DST cần thư viện tz).` };
      const off = offsetMinutes(zone);
      if (!Number.isFinite(off)) return { verdict: 'inconclusive', why: `\`storedZone\` không hợp lệ: "${zone}" (dùng 'UTC' hoặc '+07:00')` };
      const gotMs = Date.parse(`${naive.iso}Z`) - off * 60_000;
      const diffMs = gotMs - expMs;
      const tol = Math.max(0, Number(opts.toleranceMs || 0));
      if (Math.abs(diffMs) <= tol) return { verdict: 'match' };

      /*
       * THÔNG ĐIỆP PHẢI ĐÚNG ĐỘ LỚN. Bản đầu tôi làm tròn ra phút rồi kiểm `% 60 === 0` ⇒ lệch 825ms cũng
       * ra "lệch 0 giờ — dấu hiệu sai quy đổi múi giờ". Đo thật trên cột `created_at` của bảng đơn
       * (`2025-05-08 00:14:55.825`): expected ghi tới giây là đủ để nổ, và người đọc sẽ đi tìm bug timezone
       * KHÔNG tồn tại. Lệch dưới 1 phút thì nói bằng ms/giây và gợi ý `toleranceMs`, không nói múi giờ.
       */
      const absMs = Math.abs(diffMs);
      let why: string;
      if (absMs < 1000) why = `lệch ${diffMs} ms — chỉ khác phần mili giây (DB lưu ms, expected thường ghi tới giây). Dùng \`instant(v, { toleranceMs: 1000 })\` nếu spec chỉ quy định tới giây.`;
      else if (absMs < 60_000) why = `lệch ${(diffMs / 1000).toFixed(3)} giây`;
      else {
        /*
         * Nhận "lệch tròn giờ" phải CHỊU ĐƯỢC nhiễu dưới giây. Bản trước kiểm `absMs % 3_600_000 === 0` nên
         * lệch 7 giờ + 825 ms (DB lưu mili giây!) rơi xuống nhánh "lệch 420 phút" và MẤT tín hiệu múi giờ —
         * đúng tín hiệu quan trọng nhất của cột không lưu offset. Đo thật trên `created_at` có `.825`.
         */
        const hours = diffMs / 3_600_000;
        const nearWholeHour = Math.abs(diffMs - Math.round(hours) * 3_600_000) <= Math.max(tol, 1000);
        why = nearWholeHour
          ? `lệch ${Math.round(hours)} giờ — dấu hiệu sai quy đổi múi giờ (cột không lưu offset)`
          : `lệch ${Math.round(diffMs / 60_000)} phút`;
      }
      return { verdict: 'mismatch', expected: expectedIso, actual: `${naive.iso} (đọc theo ${zone})`, why };
    },
  };
}

/* ─── TEXT ─────────────────────────────────────────────────────────────────────────────────────────
 * So verbatim. Điểm thêm giá trị: khi actual là TIỀN TỐ của expected và dài đúng bằng `maxLength` của cột
 * thì nói thẳng "bị cắt do varchar(n)" — nếu không, người đọc chỉ thấy "không khớp" và sẽ đi tìm sai chỗ.
 */
export function text(expected: string, opts: { maxLength?: number; trim?: boolean } = {}): Matcher {
  const norm = (s: string) => (opts.trim ? s.trim() : s);
  return {
    kind: 'text',
    describe: () => `"${expected}"`,
    compare(actual: unknown): MatchResult {
      if (typeof actual !== 'string') {
        if (actual === null || actual === undefined) return { verdict: 'mismatch', expected, actual: fmt(actual), why: 'cột rỗng/không tồn tại' };
        return { verdict: 'mismatch', expected, actual: fmt(actual), why: `kiểu không phải chuỗi (${typeof actual})` };
      }
      const a = norm(actual);
      const e = norm(expected);
      if (a === e) return { verdict: 'match' };
      if (e.startsWith(a) && a.length < e.length) {
        const cut = opts.maxLength && a.length === opts.maxLength
          ? `BỊ CẮT đúng ở giới hạn cột varchar(${opts.maxLength}) — mất ${e.length - a.length} ký tự`
          : `bị cắt mất ${e.length - a.length} ký tự cuối`;
        return { verdict: 'mismatch', expected: e, actual: a, why: cut };
      }
      if (a.toLowerCase() === e.toLowerCase()) return { verdict: 'mismatch', expected: e, actual: a, why: 'chỉ khác HOA/thường' };
      if (a.normalize('NFC') === e.normalize('NFC')) return { verdict: 'mismatch', expected: e, actual: a, why: 'khác dạng chuẩn hoá Unicode (NFC/NFD) — cùng chữ, khác byte' };
      return { verdict: 'mismatch', expected: e, actual: a, why: 'khác nội dung' };
    },
  };
}

/** So bằng `===` — dùng cho boolean/enum/uuid, nơi biểu diễn không có biến thể. */
export function exact(expected: unknown): Matcher {
  return {
    kind: 'exact',
    describe: () => fmt(expected),
    compare(actual: unknown): MatchResult {
      if (actual === expected) return { verdict: 'match' };
      if (typeof expected === 'string' && typeof actual === 'string' && actual.trim() === expected.trim()) {
        return { verdict: 'mismatch', expected: fmt(expected), actual: fmt(actual), why: 'chỉ khác khoảng trắng đầu/cuối' };
      }
      return { verdict: 'mismatch', expected: fmt(expected), actual: fmt(actual), why: 'khác giá trị' };
    },
  };
}

/** Giá trị trần trong `Expected` được bọc thành `exact`; matcher thì giữ nguyên. */
export const asMatcher = (v: unknown): Matcher =>
  (v && typeof v === 'object' && typeof (v as Matcher).compare === 'function' ? (v as Matcher) : exact(v));
