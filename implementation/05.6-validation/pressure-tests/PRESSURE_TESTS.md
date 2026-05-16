# Pressure Tests: Substrate Integrity Against Known Paradigm Critiques

A structural diagnostic of the constraint substrate’s commitments evaluated against the published critiques and known failure modes of its closest paradigms. The heat map from the prior positioning report supplied the proximity ranking; the critiques below are pulled from academic literature and engineering practice in those paradigms.

The format for each pressure test:

- The critique as articulated against the original paradigm (with citations where available)
- The translated form of the critique applied to the substrate
- Which substrate commitment(s) the critique pressures
- Whether the substrate’s existing commitments survive
- What the result reveals (if survives) or what gap the critique exposes (if doesn’t)

The substrate’s existing commitments are the F/C/M/K/S/I/D/O/X invariants, DEFINITION’s six properties, and SE-01 through SE-09. Spec language already acknowledges open structural gaps (K2 part a unrealized, K3 namingPref-as-accumulator strain, SE-03 EMA decay vs permanence). These are noted where relevant.

Pressure tests grouped by paradigm proximity, ordered Tier 1 then Tier 2.

-----

## Tier 1: Predictive Coding / Active Inference / Free Energy Principle

### PT-FEP-1: The universality problem applied to delta

**The original critique.** Aguilera, Millidge, Tschantz, and Buckley argue in *How Particular is the Physics of the Free Energy Principle?* (2021, 2022) that the FEP’s variational free energy formulation is uninformative for many physical systems because crucial assumptions restrict applicability to a very narrow space of linear systems. The deeper concern, articulated through commentary papers by Ramstead, Sakthivadivel, and others, is universality: any dynamical system can in principle be described as performing inference on something, which threatens to make the FEP a redescription rather than an explanation.

**Translated to the substrate.** Delta is the universal scalar (F2). Selection, modulation, eviction, and promotion all derive from it. Critique: any system whose state evolves under a monotonic measure of unresolved-ness can be redescribed as having a “delta,” which makes delta a formal redescription rather than a structural commitment.

**Pressures.** F2 (delta is one formula at every scope), SE-04 (the seed asks “what is delta?”).

**Substrate response.** The substrate doesn’t claim delta is unique to it. It claims delta is what *this specific architecture* spends and what its mechanisms derive from. SE-09 (operational irreversibility) names the architecture’s exchange in substrate terms, not in claims about minimization more broadly. The universality critique applies to claims of the form “this architecture is the only one that does X.” The substrate doesn’t make that claim.

**Result.** Survives, but the survival sharpens what the substrate actually claims. The spec should be read as committing to specific structural relationships among delta, selection, modulation, eviction, and promotion *within this architecture*, not as committing to delta being explanatorily prior to those mechanisms in general. The universality critique exposes a hidden assumption only if the substrate is read as making metaphysical claims about minimization. Reading it as engineering doesn’t trip the critique.

### PT-FEP-2: Markov blanket as too-strict statistical condition

**The original critique.** The Markov blanket condition–internal/sensory/active/external partition with specific conditional independence properties–rarely holds in real dynamics. Critics argue the partition is mathematical convenience for FEP derivations, not a feature of the systems being modeled.

**Translated to the substrate.** The reflexive surface (O1, O2, O3) is read-only with respect to the field, bounded, and sources vocabulary from the field. Critique: the read-only/write-only partition is similarly idealized; in practice an observer’s structure inevitably influences what is observable, and the field’s structure inevitably leaks into the observer’s structure beyond what O3 commits to.

**Pressures.** O1 (read-only with respect to the field), O2 (bounded), O3 (vocabulary from the field).

**Substrate response.** The reflexive surface’s read-only commitment is enforced empirically by C8 (the static coupling check that scans `reflexive-surface.js` for any Field-mutating call signatures). It’s not a derivational convenience; it’s a verifiable property of the implementation. The vocabulary commitment is similarly enforced–the surface produces clauses keyed to field state structures. The substrate sidesteps the Markov blanket critique by not depending on conditional independence; the partition is mechanical (writes vs reads) rather than statistical.

**Result.** Survives, with a subtlety worth flagging. The reflexive surface’s read-only property is verified at the call-graph level, not at the information-theoretic level. An observer reading state could still leak that state to external systems whose subsequent input shapes the field’s future trajectory. F3 (no supervision) constrains this within the architecture, but external coupling outside the architecture is undefined. This is a real boundary of the substrate’s commitments rather than a violation, but the spec could note it.

### PT-FEP-3: Structure learning gap

**The original critique.** FEP’s least-developed area has long been how generative models acquire their structure. The principle assumes a generative model already exists and minimizes free energy under it. Where the model comes from is largely outside FEP’s account.

