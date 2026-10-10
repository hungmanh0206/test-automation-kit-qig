import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * @infra — IMPACT CHẤM THEO TAG: nối lại một đường vốn ĐỨT HẲN.
 *
 * Chuyện đã xảy ra, và nó im lặng suốt: `risk_model.json §impact.modules` khai **20 tên module của dự án
 * TRƯỚC** (Payment · Refund · Cash Management…). Đo trên `CSDL-9003` ngày 11/10/2026: **10 module band High
 * và CẢ 10 đều là tên không tồn tại trong dự án này**, trong khi 18 module có dữ liệu thật ngồi ở Impact =
 * `default`. `executeOrder` vì vậy chỉ đường test tới thứ không có.
 *
 * Gỡ 20 tên đó thì Impact chỉ còn một đường: `impact.tagWeights`. Và đo tiếp mới thấy đường đó CŨNG đứt —
 * `impactOf()` lấy tag từ **bản ghi bug**, mà `learn_bugs` ghi `tags` bằng đúng MỘT giá trị: slug của chính
 * tên module (`them-moi-lop-hoc`). Không slug nào khớp tên chiều (`security`/`guard`/…), nên 23 trọng số
 * tag là một khối config **không thể nào nổ**. Đã sửa ở `learn_task.buildTcMap` + `learn_bugs.tagsFor`.
 *
 * Ba thứ phải gác, vì cả ba đều là loại lỗi KHÔNG làm gì đỏ lên:
 *   ① khoá `tagWeights` phải là tag THẬT (`DIMENSION_TAGS`) — khoá lạ = trọng số chết;
 *   ② `impact.modules` không được khai tên không có dữ liệu — đó đúng là lớp lỗi phantom vừa gỡ;
 *   ③ bản ghi bug mang tag chiều thì Impact PHẢI nhảy theo — chạy thật `risk_score`, không tin đọc code.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const MODEL = path.join(REPO, '.agent/config/risk_model.json');
