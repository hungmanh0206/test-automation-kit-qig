import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { canTaiLieu } from './_trong_repo';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const audit = require('../../../scripts/qa/token_audit.js');

/*
 * @infra — H0: ĐẾM SỐ LƯỢT SHELL THEO MẪU LỆNH.
 *
 * VÌ SAO ĐẾM SỐ LƯỢT, KHÔNG ĐẾM ĐỘ DÀI OUTPUT. Chi phí một lượt chạy tỉ lệ với
 * (context mỗi message) × (số message). Mỗi lượt gọi tool là một message, và mỗi message kéo theo cả
 * context — đo được ~510k token mỗi message. Nên một lệnh in ra 5 dòng và một lệnh in ra 500 dòng tốn
 * GẦN NHƯ NHAU. Cắt độ dài output là tối ưu đúng chỗ không tốn.
 *
 * HAI LỖI ĐO ĐÃ MẮC khi dựng bảng này, cả hai làm bảng nói dịu hẳn đi, và cả hai KHÔNG tự lộ ra. Spec
 * này khoá đúng hai chỗ đó, vì một phép đo sai không báo lỗi — nó chỉ đưa ra con số nhỏ hơn sự thật.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');

test.describe('@infra token:audit — mẫu lệnh và ngưỡng một lượt', () => {
  test('LỖI ĐO ①: tiền tố env KHÔNG được thành mẫu lệnh', () => {
    /*
     * `TASK_ENV=profiles/<T>/task.env npx playwright test …` từng bị xếp vào mẫu
     * `TASK_ENV=profiles/<T>/task.env`, nên 822 lượt `playwright test` BIẾN MẤT khỏi bảng. Tệ hơn: mỗi
     * task một đường profile nên nó còn tự chia thành nhiều mẫu, và không mẫu nào đủ lớn để lọt top.
     */
    expect(audit.mauCua('TASK_ENV=profiles/CSDL-9001/task.env npx playwright test --reporter=dot'))
      .toContain('npx playwright');
    expect(audit.mauCua("$env:AUTH_TTL_MINUTES='480'; npx playwright test")).toContain('npx playwright');
    expect(audit.mauCua('export FOO=1; node scripts/qa/output_gate.js')).toContain('node');
    expect(audit.mauCua('PYTHONIOENCODING=utf-8 python x.py')).toBe('python');

    // Nhiều biến liên tiếp cũng phải bóc hết.
    expect(audit.mauCua('A=1 B=2 C=3 grep -rn x .')).toBe('grep');
  });

  test('LỖI ĐO ②: `cd <d> &&` đếm RIÊNG, không dính vào mẫu của việc thật', () => {
    /* `cd` không phải việc — nó là thuế dán vào mọi lệnh khác. Gộp nó vào mẫu thì mỗi thư mục một mẫu. */
    const m = audit.mauCua('cd /d/Project/x && grep -rn "abc" .');
    expect(m).toContain('cd &&');
    expect(m).toContain('grep');
  });

  test('cùng một việc gọi bằng nhiều kiểu cờ vẫn gom được về một mẫu thô', () => {
    /*
     * Giữ tới 3 tên cờ làm `npx playwright test` vỡ thành hàng chục mẫu, và 59,6% số lượt rơi vào ô
     * "mẫu còn lại". Tên cờ được giữ (để biết một việc đang gọi bằng bao nhiêu kiểu), nhưng GIÁ TRỊ cờ
     * thì bỏ — giữ giá trị là mỗi task một mẫu riêng, và bảng đếm thành vô dụng.
     */
    const a = audit.mauCua('npx playwright test --grep "TC_1" --reporter=dot');
    const b = audit.mauCua('npx playwright test --grep "TC_999" --reporter=dot');
    expect(a, 'hai lượt cùng việc, khác giá trị cờ ⇒ phải CÙNG mẫu').toBe(b);
    expect(a).not.toContain('TC_1');
  });

  test('npm script giữ tên script; `node -e` không nuốt cả đoạn mã', () => {
    /* Cờ được giữ theo TÊN (để biết một việc đang được gọi bằng bao nhiêu kiểu), nên `--silent` còn lại.
     * Điều phải đúng là TÊN SCRIPT không bị nuốt — bảng đếm theo script mới chỉ ra được việc nào lặp nhiều. */
    expect(audit.mauCua('npm run --silent gate:policy')).toContain('npm run gate:policy');
    const m = audit.mauCua('node -e "const x=1;console.log(x)"');
    expect(m).toBe('node -e');
    expect(m, 'mã trong -e là duy nhất mỗi lượt — giữ nó là mỗi lượt một mẫu').not.toContain('console');
  });

  test('ngưỡng một lượt nằm trong config, không ghi cứng trong code', () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/prompt_budget.json'), 'utf8'));
    const ng = cfg.nguong_mot_luot;
    expect(ng, 'thiếu ngưỡng ⇒ cảnh báo chi phí một lượt chưa được gác').toBeTruthy();
    expect(typeof ng.so_luot_shell).toBe('number');
    expect(typeof ng.context_tb_moi_message).toBe('number');
    expect(Array.isArray(ng.de_xuat) && ng.de_xuat.length, 'kêu mà không nói làm gì thì chỉ là tiếng ồn').toBeTruthy();

    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/token_audit.js'), 'utf8');
    expect(src).toContain('nguong_mot_luot');
    expect(src, 'thiếu ngưỡng thì phải KÊU, không im lặng bỏ qua').toContain('CHƯA ĐƯỢC GÁC');
  });

  test('luật canonical ở RULE_GLOBAL, và KHÔNG tốn token nạp bắt buộc', () => {
    /*
     * Luật "dùng tool chuyên dụng" vốn ĐÃ có ở tầng harness; thứ thiếu là PHÉP ĐO. Nên H0 không chép
     * thêm một bản vào `core_rules.md` — file đó auto-load mọi phiên, và thêm chữ vào đó là làm mọi
     * luồng đắt hơn đúng lúc đang đi giảm. `prompt-budget.spec.ts` giữ phần "không được tăng".
     */
    const rg = fs.readFileSync(path.join(REPO, 'RULE_GLOBAL.md'), 'utf8');
    expect(rg).toContain('Chi phí một lượt chạy');
    expect(rg, 'phải mang số đo, không nói chung chung').toMatch(/28,3%|3\.334/);

    const core = fs.readFileSync(path.join(REPO, '.agent/rules/core_rules.md'), 'utf8');
    expect(core, 'core_rules auto-load mọi phiên — không nhồi luật H0 vào đây').not.toContain('28,3%');
  });

  test('mốc H0 được ghi lại, kèm hai lỗi đo đã mắc', () => {
    canTaiLieu(REPO, 'docs/v2.4.1/H0_BASELINE.md', 'mốc H0');
    /* Không ghi lỗi đo thì lượt sau rất dễ dựng lại đúng bảng sai đó rồi tin vào nó. */
    const p = path.join(REPO, 'docs/v2.4.1/H0_BASELINE.md');
    expect(fs.existsSync(p)).toBe(true);
    const d = fs.readFileSync(p, 'utf8');
    expect(d).toContain('Hai lỗi đo đã mắc');
    expect(d, 'phải nói rõ chưa đo được cái gì').toContain('Chưa đo được');
  });

  test('`--model` quy model cho lượt subagent, và NÓI RÕ khi không phán được', () => {
    /*
     * Khai `model: haiku` trong frontmatter KHÔNG phải phép đo. Thứ duy nhất trong transcript có số
     * theo model là `cost-state`, mà nó TÍCH LUỸ cả phiên — một con số tích luỹ không quy được cho lượt
     * nào, phải lấy HIỆU giữa hai mốc ôm sát lượt cần hỏi.
     *
     * Điều quan trọng nhất ở đây là nhánh KHÔNG PHÁN ĐƯỢC. Đo 10/10/2026: mốc cuối ở dòng 21.367 còn
     * hai lượt subagent ở 29.527 và 29.564, tức không có mốc nào sau chúng. Một máy đo im lặng trả về
     * "haiku" trong tình huống đó là đúng thứ cả đợt v2.4.1 đi sửa.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/token_audit.js'), 'utf8');
    expect(src, 'phải có chế độ đo theo model').toContain('inTheoModel');
    expect(src, 'thiếu mốc thì phải nói KHÔNG PHÁN ĐƯỢC, không đoán').toContain('KHÔNG PHÁN ĐƯỢC');
    expect(src, 'phải lấy HIỆU giữa hai mốc, không đọc số tích luỹ').toContain('cost-state');

    const d = fs.readFileSync(path.join(REPO, 'docs/v2.4.1/AGENTS_VERIFY.md'), 'utf8');
    expect(d, 'biên bản phải ghi là chưa đo được, không khai đã kiểm').toContain('KHÔNG PHÁN ĐƯỢC');
    expect(d, 'phải ghi cách đo khi có điều kiện').toContain('--model');
  });


  test('`--so` TỪ CHỐI so một phiên SỬA KIT với mốc của phiên CHẠY TASK', () => {
    /*
     * Đây đúng là lỗi đã làm hỏng lần đo mốc thứ nhất: gộp phiên bảo trì kit với phiên chạy task cho ra
     * con số sai hẳn một bậc. Trừ tay giữa hai bảng số là cách dễ nhất để ra một con số "đã giảm" mà
     * không ai kiểm lại được, nên phép so phải nằm trong máy, và máy phải biết từ chối.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/token_audit.js'), 'utf8');
    expect(src, 'phải có chế độ so với mốc').toContain('soVoiMoc');
    expect(src, 'phải từ chối khi phiên không phải CHẠY TASK').toMatch(/TỪ CHỐI so|TỪ CHỐI so/);
    expect(src, 'phải từ chối khi không có mốc nào').toContain('baseline.dynamic.json');
  });

});
