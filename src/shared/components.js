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

// ─── INITIAL DATA ────────────────────────────────────────────────────────────
const DEFAULT_TAGS = ['文法','词汇','助词','动词','形容词','打招呼','数字','时间','N5','第1课','第2课','第3课'];
