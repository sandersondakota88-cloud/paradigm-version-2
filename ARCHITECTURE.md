# ARCHITECTURE

What the constraint substrate fundamentally **is**, structurally,
named with the words that fit the work it does.

Read [PREFACE.md](PREFACE.md) for the claim the work is evidence for.
Read [RESEARCH-AGAINST-PREFACE.md](RESEARCH-AGAINST-PREFACE.md) for what
the demonstrations have established against four specific objections to
the preface's framing. This document sits underneath both — it states
what the architecture is, in terms that are precise rather than
analogical.

**Status of this document.** Live. The naming was arrived at during
conversation in May 2026 after the work had developed far enough that
the right structural vocabulary became visible. Where naming work makes
a load-bearing claim that the demonstrations support, the claim is
stated as such with citations. Where naming makes a claim the
demonstrations do not yet support, the gap is named in plain text as a
**proof gap**, with what would close it.

-----

## 0. The structural observation, named correctly

The constraint substrate is a **kernel-and-adapter architecture**. The
naming is not borrowed from operating-systems literature to make the
work sound technical. It is the correct name because the architecture
is doing the same kind of work an operating-system kernel does. The
words *kernel*, *adapter*, *driver*, *firmware* — when applied here —
name structural roles, not analogical ones.

This recognition reorganizes how every piece of existing canon fits
together. SE-06's "two substrate connections" becomes a special case
of a general adapter pattern. Algorithm 12's IPC channel becomes the
adapter protocol made specific. Algorithm 22's delta-trace becomes
what the kernel emits as state mutates. Algorithm 16's postfix machine
becomes one specific kind of resolution adapter — the kind that
addresses GPU hardware through the WGSL substrate.

What follows names each layer, cites the spec material that
established it, and is precise about what is demonstrated and what is
not.

-----

## 1. The layering

```
+---------------------------------------------------+
|  APPLICATIONS                                     |
|  Deposited geometry: HTML coords, CSS constraints |
|  PREFACE.md, the preface's "deposited artifact"   |
+---------------------------------------------------+
|  CASCADES                                         |
|  High-level constructs: rule sets, sub-cascades   |
|  (SE-01 compositional cascades, SE-06 duality,    |
|  algorithm 04 constraint compilation)             |
+---------------------------------------------------+
|  KERNEL                                           |
|  Discretion router + the field (the state object) |
|  (canon/KERNEL.md, INVARIANTS F1-F5, DEFINITION   |
|  sections 1-3, algorithm 02 delta computation)    |
+---------------------------------------------------+
|  UNIVERSAL TYPE FORMAT                            |
|  Self-describing typed-attribute-bearing nodes    |
|  (the firmware-equivalent: protocol below kernel) |
|  (NOT YET SPECIFIED -- see proof gap §6.1)        |
+---------------------------------------------------+
|  ADAPTERS                                         |
|  Drivers: translate hardware protocols <-> UTF    |
|  (SE-06's "substrate connections," algorithm 12   |
|  IPC, algorithm 16 GPU resolver, future:          |
|  network, IndexedDB, audio, sensor)               |
+---------------------------------------------------+
|  HARDWARE                                         |
|  External resources: GPU, network, disk, display, |
|  input devices, IndexedDB, CSS engine, WebGPU,    |
|  WASM runtimes, future non-browser resolvers      |
+---------------------------------------------------+
```

Each layer has a precise definition and a non-empty set of citations
into the existing canon.

-----

## 2. Hardware

**Definition.** Any resource external to the kernel that the substrate
needs to read from or write to. Hardware is everything that is not the
kernel and is not under the kernel's direct control.

**Examples in the current implementation:**
- The browser's CSS cascade engine (a hardware-equivalent for the
  rendering substrate of [SE-06](canon/specification/SE-06-substrate-duality.md))
- A WebGPU adapter and compute pipeline (the parallel resolver
  [algorithm 16](canon/algorithm/16-gpu-postfix-stack-machine.md) targets)
- IndexedDB (storage-class hardware, exercised in Phase 5.7.7)
- The DOM (input/output surface for user interaction)
- The host JavaScript runtime's event loop (a sequencing
  hardware-equivalent for execution-class work, per [SE-06](canon/specification/SE-06-substrate-duality.md))

