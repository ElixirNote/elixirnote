// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { JupyterServer } from '@jupyterlab/testutils';
import { ServerConnection, SettingManager } from '../../src';
import { init } from '../utils';

// Initialize the fetch overrides.
init();

const server = new JupyterServer();

beforeAll(async () => {
  await server.start();
});

afterAll(async () => {
  await server.shutdown();
});

describe('setting', () => {
  describe('SettingManager', () => {
    let manager: SettingManager;

    beforeAll(() => {
      manager = new SettingManager({
        serverSettings: ServerConnection.makeSettings({ appUrl: 'lab' })
      });
    });

    describe('#constructor()', () => {
      it('should accept no options', () => {
        const manager = new SettingManager();
        expect(manager).toBeInstanceOf(SettingManager);
      });

      it('should accept options', () => {
        const manager = new SettingManager({
          serverSettings: ServerConnection.makeSettings()
        });
        expect(manager).toBeInstanceOf(SettingManager);
      });
    });

    describe('#serverSettings', () => {
      it('should be the server settings', () => {
        const baseUrl = 'http://localhost/foo';
        const serverSettings = ServerConnection.makeSettings({ baseUrl });
        const manager = new SettingManager({ serverSettings });
        expect(manager.serverSettings.baseUrl).toBe(baseUrl);
      });
    });

    describe('#fetch()', () => {
      it('should fetch settings for an extension', async () => {
        const id = '@jupyterlab/apputils-extension:themes';

        expect((await manager.fetch(id)).id).toBe(id);
      });
    });

    describe('#save()', () => {
      it('should save a setting', async () => {
        const id = '@jupyterlab/apputils-extension:themes';
        const theme = 'Foo Theme';
        const raw = `{"theme": "${theme}"}`;

        await manager.save(id, raw);
        expect(JSON.parse((await manager.fetch(id)).raw).theme).toBe(theme);
      });
    });
  });
});
