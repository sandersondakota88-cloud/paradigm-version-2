// deposition.js
// =============================================================================
// TodoMVC application deposition.
//
// Two surfaces:
//
//   1. CASCADE RULES (the runtime logic, as geometry)
//      Expressed twice, identically:
//        a) as an array of kernel cascade-match constraints assigned to
//           globalThis.__DEPOSITION_CASCADE_RULES__ for the kernel evaluator
//           and the GPU compiler;
//        b) as a CSS <style> block in todomvc.html so the browser's native
//           cascade resolves them in parallel.
//      Per S2 + algorithm 16, all three substrates (kernel-CPU, browser-CSS,
//      WGSL compute) produce byte-identical resolution from the same intake
//      state.
//
//   2. OPERATION HANDLERS (mechanical actuators)
//      Pure DOM mutators. They do not decide WHAT operation to run; the
//      cascade does. They do not decide WHETHER to act on empty input or
//      similar edge cases; the cascade declines to match. Handlers are
//      single-purpose: one writes "1" to data-completed, another writes "0",
//      a third removes the element, etc.
//
// Decisions moved from handlers into geometry (vs the previous deposition):
//   - Empty input no-op: was JS "if (!text) return"; now the (trigger=submit,
//     input-present=0) coord has no matching rule, so no op fires.
//   - Toggle direction: was JS "newCompleted = ... === '1' ? '0' : '1'";
//     now (trigger=toggle, target-completed=0) -> complete-todo and
//     (trigger=toggle, target-completed=1) -> uncomplete-todo.
//   - Per-todo visibility: was a body-class CSS rule outside the cascade
//     surface; now (filter=X, completed=Y) -> --todo-visible=0|1, resolved
//     by all three substrates.
//
// Coord-space axes used by the rules:
//   trigger:           "" | submit | toggle | delete | clear-completed | filter
//   filter:            all | active | completed
//   completed:         none | 0 | 1     (the completed state of the targeted
//                                        todo, or "none" if no target)
//   input-present:     0 | 1            (is the new-todo input non-empty?)
// =============================================================================

"use strict";

