import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-grades',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h1>Calificaciones</h1>`,
})
export class GradesComponent {}
