import { brandColorVars } from '@erpchess/domain';
import { type CSSProperties, useEffect } from 'react';

/**
 * Biến CSS ghi đè màu chủ đạo trong phạm vi trang học viện (white-label, Giai đoạn 22a).
 * Tailwind v4 đọc `--color-primary` lúc vẽ nên mọi lớp `bg-primary`/`text-primary` bên trong đổi theo.
 */
export function academyBrandStyle(color: string | null | undefined): CSSProperties | undefined {
  const vars = brandColorVars(color);
  if (!vars) return undefined;
  return {
    '--color-primary': vars.primary,
    '--color-text-on-primary': vars.onPrimary,
  } as CSSProperties;
}

/** Đổi favicon của tab khi đang ở trong học viện, trả lại favicon cũ khi rời đi. */
export function useAcademyFavicon(url: string | null | undefined) {
  useEffect(() => {
    if (!url || typeof document === 'undefined') return;
    let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    const created = !link;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    const previous = link.getAttribute('href');
    link.setAttribute('href', url);
    return () => {
      if (!link) return;
      if (created) link.remove();
      else if (previous !== null) link.setAttribute('href', previous);
    };
  }, [url]);
}
