import { type RoomOptions, VideoPresets } from 'livekit-client';

export type VideoMode = 'performance' | 'standard' | 'none';

/**
 * Ba chế độ video của lớp:
 * - performance (mặc định): simulcast + dynacast, 720p — người xem nhận lớp chất lượng hợp mạng.
 * - standard (mạng kém): 360p, không simulcast — ít băng thông lên.
 * - none: chỉ âm thanh.
 */
export function roomOptionsFor(mode: VideoMode): RoomOptions {
  if (mode === 'standard') {
    return {
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: { simulcast: false, videoEncoding: VideoPresets.h360.encoding },
      videoCaptureDefaults: { resolution: VideoPresets.h360.resolution },
    };
  }
  if (mode === 'none') return { adaptiveStream: true, dynacast: true };
  return {
    adaptiveStream: true,
    dynacast: true,
    publishDefaults: { simulcast: true },
    videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
  };
}
