window.__ModuleLoader__.load({
	id: "@hzpeng/dsh-lens-rail",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom = require("react-dom");
		//#region src/client/index.tsx
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
		const inject = ["slots", "sessions"];
		const STRINGS = {
			zh: {
				railLabel: "消息导航",
				roleUser: "用户",
				noText: "（无文本）",
				ariaJump: "跳转到消息",
				loading: "加载中…",
				loadingHistory: "正在加载历史消息…"
			},
			en: {
				railLabel: "Message rail",
				roleUser: "User",
				noText: "(no text)",
				ariaJump: "Jump to message",
				loading: "Loading…",
				loadingHistory: "Loading history…"
			}
		};
		/** Resolve the copy set for the current UI language (document lang, zh/en). */
		function langStrings() {
			const lang = typeof document !== "undefined" ? (document.documentElement.lang || "zh").toLowerCase() : "zh";
			return STRINGS[lang.startsWith("zh") ? "zh" : "en"];
		}
		const css = [
			".lensrail_nav{user-select:none;z-index:120;position:fixed;display:flex;flex-direction:column;align-items:stretch;width:30px;box-sizing:border-box;padding:10px 0;pointer-events:none;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 18px,#000 calc(100% - 18px),transparent 100%);mask-image:linear-gradient(to bottom,transparent 0,#000 18px,#000 calc(100% - 18px),transparent 100%)}",
			".lensrail_nav::-webkit-scrollbar{display:none}",
			".lensrail_inner{margin:auto 0;display:flex;flex-direction:column;align-items:stretch}",
			".lensrail_item{appearance:none;-webkit-appearance:none;border:none;padding:0;margin:0;background:transparent;font:inherit;color:inherit;text-align:left;outline:none;display:flex;align-items:center;box-sizing:border-box;width:30px;height:12px;flex-shrink:0;cursor:pointer;pointer-events:auto}",
			".lensrail_item:focus-visible{outline:none}",
			".lensrail_line{display:block;box-sizing:border-box;height:3px;border-radius:999px;background:var(--dsw-alias-label-secondary,rgba(0,0,0,.34));transition:width .16s cubic-bezier(.3,0,.2,1),background-color .12s ease;min-width:5px;max-width:30px}",
			"body[data-ds-dark-theme] .lensrail_line,[data-theme=\"dark\"] .lensrail_line,.dark .lensrail_line{background:rgba(255,255,255,.32)}",
			".lensrail_item.lensrail_active .lensrail_line{background:var(--dsw-alias-state-business-primary,#4d6bfe)}",
			".lensrail_item.lensrail_hover .lensrail_line{background:var(--dsw-alias-label-primary,rgba(0,0,0,.95))}",
			"body[data-ds-dark-theme] .lensrail_item.lensrail_hover .lensrail_line,[data-theme=\"dark\"] .lensrail_item.lensrail_hover .lensrail_line,.dark .lensrail_item.lensrail_hover .lensrail_line{background:rgba(255,255,255,.95)}",
			".lensrail_loading{position:absolute;top:2px;left:0;flex-shrink:0;width:8px;height:8px;pointer-events:none}",
			".lensrail_loading::before{content:\"\";display:block;width:8px;height:8px;border:1.5px solid var(--dsw-alias-state-business-primary,#4d6bfe);border-top-color:transparent;border-radius:50%;animation:lensrail-spin .8s linear infinite}",
			".lensrail_tip{position:fixed;z-index:200;max-width:380px;max-height:56vh;overflow-y:auto;padding:8px 12px;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-primary,var(--text-primary,rgba(0,0,0,.85)));background:var(--dsw-alias-surface-raised,var(--bg-elevated,rgba(255,255,255,.97)));border:1px solid var(--dsw-alias-border-l2,var(--border-default,rgba(0,0,0,.12)));border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.16);pointer-events:none;white-space:pre-wrap;word-break:break-word}",
			"body[data-ds-dark-theme] .lensrail_tip,[data-theme=\"dark\"] .lensrail_tip,.dark .lensrail_tip{background:var(--dsw-alias-surface-raised,var(--bg-elevated,rgba(28,28,32,.97)));border-color:var(--dsw-alias-border-l2,var(--border-default,rgba(255,255,255,.14)))}",
			".lensrail_tipUser{font-weight:500;color:var(--dsw-alias-label-primary,var(--text-primary,rgba(0,0,0,.9)));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			"body[data-ds-dark-theme] .lensrail_tipUser,[data-theme=\"dark\"] .lensrail_tipUser,.dark .lensrail_tipUser{color:rgba(255,255,255,.95)}",
			".lensrail_tipAssistant{margin-top:6px;color:var(--dsw-alias-label-secondary,var(--text-muted,rgba(0,0,0,.55)));display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}",
			"body[data-ds-dark-theme] .lensrail_tipAssistant,[data-theme=\"dark\"] .lensrail_tipAssistant,.dark .lensrail_tipAssistant{color:rgba(255,255,255,.6)}",
			".lensrail_busy{position:fixed;z-index:210;top:18px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;padding:8px 16px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary,var(--text-primary,rgba(0,0,0,.9)));background:var(--dsw-alias-surface-raised,var(--bg-elevated,rgba(255,255,255,.98)));border:1px solid var(--dsw-alias-border-l2,var(--border-default,rgba(0,0,0,.12)));border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.18);pointer-events:none}",
			"body[data-ds-dark-theme] .lensrail_busy,[data-theme=\"dark\"] .lensrail_busy,.dark .lensrail_busy{color:rgba(255,255,255,.95);background:var(--dsw-alias-surface-raised,var(--bg-elevated,rgba(28,28,32,.98)));border-color:var(--dsw-alias-border-l2,var(--border-default,rgba(255,255,255,.14)))}",
			".lensrail_busy::before{content:\"\";flex-shrink:0;width:12px;height:12px;border:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);border-top-color:transparent;border-radius:50%;animation:lensrail-spin .8s linear infinite}",
			"@keyframes lensrail-spin{to{transform:rotate(360deg)}}",
			"@media (prefers-reduced-motion:reduce){.lensrail_line{transition:none}.lensrail_loading::before{animation:none}}"
		].join("");
		const STYLE_ID = "@hzpeng/dsh-lens-rail/styles";
		if (typeof document !== "undefined" && document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`) === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-lens-rail";
			tag.dataset.pluginCss = STYLE_ID;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		const S = {
			nav: "lensrail_nav",
			inner: "lensrail_inner",
			item: "lensrail_item",
			line: "lensrail_line",
			active: "lensrail_active",
			hover: "lensrail_hover",
			loading: "lensrail_loading",
			busy: "lensrail_busy",
			tip: "lensrail_tip",
			tipUser: "lensrail_tipUser",
			tipAssistant: "lensrail_tipAssistant"
		};
		const NOOP_STORE = {
			getSnapshot: () => void 0,
			subscribe: () => () => {}
		};
		/** Reconstruct the `data-chat-anchor-key` for a durable user-message id. */
		function anchorKeyOf(id) {
			return `13:input-message${id}`;
		}
		/** Extract a short preview from a ContentBlock/AssistantBlock list. */
		function textOf(content) {
			if (!Array.isArray(content)) return "";
			let out = "";
			for (const block of content) if (block !== null && typeof block === "object" && block.type === "text" && typeof block.text === "string") out += block.text;
			return out.trim().slice(0, 80);
		}
		/** Normalize one `chatRail` projection entry (durable form) to a rail message. */
		function normalizeProjected(m) {
			if (m === null || typeof m !== "object") return null;
			const o = m;
			const id = typeof o.id === "string" ? o.id : "";
			const key = typeof o.key === "string" ? o.key : id !== "" ? anchorKeyOf(id) : "";
			if (key === "") return null;
			return {
				key,
				seq: typeof o.seq === "number" ? o.seq : 0,
				time: typeof o.time === "number" ? o.time : 0,
				text: typeof o.text === "string" ? o.text : typeof o.preview === "string" ? o.preview : "",
				assistantText: typeof o.assistantText === "string" ? o.assistantText : "",
				kind: "user"
			};
		}
		/** Fallback enumerator: collect user + assistant rows from the chat snapshot. */
		function collectFromNodes(snapshot) {
			const out = [];
			if (snapshot === void 0 || snapshot.chat === void 0) return out;
			const chat = snapshot.chat;
			if (!chat.nodes) return out;
			for (const node of chat.nodes.values()) {
				if (node === null || typeof node !== "object") continue;
				const n = node;
				const kind = n.kind;
				if (kind !== "user" && kind !== "assistant") continue;
				if (typeof n.key !== "string" || n.key === "") continue;
				const data = n.data;
				const body = data !== null && typeof data === "object" ? data.content ?? data.blocks : void 0;
				out.push({
					key: n.key,
					kind,
					seq: typeof n.anchorSeq === "number" ? n.anchorSeq : !Number.isNaN(Number(n.seq)) ? Number(n.seq) : 0,
					time: data !== null && typeof data === "object" && typeof data.time === "number" ? data.time : 0,
					text: textOf(body),
					assistantText: ""
				});
			}
			out.sort((a, b) => a.seq - b.seq);
			return out;
		}
		const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
		/**
		* Ensure the target message node is in the loaded window, then scroll to its
		* DOM row. `loadOlder` pages 50 messages at a time, so a jump far back loops
		* (with a guard) and polls for the row, which materialises once React renders
		* the prepended page.
		*/
		async function jumpToMessage(sessionsService, sessionId, key, onProgress, signal) {
			const session = sessionsService.binding(sessionId)?.session;
			if (session === void 0) return false;
			let pages = 0;
			let guard = 0;
			let loaded = false;
			while (guard++ < 120) {
				if (signal?.aborted) return false;
				const snapshot = session.getSnapshot();
				if (snapshot?.chat?.nodes?.get(key) !== void 0) {
					loaded = true;
					break;
				}
				if (snapshot?.hasMore !== true) break;
				if (snapshot.loadingOlder === true) {
					await delay(50);
					continue;
				}
				await session.loadOlder();
				pages++;
				onProgress?.(pages);
			}
			if (!loaded) {
				console.warn(`[lens-rail] jumpToMessage: node "${key}" not loaded after ${pages} page(s)`);
				return false;
			}
			const scrollport = typeof document !== "undefined" ? document.querySelector("[data-conversation-scroll]") : null;
			if (scrollport === null) return false;
			let row = null;
			let waited = 0;
			while (waited++ < 100) {
				if (signal?.aborted) return false;
				row = scrollport.querySelector(`[data-chat-anchor-key="${CSS.escape(key)}"]`);
				if (row !== null) break;
				await delay(50);
			}
			if (row === null) return false;
			const reducedMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
			row.scrollIntoView({
				behavior: reducedMotion ? "auto" : "smooth",
				block: "center"
			});
			return true;
		}
		function LensRail({ useProjection, sessionId, sessionsService }) {
			const t = langStrings();
			const projected = typeof useProjection === "function" ? useProjection("chatRail") : void 0;
			const session = sessionId === void 0 ? void 0 : sessionsService.binding(sessionId)?.session;
			const fallbackStore = session === void 0 ? NOOP_STORE : session;
			const nodeSnapshot = (0, react.useSyncExternalStore)((cb) => fallbackStore.subscribe(cb), () => fallbackStore.getSnapshot());
			const messages = (0, react.useMemo)(() => {
				const proj = Array.isArray(projected?.messages) ? projected.messages.map(normalizeProjected).filter((m) => m !== null) : [];
				if (proj.length > 0) return proj;
				return collectFromNodes(nodeSnapshot);
			}, [projected, nodeSnapshot]);
			const [activeIndex, setActiveIndex] = (0, react.useState)(-1);
			const [hoverIndex, setHoverIndex] = (0, react.useState)(-1);
			const [jumping, setJumping] = (0, react.useState)(false);
			const [tip, setTip] = (0, react.useState)(null);
			const jumpAbortRef = (0, react.useRef)(null);
			const navRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => () => jumpAbortRef.current?.abort(), []);
			const [navPos, setNavPos] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (sessionId === void 0) return;
				const measure = () => {
					const sp = document.querySelector("[data-conversation-scroll]");
					if (sp === null) return;
					const r = sp.getBoundingClientRect();
					if (r.width === 0 || r.height === 0) return;
					const height = Math.round(r.height * .6);
					const top = r.top + Math.round((r.height - height) / 2);
					setNavPos({
						left: r.left,
						top,
						height
					});
				};
				measure();
				const sp = document.querySelector("[data-conversation-scroll]");
				let ro = null;
				if (typeof ResizeObserver === "function" && sp !== null) {
					ro = new ResizeObserver(() => measure());
					ro.observe(sp);
				}
				window.addEventListener("resize", measure);
				return () => {
					ro?.disconnect();
					window.removeEventListener("resize", measure);
				};
			}, [sessionId]);
			(0, react.useEffect)(() => {
				if (messages.length === 0) return;
				const indexByKey = /* @__PURE__ */ new Map();
				for (let i = 0; i < messages.length; i++) indexByKey.set(messages[i].key, i);
				const updateActive = () => {
					const sp = document.querySelector("[data-conversation-scroll]");
					if (sp === null) return;
					const rect = sp.getBoundingClientRect();
					if (rect.height === 0) return;
					const line = rect.top + rect.height * .4;
					const rows = sp.querySelectorAll("[data-chat-anchor-key]");
					let best = -1;
					let bestDist = Infinity;
					for (const row of rows) {
						const key = row.getAttribute("data-chat-anchor-key");
						if (key === null) continue;
						const idx = indexByKey.get(key) ?? -1;
						if (idx === -1) continue;
						const r = row.getBoundingClientRect();
						const dist = Math.abs(r.top + r.height / 2 - line);
						if (dist < bestDist) {
							bestDist = dist;
							best = idx;
						}
					}
					setActiveIndex(best);
				};
				updateActive();
				const el = document.querySelector("[data-conversation-scroll]");
				let scrollTimer = null;
				const onScroll = () => {
					if (scrollTimer !== null) return;
					scrollTimer = setTimeout(() => {
						scrollTimer = null;
						updateActive();
					}, 60);
				};
				el?.addEventListener("scroll", onScroll, { passive: true });
				const timer = window.setInterval(updateActive, 2e3);
				return () => {
					el?.removeEventListener("scroll", onScroll);
					window.clearInterval(timer);
					if (scrollTimer !== null) clearTimeout(scrollTimer);
				};
			}, [sessionId, messages.length]);
			(0, react.useEffect)(() => {
				if (session === void 0) return;
				if (Array.isArray(projected?.messages) && projected.messages.length > 0) return;
				let cancelled = false;
				const run = async () => {
					let guard = 0;
					while (!cancelled && guard++ < 120) {
						if (Array.isArray(projected?.messages) && projected.messages.length > 0) return;
						const snap = session.getSnapshot();
						if (snap?.hasMore !== true) return;
						if (snap.loadingOlder === true) {
							await delay(50);
							continue;
						}
						await session.loadOlder();
					}
				};
				run().catch(() => {});
				return () => {
					cancelled = true;
				};
			}, [
				sessionId,
				session === void 0 ? "none" : "ready",
				Array.isArray(projected?.messages) && projected.messages.length > 0 ? "have" : "none"
			]);
			if (sessionId === void 0 || messages.length < 1 || navPos === null) return null;
			const focus = hoverIndex;
			const BASE = 8;
			const SPAN = 4;
			const widthOf = (i) => {
				if (focus < 0) return BASE;
				const d = Math.abs(i - focus);
				if (d >= SPAN) return BASE;
				const w = BASE + 22 * (1 - d / SPAN);
				return Math.round(w * 10) / 10;
			};
			const items = messages.map((m, i) => {
				const isActive = activeIndex === i;
				const isHover = hoverIndex === i;
				return (0, react.createElement)("button", {
					type: "button",
					key: m.key,
					"data-lens-index": String(i),
					"aria-label": `${t.roleUser}: ${m.text || t.noText} (${t.ariaJump})`,
					"aria-current": isActive ? "location" : void 0,
					disabled: jumping,
					className: S.item + (isActive ? ` ${S.active}` : "") + (isHover ? ` ${S.hover}` : ""),
					onMouseEnter: () => {
						setHoverIndex(i);
						const el = navRef.current?.querySelector(`[data-lens-index="${i}"]`);
						if (el !== null && el !== void 0) {
							const r = el.getBoundingClientRect();
							setTip({
								index: i,
								x: r.right + 10,
								y: r.top + r.height / 2
							});
						}
					},
					onMouseLeave: () => {
						setHoverIndex((prev) => prev === i ? -1 : prev);
						setTip((prev) => prev?.index === i ? null : prev);
					},
					onClick: () => {
						if (jumping) return;
						setTip(null);
						jumpAbortRef.current?.abort();
						const controller = new AbortController();
						jumpAbortRef.current = controller;
						setJumping(true);
						jumpToMessage(sessionsService, sessionId, m.key, void 0, controller.signal).finally(() => setJumping(false));
					}
				}, (0, react.createElement)("span", {
					className: S.line,
					style: { width: `${widthOf(i)}px` },
					"aria-hidden": true
				}));
			});
			return (0, react_dom.createPortal)([
				(0, react.createElement)("div", {
					ref: navRef,
					className: S.nav,
					role: "navigation",
					"aria-label": t.railLabel,
					onMouseLeave: () => {
						setHoverIndex(-1);
						setTip(null);
					},
					style: {
						left: `${navPos.left + 8}px`,
						top: `${navPos.top}px`,
						height: `${navPos.height}px`
					},
					children: [(0, react.createElement)("div", {
						className: S.inner,
						children: [jumping ? (0, react.createElement)("div", {
							className: S.loading,
							key: "loading",
							"aria-hidden": true
						}) : null, ...items]
					})]
				}),
				tip !== null && tip.index >= 0 && tip.index < messages.length ? (0, react.createElement)("div", {
					className: S.tip,
					style: {
						left: `${tip.x}px`,
						top: `${tip.y}px`,
						transform: "translateY(-50%)"
					},
					"aria-hidden": true
				}, (() => {
					const m = messages[tip.index];
					const children = [(0, react.createElement)("div", {
						key: "user",
						className: S.tipUser
					}, m.text || t.noText)];
					if (m.assistantText !== "") children.push((0, react.createElement)("div", {
						key: "assistant",
						className: S.tipAssistant
					}, m.assistantText));
					return children;
				})()) : null,
				jumping ? (0, react.createElement)("div", {
					className: S.busy,
					key: "busy",
					role: "status",
					"aria-live": "polite"
				}, t.loadingHistory) : null
			], document.body);
		}
		function apply(ctx) {
			ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
				name: "conversation.input.dock",
				id: "dsh-lens-rail",
				order: 50,
				inject: () => ({ sessionsService: ctx.sessions })
			}, LensRail));
		}
		//#endregion
		exports.LensRail = LensRail;
		exports.apply = apply;
		exports.collectFromNodes = collectFromNodes;
		exports.inject = inject;
		exports.normalizeProjected = normalizeProjected;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map