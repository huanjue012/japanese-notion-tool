// ─── TEXT TO SPEECH ───────────────────────────────────────────────────────────
// Shared helper: 调用 Google Cloud TTS，返回 Audio 实例（已开始播放）。无 key 时抛错。
const playJapaneseTTS = async (text, { voice = 'ja-JP-Neural2-B', rate = 1 } = {}) => {
  const apiKey = localStorage.getItem('google_tts_key');
  if (!apiKey) throw new Error('未配置 Google Cloud TTS API Key');
  if (!text || !text.trim()) throw new Error('文本为空');
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: text.trim() },
        voice: { languageCode: 'ja-JP', name: voice },
        audioConfig: { audioEncoding: 'MP3', speakingRate: rate },
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || '请求失败');
  const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
  await audio.play();
  return audio;
};

const TTS_VOICES = [
  { name: 'ja-JP-Neural2-B', label: 'Neural2 女声 B（推荐）' },
  { name: 'ja-JP-Neural2-C', label: 'Neural2 男声 C' },
  { name: 'ja-JP-Neural2-D', label: 'Neural2 女声 D' },
  { name: 'ja-JP-Standard-A', label: 'Standard 女声 A' },
  { name: 'ja-JP-Standard-B', label: 'Standard 男声 B' },
  { name: 'ja-JP-Standard-C', label: 'Standard 男声 C' },
  { name: 'ja-JP-Standard-D', label: 'Standard 女声 D' },
];

const TextToSpeech = ({ setPage }) => {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('ja-JP-Neural2-B');
  const [rate, setRate] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  const apiKey = localStorage.getItem('google_tts_key');

  const stop = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlaying(false);
  };

  const speak = async () => {
    if (!text.trim() || loading) return;
    stop();
    setLoading(true);
    setError('');
    try {
      const audio = await playJapaneseTTS(text, { voice, rate });
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.onerror = () => { setPlaying(false); setError('播放失败'); };
      setPlaying(true);
    } catch (e) {
      setError(e.message || '发生错误');
    } finally {
      setLoading(false);
    }
  };

  const rateLabel = rate === 0.5 ? '很慢' : rate === 0.75 ? '慢' : rate === 1 ? '正常' : rate === 1.25 ? '稍快' : rate === 1.5 ? '快' : '很快';

  if (!apiKey) return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-6">🔊 文字转语音</h2>
      <Card className="text-center py-10 space-y-3">
        <p className="text-gray-500">使用前请先配置 Google Cloud TTS API Key</p>
        <Btn variant="primary" onClick={() => setPage('settings')}>前往设置</Btn>
      </Card>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-6">🔊 文字转语音</h2>
      <Card className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">输入文字</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="在此输入日语文字…"
            rows={6}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y"
          />
          <p className="text-right text-xs text-gray-400 mt-0.5">{text.length} 字</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">语音</label>
          <select
            value={voice}
            onChange={e => setVoice(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
          >
            {TTS_VOICES.map(v => (
              <option key={v.name} value={v.name}>{v.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            速度：<span className="text-indigo-600 font-semibold">{rate}× {rateLabel}</span>
          </label>
          <input
            type="range" min="0.5" max="2" step="0.25"
            value={rate}
            onChange={e => setRate(parseFloat(e.target.value))}
            className="w-full accent-indigo-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>0.5×</span><span>1×</span><span>2×</span>
          </div>
        </div>

        {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 pt-1">
          {!playing ? (
            <Btn variant="primary" size="lg" onClick={speak} disabled={!text.trim() || loading} className="flex-1 text-base">
              {loading ? '生成中…' : '▶ 播放'}
            </Btn>
          ) : (
            <Btn variant="danger" size="lg" onClick={stop} className="flex-1 text-base">
              ■ 停止
            </Btn>
          )}
          <Btn variant="secondary" size="lg" onClick={() => { stop(); setText(''); }}>清空</Btn>
        </div>

        {playing && <p className="text-center text-sm text-indigo-500 animate-pulse">正在播放…</p>}
      </Card>
      <p className="text-xs text-gray-400 mt-4 text-center">Google Cloud Neural2 日语语音 · 按用量计费</p>
    </div>
  );
};
