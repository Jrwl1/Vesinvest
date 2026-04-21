import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const appRoot = path.resolve(__dirname, '..');

const prismaClientPackageJson = require.resolve('@prisma/client/package.json', {
  paths: [appRoot],
});
const prismaClientPackageDir = path.dirname(prismaClientPackageJson);

export const prismaClientDir = path.resolve(
  prismaClientPackageDir,
  '..',
  '..',
  '.prisma',
  'client',
);

const schemaPath = path.join(appRoot, 'prisma', 'schema.prisma');
const REQUIRED_CLIENT_FILES = [
  'index.d.ts',
  'index.js',
  'query_engine-windows.dll.node',
  'schema.prisma',
];

export async function listTempEngineFiles() {
  try {
    const entries = await fs.readdir(prismaClientDir);
    return entries.filter((name) =>
      name.startsWith('query_engine-windows.dll.node.tmp'),
    );
  } catch {
    return [];
  }
}

export async function cleanupTempEngineFiles() {
  const tempFiles = await listTempEngineFiles();
  const failed = [];

  for (const fileName of tempFiles) {
    try {
      await fs.unlink(path.join(prismaClientDir, fileName));
    } catch (error) {
      failed.push({ fileName, error });
    }
  }

  return { tempFiles, failed };
}

export async function hasRequiredClientArtifacts() {
  try {
    await Promise.all(
      REQUIRED_CLIENT_FILES.map((fileName) =>
        fs.access(path.join(prismaClientDir, fileName)),
      ),
    );
    return true;
  } catch {
    return false;
  }
}

export async function hasSchemaParity() {
  try {
    const [sourceSchema, generatedSchema] = await Promise.all([
      fs.readFile(schemaPath, 'utf8'),
      fs.readFile(path.join(prismaClientDir, 'schema.prisma'), 'utf8'),
    ]);
    return normalizeSchema(sourceSchema) === normalizeSchema(generatedSchema);
  } catch {
    return false;
  }
}

export async function hasHealthyGeneratedClient() {
  const [artifactsReady, schemaParity] = await Promise.all([
    hasRequiredClientArtifacts(),
    hasSchemaParity(),
  ]);
  return artifactsReady && schemaParity;
}

function normalizeSchema(schemaText) {
  const lines = schemaText.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let currentBlock = null;

  for (const rawLine of lines) {
    const line = rawLine
      .replace(/\/\/.*$/, '')
      .trim()
      .replace(/\s+/g, ' ');

    if (!line) {
      continue;
    }

    const blockStart = line.match(/^(generator|datasource|model|enum)\s+(\w+)/);
    if (blockStart) {
      currentBlock = {
        key: `${blockStart[1]} ${blockStart[2]}`,
        body: [],
      };
      blocks.push(currentBlock);
      continue;
    }

    if (line === '}') {
      currentBlock = null;
      continue;
    }

    if (currentBlock) {
      currentBlock.body.push(line);
    }
  }

  return blocks
    .map((block) => `${block.key}\n${block.body.slice().sort().join('\n')}`)
    .sort()
    .join('\n---\n');
}
