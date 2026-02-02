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
```
pnpm dev
```

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