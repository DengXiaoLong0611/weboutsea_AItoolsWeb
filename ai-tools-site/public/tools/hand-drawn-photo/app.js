const form = document.querySelector('#drawing-form');
const locale = /(?:^|\/)(en)(?:\/|$)/.test(globalThis.location?.pathname ?? '') ? 'en' : 'zh';
const en = locale === 'en';
const toolPath = en ? '/en/tools/hand-drawn-photo/' : '/zh/tools/hand-drawn-photo/';

function setText(selector, text) {
  const element = document.querySelector(selector);
  if (element) element.textContent = text;
}

if (en) {
  document.documentElement?.setAttribute('lang', 'en');
  document.title = 'AI Hand-drawn Photo Generator | AI Tools';
  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute('content', 'Turn pet photos and people-with-pet photos into warm oil-pastel illustration styles. Upload a photo and generate your own hand-drawn artwork.');
  setText('.wordmark', 'AI Tools');
  const wordmarkSub = document.querySelector('.wordmark span');
  if (wordmarkSub) wordmarkSub.textContent = 'AI Hand-drawn Photos';
  setText('header nav a:first-child', 'Back to tools');
  setText('header nav a:nth-child(2)', 'Pet Photo Layout');
  const intro = document.querySelector('.intro');
  if (intro) {
    const h1 = intro.querySelector('h1');
    if (h1) h1.innerHTML = 'Turn favorite moments<br><em>into warm companionship.</em>';
  }
  setText('.intro p', 'Pets and photos with pets can inspire a warm oil-pastel style. Compare the original photo with a hand-drawn reference first.');
  setText('.intro .link-button', 'Start generating ↓');
  setText('.intro-note', 'Upload photo · AI hand-drawn generation');
  const introParagraphs = document.querySelectorAll('.intro p');
  if (introParagraphs[1]) introParagraphs[1].textContent = 'Two guest-free generations: try once without login, then one more after signing in. After that, paid credits are required.';
  const introImage = intro?.querySelector('img');
  if (introImage) introImage.alt = 'Hand-drawn reference of a girl holding a white puppy, with the original photo in the upper-right corner';
  setText('.intro figcaption', 'Style reference, cleaned with AI. Not an actual output from this site.');
  setText('#drawing-heading', 'Turn a photo into a picture');
  setText('#drawing-studio > p', 'Upload a pet or people-and-pet photo. The default style follows the reference examples: bold black outlines, chibi shapes, and oil-pastel strokes.');
  setText('label[for="drawing-image"]', '1. Upload a photo');
  setText('#drawing-form > .drawing-help', 'JPG, PNG or WebP, up to 3 MB. During generation, the photo is sent to Alibaba Cloud Bailian for processing.');
  const sourcePreview = document.querySelector('#source-preview');
  if (sourcePreview) sourcePreview.alt = 'Uploaded original photo';
  setText('label[for="drawing-style"]', '2. Choose an art style');
  setText('#drawing-style option[value="1"]', 'Chibi oil pastel · Reference style');
  setText('#drawing-style option[value="2"]', 'Soft colored pencil · Fine details');
  setText('#drawing-style option[value="3"]', 'Crayon with white space · Cream paper');
  const drawingHelps = document.querySelectorAll('#drawing-form > .drawing-help');
  if (drawingHelps[1]) drawingHelps[1].textContent = 'The default Q-style oil-pastel look uses bold black outlines, full color blocks and a white background, drawing only the subject in your photo. Results can vary; the small original-photo window is not redrawn.';
  if (drawingHelps[2]) drawingHelps[2].textContent = 'Free credits do not reset daily. Signing in does not grant another new allowance. Failed generations return their credit and are never retried automatically.';
  if (drawingHelps.length) drawingHelps[drawingHelps.length - 1].textContent = 'Free credits do not reset daily. Signing in does not grant another new allowance. Failed generations return their credit and are never retried automatically.';
  setText('#generate', 'Generate');
  setText('#drawing-login', 'Sign in ↗');
  setText('#drawing-purchase h3', 'Keep creating');
  setText('#drawing-purchase > p:first-of-type', 'You have used both free generations. Continue by purchasing generation credits.');
  setText('#drawing-purchase > a', 'Sign in / Register ↗');
  setText('#drawing-purchase > p:nth-of-type(2)', 'Purchases are coming soon. No payment is collected yet. After launch, buy credits to keep creating.');
  const purchaseButton = document.querySelector('#drawing-purchase button');
  if (purchaseButton) purchaseButton.textContent = 'Buy generations (coming soon)';
  setText('.drawing-output h3', 'Your hand-drawn artwork');
  setText('#drawing-status', 'Your generated artwork will appear here.');
  setText('.drawing-loading-title', 'Painting your photo…');
  const progress = document.querySelector('.drawing-progress');
  if (progress) progress.setAttribute('aria-label', 'Generating artwork');
  setText('#drawing-elapsed', 'Waiting 0 seconds');
  setText('.drawing-loading-note', 'The first generation may take a little longer. Please keep this page open.');
  const resultPreview = document.querySelector('#drawing-result');
  if (resultPreview) resultPreview.alt = 'AI-generated hand-drawn artwork';
  setText('#download-result', 'Download / Open original ↗');
  setText('.drawing-output > .drawing-help', 'Save it promptly after generation. AI may change small details; examples below are style references only.');
  setText('#reference-heading', 'Companionship can look hand-drawn too.');
  setText('#hand-drawn-examples .section-heading p', 'Cute oil-pastel style references · Large hand-drawn image with an original-photo inset. Click to view full size.');
  setText('.reference-notice', 'The examples below were provided by users and cleaned with AI. Screens, and watermarks may have been removed; repaired areas may vary. These are not actual results from this site.');
  const captions = [
    ['Held close', 'Person and pet · Style reference'],
    ['A little everyday moment with my cat', 'Person and pet · Style reference'],
    ['A faithful friend by your side', 'Person and pet · Style reference'],
    ['An afternoon lying together', 'Person and pet · Style reference'],
    ['A fluffy embrace', 'Person and pet · Style reference'],
    ['A quiet presence beside you', 'Person and pet · Style reference'],
    ['Taking you along', 'Person and pet · Style reference'],
    ['A photo of us together', 'Person and pet · Style reference'],
    ['Turning everyday moments into art', 'Person and pet · Style reference'],
  ];
  document.querySelectorAll('#hand-drawn-examples figure').forEach((figure, index) => {
    const caption = captions[index];
    if (!caption) return;
    const title = figure.querySelector('figcaption');
    if (title) title.innerHTML = `${caption[0]}<span>${caption[1]}</span>`;
  });

  const nav = document.querySelector('header nav');
  if (nav && document.createElement) {
    nav.setAttribute('aria-label', 'Main navigation');
    const switcher = document.createElement('span');
    switcher.className = 'locale-switcher';
    switcher.innerHTML = '<a href="/zh/tools/hand-drawn-photo" lang="zh-CN">中文</a><span aria-hidden="true"> / </span><a href="/en/tools/hand-drawn-photo" lang="en" aria-current="page">English</a>';
    nav.appendChild(switcher);
  }
} else {
  const nav = document.querySelector('header nav');
  if (nav && document.createElement) {
    const switcher = document.createElement('span');
    switcher.className = 'locale-switcher';
    switcher.innerHTML = '<a href="/zh/tools/hand-drawn-photo" lang="zh-CN" aria-current="page">中文</a><span aria-hidden="true"> / </span><a href="/en/tools/hand-drawn-photo" lang="en">English</a>';
    nav.appendChild(switcher);
  }
  setText('.drawing-loading-title', '正在为照片绘制…');
  const progress = document.querySelector('.drawing-progress');
  if (progress) progress.setAttribute('aria-label', '正在生成手绘作品');
  setText('#drawing-elapsed', '已等待 0 秒');
  setText('.drawing-loading-note', '首次生成可能稍慢，请耐心等待，并保持页面打开。');
}
const fileInput = document.querySelector('#drawing-image');
const preview = document.querySelector('#source-preview');
const result = document.querySelector('#drawing-result');
const status = document.querySelector('#drawing-status');
const submit = document.querySelector('#generate');
const download = document.querySelector('#download-result');
const login = document.querySelector('#drawing-login');
const purchase = document.querySelector('#drawing-purchase');
const allowanceText = document.querySelector('#drawing-allowance');
const loading = document.querySelector('#drawing-loading');
const elapsed = document.querySelector('#drawing-elapsed');
let previewUrl;
let resultUrl;
let downloadFallback = false;
let checkingAllowance;

