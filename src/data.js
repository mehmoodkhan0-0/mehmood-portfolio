/**
 * data.js — Central content layer.
 * All portfolio content lives here so copy changes never touch logic.
 */

export const skills = [
  { name: 'Network Security',   level: 88, desc: 'Firewalls, IDS/IPS, segmentation, packet & traffic analysis.' },
  { name: 'Penetration Testing', level: 82, desc: 'Recon, exploitation, privilege escalation, reporting.' },
  { name: 'Linux',              level: 90, desc: 'System hardening, bash, daemons, permissions, auditing.' },
  { name: 'CTF',                level: 85, desc: 'Jeopardy & attack-defense formats, crypto, pwn, misc.' },
  { name: 'OSINT',              level: 78, desc: 'Open-source intelligence gathering and target profiling.' },
  { name: 'Web Security',       level: 84, desc: 'OWASP Top 10, injection, XSS, auth flaws, API abuse.' },
  { name: 'Incident Response',  level: 75, desc: 'Triage, containment, forensics fundamentals, SIEM.' },
  { name: 'Python',             level: 80, desc: 'Security tooling, automation, scripting, exploit PoCs.' }
];

/**
 * certs — the Verified Record ledger (section 05).
 *
 * ORDER IS THE DESIGN. The section is scroll-driven: records unfold top-to-bottom
 * in exactly this sequence, so the array order IS the on-page order. The mandated
 * sequence is Google Cybersecurity → Google AI Essentials → Hackviser CORE →
 * Advent of Cyber 2024 → HTB Salt Crown, with the platform ranking closing it out.
 *
 * `issuer` is the bracketed monospace identity tag on each panel — it replaced the
 * initials-in-a-circle seal, which read as stock-avatar filler rather than a
 * considered mark. `accent` tints only the tag's status glyph, one dot of the
 * issuer's own colour; it is deliberately NOT used as a surface or text colour, so
 * the gold/crimson system stays intact.
 *
 * `imageW`/`imageH` are the intrinsic pixel dimensions. They are rendered as real
 * width/height attributes so the browser reserves the box before decode (no CLS)
 * and never has to guess the ratio — part of the fix for the soft/upscaled look.
 */
export const certs = [
  {
    kind: 'Professional Certificate',
    org: 'Google · Coursera',
    issuer: 'GOOGLE · COURSERA',
    accent: '#4285f4',
    title: 'Google Cybersecurity',
    detail: 'Completed the nine-course professional certificate covering Python, Linux, SQL, SIEM, IDS, threat analysis, incident response and risk mitigation.',
    meta: 'Issued 17 July 2025',
    credential: '6TOC35QGP8U0',
    image: '/certificates/google-cybersecurity-professional.webp',
    imageW: 1743,
    imageH: 1347,
    imageAlt: 'Google Cybersecurity Professional Certificate awarded to Mehmood Lodhi',
    href: 'https://coursera.org/verify/professional-cert/6TOC35QGP8U0',
    action: 'Verify credential'
  },
  {
    kind: 'Course Certificate',
    org: 'Google Career Certificates',
    issuer: 'GOOGLE CAREER CERTS',
    accent: '#4285f4',
    title: 'Google AI Essentials',
    detail: 'Developed practical foundations in prompt engineering, AI-assisted workflows and the responsible use of generative AI — force-multiplying the security craft rather than replacing it.',
    meta: 'Issued 28 June 2026',
    credential: '8ORZ86IP',
    image: '/certificates/google-ai-essentials.webp',
    imageW: 1173,
    imageH: 912,
    imageAlt: 'Google AI Essentials certificate of completion awarded to Mehmood Lodhi',
    href: 'https://www.credly.com/go/8orz86iP',
    action: 'Verify on Credly'
  },
  {
    kind: 'Foundations Certification',
    org: 'Hackviser',
    issuer: 'HACKVISER',
    accent: '#7ee83f',
    title: 'Certified Cybersecurity Foundations (CORE)',
    detail: 'Earned the CORE certification by completing the full training path and its practical security exercises, demonstrating hands-on foundational competence across offensive and defensive fundamentals.',
    meta: 'Issued 6 August 2026',
    credential: 'HV-CORE-7RCCZMDI',
    image: '/certificates/hackviser-core-2026.webp',
    imageW: 2302,
    imageH: 1484,
    imageAlt: 'Hackviser Certified Cybersecurity Foundations (CORE) certificate awarded to Mehmood Lodhi',
    href: 'https://hackviser.com/verify?id=HV-CORE-7RCCZMDI',
    action: 'Verify credential'
  },
  {
    kind: 'Challenge Certificate',
    org: 'TryHackMe',
    issuer: 'TRYHACKME',
    accent: '#88cc14',
    title: 'Advent of Cyber 2024',
    detail: 'Completed all 24 cybersecurity challenges, demonstrating consistency across practical security fundamentals and hands-on problem solving.',
    meta: 'Issued 23 August 2025',
    credential: 'THM-CXPXJZE9DP',
    image: '/certificates/tryhackme-advent-of-cyber-2024.webp',
    imageW: 1684,
    imageH: 1023,
    imageAlt: 'TryHackMe Advent of Cyber 2024 completion certificate awarded to Mehmood Lodhi',
    action: 'Credential THM-CXPXJZE9DP'
  },
  {
    kind: 'Global CTF · Team Result',
    org: 'Hack The Box',
    issuer: 'HACK THE BOX',
    accent: '#9fef00',
    title: 'Cyber Apocalypse 2026: The Salt Crown',
    detail: 'Competed solo under Zero Vector in the five-day global CTF. The team ranked 1,074th of 6,744 teams with 19 of 136 challenges solved and 11,175 points.',
    meta: '24–29 July 2026 · Jeopardy CTF',
    credential: 'ZERO VECTOR · 1074 / 6744',
    image: '/certificates/htb-salt-crown-2026.webp',
    imageW: 1800,
    imageH: 1273,
    imageAlt: 'Hack The Box Cyber Apocalypse 2026 participation certificate showing Zero Vector ranked 1074th',
    href: 'https://www.hackthebox.com/events/cyber-apocalypse-2026',
    action: 'View official event',
    featured: true
  },
  {
    kind: 'Platform Ranking',
    org: 'TryHackMe',
    issuer: 'TRYHACKME',
    accent: '#88cc14',
    title: 'Top 3% Worldwide',
    detail: 'Reached the top three percent of TryHackMe learners after completing more than 85 rooms in penetration testing, privilege escalation, web exploitation and forensics.',
    meta: '85+ hands-on rooms',
    credential: 'GLOBAL RANKING',
    visual: '03%'
  }
];

