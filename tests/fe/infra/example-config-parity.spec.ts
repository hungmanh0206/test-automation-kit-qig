import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/*
 * Bản `.example.json` phải có ĐỦ KHOÁ như bản thật.
 *
 * VÌ SAO CÓ FILE NÀY (đo 19/09/2026). Gói phát hành cố ý KHÔNG mang config đã chỉnh theo dự án; nó
 * mang bản `.example` để người nhận chép ra rồi tự điền. Cơ chế đó chỉ đúng khi bản mẫu còn đủ khoá.
 *
 * Thực tế đã lệch: `risk_model.json` được thêm `minCasesPerDimension` khi làm ngưỡng `dim:coverage`,
 * còn `risk_model.example.json` thì không. Hậu quả đo được khi giải nén gói rồi chạy suite: người
 * nhận chép mẫu ra, `dim:coverage` mất ngưỡng theo chiều, và 3 test của chính kit ĐỎ. Không ai thấy
 * vì trong repo luôn có bản thật.
 *
 * Chỉ so KHOÁ, không so GIÁ TRỊ. Giá trị là thứ mỗi dự án tự chỉnh — đó là lý do bản `.example` tồn
 * tại. Thiếu một khoá thì máy đọc config im lặng rơi về mặc định, và đó mới là chỗ hỏng.
 */

const REPO = path.resolve(__dirname, '../../..');
const CONFIG = path.join(REPO, '.agent', 'config');

/*
 * SO TÊN TRƯỜNG, KHÔNG SO KHOÁ DỮ LIỆU. Bản đầu của test này so mọi khoá lồng nhau và báo oan ngay:
 * nó kể `impact.modules.Order`, `softDelete.byEntity.ic_payment_orders` là "thiếu", trong khi bản mẫu
 * CỐ Ý không có module và bảng của dự án này — đó chính là lý do bản mẫu tồn tại.
 *
 * Phân biệt bằng hình dạng, không bằng tên: một object mà các giá trị con cũng là object thì nó là
 * MAP-CỦA-BẢN-GHI, và thứ đáng so là tên TRƯỜNG bên trong bản ghi (`minCasesPerDimension`), không phải
 * tên bản ghi (`High`, `Order`). Object mà giá trị con là số hoặc chuỗi thì thuần dữ liệu, bỏ qua.
 */
const laObj = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);
const muc = (o: unknown) => Object.entries(o as Record<string, unknown>).filter(([k]) => !k.startsWith('_'));

/**
 * MAP-CỦA-BẢN-GHI: từ 2 con trở lên, con nào cũng là object, và các con DÙNG CHUNG ít nhất một tên
 * trường. `depthPolicy` đạt (High/Medium/Low/UNKNOWN đều có `minCount`); `impact` không đạt (con là
 * `modules` và `tagWeights`, chẳng chung tên trường nào).
 */
function laMapBanGhi(o: unknown): boolean {
  const e = muc(o);
  if (e.length < 2 || !e.every(([, v]) => laObj(v))) return false;
  const bo = e.map(([, v]) => new Set(Object.keys(v as object)));
  return bo.some((a, i) => bo.some((b, j) => i !== j && [...a].some((k) => b.has(k))));
}

/**
 * Đường dẫn tới từng LÁ, với khoá của bản ghi thu về `*`.
 *
 * `trongBanGhi` là chỗ quyết định đúng/oan: bên TRONG một bản ghi thì khoá vô hướng là TÊN TRƯỜNG
 * (`minCasesPerDimension`) nên phải kể ra; ngoài bản ghi thì một object toàn giá trị vô hướng là
 * BẢN ĐỒ DỮ LIỆU (`impact.modules` — tên module của dự án) nên chỉ ghi nhận chính nó rồi dừng.
 */
function duongLa(o: unknown, tien: string, trongBanGhi: boolean, out: Set<string>): void {
  if (!laObj(o)) { out.add(tien); return; }
  const e = muc(o);
  if (!e.length) { out.add(tien); return; }
  if (laMapBanGhi(o)) {
    for (const [, v] of e) duongLa(v, tien ? `${tien}.*` : '*', true, out);
    return;
  }
  if (!trongBanGhi && e.every(([, v]) => !laObj(v))) { out.add(tien); return; }
  for (const [k, v] of e) duongLa(v, tien ? `${tien}.${k}` : k, false, out);
}

const truongCuaBanGhi = (o: unknown): string[] => {
  const s = new Set<string>();
  duongLa(o, '', false, s);
  return [...s];
};

const cap = fs.readdirSync(CONFIG)
  .filter((f) => f.endsWith('.example.json'))
  .map((ex) => ({ ex, that: ex.replace('.example.json', '.json') }))
  .filter((c) => fs.existsSync(path.join(CONFIG, c.that)));

/*
 * MIỄN TRỪ có khai, không phải bỏ qua ngầm.
 *
 * `db.conventions.json` là BẢN ĐỒ DỮ LIỆU: bảng, cột, giá trị enum đo từ DB của một dự án. Bản mẫu
 * của nó cố ý chỉ minh hoạ HÌNH DẠNG với vài bảng giả, không phải bản đầy đủ. So hai file đó là so
 * dữ liệu chứ không so schema, và mọi cảnh báo sinh ra đều oan — bản đầu của test này đã kể 60 khoá
 * "thiếu" toàn là tên bảng `ic_payment_*` của dự án.
 *
 * Miễn trừ HẸP: khai đúng tên file kèm lý do. Cặp `.example` mới xuất hiện mà chưa khai thì test
 * dưới cùng ĐỎ, nên không ai thêm được một miễn trừ im lặng.
 */
const MIEN_TRU: Record<string, string> = {
  'db.conventions.example.json':
    'bản đồ bảng/cột đo từ DB một dự án — mẫu chỉ minh hoạ hình dạng, không phải bản đầy đủ',
};

test('có ít nhất một cặp .example.json ↔ bản thật để đối chiếu', () => {
  expect(cap.length, 'không tìm thấy cặp nào — kiểm lại quy ước đặt tên').toBeGreaterThan(0);
});

test('mọi miễn trừ đều trỏ tới cặp CÓ THẬT (không để lại miễn trừ chết)', () => {
  const co = new Set(cap.map((c) => c.ex));
  const chet = Object.keys(MIEN_TRU).filter((f) => !co.has(f));
  expect(chet, `miễn trừ trỏ vào cặp không còn tồn tại: ${chet.join(', ')}`).toEqual([]);
});

for (const c of cap.filter((x) => !MIEN_TRU[x.ex])) {
  test(`${c.ex} có đủ khoá của ${c.that}`, () => {
    const doc = (f: string) => JSON.parse(fs.readFileSync(path.join(CONFIG, f), 'utf8'));
    const coSan = new Set(truongCuaBanGhi(doc(c.ex)));
    const thieu = truongCuaBanGhi(doc(c.that)).filter((k) => !coSan.has(k));
    expect(
      thieu,
      `${c.ex} thiếu khoá: ${thieu.join(', ')} — người nhận chép mẫu ra sẽ mất mấy khoá này, `
      + 'và máy đọc config sẽ im lặng rơi về mặc định',
    ).toEqual([]);
  });
}
