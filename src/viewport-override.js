/**
 * Viewport Override Script — runs in the MAIN world
 */
(function () {
  "use strict";

  const LOG_PREFIX = "%c[Claude Viewport Override]";
  const LOG_STYLE = "color: #bf7044; font-weight: bold; padding: 2px 4px; border-radius: 4px; background: #fdf6f2;";
  
  function debugLog(msg, ...args) {
    console.log(LOG_PREFIX, LOG_STYLE, msg, ...args);
  }

  var K = "__claude_vp__";
  if (window[K]) return;
  
  window[K] = { reduction: 0 };
  debugLog("Initializing Main-World Script (v4.1)...");

  function findDesc(obj, prop) {
    var cur = obj;
    while (cur) {
      try {
        var d = Object.getOwnPropertyDescriptor(cur, prop);
        if (d) return { desc: d, owner: cur };
      } catch (e) {}
      cur = Object.getPrototypeOf(cur);
    }
    return null;
  }

  // Save original descriptors
  var iwInfo = findDesc(window, "innerWidth");
  var cwInfo = findDesc(document.documentElement, "clientWidth");
  var vvInfo = window.visualViewport ? findDesc(window.visualViewport, "width") : null;
  var mmInfo = findDesc(window, "matchMedia");

  var origIWGate = iwInfo && iwInfo.desc.get ? iwInfo.desc.get : null;
  var origIWDesc = iwInfo ? iwInfo.desc : null;
  var origIWOwner = iwInfo ? iwInfo.owner : null;
  var origCWGate = cwInfo && cwInfo.desc.get ? cwInfo.desc.get : null;
  var origVVGate = vvInfo && vvInfo.desc.get ? vvInfo.desc.get : null;
  var origMMValue = mmInfo && mmInfo.desc.value ? mmInfo.desc.value : null;

  // ─── Install overrides ───
  function install(reduction) {
    if (window[K].reduction === reduction) return;
    window[K].reduction = reduction;
    debugLog(`Installing override: -${reduction}px`);

    // innerWidth
    if (origIWGate) {
      Object.defineProperty(window, "innerWidth", {
        get: function () { return origIWGate.call(window) - window[K].reduction; },
        configurable: true, enumerable: true,
      });
    }

    // clientWidth
    if (origCWGate) {
      Object.defineProperty(document.documentElement, "clientWidth", {
        get: function () { return origCWGate.call(document.documentElement) - window[K].reduction; },
        configurable: true, enumerable: true,
      });
      if (document.body) {
        Object.defineProperty(document.body, "clientWidth", {
          get: function () { return origCWGate.call(document.body) - window[K].reduction; },
          configurable: true, enumerable: true,
        });
      }
    }

    // visualViewport.width
    if (origVVGate && window.visualViewport) {
      Object.defineProperty(window.visualViewport, "width", {
        get: function () { return origVVGate.call(window.visualViewport) - window[K].reduction; },
        configurable: true, enumerable: true,
      });
    }

    // matchMedia (to handle JS media queries)
    if (origMMValue) {
      window.matchMedia = function(query) {
        // Simple regex to adjust 'min-width' and 'max-width' in queries
        // This is a naive but effective trick for MANY sites
        var adjustedQuery = query.replace(/(min-width|max-width):\s*(\d+)px/g, function(match, type, val) {
          var newVal = parseInt(val) + window[K].reduction;
          return `${type}: ${newVal}px`;
        });
        return origMMValue.call(window, adjustedQuery);
      };
    }

    // Force multiple resize events
    window.dispatchEvent(new Event("resize"));
    [100, 300, 700].forEach(ms => setTimeout(() => window.dispatchEvent(new Event("resize")), ms));
  }

  // ─── Remove ───
  function remove() {
    if (window[K].reduction === 0) return;
    debugLog("Removing overrides...");
    window[K].reduction = 0;

    if (origIWDesc) {
      if (origIWOwner !== window) { try { delete window.innerWidth; } catch (e) {} }
      else { Object.defineProperty(window, "innerWidth", origIWDesc); }
    }
    if (origMMValue) window.matchMedia = origMMValue;
    try { delete document.documentElement.clientWidth; } catch (e) {}

    window.dispatchEvent(new Event("resize"));
  }

  function handleAttr() {
    var val = document.documentElement.getAttribute("data-claude-vp-width");
    if (val && parseInt(val) > 0) install(parseInt(val));
    else remove();
  }

  var observer = new MutationObserver(handleAttr);
  if (document.documentElement) {
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-claude-vp-width"] });
    handleAttr();
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-claude-vp-width"] });
      handleAttr();
    });
  }
})();
