import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { queryUatReadonly, isUatDbConfigured } from './uatDbClient';

/*
 * CÔNG CỤ ĐO, không phải test nghiệp vụ: nối lưới UI (đã đọc read-only bởi `_status_label_map.js`) với DB để
 * neo enum → nhãn. Đầu vào khai qua env nên dùng lại được cho màn khác, không khoá cứng vào CSDL-24395.
 * Thiếu đầu vào hoặc thiếu creds ⇒ SKIP: máy khác clone repo về không có file task-scoped, đỏ ở đó là đỏ oan.
 */
const REQ = path.resolve(process.cwd(), process.env.DB_ANCHOR_DIR
  || 'outputs/lms-operations-automation/tasks/CSDL-24395/requirements');
const UUID = /^[0-9a-f]{8}[_-][0-9a-f]{4}[_-][0-9a-f]{4}[_-][0-9a-f]{4}[_-][0-9a-f]{12}$/i;
/*
 * Chuan hoa so: bo MOI ky tu khong phai chu so, giu dau am. Ban dau chi bo khoang trang nen man CORE
 * ("60 000 000") thi khop ma man ADD_ON ("5.000.000") thi truot 129/133 — va suyt ghi nhan thanh phat hien
 * "UI hien con so khac han DB". Hai man cung app dinh dang nghin KHAC nhau (dau cach vs dau cham), nen ham
 * so sanh khong duoc phu thuoc dinh dang.
 */
const norm = (v: string) => {
  const raw = String(v ?? '');
  const neg = /^\s*-/.test(raw);
  const d = raw.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '');
  return d ? (neg ? `-${d}` : d) : '';
};

/** Neo theo CHỈ SỐ CỘT lấy từ `<th>`. Lưới Metronic clone cột dính ⇒ header lặp 2 lần, lấy lần XUẤT HIỆN ĐẦU. */
function colOf(headers: string[], name: string): number { return headers.indexOf(name); }

test.skip(!isUatDbConfigured('LIB_MASTER_DB_RO'), 'chưa khai LIB_MASTER_DB_RO_*');
test.skip(!fs.existsSync(path.join(REQ, 'ui_list_rows.json')), 'chưa có ui_list_rows.json — chạy _status_label_map.js trước');

