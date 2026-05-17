// ─── APP SHELL ────────────────────────────────────────────────────────────────
const PAGES = [
  { id: 'dashboard',  label: '总览',     icon: '🏠' },
  { id: 'knowledge',  label: '知识库',   icon: '📝' },
  { id: 'flashcards', label: '闪卡',     icon: '🃏' },
  { id: 'homework',   label: '功课',     icon: '📋' },
  { id: 'questions',  label: '疑问',     icon: '❓' },
  { id: 'resources',  label: '资源',     icon: '📚' },
  { id: 'pdf',        label: 'PDF 导入', icon: '📄' },
  { id: 'ai',         label: 'AI 练习',  icon: '🤖' },
  { id: 'tts',        label: '文字转语音', icon: '🔊' },
  { id: 'settings',   label: '设置',     icon: '⚙️' },
];

const PATH_TO_ID = {'/':'dashboard', '/notes':'knowledge', '/flashcards':'flashcards', '/homework':'homework', '/questions':'questions', '/resources':'resources', '/import':'pdf', '/practice':'ai', '/tts':'tts', '/settings':'settings'};
const ID_TO_PATH = {dashboard:'/', knowledge:'/notes', flashcards:'/flashcards', homework:'/homework', questions:'/questions', resources:'/resources', pdf:'/import', ai:'/practice', tts:'/tts', settings:'/settings'};
const pathForId = (id) => ID_TO_PATH[id] || '/';
const idForPath = (p) => PATH_TO_ID[p] || 'dashboard';

