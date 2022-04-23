// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
/**
 * @packageDocumentation
 * @module launcher
 */

import {
  showErrorMessage,
  VDomModel,
  VDomRenderer
} from '@jupyterlab/apputils';
import {
  ITranslator,
  nullTranslator,
  TranslationBundle
} from '@jupyterlab/translation';
import {
  ArrayExt,
  ArrayIterator,
  each,
  IIterator,
  map,
  toArray
} from '@lumino/algorithm';
import { CommandRegistry } from '@lumino/commands';
import { ReadonlyJSONObject, Token } from '@lumino/coreutils';
import { DisposableDelegate, IDisposable } from '@lumino/disposable';
import { AttachedProperty } from '@lumino/properties';
import { Widget } from '@lumino/widgets';
import * as React from 'react';

/**
 * The class name added to Launcher instances.
 */
const LAUNCHER_CLASS = 'jp-Launcher';

/* tslint:disable */
/**
 * The launcher token.
 */
export const ILauncher = new Token<ILauncher>('@jupyterlab/launcher:ILauncher');
/* tslint:enable */

/**
 * The launcher interface.
 */
export interface ILauncher {
  /**
   * Add a command item to the launcher, and trigger re-render event for parent
   * widget.
   *
   * @param options - The specification options for a launcher item.
   *
   * @returns A disposable that will remove the item from Launcher, and trigger
   * re-render event for parent widget.
   *
   */
  add(options: ILauncher.IItemOptions): IDisposable;
}

/**
 * LauncherModel keeps track of the path to working directory and has a list of
 * LauncherItems, which the Launcher will render.
 */
export class LauncherModel extends VDomModel implements ILauncher {
  /**
   * Add a command item to the launcher, and trigger re-render event for parent
   * widget.
   *
   * @param options - The specification options for a launcher item.
   *
   * @returns A disposable that will remove the item from Launcher, and trigger
   * re-render event for parent widget.
   *
   */
  add(options: ILauncher.IItemOptions): IDisposable {
    // Create a copy of the options to circumvent mutations to the original.
    const item = Private.createItem(options);

    this._items.push(item);
    this.stateChanged.emit(void 0);

    return new DisposableDelegate(() => {
      ArrayExt.removeFirstOf(this._items, item);
      this.stateChanged.emit(void 0);
    });
  }

  /**
   * Return an iterator of launcher items.
   */
  items(): IIterator<ILauncher.IItemOptions> {
    return new ArrayIterator(this._items);
  }

  private _items: ILauncher.IItemOptions[] = [];
}

/**
 * A virtual-DOM-based widget for the Launcher.
 */
export class Launcher extends VDomRenderer<LauncherModel> {
  /**
   * Construct a new launcher widget.
   */
  constructor(options: ILauncher.IOptions) {
    super(options.model);
    this._cwd = options.cwd;
    this.translator = options.translator || nullTranslator;
    this._trans = this.translator.load('jupyterlab');
    this._callback = options.callback;
    this._commands = options.commands;
    this.addClass(LAUNCHER_CLASS);
  }

  /**
   * The cwd of the launcher.
   */
  get cwd(): string {
    return this._cwd;
  }
  set cwd(value: string) {
    this._cwd = value;
    this.update();
  }

  /**
   * Whether there is a pending item being launched.
   */
  get pending(): boolean {
    return this._pending;
  }
  set pending(value: boolean) {
    this._pending = value;
  }