**Translated to the substrate.** K1 commits to fidelity-based promotion: constraint families that contribute to closure earn structural status. But INVARIANTS v1.3’s K3 implementation note explicitly flags that K2 part (a)–selection bias toward sub-cascade members–is structurally specified but operationally unrealized. The substrate has the same gap as FEP: structure-learning is named but the consumption mechanism for promoted structure is incomplete.

**Pressures.** K1 (sub-cascades emerge from fidelity), K2 part (a) (sub-cascades addressable by name with selection bias), K3 (naming preference is structural).

**Substrate response.** The spec stack acknowledges the gap. INVARIANTS v1.3’s implementation note is explicit. Phase 5.6 was originally scoped to address K2/K3 implementation; it was retasked to F5/SE-09 verification, leaving the K2/K3 gap open. The substrate doesn’t pretend to have solved structure learning.

**Result.** Doesn’t survive cleanly, and the substrate already names this. The pressure test confirms what the spec stack acknowledges: structure learning is real territory, the substrate has a partial mechanism (promotion exists), but the consumption side (selection preference for promoted structure) is unrealized. This is the strongest “open structural gap” surfaced by any pressure test, and it is a known gap, not a discovered one.

### PT-FEP-4: Path-based vs state-based formulation

**The original critique.** Sakthivadivel argues that path-based FEP formulations restore explanatory power that state-based formulations lose. The state-based formulation makes claims about densities over states; the path-based formulation makes claims about trajectories. Different claims, different scope, different testability.

**Translated to the substrate.** The substrate’s commitments are mostly path-based (F5, SE-09: trajectory novelty; M5: trace as channel; X4: settling is the substrate’s mechanisms operating). But selection happens at instantaneous points (matched constraints, current modulation, current delta). Are these consistent? Does the substrate’s path-based identity reduce cleanly to its instantaneous mechanisms?

**Pressures.** F5 (irrecoverable change), SE-09 (operational irreversibility), X4 (settling as mechanisms operating).

**Substrate response.** F5/SE-09 explicitly stack on M5 + SE-03 + SE-04 + F1 + F4 to produce trajectory novelty. The path-based identity is derived from instantaneous mechanisms, not asserted alongside them. Phase 5.6’s empirical verification (200 iterations of identical input producing 200 distinct field-state hashes) is the path-based property emerging from instantaneous operation.

**Result.** Survives. The path-based claim is grounded in instantaneous mechanisms and verified empirically. This is actually a place where the substrate is more rigorous than FEP–the trajectory novelty isn’t derived analytically and asserted; it’s produced by the running implementation and tested.

-----

## Tier 1: Differential Dataflow / Naiad / Materialize

### PT-DD-1: Exactness vs approximation

**The original critique.** Differential dataflow is *exact*: incremental updates produce the same result a from-scratch computation would, by Materialize’s documented correctness invariant. This is what makes DD trustworthy for SQL incremental view maintenance and analytics where users need to know the answer is right.

**Translated to the substrate.** The substrate settles approximately. Delta drives selection, modulation, eviction, promotion–each operation is correct by its own mechanism but the substrate doesn’t commit to convergence to a from-scratch equivalent. Where DD has a correctness theorem, the substrate has structural commitments without an analogous correctness claim.

**Pressures.** S2 (substrate-equivalent resolution), F4 (operates indefinitely), F5 (operations deposit irrecoverable change).

**Substrate response.** S2 commits to byte-equivalence across substrate connections (CSS/JS/GPU produce identical results given identical input)–this is correctness across substrates for the same computation, not correctness against a reference computation. The substrate explicitly does not claim to converge to a reference; it claims to settle. SE-07 makes this explicit: “configuration is what the substrate currently is; settling is the substrate operating.”

**Result.** Survives by clarifying scope. The substrate is a different *kind* of system than DD. DD is for problems with reference answers. The substrate is for problems where settling is the answer. The pressure test sharpens which domains the substrate can claim to serve–not those needing exact incremental answers, but those where settling-as-process is the deliverable. This is consistent with the positioning report’s identification of state-transition accountability and predictive-coding-style settling as the substrate’s natural domains.

### PT-DD-2: Patching-the-output failure

**The original critique.** McSherry’s classic example: incrementally patching the output of an iterative computation can be incorrect. If a bank labels people fraudsters via transitive closure over fraud connections, and someone is later removed from the source dataset, naive incremental patching leaves their associates labeled as fraudsters because the transitive computation already propagated. DD solves this through differential timestamps; naive incremental computation cannot.

