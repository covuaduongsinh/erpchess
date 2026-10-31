import type { MyAcademy, OnlineMember } from '@erpchess/api';
import type { Session } from '@supabase/supabase-js';
import { createContext, use } from 'react';

export type AcademyContextValue = {
  academy: MyAcademy;
  session: Session;
  /** Thành viên đang online trong học viện (presence Realtime). */
  online?: OnlineMember[];
};

export const AcademyContext = createContext<AcademyContextValue | null>(null);

/** Học viện đang mở, hoặc null khi ở ngoài route /a/$slug (vd. trang phân tích chung). */
export function useOptionalAcademy(): AcademyContextValue | null {
  return use(AcademyContext);
}

export function useAcademy(): AcademyContextValue {
  const value = use(AcademyContext);
  if (!value) throw new Error('useAcademy phải nằm trong route /a/$slug');
  return value;
}
