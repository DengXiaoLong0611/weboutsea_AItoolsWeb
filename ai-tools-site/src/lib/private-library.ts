import "server-only";
import drawingPromptSnapshots from '@/data/saved-drawing-prompts.json';
export const savedDrawingPrompts = drawingPromptSnapshots;
export const cleanupPrompt = "请编辑我上传的图片，清除短视频平台叠加的界面元素，让图片恢复成干净、完整的作品展示图。\n\n需要移除：\n1. 中间半透明的播放按钮。\n2. 右侧头像、用户名、关注加号，以及点赞、评论、收藏、分享按钮和数字。\n3. 顶部和底部的平台导航、标题文案、话题标签、音乐信息。\n4. 平台 Logo、平台水印、账号 ID 等叠加内容。\n\n修复要求：\n- 根据周围画面自然补全被遮挡区域，保持背景、纹理、色彩和笔触一致。\n- 保留原有主体、构图、人物表情、宠物外貌，以及手绘画面的风格。\n- 如果右上角有用于对照的原照片，请保留其位置、边框和内容；只清除覆盖在上面的平台界面元素。\n- 不要添加新文字、Logo、水印或其他装饰。\n- 尽量保持原始细节，不要重新设计画面，也不要随意改变人物或宠物。\n- 输出清晰、自然、没有明显涂抹痕迹的完整图片。";
export function isLibraryAdmin(email?: string) {
  return !!email && (process.env.PRIVATE_LIBRARY_ADMIN_EMAILS ?? "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
}
