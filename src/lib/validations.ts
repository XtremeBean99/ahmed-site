import { z } from 'zod'

export const guestbookSchema = z.object({
  name: z.string().trim().min(1).max(32),
  message: z.string().trim().min(1).max(280),
  website: z.string().max(0).optional(), // honeypot: must be empty
})

export type GuestbookInput = z.infer<typeof guestbookSchema>
