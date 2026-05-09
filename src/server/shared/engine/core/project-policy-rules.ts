import binaryExtensions from "binary-extensions";

import type { FileCategory, FrameworkCategory } from "./discovery.types";

export type ProjectPolicySemanticKind =
  | "api"
  | "backend"
  | "config"
  | "core"
  | "data"
  | "frontend"
  | "infrastructure"
  | "ml"
  | "mobile"
  | "shared"
  | "unknown";

const BINARY_EXTENSIONS_SET = new Set(binaryExtensions);

export const PATH_PATTERNS = {
  API: [
    "**/{api,routes,routers,controllers,handlers,graphql,gql,rpc,endpoints}/**",
    "**/*.{controller,handler,router,route,schema,dto,model,trpc,openapi,swagger,gql,graphql,proto,thrift}.*",
  ],
  ASSET: [
    "**/{public,static,assets,css,scss,less,sass,icons,images,fonts,theme,themes,media,videos,audio}/**",
    "**/*.{css,scss,less,sass,svg,png,jpg,jpeg,gif,ico,woff,woff2,ttf,eot,webp,avif,obj,glb}",
  ],
  BENCHMARK: [
    "**/{bench,benchmarks,perf-measures,performance}/**",
    "**/*bench*.{ts,tsx,js,jsx,mts,cts,py,go,rs,java,kt,cs,rb,php}",
    "**/*benchmark*.{ts,tsx,js,jsx,mts,cts,py,go,rs,java,kt,cs,rb,php}",
  ],
  CONFIG: [
    "**/package.json",
    "**/.npmrc",
    "**/.yarnrc*",
    "**/pnpm-workspace.yaml",
    "**/pnpm-lock.yaml",
    "**/bun.lock",
    "**/bun.lockb",
    "**/deno.lock",
    "**/tsconfig*.json",
    "**/jsconfig.json",
    "**/{vite,rollup,next,nuxt,svelte,astro,tsup,rspack,farm,rolldown}.config.*",
    "**/biome.json",
    "**/{nginx.conf,Caddyfile,Procfile}",
    "**/{netlify.toml,vercel.json}",
    "**/bunfig.toml",
    "**/deno.json",
    "**/deno.jsonc",
    "**/tsconfig.json",
    "**/tsconfig.*.json",
    "**/CMakeLists.txt",
    "**/meson.build",
    "**/BUILD",
    "**/BUILD.bazel",
    "**/WORKSPACE",
    "**/go.mod",
    "**/go.sum",
    "**/Cargo.lock",
    "**/Cargo.toml",
    "**/pom.xml",
    "**/build.gradle*",
    "**/settings.gradle",
    "**/settings.gradle.kts",
    "**/gradlew",
    "**/gradlew.bat",
    "**/*.csproj",
    "**/*.fsproj",
    "**/*.vbproj",
    "**/*.sln",
    "**/Directory.Build.props",
    "**/Directory.Packages.props",
    "**/composer.json",
    "**/Gemfile",
    "**/pyproject.toml",
    "**/poetry.lock",
    "**/Pipfile",
    "**/Pipfile.lock",
    "**/requirements.txt",
    "**/setup.py",
    "**/setup.cfg",
    "**/mix.exs",
    "**/mix.lock",
    "**/rebar.config",
    "**/rebar.lock",
    "**/docker-compose.{yml,yaml}",
    "**/Dockerfile",
    "**/Makefile",
    "**/app.config",
    "**/web.config",
    "**/*.{prisma,zmodel,proto,thrift,sql}",
    "**/*.{yml,yaml,toml,ini,conf,properties,env,env.local,env.production,env.example}",
  ],
  DOCS: [
    "**/{docs,doc,documentation,example,examples,sample,samples,guides,website,wiki,manual}/**",
    "**/{README,CHANGELOG,CONTRIBUTING,CODE_OF_CONDUCT,SECURITY,LICENSE,AUTHORS,HISTORY}*",
    "**/*.{md,txt,rst,adoc}",
  ],
  ENTRY: [
    "**/main.{ts,js,py,go,rs,cpp,c,java,kt,cs,rb,php,swift,ex,scala,zig,m,mm}",
    "**/index.{ts,js,py,php}",
    "**/server.{ts,js,py,go}",
    "**/app.{ts,js,py,rb,swift}",
    "**/manage.py",
    "**/wsgi.py",
    "**/asgi.py",
    "**/lambda_function.py",
    "**/__main__.py",
    "**/program.cs",
    "**/startup.cs",
    "**/bootstrap.{php,ts,js}",
    "**/handler.{js,ts,py}",
  ],
  GENERATED: [
    "**/{generated,.generated,dist,build,out,target,bin,obj,vendor,node_modules,.next,.nuxt,.svelte-kit,.astro,.nitro,.wrangler,.output,.turbo,.cache,.parcel-cache}/**",
    "**/__generated__/**",
  ],
  IGNORE: [
    "**/{.git,node_modules,dist,build,out,target,.next,.nuxt,.svelte-kit,.astro,.nitro,.wrangler,.output,vendor,bower_components,coverage,.pnpm-store,.yarn,.turbo,.parcel-cache,.cache,.serverless,.terraform,.gradle,.mvn,.dart_tool,__pycache__,.pytest_cache,.mypy_cache,.ruff_cache,.tox,.nox,.venv,venv,obj,Debug,Release}/**",
    "**/{.ds_store,thumbs.db,.idea,.vscode}/**",
    "**/*.{pdf,doc,docx,xls,xlsx,ppt,pptx,zip,tar,gz,7z,rar,mp3,mp4,wav,exe,dll,so,pyc}",
  ],
  INFRA: [
    "**/.github/workflows/**",
    "**/{deploy,deployment,helm,k8s,terraform,infra,infrastructure}/**",
    "**/docker-compose.{yml,yaml}",
    "**/.gitlab-ci.yml",
    "**/azure-pipelines.yml",
    "**/Jenkinsfile",
    "**/{cloudformation,pulumi}/**",
    "**/*.{tfvars,nomad,hcl}",
    "**/Dockerfile",
    "**/*.tf",
  ],
  INFRA_DIRS: [
    "**/cmd/**",
    "**/bin/**",
    "**/pages/api/**",
    "**/app/api/**",
    "**/functions/**",
    "**/k8s/**",
  ],
  ML: [
    "**/{models,notebooks,data_science,training,datasets,inference}/**",
    "**/*.{ipynb,onnx,pb,h5,pt,pth,pkl,joblib,dvc}",
  ],
  MOBILE: [
    "**/{ios,android,mobile,cordova,capacitor,flutter,react-native}/**",
    "**/*.{swift,plist,xcworkspace,xcodeproj,storyboard,xib}",
  ],
  OPENAPI: [
    "**/openapi.{json,yaml,yml}",
    "**/swagger.{json,yaml,yml}",
    "**/*openapi*",
    "**/*swagger*",
  ],
  RUNTIME_SOURCE: [
    "**/{src,app,lib,core,domain,internal,pkg,services,server,include,crates,packages,modules,cmd,cli,sdk,entities,features,widgets}/**",
    "**/*.{service,repository,use-case,handler,router,route,controller,model,entity,dto,contract,action,util,helper,logic}.*",
  ],
  SENSITIVE: [
    "**/.env*",
    "**/*.{keystore,jks}",
    "**/config/master.key",
    "**/credentials.json",
    "**/{secrets,secret,credentials,auth,keys}/**",
    "**/*.{pem,key,p12,pfx,crt,der}",
  ],
  TEST: [
    "**/{test,tests,spec,__tests__,__mocks__,fixture,fixtures,e2e}/**",
    "**/runtime-tests/**",
    "**/*.{test,spec,cy,steps}.*",
  ],
  TOOLING: [
    "**/{scripts,cli,tools}/**",
    "**/{eslint,prettier,vitest,playwright,jest,stryker,typedoc,webpack,vite,rollup,postcss}.config.*",
    "**/*.config.{js,ts,mjs,cjs}",
  ],
} as const;

