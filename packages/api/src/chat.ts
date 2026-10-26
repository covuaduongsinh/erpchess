/** Chat theo Group/Batch và nhắn riêng với staff (Giai đoạn 12c). */
import type { ErpClient } from './client';
import type { Tables } from './database.types';
import { unwrap } from './queries';

export type Conversation = {
  id: string;
  kind: 'group' | 'direct';
  group_id: string | null;
  group_name: string | null;
  group_kind: 'group' | 'batch' | null;
  other_id: string | null;
  other_name: string | null;
  other_role: string | null;
  last_body: string | null;
  last_message_at: string | null;
  unread: number;
};
export type ChatMessage = Tables<'messages'>;

export async function fetchConversations(
  client: ErpClient,
  academyId: string,
): Promise<Conversation[]> {
  return unwrap(await client.rpc('my_conversations', { p_academy: academyId })) as Conversation[];
}

/** Tin nhắn mới nhất trước khi đảo lại để hiển thị từ cũ đến mới. */
export async function fetchMessages(
  client: ErpClient,
  conversationId: string,
  limit = 100,
): Promise<ChatMessage[]> {
  const rows = unwrap(
    await client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit),
  );
  return rows.reverse();
}

export async function sendMessage(
  client: ErpClient,
  input: { conversationId: string; senderId: string; body: string },
): Promise<void> {
  const body = input.body.trim();
  if (!body) return;
  unwrap(
    await client
      .from('messages')
      .insert({
        conversation_id: input.conversationId,
        sender_id: input.senderId,
        body: body.slice(0, 2000),
      }),
  );
}

export async function openGroupChat(client: ErpClient, groupId: string): Promise<string> {
  return unwrap(await client.rpc('open_group_chat', { p_group: groupId }));
}

export async function openDirectChat(
  client: ErpClient,
  academyId: string,
  userId: string,
): Promise<string> {
  return unwrap(await client.rpc('open_direct_chat', { p_academy: academyId, p_user: userId }));
}

export async function markConversationRead(
  client: ErpClient,
  conversationId: string,
): Promise<void> {
  unwrap(await client.rpc('mark_conversation_read', { p_conversation: conversationId }));
}

/** Nghe tin mới trên kênh riêng `chat:<id>`. */
export function subscribeConversation(
  client: ErpClient,
  conversationId: string,
  onMessage: (m: ChatMessage) => void,
) {
  const channel = client
    .channel(`chat:${conversationId}`, { config: { private: true } })
    .on('broadcast', { event: 'message' }, (msg) => onMessage(msg.payload as ChatMessage))
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