function refreshAllowance() {
  // Share an in-flight check so two tabs of UI events do not mint two cookies.
  checkingAllowance ??= fetch('/api/hand-drawn-photo', { credentials: 'same-origin', cache: 'no-store' })
    .then(async response => {
        if (!response.ok) throw new Error(en ? 'The allowance service is temporarily unavailable. Please try again.' : '额度服务暂不可用，请稍后再试。');
      const info = await response.json();
      login.hidden = info.signedIn || info.freeRemaining > 0;
      purchase.hidden = !info.signedIn || info.freeRemaining > 0 || info.paidRemaining > 0;
      allowanceText.textContent = en
        ? (info.signedIn
          ? `${info.freeRemaining} free credits and ${info.paidRemaining} paid credits remaining.${purchase.hidden ? '' : ' Purchasing is coming soon.'}`
          : info.freeRemaining > 0 ? '1 free guest generation available before sign-in.' : 'Guest trials are used up. Sign in for one free generation.')
        : info.signedIn
        ? `免费剩余 ${info.freeRemaining} 次，付费剩余 ${info.paidRemaining} 次。${purchase.hidden ? '' : '继续生成需要购买，购买功能暂未开放。'}`
        : info.freeRemaining > 0 ? '免登录可体验 1 次，登录后再享 1 次免费生成。' : '免登录体验已用完，登录后再享 1 次免费生成。';
      return info;
    }).finally(() => { checkingAllowance = undefined; });
  return checkingAllowance;
}

