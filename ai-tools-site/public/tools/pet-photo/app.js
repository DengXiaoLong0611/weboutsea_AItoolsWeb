'use strict';
const $ = (selector) => document.querySelector(selector);
const canvas = $('#print');
const ctx = canvas.getContext('2d');
const photos = ['assets/demo/蛋蛋原照-抱玩偶.jpg', 'assets/demo/蛋蛋原照-躲沙发.png'];
const formats = { '5x7': [1500, 2100, '5 × 7 in'], '4x6': [1200, 1800, '4 × 6 in'], a4: [2480, 3508, 'A4'] };
const state = { image: null, style: 'arch', photo: 0, busy: false, imageToken: 0, objectUrl: null };
let videoUrl;

function fitText(text, maxWidth, startSize, font) {
  let size = startSize;
  do { ctx.font = `${size}px ${font}`; size -= 2; } while (ctx.measureText(text).width > maxWidth && size > 14);
}

function render() {
  if (!state.image) return;
  const [w, h, label] = formats[$('#size').value];
  canvas.width = w; canvas.height = h;
  const classic = state.style === 'classic';
  const note = state.style === 'polaroid';
  ctx.fillStyle = note ? '#ede9de' : '#fffaf0'; ctx.fillRect(0, 0, w, h);
  const x = w * .105, y = h * .08, pw = w * .79, ph = h * (note ? .66 : .65);
  ctx.save(); ctx.beginPath();
  if (state.style === 'arch') {
    const r = pw / 2;
    ctx.moveTo(x, y + ph); ctx.lineTo(x, y + r); ctx.arc(x + r, y + r, r, Math.PI, 0);
    ctx.lineTo(x + pw, y + ph); ctx.closePath();
  } else ctx.rect(x, y, pw, ph);
  ctx.clip();
  const zoom = Number($('#zoom').value);
  const scale = Math.max(pw / state.image.width, ph / state.image.height) * zoom;
  const iw = state.image.width * scale, ih = state.image.height * scale;
  ctx.drawImage(state.image, x + (pw - iw) / 2, y + (ph - ih) * Number($('#position').value), iw, ih);
  ctx.restore();
  ctx.textAlign = 'center'; ctx.fillStyle = '#42543d';
  const name = $('#pet-name').value.trim() || 'Your little love';
  fitText(note ? name : name.toUpperCase(), w * .84, w * .075, 'Georgia, serif');
  ctx.fillText(note ? name : name.toUpperCase(), w / 2, h * .825);
  ctx.strokeStyle = '#ba815a'; ctx.lineWidth = w * .001;
  ctx.beginPath(); ctx.moveTo(w * .37, h * .855); ctx.lineTo(w * .63, h * .855); ctx.stroke();
  ctx.fillStyle = '#626856';
  fitText($('#caption').value, w * .82, w * .028, 'Georgia, serif');
  ctx.fillText($('#caption').value, w / 2, h * .89);
  if (classic) { ctx.strokeStyle = '#a3ab96'; ctx.lineWidth = 2; ctx.strokeRect(w * .045, h * .035, w * .91, h * .93); }
  $('#format-label').textContent = label;
  const effectivePpi = Math.round(300 / scale);
  $('#resolution').textContent = effectivePpi < 200
    ? `当前尺寸约 ${effectivePpi} PPI。建议用更小的打印尺寸或更清晰的原图；导出尺寸不会增加照片细节。`
    : `当前尺寸约 ${effectivePpi} PPI。导出像素按 300 PPI 尺寸计算，打印时可能需要手动设置纸张大小。`;
}

