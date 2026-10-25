const DEFAULT_BARS = 64;

export function waveformPeaks(channels: Float32Array[], count = DEFAULT_BARS): number[] {
  const length = channels[0]?.length ?? 0;
  if (!length || count < 1) {
    return [];
  }

  const peaks = Array.from<number>({ length: count }).fill(0);
  for (let bar = 0; bar < count; bar += 1) {
    const start = Math.floor((bar / count) * length);
    const end = Math.max(start + 1, Math.floor(((bar + 1) / count) * length));
    let total = 0;

    channels.forEach((channel) => {
      let channelPeak = 0;
      for (let index = start; index < end; index += 1) {
        channelPeak = Math.max(channelPeak, Math.abs(channel[index] ?? 0));
      }
      total += channelPeak;
    });

    peaks[bar] = total / channels.length;
  }

  const loudest = Math.max(...peaks, 0.0001);
  return peaks.map((peak) => Math.min(100, Math.round((peak / loudest) * 100)));
}

export async function extractWaveform(file: File, count = DEFAULT_BARS): Promise<number[]> {
  if (typeof window.AudioContext === "undefined") {
    return [];
  }

  const context = new window.AudioContext();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) =>
      buffer.getChannelData(index),
    );
    return waveformPeaks(channels, count);
  } catch {
    return [];
  } finally {
    void context.close().catch(() => undefined);
  }
}
