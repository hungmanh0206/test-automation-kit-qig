import { test, expect } from '@playwright/test';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { gateEnv } from './_gate_env';

/*
 * `knowledge/` PHẢI bị chặn theo kiểu CẤM-CẢ-THƯ-MỤC, không phải liệt kê từng đường dẫn.
 *
 * VÌ SAO CÓ FILE NÀY. Luật cũ trong `.gitignore` là một danh sách liệt kê: `knowledge/index.json`,
 * `knowledge/bugs/*.json`, `knowledge/domain/*.json`… Danh sách kiểu đó chỉ đúng với những thứ ĐÃ BIẾT
 * lúc viết. Mọi thứ MỚI trong `knowledge/` đều lọt qua:
 *
 *   - `knowledge/leak_machine_map.json` — chính `README.md` và `scripts/qa/leak_report.js` bảo người
 *     dùng tạo file này. Tạo xong là nó được track.
 *   - `knowledge/bugs/SAPP-99999.md` — luật cũ chỉ chặn `*.json`. Tên file bug là slug tiêu đề defect,
 *     nên riêng ĐƯỜNG DẪN đã mô tả lỗi sản phẩm.
 *   - một store mới bất kỳ, ví dụ `knowledge/store_moi/`.
 *
 * Đo ngày 19/09/2026 trên luật cũ: 5 trên 7 đường dẫn thật sẽ bị commit. Mirror GitHub là PUBLIC.
 *
 * Chuyện này KHÔNG phải giả định. Lịch sử repo từng có 86 file `knowledge/` được commit rồi mới gỡ ở
 * `58a5fe5 chore(security)`. Quét lại 86 file đó: 0 file chứa email, số điện thoại hay secret. Nhưng nội
 * dung là tiêu đề defect nội bộ, module, Jira key và mã testcase.
 *
 * Luật đã sửa thành cấm cả thư mục rồi mở lại đúng hai thứ. Test này giữ cho nó không trôi ngược,
 * và có ĐỐI CHỨNG ÂM: nếu ai đó sửa thành "chặn sạch" thì ba test cuối sẽ đỏ.
 *
 * KHÔNG CÓ `.git` THÌ BỎ QUA, KHÔNG PHẢI ĐỎ VÀ CŨNG KHÔNG PHẢI XANH. Gói phát hành cố ý không mang
 * `.git` (`release:verify` kiểm đúng điều đó), nên câu hỏi "đường dẫn này có bị gitignore không" không
 * có nghĩa ở đó. Bản đầu của file này quên chuyện đó và hỏng theo kiểu tệ nhất khi chạy trong gói:
 * 9 test ĐỎ, còn 3 test thì XANH NHẦM LÝ DO vì lỗi git bị nuốt thành "không bị chặn".
 */
const REPO = path.resolve(__dirname, '..', '..', '..');

/** Có thật sự đang đứng trong một git work-tree không. Gói phát hành thì không. */
function coGit(): boolean {
  const r = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return r.status === 0 && String(r.stdout).trim() === 'true';
}

/**
 * Hỏi CHÍNH git xem một đường dẫn có bị ignore không. Không tự diễn giải `.gitignore` bằng regex.
 *
 * `git check-ignore` trả 0 khi BỊ ignore, 1 khi KHÔNG, và khác 0/1 khi lỗi. Phải tách trường hợp lỗi ra,
 * vì gộp "git hỏng" vào "không bị ignore" là biến một test hỏng thành một test xanh.
 */
function biChan(duongDan: string): boolean {
  const r = spawnSync('git', ['check-ignore', '-q', '--', duongDan], { cwd: REPO, env: gateEnv() });
  if (r.status !== 0 && r.status !== 1) {
    throw new Error(`git check-ignore lỗi (status=${r.status}) cho ${duongDan}: ${String(r.stderr || '').trim()}`);
  }
  return r.status === 0;
}

/*
 * Đường dẫn đại diện. Năm cái đầu là đúng năm cái đã lọt qua luật cũ — giữ nguyên để test này kể lại
 * được sự cố, chứ không phải danh sách bịa ra cho đẹp.
 */
const PHAI_CHAN = [
  'knowledge/leak_machine_map.json',
  'knowledge/domain/ghi-chu.md',
  'knowledge/bugs/SAPP-99999.md',
  'knowledge/store_moi/du_lieu.json',
  'knowledge/locators/app.yaml',
  'knowledge/index.json',
  'knowledge/bugs/x.json',
  'knowledge/metrics/runs.jsonl',
];

/** Đúng hai thứ được ở lại repo: mô tả hình dạng entry, và mốc giữ thư mục rỗng. */
const PHAI_GIU = ['knowledge/SCHEMA.md', 'knowledge/bugs/.gitkeep', 'knowledge/metrics/.gitkeep'];

test.describe('@infra knowledge/ không lọt ra repo', () => {
  // Khai lý do bỏ qua một lần, ngay đầu: người đọc log không phải đoán.
  test.skip(!coGit(), 'không có .git (đang chạy trong gói phát hành) — câu hỏi gitignore không có nghĩa ở đây');

  for (const p of PHAI_CHAN) {
    test(`bị gitignore: ${p}`, () => {
      expect(biChan(p), `${p} KHÔNG bị ignore — dữ liệu công ty sẽ lên mirror public`).toBe(true);
    });
  }

  // ĐỐI CHỨNG ÂM: luật "chặn sạch knowledge/" cũng sai, vì khung thư mục phải đi theo clone.
  for (const p of PHAI_GIU) {
    test(`KHÔNG bị chặn (khung phải đi theo clone): ${p}`, () => {
      expect(fs.existsSync(path.join(REPO, p)), `${p} phải có thật trong repo`).toBe(true);
      expect(biChan(p), `${p} bị chặn nhầm — người clone sẽ nhận knowledge/ không có khung`).toBe(false);
    });
  }

  test('cây hiện tại chỉ track SCHEMA.md và các .gitkeep', () => {
    const r = spawnSync('git', ['ls-files', 'knowledge'], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    expect(r.status, `git ls-files lỗi: ${String(r.stderr || '').trim()}`).toBe(0);
    const dang = String(r.stdout).split('\n').map((s) => s.trim()).filter(Boolean);
    const la = dang.filter((f) => f !== 'knowledge/SCHEMA.md' && !f.endsWith('/.gitkeep'));
    expect(la, `đang track file knowledge/ ngoài khung: ${la.join(', ')}`).toEqual([]);
  });
});
