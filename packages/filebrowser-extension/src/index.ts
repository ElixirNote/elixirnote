// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
/**
 * @packageDocumentation
 * @module filebrowser-extension
 */

import {
  ILabShell,
  ILayoutRestorer,
  IRouter,
  ITreePathUpdater,
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  JupyterLab
} from '@jupyterlab/application';
import {
  Clipboard,
  createToolbarFactory,
  ICommandPalette,
  InputDialog,
  IToolbarWidgetRegistry,
  setToolbar,
  showErrorMessage,
  WidgetTracker
} from '@jupyterlab/apputils';
import { PageConfig, PathExt } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import {
  FileBrowser,
  FileUploadStatus,
  FilterFileBrowserModel,
  IFileBrowserCommands,
  IFileBrowserFactory,
  Uploader
} from '@jupyterlab/filebrowser';
import { Contents } from '@jupyterlab/services';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { IStateDB } from '@jupyterlab/statedb';
import { IStatusBar } from '@jupyterlab/statusbar';
import { ITranslator } from '@jupyterlab/translation';
import {
  addIcon,
  closeIcon,
  copyIcon,
  cutIcon,
  downloadIcon,
  editIcon,
  fileIcon,
  folderIcon,
  IDisposableMenuItem,
  linkIcon,
  markdownIcon,
  newFolderIcon,
  pasteIcon,
  RankedMenu,
  refreshIcon,
  stopIcon,
  textEditorIcon
} from '@jupyterlab/ui-components';
import { find, IIterator, map, reduce, toArray } from '@lumino/algorithm';
import { CommandRegistry } from '@lumino/commands';
import { ContextMenu } from '@lumino/widgets';

const FILE_BROWSER_FACTORY = 'FileBrowser';
const FILE_BROWSER_PLUGIN_ID = '@jupyterlab/filebrowser-extension:browser';

/**
 * The command IDs used by the file browser plugin.
 */
namespace CommandIDs {
  export const copy = 'filebrowser:copy';

  export const copyDownloadLink = 'filebrowser:copy-download-link';

  export const cut = 'filebrowser:cut';

  export const del = 'filebrowser:delete';

  export const download = 'filebrowser:download';

  export const duplicate = 'filebrowser:duplicate';

  // For main browser only.
  export const hideBrowser = 'filebrowser:hide-main';

  export const goToPath = 'filebrowser:go-to-path';

  export const goUp = 'filebrowser:go-up';

  export const openPath = 'filebrowser:open-path';

  export const openUrl = 'filebrowser:open-url';

  export const open = 'filebrowser:open';

  export const openBrowserTab = 'filebrowser:open-browser-tab';

  export const paste = 'filebrowser:paste';

  export const createNewDirectory = 'filebrowser:create-new-directory';

  export const createNewFile = 'filebrowser:create-new-file';

  export const createNewMarkdownFile = 'filebrowser:create-new-markdown-file';

  export const refresh = 'filebrowser:refresh';

  export const rename = 'filebrowser:rename';

  // For main browser only.
  export const copyShareableLink = 'filebrowser:share-main';

  // For main browser only.
  export const copyPath = 'filebrowser:copy-path';

  export const showBrowser = 'filebrowser:activate';

  export const shutdown = 'filebrowser:shutdown';

  // For main browser only.
  export const toggleBrowser = 'filebrowser:toggle-main';

  export const toggleNavigateToCurrentDirectory =
    'filebrowser:toggle-navigate-to-current-directory';

  export const toggleLastModified = 'filebrowser:toggle-last-modified';

  export const search = 'filebrowser:search';

  export const toggleHiddenFiles = 'filebrowser:toggle-hidden-files';

  export const toggleFileCheckboxes = 'filebrowser:toggle-file-checkboxes';
}

/**
 * The file browser namespace token.
 */
const namespace = 'filebrowser';

/**
 * The default file browser extension.
 */
