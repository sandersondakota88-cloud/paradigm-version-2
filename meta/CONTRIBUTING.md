# CLAUDE.md - Working Notes for This Repository

This file is read automatically by Claude Code. It encodes the discipline
developed across the design conversations that produced the canonical
reference implementation. Read it before making architectural decisions.

---

## 1. What this project is

EXODUS is a reference architecture for using the browser's CSS cascade as a
constraint-satisfaction runtime. The browser's style engine is a real,
shipping parallel constraint solver; this project proves that by running a
domain application (loan eligibility, 2,880 coordinates, 6 dimensions, 11
constraints) entirely through `setAttribute` / `getComputedStyle`, with zero
JavaScript branching in the resolution path.

The reference implementation is `exodus-canonical.html` - a single
self-contained HTML file. It is 1,819 lines, ASCII-only, zero dependencies,
and has 66 passing tests. **Do not regress these properties.** Specifically:

- Single-file artifact status is load-bearing for the "inspect it in five
 minutes" claim in the project documentation. Do not split it into modules
 without a reason that survives the question "does the inspector still work?"
- ASCII-only source is enforced at runtime by a self-check that refuses to
 boot on violation. This defense has already caught two real bugs where
 em-dashes leaked in from pasted comments.
- 66/66 tests must stay green. If you break one, fix it before moving on.

---

## 2. The three axioms (non-negotiable)

1. **CSS is the client runtime.** The cascade resolves domain logic. Not a
 function, not a switch statement - the cascade.
2. **JavaScript is I/O only.** Permitted operations:
 `setAttribute` (write), `getComputedStyle` (read), `addEventListener`
 (input), DOM mutation for display, IPC message send. If you find yourself
 writing `if (resolved.sdf === "-1") { doLogic() }`, stop. That logic
 belongs in CSS or in the Server.
3. **Server owns geometry and truth.** The server defines dimensions,
 constraints, and the committed row store. It never reads the cascade.

The WebGPU bridge (currently being planned) extends axiom 1: the compute
shader is an *alternate* runtime for the same geometry, not a replacement.
The CSS path remains the canonical reference. GPU output must match CSS
output byte-for-byte over the full state space.

---

## 3. Threat model and defenses (already implemented)

Seven threat classes are defended against in the canonical file. When adding
new code, check each:

| Threat | Defense to use |
|---|---|
| CSS injection via constraint values | `Guards.cssEscapeString` for strings, `requireCssIdent` for names, `requireSafeAttrValue` for attribute values. Applied at every cascade-compile boundary. |
| HTML injection via resolved outputs | `textContent` for all dynamic content. `innerHTML =` is forbidden. |
| Prototype pollution via IPC | `Guards.hasOwn` and `Guards.ownKeys` for any iteration over untrusted objects. Reserved-key rejection names `__proto__`, `constructor`, `prototype` explicitly - do not use object literals for reject sets, they set the prototype. |
| Source pollution (smart quotes, em-dashes) | ASCII-only source. Runtime self-check on load. `grep -P '[\x80-\xFF]'` in pre-commit. |
| Replay/tampering of rows | SHA-256 content-addressing. Merkle root over rows. Hashing is **serialized** through a promise queue so intermediate roots are always over a deterministic prefix. Do not parallelize this. |
| Resource exhaustion | Frozen configs, bounded arrays (probe cap 50k, INJECT cap 10k, row cap 4KB, VSF parse cap 4MB, escape-string cap 512 chars). |
| Arbitrary code execution | No `eval`, no `Function()`, no `setTimeout(string, ...)`, no `innerHTML=`. CSP meta in the HTML head restricts to self + inline. |

New code must not introduce any of these. When in doubt, read the `Guards`
module and use what's there.

---

## 4. Epistemic discipline

The project documentation distinguishes "narrow claims" (new architecture,
working implementation, GPU scaling path) from "wide claims" (computation as
geometry, observer as channel, delta as universal primitive). **In code and
code comments, stay narrow.**

Specifically:

- The Observer module (`delta_IPC` channel fidelity) tracks two
 observed/expected ratios and composes them. The expected sets are
 **chosen**, not derived. The composition rules are **chosen**, not derived.
 Do not let comments or UI labels imply formal content the code isn't
 delivering. The weighted form is the canonical display because it has the
 correct monotonicity for a fidelity metric; the geometric-mean form has a
 documented pathology (collapses to 0 if either direction hits 0, regardless
 of the other direction) and is kept in `state()` for diagnostic use only.
- `SCAN_SPACE` is how the S->C direction's uncertainty collapses to zero. It
 is not a proof of anything about observer asymmetry; it is a batch
 acknowledgment that makes the fidelity metric useful.
- Tests that appear to verify "asymmetry" are verifying the definitions we
 chose. That is still useful - divergence would indicate implementation
 drift - but it is not evidence of deep formal properties.

If you write a comment that sounds like physics or philosophy, ask whether
the code directly implements what you're saying. If not, delete the comment.

---

## 5. Constraint source of truth

`constraints.md` in the repo root is the shared specification read by both
the CSS path (the canonical HTML file) and the coming WebGPU path. Both
implementations pin to its version. A version mismatch in the verification
harness aborts before any runs.

**If you add a constraint, add it in `constraints.md` first, then propagate
to both implementations, then bump the version at the top of the spec.**
Do not edit either implementation's constraint array directly.

---

## 6. What to build next

From `Development_Roadmap` section 11, in dependency order:

