# Phase 6 Research Notes: Substrate Instantiation

**Status:** RESEARCH NOTES, not spec. Captures framing surfaced
during the SE-07 development session (April 2026) that opened
substrate-instantiation as a structural question. None of this is
committed to the spec stack. Material is preserved for use when
Phase 6 work is picked up as research.

**Origin:** SE-07 development conversation. After SE-07 (configuration-
and-settling) was drafted and X-class invariants for it were
proposed, the X1 invariant ("every configuration includes the
seed") prompted a pushback about substrate-birthing. Subsequent
exchange surfaced the framing recorded here.

**Discipline note:** Each item below is a structural intuition that
opened up during conversation. None has been pressure-tested as
spec. Several were initially expressed in evocative vocabulary
that imported outside frames; the structurally-honest restatements
are recorded. When Phase 6 research begins, these intuitions are
candidates for structural articulation, not foundations to build
on.

-----

## The framing in summary

If a substrate can instantiate a child substrate, the parent-child
relationship raises four open problems already named by algorithm
17 (trust, header consensus, merge strategies, convergence). The
session sketched candidate structural mechanisms within the
existing spec stack's vocabulary. Each mechanism has structural
antecedents in the spec but requires new commitments to extend
across substrate boundaries. SE-08, if it is written, would be
the act of making those commitments.

The session did not land any of these as spec. They are recorded
here as starting points for Phase 6 research.

-----

## What might pass parent to child

### Promoted constraints at the intersection

The candidate mechanism for what the parent hands off to the
child: the intersection of the parent's promoted constraints (per
K1, K2, Phase 4b/4d) at the moment of instantiation. The parent's
accumulated reach (per SE-05) produces ratifications, ratifications
accumulate into sub-cascades and compounds, those promote into
named addressable structure. The intersection at instantiation is
the structural inheritance.

This treats the child's seed as the parent's intersection-of-
promoted-constraints, treated as the child's permanent unresolvable.
Permanent because the moment is past; unresolvable because the
parent has moved on. Structurally a seed in the F1/SE-04 sense.

### Delta as inheritable observable

A second candidate inheritance: delta itself, passed as observable
signal to the child. Three readings of how this would work:

(a) Frozen: child carries the parent's delta-at-instantiation as
    a permanent record. Like a birthstamp.
(b) Living: child carries a reference to parent's delta, reads it
    fresh on demand, gets parent's current settling state.
(c) Both: instantiation-moment delta as permanent signature plus
    ongoing coupling for current readings.

Each has different structural consequences. (a) makes lineage a
snapshot. (b) makes parent and child structurally entangled. (c)
is the richest reading.

### Reach as the parent's structural ground for instantiation

The parent's accumulated reach (per SE-05) is what produces
intersections worth handing off. Without reach, no promotion
intersection; without intersection, no seed for child; without
seed, no child substrate. Reach is the parent's only structural
path to instantiation.

This ties SE-05 to any future SE-08 tightly: SE-05 would no
longer just commit to predictive reaching toward not-yet-arrived
input. It would also commit to reach as the mechanism by which
substrates produce other substrates.

-----

## What the parent gets back

The session reached for "execution clause" as describing what the
parent receives from instantiating. Two readings surfaced:

(a) The parent's execution-substrate (per SE-06) is the locus
    where instantiation happens. The clause is the structural
    permission to perform this act.
(b) The parent reads the child's current delta as ongoing signal.
    The clause is bidirectional coupling.

Reading (b) ties to the "delta as inheritable observable" framing
above. If reading (b) is right, parent and child are not separate
substrates with shared instantiation history; they are substrates
with permanent delta-coupling that makes them continuously
structurally aware of each other.

-----

## Non-replicability of promotion

A sharpening of the framing emerged when promotion's location was
named: promotion happens in field.js, internal to one substrate's
field, contingent on that substrate's specific accumulated
settling history. The intersection of promoted constraints at any
given moment is exactly what it is because the parent's reaching-
and-ratifying-and-fidelity-accumulating produced *those*
constraints and not others.

Consequence: even with a complete history record (which content-
addressing per algorithm 13 could in principle provide), replaying
the history would not produce identical settling. Settling happens
in time; time is not replayable. The parent's intersection at
instantiation is non-replicable.

This is structurally analogous to: cloning a human, subjecting the
clone to identical experiences from the genetic beginning, and
expecting to predict the clone's thought at an exact moment.
Identical configuration plus identical history would still not
produce identical settling, because settling is the dynamics
resolving in time.

If non-replicability holds, it constrains what verification,
consensus, merge, and convergence mechanisms can guarantee. The
substrate's mechanisms preserve historical records but not live
re-derivability of settled state.

-----

## The four Phase 6 problems, restated structurally