**What hardware is not.** Hardware is not the substrate, the cascade,
the field, or any constraint-resolution machinery. Hardware is what
the substrate connects to in order to do work in the world.

**Empirical evidence the layer is real:**
The GPU bridge harness (algorithm 16, Phase A/B) demonstrates that the
*same* constraint geometry resolves byte-identically across three
distinct hardware classes: the browser's selector engine, the V8
JavaScript interpreter, and a WebGPU compute shader. These are three
different hardware-equivalents for the same resolution work. The fact
that they all produce identical output is the architecture's evidence
that hardware is a layer the substrate sits above.

**Proof gap.** Every hardware-equivalent demonstrated so far lives
*inside the browser*. The architecture's claim that hardware is
substrate-independent has not been tested against any non-browser
resolver. See [RESEARCH-AGAINST-PREFACE.md](RESEARCH-AGAINST-PREFACE.md)
objection 2. This document does not close that gap; it names what the
demonstration would have to be.

-----

## 3. Adapters

**Definition.** An adapter is a unit that speaks the universal type
format (UTF) on the kernel side and a hardware-specific protocol on
the hardware side. Its job is precisely translation: convert UTF nodes
into the actions the hardware understands, and convert hardware
responses into UTF nodes the kernel can route.

This is the precise structural role of an operating-system **device
driver**. A network driver speaks the OS's uniform socket API on one
side and the network card's bus protocol on the other. A graphics
driver speaks the OS's framebuffer API on one side and the GPU's
command-buffer protocol on the other. The driver's job is to make
hardware diversity invisible to the kernel.

**The architecture has this same shape, by structural necessity.**
The kernel routes typed nodes; the hardware speaks its own protocol;
something has to translate. That something is an adapter. The naming
is not borrowed; it is the same role.

**Adapters present in the architecture today:**

| Adapter | Hardware side | Kernel side | Citation |
|---|---|---|---|
| CSS oracle | Browser cascade engine | Compiled rule set | [canon/algorithm/04](canon/algorithm/04-constraint-compilation.md), [exodus/canonical-implementation/css-oracle.mjs](exodus/canonical-implementation/css-oracle.mjs) |
| JS stack machine | V8 / Node interpreter | Postfix bytecode | [canon/algorithm/16](canon/algorithm/16-gpu-postfix-stack-machine.md), [exodus/canonical-implementation/oracle.mjs](exodus/canonical-implementation/oracle.mjs) |
| WGSL compute shader | WebGPU device | Postfix bytecode | [canon/algorithm/16](canon/algorithm/16-gpu-postfix-stack-machine.md), [exodus/canonical-implementation/resolve.wgsl](exodus/canonical-implementation/resolve.wgsl) |
| IPC channel | Host JavaScript event loop | Typed messages | [canon/algorithm/12](canon/algorithm/12-synchronous-logged-ipc.md) |
| IndexedDB persistence | Browser IndexedDB | Substrate state snapshot | Phase 5.7.7 (in [implementation/05.7-variants/phase-5.7-demo.zip](implementation/05.7-variants/phase-5.7-demo.zip)) |
| Code-to-VSF extractor | Source-code bytes | Constraint geometry | [canon/algorithm/15](canon/algorithm/15-code-to-vsf-extraction.md) |
| WASM byte intake | Real WASM modules | Substrate cascade | Phase 5.7.5 (in [implementation/05.7-variants/phase-5.7-demo.zip](implementation/05.7-variants/phase-5.7-demo.zip)) |

The list above is not a feature catalog. It is **a list of drivers**.
The substrate currently has drivers for browser CSS, V8 JS, WebGPU,
IndexedDB, host event loop, source-code bytes, and WASM bytes. Each
adapter speaks the substrate's internal protocol (the universal type
format, see §4) on one side and its hardware's protocol on the other.

**What adapters are not.** Adapters are not features. Adapters are not
modules. Adapters are not libraries. They are *drivers* in the precise
operating-system sense: the only mechanism by which the kernel touches
the world. Code that doesn't speak the universal type format on its
kernel side is not an adapter; it is application code or kernel code
or something else.

