import { describe, it, expect } from 'vitest';
import { centsToUsd, validateFloat } from '../listings';

describe('centsToUsd', () => {
  it('converts cents to USD', () => {
    expect(centsToUsd(2850)).toBe(28.5);
  });

  it('handles zero', () => {
    expect(centsToUsd(0)).toBe(0);
  });

  it('handles single cent', () => {
    expect(centsToUsd(1)).toBe(0.01);
  });

  it('handles large values', () => {
    expect(centsToUsd(1234567)).toBe(12345.67);
  });

  it('rounds floating point artifacts', () => {
    expect(centsToUsd(999)).toBe(9.99);
  });
});

describe('validateFloat', () => {
  it('accepts 0.0', () => {
    expect(validateFloat(0.0)).toBe(true);
  });

  it('accepts 0.15', () => {
    expect(validateFloat(0.15)).toBe(true);
  });

  it('accepts 1.0', () => {
    expect(validateFloat(1.0)).toBe(true);
  });

  it('rejects 1.5', () => {
    expect(validateFloat(1.5)).toBe(false);
  });

  it('rejects -0.1', () => {
    expect(validateFloat(-0.1)).toBe(false);
  });
});
