// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ReactWidget, UseSignal } from '@jupyterlab/apputils';
import {
  ITranslator,
  nullTranslator,
  TranslationBundle
} from '@jupyterlab/translation';
import {
  caretDownEmptyThinIcon,
  caretDownIcon,
  caretRightIcon,
  caretUpEmptyThinIcon,
  caseSensitiveIcon,
  classes,
  closeIcon,
  ellipsesIcon,
  regexIcon
} from '@jupyterlab/ui-components';
import { Debouncer } from '@lumino/polling';
import { Signal } from '@lumino/signaling';
import { Widget } from '@lumino/widgets';
import * as React from 'react';
import { IDisplayState } from './interfaces';
import { SearchInstance } from './searchinstance';

const OVERLAY_CLASS = 'jp-DocumentSearch-overlay';
const OVERLAY_ROW_CLASS = 'jp-DocumentSearch-overlay-row';
const INPUT_CLASS = 'jp-DocumentSearch-input';
const INPUT_WRAPPER_CLASS = 'jp-DocumentSearch-input-wrapper';
const INPUT_BUTTON_CLASS_OFF = 'jp-DocumentSearch-input-button-off';
const INPUT_BUTTON_CLASS_ON = 'jp-DocumentSearch-input-button-on';
const INDEX_COUNTER_CLASS = 'jp-DocumentSearch-index-counter';
const UP_DOWN_BUTTON_WRAPPER_CLASS = 'jp-DocumentSearch-up-down-wrapper';
const UP_DOWN_BUTTON_CLASS = 'jp-DocumentSearch-up-down-button';
const ELLIPSES_BUTTON_CLASS = 'jp-DocumentSearch-ellipses-button';
const ELLIPSES_BUTTON_ENABLED_CLASS =
  'jp-DocumentSearch-ellipses-button-enabled';
const REGEX_ERROR_CLASS = 'jp-DocumentSearch-regex-error';
const SEARCH_OPTIONS_CLASS = 'jp-DocumentSearch-search-options';
const SEARCH_OPTIONS_DISABLED_CLASS =
  'jp-DocumentSearch-search-options-disabled';
const SEARCH_DOCUMENT_LOADING = 'jp-DocumentSearch-document-loading';
const REPLACE_ENTRY_CLASS = 'jp-DocumentSearch-replace-entry';
const REPLACE_BUTTON_CLASS = 'jp-DocumentSearch-replace-button';
const REPLACE_BUTTON_WRAPPER_CLASS = 'jp-DocumentSearch-replace-button-wrapper';
const REPLACE_WRAPPER_CLASS = 'jp-DocumentSearch-replace-wrapper-class';
const REPLACE_TOGGLE_CLASS = 'jp-DocumentSearch-replace-toggle';
const FOCUSED_INPUT = 'jp-DocumentSearch-focused-input';
const TOGGLE_WRAPPER = 'jp-DocumentSearch-toggle-wrapper';
const TOGGLE_PLACEHOLDER = 'jp-DocumentSearch-toggle-placeholder';
const BUTTON_CONTENT_CLASS = 'jp-DocumentSearch-button-content';
const BUTTON_WRAPPER_CLASS = 'jp-DocumentSearch-button-wrapper';
const SPACER_CLASS = 'jp-DocumentSearch-spacer';

interface ISearchEntryProps {
  onCaseSensitiveToggled: Function;
  onRegexToggled: Function;
  onKeydown: Function;
  onChange: Function;
  onInputFocus: Function;
  onInputBlur: Function;
  inputFocused: boolean;
  caseSensitive: boolean;
  useRegex: boolean;
  searchText: string;
  forceFocus: boolean;
  translator?: ITranslator;
}

interface IReplaceEntryProps {
  onReplaceCurrent: Function;
  onReplaceAll: Function;
  onReplaceKeydown: Function;
  onChange: Function;
  replaceText: string;
  translator?: ITranslator;
}

class SearchEntry extends React.Component<ISearchEntryProps> {
  constructor(props: ISearchEntryProps) {
    super(props);
    this.translator = props.translator || nullTranslator;
    this._trans = this.translator.load('jupyterlab');
    this.searchInputRef = React.createRef();
  }

  /**
   * Focus the input.
   */
  focusInput() {
    // Select (and focus) any text already present.
    // This makes typing in the box starts a new query (the common case),
    // while arrow keys can be used to move cursor in preparation for
    // modifying previous query.
    this.searchInputRef.current?.select();
  }

  componentDidUpdate() {
    if (this.props.forceFocus) {
      this.focusInput();
    }
  }

