import { api } from "@/api/client";
import type { Backup } from "@/api/types";
import { byId } from "@/lib/dom";

interface BackupCallbacks {
  onError(message: string): void;
}

export class BackupController {
  private readonly exportButton = byId<HTMLButtonElement>("export-button");
  private readonly importButton = byId<HTMLButtonElement>("import-button");
  private readonly importInput = byId<HTMLInputElement>("import-input");

  constructor(private readonly callbacks: BackupCallbacks) {}

  mount(): void {
    this.exportButton.addEventListener("click", () => {
      void this.exportData();
    });
    this.importButton.addEventListener("click", () => this.importInput.click());
    this.importInput.addEventListener("change", () => {
      void this.importData();
    });
  }

  private async exportData(): Promise<void> {
    try {
      const blob = await api.exportBackupArchive();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date();
      const datePart = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");
      link.href = url;
      link.download = `pollo-city-${datePart}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      this.callbacks.onError("Não foi possível exportar os dados.");
    }
  }

  private async importData(): Promise<void> {
    const file = this.importInput.files?.[0];
    this.importInput.value = "";
    if (!file) {
      return;
    }

    try {
      if (!window.confirm("Substituir os dados atuais pelos do arquivo?")) {
        return;
      }
      if (file.name.toLowerCase().endsWith(".json")) {
        const payload = JSON.parse(await file.text()) as Backup;
        await api.importBackup(payload);
      } else {
        await api.importBackupArchive(file);
      }
      window.location.reload();
    } catch {
      this.callbacks.onError("Não foi possível importar os dados.");
    }
  }
}
