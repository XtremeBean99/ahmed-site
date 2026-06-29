<!--
================================================================================
 EDITABLE SITE CONTENT - ahmedyhussain.com
================================================================================
HOW TO USE THIS FILE
  1. Edit only the text to the RIGHT of each "key:" or inside each prose block.
  2. Do NOT change the **key names**, the ### headings, or the file paths  - 
     they are how I map your edits back into the real site.
  3. Punctuation is shown as normal characters (' " - …). Write naturally;
     I'll re-encode anything the code needs (e.g. &rsquo;) when I transfer it.
  4. A line break inside a paragraph is shown as " / " or noted; keep big
     structural breaks (separate paragraphs) on separate lines.
  5. When you're done, tell me and I'll review the diff and apply the changes
     to the actual components, then verify the build.

This file is documentation only - it is NOT wired into the site. Editing it
changes nothing until I transfer the edits.

BILINGUAL: the site now renders in English AND French. The live copy lives in
src/lib/i18n/dictionaries/en.ts (English) and fr.ts (French). This inventory
lists the English copy; every entry has a French counterpart at the same key.
If you change a string here, its French translation must be updated too.

Covered here: all page & section copy, navigation, footer, SEO descriptions.
NOT yet pulled in (data-driven, lives in code - ask if you want these too):
  • Typing-test phrases  → src/lib/games/phrases.ts
  • Contract game scenarios & clauses → src/lib/games/contract-data.ts
  • AGLC4 field labels / examples → src/lib/aglc4/fields.ts
================================================================================
-->

# Site Content


## Global


### Navigation (header)  ·  src/components/layout/Header.tsx
- nav_1: Projects
- nav_2: Games
- nav_3: Tutoring
- nav_cta: Get in touch
- logo_text: Ahmed Hussain


### Footer  ·  src/components/layout/Footer.tsx
- brand: Ahmed Hussain
- brand_blurb: © Ahmed Hussain. Content may not be reproduced, scraped, indexed for AI training, or incorporated into generative AI systems without prior written permission. See Terms of Use for details.
- link_1: Projects
- link_2: Tutoring
- link_3: Privacy Policy
- link_4: Terms of Use
- link_linkedin: LinkedIn
- link_email: Email
- copyright: © [current year] Ahmed Hussain. All rights reserved.
- location_line: Canberra, Australia · ahmedyhussain.com
- email_address: ahmedyhussain07@gmail.com
- linkedin_url: https://www.linkedin.com/in/ahmed-hussain-0880ba25a/


================================================================================
# HOMEPAGE  ·  /
================================================================================

### SEO  ·  src/app/page.tsx
- meta_title: Ahmed Hussain · Law, Computing & Technology
- meta_description: Personal website of Ahmed Hussain, a BCom / LLB(Hons) candidate at ANU in Canberra, working where law meets computing and the governance of artificial intelligence.


### Hero  ·  src/components/sections/Hero.tsx
- eyebrow: Canberra, Australia
- name: Ahmed Hussain
- descriptor_1: BCom / LLB(Hons) student at the Australian National University.
- descriptor_2: Working toward a future in tech law
- cta_primary: Connect on LinkedIn
- cta_secondary: Get in touch


### About  ·  src/components/sections/About.tsx
- eyebrow: About
- heading: Law. Computing. Technology.   (renders on three lines: "Law. Computing." / "Technology.")

paragraph_1:
I am a double-degree student at the Australian National University pursuing a Bachelor of Computing alongside a Bachelor of Laws (Honours). My academic interest sits in the legal and ethical dimensions of artificial intelligence.

paragraph_2:
I am interested in how legal systems adapt to fast technological change. I am actively working on technical and professional skills within this industry. Cybersecurity, privacy, and digital governance are areas I follow closely.


paragraph_3:
Outside of study I tutor senior secondary students in mathematics, physics, English, and legal studies. They are subjects that reward a patient, structured approach, which is the way I like to teach.

- image_alt: Legal documents and a desk, representing legal study and practice


### Professional Interests  ·  src/components/sections/Interests.tsx
- eyebrow: Professional Interests
- heading: Areas of focus.

(Each card = title + description)
- card_1_title: Legal Technology
- card_1_desc: How software is transforming legal practice, access to justice, and judicial processes.
- card_2_title: Software Engineering
- card_2_desc: Building systems that are reliable and easy to reason about, with care taken over correctness and clarity.
- card_3_title: Cybersecurity
- card_3_desc: Technical security, vulnerability research, and the intersection of security with law.
- card_4_title: Artificial Intelligence
- card_4_desc: Machine learning systems, their limitations, and the emerging legal frameworks around them.
- card_5_title: Privacy & Data
- card_5_desc: Data protection law, surveillance, and the technical architecture of privacy.
- card_6_title: Digital Governance
- card_6_desc: Regulatory approaches to platform power, algorithmic accountability, and digital markets.
- card_7_title: Technology Policy
- card_7_desc: How governments legislate technology, and whether the rules we already have are fit for it.
- card_8_title: Research
- card_8_desc: Empirical and doctrinal legal research at the intersection of law and technical systems.
- card_9_title: Emerging Technologies
- card_9_desc: Blockchain, biometrics, autonomous systems, and their legal implications.


### Education  ·  src/components/sections/Education.tsx
- eyebrow: Education
- heading: Academic background.
- university: Australian National University
- university_location: Canberra, ACT, Australia
- status_badge: Expected 2031
- degree_1: Bachelor of Computing
- degree_1_desc: Software engineering, algorithms, systems, and security
- degree_1_abbr: BCom
- degree_2: Bachelor of Laws (Honours)
- degree_2_desc: Common law, statutory interpretation, and emerging legal frameworks
- degree_2_abbr: LLB(Hons)


### Skills  ·  src/components/sections/Skills.tsx
- eyebrow: Skills
- heading: Technical & legal capability.
- group_1_title: Programming
- group_1_items: Python, TypeScript, JavaScript, Java, SQL, Bash
- group_2_title: Web & Frameworks
- group_2_items: React, Next.js, Node.js, REST APIs, PostgreSQL, Prisma
- group_3_title: Security & Infrastructure
- group_3_items: Linux, Git, Docker, OWASP Top 10, Networking basics
- group_4_title: Legal
- group_4_items: Contract Law, Administrative Law, Constitutional Law, Legal Research, Statutory Interpretation


### Contact (homepage section)  ·  src/components/sections/ContactSection.tsx
- eyebrow: Contact
- heading: Let's talk.
- intro: Whether you have a question about tutoring, want to talk about legal technology, or just want to connect, I'd love to hear from you.
- bullet_1: Tutoring enquiries (Years 7–12)
- bullet_2: Professional introductions
- bullet_3: Research or academic collaboration
- email_prompt: Prefer email? Reach me directly at ahmedyhussain07@gmail.com.


================================================================================
# PROJECTS  ·  /projects
================================================================================

### Projects hub  ·  src/app/projects/page.tsx
- meta_title: Projects
- meta_description: Selected work by Ahmed Hussain: open-source code, an interactive 3D look at silicon, an AGLC4 citation generator, and a base converter.
- eyebrow: Projects
- heading: Selected work.
- intro: A curated selection of my most recent professional & personal projects.

(Cards - label / title / description)
- card_code_label: Open source
- card_code_title: My Github Projects
- card_code_desc: Public repositories pulled live from GitHub: the software side of my law-and-computing work.
- card_silicon_label: Interactive
- card_silicon_title: Silicon: from atom to architecture
- card_silicon_desc: An interactive 3D model of a silicon atom, with an explainer on how its four valence electrons end up running every computer.
- card_aglc4_label: Legal tool
- card_aglc4_title: AGLC4 citation generator
- card_aglc4_desc: Build footnote and bibliography citations in the Australian Guide to Legal Citation (4th ed) style - cases, legislation, articles, books, web pages and Hansard - and copy them straight into your work.
- card_converter_label: Computing tool
- card_converter_title: Base converter
- card_converter_desc: Convert live between decimal, binary, hex, octal and UTF-8 text, with a bitwise playground for AND, OR, XOR, NOT and shifts. Arbitrary-precision, all in the browser.
- card_dev_label: Research
- card_dev_title: In development
- card_dev_desc: Empirical and doctrinal work on AI governance. I will publish it here as it develops.
- card_dev_status: Coming soon


### Code & open source page  ·  src/app/projects/code/page.tsx
- meta_title: Code & open source
- meta_description: Public software repositories by Ahmed Hussain, pulled live from GitHub. Open source projects spanning law, computing and tooling.
- eyebrow: Projects · Code
- heading: Code & open source
- intro: Public repositories pulled live from GitHub: the software side of my law-and-computing work.
- fallback_title: Unable to load repositories right now.
- fallback_body: The GitHub API may be temporarily unavailable or rate-limited. You can browse all repositories directly.
- fallback_link: github.com/XtremeBean99 →
- datasource_label: Data source
- datasource_body: Repository data is pulled live from the public GitHub REST API and refreshed hourly. Only public, non-fork, non-archived repositories are shown.


### Silicon page  ·  src/app/projects/silicon/page.tsx
- meta_title: Silicon: from atom to architecture
- meta_description: An interactive 3D model of a silicon atom, with an explainer on how its four valence electrons end up running every computer.
- eyebrow: Projects · Silicon
- heading: Silicon: from atom to architecture

intro:
An interactive 3D Bohr model of a silicon atom, atomic number 14, with 2 electrons in its first shell, 8 in the second, and 4 in the third. Drag to rotate, scroll to zoom. The four valence electrons are the reason every modern processor exists.

- canvas_caption: Drag to rotate · Scroll to zoom · Reduced-motion users see a static render

#### Explainer - section 1
- s1_heading: Why silicon
s1_p1:
Silicon sits in group 14 of the periodic table, right below carbon. It has four electrons in its outermost shell, exactly the number needed to form four covalent bonds and lock into a stable, repeating crystal lattice. Unlike a metal (which conducts electricity freely) or an insulator (which blocks it entirely), pure silicon is a semiconductor: it conducts electricity only when given a nudge.
s1_p2:
That in-between behaviour is what makes it controllable. Apply a voltage, and it switches from off to on. Remove the voltage, and it switches back. That switch, the binary state, is the physical basis for every logical 1 and 0 in digital computing.

#### Explainer - section 2
- s2_heading: Doping: tuning the conductivity
s2_p1:
Pure silicon is not very conductive on its own. The trick is doping: introducing a tiny number of impurity atoms into the crystal.
s2_p2:
Add phosphorus (five valence electrons) and you get n-type silicon, which has spare electrons ready to move. Add boron (three valence electrons) and you get p-type silicon, which has "holes" (gaps where an electron is missing) that behave like positive charge carriers.
s2_p3:
Place a piece of n-type silicon next to a piece of p-type silicon and you have a p-n junction, the building block of the diode. Current flows in one direction and is blocked in the other. Stack three layers, p-n-p or n-p-n, and you have the basis of the transistor.

#### Explainer - section 3
- s3_heading: The transistor
s3_p1:
The modern transistor, the MOSFET (Metal-Oxide-Semiconductor Field-Effect Transistor), is a voltage-controlled switch. A small voltage applied to the "gate" terminal creates an electric field that opens or closes a conductive channel between the "source" and "drain." No mechanical parts, no moving pieces, just a field and a semiconductor channel.
s3_p2:
A single modern CPU contains billions of these switches, fabricated at a scale measured in nanometres. Each one flips on and off billions of times per second. Those on/off states, aggregated across billions of transistors, are the 1s and 0s of digital logic. Every line of code you write eventually resolves to voltages across MOSFET gates.

#### Explainer - section 4
- s4_heading: From sand to CPU
s4_intro:
Silicon does not come out of the ground ready for a logic gate. The journey from raw material to integrated circuit is one of the most precise manufacturing processes ever devised.
- s4_bullet_1 (Refinement): Quartz (silicon dioxide, SiO₂) is reduced with carbon in an arc furnace to produce metallurgical-grade silicon, then further purified to electronic-grade: 99.9999999% pure.
- s4_bullet_2 (Crystal growth): The Czochralski process draws a single-crystal ingot from a melt: a flawless cylinder of silicon atoms in a perfect lattice, up to 300 mm across and a metre long.
- s4_bullet_3 (Wafers): The ingot is sliced into wafers thinner than a human hair, polished to a mirror finish.
- s4_bullet_4 (Photolithography): A light-sensitive resist is applied, exposed through a mask that carries the circuit pattern, and developed. Unprotected silicon is etched away. The process is repeated dozens of times, layer upon layer, to build up the transistors, interconnects, and isolation structures.
- s4_bullet_5 (Packaging): The finished die is cut from the wafer, bonded to a substrate, and sealed in a package with electrical contacts, the black rectangle we recognise as a chip.

#### Explainer - tie-back
- s5_label: Why this matters here
s5_body:
Every question of AI governance, every cybersecurity regulation, every dispute over data sovereignty: they all ultimately run on this physical substrate. A silicon atom, doped and patterned, switches on and off a few billion times a second.


### AGLC4 generator page  ·  src/app/projects/aglc4/page.tsx
- meta_title: AGLC4 citation generator
- meta_description: Generate footnote and bibliography citations in the Australian Guide to Legal Citation (4th ed) style: cases, legislation, journal articles, books, web pages and Hansard.
- eyebrow: Legal tool
- heading: AGLC4 citation generator
- intro: Build footnote and bibliography citations in the Australian Guide to Legal Citation (4th ed) style. Choose a source type, fill in the fields, and the citation updates as you type - ready to copy into your essay or memo.
- disclaimer (in component, src/components/projects/Aglc4Generator.tsx): A study aid based on AGLC4. It covers common cases, and you should always check the output against the guide before relying on it. Italics are shown as you would type them in a document.


### Base converter page  ·  src/app/projects/base-converter/page.tsx
- meta_title: Base converter
- meta_description: Live converter between decimal, binary, hexadecimal, octal and UTF-8 text, with a bitwise playground (AND, OR, XOR, NOT, shifts). Arbitrary-precision, runs in your browser.
- eyebrow: Computing tool
- heading: Base converter
- intro: Convert between decimal, binary, hexadecimal, octal and UTF-8 text - edit any field and the rest follow live. Then experiment with AND, OR, XOR, NOT and shifts in the bitwise playground. Everything is arbitrary-precision and runs entirely in your browser.
- helper_note (in component): Edit any field and the rest update live. Values are arbitrary-precision, so very large numbers work. Text maps each character to its UTF-8 bytes.


================================================================================
# GAMES  ·  /games
================================================================================

### Games hub  ·  src/app/games/page.tsx
- meta_title: Games
- meta_description: Browser games by Ahmed Hussain: a live WPM typing speed test on law and technology phrases, a monochrome Breakout with power-ups, and the Clause Game — a contract negotiation strategy game.
- eyebrow: Games
- heading: A break from the brief.
- intro: A few small things built for fun and to keep the canvas and animation muscles warm. They run entirely in your browser and keep your best score on your device.
- card_typing_label: Live WPM
- card_typing_title: Typing speed test
- card_typing_desc: Type curated phrases on law, AI governance and cybersecurity while a live tracker measures your words per minute and accuracy.
- card_breakout_label: Arcade
- card_breakout_title: Breakout
- card_breakout_desc: A monochrome take on the Atari classic: clear the wall, catch falling power-ups, and chase a personal best.
- card_contract_label: Strategy
- card_contract_title: The Clause Game
- card_contract_desc: Sit at the negotiating table and draft the deal: pick clauses across real scenarios and win by landing a balanced, enforceable contract - too greedy or too generous and it falls apart.


### Typing test page  ·  src/app/games/typing-test/page.tsx
- meta_title: Typing speed test
- meta_description: A live WPM typing speed test on curated law, AI governance and cybersecurity phrases. Tracks words per minute and accuracy in real time.
- eyebrow: Live WPM
- heading: Typing speed test
- intro: Type the phrase as accurately and quickly as you can. The tracker starts on your first keystroke and your best score stays on this device.


### Breakout page  ·  src/app/games/breakout/page.tsx
- meta_title: Breakout
- meta_description: A monochrome Breakout game with falling power-ups. Clear the wall, catch power-ups, and chase a personal best, all in your browser.
- eyebrow: Arcade
- heading: Breakout
- intro: Move the paddle to keep the ball alive and clear every brick. Some bricks drop power-ups. Use mouse, touch, or the arrow keys, and press space to launch.


### The Clause Game page  ·  src/app/games/contract/page.tsx
- meta_title: The Clause Game
- meta_description: A contract-drafting game: pick clauses across real negotiation scenarios and win by landing a balanced, enforceable deal - too greedy or too generous and it falls apart.
- eyebrow: Strategy
- heading: The Clause Game
- intro: You are counsel at the negotiating table. Choose a clause in every category, then lock in the deal. Land it in the balanced, enforceable zone to win the round - push too hard for your client and the other side walks; give too much away and you have failed them. Your best run stays on this device.

(NOTE: the scenario briefs, clause wording and explanations live in
 src/lib/games/contract-data.ts - ask if you want those pulled in here too.)


================================================================================
# TUTORING  ·  /tutoring  ·  src/app/tutoring/page.tsx
================================================================================

- meta_title: Tutoring
- meta_description: Private tutoring by Ahmed Hussain in Canberra. Years 7–12. Physics, Mathematics, English, Legal Studies and more. Online $60/hr, in-person $70/hr.
- eyebrow: Tutoring
- heading: Private tutoring, Canberra.   (renders on two lines: "Private tutoring," / "Canberra.")
- intro_1: I offer one-on-one tutoring for secondary school students in Canberra. My approach puts understanding ahead of memorisation. The aim is to build the kind of structured thinking that holds up in exams and well after them.
- intro_2: Sessions are available online and in person at the ANU campus or nearby locations.

#### Years 11–12 card
- y1112_eyebrow: Senior secondary
- y1112_heading: Years 11–12
- y1112_subject_1: Physics - ACT BSSS curriculum
- y1112_subject_2: Mathematics - Methods & Specialist
- y1112_subject_3: English - Literature & Language
- y1112_subject_4: Legal Studies - ACT BSSS curriculum

#### Years 7–10 card
- y710_eyebrow: Middle secondary
- y710_heading: Years 7–10
- y710_subheading: All non-science subjects available
- y710_subjects: Mathematics, English, History, Geography, Legal Studies, Commerce, Business, Economics

#### Pricing
- pricing_label: Pricing
- online_label: Online
- online_price: $60
- online_unit: per hour
- online_feature_1: Via video call
- online_feature_2: Flexible scheduling
- online_feature_3: Screen sharing for worked examples
- inperson_label: In Person
- inperson_price: $70
- inperson_unit: per hour
- inperson_feature_1: ANU campus
- inperson_feature_2: Canberra by arrangement
- inperson_feature_3: Printed materials available

#### FAQ
- faq_label: FAQ
- faq_1_q: Where do sessions take place?
- faq_1_a: Sessions are available online via video call, at the Australian National University campus, or at a Canberra location arranged in advance.
- faq_2_q: How long is each session?
- faq_2_a: Sessions are typically one hour. Longer sessions can be arranged on request.
- faq_3_q: What year levels do you tutor?
- faq_3_a: Years 7–10 for most non-science subjects, and Years 11–12 for Physics, Mathematics, English, and Legal Studies in line with the ACT BSSS curriculum.
- faq_4_q: Do you offer trial sessions?
- faq_4_a: Please get in touch to discuss your requirements. I am happy to discuss how I can best support your learning before committing.
- faq_5_q: How do I book a session?
- faq_5_a: Use the contact form below or email me directly. I will respond within one business day to arrange a suitable time.

#### Enquiry block
- enquire_label: Enquire
- enquire_heading: Book a session.
- enquire_body: Use this form to enquire about tutoring. Include your year level and the subjects you need help with, and I will get back to you within one business day.


================================================================================
# CONTACT FORM (shared)  ·  src/components/ui/ContactForm.tsx
================================================================================

- label_name: Name
- placeholder_name: Your name
- label_email: Email
- placeholder_email: you@example.com
- label_subject: Subject
- placeholder_subject: What is this regarding?
- label_message: Message
- placeholder_message: Your message
- button_idle: Send message
- button_sending: Sending…
- success_title: Message sent.
- success_body: Thank you for reaching out. I will be in touch shortly.
- success_again: Send another message
- error_rate_limit: You have sent too many messages. Please try again in about an hour.
- error_generic: Something went wrong. Please try again.
- error_network: Network error. Please check your connection and try again.


================================================================================
# LEGAL - TERMS OF USE  ·  /legal/terms  ·  src/app/legal/terms/page.tsx
================================================================================

- meta_title: Terms of Use
- effective_date: 14 June 2026
- eyebrow: Legal
- heading: Terms of Use

- s1_heading: 1. Acceptance
s1_body:
By accessing or using ahmedyhussain.com (the "Site"), you agree to be bound by these Terms of Use. If you do not agree, do not use the Site.

- s2_heading: 2. Intellectual Property
s2_body:
All content on this Site, including but not limited to text, design, layout, graphics, and code, is the intellectual property of Ahmed Hussain and is protected by Australian and international copyright law.
Copyright © Ahmed Hussain. All rights reserved.

- s3_heading: 3. Prohibited Uses
s3_intro: You expressly agree that you will not, without prior written permission:
- s3_bullet_1: Scrape, crawl, or otherwise automatically extract content from this Site
- s3_bullet_2: Use any content from this Site to train, fine-tune, or otherwise develop artificial intelligence or machine learning models
- s3_bullet_3: Ingest any content into vector databases, embedding stores, or similar retrieval systems for AI purposes
- s3_bullet_4: Reproduce, redistribute, or republish content without attribution and permission
- s3_bullet_5: Create derivative works based on content from this Site
- s3_bullet_6: Use this Site in any manner that could interfere with its operation or impose an unreasonable load on its infrastructure

- s4_heading: 4. AI and Automated Systems
s4_p1:
All content on this Site is copyrighted and may not be reproduced, redistributed, scraped, indexed for AI training, used in machine learning datasets, or incorporated into generative AI systems without prior written permission from Ahmed Hussain.
s4_p2:
Operators of AI crawlers and large language model training pipelines are on notice that access to this Site for the purpose of data collection is prohibited. This prohibition is reflected in the Site's robots.txt file and HTTP response headers.

- s5_heading: 5. Accuracy of Information
s5_body:
Content on this Site is provided for informational purposes only and does not constitute legal advice. While I make reasonable efforts to ensure accuracy, I make no representations as to the completeness or timeliness of information provided.

- s6_heading: 6. Limitation of Liability
s6_body:
To the extent permitted by law, Ahmed Hussain excludes all liability for loss or damage of any kind arising from your use of this Site or reliance on its content.

- s7_heading: 7. Governing Law
s7_body:
These Terms are governed by the laws of the Australian Capital Territory, Australia. Any dispute arising from these Terms will be subject to the jurisdiction of the courts of the ACT.

- s8_heading: 8. Contact
s8_body:
For permissions or queries regarding these Terms, contact: ahmedyhussain07@gmail.com


================================================================================
# LEGAL - PRIVACY POLICY  ·  /legal/privacy  ·  src/app/legal/privacy/page.tsx
================================================================================

- meta_title: Privacy Policy
- effective_date: 16 June 2026
- eyebrow: Legal
- heading: Privacy Policy

- s1_heading: 1. Overview
s1_body:
This Privacy Policy explains how ahmedyhussain.com ("Site") collects, uses, and stores personal information. I am committed to handling your data responsibly and in accordance with the Australian Privacy Act 1988 (Cth) and applicable Australian Privacy Principles.

- s2_heading: 2. Information Collected
s2_intro: When you submit the contact form on this Site, I collect:
- s2_bullet_1: Your name
- s2_bullet_2: Your email address
- s2_bullet_3: The subject and content of your message
s2_after:
I do not collect or log your IP address, and the contact form does not set cookies or tracking identifiers.

- s3_heading: 3. How Information Is Used
s3_intro: Information you submit is used solely to:
- s3_bullet_1: Respond to your enquiry or message
s3_after:
The contact form is protected from automated spam by a hidden honeypot field rather than by collecting any data about you. Your data is never sold, shared with third parties for marketing, or used for any purpose beyond responding to your contact.

- s4_heading: 4. Data Storage and Security
s4_p1:
This Site has no database. Contact form submissions are delivered to me by email through Resend (resend.com) and are not stored on the Site itself. Email is transmitted using TLS encryption.
s4_p2:
I use industry-standard encryption (TLS) for email transmission and follow best practices to keep your data secure.

- s5_heading: 5. Retention
s5_body:
Because submissions are sent by email and not stored on the Site, retention is limited to my email records, kept only as long as necessary to respond to your enquiry and for reasonable record-keeping purposes. You may request deletion of your data at any time.

- s6_heading: 6. Cookies, Analytics and Local Storage
s6_p1:
This Site does not use tracking cookies, advertising pixels, or social media tracking scripts.
s6_p2:
The Site uses Vercel Speed Insights to measure anonymous, aggregated performance metrics such as page load times. It does not use cookies and does not identify you.
s6_p3:
The games in the Games section save your best score in your browser using local storage. That information stays on your device, is never transmitted to me or any third party, and you can clear it at any time through your browser settings.

- s7_heading: 7. Your Rights
s7_body:
Under the Australian Privacy Principles, you have the right to access, correct, or request deletion of personal information held about you. To exercise these rights, contact me at the address below.

- s8_heading: 8. Contact
s8_body:
Privacy enquiries: ahmedyhussain07@gmail.com


================================================================================
# SOCIAL PREVIEW IMAGE TEXT (Open Graph / Twitter)
================================================================================
Each route renders a preview card image from these three lines.
Files: src/app/**/opengraph-image.tsx (twitter-image.tsx re-exports them).

- home (src/app/opengraph-image.tsx - custom layout):
    eyebrow: Canberra, Australia
    title: Ahmed Hussain
    subtitle: Law, computing, and the governance of artificial intelligence.
    footer_left: BCom / LLB(Hons), Australian National University
    footer_right: ahmedyhussain.com
- projects: Projects / Selected work / Open-source code, an interactive look at silicon, and law-and-computing tools.
- aglc4: Legal tool / AGLC4 citation generator / Footnote and bibliography citations in the Australian Guide to Legal Citation style.
- base-converter: Computing tool / Base converter / Decimal, binary, hex, octal and text - plus a bitwise playground, all in the browser.
- contract: Strategy / The Clause Game / Pick clauses and win by landing a balanced, enforceable deal - too greedy and it falls apart.
- breakout: Arcade / Breakout / Clear the wall, catch falling power-ups, and chase a personal best.
- typing-test / tutoring: see their opengraph-image.tsx files.
