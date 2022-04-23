// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import type { ElementHandle, Page, Response } from '@playwright/test';
import * as path from 'path';
import { ContentsHelper } from './contents';
import {
  ActivityHelper,
  FileBrowserHelper,
  KernelHelper,
  LogConsoleHelper,
  MenuHelper,
  NotebookHelper,
  PerformanceHelper,
  SidebarHelper,
  StatusBarHelper,
  ThemeHelper
} from './helpers';
import * as Utils from './utils';

/**
 * JupyterLab page interface
 */
export interface IJupyterLabPageFixture
  extends Omit<Page, 'goto'>,
    IJupyterLabPage {}

/**
 * JupyterLab specific helpers interface
 */
export interface IJupyterLabPage {
  /**
   * Application URL path fragment
   */
  readonly appPath: string;
  /**
   * JupyterLab activity helpers
   */
  readonly activity: ActivityHelper;
  /**
   * JupyterLab contents helpers
   */
  readonly contents: ContentsHelper;
  /**
   * JupyterLab filebrowser helpers
   */
  readonly filebrowser: FileBrowserHelper;
  /**
   * JupyterLab kernel helpers
   */
  readonly kernel: KernelHelper;
  /**
   * JupyterLab log console helpers
   */
  readonly logconsole: LogConsoleHelper;
  /**
   * JupyterLab menu helpers
   */
  readonly menu: MenuHelper;
  /**
   * JupyterLab notebook helpers
   */
  readonly notebook: NotebookHelper;

  /**
   * Webbrowser performance helpers
   */
  readonly performance: PerformanceHelper;
  /**
   * JupyterLab status bar helpers
   */
  readonly statusbar: StatusBarHelper;
  /**
   * JupyterLab sidebar helpers
   */
  readonly sidebar: SidebarHelper;
  /**
   * JupyterLab theme helpers
   */
  readonly theme: ThemeHelper;

  /**
   * Selector for launcher tab
   */
  readonly launcherSelector: string;

  /**
   * Getter for JupyterLab base URL
   */
  getBaseUrl(): Promise<string>;

  /**
   * Getter for JupyterLab page configuration property
   *
   * @param name Option name
   * @returns The property value
   */
  getOption(name: string): Promise<string>;

  /**
   * Getter for JupyterLab server root folder
   */
  getServerRoot(): Promise<string | null>;

  /**
   * Getter for JupyterLab token
   */
  getToken(): Promise<string>;

  /**
   * Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the
   * last redirect.
   *
   * This overrides the standard Playwright `page.goto` method by waiting for:
   * - the application to be started (plugins are loaded)
   * - the galata in page code to be injected
   * - the splash screen to have disappeared
   * - the launcher to be visible
   *
   * `page.goto` will throw an error if:
   * - there's an SSL error (e.g. in case of self-signed certificates).
   * - target URL is invalid.
   * - the `timeout` is exceeded during navigation.
   * - the remote server does not respond or is unreachable.
   * - the main resource failed to load.
   *
   * `page.goto` will not throw an error when any valid HTTP status code is returned by the remote server, including 404 "Not
   * Found" and 500 "Internal Server Error".  The status code for such responses can be retrieved by calling
   * [response.status()](https://playwright.dev/docs/api/class-response#response-status).
   *
   * > NOTE: `page.goto` either throws an error or returns a main resource response. The only exceptions are navigation to
   * `about:blank` or navigation to the same URL with a different hash, which would succeed and return `null`.
   * > NOTE: Headless mode doesn't support navigation to a PDF document. See the
   * [upstream issue](https://bugs.chromium.org/p/chromium/issues/detail?id=761295).
   *
   * Shortcut for main frame's [frame.goto(url[, options])](https://playwright.dev/docs/api/class-frame#frame-goto)
   * @param url URL to navigate page to. The url should include scheme, e.g. `https://`. When a `baseURL` via the context options was provided and the passed URL is a path, it gets merged via the
   * [`new URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor.
   * @param options
   */
  goto(
    url?: string,
    options?: {
      /**
       * Referer header value. If provided it will take preference over the referer header value set by
       * [page.setExtraHTTPHeaders(headers)](https://playwright.dev/docs/api/class-page#page-set-extra-http-headers).
       */
      referer?: string;

      /**
       * Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be
       * changed by using the
       * [browserContext.setDefaultNavigationTimeout(timeout)](https://playwright.dev/docs/api/class-browsercontext#browser-context-set-default-navigation-timeout),
       * [browserContext.setDefaultTimeout(timeout)](https://playwright.dev/docs/api/class-browsercontext#browser-context-set-default-timeout),
       * [page.setDefaultNavigationTimeout(timeout)](https://playwright.dev/docs/api/class-page#page-set-default-navigation-timeout)
       * or [page.setDefaultTimeout(timeout)](https://playwright.dev/docs/api/class-page#page-set-default-timeout) methods.
       */
      timeout?: number;

      /**
       * When to consider operation succeeded, defaults to `load`. Events can be either:
       * - `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
       * - `'load'` - consider operation to be finished when the `load` event is fired.
       * - `'networkidle'` - consider operation to be finished when there are no network connections for at least `500` ms.
       */
      waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
    }
  ): Promise<Response | null>;

