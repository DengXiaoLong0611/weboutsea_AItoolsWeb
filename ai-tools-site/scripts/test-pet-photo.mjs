import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { getBailianConfig, editPetPhoto } from '../src/lib/pet-photo/bailian.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: {
  run: { type: 'boolean', default: false },
  help: { type: 'boolean', default: false },
  image: { type: 'string', default: 'public/tools/pet-photo/assets/demo/蛋蛋原照-抱玩偶.jpg' },
  reference: { type: 'string', default: 'public/tools/pet-photo/example/3.png' },
  style: { type: 'string', default: 'all' },
} });

const styles = [
  { id: '1', name: '蜡笔原景', prompt: '使用明显的蜡笔和油画棒颗粒、不规则深色轮廓与叠色，简化原照背景，保留场景关系。' },
  { id: '2', name: '细腻彩铅', prompt: '以细腻彩铅线条结合蜡笔铺色，保留毛发细节和纸纹，轻度简化原照背景，优先保持宠物辨识度。' },
  { id: '3', name: '蜡笔留白', prompt: '使用明显的蜡笔颗粒、不规则深色轮廓与纸纹；保留主体和抱着的玩偶，背景替换为温暖米白画纸并适当留白。' },
];
const basePrompt = '图1是需要改绘的原始照片，是宠物身份、毛色、花纹、姿势和物品关系的唯一依据。图2仅用于参考蜡笔手绘笔触，不要复制其中的人物、动物、文字、水印或社交界面。将图1绘制为可爱的手绘插画，保留宠物眼睛颜色、脸型、姿势及现有配饰；保留现有物体之间的关系，不增加人物或动物。呈现真实画纸颗粒与自然笔触，避免平滑矢量、3D与照片滤镜感。仅输出一幅纯手绘图，不含文字、水印、拼图或原照缩略图；原照对比由网页另行排版。';

async function imageData(path) {
  const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }[extname(path).toLowerCase()];
  if (!mime) throw new Error('测试输入仅支持 JPG、PNG、WebP。');
  const buffer = await readFile(path);
  if (!buffer.length || buffer.length > 10 * 1024 * 1024) throw new Error('输入图片必须非空且不超过 10 MB。');
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

async function downloadImage(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000), redirect: 'error' });
  if (!response.ok || !response.body) throw new Error('图片已生成，但下载失败。请依据结果记录中的请求 ID 在百炼控制台找回图片，不要直接重新生成。');
  let length = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    length += chunk.byteLength;
    if (length > 25 * 1024 * 1024) throw new Error('输出图片超过 25 MB，停止下载。');
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  if (!buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('生成结果不是有效的 PNG，请在控制台查看记录。');
  return buffer;
}

async function main() {
  if (values.help) {
    console.log('用法：npm run pet-photo:test -- [--run] [--style 1|2|3|all] [--image 原照路径] [--reference 画风参考路径]\n默认仅预览，不联网、不扣费。--run 才实际生成并计费。');
    return;
  }
  for (const name of ['.env.local', '.env']) {
    const path = resolve(root, name);
    if (existsSync(path)) process.loadEnvFile(path);
  }
  const jobs = values.style === 'all' ? styles : styles.filter(s => s.id === values.style);
  if (!jobs.length) throw new Error('--style 只能为 1、2、3 或 all。');
  const source = resolve(root, values.image);
  const reference = resolve(root, values.reference);
  const images = await Promise.all([imageData(source), imageData(reference)]);
  const model = process.env.DASHSCOPE_IMAGE_MODEL?.trim() || 'qwen-image-2.1-pro';
  console.log(`${values.run ? '实际生成（会调用付费 API）' : '仅预览，不联网、不扣费'}\n模型：${model}\n原照：${source}\n参考：${reference}\n组别：${jobs.map(j => j.name).join('、')}`);
  if (!values.run) {
    console.log(`百炼密钥：${process.env.DASHSCOPE_API_KEY?.trim() ? '已配置' : '未配置'}；API 地址：${process.env.DASHSCOPE_BASE_URL?.trim() ? '已填写（执行时校验）' : '未配置'}\n确认后加 --run 执行；仅测试一张可加 --style 1。`);
    return;
  }
  const config = getBailianConfig();
  const output = resolve(root, 'output/imagegen', `宠物手绘-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 6)}`);
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, `原照${extname(source)}`), await readFile(source));
  console.log(`输出目录：${output}`);
  const records = [];
  for (const job of jobs) {
    const prompt = `${basePrompt}\n${job.prompt}`;
    await writeFile(resolve(output, `${job.id}-${job.name}-提示词.txt`), prompt);
    console.log(`正在生成：${job.name}……`);
    const started = Date.now();
    const result = await editPetPhoto({ images, prompt }, config);
    // Persist request ID before downloading so a download failure never triggers another paid generation.
    records.push({ style: job.name, model: result.model, requestId: result.requestId, usage: result.usage, elapsedMs: Date.now() - started, downloaded: false });
    await writeFile(resolve(output, '结果记录.json'), JSON.stringify(records, null, 2));
    await writeFile(resolve(output, `${job.id}-${job.name}.png`), await downloadImage(result.images[0]), { flag: 'wx' });
    records.at(-1).downloaded = true;
    await writeFile(resolve(output, '结果记录.json'), JSON.stringify(records, null, 2));
    console.log(`已保存：${job.name}`);
  }
  console.log(`已完成 ${jobs.length} 组，图片与原照保存在：${output}`);
}

main().catch(error => {
  // Never print the raw fetch error, request, response, URL or environment (may contain credentials).
  const key = process.env.DASHSCOPE_API_KEY;
  const message = error instanceof Error ? error.message : '测试失败。';
  console.error(key ? message.split(key).join('[密钥已隐藏]') : message);
  process.exitCode = 1;
});
