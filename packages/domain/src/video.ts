/** Nhận dạng link video của hoạt động "Video" để nhúng an toàn (chỉ YouTube/Vimeo/tệp https). */

export type VideoEmbed =
  | { kind: 'youtube'; src: string }
  | { kind: 'vimeo'; src: string }
  | { kind: 'file'; src: string };

const ID_RE = /^[A-Za-z0-9_-]{6,20}$/;

/**
 * Viết bằng biểu thức chính quy thay vì `URL` để gói domain không phụ thuộc thư viện DOM/Node.
 * Chỉ nhận https, không khoảng trắng hay dấu nháy.
 */
export function videoEmbed(url: string): VideoEmbed | null {
  const m = /^https:\/\/([^/?#\s"'<>]+)([^?#\s"'<>]*)(\?[^#\s"'<>]*)?(#\S*)?$/i.exec(url.trim());
  if (!m) return null;
  const host = (m[1] ?? '').toLowerCase().replace(/^(www|m)\./, '');
  const path = m[2] ?? '';
  const query = m[3] ?? '';

  if (host === 'youtube.com' || host === 'youtu.be' || host === 'youtube-nocookie.com') {
    const id =
      host === 'youtu.be'
        ? path.slice(1)
        : (/[?&]v=([^&]+)/.exec(query)?.[1] ?? /^\/(?:embed|shorts|live)\/([^/]+)/.exec(path)?.[1]);
    return id && ID_RE.test(id)
      ? { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}` }
      : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = /(\d{5,12})/.exec(path)?.[1];
    return id ? { kind: 'vimeo', src: `https://player.vimeo.com/video/${id}` } : null;
  }
  return { kind: 'file', src: url.trim() };
}