  /**
   * Whether JupyterLab is in simple mode or not
   */
  isInSimpleMode(): Promise<boolean>;

  /**
   * Reset the User Interface
   */
  resetUI(): Promise<void>;

  /**
   * Set JupyterLab simple mode
   *
   * @param simple Simple mode value
   * @returns Whether this operation succeeds or not
   */
  setSimpleMode(simple: boolean): Promise<boolean>;

  /**
   * Wait for a  condition to be fulfilled
   *
   * @param condition Condition to fulfill
   * @param timeout Maximal time to wait for the condition to be true
   */
  waitForCondition(
    condition: () => Promise<boolean> | boolean,
    timeout?: number
  ): Promise<void>;

  /**
   * Wait for an element to emit 'transitionend' event.
   *
   * @param element Element or selector to watch
   */
  waitForTransition(element: ElementHandle<Element> | string): Promise<void>;

  /**
   * Factory for active activity tab xpath
   *
   * @returns The selector
   */
  xpBuildActiveActivityTabSelector(): string;

  /**
   * Factory for activity panel xpath by id
   * @param id Panel id
   * @returns The selector
   */
  xpBuildActivityPanelSelector(id: string): string;

  /**
   * Factory for activity tab xpath by name
   *
   * @param name Activity name
   * @returns The selector
   */
  xpBuildActivityTabSelector(name: string): string;

  /**
   * Factory for element containing a given class xpath
   *
   * @param className Class name
   * @returns The selector
   */
  xpContainsClass(className: string): string;
}

/**
 * Wrapper class around Playwright Page object.
 */
export class JupyterLabPage implements IJupyterLabPage {
  /**
   * Page object model for JupyterLab
   *
   * @param page Playwright page object
   * @param baseURL Server base URL
   * @param waitForApplication Callback that resolved when the application page is ready
   * @param appPath Application URL path fragment
   */
  constructor(
    readonly page: Page,
    readonly baseURL: string,
    waitForApplication: (page: Page, helpers: IJupyterLabPage) => Promise<void>,
    readonly appPath: string = '/lab'
  ) {
    this.waitIsReady = waitForApplication;
    this.activity = new ActivityHelper(page);
    this.contents = new ContentsHelper(baseURL, page);
    this.filebrowser = new FileBrowserHelper(page, this.contents);
    this.kernel = new KernelHelper(page);
    this.logconsole = new LogConsoleHelper(page);
    this.menu = new MenuHelper(page);
    this.notebook = new NotebookHelper(
      page,
      this.activity,
      this.contents,
      this.filebrowser,
      this.menu
    );
    this.performance = new PerformanceHelper(page);
    this.statusbar = new StatusBarHelper(page, this.menu);
    this.sidebar = new SidebarHelper(page, this.menu);
    this.theme = new ThemeHelper(page);
  }

  /**
   * JupyterLab activity helpers
   */
  readonly activity: ActivityHelper;

  /**
   * JupyterLab contents helpers
   */
  readonly contents: ContentsHelper;

  /**
   * JupyterLab filebrowser helpers
   */
  readonly filebrowser: FileBrowserHelper;

  /**
   * JupyterLab kernel helpers
   */
  readonly kernel: KernelHelper;

  /**
   * JupyterLab log console helpers
   */
  readonly logconsole: LogConsoleHelper;

  /**
   * JupyterLab menu helpers
   */
  readonly menu: MenuHelper;

  /**
   * JupyterLab notebook helpers
   */
  readonly notebook: NotebookHelper;

  /**
   * Webbrowser performance helpers
   */
  readonly performance: PerformanceHelper;

  /**
   * JupyterLab status bar helpers
   */
  readonly statusbar: StatusBarHelper;

  /**
   * JupyterLab sidebar helpers
   */
  readonly sidebar: SidebarHelper;
  /**
   * JupyterLab theme helpers
   */
  readonly theme: ThemeHelper;

  /**
   * Selector for launcher tab
   */
  get launcherSelector(): string {
    return this.activity.launcherSelector;
  }

  /**
   * Getter for JupyterLab base URL
   */
  async getBaseUrl(): Promise<string> {
    return Utils.getBaseUrl(this.page);
  }

  /**
   * Getter for JupyterLab page configuration property
   *
   * @param name Option name
   * @returns The property value
   */
  async getOption(name: string): Promise<string> {
    return Utils.getOption(this.page, name);
  }

