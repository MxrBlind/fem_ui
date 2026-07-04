# FEM Front

**FEM Front** is the Angular single-page admin application for the FEM school-management platform. It provides the web UI for administering academic cycles, courses, enrollments, and grades on top of the **FEM Admin API**, with JWT-based authentication and role-based access control (RBAC).

> Domain context: FEM manages an academic institution's curriculum and student participation — from subject catalogs down to individual student enrollments and grades — organized by academic cycle. See [`docs/data-model.md`](docs/data-model.md) for the full domain model.

---

## ✨ What this application does

- **Authentication** — username/password login against the API, JWT bearer tokens persisted client-side and attached automatically to every request via an HTTP interceptor.
- **Role-based navigation** — a single `User` acts as `admin`, `principal`, `teacher`, or `student` depending on context. The shell sidenav and routes are gated per role, and each role lands on its own home (`admin`/`principal` → dashboard, `teacher` → courses, `student` → grades).
- **Enrollment management** — list the current cycle's enrollments, create, edit (including grade capture), and delete enrollments, with confirmation dialogs and role-gated actions.
- **Academic structure** — courses, cycles, subjects, categories, and levels backed by the API's catalog endpoints.
- **Grades** — students can view their grades; grade reports and certificates are exposed by the API.

The authoritative REST contract for all of the above lives in [`docs/api-spec.yml`](docs/api-spec.yml) (OpenAPI 3.0, `FEM Admin API`).

---

## 🧱 Tech stack

| Area | Choice |
|---|---|
| Framework | **Angular 21** — standalone components, signals, lazy-loaded routes |
| Language | **TypeScript 5.9** (strict) |
| UI | **Angular Material 21** + **Angular CDK 21**, Material Design 3 tokens (`mat.theme()` in `src/styles.scss`), Material Symbols icons, Roboto typography |
| State / data | Angular **Signals** (preferred) + **RxJS 7**, `HttpClient` |
| Build | Angular CLI (`@angular/build:application`) |
| Unit tests | **Vitest** via `@angular/build:unit-test` (`ng test`) + `jsdom` |
| Formatting | **Prettier** |

> Do **not** introduce Bootstrap, Tailwind, or additional icon/CSS-utility packages — Material + CDK cover the UI. Style custom components with `--mat-sys-*` CSS variables, never hardcoded hex colors. Full conventions: [`docs/frontend-standards.md`](docs/frontend-standards.md).

---

## 📁 Project structure

```
fem-front/
├── src/
│   ├── app/
│   │   ├── core/                     # Singletons: auth, models, services
│   │   │   ├── auth/                 # Guards, HTTP interceptor, RBAC, hasRole directive, bootstrap
│   │   │   ├── models/
│   │   │   └── services/             # auth, user, course, cycle, enrollment, token-storage
│   │   ├── features/                 # Lazy-loaded feature areas
│   │   │   ├── auth/login/
│   │   │   ├── shell/                # Authenticated layout + child routes (sidenav, toolbar)
│   │   │   ├── dashboard/
│   │   │   ├── courses/
│   │   │   ├── grades/
│   │   │   └── enrollments/          # list, new, edit, delete-confirm, models
│   │   ├── app.config.ts             # Application providers
│   │   ├── app.routes.ts             # Root routes (login + authenticated shell)
│   │   └── app.ts / app.html         # Root component
│   ├── environments/                 # environment.ts / environment.prod.ts (apiBaseUrl)
│   └── styles.scss                   # Global M3 theme
├── docs/                             # Project standards & specifications (see below)
├── ai-specs/                         # AI agent roles & reusable skills
├── openspec/                         # Spec-driven change workflow (changes, specs, config)
└── angular.json / package.json / tsconfig*.json
```

**Routing** — `app.routes.ts` exposes `/login` and an authenticated shell at `''` (guarded by `authGuard`) that lazy-loads `shell.routes.ts`; unknown paths redirect to `/login`. Feature routes inside the shell are additionally gated by `roleGuard`.

---

## 🚀 Getting started

### Prerequisites

