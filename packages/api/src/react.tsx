/** Hook React dùng chung cho web/desktop (react-dom) và mobile (react-native). */

import { playMove } from '@erpchess/chess-core';
import type {
  AcademyProfileInput,
  ActivityInput,
  AttendanceStatus,
  ClassroomInput,
  CourseInput,
  ExerciseInput,
  LevelInput,
  PracticePositionInput,
  QuizInput,
  RatingCategory,
  StudentCsvRow,
  StudyInput,
  TournamentInput,
} from '@erpchess/domain';
import type { Session } from '@supabase/supabase-js';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import * as billing from './billing';
import * as certificates from './certificates';
import * as chat from './chat';
import * as classrooms from './classrooms';
import type { ErpClient } from './client';
import * as courses from './courses';
import * as databases from './databases';
import * as games from './games';
import * as leads from './leads';
import * as notifications from './notifications';
import * as practice from './practice';
import * as presence from './presence';
import * as api from './queries';
import { ApiError } from './queries';
import * as quizzes from './quizzes';
import {
  ClassroomRoom,
  type RoomChat,
  type RoomPeer,
  type RoomSnapshot,
  type RoomStatus,
  snapshotFromState,
} from './room';
import * as simuls from './simuls';
import type { StudyScope } from './studies';
import * as studies from './studies';
import * as tournaments from './tournaments';

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

// ── Study (Giai đoạn 6) ──

export const studyKeys = {
  list: (scope: StudyScope, academyId: string, search: string) =>
    ['studies', scope, academyId, search] as const,
  detail: (id: string) => ['study', id] as const,
  attempts: (studyId: string, studentId?: string) =>
    ['activity-attempts', studyId, studentId ?? 'all'] as const,
  progress: (studyIds: readonly string[]) => ['study-progress', ...studyIds] as const,
  collections: (academyId: string) => ['collections', academyId] as const,
};

export function useStudies(opts: {
  scope: StudyScope;
  academyId: string | undefined;
  userId: string | undefined;
  search?: string;
}) {
  const client = useErpClient();
  return useQuery({
    queryKey: studyKeys.list(opts.scope, opts.academyId ?? '', opts.search ?? ''),
    queryFn: () =>
      studies.fetchStudies(client, {
        scope: opts.scope,
        academyId: opts.academyId ?? '',
        userId: opts.userId ?? '',
        search: opts.search,
      }),
    enabled: !!opts.academyId && !!opts.userId,
  });
}

export function useStudy(id: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: studyKeys.detail(id ?? ''),
    queryFn: () => studies.fetchStudy(client, id ?? ''),
    enabled: !!id,
  });
}

/** Tạo/sửa/xoá study và hoạt động; làm mới danh sách và chi tiết sau mỗi thao tác. */
export function useStudyMutations(userId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  const refresh = (studyId?: string) => {
    void qc.invalidateQueries({ queryKey: ['studies'] });
    if (studyId) void qc.invalidateQueries({ queryKey: studyKeys.detail(studyId) });
  };
  return {
    create: useMutation({
      mutationFn: (input: StudyInput) => studies.createStudy(client, userId, input),
      onSuccess: () => refresh(),
    }),
    update: useMutation({
      mutationFn: ({
        id,
        patch,
      }: {
        id: string;
        patch: Parameters<typeof studies.updateStudy>[2];
      }) => studies.updateStudy(client, id, patch),
      onSuccess: (_, v) => refresh(v.id),
    }),
    remove: useMutation({
      mutationFn: (id: string) => studies.deleteStudy(client, id),
      onSuccess: () => refresh(),
    }),
    addActivity: useMutation({
      mutationFn: (v: { studyId: string; input: ActivityInput; position: number }) =>
        studies.addActivity(client, v.studyId, v.input, v.position),
      onSuccess: (_, v) => refresh(v.studyId),
    }),
    updateActivity: useMutation({
      mutationFn: (v: { studyId: string; id: string; input: ActivityInput }) =>
        studies.updateActivity(client, v.id, v.input),
      onSuccess: (_, v) => refresh(v.studyId),
    }),
    deleteActivity: useMutation({
      mutationFn: (v: { studyId: string; id: string }) => studies.deleteActivity(client, v.id),
      onSuccess: (_, v) => refresh(v.studyId),
    }),
    reorder: useMutation({
      mutationFn: (v: { studyId: string; orderedIds: string[] }) =>
        studies.reorderActivities(client, v.orderedIds),
      onSettled: (_, __, v) => refresh(v.studyId),
    }),
  };
}

export function useActivityAttempts(study: studies.StudyDetail | undefined, studentId?: string) {
  const client = useErpClient();
  return useQuery({
    queryKey: studyKeys.attempts(study?.id ?? '', studentId),
    queryFn: () =>
      studies.fetchActivityAttempts(client, study?.activities.map((a) => a.id) ?? [], studentId),
    enabled: !!study,
  });
}

export function useStudyProgress(studyIds: readonly string[]) {
  const client = useErpClient();
  return useQuery({
    queryKey: studyKeys.progress(studyIds),
    queryFn: () => studies.fetchStudyProgress(client, studyIds),
    enabled: studyIds.length > 0,
  });
}

export function useSubmitActivity(studyId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { activityId: string; answer: studies.ActivityAnswer; ms?: number }) =>
      studies.submitActivity(client, v.activityId, v.answer, v.ms),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['activity-attempts', studyId] });
      void qc.invalidateQueries({ queryKey: ['study-progress'] });
    },
  });
}

export function useCollections(academyId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: studyKeys.collections(academyId ?? ''),
    queryFn: () => studies.fetchCollections(client, academyId ?? ''),
    enabled: !!academyId,
  });
}

