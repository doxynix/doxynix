import { CallExpression, Node, Project, SyntaxKind } from "ts-morph";

const project = new Project({ tsConfigFilePath: "tsconfig.json" });

const sourceFiles = project.getSourceFiles([
  "src/**/*.ts",
  "!src/tests/**/*",
  "!src/**/*.test.ts",
  "!src/**/*.spec.ts",
]);

const AUTO_FIX = process.env.FIX === "true";

const issues = [];

// --- HELPERS ---

const hasComments = (node) =>
  node.getLeadingCommentRanges().length > 0 || node.getTrailingCommentRanges().length > 0;

const isFluentApi = (node) => node.getText().split(".").length > 3;

const isCallback = (node) => {
  const parent = node.getParent();
  return (
    Node.isCallExpression(parent) ||
    (Node.isSyntaxList(parent) && Node.isCallExpression(parent.getParent()))
  );
};

const getSafeName = (node) => {
  if (Node.isFunctionDeclaration(node) || Node.isMethodDeclaration(node))
    return node.getName() ?? "anon";
  if (Node.isArrowFunction(node)) {
    const varDec = node.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
    return varDec?.getName() ?? "anon_arrow";
  }
  return "unknown";
};

// --- ANALYZERS ---

sourceFiles.forEach((file) => {
  const fileName = file.getBaseName();

  // 1. Redundant Await
  file.getDescendantsOfKind(SyntaxKind.AwaitExpression).forEach((awaitExpr) => {
    const parent = awaitExpr.getParent();
    const isReturn = Node.isReturnStatement(parent) || Node.isArrowFunction(parent);
    if (isReturn && !awaitExpr.getFirstAncestorByKind(SyntaxKind.TryStatement)) {
      issues.push({
        file: fileName,
        line: awaitExpr.getStartLineNumber(),
        type: "AWAIT",
        severity: "LOW",
        fixable: true,
        node: awaitExpr,
        msg: "Лишний await в return (замедляет Event Loop).",
      });
    }
  });

  // 2. Empty Blocks (if/catch/for)
  file.getDescendantsOfKind(SyntaxKind.Block).forEach((block) => {
    if (block.getStatements().length === 0 && !hasComments(block)) {
      const parent = block.getParent();
      if (Node.isFunctionLikeDeclaration(parent)) return;
      issues.push({
        file: fileName,
        line: block.getStartLineNumber(),
        type: "EMPTY",
        severity: "HIGH",
        fixable: true,
        node: block,
        msg: `Пустой блок в ${parent.getKindName()}.`,
      });
    }
  });

  // 3. Useless Proxies
  const fns = [
    ...file.getFunctions(),
    ...file.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
    ...file.getDescendantsOfKind(SyntaxKind.ArrowFunction),
  ];

  fns.forEach((fn) => {
    if (isCallback(fn)) return;
    const body = fn.getBody();
    if (!body) return;

    let call;
    if (Node.isBlock(body)) {
      const stmts = body.getStatements();
      if (stmts.length === 1) {
        const s = stmts[0];
        const expr = Node.isReturnStatement(s)
          ? s.getExpression()
          : Node.isExpressionStatement(s)
            ? s.getExpression()
            : null;
        if (Node.isCallExpression(expr)) call = expr;
      }
    } else if (Node.isCallExpression(body)) {
      call = body;
    }

    if (call && !isFluentApi(call)) {
      const params = fn.getParameters();
      const args = call.getArguments();
      if (params.length === args.length) {
        const pNames = params.map((p) => p.getName());
        const aNames = args.map((a) => a.getText());
        if (pNames.every((v, i) => v === aNames[i])) {
          const target = call.getExpression().getText();
          const isThis = target.startsWith("this.");
          issues.push({
            file: fileName,
            line: fn.getStartLineNumber(),
            type: "PROXY",
            severity: isThis ? "HIGH" : "LOW",
            fixable: !isThis,
            node: fn,
            msg: `Функция ${getSafeName(fn)} — бесполезный прокси для ${target}`,
          });
        }
      }
    }
  });

  // 4. Useless Constructors
  file.getClasses().forEach((cls) => {
    cls.getConstructors().forEach((ctor) => {
      const stmts = ctor.getStatements();
      if (stmts.length === 1 && !hasComments(ctor)) {
        const s = stmts[0];
        if (Node.isExpressionStatement(s)) {
          const expr = s.getExpression();
          if (Node.isCallExpression(expr) && expr.getExpression().getText() === "super") {
            if (ctor.getParameters().length === expr.getArguments().length) {
              issues.push({
                file: fileName,
                line: ctor.getStartLineNumber(),
                type: "CTOR",
                severity: "LOW",
                fixable: true,
                node: ctor,
                msg: "Конструктор только вызывает super().",
              });
            }
          }
        }
      }
    });
  });
});

// --- OUTPUT & FIX ---

if (issues.length === 0) {
  console.log("✨ Проект чист (тесты проигнорированы).");
  process.exit(0);
}

console.log(`🚀 Найдено ${issues.length} проблем в исходном коде:\n`);

issues.forEach((issue) => {
  const color = issue.severity === "HIGH" ? "\x1b[31m" : "\x1b[33m";
  console.log(`${color}[${issue.type}]\x1b[0m ${issue.file}:${issue.line} -> ${issue.msg}`);

  if (AUTO_FIX && issue.fixable) {
    try {
      if (issue.type === "AWAIT" && Node.isAwaitExpression(issue.node)) {
        issue.node.replaceWithText(issue.node.getExpression().getText());
      } else {
        if ("remove" in issue.node) {
          issue.node.remove();
        }
      }
    } catch (e) {
      // Узел мог быть удален родителем
    }
  }
});

if (AUTO_FIX) {
  project.saveSync();
  console.log("\n✅ Мусор вывезен, файлы сохранены.");
} else {
  console.log(`\n💡 Запусти 'FIX=true npx tsx scripts/detect-trash.mts' для очистки.`);
}
