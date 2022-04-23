// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { Widget } from '@lumino/widgets';
import { Dialog, showDialog } from './dialog';
import { Styling } from './styling';

const INPUT_DIALOG_CLASS = 'jp-Input-Dialog';

const INPUT_BOOLEAN_DIALOG_CLASS = 'jp-Input-Boolean-Dialog';

/**
 * Namespace for input dialogs
 */
export namespace InputDialog {
  /**
   * Common constructor options for input dialogs
   */
  export interface IOptions {
    /**
     * The top level text for the dialog.  Defaults to an empty string.
     */
    title: Dialog.Header;

    /**
     * The host element for the dialog. Defaults to `document.body`.
     */
    host?: HTMLElement;

    /**
     * Label of the requested input
     */
    label?: string;

    /**
     * An optional renderer for dialog items.  Defaults to a shared
     * default renderer.
     */
    renderer?: Dialog.IRenderer;

    /**
     * Label for ok button.
     */
    okLabel?: string;

    /**
     * Label for cancel button.
     */
    cancelLabel?: string;
  }

  /**
   * Constructor options for boolean input dialogs
   */
  export interface IBooleanOptions extends IOptions {
    /**
     * Default value
     */
    value?: boolean;
  }

  /**
   * Create and show a input dialog for a boolean.
   *
   * @param options - The dialog setup options.
   *
   * @returns A promise that resolves with whether the dialog was accepted
   */
  export function getBoolean(
    options: IBooleanOptions
  ): Promise<Dialog.IResult<boolean>> {
    return showDialog({
      ...options,
      body: new InputBooleanDialog(options),
      buttons: [
        Dialog.cancelButton({ label: options.cancelLabel }),
        Dialog.okButton({ label: options.okLabel })
      ],
      focusNodeSelector: 'input'
    });
  }

  /**
   * Constructor options for number input dialogs
   */
  export interface INumberOptions extends IOptions {
    /**
     * Default value
     */
    value?: number;
  }

  /**
   * Create and show a input dialog for a number.
   *
   * @param options - The dialog setup options.
   *
   * @returns A promise that resolves with whether the dialog was accepted
   */
  export function getNumber(
    options: INumberOptions
  ): Promise<Dialog.IResult<number>> {
    return showDialog({
      ...options,
      body: new InputNumberDialog(options),
      buttons: [
        Dialog.cancelButton({ label: options.cancelLabel }),
        Dialog.okButton({ label: options.okLabel })
      ],
      focusNodeSelector: 'input'
    });
  }

  /**
   * Constructor options for item selection input dialogs
   */
  export interface IItemOptions extends IOptions {
    /**
     * List of choices
     */
    items: Array<string>;
    /**
     * Default choice
     *
     * If the list is editable a string with a default value can be provided
     * otherwise the index of the default choice should be given.
     */
    current?: number | string;
    /**
     * Is the item editable?
     */
    editable?: boolean;
    /**
     * Placeholder text for editable input
     */
    placeholder?: string;
  }

  /**
   * Create and show a input dialog for a choice.
   *
   * @param options - The dialog setup options.
   *
   * @returns A promise that resolves with whether the dialog was accepted
   */
  export function getItem(
    options: IItemOptions
  ): Promise<Dialog.IResult<string>> {
    return showDialog({
      ...options,
      body: new InputItemsDialog(options),
      buttons: [
        Dialog.cancelButton({ label: options.cancelLabel }),
        Dialog.okButton({ label: options.okLabel })
      ],
      focusNodeSelector: options.editable ? 'input' : 'select'
    });
  }

  /**
   * Constructor options for text input dialogs
   */
  export interface ITextOptions extends IOptions {
    /**
     * Default input text
     */
    text?: string;
    /**
     * Placeholder text
     */
    placeholder?: string;
  }

  /**
   * Create and show a input dialog for a text.
   *
   * @param options - The dialog setup options.
   *
   * @returns A promise that resolves with whether the dialog was accepted
   */
  export function getText(
    options: ITextOptions
  ): Promise<Dialog.IResult<string>> {
    return showDialog({
      ...options,
      body: new InputTextDialog(options),
      buttons: [
        Dialog.cancelButton({ label: options.cancelLabel }),
        Dialog.okButton({ label: options.okLabel })
      ],
      focusNodeSelector: 'input'
    });
  }

  /**
   * Create and show a input dialog for a password.
   *
   * @param options - The dialog setup options.
   *
   * @returns A promise that resolves with whether the dialog was accepted
   */
  export function getPassword(
    options: ITextOptions
  ): Promise<Dialog.IResult<string>> {
    return showDialog({
      ...options,
      body: new InputPasswordDialog(options),
      buttons: [
        Dialog.cancelButton({ label: options.cancelLabel }),
        Dialog.okButton({ label: options.okLabel })
      ],
      focusNodeSelector: 'input'
    });
  }
}

