import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

/*
 * @infra — MẪU SỐ COVERAGE PHẢI CÓ XUẤT XỨ.
 *
 * Ca thật đã xảy ra (CSDL-3544): Phase 1 sinh 60 case, `dim:coverage --enforce` báo "10/10 chiều đạt",
 * summary ghi coverage 83,3% và `Final Decision: CONDITIONAL PASS`. Cả ba con số đứng trên mẫu số do
 * CHÍNH AGENT khai: manifest tự đánh 10 chiều `n/a`, "Tổng requirement in-scope = 12" tự đếm, `ui_catalog`
 * dựng từ ảnh chụp build. Không máy nào trong kit hỏi được "12 ở đâu ra?".
 *
 * Triệu chứng QA thấy: gen 50 case → bảo thiếu → lượt sau ra nhiều hơn hẳn. Lượt đầu không có gì neo nên
 * dừng ở chỗ nó thấy hợp lý; người review thành gate duy nhất có thật.
 *
 * Test khoá 4 điều: manifest `n/a` phải có người ký · mẫu số phải khớp danh mục có nguồn · catalog lấy từ
 * build phải đánh dấu MÁY ĐỌC ĐƯỢC (văn xuôi không tính) · số case đổi mà danh mục không đổi thì phải
 * chặn. Kèm âm tính: neo đủ thì KHÔNG được báo oan.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { gateScopeAnchor } = require(path.resolve(__dirname, '../../../scripts/qa/scope_anchor.js'));

const HEAD = '| TC ID | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên | Mức độ rủi ro |\n|---|---|---|---|---|---|---|---|---|\n';

const summary = (denom: number, decision: string) => `### Coverage Summary

| Metric | Value | Comment |
|---|---|---|
| Tổng requirement in-scope | ${denom} | |

### Final Decision

${decision}
`;

const inventory = (n: number, withSource = true) => {
  let md = '# Danh mục phạm vi\n\n| ID | Mục | Nguồn |\n|---|---|---|\n';
  for (let i = 1; i <= n; i += 1) md += `| INV-${String(i).padStart(3, '0')} | Màn ${i} | spec.md#m${i} |\n`;
  return withSource ? md : md.replace(/spec\.md#m\d+/g, '');
};

type Opts = {
  denom?: number; invItems?: number | null; invSource?: boolean;
  reviewed?: boolean; naReason?: boolean; decision?: string;
  catalogSource?: string | null; catalogObservation?: boolean;
  cases?: number; ledgerCases?: number | null; ledgerInv?: number | null;
};

/** Dựng một task giả trên đĩa tạm, chỉ gồm những file gate này đọc. */
function mkTask(o: Opts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scopeanchor-'));
  const req = path.join(dir, 'requirements');
  const rep = path.join(dir, 'reports');
  fs.mkdirSync(req, { recursive: true });
  fs.mkdirSync(rep, { recursive: true });

  const manifest: Record<string, unknown> = {
    dimensions: { ui_display: 'required', api: 'n/a' },
    na_reasons: o.naReason === false ? {} : { api: 'Scope không chạm API nào' },
  };
  if (o.reviewed !== false) { manifest.reviewed_by = 'QA Lead'; manifest.reviewed_at = '2026-09-25'; }
  fs.writeFileSync(path.join(req, 'dimension_manifest.json'), JSON.stringify(manifest), 'utf8');

  if (o.invItems != null) fs.writeFileSync(path.join(req, 'scope_inventory.md'), inventory(o.invItems, o.invSource !== false), 'utf8');
  if (o.catalogSource !== null) {
    const cat: Record<string, unknown> = { _source: o.catalogSource ?? 'FSD mục 3.2', screens: [] };
    if (o.catalogObservation) cat.oracle = 'OBSERVATION';
    fs.writeFileSync(path.join(req, 'ui_catalog.json'), JSON.stringify(cat), 'utf8');
  }
  if (o.ledgerCases != null) {
    fs.writeFileSync(path.join(req, '.scope_ledger.json'),
      JSON.stringify({ runs: [{ at: '2026-09-24 10:00:00', tc_count: o.ledgerCases, inventory_count: o.ledgerInv ?? o.invItems ?? null }] }), 'utf8');
  }
  fs.writeFileSync(path.join(rep, 'phase1-summary.md'), summary(o.denom ?? 2, o.decision ?? 'BLOCKED'), 'utf8');

  if (o.cases != null) {
    const tcDir = path.join(dir, 'test-cases');
    fs.mkdirSync(tcDir, { recursive: true });
    let md = HEAD;
    for (let i = 1; i <= o.cases; i += 1) md += `| TC_${String(i).padStart(3, '0')} | Order / Grid | ca ${i} | [ui] x | d | 1. bước | kết quả | Cao | High |\n`;
    fs.writeFileSync(path.join(tcDir, 'tc.md'), md, 'utf8');
  }
  return dir;
}

const joined = (r: { problems: string[] }) => r.problems.join(' || ');

test('@infra manifest khai n/a mà không ai ký thì CHẶN', () => {
  const r = gateScopeAnchor(mkTask({ denom: 2, invItems: 2, reviewed: false }));
  expect(joined(r)).toContain('reviewed_by');
});

