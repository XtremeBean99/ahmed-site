import { sendContactEmail } from '@/lib/resend'

interface SubmitContactPayload {
  name: string
  email: string
  subject: string
  message: string
}

export async function submitContact(payload: SubmitContactPayload) {
  // Send the notification email directly. If Resend reports a problem,
  // sendContactEmail throws and the API route turns it into a 500 with the reason.
  await sendContactEmail(payload)
  return { success: true } as const
}
