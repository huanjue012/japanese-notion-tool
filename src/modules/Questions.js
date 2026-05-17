// ─── QUESTIONS / 薄弱点 ─────────────────────────────────────────────────────
const QuestionsView = ({ questions, setQuestions }) => {
  const [quick, setQuick] = useState('');
  const [modal, setModal] = useState(null); // question being edited (or 'new')
  const [form, setForm] = useState({ title: '', content: '', answer: '', tags: [], status: 'open' });
  const [activeTag, setActiveTag] = useState(null);
  const [showResolved, setShowResolved] = useState(false);

  const allTags = useMemo(() => {
    const s = new Set();
    questions.forEach(q => q.tags?.forEach(t => s.add(t)));
    return Array.from(s);
  }, [questions]);

  const tagCounts = useMemo(() => {
    const c = {};
    questions.forEach(q => q.tags?.forEach(t => { c[t] = (c[t] || 0) + 1; }));
    return c;
  }, [questions]);

  const filtered = activeTag ? questions.filter(q => q.tags?.includes(activeTag)) : questions;
  const open = filtered.filter(q => q.status !== 'resolved').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const resolved = filtered.filter(q => q.status === 'resolved').sort((a, b) => new Date(b.resolvedAt || 0) - new Date(a.resolvedAt || 0));

  const quickAdd = () => {
    if (!quick.trim()) return;
    setQuestions(p => [...p, { id: genId(), title: quick.trim(), content: '', answer: '', tags: [], status: 'open', createdAt: new Date().toISOString() }]);
    setQuick('');
  };

  const openNew = () => { setForm({ title: '', content: '', answer: '', tags: [], status: 'open' }); setModal('new'); };
  const openEdit = (q) => { setForm({ ...q, tags: q.tags || [] }); setModal(q.id); };
  const save = () => {
    if (!form.title.trim()) return;
    const patch = { ...form };
    if (patch.status === 'resolved' && !patch.resolvedAt) patch.resolvedAt = new Date().toISOString();
    if (patch.status !== 'resolved') patch.resolvedAt = '';
    if (modal === 'new') setQuestions(p => [...p, { ...patch, id: genId(), createdAt: new Date().toISOString() }]);
    else setQuestions(p => p.map(q => q.id === modal ? { ...q, ...patch } : q));
    setModal(null);
  };
  const del = (id) => { if (confirm('删除此疑问？')) setQuestions(p => p.filter(q => q.id !== id)); };
  const toggleResolve = (e, q) => {
    e.stopPropagation();
    setQuestions(p => p.map(x => x.id === q.id ? { ...x, status: x.status === 'resolved' ? 'open' : 'resolved', resolvedAt: x.status === 'resolved' ? '' : new Date().toISOString() } : x));
  };

  const renderCard = (q, isResolved) => (
    <Card key={q.id} onClick={() => openEdit(q)} className={isResolved ? 'opacity-60' : ''}>
      <div className="flex items-start gap-3">
        <span className="text-lg shrink-0 mt-0.5">{isResolved ? '✅' : '❓'}</span>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm break-words ${isResolved ? 'line-through text-gray-500' : 'text-gray-800'}`}>{q.title}</p>
          {q.content && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{q.content}</p>}
          {isResolved && q.answer && <p className="text-xs text-emerald-600 mt-1 line-clamp-2">💡 {q.answer}</p>}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {q.tags?.map(t => <Badge key={t}>{t}</Badge>)}
            <span className="text-xs text-gray-300 ml-1">{fmt(q.createdAt)}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button onClick={e => toggleResolve(e, q)} className={`text-xs px-2 py-0.5 rounded ${isResolved ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}>
            {isResolved ? '↩ 重新打开' : '✓ 已解答'}
          </button>
          <button onClick={e => { e.stopPropagation(); del(q.id); }} className="text-gray-200 hover:text-red-400 text-sm">🗑</button>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-800">❓ 疑问 / 薄弱点</h1>
        <div className="flex gap-2">
          {questions.length > 0 && <Btn variant="danger" onClick={() => { if (confirm(`删除全部 ${questions.length} 条疑问？此操作不可恢复。`)) setQuestions([]); }}>🗑 全部删除</Btn>}
          <Btn onClick={openNew}>+ 详细记录</Btn>
        </div>
      </div>

      {/* 快速记一条 */}
      <Card className="mb-4">
        <p className="text-xs text-gray-400 mb-2">💡 顺手记下当前还没解答的问题（回车提交）</p>
        <div className="flex gap-2">
          <input value={quick} onChange={e => setQuick(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') quickAdd(); }}
            placeholder="例：授受动词あげる/くれる/もらう怎么区分？"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          <Btn onClick={quickAdd}>记一条</Btn>
        </div>
      </Card>

      <CollapsibleTagFilter tagCounts={tagCounts} total={questions.length} activeTag={activeTag} setActiveTag={setActiveTag} />

      <h2 className="text-sm font-semibold text-gray-500 mb-2 mt-4">未解答（{open.length}）</h2>
      {open.length === 0 ? (
        <Card className="text-center py-8"><p className="text-gray-300 text-sm">没有未解答的疑问 🎉</p></Card>
      ) : (
        <div className="space-y-2">{open.map(q => renderCard(q, false))}</div>
      )}

      {resolved.length > 0 && (
        <>
          <button onClick={() => setShowResolved(v => !v)} className="text-sm text-gray-400 hover:text-gray-600 mt-6 mb-2">
            {showResolved ? '▼' : '▶'} 已解答（{resolved.length}）
          </button>
          {showResolved && <div className="space-y-2">{resolved.map(q => renderCard(q, true))}</div>}
        </>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'new' ? '详细记录疑问' : '编辑疑问'} wide>
        <Input label="问题标题" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="例：授受动词怎么区分？" />
        <Textarea label="详细描述（可选，支持 Markdown）" value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} rows={4} placeholder="问题背景、想不通的地方…" />
        <Textarea label="解答（可选，想通了/老师答了就写在这里）" value={form.answer} onChange={e => setForm(p => ({ ...p, answer: e.target.value }))} rows={4} placeholder="..." />
        <Select label="状态" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} options={[{ value: 'open', label: '未解答' }, { value: 'resolved', label: '已解答' }]} />
        <TagSelector selected={form.tags} onChange={tags => setForm(p => ({ ...p, tags }))} pool={[...new Set([...allTags, '语法', '词汇', '听力', '汉字', '薄弱点'])]} />
        <div className="flex justify-end gap-2 pt-2"><Btn variant="secondary" onClick={() => setModal(null)}>取消</Btn><Btn onClick={save}>保存</Btn></div>
      </Modal>
    </div>
  );
};

