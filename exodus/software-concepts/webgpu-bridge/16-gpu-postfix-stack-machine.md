# 16 - GPU Postfix Stack Machine + SDF CSG

**Status:** PROPOSED. Target of TODO #4. Specification is research-
validated and detailed enough to build directly from.
**Primary origin:** `Encoding_Computation_as_Geometry_for_GPU-Parallel_Resolution.md`
**Secondary origin:** `Development_Roadmap` scaling table,
`constraints.md` section 5 (canonical string tables)
**Implemented in:** nothing yet; will live in `gpu/` subdirectory
when built

---

## Narrow-claim scope

A WebGPU compute shader that resolves the same constraint geometry
as the CSS cascade, reading a postfix-encoded instruction buffer
and writing per-coordinate output records. Byte-identical output
against the CSS cascade path is the correctness contract.

This is the **vertical scaling proof** for the architecture: if the
GPU path produces bit-identical output over the full state space,
then the constraint geometry is the primary artifact and the
execution substrate is interchangeable.

## Specification

### Input buffers (read-only storage)

```
struct Constants {
 state_space_size: u32, # 2880 for the loan domain
 instruction_count: u32,
 stack_depth_max: u32, # typically 16-64
 dim_count: u32, # 6
 # ... string table sizes, etc ...
}

instructions: array<u32>
 # Postfix-encoded constraint program.
 # Each u32: [opcode:8, operand_a:8, operand_b:8, reserved:8]

dim_table: array<u32>
 # Packed [dim_index:8, cardinality:8, reserved:16] per dim
```

### Output buffer (read-write storage)

```
struct Output {
 sdf: i32, # -1 or 1
 rt: u32, # index into rt_table
 rth: u32,
 doc: u32, # index into doc_table
 deny: u32, # index into deny_table
 reg: u32, # index into reg_table
}

outputs: array<Output> # one per coordinate
```

### Instruction set

Small, closed opcode set that the constraint compiler targets:

```
OP_MATCH_DIM 0x01 a=dim_index b=value_index
 # Push 1 if coord[a] == b else 0

OP_AND 0x02
 # Pop two, push (top & next)

OP_BEGIN_THEN 0x10
 # Marks start of then-block. Pops condition; if 0, skips to next
 # OP_END_RULE; if 1, continues.

OP_SET_SDF 0x11 a={0,1} # 0 for -1, 1 for +1
OP_SET_RT 0x12 a=rt_index
OP_SET_RTH 0x13 a=rth_value
OP_SET_DOC 0x14 a=doc_index
OP_SET_REG 0x15 a=reg_index
OP_SET_DENY 0x16 a=deny_index

OP_END_RULE 0xFF # end of one constraint; return to default path
```

### Shader structure

```wgsl
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
 let coord_index = gid.x;
 if (coord_index >= constants.state_space_size) { return; }

 # Decode coord from coord_index using dim_table cardinalities
 var coord: array<u32, MAX_DIMS>;
 unpack_coord(coord_index, &coord);

 # Initialize output to defaults
 var out: Output = Output(-1, 0, 0, 0, 0, 0); # default rt=UNCLASSIFIED, etc.

 # Stack for condition evaluation
 var stack: array<bool, STACK_DEPTH_MAX>;
 var sp: u32 = 0u;
 var skipping: bool = false;

 var pc: u32 = 0u;
 loop {
 if (pc >= constants.instruction_count) { break; }
 let inst = instructions[pc];
 let op = inst & 0xFFu;
 let a = (inst >> 8u) & 0xFFu;
 let b = (inst >> 16u) & 0xFFu;

 if (skipping) {
 if (op == OP_END_RULE) { skipping = false; }
 pc = pc + 1u;
 continue;
 }

 switch op {
 case OP_MATCH_DIM: {
 stack[sp] = (coord[a] == b);
 sp = sp + 1u;
 }
 case OP_AND: {
 stack[sp - 2u] = stack[sp - 2u] && stack[sp - 1u];
 sp = sp - 1u;
 }
 case OP_BEGIN_THEN: {
 sp = sp - 1u;
 if (!stack[sp]) { skipping = true; }
 }
 case OP_SET_SDF: { out.sdf = select(-1, 1, a == 1u); }
 case OP_SET_RT: { out.rt = a; }
 case OP_SET_RTH: { out.rth = a; }
 case OP_SET_DOC: { out.doc = a; }
 case OP_SET_REG: { out.reg = a; }
 case OP_SET_DENY:{ out.deny= a; }
 case OP_END_RULE:{ } # just advance
 default: { }
 }
 pc = pc + 1u;
 }

 # Derive sdf=1 implies reg=DENIED, rth=0
 if (out.sdf == 1) {
 out.reg = reg_DENIED;
 out.rth = 0u;
 }

 outputs[coord_index] = out;
}
```

