// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { LabShell } from '@jupyterlab/application';
import { framePromise } from '@jupyterlab/testutils';
import { toArray } from '@lumino/algorithm';
import { Message } from '@lumino/messaging';
import { DockPanel, Widget } from '@lumino/widgets';
import { simulate } from 'simulate-event';

class ContentWidget extends Widget {
  activated = false;

  onActivateRequest(msg: Message): void {
    this.activated = true;
  }
}

describe('LabShell', () => {
  let shell: LabShell;

  beforeAll(() => {
    console.debug(
      'Expecting 6 console errors logged in this suite: "Widgets added to app shell must have unique id property."'
    );
  });

  beforeEach(() => {
    shell = new LabShell();
    Widget.attach(shell, document.body);
  });

  afterEach(() => {
    shell.dispose();
  });

  describe('#constructor()', () => {
    it('should create a LabShell instance', () => {
      expect(shell).toBeInstanceOf(LabShell);
    });
  });

  describe('#leftCollapsed', () => {
    it('should return whether the left area is collapsed', () => {
      const widget = new Widget();
      widget.id = 'foo';
      shell.add(widget, 'left');
      expect(shell.leftCollapsed).toBe(true);
      shell.activateById('foo');
      expect(shell.leftCollapsed).toBe(false);
    });
  });

  describe('#rightCollapsed', () => {
    it('should return whether the right area is collapsed', () => {
      const widget = new Widget();
      widget.id = 'foo';
      shell.add(widget, 'right');
      expect(shell.rightCollapsed).toBe(true);
      shell.activateById('foo');
      expect(shell.rightCollapsed).toBe(false);
    });
  });

  describe('#currentWidget', () => {
    it('should be the current widget in the shell main area', () => {
      expect(shell.currentWidget).toBe(null);
      const widget = new Widget();
      widget.id = 'foo';
      shell.add(widget, 'main');
      expect(shell.currentWidget).toBe(null);
      simulate(widget.node, 'focus');
      expect(shell.currentWidget).toBe(widget);
      widget.parent = null;
      expect(shell.currentWidget).toBe(null);
    });
  });

  describe('#isEmpty()', () => {
    it('should test whether the main area is empty', () => {
      expect(shell.isEmpty('main')).toBe(true);
      const widget = new Widget();
      widget.id = 'foo';
      shell.add(widget, 'main');
      expect(shell.isEmpty('main')).toBe(false);
    });

    it('should test whether the top area is empty', () => {
      // top-level menu area is added by default
      expect(shell.isEmpty('top')).toBe(false);
    });

    it('should test whether the menu area is empty', () => {
      expect(shell.isEmpty('menu')).toBe(true);
      const widget = new Widget();
      widget.id = 'foo';
      shell.add(widget, 'menu');
      expect(shell.isEmpty('menu')).toBe(false);
    });

    it('should test whether the left area is empty', () => {
      expect(shell.isEmpty('left')).toBe(true);
      const widget = new Widget();
      widget.id = 'foo';
      shell.add(widget, 'left');
      expect(shell.isEmpty('left')).toBe(false);
    });

    it('should test whether the right area is empty', () => {
      expect(shell.isEmpty('right')).toBe(true);
      const widget = new Widget();
      widget.id = 'foo';
      shell.add(widget, 'right');
      expect(shell.isEmpty('right')).toBe(false);
    });
  });

  describe('#restored', () => {
    it('should resolve when the app is restored for the first time', () => {
      const state = shell.saveLayout();
      const mode: DockPanel.Mode = 'multiple-document';
      shell.restoreLayout(mode, state);
      return shell.restored;
    });
  });

  describe('#add(widget, "header")', () => {
    it('should add a widget to the header', () => {
      const widget = new Widget();
      widget.id = 'foo';
      shell.add(widget, 'header');
      expect(shell.isEmpty('header')).toBe(false);
    });

    it('should be a no-op if the widget has no id', () => {
      const widget = new Widget();
      shell.add(widget, 'header');
      expect(shell.isEmpty('header')).toBe(true);
    });

    it('should accept options', () => {
      const widget = new Widget();
      widget.id = 'foo';
      shell.add(widget, 'header', { rank: 10 });
      expect(shell.isEmpty('header')).toBe(false);
    });
  });

  describe('#add(widget, "menu")', () => {
    it('should add a widget to the menu', () => {
      const widget = new Widget();
      widget.id = 'foo';
      shell.add(widget, 'menu');
      expect(shell.isEmpty('menu')).toBe(false);
    });

    it('should be a no-op if the widget has no id', () => {
      const widget = new Widget();
      shell.add(widget, 'menu');
      expect(shell.isEmpty('menu')).toBe(true);
    });

    it('should accept options', () => {
      const widget = new Widget();
      widget.id = 'foo';
      shell.add(widget, 'menu', { rank: 10 });
      expect(shell.isEmpty('menu')).toBe(false);
    });
  });

  describe('#add(widget, "top")', () => {
    it('should add a widget to the top area', () => {
      const widget = new Widget();
      widget.id = 'foo';
      shell.add(widget, 'top');
      // top-level title and menu area are added by default
      expect(toArray(shell.widgets('top')).length).toEqual(4);
    });

    it('should be a no-op if the widget has no id', () => {
      const widget = new Widget();
      shell.add(widget, 'top');
      // top-level title and menu area are added by default
      expect(toArray(shell.widgets('top')).length).toEqual(3);
    });

    it('should accept options', () => {
      const widget = new Widget();
      widget.id = 'foo';
      shell.add(widget, 'top', { rank: 10 });
      // top-level title and menu area are added by default
      expect(toArray(shell.widgets('top')).length).toEqual(4);
    });

    it('should add widgets according to their ranks', () => {
      const foo = new Widget();
      const bar = new Widget();
      foo.id = 'foo';
      bar.id = 'bar';
      shell.add(foo, 'top', { rank: 10001 });
      shell.add(bar, 'top', { rank: 10000 });
      expect(
        toArray(shell.widgets('top'))
          .slice(-2)
          .map(v => v.id)
      ).toEqual(['bar', 'foo']);
    });
  });

  describe('#add(widget, "left")', () => {
    it('should add a widget to the left area', () => {
      const widget = new Widget();
      widget.id = 'foo';
      shell.add(widget, 'left');
      expect(shell.isEmpty('left')).toBe(false);
    });

    it('should be a no-op if the widget has no id', () => {
      const widget = new Widget();
      shell.add(widget, 'left');
      expect(shell.isEmpty('left')).toBe(true);
    });

    it('should accept options', () => {
      const widget = new Widget();
      widget.id = 'foo';
      shell.add(widget, 'left', { rank: 10 });
      expect(shell.isEmpty('left')).toBe(false);
    });
  });

  describe('#add(widget, "right")', () => {
    it('should add a widget to the right area', () => {
      const widget = new Widget();
      widget.id = 'foo';
      shell.add(widget, 'right');
      expect(shell.isEmpty('right')).toBe(false);
    });

    it('should be a no-op if the widget has no id', () => {
      const widget = new Widget();
      shell.add(widget, 'right');
      expect(shell.isEmpty('right')).toBe(true);
    });

    it('should accept options', () => {
      const widget = new Widget();
      widget.id = 'foo';
      shell.add(widget, 'right', { rank: 10 });
      expect(shell.isEmpty('right')).toBe(false);
    });
  });

  describe('#add(widget, "main")', () => {
    it('should add a widget to the main area', () => {
      const widget = new Widget();
      widget.id = 'foo';
      shell.add(widget, 'main');
      expect(shell.isEmpty('main')).toBe(false);
    });

    it('should be a no-op if the widget has no id', () => {
      const widget = new Widget();
      shell.add(widget, 'main');
      expect(shell.isEmpty('main')).toBe(true);
    });
  });

  describe('#activateById()', () => {
    it('should activate a widget in the left area', () => {
      const widget = new Widget();
      widget.id = 'foo';
      shell.add(widget, 'left');
      expect(widget.isVisible).toBe(false);
      shell.activateById('foo');
      expect(widget.isVisible).toBe(true);
    });

    it('should be a no-op if the widget is not in the left area', () => {
      const widget = new Widget();
      widget.id = 'foo';
      expect(widget.isVisible).toBe(false);
      shell.activateById('foo');
      expect(widget.isVisible).toBe(false);
    });

    it('should activate a widget in the right area', () => {
      const widget = new Widget();
      widget.id = 'foo';
      shell.add(widget, 'right');
      expect(widget.isVisible).toBe(false);
      shell.activateById('foo');
      expect(widget.isVisible).toBe(true);
    });

    it('should be a no-op if the widget is not in the right area', () => {
      const widget = new Widget();
      widget.id = 'foo';
      expect(widget.isVisible).toBe(false);
      shell.activateById('foo');
      expect(widget.isVisible).toBe(false);
    });

    it('should activate a widget in the main area', async () => {
      const widget = new ContentWidget();
      widget.id = 'foo';
      shell.add(widget, 'main');
      shell.activateById('foo');
      await framePromise();
      expect(widget.activated).toBe(true);
    });

    it('should be a no-op if the widget is not in the main area', async () => {
      const widget = new ContentWidget();
      widget.id = 'foo';
      shell.activateById('foo');
      await framePromise();
      expect(widget.activated).toBe(false);
    });
  });

  describe('#collapseLeft()', () => {
    it('should collapse all widgets in the left area', () => {
      const widget = new Widget();
      widget.id = 'foo';
      shell.add(widget, 'left');
      shell.activateById('foo');
      expect(widget.isVisible).toBe(true);
      shell.collapseLeft();
      expect(widget.isVisible).toBe(false);
    });
  });

  describe('#collapseRight()', () => {
    it('should collapse all widgets in the right area', () => {
      const widget = new Widget();
      widget.id = 'foo';
      shell.add(widget, 'right');
      shell.activateById('foo');
      expect(widget.isVisible).toBe(true);
      shell.collapseRight();
      expect(widget.isVisible).toBe(false);
    });
  });

  describe('#expandLeft()', () => {
    it('should expand the most recently used widget', () => {
      const widget = new Widget();
      widget.id = 'foo';
      const widget2 = new Widget();
      widget2.id = 'bar';
      shell.add(widget, 'left', { rank: 10 });
      shell.add(widget2, 'left', { rank: 1 });
      shell.activateById('foo');
      shell.collapseLeft();
      expect(widget.isVisible).toBe(false);
      shell.expandLeft();
      expect(widget.isVisible).toBe(true);
    });

    it('should expand the first widget if none have been activated', () => {
      const widget = new Widget();
      widget.id = 'foo';
      const widget2 = new Widget();
      widget2.id = 'bar';
      shell.add(widget, 'left', { rank: 10 });
      shell.add(widget2, 'left', { rank: 1 });
      expect(widget2.isVisible).toBe(false);
      shell.expandLeft();
      expect(widget2.isVisible).toBe(true);
    });
  });

  describe('#expandRight()', () => {
    it('should expand the most recently used widget', () => {
      const widget = new Widget();
      widget.id = 'foo';
      const widget2 = new Widget();
      widget2.id = 'bar';
      shell.add(widget, 'right', { rank: 10 });
      shell.add(widget2, 'right', { rank: 1 });
      shell.activateById('foo');
      shell.collapseRight();
      expect(widget.isVisible).toBe(false);
      shell.expandRight();
      expect(widget.isVisible).toBe(true);
    });

    it('should expand the first widget if none have been activated', () => {
      const widget = new Widget();
      widget.id = 'foo';
      const widget2 = new Widget();
      widget2.id = 'bar';
      shell.add(widget, 'right', { rank: 10 });
      shell.add(widget2, 'right', { rank: 1 });
      expect(widget2.isVisible).toBe(false);
      shell.expandRight();
      expect(widget2.isVisible).toBe(true);
    });
  });

  describe('#closeAll()', () => {
    it('should close all of the widgets in the main area', () => {
      const foo = new Widget();
      foo.id = 'foo';
      shell.add(foo, 'main');
      const bar = new Widget();
      bar.id = 'bar';
      shell.add(bar, 'main');
      shell.closeAll();
      expect(foo.parent).toBe(null);
      expect(bar.parent).toBe(null);
    });
  });

  describe('#saveLayout', () => {
    it('should save the layout of the shell', () => {
      const foo = new Widget();
      foo.id = 'foo';
      shell.add(foo, 'main');
      const state = shell.saveLayout();
      shell.activateById('foo');
      expect(shell.mode).toBe('multiple-document');
      expect(state.mainArea?.currentWidget).toBe(null);
    });
  });

  describe('#restoreLayout', () => {
    it('should restore the layout of the shell', () => {
      const state = shell.saveLayout();
      const mode: DockPanel.Mode = 'multiple-document';
      shell.mode = 'single-document';
      shell.restoreLayout(mode, state);
      expect(shell.mode).toBe('multiple-document');
    });
  });

  describe('#widgets', () => {
    it('should list widgets in each area', () => {
      let widget: Widget;

      widget = new Widget();
      widget.id = 'header';
      shell.add(widget, 'header');

      widget = new Widget();
      widget.id = 'top';
      shell.add(widget, 'top');

      widget = new Widget();
      widget.id = 'menu';
      shell.add(widget, 'menu');

      widget = new Widget();
      widget.id = 'left';
      shell.add(widget, 'left');

      widget = new Widget();
      widget.id = 'right';
      shell.add(widget, 'right');

      widget = new Widget();
      widget.id = 'main';
      shell.add(widget, 'main');

      expect(toArray(shell.widgets('header')).map(v => v.id)).toEqual([
        'header'
      ]);
      expect(
        toArray(shell.widgets('top'))
          .slice(-1)
          .map(v => v.id)
      ).toEqual(['top']);
      expect(toArray(shell.widgets('menu')).map(v => v.id)).toEqual(['menu']);
      expect(toArray(shell.widgets('left')).map(v => v.id)).toEqual(['left']);
      expect(toArray(shell.widgets('right')).map(v => v.id)).toEqual(['right']);
      expect(toArray(shell.widgets('main')).map(v => v.id)).toEqual(['main']);
    });

    it('should default to main area', () => {
      const widget = new Widget();
      widget.id = 'foo';
      shell.add(widget, 'main');
      expect(toArray(shell.widgets()).map(v => v.id)).toEqual(['foo']);
    });

    it('should throw an error when an unrecognized area is given', () => {
      expect(() => shell.widgets('foo' as any)).toThrowError(/Invalid area/);
    });
  });

  describe('#titlePanel', () => {
    it('should be hidden in multiple document mode and visible in single document mode', () => {
      const widget = new Widget();
      widget.id = 'foo';
      shell.add(widget, 'right', { rank: 10 });
      shell.mode = 'multiple-document';
      expect(widget.isVisible).toBe(false);
      shell.mode = 'single-document';
      expect(widget.isVisible).toBe(false);
    });
  });
});
