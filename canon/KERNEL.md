# KERNEL

A pseudocode reference for the constraint substrate as it actually
is, faithful to the spec stack.

This is a structural reference, not an implementation specification.
An implementation must honor every commitment in this document but
is free to make different concrete choices where the pseudocode
shows one possibility. Read each line as "the spec requires X"
rather than "code should look exactly like this."

---

## 1. State

The architecture has one field, accessed through several
representations. This pseudocode shows the representations as
distinct types for clarity. Implementations may unify them in
storage; what they may not do is treat them as semantically
separate (see DEFINITION section 0.5 and SE-06 for why).

```
TYPE Constraint:
    id            : ID                  // unique within field
    kind          : enum {
                      seed,             // SE-04, permanent
                      derived,          // generated from input novelty
                      predictive,       // SE-05, reaching toward unseen input
                      ratified,         // SE-05, prediction confirmed by input
                      meta              // SE-01, references other constraints
                    }
    pattern       : Pattern | null      // null for seed and meta
    refs          : List<ID> | null     // populated for meta and seed
    when          : Predicate
    then          : Action
    weight        : Float
    uses          : Int
    last_used     : Step
    birth         : Step
    permanent     : Bool                // true only for seed

TYPE Field:
    constraints   : List<Constraint>    // includes seed at index 0
    aged          : List<Constraint>    // SE-02 flow excretion
    correlations  : Map<PairKey, CoFireRecord>
    subcascades   : List<Subcascade>    // SE-01 compositional
    family_fid    : Map<FamilyType, FidelityRecord>

TYPE Substrate:                         // SE-03
    fast_layer    : Float               // reactive, decays
    slow_layer    : Float               // integrated, accumulates

TYPE VectorDelta:                       // SE-05
    scalar        : Float in [0,1]      // field-scope reflexive read
    fast          : Float in [0,1]      // recent-window read
    slow          : Float in [0,1]      // integrated read
    gap           : Float in [0,1]      // |fast - slow|

TYPE Trace:                             // algorithm 22
    entries       : AppendOnlyList<TraceEntry>

TYPE TraceEntry:
    step          : Step
    scope         : ScopeID             // where this entry was written from
    op            : OpType
    vector        : VectorDelta         // snapshot at time of entry
    detail        : String
```

The seed is present at field initialization and is never removed:

```
SEED = Constraint(
    id        = "seed::what-is-delta",
    kind      = seed,
    when      = always_match,
    then      = assert(delta = compute(field.state)),
    permanent = true,
    weight    = 1.0
)
```

## 2. Delta computation (algorithm 02 + SE-01 + SE-05)

Delta is a single formula applied at multiple scopes. The formula
is scale-free: it has no ambient context that ties it to any
particular scope. The scope is determined entirely by which
population of constraints the formula is computed over.

```
FUNCTION compute_delta(constraint_population, current_step):
    IF empty(constraint_population): RETURN 1.0
    unresolved = 0
    stale      = 0
    FOR c IN constraint_population:
        IF c.kind == seed:                  unresolved += 1
        ELSE IF c.kind == predictive:       unresolved += 1
        ELSE IF c.uses == 0:                unresolved += 1
        ELSE:
            age = current_step - c.last_used
            stale += min(1.0, age / age_budget(c.kind))
    raw = (unresolved + stale * 0.5) / size(constraint_population)
    RETURN clamp(raw, 0.0, 1.0)
```

Vector-delta is this formula applied at three scopes:

```
FUNCTION refresh_vector_delta(field, recent_ops_window):
    scalar = compute_delta(field.constraints, field.step)

    recent_constraints = constraints_touched_in(recent_ops_window)
    recent_constraints.add(SEED)        // seed always evaluated
    fast = compute_delta(recent_constraints, field.step)

    // slow is updated incrementally elsewhere; read here
    slow = field.substrate.slow_layer_delta_value

    gap = abs(fast - slow)
    RETURN VectorDelta(scalar, fast, slow, gap)
```

