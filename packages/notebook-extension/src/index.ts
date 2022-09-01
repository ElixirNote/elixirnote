// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
/**
 * @packageDocumentation
 * @module notebook-extension
 */

import {
  ILabShell,
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  createToolbarFactory,
  Dialog,
  ICommandPalette,
  IKernelStatusModel,
  InputDialog,
  ISanitizer,
  ISessionContext,
  ISessionContextDialogs,
  IToolbarWidgetRegistry,
  MainAreaWidget,
  sessionContextDialogs,
  showDialog,
  Toolbar,
  WidgetTracker
} from '@jupyterlab/apputils';
import { Cell, CodeCell, ICellModel, MarkdownCell } from '@jupyterlab/cells';
import {
  CodeEditor,
  IEditorServices,
  IPositionModel
} from '@jupyterlab/codeeditor';
import { PageConfig } from '@jupyterlab/coreutils';

import { IDocumentManager } from '@jupyterlab/docmanager';
import { ToolbarItems as DocToolbarItems } from '@jupyterlab/docmanager-extension';
import { DocumentRegistry, IDocumentWidget } from '@jupyterlab/docregistry';
import { ISearchProviderRegistry } from '@jupyterlab/documentsearch';
import { IFileBrowserFactory } from '@jupyterlab/filebrowser';
import { ILauncher } from '@jupyterlab/launcher';
import {
  ILSPCodeExtractorsManager,
  ILSPDocumentConnectionManager,
  ILSPFeatureManager
} from '@jupyterlab/lsp';
import { IMainMenu } from '@jupyterlab/mainmenu';
import * as nbformat from '@jupyterlab/nbformat';
import {
  CommandEditStatus,
  ExecutionIndicator,
  INotebookTools,
  INotebookTracker,
  INotebookWidgetFactory,
  Notebook,
  NotebookActions,
  NotebookAdapter,
  NotebookModelFactory,
  NotebookPanel,
  NotebookSearchProvider,
  NotebookToCFactory,
  NotebookTools,
  NotebookTracker,
  NotebookTrustStatus,
  NotebookWidgetFactory,
  StaticNotebook,
  ToolbarItems
} from '@jupyterlab/notebook';
import {
  IObservableList,
  IObservableUndoableList
} from '@jupyterlab/observables';
import { IPropertyInspectorProvider } from '@jupyterlab/property-inspector';
import { IMarkdownParser, IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { IStateDB } from '@jupyterlab/statedb';
import { IStatusBar } from '@jupyterlab/statusbar';
import { ITableOfContentsRegistry } from '@jupyterlab/toc';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import {
  addAboveIcon,
  addBelowIcon,
  buildIcon,
  copyIcon,
  cutIcon,
  duplicateIcon,
  moveDownIcon,
  moveUpIcon,
  notebookIcon,
  pasteIcon
} from '@jupyterlab/ui-components';
import { ICompletionProviderManager } from '@jupyterlab/completer';
import { ArrayExt } from '@lumino/algorithm';
import { CommandRegistry } from '@lumino/commands';
import {
  JSONExt,
  JSONObject,
  JSONValue,
  ReadonlyJSONValue,
  ReadonlyPartialJSONObject,
  UUID
} from '@lumino/coreutils';
import { DisposableSet, IDisposable } from '@lumino/disposable';
import { Message, MessageLoop } from '@lumino/messaging';
import { Menu, Panel, Widget } from '@lumino/widgets';
import { logNotebookOutput } from './nboutput';

/**
 * The command IDs used by the notebook plugin.
 */
namespace CommandIDs {
  export const createNew = 'notebook:create-new';

  export const interrupt = 'notebook:interrupt-kernel';

  export const restart = 'notebook:restart-kernel';

  export const restartClear = 'notebook:restart-clear-output';

  export const restartAndRunToSelected = 'notebook:restart-and-run-to-selected';

  export const restartRunAll = 'notebook:restart-run-all';

  export const reconnectToKernel = 'notebook:reconnect-to-kernel';

  export const changeKernel = 'notebook:change-kernel';

  export const getKernel = 'notebook:get-kernel';

  export const createConsole = 'notebook:create-console';

  export const createOutputView = 'notebook:create-output-view';

  export const clearAllOutputs = 'notebook:clear-all-cell-outputs';

  export const shutdown = 'notebook:shutdown-kernel';

  export const closeAndShutdown = 'notebook:close-and-shutdown';

  export const trust = 'notebook:trust';

  export const exportToFormat = 'notebook:export-to-format';

  export const run = 'notebook:run-cell';

  export const runAndAdvance = 'notebook:run-cell-and-select-next';

  export const runAndInsert = 'notebook:run-cell-and-insert-below';

  export const runInConsole = 'notebook:run-in-console';

  export const runAll = 'notebook:run-all-cells';

  export const runAllAbove = 'notebook:run-all-above';

  export const runAllBelow = 'notebook:run-all-below';

  export const renderAllMarkdown = 'notebook:render-all-markdown';

  export const toCode = 'notebook:change-cell-to-code';

  export const toMarkdown = 'notebook:change-cell-to-markdown';

  export const toRaw = 'notebook:change-cell-to-raw';

  export const cut = 'notebook:cut-cell';

  export const copy = 'notebook:copy-cell';

  export const pasteAbove = 'notebook:paste-cell-above';

  export const pasteBelow = 'notebook:paste-cell-below';

  export const duplicateBelow = 'notebook:duplicate-below';

  export const pasteAndReplace = 'notebook:paste-and-replace-cell';

  export const moveUp = 'notebook:move-cell-up';

  export const moveDown = 'notebook:move-cell-down';

  export const clearOutputs = 'notebook:clear-cell-output';

  export const deleteCell = 'notebook:delete-cell';

  export const insertAbove = 'notebook:insert-cell-above';

  export const insertBelow = 'notebook:insert-cell-below';

  export const selectAbove = 'notebook:move-cursor-up';

  export const selectBelow = 'notebook:move-cursor-down';

  export const selectHeadingAboveOrCollapse =
    'notebook:move-cursor-heading-above-or-collapse';

  export const selectHeadingBelowOrExpand =
    'notebook:move-cursor-heading-below-or-expand';

  export const insertHeadingAbove = 'notebook:insert-heading-above';

  export const insertHeadingBelow = 'notebook:insert-heading-below';

  export const extendAbove = 'notebook:extend-marked-cells-above';

  export const extendTop = 'notebook:extend-marked-cells-top';

  export const extendBelow = 'notebook:extend-marked-cells-below';

  export const extendBottom = 'notebook:extend-marked-cells-bottom';

  export const selectAll = 'notebook:select-all';

  export const deselectAll = 'notebook:deselect-all';

  export const editMode = 'notebook:enter-edit-mode';

  export const merge = 'notebook:merge-cells';

  export const mergeAbove = 'notebook:merge-cell-above';

  export const mergeBelow = 'notebook:merge-cell-below';

  export const split = 'notebook:split-cell-at-cursor';

  export const commandMode = 'notebook:enter-command-mode';

  export const toggleAllLines = 'notebook:toggle-all-cell-line-numbers';

  export const undoCellAction = 'notebook:undo-cell-action';

  export const redoCellAction = 'notebook:redo-cell-action';

  export const redo = 'notebook:redo';

  export const undo = 'notebook:undo';

  export const markdown1 = 'notebook:change-cell-to-heading-1';

  export const markdown2 = 'notebook:change-cell-to-heading-2';

  export const markdown3 = 'notebook:change-cell-to-heading-3';

  export const markdown4 = 'notebook:change-cell-to-heading-4';

  export const markdown5 = 'notebook:change-cell-to-heading-5';

  export const markdown6 = 'notebook:change-cell-to-heading-6';

  export const hideCode = 'notebook:hide-cell-code';

  export const showCode = 'notebook:show-cell-code';

  export const hideAllCode = 'notebook:hide-all-cell-code';

  export const showAllCode = 'notebook:show-all-cell-code';

  export const hideOutput = 'notebook:hide-cell-outputs';

  export const showOutput = 'notebook:show-cell-outputs';

  export const hideAllOutputs = 'notebook:hide-all-cell-outputs';

  export const showAllOutputs = 'notebook:show-all-cell-outputs';

  export const toggleRenderSideBySideCurrentNotebook =
    'notebook:toggle-render-side-by-side-current';

  export const setSideBySideRatio = 'notebook:set-side-by-side-ratio';

  export const enableOutputScrolling = 'notebook:enable-output-scrolling';

  export const disableOutputScrolling = 'notebook:disable-output-scrolling';

  export const selectLastRunCell = 'notebook:select-last-run-cell';

  export const replaceSelection = 'notebook:replace-selection';

  export const autoClosingBrackets = 'notebook:toggle-autoclosing-brackets';

  export const toggleCollapseCmd = 'notebook:toggle-heading-collapse';

  export const collapseAllCmd = 'notebook:collapse-all-headings';

  export const expandAllCmd = 'notebook:expand-all-headings';

  export const copyToClipboard = 'notebook:copy-to-clipboard';

  export const invokeCompleter = 'completer:invoke-notebook';

  export const selectCompleter = 'completer:select-notebook';

  export const tocRunCells = 'toc:run-cells';
}

/**
 * The name of the factory that creates notebooks.
 */
const FACTORY = 'Notebook';

/**
 * The excluded Export To ...
 * (returned from nbconvert's export list)
 */
const FORMAT_EXCLUDE = ['notebook', 'python', 'custom'];

/**
 * Setting Id storing the customized toolbar definition.
 */
const PANEL_SETTINGS = '@jupyterlab/notebook-extension:panel';

/**
 * The id to use on the style tag for the side by side margins.
 */
const SIDE_BY_SIDE_STYLE_ID = 'jp-NotebookExtension-sideBySideMargins';

/**
 * The notebook widget tracker provider.
 */
const trackerPlugin: JupyterFrontEndPlugin<INotebookTracker> = {
  id: '@jupyterlab/notebook-extension:tracker',
  provides: INotebookTracker,
  requires: [INotebookWidgetFactory, ITranslator],
  optional: [
    ICommandPalette,
    IFileBrowserFactory,
    ILauncher,
    ILayoutRestorer,
    IMainMenu,
    ISettingRegistry,
    ISessionContextDialogs
  ],
  activate: activateNotebookHandler,
  autoStart: true
};

/**
 * The notebook cell factory provider.
 */
const factory: JupyterFrontEndPlugin<NotebookPanel.IContentFactory> = {
  id: '@jupyterlab/notebook-extension:factory',
  provides: NotebookPanel.IContentFactory,
  requires: [IEditorServices],
  autoStart: true,
  activate: (app: JupyterFrontEnd, editorServices: IEditorServices) => {
    const editorFactory = editorServices.factoryService.newInlineEditor;
    return new NotebookPanel.ContentFactory({ editorFactory });
  }
};

/**
 * The notebook tools extension.
 */
const tools: JupyterFrontEndPlugin<INotebookTools> = {
  activate: activateNotebookTools,
  provides: INotebookTools,
  id: '@jupyterlab/notebook-extension:tools',
  autoStart: true,
  requires: [INotebookTracker, IEditorServices, IStateDB, ITranslator],
  optional: [IPropertyInspectorProvider]
};

/**
 * A plugin providing a CommandEdit status item.
 */
export const commandEditItem: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/notebook-extension:mode-status',
  autoStart: true,
  requires: [INotebookTracker, ITranslator],
  optional: [IStatusBar],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    translator: ITranslator,
    statusBar: IStatusBar | null
  ) => {
    if (!statusBar) {
      // Automatically disable if statusbar missing
      return;
    }
    const { shell } = app;
    const item = new CommandEditStatus(translator);

    // Keep the status item up-to-date with the current notebook.
    tracker.currentChanged.connect(() => {
      const current = tracker.currentWidget;
      item.model.notebook = current && current.content;
    });

    statusBar.registerStatusItem('@jupyterlab/notebook-extension:mode-status', {
      item,
      align: 'right',
      rank: 4,
      isActive: () =>
        !!shell.currentWidget &&
        !!tracker.currentWidget &&
        shell.currentWidget === tracker.currentWidget
    });
  }
};