test('neo status/service_fee_type/tiền ở MÀN DANH SÁCH, khoá nối = Mã đơn hàng', async () => {
  const screens = JSON.parse(fs.readFileSync(path.join(REQ, 'ui_list_rows.json'), 'utf8')) as
    { type: string; headers: string[]; rows: string[][] }[];
  const report: Record<string, unknown> = {};

  for (const s of screens) {
    const iId = colOf(s.headers, 'Mã đơn hàng');
    const iStatus = colOf(s.headers, 'Status');
    /*
     * CÙNG cột DB, HAI nhãn header tuỳ màn: `service_fee_type` là "Service Fee Type" ở màn Service Fee nhưng
     * "Add-on Order Type" ở màn Add-on. Đây đúng lý do bản đồ phải khoá theo màn — nhưng ở BƯỚC ĐO thì phải
     * nhận cả hai, không thì màn add-on đọc ra 0 cặp mà không báo gì.
     */
    const iSft = [ 'Service Fee Type', 'Add-on Order Type' ].map((h) => colOf(s.headers, h)).find((i) => i >= 0) ?? -1;
    const iGross = colOf(s.headers, 'Gross Amount');
    const iNet = colOf(s.headers, 'Net Amount');

    const pairs = s.rows
      .map((r) => ({ id: (r[iId] || '').replace(/_/g, '-'), row: r }))
      .filter((x) => UUID.test(x.id));
    if (!pairs.length) { console.log(`[st] ${s.type}: không đọc được id`); continue; }

    const db = await queryUatReadonly<Record<string, string>>(
      `SELECT id::text, status::text, service_fee_type::text,
              original_price::text, final_price::text, automatic_price::text
         FROM ic_payment_orders WHERE id = ANY($1::uuid[])`,
      [pairs.map((p) => p.id)], { dbPrefix: 'LIB_MASTER_DB_RO' });
    const byId = new Map(db.map((r) => [r.id, r]));
    console.log(`[st] ${s.type}: nối ${byId.size}/${pairs.length} hàng với DB`);

    /*
     * enum → nhãn phải là HÀM (một enum chỉ một nhãn) VÀ ĐƠN ÁNH (hai enum không dùng chung nhãn).
     * Vi phạm bất kỳ điều nào ⇒ ghi "chưa neo", không chọn nhãn phổ biến nhất — chọn bừa thì sau này
     * phán FAIL bằng nhãn sai mà vẫn "có số từ DB", đúng kiểu bug ma thuyết phục nhất.
     */
    const enumLabels: Record<string, Record<string, Set<string>>> = { status: {}, service_fee_type: {} };
    const MONEY_COLS = ['original_price', 'final_price', 'automatic_price', 'custom_price', 'total_discount', 'deposit', 'service_fee'];
    const rival: Record<string, { hit: number; miss: number }> = {};
    /* Giữ vài hàng CỤ THỂ để phân biệt "lệch chỉ số cột" với "UI hiện con số khác hẳn" — hai nguyên nhân
     * khác nhau hoàn toàn, mà chỉ nhìn tỉ lệ khớp thì không tách được. */
    const samples: Record<string, string[]> = {};

    for (const p of pairs) {
      const d = byId.get(p.id); if (!d) continue;
      const put = (col: 'status' | 'service_fee_type', idx: number) => {
        if (idx < 0 || d[col] == null) return;
        const label = (p.row[idx] || '').trim(); if (!label) return;
        (enumLabels[col][d[col]] = enumLabels[col][d[col]] || new Set<string>()).add(label);
      };
      put('status', iStatus);
      put('service_fee_type', iSft);
      // Tiền: nhãn cột trên lưới có khớp cột DB không (so sau khi bỏ khoảng trắng phân cách nghìn).
      /*
       * PHÂN BIỆT, không chỉ "khớp". Nhãn tiền trên lưới khớp `final_price` 48/48 KHÔNG chứng minh nó là
       * `final_price` — nếu `automatic_price` cũng bằng đúng số đó ở cả 48 hàng thì nhãn ứng với ≥2 cột và
       * vẫn là CHƯA NEO. Đếm số cột tiền khớp cho từng nhãn: chỉ neo khi đúng MỘT cột khớp toàn bộ.
       */
      for (const [label, idx] of [['Gross Amount', iGross], ['Net Amount', iNet]] as [string, number][]) {
        if (idx < 0 || !p.row[idx]) continue;
        if ((samples[label] = samples[label] || []).length < 3) {
          samples[label].push(`UI="${p.row[idx]}" · DB ${MONEY_COLS.filter((c) => d[c] != null).map((c) => `${c}=${d[c]}`).join(' ')}`.slice(0, 180));
        }
        for (const col of MONEY_COLS) {
          const k = `${label}|${col}`;
          rival[k] = rival[k] || { hit: 0, miss: 0 };
          (norm(p.row[idx]) === norm(String(d[col])) ? rival[k].hit++ : rival[k].miss++);
        }
      }
    }

    const resolve = (col: string) => {
      const m = enumLabels[col]; const out: Record<string, string> = {}; const bad: string[] = [];
      const all = Object.entries(m);
      for (const [en, labels] of all) {
        if (labels.size !== 1) { bad.push(`${en}: ${labels.size} nhãn ${JSON.stringify([...labels])}`); continue; }
        const l = [...labels][0];
        const shared = all.filter(([o, ls]) => o !== en && ls.has(l)).map(([o]) => o);
        if (shared.length) { bad.push(`${en}: nhãn "${l}" dùng chung với ${shared.join(',')}`); continue; }
        out[en] = l;
      }
      return { out, bad };
    };
    const st = resolve('status'); const sft = resolve('service_fee_type');
    console.log(`  status  NEO ${JSON.stringify(st.out)}${st.bad.length ? ` | CHƯA: ${st.bad.join(' ; ')}` : ''}`);
    if (iSft >= 0) console.log(`  sftype  NEO ${JSON.stringify(sft.out)}${sft.bad.length ? ` | CHƯA: ${sft.bad.join(' ; ')}` : ''}`);
    const moneyAnchor: Record<string, string | string[]> = {};
    for (const label of ['Gross Amount', 'Net Amount']) {
      const full = MONEY_COLS.filter((c) => rival[`${label}|${c}`] && rival[`${label}|${c}`].miss === 0 && rival[`${label}|${c}`].hit > 0);
      if (!MONEY_COLS.some((c) => rival[`${label}|${c}`])) { continue; }   // màn này không có cột đó
      if (!full.length) {
        // KHÔNG neo được thì phải nói RÕ vì sao, không im lặng bỏ qua — im lặng là mất một phát hiện.
        const near = MONEY_COLS.map((c) => ({ c, ...(rival[`${label}|${c}`] || { hit: 0, miss: 0 }) }))
          .filter((x) => x.hit > 0).sort((a, b) => b.hit - a.hit).slice(0, 4);
        console.log(`  tiền    "${label}" → KHÔNG neo. Khớp một phần: ${near.map((x) => `${x.c} ${x.hit}/${x.hit + x.miss}`).join(' · ') || 'không cột nào khớp hàng nào'}`);
        for (const ex of samples[label] || []) console.log(`            ví dụ ${ex}`);
        continue;
      }
      moneyAnchor[label] = full.length === 1 ? full[0] : full;
      console.log(`  tiền    "${label}" → ${full.length === 1 ? `NEO ${full[0]}` : `CHƯA NEO, khớp ${full.length} cột: ${full.join(', ')}`}`);
    }
    report[s.type] = { status: st, service_fee_type: sft, money: moneyAnchor };
  }
  fs.writeFileSync(path.join(REQ, 'db_status_label_map.json'), `${JSON.stringify(report, null, 2)}\n`);
});

