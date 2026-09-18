import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * ẢNH TRONG TÀI LIỆU LÀ ĐIỂM MÙ CÓ HỆ THỐNG của kit: mọi gate đọc VĂN BẢN, nên nội dung sai nằm trong
 * PNG thì tồn tại vô hạn.
 *
 * ĐO 07/09/2026: `phase-selection.png` mang một badge NHÃN HAI CHỮ viết tắt của công cụ test-management
 * đã bỏ HẲN ngày 20/08 (nay là `PUB`). Nó sống sót vì gate cấm-tên-công-cụ-cũ chỉ khớp tên ĐẦY ĐỦ, không
 * khớp nhãn viết tắt — và vì ảnh là NHỊ PHÂN nên không gate nào đọc được nội dung. Người dùng đã nhìn
 * badge của một công cụ không còn tồn tại suốt 2 tuần.
 *
 * Chống bằng HAI lớp, và phải nói rõ lớp nào bắt lớp lỗi nào — không thì tưởng đã kín:
 *   ① `policy_source_check` siết thêm NHÃN VIẾT TẮT (`\bXR\b`) ở source sinh ảnh → bắt đúng vụ trên.
 *   ② File này: bộ ảnh phải KHỚP với generator và với tài liệu → bắt lớp KHÁC (thêm/xoá sơ đồ, sửa
 *      generator mà quên `npm run user-guide:images`, ảnh mồ côi, link chết).
 * Lớp ② KHÔNG bắt được vụ nhãn-viết-tắt (hồi đó ảnh và generator khớp nhau) — ghi ra đây để đừng nhầm.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const IMG_DIR = path.join(REPO, 'docs', 'user-guide-images');
const GENERATOR = path.join(REPO, 'scripts', 'utils', 'generate_user_guide_images.mjs');
const GUIDE = path.join(REPO, 'USER_GUIDE.md');

const pngsOnDisk = (): string[] => (fs.existsSync(IMG_DIR)
  ? fs.readdirSync(IMG_DIR).filter((f) => f.endsWith('.png')).sort()
  : []);

/**
 * Tên file generator KHAI sẽ sinh. Phải đọc CẢ HAI đường sinh, và neo vào chỗ GHI RA OUTPUT DIR:
 *   · mảng cấu hình:  `file: 'x.png'`
 *   · sơ đồ riêng:    `path.join(outDir, 'x.png')`  ← `aio-traceability.png` đi đường này
 * Bản đầu chỉ đọc `file:` ⇒ báo `aio-traceability.png` là ẢNH MỒ CÔI trong khi generator vẫn sinh nó.
 * Còn nếu bắt MỌI literal `.png` thì lại kéo cả `logo-sapp.png` (logo thương hiệu, không phải sơ đồ)
 * và sinh ra lỗi "khai mà thiếu file". Neo theo output dir là chỗ đúng.
 */
const pngsDeclared = (): string[] => {
  if (!fs.existsSync(GENERATOR)) return [];
  const src = fs.readFileSync(GENERATOR, 'utf8');
  const fromConfig = [...src.matchAll(/file:\s*'([\w.-]+\.png)'/g)].map((m) => m[1]);
  const fromOutDir = [...src.matchAll(/outDir,\s*'([\w.-]+\.png)'/g)].map((m) => m[1]);
  return [...new Set([...fromConfig, ...fromOutDir])].sort();
};

/** Ảnh được USER_GUIDE.md nhúng. */
const pngsReferenced = (): string[] => {
  if (!fs.existsSync(GUIDE)) return [];
  const md = fs.readFileSync(GUIDE, 'utf8');
  return [...md.matchAll(/!\[[^\]]*\]\(docs\/user-guide-images\/([\w.-]+\.png)\)/g)].map((m) => m[1]).sort();
};

/** Thời điểm commit cuối của một đường dẫn; null nếu không có git (gói phát hành không mang `.git`). */
function lastCommitTs(rel: string): number | null {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%ct', '--', rel], {
      cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: gateEnv(),
    }).trim();
    return out ? Number(out) : null;
  } catch {
    return null;   // không phải git repo — bỏ qua, KHÔNG fail (release:verify chạy trên cây sạch)
  }
}

test.describe('@infra ảnh tài liệu — gate đọc văn bản không thấy được nội dung PNG', () => {
  test('generator khai sinh ảnh nào thì ảnh đó phải CÓ trên đĩa', () => {
    const declared = pngsDeclared();
    if (!declared.length) { test.skip(true, 'không có generator trong gói này'); return; }
    const disk = pngsOnDisk();
    const missing = declared.filter((f) => !disk.includes(f));
    expect(missing, `generator khai ${declared.length} sơ đồ nhưng thiếu file: ${missing.join(', ')} — chạy \`npm run user-guide:images\``).toEqual([]);
  });

  test('không có ảnh MỒ CÔI (trên đĩa mà generator không còn khai)', () => {
    const declared = pngsDeclared();
    if (!declared.length) { test.skip(true, 'không có generator trong gói này'); return; }
    const orphan = pngsOnDisk().filter((f) => !declared.includes(f));
    expect(orphan, `ảnh không còn nguồn sinh: ${orphan.join(', ')} — xoá, hoặc khai lại trong generator`).toEqual([]);
  });

  test('mọi ảnh USER_GUIDE nhúng đều tồn tại (link chết = người đọc thấy ô trống)', () => {
    const refs = pngsReferenced();
    if (!refs.length) { test.skip(true, 'USER_GUIDE.md không có trong gói này'); return; }
    const disk = pngsOnDisk();
    const broken = refs.filter((f) => !disk.includes(f));
    expect(broken, `USER_GUIDE.md nhúng ảnh không tồn tại: ${broken.join(', ')}`).toEqual([]);
  });

  test('ảnh KHÔNG được cũ hơn generator trong lịch sử git', () => {
    /*
     * Lớp lỗi này khác vụ nhãn-viết-tắt: sửa nội dung sơ đồ trong generator rồi commit mà QUÊN chạy
     * `npm run user-guide:images` ⇒ tài liệu hiển thị bản cũ, không có dấu hiệu gì.
     */
    const genTs = lastCommitTs('scripts/utils/generate_user_guide_images.mjs');
    const imgTs = lastCommitTs('docs/user-guide-images');
    if (genTs === null || imgTs === null) { test.skip(true, 'không đọc được lịch sử git (cây không có .git)'); return; }
    expect(genTs <= imgTs,
      `generator được commit SAU bộ ảnh (generator ${new Date(genTs * 1000).toISOString().slice(0, 16)} > ảnh ${new Date(imgTs * 1000).toISOString().slice(0, 16)}) — chạy \`npm run user-guide:images\` rồi commit lại`).toBe(true);
  });
});
