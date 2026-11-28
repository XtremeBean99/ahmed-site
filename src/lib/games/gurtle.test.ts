import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DAILY_PAR, DIFFICULTIES, DIFFICULTY_PAR, EMPTY_STATS, LAUNCH_DATE, TARGET,
  buildLexicon, checkMove, currentWord, dailyStart, diffPositions, giveUp, ladderOf, lexicon, liveStreak,
  moveTrend, newDaily, newGame, newPractice, nextStep, parseGame, parseStats, parseWordList, playMove,
  practiceStart, puzzleNumber, rateRun, recordDaily, shareGrid, solve, startPool, takeHint, tileHits, undoMove,
  type GurtleGame,
} from './gurtle'
import { COMMON_WORDS, EXTRA_WORDS } from './gurtle-words'
import { mulberry32 } from './cards'

const lex = lexicon()

/** Plays a whole route, failing the test on any refused move. */
function playAll(g: GurtleGame, words: string[]): GurtleGame {
  for (const w of words) {
    const r = playMove(lex, g, w)
    assert.equal(r.error, null, `move ${w} from ${currentWord(g)}`)
    g = r.game
  }
  return g
}

test('the word lists are clean four-letter words with no repeats', () => {
  const common = COMMON_WORDS.split(/\s+/).filter(Boolean)
  const extra = EXTRA_WORDS.split(/\s+/).filter(Boolean)
  for (const w of [...common, ...extra]) assert.match(w, /^[a-z]{4}$/, w)
  assert.equal(new Set(common).size, common.length, 'repeat in COMMON_WORDS')
  assert.equal(new Set(extra).size, extra.length, 'repeat in EXTRA_WORDS')
  assert.deepEqual(extra.filter((w) => common.includes(w)), [], 'EXTRA_WORDS repeats a common word')
  assert.ok(!common.includes(TARGET) && !extra.includes(TARGET), 'the target is added by the engine')
  assert.ok(common.length > 1500)
})

test('crude words are not in the dictionary', () => {
  for (const w of ['damn', 'hell', 'crap', 'piss', 'shit', 'fuck', 'cunt', 'twat', 'dick', 'cock', 'tits', 'arse', 'slut', 'porn', 'anal', 'wank', 'turd', 'nude', 'rape', 'nazi', 'boob', 'butt', 'pube', 'teat', 'hoes', 'dyke', 'homo', 'fags', 'pimp']) {
    assert.ok(!lex.words.has(w), w)
  }
})

test('the target sits in the graph with everyday words next to it', () => {
  assert.ok(lex.words.has(TARGET) && lex.common.has(TARGET))
  const n = lex.neighbors(TARGET)
  for (const w of ['hurt', 'curt', 'gust', 'guru', 'yurt']) assert.ok(n.includes(w), w)
  assert.equal(lex.parDist.get(TARGET), 0)
  assert.equal(lex.parDist.get('hurt'), 1)
  assert.equal(lex.parDist.get('hunt'), 2)
})

test('distances are consistent: every word has a neighbour one step closer', () => {
  for (const [w, d] of lex.parDist) {
    if (d === 0) continue
    assert.ok(lex.neighbors(w).some((n) => lex.common.has(n) && lex.parDist.get(n) === d - 1), w)
  }
  for (const [w, d] of lex.anyDist) {
    assert.ok(d <= (lex.parDist.get(w) ?? Infinity), `${w}: a rarer word never makes the route longer`)
  }
})

test('neighbors works for words outside the lexicon', () => {
  assert.ok(lex.neighbors('gxrt').includes('gurt'))
  assert.deepEqual(buildLexicon('cold cord card ward', '').neighbors('word').sort(), ['cord', 'ward'])
})

test('the solver walks a par-length everyday route from every daily start', () => {
  for (const start of startPool(lex, DAILY_PAR)) {
    const route = solve(lex, start)
    assert.equal(route.length, lex.parDist.get(start), start)
    assert.equal(route[route.length - 1], TARGET)
    let prev = start
    for (const w of route) {
      assert.equal(diffPositions(prev, w).length, 1, `${prev} > ${w}`)
      assert.ok(lex.common.has(w), `${w} in the hint for ${start} is everyday`)
      prev = w
    }
  }
})

test('nextStep is stable and prefers letters already in place', () => {
  assert.equal(nextStep(lex, TARGET), null)
  assert.equal(nextStep(lex, 'hurt'), 'gurt')
  assert.equal(nextStep(lex, 'fish'), nextStep(lex, 'fish'))
  // From a rarer word the hint still heads home.
  const fromRare = solve(lex, 'gurn')
  assert.deepEqual(fromRare, ['gurt'])
})