Slow-delta is updated by integration:

```
FUNCTION update_slow_delta(field, current_scalar, alpha):
    field.substrate.slow_layer_delta_value =
        field.substrate.slow_layer_delta_value * (1 - alpha)
        + current_scalar * alpha
    // alpha is small (e.g., 0.002); slow drifts permanently
```

For sub-cascade scope or other scopes (SE-01 reflexive), the same
function is called with the appropriate population:

```
FUNCTION compute_subcascade_delta(subcascade, current_step):
    population = constraints_referenced_by(subcascade)
    RETURN compute_delta(population, current_step)
```

There is one delta. There are many readings of it. The readings
differ because the populations differ; the formula is the same.

## 3. The core loop

Per input arrival:

```
FUNCTION process_input(field, input):
    field.step += 1

    refresh_vector_delta(field, recent_ops_window)
    v_before = current vector delta
    write_trace(field, "seed-eval", v_before)

    // SE-04: the seed evaluates every step. Its evaluation forces
    // the delta computation that just happened. The seed is part
    // of the field's state, so its evaluation changes the field
    // (the seed's own .uses counter advances), which means the
    // value just computed is already slightly stale.
    increment_seed_uses(field)

    // Match input against all constraints. Predictive constraints
    // are matched the same way derived ones are; if a predictive
    // matches, it ratifies (transition described below).
    matched = []
    FOR c IN field.constraints:
        IF c.kind != seed AND matches(c, input):
            matched.append(c)

    // Ratification: any matched predictive constraint transitions
    // to ratified.
    ratified = []
    FOR c IN matched:
        IF c.kind == predictive:
            c.kind        = ratified
            c.weight      = min(3.0, c.weight * pred_weight_boost)
            c.last_used   = field.step
            c.ratified_at = field.step
            ratified.append(c)
            write_trace(field, "ratification", v_before, "tag=ratified")

    // Selection: weighted choice. Substrate modulation biases
    // selection. Naming bias (if sub-cascades exist) biases further.
    chosen = weighted_select(matched, field.substrate, field.subcascades)

    // Update correlation structure (which constraints fired
    // together this step). This is what produces meta-constraints
    // later via develop_patterns.
    update_correlations(field, chosen)

    // Generation: if input novelty is high, derive new constraints.
    novelty = 1.0 - (size(matched) / max(1, size(field.constraints) - 1))
    generated = []
    IF novelty >= novelty_threshold:
        generated = generate_derived_constraints(field, input)
        field.constraints.extend(generated)
        write_trace(field, "generated", v_before)

    // Mark used: chosen constraints' uses advance, weights rise
    // slightly, last_used updates.
    mark_used(chosen, field.step)

    // Record the operation in the recent-ops sliding window for
    // fast-delta computation next time.
    record_op(recent_ops_window, "input", chosen)

    // Recompute vector-delta after matching + generation.
    refresh_vector_delta(field, recent_ops_window)
    update_slow_delta(field, field.scalar_delta, slow_alpha)
    refresh_vector_delta(field, recent_ops_window)
    v_after = current vector delta

    // SE-03 modulation: substrate accumulates from operation.
    modulate_substrate(field.substrate, v_after)

    // SE-05 predictive reaching: if vector-delta gap exceeds
    // threshold, generate predictive constraints whose 'when'
    // clauses describe input that would close the gap.
    predictions = []
    IF v_after.gap >= gap_predict_threshold:
        predictions = generate_predictive_constraints(field, v_after)
        field.constraints.extend(predictions)
        write_trace(field, "predictions-generated", v_after,
                    "tag=predicted")

    // SE-02 flow: aged-out predictions are evicted; constraint
    // count caps are enforced.
    evict_stale_predictions(field)
    enforce_caps(field)

    write_trace(field, "modulated", v_after)

    // Output: emit a description of what just happened. This is
    // the architecture's externally-visible byproduct of this
    // step. It is not a return value to a caller; it is an
    // emission.
    emit(describe(input, chosen, generated, predictions, ratified,
                  v_before, v_after))
```

