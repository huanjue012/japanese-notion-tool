// ─── DASHBOARD ────────────────────────────────────────────────────────────────
const Dashboard = ({ notes, homework, flashcards, questions = [], onNav, userName }) => {
  const pending = homework.filter(h => h.status === 'pending');
  const overdue = homework.filter(isOverdue);
  const thisWeek = homework.filter(h => {
    if (h.status === 'done' || !h.dueDate) return false;
    const d = (new Date(h.dueDate) - new Date()) / 86400000;
    return d >= 0 && d <= 7;
  });
  const dueCards = flashcards.filter(c => !c.completed && (!c.nextReview || new Date(c.nextReview) <= new Date())).length;
  const openQ = questions.filter(q => q.status !== 'resolved').length;

  const stats = [
    { label: '笔记', value: notes.length, icon: '📝', grad: 'from-violet-500 to-indigo-600', page: 'knowledge' },
    { label: '闪卡', value: flashcards.length, icon: '🃏', grad: 'from-cyan-500 to-blue-600', page: 'flashcards' },
    { label: '今日复习', value: dueCards, icon: '🔔', grad: 'from-emerald-500 to-teal-600', page: 'flashcards' },
    { label: '待交功课', value: pending.length, icon: '📋', grad: 'from-orange-500 to-red-500', page: 'homework' },
    { label: '未解答疑问', value: openQ, icon: '❓', grad: 'from-fuchsia-500 to-purple-600', page: 'questions' },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{userName ? `${userName}，おはようございます！👋` : 'おはようございます！👋'}</h1>
        <p className="text-gray-400 text-sm mt-1">继续加油，你的日语学习旅程还在进行中。</p>
      </div>

      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex gap-3 cursor-pointer" onClick={() => onNav('homework')}>
          <span className="text-xl">⚠️</span>
          <div><p className="font-semibold text-red-700 text-sm">逾期功课提醒</p><p className="text-red-500 text-xs mt-0.5">你有 {overdue.length} 份功课已过截止日期，记得尽快处理！</p></div>
        </div>
      )}
      {dueCards > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex gap-3 cursor-pointer" onClick={() => onNav('flashcards')}>
          <span className="text-xl">🃏</span>
          <div><p className="font-semibold text-amber-700 text-sm">今日复习提醒</p><p className="text-amber-600 text-xs mt-0.5">有 {dueCards} 张闪卡等待复习！</p></div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {stats.map(s => (
          <div key={s.label} onClick={() => onNav(s.page)} className={`bg-gradient-to-br ${s.grad} rounded-xl p-4 text-white cursor-pointer hover:opacity-90 transition-opacity`}>
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs opacity-80 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <h2 className="font-semibold text-gray-700 mb-3 text-sm">📋 本周功课</h2>
          {thisWeek.length === 0
            ? <p className="text-gray-300 text-sm text-center py-4">本周没有截止的功课 🎉</p>
            : thisWeek.map(h => (
              <div key={h.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-sm text-gray-700 break-words flex-1 mr-2">{h.title}</span>
                <span className="text-xs text-gray-400 shrink-0">{h.dueDate}</span>
              </div>
            ))
          }
        </Card>
        <Card>
          <h2 className="font-semibold text-gray-700 mb-3 text-sm">📚 最近笔记</h2>
          {notes.length === 0
            ? <p className="text-gray-300 text-sm text-center py-4">还没有笔记，快去添加吧！</p>
            : [...notes].reverse().slice(0, 5).map(n => (
              <div key={n.id} className="py-2 border-b last:border-0">
                <p className="text-sm font-medium text-gray-700 break-words">{n.title}</p>
                <div className="flex flex-wrap gap-1 mt-1">{n.tags?.slice(0,3).map(t => <Badge key={t}>{t}</Badge>)}</div>
              </div>
            ))
          }
        </Card>
      </div>
    </div>
  );
};
