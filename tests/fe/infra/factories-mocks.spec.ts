import { test, expect } from '@playwright/test';
import { createRecord } from '../../support/setup/factories/domainFactory';
import { createUser, setUserActionCount } from '../../support/setup/factories/userFactory';
import { createAuthSession } from '../../support/setup/factories/authFactory';
import { mockExternalDependency } from '../../support/setup/mocks/externalDependencyMock';
import { cleanupRegistry } from '../../support/setup/cleanup/cleanupRegistry';
import { SetupFailure } from '../../support/setup/contracts/preconditionTypes';

/*
 * @infra — FACTORIES + MOCKS, hai thư mục duy nhất trong `tests/support/setup/` chưa có self-test
 * (fixtures · cleanup · db · contracts · hooks đều có). Đây là nơi DỰNG dữ liệu test: sai ở đây thì mọi
 * test dùng nó sai một cách IM LẶNG — precondition trông như đã có, assertion chạy trên state khác.
 *
 * Ba chế độ hỏng được khoá, đều là chế độ "sai mà không ai biết":
 *   ① lỗi setup bị ném thành lỗi thường ⇒ verdict thành FAIL (product bug) thay vì `setup_failure`
 *      ⇒ đi log Jira oan. Factory PHẢI ném `SetupFailure`.
 *   ② tạo bản ghi mà KHÔNG đăng ký cleanup ⇒ rác tích trên UAT sau mỗi run (orphan).
 *   ③ mock lỗi ngoài mà bắt sai URL / không đủ chế độ ⇒ test "resilience" chạy trên đường sạch, xanh vô nghĩa.
 */