/**
 * A plugin that provides a execution indicator item to the status bar.
 */
export const executionIndicator: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/notebook-extension:execution-indicator',
  autoStart: true,
  requires: [INotebookTracker, ILabShell, ITranslator],
  optional: [IStatusBar, ISettingRegistry],
  activate: (
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    labShell: ILabShell,
    translator: ITranslator,
    statusBar: IStatusBar | null,
    settingRegistry: ISettingRegistry | null
  ) => {
    let statusbarItem: ExecutionIndicator;
    let labShellCurrentChanged: (
      _: ILabShell,
      change: ILabShell.IChangedArgs
    ) => void;

    let statusBarDisposable: IDisposable;

    const updateSettings = (settings: {
      showOnToolBar: boolean;
      showProgress: boolean;
    }): void => {
      let { showOnToolBar, showProgress } = settings;

      if (!showOnToolBar) {
        // Status bar mode, only one `ExecutionIndicator` is needed.
        if (!statusBar) {
          // Automatically disable if statusbar missing
          return;
        }

        if (!statusbarItem?.model) {
          statusbarItem = new ExecutionIndicator(translator);
          labShellCurrentChanged = (
            _: ILabShell,
            change: ILabShell.IChangedArgs
          ) => {
            const { newValue } = change;
            if (newValue && notebookTracker.has(newValue)) {
              const panel = newValue as NotebookPanel;
              statusbarItem.model!.attachNotebook({
                content: panel.content,
                context: panel.sessionContext
              });
            }
          };
          statusBarDisposable = statusBar.registerStatusItem(
            '@jupyterlab/notebook-extension:execution-indicator',
            {
              item: statusbarItem,
              align: 'left',
              rank: 3,
              isActive: () => {
                const current = labShell.currentWidget;
                return !!current && notebookTracker.has(current);
              }
            }
          );

          statusbarItem.model.attachNotebook({
            content: notebookTracker.currentWidget?.content,
            context: notebookTracker.currentWidget?.sessionContext
          });

          labShell.currentChanged.connect(labShellCurrentChanged);
          statusbarItem.disposed.connect(() => {
            labShell.currentChanged.disconnect(labShellCurrentChanged);
          });
        }

        statusbarItem.model.displayOption = {
          showOnToolBar,
          showProgress
        };
      } else {
        //Remove old indicator widget on status bar
        if (statusBarDisposable) {
          labShell.currentChanged.disconnect(labShellCurrentChanged);
          statusBarDisposable.dispose();
        }
      }
    };

    if (settingRegistry) {
      // Indicator is default in tool bar, user needs to specify its
      // position in settings in order to have indicator on status bar.
      const loadSettings = settingRegistry.load(trackerPlugin.id);
      Promise.all([loadSettings, app.restored])
        .then(([settings]) => {
          updateSettings(ExecutionIndicator.getSettingValue(settings));
          settings.changed.connect(sender =>
            updateSettings(ExecutionIndicator.getSettingValue(sender))
          );
        })
        .catch((reason: Error) => {
          console.error(reason.message);
        });
    }
  }
};

/**
 * A plugin providing export commands in the main menu and command palette
 */
export const exportPlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/notebook-extension:export',
  autoStart: true,
  requires: [ITranslator, INotebookTracker],
  optional: [IMainMenu, ICommandPalette],
  activate: (
    app: JupyterFrontEnd,
    translator: ITranslator,
    tracker: INotebookTracker,
    mainMenu: IMainMenu | null,
    palette: ICommandPalette | null
  ) => {
    const trans = translator.load('jupyterlab');
    const { commands, shell } = app;
    const services = app.serviceManager;

    const isEnabled = (): boolean => {
      return Private.isEnabled(shell, tracker);
    };

    commands.addCommand(CommandIDs.exportToFormat, {
      label: args => {
        if (args.label === undefined) {
          return trans.__('Save and Export Notebook to the given `format`.');
        }
        const formatLabel = args['label'] as string;
        return args['isPalette']
          ? trans.__('Save and Export Notebook: %1', formatLabel)
          : formatLabel;
      },
      execute: args => {
        const current = getCurrent(tracker, shell, args);

        if (!current) {
          return;
        }

        const url = PageConfig.getNBConvertURL({
          format: args['format'] as string,
          download: true,
          path: current.context.path
        });
        const { context } = current;

        if (context.model.dirty && !context.model.readOnly) {
          return context.save().then(() => {
            window.open(url, '_blank', 'noopener');
          });
        }

        return new Promise<void>(resolve => {
          window.open(url, '_blank', 'noopener');
          resolve(undefined);
        });
      },
      isEnabled
    });

    // Add a notebook group to the File menu.
    let exportTo: Menu | null | undefined;
    if (mainMenu) {
      exportTo = mainMenu.fileMenu.items.find(
        item =>
          item.type === 'submenu' &&
          item.submenu?.id === 'jp-mainmenu-file-notebookexport'
      )?.submenu;
    }

    void services.nbconvert.getExportFormats().then(response => {
      if (response) {
        const formatLabels: any = Private.getFormatLabels(translator);

        // Convert export list to palette and menu items.
        const formatList = Object.keys(response);
        formatList.forEach(function (key) {
          const capCaseKey = trans.__(key[0].toUpperCase() + key.substr(1));
          const labelStr = formatLabels[key] ? formatLabels[key] : capCaseKey;
          let args = {
            format: key,
            label: labelStr,
            isPalette: false
          };
          if (FORMAT_EXCLUDE.indexOf(key) === -1) {
            if (exportTo) {
              exportTo.addItem({
                command: CommandIDs.exportToFormat,
                args: args
              });
            }
            if (palette) {
              args = {
                format: key,
                label: labelStr,
                isPalette: true
              };
              const category = trans.__('Notebook Operations');
              palette.addItem({
                command: CommandIDs.exportToFormat,
                category,
                args
              });
            }
          }
        });
      }
    });
  }
};

/**
 * A plugin that adds a notebook trust status item to the status bar.
 */
export const notebookTrustItem: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/notebook-extension:trust-status',
  autoStart: true,
  requires: [INotebookTracker, ITranslator],
  optional: [IStatusBar],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    tranlator: ITranslator,
    statusBar: IStatusBar | null
  ) => {
    if (!statusBar) {
      // Automatically disable if statusbar missing
      return;
    }
    const { shell } = app;
    const item = new NotebookTrustStatus(tranlator);

    // Keep the status item up-to-date with the current notebook.
    tracker.currentChanged.connect(() => {
      const current = tracker.currentWidget;
      item.model.notebook = current && current.content;
    });

    statusBar.registerStatusItem(
      '@jupyterlab/notebook-extension:trust-status',
      {
        item,
        align: 'right',
        rank: 3,
        isActive: () =>
          !!shell.currentWidget &&
          !!tracker.currentWidget &&
          shell.currentWidget === tracker.currentWidget
      }
    );
  }
};

/**
 * The notebook widget factory provider.
 */
const widgetFactoryPlugin: JupyterFrontEndPlugin<NotebookWidgetFactory.IFactory> =
  {
    id: '@jupyterlab/notebook-extension:widget-factory',
    provides: INotebookWidgetFactory,
    requires: [
      NotebookPanel.IContentFactory,
      IEditorServices,
      IRenderMimeRegistry,
      ISessionContextDialogs,
      IToolbarWidgetRegistry,
      ITranslator
    ],
    optional: [ISettingRegistry],
    activate: activateWidgetFactory,
    autoStart: true
  };

/**
 * The cloned output provider.
 */
const clonedOutputsPlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/notebook-extension:cloned-outputs',
  requires: [IDocumentManager, INotebookTracker, ITranslator],
  optional: [ILayoutRestorer],
  activate: activateClonedOutputs,
  autoStart: true
};

/**
 * A plugin for code consoles functionalities.
 */
const codeConsolePlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/notebook-extension:code-console',
  requires: [INotebookTracker, ITranslator],
  activate: activateCodeConsole,
  autoStart: true
};

/**
 * A plugin to copy CodeCell outputs.
 */
const copyOutputPlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/notebook-extension:copy-output',
  activate: activateCopyOutput,
  requires: [ITranslator, INotebookTracker],
  autoStart: true
};

/**
 * Kernel status indicator.
 */
const kernelStatus: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/notebook-extension:kernel-status',
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    kernelStatus: IKernelStatusModel
  ) => {
    const provider = (widget: Widget | null) => {
      let session: ISessionContext | null = null;

      if (widget && tracker.has(widget)) {
        return (widget as NotebookPanel).sessionContext;
      }

      return session;
    };

    kernelStatus.addSessionProvider(provider);
  },
  requires: [INotebookTracker, IKernelStatusModel],
  autoStart: true
};

