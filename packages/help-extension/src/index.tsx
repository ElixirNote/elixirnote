// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
/**
 * @packageDocumentation
 * @module help-extension
 */

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { Dialog, ICommandPalette, showDialog } from '@jupyterlab/apputils';
import { PageConfig } from '@jupyterlab/coreutils';
import { ITranslator } from '@jupyterlab/translation';
import { jupyterIcon, jupyterlabWordmarkIcon } from '@jupyterlab/ui-components';
import * as React from 'react';

/**
 * The command IDs used by the help plugin.
 */
namespace CommandIDs {
  export const open = 'help:open';

  export const about = 'help:about';

  export const activate = 'help:activate';

  export const close = 'help:close';

  export const show = 'help:show';

  export const hide = 'help:hide';

  export const launchClassic = 'help:launch-classic-notebook';

  export const jupyterForum = 'help:jupyter-forum';

  export const licenses = 'help:licenses';

  export const licenseReport = 'help:license-report';

  export const refreshLicenses = 'help:licenses-refresh';
}

/**
 * Add a command to show an About dialog.
 */
const about: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/help-extension:about',
  autoStart: true,
  requires: [ITranslator],
  optional: [ICommandPalette],
  activate: (
    app: JupyterFrontEnd,
    translator: ITranslator,
    palette: ICommandPalette | null
  ): void => {
    const { commands } = app;
    const trans = translator.load('jupyterlab');
    const category = trans.__('Help');

    commands.addCommand(CommandIDs.about, {
      label: trans.__('About %1', 'ElixirNote'),
      execute: () => {
        // Create the header of the about dialog
        const versionNumber = trans.__('Version %1', app.version);
        const versionInfo = (
          <span className="jp-About-version-info">
            <span className="jp-About-version">{versionNumber}</span>
          </span>
        );
        const title = (
          <span className="jp-About-header">
            <jupyterIcon.react margin="7px 9.5px" height="auto" width="58px" />
            <div className="jp-About-header-info">
              <jupyterlabWordmarkIcon.react height="auto" width="196px" />
              {versionInfo}
            </div>
          </span>
        );

        // Create the body of the about dialog
        const jupyterURL = 'https://github.com/ElixirNote';
        const contributorsURL = 'https://github.com/ElixirNote';
        const externalLinks = (
          <span className="jp-About-externalLinks">
            <a
              href={contributorsURL}
              target="_blank"
              rel="noopener noreferrer"
              className="jp-Button-flat"
            >
              {trans.__('CONTRIBUTOR LIST')}
            </a>
            <a
              href={jupyterURL}
              target="_blank"
              rel="noopener noreferrer"
              className="jp-Button-flat"
            >
              {trans.__('ABOUT PROJECT ELIXIRNOTE')}
            </a>
          </span>
        );
        const copyright = (
          <span className="jp-About-copyright">
            {trans.__('© 2022 Project ElixirNote Contributors')}
          </span>
        );
        const body = (
          <div className="jp-About-body">
            {externalLinks}
            {copyright}
          </div>
        );

        return showDialog({
          title,
          body,
          buttons: [
            Dialog.createButton({
              label: trans.__('Dismiss'),
              className: 'jp-About-button jp-mod-reject jp-mod-styled'
            })
          ]
        });
      }
    });

    if (palette) {
      palette.addItem({ command: CommandIDs.about, category });
    }
  }
};

/**
 * A plugin to add a command to open the Classic Notebook interface.
 */
const launchClassic: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/help-extension:launch-classic',
  autoStart: true,
  requires: [ITranslator],
  optional: [ICommandPalette],
  activate: (
    app: JupyterFrontEnd,
    translator: ITranslator,
    palette: ICommandPalette | null
  ): void => {
    const { commands } = app;
    const trans = translator.load('jupyterlab');
    const category = trans.__('Help');

    commands.addCommand(CommandIDs.launchClassic, {
      label: trans.__('Launch Classic Notebook'),
      execute: () => {
        window.open(PageConfig.getBaseUrl() + 'tree');
      }
    });

    if (palette) {
      palette.addItem({ command: CommandIDs.launchClassic, category });
    }
  }
};

/**
 * A plugin to add a command to open the Jupyter Forum.
 */
const jupyterForum: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/help-extension:jupyter-forum',
  autoStart: true,
  requires: [ITranslator],
  optional: [ICommandPalette],
  activate: (
    app: JupyterFrontEnd,
    translator: ITranslator,
    palette: ICommandPalette | null
  ): void => {
    const { commands } = app;
    const trans = translator.load('jupyterlab');
    const category = trans.__('Help');

    commands.addCommand(CommandIDs.jupyterForum, {
      label: trans.__('ElixirNote Handbook'),
      execute: () => {
        window.open('https://ciusji.gitbook.io/elixirnote/');
      }
    });

    if (palette) {
      palette.addItem({ command: CommandIDs.jupyterForum, category });
    }
  }
};

const plugins: JupyterFrontEndPlugin<any>[] = [
  about,
  launchClassic,
  jupyterForum
];

export default plugins;
