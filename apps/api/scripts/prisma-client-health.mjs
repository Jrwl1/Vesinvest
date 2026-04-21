import fs from 'node:fs/promises';
import crypto from 'node:crypto';
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
const prismaClientPackage = require(prismaClientPackageJson);
const prismaClientVersion = String(prismaClientPackage.version ?? '');
const prismaEnginesDirPromise = resolvePrismaEnginesDir();

export const prismaClientDir = path.resolve(
  prismaClientPackageDir,
  '..',
  '..',
  '.prisma',
  'client',
);

const schemaPath = path.join(appRoot, 'prisma', 'schema.prisma');
const generatedClientEntryPath = path.join(prismaClientDir, 'index.js');
const REQUIRED_CLIENT_FILES = [
  'index.d.ts',
  'index.js',
  'schema.prisma',
];

function getEngineFilePatterns() {
  if (process.platform === 'win32') {
    return [/^query_engine-windows(?:-[\w.-]+)?\.dll\.node$/];
  }
  if (process.platform === 'darwin') {
    return [/^libquery_engine-[\w.-]+\.dylib\.node$/];
  }
  return [/^libquery_engine-[\w.-]+\.so\.node$/];
}

async function getExpectedEngineFiles() {
  const installedEngineFiles = await getInstalledEngineFiles();
  try {
    const entrySource = await fs.readFile(generatedClientEntryPath, 'utf8');
    const matches = Array.from(
      entrySource.matchAll(/path\.join\(__dirname,\s*"([^"]+)"\);/g),
    );
    const engineFiles = matches
      .map((match) => match[1])
      .filter((fileName) =>
        getEngineFilePatterns().some((pattern) => pattern.test(fileName)),
      );

    if (engineFiles.length > 0) {
      return [...new Set(engineFiles)];
    }
    return installedEngineFiles;
  } catch {
    return installedEngineFiles;
  }
}

export async function listTempEngineFiles() {
  try {
    const entries = await fs.readdir(prismaClientDir);
    const engineFilePatterns = getEngineFilePatterns();
    return entries.filter((name) =>
      engineFilePatterns.some((pattern) =>
        pattern.test(name.replace(/\.tmp.*$/, '')),
      ) && /\.tmp/.test(name),
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
    const entries = await fs.readdir(prismaClientDir);
    await Promise.all(
      REQUIRED_CLIENT_FILES.map((fileName) =>
        fs.access(path.join(prismaClientDir, fileName)),
      ),
    );
    const expectedEngineFiles = await getExpectedEngineFiles();
    if (expectedEngineFiles.length > 0) {
      return expectedEngineFiles.every((fileName) => entries.includes(fileName));
    }

    const engineFilePatterns = getEngineFilePatterns();
    return entries.some((fileName) =>
      engineFilePatterns.some((pattern) => pattern.test(fileName)),
    );
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
  const [artifactsReady, schemaParity, engineBinaryParity] = await Promise.all([
    hasRequiredClientArtifacts(),
    hasSchemaParity(),
    hasExpectedEngineBinaryParity(),
  ]);
  return artifactsReady && schemaParity && engineBinaryParity;
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

async function hasExpectedEngineBinaryParity() {
  const expectedEngineFiles = await getExpectedEngineFiles();
  if (expectedEngineFiles.length === 0) {
    return true;
  }
  const prismaEnginesDir = await prismaEnginesDirPromise;
  if (!prismaEnginesDir) {
    return false;
  }

  const comparisons = await Promise.all(
    expectedEngineFiles.map(async (fileName) => {
      const generatedPath = path.join(prismaClientDir, fileName);
      const installedPath = path.join(prismaEnginesDir, fileName);

      try {
        const [generatedHash, installedHash] = await Promise.all([
          hashFile(generatedPath),
          hashFile(installedPath),
        ]);
        return generatedHash === installedHash;
      } catch {
        return false;
      }
    }),
  );

  return comparisons.every(Boolean);
}

async function hashFile(filePath) {
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function resolvePrismaEnginesDir() {
  try {
    const pnpmStoreDir = path.resolve(prismaClientPackageDir, '..', '..', '..');
    const exactPackageDir = path.join(
      pnpmStoreDir,
      `@prisma+engines@${prismaClientVersion}`,
    );
    try {
      await fs.access(exactPackageDir);
      return path.join(exactPackageDir, 'node_modules', '@prisma', 'engines');
    } catch {
      // fall through to a version-prefixed match for environments with suffixes.
    }
    const entries = await fs.readdir(pnpmStoreDir, { withFileTypes: true });
    const enginesPackage = entries
      .filter(
        (entry) =>
          entry.isDirectory() &&
          entry.name.startsWith(`@prisma+engines@${prismaClientVersion}`),
      )
      .sort((left, right) => left.name.localeCompare(right.name))[0];
    if (!enginesPackage) {
      return null;
    }
    return path.join(
      pnpmStoreDir,
      enginesPackage.name,
      'node_modules',
      '@prisma',
      'engines',
    );
  } catch {
    return null;
  }
}

async function getInstalledEngineFiles() {
  const prismaEnginesDir = await prismaEnginesDirPromise;
  if (!prismaEnginesDir) {
    return [];
  }
  try {
    const entries = await fs.readdir(prismaEnginesDir);
    return entries.filter((fileName) =>
      getEngineFilePatterns().some((pattern) => pattern.test(fileName)),
    );
  } catch {
    return [];
  }
}
