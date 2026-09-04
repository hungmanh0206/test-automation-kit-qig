/*
 * _gate_env — env SẠCH cho các test spawn gate bằng fixture.
 *
 * VÌ SAO CÓ FILE NÀY (đo 04/09/2026). Cả 9 spec hạ tầng spawn gate bằng `env: { ...process.env, ...env }`,
 * nên **biến môi trường của shell lọt vào tiến trình con**. Hệ quả: test dựng fixture ghi
 * `test-results/testcase-status.json`, nhưng nếu shell có `RUN_ID` thì gate lại đi tìm
 * `test-results/runs/<RUN_ID>/testcase-status.json` ⇒ **xanh ở máy dev, ĐỎ ở CI** (CI đặt
 * `RUN_ID=ci-<pipeline>-<shard>`). `ci-regression` đã đỏ 5 lượt liên tiếp vì đúng chuyện này, trong khi
 * `npx playwright test tests/fe/infra` ở máy vẫn 481/481.
 *
 * Đây là loại lỗi tệ nhất của một bộ kiểm: **kết quả phụ thuộc môi trường chạy**, nên "xanh" không còn nghĩa.
 *
 * Cách chữa: tiến trình con **không** được thấy các biến TASK-SCOPED của môi trường. Test muốn giá trị nào thì
 * khai tường minh — khai xong vẫn thắng vì nó ghi sau.
 */

/**
 * Biến TASK-SCOPED phải bị GỠ khỏi env con.
 *
 * Đều là biến quyết định gate đọc/ghi ở ĐÂU hoặc phán thế nào — để lọt là test đo môi trường thay vì đo gate.
 * Không gỡ `PATH`/`HOME`/`APPDATA`… vì `node` con vẫn cần chạy được.
 */
export const TASK_SCOPED_ENV = [
  'RUN_ID',              // quyết định test-results/ hay test-results/runs/<RUN_ID>/
  'TASK_KEY',
  'PROJECT_OUTPUT_DIR',
  'TASK_ENV',
  'ALLOW_EMPTY',
  'QA_APPROVED',
  'TESTCASE_SOURCE',
] as const;

/** Env cho tiến trình con: kế thừa env hệ thống NHƯNG gỡ hết biến task-scoped, rồi phủ `extra` lên. */
export function gateEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const base: NodeJS.ProcessEnv = { ...process.env };
  for (const k of TASK_SCOPED_ENV) delete base[k];
  return { ...base, ...extra };
}
