# Observation: Substrate Stratification Within a Single Runtime Cycle

**Status.** Observation captured 2026-05-15. Not yet promoted to a
structural commitment. The decision between "this is a consequence
worth recording" and "this is a requirement the architecture should
adopt" is deferred.

**Provenance.** Realized in conversation while writing
[canon/UTF/](.) foundations: *"so long as the oracles hold true to
their perspective domains, we are stratifying execution across js,
css, and gpu, which all happen within the same runtime cycle that
one single chain of events would be happening through."*

-----

## What was observed

The three oracles (CSS, JS, WGSL) are not *alternative* implementations
of resolution. Read against the byte-identical equivalence
demonstrated by Phase A/B, they are **three concurrent execution
paths within a single runtime cycle**:

- **CSS oracle** — browser cascade engine. Compute lives in the
  rendering pipeline, in style-recalc passes, in native C++/Rust.
- **JS oracle** — V8 main thread. Compute lives in the interpreter
  loop, sequential bytecode walk.
- **WGSL shader** — WebGPU dispatch. Compute lives on the GPU,
  2,880 invocations across compute units, massively parallel.

Phase A/B established that all three produce byte-identical output.
The framing the project had used: *substrate-independence — pick any
one, you get the same answer*. The framing this observation adds:
**substrate stratification — run all three concurrently in the same
runtime cycle and they each contribute to the same answer in
different ways**, on three different physical compute resources.

-----

## The two readings

The observation has two readings that are structurally different.
**This document does not pick between them.** It names both so the
choice can be made later, deliberately.

### Reading A: consequence (observation only)

The byte-identical property means the architecture *can* run all
three substrates concurrently, with cross-substrate divergence
serving as a real-time correctness check. This is a consequence of
what algorithm 16 already establishes; no new commitment is required.

Under Reading A, the catalogue records this as a property the
architecture enables, the same way it records substrate-portability
or self-verification.

### Reading B: requirement (architectural commitment)

The substrate *should* run all available adapters concurrently per
resolution cycle, with cross-substrate verification as the coherence
check. Each adapter is not an interchangeable resolver; each is a
concurrent compute path contributing to the same resolution. The
kernel's job extends from typed dispatch to **coherence checking
across substrate paths**.

Under Reading B, several things change:

- **UTF** must make stratification first-class. Every node carries
  which substrate path produced it (provenance attribute), or the
  cascade carries a coherence signal across all paths.
- **Adapter protocol** must specify concurrent-cycle semantics:
  when all adapters resolve, when the kernel checks coherence, how
  divergence is reported.
- **Algorithm 22 (delta-trace)** becomes the coordination signal
  across concurrent substrate paths in addition to its temporal role.
- **The kernel-as-discrete-artifact** (PROJECT-PLAN.md Priority 3)
  needs a coherence-checker as part of its core.
- **SE-06's substrate duality** is the N=2 case of a more general
  stratification model.

-----

## Why this is worth naming either way

Even under Reading A, the observation reframes what the existing
demonstrations actually establish:

- **The 22/22 GPU bridge tests weren't just a three-way correctness
  check.** They were the first empirical evidence that three
  structurally different compute substrates can be run concurrently
  on the same logical resolution, with byte-identical convergence.
  The framing was weaker than the result.
- **The high-density compute property is real and present.** Three
  parallelism profiles (per-coord, per-substrate, per-rule) compose
  in the same runtime window. The machine isn't running CSS *or* JS
  *or* GPU; it's running all of them, and the cascade is what makes
  the convergence coherent.
- **This is what an OS does for hardware.** Multiplexes the same
  workload across whatever compute is available. The substrate does
  it natively for cascade resolution. The kernel-and-adapter naming
  in [ARCHITECTURE.md](../../../ARCHITECTURE.md) is reinforced by
  this: a kernel mediates between uniform internal structure and
  varied external compute; stratification is what that mediation
  *does* when all the adapters are present at once.

-----

## What to decide later

When the work resumes, the deliberate question is: **does the
architecture commit to stratification as a structural requirement,
or record it as a consequence?**

Inputs that should inform the decision:

- Whether the operational characteristics of running three
  concurrent substrates per cycle are desirable for the runtime
  profile we want (latency, throughput, energy, fault detection).
- Whether the additional kernel complexity (coherence checking) is
  worth what it buys.
- Whether substrate divergence (which Phase A/B + the boundary tests
  showed cannot occur within the closure boundary) is a real fault
  mode worth defending against in production, or a theoretical
  fault mode the byte-identical guarantee already rules out.
- How this interacts with the four open proof gaps in
  ARCHITECTURE.md §6, especially the adapter protocol (§6.2) and
  the kernel-as-discrete-artifact (§6.3).

This document exists so the question is not lost. The observation is
recorded; the decision is deferred.

-----

## Live status

| Date (yyyy-mm-dd) | Action |
|---|---|
| 2026-05-15 | Observation captured. Two readings (consequence vs requirement) named. Decision deferred. |

Updates appended when the decision is made or when subsequent canon
work makes one reading clearly correct.
