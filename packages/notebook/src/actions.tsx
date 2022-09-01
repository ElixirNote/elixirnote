// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  Clipboard,
  Dialog,
  ISessionContext,
  sessionContextDialogs,
  showDialog
} from '@jupyterlab/apputils';
import {
  Cell,
  CodeCell,
  ICellModel,
  ICodeCellModel,
  isCodeCellModel,
  isMarkdownCellModel,
  isRawCellModel,
  MarkdownCell
} from '@jupyterlab/cells';
import * as nbformat from '@jupyterlab/nbformat';
import { KernelMessage } from '@jupyterlab/services';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { ArrayExt, each, findIndex, toArray } from '@lumino/algorithm';
import { JSONExt, JSONObject } from '@lumino/coreutils';
import { ElementExt } from '@lumino/domutils';
import { ISignal, Signal } from '@lumino/signaling';
import * as React from 'react';
import { INotebookModel } from './model';
import { Notebook, StaticNotebook } from './widget';

/**
 * The mimetype used for Jupyter cell data.
 */
const JUPYTER_CELL_MIME = 'application/vnd.jupyter.cells';

export class KernelError extends Error {
  /**
   * Exception name
   */
  readonly errorName: string;
  /**
   * Exception value
   */
  readonly errorValue: string;
  /**
   * Traceback
   */
  readonly traceback: string[];

  /**
   * Construct the kernel error.
   */
  constructor(content: KernelMessage.IExecuteReplyMsg['content']) {
    const errorContent = content as KernelMessage.IReplyErrorContent;
    const errorName = errorContent.ename;
    const errorValue = errorContent.evalue;
    super(`KernelReplyNotOK: ${errorName} ${errorValue}`);

    this.errorName = errorName;
    this.errorValue = errorValue;
    this.traceback = errorContent.traceback;
    Object.setPrototypeOf(this, KernelError.prototype);
  }
}

/**
 * A collection of actions that run against notebooks.
 *
 * #### Notes
 * All of the actions are a no-op if there is no model on the notebook.
 * The actions set the widget `mode` to `'command'` unless otherwise specified.
 * The actions will preserve the selection on the notebook widget unless
 * otherwise specified.
 */
export class NotebookActions {
  /**
   * A signal that emits whenever a cell completes execution.
   */
  static get executed(): ISignal<
    any,
    {
      notebook: Notebook;
      cell: Cell;
      success: boolean;
      error?: KernelError | null;
    }
  > {
    return Private.executed;
  }

  /**
   * A signal that emits whenever a cell execution is scheduled.
   */
  static get executionScheduled(): ISignal<
    any,
    { notebook: Notebook; cell: Cell }
  > {
    return Private.executionScheduled;
  }

  /**
   * A signal that emits when one notebook's cells are all executed.
   */
  static get selectionExecuted(): ISignal<
    any,
    { notebook: Notebook; lastCell: Cell }
  > {
    return Private.selectionExecuted;
  }

  /**
   * A private constructor for the `NotebookActions` class.
   *
   * #### Notes
   * This class can never be instantiated. Its static member `executed` will be
   * merged with the `NotebookActions` namespace. The reason it exists as a
   * standalone class is because at run time, the `Private.executed` variable
   * does not yet exist, so it needs to be referenced via a getter.
   */
  private constructor() {
    // Intentionally empty.
  }
}

/**
 * A namespace for `NotebookActions` static methods.
 */
export namespace NotebookActions {
  /**
   * Split the active cell into two or more cells.
   *
   * @param notebook The target notebook widget.
   *
   * #### Notes
   * It will preserve the existing mode.
   * The last cell will be activated if no selection is found.
   * If text was selected, the cell containing the selection will
   * be activated.
   * The existing selection will be cleared.
   * The activated cell will have focus and the cursor will
   * remain in the initial position.
   * The leading whitespace in the second cell will be removed.
   * If there is no content, two empty cells will be created.
   * Both cells will have the same type as the original cell.
   * This action can be undone.
   */
  export function splitCell(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    if (!Private.isNotebookRendered(notebook)) {
      return;
    }
    const state = Private.getState(notebook);

    notebook.deselectAll();

    const nbModel = notebook.model;
    const index = notebook.activeCellIndex;
    const child = notebook.widgets[index];
    const editor = child.editor;
    const selections = editor.getSelections();
    const orig = child.model.value.text;

    const offsets = [0];

    let start: number = -1;
    let end: number = -1;
    for (let i = 0; i < selections.length; i++) {
      // append start and end to handle selections
      // cursors will have same start and end
      start = editor.getOffsetAt(selections[i].start);
      end = editor.getOffsetAt(selections[i].end);
      if (start < end) {
        offsets.push(start);
        offsets.push(end);
      } else if (end < start) {
        offsets.push(end);
        offsets.push(start);
      } else {
        offsets.push(start);
      }
    }

    offsets.push(orig.length);

    const clones: ICellModel[] = [];
    for (let i = 0; i + 1 < offsets.length; i++) {
      const clone = Private.cloneCell(nbModel, child.model);
      clones.push(clone);
    }

    for (let i = 0; i < clones.length; i++) {
      if (i !== clones.length - 1 && clones[i].type === 'code') {
        (clones[i] as ICodeCellModel).outputs.clear();
      }
      clones[i].value.text = orig
        .slice(offsets[i], offsets[i + 1])
        .replace(/^\n+/, '')
        .replace(/\n+$/, '');
    }

    const cells = nbModel.cells;

    cells.beginCompoundOperation();
    for (let i = 0; i < clones.length; i++) {
      if (i === 0) {
        cells.set(index, clones[i]);
      } else {
        cells.insert(index + i, clones[i]);
      }
    }
    cells.endCompoundOperation();

    // If there is a selection the selected cell will be activated
    const activeCellDelta = start !== end ? 2 : 1;
    notebook.activeCellIndex = index + clones.length - activeCellDelta;
    const focusedEditor = notebook.activeCell.editor;
    focusedEditor.focus();

    Private.handleState(notebook, state);
  }

  /**
   * Merge the selected cells.
   *
   * @param notebook - The target notebook widget.
   *
   * @param mergeAbove - If only one cell is selected, indicates whether to merge it
   *    with the cell above (true) or below (false, default).
   *
   * #### Notes
   * The widget mode will be preserved.
   * If only one cell is selected and `mergeAbove` is true, the above cell will be selected.
   * If only one cell is selected and `mergeAbove` is false, the below cell will be selected.
   * If the active cell is a code cell, its outputs will be cleared.
   * This action can be undone.
   * The final cell will have the same type as the active cell.
   * If the active cell is a markdown cell, it will be unrendered.
   */
  export function mergeCells(
    notebook: Notebook,
    mergeAbove: boolean = false
  ): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    if (!Private.isNotebookRendered(notebook)) {
      return;
    }
    const state = Private.getState(notebook);
    const toMerge: string[] = [];
    const toDelete: ICellModel[] = [];
    const model = notebook.model;
    const cells = model.cells;
    const primary = notebook.activeCell;
    const active = notebook.activeCellIndex;
    const attachments: nbformat.IAttachments = {};

    // Get the cells to merge.
    notebook.widgets.forEach((child, index) => {
      if (notebook.isSelectedOrActive(child)) {
        toMerge.push(child.model.value.text);
        if (index !== active) {
          toDelete.push(child.model);
        }
        // Collect attachments if the cell is a markdown cell or a raw cell
        const model = child.model;
        if (isRawCellModel(model) || isMarkdownCellModel(model)) {
          for (const key of model.attachments.keys) {
            attachments[key] = model.attachments.get(key)!.toJSON();
          }
        }
      }
    });

    // Check for only a single cell selected.
    if (toMerge.length === 1) {
      // Merge with the cell above when mergeAbove is true
      if (mergeAbove === true) {
        // Bail if it is the first cell.
        if (active === 0) {
          return;
        }
        // Otherwise merge with the previous cell.
        const cellModel = cells.get(active - 1);

        toMerge.unshift(cellModel.value.text);
        toDelete.push(cellModel);
      } else if (mergeAbove === false) {
        // Bail if it is the last cell.
        if (active === cells.length - 1) {
          return;
        }
        // Otherwise merge with the next cell.
        const cellModel = cells.get(active + 1);

        toMerge.push(cellModel.value.text);
        toDelete.push(cellModel);
      }
    }

    notebook.deselectAll();

    // Create a new cell for the source to preserve history.
    const newModel = Private.cloneCell(model, primary.model);

    newModel.value.text = toMerge.join('\n\n');
    if (isCodeCellModel(newModel)) {
      newModel.outputs.clear();
    } else if (isMarkdownCellModel(newModel) || isRawCellModel(newModel)) {
      newModel.attachments.fromJSON(attachments);
    }