const browser: JupyterFrontEndPlugin<void> = {
  id: FILE_BROWSER_PLUGIN_ID,
  requires: [IFileBrowserFactory, ITranslator],
  optional: [
    ILayoutRestorer,
    ISettingRegistry,
    ITreePathUpdater,
    ICommandPalette
  ],
  provides: IFileBrowserCommands,
  autoStart: true,
  activate: async (
    app: JupyterFrontEnd,
    factory: IFileBrowserFactory,
    translator: ITranslator,
    restorer: ILayoutRestorer | null,
    settingRegistry: ISettingRegistry | null,
    treePathUpdater: ITreePathUpdater | null,
    commandPalette: ICommandPalette | null
  ): Promise<void> => {
    const trans = translator.load('jupyterlab');
    const browser = factory.defaultBrowser;

    // Let the application restorer track the primary file browser (that is
    // automatically created) for restoration of application state (e.g. setting
    // the file browser as the current side bar widget).
    //
    // All other file browsers created by using the factory function are
    // responsible for their own restoration behavior, if any.
    if (restorer) {
      restorer.add(browser, namespace);
    }

    // Navigate to preferred-dir trait if found
    const preferredPath = PageConfig.getOption('preferredPath');
    if (preferredPath) {
      await browser.model.cd(preferredPath);
    }

    addCommands(app, factory, translator, settingRegistry, commandPalette);

    // Show the current file browser shortcut in its title.
    const updateBrowserTitle = () => {
      const binding = find(
        app.commands.keyBindings,
        b => b.command === CommandIDs.toggleBrowser
      );
      if (binding) {
        const ks = CommandRegistry.formatKeystroke(binding.keys.join(' '));
        browser.title.caption = trans.__('File Browser (%1)', ks);
      } else {
        browser.title.caption = trans.__('File Browser');
      }
    };
    updateBrowserTitle();
    app.commands.keyBindingChanged.connect(() => {
      updateBrowserTitle();
    });

    return void Promise.all([app.restored, browser.model.restored]).then(() => {
      if (treePathUpdater) {
        browser.model.pathChanged.connect((sender, args) => {
          treePathUpdater(args.newValue);
        });
      }

      if (settingRegistry) {
        void settingRegistry.load(FILE_BROWSER_PLUGIN_ID).then(settings => {
          /**
           * File browser configuration.
           */
          const fileBrowserConfig = {
            navigateToCurrentDirectory: false,
            showLastModifiedColumn: true,
            useFuzzyFilter: true,
            showHiddenFiles: false,
            showFileCheckboxes: false
          };
          const fileBrowserModelConfig = {
            filterDirectories: true
          };

          function onSettingsChanged(
            settings: ISettingRegistry.ISettings
          ): void {
            let key: keyof typeof fileBrowserConfig;
            for (key in fileBrowserConfig) {
              const value = settings.get(key).composite as boolean;
              fileBrowserConfig[key] = value;
              browser[key] = value;
            }

            const value = settings.get('filterDirectories')
              .composite as boolean;
            fileBrowserModelConfig.filterDirectories = value;
            browser.model.filterDirectories = value;
          }
          settings.changed.connect(onSettingsChanged);
          onSettingsChanged(settings);
        });
      }
    });
  }
};

/**
 * The default file browser factory provider.
 */
const factory: JupyterFrontEndPlugin<IFileBrowserFactory> = {
  id: '@jupyterlab/filebrowser-extension:factory',
  provides: IFileBrowserFactory,
  requires: [IDocumentManager, ITranslator],
  optional: [
    IStateDB,
    IRouter,
    JupyterFrontEnd.ITreeResolver,
    JupyterLab.IInfo
  ],
  activate: async (
    app: JupyterFrontEnd,
    docManager: IDocumentManager,
    translator: ITranslator,
    state: IStateDB | null,
    router: IRouter | null,
    tree: JupyterFrontEnd.ITreeResolver | null,
    info: JupyterLab.IInfo | null
  ): Promise<IFileBrowserFactory> => {
    const { commands } = app;
    const tracker = new WidgetTracker<FileBrowser>({ namespace });
    const createFileBrowser = (
      id: string,
      options: IFileBrowserFactory.IOptions = {}
    ) => {
      const model = new FilterFileBrowserModel({
        translator: translator,
        auto: options.auto ?? true,
        manager: docManager,
        driveName: options.driveName || '',
        refreshInterval: options.refreshInterval,
        refreshStandby: () => {
          if (info) {
            return !info.isConnected || 'when-hidden';
          }
          return 'when-hidden';
        },
        state:
          options.state === null
            ? undefined
            : options.state || state || undefined
      });
      const restore = options.restore;
      const widget = new FileBrowser({ id, model, restore, translator });

      // Track the newly created file browser.
      void tracker.add(widget);

      return widget;
    };

    // Manually restore and load the default file browser.
    const defaultBrowser = createFileBrowser('filebrowser', {
      auto: false,
      restore: false
    });
    void Private.restoreBrowser(defaultBrowser, commands, router, tree);

    return { createFileBrowser, defaultBrowser, tracker };
  }
};

/**
 * A plugin providing download + copy download link commands in the context menu.
 *
 * Disabling this plugin will NOT disable downloading files from the server.
 * Users will still be able to retrieve files from the file download URLs the
 * server provides.
 */
const downloadPlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/filebrowser-extension:download',
  requires: [IFileBrowserFactory, ITranslator],
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    factory: IFileBrowserFactory,
    translator: ITranslator
  ): void => {
    const trans = translator.load('jupyterlab');
    const { commands } = app;
    const { tracker } = factory;

    commands.addCommand(CommandIDs.download, {
      execute: () => {
        const widget = tracker.currentWidget;

        if (widget) {
          return widget.download();
        }
      },
      icon: downloadIcon.bindprops({ stylesheet: 'menuItem' }),
      label: trans.__('Download')
    });

    commands.addCommand(CommandIDs.copyDownloadLink, {
      execute: () => {
        const widget = tracker.currentWidget;
        if (!widget) {
          return;
        }

        return widget.model.manager.services.contents
          .getDownloadUrl(widget.selectedItems().next()!.path)
          .then(url => {
            Clipboard.copyToSystem(url);
          });
      },
      icon: copyIcon.bindprops({ stylesheet: 'menuItem' }),
      label: trans.__('Copy Download Link'),
      mnemonic: 0
    });
  }
};

/**
 * A plugin to add the file browser widget to an ILabShell
 */
const browserWidget: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/filebrowser-extension:widget',
  requires: [
    IDocumentManager,
    IFileBrowserFactory,
    ISettingRegistry,
    IToolbarWidgetRegistry,
    ITranslator,
    ILabShell,
    IFileBrowserCommands
  ],
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    docManager: IDocumentManager,
    factory: IFileBrowserFactory,
    settings: ISettingRegistry,
    toolbarRegistry: IToolbarWidgetRegistry,
    translator: ITranslator,
    labShell: ILabShell
  ): void => {
    const { commands } = app;
    const { defaultBrowser: browser, tracker } = factory;
    const trans = translator.load('jupyterlab');

    // Set attributes when adding the browser to the UI
    browser.node.setAttribute('role', 'region');
    browser.node.setAttribute('aria-label', trans.__('File Browser Section'));
    browser.title.icon = folderIcon;

    // Toolbar
    toolbarRegistry.addFactory(
      FILE_BROWSER_FACTORY,
      'uploader',
      (browser: FileBrowser) =>
        new Uploader({ model: browser.model, translator })
    );

    setToolbar(
      browser,
      createToolbarFactory(
        toolbarRegistry,
        settings,
        FILE_BROWSER_FACTORY,
        browserWidget.id,
        translator
      )
    );

    labShell.add(browser, 'left', { rank: 100, type: 'File Browser' });

    commands.addCommand(CommandIDs.showBrowser, {
      label: trans.__('Open the file browser for the provided `path`.'),
      execute: args => {
        const path = (args.path as string) || '';
        const browserForPath = Private.getBrowserForPath(path, factory);

        // Check for browser not found
        if (!browserForPath) {
          return;
        }
        // Shortcut if we are using the main file browser
        if (browser === browserForPath) {
          labShell.activateById(browser.id);
          return;
        } else {
          const areas: ILabShell.Area[] = ['left', 'right'];
          for (const area of areas) {
            const it = labShell.widgets(area);
            let widget = it.next();
            while (widget) {
              if (widget.contains(browserForPath)) {
                labShell.activateById(widget.id);
                return;
              }
              widget = it.next();
            }
          }
        }
      }
    });

    commands.addCommand(CommandIDs.hideBrowser, {
      label: trans.__('Hide the file browser.'),
      execute: () => {
        const widget = tracker.currentWidget;
        if (widget && !widget.isHidden) {
          labShell.collapseLeft();
        }
      }
    });

    // If the layout is a fresh session without saved data and not in single document
    // mode, open file browser.
    void labShell.restored.then(layout => {
      if (layout.fresh && labShell.mode !== 'single-document') {
        void commands.execute(CommandIDs.showBrowser, void 0);
      }
    });

    void Promise.all([app.restored, browser.model.restored]).then(() => {
      // Whether to automatically navigate to a document's current directory
      labShell.currentChanged.connect(async (_, change) => {
        if (browser.navigateToCurrentDirectory && change.newValue) {
          const { newValue } = change;
          const context = docManager.contextForWidget(newValue);
          if (context) {
            const { path } = context;
            try {
              await Private.navigateToPath(path, factory, translator);
            } catch (reason) {
              console.warn(
                `${CommandIDs.goToPath} failed to open: ${path}`,
                reason
              );
            }
          }
        }
      });
    });
  }
};

/**
 * The default file browser share-file plugin
 *
 * This extension adds a "Copy Shareable Link" command that generates a copy-
 * pastable URL. This url can be used to open a particular file in JupyterLab,
 * handy for emailing links or bookmarking for reference.
 *
 * If you need to change how this link is generated (for instance, to copy a
 * /user-redirect URL for JupyterHub), disable this plugin and replace it
 * with another implementation.
 */