const BUGS = path.join(REPO, 'knowledge/bugs');
const HIST = path.join(REPO, 'knowledge/historical_execution');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const canonical = require(path.join(REPO, 'scripts/lib/testcase'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const learn = require(path.join(REPO, 'scripts/qa/learn_task.js'));

const model = () => JSON.parse(fs.readFileSync(MODEL, 'utf8'));
const khoa = (o: Record<string, unknown>) => Object.keys(o || {}).filter((k) => !k.startsWith('_'));

test.describe('@infra tagWeights — khoá phải là tag THẬT', () => {
  test('mọi khoá `tagWeights` nằm trong `DIMENSION_TAGS`', () => {
    /*
     * `dimensionsOf()` CHỈ nhận tag có trong `DIMENSION_TAGS`, nên một khoá ngoài danh sách không bao giờ
     * khớp bất cứ gì. Đã gỡ 14 khoá như vậy (money · payment · transaction · cash · order · refund · auth ·
     * permission · sync · integration · calculation · attendance · report · ui-conformance) — mỗi khoá đo
     * được **0 case**, và phần lớn là từ vựng của dự án trước. Phép kiểm này chặn chúng quay lại.
     */
    const la = khoa(model().impact.tagWeights).filter((k) => !canonical.DIMENSION_TAGS.includes(k));
    expect(la, `khoá không có trong DIMENSION_TAGS: ${la.join(', ')}`).toEqual([]);
  });

  test('`positive`/`negative` CỐ Ý không có trọng số — và chuyện đó được ghi lại', () => {
    /*
     * Chúng là LOẠI case, không phải trục rủi ro: khai chúng thì gần như mọi case cùng một Impact và bảng
     * chấm mất hết khả năng phân biệt. Gác cả hai chiều — không khai, VÀ phải có câu giải thích — để lượt
     * sau không ai "thấy thiếu" rồi khai bù.
     */
    const w = model().impact.tagWeights;
    expect(w.positive, '`positive` không được có trọng số').toBeUndefined();
    expect(w.negative, '`negative` không được có trọng số').toBeUndefined();
    expect(model().impact._tagWeights_khong_khai, 'phải ghi VÌ SAO không khai').toMatch(/loại case/);
  });

  test('trọng số nằm trong 1–5 (thang Impact), không có số 0', () => {
    /* Trọng số 0 KHÔNG tắt tag — `impactOf` chỉ nhận `tw > 0` nên nó rơi về default một cách im lặng. */
    for (const [k, v] of Object.entries(model().impact.tagWeights)) {
      if (k.startsWith('_')) continue;
      expect(typeof v, `${k} phải là số`).toBe('number');
      expect(v as number, `${k} = ${v} ngoài thang 1–5`).toBeGreaterThanOrEqual(1);
      expect(v as number, `${k} = ${v} ngoài thang 1–5`).toBeLessThanOrEqual(5);
    }
  });
});

test.describe('@infra impact.modules — không được khai tên phantom', () => {
  test('mỗi tên khai phải có mặt trong bug hoặc snapshot lịch sử', () => {
    /*
     * Đúng lớp lỗi vừa gỡ. `risk_score` khớp CHÍNH XÁC cả chuỗi, nên một tên khai mà không nguồn dữ liệu
     * nào dùng thì nó tạo ra một dòng cold-start có Impact cao, 0 bug — rồi leo lên đầu `executeOrder`.
     *
     * Rỗng là HỢP LỆ và hiện đúng là rỗng: cột `Module` của bộ TC thật có 342 giá trị riêng biệt dạng
     * `<chức năng> / <màn> (<cấp>)`, khai từng cái không bảo trì nổi.
     */
    const co = new Set<string>();
    if (fs.existsSync(HIST)) {
      for (const f of fs.readdirSync(HIST).filter((x) => x.endsWith('.json'))) {
        try {
          const j = JSON.parse(fs.readFileSync(path.join(HIST, f), 'utf8'));
          Object.keys(j.modules || {}).forEach((m) => co.add(m));
        } catch { /* file lỗi → bỏ qua, risk_score cũng bỏ qua */ }
      }
    }
    if (fs.existsSync(BUGS)) {
      for (const f of fs.readdirSync(BUGS).filter((x) => x.endsWith('.json'))) {
        try { const j = JSON.parse(fs.readFileSync(path.join(BUGS, f), 'utf8')); if (j.module) co.add(j.module); } catch { /* idem */ }
      }
    }
    const phantom = khoa(model().impact.modules).filter((m) => !co.has(m));
    expect(phantom, `tên khai mà không bug/snapshot nào dùng: ${phantom.join(', ')}`).toEqual([]);
  });

  test('ghi lại phép đo A/B của lượt gỡ, kèm con số cả hai phía', () => {
    /*
     * Không có con số thì "đã gỡ phantom" đọc như một cải thiện, trong khi phép đo nói khác: CŨ 50 module
     * {High 10 · Medium 10 · Low 30} → MỚI 30 {Medium 1 · Low 29}, và **0 module thật đổi band**. Tức là
     * gỡ không làm bảng nhạy hơn — nó chỉ bỏ 40% số dòng là hư cấu.
     */
    const m = model().impact;
    expect(m._go_phantom_do_duoc, 'phải có phép đo A/B').toMatch(/0 module THẬT đổi band/);
    expect(m._go_phantom_do_duoc, 'và cấm đọc "0 High" như một cải thiện').toMatch(/Đừng đọc '0 High' như một cải thiện/);
  });
});

test.describe('@infra buildTcMap — tag chiều lấy từ ô Tag canonical', () => {
  function boTc(tagCell: string) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tcmap-'));
    fs.mkdirSync(path.join(d, 'test-cases'), { recursive: true });
    const md = [
      '| TC ID | Module | Trường hợp kiểm thử | Tag | Các bước | Kết quả mong đợi |',
      '|---|---|---|---|---|---|',
      `| TC_001 | Hồ sơ trường / Thêm mới (C2) | Kiểm ô bắt buộc | ${tagCell} | 1. Mở | 1. Hiện |`,
    ].join('\n');
    fs.writeFileSync(path.join(d, 'test-cases/bo.md'), `${md}\n`, 'utf8');
    return d;
  }

  test('LỌC bỏ oracle ref `BR-…`, giữ tag chiều', () => {
    /*
     * Ô `Tag` trộn ba thứ khác loại. Đo trên bộ CSDL-9003: 55 tên riêng biệt, **29 trong đó là `br-…`**.
     * Nhét thô vào bản ghi bug thì vừa làm bẩn nó, vừa khiến `bugs_checklist --tag` lọc theo mã oracle —
     * một nhãn không ai khai để lọc.
     */
    const d = boTc('[Positive][Security][BR-HOCSINH-001]');
    try {
      const v = learn.buildTcMap(d).get('TC_001');
      expect(v.tags).toEqual(['positive', 'security']);
      expect(v.module, 'Module lấy phần NHÓM trước dấu /').toBe('Hồ sơ trường');
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('tag lạ (không trong DIMENSION_TAGS) bị bỏ, không ném', () => {
    const d = boTc('[Positive][KhongCoTrongDanhSach]');
    try {
      expect(learn.buildTcMap(d).get('TC_001').tags).toEqual(['positive']);
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('`buildModuleMap` GIỮ chữ ký cũ (tcId → chuỗi)', () => {
    /* Sáu chỗ trong `learn_task`/`learn_bugs` đang dùng `modMap.get(id)` như một chuỗi. */
    const d = boTc('[Positive]');
    try {
      expect(typeof learn.buildModuleMap(d).get('TC_001')).toBe('string');
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });
});

test.describe('@infra chạy THẬT: bug mang tag chiều thì Impact nhảy theo', () => {
  /*
   * Phép đo đầu-cuối, vì đây đúng là chỗ đã đứt mà đọc code không thấy: cả `tagWeights` lẫn `impactOf`
   * đều "trông đúng", chỉ có bản ghi bug ở giữa là không mang tag nào khớp.
   *
   * Phải ghi file vào `knowledge/bugs` thật: `risk_score` chốt đường đọc ở `REPO_ROOT/knowledge`, không
   * nhận cờ nào để trỏ đi nơi khác. Kho này gitignore và là kho CỦA KIT (không phải UAT) — dọn trong
   * `finally`, và tên file có tiền tố `zz-gate-` để nhận ra ngay nếu một lượt chết cụt bỏ sót.
   */
  function chamVoiBug(tags: string[]) {
    const mod = 'ZZ Gate Tag Impact';
    const f = path.join(BUGS, `zz-gate-tag-impact.json`);
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'riskout-'));
    fs.mkdirSync(BUGS, { recursive: true });
    fs.writeFileSync(f, JSON.stringify({
      id: 'ZZ-1', bug: 'bản ghi của gate, không phải bug thật', module: mod, tags,
      task_key: 'ZZ-GATE', detected_phase: 'phase2', backlog_status: 'Open',
      created_at: new Date().toISOString().slice(0, 10),
    }, null, 2), 'utf8');
    try {
      const r = spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/risk_score.js'), '--out', out],
        { cwd: REPO, encoding: 'utf8', env: gateEnv() });
      const reg = JSON.parse(fs.readFileSync(path.join(out, 'risk-register.json'), 'utf8'));
      return { row: reg.modules.find((x: { module: string }) => x.module === mod), out: `${r.stdout}${r.stderr}` };
    } finally {
      fs.rmSync(f, { force: true });
      fs.rmSync(out, { recursive: true, force: true });
    }
  }

  test('tag `security` ⇒ Impact 5, nguồn `config.tag`', () => {
    const { row } = chamVoiBug(['security', 'zz-gate-tag-impact']);
    expect(row, 'module của bản ghi phải vào bảng').toBeTruthy();
    expect(row.drivers.impactSource, 'Impact phải đến TỪ TAG, không phải default').toBe('config.tag');
    expect(row.impact).toBe(5);
    expect(row.band, 'Impact 5 + có bug mở ⇒ High').toBe('High');
  });

  test('ÂM BẢN: chỉ có slug module (hành vi CŨ của learn_bugs) ⇒ rơi về default', () => {
    /*
     * Đây là trạng thái trước 11/10/2026 cho MỌI bản ghi. Giữ phép kiểm này để con số nói ra sự khác
     * biệt: cùng một module, cùng một bug, chỉ khác ô tag ⇒ Impact 3 thay vì 5.
     */
    const { row } = chamVoiBug(['zz-gate-tag-impact']);
    expect(row.drivers.impactSource).toBe('default');
    expect(row.impact).toBe(3);
  });

  test('`max` trên nhiều tag: `[Display][Guard]` ⇒ 5, không bị tag hiển thị kéo xuống', () => {
    /* Lý do phải khai cả nhóm mức 3: `impactOf` BỎ QUA tag không trọng số, nên thiếu một khoá là tụt. */
    expect(chamVoiBug(['display', 'guard']).row.impact).toBe(5);
  });

  test('kho bug trống ⇒ cảnh báo "tagWeights CHƯA NỔ", không im lặng', () => {
    /*
     * Một bảng toàn `default` trông y như một bảng đã được chấm. Đo 11/10/2026: 0 bản ghi bug ⇒ 0/30
     * module lấy Impact từ tag ⇒ 23 trọng số là đồ trang trí mà không có dòng nào nói ra.
     */
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'riskout-'));
    try {
      const r = spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/risk_score.js'), '--out', out],
        { cwd: REPO, encoding: 'utf8', env: gateEnv() });
      const txt = `${r.stdout}${r.stderr}`;
      const reg = JSON.parse(fs.readFileSync(path.join(out, 'risk-register.json'), 'utf8'));
      const theoTag = reg.modules.filter((x: { drivers: { impactSource: string } }) => x.drivers.impactSource === 'config.tag').length;
      if (theoTag === 0) {
        expect(txt, 'phải nói ra là tag chưa nổ').toMatch(/tagWeights CHƯA NỔ/);
        expect(txt, 'và nói ĐÚNG nguyên nhân: tag đọc từ knowledge/bugs').toMatch(/đọc từ knowledge\/bugs/);
        expect(fs.readFileSync(path.join(out, 'risk-register.md'), 'utf8'),
          'và cấm đọc bảng toàn default như bảng đã chấm').toMatch(/trông y như một bảng đã được chấm/);
      } else {
        expect(txt, 'đã có module chấm theo tag ⇒ KHÔNG được cảnh báo nữa').not.toMatch(/tagWeights CHƯA NỔ/);
      }
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  });
});