  /**
   * Render the launcher to virtual DOM nodes.
   */
  protected render(): React.ReactElement<any> | null {
    // Bail if there is no model.
    if (!this.model) {
      return null;
    }

    const knownCategories = [
      this._trans.__('Notebook'),
      this._trans.__('Console'),
      this._trans.__('Other')
    ];
    const kernelCategories = [
      this._trans.__('Notebook'),
      this._trans.__('Console')
    ];

    // First group-by categories
    const categories = Object.create(null);
    each(this.model.items(), (item, index) => {
      const cat = item.category || this._trans.__('Other');
      if (!(cat in categories)) {
        categories[cat] = [];
      }
      // FIXME
      categories[cat].push(item);
    });
    // Within each category sort by rank
    for (const cat in categories) {
      categories[cat] = categories[cat].sort(
        (a: ILauncher.IItemOptions, b: ILauncher.IItemOptions) => {
          return Private.sortCmp(a, b, this._cwd, this._commands);
        }
      );
    }

    // Variable to help create sections
    const sections: React.ReactElement<any>[] = [];
    let section: React.ReactElement<any>;

    // Assemble the final ordered list of categories, beginning with
    // KNOWN_CATEGORIES.
    const orderedCategories: string[] = [];
    each(knownCategories, (cat, index) => {
      orderedCategories.push(cat);
    });
    for (const cat in categories) {
      if (knownCategories.indexOf(cat) === -1) {
        orderedCategories.push(cat);
      }
    }

    // Now create the sections for each category
    orderedCategories.forEach(cat => {
      if (!categories[cat]) {
        return;
      }
      const item = categories[cat][0] as ILauncher.IItemOptions;
      const args = { ...item.args, cwd: this.cwd };
      const kernel = kernelCategories.indexOf(cat) > -1;

      // DEPRECATED: remove _icon when lumino 2.0 is adopted
      // if icon is aliasing iconClass, don't use it
      const iconClass = this._commands.iconClass(item.command, args);
      const _icon = this._commands.icon(item.command, args);
      // @ts-ignore
      const icon = _icon === iconClass ? undefined : _icon;

      if (cat in categories) {
        section = (
          <div className="jp-Launcher-section" key={cat}>
            {/*<div className="jp-Launcher-sectionHeader">*/}
              {/*<LabIcon.resolveReact*/}
              {/*  icon={icon}*/}
              {/*  iconClass={classes(iconClass, 'jp-Icon-cover')}*/}
              {/*  stylesheet="launcherSection"*/}
              {/*/>*/}
              {/*<h2 className="jp-Launcher-sectionTitle">{cat}</h2>*/}
            {/*</div>*/}
            <div className="jp-Launcher-cardContainer">
              {toArray(
                map(categories[cat], (item: ILauncher.IItemOptions) => {
                  return Card(
                    kernel,
                    item,
                    this,
                    this._commands,
                    this._trans,
                    this._callback
                  );
                })
              )}
            </div>
          </div>
        );
        if (cat === "Notebook") {
          sections.push(section);
        }
      }
    });

    // Wrap the sections in body and content divs.
    return (
      <div className="jp-Launcher-body">
        <svg className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"
             p-id="2541" width="200" height="200">
          <path
              d="M855.930143 390.219399 520.426927 220.999346 623.978351 94.302783c5.387707-6.592139 14.685467-8.455579 22.197558-4.447289L945.015088 249.306043c9.958816 5.313006 12.535501 18.426675 5.328355 27.113521L855.930143 390.219399 855.930143 390.219399zM415.439804 94.525863l99.281167 126.4786L182.193529 390.219399 82.559321 273.774317c-7.486508-8.750291-4.838192-22.196535 5.408173-27.453259L393.277038 89.671299C400.874063 85.773526 410.16773 87.808882 415.439804 94.525863zM509.37215 549.57478l-56.830333 160.529113c-1.352811 3.820002-5.750981 5.585205-9.368368 3.76065L131.658575 554.153052c-5.16565-2.605338-7.543813-8.68173-5.517667-14.101159l55.812143-149.306514L509.37215 549.57478 509.37215 549.57478zM506.779092 612.285031 506.779092 906.759809c0 3.888564-4.033873 6.465249-7.562233 4.830005L171.387415 757.291612c-6.221702-2.882654-10.183943-9.135054-10.136871-15.992229l0.967024-140.454916c0.029676-4.295839 4.563946-7.062859 8.398274-5.124717l279.498692 144.370085c5.1503 2.603291 11.423167 0.183172 13.489222-5.204535L506.779092 612.285031zM581.904093 711.284789 527.029298 549.57478l328.900845-158.829402 62.5895 147.423631c2.359744 5.557576-0.047072 11.989055-5.475711 14.633279L587.747171 713.722304C585.462129 714.834638 582.720691 713.690582 581.904093 711.284789zM873.742834 742.890624c0 5.89629-3.419889 11.257391-8.766664 13.743002L536.828478 911.576511c-3.52836 1.64036-7.567349-0.935302-7.567349-4.826935L529.261129 612.285031l40.581254 124.105552c1.482771 4.180206 6.28617 6.123464 10.258645 4.15053l282.95849-142.617162c4.91494-2.441609 10.683317 1.133823 10.683317 6.621814L873.742834 742.890624z"
              p-id="2542" fill="#dbdbdb"></path>
        </svg>
        <p className="tip">We are sorry, this format can not support, please select you kernel.</p>
        <div>
          {sections}
        </div>
      </div>
    );
  }

