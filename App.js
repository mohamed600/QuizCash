import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QUESTIONS } from './data/questions';

// ---------- CONFIG ----------
const RATE = 0.05; // points -> DH
const SESSION_SIZE = 10; // questions per quiz session
const STORAGE_KEY = 'quizcash_state_v1';

const CATEGORIES = [
  { id: 'all', fr: 'Tous', ar: 'الكل', icon: '🎯' },
  { id: 'religion', fr: 'Religion', ar: 'دين', icon: '🕌' },
  { id: 'culture', fr: 'Culture', ar: 'ثقافة', icon: '🎨' },
  { id: 'sport', fr: 'Sport', ar: 'رياضة', icon: '⚽' },
  { id: 'general', fr: 'Général', ar: 'عام', icon: '🧠' },
];

const COLORS = {
  bg1: '#150a2e',
  bg2: '#1e0f3d',
  bg3: '#0f0520',
  card: '#241246',
  purple: '#a78bfa',
  green: '#22c55e',
  red: '#ef4444',
  gold: '#f59e0b',
  text: '#ffffff',
  sub: '#b3a7d6',
};

const defaultState = () => ({
  pts: 0,
  games: 0,
  streak: 0,
  bestStreak: 0,
  perfect: 0,
  askedIds: [], // ids already used, reset when pool exhausted
  lang: 'fr',
});

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build a session: pick SESSION_SIZE unseen questions (random order),
// resetting the "seen" cycle only when the pool is exhausted.
function buildSession(categoryId, askedIds) {
  const pool =
    categoryId === 'all'
      ? QUESTIONS
      : QUESTIONS.filter((q) => q.cat === categoryId);

  let available = pool.filter((q) => !askedIds.includes(q.id));
  let nextAsked = askedIds;

  if (available.length < Math.min(SESSION_SIZE, pool.length)) {
    // cycle exhausted for this category pool -> reset only ids from this pool
    const poolIds = pool.map((q) => q.id);
    nextAsked = askedIds.filter((id) => !poolIds.includes(id));
    available = pool;
  }

  const picked = shuffle(available).slice(0, Math.min(SESSION_SIZE, pool.length));

  // shuffle each question's answer order too, so correct index isn't static
  const session = picked.map((q) => {
    const choicesFr = q.cf.map((text, idx) => ({ text, arText: q.ca[idx], correct: idx === q.a }));
    const shuffledChoices = shuffle(choicesFr);
    return {
      id: q.id,
      cat: q.cat,
      fr: q.fr,
      ar: q.ar,
      choices: shuffledChoices,
    };
  });

  return { session, nextAsked: [...nextAsked, ...picked.map((q) => q.id)] };
}

