import { describe, expect, it } from 'vitest';
import { videoEmbed } from './video';

describe('videoEmbed', () => {
  it('YouTube các dạng link', () => {
    const src = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ';
    expect(videoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toEqual({
      kind: 'youtube',
      src,
    });
    expect(videoEmbed('https://youtu.be/dQw4w9WgXcQ')).toEqual({ kind: 'youtube', src });
    expect(videoEmbed('https://m.youtube.com/shorts/dQw4w9WgXcQ')).toEqual({
      kind: 'youtube',
      src,
    });
  });

  it('Vimeo và tệp', () => {
    expect(videoEmbed('https://vimeo.com/123456789')).toEqual({
      kind: 'vimeo',
      src: 'https://player.vimeo.com/video/123456789',
    });
    expect(videoEmbed('https://cdn.example.com/bai-1.mp4')?.kind).toBe('file');
  });

  it('từ chối http, javascript: và id lạ', () => {
    expect(videoEmbed('http://youtu.be/dQw4w9WgXcQ')).toBeNull();
    expect(videoEmbed('javascript:alert(1)')).toBeNull();
    expect(videoEmbed('https://youtube.com/watch?v=<script>')).toBeNull();
    expect(videoEmbed('không phải link')).toBeNull();
  });
});
