import type { Tag } from "@/api/types";
import { escapeHtml } from "@/lib/dom";
import { refreshIcons } from "@/lib/icons";
import { MAX_TAGS, normalizeTags, tagSlug } from "@/lib/tags";

interface TagEditorElements {
  chips: HTMLElement;
  input: HTMLInputElement;
  suggestions: HTMLElement;
}

export class TagEditor {
  private tags: string[] = [];
  private available: Tag[] = [];

  constructor(
    private readonly elements: TagEditorElements,
    private readonly onChange: () => void,
  ) {}

  mount(): void {
    this.elements.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === ",") {
        event.preventDefault();
        this.commitInput();
        return;
      }
      if (event.key === "Backspace" && !this.elements.input.value) {
        const last = this.tags[this.tags.length - 1];
        if (last) {
          this.remove(last);
        }
        return;
      }
      if (event.key === "Escape") {
        this.elements.input.value = "";
      }
    });

    this.elements.input.addEventListener("blur", () => this.commitInput());

    this.elements.chips.addEventListener("mousedown", (event) => {
      if (event.target instanceof Element && event.target.closest("[data-remove-tag]")) {
        event.preventDefault();
      }
    });

    this.elements.chips.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }
      const button = event.target.closest<HTMLButtonElement>("[data-remove-tag]");
      if (button?.dataset.removeTag) {
        this.remove(button.dataset.removeTag);
      }
    });

    this.elements.suggestions.addEventListener("mousedown", (event) => {
      if (event.target instanceof Element && event.target.closest("[data-suggest-tag]")) {
        event.preventDefault();
      }
    });

    this.elements.suggestions.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }
      const button = event.target.closest<HTMLButtonElement>("[data-suggest-tag]");
      if (button?.dataset.suggestTag) {
        this.add([button.dataset.suggestTag]);
        this.elements.input.focus();
      }
    });
  }

  setTags(tags: string[]): void {
    this.tags = normalizeTags(tags);
    this.elements.input.value = "";
    this.render();
  }

  setAvailable(tags: Tag[]): void {
    this.available = tags;
    this.render();
  }

  getTags(): string[] {
    return normalizeTags([...this.tags, ...this.pendingInput()]);
  }

  private pendingInput(): string[] {
    return this.elements.input.value
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  private commitInput(): void {
    const pending = this.pendingInput();
    if (!pending.length) {
      return;
    }
    this.elements.input.value = "";
    this.add(pending);
  }

  private add(values: string[]): void {
    const previous = this.tags.length;
    this.tags = normalizeTags([...this.tags, ...values]);
    this.render();
    if (this.tags.length !== previous) {
      this.onChange();
    }
  }

  private remove(value: string): void {
    const slug = tagSlug(value);
    this.tags = this.tags.filter((tag) => tagSlug(tag) !== slug);
    this.render();
    this.onChange();
  }

  private render(): void {
    this.elements.chips.innerHTML = this.tags
      .map(
        (tag) =>
          `<span class="tag-chip">${escapeHtml(tag)}<button type="button" data-remove-tag="${escapeHtml(tag)}" aria-label="Remover ${escapeHtml(tag)}"><i data-lucide="x"></i></button></span>`,
      )
      .join("");

    const selectedSlugs = new Set(this.tags.map((tag) => tagSlug(tag)));
    const suggestions = this.available.filter((tag) => !selectedSlugs.has(tag.slug));
    const showSuggestions = suggestions.length > 0 && this.tags.length < MAX_TAGS;

    this.elements.suggestions.hidden = !showSuggestions;
    this.elements.suggestions.innerHTML = showSuggestions
      ? `<span class="tag-suggestions-label">Tags usadas</span>${suggestions
          .map(
            (tag) =>
              `<button class="tag-suggestion" type="button" data-suggest-tag="${escapeHtml(tag.name)}">${escapeHtml(tag.name)}</button>`,
          )
          .join("")}`
      : "";

    this.elements.input.disabled = this.tags.length >= MAX_TAGS;
    this.elements.input.placeholder = this.tags.length >= MAX_TAGS ? "Máximo de 8 tags" : "Adicionar tag";
    refreshIcons(this.elements.chips);
    refreshIcons(this.elements.suggestions);
  }
}