export function useCollectionMutations(academyId: string, userId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: studyKeys.collections(academyId) });
  return {
    create: useMutation({
      mutationFn: (name: string) => studies.createCollection(client, academyId, userId, name),
      onSuccess,
    }),
    toggle: useMutation({
      mutationFn: (v: { collectionId: string; studyId: string; included: boolean }) =>
        studies.setCollectionStudy(client, v.collectionId, v.studyId, v.included),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (id: string) => studies.deleteCollection(client, id),
      onSuccess,
    }),
  };
}

// ── Kho ván (Giai đoạn 6b) ──

export const databaseKeys = {
  list: (academyId: string) => ['databases', academyId] as const,
  games: (databaseId: string, search: string, page: number) =>
    ['database-games', databaseId, search, page] as const,
  pgn: (gameId: string) => ['game-pgn', gameId] as const,
};

export function useDatabases(academyId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: databaseKeys.list(academyId ?? ''),
    queryFn: () => databases.fetchDatabases(client, academyId ?? ''),
    enabled: !!academyId,
  });
}

export function useDatabaseMutations(academyId: string, userId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  return {
    create: useMutation({
      mutationFn: (v: { name: string; visibility: 'private' | 'academy' }) =>
        databases.createDatabase(client, academyId, userId, v.name, v.visibility),
      onSuccess: () => qc.invalidateQueries({ queryKey: databaseKeys.list(academyId) }),
    }),
    remove: useMutation({
      mutationFn: (id: string) => databases.deleteDatabase(client, id),
      onSuccess: () => qc.invalidateQueries({ queryKey: databaseKeys.list(academyId) }),
    }),
    importPgn: useMutation({
      mutationFn: (v: { databaseId: string; text: string }) => {
        setProgress(null);
        return databases.importPgn(client, v.databaseId, v.text, (done, total) =>
          setProgress({ done, total }),
        );
      },
      onSettled: (_, __, v) => qc.invalidateQueries({ queryKey: ['database-games', v.databaseId] }),
    }),
    progress,
  };
}

export function useGames(databaseId: string | undefined, search: string, page: number) {
  const client = useErpClient();
  return useQuery({
    queryKey: databaseKeys.games(databaseId ?? '', search, page),
    queryFn: () => databases.searchGames(client, databaseId ?? '', { search, page }),
    enabled: !!databaseId,
    placeholderData: (prev) => prev,
  });
}

export function useGamePgn(gameId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: databaseKeys.pgn(gameId ?? ''),
    queryFn: () => databases.fetchGamePgn(client, gameId ?? ''),
    enabled: !!gameId,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

// ── Quiz (Giai đoạn 7) ──

export const quizKeys = {
  list: (academyId: string) => ['quizzes', academyId] as const,
  detail: (id: string) => ['quiz', id] as const,
  questions: (id: string) => ['quiz-questions', id] as const,
  items: (id: string) => ['quiz-items', id] as const,
  attempts: (quizId: string, studentId?: string) =>
    ['quiz-attempts', quizId, studentId ?? 'all'] as const,
  leaderboard: (id: string) => ['quiz-leaderboard', id] as const,
};

export function useQuizzes(academyId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: quizKeys.list(academyId ?? ''),
    queryFn: () => quizzes.fetchQuizzes(client, academyId ?? ''),
    enabled: !!academyId,
  });
}

export function useQuiz(id: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: quizKeys.detail(id ?? ''),
    queryFn: () => quizzes.fetchQuiz(client, id ?? ''),
    enabled: !!id,
  });
}

export function useQuizQuestions(id: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: quizKeys.questions(id ?? ''),
    queryFn: () => quizzes.fetchQuizQuestions(client, id ?? ''),
    enabled: !!id,
  });
}

/** Câu hỏi kèm đáp án — chỉ dùng cho staff (RLS chặn học viên). */
export function useQuizItems(id: string | undefined, enabled = true) {
  const client = useErpClient();
  return useQuery({
    queryKey: quizKeys.items(id ?? ''),
    queryFn: () => quizzes.fetchQuizItems(client, id ?? ''),
    enabled: !!id && enabled,
  });
}

export function useQuizAttempts(
  quizId: string | undefined,
  itemIds: readonly string[],
  studentId?: string,
) {
  const client = useErpClient();
  return useQuery({
    queryKey: [...quizKeys.attempts(quizId ?? '', studentId), itemIds.length],
    queryFn: () => quizzes.fetchQuizAttempts(client, itemIds, studentId),
    enabled: !!quizId && itemIds.length > 0,
  });
}

export function useQuizLeaderboard(id: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: quizKeys.leaderboard(id ?? ''),
    queryFn: () => quizzes.fetchQuizLeaderboard(client, id ?? ''),
    enabled: !!id,
  });
}

export function useQuizMutations(academyId: string, userId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  return {
    create: useMutation({
      mutationFn: (input: Omit<QuizInput, 'academyId'>) =>
        quizzes.createQuiz(client, userId, { ...input, academyId }),
      onSuccess: () => qc.invalidateQueries({ queryKey: quizKeys.list(academyId) }),
    }),
    remove: useMutation({
      mutationFn: (id: string) => quizzes.deleteQuiz(client, id),
      onSuccess: () => qc.invalidateQueries({ queryKey: quizKeys.list(academyId) }),
    }),
  };
}

/** Trả lời một câu; làm mới lần làm và bảng xếp hạng của quiz. */
export function useAnswerQuiz(quizId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { itemId: string; answer: quizzes.QuizAnswer; ms?: number }) =>
      quizzes.answerQuizItem(client, v.itemId, v.answer, v.ms),
    onSuccess: (r) => {
      if (r.solved || !r.ok) {
        void qc.invalidateQueries({ queryKey: ['quiz-attempts', quizId] });
        void qc.invalidateQueries({ queryKey: quizKeys.leaderboard(quizId) });
      }
    },
  });
}

