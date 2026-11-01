import type { MyAcademy } from '@erpchess/api';
import { useMyAcademies, useSession } from '@erpchess/api/react';
import { useParams } from '@tanstack/react-router';
import { useEffect } from 'react';
import { readLastAcademySlug, saveLastAcademySlug } from './useSidebarState';

/**
 * Học viện đang dùng: theo URL (`/a/$slug`), nếu không có thì học viện dùng gần nhất, rồi học viện
 * đầu tiên; `null` khi chưa đăng nhập hoặc chưa thuộc học viện nào. Dùng cho sidebar và trang 404.
 */
export function useCurrentAcademy(): { academy: MyAcademy | null; academies: MyAcademy[] } {
  const { session } = useSession();
  const params = useParams({ strict: false }) as { slug?: string };
  const academies = useMyAcademies(session?.user.id);
  const list = academies.data ?? [];
  const bySlug = params.slug ? list.find((a) => a.slug === params.slug) : undefined;
  const academy = bySlug ?? list.find((a) => a.slug === readLastAcademySlug()) ?? list[0] ?? null;
  useEffect(() => {
    if (bySlug) saveLastAcademySlug(bySlug.slug);
  }, [bySlug]);
  return { academy, academies: list };
}
