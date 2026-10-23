import { describe, expect, it } from 'vitest';
import { detectPlatform } from './platform';

describe('detectPlatform', () => {
  it('nhận ra Tauri', () => {
    expect(detectPlatform({ __TAURI_INTERNALS__: {} })).toBe('desktop');
    expect(detectPlatform({})).toBe('web');
  });
});