/**
 * Cursor position.
 */
const lineColStatus: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/notebook-extension:cursor-position',
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    positionModel: IPositionModel
  ) => {
    let previousWidget: NotebookPanel | null = null;

    const provider = (widget: Widget | null) => {
      let editor: CodeEditor.IEditor | null = null;
      if (widget !== previousWidget) {
        previousWidget?.content.activeCellChanged.disconnect(
          positionModel.update
        );

        previousWidget = null;
        if (widget && tracker.has(widget)) {
          (widget as NotebookPanel).content.activeCellChanged.connect(
            positionModel.update
          );
          editor = (widget as NotebookPanel).content.activeCell?.editor ?? null;
          previousWidget = widget as NotebookPanel;
        }
      } else if (widget) {
        editor = (widget as NotebookPanel).content.activeCell?.editor ?? null;
      }
      return editor;
    };

    positionModel.addEditorProvider(provider);
  },
  requires: [INotebookTracker, IPositionModel],
  autoStart: true
};

const completerPlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/notebook-extension:completer',
  requires: [INotebookTracker],
  optional: [ICompletionProviderManager, ITranslator],
  activate: activateNotebookCompleterService,
  autoStart: true
};

/**
 * A plugin to search notebook documents
 */
const searchProvider: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/notebook-extension:search',
  requires: [ISearchProviderRegistry],
  autoStart: true,
  activate: (app: JupyterFrontEnd, registry: ISearchProviderRegistry) => {
    registry.add('jp-notebookSearchProvider', NotebookSearchProvider);
  }
};

const tocPlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/notebook-extension:toc',
  requires: [INotebookTracker, ITableOfContentsRegistry, ISanitizer],
  optional: [IMarkdownParser],
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    tocRegistry: ITableOfContentsRegistry,
    sanitizer: ISanitizer,
    mdParser: IMarkdownParser | null
  ): void => {
    tocRegistry.add(new NotebookToCFactory(tracker, mdParser, sanitizer));
  }
};

const languageServerPlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/notebook-extension:language-server',
  requires: [
    INotebookTracker,
    ILSPDocumentConnectionManager,
    ILSPFeatureManager,
    ILSPCodeExtractorsManager
  ],
  activate: activateNotebookLanguageServer,
  autoStart: true
};

/**
 * Export the plugins as default.
 */
const plugins: JupyterFrontEndPlugin<any>[] = [
  factory,
  trackerPlugin,
  executionIndicator,
  exportPlugin,
  tools,
  commandEditItem,
  notebookTrustItem,
  widgetFactoryPlugin,
  logNotebookOutput,
  clonedOutputsPlugin,
  codeConsolePlugin,
  copyOutputPlugin,
  kernelStatus,
  lineColStatus,
  completerPlugin,
  searchProvider,
  tocPlugin,
  languageServerPlugin
];
export default plugins;

/**
 * Activate the notebook tools extension.
 */
function activateNotebookTools(
  app: JupyterFrontEnd,
  tracker: INotebookTracker,
  editorServices: IEditorServices,
  state: IStateDB,
  translator: ITranslator,
  inspectorProvider: IPropertyInspectorProvider | null
): INotebookTools {
  const trans = translator.load('jupyterlab');
  const id = 'notebook-tools';
  const notebookTools = new NotebookTools({ tracker, translator });
  const activeCellTool = new NotebookTools.ActiveCellTool();
  const editable = NotebookTools.createEditableToggle(translator);
  const slideShow = NotebookTools.createSlideShowSelector(translator);
  const tocBaseNumbering = NotebookTools.createToCBaseNumbering(translator);
  const editorFactory = editorServices.factoryService.newInlineEditor;
  const cellMetadataEditor = new NotebookTools.CellMetadataEditorTool({
    editorFactory,
    collapsed: false,
    translator
  });
  const notebookMetadataEditor = new NotebookTools.NotebookMetadataEditorTool({
    editorFactory,
    translator
  });

  const services = app.serviceManager;

  // Create message hook for triggers to save to the database.
  const hook = (sender: any, message: Message): boolean => {
    switch (message.type) {
      case 'activate-request':
        void state.save(id, { open: true });
        break;
      case 'after-hide':
      case 'close-request':
        void state.remove(id);
        break;
      default:
        break;
    }
    return true;
  };
  const optionsMap: { [key: string]: JSONValue } = {};
  optionsMap.None = null;
  void services.nbconvert.getExportFormats().then(response => {
    if (response) {
      /**
       * The excluded Cell Inspector Raw NbConvert Formats
       * (returned from nbconvert's export list)
       */
      const rawFormatExclude = [
        'pdf',
        'slides',
        'script',
        'notebook',
        'custom'
      ];
      let optionValueArray: any = [
        [trans.__('PDF'), 'pdf'],
        [trans.__('Slides'), 'slides'],
        [trans.__('Script'), 'script'],
        [trans.__('Notebook'), 'notebook'],
        [trans.__('Custom'), 'custom']
      ];

      // convert exportList to palette and menu items
      const formatList = Object.keys(response);
      const formatLabels = Private.getFormatLabels(translator);
      formatList.forEach(function (key) {
        if (rawFormatExclude.indexOf(key) === -1) {
          const altOption = trans.__(key[0].toUpperCase() + key.substr(1));
          const option = formatLabels[key] ? formatLabels[key] : altOption;
          const mimeTypeValue = response[key].output_mimetype;
          optionValueArray.push([option, mimeTypeValue]);
        }
      });
      const nbConvert = NotebookTools.createNBConvertSelector(
        optionValueArray,
        translator
      );
      notebookTools.addItem({ tool: nbConvert, section: 'common', rank: 3 });
    }
  });
  notebookTools.title.icon = buildIcon;
  notebookTools.title.caption = trans.__('Notebook Tools');
  notebookTools.id = id;

  notebookTools.addItem({ tool: activeCellTool, section: 'common', rank: 1 });
  notebookTools.addItem({ tool: editable, section: 'common', rank: 2 });
  notebookTools.addItem({ tool: slideShow, section: 'common', rank: 3 });
  notebookTools.addItem({ tool: tocBaseNumbering, section: 'common', rank: 4 });

  notebookTools.addItem({
    tool: cellMetadataEditor,
    section: 'advanced',
    rank: 1
  });
  notebookTools.addItem({
    tool: notebookMetadataEditor,
    section: 'advanced',
    rank: 2
  });

  MessageLoop.installMessageHook(notebookTools, hook);

  if (inspectorProvider) {
    tracker.widgetAdded.connect((sender, panel) => {
      const inspector = inspectorProvider.register(panel);
      inspector.render(notebookTools);
    });
  }

  return notebookTools;
}

/**
 * Activate the notebook widget factory.
 */
function activateWidgetFactory(
  app: JupyterFrontEnd,
  contentFactory: NotebookPanel.IContentFactory,
  editorServices: IEditorServices,
  rendermime: IRenderMimeRegistry,
  sessionContextDialogs: ISessionContextDialogs,
  toolbarRegistry: IToolbarWidgetRegistry,
  translator: ITranslator,
  settingRegistry: ISettingRegistry | null
): NotebookWidgetFactory.IFactory {
  const preferKernelOption = PageConfig.getOption('notebookStartsKernel');

  // If the option is not set, assume `true`
  const preferKernelValue =
    preferKernelOption === '' || preferKernelOption.toLowerCase() === 'true';

  const { commands } = app;
  let toolbarFactory:
    | ((
        widget: NotebookPanel
      ) =>
        | DocumentRegistry.IToolbarItem[]
        | IObservableList<DocumentRegistry.IToolbarItem>)
    | undefined;

  // Register notebook toolbar widgets
  toolbarRegistry.addFactory<NotebookPanel>(FACTORY, 'save', panel =>
    DocToolbarItems.createSaveButton(commands, panel.context.fileChanged)
  );
  toolbarRegistry.addFactory<NotebookPanel>(FACTORY, 'cellType', panel =>
    ToolbarItems.createCellTypeItem(panel, translator)
  );
  toolbarRegistry.addFactory<NotebookPanel>(FACTORY, 'kernelName', panel =>
    Toolbar.createKernelNameItem(
      panel.sessionContext,
      sessionContextDialogs,
      translator
    )
  );

  toolbarRegistry.addFactory<NotebookPanel>(
    FACTORY,
    'executionProgress',
    panel => {
      return ExecutionIndicator.createExecutionIndicatorItem(
        panel,
        translator,
        settingRegistry?.load(trackerPlugin.id)
      );
    }
  );

  if (settingRegistry) {
    // Create the factory
    toolbarFactory = createToolbarFactory(
      toolbarRegistry,
      settingRegistry,
      FACTORY,
      PANEL_SETTINGS,
      translator
    );
  }

  const trans = translator.load('jupyterlab');

  const factory = new NotebookWidgetFactory({
    name: FACTORY,
    label: trans.__('Notebook'),
    fileTypes: ['notebook'],
    modelName: 'notebook',
    defaultFor: ['notebook'],
    preferKernel: preferKernelValue,
    canStartKernel: true,
    rendermime,
    contentFactory,
    editorConfig: StaticNotebook.defaultEditorConfig,
    notebookConfig: StaticNotebook.defaultNotebookConfig,
    mimeTypeService: editorServices.mimeTypeService,
    sessionDialogs: sessionContextDialogs,
    toolbarFactory,
    translator: translator
  });
  app.docRegistry.addWidgetFactory(factory);
  return factory;
}

/**
 * Activate the plugin to create and track cloned outputs.
 */
