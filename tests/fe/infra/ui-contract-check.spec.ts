import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * @infra — đối chiếu build với `ui_contract` (oracle FE trích từ design).
 *
 * Đây là mắt xích cuối của chuỗi FE: có contract rồi mà **không có gì tiêu thụ** thì contract là gánh nặng chứ
 * không phải oracle. Test dùng DOM giả lập + contract giả lập — cố ý KHÔNG bind contract thật vào màn thật ở lượt
 * này, vì contract `UI-ORDERDETAIL-001` mới curate 2 khối và bind sai màn sẽ sinh ra một rừng FAIL giả.
 */
const CHECKER = path.resolve(__dirname, '../../../scripts/qa/ui_conformance_check.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-dynamic-require, global-require
const { checkScreen } = require(CHECKER);

const CONTRACT_DIR = path.resolve(__dirname, '../../../knowledge/system');
const ID = 'UI-TEST-999';
const contractPath = path.join(CONTRACT_DIR, `${ID}.json`);

const HTML = `<div class="sec">
  <div class="hd"><span style="font-weight:700;font-size:16px">Amount Block</span></div>
  <div class="row"><span>Tổng tiền</span><span>1.000.000đ</span></div>
  <div class="row"><span>Thành tiền</span><span>900.000đ</span></div>
</div>`;

function writeContract(sections: any[], aliases: any = {}) {
  fs.mkdirSync(CONTRACT_DIR, { recursive: true });
  fs.writeFileSync(contractPath, JSON.stringify({
    type: 'ui_contract', id: ID, screen: 'Test', modules: ['Test'],
    source: 'fixture test — không phải design thật', confirmed_by: 'QA-Lead', confirmed_at: '2026-08-19',
    status: 'active', version: 1, extraction: 'fixture', sections, aliases, covered_by: [],
  }, null, 2));
}

test.afterAll(() => { try { fs.unlinkSync(contractPath); } catch (e) { /* đã xoá */ } });

test.describe('@infra ui_contract → đối chiếu build', () => {
  test('build thiếu nhãn mà design có ⇒ báo contract.label-missing kèm oracle_ref', async ({ page }) => {
    writeContract([{ heading: 'Amount Block', labels: ['Tổng tiền', 'Thành tiền', 'Còn phải trả'] }]);
    await page.setContent(HTML);
    const dev = await checkScreen(page, '', { name: 'T', uiContract: ID, sectionContainerSelector: '.sec' });
    const miss = dev.find((d: any) => d.type === 'contract.label-missing');
    expect(miss, 'phải phát hiện build thiếu "Còn phải trả" so với design').toBeTruthy();
    expect(miss.expected).toEqual(['Còn phải trả']);
    expect(miss.oracle_ref, 'deviation FE phải mang NEO để được phép PASS/FAIL').toBe(ID);
  });

  test('build đủ nhãn ⇒ KHÔNG báo gì (chống báo oan)', async ({ page }) => {
    writeContract([{ heading: 'Amount Block', labels: ['Tổng tiền', 'Thành tiền'] }]);
    await page.setContent(HTML);
    const dev = await checkScreen(page, '', { name: 'T', uiContract: ID, sectionContainerSelector: '.sec' });
    expect(dev.filter((d: any) => String(d.type).startsWith('contract.'))).toEqual([]);
  });

  test('tên design ≠ tên build: có alias thì khớp, không alias thì báo KHÔNG ĐỊNH VỊ ĐƯỢC', async ({ page }) => {
    writeContract([{ heading: 'Khối số tiền', labels: ['Tổng tiền', 'Thành tiền'] }]);
    await page.setContent(HTML);
    let dev = await checkScreen(page, '', { name: 'T', uiContract: ID, sectionContainerSelector: '.sec' });
    expect(dev.find((d: any) => d.type === 'contract.no-container'), 'không alias ⇒ phải nói rõ chưa đối chiếu được').toBeTruthy();

    writeContract([{ heading: 'Khối số tiền', labels: ['Tổng tiền', 'Thành tiền'] }], { 'Khối số tiền': 'Amount Block' });
    dev = await checkScreen(page, '', { name: 'T', uiContract: ID, sectionContainerSelector: '.sec' });
    expect(dev.filter((d: any) => String(d.type).startsWith('contract.')), 'có alias ⇒ khớp và im lặng').toEqual([]);
  });

  test('khai uiContract mà file không tồn tại ⇒ báo, KHÔNG im lặng coi như đã đối chiếu', async ({ page }) => {
    await page.setContent(HTML);
    const dev = await checkScreen(page, '', { name: 'T', uiContract: 'UI-KHONG-CO-999' });
    expect(dev.find((d: any) => d.type === 'contract.missing')).toBeTruthy();
  });
});
