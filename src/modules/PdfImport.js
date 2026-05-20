// ─── PDF IMPORT ───────────────────────────────────────────────────────────────
const PDF_COMMANDS = [
  {
    id: 'notes',
    label: '📝 整理笔记',
    desc: '只提取知识点笔记',
    color: 'bg-blue-600 hover:bg-blue-700',
    prompt: (text) => `你是一个日语学习助手。请将以下课堂PDF内容整理成JSON格式，只提取知识点笔记，只返回合法JSON，不要加任何说明文字。格式如下：\n{"notes": [{"title": "笔记标题", "content": "内容", "tags": ["标签"]}]}\n\nPDF内容：\n\n${text}`,
  },
  {
    id: 'flashcards',
    label: '🃏 整理闪卡',
    desc: '只提取问答闪卡',
    color: 'bg-purple-600 hover:bg-purple-700',
    prompt: (text) => `你是一个日语学习助手。请将以下课堂PDF内容整理成JSON格式，只提取闪卡（问答卡），只返回合法JSON，不要加任何说明文字。格式如下：\n{"flashcards": [{"front": "日语/问题", "back": "中文/答案", "tags": ["标签"]}]}\n\nPDF内容：\n\n${text}`,
  },
  {
    id: 'all',
    label: '✨ 整理全部',
    desc: '笔记 + 闪卡',
    color: 'bg-indigo-600 hover:bg-indigo-700',
    prompt: (text) => `你是一个日语学习助手。请将以下课堂PDF内容整理成JSON格式，只返回合法JSON，不要加任何说明文字。格式如下：\n{\n  "notes": [{"title": "笔记标题", "content": "内容", "tags": ["标签"]}],\n  "flashcards": [{"front": "日语/问题", "back": "中文/答案", "tags": ["标签"]}]\n}\n\nPDF内容：\n\n${text}`,
  },
];

