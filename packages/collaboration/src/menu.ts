// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { caretDownIcon, userIcon } from '@jupyterlab/ui-components';
import { Menu, MenuBar, Widget } from '@lumino/widgets';
import { h, VirtualElement } from '@lumino/virtualdom';
import { PageConfig, URLExt } from '@jupyterlab/coreutils';
import { nullTranslator } from '@jupyterlab/translation';
import { Clipboard, Dialog, showDialog } from '@jupyterlab/apputils';

import { ICurrentUser } from './tokens';
// import {requestAPI} from "./handler";

/**
 * Custom renderer for the user menu.
 */
export class RendererUserMenu extends MenuBar.Renderer {
  private _user: ICurrentUser;

  /**
   * Constructor of the class RendererUserMenu.
   *
   * @argument user Current user object.
   */
  constructor(user: ICurrentUser) {
    super();
    this._user = user;
  }

  /**
   * Render the virtual element for a menu bar item.
   *
   * @param data - The data to use for rendering the item.
   *
   * @returns A virtual element representing the item.
   */
  renderItem(data: MenuBar.IRenderData): VirtualElement {
    let className = this.createItemClass(data);
    let dataset = this.createItemDataset(data);
    let aria = this.createItemARIA(data);
    return h.li(
      { className, dataset, tabindex: '0', onfocus: data.onfocus, ...aria },
      this._createUserIcon(),
      this.createShareLabel(),
      this.createPreviewLabel()
      // this.renderLabel(data),
      // this.renderIcon(data)
    );
  }

  /**
   * Render the label element for a menu item.
   *
   * @param data - The data to use for rendering the label.
   *
   * @returns A virtual element representing the item label.
   */
  renderLabel(data: MenuBar.IRenderData): VirtualElement {
    let content = this.formatLabel(data);
    return h.div(
      {
        className:
          'lm-MenuBar-itemLabel' +
          /* <DEPRECATED> */
          ' p-MenuBar-itemLabel' +
          /* </DEPRECATED> */
          ' jp-MenuBar-label'
      },
      content
    );
  }

  /**
   * Render the user icon element for a menu item.
   *
   * @returns A virtual element representing the item label.
   */
  private _createUserIcon(): VirtualElement {
    if (this._user.isReady && this._user.avatar_url) {
      return h.div(
        {
          className:
            'lm-MenuBar-itemIcon p-MenuBar-itemIcon jp-MenuBar-imageIcon'
        },
        h.img({ src: this._user.avatar_url })
      );
    } else if (this._user.isReady) {
      return h.div(
        {
          className:
            'lm-MenuBar-itemIcon p-MenuBar-itemIcon jp-MenuBar-anonymousIcon',
          style: { backgroundColor: this._user.color }
        },
        h.span({}, this._user.initials)
      );
    } else {
      return h.div(
        {
          className:
            'lm-MenuBar-itemIcon p-MenuBar-itemIcon jp-MenuBar-anonymousIcon'
        },
        userIcon
      );
    }
  }

