// Showrunner - Copyright (c) 2026 Chetas P. MIT License.
// Runs INSIDE every page (via context.addInitScript). Self-contained on purpose: it is serialised with
// Function.prototype.toString, so it must not reference anything outside its own body.
// It draws captions, title cards and a fake cursor with a click ripple, so the recording shows what the
// scripted mouse is doing. Everything lives in one fixed, pointer-events:none element that never affects the app.
export function overlayInit({ storage, cursor }) {
  try {
    for (const [k, v] of Object.entries(storage || {})) localStorage.setItem(k, String(v));
  } catch { /* storage can be unavailable on opaque origins; the demo still works */ }

  const boot = () => {
    if (document.getElementById("__sr")) return;
    const root = document.createElement("div");
    root.id = "__sr";
    root.innerHTML = `
      <style>
        #__sr{position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:-apple-system,"Segoe UI",Inter,Helvetica,Arial,sans-serif}
        #__sr_cap{position:absolute;left:50%;bottom:34px;transform:translate(-50%,16px);opacity:0;transition:opacity .45s,transform .45s;
          max-width:1060px;min-width:520px;padding:14px 26px 15px;border-radius:14px;background:rgba(15,18,28,.92);color:#fff;
          box-shadow:0 12px 40px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.12);border-left:4px solid #f59e0b}
        #__sr_cap.on{opacity:1;transform:translate(-50%,0)}
        #__sr_cap.left{left:36px;transform:translate(0,16px);min-width:0;max-width:640px}
        #__sr_cap.left.on{transform:none}
        #__sr_cap.right{left:auto;right:36px;transform:translate(0,16px);min-width:0;max-width:640px}
        #__sr_cap.right.on{transform:none}
        #__sr_cap b{display:block;font-size:20px;letter-spacing:.1px;margin-bottom:3px}
        #__sr_cap span{display:block;font-size:15px;line-height:1.4;color:#d5d9e3}
        #__sr_card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;
          background:radial-gradient(1200px 700px at 50% 35%,#1f2740 0%,#0c1020 70%);color:#fff;opacity:0;transition:opacity .6s}
        #__sr_card.on{opacity:1}
        #__sr_card h1{font-size:54px;font-weight:700;margin:0 0 14px;letter-spacing:.3px}
        #__sr_card h1 i{font-style:normal;color:#f59e0b}
        #__sr_card p{font-size:22px;color:#c3c9d8;margin:0;max-width:900px;line-height:1.5}
        #__sr_card ul{list-style:none;padding:0;margin:26px 0 0;text-align:left;font-size:20px;color:#e6e9f2;line-height:1.85}
        #__sr_card li:before{content:"\\2713";color:#34d399;margin-right:12px;font-weight:700}
        #__sr_cur{position:absolute;left:0;top:0;width:26px;height:26px;transform:translate(-100px,-100px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))}
        #__sr_rip{position:absolute;width:14px;height:14px;border-radius:50%;border:3px solid #f59e0b;opacity:0;transform:translate(-50%,-50%) scale(.4)}
        #__sr_rip.go{animation:__sr_rip .55s ease-out}
        @keyframes __sr_rip{0%{opacity:.95;transform:translate(-50%,-50%) scale(.4)}100%{opacity:0;transform:translate(-50%,-50%) scale(3.2)}}
      </style>
      <div id="__sr_card"></div>
      <div id="__sr_cap"></div>
      ${cursor === false ? "" : `<svg id="__sr_cur" viewBox="0 0 24 24"><path d="M3 2l7.5 19 2.6-7.6L21 10.8z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>
      <div id="__sr_rip"></div>`}`;
    document.documentElement.appendChild(root);

    // Text is always inserted as text nodes, never as HTML: scenario copy cannot inject markup.
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const cap = root.querySelector("#__sr_cap");
    const card = root.querySelector("#__sr_card");
    window.__sr = {
      cap(title, text, position) {
        if (!title) { cap.classList.remove("on"); return; }
        cap.classList.toggle("left", position === "left");
        cap.classList.toggle("right", position === "right");
        cap.innerHTML = `<b>${esc(title)}</b>${text ? `<span>${esc(text)}</span>` : ""}`;
        cap.classList.add("on");
      },
      card(title, text, items) {
        if (!title) { card.classList.remove("on"); return; }
        card.innerHTML = `<h1>${esc(title)}</h1>${text ? `<p>${esc(text)}</p>` : ""}${items ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}`;
        card.classList.add("on");
      },
    };

    if (cursor === false) return;
    const cur = root.querySelector("#__sr_cur");
    const rip = root.querySelector("#__sr_rip");
    const place = (x, y) => { cur.style.transform = `translate(${x - 4}px,${y - 2}px)`; try { sessionStorage.setItem("__sr_pos", x + "," + y); } catch { /* ignore */ } };
    let saved = [];
    try { saved = (sessionStorage.getItem("__sr_pos") || "").split(",").map(Number); } catch { /* ignore */ }
    if (saved.length === 2 && !Number.isNaN(saved[0])) place(saved[0], saved[1]); // keep the cursor where it was across page loads
    addEventListener("mousemove", (e) => place(e.clientX, e.clientY), true);
    addEventListener("mousedown", (e) => { rip.style.left = e.clientX + "px"; rip.style.top = e.clientY + "px"; rip.classList.remove("go"); void rip.offsetWidth; rip.classList.add("go"); }, true);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
}
