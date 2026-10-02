/* KingIndex /1 — GSAP atmosphere (MOTION ≈ 7). Colors from CSS theme tokens. */
(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  function init() {
    if (typeof gsap === "undefined") return;
    const root = document.getElementById("atmosphere");
    if (!root) return;

    const lightA = root.querySelector('[data-atm="light-a"]');
    const lightB = root.querySelector('[data-atm="light-b"]');
    const lightC = root.querySelector('[data-atm="light-c"]');
    const depth = root.querySelector('[data-atm="depth"]');
    const vignette = root.querySelector('[data-atm="vignette"]');
    const wireA = root.querySelector('[data-atm="wire-a"]');
    const wireB = root.querySelector('[data-atm="wire-b"]');
    const wireC = root.querySelector('[data-atm="wire-c"]');
    const grain = root.querySelector('[data-atm="grain"]');
    const enterEls = gsap.utils.toArray(".wrap > .enter");

    let ambientCtx = null;
    let mm = null;
    let entranceDone = false;

    function isLight() {
      return document.documentElement.getAttribute("data-theme") === "light";
    }

    function prefersReduce() {
      try {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch (_) {
        return false;
      }
    }

    function killAmbient() {
      if (mm) {
        mm.revert();
        mm = null;
      }
      if (ambientCtx) {
        ambientCtx.revert();
        ambientCtx = null;
      }
    }

    function setStaticFrame() {
      gsap.set([lightA, lightB, lightC, depth, vignette, wireA, wireB, wireC, grain], {
        clearProps: "transform",
      });
      gsap.set(lightA, { opacity: 0.55, xPercent: 0, yPercent: 0, scale: 1 });
      gsap.set(lightB, { opacity: 0.5, xPercent: 0, yPercent: 0, scale: 1 });
      gsap.set(lightC, { opacity: 0.45, xPercent: 0, yPercent: 0, scale: 1 });
      gsap.set(depth, { opacity: isLight() ? 0.11 : 0.22, yPercent: 0, rotateX: 0 });
      gsap.set(vignette, { opacity: isLight() ? 0.7 : 0.55 });
      gsap.set(wireA, { opacity: 0.32, rotateX: 48, rotateY: -12, rotateZ: -18, x: 0, y: 0 });
      gsap.set(wireB, { opacity: 0.28, rotateX: 48, rotateY: 8, rotateZ: 12, x: 0, y: 0 });
      gsap.set(wireC, { opacity: 0.26, rotateX: 42, rotateY: -6, rotateZ: -8, x: 0, y: 0 });
      gsap.set(grain, { opacity: isLight() ? 0.06 : 0.045 });
      // Ensure UI stays visible under reduced motion
      gsap.set(enterEls, { opacity: 1, y: 0, clearProps: "transform" });
      entranceDone = true;
    }

    function runEntrance() {
      if (entranceDone) return;
      entranceDone = true;
      if (!enterEls.length) return;
      // Outside ambientCtx so theme rebuild cannot revert entrance.
      gsap.set(enterEls, { opacity: 0, y: 14 });
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .to(enterEls, {
          opacity: 1,
          y: 0,
          duration: 0.7,
          stagger: 0.06,
          clearProps: "transform",
        });
    }

    function startAmbient() {
      const light = isLight();
      const g = gsap; // animations registered into ambientCtx via context callback

      g.to(lightA, {
        xPercent: 12,
        yPercent: 10,
        scale: 1.12,
        opacity: light ? 0.85 : 1,
        duration: 14,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });

      g.fromTo(
        lightB,
        { xPercent: 0, yPercent: 0, scale: 0.94, opacity: light ? 0.55 : 0.7 },
        {
          xPercent: -11,
          yPercent: 13,
          scale: 1.1,
          opacity: light ? 0.78 : 0.95,
          duration: 17,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          delay: -4,
        }
      );

      g.fromTo(
        lightC,
        { xPercent: 0, yPercent: 0, scale: 1, opacity: light ? 0.48 : 0.62 },
        {
          xPercent: -9,
          yPercent: -12,
          scale: 1.08,
          opacity: light ? 0.7 : 0.88,
          duration: 12,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          delay: -7,
        }
      );

      g.fromTo(
        depth,
        { yPercent: 0, rotateX: 0, opacity: light ? 0.1 : 0.22 },
        {
          yPercent: 3.2,
          rotateX: 2.2,
          opacity: light ? 0.16 : 0.34,
          duration: 18,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        }
      );

      g.to(vignette, {
        opacity: light ? 0.82 : 0.68,
        duration: 16,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });

      g.fromTo(
        wireA,
        { rotateX: 48, rotateY: -12, rotateZ: -18, x: 0, y: 0, opacity: light ? 0.28 : 0.42 },
        {
          rotateX: 36,
          rotateY: 10,
          rotateZ: -2,
          x: 26,
          y: -32,
          opacity: light ? 0.55 : 0.72,
          duration: 15,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        }
      );
      g.fromTo(
        wireB,
        { rotateX: 50, rotateY: 8, rotateZ: 14, x: 0, y: 0, opacity: light ? 0.24 : 0.38 },
        {
          rotateX: 40,
          rotateY: -10,
          rotateZ: 2,
          x: -20,
          y: 24,
          opacity: light ? 0.5 : 0.68,
          duration: 18,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          delay: -5,
        }
      );
      g.fromTo(
        wireC,
        { rotateX: 42, rotateY: -6, rotateZ: -8, x: 0, y: 0, opacity: light ? 0.22 : 0.36 },
        {
          rotateX: 52,
          rotateY: 8,
          rotateZ: 10,
          x: 16,
          y: -18,
          opacity: light ? 0.48 : 0.64,
          duration: 13,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          delay: -9,
        }
      );

      g.to(grain, {
        opacity: light ? 0.08 : 0.06,
        duration: 20,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
    }

    function buildAmbient() {
      killAmbient();

      ambientCtx = gsap.context(() => {
        mm = gsap.matchMedia();

        mm.add("(prefers-reduced-motion: reduce)", () => {
          setStaticFrame();
        });

        mm.add("(prefers-reduced-motion: no-preference)", () => {
          runEntrance();
          startAmbient();
        });
      }, root);
    }

    buildAmbient();

    window.addEventListener("kingindex:themechange", () => {
      // Keep entrance intact; only rebuild ambient opacity peaks for light/dark.
      if (prefersReduce()) {
        killAmbient();
        setStaticFrame();
        return;
      }
      // Pin UI visible before ambient rebuild
      gsap.set(enterEls, { opacity: 1 });
      entranceDone = true;
      buildAmbient();
    });

    window.KingIndexAtmosphere = {
      refresh: buildAmbient,
      destroy: killAmbient,
    };
  }

  ready(init);
})();
