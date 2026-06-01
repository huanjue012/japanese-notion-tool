// ─── KNOWLEDGE BASE ────────────────────────────────────────────────────────────
const KnowledgeBase = ({ notes, setNotes, allTags, uid, isOnline, importedNoteIds, setImportedNoteIds, setCards, cards, setPage, onNav, navCtx, clearNavCtx }) => {
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ title: '', content: '', tags: [], images: [] });
  const [uploadingImg, setUploadingImg] = useState(false);
  const [activeView, setActiveView] = useState('notes'); // 'notes' | 'translate'
  const [transInput, setTransInput] = useState('');
  const [transResult, setTransResult] = useState('');
  const [transDir, setTransDir] = useState('ja|zh'); // 'ja|zh' or 'zh|ja'
  const [transLoading, setTransLoading] = useState(false);
  const [transAdded, setTransAdded] = useState(false);
  const [transSource, setTransSource] = useState('');     // '' | 'flashcard' | 'api'
  const [transHiragana, setTransHiragana] = useState('');
  const [transHiraLoading, setTransHiraLoading] = useState(false);
  const [contentExpanded, setContentExpanded] = useState(false);
  const [imagePreview, setImagePreview] = useState(null); // { url, name }
  const [pdfPreview, setPdfPreview] = useState(null); // { url, name }
  const [bookmarkFilter, setBookmarkFilter] = useState(false);
  const [studiedFilter, setStudiedFilter] = useState(null); // null=全部 false=未学 true=已学
  const [notesVisible, setNotesVisible] = useState(100);
  const notesSentinel = useRef(null);
  // PDF 导出
  const [pdfModal, setPdfModal] = useState(false);
  const [pdfMode, setPdfMode] = useState('filter'); // 'filter' | 'manual'
  const [pdfTags, setPdfTags] = useState(() => new Set());
  const [pdfBookmarkOnly, setPdfBookmarkOnly] = useState(false);
  const [pdfPicked, setPdfPicked] = useState(() => new Set()); // 手动选中的 note id
  const [pdfSearch, setPdfSearch] = useState('');
  const [pdfIncludeImages, setPdfIncludeImages] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfToast, setPdfToast] = useState('');
  const [pdfImageMap, setPdfImageMap] = useState({}); // { url: dataUrl }

  const tagCounts = useMemo(() => {
    const c = {};
    notes.forEach(n => n.tags?.forEach(t => c[t] = (c[t] || 0) + 1));
    return c;
  }, [notes]);

  const studiedCount = useMemo(() => notes.filter(n => !!n.studied).length, [notes]);

  const filtered = useMemo(() => {
    let result = notes.filter(n => {
      const q = search.toLowerCase();
      const ms = !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
      const mt = !activeTag || n.tags?.includes(activeTag);
      const mb = !bookmarkFilter || !!n.bookmarked;
      const mst = studiedFilter === null || !!n.studied === studiedFilter;
      return ms && mt && mb && mst;
    });
    if (importedNoteIds?.length > 0) {
      result = result.filter(n => importedNoteIds.includes(n.id));
    }
    return result.sort((a,b) => new Date(b.updatedAt||b.createdAt||0) - new Date(a.updatedAt||a.createdAt||0));
  }, [notes, search, activeTag, importedNoteIds, bookmarkFilter, studiedFilter]);

  useEffect(() => { setNotesVisible(100); }, [filtered]);
  useEffect(() => {
    if (!notesSentinel.current) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setNotesVisible(v => v + 100); }, { threshold: 0 });
    obs.observe(notesSentinel.current);
    return () => obs.disconnect();
  }, [notesVisible]);

  const toggleBookmark = id => setNotes(p => p.map(n => n.id === id ? { ...n, bookmarked: !n.bookmarked, updatedAt: new Date().toISOString() } : n));
  const toggleStudied = id => setNotes(p => p.map(n => n.id === id ? { ...n, studied: !n.studied, updatedAt: new Date().toISOString() } : n));
  const openNew = () => { setForm({ title: '', content: '', tags: activeTag ? [activeTag] : [], images: [], format: 'markdown' }); setContentExpanded(false); setModal('new'); };
  const openEdit = n => { setForm({ ...n, images: n.images || [] }); setContentExpanded(false); setModal(n.id); };

  const uploadFile = async (file) => {
    if (!navigator.onLine) { alert('上传文件需要网络连接'); return; }
    const isHeic = file.type === 'image/heic' || file.type === 'image/heif' || /\.heic$/i.test(file.name) || /\.heif$/i.test(file.name);
    let isImage = file.type.startsWith('image/') || isHeic;
    const isPdf   = file.type === 'application/pdf';
    if (!isImage && !isPdf) { alert('请选择图片或 PDF 文件'); return; }
    setUploadingImg(true);
    try {
      let uploadFile = file;
      let uploadName = file.name;
      if (isHeic && window.heic2any) {
        try {
          const converted = await window.heic2any({ blob: file, toType: 'image/png' });
          uploadFile = converted instanceof Blob ? converted : converted[0];
          uploadName = file.name.replace(/\.heic$/i, '.png').replace(/\.heif$/i, '.png');
        } catch(e) { /* 转换失败则直接上传原文件 */ }
      }
      const folder = isImage ? 'images' : 'pdfs';
      const path = `users/${uid}/${folder}/${genId()}_${uploadName}`;
      const ref = fbStorage.ref(path);
      await ref.put(uploadFile);
      const url = await ref.getDownloadURL();
      const used = parseInt(localStorage.getItem('jp_storageUsed') || '0') + uploadFile.size;
      localStorage.setItem('jp_storageUsed', String(used));
      setForm(p => ({ ...p, images: [...(p.images || []), { url, path, name: uploadName, type: isImage ? 'image' : 'pdf', size: uploadFile.size }] }));
    } catch (e) { alert('上传失败：' + e.message); }
    finally { setUploadingImg(false); }
  };

  const downloadFile = async (url, name) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, '_blank');
    }
  };

  const removeImage = (path) => {
    const img = form.images?.find(i => i.path === path);
    if (img?.size) {
      const used = Math.max(0, parseInt(localStorage.getItem('jp_storageUsed') || '0') - img.size);
      localStorage.setItem('jp_storageUsed', String(used));
    }
    setForm(p => ({ ...p, images: p.images.filter(i => i.path !== path) }));
  };
  const save = () => {
    if (!form.title.trim()) return;
    if (modal === 'new') setNotes(p => [...p, { ...form, bookmarked: form.bookmarked || false, id: genId(), createdAt: new Date().toISOString() }]);
    else setNotes(p => p.map(n => n.id === modal ? { ...n, ...form, updatedAt: new Date().toISOString() } : n));
    setModal(null);
  };
  const del = id => { if (confirm('确定删除此笔记？')) setNotes(p => p.filter(n => n.id !== id)); };

  const { exportForClaude, applyDeleteList, restoreBackup, hasBackup, exportToast, deleteModal, setDeleteModal, deleteJson, setDeleteJson, exportModal, setExportModal, exportPromptText, copyPrompt, downloadJson, selectedTags: exportSelectedTags, toggleTag: exportToggleTag, clearTags: exportClearTags, availableTags: exportAvailableTags, filteredCount, totalCount, promptList, selectedPromptIdx, setSelectedPromptIdx } = useClaudeExport({
    items: notes,
    mapExport: items => ({ notes: items.map(({ title, content, tags, format }) => format ? ({ title, content, tags, format }) : ({ title, content, tags })) }),
    filename: 'notes-export',
    claudePrompts: [
      { label: '🔍 查找重复', build: json => `请帮我检查以下日语学习笔记，找出完全重复或高度相似的笔记（标题相同，或内容主旨完全一样）。\n\n只返回以下格式的 JSON，不要包含任何其他文字或解释：\n{"delete_duplicates": ["重复笔记的title1", "重复笔记的title2"]}\n\n如果没有重复，返回 {"delete_duplicates": []}。每组重复中保留最好的一条，只列出应删除的那些。\n\n笔记数据如下：\n\n${json}` },
      { label: '✏️ 审阅并改进内容', build: json => `请帮我检查以下日语学习笔记，指出有误的内容、补充不完整的地方，并以相同JSON格式返回修正后的版本（包含所有笔记）：\n\n${json}` },
      { label: '✨ 补充例句和读音', build: json => `请帮我给以下日语学习笔记补充内容：在每条笔记的 content 字段末尾追加 1-2 个简短例句（日中对照）+ 出现的汉字读音。保持 title 和 tags 不变，content 原内容保留，只在末尾追加。\n\n例句格式：\\n\\n例：日语例句。中文翻译。\\n汉字 - 读音\n\n只返回完整的 JSON（包含所有笔记，未改动的也要原样返回），格式与输入相同：\n{"notes": [{"title":"...","content":"...","tags":[...]}]}\n\n笔记数据：\n\n${json}` },
      { label: '🎨 美化为彩色 HTML 笔记', build: json => `请把以下日语学习笔记每一条的 content 改写成「自包含的彩色排版 HTML」，并在每条笔记上加 "format":"html"。保持 title 和 tags 不变。\n\n要求：\n1. 每条笔记的 content 是一段自包含 HTML，开头用 <style> 写好该条用到的 CSS（class 自取，但要自包含，不依赖外部样式）。\n2. 排版参考以下结构：标题区、语法卡(.grammar-card 左边框高亮)、句型(.pattern)、释义(.meaning)、例句框(.example 含日文.jp+中文.cn)、💡提示框(.tip 绿色)、⚠️警示框(.warn 红色)、重点词汇网格(.vocab-grid)、彩色表格、对话(.dialogue)。用 <mark> 高亮重点助词、<strong> 标红关键词。\n3. 配色温和清晰（米白底 #faf7f2、墨色字、红/金/绿/蓝点缀），中文为主、日文夹注，适合手机阅读（宽度自适应）。\n4. 不要写 <html>/<head>/<body> 外壳，从 <style> 或第一个内容标签开始即可。\n\n只返回完整 JSON（包含所有笔记，未改动的也原样返回），格式与输入相同，每条加 format 字段：\n{"notes": [{"title":"...","content":"<style>...</style>...","format":"html","tags":[...]}]}\n\n笔记数据：\n\n${json}` },
    ],
    matchKey: 'title',
    itemLabel: '笔记',
    setItems: setNotes,
  });

  const computeHiragana = async (text) => {
    setTransHiraLoading(true);
    try {
      const raw = await callGemini(`将以下日文转换为全假名（平假名）读法，只输出假名，不加任何其他文字：\n${text}`);
      const hira = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      setTransHiragana(hira);
    } catch (e) { console.error('hiragana error:', e); setTransHiragana(''); }
    finally { setTransHiraLoading(false); }
  };

  const translate = async () => {
    const q = transInput.trim();
    if (!q) return;
    setTransLoading(true); setTransResult(''); setTransAdded(false);
    setTransSource(''); setTransHiragana(''); setTransHiraLoading(false);

    const matched = cards.find(c => transDir === 'ja|zh'
      ? c.front?.trim() === q
      : c.back?.trim() === q);
    if (matched) {
      const result = transDir === 'ja|zh' ? matched.back : matched.front;
      setTransResult(result || '');
      setTransSource('flashcard');
      setTransLoading(false);
      computeHiragana(transDir === 'ja|zh' ? q : result);
      return;
    }

    setTransSource('api');
    try {
      const [sl, tl] = transDir === 'ja|zh' ? ['ja', 'zh-CN'] : ['zh-CN', 'ja'];
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(q)}`;
      const res = await fetch(url);
      const data = await res.json();
      const apiResult = data[0]?.map(x => x?.[0] || '').join('') || '翻译失败';
      setTransResult(apiResult);
      computeHiragana(transDir === 'ja|zh' ? q : apiResult);
    } catch { setTransResult('翻译失败，请检查网络'); }
    finally { setTransLoading(false); }
  };

  const addToFlashcard = () => {
    if (!transInput.trim() || !transResult) return;
    const [front, back] = transDir === 'ja|zh'
      ? [transInput.trim(), transResult]
      : [transResult, transInput.trim()];
    if (cards.some(c => c.front === front && c.back === back)) {
      setTransAdded({ front, back, isDup: true });
      setTimeout(() => setTransAdded(false), 2500);
      return;
    }
    setCards(p => [...p, { id: genId(), front, back, tags: [], createdAt: new Date().toISOString() }]);
    setTransAdded({ front, back });
    setTimeout(() => setTransAdded(false), 2500);
  };

  useEffect(() => {
    if (navCtx?.openNoteId) {
      const note = notes.find(n => n.id === navCtx.openNoteId);
      if (note) openEdit(note);
      clearNavCtx?.();
    }
  }, [navCtx?.openNoteId]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-800">📝 知识库</h1>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setActiveView('notes')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${activeView === 'notes' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              笔记列表
            </button>
            <button onClick={() => setActiveView('translate')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${activeView === 'translate' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              翻译
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          {notes.length > 0 && <Btn variant="danger" onClick={() => { if (confirm(`删除全部 ${notes.length} 条笔记？此操作不可恢复。`)) setNotes([]); }}>🗑 全部删除</Btn>}
          {notes.length > 0 && <Btn variant="secondary" onClick={() => setDeleteModal(true)}>🗑 删除重复</Btn>}
          {notes.length > 0 && <Btn variant="secondary" onClick={exportForClaude}>导出给 Claude</Btn>}
          {notes.length > 0 && <Btn variant="secondary" onClick={() => { setPdfMode('filter'); setPdfTags(new Set()); setPdfBookmarkOnly(false); setPdfPicked(new Set()); setPdfSearch(''); setPdfModal(true); }}>📄 导出 PDF</Btn>}
          <Btn onClick={openNew}>+ 新建笔记</Btn>
        </div>
      </div>

      {exportToast && <div className="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2">{exportToast}</div>}

      {deleteModal && (
        <Modal open={true} title="删除重复笔记" onClose={() => { setDeleteModal(false); setDeleteJson(''); }}>
          <p className="text-sm text-gray-500 mb-2">将 Claude 返回的 JSON 粘贴到此处：</p>
          <Textarea value={deleteJson} onChange={e => setDeleteJson(e.target.value)} placeholder='{"delete_duplicates": ["标题1", "标题2"]}' rows={6} />
          <div className="flex gap-2 mt-3 items-center">
            <div className="flex-1">{hasBackup && <Btn variant="secondary" onClick={restoreBackup}>恢复备份</Btn>}</div>
            <Btn variant="secondary" onClick={() => { setDeleteModal(false); setDeleteJson(''); }}>取消</Btn>
            <Btn variant="danger" onClick={applyDeleteList}>确认删除</Btn>
          </div>
        </Modal>
      )}

      {exportModal && (
        <Modal open={true} title="导出给 Claude" onClose={() => setExportModal(false)}>
          <div className="mb-3">
            <p className="text-sm text-gray-600 mb-2">📤 将导出 <span className="font-semibold">{filteredCount}</span> / {totalCount} 条笔记{exportSelectedTags.size === 0 && '（全部）'}</p>
            {exportAvailableTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <Badge onClick={exportClearTags} color={exportSelectedTags.size === 0 ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}>全部</Badge>
                {exportAvailableTags.map(([tag, cnt]) => (
                  <Badge key={tag} onClick={() => exportToggleTag(tag)} color={exportSelectedTags.has(tag) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}>{tag} ({cnt})</Badge>
                ))}
              </div>
            )}
          </div>
          <div className="mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">选择任务</p>
            <div className="flex flex-wrap gap-1.5">
              {promptList.map((p, i) => (
                <Badge key={i} onClick={() => setSelectedPromptIdx(i)} color={selectedPromptIdx === i ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}>{p.label}</Badge>
              ))}
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-2">以下 Prompt 包含你的数据，复制后粘贴给 Claude：</p>
          <textarea className="w-full border rounded-lg p-2 text-sm font-mono h-48 resize-none" readOnly value={exportPromptText} />
          <div className="flex gap-2 mt-3 justify-end">
            <Btn variant="secondary" onClick={downloadJson} disabled={filteredCount === 0}>下载 JSON</Btn>
            <Btn onClick={copyPrompt} disabled={filteredCount === 0}>复制 Prompt</Btn>
          </div>
        </Modal>
      )}

      {activeView === 'notes' && <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索笔记标题或内容..."
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-300" />}

      {activeView === 'notes' && importedNoteIds?.length > 0 && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-indigo-50 rounded-xl text-xs text-indigo-700">
          <span>显示刚导入的 {importedNoteIds.length} 条笔记</span>
          <button onClick={() => setImportedNoteIds([])} className="ml-auto text-indigo-400 hover:text-indigo-600">清除筛选 ×</button>
        </div>
      )}

      {activeView === 'notes' && <CollapsibleTagFilter tagCounts={tagCounts} total={notes.length} activeTag={activeTag} setActiveTag={setActiveTag} />}

      {activeView === 'notes' && <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button onClick={() => setBookmarkFilter(false)}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${!bookmarkFilter ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:text-gray-600'}`}>
          全部
        </button>
        <button onClick={() => setBookmarkFilter(true)}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${bookmarkFilter ? 'bg-yellow-100 text-yellow-700' : 'text-gray-400 hover:text-gray-600'}`}>
          ★ 收藏
        </button>
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <button onClick={() => setStudiedFilter(v => v === false ? null : false)}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${studiedFilter === false ? 'bg-orange-100 text-orange-700' : 'text-gray-400 hover:text-gray-600'}`}>
          ○ 未学
        </button>
        <button onClick={() => setStudiedFilter(v => v === true ? null : true)}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${studiedFilter === true ? 'bg-green-100 text-green-700' : 'text-gray-400 hover:text-gray-600'}`}>
          ✓ 已学
        </button>
        {notes.length > 0 && <span className="ml-auto text-xs text-gray-400">{studiedCount} / {notes.length} 已学</span>}
      </div>}
      {activeView === 'notes' && (filtered.length === 0 ? (
        <Card className="text-center py-16">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-gray-400 mb-4">{search || activeTag ? '没有符合条件的笔记' : '还没有笔记'}</p>
          <Btn onClick={openNew}>创建第一篇笔记</Btn>
        </Card>
      ) : (
        <>
        <div className="grid md:grid-cols-2 gap-3">
          {filtered.slice(0, notesVisible).map((n, i) => (
            <React.Fragment key={n.id}>
              <Card onClick={() => openEdit(n)}>
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-semibold text-gray-800 text-sm leading-snug flex-1 pr-2">{n.title}</h3>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={e => { e.stopPropagation(); toggleStudied(n.id); }}
                      title={n.studied ? '标为未学' : '标为已学'}
                      className={`text-sm leading-none font-bold transition-colors ${n.studied ? 'text-green-500' : 'text-gray-200 hover:text-green-400'}`}>
                      {n.studied ? '✓' : '○'}
                    </button>
                    <button onClick={e => { e.stopPropagation(); toggleBookmark(n.id); }}
                      className={`text-base leading-none transition-colors ${n.bookmarked ? 'text-yellow-400' : 'text-gray-200 hover:text-yellow-300'}`}>
                      {n.bookmarked ? '★' : '☆'}
                    </button>
                    <button onClick={e => { e.stopPropagation(); del(n.id); }} className="text-gray-200 hover:text-red-400 text-base">🗑</button>
                  </div>
                </div>
                <div className="mb-3 text-xs text-gray-500 leading-relaxed"
                  style={{display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
                  {noteSnippet(n.content, n.format)}
                </div>
                {n.images?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {n.images.map((att, i) => att.type === 'pdf' ? (
                      <button key={i} onClick={e => { e.stopPropagation(); setPdfPreview({ url: att.url, name: att.name }); }}
                        className="w-14 h-14 border border-gray-100 rounded-lg bg-red-50 flex flex-col items-center justify-center hover:bg-red-100 transition-colors cursor-pointer">
                        <span className="text-xl">📄</span>
                        <span className="text-xs text-gray-400 truncate w-full text-center px-1">{att.name?.split('.')[0]?.slice(0,6)}</span>
                      </button>
                    ) : (
                      <img key={i} src={att.url} onClick={e => { e.stopPropagation(); setImagePreview({ url: att.url, name: att.name }); }}
                        className="w-14 h-14 object-cover rounded-lg border border-gray-100 cursor-pointer hover:opacity-80 transition-opacity" />
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-1">
                  {n.tags?.map(t => <Badge key={t}>{t}</Badge>)}
                </div>
                <p className="text-xs text-gray-300 mt-2">{fmt(n.updatedAt || n.createdAt)}</p>
              </Card>
              {i === Math.floor(notesVisible * 0.7) - 1 && (
                <div ref={notesSentinel} style={{gridColumn:'1/-1',height:'1px'}} />
              )}
            </React.Fragment>
          ))}
        </div>
        {filtered.length > notesVisible && (
          <div className="text-center mt-4">
            <Btn variant="secondary" onClick={() => setNotesVisible(v => v + 100)}>
              加载更多（还有 {filtered.length - notesVisible} 篇）
            </Btn>
          </div>
        )}
        </>
      ))}

      {activeView === 'translate' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setTransDir('ja|zh')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${transDir === 'ja|zh' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              日 → 中
            </button>
            <button onClick={() => setTransDir('zh|ja')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${transDir === 'zh|ja' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              中 → 日
            </button>
            <span className="text-xs text-gray-400 ml-1">Google 翻译</span>
          </div>
          <textarea
            value={transInput}
            onChange={e => { setTransInput(e.target.value); setTransResult(''); setTransAdded(false); setTransSource(''); setTransHiragana(''); setTransHiraLoading(false); }}
            placeholder={transDir === 'ja|zh' ? '输入日语...' : '输入中文...'}
            rows={4}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none mb-3"
          />
          <button onClick={translate} disabled={transLoading || !transInput.trim()}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-indigo-700 transition-colors mb-4">
            {transLoading ? '翻译中...' : '翻译'}
          </button>
          {transResult && (
            <div className="bg-gray-50 rounded-lg p-3 mb-3">
              <p className="text-xs text-gray-400 mb-1">
                {transDir === 'ja|zh' ? '中文翻译' : '日语翻译'}
                {transSource === 'flashcard' && <span className="ml-2 text-emerald-600">✓ 来自闪卡</span>}
              </p>
              <p className="text-sm text-gray-700">{transResult}</p>
              {(transHiraLoading || transHiragana) && (
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  {transHiraLoading ? '⏳ 正在生成假名…' : `🔊 ${transHiragana}`}
                </p>
              )}
            </div>
          )}
          {transResult && (
            <button onClick={addToFlashcard} disabled={!!transAdded}
              className="w-full py-2 border border-indigo-200 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors disabled:opacity-60">
              {transAdded?.isDup ? '⚠ 已在闪卡中' : transAdded ? '✓ 已加入闪卡' : '＋ 加入闪卡'}
            </button>
          )}
          {transAdded && (
            <div className={`mt-2 rounded-lg px-3 py-2 text-xs border ${transAdded.isDup ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
              <div className="flex gap-1 mb-0.5"><span className="font-semibold">表：</span><span>{transAdded.front}</span></div>
              <div className="flex gap-1"><span className="font-semibold">背：</span><span>{transAdded.back}</span></div>
            </div>
          )}
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'new' ? '新建笔记' : '编辑笔记'} wide>
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">标题</p>
          <textarea
            value={form.title}
            onChange={e => setForm(p => ({...p, title: e.target.value}))}
            placeholder="笔记标题…"
            rows={1}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent resize-none overflow-hidden"
            style={{ minHeight: '38px' }}
            ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
            onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
          />
        </div>
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              内容 {contentExpanded ? '▲' : '▼'}
            </label>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5 bg-gray-100 rounded-md p-0.5">
                <button type="button" onClick={() => setForm(p => ({...p, format: 'markdown'}))}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${form.format !== 'html' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                  Markdown
                </button>
                <button type="button" onClick={() => setForm(p => ({...p, format: 'html'}))}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${form.format === 'html' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                  HTML
                </button>
              </div>
              <button type="button" onClick={() => setContentExpanded(v => !v)}
                className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                {contentExpanded ? '收起' : '展开编辑'}
              </button>
            </div>
          </div>
          {!contentExpanded && form.content && (
            <div className="border border-gray-100 rounded-xl bg-gray-50 px-3 py-2">
              <NoteContent content={form.content} format={form.format} className="text-sm" />
            </div>
          )}
          {!contentExpanded && !form.content && (
            <div className="border border-dashed border-gray-200 rounded-xl py-3 text-center text-xs text-gray-300 cursor-pointer"
              onClick={() => setContentExpanded(true)}>
              点击展开输入内容
            </div>
          )}
          {contentExpanded && (
            <>
              <textarea rows={10}
                className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent resize-none ${form.format === 'html' ? 'font-mono' : ''}`}
                value={form.content}
                onChange={e => setForm(p => ({...p, content: e.target.value}))}
                placeholder={form.format === 'html' ? '粘贴完整 HTML（可含 <style>），将以彩色排版渲染…' : '记录知识点、例句、文法解释…支持 Markdown 表格'} />
              {form.content && (
                <div className="mt-2 mb-2 border border-gray-100 rounded-xl bg-gray-50 p-3">
                  <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">预览</p>
                  <NoteContent content={form.content} format={form.format} />
                </div>
              )}
            </>
          )}
        </div>
        <TagSelector selected={form.tags} onChange={tags => setForm(p => ({...p, tags}))} pool={allTags} />
        {onNav && form.tags?.length > 0 && (
          <div className="mt-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
            <p className="text-xs font-semibold text-gray-500 mb-2">🔗 相关练习</p>
            <div className="flex flex-col gap-1.5">
              {form.tags.map(tag => {
                const cardCount = (cards || []).filter(c => c.tags?.includes(tag)).length;
                return (
                  <div key={tag} className="flex items-center gap-2 flex-wrap">
                    <Badge>#{tag}</Badge>
                    <button onClick={() => { setModal(null); onNav('flashcards', { tag }); }}
                      className="text-xs px-2 py-1 rounded-lg border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-100 transition-colors">
                      🃏 闪卡{cardCount > 0 ? `（${cardCount}）` : ''}
                    </button>
                    <button onClick={() => { setModal(null); onNav('ai', { tab: 'quiz', tags: [tag] }); }}
                      className="text-xs px-2 py-1 rounded-lg border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-100 transition-colors">
                      ✍ AI 出题
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="mt-3">
          <p className="text-xs font-semibold text-gray-500 mb-1.5">附件（图片 / PDF）</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {(form.images || []).map((att, i) => (
              <div key={i} className="relative group">
                {att.type === 'pdf' ? (
                  <div className="w-16 h-16 border border-gray-200 rounded-lg bg-red-50 flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:bg-red-100 transition-colors"
                    onClick={() => setPdfPreview({ url: att.url, name: att.name })}>
                    <span className="text-2xl">📄</span>
                    <span className="text-xs text-gray-400 truncate w-full text-center px-1">{att.name?.split('.')[0]?.slice(0,8)}</span>
                  </div>
                ) : (
                  <img src={att.url} onClick={() => setImagePreview({ url: att.url, name: att.name })}
                    className="w-16 h-16 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity" />
                )}
                <button onClick={() => removeImage(att.path)}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                <button onClick={() => downloadFile(att.url, att.name)}
                  className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs rounded-b-lg py-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  title={`下载 ${att.name}`}>↓</button>
              </div>
            ))}
            {(() => { const _su = parseInt(localStorage.getItem('jp_storageUsed')||'0'); const _sl = parseInt(localStorage.getItem('jp_storageLimit')||'4831838208'); const _atLimit = _su >= _sl; return (
            <label className={`w-16 h-16 border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-all
              ${(!isOnline || _atLimit) ? 'border-gray-100 cursor-not-allowed opacity-40' : 'border-gray-200 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30'}`}
              title={!isOnline ? '离线时无法上传文件' : _atLimit ? '存储空间已满，请在设置中调整上限' : ''}>
              <input type="file" accept="image/*,application/pdf" disabled={!isOnline || _atLimit} onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])} className="hidden" />
              {uploadingImg ? <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /> : <span className="text-gray-300 text-xl">+</span>}
            </label>); })()}
          </div>
        </div>
        {modal !== 'new' && onNav && form.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 pb-1">
            {cards.filter(c => c.tags?.some(t => form.tags.includes(t))).length > 0 && (
              <Btn variant="secondary" onClick={() => { onNav('flashcards', { tag: form.tags[0], mode: 'all' }); setModal(null); }}>
                查看相关闪卡 ({cards.filter(c => c.tags?.some(t => form.tags.includes(t))).length})
              </Btn>
            )}
            <Btn variant="secondary" onClick={() => { onNav('ai', { tab: 'quiz', tags: form.tags }); setModal(null); }}>查看练习题</Btn>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Btn variant="secondary" onClick={() => setModal(null)}>取消</Btn>
          <Btn onClick={save}>保存</Btn>
        </div>
      </Modal>
      {imagePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setImagePreview(null)}>
          <div className="relative max-w-4xl max-h-full p-4" onClick={e => e.stopPropagation()}>
            <img src={imagePreview.url} alt={imagePreview.name} className="max-w-full max-h-[85vh] rounded-xl object-contain" />
            <button onClick={() => setImagePreview(null)}
              className="absolute -top-2 -right-2 bg-white rounded-full w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 shadow-lg text-lg font-bold">×</button>
            {imagePreview.name && <p className="text-center text-white text-xs mt-2 opacity-70">{imagePreview.name}</p>}
          </div>
        </div>
      )}
      {pdfPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setPdfPreview(null)}>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4" style={{height:'85vh'}} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700 truncate">{pdfPreview.name}</span>
              <div className="flex items-center gap-3">
                <a href={pdfPreview.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">在新标签页打开</a>
                <button onClick={() => setPdfPreview(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
              </div>
            </div>
            <iframe src={pdfPreview.url} className="w-full rounded-b-2xl" style={{height:'calc(85vh - 53px)'}} title={pdfPreview.name} />
          </div>
        </div>
      )}
      {pdfModal && (() => {
        const tagOptions = Object.entries(tagCounts).sort((a,b) => b[1]-a[1]);
        const filtered = pdfMode === 'manual'
          ? notes.filter(n => pdfPicked.has(n.id))
          : notes.filter(n => {
              if (pdfBookmarkOnly && !n.bookmarked) return false;
              if (pdfTags.size > 0 && !n.tags?.some(t => pdfTags.has(t))) return false;
              return true;
            });
        const togglePdfTag = (tag) => setPdfTags(prev => { const next = new Set(prev); if (next.has(tag)) next.delete(tag); else next.add(tag); return next; });
        const togglePicked = (id) => setPdfPicked(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
        const q = pdfSearch.trim().toLowerCase();
        const pickList = !q ? notes : notes.filter(n => n.title.toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q));
        const COLLAPSE_THRESHOLD = 30, COLLAPSED_LIMIT = 20;
        const collapsePickList = !q && pickList.length > COLLAPSE_THRESHOLD;
        const sortedPickList = [...pickList].sort((a, b) => {
          const aPicked = pdfPicked.has(a.id), bPicked = pdfPicked.has(b.id);
          if (aPicked !== bPicked) return aPicked ? -1 : 1; // 已选优先
          return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
        });
        const visiblePickList = collapsePickList ? sortedPickList.slice(0, COLLAPSED_LIMIT) : sortedPickList;
        const doExport = async () => {
          if (filtered.length === 0) return;
          setPdfLoading(true);
          try {
            if (pdfIncludeImages) {
              const urls = filtered.flatMap(n => (n.images || []).filter(i => i.type === 'image').map(i => i.url));
              const uniq = [...new Set(urls)];
              const map = await prefetchImagesAsDataUrls(uniq);
              setPdfImageMap(map);
              await new Promise(r => setTimeout(r, 100));
            } else {
              await new Promise(r => setTimeout(r, 50));
            }
            await exportElementToPDF('notes-pdf-content', `japanese-notes-${pdfDateStr()}`);
            setPdfToast(`✅ 已导出 ${filtered.length} 条笔记为 PDF`);
            setTimeout(() => setPdfToast(''), 3000);
            setPdfModal(false);
          } catch (e) {
            alert('PDF 导出失败：' + e.message);
          } finally {
            setPdfLoading(false);
            setPdfImageMap({});
          }
        };
        return (
          <Modal open={true} title="导出笔记 PDF" onClose={() => !pdfLoading && setPdfModal(false)} wide>
            {/* 模式切换 */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-3 w-fit">
              {[['filter', '按筛选'], ['manual', '手动选择']].map(([v, l]) => (
                <button key={v} onClick={() => setPdfMode(v)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${pdfMode === v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {l}
                </button>
              ))}
            </div>

            {pdfMode === 'filter' && (
              <>
                <p className="text-sm text-gray-600 mb-2">📄 将导出 <span className="font-semibold">{filtered.length}</span> / {notes.length} 条笔记{pdfTags.size === 0 && !pdfBookmarkOnly && '（全部）'}</p>
                {tagOptions.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-400 mb-1.5">按标签筛选（不选 = 全部）</p>
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                      <Badge onClick={() => setPdfTags(new Set())} color={pdfTags.size === 0 ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}>全部</Badge>
                      {tagOptions.map(([tag, cnt]) => (
                        <Badge key={tag} onClick={() => togglePdfTag(tag)} color={pdfTags.has(tag) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}>{tag} ({cnt})</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 mb-3">
                  <input type="checkbox" checked={pdfBookmarkOnly} onChange={e => setPdfBookmarkOnly(e.target.checked)} />
                  只导出收藏（★）
                </label>
              </>
            )}

            {pdfMode === 'manual' && (
              <>
                <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                  <p className="text-sm text-gray-600">📄 已选 <span className="font-semibold">{pdfPicked.size}</span> / {notes.length} 条</p>
                  <div className="flex gap-2">
                    <button onClick={() => setPdfPicked(prev => new Set([...prev, ...pickList.map(n => n.id)]))} className="text-xs text-indigo-500 hover:text-indigo-700">全选当前</button>
                    <button onClick={() => setPdfPicked(new Set())} className="text-xs text-gray-400 hover:text-gray-600">清空</button>
                  </div>
                </div>
                <div className="relative mb-2">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
                  <input value={pdfSearch} onChange={e => setPdfSearch(e.target.value)}
                    placeholder={`搜索笔记标题/内容（共 ${notes.length} 条）…`}
                    className="w-full border border-gray-200 rounded-lg pl-8 pr-8 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  {pdfSearch && <button onClick={() => setPdfSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">×</button>}
                </div>
                <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-xl divide-y mb-2">
                  {pickList.length === 0 ? (
                    <p className="text-sm text-gray-400 italic p-3 text-center">没有匹配的笔记</p>
                  ) : visiblePickList.map(n => (
                    <label key={n.id} className="flex items-start gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                      <input type="checkbox" checked={pdfPicked.has(n.id)} onChange={() => togglePicked(n.id)} className="mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-700 break-words">{n.bookmarked && '★ '}{n.title}</p>
                        <p className="text-xs text-gray-400 line-clamp-1">{(n.content || '').slice(0, 80)}…</p>
                        {n.tags?.length > 0 && <div className="flex flex-wrap gap-1 mt-1">{n.tags.map(t => <span key={t} className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">{t}</span>)}</div>}
                      </div>
                    </label>
                  ))}
                </div>
                {collapsePickList && (
                  <p className="text-xs text-gray-400 mb-2">显示前 {COLLAPSED_LIMIT} 条（按更新时间倒序，已选优先）。<span className="text-indigo-500">输入搜索词</span>可看更多。</p>
                )}
              </>
            )}

            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 mb-3">
              <input type="checkbox" checked={pdfIncludeImages} onChange={e => setPdfIncludeImages(e.target.checked)} />
              包含图片（生成 PDF 会更大）
            </label>
            <p className="text-xs text-gray-400 mb-3">PDF 会包含笔记标题、标签和 Markdown 渲染后的正文。{pdfIncludeImages && '图片会先预取为 data URL 后嵌入；获取失败的会自动跳过。'}首次导出会从 CDN 加载 PDF 库（约 1-2 秒）。</p>
            <div className="flex justify-end gap-2 items-center">
              <button onClick={() => diagnosticCapture('notes-pdf-content')} className="text-xs text-gray-400 hover:text-indigo-600 mr-auto" disabled={pdfLoading} title="点了「下载 PDF」但内容是空白？点这个看截图">🔍 诊断截图</button>
              <Btn variant="secondary" onClick={() => setPdfModal(false)} disabled={pdfLoading}>取消</Btn>
              <Btn onClick={doExport} disabled={pdfLoading || filtered.length === 0}>{pdfLoading ? '导出中…' : `📄 下载 PDF (${filtered.length})`}</Btn>
            </div>
          </Modal>
        );
      })()}
      {pdfModal && (() => {
        const filtered = pdfMode === 'manual'
          ? notes.filter(n => pdfPicked.has(n.id))
          : notes.filter(n => {
              if (pdfBookmarkOnly && !n.bookmarked) return false;
              if (pdfTags.size > 0 && !n.tags?.some(t => pdfTags.has(t))) return false;
              return true;
            });
        return (
          // 包裹层 0 高 + overflow:hidden 在视觉上隐藏，但子元素仍有完整 layout
          // 不用 position:fixed/absolute；保持子元素在文档流里，html-to-image 截图最稳
          <div style={{ height: 0, overflow: 'hidden' }} aria-hidden="true">
            <div id="notes-pdf-content" className="pdf-page">
            <h1>📝 日语笔记导出</h1>
            <div className="pdf-meta">共 {filtered.length} 条 · 导出于 {pdfDateStr()}</div>
            {filtered.map(n => (
              <div key={n.id} className="pdf-item">
                <h2>{n.title}</h2>
                {n.tags?.length > 0 && (
                  <div className="pdf-tags">
                    {n.tags.map(t => <span key={t} className="pdf-tag">#{t}</span>)}
                  </div>
                )}
                <div className="md-body" dangerouslySetInnerHTML={{ __html: window.marked ? marked.parse(n.content || '') : (n.content || '') }} />
                {pdfIncludeImages && n.images?.filter(i => i.type === 'image' && pdfImageMap[i.url]).map(img => (
                  <img key={img.path} src={pdfImageMap[img.url]} alt={img.name} className="pdf-img" />
                ))}
              </div>
            ))}
            </div>
          </div>
        );
      })()}
      {pdfToast && <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-xl shadow-lg z-50 text-sm">{pdfToast}</div>}
    </div>
  );
};