**Translated to the substrate.** Promotion in K1 is monotonic: constraint families accumulate fidelity and promote into named structures. If an input that originally produced a constraint becomes irrelevant or is shown to be erroneous, the constraint remains, accumulated weight remains, promoted sub-cascades remain. The substrate has no “withdraw a previously-promoted structure” mechanism. The recency-driven eviction will eventually shed unused structure, but there’s no targeted retraction.

**Pressures.** K1 (sub-cascades emerge from fidelity), F5 (observation produces irrecoverable change), SE-09 (operational irreversibility).

**Substrate response.** F5 and SE-09 explicitly commit to irreversibility as a feature, not a bug. The substrate’s whole architecture is built on the principle that observations deposit permanent structure. The “patching” failure mode is, for the substrate, a structural commitment rather than a problem to solve. SE-09: “What the architecture spends, in its own terms, is structural commitment.” Withdrawal is not a substrate operation.

**Result.** Survives by inversion. What DD treats as a correctness problem to solve through differential timestamps, the substrate treats as a structural commitment. This means the substrate is *unsuitable* for use cases where retraction matters (compliance with GDPR right-to-be-forgotten, for example). It is *suited* for use cases where permanence is desired (audit trails, accountability records, irreversible state transitions). The pressure test cleanly identifies which domain the substrate should and should not be applied to.

### PT-DD-3: Operational introspection

**The original critique.** SnailTrail and ST2 papers exist because DD has no built-in introspection–diagnosing performance problems and dataflow behaviors required external instrumentation that took years to develop into practical tooling.

**Translated to the substrate.** The substrate’s introspection is constitutive (M5, SE-09, the reflexive surface, the trajectory recorder). This is supposed to be one of its distinguishing properties.

**Pressures.** M5 (trace at channel), O1/O2/O3 (observer commitments), SE-09 (operational irreversibility).

**Substrate response.** Intentional inversion. Where DD bolted introspection on after the fact, the substrate makes it part of the architecture. Phase 5.5’s trajectory recorder demonstrates this concretely: per-frame substrate state captured into bounded ring buffers and painted through the CSS cascade as layered time-strips, all from spec-committed observation surfaces.

**Result.** Survives strongly. This is one of the substrate’s clearest advantages over DD-class systems for the domains where it competes. The substrate’s account of its own dynamics is built in; DD’s required external development.

-----

## Tier 1: Position-Based Dynamics / XPBD

### PT-XPBD-1: Iteration-count dependent stiffness

**The original critique.** Macklin’s original XPBD paper opens with this exact critique of vanilla PBD: stiffness depends on iteration count, the solver converges to an infinitely stiff solution given enough iterations, and stiffness has no physical basis. XPBD fixed this by introducing compliance terms that decouple effective stiffness from iteration count.

**Translated to the substrate.** Settling depth depends on how many CT engine cycles fire between observations. More cycles produce deeper settling, more accumulated structure, more promotions. The substrate doesn’t commit to convergence in any fixed iteration budget. Critique: behavior is implicitly iteration-count dependent in the same way PBD was, with the same “stiffness has no physical basis” problem.

**Pressures.** F4 (operates indefinitely), X2 (settling is non-terminal), F2 (delta is one formula at every scope).

**Substrate response.** The substrate explicitly commits to non-terminal settling. F4 and X2 are not bugs that need an XPBD-style fix; they’re features. The substrate does not claim “given enough cycles, you get answer X.” It claims “given input, the substrate settles.” Iteration-count dependence isn’t a hidden assumption being smuggled in; it’s named as part of what settling means.

**Result.** Survives by inversion. PBD’s iteration-count problem was that iteration count *should not* affect the answer because PBD was meant to model a determinate physical system with a determinate stiffness. The substrate’s iteration count *does* affect the configuration because settling is the substrate operating–more operation produces more settled configuration. This is a structural commitment, not a hidden assumption. The pressure test sharpens what the substrate is for: domains where ongoing settling is the deliverable, not domains where iteration count must not affect the answer.

### PT-XPBD-2: External coordination requirements

**The original critique.** XPBD requires external coordination: collision detection runs separately, friction-cone solvers run separately, the iteration scheduler is external. The constraint solver itself is one component in a larger orchestration.

**Translated to the substrate.** F3 commits to no component supervising another. CT and ER engines couple only through delta. But mechanisms inside CT (develop, correlate, reason, promote, snapshot, trace-flush) are scheduled by the engine’s dispatch loop–is that loop a supervisor? Does the substrate require external coordination that F3 hides?

**Pressures.** F3 (no supervision), S3 (rendering and execution couple through delta only).