export type QuizPuzzleState = {
  fen: string;
  step: number;
  status: 'playing' | 'waiting' | 'wrong' | 'solved';
  lastMove?: readonly [string, string];
};

/**
 * Puzzle trong quiz: client không có lời giải. Mỗi nước gửi lên `quiz-answer`; đúng thì server trả
 * nước đáp để đi tiếp, sai thì hết lượt thử. Lệch bước (mở lại trang giữa chừng) thì bắt đầu lại.
 */
export function useQuizPuzzle(quizId: string, itemId: string, startFen: string, solved: boolean) {
  const answer = useAnswerQuiz(quizId);
  const [state, setState] = useState<QuizPuzzleState>({
    fen: startFen,
    step: 0,
    status: solved ? 'solved' : 'playing',
  });
  const since = useRef(Date.now());

  const retry = useCallback(() => {
    since.current = Date.now();
    setState({ fen: startFen, step: 0, status: 'playing' });
  }, [startFen]);

  const play = useCallback(
    async (uci: string) => {
      if (state.status !== 'playing') return;
      const played = playMove(state.fen, uci);
      if (!played) return;
      const squares = [played.uci.slice(0, 2), played.uci.slice(2, 4)] as const;
      setState((s) => ({ ...s, fen: played.fen, status: 'waiting', lastMove: squares }));
      const ms = Date.now() - since.current;
      since.current = Date.now();
      try {
        const r = await answer.mutateAsync({
          itemId,
          answer: { move: played.uci, step: state.step },
          ms,
        });
        if (r.solved) setState((s) => ({ ...s, status: 'solved' }));
        else if (!r.ok) setState((s) => ({ ...s, status: 'wrong' }));
        else if (r.reply) {
          const reply = playMove(played.fen, r.reply);
          setState({
            fen: reply?.fen ?? played.fen,
            step: r.step ?? state.step + 2,
            status: 'playing',
            lastMove: reply ? [reply.uci.slice(0, 2), reply.uci.slice(2, 4)] : squares,
          });
        }
      } catch (err) {
        if (err instanceof ApiError && err.code === 'out_of_sync') retry();
        else
          setState((s) => ({ ...s, fen: state.fen, status: 'playing', lastMove: state.lastMove }));
      }
    },
    [answer, itemId, retry, state],
  );

  return { state, play, retry, error: answer.error };
}

// ── Exercise, Practice (Giai đoạn 7c) ──

export function useExercises(academyId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['exercises', academyId ?? ''],
    queryFn: () => practice.fetchExercises(client, academyId ?? ''),
    enabled: !!academyId,
  });
}

export function useExerciseMutations(academyId: string, userId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['exercises', academyId] });
    void qc.invalidateQueries({ queryKey: queryKeys.assignments(academyId) });
    void qc.invalidateQueries({ queryKey: ['progress'] });
  };
  return {
    create: useMutation({
      mutationFn: (input: Omit<ExerciseInput, 'academyId'>) =>
        practice.createExercise(client, userId, { ...input, academyId }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => practice.deleteExercise(client, id),
      onSuccess: refresh,
    }),
    assign: useMutation({
      mutationFn: (v: {
        exercise: practice.ExerciseSummary;
        dueAt?: string;
        groupIds: string[];
        studentIds: string[];
      }) => practice.assignExercise(client, v.exercise, v),
      onSuccess: refresh,
    }),
  };
}

export function usePracticeChapters(academyId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['practice', academyId ?? ''],
    queryFn: () => practice.fetchPracticeChapters(client, academyId ?? ''),
    enabled: !!academyId,
  });
}

export function usePracticeChapter(id: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['practice-chapter', id ?? ''],
    queryFn: () => practice.fetchPracticeChapter(client, id ?? ''),
    enabled: !!id,
  });
}

export function usePracticeResults(positionIds: readonly string[]) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['practice-results', ...positionIds],
    queryFn: () => practice.fetchPracticeResults(client, positionIds),
    enabled: positionIds.length > 0,
  });
}

export function usePracticeMutations(academyId: string, userId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  const refresh = (chapterId?: string) => {
    void qc.invalidateQueries({ queryKey: ['practice', academyId] });
    if (chapterId) void qc.invalidateQueries({ queryKey: ['practice-chapter', chapterId] });
  };
  return {
    createChapter: useMutation({
      mutationFn: (v: {
        title: string;
        description?: string;
        visibility?: 'private' | 'academy';
      }) => practice.createPracticeChapter(client, academyId, userId, v),
      onSuccess: () => refresh(),
    }),
    deleteChapter: useMutation({
      mutationFn: (id: string) => practice.deletePracticeChapter(client, id),
      onSuccess: () => refresh(),
    }),
    addPosition: useMutation({
      mutationFn: (v: { chapterId: string; input: PracticePositionInput; position: number }) =>
        practice.addPracticePosition(client, v.chapterId, v.input, v.position),
      onSuccess: (_, v) => refresh(v.chapterId),
    }),
    deletePosition: useMutation({
      mutationFn: (v: { chapterId: string; id: string }) =>
        practice.deletePracticePosition(client, v.id),
      onSuccess: (_, v) => refresh(v.chapterId),
    }),
    recordResult: useMutation({
      mutationFn: (v: { positionId: string; result: 'win' | 'draw' | 'loss'; moves: number }) =>
        practice.recordPracticeResult(client, userId, v.positionId, v.result, v.moves),
      onSuccess: () => qc.invalidateQueries({ queryKey: ['practice-results'] }),
    }),
  };
}

// ── Lớp học (Giai đoạn 8) ──

