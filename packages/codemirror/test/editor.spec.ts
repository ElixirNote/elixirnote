// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { CodeEditor } from '@jupyterlab/codeeditor';
import { CodeMirrorEditor } from '@jupyterlab/codemirror';
import { generate, simulate } from 'simulate-event';

const UP_ARROW = 38;

const DOWN_ARROW = 40;

const ENTER = 13;

class LogFileEditor extends CodeMirrorEditor {
  methods: string[] = [];

  protected onKeydown(event: KeyboardEvent): boolean {
    const value = super.onKeydown(event);
    this.methods.push('onKeydown');
    return value;
  }
}

describe('CodeMirrorEditor', () => {
  let editor: LogFileEditor;
  let host: HTMLElement;
  let model: CodeEditor.IModel;
  const TEXT = new Array(100).join('foo bar baz\n');

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    model = new CodeEditor.Model();
    editor = new LogFileEditor({ host, model });
  });

  afterEach(() => {
    editor.dispose();
    document.body.removeChild(host);
  });

  describe('#constructor()', () => {
    it('should create a CodeMirrorEditor', () => {
      expect(editor).toBeInstanceOf(CodeMirrorEditor);
    });
  });

  describe('#edgeRequested', () => {
    it('should emit a signal when the top edge is requested', () => {
      let edge: CodeEditor.EdgeLocation | null = null;
      const event = generate('keydown', { keyCode: UP_ARROW });
      const listener = (sender: any, args: CodeEditor.EdgeLocation) => {
        edge = args;
      };
      editor.edgeRequested.connect(listener);
      expect(edge).toBeNull();
      editor.editor.triggerOnKeyDown(event);
      expect(edge).toBe('top');
    });

    it('should emit a signal when the bottom edge is requested', () => {
      let edge: CodeEditor.EdgeLocation | null = null;
      const event = generate('keydown', { keyCode: DOWN_ARROW });
      const listener = (sender: any, args: CodeEditor.EdgeLocation) => {
        edge = args;
      };
      editor.edgeRequested.connect(listener);
      expect(edge).toBeNull();
      editor.editor.triggerOnKeyDown(event);
      expect(edge).toBe('bottom');
    });
  });

  describe('#uuid', () => {
    it('should be the unique id of the editor', () => {
      expect(editor.uuid).toBeTruthy();
      const uuid = 'foo';
      editor = new LogFileEditor({ model, host, uuid });
      expect(editor.uuid).toBe('foo');
    });
  });

  describe('#selectionStyle', () => {
    it('should be the selection style of the editor', () => {
      expect(editor.selectionStyle).toEqual(CodeEditor.defaultSelectionStyle);
    });

    it('should be settable', () => {
      const style = {
        className: 'foo',
        displayName: 'bar',
        color: 'black'
      };
      editor.selectionStyle = style;
      expect(editor.selectionStyle).toEqual(style);
    });
  });

  describe('#editor', () => {
    it('should be the codemirror editor wrapped by the editor', () => {
      const cm = editor.editor;
      expect(cm.getDoc()).toBe(editor.doc);
    });
  });

  describe('#doc', () => {
    it('should be the codemirror doc wrapped by the editor', () => {
      const doc = editor.doc;
      expect(doc.getEditor()).toBe(editor.editor);
    });
  });

  describe('#lineCount', () => {
    it('should get the number of lines in the editor', () => {
      expect(editor.lineCount).toBe(1);
      editor.model.value.text = 'foo\nbar\nbaz';
      expect(editor.lineCount).toBe(3);
    });
  });

  describe('#getOption()', () => {
    it('should get whether line numbers should be shown', () => {
      expect(editor.getOption('lineNumbers')).toBe(false);
    });

    it('should get whether horizontally scrolling should be used', () => {
      expect(editor.getOption('lineWrap')).toBe('on');
    });

    it('should get whether the editor is readonly', () => {
      expect(editor.getOption('readOnly')).toBe(false);
    });
  });

  describe('#setOption()', () => {
    it('should set whether line numbers should be shown', () => {
      editor.setOption('lineNumbers', true);
      expect(editor.getOption('lineNumbers')).toBe(true);
    });

    it('should set whether horizontally scrolling should be used', () => {
      editor.setOption('lineWrap', 'off');
      expect(editor.getOption('lineWrap')).toBe('off');
    });

    it('should set whether the editor is readonly', () => {
      editor.setOption('readOnly', true);
      expect(editor.getOption('readOnly')).toBe(true);
    });
  });

  describe('#model', () => {
    it('should get the model used by the editor', () => {
      expect(editor.model).toBe(model);
    });
  });

  describe('#lineHeight', () => {
    it('should get the text height of a line in the editor', () => {
      expect(editor.lineHeight).toBeGreaterThan(0);
    });
  });

  describe('#charWidth', () => {
    it('should get the character width in the editor', () => {
      expect(editor.charWidth).toBeGreaterThan(0);
    });
  });

  describe('#isDisposed', () => {
    it('should test whether the editor is disposed', () => {
      expect(editor.isDisposed).toBe(false);
      editor.dispose();
      expect(editor.isDisposed).toBe(true);
    });
  });

  describe('#dispose()', () => {
    it('should dispose of the resources used by the editor', () => {
      expect(editor.isDisposed).toBe(false);
      editor.dispose();
      expect(editor.isDisposed).toBe(true);
      editor.dispose();
      expect(editor.isDisposed).toBe(true);
    });
  });

  describe('#getLine()', () => {
    it('should get a line of text', () => {
      model.value.text = 'foo\nbar';
      expect(editor.getLine(0)).toBe('foo');
      expect(editor.getLine(1)).toBe('bar');
      expect(editor.getLine(2)).toBeUndefined();
    });
  });

  describe('#getOffsetAt()', () => {
    it('should get the offset for a given position', () => {
      model.value.text = 'foo\nbar';
      let pos = {
        column: 2,
        line: 1
      };
      expect(editor.getOffsetAt(pos)).toBe(6);
      pos = {
        column: 2,
        line: 5
      };
      expect(editor.getOffsetAt(pos)).toBe(7);
    });
  });

  describe('#getPositionAt()', () => {
    it('should get the position for a given offset', () => {
      model.value.text = 'foo\nbar';
      let pos = editor.getPositionAt(6);
      expect(pos.column).toBe(2);
      expect(pos.line).toBe(1);
      pos = editor.getPositionAt(101);
      expect(pos.column).toBe(3);
      expect(pos.line).toBe(1);
    });
  });

  describe('#undo()', () => {
    it('should undo one edit', () => {
      model.value.text = 'foo';
      editor.undo();
      expect(model.value.text).toBe('');
    });
  });

  describe('#redo()', () => {
    it('should redo one undone edit', () => {
      model.value.text = 'foo';
      editor.undo();
      editor.redo();
      expect(model.value.text).toBe('foo');
    });
  });

  describe('#clearHistory()', () => {
    it('should clear the undo history', () => {
      model.value.text = 'foo';
      editor.clearHistory();
      editor.undo();
      expect(model.value.text).toBe('foo');
    });
  });

  describe('#focus()', () => {
    it('should give focus to the editor', () => {
      expect(host.contains(document.activeElement)).toBe(false);
      editor.focus();
      expect(host.contains(document.activeElement)).toBe(true);
    });
  });

  describe('#hasFocus()', () => {
    it('should test whether the editor has focus', () => {
      expect(editor.hasFocus()).toBe(false);
      editor.focus();
      expect(editor.hasFocus()).toBe(true);
    });
  });

  describe('#blur()', () => {
    it('should blur the editor', () => {
      editor.focus();
      expect(host.contains(document.activeElement)).toBe(true);
      editor.blur();
      expect(host.contains(document.activeElement)).toBe(false);
    });
  });

  describe('#handleEvent', () => {
    describe('focus', () => {
      it('should add the focus class to the host', () => {
        simulate(editor.editor.getInputField(), 'focus');
        expect(host.classList.contains('jp-mod-focused')).toBe(true);
      });
    });

    describe('blur', () => {
      it('should remove the focus class from the host', () => {
        simulate(editor.editor.getInputField(), 'focus');
        expect(host.classList.contains('jp-mod-focused')).toBe(true);
        simulate(editor.editor.getInputField(), 'blur');
        expect(host.classList.contains('jp-mod-focused')).toBe(false);
      });
    });
  });

  describe('#refresh()', () => {
    it('should repaint the editor', () => {
      editor.refresh();
      expect(editor).toBeTruthy();
    });
  });

  describe('#addKeydownHandler()', () => {
    it('should add a keydown handler to the editor', () => {
      let called = 0;
      const handler = () => {
        called++;
        return true;
      };
      const disposable = editor.addKeydownHandler(handler);
      let evt = generate('keydown', { keyCode: ENTER });
      editor.editor.triggerOnKeyDown(evt);
      expect(called).toBe(1);
      disposable.dispose();
      expect(disposable.isDisposed).toBe(true);

      evt = generate('keydown', { keyCode: ENTER });
      editor.editor.triggerOnKeyDown(evt);
      expect(called).toBe(1);
    });
  });

  describe('#setSize()', () => {
    it('should set the size of the editor in pixels', () => {
      editor.setSize({ width: 100, height: 100 });
      editor.setSize(null);
      expect(editor).toBeTruthy();
    });
  });

  describe('#revealPosition()', () => {
    it('should reveal the given position in the editor', () => {
      model.value.text = TEXT;
      editor.revealPosition({ line: 50, column: 0 });
      expect(editor).toBeTruthy();
    });
  });

  describe('#revealSelection()', () => {
    it('should reveal the given selection in the editor', () => {
      model.value.text = TEXT;
      const start = { line: 50, column: 0 };
      const end = { line: 52, column: 0 };
      editor.setSelection({ start, end });
      editor.revealSelection(editor.getSelection());
      expect(editor).toBeTruthy();
    });
  });

  describe('#getCoordinateForPosition()', () => {
    it('should get the window coordinates given a cursor position', () => {
      model.value.text = TEXT;
      const coord = editor.getCoordinateForPosition({ line: 10, column: 1 });
      if (typeof process !== 'undefined') {
        expect(coord.left).toBe(0);
      } else {
        expect(coord.left).toBeGreaterThan(0);
      }
    });
  });

  describe('#getPositionForCoordinate()', () => {
    it('should get the window coordinates given a cursor position', () => {
      model.value.text = TEXT;
      const coord = editor.getCoordinateForPosition({ line: 10, column: 1 });
      const newPos = editor.getPositionForCoordinate(coord)!;
      expect(newPos.line).toBeTruthy();
      expect(newPos.column).toBeTruthy();
    });
  });

  describe('#getCursorPosition()', () => {
    it('should get the primary position of the cursor', () => {
      model.value.text = TEXT;
      let pos = editor.getCursorPosition();
      expect(pos.line).toBe(0);
      expect(pos.column).toBe(0);

      editor.setCursorPosition({ line: 12, column: 3 });
      pos = editor.getCursorPosition();
      expect(pos.line).toBe(12);
      expect(pos.column).toBe(3);
    });
  });

  describe('#setCursorPosition()', () => {
    it('should set the primary position of the cursor', () => {
      model.value.text = TEXT;
      editor.setCursorPosition({ line: 12, column: 3 });
      const pos = editor.getCursorPosition();
      expect(pos.line).toBe(12);
      expect(pos.column).toBe(3);
    });
  });

  describe('#getSelection()', () => {
    it('should get the primary selection of the editor', () => {
      const selection = editor.getSelection();
      expect(selection.start.line).toBe(0);
      expect(selection.end.line).toBe(0);
    });
  });

  describe('#setSelection()', () => {
    it('should set the primary selection of the editor', () => {
      model.value.text = TEXT;
      const start = { line: 50, column: 0 };
      const end = { line: 52, column: 0 };
      editor.setSelection({ start, end });
      expect(editor.getSelection().start).toEqual(start);
      expect(editor.getSelection().end).toEqual(end);
    });

    it('should remove any secondary cursors', () => {
      model.value.text = TEXT;
      const range0 = {
        start: { line: 50, column: 0 },
        end: { line: 52, column: 0 }
      };
      const range1 = {
        start: { line: 53, column: 0 },
        end: { line: 54, column: 0 }
      };
      editor.setSelections([range0, range1]);
      editor.setSelection(range1);
      expect(editor.getSelections().length).toBe(1);
    });
  });

  describe('#getSelections()', () => {
    it('should get the selections for all the cursors', () => {
      model.value.text = TEXT;
      const range0 = {
        start: { line: 50, column: 0 },
        end: { line: 52, column: 0 }
      };
      const range1 = {
        start: { line: 53, column: 0 },
        end: { line: 54, column: 0 }
      };
      editor.setSelections([range0, range1]);
      const selections = editor.getSelections();
      expect(selections[0].start.line).toBe(50);
      expect(selections[1].end.line).toBe(54);
    });
  });

  describe('#setSelections()', () => {
    it('should set the selections for all the cursors', () => {
      model.value.text = TEXT;
      const range0 = {
        start: { line: 50, column: 0 },
        end: { line: 52, column: 0 }
      };
      const range1 = {
        start: { line: 53, column: 0 },
        end: { line: 54, column: 0 }
      };
      editor.setSelections([range0, range1]);
      const selections = editor.getSelections();
      expect(selections[0].start.line).toBe(50);
      expect(selections[1].end.line).toBe(54);
    });

    it('should set a default selection for an empty array', () => {
      model.value.text = TEXT;
      editor.setSelections([]);
      const selection = editor.getSelection();
      expect(selection.start.line).toBe(0);
      expect(selection.end.line).toBe(0);
    });
  });

  describe('#onKeydown()', () => {
    it('should run when there is a keydown event on the editor', () => {
      const event = generate('keydown', { keyCode: UP_ARROW });
      expect(editor.methods).toEqual(expect.not.arrayContaining(['onKeydown']));
      editor.editor.triggerOnKeyDown(event);
      expect(editor.methods).toEqual(expect.arrayContaining(['onKeydown']));
    });
  });
});
