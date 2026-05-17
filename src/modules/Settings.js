// ─── SETTINGS ─────────────────────────────────────────────────────────────────
const Settings = ({ uid }) => {
  const [limitGb, setLimitGb] = React.useState(() => {
    const stored = localStorage.getItem('jp_storageLimit');
    return stored ? (parseInt(stored) / 1073741824).toFixed(1) : '4.5';
  });
  const [saved, setSaved] = React.useState(false);
  const [userName, setUserName] = React.useState(() => localStorage.getItem('jp_userName') || '');
  const [nameSaved, setNameSaved] = React.useState(false);
  const [isScanning, setIsScanning] = React.useState(false);
  const [scanResult, setScanResult] = React.useState(null);
  const [usedBytes, setUsedBytes] = React.useState(() => parseInt(localStorage.getItem('jp_storageUsed') || '0'));
  const [geminiKey, setGeminiKey] = React.useState(() => localStorage.getItem('gemini_api_key') || '');
  const [keySaved, setKeySaved] = React.useState(false);
  const [googleTtsKey, setGoogleTtsKey] = React.useState(() => localStorage.getItem('google_tts_key') || '');
  const [ttsSaved, setTtsSaved] = React.useState(false);

  // Sync settings from Firestore on mount (picks up changes from other devices)
  React.useEffect(() => {
    if (!uid) return;
    fbDb.collection('users').doc(uid).get().then(doc => {
      if (!doc.exists) return;
      const d = doc.data();
      if (d.geminiApiKey  !== undefined) { localStorage.setItem('gemini_api_key', d.geminiApiKey); setGeminiKey(d.geminiApiKey); }
      if (d.googleTtsKey  !== undefined) { localStorage.setItem('google_tts_key', d.googleTtsKey); setGoogleTtsKey(d.googleTtsKey); }
      if (d.storageLimit  !== undefined) { localStorage.setItem('jp_storageLimit', String(d.storageLimit)); setLimitGb((d.storageLimit / 1073741824).toFixed(1)); }
      if (d.userName      !== undefined) { localStorage.setItem('jp_userName', d.userName); setUserName(d.userName); }
    }).catch(() => {});
  }, [uid]);

  const saveGoogleTtsKey = () => {
    localStorage.setItem('google_tts_key', googleTtsKey.trim());
    fbDb.collection('users').doc(uid).set({ googleTtsKey: googleTtsKey.trim() }, { merge: true }).catch(() => {});
    setTtsSaved(true);
    setTimeout(() => setTtsSaved(false), 2000);
  };

  const saveGeminiKey = () => {
    localStorage.setItem('gemini_api_key', geminiKey.trim());
    fbDb.collection('users').doc(uid).set({ geminiApiKey: geminiKey.trim() }, { merge: true }).catch(() => {});
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  };

  const limitBytes = parseInt(localStorage.getItem('jp_storageLimit') || '4831838208');
  const usedMb = (usedBytes / 1048576).toFixed(1);
  const usedGb = (usedBytes / 1073741824).toFixed(2);
  const remainBytes = Math.max(0, limitBytes - usedBytes);
  const remainGb = (remainBytes / 1073741824).toFixed(2);
  const pct = limitBytes > 0 ? Math.min(100, (usedBytes / limitBytes * 100)).toFixed(1) : 0;

  const save = () => {
    const gb = parseFloat(limitGb);
    if (isNaN(gb) || gb < 0.1 || gb > 5) return;
    const bytes = Math.round(gb * 1073741824);
    localStorage.setItem('jp_storageLimit', String(bytes));
    fbDb.collection('users').doc(uid).set({ storageLimit: bytes }, { merge: true }).catch(() => {});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const saveName = () => {
    localStorage.setItem('jp_userName', userName.trim());
    fbDb.collection('users').doc(uid).set({ userName: userName.trim() }, { merge: true }).catch(() => {});
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  };

  const listAllFiles = async (ref) => {
    const res = await ref.listAll();
    let total = 0;
    let count = 0;
    for (const item of res.items) {
      const meta = await item.getMetadata();
      total += meta.size || 0;
      count += 1;
    }
    for (const prefix of res.prefixes) {
      const sub = await listAllFiles(prefix);
      total += sub.total;
      count += sub.count;
    }
    return { total, count };
  };

  const handleScan = async () => {
    if (!uid) return;
    setIsScanning(true);
    setScanResult(null);
    try {
      const rootRef = fbStorage.ref(`users/${uid}`);
      const { total, count } = await listAllFiles(rootRef);
      localStorage.setItem('jp_storageUsed', String(total));
      setUsedBytes(total);
      setScanResult({ count, bytes: total });
    } catch (e) {
      setScanResult({ error: e.message || '扫描失败' });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-6">⚙️ 设置</h1>
      <Card className="mb-4">
        <h2 className="font-semibold text-gray-700 mb-4">个人信息</h2>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">显示名称</label>
            <input type="text" value={userName} onChange={e => setUserName(e.target.value)}
              placeholder="输入你的名字"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <Btn onClick={saveName}>{nameSaved ? '✅ 已保存' : '保存'}</Btn>
        </div>
      </Card>
      <Card>
        <h2 className="font-semibold text-gray-700 mb-4">存储空间</h2>
        <div className="mb-3">
          <div className="flex justify-between text-sm text-gray-500 mb-1">
            <span>已使用：{usedBytes < 1073741824 ? `${usedMb} MB` : `${usedGb} GB`}</span>
            <span>剩余：{remainGb} GB</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div className={`h-2.5 rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-indigo-500'}`} style={{width: `${pct}%`}} />
          </div>
          <p className="text-xs text-gray-400 mt-1">{pct}% 已用（{limitGb} GB 限额）</p>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleScan}
              disabled={isScanning}
              className="text-xs px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isScanning ? (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  扫描中…
                </span>
              ) : '重新扫描'}
            </button>
            {scanResult && !isScanning && (
              scanResult.error
                ? <span className="text-xs text-red-500">❌ {scanResult.error}</span>
                : <span className="text-xs text-green-600">✅ 已更新：共 {scanResult.count} 个文件</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">存储上限 (GB，0.1 ~ 5)</label>
            <input type="number" min="0.1" max="5" step="0.1" value={limitGb}
              onChange={e => setLimitGb(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <Btn onClick={save}>{saved ? '✅ 已保存' : '保存'}</Btn>
        </div>
      </Card>
      <Card className="mb-4">
        <h2 className="font-semibold text-gray-700 mb-1">AI 功能设置</h2>
        <p className="text-xs text-gray-400 mb-3">
          用于「AI练习」模块。免费申请：
          <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="text-indigo-500 underline ml-1">aistudio.google.com</a>
        </p>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Gemini API Key</label>
            <input
              type="password"
              value={geminiKey}
              onChange={e => setGeminiKey(e.target.value)}
              placeholder="AIza..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <Btn onClick={saveGeminiKey}>{keySaved ? '✅ 已保存' : '保存'}</Btn>
        </div>
        {geminiKey && <p className="text-xs text-emerald-600 mt-2">✓ 已配置 API Key</p>}
      </Card>
      <Card className="mb-4">
        <h2 className="font-semibold text-gray-700 mb-1">文字转语音设置</h2>
        <p className="text-xs text-gray-400 mb-3">
          用于「文字转语音」模块（Google Cloud Neural2 日语语音）。需在
          <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-indigo-500 underline mx-1">Google Cloud Console</a>
          开启 Cloud Text-to-Speech API 后创建 API Key。
        </p>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Google Cloud TTS API Key</label>
            <input
              type="password"
              value={googleTtsKey}
              onChange={e => setGoogleTtsKey(e.target.value)}
              placeholder="AIza..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <Btn onClick={saveGoogleTtsKey}>{ttsSaved ? '✅ 已保存' : '保存'}</Btn>
        </div>
        {googleTtsKey && <p className="text-xs text-emerald-600 mt-2">✓ 已配置 API Key</p>}
      </Card>
    </div>
  );
};

const StorageBanner = () => {
  const [dismissed, setDismissed] = React.useState(false);
  const usedBytes = parseInt(localStorage.getItem('jp_storageUsed') || '0');
  const limitBytes = parseInt(localStorage.getItem('jp_storageLimit') || '4831838208');
  if (dismissed || limitBytes === 0 || usedBytes / limitBytes < 0.9) return null;
  return (
    <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs text-red-700 flex items-center gap-2 shrink-0">
      <span>⚠️</span>
      <span className="flex-1">存储空间已使用 {(usedBytes / limitBytes * 100).toFixed(0)}%，接近上限。请删除旧文件或在设置中调整上限。</span>
      <button onClick={() => setDismissed(true)} className="text-red-400 hover:text-red-600 font-bold">✕</button>
    </div>
  );
};