const shareFile: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/filebrowser-extension:share-file',
  requires: [IFileBrowserFactory, ITranslator],
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    factory: IFileBrowserFactory,
    translator: ITranslator
  ): void => {
    const trans = translator.load('jupyterlab');
    const { commands } = app;
    const { tracker } = factory;

    commands.addCommand(CommandIDs.copyShareableLink, {
      execute: () => {
        const widget = tracker.currentWidget;
        const model = widget?.selectedItems().next();
        if (!model) {
          return;
        }

        Clipboard.copyToSystem(
          PageConfig.getUrl({
            workspace: PageConfig.defaultWorkspace,
            treePath: model.path,
            toShare: true
          })
        );
      },
      isVisible: () =>
        !!tracker.currentWidget &&
        toArray(tracker.currentWidget.selectedItems()).length === 1,
      icon: linkIcon.bindprops({ stylesheet: 'menuItem' }),
      label: trans.__('Copy Shareable Link')
    });
  }
};

/**
 * The "Open With" context menu.
 *
 * This is its own plugin in case you would like to disable this feature.
 * e.g. jupyter labextension disable @jupyterlab/filebrowser-extension:open-with
 */
const openWithPlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/filebrowser-extension:open-with',
  requires: [IFileBrowserFactory],
  autoStart: true,
  activate: (app: JupyterFrontEnd, factory: IFileBrowserFactory): void => {
    const { docRegistry } = app;
    const { tracker } = factory;

    let items: IDisposableMenuItem[] = [];

    function updateOpenWithMenu(contextMenu: ContextMenu) {
      const openWith =
        (contextMenu.menu.items.find(
          item =>
            item.type === 'submenu' &&
            item.submenu?.id === 'jp-contextmenu-open-with'
        )?.submenu as RankedMenu) ?? null;

      if (!openWith) {
        return; // Bail early if the open with menu is not displayed
      }

      // clear the current menu items
      items.forEach(item => item.dispose());
      items.length = 0;
      // Ensure that the menu is empty
      openWith.clearItems();

      // get the widget factories that could be used to open all of the items
      // in the current filebrowser selection
      const factories = tracker.currentWidget
        ? Private.OpenWith.intersection<DocumentRegistry.WidgetFactory>(
            map(tracker.currentWidget.selectedItems(), i => {
              return Private.OpenWith.getFactories(docRegistry, i);
            })
          )
        : new Set<DocumentRegistry.WidgetFactory>();

      // make new menu items from the widget factories
      items = [...factories].map(factory =>
        openWith.addItem({
          args: { factory: factory.name, label: factory.label || factory.name },
          command: CommandIDs.open
        })
      );
    }

    app.contextMenu.opened.connect(updateOpenWithMenu);
  }
};

/**
 * The "Open in New Browser Tab" context menu.
 *
 * This is its own plugin in case you would like to disable this feature.
 * e.g. jupyter labextension disable @jupyterlab/filebrowser-extension:open-browser-tab
 *
 * Note: If disabling this, you may also want to disable:
 * @jupyterlab/docmanager-extension:open-browser-tab
 */
const openBrowserTabPlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/filebrowser-extension:open-browser-tab',
  requires: [IFileBrowserFactory, ITranslator],
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    factory: IFileBrowserFactory,
    translator: ITranslator
  ): void => {
    const { commands } = app;
    const trans = translator.load('jupyterlab');
    const { tracker } = factory;

    commands.addCommand(CommandIDs.openBrowserTab, {
      execute: args => {
        const widget = tracker.currentWidget;

        if (!widget) {
          return;
        }

        const mode = args['mode'] as string | undefined;

        return Promise.all(
          toArray(
            map(widget.selectedItems(), item => {
              if (mode === 'single-document') {
                const url = PageConfig.getUrl({
                  mode: 'single-document',
                  treePath: item.path
                });
                const opened = window.open();
                if (opened) {
                  opened.opener = null;
                  opened.location.href = url;
                } else {
                  throw new Error('Failed to open new browser tab.');
                }
              } else {
                return commands.execute('docmanager:open-browser-tab', {
                  path: item.path
                });
              }
            })
          )
        );
      },
      icon: addIcon.bindprops({ stylesheet: 'menuItem' }),
      label: args =>
        args['mode'] === 'single-document'
          ? trans.__('Open in Simple Mode')
          : trans.__('Open in New Browser Tab'),
      mnemonic: 0
    });
  }
};

/**
 * A plugin providing file upload status.
 */
