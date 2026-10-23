import '@livekit/components-styles';
import { useSilenceParticipant, useVideoToken } from '@erpchess/api/react';
import {
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useLocalParticipant,
  useParticipants,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useState } from 'react';
import { useT } from '../../lib/use-t';
import { roomOptionsFor } from '../../lib/video-options';
import { Button, Card, ErrorText } from '../ui';

/**
 * Video/âm thanh của lớp (LiveKit). Tải lười trong phòng học: chỉ nạp thư viện khi người dùng
 * bấm bật video. Máy chủ chưa có khoá LiveKit thì báo "chưa cấu hình", bàn cờ/chat vẫn chạy.
 */
export default function VideoPanel({ classroomId }: { classroomId: string }) {
  const { t } = useT();
  const token = useVideoToken(classroomId);
  const [left, setLeft] = useState(false);

  if (token.isPending)
    return <p className="text-sm text-text-muted">{t('classroom.videoConnecting')}</p>;
  if (token.error) {
    const code = (token.error as { code?: string }).code;
    return code === 'video_not_configured' ? (
      <p className="text-sm text-text-muted">{t('classroom.videoNotConfigured')}</p>
    ) : (
      <ErrorText error={token.error} />
    );
  }
  if (left) return <p className="text-sm text-text-muted">{t('classroom.videoLeft')}</p>;
  const { mode, runner } = token.data;

  return (
    <LiveKitRoom
      serverUrl={token.data.url}
      token={token.data.token}
      connect
      audio
      video={mode !== 'none'}
      options={roomOptionsFor(mode)}
      onDisconnected={() => setLeft(true)}
      data-lk-theme="default"
      className="flex flex-col gap-2 overflow-hidden rounded-lg"
    >
      <Tiles audioOnly={mode === 'none'} />
      <RoomAudioRenderer />
      <ControlBar
        variation="minimal"
        controls={{
          camera: mode !== 'none',
          microphone: true,
          screenShare: runner,
          chat: false,
          leave: true,
        }}
      />
      {runner && <Moderation classroomId={classroomId} />}
    </LiveKitRoom>
  );
}

function Tiles({ audioOnly }: { audioOnly: boolean }) {
  const tracks = useTracks(
    audioOnly
      ? [{ source: Track.Source.Microphone, withPlaceholder: true }]
      : [
          { source: Track.Source.Camera, withPlaceholder: true },
          { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
    { onlySubscribed: false },
  );
  return (
    <GridLayout tracks={tracks} style={{ height: audioOnly ? 120 : 260 }}>
      <ParticipantTile />
    </GridLayout>
  );
}

/** HLV tắt/mở quyền phát của từng người (qua Edge Function, cần quyền quản trị phòng). */
function Moderation({ classroomId }: { classroomId: string }) {
  const { t } = useT();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const silence = useSilenceParticipant(classroomId);
  const [silenced, setSilenced] = useState<Set<string>>(new Set());
  const others = participants.filter((p) => p.identity !== localParticipant.identity);
  if (others.length === 0) return null;
  return (
    <Card title={t('classroom.videoPeople')}>
      <ul className="flex flex-col gap-1 text-sm">
        {others.map((p) => {
          const off = silenced.has(p.identity);
          return (
            <li key={p.identity} className="flex items-center justify-between gap-2">
              <span>{p.name || p.identity}</span>
              <Button
                variant="ghost"
                className="px-2 py-1 text-xs"
                disabled={silence.isPending}
                onClick={() =>
                  silence.mutate(
                    { identity: p.identity, on: !off },
                    {
                      onSuccess: () =>
                        setSilenced((s) => {
                          const next = new Set(s);
                          if (off) next.delete(p.identity);
                          else next.add(p.identity);
                          return next;
                        }),
                    },
                  )
                }
              >
                {off ? t('classroom.unsilence') : t('classroom.silence')}
              </Button>
            </li>
          );
        })}
      </ul>
      <ErrorText error={silence.error} />
    </Card>
  );
}
