import { Pipe, PipeTransform } from '@angular/core';

import { Role } from './rbac';

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  teacher: 'Maestro',
  student: 'Estudiante',
  principal: 'Director'
};

@Pipe({ name: 'roleLabel', standalone: true, pure: true })
export class RoleLabelPipe implements PipeTransform {
  transform(role: Role | null | undefined): string {
    return role ? (ROLE_LABELS[role] ?? '') : '';
  }
}
