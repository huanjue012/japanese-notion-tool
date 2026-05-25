// ─── SHARED UTILITIES ─────────────────────────────────────────────────────────
const CollapsibleTagFilter = ({ tagCounts, total, activeTag, setActiveTag, defaultExpanded = false, noTagCount = 0 }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [tagSearch, setTagSearch] = useState('');
  if (Object.keys(tagCounts).length === 0 && noTagCount === 0) return null;
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">标签筛选</span>
        <button onClick={() => { setExpanded(v => !v); if (expanded) setTagSearch(''); }} className="text-xs text-gray-400 hover:text-gray-600">
          {expanded ? '收起 ▲' : '展开 ▼'}
        </button>
      </div>
      {expanded && (
        <>
          {Object.keys(tagCounts).length > 5 && (
            <input value={tagSearch} onChange={e => setTagSearch(e.target.value)} placeholder="搜索标签..."
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          )}
          <div className="flex flex-wrap gap-1.5">
            <Badge onClick={() => setActiveTag(null)} color={!activeTag ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}>全部 ({total})</Badge>
            {noTagCount > 0 && (
              <Badge onClick={() => setActiveTag(activeTag === '__no_tag__' ? null : '__no_tag__')} color={activeTag === '__no_tag__' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}>无标签 ({noTagCount})</Badge>
            )}
            {Object.entries(tagCounts).filter(([tag]) => !tagSearch || tag.toLowerCase().includes(tagSearch.toLowerCase())).sort((a,b) => b[1]-a[1]).map(([tag, cnt]) => (
              <Badge key={tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)} color={activeTag === tag ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}>{tag} ({cnt})</Badge>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const useClaudeExport = ({ items, mapExport, filename, claudePrompt, claudePrompts, matchKey, itemLabel, setItems }) => {
  const promptList = claudePrompts || [{ label: '默认', build: claudePrompt }];
  const [exportToast, setExportToast] = useState('');
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteJson, setDeleteJson] = useState('');
  const [hasBackup, setHasBackup] = useState(() => !!localStorage.getItem('backup_' + filename));
  const [exportModal, setExportModal] = useState(false);
  const [exportFilename, setExportFilename] = useState('');
  const [selectedTags, setSelectedTags] = useState(() => new Set());
  const [selectedPromptIdx, setSelectedPromptIdx] = useState(0);

  const filteredItems = useMemo(() => {
    if (selectedTags.size === 0) return items;
    return items.filter(x => x.tags?.some(t => selectedTags.has(t)));
  }, [items, selectedTags]);

  const exportJsonString = useMemo(() => JSON.stringify(mapExport(filteredItems), null, 2), [filteredItems, mapExport]);
  const exportPromptText = useMemo(() => {
    const p = promptList[selectedPromptIdx] || promptList[0];
    return p.build(exportJsonString);
  }, [exportJsonString, selectedPromptIdx, promptList]);

  const availableTags = useMemo(() => {
    const counts = {};
    items.forEach(x => x.tags?.forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const toggleTag = (tag) => setSelectedTags(prev => {
    const next = new Set(prev);
    if (next.has(tag)) next.delete(tag); else next.add(tag);
    return next;
  });
  const clearTags = () => setSelectedTags(new Set());

  const openExportModal = (open) => {
    if (open) {
      const today = new Date().toISOString().slice(0, 10);
      setExportFilename(`${filename}-${today}.json`);
      setSelectedTags(new Set());
      setExportModal(true);
    } else {
      setExportModal(false);
      setSelectedTags(new Set());
    }
  };

  const exportForClaude = () => openExportModal(true);

  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(exportPromptText); } catch(e) {}
    setExportToast('✅ 提示语已复制到剪贴板！');
    setTimeout(() => setExportToast(''), 3000);
  };

  const downloadJson = () => {
    const blob = new Blob([exportJsonString], { type: 'application/json' });
    const dlUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = dlUrl;
    a.download = exportFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(dlUrl);
  };

  const applyDeleteList = () => {
    let d;
    try { d = JSON.parse(deleteJson); } catch(e) { alert('JSON 格式有误：' + e.message); return; }
    const keys = d.delete_duplicates;
    if (!Array.isArray(keys) || keys.length === 0) { alert('未找到 delete_duplicates 字段或列表为空'); return; }
    const keySet = new Set(keys);
    const firstSeen = new Set();
    const toDelete = items.filter(x => {
      if (!keySet.has(x[matchKey])) return false;
      if (!firstSeen.has(x[matchKey])) {
        firstSeen.add(x[matchKey]);
        return items.filter(i => i[matchKey] === x[matchKey]).length === 1;
      }
      return true;
    });
    if (toDelete.length === 0) { alert(`没有匹配的${itemLabel}`); return; }
    if (!confirm(`将删除以下 ${toDelete.length} 条${itemLabel}：\n${toDelete.map(x => '· ' + x[matchKey]).join('\n')}\n\n确认删除？`)) return;
    localStorage.setItem('backup_' + filename, JSON.stringify(items));
    setHasBackup(true);
    const toDeleteIds = new Set(toDelete.map(x => x.id));
    setItems(p => p.filter(x => !toDeleteIds.has(x.id)));
    setDeleteModal(false);
    setDeleteJson('');
    setExportToast(`✅ 已删除 ${toDelete.length} 条重复${itemLabel}`);
    setTimeout(() => setExportToast(''), 3000);
  };

  const restoreBackup = () => {
    const raw = localStorage.getItem('backup_' + filename);
    if (!raw) { alert('没有找到备份'); return; }
    let backup;
    try { backup = JSON.parse(raw); } catch(e) { alert('备份数据损坏：' + e.message); return; }
    if (!confirm('确认从备份恢复？当前数据将被替换。')) return;
    setItems(() => backup);
    setDeleteModal(false);
    setDeleteJson('');
    setExportToast('✅ 已从备份恢复');
    setTimeout(() => setExportToast(''), 3000);
  };

  return { exportForClaude, applyDeleteList, restoreBackup, hasBackup, setHasBackup, exportToast, deleteModal, setDeleteModal, deleteJson, setDeleteJson, exportModal, setExportModal: openExportModal, exportPromptText, copyPrompt, downloadJson, selectedTags, toggleTag, clearTags, availableTags, filteredCount: filteredItems.length, totalCount: items.length, promptList, selectedPromptIdx, setSelectedPromptIdx };
};

// ─── PDF EXPORT ───────────────────────────────────────────────────────────────
// 参考 travel map 项目：html-to-image 渲 PNG → jspdf 分页贴图
// 用 html-to-image（SVG foreignObject）而非 html2canvas，避免现代 CSS 颜色函数兼容问题
const exportElementToPDF = async (elementId, filename) => {
  const el = document.getElementById(elementId);
  if (!el) throw new Error('找不到导出容器：' + elementId);
  if (!window.htmlToImage || !window.jspdf) throw new Error('PDF 库未加载，请刷新页面再试');
  el.classList.add('pdf-export-mode');
  try {
    // 等一帧让 layout 计算完毕（off-screen 容器需要有正确的 width/height）
    await new Promise(r => requestAnimationFrame(() => r()));
    const dataUrl = await window.htmlToImage.toPng(el, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: '#ffffff',
    });
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('图片渲染失败')); img.src = dataUrl; });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'pt', 'a4');
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const ratio = pdfW / img.naturalWidth;
    const imgH = img.naturalHeight * ratio;
    let position = 0;
    pdf.addImage(dataUrl, 'PNG', 0, position, pdfW, imgH);
    let remaining = imgH - pdfH;
    while (remaining > 0) {
      position -= pdfH;
      pdf.addPage();
      pdf.addImage(dataUrl, 'PNG', 0, position, pdfW, imgH);
      remaining -= pdfH;
    }
    pdf.save(filename + '.pdf');
  } finally {
    el.classList.remove('pdf-export-mode');
  }
};

const pdfDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