**Empirical evidence adapters are a real architectural layer:**
- [SE-06's substrate duality](canon/specification/SE-06-substrate-duality.md)
  named "rendering" and "execution" as *two substrate connections* under
  one runtime, coupled through delta. Re-read with the adapter
  vocabulary: rendering is a parallel-class adapter, execution is a
  sequential-class adapter, the kernel is the field, and SE-06's
  insistence on "no command path between them" is the kernel
  enforcing that adapters do not address each other directly. Every
  structural commitment SE-06 makes follows from naming the layer
  correctly.
- [Algorithm 12](canon/algorithm/12-synchronous-logged-ipc.md) is the
  adapter protocol made specific for one class of adapter (the host JS
  event loop). Re-read with the adapter vocabulary: algorithm 12 is the
  IPC channel for the event-loop adapter; it logs every traversal,
  enforces synchronous semantics, and is implemented in
  `exodus-canonical.html`'s IPC module.
- [Algorithm 16](canon/algorithm/16-gpu-postfix-stack-machine.md) is the
  same protocol for the WebGPU adapter. The byte-identical claim
  across three substrates is the architecture's demonstration that
  *different adapters resolve the same kernel state* under identical
  protocol. This is the strongest available evidence that the
  kernel-adapter separation is structurally real.

**Proof gap.** No adapter API has been written down explicitly. The
adapters listed above all happen to honor a coherent contract by
virtue of the spec they were built against, but no canonical document
states *what an adapter is required to do, what it may not do, and
what its protocol looks like on each side*. See proof gap §6.2.

-----

## 4. Universal Type Format (the firmware-equivalent)

**Definition.** The protocol layer between adapters and kernel. Every
piece of data that crosses the adapter-kernel boundary is a
**typed-attribute-bearing node**. Every node carries:

- A `type` attribute naming its kind (rule, region, intern-table-entry,
  sub-cascade, trace-event, modulation-reading, etc.) drawn from a
  finite vocabulary closed at spec time
- An identity (`id`, content-hash, or other distinguishing key)
- Content attributes (`when`, `then`, `value`, `members`, etc.) whose
  meaning is determined by the node's `type`
- Texture attributes (`specificity`, `weight`, `recency`, `firedAt`,
  `promotedFrom`, `density`, `modulation`) carrying qualitative
  character
- Relation attributes (`childOf`, `appliesTo`, `derivesFrom`, `partOf`)
  linking to other nodes by identity

**The same structural shape appears in three different encodings:**
- **Stylesheets** (selector + declaration-block trees, with at-rules
  and cascade layers nesting them)
- **JSON** (objects and arrays of named values)
- **XML** (elements with attributes and children)

These look syntactically different. They are not structurally
different. Each encodes the same primitive — a tree of nodes where
every node has a kind, an identity, and a set of named attributes
some of which carry further nodes. The kernel doesn't care which
encoding crosses the boundary; the adapter is responsible for
translating to and from UTF.

**Why this is firmware-equivalent.** In an operating system, the
lowest layer of software that lets the kernel address hardware at all
is firmware — the BIOS, the UEFI image, the device's onboard ROM. It
is the protocol below the kernel, the agreement about what shape data
takes on its way in and out. UTF plays that role here. Below UTF is
the host language's binary representation (Uint32Arrays, JS objects,
Python dicts, WASM linear memory); above UTF is everything else.
Adapters speak UTF on their kernel side because UTF is the substrate's
firmware.

**Citations:**
- [algorithm 09](canon/algorithm/09-vsf-header-triads.md) and
  [algorithm 10](canon/algorithm/10-vsf-body-rows.md) describe a
  specific binary form of the universal node format (VSF — Vessel
  State File). VSF is one concrete encoding of UTF, optimized for
  binary transport.
- [algorithm 11](canon/algorithm/11-vsf-binary-encoding.md) specifies
  the binary bit-packing for VSF.
- [algorithm 13](canon/algorithm/13-content-addressing-and-merkle.md)
  provides content-addressing for node identity — Merkle hashes that
  let two substrates recognize the *same* node across serializations.