export const fileUploadStatus: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/filebrowser-extension:file-upload-status',
  autoStart: true,
  requires: [IFileBrowserFactory, ITranslator],
  optional: [IStatusBar],
  activate: (
    app: JupyterFrontEnd,
    browser: IFileBrowserFactory,
    translator: ITranslator,
    statusBar: IStatusBar | null
  ) => {
    if (!statusBar) {
      // Automatically disable if statusbar missing
      return;
    }
    const item = new FileUploadStatus({
      tracker: browser.tracker,
      translator
    });

    statusBar.registerStatusItem(
      '@jupyterlab/filebrowser-extension:file-upload-status',
      {
        item,
        align: 'middle',
        isActive: () => {
          return !!item.model && item.model.items.length > 0;
        },
        activeStateChanged: item.model.stateChanged
      }
    );
  }
};

/**
 * A plugin to open files from remote URLs
 */
const openUrlPlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/filebrowser-extension:open-url',
  autoStart: true,
  requires: [IFileBrowserFactory, ITranslator],
  optional: [ICommandPalette],
  activate: (
    app: JupyterFrontEnd,
    factory: IFileBrowserFactory,
    translator: ITranslator,
    palette: ICommandPalette | null
  ) => {
    const { commands } = app;
    const trans = translator.load('jupyterlab');
    const { defaultBrowser: browser } = factory;
    const command = CommandIDs.openUrl;

    commands.addCommand(command, {
      label: args =>
        args.url ? trans.__('Open %1', args.url) : trans.__('Open from URL…'),
      caption: args =>
        args.url ? trans.__('Open %1', args.url) : trans.__('Open from URL'),
      execute: async args => {
        let url: string | undefined = (args?.url as string) ?? '';
        if (!url) {
          url =
            (
              await InputDialog.getText({
                label: trans.__('URL'),
                placeholder: 'https://example.com/path/to/file',
                title: trans.__('Open URL'),
                okLabel: trans.__('Open')
              })
            ).value ?? undefined;
        }
        if (!url) {
          return;
        }

        let type = '';
        let blob;

        // fetch the file from the URL
        try {
          const req = await fetch(url);
          blob = await req.blob();
          type = req.headers.get('Content-Type') ?? '';
        } catch (reason) {
          if (reason.response && reason.response.status !== 200) {
            reason.message = trans.__('Could not open URL: %1', url);
          }
          return showErrorMessage(trans.__('Cannot fetch'), reason);
        }

        // upload the content of the file to the server
        try {
          const name = PathExt.basename(url);
          const file = new File([blob], name, { type });
          const model = await browser.model.upload(file);
          return commands.execute('docmanager:open', {
            path: model.path
          });
        } catch (error) {
          return showErrorMessage(
            trans._p('showErrorMessage', 'Upload Error'),
            error
          );
        }
      }
    });

    if (palette) {
      palette.addItem({
        command,
        category: trans.__('File Operations')
      });
    }
  }
};

/**
 * Add the main file browser commands to the application's command registry.
 */
