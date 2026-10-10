import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * @infra — BÓ GATE: chạy bó phải cho CÙNG kết quả với chạy rời.
 *
 * TRẦN CỦA VIỆC NÀY, đo trước khi làm chứ không khai sau: trên 5 phiên chạy task thật, toàn bộ lệnh
 * của kit cộng lại chỉ **248 lượt trong 11.781 lượt shell, tức 2,1%**. Chỗ thật sự tốn là thăm dò tay
 * (`node -e` 1.442 · `grep` 1.190 · `for` 948 · `sed` 825). Nên bó gate KHÔNG phải đòn bẩy token chính,
 * và spec này không được dùng để nói ngược lại.
 *
 * Giá trị thật của nó nằm ở chỗ khác: cuối mỗi phase có 4 đến 5 lệnh luôn đi cùng nhau, chạy rời thì
 * rất dễ chạy thiếu một cái rồi tưởng đã kiểm hết.
 *
 * ĐIỀU KIỆN SỐNG CÒN, và là thứ spec này gác: **bó không được trở thành một gate thứ hai nói khác gate
 * thật.** Một bản bó tự kiểm lấy sẽ trôi khỏi gate gốc sau vài lần sửa, rồi cho ĐẠT ở chỗ gate gốc
 * CHẶN — tức là nó hợp pháp hoá đúng thứ nó sinh ra để chặn.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const PC = path.join(REPO, 'scripts/qa/phase_check.js');

function chay(argv: string[]) {
  const r = spawnSync(process.execPath, [PC, ...argv], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

function chayRoi(cmd: string[], task: string) {
  const argv = [path.join(REPO, cmd[0]), ...cmd.slice(1)];
  const r = spawnSync(process.execPath, [...argv, '--task', task], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { BUOC } = require('../../../scripts/qa/phase_check.js');

test.describe('@infra phase:check — bó gate, kết quả phải GIỐNG chạy rời', () => {
  test('mọi bước trỏ tới một script CÓ THẬT', () => {
    /* Một bước trỏ vào file không tồn tại thì nó im lặng không chạy, và bó báo ĐẠT thiếu một gate. */
    for (const [phase, ds] of Object.entries(BUOC as Record<string, any[]>)) {
      for (const b of ds) {
        expect(fs.existsSync(path.join(REPO, b.cmd[0])), `phase ${phase}: "${b.ten}" trỏ tới ${b.cmd[0]} không tồn tại`).toBe(true);
      }
    }
  });

  test('`--list` in đủ số bước và nói rõ bước nào CHẶN, bước nào chỉ báo cáo', () => {
    const r = chay(['--phase', '2', '--task', 'X', '--list']);
    expect(r.code).toBe(0);
    for (const b of BUOC['2']) expect(r.out, `thiếu bước ${b.ten}`).toContain(b.ten);
    expect(r.out, 'phải phân biệt CHẶN với báo cáo').toContain('báo cáo');
  });

  test('TƯƠNG ĐƯƠNG: mỗi bước CHẶN trong bó cũng CHẶN khi chạy rời, và ngược lại', () => {
    /*
     * Phép kiểm trung tâm. Dùng một TASK_KEY không tồn tại: nó làm vài gate chặn thật, nên so được cả
     * hai phía. Không dựng fixture giả cho từng gate — mỗi gate đã có spec riêng; ở đây chỉ so BÓ với RỜI.
     */
    const TASK = 'KHONG-CO-TASK-NAY';
    const bo = chay(['--phase', '2', '--task', TASK]);

    const roi = BUOC['2'].map((b: any) => ({ ten: b.ten, chan: b.chan, ...chayRoi(b.cmd, TASK) }));
    const roiDo = roi.filter((x) => x.chan && x.code !== 0).map((x) => x.ten);
    const boDo = BUOC['2'].filter((b: any) => bo.out.includes(`✗ CHẶN  ${b.ten}`)).map((b: any) => b.ten);

    expect(boDo.sort(), 'tập bước CHẶN phải giống hệt giữa bó và rời').toEqual(roiDo.sort());
    expect(bo.code, 'có bước chặn ⇒ bó phải exit 1').toBe(roiDo.length ? 1 : 0);
  });

  test('bước BÁO CÁO không được làm đỏ cả bó', () => {
    /*
     * `results:summary` là máy báo cáo: thiếu results.json thì nó exit khác 0, nhưng đó KHÔNG phải vi
     * phạm chất lượng. Để nó làm đỏ cả bó thì người chạy sẽ học cách bỏ qua màu đỏ — và đó là cách
     * nhanh nhất giết một gate.
     */
    const bc = BUOC['2'].filter((b: any) => !b.chan);
    expect(bc.length, 'phase 2 phải có ít nhất một bước báo cáo').toBeGreaterThan(0);
    const r = chay(['--phase', '2', '--task', 'KHONG-CO-TASK-NAY']);
    for (const b of bc) expect(r.out, `${b.ten} là báo cáo, không được in là CHẶN`).not.toContain(`✗ CHẶN  ${b.ten}`);
  });

  test('bó KHÔNG tự kiểm gì — nó chỉ spawn gate thật', () => {
    /*
     * Neo vào cấu trúc, không vào lời hứa trong comment. Nếu ai đó thêm luật vào đây thì file sẽ phải
     * đọc artifact của task (`testcase-status`, `.xlsx`, `verdict`) — và đó là dấu hiệu đọc được.
     */
    const src = fs.readFileSync(PC, 'utf8');
    expect(src, 'bó phải spawn tiến trình con').toContain('spawnSync');
    for (const dau of ['testcase-status', 'verdict_taxonomy', 'readFileSync(']) {
      expect(src, `bó đang tự đọc artifact ("${dau}") ⇒ nó đã thành gate thứ hai`).not.toContain(dau);
    }
  });

  test('thiếu `--task` thì TỪ CHỐI chạy, không chạy bừa', () => {
    const r = chay(['--phase', '2']);
    expect(r.code, 'không có task thì mỗi gate đọc một chỗ khác nhau').toBe(2);
    expect(r.out).toContain('--task');
  });

  test('`--phase` lạ thì từ chối, không im lặng chạy phase mặc định', () => {
    const r = chay(['--phase', '9', '--task', 'X']);
    expect(r.code).toBe(2);
    expect(r.out).toContain('9');
  });
});
