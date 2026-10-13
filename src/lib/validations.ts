import { z } from 'zod'
import { HISCORE_GAME_IDS } from '@/lib/games/highscores'
import { DAILY_GAMES } from '@/lib/games/daily'

export const guestbookSchema = z.object({
  name: z.string().trim().min(1).max(32),
  message: z.string().trim().min(1).max(280),
  website: z.string().max(0).optional(), // honeypot: must be empty
})

export type GuestbookInput = z.infer<typeof guestbookSchema>

export const highscoreSchema = z.object({
  game: z.enum(HISCORE_GAME_IDS),
  name: z.string().trim().min(1).max(16),
  score: z.number().int(),
  website: z.string().max(0).optional(), // honeypot: must be empty
})

export type HighscoreInput = z.infer<typeof highscoreSchema>

export const dailyScoreSchema = z.object({
  game: z.enum(DAILY_GAMES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(1).max(16),
  score: z.number().int(),
  website: z.string().max(0).optional(), // honeypot: must be empty
})

export const featureRequestSchema = z.object({
  name: z.string().trim().max(32).optional(),
  /** Optional, so the owner can reply; never shown publicly. */
  contact: z.string().trim().max(120).optional(),
  message: z.string().trim().min(5).max(1000),
  website: z.string().max(0).optional(), // honeypot: must be empty
})

export type FeatureRequestInput = z.infer<typeof featureRequestSchema>
