import { api } from "@/api/client";
import { extractWaveform } from "@/lib/audio-waveform";

interface AudioFieldElements {
  preview: HTMLAudioElement;
  button: HTMLButtonElement;
  input: HTMLInputElement;
  removeButton: HTMLButtonElement;
  label: HTMLElement;
  status: HTMLElement;
}

interface AudioFieldCallbacks {
  onChange(): void;
  onError(message: string): void;
}

export class AudioField {
  private value = "";
  private uploading = false;

  constructor(
    private readonly elements: AudioFieldElements,
    private readonly callbacks: AudioFieldCallbacks,
  ) {}

  mount(): void {
    this.elements.button.addEventListener("click", () => this.elements.input.click());
    this.elements.input.addEventListener("change", () => {
      void this.upload();
    });
    this.elements.removeButton.addEventListener("click", () => {
      this.setValue("");
      this.setStatus("Áudio removido.");
      this.callbacks.onChange();
    });
    this.elements.preview.addEventListener("error", () => {
      if (this.value) {
        this.callbacks.onError("Não foi possível carregar o áudio.");
      }
    });
  }

  setValue(value: string): void {
    this.value = value;
    this.setStatus("");
    if (value) {
      this.elements.preview.src = value;
      this.elements.preview.hidden = false;
      this.elements.label.textContent = "Trocar áudio";
      this.elements.removeButton.hidden = false;
      return;
    }

    this.elements.preview.pause();
    this.elements.preview.removeAttribute("src");
    this.elements.preview.load();
    this.elements.preview.hidden = true;
    this.elements.label.textContent = "Adicionar áudio";
    this.elements.removeButton.hidden = true;
  }

  getValue(): string {
    return this.value;
  }

  isUploading(): boolean {
    return this.uploading;
  }

  private setStatus(message: string): void {
    this.elements.status.textContent = message;
  }

  private async upload(): Promise<void> {
    const file = this.elements.input.files?.[0];
    this.elements.input.value = "";
    if (!file) {
      return;
    }

    this.uploading = true;
    this.elements.button.disabled = true;
    this.elements.removeButton.disabled = true;
    this.setStatus("Analisando áudio…");
    try {
      const waveform = await extractWaveform(file);
      this.setStatus(`Enviando ${file.name}…`);
      const url = await api.uploadAudio(file, waveform);
      this.setValue(url);
      this.setStatus("Áudio carregado.");
      this.callbacks.onChange();
    } catch {
      this.setStatus("");
      this.callbacks.onError("Não foi possível enviar o áudio.");
    } finally {
      this.uploading = false;
      this.elements.button.disabled = false;
      this.elements.removeButton.disabled = false;
    }
  }
}