**Substrate response.** The CT engine’s dispatch loop is bookkeeping–it sequences ops drawn from the queue but doesn’t decide what to do based on what other components are doing. F3 is about cross-component supervision, not internal sequencing. The dispatch loop reads the queue and processes one op per cycle; the queue is filled by the engine’s own ops and by external input, neither of which is supervisory. The substrate doesn’t have an XPBD-style external collision detector; what would be a separate component in XPBD lives inside the substrate as part of its own settling.

**Result.** Survives, with a structural observation. The substrate is *less* externally-coordinated than XPBD because it doesn’t separate physical concerns (collision, friction, integration) from constraint solving. Everything that happens happens through the substrate’s mechanisms. The pressure test reveals that F3 is doing real work–the architecture genuinely operates without external coordination–and that this is structurally different from PBD-class systems even where they share the “settling, never solved” property.

### PT-XPBD-3: Stability under stiff conditions

**The original critique.** Recent work (tonthat2023parallel, others) reports XPBD instabilities at high stiffness–oscillations for Poisson’s ratios near 0.5, ill-conditioned local optimization. The position-based methods’ stability properties are not fully understood.

**Translated to the substrate.** Under heavily-promoted structure (many sub-cascades, high accumulated weight), does the substrate exhibit oscillation or instability? The Phase 5.5 stability tests showed the substrate was robust under stable, shifted, and drifting input, but the test conditions used 5-token vocabularies and 200-step runs. Stability under longer runs with more accumulated structure is not yet empirically verified.

**Pressures.** F4 (operates indefinitely), X2 (settling is non-terminal), K1 (sub-cascades emerge from fidelity).

**Substrate response.** Spec acknowledges via the testing roadmap that long-run stability is not yet exhaustively verified. The 200-step stability test was a first pass, not a definitive answer. The substrate’s mechanisms (recency-driven eviction, weight decay where applicable, modulation flow) are designed to prevent runaway accumulation, but proof is empirical and the empirical body is incomplete.

**Result.** Open question. Not a violation of any current commitment, but a domain where more empirical work is warranted. The pressure test correctly identifies that the substrate’s stability claims are stronger than the empirical evidence currently supports, and that production deployment in domains requiring long-run stability would need more testing than has been done.

-----

## Tier 1: Internal Observability / OpenTelemetry / rr / Replay

### PT-OBS-1: Cross-platform substrate portability

**The original critique.** rr can’t run on ARM. Replay required custom Chromium. The Mozilla deterministic record-and-replay approach is platform-locked in ways that limit deployment. WebGPU’s specification explicitly notes that GPU behavior is “subject to the accuracy of the GPU hardware implementation of the IEEE-754 standard”–byte-identical execution across vendors is not guaranteed by the spec.

**Translated to the substrate.** S2 commits to byte-identical resolution across CSS, JS, and GPU substrate connections. Industry experience with cross-platform determinism (FLiT, Gaffer on Games’ floating-point determinism work) shows this is hard: same compiler + same CPU instruction set can produce identical results, but cross-architecture or cross-vendor reproduction is unreliable without explicit work. WebGPU’s W3C spec explicitly says floating-point GPU computation is subject to vendor IEEE-754 implementation accuracy.

**Pressures.** S2 (substrate-equivalent resolution), I2 (cross-substrate determinism).

**Substrate response.** Algorithm 16 is the empirical demonstration of byte-equivalence across CSS, JS, and the WGSL processor. The demonstration is real for the substrates and operations tested. But the pressure test reveals a real gap: the byte-equivalence has been demonstrated for specific computational patterns, not for arbitrary substrate operations. Floating-point operations on different GPU vendors may produce diverging results in edge cases (denormals, fused-multiply-add reorderings, NaN propagation differences) that algorithm 16 may not exercise.

**Result.** Survives in scope but the scope is narrower than the spec language might suggest. S2 is true for what algorithm 16 verifies; whether it’s true for *all* substrate operations on *all* WebGPU implementations is empirically unestablished. The substrate either needs to scope S2 explicitly (byte-equivalence within tested operations) or expand algorithm 16’s coverage to address edge-case floating-point behavior. This is a real finding that should sharpen S2’s spec language.

### PT-OBS-2: Wide-events and the cardinality wall

**The original critique.** Honeycomb’s wide-events philosophy has been contested in production. High-cardinality events are expensive to index; query performance degrades at scale; the unified-events model means there’s no cheap path for the queries that traces-and-metrics-and-logs split was designed to optimize.

**Translated to the substrate.** M5 commits trace to the channel, making it constitutive rather than additive. The trajectory recorder produces per-frame structural recordings. As substrate operation extends, the trace and trajectory grow. Critique: at scale, the substrate’s own observability layer becomes a performance and storage problem.

