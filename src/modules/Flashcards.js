// ─── FLASHCARDS ───────────────────────────────────────────────────────────────
const INTERVALS = { 1: 1, 2: 3, 3: 7, 4: 14 };

const Flashcards = ({ cards, setCards, allTags, onNav, notes = [], navCtx, clearNavCtx }) => {
  const [view, setView] = useState('list'); // list | review | form
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ front: '', back: '', tags: [] });
  const [filterMode, setFilterMode] = useState('due');
  const [activeTag, setActiveTag] = useState(null);

  useEffect(() => {
    if (navCtx?.tag) {
      setActiveTag(navCtx.tag);
      setView('list');
      setFilterMode('all');
      clearNavCtx?.();
    }
  }, [navCtx]);
  const [search, setSearch] = useState('');
  const [cardsVisible, setCardsVisible] = useState(100);
  const cardsSentinel = useRef(null);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [noteIdx, setNoteIdx] = useState(0);
  const [sessionCards, setSessionCards] = useState([]);
  const ttsAudioRef = useRef(null);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsError, setTtsError] = useState('');
  const stopTTS = () => { if (ttsAudioRef.current) { ttsAudioRef.current.pause(); ttsAudioRef.current = null; } };
  const speakCurrent = async () => {
    const c = sessionCards[idx];
    if (!c) return;
    const text = flipped ? c.back : c.front;
    if (!text || !text.trim()) return;
    stopTTS();
    setTtsError('');
    setTtsLoading(true);
    try {
      const audio = await playJapaneseTTS(text);
      ttsAudioRef.current = audio;
      audio.onended = () => { if (ttsAudioRef.current === audio) ttsAudioRef.current = null; };
    } catch (e) {
      setTtsError(e.message || '朗读失败');
      setTimeout(() => setTtsError(''), 3000);
    } finally {
      setTtsLoading(false);
    }
  };
  useEffect(() => () => stopTTS(), []);
  const dueCards = useMemo(() => cards.filter(c => !c.completed && (!c.nextReview || new Date(c.nextReview) <= new Date())), [cards]);
  const reviewList = useMemo(() => {
    let base;
    if (filterMode === 'due') base = dueCards;
    else if (filterMode === 'completed') base = cards.filter(c => c.completed);
    else if (filterMode === 'all') base = cards;
    else base = cards.filter(c => !c.completed);
    return activeTag === '__no_tag__'
      ? base.filter(c => !c.tags?.length)
      : activeTag
        ? base.filter(c => c.tags?.includes(activeTag))
        : base;
  }, [filterMode, dueCards, cards, activeTag]);

  useEffect(() => { setCardsVisible(100); }, [filterMode, activeTag, search]);
  useEffect(() => {
    if (!cardsSentinel.current) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setCardsVisible(v => v + 100); }, { threshold: 0 });
    obs.observe(cardsSentinel.current);
    return () => obs.disconnect();
  }, [cardsVisible]);

  const relatedNotes = useMemo(() => {
    if (!flipped || !sessionCards[idx]) return [];
    const cardTags = new Set(sessionCards[idx].tags || []);
    if (cardTags.size === 0) return [];
    return notes.filter(n => n.tags?.some(t => cardTags.has(t)));
  }, [flipped, idx, sessionCards, notes]);

  useEffect(() => {
    if (view !== 'review' || !onNav) return;
    const onKey = e => { if (e.key === 'n' || e.key === 'N') onNav('knowledge'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, onNav]);

  const startReview = () => { setIdx(0); setFlipped(false); setSessionCards(reviewList); setView('review'); };
  const openNew = () => { setForm({ front: '', back: '', tags: [] }); setEditId(null); setView('form'); };
  const openEdit = c => { setForm({...c}); setEditId(c.id); setView('form'); };

  const save = () => {
    if (!form.front.trim() || !form.back.trim()) return;
    if (editId) setCards(p => p.map(c => c.id === editId ? {...c, ...form} : c));
    else setCards(p => [...p, { ...form, id: genId(), createdAt: new Date().toISOString() }]);
    setView('list');
  };

  const markComplete = () => {
    stopTTS();
    setCards(p => p.map(c => c.id === sessionCards[idx].id ? { ...c, completed: true, nextReview: null, lastReviewed: new Date().toISOString() } : c));
    if (idx < sessionCards.length - 1) { setIdx(i => i+1); setFlipped(false); setNoteIdx(0); }
    else setView('list');
  };

  const toggleComplete = id => {
    setCards(p => p.map(c => c.id === id ? { ...c, completed: !c.completed, nextReview: null } : c));
  };

  const rate = q => {
    if (q === 4 && sessionCards[idx].difficulty === 4) { markComplete(); return; }
    stopTTS();
    const next = new Date(); next.setDate(next.getDate() + INTERVALS[q]);
    setCards(p => p.map(c => c.id === sessionCards[idx].id ? { ...c, nextReview: next.toISOString(), lastReviewed: new Date().toISOString(), reviewCount: (c.reviewCount||0)+1, difficulty: q } : c));
    if (idx < sessionCards.length - 1) { setIdx(i => i+1); setFlipped(false); setNoteIdx(0); }
    else setView('list');
  };

  const del = id => { if (confirm('删除此闪卡？')) setCards(p => p.filter(c => c.id !== id)); };

  const { exportForClaude, applyDeleteList, restoreBackup, hasBackup, setHasBackup, exportToast, deleteModal, setDeleteModal, deleteJson, setDeleteJson, exportModal, setExportModal, exportPromptText, copyPrompt, downloadJson, selectedTags, toggleTag, clearTags, availableTags, filteredCount, totalCount, promptList, selectedPromptIdx, setSelectedPromptIdx } = useClaudeExport({
    items: cards,
    mapExport: items => ({ flashcards: items.map(({ front, back, tags }) => ({ front, back, tags })) }),
    filename: 'flashcards-export',
    claudePrompts: [
      { label: '🔍 查找重复', build: json => `请帮我检查以下日语闪卡，找出完全重复或高度相似的卡片（正面内容相同，或意思完全一样）。\n\n只返回以下格式的 JSON，不要包含任何其他文字或解释：\n{"delete_duplicates": ["重复卡片的front值1", "重复卡片的front值2"]}\n\n如果没有重复，返回 {"delete_duplicates": []}。每组重复中保留最好的一张，只列出应删除的那些。\n\n闪卡数据如下：\n\n${json}` },
      { label: '✨ 添加例句和读音', build: json => `请帮我给以下日语闪卡补充内容：在每张卡的 back 字段末尾追加 1 个简短例句（日中对照）+ 出现的汉字读音。保持 front 和 tags 不变，back 原内容保留，只在末尾追加。\n\n例句格式：\\n\\n例：日语例句。中文翻译。\\n汉字 - 读音\n\n只返回完整的 JSON（包含所有卡，未改动的也要原样返回），格式与输入相同：\n{"flashcards": [{"front":"...","back":"...","tags":[...]}]}\n\n闪卡数据：\n\n${json}` },
      { label: '✏️ 自由修改 back', build: json => `请帮我审阅并改进以下日语闪卡的 back 字段（释义、解释、用法说明）。保持 front 和 tags 不变。返回完整 JSON（包含所有卡），与输入格式相同：\n{"flashcards": [{"front":"...","back":"...","tags":[...]}]}\n\n闪卡数据：\n\n${json}` },
    ],
    matchKey: 'front',
    itemLabel: '闪卡',
    setItems: setCards,
  });

  const READING_RE = /[（(][぀-ゟ]+[）)]/g;
  const normalizeFront = f => f.replace(READING_RE, '').trim();

  const [moveReadingsModal, setMoveReadingsModal] = useState(false);
  const [moveReadingsPreview, setMoveReadingsPreview] = useState([]);
  const [mergeModal, setMergeModal] = useState(false);
  const [mergeGroups, setMergeGroups] = useState([]);
  const [maintToast, setMaintToast] = useState('');
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);
  // PDF 导出
  const [pdfModal, setPdfModal] = useState(false);
  const [pdfTags, setPdfTags] = useState(() => new Set());
  const [pdfMode, setPdfMode] = useState('study'); // 'study' | 'quiz'
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfToast, setPdfToast] = useState('');

  useEffect(() => {
    if (!moreMenuOpen) return;
    const handler = (e) => { if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) setMoreMenuOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setMoreMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', esc); };
  }, [moreMenuOpen]);

  const duplicateGroupCount = useMemo(() => {
    const seen = new Map();
    for (const card of cards) {
      const key = normalizeFront(card.front);
      if (!key) continue;
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    return [...seen.values()].filter(n => n >= 2).length;
  }, [cards]);

  const openMoveReadingsPreview = () => {
    const preview = [];
    for (const card of cards) {
      const matches = card.front.match(READING_RE);
      if (!matches) continue;
      const newFront = card.front.replace(READING_RE, '').trim();
      if (!newFront) continue;
      const readingStr = matches.join('');
      preview.push({ id: card.id, oldFront: card.front, newFront, newBack: readingStr + '\n' + card.back });
    }
    setMoveReadingsPreview(preview);
    setMoveReadingsModal(true);
  };

  const applyMoveReadings = () => {
    if (!moveReadingsPreview.length) return;
    localStorage.setItem('backup_flashcards-export', JSON.stringify(cards));
    setHasBackup(true);
    const map = new Map(moveReadingsPreview.map(p => [p.id, p]));
    setCards(prev => prev.map(c => { const p = map.get(c.id); return p ? { ...c, front: p.newFront, back: p.newBack } : c; }));
    setMoveReadingsModal(false);
    setMoveReadingsPreview([]);
    setMaintToast(`✅ 已整理 ${map.size} 张闪卡的读音`);
    setTimeout(() => setMaintToast(''), 3000);
  };

  const openMergeDuplicates = () => {
    const groups = new Map();
    for (const card of cards) {
      const key = normalizeFront(card.front);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(card);
    }
    const dupes = [...groups.entries()]
      .filter(([, g]) => g.length >= 2)
      .map(([key, cards]) => ({ key, cards }))
      .sort((a, b) => b.cards.length - a.cards.length);
    setMergeGroups(dupes);
    setMergeModal(true);
  };

  const mergeGroup = (key, keepId) => {
    const group = mergeGroups.find(g => g.key === key);
    if (!group) return;
    const keepCard = group.cards.find(c => c.id === keepId);
    const others = group.cards.filter(c => c.id !== keepId);
    localStorage.setItem('backup_flashcards-export', JSON.stringify(cards));
    setHasBackup(true);
    const mergedBack = [keepCard.back, ...others.map(c => c.back)].filter(Boolean).join('\n---\n');
    const deleteIds = new Set(others.map(c => c.id));
    setCards(prev => prev.filter(c => !deleteIds.has(c.id)).map(c => c.id === keepId ? { ...c, back: mergedBack } : c));
    setMergeGroups(prev => prev.filter(g => g.key !== key));
  };

  const deleteFromGroup = (key, deleteId) => {
    localStorage.setItem('backup_flashcards-export', JSON.stringify(cards));
    setHasBackup(true);
    setCards(prev => prev.filter(c => c.id !== deleteId));
    setMergeGroups(prev => prev
      .map(g => g.key === key ? { ...g, cards: g.cards.filter(c => c.id !== deleteId) } : g)
      .filter(g => g.cards.length >= 2)
    );
  };

  const removeFromGroup = (key, cardId) => {
    setMergeGroups(prev => prev
      .map(g => g.key === key ? { ...g, cards: g.cards.filter(c => c.id !== cardId) } : g)
      .filter(g => g.cards.length >= 2)
    );
  };

  if (view === 'review' && sessionCards.length > 0) {
    const card = sessionCards[idx] || sessionCards[0];
    return (
      <div className="max-w-lg mx-auto">
        <div className="flex justify-between items-center mb-3">
          <Btn variant="ghost" onClick={() => { stopTTS(); setView('list'); }}>← 返回</Btn>
          <div className="text-right">
            {activeTag && <p className="text-xs text-indigo-500 mb-0.5">#{activeTag}</p>}
            <span className="text-sm text-gray-400">{idx + 1} / {sessionCards.length}</span>
          </div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-6">
          <div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${(idx / sessionCards.length) * 100}%` }} />
        </div>
        <div className="card-flip mb-6" style={{minHeight: '200px'}}>
          <div className={`card-flip-inner relative w-full`} style={{minHeight: '200px'}}>
            <div className="relative bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center flex flex-col items-center justify-center cursor-pointer min-h-52 hover:shadow-xl transition-shadow" onClick={() => { stopTTS(); setFlipped(f => !f); }} style={{minHeight: '200px'}}>
              <button
                onClick={e => { e.stopPropagation(); speakCurrent(); }}
                disabled={ttsLoading}
                title="朗读（Google TTS）"
                aria-label="朗读"
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-gray-100 hover:bg-indigo-100 text-gray-500 hover:text-indigo-600 flex items-center justify-center transition-colors disabled:opacity-50">
                {ttsLoading ? '⏳' : '🔊'}
              </button>
              <p className="text-xs text-gray-300 mb-4 uppercase tracking-widest">{flipped ? '答案' : '点击翻转查看答案'}</p>
              <div
                className="md-body md-body-card w-full"
                style={{fontFamily:"'Noto Sans JP', 'Segoe UI', system-ui, sans-serif"}}
                dangerouslySetInnerHTML={{ __html: window.marked
                  ? marked.parse(String(flipped ? card.back : card.front) || '')
                  : String(flipped ? card.back : card.front) }}
              />
              {card.tags?.length > 0 && <div className="flex flex-wrap gap-1 mt-4 justify-center">{card.tags.map(t => <Badge key={t}>{t}</Badge>)}</div>}
              {ttsError && <p className="absolute bottom-2 left-0 right-0 text-xs text-red-500">{ttsError}</p>}
            </div>
          </div>
        </div>
        {flipped && (
          <>
            <div className="grid grid-cols-4 gap-2">
              {[{q:1,l:'再来',c:'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200'},{q:2,l:'困难',c:'bg-orange-100 text-orange-700 hover:bg-orange-200 border border-orange-200'},{q:3,l:'良好',c:'bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200'},{q:4,l:'简单',c:'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200'}].map(({q,l,c}) => (
                <button key={q} onClick={() => rate(q)} className={`rounded-xl py-3 font-semibold text-sm transition-colors ${c}`}>{l}</button>
              ))}
            </div>
            <button onClick={markComplete} className="w-full mt-2 rounded-xl py-2.5 font-semibold text-sm transition-colors bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200">✓ 已完成（不再复习）</button>
          </>
        )}
        <p className="text-center text-xs text-gray-300 mt-4">再来=1天 · 困难=3天 · 良好=7天 · 简单=14天</p>
        {relatedNotes.length > 0 && (
          <div className="mt-4 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">
                相关笔记 {relatedNotes.length > 1 && `(${noteIdx + 1}/${relatedNotes.length})`}
              </p>
              {relatedNotes.length > 1 && (
                <div className="flex gap-1">
                  <button onClick={() => setNoteIdx(i => Math.max(0, i - 1))}
                    disabled={noteIdx === 0}
                    className="px-2 py-0.5 text-xs rounded bg-white border border-indigo-200 text-indigo-600 disabled:opacity-30">‹</button>
                  <button onClick={() => setNoteIdx(i => Math.min(relatedNotes.length - 1, i + 1))}
                    disabled={noteIdx === relatedNotes.length - 1}
                    className="px-2 py-0.5 text-xs rounded bg-white border border-indigo-200 text-indigo-600 disabled:opacity-30">›</button>
                </div>
              )}
            </div>
            <p
              className="text-sm font-medium text-gray-800 mb-1 cursor-pointer hover:text-indigo-600 transition-colors"
              onClick={() => onNav && onNav('knowledge', { openNoteId: relatedNotes[noteIdx].id })}
              title="点击查看笔记">
              {relatedNotes[noteIdx].title} →
            </p>
            <div className="md-body"
              dangerouslySetInnerHTML={{ __html: window.marked ? marked.parse(relatedNotes[noteIdx].content || '') : relatedNotes[noteIdx].content }} />
            {relatedNotes[noteIdx].tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {relatedNotes[noteIdx].tags.map(t => <Badge key={t}>{t}</Badge>)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (view === 'form') {
    return (
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <Btn variant="ghost" onClick={() => setView('list')}>← 返回</Btn>
          <h1 className="text-lg font-bold">{editId ? '编辑闪卡' : '新建闪卡'}</h1>
        </div>
        <Card>
          <Textarea label="正面（日语 / 问题）" value={form.front} onChange={e => setForm(p => ({...p, front: e.target.value}))} placeholder="例：おはようございます" rows={3} />
          <Textarea label="背面（答案 / 解释）" value={form.back} onChange={e => setForm(p => ({...p, back: e.target.value}))} placeholder="例：早上好（正式用语）" rows={3} />
          <TagSelector selected={form.tags} onChange={tags => setForm(p => ({...p, tags}))} pool={allTags} />
          <div className="flex justify-end gap-2"><Btn variant="secondary" onClick={() => setView('list')}>取消</Btn><Btn onClick={save}>保存</Btn></div>
        </Card>
      </div>
    );
  }

  return (
    <>
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">🃏 闪卡复习</h1>
        <div className="flex gap-2">
          {cards.length > 0 && <Btn variant="danger" onClick={() => { if (confirm(`删除全部 ${cards.length} 张闪卡？此操作不可恢复。`)) setCards([]); }}>🗑 全部删除</Btn>}
          {cards.length > 0 && (
            <div className="relative" ref={moreMenuRef}>
              <Btn variant="secondary" onClick={() => setMoreMenuOpen(o => !o)}>
                更多 ▾{duplicateGroupCount > 0 && <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 align-middle">{duplicateGroupCount}</span>}
              </Btn>
              {moreMenuOpen && (
                <div className="absolute top-full right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 z-20 overflow-hidden min-w-[160px]">
                  <div onClick={() => { setMoreMenuOpen(false); openMergeDuplicates(); }} className="px-3 py-2 text-sm hover:bg-indigo-50 cursor-pointer flex justify-between items-center gap-2">
                    <span>🔀 合并重复</span>
                    {duplicateGroupCount > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{duplicateGroupCount}</span>}
                  </div>
                  <div onClick={() => { setMoreMenuOpen(false); setDeleteModal(true); }} className="px-3 py-2 text-sm hover:bg-indigo-50 cursor-pointer">🗑 删除重复</div>
                  <div onClick={() => { setMoreMenuOpen(false); openMoveReadingsPreview(); }} className="px-3 py-2 text-sm hover:bg-indigo-50 cursor-pointer">📖 整理读音</div>
                  <div onClick={() => { setMoreMenuOpen(false); exportForClaude(); }} className="px-3 py-2 text-sm hover:bg-indigo-50 cursor-pointer">导出给 Claude</div>
                  <div onClick={() => { setMoreMenuOpen(false); setPdfTags(new Set()); setPdfMode('study'); setPdfModal(true); }} className="px-3 py-2 text-sm hover:bg-indigo-50 cursor-pointer">📄 导出 PDF</div>
                </div>
              )}
            </div>
          )}
          <Btn variant="secondary" onClick={openNew}>+ 新建</Btn>
          {cards.length > 0 && <Btn onClick={startReview}>开始复习 {dueCards.length > 0 && `(${dueCards.length} 到期)`}</Btn>}
        </div>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索闪卡正面或背面..."
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-300" />

      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
        {[['due',`今日待复习 (${dueCards.length})`],['active',`学习中 (${cards.filter(c=>!c.completed).length})`],['completed',`已完成 (${cards.filter(c=>c.completed).length})`],['all',`全部 (${cards.length})`]].map(([k,l]) => (
          <button key={k} onClick={() => { setFilterMode(k); setActiveTag(null); setSearch(''); }} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterMode===k?'bg-white shadow text-gray-800':'text-gray-400 hover:text-gray-600'}`}>{l}</button>
        ))}
      </div>

      {(() => {
        let baseList;
        if (filterMode === 'due') baseList = dueCards;
        else if (filterMode === 'completed') baseList = cards.filter(c => c.completed);
        else if (filterMode === 'all') baseList = cards;
        else baseList = cards.filter(c => !c.completed);
        const searchFiltered = search ? baseList.filter(c => { const q = search.toLowerCase(); return c.front?.toLowerCase().includes(q) || c.back?.toLowerCase().includes(q); }) : baseList;
        const tagCounts = {};
        searchFiltered.forEach(c => c.tags?.forEach(t => tagCounts[t] = (tagCounts[t]||0)+1));
        const noTagCount = searchFiltered.filter(c => !c.tags?.length).length;
        const displayList = activeTag === '__no_tag__'
          ? searchFiltered.filter(c => !c.tags?.length)
          : activeTag
            ? searchFiltered.filter(c => c.tags?.includes(activeTag))
            : searchFiltered;
        return <>
          <CollapsibleTagFilter tagCounts={tagCounts} total={searchFiltered.length} activeTag={activeTag} setActiveTag={setActiveTag} noTagCount={noTagCount} />
          {displayList.length === 0 ? (
            <Card className="text-center py-16">
              <p className="text-4xl mb-3">{filterMode==='due'?'🎉':'🃏'}</p>
              <p className="text-gray-400">{search ? `没有匹配「${search}」的闪卡` : activeTag === '__no_tag__' ? '没有无标签的闪卡' : activeTag ? `没有含「${activeTag}」标签的闪卡` : filterMode==='due'?'今天没有需要复习的闪卡！':filterMode==='completed'?'还没有已完成的闪卡':'还没有闪卡'}</p>
              <Btn onClick={openNew} className="mt-4">创建第一张闪卡</Btn>
            </Card>
          ) : (
            <div className="grid md:grid-cols-3 gap-3">
              {displayList.slice(0, cardsVisible).map((c, i) => (
                <React.Fragment key={c.id}>
                  <Card>
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-semibold text-gray-800 flex-1 pr-2 whitespace-pre-wrap break-words">{c.front}</p>
                      <div className="flex gap-1 shrink-0">
                        {!c.completed && <button onClick={() => openEdit(c)} className="text-gray-200 hover:text-blue-400 text-sm">✏️</button>}
                        <button onClick={() => del(c.id)} className="text-gray-200 hover:text-red-400 text-sm">🗑</button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 border-t pt-2 whitespace-pre-wrap break-words">{c.back}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {c.completed && <Badge color="bg-emerald-100 text-emerald-700">✓ 已完成</Badge>}
                      {c.tags?.map(t => <Badge key={t}>{t}</Badge>)}
                    </div>
                    {c.completed
                      ? <button onClick={() => toggleComplete(c.id)} className="text-xs text-gray-300 hover:text-indigo-400 mt-2 transition-colors">↩ 恢复复习</button>
                      : c.nextReview && <p className="text-xs text-gray-300 mt-2">下次复习：{fmt(c.nextReview)}</p>
                    }
                  </Card>
                  {i === Math.floor(cardsVisible * 0.7) - 1 && (
                    <div ref={cardsSentinel} style={{gridColumn:'1/-1',height:0}} />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </>;
      })()}
    </div>
    {deleteModal && (
      <Modal open={true} title="删除重复闪卡" onClose={() => { setDeleteModal(false); setDeleteJson(''); }}>
        <p className="text-sm text-gray-500 mb-2">将 Claude 返回的 JSON 粘贴到此处：</p>
        <textarea className="w-full border rounded-lg p-2 text-sm font-mono h-40"
          placeholder='{"delete_duplicates": ["front1", "front2"]}'
          value={deleteJson} onChange={e => setDeleteJson(e.target.value)} />
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
          <p className="text-sm text-gray-600 mb-2">📤 将导出 <span className="font-semibold">{filteredCount}</span> / {totalCount} 张闪卡{selectedTags.size === 0 && '（全部）'}</p>
          {availableTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <Badge onClick={clearTags} color={selectedTags.size === 0 ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}>全部</Badge>
              {availableTags.map(([tag, cnt]) => (
                <Badge key={tag} onClick={() => toggleTag(tag)} color={selectedTags.has(tag) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}>{tag} ({cnt})</Badge>
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
    {exportToast && <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-xl shadow-lg z-50 text-sm">{exportToast}</div>}
    {maintToast && <div className="fixed bottom-14 right-4 bg-green-600 text-white px-4 py-2 rounded-xl shadow-lg z-50 text-sm">{maintToast}</div>}
    {moveReadingsModal && (
      <Modal open={true} title="整理读音 — 预览" onClose={() => { setMoveReadingsModal(false); setMoveReadingsPreview([]); }} wide>
        {moveReadingsPreview.length === 0 ? (
          <p className="text-sm text-gray-500">没有找到含有假名读音的闪卡正面。</p>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-3">将对 <strong>{moveReadingsPreview.length}</strong> 张闪卡进行整理：把正面的假名读音移至背面开头。</p>
            <div className="max-h-72 overflow-y-auto border rounded-lg divide-y text-xs font-mono mb-4">
              {moveReadingsPreview.slice(0, 20).map(p => (
                <div key={p.id} className="px-3 py-2 space-y-1">
                  <div><span className="text-red-400 line-through mr-2">{p.oldFront}</span><span className="text-green-600">→ {p.newFront}</span></div>
                  <div className="text-gray-400">背面新增：<span className="text-indigo-500">{p.newBack.split('\n')[0]}</span></div>
                </div>
              ))}
              {moveReadingsPreview.length > 20 && <p className="px-3 py-2 text-gray-400">…以及另外 {moveReadingsPreview.length - 20} 张</p>}
            </div>
            <p className="text-xs text-amber-600 mb-3">⚠️ 操作前将自动备份。可通过「删除重复」面板的「恢复备份」撤销。</p>
            <div className="flex justify-end gap-2">
              <Btn variant="secondary" onClick={() => { setMoveReadingsModal(false); setMoveReadingsPreview([]); }}>取消</Btn>
              <Btn onClick={applyMoveReadings}>确认整理 {moveReadingsPreview.length} 张</Btn>
            </div>
          </>
        )}
      </Modal>
    )}
    {mergeModal && (
      <Modal open={true} title={`合并相似闪卡 — ${mergeGroups.length} 组重复`} onClose={() => setMergeModal(false)} wide>
        {mergeGroups.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-2xl mb-2">🎉</p>
            <p className="text-sm text-gray-500">没有找到重复的闪卡（正面归一化后均不同）。</p>
            <div className="mt-4"><Btn variant="secondary" onClick={() => setMergeModal(false)}>关闭</Btn></div>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-1">共 {mergeGroups.length} 组（正面去除假名读音后相同）。「合并保留」保留该卡并合并所有背面；「删除」永久删除该卡；「移出此组」把该卡移出组但不删除，适合不想合并的情况。</p>
            <p className="text-xs text-amber-600 mb-3">⚠️ 每次操作前自动备份，可通过「删除重复」→「恢复备份」撤销。</p>
            <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
              {mergeGroups.map(group => (
                <div key={group.key} className="border border-gray-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-500 mb-2">归一化正面：<span className="text-indigo-600 font-normal">{group.key}</span><span className="ml-2 text-gray-300">({group.cards.length} 张)</span></p>
                  <div className="space-y-2">
                    {group.cards.map(card => (
                      <div key={card.id} className="flex gap-2 items-start bg-gray-50 rounded-lg px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{card.front}</p>
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{card.back}</p>
                          {card.tags?.length > 0 && <div className="flex flex-wrap gap-1 mt-1">{card.tags.map(t => <span key={t} className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded text-xs">{t}</span>)}</div>}
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <Btn variant="success" onClick={() => mergeGroup(group.key, card.id)}>合并保留</Btn>
                          <Btn variant="danger" onClick={() => deleteFromGroup(group.key, card.id)}>删除</Btn>
                          <button className="text-xs text-gray-400 hover:text-gray-600 underline text-center" onClick={() => removeFromGroup(group.key, card.id)}>移出此组</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4"><Btn variant="secondary" onClick={() => setMergeModal(false)}>完成</Btn></div>
          </>
        )}
      </Modal>
    )}
    {pdfModal && (() => {
      const tagCounts = {};
      cards.forEach(c => c.tags?.forEach(t => tagCounts[t] = (tagCounts[t]||0)+1));
      const tagOptions = Object.entries(tagCounts).sort((a,b) => b[1]-a[1]);
      const filtered = cards.filter(c => {
        if (pdfTags.size > 0 && !c.tags?.some(t => pdfTags.has(t))) return false;
        return true;
      });
      const togglePdfTag = (tag) => setPdfTags(prev => { const next = new Set(prev); if (next.has(tag)) next.delete(tag); else next.add(tag); return next; });
      const doExport = async () => {
        if (filtered.length === 0) return;
        setPdfLoading(true);
        try {
          await new Promise(r => setTimeout(r, 50));
          const fname = `japanese-flashcards-${pdfMode}-${pdfDateStr()}`;
          if (pdfMode === 'quiz') {
            // 题目和答案分两次截图，答案真正从新页开始
            await exportElementsToPDF(['cards-pdf-questions', 'cards-pdf-answers'], fname);
          } else {
            await exportElementToPDF('cards-pdf-content', fname);
          }
          setPdfToast(`✅ 已导出 ${filtered.length} 张闪卡为 PDF`);
          setTimeout(() => setPdfToast(''), 3000);
          setPdfModal(false);
        } catch (e) {
          alert('PDF 导出失败：' + e.message);
        } finally {
          setPdfLoading(false);
        }
      };
      return (
        <Modal open={true} title="导出闪卡 PDF" onClose={() => !pdfLoading && setPdfModal(false)}>
          <p className="text-sm text-gray-600 mb-2">📄 将导出 <span className="font-semibold">{filtered.length}</span> / {cards.length} 张闪卡{pdfTags.size === 0 && '（全部）'}</p>
          {tagOptions.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-1.5">按标签筛选（不选 = 全部）</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge onClick={() => setPdfTags(new Set())} color={pdfTags.size === 0 ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}>全部</Badge>
                {tagOptions.map(([tag, cnt]) => (
                  <Badge key={tag} onClick={() => togglePdfTag(tag)} color={pdfTags.has(tag) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}>{tag} ({cnt})</Badge>
                ))}
              </div>
            </div>
          )}
          <div className="mb-3">
            <p className="text-xs text-gray-400 mb-1.5">布局</p>
            <div className="space-y-1.5">
              <label className="flex items-start gap-2 cursor-pointer text-sm text-gray-700">
                <input type="radio" value="study" checked={pdfMode === 'study'} onChange={() => setPdfMode('study')} className="mt-0.5" />
                <span><span className="font-medium">学习模式</span><span className="text-xs text-gray-400 block">2 列网格，每张卡同时显示正面 + 背面</span></span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer text-sm text-gray-700">
                <input type="radio" value="quiz" checked={pdfMode === 'quiz'} onChange={() => setPdfMode('quiz')} className="mt-0.5" />
                <span><span className="font-medium">测试模式</span><span className="text-xs text-gray-400 block">先列出所有正面（题目），分页后列出所有背面（答案）</span></span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" onClick={() => setPdfModal(false)} disabled={pdfLoading}>取消</Btn>
            <Btn onClick={doExport} disabled={pdfLoading || filtered.length === 0}>{pdfLoading ? '导出中…' : `📄 下载 PDF (${filtered.length})`}</Btn>
          </div>
        </Modal>
      );
    })()}
    {pdfModal && (() => {
      const filtered = cards.filter(c => {
        if (pdfTags.size > 0 && !c.tags?.some(t => pdfTags.has(t))) return false;
        return true;
      });
      const offScreen = { position: 'fixed', left: '-10000px', top: 0 };
      if (pdfMode === 'study') {
        return (
          <div id="cards-pdf-content" className="pdf-page" style={offScreen}>
            <h1>🃏 日语闪卡导出 — 学习模式</h1>
            <div className="pdf-meta">共 {filtered.length} 张 · 导出于 {pdfDateStr()}</div>
            <div className="pdf-cards-grid">
              {filtered.map((c, i) => (
                <div key={c.id} className="pdf-card">
                  <div className="pdf-card-num">#{i + 1}{c.tags?.length > 0 && ` · ${c.tags.join(' / ')}`}</div>
                  <div className="pdf-card-front">{c.front}</div>
                  <div className="pdf-card-back">{c.back}</div>
                </div>
              ))}
            </div>
          </div>
        );
      }
      return (
        <>
          <div id="cards-pdf-questions" className="pdf-page" style={offScreen}>
            <h1>🃏 日语闪卡导出 — 测试模式（题目）</h1>
            <div className="pdf-meta">共 {filtered.length} 题 · 导出于 {pdfDateStr()}</div>
            <ol className="pdf-quiz-list">
              {filtered.map((c, i) => (
                <li key={'q-'+c.id}><span className="pdf-card-num">{i + 1}.</span> <span style={{whiteSpace:'pre-wrap'}}>{c.front}</span></li>
              ))}
            </ol>
          </div>
          <div id="cards-pdf-answers" className="pdf-page" style={offScreen}>
            <h1>✅ 答案</h1>
            <div className="pdf-meta">共 {filtered.length} 题 · 导出于 {pdfDateStr()}</div>
            <ol className="pdf-quiz-list">
              {filtered.map((c, i) => (
                <li key={'a-'+c.id}>
                  <span className="pdf-card-num">{i + 1}.</span> <span style={{whiteSpace:'pre-wrap'}}>{c.front}</span>
                  <div style={{marginTop:4, color:'#4b5563', whiteSpace:'pre-wrap'}}>→ {c.back}</div>
                </li>
              ))}
            </ol>
          </div>
        </>
      );
    })()}
    {pdfToast && <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-xl shadow-lg z-50 text-sm">{pdfToast}</div>}
    </>
  );
};