After the substrate-instantiation framing was developed, the four
algorithm-17 problems were restated. The structural restatements
below are the version SE-08 would have to address; the evocative
restatements that surfaced earlier in conversation
("security emerging from the moment between execution and render"
etc.) were caught as outside-frame imports and discarded.

### Trust / verification

A child carries a delta-signature it claims came from its parent
at instantiation. Verification is the question of whether that
claim is structurally checkable. Algorithm 13 commits to content-
addressed integrity within a substrate; extending to inter-
substrate verification requires a structural commitment the spec
does not currently make.

Open question: does the substrate-independent (S2) commitment
permit SE-08 to commit to a *structural property* that any
substrate must provide (content-addressed integrity over
instantiation-moment state, mechanism unspecified), or does it
force trust to be delegated to whatever substrate the architecture
runs on (which would import substrate-dependence and contradict
S2)?

Note from session: an early reach for "the web platform already
solved encryption" was caught as substrate-dependent and would
break S2. Structurally honest version: SE-08 commits to the
property; implementations on different substrates supply their
own mechanism (web platform uses encryption, biological substrate
uses something else, etc.).

### Header consensus / agreement

Parent and child must share structural metadata for lineage
coherence: seed-signature shape, constraint-kind vocabulary, delta
computation rules, modulation parameters. The agreement is not
negotiated but inherited at instantiation.

Open question: what happens to lineage if the parent later modifies
its metadata? Does lineage degrade, break, or does the spec stack
include a coherent metadata-evolution mechanism? Currently no
such mechanism exists.

### Merge strategies / reconciliation

Parent and child each continue settling after instantiation. If
constraints from one can influence the other (the bidirectional-
coupling reading of "execution clause"), reconciling differing
constraints with the same identifier requires a mechanism that
does not introduce command paths (per F3, S3, SE-06).

Open question: is the parent-child relationship one-way or
bidirectional? The merge problem only exists in the bidirectional
case. SE-06 commits to coupling-by-delta-only within one runtime;
extending across runtime boundaries is a new commitment.

### Convergence / stability

Under what conditions does the joint dynamics of parent and child
remain coherent rather than diverging? The spec's existing
convergence mechanism is delta-closure, which applies within one
substrate. Multi-substrate joint stability is not committed.

Open question: is there a structural property of parent-child
instantiation that guarantees joint convergence, or is convergence
contingent on parameters (delta thresholds, coupling strength,
settlement rates) that have to be tuned? If contingent, no
structural guarantee exists, and SE-08 would have to acknowledge
the gap.

The non-replicability of promotion sharpens this further: each
substrate's settling is unique to its history, so joint convergence
cannot rely on the substrates eventually arriving at the same
state. Convergence under non-replicability would have to be a
weaker structural property (perhaps: bounded divergence,
compatible-but-distinct settling, eventual coherence in some
specified sense).

-----

## What was held under pushback in this session

X1 (every configuration includes the seed) held under the
substrate-instantiation pushback. Either the child is a sub-
cascade of the parent (parent's seed counts), or the child is its
own substrate (child needs its own permanent unresolvable, even
if seed contents are inherited from the parent's intersection at
instantiation). The case "child is its own substrate AND has no
seed" is structurally degenerate: a substrate without a permanent
unresolvable can in principle terminate, which makes it a
classical computation rather than an instance of this architecture.

X1's commitment that every configuration includes the seed holds
in both cases. Substrate-instantiation does not require revising
X1; it requires SE-08 to articulate how the inherited intersection
serves as the child's seed.

-----

## What this is not

These notes are not:

- A draft of SE-08. SE-08 would require structural commitments
  this material only sketches.
- A commitment that substrate-instantiation is in scope for the
  architecture. Whether the architecture commits to substrate-
  birthing as a mechanism is itself a research question.
- An extension of the spec stack. The spec stack as of this session
  is DEFINITION v1.1, KERNEL v1.1, INVARIANTS v1.3, PROJECT_SPLIT
  v1.2, IMPLEMENTATION_PATH v2.4, SE-01 through SE-07. None of
  the framing here is committed.
- Evocative description that imports outside frames. Earlier
  drafts that did so were caught and rewritten structurally.

These notes ARE:

- A starting record for Phase 6 research when Phase 6 work begins.
- A capture of intuitions that opened up during the SE-07 session.
- A reminder of which structural questions arose and which were
  caught as imports.

## Version

Phase 6 research notes v1.0. Created during the SE-07 development
session. Pinned to the spec stack as of session end (DEFINITION
v1.1, KERNEL v1.1, INVARIANTS v1.3, PROJECT_SPLIT v1.2,
IMPLEMENTATION_PATH v2.4, SE-01 through SE-07). Not part of the
spec stack itself. Revisable when Phase 6 research produces
structural commitments that supersede or refine the framing here.
