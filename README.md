<div align="right">
    <img src="/jupyterlab/staging/assets/guinsoolab-badge.png" width=60 alt="badge">
</div>
<div align="center">
    <img src="/jupyterlab/staging/assets/elixirnote2.svg" width=120 alt="logo" />
    <br />
    <small>go from data to knowledge</small>
</div>

# ElixirNote

[![Build Status](https://github.com/jupyterlab/jupyterlab/workflows/Linux%20Tests/badge.svg)](https://github.com/jupyterlab/jupyterlab/actions?query=branch%3Amaster+workflow%3A%22Linux+Tests%22)
[![Build Status](https://github.com/jupyterlab/jupyterlab/workflows/Windows%20Tests/badge.svg)](https://github.com/jupyterlab/jupyterlab/actions?query=branch%3Amaster+workflow%3A%22Windows+Tests%22)
[![Documentation Status](https://readthedocs.org/projects/jupyterlab/badge/?version=stable)](http://jupyterlab.readthedocs.io/en/stable/)
[![Crowdin](https://badges.crowdin.net/jupyterlab/localized.svg)](https://crowdin.com/project/jupyterlab)
[![GitHub](https://img.shields.io/badge/issue_tracking-github-blue.svg)](https://github.com/jupyterlab/jupyterlab/issues)

An extensible environment for interactive and reproducible computing, based on the
Jupyter Notebook and Ecosystem.

![ecosystem](/jupyterlab/staging/assets/elixir-ecosystem-v2.svg)

[ElixirNote](https://github.com/ElixirNote/elixirnote/tags) is the next-generation user interface for [Project Jupyter](https://jupyter.org) offering
all the familiar building blocks of the classic Jupyter Notebook (notebook,
terminal, text editor, file browser, rich outputs, etc.) in a flexible and
powerful user interface. However, [JupyterLab](http://jupyterlab.readthedocs.io/en/stable/) is also a good choice.
ElixirNote will eventually replace the classic Jupyter Notebook.

ElixirNote can be extended using [npm](https://www.npmjs.com/) packages
that use our public APIs. The _prebuilt_ extensions can be distributed
via [PyPI](https://pypi.org/search/?q=jupyterlab&o=-created&c=Framework+%3A%3A+Jupyter),
conda, and other package managers. The _source_ extensions can be installed
directly from npm (search for [jupyterlab-extension](https://www.npmjs.com/search?q=keywords:jupyterlab-extension)) but require additional build step.
You can also find ElixirNote extensions exploring topic [jupyterlab-extension](https://ciusji.gitbook.io/elixirnote/guides/extensions).
To learn more about extensions, see the [user documentation](https://ciusji.gitbook.io/elixirnote/guides/extensions).

The current ElixirNote releases are suitable for general
usage, and the extension APIs will continue to
evolve for ElixirNote extension developers.

Read the current ElixirNote documentation on [ElixirNote Docs](https://ciusji.gitbook.io/elixirnote/).

## Screenshot & Gifs

### Workspace Overview

![overview-1](/jupyterlab/staging/assets/overview-1.png)

### Example Explore

![overview-2](/jupyterlab/staging/assets/overview-2.png)

### Data Viz

![overview-3](/jupyterlab/staging/assets/overview-3.png)

### Notebook Preview

![overview-3](/jupyterlab/staging/assets/overview-4.png)

## Main Features

- **A new way to notebook**
  - Use SQL, Python, and Julia together, or alone
  - No-code visualization
  - A magic, reactive execution model
  - Advanced version control
- **Publish work as interactive data apps**
  - A full library of UI components
  - Drag-and-drop layouts
  - Instant publishing
  - Live commenting
- **Build organizational knowledge**
  - Discovery work in the knowledge library
  - Organize with categories and statuses
- **Security first**
  - Single tenant / private VPC deploys
  - HIPAA compliant, and BAA friendly
  - SSO support through Google, Okta, Keycloak, and more

## Getting Started

### Installation

Project installation instructions from the git sources are available in the [contributor documentation](CONTRIBUTING.md).

### pip

If you use `pip`, you can install it with:

```shell
# Clone ElixirServer
git git@github.com:ElixirNote/elixirserver.git
cd elixirserver
pip install -e .
# Clone ElixirNBC
git clone git@github.com:ElixirNote/elixirnbc.git
cd elixirnbc
pip install -e .
# Clone ElixirNote
git clone git@github.com:ElixirNote/elixirnote.git
cd elixirnote
pip install -e ".[dev,test]"
jlpm install
jlpm run build  # Build the dev mode assets (optional)
jlpm run build:core  # Build the core mode assets (optional)
jupyter lab build  # Build the app dir assets (optional)
```

### Running

Start up ElixirNote using:

```bash
jupyter lab --dev-mode --watch --allow-root --no-browser --ip=0.0.0.0
```

If you want load extensions in dev mode:

```bash
jupyter lab --dev-mode --watch --allow-root --no-browser --extensions-in-dev-mode --ip=0.0.0.0
```

ElixirNote will open automatically in the browser. See the [documentation](https://ciusji.gitbook.io/elixirnote/guides/get-started) for additional details.

If you encounter an error like "Command 'jupyter' not found", please make sure `PATH` environment variable is set correctly. Alternatively, you can start up ElixirNote using `~/.local/bin/jupyter lab` without changing the `PATH` environment variable.

### Prerequisites and Supported Browsers

The latest versions of the following browsers are currently _known to work_:

- Firefox
- Chrome
- Safari

See our [documentation](https://ciusji.gitbook.io/elixirnote/guides/installation) for additional details.

## Getting Help

We encourage you to ask questions on the [Discourse forum](https://github.com/orgs/ElixirNote/discussions). A question answered there can become a useful resource for others.

## Bug Report

To report a bug please read the [guidelines](https://github.com/ElixirNote/elixirnote/issues) and then open a [Github issue](https://github.com/ElixirNote/elixirnote/issues). To keep resolved issues self-contained, the [lock bot](https://github.com/apps/lock) will lock closed issues as resolved after a period of inactivity. If related discussion is still needed after an issue is locked, please open a new issue and reference the old issue.

## Development

### Extending ElixirNote

To start developing an extension for ElixirNote, see the [developer documentation](https://ciusji.gitbook.io/elixirnote/guides/extensions) and the [API docs](https://ciusji.gitbook.io/elixirnote/guides/apis).

### Contributing

To contribute code or documentation to ElixirNote itself, please read the [contributor documentation](https://github.com/ElixirNote/elixirnote/blob/main/CONTRIBUTING.md).

ElixirNote follows the Jupyter [Community Guides](https://jupyter.readthedocs.io/en/latest/community/content-community.html) 🌈.

## License

ElixirNote uses a shared copyright model that enables all contributors to maintain the
copyright on their contributions. All code is licensed under the terms of the revised [BSD license](https://github.com/ElixirNote/elixirnote/blob/main/LICENSE).

## Elixir Teams

![elixir-intro](/jupyterlab/staging/assets/elixirnote-intro.svg)

[Welcome to joins 👏👏👏](https://guinsoolab.github.io/glab).