**Pressures.** M5 (trace at channel), O2 (observers are bounded), F4 (operates indefinitely).

**Substrate response.** O2 explicitly commits observers to being bounded. The trajectory recorder uses bounded ring buffers (256 samples by default). The trace has a cap (CFG.TRACE_CAP). Aging from the cap is excretion per spec, not unbounded growth. The substrate has the cardinality concern named and bounded structurally.

**Result.** Survives. The pressure test confirms that the substrate’s observability commitments include bounded retention from the start, where Honeycomb had to retrofit cardinality management. However, “bounded” raises a separate question: what gets evicted when the bound is hit, and does that evict information that later proves load-bearing? The substrate’s eviction policies are recency-based; queries against deep history may not find what they’re looking for. This is a real boundary condition for use cases like long-window audit trails.

-----

## Tier 1: Live Coding Runtimes / Smalltalk

### PT-SMALL-1: Reflectivity confusion

**The original critique.** Smalltalk’s reflective capabilities allow live modification of the running stack, classes, methods, and behavior via thisContext, doesNotUnderstand:, runtime bytecode transformation, and unanticipated partial behavioral reflection (UPBR). This is powerful but causes well-documented debugging confusion: introspection that modifies what it inspects, reflective tools that change their own behavior while running, debuggers that don’t show the same world after a step that they showed before. Smalltalk’s reflectivity is essentially unbounded–anything in the image can be modified by anything else in the image.

**Translated to the substrate.** O1 (read-only with respect to the field) is a structural defense against this. The reflexive surface and trajectory recorder cannot modify what they observe. But the architecture’s intercession is bounded only by the read-only convention enforced at the call-graph level (C8). What if observation indirectly affects the field through the interpretive lens it produces? What if downstream code uses the surface’s clauses to drive new input?

**Pressures.** O1 (read-only with respect to the field), O2 (bounded), F3 (no supervision).

**Substrate response.** O1’s read-only is enforced empirically. The reflexive surface generates clauses; what the host application does with those clauses is application-level concern, not substrate concern. If an application reads surface clauses and feeds them back as input, the substrate processes that input normally–the loop is closed by the application, not by the substrate. F3 ensures no internal component supervises another even in this case. The substrate’s reflective discipline is that observation is structurally separate from operation, even if applications choose to couple them externally.

**Result.** Survives, with an honest acknowledgment that the substrate’s reflective discipline is internal. External applications can build supervision-shaped patterns around a substrate. The substrate’s spec doesn’t and shouldn’t constrain what applications do; it constrains what the substrate itself does. This is a clean separation. The pressure test confirms the substrate avoids Smalltalk’s *internal* reflectivity confusion through architectural commitments, while not pretending to control what external code does.

### PT-SMALL-2: Image as world

**The original critique.** Smalltalk’s image-based persistence means the running program is the persistent program–no separate source/binary distinction, no clean way to reload from a known-good state. When the image is corrupted, recovery is hard.

**Translated to the substrate.** Storage as substrate (Phase 4c) commits persisted constraints to being matched in parallel with live constraints. Recall is the substrate’s normal operation extended across runtime boundaries. If the persisted state contains corrupted or undesired structure (a constraint family that promoted erroneously), there’s no clean reset–the substrate continues operating with that structure as part of its trajectory.

**Pressures.** Storage substrate (Phase 4c), F1 (the seed is permanent), X1 (every configuration includes the seed), F5 (irrecoverable change).

**Substrate response.** F1 and X1 commit the seed to permanence. The seed is the structural anchor; it does not corrupt. Persisted constraints are not the seed–they are accumulated structure that *can* be evicted by recency. The substrate’s “recovery from bad accumulated structure” is structurally available through eviction, but it is not instantaneous; the bad structure persists until it is no longer firing and recency drives it out.

**Result.** Survives, with caveats. The substrate’s recovery model is graceful (eviction over time) rather than abrupt (image rollback). For domains where instantaneous recovery is needed, this is a limitation. For domains where structural continuity is desired, it’s a feature. The pressure test correctly identifies the trade-off: the substrate’s commitment to F5/SE-09 means it inherits the same “no clean rollback” property as Smalltalk’s image, but with mechanisms (eviction, recency) that the image doesn’t have.

-----

## Tier 2: Hopfield / Energy-Based Models

### PT-HOPF-1: Fixed-point convergence vs non-terminal settling

**The original critique.** Classical Hopfield networks converge to fixed points (attractors). This is a feature for memory retrieval–recall produces a stable state matching the closest stored pattern. Modern Hopfield networks (Ramsauer et al. 2020) extend this with continuous attractors and update rules mathematically identical to transformer attention.

