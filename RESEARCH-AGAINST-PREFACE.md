# Research against the preface

A live catalogue of the work assembled in response to four specific
objections to [PREFACE.md](PREFACE.md). Read this document as an index
of evidence and arguments, not as a self-contained argument; the
load-bearing material lives in [canon/](canon/), [implementation/](implementation/),
and [exodus/canonical-implementation/](exodus/canonical-implementation/).
This file points to those locations and names what each piece argues.

This document is **live**: updated as we add tests, harden findings,
or open new tracks. Each entry carries a date so reading order is
recoverable.

**See also:** [ARCHITECTURE.md](ARCHITECTURE.md) sits at the project
root alongside this document and names what the substrate
structurally *is* (kernel + adapters + universal type format +
hardware). The architecture recognition reframes several of the
objections below — in particular, objection 2 (hardware implication)
shifts from "empirically open" to "structurally answered by the
architecture's defining property; empirically open at the level of
demonstration." See the Status table in §2 below for the updated
read.

---

## 0. Origin and frame

In conversation, four objections to PREFACE.md were raised. The
preface argues a single structural claim: *language has become
expressive enough to inherit the structure of the physical machinery
it represents*, with the web platform (HTML/CSS/JS, especially the
cascade) as the legible venue. The four objections were:

1. **The threshold metaphor is doing more work than it earns.**
   "A language crosses a threshold and becomes a machine" sounds
   structural but is hard to falsify. Mathematical notation, music,
   DNA, and HTML/CSS/JS are lumped together as instances of the same
   phenomenon, but the resolvers in each case are radically different
   kinds of thing. Calling them all "the language being the machine"
   is a rhetorical move, not a structural identity. The web case
   stands on its own without needing the genetic-notation framing to
   support it.

2. **The hardware implication is overreach.**
   The preface claims the next several decades of hardware design are
   probably not faster CPUs but substrates whose native operation is
   what current systems simulate. This rests on a substrate-portability
   argument that has not been demonstrated against any non-browser
   resolver. Until something other than a CSS engine resolves a
   deposited artifact, substrate-portability is hypothesis, not
   evidence.

3. **The closed-abstraction posture in DEFINITION.md §0.5 is
   epistemically convenient.**
   §0.5 says external validation cannot establish or refute the
   architecture's correctness; only structural inspection against
   the spec can. Internal coherence is necessary but not sufficient;
   many internally coherent systems describe nothing. The test
   results (66/66, 22/22, 115/115) *are* external validation, and
   they're the strongest part of the case -- the preface shouldn't
   disclaim the thing actually carrying the weight.

4. **The engineering core is stronger than the thesis wrapping.**
   The most impressive evidence is the GPU bridge: byte-identical
   resolution across CSS / JS / WGSL over 2,880 coordinates. That
   is a concrete substrate-independence result, not a framing claim.
   The thesis would be more persuasive if it leaned harder on the
   demonstrations and less on the generalization to "language as
   such."

The work in this document is the structured response to those four.
Each piece of work names which objection(s) it addresses, what it
argues, and what would falsify it.

---

## 1. Work catalogue, by objection

### Objection 1 -- threshold metaphor

The threshold metaphor needed falsifiable structure. The work pursued
this by locating where the substrate-independence claim *holds*,
where it has a *syntactic edge*, and where it has a *structural
edge that predicts its own failure*. The pattern of inside/edge/outside
gives the threshold a precise shape.

**Algorithm 16 rewrite** -- [canon/algorithm/16-gpu-postfix-stack-machine.md](canon/algorithm/16-gpu-postfix-stack-machine.md)
*Status: status flipped PROPOSED -> IMPLEMENTED.*
The rewrite added the structural argument (constraint algebra, why
postfix is forced, equivalence by construction) and closure boundaries
(predicate, arity, output width, independence). Each closure boundary
is a falsifiable prediction about where the claim should and should
not hold. This is the document that the rest of the work fills in
against.

**Phase A** -- [exodus/canonical-implementation/tests/equivalence.test.js](exodus/canonical-implementation/tests/equivalence.test.js)
*2,601 generated constraint sets, CSS oracle = JS oracle byte-identical
across all 2,880 coords each.* This is the empirical floor: every
program the current compiler accepts resolves byte-identically across
the reference (CSS) and the bytecode (JS) substrates. It establishes
the threshold *holds inside* the deployed grammar.