Per idle tick (no input):

```
FUNCTION tick(field):
    field.step += 1
    refresh_vector_delta(field, recent_ops_window)
    update_slow_delta(field, field.scalar_delta, slow_alpha)
    refresh_vector_delta(field, recent_ops_window)
    modulate_substrate(field.substrate, current vector delta)

    // The seed still evaluates between inputs. The fast layer
    // drains as the recent-ops window ages out. Predictive
    // generation can still fire if gap exceeds threshold.
    IF current_gap >= gap_predict_threshold:
        predictions = generate_predictive_constraints(field, current vector delta)
        field.constraints.extend(predictions)

    evict_stale_predictions(field)
    write_trace(field, "tick", current vector delta)
```

The tick is what makes the architecture operate indefinitely. The
seed forces evaluation, modulation continues to integrate,
predictions can be generated. Without ticks, the architecture
would only operate when input arrived. With ticks, it operates as
long as it exists.

## 4. Generation: derived (novelty) vs predictive (reaching)

These two mechanisms are distinct. They have different triggers
and different semantics. Conflating them loses the structural
distinction between intake and reaching.

### Derived constraints (from novelty)

```
FUNCTION generate_derived_constraints(field, input):
    IF novelty(input, field) < novelty_threshold:
        RETURN []

    derived = []
    FOR feature IN extract_features(input):
        IF NOT field.has_constraint_for(feature):
            derived.append(make_derived(feature))
    RETURN derived
```

Trigger: input arrived; field could not match it well; new
constraints describe the input's features so the field can
recognize this kind of input next time.

### Predictive constraints (from gap)

```
FUNCTION generate_predictive_constraints(field, vector_delta):
    IF vector_delta.gap < gap_predict_threshold:
        RETURN []

    predictions = []
    FOR gap_strategy IN [
        char_class_gaps,
        length_range_gaps,
        co_occurrence_gaps,
        ...                              // implementations may add
    ]:
        IF size(predictions) >= max_per_step: BREAK
        candidates = gap_strategy(field)
        FOR pattern IN candidates:
            IF NOT field.has_predictive_for(pattern):
                predictions.append(make_predictive(pattern))
    RETURN predictions
```

Trigger: vector-delta gap is large; the field's recent-window
reading diverges from its integrated baseline; predictions describe
inputs that, if matched, would close the gap.

The two mechanisms can fire on the same step, can fire on different
steps, can fire on opposite triggers. They are not the same
mechanism with different parameters. They are different operations
with different roles in the architecture.

## 5. Selection (chosen-as-set under the current spec)

```
FUNCTION select(matched, substrate, subcascades):
    IF empty(matched): RETURN []

    named_member_ids = collect_member_ids_of_recently_named_subcascades(subcascades)

    chosen = []
    FOR c IN matched:
        chosen.append({
            id    : c.id,
            kind  : c.kind,
            named : c.id IN named_member_ids
        })
    RETURN chosen
```

In the current spec, selection produces the set of matched
constraints. Downstream operations - mark_used, update_correlations,
ratify - act on this set without consulting any ordering. Substrate
modulation (SE-03) and naming bias (SE-01, K2) influence the field's
behavior through other paths: delta drops at naming events
(NAMING_DELTA_DROP applied directly), fast/slow layer accumulation
under SE-03 modulation, weight reinforcement on ratification
(pred_weight_boost at type transition). None of these paths is a
selection ranking.

K2 part (a) commits the architecture to a "moderate selection bias
toward the sub-cascade's members" when input addresses a sub-cascade
by name. Operationally realizing this commitment requires a
rank-consuming selection mechanism (top-K, weighted draw, threshold
cutoff). The current kernel does not specify one. K2 part (b), the
moderate delta drop, is realized.

