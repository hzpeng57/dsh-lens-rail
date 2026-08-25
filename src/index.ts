/**
 * @hzpeng/dsh-lens-rail — host half.
 *
 * Registers a `chatRail` session projection unit: a complete, durable
 * enumeration of the session's USER-sent messages (seq / time / preview /
 * durable message id). The client rail needs a dependable anchor per message to
 * render its scrubber; a host projection survives paging and compaction, unlike
 * the loaded chat-node window (which only covers the visible page).
 *
 * Assistant replies are excluded from the projection (they carry no stable top
 * level id to reconstruct a DOM anchor), so the rail anchors on user turns;
 * the client still reads assistant rows from the loaded chat-node snapshot when
 * it can, keeping the rail to one line per user turn by default.
 */

export const name = 'dsh-lens-rail'
export const inject: string[] = []

const PROJECTION_KEY = 'chatRail'
const MAX_TEXT_CHARS = 80

/** Join the text blocks of a host-side ContentBlock list. */
function textOf(content: unknown): string {
  if (!Array.isArray(content)) return ''
  let out = ''
  for (const block of content) {
    if (block !== null && typeof block === 'object' && (block as { type?: unknown }).type === 'text'
      && typeof (block as { text?: unknown }).text === 'string') {
      out += (block as { text: string }).text
    }
  }
  return out.trim().slice(0, MAX_TEXT_CHARS)
}

export interface ChatRailAnchor {
  /** Event seq (ordering). */
  seq: number
  /** Event time (of the user turn). */
  time: number
  /** User message preview (capped). */
  text: string
  /** Durable message id used to reconstruct the chat node anchor for jumping. */
  id: string
  /** The assistant reply(ies) following this turn, joined (capped). */
  assistantText: string
}

const MAX_ASSISTANT_CHARS = 600

const messageIndexProjectionDefinition = {
  key: PROJECTION_KEY,
  // Wire-visible projection: it must reach the client snapshot (baseline replay
  // or push frames) so `useProjection('chatRail')` can read the enumeration.
  // A unit registered after events flowed folds `init` over the in-memory log
  // on first read, so the full history (including un-loaded old messages) is
  // replayed and enumerated — the source of the "lines exist even for lazy
  // loaded messages" guarantee.
  stateSchema: { parse: (val: unknown) => val },
  init: () => ({ messages: [] as ChatRailAnchor[] }),
  apply: (state: { messages: ChatRailAnchor[] }, event: { type: string; seq: number; time: number; data: unknown }): { messages: ChatRailAnchor[] } => {
    if (event.type === 'user/message') {
      const data = event.data as { source?: { kind?: string } | null; content?: unknown; id?: unknown } | null
      if (data === null || typeof data !== 'object' || data.source === null
        || typeof data.source !== 'object' || data.source.kind !== 'user') {
        return state
      }
      const text = textOf(data.content)
      const id = typeof data.id === 'string' ? data.id : ''
      if (!id) return state
      return {
        messages: [...state.messages, {
          seq: event.seq,
          time: event.time,
          text,
          id,
          assistantText: '',
        }],
      }
    }
    if (event.type === 'assistant/message') {
      // Append this assistant reply to the most recent user turn. Replies arrive
      // after their user turn in seq order, so the tail entry is the owner.
      const data = event.data as { message?: { content?: unknown } } | null
      const atext = textOf(data?.message?.content)
      if (atext === '') return state
      const messages = state.messages
      if (messages.length === 0) return state
      const last = messages[messages.length - 1]
      const merged = (last.assistantText + '\n' + atext).trim().slice(0, MAX_ASSISTANT_CHARS)
      const next = messages.slice(0, -1)
      next.push({ ...last, assistantText: merged })
      return { messages: next }
    }
    return state
  },
  wire: {
    viewSchema: { parse: (val: unknown) => val },
    view: (state: { messages: ChatRailAnchor[] }) => state,
  },
  stateVersion: 7,
}

const Config = {
  '~standard': {
    version: 1,
    vendor: 'dsh-lens-rail',
    validate: (value: unknown) => ({ value: value ?? {} }),
  },
}

function apply(ctx: { inject: (deps: string[], fn: (c: { sessionProjections: { register: (d: unknown) => void } }) => void) => void }): void {
  ctx.inject(['sessionProjections'], (projectionCtx) => {
    projectionCtx.sessionProjections.register(messageIndexProjectionDefinition)
  })
}

export { apply, Config }