    // Make the changes while preserving history.
    cells.beginCompoundOperation();
    cells.set(active, newModel);
    toDelete.forEach(cell => {
      cells.removeValue(cell);
    });
    cells.endCompoundOperation();

    // If the original cell is a markdown cell, make sure
    // the new cell is unrendered.
    if (primary instanceof MarkdownCell) {
      (notebook.activeCell as MarkdownCell).rendered = false;
    }

    Private.handleState(notebook, state);
  }

  /**
   * Delete the selected cells.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * The cell after the last selected cell will be activated.
   * It will add a code cell if all cells are deleted.
   * This action can be undone.
   */
  export function deleteCells(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    if (!Private.isNotebookRendered(notebook)) {
      return;
    }
    const state = Private.getState(notebook);

    Private.deleteCells(notebook);
    Private.handleState(notebook, state, true);
  }

  /**
   * Insert a new code cell above the active cell.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * The widget mode will be preserved.
   * This action can be undone.
   * The existing selection will be cleared.
   * The new cell will the active cell.
   */
  export function insertAbove(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    if (!Private.isNotebookRendered(notebook)) {
      return;
    }
    const state = Private.getState(notebook);
    const model = notebook.model;
    const cell = model.contentFactory.createCell(
      notebook.notebookConfig.defaultCell,
      {}
    );
    const active = notebook.activeCellIndex;

    model.cells.insert(active, cell);

    // Make the newly inserted cell active.
    notebook.activeCellIndex = active;
    notebook.deselectAll();
    Private.handleState(notebook, state, true);
  }

  /**
   * Insert a new code cell below the active cell.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * The widget mode will be preserved.
   * This action can be undone.
   * The existing selection will be cleared.
   * The new cell will be the active cell.
   */
  export function insertBelow(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    if (!Private.isNotebookRendered(notebook)) {
      return;
    }
    const state = Private.getState(notebook);
    const model = notebook.model;
    const cell = model.contentFactory.createCell(
      notebook.notebookConfig.defaultCell,
      {}
    );

    model.cells.insert(notebook.activeCellIndex + 1, cell);

    // Make the newly inserted cell active.
    notebook.activeCellIndex++;
    notebook.deselectAll();
    Private.handleState(notebook, state, true);
  }

  /**
   * Move the selected cell(s) down.
   *
   * @param notebook = The target notebook widget.
   */
  export function moveDown(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    if (!Private.isNotebookRendered(notebook)) {
      return;
    }
    const state = Private.getState(notebook);
    const cells = notebook.model.cells;
    const widgets = notebook.widgets;

    cells.beginCompoundOperation();
    for (let i = cells.length - 2; i > -1; i--) {
      if (notebook.isSelectedOrActive(widgets[i])) {
        if (!notebook.isSelectedOrActive(widgets[i + 1])) {
          cells.move(i, i + 1);
          if (notebook.activeCellIndex === i) {
            notebook.activeCellIndex++;
          }
          notebook.select(widgets[i + 1]);
          notebook.deselect(widgets[i]);
        }
      }
    }
    cells.endCompoundOperation();
    Private.handleState(notebook, state, true);
  }

  /**
   * Move the selected cell(s) up.
   *
   * @param widget - The target notebook widget.
   */
  export function moveUp(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    if (!Private.isNotebookRendered(notebook)) {
      return;
    }
    const state = Private.getState(notebook);
    const cells = notebook.model.cells;
    const widgets = notebook.widgets;

    cells.beginCompoundOperation();
    for (let i = 1; i < cells.length; i++) {
      if (notebook.isSelectedOrActive(widgets[i])) {
        if (!notebook.isSelectedOrActive(widgets[i - 1])) {
          cells.move(i, i - 1);
          if (notebook.activeCellIndex === i) {
            notebook.activeCellIndex--;
          }
          notebook.select(widgets[i - 1]);
          notebook.deselect(widgets[i]);
        }
      }
    }
    cells.endCompoundOperation();
    Private.handleState(notebook, state, true);
  }

  /**
   * Change the selected cell type(s).
   *
   * @param notebook - The target notebook widget.
   *
   * @param value - The target cell type.
   *
   * #### Notes
   * It should preserve the widget mode.
   * This action can be undone.
   * The existing selection will be cleared.
   * Any cells converted to markdown will be unrendered.
   */
  export function changeCellType(
    notebook: Notebook,
    value: nbformat.CellType
  ): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    Private.changeCellType(notebook, value);
    Private.handleState(notebook, state);
  }

  /**
   * Run the selected cell(s).
   *
   * @param notebook - The target notebook widget.
   *
   * @param sessionContext - The optional client session object.
   *
   * #### Notes
   * The last selected cell will be activated, but not scrolled into view.
   * The existing selection will be cleared.
   * An execution error will prevent the remaining code cells from executing.
   * All markdown cells will be rendered.
   */
  export function run(
    notebook: Notebook,
    sessionContext?: ISessionContext
  ): Promise<boolean> {
    if (!notebook.model || !notebook.activeCell) {
      return Promise.resolve(false);
    }

    const state = Private.getState(notebook);
    const promise = Private.runSelected(notebook, sessionContext);

    Private.handleRunState(notebook, state, false);
    return promise;
  }

  /**
   * Run the selected cell(s) and advance to the next cell.
   *
   * @param notebook - The target notebook widget.
   *
   * @param sessionContext - The optional client session object.
   *
   * #### Notes
   * The existing selection will be cleared.
   * The cell after the last selected cell will be activated and scrolled into view.
   * An execution error will prevent the remaining code cells from executing.
   * All markdown cells will be rendered.
   * If the last selected cell is the last cell, a new code cell
   * will be created in `'edit'` mode.  The new cell creation can be undone.
   */
  export function runAndAdvance(
    notebook: Notebook,
    sessionContext?: ISessionContext
  ): Promise<boolean> {
    if (!notebook.model || !notebook.activeCell) {
      return Promise.resolve(false);
    }

    const state = Private.getState(notebook);
    const promise = Private.runSelected(notebook, sessionContext);
    const model = notebook.model;

    if (notebook.activeCellIndex === notebook.widgets.length - 1) {
      const cell = model.contentFactory.createCell(
        notebook.notebookConfig.defaultCell,
        {}
      );

      // Do not use push here, as we want an widget insertion
      // to make sure no placeholder widget is rendered.
      model.cells.insert(notebook.widgets.length, cell);
      notebook.activeCellIndex++;
      notebook.mode = 'edit';
    } else {
      notebook.activeCellIndex++;
    }
    Private.handleRunState(notebook, state, true);
    return promise;
  }

  /**
   * Run the selected cell(s) and insert a new code cell.
   *
   * @param notebook - The target notebook widget.
   *
   * @param sessionContext - The optional client session object.
   *
   * #### Notes
   * An execution error will prevent the remaining code cells from executing.
   * All markdown cells will be rendered.
   * The widget mode will be set to `'edit'` after running.
   * The existing selection will be cleared.
   * The cell insert can be undone.
   * The new cell will be scrolled into view.
   */
  export function runAndInsert(
    notebook: Notebook,
    sessionContext?: ISessionContext
  ): Promise<boolean> {
    if (!notebook.model || !notebook.activeCell) {
      return Promise.resolve(false);
    }

    if (!Private.isNotebookRendered(notebook)) {
      return Promise.resolve(false);
    }
    const state = Private.getState(notebook);
    const promise = Private.runSelected(notebook, sessionContext);
    const model = notebook.model;
    const cell = model.contentFactory.createCell(
      notebook.notebookConfig.defaultCell,
      {}
    );

    model.cells.insert(notebook.activeCellIndex + 1, cell);
    notebook.activeCellIndex++;
    notebook.mode = 'edit';
    Private.handleRunState(notebook, state, true);
    return promise;
  }

  /**
   * Run all of the cells in the notebook.
   *
   * @param notebook - The target notebook widget.
   *
   * @param sessionContext - The optional client session object.
   *
   * #### Notes
   * The existing selection will be cleared.
   * An execution error will prevent the remaining code cells from executing.
   * All markdown cells will be rendered.
   * The last cell in the notebook will be activated and scrolled into view.
   */
  export function runAll(
    notebook: Notebook,
    sessionContext?: ISessionContext
  ): Promise<boolean> {
    if (!notebook.model || !notebook.activeCell) {
      return Promise.resolve(false);
    }

    const state = Private.getState(notebook);

    notebook.widgets.forEach(child => {
      notebook.select(child);
    });

    const promise = Private.runSelected(notebook, sessionContext);

    Private.handleRunState(notebook, state, true);
    return promise;
  }

  export function renderAllMarkdown(
    notebook: Notebook,
    sessionContext?: ISessionContext
  ): Promise<boolean> {
    if (!notebook.model || !notebook.activeCell) {
      return Promise.resolve(false);
    }
    const previousIndex = notebook.activeCellIndex;
    const state = Private.getState(notebook);
    notebook.widgets.forEach((child, index) => {
      if (child.model.type === 'markdown') {
        notebook.select(child);
        // This is to make sure that the activeCell
        // does not get executed
        notebook.activeCellIndex = index;
      }
    });
    if (notebook.activeCell.model.type !== 'markdown') {
      return Promise.resolve(true);
    }
    const promise = Private.runSelected(notebook, sessionContext);
    notebook.activeCellIndex = previousIndex;
    Private.handleRunState(notebook, state, true);
    return promise;
  }

  /**
   * Run all of the cells before the currently active cell (exclusive).
   *
   * @param notebook - The target notebook widget.
   *
   * @param sessionContext - The optional client session object.
   *
   * #### Notes
   * The existing selection will be cleared.
   * An execution error will prevent the remaining code cells from executing.
   * All markdown cells will be rendered.
   * The currently active cell will remain selected.
   */
  export function runAllAbove(
    notebook: Notebook,
    sessionContext?: ISessionContext
  ): Promise<boolean> {
    const { activeCell, activeCellIndex, model } = notebook;

    if (!model || !activeCell || activeCellIndex < 1) {
      return Promise.resolve(false);
    }

    const state = Private.getState(notebook);

    notebook.activeCellIndex--;
    notebook.deselectAll();
    for (let i = 0; i < notebook.activeCellIndex; ++i) {
      notebook.select(notebook.widgets[i]);
    }

    const promise = Private.runSelected(notebook, sessionContext);

    notebook.activeCellIndex++;
    Private.handleRunState(notebook, state, true);
    return promise;
  }

  /**
   * Run all of the cells after the currently active cell (inclusive).
   *
   * @param notebook - The target notebook widget.
   *
   * @param sessionContext - The optional client session object.
   *
   * #### Notes
   * The existing selection will be cleared.
   * An execution error will prevent the remaining code cells from executing.
   * All markdown cells will be rendered.
   * The last cell in the notebook will be activated and scrolled into view.
   */
  export function runAllBelow(
    notebook: Notebook,
    sessionContext?: ISessionContext
  ): Promise<boolean> {
    if (!notebook.model || !notebook.activeCell) {
      return Promise.resolve(false);
    }

    const state = Private.getState(notebook);

    notebook.deselectAll();
    for (let i = notebook.activeCellIndex; i < notebook.widgets.length; ++i) {
      notebook.select(notebook.widgets[i]);
    }

    const promise = Private.runSelected(notebook, sessionContext);

    Private.handleRunState(notebook, state, true);
    return promise;
  }

  /**
   * Replaces the selection in the active cell of the notebook.
   *
   * @param notebook - The target notebook widget.
   * @param text - The text to replace the selection.
   */
  export function replaceSelection(notebook: Notebook, text: string): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }
    notebook.activeCell.editor.replaceSelection?.(text);
  }

  /**
   * Select the above the active cell.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * The widget mode will be preserved.
   * This is a no-op if the first cell is the active cell.
   * This will skip any collapsed cells.
   * The existing selection will be cleared.
   */
  export function selectAbove(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }
    if (notebook.activeCellIndex === 0) {
      return;
    }

    let possibleNextCellIndex = notebook.activeCellIndex - 1;

    // find first non hidden cell above current cell
    while (possibleNextCellIndex >= 0) {
      const possibleNextCell = notebook.widgets[possibleNextCellIndex];
      if (!possibleNextCell.inputHidden && !possibleNextCell.isHidden) {
        break;
      }
      possibleNextCellIndex -= 1;
    }

    const state = Private.getState(notebook);

    notebook.activeCellIndex = possibleNextCellIndex;
    notebook.deselectAll();
    Private.handleState(notebook, state, true);
  }

  /**
   * Select the cell below the active cell.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * The widget mode will be preserved.
   * This is a no-op if the last cell is the active cell.
   * This will skip any collapsed cells.
   * The existing selection will be cleared.
   */
  export function selectBelow(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }
    let maxCellIndex = notebook.widgets.length - 1;
    // Find last non-hidden cell
    while (
      notebook.widgets[maxCellIndex].isHidden ||
      notebook.widgets[maxCellIndex].inputHidden
    ) {
      maxCellIndex -= 1;
    }
    if (notebook.activeCellIndex === maxCellIndex) {
      return;
    }

    let possibleNextCellIndex = notebook.activeCellIndex + 1;

    // find first non hidden cell below current cell
    while (possibleNextCellIndex < maxCellIndex) {
      let possibleNextCell = notebook.widgets[possibleNextCellIndex];
      if (!possibleNextCell.inputHidden && !possibleNextCell.isHidden) {
        break;
      }
      possibleNextCellIndex += 1;
    }

    const state = Private.getState(notebook);

    notebook.activeCellIndex = possibleNextCellIndex;
    notebook.deselectAll();
    Private.handleState(notebook, state, true);
  }

  /** Insert new heading of same level above active cell.
   *
   * @param notebook - The target notebook widget
   */
  export function insertSameLevelHeadingAbove(notebook: Notebook) {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }
    let headingLevel = Private.Headings.determineHeadingLevel(
      notebook.activeCell,
      notebook
    );
    if (headingLevel == -1) {
      Private.Headings.insertHeadingAboveCellIndex(0, 1, notebook);
    } else {
      Private.Headings.insertHeadingAboveCellIndex(
        notebook.activeCellIndex!,
        headingLevel,
        notebook
      );
    }
  }

  /** Insert new heading of same level at end of current section.
   *
   * @param notebook - The target notebook widget
   */
  export function insertSameLevelHeadingBelow(notebook: Notebook) {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }
    let headingLevel = Private.Headings.determineHeadingLevel(
      notebook.activeCell,
      notebook
    );
    headingLevel = headingLevel > -1 ? headingLevel : 1;
    let cellIdxOfHeadingBelow =
      Private.Headings.findLowerEqualLevelHeadingBelow(
        notebook.activeCell,
        notebook,
        true
      ) as number;
    Private.Headings.insertHeadingAboveCellIndex(
      cellIdxOfHeadingBelow == -1
        ? notebook.model.cells.length
        : cellIdxOfHeadingBelow,
      headingLevel,
      notebook
    );
  }

  /**
   * Select the heading above the active cell or, if already at heading, collapse it.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * The widget mode will be preserved.
   * This is a no-op if the active cell is the topmost heading in collapsed state
   * The existing selection will be cleared.
   */
  export function selectHeadingAboveOrCollapseHeading(
    notebook: Notebook
  ): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }
    const state = Private.getState(notebook);
    let hInfoActiveCell = getHeadingInfo(notebook.activeCell);
    // either collapse or find the right heading to jump to
    if (hInfoActiveCell.isHeading && !hInfoActiveCell.collapsed) {
      setHeadingCollapse(notebook.activeCell, true, notebook);
    } else {
      let targetHeadingCellIdx =
        Private.Headings.findLowerEqualLevelParentHeadingAbove(
          notebook.activeCell,
          notebook,
          true
        ) as number;
      if (targetHeadingCellIdx > -1) {
        notebook.activeCellIndex = targetHeadingCellIdx;
      }
    }
    // clear selection and handle state
    notebook.deselectAll();
    Private.handleState(notebook, state, true);
  }

  /**
   * Select the heading below the active cell or, if already at heading, expand it.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * The widget mode will be preserved.
   * This is a no-op if the active cell is the last heading in expanded state
   * The existing selection will be cleared.
   */
  export function selectHeadingBelowOrExpandHeading(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }
    const state = Private.getState(notebook);
    let hInfo = getHeadingInfo(notebook.activeCell);
    if (hInfo.isHeading && hInfo.collapsed) {
      setHeadingCollapse(notebook.activeCell, false, notebook);
    } else {
      let targetHeadingCellIdx = Private.Headings.findHeadingBelow(
        notebook.activeCell,
        notebook,
        true // return index of heading cell
      ) as number;
      if (targetHeadingCellIdx > -1) {
        notebook.activeCellIndex = targetHeadingCellIdx;
      }
    }
    notebook.deselectAll();
    Private.handleState(notebook, state, true);
  }

  /**
   * Extend the selection to the cell above.
   *
   * @param notebook - The target notebook widget.
   * @param toTop - If true, denotes selection to extend to the top.
   *
   * #### Notes
   * This is a no-op if the first cell is the active cell.
   * The new cell will be activated.
   */
  export function extendSelectionAbove(
    notebook: Notebook,
    toTop: boolean = false
  ): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }
    // Do not wrap around.
    if (notebook.activeCellIndex === 0) {
      return;
    }

    const state = Private.getState(notebook);

    notebook.mode = 'command';
    // Check if toTop is true, if yes, selection is made to the top.
    if (toTop) {
      notebook.extendContiguousSelectionTo(0);
    } else {
      notebook.extendContiguousSelectionTo(notebook.activeCellIndex - 1);
    }
    Private.handleState(notebook, state, true);
  }

  /**
   * Extend the selection to the cell below.
   *
   * @param notebook - The target notebook widget.
   * @param toBottom - If true, denotes selection to extend to the bottom.
   *
   * #### Notes
   * This is a no-op if the last cell is the active cell.
   * The new cell will be activated.
   */
  export function extendSelectionBelow(
    notebook: Notebook,
    toBottom: boolean = false
  ): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }
    // Do not wrap around.
    if (notebook.activeCellIndex === notebook.widgets.length - 1) {
      return;
    }

    const state = Private.getState(notebook);

    notebook.mode = 'command';
    // Check if toBottom is true, if yes selection is made to the bottom.
    if (toBottom) {
      notebook.extendContiguousSelectionTo(notebook.widgets.length - 1);
    } else {
      notebook.extendContiguousSelectionTo(notebook.activeCellIndex + 1);
    }
    Private.handleState(notebook, state, true);
  }

  /**
   * Select all of the cells of the notebook.
   *
   * @param notebook - the target notebook widget.
   */
  export function selectAll(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }
    notebook.widgets.forEach(child => {
      notebook.select(child);
    });
  }

  /**
   * Deselect all of the cells of the notebook.
   *
   * @param notebook - the target notebook widget.
   */
  export function deselectAll(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }
    notebook.deselectAll();
  }

  /**
   * Copy the selected cell(s) data to a clipboard.
   *
   * @param notebook - The target notebook widget.
   */
  export function copy(notebook: Notebook): void {
    Private.copyOrCut(notebook, false);
  }

  /**
   * Cut the selected cell data to a clipboard.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * This action can be undone.
   * A new code cell is added if all cells are cut.
   */
  export function cut(notebook: Notebook): void {
    if (!Private.isNotebookRendered(notebook)) {
      return;
    }
    Private.copyOrCut(notebook, true);
  }

  /**
   * Paste cells from the application clipboard.
   *
   * @param notebook - The target notebook widget.
   *
   * @param mode - the mode of adding cells:
   *   'below' (default) adds cells below the active cell,
   *   'belowSelected' adds cells below all selected cells,
   *   'above' adds cells above the active cell, and
   *   'replace' removes the currently selected cells and adds cells in their place.
   *
   * #### Notes
   * The last pasted cell becomes the active cell.
   * This is a no-op if there is no cell data on the clipboard.
   * This action can be undone.
   */
  export function paste(
    notebook: Notebook,
    mode: 'below' | 'belowSelected' | 'above' | 'replace' = 'below'
  ): void {
    if (!Private.isNotebookRendered(notebook)) {
      return;
    }

    const clipboard = Clipboard.getInstance();

    if (!clipboard.hasData(JUPYTER_CELL_MIME)) {
      return;
    }

    const values = clipboard.getData(JUPYTER_CELL_MIME) as nbformat.IBaseCell[];

    addCells(notebook, mode, values, true);
  }

  /**
   * Duplicate selected cells in the notebook without using the application clipboard.
   *
   * @param notebook - The target notebook widget.
   *
   * @param mode - the mode of adding cells:
   *   'below' (default) adds cells below the active cell,
   *   'belowSelected' adds cells below all selected cells,
   *   'above' adds cells above the active cell, and
   *   'replace' removes the currently selected cells and adds cells in their place.
   *
   * #### Notes
   * The last pasted cell becomes the active cell.
   * This is a no-op if there is no cell data on the clipboard.
   * This action can be undone.
   */
  export function duplicate(
    notebook: Notebook,
    mode: 'below' | 'belowSelected' | 'above' | 'replace' = 'below'
  ): void {
    const values = Private.selectedCells(notebook);

    if (!values || values.length === 0) {
      return;
    }

    addCells(notebook, mode, values, false); // Cells not from the clipboard
  }

  /**
   * Adds cells to the notebook.
   *
   * @param notebook - The target notebook widget.
   *
   * @param mode - the mode of adding cells:
   *   'below' (default) adds cells below the active cell,
   *   'belowSelected' adds cells below all selected cells,
   *   'above' adds cells above the active cell, and
   *   'replace' removes the currently selected cells and adds cells in their place.
   *
   * @param values — The cells to add to the notebook.
   *
   * @param cellsFromClipboard — True if the cells were sourced from the clipboard.
   *
   * #### Notes
   * The last added cell becomes the active cell.
   * This is a no-op if values is an empty array.
   * This action can be undone.
   */

  function addCells(
    notebook: Notebook,
    mode: 'below' | 'belowSelected' | 'above' | 'replace' = 'below',
    values: nbformat.IBaseCell[],
    cellsFromClipboard: boolean = false
  ): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);
    const model = notebook.model;

    notebook.mode = 'command';

    const newCells = values.map(cell => {
      switch (cell.cell_type) {
        case 'code':
          if (
            notebook.lastClipboardInteraction === 'cut' &&
            typeof cell.id === 'string'
          ) {
            let cellId = cell.id as string;
            return model.contentFactory.createCodeCell({
              id: cellId,
              cell: cell
            });
          } else {
            return model.contentFactory.createCodeCell({ cell });
          }
        case 'markdown':
          return model.contentFactory.createMarkdownCell({ cell });
        default:
          return model.contentFactory.createRawCell({ cell });
      }
    });

    const cells = notebook.model.cells;
    let index: number;

    cells.beginCompoundOperation();

    // Set the starting index of the paste operation depending upon the mode.
    switch (mode) {
      case 'below':
        index = notebook.activeCellIndex;
        break;
      case 'belowSelected':
        notebook.widgets.forEach((child, childIndex) => {
          if (notebook.isSelectedOrActive(child)) {
            index = childIndex;
          }
        });

        break;
      case 'above':
        index = notebook.activeCellIndex - 1;
        break;
      case 'replace': {
        // Find the cells to delete.
        const toDelete: number[] = [];

        notebook.widgets.forEach((child, index) => {
          const deletable = child.model.metadata.get('deletable') !== false;

          if (notebook.isSelectedOrActive(child) && deletable) {
            toDelete.push(index);
          }
        });

        // If cells are not deletable, we may not have anything to delete.
        if (toDelete.length > 0) {
          // Delete the cells as one undo event.
          toDelete.reverse().forEach(i => {
            cells.remove(i);
          });
        }
        index = toDelete[0];
        break;
      }
      default:
        break;
    }

    newCells.forEach(cell => {
      cells.insert(++index, cell);
    });
    cells.endCompoundOperation();

    notebook.activeCellIndex += newCells.length;
    notebook.deselectAll();
    if (cellsFromClipboard) {
      notebook.lastClipboardInteraction = 'paste';
    }
    Private.handleState(notebook, state);
  }

  /**
   * Undo a cell action.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * This is a no-op if if there are no cell actions to undo.
   */
  export function undo(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    if (!Private.isNotebookRendered(notebook)) {
      return;
    }
    const state = Private.getState(notebook);

    notebook.mode = 'command';
    notebook.model.sharedModel.undo();
    notebook.deselectAll();
    Private.handleState(notebook, state);
  }

  /**
   * Redo a cell action.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * This is a no-op if there are no cell actions to redo.
   */
  export function redo(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    notebook.mode = 'command';
    notebook.model.sharedModel.redo();
    notebook.deselectAll();
    Private.handleState(notebook, state);
  }

  /**
   * Toggle the line number of all cells.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * The original state is based on the state of the active cell.
   * The `mode` of the widget will be preserved.
   */
  export function toggleAllLineNumbers(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);
    const config = notebook.editorConfig;
    const lineNumbers = !(
      config.code.lineNumbers &&
      config.markdown.lineNumbers &&
      config.raw.lineNumbers
    );
    const newConfig = {
      code: { ...config.code, lineNumbers },
      markdown: { ...config.markdown, lineNumbers },
      raw: { ...config.raw, lineNumbers }
    };

    notebook.editorConfig = newConfig;
    Private.handleState(notebook, state);
  }

  /**
   * Clear the code outputs of the selected cells.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * The widget `mode` will be preserved.
   */
  export function clearOutputs(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    each(notebook.model.cells, (cell: ICodeCellModel, index) => {
      const child = notebook.widgets[index];

      if (notebook.isSelectedOrActive(child) && cell.type === 'code') {
        cell.clearExecution();
        (child as CodeCell).outputHidden = false;
      }
    });
    Private.handleState(notebook, state, true);
  }

  /**
   * Clear all the code outputs on the widget.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * The widget `mode` will be preserved.
   */
  export function clearAllOutputs(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    each(notebook.model.cells, (cell: ICodeCellModel, index) => {
      const child = notebook.widgets[index];

      if (cell.type === 'code') {
        cell.clearExecution();
        (child as CodeCell).outputHidden = false;
      }
    });
    Private.handleState(notebook, state, true);
  }

  /**
   * Hide the code on selected code cells.
   *
   * @param notebook - The target notebook widget.
   */
  export function hideCode(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    notebook.widgets.forEach(cell => {
      if (notebook.isSelectedOrActive(cell) && cell.model.type === 'code') {
        cell.inputHidden = true;
      }
    });
    Private.handleState(notebook, state);
  }

  /**
   * Show the code on selected code cells.
   *
   * @param notebook - The target notebook widget.
   */
  export function showCode(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    notebook.widgets.forEach(cell => {
      if (notebook.isSelectedOrActive(cell) && cell.model.type === 'code') {
        cell.inputHidden = false;
      }
    });
    Private.handleState(notebook, state);
  }

  /**
   * Hide the code on all code cells.
   *
   * @param notebook - The target notebook widget.
   */
  export function hideAllCode(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    notebook.widgets.forEach(cell => {
      if (cell.model.type === 'code') {
        cell.inputHidden = true;
      }
    });
    Private.handleState(notebook, state);
  }

  /**
   * Show the code on all code cells.
   *
   * @param widget - The target notebook widget.
   */
  export function showAllCode(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    notebook.widgets.forEach(cell => {
      if (cell.model.type === 'code') {
        cell.inputHidden = false;
      }
    });
    Private.handleState(notebook, state);
  }

  /**
   * Hide the output on selected code cells.
   *
   * @param notebook - The target notebook widget.
   */
  export function hideOutput(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    notebook.widgets.forEach(cell => {
      if (notebook.isSelectedOrActive(cell) && cell.model.type === 'code') {
        (cell as CodeCell).outputHidden = true;
      }
    });
    Private.handleState(notebook, state, true);
  }

  /**
   * Show the output on selected code cells.
   *
   * @param notebook - The target notebook widget.
   */
  export function showOutput(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    notebook.widgets.forEach(cell => {
      if (notebook.isSelectedOrActive(cell) && cell.model.type === 'code') {
        (cell as CodeCell).outputHidden = false;
      }
    });
    Private.handleState(notebook, state);
  }

  /**
   * Hide the output on all code cells.
   *
   * @param notebook - The target notebook widget.
   */
  export function hideAllOutputs(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    notebook.widgets.forEach(cell => {
      if (cell.model.type === 'code') {
        (cell as CodeCell).outputHidden = true;
      }
    });
    Private.handleState(notebook, state, true);
  }

  /**
   * Render side-by-side.
   *
   * @param notebook - The target notebook widget.
   */
  export function renderSideBySide(notebook: Notebook): void {
    notebook.renderingLayout = 'side-by-side';
  }

  /**
   * Render not side-by-side.
   *
   * @param notebook - The target notebook widget.
   */
  export function renderDefault(notebook: Notebook): void {
    notebook.renderingLayout = 'default';
  }

  /**
   * Show the output on all code cells.
   *
   * @param notebook - The target notebook widget.
   */
  export function showAllOutputs(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    notebook.widgets.forEach(cell => {
      if (cell.model.type === 'code') {
        (cell as CodeCell).outputHidden = false;
      }
    });
    Private.handleState(notebook, state);
  }

  /**
   * Enable output scrolling for all selected cells.
   *
   * @param notebook - The target notebook widget.
   */
  export function enableOutputScrolling(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    notebook.widgets.forEach(cell => {
      if (notebook.isSelectedOrActive(cell) && cell.model.type === 'code') {
        (cell as CodeCell).outputsScrolled = true;
      }
    });
    Private.handleState(notebook, state, true);
  }

  /**
   * Disable output scrolling for all selected cells.
   *
   * @param notebook - The target notebook widget.
   */
  export function disableOutputScrolling(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    notebook.widgets.forEach(cell => {
      if (notebook.isSelectedOrActive(cell) && cell.model.type === 'code') {
        (cell as CodeCell).outputsScrolled = false;
      }
    });
    Private.handleState(notebook, state);
  }

  /**
   * Go to the last cell that is run or current if it is running.
   *
   * Note: This requires execution timing to be toggled on or this will have
   * no effect.
   *
   * @param notebook - The target notebook widget.
   */
  export function selectLastRunCell(notebook: Notebook): void {
    let latestTime: Date | null = null;
    let latestCellIdx: number | null = null;
    notebook.widgets.forEach((cell, cellIndx) => {
      if (cell.model.type === 'code') {
        const execution = (cell as CodeCell).model.metadata.get('execution');
        if (
          execution &&
          JSONExt.isObject(execution) &&
          execution['iopub.status.busy'] !== undefined
        ) {
          // The busy status is used as soon as a request is received:
          // https://jupyter-client.readthedocs.io/en/stable/messaging.html
          const timestamp = execution['iopub.status.busy']!.toString();
          if (timestamp) {
            const startTime = new Date(timestamp);
            if (!latestTime || startTime >= latestTime) {
              latestTime = startTime;
              latestCellIdx = cellIndx;
            }
          }
        }
      }
    });
    if (latestCellIdx !== null) {
      notebook.activeCellIndex = latestCellIdx;
    }
  }

  /**
   * Set the markdown header level.
   *
   * @param notebook - The target notebook widget.
   *
   * @param level - The header level.
   *
   * #### Notes
   * All selected cells will be switched to markdown.
   * The level will be clamped between 1 and 6.
   * If there is an existing header, it will be replaced.
   * There will always be one blank space after the header.
   * The cells will be unrendered.
   */
  export function setMarkdownHeader(notebook: Notebook, level: number): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);
    const cells = notebook.model.cells;

    level = Math.min(Math.max(level, 1), 6);
    notebook.widgets.forEach((child, index) => {
      if (notebook.isSelectedOrActive(child)) {
        Private.setMarkdownHeader(cells.get(index), level);
      }
    });
    Private.changeCellType(notebook, 'markdown');
    Private.handleState(notebook, state);
  }

  /**
   * Collapse all cells in given notebook.
   *
   * @param notebook - The target notebook widget.
   */
  export function collapseAllHeadings(notebook: Notebook): any {
    for (const cell of notebook.widgets) {
      if (NotebookActions.getHeadingInfo(cell).isHeading) {
        NotebookActions.setHeadingCollapse(cell, true, notebook);
        NotebookActions.setCellCollapse(cell, true);
      }
    }
  }

  /**
   * Un-collapse all cells in given notebook.
   *
   * @param notebook - The target notebook widget.
   */
  export function expandAllHeadings(notebook: Notebook): any {
    for (const cell of notebook.widgets) {
      if (NotebookActions.getHeadingInfo(cell).isHeading) {
        NotebookActions.setHeadingCollapse(cell, false, notebook);
        // similar to collapseAll.
        NotebookActions.setCellCollapse(cell, false);
      }
    }
  }

  function findNearestParentHeader(
    cell: Cell,
    notebook: Notebook
  ): Cell | undefined {
    const index = findIndex(
      notebook.widgets,
      (possibleCell: Cell, index: number) => {
        return cell.model.id === possibleCell.model.id;
      }
    );
    if (index === -1) {
      return;
    }
    // Finds the nearest header above the given cell. If the cell is a header itself, it does not return itself;
    // this can be checked directly by calling functions.
    if (index >= notebook.widgets.length) {
      return;
    }
    let childHeaderInfo = getHeadingInfo(notebook.widgets[index]);
    for (let cellN = index - 1; cellN >= 0; cellN--) {
      if (cellN < notebook.widgets.length) {
        let hInfo = getHeadingInfo(notebook.widgets[cellN]);
        if (
          hInfo.isHeading &&
          hInfo.headingLevel < childHeaderInfo.headingLevel
        ) {
          return notebook.widgets[cellN];
        }
      }
    }
    // else no parent header found.
    return;
  }

  /**
   * Finds the "parent" heading of the given cell and expands.
   * Used for the case that a cell becomes active that is within a collapsed heading.
   * @param cell - "Child" cell that has become the active cell
   * @param notebook - The target notebook widget.
   */
  export function expandParent(cell: Cell, notebook: Notebook): void {
    let nearestParentCell = findNearestParentHeader(cell, notebook);
    if (!nearestParentCell) {
      return;
    }
    if (
      !getHeadingInfo(nearestParentCell).collapsed &&
      !nearestParentCell.isHidden
    ) {
      return;
    }
    if (nearestParentCell.isHidden) {
      expandParent(nearestParentCell, notebook);
    }
    if (getHeadingInfo(nearestParentCell).collapsed) {
      setHeadingCollapse(nearestParentCell, false, notebook);
    }
  }

  /**
   * Finds the next heading that isn't a child of the given markdown heading.
   * @param cell - "Child" cell that has become the active cell
   * @param notebook - The target notebook widget.
   */
  export function findNextParentHeading(
    cell: Cell,
    notebook: Notebook
  ): number {
    let index = findIndex(
      notebook.widgets,
      (possibleCell: Cell, index: number) => {
        return cell.model.id === possibleCell.model.id;
      }
    );
    if (index === -1) {
      return -1;
    }
    let childHeaderInfo = getHeadingInfo(cell);
    for (index = index + 1; index < notebook.widgets.length; index++) {
      let hInfo = getHeadingInfo(notebook.widgets[index]);
      if (
        hInfo.isHeading &&
        hInfo.headingLevel <= childHeaderInfo.headingLevel
      ) {
        return index;
      }
    }
    // else no parent header found. return the index of the last cell
    return notebook.widgets.length;
  }

  /**
   * Set the given cell and ** all "child" cells **
   * to the given collapse / expand if cell is
   * a markdown header.
   *
   * @param cell - The cell
   * @param collapsing - Whether to collapse or expand the cell
   * @param notebook - The target notebook widget.
   */
  export function setHeadingCollapse(
    cell: Cell,
    collapsing: boolean,
    notebook: StaticNotebook
  ): number {
    const which = findIndex(
      notebook.widgets,
      (possibleCell: Cell, index: number) => {
        return cell.model.id === possibleCell.model.id;
      }
    );
    if (which === -1) {
      return -1;
    }
    if (!notebook.widgets.length) {
      return which + 1;
    }
    let selectedHeadingInfo = NotebookActions.getHeadingInfo(cell);
    if (
      cell.isHidden ||
      !(cell instanceof MarkdownCell) ||
      !selectedHeadingInfo.isHeading
    ) {
      // otherwise collapsing and uncollapsing already hidden stuff can
      // cause some funny looking bugs.
      return which + 1;
    }
    let localCollapsed = false;
    let localCollapsedLevel = 0;
    // iterate through all cells after the active cell.
    let cellNum;
    for (cellNum = which + 1; cellNum < notebook.widgets.length; cellNum++) {
      let subCell = notebook.widgets[cellNum];
      let subCellHeadingInfo = NotebookActions.getHeadingInfo(subCell);
      if (
        subCellHeadingInfo.isHeading &&
        subCellHeadingInfo.headingLevel <= selectedHeadingInfo.headingLevel
      ) {
        // then reached an equivalent or higher heading level than the
        // original the end of the collapse.
        cellNum -= 1;
        break;
      }
      if (
        localCollapsed &&
        subCellHeadingInfo.isHeading &&
        subCellHeadingInfo.headingLevel <= localCollapsedLevel
      ) {
        // then reached the end of the local collapsed, so unset NotebookActions.
        localCollapsed = false;
      }

      if (collapsing || localCollapsed) {
        // then no extra handling is needed for further locally collapsed
        // headings.
        subCell.setHidden(true);
        continue;
      }

      if (subCellHeadingInfo.collapsed && subCellHeadingInfo.isHeading) {
        localCollapsed = true;
        localCollapsedLevel = subCellHeadingInfo.headingLevel;
        // but don't collapse the locally collapsed heading, so continue to
        // expand the heading. This will get noticed in the next round.
      }
      subCell.setHidden(false);
    }
    if (cellNum === notebook.widgets.length) {
      cell.numberChildNodes = cellNum - which - 1;
    } else {
      cell.numberChildNodes = cellNum - which;
    }
    NotebookActions.setCellCollapse(cell, collapsing);
    return cellNum + 1;
  }

  /**
   * Toggles the collapse state of the active cell of the given notebook
   * and ** all of its "child" cells ** if the cell is a heading.
   *
   * @param notebook - The target notebook widget.
   */
  export function toggleCurrentHeadingCollapse(notebook: Notebook): any {
    if (!notebook.activeCell || notebook.activeCellIndex === undefined) {
      return;
    }
    let headingInfo = NotebookActions.getHeadingInfo(notebook.activeCell);
    if (headingInfo.isHeading) {
      // Then toggle!
      NotebookActions.setHeadingCollapse(
        notebook.activeCell,
        !headingInfo.collapsed,
        notebook
      );
    }
    ElementExt.scrollIntoViewIfNeeded(notebook.node, notebook.activeCell.node);
  }

  /**
   * If cell is a markdown heading, sets the headingCollapsed field,
   * and otherwise hides the cell.
   *
   * @param cell - The cell to collapse / expand
   * @param collapsing - Whether to collapse or expand the given cell
   */
  export function setCellCollapse(cell: Cell, collapsing: boolean): any {
    if (cell instanceof MarkdownCell) {
      cell.headingCollapsed = collapsing;
    } else {
      cell.setHidden(collapsing);
    }
  }

  /**
   * If given cell is a markdown heading, returns the heading level.
   * If given cell is not markdown, returns 7 (there are only 6 levels of markdown headings)
   *
   * @param cell - The target cell widget.
   */
  export function getHeadingInfo(cell: Cell): {
    isHeading: boolean;
    headingLevel: number;
    collapsed?: boolean;
  } {
    if (!(cell instanceof MarkdownCell)) {
      return { isHeading: false, headingLevel: 7 };
    }
    let level = cell.headingInfo.level;
    let collapsed = cell.headingCollapsed;
    return { isHeading: level > 0, headingLevel: level, collapsed: collapsed };
  }

  /**
   * Trust the notebook after prompting the user.
   *
   * @param notebook - The target notebook widget.
   *
   * @returns a promise that resolves when the transaction is finished.
   *
   * #### Notes
   * No dialog will be presented if the notebook is already trusted.
   */
  export function trust(
    notebook: Notebook,
    translator?: ITranslator
  ): Promise<void> {
    translator = translator || nullTranslator;
    const trans = translator.load('jupyterlab');

    if (!notebook.model) {
      return Promise.resolve();
    }
    // Do nothing if already trusted.

    const cells = toArray(notebook.model.cells);
    const trusted = cells.every(cell => cell.trusted);
    // FIXME
    const trustMessage = (
      <p>
        {trans.__(
          'A trusted Jupyter notebook may execute hidden malicious code when you open it.'
        )}
        <br />
        {trans.__(
          'Selecting "Trust" will re-render this notebook in a trusted state.'
        )}
        <br />
        {trans.__('For more information, see')}{' '}
        <a
          href="https://jupyter-server.readthedocs.io/en/stable/operators/security.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          {trans.__('the Jupyter security documentation')}
        </a>
        .
      </p>
    );

    if (trusted) {
      return showDialog({
        body: trans.__('Notebook is already trusted'),
        buttons: [Dialog.okButton()]
      }).then(() => undefined);
    }

    return showDialog({
      body: trustMessage,
      title: trans.__('Trust this notebook?'),
      buttons: [
        Dialog.cancelButton(),
        Dialog.warnButton({ label: trans.__('Trust') })
      ] // FIXME?
    }).then(result => {
      if (result.button.accept) {
        cells.forEach(cell => {
          cell.trusted = true;
        });
      }
    });
  }
}

