/**
 * Imperative DOM pool for the screen-edge hints: no React state, the globe
 * frame loop writes transforms straight to the elements (no re-render per
 * frame). One element per opponent, created on first use.
 */

export function createHintPool(container) {
  const els = new Map();

  const ensure = (userId, name, color) => {
    let el = els.get(userId);
    if (!el) {
      el = document.createElement("div");
      el.className = "cq-hint";
      el.setAttribute("aria-hidden", "true");
      const block = document.createElement("i");
      block.className = "cq-hint__block";
      const label = document.createElement("b");
      label.className = "cq-hint__name";
      el.append(block, label);
      container.appendChild(el);
      els.set(userId, el);
    }
    el.style.setProperty("--c", color);
    const label = el.lastChild;
    const short = String(name || "?").slice(0, 8);
    if (label.textContent !== short) label.textContent = short;
    return el;
  };

  return {
    /** Show / move the hint of one opponent. */
    show(userId, { name, color, x, y, dir, leftSide }) {
      const el = ensure(userId, name, color);
      el.dataset.dir = String(dir);
      el.classList.toggle("is-left", leftSide);
      // Block centre sits on (x, y): the tag extends inward.
      const shift = leftSide ? "translate(-100%, 0) translate(4px, 0)" : "translate(-4px, 0)";
      const transform = `translate(${Math.round(x)}px, ${Math.round(y - 5)}px) ${shift}`;
      // Called every frame while the cursor is out of sight: only touch the DOM on change.
      if (el.__transform !== transform) {
        el.__transform = transform;
        el.style.transform = transform;
      }
      if (!el.classList.contains("is-on")) el.classList.add("is-on");
    },
    hide(userId) {
      const el = els.get(userId);
      if (el?.classList.contains("is-on")) el.classList.remove("is-on");
    },
    prune(keep) {
      for (const [id, el] of els) {
        if (keep.has(id)) continue;
        el.remove();
        els.delete(id);
      }
    },
    dispose() {
      els.forEach((el) => el.remove());
      els.clear();
    },
  };
}
