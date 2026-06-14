import { prisma } from '@/lib/prisma'
import { sendContactEmail } from '@/lib/resend'
import { hashIP } from '@/lib/utils'

const RATE_LIMIT_MAX = 3
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

interface SubmitContactPayload {
  name: string
  email: string
  subject: string
  message: string
  ip: string
}

export async function submitContact(payload: SubmitContactPayload) {
  const { name, email, subject, message, ip } = payload
  const ipHash = hashIP(ip)

  // DB-based rate limiting: max 3 submissions per IP per hour
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS)
  const recentCount = await prisma.contactSubmission.count({
    where: {
      ipHash,
      createdAt: { gte: windowStart },
    },
  })

  if (recentCount >= RATE_LIMIT_MAX) {
    return { rateLimited: true } as const
  }

  // Persist submission (never log the full message body in server logs)
  await prisma.contactSubmission.create({
    data: { name, email, subject, message, ipHash },
  })

  // Fire notification email. Failure is non-fatal to the visitor response
  // because the submission is already saved above, so the enquiry is never
  // lost. A failure is logged loudly so it is not silently missed.
  let emailDelivered = true
  try {
    await sendContactEmail({ name, email, subject, message })
  } catch (err) {
    emailDelivered = false
    console.error(
      '[contact] EMAIL DELIVERY FAILED. The submission was saved to the database but the ' +
        'notification email was not sent. Verify RESEND_API_KEY and that the sending domain ' +
        'is verified at resend.com/domains. Reason:',
      err instanceof Error ? err.message : 'unknown',
    )
  }

  return { success: true, emailDelivered } as const
}
