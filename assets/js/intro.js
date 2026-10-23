(function () {
  const intro = document.querySelector("#intro");
  if (!intro) return;

  const wordElement = document.querySelector("#intro-word");
  const word = "pollo.city";
  const glyphs = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$*+=?!<>[]{}";
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
  const revealStep = 90;
  const settleDelay = 240;
  const exitAt = 1500;
  let frameId = 0;
  let finished = false;

  function randomGlyph(index, elapsed) {
    const seed = index * 31 + Math.floor(elapsed / 55) * 17;
    return glyphs[seed % glyphs.length];
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
    const revealed = Math.min(word.length, Math.floor(elapsed / revealStep));
    let output = "";

    for (let index = 0; index < revealed; index += 1) {
      const settled = elapsed >= index * revealStep + settleDelay;
      output += settled ? word[index] : randomGlyph(index, elapsed);
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