export const PROJECT_POLICY_RULES = {
  categoryPolicy: {
    nonArchitectureCategories: new Set<FileCategory>([
      "asset",
      "benchmark",
      "docs",
      "generated",
      "test",
    ]),
    secondaryEvidenceCategories: new Set<FileCategory>([
      "asset",
      "benchmark",
      "config",
      "docs",
      "generated",
      "infra",
      "test",
      "tooling",
    ]),
  },
  duplicatesIgnorePattern: [
    // 1. JavaScript / TypeScript / JSX / TSX
    "^\\s*import\\s+.*",
    "^\\s*export\\s+.*",
    "require\\s*\\(.*\\)",
    "const\\s+.*\\s*=\\s*require\\(.*\\)",

    // 2. Python (включая многострочные импорты и алиасы)
    "^\\s*import\\s+[\\w\\s,]+",
    "^\\s*from\\s+\\S+\\s+import\\s+.*",

    '^\\s*import\\s+".*"',
    "^\\s*package\\s+\\w+",
    '^\\s*"[^"]+"\\s*$',

    // 4. Java / Kotlin / Scala
    "^\\s*package\\s+[\\w.]+;",
    "^\\s*import\\s+[\\w.]+.*;",
    "^\\s*import\\s+[\\w.]+",

    // 5. C# / C++ / Rust
    "^\\s*using\\s+[\\w.]+.*;",
    "^\\s*namespace\\s+.*",
    "^\\s*#include\\s+.*",
    "^\\s*use\\s+[\\w:]+.*;",
    "^\\s*extern\\s+crate\\s+.*",

    // 6. PHP / Ruby
    "^\\s*use\\s+[\\w\\\\]+.*;",
    "^\\s*require\\s+.*",
    "^\\s*require_once\\s+.*",
    "^\\s*include\\s+.*",
    "^\\s*include_once\\s+.*",

    // 7. 1С:Предприятие / BSL (Подключение внешних компонент и модулей)
    "(?i)^\\s*подключитьвнешнююкомпоненту\\s*\\(.*\\)",
    "(?i)^\\s*#вставка.*",
  ],

  fileHints: {
    dependencyLockfiles: [
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      "bun.lock",
      "bun.lockb",
      "deno.lock",
      "go.sum",
      "cargo.lock",
      "poetry.lock",
      "pipfile.lock",
      "mix.lock",
      "rebar.lock",
      "composer.lock",
      "gradle.lockfile",
      ".terraform.lock.hcl",
    ],
    lowSignalConfigNames: ["gradlew", "gradlew.bat"],
    polyglotConfigHints: [
      "build.gradle",
      "build.gradle.kts",
      "cmakelists.txt",
      "cargo.toml",
      "deno.json",
      "deno.jsonc",
      "biome.json",
      "directory.build.props",
      "directory.packages.props",
      "dockerfile",
      "gemfile",
      "go.mod",
      "makefile",
      "meson.build",
      "mix.exs",
      "package.json",
      "pipfile",
      "pipfile.lock",
      "poetry.lock",
      "pom.xml",
      "pyproject.toml",
      "rebar.config",
      "requirements.txt",
      "settings.gradle",
      "settings.gradle.kts",
      "setup.cfg",
      "setup.py",
    ],
  },

  grouping: {
    genericGroupRoots: new Set([
      "app",
      "apps",
      "backend",
      "cli",
      "client",
      "cmd",
      "components",
      "core",
      "crates",
      "domain",
      "frontend",
      "include",
      "internal",
      "lib",
      "libs",
      "mobile",
      "modules",
      "packages",
      "pages",
      "pkg",
      "sdk",
      "server",
      "services",
      "shared",
      "src",
      "workers",
    ]),
    groupingRoots: new Set([
      "app",
      "apps",
      "backend",
      "cli",
      "client",
      "cmd",
      "components",
      "core",
      "crates",
      "desktop",
      "domain",
      "entities",
      "extensions",
      "features",
      "fixtures",
      "frontend",
      "include",
      "internal",
      "lib",
      "libs",
      "mobile",
      "mocks",
      "modules",
      "packages",
      "pages",
      "pkg",
      "plugins",
      "sdk",
      "server",
      "services",
      "shared",
      "src",
      "stubs",
      "widgets",
      "workers",
    ]),
    jvmSourceRoots: new Set(["clojure", "groovy", "java", "kotlin", "resources", "scala"]),
  },
  manifests: {
    rootFiles: [
      "cargo.toml",
      "go.mod",
      "package.json",
      "pom.xml",
      "pyproject.toml",
      "readme.md",
      "requirements.txt",
      "setup.py",
      "tsconfig.json",
      "pnpm-lock.yaml",
      "bun.lockb",
      "deno.json",
    ],
  },
  security: {
    patterns:
      /eval\(|exec\(|dangerouslysetinnerhtml|innerhtml\s*=|(?:\bpassword\b|\bsecret\b|\bapi[_-]?key\b|\btoken\b|\bprivate_key\b)\s*=\s*["'][^"']{8,}["']|sk_live_[\da-z]{24}|xox[abpr]-\d{12}|ghp_[\da-z]{36}|-----begin\s+rsa\s+private\s+key-----|eyjhbgcioi/i,
    todoPatterns: /\/\/\s*todo|\/\/\s*fixme|\/\/\s*xxx|\/\/\s*hack/i,
  },
  semanticPrefixes: {
    backend: ["src/server/"],
    frontend: ["src/app/"],
    shared: ["src/shared/"],
  },
  semantics: {
    apiSegments: [
      "api",
      "router",
      "routers",
      "route",
      "routes",
      "controller",
      "controllers",
      "handler",
      "handlers",
      "trpc",
      "grpc",
      "rpc",
      "gateway",
      "endpoint",
      "endpoints",
      "graphql",
      "gql",
      "apollo",
      "proto",
    ],
    backendSegments: [
      "server",
      "backend",
      "services",
      "workers",
      "jobs",
      "cli",
      "cmd",
      "internal",
      "daemon",
      "command",
      "commands",
      "processor",
      "processors",
      "consumer",
      "consumers",
    ],
    configSegments: ["config", "configs"],
    coreSegments: ["engine", "core", "domain", "runtime", "kernel"],
    dataSegments: [
      "prisma",
      "migrations",
      "schema",
      "schemas",
      "db",
      "database",
      "repositories",
      "repository",
      "persistence",
      "storage",
      "store",
      "dao",
      "orm",
      "redis",
      "mongo",
      "postgres",
      "mysql",
      "sqlite",
      "drizzle",
      "typeorm",
      "sequelize",
      "mongoose",
      "supabase",
    ],
    frontendDirectories: [
      "ui",
      "components",
      "views",
      "screens",
      "containers",
      "layouts",
      "widgets",
    ],
    frontendSegments: [
      "app",
      "pages",
      "components",
      "features",
      "widgets",
      "frontend",
      "client",
      "ui",
      "screens",
      "views",
      "templates",
      "android",
      "ios",
    ],
    infrastructureSegments: [
      "infra",
      "infrastructure",
      "adapters",
      "drivers",
      "integrations",
      "deploy",
      "helm",
      "terraform",
      "ansible",
      "k8s",
      "kubernetes",
      "cloud",
      "providers",
      "docker",
      "dockerfile",
      "github",
      "workflows",
      "ci",
      "cd",
    ],
    sharedSegments: ["shared", "common", "utils", "helpers", "sdk", "kernel", "base"],
  },
} as const;

type FrameworkCatalogEntry = {
  aliases: string[];
  category: FrameworkCategory;
  name: string;
};
export const FRAMEWORK_CATALOG: FrameworkCatalogEntry[] = [
  // ==========================================
  // 1. JS/TS ECOSYSTEM (Frontend & Backend Meta-frameworks)
  // ==========================================
  { aliases: ["hono", "@hono/"], category: "framework", name: "Hono" },
  { aliases: ["express"], category: "framework", name: "Express" },
  { aliases: ["fastify"], category: "framework", name: "Fastify" },
  { aliases: ["koa", "@koa/"], category: "framework", name: "Koa" },
  { aliases: ["nestjs", "@nestjs/"], category: "framework", name: "NestJS" },
  { aliases: ["next", "next/"], category: "framework", name: "Next.js" },
  { aliases: ["nuxt"], category: "framework", name: "Nuxt.js" },
  { aliases: ["sveltekit", "@sveltejs/kit"], category: "framework", name: "SvelteKit" },
  { aliases: ["@remix-run/"], category: "framework", name: "Remix" },
  { aliases: ["astro"], category: "framework", name: "Astro" },
  { aliases: ["@adonisjs/"], category: "framework", name: "AdonisJS" },
  { aliases: ["@elysiajs/", "elysia"], category: "framework", name: "ElysiaJS" },
  { aliases: ["h3", "nitro"], category: "framework", name: "Nuxt Nitro" },

  // ==========================================
  // 2. JS/TS UI FRAMEWORKS & VIEW LIBRARIES
  // ==========================================
  { aliases: ["react", "react-dom"], category: "ui", name: "React" },
  { aliases: ["vue", "@vue/"], category: "ui", name: "Vue" },
  { aliases: ["svelte"], category: "ui", name: "Svelte" },
  { aliases: ["solid-js"], category: "ui", name: "SolidJS" },
  { aliases: ["qwik", "@builder.io/qwik"], category: "ui", name: "Qwik" },
  { aliases: ["preact"], category: "ui", name: "Preact" },
  { aliases: ["alpinejs"], category: "ui", name: "Alpine.js" },
  { aliases: ["angular", "@angular/core"], category: "ui", name: "Angular" },

  // ==========================================
  // 3. FRONTEND STATE MANAGEMENT & DATA FETCHING
  // ==========================================
  {
    aliases: ["@tanstack/react-query", "react-query", "@tanstack/query"],
    category: "framework",
    name: "TanStack Query",
  },
  { aliases: ["zustand"], category: "framework", name: "Zustand" },
  {
    aliases: ["redux", "@reduxjs/toolkit", "react-redux"],
    category: "framework",
    name: "Redux Toolkit",
  },
  { aliases: ["mobx"], category: "framework", name: "MobX" },
  { aliases: ["jotai"], category: "framework", name: "Jotai" },
  { aliases: ["pinia"], category: "framework", name: "Pinia" },

  // ==========================================
  // 4. AI & LLM ORCHESTRATION
  // ==========================================
  { aliases: ["openai", "@openai/"], category: "api", name: "OpenAI SDK" },
  { aliases: ["@anthropic-ai/sdk", "anthropic"], category: "api", name: "Anthropic SDK" },
  { aliases: ["@google/generative-ai"], category: "api", name: "Google Gemini SDK" },
  { aliases: ["langchain", "@langchain/"], category: "framework", name: "LangChain" },
  { aliases: ["llamaindex", "llamaindex-ts"], category: "framework", name: "LlamaIndex" },
  { aliases: ["ollama"], category: "infrastructure", name: "Ollama" },
  { aliases: ["ai", "@ai-sdk/"], category: "framework", name: "Vercel AI SDK" },

  // ==========================================
  // 5. PYTHON ECOSYSTEM
  // ==========================================
  { aliases: ["fastapi"], category: "framework", name: "FastAPI" },
  { aliases: ["flask"], category: "framework", name: "Flask" },
  { aliases: ["django", "django-rest-framework"], category: "framework", name: "Django" },
  { aliases: ["tornado"], category: "framework", name: "Tornado" },
  { aliases: ["pyramid"], category: "framework", name: "Pyramid" },
  { aliases: ["masonite"], category: "framework", name: "Masonite" },

  // ==========================================
  // 6. GO ECOSYSTEM
  // ==========================================
  { aliases: ["gin-gonic/gin"], category: "framework", name: "Gin" },
  { aliases: ["gorilla/mux"], category: "framework", name: "Gorilla Mux" },
  { aliases: ["labstack/echo"], category: "framework", name: "Echo" },
  { aliases: ["gofiber/fiber"], category: "framework", name: "Fiber" },
  { aliases: ["beego"], category: "framework", name: "Beego" },
  { aliases: ["revel"], category: "framework", name: "Revel" },

  // ==========================================
  // 7. RUST ECOSYSTEM
  // ==========================================
  { aliases: ["actix-web"], category: "framework", name: "Actix Web" },
  { aliases: ["axum"], category: "framework", name: "Axum" },
  { aliases: ["rocket"], category: "framework", name: "Rocket" },
  { aliases: ["warp"], category: "framework", name: "Warp" },
  { aliases: ["leptos"], category: "framework", name: "Leptos" },
  { aliases: ["poise"], category: "framework", name: "Poise" },

  // ==========================================
  // 8. JAVA / KOTLIN ECOSYSTEM
  // ==========================================
  {
    aliases: ["spring-boot", "spring-boot-starter", "springframework"],
    category: "framework",
    name: "Spring Boot",
  },
  { aliases: ["io.quarkus", "quarkus"], category: "framework", name: "Quarkus" },
  { aliases: ["io.micronaut", "micronaut"], category: "framework", name: "Micronaut" },
  {
    aliases: ["playframework", "com.typesafe.play"],
    category: "framework",
    name: "Play Framework",
  },
  { aliases: ["ktor", "io.ktor"], category: "framework", name: "Ktor" },

  // ==========================================
  // 9. PHP ECOSYSTEM
  // ==========================================
  { aliases: ["laravel/framework", "laravel/laravel"], category: "framework", name: "Laravel" },
  {
    aliases: ["symfony/symfony", "symfony/framework-bundle"],
    category: "framework",
    name: "Symfony",
  },
  { aliases: ["yiisoft/yii2"], category: "framework", name: "Yii2" },
  { aliases: ["codeigniter4/framework"], category: "framework", name: "CodeIgniter" },
  { aliases: ["cakephp/cakephp"], category: "framework", name: "CakePHP" },

  // ==========================================
  // 10. .NET / C#
  // ==========================================
  {
    aliases: ["microsoft.aspnetcore", "microsoft.extensions.hosting"],
    category: "framework",
    name: "ASP.NET Core",
  },
  { aliases: ["microsoft.entityframeworkcore"], category: "orm", name: "Entity Framework" },

  // ==========================================
  // 11. MOBILE ECOSYSTEM
  // ==========================================
  { aliases: ["react-native"], category: "framework", name: "React Native" },
  { aliases: ["flutter", "io.flutter"], category: "framework", name: "Flutter" },
  { aliases: ["@ionic/core", "@ionic/react"], category: "framework", name: "Ionic" },
  { aliases: ["nativescript"], category: "framework", name: "NativeScript" },

  // ==========================================
  // 12. API / INTERACTION TIER
  // ==========================================
  { aliases: ["@trpc/", "trpc"], category: "api", name: "tRPC" },
  {
    aliases: ["graphql", "@apollo/", "apollo-server", "graphql-tag"],
    category: "api",
    name: "GraphQL",
  },
  { aliases: ["openapi", "swagger"], category: "api", name: "OpenAPI" },
  { aliases: ["grpc", "@grpc/grpc-js", "google.golang.org/grpc"], category: "api", name: "gRPC" },

  // ==========================================
  // 13. ORM, ODM & DATA PERSISTENCE
  // ==========================================
  { aliases: ["prisma", "@prisma/client"], category: "orm", name: "Prisma" },
  { aliases: ["typeorm"], category: "orm", name: "TypeORM" },
  { aliases: ["sequelize"], category: "orm", name: "Sequelize" },
  { aliases: ["mongoose"], category: "orm", name: "Mongoose" },
  { aliases: ["drizzle-orm"], category: "orm", name: "Drizzle" },
  { aliases: ["sqlalchemy"], category: "orm", name: "SQLAlchemy" },
  { aliases: ["tortoise-orm"], category: "orm", name: "Tortoise ORM" },
  { aliases: ["gorm.io/gorm", "github.com/jinzhu/gorm"], category: "orm", name: "GORM" },
  { aliases: ["diesel"], category: "orm", name: "Diesel" },

  // ==========================================
  // 14. DATABASES & CACHES
  // ==========================================
  { aliases: ["redis", "ioredis"], category: "database", name: "Redis" },
  {
    aliases: ["pg", "postgres", "postgresql", "pg-promise"],
    category: "database",
    name: "PostgreSQL",
  },
  { aliases: ["mysql", "mysql2"], category: "database", name: "MySQL" },
  { aliases: ["mongodb", "mongo"], category: "database", name: "MongoDB" },
  { aliases: ["sqlite", "sqlite3"], category: "database", name: "SQLite" },
  { aliases: ["@supabase/supabase-js"], category: "database", name: "Supabase" },
  {
    aliases: ["firebase-admin", "firebase-functions", "firebase"],
    category: "database",
    name: "Firebase",
  },

  // ==========================================
  // 15. UI / CSS / STYLING
  // ==========================================
  { aliases: ["tailwindcss", "@tailwindcss/"], category: "ui", name: "Tailwind CSS" },
  { aliases: ["@chakra-ui/react", "@chakra-ui/"], category: "ui", name: "Chakra UI" },
  { aliases: ["@mui/material", "@mui/"], category: "ui", name: "Material UI" },
  { aliases: ["styled-components"], category: "ui", name: "Styled Components" },
  { aliases: ["bootstrap"], category: "ui", name: "Bootstrap" },
  { aliases: ["sass", "scss"], category: "ui", name: "Sass" },

  // ==========================================
  // 16. INFRASTRUCTURE, CICD & DEV ENVIRONMENT
  // ==========================================
  { aliases: ["docker", "dockerfile"], category: "infrastructure", name: "Docker" },
  { aliases: ["terraform"], category: "infrastructure", name: "Terraform" },
  { aliases: ["kubernetes", "k8s", "helm"], category: "infrastructure", name: "Kubernetes" },
  { aliases: ["ansible"], category: "infrastructure", name: "Ansible" },
  { aliases: [".github/workflows", "github actions"], category: "tooling", name: "GitHub Actions" },

  // ==========================================
  // 17. MODERN HIGH-SPEED RUST-BASED TOOLING (Ультра-актуально!)
  // ==========================================
  { aliases: ["@rspack/core", "rspack"], category: "tooling", name: "Rspack" }, // Сверхбыстрый сборщик от ByteDance
  { aliases: ["turbopack"], category: "tooling", name: "Turbopack" },
  { aliases: ["oxc", "oxlint"], category: "tooling", name: "Oxc/Oxlint" }, // Замена ESLint на Rust
  { aliases: ["rolldown"], category: "tooling", name: "Rolldown" }, // Будущее ядро Vite
  { aliases: ["biome", "@biomejs/biome"], category: "tooling", name: "Biome" }, // Замена Prettier/ESLint на Rust

  // ==========================================
  // 18. TESTING SUITES
  // ==========================================
  {
    aliases: ["vitest", "jest", "pytest", "junit", "mocha", "cypress", "playwright"],
    category: "testing",
    name: "Testing Frameworks",
  },
];
