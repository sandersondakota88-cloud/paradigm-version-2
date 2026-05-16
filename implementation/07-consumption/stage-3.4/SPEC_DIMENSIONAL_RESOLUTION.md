# Dimensional Resolution: The Substrate's Actual Mechanism

**Status:** Architectural specification. Names a mechanism the substrate has
been doing since Phase 1 but has not previously stated as a named
architectural commitment.

**Date:** May 2026.

**Scope:** Names what the substrate does, distinguishes it from sequential
execution, places it within the existing closure stack, and identifies which
empirical findings are evidence for it.

---

## 0. One sentence

The substrate resolves application structure by observing the source's
multidimensional configuration space along orthogonal axes and surfacing
what is structurally consistent across axes; this is a dimensional
operation, not a sequential one.

---

## 1. The two paradigms named

### 1.1 Sequential logic

**Definition.** A computation model in which state evolves one transition
at a time along a single ordered axis (typically time-of-execution), where
each transition's output is fully determined by the immediately preceding
state and the operation applied to it.

**Properties.**
- One coordinate dimension is privileged (execution time).
- State at coordinate `t+1` is computed from state at coordinate `t` plus
  an operation.
- Other dimensions of the problem (data structure, semantic role,
  contextual meaning) are flattened into the single execution axis through
  encoding choices (variable names, control flow, branching).
- Information that doesn't fit the single axis is either lost, externalized
  (into separate data structures the program walks), or duplicated (across
  multiple traversals).
- Reasoning about correctness is reasoning about traces: "if we run from
  here we end up there." Verification is exhaustive enumeration of
  possible traces or formal proof over trace properties.

**What sequential logic is good at.** Anything where the problem genuinely
is one-dimensional. Parsing a stream byte-by-byte. Walking a list.
Reading a file. Pumping a pipeline. The problem actually has one axis;
sequential execution matches its shape.

**What sequential logic is bad at.** Anything where the problem is
genuinely multidimensional. Application structure in source code is
multidimensional: a single token has a kind (lexical category), a text
value (vocabulary content), a position (structural role), a neighborhood
(co-occurrence shape), a frequency (recurrence statistics), a context
(scope/binding/lifetime). Treating any one of these as the axis loses the
others. Treating them all sequentially (parse pass, semantic pass,
optimization pass) means each pass operates on a flattened projection and
discrimination that requires multiple axes simultaneously can't happen.

