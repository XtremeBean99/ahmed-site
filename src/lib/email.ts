import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendContactEmail({
  name,
  email,
  subject,
  message,
}: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<void> {
  const to = process.env.CONTACT_TO_EMAIL;
  if (!to || !resend) {
    console.warn("Email not configured: missing RESEND_API_KEY or CONTACT_TO_EMAIL");
    return;
  }

  await resend.emails.send({
    from: "ahmedyhussain.com <contact@ahmedyhussain.com>",
    to,
    replyTo: email,
    subject: `[Contact] ${subject}`,
    text: `From: ${name} <${email}>\n\n${message}`,
  });
}
