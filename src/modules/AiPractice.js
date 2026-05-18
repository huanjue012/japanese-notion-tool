// ─── AI PRACTICE ──────────────────────────────────────────────────────────────
const AIPractice = ({ notes, allTags, setPage, navCtx, clearNavCtx }) => {
  const [tab, setTab] = React.useState('correct');
  const [noKey, setNoKey] = React.useState(false);
  const [quizInitialTags, setQuizInitialTags] = React.useState(null);

  const handleNoKey = () => setNoKey(true);

  React.useEffect(() => {
    if (navCtx?.tab === 'quiz') {
      setTab('quiz');
      setQuizInitialTags(navCtx.tags || []);
      clearNavCtx?.();
    }
  }, [navCtx]);

  const tabs = [
    { id: 'correct', label: '批改造句' },
    { id: 'quiz', label: '出题测验' },
  ];

  if (noKey) return (
    <div className="max-w-lg mx-auto text-center py-16">
      <p className="text-4xl mb-4">🔑</p>
      <p className="font-semibold text-gray-700 mb-2">请先设置 Gemini API Key</p>
      <p className="text-sm text-gray-400 mb-4">免费申请：aistudio.google.com</p>
      <Btn onClick={() => { setNoKey(false); setPage('settings'); }}>前往设置</Btn>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-4">🤖 AI 练习</h1>
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-white shadow text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'correct' && <CorrectTab onNoKey={handleNoKey} />}
      {tab === 'quiz' && <QuizTab notes={notes} allTags={allTags} onNoKey={handleNoKey} initialTags={quizInitialTags} consumeInitialTags={() => setQuizInitialTags(null)} />}
    </div>
  );
};

