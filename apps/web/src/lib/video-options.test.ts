import { VideoPresets } from 'livekit-client';
import { describe, expect, it } from 'vitest';
import { roomOptionsFor } from './video-options';

describe('roomOptionsFor', () => {
  it('ưu tiên hiệu năng: simulcast 720p', () => {
    const o = roomOptionsFor('performance');
    expect(o.publishDefaults?.simulcast).toBe(true);
    expect(o.videoCaptureDefaults?.resolution).toEqual(VideoPresets.h720.resolution);
  });
  it('chuẩn (mạng kém): 360p, tắt simulcast', () => {
    const o = roomOptionsFor('standard');
    expect(o.publishDefaults?.simulcast).toBe(false);
    expect(o.videoCaptureDefaults?.resolution).toEqual(VideoPresets.h360.resolution);
  });
  it('không video: không đặt độ phân giải', () => {
    expect(roomOptionsFor('none').videoCaptureDefaults).toBeUndefined();
  });
});
