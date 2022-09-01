// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { IDisposable } from '@lumino/disposable';

import { Poll } from '@lumino/polling';

import { ISignal, Signal } from '@lumino/signaling';

import { Builder, BuildManager } from './builder';

import { NbConvert, NbConvertManager } from './nbconvert';

import { Contents, ContentsManager } from './contents';

import { Kernel, KernelManager } from './kernel';

import { KernelSpec, KernelSpecManager } from './kernelspec';

import { ServerConnection } from './serverconnection';

import { Session, SessionManager } from './session';

import { Setting, SettingManager } from './setting';

import { Terminal, TerminalManager } from './terminal';

import { Workspace, WorkspaceManager } from './workspace';

/**
 * A Jupyter services manager.
 */
export class ServiceManager implements ServiceManager.IManager {
  /**
   * Construct a new services provider.
   */
  constructor(options: Partial<ServiceManager.IOptions> = {}) {
    const defaultDrive = options.defaultDrive;
    const serverSettings =
      options.serverSettings ?? ServerConnection.makeSettings();
    const standby = options.standby ?? 'when-hidden';
    const normalized = { defaultDrive, serverSettings, standby };

    const kernelManager = options.kernels || new KernelManager(normalized);
    this.serverSettings = serverSettings;
    this.contents = options.contents || new ContentsManager(normalized);
    this.sessions =
      options.sessions ||
      new SessionManager({
        ...normalized,
        kernelManager: kernelManager
      });
    this.settings = options.settings || new SettingManager(normalized);
    this.terminals = options.terminals || new TerminalManager(normalized);
    this.builder = options.builder || new BuildManager(normalized);
    this.workspaces = options.workspaces || new WorkspaceManager(normalized);
    this.nbconvert = options.nbconvert || new NbConvertManager(normalized);
    this.kernelspecs = options.kernelspecs || new KernelSpecManager(normalized);

    // Relay connection failures from the service managers that poll
    // the server for current information.
    this.kernelspecs.connectionFailure.connect(this._onConnectionFailure, this);
    this.sessions.connectionFailure.connect(this._onConnectionFailure, this);
    this.terminals.connectionFailure.connect(this._onConnectionFailure, this);

    const readyList = [this.sessions.ready, this.kernelspecs.ready];
    if (this.terminals.isAvailable()) {
      readyList.push(this.terminals.ready);
    }
    this._readyPromise = Promise.all(readyList).then(() => {
      this._isReady = true;
    });
  }

  /**
   * A signal emitted when there is a connection failure with the kernel.
   */
  get connectionFailure(): ISignal<this, Error> {
    return this._connectionFailure;
  }

  /**
   * Test whether the service manager is disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Dispose of the resources used by the manager.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this._isDisposed = true;
    Signal.clearData(this);

    this.contents.dispose();
    this.sessions.dispose();
    this.terminals.dispose();
  }

  /**
   * The server settings of the manager.
   */
  readonly serverSettings: ServerConnection.ISettings;

  /**
   * Get the session manager instance.
   */
  readonly sessions: Session.IManager;

  /**
   * Get the session manager instance.
   */
  readonly kernelspecs: KernelSpec.IManager;

  /**
   * Get the setting manager instance.
   */
  readonly settings: Setting.IManager;

  /**
   * The builder for the manager.
   */
  readonly builder: Builder.IManager;

  /**
   * Get the contents manager instance.
   */
  readonly contents: Contents.IManager;

  /**
   * Get the terminal manager instance.
   */
  readonly terminals: Terminal.IManager;

  /**
   * Get the workspace manager instance.
   */
  readonly workspaces: Workspace.IManager;

  /**
   * Get the nbconvert manager instance.
   */
  readonly nbconvert: NbConvert.IManager;

  /**
   * Test whether the manager is ready.
   */
  get isReady(): boolean {
    return this._isReady;
  }

  /**
   * A promise that fulfills when the manager is ready.
   */
  get ready(): Promise<void> {
    return this._readyPromise;
  }

  private _onConnectionFailure(sender: any, err: Error): void {
    this._connectionFailure.emit(err);
  }

  private _isDisposed = false;
  private _readyPromise: Promise<void>;
  private _connectionFailure = new Signal<this, Error>(this);
  private _isReady = false;
}

/**
 * The namespace for `ServiceManager` statics.
 */
export namespace ServiceManager {
  /**
   * A service manager interface.
   */
  export interface IManager extends IDisposable, IManagers {
    /**
     * Test whether the manager is ready.
     */
    readonly isReady: boolean;

    /**
     * A promise that fulfills when the manager is initially ready.
     */
    readonly ready: Promise<void>;

    /**
     * A signal emitted when there is a connection failure with the server.
     */
    readonly connectionFailure: ISignal<IManager, Error>;
  }

  /**
   * The options used to create a service manager.
   */
  export interface IOptions extends IManagers {
    /**
     * Kernel manager of the manager.
     */
    readonly kernels: Kernel.IManager;

    /**
     * The default drive for the contents manager.
     */
    readonly defaultDrive: Contents.IDrive;

    /**
     * When the manager stops polling the API. Defaults to `when-hidden`.
     */
    standby: Poll.Standby | (() => boolean | Poll.Standby);
  }

  /**
   * The managers provided by the service manager.
   */
  interface IManagers {
    /**
     * The builder for the manager.
     */
    readonly builder: Builder.IManager;

    /**
     * The contents manager for the manager.
     */
    readonly contents: Contents.IManager;

    /**
     * A promise that fulfills when the manager is initially ready.
     */
    readonly ready: Promise<void>;

    /**
     * The server settings of the manager.
     */
    readonly serverSettings: ServerConnection.ISettings;

    /**
     * The session manager for the manager.
     */
    readonly sessions: Session.IManager;

    /**
     * The session manager for the manager.
     */
    readonly kernelspecs: KernelSpec.IManager;

    /**
     * The setting manager for the manager.
     */
    readonly settings: Setting.IManager;

    /**
     * The terminals manager for the manager.
     */
    readonly terminals: Terminal.IManager;

    /**
     * The workspace manager for the manager.
     */
    readonly workspaces: Workspace.IManager;

    /**
     * The nbconvert manager for the manager.
     */
    readonly nbconvert: NbConvert.IManager;
  }
}