function activateClonedOutputs(
  app: JupyterFrontEnd,
  docManager: IDocumentManager,
  notebookTracker: INotebookTracker,
  translator: ITranslator,
  restorer: ILayoutRestorer | null
): void {
  const trans = translator.load('jupyterlab');
  const clonedOutputs = new WidgetTracker<
    MainAreaWidget<Private.ClonedOutputArea>
  >({
    namespace: 'cloned-outputs'
  });

  if (restorer) {
    void restorer.restore(clonedOutputs, {
      command: CommandIDs.createOutputView,
      args: widget => ({
        path: widget.content.path,
        index: widget.content.index
      }),
      name: widget => `${widget.content.path}:${widget.content.index}`,
      when: notebookTracker.restored // After the notebook widgets (but not contents).
    });
  }

  const { commands, shell } = app;

  const isEnabledAndSingleSelected = (): boolean => {
    return Private.isEnabledAndSingleSelected(shell, notebookTracker);
  };

  commands.addCommand(CommandIDs.createOutputView, {
    label: trans.__('Create New View for Cell Output'),
    execute: async args => {
      let cell: CodeCell | undefined;
      let current: NotebookPanel | undefined | null;
      // If we are given a notebook path and cell index, then
      // use that, otherwise use the current active cell.
      const path = args.path as string | undefined | null;
      let index = args.index as number | undefined | null;
      if (path && index !== undefined && index !== null) {
        current = docManager.findWidget(path, FACTORY) as NotebookPanel;
        if (!current) {
          return;
        }
      } else {
        current = notebookTracker.currentWidget;
        if (!current) {
          return;
        }
        cell = current.content.activeCell as CodeCell;
        index = current.content.activeCellIndex;
      }
      // Create a MainAreaWidget
      const content = new Private.ClonedOutputArea({
        notebook: current,
        cell,
        index,
        translator
      });
      const widget = new MainAreaWidget({ content });
      current.context.addSibling(widget, {
        ref: current.id,
        mode: 'split-bottom',
        type: 'Cloned Output'
      });

      const updateCloned = () => {
        void clonedOutputs.save(widget);
      };

      current.context.pathChanged.connect(updateCloned);
      current.context.model?.cells.changed.connect(updateCloned);

      // Add the cloned output to the output widget tracker.
      void clonedOutputs.add(widget);

      // Remove the output view if the parent notebook is closed.
      current.content.disposed.connect(() => {
        current!.context.pathChanged.disconnect(updateCloned);
        current!.context.model?.cells.changed.disconnect(updateCloned);
        widget.dispose();
      });
    },
    isEnabled: isEnabledAndSingleSelected
  });
}

/**
 * Activate the plugin to add code console functionalities
 */
function activateCodeConsole(
  app: JupyterFrontEnd,
  tracker: INotebookTracker,
  translator: ITranslator
): void {
  const trans = translator.load('jupyterlab');
  const { commands, shell } = app;

  const isEnabled = (): boolean => Private.isEnabled(shell, tracker);

  commands.addCommand(CommandIDs.createConsole, {
    label: trans.__('New Console for Notebook'),
    execute: args => {
      const current = tracker.currentWidget;

      if (!current) {
        return;
      }

      return Private.createConsole(
        commands,
        current,
        args['activate'] as boolean
      );
    },
    isEnabled
  });

  commands.addCommand(CommandIDs.runInConsole, {
    label: trans.__('Run Selected Text or Current Line in Console'),
    execute: async args => {
      // Default to not activating the notebook (thereby putting the notebook
      // into command mode)
      const current = tracker.currentWidget;

      if (!current) {
        return;
      }

      const { context, content } = current;

      const cell = content.activeCell;
      const metadata = cell?.model.metadata.toJSON();
      const path = context.path;
      // ignore action in non-code cell
      if (!cell || cell.model.type !== 'code') {
        return;
      }

      let code: string;
      const editor = cell.editor;
      const selection = editor.getSelection();
      const { start, end } = selection;
      const selected = start.column !== end.column || start.line !== end.line;

      if (selected) {
        // Get the selected code from the editor.
        const start = editor.getOffsetAt(selection.start);
        const end = editor.getOffsetAt(selection.end);
        code = editor.model.value.text.substring(start, end);
      } else {
        // no selection, find the complete statement around the current line
        const cursor = editor.getCursorPosition();
        const srcLines = editor.model.value.text.split('\n');
        let curLine = selection.start.line;
        while (
          curLine < editor.lineCount &&
          !srcLines[curLine].replace(/\s/g, '').length
        ) {
          curLine += 1;
        }
        // if curLine > 0, we first do a search from beginning
        let fromFirst = curLine > 0;
        let firstLine = 0;
        let lastLine = firstLine + 1;
        // eslint-disable-next-line
        while (true) {
          code = srcLines.slice(firstLine, lastLine).join('\n');
          const reply =
            await current.context.sessionContext.session?.kernel?.requestIsComplete(
              {
                // ipython needs an empty line at the end to correctly identify completeness of indented code
                code: code + '\n\n'
              }
            );
          if (reply?.content.status === 'complete') {
            if (curLine < lastLine) {
              // we find a block of complete statement containing the current line, great!
              while (
                lastLine < editor.lineCount &&
                !srcLines[lastLine].replace(/\s/g, '').length
              ) {
                lastLine += 1;
              }
              editor.setCursorPosition({
                line: lastLine,
                column: cursor.column
              });
              break;
            } else {
              // discard the complete statement before the current line and continue
              firstLine = lastLine;
              lastLine = firstLine + 1;
            }
          } else if (lastLine < editor.lineCount) {
            // if incomplete and there are more lines, add the line and check again
            lastLine += 1;
          } else if (fromFirst) {
            // we search from the first line and failed, we search again from current line
            firstLine = curLine;
            lastLine = curLine + 1;
            fromFirst = false;
          } else {
            // if we have searched both from first line and from current line and we
            // cannot find anything, we submit the current line.
            code = srcLines[curLine];
            while (
              curLine + 1 < editor.lineCount &&
              !srcLines[curLine + 1].replace(/\s/g, '').length
            ) {
              curLine += 1;
            }
            editor.setCursorPosition({
              line: curLine + 1,
              column: cursor.column
            });
            break;
          }
        }
      }

      if (!code) {
        return;
      }

      await commands.execute('console:open', {
        activate: false,
        insertMode: 'split-bottom',
        path
      });
      await commands.execute('console:inject', {
        activate: false,
        code,
        path,
        metadata
      });
    },
    isEnabled
  });
}

/**
 * Activate the output copying extension
 */
function activateCopyOutput(
  app: JupyterFrontEnd,
  translator: ITranslator,
  tracker: INotebookTracker
): void {
  const trans = translator.load('jupyterlab');

  /**
   * Copy the contents of an HTMLElement to the system clipboard
   */
  function copyElement(e: HTMLElement): void {
    const sel = window.getSelection();

    if (sel == null) {
      return;
    }

    // Save the current selection.
    const savedRanges: Range[] = [];
    for (let i = 0; i < sel.rangeCount; ++i) {
      savedRanges[i] = sel.getRangeAt(i).cloneRange();
    }

    const range = document.createRange();
    range.selectNodeContents(e);
    sel.removeAllRanges();
    sel.addRange(range);

    document.execCommand('copy');

    // Restore the saved selection.
    sel.removeAllRanges();
    savedRanges.forEach(r => sel.addRange(r));
  }

  app.commands.addCommand(CommandIDs.copyToClipboard, {
    label: trans.__('Copy Output to Clipboard'),
    execute: args => {
      const cell = tracker.currentWidget?.content.activeCell as CodeCell;

      if (cell == null) {
        return;
      }

      const output = cell.outputArea.outputTracker.currentWidget;

      if (output == null) {
        return;
      }

      const outputAreaAreas = output.node.getElementsByClassName(
        'jp-OutputArea-output'
      );
      if (outputAreaAreas.length > 0) {
        const area = outputAreaAreas[0];
        copyElement(area as HTMLElement);
      }
    }
  });

  app.contextMenu.addItem({
    command: CommandIDs.copyToClipboard,
    selector: '.jp-OutputArea-child',
    rank: 0
  });
}

/**
 * Activate the notebook handler extension.
 */