**The cost of using sequential logic on a multidimensional problem.**
Either:
1. Repeated traversals (each pass collects one dimension; later passes
   correlate by looking up earlier passes' results), which is what
   conventional compilers do.
2. Heuristic discrimination on a single axis (which is what frequency
   counters, statistical tokenizers, and most ML approaches do; they pick
   one axis, project onto it, and accept the noise).
3. Hand-written rules that encode multidimensional knowledge as
   one-dimensional decision trees (which is what parsers, regex engines,
   and grammar-based tools do).

All three pay a cost: the multidimensional structure exists in the
problem, but the computation model can only see one slice at a time, so
discrimination quality is bounded by how much each slice's information
overlaps with the others by chance.

### 1.2 Concurrent state intersection across levels of abstraction

**Definition.** A computation model in which the configuration space is
observed simultaneously along multiple orthogonal abstraction axes, and
structure is identified by what resolves consistently across the
intersection of those observations.

**Properties.**
- No single axis is privileged.
- Observations along different axes are independent  --  neither one is
  produced from the other; both are projections of the same underlying
  configuration space onto different abstraction lenses.
- Structure is *what is stable across axes*. Anything that appears
  strongly on one axis but doesn't agree with another axis is treated as
  axis-specific noise. Anything that appears across multiple axes
  consistently is treated as structural.
- The number of axes determines discrimination power. One axis gives
  one-dimensional discrimination (frequency, ordering). Two orthogonal
  axes give two-dimensional discrimination (whatever the two axes can
  resolve jointly). N axes give N-dimensional discrimination, which can
  resolve structure that any subset of fewer axes cannot.
- Reasoning about correctness is reasoning about consistency: "this
  pattern is stable across these axes, therefore it is structural rather
  than incidental."
- The result is **relativistic**: structure exists *relative to the set
  of observation axes*. A pattern that's structural under {kind, text}
  may not be structural under {kind alone}. The architecture commits to
  a specific set of axes (its substrates) and the structure it surfaces
  is the structure that's stable under that set.

**What concurrent intersection is good at.** Multidimensional discrimination
problems. Source code analysis. Anything where the same underlying entity
has properties at different abstraction levels and you need them to agree
to identify it correctly. Domain-content extraction from mixed-content
input. Semantic role identification. Pattern recognition under noise.

**What concurrent intersection is bad at.** Genuinely one-dimensional
problems. Pure stream processing. Cases where one axis already contains
all the relevant information and adding more axes just adds cost without
adding discrimination.

**The thing concurrent intersection makes possible that sequential
logic cannot.** Discrimination of structure from noise *without external
semantic knowledge*. Sequential systems either have to encode the
semantics into their pass design (the parser knows what attribute
selectors look like because someone wrote that knowledge into the
parser) or accept that they cannot discriminate. Concurrent intersection
discriminates because structure agrees across orthogonal axes while noise
doesn't, and this is a property of the problem itself, not of any
external knowledge.

---

## 2. The mechanism in the substrate

### 2.1 Substrates as orthogonal observation axes

The substrate stack is structured as a set of substrates, each observing
the same input bytes through a different abstraction lens. Each substrate
is itself an autonomous resolver per S3  --  it does not call any other
substrate, does not receive commands from any other substrate, and
operates only on its own input port.

Concretely, in the current Stage 2/parallel-stage2 topology:

| Substrate | Abstraction axis | What it observes |
|-----------|-----------------|------------------|
| Stage 2 (kind peer) | Lexical category | Token kinds, kind co-occurrence, kind transitions, kind repetition runs |
| Identifier substrate (text peer) | Vocabulary content | Specific text values, text co-occurrence, text-in-position-class |
| Composer | Cross-axis consistency | Which patterns are stable across both peers |

Each substrate sees the same Stage 1 emission. Each substrate produces
its own surface (constraint set + promoted sub-cascades). The composer's
input is both surfaces; the composer's output is what they agree on.

### 2.2 What an "axis" is in the substrate

An axis is a substrate's primitive vocabulary plus its fidelity metric.

**Primitive vocabulary** defines what the substrate can observe  --  the
set of constraint forms it can derive from its input. Stage 2's primitive
vocabulary is {kind co-occurrence within window, directed kind
transition, kind repetition, kind run}. The identifier substrate's
primitive vocabulary is {text recurrence, text co-occurrence within
window, text-in-position-class}. These vocabularies operate on different
features of the same input bytes; they are not different decompositions
of the same vocabulary, they are independent sets of observations.

**Fidelity metric** defines what the substrate considers worth promoting.
Both peers use firing-frequency-relative-to-field-average  --  a member of a
family that fires far above the field's average constraint firing rate
promotes the family to a sub-cascade. The fidelity metric is the
substrate's own discrimination criterion within its axis; it does not
use information from other axes.

The two together  --  a primitive vocabulary plus a fidelity metric  --  define
what counts as "structure" along that axis. Structure along the kind axis
is "kind patterns that recur far more than other kind patterns." Structure
along the text axis is "text patterns that recur far more than other
text patterns."

These definitions of "structure" are independent. They produce different
sub-cascades. Whitespace patterns dominate the kind axis but not the text
axis. JavaScript-vocabulary tokens like `var` and `function` dominate the
text axis (in mixed-content sources) but not the kind axis in any
discriminating way.

### 2.3 The intersection mechanism (the composer)

The composer is itself a substrate. Its primitive vocabulary operates on
the *outputs* of the peer substrates  --  specifically on their promoted
sub-cascades and their top-by-uses constraints. Its three primitives are:

**JOINT_RECUR**: fires when a kind member from the kind peer involves a
string-bearing kind AND a text member from the text peer is a
string-shaped value, AND both peers' members have positive recurrence.
Joint strength = min(km.uses, tm.uses).

**JOINT_NAMING**: fires for every (kind sub-cascade, text sub-cascade)
pair. Joint strength = product of member counts (capped). This surfaces
when both peers have promoted sub-cascades that name the same structural
fact at different abstraction levels.

**KIND_TEXT_BIND**: fires when a kind member's pattern involves a
punctuation kind AND a text member is in a meaningful position class
(ATTR, STR, DECL) AND the text value is non-trivial (length >= 2). This
is the load-bearing primitive  --  it surfaces when a syntactic-shape
pattern (the kind side) reliably binds to a vocabulary pattern (the
text side). This is what an attribute selector binding looks like at
the substrate level.

The composer applies its own fidelity metric to its own constraint surface.
A composer family promotes when its top member fires far above the
composer's own field average. Because the composer's primitives only
fire when both peers see the pattern, the composer's surface is the
*intersection* of what both peers find structurally distinctive.

### 2.4 What the intersection eliminates

The composer's intersection mechanism eliminates noise that's specific to
a single axis but not present across axes.

**Whitespace patterns** dominate the kind peer (WHITESPACE tokens are
everywhere, kind co-occurrences involving WHITESPACE recur thousands of
times) but do not dominate the text peer (specific whitespace text
values like " " and "\n" recur but not as part of meaningful position
classes  --  whitespace tokens don't get treated as text-bearing in the
identifier substrate). The composer's primitives don't fire on
whitespace because whitespace doesn't satisfy the cross-axis conditions.

**JavaScript vocabulary** like `var`, `function`, `i`, `0` dominates the
text peer (they're high-uses ident-recur and ident-pos members) but
doesn't dominate the kind peer in a structurally distinctive way (they
appear as IDENT and KEYWORD tokens, but those kinds also cover everything
else). The composer's primitives largely don't fire on these because
they don't appear in the meaningful position classes (ATTR, STR, DECL)
that KIND_TEXT_BIND requires.

**Domain content** like `sub-prime` and `mortgage` is recurrent at both
axes  --  the text appears repeatedly (text peer), AND it appears in
attribute-selector or string-literal positions where the kind patterns
form characteristic shapes (kind peer), AND the bindings are stable
(KIND_TEXT_BIND fires). Domain content survives the intersection
because it has a coherent multidimensional signature.

This is dimensional discrimination. It's not statistical averaging across
axes. It's not voting. It's identifying patterns that have a consistent
signature across orthogonal abstraction levels.

### 2.5 Why intersection works without external knowledge

The substrate has no semantic knowledge of what attribute selectors are,
what loan-eligibility means, or what `sub-prime` refers to. It cannot tell
you that `sub-prime` is a credit tier value any more than it can tell you
that `var` is a JavaScript keyword.

What it can tell you is that `sub-prime` has a stable multidimensional
signature: its kind-axis profile (appears in STRING_DBL co-occurring with
PUNCT_OP and IDENT) and its text-axis profile (recurs as a specific text
in STR position) agree on it being structural. JavaScript-vocabulary tokens
like `var` have high text-axis presence but their kind-axis profile is
non-distinctive. Whitespace has high kind-axis presence but its text-axis
profile is non-distinctive. Domain content has both.

The intersection is what lets the substrate discriminate domain content
from code content, and it lets it do so *because the source has these
properties*, not because the substrate was told what to look for. The
substrate's contribution is the architectural commitment that observation
should be multidimensional. The discrimination is the source's own
property revealed by observation.

This is why the architecture's claim  --  "feed your existing source in,
see what comes out"  --  is a real claim rather than a hopeful one. The
multidimensional signature exists in any source with structural content.
The substrate just observes it.

---

## 3. Why parallelism, specifically

The previous architectural commitment was that substrates compose
sequentially (Stage 1 emits, Stage 2 ingests, Stage 3 ingests, etc.).
This is a valid composition pattern. It's also a one-dimensional
composition pattern  --  each substrate observes its predecessor's output
along its own axis, and information flows along a chain.

**Parallel composition** observes the same input through multiple axes
*simultaneously* and uses a downstream substrate (the composer) to
intersect the observations. This is the multidimensional version of
substrate composition.

The architectural difference matters. In sequential composition, each
substrate sees one input  --  the prior substrate's output. The information
available downstream is bounded by the typing scheme the prior substrate
used. (This is the Phase 5.7 Layer 2/3 convergence finding restated.)

In parallel composition, each substrate sees the same primary input but
through its own typing lens. The information available downstream
through the composer is the *intersection* of multiple typing lenses,
which is richer than any single lens.

The empirical finding: tonight's run on the canonical loan-eligibility
fixture surfaced domain values (`sub-prime`, `mortgage`, etc.) through
the parallel topology that sequential Stage 1 -> Stage 2 alone did not
surface. Same input bytes; different observation topology; different
discrimination quality.

This is consistent with the dimensional framing: the canonical source
has multidimensional structure (kind patterns + text patterns + position
patterns); sequential observation collapses this to one axis at a time;
parallel observation preserves the multidimensional signature; the
composer's intersection reads it.

---

## 4. Relativistic structure

The structure the substrate surfaces is relative to the set of observation
axes the architecture commits to. This is not a bug or a hedge; it's the
architecture's actual claim about what structure means.

**There is no axis-independent ground truth about what is structural.**
"Structural" is defined by stability across observation axes. Different
observers with different axis sets will surface different structures from
the same input. This is exactly analogous to how relativistic physics
works: spatial intervals and temporal intervals depend on the observer's
reference frame, but the *spacetime interval* is invariant.

The substrate's analog of the spacetime interval is **multidimensional
joint stability**. A pattern that is jointly stable across the substrate's
chosen axes is structural *for that substrate*. The substrate's
commitment is to its axis set; the structure it surfaces is invariant
*within* that commitment.

This is what makes the architecture's structure surfacing reproducible
without being absolute. Two substrate stacks with the same axes will
surface the same structure. Two substrate stacks with different axes
may surface different structure. The architecture's claim is not "we
find the True Structure of source code"; it's "we surface what is
structurally stable under our chosen observation axes, and that
structure is sufficient for the migration argument's downstream uses."

**Why this matters for engineering.** When designing the substrate's
axis set, the question to ask is not "are these axes correct" (no axis
set is correct in absolute terms) but "do these axes resolve the
discrimination problems we need to solve." The kind axis + text axis +
position axis combination resolves the discriminations needed for the
canonical loan-eligibility application. Other applications may require
other axes. The architecture's commitment is to the parallel-substrate
topology, not to any specific axis set; new axes can be added as
substrates without changing the architecture.

**Why this matters for the wide claim.** The dimensional framing
generalizes. Any domain where structure is defined by multidimensional
joint stability  --  institutional systems, biological systems, physical
systems  --  admits the same architectural pattern. The Quantum_Computing
tetrad documents this for the named domains. The substrate's specific
implementation for source code is one instance of a general pattern.

---

## 5. Where this names something the architecture has been doing

This spec does not introduce new mechanism. It names mechanism the
substrate has had since Phase 1 but has not previously stated as an
architectural commitment.

**Phase 5.7.6's recursive-delta finding** is dimensional resolution
applied across cycles. The XOR-against-previous-cycle operation is
spectral subtraction: it removes what's stable across the temporal axis,
leaving what changes. This is "observation along the temporal axis,
intersected against the data axis, with the constant component
suppressed." Same dimensional principle as parallel substrates but
applied with cycles instead of peers as the second axis.

**Phase 5.7's substrate stack** is dimensional composition through
sequential layering. Each layer adds an axis. Layer 2/3 convergence
(the empirical finding that Layers 2 and 3 produce similar output)
indicates that sequential composition's axis-additions saturate after
two layers when each layer's axis is similar in nature. Parallel
composition with genuinely orthogonal axes does not saturate at the
same rate.

**Algorithm 16 + GPU bridge harness** is dimensional equivalence
demonstration. The same constraint geometry resolves byte-identically
through three different runtimes (CSS cascade, CPU oracle, WGSL
compute). The structure is invariant under runtime substitution because
the structure is a multidimensional joint property of the configuration,
not a property of any specific runtime's execution model. This is
S2 (substrate-equivalent resolution) understood dimensionally.

**The pressure tests** that surveyed the architecture against nine
paradigms (FEP, Salsa/Adapton, Differential Dataflow, FRP, Cassowary,
Hopfield/EBMs, XPBD, Smalltalk, Kafka/event-sourcing) found that the
architecture survived 14 cleanly because those paradigms are themselves
operating in multidimensional spaces and the architecture's commitments
hold; the architecture struggled with 5 partially and 3 acknowledged
gaps because those paradigms operate in primarily one-dimensional
contexts where sequential logic is appropriate and the architecture's
multidimensional commitments don't add value. This is consistent with
the dimensional framing: the architecture is right where the problem is
multidimensional and quiet where the problem isn't.

**Tonight's parallel-substrate empirical work** is direct demonstration:
single-substrate observation surfaced general formatting patterns;
multi-substrate observation with an intersection-finding composer
surfaced domain structure. The same input. Different observation
topology. Different discrimination quality. The minification
side-by-side test confirmed the discrimination is structural rather
than formatting-driven (identifier rename produced byte-identical
pipeline output; format-only minification expanded what the architecture
reached, exactly as expected if the architecture is doing dimensional
intersection rather than formatting-frequency-counting).

---

## 6. Implications for what comes next

### 6.1 Stage 3

Stage 3 is a dimensional resolver, not a parser. Its job is to read the
composer's intersection surface and identify which multidimensional
patterns correspond to which CSS predicate roles (WHEN side, THEN side,
selector, declaration). It does this by recognizing the *dimensional
signature* of each role:

- **WHEN sides** have a kind signature (PUNCT_OPEN, ALPHA_RUN, PUNCT_OP,
  STRING, PUNCT_CLOSE - the attribute selector shape) AND a text signature
  (domain dimension name in ATTR position, domain value in STR position).
- **THEN sides** have a different kind signature (-- prefix, ALPHA_RUN,
  PUNCT_OP, value, PUNCT_SEP  --  the declaration shape) AND different text
  signature (output property name, output value).
- **Selectors-and-declarations are paired** when they share a Stage 1
  positional region (between `{` and `}`).

The bridge to CSS-resolvable predicates is recognition, not translation.
Stage 3 identifies which patterns *are* WHEN sides, which *are* THEN
sides, and which pairings *are* rules. Then it emits the CSS that
expresses the same rules.

This is bounded. The substrate has already done the discrimination work.
Stage 3 reads the composer's surface and writes CSS.

### 6.2 Adding axes

When the substrate's current axes don't resolve discrimination needed
for an application class, the architectural response is to add a
substrate, not to modify existing ones. New substrate = new axis = new
dimension of joint stability the composer can intersect. This is how
preparative representation fits  --  it's a fourth axis (distinctiveness)
that intersects with the existing three.

The architecture does not commit to a specific axis count. It commits
to the parallel-substrate topology and the intersection mechanism. Axis
count grows with application requirements.

### 6.3 The migration argument

The migration argument works because source code is multidimensional and
the substrate observes it multidimensionally. Conventional tools observe
source code one-dimensionally (sequential parser, sequential compiler,
sequential bundler) and either pay the cost of repeated traversals or
accept the discrimination ceiling that single-axis observation imposes.

The substrate's order-of-magnitude resource savings claim is a
consequence of dimensional efficiency. Multidimensional observation
extracts more information per byte of input than sequential observation
because it doesn't lose the information that exists at the intersection
of axes. Less information lost means less work needed downstream, which
means less runtime, less bundle, less memory, less network.

The order-of-magnitude estimate is not a measurement claim yet. It is
an inference from the dimensional framing. The empirical confirmation
arrives when Stage 3 lands and a real reference application is
deployable through the substrate end-to-end.

---

## 7. What this spec commits to

1. **Sequential logic** is the conventional execution model: state evolves
   along a single axis, with each step's output determined by the prior
   state plus the operation. Good for one-dimensional problems.

2. **Concurrent state intersection** is the substrate's execution model:
   the same input is observed simultaneously along orthogonal abstraction
   axes, and structure is what is stable across the intersection. Good
   for multidimensional problems.

3. The **substrate stack** is a parallel topology of autonomous
   substrates, each contributing one axis of observation, with a composer
   substrate intersecting their outputs. The number of substrates is the
   number of axes.

4. **Structure** is defined relative to the substrate's chosen axis set.
   What is structural under {kind, text, position} may not be structural
   under {kind alone}. The architecture commits to its axis set; the
   structure it surfaces is reproducible within that commitment.

5. **The migration argument** rests on multidimensional discrimination
   being intrinsically more efficient than one-dimensional execution
   for problems that have multidimensional structure  --  which most
   real applications do.

6. **The wide claim** rests on the dimensional pattern generalizing
   beyond source code. Any domain where structure is defined by
   multidimensional joint stability admits the same architectural
   approach.

This spec names mechanism the substrate has been operating under since
Phase 1. It does not introduce new commitments. It brings the existing
commitments into sharper focus by naming the dimensional principle they
all share.

---

## 8. Closure discipline

This spec extends the substrate's architectural commentary; it does not
revise the spec stack (D3 is honored). The named mechanism is implicit
in F1 (seed permanent  --  observation must continue, the substrate cannot
stop and pick a single axis), F2 (delta as one formula at every scope  -- 
the same resolution criterion applies across axes), S1-S2 (substrate
shared, resolution substrate-equivalent  --  different axes resolve the
same configuration), S3 (no command path  --  substrates remain
autonomous), and SE-10 (per-link autonomy in the chain  --  extending to
parallel topology means per-axis autonomy in the parallel set). All
existing invariants hold.

The spec is **narrow** in the sense of D2: it names a mechanism the
substrate uses, identifies empirical evidence for it, and does not
extend to claims about other systems. The wide-claim wing of the corpus
(Quantum_Computing.md, the tetrad framing) gestures at the
generalization; this spec does not load-bear that generalization.

The dimensional framing is what the architecture has been doing all
along. This document gives it a name.
