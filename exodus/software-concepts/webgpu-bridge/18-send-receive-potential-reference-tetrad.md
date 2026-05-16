# 18 - Send / Receive / Potential / Reference Tetrad

**Status:** THEORETICAL. A taxonomy, not an algorithm. Included in
this catalog because the project documentation repeatedly cites it
as the "four-element structural minimum" and derives design
decisions (including the IPC layer's role) from it.
**Primary origin:** `Quantum_Computing.md` (= `Post_Theory_Closure`)
Part 2 and Part 5
**Secondary origin:** `Development_Roadmap` section 2 ("Tetrad:
Structural minimum - Send / Receive / Potential / Reference")
**Implemented in:** partial correspondence in the Server/IPC/Client
architecture; see below

---

## Narrow-claim scope

A four-element classification scheme the source document proposes as
a structural minimum for any system that performs constraint
collapse. The scheme is descriptive: given a system, one maps its
machinery onto the four elements. The scheme is not computational:
no algorithm reads the tetrad and produces an output.

## The four elements

| Element | Role | What it is |
|---|---|---|
| Send | transmission | the channel across which state crosses the observer boundary |
| Receive | measurement | the endpoint that records what arrived |
| Potential | combinatorial space | the set of configurations that could be collapsed |
| Reference | invariant | the ground truth against which collapse is measured |

## The 25-system survey (summarized)

The origin document maps the tetrad across 25 systems. A few
representative examples:

| System | Send | Receive | Potential | Reference |
|---|---|---|---|---|
| Language | Phonology | Pragmatics | Syntax (combinatorial space) | Semantics (truth-conditions) |
| Markets | Ask | Bid | Liquidity (order book depth) | Price discovery |
| Science | Hypothesis | Observation | Experiment (intervention manifold) | Theory/paradigm |
| Law | Accusation | Defense | Evidence (admissible fact space) | Judgment (legal/illegal code) |
| Evolution | Mutation/recombination | Environment as fitness evaluator | Sequence space / NK landscape | Current adaptive peak |
| Neuroscience | Pre-synaptic spikes | Dendritic integration | Generative-model hidden causes | Top-down predictions / priors |
| Cell biology | Ligand / mRNA | GPCR, RTK, ribosome | Conformational space | Native fold / attractor |
| Thermodynamics | Microstate energy exchange | Macroscopic observables | Phase space | Conservation laws + MaxEnt |

## Correspondence with the implementation

The VSF architecture maps imperfectly but usefully onto the tetrad:

| Tetrad element | VSF counterpart |
|---|---|
| Send | Client-to-Server IPC messages (NAV_SET, PROB_INPUT, COMMIT, etc.) |
| Receive | Server-to-Client IPC responses (NAV_ACK, COMMIT_ACK, etc.) |
| Potential | The deterministic state space (cartesian product of dim values) |
| Reference | The constraint set (WHEN/THEN rules determine what each coord resolves to) |

This correspondence is retrofitted, not planned. The IPC layer was
designed to be the observer/measurement surface before the tetrad
framing was applied to the project. The fit is reasonable but not
unique: someone could defensibly map the four elements onto the
architecture differently.

## Why "four" specifically

The origin document argues:

- **Fewer than four** systems lack a reference and therefore cannot
 collapse (there is no ground truth against which to measure). A
 send+receive+potential system is a communication channel without
 semantics; it can move states around but cannot decide what they
 mean.
- **More than four** elements are claimed to be "elaboration within
 the tetrad (reflexive recursion, layered references, nested
 potentials) rather than new primitives."

The second claim is the weaker one. Jakobson's six-factor
communication model explicitly adds Message and Code, and the origin
document acknowledges these as "reflexive recursions emerging when a
system must self-monitor." Whether these reduce to the four elements
or constitute genuinely distinct primitives is a judgment call.

## What this does NOT provide

- Not a decision procedure. Given a new system, mapping it onto the
 tetrad is a judgment call, not a computation.
- Not a correctness proof. A tetrad-shaped system is not
 automatically correct; the mapping is descriptive.
- Not a design recipe. Building "a minimum viable four-constraint
 processor" from the tetrad alone underspecifies the actual
 mechanisms needed.

## Wide-claim scope

The origin document uses the tetrad to motivate the proposed
minimum-viable-processor (algorithm 20): four constraint types
correspond to the four tetrad elements. This is the motivated link,
not the conclusion.

The wider claim - that the tetrad is "the observed structural floor
across 25 natural and engineered systems" - depends on how
charitably one reads each mapping. Some mappings are tight (markets:
ask/bid/liquidity/price-discovery). Some are stretched
(thermodynamics: microstate energy exchange as "send"?). The
taxonomy's value is descriptive, not predictive.

## Why include this in the catalog

Because future contributors will encounter references to "the
tetrad" in project documents and should know:

1. What the four elements are named.
2. That the scheme is descriptive, not an algorithm.
3. That the correspondence to the implementation is a retrofit,
 useful but not unique.
4. That design decisions ("four is the minimum") trace back to this
 scheme, so disagreeing with the scheme is a real position with
 real consequences.

## Related algorithms in this catalog

- `12-synchronous-logged-ipc.md` - where Send and Receive live
- `19-observer-as-channel-triadic.md` - the |A->C<-B| framing,
 which is partially motivated by the tetrad's notion that
 "Receive" is itself a measurement element distinct from the
 things being measured
- `20-four-constraint-minimum-processor.md` - the design sketch
 that uses the tetrad as a motivating framework
