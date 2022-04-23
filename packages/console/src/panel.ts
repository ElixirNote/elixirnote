// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ISessionContext,
  MainAreaWidget,
  SessionContext,
  sessionContextDialogs
} from '@jupyterlab/apputils';
import { IEditorMimeTypeService } from '@jupyterlab/codeeditor';
import { PathExt, Time, URLExt } from '@jupyterlab/coreutils';
import {
  IRenderMimeRegistry,
  RenderMimeRegistry
} from '@jupyterlab/rendermime';
import { ServiceManager } from '@jupyterlab/services';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { consoleIcon } from '@jupyterlab/ui-components';
import { Token, UUID } from '@lumino/coreutils';
import { IDisposable } from '@lumino/disposable';
import { Message } from '@lumino/messaging';
import { Panel } from '@lumino/widgets';
import { CodeConsole } from './widget';

/**
 * The class name added to console panels.
 */
const PANEL_CLASS = 'jp-ConsolePanel';

/**
 * A panel which contains a console and the ability to add other children.
 */
export class ConsolePanel extends MainAreaWidget<Panel> {
  /**
   * Construct a console panel.
   */
  constructor(options: ConsolePanel.IOptions) {
    super({ content: new Panel() });
    this.addClass(PANEL_CLASS);
    let {
      rendermime,
      mimeTypeService,
      path,
      basePath,
      name,
      manager,
      modelFactory,
      sessionContext,
      translator
    } = options;
    this.translator = translator || nullTranslator;
    const trans = this.translator.load('jupyterlab');

    const contentFactory = (this.contentFactory =
      options.contentFactory || ConsolePanel.defaultContentFactory);
    const count = Private.count++;
    if (!path) {
      path = URLExt.join(basePath || '', `console-${count}-${UUID.uuid4()}`);
    }

    sessionContext = this._sessionContext =
      sessionContext ||
      new SessionContext({
        sessionManager: manager.sessions,
        specsManager: manager.kernelspecs,
        path,
        name: name || trans.__('Console %1', count),
        type: 'console',
        kernelPreference: options.kernelPreference,
        setBusy: options.setBusy
      });

    const resolver = new RenderMimeRegistry.UrlResolver({
      session: sessionContext,
      contents: manager.contents
    });
    rendermime = rendermime.clone({ resolver });

    this.console = contentFactory.createConsole({
      rendermime,
      sessionContext: sessionContext,
      mimeTypeService,
      contentFactory,
      modelFactory
    });
    this.content.addWidget(this.console);

    void sessionContext.initialize().then(async value => {
      if (value) {
        await sessionContextDialogs.selectKernel(sessionContext!);
      }
      this._connected = new Date();
      this._updateTitlePanel();
    });

    this.console.executed.connect(this._onExecuted, this);
    this._updateTitlePanel();
    sessionContext.kernelChanged.connect(this._updateTitlePanel, this);
    sessionContext.propertyChanged.connect(this._updateTitlePanel, this);

    this.title.icon = consoleIcon;
    this.title.closable = true;
    this.id = `console-${count}`;
  }

  /**
   * The content factory used by the console panel.
   */
  readonly contentFactory: ConsolePanel.IContentFactory;

  /**
   * The console widget used by the panel.
   */
  console: CodeConsole;

  /**
   * The session used by the panel.
   */
  get sessionContext(): ISessionContext {
    return this._sessionContext;
  }

  /**
   * Dispose of the resources held by the widget.
   */
  dispose(): void {
    this.sessionContext.dispose();
    this.console.dispose();
    super.dispose();
  }

  /**
   * Handle `'activate-request'` messages.
   */
  protected onActivateRequest(msg: Message): void {
    const prompt = this.console.promptCell;
    if (prompt) {
      prompt.editor.focus();
    }
  }

  /**
   * Handle `'close-request'` messages.
   */
  protected onCloseRequest(msg: Message): void {
    super.onCloseRequest(msg);
    this.dispose();
  }