  render() {
    const caseButtonToggleClass = classes(
      this.props.caseSensitive ? INPUT_BUTTON_CLASS_ON : INPUT_BUTTON_CLASS_OFF,
      BUTTON_CONTENT_CLASS
    );
    const regexButtonToggleClass = classes(
      this.props.useRegex ? INPUT_BUTTON_CLASS_ON : INPUT_BUTTON_CLASS_OFF,
      BUTTON_CONTENT_CLASS
    );

    const wrapperClass = `${INPUT_WRAPPER_CLASS} ${
      this.props.inputFocused ? FOCUSED_INPUT : ''
    }`;

    return (
      <div className={wrapperClass}>
        <input
          placeholder={
            this.props.searchText ? undefined : this._trans.__('Find')
          }
          className={INPUT_CLASS}
          value={this.props.searchText}
          onChange={e => this.props.onChange(e)}
          onKeyDown={e => this.props.onKeydown(e)}
          tabIndex={0}
          onFocus={e => this.props.onInputFocus()}
          onBlur={e => this.props.onInputBlur()}
          ref={this.searchInputRef}
        />
        <button
          className={BUTTON_WRAPPER_CLASS}
          onClick={() => this.props.onCaseSensitiveToggled()}
          tabIndex={0}
        >
          <caseSensitiveIcon.react
            className={caseButtonToggleClass}
            tag="span"
          />
        </button>
        <button
          className={BUTTON_WRAPPER_CLASS}
          onClick={() => this.props.onRegexToggled()}
          tabIndex={0}
        >
          <regexIcon.react className={regexButtonToggleClass} tag="span" />
        </button>
      </div>
    );
  }

  protected translator: ITranslator;
  private _trans: TranslationBundle;
  private searchInputRef: React.RefObject<HTMLInputElement>;
}

class ReplaceEntry extends React.Component<IReplaceEntryProps> {
  constructor(props: any) {
    super(props);
    this._trans = (props.translator || nullTranslator).load('jupyterlab');
    this.replaceInputRef = React.createRef();
  }

  render() {
    return (
      <div className={REPLACE_WRAPPER_CLASS}>
        <input
          placeholder={
            this.props.replaceText ? undefined : this._trans.__('Replace')
          }
          className={REPLACE_ENTRY_CLASS}
          value={this.props.replaceText}
          onKeyDown={e => this.props.onReplaceKeydown(e)}
          onChange={e => this.props.onChange(e)}
          tabIndex={0}
          ref={this.replaceInputRef}
        />
        <button
          className={REPLACE_BUTTON_WRAPPER_CLASS}
          onClick={() => this.props.onReplaceCurrent()}
          tabIndex={0}
        >
          <span
            className={`${REPLACE_BUTTON_CLASS} ${BUTTON_CONTENT_CLASS}`}
            tabIndex={0}
          >
            {this._trans.__('Replace')}
          </span>
        </button>
        <button
          className={REPLACE_BUTTON_WRAPPER_CLASS}
          tabIndex={0}
          onClick={() => this.props.onReplaceAll()}
        >
          <span
            className={`${REPLACE_BUTTON_CLASS} ${BUTTON_CONTENT_CLASS}`}
            tabIndex={-1}
          >
            {this._trans.__('Replace All')}
          </span>
        </button>
      </div>
    );
  }

  private replaceInputRef: React.RefObject<HTMLInputElement>;
  private _trans: TranslationBundle;
}

interface IUpDownProps {
  onHighlightPrevious: Function;
  onHighlightNext: Function;
}

function UpDownButtons(props: IUpDownProps) {
  return (
    <div className={UP_DOWN_BUTTON_WRAPPER_CLASS}>
      <button
        className={BUTTON_WRAPPER_CLASS}
        onClick={() => props.onHighlightPrevious()}
        tabIndex={0}
      >
        <caretUpEmptyThinIcon.react
          className={classes(UP_DOWN_BUTTON_CLASS, BUTTON_CONTENT_CLASS)}
          tag="span"
        />
      </button>
      <button
        className={BUTTON_WRAPPER_CLASS}
        onClick={() => props.onHighlightNext()}
        tabIndex={0}
      >
        <caretDownEmptyThinIcon.react
          className={classes(UP_DOWN_BUTTON_CLASS, BUTTON_CONTENT_CLASS)}
          tag="span"
        />
      </button>
    </div>
  );
}

interface ISearchIndexProps {
  currentIndex: number | null;
  totalMatches: number;
}