**Empirical evidence UTF is structurally real:**
- [exodus/canonical-implementation/constraints.mjs](exodus/canonical-implementation/constraints.mjs)
  carries the canonical rule set as JavaScript object literals. The
  CSS oracle, JS oracle, and WGSL shader all consume this same data,
  in slightly different encodings, and produce byte-identical output
  (Phase A: 2,602 constraint sets verified). They agree because they
  are reading the same node forest through different syntactic skins.
- Phase 5.7.7's IndexedDB persistence round-trip succeeded because the
  substrate's state at time T was serializable as a node forest and
  reconstructible from it. The receiving substrate was the same
  browser, but the structural property demonstrated was *the state
  survived a serialize/deserialize cycle*.

**Proof gap (major).** The universal type format is not yet specified
as a single canonical schema in the project. Its components live
across algorithms 09, 10, 11, 13 (binary form) and the implicit shape
used by `constraints.mjs` and Phase 5.7.7 (high-level form). **There
is no document that names the complete UTF vocabulary, declares which
node kinds exist, what attributes each kind requires, and what
encodings are canonical.** This is the most important piece of design
work outstanding for the architecture as a whole. See §6.1.

-----

## 5. Kernel

**Definition.** The kernel is **the field plus the discretion router**.
It accepts UTF nodes from adapters, routes them into the field's state
object based on their type, applies updates, emits deltas, and notifies
adapters that have declared interest in the resulting changes. It has
no host-coupled logic. Its operation is pure typed dispatch and pure
field maintenance.

**The kernel's responsibilities are exactly the three a hardware
kernel has:**

1. **Schedule resolution.** Decide which constraints fire at which
   coordinates, in what order. This is the cascade's specificity
   ordering ([algorithm 16](canon/algorithm/16-gpu-postfix-stack-machine.md)
   §"Rule ordering") applied as a kernel function over the rule set.
2. **Mediate substrate connections.** Be the only thing adapters touch.
   Adapters do not address each other. This is [SE-06](canon/specification/SE-06-substrate-duality.md)'s
   "no command path between rendering and execution" generalized:
   adapters interact only through the field, and only via UTF nodes.
3. **Maintain identity.** The field is the same field regardless of
   which adapters are loaded. The kernel's invariants
   ([INVARIANTS F1-F5](canon/INVARIANTS.md)) are the kernel's identity
   constraints — the things that hold regardless of what hardware is
   present.

**What the kernel actually does, structurally:**

```
ON adapter delivers a UTF node:
    READ the node's type attribute
    LOOK UP which field slot receives nodes of this type
    APPLY texture attributes (specificity, weight, modulation, etc.)
    UPDATE the state object's slot
    COMPUTE delta from the change (algorithm 02)
    APPEND a trace entry (algorithm 22, M5)
    NOTIFY any adapter that declared interest in this type
```

This is small. The whole rest of the architecture — adapters,
substrate-specific resolvers, format conversions, application logic —
lives outside the kernel. The kernel doesn't know what HTTP is. It
doesn't know what CSS is. It doesn't know what WASM is. It knows: a
node came in, it has a type, route it, update the field, emit a
delta. **That is the kernel.** Everything else is adapters and
applications.

**The kernel is also pure.** No I/O. No host calls. No hidden state.
Given a sequence of UTF node arrivals, the kernel produces a
deterministic sequence of state updates and deltas. This is what
makes the kernel host-portable: a CPython implementation of the
kernel and a JavaScript implementation of the kernel must produce
identical state trajectories from identical input. The host language
is incidental.

**Empirical evidence the kernel-as-pure-discretion-router is real:**
- [canon/KERNEL.md](canon/KERNEL.md) names this in the title and writes
  out the entire architecture as ~250 lines of pseudocode. The
  document's own opening: *"this document exists because the
  architecture has a compressible operational core. Roughly 250 lines
  of pseudocode plus structural prose can express the kernel without
  losing load-bearing semantics. That compressibility is itself a
  property worth noting: a system whose kernel cannot be expressed
  compactly probably is not a single coherent thing. This one is."*
