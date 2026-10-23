// Video lớp học trực tuyến qua LiveKit (Giai đoạn 8c).
//   { classroomId }                         → { token, url, mode, runner } để vào phòng video
//   { classroomId, silence: identity, on }  → HLV tắt/mở quyền phát âm thanh-hình của một người
// Người xem được lớp (RLS trên `classrooms`) mới nhận token. HLV phụ trách / owner có quyền quản trị
// phòng. Chế độ "none" chỉ cho phát micro. Thiếu secret LIVEKIT_* → 503 video_not_configured.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { AccessToken, RoomServiceClient, TrackSource } from 'npm:livekit-server-sdk@2.19.1';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json(401, { error: 'unauthorized' });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid_json' });
  }
  const classroomId =
    typeof body.classroomId === 'string' && UUID_RE.test(body.classroomId)
      ? body.classroomId
      : null;
  if (!classroomId) return json(400, { error: 'invalid_input' });

  const caller = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return json(401, { error: 'unauthorized' });
  const uid = userData.user.id;

  // RLS: chỉ người xem được lớp mới đọc được dòng này
  const { data: room } = await caller
    .from('classrooms')
    .select('id, academy_id, kind, video_mode, coach_id, created_by, ended_at')
    .eq('id', classroomId)
    .maybeSingle();
  if (!room) return json(403, { error: 'forbidden' });
  if (room.kind !== 'online') return json(400, { error: 'not_online' });
  if (room.ended_at) return json(403, { error: 'class_ended' });

  const { data: membership } = await caller
    .from('memberships')
    .select('role')
    .eq('academy_id', room.academy_id)
    .eq('user_id', uid)
    .maybeSingle();
  const role = membership?.role;
  const runner =
    role === 'owner' || (role === 'coach' && (room.coach_id === uid || room.created_by === uid));

  const url = Deno.env.get('LIVEKIT_URL') ?? '';
  const apiKey = Deno.env.get('LIVEKIT_API_KEY') ?? '';
  const apiSecret = Deno.env.get('LIVEKIT_API_SECRET') ?? '';
  if (!url || !apiKey || !apiSecret) return json(503, { error: 'video_not_configured' });
  const roomName = `classroom-${classroomId}`;

  if (typeof body.silence === 'string') {
    if (!runner) return json(403, { error: 'forbidden' });
    const service = new RoomServiceClient(url.replace(/^ws/, 'http'), apiKey, apiSecret);
    try {
      await service.updateParticipant(roomName, body.silence, undefined, {
        canPublish: body.on !== true,
        canSubscribe: true,
        canPublishData: false,
      });
    } catch {
      return json(404, { error: 'participant_not_found' });
    }
    return json(200, { ok: true });
  }

  const { data: profile } = await caller
    .from('profiles')
    .select('display_name')
    .eq('id', uid)
    .maybeSingle();
  const mode = String(room.video_mode);
  const token = new AccessToken(apiKey, apiSecret, {
    identity: uid,
    name: profile?.display_name ?? '',
    ttl: '3h',
  });
  token.addGrant({
    room: roomName,
    roomJoin: true,
    roomAdmin: runner,
    canSubscribe: true,
    canPublish: true,
    canPublishData: false,
    canPublishSources:
      mode === 'none'
        ? [TrackSource.MICROPHONE]
        : runner
          ? [
              TrackSource.CAMERA,
              TrackSource.MICROPHONE,
              TrackSource.SCREEN_SHARE,
              TrackSource.SCREEN_SHARE_AUDIO,
            ]
          : [TrackSource.CAMERA, TrackSource.MICROPHONE],
  });
  return json(200, { token: await token.toJwt(), url, mode, runner });
});
