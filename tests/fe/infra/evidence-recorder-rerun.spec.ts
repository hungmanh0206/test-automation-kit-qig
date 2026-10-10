/**
 * Hai hành vi của `EvidenceRecorder` mà gate dựa vào — phải có test giữ, không thì lặng lẽ hỏng.
 *
 * 1. `reruns` do MÁY ĐẾM qua các lượt chạy, không do người khai.
 *    `output_gate` đòi case FAIL ở tầng product/api_bug khai số lần rerun để chứng minh đã loại flaky.
 *    Nếu con số đó nhận từ tham số thì nó chỉ là lời khai — đúng thứ gate sinh ra để chặn. Recorder đọc
 *    shard của lượt trước và cộng 1, nên muốn `reruns: 2` thì phải chạy thật 3 lượt.
 *
 * 2. `step.name` được LƯU, không chỉ in ra console.
 *    Trước đây record chỉ có `comment`, và `comment = opts.comment || name` ⇒ bước nào có comment thì tên
 *    bước biến mất khỏi file kết quả. Người đọc report thấy dãy số đo mà không biết đang đo cái gì.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { EvidenceRecorder } = require('../../../scripts/utils/evidence_recorder');

/** Trang trắng, đủ để `step()` chụp được ảnh. */
const TRANG_TRONG = 'data:text/html,<html><body><h1>kiem tra recorder</h1></body></html>';

function thuMucTam() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rec-rerun-'));
}

/** Một lượt chạy = một recorder mới trên cùng thư mục output, đúng như hai lần gọi playwright. */
async function motLuot(page: any, goc: string, tcId: string, ketQua: 'FAILED' | 'PASSED') {
  const rec = new EvidenceRecorder({ taskKey: 'TEST-REC', projectOutputDir: 'out', repoRoot: goc, log: false });
  const tc = rec.case(tcId);
  await tc.step(page, 'Bước 1 — tên bước này phải còn trong file kết quả', {
    status: ketQua,
    comment: '- một dòng comment, đủ để đẩy tên bước ra khỏi chỗ cũ',
  });
  await tc.finish(ketQua, ketQua === 'FAILED' ? { failureLayer: 'product_bug' } : {});
  await rec.write();
  return JSON.parse(fs.readFileSync(path.join(goc, 'out/tasks/TEST-REC/test-results/testcase-status.json'), 'utf8'));
}

test.describe('EvidenceRecorder — rerun đếm được và tên bước giữ được', () => {
  test('reruns cộng dồn qua từng lượt chạy, không nhận từ tham số', async ({ page }) => {
    const goc = thuMucTam();
    await page.goto(TRANG_TRONG);

    const l1 = await motLuot(page, goc, 'TC_X', 'FAILED');
    expect(l1.tests[0].reruns, 'lượt chạy đầu chưa phải chạy lại').toBe(0);

    const l2 = await motLuot(page, goc, 'TC_X', 'FAILED');
    expect(l2.tests[0].reruns, 'fail lần hai = đã chạy lại 1 lần').toBe(1);

    const l3 = await motLuot(page, goc, 'TC_X', 'FAILED');
    expect(l3.tests[0].reruns, 'fail lần ba = đã chạy lại 2 lần, đủ ngưỡng taxonomy').toBe(2);

    fs.rmSync(goc, { recursive: true, force: true });
  });

  test('shard theo TC bị ARCHIVE đi thì reruns vẫn sống, đọc tiếp từ bản gộp', async ({ page }) => {
    /*
     * CA THẬT, đã đo trên CSDL-9001. `archive-cap-THCS/testcase-status.json` ngày 02/10 ghi
     * `CSDL_HSTRUONG_TC_123` có `reruns: 2`. Mọi bản từ 06/10 ghi **0**, vì shard theo TC nằm trong thư
     * mục của MỘT lượt chạy và nó đi theo lượt đó khi người ta archive.
     *
     * Verdict sống sót qua carry-over, nhưng BẰNG CHỨNG đã rerun thì reset. Hệ quả đo được: 7 verdict
     * vốn đúng luật bị `output_gate` chặn với lý do "chỉ rerun 0 lần". Người gặp sẽ hoặc chạy lại một
     * cách vô ích, hoặc sửa tay `reruns` — tức bịa đúng con số mà gate sinh ra để chặn.
     *
     * Bản gộp `testcase-status.json` sống lâu hơn shard, nên recorder đọc tiếp từ đó.
     */
    const goc = thuMucTam();
    await page.goto(TRANG_TRONG);

    await motLuot(page, goc, 'TC_ARCHIVE', 'FAILED');
    const l2 = await motLuot(page, goc, 'TC_ARCHIVE', 'FAILED');
    expect(l2.tests[0].reruns, 'hai lượt fail = đã chạy lại 1 lần').toBe(1);

    // Mô phỏng ARCHIVE: xoá thư mục shard, giữ nguyên bản gộp — đúng như `archive-cap-<CẤP>/`.
    const shardDir = path.join(goc, 'out/tasks/TEST-REC/test-results/testcase-status');
    const coShard = fs.existsSync(shardDir);
    if (coShard) fs.rmSync(shardDir, { recursive: true, force: true });
    expect(coShard, 'fixture phải thật sự có thư mục shard, nếu không phép kiểm này rỗng').toBe(true);

    const l3 = await motLuot(page, goc, 'TC_ARCHIVE', 'FAILED');
    expect(l3.tests[0].reruns, 'mất shard KHÔNG được làm bộ đếm quay về 0').toBe(2);

    fs.rmSync(goc, { recursive: true, force: true });
  });

  test('case chuyển sang PASSED thì bộ đếm về 0 — lần fail sau là quan sát mới', async ({ page }) => {
    const goc = thuMucTam();
    await page.goto(TRANG_TRONG);

    await motLuot(page, goc, 'TC_Y', 'FAILED');
    await motLuot(page, goc, 'TC_Y', 'FAILED');
    const xanh = await motLuot(page, goc, 'TC_Y', 'PASSED');
    expect(xanh.tests[0].reruns, 'case PASS không mang số rerun').toBeUndefined();

    const doLai = await motLuot(page, goc, 'TC_Y', 'FAILED');
    expect(doLai.tests[0].reruns, 'chuỗi fail cũ đã đứt, không được cộng dồn tiếp').toBe(0);

    fs.rmSync(goc, { recursive: true, force: true });
  });

  test('tên bước được lưu cùng comment, không bị comment nuốt mất', async ({ page }) => {
    const goc = thuMucTam();
    await page.goto(TRANG_TRONG);

    const kq = await motLuot(page, goc, 'TC_Z', 'PASSED');
    const b = kq.tests[0].steps[0];
    expect(b.name, 'tên bước phải nằm trong record').toContain('tên bước này phải còn trong file kết quả');
    expect(b.comment, 'comment vẫn giữ nguyên nội dung riêng của nó').toContain('một dòng comment');
    expect(b.name).not.toBe(b.comment);

    fs.rmSync(goc, { recursive: true, force: true });
  });
});
