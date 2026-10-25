export interface PromptOptions {
  label: string;
  value?: string;
  placeholder?: string;
  submitLabel?: string;
  removeLabel?: string;
  anchor?: { left: number; top: number };
}

export interface PromptResult {
  value: string;
  remove: boolean;
}

export function openPrompt(root: HTMLElement, options: PromptOptions): Promise<PromptResult | null> {
  return new Promise((resolve) => {
    const dialog = document.createElement("div");
    dialog.className = "pe-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "false");
    dialog.setAttribute("aria-label", options.label);

    const form = document.createElement("form");
    form.className = "pe-dialog-form";

    const label = document.createElement("label");
    label.className = "pe-dialog-label";
    label.textContent = options.label;

    const input = document.createElement("input");
    input.className = "pe-dialog-input";
    input.type = "text";
    input.value = options.value ?? "";
    input.placeholder = options.placeholder ?? "";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.id = `pe-dialog-${Date.now()}`;
    label.htmlFor = input.id;

    const actions = document.createElement("div");
    actions.className = "pe-dialog-actions";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "pe-dialog-button";
    cancel.textContent = "Cancelar";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "pe-dialog-button pe-dialog-remove";
    remove.textContent = options.removeLabel ?? "Remover";
    remove.hidden = !options.removeLabel;

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "pe-dialog-button pe-dialog-submit";
    submit.textContent = options.submitLabel ?? "Aplicar";

    actions.append(cancel, remove, submit);
    form.append(label, input, actions);
    dialog.append(form);
    root.append(dialog);

    const anchor = options.anchor;
    if (anchor) {
      dialog.style.left = `${Math.max(8, anchor.left)}px`;
      dialog.style.top = `${Math.max(8, anchor.top)}px`;
    }

    let settled = false;

    const close = (result: PromptResult | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      document.removeEventListener("pointerdown", onOutside, true);
      dialog.remove();
      resolve(result);
    };

    const onOutside = (event: PointerEvent): void => {
      if (event.target instanceof Node && !dialog.contains(event.target)) {
        close(null);
      }
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      close({ value: input.value.trim(), remove: false });
    });

    cancel.addEventListener("click", () => close(null));
    remove.addEventListener("click", () => close({ value: "", remove: true }));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(null);
      }
    });

    document.addEventListener("pointerdown", onOutside, true);
    window.requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  });
}
