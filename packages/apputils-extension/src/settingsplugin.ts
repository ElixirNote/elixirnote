/* -----------------------------------------------------------------------------
| Copyright (c) Jupyter Development Team.
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { PageConfig } from '@jupyterlab/coreutils';
import { ISettingRegistry, SettingRegistry } from '@jupyterlab/settingregistry';
import { SettingConnector } from './settingconnector';

/**
 * The default setting registry provider.
 */
export const settingsPlugin: JupyterFrontEndPlugin<ISettingRegistry> = {
  id: '@jupyterlab/apputils-extension:settings',
  activate: async (app: JupyterFrontEnd): Promise<ISettingRegistry> => {
    const { isDisabled } = PageConfig.Extension;
    const connector = new SettingConnector(app.serviceManager.settings);

    // On startup, check if a plugin is available in the application.
    // This helps avoid loading plugin files from other lab-based applications
    // that have placed their schemas next to the JupyterLab schemas. Different lab-based
    // applications might not have the same set of plugins loaded on the page.
    // As an example this helps prevent having new toolbar items added by another application
    // appear in JupyterLab as a side-effect when they are defined via the settings system.
    const registry = new SettingRegistry({
      connector,
      plugins: (await connector.list('active')).values.filter(value =>
        app.hasPlugin(value.id)
      )
    });

    // If there are plugins that have schemas that are not in the setting
    // registry after the application has restored, try to load them manually
    // because otherwise, its settings will never become available in the
    // setting registry.
    void app.restored.then(async () => {
      const plugins = await connector.list('all');
      plugins.ids.forEach(async (id, index) => {
        if (!app.hasPlugin(id) || isDisabled(id) || id in registry.plugins) {
          return;
        }

        try {
          await registry.load(id);
        } catch (error) {
          console.warn(`Settings failed to load for (${id})`, error);
          if (plugins.values[index].schema['jupyter.lab.transform']) {
            console.warn(
              `This may happen if {autoStart: false} in (${id}) ` +
                `or if it is one of the deferredExtensions in page config.`
            );
          }
        }
      });
    });

    return registry;
  },
  autoStart: true,
  provides: ISettingRegistry
};
