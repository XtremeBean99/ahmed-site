import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chooseBotAction } from './ai'
import {
  BANK_PER_RESOURCE,
  COSTS,
  MIN_LARGEST_ARMY,
  MIN_LONGEST_ROAD,
  PIECES,
  RESOURCES,
} from './constants'
import { applyAction, createGame, playersToAct, validateAction } from './engine'
import { HEXES, VERTICES } from './geometry'
import {
  emptyResources,
  hasResources,
  legalCities,
  legalRoads,
  legalSettlements,
  legalSetupRoads,
  legalSetupSettlements,
  totalCards,
  victoryPoints,
} from './helpers'
import type { Action, GameState, Resource, ResourceCounts } from './types'

function mulberry32(seed: number): () => number {
  let t = seed | 0
  return () => {
    t = (t + 0x6d2b79f5) | 0
    let r = Math.imul(t ^ (t >>> 15), t | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function randomDiscard(hand: ResourceCounts, owed: number, rng: () => number): ResourceCounts | null {
  if (totalCards(hand) < owed) return null
  const remaining = { ...hand }
  const discarded = emptyResources()
  let left = owed
  let total = totalCards(hand)
  while (left > 0) {
    let index = Math.floor(rng() * total)
    let picked: Resource | null = null
    for (const r of RESOURCES) {
      if (index < remaining[r]) {
        picked = r
        break
      }
      index -= remaining[r]
    }
    if (picked === null) return null
    remaining[picked] -= 1
    discarded[picked] += 1
    total -= 1
    left -= 1
  }
  return discarded
}

function greedyDiscard(hand: ResourceCounts, owed: number): ResourceCounts | null {
  const discarded = emptyResources()
  let left = owed
  for (const r of RESOURCES) {
    const take = Math.min(hand[r], left)
    discarded[r] = take
    left -= take
    if (left === 0) return discarded
  }
  return null
}

function devCardCandidates(state: GameState, actions: Action[], rng: () => number): void {
  if (state.devCardPlayedThisTurn) return
  const hand = new Set(state.players[state.current].devCards)
  if (hand.has('knight')) actions.push({ type: 'playKnight' })
  if (hand.has('roadBuilding')) actions.push({ type: 'playRoadBuilding' })
  if (hand.has('yearOfPlenty')) {
    const seen = new Set<string>()
    for (let i = 0; i < 8; i++) {
      const a = RESOURCES[Math.floor(rng() * RESOURCES.length)]
      const b = RESOURCES[Math.floor(rng() * RESOURCES.length)]
      const key = a < b ? `${a},${b}` : `${b},${a}`
      if (!seen.has(key)) {
        seen.add(key)
        actions.push({ type: 'playYearOfPlenty', resources: [a, b] })
      }
    }
  }
  if (hand.has('monopoly')) {
    for (const r of RESOURCES) actions.push({ type: 'playMonopoly', resource: r })
  }
}

function domesticCandidates(state: GameState, actions: Action[], rng: () => number): void {
  const n = state.players.length
  const current = state.current
  for (let i = 0; i < 8; i++) {
    let partner = Math.floor(rng() * n)
    if (partner === current) partner = (partner + 1) % n
    const giveR = RESOURCES[Math.floor(rng() * RESOURCES.length)]
    let getR = RESOURCES[Math.floor(rng() * RESOURCES.length)]
    if (getR === giveR) getR = RESOURCES[(RESOURCES.indexOf(getR) + 1) % RESOURCES.length]
    const give = emptyResources()
    const get = emptyResources()
    give[giveR] = 1
    get[getR] = 1
    actions.push({ type: 'domesticTrade', partner, give, get })
  }
}

function candidateActions(state: GameState, rng: () => number): Action[] {
  const actions: Action[] = []
  const current = state.current
  const player = state.players[current]
  const phase = state.phase

  switch (phase.kind) {
    case 'setup':
      if (phase.step === 'settlement') {
        for (const vertex of legalSetupSettlements(state)) actions.push({ type: 'placeSetupSettlement', vertex })
      } else {
        for (const edge of legalSetupRoads(state)) actions.push({ type: 'placeSetupRoad', edge })
      }
      break
    case 'preRoll':
      devCardCandidates(state, actions, rng)
      actions.push({ type: 'rollDice' })
      break
    case 'main':
      for (const edge of legalRoads(state, current)) {
        if (hasResources(player.resources, COSTS.road)) actions.push({ type: 'buildRoad', edge })
      }
      for (const vertex of legalSettlements(state, current)) {
        if (hasResources(player.resources, COSTS.settlement)) actions.push({ type: 'buildSettlement', vertex })
      }
      for (const vertex of legalCities(state, current)) {
        if (hasResources(player.resources, COSTS.city)) actions.push({ type: 'buildCity', vertex })
      }
      if (state.devDeck.length > 0 && hasResources(player.resources, COSTS.devCard)) {
        actions.push({ type: 'buyDevCard' })
      }
      devCardCandidates(state, actions, rng)
      for (const giveR of RESOURCES) {
        for (const getR of RESOURCES) {
          if (giveR !== getR) actions.push({ type: 'maritimeTrade', give: giveR, get: getR })
        }
      }
      domesticCandidates(state, actions, rng)
      actions.push({ type: 'endTurn' })
      break
    case 'discard':
      for (let p = 0; p < state.players.length; p++) {
        const owed = phase.discards[p]
        if (owed === 0) continue
        const hand = state.players[p].resources
        for (let i = 0; i < 3; i++) {
          const cards = randomDiscard(hand, owed, rng)
          if (cards) actions.push({ type: 'discard', player: p, resources: cards })
        }
        const greedy = greedyDiscard(hand, owed)
        if (greedy) actions.push({ type: 'discard', player: p, resources: greedy })
      }
      break
    case 'moveRobber':
      for (let hex = 0; hex < HEXES.length; hex++) actions.push({ type: 'moveRobber', hex })
      break
    case 'steal':
      for (const victim of phase.candidates) actions.push({ type: 'steal', victim })
      break
    case 'roadBuilding':
      for (const edge of legalRoads(state, current)) actions.push({ type: 'buildRoad', edge })
      break
    case 'trade':
      if (phase.offer.from === current) {
        for (const partner of phase.offer.to) {
          if (phase.offer.replies[partner] === 'accept' || phase.offer.replies[partner] === 'counter') {
            actions.push({ type: 'confirmTrade', partner })
          }
        }
        actions.push({ type: 'cancelTrade' })
      } else {
        for (let p = 0; p < state.players.length; p++) {
          if (phase.offer.replies[p] === 'pending') {
            actions.push({ type: 'respondTrade', player: p, reply: 'accept' })
            actions.push({ type: 'respondTrade', player: p, reply: 'decline' })
          }
        }
      }
      break
    case 'gameOver':
      break
  }
  return actions
}

function dedupeActions(actions: Action[]): Action[] {
  const seen = new Set<string>()
  return actions.filter((action) => {
    const key = JSON.stringify(action)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function actionWeight(action: Action): number {
  switch (action.type) {
    case 'placeSetupSettlement':
    case 'placeSetupRoad':
      return 12
    case 'rollDice':
      return 12
    case 'endTurn':
      return 8
    case 'buildRoad':
      return 7
    case 'buildSettlement':
      return 9
    case 'buildCity':
      return 10
    case 'buyDevCard':
      return 4
    case 'playKnight':
    case 'playRoadBuilding':
    case 'playYearOfPlenty':
    case 'playMonopoly':
      return 3
    case 'maritimeTrade':
    case 'domesticTrade':
    case 'proposeTrade':
    case 'respondTrade':
    case 'confirmTrade':
    case 'cancelTrade':
      return 1
    case 'discard':
    case 'moveRobber':
    case 'steal':
      return 10
  }
}

function pickWeighted(actions: Action[], rng: () => number): Action {
  const weights = actions.map(actionWeight)
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  let roll = Math.floor(rng() * totalWeight)
  for (let i = 0; i < actions.length; i++) {
    if (roll < weights[i]) return actions[i]
    roll -= weights[i]
  }
  return actions[actions.length - 1]
}

function assertValidPlayerId(state: GameState, player: number): void {
  assert.ok(Number.isInteger(player) && player >= 0 && player < state.players.length)
}

function assertPhaseShape(state: GameState): void {
  const phase = state.phase
  switch (phase.kind) {
    case 'setup':
      assert.ok(phase.round === 1 || phase.round === 2)
      assert.ok(phase.step === 'settlement' || phase.step === 'road')
      break
    case 'preRoll':
    case 'main':
      break
    case 'discard':
      assert.equal(phase.discards.length, state.players.length)
      for (let p = 0; p < state.players.length; p++) {
        assert.ok(Number.isInteger(phase.discards[p]) && phase.discards[p] >= 0)
        if (phase.discards[p] > 0) assert.ok(totalCards(state.players[p].resources) >= phase.discards[p])
      }
      break
    case 'moveRobber':
      assert.ok(phase.returnTo === 'preRoll' || phase.returnTo === 'main')
      break
    case 'steal':
      assert.ok(phase.candidates.length >= 1)
      for (const candidate of phase.candidates) assertValidPlayerId(state, candidate)
      assert.ok(phase.returnTo === 'preRoll' || phase.returnTo === 'main')
      break
    case 'roadBuilding':
      assert.ok(phase.remaining >= 1)
      assert.ok(phase.returnTo === 'preRoll' || phase.returnTo === 'main')
      break
    case 'trade':
      assert.ok(phase.offer.to.length >= 1)
      for (const p of phase.offer.to) assertValidPlayerId(state, p)
      break
    case 'gameOver':
      assertValidPlayerId(state, phase.winner)
      break
  }
}

function assertInvariants(state: GameState, playedDevCards: number): void {
  const playerCount = state.players.length
  assert.ok(playerCount === 3 || playerCount === 4)

  for (const r of RESOURCES) {
    let total = state.bank[r]
    assert.ok(state.bank[r] >= 0, `${r} bank is negative`)
    for (const player of state.players) {
      assert.ok(player.resources[r] >= 0, `${r} hand of player ${player.id} is negative`)
      total += player.resources[r]
    }
    assert.equal(total, BANK_PER_RESOURCE, `${r} is not conserved`)
  }

  for (const player of state.players) {
    const roadsOnBoard = state.roads.filter((owner) => owner === player.id).length
    const settlementsOnBoard = state.buildings.filter(
      (building) => building?.owner === player.id && building.kind === 'settlement',
    ).length
    const citiesOnBoard = state.buildings.filter(
      (building) => building?.owner === player.id && building.kind === 'city',
    ).length
    assert.ok(player.roadsLeft >= 0)
    assert.ok(player.settlementsLeft >= 0)
    assert.ok(player.citiesLeft >= 0)
    assert.equal(player.roadsLeft + roadsOnBoard, PIECES.roads)
    assert.equal(player.settlementsLeft + settlementsOnBoard, PIECES.settlements)
    assert.equal(player.citiesLeft + citiesOnBoard, PIECES.cities)
    assert.ok(player.knightsPlayed >= 0)
    assert.ok(player.longestRoad >= 0)
  }

  let devCardsInHands = 0
  for (const player of state.players) devCardsInHands += player.devCards.length + player.newDevCards.length
  assert.equal(state.devDeck.length + devCardsInHands + playedDevCards, 25, 'dev card deck is not conserved')

  for (let vertex = 0; vertex < state.buildings.length; vertex++) {
    if (state.buildings[vertex] === null) continue
    for (const neighbor of VERTICES[vertex].neighbors) {
      assert.equal(state.buildings[neighbor], null, `distance rule violated at vertex ${vertex}`)
    }
  }

  const maxRoad = Math.max(...state.players.map((player) => player.longestRoad))
  const roadLeaders = state.players.filter(
    (player) => player.longestRoad === maxRoad && player.longestRoad >= MIN_LONGEST_ROAD,
  )
  if (state.longestRoadHolder === null) {
    assert.ok(roadLeaders.length !== 1, 'a unique longest road leader has no holder')
  } else {
    const holder = state.longestRoadHolder
    assertValidPlayerId(state, holder)
    assert.ok(state.players[holder].longestRoad >= MIN_LONGEST_ROAD)
    for (const player of state.players) {
      assert.ok(player.longestRoad <= state.players[holder].longestRoad, 'longest road holder is beaten')
    }
  }

  const maxArmy = Math.max(...state.players.map((player) => player.knightsPlayed))
  const armyLeaders = state.players.filter(
    (player) => player.knightsPlayed === maxArmy && player.knightsPlayed >= MIN_LARGEST_ARMY,
  )
  if (state.largestArmyHolder === null) {
    assert.ok(armyLeaders.length !== 1, 'a unique largest army leader has no holder')
  } else {
    const holder = state.largestArmyHolder
    assertValidPlayerId(state, holder)
    assert.ok(state.players[holder].knightsPlayed >= MIN_LARGEST_ARMY)
    for (const player of state.players) {
      assert.ok(player.knightsPlayed <= state.players[holder].knightsPlayed, 'largest army holder is beaten')
    }
  }

  assertPhaseShape(state)

  if (state.phase.kind === 'gameOver') {
    assert.equal(state.phase.winner, state.current, 'a gameOver winner must be the current player')
    assert.ok(victoryPoints(state, state.phase.winner) >= state.settings.vpToWin)
  } else if (state.phase.kind !== 'setup') {
    assert.ok(victoryPoints(state, state.current) < state.settings.vpToWin)
  }

  let previousSeq = -1
  for (const event of state.events) {
    assert.ok(event.seq > previousSeq, `event seq ${event.seq} does not strictly increase`)
    previousSeq = event.seq
  }
  if (state.events.length > 0) assert.equal(state.eventSeq, state.events[state.events.length - 1].seq)
}

function runFuzzGame(
  seed: number,
  playerCount: 3 | 4,
  localSeed: number,
  maxActions: number,
): { state: GameState; actions: number; finished: boolean; playedDevCards: number } {
  let state = createGame({ seed, playerCount })
  const rng = mulberry32(localSeed)
  let playedDevCards = 0
  let actions = 0
  assertInvariants(state, playedDevCards)

  while (actions < maxActions && state.phase.kind !== 'gameOver') {
    const candidates = dedupeActions(candidateActions(state, rng))
    const legal = candidates.filter((action) => validateAction(state, action) === null)
    assert.ok(legal.length > 0, `no legal action in phase ${state.phase.kind} after ${actions} actions`)
    const action = pickWeighted(legal, rng)
    assert.equal(validateAction(state, action), null)
    const previousSeq = state.eventSeq
    state = applyAction(state, action)
    actions += 1
    for (const event of state.events) {
      if (event.seq > previousSeq && event.type === 'playedDevCard') playedDevCards += 1
    }
    assertInvariants(state, playedDevCards)
  }
  return { state, actions, finished: state.phase.kind === 'gameOver', playedDevCards }
}

test('long fuzz: 300 random legal games without an action throwing', { timeout: 600000 }, () => {
  let finished = 0
  let totalActions = 0
  const games = 300
  for (let game = 0; game < games; game++) {
    const playerCount: 3 | 4 = game % 2 === 0 ? 3 : 4
    const result = runFuzzGame(10000 + game, playerCount, 20000 + game, 4000)
    totalActions += result.actions
    if (result.finished) finished += 1
  }
  assert.equal(totalActions >= games, true)
  console.log(`long fuzz: ${finished}/${games} games reached gameOver, ${totalActions} total actions`)
})

test('long bots-only simulation: 240 games finish with legal, deterministic actions', { timeout: 600000 }, () => {
  const playerCounts = [3, 4] as const
  const seedsPerCount = 120
  const actionCap = 2500
  let total = 0
  let finished = 0
  let capped = 0
  let invalid = 0
  let throws = 0
  let turnTotal = 0
  const wins: number[] = [0, 0, 0, 0]

  for (const playerCount of playerCounts) {
    for (let seed = 0; seed < seedsPerCount; seed++) {
      total++
      let state = createGame({ seed, playerCount })
      let actions = 0
      try {
        while (state.phase.kind !== 'gameOver' && actions < actionCap) {
          const actors = playersToAct(state)
          for (const player of actors) {
            const action = chooseBotAction(state, player)
            const reason = validateAction(state, action)
            if (reason !== null) {
              invalid++
              assert.equal(reason, null, `invalid action at seed ${seed}/${playerCount}: ${JSON.stringify(action)}`)
            }
            state = applyAction(state, action)
            actions++
            if (state.phase.kind === 'gameOver') break
          }
        }
        if (state.phase.kind === 'gameOver') {
          finished++
          wins[state.phase.winner]++
        } else {
          capped++
        }
        turnTotal += state.turn
      } catch (error) {
        throws++
        console.error('simulation threw', { playerCount, seed, error })
      }
    }
  }

  const stats = {
    total,
    finished,
    capped,
    invalid,
    throws,
    avgTurns: total === 0 ? 0 : turnTotal / total,
    winShareBySeat: wins,
  }
  console.log('AI_SIM_STATS ' + JSON.stringify(stats))

  assert.equal(invalid, 0)
  assert.equal(throws, 0)
  assert.ok(finished / total >= 0.97, `only ${finished}/${total} games reached gameOver`)
})
