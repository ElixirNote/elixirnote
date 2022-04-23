// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ITranslator, nullTranslator } from '@jupyterlab/translation';

import { showErrorMessage } from '@jupyterlab/apputils';

import { ToolbarButton } from '@jupyterlab/apputils';

import { refreshIcon, searchIcon } from '@jupyterlab/ui-components';

import { Panel } from '@lumino/widgets';

import { IDebugger } from '../../tokens';

import { KernelSourcesBody } from './body';

import { KernelSourcesHeader } from './header';

/**
 * A Panel that shows a preview of the source code while debugging.
 */
export class KernelSources extends Panel {
  /**
   * Instantiate a new Sources preview Panel.
   *
   * @param options The Sources instantiation options.
   */
  constructor(options: KernelSources.IOptions) {
    super();
    const { model, service } = options;
    this._model = model;
    const trans = (options.translator ?? nullTranslator).load('jupyterlab');
    this.title.label = trans.__('Kernel Sources');

    const header = new KernelSourcesHeader(model, options.translator);

    header.addClass('jp-DebuggerKernelSources-header');

    this._body = new KernelSourcesBody({
      service,
      model,
      translator: options.translator
    });

    header.toolbar.addItem(
      'open-filter',
      new ToolbarButton({
        icon: searchIcon,
        onClick: async (): Promise<void> => {
          this._body.toggleFilterbox();
        },
        tooltip: trans.__('Toggle search filter')
      })
    );

    header.toolbar.addItem(
      'refresh',
      new ToolbarButton({
        icon: refreshIcon,
        onClick: () => {
          this._model.kernelSources = [];
          void service.displayModules().catch(reason => {
            void showErrorMessage(
              trans.__('Fail to get kernel sources'),
              trans.__('Fail to get kernel sources:\n%2', reason)
            );
          });
        },
        tooltip: trans.__('Refresh kernel sources')
      })
    );

    this.addClass('jp-DebuggerKernelSources-header');
    this.addClass('jp-DebuggerKernelSources');

    this.addWidget(header);
    this.addWidget(this._body);
  }

  public set filter(filter: string) {
    this._model.filter = filter;
  }

  private _model: IDebugger.Model.IKernelSources;
  private _body: KernelSourcesBody;
}

/**
 * A namespace for `Sources` statics.
 */
export namespace KernelSources {
  /**
   * The options used to create a Sources.
   */
  export interface IOptions {
    /**
     * The debugger service.
     */
    service: IDebugger;

    /**
     * The model for the sources.
     */
    model: IDebugger.Model.IKernelSources;

    /**
     * The application language translator
     */
    translator?: ITranslator;
  }
}