async function loadPhoto(src, index = -1) {
  const token = ++state.imageToken;
  const image = new Image(); image.src = src;
  try {
    await image.decode();
    if (token !== state.imageToken) return;
    if (image.width * image.height > 50000000) throw new Error('large');
    state.image = image; state.photo = index;
    $('#zoom').value = '1'; $('#position').value = index === 1 ? '0.15' : '0.5';
    document.querySelectorAll('[data-photo]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.photo) === index)));
    $('#status').textContent = ''; render();
  } catch {
    if (token === state.imageToken) $('#status').textContent = '无法打开这张照片。请尝试 JPG、PNG 或 WebP，且不超过 5000 万像素。';
  }
}

document.querySelectorAll('[data-photo]').forEach(b => b.addEventListener('click', () => { loadPhoto(photos[Number(b.dataset.photo)], Number(b.dataset.photo)); }));
document.querySelectorAll('[data-style]').forEach(b => b.addEventListener('click', () => {
  state.style = b.dataset.style;
  document.querySelectorAll('[data-style]').forEach(s => s.setAttribute('aria-pressed', String(s === b)));
  render();
}));
['pet-name', 'caption', 'zoom', 'position', 'size'].forEach(id => $('#' + id).addEventListener('input', render));
$('#upload').addEventListener('change', async (event) => {
  const file = event.target.files[0]; if (!file) return;
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) {
    $('#status').textContent = '请选择小于 15 MB 的 JPG、PNG 或 WebP 图片。'; event.target.value = ''; return;
  }
  const url = URL.createObjectURL(file); await loadPhoto(url);
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  state.objectUrl = url;
});

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
$('#download').addEventListener('click', () => {
  if (!state.image) { $('#status').textContent = '请等待照片加载完成。'; return; }
  canvas.toBlob(blob => {
    if (!blob) { $('#status').textContent = '导出失败，请重试。'; return; }
    const name = ($('#pet-name').value.trim() || 'pet').replace(/[^\p{L}\p{N}_-]/gu, '-');
    downloadBlob(blob, `${name}-${$('#size').value}-print.png`);
    $('#status').textContent = '纪念照已下载，打印时请选择对应的纸张尺寸。';
  }, 'image/png');
});

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let demoStep = 'Your favorite photo, made personal.';
let highlighted = null;
function highlight(selector, caption) {
  document.querySelectorAll('.demo-active').forEach(e => e.classList.remove('demo-active'));
  highlighted = $(selector); highlighted.classList.add('demo-active'); demoStep = caption;
}
async function walkthrough(recording = false) {
  if (state.busy) return;
  state.busy = true;
  const saved = { image: state.image, photo: state.photo, style: state.style, name: $('#pet-name').value, caption: $('#caption').value, size: $('#size').value, zoom: $('#zoom').value, position: $('#position').value };
  $('#demo').disabled = true; $('#record').disabled = true; $('#watch-top').disabled = true;
  $('#controls').inert = true;
  $('#studio').scrollIntoView({ behavior: 'instant', block: 'start' });
  let recorder, stream, frameId;
  try {
    if (recording) {
      if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) throw new Error('Video export is unavailable in this browser. Try Chrome or Edge.');
      const output = document.createElement('canvas'); output.width = 1280; output.height = 800;
      const v = output.getContext('2d');
      function drawVideo() {
        v.fillStyle = '#faf7f0'; v.fillRect(0, 0, 1280, 800);
        v.fillStyle = '#344536'; v.font = '30px Georgia'; v.fillText('宠物照片 · Pet Photos', 55, 65);
        v.font = '18px Arial'; v.fillText('Photo → Personalize → Print', 55, 110);
        v.font = '16px Arial'; v.fillStyle = '#aa4c2e'; v.fillText('LIVE EDITOR WALKTHROUGH', 55, 180);
        v.fillStyle = '#344536'; v.font = '24px Georgia';
        const words = demoStep.split(' '); let line = '', yy = 228;
        for (const word of words) { if (v.measureText(line + word).width > 480) { v.fillText(line, 55, yy); yy += 36; line = ''; } line += word + ' '; } v.fillText(line, 55, yy);
        v.font = '18px Arial'; v.fillText(`Name: ${$('#pet-name').value}`, 55, 360);
        v.fillText(`Style: ${state.style === 'arch' ? 'The Arch' : state.style === 'classic' ? 'Classic' : 'Little Note'}`, 55, 405);
        v.fillText(`Print size: ${formats[$('#size').value][2]}`, 55, 450);
        v.fillStyle = '#3e5743'; v.fillRect(55, 505, 445, 62); v.fillStyle = '#ffffff'; v.font = '17px Arial';
        v.fillText(highlighted?.textContent.trim().slice(0, 42) || 'Customize your print', 75, 544);
        v.fillStyle = '#626856'; v.font = '14px Arial'; v.fillText('Uses the same editor actions as the website.', 55, 690);
        v.fillText('Silent demo · original Dandan photographs', 55, 718);
        const hh = 650, ww = hh * canvas.width / canvas.height;
        v.fillStyle = '#b58c61'; v.fillRect(720 - 14, 70 - 14, ww + 28, hh + 28);
        v.drawImage(canvas, 720, 70, ww, hh);
        frameId = requestAnimationFrame(drawVideo);
      }
      drawVideo(); stream = output.captureStream(24);
      const mime = ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t => MediaRecorder.isTypeSupported(t));
      if (!mime) throw new Error('WebM export is unavailable. Please try Chrome or Edge.');
      const chunks = []; recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3000000 });
      recorder.addEventListener('dataavailable', e => { if (e.data.size) chunks.push(e.data); });
      recorder.addEventListener('stop', () => {
        if (videoUrl) URL.revokeObjectURL(videoUrl);
        videoUrl = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }));
        $('#video').src = videoUrl; $('#video').hidden = false; $('#video-empty').hidden = true;
        $('#video-download').href = videoUrl; $('#video-download').download = 'pet-photo-demo.webm'; $('#video-download').textContent = '下载新操作演示 · WebM ↓'; $('#video-download').hidden = false;
        $('#video-status').textContent = '演示视频已生成，可在下方播放或下载 WebM。';
      }, { once: true });
      recorder.start(); $('#video-status').textContent = '正在生成操作演示，约需 15 秒…';
    }
    $('#size').value = '5x7'; $('#pet-name').value = 'Dandan'; $('#caption').value = 'My little everyday joy';
    highlight('[data-photo="0"]', 'Choose a favorite photo'); $('[data-photo="0"]').click(); await pause(2800);
    highlight('#pet-name', 'Add their name and a little message'); $('#pet-name').value = 'Dandan'; $('#caption').value = 'Small paws. A whole lot of love.'; $('#caption').dispatchEvent(new Event('input')); await pause(2800);
    highlight('[data-style="classic"]', 'Try the Classic print'); $('[data-style="classic"]').click(); await pause(2800);
    highlight('[data-photo="1"]', 'A second photo, another little memory'); $('[data-photo="1"]').click(); await pause(2800);
    highlight('[data-style="arch"]', 'Choose The Arch and download your print'); $('[data-style="arch"]').click(); await pause(2800);
    highlight('#download', 'Download the personalized PNG'); $('#download').click(); await pause(1300);
  } catch (error) {
    $('#video-status').textContent = error.message || 'The demo could not finish. Please try again.';
  } finally {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    if (frameId) cancelAnimationFrame(frameId);
    if (stream) stream.getTracks().forEach(track => track.stop());
    ++state.imageToken;
    state.image = saved.image; state.photo = saved.photo;
    $('#pet-name').value = saved.name; $('#caption').value = saved.caption; $('#size').value = saved.size;
    $('#zoom').value = saved.zoom; $('#position').value = saved.position;
    document.querySelectorAll('[data-photo]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.photo) === saved.photo)));
    $(`[data-style="${saved.style}"]`).click();
    document.querySelectorAll('.demo-active').forEach(e => e.classList.remove('demo-active'));
    $('#controls').inert = false; $('#demo').disabled = false; $('#record').disabled = false; $('#watch-top').disabled = false; state.busy = false;
  }
}
$('#demo').addEventListener('click', () => walkthrough());
$('#watch-top').addEventListener('click', () => walkthrough());
$('#record').addEventListener('click', () => walkthrough(true));
loadPhoto(photos[0], 0);
