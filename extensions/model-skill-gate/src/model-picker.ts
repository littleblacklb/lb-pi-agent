import type { Component, TUI } from "@earendil-works/pi-tui";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { ModelRef } from "./matcher";

export interface PickerModel extends ModelRef {
  name?: string;
}

export interface PickerResult {
  save: boolean;
  selected: Set<string>;
}

const UP = new Set(["\u001b[A", "\u001bOA"]);
const DOWN = new Set(["\u001b[B", "\u001bOB"]);
const RIGHT = new Set(["\u001b[C", "\u001bOC"]);
const LEFT = new Set(["\u001b[D", "\u001bOD"]);
const ENTER = new Set(["\r", "\n"]);
const ESC = "\u001b";

export function modelKey(model: ModelRef): string {
  return `${model.provider}/${model.id}`;
}

export function moveCursor(index: number, key: "up" | "down" | "left" | "right", count: number, columns: number): number {
  if (count === 0) return 0;
  switch (key) {
    case "left": return Math.max(0, index - 1);
    case "right": return Math.min(count - 1, index + 1);
    case "up": return Math.max(0, index - columns);
    case "down": return Math.min(count - 1, index + columns);
  }
}

export class ModelSkillPicker implements Component {
  private cursor = 0;
  private readonly selected: Set<string>;

  constructor(
    private readonly tui: TUI,
    private readonly theme: Theme,
    private readonly models: PickerModel[],
    selected: Iterable<string>,
    private readonly done: (result: PickerResult) => void,
  ) {
    this.selected = new Set(selected);
  }

  invalidate(): void {}

  handleInput(data: string): void {
    const columns = this.columns();
    if (UP.has(data)) this.cursor = moveCursor(this.cursor, "up", this.models.length, columns);
    else if (DOWN.has(data)) this.cursor = moveCursor(this.cursor, "down", this.models.length, columns);
    else if (LEFT.has(data)) this.cursor = moveCursor(this.cursor, "left", this.models.length, columns);
    else if (RIGHT.has(data)) this.cursor = moveCursor(this.cursor, "right", this.models.length, columns);
    else if (data === " " || data === "x") this.toggleCurrent();
    else if (ENTER.has(data)) this.done({ save: true, selected: this.selected });
    else if (data === ESC || data === "\u0003") this.done({ save: false, selected: this.selected });
    else return;
    this.tui.requestRender();
  }

  render(width: number): string[] {
    const inner = Math.max(1, width - 2);
    const columns = width >= 92 && this.models.length > 1 ? 2 : 1;
    const cellWidth = columns === 2 ? Math.max(20, Math.floor((inner - 3) / 2)) : inner;
    const lines = [
      "",
      ` ${this.theme.fg("accent", "Superpowers model access")}`,
      ` ${this.theme.fg("dim", "Arrow keys move. Space toggles. Enter saves. Esc cancels.")}`,
      "",
    ];

    for (let start = 0; start < this.models.length; start += columns) {
      const row: string[] = [];
      for (let offset = 0; offset < columns; offset++) {
        const index = start + offset;
        const model = this.models[index];
        row.push(model ? this.renderModel(model, index, cellWidth) : " ".repeat(cellWidth));
      }
      lines.push(columns === 2 ? row.join("   ") : row[0]!);
    }
    lines.push("", ` ${this.theme.fg("dim", `${this.selected.size}/${this.models.length} models selected`)}`, "");
    return this.box(lines, width, "model-skill-gate");
  }

  private columns(): number {
    return this.models.length > 1 ? 2 : 1;
  }

  private toggleCurrent(): void {
    const model = this.models[this.cursor];
    if (!model) return;
    const key = modelKey(model);
    if (this.selected.has(key)) this.selected.delete(key);
    else this.selected.add(key);
  }

  private renderModel(model: PickerModel, index: number, width: number): string {
    const selected = this.selected.has(modelKey(model));
    const marker = selected ? "[x]" : "[ ]";
    const cursor = index === this.cursor ? ">" : " ";
    const label = `${cursor} ${marker} ${model.name ?? model.id}`;
    const suffix = model.name && model.name !== model.id ? ` (${model.provider}/${model.id})` : ` (${model.provider})`;
    const text = truncateToWidth(`${label}${suffix}`, width, "...", true);
    return index === this.cursor ? this.theme.bg("selectedBg", this.theme.fg("text", text)) : text;
  }

  private box(lines: string[], width: number, title: string): string[] {
    const inner = Math.max(1, width - 2);
    const titleText = truncateToWidth(` ${title} `, inner);
    const titleWidth = visibleWidth(titleText);
    const left = "-".repeat(Math.floor((inner - titleWidth) / 2));
    const right = "-".repeat(Math.max(0, inner - titleWidth - left.length));
    return [
      this.theme.fg("border", `+${left}`) + this.theme.fg("accent", titleText) + this.theme.fg("border", `${right}+`),
      ...lines.map((line) => this.theme.fg("border", "|") + truncateToWidth(line, inner, "...", true) + this.theme.fg("border", "|")),
      this.theme.fg("border", `+${"-".repeat(inner)}+`),
    ];
  }
}