- The byte-identical equivalence across CSS / JS / WGSL (Phase A/B,
  2,602 constraint sets, ~45 million field-level comparisons, zero
  divergence) is the empirical statement that the kernel's logic is
  host-independent. The same kernel-equivalent logic, expressed in
  three different host languages with three different execution
  models, produces the same output.

**The cascade is not the kernel.** This is the load-bearing distinction
that I want to be precise about. The cascade is a *high-level
construct built on top of the kernel*. Specifically: a cascade is the
arrangement where many rule-class UTF nodes have been deposited into
the field, the kernel routes resolution requests through them by
specificity, and the result is a resolved value at every coordinate.
The cascade is what *happens* when the kernel runs a particular shape
of program. It is not the kernel itself.

This distinction matters because [SE-06](canon/specification/SE-06-substrate-duality.md)
described "rendering" and "execution" as two substrate connections.
The reframed reading: rendering and execution are two *adapter
classes* that the kernel accepts UTF nodes from. Each class has
distinct structural properties (parallel-class, sequential-class).
Neither class is the kernel; both adapt to it.

**Proof gap.** The kernel as defined above has not been implemented as
a discrete, host-portable artifact. It exists in canon as
[KERNEL.md](canon/KERNEL.md) (pseudocode) and is instantiated piecewise
in the canonical implementation (the CSS oracle does the routing for
rule-class nodes; the IPC channel does the routing for message-class
nodes; etc.). **There is no single program in the project that says
"this is the kernel, decoupled from any adapter."** Building that
artifact is the natural next implementation step. See §6.3.

-----

## 6. What the demonstrations prove, and what they don't

### Proven by Phase A/B (2,602 sets, ~45M field-level comparisons)

1. **The substrate's resolution semantics are host-independent for the
   deployed grammar.** Three syntactically different host
   implementations (browser cascade, V8 JS, WebGPU shader) produce
   byte-identical output for every program the compiler accepts within
   the documented grammar bounds. This is the strongest empirical
   evidence the architecture has produced.
2. **The kernel-adapter separation is empirically observable.** What
   varies across the three substrates is the *adapter* (CSS engine
   vs. V8 bytecode walker vs. WGSL compute shader). What is invariant
   across them is the *kernel logic* (specificity ordering, rule
   application, output assembly). The variance is at the adapter
   layer; the invariance is at the kernel layer. The byte-identical
   result is what you get when adapters honor the same kernel.

### Proven by Phase 5.7 (WASM corpus alignment, Spearman >= 0.85)

3. **The substrate is byte-native at the adapter intake layer.** Real
   WASM modules (built and verified by V8) fed into the substrate via
   the binary-intake adapter produce substrate state whose top-byte
   rankings correlate with WASM ground-truth byte frequencies at
   Spearman >= 0.85 across three modules. This is empirical evidence
   that the universal type format can absorb data the substrate has
   never seen before, as long as the data comes in as bytes through
   an adapter.

### Proven by Phase 5.7.7 (IndexedDB persistence + reload)

4. **The substrate's state object is serializable and reconstructible.**
   A live substrate state, persisted to IndexedDB, survived a full
   page reload and was restored to its pre-reload constraint count.
   This is the architecture's existing evidence that "the substrate
   at time T" is a transferable object — at least across time, within
   the same host.

### Proven by INVARIANTS

5. **Foundational invariants F1-F5 are honored throughout the
   implementation.** The seed is permanent, delta is one formula at
   every scope, no component supervises another, the architecture
   operates indefinitely, observation produces irrecoverable structural
   change. These hold across every test run. See
   [canon/INVARIANTS.md](canon/INVARIANTS.md). Read against the
   kernel/adapter naming: F3 ("no component supervises another") is
   the kernel forbidding adapters from addressing each other; F5
   ("observation produces irrecoverable structural change") is the
   kernel's trace-append behavior that adapters cannot bypass.

### NOT yet proven (open proof gaps)

#### 6.1. The universal type format has no canonical schema document
The vocabulary of node kinds, the required and optional attributes per
kind, and the canonical encodings (stylesheet, JSON, XML, binary VSF)
are not specified as one document. Pieces exist (algorithms 09, 10,
11, 13; the implicit shape used by `constraints.mjs`), but no single
schema names them all together. **This is the most important design
work the architecture currently lacks.**