export const classroomKeys = {
  all: (academyId: string) => ['classrooms', academyId] as const,
  list: (academyId: string, from: Date, to: Date, createdBy?: string) =>
    ['classrooms', academyId, from.getTime(), to.getTime(), createdBy ?? ''] as const,
  detail: (id: string) => ['classroom', id] as const,
  roster: (id: string) => ['classroom-roster', id] as const,
  events: (id: string) => ['classroom-events', id] as const,
  availability: (academyId: string) => ['coach-availability', academyId] as const,
  calendar: (academyId: string) => ['calendar', academyId] as const,
};

export function useClassrooms(
  academyId: string | undefined,
  range: { from: Date; to: Date; createdBy?: string },
) {
  const client = useErpClient();
  return useQuery({
    queryKey: classroomKeys.list(academyId ?? '', range.from, range.to, range.createdBy),
    queryFn: () => classrooms.fetchClassrooms(client, academyId ?? '', range),
    enabled: !!academyId,
  });
}

export function useClassroom(id: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: classroomKeys.detail(id ?? ''),
    queryFn: () => classrooms.fetchClassroom(client, id ?? ''),
    enabled: !!id,
  });
}

export function useClassroomRoster(classroom: classrooms.ClassroomSummary | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: classroomKeys.roster(classroom?.id ?? ''),
    queryFn: () =>
      classrooms.fetchClassroomRoster(client, classroom as classrooms.ClassroomSummary),
    enabled: !!classroom,
  });
}

export function useClassroomEvents(id: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: classroomKeys.events(id ?? ''),
    queryFn: () => classrooms.fetchClassroomEvents(client, id ?? ''),
    enabled: !!id,
  });
}

export function useClassroomMutations(academyId: string, userId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  const refresh = (id?: string) => {
    void qc.invalidateQueries({ queryKey: classroomKeys.all(academyId) });
    void qc.invalidateQueries({ queryKey: classroomKeys.calendar(academyId) });
    if (id) void qc.invalidateQueries({ queryKey: classroomKeys.detail(id) });
  };
  return {
    create: useMutation({
      mutationFn: (input: Omit<ClassroomInput, 'academyId'>) =>
        classrooms.createClassrooms(client, userId, { ...input, academyId }),
      onSuccess: () => refresh(),
    }),
    update: useMutation({
      mutationFn: (v: { id: string; patch: Parameters<typeof classrooms.updateClassroom>[2] }) =>
        classrooms.updateClassroom(client, v.id, v.patch),
      onSuccess: (_, v) => refresh(v.id),
    }),
    remove: useMutation({
      mutationFn: (id: string) => classrooms.deleteClassroom(client, id),
      onSuccess: () => refresh(),
    }),
    removeUpcomingSeries: useMutation({
      mutationFn: (seriesId: string) => classrooms.deleteUpcomingInSeries(client, seriesId),
      onSuccess: () => refresh(),
    }),
    setAttendance: useMutation({
      mutationFn: (v: {
        classroomId: string;
        studentId: string;
        status: AttendanceStatus;
        note?: string;
      }) => classrooms.setAttendance(client, v.classroomId, v.studentId, v.status, v.note),
      onSuccess: (_, v) => refresh(v.classroomId),
    }),
  };
}

export function useJoinClassroom(classroomId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => classrooms.joinClassroom(client, classroomId),
    onSuccess: () => qc.invalidateQueries({ queryKey: classroomKeys.detail(classroomId) }),
  });
}

export function useCoachAvailability(academyId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: classroomKeys.availability(academyId ?? ''),
    queryFn: () => classrooms.fetchAvailability(client, academyId ?? ''),
    enabled: !!academyId,
  });
}

export function useCalendarEvents(academyId: string | undefined, from: Date, to: Date) {
  const client = useErpClient();
  return useQuery({
    queryKey: [...classroomKeys.calendar(academyId ?? ''), from.getTime(), to.getTime()],
    queryFn: () => classrooms.fetchCalendarEvents(client, academyId ?? '', from, to),
    enabled: !!academyId,
  });
}

export function useCalendarMutations(academyId: string, userId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  const refreshCalendar = () =>
    qc.invalidateQueries({ queryKey: classroomKeys.calendar(academyId) });
  const refreshAvailability = () =>
    qc.invalidateQueries({ queryKey: classroomKeys.availability(academyId) });
  return {
    addEvent: useMutation({
      mutationFn: (e: Parameters<typeof classrooms.createCalendarEvent>[3]) =>
        classrooms.createCalendarEvent(client, userId, academyId, e),
      onSuccess: refreshCalendar,
    }),
    removeEvent: useMutation({
      mutationFn: (id: string) => classrooms.deleteCalendarEvent(client, id),
      onSuccess: refreshCalendar,
    }),
    addAvailability: useMutation({
      mutationFn: (slot: Parameters<typeof classrooms.addAvailability>[2]) =>
        classrooms.addAvailability(client, academyId, slot),
      onSuccess: refreshAvailability,
    }),
    removeAvailability: useMutation({
      mutationFn: (id: string) => classrooms.deleteAvailability(client, id),
      onSuccess: refreshAvailability,
    }),
  };
}

/** Mọi cặp lớp–học viên của học viện (lọc Calendar theo học viên). */
export function useGroupMemberships(academyId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['group-memberships', academyId ?? ''],
    queryFn: () => api.fetchGroupMemberships(client, academyId ?? ''),
    enabled: !!academyId,
  });
}

/**
 * Phòng học trực tuyến: kết nối hai kênh Realtime của lớp, trả ảnh chụp bàn cờ, chat, người trong
 * phòng. `runner` (HLV phụ trách / owner) điều khiển bàn cờ; người khác chỉ theo dõi.
 */
