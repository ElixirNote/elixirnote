// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { KernelMessage, Session } from '@jupyterlab/services';
import { DataConnector } from '@jupyterlab/statedb';
import { CompletionHandler } from './handler';

/**
 * A kernel connector for completion handlers.
 */
export class KernelConnector extends DataConnector<
  CompletionHandler.IReply,
  void,
  CompletionHandler.IRequest
> {
  /**
   * Create a new kernel connector for completion requests.
   *
   * @param options - The instantiation options for the kernel connector.
   */
  constructor(options: KernelConnector.IOptions) {
    super();
    this._session = options.session;
  }

  /**
   * Fetch completion requests.
   *
   * @param request - The completion request text and details.
   */
  async fetch(
    request: CompletionHandler.IRequest
  ): Promise<CompletionHandler.IReply> {
    const kernel = this._session?.kernel;

    if (!kernel) {
      throw new Error('No kernel for completion request.');
    }

    const contents: KernelMessage.ICompleteRequestMsg['content'] = {
      code: request.text,
      cursor_pos: request.offset
    };

    const msg = await kernel.requestComplete(contents);
    const response = msg.content;

    if (response.status !== 'ok') {
      throw new Error('Completion fetch failed to return successfully.');
    }

    return {
      start: response.cursor_start,
      end: response.cursor_end,
      matches: response.matches,
      metadata: response.metadata
    };
  }

  private _session: Session.ISessionConnection | null;
}

/**
 * A namespace for kernel connector statics.
 */
export namespace KernelConnector {
  /**
   * The instantiation options for cell completion handlers.
   */
  export interface IOptions {
    /**
     * The session used by the kernel connector.
     */
    session: Session.ISessionConnection | null;
  }
}
