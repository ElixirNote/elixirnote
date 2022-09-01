// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
/**
 * @packageDocumentation
 * @module terminal-extension
 */

import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  ICommandPalette,
  IThemeManager,
  MainAreaWidget,
  WidgetTracker
} from '@jupyterlab/apputils';
import { ILauncher } from '@jupyterlab/launcher';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { IRunningSessionManagers, IRunningSessions } from '@jupyterlab/running';
import { Terminal, TerminalAPI } from '@jupyterlab/services';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITerminal, ITerminalTracker } from '@jupyterlab/terminal';
// Name-only import so as to not trigger inclusion in main bundle
import * as WidgetModuleType from '@jupyterlab/terminal/lib/widget';
import { ITranslator } from '@jupyterlab/translation';
import { terminalIcon } from '@jupyterlab/ui-components';
import { toArray } from '@lumino/algorithm';
import { Menu, Widget } from '@lumino/widgets';

/**
 * The command IDs used by the terminal plugin.
 */
namespace CommandIDs {
  export const createNew = 'terminal:create-new';

  export const open = 'terminal:open';

  export const refresh = 'terminal:refresh';

  export const increaseFont = 'terminal:increase-font';

  export const decreaseFont = 'terminal:decrease-font';

  export const setTheme = 'terminal:set-theme';

  export const shutdown = 'terminal:shut-down';
}

/**
 * The default terminal extension.
 */
const plugin: JupyterFrontEndPlugin<ITerminalTracker> = {
  activate,
  id: '@jupyterlab/terminal-extension:plugin',
  provides: ITerminalTracker,
  requires: [ISettingRegistry, ITranslator],
  optional: [
    ICommandPalette,
    ILauncher,
    ILayoutRestorer,
    IMainMenu,
    IThemeManager,
    IRunningSessionManagers
  ],
  autoStart: true
};

/**
 * Export the plugin as default.
 */
export default plugin;

/**
 * Activate the terminal plugin.
 */
function activate(
  app: JupyterFrontEnd,
  settingRegistry: ISettingRegistry,
  translator: ITranslator,
  palette: ICommandPalette | null,
  launcher: ILauncher | null,
  restorer: ILayoutRestorer | null,
  mainMenu: IMainMenu | null,
  themeManager: IThemeManager | null,
  runningSessionManagers: IRunningSessionManagers | null
): ITerminalTracker {
  const trans = translator.load('jupyterlab');
  const { serviceManager, commands } = app;
  const category = trans.__('Terminal');
  const namespace = 'terminal';
  const tracker = new WidgetTracker<MainAreaWidget<ITerminal.ITerminal>>({
    namespace
  });

  // Bail if there are no terminals available.
  if (!serviceManager.terminals.isAvailable()) {
    console.warn(
      'Disabling terminals plugin because they are not available on the server'
    );
    return tracker;
  }

  // Handle state restoration.
  if (restorer) {
    void restorer.restore(tracker, {
      command: CommandIDs.createNew,
      args: widget => ({ name: widget.content.session.name }),
      name: widget => widget.content.session.name
    });
  }

  // The cached terminal options from the setting editor.
  const options: Partial<ITerminal.IOptions> = {};

  /**
   * Update the cached option values.
   */
  function updateOptions(settings: ISettingRegistry.ISettings): void {
    // Update the cached options by doing a shallow copy of key/values.
    // This is needed because options is passed and used in addcommand-palette and needs
    // to reflect the current cached values.
    Object.keys(settings.composite).forEach((key: keyof ITerminal.IOptions) => {
      (options as any)[key] = settings.composite[key];
    });
  }

  /**
   * Update terminal
   */
  function updateTerminal(widget: MainAreaWidget<ITerminal.ITerminal>): void {
    const terminal = widget.content;
    if (!terminal) {
      return;
    }
    Object.keys(options).forEach((key: keyof ITerminal.IOptions) => {
      terminal.setOption(key, options[key]);
    });
  }

  /**
   * Update the settings of the current tracker instances.
   */
  function updateTracker(): void {
    tracker.forEach(widget => updateTerminal(widget));
  }

  // Fetch the initial state of the settings.
  settingRegistry
    .load(plugin.id)
    .then(settings => {
      updateOptions(settings);
      updateTracker();
      settings.changed.connect(() => {
        updateOptions(settings);
        updateTracker();
      });
    })
    .catch(Private.showErrorMessage);

  // Subscribe to changes in theme. This is needed as the theme
  // is computed dynamically based on the string value and DOM
  // properties.
  themeManager?.themeChanged.connect((sender, args) => {
    tracker.forEach(widget => {
      const terminal = widget.content;
      if (terminal.getOption('theme') === 'inherit') {
        terminal.setOption('theme', 'inherit');
      }
    });
  });

  addCommands(app, tracker, settingRegistry, translator, options);

  if (mainMenu) {
    // Add "Terminal Theme" menu below "Theme" menu.
    const themeMenu = new Menu({ commands });
    themeMenu.title.label = trans._p('menu', 'Terminal Theme');
    themeMenu.addItem({
      command: CommandIDs.setTheme,
      args: {
        theme: 'inherit',
        displayName: trans.__('Inherit'),
        isPalette: false
      }
    });
    themeMenu.addItem({
      command: CommandIDs.setTheme,
      args: {
        theme: 'light',
        displayName: trans.__('Light'),
        isPalette: false
      }
    });
    themeMenu.addItem({
      command: CommandIDs.setTheme,
      args: { theme: 'dark', displayName: trans.__('Dark'), isPalette: false }
    });

    // Add some commands to the "View" menu.
    mainMenu.settingsMenu.addGroup(
      [
        { command: CommandIDs.increaseFont },
        { command: CommandIDs.decreaseFont },
        { type: 'submenu', submenu: themeMenu }
      ],
      40
    );

    // Add terminal creation to the file menu.
    mainMenu.fileMenu.newMenu.addItem({
      command: CommandIDs.createNew,
      rank: 20
    });

    // Add terminal close-and-shutdown to the file menu.
    mainMenu.fileMenu.closeAndCleaners.add({
      id: CommandIDs.shutdown,
      isEnabled: (w: Widget) => tracker.currentWidget !== null && tracker.has(w)
    });
  }

  if (palette) {
    // Add command palette items.
    [
      CommandIDs.createNew,
      CommandIDs.refresh,
      CommandIDs.increaseFont,
      CommandIDs.decreaseFont
    ].forEach(command => {
      palette.addItem({ command, category, args: { isPalette: true } });
    });
    palette.addItem({
      command: CommandIDs.setTheme,
      category,
      args: {
        theme: 'inherit',
        displayName: trans.__('Inherit'),
        isPalette: true
      }
    });
    palette.addItem({
      command: CommandIDs.setTheme,
      category,
      args: { theme: 'light', displayName: trans.__('Light'), isPalette: true }
    });
    palette.addItem({
      command: CommandIDs.setTheme,
      category,
      args: { theme: 'dark', displayName: trans.__('Dark'), isPalette: true }
    });
  }

  // Add a launcher item if the launcher is available.
  if (launcher) {
    launcher.add({
      command: CommandIDs.createNew,
      category: trans.__('Other'),
      rank: 0
    });
  }

  // Add a sessions manager if the running extension is available
  if (runningSessionManagers) {
    addRunningSessionManager(runningSessionManagers, app, translator);
  }

  return tracker;
}

