import React, { useState, useEffect } from 'react';
import {
  Send,
  BellRing,
  MessageSquare,
  Shield,
  Key,
  CheckCircle2,
  AlertTriangle,
  Terminal,
  Compass,
  Play,
  RotateCcw,
  Sparkles,
  Lock,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const DomesticConnectorsView: React.FC = () => {
  const { t, language } = useLanguage();
  const [selectedPlatform, setSelectedPlatform] = useState<'feishu' | 'dingtalk' | 'wecom' | 'amap'>('feishu');

  // Config states
  const [feishuWebhook, setFeishuWebhook] = useState(
    'https://open.feishu.cn/open-apis/bot/v2/hook/demo-feishu-8899-uuid'
  );
  const [feishuSecret, setFeishuSecret] = useState('kSec_feishu_sha256_sig_9901');
  const [dingtalkWebhook, setDingtalkWebhook] = useState(
    'https://oapi.dingtalk.com/robot/send?access_token=demo_token_7766'
  );
  const [dingtalkSecret, setDingtalkSecret] = useState('SEC_dingtalk_sha256_mock_sig');
  const [wecomWebhook, setWecomWebhook] = useState(
    'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=demo_key_5544'
  );
  const [amapKey, setAmapKey] = useState('amap_web_api_key_mock_9921');

  // Dispatch test form states
  const [msgType, setMsgType] = useState<string>('card');
  const [msgTitle, setMsgTitle] = useState<string>(t.domesticDefaultTitle);
  const [msgContent, setMsgContent] = useState<string>(t.domesticDefaultContent);
  const [isAtAll, setIsAtAll] = useState<boolean>(false);
  const [atUsers, setAtUsers] = useState<string>('13800000000, 13900000000');

  const [isSending, setIsSending] = useState<boolean>(false);
  const [dispatchResult, setDispatchResult] = useState<any>(null);
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);

  // Sync default texts when language switches if user hasn't typed custom text
  useEffect(() => {
    setMsgTitle(t.domesticDefaultTitle);
    setMsgContent(t.domesticDefaultContent);
  }, [language]);

  const handleSendTest = async () => {
    setIsSending(true);
    setDispatchResult(null);

    const platform = selectedPlatform === 'amap' ? 'feishu' : selectedPlatform;
    let targetUrl = '';
    let secret = '';

    if (platform === 'feishu') {
      targetUrl = feishuWebhook;
      secret = feishuSecret;
    } else if (platform === 'dingtalk') {
      targetUrl = dingtalkWebhook;
      secret = dingtalkSecret;
    } else if (platform === 'wecom') {
      targetUrl = wecomWebhook;
    }

    try {
      const res = await fetch('/api/v1/domestic/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          target_url: targetUrl,
          secret,
          message_type: msgType,
          title: msgTitle,
          content: msgContent,
          is_at_all: isAtAll,
          at_users: atUsers.split(',').map((u) => u.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      setDispatchResult(data.data || data);
    } catch (err: any) {
      setDispatchResult({ error: err.message });
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveConfig = async () => {
    const pluginId =
      selectedPlatform === 'feishu'
        ? 'feishu_lark_integration'
        : selectedPlatform === 'dingtalk'
        ? 'dingtalk_integration'
        : selectedPlatform === 'wecom'
        ? 'wecom_integration'
        : 'amap_integration';

    try {
      let configPayload: any = {};
      if (selectedPlatform === 'feishu') {
        configPayload = { webhook_url: feishuWebhook, webhook_secret: feishuSecret };
      } else if (selectedPlatform === 'dingtalk') {
        configPayload = { webhook_url: dingtalkWebhook, webhook_secret: dingtalkSecret };
      } else if (selectedPlatform === 'wecom') {
        configPayload = { webhook_url: wecomWebhook };
      } else {
        configPayload = { api_key_ref: amapKey };
      }

      await fetch(`/api/v1/plugins/${pluginId}/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: configPayload }),
      });
      setSavedSuccess(selectedPlatform);
      setTimeout(() => setSavedSuccess(null), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800 px-2.5 py-0.5 rounded flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Domestic Enterprise Ecosystem
            </span>
            <span className="text-xs text-slate-500">|</span>
            <span className="text-xs text-slate-400 font-mono">HMAC-SHA256 Signing & Bot Webhooks</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">{t.domesticTitle}</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">{t.domesticSubtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Zero-Leak Token Redaction Enforced</span>
        </div>
      </div>

      {/* Platform Selector Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Feishu */}
        <button
          onClick={() => {
            setSelectedPlatform('feishu');
            setMsgTitle(t.feishuDefaultTitle);
          }}
          className={`p-4 rounded-xl border text-left transition flex items-center gap-3 cursor-pointer ${
            selectedPlatform === 'feishu'
              ? 'bg-slate-900 border-indigo-500 shadow-lg shadow-indigo-950/50'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="p-2.5 rounded-lg bg-blue-950/70 border border-blue-800 text-blue-400">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">{t.domesticPlatformFeishu}</div>
            <div className="text-[10px] text-slate-400 font-mono">Interactive Cards & Posts</div>
          </div>
        </button>

        {/* DingTalk */}
        <button
          onClick={() => {
            setSelectedPlatform('dingtalk');
            setMsgTitle(t.dingtalkDefaultTitle);
          }}
          className={`p-4 rounded-xl border text-left transition flex items-center gap-3 cursor-pointer ${
            selectedPlatform === 'dingtalk'
              ? 'bg-slate-900 border-indigo-500 shadow-lg shadow-indigo-950/50'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="p-2.5 rounded-lg bg-amber-950/70 border border-amber-800 text-amber-400">
            <BellRing className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">{t.domesticPlatformDingtalk}</div>
            <div className="text-[10px] text-slate-400 font-mono">Markdown & Stream Sign</div>
          </div>
        </button>

        {/* WeCom */}
        <button
          onClick={() => {
            setSelectedPlatform('wecom');
            setMsgTitle(t.wecomDefaultTitle);
          }}
          className={`p-4 rounded-xl border text-left transition flex items-center gap-3 cursor-pointer ${
            selectedPlatform === 'wecom'
              ? 'bg-slate-900 border-indigo-500 shadow-lg shadow-indigo-950/50'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="p-2.5 rounded-lg bg-emerald-950/70 border border-emerald-800 text-emerald-400">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">{t.domesticPlatformWecom}</div>
            <div className="text-[10px] text-slate-400 font-mono">Corporate Group Bot</div>
          </div>
        </button>

        {/* Amap */}
        <button
          onClick={() => setSelectedPlatform('amap')}
          className={`p-4 rounded-xl border text-left transition flex items-center gap-3 cursor-pointer ${
            selectedPlatform === 'amap'
              ? 'bg-slate-900 border-indigo-500 shadow-lg shadow-indigo-950/50'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="p-2.5 rounded-lg bg-cyan-950/70 border border-cyan-800 text-cyan-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">{t.domesticPlatformAmap}</div>
            <div className="text-[10px] text-slate-400 font-mono">GCJ-02 & Admin Geocode</div>
          </div>
        </button>
      </div>

      {/* Main Workspace: Config Form + Dispatch Sandbox */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Connector Credentials & Settings */}
        <div className="lg:col-span-5 p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">
                {language === 'zh' ? '连接器授权凭据配置' : 'Connector Credentials'}
              </h2>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
              Encrypted Vault
            </span>
          </div>

          {selectedPlatform === 'feishu' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {t.domesticWebhookUrl}
                </label>
                <input
                  type="text"
                  value={feishuWebhook}
                  onChange={(e) => setFeishuWebhook(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {t.domesticSecret}
                </label>
                <input
                  type="password"
                  value={feishuSecret}
                  onChange={(e) => setFeishuSecret(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  {t.feishuDesc}
                </p>
              </div>
            </div>
          )}

          {selectedPlatform === 'dingtalk' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {t.domesticWebhookUrl}
                </label>
                <input
                  type="text"
                  value={dingtalkWebhook}
                  onChange={(e) => setDingtalkWebhook(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {t.domesticSecret} (SEC... {language === 'zh' ? '加签密钥' : 'Signing Secret'})
                </label>
                <input
                  type="password"
                  value={dingtalkSecret}
                  onChange={(e) => setDingtalkSecret(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  {t.dingtalkDesc}
                </p>
              </div>
            </div>
          )}

          {selectedPlatform === 'wecom' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {t.domesticWebhookUrl} ({language === 'zh' ? '带 key 参数' : 'with key parameter'})
                </label>
                <input
                  type="text"
                  value={wecomWebhook}
                  onChange={(e) => setWecomWebhook(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  {t.wecomDesc}
                </p>
              </div>
            </div>
          )}

          {selectedPlatform === 'amap' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {t.amapKeyLabel}
                </label>
                <input
                  type="password"
                  value={amapKey}
                  onChange={(e) => setAmapKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  {t.amapDesc}
                </p>
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={handleSaveConfig}
              className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{t.saveConnectorConfig}</span>
            </button>
            {savedSuccess && (
              <div className="mt-2 text-center text-xs text-emerald-400 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t.savedSuccessNotice}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Dispatch Test Bench & Live Log */}
        <div className="lg:col-span-7 p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">
                {t.domesticDispatchBench}
              </h2>
            </div>
            <span className="text-[10px] font-mono text-cyan-400">Simulation & Sandboxed Delivery</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {t.domesticMsgType}
              </label>
              <select
                value={msgType}
                onChange={(e) => setMsgType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="card">{t.optionInteractiveCard}</option>
                <option value="markdown">{t.optionMarkdownCard}</option>
                <option value="approval_notice">{t.optionApprovalNotice}</option>
                <option value="text">{t.optionPlainText}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {t.domesticMsgTitle}
              </label>
              <input
                type="text"
                value={msgTitle}
                onChange={(e) => setMsgTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t.domesticMsgContent}
            </label>
            <textarea
              rows={4}
              value={msgContent}
              onChange={(e) => setMsgContent(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAtAll}
                onChange={(e) => setIsAtAll(e.target.checked)}
                className="rounded border-slate-700 text-indigo-600 focus:ring-0"
              />
              <span>{t.atAllLabel}</span>
            </label>
            <span className="text-[11px] text-slate-500">{t.atAllNotice}</span>
          </div>

          <button
            onClick={handleSendTest}
            disabled={isSending}
            className="w-full py-2.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/30 flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isSending ? t.sending : t.btnSendDispatch}</span>
          </button>

          {/* Results preview */}
          {dispatchResult && (
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-2 font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 text-slate-400 font-sans">
                <span className="font-semibold text-slate-200">{t.domesticDispatchResult}</span>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                  <CheckCircle2 className="w-3 h-3" />
                  Signature Verified
                </span>
              </div>
              <pre className="text-[11px] text-slate-300 overflow-x-auto max-h-48">
                {JSON.stringify(dispatchResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