  /**
   * Getter for JupyterLab server root folder
   */
  async getServerRoot(): Promise<string | null> {
    return (await Utils.getOption(this.page, 'serverRoot')) ?? null;
  }

  /**
   * Getter for JupyterLab token
   */
  async getToken(): Promise<string> {
    return Utils.getToken(this.page);
  }

  /**
   * Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the
   * last redirect.
   *
   * This overrides the standard Playwright `page.goto` method by waiting for:
   * - the application to be started (plugins are loaded)
   * - the galata in page code to be injected
   * - the splash screen to have disappeared
   * - the launcher to be visible
   *
   * `page.goto` will throw an error if:
   * - there's an SSL error (e.g. in case of self-signed certificates).
   * - target URL is invalid.
   * - the `timeout` is exceeded during navigation.
   * - the remote server does not respond or is unreachable.
   * - the main resource failed to load.
   *
   * `page.goto` will not throw an error when any valid HTTP status code is returned by the remote server, including 404 "Not
   * Found" and 500 "Internal Server Error".  The status code for such responses can be retrieved by calling
   * [response.status()](https://playwright.dev/docs/api/class-response#response-status).
   *
   * > NOTE: `page.goto` either throws an error or returns a main resource response. The only exceptions are navigation to
   * `about:blank` or navigation to the same URL with a different hash, which would succeed and return `null`.
   * > NOTE: Headless mode doesn't support navigation to a PDF document. See the
   * [upstream issue](https://bugs.chromium.org/p/chromium/issues/detail?id=761295).
   *
   * Shortcut for main frame's [frame.goto(url[, options])](https://playwright.dev/docs/api/class-frame#frame-goto)
   * @param url URL to navigate page to. The url should include scheme, e.g. `https://`. When a `baseURL` via the context options was provided and the passed URL is a path, it gets merged via the
   * [`new URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor.
   * @param options
   */
  async goto(
    url?: string,
    options?: {
      /**
       * Referer header value. If provided it will take preference over the referer header value set by
       * [page.setExtraHTTPHeaders(headers)](https://playwright.dev/docs/api/class-page#page-set-extra-http-headers).
       */
      referer?: string;

      /**
       * Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be
       * changed by using the
       * [browserContext.setDefaultNavigationTimeout(timeout)](https://playwright.dev/docs/api/class-browsercontext#browser-context-set-default-navigation-timeout),
       * [browserContext.setDefaultTimeout(timeout)](https://playwright.dev/docs/api/class-browsercontext#browser-context-set-default-timeout),
       * [page.setDefaultNavigationTimeout(timeout)](https://playwright.dev/docs/api/class-page#page-set-default-navigation-timeout)
       * or [page.setDefaultTimeout(timeout)](https://playwright.dev/docs/api/class-page#page-set-default-timeout) methods.
       */
      timeout?: number;

      /**
       * When to consider operation succeeded, defaults to `load`. Events can be either:
       * - `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
       * - `'load'` - consider operation to be finished when the `load` event is fired.
       * - `'networkidle'` - consider operation to be finished when there are no network connections for at least `500` ms.
       */
      waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
    }
  ): Promise<Response | null> {
    const target = url?.startsWith('http')
      ? url
      : `${this.baseURL}${this.appPath}/${url ?? ''}`;

    const response = await this.page.goto(target, {
      ...(options ?? {}),
      waitUntil: options?.waitUntil ?? 'domcontentloaded'
    });
    await this.waitForAppStarted();
    await this.hookHelpersUp();
    await this.waitIsReady(this.page, this);

    return response;
  }

  /**
   * Whether JupyterLab is in simple mode or not
   */
  isInSimpleMode = async (): Promise<boolean> => {
    const toggle = await this.page.$(
      '#jp-single-document-mode button.jp-switch'
    );
    const checked = (await toggle?.getAttribute('aria-checked')) === 'true';

    return checked;
  };

  /**
   * Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the
   * last redirect.
   *
   * This overrides the standard Playwright `page.reload` method by waiting for:
   * - the application to be started (plugins are loaded)
   * - the galata in page code to be injected
   * - the splash screen to have disappeared
   * - the launcher to be visible
   *
   * @param options
   */
  async reload(options?: {
    /**
     * Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be
     * changed by using the
     * [browserContext.setDefaultNavigationTimeout(timeout)](https://playwright.dev/docs/api/class-browsercontext#browser-context-set-default-navigation-timeout),
     * [browserContext.setDefaultTimeout(timeout)](https://playwright.dev/docs/api/class-browsercontext#browser-context-set-default-timeout),
     * [page.setDefaultNavigationTimeout(timeout)](https://playwright.dev/docs/api/class-page#page-set-default-navigation-timeout)
     * or [page.setDefaultTimeout(timeout)](https://playwright.dev/docs/api/class-page#page-set-default-timeout) methods.
     */
    timeout?: number;

    /**
     * When to consider operation succeeded, defaults to `load`. Events can be either:
     * - `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
     * - `'load'` - consider operation to be finished when the `load` event is fired.
     * - `'networkidle'` - consider operation to be finished when there are no network connections for at least `500` ms.
     */
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  }): Promise<Response | null> {
    const response = await this.page.reload({
      ...(options ?? {}),
      waitUntil: options?.waitUntil ?? 'domcontentloaded'
    });
    await this.waitForAppStarted();
    await this.hookHelpersUp();
    await this.waitIsReady(this.page, this);
    return response;
  }