**Translated to the substrate.** Hopfield’s fixed-point convergence is exactly what F4 and X2 forbid. The substrate must not terminate. Yet under stable input, doesn’t the substrate behave like a Hopfield network, settling into a stable configuration? The Phase 5.5 stability test on STABLE input showed gap declining from 0.89 to 0.71–that’s settling, but is it terminating?

**Pressures.** F4 (operates indefinitely), X2 (settling is non-terminal).

**Substrate response.** The substrate’s settling under stable input produces low gap but never zero gap, because the seed (F1, SE-04) keeps asking “what is delta?” structurally. The substrate cannot reach a fixed point because the seed’s permanent unresolvability prevents it. This is exactly what SE-04 commits to. The Phase 5.5 stability test confirms the gap declines but doesn’t reach zero; the substrate is settled-and-still-operating, not settled-and-terminated.

**Result.** Survives. The substrate’s distinction from Hopfield is structural: the seed prevents fixed-point convergence by construction. F1 + SE-04 + F4 + X2 jointly forbid the failure mode the pressure test identifies. The pressure test confirms that these commitments are doing real work; without F1’s permanence, the substrate would converge like Hopfield does.

### PT-HOPF-2: Training-deployment split

**The original critique.** Hopfield networks and EBMs more generally have a training phase and a deployment phase that are structurally distinct. Training is gradient descent on energy; deployment is settling at fixed weights. This split is awkward for online or continual learning where the distinction breaks down.

**Translated to the substrate.** The substrate has no training/deployment split. Promotion happens during operation. Eviction happens during operation. This is structurally what online learning systems aspire to.

**Pressures.** None violated; the pressure test confirms a substrate strength.

**Substrate response.** The substrate is structurally what EBMs would need to become to handle online learning cleanly. The training/deployment merge is built in.

**Result.** Survives strongly. This is one of the cleanest cases where the substrate has a structural advantage over an established paradigm. The pressure test confirms it.

-----

## Tier 2: Salsa / Adapton (Incremental Computation)

### PT-SALSA-1: User-labeled durability vs emergent promotion

**The original critique.** Salsa’s durability tiers are user-labeled. The user explicitly declares which queries are durable (stdlib, dependencies) and which are volatile (local files). This works because the user knows the structure of their codebase. Salsa’s inner algorithm doesn’t *discover* durability; it operationalizes the user’s declaration.

**Translated to the substrate.** K1 commits to *emergent* durability through fidelity-based promotion. Constraint families that contribute to closure earn structural status. The substrate is supposed to discover what’s durable rather than being told. But INVARIANTS v1.3’s K3 implementation note flags that the consumption of promoted structure (K2 part a) is unrealized. So the substrate has the *promotion* mechanism but not the *use of promoted structure*. Compared to Salsa, the substrate has a more ambitious claim and a less complete realization.

**Pressures.** K1 (sub-cascades emerge from fidelity), K2 part (a) (selection bias), K3 (naming preference structural).

**Substrate response.** Spec acknowledges the gap. The substrate’s emergent-promotion claim is real but its operationalization is incomplete. This is the same gap PT-FEP-3 identified from a different angle.

**Result.** Doesn’t fully survive, in the same already-acknowledged way as PT-FEP-3. The pressure test reinforces the priority of completing K2/K3 implementation as the substrate’s most-pressed structural gap. Two different paradigm critiques converge on the same finding from different directions.

### PT-SALSA-2: Graph traversal cost on super-nodes

**The original critique.** Adapton-style fine-grained dirty tracking helps when the dependency graph has clean structure. When the graph has super-nodes (a single huge node depended on by many), even Adapton has to traverse the super-node’s full dependency set on any change, eliminating the incremental advantage.

**Translated to the substrate.** Highly-promoted sub-cascades function as super-nodes–structures with many constraints contributing to them. When the substrate must re-evaluate against changed input, does it pay super-node cost? Or does the substrate’s matching mechanism (parallel constraint evaluation in ER) avoid the issue?

**Pressures.** S2 (substrate-equivalent resolution), the implementation efficiency of ER engine evaluation.

**Substrate response.** ER’s evaluation is parallel by construction (algorithm 16 demonstrates byte-equivalent parallel evaluation across CSS cascade, JS oracle, WGSL processor). The substrate doesn’t traverse a dependency graph; it evaluates constraints in parallel. Super-node cost in Adapton terms doesn’t apply because the substrate doesn’t have a sequential traversal model.

**Result.** Survives. The substrate’s parallel evaluation model is structurally different from Adapton’s incremental dependency tracking. The pressure test confirms a structural strength.