**Phase B** -- [exodus/canonical-implementation/tests/gpu-equivalence.html](exodus/canonical-implementation/tests/gpu-equivalence.html)
*Same 2,602 sets, CSS = JS = WGSL byte-identical (browser, 22.5s
runtime).* Extends Phase A to the third substrate. The strongest
empirical case the project has for substrate-independence within the
narrow region.

**NOT-1** -- [exodus/canonical-implementation/tests/extensions/not-1/not1-equivalence.test.js](exodus/canonical-implementation/tests/extensions/not-1/not1-equivalence.test.js)
*2,734 sets with single-dim NOT clauses, byte-identical across CSS
and JS.* The threshold extends under predicate extension; one new
opcode preserves byte-equivalence. Confirms the algorithm 16 closure
prediction "the postfix form remains forced" under negation.

**NOT-2 (compound NOT boundary)** -- [exodus/canonical-implementation/tests/extensions/not-1/not2-boundary.test.js](exodus/canonical-implementation/tests/extensions/not-1/not2-boundary.test.js)
*The cascade resolves `NOT (A AND B)` as a single region (2,640 coords);
the grammar cannot phrase it as one clause; DNF expansion across two
rules reaches the same region byte-equivalently.* First located
boundary: **syntactic**. The grammar can read every region the
cascade resolves but cannot name every region in one clause. The
threshold has a syntactic edge with an in-grammar workaround.

**4a Reduction boundary** -- [exodus/canonical-implementation/tests/extensions/reduction-4a/reduction-4a.test.js](exodus/canonical-implementation/tests/extensions/reduction-4a/reduction-4a.test.js)
*Cascade-correct denied-coord count is 852 of 2,880. The grammar's
10 opcodes have no reduction primitive, no cross-coord read, no
global write. No DNF-style workaround exists inside the grammar.*
Second located boundary: **structural**. The byte-identical
equivalence claim covers field resolution; it is silent about field
consumption. The threshold has a structural edge with no in-grammar
workaround.

**4b Stratified** -- [exodus/canonical-implementation/tests/extensions/dependence-4b/stratified.test.js](exodus/canonical-implementation/tests/extensions/dependence-4b/stratified.test.js)
*A rule that reads one named foreign coord. The current 8-bit operand
cannot carry a 12-bit coord index; the shader has no inter-invocation
barriers; supporting it requires K-pass dispatch where K is the
longest dependence chain.* Third located boundary: **machine shape**.
The encoding word and the dispatch model change.

**4b Mutual** -- [exodus/canonical-implementation/tests/extensions/dependence-4b/mutual.test.js](exodus/canonical-implementation/tests/extensions/dependence-4b/mutual.test.js)
*Two coords whose resolutions depend on each other. Two fixed points
exist, the system oscillates from asymmetric initial states, and the
three substrates' default-dispatch behavior diverges.* Fourth located
boundary: **beyond the architecture**. The byte-identical claim does
not hold without four new commitments (iteration, initial conditions,
convergence criterion, oscillation policy).

**4b Aggregate** -- [exodus/canonical-implementation/tests/extensions/dependence-4b/aggregate.test.js](exodus/canonical-implementation/tests/extensions/dependence-4b/aggregate.test.js)
*Predicates over reductions of the resolved field. Phase transition
at density 0.50/0.51; one-coord perturbation flips the reachable
fixed point.* Deepest boundary tested. Combines 4a and 4b-mutual;
under-determined without explicit initial conditions and reduction
primitives in the substrate.

**Status against objection 1.** The threshold metaphor now has a
precise boundary map. Inside the boundary, byte-identical equivalence
holds by construction across three substrates over every program the
compiler accepts. At the syntactic edge, DNF bridges to the same
resolved regions. At the structural edge, an external agent is
required (the byte-identical claim is precisely silent about
consumption). Beyond, the architecture must commit to additional
semantics. *The threshold is real, bounded, and predicts its own
failure modes.* This addresses the falsifiability complaint
directly: the metaphor was vague; the boundary is sharp.

**Open.** The web-platform demonstration of the threshold is now
mapped. The preface generalizes the threshold to *language as such*
(mathematical notation, music, DNA, etc.). That generalization
remains unsupported by anything in this catalogue. The work argues
the threshold-crossing is real and locatable *in the web platform*;
it does not argue, and cannot argue, that the same phenomenon occurs
in the other media named. **The generalization remains rhetoric.**

---