  /**
   * Reset the User Interface
   */
  async resetUI(): Promise<void> {
    // close menus
    await this.menu.closeAll();
    // close all panels
    await this.activity.closeAll();
    // shutdown kernels
    await this.kernel.shutdownAll();
    // show status bar
    await this.statusbar.show();
    // make sure all sidebar tabs are on left
    await this.sidebar.moveAllTabsToLeft();
    // show Files tab on sidebar
    await this.sidebar.openTab('filebrowser');
    // go to home folder
    await this.filebrowser.openHomeDirectory();
  }

  /**
   * Set JupyterLab simple mode
   *
   * @param simple Simple mode value
   * @returns Whether this operation succeeds or not
   */
  async setSimpleMode(simple: boolean): Promise<boolean> {
    const toggle = await this.page.$(
      '#jp-single-document-mode button.jp-switch'
    );
    if (toggle) {
      const checked = (await toggle.getAttribute('aria-checked')) === 'true';

      if ((checked && !simple) || (!checked && simple)) {
        await Promise.all([
          Utils.waitForTransition(this.page, toggle),
          toggle.click()
        ]);
      }

      await Utils.waitForCondition(async () => {
        return (await this.isInSimpleMode()) === simple;
      });

      return true;
    }
    return false;
  }

  /**
   * Wait for a  condition to be fulfilled
   *
   * @param condition Condition to fulfill
   * @param timeout Maximal time to wait for the condition to be true
   */
  async waitForCondition(
    condition: () => Promise<boolean> | boolean,
    timeout?: number
  ): Promise<void> {
    return Utils.waitForCondition(condition, timeout);
  }

  /**
   * Wait for an element to emit 'transitionend' event.
   *
   * @param element Element or selector to watch
   */
  async waitForTransition(
    element: ElementHandle<Element> | string
  ): Promise<void> {
    return Utils.waitForTransition(this.page, element);
  }

  /**
   * Factory for active activity tab xpath
   */
  xpBuildActiveActivityTabSelector(): string {
    return Utils.xpBuildActiveActivityTabSelector();
  }

  /**
   * Factory for activity panel xpath by id
   * @param id Panel id
   */
  xpBuildActivityPanelSelector(id: string): string {
    return Utils.xpBuildActivityPanelSelector(id);
  }

  /**
   * Factory for activity tab xpath by name
   * @param name Activity name
   */
  xpBuildActivityTabSelector(name: string): string {
    return Utils.xpBuildActivityTabSelector(name);
  }

  /**
   * Factory for element containing a given class xpath
   * @param className Class name
   */
  xpContainsClass(className: string): string {
    return Utils.xpContainsClass(className);
  }

  /**
   * Inject the galata in-page helpers
   */
  protected async hookHelpersUp(): Promise<void> {
    // Insert Galata in page helpers
    await this.page.addScriptTag({
      path: path.resolve(__dirname, './lib-inpage/inpage.js')
    });

    const galataipDefined = await this.page.evaluate(() => {
      return Promise.resolve(typeof window.galataip === 'object');
    });

    if (!galataipDefined) {
      throw new Error('Failed to inject galataip object into browser context');
    }

    const jlabAccessible = await this.page.evaluate(() => {
      return Promise.resolve(typeof window.galataip.app === 'object');
    });

    if (!jlabAccessible) {
      throw new Error('Failed to access JupyterLab object in browser context');
    }
  }

  /**
   * Wait for the application to be started
   */
  protected waitForAppStarted = async (): Promise<void> => {
    return this.waitForCondition(() =>
      this.page.evaluate(async () => {
        if (typeof window.jupyterlab === 'object') {
          // Wait for plugins to be loaded
          await window.jupyterlab.started;
          return true;
        } else if (typeof window.jupyterapp === 'object') {
          // Wait for plugins to be loaded
          await window.jupyterapp.started;
          return true;
        }
        return false;
      })
    );
  };

  /**
   * Wait for the splash screen to be hidden and the launcher to be the active tab.
   */
  protected waitIsReady: (
    page: Page,
    helpers: IJupyterLabPage
  ) => Promise<void>;
}