/**
 * A namespace for private data.
 */
namespace Private {
  /**
   * A signal that emits whenever a cell completes execution.
   */
  export const executed = new Signal<
    any,
    {
      notebook: Notebook;
      cell: Cell;
      success: boolean;
      error?: KernelError | null;
    }
  >({});

  /**
   * A signal that emits whenever a cell execution is scheduled.
   */
  export const executionScheduled = new Signal<
    any,
    { notebook: Notebook; cell: Cell }
  >({});

  /**
   * A signal that emits when one notebook's cells are all executed.
   */
  export const selectionExecuted = new Signal<
    any,
    { notebook: Notebook; lastCell: Cell }
  >({});

  /**
   * The interface for a widget state.
   */
  export interface IState {
    /**
     * Whether the widget had focus.
     */
    wasFocused: boolean;

    /**
     * The active cell before the action.
     */
    activeCell: Cell | null;
  }

  export function isNotebookRendered(notebook: Notebook): boolean {
    const translator = notebook.translator;
    const trans = translator.load('jupyterlab');

    if (notebook.remainingCellToRenderCount !== 0) {
      showDialog({
        body: trans.__(
          `Notebook is still rendering and has for now (%1) remaining cells to render.

Please wait for the complete rendering before invoking that action.`,
          notebook.remainingCellToRenderCount
        ),
        buttons: [Dialog.okButton()]
      }).catch(reason => {
        console.error(
          'An error occurred when displaying notebook rendering warning',
          reason
        );
      });
      return false;
    }
    return true;
  }