export const timeline = [
  {
    marker: 'O-Levels',
    title: 'Foundations',
    text: 'Completed O-Levels, the first exposure to computing and the discipline that powers everything since.'
  },
  {
    marker: 'A-Levels',
    title: 'Specialisation',
    text: 'Completed A-Levels and locked the trajectory: security would be the career, not the hobby.'
  },
  {
    marker: 'Cert',
    title: 'Google Cybersecurity Analyst',
    text: 'Earned the Google Cybersecurity Analyst Certificate: SOC workflows, SIEM, detection engineering.'
  },
  {
    marker: 'University',
    title: 'Air University, BS Computer Science',
    text: 'Enrolled in the BS Computer Science program, pairing academic depth with daily hands-on security practice.'
  },
  {
    marker: 'Cert',
    title: 'Google AI Essentials',
    text: 'Completed Google AI Essentials: prompt engineering, AI-assisted workflows and responsible AI — force-multiplying the security craft.'
  },
  {
    marker: 'Now',
    title: 'Top 3% on TryHackMe',
    text: '85+ rooms completed. Advent of Cyber finished. Multiple THM certifications. Still climbing.'
  },
  {
    marker: '2026 CTF',
    title: 'Cyber Apocalypse: The Salt Crown',
    text: 'Competed solo under Zero Vector against 6,744 teams: 19 challenges solved, 11,175 points, and a team finish of 1,074th.'
  },
  {
    marker: 'Cert',
    title: 'Hackviser CORE',
    text: 'Certified Cybersecurity Foundations (CORE) — earned through Hackviser’s training path and its practical, hands-on security exercises.'
  }
];

/**
 * skillMatrix — drives the interactive 3D Skillset Matrix (section 04).
 * Three logical clusters, each rendered as a color-coded constellation of nodes.
 * `level` (0-100) and `tag` feed the hover tooltip / expertise readout.
 * Colors are hex strings consumed directly by both Three.js and the HTML legend.
 */
export const skillMatrix = [
  {
    group: 'Core Tech / Languages',
    color: '#e63950',                 // carmine, matches --crimson accent
    nodes: [
      { name: 'Python',     level: 88, tag: 'Advanced' },
      { name: 'JavaScript', level: 80, tag: 'Proficient' },
      { name: 'Bash',       level: 85, tag: 'Advanced' },
      { name: 'Go',         level: 60, tag: 'Learning' }
    ]
  },
  {
    group: 'Cybersecurity / Tools',
    color: '#c9a962',                 // gold, matches --gold accent
    nodes: [
      { name: 'Nmap',       level: 88, tag: 'Advanced' },
      { name: 'Wireshark',  level: 82, tag: 'Proficient' },
      { name: 'Metasploit', level: 80, tag: 'Proficient' },
      { name: 'Burp Suite', level: 84, tag: 'Advanced' }
    ]
  },
  {
    group: 'Platforms / Frameworks',
    color: '#eef0f2',                 // platinum, the rare cool accent
    nodes: [
      { name: 'Active Directory', level: 78, tag: 'Proficient' },
      { name: 'Linux',            level: 90, tag: 'Expert' },
      { name: 'Docker',           level: 75, tag: 'Proficient' },
      { name: 'React',            level: 72, tag: 'Proficient' }
    ]
  }
];

export const marqueeWords = [
  'CYBERSECURITY', 'PENETRATION TESTING', 'CTF', 'OSINT',
  'NETWORK DEFENSE', 'INCIDENT RESPONSE', 'WEB SECURITY', 'LINUX'
];

export const socials = [
  { label: 'LinkedIn',  href: 'https://www.linkedin.com/in/mehmood-lodhi-79141a370/' },
  { label: 'Instagram', href: 'https://instagram.com/127.0.0.1x' }
];
