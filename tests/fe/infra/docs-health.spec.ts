import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * Lưới cho `docs:health` — máy trả lời "tài liệu tôi đang đọc có còn đúng không".
 *
 * Mỗi test dưới đây ứng với một sự cố ĐÃ XẢY RA hôm 18/09/2026 trên SAPP-26878, không phải rủi ro
 * tưởng tượng: 2 file fetch về rỗng, 13 file mất sạch bảng, 10.555 chỗ còn entity chưa giải, và 14
 * trên 23 trang đã bị sửa sau ngày fetch. Cả bốn đều im lặng khi chỉ mở file ra đọc.
 *
 * Test chạy trên THƯ MỤC FIXTURE, không gọi Confluence. Phần cần mạng (LỆCH BẢN, MẤT BẢNG) chỉ bật
 * khi có token, nên ở đây chốt phần đọc file cộng với việc máy không bỏ sót khuôn đầu file nào.
 */

const REPO = path.resolve(__dirname, '../../..');
const GATE = path.join(REPO, 'scripts/phase1/docs_health.js');

function run(dir: string, extra: string[] = []) {
  try {
    return {
      code: 0,
      out: execFileSync('node', [GATE, '--dir', dir, ...extra], {
        cwd: REPO, encoding: 'utf8', env: gateEnv(), stdio: ['ignore', 'pipe', 'pipe'],
      }),
    };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status, out: `${err.stdout || ''}${err.stderr || ''}` };
  }
}

function fixture(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-health-'));
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body, 'utf8');
  return dir;
}

const LANH = `# US-01: Tạo Business Partner

## Page ID: 111111
## Version: v3 (2026-08-17)

| BR | Rule | AC |
| --- | --- | --- |
| BR-01 | Mã khách hàng ghép từ số định danh | AC-1.1 |

Nội dung đủ dài để không bị coi là rỗng. ${'Chữ nghiệp vụ. '.repeat(30)}
`;

test('file lành thì không báo gì', () => {
  const r = run(fixture({ 'a.md': LANH }));
  expect(r.out).toContain('Không thấy vấn đề nào');
  expect(r.code).toBe(0);
});

test('bắt file RỖNG — đúng hình dạng 2 file 72 và 91 byte gặp thật', () => {
  const r = run(fixture({ 'rong.md': '# Tiêu đề\n\n## Page ID: 222222\n' }));
  expect(r.out).toContain('RỖNG');
  expect(r.out).toContain('rong.md');
});

test('bắt CÒN ENTITY, vì "tr&ecirc;n" không khớp khi tra "trên"', () => {
  const body = LANH.replace('Tạo Business Partner', 'Tạo BP tr&ecirc;n SAP').replace('## Page ID: 111111', '## Page ID: 333333');
  const r = run(fixture({ 'ent.md': body }));
  expect(r.out).toContain('CÒN ENTITY');
});

test('`&#124;` do chính bộ đổi chèn vào ô bảng KHÔNG bị tính là entity sót', () => {
  const body = LANH.replace('Mã khách hàng ghép từ số định danh', 'Chọn Nam &#124; Nữ').replace('111111', '444444');
  const r = run(fixture({ 'pipe.md': body }));
  expect(r.out).not.toContain('CÒN ENTITY');
});

/*
 * Bản đầu của máy này chỉ nhận khuôn `Page ID:` nên bỏ sót nguyên một thư mục 16 file và vẫn in
 * "không thấy vấn đề nào". Một máy đo bỏ sót tệ hơn không có máy, vì nó phát tín hiệu sạch SAI.
 */
test('nhận đủ 3 khuôn đầu file mà các đợt fetch khác nhau đã sinh ra', () => {
  const dir = fixture({
    'kieu1.md': '# A\n\n## Page ID: 555001\n\nquá ngắn',
    'kieu2.md': '# B\n\n> id 555002 · version 9 · 2026-09-16\n\nquá ngắn',
    '555003__C.md': '# C\n\nkhông có dòng id nào, chỉ có tên file\n\nquá ngắn',
  });
  const r = run(dir);
  expect(r.out).toContain('3 tài liệu Confluence');
  for (const f of ['kieu1.md', 'kieu2.md', '555003__C.md']) expect(r.out).toContain(f);
});

test('file .md không phải tài liệu Confluence thì bỏ qua, không báo oan', () => {
  const r = run(fixture({ 'ghichu.md': '# Ghi chú tay\n\nkhông có page id.' }));
  expect(r.out).toContain('không có tài liệu Confluence nào');
});

/*
 * Cùng một trang thường có nhiều bản trong task do fetch nhiều đợt. Kêu tên từng file đã bị thay là
 * cách nhanh nhất để người ta học cách bỏ qua báo cáo này.
 */
test('bản cũ của trang đã có bản lành thì gộp một dòng, không kêu tên', () => {
  const r = run(fixture({
    'moi.md': LANH,
    'cu.md': '# US-01 bản cũ\n\n## Page ID: 111111\n\nngắn',
  }));
  expect(r.out).toContain('bỏ qua 1 file cũ');
  expect(r.out).not.toContain('cu.md');
});

test('--strict thì exit 1, mặc định vẫn exit 0 vì đây là báo cáo chứ không phải cổng', () => {
  const dir = fixture({ 'rong.md': '# T\n\n## Page ID: 666666\n' });
  expect(run(dir).code).toBe(0);
  expect(run(dir, ['--strict']).code).toBe(1);
});

test('--dir trỏ vào chỗ không có thì CHẶN, không im lặng coi như sạch', () => {
  const r = run(path.join(os.tmpdir(), 'khong-ton-tai-' + Date.now()));
  expect(r.code).toBe(2);
});