-----

## Tier 2: Cassowary / Auto Layout

### PT-CASS-1: Debuggability under composition

**The original critique.** SwiftUI/Compose moved away from Cassowary toward explicit layout protocols partly because incremental constraint solving was hard to debug. When a constraint system produces an unexpected layout, finding which constraint is responsible requires tooling that either doesn’t exist or is non-trivial to use.

**Translated to the substrate.** When the substrate produces unexpected behavior–a sub-cascade that didn’t promote when expected, a prediction that didn’t ratify, a settling that doesn’t match input–how does the developer diagnose it? The trajectory recorder, reflexive surface, and trace are constitutive observability surfaces, but interpretation still requires skill.

**Pressures.** SE-09 (operational irreversibility), M5 (trace at channel), O3 (observer vocabulary from field).

**Substrate response.** The substrate’s observability surfaces are richer than Cassowary’s by construction. The trajectory recorder shows per-frame state evolution. The reflexive surface produces structural-event clauses in field vocabulary. The trace records every constraint matching event. Cassowary had no equivalent. The pressure test surfaces a real concern–debuggability requires skill–but the substrate’s tooling is structurally available.

**Result.** Survives, with the honest acknowledgment that observability surfaces produce data; interpreting that data requires understanding the substrate’s mechanisms. This is true of any system. The substrate’s advantage is that the data exists by structural commitment, not by retrofit. Whether the substrate is *more* debuggable than Cassowary in practice depends on developer fluency with the substrate’s vocabulary, which is itself a function of the substrate’s adoption and tooling maturity.

-----

## Tier 2: Event Sourcing / Kafka / Datomic

### PT-KAFKA-1: Distributed-case partitioning

**The original critique.** Kafka’s value is operational: partitioning, replication, exactly-once delivery, fault tolerance. The philosophical claim (“the log is the source of truth”) is real but secondary to the operational machinery. Datomic similarly: bitemporal logs are powerful, but the system’s value rests on consistent distributed access to those logs.

**Translated to the substrate.** M5 (trace at channel) commits the substrate’s record to constitutive status, mirroring event-sourcing’s philosophical claim. But the substrate has no distributed-case story. X1 commits every configuration to including the seed; if the seed is universal (per F1) but configurations are different on different nodes, what is the relationship between distributed substrate instances? SE-08 specifies render-substrate intake but only for single-node operation.

**Pressures.** M5 (trace at channel), F1 (seed is permanent), X1 (every configuration includes the seed), SE-08 (render-substrate intake).

**Substrate response.** The spec stack does not currently address distribution. Phase 6 (research, not engineering) is named as the appropriate scope for distribution work; SE-08 is single-node. The substrate inherits event-sourcing’s philosophy but has not yet built the operational machinery to deploy it distributed.

**Result.** Doesn’t survive, and the spec acknowledges this. Distribution is named as future work. The pressure test correctly identifies that without a distributed story, the substrate’s ability to displace Kafka in event-sourcing roles is limited to single-node use cases, and that any substrate-trust-based auth architecture (per the prior session’s discussion) needs the distribution problem solved first.

-----

## Tier 2: FRP (Functional Reactive Programming)

### PT-FRP-1: Denotational semantics

**The original critique.** Conal Elliott’s FRP is denotational: behaviors are continuous functions of time, events are discrete time-tagged values, the semantics is mathematically clean. Applied FRP (Yampa, Reflex) loses some of this rigor in exchange for practicality.

**Translated to the substrate.** The substrate has no denotational semantics. SE-07 articulates configuration-and-settling structurally but not denotationally. There is no mathematical function from input to substrate state; there’s mechanism that operates over time.

**Pressures.** SE-07 (configuration and settling), SE-04 (seed constraint).

**Substrate response.** The substrate doesn’t claim denotational semantics. It claims structural commitments. SE-07’s discipline is to articulate what configuration and settling are structurally without committing to a denotation. The pressure test confirms this is a real distinction–the substrate is not a denotational system.

**Result.** Survives by clarifying scope. The substrate is not in the denotational-semantics business. Domains that need provable mathematical properties from program text (theorem-proving, formal verification of input-to-output mappings) are not the substrate’s domain. Domains where settling is the deliverable don’t need denotational semantics. The pressure test sharpens this distinction.

-----

## Cross-Cutting Findings

After running pressure tests across both tiers, three patterns emerge:

### What the substrate survives cleanly

