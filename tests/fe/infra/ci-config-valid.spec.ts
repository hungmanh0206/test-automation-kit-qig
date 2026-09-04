import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/*
 * File cấu hình CI phải PARSE ĐƯỢC — và không được chứa ký tự điều khiển.
 *
 * VÌ SAO CÓ FILE NÀY (đo 04/09/2026). `.gitlab-ci.yml` chứa **một** byte `0x01` ở dòng 153: chỗ đó lẽ ra là
 * `\1` (backreference của `sed`) nhưng escape bị ăn thành ký tự điều khiển. Hậu quả không phải "một job đỏ"
 * mà là **GitLab không tạo nổi pipeline**: `yaml invalid — control characters are not allowed`, **0 jobs**.
 * Nó im lặng suốt **5 commit** (từ `a9fc96b`), và đọc trên UI thì y như "CI đỏ" nên rất dễ đi sửa code oan —
 * tôi đã chạy trọn 12 bước của job `static-check` trên `node:20` + `npm ci` sạch và thấy XANH HẾT, trong khi
 * pipeline thật chưa từng chạy một bước nào.
 *
 * Hai lỗ hổng đã bịt:
 *   ① Gate ký-tự-lạ cũ chỉ quét 0x08/0x0B/0x0C/0x1B và không quét `.yml` ⇒ `0x01` trong CI config lọt.
 *   ② KHÔNG máy nào parse file CI. Cấu hình CI hỏng nghĩa là **không phép kiểm nào chạy** — đúng loại
 *      "im lặng là hỏng" tệ nhất, vì mọi gate khác vẫn xanh ở máy.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');

/** Mọi file cấu hình CI đang có. Thiếu file thì bỏ qua — repo có thể chỉ dùng một trong hai nền. */
const ciFiles = (): string[] => {
  const out: string[] = [];
  const gl = path.join(REPO, '.gitlab-ci.yml');
  if (fs.existsSync(gl)) out.push(gl);
  const wf = path.join(REPO, '.github', 'workflows');
  if (fs.existsSync(wf)) {
    for (const f of fs.readdirSync(wf)) if (/\.ya?ml$/i.test(f)) out.push(path.join(wf, f));
  }
  return out;
};

const rel = (p: string) => path.relative(REPO, p).split(path.sep).join('/');

