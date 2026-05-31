import { describe, expect, it } from 'vitest';
import { backendEnabled, resolveApiBaseUrl } from './config';

describe('resolveApiBaseUrl', () => {
  it('treats unset / empty / whitespace as "no backend"', () => {
    expect(resolveApiBaseUrl(undefined)).toBeNull();
    expect(resolveApiBaseUrl('')).toBeNull();
    expect(resolveApiBaseUrl('   ')).toBeNull();
  });

  it('normalises a configured origin (trims, strips trailing slashes)', () => {
    expect(resolveApiBaseUrl('http://localhost:8000')).toBe('http://localhost:8000');
    expect(resolveApiBaseUrl('http://localhost:8000/')).toBe('http://localhost:8000');
    expect(resolveApiBaseUrl('  https://api.example.com//  ')).toBe('https://api.example.com');
  });
});

describe('backendEnabled', () => {
  it('defaults to false — the public/static build never assumes a backend', () => {
    // No VITE_API_BASE_URL is set in the default build/test env. This guard
    // fails if anything makes the public deploy depend on a server.
    expect(backendEnabled).toBe(false);
  });
});
