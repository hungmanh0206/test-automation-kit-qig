import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

/*
 * _trong_repo — PHÉP KIỂM NÀO CHỈ PHÁN ĐƯỢC TRONG REPO, VÀ VÌ SAO PHẢI NÓI RA.
 *
 * `tests/fe/infra/**` ĐI THEO GÓI. Người nhận kit giải nén rồi chạy `npx playwright test tests/fe/infra`
 * là chuyện bình thường, và `release:verify` nay cũng chạy đúng lượt đó. Nhưng vài phép kiểm không thể
 * phán trong gói, và lý do không giống nhau:
 *
 *   · KHÔNG CÓ `.git`. Gói cố ý không mang `.git` (đó là một bước kiểm riêng). Mọi phép kiểm đối chiếu
 *     với `git ls-files` vì vậy KHÔNG có dữ liệu, chứ không phải đối chiếu ra kết quả xấu.
 *   · TÀI LIỆU CỦA REPO không được đóng gói — `docs/v2.4.1/**` là biên bản của kit, không phải nội dung
 *     người nhận cần.
 *
 * BA CÁCH XỬ LÝ, và chỉ một cách đúng:
 *   ① Cho đỏ  ⇒ người nhận kit mở hộp ra thấy bộ tự-kiểm đỏ, rồi học cách bỏ qua màu đỏ. Hỏng nhất.
 *   ② Cho xanh ⇒ một phép kiểm không chạy mà báo đạt. Đúng lớp lỗi cả đợt v2.4.1 này đi sửa.
 *   ③ BỎ QUA KÈM LÝ DO ⇒ báo cáo ghi "skipped", đọc được, và đếm được.
 *
 * Chọn ③. Và `verify_release.js` ĐẾM số skip rồi in ra, để số đó không lặng lẽ phình lên: một bộ kiểm
 * skip 200 test trông y hệt một bộ kiểm xanh nếu không ai đếm.
 */

/** Có `.git` VÀ `git` chạy được. Thiếu một trong hai thì mọi phép đối chiếu với cây git đều vô nghĩa. */
export function laRepoGit(repo: string): boolean {
  if (!fs.existsSync(path.join(repo, '.git'))) return false;
  const r = spawnSync('git', ['ls-files', '--error-unmatch', 'package.json'], { cwd: repo, encoding: 'utf8' });
  return r.status === 0;
}

/**
 * Bỏ qua test khi KHÔNG đứng trong repo git, kèm lý do đọc được.
 *
 * `viec` phải nói phép kiểm này đối chiếu CÁI GÌ, không phải nói "cần git" — người đọc báo cáo cần biết
 * mình đang mất phép kiểm nào.
 */
export function canRepoGit(repo: string, viec: string): void {
  test.skip(!laRepoGit(repo), `${viec} — cần cây git để đối chiếu, mà bản đóng gói cố ý không mang \`.git\`.`);
}

/** Bỏ qua khi một tài liệu của repo không có mặt (gói không mang `docs/` ngoài ảnh USER_GUIDE). */
export function canTaiLieu(repo: string, rel: string, viec: string): void {
  test.skip(!fs.existsSync(path.join(repo, rel)), `${viec} — cần \`${rel}\`, là biên bản của repo và không đi theo gói.`);
}