/**
 * Base widget for input dialog body
 */
class InputDialogBase<T> extends Widget implements Dialog.IBodyWidget<T> {
  /**
   * InputDialog constructor
   *
   * @param label Input field label
   */
  constructor(label?: string) {
    super();
    this.addClass(INPUT_DIALOG_CLASS);

    this._input = document.createElement('input');
    this._input.classList.add('jp-mod-styled');
    this._input.id = 'jp-dialog-input-id';

    if (label !== undefined) {
      const labelElement = document.createElement('label');
      labelElement.textContent = label;
      labelElement.htmlFor = this._input.id;

      // Initialize the node
      this.node.appendChild(labelElement);
    }

    this.node.appendChild(this._input);
  }

  /** Input HTML node */
  protected _input: HTMLInputElement;
}

/**
 * Widget body for input boolean dialog
 */
class InputBooleanDialog extends InputDialogBase<boolean> {
  /**
   * InputBooleanDialog constructor
   *
   * @param options Constructor options
   */
  constructor(options: InputDialog.IBooleanOptions) {
    super(options.label);
    this.addClass(INPUT_BOOLEAN_DIALOG_CLASS);

    this._input.type = 'checkbox';
    this._input.checked = options.value ? true : false;
  }

  /**
   * Get the text specified by the user
   */
  getValue(): boolean {
    return this._input.checked;
  }
}

/**
 * Widget body for input number dialog
 */
class InputNumberDialog extends InputDialogBase<number> {
  /**
   * InputNumberDialog constructor
   *
   * @param options Constructor options
   */
  constructor(options: InputDialog.INumberOptions) {
    super(options.label);

    this._input.type = 'number';
    this._input.value = options.value ? options.value.toString() : '0';
  }

  /**
   * Get the number specified by the user.
   */
  getValue(): number {
    if (this._input.value) {
      return Number(this._input.value);
    } else {
      return Number.NaN;
    }
  }
}

/**
 * Widget body for input text dialog
 */
class InputTextDialog extends InputDialogBase<string> {
  /**
   * InputTextDialog constructor
   *
   * @param options Constructor options
   */
  constructor(options: InputDialog.ITextOptions) {
    super(options.label);

    this._input.type = 'text';
    this._input.value = options.text ? options.text : '';
    if (options.placeholder) {
      this._input.placeholder = options.placeholder;
    }
  }

  /**
   * Get the text specified by the user
   */
  getValue(): string {
    return this._input.value;
  }
}

/**
 * Widget body for input password dialog
 */
class InputPasswordDialog extends InputDialogBase<string> {
  /**
   * InputPasswordDialog constructor
   *
   * @param options Constructor options
   */
  constructor(options: InputDialog.ITextOptions) {
    super(options.label);

    this._input.type = 'password';
    this._input.value = options.text ? options.text : '';
    if (options.placeholder) {
      this._input.placeholder = options.placeholder;
    }
  }

  /**
   * Get the text specified by the user
   */
  getValue(): string {
    return this._input.value;
  }
}

/**
 * Widget body for input list dialog
 */
class InputItemsDialog extends InputDialogBase<string> {
  /**
   * InputItemsDialog constructor
   *
   * @param options Constructor options
   */
  constructor(options: InputDialog.IItemOptions) {
    super(options.label);

    this._editable = options.editable || false;

    let current = options.current || 0;
    let defaultIndex: number;
    if (typeof current === 'number') {
      defaultIndex = Math.max(0, Math.min(current, options.items.length - 1));
      current = '';
    }

    this._list = document.createElement('select');
    options.items.forEach((item, index) => {
      const option = document.createElement('option');
      if (index === defaultIndex) {
        option.selected = true;
        current = item;
      }
      option.value = item;
      option.textContent = item;
      this._list.appendChild(option);
    });

    if (options.editable) {
      /* Use of list and datalist */
      const data = document.createElement('datalist');
      data.id = 'input-dialog-items';
      data.appendChild(this._list);

      this._input.type = 'list';
      this._input.value = current;
      this._input.setAttribute('list', data.id);
      if (options.placeholder) {
        this._input.placeholder = options.placeholder;
      }
      this.node.appendChild(data);
    } else {
      /* Use select directly */
      this._input.remove();
      this.node.appendChild(Styling.wrapSelect(this._list));
    }
  }

  /**
   * Get the user choice
   */
  getValue(): string {
    if (this._editable) {
      return this._input.value;
    } else {
      return this._list.value;
    }
  }

  private _list: HTMLSelectElement;
  private _editable: boolean;
}
