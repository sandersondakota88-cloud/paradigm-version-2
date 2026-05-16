// trajectory-recorder.js - Per-frame trajectory capture, rendered through

"use strict";

(function (global) {

  const DEFAULT_WINDOW = 256; // samples per channel; ~4-5 sec at 60fps

  // ------------------------------------------------------------------------
  // Sample buffer: bounded ring, push appends, oldest drops at cap.
  // ------------------------------------------------------------------------

  function makeBuffer(cap) {
    return { cap: cap, data: [] };
  }

  function bufPush(buf, value) {
    buf.data.push(value);
    if (buf.data.length > buf.cap) buf.data.shift();
  }

  // ------------------------------------------------------------------------
  // Channel set. Each channel records one scalar (or small struct) per step.
  // ------------------------------------------------------------------------

  function makeChannels(cap) {
    return {
      step:        makeBuffer(cap),
      fastDelta:   makeBuffer(cap),
      slowDelta:   makeBuffer(cap),
      gap:         makeBuffer(cap),
      fastMod:     makeBuffer(cap),
      slowMod:     makeBuffer(cap),
      namingPref:  makeBuffer(cap),
      kindCounts:  makeBuffer(cap), // {seed,derived,ratified,predictive,meta,compound}
      queueDepth:  makeBuffer(cap)
    };
  }

  // ------------------------------------------------------------------------
  // Sampling: read Field state into a sample. Read-only per O1.
  // ------------------------------------------------------------------------

  function sample(Field, ctEngine) {
    const counts = { seed: 0, derived: 0, ratified: 0, predictive: 0, meta: 0, compound: 0 };
    const cs = Field.constraints;
    for (let i = 0; i < cs.length; i++) {
      const k = cs[i].kind;
      if (counts[k] !== undefined) counts[k] += 1;
    }
    const queueDepth = (ctEngine && typeof ctEngine.queueLength === "function")
      ? ctEngine.queueLength()
      : (ctEngine && ctEngine.queue ? ctEngine.queue.length : 0);
    return {
      step:       Field.step,
      fastDelta:  Field.fastDelta,
      slowDelta:  Field.slowDelta,
      gap:        Field.gap,
      fastMod:    Field.fastMod,
      slowMod:    Field.slowMod,
      namingPref: Field.namingPref,
      kindCounts: counts,
      queueDepth: queueDepth
    };
  }

  // ------------------------------------------------------------------------
  // Recorder: holds channels, samples on tick(), paints via CSS cascade.
  // ------------------------------------------------------------------------

  class TrajectoryRecorder {
    constructor(opts) {
      opts = opts || {};
      this.windowSize = opts.windowSize || DEFAULT_WINDOW;
      this.channels = makeChannels(this.windowSize);
      // DOM roots; populated on attach()
      this.box = null;
      this.layers = null;
      // Throttle: don't repaint every frame if the substrate hasn't stepped.
      // Track last step painted so we can skip repaints on idle frames.
      this.lastPaintedStep = -1;
      // Field reference cached on tick()
      this._Field = null;
    }

    // Attach to a container element. Builds the layer DOM structure once.
    attach(container) {
      if (!container) throw new Error("TrajectoryRecorder.attach: no container");
      // Clear container; build the box.
      container.innerHTML = "";
      const box = document.createElement("div");
      box.className = "trajectory-box";
      this.box = box;
      // Build one layer per channel group. Each layer is a horizontal
      // strip; samples render as bars from the bottom.
      this.layers = {};
      const groups = [
        { id: "delta",     label: "DELTA",      paint: this._paintDelta },
        { id: "gap",       label: "GAP",        paint: this._paintGap },
        { id: "modulation",label: "MODULATION", paint: this._paintModulation },
        { id: "naming",    label: "NAMING",     paint: this._paintNaming },
        { id: "structure", label: "STRUCTURE",  paint: this._paintStructure },
        { id: "queue",     label: "QUEUE",      paint: this._paintQueue }
      ];
      for (const g of groups) {
        const layer = document.createElement("div");
        layer.className = "trajectory-layer trajectory-layer-" + g.id;
        const labelEl = document.createElement("div");
        labelEl.className = "trajectory-layer-label";
        labelEl.textContent = g.label;
        const stripEl = document.createElement("div");
        stripEl.className = "trajectory-layer-strip";
        layer.appendChild(labelEl);
        layer.appendChild(stripEl);
        box.appendChild(layer);
        this.layers[g.id] = { root: layer, strip: stripEl, paint: g.paint };
      }
      container.appendChild(box);
    }

    // tick(Field, ctEngine): read state, push samples, repaint.
    // Called once per host frame, after field work is done.
    tick(Field, ctEngine) {
      this._Field = Field;
      const s = sample(Field, ctEngine);
      bufPush(this.channels.step,       s.step);
      bufPush(this.channels.fastDelta,  s.fastDelta);
      bufPush(this.channels.slowDelta,  s.slowDelta);
      bufPush(this.channels.gap,        s.gap);
      bufPush(this.channels.fastMod,    s.fastMod);
      bufPush(this.channels.slowMod,    s.slowMod);
      bufPush(this.channels.namingPref, s.namingPref);
      bufPush(this.channels.kindCounts, s.kindCounts);
      bufPush(this.channels.queueDepth, s.queueDepth);
      // Skip repaint on idle frames: if step hasn't advanced, the
      // trajectory shape hasn't changed.
      if (s.step === this.lastPaintedStep) return;
      this.lastPaintedStep = s.step;
      this.paint();
    }

    paint() {
      if (!this.box) return;
      for (const id in this.layers) {
        const layer = this.layers[id];
        layer.paint.call(this, layer.strip);
      }
    }

    // ----------------------------------------------------------------
    // Painters. Each builds a horizontal strip of bars, one per sample.
    // Time advances left-to-right; latest sample on the right.
    //
    // We replace innerHTML wholesale per repaint. This is the most
    // straightforward way to honor the cascade: the new DOM produces
    // a new render via the cascade's normal resolution rules. No
    // imperative drawing, no canvas, no requestAnimationFrame inside
    // the recorder itself - the host's tick is the cadence.
    // ----------------------------------------------------------------

    _paintDelta(strip) {
      // Two overlaid traces: fastDelta in one color, slowDelta in another.
      // Bars are stacked: fastDelta is the base, slowDelta is overlay.
      const fast = this.channels.fastDelta.data;
      const slow = this.channels.slowDelta.data;
      const n = fast.length;
      const html = [];
      for (let i = 0; i < n; i++) {
        const f = clamp01(fast[i]);
        const s = clamp01(slow[i]);
        html.push(
          '<span class="bar bar-fast" style="height:' + (f * 100).toFixed(1) + '%"></span>',
          '<span class="bar bar-slow" style="height:' + (s * 100).toFixed(1) + '%"></span>'
        );
      }
      strip.innerHTML = html.join("");
    }

    _paintGap(strip) {
      const gap = this.channels.gap.data;
      const n = gap.length;
      const html = [];
      for (let i = 0; i < n; i++) {
        const g = clamp01(gap[i]);
        html.push('<span class="bar bar-gap" style="height:' + (g * 100).toFixed(1) + '%"></span>');
      }
      strip.innerHTML = html.join("");
    }

    _paintModulation(strip) {
      const fm = this.channels.fastMod.data;
      const sm = this.channels.slowMod.data;
      const n = fm.length;
      const html = [];
      for (let i = 0; i < n; i++) {
        const f = clamp01(fm[i]);
        const s = clamp01(sm[i]);
        html.push(
          '<span class="bar bar-fastmod" style="height:' + (f * 100).toFixed(1) + '%"></span>',
          '<span class="bar bar-slowmod" style="height:' + (s * 100).toFixed(1) + '%"></span>'
        );
      }
      strip.innerHTML = html.join("");
    }

    _paintNaming(strip) {
      const np = this.channels.namingPref.data;
      const n = np.length;
      const html = [];
      for (let i = 0; i < n; i++) {
        const v = clamp01(np[i]);
        html.push('<span class="bar bar-naming" style="height:' + (v * 100).toFixed(1) + '%"></span>');
      }
      strip.innerHTML = html.join("");
    }

    _paintStructure(strip) {
      // Stack constraint-kind counts as a stacked bar per sample.
      // Normalize by total to give a relative composition view.
      const buf = this.channels.kindCounts.data;
      const n = buf.length;
      const html = [];
      for (let i = 0; i < n; i++) {
        const c = buf[i] || {};
        const total = (c.seed||0)+(c.derived||0)+(c.ratified||0)+(c.predictive||0)+(c.meta||0)+(c.compound||0);
        if (total === 0) {
          html.push('<span class="bar bar-empty"></span>');
          continue;
        }
        const seedH    = ((c.seed||0)       / total * 100).toFixed(1);
        const derivedH = ((c.derived||0)    / total * 100).toFixed(1);
        const ratH     = ((c.ratified||0)   / total * 100).toFixed(1);
        const predH    = ((c.predictive||0) / total * 100).toFixed(1);
        const metaH    = ((c.meta||0)       / total * 100).toFixed(1);
        const compH    = ((c.compound||0)   / total * 100).toFixed(1);
        html.push(
          '<span class="bar bar-stack">',
            '<span class="seg seg-seed" style="height:'+seedH+'%"></span>',
            '<span class="seg seg-derived" style="height:'+derivedH+'%"></span>',
            '<span class="seg seg-ratified" style="height:'+ratH+'%"></span>',
            '<span class="seg seg-predictive" style="height:'+predH+'%"></span>',
            '<span class="seg seg-meta" style="height:'+metaH+'%"></span>',
            '<span class="seg seg-compound" style="height:'+compH+'%"></span>',
          '</span>'
        );
      }
      strip.innerHTML = html.join("");
    }

    _paintQueue(strip) {
      const qd = this.channels.queueDepth.data;
      // Normalize against the channel's own observed max (or fall back to
      // CT_OP_QUEUE_CAP if that's available via Field.CFG).
      let maxObs = 1;
      for (let i = 0; i < qd.length; i++) if (qd[i] > maxObs) maxObs = qd[i];
      const html = [];
      for (let i = 0; i < qd.length; i++) {
        const v = qd[i] / maxObs;
        html.push('<span class="bar bar-queue" style="height:' + (v * 100).toFixed(1) + '%"></span>');
      }
      strip.innerHTML = html.join("");
    }

    // ----------------------------------------------------------------
    // Snapshot: return the current trajectory window as plain data.
    // For benchmarking via comparison, save-to-file, or analysis.
    // ----------------------------------------------------------------
    snapshot() {
      return {
        windowSize: this.windowSize,
        step:       this.channels.step.data.slice(),
        fastDelta:  this.channels.fastDelta.data.slice(),
        slowDelta:  this.channels.slowDelta.data.slice(),
        gap:        this.channels.gap.data.slice(),
        fastMod:    this.channels.fastMod.data.slice(),
        slowMod:    this.channels.slowMod.data.slice(),
        namingPref: this.channels.namingPref.data.slice(),
        kindCounts: this.channels.kindCounts.data.slice(),
        queueDepth: this.channels.queueDepth.data.slice()
      };
    }

    // Reset clears all channels. Called by the host when the field is
    // reset; the recorder's own reset is the only writer to the channels.
    reset() {
      this.channels = makeChannels(this.windowSize);
      this.lastPaintedStep = -1;
      if (this.box) this.paint();
    }
  }

  // ------------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------------

  function clamp01(v) {
    if (typeof v !== "number" || !isFinite(v)) return 0;
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
  }

  // ------------------------------------------------------------------------
  // Export
  // ------------------------------------------------------------------------

  const exported = { TrajectoryRecorder: TrajectoryRecorder };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported;
  } else {
    global.TrajectoryRecorderModule = exported;
  }

})(typeof window !== "undefined" ? window : globalThis);