function activateNotebookHandler(
  app: JupyterFrontEnd,
  factory: NotebookWidgetFactory.IFactory,
  translator: ITranslator,
  palette: ICommandPalette | null,
  browserFactory: IFileBrowserFactory | null,
  launcher: ILauncher | null,
  restorer: ILayoutRestorer | null,
  mainMenu: IMainMenu | null,
  settingRegistry: ISettingRegistry | null,
  sessionDialogs: ISessionContextDialogs | null
): INotebookTracker {
  const trans = translator.load('jupyterlab');
  const services = app.serviceManager;

  const { commands, shell } = app;
  const tracker = new NotebookTracker({ namespace: 'notebook' });

  const isEnabled = (): boolean => {
    return Private.isEnabled(shell, tracker);
  };

  const setSideBySideOutputRatio = (sideBySideOutputRatio: number) =>
    document.documentElement.style.setProperty(
      '--jp-side-by-side-output-size',
      `${sideBySideOutputRatio}fr`
    );

  // Fetch settings if possible.
  const fetchSettings = settingRegistry
    ? settingRegistry.load(trackerPlugin.id)
    : Promise.reject(new Error(`No setting registry for ${trackerPlugin.id}`));

  fetchSettings
    .then(settings => {
      updateConfig(settings);
      settings.changed.connect(() => {
        updateConfig(settings);
      });
      commands.addCommand(CommandIDs.autoClosingBrackets, {
        execute: args => {
          const codeConfig = settings.get('codeCellConfig')
            .composite as JSONObject;
          const markdownConfig = settings.get('markdownCellConfig')
            .composite as JSONObject;
          const rawConfig = settings.get('rawCellConfig')
            .composite as JSONObject;

          const anyToggled =
            codeConfig.autoClosingBrackets ||
            markdownConfig.autoClosingBrackets ||
            rawConfig.autoClosingBrackets;
          const toggled = !!(args['force'] ?? !anyToggled);
          [
            codeConfig.autoClosingBrackets,
            markdownConfig.autoClosingBrackets,
            rawConfig.autoClosingBrackets
          ] = [toggled, toggled, toggled];

          void settings.set('codeCellConfig', codeConfig);
          void settings.set('markdownCellConfig', markdownConfig);
          void settings.set('rawCellConfig', rawConfig);
        },
        label: trans.__('Auto Close Brackets for All Notebook Cell Types'),
        isToggled: () =>
          ['codeCellConfig', 'markdownCellConfig', 'rawCellConfig'].some(
            x => (settings.get(x).composite as JSONObject).autoClosingBrackets
          )
      });
      commands.addCommand(CommandIDs.setSideBySideRatio, {
        label: trans.__('Set side-by-side ratio'),
        execute: args => {
          InputDialog.getNumber({
            title: trans.__('Width of the output in side-by-side mode'),
            value: settings.get('sideBySideOutputRatio').composite as number
          })
            .then(result => {
              setSideBySideOutputRatio(result.value!);
              if (result.value) {
                void settings.set('sideBySideOutputRatio', result.value);
              }
            })
            .catch(console.error);
        }
      });
    })
    .catch((reason: Error) => {
      console.warn(reason.message);
      updateTracker({
        editorConfig: factory.editorConfig,
        notebookConfig: factory.notebookConfig,
        kernelShutdown: factory.shutdownOnClose
      });
    });

  // Handle state restoration.
  if (restorer) {
    void restorer.restore(tracker, {
      command: 'docmanager:open',
      args: panel => ({ path: panel.context.path, factory: FACTORY }),
      name: panel => panel.context.path,
      when: services.ready
    });
  }

  const registry = app.docRegistry;
  const modelFactory = new NotebookModelFactory({
    disableDocumentWideUndoRedo:
      factory.notebookConfig.disableDocumentWideUndoRedo
  });
  registry.addModelFactory(modelFactory);

  addCommands(app, tracker, translator, sessionDialogs, isEnabled);

  if (palette) {
    populatePalette(palette, translator);
  }

  let id = 0; // The ID counter for notebook panels.

  const ft = app.docRegistry.getFileType('notebook');

  factory.widgetCreated.connect((sender, widget) => {
    // If the notebook panel does not have an ID, assign it one.
    widget.id = widget.id || `notebook-${++id}`;

    // Set up the title icon
    widget.title.icon = ft?.icon;
    widget.title.iconClass = ft?.iconClass ?? '';
    widget.title.iconLabel = ft?.iconLabel ?? '';

    // Notify the widget tracker if restore data needs to update.
    widget.context.pathChanged.connect(() => {
      void tracker.save(widget);
    });
    // Add the notebook panel to the tracker.
    void tracker.add(widget);
  });

  /**
   * Update the settings of the current tracker.
   */
  function updateTracker(options: NotebookPanel.IConfig): void {
    tracker.forEach(widget => {
      widget.setConfig(options);
    });
  }

  /**
   * Update the setting values.
   */
  function updateConfig(settings: ISettingRegistry.ISettings): void {
    const code = {
      ...StaticNotebook.defaultEditorConfig.code,
      ...(settings.get('codeCellConfig').composite as JSONObject)
    };

    const markdown = {
      ...StaticNotebook.defaultEditorConfig.markdown,
      ...(settings.get('markdownCellConfig').composite as JSONObject)
    };

    const raw = {
      ...StaticNotebook.defaultEditorConfig.raw,
      ...(settings.get('rawCellConfig').composite as JSONObject)
    };

    factory.editorConfig = { code, markdown, raw };
    factory.notebookConfig = {
      showHiddenCellsButton: settings.get('showHiddenCellsButton')
        .composite as boolean,
      scrollPastEnd: settings.get('scrollPastEnd').composite as boolean,
      defaultCell: settings.get('defaultCell').composite as nbformat.CellType,
      recordTiming: settings.get('recordTiming').composite as boolean,
      numberCellsToRenderDirectly: settings.get('numberCellsToRenderDirectly')
        .composite as number,
      remainingTimeBeforeRescheduling: settings.get(
        'remainingTimeBeforeRescheduling'
      ).composite as number,
      renderCellOnIdle: settings.get('renderCellOnIdle').composite as boolean,
      observedTopMargin: settings.get('observedTopMargin').composite as string,
      observedBottomMargin: settings.get('observedBottomMargin')
        .composite as string,
      maxNumberOutputs: settings.get('maxNumberOutputs').composite as number,
      showEditorForReadOnlyMarkdown: settings.get(
        'showEditorForReadOnlyMarkdown'
      ).composite as boolean,
      disableDocumentWideUndoRedo: settings.get(
        'experimentalDisableDocumentWideUndoRedo'
      ).composite as boolean,
      renderingLayout: settings.get('renderingLayout').composite as
        | 'default'
        | 'side-by-side',
      sideBySideLeftMarginOverride: settings.get('sideBySideLeftMarginOverride')
        .composite as string,
      sideBySideRightMarginOverride: settings.get(
        'sideBySideRightMarginOverride'
      ).composite as string,
      sideBySideOutputRatio: settings.get('sideBySideOutputRatio')
        .composite as number
    };
    setSideBySideOutputRatio(factory.notebookConfig.sideBySideOutputRatio);
    const sideBySideMarginStyle = `.jp-mod-sideBySide.jp-Notebook .jp-Notebook-cell {
      margin-left: ${factory.notebookConfig.sideBySideLeftMarginOverride} !important;
      margin-right: ${factory.notebookConfig.sideBySideRightMarginOverride} !important;`;
    const sideBySideMarginTag = document.getElementById(SIDE_BY_SIDE_STYLE_ID);
    if (sideBySideMarginTag) {
      sideBySideMarginTag.innerText = sideBySideMarginStyle;
    } else {
      document.head.insertAdjacentHTML(
        'beforeend',
        `<style id="${SIDE_BY_SIDE_STYLE_ID}">${sideBySideMarginStyle}}</style>`
      );
    }
    factory.shutdownOnClose = settings.get('kernelShutdown')
      .composite as boolean;

    modelFactory.disableDocumentWideUndoRedo = settings.get(
      'experimentalDisableDocumentWideUndoRedo'
    ).composite as boolean;

    updateTracker({
      editorConfig: factory.editorConfig,
      notebookConfig: factory.notebookConfig,
      kernelShutdown: factory.shutdownOnClose
    });
  }

  // Add main menu notebook menu.
  if (mainMenu) {
    populateMenus(mainMenu, tracker, sessionDialogs, isEnabled);
  }

  // Utility function to create a new notebook.
  const createNew = async (cwd: string, kernelName?: string) => {
    const model = await commands.execute('docmanager:new-untitled', {
      path: cwd,
      type: 'notebook'
    });
    if (model != undefined) {
      const widget = (await commands.execute('docmanager:open', {
        path: model.path,
        factory: FACTORY,
        kernel: { name: kernelName }
      })) as unknown as IDocumentWidget;
      widget.isUntitled = true;
      return widget;
    }
  };

  // Add a command for creating a new notebook.
  commands.addCommand(CommandIDs.createNew, {
    label: args => {
      const kernelName = (args['kernelName'] as string) || '';
      if (args['isLauncher'] && args['kernelName'] && services.kernelspecs) {
        return (
          services.kernelspecs.specs?.kernelspecs[kernelName]?.display_name ??
          ''
        );
      }
      if (args['isPalette'] || args['isContextMenu']) {
        return trans.__('New Notebook');
      }
      return trans.__('Notebook');
    },
    caption: trans.__('Create a new notebook'),
    icon: args => (args['isPalette'] ? undefined : notebookIcon),
    execute: args => {
      const cwd =
        (args['cwd'] as string) ||
        (browserFactory ? browserFactory.defaultBrowser.model.path : '');
      const kernelName = (args['kernelName'] as string) || '';
      return createNew(cwd, kernelName);
    }
  });

  // Add a launcher item if the launcher is available.
  if (launcher) {
    void services.ready.then(() => {
      let disposables: DisposableSet | null = null;
      const onSpecsChanged = () => {
        if (disposables) {
          disposables.dispose();
          disposables = null;
        }
        const specs = services.kernelspecs.specs;
        if (!specs) {
          return;
        }
        disposables = new DisposableSet();

        for (const name in specs.kernelspecs) {
          const rank = name === specs.default ? 0 : Infinity;
          const spec = specs.kernelspecs[name]!;
          let kernelIconUrl = spec.resources['logo-64x64'];
          disposables.add(
            launcher.add({
              command: CommandIDs.createNew,
              args: { isLauncher: true, kernelName: name },
              category: trans.__('Notebook'),
              rank,
              kernelIconUrl,
              metadata: {
                kernel: JSONExt.deepCopy(
                  spec.metadata || {}
                ) as ReadonlyJSONValue
              }
            })
          );
        }
      };
      onSpecsChanged();
      services.kernelspecs.specsChanged.connect(onSpecsChanged);
    });
  }

  return tracker;
}

/**
 * Activate the completer service for notebook.
 */
function activateNotebookCompleterService(
  app: JupyterFrontEnd,
  notebooks: INotebookTracker,
  manager: ICompletionProviderManager | null,
  translator: ITranslator | null
): void {
  if (!manager) {
    return;
  }
  const trans = (translator ?? nullTranslator).load('jupyterlab');

  app.commands.addCommand(CommandIDs.invokeCompleter, {
    label: trans.__('Display the completion helper.'),
    execute: args => {
      const panel = notebooks.currentWidget;
      if (panel && panel.content.activeCell?.model.type === 'code') {
        manager.invoke(panel.id);
      }
    }
  });

  app.commands.addCommand(CommandIDs.selectCompleter, {
    label: trans.__('Select the completion suggestion.'),
    execute: () => {
      const id = notebooks.currentWidget && notebooks.currentWidget.id;

      if (id) {
        return manager.select(id);
      }
    }
  });

  app.commands.addKeyBinding({
    command: CommandIDs.selectCompleter,
    keys: ['Enter'],
    selector: '.jp-Notebook .jp-mod-completer-active'
  });
  const updateCompleter = async (
    _: INotebookTracker | undefined,
    notebook: NotebookPanel
  ) => {
    const completerContext = {
      editor: notebook.content.activeCell?.editor ?? null,
      session: notebook.sessionContext.session,
      widget: notebook
    };
    await manager.updateCompleter(completerContext);
    notebook.content.activeCellChanged.connect((_, cell) => {
      const newCompleterContext = {
        editor: cell.editor,
        session: notebook.sessionContext.session,
        widget: notebook
      };
      manager.updateCompleter(newCompleterContext).catch(console.error);
    });
    notebook.sessionContext.sessionChanged.connect(() => {
      const newCompleterContext = {
        editor: notebook.content.activeCell?.editor ?? null,
        session: notebook.sessionContext.session,
        widget: notebook
      };
      manager.updateCompleter(newCompleterContext).catch(console.error);
    });
  };
  notebooks.widgetAdded.connect(updateCompleter);
  manager.activeProvidersChanged.connect(() => {
    notebooks.forEach(panel => {
      updateCompleter(undefined, panel).catch(e => console.error(e));
    });
  });
}

/**
 * Activate the language server for notebook.
 */
