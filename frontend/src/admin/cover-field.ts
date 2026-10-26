import { api } from "@/api/client";
import { DEFAULT_THUMBNAIL } from "@/lib/constants";

interface CoverFieldElements {
  preview: HTMLImageElement;
  button: HTMLButtonElement;
  input: HTMLInputElement;
  label: HTMLElement;
}

interface CoverFieldCallbacks {
  onChange(): void;
  onError(message: string): void;
  onUploadStart?(): void;
  onUploadEnd?(): void;
}

export class CoverField {
  private value = "";
  private uploading = false;

  constructor(
    private readonly elements: CoverFieldElements,
    private readonly callbacks: CoverFieldCallbacks,
  ) {}

  mount(): void {
    this.elements.button.addEventListener("click", () => this.elements.input.click());
    this.elements.input.addEventListener("change", () => {
      void this.upload();
    });
    this.elements.preview.addEventListener("error", () => {
      if (!this.value) {
        return;
      }
      // Keep the saved value; a transient load failure must not erase the
      // thumbnail from the draft without an explicit user action.
      this.elements.preview.src = DEFAULT_THUMBNAIL;
      this.elements.label.textContent = "Trocar thumbnail";
      this.callbacks.onError("Não foi possível carregar a thumbnail.");
    });
  }

  setValue(value: string): void {
    this.value = value;
    this.elements.preview.src = value || DEFAULT_THUMBNAIL;
    this.elements.label.textContent = value ? "Trocar thumbnail" : "Adicionar thumbnail";
  }

  getValue(): string {
    return this.value;
  }

  isUploading(): boolean {
    return this.uploading;
  }

  private async upload(): Promise<void> {
    const file = this.elements.input.files?.[0];
    this.elements.input.value = "";
    if (!file) {
      return;
    }

    this.uploading = true;
    this.callbacks.onUploadStart?.();
    try {
      const url = await api.uploadImage(file);
      this.setValue(url);
      this.callbacks.onChange();
    } catch {
      this.callbacks.onError("Não foi possível carregar a imagem.");
    } finally {
      this.uploading = false;
      this.callbacks.onUploadEnd?.();
    }
  }
}
