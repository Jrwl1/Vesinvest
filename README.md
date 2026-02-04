# SaaS Monorepo

This is a monorepo setup for a SaaS product using PNPM workspaces. The project consists of two main applications: an API built with NestJS and a web application built with React and Vite. Additionally, it includes shared packages for domain types and configuration.

## Project Structure

```
saas-monorepo
├── apps
│   ├── api          # NestJS API application
│   └── web          # React web application
├── packages
│   ├── domain       # Shared types and schemas
│   └── config       # Shared ESLint, Prettier, and TypeScript configurations
├── pnpm-workspace.yaml
├── package.json     # Root package.json
├── tsconfig.json    # Root TypeScript configuration
├── .nvmrc           # Node.js version
├── .editorconfig    # Editor configuration
├── .gitignore       # Git ignore file
└── README.md        # Project documentation
```

## Getting Started

### Prerequisites

- Node.js 20+ (use `.nvmrc` to set the version)
- PNPM (install via npm: `npm install -g pnpm`)

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd saas-monorepo
   ```

2. Install dependencies:
   ```
   pnpm install
   ```

### Development

To start development for both applications, run:

**PowerShell / CMD:**
```powershell
pnpm dev
```

**Bash:**
```bash
pnpm dev
```

**Demo mode (local):** In development, demo mode is **on by default**: the API exposes `GET /demo/status` and `POST /auth/demo-login`, and the web app can use "Use Demo" to sign in without credentials. To turn demo off locally, set `DEMO_MODE=false` in `apps/api/.env`. In production (`NODE_ENV=production`), demo is always off unless you explicitly enable it (not recommended).

**CORS (local dev):** The API allows these origins in development: `http://localhost:5173`, `http://localhost:5174`, `http://127.0.0.1:5173`, `http://127.0.0.1:5174`, `http://localhost:3000`. OPTIONS preflight is handled for all routes (e.g. `/auth/demo-login`, `/imports/upload`). If you use another port, add it via `CORS_ORIGINS` in `apps/api/.env`. In production only `CORS_ORIGINS` is used (no wildcard).

### Building

To build the applications, run:
```
pnpm build
```

### Linting

To lint the code, run:
```
pnpm lint
```

### Type Checking

To check TypeScript types, run:
```
pnpm typecheck
```

### Testing

To run tests, use:
```
pnpm test
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.