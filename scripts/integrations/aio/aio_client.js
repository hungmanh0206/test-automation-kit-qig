'use strict';

/*
 * aio_client.js — client mỏng cho AIO Tests (test management app trong Jira).
 *
 * VÌ SAO TÁCH RIÊNG: kit vốn nói chuyện với Xray (test = Jira issue). AIO thì test là thực thể RIÊNG
 * của app, không phải issue — nên không tái dùng được xray_cloud.js. Model TestCase canonical của kit
 * (scripts/lib/testcase) vẫn dùng chung, chỉ tầng gọi API là khác.
 *
 * BẢY ĐẶC TÍNH CỦA AIO ĐÃ ĐO ĐƯỢC (đừng phát hiện lại bằng cách mất dữ liệu):
 *  1. KHÔNG có API xoá: case · attachment · run-cuối-của-case · case-khỏi-cycle · cycle-hệ-thống.
 *     Sửa sai chỉ làm được TRÊN UI → mọi script ghi phải có dry-run.
 *  2. `PUT .../detail` là GHI ĐÈ TOÀN PHẦN, không phải patch → luôn GET detail rồi merge (mergePut).
 *  3. `tags` gửi lên nhận HTTP 200 nhưng KHÔNG lưu (thử [{ID,name}], [{name}], [ID] đều vậy).
 *     → đừng dựa vào tag; TC ID để ở `automationKey`.
 *  4. `scriptType` BẮT BUỘC khi tạo case có steps (spec không đánh dấu required).
 *  5. Upload attachment PHẢI có MIME; thiếu → 400 "Unsupported attachment type".
 *  6. Có rate limit: ~200 request liên tiếp là bắt đầu trả body RỖNG (không phải mã lỗi) → retry.
 *  7. `key` (PROJ-TC-3) khác `ID` nội bộ (3) và URL của UI dùng ID → log cả hai.
 *
 * OpenAPI: https://tcms.aiojiraapps.com/aio-tcms/api/v1/openapi.json
 * Auth   : header `Authorization: AioAuth <token>` (Jira Cloud).
 */

const path = require('path');
require(path.resolve(__dirname, '..', '..', 'utils', 'runtime_config')); // nạp .env + TASK_ENV
const { MIME_BY_EXT } = require(path.resolve(__dirname, '..', '..', 'qa', 'lib', 'output_rules'));

const DEFAULT_BASE = 'https://tcms.aiojiraapps.com/aio-tcms/api/v1';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

