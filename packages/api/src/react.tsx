/** Hook React dùng chung cho web/desktop (react-dom) và mobile (react-native). */
import type {
  AcademyProfileInput,
  LevelInput,
  RatingCategory,
  StudentCsvRow,
} from '@erpchess/domain';
import type { Session } from '@supabase/supabase-js';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { createContext, type ReactNode, use, useEffect, useState } from 'react';
import type { ErpClient } from './client';
import * as api from './queries';

const ClientContext = createContext<ErpClient | null>(null);

export function ErpProvider({ client, children }: { client: ErpClient; children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }),
  );
  return (
    <ClientContext value={client}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ClientContext>
  );
}

export function useErpClient(): ErpClient {
  const client = use(ClientContext);
  if (!client) throw new Error('useErpClient phải nằm trong <ErpProvider>');
  return client;
}

export type SessionState = { session: Session | null; loading: boolean };

/** Theo dõi phiên đăng nhập; tự cập nhật khi đăng nhập/đăng xuất ở tab khác hoặc khi token được làm mới. */
export function useSession(): SessionState {
  const client = useErpClient();
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionState>({ session: null, loading: true });

  useEffect(() => {
    let active = true;
    void client.auth.getSession().then(({ data }) => {
      if (active) setState({ session: data.session, loading: false });
    });
    const { data } = client.auth.onAuthStateChange((event, session) => {
      setState({ session, loading: false });
      if (event === 'SIGNED_OUT') queryClient.clear();
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client, queryClient]);

  return state;
}

export const queryKeys = {
  academies: (userId: string) => ['academies', userId] as const,
  members: (academyId: string) => ['members', academyId] as const,
  groups: (academyId: string) => ['groups', academyId] as const,
  groupStudents: (groupId: string) => ['group-students', groupId] as const,
  puzzles: (academyId: string) => ['puzzles', academyId] as const,
  assignments: (academyId: string) => ['assignments', academyId] as const,
  assignment: (id: string) => ['assignment', id] as const,
  attempts: (assignmentId: string, studentId?: string) =>
    ['attempts', assignmentId, studentId ?? 'all'] as const,
  progress: (filter: { assignmentId?: string; academyId?: string }) =>
    ['progress', filter.assignmentId ?? '', filter.academyId ?? ''] as const,
  levels: (academyId: string) => ['levels', academyId] as const,
  ratings: (academyId: string) => ['ratings', academyId] as const,
  leaderboard: (academyId: string, from: string, to: string) =>
    ['leaderboard', academyId, from, to] as const,
  stats: (academyId: string) => ['stats', academyId] as const,
};

export function useMyAcademies(userId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: queryKeys.academies(userId ?? ''),
    queryFn: () => api.fetchMyAcademies(client, userId ?? ''),
    enabled: !!userId,
  });
}

export function useMembers(academyId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: queryKeys.members(academyId ?? ''),
    queryFn: () => api.fetchMembers(client, academyId ?? ''),
    enabled: !!academyId,
  });
}

export function useGroups(academyId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: queryKeys.groups(academyId ?? ''),
    queryFn: () => api.fetchGroups(client, academyId ?? ''),
    enabled: !!academyId,
  });
}

export function useGroupStudentIds(groupId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: queryKeys.groupStudents(groupId ?? ''),
    queryFn: () => api.fetchGroupStudentIds(client, groupId ?? ''),
    enabled: !!groupId,
  });
}

export function useCreateAcademy() {
  const client = useErpClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof api.createAcademy>[1]) =>
      api.createAcademy(client, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academies'] }),
  });
}

export function useCreateGroup(academyId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, coachId }: { name: string; coachId?: string }) =>
      api.createGroup(client, academyId, name, coachId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.groups(academyId) }),
  });
}

export function useCreateStudent(academyId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Parameters<typeof api.createStudent>[1], 'academyId'>) =>
      api.createStudent(client, { ...input, academyId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.members(academyId) });
      void qc.invalidateQueries({ queryKey: queryKeys.groups(academyId) });
    },
  });
}

export function useToggleGroupStudent(academyId: string, groupId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, inGroup }: { studentId: string; inGroup: boolean }) =>
      inGroup
        ? api.removeStudentFromGroup(client, groupId, studentId)
        : api.addStudentToGroup(client, groupId, studentId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.groupStudents(groupId) });
      void qc.invalidateQueries({ queryKey: queryKeys.groups(academyId) });
    },
  });
}

export function useCreateInvitation(academyId: string) {
  const client = useErpClient();
  return useMutation({
    mutationFn: ({
      role,
      email,
      studentId,
    }: {
      role: 'coach' | 'parent';
      email?: string;
      studentId?: string;
    }) => api.createInvitation(client, academyId, role, { email, studentId }),
  });
}

export function useAcceptInvitation() {
  const client = useErpClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api.acceptInvitation(client, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academies'] }),
  });
}

export function usePuzzles(academyId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: queryKeys.puzzles(academyId ?? ''),
    queryFn: () => api.fetchPuzzles(client, academyId ?? ''),
    enabled: !!academyId,
    staleTime: 5 * 60_000,
  });
}