/**
 * Add the running terminal manager to the running panel.
 */
function addRunningSessionManager(
  managers: IRunningSessionManagers,
  app: JupyterFrontEnd,
  translator: ITranslator
) {
  const trans = translator.load('jupyterlab');
  const manager = app.serviceManager.terminals;

  managers.add({
    name: trans.__('Terminals'),
    running: () =>
      toArray(manager.running()).map(model => new RunningTerminal(model)),
    shutdownAll: () => manager.shutdownAll(),
    refreshRunning: () => manager.refreshRunning(),
    runningChanged: manager.runningChanged,
    shutdownLabel: trans.__('Shut Down'),
    shutdownAllLabel: trans.__('Shut Down All'),
    shutdownAllConfirmationText: trans.__(
      'Are you sure you want to permanently shut down all running terminals?'
    )
  });

  class RunningTerminal implements IRunningSessions.IRunningItem {
    constructor(model: Terminal.IModel) {
      this._model = model;
    }
    open() {
      void app.commands.execute('terminal:open', { name: this._model.name });
    }
    icon() {
      return terminalIcon;
    }
    label() {
      return `terminals/${this._model.name}`;
    }
    shutdown() {
      return manager.shutdown(this._model.name);
    }

    private _model: Terminal.IModel;
  }
}

/**
 * Add the commands for the terminal.
 */