function addCommands(
  app: JupyterFrontEnd,
  factory: IFileBrowserFactory,
  translator: ITranslator,
  settingRegistry: ISettingRegistry | null,
  commandPalette: ICommandPalette | null
): void {
  const trans = translator.load('jupyterlab');
  const { docRegistry: registry, commands } = app;
  const { defaultBrowser: browser, tracker } = factory;

  commands.addCommand(CommandIDs.del, {
    execute: () => {
      const widget = tracker.currentWidget;

      if (widget) {
        return widget.delete();
      }
    },
    icon: closeIcon.bindprops({ stylesheet: 'menuItem' }),
    label: trans.__('Delete'),
    mnemonic: 0
  });

  commands.addCommand(CommandIDs.copy, {
    execute: () => {
      const widget = tracker.currentWidget;

      if (widget) {
        return widget.copy();
      }
    },
    icon: copyIcon.bindprops({ stylesheet: 'menuItem' }),
    label: trans.__('Copy'),
    mnemonic: 0
  });

  commands.addCommand(CommandIDs.cut, {
    execute: () => {
      const widget = tracker.currentWidget;

      if (widget) {
        return widget.cut();
      }
    },
    icon: cutIcon.bindprops({ stylesheet: 'menuItem' }),
    label: trans.__('Cut')
  });

  commands.addCommand(CommandIDs.duplicate, {
    execute: () => {
      const widget = tracker.currentWidget;

      if (widget) {
        return widget.duplicate();
      }
    },
    icon: copyIcon.bindprops({ stylesheet: 'menuItem' }),
    label: trans.__('Duplicate')
  });

  commands.addCommand(CommandIDs.goToPath, {
    label: trans.__('Update the file browser to display the provided `path`.'),
    execute: async args => {
      const path = (args.path as string) || '';
      const showBrowser = !(args?.dontShowBrowser ?? false);
      try {
        const item = await Private.navigateToPath(path, factory, translator);
        if (item.type !== 'directory' && showBrowser) {
          const browserForPath = Private.getBrowserForPath(path, factory);
          if (browserForPath) {
            browserForPath.clearSelectedItems();
            const parts = path.split('/');
            const name = parts[parts.length - 1];
            if (name) {
              await browserForPath.selectItemByName(name);
            }
          }
        }
      } catch (reason) {
        console.warn(`${CommandIDs.goToPath} failed to go to: ${path}`, reason);
      }
      if (showBrowser) {
        return commands.execute(CommandIDs.showBrowser, { path });
      }
    }
  });

  commands.addCommand(CommandIDs.goUp, {
    label: 'go up',
    execute: async () => {
      const browserForPath = Private.getBrowserForPath('', factory);
      if (!browserForPath) {
        return;
      }
      const { model } = browserForPath;

      await model.restored;
      if (model.path === model.rootPath) {
        return;
      }
      try {
        await model.cd('..');
      } catch (reason) {
        console.warn(
          `${CommandIDs.goUp} failed to go to parent directory of ${model.path}`,
          reason
        );
      }
    }
  });

  commands.addCommand(CommandIDs.openPath, {
    label: args =>
      args.path ? trans.__('Open %1', args.path) : trans.__('Open from Path…'),
    caption: args =>
      args.path ? trans.__('Open %1', args.path) : trans.__('Open from path'),
    execute: async args => {
      let path: string | undefined;
      if (args?.path) {
        path = args.path as string;
      } else {
        path =
          (
            await InputDialog.getText({
              label: trans.__('Path'),
              placeholder: '/path/relative/to/jlab/root',
              title: trans.__('Open Path'),
              okLabel: trans.__('Open')
            })
          ).value ?? undefined;
      }
      if (!path) {
        return;
      }
      try {
        const trailingSlash = path !== '/' && path.endsWith('/');
        if (trailingSlash) {
          // The normal contents service errors on paths ending in slash
          path = path.slice(0, path.length - 1);
        }
        const browserForPath = Private.getBrowserForPath(path, factory)!;
        const { services } = browserForPath.model.manager;
        const item = await services.contents.get(path, {
          content: false
        });
        if (trailingSlash && item.type !== 'directory') {
          throw new Error(`Path ${path}/ is not a directory`);
        }
        await commands.execute(CommandIDs.goToPath, {
          path,
          dontShowBrowser: args.dontShowBrowser
        });
        if (item.type === 'directory') {
          return;
        }
        return commands.execute('docmanager:open', { path });
      } catch (reason) {
        if (reason.response && reason.response.status === 404) {
          reason.message = trans.__('Could not find path: %1', path);
        }
        return showErrorMessage(trans.__('Cannot open'), reason);
      }
    }
  });

  // Add the openPath command to the command palette
  if (commandPalette) {
    commandPalette.addItem({
      command: CommandIDs.openPath,
      category: trans.__('File Operations')
    });
  }

  commands.addCommand(CommandIDs.open, {
    execute: args => {
      const factory = (args['factory'] as string) || void 0;
      const widget = tracker.currentWidget;

      if (!widget) {
        return;
      }

      const { contents } = widget.model.manager.services;
      return Promise.all(
        toArray(
          map(widget.selectedItems(), item => {
            if (item.type === 'directory') {
              const localPath = contents.localPath(item.path);
              return widget.model.cd(`/${localPath}`);
            }

            return commands.execute('docmanager:open', {
              factory: factory,
              path: item.path
            });
          })
        )
      );
    },
    icon: args => {
      const factory = (args['factory'] as string) || void 0;
      if (factory) {
        // if an explicit factory is passed...
        const ft = registry.getFileType(factory);
        // ...set an icon if the factory name corresponds to a file type name...
        // ...or leave the icon blank
        return ft?.icon?.bindprops({ stylesheet: 'menuItem' });
      } else {
        return folderIcon.bindprops({ stylesheet: 'menuItem' });
      }
    },
    label: args =>
      (args['label'] || args['factory'] || trans.__('Open')) as string,
    mnemonic: 0
  });

  commands.addCommand(CommandIDs.paste, {
    execute: () => {
      const widget = tracker.currentWidget;

      if (widget) {
        return widget.paste();
      }
    },
    icon: pasteIcon.bindprops({ stylesheet: 'menuItem' }),
    label: trans.__('Paste'),
    mnemonic: 0
  });

  commands.addCommand(CommandIDs.createNewDirectory, {
    execute: () => {
      const widget = tracker.currentWidget;

      if (widget) {
        return widget.createNewDirectory();
      }
    },
    icon: newFolderIcon.bindprops({ stylesheet: 'menuItem' }),
    label: trans.__('New Folder')
  });

  commands.addCommand(CommandIDs.createNewFile, {
    execute: () => {
      const widget = tracker.currentWidget;

      if (widget) {
        return widget.createNewFile({ ext: 'txt' });
      }
    },
    icon: textEditorIcon.bindprops({ stylesheet: 'menuItem' }),
    label: trans.__('New File')
  });

  commands.addCommand(CommandIDs.createNewMarkdownFile, {
    execute: () => {
      const widget = tracker.currentWidget;

      if (widget) {
        return widget.createNewFile({ ext: 'md' });
      }
    },
    icon: markdownIcon.bindprops({ stylesheet: 'menuItem' }),
    label: trans.__('New Markdown File')
  });

  commands.addCommand(CommandIDs.refresh, {
    execute: args => {
      const widget = tracker.currentWidget;

      if (widget) {
        return widget.model.refresh();
      }
    },
    icon: refreshIcon.bindprops({ stylesheet: 'menuItem' }),
    caption: trans.__('Refresh the file browser.'),
    label: trans.__('Refresh File List')
  });

  commands.addCommand(CommandIDs.rename, {
    execute: args => {
      const widget = tracker.currentWidget;

      if (widget) {
        return widget.rename();
      }
    },
    icon: editIcon.bindprops({ stylesheet: 'menuItem' }),
    label: trans.__('Rename'),
    mnemonic: 0
  });

  commands.addCommand(CommandIDs.copyPath, {
    execute: () => {
      const widget = tracker.currentWidget;
      if (!widget) {
        return;
      }
      const item = widget.selectedItems().next();
      if (!item) {
        return;
      }

      Clipboard.copyToSystem(item.path);
    },
    isVisible: () =>
      !!tracker.currentWidget &&
      tracker.currentWidget.selectedItems().next !== undefined,
    icon: fileIcon.bindprops({ stylesheet: 'menuItem' }),
    label: trans.__('Copy Path')
  });

  commands.addCommand(CommandIDs.shutdown, {
    execute: () => {
      const widget = tracker.currentWidget;

      if (widget) {
        return widget.shutdownKernels();
      }
    },
    icon: stopIcon.bindprops({ stylesheet: 'menuItem' }),
    label: trans.__('Shut Down Kernel')
  });

  commands.addCommand(CommandIDs.toggleBrowser, {
    label: trans.__('File Browser'),
    execute: () => {
      if (browser.isHidden) {
        return commands.execute(CommandIDs.showBrowser, void 0);
      }

      return commands.execute(CommandIDs.hideBrowser, void 0);
    }
  });

  if (settingRegistry) {
    commands.addCommand(CommandIDs.toggleNavigateToCurrentDirectory, {
      label: trans.__('Show Active File in File Browser'),
      isToggled: () => browser.navigateToCurrentDirectory,
      execute: () => {
        const value = !browser.navigateToCurrentDirectory;
        const key = 'navigateToCurrentDirectory';
        return settingRegistry
          .set(FILE_BROWSER_PLUGIN_ID, key, value)
          .catch((reason: Error) => {
            console.error(`Failed to set navigateToCurrentDirectory setting`);
          });
      }
    });
  }

  commands.addCommand(CommandIDs.toggleLastModified, {
    label: trans.__('Show Last Modified Column'),
    isToggled: () => browser.showLastModifiedColumn,
    execute: () => {
      const value = !browser.showLastModifiedColumn;
      const key = 'showLastModifiedColumn';
      if (settingRegistry) {
        return settingRegistry
          .set(FILE_BROWSER_PLUGIN_ID, key, value)
          .catch((reason: Error) => {
            console.error(`Failed to set showLastModifiedColumn setting`);
          });
      }
    }
  });

  commands.addCommand(CommandIDs.toggleHiddenFiles, {
    label: trans.__('Show Hidden Files'),
    isToggled: () => browser.showHiddenFiles,
    isVisible: () => PageConfig.getOption('allow_hidden_files') === 'true',
    execute: () => {
      const value = !browser.showHiddenFiles;
      const key = 'showHiddenFiles';
      if (settingRegistry) {
        return settingRegistry
          .set(FILE_BROWSER_PLUGIN_ID, key, value)
          .catch((reason: Error) => {
            console.error(`Failed to set showHiddenFiles setting`);
          });
      }
    }
  });

  commands.addCommand(CommandIDs.toggleFileCheckboxes, {
    label: trans.__('Show File Checkboxes'),
    isToggled: () => browser.showFileCheckboxes,
    execute: () => {
      const value = !browser.showFileCheckboxes;
      const key = 'showFileCheckboxes';
      if (settingRegistry) {
        return settingRegistry
          .set(FILE_BROWSER_PLUGIN_ID, key, value)
          .catch((reason: Error) => {
            console.error(`Failed to set showFileCheckboxes setting`);
          });
      }
    }
  });

  commands.addCommand(CommandIDs.search, {
    label: trans.__('Search on File Names'),
    execute: () => alert('search')
  });

  if (commandPalette) {
    commandPalette.addItem({
      command: CommandIDs.toggleNavigateToCurrentDirectory,
      category: trans.__('File Operations')
    });
  }
}