test.describe('@infra cấu hình CI — hỏng là KHÔNG phép kiểm nào chạy', () => {
  test('có ít nhất một file cấu hình CI', () => {
    expect(ciFiles().length, 'không thấy .gitlab-ci.yml lẫn .github/workflows/*.yml').toBeGreaterThan(0);
  });

  test('KHÔNG file CI nào chứa ký tự điều khiển (C0 trừ tab/LF/CR)', () => {
    /*
     * Quét TOÀN BỘ dải C0, không phải một danh sách chọn lọc: gate cũ liệt 0x08/0x0B/0x0C/0x1B nên `0x01`
     * đi qua. Danh sách chọn lọc luôn thiếu đúng ký tự lần sau.
     */
    const bad: string[] = [];
    for (const f of ciFiles()) {
      const b = fs.readFileSync(f);
      for (let i = 0; i < b.length; i += 1) {
        const c = b[i];
        if (c < 0x09 || (c > 0x0d && c < 0x20)) {
          let line = 1;
          let col = 1;
          for (let k = 0; k < i; k += 1) { if (b[k] === 0x0a) { line += 1; col = 1; } else col += 1; }
          bad.push(`${rel(f)} — 0x${c.toString(16).padStart(2, '0')} tại dòng ${line} cột ${col}`);
        }
      }
    }
    expect(bad, `ký tự điều khiển trong cấu hình CI ⇒ pipeline KHÔNG TẠO ĐƯỢC (0 jobs):\n  - ${bad.join('\n  - ')}`).toEqual([]);
  });

  test('cấu trúc YAML đọc được: thụt lề bằng SPACE, không TAB, có khối gốc', () => {
    /*
     * Không có parser YAML trong deps (cố ý — không thêm dependency chỉ để test). Nên kiểm những lỗi
     * KHIẾN PIPELINE KHÔNG TẠO ĐƯỢC mà đọc bằng dòng là đủ chắc: tab thụt lề (YAML cấm), và file phải có
     * ít nhất một khoá cấp gốc. Phần ngữ nghĩa (job/stage) do GitLab/GitHub tự kiểm khi nhận file.
     */
    for (const f of ciFiles()) {
      const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
      const tabbed = lines.map((l, i) => ({ l, i })).filter((x) => /^\t| \t/.test(x.l));
      expect(tabbed.map((x) => `${rel(f)}:${x.i + 1}`), 'YAML CẤM tab thụt lề').toEqual([]);
      const rootKeys = lines.filter((l) => /^[A-Za-z_][\w-]*:/.test(l));
      expect(rootKeys.length, `${rel(f)}: không có khoá cấp gốc nào ⇒ file rỗng/hỏng`).toBeGreaterThan(0);
    }
  });

  test('`.gitlab-ci.yml` khai stages và job static-check (điểm chặn trên mọi push)', () => {
    const f = path.join(REPO, '.gitlab-ci.yml');
    if (!fs.existsSync(f)) return;
    const body = fs.readFileSync(f, 'utf8');
    expect(body).toMatch(/^stages:/m);
    expect(body, 'mất job static-check thì push không còn cửa chặn nào').toMatch(/^static-check:/m);
  });

  test('mọi lệnh `sed`/`awk` trong file CI phải còn nguyên backslash (chỗ escape hay bị ăn)', () => {
    /*
     * Chính chỗ đã hỏng: một backreference trong lệnh `sed` của job detection-proof. (Cố ý KHÔNG dán lại
     * nguyên mẫu lệnh đó vào đây: chuỗi sed chứa dấu sao-gạch-chéo, dán vào block comment là ĐÓNG comment
     * giữa dòng và cả file hỏng cú pháp — tôi vừa dính đúng lần này.)
     * Một backreference biến thành ký tự điều khiển là cả pipeline chết. Luật hẹp: dòng có `sed`/`awk`
     * mà chứa nhóm bắt thì phải còn ít nhất một backslash — nhóm bắt trong sed BRE luôn cần nó.
     */
    const suspects: string[] = [];
    for (const f of ciFiles()) {
      fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l, i) => {
        if (!/\b(sed|awk)\b/.test(l)) return;
        if (!/[()]/.test(l)) return;
        if (!l.includes('\\')) suspects.push(`${rel(f)}:${i + 1} — ${l.trim().slice(0, 80)}`);
      });
    }
    expect(suspects, `lệnh sed/awk có nhóm bắt mà KHÔNG còn backslash — dấu hiệu escape đã bị ăn:\n  - ${suspects.join('\n  - ')}`).toEqual([]);
  });

  test('lệnh shell trong script phải TRÍCH DẪN nếu chứa dấu hai chấm + khoảng trắng', () => {
    /*
     * Lỗi thứ HAI của cùng file này (04/09, sau khi vá 0x01): một dòng script dạng
     * "- echo ... artifact-only: knowledge/ ... dai han: npm run knowledge:backup" KHÔNG trích dẫn. YAML gặp
     * dấu hai chấm + khoảng trắng trong plain scalar thì hiểu là MAPPING ⇒ "mapping values are not allowed
     * in this context" ⇒ lại 0 jobs. Gate lượt trước của tôi không bắt được vì nó chỉ soi ký tự điều
     * khiển/tab/khoá gốc — KHÔNG đọc cấu trúc.
     *
     * Luật hẹp và chính xác: một item của sequence chỉ vỡ khi (a) nó KHÔNG phải mapping dạng key-hai-chấm,
     * và (b) phần TRƯỚC comment YAML còn chứa dấu hai chấm + khoảng trắng. Nhờ (a) mà các item "if:" / "job:"
     * trong khối rules không bị báo oan; nhờ (b) mà comment cuối dòng không bị tính.
     */
    const bad: string[] = [];
    for (const f of ciFiles()) {
      fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l, i) => {
        const m = l.match(/^(\s*)- (.*)$/);
        if (!m) return;
        const item = m[2].trim();
        if (/^['"|>&*]/.test(item)) return;                    // đã trích dẫn / block scalar / anchor
        if (/^[A-Za-z_][\w.-]*:(\s|$)/.test(item)) return;     // là mapping (if: · job: · when: …)
        const beforeComment = item.split(' #')[0];
        if (/: /.test(beforeComment)) bad.push(`${rel(f)}:${i + 1} — ${item.slice(0, 80)}`);
      });
    }
    expect(bad, `plain scalar chứa dấu hai chấm + khoảng trắng ⇒ YAML hiểu là mapping ⇒ pipeline KHÔNG TẠO ĐƯỢC:\n  - ${bad.join('\n  - ')}`).toEqual([]);
  });

  test('GIÁ TRỊ CỦA MAPPING cũng phải trích dẫn nếu chứa dấu hai chấm + khoảng trắng', () => {
    /*
     * LỖ HỔNG CỦA CHÍNH GATE NÀY, phát hiện 04/09 ngay khi tôi viết `release.yml`: luật ở test trên chỉ soi
     * item dạng "- <lệnh>". Nhưng `run: echo "… Muốn phát hành: tag v<version>"` là **giá trị của mapping**,
     * và YAML vỡ y như vậy. Parser thật (PyYAML) báo lỗi ở đúng dòng đó trong khi gate của tôi im lặng.
     *
     * Nói thẳng bài học: gate viết theo MỘT hình dạng đã gặp thì chỉ bắt được hình dạng đó. Ở đây hình dạng
     * thứ hai xuất hiện chỉ vài phút sau hình dạng thứ nhất.
     */
    const bad: string[] = [];
    for (const f of ciFiles()) {
      fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l, i) => {
        const m = l.match(/^\s*([A-Za-z_][\w.-]*): (.+)$/);
        if (!m) return;
        const v = m[2].trim();
        if (/^['"|>&*[{]/.test(v)) return;              // đã trích dẫn / block scalar / anchor / flow
        const beforeComment = v.split(' #')[0];
        if (/: /.test(beforeComment)) bad.push(`${rel(f)}:${i + 1} — ${m[1]}: ${v.slice(0, 70)}`);
      });
    }
    expect(bad, `giá trị mapping chứa dấu hai chấm + khoảng trắng mà không trích dẫn:\n  - ${bad.join('\n  - ')}`).toEqual([]);
  });

  test('mọi job phải khai stage, và stage đó phải có trong stages', () => {
    /*
     * Kiểm CẤU TRÚC, không chỉ cú pháp: file parse được mà job trỏ vào stage không tồn tại thì GitLab vẫn
     * từ chối tạo pipeline. Đọc bằng dòng (không thêm dependency chỉ để test) — đủ chắc cho khuôn file này.
     */
    const f = path.join(REPO, '.gitlab-ci.yml');
    if (!fs.existsSync(f)) return;
    const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
    const iStages = lines.findIndex((l) => /^stages:/.test(l));
    const stages: string[] = [];
    for (let i = iStages + 1; i < lines.length && /^\s+- /.test(lines[i]); i += 1) {
      stages.push(lines[i].replace(/^\s+- /, '').trim());
    }
    expect(stages.length, 'không đọc được danh sách stages').toBeGreaterThan(0);

    const jobs: Record<string, string | null> = {};
    let cur: string | null = null;
    for (const l of lines) {
      const j = l.match(/^([a-z][a-z0-9_-]*):\s*$/);
      if (j) { cur = j[1] === 'stages' ? null : j[1]; if (cur) jobs[cur] = null; continue; }
      const st = l.match(/^\s+stage:\s*(\S+)/);
      if (st && cur) jobs[cur] = st[1];
    }
    expect(Object.keys(jobs).length, 'không đọc được job nào').toBeGreaterThan(0);
    for (const [job, st] of Object.entries(jobs)) {
      expect(st, `job "${job}" không khai stage`).toBeTruthy();
      expect(stages, `job "${job}" khai stage "${st}" không có trong stages [${stages.join(', ')}]`).toContain(st);
    }
  });
});
