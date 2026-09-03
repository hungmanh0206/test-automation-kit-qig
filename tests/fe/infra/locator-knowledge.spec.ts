import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/*
 * Máy kiểm store `knowledge/locators/*.json`.
 *
 * Vì sao cần: skill `ui_debug_agent` yêu cầu ghi vào store này — đó là thứ chống "sprint sau dò lại đúng
 * màn đó". Nhưng store hiện có ĐÚNG MỘT file; không chốt schema thì mỗi lượt ghi một kiểu và 5 file nữa là
 * không query được, tức đúng cái nó ra đời để chống.
 *
 * Schema KHÔNG thiết kế mới: `.agent/config/locators.schema.json` chép hình dạng của file đã dùng được.
 *
 * `knowledge/**` bị gitignore (dữ liệu công ty) ⇒ máy khác clone về store rỗng. Store rỗng là chuyện BÌNH
 * THƯỜNG, không phải lỗi — nên test này chỉ kiểm những file THỰC SỰ có, và không đòi số lượng tối thiểu.
 * (Schema thì luôn phải có: nó được commit.)
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const SCHEMA_PATH = path.join(REPO, '.agent/config/locators.schema.json');
const STORE = path.join(REPO, 'knowledge/locators');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const SCHEMA = require(SCHEMA_PATH);
const files = fs.existsSync(STORE) ? fs.readdirSync(STORE).filter((f) => f.endsWith('.json')) : [];

test.describe('@infra knowledge/locators — schema phải chốt, không mỗi lượt một kiểu', () => {
  test('schema tồn tại và tự nó đầy đủ', () => {
    expect(fs.existsSync(SCHEMA_PATH), 'thiếu .agent/config/locators.schema.json').toBe(true);
    for (const k of ['_why', '_enforced_by', '_naming', 'required', 'optional', 'fields', 'statusEnum', 'minLength']) {
      expect(SCHEMA[k], `schema thiếu khối "${k}"`).toBeTruthy();
    }
    // Mọi field trong required/optional phải được GIẢI THÍCH — schema không giải thích thì người ghi vẫn đoán.
    for (const f of [...SCHEMA.required, ...SCHEMA.optional]) {
      expect(SCHEMA.fields[f], `field "${f}" khai mà không giải thích ở khối \`fields\``).toBeTruthy();
    }
    // Và ngược lại: không được giải thích một field không tồn tại trong hai danh sách kia.
    const declared = new Set([...SCHEMA.required, ...SCHEMA.optional]);
    for (const f of Object.keys(SCHEMA.fields)) {
      expect(declared.has(f), `field "${f}" được giải thích nhưng không có trong required/optional`).toBe(true);
    }
  });

  test('mỗi file trong store đúng schema (bỏ qua nếu store rỗng — knowledge/** không commit)', () => {
    if (!files.length) {
      test.skip(true, 'store rỗng — bình thường trên máy mới clone');
      return;
    }
    const problems: string[] = [];
    for (const f of files) {
      let j: Record<string, unknown>;
      try { j = JSON.parse(fs.readFileSync(path.join(STORE, f), 'utf8')); } catch (e) { problems.push(`${f}: không parse được`); continue; }

      for (const k of SCHEMA.required) {
        const v = j[k];
        const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
        if (empty) problems.push(`${f}: thiếu/rỗng field bắt buộc "${k}"`);
      }
      const known = new Set([...SCHEMA.required, ...SCHEMA.optional]);
      for (const k of Object.keys(j)) {
        if (!k.startsWith('_') && !known.has(k)) problems.push(`${f}: field lạ "${k}" (chưa khai trong schema)`);
      }
      if (j.status !== undefined && !SCHEMA.statusEnum.includes(j.status)) {
        problems.push(`${f}: status "${String(j.status)}" không thuộc ${SCHEMA.statusEnum.join('|')}`);
      }
      if (j.version !== undefined && !(Number.isInteger(j.version) && (j.version as number) >= 1)) {
        problems.push(`${f}: version phải là số nguyên ≥ 1`);
      }
      // Chống "điền cho có": ô có mặt nhưng một từ thì lần sau đọc lại vô dụng.
      for (const [k, min] of Object.entries(SCHEMA.minLength as Record<string, number>)) {
        if (k.startsWith('_')) continue;
        const v = j[k];
        if (typeof v === 'string' && v.length < min) problems.push(`${f}: "${k}" chỉ ${v.length} ký tự (cần ≥ ${min}) — điền cho có thì lần sau vô dụng`);
      }
      if (j.confirmed_at !== undefined && String(j.confirmed_at) && !/^\d{4}-\d{2}-\d{2}$/.test(String(j.confirmed_at))) {
        problems.push(`${f}: confirmed_at phải dạng YYYY-MM-DD`);
      }
      // `draft` = chưa ai xác nhận. `active` thì phải có người xác nhận, không thì nó là ý kiến của máy.
      if (j.status === 'active' && !String(j.confirmed_by || '').trim()) {
        problems.push(`${f}: status active mà không có confirmed_by — chưa ai xác nhận thì để status: draft`);
      }
      if (!/^[a-z0-9-]+__[a-z0-9-]+\.json$/.test(f)) {
        problems.push(`${f}: tên file phải dạng <màn>__<quirk>.json (kebab-case)`);
      }
    }
    expect(problems, `\n  - ${problems.join('\n  - ')}`).toEqual([]);
  });

  test('skill ui_debug_agent phải trỏ tới schema (nếu không thì người ghi vẫn đoán)', () => {
    const skill = fs.readFileSync(path.join(REPO, '.agent/skills/phase2/ui_debug_agent/SKILL.md'), 'utf8');
    expect(skill, 'skill yêu cầu ghi vào store mà không nói schema ở đâu')
      .toContain('.agent/config/locators.schema.json');
  });
});