test('checkMove explains each refusal', () => {
  const ladder = ['fish', 'fist']
  assert.equal(checkMove(lex, ladder, 'gist'), null)
  assert.equal(checkMove(lex, ladder, 'gis'), 'length')
  assert.equal(checkMove(lex, ladder, 'gi5t'), 'length')
  assert.equal(checkMove(lex, ladder, 'gust'), 'notOneLetter')
  assert.equal(checkMove(lex, ladder, 'fist'), 'notOneLetter')
  assert.equal(checkMove(lex, ladder, 'fizt'), 'notWord')
  assert.equal(checkMove(lex, ladder, 'fish'), 'repeat')
  assert.equal(checkMove(lex, ['hurt', 'gurt'], 'hurt'), 'over')
  // Rarer words are fine as moves.
  assert.equal(checkMove(lex, ['gust'], 'gist'), null)
  assert.equal(checkMove(lex, ['hurt'], 'gurt'), null)
})

test('a game plays to a win, with undo and hints', () => {
  let g = newGame(lex, 'fish', { mode: 'practice', difficulty: 'medium' })
  assert.equal(g.par, 4)
  g = playAll(g, ['fist', 'gist'])
  assert.equal(currentWord(g), 'gist')
  g = undoMove(g)
  assert.equal(currentWord(g), 'fist')
  const h = takeHint(lex, g)
  assert.equal(h.hint, 'gist')
  assert.equal(h.game.hints, 1)
  g = playAll(h.game, ['gist', 'gust', 'gurt'])
  assert.equal(g.status, 'won')
  assert.deepEqual(ladderOf(g), ['fish', 'fist', 'gist', 'gust', 'gurt'])
  assert.equal(playMove(lex, g, 'hurt').error, 'over')
  assert.equal(undoMove(g), g, 'no undo after the win')
  assert.equal(takeHint(lex, g).hint, null)
})

test('giving up reveals the route home from the current word', () => {
  let g = newGame(lex, 'fish', { mode: 'practice' })
  g = playAll(g, ['dish'])
  g = giveUp(lex, g)
  assert.equal(g.status, 'gaveUp')
  assert.equal(g.reveal[g.reveal.length - 1], TARGET)
  assert.equal(g.reveal.length, lex.parDist.get('dish'))
  assert.equal(playMove(lex, g, 'wish').error, 'over')
})

test('moveTrend reads closer, sideways and further', () => {
  assert.equal(moveTrend(lex, 'hunt', 'hurt'), 'closer')
  assert.equal(moveTrend(lex, 'hurt', 'hunt'), 'further')
  assert.equal(moveTrend(lex, 'curt', 'hurt'), 'same')
})

test('rateRun is golf: under, par, bogey, double, then slow and steady', () => {
  assert.equal(rateRun(3, 4), 'under')
  assert.equal(rateRun(4, 4), 'par')
  assert.equal(rateRun(5, 4), 'bogey')
  assert.equal(rateRun(6, 4), 'double')
  assert.equal(rateRun(9, 4), 'slow')
})

test('tileHits and the share grid mark letters already where GURT has them', () => {
  assert.deepEqual(tileHits('gust'), [true, true, false, true])
  let g = newGame(lex, 'fish', { mode: 'daily', date: LAUNCH_DATE })
  g = playAll(g, ['fist', 'gist', 'gust', 'gurt'])
  assert.equal(shareGrid(g), ['⬜⬜⬜⬜', '⬜⬜⬜🟩', '🟩⬜⬜🟩', '🟩🟩⬜🟩', '🟩🟩🟩🟩'].join('\n'))
  const gave = giveUp(lex, playAll(newGame(lex, 'fish', { mode: 'practice' }), ['fist']))
  assert.equal(shareGrid(gave).split('\n').length, 2 + gave.reveal.length)
})

test('puzzle numbers count UTC days from launch', () => {
  assert.equal(puzzleNumber(LAUNCH_DATE), 1)
  assert.equal(puzzleNumber('2026-11-29'), 2)
  assert.equal(puzzleNumber('2027-11-28'), 366)
})

test('the daily start is stable, in range and does not repeat for months', () => {
  assert.equal(dailyStart(lex, '2026-12-03'), dailyStart(buildLexicon(), '2026-12-03'))
  const seen = new Set<string>()
  const day0 = Date.parse(`${LAUNCH_DATE}T00:00:00Z`)
  for (let i = 0; i < 365; i++) {
    const date = new Date(day0 + i * 86_400_000).toISOString().slice(0, 10)
    const s = dailyStart(lex, date)
    const par = lex.parDist.get(s)!
    assert.ok(par >= DAILY_PAR[0] && par <= DAILY_PAR[1], `${date}: ${s} par ${par}`)
    assert.ok(!seen.has(s), `${s} repeats on ${date}`)
    seen.add(s)
  }
  // Dates before launch still give a word.
  assert.match(dailyStart(lex, '2020-01-01'), /^[a-z]{4}$/)
  const d = newDaily(lex, '2026-12-03')
  assert.equal(d.mode, 'daily')
  assert.equal(d.date, '2026-12-03')
  assert.equal(d.par, lex.parDist.get(d.start))
})

