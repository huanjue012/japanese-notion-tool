// ─── HOMEWORK TRACKER ─────────────────────────────────────────────────────────
const HW_STATUS = {
  pending:   { label: '待完成', color: 'bg-red-100 text-red-700', dot: '🔴' },
  submitted: { label: '已提交', color: 'bg-yellow-100 text-yellow-700', dot: '🟡' },
  feedback:  { label: '已批改', color: 'bg-blue-100 text-blue-700', dot: '🔵' },
  done:      { label: '已整理', color: 'bg-green-100 text-green-700', dot: '🟢' },
};

const HomeworkTracker = ({ homework, setHomework, uid, isOnline, templates = [], setTemplates }) => {
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ title: '', lessonNumber: '', dueDate: '', submittedDate: '', status: 'pending', teacherFeedback: '', notes: '', attachments: [] });
  const [uploadingAtt, setUploadingAtt] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [tplForm, setTplForm] = useState(null); // { id?, title, defaultLessonNumber, defaultNotes }
  const [copyFor, setCopyFor] = useState(null); // template being copied
  const [copyDates, setCopyDates] = useState(['']);
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const openTplNew = () => setTplForm({ title: '', defaultLessonNumber: '', defaultNotes: '' });
  const openTplEdit = (t) => setTplForm({ ...t });
  const saveTpl = () => {
    if (!tplForm.title.trim()) return;
    if (tplForm.id) {
      setTemplates(p => p.map(t => t.id === tplForm.id ? { ...t, ...tplForm } : t));
    } else {
      setTemplates(p => [...p, { ...tplForm, id: genId(), createdAt: new Date().toISOString() }]);
    }
    setTplForm(null);
  };
  const delTpl = (id) => { if (confirm('删除此模板？已生成的功课不受影响。')) setTemplates(p => p.filter(t => t.id !== id)); };

  const openCopy = (t) => { setCopyFor(t); setCopyDates(['']); };
  const doCopy = () => {
    const dates = copyDates.map(d => d.trim()).filter(Boolean);
    if (dates.length === 0) { alert('请至少选择一个日期'); return; }
    const newOnes = dates.map(d => ({
      id: genId(),
      title: copyFor.title,
      lessonNumber: copyFor.defaultLessonNumber || '',
      notes: copyFor.defaultNotes || '',
      dueDate: d,
      submittedDate: '',
      status: 'pending',
      teacherFeedback: '',
      attachments: [],
      sourceTemplateId: copyFor.id,
      createdAt: new Date().toISOString(),
    }));
    setHomework(p => [...p, ...newOnes]);
    setCopyFor(null);
    setCopyDates(['']);
    showToast(`已添加 ${newOnes.length} 条功课`);
  };

  const counts = useMemo(() => {
    const c = { all: homework.length };
    Object.keys(HW_STATUS).forEach(s => c[s] = homework.filter(h => h.status === s).length);
    return c;
  }, [homework]);

  const displayed = filter === 'all' ? homework : homework.filter(h => h.status === filter);

  const openNew = () => { setForm({ title:'', lessonNumber:'', dueDate:'', submittedDate:'', status:'pending', teacherFeedback:'', notes:'', attachments:[] }); setModal('new'); };
  const openEdit = h => { setForm({...h, attachments: h.attachments || [] }); setModal(h.id); };
  const save = () => {
    if (!form.title.trim()) return;
    if (modal === 'new') setHomework(p => [...p, { ...form, id: genId(), createdAt: new Date().toISOString() }]);
    else setHomework(p => p.map(h => h.id === modal ? {...h, ...form} : h));
    setModal(null);
  };
  const del = id => { if (confirm('删除此功课记录？')) setHomework(p => p.filter(h => h.id !== id)); };
  const markSubmitted = (e, id) => {
    e.stopPropagation();
    setHomework(p => p.map(h => h.id === id ? { ...h, status: 'submitted', submittedDate: new Date().toISOString().split('T')[0] } : h));
  };

  const uploadAttachment = async (file) => {
    if (!isOnline) { alert('上传文件需要网络连接'); return; }
    const isImg = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    if (!isImg && !isPdf) { alert('请选择图片或 PDF 文件'); return; }
    setUploadingAtt(true);
    try {
      const path = `users/${uid}/homework/${genId()}_${file.name}`;
      const ref = fbStorage.ref(path);
      await ref.put(file);
      const url = await ref.getDownloadURL();
      setForm(p => ({ ...p, attachments: [...(p.attachments || []), { url, path, name: file.name, type: isImg ? 'image' : 'pdf' }] }));
    } catch (e) { alert('上传失败：' + e.message); }
    finally { setUploadingAtt(false); }
  };

  const removeAttachment = (path) => {
    setForm(p => ({ ...p, attachments: (p.attachments || []).filter(a => a.path !== path) }));
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">📋 功课追踪</h1>
        <div className="flex gap-2 flex-wrap">
          {homework.length > 0 && <Btn variant="danger" onClick={() => { if (confirm(`删除全部 ${homework.length} 条功课记录？此操作不可恢复。`)) setHomework([]); }}>🗑 全部删除</Btn>}
          <Btn variant="secondary" onClick={() => setTplOpen(true)}>📋 任务模板{templates.length > 0 ? ` (${templates.length})` : ''}</Btn>
          <Btn onClick={openNew}>+ 添加功课</Btn>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {[['all','全部'],...Object.entries(HW_STATUS).map(([k,v])=>[k,v.label])].map(([k,l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter===k?'bg-indigo-600 text-white shadow':'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {l} ({counts[k] || 0})
          </button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <Card className="text-center py-16"><p className="text-gray-300 text-4xl mb-3">📭</p><p className="text-gray-400">暂无功课记录</p><Btn onClick={openNew} className="mt-4">添加第一份功课</Btn></Card>
      ) : (
        <div className="space-y-3">
          {[...displayed].sort((a,b) => {
            const aP = a.status === 'pending', bP = b.status === 'pending';
            if (aP && !bP) return -1;
            if (!aP && bP) return 1;
            if (aP && bP) return new Date(a.dueDate||0) - new Date(b.dueDate||0);
            return new Date(b.updatedAt||b.createdAt||0) - new Date(a.updatedAt||a.createdAt||0);
          }).map(h => (
            <Card key={h.id} onClick={() => openEdit(h)} className={isOverdue(h) ? 'border-red-200 bg-red-50/50' : ''}>
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0 mt-0.5">{HW_STATUS[h.status]?.dot}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-gray-800 text-sm">{h.title}</h3>
                    {isOverdue(h) && <Badge color="bg-red-100 text-red-600">⚠ 逾期</Badge>}
                    <Badge color={HW_STATUS[h.status]?.color}>{HW_STATUS[h.status]?.label}</Badge>
                    {h.attachments?.length > 0 && <span className="text-xs text-gray-400">📎 {h.attachments.length}</span>}
                  </div>
                  <div className="flex gap-3 text-xs text-gray-400 flex-wrap">
                    {h.lessonNumber && <span>第 {h.lessonNumber} 课</span>}
                    {h.dueDate && <span>截止：{h.dueDate}</span>}
                    {h.submittedDate && <span>提交：{h.submittedDate}</span>}
                  </div>
                  {h.teacherFeedback && (
                    <div className="mt-2 text-xs bg-blue-50 text-blue-600 rounded-lg px-3 py-1.5 line-clamp-2">💬 {h.teacherFeedback}</div>
                  )}
                  {h.status === 'pending' && (
                    <button onClick={e => markSubmitted(e, h.id)}
                      className="mt-2 inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition-colors font-medium">
                      ✓ 标记已提交
                    </button>
                  )}
                </div>
                <button onClick={e => { e.stopPropagation(); del(h.id); }} className="text-gray-200 hover:text-red-400 shrink-0">🗑</button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'new' ? '添加功课' : '编辑功课'}>
        <Input label="功课名称" value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))} placeholder="例：第3课写作练习" />
        <Input label="课次" value={form.lessonNumber} onChange={e => setForm(p=>({...p,lessonNumber:e.target.value}))} placeholder="例：3" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="截止日期" value={form.dueDate} onChange={e => setForm(p=>({...p,dueDate:e.target.value}))} type="date" />
          <Input label="提交日期" value={form.submittedDate||''} onChange={e => setForm(p=>({...p,submittedDate:e.target.value}))} type="date" />
        </div>
        <Select label="状态" value={form.status} onChange={e => setForm(p=>({...p,status:e.target.value}))} options={Object.entries(HW_STATUS).map(([v,{label}])=>({value:v,label}))} />
        <Textarea label="老师评语" value={form.teacherFeedback||''} onChange={e => setForm(p=>({...p,teacherFeedback:e.target.value}))} placeholder="记录老师的批改意见、扣分原因…" rows={4} />
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">附件（作业文件 / 老师批改）</p>
          {(form.attachments || []).length > 0 && (
            <div className="space-y-1 mb-2">
              {(form.attachments || []).map((att, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5">
                  <span className="text-sm">{att.type === 'pdf' ? '📄' : '🖼'}</span>
                  <span className="text-xs text-gray-600 flex-1 truncate">{att.name}</span>
                  <a href={att.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-indigo-500 hover:text-indigo-700 shrink-0">↗</a>
                  <button onClick={() => removeAttachment(att.path)} className="text-xs text-red-400 hover:text-red-600 shrink-0 font-bold">×</button>
                </div>
              ))}
            </div>
          )}
          <label className={`inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors
            ${isOnline ? 'cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-600' : 'cursor-not-allowed bg-gray-50 text-gray-300'}`}
            title={isOnline ? '' : '离线时无法上传'}>
            {uploadingAtt ? <span className="text-xs text-gray-400">上传中…</span> : <><span>+</span><span>上传文件（PDF / 图片）</span></>}
            <input type="file" accept="image/*,application/pdf" disabled={!isOnline || uploadingAtt} onChange={e => e.target.files?.[0] && uploadAttachment(e.target.files[0])} className="hidden" />
          </label>
        </div>
        <Textarea label="自己的笔记" value={form.notes||''} onChange={e => setForm(p=>({...p,notes:e.target.value}))} placeholder="自己的反思，下次要注意的地方…" rows={3} />
        <div className="flex justify-end gap-2 pt-2"><Btn variant="secondary" onClick={() => setModal(null)}>取消</Btn><Btn onClick={save}>保存</Btn></div>
      </Modal>

      {/* 模板清单 modal */}
      <Modal open={tplOpen} onClose={() => setTplOpen(false)} title="📋 任务模板清单" wide>
        <p className="text-xs text-gray-400 mb-3">把常做的任务（如「听 Teppei」「读教材 1 课」「复习 50 张闪卡」）存为模板，需要时手动选日期一键复制到功课。</p>
        <div className="mb-4">
          <Btn onClick={openTplNew}>+ 新建模板</Btn>
        </div>
        {templates.length === 0 ? (
          <p className="text-center text-gray-300 py-8 text-sm">还没有模板，点上面按钮新建一个</p>
        ) : (
          <div className="space-y-2">
            {templates.map(t => (
              <div key={t.id} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-start gap-2 justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">{t.title}</p>
                    <div className="flex gap-3 text-xs text-gray-400 mt-0.5 flex-wrap">
                      {t.defaultLessonNumber && <span>第 {t.defaultLessonNumber} 课</span>}
                      {t.defaultNotes && <span className="truncate">📝 {t.defaultNotes}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Btn size="sm" onClick={() => openCopy(t)}>📅 复制到日期</Btn>
                    <Btn size="sm" variant="secondary" onClick={() => openTplEdit(t)}>✏</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => delTpl(t.id)}>🗑</Btn>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* 模板表单 modal */}
      <Modal open={!!tplForm} onClose={() => setTplForm(null)} title={tplForm?.id ? '编辑模板' : '新建模板'}>
        <Input label="任务标题" value={tplForm?.title || ''} onChange={e => setTplForm(p => ({ ...p, title: e.target.value }))} placeholder="例：听 Nihongo con Teppei 1 集" />
        <Input label="默认课次（可选）" value={tplForm?.defaultLessonNumber || ''} onChange={e => setTplForm(p => ({ ...p, defaultLessonNumber: e.target.value }))} placeholder="例：19" />
        <Textarea label="默认备注（可选）" value={tplForm?.defaultNotes || ''} onChange={e => setTplForm(p => ({ ...p, defaultNotes: e.target.value }))} rows={3} placeholder="复制功课时会带上这段备注…" />
        <div className="flex justify-end gap-2 pt-2"><Btn variant="secondary" onClick={() => setTplForm(null)}>取消</Btn><Btn onClick={saveTpl}>保存</Btn></div>
      </Modal>

      {/* 复制到日期 modal */}
      <Modal open={!!copyFor} onClose={() => setCopyFor(null)} title={`复制到日期：${copyFor?.title || ''}`}>
        <p className="text-xs text-gray-400 mb-3">选择 1 个或多个日期，每个日期会生成一条独立的功课。</p>
        <div className="space-y-2 mb-3">
          {copyDates.map((d, i) => (
            <div key={i} className="flex gap-2">
              <input type="date" value={d} onChange={e => setCopyDates(p => p.map((x, j) => j === i ? e.target.value : x))}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              {copyDates.length > 1 && (
                <button onClick={() => setCopyDates(p => p.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 px-2">×</button>
              )}
            </div>
          ))}
        </div>
        <Btn size="sm" variant="secondary" onClick={() => setCopyDates(p => [...p, ''])}>+ 再加一个日期</Btn>
        <div className="flex justify-end gap-2 pt-4"><Btn variant="secondary" onClick={() => setCopyFor(null)}>取消</Btn><Btn onClick={doCopy}>确认复制</Btn></div>
      </Modal>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm shadow-lg z-50">{toast}</div>
      )}
    </div>
  );
};