export function useClassroomRoom(
  classroom: classrooms.ClassroomSummary | undefined,
  me: { userId: string; name: string } | undefined,
  runner: boolean,
) {
  const client = useErpClient();
  const [room, setRoom] = useState<ClassroomRoom | null>(null);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [chat, setChat] = useState<RoomChat[]>([]);
  const [peers, setPeers] = useState<RoomPeer[]>([]);
  const [status, setStatus] = useState<RoomStatus>('connecting');
  const [error, setError] = useState<unknown>(null);
  const classroomId = classroom?.id;
  // Ảnh chụp ban đầu chỉ đọc khi vào phòng; sau đó bàn cờ đi theo kênh Realtime
  const previous = useRef<Promise<unknown>>(Promise.resolve());
  const initialState = useRef(classroom?.state);
  initialState.current ??= classroom?.state;
  const userId = me?.userId;
  const name = me?.name;

  useEffect(() => {
    if (!classroomId || !userId) return;
    let alive = true;
    const r = new ClassroomRoom(
      client,
      classroomId,
      { userId, name: name ?? '' },
      runner,
      snapshotFromState(initialState.current),
      {
        onSnapshot: (s) => alive && setSnapshot(s),
        onChat: (m) => alive && setChat((c) => (c.some((x) => x.id === m.id) ? c : [...c, m])),
        onPeers: (p) => alive && setPeers(p),
        onStatus: (s) => alive && setStatus(s),
      },
    );
    setRoom(r);
    setSnapshot(r.snapshot);
    void classrooms
      .fetchClassroomEvents(client, classroomId)
      .then((events) => {
        if (!alive) return;
        setChat(
          events
            .filter((e) => e.kind === 'chat')
            .map((e) => e.payload as unknown as RoomChat)
            .filter((m) => typeof m?.text === 'string'),
        );
      })
      .catch(() => undefined);
    // Kênh cùng topic: phải đợi lần ngắt trước (StrictMode, đổi tên) xong mới vào lại, nếu không
    // removeChannel của lần trước sẽ gỡ luôn kênh mới
    void previous.current
      .then(() => (alive ? r.connect() : undefined))
      .catch((err) => alive && setError(err));
    return () => {
      alive = false;
      previous.current = r.disconnect().catch(() => undefined);
    };
  }, [client, classroomId, userId, name, runner]);

  return { room, snapshot, chat, peers, status, error };
}

/** Token video LiveKit của lớp; không thử lại (lỗi cấu hình hay quyền đều không tự hết). */
export function useVideoToken(classroomId: string | undefined, enabled = true) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['video-token', classroomId ?? ''],
    queryFn: () => classrooms.fetchVideoToken(client, classroomId ?? ''),
    enabled: !!classroomId && enabled,
    retry: false,
    staleTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useSilenceParticipant(classroomId: string) {
  const client = useErpClient();
  return useMutation({
    mutationFn: (v: { identity: string; on: boolean }) =>
      classrooms.silenceParticipant(client, classroomId, v.identity, v.on),
  });
}

// ── Ván đấu (Giai đoạn 9) ──

export const gameKeys = {
  all: (academyId: string) => ['games', academyId] as const,
  list: (academyId: string, filter: object) => ['games', academyId, filter] as const,
  detail: (id: string) => ['game', id] as const,
};

export function usePlayGames(
  academyId: string | undefined,
  filter: Parameters<typeof games.fetchGames>[2] = {},
) {
  const client = useErpClient();
  return useQuery({
    queryKey: gameKeys.list(academyId ?? '', filter),
    queryFn: () => games.fetchGames(client, academyId ?? '', filter),
    enabled: !!academyId,
  });
}

/**
 * Một ván: tải từ CSDL rồi nghe kênh `game:<id>`; chỉ nhận trạng thái có `version` mới hơn để
 * tin đến muộn không ghi đè.
 */
export function useGame(id: string | undefined) {
  const client = useErpClient();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: gameKeys.detail(id ?? ''),
    queryFn: () => games.fetchGame(client, id ?? ''),
    enabled: !!id,
  });
  useEffect(() => {
    if (!id) return;
    return games.subscribeGame(client, id, (patch) => {
      qc.setQueryData<games.GameRow>(gameKeys.detail(id), (old) =>
        old && (patch.version ?? 0) > old.version ? { ...old, ...patch } : old,
      );
    });
  }, [client, qc, id]);
  return query;
}

export function useGameAction(id: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { action: games.GameAction; move?: string; ply?: number }) =>
      games.gameAction(client, id, v.action, { move: v.move, ply: v.ply }),
    onSuccess: (row) => {
      if (!('id' in row)) return;
      qc.setQueryData<games.GameRow>(gameKeys.detail(id), (old) =>
        !old || row.version >= old.version ? row : old,
      );
    },
    // Lệch bước hoặc ván đã xong: tải lại trạng thái thật từ server
    onError: () => qc.invalidateQueries({ queryKey: gameKeys.detail(id) }),
  });
}

export function useGameMutations(academyId: string, userId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: gameKeys.all(academyId) });
  return {
    pair: useMutation({
      mutationFn: (v: Omit<Parameters<typeof games.createPairing>[2], 'academyId'>) =>
        games.createPairing(client, userId, { ...v, academyId }),
      onSuccess: refresh,
    }),
    saveBot: useMutation({
      mutationFn: (v: Omit<Parameters<typeof games.saveBotGame>[2], 'academyId'>) =>
        games.saveBotGame(client, userId, { ...v, academyId }),
      onSuccess: refresh,
    }),
  };
}

/**
 * Báo mình đang online trong học viện và nhận danh sách người đang online. Đợi lần rời kênh trước
 * xong mới vào lại (React chạy effect hai lần ở StrictMode; cùng topic sẽ gỡ nhầm kênh mới).
 */
