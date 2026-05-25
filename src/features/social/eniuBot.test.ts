import { describe, expect, it } from 'vitest';

import { mentionsEniu } from './eniuBot';

describe('mentionsEniu', () => {
  it('detects @Eniu case-insensitively', () => {
    expect(mentionsEniu('@Eniu dawaj typ')).toBe(true);
    expect(mentionsEniu('co myślisz @eniu?')).toBe(true);
    expect(mentionsEniu('hej @ENIU')).toBe(true);
  });

  it('requires a real mention boundary', () => {
    expect(mentionsEniu('bez eniu')).toBe(false);
    expect(mentionsEniu('@eniubukmacher')).toBe(false);
    expect(mentionsEniu('mail@eniu.pl')).toBe(false);
    expect(mentionsEniu('@eniu_test')).toBe(false);
  });
});
