const form = document.querySelector('#drawing-form');
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
      if (!response.ok) throw new Error('额度服务暂不可用，请稍后再试。');
      const info = await response.json();
      login.hidden = info.signedIn || info.freeRemaining > 0;
      purchase.hidden = !info.signedIn || info.freeRemaining > 0 || info.paidRemaining > 0;
      allowanceText.textContent = info.signedIn
        ? `免费剩余 ${info.freeRemaining} 次，付费剩余 ${info.paidRemaining} 次。${purchase.hidden ? '' : '继续生成需要购买，购买功能暂未开放。'}`
        : info.freeRemaining > 0 ? '免登录可体验 1 次，登录后再享 1 次免费生成。' : '免登录体验已用完，登录后再享 1 次免费生成。';
      return info;
    }).finally(() => { checkingAllowance = undefined; });
  return checkingAllowance;
}

refreshAllowance().catch(() => { allowanceText.textContent = '额度暂时无法读取，请稍后重试。'; });
globalThis.addEventListener?.('focus', () => { refreshAllowance().catch(() => {}); });

fileInput.addEventListener('change', () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  preview.hidden = true;
  const file = fileInput.files[0];
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) {
    status.textContent = '请选择不超过 3 MB 的 JPG、PNG 或 WebP 图片。';
    fileInput.value = '';
    return;
  }
  previewUrl = URL.createObjectURL(file);
  preview.src = previewUrl;
  preview.hidden = false;
  status.textContent = '照片已准备好，选择画风后即可生成。';
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity() || submit.disabled) return;
  const payload = new FormData(form);
  const buttonText = submit.textContent;
  const startedAt = Date.now();
  loading.hidden = false;
  elapsed.textContent = '已等待 0 秒';
  submit.textContent = '正在生成…';
  const waitingTimer = setInterval(() => {
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    elapsed.textContent = `已等待 ${seconds} 秒`;
    if (seconds >= 60) status.textContent = '仍在生成，等待时间比平时稍长。请保持页面打开，不要重复提交。';
  }, 1000);
  submit.disabled = true;
  fileInput.disabled = true;
  form.querySelector('select').disabled = true;
  form.setAttribute('aria-busy', 'true');
  login.hidden = true;
  status.textContent = '正在绘制，通常需要几十秒，请保持页面打开，不要重复提交……';
  try {
    const info = await refreshAllowance();
    if (info.busy) throw new Error('已有图片正在生成，请等待完成。');
    if (info.freeRemaining + info.paidRemaining === 0) {
      status.textContent = info.signedIn ? '免费额度已用完，购买功能尚未开放，目前暂不收款。' : '请先登录，继续使用免费生成额度。';
      return;
    }
    const response = await fetch('/api/hand-drawn-photo', { method: 'POST', body: payload, credentials: 'same-origin' });
    let data;
    try { data = await response.json(); } catch { throw new Error('服务器响应异常，请先检查调用记录再重试。'); }
    if (response.status === 401) login.hidden = false;
    if (response.status === 402) purchase.hidden = false;
    if (!response.ok) throw new Error(data.error || '生成失败，请稍后再试。');
    const url = new URL(data.image);
    if (url.protocol !== 'https:') throw new Error('返回的图片地址无效。');
    resultUrl = url.href;
    downloadFallback = false;
    result.src = resultUrl;
    result.hidden = false;
    download.href = resultUrl;
    download.hidden = false;
    status.textContent = '生成成功！请及时下载保存，图片链接可能过期。';
  } catch (error) {
    status.textContent = error instanceof TypeError ? '连接中断，生成可能仍在进行。请先查看调用记录，避免重复扣费。' : error.message;
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
  status.textContent = '图片已生成，但预览加载失败。请使用“下载 / 打开原图”保存，不必重新生成。';
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
    link.download = 'AI手绘.png';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch {
    status.textContent = '浏览器无法直接下载，请再次点击链接打开原图后保存。';
    downloadFallback = true;
  }
});
