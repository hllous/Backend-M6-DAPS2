import { BadRequestException } from '@nestjs/common';
import { ParseNumericIdPipe } from './numeric-id.pipe';

describe('ParseNumericIdPipe', () => {
  const pipe = new ParseNumericIdPipe();

  it('acepta un id numérico y quita ceros a la izquierda', () => {
    expect(pipe.transform('42')).toBe('42');
    expect(pipe.transform('007')).toBe('7');
    expect(pipe.transform('9007199254740993')).toBe('9007199254740993');
  });

  it.each(['', 'abc', '-1', '1.5', '1e3', ' 1', '123456789012345678901'])('rechaza %p', (v) => {
    expect(() => pipe.transform(v)).toThrow(BadRequestException);
  });
});
