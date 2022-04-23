// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ISessionContext } from '@jupyterlab/apputils';
import { CodeEditor } from '@jupyterlab/codeeditor';
import { CodeMirrorEditor } from '@jupyterlab/codemirror';
import { KernelMessage } from '@jupyterlab/services';
import { createSessionContext, signalToPromise } from '@jupyterlab/testutils';
import { ConsoleHistory } from '../src';

const mockHistory = ({
  header: null,
  parent_header: {
    date: '',
    msg_id: '',
    msg_type: 'history_request',
    username: '',
    session: '',
    version: '5.3'
  },
  metadata: null,
  buffers: null,
  channel: 'shell',
  content: {
    status: 'ok',
    history: [
      [0, 0, 'foo'],
      [0, 0, 'bar'],
      [0, 0, 'baz'],
      [0, 0, 'qux']
    ]
  }
} as unknown) as KernelMessage.IHistoryReplyMsg;

class TestHistory extends ConsoleHistory {
  methods: string[] = [];

  onEdgeRequest(
    editor: CodeEditor.IEditor,
    location: CodeEditor.EdgeLocation
  ): void {
    this.methods.push('onEdgeRequest');
    super.onEdgeRequest(editor, location);
  }

  onHistory(value: KernelMessage.IHistoryReplyMsg): void {
    super.onHistory(value);
    this.methods.push('onHistory');
  }

  onTextChange(): void {
    super.onTextChange();
    this.methods.push('onTextChange');
  }
}

describe('console/history', () => {
  let sessionContext: ISessionContext;

  beforeEach(async () => {
    sessionContext = await createSessionContext();
  });

  afterAll(() => sessionContext.shutdown());

  describe('ConsoleHistory', () => {
    describe('#constructor()', () => {
      it('should create a console history object', () => {
        const history = new ConsoleHistory({ sessionContext });
        expect(history).toBeInstanceOf(ConsoleHistory);
      });
    });

    describe('#isDisposed', () => {
      it('should get whether the object is disposed', () => {
        const history = new ConsoleHistory({ sessionContext });
        expect(history.isDisposed).toBe(false);
        history.dispose();
        expect(history.isDisposed).toBe(true);
      });
    });

    describe('#session', () => {
      it('should be the client session object', () => {
        const history = new ConsoleHistory({ sessionContext });
        expect(history.sessionContext).toBe(sessionContext);
      });
    });

    describe('#dispose()', () => {
      it('should dispose the history object', () => {
        const history = new ConsoleHistory({ sessionContext });
        expect(history.isDisposed).toBe(false);
        history.dispose();
        expect(history.isDisposed).toBe(true);
      });

      it('should be safe to dispose multiple times', () => {
        const history = new ConsoleHistory({ sessionContext });
        expect(history.isDisposed).toBe(false);
        history.dispose();
        history.dispose();
        expect(history.isDisposed).toBe(true);
      });
    });

    describe('#back()', () => {
      it('should return an empty string if no history exists', async () => {
        const history = new ConsoleHistory({ sessionContext });
        const result = await history.back('');
        expect(result).toBe('');
      });

      it('should return previous items if they exist', async () => {
        const history = new TestHistory({ sessionContext });
        history.onHistory(mockHistory);
        const result = await history.back('');
        if (mockHistory.content.status !== 'ok') {
          throw new Error('Test history reply is not an "ok" reply');
        }
        const index = mockHistory.content.history.length - 1;
        const last = (mockHistory.content.history[index] as any)[2];
        expect(result).toBe(last);
      });
    });

    describe('#forward()', () => {
      it('should return an empty string if no history exists', async () => {
        const history = new ConsoleHistory({ sessionContext });
        const result = await history.forward('');
        expect(result).toBe('');
      });

      it('should return next items if they exist', async () => {
        const history = new TestHistory({ sessionContext });
        history.onHistory(mockHistory);
        await Promise.all([history.back(''), history.back('')]);
        const result = await history.forward('');
        if (mockHistory.content.status !== 'ok') {
          throw new Error('Test history reply is not an "ok" reply');
        }
        const index = mockHistory.content.history.length - 1;
        const last = (mockHistory.content.history[index] as any)[2];
        expect(result).toBe(last);
      });
    });

    describe('#push()', () => {
      it('should allow addition of history items', async () => {
        const history = new ConsoleHistory({ sessionContext });
        const item = 'foo';
        history.push(item);
        const result = await history.back('');
        expect(result).toBe(item);
      });
    });

    describe('#onTextChange()', () => {
      it('should be called upon an editor text change', () => {
        const history = new TestHistory({ sessionContext });
        expect(history.methods).toEqual(
          expect.not.arrayContaining(['onTextChange'])
        );
        const model = new CodeEditor.Model();
        const host = document.createElement('div');
        const editor = new CodeMirrorEditor({ model, host });
        history.editor = editor;
        model.value.text = 'foo';
        expect(history.methods).toEqual(
          expect.arrayContaining(['onTextChange'])
        );
      });
    });

    describe('#onEdgeRequest()', () => {
      it('should be called upon an editor edge request', async () => {
        const history = new TestHistory({ sessionContext });
        expect(history.methods).toEqual(
          expect.not.arrayContaining(['onEdgeRequest'])
        );
        const host = document.createElement('div');
        const model = new CodeEditor.Model();
        const editor = new CodeMirrorEditor({ model, host });
        history.editor = editor;
        history.push('foo');
        const promise = signalToPromise(editor.model.value.changed);
        editor.edgeRequested.emit('top');
        expect(history.methods).toEqual(
          expect.arrayContaining(['onEdgeRequest'])
        );
        await promise;
        expect(editor.model.value.text).toBe('foo');
      });
    });
  });
});
