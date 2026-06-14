'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { contactSchema, type ContactFormData } from '@/lib/validations'
import { cn } from '@/lib/utils'

interface ContactFormProps {
  /** Optional pre-filled subject for tutoring enquiries */
  defaultSubject?: string
}

const inputBase =
  'w-full bg-surface border border-border rounded-md px-4 py-3 text-sm text-foreground placeholder:text-muted transition-colors focus:outline-none focus:border-muted-foreground'

export function ContactForm({ defaultSubject }: ContactFormProps) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: { subject: defaultSubject ?? '' },
  })

  async function onSubmit(data: ContactFormData) {
    setStatus('sending')
    setErrorMessage(null)

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setErrorMessage(
          res.status === 429
            ? 'Too many messages sent. Please try again later.'
            : (json.error as string) || 'Something went wrong. Please try again.',
        )
        setStatus('error')
        return
      }

      setStatus('success')
      reset()
    } catch {
      setErrorMessage('Network error. Please check your connection and try again.')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="border border-border rounded-lg p-8 text-center">
        <svg
          className="mx-auto mb-4 text-muted-foreground"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="font-serif text-xl font-semibold text-foreground mb-2">Message sent.</p>
        <p className="text-muted-foreground text-sm">
          Thank you for reaching out. I will be in touch shortly.
        </p>
        <button
          onClick={() => setStatus('idle')}
          className="mt-6 text-xs text-muted underline hover:text-muted-foreground transition-colors"
        >
          Send another message
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {/* Honeypot — hidden from real users, filled in by bots */}
      <input
        {...register('website')}
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute opacity-0 pointer-events-none w-px h-px overflow-hidden"
      />

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="name" className="block text-xs text-muted-foreground mb-1.5 label-text">
            Name
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Your name"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'name-error' : undefined}
            className={cn(inputBase, errors.name && 'border-red-800')}
            {...register('name')}
          />
          {errors.name && (
            <p id="name-error" role="alert" className="mt-1 text-xs text-red-500">
              {errors.name.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="block text-xs text-muted-foreground mb-1.5 label-text">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
            className={cn(inputBase, errors.email && 'border-red-800')}
            {...register('email')}
          />
          {errors.email && (
            <p id="email-error" role="alert" className="mt-1 text-xs text-red-500">
              {errors.email.message}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="subject" className="block text-xs text-muted-foreground mb-1.5 label-text">
          Subject
        </label>
        <input
          id="subject"
          type="text"
          placeholder="What is this regarding?"
          aria-invalid={!!errors.subject}
          aria-describedby={errors.subject ? 'subject-error' : undefined}
          className={cn(inputBase, errors.subject && 'border-red-800')}
          {...register('subject')}
        />
        {errors.subject && (
          <p id="subject-error" role="alert" className="mt-1 text-xs text-red-500">
            {errors.subject.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="message" className="block text-xs text-muted-foreground mb-1.5 label-text">
          Message
        </label>
        <textarea
          id="message"
          rows={5}
          placeholder="Your message"
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? 'message-error' : undefined}
          className={cn(inputBase, 'resize-none', errors.message && 'border-red-800')}
          {...register('message')}
        />
        {errors.message && (
          <p id="message-error" role="alert" className="mt-1 text-xs text-red-500">
            {errors.message.message}
          </p>
        )}
      </div>

      {status === 'error' && errorMessage && (
        <p role="alert" className="text-sm text-red-500 border border-red-900 rounded-md px-4 py-3">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full sm:w-auto bg-foreground text-background px-7 py-3 rounded-md text-sm font-medium hover:bg-muted-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'sending' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  )
}