- [x] #1 Normalized canonical reference - `exodus-canonical.html`
- [x] #2 Sub-specs referenced by State_Converter - already exist in the skill folder
- [x] #3 delta_IPC materialization - in the canonical file as the Observer module
- [ ] **#4 WebGPU bridge - in progress. See section 7 below.**
- [ ] #5 Narrow-version writeup

Item #4 is the current task. It is substantial enough to be its own file
set, not a one-session edit.

---

## 7. WebGPU bridge (active task)

Goal: resolve the 2,880-point state space as a WGSL compute shader, verify
byte-identical output against the CSS cascade path.

### Proposed file layout

```
/exodus-canonical.html existing, do not modify without reason
/constraints.md shared spec, read-only for implementations
/gpu/
 README.md setup, how to run
 index.html minimal host page, WebGPU adapter check
 gpu-path.js device/pipeline/bind-group setup + dispatch
 compile-constraints.js constraints.md parser -> postfix-encoded
 instruction buffer
 resolve.wgsl the compute shader
 harness.js verification: runs CSS path and GPU path,
 diffs byte-for-byte over all 2,880 coords
 package.json only dev deps: a test runner, serve
/test/
 gpu-roundtrip.test.js the regression test
```

### Instruction encoding

Constraints compile to a postfix sequence of `u32` instructions. Proposed
opcodes (bit-packed: 8-bit op, 8-bit operand-a, 8-bit operand-b, 8-bit reserved):

```
OP_MATCH_DIM op=0x01 a=dim_index b=value_index
OP_AND op=0x02 (pops 2, pushes AND)
OP_BEGIN_THEN op=0x10 (start of then-block)
OP_SET_SDF op=0x11 a=sdf_sign (0 for -1, 1 for 1)
OP_SET_RT op=0x12 a=rt_table_index
OP_SET_RTH op=0x13 a=rth_value
OP_SET_DOC op=0x14 a=doc_table_index
OP_SET_REG op=0x15 a=reg_table_index
OP_SET_DENY op=0x16 a=deny_table_index
OP_END_RULE op=0xFF (commit or discard)
```

The WGSL shader is a stack machine: each invocation evaluates the instruction
buffer for its assigned coordinate, maintaining a small boolean stack and an
output record. One workgroup of 64 threads processes 64 coordinates; 45
workgroups cover the full 2,880 space.

### Verification

After both paths run, the harness asserts:

1. Both paths emit exactly 2,880 output records.
2. For each coordinate, all six output fields match.
3. No CSS output string is missing from the canonical table.

Any mismatch is a bug, never "close enough."

### Pitfalls to watch for

- **WGSL has no recursion.** The instruction-evaluation loop must be
 bounded at compile time. Fix the instruction buffer length as a pipeline
 constant.
- **String comparison must go through interning tables.** GPU writes indices;
 CSS returns strings. The harness maps one to the other via the tables in
 `constraints.md` section 5. Do not compare strings directly.
- **The CSS cascade applies rules by specificity, then source order.** The
 WGSL shader must replicate this, not "apply in array order." Sort the
 compiled instruction buffer by `|when|` ascending (fewer keys first) before
 emitting, so the natural evaluation order = CSS specificity order.
- **`sdf=1` implies `reg=DENIED, rth=0` - derived, not declared.** Both
 paths must implement this derivation. Do not try to list it as an
 instruction; it is post-processing.

### When the harness is green

- Extract the CSS path's `Client.probe` to share the probe element layer with
 the harness. The canonical HTML file currently owns this; factor out if
 needed, but do not modify the canonical file until the GPU path is proven.
- Add the WGSL path to the canonical file as an optional runtime behind a
 feature flag. Until then, keep it separate.

---

## 8. Working conventions

- Tests first when fixing bugs; otherwise test-along. The 66 existing tests
 are organized by threat class and should stay that way.
- Defense-in-depth over clever single-point fixes. If the same check exists
 at the server boundary and in the compiler, keep both.
- Comments explain why, not what. `// increment i` is noise. `// must hash
 in commit order to keep intermediate Merkle roots deterministic` is useful.
- If you catch yourself writing a comment that sounds like philosophy, see section 4.
- Grep before writing. `Guards.cssEscapeString` already exists; do not write
 a new escaper with the same contract.

---

## 9. Things that look like problems but aren't

- **Off-screen positioning instead of `display:none` on probe elements.**
 This is deliberate. Custom properties may not resolve correctly on
 `display:none` elements in all engines. `position:absolute; left:-9999px`
 is the right answer; it's in layout, it just isn't visible.
- **`'unsafe-inline'` in the CSP.** The style tag and script tag are inline
 because the artifact is single-file. `'unsafe-inline'` is scoped to this
 file's own content; the `default-src 'none'` prevents anything external.
 This is a deliberate tradeoff for the single-file constraint.
- **`innerHTML` appearing in grep results.** Every occurrence is in comments
 that explain why we don't use it. Verify with `grep -E '\.innerHTML\s*='`
 which matches assignments specifically.

---

## 10. If you're unsure

Read these in order before asking:

1. `exodus-canonical.html` top comment block - architecture and threat model
2. `constraints.md` - what the domain is
3. `/mnt/skills/user/vsf-exodus-spa/SKILL.md` and its `references/` - the
 pattern as it was originally specified
4. `Development_Roadmap` - the anchor claims and what's been built

Then ask. Do not guess at architectural questions.