  /**
   * Get the state of a widget before running an action.
   */
  export function getState(notebook: Notebook): IState {
    return {
      wasFocused: notebook.node.contains(document.activeElement),
      activeCell: notebook.activeCell
    };
  }

  /**
   * Handle the state of a widget after running an action.
   */
  export function handleState(
    notebook: Notebook,
    state: IState,
    scrollIfNeeded = false
  ): void {
    const { activeCell, node } = notebook;

    if (state.wasFocused || notebook.mode === 'edit') {
      notebook.activate();
    }

    if (scrollIfNeeded && activeCell) {
      ElementExt.scrollIntoViewIfNeeded(node, activeCell.node);
    }
  }

  /**
   * Handle the state of a widget after running a run action.
   */
  export function handleRunState(
    notebook: Notebook,
    state: IState,
    scroll = false
  ): void {
    if (state.wasFocused || notebook.mode === 'edit') {
      notebook.activate();
    }
    if (scroll && state.activeCell) {
      // Scroll to the top of the previous active cell output.
      const rect = state.activeCell.inputArea.node.getBoundingClientRect();

      notebook.scrollToPosition(rect.bottom, 45);
    }
  }

  /**
   * Clone a cell model.
   */
  export function cloneCell(
    model: INotebookModel,
    cell: ICellModel
  ): ICellModel {
    switch (cell.type) {
      case 'code':
        // TODO why isn't modeldb or id passed here?
        return model.contentFactory.createCodeCell({ cell: cell.toJSON() });
      case 'markdown':
        // TODO why isn't modeldb or id passed here?
        return model.contentFactory.createMarkdownCell({ cell: cell.toJSON() });
      default:
        // TODO why isn't modeldb or id passed here?
        return model.contentFactory.createRawCell({ cell: cell.toJSON() });
    }
  }

