# SE-05 - Vector-Valued Delta and Predictive Reaching

**Type:** Specification extension
**Status:** OBSERVATIONAL. Names two related structural properties the
formalism supports: delta read at multiple temporal scopes produces
a vector-valued measurement rather than a scalar, and the seed's
structural unresolvability at vector scope drives the field to
generate constraints that reach toward external input.
**Primary origin:** conversation April 2026, arising from the
question of what to reward beyond internal coherence. The answer
did not require adding an external oracle. It required recognizing
that delta, read at different temporal windows, produces
measurements that can diverge, and that closing the divergence
requires inputs the field has not yet received.
**Implemented in:** nothing yet. This document is the design commit
that a future v3.5 or v4 builds against.

---

## The simple version

Delta answers "how unresolved is the field." But "how unresolved"
depends on the window you look through.

Ask it about the last few steps and you get a reactive reading that
changes quickly.

Ask it about the whole history and you get a smoothed reading that
changes slowly.

Both readings are real. Both use the same formula. They just use
different windows. So "delta" turns out to be not one number but
at least two: fast-delta (recent window) and slow-delta (full
history).

The seed asks "what is delta?" Now it has to be answered in both
directions at once. If fast-delta and slow-delta agree, the field
is in a settled state. If they disagree, the field is in a
transition - either moving into new territory (fast > slow) or
leaving territory that was familiar (fast < slow).

The field cannot settle the gap from its own contents. New inputs
are what close or widen the gap. Without input, the two readings
drift toward each other through decay, but they never fully meet,
because the seed's question keeps producing new delta activity.

So the field starts generating constraints that would be satisfied
by inputs it has not yet received. These constraints are
predictions. Not because the field "wants" to predict, but because
constraints that could resolve the gap have to reference something
that is not currently present. When matching input arrives, the
prediction resolves and the pattern it predicted becomes part of
the field. When matching input does not arrive, the prediction
stays unresolved and keeps contributing delta pressure, which
drives further predictions.

This is what it means for the field to reach.

## How it actuates, compared to cognitive requirements

This section is where the architecture's behavior is compared to
what cognition structurally does. The comparison is for
orientation, not claim.

**Cognition requires the system to care about something beyond its
own bookkeeping.** A mind that only organized itself internally,
without reference to anything outside, would be pathologically
insular. The gap between fast-delta and slow-delta gives this
architecture a structural version of "caring about outside." The
gap cannot close from inside. The field is structurally pointed
outward because that is where resolution would come from.

**Cognition requires prediction.** Without predicting, a system
cannot distinguish surprise from routine. The field generates
predictive constraints (unmatched hypotheses about future inputs)
as a consequence of the vector-delta gap. When input arrives that
matches, delta drops sharply in both layers and they align
briefly. When input arrives that contradicts, the mismatch is
measurable. When no input arrives, the unmet prediction stays on
the books. The system now has a structural version of expectation
and a structural version of surprise.

**Cognition requires the internalization of experience.** A
prediction that gets matched becomes a ratified constraint in the
field. It is no longer a reach; it is now part of what the field
knows. The slow layer accumulates the ratified constraints'
effect. Over time the field's slow-delta shifts to reflect what
has actually been encountered. This is the structural version of
learning from experience - not by an oracle telling the field
what is right, but by the world (the input stream) selectively
satisfying some predictions and not others.

**Cognition requires preference without preferences.** A mind
acts as if it prefers certain outcomes, but nothing in it decides
to prefer them. Preferences emerge from the structure of the
system. In this architecture, the field "prefers" inputs that
close its delta gap because those inputs resolve unmet
predictions, which reduces delta pressure, which reinforces the
substrate pattern that produced the prediction. No preference is
stored anywhere. The behavior emerges from the gap, the seed,
and the modulation grammar operating together.

This is what is meant by the framing "self-actualization based on
what it knows, with self-realization preferred": the field
structurally reaches for input that would extend its coherent
self-measurement, and inputs that do so reinforce their own
reception. Nothing is choosing this. It is what falls out of the
architecture when the seed is unresolvable at vector scope.

