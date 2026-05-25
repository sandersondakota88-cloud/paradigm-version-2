# Research: Storage-Substrate is Constitutive (Not Additive) in a Browser Host

**Role.** Reference material. Records the realization, surfaced during the
TodoMVC three-substrate work (`implementation/10-end-to-end-todomvc/`),
that the storage substrate per SE-13 is not something an
implementation needs to *add* to a browser host — it is already
present by virtue of how the browser hosts substrate state.

**Date produced.** 2026-05-25

**Method.** While planning to wire `implementation/kernel/storage-adapter.js`
into the TodoMVC application, the user observed that closing and reopening
the page produces an "it was already there waiting for me" experience that
felt qualitatively different from conventional app rehydration. The work
of explaining that experience surfaced the recognition that the browser
was already operating storage-as-substrate per SE-06's commitment, and
the proposed adapter wiring would have been performative duplication
rather than load-bearing extension.

**See also.**

- [SE-06](../../specification/SE-06-substrate-duality.md) — substrate duality; §"What the runtime is" names DOM and persistent storage as part of substrate hosting (line 193)
- [SE-13](../../specification/SE-13-storage-as-substrate-recall.md) — storage as substrate recall (constraint persistence + recall mechanism)
- `implementation/kernel/storage-adapter.js` — the implementation of SE-13's storage substrate for constraint/trace state
- `implementation/kernel/substrate-media.js` — M3 substrate-media (codecs, content-addressed MediaStore)
- `implementation/08-runtime-kernel/p3-persistence-binding.js` — cadence-driven persistence binding
- `implementation/10-end-to-end-todomvc/deposition.js` — the TodoMVC deposition that uses localStorage directly for todo items

**Discipline note.** This article does not propose new mechanism. It
names existing canonical commitments and identifies which path through
the canon applies when the host platform already provides substrate
hosting natively.

-----

## 1. The empirical observation

The TodoMVC application persists todo items via `localStorage` in
`deposition.js`. On page close and reopen, the application's first paint
contains the previously-persisted todos as rebuilt DOM nodes. There is
no perceivable "loading then ready" transition; the application appears
to be in operating equilibrium from the first frame after reload.

The user named this directly: "it almost feels like it was there
waiting for me already." This phenomenology is unusual for conventional
web applications, which exhibit a perceptible rehydration phase
(parse → load → init → restore → render) even when total load time is
small.

The realization driving this article: the absence of a perceived
rehydration phase is not a UX optimization; it is the architecture
operating as SE-06 describes, in a context where the browser is
hosting substrate state collectively across DOM and persistent storage.

-----

## 2. What SE-06:193 commits to

SE-06 §"What the runtime is" specifies:

> A field, represented as state in whatever substrate hosts it.
> In a browser-based implementation, this is textures, buffers,
> DOM state, and persistent storage collectively.

This sentence is load-bearing in two directions:

**Direction 1.** The field is what the host represents it as. The
architecture does not impose a representation; it commits to operating
over whatever substrate hosts the state. In a browser host, that
hosting is DOM state plus persistent storage (and textures and buffers
for the rendering substrate).

**Direction 2.** Storage is named as part of substrate hosting, not as
a separate substrate. The "and persistent storage collectively"
language is critical: persistent storage is not added on top of the
field, it is part of how the field is represented when the host is a
browser. SE-13's storage-as-substrate-recall mechanism specifies how
the kernel reads and writes recalled constraints through that hosting;
it does not specify that the hosting must be constructed.

-----

## 3. What the browser already does

In a browser host, the following pattern operates without any code in
the architecture:

1. The CSS substrate resolves cascade rules against `data-*` attributes
   on the substrate-state element (per Phase 8 contract sec 4 flow 4a).
2. The DOM substrate persists those attributes for the lifetime of the
   element.
3. If the deposition writes a synchronous-before-paint hydration loop
   from `localStorage` to the DOM (rebuilding elements with their
   `data-*` attributes), the next first-paint frame contains those
   attributes ready for the cascade to resolve against.
4. The kernel evaluator, the CSS engine, and the GPU shader all
   resolve the *same constraint geometry* against the *same intake
   state* the browser presents at every tick. None of them distinguish
   between "intake state just produced by a click event" and "intake
   state just rebuilt from persistent storage."

This is the field being hosted "in DOM state and persistent storage
collectively" per SE-06:193. The substrates downstream of this hosting
operate identically in both cases because, by S2, constraint
resolution is substrate-independent: the substrates don't know or
care where the intake state came from, only what it is now.

The "it was waiting for me" phenomenology follows: there is no
rehydration *phase* because there is no rehydration *event*. The
geometry resolves against whatever the host represents the field as,
on every tick, including tick 1.

-----

## 4. What the storage-adapter machinery is for

The canonical `storage-adapter.js` + `substrate-media.js` +
`p3-persistence-binding.js` stack implements SE-13's recall mechanism
for **learned substrate state**: ratified constraints, promoted
compounds, family-meta constraints, the seed (per
`PersistenceEligibility.shouldPersistConstraint` at
`implementation/kernel/storage-adapter.js:457`).

These are constraints the substrate *earned* through ratification
(SE-05's M3) or promotion (SE-01's K1). They are state the browser
would not naturally persist on its own — they live in the kernel's
`Field.constraints` array, not in the DOM.

