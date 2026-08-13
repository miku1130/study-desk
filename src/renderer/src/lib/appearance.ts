export type ResolvedTheme = 'light' | 'dark'

/** theme 为 system 时由系统偏好决定 */
export function resolveThemeMode(
  theme: 'system' | 'light' | 'dark',
  prefersDark: boolean
): ResolvedTheme {
  if (theme === 'system') return prefersDark ? 'dark' : 'light'
  return theme
}

/**
 * 取当前主题下的强调色。
 *
 * 同一个颜色在奶油白和深灰底上观感差很远：浅色下清爽的薄荷，深色下会发灰糊掉。
 * 所以两套主题各存一个颜色；老配置只有一个 accent 时深色沿用它，
 * 不然用户会发现自己挑的紫色一切到深色就没了。
 */
export function activeAccentOf(
  colors: { accent: string; accentDark: string },
  mode: ResolvedTheme
): string {
  if (mode === 'dark') return colors.accentDark || colors.accent
  return colors.accent
}

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