  /**
   * Render the share icon element for a menu item.
   *
   * @returns A virtual element representing the item label.
   */
  createShareLabel(): VirtualElement {
    const trans = nullTranslator.load('jupyterlab');
    return h.div(
      {
        className:
          'lm-MenuBar-itemIcon p-MenuBar-itemIcon jp-MenuBar-CommonLabel',
        onclick: async event => {
          let results: { token: string }[];
          const isRunningUnderJupyterhub =
            PageConfig.getOption('hubUser') !== '';
          if (isRunningUnderJupyterhub) {
            // We are running on a JupyterHub, so let's just use the token set in PageConfig.
            // Any extra servers running on the server will still need to use this token anyway,
            // as all traffic (including any to jupyter-server-proxy) needs this token.
            results = [{ token: PageConfig.getToken() }];
          } else {
            // results = await requestAPI<any>('servers');
            results = [{ token: PageConfig.getToken() }];
          }

          const links = results.map(server => {
            // On JupyterLab, let PageConfig.getUrl do its magic.
            // Handles workspaces, single document mode, etc
            return URLExt.normalize(
              `${PageConfig.getUrl({
                workspace: PageConfig.defaultWorkspace
              })}?token=${server.token}`
            );
          });

          const entries = document.createElement('div');
          links.map(link => {
            const p = document.createElement('p');
            const text: HTMLInputElement = document.createElement('input');
            text.readOnly = true;
            text.value = link;
            text.addEventListener('click', e => {
              (e.target as HTMLInputElement).select();
            });
            text.style.width = '100%';
            p.appendChild(text);
            entries.appendChild(p);
          });

          // Warn users of the security implications of using this link
          // FIXME: There *must* be a better way to create HTML
          const warning = document.createElement('div');

          const warningHeader = document.createElement('h3');
          warningHeader.innerText = trans.__('Security warning!');
          warningHeader.className = 'warningHeader';
          warning.appendChild(warningHeader);

          const messages = [
            'Anyone with this link has full access to your notebook server, including all your files!',
            'Please be careful who you share it with.'
          ];
          if (isRunningUnderJupyterhub) {
            messages.push(
              // You can restart the server to revoke the token in a JupyterHub
              'To revoke access, go to File -> Hub Control Panel, and restart your server.'
            );
          } else {
            messages.push(
              // Elsewhere, you *must* shut down your server - no way to revoke it
              'Currently, there is no way to revoke access other than shutting down your server.'
            );
          }
          messages.map(m => {
            warning.appendChild(document.createTextNode(trans.__(m)));
            warning.appendChild(document.createElement('br'));
          });

          entries.appendChild(warning);

          const result = await showDialog({
            title: trans.__('Share Notebook Link'),
            body: new Widget({ node: entries }),
            buttons: [
              Dialog.cancelButton({ label: trans.__('Cancel') }),
              Dialog.okButton({
                label: trans.__('Copy Link'),
                caption: trans.__('Copy the link to the Elixir Server')
              })
            ]
          });

          if (result.button.accept) {
            Clipboard.copyToSystem(links[0]);
          }
        }
      },
      'Share'
    );
  }

  /**
   * Render the preview icon element for a menu item.
   *
   * @returns A virtual element representing the item label.
   */
  createPreviewLabel(): VirtualElement {
    return h.div(
      {
        className:
          'lm-MenuBar-itemIcon p-MenuBar-itemIcon jp-MenuBar-CommonLabel',
        onclick: async event => {
          const input = document.getElementById(
            'jp-title-panel-title-ext'
          ) as HTMLInputElement | null;
          if (input != null) {
            const path = input.value;
            const url = PageConfig.getNBConvertURL({
              path: path,
              format: 'html',
              download: false
            });
            const element = document.createElement('a');
            element.href = url;
            // element.download = '';
            element.target = '_blank';
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
            return void 0;
          }
        }
      },
      'Preview'
    );
  }
}

/**
 * Custom lumino Menu for the user menu.
 */
export class UserMenu extends Menu {
  private _user: ICurrentUser;

  constructor(options: UserMenu.IOptions) {
    super(options);
    this._user = options.user;
    const name =
      this._user.displayName !== '' ? this._user.displayName : this._user.name;
    this.title.label = this._user.isReady ? name : '';
    this.title.icon = caretDownIcon;
    this.title.iconClass = 'jp-UserMenu-caretDownIcon';
    this._user.ready.connect(this._updateLabel);
    this._user.changed.connect(this._updateLabel);
  }

  dispose() {
    this._user.ready.disconnect(this._updateLabel);
    this._user.changed.disconnect(this._updateLabel);
  }

  private _updateLabel = (user: ICurrentUser) => {
    const name = user.displayName !== '' ? user.displayName : user.name;
    this.title.label = name;
    this.update();
  };
}

/**
 * Namespace of the UserMenu class.
 */
export namespace UserMenu {
  /**
   * User menu options interface
   */
  export interface IOptions extends Menu.IOptions {
    /**
     * Current user object.
     */
    user: ICurrentUser;
  }
}