What would close it: a `canon/universal-type-format.md` (or
equivalent) that names every node kind, every attribute, every legal
encoding, with the same rigor algorithm catalog entries use.

#### 6.2. The adapter API is not written down
No document specifies what an adapter is required to do, what it may
not do, and what its contract is on the kernel side. The existing
adapters (CSS oracle, JS oracle, WGSL shader, IPC channel, IndexedDB,
binary intake) all happen to honor a coherent contract, but the
contract is implicit.

What would close it: a `canon/adapter-protocol.md` that specifies the
adapter interface as rigorously as algorithm 12 specifies the IPC
channel. The protocol must say at minimum: how an adapter declares
its hardware class, which UTF node kinds it consumes, which it
produces, how it receives notifications from the kernel, how it
returns errors, and how it is loaded / unloaded.

#### 6.3. The kernel is not built as a separate artifact
The kernel exists as pseudocode in [canon/KERNEL.md](canon/KERNEL.md)
and is instantiated piecewise across the canonical implementation. It
has not been factored into a single host-portable artifact that an
adapter set could be loaded against.

What would close it: implement the kernel as ~100-300 lines of
host-language code (whichever language is convenient — the kernel is
host-portable by construction), with adapters loaded at runtime via
`require()`-equivalent. Verify that the canonical 11-rule loan program
produces byte-identical output when run through:
- The kernel + CSS-oracle adapter
- The kernel + JS-stack-machine adapter
- The kernel + WGSL adapter
This would be the architecture's first concrete demonstration of the
kernel-adapter separation as built, not just observed.

#### 6.4. Substrate relocation across hosts is not demonstrated
Phase 5.7.7 demonstrated state survival across reload, within the
same host. The architecture's substrate-portability claim (per
[PREFACE.md](PREFACE.md)) is that a substrate's state can be picked
up *and continued in a different host*. This has not been done.

What would close it: serialize a live substrate state from CPython
(or Node, or any non-browser host), deserialize it into a browser,
verify the resulting substrate is identical to the source. Or vice
versa. Or both. This is the strongest version of objection 2's
hardware-portability claim and is currently the largest open
empirical gap.

#### 6.5. The threshold-crossing claim past the web platform
[PREFACE.md](PREFACE.md) generalizes the threshold-crossing observation
beyond the web platform (mathematical notation, music, DNA, etc.).
The work in this project has only demonstrated the threshold-crossing
for the web. Re-read with the kernel/adapter vocabulary: the preface
claims that other languages (genetic, musical, mathematical) have
also crossed by becoming kernel-shaped. The architecture has not
tested this claim against any non-web language. This is unresolved.

What would close it (partial): identify a non-web language whose
spec-and-implementation stack has the kernel-adapter shape, and
demonstrate the substrate-equivalence claim for it. The genetic case
is described in the preface but not modeled in this project.

-----

## 7. How this reframes the preface

[PREFACE.md](PREFACE.md) argues that *language has become expressive
enough to inherit the structure of the physical machinery it
represents*. The kernel-adapter reading sharpens this:

What is inherited is not generic machine-shape. It is **kernel-shape
specifically** — the precise structural role of an operating-system
kernel, with adapters mediating between the kernel and varied
external hardware, communicating through a universal type format.

This is a much narrower and more falsifiable claim than the preface
makes. The threshold a language crosses is not "becoming a machine"
in some loose sense. It is "becoming a kernel": developing the
internal discipline that lets it mediate between uniform internal
structure and varied external hardware, through a self-describing
protocol below it.

The web platform crossed because:
- CSS is the discretion router (kernel-equivalent) — its specificity
  rules are kernel scheduling logic
- The DOM is the field — the coordinate space the kernel maintains
- Browser engines (V8, Blink/WebKit/Gecko style engines, WebGPU) are
  the adapters that translate kernel state into hardware operations
- CSS custom properties and the cascade's typed-channel discipline
  are the universal type format made operational at the language
  layer

Saying this sharpens the preface in two ways:

