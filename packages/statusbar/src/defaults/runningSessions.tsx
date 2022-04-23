// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { VDomModel, VDomRenderer } from '@jupyterlab/apputils';
import {
  ServiceManager,
  Session,
  SessionManager,
  Terminal,
  TerminalManager
} from '@jupyterlab/services';
import {
  ITranslator,
  nullTranslator,
  TranslationBundle
} from '@jupyterlab/translation';
import { kernelIcon, terminalIcon } from '@jupyterlab/ui-components';
import React from 'react';
import { GroupItem, interactiveItem, TextItem } from '..';

/**
 * Half spacing between subitems in a status item.
 */
const HALF_SPACING = 4;

/**
 * A pure functional component for rendering kernel and terminal sessions.
 *
 * @param props: the props for the component.
 *
 * @returns a tsx component for the running sessions.
 */
function RunningSessionsComponent(
  props: RunningSessionsComponent.IProps
): React.ReactElement<RunningSessionsComponent.IProps> {
  return (
    <GroupItem spacing={HALF_SPACING} onClick={props.handleClick}>
      <GroupItem spacing={HALF_SPACING}>
        <TextItem source={props.terminals} />
        <terminalIcon.react left={'1px'} top={'3px'} stylesheet={'statusBar'} />
      </GroupItem>
      <GroupItem spacing={HALF_SPACING}>
        <TextItem source={props.sessions} />
        <kernelIcon.react top={'2px'} stylesheet={'statusBar'} />
      </GroupItem>
    </GroupItem>
  );
}

/**
 * A namespace for RunningSessionsComponents statics.
 */
namespace RunningSessionsComponent {
  /**
   * The props for rendering the RunningSessionsComponent.
   */
  export interface IProps {
    /**
     * A click handler for the component. By default this is used
     * to activate the running sessions side panel.
     */
    handleClick: () => void;

    /**
     * The number of running kernel sessions.
     */
    sessions: number;

    /**
     * The number of active terminal sessions.
     */
    terminals: number;
  }
}

/**
 * A VDomRenderer for a RunningSessions status item.
 */
export class RunningSessions extends VDomRenderer<RunningSessions.Model> {
  /**
   * Create a new RunningSessions widget.
   */
  constructor(opts: RunningSessions.IOptions) {
    super(new RunningSessions.Model());
    this._serviceManager = opts.serviceManager;
    this._handleClick = opts.onClick;
    this.translator = opts.translator || nullTranslator;
    this._trans = this.translator.load('jupyterload');

    this._serviceManager.sessions.runningChanged.connect(
      this._onSessionsRunningChanged,
      this
    );
    this._serviceManager.terminals.runningChanged.connect(
      this._onTerminalsRunningChanged,
      this
    );

    this.addClass(interactiveItem);
  }

  /**
   * Render the running sessions widget.
   */
  render() {
    if (!this.model) {
      return null;
    }
    // TODO-TRANS: Should probably be handled differently.
    // This is more localizable friendly: "Terminals: %1 | Kernels: %2"
    this.title.caption = this._trans.__(
      '%1 Terminals, %2 Kernel sessions',
      this.model.terminals,
      this.model!.sessions
    );
    return (
      <RunningSessionsComponent
        sessions={this.model.sessions}
        terminals={this.model.terminals}
        handleClick={this._handleClick}
      />
    );
  }

  /**
   * Dispose of the status item.
   */
  dispose() {
    super.dispose();

    this._serviceManager.sessions.runningChanged.disconnect(
      this._onSessionsRunningChanged,
      this
    );
    this._serviceManager.terminals.runningChanged.disconnect(
      this._onTerminalsRunningChanged,
      this
    );
  }

  /**
   * Set the number of kernel sessions when the list changes.
   */
  private _onSessionsRunningChanged(
    manager: SessionManager,
    sessions: Session.IModel[]
  ): void {
    this.model!.sessions = sessions.length;
  }

  /**
   * Set the number of terminal sessions when the list changes.
   */
  private _onTerminalsRunningChanged(
    manager: TerminalManager,
    terminals: Terminal.IModel[]
  ): void {
    this.model!.terminals = terminals.length;
  }

  protected translator: ITranslator;
  private _trans: TranslationBundle;
  private _handleClick: () => void;
  private _serviceManager: ServiceManager;
}

/**
 * A namespace for RunningSessions statics.
 */
export namespace RunningSessions {
  /**
   * A VDomModel for the RunningSessions status item.
   */
  export class Model extends VDomModel {
    /**
     * The number of active kernel sessions.
     */
    get sessions(): number {
      return this._sessions;
    }
    set sessions(sessions: number) {
      const oldSessions = this._sessions;
      this._sessions = sessions;

      if (oldSessions !== this._sessions) {
        this.stateChanged.emit(void 0);
      }
    }

    /**
     * The number of active terminal sessions.
     */
    get terminals(): number {
      return this._terminals;
    }
    set terminals(terminals: number) {
      const oldTerminals = this._terminals;
      this._terminals = terminals;

      if (oldTerminals !== this._terminals) {
        this.stateChanged.emit(void 0);
      }
    }

    private _terminals: number = 0;
    private _sessions: number = 0;
  }

  /**
   * Options for creating a RunningSessions item.
   */
  export interface IOptions {
    /**
     * The application service manager.
     */
    serviceManager: ServiceManager;

    /**
     * A click handler for the item. By default this is used
     * to activate the running sessions side panel.
     */
    onClick: () => void;

    /**
     * The application language translator.
     */
    translator?: ITranslator;
  }
}