refreshAllowance().catch(() => { allowanceText.textContent = en ? 'The allowance could not be loaded. Please try again.' : '额度暂时无法读取，请稍后重试。'; });
if (en) {
  login.href = `/auth/login?next=${encodeURIComponent(toolPath)}`;
  purchase.querySelector('a')?.setAttribute('href', `/auth/login?next=${encodeURIComponent(toolPath)}`);
}
globalThis.addEventListener?.('focus', () => { refreshAllowance().catch(() => {}); });

fileInput.addEventListener('change', () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  preview.hidden = true;
  const file = fileInput.files[0];
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) {
    status.textContent = en ? 'Please choose a JPG, PNG or WebP image no larger than 3 MB.' : '请选择不超过 3 MB 的 JPG、PNG 或 WebP 图片。';
    fileInput.value = '';
    return;
  }
  previewUrl = URL.createObjectURL(file);
  preview.src = previewUrl;
  preview.hidden = false;
  status.textContent = en ? 'Your photo is ready. Choose a style and generate.' : '照片已准备好，选择画风后即可生成。';
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity() || submit.disabled) return;
  const payload = new FormData(form);
  const buttonText = submit.textContent;
  const startedAt = Date.now();
  loading.hidden = false;
  elapsed.textContent = en ? 'Waiting 0 seconds' : '已等待 0 秒';
  submit.textContent = en ? 'Generating…' : '正在生成…';
  const waitingTimer = setInterval(() => {
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    elapsed.textContent = en ? `Waiting ${seconds} seconds` : `已等待 ${seconds} 秒`;
    if (seconds >= 60) status.textContent = en ? 'Still generating. This is taking longer than usual. Keep the page open and do not submit again.' : '仍在生成，等待时间比平时稍长。请保持页面打开，不要重复提交。';
  }, 1000);
  submit.disabled = true;
  fileInput.disabled = true;
  form.querySelector('select').disabled = true;
  form.setAttribute('aria-busy', 'true');
  login.hidden = true;
  status.textContent = en ? 'Drawing your image. This usually takes several seconds. Keep the page open and do not submit again…' : '正在绘制，通常需要几十秒，请保持页面打开，不要重复提交……';
  try {
    const info = await refreshAllowance();
    if (info.busy) throw new Error(en ? 'An image is already being generated. Please wait for it to finish.' : '已有图片正在生成，请等待完成。');
    if (info.freeRemaining + info.paidRemaining === 0) {
      status.textContent = info.signedIn
        ? (en ? 'Free credits are used up. Purchases are not available yet.' : '免费额度已用完，购买功能尚未开放，目前暂不收款。')
        : (en ? 'Please sign in to use the remaining free generation.' : '请先登录，继续使用免费生成额度。');
      return;
    }
    const response = await fetch('/api/hand-drawn-photo', { method: 'POST', body: payload, credentials: 'same-origin' });
    let data;
    try { data = await response.json(); } catch { throw new Error(en ? 'The server returned an unexpected response. Please try again.' : '服务器响应异常，请先检查调用记录再重试。'); }
    if (response.status === 401) login.hidden = false;
    if (response.status === 402) purchase.hidden = false;
    if (!response.ok) throw new Error(en ? (data.error || 'Generation failed. Please try again.') : (data.error || '生成失败，请稍后再试。'));
    const url = new URL(data.image);
    if (url.protocol !== 'https:') throw new Error(en ? 'The generated image URL is invalid.' : '返回的图片地址无效。');
    resultUrl = url.href;
    downloadFallback = false;
    result.src = resultUrl;
    result.hidden = false;
    download.href = resultUrl;
    download.hidden = false;
    status.textContent = en ? 'Generation complete! Download and save it promptly; the image link may expire.' : '生成成功！请及时下载保存，图片链接可能过期。';
  } catch (error) {
    status.textContent = error instanceof TypeError
      ? (en ? 'The connection was interrupted. Generation may still be in progress. Check the status before retrying to avoid duplicate charges.' : '连接中断，生成可能仍在进行。请先查看调用记录，避免重复扣费。')
      : error.message;
  } finally {
    clearInterval(waitingTimer);
    loading.hidden = true;
    submit.textContent = buttonText;
    submit.disabled = false;
    fileInput.disabled = false;
    form.querySelector('select').disabled = false;
    form.setAttribute('aria-busy', 'false');
    refreshAllowance().catch(() => {});
  }
});

result.addEventListener('error', () => {
  status.textContent = en ? 'The image was generated, but its preview could not load. Use “Download / Open original” to save it without generating again.' : '图片已生成，但预览加载失败。请使用“下载 / 打开原图”保存，不必重新生成。';
});
download.addEventListener('click', async event => {
  if (downloadFallback) return;
  event.preventDefault();
  if (!resultUrl) return;
  try {
    const response = await fetch(resultUrl);
    if (!response.ok) throw new Error('download failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = en ? 'AI-hand-drawn.png' : 'AI手绘.png';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch {
    status.textContent = en ? 'Your browser could not download it directly. Open the original image link and save it.' : '浏览器无法直接下载，请再次点击链接打开原图后保存。';
    downloadFallback = true;
  }
});