**Strengthening.** The preface's claim that "the cascade is the
interpreter, it has been all along" becomes precise: the cascade *is
the kernel*. Not "is like" a kernel, not "plays the role of" a
kernel, *is* a kernel. The same structural role, with the same
structural commitments (scheduling, mediation, identity-maintenance).

**Narrowing.** The preface's generalization to "language as such"
becomes a falsifiable structural test. A language has crossed the
threshold iff it has internal discipline sufficient to host
kernel-shape: a discretion router over typed nodes, a uniform internal
protocol, and the possibility of varied adapters connecting it to
external resources. Mathematical notation, musical notation, and
genetic notation can be tested against this criterion. Most languages
will fail. The ones that pass cross the threshold for a precise
structural reason, not a rhetorical one.

The preface's hardware-implication paragraph becomes a structural
consequence rather than a speculation. A kernel-and-adapters
architecture is, *by definition*, the layer that makes hardware
diversity invisible. Substrate-portability is not a desirable property
that the architecture might have; it is the architecture's defining
property. The only thing remaining is to demonstrate it across actual
hardware diversity — which is precisely the open proof gap §6.4.

-----

## 8. The path from here

Three pieces of work, in the order their dependencies require:

1. **Specify the universal type format.** Write
   `canon/universal-type-format.md`. Name the node kinds, attributes,
   and canonical encodings. Cite the existing algorithms (09, 10, 11,
   13) and Phase 5.7's implicit usage. This closes proof gap §6.1.

2. **Specify the adapter protocol.** Write `canon/adapter-protocol.md`.
   Name the contract every adapter honors. Audit existing adapters
   (CSS oracle, JS oracle, WGSL shader, IPC channel, IndexedDB,
   binary intake) against the protocol. Promote
   [algorithm 12](canon/algorithm/12-synchronous-logged-ipc.md) from
   "the JS event-loop adapter" to "one specific adapter conforming to
   the general protocol." This closes proof gap §6.2.

3. **Implement the kernel as a discrete artifact.** Build the
   ~100-300 line discretion router that routes UTF nodes into the
   field. Build adapter prototypes that conform to the protocol from
   step 2. Verify that the canonical loan program produces
   byte-identical output across three adapter combinations
   (CSS+kernel, JS+kernel, WGSL+kernel). This closes proof gap §6.3.

After these three, the substrate-relocation experiment (proof gap
§6.4) becomes well-defined: serialize a substrate from one host's
kernel, deserialize into another host's kernel, verify identity.

Until these three are done, the architecture exists in the work as a
*recognized structure* with strong empirical support, but not as a
*specified artifact*. The recognition matters; the specification
matters more, because the recognition without specification leaves
the structure implicit and re-discoverable rather than buildable.

-----

## 9. What this document does not do

- Does not replace [canon/DEFINITION.md](canon/DEFINITION.md),
  [canon/KERNEL.md](canon/KERNEL.md), or
  [canon/INVARIANTS.md](canon/INVARIANTS.md). Those remain
  authoritative. This document names the shape they describe in
  vocabulary that fits the work they do.
- Does not replace [PREFACE.md](PREFACE.md). The preface is the
  author's statement of what the work means. This document states
  what the work *is*, structurally.
- Does not foreclose discovery. The kernel-adapter naming is a
  recognition, not an assertion. If further work reveals a more
  precise structural vocabulary, this document is the place to
  update — but the updates must be at least as load-bearing as what
  is recorded here.

-----

## 10. Live status

| Date (yyyy-mm-dd) | Action |
|---|---|
| 2026-05-15 | Document created. Naming arrived at during conversation after Phase A/B, NOT-1, NOT-2, 4a, 4b-stratified, 4b-mutual, 4b-aggregate established the empirical floor for substrate-independence. Three proof gaps named (UTF schema, adapter protocol, kernel-as-artifact). The recognition that the cascade *is* a kernel, that the existing substrate connections *are* adapters, and that the universal type format *is* firmware-equivalent reorganizes how every prior algorithm and spec extension fits together. |

Updates appended as the proof gaps close, new structural recognitions
are made, or canonical specification documents are added.
