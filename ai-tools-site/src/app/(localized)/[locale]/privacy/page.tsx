import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return {
    title: locale === 'zh' ? '隐私政策 · Beside & Bloom' : 'Privacy Policy · Beside & Bloom',
  };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const zh = locale === 'zh';
  return <main style={{ maxWidth: 760, margin: '0 auto', padding: '3rem 1.25rem', lineHeight: 1.75 }}>
    <h1>{zh ? '隐私政策' : 'Privacy Policy'}</h1>
    <p>{zh ? '最近更新：2026年11月24日' : 'Last updated: November 24, 2026'}</p>
    <h2>{zh ? '我们处理的信息' : 'Information we process'}</h2>
    <p>{zh
      ? 'Beside & Bloom 在你主动上传人物与宠物照片、生成合照、发起支付或发送删除请求时处理相关数据。我们可能保存访客标识、场景选择、生成状态、生成结果、支付状态及相关安全日志。'
      : 'Beside & Bloom processes data when you upload a person or pet photo, create portraits, initiate payment, or request deletion. We may retain a visitor identifier, selected scenes, generation status, generated results, payment status and necessary security logs.'}</p>
    <h2>{zh ? '照片如何使用' : 'How photos are used'}</h2>
    <p>{zh
      ? '你上传的照片会发送给配置的第三方 AI 图像服务，仅用于生成你请求的合照。草稿照片在处理完成后应从业务存储中删除；预览和已购买的生成结果按下述保留期保存。除非法律要求或另行获得明确许可，我们不会公开、出售或用于其他客户的广告素材。'
      : 'Uploaded photos are sent to our configured third-party AI image provider solely to create the portraits you request. Draft photos should be removed from business storage after processing. Previews and purchased results are retained according to the retention policy below. We do not publish or sell your photos or use them for other customers’ advertising unless legally required or separately authorized.'}</p>
    <h2>{zh ? '第三方服务' : 'Third-party services'}</h2>
    <p>{zh
      ? '我们使用 Supabase 保存受控数据和私有图片，使用百炼或 DashScope 提供图像生成，使用 Stripe 处理支付。第三方各自依据其政策处理和保护数据。'
      : 'We use Supabase for controlled records and private image storage, DashScope/Bailian for image generation, and Stripe for payment processing. Each provider processes and protects data according to its own terms and policies.'}</p>
    <h2>{zh ? '保留与删除' : 'Retention and deletion'}</h2>
    <p>{zh
      ? '访客草稿默认保留期为 30 天，完成的预览和高清图也不应在未通知用户的情况下无限保存。你可以在画廊使用删除功能，删除私有预览、高清图、草稿、任务记录及访客数据。已支付记录可能根据税务、退款和欺诈调查要求保留必要的最少字段。'
      : 'Visitor drafts are retained for 30 days by default, and completed previews or full-resolution images are not intended to remain indefinitely without notice. Use the gallery deletion control to remove private previews, full images, drafts, job records and visitor data. Minimum payment records may be retained where required for tax, refund or fraud investigation obligations.'}</p>
    <h2>{zh ? '你的权利与请求' : 'Your rights and requests'}</h2>
    <p>{zh
      ? '你可以申请访问、更正或删除个人数据，并撤回对后续处理的许可（撤回不影响撤回前的合法处理）。如需删除或隐私协助，请联系网站支持邮箱。'
      : 'You may request access, correction or deletion of personal data and withdraw consent for future processing, where consent applies. Withdrawal does not affect processing that was lawful before withdrawal. Contact the site support address for deletion or privacy assistance.'}</p>
  </main>;
}