export function useAcademyPresence(
  academyId: string | undefined,
  me: presence.OnlineMember | undefined,
) {
  const client = useErpClient();
  const [online, setOnline] = useState<presence.OnlineMember[]>([]);
  const previous = useRef<Promise<unknown>>(Promise.resolve());
  const userId = me?.userId;
  const name = me?.name;
  const role = me?.role;
  useEffect(() => {
    if (!academyId || !userId) return;
    let alive = true;
    let session: ReturnType<typeof presence.joinAcademyPresence> | null = null;
    const start = previous.current.then(() => {
      if (!alive) return;
      session = presence.joinAcademyPresence(
        client,
        academyId,
        { userId, name: name ?? '', role: role ?? '' },
        (list) => alive && setOnline(list),
      );
      return session.ready.catch(() => undefined);
    });
    return () => {
      alive = false;
      setOnline([]);
      previous.current = start.then(() => session?.leave()).catch(() => undefined);
    };
  }, [client, academyId, userId, name, role]);
  return online;
}

// ── Simul (Giai đoạn 9c) ──

export function useSimuls(academyId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['simuls', academyId ?? ''],
    queryFn: () => simuls.fetchSimuls(client, academyId ?? ''),
    enabled: !!academyId,
  });
}

/** Simul và các bàn; làm mới định kỳ để chủ simul thấy bàn nào đang chờ mình đi. */
export function useSimul(id: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['simul', id ?? ''],
    queryFn: () => simuls.fetchSimul(client, id ?? ''),
    enabled: !!id,
    refetchInterval: 3000,
  });
}

export function useSimulMutations(academyId: string, userId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['simuls', academyId] });
    void qc.invalidateQueries({ queryKey: ['simul'] });
    void qc.invalidateQueries({ queryKey: gameKeys.all(academyId) });
  };
  return {
    create: useMutation({
      mutationFn: (v: Omit<Parameters<typeof simuls.createSimul>[2], 'academyId'>) =>
        simuls.createSimul(client, userId, { ...v, academyId }),
      onSuccess: refresh,
    }),
    start: useMutation({
      mutationFn: (id: string) => simuls.startSimul(client, id),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => simuls.deleteSimul(client, id),
      onSuccess: refresh,
    }),
  };
}

// ── Giải đấu (Giai đoạn 10) ──

export function useTournaments(academyId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['tournaments', academyId ?? ''],
    queryFn: () => tournaments.fetchTournaments(client, academyId ?? ''),
    enabled: !!academyId,
  });
}

/** Một giải; nghe kênh `tournament:<id>` để bảng xếp hạng cập nhật ngay khi có ván xong. */
export function useTournament(id: string | undefined) {
  const client = useErpClient();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['tournament', id ?? ''],
    queryFn: () => tournaments.fetchTournament(client, id ?? ''),
    enabled: !!id,
  });
  useEffect(() => {
    if (!id) return;
    return tournaments.subscribeTournament(client, id, () => {
      void qc.invalidateQueries({ queryKey: ['tournament', id] });
    });
  }, [client, qc, id]);
  return query;
}

export function useTournamentMutations(academyId: string, userId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['tournaments', academyId] });
    void qc.invalidateQueries({ queryKey: ['tournament'] });
  };
  return {
    create: useMutation({
      mutationFn: (input: Omit<TournamentInput, 'academyId'>) =>
        tournaments.createTournament(client, userId, { ...input, academyId }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => tournaments.deleteTournament(client, id),
      onSuccess: refresh,
    }),
    join: useMutation({
      mutationFn: (id: string) => tournaments.joinTournament(client, id, userId),
      onSuccess: refresh,
    }),
    leave: useMutation({
      mutationFn: (id: string) => tournaments.leaveTournament(client, id, userId),
      onSuccess: refresh,
    }),
    withdraw: useMutation({
      mutationFn: (v: { id: string; playerId: string; withdrawn: boolean }) =>
        tournaments.setWithdrawn(client, v.id, v.playerId, v.withdrawn),
      onSuccess: refresh,
    }),
    act: useMutation({
      mutationFn: (v: { id: string; action: tournaments.TournamentAction }) =>
        tournaments.tournamentAction(client, v.id, v.action),
      onSuccess: refresh,
    }),
  };
}

// ── Khoá học, XP (Giai đoạn 11) ──

export function useCourses(academyId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['courses', academyId ?? ''],
    queryFn: () => courses.fetchCourses(client, academyId ?? ''),
    enabled: !!academyId,
  });
}

export function useCourse(id: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['course', id ?? ''],
    queryFn: () => courses.fetchCourse(client, id ?? ''),
    enabled: !!id,
  });
}

export function useCourseProgress(courseIds: readonly string[]) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['course-progress', [...courseIds].sort().join(',')],
    queryFn: () => courses.fetchCourseProgress(client, courseIds),
    enabled: courseIds.length > 0,
  });
}

export function useCourseCompletions(courseIds: readonly string[]) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['course-completions', [...courseIds].sort().join(',')],
    queryFn: () => courses.fetchCourseCompletions(client, courseIds),
    enabled: courseIds.length > 0,
  });
}

export function useCourseMutations(academyId: string, userId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['courses', academyId] });
    void qc.invalidateQueries({ queryKey: ['course'] });
    void qc.invalidateQueries({ queryKey: ['course-progress'] });
    void qc.invalidateQueries({ queryKey: ['course-completions'] });
  };
  return {
    create: useMutation({
      mutationFn: (input: Omit<CourseInput, 'academyId'>) =>
        courses.createCourse(client, userId, { ...input, academyId }),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: (v: { id: string; patch: Parameters<typeof courses.updateCourse>[2] }) =>
        courses.updateCourse(client, v.id, v.patch),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => courses.deleteCourse(client, id),
      onSuccess: refresh,
    }),
    setItems: useMutation({
      mutationFn: (v: { id: string; items: { studyId: string; required: boolean }[] }) =>
        courses.setCourseItems(client, v.id, v.items),
      onSuccess: refresh,
    }),
    setTargets: useMutation({
      mutationFn: (v: { id: string; groupIds: string[]; studentIds: string[] }) =>
        courses.setCourseTargets(client, v.id, v.groupIds, v.studentIds),
      onSuccess: refresh,
    }),
  };
}

