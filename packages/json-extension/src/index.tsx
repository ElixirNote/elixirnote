// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
/**
 * @packageDocumentation
 * @module json-extension
 */

import { Printing } from '@jupyterlab/apputils';
import { IRenderMime } from '@jupyterlab/rendermime-interfaces';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { JSONObject, JSONValue } from '@lumino/coreutils';
import { Message } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Component } from './component';

/**
 * The CSS class to add to the JSON Widget.
 */
const CSS_CLASS = 'jp-RenderedJSON';

/**
 * The MIME type for JSON.
 */
export const MIME_TYPE = 'application/json';

/**
 * A renderer for JSON data.
 */
export class RenderedJSON
  extends Widget
  implements IRenderMime.IRenderer, Printing.IPrintable {
  /**
   * Create a new widget for rendering JSON.
   */
  constructor(options: IRenderMime.IRendererOptions) {
    super();
    this.addClass(CSS_CLASS);
    this.addClass('CodeMirror');
    this.addClass('cm-s-jupyter');
    this._mimeType = options.mimeType;
    this.translator = options.translator || nullTranslator;
  }

  [Printing.symbol]() {
    return () => Printing.printWidget(this);
  }

  /**
   * Render JSON into this widget's node.
   */
  renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    const data = (model.data[this._mimeType] || {}) as NonNullable<JSONValue>;
    const metadata = (model.metadata[this._mimeType] || {}) as JSONObject;
    return new Promise<void>((resolve, reject) => {
      ReactDOM.render(
        <Component
          data={data}
          metadata={metadata}
          translator={this.translator}
        />,
        this.node,
        () => {
          resolve();
        }
      );
    });
  }

  /**
   * Called before the widget is detached from the DOM.
   */
  protected onBeforeDetach(msg: Message): void {
    // Unmount the component so it can tear down.
    ReactDOM.unmountComponentAtNode(this.node);
  }

  translator: ITranslator;
  private _mimeType: string;
}

/**
 * A mime renderer factory for JSON data.
 */
export const rendererFactory: IRenderMime.IRendererFactory = {
  safe: true,
  mimeTypes: [MIME_TYPE],
  createRenderer: options => new RenderedJSON(options)
};

const extensions: IRenderMime.IExtension | IRenderMime.IExtension[] = [
  {
    id: '@jupyterlab/json-extension:factory',
    rendererFactory,
    rank: 0,
    dataType: 'json',
    documentWidgetFactoryOptions: {
      name: 'JSON',
      primaryFileType: 'json',
      fileTypes: ['json', 'notebook', 'geojson'],
      defaultFor: ['json']
    }
  }
];

export default extensions;