test('@infra chiều n/a không có lý do thì CHẶN', () => {
  const r = gateScopeAnchor(mkTask({ denom: 2, invItems: 2, naReason: false }));
  expect(joined(r)).toMatch(/na_reasons/);
});

test('@infra mẫu số coverage không có danh mục thì CHẶN', () => {
  const r = gateScopeAnchor(mkTask({ denom: 12, invItems: null }));
  expect(joined(r)).toContain('KHÔNG NEO VÀO GÌ');
});

test('@infra mẫu số lệch số mục trong danh mục thì CHẶN', () => {
  const r = gateScopeAnchor(mkTask({ denom: 12, invItems: 3 }));
  expect(joined(r)).toContain('Lệch mẫu số');
});

test('@infra mục phạm vi không ghi nguồn thì CHẶN', () => {
  const r = gateScopeAnchor(mkTask({ denom: 3, invItems: 3, invSource: false }));
  expect(joined(r)).toMatch(/không ghi nguồn/);
});

test('@infra catalog lấy từ build, cảnh báo bằng văn xuôi thôi thì vẫn CHẶN', () => {
  const r = gateScopeAnchor(mkTask({
    denom: 2, invItems: 2,
    catalogSource: 'Ảnh chụp build do QA gửi — KHÔNG có FS/Figma, coi chừng oracle tautological',
  }));
  expect(joined(r)).toContain('OBSERVATION');
});

test('@infra catalog từ build nhưng đã đánh dấu OBSERVATION thì KHÔNG chặn', () => {
  const r = gateScopeAnchor(mkTask({
    denom: 2, invItems: 2,
    catalogSource: 'Ảnh chụp build do QA gửi', catalogObservation: true,
  }));
  expect(joined(r)).not.toContain('OBSERVATION');
});

test('@infra số case đổi ≥10% mà danh mục KHÔNG đổi thì CHẶN (lượt trước sinh thiếu)', () => {
  const r = gateScopeAnchor(mkTask({ denom: 2, invItems: 2, cases: 12, ledgerCases: 10, ledgerInv: 2 }));
  expect(joined(r)).toMatch(/SINH THIẾU/);
});

test('@infra số case đổi nhưng danh mục cũng mở rộng thì KHÔNG chặn', () => {
  const r = gateScopeAnchor(mkTask({ denom: 5, invItems: 5, cases: 12, ledgerCases: 10, ledgerInv: 2 }));
  expect(joined(r)).not.toMatch(/SINH THIẾU/);
});

test('@infra chưa neo mà kết luận PASS thì CHẶN thêm một lỗi riêng', () => {
  const r = gateScopeAnchor(mkTask({ denom: 12, invItems: null, decision: 'CONDITIONAL PASS' }));
  expect(joined(r)).toMatch(/không đủ cơ sở để kết luận PASS/);
});

test('@infra neo đủ thì KHÔNG báo oan', () => {
  const r = gateScopeAnchor(mkTask({ denom: 3, invItems: 3, decision: 'CONDITIONAL PASS' }));
  expect(r.problems).toEqual([]);
});

/*
 * Hồi quy: danh mục THẬT chia nhiều bảng theo loại mục (mã chức năng · business rule · khối field ·
 * chuỗi phụ thuộc · mục chờ BA), cộng một bảng "đã cân nhắc và loại" KHÔNG có cột Nguồn.
 * Bản đầu của parser dừng ở bảng đầu tiên ⇒ đếm 12/49 trên CSDL-9004 và sẽ báo "lệch mẫu số" OAN.
 * Gate đếm thiếu còn tệ hơn không có gate: sai một lần là không ai tin nữa.
 */
const multiTable = `# Danh mục phạm vi

## A. Mã chức năng

| ID | Mục | Nguồn |
|---|---|---|
| INV-001 | Chức năng 1 | oracle#38 |
| INV-002 | Chức năng 2 | oracle#38 |

Một đoạn văn xuôi chen giữa hai bảng.

## B. Business rule

| ID | Mục | Nguồn |
|---|---|---|
| INV-003 | Rule A | oracle#66 |

## C. Đã cân nhắc và loại khỏi phạm vi

| Mục | Vì sao loại |
|---|---|
| Màn báo cáo | Là báo cáo, không phải quản lý hồ sơ |
`;

test('@infra danh mục nhiều bảng: đếm hết mọi bảng có cột Nguồn', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { parseInventory } = require(path.resolve(__dirname, '../../../scripts/qa/scope_anchor.js'));
  const r = parseInventory(multiTable);
  expect(r.hasTable).toBe(true);
  expect(r.rows.map((x: { id: string }) => x.id)).toEqual(['INV-001', 'INV-002', 'INV-003']);
});

test('@infra bảng "đã loại" (không có cột Nguồn) KHÔNG bị tính vào phạm vi', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { parseInventory } = require(path.resolve(__dirname, '../../../scripts/qa/scope_anchor.js'));
  const r = parseInventory(multiTable);
  expect(r.rows.some((x: { item: string }) => x.item.includes('báo cáo'))).toBe(false);
});
