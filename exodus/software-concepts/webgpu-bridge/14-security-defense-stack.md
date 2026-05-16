# 14 - Security Defense Stack (7 threat classes)

**Status:** IMPLEMENTED and tested.
**Primary origin:** `Development_Roadmap` section 8 ("Defenses for
forward work"), plus the canonical file's own threat model header
**Secondary origin:** evolved through the appraisal review round
**Implemented in:** `exodus-canonical.html` throughout (Guards module
plus per-module enforcement)
**Tests:** 18 injection/pollution tests, plus bounds checks in the
server suite

---

## Narrow-claim scope

A layered defense covering seven threat classes. Each threat has at
least one specific mechanism. The security boundary is the running
process itself: inputs enter via IPC messages (typed payloads) and
user interaction (bounded events); outputs are DOM mutations and
file downloads. There is no network surface.

## The seven threats

### T1 - CSS injection via constraint string values

**Vector.** A constraint's `then.deny` or `then.rt` string contains
CSS-breaking characters: `"`, `}`, `\n`, `/* ... */`, etc.

**Defense.** Three functions in `Guards`, applied at every
compile boundary:

- `cssEscapeString(s)`: produces `\XX `-escaped quoted CSS string.
 Used for free-form text (`deny`). Bounded at 512 chars. Escapes
 quote, backslash, all control bytes, all non-ASCII.
- `requireCssIdent(s)`: enforces regex `^[A-Za-z_][A-Za-z0-9_-]{0,63}$`.
 Throws on violation. Used for dim names.
- `requireSafeAttrValue(s)`: enforces regex
 `^[A-Za-z0-9_.-]{1,64}$`. Throws on violation. Used for the value
 inside `[data-x="VALUE"]` selectors.

**Tests.** 14 injection-attack strings including attribute selector
break, declaration break, rule break, comment injection, newline
injection, backslash escape escape, null byte, tab in value,
`expression()` call, `url(javascript:...)`.

### T2 - HTML injection via resolved cascade outputs

**Vector.** A resolved cascade value (deny string, rt, etc.) is
written to the DOM via `innerHTML`, and contains `<script>` or event
handler attributes.

**Defense.** `innerHTML` with dynamic content is forbidden repo-wide.
The entire UI module uses `textContent` exclusively for dynamic text.
Static HTML in the skeleton has no interpolation.

**Enforcement.** Grep `\.innerHTML\s*=` should return zero assignment
matches in the canonical file. Currently: 0.

### T3 - Prototype pollution via IPC messages

**Vector.** A message payload includes `__proto__: { evil: 1 }`. If
the handler does `Object.assign(server_state, msg)` or iterates with
a plain `for...in`, the prototype of `Object` gets polluted.

**Defense.**

- `Guards.isReservedKey(k)` names `__proto__`, `constructor`,
 `prototype` explicitly.
- `Guards.hasOwn(o, k)` returns true only for own, non-reserved
 properties.
- `Guards.ownKeys(o)` returns the object's own keys minus reserved.
- Server uses `Object.create(null)` for all map-as-set usage (e.g.,
 the INJECT dedup set).
- Null-prototype objects cannot inherit a polluted `Object.prototype`.

**Self-catch during development.** An earlier draft defined the
reject set as `{ __proto__: 1 }` - which SETS the prototype rather
than creating an own property, so the check never matched. Caught by
test, fixed to name-check syntactically. Exactly the bug class this
defense is supposed to catch.

**Tests.** `ownKeys skips __proto__ and constructor`, `message with
__proto__ injection does not pollute Object.prototype`,
`constraint-shaped obj with reserved key does not leak via ownKeys`.

### T4 - Source pollution (smart quotes, em-dashes)

**Vector.** An editor autocorrect or a paste from Word replaces an
ASCII `"` with a Unicode smart quote, or `--` with an em-dash.
Downstream compilation or comparison silently fails.

**Defense.**

- **ASCII-only source.** Every byte in the canonical HTML file is
 `<= 0x7E`. Enforced by pre-commit grep:
 `grep -P '[\x80-\xFF]' --exclude='*.md'`
- **Runtime self-check.** On boot, `Guards.asciiOnlySelfCheck()`
 scans the IIFE's own source text and refuses to boot if any byte
 is > 0x7E, showing the offending offset and hex code in the UI.
- **This has already caught real bugs** in this very project (at
 least two: the original VSFGenerator with smart quotes and dashes
 that broke its own CSS, and two em-dashes the author introduced in
 comments during the Merkle-fix rewrite).

### T5 - Replay / tampering of rows

**Vector.** An adversary rewrites a committed row in a stored VSF
file, or replays an old VSF against a new geometry, or claims to
have a valid row set that actually isn't.

**Defense.** Algorithm 13 (content addressing). Every row is
SHA-256-identified; the Merkle root binds the whole set. Export
includes the Merkle root in the metadata line.

**What this does NOT prevent.** An adversary with access to the same
constraints can construct a different valid row set and its
corresponding valid Merkle root. What content addressing provides is
**integrity of the committed set as a whole**, not **authenticity of
who committed it**. Signing would be algorithm 17's concern.

### T6 - Unbounded resource consumption

**Vector.** A single huge message (100 MB row), a massive INJECT (1M
rows), a pathological input to cssEscapeString (10 GB string), etc.

**Defense.** Hard caps at every entry point:

- `cssEscapeString` input bounded at 512 chars.
- Field sanitization bounded at 256 chars.
- Individual row bounded at 4096 chars on INJECT.
- INJECT rows count bounded at 10,000 per batch.
- SCAN_SPACE results bounded at 50,000 per batch.
- Probe array bounded at 50,000 elements (MAX_PROBES).
- VSF file parse bounded at 4 MB.
- Config objects `Object.freeze`d so they cannot be mutated at
 runtime.
- IPC log bounded at 500 entries (rolling).

**Tests.** `cssEscapeString truncates at 512`, `Server INJECT rows
rejects oversized row strings`, `SCAN_SPACE bounded at 50000`,
`INJECT rejects >10000 rows`.

### T7 - Arbitrary code execution

**Vector.** `eval`, `new Function(...)`, `setTimeout(string, ...)`,
`innerHTML` with a payload that contains `<script>` or event
handlers, or inline script in injected CSS (e.g., `expression()`).

**Defense.**

- Source contains no `eval(`, no `new Function(`, no
 `setTimeout(string, ...)`, no `document.write`. Grep-verified to
 return zero matches.
- CSP meta restricts loadable content:

 ```
 default-src 'none';
 style-src 'self' 'unsafe-inline';
 script-src 'self' 'unsafe-inline';
 img-src 'self' data:;
 connect-src 'none';
 base-uri 'none';
 form-action 'none';
 frame-ancestors 'none';
 ```

 The `'unsafe-inline'` on style and script is necessary because the
 artifact is single-file (inline `<style>` and `<script>` elements).
 `connect-src 'none'` blocks all outbound network; `default-src
 'none'` blocks loading of any resource category not explicitly
 listed.

## Layered validation

A single input may hit multiple defenses in sequence. Example: a
COMMIT message's `cascadeResult.deny` field:

1. **T3 (reserved-key guard):** the server uses `msg.cascadeResult &&
 msg.cascadeResult.deny` rather than `hasOwnProperty`-iterating
 the payload.
2. **T6 (bounds):** `sanitizeField` caps the string at 256 chars.
3. **T1 (CSS safety):** `cssEscapeString` further bounds at 512 chars
 and escapes non-printable content. (Note: the deny string doesn't
 hit the cascade compiler - it hits the row builder. But if it did,
 this defense would apply.)
4. **T2 (HTML safety):** when the deny appears in the UI, it goes
 via `textContent`, never innerHTML.

## What this stack does NOT cover

- **Cross-site scripting in a hosting page.** If this artifact is
 embedded in an unsanitized parent page, the parent page can
 manipulate its DOM. Iframe sandbox or `frame-ancestors 'none'` in
 CSP blocks this.
- **Storage-side attacks.** Localstorage, IndexedDB, service workers
 are not used. If added, each adds a new input surface.
- **Side channels.** Timing, cache, etc. Not modeled.
- **Supply-chain attack on the source itself.** ASCII-only and
 runtime self-check catch passive corruption, not deliberate
 injection by a trusted editor. Code signing would be out of scope.

## Wide-claim scope

The `Development_Roadmap` lists five defenses as the "discipline"
for forward work. This algorithm expands them to seven concrete
threat classes with named mechanisms, which is narrower and more
audit-friendly.

The wider claim - that this makes the artifact "trusted" in any
formal sense - overstates things. These defenses make it resistant to
specific known attack vectors. New vector classes (a zero-day in
crypto.subtle, a novel browser quirk in getComputedStyle on
display:none elements, etc.) are not addressed.

## Related algorithms in this catalog

- `04-constraint-compilation.md` - T1 defenses applied at the
 compile boundary
- `12-synchronous-logged-ipc.md` - T3 and T6 defenses applied at
 the message boundary
- `13-content-addressing-and-merkle.md` - T5 defense proper
