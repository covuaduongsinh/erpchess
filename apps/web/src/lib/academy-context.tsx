import type { MyAcademy } from '@erpchess/api';
import type { Session } from '@supabase/supabase-js';
import { createContext, use } from 'react';

export type AcademyContextValue = { academy: MyAcademy; session: Session };

export const AcademyContext = createContext<AcademyContextValue | null>(null);

export function useAcademy(): AcademyContextValue {
  const value = use(AcademyContext);
  if (!value) throw new Error('useAcademy phải nằm trong route /a/$slug');
  return value;
}