  protected translator: ITranslator;
  private _trans: TranslationBundle;
  private _commands: CommandRegistry;
  private _callback: (widget: Widget) => void;
  private _pending = false;
  private _cwd = '';
}

/**
 * The namespace for `ILauncher` class statics.
 */
export namespace ILauncher {
  /**
   * The options used to create a Launcher.
   */
  export interface IOptions {
    /**
     * The model of the launcher.
     */
    model: LauncherModel;

    /**
     * The cwd of the launcher.
     */
    cwd: string;

    /**
     * The command registry used by the launcher.
     */
    commands: CommandRegistry;

    /**
     * The application language translation.
     */
    translator?: ITranslator;

    /**
     * The callback used when an item is launched.
     */
    callback: (widget: Widget) => void;
  }

  /**
   * The options used to create a launcher item.
   */
  export interface IItemOptions {
    /**
     * The command ID for the launcher item.
     *
     * #### Notes
     * If the command's `execute` method returns a `Widget` or
     * a promise that resolves with a `Widget`, then that widget will
     * replace the launcher in the same location of the application
     * shell. If the `execute` method does something else
     * (i.e., create a modal dialog), then the launcher will not be
     * disposed.
     */
    command: string;

    /**
     * The arguments given to the command for
     * creating the launcher item.
     *
     * ### Notes
     * The launcher will also add the current working
     * directory of the filebrowser in the `cwd` field
     * of the args, which a command may use to create
     * the activity with respect to the right directory.
     */
    args?: ReadonlyJSONObject;

    /**
     * The category for the launcher item.
     *
     * The default value is an empty string.
     */
    category?: string;

    /**
     * The rank for the launcher item.
     *
     * The rank is used when ordering launcher items for display. After grouping
     * into categories, items are sorted in the following order:
     *   1. Rank (lower is better)
     *   3. Display Name (locale order)
     *
     * The default rank is `Infinity`.
     */
    rank?: number;

    /**
     * For items that have a kernel associated with them, the URL of the kernel
     * icon.
     *
     * This is not a CSS class, but the URL that points to the icon in the kernel
     * spec.
     */
    kernelIconUrl?: string;

    /**
     * Metadata about the item.  This can be used by the launcher to
     * affect how the item is displayed.
     */
    metadata?: ReadonlyJSONObject;
  }
}

/**
 * A pure tsx component for a launcher card.
 *
 * @param kernel - whether the item takes uses a kernel.
 *
 * @param item - the launcher item to render.
 *
 * @param launcher - the Launcher instance to which this is added.
 *
 * @param launcherCallback - a callback to call after an item has been launched.
 *
 * @returns a vdom `VirtualElement` for the launcher card.
 */