  /**
   * Run the selected cells.
   */
  export function runSelected(
    notebook: Notebook,
    sessionContext?: ISessionContext
  ): Promise<boolean> {
    notebook.mode = 'command';

    let lastIndex = notebook.activeCellIndex;
    const selected = notebook.widgets.filter((child, index) => {
      const active = notebook.isSelectedOrActive(child);

      if (active) {
        lastIndex = index;
      }

      return active;
    });

    notebook.activeCellIndex = lastIndex;
    notebook.deselectAll();

    return Promise.all(
      selected.map(child => runCell(notebook, child, sessionContext))
    )
      .then(results => {
        if (notebook.isDisposed) {
          return false;
        }
        selectionExecuted.emit({
          notebook,
          lastCell: notebook.widgets[lastIndex]
        });
        // Post an update request.
        notebook.update();

        return results.every(result => result);
      })
      .catch(reason => {
        if (reason.message.startsWith('KernelReplyNotOK')) {
          selected.map(cell => {
            // Remove '*' prompt from cells that didn't execute
            if (
              cell.model.type === 'code' &&
              (cell as CodeCell).model.executionCount == null
            ) {
              cell.setPrompt('');
            }
          });
        } else {
          throw reason;
        }

        selectionExecuted.emit({
          notebook,
          lastCell: notebook.widgets[lastIndex]
        });

        notebook.update();

        return false;
      });
  }

