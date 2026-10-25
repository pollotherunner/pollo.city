import { describe, expect, it } from "vitest";
import { waveformPeaks } from "./audio-waveform";

describe("audio waveform", () => {
  it("builds normalized peaks from channel audio", () => {
    const left = new Float32Array([0, 0, 1, 1, 0, 0, 0.5, 0.5]);
    const right = new Float32Array([0, 0, 1, 1, 0, 0, 0.5, 0.5]);

    expect(waveformPeaks([left, right], 4)).toEqual([0, 100, 0, 50]);
  });

  it("returns no peaks without audio", () => {
    expect(waveformPeaks([], 4)).toEqual([]);
    expect(waveformPeaks([new Float32Array()], 4)).toEqual([]);
  });
});
