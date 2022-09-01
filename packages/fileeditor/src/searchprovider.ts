// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { MainAreaWidget } from '@jupyterlab/apputils';
import {
  CodeMirrorEditor,
  CodeMirrorSearchProvider
} from '@jupyterlab/codemirror';
import { ISearchProvider } from '@jupyterlab/documentsearch';
import { ITranslator } from '@jupyterlab/translation';
import { Widget } from '@lumino/widgets';
import { FileEditor } from './widget';

/**
 * Helper type
 */
export type FileEditorPanel = MainAreaWidget<FileEditor>;

/**
 * File editor search provider
 */
export class FileEditorSearchProvider
  extends CodeMirrorSearchProvider
  implements ISearchProvider
{
  /**
   * Constructor
   * @param widget File editor panel
   */
  constructor(widget: FileEditorPanel) {
    super(widget.content.editor as CodeMirrorEditor);
  }

  /**
   * Instantiate a search provider for the widget.
   *
   * #### Notes
   * The widget provided is always checked using `isApplicable` before calling
   * this factory.
   *
   * @param widget The widget to search on
   * @param translator [optional] The translator object
   *
   * @returns The search provider on the widget
   */
  static createNew(
    widget: FileEditorPanel,
    translator?: ITranslator
  ): ISearchProvider {
    return new FileEditorSearchProvider(widget);
  }

  /**
   * Report whether or not this provider has the ability to search on the given object
   */
  static isApplicable(domain: Widget): domain is FileEditorPanel {
    return (
      domain instanceof MainAreaWidget &&
      domain.content instanceof FileEditor &&
      domain.content.editor instanceof CodeMirrorEditor
    );
  }

  /**
   * Get an initial query value if applicable so that it can be entered
   * into the search box as an initial query
   *
   * @returns Initial value used to populate the search box.
   */
  getInitialQuery(): string {
    const cm = this.editor as CodeMirrorEditor;
    const selection = cm.state.sliceDoc(
      cm.state.selection.main.from,
      cm.state.selection.main.to
    );
    // if there are newlines, just return empty string
    return selection.search(/\r?\n|\r/g) === -1 ? selection : '';
  }
}