export function addCommands(
  app: JupyterFrontEnd,
  tracker: WidgetTracker<MainAreaWidget<ITerminal.ITerminal>>,
  settingRegistry: ISettingRegistry,
  translator: ITranslator,
  options: Partial<ITerminal.IOptions>
): void {
  const trans = translator.load('jupyterlab');
  const { commands, serviceManager } = app;

  // Add terminal commands.
  commands.addCommand(CommandIDs.createNew, {
    label: args =>
      args['isPalette'] ? trans.__('New Terminal') : trans.__('Terminal'),
    caption: trans.__('Start a new terminal session'),
    icon: args => (args['isPalette'] ? undefined : terminalIcon),
    execute: async args => {
      // wait for the widget to lazy load
      let Terminal: typeof WidgetModuleType.Terminal;
      try {
        Terminal = (await Private.ensureWidget()).Terminal;
      } catch (err) {
        Private.showErrorMessage(err);
        return;
      }

      const name = args['name'] as string;
      const cwd = args['cwd'] as string;

      let session;
      if (name) {
        const models = await TerminalAPI.listRunning();
        if (models.map(d => d.name).includes(name)) {
          // we are restoring a terminal widget and the corresponding terminal exists
          // let's connect to it
          session = serviceManager.terminals.connectTo({ model: { name } });
        } else {
          // we are restoring a terminal widget but the corresponding terminal was closed
          // let's start a new terminal with the original name
          session = await serviceManager.terminals.startNew({ name, cwd });
        }
      } else {
        // we are creating a new terminal widget with a new terminal
        // let the server choose the terminal name
        session = await serviceManager.terminals.startNew({ cwd });
      }

      const term = new Terminal(session, options, translator);

      term.title.icon = terminalIcon;
      term.title.label = '...';

      const main = new MainAreaWidget({ content: term });
      app.shell.add(main, 'main', { type: 'Terminal' });
      void tracker.add(main);
      app.shell.activateById(main.id);
      return main;
    }
  });

  commands.addCommand(CommandIDs.open, {
    label: trans.__('Open a terminal by its `name`.'),
    execute: args => {
      const name = args['name'] as string;
      // Check for a running terminal with the given name.
      const widget = tracker.find(value => {
        const content = value.content;
        return content.session.name === name || false;
      });
      if (widget) {
        app.shell.activateById(widget.id);
      } else {
        // Otherwise, create a new terminal with a given name.
        return commands.execute(CommandIDs.createNew, { name });
      }
    }
  });

  commands.addCommand(CommandIDs.refresh, {
    label: trans.__('Refresh Terminal'),
    caption: trans.__('Refresh the current terminal session'),
    execute: async () => {
      const current = tracker.currentWidget;
      if (!current) {
        return;
      }
      app.shell.activateById(current.id);
      try {
        await current.content.refresh();
        if (current) {
          current.content.activate();
        }
      } catch (err) {
        Private.showErrorMessage(err);
      }
    },
    isEnabled: () => tracker.currentWidget !== null
  });

  commands.addCommand(CommandIDs.shutdown, {
    label: trans.__('Shutdown Terminal'),
    execute: () => {
      const current = tracker.currentWidget;
      if (!current) {
        return;
      }

      // The widget is automatically disposed upon session shutdown.
      return current.content.session.shutdown();
    },
    isEnabled: () => tracker.currentWidget !== null
  });

  commands.addCommand(CommandIDs.increaseFont, {
    label: trans.__('Increase Terminal Font Size'),
    execute: async () => {
      const { fontSize } = options;
      if (fontSize && fontSize < 72) {
        try {
          await settingRegistry.set(plugin.id, 'fontSize', fontSize + 1);
        } catch (err) {
          Private.showErrorMessage(err);
        }
      }
    }
  });

  commands.addCommand(CommandIDs.decreaseFont, {
    label: trans.__('Decrease Terminal Font Size'),
    execute: async () => {
      const { fontSize } = options;
      if (fontSize && fontSize > 9) {
        try {
          await settingRegistry.set(plugin.id, 'fontSize', fontSize - 1);
        } catch (err) {
          Private.showErrorMessage(err);
        }
      }
    }
  });

  const themeDisplayedName = {
    inherit: trans.__('Inherit'),
    light: trans.__('Light'),
    dark: trans.__('Dark')
  };

  commands.addCommand(CommandIDs.setTheme, {
    label: args => {
      if (args.theme === undefined) {
        return trans.__('Set terminal theme to the provided `theme`.');
      }
      const theme = args['theme'] as string;
      const displayName =
        theme in themeDisplayedName
          ? themeDisplayedName[theme as keyof typeof themeDisplayedName]
          : trans.__(theme[0].toUpperCase() + theme.slice(1));
      return args['isPalette']
        ? trans.__('Use Terminal Theme: %1', displayName)
        : displayName;
    },
    caption: trans.__('Set the terminal theme'),
    isToggled: args => {
      const { theme } = options;
      return args['theme'] === theme;
    },
    execute: async args => {
      const theme = args['theme'] as ITerminal.Theme;
      try {
        await settingRegistry.set(plugin.id, 'theme', theme);
        commands.notifyCommandChanged(CommandIDs.setTheme);
      } catch (err) {
        console.log(err);
        Private.showErrorMessage(err);
      }
    }
  });
}

/**
 * A namespace for private data.
 */
namespace Private {
  /**
   * A Promise for the initial load of the terminal widget.
   */
  export let widgetReady: Promise<typeof WidgetModuleType>;

  /**
   * Lazy-load the widget (and xterm library and addons)
   */
  export function ensureWidget(): Promise<typeof WidgetModuleType> {
    if (widgetReady) {
      return widgetReady;
    }

    widgetReady = import('@jupyterlab/terminal/lib/widget');

    return widgetReady;
  }

  /**
   *  Utility function for consistent error reporting
   */
  export function showErrorMessage(error: Error): void {
    console.error(`Failed to configure ${plugin.id}: ${error.message}`);
  }
}