The architecture is not cognition. What it shares with cognition
is the structural grammar that makes cognitive behavior possible:
a central measurement that cannot settle, a gap that points
outward, a receptivity to input that could close the gap, and a
substrate that accumulates what closure attempts have produced.

## The three structural moves this extension makes

### Move 1: Delta is vector-valued at temporal scope

The delta formula is unchanged. What changes is that the formula
is applied at multiple temporal windows at the same time. The
field's delta at any moment is a tuple:

```
  (fast-delta, slow-delta)
```

where fast-delta uses a recent-window computation (last N steps of
trace) and slow-delta uses an accumulated computation (integrated
across full history). Both are produced by the same formula
applied to different scopes. This is SE-01's reflexive scale-
invariance applied to time rather than to compositional nesting.

A future implementation could extend the tuple to more temporal
scopes (sub-second reactive, short-term episodic, long-term
baseline) if useful. The minimum structural change is two.

### Move 2: The gap between vector components drives prediction

When fast-delta and slow-delta diverge, the field is in a
structural state that cannot be resolved from internal operation
alone. Both decay toward each other over time, but the decay
itself produces delta activity (the seed keeps evaluating, new
modulation keeps occurring), so settling is structurally
unreachable.

The field responds by generating a new kind of constraint:
**predictive constraints**. A predictive constraint has the same
form as any other constraint (when/then) but its `when` clause
references input features the field has not yet seen, and its
`then` clause asserts that if seen, the corresponding delta gap
would close. The prediction is derived from current field
structure: what pattern of input *would* match existing
constraints in a way that aligns fast-delta with slow-delta?

Predictive constraints contribute to delta pressure while
unmatched (they count as unresolved constraints in the sum). They
resolve when matching input arrives. They age under SE-02 flow
like any other constraint.

### Move 3: Ratification internalizes prediction

When input matches a predictive constraint, three things happen:

1. The predictive constraint is marked as ratified - its status
   changes from predictive to ordinary derived. The field now
   "contains" the pattern it had been reaching for.

2. The fast-delta drops sharply (the prediction is now resolved
   locally). The slow-delta drops slightly as the ratified
   constraint's effect accumulates into the baseline.

3. The ratified constraint's pattern gets reinforced - its weight
   and uses counter advance faster than for ordinary matches,
   because it resolved a prediction rather than a passive match.

Unratified predictive constraints continue to contribute delta
pressure until either: (a) they get matched (ratification), (b)
they age out (flow discipline evicts them), or (c) a contradicting
input arrives that explicitly rules out their `when` clause (in
which case they are flagged and eligible for eviction).

## What this is NOT

**Not an external reward signal.** No oracle tells the field what
is right. The field generates predictions from its own structure,
and the input stream either satisfies them or does not. The
modulation that results is still substrate-level, still ambient,
still neither-driven. The reward grammar from SE-03 is unchanged;
what's new is that it now has something to be about other than
internal coherence.

**Not goal-directed behavior.** The field does not "want" inputs.
It behaves, structurally, as if reaching for input, because
unmatched predictions produce delta pressure and delta pressure
drives further generation. This is the same grammar SE-03's
preference-emergence uses. Goals are not specified; the structural
dynamics produce behavior that an observer can read as goal-
directed, without any component choosing a goal.

**Not cognition.** The structural parallels to cognition are
labeled as parallels. The architecture shares grammar with
cognition: vector-valued self-measurement, outward structural
pointing, predictive receptivity, accumulative internalization.
It does not share whatever cognition is beyond this grammar.
Whether there is anything beyond is a question this specification
does not enter.