function SearchIndices(props: ISearchIndexProps) {
  return (
    <div className={INDEX_COUNTER_CLASS}>
      {props.totalMatches === 0
        ? '-/-'
        : `${props.currentIndex === null ? '-' : props.currentIndex + 1}/${
            props.totalMatches
          }`}
    </div>
  );
}

interface IFilterToggleProps {
  enabled: boolean;
  toggleEnabled: () => void;
}

interface IFilterToggleState {}

class FilterToggle extends React.Component<
  IFilterToggleProps,
  IFilterToggleState
> {
  render() {
    let className = `${ELLIPSES_BUTTON_CLASS} ${BUTTON_CONTENT_CLASS}`;
    if (this.props.enabled) {
      className = `${className} ${ELLIPSES_BUTTON_ENABLED_CLASS}`;
    }
    return (
      <button
        className={BUTTON_WRAPPER_CLASS}
        onClick={() => this.props.toggleEnabled()}
        tabIndex={0}
      >
        <ellipsesIcon.react
          className={className}
          tag="span"
          height="20px"
          width="20px"
        />
      </button>
    );
  }
}

interface IFilterSelectionProps {
  searchOutput: boolean;
  searchSelectedCells: boolean;
  canToggleOutput: boolean;
  canToggleSelectedCells: boolean;
  toggleOutput: () => void;
  toggleSelectedCells: () => void;
  trans: TranslationBundle;
}

interface IFilterSelectionState {}

class FilterSelection extends React.Component<
  IFilterSelectionProps,
  IFilterSelectionState
> {
  render() {
    return (
      <label className={SEARCH_OPTIONS_CLASS}>
        <div>
          <span
            className={
              this.props.canToggleOutput ? '' : SEARCH_OPTIONS_DISABLED_CLASS
            }
          >
            {this.props.trans.__('Search Cell Outputs')}
          </span>
          <input
            type="checkbox"
            disabled={!this.props.canToggleOutput}
            checked={this.props.searchOutput}
            onChange={this.props.toggleOutput}
          />
        </div>
        <div>
          <span
            className={
              this.props.canToggleSelectedCells
                ? ''
                : SEARCH_OPTIONS_DISABLED_CLASS
            }
          >
            {this.props.trans.__('Search Selected Cell(s)')}
          </span>
          <input
            type="checkbox"
            disabled={!this.props.canToggleSelectedCells}
            checked={this.props.searchSelectedCells}
            onChange={this.props.toggleSelectedCells}
          />
        </div>
      </label>
    );
  }
}
interface ISearchOverlayProps {
  overlayState: IDisplayState;
  onCaseSensitiveToggled: Function;
  onRegexToggled: Function;
  onHighlightNext: Function;
  onHighlightPrevious: Function;
  onStartQuery: Function;
  onEndSearch: Function;
  onReplaceCurrent: Function;
  onReplaceAll: Function;
  isReadOnly: boolean;
  hasOutputs: boolean;
  searchDebounceTime?: number;
  translator?: ITranslator;
}

class SearchOverlay extends React.Component<
  ISearchOverlayProps,
  IDisplayState