  /**
   * Run a cell.
   */
  function runCell(
    notebook: Notebook,
    cell: Cell,
    sessionContext?: ISessionContext,
    translator?: ITranslator
  ): Promise<boolean> {
    translator = translator || nullTranslator;
    const trans = translator.load('jupyterlab');
    switch (cell.model.type) {
      case 'markdown':
        (cell as MarkdownCell).rendered = true;
        cell.inputHidden = false;
        executed.emit({ notebook, cell, success: true });
        break;
      case 'code':
        if (sessionContext) {
          if (sessionContext.isTerminating) {
            void showDialog({
              title: trans.__('Kernel Terminating'),
              body: trans.__(
                'The kernel for %1 appears to be terminating. You can not run any cell for now.',
                sessionContext.session?.path
              ),
              buttons: [Dialog.okButton()]
            });
            break;
          }
          if (sessionContext.pendingInput) {
            void showDialog({
              title: trans.__('Cell not executed due to pending input'),
              body: trans.__(
                'The cell has not been executed to avoid kernel deadlock as there is another pending input! Submit your pending input and try again.'
              ),
              buttons: [Dialog.okButton()]
            });
            return Promise.resolve(false);
          }
          if (sessionContext.hasNoKernel) {
            void sessionContextDialogs.selectKernel(sessionContext);
            return Promise.resolve(false);
          }
          const deletedCells = notebook.model?.deletedCells ?? [];
          executionScheduled.emit({ notebook, cell });
          return CodeCell.execute(cell as CodeCell, sessionContext, {
            deletedCells,
            recordTiming: notebook.notebookConfig.recordTiming
          })
            .then(reply => {
              deletedCells.splice(0, deletedCells.length);
              if (cell.isDisposed) {
                return false;
              }

              if (!reply) {
                return true;
              }
              if (reply.content.status === 'ok') {
                const content = reply.content;

                if (content.payload && content.payload.length) {
                  handlePayload(content, notebook, cell);
                }

                return true;
              } else {
                throw new KernelError(reply.content);
              }
            })
            .catch(reason => {
              if (cell.isDisposed || reason.message.startsWith('Canceled')) {
                return false;
              }
              executed.emit({ notebook, cell, success: false, error: reason });
              throw reason;
            })
            .then(ran => {
              if (ran) {
                executed.emit({ notebook, cell, success: true });
              }

              return ran;
            });
        }
        (cell.model as ICodeCellModel).clearExecution();
        break;
      default:
        break;
    }

    return Promise.resolve(true);
  }

