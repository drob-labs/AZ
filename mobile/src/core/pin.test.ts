import { describe, expect, it } from 'vitest';
import { generatePin, isValidPersonnelNo, isWeakPin } from './pin';

describe('PIN', () => {
  it('refuzon PIN-et e dobëta', () => {
    for (const p of ['111111', '000000', '123456', '654321', '234567', '987654', '121212', '12345', '1234567', 'abcdef']) {
      expect(isWeakPin(p)).toBe(true);
    }
  });

  it('pranon PIN të rregullt', () => {
    for (const p of ['482915', '703168', '910274']) expect(isWeakPin(p)).toBe(false);
  });

  it('gjeneron gjithmonë PIN 6-shifror jo të dobët', () => {
    let seed = 1;
    const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0);
    for (let i = 0; i < 500; i++) {
      const p = generatePin(rand);
      expect(p).toMatch(/^\d{6}$/);
      expect(isWeakPin(p)).toBe(false);
    }
  });

  it('nëse rand jep vetëm PIN të dobët, kthen rezervën e sigurt', () => {
    expect(isWeakPin(generatePin(() => 111111))).toBe(false);
  });

  it('numri personal', () => {
    expect(isValidPersonnelNo('1001')).toBe(true);
    expect(isValidPersonnelNo('AZ-1')).toBe(false);
    expect(isValidPersonnelNo('')).toBe(false);
    expect(isValidPersonnelNo('1234567890123')).toBe(false);
  });
});