function activateNotebookLanguageServer(
  app: JupyterFrontEnd,
  notebooks: INotebookTracker,
  connectionManager: ILSPDocumentConnectionManager,
  featureManager: ILSPFeatureManager,
  codeExtractorManager: ILSPCodeExtractorsManager
): void {
  notebooks.widgetAdded.connect(async (_, notebook) => {
    const adapter = new NotebookAdapter(notebook, {
      connectionManager,
      featureManager,
      foreignCodeExtractorsManager: codeExtractorManager
    });
    connectionManager.registerAdapter(notebook.context.path, adapter);
  });
}

// Get the current widget and activate unless the args specify otherwise.
function getCurrent(
  tracker: INotebookTracker,
  shell: JupyterFrontEnd.IShell,
  args: ReadonlyPartialJSONObject
): NotebookPanel | null {
  const widget = tracker.currentWidget;
  const activate = args['activate'] !== false;

  if (activate && widget) {
    shell.activateById(widget.id);
  }

  return widget;
}

/**
 * Add the notebook commands to the application's command registry.
 */
function addCommands(
  app: JupyterFrontEnd,
  tracker: NotebookTracker,
  translator: ITranslator,
  sessionDialogs: ISessionContextDialogs | null,
  isEnabled: () => boolean
): void {
  const trans = translator.load('jupyterlab');
  const { commands, shell } = app;

  sessionDialogs = sessionDialogs ?? sessionContextDialogs;

  const isEnabledAndSingleSelected = (): boolean => {
    return Private.isEnabledAndSingleSelected(shell, tracker);
  };

  const refreshCellCollapsed = (notebook: Notebook): void => {
    for (const cell of notebook.widgets) {
      if (cell instanceof MarkdownCell && cell.headingCollapsed) {
        NotebookActions.setHeadingCollapse(cell, true, notebook);
      }
      if (cell.model.id === notebook.activeCell?.model?.id) {
        NotebookActions.expandParent(cell, notebook);
      }
    }
  };

  const isEnabledAndHeadingSelected = (): boolean => {
    return Private.isEnabledAndHeadingSelected(shell, tracker);
  };

  // Set up signal handler to keep the collapse state consistent
  tracker.currentChanged.connect(
    (sender: INotebookTracker, panel: NotebookPanel) => {
      if (!panel?.content?.model?.cells) {
        return;
      }
      panel.content.model.cells.changed.connect(
        (
          list: IObservableUndoableList<ICellModel>,
          args: IObservableList.IChangedArgs<ICellModel>
        ) => {
          // Might be overkill to refresh this every time, but
          // it helps to keep the collapse state consistent.
          refreshCellCollapsed(panel.content);
        }
      );
      panel.content.activeCellChanged.connect(
        (notebook: Notebook, cell: Cell) => {
          NotebookActions.expandParent(cell, notebook);
        }
      );
    }
  );

  commands.addCommand(CommandIDs.runAndAdvance, {
    label: trans.__('Run Selected Cells'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        const { context, content } = current;

        return NotebookActions.runAndAdvance(content, context.sessionContext);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.run, {
    label: trans.__("Run Selected Cells and Don't Advance"),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        const { context, content } = current;

        return NotebookActions.run(content, context.sessionContext);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.runAndInsert, {
    label: trans.__('Run Selected Cells and Insert Below'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        const { context, content } = current;

        return NotebookActions.runAndInsert(content, context.sessionContext);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.runAll, {
    label: trans.__('Run All Cells'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        const { context, content } = current;

        return NotebookActions.runAll(content, context.sessionContext);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.runAllAbove, {
    label: trans.__('Run All Above Selected Cell'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        const { context, content } = current;

        return NotebookActions.runAllAbove(content, context.sessionContext);
      }
    },
    isEnabled: () => {
      // Can't run above if there are multiple cells selected,
      // or if we are at the top of the notebook.
      return (
        isEnabledAndSingleSelected() &&
        tracker.currentWidget!.content.activeCellIndex !== 0
      );
    }
  });
  commands.addCommand(CommandIDs.runAllBelow, {
    label: trans.__('Run Selected Cell and All Below'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        const { context, content } = current;

        return NotebookActions.runAllBelow(content, context.sessionContext);
      }
    },
    isEnabled: () => {
      // Can't run below if there are multiple cells selected,
      // or if we are at the bottom of the notebook.
      return (
        isEnabledAndSingleSelected() &&
        tracker.currentWidget!.content.activeCellIndex !==
          tracker.currentWidget!.content.widgets.length - 1
      );
    }
  });
  commands.addCommand(CommandIDs.renderAllMarkdown, {
    label: trans.__('Render All Markdown Cells'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);
      if (current) {
        const { context, content } = current;
        return NotebookActions.renderAllMarkdown(
          content,
          context.sessionContext
        );
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.restart, {
    label: trans.__('Restart Kernel…'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return sessionDialogs!.restart(current.sessionContext, translator);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.shutdown, {
    label: trans.__('Shut Down Kernel'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (!current) {
        return;
      }

      return current.context.sessionContext.shutdown();
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.closeAndShutdown, {
    label: trans.__('Close and Shut Down Notebook'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (!current) {
        return;
      }

      const fileName = current.title.label;

      return showDialog({
        title: trans.__('Shut down the notebook?'),
        body: trans.__('Are you sure you want to close "%1"?', fileName),
        buttons: [Dialog.cancelButton(), Dialog.warnButton()]
      }).then(result => {
        if (result.button.accept) {
          return commands
            .execute(CommandIDs.shutdown, { activate: false })
            .then(() => {
              current.dispose();
            });
        }
      });
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.trust, {
    label: () => trans.__('Trust Notebook'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);
      if (current) {
        const { context, content } = current;
        return NotebookActions.trust(content).then(() => context.save());
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.restartClear, {
    label: trans.__('Restart Kernel and Clear Outputs of All Cells…'),
    caption: trans.__('Restart the kernel and clear all outputs of all cells'),
    execute: async () => {
      const restarted: boolean = await commands.execute(CommandIDs.restart, {
        activate: false
      });
      if (restarted) {
        await commands.execute(CommandIDs.clearAllOutputs);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.restartAndRunToSelected, {
    label: trans.__('Restart Kernel and Run up to Selected Cell…'),
    execute: async () => {
      const restarted: boolean = await commands.execute(CommandIDs.restart, {
        activate: false
      });
      if (restarted) {
        const executed: boolean = await commands.execute(
          CommandIDs.runAllAbove,
          { activate: false }
        );
        if (executed) {
          return commands.execute(CommandIDs.run);
        }
      }
    },
    isEnabled: isEnabledAndSingleSelected
  });
  commands.addCommand(CommandIDs.restartRunAll, {
    label: trans.__('Restart Kernel and Run All Cells…'),
    execute: async () => {
      const restarted: boolean = await commands.execute(CommandIDs.restart, {
        activate: false
      });
      if (restarted) {
        await commands.execute(CommandIDs.runAll);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.clearAllOutputs, {
    label: trans.__('Clear Outputs of All Cells'),
    caption: trans.__('Clear all outputs of all cells'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.clearAllOutputs(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.clearOutputs, {
    label: trans.__('Clear Cell Output'),
    caption: trans.__('Clear outputs for the selected cells'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.clearOutputs(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.interrupt, {
    label: trans.__('Interrupt Kernel'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (!current) {
        return;
      }

      const kernel = current.context.sessionContext.session?.kernel;

      if (kernel) {
        return kernel.interrupt();
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.toCode, {
    label: trans.__('Change to Code Cell Type'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.changeCellType(current.content, 'code');
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.toMarkdown, {
    label: trans.__('Change to Markdown Cell Type'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.changeCellType(current.content, 'markdown');
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.toRaw, {
    label: trans.__('Change to Raw Cell Type'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.changeCellType(current.content, 'raw');
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.cut, {
    label: trans.__('Cut Cells'),
    caption: trans.__('Cut the selected cells'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.cut(current.content);
      }
    },
    icon: args => (args.toolbar ? cutIcon : undefined),
    isEnabled
  });
  commands.addCommand(CommandIDs.copy, {
    label: trans.__('Copy Cells'),
    caption: trans.__('Copy the selected cells'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.copy(current.content);
      }
    },
    icon: args => (args.toolbar ? copyIcon : ''),
    isEnabled
  });
  commands.addCommand(CommandIDs.pasteBelow, {
    label: trans.__('Paste Cells Below'),
    caption: trans.__('Paste cells from the clipboard'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.paste(current.content, 'below');
      }
    },
    icon: args => (args.toolbar ? pasteIcon : undefined),
    isEnabled
  });
  commands.addCommand(CommandIDs.pasteAbove, {
    label: trans.__('Paste Cells Above'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.paste(current.content, 'above');
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.duplicateBelow, {
    label: trans.__('Duplicate Cells Below'),
    caption: trans.__(
      'Copy the selected cells and paste them below the selection'
    ),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        NotebookActions.duplicate(current.content, 'belowSelected');
      }
    },
    icon: args => (args.toolbar ? duplicateIcon : ''),
    isEnabled
  });
  commands.addCommand(CommandIDs.pasteAndReplace, {
    label: trans.__('Paste Cells and Replace'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.paste(current.content, 'replace');
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.deleteCell, {
    label: trans.__('Delete Cells'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.deleteCells(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.split, {
    label: trans.__('Split Cell'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.splitCell(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.merge, {
    label: trans.__('Merge Selected Cells'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.mergeCells(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.mergeAbove, {
    label: trans.__('Merge Cell Above'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.mergeCells(current.content, true);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.mergeBelow, {
    label: trans.__('Merge Cell Below'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.mergeCells(current.content, false);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.insertAbove, {
    label: trans.__('Insert Cell Above'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.insertAbove(current.content);
      }
    },
    icon: args => (args.toolbar ? addAboveIcon : undefined),
    isEnabled
  });
  commands.addCommand(CommandIDs.insertBelow, {
    label: trans.__('Insert Cell Below'),
    caption: trans.__('Insert a cell below'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.insertBelow(current.content);
      }
    },
    icon: args => (args.toolbar ? addBelowIcon : undefined),
    isEnabled
  });
  commands.addCommand(CommandIDs.selectAbove, {
    label: trans.__('Select Cell Above'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.selectAbove(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.selectBelow, {
    label: trans.__('Select Cell Below'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.selectBelow(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.insertHeadingAbove, {
    label: trans.__('Insert Heading Above Current Heading'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.insertSameLevelHeadingAbove(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.insertHeadingBelow, {
    label: trans.__('Insert Heading Below Current Heading'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.insertSameLevelHeadingBelow(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.selectHeadingAboveOrCollapse, {
    label: trans.__('Select Heading Above or Collapse Heading'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.selectHeadingAboveOrCollapseHeading(
          current.content
        );
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.selectHeadingBelowOrExpand, {
    label: trans.__('Select Heading Below or Expand Heading'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.selectHeadingBelowOrExpandHeading(
          current.content
        );
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.extendAbove, {
    label: trans.__('Extend Selection Above'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.extendSelectionAbove(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.extendTop, {
    label: trans.__('Extend Selection to Top'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.extendSelectionAbove(current.content, true);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.extendBelow, {
    label: trans.__('Extend Selection Below'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.extendSelectionBelow(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.extendBottom, {
    label: trans.__('Extend Selection to Bottom'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.extendSelectionBelow(current.content, true);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.selectAll, {
    label: trans.__('Select All Cells'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.selectAll(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.deselectAll, {
    label: trans.__('Deselect All Cells'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.deselectAll(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.moveUp, {
    label: trans.__('Move Cells Up'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        NotebookActions.moveUp(current.content);
        Private.raiseSilentNotification(
          trans.__('Notebook cell shifted up successfully'),
          current.node
        );
      }
    },
    isEnabled,
    icon: args => (args.toolbar ? moveUpIcon : undefined)
  });
  commands.addCommand(CommandIDs.moveDown, {
    label: trans.__('Move Cells Down'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        NotebookActions.moveDown(current.content);
        Private.raiseSilentNotification(
          trans.__('Notebook cell shifted down successfully'),
          current.node
        );
      }
    },
    isEnabled,
    icon: args => (args.toolbar ? moveDownIcon : undefined)
  });
  commands.addCommand(CommandIDs.toggleAllLines, {
    label: trans.__('Show Line Numbers'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.toggleAllLineNumbers(current.content);
      }
    },
    isEnabled,
    isToggled: args => {
      const current = getCurrent(tracker, shell, { ...args, activate: false });
      if (current) {
        const config = current.content.editorConfig;
        return !!(
          config.code.lineNumbers &&
          config.markdown.lineNumbers &&
          config.raw.lineNumbers
        );
      } else {
        return false;
      }
    }
  });
  commands.addCommand(CommandIDs.commandMode, {
    label: trans.__('Enter Command Mode'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        current.content.mode = 'command';
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.editMode, {
    label: trans.__('Enter Edit Mode'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        current.content.mode = 'edit';
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.undoCellAction, {
    label: trans.__('Undo Cell Operation'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.undo(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.redoCellAction, {
    label: trans.__('Redo Cell Operation'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.redo(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.redo, {
    label: trans.__('Redo'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return current.content.activeCell?.editor.redo();
      }
    }
  });
  commands.addCommand(CommandIDs.undo, {
    label: trans.__('Undo'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return current.content.activeCell?.editor.undo();
      }
    }
  });
  commands.addCommand(CommandIDs.changeKernel, {
    label: trans.__('Change Kernel…'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return sessionDialogs!.selectKernel(
          current.context.sessionContext,
          translator
        );
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.getKernel, {
    label: trans.__('Get Kernel'),
    execute: args => {
      const current = getCurrent(tracker, shell, { activate: false, ...args });

      if (current) {
        return current.sessionContext.session?.kernel;
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.reconnectToKernel, {
    label: trans.__('Reconnect to Kernel'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (!current) {
        return;
      }

      const kernel = current.context.sessionContext.session?.kernel;

      if (kernel) {
        return kernel.reconnect();
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.markdown1, {
    label: trans.__('Change to Heading 1'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.setMarkdownHeader(current.content, 1);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.markdown2, {
    label: trans.__('Change to Heading 2'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.setMarkdownHeader(current.content, 2);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.markdown3, {
    label: trans.__('Change to Heading 3'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.setMarkdownHeader(current.content, 3);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.markdown4, {
    label: trans.__('Change to Heading 4'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.setMarkdownHeader(current.content, 4);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.markdown5, {
    label: trans.__('Change to Heading 5'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.setMarkdownHeader(current.content, 5);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.markdown6, {
    label: trans.__('Change to Heading 6'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.setMarkdownHeader(current.content, 6);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.hideCode, {
    label: trans.__('Collapse Selected Code'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.hideCode(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.showCode, {
    label: trans.__('Expand Selected Code'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.showCode(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.hideAllCode, {
    label: trans.__('Collapse All Code'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.hideAllCode(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.showAllCode, {
    label: trans.__('Expand All Code'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.showAllCode(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.hideOutput, {
    label: trans.__('Collapse Selected Outputs'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.hideOutput(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.showOutput, {
    label: trans.__('Expand Selected Outputs'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.showOutput(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.hideAllOutputs, {
    label: trans.__('Collapse All Outputs'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.hideAllOutputs(current.content);
      }
    },
    isEnabled
  });

  commands.addCommand(CommandIDs.toggleRenderSideBySideCurrentNotebook, {
    label: trans.__('Render Side-by-Side'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);
      if (current) {
        if (current.content.renderingLayout === 'side-by-side') {
          return NotebookActions.renderDefault(current.content);
        }
        return NotebookActions.renderSideBySide(current.content);
      }
    },
    isEnabled,
    isToggled: args => {
      const current = getCurrent(tracker, shell, { ...args, activate: false });
      if (current) {
        return current.content.renderingLayout === 'side-by-side';
      } else {
        return false;
      }
    }
  });

  commands.addCommand(CommandIDs.showAllOutputs, {
    label: trans.__('Expand All Outputs'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.showAllOutputs(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.enableOutputScrolling, {
    label: trans.__('Enable Scrolling for Outputs'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.enableOutputScrolling(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.disableOutputScrolling, {
    label: trans.__('Disable Scrolling for Outputs'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.disableOutputScrolling(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.selectLastRunCell, {
    label: trans.__('Select current running or last run cell'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.selectLastRunCell(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.replaceSelection, {
    label: trans.__('Replace Selection in Notebook Cell'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);
      const text: string = (args['text'] as string) || '';
      if (current) {
        return NotebookActions.replaceSelection(current.content, text);
      }
    },
    isEnabled
  });

  commands.addCommand(CommandIDs.toggleCollapseCmd, {
    label: trans.__('Toggle Collapse Notebook Heading'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);
      if (current) {
        return NotebookActions.toggleCurrentHeadingCollapse(current.content);
      }
    },
    isEnabled: isEnabledAndHeadingSelected
  });
  commands.addCommand(CommandIDs.collapseAllCmd, {
    label: trans.__('Collapse All Headings'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);
      if (current) {
        return NotebookActions.collapseAllHeadings(current.content);
      }
    }
  });
  commands.addCommand(CommandIDs.expandAllCmd, {
    label: trans.__('Expand All Headings'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);
      if (current) {
        return NotebookActions.expandAllHeadings(current.content);
      }
    }
  });

  commands.addCommand(CommandIDs.tocRunCells, {
    label: trans.__('Select and Run Cell(s) for this Heading'),
    execute: args => {
      const current = getCurrent(tracker, shell, { activate: false, ...args });
      if (current === null) {
        return;
      }

      const activeCell = current.content.activeCell;
      let lastIndex = current.content.activeCellIndex;

      if (activeCell instanceof MarkdownCell) {
        const cells = current.content.widgets;
        const level = activeCell.headingInfo.level;
        for (
          let i = current.content.activeCellIndex + 1;
          i < cells.length;
          i++
        ) {
          const cell = cells[i];
          if (
            cell instanceof MarkdownCell &&
            // cell.headingInfo.level === -1 if no heading
            cell.headingInfo.level >= 0 &&
            cell.headingInfo.level <= level
          ) {
            break;
          }
          lastIndex = i;
        }
      }

      current.content.extendContiguousSelectionTo(lastIndex);
      void NotebookActions.run(current.content, current.sessionContext);
    }
  });
}

/**
 * Populate the application's command palette with notebook commands.
 */
function populatePalette(
  palette: ICommandPalette,
  translator: ITranslator
): void {
  const trans = translator.load('jupyterlab');
  let category = trans.__('Notebook Operations');

  [
    CommandIDs.interrupt,
    CommandIDs.restart,
    CommandIDs.restartClear,
    CommandIDs.restartRunAll,
    CommandIDs.runAll,
    CommandIDs.renderAllMarkdown,
    CommandIDs.runAllAbove,
    CommandIDs.runAllBelow,
    CommandIDs.restartAndRunToSelected,
    CommandIDs.selectAll,
    CommandIDs.deselectAll,
    CommandIDs.clearAllOutputs,
    CommandIDs.toggleAllLines,
    CommandIDs.editMode,
    CommandIDs.commandMode,
    CommandIDs.changeKernel,
    CommandIDs.reconnectToKernel,
    CommandIDs.createConsole,
    CommandIDs.closeAndShutdown,
    CommandIDs.trust,
    CommandIDs.toggleCollapseCmd,
    CommandIDs.collapseAllCmd,
    CommandIDs.expandAllCmd
  ].forEach(command => {
    palette.addItem({ command, category });
  });

  palette.addItem({
    command: CommandIDs.createNew,
    category,
    args: { isPalette: true }
  });

  category = trans.__('Notebook Cell Operations');
  [
    CommandIDs.run,
    CommandIDs.runAndAdvance,
    CommandIDs.runAndInsert,
    CommandIDs.runInConsole,
    CommandIDs.clearOutputs,
    CommandIDs.toCode,
    CommandIDs.toMarkdown,
    CommandIDs.toRaw,
    CommandIDs.cut,
    CommandIDs.copy,
    CommandIDs.pasteBelow,
    CommandIDs.pasteAbove,
    CommandIDs.pasteAndReplace,
    CommandIDs.deleteCell,
    CommandIDs.split,
    CommandIDs.merge,
    CommandIDs.mergeAbove,
    CommandIDs.mergeBelow,
    CommandIDs.insertAbove,
    CommandIDs.insertBelow,
    CommandIDs.selectAbove,
    CommandIDs.selectBelow,
    CommandIDs.selectHeadingAboveOrCollapse,
    CommandIDs.selectHeadingBelowOrExpand,
    CommandIDs.insertHeadingAbove,
    CommandIDs.insertHeadingBelow,
    CommandIDs.extendAbove,
    CommandIDs.extendTop,
    CommandIDs.extendBelow,
    CommandIDs.extendBottom,
    CommandIDs.moveDown,
    CommandIDs.moveUp,
    CommandIDs.undoCellAction,
    CommandIDs.redoCellAction,
    CommandIDs.markdown1,
    CommandIDs.markdown2,
    CommandIDs.markdown3,
    CommandIDs.markdown4,
    CommandIDs.markdown5,
    CommandIDs.markdown6,
    CommandIDs.hideCode,
    CommandIDs.showCode,
    CommandIDs.hideAllCode,
    CommandIDs.showAllCode,
    CommandIDs.hideOutput,
    CommandIDs.showOutput,
    CommandIDs.hideAllOutputs,
    CommandIDs.showAllOutputs,
    CommandIDs.toggleRenderSideBySideCurrentNotebook,
    CommandIDs.setSideBySideRatio,
    CommandIDs.enableOutputScrolling,
    CommandIDs.disableOutputScrolling
  ].forEach(command => {
    palette.addItem({ command, category });
  });
}

/**
 * Populates the application menus for the notebook.
 */
function populateMenus(
  mainMenu: IMainMenu,
  tracker: INotebookTracker,
  sessionDialogs: ISessionContextDialogs | null,
  isEnabled: () => boolean
): void {
  sessionDialogs = sessionDialogs || sessionContextDialogs;

  // Add undo/redo hooks to the edit menu.
  mainMenu.editMenu.undoers.redo.add({
    id: CommandIDs.redo,
    isEnabled
  });
  mainMenu.editMenu.undoers.undo.add({
    id: CommandIDs.undo,
    isEnabled
  });

  // Add a clearer to the edit menu
  mainMenu.editMenu.clearers.clearAll.add({
    id: CommandIDs.clearAllOutputs,
    isEnabled
  });
  mainMenu.editMenu.clearers.clearCurrent.add({
    id: CommandIDs.clearOutputs,
    isEnabled
  });

  // Add a console creator the the Kernel menu
  mainMenu.fileMenu.consoleCreators.add({
    id: CommandIDs.createConsole,
    isEnabled
  });

  // Add a close and shutdown command to the file menu.
  mainMenu.fileMenu.closeAndCleaners.add({
    id: CommandIDs.closeAndShutdown,
    isEnabled
  });

  // Add a kernel user to the Kernel menu
  mainMenu.kernelMenu.kernelUsers.changeKernel.add({
    id: CommandIDs.changeKernel,
    isEnabled
  });
  mainMenu.kernelMenu.kernelUsers.clearWidget.add({
    id: CommandIDs.clearAllOutputs,
    isEnabled
  });
  mainMenu.kernelMenu.kernelUsers.interruptKernel.add({
    id: CommandIDs.interrupt,
    isEnabled
  });
  mainMenu.kernelMenu.kernelUsers.reconnectToKernel.add({
    id: CommandIDs.reconnectToKernel,
    isEnabled
  });
  mainMenu.kernelMenu.kernelUsers.restartKernel.add({
    id: CommandIDs.restart,
    isEnabled
  });
  mainMenu.kernelMenu.kernelUsers.shutdownKernel.add({
    id: CommandIDs.shutdown,
    isEnabled
  });

  // Add an IEditorViewer to the application view menu
  mainMenu.viewMenu.editorViewers.toggleLineNumbers.add({
    id: CommandIDs.toggleAllLines,
    isEnabled
  });

  // Add an ICodeRunner to the application run menu
  mainMenu.runMenu.codeRunners.restart.add({
    id: CommandIDs.restart,
    isEnabled
  });
  mainMenu.runMenu.codeRunners.run.add({
    id: CommandIDs.runAndAdvance,
    isEnabled
  });
  mainMenu.runMenu.codeRunners.runAll.add({ id: CommandIDs.runAll, isEnabled });

  // Add kernel information to the application help menu.
  mainMenu.helpMenu.getKernel.add({
    id: CommandIDs.getKernel,
    isEnabled
  });
}

/**
 * A namespace for module private functionality.
 */
namespace Private {
  /**
   * Create a console connected with a notebook kernel
   *
   * @param commands Commands registry
   * @param widget Notebook panel
   * @param activate Should the console be activated
   */
  export function createConsole(
    commands: CommandRegistry,
    widget: NotebookPanel,
    activate?: boolean
  ): Promise<void> {
    const options = {
      path: widget.context.path,
      preferredLanguage: widget.context.model.defaultKernelLanguage,
      activate: activate,
      ref: widget.id,
      insertMode: 'split-bottom',
      type: 'Linked Console'
    };

    return commands.execute('console:create', options);
  }

  /**
   * Whether there is an active notebook.
   */
  export function isEnabled(
    shell: JupyterFrontEnd.IShell,
    tracker: INotebookTracker
  ): boolean {
    return (
      tracker.currentWidget !== null &&
      tracker.currentWidget === shell.currentWidget
    );
  }

  /**
   * Whether there is an notebook active, with a single selected cell.
   */
  export function isEnabledAndSingleSelected(
    shell: JupyterFrontEnd.IShell,
    tracker: INotebookTracker
  ): boolean {
    if (!Private.isEnabled(shell, tracker)) {
      return false;
    }
    const { content } = tracker.currentWidget!;
    const index = content.activeCellIndex;
    // If there are selections that are not the active cell,
    // this command is confusing, so disable it.
    for (let i = 0; i < content.widgets.length; ++i) {
      if (content.isSelected(content.widgets[i]) && i !== index) {
        return false;
      }
    }
    return true;
  }

  /**
   * Whether there is an notebook active, with a single selected cell.
   */
  export function isEnabledAndHeadingSelected(
    shell: JupyterFrontEnd.IShell,
    tracker: INotebookTracker
  ): boolean {
    if (!Private.isEnabled(shell, tracker)) {
      return false;
    }
    const { content } = tracker.currentWidget!;
    const index = content.activeCellIndex;
    if (!(content.activeCell instanceof MarkdownCell)) {
      return false;
    }
    // If there are selections that are not the active cell,
    // this command is confusing, so disable it.
    for (let i = 0; i < content.widgets.length; ++i) {
      if (content.isSelected(content.widgets[i]) && i !== index) {
        return false;
      }
    }
    return true;
  }

  /**
   * The default Export To ... formats and their human readable labels.
   */
  export function getFormatLabels(translator: ITranslator): {
    [k: string]: string;
  } {
    translator = translator || nullTranslator;
    const trans = translator.load('jupyterlab');
    return {
      html: trans.__('HTML'),
      latex: trans.__('LaTeX'),
      markdown: trans.__('Markdown'),
      pdf: trans.__('PDF'),
      rst: trans.__('ReStructured Text'),
      script: trans.__('Executable Script'),
      slides: trans.__('Reveal.js Slides')
    };
  }

  /**
   * Raises a silent notification that is read by screen readers
   *
   * FIXME: Once a notificatiom API is introduced (https://github.com/jupyterlab/jupyterlab/issues/689),
   * this can be refactored to use the same.
   *
   * More discussion at https://github.com/jupyterlab/jupyterlab/pull/9031#issuecomment-773541469
   *
   *
   * @param message Message to be relayed to screen readers
   * @param notebookNode DOM node to which the notification container is attached
   */
  export function raiseSilentNotification(
    message: string,
    notebookNode: HTMLElement
  ) {
    const hiddenAlertContainerId = `sr-message-container-${notebookNode.id}`;

    const hiddenAlertContainer =
      document.getElementById(hiddenAlertContainerId) ||
      document.createElement('div');

    // If the container is not available, append the newly created container
    // to the current notebook panel and set related properties
    if (hiddenAlertContainer.getAttribute('id') !== hiddenAlertContainerId) {
      hiddenAlertContainer.classList.add('sr-only');
      hiddenAlertContainer.setAttribute('id', hiddenAlertContainerId);
      hiddenAlertContainer.setAttribute('role', 'alert');
      hiddenAlertContainer.hidden = true;
      notebookNode.appendChild(hiddenAlertContainer);
    }

    // Insert/Update alert container with the notification message
    hiddenAlertContainer.innerText = message;
  }

  /**
   * A widget hosting a cloned output area.
   */
  export class ClonedOutputArea extends Panel {
    constructor(options: ClonedOutputArea.IOptions) {
      super();
      const trans = (options.translator || nullTranslator).load('jupyterlab');
      this._notebook = options.notebook;
      this._index = options.index !== undefined ? options.index : -1;
      this._cell = options.cell || null;
      this.id = `LinkedOutputView-${UUID.uuid4()}`;
      this.title.label = 'Output View';
      this.title.icon = notebookIcon;
      this.title.caption = this._notebook.title.label
        ? trans.__('For Notebook: %1', this._notebook.title.label)
        : trans.__('For Notebook:');
      this.addClass('jp-LinkedOutputView');

      // Wait for the notebook to be loaded before
      // cloning the output area.
      void this._notebook.context.ready.then(() => {
        if (!this._cell) {
          this._cell = this._notebook.content.widgets[this._index] as CodeCell;
        }
        if (!this._cell || this._cell.model.type !== 'code') {
          this.dispose();
          return;
        }
        const clone = this._cell.cloneOutputArea();
        this.addWidget(clone);
      });
    }

    /**
     * The index of the cell in the notebook.
     */
    get index(): number {
      return this._cell
        ? ArrayExt.findFirstIndex(
            this._notebook.content.widgets,
            c => c === this._cell
          )
        : this._index;
    }

    /**
     * The path of the notebook for the cloned output area.
     */
    get path(): string {
      return this._notebook.context.path;
    }

    private _notebook: NotebookPanel;
    private _index: number;
    private _cell: CodeCell | null = null;
  }

  /**
   * ClonedOutputArea statics.
   */
  export namespace ClonedOutputArea {
    export interface IOptions {
      /**
       * The notebook associated with the cloned output area.
       */
      notebook: NotebookPanel;

      /**
       * The cell for which to clone the output area.
       */
      cell?: CodeCell;

      /**
       * If the cell is not available, provide the index
       * of the cell for when the notebook is loaded.
       */
      index?: number;

      /**
       * If the cell is not available, provide the index
       * of the cell for when the notebook is loaded.
       */
      translator?: ITranslator;
    }
  }
}