> {
  constructor(props: ISearchOverlayProps) {
    super(props);
    this.translator = props.translator || nullTranslator;
    this.state = props.overlayState;
    this.replaceEntryRef = React.createRef();
    this._debouncedStartSearch = new Debouncer(() => {
      this._executeSearch(true, this.state.searchText);
    }, props.searchDebounceTime ?? 500);
    this._toggleSearchOutput = this._toggleSearchOutput.bind(this);
    this._toggleSearchSelectedCells = this._toggleSearchSelectedCells.bind(
      this
    );
  }

  componentDidMount() {
    if (this.state.searchText) {
      this._executeSearch(true, this.state.searchText);
    }
  }

  private _onSearchChange(event: React.ChangeEvent) {
    const searchText = (event.target as HTMLInputElement).value;
    this.setState({ searchText: searchText });
    void this._debouncedStartSearch.invoke();
  }

  private _onReplaceChange(event: React.ChangeEvent) {
    this.setState({ replaceText: (event.target as HTMLInputElement).value });
  }

  private _onSearchKeydown(event: KeyboardEvent) {
    if (event.keyCode === 13) {
      event.preventDefault();
      event.stopPropagation();
      this._executeSearch(!event.shiftKey);
    } else if (event.keyCode === 27) {
      event.preventDefault();
      event.stopPropagation();
      this._onClose();
    }
  }

  private _onReplaceKeydown(event: KeyboardEvent) {
    if (event.keyCode === 13) {
      event.preventDefault();
      event.stopPropagation();
      this.props.onReplaceCurrent(this.state.replaceText);
    }
  }

  private _executeSearch(
    goForward: boolean,
    searchText?: string,
    filterChanged = false
  ) {
    // execute search!
    let query;
    const input = searchText ? searchText : this.state.searchText;
    try {
      query = Private.parseQuery(
        input,
        this.props.overlayState.caseSensitive,
        this.props.overlayState.useRegex
      );
      this.setState({ errorMessage: '' });
    } catch (e) {
      this.setState({ errorMessage: e.message });
      return;
    }

    if (
      Private.regexEqual(this.props.overlayState.query, query) &&
      !filterChanged
    ) {
      if (goForward) {
        this.props.onHighlightNext();
      } else {
        this.props.onHighlightPrevious();
      }
      return;
    }

    this.props.onStartQuery(query, this.state.filters);
  }

  private _onClose() {
    // Clean up and close widget.
    this.props.onEndSearch();
    this._debouncedStartSearch.dispose();
  }

  private _onReplaceToggled() {
    this.setState({
      replaceEntryShown: !this.state.replaceEntryShown
    });
  }

  private _onSearchInputFocus() {
    if (!this.state.searchInputFocused) {
      this.setState({ searchInputFocused: true });
    }
  }

  private _onSearchInputBlur() {
    if (this.state.searchInputFocused) {
      this.setState({ searchInputFocused: false });
    }
  }
  private _toggleSearchOutput() {
    this.setState(
      prevState => ({
        ...prevState,
        filters: {
          ...prevState.filters,
          output: !prevState.filters.output
        }
      }),
      () => this._executeSearch(true, undefined, true)
    );
  }
  private _toggleSearchSelectedCells() {
    this.setState(
      prevState => ({
        ...prevState,
        filters: {
          ...prevState.filters,
          selectedCells: !prevState.filters.selectedCells
        }
      }),
      () => this._executeSearch(true, undefined, true)
    );
  }

  private _toggleFiltersOpen() {
    this.setState(prevState => ({
      filtersOpen: !prevState.filtersOpen
    }));
  }

  render() {
    const showReplace = !this.props.isReadOnly && this.state.replaceEntryShown;
    const showFilter = this.props.hasOutputs;
    const filterToggle = showFilter ? (
      <FilterToggle
        enabled={this.state.filtersOpen}
        toggleEnabled={() => this._toggleFiltersOpen()}
      />
    ) : null;
    const filter = showFilter ? (
      <FilterSelection
        key={'filter'}
        canToggleOutput={!showReplace}
        canToggleSelectedCells={true}
        searchOutput={this.state.filters.output}
        searchSelectedCells={this.state.filters.selectedCells}
        toggleOutput={this._toggleSearchOutput}
        toggleSelectedCells={this._toggleSearchSelectedCells}
        trans={this.translator.load('jupyterlab')}
      />
    ) : null;
    const icon = this.state.replaceEntryShown ? caretDownIcon : caretRightIcon;

    // TODO: Error messages from regex are not currently localizable.
    return [
      <div className={OVERLAY_ROW_CLASS} key={0}>
        {this.props.isReadOnly ? (
          <div className={TOGGLE_PLACEHOLDER} />
        ) : (
          <button
            className={TOGGLE_WRAPPER}
            onClick={() => this._onReplaceToggled()}
            tabIndex={0}
          >
            <icon.react
              className={`${REPLACE_TOGGLE_CLASS} ${BUTTON_CONTENT_CLASS}`}
              tag="span"
              elementPosition="center"
              height="20px"
              width="20px"
            />
          </button>
        )}
        <SearchEntry
          useRegex={this.props.overlayState.useRegex}
          caseSensitive={this.props.overlayState.caseSensitive}
          onCaseSensitiveToggled={() => {
            this.props.onCaseSensitiveToggled();
            this._executeSearch(true);
          }}
          onRegexToggled={() => {
            this.props.onRegexToggled();
            this._executeSearch(true);
          }}
          onKeydown={(e: KeyboardEvent) => this._onSearchKeydown(e)}
          onChange={(e: React.ChangeEvent) => this._onSearchChange(e)}
          onInputFocus={this._onSearchInputFocus.bind(this)}
          onInputBlur={this._onSearchInputBlur.bind(this)}
          inputFocused={this.state.searchInputFocused}
          searchText={this.state.searchText}
          forceFocus={this.props.overlayState.forceFocus}
          translator={this.translator}
        />
        <SearchIndices
          currentIndex={this.props.overlayState.currentIndex}
          totalMatches={this.props.overlayState.totalMatches}
        />
        <UpDownButtons
          onHighlightPrevious={() => this._executeSearch(false)}
          onHighlightNext={() => this._executeSearch(true)}
        />
        {showReplace ? null : filterToggle}
        <button
          className={BUTTON_WRAPPER_CLASS}
          onClick={() => this._onClose()}
          tabIndex={0}
        >
          <closeIcon.react
            className="jp-icon-hover"
            elementPosition="center"
            height="16px"
            width="16px"
          />
        </button>
      </div>,
      <div className={OVERLAY_ROW_CLASS} key={1}>
        {showReplace ? (
          <>
            <ReplaceEntry
              onReplaceKeydown={(e: KeyboardEvent) => this._onReplaceKeydown(e)}
              onChange={(e: React.ChangeEvent) => this._onReplaceChange(e)}
              onReplaceCurrent={() =>
                this.props.onReplaceCurrent(this.state.replaceText)
              }
              onReplaceAll={() =>
                this.props.onReplaceAll(this.state.replaceText)
              }
              replaceText={this.state.replaceText}
              ref={this.replaceEntryRef}
              translator={this.translator}
            />
            <div className={SPACER_CLASS}></div>
            {filterToggle}
          </>
        ) : null}
      </div>,
      this.state.filtersOpen ? filter : null,
      <div
        className={REGEX_ERROR_CLASS}
        hidden={
          !!this.state.errorMessage && this.state.errorMessage.length === 0
        }
        key={3}
      >
        {this.state.errorMessage}
      </div>,
      <div className={SEARCH_DOCUMENT_LOADING} key={4}>
        This document is still loading. Only loaded content will appear in
        search results until the entire document loads.
      </div>
    ];
  }

  protected translator: ITranslator;
  private replaceEntryRef: React.RefObject<ReplaceEntry>;

  private _debouncedStartSearch: Debouncer;
}

