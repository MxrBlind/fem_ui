import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';

import { HasRoleDirective } from '@core/auth/has-role.directive';
import { RoleLabelPipe } from '@core/auth/role-label.pipe';
import { AuthService } from '@core/services/auth.service';
import { EnrollmentAnnouncementService } from '@features/self-enrollment/services/enrollment-announcement.service';

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
    RoleLabelPipe,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly enrollmentAnnouncement = inject(EnrollmentAnnouncementService);
  private readonly destroyRef = inject(DestroyRef);

  readonly user = this.auth.currentUser;
  readonly sidenavOpen = signal(true);

  readonly initial = computed(() => {
    const u = this.user();
    const source = u?.name ?? u?.username ?? '';
    return source.charAt(0).toUpperCase();
  });

  readonly fullName = computed(() => {
    const u = this.user();
    if (!u) return '';
    if (u.name && u.parentLastName) return `${u.name} ${u.parentLastName}`;
    if (u.name) return u.name;
    return u.username;
  });

  // The shell is created once per authenticated entry (login or restored
  // session), so the announcement check runs once per entry.
  ngOnInit(): void {
    this.enrollmentAnnouncement.checkAndAnnounce(this.destroyRef);
  }

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
