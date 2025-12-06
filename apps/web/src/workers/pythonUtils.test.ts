import { describe, it, expect } from 'vitest';
import { cleanStderr, formatResultLine } from './pythonUtils';

describe('python utils', () => {
  it('cleans exec prefixes and blank stderr lines', () => {
    const raw = 'exec>:16: FutureWarning: something\n\n  exec>:1: other\n';
    expect(cleanStderr(raw)).toBe('FutureWarning: something\nother');
  });

  it('omits undefined payloads when formatting result lines', () => {
    expect(formatResultLine({ value: 'undefined' })).toBeNull();
    expect(formatResultLine(undefined)).toBeNull();
    expect(formatResultLine({ columns: ['a'], rows: [[1]] })).toBe(
      '{"columns":["a"],"rows":[[1]]}',
    );
  });
});
