/**
 * The windowsill bonsai grows with the visitor's visits (art: scripts/draw-bonsai.mjs).
 * Stage 1 is a sprout on the first visit, stage 4 the full hand-drawn tree, stage 5 the
 * tree in bloom. `?bonsai=1..5` forces a stage, for previews.
 */
export type BonsaiStage = 1 | 2 | 3 | 4 | 5

export const BONSAI_STAGES: readonly BonsaiStage[] = [1, 2, 3, 4, 5]

/** The first visit on which each stage appears (visits counted from 1). */
const STAGE_FROM_VISIT: Record<BonsaiStage, number> = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 12 }

/** Frames per stage: rest, hover with a 1 px highlight, then four 2 px swaying frames. */
export const BONSAI_FRAMES = 6
/** On hover the sprite plays rest -> first highlight once, then loops from here. */
export const BONSAI_LOOP_FROM = 2

/** `previousVisits` is the stored visit count before this visit (0 on the first). */
export function bonsaiStage(previousVisits: number, search = ''): BonsaiStage {
  const forced = Number(new URLSearchParams(search).get('bonsai'))
  if (BONSAI_STAGES.includes(forced as BonsaiStage)) return forced as BonsaiStage
  const visit = Math.max(0, Math.floor(previousVisits) || 0) + 1
  let stage: BonsaiStage = 1
  for (const s of BONSAI_STAGES) if (visit >= STAGE_FROM_VISIT[s]) stage = s
  return stage
}

export function bonsaiFrames(stage: BonsaiStage): string[] {
  return Array.from({ length: BONSAI_FRAMES }, (_, i) => `/room/bonsai-${stage}-${i + 1}.png`)
}
