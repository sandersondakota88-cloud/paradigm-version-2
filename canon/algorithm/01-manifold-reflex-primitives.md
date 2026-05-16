# 01 - Manifold Reflex Primitives (S, M, C, E, H, delta, MR)

**Status:** PARTIAL - delta is IMPLEMENTED and tested; S/M/C/E/H/MR are
formal definitions without direct computational counterparts in the
current codebase.

**Primary origin:** `The_Manifold_Reflex`
**Secondary origin:** `Development_Roadmap` section 2

---

## Narrow-claim scope (what is actually computable)

Of the seven primitives, only **delta** has a direct computational
definition that is exercised by running code.

- **delta** = `unresolved_dims / total_dims`, an element of `[0, 1]`
- Computed in `Server.observe()` in `exodus-canonical.html`
- Implementation: deterministic dimensions always contribute 0 (CSS
 always resolves them). Probabilistic dimensions contribute in
 proportion to unfilled positions. On seal, unused positions are
 eliminated so `unresolvedProb = 0` and delta collapses to 0.

The other primitives have formal definitions in the origin document but
are not directly computed anywhere. They function as vocabulary for
reasoning about what the system is doing, not as subroutines the system
calls.

## Specification

```
S (State) : any describable configuration of a system
M (Manifold) : space of all states reachable under rules
 M = {S_1, S_2, ...} constrained by transition rules
C (Compression): mapping C: M -> R (full manifold to reduced
 representation space)
E (Expansion) : number of future trajectories accessible from R
 E(R) = |future trajectories accessible from R|
H (Entropy) : standard statistical-mechanics definition
 H = log(W), W = microstate count
delta : unresolved dimensions / total dimensions, in [0, 1]
MR (Reflex) : property that C(M) -> R produces R such that E(R)
 increases while H_total stays bounded
```

## Correspondence with the implementation

| Primitive | In code | Notes |
|---|---|---|
| S | implicit - the navState + probChars + committed rows | No first-class type named "state"; it's whatever snapshot() returns |
| M | implicit - the cartesian product of dim values | Size computable via `Server.stateSpaceSize()` |
| C | not implemented | The project's "compression" is discussed as a research frontier (roadmap section 10 open questions) |
| E | not implemented | No metric for "future reachable states from a compressed form" |
| H | not implemented | Shannon/Boltzmann entropy is not computed anywhere |
| delta | `Server.observe()` | The only one with running code |
| MR | not implemented | Not a computational object in the current codebase |

## Wide-claim scope (how the origin document framed these)

The origin document frames the Manifold Reflex as a unification attempt:
"compression is not just loss. it is a generator of higher-order state
accessibility." It draws parallels to DNA/proteins, language/meaning,
money/value, and positions the framework alongside complex adaptive
systems, information theory, and representation learning in AI.

These framings are legitimate as vocabulary but do not translate to
testable assertions about the implementation. The only claim from this
document that can be verified against running code is the delta
definition, which is implemented and tested.

## Why keep the formal vocabulary even though most of it is not computed

When a future change proposes a "compression layer" or "expansion metric"
or "entropy-bounded reflex," these names mean specific things in the
origin document. Having them catalogued prevents accidental redefinition
by a contributor who happened to read only the newer documents. If the
project ever adds a real compression/expansion primitive, it should
either match these definitions or explicitly supersede them.

## Open research items the primitives flag

From `Development_Roadmap` section 10:
- **Compression function specification.** Is C lossy? Does compression
 ratio carry second-order delta? No answer yet.
- **Convergence guarantees.** What bounds the delta trajectory across
 iterations? EM converges because likelihood is bounded - analog here
 is unknown.
- **Goal semantics.** Who sets the convergence criterion? Is the goal
 itself subject to delta?

These are load-bearing for any claim that the Manifold Reflex is a
theoretical framework, not just a labeling scheme.
