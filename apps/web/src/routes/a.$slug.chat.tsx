import type { Conversation } from '@erpchess/api';
import {
  useChatMessages,
  useChatMutations,
  useConversations,
  useGroups,
  useMembers,
} from '@erpchess/api/react';
import { isStaff } from '@erpchess/domain';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { ChatMessageBody, useChatPreview } from '../components/chat/ChatMessageBody';
import { Button, Card, ErrorText, Spinner } from '../components/ui';
import { useAcademy } from '../lib/academy-context';
import { formatDateTime } from '../lib/format';
import { useT } from '../lib/use-t';

type Filter = '' | 'unread' | 'group' | 'batch' | 'coach' | 'student';

export const Route = createFileRoute('/a/$slug/chat')({
  validateSearch: (s: Record<string, unknown>): { c?: string } =>
    typeof s.c === 'string' && /^[0-9a-f-]{36}$/.test(s.c) ? { c: s.c } : {},
  component: ChatPage,
});

function conversationTitle(c: Conversation): string {
  return (c.kind === 'group' ? c.group_name : c.other_name) ?? '—';
}

function ChatPage() {
  const { t } = useT();
  const { academy } = useAcademy();
  const { c: selected } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const list = useConversations(academy.id);
  const preview = useChatPreview();
  const [filter, setFilter] = useState<Filter>('');
  const [q, setQ] = useState('');

  const select = (id: string) => void navigate({ search: { c: id } });
  const s = q.trim().toLowerCase();
  const rows = (list.data ?? []).filter((c) => {
    if (s && !conversationTitle(c).toLowerCase().includes(s)) return false;
    switch (filter) {
      case 'unread':
        return c.unread > 0;
      case 'group':
        return c.kind === 'group' && c.group_kind !== 'batch';
      case 'batch':
        return c.kind === 'group' && c.group_kind === 'batch';
      case 'coach':
        return c.kind === 'direct' && (c.other_role === 'coach' || c.other_role === 'owner');
      case 'student':
        return c.kind === 'direct' && (c.other_role === 'student' || c.other_role === 'parent');
      default:
        return true;
    }
  });
  const current = list.data?.find((c) => c.id === selected);

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Card title={t('chat.title')}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('chat.search')}
            className="rounded-md border border-text-muted/30 bg-white px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-1">
            {(['', 'unread', 'group', 'batch', 'coach', 'student'] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className="rounded-full px-3 py-1 text-xs text-text-muted hover:bg-primary/10 aria-pressed:bg-primary aria-pressed:text-text-on-primary"
              >
                {t(`chat.filter_${f || 'all'}`)}
              </button>
            ))}
          </div>
          {list.isPending ? (
            <Spinner />
          ) : list.error ? (
            <ErrorText error={list.error} />
          ) : rows.length === 0 ? (
            <p className="text-sm text-text-muted">{t('chat.none')}</p>
          ) : (
            <ul className="-mx-2 flex flex-col">
              {rows.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => select(c.id)}
                    className={`flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-bg ${
                      c.id === selected ? 'bg-primary/10' : ''
                    }`}
                  >
                    <span className="text-lg">{c.kind === 'group' ? '👥' : '💬'}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{conversationTitle(c)}</span>
                      <span className="truncate text-xs text-text-muted">
                        {preview(c.last_body) ?? t('chat.empty')}
                      </span>
                    </span>
                    {c.unread > 0 && (
                      <span className="rounded-full bg-orange px-2 text-xs font-bold text-white">
                        {c.unread}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <NewChat onOpened={select} />
      </div>
      {current ? (
        <ChatPane conversation={current} />
      ) : (
        <Card>
          <p className="text-text-muted">{t('chat.pick')}</p>
        </Card>
      )}
    </div>
  );
}

function NewChat({ onOpened }: { onOpened: (id: string) => void }) {
  const { t } = useT();
  const { academy, session } = useAcademy();
  const staff = isStaff(academy.role);
  const groups = useGroups(staff ? academy.id : undefined);
  const members = useMembers(academy.id);
  const { openGroup, openDirect } = useChatMutations(academy.id, session.user.id);
  const others = (members.data ?? []).filter(
    (m) => m.profile.id !== session.user.id && (staff || isStaff(m.role)),
  );
  const select = 'rounded-md border border-text-muted/30 bg-white px-3 py-2 text-sm';

  return (
    <Card title={t('chat.new')}>
      {staff && (
        <select
          value=""
          onChange={(e) =>
            e.target.value && openGroup.mutate(e.target.value, { onSuccess: onOpened })
          }
          className={select}
          aria-label={t('chat.groupChat')}
        >
          <option value="">{t('chat.groupChat')}</option>
          {(groups.data ?? []).map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      )}
      <select
        value=""
        onChange={(e) =>
          e.target.value && openDirect.mutate(e.target.value, { onSuccess: onOpened })
        }
        className={select}
        aria-label={t('chat.directChat')}
      >
        <option value="">{t('chat.directChat')}</option>
        {others.map((m) => (
          <option key={m.profile.id} value={m.profile.id}>
            {m.profile.display_name || m.profile.username} · {t(`role.${m.role}`)}
          </option>
        ))}
      </select>
      {!staff && <p className="text-xs text-text-muted">{t('chat.studentHint')}</p>}
      <ErrorText error={openGroup.error ?? openDirect.error} />
    </Card>
  );
}

function ChatPane({ conversation }: { conversation: Conversation }) {
  const { t, i18n } = useT();
  const { academy, session } = useAcademy();
  const members = useMembers(academy.id);
  const messages = useChatMessages(conversation.id, academy.id);
  const { send } = useChatMutations(academy.id, session.user.id);
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const name = (id: string | null) => {
    const m = members.data?.find((x) => x.profile.id === id);
    return m ? m.profile.display_name || m.profile.username : '—';
  };
  const count = messages.data?.length ?? 0;

  // biome-ignore lint/correctness/useExhaustiveDependencies: cuộn xuống khi số tin đổi
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [count]);

  function submit() {
    if (!text.trim() || send.isPending) return;
    send.mutate({ conversationId: conversation.id, body: text }, { onSuccess: () => setText('') });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit();
  }

  // Enter gửi, Shift+Enter xuống dòng (để dán PGN nhiều dòng)
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <section className="flex h-[70vh] flex-col rounded-lg bg-white shadow-sm">
      <header className="border-b border-text-muted/15 px-5 py-3">
        <h2 className="font-bold text-primary">{conversationTitle(conversation)}</h2>
        <p className="text-xs text-text-muted">
          {conversation.kind === 'group'
            ? t(conversation.group_kind === 'batch' ? 'chat.batchChat' : 'chat.classChat')
            : t(`role.${(conversation.other_role ?? 'student') as 'student'}`)}
        </p>
      </header>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-5 py-4">
        {messages.isPending ? (
          <Spinner />
        ) : messages.error ? (
          <ErrorText error={messages.error} />
        ) : count === 0 ? (
          <p className="text-sm text-text-muted">{t('chat.empty')}</p>
        ) : (
          messages.data.map((m) => {
            const mine = m.sender_id === session.user.id;
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                {!mine && conversation.kind === 'group' && (
                  <span className="text-xs text-text-muted">{name(m.sender_id)}</span>
                )}
                <ChatMessageBody
                  body={m.body}
                  mine={mine}
                  onOpen={(share) =>
                    void navigate({
                      to: '/analysis',
                      search: share.kind === 'fen' ? { fen: share.fen } : { pgn: share.pgn },
                    })
                  }
                />
                <span className="text-[10px] text-text-muted">
                  {formatDateTime(m.created_at, i18n.language)}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottom} />
      </div>
      <form onSubmit={onSubmit} className="flex gap-2 border-t border-text-muted/15 p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={2000}
          rows={text.includes('\n') ? 4 : 1}
          placeholder={t('chat.placeholder')}
          aria-label={t('chat.placeholder')}
          className="min-w-0 flex-1 resize-none rounded-md border border-text-muted/30 bg-white px-3 py-2"
        />
        <Button type="submit" disabled={send.isPending || !text.trim()}>
          {t('chat.send')}
        </Button>
      </form>
      <div className="px-3 pb-2">
        <p className="text-[11px] text-text-muted">{t('chat.shareHint')}</p>
        <ErrorText error={send.error} />
      </div>
    </section>
  );
}
