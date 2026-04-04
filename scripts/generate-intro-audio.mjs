import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createQuestionAudioResponse } from '../server/elevenlabs-question-audio.js';

const INTRO_TEXT = [
  'The crew is assembled.',
  'The vault awaits.',
  'Answer questions to advance through the heist.',
  'Every correct answer grows your haul.',
  'Wrong answers leave cash on the table.',
  'Finish with the biggest score.',
  'Win it all.',
].join(' ');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const envPath = path.join(repoRoot, '.env');
const outputPath = path.join(repoRoot, 'client', 'src', 'assets', 'audio', 'intro-tutorial.mp3');

async function loadDotEnvFile() {
  try {
    const envFile = await fs.readFile(envPath, 'utf8');

    for (const line of envFile.split(/\r?\n/)) {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      const separatorIndex = trimmedLine.indexOf('=');

      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmedLine.slice(0, separatorIndex).trim();
      const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
      const normalizedValue = rawValue.replace(/^['"]|['"]$/g, '');

      if (!(key in process.env)) {
        process.env[key] = normalizedValue;
      }
    }
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return;
    }

    throw error;
  }
}

async function main() {
  const forceRegenerate = process.argv.includes('--force');

  await loadDotEnvFile();

  if (!forceRegenerate) {
    try {
      await fs.access(outputPath);
      console.log(`Intro narration already exists at ${outputPath}`);
      return;
    } catch {
      // The file does not exist yet, so continue.
    }
  }

  const audio = await createQuestionAudioResponse({
    text: INTRO_TEXT,
  });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, audio.buffer);

  console.log(`Saved intro narration to ${outputPath}`);
}

main().catch(error => {
  console.error('Unable to generate intro narration', error);
  process.exitCode = 1;
});
