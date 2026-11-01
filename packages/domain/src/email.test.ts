import { describe, expect, it } from 'vitest';
import {
  buildEmail,
  emailCategory,
  emailKinds,
  escapeHtml,
  formatFrom,
  isDeliverableEmail,
  safeLink,
} from './email';

describe('mẫu email', () => {
  it('mọi loại × vi/en đều dựng được tiêu đề, HTML và bản text không rỗng', () => {
    for (const locale of ['vi', 'en'] as const)
      for (const kind of emailKinds) {
        const e = buildEmail(kind, locale, {
          academyName: 'CLB Dương Sinh',
          inviterName: 'Thầy Sinh',
          studentName: 'An',
          title: 'Tiêu đề',
          body: 'Nội dung',
          link: 'https://app.clb.vn/x',
        });
        expect(e.subject.length, `${kind}/${locale}`).toBeGreaterThan(0);
        expect(e.html).toContain('CLB Dương Sinh');
        expect(e.text.length).toBeGreaterThan(10);
      }
  });

  it('lời mời có nút link; tiếng Việt và tiếng Anh khác nhau', () => {
    const d = { academyName: 'CLB', inviterName: 'Sinh', link: 'https://a.vn/invite/t' };
    const vi = buildEmail('invite_coach', 'vi', d);
    const en = buildEmail('invite_coach', 'en', d);
    expect(vi.html).toContain('href="https://a.vn/invite/t"');
    expect(vi.html).toContain('Chấp nhận lời mời');
    expect(en.html).toContain('Accept invitation');
    expect(vi.text).toContain('https://a.vn/invite/t');
    expect(vi.subject).not.toBe(en.subject);
  });

  it('thoát HTML mọi giá trị người dùng (không chèn được thẻ/thuộc tính)', () => {
    const e = buildEmail('quiz_assigned', 'vi', {
      academyName: '<img src=x onerror=alert(1)>',
      title: '"><script>alert(1)</script>',
      body: "a & b <b>c</b> 'd'",
    });
    expect(e.html).not.toContain('<script>');
    expect(e.html).not.toContain('<img');
    expect(e.html).toContain('&lt;script&gt;');
    expect(e.html).toContain('a &amp; b &lt;b&gt;c&lt;/b&gt; &#39;d&#39;');
  });

  it('link không phải http(s) bị bỏ: không có nút', () => {
    for (const link of ['javascript:alert(1)', 'data:text/html,x', '/a/clb', 'ftp://x']) {
      const e = buildEmail('invoice_reminder', 'vi', {
        academyName: 'CLB',
        title: 'T',
        body: 'B',
        link,
      });
      expect(e.html, link).not.toContain('<a ');
      expect(e.text).not.toContain(link);
    }
    expect(safeLink('https://ok.vn/a?b=1')).toBe('https://ok.vn/a?b=1');
    expect(safeLink('https://x.vn/"onclick=')).toBeNull();
  });

  it('thông báo thiếu tiêu đề thì dùng tiêu đề mặc định; chuỗi quá dài bị cắt', () => {
    const e = buildEmail('invoice_reminder', 'vi', { academyName: 'CLB' });
    expect(e.subject).toBe('Nhắc đóng học phí');
    const long = buildEmail('quiz_assigned', 'vi', { academyName: 'CLB', title: 'x'.repeat(1000) });
    expect(long.subject.length).toBeLessThanOrEqual(150);
  });
});

describe('tiện ích email', () => {
  it('loại thông báo điều khiển từng loại email', () => {
    expect(emailCategory.invite_coach).toBe('system');
    expect(emailCategory.invoice_reminder).toBe('invoice_reminder');
    expect(emailCategory.quiz_assigned).toBe('quiz');
  });

  it('email gửi được: hợp lệ và không phải email giả của học viên PIN', () => {
    expect(isDeliverableEmail('a@b.vn')).toBe(true);
    expect(isDeliverableEmail('an@students.erpchess.local')).toBe(false);
    expect(isDeliverableEmail('AN@Students.ErpChess.Local')).toBe(false);
    expect(isDeliverableEmail('khong-phai')).toBe(false);
    expect(isDeliverableEmail(null)).toBe(false);
    expect(isDeliverableEmail(`${'a'.repeat(250)}@b.vn`)).toBe(false);
  });

  it('formatFrom bỏ ký tự phá header', () => {
    expect(formatFrom('CLB Dương Sinh', 'no-reply@x.vn')).toBe('CLB Dương Sinh <no-reply@x.vn>');
    expect(formatFrom('Evil\r\nBcc: a@b.c <x>', 'n@x.vn')).not.toMatch(/[\r\n<>]{1}.*</s);
    expect(formatFrom('', 'n@x.vn')).toBe('n@x.vn');
    expect(escapeHtml('<&>"\'')).toBe('&lt;&amp;&gt;&quot;&#39;');
  });
});
