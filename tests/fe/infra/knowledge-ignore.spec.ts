import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
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
 * và có ĐỐI CHỨNG ÂM: nếu ai đó sửa thành "chặn sạch" thì hai dòng cuối sẽ đỏ.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');

/** Hỏi CHÍNH git xem một đường dẫn có bị ignore không. Không tự diễn giải `.gitignore` bằng regex. */
function biChan(duongDan: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '-q', '--', duongDan], { cwd: REPO, stdio: 'ignore', env: gateEnv() });
    return true;
  } catch {
    return false; // exit != 0 nghĩa là KHÔNG bị ignore
  }
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
    const ra = execFileSync('git', ['ls-files', 'knowledge'], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    const dang = ra.split('\n').map((s) => s.trim()).filter(Boolean);
    const la = dang.filter((f) => f !== 'knowledge/SCHEMA.md' && !f.endsWith('/.gitkeep'));
    expect(la, `đang track file knowledge/ ngoài khung: ${la.join(', ')}`).toEqual([]);
  });
});