export function useStudentXp(studentId: string | undefined, academyId?: string) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['student-xp', studentId ?? '', academyId ?? ''],
    queryFn: () => courses.fetchStudentXp(client, studentId ?? '', academyId),
    enabled: !!studentId,
  });
}

export function useXpLeaderboard(
  academyId: string | undefined,
  range: { from?: string; to?: string },
) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['xp-leaderboard', academyId ?? '', range.from ?? '', range.to ?? ''],
    queryFn: () => courses.fetchXpLeaderboard(client, academyId ?? '', range),
    enabled: !!academyId,
  });
}

export function useCertificates(
  filter: { academyId: string; studentId?: string; courseId?: string } | undefined,
) {
  const client = useErpClient();
  return useQuery({
    queryKey: [
      'certificates',
      filter?.academyId ?? '',
      filter?.studentId ?? '',
      filter?.courseId ?? '',
    ],
    queryFn: () => certificates.fetchCertificates(client, filter ?? { academyId: '' }),
    enabled: !!filter?.academyId,
  });
}

export function useCertificate(id: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['certificate', id ?? ''],
    queryFn: () => certificates.fetchCertificate(client, id ?? ''),
    enabled: !!id,
  });
}

export function useCertificateMutations(academyId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['certificates', academyId] });
    void qc.invalidateQueries({ queryKey: ['certificate'] });
  };
  return {
    issue: useMutation({
      mutationFn: (input: { studentId: string; title?: string; courseId?: string | null }) =>
        certificates.issueCertificate(client, { ...input, academyId }),
      onSuccess: refresh,
    }),
    revoke: useMutation({
      mutationFn: (id: string) => certificates.revokeCertificate(client, id),
      onSuccess: refresh,
    }),
  };
}

export function useBilling(academyId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['billing', academyId ?? ''],
    queryFn: () => billing.fetchBilling(client, academyId ?? ''),
    enabled: !!academyId,
  });
}

export function usePlans(academyId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['plans', academyId ?? ''],
    queryFn: () => billing.fetchPlans(client, academyId ?? ''),
    enabled: !!academyId,
  });
}

export function useDiscounts(academyId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['discounts', academyId ?? ''],
    queryFn: () => billing.fetchDiscounts(client, academyId ?? ''),
    enabled: !!academyId,
  });
}

export function useInvoices(
  filter: { academyId: string; status?: string; studentId?: string } | undefined,
) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['invoices', filter?.academyId ?? '', filter?.status ?? '', filter?.studentId ?? ''],
    queryFn: () => billing.fetchInvoices(client, filter ?? { academyId: '' }),
    enabled: !!filter?.academyId,
  });
}

export function useInvoice(id: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['invoice', id ?? ''],
    queryFn: () => billing.fetchInvoice(client, id ?? ''),
    enabled: !!id,
  });
}

export function usePublicInvoice(token: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['public-invoice', token ?? ''],
    queryFn: () => billing.fetchPublicInvoice(client, token ?? ''),
    enabled: !!token,
  });
}

export function useBillingMutations(academyId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  const refresh =
    (...keys: string[]) =>
    () => {
      for (const k of keys) void qc.invalidateQueries({ queryKey: [k] });
    };
  return {
    saveSettings: useMutation({
      mutationFn: (input: Omit<billing.BillingSettingsInput, 'academyId'>) =>
        billing.saveBilling(client, { ...input, academyId }),
      onSuccess: refresh('billing'),
    }),
    savePlan: useMutation({
      mutationFn: (input: Omit<Parameters<typeof billing.savePlan>[1], 'academyId'>) =>
        billing.savePlan(client, { ...input, academyId }),
      onSuccess: refresh('plans'),
    }),
    setPlanActive: useMutation({
      mutationFn: (v: { id: string; active: boolean }) =>
        billing.setPlanActive(client, v.id, v.active),
      onSuccess: refresh('plans'),
    }),
    deletePlan: useMutation({
      mutationFn: (id: string) => billing.deletePlan(client, id),
      onSuccess: refresh('plans', 'discounts'),
    }),
    saveDiscount: useMutation({
      mutationFn: (input: Omit<Parameters<typeof billing.saveDiscount>[1], 'academyId'>) =>
        billing.saveDiscount(client, { ...input, academyId }),
      onSuccess: refresh('discounts'),
    }),
    setDiscountActive: useMutation({
      mutationFn: (v: { id: string; active: boolean }) =>
        billing.setDiscountActive(client, v.id, v.active),
      onSuccess: refresh('discounts'),
    }),
    deleteDiscount: useMutation({
      mutationFn: (id: string) => billing.deleteDiscount(client, id),
      onSuccess: refresh('discounts'),
    }),
    createInvoice: useMutation({
      mutationFn: (input: Omit<billing.CreateInvoiceInput, 'academyId'>) =>
        billing.createInvoice(client, { ...input, academyId }),
      onSuccess: refresh('invoices', 'discounts', 'billing'),
    }),
    recordPayment: useMutation({
      mutationFn: (input: Parameters<typeof billing.recordPayment>[1]) =>
        billing.recordPayment(client, input),
      onSuccess: refresh('invoices', 'invoice', 'public-invoice'),
    }),
    voidInvoice: useMutation({
      mutationFn: (id: string) => billing.voidInvoice(client, id),
      onSuccess: refresh('invoices', 'invoice', 'discounts', 'public-invoice'),
    }),
  };
}

