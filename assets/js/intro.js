(function () {
  const intro = document.querySelector("#intro");
  if (!intro) return;

  const wordElement = document.querySelector("#intro-word");
  const word = "pollo.city";
  const glyphs = "#%&@$*+=?!<>[]{}0123456789";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const forceIntro = new URLSearchParams(window.location.search).has("intro");
  let seen = false;

  try {
    seen = window.sessionStorage.getItem("pollo.intro.seen") === "1";
  } catch (error) {
    seen = false;
  }

  if (reduceMotion || (seen && !forceIntro)) {
    intro.remove();
    return;
  }

  const start = performance.now();
  const typeEnd = 900;
  const lockEnd = 1600;
  const exitAt = 1900;
  let frameId = 0;
  let finished = false;

  function randomGlyph() {
    return glyphs[Math.floor(Math.random() * glyphs.length)];
  }

  function finish() {
    if (finished) return;
    finished = true;
    window.cancelAnimationFrame(frameId);
    document.body.classList.remove("intro-active");
    intro.classList.add("is-leaving");
    try {
      window.sessionStorage.setItem("pollo.intro.seen", "1");
    } catch (error) {
      void error;
    }
    window.setTimeout(() => intro.remove(), 900);
  }

  function skip() {
    if (finished) return;
    intro.classList.add("is-leaving");
    finish();
  }

  function render(now) {
    if (finished) return;
    const elapsed = now - start;
    let output = "";

    if (elapsed < typeEnd) {
      const progress = Math.min(1, elapsed / typeEnd);
      const visible = Math.floor(progress * (word.length + 1));
      output = Array.from(word).slice(0, visible).map(() => randomGlyph()).join("");
    } else if (elapsed < lockEnd) {
      const progress = Math.min(1, (elapsed - typeEnd) / (lockEnd - typeEnd));
      const locked = Math.floor(progress * (word.length + 1));
      output = Array.from(word)
        .map((character, index) => (index < locked ? character : randomGlyph()))
        .join("");
    } else {
      output = word;
    }

    wordElement.textContent = output;

    if (elapsed >= exitAt) {
      intro.classList.add("is-leaving");
      finish();
      return;
    }

    frameId = window.requestAnimationFrame(render);
  }

  intro.hidden = false;
  intro.classList.add("is-active");
  document.body.classList.add("intro-active");
  intro.addEventListener("click", skip);
  document.addEventListener("keydown", skip, { once: true });
  frameId = window.requestAnimationFrame(render);
})();