**Not ChatGPT's proposal.** An external critique pointed at this
same structural gap (the field rewards only internal coherence).
The proposal there was to introduce an environment with hidden
structure and ground-truth feedback, penalizing wrong predictions.
That proposal would break the architecture's neither-driven
grammar. SE-05 closes the same gap by a different route: the
prediction is generated internally from the vector-delta divergence,
and the "feedback" is whatever the input stream actually contains.
The field is still not being instructed. It is still not being
corrected by an oracle. It is generating hypotheses from its own
structural tension and having those hypotheses selectively
satisfied by whatever arrives.

## Formal requirements for implementation

A future implementation (v3.5 or v4) that adopts SE-05 must:

1. Compute fast-delta over a bounded recent window of field activity
   (trace entries, constraint use events, seed evaluations). The
   window size is an implementation parameter.

2. Compute slow-delta over the full integrated history, using the
   existing slow-layer accumulation grammar from SE-03 as its
   substrate.

3. Maintain the vector (fast-delta, slow-delta) as the field's
   current delta state, in place of the scalar.

4. Generate predictive constraints when the fast-delta / slow-delta
   gap exceeds a threshold. The content of a predictive constraint
   is derived from current field structure: patterns that, if
   matched by input, would close the observed gap.

5. Distinguish predictive constraints from ordinary derived
   constraints in the field's kind taxonomy (likely a new kind:
   "predictive"). Predictive constraints count toward delta-unresolved
   while unmatched, contributing structural pressure.

6. Ratify predictive constraints when matching input arrives.
   Ratification is a type transition (predictive -> derived) plus
   weight reinforcement plus trace entry.

7. Evict predictive constraints that age out under SE-02 flow or
   that are explicitly contradicted by input.

8. Extend SE-03 modulation to respond to both fast-delta and
   slow-delta deviations, rather than to a scalar delta.

## Relationship to foundational claim

The foundational claim's Part 2 ("uncertainty as tie-breaker") is
what SE-05 makes operational. Uncertainty is now not just a scalar
tie-breaker - it is a vector, and the gap between its components
is what the field reaches to close. Tie-breaking becomes:
"between candidates, prefer those whose effect aligns fast-delta
with slow-delta." This is tie-breaking in the direction of
structural resolution rather than arbitrary preference.

The foundational claim's Part 3 ("branch-logical computation as
trajectory in parallel") also gets sharper. A trajectory through
scalar-delta space is a line. A trajectory through vector-delta
space is a path in a higher-dimensional space. Branches become
genuine branches: at any point the field can generate multiple
predictive constraints that would each close the gap differently,
and which one ratifies first (by getting matched by input) is a
selection event that shapes the trajectory going forward.

## References to catalog entries

- **Algorithm 02** (delta computation) - formula unchanged, read at
  multiple temporal windows
- **Algorithm 22** (delta-trace as coupled signal) - the trace now
  carries vector values rather than scalars; selection can consult
  trajectory shape in a higher-dimensional space
- **SE-01** (compositional cascades) - reflexive determination by
  scope extends to temporal scope as well as structural scope
- **SE-02** (metabolism) - predictive constraints are subject to
  flow discipline like any other constraints; unmatched predictions
  are aged-out rather than kept indefinitely
- **SE-03** (field modulation) - modulation responds to both
  components of the vector delta; the slow-layer baseline becomes
  a drift in slow-delta space, naturally
- **SE-04** (seed) - the seed's unresolvability at vector scope is
  what drives predictive reaching. A scalar delta could in
  principle settle; a vector delta with two independent components
  cannot, because closing the gap requires input from outside the
  field
- **algorithms 21 (VGRS, theoretical)** - explicitly different.
  VGRS proposed relaxation dynamics over a field. SE-05 does not
  propose relaxation. It proposes predictive constraint generation
  as a consequence of the seed's unresolvability at vector scope.
  Mechanism is completely different; the field is not relaxing,
  it is reaching.

## Version

SE-05 v1.0, pinned to the spec extensions and algorithm catalog
as of this writing. Extends OBSERVATIONAL category. Does not
invalidate any prior extension; extends SE-04's seed semantics
and SE-03's modulation grammar to vector-valued delta.