function Card(
  kernel: boolean,
  item: ILauncher.IItemOptions,
  launcher: Launcher,
  commands: CommandRegistry,
  trans: TranslationBundle,
  launcherCallback: (widget: Widget) => void
): React.ReactElement<any> {
  // Get some properties of the command
  const command = item.command;
  const args = { ...item.args, cwd: launcher.cwd };
  const caption = commands.caption(command, args);
  const label = commands.label(command, args);
  const title = kernel ? label : caption || label;

  // Build the onclick handler.
  const onclick = () => {
    // If an item has already been launched,
    // don't try to launch another.
    if (launcher.pending === true) {
      return;
    }
    launcher.pending = true;
    void commands
      .execute(command, {
        ...item.args,
        cwd: launcher.cwd
      })
      .then(value => {
        launcher.pending = false;
        if (value instanceof Widget) {
          launcherCallback(value);
          launcher.dispose();
        }
      })
      .catch(err => {
        launcher.pending = false;
        void showErrorMessage(trans._p('Error', 'Launcher Error'), err);
      });
  };

  // With tabindex working, you can now pick a kernel by tabbing around and
  // pressing Enter.
  const onkeypress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      onclick();
    }
  };

  // DEPRECATED: remove _icon when lumino 2.0 is adopted
  // if icon is aliasing iconClass, don't use it
  const iconClass = commands.iconClass(command, args);
  const _icon = commands.icon(command, args);
  // @ts-ignore
  const icon = _icon === iconClass ? undefined : _icon;

  // Return the VDOM element.
  return (
    <div
      className="jp-LauncherCard"
      title={title}
      onClick={onclick}
      onKeyPress={onkeypress}
      tabIndex={0}
      data-category={item.category || trans.__('Other')}
      key={Private.keyProperty.get(item)}
    >
      {/*<div className="jp-LauncherCard-icon">*/}
      {/*  {kernel ? (*/}
      {/*    item.kernelIconUrl ? (*/}
      {/*      <img src={item.kernelIconUrl} className="jp-Launcher-kernelIcon" alt={"kernelIcon"} />*/}
      {/*    ) : (*/}
      {/*      <div className="jp-LauncherCard-noKernelIcon">*/}
      {/*        {label[0].toUpperCase()}*/}
      {/*      </div>*/}
      {/*    )*/}
      {/*  ) : (*/}
      {/*    <LabIcon.resolveReact*/}
      {/*      icon={icon}*/}
      {/*      iconClass={classes(iconClass, 'jp-Icon-cover')}*/}
      {/*      stylesheet="launcherCard"*/}
      {/*    />*/}
      {/*  )}*/}
      {/*</div>*/}
      <div className="jp-LauncherCard-label" title={title}>
        <p>{label}</p>
      </div>
    </div>
  );
}

/**
 * The namespace for module private data.
 */
namespace Private {
  /**
   * An incrementing counter for keys.
   */
  let id = 0;

  /**
   * An attached property for an item's key.
   */
  export const keyProperty = new AttachedProperty<
    ILauncher.IItemOptions,
    number
  >({
    name: 'key',
    create: () => id++
  });

  /**
   * Create a fully specified item given item options.
   */
  export function createItem(
    options: ILauncher.IItemOptions
  ): ILauncher.IItemOptions {
    return {
      ...options,
      category: options.category || '',
      rank: options.rank !== undefined ? options.rank : Infinity
    };
  }

  /**
   * A sort comparison function for a launcher item.
   */
  export function sortCmp(
    a: ILauncher.IItemOptions,
    b: ILauncher.IItemOptions,
    cwd: string,
    commands: CommandRegistry
  ): number {
    // First, compare by rank.
    const r1 = a.rank;
    const r2 = b.rank;
    if (r1 !== r2 && r1 !== undefined && r2 !== undefined) {
      return r1 < r2 ? -1 : 1; // Infinity safe
    }

    // Finally, compare by display name.
    const aLabel = commands.label(a.command, { ...a.args, cwd });
    const bLabel = commands.label(b.command, { ...b.args, cwd });
    return aLabel.localeCompare(bLabel);
  }
}
