// ─── AUTH GATE ────────────────────────────────────────────────────────────────
const AuthGate = ({ children }) => {
  const [user, setUser] = useState(undefined); // undefined = loading

  useEffect(() => fbAuth.onAuthStateChanged(u => setUser(u ?? null)), []);

  const signIn = async () => {
    try { await fbAuth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
    catch (e) { alert('登录失败：' + e.message); }
  };

  if (user === undefined) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );

  if (!user) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 gap-5">
      <span className="text-5xl">🇯🇵</span>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">日语学习助手</h1>
        <p className="text-gray-400 text-sm">登录后，数据将在所有设备实时同步</p>
      </div>
      <button onClick={signIn}
        className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-6 py-3 shadow-sm hover:shadow-md transition-shadow text-gray-700 font-medium">
        <img src="https://www.google.com/favicon.ico" className="w-4 h-4" />
        使用 Google 账号登录
      </button>
    </div>
  );

  return children(user);
};
