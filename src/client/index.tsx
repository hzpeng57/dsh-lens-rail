/**
 * @hzpeng/dsh-lens-rail — web client half.
 *
 * A Codex-style LEFT message navigation rail for the DSH conversation column.
 * A vertical column of short horizontal lines runs down the left edge of the
 * transcript — one line per user turn. Hovering grows the line under the cursor
 * and tapers its neighbours toward the edges in a gaussian "lens" scrubber
 * (the Codex effect); a scroll-spy keeps the current reading position
 * highlighted; clicking a line jumps the transcript to that message (paging
 * older history when necessary).
 *
 * Data: the host `chatRail` projection (durable user-turn enumeration) is the
 * primary source; the loaded chat-node snapshot fills in any lines the
 * projection has not delivered yet. Each anchor carries the durable message id
 * used to reconstruct the `data-chat-anchor-key`. No model-visible input, no
 * tool.
 */

import {
  createElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
// Type-only: pulls the ui-conversation SlotMap merge (the conversation.input.dock
// entry whose standard props include the session store / useProjection hook).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'

// ---- dependency declaration ----
export const inject = ['slots', 'sessions']

// ---- i18n (zh/en) ----
type LocaleId = 'zh' | 'en'
const STRINGS: Record<LocaleId, Record<string, string>> = {
  zh: {
    railLabel: '消息导航',
    roleUser: '用户',
    noText: '（无文本）',
    ariaJump: '跳转到消息',
    loading: '加载中…',
    loadingHistory: '正在加载历史消息…',
  },
  en: {
    railLabel: 'Message rail',
    roleUser: 'User',
    noText: '(no text)',
    ariaJump: 'Jump to message',
    loading: 'Loading…',
    loadingHistory: 'Loading history…',
  },
}

/** Resolve the copy set for the current UI language (document lang, zh/en). */
function langStrings(): Record<string, string> {
  const lang = typeof document !== 'undefined' ? (document.documentElement.lang || 'zh').toLowerCase() : 'zh'
  return STRINGS[lang.startsWith('zh') ? 'zh' : 'en']
}

// ---- styles ----
// The rail hugs the LEFT edge of the conversation scrollport (positioned in JS
// from a measured rect, not the window edge, so it never falls into the
// sidebar). One line per message: a short rounded bar whose width is set inline
// from the gaussian lens taper. CSS owns height/colour/rounding + width anim.
const css = [
  // Rail: fixed, positioned in JS inside the conversation scrollBody — left
  // edge + gutter, vertically centred, capped to 60% of the body height. It
  // scrolls internally when there are many messages; a top/bottom fade mask
  // fades overflowing lines instead of clipping hard.
  '.lensrail_nav{user-select:none;z-index:120;position:fixed;display:flex;flex-direction:column;align-items:stretch;width:30px;box-sizing:border-box;padding:10px 0;pointer-events:none;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 18px,#000 calc(100% - 18px),transparent 100%);mask-image:linear-gradient(to bottom,transparent 0,#000 18px,#000 calc(100% - 18px),transparent 100%)}',
  '.lensrail_nav::-webkit-scrollbar{display:none}',
  // Inner wrapper: margin auto centres the column when shorter than the cap,
  // and collapses to 0 when it overflows so the nav scrolls to every line.
  '.lensrail_inner{margin:auto 0;display:flex;flex-direction:column;align-items:stretch}',
  // One hit block per message. Blocks stack with ZERO gap: the visual spacing
  // between lines is the block's own height (12px) with the 3px bar centred, so
  // moving the pointer vertically never leaves a hover dead-zone (no jumping).
  // The whole 30×12 block is hoverable, not just the bar.
  '.lensrail_item{appearance:none;-webkit-appearance:none;border:none;padding:0;margin:0;background:transparent;font:inherit;color:inherit;text-align:left;outline:none;display:flex;align-items:center;box-sizing:border-box;width:30px;height:12px;flex-shrink:0;cursor:pointer;pointer-events:auto}',
  '.lensrail_item:focus-visible{outline:none}',
  // The visible bar: a 3px rounded line, left-aligned in its block, width driven
  // inline from the gaussian lens taper.
  '.lensrail_line{display:block;box-sizing:border-box;height:3px;border-radius:999px;background:var(--dsw-alias-label-secondary,rgba(0,0,0,.34));transition:width .16s cubic-bezier(.3,0,.2,1),background-color .12s ease;min-width:5px;max-width:30px}',
  'body[data-ds-dark-theme] .lensrail_line,[data-theme="dark"] .lensrail_line,.dark .lensrail_line{background:rgba(255,255,255,.32)}',
  '.lensrail_item.lensrail_active .lensrail_line{background:var(--dsw-alias-state-business-primary,#4d6bfe)}',
  '.lensrail_item.lensrail_hover .lensrail_line{background:var(--dsw-alias-label-primary,rgba(0,0,0,.95))}',
  'body[data-ds-dark-theme] .lensrail_item.lensrail_hover .lensrail_line,[data-theme="dark"] .lensrail_item.lensrail_hover .lensrail_line,.dark .lensrail_item.lensrail_hover .lensrail_line{background:rgba(255,255,255,.95)}',
  '.lensrail_loading{position:absolute;top:2px;left:0;flex-shrink:0;width:8px;height:8px;pointer-events:none}',
  '.lensrail_loading::before{content:"";display:block;width:8px;height:8px;border:1.5px solid var(--dsw-alias-state-business-primary,#4d6bfe);border-top-color:transparent;border-radius:50%;animation:lensrail-spin .8s linear infinite}',
  // Hover preview panel: floats to the right of the focused line. Theme-aware.
  '.lensrail_tip{position:fixed;z-index:200;max-width:380px;max-height:56vh;overflow-y:auto;padding:8px 12px;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-primary,var(--text-primary,rgba(0,0,0,.85)));background:var(--dsw-alias-surface-raised,var(--bg-elevated,rgba(255,255,255,.97)));border:1px solid var(--dsw-alias-border-l2,var(--border-default,rgba(0,0,0,.12)));border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.16);pointer-events:none;white-space:pre-wrap;word-break:break-word}',
  'body[data-ds-dark-theme] .lensrail_tip,[data-theme="dark"] .lensrail_tip,.dark .lensrail_tip{background:var(--dsw-alias-surface-raised,var(--bg-elevated,rgba(28,28,32,.97)));border-color:var(--dsw-alias-border-l2,var(--border-default,rgba(255,255,255,.14)))}',
  // User message: one line, clipped with an ellipsis, emphasized.
  '.lensrail_tipUser{font-weight:500;color:var(--dsw-alias-label-primary,var(--text-primary,rgba(0,0,0,.9)));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  'body[data-ds-dark-theme] .lensrail_tipUser,[data-theme="dark"] .lensrail_tipUser,.dark .lensrail_tipUser{color:rgba(255,255,255,.95)}',
  // Assistant reply: up to three lines, clipped with an ellipsis.
  '.lensrail_tipAssistant{margin-top:6px;color:var(--dsw-alias-label-secondary,var(--text-muted,rgba(0,0,0,.55)));display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}',
  'body[data-ds-dark-theme] .lensrail_tipAssistant,[data-theme="dark"] .lensrail_tipAssistant,.dark .lensrail_tipAssistant{color:rgba(255,255,255,.6)}',
  // Jump-in-progress toast: a prominent centred pill announcing history loading.
  '.lensrail_busy{position:fixed;z-index:210;top:18px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;padding:8px 16px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary,var(--text-primary,rgba(0,0,0,.9)));background:var(--dsw-alias-surface-raised,var(--bg-elevated,rgba(255,255,255,.98)));border:1px solid var(--dsw-alias-border-l2,var(--border-default,rgba(0,0,0,.12)));border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.18);pointer-events:none}',
  'body[data-ds-dark-theme] .lensrail_busy,[data-theme="dark"] .lensrail_busy,.dark .lensrail_busy{color:rgba(255,255,255,.95);background:var(--dsw-alias-surface-raised,var(--bg-elevated,rgba(28,28,32,.98)));border-color:var(--dsw-alias-border-l2,var(--border-default,rgba(255,255,255,.14)))}',
  '.lensrail_busy::before{content:"";flex-shrink:0;width:12px;height:12px;border:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);border-top-color:transparent;border-radius:50%;animation:lensrail-spin .8s linear infinite}',
  '@keyframes lensrail-spin{to{transform:rotate(360deg)}}',
  '@media (prefers-reduced-motion:reduce){.lensrail_line{transition:none}.lensrail_loading::before{animation:none}}',
].join('')

const STYLE_ID = '@hzpeng/dsh-lens-rail/styles'
if (typeof document !== 'undefined' && document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`) === null) {
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-lens-rail'
  tag.dataset.pluginCss = STYLE_ID
  tag.textContent = css
  document.head.appendChild(tag)
}

const S = {
  nav: 'lensrail_nav',
  inner: 'lensrail_inner',
  item: 'lensrail_item',
  line: 'lensrail_line',
  active: 'lensrail_active',
  hover: 'lensrail_hover',
  loading: 'lensrail_loading',
  busy: 'lensrail_busy',
  tip: 'lensrail_tip',
  tipUser: 'lensrail_tipUser',
  tipAssistant: 'lensrail_tipAssistant',
}

// ---- data helpers ----
const NOOP_STORE = { getSnapshot: () => undefined, subscribe: () => () => {} }

interface RailMessage {
  /** Chat node `.key` — equals the row's `data-chat-anchor-key`. */
  key: string
  seq: number
  time: number
  text: string
  /** Joined assistant reply text following this user turn (may be empty). */
  assistantText: string
  kind: string
}

/** Reconstruct the `data-chat-anchor-key` for a durable user-message id. */
function anchorKeyOf(id: string): string {
  return `13:input-message${id}`
}

/** Extract a short preview from a ContentBlock/AssistantBlock list. */
function textOf(content: unknown): string {
  if (!Array.isArray(content)) return ''
  let out = ''
  for (const block of content) {
    if (block !== null && typeof block === 'object'
      && (block as { type?: unknown }).type === 'text'
      && typeof (block as { text?: unknown }).text === 'string') {
      out += (block as { text: string }).text
    }
  }
  return out.trim().slice(0, 80)
}

/** Normalize one `chatRail` projection entry (durable form) to a rail message. */
function normalizeProjected(m: unknown): RailMessage | null {
  if (m === null || typeof m !== 'object') return null
  const o = m as Record<string, unknown>
  // Projection entries carry seq/time/text/id (host form). Older blobs may have
  // carried `key`; accept both so a cached wire view still renders.
  const id = typeof o.id === 'string' ? o.id : ''
  const key = typeof o.key === 'string' ? o.key : (id !== '' ? anchorKeyOf(id) : '')
  if (key === '') return null
  return {
    key,
    seq: typeof o.seq === 'number' ? o.seq : 0,
    time: typeof o.time === 'number' ? o.time : 0,
    text: typeof o.text === 'string' ? o.text : (typeof o.preview === 'string' ? o.preview : ''),
    assistantText: typeof o.assistantText === 'string' ? o.assistantText : '',
    kind: 'user',
  }
}

/** Fallback enumerator: collect user + assistant rows from the chat snapshot. */
function collectFromNodes(snapshot: unknown): RailMessage[] {
  const out: RailMessage[] = []
  if (snapshot === undefined || (snapshot as { chat?: unknown }).chat === undefined) return out
  const chat = (snapshot as { chat: { nodes?: { values(): Iterable<unknown> } } }).chat
  if (!chat.nodes) return out
  for (const node of chat.nodes.values()) {
    if (node === null || typeof node !== 'object') continue
    const n = node as { kind?: unknown; key?: unknown; seq?: unknown; anchorSeq?: unknown; data?: unknown }
    const kind = n.kind
    if (kind !== 'user' && kind !== 'assistant') continue
    if (typeof n.key !== 'string' || n.key === '') continue
    const data = n.data as { time?: unknown; content?: unknown; blocks?: unknown } | null
    const body = data !== null && typeof data === 'object' ? (data.content ?? data.blocks) : undefined
    out.push({
      key: n.key,
      kind: kind as string,
      seq: typeof n.anchorSeq === 'number' ? n.anchorSeq : (!Number.isNaN(Number(n.seq)) ? Number(n.seq) : 0),
      time: (data !== null && typeof data === 'object' && typeof data.time === 'number') ? data.time : 0,
      text: textOf(body),
      assistantText: '',
    })
  }
  out.sort((a, b) => a.seq - b.seq)
  return out
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Ensure the target message node is in the loaded window, then scroll to its
 * DOM row. `loadOlder` pages 50 messages at a time, so a jump far back loops
 * (with a guard) and polls for the row, which materialises once React renders
 * the prepended page.
 */
async function jumpToMessage(
  sessionsService: { binding: (id: string) => { session?: { getSnapshot(): unknown; loadOlder(): Promise<unknown>; hasMore?: boolean; loadingOlder?: boolean } } | undefined },
  sessionId: string,
  key: string,
  onProgress?: (pages: number) => void,
  signal?: AbortSignal,
): Promise<boolean> {
  const session = sessionsService.binding(sessionId)?.session
  if (session === undefined) return false
  let pages = 0
  let guard = 0
  let loaded = false
  while (guard++ < 120) {
    if (signal?.aborted) return false
    const snapshot = session.getSnapshot() as { chat?: { nodes?: { get(k: string): unknown } }; hasMore?: boolean; loadingOlder?: boolean } | undefined
    if (snapshot?.chat?.nodes?.get(key) !== undefined) {
      loaded = true
      break
    }
    if (snapshot?.hasMore !== true) break
    if (snapshot.loadingOlder === true) { await delay(50); continue }
    await session.loadOlder()
    pages++
    onProgress?.(pages)
  }
  if (!loaded) {
    console.warn(`[lens-rail] jumpToMessage: node "${key}" not loaded after ${pages} page(s)`)
    return false
  }
  const scrollport = typeof document !== 'undefined' ? document.querySelector('[data-conversation-scroll]') : null
  if (scrollport === null) return false
  let row: Element | null = null
  let waited = 0
  while (waited++ < 100) {
    if (signal?.aborted) return false
    row = scrollport.querySelector(`[data-chat-anchor-key="${CSS.escape(key)}"]`)
    if (row !== null) break
    await delay(50)
  }
  if (row === null) return false
  const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  row.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
  return true
}

// ---- component ----
function LensRail({ useProjection, sessionId, sessionsService }: {
  useProjection?: (key: string) => { messages?: unknown[] } | undefined
  sessionId?: string
  sessionsService: { binding: (id: string) => { session?: { subscribe(cb: () => void): () => void; getSnapshot(): unknown } } | undefined }
}): ReactNode {
  const t = langStrings()

  // Preferred source: the durable host projection. `useProjection` is a
  // framework-standard prop on session-scoped slots; guard its absence.
  const projected = typeof useProjection === 'function' ? useProjection('chatRail') : undefined

  // Fallback source: the live chat-node snapshot (covers rows the projection
  // has not delivered, plus assistant rows).
  const session = sessionId === undefined ? undefined : (sessionsService.binding(sessionId) as { session?: { subscribe(cb: () => void): () => void; getSnapshot(): unknown } } | undefined)?.session
  const fallbackStore = session === undefined ? NOOP_STORE : session
  const nodeSnapshot = useSyncExternalStore(
    (cb) => fallbackStore.subscribe(cb),
    () => fallbackStore.getSnapshot(),
  )

  const messages = useMemo<RailMessage[]>(() => {
    const proj = Array.isArray(projected?.messages)
      ? projected.messages.map(normalizeProjected).filter((m): m is RailMessage => m !== null)
      : []
    if (proj.length > 0) return proj
    return collectFromNodes(nodeSnapshot)
  }, [projected, nodeSnapshot])

  const [activeIndex, setActiveIndex] = useState(-1)
  const [hoverIndex, setHoverIndex] = useState(-1)
  const [jumping, setJumping] = useState(false)
  // Hover preview panel: index of the hovered line + a fixed viewport position.
  const [tip, setTip] = useState<{ index: number; x: number; y: number } | null>(null)
  const jumpAbortRef = useRef<AbortController | null>(null)
  const navRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => () => jumpAbortRef.current?.abort(), [])

  // Position against the conversation scrollBody (`[data-conversation-scroll]`
  // == the `wSkVaW_scrollBody` column): left edge + a small gutter, vertically
  // centred, capped to 60% of the scroll body height. The rail stays INSIDE
  // the scroll body, clear of the sidebar and the message text column.
  const [navPos, setNavPos] = useState<{ left: number; top: number; height: number } | null>(null)
  useEffect(() => {
    if (sessionId === undefined) return
    const measure = () => {
      const sp = document.querySelector('[data-conversation-scroll]')
      if (sp === null) return
      const r = sp.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      const height = Math.round(r.height * 0.6)
      // Vertically centre the (fixed-height) rail inside the scroll body:
      // top = body top + half the remaining space.
      const top = r.top + Math.round((r.height - height) / 2)
      setNavPos({ left: r.left, top, height })
    }
    measure()
    const sp = document.querySelector('[data-conversation-scroll]')
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver === 'function' && sp !== null) {
      ro = new ResizeObserver(() => measure())
      ro.observe(sp)
    }
    window.addEventListener('resize', measure)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [sessionId])

  // Scroll-spy: active line = message row nearest the 40% viewport line.
  useEffect(() => {
    if (messages.length === 0) return
    const indexByKey = new Map<string, number>()
    for (let i = 0; i < messages.length; i++) indexByKey.set(messages[i].key, i)
    const updateActive = () => {
      const sp = document.querySelector('[data-conversation-scroll]')
      if (sp === null) return
      const rect = sp.getBoundingClientRect()
      if (rect.height === 0) return
      const line = rect.top + rect.height * 0.4
      const rows = sp.querySelectorAll('[data-chat-anchor-key]')
      let best = -1
      let bestDist = Infinity
      for (const row of rows) {
        const key = row.getAttribute('data-chat-anchor-key')
        if (key === null) continue
        const idx = indexByKey.get(key) ?? -1
        if (idx === -1) continue
        const r = row.getBoundingClientRect()
        const dist = Math.abs(r.top + r.height / 2 - line)
        if (dist < bestDist) { bestDist = dist; best = idx }
      }
      setActiveIndex(best)
    }
    updateActive()
    const el = document.querySelector('[data-conversation-scroll]')
    let scrollTimer: ReturnType<typeof setTimeout> | null = null
    const onScroll = () => {
      if (scrollTimer !== null) return
      scrollTimer = setTimeout(() => { scrollTimer = null; updateActive() }, 60)
    }
    el?.addEventListener('scroll', onScroll, { passive: true })
    const timer = window.setInterval(updateActive, 2000)
    return () => {
      el?.removeEventListener('scroll', onScroll)
      window.clearInterval(timer)
      if (scrollTimer !== null) clearTimeout(scrollTimer)
    }
  }, [sessionId, messages.length])

  // Preload the transcript's older history in the background. The rail's lines
  // come from the durable projection (so every user turn has a line regardless
  // of paging), but the hover preview reads the loaded chat node's full text.
  // Paging older history here also makes jump targets resolve faster and lets a
  // long session's earliest turns appear in the snapshot. Stops once the host
  // reports no more history, and stops early once the projection delivers.
  useEffect(() => {
    if (session === undefined) return
    if (Array.isArray(projected?.messages) && projected.messages.length > 0) return
    let cancelled = false
    const run = async () => {
      let guard = 0
      while (!cancelled && guard++ < 120) {
        if (Array.isArray(projected?.messages) && projected.messages.length > 0) return
        const snap = session.getSnapshot() as { hasMore?: boolean; loadingOlder?: boolean }
        if (snap?.hasMore !== true) return
        if (snap.loadingOlder === true) { await delay(50); continue }
        await (session as unknown as { loadOlder(): Promise<unknown> }).loadOlder()
      }
    }
    run().catch(() => {})
    return () => { cancelled = true }
  }, [sessionId, session === undefined ? 'none' : 'ready', Array.isArray(projected?.messages) && projected.messages.length > 0 ? 'have' : 'none'])

  if (sessionId === undefined || messages.length < 1 || navPos === null) return null

  // ---- lens taper ----
  // Only hovering drives the width profile (the Codex effect). With no hover
  // every line stays at BASE width; scrolling does NOT change their length.
  // The taper is LINEAR: the focused line is MAX, each step away shrinks by a
  // fixed amount, and by SPAN steps out it is back to BASE (Codex reaches the
  // resting length 4 lines from the focused one). The active (reading-position)
  // line is still tinted brand colour but follows the same width rule.
  const focus = hoverIndex
  const BASE = 8      // resting (unfocused) width, px
  const MAX = 30      // focused width, px
  const SPAN = 4      // lines over which the taper falls back to BASE
  const widthOf = (i: number): number => {
    if (focus < 0) return BASE
    const d = Math.abs(i - focus)
    if (d >= SPAN) return BASE
    const w = BASE + (MAX - BASE) * (1 - d / SPAN)
    return Math.round(w * 10) / 10
  }

  const items = messages.map((m, i) => {
    const isActive = activeIndex === i
    const isHover = hoverIndex === i
    return createElement('button', {
      type: 'button',
      key: m.key,
      'data-lens-index': String(i),
      'aria-label': `${t.roleUser}: ${m.text || t.noText} (${t.ariaJump})`,
      'aria-current': isActive ? 'location' : undefined,
      disabled: jumping,
      className: S.item + (isActive ? ` ${S.active}` : '') + (isHover ? ` ${S.hover}` : ''),
      onMouseEnter: () => {
        setHoverIndex(i)
        // Position the preview panel to the right of this row, vertically
        // aligned to it. The row's rect is only meaningful once mounted; we
        // read it per enter so the panel tracks the focused row.
        const el = navRef.current?.querySelector<HTMLElement>(`[data-lens-index="${i}"]`)
        if (el !== null && el !== undefined) {
          const r = el.getBoundingClientRect()
          setTip({ index: i, x: r.right + 10, y: r.top + r.height / 2 })
        }
      },
      onMouseLeave: () => {
        setHoverIndex((prev) => (prev === i ? -1 : prev))
        setTip((prev) => (prev?.index === i ? null : prev))
      },
      onClick: () => {
        if (jumping) return
        setTip(null)
        jumpAbortRef.current?.abort()
        const controller = new AbortController()
        jumpAbortRef.current = controller
        setJumping(true)
        void jumpToMessage(sessionsService as never, sessionId as string, m.key, undefined, controller.signal)
          .finally(() => setJumping(false))
      },
    }, createElement('span', {
      className: S.line,
      style: { width: `${widthOf(i)}px` },
      'aria-hidden': true,
    }))
  })

  return createPortal(
    // Fragment: the nav and the tip preview must be siblings — a fixed child
    // inside a transformed/fixed ancestor is positioned relative to that
    // ancestor, breaking the viewport coordinates the tip uses.
    [
      createElement('div', {
        ref: navRef,
        className: S.nav,
        role: 'navigation',
        'aria-label': t.railLabel,
        onMouseLeave: () => { setHoverIndex(-1); setTip(null) },
        style: {
          left: `${navPos.left + 8}px`,
          top: `${navPos.top}px`,
          height: `${navPos.height}px`,
        },
        children: [
          createElement('div', {
            className: S.inner,
            children: [
              jumping ? createElement('div', { className: S.loading, key: 'loading', 'aria-hidden': true }) : null,
              ...items,
            ],
          }),
        ],
      }),
      // Hover preview panel: the user message (one line, emphasized) and the
      // assistant reply (up to three lines), each clipped with an ellipsis.
      tip !== null && tip.index >= 0 && tip.index < messages.length
        ? createElement('div', {
            className: S.tip,
            style: { left: `${tip.x}px`, top: `${tip.y}px`, transform: 'translateY(-50%)' },
            'aria-hidden': true,
          }, (() => {
            const m = messages[tip.index]
            const children = [
              createElement('div', { key: 'user', className: S.tipUser }, m.text || t.noText),
            ]
            if (m.assistantText !== '') {
              children.push(createElement('div', { key: 'assistant', className: S.tipAssistant }, m.assistantText))
            }
            return children
          })())
        : null,
      // Prominent jump-in-progress toast (history is being paged in).
      jumping
        ? createElement('div', { className: S.busy, key: 'busy', role: 'status', 'aria-live': 'polite' }, t.loadingHistory)
        : null,
    ],
    document.body,
  )
}

function apply(ctx: { slots: { inject(name: string, cb: () => void): void; register(opts: object, comp: unknown): unknown }; sessions: { binding(id: string): unknown } }): void {
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'dsh-lens-rail',
    order: 50,
    inject: () => ({
      sessionsService: ctx.sessions,
    }),
  }, LensRail))
}

export { apply, LensRail, collectFromNodes, normalizeProjected }
