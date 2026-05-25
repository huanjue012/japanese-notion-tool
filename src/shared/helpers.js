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

// 动态加载脚本，失败时尝试备用 CDN
const _loadScript = (urls) => new Promise((resolve, reject) => {
  const tryNext = (i) => {
    if (i >= urls.length) { reject(new Error('所有 CDN 都加载失败')); return; }
    const src = urls[i];
    if (document.querySelector(`script[data-pdfdep="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.dataset.pdfdep = src;
    s.onload = () => resolve();
    s.onerror = () => { s.remove(); tryNext(i + 1); };
    document.head.appendChild(s);
  };
  tryNext(0);
});

// 按需加载 PDF 依赖（首次约 1-2 秒，浏览器后续会缓存）
const ensurePdfLibs = async () => {
  if (!window.htmlToImage) {
    await _loadScript([
      'https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/dist/html-to-image.js',
      'https://unpkg.com/html-to-image@1.11.13/dist/html-to-image.js',
    ]);
  }
  if (!window.jspdf) {
    await _loadScript([
      'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js',
      'https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js',
    ]);
  }
  if (!window.htmlToImage || !window.jspdf) {
    throw new Error('PDF 库加载失败：脚本已加载但全局变量缺失。请检查网络或刷新页面。');
  }
};
// 把单个 DOM 元素截图、按 A4 宽缩放，分页贴入已有 jsPDF 实例。
// 如果 pdf 已有内容（page > 1 或当前页非空），先 addPage 以确保新元素从新页开始。
const _appendElementToPDF = async (el, pdf, isFirst) => {
  el.classList.add('pdf-export-mode');
  try {
    // 两个 RAF 等 React reconciliation + 浏览器 layout 完成（off-screen 容器要有 width/height）
    await new Promise(r => requestAnimationFrame(() => r()));
    await new Promise(r => requestAnimationFrame(() => r()));
    const dataUrl = await window.htmlToImage.toPng(el, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: '#ffffff',
    });
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('图片渲染失败')); img.src = dataUrl; });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const ratio = pdfW / img.naturalWidth;
    const imgH = img.naturalHeight * ratio;
    if (!isFirst) pdf.addPage();
    let position = 0;
    pdf.addImage(dataUrl, 'PNG', 0, position, pdfW, imgH);
    let remaining = imgH - pdfH;
    while (remaining > 0) {
      position -= pdfH;
      pdf.addPage();
      pdf.addImage(dataUrl, 'PNG', 0, position, pdfW, imgH);
      remaining -= pdfH;
    }
  } finally {
    el.classList.remove('pdf-export-mode');
  }
};

// 多容器版：每个容器从新页开始（真正的 page break，CSS 的 page-break-before 在
// html-to-image + jspdf 切片流程下不生效，必须分次截图）
const exportElementsToPDF = async (elementIds, filename) => {
  await ensurePdfLibs();
  const els = elementIds.map(id => {
    const el = document.getElementById(id);
    if (!el) throw new Error('找不到导出容器：' + id);
    return el;
  });
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p', 'pt', 'a4');
  for (let i = 0; i < els.length; i++) {
    await _appendElementToPDF(els[i], pdf, i === 0);
  }
  pdf.save(filename + '.pdf');
};

// 单容器版：兼容旧调用，内部走多容器
const exportElementToPDF = (elementId, filename) => exportElementsToPDF([elementId], filename);

// 把远程 URL 转 base64 data URL。Firebase Storage 跨域图片走 <img crossOrigin>
// 在桶未配 CORS 时会污染 canvas；改成先 fetch + FileReader 转 data URL，避开
// canvas tainting（fetch 仍需要 CORS，但失败时返回 null，调用方可优雅降级）。
const fetchImageAsDataUrl = async (url) => {
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('FileReader error'));
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('[PDF] 图片获取失败，将跳过：', url, e.message);
    return null;
  }
};

// 批量预加载图片为 data URL，返回 { url: dataUrl | null }
const prefetchImagesAsDataUrls = async (urls) => {
  const entries = await Promise.all(urls.map(async u => [u, await fetchImageAsDataUrl(u)]));
  return Object.fromEntries(entries);
};

const pdfDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
