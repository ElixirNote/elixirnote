// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ISessionContext,
  translateKernelStatuses,
  VDomModel,
  VDomRenderer
} from '@jupyterlab/apputils';
import { Session } from '@jupyterlab/services';
import {
  ITranslator,
  nullTranslator,
  TranslationBundle
} from '@jupyterlab/translation';
import { JSONArray, JSONExt } from '@lumino/coreutils';
import React from 'react';
import { interactiveItem, TextItem } from '..';

/**
 * A pure functional component for rendering kernel status.
 */
function KernelStatusComponent(
  props: KernelStatusComponent.IProps
): React.ReactElement<KernelStatusComponent.IProps> {
  const translator = props.translator || nullTranslator;
  const trans = translator.load('jupyterlab');
  let statusText = '';
  if (props.status) {
    statusText = ` | ${props.status}`;
  }
  return (
    <TextItem
      onClick={props.handleClick}
      source={`${props.kernelName}${statusText}`}
      title={trans.__('Change kernel for %1', props.activityName)}
    />
  );
}

/**
 * A namespace for KernelStatusComponent statics.
 */
namespace KernelStatusComponent {
  /**
   * Props for the kernel status component.
   */
  export interface IProps {
    /**
     * A click handler for the kernel status component. By default
     * we have it bring up the kernel change dialog.
     */
    handleClick: () => void;

    /**
     * The name the kernel.
     */
    kernelName: string;

    /**
     * The name of the activity using the kernel.
     */
    activityName: string;

    /**
     * The status of the kernel.
     */
    status?: string;

    /**
     * The application language translator.
     */
    translator?: ITranslator;
  }
}

/**
 * A VDomRenderer widget for displaying the status of a kernel.
 */
export class KernelStatus extends VDomRenderer<KernelStatus.Model> {
  /**
   * Construct the kernel status widget.
   */
  constructor(opts: KernelStatus.IOptions, translator?: ITranslator) {
    super(new KernelStatus.Model(translator));
    this.translator = translator || nullTranslator;
    this._handleClick = opts.onClick;
    this.addClass(interactiveItem);
  }

  /**
   * Render the kernel status item.
   */
  render() {
    if (this.model === null) {
      return null;
    } else {
      return (
        <KernelStatusComponent
          status={this.model.status}
          kernelName={this.model.kernelName}
          activityName={this.model.activityName}
          handleClick={this._handleClick}
          translator={this.translator}
        />
      );
    }
  }

  translator: ITranslator;
  private _handleClick: () => void;
}

/**
 * A namespace for KernelStatus statics.
 */
export namespace KernelStatus {
  /**
   * A VDomModel for the kernel status indicator.
   */
  export class Model extends VDomModel {
    constructor(translator?: ITranslator) {
      super();
      translator = translator || nullTranslator;
      this._trans = translator.load('jupyterlab');
      this._kernelName = this._trans.__('No Kernel!');
      this._statusNames = translateKernelStatuses(translator);
    }

    /**
     * The name of the kernel.
     */
    get kernelName() {
      return this._kernelName;
    }

    /**
     * The current status of the kernel.
     */
    get status() {
      return this._kernelStatus
        ? this._statusNames[this._kernelStatus]
        : undefined;
    }

    /**
     * A display name for the activity.
     */
    get activityName(): string {
      return this._activityName;
    }
    set activityName(val: string) {
      const oldVal = this._activityName;
      if (oldVal === val) {
        return;
      }
      this._activityName = val;
      this.stateChanged.emit(void 0);
    }

    /**
     * The current client session associated with the kernel status indicator.
     */
    get sessionContext(): ISessionContext | null {
      return this._sessionContext;
    }
    set sessionContext(sessionContext: ISessionContext | null) {
      this._sessionContext?.statusChanged.disconnect(
        this._onKernelStatusChanged
      );
      this._sessionContext?.kernelChanged.disconnect(this._onKernelChanged);

      const oldState = this._getAllState();
      this._sessionContext = sessionContext;
      this._kernelStatus = sessionContext?.kernelDisplayStatus;
      this._kernelName =
        sessionContext?.kernelDisplayName ?? this._trans.__('No Kernel');
      sessionContext?.statusChanged.connect(this._onKernelStatusChanged, this);
      sessionContext?.connectionStatusChanged.connect(
        this._onKernelStatusChanged,
        this
      );
      sessionContext?.kernelChanged.connect(this._onKernelChanged, this);
      this._triggerChange(oldState, this._getAllState());
    }

    /**
     * React to changes to the kernel status.
     */
    private _onKernelStatusChanged = () => {
      this._kernelStatus = this._sessionContext?.kernelDisplayStatus;
      this.stateChanged.emit(void 0);
    };

    /**
     * React to changes in the kernel.
     */
    private _onKernelChanged = (
      _sessionContext: ISessionContext,
      change: Session.ISessionConnection.IKernelChangedArgs
    ) => {
      const oldState = this._getAllState();

      // sync setting of status and display name
      this._kernelStatus = this._sessionContext?.kernelDisplayStatus;
      this._kernelName = _sessionContext.kernelDisplayName;
      this._triggerChange(oldState, this._getAllState());
    };

    private _getAllState(): Private.State {
      return [this._kernelName, this._kernelStatus, this._activityName];
    }

    private _triggerChange(oldState: Private.State, newState: Private.State) {
      if (JSONExt.deepEqual(oldState as JSONArray, newState as JSONArray)) {
        this.stateChanged.emit(void 0);
      }
    }

    protected translation: ITranslator;
    private _trans: TranslationBundle;
    private _activityName: string = 'activity'; // FIXME-TRANS:?
    private _kernelName: string; // Initialized in constructor due to localization
    private _kernelStatus: ISessionContext.KernelDisplayStatus | undefined = '';
    private _sessionContext: ISessionContext | null = null;
    private readonly _statusNames: Record<
      ISessionContext.KernelDisplayStatus,
      string
    >;
  }

  /**
   * Options for creating a KernelStatus object.
   */
  export interface IOptions {
    /**
     * A click handler for the item. By default
     * we launch a kernel selection dialog.
     */
    onClick: () => void;
  }
}

namespace Private {
  export type State = [string, string | undefined, string];
}