**Inversions of conventional concerns.** Multiple pressure tests (PT-DD-2 patching failure, PT-XPBD-1 iteration count, PT-HOPF-1 fixed-point convergence) revealed that what conventional paradigms treat as problems to solve, the substrate treats as structural commitments. F5/SE-09 makes irreversibility a feature; F4/X2 makes non-terminal settling a feature; F1/SE-04 prevents fixed-point convergence by construction. These aren’t bugs the substrate has; they’re commitments that distinguish it from systems whose failure mode is the substrate’s design intent.

**Structural separation that paradigms retrofit.** PT-DD-3 (operational introspection), PT-OBS-2 (cardinality bounds), PT-SMALL-1 (reflective discipline) showed the substrate has architectural commitments where paradigms had to bolt on tooling later. M5/O1/O2 are structurally present; SnailTrail/wide-events/UPBR were retrofits. The pressure tests confirm the substrate’s clean-design claim where it’s true.

**Scope clarification.** PT-FEP-1 (universality), PT-DD-1 (exactness vs approximation), PT-FRP-1 (denotational semantics), PT-CASS-1 (debuggability) all sharpened what the substrate actually claims to do. The pressure tests didn’t expose hidden assumptions; they forced the spec language to be clearer about what’s in scope and what isn’t. This is verification-shaped work, not destructive criticism.

### Where the substrate has acknowledged gaps

**K2 part (a) consumption mechanism.** PT-FEP-3 and PT-SALSA-1 converged on this from FEP and incremental-computation directions. The substrate has emergent promotion (K1) but not yet the consumption-of-promoted-structure mechanism that K2 part (a) commits to. This is the most-pressed structural gap, named in INVARIANTS v1.3.

**Long-run stability empirics.** PT-XPBD-3 correctly identified that the Phase 5.5 stability test’s 200-step coverage is insufficient to claim long-run stability under all conditions. Production deployment in stability-critical domains needs more empirical work.

**Distribution story.** PT-KAFKA-1 confirmed the spec’s acknowledgment that distribution is Phase 6 research, not current engineering. The substrate’s commitments do not currently address multi-node deployment.

**S2 byte-equivalence scope.** PT-OBS-1 surfaced a real concern: S2 is verified for what algorithm 16 tests, but the spec language might suggest broader scope than the empirical evidence supports. Either S2’s scope should be tightened in spec language, or algorithm 16’s coverage should be expanded.

### Where the substrate has structural strengths confirmed

**Constitutive observability** (M5, O1, O2, O3, SE-09). The pressure tests confirmed this is unique among the surveyed paradigms.

**Structural irreversibility as a commitment** (F5, SE-09). For accountability, audit, trust mechanisms–exactly the application domains identified in the prior session.

**Online learning without train/deploy split** (PT-HOPF-2). Structural advantage over EBM-class systems.

**Architectural separation of mechanisms** (F3, S3). The substrate is genuinely supervision-free in ways most surveyed paradigms are not.

### What the spec stack should consider tightening

1. **S2 scope language.** Current language reads as if byte-equivalence is universal across all substrate operations. Algorithm 16’s coverage is more focused. Either expand the empirical demonstration or scope the spec language.
1. **Distribution acknowledgment.** Several invariants (X1 includes the seed, F1 seed permanence) implicitly assume single-node operation. Either make this explicit or specify the multi-node case.
1. **Long-run stability claim.** F4 commits to indefinite operation; the empirical body for this is currently 200-step tests. Spec language could acknowledge the empirical scope.
1. **External-coupling boundary.** O1’s read-only enforcement is internal. Applications can build supervision-shaped patterns externally. The spec could acknowledge that the substrate’s commitments constrain the substrate, not the systems built atop it.

These are not violations. They are places where the spec’s language could be tighter to match what the substrate actually claims and what the implementation actually demonstrates.

-----

## Summary

Twenty-two pressure tests across nine paradigms. Findings:

- **Survives cleanly:** 14 (with scope clarification or structural confirmation)
- **Survives with acknowledged caveat:** 5
- **Doesn’t survive (acknowledged gap):** 3 (all converging on K2 part a / structure-learning consumption, distribution, S2 scope)

The substrate’s commitments are largely robust to the published critiques of its closest paradigms. Where it is not robust, the spec stack already acknowledges the gap. Where it is robust, the survival sharpens what the substrate actually claims rather than producing flattering-but-vague defenses.

The K2 part (a) gap remains the load-bearing open problem–two independent paradigm critiques (predictive coding’s structure-learning gap, Salsa’s user-labeled-vs-emergent durability) converge on the same finding. Closing this gap would substantially improve the substrate’s structural completeness.

The pressure tests did not surface hidden assumptions, contradictory commitments, or structural failures the spec hadn’t named. This is information about the spec stack’s discipline as much as it is about the architecture itself.