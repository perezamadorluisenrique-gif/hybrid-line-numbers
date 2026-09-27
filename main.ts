import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import type { Extension } from '@codemirror/state';

import { hybridLineNumbers } from './src/extension.ts';
import { NUMBER_MODES, fromVimFlags, isNumberMode, vimFlags } from './src/numbers.ts';
import type { NumberMode, VimNumberFlags } from './src/numbers.ts';

interface HybridLineNumbersSettings {
  /** Draw the gutter at all; the toggle command flips this. */
  enabled: boolean;
  mode: NumberMode;
  absoluteInInsert: boolean;
}

const DEFAULT_SETTINGS: HybridLineNumbersSettings = {
  enabled: true,
  mode: 'hybrid',
  absoluteInInsert: false,
};

/** The part of @replit/codemirror-vim's `Vim` object used for `:set`. */
interface VimApi {
  defineOption(
    name: string,
    defaultValue: unknown,
    type: 'boolean',
    aliases: string[],
    callback?: (value: unknown) => unknown,
  ): void;
}

/** Obsidian exposes the Vim module on the window, Vim mode on or off. */
function vimApi(): VimApi | null {
  return (window as unknown as { CodeMirrorAdapter?: { Vim?: VimApi } }).CodeMirrorAdapter?.Vim ?? null;
}

const VIM_OPTIONS: Array<[keyof VimNumberFlags, string]> = [
  ['number', 'nu'],
  ['relativenumber', 'rnu'],
];

const MODE_NAMES: Record<NumberMode, string> = {
  hybrid: 'Hybrid: line number on the cursor line, distance elsewhere',
  relative: 'Relative: 0 on the cursor line, distance elsewhere',
  absolute: 'Absolute: line numbers only',
};

export default class HybridLineNumbersPlugin extends Plugin {
  settings: HybridLineNumbersSettings = { ...DEFAULT_SETTINGS };

  /**
   * Registered once and refilled in place: Obsidian re-reads it on
   * `updateOptions()`, so settings apply to open notes without a reload.
   */
  private readonly editorExtension: Extension[] = [];

  async onload() {
    await this.loadSettings();
    this.registerEditorExtension(this.editorExtension);
    this.applySettings();

    this.addCommand({
      id: 'toggle',
      name: 'Toggle line numbers',
      icon: 'list-ordered',
      callback: () => {
        this.settings.enabled = !this.settings.enabled;
        void this.saveSettings();
      },
    });
    this.addCommand({
      id: 'next-mode',
      name: 'Switch to the next numbering mode',
      icon: 'arrow-right-left',
      callback: () => {
        const next = NUMBER_MODES[(NUMBER_MODES.indexOf(this.settings.mode) + 1) % NUMBER_MODES.length];
        this.settings.mode = next;
        this.settings.enabled = true;
        void this.saveSettings();
      },
    });

    this.addSettingTab(new HybridLineNumbersSettingTab(this.app, this));
    this.defineVimOptions();
  }

  onunload() {
    // Vim has no way to forget an option, so they are put back as plain
    // ones that store a value and no longer reach this plugin.
    const vim = vimApi();
    for (const [name, alias] of VIM_OPTIONS) vim?.defineOption(name, false, 'boolean', [alias]);
  }

  /**
   * `:set number`, `:set relativenumber`, their `no`, `inv` and `!` forms,
   * and `:set nu?`, in the Vim command line or a vimrc. They drive this
   * plugin's settings the way they drive Vim: `nu rnu` is hybrid.
   */
  private defineVimOptions(): void {
    const vim = vimApi();
    if (!vim) return;
    for (const [name, alias] of VIM_OPTIONS) {
      vim.defineOption(name, undefined, 'boolean', [alias], (value) => {
        const flags = vimFlags(this.settings.enabled, this.settings.mode);
        if (value === undefined) return flags[name];
        // Vim calls this twice for one :set, globally and for the editor.
        if (flags[name] === (value === true)) return undefined;
        flags[name] = value === true;
        Object.assign(this.settings, fromVimFlags(flags, this.settings.mode));
        void this.saveSettings();
        return undefined;
      });
    }
  }

