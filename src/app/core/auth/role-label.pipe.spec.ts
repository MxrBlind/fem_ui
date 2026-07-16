import { RoleLabelPipe } from './role-label.pipe';

describe('RoleLabelPipe', () => {
  const pipe = new RoleLabelPipe();

  it('maps admin to "Administrador"', () => {
    expect(pipe.transform('admin')).toBe('Administrador');
  });

  it('maps teacher to "Maestro"', () => {
    expect(pipe.transform('teacher')).toBe('Maestro');
  });

  it('maps student to "Estudiante"', () => {
    expect(pipe.transform('student')).toBe('Estudiante');
  });

  it('maps principal to "Director"', () => {
    expect(pipe.transform('principal')).toBe('Director');
  });

  it('returns empty string for null or undefined', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });
});
