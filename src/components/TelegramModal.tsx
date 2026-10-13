import React, { useState, useEffect } from 'react';
import { useCalendar } from '../context/CalendarContext';
import {
  X,
  Send,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Bot,
  Key,
  Globe,
  Radio,
  Sparkles,
} from 'lucide-react';

interface TelegramModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TelegramStatusData {
  configured: boolean;
  hasToken: boolean;
  tokenSource?: 'env' | 'settings' | null;
  tokenMasked?: string;
  botInfo?: {
    id: number;
    first_name: string;
    username?: string;
  } | null;
  botError?: string | null;
  webhookInfo?: {
    url?: string;
    has_custom_certificate?: boolean;
    pending_update_count?: number;
    last_error_date?: number;
    last_error_message?: string;
    max_connections?: number;
  } | null;
  currentWebhookUrl?: string;
  suggestedWebhookUrl?: string;
  isWebhookMatching?: boolean;
  error?: string;
}

export const TelegramModal: React.FC<TelegramModalProps> = ({ isOpen, onClose }) => {
  const { language, settings, updateSettings } = useCalendar();
  const isZh = language === 'zh';

  const [status, setStatus] = useState<TelegramStatusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [tokenInput, setTokenInput] = useState(settings.telegramBotToken || '');
  const [savingToken, setSavingToken] = useState(false);
  const [testChatId, setTestChatId] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/telegram/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (data.tokenMasked && !tokenInput) {
          // Token is set on backend
        }
      } else {
        setFeedback({ type: 'error', message: 'Failed to query Telegram status endpoint.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Network error fetching status.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      if (settings.telegramBotToken) {
        setTokenInput(settings.telegramBotToken);
      }
    }
  }, [isOpen, settings.telegramBotToken]);

  const handleRegisterWebhook = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingToken(true);
    setFeedback(null);

    try {
      const trimmedToken = tokenInput.trim();
      const res = await fetch('/api/telegram/set-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: trimmedToken || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (trimmedToken) {
          await updateSettings({ telegramBotToken: trimmedToken });
        }
        setFeedback({
          type: 'success',
          message: isZh
            ? `成功连接 Telegram Webhook！${data.description || ''}`
            : `Telegram Webhook registered successfully! ${data.description || ''}`,
        });
        await fetchStatus();
      } else {
        setFeedback({
          type: 'error',
          message: data.error || (isZh ? '注册 Webhook 失败，请检查 Token。' : 'Failed to register webhook. Please verify your token.'),
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || (isZh ? '网络错误' : 'Network error'),
      });
    } finally {
      setSavingToken(false);
    }
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testChatId.trim()) return;
    setSendingTest(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/telegram/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: testChatId.trim(),
          text: isZh
            ? '🌸 收到来自 FamilySync SG Calendar 的测试消息！机器人运行正常。'
            : '🌸 Test message received from FamilySync SG Calendar! Your bot is working properly.',
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setFeedback({
          type: 'success',
          message: isZh ? '测试消息已成功发送至 Telegram！' : 'Test message sent successfully to Telegram!',
        });
      } else {
        setFeedback({
          type: 'error',
          message: data.error || data.description || (isZh ? '发送失败，请确保您已在 Telegram 向机器人发送过 /start。' : 'Send failed. Make sure you started the bot in Telegram first.'),
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Error sending test message.',
      });
    } finally {
      setSendingTest(false);
    }
  };

  const handleCopyUrl = (urlToCopy?: string) => {
    const text = urlToCopy || status?.suggestedWebhookUrl || `${window.location.origin}/api/telegram`;
    navigator.clipboard.writeText(text);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  if (!isOpen) return null;

  const currentUrl = status?.currentWebhookUrl || '';
  const suggestedUrl = status?.suggestedWebhookUrl || `${window.location.origin}/api/telegram`;
  const isConnected = Boolean(status?.configured && status?.botInfo && status?.isWebhookMatching);
  const hasToken = Boolean(status?.hasToken || tokenInput.trim());
  const pendingUpdates = status?.webhookInfo?.pending_update_count ?? 0;
  const lastError = status?.webhookInfo?.last_error_message;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-zinc-200 max-h-[92vh] flex flex-col justify-between">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-sky-600 to-blue-700 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shadow-inner">
              <Send className="w-5 h-5 -rotate-12 translate-x-0.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg">
                  {isZh ? 'Telegram 机器人连接与诊断' : 'Telegram Bot Connection & Diagnostics'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-3xs font-black bg-white/25 text-white uppercase tracking-wider">
                  Live
                </span>
              </div>
              <p className="text-xs text-blue-100">
                {isZh
                  ? '实时诊断为什么机器人未响应，并一键完成 Webhook 绑定'
                  : 'Diagnose why your bot is not responding and connect webhooks'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-blue-100 hover:text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Feedback Banner */}
          {feedback && (
            <div
              className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 border ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-rose-50 text-rose-800 border-rose-300'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <div className="flex-1">{feedback.message}</div>
            </div>
          )}

          {/* Diagnostics Status Card */}
          <div
            className={`border rounded-2xl p-4 sm:p-5 transition-all ${
              isConnected
                ? 'bg-emerald-50/70 border-emerald-300 shadow-xs'
                : !hasToken
                ? 'bg-amber-50/80 border-amber-300'
                : 'bg-rose-50/70 border-rose-300'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isConnected
                      ? 'bg-emerald-600 text-white'
                      : !hasToken
                      ? 'bg-amber-500 text-white'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  {isConnected ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-sm text-zinc-950">
                      {isConnected
                        ? isZh
                          ? '机器人正常在线：Webhook 已连接'
                          : 'Bot Active & Webhook Connected'
                        : !hasToken
                        ? isZh
                          ? '未配置 Telegram 机器人 Token'
                          : 'Bot Token Not Configured'
                        : isZh
                        ? 'Webhook 未绑定至当前服务器'
                        : 'Webhook Not Pointing to Current Server'}
                    </h4>
                  </div>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {isConnected
                      ? isZh
                        ? `机器人 @${status?.botInfo?.username || 'AhmaBot'} 正在接收消息，随时为您服务！`
                        : `Bot @${status?.botInfo?.username || 'AhmaBot'} is live and answering queries.`
                      : !hasToken
                      ? isZh
                        ? '请输入从 @BotFather 获取的 Bot Token，然后点击保存绑定。'
                        : 'Enter your bot token from @BotFather below and click Register.'
                      : isZh
                      ? 'Telegram 目前将消息发送到了旧地址或未注册 Webhook，请点击下方“一键重新绑定”。'
                      : 'Telegram is routing updates to an outdated URL or not set. Re-register webhook below.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={fetchStatus}
                disabled={loading}
                className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-800 shadow-2xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{isZh ? '刷新状态' : 'Refresh'}</span>
              </button>
            </div>

            {/* Detailed metadata pills */}
            <div className="mt-4 pt-3.5 border-t border-zinc-200/80 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="bg-white/80 p-2.5 rounded-xl border border-zinc-200/60">
                <span className="text-3xs font-black uppercase text-zinc-400 block mb-0.5">
                  {isZh ? '机器人账号' : 'Bot Account'}
                </span>
                <span className="font-bold text-zinc-900 flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-sky-600" />
                  {status?.botInfo ? (
                    <>
                      <span>{status.botInfo.first_name}</span>
                      {status.botInfo.username && (
                        <a
                          href={`https://t.me/${status.botInfo.username}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-600 hover:underline inline-flex items-center gap-0.5"
                        >
                          @{status.botInfo.username}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </>
                  ) : (
                    <span className="text-zinc-500 italic">{isZh ? '未识别' : 'Unknown / Not validated'}</span>
                  )}
                </span>
              </div>

              <div className="bg-white/80 p-2.5 rounded-xl border border-zinc-200/60">
                <span className="text-3xs font-black uppercase text-zinc-400 block mb-0.5">
                  {isZh ? '待处理消息队列' : 'Pending Telegram Updates'}
                </span>
                <span className="font-bold text-zinc-900 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-blue-600" />
                  <span>
                    {pendingUpdates} {isZh ? '条待处理消息' : 'queued updates'}
                  </span>
                </span>
              </div>
            </div>

            {/* Last Telegram Error Warning */}
            {lastError && (
              <div className="mt-3 p-2.5 rounded-xl bg-rose-100/90 border border-rose-300 text-xs text-rose-900">
                <span className="font-bold block mb-0.5">
                  {isZh ? '⚠️ Telegram 汇报的最近一次报错：' : '⚠️ Last Error Reported by Telegram:'}
                </span>
                <span className="font-mono text-3xs break-all">{lastError}</span>
              </div>
            )}
          </div>

          {/* Form 1: Bot Token & Webhook Registration */}
          <form onSubmit={handleRegisterWebhook} className="space-y-4 border border-zinc-200 rounded-2xl p-4 sm:p-5 bg-zinc-50/60">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-sky-600" />
              <h4 className="font-black text-sm text-zinc-950">
                {isZh ? '1. 配置 Bot Token 并绑定 Webhook' : '1. Configure Bot Token & Register Webhook'}
              </h4>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                {isZh ? 'Telegram Bot API Token (来自 @BotFather)' : 'Telegram Bot API Token (from @BotFather)'}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="flex-1 px-3.5 py-2 border border-zinc-300 rounded-xl text-xs font-mono bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="submit"
                  disabled={savingToken || !tokenInput.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  {savingToken ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{isZh ? '保存并注册' : 'Save & Register'}</span>
                </button>
              </div>
              <p className="text-3xs text-zinc-500 mt-1.5 leading-relaxed">
                {isZh
                  ? '点击后会自动调用 Telegram API 将 Webhook 网址绑定到当前应用地址。'
                  : 'Clicking this calls Telegram API to route all future bot messages to this app.'}
              </p>
            </div>

            {/* Current & Target Webhook URLs */}
            <div className="space-y-2 pt-2 border-t border-zinc-200 text-xs">
              <div>
                <span className="text-3xs font-bold text-zinc-500 uppercase block mb-1">
                  {isZh ? '当前应用 Webhook 地址 (Suggested Target)' : 'Target Webhook URL'}
                </span>
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white border border-zinc-200 font-mono text-3xs text-zinc-800 break-all">
                  <span>{suggestedUrl}</span>
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(suggestedUrl)}
                    className="p-1 hover:bg-zinc-100 rounded text-zinc-500 shrink-0"
                    title="Copy URL"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {currentUrl && (
                <div>
                  <span className="text-3xs font-bold text-zinc-500 uppercase block mb-1">
                    {isZh ? 'Telegram 服务器目前记录的 Webhook 地址' : 'Currently Registered in Telegram'}
                  </span>
                  <div
                    className={`p-2 rounded-lg font-mono text-3xs break-all border ${
                      status?.isWebhookMatching
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        : 'bg-amber-50 text-amber-900 border-amber-200'
                    }`}
                  >
                    {currentUrl}
                  </div>
                </div>
              )}
            </div>
          </form>

          {/* Form 2: Test Message */}
          <form onSubmit={handleSendTestMessage} className="space-y-3 border border-zinc-200 rounded-2xl p-4 sm:p-5 bg-zinc-50/60">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-600" />
              <h4 className="font-black text-sm text-zinc-950">
                {isZh ? '2. 发送测试消息' : '2. Send Test Message'}
              </h4>
            </div>

            <p className="text-xs text-zinc-600">
              {isZh
                ? '在 Telegram 打开您的机器人，点击 /start 后，输入您的 Chat ID 进行测试。'
                : 'Start your bot on Telegram, then input your Chat ID below to verify message delivery.'}
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder={isZh ? '输入您的 Telegram Chat ID (例如 123456789)' : 'Telegram Chat ID (e.g. 123456789)'}
                value={testChatId}
                onChange={(e) => setTestChatId(e.target.value)}
                className="flex-1 px-3.5 py-2 border border-zinc-300 rounded-xl text-xs font-mono bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={sendingTest || !testChatId.trim()}
                className="px-4 py-2 rounded-xl text-xs font-black bg-zinc-900 hover:bg-zinc-800 text-white shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
              >
                {sendingTest ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{isZh ? '发送测试' : 'Send Test'}</span>
              </button>
            </div>
          </form>

          {/* Setup Guide */}
          <div className="border border-zinc-200 rounded-2xl p-4 sm:p-5 bg-white space-y-3">
            <h4 className="font-black text-sm text-zinc-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              {isZh ? '如何创建并启用机器人（只需 1 分钟）' : 'Quick 1-Minute Setup Guide'}
            </h4>
            <ol className="list-decimal list-inside space-y-2 text-xs text-zinc-700 leading-relaxed font-medium">
              <li>
                {isZh ? (
                  <>在 Telegram 搜索 <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-sky-600 font-bold hover:underline">@BotFather</a> 并点击开始对话。</>
                ) : (
                  <>Open Telegram and search for <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-sky-600 font-bold hover:underline">@BotFather</a>.</>
                )}
              </li>
              <li>
                {isZh ? (
                  <>发送指令 <code className="bg-zinc-100 px-1.5 py-0.5 rounded font-mono text-zinc-800">/newbot</code>，按提示输入名字和用户名（以 <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono">bot</code> 结尾）。</>
                ) : (
                  <>Send <code className="bg-zinc-100 px-1.5 py-0.5 rounded font-mono text-zinc-800">/newbot</code> and follow prompts to set a name and username.</>
                )}
              </li>
              <li>
                {isZh ? (
                  <>复制 BotFather 提供的 API Token，粘贴到上方的输入框，并点击“保存并注册”。</>
                ) : (
                  <>Copy the API Token from BotFather, paste it above, and click <strong>Save & Register</strong>.</>
                )}
              </li>
              <li>
                {isZh ? (
                  <>在 Telegram 中打开您的机器人，发送 <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono">/start</code> 或直接向它提问即可！</>
                ) : (
                  <>Open your bot in Telegram, send <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono">/start</code>, and start chatting!</>
                )}
              </li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between shrink-0">
          <div className="text-3xs text-zinc-500">
            {isZh ? '自动支持中英文自然语言对话及日历活动添加' : 'Supports English & Chinese queries and event scheduling'}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-black bg-zinc-900 text-white hover:bg-zinc-800 transition-colors shadow-xs"
          >
            {isZh ? '完成' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
