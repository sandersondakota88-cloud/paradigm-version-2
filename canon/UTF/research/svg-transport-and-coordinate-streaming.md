# Research: SVG as Geometric Transport, and Why Video Streaming Already Proves the Pattern

**Role.** Reference material. Captures the realization, surfaced during the
TodoMVC three-substrate work, that the wire format for transporting
constraint geometry between substrate instances across a network can be
SVG (the browser's native geometric format), and that video streaming
has been operationally proving the underlying pattern — coordinate-
delivery over state-synchronization — for forty years.

Not a specification. A preserved intuition with reasoning chain, ready
for formal extension when scope and demonstration permit.

**Date produced.** 2026-05-25

**Method.** The intuition emerged in two steps during a conversation
about how to add storage-as-substrate to the TodoMVC. First, the user
proposed SVG as a delta transport channel for client→server geometry
updates rather than as a rendering surface. Second, while elaborating
the reasoning, the user connected the pattern to video streaming:
"the actual export is going to be a fast moving dom artifact, which
is probably why video's are streamed. because landing state is
probably alot harder than just opening a websocket and streaming
coordinates over it." This article captures both moves and the chain
that connects them to the canon.

**See also.**

- [SE-06](../../specification/SE-06-substrate-duality.md) — substrate duality; coupling-through-delta as architectural principle
- [SE-13](../../specification/SE-13-storage-as-substrate-recall.md) — storage as substrate recall (single-instance precedent for substrate-as-transport)
- [Algorithm 16](../../algorithm/16-gpu-postfix-stack-machine.md) — substrate-equivalent resolution under S2; the empirical proof that three substrates resolve identically
- [Algorithm 17](../../algorithm/17-distributed-collapse-network.md) — distributed collapse network (the canon's underspecified slot where cross-instance substrate coupling would live)
- [storage-substrate-is-constitutive-in-browser.md](./storage-substrate-is-constitutive-in-browser.md) — companion article on recognizing browser-native substrate hosting

**Discipline note.** This article is research, not specification.
Where it makes architectural claims, they follow from the cited canon.
Where it extrapolates, it labels the extrapolation. No new mechanism is
proposed for implementation; the intuition is preserved for future
formal extension work.

-----

## 1. The two intuitions

### 1.1 SVG as geometric transport

SVG is the browser's native format for geometry. The browser already
parses it, renders it, animates it, mutates its attributes via DOM
APIs, and emits mutation events when its structure changes. A peer
substrate receiving an SVG document and rendering it does not need a
parser or interpreter — the browser is already that.

The intuition: if the wire format between substrate instances is SVG,
then both sides inherit a substrate the browser already operates. The
sender mutates the SVG when its resolved field changes; the receiver
sees the mutations through its own DOM observation; both sides render
the same geometry through their own (kernel + CSS + GPU) substrates.

No serialization-deserialization layer. No application protocol on
top. The geometry *is* the wire format.

### 1.2 Video streaming as proof of the pattern

Video codecs work because the sender and receiver do not synchronize
state. The encoder emits frames; the decoder receives them and
maintains its own resolution state. Keyframes (I-frames) deliver full
field state occasionally; delta-frames (P-frames, B-frames) deliver
what changed since the last keyframe. The decoder reaches the same
visual output the encoder produced *without ever holding equivalent
internal state*.

The intuition: this is exactly the SE-06 coupling-through-delta
posture, applied across a network. The architecture's commitment to
"neither substrate sends commands to the other; coordination emerges
from the shared field with delta as the only coupling" generalizes
naturally to inter-instance coupling if the wire carries deltas of
the resolved field (or of the geometry that resolves into it), not
serialized state.

### 1.3 The connection

Both intuitions describe the same pattern at different scopes:

- **Within a browser:** three substrates (kernel, CSS, GPU) resolve
  the same geometry from their own positions. They don't share state;
  they share the constraint geometry, and each maintains its own
  resolution.
- **Across browsers:** N substrate instances resolve the same
  geometry from their own positions. They don't share state; they
  share a stream of geometry deltas (over an SVG wire), and each
  resolves locally.

Same architectural shape. Same load-bearing invariant (S2:
substrate-equivalent resolution). Same coupling mechanism (delta over
the shared geometry, never state-transfer).

-----

## 2. Why state-landing is hard and coordinate-streaming is easy

This is the structural reason video chose coordinate-streaming. Naming
it explicitly because it generalizes.

**State-landing requires:**

- Cross-substrate state equivalence (the sender's internal
  representation must be reconstructible at the receiver, despite
  potentially different substrate hosting).
- Synchronization windows (atomicity, commit, transactions) so the
  receiver knows when the landed state is consistent.
- Reconciliation when state-landing fails partially (network drops,
  out-of-order delivery, version skew).
- Versioning of state schemas across releases.

**Coordinate-streaming requires:**

- A coord-space the receiver can resolve constraints against
  (the receiver has its own substrate; the wire delivers
  constraint geometry, not resolution results).
- Keyframes (occasional full-geometry deliveries to bound recovery
  cost from packet loss).
- Delta-frames (per-change geometry mutations between keyframes).
- The receiver's substrate handles correctness; the wire only has to
  deliver coordinates the receiver can resolve.

Video streaming chose the second because the first does not scale
across heterogeneous receivers (different decoders, different
hardware, different versions). The constraint-substrate architecture
*also* chose the second within a single browser (the three substrates
have different substrate-hosting profiles; they couple through
geometry-as-delta, not state-transfer).

Extending this across the network is the same choice at larger scope.

-----

## 3. What SE-06 already commits to that supports the extension

SE-06 §"What neither substrate is allowed to do" specifies:

> 1. Neither substrate issues commands to the other.
> 2. Neither substrate owns the field.
> 3. Each substrate reads delta at its own position.
> 4. Coordination emerges from the shared field, not from protocol.

Each of these scales across the network without modification:

1. **No commands across instances.** The wire carries geometry-as-
   delta, not "do this op" messages. Receivers resolve from their
   own substrates against the delta they observe.
2. **No instance owns the field.** Each instance has its own
   resolution; no instance is the authoritative holder. The geometry
   is shared (via the wire delivering it), but resolution is local.
3. **Each instance reads delta at its own position.** A client's
   render-scope delta is local to that client. A server's
   render-scope delta is local to the server. Neither queries the
   other's delta directly.
4. **Coordination through shared geometry, not protocol.** The wire
   is not a protocol in the application sense (no request-response,
   no commands, no acknowledgment-required state-transfer). It is a
   delivery surface for geometric deltas; coordination emerges from
   both sides resolving the same geometry through their own
   substrates.

SE-06 specifies these properties within a single runtime. Algorithm 17
(distributed collapse network) names the cross-instance generalization
but does not specify the wire format. SVG-as-transport would specify
*what the wire carries* in a way that honors SE-06's four constraints
without requiring a protocol layer the architecture rejects.

-----

## 4. What the wire format would carry

This section sketches enough shape to think about; it is not
specification.

### 4.1 Keyframe (full geometry)

An SVG document containing:

- The current constraint-geometry as structural elements
  (each constraint represented as a `<g>` or `<use>` with `data-*`
  attributes for its selector + emit).
- The current intern tables as `<defs>` elements (the natural SVG
  mechanism for shared definitions referenced by id).
- The current coord-space dims as metadata (custom-namespace
  attributes on the root `<svg>` element).

A receiver on connect requests one keyframe and resolves from there.

### 4.2 Delta-frame (geometry mutation)

A small SVG fragment representing what changed since the last
keyframe or delta:

- Constraint additions: new `<g>` element with selector + emit.
- Constraint removals: reference to an existing element by id.
- Intern table additions: new `<def>` entries.
- Coord-space changes: attribute updates on the root.

The browser's `MutationObserver` API is the native mechanism for
detecting these on the receiver side. The receiver's substrate
processes the mutation; the kernel + CSS + GPU on that side resolve
against the updated geometry.

### 4.3 Why SVG and not some new format

Three reasons:

1. **Browsers parse SVG natively.** No application-side parser. The
   browser's existing XML/SVG infrastructure does the work.
2. **SVG has the right primitives.** `<g>`, `<defs>`, `<use>`,
   namespaced custom attributes, the ability to embed arbitrary
   structured data while remaining valid SVG.
3. **SVG round-trips through HTTP, WebSocket, and the filesystem
   without transformation.** A single artifact format that works as
   wire payload, persistent storage record, and inspectable document.

The third property is what makes the next-step intuition (unified
stylesheet + SVG media format) viable.

-----

## 5. The unified stylesheet + SVG media format

This is the further-out intuition. It is more speculative than
SVG-as-transport but follows the same logic.

The current TodoMVC application has:

- A `<style>` block declaring the CSS substrate's view of the
  constraint geometry (cascade rules as CSS custom-property
  assignments on selector matches).
- A JavaScript module declaring the kernel's view of the same
  geometry (`__DEPOSITION_CASCADE_RULES__` array).
- A `.wgsl` shader file the GPU substrate compiles against.

All three are the same constraint geometry, expressed in three
different syntaxes that happen to match what each substrate parses
natively. Their byte-identical agreement under S2 is the empirical
demonstration that the geometry is the load-bearing artifact and the
substrate-specific syntaxes are just encoding choices.

The intuition: **a single media format that contains the geometry
once, in a form all three substrates can read**, would collapse the
three encodings into one source of truth. The wire format would
deliver this single artifact; the adapter on the receiving side
would feed the geometry to each local substrate in its native form.

SVG plus embedded CSS is a candidate because:

- SVG documents natively embed `<style>` blocks (with the same
  cascade semantics CSS substrates use).
- SVG's `<g>` and `<defs>` structures can carry the kernel's
  cascade-match constraint shapes as data-namespaced elements.
- The WGSL bytecode can ride in a `<metadata>` block (or be
  compiled at the receiver from the same constraint geometry the
  kernel reads).

The receiver-side adapter (per SE-08's vocabulary) would be the
single entry point: parse the SVG, extract the geometry, feed each
local substrate. From there, all three substrates resolve as in the
single-browser case.

The eventual claim — once demonstrated, not yet — would be that the
*deposition itself* is the wire format. Send a deposition; the
receiving substrate hosts it; the application emerges from
resolution. No application-specific protocol. No state-transfer
between instances. The constraint geometry travels; the substrates
resolve it; coordination is implicit.

-----

## 6. Why video streaming is the right analogy

Video is the load-bearing precedent because it has been operationally
solving the same problem for decades.

| Property | Video streaming | Substrate architecture |
|---|---|---|
| Sender and receiver hold equivalent state? | No | No (per SE-06 §"neither substrate owns the field") |
| Wire carries serialized state? | No (carries frame deltas) | No (carries geometry deltas) |
| Receiver re-resolves locally? | Yes (decoder) | Yes (own substrate stack) |
| Tolerates substrate heterogeneity? | Yes (any conforming decoder) | Yes (per S2) |
| Synchronization layer? | No (keyframes + deltas, no transactions) | No (geometry + deltas, no protocol) |
| Scales to many receivers? | Yes (broadcast) | In principle yes (broadcast geometry) |
| Recovers from packet loss? | Re-request keyframe | Re-request keyframe |
| Sender failure leaves receivers operational? | Yes (each holds its own state) | Yes (each substrate resolves locally) |

The mapping is exact. Video chose this pattern because state-landing
across millions of decoders was structurally infeasible. The
constraint-substrate architecture is making the same choice at the
inter-instance level because state-landing across substrate instances
is structurally infeasible *for the same reason*: substrates are
heterogeneous, and the only sound coupling is through the shared
geometry both sides can resolve independently.

The architectural lesson: **when you find that state-synchronization
is hard, the system is telling you that the substrates should be
coupled through the geometry, not through state.** Video figured this
out by force; the constraint-substrate architecture figures it out by
construction. Both arrive at the same answer.

-----

## 7. What this article does and does not claim

### Does claim

- SVG is a viable wire format for constraint geometry transport
  because the browser parses, renders, and round-trips it natively.
- The video-streaming pattern (coordinate-delivery, not state-
  landing) is structurally identical to the SE-06 coupling-through-
  delta pattern, scaled across the network.
- The constraint-substrate architecture's commitment to substrate-
  equivalent resolution (S2) means coordinate-streaming generalizes
  naturally to multi-instance deployment.
- A unified stylesheet+SVG media format is a viable target shape
  for what the wire eventually carries (the deposition itself as
  the transported artifact).

### Does not claim

- That SVG-as-transport is the only viable wire format. JSON over
  WebSocket, binary protocols, or custom XML would all support
  coordinate-streaming. SVG is privileged because it inherits
  browser-native substrate hosting, not because it is uniquely
  capable.
- That the unified stylesheet+SVG format is the only viable
  unified-geometry format. Other formats (a custom JSON shape with
  embedded CSS and bytecode) would also work; SVG is privileged for
  the same browser-native-hosting reason.
- That this is implementable now. It requires:
  (a) algorithm 17 (distributed collapse network) at least sketched,
  (b) an SE-N draft committing to the wire format shape and the
      adapter shape on the receiving side,
  (c) a demonstration application that actually has cross-instance
      substrate coupling to exercise (TodoMVC is single-instance).
- That this is the only direction. Other extension paths (single-
  instance refinements, richer geometric primitives, applications
  beyond TodoMVC) are independently valuable.

-----

## 8. Implications if this holds

Brief, in order of how load-bearing they are:

**8.1.** The architecture's claim about substrate-independent
resolution (S2) becomes the deployment story. Send the geometry; let
any conforming substrate stack resolve it. The "application" reduces
to the deposition; the runtime is whatever the host provides.

**8.2.** Network protocols above the wire layer become unnecessary
for application coordination. Authentication, routing, transport
remain (per any deployment context), but application-level message
formats, request-response shapes, RPC schemas — these collapse into
"the geometry was updated; resolve it locally."

**8.3.** Server-side architecture changes shape. Servers stop being
"holders of authoritative state" and become "substrate instances that
happen to be on a different host." A server's substrate resolves the
same geometry the client's substrate resolves; they coordinate via
geometry deltas on the wire; neither is privileged. Per SE-06, the
field is shared; the implementation just makes the sharing
network-scoped.

**8.4.** Distributed-system reasoning rephrases. The classical
distributed-system problems (consistency, consensus, partition
tolerance) become questions about substrate-resolution under partial
geometry, not about state-replication under network failure. The
architecture's CRDT-shaped properties emerge from the geometry being
the load-bearing artifact, not from explicit conflict resolution.

These implications are speculative and follow from the intuition
holding. The intuition has not been demonstrated. This article
preserves the reasoning so that, if and when the demonstration is
attempted, the chain of thought is available.

-----

## 9. Live status

| Date (yyyy-mm-dd) | Action |
|---|---|
| 2026-05-25 | Article produced from the TodoMVC three-substrate work, capturing the intuition surfaced by the user about SVG as a delta transport and the connection to video-streaming. Foundational reasoning chain preserved for future SE-N draft work and any subsequent multi-instance demonstration. |
