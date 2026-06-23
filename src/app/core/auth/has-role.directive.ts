import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';

import { AuthService } from '../services/auth.service';
import { Role } from './rbac';

/**
 * Structural directive: renders its template only when the current user holds
 * the given role (string form) or any of the given roles (array form).
 *
 * Tolerates a null currentUser (renders nothing, never throws) so it can
 * appear on routes rendered while unauthenticated (e.g. /login).
 *
 * Examples:
 *   <button *hasRole="'admin'">Delete</button>
 *   <a *hasRole="['admin','teacher']" routerLink="/courses">Courses</a>
 */
@Directive({
  selector: '[hasRole]',
  standalone: true
})
export class HasRoleDirective {
  private readonly auth = inject(AuthService);
  private readonly template = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);

  private readonly required = signal<readonly Role[]>([]);
  private rendered = false;

  @Input({ required: true })
  set hasRole(value: Role | readonly Role[]) {
    this.required.set(Array.isArray(value) ? value : [value as Role]);
  }

  private readonly shouldRender = computed(() => {
    const required = this.required();
    if (required.length === 0) return false;
    const current = this.auth.currentUser()?.role;
    if (!current) return false;
    return required.includes(current);
  });

  constructor() {
    effect(() => {
      const show = this.shouldRender();
      if (show && !this.rendered) {
        this.viewContainer.createEmbeddedView(this.template);
        this.rendered = true;
      } else if (!show && this.rendered) {
        this.viewContainer.clear();
        this.rendered = false;
      }
    });
  }
}
