# Technology Stack

## Build System & Package Management

- **Package Manager**: pnpm (v10.14.0) with workspace configuration
- **Monorepo Structure**: Uses pnpm workspaces for multi-package management
- **TypeScript**: v5.9.3 with strict configuration and modern ES2022 target
- **Build Tool**: tsx for TypeScript execution with tsconfig-paths support

## Core Dependencies

- **AI/LLM**:
  - `@ai-sdk/deepseek` (v1.0.32) - DeepSeek AI integration
  - `ai` (v5.0.93) - AI SDK framework
  - `mem0ai` (v2.1.38) - Memory management system
- **Behavior Trees**: `mistreevous` (v4.3.1) - Behavior tree implementation
- **Database**: `mongoose` (v8.20.0) with MongoDB
- **Queue System**: `bullmq` (v5.66.2) with Redis (`ioredis` v5.8.2)
- **QQ Bot**: `node-napcat-ts` (v0.4.20) - QQ bot integration
- **Logging**: `winston` (v3.18.3) with daily rotate file support
- **Utilities**: `lodash-es`, `dayjs`, `zod` for validation

## Code Quality & Formatting

- **Linter/Formatter**: Biome (v2.3.5) - Modern replacement for ESLint/Prettier
  - 2-space indentation, 100 character line width
  - Recommended rules enabled
- **Testing**: Vitest (v4.0.13) with Vite (v7.2.4)

## Common Commands

### Development

```bash
# Start message service (QQ bot)
pnpm start:message
pnpm dev:message

# Start world simulation engine
pnpm start:world
pnpm dev:world

# Run tests (world package only)
pnpm test:world
```

### Code Quality

```bash
# Check code quality
pnpm check

# Lint code
pnpm lint

# Format code
pnpm format
pnpm format:write  # with auto-fix
```

### Package-specific Commands

```bash
# Run commands in specific packages
pnpm --filter @yuiju/server run <script>
pnpm --filter @yuiju/world run <script>
```

## Environment Configuration

- Uses `.env` files for environment-specific configuration
- Separate `.env` files in message and world packages
- `.env.example` files provided as templates