/*
 * ĐỐI CHIẾU THEO GIÁ TRỊ (không theo nhãn). Tìm theo nhãn ("có nhãn nào chứa chữ deposit?") là cách bỏ sót:
 * app có thể hiện cùng con số dưới một nhãn hoàn toàn khác. Nên: lấy mọi cặp (nhãn → giá trị) đọc được từ
 * UI, chuẩn hoá số, rồi hỏi "giá trị này khớp cột DB nào". Chỉ neo khi khớp ĐÚNG MỘT cột.
 */
const numOf = (t: string): string | null => {
  const raw = String(t || '').replace(/\s/g, '');
  if (!/\d/.test(raw)) return null;
  const neg = /^-|^\(.*\)$/.test(raw);
  const d = raw.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '');
  return d.length ? (neg ? `-${d}` : d) : null;
};

test('đối chiếu THEO GIÁ TRỊ: nhãn UI nào ứng với cột DB nào (vòng 3)', async () => {
  const f = path.join(REQ, process.env.DB_MAP_PAIRS || 'ui_pairs_round3.json');
  test.skip(!fs.existsSync(f), `chưa có ${f}`);
  const cases = JSON.parse(fs.readFileSync(f, 'utf8')) as { id: string; type: string; pairs: { label: string; value: string }[] }[];
  const COLS = ['original_price', 'automatic_price', 'total_discount', 'deposit', 'final_price', 'custom_price',
    'service_fee', 'fee_per_month', 'service_fee_rate', 'fixed_discount'];

  for (const c of cases) {
    const [row] = await queryUatReadonly<Record<string, string>>(
      `SELECT ${COLS.map((x) => `"${x}"::text AS "${x}"`).join(', ')} FROM ic_payment_orders WHERE id = $1::uuid`,
      [c.id], { dbPrefix: 'LIB_MASTER_DB_RO' });
    if (!row) { console.log(`[v3] ${c.type}: không thấy hàng DB`); continue; }

    console.log(`[v3] === ${c.type} ===`);
    for (const col of COLS) {
      const v = row[col];
      if (v === null || v === undefined) continue;
      // Nhãn nào hiện đúng con số của cột này?
      const labels = [...new Set(c.pairs.filter((p) => numOf(p.value) === numOf(v)).map((p) => p.label))];
      // Cột nào KHÁC cũng có đúng con số đó? (nếu có thì nhãn không phân biệt được cột)
      const rivals = COLS.filter((o) => o !== col && numOf(row[o]) === numOf(v));
      const verdict = !labels.length ? 'KHÔNG hiện trên màn'
        : rivals.length ? `trùng số với ${rivals.join(',')} ⇒ CHƯA NEO`
          : labels.length === 1 ? `NEO → "${labels[0]}"` : `hiện ở ${labels.length} nhãn: ${JSON.stringify(labels)}`;
      console.log(`      ${col.padEnd(17)} = ${String(v).padEnd(14)} ${verdict}`);
    }
  }
});

