import { describe, expect, it } from "vitest";
import {
  formatAudioTime,
  normalizePlaybackRate,
  normalizeWaveform,
  waveBarHeights,
} from "./article-audio-player";

describe("article audio player", () => {
  it("formats audio times with and without hours", () => {
    expect(formatAudioTime(0)).toBe("0:00");
    expect(formatAudioTime(5)).toBe("0:05");
    expect(formatAudioTime(65)).toBe("1:05");
    expect(formatAudioTime(3599)).toBe("59:59");
    expect(formatAudioTime(3600)).toBe("1:00:00");
    expect(formatAudioTime(Number.NaN)).toBe("0:00");
  });

  it("builds deterministic wave bars within the visual range", () => {
    const bars = waveBarHeights(40);

    expect(waveBarHeights()).toHaveLength(64);
    expect(bars).toHaveLength(40);
    expect(bars.every((height) => height >= 20 && height <= 100)).toBe(true);
    expect(waveBarHeights(40)).toEqual(bars);
  });

  it("validates stored waveform data", () => {
    expect(normalizeWaveform([0, 20, 80, 100, 50, 10, 30, 90])).toEqual([0, 20, 80, 100, 50, 10, 30, 90]);
    expect(normalizeWaveform([1, 2, 3])).toBeNull();
    expect(normalizeWaveform([1, 2, 3, 4, 5, 6, 7, "x"])).toBeNull();
  });

  it("keeps playback speed between 0.5x and 2x", () => {
    expect(normalizePlaybackRate("0.5")).toBe(0.5);
    expect(normalizePlaybackRate("1.25")).toBe(1.25);
    expect(normalizePlaybackRate("2")).toBe(2);
    expect(normalizePlaybackRate("0.1")).toBe(0.5);
    expect(normalizePlaybackRate("4")).toBe(2);
    expect(normalizePlaybackRate("invalid")).toBe(1);
  });
});
