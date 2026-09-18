'use strict';

/*
 * storage_to_markdown — đổi Confluence storage format sang Markdown, GIỮ BẢNG.
 *
 * VÌ SAO CÓ FILE NÀY (đo 18/09/2026). Hai fetcher đang đổi HTML sang text bằng đúng một dòng:
 *     .replace(/<[^>]+>/g, ' ')
 * và `fetch_confluence.js` còn gộp tiếp `\s+` nên CẢ TRANG thành một dòng. Hậu quả đo được trên kho
 * đã fetch: 42 file Confluence, chỉ 7 file (17%) còn dòng bảng, 62% nhỏ hơn 6 KB, trung bình 8 KB.
 *
 * Mất bảng KHÔNG phải mất định dạng. Ở tài liệu của dự án này, AC nằm trong bảng. Một trang FS fetch
 * về còn 3 KB với 6 heading và 0 dòng bảng nghĩa là agent đọc spec mà KHÔNG THẤY điều kiện chấp nhận,
 * và không có tín hiệu nào báo. Đây là lớp lỗi im lặng tệ nhất: file vẫn có nội dung, vẫn có tiêu đề,
 * đọc vào vẫn thấy hợp lý.
 *
 * Module này tách riêng để TEST ĐƯỢC KHÔNG CẦN MẠNG. Trước đó phần chuyển đổi nằm trong thân hai
 * script CLI chạy top-level, nên không có cách nào phủ test — và đó là lý do lỗi sống lâu.
 *
 * KHÔNG cố dựng một trình đổi HTML tổng quát. Chỉ xử đúng những thẻ mà Confluence storage thật sự
 * dùng, phần còn lại gỡ thẻ giữ chữ như cũ.
 */

/*
 * Bảng entity gộp từ `fetch_confluence.js` (bản cũ có sẵn dấu tiếng Việt) cộng vài entity mà
 * `fetch_confluence_children.js` xử. Gộp về MỘT bảng để hai đường fetch không lệch nhau nữa.
 */
const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '-', ndash: '-', hellip: '...', middot: '·', bull: '·',
  ldquo: '"', rdquo: '"', lsquo: "'", rsquo: "'",
  agrave: 'à', aacute: 'á', acirc: 'â', atilde: 'ã',
  egrave: 'è', eacute: 'é', ecirc: 'ê',
  igrave: 'ì', iacute: 'í',
  ograve: 'ò', oacute: 'ó', ocirc: 'ô', otilde: 'õ',
  ugrave: 'ù', uacute: 'ú', yacute: 'ý',
  Agrave: 'À', Aacute: 'Á', Acirc: 'Â', Atilde: 'Ã',
  Egrave: 'È', Eacute: 'É', Ecirc: 'Ê',
  Igrave: 'Ì', Iacute: 'Í',
  Ograve: 'Ò', Oacute: 'Ó', Ocirc: 'Ô', Otilde: 'Õ',
  Ugrave: 'Ù', Uacute: 'Ú', Yacute: 'Ý',
  /*
   * Nhóm dưới KHÔNG đoán mà đếm: quét 12 trang FS/BRD thật thì còn sót đúng 13 entity này, nhiều
   * nhất là `&rarr;` 256 lần. Chúng mang nghĩa thật — `&rarr;` là luật ánh xạ "A sang B", còn
   * `&ge; &le; &ne;` là điều kiện biên. Để nguyên dạng entity thì người đọc spec phải tự dịch.
   */
  rarr: '→', larr: '←', harr: '↔', rArr: '⇒',
  ge: '≥', le: '≤', ne: '≠', plusmn: '±', times: '×', divide: '÷', minus: '−',
  Delta: 'Δ', sect: '§',
};

/**
 * Giải entity MỘT LƯỢT. Chuỗi nhiều bước như bản cũ giải mã hai lần: `&#38;lt;` ra `&lt;` rồi bước
 * sau biến tiếp thành `<`, tức là dựng lại đúng cái thẻ mà tài liệu đang muốn hiển thị như chữ.
 */
function decodeEntities(s) {
  return String(s || '').replace(
    /&(#\d+|#[xX][0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]*);/g,
    (match, body) => {
      if (body[0] === '#') {
        const hex = body[1] === 'x' || body[1] === 'X';
        const code = hex ? parseInt(body.slice(2), 16) : Number(body.slice(1));
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
      }
      return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, body) ? NAMED_ENTITIES[body] : match;
    },
  );
}

/** Gỡ mọi thẻ còn lại, giải entity, gom khoảng trắng. Dùng cho nội dung Ô BẢNG và câu chữ. */
function inlineText(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|div|li)>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ').trim();
}

/**
 * Một ô bảng có thể chứa nhiều đoạn hoặc danh sách. Markdown không cho xuống dòng thật trong ô, nên
 * dùng `<br>` — đúng quy ước mà chính bộ testcase của repo đang dùng ở cột nhiều assertion.
 */
function cellText(html) {
  const withBreaks = String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|ul|ol|li)>/gi, '\n');
  const lines = decodeEntities(withBreaks.replace(/<[^>]+>/g, ' '))
    .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  /* `|` trong nội dung sẽ phá cấu trúc bảng markdown. Dùng entity thay vì backslash cho chắc. */
  return lines.join('<br>').replace(/\|/g, '&#124;');
}