const PDFImport = ({ setNotes, setFlashcards, uid, isOnline, notes, flashcards, setPage, setImportedNoteIds }) => {
  const [tab, setTab] = useState('ai');

  // ── AI tab ──
  const [srcMode, setSrcMode] = useState('pdf'); // 'pdf' | 'text'
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfPages, setPdfPages] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ phase: 'idle', current: 0, total: 0 });
  const [pdfSlowWarning, setPdfSlowWarning] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [rawText, setRawText] = useState('');
  const [aiMode, setAiMode] = useState('all');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [aiErr, setAiErr] = useState('');
  const [importOk, setImportOk] = useState('');
  const [importedCount, setImportedCount] = useState(0);

  // ── JSON tab ──
  const [json, setJson] = useState('');
  const [jsonErr, setJsonErr] = useState('');
  const [jsonOk, setJsonOk] = useState('');

  // ── Merge tab ──
  const [mergeJson, setMergeJson] = useState('');
  const [mergeErr, setMergeErr] = useState('');
  const [mergeOk, setMergeOk] = useState('');
  const [mergeHasBackup, setMergeHasBackup] = useState(() => !!localStorage.getItem('backup_merge_flashcards') || !!localStorage.getItem('backup_merge_notes'));
  const [insertUnmatchedFlash, setInsertUnmatchedFlash] = useState(false);
  const [insertUnmatchedNotes, setInsertUnmatchedNotes] = useState(false);

  const mergePreview = useMemo(() => {
    if (!mergeJson.trim()) return null;
    let d;
    try { d = JSON.parse(mergeJson); } catch { return { error: 'JSON 格式有误' }; }
    if (!Array.isArray(d.flashcards) && !Array.isArray(d.notes)) {
      return { error: '缺少 flashcards 或 notes 数组' };
    }

    let flashPart = null;
    if (Array.isArray(d.flashcards)) {
      const existingMap = new Map(flashcards.map(c => [c.front, c]));
      const willUpdate = [], noMatch = [], noChange = [];
      for (const x of d.flashcards) {
        const existing = existingMap.get(x.front);
        if (!existing) { noMatch.push(x); continue; }
        const newBack = x.back ?? existing.back;
        const newTags = Array.isArray(x.tags) ? x.tags : existing.tags;
        if (newBack === existing.back && JSON.stringify(newTags) === JSON.stringify(existing.tags || [])) {
          noChange.push(x.front);
        } else {
          willUpdate.push({ id: existing.id, key: x.front, newBack, newTags });
        }
      }
      flashPart = { willUpdate, noMatch, noChange, total: d.flashcards.length };
    }

    let notePart = null;
    if (Array.isArray(d.notes)) {
      const existingMap = new Map(notes.map(n => [n.title, n]));
      const willUpdate = [], noMatch = [], noChange = [];
      for (const x of d.notes) {
        const existing = existingMap.get(x.title);
        if (!existing) { noMatch.push(x); continue; }
        const newContent = x.content ?? existing.content;
        const newTags = Array.isArray(x.tags) ? x.tags : existing.tags;
        if (newContent === existing.content && JSON.stringify(newTags) === JSON.stringify(existing.tags || [])) {
          noChange.push(x.title);
        } else {
          willUpdate.push({ id: existing.id, key: x.title, newContent, newTags });
        }
      }
      notePart = { willUpdate, noMatch, noChange, total: d.notes.length };
    }

    return { flashPart, notePart };
  }, [mergeJson, flashcards, notes]);

  const applyMerge = () => {
    setMergeErr(''); setMergeOk('');
    if (!mergePreview || mergePreview.error) { setMergeErr(mergePreview?.error || 'JSON 无效'); return; }
    const flashUpdates = mergePreview.flashPart?.willUpdate || [];
    const noteUpdates = mergePreview.notePart?.willUpdate || [];
    const flashInserts = insertUnmatchedFlash ? (mergePreview.flashPart?.noMatch || []) : [];
    const noteInserts = insertUnmatchedNotes ? (mergePreview.notePart?.noMatch || []) : [];
    const totalOps = flashUpdates.length + noteUpdates.length + flashInserts.length + noteInserts.length;
    if (totalOps === 0) { setMergeErr('没有需要更新或新增的内容'); return; }
    const parts = [];
    if (flashUpdates.length > 0) parts.push(`更新闪卡 ${flashUpdates.length} 张`);
    if (flashInserts.length > 0) parts.push(`新增闪卡 ${flashInserts.length} 张`);
    if (noteUpdates.length > 0) parts.push(`更新笔记 ${noteUpdates.length} 条`);
    if (noteInserts.length > 0) parts.push(`新增笔记 ${noteInserts.length} 条`);
    if (!confirm(`${parts.join('、')}。操作前会自动备份。\n确认？`)) return;

    const now = new Date().toISOString();
    if (flashUpdates.length > 0 || flashInserts.length > 0) {
      localStorage.setItem('backup_merge_flashcards', JSON.stringify(flashcards));
      const updateMap = new Map(flashUpdates.map(u => [u.id, u]));
      const newFlash = flashInserts.map(x => ({ ...x, id: genId(), createdAt: now, tags: Array.isArray(x.tags) ? x.tags : [] }));
      setFlashcards(p => {
        const updated = p.map(c => {
          const u = updateMap.get(c.id);
          return u ? { ...c, back: u.newBack, tags: u.newTags, updatedAt: now } : c;
        });
        return [...updated, ...newFlash];
      });
    }
    if (noteUpdates.length > 0 || noteInserts.length > 0) {
      localStorage.setItem('backup_merge_notes', JSON.stringify(notes));
      const updateMap = new Map(noteUpdates.map(u => [u.id, u]));
      const newNotes = noteInserts.map(x => ({ ...x, id: genId(), createdAt: now, images: Array.isArray(x.images) ? x.images : [], tags: Array.isArray(x.tags) ? x.tags : [] }));
      setNotes(p => {
        const updated = p.map(n => {
          const u = updateMap.get(n.id);
          return u ? { ...n, content: u.newContent, tags: u.newTags, updatedAt: now } : n;
        });
        return [...updated, ...newNotes];
      });
      if (newNotes.length > 0 && setImportedNoteIds) setImportedNoteIds(newNotes.map(x => x.id));
    }
    setMergeHasBackup(true);
    setMergeOk(`✅ ${parts.join('、')}`);
    setMergeJson('');
    setInsertUnmatchedFlash(false);
    setInsertUnmatchedNotes(false);
  };

  const restoreMergeBackup = () => {
    const rawF = localStorage.getItem('backup_merge_flashcards');
    const rawN = localStorage.getItem('backup_merge_notes');
    if (!rawF && !rawN) { alert('没有找到备份'); return; }
    if (!confirm('确认从备份恢复？最近一次合并将被撤销。')) return;
    const restored = [];
    if (rawF) {
      try { setFlashcards(() => JSON.parse(rawF)); restored.push('闪卡'); } catch(e) { alert('闪卡备份损坏：' + e.message); }
    }
    if (rawN) {
      try { setNotes(() => JSON.parse(rawN)); restored.push('笔记'); } catch(e) { alert('笔记备份损坏：' + e.message); }
    }
    setMergeOk(`✅ 已从备份恢复${restored.join('、')}`);
  };
  const [lastImportedCount, setLastImportedCount] = useState(0);
  const [imgFiles, setImgFiles] = useState([]);
  const [jsonPdfFiles, setJsonPdfFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, fileName: '', filePct: 0 });

  // ── PDF extraction ──
  const handlePdfSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPdfFile(file);
    setExtractedText('');
    setPdfPages(0);
    setAiResult('');
    setAiErr('');
    setImportOk('');
    setPdfSlowWarning(false);
    setPdfProgress({ phase: 'init', current: 0, total: 0 });
    setExtracting(true);
    let url = null;
    let loadingTask = null;
    const slowTimer = setTimeout(() => setPdfSlowWarning(true), 18000);
    try {
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
      url = URL.createObjectURL(file);
      setPdfProgress(p => ({ ...p, phase: 'load' }));
      loadingTask = pdfjsLib.getDocument(url);
      const pdf = await Promise.race([
        loadingTask.promise,
        new Promise((_, rej) => setTimeout(() => rej(new Error('PDF 解析器加载超时（45s），可能是网络较慢或 CDN 不可达')), 45000))
      ]);
      setPdfProgress({ phase: 'extract', current: 0, total: pdf.numPages });
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(' ') + '\n\n';
        setPdfProgress(p => ({ ...p, current: i }));
      }
      setPdfPages(pdf.numPages);
      setExtractedText(text.trim());
      setPdfProgress(p => ({ ...p, phase: 'done' }));
    } catch(err) {
      setAiErr('PDF 提取失败：' + err.message);
      setPdfProgress(p => ({ ...p, phase: 'error' }));
      try { loadingTask && loadingTask.destroy && loadingTask.destroy(); } catch(_) {}
    } finally {
      clearTimeout(slowTimer);
      if (url) URL.revokeObjectURL(url);
      setExtracting(false);
    }
  };

  const activeContent = srcMode === 'pdf' ? extractedText : rawText;

  // ── AI organize ──
  const organize = async (withFeedback) => {
    if (!activeContent.trim()) return;
    setAiLoading(true);
    setAiErr('');
    setImportOk('');
    try {
      let prompt;
      if (withFeedback && aiResult && feedback.trim()) {
        prompt = `你是一个日语学习助手。以下是之前整理的 JSON 结果：\n${aiResult}\n\n用户修改意见：${feedback}\n\n请根据修改意见重新整理，只返回合法 JSON，不要加任何说明文字。`;
      } else {
        prompt = PDF_COMMANDS.find(c => c.id === aiMode).prompt(activeContent);
      }
      const res = await callGemini(prompt);
      const cleaned = res.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/,'').trim();
      setAiResult(cleaned);
      setFeedback('');
      setShowFeedback(false);
    } catch(e) {
      if (e.message === 'NO_KEY') { setAiErr('请先在「设置」页配置 Gemini API Key。'); return; }
      setAiErr('AI 请求失败：' + e.message);
    } finally {
      setAiLoading(false);
    }
  };

  // ── Parse preview ──
  let aiParsed = null;
  try { if (aiResult) aiParsed = JSON.parse(aiResult); } catch(e) {}

  // ── Shared import logic ──
  const doImport = (d, uploadedFiles) => {
    let cnt = { n: 0, f: 0 };
    let skippedN = 0, skippedF = 0;
    if (d.notes?.length) {
      const rawNew = d.notes.filter(x => !notes.some(n => n.title === x.title));
      skippedN = d.notes.length - rawNew.length;
      const withIds = rawNew.map(x => ({ ...x, id: genId(), createdAt: new Date().toISOString(), images: [...(x.images||[]), ...uploadedFiles] }));
      setNotes(p => [...p, ...withIds]);
      cnt.n = withIds.length;
      if (withIds.length > 0 && setImportedNoteIds) setImportedNoteIds(withIds.map(x => x.id));
    }
    if (d.flashcards?.length) {
      const newCards = d.flashcards.filter(x => !flashcards.some(f => f.front === x.front));
      skippedF = d.flashcards.length - newCards.length;
      setFlashcards(p => [...p, ...newCards.map(x => ({ ...x, id: genId(), createdAt: new Date().toISOString() }))]);
      cnt.f = newCards.length;
    }
    return { cnt, skippedN, skippedF };
  };

  // ── Import from AI result ──
  const importFromAI = () => {
    setAiErr('');
    let d;
    try { d = JSON.parse(aiResult); } catch(e) { setAiErr('JSON 格式有误，请手动修正后重试：' + e.message); return; }
    const { cnt, skippedN, skippedF } = doImport(d, []);
    const skipParts = [];
    if (skippedN > 0) skipParts.push(`笔记 ${skippedN}`);
    if (skippedF > 0) skipParts.push(`闪卡 ${skippedF}`);
    const skipMsg = skipParts.length > 0 ? ` · 跳过重复：${skipParts.join('、')}` : '';
    setImportOk(`✅ 导入成功！笔记 ${cnt.n} 条 · 闪卡 ${cnt.f} 张${skipMsg}`);
    setImportedCount(cnt.n);
  };

  // ── JSON tab ──
  const addImgFiles = e => { setImgFiles(p => [...p, ...Array.from(e.target.files||[])]); e.target.value=''; };
  const removeImg = idx => setImgFiles(p => p.filter((_,i)=>i!==idx));
  const addJsonPdfFiles = e => { setJsonPdfFiles(p => [...p, ...Array.from(e.target.files||[])]); e.target.value=''; };
  const removeJsonPdf = idx => setJsonPdfFiles(p => p.filter((_,i)=>i!==idx));

  const importJSON = async () => {
    setJsonErr(''); setJsonOk('');
    let d;
    try { d = JSON.parse(json); } catch(e) { setJsonErr('JSON 格式有误：' + e.message); return; }
    let uploadedImages = [];
    if ((imgFiles.length > 0 || jsonPdfFiles.length > 0) && d.notes?.length && uid) {
      const total = imgFiles.length + jsonPdfFiles.length;
      setUploading(true);
      setUploadProgress({ current: 0, total, fileName: '', filePct: 0 });
      const putWithProgress = (ref, file) => new Promise((resolve, reject) => {
        const task = ref.put(file);
        task.on('state_changed',
          snap => {
            const pct = snap.totalBytes > 0 ? (snap.bytesTransferred / snap.totalBytes) * 100 : 0;
            setUploadProgress(p => ({ ...p, filePct: pct }));
          },
          err => reject(err),
          () => resolve(task.snapshot)
        );
      });
      try {
        let idx = 0;
        for (const file of imgFiles) {
          idx += 1;
          setUploadProgress(p => ({ ...p, current: idx, fileName: file.name, filePct: 0 }));
          const path = `users/${uid}/images/${genId()}_${file.name}`;
          const ref = fbStorage.ref(path);
          await putWithProgress(ref, file);
          const url = await ref.getDownloadURL();
          const used = parseInt(localStorage.getItem('jp_storageUsed')||'0') + file.size;
          localStorage.setItem('jp_storageUsed', String(used));
          uploadedImages.push({ url, path, name: file.name, type: 'image', size: file.size });
        }
        for (const file of jsonPdfFiles) {
          idx += 1;
          setUploadProgress(p => ({ ...p, current: idx, fileName: file.name, filePct: 0 }));
          const path = `users/${uid}/pdfs/${genId()}_${file.name}`;
          const ref = fbStorage.ref(path);
          await putWithProgress(ref, file);
          const url = await ref.getDownloadURL();
          const used = parseInt(localStorage.getItem('jp_storageUsed')||'0') + file.size;
          localStorage.setItem('jp_storageUsed', String(used));
          uploadedImages.push({ url, path, name: file.name, type: 'pdf', size: file.size });
        }
      } catch(e) { setJsonErr('文件上传失败：'+e.message); setUploading(false); return; }
      setUploading(false);
    }
    const { cnt, skippedN, skippedF } = doImport(d, uploadedImages);
    const fileMsg = uploadedImages.length > 0 ? ` · 文件 ${uploadedImages.length} 个` : '';
    const skipParts = [];
    if (skippedN > 0) skipParts.push(`笔记 ${skippedN}`);
    if (skippedF > 0) skipParts.push(`闪卡 ${skippedF}`);
    const skipMsg = skipParts.length > 0 ? ` · 跳过重复：${skipParts.join('、')}` : '';
    setJsonOk(`✅ 导入成功！笔记 ${cnt.n} 条 · 闪卡 ${cnt.f} 张${fileMsg}${skipMsg}`);
    setLastImportedCount(cnt.n);
    setJson(''); setImgFiles([]); setJsonPdfFiles([]);
  };

  const EXAMPLE = `{
  "notes": [
    {"title": "第1课文法：です・ます", "content": "礼貌体结尾，表示肯定。\\nです = 是\\nます = 动词礼貌形", "tags": ["文法", "第1课"]}
  ],
  "flashcards": [
    {"front": "おはようございます", "back": "早上好（正式）", "tags": ["打招呼"]},
    {"front": "ありがとうございます", "back": "谢谢（正式）", "tags": ["打招呼"]}
  ]
}`;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-1">📄 整理 &amp; 导入</h1>
      <p className="text-gray-400 text-sm mb-5">上传 PDF 或粘贴文字，AI 自动整理成笔记 / 闪卡后一键导入</p>

      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        {[['ai','🤖 AI 整理'],['json','📥 JSON 导入'],['merge','🔄 合并更新']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab===k?'bg-white shadow text-gray-800':'text-gray-400 hover:text-gray-600'}`}>{l}</button>
        ))}
      </div>

      {tab === 'ai' && (
        <div className="space-y-4">
          {/* Step 1: Source */}
          <Card>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">第一步：选择内容来源</p>
            <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
              {[['pdf','📄 上传 PDF'],['text','✍️ 粘贴文字']].map(([k,l]) => (
                <button key={k} onClick={() => { setSrcMode(k); setAiResult(''); setAiErr(''); setImportOk(''); }}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${srcMode===k?'bg-white shadow text-gray-800':'text-gray-400 hover:text-gray-600'}`}>{l}</button>
              ))}
            </div>

            {srcMode === 'pdf' && (
              <div>
                <label className={`inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors
                  ${isOnline && !extracting ? 'cursor-pointer bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-200'}`}>
                  <span>📂 选择 PDF 文件</span>
                  <input type="file" accept="application/pdf" disabled={!isOnline || extracting} className="hidden" onChange={handlePdfSelect} />
                </label>
                {extracting && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-indigo-600">
                      <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                      <span>
                        {pdfProgress.phase === 'extract'
                          ? `正在提取 ${pdfProgress.current}/${pdfProgress.total} 页`
                          : '正在初始化 PDF 解析器…（首次加载需从 CDN 下载，网络慢可能耗时较长）'}
                      </span>
                    </div>
                    {pdfFile && <p className="text-xs text-gray-400 truncate">{pdfFile.name}</p>}
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      {pdfProgress.phase === 'extract' && pdfProgress.total > 0 ? (
                        <div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${(pdfProgress.current / pdfProgress.total) * 100}%` }} />
                      ) : (
                        <div className="bg-indigo-500 h-1.5 rounded-full w-1/4 animate-pulse" />
                      )}
                    </div>
                    {pdfSlowWarning && (
                      <p className="text-xs text-amber-600">⚠️ 网络较慢，PDF 解析器加载耗时较长，请检查网络或稍候…</p>
                    )}
                  </div>
                )}
                {!extracting && pdfProgress.phase === 'error' && aiErr && (
                  <p className="text-red-500 text-sm mt-3">⚠️ {aiErr}</p>
                )}
                {pdfFile && !extracting && extractedText && (
                  <div className="mt-3 p-3 bg-green-50 rounded-xl border border-green-100 flex items-center gap-3">
                    <span className="text-green-600 text-lg">✅</span>
                    <div>
                      <p className="text-sm font-medium text-gray-700">{pdfFile.name}</p>
                      <p className="text-xs text-gray-400">共 {pdfPages} 页 · 提取 {extractedText.length.toLocaleString()} 字</p>
                    </div>
                  </div>
                )}
                {pdfFile && !extracting && !extractedText && !aiErr && (
                  <p className="text-xs text-amber-600 mt-3">⚠️ 未能提取文字（可能是扫描版 PDF，请改用「粘贴文字」）</p>
                )}
                {!isOnline && <p className="text-xs text-amber-600 mt-2">📴 需要网络连接</p>}
              </div>
            )}

            {srcMode === 'text' && (
              <textarea
                value={rawText}
                onChange={e => { setRawText(e.target.value); setAiResult(''); setImportOk(''); }}
                placeholder="粘贴上课内容、老师写的内容、或你自己记的零散文字…"
                rows={6}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              />
            )}
          </Card>

          {/* Step 2: Mode + organize */}
          <Card>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">第二步：选择整理方式</p>
            <div className="flex gap-2 flex-wrap mb-4">
              {PDF_COMMANDS.map(cmd => (
                <button key={cmd.id} onClick={() => setAiMode(cmd.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border
                    ${aiMode===cmd.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'}`}>
                  {cmd.label}
                  <span className="ml-1 text-xs opacity-60">{cmd.desc}</span>
                </button>
              ))}
            </div>
            <Btn onClick={() => organize(false)} disabled={aiLoading || !activeContent.trim() || !isOnline}>
              {aiLoading ? '整理中…' : 'AI 整理'}
            </Btn>
          </Card>

          {/* Step 3: Result */}
          {(aiResult || aiErr) && (
            <Card>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">第三步：预览 &amp; 导入</p>

              {aiErr && <p className="text-red-500 text-sm mb-3">⚠️ {aiErr}</p>}

              {aiResult && (
                <>
                  {aiParsed && (
                    <div className="flex gap-2 mb-3 flex-wrap">
                      {aiParsed.notes?.length > 0 && (
                        <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">📝 笔记 {aiParsed.notes.length} 条</span>
                      )}
                      {aiParsed.flashcards?.length > 0 && (
                        <span className="text-xs bg-purple-50 text-purple-700 px-3 py-1 rounded-full font-medium">🃏 闪卡 {aiParsed.flashcards.length} 张</span>
                      )}
                      {!aiParsed.notes?.length && !aiParsed.flashcards?.length && (
                        <span className="text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full">⚠️ JSON 结构异常，请检查或重新整理</span>
                      )}
                    </div>
                  )}

                  <textarea
                    value={aiResult}
                    onChange={e => setAiResult(e.target.value)}
                    rows={8}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none mb-3"
                  />

                  {!showFeedback ? (
                    <button onClick={() => setShowFeedback(true)}
                      className="text-xs text-indigo-500 hover:text-indigo-700 underline mb-4 block">
                      对结果不满意？给 AI 反馈重新整理 →
                    </button>
                  ) : (
                    <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-xs font-medium text-gray-500 mb-2">修改意见</p>
                      <textarea
                        value={feedback}
                        onChange={e => setFeedback(e.target.value)}
                        placeholder="例：请增加更多闪卡 / 把标签改成「第3课」/ 笔记内容太简略了…"
                        rows={3}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none mb-2"
                      />
                      <div className="flex items-center gap-3">
                        <Btn onClick={() => organize(true)} disabled={aiLoading || !feedback.trim()}>
                          {aiLoading ? '整理中…' : '重新整理'}
                        </Btn>
                        <button onClick={() => { setShowFeedback(false); setFeedback(''); }}
                          className="text-sm text-gray-400 hover:text-gray-600">取消</button>
                      </div>
                    </div>
                  )}

                  {importOk && (
                    <div className="mb-3">
                      <p className="text-green-600 text-sm font-medium">{importOk}</p>
                      {importedCount > 0 && setPage && (
                        <button onClick={() => setPage('knowledge')}
                          className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 underline font-medium">
                          前往知识库查看刚导入的笔记 →
                        </button>
                      )}
                    </div>
                  )}

                  <Btn onClick={importFromAI} disabled={!aiParsed || !!importOk}>
                    {importOk ? '已导入 ✓' : `导入${aiParsed ? `（笔记 ${aiParsed.notes?.length||0} · 闪卡 ${aiParsed.flashcards?.length||0}）` : ''}`}
                  </Btn>
                </>
              )}
            </Card>
          )}
        </div>
      )}

      {tab === 'json' && (
        <div>
          <Card className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">JSON 格式参考</p>
            <pre className="text-xs text-gray-500 bg-gray-50 rounded-xl p-4 overflow-x-auto">{EXAMPLE}</pre>
          </Card>
          <Card>
            <Textarea label="粘贴 JSON" value={json} onChange={e => setJson(e.target.value)} placeholder='{"notes":[...],"flashcards":[...]}' rows={10} />
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-2">可附加图片或 PDF 到导入的笔记（可选）</p>
              <div className="flex gap-2 flex-wrap">
                <label className={`inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl transition-colors
                  ${isOnline ? 'cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-600' : 'cursor-not-allowed bg-gray-50 text-gray-300'}`}>
                  <span>🖼 选择图片</span>
                  <input type="file" accept="image/*" multiple disabled={!isOnline} className="hidden" onChange={addImgFiles} />
                </label>
                <label className={`inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl transition-colors
                  ${isOnline ? 'cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-600' : 'cursor-not-allowed bg-gray-50 text-gray-300'}`}>
                  <span>📄 选择 PDF</span>
                  <input type="file" accept="application/pdf" multiple disabled={!isOnline} className="hidden" onChange={addJsonPdfFiles} />
                </label>
              </div>
              {imgFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {imgFiles.map((file, idx) => (
                    <div key={idx} className="relative group">
                      <img src={URL.createObjectURL(file)} alt={file.name} className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                      <button onClick={() => removeImg(idx)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                    </div>
                  ))}
                </div>
              )}
              {jsonPdfFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {jsonPdfFiles.map((file, idx) => (
                    <div key={idx} className="relative group flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                      <span className="text-xs text-gray-600 max-w-32 truncate">{file.name}</span>
                      <button onClick={() => removeJsonPdf(idx)} className="text-red-400 hover:text-red-600 text-xs ml-1">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {jsonErr && <p className="text-red-500 text-sm mb-3">⚠️ {jsonErr}</p>}
            {jsonOk && (
              <div className="mb-3">
                <p className="text-green-600 text-sm font-medium">{jsonOk}</p>
                {lastImportedCount > 0 && setPage && (
                  <button onClick={() => setPage('knowledge')}
                    className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 underline font-medium">
                    前往知识库查看刚导入的笔记 →
                  </button>
                )}
              </div>
            )}
            {uploading && uploadProgress.total > 0 && (
              <div className="mb-3 space-y-2">
                <div className="flex items-center gap-2 text-sm text-indigo-600">
                  <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                  <span>正在上传 {uploadProgress.current}/{uploadProgress.total}（{Math.round(uploadProgress.filePct)}%）</span>
                </div>
                {uploadProgress.fileName && (
                  <p className="text-xs text-gray-400 truncate">{uploadProgress.fileName}</p>
                )}
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${((Math.max(uploadProgress.current, 1) - 1 + uploadProgress.filePct / 100) / uploadProgress.total) * 100}%` }} />
                </div>
              </div>
            )}
            <Btn onClick={importJSON} disabled={!json.trim() || uploading}>{uploading ? '上传中…' : '导入'}</Btn>
          </Card>
        </div>
      )}

      {tab === 'merge' && (
        <div>
          <Card className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">合并更新</p>
            <p className="text-xs text-gray-500 leading-relaxed">把 Claude 返回的 JSON 粘在下面。规则：
              <br />• 闪卡按 <span className="font-semibold">front</span> 匹配，覆盖 <span className="font-semibold">back / tags</span>
              <br />• 笔记按 <span className="font-semibold">title</span> 匹配，覆盖 <span className="font-semibold">content / tags</span>
              <br />未匹配项默认不处理，可勾选「作为新笔记/闪卡插入」一次性新增；不会删除任何条目。</p>
            <pre className="text-xs text-gray-500 bg-gray-50 rounded-xl p-4 overflow-x-auto mt-2">{`{
  "flashcards": [{"front":"その","back":"那个\\n例：その本は私のです。","tags":["指示词"]}],
  "notes": [{"title":"指示代词","content":"...新内容...","tags":["语法"]}]
}`}</pre>
          </Card>
          <Card>
            <Textarea label="粘贴 JSON" value={mergeJson} onChange={e => setMergeJson(e.target.value)} placeholder='{"flashcards":[...], "notes":[...]}' rows={10} />
            {mergePreview && !mergePreview.error && (
              <div className="mb-3 space-y-2">
                {mergePreview.flashPart && (
                  <div className="p-3 bg-indigo-50 rounded-xl text-sm">
                    <p className="text-indigo-700">🃏 闪卡 共 <span className="font-semibold">{mergePreview.flashPart.total}</span>：
                      将更新 <span className="font-semibold text-green-700">{mergePreview.flashPart.willUpdate.length}</span> ·
                      无变化 <span className="text-gray-500">{mergePreview.flashPart.noChange.length}</span> ·
                      {insertUnmatchedFlash
                        ? <> 新增 <span className="font-semibold text-blue-700">{mergePreview.flashPart.noMatch.length}</span></>
                        : <> 未匹配 <span className="text-amber-600">{mergePreview.flashPart.noMatch.length}</span></>}
                    </p>
                    {mergePreview.flashPart.noMatch.length > 0 && (
                      <>
                        <label className="flex items-center gap-2 text-xs text-indigo-700 mt-2 cursor-pointer select-none">
                          <input type="checkbox" checked={insertUnmatchedFlash} onChange={e => setInsertUnmatchedFlash(e.target.checked)} />
                          未匹配的 {mergePreview.flashPart.noMatch.length} 张作为新闪卡插入
                        </label>
                        <details className="text-xs text-amber-700 mt-1">
                          <summary className="cursor-pointer hover:underline">查看未匹配的 front</summary>
                          <div className="mt-1 max-h-32 overflow-auto bg-white rounded p-2">{mergePreview.flashPart.noMatch.slice(0, 50).map(x => x.front).join(' · ')}{mergePreview.flashPart.noMatch.length > 50 && ` ... 共 ${mergePreview.flashPart.noMatch.length} 条`}</div>
                        </details>
                      </>
                    )}
                  </div>
                )}
                {mergePreview.notePart && (
                  <div className="p-3 bg-purple-50 rounded-xl text-sm">
                    <p className="text-purple-700">📝 笔记 共 <span className="font-semibold">{mergePreview.notePart.total}</span>：
                      将更新 <span className="font-semibold text-green-700">{mergePreview.notePart.willUpdate.length}</span> ·
                      无变化 <span className="text-gray-500">{mergePreview.notePart.noChange.length}</span> ·
                      {insertUnmatchedNotes
                        ? <> 新增 <span className="font-semibold text-blue-700">{mergePreview.notePart.noMatch.length}</span></>
                        : <> 未匹配 <span className="text-amber-600">{mergePreview.notePart.noMatch.length}</span></>}
                    </p>
                    {mergePreview.notePart.noMatch.length > 0 && (
                      <>
                        <label className="flex items-center gap-2 text-xs text-purple-700 mt-2 cursor-pointer select-none">
                          <input type="checkbox" checked={insertUnmatchedNotes} onChange={e => setInsertUnmatchedNotes(e.target.checked)} />
                          未匹配的 {mergePreview.notePart.noMatch.length} 条作为新笔记插入
                        </label>
                        <details className="text-xs text-amber-700 mt-1">
                          <summary className="cursor-pointer hover:underline">查看未匹配的 title</summary>
                          <div className="mt-1 max-h-32 overflow-auto bg-white rounded p-2">{mergePreview.notePart.noMatch.slice(0, 50).map(x => x.title).join(' · ')}{mergePreview.notePart.noMatch.length > 50 && ` ... 共 ${mergePreview.notePart.noMatch.length} 条`}</div>
                        </details>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            {mergePreview?.error && <p className="text-red-500 text-sm mb-3">⚠️ {mergePreview.error}</p>}
            {mergeErr && <p className="text-red-500 text-sm mb-3">⚠️ {mergeErr}</p>}
            {mergeOk && <p className="text-green-600 text-sm font-medium mb-3">{mergeOk}</p>}
            <p className="text-xs text-amber-600 mb-3">⚠️ 操作前自动备份，可用「恢复备份」撤销最近一次合并。</p>
            <div className="flex gap-2">
              <Btn onClick={applyMerge} disabled={!mergePreview || mergePreview.error || (
                (mergePreview.flashPart?.willUpdate.length || 0)
                + (mergePreview.notePart?.willUpdate.length || 0)
                + (insertUnmatchedFlash ? (mergePreview.flashPart?.noMatch.length || 0) : 0)
                + (insertUnmatchedNotes ? (mergePreview.notePart?.noMatch.length || 0) : 0)
                === 0)}>合并更新</Btn>
              {mergeHasBackup && <Btn variant="secondary" onClick={restoreMergeBackup}>恢复备份</Btn>}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

