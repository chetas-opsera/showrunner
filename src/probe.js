// Showrunner - Copyright (c) 2026 Chetas P. MIT License.
// `showrunner probe <url>`: list what a scenario can target on a page, as ready-to-paste target objects.
// Authoring scenarios blind is the slow part; this turns "which selector?" into a copy-paste.
import { chromium } from "playwright-core";

export async function probe(url, { browser = { channel: "chrome" }, viewport = { width: 1440, height: 900 }, storage = {}, limit = 40 } = {}) {
  const launch = { headless: true };
  if (browser.executablePath) launch.executablePath = browser.executablePath; else launch.channel = browser.channel;
  const b = await chromium.launch(launch);
  try {
    const ctx = await b.newContext({ viewport });
    await ctx.addInitScript((s) => { try { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, String(v)); } catch { /* ignore */ } }, storage);
    const page = await ctx.newPage();
    page.setDefaultTimeout(8000);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    const found = await page.evaluate((max) => {
      const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 2 && r.height > 2 && s.visibility !== "hidden" && s.display !== "none"; };
      const text = (e) => (e.getAttribute("aria-label") || e.innerText || e.value || "").replace(/\s+/g, " ").trim().slice(0, 60);
      const out = { title: document.title, url: location.href, headings: [], links: [], buttons: [], tabs: [], inputs: [], testIds: [] };
      for (const e of document.querySelectorAll("h1,h2,h3")) if (vis(e) && out.headings.length < max) out.headings.push(text(e));
      for (const e of document.querySelectorAll("a[href]")) if (vis(e) && text(e) && out.links.length < max) out.links.push({ role: "link", name: text(e), href: e.getAttribute("href") });
      for (const e of document.querySelectorAll("button,[role=button]")) if (vis(e) && text(e) && out.buttons.length < max) out.buttons.push({ role: "button", name: text(e) });
      for (const e of document.querySelectorAll("[role=tab]")) if (vis(e) && out.tabs.length < max) out.tabs.push({ role: "tab", name: text(e) });
      for (const e of document.querySelectorAll("input,textarea,select")) if (vis(e) && out.inputs.length < max) {
        const label = e.labels?.[0]?.innerText?.trim() || e.getAttribute("aria-label") || e.placeholder || e.name || e.type;
        out.inputs.push({ label, type: e.type || e.tagName.toLowerCase() });
      }
      for (const e of document.querySelectorAll("[data-testid]")) if (vis(e) && out.testIds.length < max) out.testIds.push({ testId: e.getAttribute("data-testid") });
      return out;
    }, limit);
    return found;
  } finally {
    await b.close();
  }
}
