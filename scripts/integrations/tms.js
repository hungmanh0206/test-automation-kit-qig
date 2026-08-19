'use strict';

/*
 * tms.js — MỘT nguồn quyết định "kit đang dùng test-management tool nào".
 *
 * Vì sao là máy chặn chứ không phải câu dặn trong prompt:
 *   Giai đoạn chuyển Xray → AIO có 2 bộ script song song, đầu vào GIỐNG NHAU (cùng Excel canonical,
 *   cùng `testcase-status.json`). Chạy nhầm bộ KHÔNG báo lỗi — nó chạy trót lọt và ghi vào sai hệ thống.
 *   Nguy hơn nữa: `TEST_MANAGEMENT_TOOL=aio` mà gọi publisher Xray thì `normalizeTool()` rơi về nhánh
 *   Jira thường, tạo ra issue "Test Case" trong Jira — không phải AIO case, cũng không phải Xray Test.
 *   Sai kiểu đó chỉ lộ ra khi có người mở Jira lên nhìn, và AIO thì KHÔNG có API xoá để lùi.
 *
 * Nên: cửa vào của mỗi script tự kiểm, sai tool thì CHẶN kèm đúng lệnh thay thế.
 */

const TOOLS = ['xray', 'aio', 'jira'];

/** Tool đang bật. Ưu tiên --test-management-tool > TEST_MANAGEMENT_TOOL > JIRA_TEST_MANAGEMENT_TOOL. */
function activeTool(argv = process.argv) {
  const i = argv.indexOf('--test-management-tool');
  // MẶC ĐỊNH LÀ 'aio' (GĐ5): Xray đóng băng sau 21/08/2026 nên không được là đường đi ngầm định nữa.
  const raw = (i >= 0 && argv[i + 1]) || process.env.TEST_MANAGEMENT_TOOL || process.env.JIRA_TEST_MANAGEMENT_TOOL || 'aio';
  const v = String(raw).trim().toLowerCase();
  if (v === 'xrays') return 'xray';
  if (v === 'aio-tests' || v === 'aiotests') return 'aio';
  return TOOLS.includes(v) ? v : 'jira';
}

/**
 * Chặn khi script thuộc tool A mà kit đang bật tool B.
 * `altCommand` bắt buộc: chặn mà không chỉ đường đi tiếp thì chỉ là bức tường.
 */
function assertTool(expected, altCommand, { allow = [] } = {}) {
  const active = activeTool();
  if (active === expected || allow.includes(active)) return active;
  console.error(`CHẶN: TEST_MANAGEMENT_TOOL=${active} nhưng script này thuộc ${expected.toUpperCase()}.`);
  console.error(`→ Dùng: ${altCommand}`);
  console.error(`  (cố ý chạy bản ${expected.toUpperCase()}: thêm --test-management-tool ${expected})`);
  process.exit(1);
}

module.exports = { TOOLS, activeTool, assertTool };