  /**
   * Handle payloads from an execute reply.
   *
   * #### Notes
   * Payloads are deprecated and there are no official interfaces for them in
   * the kernel type definitions.
   * See [Payloads (DEPRECATED)](https://jupyter-client.readthedocs.io/en/latest/messaging.html#payloads-deprecated).
   */
  function handlePayload(
    content: KernelMessage.IExecuteReply,
    notebook: Notebook,
    cell: Cell
  ) {
    const setNextInput = content.payload?.filter(i => {
      return (i as any).source === 'set_next_input';
    })[0];

    if (!setNextInput) {
      return;
    }

    const text = setNextInput.text as string;
    const replace = setNextInput.replace;

    if (replace) {
      cell.model.value.text = text;
      return;
    }

    // Create a new code cell and add as the next cell.
    const newCell = notebook.model!.contentFactory.createCodeCell({});
    const cells = notebook.model!.cells;
    const index = ArrayExt.firstIndexOf(toArray(cells), cell.model);

    newCell.value.text = text;
    if (index === -1) {
      cells.push(newCell);
    } else {
      cells.insert(index + 1, newCell);
    }
  }

  /**
   * Get the selected cell(s) without affecting the clipboard.
   *
   * @param notebook - The target notebook widget.
   *
   * @returns A list of 0 or more selected cells
   */
  export function selectedCells(notebook: Notebook): nbformat.ICell[] {
    return notebook.widgets
      .filter(cell => notebook.isSelectedOrActive(cell))
      .map(cell => cell.model.toJSON())
      .map(cellJSON => {
        if ((cellJSON.metadata as JSONObject).deletable !== undefined) {
          delete (cellJSON.metadata as JSONObject).deletable;
        }
        return cellJSON;
      });
  }

  /**
   * Copy or cut the selected cell data to the application clipboard.
   *
   * @param notebook - The target notebook widget.
   *
   * @param cut - True if the cells should be cut, false if they should be copied.
   */
  export function copyOrCut(notebook: Notebook, cut: boolean): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = getState(notebook);
    const clipboard = Clipboard.getInstance();

    notebook.mode = 'command';
    clipboard.clear();

    const data = Private.selectedCells(notebook);