test('practice starts match their length and skip the last word', () => {
  for (const diff of DIFFICULTIES) {
    const rng = mulberry32(7)
    const pool = startPool(lex, DIFFICULTY_PAR[diff])
    assert.ok(pool.length >= 30, `${diff} pool ${pool.length}`)
    for (let i = 0; i < 50; i++) {
      const s = practiceStart(lex, diff, rng)
      const par = lex.parDist.get(s)!
      assert.ok(par >= DIFFICULTY_PAR[diff][0] && par <= DIFFICULTY_PAR[diff][1])
      assert.ok(!/[^s]s$/.test(s) || /(us|is)$/.test(s), `${s} looks plural`)
    }
    const only = pool[0]
    assert.notEqual(practiceStart(lex, diff, () => 0, only), only)
    assert.equal(newPractice(lex, diff, () => 0).difficulty, diff)
  }
})

test('recordDaily counts each day once and keeps the streak', () => {
  const win = (date: string, moves: string[]): GurtleGame => playAll(newGame(lex, 'fish', { mode: 'daily', date }), moves)
  const route = ['fist', 'gist', 'gust', 'gurt']
  let s = recordDaily(EMPTY_STATS, win('2026-12-01', route))
  assert.deepEqual(s, { played: 1, won: 1, streak: 1, maxStreak: 1, lastDate: '2026-12-01', dist: [1, 0, 0, 0, 0] })
  assert.equal(recordDaily(s, win('2026-12-01', route)), s, 'the same day twice counts once')
  s = recordDaily(s, win('2026-12-02', ['fist', 'mist', 'gist', 'gust', 'gurt']))
  assert.equal(s.streak, 2)
  assert.deepEqual(s.dist, [1, 1, 0, 0, 0])
  // A skipped day restarts the streak.
  s = recordDaily(s, win('2026-12-04', route))
  assert.equal(s.streak, 1)
  assert.equal(s.maxStreak, 2)
  // Giving up ends it.
  s = recordDaily(s, giveUp(lex, newGame(lex, 'fish', { mode: 'daily', date: '2026-12-05' })))
  assert.equal(s.streak, 0)
  assert.equal(s.played, 4)
  assert.equal(s.won, 3)
  // Unfinished and practice games are not recorded.
  assert.equal(recordDaily(s, newGame(lex, 'fish', { mode: 'daily', date: '2026-12-06' })), s)
  assert.equal(recordDaily(s, playAll(newGame(lex, 'fish', { mode: 'practice' }), route)), s)
})

test('liveStreak lapses after a missed day', () => {
  const s = { ...EMPTY_STATS, streak: 5, maxStreak: 5, lastDate: '2026-12-10' }
  assert.equal(liveStreak(s, '2026-12-10'), 5)
  assert.equal(liveStreak(s, '2026-12-11'), 5)
  assert.equal(liveStreak(s, '2026-12-12'), 0)
  assert.equal(liveStreak(EMPTY_STATS, '2026-12-12'), 0)
})

test('saved games and stats are validated when read back', () => {
  let g = newGame(lex, 'fish', { mode: 'daily', date: '2026-12-01' })
  g = takeHint(lex, playAll(g, ['fist'])).game
  const back = parseGame(lex, JSON.parse(JSON.stringify(g)))
  assert.deepEqual(back, g)
  const gave = giveUp(lex, g)
  assert.deepEqual(parseGame(lex, JSON.parse(JSON.stringify(gave))), gave)
  // A broken chain, an unknown start, a daily without a date: all rejected.
  assert.equal(parseGame(lex, { ...g, moves: ['gust'] }), null)
  assert.equal(parseGame(lex, { ...g, start: 'zzzz' }), null)
  assert.equal(parseGame(lex, { ...g, date: null }), null)
  assert.equal(parseGame(lex, 'nope'), null)
  assert.deepEqual(parseStats({ played: 3, won: 2, streak: 1, maxStreak: 2, lastDate: '2026-12-01', dist: [1, 1, 0, 0, 0] }),
    { played: 3, won: 2, streak: 1, maxStreak: 2, lastDate: '2026-12-01', dist: [1, 1, 0, 0, 0] })
  assert.deepEqual(parseStats({ played: -1, dist: [1] }), EMPTY_STATS)
  assert.deepEqual(parseWordList(' Bark  b4rk fish\nGURT '), ['bark', 'fish', 'gurt'])
})
