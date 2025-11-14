import { apiRequest } from './api'

export interface AboutContent {
  heroTitle: string
  heroTagline: string
  introParagraph: string
  whatsNewHeading: string
  whatsNewBody: string
  outroParagraph: string
}

export const FALLBACK_ABOUT_CONTENT: AboutContent = {
  heroTitle: 'Terminality OS',
  heroTagline: 'A Retro-Futuristic Operating System Simulation',
  introParagraph: 'Terminality is an immersive single-player mystery game that blends puzzle solving, deep online investigations, and narrative exploration within a retro terminal-based operating system simulation. Uncover secrets, solve cryptic puzzles, and navigate through a mysterious digital world shrouded in intrigue.',
  whatsNewHeading: "What's new in this release",
  whatsNewBody: 'Online Chat received a major update — notifications now carry actionable intents so clicking a chat notification opens and focuses the Online Chat window and jumps directly to the target room or DM. The chat UI was streamlined for faster messaging, and DMs plus presence indicators have been added. See the changelog for full details.',
  outroParagraph: 'Experience a fully-functional desktop environment with authentic window management, file systems, applications, and network simulations—all running in your browser.'
}

interface AboutResponse {
  content: AboutContent
}

function mergeContent(data?: AboutContent | null): AboutContent {
  if (!data) return FALLBACK_ABOUT_CONTENT
  return {
    heroTitle: data.heroTitle || FALLBACK_ABOUT_CONTENT.heroTitle,
    heroTagline: data.heroTagline || FALLBACK_ABOUT_CONTENT.heroTagline,
    introParagraph: data.introParagraph || FALLBACK_ABOUT_CONTENT.introParagraph,
    whatsNewHeading: data.whatsNewHeading || FALLBACK_ABOUT_CONTENT.whatsNewHeading,
    whatsNewBody: data.whatsNewBody || FALLBACK_ABOUT_CONTENT.whatsNewBody,
    outroParagraph: data.outroParagraph || FALLBACK_ABOUT_CONTENT.outroParagraph
  }
}

export async function fetchAboutContent(): Promise<AboutContent> {
  try {
    const res = await apiRequest<AboutResponse>('/api/about', { auth: true })
    return mergeContent(res.content)
  } catch (_err) {
    return FALLBACK_ABOUT_CONTENT
  }
}

export async function updateAboutContent(content: AboutContent): Promise<AboutContent> {
  const res = await apiRequest<AboutResponse>('/api/about', { method: 'PUT', auth: true, body: { content } })
  return mergeContent(res.content)
}