- **Node.js** 20.19+ (Angular 21 requirement)
- **npm** 11+
- A running instance of the **FEM Admin API** (default local URL `http://localhost:8080`; see `docs/api-spec.yml`)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environments
#    src/environments/environment.ts       -> { production: false, apiBaseUrl: 'http://localhost:8080' }
#    src/environments/environment.prod.ts  -> { production: true,  apiBaseUrl: '/api' }

# 3. Start the dev server (http://localhost:4200)
npm start
```

### Common scripts

| Command | Description |
|---|---|
| `npm start` | Run the dev server (`ng serve`) at `http://localhost:4200` |
| `npm run build` | Production build |
| `npm run watch` | Development build in watch mode |
| `npm test` | Run unit tests (Vitest via `ng test`) |

For step-by-step environment and testing details, see [`docs/development_guide.md`](docs/development_guide.md).

---

## 🔐 Authentication & authorization

- **Login flow** — `AuthService` posts credentials to the API; the returned JWT is stored via `TokenStorageService`. `auth-bootstrap.initializer` restores session state on app start.
- **Request auth** — `auth.interceptor` attaches `Authorization: Bearer <token>` to outgoing requests. Components never read tokens from `localStorage` directly.
- **Route protection** — `authGuard` protects the authenticated shell; `roleGuard` (with `data.roles`) matches feature routes to the user's role. Unauthorized users are redirected to their role home or to `/login`.
- **Template gating** — the `*hasRole` directive (`HasRoleDirective`) conditionally renders UI (e.g. sidenav links) for authorized roles only.
- **Role model** — logical roles `admin | principal | teacher | student` are normalized from backend `ROLE_*` values in `core/auth/rbac.ts`.

---

## 📖 Standards & documentation

All development follows the rules in [`docs/base-standards.md`](docs/base-standards.md) — the single source of truth. Key principles: small incremental changes, TDD, full type safety, clear naming, and **English-only** technical artifacts.

| Document | Purpose |
|---|---|
| [`docs/base-standards.md`](docs/base-standards.md) | Core development rules, planning-model requirements, symlink/OpenSpec policies |
| [`docs/frontend-standards.md`](docs/frontend-standards.md) | Angular architecture, components, UI/UX, testing, and coding conventions |
| [`docs/documentation-standards.md`](docs/documentation-standards.md) | Technical documentation structure and maintenance |
| [`docs/api-spec.yml`](docs/api-spec.yml) | Authoritative REST API contract (OpenAPI 3.0) |
| [`docs/data-model.md`](docs/data-model.md) | Domain entities, relationships, and ER diagram |
| [`docs/development_guide.md`](docs/development_guide.md) | Environment setup and testing instructions |
| [`docs/openspec-tasks-mandatory-steps.md`](docs/openspec-tasks-mandatory-steps.md) | Mandatory steps for OpenSpec `tasks.md` artifacts |

---

## 🤖 AI-assisted, spec-driven workflow

This repository is set up for AI-assisted development driven by [OpenSpec](https://github.com/Fission-AI/OpenSpec) and a set of portable agent roles and skills.

- **`ai-specs/agents/`** — role definitions the AI adopts for work (e.g. `frontend-developer.md`, `product-strategy-analyst.md`).
- **`ai-specs/skills/`** — reusable workflow prompts (`enrich-us`, `commit`, `code-auditing`, `writing-skills`, `using-git-worktrees`, `update-docs`, and more), mirrored into `.claude/` and `.cursor/` via relative symlinks so any copilot can discover them.
- **`openspec/`** — the change pipeline: `changes/` (in-flight proposals with `proposal.md`, `design.md`, `specs/`, `tasks.md`), `specs/` (accepted capability specs), and `config.yaml` (shared context pointing back at `docs/` and `ai-specs/`).
- **Copilot config** — `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, and `codex.md` all reference `docs/base-standards.md` so different AI tools stay consistent.

Typical change flow: `/enrich-us` (refine a ticket) → `/propose` (create change + artifacts) → `/apply` (implement tasks) → `/verify` → `/archive`.

---

## 📄 License

Copyright (c) 2025 LIDR.co. Licensed under the MIT License.

This project is part of the AI4Devs program by LIDR.co — learn more at [lidr.co/ia-devs](https://lidr.co/ia-devs).
