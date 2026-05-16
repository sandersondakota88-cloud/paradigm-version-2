# 12 - Synchronous Logged IPC

**Status:** IMPLEMENTED.
**Primary origin:** `server-patterns.md` in the skill folder
**Secondary origin:** `State_Converter.MD` axiom 2, `Development_Roadmap`
defense item 5
**Implemented in:** `exodus-canonical.html` IPC module
**Tests:** exercised by every test that involves a server message

---

## Narrow-claim scope

A synchronous, typed, logged message bus between Client and Server,
running inside a single JavaScript context. All messages are
function calls; all responses are returned values. No promises at the
channel layer (the async hash+merkle path is separate). Every IN/OUT
traversal of the channel is logged with a direction tag and type
label.

## Specification

### Message shape

```
message ::= { type: string, ...payload }
response ::= { type: string, ...payload }
 | { type: "ERROR", msg: string }
```

Every message carries a `type` string. Payload fields vary by type.

### Channel interface

```
IPC.send(msg) -> response # synchronous
IPC.onPostCommit(fn) # async listener for commit completion
IPC.logEvent(cls, text) # arbitrary log emission
```

### Dispatch

```
function send(msg):
 log("in", msg.type)
 try:
 response = Server.handleMessage(msg)
 catch e:
 response = { type: "ERROR", msg: "Server threw: " + e.message }
 log("out", response.type, msg=response.msg if ERROR)
 Observer.onResponse(msg, response)
 if response.type == "COMMIT_ACK":
 hashAndCommit(response.index, response.row)
 elif response.type == "INJECT_ACK":
 for new_row in response.newRows:
 hashAndCommit(new_row.index, new_row.row)
 return response
```

## Message types (complete list from Server.handleMessage)

| Type | Direction | Payload | Response type |
|---|---|---|---|
| `CONNECT` | C -> S | none | `CONNECTED` |
| `NAV_SET` | C -> S | `{ dim, val }` | `NAV_ACK` |
| `PROB_INPUT` | C -> S | `{ code }` | `PROB_ACK` |
| `PROB_BACKSPACE` | C -> S | none | `PROB_ACK` |
| `PROB_CLEAR` | C -> S | none | `PROB_ACK` |
| `OBSERVE` | C -> S | `{ sealed }` | `OBSERVATION` |
| `COMMIT` | C -> S | `{ cascadeResult }` | `COMMIT_ACK` |
| `SET_HASH` | internal | `{ index, hash }` | `HASH_ACK` |
| `SET_MERKLE` | internal | `{ root }` | `MERKLE_ACK` |
| `INJECT_ROWS` | C -> S | `{ rows }` | `INJECT_ACK` |
| `SCAN_SPACE` | C -> S | `{ results }` | `SCAN_ACK` |

All other types return `ERROR`.

## Why synchronous

The server is in-process. There is no network, no worker thread, no
process boundary. Synchronous dispatch:

1. **Preserves call-site reasoning.** Callers get responses back in
 the same stack frame; test assertions can follow immediately.
2. **Eliminates races at the server boundary.** There is no ordering
 ambiguity between messages.
3. **Makes logs useful.** IN and OUT entries appear in the log in the
 exact order they occurred, serialized by the JavaScript event loop.

When the hash+merkle post-processing requires real async (crypto.subtle
is promise-based), it runs THROUGH the channel (via
`Server.handleMessage({type:"SET_HASH"})` and similar), but it does so
serially through a promise queue (see algorithm 13). The channel
interface itself stays synchronous from the caller's perspective.

## Logging

Four log classes:

- `ipc-in` (blue): message sent TO server
- `ipc-out` (green): response received FROM server
- `ipc-mut` (amber): mutation event (hash completion, export, etc.)
- `ipc-obs` (purple): observer event
- `ipc-err` (red): error response or thrown exception

Log entries are DOM-appended with `textContent` (never innerHTML), with
a 500-entry rolling cap to bound memory.

## Defenses

1. **Exception wrapping.** Server throws become ERROR responses, never
 propagate to the caller as thrown exceptions.
2. **Type validation.** Malformed messages (null, wrong type, missing
 `type` field) return ERROR rather than dispatching.
3. **Reserved-key rejection on payloads** (algorithm 14, thread T3).
 Handler does not iterate untrusted object keys without `hasOwn`
 guards.
4. **Log length cap.** Bounded DOM growth.
5. **No remote dispatch.** The channel cannot reach off-origin by
 design; `connect-src 'none'` in the CSP enforces this at the
 browser level.

## What this is NOT

- Not a wire protocol. It has no serialization. Messages are live
 JavaScript objects in the same process.
- Not networked. Extending this to the Distributed Collapse Network
 (algorithm 17) requires a different transport layer that uses VSF
 as its payload format; the channel abstraction changes.
- Not a message queue. Messages are dispatched immediately; there is
 no queuing, no retry, no delivery guarantee to manage.

## Wide-claim scope

The origin documents describe the IPC as "the observer / measurement
surface" where server-truth and client-cascade become relatable. That
framing is accurate for the narrow fact that the channel is the only
path through which state changes happen. It is the single audit point.

The wider claim - that the channel is formally an "observer" in the
quantum-mechanical or information-theoretic sense - is a framing
choice that the delta_IPC algorithm (#03) implements as a dashboard.
The channel itself does not embody that formalism; it is a typed
function-call mechanism with good logging.

## Related algorithms in this catalog

- `03-delta-ipc-channel-fidelity.md` - the observer layered over
 this channel
- `13-content-addressing-and-merkle.md` - the async post-processing
 that runs through the channel
- `14-security-defense-stack.md` - the T3 and T6 defenses cover
 message validation
- `17-distributed-collapse-network.md` - the proposed extension to
 a real network
