# P1: CRM Domain Model

**Layer:** Phase 8, Layer P1
**Status:** Specification - the dimensional definition that P2-P9 build constraint geometry against
**Spec anchor:** SE-11 (Dimensional Resolution)

-----

## 0. What this document is

This document is design work, not code. It identifies the dimensions
across which a CRM's constraint geometry resolves, in the
substrate-paradigm sense:

-  **Deterministic dimensions** - finite-domain coordinate axes that
   cascade rules match against (per algorithm 09's VSF header triads).
-  **Probabilistic dimensions** - text-typed input that arrives at
   the SE-08 contributor pathway and is matched by pattern-based
   cascade rules.
-  **Relational dimensions** - foreign-key-style coordinate
   references between records.
-  **Temporal dimensions** - continuous-typed time coordinates
   (the time adapter's contributions land here).
-  **Aggregate dimensions** - derived coordinates that result from
   set operations over the field's records; structural, not primitive.

The output is the joint coordinate space P2-P9 build against.

The model is deliberately bounded to what a substrate-paradigm
CRM needs structurally; it does not enumerate every field a
conventional CRM database would have. It enumerates the
coordinate axes the constraint geometry resolves over.

-----

## 1. Scope

### 1.1 What the demonstration CRM does

A small but realistic CRM with three core record types and the
normal CRM operations against them:

-  **Contact** - a person we sell to.
-  **Account** - an organization (a contact may belong to one).
-  **Deal** - a sales opportunity attached to a contact and account.

User-facing operations:

-  Create / update / soft-delete contacts, accounts, deals.
-  Move deals through stages (lead -> won/lost).
-  Search contacts by name, email, company.
-  Filter deals by owner, stage, account.
-  See a per-account "deals + contacts" view.
-  See a per-user "my deals" dashboard.
-  Reports: deals-by-stage, deals-by-owner, monthly closed-won.

Multi-user: several users share the data; updates by user A
visible to user B in another tab/session at network rate (P4 + P9).

Auth: simple role-based (admin / manager / rep / viewer) with
admin-only operations like user management (P2).

Persistence: substrate-media artifacts at content addresses (P3 + M3).
No separate database.

### 1.2 What the demonstration CRM does NOT do

Bounded to keep the forcing function honest:

-  No marketing automation, no email sequences, no workflow designer
   beyond P5's structural workflow primitive.
-  No phone integration, no calendar sync.
-  No reports beyond the three named.
-  No bulk import / export beyond substrate-media artifact replay.
-  No third-party integrations beyond what a network adapter's
   chain link would naturally provide.

The point is to exercise the substrate primitives across a
realistic-enough application that conventional-stack subsystems
collapse where the wide claim says they should. Not to ship a
production CRM.

-----

## 2. Operating frame: dimensions, not entities

A conventional CRM model would say "Contact has fields name,
email, status, owner, ..." That framing is sequential: it puts
each entity on its own table and reasons about it as a row.

The substrate framing is dimensional. Each named axis below is
a coordinate dimension. A "Contact" is not a row; it is a region
of the joint coordinate space where the contact-identifying
coords are pinned and other coords describe the contact's state.
Equivalently: the contact's identity is a coord pin; the
contact's properties are coords with labeled values; the contact
record is the cross-section of the field at that pin.

This matters because:

-  Cascade rules match against coord patterns, not against
   entity types.
-  Updates to a contact are coord writes; they modulate the
   field; F5 commits the change irrecoverably.
-  Persistence (P3) stores the field's substrate-media artifact;
   the contact's identity is its content address inside that
   artifact, not its row id in a table.

Per SE-11, the structure that survives is structure stable
across multiple dimensions. A contact's identity stays consistent
across {identifier, name, email, account-membership} - that
multi-axis stability is what makes it a structural entity, not
a row id assigned at insert time.

-----

## 3. Identifying dimensions

Identifying coords pin a region of the coordinate space. They
are not constraint axes (their value sets are unbounded
identifier strings); cascade rules do not match on identifying
coords other than for presence checks.

### 3.1 Record identifiers

|Coord            |Type                        |Value set            |Notes|
|-----------------|----------------------------|---------------------|-----|
|`contact_id`     |string (content-addressed)  |unbounded            |Hash of identifying properties at creation|
|`account_id`     |string (content-addressed)  |unbounded            |Hash of identifying properties at creation|
|`deal_id`        |string (content-addressed)  |unbounded            |Hash of identifying properties at creation|
|`user_id`        |string                      |unbounded            |From auth provider; opaque to CRM|

Identifying coords are content-addressed per algorithm 13. The
contact_id of a contact is the hash of the contact's identity
properties at creation time (canonical form). This means:

-  Two depositions of the application converge on the same
   contact_id given the same identifying input.
-  Identifying-property changes do not re-id a contact; identity
   coords are pinned at creation per F5 (operationally
   irreversible).

### 3.2 Session identifier (transient)

|Coord                |Type     |Value set                     |
|---------------------|---------|------------------------------|
|`session_id`         |string   |unbounded; per active session |

Session_id pins the substrate instance per M1. Multiple instances
in the same browser process do not share session_id; each instance
has its own at boot.

-----

## 4. Deterministic dimensions

These are the coord axes cascade rules match against. Each is
declared in algorithm 09 VSF triad form:
`name:label0=0,label1=1,...|min|max`

### 4.1 Contact lifecycle

```
contact_status:lead=0,prospect=1,qualified=2,customer=3,churned=4|0|4
contact_engagement:cold=0,warm=1,hot=2|0|2
contact_consent:none=0,marketing=1,full=2|0|2
```

Cascade rules over these axes:

-  Marketing-only operations gated by `[data-contact-consent="marketing"]`
   or `[data-contact-consent="full"]`.
-  "Hot leads" surface produced by `[data-contact-engagement="hot"]
   [data-contact-status="lead"]`.

### 4.2 Deal lifecycle

```
deal_stage:discovery=0,qualified=1,proposed=2,negotiation=3,won=4,lost=5|0|5
deal_priority:low=0,medium=1,high=2,critical=3|0|3
deal_health:on-track=0,at-risk=1,stalled=2,blocked=3|0|3
```

Stage progression rules (P5: predictive constraints will reach
toward stage advancement when characteristic gaps appear):

-  `[data-deal-stage="proposed"][data-trigger="advance"]
   { --next-op: "advanceToNegotiation" }`
-  `[data-deal-stage="negotiation"][data-trigger="advance"]
   { --next-op: "advanceToWon" }` (with auth gate)
-  `[data-deal-stage="won"][data-deal-stage="lost"]
   { --field-error: "deal-already-closed" }` (impossible co-occurrence)

### 4.3 Account tier

```
account_tier:free=0,basic=1,pro=2,enterprise=3|0|3
account_health:active=0,churn-risk=1,churned=2|0|2
```

Tier-gated rules:

-  Bulk-operation rules match `[data-account-tier="pro"]
   [data-account-tier="enterprise"]`.

### 4.4 Identity / authorization

```
user_role:admin=0,manager=1,rep=2,viewer=3|0|3
session_validity:valid=0,expired=1,none=2|0|2
```

Auth as cascade (P2): `[data-session-validity="valid"]
[data-user-role="admin"][data-target="user-edit"]
{ --next-op: "openUserEditor" }`. Without the role match, the rule
does not fire; no operation is dispatched.

### 4.5 Form / UI state

```
form_validity:valid=0,partial=1,invalid=2|0|2
ui_pane:list=0,detail=1,edit=2,report=3|0|3
search_active:false=0,true=1|0|1
```

These are transient, form-driven coords (P8). Cascade rules
disable submit when form_validity is invalid; surface field
errors when partial.

-----

## 5. Probabilistic dimensions

Text-typed input arrives via the K2 sensor adapter (keyboard) and
host-info adapter (URL params, cookie state). Each text field has
a coord whose value is the user-typed text and a derived
validation coord (boolean) computed by a cascade rule with a
pattern matcher.

### 5.1 Per-record text properties

|Coord                       |Type   |Notes|
|----------------------------|-------|-----|
|`contact_name`              |string |Free text; bounded to 200 chars|
|`contact_email`             |string |Bounded; pattern-validated|
|`contact_phone`             |string |Bounded; pattern-validated|
|`company_name`              |string |Free text|
|`deal_description`          |string |Bounded; longer (1000 chars)|
|`account_billing_country`   |string |Bounded; ISO-3166 list|

### 5.2 Validation coords (derived)

|Coord                   |Cascade rule pattern|
|------------------------|--------------------|
|`contact_email_valid`   |`[data-contact-email]:not([data-contact-email-pattern="match"]) { --contact-email-valid: "0" }`|
|`contact_phone_valid`   |Pattern over E.164-compatible inputs|
|`form_validity`         |Aggregate over per-field _valid coords|

Pattern matching is cascade-based (P8): the validation logic is
constraint geometry, not application code.

### 5.3 Search

|Coord            |Type   |Notes|
|-----------------|-------|-----|
|`search_query`   |string |Transient; length-bounded|
|`search_target`  |label  |One of: contacts, deals, accounts|

Search is not a separate subsystem. Cascade rules that combine
`[data-search-active="1"]` with text-pattern coords resolve to
filtered-list rendering rules. The "search index" is the field's
coord state; search operates by cascade over present text coords.

-----

## 6. Relational dimensions

Records reference one another by identifying coords. Relational
coords are coords whose VALUE is another record's id. The
constraint geometry treats them as scalars; cascade rules match
on equality.

|Coord                          |References|
|-------------------------------|----------|
|`contact_account_id`           |account_id|
|`deal_contact_id`              |contact_id|
|`deal_account_id`              |account_id (denormalized; cached for cascade)|
|`deal_owner_id`                |user_id|
|`account_primary_contact_id`   |contact_id|

Per S1, these references do not introduce ownership: an
account does not own its contacts; both are field state at
their respective identifying pins. The relational coord is a
cross-reference, not a containment.

Cascade rules over relational coords:

-  Per-account view: `[data-pane="account-detail"]
   [data-account-id="$current"][data-deal-account-id="$current"]
   { --in-account-view: "1" }`. The cascade resolves which deals
   match the current account.
-  Owner-filtered list: `[data-pane="my-deals"]
   [data-user-id="$current"][data-deal-owner-id="$current"]`.

Variable references (`$current`) are predictive constraint
binding (P5 / SE-05): the cascade reaches for the current
session's pinned values.

-----

## 7. Temporal dimensions

The K2 time adapter publishes `time-now` and `time-perf` records.
These project to coord state on the field's state element. CRM
records carry temporal coords whose values are time-now stamps:

|Coord                       |Source|
|----------------------------|------|
|`contact_created_at`        |time-now at create operation|
|`contact_updated_at`        |time-now at update operation|
|`contact_last_activity_at`  |time-now at last interaction|
|`deal_created_at`           |Same|
|`deal_updated_at`           |Same|
|`deal_closed_at`            |time-now at stage=won or stage=lost|

Temporal cascade rules:

-  Stale-deal warning: `[data-deal-stage="proposed"]:not([data-deal-
   updated-at-recent="1"]) { --deal-health: "stalled" }`.
   The "_recent" derived coord comes from another cascade rule
   that compares `data-deal-updated-at` to the current `data-time-now`.
-  P5 predictive: when a deal's `updated_at` falls far behind
   `time-now`, the field's vector-delta diverges; predictive
   reaching generates a "follow-up needed" constraint.

Temporal coords are continuous-typed (algorithm 09 reserves
the trailing triad for continuous dimensions). The kernel's
delta channel reads them; cascade rules match on derived
boolean coords.

-----

## 8. Aggregate dimensions

These coords are not primitive. They arise from set operations
over field records. The cascade evaluator computes them; they
are then matchable like any other coord.

|Coord                          |Computed from|
|-------------------------------|-------------|
|`account_deal_count`           |Count of records where `deal_account_id` matches|
|`account_total_deal_value`     |Sum of deal_value where deal_account_id matches and deal_stage in {won}|
|`user_contact_count`           |Count of records where `contact_owner_id` matches|
|`user_open_deals`              |Count of deals owned by user with stage in {discovery, qualified, proposed, negotiation}|
|`pipeline_won_this_month`      |Count of deals where `deal_stage="won"` AND `deal_closed_at` in current month|

Aggregates are derived constraints per SE-04 (the seed reaches
for stable invariants); the kernel's metabolism (SE-02)
periodically refreshes them.

-----

## 9. Joint coordinate space

The CRM's joint coordinate space is the cross-product of all
dimensions enumerated in sections 3-8. Concretely, the field's
state at any moment is:

```
field_state = {
  // Identifying pins (per record)
  contacts: { <contact_id>: { ...coords for that contact } },
  accounts: { <account_id>: { ...coords for that account } },
  deals:    { <deal_id>:    { ...coords for that deal } },

  // Session-pinned coords
  session: {
    user_id, user_role, session_validity,
    ui_pane, search_active, search_query,
    form_validity, ...,
    time_now, time_perf  // updated by time adapter
  },

  // Aggregates (derived per metabolism cadence)
  aggregates: { ...coords from section 8 }
}
```

The bridge projects session coords + the currently-focused
record's coords onto the substrate state element's data-* attrs
each tick. Cascade rules match against that projection. Per S2,
the cascade resolves byte-identically across CSS, postfix,
oracle, and kernel substrates.

-----

## 10. How P2-P9 build against this model

|Layer|What it adds|Dimensions touched|
|---|---|---|
|P2 (auth)         |Identity adapter publishes `user_id`, `user_role`, `session_validity`. Cascade gates ops by role.|user_role, session_validity|
|P3 (persistence)  |Substrate-media artifact records the joint state at SE-02 metabolism cadence. Hydrate restores state.|All; the artifact IS the state|
|P4 (real-time)    |M2 chain link emits the metabolism artifact across the network. Receiving substrate integrates as SE-08 contributor records.|All; per-coord delta carried in artifact rows|
|P5 (workflow)     |Predictive constraints (SE-05) reach toward expected next operations when vector-delta diverges. "Stalled deal" follow-up is one such reaching.|deal_stage, deal_updated_at, deal_health|
|P6 (reports)      |O-class observers read field state, produce aggregates, do not write back. Observer surfaces are particular cascade rules with no `--next-op` emission.|aggregate dimensions (sec 8)|
|P7 (undo)         |Trajectory codec replay (Phase 5.7) navigates the recorded history. Replay restores state; new operations branch.|All; trajectory-snapshotted|
|P8 (forms)        |Form fields are transient coords. Validation cascade rules produce derived `_valid` coords. Per-field error rendering matches `_valid="0"`.|form_validity + per-field text + per-field _valid|
|P9 (multi-user)   |Each user's session is an M1 substrate instance. Inter-instance coupling is M2 chain composition over network. Field convergence is the field's normal F5 deposition of arriving SE-08 contributor records.|All; cross-instance via M2|

P2-P8 do not invent new dimensions. They build constraint
geometry over the dimensions defined in sections 3-8. P9 is
the integration test of M1 + M2 + everything else.

-----

## 11. Open questions

These are deliberately surfaced rather than glossed over.

### 11.1 How rich is "predictive" in P5?

The plan says SE-05's vector-delta divergence triggers
predictive reaching. For a CRM, "stalled deal" is the canonical
example. But what's the gap shape exactly? The field's
fast/slow delta diverging in `deal_updated_at` is detectable;
turning that into a *specific* predictive constraint with a
`when` clause that matches "user took follow-up action" is
where the structural specification meets the domain for the
first time. P5's session estimate (5-8 sessions) is for this.

### 11.2 How does aggregate computation respect F3?

Aggregates are recomputed at SE-02 metabolism cadence per
section 8. The kernel's metabolism is one substrate; aggregate
computation is another (it reads field state, writes derived
coords back). Does that violate F3 (no command path)? No -
aggregates are a *cascade* over field state; the computation is
constraint resolution, not a command. But the wiring needs to
be careful: the aggregate observer does not call the cascade
evaluator; the cascade evaluator's normal pass produces the
aggregate coords as derived state.

### 11.3 What's the conflict-resolution protocol for P9?

Per the plan: "conflict resolution is the field's normal
operation (F5 deposits all contributions; the field's state at
any moment reflects the integrated history)." That's true
structurally, but for user-visible semantics in a CRM ("Alice
and Bob both edited the same deal at the same time; whose value
shows?"), the field's state-at-a-moment is the integrated
result of *both* contributions in their arrival order at this
instance. Two instances seeing the same contributions in the
same order converge; instances that see them in different orders
do not (without some causality framing). SE-10 chain semantics
provides ordering at the chain level; whether that's enough for
the user-visible semantic depends on the chain topology. P9
will need to surface this concretely.

### 11.4 What's the SE-02 metabolism cadence for the CRM?

Per Phase 5.5, metabolism happens at a configurable cadence.
For a CRM, "every 100 ms" is too aggressive (the field's
substrate-media artifact emission rate would saturate the chain
links); "every 10 s" is too slow (real-time updates would lag).
A reasonable starting point is "on operation completion + every
1 s," but the right answer depends on observed system behavior
under P4 + P9. The number is empirical.

### 11.5 How does the aggregate dimension list evolve?

Section 8 lists five aggregates. A real CRM accumulates many
more over time (deals-by-month, win-rate-by-rep,
average-deal-cycle, etc.). Are these all primitive aggregate
coords, or are some compositions of others? The dimensional
model should answer this systematically; sec 8 is a starting
point, not a closed set.

-----

## 12. What this document does not commit to

-  Specific UI layout, color palette, or visual design.
-  Specific cascade rule syntax beyond the examples shown.
-  Specific metabolism cadence (sec 11.4).
-  Specific predictive constraint patterns for P5 (sec 11.1).
-  Specific conflict-resolution semantics for P9 (sec 11.3).
-  Wire format for M2 chain links beyond what the M2
   verifier already establishes.

The model is the dimensional foundation; design choices live
in the implementing layers.

-----

## 13. What a P1 reader should take away

A CRM in the substrate paradigm is a coordinate space, not an
entity-relationship diagram. Records are pinned regions of the
joint coordinate space; properties are coords; updates are coord
writes; queries are cascade resolutions; aggregates are derived
coords; multi-user coupling is SE-10 chains carrying coord
deltas; persistence is substrate-media artifact recording.

P2-P9 build constraint geometry over the dimensions enumerated
here. None of them invent new dimensions; they all express CRM
semantics as cascade rules over the joint coordinate space.

The forcing function is whether this works. If a conventional-
stack subsystem the wide claim predicts collapses (auth API,
ORM, query layer, validation framework, real-time protocol,
state management library) does *not* collapse here, the wide
claim is wrong on this fixture and we learn something specific.

P2 is next.

-----

**Status:** Specification complete. Ready for P2.

**Sessions used for P1:** 1 (vs plan estimate 2-3).
The savings come from grounding in already-mature spec primitives
(SE-08, SE-11, algorithm 09, algorithm 13) rather than designing
de novo.
