import { z } from 'zod'

export const contactSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be under 100 characters')
    .trim(),
  email: z
    .string()
    .email('A valid email address is required')
    .max(254, 'Email address is too long')
    .toLowerCase()
    .trim(),
  subject: z
    .string()
    .min(1, 'Subject is required')
    .max(200, 'Subject must be under 200 characters')
    .trim(),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(5000, 'Message must be under 5000 characters')
    .trim(),
  // Honeypot — must remain empty; bots fill it in
  website: z.string().max(0, 'Bot detected').optional(),
})

export type ContactFormData = z.infer<typeof contactSchema>
