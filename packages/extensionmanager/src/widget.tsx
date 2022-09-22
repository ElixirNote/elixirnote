// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { JupyterFrontEnd } from '@jupyterlab/application';
import { Dialog, showDialog } from '@jupyterlab/apputils';
import { ServiceManager } from '@jupyterlab/services';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import {
  ITranslator,
  nullTranslator,
  TranslationBundle
} from '@jupyterlab/translation';
import {
  Button,
  caretDownIcon,
  caretRightIcon,
  Collapse,
  InputGroup,
  jupyterIcon,
  listingsInfoIcon,
  ToolbarButtonComponent,
  VDomRenderer
} from '@jupyterlab/ui-components';
import { Message } from '@lumino/messaging';
import * as React from 'react';
import ReactPaginate from 'react-paginate';
import { Action, IEntry, ListModel } from './model';
import { isJupyterOrg } from './npm';

// TODO: Replace pagination with lazy loading of lower search results

/**
 * Icons with custom styling bound.
 */
const caretDownIconStyled = caretDownIcon.bindprops({
  height: 'auto',
  width: '20px'
});
const caretRightIconStyled = caretRightIcon.bindprops({
  height: 'auto',
  width: '20px'
});

const badgeSize = 32;
const badgeQuerySize = Math.floor(devicePixelRatio * badgeSize);

/**
 * Search bar VDOM component.
 */
export class SearchBar extends React.Component<
  SearchBar.IProperties,
  SearchBar.IState
> {
  constructor(props: SearchBar.IProperties) {
    super(props);
    this.state = {
      value: ''
    };
  }

  /**
   * Render the list view using the virtual DOM.
   */
  render(): React.ReactNode {
    return (
      <div className="jp-extensionmanager-search-bar">
        <InputGroup
          className="jp-extensionmanager-search-wrapper"
          type="text"
          placeholder={this.props.placeholder}
          onChange={this.handleChange}
          value={this.state.value}
          rightIcon="ui-components:search"
          disabled={this.props.disabled}
        />
      </div>
    );
  }

  /**
   * Handler for search input changes.
   */
  handleChange = (e: React.FormEvent<HTMLElement>): void => {
    const target = e.target as HTMLInputElement;
    this.setState({
      value: target.value
    });
  };
}

/**
 * The namespace for search bar statics.
 */
export namespace SearchBar {
  /**
   * React properties for search bar component.
   */
  export interface IProperties {
    /**
     * The placeholder string to use in the search bar input field when empty.
     */
    placeholder: string;

    disabled: boolean;

    settings: ISettingRegistry.ISettings;
  }

  /**
   * React state for search bar component.
   */
  export interface IState {
    /**
     * The value of the search bar input field.
     */
    value: string;
  }
}

/**
 * Create a build prompt as a react element.
 *
 * @param props Configuration of the build prompt.
 */
function BuildPrompt(props: BuildPrompt.IProperties): React.ReactElement<any> {
  const translator = props.translator || nullTranslator;
  const trans = translator.load('jupyterlab');
  return (
    <div className="jp-extensionmanager-buildprompt">
      <div className="jp-extensionmanager-buildmessage">
        {trans.__('A build is needed to include the latest changes')}
      </div>
      <Button onClick={props.performBuild} minimal small>
        {trans.__('Rebuild')}
      </Button>
      <Button onClick={props.ignoreBuild} minimal small>
        {trans.__('Ignore')}
      </Button>
    </div>
  );
}

/**
 * The namespace for build prompt statics.
 */
namespace BuildPrompt {
  /**
   * Properties for build prompt react component.
   */
  export interface IProperties {
    /**
     * Callback for when a build is requested.
     */
    performBuild: () => void;

    /**
     * Callback for when a build notice is dismissed.
     */
    ignoreBuild: () => void;

    /**
     * The application language translator.
     */
    translator?: ITranslator;
  }
}

function getExtensionGitHubUser(entry: IEntry) {
  if (entry.url && entry.url.startsWith('https://github.com/')) {
    return entry.url.split('/')[3];
  }
  return null;
}

/**
 * VDOM for visualizing an extension entry.
 */