class AioClient {
  constructor(opts = {}) {
    this.token = opts.token || process.env.AIO_API_TOKEN;
    this.project = opts.project || process.env.AIO_PROJECT_KEY || process.env.JIRA_PROJECT_KEY;
    this.base = (opts.baseUrl || process.env.AIO_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
    // Nhịp mặc định giữ dưới ngưỡng rate limit đã đo; tăng --throttle nếu gặp body rỗng.
    this.throttleMs = Number(opts.throttleMs || process.env.AIO_THROTTLE_MS || 130);
    this.retries = Number(opts.retries || 4);
    if (!this.token) throw new Error('Thiếu AIO_API_TOKEN (đặt trong .env hoặc profiles/<TASK>/task.env).');
    if (!this.project) throw new Error('Thiếu AIO_PROJECT_KEY / JIRA_PROJECT_KEY.');
  }

  get root() { return `${this.base}/project/${this.project}`; }

  /** Gọi API + retry. AIO khi quá tải trả BODY RỖNG chứ không trả 429 → coi rỗng là lỗi tạm. */
  async call(method, apiPath, body) {
    let last = { status: 0, json: null, text: '' };
    for (let i = 0; i < this.retries; i++) {
      try {
        const res = await fetch(this.root + apiPath, {
          method,
          headers: { Authorization: `AioAuth ${this.token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
        });
        const text = await res.text();
        // 429 = rate limit CÓ mã (khác lúc quá tải thì trả body rỗng) → cả hai đều là lỗi tạm.
        if (res.status === 429) { await wait(3000 * (i + 1)); continue; }
        if (text || res.status === 204) {
          let json = null;
          try { json = JSON.parse(text); } catch (e) { /* không phải JSON */ }
          return { status: res.status, json, text };
        }
        last = { status: res.status, json: null, text: '' };
      } catch (e) { last = { status: 0, json: null, text: e.message }; }
      await wait(1500 * (i + 1));
    }
    return last;
  }

  /** GET có phân trang (endpoint AIO trả {items, isLast}). */
  async list(apiPath, pageSize = 100) {
    const out = [];
    for (let startAt = 0; ; startAt += pageSize) {
      const sep = apiPath.includes('?') ? '&' : '?';
      const r = await this.call('GET', `${apiPath}${sep}startAt=${startAt}&maxResults=${pageSize}`);
      const page = r.json || {};
      out.push(...(page.items || []));
      if (page.isLast !== false) break;
      await wait(this.throttleMs);
    }
    return out;
  }

  /**
   * PUT an toàn: đọc detail hiện tại rồi merge. AIO ghi đè toàn phần — gửi payload thiếu field là
   * XOÁ field đó (đã mất link Jira của 1 case theo đúng cách này).
   */
  async mergePut(detailPath, patch) {
    const cur = (await this.call('GET', detailPath)).json;
    if (!cur) return { status: 0, json: null, text: `không đọc được ${detailPath}` };
    return this.call('PUT', detailPath, { ...cur, ...patch });
  }

  /** Upload file. MIME lấy từ MIME_BY_EXT của kit (1 nguồn, dùng chung với uploader Jira). */
  async upload(apiPath, filename, buffer) {
    const mime = MIME_BY_EXT[path.extname(filename).toLowerCase()];
    if (!mime) return { status: 415, text: `không có MIME cho "${filename}" — AIO sẽ từ chối` };
    for (let i = 0; i < this.retries; i++) {
      try {
        const fd = new globalThis.FormData();
        fd.append('file', new globalThis.Blob([buffer], { type: mime }), filename);
        const res = await fetch(this.root + apiPath, { method: 'POST', headers: { Authorization: `AioAuth ${this.token}` }, body: fd });
        if (res.status === 429) { await wait(3000 * (i + 1)); continue; }
        const text = await res.text();
        if (text) return { status: res.status, text };
      } catch (e) { /* thử lại */ }
      await wait(1500 * (i + 1));
    }
    return { status: 0, text: 'upload thất bại sau khi retry' };
  }

  /** Tạo (hoặc lấy) đường dẫn thư mục. `kind` = 'testcase' | 'testcycle'. */
  async ensureFolder(kind, segments) {
    const r = await this.call('PUT', `/${kind}/folder/hierarchy`, { baseFolderId: null, folderHierarchy: segments });
    return r.json && r.json.ID ? r.json.ID : null;
  }

  /**
   * Map ĐƯỜNG DẪN → ID (vd "SAPP-14443/API"). KHÔNG khoá theo tên trần: nhiều bộ testcase có folder
   * trùng tên ("API", "Sửa"…) nên khoá theo tên thì bộ publish sau ghi đè bộ trước và case rơi nhầm
   * cây — đã xảy ra thật: 6 case của task này nằm trong folder API của task kia.
   */
  async folderMap(kind) {
    const tree = (await this.call('GET', `/${kind}/folder`)).json || [];
    const map = {};
    (function flat(nodes, prefix) {
      (Array.isArray(nodes) ? nodes : [nodes]).forEach((n) => {
        if (!n) return;
        const p = prefix ? `${prefix}/${n.name}` : n.name;
        map[p] = n.ID;
        if (n.children) flat(n.children, p);
      });
    })(tree, '');
    return map;
  }
  async config(name) { return (await this.call('GET', `/config/${name}`)).json || []; }
  pause() { return wait(this.throttleMs); }
}

module.exports = { AioClient, DEFAULT_BASE };