/** Thông báo của tôi; tự làm mới khi có thông báo mới trên kênh riêng. */
export function useMyNotifications(
  userId: string | undefined,
  opts: { academyId?: string; limit?: number } = {},
) {
  const client = useErpClient();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['notifications', userId ?? '', opts.academyId ?? '', opts.limit ?? 30],
    queryFn: () => notifications.fetchMyNotifications(client, userId ?? '', opts),
    enabled: !!userId,
  });
  useEffect(() => {
    if (!userId) return;
    return notifications.subscribeNotifications(client, userId, () => {
      void qc.invalidateQueries({ queryKey: ['notifications', userId] });
    });
  }, [client, qc, userId]);
  return query;
}

export function useMarkNotificationsRead(userId: string | undefined) {
  const client = useErpClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { ids?: string[]; academyId?: string }) =>
      notifications.markNotificationsRead(client, opts),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications', userId ?? ''] }),
  });
}

export function useNotificationLog(academyId: string | undefined, category?: string) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['notification-log', academyId ?? '', category ?? ''],
    queryFn: () => notifications.fetchNotificationLog(client, academyId ?? '', { category }),
    enabled: !!academyId,
  });
}

export function useNotificationStats(academyId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['notification-stats', academyId ?? ''],
    queryFn: () => notifications.fetchNotificationStats(client, academyId ?? ''),
    enabled: !!academyId,
  });
}

export function useNotificationSettings(academyId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['notification-settings', academyId ?? ''],
    queryFn: () => notifications.fetchNotificationSettings(client, academyId ?? ''),
    enabled: !!academyId,
  });
}

export function useReminderRule(academyId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['reminder-rule', academyId ?? ''],
    queryFn: () => notifications.fetchReminderRule(client, academyId ?? ''),
    enabled: !!academyId,
  });
}

export function useNotificationAdmin(academyId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  const refresh =
    (...keys: string[]) =>
    () => {
      for (const k of keys) void qc.invalidateQueries({ queryKey: [k, academyId] });
    };
  return {
    setEnabled: useMutation({
      mutationFn: (v: { category: notifications.NotificationCategory; enabled: boolean }) =>
        notifications.setNotificationEnabled(client, academyId, v.category, v.enabled),
      onSuccess: refresh('notification-settings'),
    }),
    saveRule: useMutation({
      mutationFn: (rule: notifications.ReminderRule) =>
        notifications.saveReminderRule(client, academyId, rule),
      onSuccess: refresh('reminder-rule'),
    }),
    runNow: useMutation({
      mutationFn: () => notifications.runFeeRemindersNow(client, academyId),
      onSuccess: refresh('notification-log', 'notification-stats'),
    }),
  };
}

export function useLeads(academyId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['leads', academyId ?? ''],
    queryFn: () => leads.fetchLeads(client, academyId ?? ''),
    enabled: !!academyId,
  });
}

export function useLeadMutations(academyId: string, userId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: ['leads', academyId] });
  return {
    create: useMutation({
      mutationFn: (input: Omit<leads.LeadInput, 'academyId'>) =>
        leads.createLead(client, userId, { ...input, academyId }),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: (v: { id: string; patch: Parameters<typeof leads.updateLead>[2] }) =>
        leads.updateLead(client, v.id, v.patch),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => leads.deleteLead(client, id),
      onSuccess: refresh,
    }),
    scheduleTrial: useMutation({
      mutationFn: (input: Parameters<typeof leads.scheduleTrial>[1]) =>
        leads.scheduleTrial(client, input),
      onSuccess: () => {
        refresh();
        void qc.invalidateQueries({ queryKey: classroomKeys.calendar(academyId) });
      },
    }),
    setEnabled: useMutation({
      mutationFn: (enabled: boolean) => leads.setLeadsEnabled(client, academyId, enabled),
      onSuccess: () => void qc.invalidateQueries({ queryKey: ['academies'] }),
    }),
  };
}

/** Danh sách hội thoại; tự làm mới định kỳ để cập nhật số chưa đọc. */
export function useConversations(academyId: string | undefined) {
  const client = useErpClient();
  return useQuery({
    queryKey: ['conversations', academyId ?? ''],
    queryFn: () => chat.fetchConversations(client, academyId ?? ''),
    enabled: !!academyId,
    refetchInterval: 15_000,
  });
}

/** Tin nhắn của một hội thoại; nghe realtime và đánh dấu đã đọc khi có tin mới. */
export function useChatMessages(conversationId: string | undefined, academyId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['chat-messages', conversationId ?? ''],
    queryFn: () => chat.fetchMessages(client, conversationId ?? ''),
    enabled: !!conversationId,
  });
  useEffect(() => {
    if (!conversationId) return;
    void chat
      .markConversationRead(client, conversationId)
      .then(() => qc.invalidateQueries({ queryKey: ['conversations', academyId] }));
    return chat.subscribeConversation(client, conversationId, (m) => {
      qc.setQueryData<chat.ChatMessage[]>(['chat-messages', conversationId], (old) =>
        old?.some((x) => x.id === m.id) ? old : [...(old ?? []), m],
      );
      void chat.markConversationRead(client, conversationId);
      void qc.invalidateQueries({ queryKey: ['conversations', academyId] });
    });
  }, [client, qc, conversationId, academyId]);
  return query;
}

export function useChatMutations(academyId: string, userId: string) {
  const client = useErpClient();
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: ['conversations', academyId] });
  return {
    send: useMutation({
      mutationFn: (v: { conversationId: string; body: string }) =>
        chat.sendMessage(client, { ...v, senderId: userId }),
      onSuccess: (_d, v) => {
        void qc.invalidateQueries({ queryKey: ['chat-messages', v.conversationId] });
        refresh();
      },
    }),
    openGroup: useMutation({
      mutationFn: (groupId: string) => chat.openGroupChat(client, groupId),
      onSuccess: refresh,
    }),
    openDirect: useMutation({
      mutationFn: (otherId: string) => chat.openDirectChat(client, academyId, otherId),
      onSuccess: refresh,
    }),
  };
}
