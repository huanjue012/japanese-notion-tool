// ─── UI PRIMITIVES ─────────────────────────────────────────────────────────────
const Badge = ({ children, color = 'bg-indigo-100 text-indigo-700', onClick, onRemove, className = '' }) => (
  <span onClick={onClick} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color} ${onClick ? 'cursor-pointer hover:opacity-75' : ''} ${className}`}>
    {children}
    {onRemove && <button onClick={e => { e.stopPropagation(); onRemove(); }} className="hover:opacity-60 font-bold">×</button>}
  </span>
);

const Btn = ({ children, onClick, variant = 'primary', size = 'md', disabled, className = '' }) => {
  const vs = { primary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm', secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700', danger: 'bg-red-500 hover:bg-red-600 text-white', ghost: 'hover:bg-gray-100 text-gray-600', success: 'bg-emerald-500 hover:bg-emerald-600 text-white' };
  const ss = { sm: 'px-2.5 py-1 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5' };
  return <button onClick={onClick} disabled={disabled} className={`rounded-lg font-medium transition-colors ${vs[variant]} ${ss[size]} ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${className}`}>{children}</button>;
};

const Card = ({ children, className = '', onClick }) => (
  <div onClick={onClick} className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${className}`}>{children}</div>
);

const Modal = ({ open, onClose, title, children, wide }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white rounded-t-2xl">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none w-7 h-7 flex items-center justify-center">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

const Field = ({ label, children }) => (
  <div className="mb-3">
    {label && <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">{label}</label>}
    {children}
  </div>
);

const Input = ({ label, ...p }) => (
  <Field label={label}>
    <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent" {...p} />
  </Field>
);

const Textarea = ({ label, rows = 4, ...p }) => (
  <Field label={label}>
    <textarea rows={rows} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent resize-none" {...p} />
  </Field>
);

const Select = ({ label, options, ...p }) => (
  <Field label={label}>
    <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" {...p}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </Field>
);

const TagSelector = ({ selected = [], onChange, pool = [] }) => {
  const [inp, setInp] = useState('');
  const add = t => { if (t && !selected.includes(t)) onChange([...selected, t]); setInp(''); };
  const suggestions = pool.filter(t => !selected.includes(t) && t.toLowerCase().includes(inp.toLowerCase())).slice(0, 6);
  return (
    <Field label="标签">
      <div className="flex flex-wrap gap-1 mb-2">
        {selected.map(t => <Badge key={t} color="bg-indigo-100 text-indigo-700" onRemove={() => onChange(selected.filter(x => x !== t))}>{t}</Badge>)}
      </div>
      <div className="relative">
        <input value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(inp); } }}
          placeholder="输入标签后按 Enter 添加..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        {inp && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 z-10 overflow-hidden">
            {suggestions.map(t => <div key={t} onClick={() => add(t)} className="px-3 py-2 text-sm hover:bg-indigo-50 cursor-pointer">{t}</div>)}
          </div>
        )}
      </div>
    </Field>
  );
};

// ─── RICH NOTE CONTENT (Markdown 或 自包含 HTML，HTML 走沙箱 iframe) ─────────────
// 判定笔记是否为 HTML：显式 format==='html'，或（无 format 时）内容像完整 HTML 文档。
// 保守判定，避免误伤含零星 <br> 的 Markdown 笔记。
const looksLikeHtml = (s) => /<!doctype html|<html[\s>]|<style[\s>]/i.test(s || '');
const isHtmlNote = (content, format) => format === 'html' || (!format && looksLikeHtml(content));

// 列表卡片用：把 HTML/Markdown 转成纯文本摘要
const noteSnippet = (content, format) => {
  const s = content || '';
  if (isHtmlNote(s, format)) {
    const tmp = document.createElement('div');
    tmp.innerHTML = s.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '');
    return (tmp.textContent || '').replace(/\s+/g, ' ').trim();
  }
  return s.replace(/#{1,6}\s/g,'').replace(/\*\*/g,'').replace(/\*/g,'').replace(/`/g,'').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/\n/g,' ').trim();
};

// 自包含 HTML 笔记：沙箱 iframe 渲染（仅 allow-same-origin，故意不加 allow-scripts → 脚本/内联事件不执行 = XSS 安全；
// allow-same-origin 仅用于读取内容高度做自适应）
const HtmlNoteFrame = ({ content, className = '' }) => {
  const iframeRef = useRef(null);
  const srcDoc = useMemo(() => {
    const c = content || '';
    if (/<html[\s>]|<!doctype html/i.test(c)) return c; // 已是完整文档，原样渲染
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><base target="_blank"><style>html,body{margin:0;padding:0;}body{font-family:'Noto Sans JP','Segoe UI',system-ui,sans-serif;line-height:1.7;color:#1f2937;}</style></head><body>${c}</body></html>`;
  }, [content]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let ro = null;
    const resize = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        const h = Math.max(doc.documentElement?.scrollHeight || 0, doc.body?.scrollHeight || 0);
        if (h) iframe.style.height = h + 'px';
      } catch (e) {}
    };
    const onLoad = () => {
      resize();
      try {
        const doc = iframe.contentDocument;
        if (doc?.body && window.ResizeObserver) { ro = new ResizeObserver(resize); ro.observe(doc.body); }
        if (doc?.fonts?.ready) doc.fonts.ready.then(resize); // 字体异步加载后再量一次
      } catch (e) {}
      setTimeout(resize, 300);
    };
    iframe.addEventListener('load', onLoad);
    window.addEventListener('resize', resize);
    if (iframe.contentDocument?.readyState === 'complete') onLoad(); // srcDoc 可能已加载完
    return () => { iframe.removeEventListener('load', onLoad); window.removeEventListener('resize', resize); if (ro) ro.disconnect(); };
  }, [srcDoc]);

  return (
    <iframe ref={iframeRef} srcDoc={srcDoc} sandbox="allow-same-origin" title="note"
      className={className} style={{ width: '100%', border: 'none', display: 'block', overflow: 'hidden' }} />
  );
};

// 笔记内容统一渲染入口：HTML → iframe，否则 Markdown → .md-body（行为同旧逻辑）
// 注意：分发器本身不调用 hooks；切换 format 时会换组件类型，hook 顺序保持稳定。
const NoteContent = ({ content, format, className = '' }) => {
  if (isHtmlNote(content, format)) return <HtmlNoteFrame content={content} className={className} />;
  return <div className={`md-body ${className}`} dangerouslySetInnerHTML={{ __html: window.marked ? marked.parse(content || '') : (content || '') }} />;
};

// ─── INITIAL DATA ────────────────────────────────────────────────────────────
const DEFAULT_TAGS = ['文法','词汇','助词','动词','形容词','打招呼','数字','时间','N5','第1课','第2课','第3课'];