For applications that produce such state, the SE-13 machinery is
load-bearing: without it, ratifications evaporate on page close. The
adapter persists them; recall returns them on the next session.

For applications that do not produce ratifications (the TodoMVC
deposition is one — its cascade rules are static `kind: "derived"`
constraints declared in `deposition.js`, never ratified), the SE-13
adapter would persist almost nothing (the seed only, per the
eligibility rule). Wiring it would add machinery without function in
that context.

The architectural reading: SE-13 specifies storage for *substrate-
learned* state. SE-06:193 specifies substrate hosting for *substrate-
operating* state. For TodoMVC, the latter applies because the
application has no learned state; the deposition's todos are
application data the host (browser) persists through localStorage as
part of substrate hosting.

-----

## 5. The category distinction

| Category | What it is | Where it lives | How it persists in browser host |
|---|---|---|---|
| Substrate-learned state | Ratifications, promoted compounds, family-meta | `Field.constraints` (with kind tags) | `storage-adapter.js` per SE-13 eligibility filter |
| Substrate-operating state | Intake records, cascade output, current coord | `Field.intake.records`, `Field.cascadeOutput` | Browser's DOM + localStorage as substrate hosting per SE-06:193 |
| Application data | Todo items, user inputs, persisted UI state | DOM elements with `data-*` attributes | localStorage round-trip rebuilds DOM before first paint |

The three categories are co-hosted in the browser substrate. The
TodoMVC has the second and third; it does not yet have the first
because its deposition does not produce ratifications.

An implementation that introduces ratification (input-driven
constraint generation with a fidelity threshold) would acquire the
first category and benefit from wiring `storage-adapter.js`. Until
then, the architectural commitment SE-06:193 is honored by the
browser without further mechanism.

-----

## 6. What this implies for new TodoMVC-style work

Two engineering implications:

**6.1 Do not add storage machinery for substrate state that does not exist.**
A deposition with only static `derived` constraints (cascade rules
declared at boot, never ratified) produces no learned state. Wiring
`storage-adapter.js` against it would be a performative addition that
the canon does not require. The honest move is to recognize the
existing SE-06:193 hosting and surface its behavior.

**6.2 Make the existing recall visible.**
The "it was waiting for me" property is presently invisible — it
happens silently between page close and first paint. Making it
observable (an action milestone capturing "N items recalled from
storage hosting at boot", a status-line marker showing hydration count)
turns the constitutive property into an inspectable one. This is
appropriate to O1 (observation is read-only with respect to the field)
and O3 (observers source vocabulary from the field).

-----

## 7. The deeper recognition

When an implementer finds themselves about to *add* a substrate to do
work the host *already does*, that is a signal the host is already
operating a substrate the implementation has not yet noticed. The
correct response is to identify the substrate that is already
operating, name it against the canon, and make its behavior
observable — not to add a parallel mechanism that duplicates it.

This generalizes beyond storage:

- The CSS cascade is a constraint solver the browser already runs;
  algorithm 16's WGSL implementation does not *add* constraint
  resolution to the browser, it *names* the cascade's resolution as
  a substrate the kernel can read from (via `getComputedStyle`).
- Video decoders are already coordinate-delta resolvers; an
  architecture that proposes "stream coords over the wire" does not
  invent that pattern, it inherits it from media playback.
- The DOM is a substrate the browser hosts; an architecture that
  proposes "persistent constraint state in the browser" does not
  invent persistence, it inherits it from how DOM-plus-localStorage
  already operate together.

The architectural work is mostly recognition, not construction. The
canon's commitment to substrate-independence (S2) means: the kernel
operates over whatever substrate the host provides, on the host's
terms. Constitutive substrate behavior is more architecturally
load-bearing than additive substrate behavior, because constitutive
behavior cannot be undone or worked around — it is the host being
itself.

-----

## 8. What this article does and does not claim

### Does claim

- SE-06:193 names DOM and persistent storage as part of substrate
  hosting in a browser implementation.
- The "it was waiting for me" phenomenology in the TodoMVC reload is
  this hosting operating as the canon specifies, not a UX
  optimization or a coincidence.
- The `storage-adapter.js` / `substrate-media.js` / `p3-persistence-
  binding.js` machinery is the SE-13 mechanism for learned substrate
  state (ratifications, promoted compounds, etc.).
- Wiring that machinery into an application that produces no learned
  state would be performative and not architecturally required.
- The next architecturally honest move for the TodoMVC is to make
  the existing substrate recall observable, not to add machinery
  that duplicates it.

### Does not claim

- That all browser persistence mechanisms qualify as substrate
  hosting. The category requires that the persisted state participate
  in the same field the kernel and downstream substrates operate
  over. localStorage as a side-channel that does not flow through the
  DOM would not qualify.
- That SE-13's machinery is unnecessary. It is necessary for
  applications that ratify constraints; this article narrows when
  it applies, not whether.
- That recognition substitutes for specification. Where new
  substrates do need to be added (e.g., SVG as a network transport
  for geometric deltas, per a forthcoming SE-N draft), they require
  spec extensions, not just recognition.

-----

## 9. Live status

| Date (yyyy-mm-dd) | Action |
|---|---|
| 2026-05-25 | Article produced from the TodoMVC reload-experience observation. Capturing the recognition while it is fresh; foundational reframe (constitutive vs additive substrate behavior) preserved for future engineering decisions about when to add storage mechanism. |
