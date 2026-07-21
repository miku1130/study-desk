export interface GlassSurfaceAlphas {
  sidebar: number
  content: number
  card: number
  raised: number
  muted: number
  sidebarBlur: number
  sidebarSaturation: number
  toolbarBlur: number
  sidebarShadow: number
}

const OPAQUE_SURFACES: GlassSurfaceAlphas = {
  sidebar: 0.96,
  content: 0.94,
  card: 0.92,
  raised: 1,
  muted: 1,
  sidebarBlur: 28,
  sidebarSaturation: 125,
  toolbarBlur: 18,
  sidebarShadow: 0.045
}

const CLEAR_SURFACES: GlassSurfaceAlphas = {
  sidebar: 0,
  content: 0,
  card: 0.16,
  raised: 0.24,
  muted: 0.2,
  sidebarBlur: 0,
  sidebarSaturation: 100,
  toolbarBlur: 0,
  sidebarShadow: 0
}

export function getGlassSurfaceAlphas(transparency: number): GlassSurfaceAlphas {
  const amount = Math.min(1, Math.max(0, transparency))

  return {
    sidebar: interpolate(OPAQUE_SURFACES.sidebar, CLEAR_SURFACES.sidebar, amount),
    content: interpolate(OPAQUE_SURFACES.content, CLEAR_SURFACES.content, amount),
    card: interpolate(OPAQUE_SURFACES.card, CLEAR_SURFACES.card, amount),
    raised: interpolate(OPAQUE_SURFACES.raised, CLEAR_SURFACES.raised, amount),
    muted: interpolate(OPAQUE_SURFACES.muted, CLEAR_SURFACES.muted, amount),
    sidebarBlur: interpolate(OPAQUE_SURFACES.sidebarBlur, CLEAR_SURFACES.sidebarBlur, amount),
    sidebarSaturation: interpolate(
      OPAQUE_SURFACES.sidebarSaturation,
      CLEAR_SURFACES.sidebarSaturation,
      amount
    ),
    toolbarBlur: interpolate(OPAQUE_SURFACES.toolbarBlur, CLEAR_SURFACES.toolbarBlur, amount),
    sidebarShadow: interpolate(
      OPAQUE_SURFACES.sidebarShadow,
      CLEAR_SURFACES.sidebarShadow,
      amount
    )
  }
}

function interpolate(from: number, to: number, amount: number): number {
  return Number((from + (to - from) * amount).toFixed(3))
}