/** APIRequestContext giả — chỉ cần `post/get/patch` như factory dùng, không cần mạng. */
const fakeCtx = (impl: Partial<Record<'post' | 'get' | 'patch' | 'delete', (u: string, o?: unknown) => unknown>>) => ({
  post: impl.post || (() => { throw new Error('post không được gọi'); }),
  get: impl.get || (() => { throw new Error('get không được gọi'); }),
  patch: impl.patch || (() => { throw new Error('patch không được gọi'); }),
  delete: impl.delete || (() => { throw new Error('delete không được gọi'); }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any;

const okRes = (body: unknown, status = 200) => ({ ok: () => status < 400, status: () => status, json: async () => body, text: async () => JSON.stringify(body) });
const failRes = (status: number, body = 'boom') => ({ ok: () => false, status: () => status, json: async () => ({}), text: async () => body });

test.describe('@infra factories — lỗi setup phải là setup_failure, không phải "bug"', () => {
  test('createRecord: API trả 500 ⇒ ném SetupFailure (không phải Error thường)', async () => {
    const ctx = fakeCtx({ post: () => failRes(500) });
    const err = await createRecord(ctx, { name: 'IT test record' }, { resourcePath: '/api/v1/x', preconditionId: 'PRE-01' })
      .then(() => null, (e: unknown) => e);
    expect(err, 'phải ném').not.toBeNull();
    expect(err instanceof SetupFailure, `ném ${(err as Error)?.constructor?.name} ⇒ verdict sẽ thành FAIL product bug, log Jira oan`).toBe(true);
    expect(String((err as Error).message)).toContain('500');
  });

  test('createRecord: thành công ⇒ ĐĂNG KÝ cleanup ĐÚNG runId (chống rác trên UAT)', async () => {
    // `size(runId)` lọc theo runId (resolveRunId), nên phải đếm đúng scope vừa đăng ký — đếm scope mặc
    // định thì luôn ra 0 và test sẽ "đỏ oan" trong khi factory làm đúng.
    const ctx = fakeCtx({ post: () => okRes({ id: 'rec-1' }) });
    const RUN = 'RUN-SELFTEST-1';
    const before = cleanupRegistry.size(RUN);
    const rec = await createRecord(ctx, { name: 'IT test record' }, { resourcePath: '/api/v1/x', runId: RUN });
    expect(rec.id).toBe('rec-1');
    expect(cleanupRegistry.size(RUN) - before, 'tạo mà không đăng ký cleanup = orphan sau mỗi run').toBe(1);
    // Rác không được rơi vào scope của run khác.
    expect(cleanupRegistry.size('RUN-KHAC')).toBe(0);
  });

  test('createUser: 4xx ⇒ SetupFailure kèm preconditionId để biết precondition nào vỡ', async () => {
    const ctx = fakeCtx({ post: () => failRes(422, 'email exists') });
    const err = await createUser(ctx, { email: 'it-test@example.com' } as never, { preconditionId: 'PRE-07' })
      .then(() => null, (e: unknown) => e);
    expect(err instanceof SetupFailure).toBe(true);
    expect((err as SetupFailure & { preconditionId?: string }).preconditionId ?? JSON.stringify(err), 'thiếu id thì không biết sửa setup nào').toBeTruthy();
  });

  test('setUserActionCount: dựng state qua TEST HOOK, chưa có hook ⇒ SetupFailure (không âm thầm bỏ qua)', async () => {
    // Setup Strategy = `test_hook`: state_mutation phải đi qua hook của app, KHÔNG qua DB (CLAUDE.md §2).
    // Chưa có hook thật ⇒ phải ném SetupFailure để Phase 2 đánh `Needs hook`, chứ không được resolve êm
    // rồi để assertion chạy trên state chưa dựng.
    const err = await setUserActionCount('user-1', 3, { preconditionId: 'PRE-09' }).then(() => null, (e: unknown) => e);
    expect(err, 'resolve êm trong khi state chưa dựng = PASS giả').not.toBeNull();
    expect(err instanceof SetupFailure || /hook/i.test(String((err as Error).message)), String((err as Error).message)).toBe(true);
  });

  test('createAuthSession: THIẾU env creds ⇒ SetupFailure nêu rõ biến nào, không trả session rỗng', async () => {
    // Factory đọc creds từ ENV (không hardcode — luật bảo mật). Thiếu biến thì phải ném ngay ở tầng setup:
    // session rỗng lọt xuống test thì mọi assertion sau đó vô nghĩa mà vẫn có thể XANH.
    const saved = { b: process.env.API_BASE_URL, u: process.env.API_USERNAME, p: process.env.API_PASSWORD };
    delete process.env.API_BASE_URL; delete process.env.API_USERNAME; delete process.env.API_PASSWORD;
    try {
      const err = await createAuthSession({ preconditionId: 'PRE-02' }).then(() => null, (e: unknown) => e);
      expect(err, 'thiếu creds mà vẫn resolve = PASS giả').not.toBeNull();
      expect(err instanceof SetupFailure, `ném ${(err as Error)?.constructor?.name}`).toBe(true);
      expect(String((err as Error).message), 'phải nói THIẾU BIẾN NÀO để sửa được').toMatch(/API_BASE_URL|API_USERNAME|API_PASSWORD/);
    } finally {
      if (saved.b) process.env.API_BASE_URL = saved.b;
      if (saved.u) process.env.API_USERNAME = saved.u;
      if (saved.p) process.env.API_PASSWORD = saved.p;
    }
  });
});

test.describe('@infra mocks — mock lỗi ngoài phải CHẶN đúng đường, đủ chế độ', () => {
  test('3 chế độ status/timeout/abort đều dựng được (thiếu chế độ = thiếu lớp resilience)', async ({ page }) => {
    for (const fault of ['status', 'timeout', 'abort'] as const) {
      await expect(
        mockExternalDependency(page, { urlPattern: '**/api/v1/external/**', fault, status: 503, delayMs: 5 }),
        `chế độ ${fault} phải dựng được`,
      ).resolves.toBeUndefined();
    }
  });

  test('mock CHỈ chặn URL khớp pattern — request khác vẫn đi bình thường', async ({ page }) => {
    /*
     * Cần một ORIGIN thật để `fetch('/api/...')` phân giải được — `data:` URL không có origin nên mọi
     * fetch tương đối đều fail và test sẽ "đỏ oan" trong khi mock làm đúng. Dựng origin bằng cách
     * intercept luôn cả điều hướng, không cần server.
     * Playwright khớp route theo THỨ TỰ ĐĂNG KÝ ⇒ đăng ký mock TRƯỚC, và không dùng pattern catch-all.
     */
    await mockExternalDependency(page, { urlPattern: '**/api/v1/external/**', fault: 'status', status: 503 });
    await page.route('**/api/v1/orders', (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: 'real' }));
    await page.route('**/probe', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<body>probe</body>' }));
    await page.goto('http://localhost/probe');

    const status = (u: string) => page.evaluate(async (url) => {
      const r = await fetch(url).catch(() => null);
      return r ? r.status : 0;
    }, u);

    expect(await status('/api/v1/external/pay'), 'URL khớp pattern phải bị mock chặn').toBe(503);
    expect(await status('/api/v1/orders'), 'mock quá rộng ⇒ chặn cả request không liên quan, test hoá vô nghĩa').toBe(200);
  });
});
