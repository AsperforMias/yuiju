# Project Structure

## Monorepo Organization
The project follows a pnpm workspace structure with four main packages under `packages/`:

```
packages/
├── message/     # 交互层 - External interaction & messaging
├── world/       # 核心引擎层 - Core simulation engine  
├── source/      # 数据与设定层 - Data & configuration
└── utils/       # 基础工具层 - Shared utilities
```

## Package Details

### `packages/message` (Interaction Layer)
**Purpose**: Handles external interactions, primarily QQ bot functionality
```
src/
├── config.ts           # Configuration management
├── conversation.ts     # Conversation handling logic
├── server.ts          # Main QQ bot server (production)
├── terminal.ts        # Terminal interface (development)
├── state.ts           # Message state management
├── tts.ts             # Text-to-speech functionality
└── llm/
    ├── manager.ts     # LLM management
    └── tools/
        └── memorySearchTool.ts
```

### `packages/world` (Core Engine)
**Purpose**: Autonomous life simulation engine with behavior trees
```
src/
├── main.ts            # Main entry point
├── test.ts            # Demo/testing entry
├── action/            # Behavior definitions
│   ├── index.ts       # Action registry
│   ├── anywhere.ts    # Location-independent actions
│   ├── home.ts        # Home-specific actions
│   ├── school.ts      # School-specific actions
│   └── utils.ts       # Action utilities
├── engine/
│   ├── runner.ts      # Main simulation loop
│   └── tick.ts        # Tick mechanism
├── state/
│   ├── index.ts       # State exports
│   ├── charactor-state.ts  # Character state management
│   └── world-state.ts      # World state management
├── types/
│   ├── action.ts      # Action type definitions
│   └── state.ts       # State type definitions
├── llm/
│   └── llm-client.ts  # LLM integration
└── utils/
    └── logger.ts      # Logging utilities
```

### `packages/source` (Data Layer)
**Purpose**: Static resources, character settings, and training data
```
dataset/               # Training datasets
├── handwritten.jsonl
├── llm-generation.jsonl
├── train.jsonl
└── opensource/        # Open source datasets

prompt/                # Core prompt definitions
├── index.ts          # Prompt exports
├── character-card.ts # Character personality
├── world-view.ts     # World setting
└── oc-design.md      # Character design doc

picture/              # Static assets
└── repo_avatar.png
```

### `packages/utils` (Utilities Layer)
**Purpose**: Shared infrastructure and common utilities
```
src/
├── index.ts          # Main exports
├── env.ts            # Environment utilities
├── redis.ts          # Redis connection
├── time.ts           # Time utilities
├── utils.ts          # General utilities
└── db/
    ├── index.ts      # Database exports
    ├── connect.ts    # Database connection
    └── schema/       # Database schemas
        ├── action.schema.ts
        └── qqMessage.schema.ts
```

## Key Conventions

### Import Patterns
- Use workspace references: `@yuiju/package-name`
- TypeScript path mapping configured in root `tsconfig.json`
- Each package has its own `tsconfig.json` extending root config

### File Naming
- Use kebab-case for files: `character-state.ts`
- Use camelCase for directories when multi-word: `src/llm/`
- Schema files end with `.schema.ts`

### Package Dependencies
```
message → utils, source
world   → utils, source  
source  → utils
utils   → (no internal deps)
```

### Environment Files
- Root `.env` for global configuration
- Package-specific `.env` files in `message/` and `world/`
- Always provide `.env.example` templates

### Documentation
- `docs/` contains architecture diagrams and design documents
- Each package may have its own `README.md`
- Chinese documentation is acceptable and commonly used