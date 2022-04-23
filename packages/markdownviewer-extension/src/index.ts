// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
/**
 * @packageDocumentation
 * @module markdownviewer-extension
 */

import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { WidgetTracker } from '@jupyterlab/apputils';
import { PathExt } from '@jupyterlab/coreutils';
import {
  IMarkdownViewerTracker,
  MarkdownDocument,
  MarkdownViewer,
  MarkdownViewerFactory
} from '@jupyterlab/markdownviewer';
import {
  IRenderMimeRegistry,
  markdownRendererFactory
} from '@jupyterlab/rendermime';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator } from '@jupyterlab/translation';

/**
 * The command IDs used by the markdownviewer plugin.
 */
namespace CommandIDs {
  export const markdownPreview = 'markdownviewer:open';
  export const markdownEditor = 'markdownviewer:edit';
}

/**
 * The name of the factory that creates markdown viewer widgets.
 */
const FACTORY = 'Markdown Preview';

/**
 * The markdown viewer plugin.
 */
const plugin: JupyterFrontEndPlugin<IMarkdownViewerTracker> = {
  activate,
  id: '@jupyterlab/markdownviewer-extension:plugin',
  provides: IMarkdownViewerTracker,
  requires: [IRenderMimeRegistry, ITranslator],
  optional: [ILayoutRestorer, ISettingRegistry],
  autoStart: true
};

/**
 * Activate the markdown viewer plugin.
 */
function activate(
  app: JupyterFrontEnd,
  rendermime: IRenderMimeRegistry,
  translator: ITranslator,
  restorer: ILayoutRestorer | null,
  settingRegistry: ISettingRegistry | null
): IMarkdownViewerTracker {
  const trans = translator.load('jupyterlab');
  const { commands, docRegistry } = app;

  // Add the markdown renderer factory.
  rendermime.addFactory(markdownRendererFactory);

  const namespace = 'markdownviewer-widget';
  const tracker = new WidgetTracker<MarkdownDocument>({
    namespace
  });

  let config: Partial<MarkdownViewer.IConfig> = {
    ...MarkdownViewer.defaultConfig
  };

  /**
   * Update the settings of a widget.
   */
  function updateWidget(widget: MarkdownViewer): void {
    Object.keys(config).forEach((k: keyof MarkdownViewer.IConfig) => {
      widget.setOption(k, config[k] ?? null);
    });
  }

  if (settingRegistry) {
    const updateSettings = (settings: ISettingRegistry.ISettings) => {
      config = settings.composite as Partial<MarkdownViewer.IConfig>;
      tracker.forEach(widget => {
        updateWidget(widget.content);
      });
    };

    // Fetch the initial state of the settings.
    settingRegistry
      .load(plugin.id)
      .then((settings: ISettingRegistry.ISettings) => {
        settings.changed.connect(() => {
          updateSettings(settings);
        });
        updateSettings(settings);
      })
      .catch((reason: Error) => {
        console.error(reason.message);
      });
  }

  // Register the MarkdownViewer factory.
  const factory = new MarkdownViewerFactory({
    rendermime,
    name: FACTORY,
    primaryFileType: docRegistry.getFileType('markdown'),
    fileTypes: ['markdown'],
    defaultRendered: ['markdown']
  });
  factory.widgetCreated.connect((sender, widget) => {
    // Notify the widget tracker if restore data needs to update.
    widget.context.pathChanged.connect(() => {
      void tracker.save(widget);
    });
    // Handle the settings of new widgets.
    updateWidget(widget.content);
    void tracker.add(widget);
  });
  docRegistry.addWidgetFactory(factory);

  // Handle state restoration.
  if (restorer) {
    void restorer.restore(tracker, {
      command: 'docmanager:open',
      args: widget => ({ path: widget.context.path, factory: FACTORY }),
      name: widget => widget.context.path
    });
  }

  commands.addCommand(CommandIDs.markdownPreview, {
    label: trans.__('Markdown Preview'),
    execute: args => {
      const path = args['path'];
      if (typeof path !== 'string') {
        return;
      }
      return commands.execute('docmanager:open', {
        path,
        factory: FACTORY,
        options: args['options']
      });
    }
  });

  commands.addCommand(CommandIDs.markdownEditor, {
    execute: () => {
      const widget = tracker.currentWidget;
      if (!widget) {
        return;
      }
      const path = widget.context.path;
      return commands.execute('docmanager:open', {
        path,
        factory: 'Editor',
        options: {
          mode: 'split-right'
        }
      });
    },
    isVisible: () => {
      const widget = tracker.currentWidget;
      return (
        (widget && PathExt.extname(widget.context.path) === '.md') || false
      );
    },
    label: trans.__('Show Markdown Editor')
  });

  return tracker;
}

/**
 * Export the plugin as default.
 */
export default plugin;
