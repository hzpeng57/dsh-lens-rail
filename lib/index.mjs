//#region src/index.ts
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
const name = "dsh-lens-rail";
const inject = [];
const PROJECTION_KEY = "chatRail";
const MAX_TEXT_CHARS = 80;
/** Join the text blocks of a host-side ContentBlock list. */
function textOf(content) {
	if (!Array.isArray(content)) return "";
	let out = "";
	for (const block of content) if (block !== null && typeof block === "object" && block.type === "text" && typeof block.text === "string") out += block.text;
	return out.trim().slice(0, MAX_TEXT_CHARS);
}
const MAX_ASSISTANT_CHARS = 600;
const messageIndexProjectionDefinition = {
	key: PROJECTION_KEY,
	stateSchema: { parse: (val) => val },
	init: () => ({ messages: [] }),
	apply: (state, event) => {
		if (event.type === "user/message") {
			const data = event.data;
			if (data === null || typeof data !== "object" || data.source === null || typeof data.source !== "object" || data.source.kind !== "user") return state;
			const text = textOf(data.content);
			const id = typeof data.id === "string" ? data.id : "";
			if (!id) return state;
			return { messages: [...state.messages, {
				seq: event.seq,
				time: event.time,
				text,
				id,
				assistantText: ""
			}] };
		}
		if (event.type === "assistant/message") {
			const data = event.data;
			const atext = textOf(data?.message?.content);
			if (atext === "") return state;
			const messages = state.messages;
			if (messages.length === 0) return state;
			const last = messages[messages.length - 1];
			const merged = (last.assistantText + "\n" + atext).trim().slice(0, MAX_ASSISTANT_CHARS);
			const next = messages.slice(0, -1);
			next.push({
				...last,
				assistantText: merged
			});
			return { messages: next };
		}
		return state;
	},
	wire: {
		viewSchema: { parse: (val) => val },
		view: (state) => state
	},
	stateVersion: 7
};
const Config = { "~standard": {
	version: 1,
	vendor: "dsh-lens-rail",
	validate: (value) => ({ value: value ?? {} })
} };
function apply(ctx) {
	ctx.inject(["sessionProjections"], (projectionCtx) => {
		projectionCtx.sessionProjections.register(messageIndexProjectionDefinition);
	});
}
//#endregion
export { Config, apply, inject, name };