/**
 * Export the plugins as default.
 */
const plugins: JupyterFrontEndPlugin<any>[] = [
  factory,
  browser,
  shareFile,
  fileUploadStatus,
  downloadPlugin,
  browserWidget,
  openWithPlugin,
  openBrowserTabPlugin,
  openUrlPlugin
];
export default plugins;

/**
 * A namespace for private module data.
 */
namespace Private {
  /**
   * Get browser object given file path.
   */
  export function getBrowserForPath(
    path: string,
    factory: IFileBrowserFactory
  ): FileBrowser | undefined {
    const { defaultBrowser: browser, tracker } = factory;
    const driveName = browser.model.manager.services.contents.driveName(path);

    if (driveName) {
      const browserForPath = tracker.find(
        _path => _path.model.driveName === driveName
      );

      if (!browserForPath) {
        // warn that no filebrowser could be found for this driveName
        console.warn(
          `${CommandIDs.goToPath} failed to find filebrowser for path: ${path}`
        );
        return;
      }

      return browserForPath;
    }

    // if driveName is empty, assume the main filebrowser
    return browser;
  }

  /**
   * Navigate to a path or the path containing a file.
   */
  export async function navigateToPath(
    path: string,
    factory: IFileBrowserFactory,
    translator: ITranslator
  ): Promise<Contents.IModel> {
    const trans = translator.load('jupyterlab');
    const browserForPath = Private.getBrowserForPath(path, factory);
    if (!browserForPath) {
      throw new Error(trans.__('No browser for path'));
    }
    const { services } = browserForPath.model.manager;
    const localPath = services.contents.localPath(path);

    await services.ready;
    const item = await services.contents.get(path, { content: false });
    const { model } = browserForPath;
    await model.restored;
    if (item.type === 'directory') {
      await model.cd(`/${localPath}`);
    } else {
      await model.cd(`/${PathExt.dirname(localPath)}`);
    }
    return item;
  }