export default function App() {
  const [screen, setScreen] = useState('home'); // home | quiz | result | achievements
  const [state, setState] = useState(defaultState());
  const [loaded, setLoaded] = useState(false);

  const [session, setSession] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [activeCat, setActiveCat] = useState('all');

  // load persisted state
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setState({ ...defaultState(), ...JSON.parse(raw) });
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  // persist on change
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, loaded]);

  const isAr = state.lang === 'ar';
  const t = (fr, ar) => (isAr ? ar : fr);

  const startQuiz = useCallback(
    (catId) => {
      const { session: s, nextAsked } = buildSession(catId, state.askedIds);
      setActiveCat(catId);
      setSession(s);
      setQIndex(0);
      setSelected(null);
      setSessionCorrect(0);
      setState((prev) => ({ ...prev, askedIds: nextAsked }));
      setScreen('quiz');
    },
    [state.askedIds]
  );

  const answer = (choice) => {
    if (selected) return;
    setSelected(choice);
    if (choice.correct) {
      setSessionCorrect((c) => c + 1);
    }
  };

  const next = () => {
    if (qIndex + 1 < session.length) {
      setQIndex((i) => i + 1);
      setSelected(null);
    } else {
      finishSession();
    }
  };

  const finishSession = () => {
    const total = session.length;
    const earnedPts = sessionCorrect * 10;
    const perfect = sessionCorrect === total;
    setState((prev) => {
      const newStreak = sessionCorrect > 0 ? prev.streak + 1 : 0;
      return {
        ...prev,
        pts: prev.pts + earnedPts,
        games: prev.games + 1,
        streak: newStreak,
        bestStreak: Math.max(prev.bestStreak, newStreak),
        perfect: prev.perfect + (perfect ? 1 : 0),
      };
    });
    setScreen('result');
  };

  const toggleLang = () => setState((s) => ({ ...s, lang: s.lang === 'fr' ? 'ar' : 'fr' }));

  if (!loaded) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>Quiz Cash 💰</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg3} />

      {screen === 'home' && (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Quiz Cash 💰</Text>
            <TouchableOpacity style={styles.langBtn} onPress={toggleLang}>
              <Text style={styles.langBtnText}>{isAr ? 'FR' : 'AR'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{state.pts}</Text>
              <Text style={styles.statLabel}>{t('Points', 'نقطة')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: COLORS.gold }]}>
                {(state.pts * RATE).toFixed(2)} DH
              </Text>
              <Text style={styles.statLabel}>{t('Cash', 'رصيد')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>🔥 {state.streak}</Text>
              <Text style={styles.statLabel}>{t('Série', 'سلسلة')}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>{t('Choisir une catégorie', 'اختر فئة')}</Text>
          {CATEGORIES.map((c) => (
            <TouchableOpacity key={c.id} style={styles.catCard} onPress={() => startQuiz(c.id)}>
              <Text style={styles.catIcon}>{c.icon}</Text>
              <Text style={styles.catText}>{t(c.fr, c.ar)}</Text>
              <Text style={styles.catArrow}>›</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setScreen('achievements')}>
            <Text style={styles.secondaryBtnText}>🏆 {t('Succès', 'الإنجازات')}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {screen === 'quiz' && session.length > 0 && (
        <View style={styles.scroll}>
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>
              {qIndex + 1} / {session.length}
            </Text>
            <Text style={styles.progressText}>✅ {sessionCorrect}</Text>
          </View>

          <View style={styles.questionCard}>
            <Text style={styles.questionText}>
              {t(session[qIndex].fr, session[qIndex].ar)}
            </Text>
          </View>

          <View>
            {session[qIndex].choices.map((c, idx) => {
              const isSelected = selected === c;
              const showCorrect = selected && c.correct;
              const showWrong = isSelected && !c.correct;
              return (
                <TouchableOpacity
                  key={idx}
                  disabled={!!selected}
                  style={[
                    styles.choiceBtn,
                    showCorrect && styles.choiceCorrect,
                    showWrong && styles.choiceWrong,
                  ]}
                  onPress={() => answer(c)}
                >
                  <Text style={styles.choiceText}>{t(c.text, c.arText)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selected && (
            <TouchableOpacity style={styles.nextBtn} onPress={next}>
              <Text style={styles.nextBtnText}>
                {qIndex + 1 < session.length ? t('Suivant', 'التالي') : t('Terminer', 'إنهاء')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {screen === 'result' && (
        <View style={styles.center}>
          <Text style={styles.resultEmoji}>
            {sessionCorrect === session.length ? '🏆' : sessionCorrect > session.length / 2 ? '🎉' : '💪'}
          </Text>
          <Text style={styles.resultScore}>
            {sessionCorrect} / {session.length}
          </Text>
          <Text style={styles.resultSub}>
            + {sessionCorrect * 10} {t('points', 'نقطة')} (
            {(sessionCorrect * 10 * RATE).toFixed(2)} DH)
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setScreen('home')}>
            <Text style={styles.primaryBtnText}>{t('Retour', 'رجوع')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {screen === 'achievements' && (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>🏆 {t('Succès', 'الإنجازات')}</Text>
          </View>
          <View style={styles.achRow}>
            <Text style={styles.achLabel}>{t('Parties jouées', 'الألعاب الملعوبة')}</Text>
            <Text style={styles.achValue}>{state.games}</Text>
          </View>
          <View style={styles.achRow}>
            <Text style={styles.achLabel}>{t('Meilleure série', 'أفضل سلسلة')}</Text>
            <Text style={styles.achValue}>{state.bestStreak}</Text>
          </View>
          <View style={styles.achRow}>
            <Text style={styles.achLabel}>{t('Quiz parfaits', 'كويزات مثالية')}</Text>
            <Text style={styles.achValue}>{state.perfect}</Text>
          </View>
          <View style={styles.achRow}>
            <Text style={styles.achLabel}>{t('Total points', 'مجموع النقاط')}</Text>
            <Text style={styles.achValue}>{state.pts}</Text>
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setScreen('home')}>
            <Text style={styles.primaryBtnText}>{t('Retour', 'رجوع')}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg3 },
  center: { flex: 1, backgroundColor: COLORS.bg3, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scroll: { padding: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  langBtn: { backgroundColor: COLORS.card, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  langBtnText: { color: COLORS.purple, fontWeight: '700' },
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 24,
  },
  statItem: { alignItems: 'center' },
  statValue: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  statLabel: { color: COLORS.sub, fontSize: 12, marginTop: 4 },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  catCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  catIcon: { fontSize: 26, marginRight: 14 },
  catText: { flex: 1, color: COLORS.text, fontSize: 16, fontWeight: '600' },
  catArrow: { color: COLORS.sub, fontSize: 22 },
  secondaryBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.purple,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  secondaryBtnText: { color: COLORS.purple, fontWeight: '700' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  progressText: { color: COLORS.sub, fontWeight: '700' },
  questionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 22,
    marginBottom: 22,
    minHeight: 100,
    justifyContent: 'center',
  },
  questionText: { color: COLORS.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  choiceBtn: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  choiceCorrect: { borderColor: COLORS.green, backgroundColor: '#16341f' },
  choiceWrong: { borderColor: COLORS.red, backgroundColor: '#3a1414' },
  choiceText: { color: COLORS.text, fontSize: 15, textAlign: 'center' },
  nextBtn: { backgroundColor: COLORS.purple, borderRadius: 14, padding: 16, marginTop: 8 },
  nextBtnText: { color: '#150a2e', fontWeight: '800', textAlign: 'center', fontSize: 16 },
  resultEmoji: { fontSize: 60, marginBottom: 12 },
  resultScore: { fontSize: 34, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  resultSub: { fontSize: 16, color: COLORS.gold, marginBottom: 28 },
  primaryBtn: { backgroundColor: COLORS.purple, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40 },
  primaryBtnText: { color: '#150a2e', fontWeight: '800', fontSize: 16 },
  achRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  achLabel: { color: COLORS.sub, fontSize: 14 },
  achValue: { color: COLORS.text, fontWeight: '800', fontSize: 16 },
});