  async loadSettings() {
    // Whatever is on disk was written by some version of this plugin, or
    // edited by hand, so it is merged over the defaults rather than trusted.
    const stored = (await this.loadData()) as Partial<HybridLineNumbersSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...stored };
    if (!isNumberMode(this.settings.mode)) this.settings.mode = DEFAULT_SETTINGS.mode;
  }

  async saveSettings() {
    this.applySettings();
    await this.saveData(this.settings);
  }

  private applySettings(): void {
    this.editorExtension.length = 0;
    if (this.settings.enabled) {
      this.editorExtension.push(
        hybridLineNumbers({ mode: this.settings.mode, absoluteInInsert: this.settings.absoluteInInsert }),
      );
    }
    this.app.workspace.updateOptions();
  }
}

class HybridLineNumbersSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: HybridLineNumbersPlugin,
  ) {
    super(app, plugin);
  }

  private static readonly TEXT = {
    enabled: {
      name: 'Show line numbers',
      desc: "Replaces Obsidian's own line numbers while it is on, whether or not those are switched on under Editor.",
    },
    mode: {
      name: 'Numbering',
      desc: 'A folded section counts as one line, the way Vim counts a jump such as 5j.',
    },
    absoluteInInsert: {
      name: 'Absolute numbers in Vim insert mode',
      desc: 'Relative numbers in normal and visual mode, line numbers while typing. Needs Vim key bindings.',
    },
  } as const;

  /**
   * The settings, described rather than drawn, so Obsidian 1.13 and later
   * renders them itself and finds them in the settings search. Older
   * versions do not know this method and call `display()` instead.
   */
  getSettingDefinitions(): SettingDefinitionItem[] {
    const text = HybridLineNumbersSettingTab.TEXT;
    return [
      {
        ...text.enabled,
        control: { type: 'toggle', key: 'enabled', defaultValue: DEFAULT_SETTINGS.enabled },
      },
      {
        ...text.mode,
        control: { type: 'dropdown', key: 'mode', defaultValue: DEFAULT_SETTINGS.mode, options: MODE_NAMES },
      },
      {
        ...text.absoluteInInsert,
        control: { type: 'toggle', key: 'absoluteInInsert', defaultValue: DEFAULT_SETTINGS.absoluteInInsert },
      },
    ];
  }

  getControlValue(key: string): unknown {
    return this.plugin.settings[key as keyof HybridLineNumbersSettings];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const settings = this.plugin.settings;
    if (key === 'mode') {
      if (isNumberMode(value)) settings.mode = value;
    } else if (key === 'enabled' || key === 'absoluteInInsert') {
      settings[key] = value === true;
    }
    await this.plugin.saveSettings();
  }

  /** The pre-1.13 rendering; a current Obsidian never calls it. */
  display(): void {
    const { containerEl } = this;
    const text = HybridLineNumbersSettingTab.TEXT;
    containerEl.empty();

    new Setting(containerEl)
      .setName(text.enabled.name)
      .setDesc(text.enabled.desc)
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enabled).onChange((value) => this.setControlValue('enabled', value)),
      );
    new Setting(containerEl)
      .setName(text.mode.name)
      .setDesc(text.mode.desc)
      .addDropdown((dropdown) =>
        dropdown
          .addOptions(MODE_NAMES)
          .setValue(this.plugin.settings.mode)
          .onChange((value) => this.setControlValue('mode', value)),
      );
    new Setting(containerEl)
      .setName(text.absoluteInInsert.name)
      .setDesc(text.absoluteInInsert.desc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.absoluteInInsert)
          .onChange((value) => this.setControlValue('absoluteInInsert', value)),
      );
  }
}