### Dispatch

```
workgroup_count = ceil(state_space_size / 64)
 = ceil(2880 / 64) = 45
```

One compute pass covers the full space.

## Why postfix

Postfix order eliminates recursion. Each coordinate walks the
instruction buffer once, maintaining a small condition stack. WGSL
does not support recursion, so recursion-free evaluation is the only
viable GPU strategy.

The `Encoding_Computation...md` origin document documents this pattern
as the standard for GPU expression evaluators across the literature:

- Langdon & Banzhaf 2008 SIMD GP interpreter: **895 million GP ops/sec**
 on GPU.
- By 2010: **665 billion GP ops/sec** on CUDA SIMT.
- EvoGP (Wang et al., 2025): **140x speedup** via tensorized encoding.

For the loan domain's 2,880 coords and ~11 constraints, throughput is
not the bottleneck; correctness and warp coherence are.

## Rule ordering

The CSS cascade orders rules by specificity (more `[data-x]` = higher
specificity wins). The GPU path must match this order. Strategy:
sort the compiled instruction buffer by `|when|` ascending, so less-
specific rules appear first and more-specific rules (which override)
appear later. Each rule's effects accumulate into the output record;
later effects win.

## SDF CSG correspondence (for continuous extension)

The binary `sdf` field is a stand-in for a continuous signed-distance
field. On the GPU, CSG composition of SDFs gives boolean logic over
spatial membership:

```
Union (A OR B) : min(a, b)
Intersection (A AND B): max(a, b)
Complement (NOT A) : -a
Subtraction (A AND NOT B): max(a, -b)
```

This is equivalent to boolean logic at the sign level (union's sign
is negative iff either input is; intersection's sign is negative iff
both are). With continuous magnitudes, you also get "how deep inside"
and "how far outside," which binary `sdf` discards.

The current CSS cascade uses `-1/+1`. The GPU path could use
continuous SDFs with CSG and recover an implementation that grades
constraint satisfaction rather than just classifying it. This is a
research extension, not a requirement.

## Verification contract (from constraints.md section 6)

1. Both paths (CSS cascade, GPU shader) produce exactly 2,880 output
 records.
2. For every coord, all six output fields match.
3. No CSS output string is missing from the canonical tables in
 `constraints.md` section 5.
4. Runtime targets (soft, not correctness conditions): CSS path
 under 20 ms, GPU path under 5 ms once warm.

**Divergence is always a bug. Never "close enough."**

## Pitfalls (from `CLAUDE.md` section 7)

- WGSL has no recursion. Instruction loop must be bounded at
 compile time.
- String comparison must go through interning tables. GPU writes
 indices; CSS returns strings. Harness maps one through the canonical
 tables to compare.
- Cascade specificity ordering must be replicated in the emit order.
- `sdf=1` implies `reg=DENIED, rth=0` is a derivation, not a stored
 rule. Both paths implement it the same way.

## Dependencies

- WebGPU available in browser (Chrome 113+, Safari 26+, Firefox 141+
 per the `Encoding_Computation...md` origin).
- Shared `constraints.md` as source of truth. Both paths pin to its
 version.
- The canonical file exports its `constraints` array in a form the
 GPU path can read (or the GPU path parses `constraints.md`
 directly).

## Wide-claim scope

The origin document frames this as "computation encoded as geometry" -
a general claim that all computation can be flattened to GPU buffers
and resolved as parallel field evaluation. That claim is supported by
prior art across physics engines, SAT solvers, model checkers,
neural fields, and cellular automata.

The narrow fact the VSF project needs is much smaller: **the same
constraint geometry that compiles to a CSS cascade also compiles to
a postfix instruction buffer, and both produce identical output.**
That alone is a significant result; it proves the geometry is
substrate-independent, which is the thesis.

The wider framing about computation being "always already geometric"
is not something the GPU path alone can settle.

## Related algorithms in this catalog

- `04-constraint-compilation.md` - the CSS path this parallels
- `06-parallel-probe-array.md` - the current substrate for full-
 space resolution
- `07-vessel-dom-bfs.md` - what the 3D texture sampling would
 replace at scale
- `11-vsf-binary-encoding.md` - natural fit for GPU buffers