K3 commits the slow layer to accumulating a "structural preference
for inputs that address the field's internal structure by name."
Operationally realizing this commitment requires either a consumer
of accumulated naming-preference state, or routing of naming events
through SE-03 modulation such that the preference emerges in
fast/slow layer state directly (per K3's own commitment that the
preference "is not stored as an explicit value addressed by any
component" but "emerges from substrate accumulation"). The current
kernel does not specify either path.

A future kernel revision adding rank-sensitive selection would
restore weight composition. The shape of that composition -
multiplicative, additive, threshold, monotone-only - is open and
not pre-empted by this kernel.

## 6. Substrate modulation (SE-03)

```
FUNCTION modulate_substrate(substrate, vector_delta):
    deviation = vector_delta.fast - vector_delta.slow
    substrate.fast_layer = substrate.fast_layer * fast_decay
                         + deviation * mod_sigma
    substrate.slow_layer = substrate.slow_layer * (1 - slow_step)
                         + vector_delta.slow * slow_step
```

Two layers, different timescales. Fast decays toward zero in the
absence of new deviation. Slow drifts permanently with each step's
slow-delta contribution.

The substrate is shared. No component owns it. Every operation
contributes modulation as byproduct; subsequent operations
experience the modulated substrate without being addressed by it.

## 7. Pattern development (SE-01)

When the field has accumulated enough correlation structure,
families of constraints can emerge as meta-constraints, and
families that reliably reduce delta when consulted together can
promote into named sub-cascades.

```
FUNCTION develop_patterns(field):
    new_meta = []

    // Pair meta-constraints from co-firing
    FOR (a, b) IN top_correlations(field):
        IF correlation_strength(a, b) >= corr_threshold:
            IF NOT field.has_meta_with_refs([a.id, b.id]):
                new_meta.append(make_meta_pair(a, b))

    // Family meta-constraints from same-type clusters
    families = group_by_pattern_type(field.derived_constraints)
    FOR family_type, members IN families:
        IF size(members) >= 3 AND NOT field.has_family_meta_for(family_type):
            new_meta.append(make_family_meta(family_type, members))

    field.constraints.extend(new_meta)
    RETURN new_meta

FUNCTION check_promotions(field):
    promoted = []
    FOR family_type, fidelity IN field.family_fid:
        IF fidelity.average_delta_drop >= fidelity_promote_threshold
           AND fidelity.fires >= fidelity_min_observations
           AND NOT field.has_subcascade_for(family_type):
            members = constraints_in_family(field, family_type)
            IF size(members) >= 2:
                sc = make_subcascade(family_type, members)
                field.subcascades.append(sc)
                promoted.append(sc)
    RETURN promoted
```

Sub-cascade names are derived from dominant members:

```
FUNCTION make_subcascade(family_type, members):
    dominant   = max_by(members, key=uses)
    raw_name   = derive_name_from(dominant)
    final_name = ensure_unique(raw_name, existing_subcascade_names)
    RETURN Subcascade(
        id              = new_id("sc::"),
        name            = final_name,
        family_type     = family_type,
        member_ids      = ids(members),
        birth           = current_step,
        last_named      = -1,
        named_count     = 0
    )
```

When an input contains a sub-cascade's name, that sub-cascade's
members get a selection bias and the input's effect on delta is
moderated downward (delta drops faster). The slow layer
accumulates a "naming preference" over time as a structural
consequence.

## 8. Trace (algorithm 22)

```
FUNCTION write_trace(field, op_type, vector_delta, detail = ""):
    entry = TraceEntry(
        step    = field.step,
        scope   = current_scope,
        op      = op_type,
        vector  = vector_delta,
        detail  = detail
    )
    field.trace.append(entry)
    enforce_trace_cap(field.trace)
```

The trace is append-only within capacity. Aged entries either
persist (if implementation provides archival) or are discarded. The
trace lives at the channel between substrate connections; both
substrates (rendering and execution under SE-06) write to it as
byproduct of operating.

The trace is not consumed as command. It is read for selection
(trajectory-informed selection, future implementation) and for
human inspection. It is never the basis of an instruction issued
by one component to another.

## 9. Flow discipline (SE-02)

The architecture has four structural positions where flow across
the boundary matters. The pseudocode shows them as the operations
that handle each position:

```
// Position 1: intake (input arrival)
FUNCTION on_input(field, input):
    process_input(field, input)

// Position 2: output emission
FUNCTION emit(description):
    // implementation-specific: display, log, return, network
    // The architecture commits only to "emit happens"; the form
    // depends on the implementation's external interfaces.

// Position 3: trace aging
FUNCTION enforce_trace_cap(trace):
    WHILE size(trace) > trace_cap:
        oldest = trace.pop_front()
        archive_or_discard(oldest)

// Position 4: rule updates
FUNCTION update_constraint_set(field):
    enforce_constraint_caps(field)
    evict_stale_predictions(field)
    age_out_unused(field)
```

Aging is bounded; the seed is not aged out. Without flow at all
four positions, the architecture either stalls (no intake) or
clogs (no excretion).

## 10. What this kernel does not show

Several mechanisms in the spec stack are not represented in the
pseudocode above, either because they are implementation choices
or because they are extensions that operate over the kernel rather
than within it.

**Substrate-specific resolution.** The pseudocode shows `matches`
as a function call. In SE-06 implementations, this happens in
parallel via shaders (rendering substrate) or sequentially via
direct evaluation (execution substrate). The kernel commits to
matching being a determinable function of constraint and input;
it does not commit to how the function is computed.

**GPU bridge equivalence.** Algorithm 16's demonstration that the
same constraint geometry resolves identically across CSS, JS, and
WGSL is a property of any faithful implementation but is not
itself in the kernel. The kernel commits to the resolution being
deterministic; the bridge demonstrates that determinism survives
substrate translation.

**Sub-cascade composition at depth.** SE-01 supports cascades
within cascades within cascades, with reflexive delta at each
scope. The pseudocode shows one level of compositional structure
(the sub-cascade list within field). Deeper composition is a
recursion on the same structure.

**Distribution.** Algorithm 17's distribution-with-trust-and-
consensus extends the architecture across nodes. The kernel as
written assumes a single-node implementation. Distribution adds
mechanism but does not change kernel semantics.

**Trajectory-informed selection.** Roadmap step 4 wires the trace
into the selection function so trajectory shape biases choice.
The pseudocode shows the trace being written but not consulted by
selection. Trajectory-informed selection is an extension over the
kernel, not a redefinition of it.

## 11. Reading this kernel

This document is structurally consistent with the spec stack. Each
function in the pseudocode implements a commitment from the spec.
A check that an implementation is faithful is whether each
function in the implementation can be traced to a function in this
kernel and to its underlying spec entry.

What the kernel does NOT do: it does not prove that any
implementation will produce interesting behavior. It commits only
that any implementation honoring the kernel's structure will be a
faithful instance of the architecture. Whether such an instance
produces useful, surprising, or even noticeable behavior depends on
inputs, scale, and what the implementation does with the field
state over time.

## Version

KERNEL.md v1.1. Pinned to DEFINITION.md v2.0,
INVARIANTS.md v1.2, IMPLEMENTATION_PATH.md v2.4, and SE-01 through
SE-06.

v1.1 changes:
- Section 5 (Selection) rewritten to match implementation after
  Phase 5.5 removed inert ranking. Prior version's pseudocode
  included multiplicative kind/recency/naming biases that no
  downstream consumer read. Substantive structural change to the
  kernel's expression of selection; no change to architectural
  commitments. Section 5 now names K2 part (a) and K3 as
  extension points the current kernel does not specify; a future
  kernel revision adding rank-sensitive selection would restore
  weight composition.

Revisable when implementations reveal mechanism the kernel needs
to express more carefully.