const App = ({ user }) => {
  const isOnline = useOnlineStatus();
  const [page, setPage] = useState(() => idForPath(window.location.pathname));
  const [navCtx, setNavCtx] = useState(null);
  const [sideOpen, setSideOpen] = useState(false);
  const [notes, setNotes]         = useFirestoreCollection('notes',      user.uid);
  const [flashcards, setFlash]    = useFirestoreCollection('flashcards', user.uid);
  const [homework, setHomework]   = useFirestoreCollection('homework',   user.uid);
  const [taskTemplates, setTaskTemplates] = useFirestoreCollection('taskTemplates', user.uid);
  const [questions, setQuestions] = useFirestoreCollection('questions',  user.uid);
  const [resources, setResources] = useFirestoreCollection('resources',  user.uid);
  const [vocab, setVocab]         = useFirestoreCollection('vocab',      user.uid);
  const [importedNoteIds, setImportedNoteIds] = useState([]);

  // Sync page from URL when user uses browser back/forward
  React.useEffect(() => {
    const onPop = () => setPage(idForPath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const allTags = useMemo(() => {
    const s = new Set(DEFAULT_TAGS);
    [...notes, ...flashcards].forEach(x => x.tags?.forEach(t => s.add(t)));
    return Array.from(s);
  }, [notes, flashcards]);

  const pendingHw = homework.filter(h => h.status === 'pending').length;
  const dueCards  = flashcards.filter(c => !c.completed && (!c.nextReview || new Date(c.nextReview) <= new Date())).length;
  const openQuestions = questions.filter(q => q.status !== 'resolved').length;

  const [userName, setUserNameState] = React.useState(() => localStorage.getItem('jp_userName') || '');

  // Load settings from Firestore on login so they work on any device
  React.useEffect(() => {
    fbDb.collection('users').doc(user.uid).get().then(doc => {
      if (!doc.exists) return;
      const d = doc.data();
      if (d.geminiApiKey !== undefined) localStorage.setItem('gemini_api_key', d.geminiApiKey);
      if (d.googleTtsKey !== undefined) localStorage.setItem('google_tts_key', d.googleTtsKey);
      if (d.storageLimit  !== undefined) localStorage.setItem('jp_storageLimit', String(d.storageLimit));
      if (d.userName      !== undefined) { localStorage.setItem('jp_userName', d.userName); setUserNameState(d.userName); }
    }).catch(() => {});
  }, [user.uid]);

  // Sync userName when navigating to settings and back
  React.useEffect(() => {
    const onStorage = () => setUserNameState(localStorage.getItem('jp_userName') || '');
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Re-read userName whenever the page changes (in case user saved name in Settings)
  React.useEffect(() => {
    setUserNameState(localStorage.getItem('jp_userName') || '');
  }, [page]);

  // One-time migration: convert legacy vocab items to flashcards
  React.useEffect(() => {
    if (vocab.length > 0 && localStorage.getItem('vocabMigrated') !== 'true') {
      const newCards = vocab.map(v => ({
        id: genId(),
        front: v.japanese + (v.hiragana ? ` (${v.hiragana})` : ''),
        back: [v.chinese, v.english].filter(Boolean).join(' / ') + (v.example ? `\n\n例：${v.example}` : ''),
        tags: v.tags || [],
        nextReview: new Date().toISOString(),
        createdAt: v.createdAt || new Date().toISOString(),
      }));
      setFlash(prev => [...prev, ...newCards]);
      setVocab([]);
      localStorage.setItem('vocabMigrated', 'true');
    }
  }, [vocab.length]);

  const nav = (id, ctx = null) => {
    setPage(id);
    setNavCtx(ctx);
    setSideOpen(false);
    const target = pathForId(id);
    if (window.location.pathname !== target) {
      window.history.pushState({}, '', target);
    }
  };
  const clearNavCtx = () => setNavCtx(null);

  const SideNav = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🇯🇵</span>
          <div>
            <p className="font-bold text-gray-800 text-sm leading-tight">日语学习助手</p>
            <p className="text-xs text-gray-400">Japanese Learning Hub</p>
          </div>
        </div>
        {userName && <p className="text-xs text-indigo-500 mt-2 font-medium">你好，{userName}！</p>}
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {PAGES.map(p => (
          <button key={p.id} onClick={() => nav(p.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${page===p.id ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}>
            <span>{p.icon}</span>
            <span className="flex-1 text-left">{p.label}</span>
            {p.id==='homework' && pendingHw > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${page===p.id?'bg-white text-indigo-600':'bg-red-500 text-white'}`}>{pendingHw}</span>}
            {p.id==='flashcards' && dueCards > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${page===p.id?'bg-white text-indigo-600':'bg-amber-500 text-white'}`}>{dueCards}</span>}
            {p.id==='questions' && openQuestions > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${page===p.id?'bg-white text-indigo-600':'bg-purple-500 text-white'}`}>{openQuestions}</span>}
          </button>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-gray-100 space-y-1">
        <p className="text-xs text-gray-400 truncate text-center">{user.email}</p>
        <button onClick={() => fbAuth.signOut()} className="w-full text-xs text-gray-300 hover:text-red-400 transition-colors text-center">退出登录</button>
      </div>
    </div>
  );

  const curPage = PAGES.find(p => p.id === page);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {sideOpen && <div className="fixed inset-0 bg-black/30 z-20 md:hidden" onClick={() => setSideOpen(false)} />}

      {/* Sidebar */}
      <div className={`fixed md:static z-30 h-full w-60 bg-white border-r border-gray-100 transition-transform duration-300 ${sideOpen?'translate-x-0':'-translate-x-full md:translate-x-0'} shrink-0`}>
        <SideNav />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 shrink-0">
          <button onClick={() => setSideOpen(true)} className="text-gray-500 text-lg">☰</button>
          <span className="font-semibold text-gray-700 text-sm">{curPage?.icon} {curPage?.label}</span>
        </div>

        {!isOnline && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-700 flex items-center gap-2 shrink-0">
            <span>📴</span> 当前离线 — 所有改动已保存本地，联网后自动同步
          </div>
        )}
        <StorageBanner />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {page==='dashboard'  && <Dashboard notes={notes} homework={homework} flashcards={flashcards} questions={questions} onNav={nav} userName={userName} />}
          {page==='knowledge'  && <KnowledgeBase notes={notes} setNotes={setNotes} allTags={allTags} uid={user.uid} isOnline={isOnline} importedNoteIds={importedNoteIds} setImportedNoteIds={setImportedNoteIds} setCards={setFlash} cards={flashcards} setPage={nav} onNav={nav} navCtx={navCtx} clearNavCtx={clearNavCtx} />}
          {page==='flashcards' && <Flashcards cards={flashcards} setCards={setFlash} allTags={allTags} onNav={nav} notes={notes} navCtx={navCtx} clearNavCtx={clearNavCtx} />}
          {page==='homework'   && <HomeworkTracker homework={homework} setHomework={setHomework} uid={user.uid} isOnline={isOnline} templates={taskTemplates} setTemplates={setTaskTemplates} />}
          {page==='questions'  && <QuestionsView questions={questions} setQuestions={setQuestions} />}
          {page==='resources'  && <ResourcesView resources={resources} setResources={setResources} uid={user.uid} isOnline={isOnline} />}
          {page==='pdf'        && <PDFImport setNotes={setNotes} setFlashcards={setFlash} uid={user.uid} isOnline={isOnline} notes={notes} flashcards={flashcards} setPage={nav} setImportedNoteIds={setImportedNoteIds} />}
          {page==='ai'         && <AIPractice notes={notes} allTags={allTags} setPage={nav} navCtx={navCtx} clearNavCtx={clearNavCtx} />}
          {page==='tts'        && <TextToSpeech setPage={nav} />}
          {page==='settings'   && <Settings uid={user.uid} />}
        </main>
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthGate>{user => <App user={user} />}</AuthGate>
);