(function () {

// ---- Cascade rules in kernel constraint form -------------------------------

globalThis.__DEPOSITION_CASCADE_RULES__ = [

  // --- next-op selection (driven by trigger + discriminative coords) -------

  // Empty input + submit: no rule matches. (Encoded as the absence of a
  // rule; the geometry's empty-input no-op is geometric, not procedural.)

  // Non-empty input + submit -> add a todo
  {
    id: "deposit::submit-with-input",
    kind: "derived",
    pattern: {
      type: "cascade-match",
      selector: {
        "data-substrate-state": "*",
        "data-trigger": "submit",
        "data-input-present": "1"
      }
    },
    emit: { property: "--next-op", value: "add-todo" },
    birth: 0, lastUsed: 0, uses: 0, weight: 1.0, permanent: false
  },

  // Toggle a not-yet-complete todo -> complete it
  {
    id: "deposit::toggle-incomplete",
    kind: "derived",
    pattern: {
      type: "cascade-match",
      selector: {
        "data-substrate-state": "*",
        "data-trigger": "toggle",
        "data-target-completed": "0"
      }
    },
    emit: { property: "--next-op", value: "complete-todo" },
    birth: 0, lastUsed: 0, uses: 0, weight: 1.0, permanent: false
  },

  // Toggle an already-complete todo -> uncomplete it
  {
    id: "deposit::toggle-complete",
    kind: "derived",
    pattern: {
      type: "cascade-match",
      selector: {
        "data-substrate-state": "*",
        "data-trigger": "toggle",
        "data-target-completed": "1"
      }
    },
    emit: { property: "--next-op", value: "uncomplete-todo" },
    birth: 0, lastUsed: 0, uses: 0, weight: 1.0, permanent: false
  },

  // Delete trigger -> delete the targeted todo
  {
    id: "deposit::delete",
    kind: "derived",
    pattern: {
      type: "cascade-match",
      selector: {
        "data-substrate-state": "*",
        "data-trigger": "delete"
      }
    },
    emit: { property: "--next-op", value: "delete-todo" },
    birth: 0, lastUsed: 0, uses: 0, weight: 1.0, permanent: false
  },

  // Clear-completed
  {
    id: "deposit::clear-completed",
    kind: "derived",
    pattern: {
      type: "cascade-match",
      selector: {
        "data-substrate-state": "*",
        "data-trigger": "clear-completed"
      }
    },
    emit: { property: "--next-op", value: "clear-completed" },
    birth: 0, lastUsed: 0, uses: 0, weight: 1.0, permanent: false
  },

  // Set-filter
  {
    id: "deposit::set-filter",
    kind: "derived",
    pattern: {
      type: "cascade-match",
      selector: {
        "data-substrate-state": "*",
        "data-trigger": "filter"
      }
    },
    emit: { property: "--next-op", value: "set-filter" },
    birth: 0, lastUsed: 0, uses: 0, weight: 1.0, permanent: false
  },

  // --- visibility (resolved as a property of (filter, completed)) ----------
  // These rules emit on the SAME state-element selector regardless of
  // trigger -- visibility is a property of the current filter and a
  // completed-state, not of any pending action. The "completed" dim names
  // the state being considered, not the state of any particular todo;
  // the per-todo lookup is the host's job (read the resolved field at
  // (filter=current, completed=this-todo's-state)).
  //
  // Default (all filter, any completed): visible.
  {
    id: "deposit::visible-all",
    kind: "derived",
    pattern: {
      type: "cascade-match",
      selector: {
        "data-substrate-state": "*",
        "data-filter": "all"
      }
    },
    emit: { property: "--todo-visible", value: "1" },
    birth: 0, lastUsed: 0, uses: 0, weight: 1.0, permanent: false
  },
  // Active filter, completed=0: visible
  {
    id: "deposit::visible-active-incomplete",
    kind: "derived",
    pattern: {
      type: "cascade-match",
      selector: {
        "data-substrate-state": "*",
        "data-filter": "active",
        "data-completed": "0"
      }
    },
    emit: { property: "--todo-visible", value: "1" },
    birth: 0, lastUsed: 0, uses: 0, weight: 1.0, permanent: false
  },
  // Active filter, completed=1: hidden
  {
    id: "deposit::hide-active-complete",
    kind: "derived",
    pattern: {
      type: "cascade-match",
      selector: {
        "data-substrate-state": "*",
        "data-filter": "active",
        "data-completed": "1"
      }
    },
    emit: { property: "--todo-visible", value: "0" },
    birth: 0, lastUsed: 0, uses: 0, weight: 1.0, permanent: false
  },
  // Completed filter, completed=1: visible
  {
    id: "deposit::visible-completed-complete",
    kind: "derived",
    pattern: {
      type: "cascade-match",
      selector: {
        "data-substrate-state": "*",
        "data-filter": "completed",
        "data-completed": "1"
      }
    },
    emit: { property: "--todo-visible", value: "1" },
    birth: 0, lastUsed: 0, uses: 0, weight: 1.0, permanent: false
  },
  // Completed filter, completed=0: hidden
  {
    id: "deposit::hide-completed-incomplete",
    kind: "derived",
    pattern: {
      type: "cascade-match",
      selector: {
        "data-substrate-state": "*",
        "data-filter": "completed",
        "data-completed": "0"
      }
    },
    emit: { property: "--todo-visible", value: "0" },
    birth: 0, lastUsed: 0, uses: 0, weight: 1.0, permanent: false
  }
];

// The list of output properties this deposition writes, in slot order.
// The GPU compiler uses this to allocate output slots; the host uses it to
// know which slot maps to which custom property.
globalThis.__DEPOSITION_OUTPUT_PROPERTIES__ = ["--next-op", "--todo-visible"];

// The coord-space the GPU should sweep. Values explicit (not derived from
// rules) because some dims have values that appear as coord-state but not
// as selector values (e.g. data-filter values "active","completed" don't
// appear in --next-op selectors, only in --todo-visible selectors).
globalThis.__DEPOSITION_DIMS__ = [
  { name: "trigger",          values: ["", "submit", "toggle", "delete", "clear-completed", "filter"] },
  { name: "filter",           values: ["all", "active", "completed"] },
  { name: "completed",        values: ["none", "0", "1"] },
  { name: "target-completed", values: ["none", "0", "1"] },
  { name: "input-present",    values: ["0", "1"] }
];

// ---- Operation handlers (mechanical actuators) -----------------------------

const STORAGE_KEY_ITEMS = "todomvc-substrate-items";
const STORAGE_KEY_NEXTID = "todomvc-substrate-nextid";

function nextId() {
  let n = parseInt(localStorage.getItem(STORAGE_KEY_NEXTID) || "1", 10);
  localStorage.setItem(STORAGE_KEY_NEXTID, String(n + 1));
  return n;
}

function persist() {
  try {
    const items = [];
    document.querySelectorAll(".todo-item").forEach(function (li) {
      items.push({
        id: li.dataset.id,
        completed: li.dataset.completed,
        text: li.querySelector(".text").textContent
      });
    });
    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
  } catch (e) { /* quota or disabled; non-fatal */ }
}

function refreshFooter() {
  const items = document.querySelectorAll(".todo-item");
  const active = document.querySelectorAll('.todo-item[data-completed="0"]').length;
  const completed = items.length - active;
  const countEl = document.getElementById("count");
  if (countEl) countEl.textContent = active + (active === 1 ? " item left" : " items left");
  const footer = document.getElementById("footer");
  if (footer) footer.style.display = items.length === 0 ? "none" : "";
  const clearBtn = document.getElementById("clear-completed");
  if (clearBtn) clearBtn.style.display = completed === 0 ? "none" : "";
}

function makeTodoElement(id, text, completed) {
  const li = document.createElement("li");
  li.className = "todo-item";
  li.dataset.id = id;
  li.dataset.completed = completed ? "1" : "0";

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.setAttribute("data-role", "toggle");
  if (completed) cb.checked = true;

  const span = document.createElement("span");
  span.className = "text";
  span.textContent = text;

  const del = document.createElement("button");
  del.type = "button";
  del.setAttribute("data-role", "delete");
  del.textContent = "x";

  li.appendChild(cb);
  li.appendChild(span);
  li.appendChild(del);
  return li;
}

// Set completed state on a todo, syncing the checkbox + persisting.
// This is a pure mutator; whether to call it is decided by the cascade.
function setCompleted(li, completedStr) {
  li.dataset.completed = completedStr;
  const cb = li.querySelector('input[type="checkbox"]');
  if (cb) cb.checked = completedStr === "1";
}

function whenReady(cb) {
  if (typeof globalThis.CascadeOpDispatcher !== "undefined") {
    cb();
  } else {
    setTimeout(function () { whenReady(cb); }, 16);
  }
}

whenReady(function () {

  const D = globalThis.CascadeOpDispatcher;

  // add-todo: cascade has already decided this should run (input is
  // non-empty AND trigger=submit). The handler just constructs.
  D.register("add-todo", function (coords) {
    const text = (coords["input-new-todo"] || "").trim();
    // Cascade guards on input-present=1, but the actual text could still
    // be all whitespace which trim() catches. If somehow empty, just clear
    // the trigger and bail; the cascade won't refire because we clear it.
    if (!text) {
      return { "trigger": "", "target": "", "input-new-todo": "", "input-present": "0", "target-completed": "none" };
    }
    const id = nextId();
    const li = makeTodoElement(id, text, false);
    document.getElementById("todo-list").appendChild(li);
    const inputEl = document.getElementById("new-todo");
    if (inputEl) inputEl.value = "";
    persist();
    refreshFooter();
    return { "trigger": "", "target": "", "input-new-todo": "", "input-present": "0", "target-completed": "none" };
  });

  // complete-todo: cascade decided this. Just set the bit.
  D.register("complete-todo", function (coords) {
    const id = coords["target"];
    if (id) {
      const li = document.querySelector('.todo-item[data-id="' + id + '"]');
      if (li) {
        setCompleted(li, "1");
        persist();
        refreshFooter();
      }
    }
    return { "trigger": "", "target": "", "target-completed": "none" };
  });

  // uncomplete-todo: also cascade-decided.
  D.register("uncomplete-todo", function (coords) {
    const id = coords["target"];
    if (id) {
      const li = document.querySelector('.todo-item[data-id="' + id + '"]');
      if (li) {
        setCompleted(li, "0");
        persist();
        refreshFooter();
      }
    }
    return { "trigger": "", "target": "", "target-completed": "none" };
  });

  D.register("delete-todo", function (coords) {
    const id = coords["target"];
    if (id) {
      const li = document.querySelector('.todo-item[data-id="' + id + '"]');
      if (li) li.remove();
      persist();
      refreshFooter();
    }
    return { "trigger": "", "target": "", "target-completed": "none" };
  });

  D.register("clear-completed", function () {
    document.querySelectorAll('.todo-item[data-completed="1"]').forEach(function (li) {
      li.remove();
    });
    persist();
    refreshFooter();
    return { "trigger": "" };
  });

  D.register("set-filter", function (coords) {
    const filter = coords["target"] || "all";
    document.body.dataset.filter = filter;
    document.querySelectorAll('[data-role="filter-control"]').forEach(function (btn) {
      if (btn.dataset.filter === filter) btn.classList.add("active");
      else btn.classList.remove("active");
    });
    // Push the new filter into intake so the cascade's --todo-visible
    // resolution sees it on the next tick.
    return { "trigger": "", "target": "", "filter": filter };
  });

  // ---- Hydration: load persisted todos -------------------------------------
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ITEMS);
    if (raw) {
      const items = JSON.parse(raw);
      if (Array.isArray(items)) {
        const listEl = document.getElementById("todo-list");
        items.forEach(function (item) {
          if (!item || !item.id) return;
          const li = makeTodoElement(item.id, item.text || "", item.completed === "1");
          listEl.appendChild(li);
        });
      }
    }
    refreshFooter();
  } catch (e) {
    console.warn("[deposition] hydration failed:", e.message);
  }
});

})();
