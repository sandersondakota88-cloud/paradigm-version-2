# 20 - Four-Constraint Minimum Viable Processor

**Status:** THEORETICAL / DESIGN SKETCH. Not implemented. Combines
multiple existing research components (Wasm, SMT solvers, WebGPU,
ambient calculus, 1:1 NAT, cellular automata) into a proposed
architecture. No line of code exists for this as a coherent artifact.
**Primary origin:** `Quantum_Computing.md` Part 5 ("A minimal viable
delta-processor is buildable now")
**Secondary origin:** `Development_Roadmap` section 10 (Open Questions)
**Implemented in:** nothing

---

## Narrow-claim scope

A proposed composite architecture that would instantiate a
programmable "delta-processor" by wiring together eight existing
components. The proposal's narrow ambition is: take off-the-shelf
research artifacts (SAT solvers, Wasm, WebGPU, ambient calculus, NAT
traversal) and compose them in a way that presents a unified
constraint-collapse interface.

The proposal is research-level. It identifies the components, argues
they are individually mature, and sketches how they would fit
together. It does not provide a concrete protocol or implementation
plan.

## The eight components (from Quantum_Computing.md Part 5)

### 1. Substrate: Wasm + WASI

A Wasm module hosted by Wasmtime or WasmEdge. The Component Model's
WIT interface types support records, variants, and resource types -
the right shape for encoding constraint-header schemas. Verified
runtimes (UCSD's WaVe, CMU's vWasm/rWasm) provide provable isolation.

### 2. Header language: CSS cascade semantics

Each rule is a selector + a WHEN condition + a THEN collapse action.
Specificity, cascade layers, and scope determine which rule fires
when multiple match. This is already how the VSF canonical
implementation works at the CSS level (algorithm 04); the proposal
extends the pattern to the Wasm substrate.

### 3. Collapse engine: hybrid SMT + cellular automaton

- Z3 or CVC5 for discrete constraint propagation.
- A WebGPU compute shader implementing Rule-110-style local updates
 for continuous delta-field relaxation.
- FastFourierSAT-style differentiable local search for soft
 constraints.
- Salsa-style incremental recomputation for memoization.
- Differential dataflow for delta-propagation.

### 4. Observer layer: ambient calculus + 1:1 NAT

- Cardelli & Gordon ambient calculus for typed, nested, mobile
 boundaries.
- 1:1 NAT translation table mapping server-side ambient names to
 client-side selectors.
- ICE/STUN/TURN fallback for when direct observation is blocked.

### 5. CPU overlay: FPGA + HLS (optional)

ZUMA, TILT, SODA Synthesizer. Compile a rule set into hardware in
seconds. Overlay architectures ARE the hardware analog of "different
constraint headers = different virtual processors."

### 6. Declarative primitives: React/SwiftUI/Compose-style

`UI = f(state)` as the shared declarative-reactive paradigm. Salsa
and Adapton for incremental recomputation of unchanged subgraphs.

### 7. Universality: cellular automata

Rule 110 is Turing-complete. GPU CA implementations hit 1.35 trillion
cell updates/sec. "One thread per VSF cell, stencil operations
implementing constraint propagation."

### 8. Integrity: content addressing (VSF's own algorithm 13)

Content-addressed row hashing + Merkle-proof observer handshakes.

## The "four minimum constraints" claim

The proposal asserts that four constraint types are the structural
minimum for a viable processor, in correspondence with the tetrad
(algorithm 18):

1. **Send constraint** - transmission of state across the ambient
 boundary.
2. **Receive constraint** - measurement at the observer morphism.
3. **Potential constraint** - the combinatorial space being
 collapsed.
4. **Reference constraint** - the invariant against which collapse
 is measured.

This mirrors the biological/linguistic/institutional tetrad and is
claimed to be the structural reason four is the minimum. The
argument is: fewer than four lacks a reference and cannot collapse;
more is elaboration, not new primitives.

## The "first render is delta=1" property

The proposal asserts that making the client cascade THE measurement
surface causes rendering the document to invoke the NAT translation,
which populates the client's delta-field at delta=1 (all dimensions
present, no constraints yet fired). Subsequent renders are iterative
collapse steps until delta approaches 0 or a fixed-point.

