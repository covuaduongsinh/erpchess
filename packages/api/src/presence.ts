/** Ai đang online trong học viện (Giai đoạn 9b): presence trên kênh riêng tư `academy:<id>:online`. */
import type { ErpClient } from './client';

export type OnlineMember = { userId: string; name: string; role: string };

/** Vào kênh presence của học viện; trả hàm rời kênh. `onChange` nhận danh sách người đang online. */
export function joinAcademyPresence(
  client: ErpClient,
  academyId: string,
  me: OnlineMember,
  onChange: (online: OnlineMember[]) => void,
): { ready: Promise<void>; leave: () => Promise<void> } {
  const channel = client.channel(`academy:${academyId}:online`, {
    config: { private: true, presence: { key: me.userId } },
  });
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState<OnlineMember>();
    onChange(
      Object.values(state).flatMap((list) =>
        list.slice(0, 1).map(({ userId, name, role }) => ({ userId, name, role })),
      ),
    );
  });
  const ready = new Promise<void>((resolve, reject) => {
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        void channel.track(me).then(() => resolve());
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reject(err ?? new Error(status));
      }
    });
  });
  return {
    ready,
    leave: async () => {
      await client.removeChannel(channel);
    },
  };
}