/** Đổi MỘT thẻ <table> sang bảng markdown. Không có <th> thì lấy hàng đầu làm header. */
function tableToMarkdown(tableHtml) {
  const rows = [...String(tableHtml).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);
  if (!rows.length) return '';
  const parsed = rows.map((row) => {
    const cells = [...row.matchAll(/<(t[hd])[^>]*>([\s\S]*?)<\/\1>/gi)].map((c) => ({
      head: c[1].toLowerCase() === 'th',
      text: cellText(c[2]),
    }));
    return cells;
  }).filter((r) => r.length);
  if (!parsed.length) return '';

  const width = Math.max(...parsed.map((r) => r.length));
  const pad = (r) => [...r.map((c) => c.text), ...Array(Math.max(0, width - r.length)).fill('')];

  /*
   * Hàng đầu là header nếu nó gồm <th>, HOẶC nếu bảng không có <th> nào. Confluence hay dùng <td>
   * cho cả hàng tiêu đề, và nếu coi như không có header thì bảng markdown hỏng cú pháp.
   */
  const anyTh = parsed.some((r) => r.some((c) => c.head));
  const headerRow = pad(parsed[0]);
  const bodyRows = parsed.slice(1).map(pad);
  void anyTh;

  const out = [`| ${headerRow.join(' | ')} |`, `|${' --- |'.repeat(width)}`];
  for (const r of bodyRows) out.push(`| ${r.join(' | ')} |`);
  return out.join('\n');
}

/** Danh sách: giữ dấu đầu dòng, không gộp thành một câu dài. */
function listToMarkdown(listHtml, ordered) {
  const items = [...String(listHtml).matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => inlineText(m[1]));
  return items.filter(Boolean).map((t, i) => (ordered ? `${i + 1}. ${t}` : `- ${t}`)).join('\n');
}

/**
 * Đổi storage format sang Markdown.
 * @param {string} html body.storage.value của Confluence
 * @returns {string}
 */
function storageToMarkdown(html) {
  let s = String(html || '');

  /* Khối mã: lấy nguyên văn trong CDATA trước khi mọi luật khác đụng vào. */
  const codeBlocks = [];
  s = s.replace(/<ac:structured-macro[^>]*ac:name="code"[\s\S]*?<\/ac:structured-macro>/gi, (m) => {
    const found = m.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
    const body = found ? found[1] : inlineText(m);
    codeBlocks.push(body);
    return `\n@@CODE${codeBlocks.length - 1}@@\n`;
  });

  /* Bảng: thay bằng chỗ giữ, để các luật gỡ thẻ phía sau không phá cấu trúc vừa dựng. */
  const tables = [];
  s = s.replace(/<table[\s\S]*?<\/table>/gi, (m) => {
    const md = tableToMarkdown(m);
    if (!md) return ' ';
    tables.push(md);
    return `\n@@TABLE${tables.length - 1}@@\n`;
  });

  const lists = [];
  s = s.replace(/<(ul|ol)[^>]*>[\s\S]*?<\/\1>/gi, (m, tag) => {
    const md = listToMarkdown(m, tag.toLowerCase() === 'ol');
    if (!md) return ' ';
    lists.push(md);
    return `\n@@LIST${lists.length - 1}@@\n`;
  });

  /* Liên kết trang: giữ TIÊU ĐỀ trang, nếu không thì mất luôn dấu vết tài liệu được trỏ tới. */
  s = s.replace(/<ri:page[^>]*ri:content-title="([^"]*)"[^>]*\/?>/gi, (_, t) => ` ${t} `);

  /* Macro khác (info, note, panel, expand): gỡ vỏ, GIỮ ruột. Vứt cả macro là vứt nội dung thật. */
  s = s.replace(/<\/?ac:[^>]*>/gi, ' ').replace(/<\/?ri:[^>]*>/gi, ' ');

  for (let n = 6; n >= 1; n -= 1) {
    const re = new RegExp(`<h${n}[^>]*>([\\s\\S]*?)</h${n}>`, 'gi');
    s = s.replace(re, (_, inner) => `\n\n${'#'.repeat(n)} ${inlineText(inner)}\n\n`);
  }

  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/p>/gi, '\n\n');
  s = s.replace(/<\/(div|section|blockquote)>/gi, '\n\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);

  s = s.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trimEnd()).join('\n');
  s = s.replace(/\n{3,}/g, '\n\n').trim();

  s = s.replace(/@@TABLE(\d+)@@/g, (_, i) => `\n${tables[Number(i)]}\n`);
  s = s.replace(/@@LIST(\d+)@@/g, (_, i) => `\n${lists[Number(i)]}\n`);
  s = s.replace(/@@CODE(\d+)@@/g, (_, i) => `\n\`\`\`\n${codeBlocks[Number(i)]}\n\`\`\`\n`);

  return s.replace(/\n{3,}/g, '\n\n').trim();
}

module.exports = { storageToMarkdown, tableToMarkdown, inlineText, decodeEntities };