### Objection 2 -- hardware implication

The preface claims hardware design will shift toward substrates whose
native operation matches what current systems simulate. This rests
on substrate-portability across resolvers that don't yet exist.

**Status.** *Not yet addressed by any work in this catalogue.* The
GPU bridge (algorithm 16, Phase A/B) demonstrates substrate
portability *across substrates that already exist in one platform*
(CSS engine, JS interpreter, WGSL compute shader, all in a browser).
It does not demonstrate portability to a non-browser resolver. The
hardware implication of the preface requires evidence of an artifact
running on something other than a browser.

**Track 2 (proposed, not started)** -- IndexedDB as a unidirectional
substrate connection. Discussed in conversation but not built. Even
if completed, IndexedDB is still in-browser; it tests the read/write
discipline (read-only or write-only, not both) rather than testing
portability to a non-browser resolver.

**What would address this objection.** A working artifact resolving
on a non-browser substrate -- a constraint-solving ASIC, an FPGA
implementation, a server-side native CSS engine, or even a non-browser
WebGPU-equivalent compute environment. None exists in this project.
Until one does, the hardware implication is hypothesis. **This is
the largest unaddressed objection.**

---

### Objection 3 -- closed-abstraction posture

DEFINITION.md §0.5 says external validation cannot establish or
refute correctness. The objection: the strongest evidence we have
IS external validation; the posture disclaims its own load-bearing
work.

**Phase A/B as external validation** -- [exodus/canonical-implementation/tests/equivalence.test.js](exodus/canonical-implementation/tests/equivalence.test.js),
[exodus/canonical-implementation/tests/gpu-equivalence.html](exodus/canonical-implementation/tests/gpu-equivalence.html)
*2,602 constraint sets, ~45 million field-level comparisons, three
substrates, zero divergence.* This is precisely the kind of evidence
§0.5 says cannot establish correctness. And yet without it, the
substrate-independence claim has no empirical floor. The posture is
either wrong about what external validation can do, or wrong about
what its own work depends on.

**Algorithm 16 rewrite as reframe** -- [canon/algorithm/16-gpu-postfix-stack-machine.md](canon/algorithm/16-gpu-postfix-stack-machine.md)
The rewrite makes the test results load-bearing. It does not
position structural inspection as the *only* validation; it
positions the empirical record and the structural argument as
mutually reinforcing. This is a structural change in framing within
canon, even though it does not touch DEFINITION.md §0.5 itself.

**Status against objection 3.** Partially addressed. The empirical
record now carries weight in algorithm 16 and in DEFINITION.md §3.8
(updated in the audit pass). DEFINITION.md §0.5 itself remains
unchanged -- it still says external validation cannot establish or
refute correctness. The two postures coexist in canon: §0.5 says
the work doesn't need empirical validation; §3.8 cites empirical
validation as load-bearing for substrate-independence. *This is a
real tension in canon, and the catalogue's role is to name it.*

**What would address this objection fully.** A rewrite or amendment
of §0.5 acknowledging that empirical validation, where available,
is part of how the work proves itself, rather than something separate
from "structural inspection." This is a content decision for the
author, not a research finding.

---

### Objection 4 -- engineering core vs thesis wrapping

The objection: the demonstrations are stronger than the framing.
The work should lean harder on what runs and lighter on what it
generalizes to.

**Phase A/B** -- as above. The most concrete demonstration the
project has. 2,602 sets, three substrates, byte-identical. Whatever
the preface argues, *this* is what the work has produced.

**Algorithm 16 status flip** -- [canon/algorithm/00-INDEX.md:39](canon/algorithm/00-INDEX.md)
PROPOSED -> IMPLEMENTED, with the empirical record cited. The
catalog entry now reflects what the work has actually demonstrated.

**Citation audit** -- [canon/algorithm/00-INDEX.md](canon/algorithm/00-INDEX.md),
[meta/MANIFEST.md](meta/MANIFEST.md), [canon/algorithm/09-vsf-header-triads.md](canon/algorithm/09-vsf-header-triads.md),
[canon/DEFINITION.md](canon/DEFINITION.md) §3.8,
[meta/IMPLEMENTATION_PATH.md](meta/IMPLEMENTATION_PATH.md)
Five live citations updated to reflect the new status of algorithm 16
and the Phase A/B record. Every live SE-N citation was audited and
left unchanged (each was found to be consistent with the rewritten
algorithm; over- and under-stepping checks passed).