    clipboard.setData(JUPYTER_CELL_MIME, data);
    if (cut) {
      deleteCells(notebook);
    } else {
      notebook.deselectAll();
    }
    if (cut) {
      notebook.lastClipboardInteraction = 'cut';
    } else {
      notebook.lastClipboardInteraction = 'copy';
    }
    handleState(notebook, state);
  }

  /**
   * Change the selected cell type(s).
   *
   * @param notebook - The target notebook widget.
   *
   * @param value - The target cell type.
   *
   * #### Notes
   * It should preserve the widget mode.
   * This action can be undone.
   * The existing selection will be cleared.
   * Any cells converted to markdown will be unrendered.
   */
  export function changeCellType(
    notebook: Notebook,
    value: nbformat.CellType
  ): void {
    const model = notebook.model!;
    const cells = model.cells;

    cells.beginCompoundOperation();
    notebook.widgets.forEach((child, index) => {
      if (!notebook.isSelectedOrActive(child)) {
        return;
      }
      if (child.model.type !== value) {
        const cell = child.model.toJSON();
        let newCell: ICellModel;

        switch (value) {
          case 'code':
            newCell = model.contentFactory.createCodeCell({ cell });
            break;
          case 'markdown':
            newCell = model.contentFactory.createMarkdownCell({ cell });
            if (child.model.type === 'code') {
              newCell.trusted = false;
            }
            break;
          default:
            newCell = model.contentFactory.createRawCell({ cell });
            if (child.model.type === 'code') {
              newCell.trusted = false;
            }
        }
        cells.set(index, newCell);
      }
      if (value === 'markdown') {
        // Fetch the new widget and unrender it.
        child = notebook.widgets[index];
        (child as MarkdownCell).rendered = false;
      }
    });
    cells.endCompoundOperation();
    notebook.deselectAll();
  }

  /**
   * Delete the selected cells.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * The cell after the last selected cell will be activated.
   * If the last cell is deleted, then the previous one will be activated.
   * It will add a code cell if all cells are deleted.
   * This action can be undone.
   */
  export function deleteCells(notebook: Notebook): void {
    const model = notebook.model!;
    const cells = model.cells;
    const toDelete: number[] = [];

    notebook.mode = 'command';

    // Find the cells to delete.
    notebook.widgets.forEach((child, index) => {
      const deletable = child.model.metadata.get('deletable') !== false;

      if (notebook.isSelectedOrActive(child) && deletable) {
        toDelete.push(index);
        model.deletedCells.push(child.model.id);
      }
    });

    // If cells are not deletable, we may not have anything to delete.
    if (toDelete.length > 0) {
      // Delete the cells as one undo event.
      cells.beginCompoundOperation();
      // Delete cells in reverse order to maintain the correct indices.
      toDelete.reverse().forEach(index => {
        cells.remove(index);
      });
      // Add a new cell if the notebook is empty. This is done
      // within the compound operation to make the deletion of
      // a notebook's last cell undoable.
      if (!cells.length) {
        cells.push(
          model.contentFactory.createCell(
            notebook.notebookConfig.defaultCell,
            {}
          )
        );
      }
      cells.endCompoundOperation();

      // Select the *first* interior cell not deleted or the cell
      // *after* the last selected cell.
      // Note: The activeCellIndex is clamped to the available cells,
      // so if the last cell is deleted the previous cell will be activated.
      // The *first* index is the index of the last cell in the initial
      // toDelete list due to the `reverse` operation above.
      notebook.activeCellIndex = toDelete[0] - toDelete.length + 1;
    }

    // Deselect any remaining, undeletable cells. Do this even if we don't
    // delete anything so that users are aware *something* happened.
    notebook.deselectAll();
  }

  /**
   * Set the markdown header level of a cell.
   */
  export function setMarkdownHeader(cell: ICellModel, level: number): void {
    // Remove existing header or leading white space.
    let source = cell.value.text;
    const regex = /^(#+\s*)|^(\s*)/;
    const newHeader = Array(level + 1).join('#') + ' ';
    const matches = regex.exec(source);

    if (matches) {
      source = source.slice(matches[0].length);
    }
    cell.value.text = newHeader + source;
  }

  /** Functionality related to collapsible headings */
  export namespace Headings {
    /** Find the heading that is parent to cell.
     *
     * @param childCell - The cell that is child to the sought heading
     * @param notebook - The target notebook widget
     * @param includeChildCell [default=false] - if set to true and childCell is a heading itself, the childCell will be returned
     * @param returnIndex [default=false] - if set to true, the cell index is returned rather than the cell object.
     *
     * @returns the (index | Cell object) of the parent heading or (-1 | null) if there is no parent heading.
     */
    export function findParentHeading(
      childCell: Cell,
      notebook: Notebook,
      includeChildCell = false,
      returnIndex = false
    ): number | Cell | null {
      let cellIdx =
        notebook.widgets.indexOf(childCell) - (includeChildCell ? 1 : 0);
      while (cellIdx >= 0) {
        let headingInfo = NotebookActions.getHeadingInfo(
          notebook.widgets[cellIdx]
        );
        if (headingInfo.isHeading) {
          return returnIndex ? cellIdx : notebook.widgets[cellIdx];
        }
        cellIdx--;
      }
      return returnIndex ? -1 : null;
    }

    /** Find heading above with leq level than baseCell heading level.
     *
     * @param baseCell - cell relative to which so search
     * @param notebook - target notebook widget
     * @param returnIndex [default=false] - if set to true, the cell index is returned rather than the cell object.
     *
     * @returns the (index | Cell object) of the found heading or (-1 | null) if no heading found.
     */
    export function findLowerEqualLevelParentHeadingAbove(
      baseCell: Cell,
      notebook: Notebook,
      returnIndex = false
    ): number | Cell | null {
      let baseHeadingLevel = Private.Headings.determineHeadingLevel(
        baseCell,
        notebook
      );
      if (baseHeadingLevel == -1) {
        baseHeadingLevel = 1; // if no heading level can be determined, assume we're on level 1
      }

      // find the heading above with heading level <= baseHeadingLevel and return its index
      let cellIdx = notebook.widgets.indexOf(baseCell) - 1;
      while (cellIdx >= 0) {
        let cell = notebook.widgets[cellIdx];
        let headingInfo = NotebookActions.getHeadingInfo(cell);
        if (
          headingInfo.isHeading &&
          headingInfo.headingLevel <= baseHeadingLevel
        ) {
          return returnIndex ? cellIdx : cell;
        }
        cellIdx--;
      }
      return returnIndex ? -1 : null; // no heading found
    }

    /** Find next heading with equal or lower level.
     *
     * @param baseCell - cell relative to which so search
     * @param notebook - target notebook widget
     * @param returnIndex [default=false] - if set to true, the cell index is returned rather than the cell object.
     *
     * @returns the (index | Cell object) of the found heading or (-1 | null) if no heading found.
     */
    export function findLowerEqualLevelHeadingBelow(
      baseCell: Cell,
      notebook: Notebook,
      returnIndex = false
    ): number | Cell | null {
      let baseHeadingLevel = Private.Headings.determineHeadingLevel(
        baseCell,
        notebook
      );
      if (baseHeadingLevel == -1) {
        baseHeadingLevel = 1; // if no heading level can be determined, assume we're on level 1
      }
      let cellIdx = notebook.widgets.indexOf(baseCell) + 1;
      while (cellIdx < notebook.widgets.length) {
        let cell = notebook.widgets[cellIdx];
        let headingInfo = NotebookActions.getHeadingInfo(cell);
        if (
          headingInfo.isHeading &&
          headingInfo.headingLevel <= baseHeadingLevel
        ) {
          return returnIndex ? cellIdx : cell;
        }
        cellIdx++;
      }
      return returnIndex ? -1 : null;
    }

    /** Find next heading.
     *
     * @param baseCell - cell relative to which so search
     * @param notebook - target notebook widget
     * @param returnIndex [default=false] - if set to true, the cell index is returned rather than the cell object.
     *
     * @returns the (index | Cell object) of the found heading or (-1 | null) if no heading found.
     */
    export function findHeadingBelow(
      baseCell: Cell,
      notebook: Notebook,
      returnIndex = false
    ): number | Cell | null {
      let cellIdx = notebook.widgets.indexOf(baseCell) + 1;
      while (cellIdx < notebook.widgets.length) {
        let cell = notebook.widgets[cellIdx];
        let headingInfo = NotebookActions.getHeadingInfo(cell);
        if (headingInfo.isHeading) {
          return returnIndex ? cellIdx : cell;
        }
        cellIdx++;
      }
      return returnIndex ? -1 : null;
    }

    /** Determine the heading level of a cell.
     *
     * @param baseCell - The cell of which the heading level shall be determined
     * @param notebook - The target notebook widget
     *
     * @returns the heading level or -1 if there is no parent heading
     *
     * #### Notes
     * If the baseCell is a heading itself, the heading level of baseCell is returned.
     * If the baseCell is not a heading itself, the level of the parent heading is returned.
     * If there is no parent heading, -1 is returned.
     */
    export function determineHeadingLevel(
      baseCell: Cell,
      notebook: Notebook
    ): number {
      let headingInfoBaseCell = NotebookActions.getHeadingInfo(baseCell);
      // fill baseHeadingLevel or return null if there is no heading at or above baseCell
      if (headingInfoBaseCell.isHeading) {
        return headingInfoBaseCell.headingLevel;
      } else {
        let parentHeading = findParentHeading(
          baseCell,
          notebook,
          true
        ) as Cell | null;
        if (parentHeading == null) {
          return -1;
        }
        return NotebookActions.getHeadingInfo(parentHeading).headingLevel;
      }
    }

    /** Insert a new heading cell at given position.
     *
     * @param cellIndex - where to insert
     * @param headingLevel - level of the new heading
     * @param notebook - target notebook
     *
     * #### Notes
     * Enters edit mode after insert.
     */
    export function insertHeadingAboveCellIndex(
      cellIndex: number,
      headingLevel: number,
      notebook: Notebook
    ) {
      const state = Private.getState(notebook);
      const newCell = notebook.model!.contentFactory.createMarkdownCell({});
      notebook.model!.cells.insert(cellIndex, newCell);
      Private.setMarkdownHeader(newCell, headingLevel);
      notebook.activeCellIndex = cellIndex;
      notebook.deselectAll();
      Private.handleState(notebook, state, true);
      notebook.mode = 'edit';
      notebook.widgets[cellIndex].setHidden(false);
    }
  }
}
