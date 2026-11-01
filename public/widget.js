/* Dumpling feedback widget — one script tag, no dependencies.
 *   <script src="https://YOUR-HEARD/widget.js" data-key="hrd_…" data-app="chalk" async></script>
 * Adds a Feedback button. Sends the person's own words to Dumpling, with the page,
 * their browser and any recent errors attached so they never have to type them.
 * Optional: data-target="#el" mounts it inside an element instead of the page corner. */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var key = script.getAttribute("data-key") || "";
  var app = script.getAttribute("data-app") || "this app";
  var host = script.getAttribute("data-host") || new URL(script.src).origin;
  var target = script.getAttribute("data-target");

  var errors = [];
  window.addEventListener("error", function (e) { errors.push(String(e.message || e.error || "Error")); errors = errors.slice(-3); });
  window.addEventListener("unhandledrejection", function (e) { errors.push(String((e.reason && e.reason.message) || e.reason || "Unhandled promise rejection")); errors = errors.slice(-3); });

  var mountAt = (target && document.querySelector(target)) || document.body;
  // One widget per place, even if an app includes the script twice.
  for (var i = 0; i < mountAt.children.length; i++) if (mountAt.children[i].hasAttribute("data-heard-widget")) return;
  var hostEl = document.createElement("div");
  hostEl.setAttribute("data-heard-widget", "");
  hostEl.style.cssText = target ? "position:absolute;inset:0;pointer-events:none;z-index:5" : "position:fixed;inset:auto 20px 20px auto;z-index:2147483000";
  mountAt.appendChild(hostEl);
  var root = hostEl.attachShadow({ mode: "open" });

  root.innerHTML =
    '<style>' +
    ':host{all:initial}*{box-sizing:border-box;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}' +
    '.wrap{position:' + (target ? "absolute;right:16px;bottom:16px" : "relative") + ';display:flex;flex-direction:column;align-items:flex-end;gap:10px;pointer-events:auto}' +
    '.fab{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 14px;border:0;border-radius:18px;background:#1b1c20;color:#fff;font-size:13px;font-weight:500;cursor:pointer;box-shadow:0 4px 14px rgba(16,17,20,.22)}' +
    '.fab:hover{background:#2b2c33}' +
    '.card{width:320px;padding:14px;border-radius:12px;background:#fff;color:#1b1c20;box-shadow:0 0 0 1px rgba(16,17,20,.08),0 16px 40px -12px rgba(16,17,20,.28);animation:pop .16s cubic-bezier(.2,.8,.2,1)}' +
    '@keyframes pop{from{opacity:0;transform:translateY(6px) scale(.98)}}' +
    '.top{display:flex;align-items:center;justify-content:space-between;font-size:13.5px;font-weight:600}' +
    '.x{border:0;background:none;color:#8b8d97;font-size:18px;line-height:1;cursor:pointer;padding:2px 4px;border-radius:6px}.x:hover{background:#f2f2f4}' +
    '.seg{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-top:10px;padding:2px;border-radius:8px;background:#f2f2f4}' +
    '.seg button{height:26px;border:0;border-radius:6px;background:transparent;font-size:12.5px;font-weight:500;color:#5d5f69;cursor:pointer}' +
    '.seg button.on{background:#fff;color:#1b1c20;box-shadow:0 0 0 1px #dedee3,0 1px 2px rgba(16,17,20,.06)}' +
    'textarea,input{width:100%;margin-top:8px;border:0;border-radius:7px;padding:8px 10px;font-size:13px;line-height:1.45;color:#1b1c20;box-shadow:inset 0 0 0 1px #dedee3;outline:none;resize:none}' +
    'textarea{height:96px}textarea:focus,input:focus{box-shadow:inset 0 0 0 1px #5e6ad2,0 0 0 3px rgba(94,106,210,.14)}' +
    '.foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px}' +
    '.att{font-size:11.5px;color:#8b8d97;line-height:1.35}' +
    '.send{height:30px;padding:0 12px;border:0;border-radius:7px;background:#5e6ad2;color:#fff;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap}' +
    '.send:disabled{opacity:.5;cursor:default}' +
    '.ok{display:flex;gap:10px;align-items:flex-start;margin-top:10px;font-size:13px;line-height:1.5;color:#5d5f69}' +
    '.tick{display:grid;place-items:center;width:22px;height:22px;flex:none;border-radius:50%;background:#4cb782;color:#fff;font-size:13px}' +
    '.err{margin-top:8px;font-size:12px;color:#d4483a}' +
    '.brand{margin-top:10px;font-size:11px;color:#a3a5ad;text-align:right}' +
    '</style>' +
    '<div class="wrap"><div class="card" hidden></div><button class="fab" type="button" aria-haspopup="dialog">' +
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5.2c-5.3 0-9 4.6-9 8.9 0 2.6 2 4.6 4.6 4.6h8.8c2.6 0 4.6-2 4.6-4.6 0-4.3-3.7-8.9-9-8.9z"/><path d="M12 5.2c-1 2.6-2.9 4.6-5.6 5.6M12 5.2v6M12 5.2c1 2.6 2.9 4.6 5.6 5.6"/></svg>Feedback</button></div>';

  var card = root.querySelector(".card");
  var fab = root.querySelector(".fab");
  var kind = "problem";

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function form() {
    var n = errors.length;
    card.innerHTML =
      '<div class="top"><span>Tell the ' + esc(app) + ' team</span><button class="x" aria-label="Close">×</button></div>' +
      '<div class="seg" role="radiogroup">' +
      ["problem", "idea", "praise"].map(function (k) { return '<button type="button" data-k="' + k + '" class="' + (k === kind ? "on" : "") + '">' + { problem: "Problem", idea: "Idea", praise: "Praise" }[k] + "</button>"; }).join("") +
      "</div>" +
      '<textarea placeholder="What happened? Your own words are perfect."></textarea>' +
      '<input placeholder="Your name (optional)">' +
      '<div class="foot"><span class="att">Attached for you: this page, your browser' + (n ? ", " + n + " recent error" + (n > 1 ? "s" : "") : "") + '</span><button class="send" disabled>Send</button></div>' +
      '<div class="err" hidden></div><div class="brand">Read by a person · Dumpling</div>';
    var ta = card.querySelector("textarea"), name = card.querySelector("input"), send = card.querySelector(".send"), err = card.querySelector(".err");
    card.querySelector(".x").onclick = close;
    card.querySelectorAll(".seg button").forEach(function (b) {
      b.onclick = function () { kind = b.getAttribute("data-k"); card.querySelectorAll(".seg button").forEach(function (x) { x.className = x === b ? "on" : ""; }); };
    });
    ta.oninput = function () { send.disabled = ta.value.trim().length < 2; };
    send.onclick = function () {
      send.disabled = true; send.textContent = "Sending…"; err.hidden = true;
      fetch(host + "/api/intake", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: key, text: ta.value, kind: kind, name: name.value, page: location.href, userAgent: navigator.userAgent, errors: errors }),
      }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.message || "That didn’t send."); return j; }); })
        .then(function (j) { done(j.message); })
        .catch(function (e) { err.textContent = e.message || "That didn’t send — try again."; err.hidden = false; send.disabled = false; send.textContent = "Send"; });
    };
    setTimeout(function () { ta.focus(); }, 30);
  }

  function done(msg) {
    card.innerHTML = '<div class="top"><span>Sent</span><button class="x" aria-label="Close">×</button></div>' +
      '<div class="ok"><span class="tick">✓</span><span>' + esc(msg || "Thanks — a person on the team reads every note.") + "</span></div>";
    card.querySelector(".x").onclick = close;
  }
  function open() { kind = "problem"; form(); card.hidden = false; fab.setAttribute("aria-expanded", "true"); }
  function close() { card.hidden = true; fab.setAttribute("aria-expanded", "false"); }
  fab.onclick = function () { card.hidden ? open() : close(); };
  window.Dumpling = { open: open, close: close };
})();
