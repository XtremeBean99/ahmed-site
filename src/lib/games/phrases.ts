/**
 * Curated typing-test phrases on the site's themes: law, AI governance,
 * and cybersecurity. One sentence each, no em dashes. Edit freely.
 */
export const phrases: string[] = [
  'Good governance of artificial intelligence begins with clear accountability.',
  'Courts increasingly grapple with copyright claims over training data.',
  'Strong passwords and least privilege defend against most intrusions.',
  'A contract is only as strong as the remedies that enforce it.',
  'Privacy law asks who may know what about whom, and on what terms.',
  'Transparency without enforcement is a promise that rarely keeps itself.',
  'Encryption protects the message even when the network cannot be trusted.',
  'Regulators are learning to audit algorithms they did not design.',
  'The burden of proof shapes every dispute long before trial.',
  'A data breach is discovered far more often than it is prevented.',
  'Liability for automated decisions remains a moving target in most courts.',
  'Due process means notice, a hearing, and a decision you can challenge.',
  'Security is a process, not a product you can buy once and forget.',
  'Open justice depends on records the public can actually read.',
  'A well drafted clause anticipates the argument it is meant to avoid.',
  'Machine learning models can memorise the very secrets they should protect.',
  'Jurisdiction decides whose rules apply when the harm crosses borders.',
  'Consent is meaningful only when refusal carries no hidden penalty.',
  'Threat models improve when you assume the attacker already has a foothold.',
  'Precedent binds the future to the reasoning of the past.',
  'Data minimisation is the cheapest security control most teams ignore.',
  'An injunction can stop the harm that damages can only measure.',
  'Governance frameworks fail quietly when no one owns the outcome.',
  'Phishing succeeds because it targets people, not the firewall.',
  'Statutory interpretation begins with the words and ends with their purpose.',
  'Zero trust assumes the breach and verifies every request anyway.',
  'A regulator without resources is a deterrent only on paper.',
  'The right to be forgotten collides with the duty to keep records.',
  'Incident response is judged by the hours, not the apology that follows.',
  'Fair process matters most when the stakes are highest.',
]

/** Pick a random phrase, avoiding an exact immediate repeat where possible. */
export function pickRandomPhrase(exclude?: string): string {
  const pool = exclude && phrases.length > 1 ? phrases.filter((p) => p !== exclude) : phrases
  return pool[Math.floor(Math.random() * pool.length)]
}