const CorrectTab = ({ onNoKey }) => {
  const [sentence, setSentence] = React.useState('');
  const [result, setResult] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const correct = async () => {
    if (!sentence.trim()) return;
    setLoading(true);
    setResult('');
    try {
      const prompt = `你是日语老师，我是N5初学者。请批改以下日语句子：
1. 指出所有语法错误（如果没有错误请说明句子正确）
2. 解释每个错误的原因
3. 给出正确版本
4. 如果有更自然的表达方式也请提供

请用中文解释，保留日文原文。

句子：${sentence}`;
      const res = await callGemini(prompt);
      setResult(res);
    } catch (e) {
      if (e.message === 'NO_KEY') { onNoKey(); return; }
      setResult('❌ 请求失败：' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h2 className="font-semibold text-gray-700 mb-3">输入日语句子，AI 帮你批改</h2>
      <textarea
        value={sentence}
        onChange={e => setSentence(e.target.value)}
        placeholder="例：私はご飯を食べです。"
        rows={3}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 mb-3 resize-none"
      />
      <Btn onClick={correct} disabled={loading || !sentence.trim()}>
        {loading ? '批改中…' : '批改'}
      </Btn>
      {result && (
        <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <div className="md-body" dangerouslySetInnerHTML={{ __html: marked.parse(result) }} />
        </div>
      )}
    </Card>
  );
};


const QuizTab = ({ notes, allTags, onNoKey, initialTags, consumeInitialTags }) => {
  const [scopeMode, setScopeMode] = React.useState('tags');
  const [selectedTags, setSelectedTags] = React.useState([]);
  const [selectedNotes, setSelectedNotes] = React.useState([]);
  const [customScope, setCustomScope] = React.useState('');
  const [scopeSearch, setScopeSearch] = React.useState('');
  const [quizType, setQuizType] = React.useState('choice');
  const [focusMode, setFocusMode] = React.useState('mixed'); // 'mixed' | 'grammar'
  const [questions, setQuestions] = React.useState([]);
  const [answers, setAnswers] = React.useState({});
  const [revealed, setRevealed] = React.useState({});
  const [loading, setLoading] = React.useState(false);
  const [started, setStarted] = React.useState(false);

  React.useEffect(() => {
    if (initialTags && initialTags.length > 0) {
      setScopeMode('tags');
      setSelectedTags(initialTags);
      consumeInitialTags?.();
    }
  }, [initialTags]);

  const toggleTag = (tag) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };
  const toggleNote = (id) => {
    setSelectedNotes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const generate = async () => {
    setLoading(true);
    setQuestions([]);
    setAnswers({});
    setRevealed({});
    setStarted(false);
    try {
      let context, scopeLabel;
      if (scopeMode === 'tags') {
        const filtered = notes
          .filter(n => selectedTags.length === 0 || selectedTags.some(t => n.tags?.includes(t) || n.title.includes(t) || n.content.includes(t)))
          .slice(0, 5)
          .map(n => `【${n.title}】\n${n.content}`)
          .join('\n\n---\n\n');
        context = filtered || '（无相关笔记，请根据N5日语常识出题）';
        scopeLabel = selectedTags.length > 0 ? selectedTags.join('、') : 'N5日语';
      } else if (scopeMode === 'notes') {
        const picked = notes.filter(n => selectedNotes.includes(n.id));
        context = picked.map(n => `【${n.title}】\n${n.content}`).join('\n\n---\n\n') || '（未选笔记，请根据N5日语常识出题）';
        scopeLabel = picked.length > 0 ? picked.map(n => n.title).join('、') : 'N5日语';
      } else {
        context = customScope.trim() ? `用户指定范围：${customScope}` : '（请根据N5日语常识出题）';
        scopeLabel = customScope.trim() || 'N5日语';
      }

      const typeDesc = quizType === 'choice' ? '单选题（4个选项，标明正确答案）' : '填空题（用___标注空格位置）';
      const focusLabel = focusMode === 'grammar' ? `${scopeLabel}（仅文法）` : scopeLabel;

      const grammarRules = `
本次出题为「文法专项」，特别要求：
- 只考语法点：助词选择、动词/形容词活用、句式、时态、敬语等。**不要**考词汇含义。
- 题面里所有非考点的日文实词，必须在紧邻的括号里附中文释义，例：「先生（老师）に本（书）を___」。
- 选项中的日文实词同样要附中文括注；考点本身（即被考的助词/活用形/句式）不要附释义。
- explanation 必须解释考点对应的语法规则，而不是单词意思。
- 目标：学生即使不认识题中任何单词，也能完全靠语法知识答对。`;

      const baseRules = `
要求：
- 每题单独用 JSON 格式输出，整体包在一个 JSON 数组里
- 每道题包含字段：q（题目）、options（选项数组，填空题为空数组[]）、answer（正确答案）、explanation（中文解析）
- 题目用中日混合，日文作为考核内容`;

      const prompt = `你是日语老师，请根据以下内容出${typeDesc}5道，测试对「${focusLabel}」的掌握。
${baseRules}${focusMode === 'grammar' ? grammarRules : ''}

参考内容：
${context}

请只输出 JSON 数组，不要其他文字。`;

      const res = await callGemini(prompt);
      const jsonMatch = res.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('格式错误，请重试');
      const parsed = JSON.parse(jsonMatch[0]);
      const normalized = (Array.isArray(parsed) ? parsed : []).map(q => ({
        ...q,
        q: typeof q.q === 'string' ? q.q : String(q.q ?? ''),
        answer: typeof q.answer === 'string' ? q.answer : String(q.answer ?? ''),
        options: Array.isArray(q.options)
          ? q.options.map(o => {
              if (typeof o === 'string') return o;
              if (o && typeof o === 'object') return String(o.text ?? o.label ?? o.value ?? JSON.stringify(o));
              return String(o ?? '');
            })
          : [],
        explanation: typeof q.explanation === 'string' ? q.explanation : String(q.explanation ?? ''),
      }));
      setQuestions(normalized);
      setStarted(true);
    } catch (e) {
      if (e.message === 'NO_KEY') { onNoKey(); return; }
      alert('出题失败：' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const reveal = (idx) => setRevealed(prev => ({ ...prev, [idx]: true }));

  const scopeModes = [['tags', '按标签'], ['notes', '选笔记'], ['custom', '自定义']];

  return (
    <div>
      {!started ? (
        <Card>
          <h2 className="font-semibold text-gray-700 mb-3">选择测验范围</h2>

          {/* Scope mode switcher */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-3 w-fit">
            {scopeModes.map(([v, l]) => (
              <button key={v} onClick={() => { setScopeMode(v); setScopeSearch(''); }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${scopeMode === v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {l}
              </button>
            ))}
          </div>

          {scopeMode !== 'custom' && (
            <div className="relative mb-3">
              <input
                value={scopeSearch}
                onChange={e => setScopeSearch(e.target.value)}
                placeholder={scopeMode === 'tags' ? '搜索标签…' : '搜索笔记标题/内容…'}
                className="w-full border border-gray-200 rounded-lg pl-3 pr-8 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              {scopeSearch && (
                <button
                  onClick={() => setScopeSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                  aria-label="清除搜索"
                >×</button>
              )}
            </div>
          )}

          {scopeMode === 'tags' && (() => {
            const q = scopeSearch.trim().toLowerCase();
            const matchSet = new Set(
              q ? allTags.filter(t => t.toLowerCase().includes(q)) : allTags
            );
            selectedTags.forEach(t => matchSet.add(t));
            const visible = allTags.filter(t => matchSet.has(t));
            return (
              <div className="mb-4">
                <p className="text-xs text-gray-400 mb-2">选择标签（不选则出 N5 综合题）</p>
                {visible.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">没有匹配的标签</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {visible.map(tag => (
                      <Badge key={tag} onClick={() => toggleTag(tag)}
                        color={selectedTags.includes(tag) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {scopeMode === 'notes' && (() => {
            const q = scopeSearch.trim().toLowerCase();
            const matchIds = new Set(
              (q ? notes.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)) : notes).map(n => n.id)
            );
            selectedNotes.forEach(id => matchIds.add(id));
            const visible = notes.filter(n => matchIds.has(n.id));
            return (
              <div className="mb-4">
                <p className="text-xs text-gray-400 mb-2">选择要考核的笔记（不选则出 N5 综合题）</p>
                {notes.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">暂无笔记</p>
                ) : visible.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">没有匹配的笔记</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl divide-y">
                    {visible.map(n => (
                      <label key={n.id} className="flex items-start gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                        <input type="checkbox" checked={selectedNotes.includes(n.id)}
                          onChange={() => toggleNote(n.id)} className="mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-700 break-words">{n.title}</p>
                          <p className="text-xs text-gray-400 line-clamp-1">{n.content.slice(0, 60)}…</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {scopeMode === 'custom' && (
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-2">用中文描述你想测试的内容</p>
              <textarea
                value={customScope}
                onChange={e => setCustomScope(e.target.value)}
                placeholder="例：N5助词的用法，特别是は和が的区别；或：动词て形的变形规则"
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              />
            </div>
          )}

          <div className="flex gap-3 mb-3">
            {[['choice', '选择题'], ['fill', '填空题']].map(([v, l]) => (
              <label key={v} className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
                <input type="radio" value={v} checked={quizType === v} onChange={() => setQuizType(v)} />
                {l}
              </label>
            ))}
          </div>
          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-1.5">测试重点</p>
            <div className="flex gap-3 flex-wrap">
              {[['mixed', '综合'], ['grammar', '文法（不考词汇）']].map(([v, l]) => (
                <label key={v} className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
                  <input type="radio" value={v} checked={focusMode === v} onChange={() => setFocusMode(v)} />
                  {l}
                </label>
              ))}
            </div>
            {focusMode === 'grammar' && (
              <p className="text-xs text-indigo-500 mt-1.5">题面会在生词后附中文释义，让你只需靠文法答题。</p>
            )}
          </div>
          <Btn onClick={generate} disabled={loading}>
            {loading ? '出题中…' : '出题（5道）'}
          </Btn>
        </Card>
      ) : (
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <Card key={idx}>
              <p className="text-sm font-medium text-gray-700 mb-3">Q{idx + 1}. {q.q}</p>
              {q.options && q.options.length > 0 ? (
                <div className="space-y-2 mb-3">
                  {q.options.map((opt, oi) => {
                    const optStr = String(opt ?? '');
                    const ansStr = String(q.answer ?? '');
                    const isCorrect = optStr === ansStr || optStr.startsWith(ansStr);
                    const isSelected = answers[idx] === opt;
                    let color = 'border-gray-200 text-gray-700';
                    if (revealed[idx]) {
                      color = isCorrect ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : isSelected ? 'border-red-300 bg-red-50 text-red-600' : 'border-gray-200 text-gray-400';
                    } else if (isSelected) {
                      color = 'border-indigo-400 bg-indigo-50 text-indigo-700';
                    }
                    return (
                      <button key={oi} disabled={!!revealed[idx]}
                        onClick={() => { setAnswers(prev => ({ ...prev, [idx]: opt })); }}
                        className={`w-full text-left border rounded-lg px-3 py-2 text-sm transition-colors ${color}`}>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <input
                  disabled={!!revealed[idx]}
                  value={answers[idx] || ''}
                  onChange={e => setAnswers(prev => ({ ...prev, [idx]: e.target.value }))}
                  placeholder="填入答案…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 mb-3"
                />
              )}
              {!revealed[idx] ? (
                <Btn size="sm" variant="secondary" onClick={() => reveal(idx)}
                  disabled={q.options?.length > 0 ? !answers[idx] : !answers[idx]?.trim()}>
                  查看答案
                </Btn>
              ) : (
                <div className="mt-2 p-2 bg-blue-50 rounded-lg text-xs text-blue-700">
                  <span className="font-semibold">答案：</span>{q.answer}
                  {q.explanation && <><br /><span className="font-semibold">解析：</span>{q.explanation}</>}
                </div>
              )}
            </Card>
          ))}
          <Btn variant="secondary" onClick={() => { setStarted(false); setQuestions([]); setAnswers({}); setRevealed({}); }}>
            重新出题
          </Btn>
        </div>
      )}
    </div>
  );
};