function ListEntry(props: ListEntry.IProperties): React.ReactElement<any> {
  const { entry, listMode, viewType } = props;
  const translator = props.translator || nullTranslator;
  const trans = translator.load('jupyterlab');
  const flagClasses = [];
  if (entry.status && ['ok', 'warning', 'error'].indexOf(entry.status) !== -1) {
    flagClasses.push(`jp-extensionmanager-entry-${entry.status}`);
  }
  let title = entry.name;
  const entryIsJupyterOrg = isJupyterOrg(entry.name);
  if (entryIsJupyterOrg) {
    title = trans.__('%1 (Developed by Project Jupyter)', entry.name);
  }
  const githubUser = getExtensionGitHubUser(entry);
  if (
    listMode === 'block' &&
    entry.blockedExtensionsEntry &&
    viewType === 'searchResult'
  ) {
    return <li></li>;
  }
  if (
    listMode === 'allow' &&
    !entry.allowedExtensionsEntry &&
    viewType === 'searchResult'
  ) {
    return <li></li>;
  }
  if (listMode === 'block' && entry.blockedExtensionsEntry?.name) {
    flagClasses.push(`jp-extensionmanager-entry-should-be-uninstalled`);
  }
  if (listMode === 'allow' && !entry.allowedExtensionsEntry) {
    flagClasses.push(`jp-extensionmanager-entry-should-be-uninstalled`);
  }
  return (
    <li
      className={`jp-extensionmanager-entry ${flagClasses.join(' ')}`}
      title={title}
      style={{ display: 'flex' }}
    >
      <div style={{ marginRight: '8px' }}>
        {githubUser && (
          <img
            src={`https://github.com/${githubUser}.png?size=${badgeQuerySize}`}
            style={{ width: '32px', height: '32px' }}
          />
        )}
        {!githubUser && (
          <div style={{ width: `${badgeSize}px`, height: `${badgeSize}px` }} />
        )}
      </div>
      <div className="jp-extensionmanager-entry-description">
        <div className="jp-extensionmanager-entry-title">
          <div className="jp-extensionmanager-entry-name">
            {entry.url ? (
              <a href={entry.url} target="_blank" rel="noopener noreferrer">
                {entry.name}
              </a>
            ) : (
              <div>{entry.name}</div>
            )}
          </div>
          {entry.blockedExtensionsEntry && (
            <ToolbarButtonComponent
              icon={listingsInfoIcon}
              iconLabel={trans.__(
                '%1 extension has been blockedExtensions since install. Please uninstall immediately and contact your blockedExtensions administrator.',
                entry.name
              )}
              onClick={() =>
                window.open(
                  'https://jupyterlab.readthedocs.io/en/latest/user/extensions.html'
                )
              }
            />
          )}
          {!entry.allowedExtensionsEntry &&
            viewType === 'installed' &&
            listMode === 'allow' && (
              <ToolbarButtonComponent
                icon={listingsInfoIcon}
                iconLabel={trans.__(
                  '%1 extension has been removed from the allowedExtensions since installation. Please uninstall immediately and contact your allowedExtensions administrator.',
                  entry.name
                )}
                onClick={() =>
                  window.open(
                    'https://jupyterlab.readthedocs.io/en/latest/user/extensions.html'
                  )
                }
              />
            )}
          {entryIsJupyterOrg && (
            <jupyterIcon.react
              className="jp-extensionmanager-is-jupyter-org"
              top="1px"
              height="auto"
              width="1em"
            />
          )}
        </div>
        <div className="jp-extensionmanager-entry-content">
          <div className="jp-extensionmanager-entry-description">
            {entry.description}
          </div>
          <div className="jp-extensionmanager-entry-buttons">
            {entry.enabled && (
              <Button
                onClick={() => props.performAction('disable', entry)}
                minimal
                small
              >
                {trans.__('Disable')}
              </Button>
            )}
            {entry.installed && !entry.enabled && (
              <Button
                onClick={() => props.performAction('enable', entry)}
                minimal
                small
              >
                {trans.__('Enable')}
              </Button>
            )}
            {entry.installed && entry.pkg_type == 'prebuilt' && (
              <div className="jp-extensionmanager-entry-buttons">
                <Button
                  onClick={() =>
                    showDialog({
                      title,
                      body: (
                        <div>
                          {getPrebuiltUninstallInstruction(entry, trans)}
                        </div>
                      ),
                      buttons: [
                        Dialog.okButton({
                          label: trans.__('OK'),
                          caption: trans.__('OK')
                        })
                      ]
                    }).then(result => {
                      return result.button.accept;
                    })
                  }
                  minimal
                  small
                >
                  {trans.__('About')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function getPrebuiltUninstallInstruction(
  entry: IEntry,
  trans: TranslationBundle
): JSX.Element {
  if (entry.install?.uninstallInstructions) {
    return (
      <div>
        <p>
          {trans.__(`This is a prebuilt extension. To uninstall it, please
    apply following instructions.`)}
        </p>
        <p>{trans.__(entry.install?.uninstallInstructions)}</p>
      </div>
    );
  }
  return (
    <div>
      <p>
        {trans.__(`This is a prebuilt extension. To uninstall it, please
    read the user guide on:`)}
      </p>
      <p>
        <a
          href="https://jupyterlab.readthedocs.io/en/latest/user/extensions.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          https://jupyterlab.readthedocs.io/en/latest/user/extensions.html
        </a>
      </p>
    </div>
  );
}

/**
 * The namespace for extension entry statics.
 */
export namespace ListEntry {
  export interface IProperties {
    /**
     * The entry to visualize.
     */
    entry: IEntry;

    /**
     * The list mode to apply.
     */
    listMode: 'block' | 'allow' | 'default' | 'invalid';

    /**
     * The requested view type.
     */
    viewType: 'installed' | 'searchResult';

    /**
     * Callback to use for performing an action on the entry.
     */
    performAction: (action: Action, entry: IEntry) => void;

    /**
     * The language translator.
     */
    translator?: ITranslator;
  }
}

/**
 * List view widget for extensions
 */
export function ListView(props: ListView.IProperties): React.ReactElement<any> {
  const translator = props.translator || nullTranslator;
  const trans = translator.load('jupyterlab');
  const entryViews = [];
  for (const entry of props.entries) {
    entryViews.push(
      <ListEntry
        entry={entry}
        listMode={props.listMode}
        viewType={props.viewType}
        key={entry.name}
        performAction={props.performAction}
        translator={translator}
      />
    );
  }
  let pagination;
  if (props.numPages > 1) {
    pagination = (
      <div className="jp-extensionmanager-pagination">
        <ReactPaginate
          previousLabel={'<'}
          nextLabel={'>'}
          breakLabel={<a href="">...</a>}
          breakClassName={'break-me'}
          pageCount={props.numPages}
          marginPagesDisplayed={2}
          pageRangeDisplayed={5}
          onPageChange={(data: { selected: number }) =>
            props.onPage(data.selected)
          }
          containerClassName={'pagination'}
          activeClassName={'active'}
        />
      </div>
    );
  }
  const listview = (
    <ul className="jp-extensionmanager-listview">{entryViews}</ul>
  );
  return (
    <div className="jp-extensionmanager-listview-wrapper">
      {entryViews.length > 0 ? (
        listview
      ) : (
        <div key="message" className="jp-extensionmanager-listview-message">
          {trans.__('No entries')}
        </div>
      )}
      {pagination}
    </div>
  );
}

/**
 * The namespace for list view widget statics.
 */
export namespace ListView {
  export interface IProperties {
    /**
     * The extension entries to display.
     */
    entries: ReadonlyArray<IEntry>;

    /**
     * The number of pages that can be viewed via pagination.
     */
    numPages: number;

    /**
     * The list mode to apply.
     */
    listMode: 'block' | 'allow' | 'default' | 'invalid';

    /**
     * The requested view type.
     */
    viewType: 'installed' | 'searchResult';

    /**
     * The language translator.
     */
    translator?: ITranslator;

    /**
     * The callback to use for changing the page
     */
    onPage: (page: number) => void;

    /**
     * Callback to use for performing an action on an entry.
     */
    performAction: (action: Action, entry: IEntry) => void;
  }
}

function ErrorMessage(props: ErrorMessage.IProperties) {
  return (
    <div key="error-msg" className="jp-extensionmanager-error">
      {props.children}
    </div>
  );
}

namespace ErrorMessage {
  export interface IProperties {
    children: React.ReactNode;
  }
}

/**
 *
 */
export class CollapsibleSection extends React.Component<
  CollapsibleSection.IProperties,
  CollapsibleSection.IState
> {
  constructor(props: CollapsibleSection.IProperties) {
    super(props);
    this.state = {
      isOpen: props.isOpen ? true : false
    };
  }

  /**
   * Render the collapsible section using the virtual DOM.
   */
  render(): React.ReactNode {
    let icon = this.state.isOpen ? caretDownIconStyled : caretRightIconStyled;
    let isOpen = this.state.isOpen;
    let className = 'jp-extensionmanager-headerText';
    if (this.props.disabled) {
      icon = caretRightIconStyled;
      isOpen = false;
      className = 'jp-extensionmanager-headerTextDisabled';
    }
    return (
      <>
        <div className="jp-stack-panel-header">
          <ToolbarButtonComponent
            icon={icon}
            onClick={() => {
              this.handleCollapse();
            }}
          />
          <span className={className}>{this.props.header}</span>
          {!this.props.disabled && this.props.headerElements}
        </div>
        <Collapse isOpen={isOpen}>{this.props.children}</Collapse>
      </>
    );
  }

  /**
   * Handler for search input changes.
   */
  handleCollapse(): void {
    this.setState(
      {
        isOpen: !this.state.isOpen
      },
      () => {
        if (this.props.onCollapse) {
          this.props.onCollapse(this.state.isOpen);
        }
      }
    );
  }

  UNSAFE_componentWillReceiveProps(
    nextProps: CollapsibleSection.IProperties
  ): void {
    if (nextProps.forceOpen) {
      this.setState({
        isOpen: true
      });
    }
  }
}

/**
 * The namespace for collapsible section statics.
 */
export namespace CollapsibleSection {
  /**
   * React properties for collapsible section component.
   */
  export interface IProperties {
    /**
     * The header string for section list.
     */
    header: string;

    /**
     * Whether the view will be expanded or collapsed initially, defaults to open.
     */
    isOpen?: boolean;

    /**
     * Handle collapse event.
     */
    onCollapse?: (isOpen: boolean) => void;

    /**
     * Any additional elements to add to the header.
     */
    headerElements?: React.ReactNode;

    /**
     * If given, this will be displayed instead of the children.
     */
    errorMessage?: string | null;

    /**
     * If true, the section will be collapsed and will not respond
     * to open nor close actions.
     */
    disabled?: boolean;

    /**
     * If true, the section will be opened if not disabled.
     */
    forceOpen?: boolean;
  }

  /**
   * React state for collapsible section component.
   */
  export interface IState {
    /**
     * Whether the section is expanded or collapsed.
     */
    isOpen: boolean;
  }
}

/**
 * The main view for the discovery extension.
 */
export class ExtensionView extends VDomRenderer<ListModel> {
  protected translator: ITranslator;
  private _trans: TranslationBundle;
  private _settings: ISettingRegistry.ISettings;
  constructor(
    app: JupyterFrontEnd,
    serviceManager: ServiceManager.IManager,
    settings: ISettingRegistry.ISettings,
    translator?: ITranslator
  ) {
    super(new ListModel(app, serviceManager, settings, translator));
    this.translator = translator || nullTranslator;
    this._trans = this.translator.load('jupyterlab');
    this._settings = settings;
    this.addClass('jp-extensionmanager-view');
  }

  /**
   * The search input node.
   */
  get inputNode(): HTMLInputElement {
    return this.node.querySelector(
      '.jp-extensionmanager-search-wrapper input'
    ) as HTMLInputElement;
  }

  /**
   * Render the extension view using the virtual DOM.
   */
  protected render(): React.ReactElement<any>[] {
    const model = this.model!;
    if (!model.listMode) {
      return [<div key="empty"></div>];
    }
    if (model.listMode === 'invalid') {
      return [
        <div style={{ padding: 8 }} key="invalid">
          <div>
            {this._trans
              .__(`The extension manager is disabled. Please contact your system
administrator to verify the listings configuration.`)}
          </div>
          <div>
            <a
              href="https://jupyterlab.readthedocs.io/en/latest/user/extensions.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              {this._trans.__('Read more in the JupyterLab documentation.')}
            </a>
          </div>
        </div>
      ];
    }
    const elements = [
      <SearchBar
        key="searchbar"
        placeholder={this._trans.__('SEARCH')}
        disabled={!ListModel.isDisclaimed()}
        settings={this._settings}
      />
    ];
    if (model.promptBuild) {
      elements.push(
        <BuildPrompt
          key="promt"
          translator={this.translator}
          performBuild={() => {
            model.performBuild();
          }}
          ignoreBuild={() => {
            model.ignoreBuildRecommendation();
          }}
        />
      );
    }
    // Indicator element for pending actions:
    elements.push(
      <div
        key="pending"
        className={`jp-extensionmanager-pending ${
          model.hasPendingActions() ? 'jp-mod-hasPending' : ''
        }`}
      />
    );
    const content = [];
    content.push(
      <CollapsibleSection
        key="warning-section"
        isOpen={!ListModel.isDisclaimed()}
        disabled={false}
        header={this._trans.__('Warning')}
      >
        <div className="jp-extensionmanager-disclaimer">
          <div>
            {this._trans
              .__(`The notebook development team is excited to have a robust
                third-party extension community. However, we do not review
                third-party extensions, and some extensions may introduce security
                risks or contain malicious code that runs on your machine.`)}
          </div>
          <div style={{ paddingTop: 8 }}>
            <Button
              className="jp-extensionmanager-disclaimer-enable"
              onClick={() => {
                window.open(
                  'https://ciusji.gitbook.io/elixirnote/guides/extensions',
                  '_target'
                );
              }}
            >
              {this._trans.__('Visit Extensions')}
            </Button>
          </div>
        </div>
      </CollapsibleSection>
    );
    if (!model.initialized) {
      content.push(
        <div key="loading-placeholder" className="jp-extensionmanager-loader">
          {this._trans.__('Updating extensions list')}
        </div>
      );
    } else if (model.serverConnectionError !== null) {
      content.push(
        <ErrorMessage key="error-msg">
          <p>
            {this._trans
              .__(`Error communicating with server extension. Consult the documentation
            for how to ensure that it is enabled.`)}
          </p>

          <p>{this._trans.__('Reason given:')}</p>
          <pre>{model.serverConnectionError}</pre>
        </ErrorMessage>
      );
    } else if (model.serverRequirementsError !== null) {
      content.push(
        <ErrorMessage key="server-requirements-error">
          <p>
            {this._trans.__(
              'The server has some missing requirements for installing extensions.'
            )}
          </p>

          <p>{this._trans.__('Details:')}</p>
          <pre>{model.serverRequirementsError}</pre>
        </ErrorMessage>
      );
    } else {
      // List installed and discovery sections

      const installedContent = [];
      if (model.installedError !== null) {
        installedContent.push(
          <ErrorMessage key="install-error">
            {`Error querying installed extensions${
              model.installedError ? `: ${model.installedError}` : '.'
            }`}
          </ErrorMessage>
        );
      } else {
        const query = new RegExp(model.query?.toLowerCase() ?? '');
        installedContent.push(
          <ListView
            key="installed-items"
            listMode={model.listMode}
            viewType={'installed'}
            entries={model.installed.filter(
              pkg => !model.query || query.test(pkg.name)
            )}
            numPages={1}
            translator={this.translator}
            onPage={value => {
              /* no-op */
            }}
            performAction={this.onAction.bind(this)}
          />
        );
      }

      //   content.push(
      //     <CollapsibleSection
      //       key="installed-section"
      //       isOpen={ListModel.isDisclaimed()}
      //       forceOpen={this._forceOpen}
      //       disabled={!ListModel.isDisclaimed()}
      //       header={this._trans.__('Installed')}
      //       headerElements={
      //         <ToolbarButtonComponent
      //           key="refresh-button"
      //           icon={refreshIcon}
      //           onClick={() => {
      //             model.refreshInstalled();
      //           }}
      //           tooltip={this._trans.__('Refresh extension list')}
      //         />
      //       }
      //     >
      //       {installedContent}
      //     </CollapsibleSection>
      //   );
      //
      //   const searchContent = [];
      //   if (model.searchError !== null) {
      //     searchContent.push(
      //       <ErrorMessage key="search-error">
      //         {`Error searching for extensions${
      //           model.searchError ? `: ${model.searchError}` : '.'
      //         }`}
      //       </ErrorMessage>
      //     );
      //   } else {
      //     searchContent.push(
      //       <ListView
      //         key="search-items"
      //         listMode={model.listMode}
      //         viewType={'searchResult'}
      //         // Filter out installed extensions:
      //         entries={model.searchResult.filter(
      //           entry => model.installed.indexOf(entry) === -1
      //         )}
      //         numPages={pages}
      //         onPage={value => {
      //           this.onPage(value);
      //         }}
      //         performAction={this.onAction.bind(this)}
      //         translator={this.translator}
      //       />
      //     );
      //   }
      //
      //   content.push(
      //     <CollapsibleSection
      //       key="search-section"
      //       isOpen={ListModel.isDisclaimed()}
      //       forceOpen={this._forceOpen}
      //       disabled={!ListModel.isDisclaimed()}
      //       header={
      //         model.query
      //           ? this._trans.__('Search Results')
      //           : this._trans.__('Discover')
      //       }
      //       onCollapse={(isOpen: boolean) => {
      //         if (isOpen && model.query === null) {
      //           model.query = '';
      //         }
      //       }}
      //     >
      //       {searchContent}
      //     </CollapsibleSection>
      //   );
    }

    elements.push(
      <div key="content" className="jp-extensionmanager-content">
        {content}
      </div>
    );

    return elements;
  }

  /**
   * Callback handler for the user specifies a new search query.
   *
   * @param value The new query.
   */
  onSearch(value: string): void {
    this.model!.query = value;
  }

  /**
   * Callback handler for the user changes the page of the search result pagination.
   *
   * @param value The pagination page number.
   */
  onPage(value: number): void {
    this.model!.page = value;
  }

  /**
   * Callback handler for when the user wants to perform an action on an extension.
   *
   * @param action The action to perform.
   * @param entry The entry to perform the action on.
   */
  onAction(action: Action, entry: IEntry): Promise<void> {
    switch (action) {
      case 'install':
        return this.model!.install(entry);
      case 'uninstall':
        return this.model!.uninstall(entry);
      case 'enable':
        return this.model!.enable(entry);
      case 'disable':
        return this.model!.disable(entry);
      default:
        throw new Error(`Invalid action: ${action}`);
    }
  }

  /**
   * Handle the DOM events for the extension manager search bar.
   *
   * @param event - The DOM event sent to the extension manager search bar.
   *
   * #### Notes
   * This method implements the DOM `EventListener` interface and is
   * called in response to events on the search bar's DOM node.
   * It should not be called directly by user code.
   */
  handleEvent(event: Event): void {
    switch (event.type) {
      case 'input':
        this.onSearch(this.inputNode.value);
        break;
      case 'focus':
      case 'blur':
        this._toggleFocused();
        break;
      default:
        break;
    }
  }

  /**
   * A message handler invoked on a `'before-attach'` message.
   */
  protected onBeforeAttach(msg: Message): void {
    this.node.addEventListener('input', this);
    this.node.addEventListener('focus', this, true);
    this.node.addEventListener('blur', this, true);
  }

  /**
   * A message handler invoked on an `'after-detach'` message.
   */
  protected onAfterDetach(msg: Message): void {
    this.node.removeEventListener('input', this);
    this.node.removeEventListener('focus', this, true);
    this.node.removeEventListener('blur', this, true);
  }

  /**
   * A message handler invoked on an `'activate-request'` message.
   */
  protected onActivateRequest(msg: Message): void {
    if (this.isAttached) {
      const input = this.inputNode;
      if (input) {
        input.focus();
        input.select();
      }
    }
  }

  /**
   * Toggle the focused modifier based on the input node focus state.
   */
  private _toggleFocused(): void {
    const focused = document.activeElement === this.inputNode;
    this.toggleClass('lm-mod-focused', focused);
  }
}
