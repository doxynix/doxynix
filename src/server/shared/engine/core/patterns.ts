import binaryExtensions from "binary-extensions";

export const PATH_PATTERNS = {
  API: [
    "**/{api,routes,routers,controllers,handlers,graphql,gql}/**",
    "**/*.{controller,handler,router,route,schema,dto,model,trpc,openapi,swagger,gql,graphql}.*",
  ],

  ASSET: [
    "**/{public,static,assets,css,scss,less,sass,icons,images,fonts,theme,themes}/**",
    "**/*.{css,scss,less,sass,svg,png,jpg,jpeg,gif,ico,woff,woff2,ttf,eot}",
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
    "**/*.{yml,yaml,toml,ini,conf,properties,env,env.example}",
  ],

  DOCS: [
    "**/{docs,doc,documentation,example,examples,sample,samples,guides,website}/**",
    "**/{README,CHANGELOG,CONTRIBUTING,CODE_OF_CONDUCT,SECURITY,LICENSE}*",
    "**/*.md",
  ],

  ENTRY: [
    "**/main.{ts,js,py,go,rs,cpp,c,java,kt,cs,rb,php,swift,ex,scala}",
    "**/index.{ts,js,py,php}",
    "**/server.{ts,js,py,go}",
    "**/app.{ts,js,py,rb,swift}",
    "**/manage.py",
    "**/wsgi.py",
    "**/asgi.py",
    "**/__main__.py",
    "**/program.cs",
    "**/startup.cs",
    "**/bootstrap.{php,ts,js}",
    "**/handler.{js,ts,py}",
  ],

  GENERATED: ["**/{generated,.generated}/**", "**/*.generated.*", "**/*.gen.*", "**/*_generated.*"],

  IGNORE: [
    "**/{.git,node_modules,dist,build,out,target,.next,.nuxt,.svelte-kit,.output,vendor,bower_components,coverage,.pnpm-store,.yarn,.turbo,.parcel-cache,.cache,.serverless,.terraform,.gradle,.mvn,.dart_tool,__pycache__,.pytest_cache,.mypy_cache,.ruff_cache,.tox,.nox,.venv,venv,obj,Debug,Release}/**",
    "**/{.ds_store,thumbs.db,.idea,.vscode}/**",
    `**/*.{${binaryExtensions.join(",")}}`,
    "**/*.{pdf,doc,docx,xls,xlsx,ppt,pptx,zip,tar,gz,7z,rar,mp3,mp4,wav,exe,dll,so,pyc}",
  ],

  INFRA: [
    "**/.github/workflows/**",
    "**/{deploy,deployment,helm,k8s,terraform,infra,infrastructure}/**",
    "**/docker-compose.{yml,yaml}",
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

  OPENAPI: [
    "**/openapi.{json,yaml,yml}",
    "**/swagger.{json,yaml,yml}",
    "**/*openapi*",
    "**/*swagger*",
  ],

  RUNTIME_SOURCE: [
    "**/{src,app,lib,core,domain,internal,pkg,services,server,include,crates,packages,modules,cmd,cli,sdk}/**",
    "**/*.{service,repository,use-case,handler,router,route,controller,model,entity,dto,contract,action}.*",
  ],

  SENSITIVE: [
    "**/.env*",
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
};