  /**
   * Restores file browser state and overrides state if tree resolver resolves.
   */
  export async function restoreBrowser(
    browser: FileBrowser,
    commands: CommandRegistry,
    router: IRouter | null,
    tree: JupyterFrontEnd.ITreeResolver | null
  ): Promise<void> {
    const restoring = 'jp-mod-restoring';

    browser.addClass(restoring);

    if (!router) {
      await browser.model.restore(browser.id);
      await browser.model.refresh();
      browser.removeClass(restoring);
      return;
    }

    const listener = async () => {
      router.routed.disconnect(listener);

      const paths = await tree?.paths;
      if (paths?.file || paths?.browser) {
        // Restore the model without populating it.
        await browser.model.restore(browser.id, false);
        if (paths.file) {
          await commands.execute(CommandIDs.openPath, {
            path: paths.file,
            dontShowBrowser: true
          });
        }
        if (paths.browser) {
          await commands.execute(CommandIDs.openPath, {
            path: paths.browser,
            dontShowBrowser: true
          });
        }
      } else {
        await browser.model.restore(browser.id);
        await browser.model.refresh();
      }
      browser.removeClass(restoring);
    };
    router.routed.connect(listener);
  }

  export namespace OpenWith {
    /**
     * Get the factories for the selected item
     *
     * @param docRegistry Application document registry
     * @param item Selected item model
     * @returns Available factories for the model
     */
    export function getFactories(
      docRegistry: DocumentRegistry,
      item: Contents.IModel
    ): Array<DocumentRegistry.WidgetFactory> {
      const factories = docRegistry.preferredWidgetFactories(item.path);
      const notebookFactory = docRegistry.getWidgetFactory('notebook');
      if (
        notebookFactory &&
        item.type === 'notebook' &&
        factories.indexOf(notebookFactory) === -1
      ) {
        factories.unshift(notebookFactory);
      }

      return factories;
    }

    /**
     * Return the intersection of multiple arrays.
     *
     * @param iter Iterator of arrays
     * @returns Set of common elements to all arrays
     */
    export function intersection<T>(iter: IIterator<Array<T>>): Set<T> {
      // pop the first element of iter
      const first = iter.next();
      // first will be undefined if iter is empty
      if (!first) {
        return new Set<T>();
      }

      // "initialize" the intersection from first
      const isect = new Set(first);
      // reduce over the remaining elements of iter
      return reduce(
        iter,
        (isect, subarr) => {
          // filter out all elements not present in both isect and subarr,
          // accumulate result in new set
          return new Set(subarr.filter(x => isect.has(x)));
        },
        isect
      );
    }
  }
}