**Status against objection 4.** Addressed in canon. The catalogue
entries that previously framed algorithm 16 as a proposal now frame
it as an implemented result with shape-exhaustive verification. The
engineering core is now load-bearing in canon. **The thesis wrapping
in PREFACE.md is unchanged.** That is by design: the preface is the
author's statement of what the work means; the catalogue records
what the work demonstrates. The objection is addressed in canon; the
preface continues to make claims the catalogue does not support.

---

## 2. Where each objection stands

| # | Objection | Status | What would close it |
|---|---|---|---|
| 1 | Threshold metaphor | **Addressed in the web-platform case, sharpened structurally by [ARCHITECTURE.md](ARCHITECTURE.md) §7.** The threshold-crossing is now precisely "becoming kernel-shape": developing internal discipline sufficient to host a discretion router over typed nodes with adapter mediation to hardware. The web platform crossed because the cascade is kernel-equivalent. The boundary map (NOT-1, NOT-2, 4a, 4b) confirms where the kernel-shape holds. | Demonstrate the same kernel-shape recognition in a non-web language with a working artifact, OR scope the preface to the web platform only. |
| 2 | Hardware implication | **Structurally answered by the architecture; empirically open at the demonstration level.** A kernel-and-adapter architecture is *by definition* the layer that makes hardware diversity invisible. Substrate-portability is the architecture's defining property, not a hoped-for property. The empirical floor still requires demonstrating relocation across non-browser hosts. See [ARCHITECTURE.md proof gaps §6.3 and §6.4](ARCHITECTURE.md). | Build the kernel as a host-portable discrete artifact (Priority 3 in [PROJECT-PLAN.md](PROJECT-PLAN.md)), then demonstrate substrate relocation across a non-browser host (Priority 4). |
| 3 | Closed-abstraction posture | **Tension named.** §3.8 now cites empirical validation; §0.5 still disclaims it. The architecture recognition does not resolve this; it is still a content decision for the author of DEFINITION.md. | Reconcile §0.5 and §3.8 in DEFINITION.md, OR rewrite the catalogue to clarify which posture is operative for which claim. |
| 4 | Engineering core vs thesis | **Addressed in canon.** Algorithm 16 IMPLEMENTED with the empirical record. [ARCHITECTURE.md](ARCHITECTURE.md) names what the engineering core demonstrates. The preface remains the author's framing. | Either rewrite the preface to lean on demonstrations and on the kernel-shape framing, OR accept that the catalogue, the architecture, and the preface make complementary claims that coexist. |

---

## 3. Reading order for someone arriving fresh

1. [PREFACE.md](PREFACE.md) -- the claim being investigated.
2. This document, sections 0 and 1 -- the objections and what was done about each.
3. [canon/algorithm/16-gpu-postfix-stack-machine.md](canon/algorithm/16-gpu-postfix-stack-machine.md) -- the canonical algorithm that carries the structural argument and the empirical record.
4. The test files referenced above, in order: Phase A, Phase B, NOT-1, NOT-2, 4a, 4b stratified/mutual/aggregate. Each is self-contained and reports its own coverage.
5. This document, sections 2 and 3 -- where each objection stands and what remains open.

---

## 4. Live status

| Date (yyyy-mm-dd) | Action |
|---|---|
| 2026-05-15 | Catalogue created. Objections 1, 3, 4 partially or fully addressed; objection 2 unaddressed. |
| 2026-05-15 | [ARCHITECTURE.md](ARCHITECTURE.md) created at project root. Architecture recognition reframes objection 1 (threshold-crossing = becoming-kernel-shape, structurally precise) and objection 2 (substrate-portability is the architecture's defining property; empirical demonstration remains open). Objections 3 and 4 unchanged. |

Updates will be appended here as new tests are added, new boundaries
are located, or canonical changes are made. The catalogue tracks the
evolving relationship between the work and the preface's claims.

---

## 5. What this document does not do

- Does not argue for or against the preface. It catalogues evidence
  and arguments and notes where each stands.
- Does not rewrite the preface. The preface is the author's
  statement; the catalogue records what the work demonstrates.
- Does not foreclose any of the four objections being addressed
  further. Each "Status" entry says what would close the objection;
  none claims any objection is finally settled.
- Does not replace canon. Canon is the authoritative record of what
  the architecture *is*. This catalogue is a research index against
  one specific claim about what the architecture *means*.
