import { describe, expect, it } from 'vitest';
import { Route } from '../routes/__root';
import { NotFound } from './NotFound';

describe('route gốc', () => {
  it('dùng trang 404 riêng làm notFoundComponent', () => {
    expect(Route.options.notFoundComponent).toBe(NotFound);
  });
});
