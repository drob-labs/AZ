import { describe, expect, it } from 'vitest';
import { formatAddress, isValidPostalCode, parseAddress } from './address';

describe('formatAddress', () => {
  it('rruga, kodi postar dhe qyteti', () => {
    expect(formatAddress({ street: 'Königstraße 1', postalCode: '70173', city: 'Stuttgart' })).toBe('Königstraße 1, 70173 Stuttgart');
  });
  it('anashkalon pjesët e zbrazëta', () => {
    expect(formatAddress({ street: '', postalCode: '70173', city: 'Stuttgart' })).toBe('70173 Stuttgart');
    expect(formatAddress({ street: 'Königstraße 1', postalCode: '', city: 'Stuttgart' })).toBe('Königstraße 1, Stuttgart');
    expect(formatAddress({ street: ' Königstraße 1 ', postalCode: '', city: '' })).toBe('Königstraße 1');
    expect(formatAddress({ street: '', postalCode: '', city: '' })).toBe('');
  });
});

describe('parseAddress', () => {
  it('ndan adresën e vjetër', () => {
    expect(parseAddress('Cingelfingelstrasse 10a, 70173 Stuttgart')).toEqual({
      street: 'Cingelfingelstrasse 10a',
      postalCode: '70173',
      city: 'Stuttgart',
    });
  });
  it('nëse formati nuk njihet, e ruan tekstin te rruga', () => {
    expect(parseAddress('Stuttgart Mitte')).toEqual({ street: 'Stuttgart Mitte', postalCode: '', city: '' });
  });
  it('bosh', () => {
    expect(parseAddress(null)).toEqual({ street: '', postalCode: '', city: '' });
  });
  it('formati dhe analizimi janë të kthyeshëm', () => {
    const parts = { street: 'Zeppelinstraße 5', postalCode: '71638', city: 'Ludwigsburg' };
    expect(parseAddress(formatAddress(parts))).toEqual(parts);
  });
});

describe('isValidPostalCode', () => {
  it('5 shifra ose bosh', () => {
    expect(isValidPostalCode('70173')).toBe(true);
    expect(isValidPostalCode('')).toBe(true);
    expect(isValidPostalCode('7017')).toBe(false);
    expect(isValidPostalCode('7017a')).toBe(false);
  });
});