This is consistent with how the VSF canonical implementation works
in a browser context: on boot, the probe has no attributes set, the
cascade has not fired for any specific coord, and delta reads high.
Each NAV_SET and PROB_INPUT reduces delta. This behavior IS implemented
in algorithm 12 (the IPC channel) and algorithm 02 (delta computation)
for the current architecture; the proposal generalizes it to the Wasm
substrate.

## Open questions the proposal flags

Three gaps (from `Development_Roadmap` section 10):

1. **Continuous delta in CSS-style syntax without losing decidability.**
 The proposal suggests restricting to a "SAT-modulo-linear-real-
 arithmetic fragment." Not a full answer.
2. **Certifying 1:1 NAT bijection under mutable state.** Answered by
 content-addressed hashing (algorithm 13). This is the one piece
 of the proposal that has working code.
3. **Composing processors when headers from different origins
 cascade.** CSS origin/!important inversion as template, plus
 ambient-calculus name-capture handling. Not specified.

## What this proposal provides

- **A motivating framework.** Why build the VSF architecture the way
 it's built? Because the pieces line up with Wasm, SMT, ambient
 calculus, etc.
- **A literature map.** Pointers to specific research (CDCL,
 FastFourierSAT, Salsa, differential dataflow, ambient calculus,
 Rule 110, NVIDIA PhysX) that inform the design.
- **A long-range target.** If the four-element tetrad + measurement
 surface + content-addressable state composition works out, the
 resulting system would be a programmable constraint-collapse
 processor whose virtual CPU is its rule set.

## What this proposal does NOT provide

- No protocol. No wire format for the ambient-calculus boundaries.
 No concrete mapping from 1:1 NAT tables to ambient names.
- No implementation plan. No milestone sequence leading from the
 current artifact to the proposed architecture.
- No correctness conditions. "Convergence" is listed as an open
 question, not answered.
- No evidence that the composition actually works. Each component is
 mature in isolation; the composition is unproven.

## Relationship to the current implementation

The canonical `exodus-canonical.html`:

- Implements algorithm 2 (delta), algorithm 3 (delta_IPC), algorithms
 4-7 (CSS cascade and probe mechanisms), algorithms 9-13 (VSF
 format and content addressing).
- Implements a single-machine version of algorithm 12 (IPC channel)
 and the threat model of algorithm 14.
- Does NOT implement algorithm 16 (GPU), algorithm 17 (DCN), or any
 part of this algorithm 20.

This proposal sits two layers above the current artifact: first the
GPU bridge (algorithm 16), then horizontal scaling (algorithm 17),
then the full minimum-viable-processor composition. Each layer
requires the layers below. Work happens bottom-up.

## Wide-claim scope

The origin document frames this as "every stable viable system is
already a delta-processor." The wider claim is:

> By making delta a first-class runtime parameter, treating the
> header as the instruction set, and treating the observer layer as
> a 1:1 NAT-style measurement morphism, we can expose this
> underlying machinery directly as a programmable processor.

This is aspirational. It's what the project is aiming at, not what
it has achieved. The narrow artifact (the canonical file) demonstrates
the core pattern at a single-machine single-cascade scale. The full
proposal is multi-year work composing multiple research threads.

For external communication, the project's discipline (per the
`Development_Roadmap` section 12) is to keep the narrow claims
(working implementation, migration tool, GPU scaling path)
separable from the wide claims (computation as geometry, observer
as channel, delta as universal primitive). This algorithm falls
entirely in the wide-claim column.

## Related algorithms in this catalog

- `03-delta-ipc-channel-fidelity.md` - the implemented sliver of
 the proposed observer layer
- `16-gpu-postfix-stack-machine.md` - the GPU component
- `17-distributed-collapse-network.md` - the network component
- `18-send-receive-potential-reference-tetrad.md` - the
 four-element motivation
- `19-observer-as-channel-triadic.md` - the |A->C<-B| framing
