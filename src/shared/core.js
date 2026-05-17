const { useState, useEffect, useCallback, useMemo, useRef } = React;

// ─── UTILITIES ────────────────────────────────────────────────────────────────
const genId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// ─── GEMINI API ───────────────────────────────────────────────────────────────
async function callGemini(prompt) {
  const apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey) throw new Error('NO_KEY');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'API_ERROR');
  }
  const data = await res.json();
  const parts = data.candidates[0].content.parts;
  return parts.filter(p => !p.thought).map(p => p.text || '').join('');
}

// ─── FIREBASE SETUP ───────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA3lZwqbGQKLyaxR5ws4XZ8LfRDcvVTLhI",
  authDomain: "japaneseclass-8006f.firebaseapp.com",
  projectId: "japaneseclass-8006f",
  storageBucket: "japaneseclass-8006f.firebasestorage.app",
  messagingSenderId: "1078077570587",
  appId: "1:1078077570587:web:b7dc0e96fb8bf55a7b82be"
};
firebase.initializeApp(FIREBASE_CONFIG);
const fbAuth    = firebase.auth();
const fbDb      = firebase.firestore();
const fbStorage = firebase.storage();
if (typeof fbDb.enableIndexedDbPersistence === 'function') {
  fbDb.enableIndexedDbPersistence().catch(err => {
    if (err.code !== 'failed-precondition' && err.code !== 'unimplemented')
      console.warn('Firestore persistence error:', err);
  });
}

// ─── FIRESTORE COLLECTION HOOK ────────────────────────────────────────────────
// Drop-in replacement for useLocalStorage — syncs to Firestore in real time.
// Uses localStorage as initial cache so the UI loads instantly.
const useFirestoreCollection = (collectionName, uid) => {
  const lsKey = `jp_${collectionName}`;
  const [data, setDataLocal] = useState(() => {
    try { const s = localStorage.getItem(lsKey); return s ? JSON.parse(s) : []; }
    catch { return []; }
  });

  useEffect(() => {
    if (!uid) return;
    const colRef = fbDb.collection('users').doc(uid).collection(collectionName);
    let unsub;
    const subscribe = () => {
      if (unsub) unsub();
      unsub = colRef.onSnapshot(snap => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setDataLocal(items);
        try { localStorage.setItem(lsKey, JSON.stringify(items)); } catch {}
      }, err => {
        if (err.code === 'permission-denied') {
          console.warn(`[Firestore] permission-denied on ${collectionName} — check security rules`);
        } else {
          console.error(`[Firestore] snapshot error on ${collectionName}:`, err);
        }
      });
    };
    subscribe();
    const handleVisibility = () => { if (document.visibilityState === 'visible') subscribe(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { if (unsub) unsub(); document.removeEventListener('visibilitychange', handleVisibility); };
  }, [uid, collectionName]);

  const setData = useCallback((updater) => {
    if (!uid) return;
    setDataLocal(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const colRef = fbDb.collection('users').doc(uid).collection(collectionName);
      const prevMap = new Map(prev.map(i => [i.id, i]));
      const nextMap = new Map(next.map(i => [i.id, i]));
      for (const [id] of prevMap)
        if (!nextMap.has(id)) colRef.doc(id).delete().catch(console.error);
      for (const [id, item] of nextMap) {
        const old = prevMap.get(id);
        if (!old || JSON.stringify(item) !== JSON.stringify(old)) {
          const { id: _, ...data } = item;
          colRef.doc(id).set(data).catch(console.error);
        }
      }
      try { localStorage.setItem(lsKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [uid, collectionName]);

  return [data, setData];
};

const useLocalStorage = (key, init) => {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init; }
    catch { return init; }
  });
  const set = useCallback(v => {
    setVal(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key]);
  return [val, set];
};

const useOnlineStatus = () => {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
};

const fmt = (iso) => iso ? new Date(iso).toLocaleDateString('zh-CN') : '—';
const isOverdue = (hw) => hw.status === 'pending' && hw.dueDate && new Date(hw.dueDate) < new Date();

let _kuroshiroPromise = null;
const getKuroshiro = () => {
  if (_kuroshiroPromise) return _kuroshiroPromise;
  _kuroshiroPromise = (async () => {
    const k = new Kuroshiro();
    await k.init(new KuromojiAnalyzer({ dictPath: 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/' }));
    return k;
  })();
  return _kuroshiroPromise;
};
const toHiragana = async (text) => {
  const k = await getKuroshiro();
  return k.convert(text, { to: 'hiragana' });
};