  /**
   * Handle a console execution.
   */
  private _onExecuted(sender: CodeConsole, args: Date) {
    this._executed = args;
    this._updateTitlePanel();
  }

  /**
   * Update the console panel title.
   */
  private _updateTitlePanel(): void {
    Private.updateTitle(this, this._connected, this._executed, this.translator);
  }

  translator: ITranslator;
  private _executed: Date | null = null;
  private _connected: Date | null = null;
  private _sessionContext: ISessionContext;
}

/**
 * A namespace for ConsolePanel statics.
 */
export namespace ConsolePanel {
  /**
   * The initialization options for a console panel.
   */
  export interface IOptions {
    /**
     * The rendermime instance used by the panel.
     */
    rendermime: IRenderMimeRegistry;

    /**
     * The content factory for the panel.
     */
    contentFactory: IContentFactory;

    /**
     * The service manager used by the panel.
     */
    manager: ServiceManager.IManager;

    /**
     * The path of an existing console.
     */
    path?: string;

    /**
     * The base path for a new console.
     */
    basePath?: string;

    /**
     * The name of the console.
     */
    name?: string;

    /**
     * A kernel preference.
     */
    kernelPreference?: ISessionContext.IKernelPreference;

    /**
     * An existing session context to use.
     */
    sessionContext?: ISessionContext;

    /**
     * The model factory for the console widget.
     */
    modelFactory?: CodeConsole.IModelFactory;

    /**
     * The service used to look up mime types.
     */
    mimeTypeService: IEditorMimeTypeService;

    /**
     * The application language translator.
     */
    translator?: ITranslator;

    /**
     * A function to call when the kernel is busy.
     */
    setBusy?: () => IDisposable;
  }

  /**
   * The console panel renderer.
   */
  export interface IContentFactory extends CodeConsole.IContentFactory {
    /**
     * Create a new console panel.
     */
    createConsole(options: CodeConsole.IOptions): CodeConsole;
  }

  /**
   * Default implementation of `IContentFactory`.
   */
  export class ContentFactory
    extends CodeConsole.ContentFactory
    implements IContentFactory {
    /**
     * Create a new console panel.
     */
    createConsole(options: CodeConsole.IOptions): CodeConsole {
      return new CodeConsole(options);
    }
  }

  /**
   * A namespace for the console panel content factory.
   */
  export namespace ContentFactory {
    /**
     * Options for the code console content factory.
     */
    export interface IOptions extends CodeConsole.ContentFactory.IOptions {}
  }

  /**
   * A default code console content factory.
   */
  export const defaultContentFactory: IContentFactory = new ContentFactory();

  /* tslint:disable */
  /**
   * The console renderer token.
   */
  export const IContentFactory = new Token<IContentFactory>(
    '@jupyterlab/console:IContentFactory'
  );
  /* tslint:enable */
}

/**
 * A namespace for private data.
 */
namespace Private {
  /**
   * The counter for new consoles.
   */
  export let count = 1;

  /**
   * Update the title of a console panel.
   */
  export function updateTitle(
    panel: ConsolePanel,
    connected: Date | null,
    executed: Date | null,
    translator?: ITranslator
  ) {
    translator = translator || nullTranslator;
    const trans = translator.load('jupyterlab');

    const sessionContext = panel.console.sessionContext.session;
    if (sessionContext) {
      // FIXME:
      let caption =
        trans.__('Name: %1\n', sessionContext.name) +
        trans.__('Directory: %1\n', PathExt.dirname(sessionContext.path)) +
        trans.__('Kernel: %1', panel.console.sessionContext.kernelDisplayName);

      if (connected) {
        caption += trans.__(
          '\nConnected: %1',
          Time.format(connected.toISOString())
        );
      }

      if (executed) {
        caption += trans.__('\nLast Execution: %1');
      }
      panel.title.label = sessionContext.name;
      panel.title.caption = caption;
    } else {
      panel.title.label = trans.__('Console');
      panel.title.caption = '';
    }
  }
}
