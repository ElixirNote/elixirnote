// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
import { test } from '@jupyterlab/galata';
import { expect } from '@playwright/test';

const DEFAULT_NAME = 'untitled.txt';

const TEST_FILE_CONTENT = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam urna
libero, dictum a egestas non, placerat vel neque. In imperdiet iaculis fermentum.
Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia
Curae; Cras augue tortor, tristique vitae varius nec, dictum eu lectus. Pellentesque
id eleifend eros. In non odio in lorem iaculis sollicitudin. In faucibus ante ut
arcu fringilla interdum. Maecenas elit nulla, imperdiet nec blandit et, consequat
ut elit.`;

test('Search with a text', async ({ page }) => {
  const searchText = 'ipsum';
  await page.menu.clickMenuItem('File>New>Text File');

  await page.waitForSelector(`[role="main"] >> text=${DEFAULT_NAME}`);

  await page.type('.cm-content', TEST_FILE_CONTENT);

  await page.evaluate(async searchText => {
    await window.jupyterapp.commands.execute('documentsearch:start', {
      searchText
    });
  }, searchText);

  expect(
    await page.locator('input.jp-DocumentSearch-input').inputValue()
  ).toEqual(searchText);
});

test('Search with a text and replacement', async ({ page }) => {
  const searchText = 'ipsum';
  const replaceText = 'banana';
  await page.menu.clickMenuItem('File>New>Text File');

  await page.waitForSelector(`[role="main"] >> text=${DEFAULT_NAME}`);

  await page.type('.cm-content', TEST_FILE_CONTENT);

  await page.evaluate(
    async ([searchText, replaceText]) => {
      await window.jupyterapp.commands.execute(
        'documentsearch:startWithReplace',
        {
          searchText,
          replaceText
        }
      );
    },
    [searchText, replaceText]
  );

  expect(
    await page.locator('input.jp-DocumentSearch-input').inputValue()
  ).toEqual(searchText);
  expect(
    await page.locator('input.jp-DocumentSearch-replace-entry').inputValue()
  ).toEqual(replaceText);
});
