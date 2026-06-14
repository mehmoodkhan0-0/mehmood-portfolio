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

export const certs = [
  {
    org: 'Google Cybersecurity',
    title: 'Analyst Certificate',
    detail: 'SIEM tooling, threat detection, incident response, Linux & Python for security operations.'
  },
  {
    org: 'TryHackMe AOC',
    title: 'Advent of Cyber',
    detail: 'Completed the full Advent of Cyber series \u2014 daily hands-on offensive and defensive labs.'
  },
  {
    org: 'TryHackMe',
    title: 'Top 4% Worldwide',
    detail: '85+ rooms across pentesting, privilege escalation, web exploitation and digital forensics.'
  }
];

export const timeline = [
  {
    marker: 'O-Levels',
    title: 'Foundations',
    text: 'Completed O-Levels — first exposure to computing and the discipline that powers everything since.'
  },
  {
    marker: 'A-Levels',
    title: 'Specialisation',
    text: 'Completed A-Levels and locked the trajectory: security would be the career, not the hobby.'
  },
  {
    marker: 'Cert',
    title: 'Google Cybersecurity Analyst',
    text: 'Earned the Google Cybersecurity Analyst Certificate — SOC workflows, SIEM, detection engineering.'
  },
  {
    marker: 'University',
    title: 'Air University — BS Cybersecurity',
    text: 'Enrolled in the BS Cybersecurity program, pairing academic depth with daily hands-on practice.'
  },
  {
    marker: 'Now',
    title: 'Top 4% on TryHackMe',
    text: '85+ rooms completed. Advent of Cyber finished. Multiple THM certifications. Still climbing.'
  }
];

export const missions = [
  {
    tag: '85+ ROOMS',
    title: 'The TryHackMe Grind',
    text: 'Daily lab work across privilege escalation, Active Directory, web exploitation and forensics. Consistency over intensity — every single day.'
  },
  {
    tag: 'AOC',
    title: 'Advent of Cyber',
    text: 'Completed the full seasonal challenge series: a month of daily offensive and defensive scenarios under time pressure.'
  },
  {
    tag: 'CTF',
    title: 'Capture The Flag',
    text: 'Competitive problem-solving across crypto, reversing, web and misc categories. Where theory gets stress-tested.'
  },
  {
    tag: 'OSINT',
    title: 'Open-Source Intelligence',
    text: 'Profiling targets from public data — the reconnaissance discipline that decides engagements before they start.'
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
