/* KingIndex /3 — Phosphor oscilloscope: three-signal sweep (home / dest / PPP). */
(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  function prefersReduced() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (_) {
      return false;
    }
  }

  function fmtMultiple(n) {
    if (n == null || !isFinite(n)) return "—";
    if (n >= 100) return Math.round(n) + "×";
    if (n >= 10) return n.toFixed(1) + "×";
    return n.toFixed(2) + "×";
  }

  function fmtMoneyCompact(n, currency) {
    if (n == null || !isFinite(n)) return "—";
    const abs = Math.abs(n);
    const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
    const s = n.toLocaleString("en-US", {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0
    });
    return currency && currency !== "LCU" ? s + " " + currency : s;
  }

  function buildPath(amp, phase, w, h, midFrac) {
    const mid = h * (midFrac == null ? 0.55 : midFrac);
    const pts = [];
    const n = 48;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = t * w;
      const wave =
        Math.sin(t * Math.PI * 2.2 + phase) * amp * 0.55 +
        Math.sin(t * Math.PI * 5.1 + phase * 1.7) * amp * 0.22 +
        Math.sin(t * Math.PI * 0.7 + phase * 0.4) * amp * 0.18;
      const envelope = Math.sin(t * Math.PI) * 0.85 + 0.15;
      const y = mid - wave * envelope;
      pts.push((i === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1));
    }
    return pts.join(" ");
  }

  function init() {
    if (typeof gsap === "undefined") return;
    const canvas = document.getElementById("scopeCanvas");
    const beam = document.getElementById("scopeBeam");
    const scan = document.getElementById("scopeScan");
    const readoutH = document.getElementById("scopeReadoutH");
    const readoutD = document.getElementById("scopeReadoutD");
    const readoutP = document.getElementById("scopeReadoutP");
    const chD = document.getElementById("scopeChD");
    const chP = document.getElementById("scopeChP");
    if (!canvas) return;

    const channels = [
      {
        key: "H",
        trace: document.getElementById("scopeTraceH"),
        glow: document.getElementById("scopeGlowH"),
        phaseBase: 0.0,
        mid: 0.42
      },
      {
        key: "D",
        trace: document.getElementById("scopeTraceD"),
        glow: document.getElementById("scopeGlowD"),
        phaseBase: 1.1,
        mid: 0.55
      },
      {
        key: "P",
        trace: document.getElementById("scopeTraceP"),
        glow: document.getElementById("scopeGlowP"),
        phaseBase: 2.2,
        mid: 0.68
      }
    ];
    if (!channels[0].trace || !channels[1].trace || !channels[2].trace) return;

    const W = 640;
    const H = 220;
    let lastSig = { h: null, d: null, p: null, dest: "" };
    let phase = 0;
    let sweepTween = null;
    let ambientCtx = null;
    let entered = false;
    let lastAmps = [28, 18, 16];

    function ampFromMultiple(m) {
      if (m == null || !isFinite(m)) return 14;
      const capped = Math.min(80, Math.max(0.05, m));
      return 16 + Math.log10(capped + 1) * 36;
    }

    function ampFromPpp(equiv, fxLocal) {
      if (equiv == null || !isFinite(equiv) || equiv <= 0) return 12;
      if (fxLocal != null && isFinite(fxLocal) && fxLocal > 0) {
        const ratio = equiv / fxLocal;
        return ampFromMultiple(ratio);
      }
      const lg = Math.log10(Math.max(1, equiv));
      const t = Math.min(1, Math.max(0, (lg - 2) / 5));
      return 16 + t * 48;
    }

    function setPaths(amps, phases) {
      channels.forEach((ch, i) => {
        const d = buildPath(amps[i], phases[i], W, H, ch.mid);
        ch.trace.setAttribute("d", d);
        if (ch.glow) ch.glow.setAttribute("d", d);
      });
    }

    function setStaticTraces(amps) {
      const phases = channels.map((ch) => phase + ch.phaseBase);
      setPaths(amps, phases);
      if (beam) gsap.set(beam, { attr: { x1: W * 0.92, x2: W * 0.92 }, opacity: 0.35 });
      if (scan) gsap.set(scan, { xPercent: 0, opacity: 0.12 });
    }

    function runSweep(amps) {
      lastAmps = amps.slice();
      if (prefersReduced()) {
        setStaticTraces(amps);
        return;
      }
      phase += 0.85;
      const phases = channels.map((ch) => phase + ch.phaseBase);
      setPaths(amps, phases);

      if (sweepTween) sweepTween.kill();
      const tl = gsap.timeline();
      if (beam) {
        gsap.set(beam, { attr: { x1: 0, x2: 0 }, opacity: 0.85 });
        tl.to(
          beam,
          {
            attr: { x1: W, x2: W },
            duration: 0.85,
            ease: "power2.inOut",
            opacity: 0.25
          },
          0
        );
      }
      if (scan) {
        gsap.set(scan, { xPercent: -110, opacity: 0.28 });
        tl.to(scan, { xPercent: 110, duration: 0.9, ease: "power1.inOut", opacity: 0.08 }, 0);
      }
      channels.forEach((ch, i) => {
        gsap.fromTo(ch.trace, { opacity: 0.3 }, { opacity: 1, duration: 0.45, ease: "power2.out", delay: i * 0.04 });
        if (ch.glow) {
          gsap.fromTo(ch.glow, { opacity: 0.12 }, { opacity: 0.4, duration: 0.5, ease: "power2.out", delay: i * 0.04 });
        }
      });
      sweepTween = tl;
    }

    function numChanged(a, b) {
      if (a == null && b == null) return false;
      if (a == null || b == null) return true;
      return Math.abs(a - b) > 0.001;
    }

    function updateReadout(payload) {
      const p = payload || {};
      const homeMult = p.homeMult;
      const destMultiple = p.destMultiple;
      const pppEquiv = p.pppEquiv;
      const fxLocal = p.fxLocal;
      const destCurrency = p.destCurrency || "";
      const hasDest = !!p.hasDest;

      if (readoutH) readoutH.textContent = fmtMultiple(homeMult);
      if (readoutD) {
        readoutD.textContent = hasDest && destMultiple != null ? fmtMultiple(destMultiple) : "—";
      }
      if (readoutP) {
        readoutP.textContent =
          hasDest && pppEquiv != null ? fmtMoneyCompact(pppEquiv, destCurrency) : "—";
      }
      if (chD) chD.classList.toggle("muted-ch", !hasDest || destMultiple == null);
      if (chP) chP.classList.toggle("muted-ch", !hasDest || pppEquiv == null);

      const ampH = ampFromMultiple(homeMult);
      const ampD =
        hasDest && destMultiple != null ? ampFromMultiple(destMultiple) : 10;
      const ampP = hasDest && pppEquiv != null ? ampFromPpp(pppEquiv, fxLocal) : 10;
      const amps = [ampH, ampD, ampP];

      const changed =
        numChanged(homeMult, lastSig.h) ||
        numChanged(destMultiple, lastSig.d) ||
        numChanged(pppEquiv, lastSig.p) ||
        (p.destIso || "") !== lastSig.dest;

      lastSig = {
        h: homeMult,
        d: destMultiple,
        p: pppEquiv,
        dest: p.destIso || ""
      };

      if (changed) runSweep(amps);
      else if (prefersReduced()) setStaticTraces(amps);
    }

    function entrance() {
      if (entered || prefersReduced()) {
        gsap.set(".enter", { opacity: 1, y: 0, clearProps: "transform" });
        return;
      }
      entered = true;
      const els = gsap.utils.toArray(".enter");
      gsap.set(els, { opacity: 0, y: 12 });
      gsap.to(els, {
        opacity: 1,
        y: 0,
        duration: 0.55,
        stagger: 0.06,
        ease: "power2.out",
        clearProps: "transform"
      });
    }

    function ambient() {
      if (ambientCtx) ambientCtx.revert();
      ambientCtx = gsap.context(() => {
        const mm = gsap.matchMedia();
        mm.add("(prefers-reduced-motion: reduce)", () => {
          setStaticTraces(lastAmps);
          gsap.set(".phosphor-glow", { opacity: 0.35 });
          gsap.set(".grid-drift", { xPercent: 0, yPercent: 0 });
          return () => {};
        });
        mm.add("(prefers-reduced-motion: no-preference)", () => {
          const glows = gsap.utils.toArray(".phosphor-glow");
          glows.forEach((el, i) => {
            gsap.to(el, {
              opacity: i % 2 ? 0.55 : 0.4,
              xPercent: i % 2 ? 10 : -8,
              yPercent: i % 2 ? -7 : 9,
              scale: 1.08,
              duration: 14 + i * 2.5,
              yoyo: true,
              repeat: -1,
              ease: "sine.inOut"
            });
          });
          const grids = gsap.utils.toArray(".grid-drift");
          grids.forEach((el, i) => {
            gsap.to(el, {
              xPercent: i ? 3 : -2,
              yPercent: i ? -2 : 2,
              duration: 18,
              yoyo: true,
              repeat: -1,
              ease: "sine.inOut"
            });
          });
          if (scan) {
            gsap.to(scan, {
              opacity: 0.14,
              duration: 2.4,
              yoyo: true,
              repeat: -1,
              ease: "sine.inOut"
            });
          }
          return () => {};
        });
      });
    }

    window.__phosphorScope = {
      onSignal: function (payload) {
        updateReadout(payload || {});
      }
    };

    setStaticTraces([28, 18, 16]);
    entrance();
    ambient();
    window.addEventListener("kingindex:themechange", () => {
      ambient();
    });
  }

  ready(init);
})();