export function useAssignments(academyId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: queryKeys.assignments(academyId ?? ''),
    queryFn: () => api.fetchAssignments(client, academyId ?? ''),
    enabled: !!academyId,
  });
}

export function useAssignment(id: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: queryKeys.assignment(id ?? ''),
    queryFn: () => api.fetchAssignment(client, id ?? ''),
    enabled: !!id,
  });
}

/** Lần làm bài của một bài tập (cần danh sách item); `studentId` để lọc một học viên. */
export function useAttempts(assignment: api.AssignmentDetail | undefined, studentId?: string) {
  const client = useErpClient();
  return useQuery({
    queryKey: queryKeys.attempts(assignment?.id ?? '', studentId),
    queryFn: () => api.fetchAttempts(client, assignment?.items.map((i) => i.id) ?? [], studentId),
    enabled: !!assignment,
  });
}

export function useProgress(filter: { assignmentId?: string; academyId?: string }) {
  const client = useErpClient();
  return useQuery({
    queryKey: queryKeys.progress(filter),
    queryFn: () => api.fetchProgress(client, filter),
    enabled: !!(filter.assignmentId || filter.academyId),
  });
}

export function useCreateAssignment(academyId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Parameters<typeof api.createAssignment>[1], 'academyId'>) =>
      api.createAssignment(client, { ...input, academyId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.assignments(academyId) });
      void qc.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}

export function useDeleteAssignment(academyId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteAssignment(client, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.assignments(academyId) });
      void qc.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}

/** Nộp một lượt thử rồi làm mới lần làm bài và báo cáo của bài tập đó. */
export function useSubmitAttempt(assignmentId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, moves }: { itemId: string; moves: { uci: string; ms: number }[] }) =>
      api.submitAttempt(client, itemId, moves),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['attempts', assignmentId] });
      void qc.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}

// ── Quản trị học viện (Giai đoạn 5) ──

export function useLevels(academyId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: queryKeys.levels(academyId ?? ''),
    queryFn: () => api.fetchLevels(client, academyId ?? ''),
    enabled: !!academyId,
  });
}

/** Tạo, sửa, xoá cấp độ, tạo lộ trình mẫu; mọi thao tác làm mới danh sách cấp. */
export function useLevelMutations(academyId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: queryKeys.levels(academyId) });
  return {
    create: useMutation({
      mutationFn: ({ input, position }: { input: LevelInput; position: number }) =>
        api.createLevel(client, academyId, input, position),
      onSuccess,
    }),
    fromTemplate: useMutation({
      mutationFn: (startPosition: number) =>
        api.createLevelsFromTemplate(client, academyId, startPosition),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: LevelInput }) =>
        api.updateLevel(client, id, input),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.deleteLevel(client, id),
      onSuccess: () => {
        void onSuccess();
        void qc.invalidateQueries({ queryKey: queryKeys.members(academyId) });
        void qc.invalidateQueries({ queryKey: queryKeys.groups(academyId) });
      },
    }),
  };
}

export function useSetStudentLevel(academyId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, levelId }: { studentId: string; levelId: string | null }) =>
      api.setStudentLevel(client, academyId, studentId, levelId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.members(academyId) }),
  });
}

export function useUpdateGroup(academyId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: api.GroupPatch }) =>
      api.updateGroup(client, id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.groups(academyId) }),
  });
}

export function useDeleteGroup(academyId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteGroup(client, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.groups(academyId) }),
  });
}

export function useRatings(academyId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: queryKeys.ratings(academyId ?? ''),
    queryFn: () => api.fetchRatings(client, academyId ?? ''),
    enabled: !!academyId,
  });
}

export function useSetInitialRating(academyId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      studentId,
      category,
      rating,
    }: {
      studentId: string;
      category: RatingCategory;
      rating: number;
    }) => api.setInitialRating(client, academyId, studentId, category, rating),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ratings(academyId) }),
  });
}

export function useLeaderboard(academyId: string | undefined, from: Date, to: Date) {
  const client = useErpClient();
  return useQuery({
    queryKey: queryKeys.leaderboard(academyId ?? '', from.toISOString(), to.toISOString()),
    queryFn: () => api.fetchLeaderboard(client, academyId ?? '', from, to),
    enabled: !!academyId,
  });
}

export function useAcademyStats(academyId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: queryKeys.stats(academyId ?? ''),
    queryFn: () => api.fetchAcademyStats(client, academyId ?? ''),
    enabled: !!academyId,
  });
}

export function useUpdateAcademyProfile(academyId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AcademyProfileInput) => api.updateAcademyProfile(client, academyId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academies'] }),
  });
}

/** Nhập học viên từ CSV; `progress` là số dòng đã xử lý để hiện thanh tiến độ. */
export function useImportStudents(academyId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  const [progress, setProgress] = useState(0);
  const mutation = useMutation({
    mutationFn: ({
      rows,
      groups,
    }: {
      rows: readonly StudentCsvRow[];
      groups: readonly { id: string; name: string }[];
    }) => {
      setProgress(0);
      return api.importStudents(client, academyId, rows, groups, setProgress);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.members(academyId) });
      void qc.invalidateQueries({ queryKey: queryKeys.groups(academyId) });
    },
  });
  return { ...mutation, progress };
}
