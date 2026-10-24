import { query } from "@/lib/dom";

const INTRO_STORAGE_KEY = "pollo.intro.seen";
const GLYPHS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$*+=?!<>[]{}";
const WORD = "pollo.city";
const REVEAL_STEP = 90;
const SETTLE_DELAY = 240;
const EXIT_AT = 1500;

function hasSeenIntro(): boolean {
  try {
    return window.sessionStorage.getItem(INTRO_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markIntroSeen(): void {
  try {
    window.sessionStorage.setItem(INTRO_STORAGE_KEY, "1");
  } catch {
    // Storage can be unavailable in private contexts.
  }
}

export function mountIntro(): void {
  const intro = document.querySelector<HTMLElement>("#intro");
  if (!intro) {
    return;
  }

  const wordElement = query<HTMLElement>("#intro-word");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const forceIntro = new URLSearchParams(window.location.search).has("intro");

  if (reduceMotion || (hasSeenIntro() && !forceIntro)) {
    intro.remove();
    return;
  }

  const start = performance.now();
  let frameId = 0;
  let finished = false;

  const randomGlyph = (index: number, elapsed: number): string => {
    const seed = index * 31 + Math.floor(elapsed / 55) * 17;
    return GLYPHS[seed % GLYPHS.length] ?? "";
  };

  const finish = (): void => {
    if (finished) {
      return;
    }
    finished = true;
    window.cancelAnimationFrame(frameId);
    document.body.classList.remove("intro-active");
    intro.classList.add("is-leaving");
    markIntroSeen();
    window.setTimeout(() => intro.remove(), 900);
  };

  const skip = (): void => {
    if (finished) {
      return;
    }
    intro.classList.add("is-leaving");
    finish();
  };

  const render = (now: number): void => {
    if (finished) {
      return;
    }

    const elapsed = now - start;
    const revealed = Math.min(WORD.length, Math.floor(elapsed / REVEAL_STEP));
    let output = "";

    for (let index = 0; index < revealed; index += 1) {
      const settled = elapsed >= index * REVEAL_STEP + SETTLE_DELAY;
      output += settled ? (WORD[index] ?? "") : randomGlyph(index, elapsed);
    }

    wordElement.textContent = output;

    if (elapsed >= EXIT_AT) {
      intro.classList.add("is-leaving");
      finish();
      return;
    }

    frameId = window.requestAnimationFrame(render);
  };

  intro.hidden = false;
  intro.classList.add("is-active");
  document.body.classList.add("intro-active");
  intro.addEventListener("click", skip);
  document.addEventListener("keydown", skip, { once: true });
  frameId = window.requestAnimationFrame(render);
}
