import { FormControl } from '@angular/forms';

import { notBlank } from './not-blank.validator';

describe('notBlank', () => {
  it.each(['', ' ', '   ', '\t\n '])('rejects %j as blank', (value) => {
    expect(notBlank(new FormControl(value, { nonNullable: true }))).toEqual({ blank: true });
  });

  it.each(['a', '  a  ', 'alumnos con beca'])('accepts %j', (value) => {
    expect(notBlank(new FormControl(value, { nonNullable: true }))).toBeNull();
  });
});
