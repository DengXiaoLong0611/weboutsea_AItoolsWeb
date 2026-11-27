import nextEnv from '@next/env';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { sceneIds, scenes } from '../src/lib/pet-portrait/catalog.ts';

const model = 'qwen-image-2.1-turbo';
const outputDirectory = path.join(process.cwd(), 'public', 'tools', 'pet-portrait', 'scenes');
const dryRun = process.argv.includes('--dry-run');
const limitArgument = process.argv.find(argument => argument.startsWith('--limit='));
const limit = limitArgument ? Number(limitArgument.slice('--limit='.length)) : Number.POSITIVE_INFINITY;
const pets = [
  'golden retriever', 'black Labrador retriever', 'border collie', 'wire-haired terrier',
  'ginger tabby cat', 'silver shorthair cat', 'black-and-white rescue cat', 'cavalier spaniel',
];

if (!(limit > 0)) throw new Error('--limit must be a positive number.');

const missing = sceneIds.filter(scene => !existsSync(path.join(outputDirectory, `${scene}.webp`))).slice(0, limit);
const estimatedCost = missing.length * 0.1;
console.log(`Model: ${model}; missing previews: ${missing.length}; estimated generation cost: about CNY ${estimatedCost.toFixed(2)}.`);
if (missing.length === 0 || dryRun) process.exit(0);
if (estimatedCost > 30) throw new Error('Estimated cost exceeds the configured CNY 30 safety ceiling.');

nextEnv.loadEnvConfig(process.cwd());
const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
const rawBase = process.env.DASHSCOPE_BASE_URL?.trim();
if (!apiKey || !rawBase) throw new Error('DASHSCOPE_API_KEY and DASHSCOPE_BASE_URL are required in the local server environment.');

const base = new URL(rawBase);
if (base.protocol !== 'https:' || !base.hostname.endsWith('.maas.aliyuncs.com') ||
    !base.pathname.replace(/\/$/, '').endsWith('/api/v1')) {
  throw new Error('DASHSCOPE_BASE_URL must be an HTTPS Bailian workspace API URL ending in /api/v1.');
}
const endpoint = new URL('/compatible-mode/v1/images/generations', base.origin);
await mkdir(outputDirectory, { recursive: true });

function promptFor(scene, index) {
  const style = scenes[scene];
  const pet = pets[index % pets.length];
  const subject = style.subjects === 'pet-only'
    ? `Show exactly one ${pet} alone; no humans, faces, hands, or human body parts.`
    : `Show exactly one fictional white European or North American adult ${index % 2 ? 'man' : 'woman'}, age ${28 + (index % 25)}, with one ${pet}. Keep both faces visible and show a natural, affectionate interaction.`;
  return `Create one original photorealistic 3:4 vertical editorial photograph for a premium North American and European pet portrait catalogue. Scene: ${style.setting}. ${subject} Use a polished Western lifestyle aesthetic, natural skin and fur texture, believable anatomy, warm restrained color grading, soft natural light, and candid emotion. The people and scene are fictional, not recognizable real people. Single continuous photograph; no text, lettering, logo, watermark, border, collage, duplicate subjects, or extra limbs.`;
}

function downloadWithCurl(url) {
  return new Promise((resolve, reject) => {
    const child = spawn('curl', ['--fail', '--silent', '--max-time', '60', '--output', '-', '--config', '-'], {
      env: { PATH: process.env.PATH },
    });
    const chunks = [];
    let byteCount = 0;
    child.stdout.on('data', chunk => {
      byteCount += chunk.length;
      if (byteCount > 20_000_000) child.kill();
      else chunks.push(chunk);
    });
    child.stderr.resume();
    child.on('error', () => reject(new Error('Could not start curl to download the generated image.')));
    child.on('close', code => code === 0
      ? resolve(Buffer.concat(chunks))
      : reject(new Error('Temporary image download failed; generation stopped without retry.')));
    child.stdin.end(`url = "${url.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"\n`);
  });
}

for (const [index, scene] of missing.entries()) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: promptFor(scene, index), n: 1, response_format: 'url' }),
    signal: AbortSignal.timeout(180_000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Qwen rejected ${scene} with HTTP ${response.status}; generation stopped without retry.`);
  const imageUrl = result?.data?.[0]?.url;
  if (typeof imageUrl !== 'string' || new URL(imageUrl).protocol !== 'https:') {
    throw new Error(`Qwen returned no valid image URL for ${scene}; generation stopped without retry.`);
  }

  const input = await downloadWithCurl(imageUrl);
  if (input.length < 1_000) throw new Error(`Downloaded image for ${scene} is unexpectedly small.`);
  const output = await sharp(input).rotate().resize(900, 1200, { fit: 'cover' }).webp({ quality: 82 }).toBuffer();
  await writeFile(path.join(outputDirectory, `${scene}.webp`), output, { flag: 'wx' });
  console.log(`[${index + 1}/${missing.length}] ${scene}: saved 900x1200 WebP (${output.length} bytes).`);
}

console.log(`Generated ${missing.length} previews. No automatic retries were made.`);
