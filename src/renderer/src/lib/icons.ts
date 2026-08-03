/**
 * 统一线性图标 path 库（24×24 viewBox，stroke 1.8，与侧边栏图标同风格）。
 * 由 AppIcon.vue 渲染，颜色继承 currentColor。
 */
export const ICON_PATHS: Record<string, string> = {
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.7-1.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 2-2 5 4"/>',
  file: '<path d="M6 2.5h8l4 4V21H6Z"/><path d="M14 2.5V7h4"/>',
  paperclip: '<path d="m20.5 11.5-8.8 8.8a5 5 0 0 1-7.1-7.1l9.2-9.2a3.5 3.5 0 0 1 5 5l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
  monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  pin: '<path d="M12 17v5"/><path d="M8 4h8l-1 7 3 3H6l3-3-1-7Z"/>',
  play: '<path d="M7 5.5v13l11-6.5Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  'skip-forward': '<path d="M5 5.5v13l9-6.5Z"/><path d="M19 5v14"/>',
  'rotate-ccw': '<path d="M3 12a9 9 0 1 0 2.6-6.3L3 8"/><path d="M3 3v5h5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M12 11v5"/>',
  bell: '<path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10.5 19.5a2 2 0 0 0 3 0"/>',
  tomato:
    '<circle cx="12" cy="13.5" r="7.2"/><path d="M12 6.3c-.4-1.9.5-3.3 1.9-3.8"/><path d="M12 6.3c-2-.8-3.9-.3-5 .9M12 6.3c2-.8 3.9-.3 5 .9"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9.5v3.5l2.4 2.4"/><path d="M10 2.5h4"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  coins:
    '<ellipse cx="12" cy="7.5" rx="8" ry="3.5"/><path d="M4 7.5v9c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5v-9"/><path d="M4 12c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5"/>',
  drop: '<path d="M12 3s6 6.2 6 10.5a6 6 0 1 1-12 0C6 9.2 12 3 12 3Z"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  hourglass:
    '<path d="M7 2h10M7 22h10"/><path d="M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4A2 2 0 0 0 7 17.8V22"/><path d="M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4A2 2 0 0 0 17 6.2V2"/>',
  sparkle:
    '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"/><path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z"/>',
  seed: '<path d="M12 20.5v-7.5"/><path d="M12 13c-3.6 0-6.1-2.6-6.6-6.2C9 7.3 11.5 9.4 12 13Z"/><path d="M12 12c3-.5 5.1-2.4 5.6-5.4C14.6 7.1 12.6 8.9 12 12Z"/>',
  tree: '<path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z"/><path d="M12 22v-3"/>',
  forest:
    '<path d="M8 21v-2M16.5 21v-2"/><path d="M8 5l3.4 4.8H9.9L12.8 14H3.2l2.9-4.2H4.6Z"/><path d="M16.5 8.5l2.9 3.9h-1.3l2.4 3.4h-8l2.4-3.4h-1.3Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  flame:
    '<path d="M12 2.5c2.8 3.3 5.7 6 5.7 10a5.7 5.7 0 0 1-11.4 0c0-2.4 1.4-4.3 2.8-5.7.3 1.4 1 2.4 1.9 3 .3-2.3.7-4.9 1-7.3Z"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5Z"/><path d="M3 13.5l9 5 9-5"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12h.01"/>',
  medal: '<circle cx="12" cy="15" r="5.5"/><path d="M9.3 10.4 6.5 3h4.2l1.3 3.4L13.3 3h4.2l-2.8 7.4"/>',
  lantern:
    '<path d="M9 21.5h6M12 18.5v3"/><rect x="8" y="8.5" width="8" height="8" rx="1.6"/><path d="M7 8.5l5-4.5 5 4.5"/><path d="M12 11v3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.2 9a3 3 0 0 1 5.8 1c0 2-3 2.4-3 4"/><path d="M12 17.5h.01"/>',
  warning: '<path d="M12 3 2.5 19.5h19Z"/><path d="M12 10v4M12 16.8h.01"/>',
  coffee:
    '<path d="M17 8.5h1a3 3 0 0 1 0 6h-1"/><path d="M4 8.5h13v5.5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z"/><path d="M7 3v2M11 3v2M15 3v2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M16 2.5v4M8 2.5v4M3 10.5h18"/>',
  note: '<path d="M17 3.5 20.5 7 8.5 19H5v-3.5Z"/><path d="M14.5 6l3.5 3.5"/>',
  folder:
    '<path d="M4 20h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-8.6a1 1 0 0 1-.8-.4L9.2 4.4A1 1 0 0 0 8.4 4H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1Z"/>',
  inbox:
    '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1Z"/>',
  locate: '<path d="M2 12h3M19 12h3M12 2v3M12 19v3"/><circle cx="12" cy="12" r="6"/><path d="M12 12h.01"/>'
}
