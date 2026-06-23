import { z } from 'zod'

/** Validation messages — overridable per locale on the client form. */
export interface ContactMessages {
  nameRequired: string
  nameMax: string
  emailInvalid: string
  emailMax: string
  subjectRequired: string
  subjectMax: string
  messageMin: string
  messageMax: string
}

const DEFAULT_MESSAGES: ContactMessages = {
  nameRequired: 'Name is required',
  nameMax: 'Name must be under 100 characters',
  emailInvalid: 'A valid email address is required',
  emailMax: 'Email address is too long',
  subjectRequired: 'Subject is required',
  subjectMax: 'Subject must be under 200 characters',
  messageMin: 'Message must be at least 10 characters',
  messageMax: 'Message must be under 5000 characters',
}

/**
 * Build the contact schema with the given (localised) error messages. The
 * client form passes locale-specific copy; the server API uses the English
 * default since its errors are not shown to the user.
 */
export function makeContactSchema(messages: ContactMessages = DEFAULT_MESSAGES) {
  return z.object({
    name: z.string().min(1, messages.nameRequired).max(100, messages.nameMax).trim(),
    email: z
      .string()
      .email(messages.emailInvalid)
      .max(254, messages.emailMax)
      .toLowerCase()
      .trim(),
    subject: z.string().min(1, messages.subjectRequired).max(200, messages.subjectMax).trim(),
    message: z.string().min(10, messages.messageMin).max(5000, messages.messageMax).trim(),
    // Honeypot - must remain empty; bots fill it in
    website: z.string().max(0, 'Bot detected').optional(),
  })
}

/** Default (English) schema — single source of truth for the server. */
export const contactSchema = makeContactSchema()

export type ContactFormData = z.infer<typeof contactSchema>
