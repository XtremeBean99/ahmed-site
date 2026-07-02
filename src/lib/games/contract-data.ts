import type { Scenario } from './contract-types'

/**
 * Scenarios for the contract game. In every category the middle option is the
 * balanced (`balance: 0`) one; negative favours the counterparty, positive
 * favours your client. Picking the fair option in each category lands a deal at
 * net zero — the perfect, enforceable middle.
 */
export const SCENARIOS: Scenario[] = [
  {
    id: 'freelance',
    title: 'Freelance services agreement',
    you: 'the developer',
    counterparty: 'the client',
    brief:
      'You act for a freelance web developer about to take on a build for a small business. Pick the clauses that get the deal signed without giving away the farm, or over-reaching so far the client walks.',
    categories: [
      {
        id: 'payment',
        title: 'Payment',
        prompt: 'How and when does the developer get paid?',
        options: [
          { id: 'p-bad', text: 'Paid only once the client is “fully satisfied”, with no deadline', balance: -3, explainer: 'A purely subjective satisfaction trigger with no longstop date lets the client withhold payment indefinitely.' },
          { id: 'p-fair', text: '50% deposit, 50% on delivery, payable within 14 days', balance: 0, explainer: 'A deposit plus a clear payment window is the market-standard, even-handed position.' },
          { id: 'p-greedy', text: '100% upfront, strictly non-refundable', balance: 3, explainer: 'Full non-refundable prepayment loads all the risk onto the client; few will sign it.' },
        ],
      },
      {
        id: 'ip',
        title: 'Intellectual property',
        prompt: 'Who owns what is created?',
        options: [
          { id: 'ip-bad', text: 'Developer assigns all IP, including their own pre-existing tools, for free', balance: -3, explainer: 'Assigning pre-existing tools strips the developer of reusable assets they built before this job.' },
          { id: 'ip-fair', text: 'Client owns the deliverables; developer keeps pre-existing tools and licenses them', balance: 0, explainer: 'The client gets what they paid for while the developer retains their general toolkit, the usual compromise.' },
          { id: 'ip-greedy', text: 'Developer retains all IP; client receives only a limited licence', balance: 3, explainer: 'Withholding ownership of bespoke deliverables the client paid for is hard to justify.' },
        ],
      },
      {
        id: 'liability',
        title: 'Liability',
        prompt: 'Who carries the risk if something goes wrong?',
        options: [
          { id: 'l-bad', text: 'Developer liable without limit, including for consequential loss', balance: -3, explainer: 'Uncapped liability for consequential loss can dwarf the fee and is rarely insurable.' },
          { id: 'l-fair', text: 'Liability capped at the fees paid; consequential loss excluded', balance: 0, explainer: 'A fees-based cap is the orthodox, defensible allocation of risk in services contracts.' },
          { id: 'l-greedy', text: 'Developer excludes all liability whatsoever', balance: 3, explainer: 'A total exclusion may be unenforceable and signals bad faith to the client.' },
        ],
      },
      {
        id: 'termination',
        title: 'Termination',
        prompt: 'How can either side walk away?',
        options: [
          { id: 't-bad', text: 'Client may terminate any time, with no payment for work already done', balance: -3, explainer: 'Termination for convenience with no payment for completed work leaves the developer exposed.' },
          { id: 't-fair', text: 'Either party may terminate on 14 days’ notice; developer is paid for work done', balance: 0, explainer: 'Mutual notice plus payment for work performed is balanced and enforceable.' },
          { id: 't-greedy', text: 'Only the developer may terminate; client is locked in for 12 months', balance: 3, explainer: 'A one-sided lock-in with no client exit is the kind of term a court may scrutinise.' },
        ],
      },
    ],
  },
  {
    id: 'tenancy',
    title: 'Residential tenancy',
    you: 'the tenant',
    counterparty: 'the landlord',
    brief:
      'You act for a tenant negotiating a residential lease. Land a fair, lawful tenancy. Push too hard for the tenant and the landlord won’t agree; accept a one-sided lease and you’ve failed your client.',
    categories: [
      {
        id: 'rent',
        title: 'Rent & increases',
        prompt: 'How is rent set and changed?',
        options: [
          { id: 'r-bad', text: 'Landlord may increase the rent at any time, by any amount', balance: -3, explainer: 'Unrestricted increases defeat the certainty a fixed-term lease is meant to provide and may breach tenancy law.' },
          { id: 'r-fair', text: 'Rent is fixed for the term; increases only as the statute allows, with notice', balance: 0, explainer: 'Tying increases to the statutory regime with notice is the lawful, balanced position.' },
          { id: 'r-greedy', text: 'Rent frozen for five years; tenant may leave any time, penalty-free', balance: 3, explainer: 'A long freeze plus a free exit option is so tenant-favourable no landlord will sign.' },
        ],
      },
      {
        id: 'repairs',
        title: 'Repairs',
        prompt: 'Who fixes what?',
        options: [
          { id: 'rep-bad', text: 'Tenant is responsible for all repairs, including structural', balance: -3, explainer: 'Pushing structural repairs onto a tenant is contrary to most residential tenancy statutes.' },
          { id: 'rep-fair', text: 'Landlord handles structural and urgent repairs; tenant does minor upkeep', balance: 0, explainer: 'This split mirrors the standard statutory allocation of repair duties.' },
          { id: 'rep-greedy', text: 'Landlord must fix everything within 24 hours or pay the tenant a penalty', balance: 3, explainer: 'A blanket 24-hour penalty for all repairs is unrealistic and heavily one-sided.' },
        ],
      },
      {
        id: 'bond',
        title: 'Bond',
        prompt: 'What security does the landlord hold?',
        options: [
          { id: 'b-bad', text: 'Eight weeks’ bond, non-refundable', balance: -3, explainer: 'An excessive, non-refundable bond likely exceeds the statutory cap and is unfair.' },
          { id: 'b-fair', text: 'Four weeks’ bond, lodged per statute, returned less any proven damage', balance: 0, explainer: 'A capped, lodged bond returned against proven damage is the lawful norm.' },
          { id: 'b-greedy', text: 'No bond at all; landlord carries every risk', balance: 3, explainer: 'No security leaves the landlord with no protection against damage or arrears.' },
        ],
      },
      {
        id: 'entry',
        title: 'Entry',
        prompt: 'When can the landlord come in?',
        options: [
          { id: 'e-bad', text: 'Landlord may enter at any time, without notice', balance: -3, explainer: 'Entry without notice violates the tenant’s right to quiet enjoyment and the statute.' },
          { id: 'e-fair', text: 'Landlord may enter with proper notice for valid reasons', balance: 0, explainer: 'Notice plus a valid purpose is the balanced, lawful entry regime.' },
          { id: 'e-greedy', text: 'Landlord may never enter without the tenant’s fresh written consent each time', balance: 3, explainer: 'An absolute consent veto would stop even lawful inspections and repairs.' },
        ],
      },
    ],
  },
  {
    id: 'saas',
    title: 'SaaS subscription',
    you: 'the customer',
    counterparty: 'the vendor',
    brief:
      'You act for a small business subscribing to a software platform. Get terms your client can live with. Over-reach and the vendor won’t deal; roll over and your client is locked into a bad bargain.',
    categories: [
      {
        id: 'sla',
        title: 'Service levels',
        prompt: 'What uptime is promised?',
        options: [
          { id: 's-bad', text: 'No uptime commitment; vendor not liable for any outage', balance: -3, explainer: 'With no SLA the customer has no remedy when the service they depend on goes down.' },
          { id: 's-fair', text: '99.9% uptime SLA backed by service credits', balance: 0, explainer: 'A measurable SLA with credits is the standard, balanced availability commitment.' },
          { id: 's-greedy', text: '100% uptime guarantee with a large per-minute penalty', balance: 3, explainer: 'No provider can promise perfect uptime; the penalty makes the term commercially impossible.' },
        ],
      },
      {
        id: 'data',
        title: 'Data & privacy',
        prompt: 'What can the vendor do with the data?',
        options: [
          { id: 'd-bad', text: 'Vendor may use and sell the customer’s data freely', balance: -3, explainer: 'Unrestricted use and onward sale of customer data is a serious privacy and compliance risk.' },
          { id: 'd-fair', text: 'Vendor processes data only to provide the service; returns or deletes it on exit', balance: 0, explainer: 'Purpose-limited processing with return/deletion on exit reflects good data-protection practice.' },
          { id: 'd-greedy', text: 'Vendor indemnifies the customer for any data issue, without limit', balance: 3, explainer: 'An uncapped data indemnity is one no vendor will accept and isn’t needed for fairness.' },
        ],
      },
      {
        id: 'price',
        title: 'Price changes',
        prompt: 'How can the price move?',
        options: [
          { id: 'pr-bad', text: 'Vendor may raise the price at any time, no notice, auto-charged', balance: -3, explainer: 'Unilateral, no-notice price rises strip the customer of budget certainty and the chance to leave.' },
          { id: 'pr-fair', text: 'Price fixed per term; changes with 30 days’ notice and a right to exit', balance: 0, explainer: 'Notice plus an exit right is the fair way to handle price changes.' },
          { id: 'pr-greedy', text: 'Price may only ever decrease; locked for ten years', balance: 3, explainer: 'A one-way ten-year price ratchet is wholly unrealistic for the vendor.' },
        ],
      },
      {
        id: 'lockin',
        title: 'Termination & lock-in',
        prompt: 'How does the customer get out?',
        options: [
          { id: 'k-bad', text: 'Three-year lock-in, no early exit, no data export', balance: -3, explainer: 'A long lock-in with no exit and no data export traps the customer in the product.' },
          { id: 'k-fair', text: 'Either party exits on 30 days’ notice; data export is provided', balance: 0, explainer: 'Mutual notice plus a data-export right is the balanced, portable outcome.' },
          { id: 'k-greedy', text: 'Customer may leave any time and the vendor pays all migration costs', balance: 3, explainer: 'Making the vendor fund every migration on demand is far too one-sided to be agreed.' },
        ],
      },
    ],
  },
]
