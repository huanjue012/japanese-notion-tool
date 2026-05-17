// ─── RESOURCES / 学习资源库 ──────────────────────────────────────────────────
const RESOURCE_CATEGORIES = ['词汇', '语法', '听力', '其他'];
const CAT_COLORS = {
  '词汇': 'bg-cyan-100 text-cyan-700',
  '语法': 'bg-violet-100 text-violet-700',
  '听力': 'bg-emerald-100 text-emerald-700',
  '其他': 'bg-gray-100 text-gray-600',
};

const ResourcesView = ({ resources, setResources, uid, isOnline }) => {
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ title: '', url: '', categories: [], notes: '', priority: 'normal', files: [] });
  const [uploading, setUploading] = useState(false);

  const uploadFile = async (file) => {
    if (!isOnline) { alert('上传文件需要网络连接'); return; }
    if (!uid) { alert('请先登录'); return; }
    if (file.size > 50 * 1024 * 1024) { alert('文件过大（>50MB）'); return; }
    setUploading(true);
    try {
      const path = `users/${uid}/resources/${genId()}_${file.name}`;
      const ref = fbStorage.ref(path);
      await ref.put(file);
      const url = await ref.getDownloadURL();
      const isImg = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';
      const type = isImg ? 'image' : (isPdf ? 'pdf' : 'file');
      setForm(p => ({ ...p, files: [...(p.files || []), { url, path, name: file.name, type, size: file.size }] }));
    } catch (e) { alert('上传失败：' + e.message); }
    finally { setUploading(false); }
  };

  const removeFile = async (path) => {
    setForm(p => ({ ...p, files: (p.files || []).filter(f => f.path !== path) }));
    try { await fbStorage.ref(path).delete(); } catch {}
  };

  const counts = useMemo(() => {
    const c = { all: resources.length };
    RESOURCE_CATEGORIES.forEach(cat => { c[cat] = resources.filter(r => r.categories?.includes(cat)).length; });
    return c;
  }, [resources]);

  const displayed = filter === 'all' ? resources : resources.filter(r => r.categories?.includes(filter));
  const sorted = [...displayed].sort((a, b) => {
    if (a.priority === 'high' && b.priority !== 'high') return -1;
    if (b.priority === 'high' && a.priority !== 'high') return 1;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  const openNew = () => { setForm({ title: '', url: '', categories: [], notes: '', priority: 'normal', files: [] }); setModal('new'); };
  const openEdit = (r) => { setForm({ ...r, categories: r.categories || [], files: r.files || [] }); setModal(r.id); };
  const save = () => {
    if (!form.title.trim()) return;
    if (modal === 'new') setResources(p => [...p, { ...form, id: genId(), createdAt: new Date().toISOString() }]);
    else setResources(p => p.map(r => r.id === modal ? { ...r, ...form } : r));
    setModal(null);
  };
  const del = (id) => { if (confirm('删除此资源？')) setResources(p => p.filter(r => r.id !== id)); };
  const toggleCat = (cat) => setForm(p => ({ ...p, categories: p.categories.includes(cat) ? p.categories.filter(c => c !== cat) : [...p.categories, cat] }));

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-800">📚 学习资源库</h1>
        <div className="flex gap-2">
          {resources.length > 0 && <Btn variant="danger" onClick={() => { if (confirm(`删除全部 ${resources.length} 条资源？此操作不可恢复。`)) setResources([]); }}>🗑 全部删除</Btn>}
          <Btn onClick={openNew}>+ 添加资源</Btn>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === 'all' ? 'bg-indigo-600 text-white shadow' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          全部 ({counts.all})
        </button>
        {RESOURCE_CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === cat ? 'bg-indigo-600 text-white shadow' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {cat} ({counts[cat] || 0})
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <Card className="text-center py-16">
          <p className="text-gray-300 text-4xl mb-3">📚</p>
          <p className="text-gray-400 text-sm">还没有资源</p>
          <Btn onClick={openNew} className="mt-4">添加第一个资源</Btn>
        </Card>
      ) : (
        <div className="space-y-2">
          {sorted.map(r => (
            <Card key={r.id} onClick={() => openEdit(r)}>
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0 mt-0.5">{r.priority === 'high' ? '⭐' : '📌'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-800 text-sm break-words">{r.title}</h3>
                    {r.categories?.map(c => <Badge key={c} color={CAT_COLORS[c] || 'bg-gray-100 text-gray-600'}>{c}</Badge>)}
                  </div>
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-indigo-500 hover:text-indigo-700 break-all">
                      🔗 {r.url}
                    </a>
                  )}
                  {r.files?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {r.files.map((f, i) => (
                        <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 hover:bg-indigo-50 hover:border-indigo-200 text-gray-600">
                          <span>{f.type === 'pdf' ? '📄' : f.type === 'image' ? '🖼' : '📎'}</span>
                          <span className="truncate max-w-[160px]">{f.name}</span>
                        </a>
                      ))}
                    </div>
                  )}
                  {r.notes && <p className="text-xs text-gray-500 mt-1 break-words whitespace-pre-wrap">{r.notes}</p>}
                </div>
                <button onClick={e => { e.stopPropagation(); del(r.id); }} className="text-gray-200 hover:text-red-400 shrink-0">🗑</button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'new' ? '添加资源' : '编辑资源'}>
        <Input label="标题" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="例：MOJi 辞書" />
        <Input label="链接（可选）" value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} placeholder="https://..." />
        <Field label="分类（可多选）">
          <div className="flex flex-wrap gap-2">
            {RESOURCE_CATEGORIES.map(cat => (
              <button key={cat} type="button" onClick={() => toggleCat(cat)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${form.categories.includes(cat) ? 'bg-indigo-600 text-white shadow' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {cat}
              </button>
            ))}
          </div>
        </Field>
        <Textarea label="备注" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} placeholder="什么场景下用、为什么推荐…" />
        <Field label="附件（PDF / 图片 / 任意文件）">
          {(form.files || []).length > 0 && (
            <div className="space-y-1 mb-2">
              {(form.files || []).map((f, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5">
                  <span className="text-sm">{f.type === 'pdf' ? '📄' : f.type === 'image' ? '🖼' : '📎'}</span>
                  <span className="text-xs text-gray-600 flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-gray-300 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                  <a href={f.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-indigo-500 hover:text-indigo-700 shrink-0">↗</a>
                  <button onClick={() => removeFile(f.path)} className="text-xs text-red-400 hover:text-red-600 shrink-0 font-bold">×</button>
                </div>
              ))}
            </div>
          )}
          <label className={`inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors
            ${isOnline ? 'cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-600' : 'cursor-not-allowed bg-gray-50 text-gray-300'}`}
            title={isOnline ? '' : '离线时无法上传'}>
            {uploading ? <span className="text-xs text-gray-400">上传中…</span> : <><span>+</span><span>上传文件</span></>}
            <input type="file" disabled={!isOnline || uploading} onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])} className="hidden" />
          </label>
        </Field>
        <Select label="优先级" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} options={[{ value: 'normal', label: '普通' }, { value: 'high', label: '⭐ 重点' }]} />
        <div className="flex justify-end gap-2 pt-2"><Btn variant="secondary" onClick={() => setModal(null)}>取消</Btn><Btn onClick={save}>保存</Btn></div>
      </Modal>
    </div>
  );
};

