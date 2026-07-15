import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';

import { HasRoleDirective } from '@core/auth/has-role.directive';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSidenavModule,
    MatListModule,
    MatDividerModule,
    HasRoleDirective,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.currentUser;
  readonly sidenavOpen = signal(true);

  toggleSidenav(): void {
    this.sidenavOpen.update((open) => !open);
  }

  onProfileAction(action: string): void {
    if (action === 'perfil') {
      void this.router.navigate(['/mi-perfil']);
      return;
    }
    console.warn(`Not implemented yet: ${action}`);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
