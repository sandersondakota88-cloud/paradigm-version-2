"use strict";
// Simulate the cascade-dispatch loop against the state object's rules
// to verify the architecture functions before opening it in a browser.

var rules = [
  // base
  function (c) { return { "--next-op": "noop", "--filter": c["data-filter"] || "all" }; },
  // submit trigger -> add-todo
  function (c) {
    if (c["data-trigger"] === "submit") return { "--next-op": "add-todo" };
    return null;
  },
  // toggle trigger -> toggle-todo
  function (c) {
    if (c["data-trigger"] === "toggle") return { "--next-op": "toggle-todo" };
    return null;
  },
  // delete trigger -> delete-todo
  function (c) {
    if (c["data-trigger"] === "delete") return { "--next-op": "delete-todo" };
    return null;
  },
  // clear-completed trigger
  function (c) {
    if (c["data-trigger"] === "clear-completed") return { "--next-op": "clear-completed" };
    return null;
  }
];

function resolveCascade(coords) {
  var resolved = {};
  for (var i = 0; i < rules.length; i++) {
    var out = rules[i](coords);
    if (out) for (var k in out) resolved[k] = out[k];
  }
  return resolved;
}

// Mock DOM (just enough for the operation impls to work)
var mockDOM = {
  todos: [],
  nextId: 1
};

var ops = {
  noop: function () { return null; },
  "add-todo": function (coords) {
    var text = (coords["data-input-new-todo"] || "").trim();
    if (!text) return { "data-trigger": "" };
    mockDOM.todos.push({ id: String(mockDOM.nextId++), text: text, completed: "0" });
    return { "data-trigger": "", "data-input-new-todo": "", "data-input-present": "0" };
  },
  "toggle-todo": function (coords) {
    var id = coords["data-target"];
    for (var i = 0; i < mockDOM.todos.length; i++) {
      if (mockDOM.todos[i].id === id) {
        mockDOM.todos[i].completed = mockDOM.todos[i].completed === "1" ? "0" : "1";
        break;
      }
    }
    return { "data-trigger": "", "data-target": "" };
  },
  "delete-todo": function (coords) {
    var id = coords["data-target"];
    mockDOM.todos = mockDOM.todos.filter(function (t) { return t.id !== id; });
    return { "data-trigger": "", "data-target": "" };
  },
  "clear-completed": function () {
    mockDOM.todos = mockDOM.todos.filter(function (t) { return t.completed === "0"; });
    return { "data-trigger": "" };
  }
};

function dispatch(coords) {
  var trace = [];
  var safety = 32;
  while (safety-- > 0) {
    var resolved = resolveCascade(coords);
    var op = (resolved["--next-op"] || "noop").trim();
    if (op === "noop") break;
    var fn = ops[op];
    if (!fn) { trace.push({ op: op, error: "unknown" }); break; }
    var writes = fn(coords) || {};
    trace.push({ op: op, writes: writes });
    for (var k in writes) coords[k] = writes[k];
  }
  return { coords: coords, trace: trace };
}

// === Test scenarios ===
var pass = 0, fail = 0;

function check(name, predicate) {
  if (predicate) { console.log("  OK   " + name); pass++; }
  else { console.log("  FAIL " + name); fail++; }
}

console.log("Substrate-deposited TodoMVC: dispatch verification\n");

// Scenario 1: add a todo
console.log("Scenario 1: type 'buy milk', press enter (submit trigger)");
mockDOM.todos = []; mockDOM.nextId = 1;
var coords1 = {
  "data-substrate-state": "",
  "data-filter": "all",
  "data-trigger": "submit",
  "data-input-new-todo": "buy milk",
  "data-input-present": "1"
};
var r1 = dispatch(coords1);
console.log("  trace:", r1.trace.map(function (t) { return t.op; }));
console.log("  todos after:", JSON.stringify(mockDOM.todos));
check("add-todo executed", r1.trace.length === 1 && r1.trace[0].op === "add-todo");
check("todo persisted to mock dom", mockDOM.todos.length === 1 && mockDOM.todos[0].text === "buy milk");
check("trigger cleared (quiescent)", coords1["data-trigger"] === "");

// Scenario 2: toggle a todo
console.log("\nScenario 2: click checkbox on todo id=1 (toggle trigger)");
var coords2 = {
  "data-substrate-state": "",
  "data-filter": "all",
  "data-trigger": "toggle",
  "data-target": "1"
};
var r2 = dispatch(coords2);
console.log("  trace:", r2.trace.map(function (t) { return t.op; }));
console.log("  todos after:", JSON.stringify(mockDOM.todos));
check("toggle-todo executed", r2.trace.length === 1 && r2.trace[0].op === "toggle-todo");
check("completion flipped", mockDOM.todos[0].completed === "1");

// Scenario 3: add another, clear completed
console.log("\nScenario 3: add 'walk dog', then clear completed");
var coords3a = {
  "data-substrate-state": "", "data-filter": "all",
  "data-trigger": "submit", "data-input-new-todo": "walk dog", "data-input-present": "1"
};
dispatch(coords3a);
console.log("  after add:", JSON.stringify(mockDOM.todos));
check("two todos exist", mockDOM.todos.length === 2);

var coords3b = {
  "data-substrate-state": "", "data-filter": "all",
  "data-trigger": "clear-completed"
};
dispatch(coords3b);
console.log("  after clear:", JSON.stringify(mockDOM.todos));
check("clear-completed removed completed", mockDOM.todos.length === 1 && mockDOM.todos[0].text === "walk dog");

// Scenario 4: empty submit
console.log("\nScenario 4: submit empty input (should noop)");
var coords4 = {
  "data-substrate-state": "", "data-filter": "all",
  "data-trigger": "submit", "data-input-new-todo": "", "data-input-present": "0"
};
var beforeCount = mockDOM.todos.length;
dispatch(coords4);
check("empty submit didn't add", mockDOM.todos.length === beforeCount);

// Scenario 5: filter change is a non-dispatch coordinate write
// (the cascade has rules that resolve filter visibility without
// triggering operations - the walker just writes data-filter directly)
console.log("\nScenario 5: filter change writes coordinate, no operation needed");
var coords5 = {
  "data-substrate-state": "", "data-filter": "active",
  "data-trigger": ""
};
var r5 = dispatch(coords5);
check("no operation dispatched for filter change", r5.trace.length === 0);
check("filter coordinate set", coords5["data-filter"] === "active");

console.log("\n" + pass + "/" + (pass + fail) + " checks passed");
process.exit(fail > 0 ? 1 : 0);
