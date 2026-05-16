// substrate-walker.js - generic runtime walker for substrate-deposited apps

(function () {
  "use strict";

  var DISPATCH_CYCLE_CAP = 32;

  var operations = Object.create(null);
  var stateElement = null;
  var initialized = false;

  // Built-in operations every application can use without registering.
  // These cover the cases where the operation is structural rather than
  // application-specific: clearing state, no-op, etc.
  operations["noop"] = function () { return null; };

  function findStateElement() {
    return document.querySelector("[data-substrate-state]");
  }

  function readCoords(el) {
    var out = {};
    if (!el) return out;
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      if (a.name.indexOf("data-") === 0) out[a.name] = a.value;
    }
    return out;
  }

  function readNextOp(el) {
    if (!el) return "noop";
    var cs = window.getComputedStyle(el);
    var v = cs.getPropertyValue("--next-op");
    if (!v) return "noop";
    return v.trim().replace(/^["']|["']$/g, "");
  }

  function applyWrites(el, writes) {
    if (!el || !writes) return;
    for (var k in writes) {
      el.setAttribute(k, String(writes[k]));
    }
  }

  function dispatchOnce() {
    if (!stateElement) return false;
    var op = readNextOp(stateElement);
    if (!op || op === "noop") return false;
    var fn = operations[op];
    if (!fn) {
      console.warn("[substrate] unknown operation: " + op);
      return false;
    }
    var coords = readCoords(stateElement);
    try {
      var writes = fn(coords);
      applyWrites(stateElement, writes);
    } catch (e) {
      // Operation failure becomes a coordinate write itself
      stateElement.setAttribute("data-error", e.message || "operation failed");
      stateElement.setAttribute("data-error-present", "1");
    }
    return true;
  }

  function dispatchUntilQuiescent() {
    var safety = DISPATCH_CYCLE_CAP;
    while (safety-- > 0) {
      if (!dispatchOnce()) break;
    }
  }

  // Generic event wiring: elements with data-role determine what events
  // they emit and what coordinate writes those events produce. This is
  // the platform-level vocabulary. Application-specific roles can be
  // added by registering operation handlers.
  //
  // Built-in role behaviors:
  //   data-role="input-emitter"
  //     keydown Enter -> writes data-trigger="<elementId>" on state
  //     input event -> writes data-input-<id>="<value>" on state
  //   data-role="action-trigger" (typically a button)
  //     click -> writes data-trigger="<value of data-action attribute>"
  //   data-role="filter-control"
  //     click -> writes data-filter="<value of data-filter attribute>"
  //   data-role="toggle"
  //     click/change -> writes data-trigger="toggle" + data-target="<id>"
  //   data-role="delete"
  //     click -> writes data-trigger="delete" + data-target="<closest id>"

  function wireGenericEvents() {
    document.addEventListener("input", function (e) {
      var el = e.target;
      if (!el.dataset || !el.dataset.role) return;
      if (el.dataset.role === "input-emitter") {
        var id = el.id || "anonymous";
        stateElement.setAttribute("data-input-" + id, el.value);
        stateElement.setAttribute("data-input-present", el.value.length > 0 ? "1" : "0");
        dispatchUntilQuiescent();
      }
    }, false);

    document.addEventListener("keydown", function (e) {
      var el = e.target;
      if (!el.dataset || el.dataset.role !== "input-emitter") return;
      if (e.key === "Enter") {
        var trigger = el.dataset.trigger || "submit";
        stateElement.setAttribute("data-trigger", trigger);
        dispatchUntilQuiescent();
      }
    }, false);

    document.addEventListener("click", function (e) {
      var el = e.target;
      while (el && el !== document.body) {
        if (el.dataset && el.dataset.role) break;
        el = el.parentElement;
      }
      if (!el || !el.dataset || !el.dataset.role) return;
      var role = el.dataset.role;
      if (role === "action-trigger") {
        stateElement.setAttribute("data-trigger", el.dataset.action || "action");
        dispatchUntilQuiescent();
      } else if (role === "filter-control") {
        stateElement.setAttribute("data-filter", el.dataset.filter || "all");
        dispatchUntilQuiescent();
      } else if (role === "delete") {
        var target = el.closest("[data-id]");
        if (target) {
          stateElement.setAttribute("data-trigger", "delete");
          stateElement.setAttribute("data-target", target.dataset.id);
          dispatchUntilQuiescent();
        }
      } else if (role === "toggle") {
        var t = el.closest("[data-id]");
        if (t) {
          stateElement.setAttribute("data-trigger", "toggle");
          stateElement.setAttribute("data-target", t.dataset.id);
          dispatchUntilQuiescent();
        }
      }
    }, false);
  }

  function init() {
    if (initialized) return;
    stateElement = findStateElement();
    if (!stateElement) {
      console.warn("[substrate] no [data-substrate-state] element found");
      return;
    }
    wireGenericEvents();
    // Initial dispatch: cascade may have resolved an op based on initial state
    dispatchUntilQuiescent();
    initialized = true;
  }

  // Public API
  window.substrate = {
    register: function (name, fn) {
      if (typeof name !== "string" || typeof fn !== "function") {
        throw new TypeError("substrate.register(name, fn) requires string and function");
      }
      operations[name] = fn;
    },
    kick: function () {
      dispatchUntilQuiescent();
    },
    get state() { return stateElement; },
    get coords() { return stateElement ? readCoords(stateElement) : {}; }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
