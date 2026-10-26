const WAVE_BAR_COUNT = 64;
const RATE_STORAGE_KEY = "pollo:article-audio-rate";

export function normalizePlaybackRate(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return 1;
  }
  const clamped = Math.min(2, Math.max(0.5, numeric));
  return Math.round(clamped / 0.25) * 0.25;
}

export function formatAudioTime(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  const pad = (value: number): string => String(value).padStart(2, "0");

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(remaining)}` : `${minutes}:${pad(remaining)}`;
}

export function waveBarHeights(count = WAVE_BAR_COUNT): number[] {
  return Array.from({ length: count }, (_, index) => {
    const primary = Math.abs(Math.sin(index * 0.55 + 0.8));
    const secondary = Math.abs(Math.sin(index * 1.37 + 2.1));
    return Math.min(100, Math.round((0.22 + primary * 0.58 + secondary * 0.14) * 100));
  });
}

export function normalizeWaveform(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length < 8 || value.length > 512) {
    return null;
  }

  const peaks: number[] = [];
  for (const peak of value) {
    if (typeof peak !== "number" || !Number.isFinite(peak)) {
      return null;
    }
    peaks.push(Math.min(100, Math.max(0, peak)));
  }
  return peaks;
}

export function waveformURL(source: string): string {
  const url = new URL(source, window.location.href);
  url.pathname = url.pathname.replace(/\.[^/]+$/, ".json");
  return url.href;
}

async function loadWaveform(source: string): Promise<number[] | null> {
  try {
    const response = await fetch(waveformURL(source), { headers: { Accept: "application/json" } });
    if (!response.ok) {
      return null;
    }
    return normalizeWaveform(await response.json());
  } catch {
    return null;
  }
}

export function mountArticleAudio(source: string): void {
  const host = document.getElementById("article-audio");
  const audio = document.getElementById("article-audio-source");
  const playButton = document.getElementById("article-audio-play");
  const wave = document.getElementById("article-audio-wave");
  const seek = document.getElementById("article-audio-seek");
  const current = document.getElementById("article-audio-current");
  const duration = document.getElementById("article-audio-duration");
  const rateSelect = document.getElementById("article-audio-rate");

  if (
    !(host instanceof HTMLElement) ||
    !(audio instanceof HTMLAudioElement) ||
    !(playButton instanceof HTMLButtonElement) ||
    !(wave instanceof HTMLElement) ||
    !(seek instanceof HTMLInputElement) ||
    !(current instanceof HTMLElement) ||
    !(duration instanceof HTMLElement) ||
    !(rateSelect instanceof HTMLSelectElement)
  ) {
    return;
  }

  const fallbackHeights = waveBarHeights();
  const bars = fallbackHeights.map((height) => {
    const bar = document.createElement("span");
    bar.className = "article-audio-wave-bar";
    bar.style.setProperty("--bar-height", `${height}%`);
    return bar;
  });
  wave.replaceChildren(...bars);

  const applyWaveform = (peaks: number[]): void => {
    bars.forEach((bar, index) => {
      const peakIndex = Math.min(peaks.length - 1, Math.floor((index / bars.length) * peaks.length));
      const peak = peaks[peakIndex] ?? 0;
      bar.style.setProperty("--bar-height", `${12 + peak * 0.88}%`);
    });
  };

  const storedRate = (() => {
    try {
      return window.localStorage.getItem(RATE_STORAGE_KEY);
    } catch {
      return null;
    }
  })();
  const applyRate = (rate: number): void => {
    audio.defaultPlaybackRate = rate;
    audio.playbackRate = rate;
  };

  const initialRate = normalizePlaybackRate(storedRate ?? 1);
  rateSelect.value = String(initialRate);
  audio.preservesPitch = true;
  applyRate(initialRate);

  rateSelect.addEventListener("change", () => {
    const rate = normalizePlaybackRate(rateSelect.value);
    rateSelect.value = String(rate);
    applyRate(rate);
    try {
      window.localStorage.setItem(RATE_STORAGE_KEY, String(rate));
    } catch {
      // Storage is optional.
    }
  });

  const setPlaying = (playing: boolean): void => {
    host.classList.toggle("is-playing", playing);
    const label = playing ? "Pausar áudio" : "Reproduzir áudio";
    playButton.setAttribute("aria-label", label);
    playButton.title = label;
  };

  const update = (): void => {
    const total = Number.isFinite(audio.duration) ? audio.duration : 0;
    const ratio = total > 0 ? Math.min(1, Math.max(0, audio.currentTime / total)) : 0;
    const playedBars = Math.ceil(ratio * bars.length);

    bars.forEach((bar, index) => {
      bar.classList.toggle("is-played", index < playedBars);
    });
    seek.value = String(Math.round(ratio * 1000));
    current.textContent = formatAudioTime(audio.currentTime);
    duration.textContent = formatAudioTime(total);
    seek.setAttribute("aria-valuetext", `${formatAudioTime(audio.currentTime)} de ${formatAudioTime(total)}`);
  };

  playButton.addEventListener("click", () => {
    if (audio.paused) {
      void audio.play().catch(() => {
        setPlaying(false);
      });
      return;
    }
    audio.pause();
  });

  seek.addEventListener("input", () => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
      return;
    }
    audio.currentTime = (Number(seek.value) / 1000) * audio.duration;
    update();
  });

  audio.addEventListener("play", () => {
    applyRate(normalizePlaybackRate(rateSelect.value));
    setPlaying(true);
  });
  audio.addEventListener("pause", () => setPlaying(false));
  audio.addEventListener("timeupdate", update);
  audio.addEventListener("loadedmetadata", () => {
    applyRate(normalizePlaybackRate(rateSelect.value));
    update();
  });
  audio.addEventListener("durationchange", update);
  audio.addEventListener("ended", () => {
    audio.currentTime = 0;
    setPlaying(false);
    update();
  });
  audio.addEventListener("error", () => {
    host.hidden = true;
  });

  audio.src = source;
  host.hidden = false;
  update();

  void loadWaveform(source).then((peaks) => {
    if (peaks) {
      applyWaveform(peaks);
    }
  });
}