export function createSearchOverlay(
  options: createSearchOverlay.IOptions
): Widget {
  const {
    widgetChanged,
    overlayState,
    onCaseSensitiveToggled,
    onRegexToggled,
    onHighlightNext,
    onHighlightPrevious,
    onStartQuery,
    onReplaceCurrent,
    onReplaceAll,
    onEndSearch,
    isReadOnly,
    hasOutputs,
    searchDebounceTime,
    translator
  } = options;
  const widget = ReactWidget.create(
    <UseSignal signal={widgetChanged} initialArgs={overlayState}>
      {(_, args) => {
        return (
          <SearchOverlay
            onCaseSensitiveToggled={onCaseSensitiveToggled}
            onRegexToggled={onRegexToggled}
            onHighlightNext={onHighlightNext}
            onHighlightPrevious={onHighlightPrevious}
            onStartQuery={onStartQuery}
            onEndSearch={onEndSearch}
            onReplaceCurrent={onReplaceCurrent}
            onReplaceAll={onReplaceAll}
            overlayState={args!}
            isReadOnly={isReadOnly}
            hasOutputs={hasOutputs}
            searchDebounceTime={searchDebounceTime}
            translator={translator}
          />
        );
      }}
    </UseSignal>
  );
  widget.addClass(OVERLAY_CLASS);
  return widget;
}

namespace createSearchOverlay {
  export interface IOptions {
    widgetChanged: Signal<SearchInstance, IDisplayState>;
    overlayState: IDisplayState;
    onCaseSensitiveToggled: Function;
    onRegexToggled: Function;
    onHighlightNext: Function;
    onHighlightPrevious: Function;
    onStartQuery: Function;
    onEndSearch: Function;
    onReplaceCurrent: Function;
    onReplaceAll: Function;
    isReadOnly: boolean;
    hasOutputs: boolean;
    searchDebounceTime?: number;
    translator?: ITranslator;
  }
}

namespace Private {
  export function parseQuery(
    queryString: string,
    caseSensitive: boolean,
    regex: boolean
  ) {
    const flag = caseSensitive ? 'g' : 'gi';
    // escape regex characters in query if its a string search
    const queryText = regex
      ? queryString
      : queryString.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
    let ret;
    ret = new RegExp(queryText, flag);
    if (ret.test('')) {
      ret = /x^/;
    }
    return ret;
  }

  export function regexEqual(a: RegExp | null, b: RegExp | null) {
    if (!a || !b) {
      return false;
    }
    return (
      a.source === b.source &&
      a.global === b.global &&
      a.ignoreCase === b.ignoreCase &&
      a.multiline === b.multiline
    );
  }
}
