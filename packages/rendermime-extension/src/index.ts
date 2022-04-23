/* -----------------------------------------------------------------------------
| Copyright (c) Jupyter Development Team.
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/
/**
 * @packageDocumentation
 * @module rendermime-extension
 */

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ISanitizer } from '@jupyterlab/apputils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import {
  ILatexTypesetter,
  IRenderMimeRegistry,
  RenderMimeRegistry,
  standardRendererFactories
} from '@jupyterlab/rendermime';
import { ITranslator } from '@jupyterlab/translation';

namespace CommandIDs {
  export const handleLink = 'rendermime:handle-local-link';
}

/**
 * A plugin providing a rendermime registry.
 */
const plugin: JupyterFrontEndPlugin<IRenderMimeRegistry> = {
  id: '@jupyterlab/rendermime-extension:plugin',
  requires: [ITranslator],
  optional: [IDocumentManager, ILatexTypesetter, ISanitizer],
  provides: IRenderMimeRegistry,
  activate: activate,
  autoStart: true
};

/**
 * Export the plugin as default.
 */
export default plugin;

/**
 * Activate the rendermine plugin.
 */
function activate(
  app: JupyterFrontEnd,
  translator: ITranslator,
  docManager: IDocumentManager | null,
  latexTypesetter: ILatexTypesetter | null,
  sanitizer: ISanitizer | null
): RenderMimeRegistry {
  const trans = translator.load('jupyterlab');
  if (docManager) {
    app.commands.addCommand(CommandIDs.handleLink, {
      label: trans.__('Handle Local Link'),
      execute: args => {
        const path = args['path'] as string | undefined | null;
        const id = args['id'] as string | undefined | null;
        if (!path) {
          return;
        }
        // First check if the path exists on the server.
        return docManager.services.contents
          .get(path, { content: false })
          .then(() => {
            // Open the link with the default rendered widget factory,
            // if applicable.
            const factory = docManager.registry.defaultRenderedWidgetFactory(
              path
            );
            const widget = docManager.openOrReveal(path, factory.name);

            // Handle the hash if one has been provided.
            if (widget && id) {
              widget.setFragment(id);
            }
          });
      }
    });
  }
  return new RenderMimeRegistry({
    initialFactories: standardRendererFactories,
    linkHandler: !docManager
      ? undefined
      : {
          handleLink: (node: HTMLElement, path: string, id?: string) => {
            // If node has the download attribute explicitly set, use the
            // default browser downloading behavior.
            if (node.tagName === 'A' && node.hasAttribute('download')) {
              return;
            }
            app.commandLinker.connectNode(node, CommandIDs.handleLink, {
              path,
              id
            });
          }
        },
    latexTypesetter: latexTypesetter ?? undefined,
    translator: translator,
    sanitizer: sanitizer ?? undefined
  });
}
