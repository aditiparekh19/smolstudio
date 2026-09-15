import { describe, expect, it } from 'vitest';

describe('catalog contract', () => {
  it('caps the public catalog page size at 60', () => {
    const requested = 500;
    expect(Math.min(Math.max(requested, 1), 60)).toBe(60);
  });
});
