'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface BugReportFormProps {
  bugsName: string
  bugsEmail: string
  bugsDescription: string
  bugsDescriptionPlaceholder: string
  bugsSend: string
  bugsSending: string
  bugsSuccess: string
  bugsError: string
}

export function BugReportForm({
  bugsName,
  bugsEmail,
  bugsDescription,
  bugsDescriptionPlaceholder,
  bugsSend,
  bugsSending,
  bugsSuccess,
  bugsError,
}: BugReportFormProps) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('sending')
    setErrorMessage(null)

    const form = e.currentTarget
    const formData = new FormData(form)
    const name = (formData.get('name') as string) || 'Anonymous'
    const email = (formData.get('email') as string) || 'anonymous@example.com'
    const description = formData.get('description') as string

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          subject: 'Super Space Monk Ninja Fighter Simulator IV bug report',
          message: description,
          website: '', // honeypot stays empty
        }),
      })

      if (!res.ok) {
        setErrorMessage(bugsError)
        setStatus('error')
        return
      }

      setStatus('success')
      form.reset()
    } catch {
      setErrorMessage(bugsError)
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div
        className="border border-border rounded-lg p-6 text-center"
        aria-live="polite"
      >
        <svg
          className="mx-auto mb-3 text-muted-foreground"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="text-sm text-foreground">{bugsSuccess}</p>
      </div>
    )
  }

  const inputBase =
    'w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted transition-colors focus:outline-none focus:border-muted-foreground'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="bug-name" className="block text-xs text-muted-foreground mb-1.5 label-text">
            {bugsName}
          </label>
          <input
            id="bug-name"
            name="name"
            type="text"
            autoComplete="name"
            className={inputBase}
          />
        </div>
        <div>
          <label htmlFor="bug-email" className="block text-xs text-muted-foreground mb-1.5 label-text">
            {bugsEmail}
          </label>
          <input
            id="bug-email"
            name="email"
            type="email"
            autoComplete="email"
            className={inputBase}
          />
        </div>
      </div>
      <div>
        <label htmlFor="bug-description" className="block text-xs text-muted-foreground mb-1.5 label-text">
          {bugsDescription}
        </label>
        <textarea
          id="bug-description"
          name="description"
          rows={4}
          required
          placeholder={bugsDescriptionPlaceholder}
          className={cn(inputBase, 'resize-none')}
        />
      </div>

      {status === 'error' && errorMessage && (
        <p role="alert" aria-live="assertive" className="text-xs text-red-500 border border-red-900 rounded-md px-3 py-2">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        aria-busy={status === 'sending'}
        className="bg-foreground text-background px-5 py-2.5 rounded-md text-sm font-medium hover:bg-muted-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'sending' ? bugsSending : bugsSend}
      </button>
    </form>
  )
}
