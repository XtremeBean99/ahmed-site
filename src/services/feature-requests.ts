import { Resend } from 'resend'
import { getRedis } from '@/lib/redis'

/**
 * Feature requests from the desk's Request app. Each one is emailed to the
 * owner through Resend when RESEND_API_KEY and FEATURE_REQUEST_TO_EMAIL are
 * set, and kept in an Upstash sorted set `feature-requests` (newest 500,
 * scored by time) so nothing is lost while email is not configured. Stored:
 * name, optional contact, message and time; no IP.
 */
export interface FeatureRequest { id: string; name: string; contact: string; message: string; at: number }

const KEY = 'feature-requests'
const MAX_STORED = 500

async function store(req: FeatureRequest): Promise<void> {
  const redis = getRedis()
  await redis.zadd(KEY, { score: req.at, member: JSON.stringify(req) })
  const count = await redis.zcard(KEY)
  if (count > MAX_STORED) await redis.zremrangebyrank(KEY, 0, count - MAX_STORED - 1)
}

async function email(req: FeatureRequest): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.FEATURE_REQUEST_TO_EMAIL
  if (!apiKey || !to) throw new Error('Feature request email is not configured')
  // Resend's shared sender only delivers to the account owner, which is exactly who this goes to.
  const from = process.env.FEATURE_REQUEST_FROM_EMAIL || 'Room feature requests <onboarding@resend.dev>'
  const contactIsEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.contact)
  const { error } = await new Resend(apiKey).emails.send({
    from,
    to,
    subject: `Feature request from ${req.name || 'a visitor'}`,
    text: `${req.message}\n\nFrom: ${req.name || '(no name)'}\nContact: ${req.contact || '(none)'}\nAt: ${new Date(req.at).toISOString()}`,
    ...(contactIsEmail ? { replyTo: req.contact } : {}),
  })
  if (error) throw new Error(`Resend: ${error.name}`)
}

/**
 * Saves and emails a request. Succeeds when either path works, so an email
 * outage or missing Redis does not lose it; throws only when both fail.
 */
export async function submitFeatureRequest(input: { name: string; contact: string; message: string }): Promise<{ emailed: boolean; stored: boolean }> {
  const req: FeatureRequest = { id: crypto.randomUUID(), ...input, at: Date.now() }
  const [stored, emailed] = await Promise.allSettled([store(req), email(req)])
  if (stored.status === 'rejected') console.error('[feature-request] store failed', stored.reason)
  if (emailed.status === 'rejected') console.error('[feature-request] email failed', emailed.reason)
  if (stored.status === 'rejected' && emailed.status === 'rejected') throw new Error('Feature request could not be delivered')
  return { emailed: emailed.status === 'fulfilled', stored: stored.status === 'fulfilled' }
}

/** Admin: the newest requests. Members come back already parsed by the SDK. */
export async function listFeatureRequests(limit = 100): Promise<FeatureRequest[]> {
  return getRedis().zrange<FeatureRequest[]>(KEY, 0, limit - 1, { rev: true })
}