/*
 * NEO CỘT ENUM BẰNG CÁCH SO HAI NHÓM.
 *
 * Cột như `payment_method` không hiện dạng chuỗi enum, nên đối chiếu theo giá trị (như vòng 3) không dùng
 * được. Cách đúng: lấy HAI NHÓM đơn CÙNG MÀN, khác nhau ở đúng cột cần neo, rồi tìm nhãn nào:
 *   (a) có mặt ở MỌI đơn của cả hai nhóm,
 *   (b) giá trị KHÔNG ĐỔI trong từng nhóm,
 *   (c) giá trị KHÁC nhau giữa hai nhóm.
 * Thiếu (b) thì mọi nhãn hiện số tiền đều lọt (mỗi đơn một số); thiếu (a) thì nhãn chỉ xuất hiện ở một nhóm
 * cũng lọt, mà đó có thể là khác biệt do thứ khác. Đủ ba điều mới là nhãn của cột đó.
 */
const GROUPS: Record<string, Record<string, string[]>> = JSON.parse(process.env.DB_GROUPS || JSON.stringify({
  payment_method: { INSTALLMENT: ['I1_ov', 'I1_tx', 'I2_ov', 'I2_tx'], ONETIME: ['O1_ov', 'O1_tx', 'O2_ov', 'O2_tx'] },
}));

test('neo cột enum bằng cách SO HAI NHÓM đơn', async () => {
  const f = path.join(REQ, process.env.DB_MAP_PAIRS || 'ui_pairs_round5.json');
  test.skip(!fs.existsSync(f), `chưa có ${f}`);
  const cases = JSON.parse(fs.readFileSync(f, 'utf8')) as { type: string; pairs: { label: string; value: string }[] }[];
  const byType = new Map(cases.map((c) => [c.type, c.pairs]));

  for (const [col, groups] of Object.entries(GROUPS)) {
    // Gộp mọi view của cùng một đơn: nhãn ở tab nào cũng tính (một màn không phải cả app).
    const perGroup: Record<string, Map<string, Set<string>>[]> = {};
    let missing = false;
    for (const [g, types] of Object.entries(groups)) {
      const orders = new Map<string, Map<string, Set<string>>>();
      for (const t of types) {
        const pairs = byType.get(t);
        if (!pairs) { console.log(`[g2] ${col}: thiếu view "${t}" trong file cặp`); missing = true; continue; }
        const key = t.replace(/_(ov|tx|hs)$/, '');
        const m = orders.get(key) || new Map<string, Set<string>>();
        for (const p of pairs) (m.get(p.label) || m.set(p.label, new Set()).get(p.label)!).add(p.value);
        orders.set(key, m);
      }
      perGroup[g] = [...orders.values()];
    }
    if (missing) continue;

    const gNames = Object.keys(perGroup);
    const allOrders = gNames.flatMap((g) => perGroup[g]);
    const common = [...allOrders[0].keys()].filter((l) => allOrders.every((o) => o.has(l)));

    const hits: string[] = [];
    for (const label of common) {
      const valOf = (o: Map<string, Set<string>>) => [...o.get(label)!].sort().join('|');
      const perG = gNames.map((g) => {
        const vs = [...new Set(perGroup[g].map(valOf))];
        return vs.length === 1 ? vs[0] : null;                 // (b) không đổi trong nhóm
      });
      if (perG.some((v) => v === null)) continue;
      if (new Set(perG).size !== gNames.length) continue;      // (c) khác nhau giữa các nhóm
      hits.push(`"${label}" → ${gNames.map((g, i) => `${g}=${JSON.stringify(perG[i])}`).join(' · ')}`);
    }
    console.log(`[g2] ${col}: ${common.length} nhãn có ở mọi đơn · ${hits.length} nhãn phân biệt được nhóm`);
    for (const h of hits.slice(0, 8)) console.log(`      ${h}`);
    if (!hits.length) console.log('      ⇒ KHÔNG neo được: không nhãn nào phân biệt hai nhóm ở các màn đã đọc');
  }
});
