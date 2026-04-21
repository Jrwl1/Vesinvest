import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import {
  THIN_FACADE_ALLOWLIST,
  THIN_FACADE_LINE_CAP,
  normalizeRepoPath,
} from './repo-health-config.mjs';

function countLines(text) {
  if (text.length === 0) {
    return 0;
  }
  return text.split(/\r?\n/).length;
}

function unwrapExpression(node) {
  if (
    ts.isAsExpression(node) ||
    ts.isTypeAssertion(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isParenthesizedExpression(node)
  ) {
    return unwrapExpression(node.expression);
  }
  return node;
}

function isAllowedLiteralExpression(node) {
  const current = unwrapExpression(node);
  if (
    ts.isStringLiteral(current) ||
    ts.isNoSubstitutionTemplateLiteral(current) ||
    ts.isNumericLiteral(current)
  ) {
    return true;
  }
  if (
    current.kind === ts.SyntaxKind.TrueKeyword ||
    current.kind === ts.SyntaxKind.FalseKeyword ||
    current.kind === ts.SyntaxKind.NullKeyword
  ) {
    return true;
  }
  if (ts.isPrefixUnaryExpression(current)) {
    return isAllowedLiteralExpression(current.operand);
  }
  if (ts.isArrayLiteralExpression(current)) {
    return current.elements.every((element) => isAllowedLiteralExpression(element));
  }
  if (ts.isObjectLiteralExpression(current)) {
    return current.properties.every((property) => {
      if (ts.isShorthandPropertyAssignment(property) || ts.isSpreadAssignment(property)) {
        return false;
      }
      if (ts.isPropertyAssignment(property)) {
        return isAllowedLiteralExpression(property.initializer);
      }
      return false;
    });
  }
  return false;
}

function isAllowedTsStatement(statement) {
  if (
    ts.isImportDeclaration(statement) ||
    ts.isExportDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement)
  ) {
    return true;
  }

  if (ts.isVariableStatement(statement)) {
    return (
      (statement.declarationList.flags & ts.NodeFlags.Const) !== 0 &&
      statement.declarationList.declarations.every(
        (declaration) =>
          declaration.initializer != null &&
          isAllowedLiteralExpression(declaration.initializer),
      )
    );
  }

  return false;
}

function validateTsFacade(repoPath, sourceText) {
  const sourceFile = ts.createSourceFile(
    repoPath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    repoPath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const problems = [];
  for (const statement of sourceFile.statements) {
    if (!isAllowedTsStatement(statement)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(statement.getStart());
      problems.push(`contains non-facade statement at line ${line + 1}`);
    }
  }
  return problems;
}

function validateCssFacade(sourceText) {
  const lines = sourceText.split(/\r?\n/);
  const problems = [];
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (!trimmed || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed === '*/') {
      continue;
    }
    if (!/^@import\s+['"].+['"];\s*$/.test(trimmed)) {
      problems.push(`contains non-@import content at line ${index + 1}`);
    }
  }
  return problems;
}

const findings = [];

for (const repoPath of THIN_FACADE_ALLOWLIST) {
  const absolutePath = path.resolve(repoPath);
  if (!fs.existsSync(absolutePath)) {
    findings.push(`${repoPath}: file is missing from the allowlist target`);
    continue;
  }

  const sourceText = fs.readFileSync(absolutePath, 'utf8');
  const lineCount = countLines(sourceText);
  if (lineCount > THIN_FACADE_LINE_CAP) {
    findings.push(`${repoPath}: ${lineCount} lines (facade cap ${THIN_FACADE_LINE_CAP})`);
  }

  const problems = repoPath.endsWith('.css')
    ? validateCssFacade(sourceText)
    : validateTsFacade(repoPath, sourceText);

  for (const problem of problems) {
    findings.push(`${normalizeRepoPath(repoPath)}: ${problem}`);
  }
}

if (findings.length > 0) {
  console.error('Thin facade check failed:\n');
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log('Thin facade check passed.');
