<div align="center">
    <img src="/jupyterlab/staging/assets/elixirnote2.svg" width=120 alt="logo" />
    <br />
    <br />
    <small>a Better Data Science Notebook</small>
</div>

# ElixirNote

[![Downloads](https://pepy.tech/badge/jupyterlab/month)](https://pepy.tech/project/jupyterlab/month)
[![Build Status](https://github.com/jupyterlab/jupyterlab/workflows/Linux%20Tests/badge.svg)](https://github.com/jupyterlab/jupyterlab/actions?query=branch%3Amaster+workflow%3A%22Linux+Tests%22)
[![Build Status](https://github.com/jupyterlab/jupyterlab/workflows/Windows%20Tests/badge.svg)](https://github.com/jupyterlab/jupyterlab/actions?query=branch%3Amaster+workflow%3A%22Windows+Tests%22)
[![Documentation Status](https://readthedocs.org/projects/jupyterlab/badge/?version=stable)](http://jupyterlab.readthedocs.io/en/stable/)
[![Crowdin](https://badges.crowdin.net/jupyterlab/localized.svg)](https://crowdin.com/project/jupyterlab)
[![GitHub](https://img.shields.io/badge/issue_tracking-github-blue.svg)](https://github.com/jupyterlab/jupyterlab/issues)
[![Discourse](https://img.shields.io/badge/help_forum-discourse-blue.svg)](https://discourse.jupyter.org/c/jupyterlab)
[![Gitter](https://img.shields.io/badge/social_chat-gitter-blue.svg)](https://gitter.im/jupyterlab/jupyterlab)

An extensible environment for interactive and reproducible computing, based on the
Jupyter Notebook and Architecture. [Currently ready for users.](https://blog.jupyter.org/jupyterlab-is-ready-for-users-5a6f039b8906)

![architecture](/jupyterlab/staging/assets/architecture.jpg)

[JupyterLab](http://jupyterlab.readthedocs.io/en/stable/) is the next-generation user interface for [Project Jupyter](https://jupyter.org) offering
all the familiar building blocks of the classic Jupyter Notebook (notebook,
terminal, text editor, file browser, rich outputs, etc.) in a flexible and
powerful user interface.
JupyterLab will eventually replace the classic Jupyter Notebook.

JupyterLab can be extended using [npm](https://www.npmjs.com/) packages
that use our public APIs. The _prebuilt_ extensions can be distributed
via [PyPI](https://pypi.org/search/?q=jupyterlab&o=-created&c=Framework+%3A%3A+Jupyter),
conda, and other package managers. The _source_ extensions can be installed
directly from npm (search for [jupyterlab-extension](https://www.npmjs.com/search?q=keywords:jupyterlab-extension)) but require additional build step.
You can also find JupyterLab extensions exploring GitHub topic [jupyterlab-extension](https://github.com/topics/jupyterlab-extension).
To learn more about extensions, see the [user documentation](https://jupyterlab.readthedocs.io/en/3.3.x/user/extensions.html).

The current JupyterLab releases are suitable for general
usage, and the extension APIs will continue to
evolve for JupyterLab extension developers.

Read the current JupyterLab documentation on [ReadTheDocs](http://jupyterlab.readthedocs.io/en/stable/).

---

## Getting started

### Installation

Project installation instructions from the git sources are available in the [contributor documentation](CONTRIBUTING.md).

### pip

If you use `pip`, you can install it with:

```shell
git clone git@github.com:ElixirNote/elixirnote.git
cd elixirnote
pip install -e .
jlpm install
jlpm run build  # Build the dev mode assets (optional)
jlpm run build:core  # Build the core mode assets (optional)
jupyter lab build  # Build the app dir assets (optional)
```

### Running

Start up JupyterLab using:

```bash
jupyter lab --dev-mode --watch --allow-root --no-browser --ip=0.0.0.0
```

JupyterLab will open automatically in the browser. See the [documentation](http://jupyterlab.readthedocs.io/en/3.3.x/getting_started/starting.html) for additional details.

If you encounter an error like "Command 'jupyter' not found", please make sure `PATH` environment variable is set correctly. Alternatively, you can start up JupyterLab using `~/.local/bin/jupyter lab` without changing the `PATH` environment variable.

### Prerequisites and Supported Browsers

The latest versions of the following browsers are currently _known to work_:

- Firefox
- Chrome
- Safari

See our [documentation](http://jupyterlab.readthedocs.io/en/3.3.x/getting_started/installation.html) for additional details.

---

## Getting help

We encourage you to ask questions on the [Discourse forum](https://discourse.jupyter.org/c/jupyterlab). A question answered there can become a useful resource for others.

### Bug report

To report a bug please read the [guidelines](https://jupyterlab.readthedocs.io/en/3.3.x/getting_started/issue.html) and then open a [Github issue](https://github.com/jupyterlab/jupyterlab/issues/new?template=bug_report.md). To keep resolved issues self-contained, the [lock bot](https://github.com/apps/lock) will lock closed issues as resolved after a period of inactivity. If related discussion is still needed after an issue is locked, please open a new issue and reference the old issue.

### Feature request

We also welcome suggestions for new features as they help make the project more useful for everyone. To request a feature please use the [feature request template](https://github.com/jupyterlab/jupyterlab/issues/new?template=feature_request.md).

---

## Development

### Extending JupyterLab

To start developing an extension for JupyterLab, see the [developer documentation](https://jupyterlab.readthedocs.io/en/3.3.x/extension/extension_dev.html) and the [API docs](https://jupyterlab.readthedocs.io/en/3.3.x/api/).

### Contributing

To contribute code or documentation to JupyterLab itself, please read the [contributor documentation](https://jupyterlab.readthedocs.io/en/3.3.x/developer/contributing.html).

JupyterLab follows the Jupyter [Community Guides](https://jupyter.readthedocs.io/en/latest/community/content-community.html).

### License

JupyterLab uses a shared copyright model that enables all contributors to maintain the
copyright on their contributions. All code is licensed under the terms of the revised [BSD license](https://github.com/jupyterlab/jupyterlab/blob/3.3.x/LICENSE).

### Team

JupyterLab is part of [Project Jupyter](http://jupyter.org/) and is developed by an open community. The maintenance team is assisted by a much larger group of contributors to JupyterLab and Project Jupyter as a whole.

JupyterLab's current maintainers are listed in alphabetical order, with affiliation, and main areas of contribution:

- Mehmet Bektas, Splunk (general development, extensions).
- Alex Bozarth, IBM (general development, extensions).
- Eric Charles, Datalayer, (general development, extensions).
- Frédéric Collonval, QuantStack (general development, extensions).
- Martha Cryan, IBM (general development, extensions).
- Afshin Darian, Two Sigma (co-creator, application/high-level architecture,
  prolific contributions throughout the code base).
- Vidar T. Fauske, JPMorgan Chase (general development, extensions).
- Brian Granger, AWS (co-creator, strategy, vision, management, UI/UX design,
  architecture).
- Jason Grout, Bloomberg (co-creator, vision, general development).
- Michał Krassowski, University of Oxford (general development, extensions).
- Max Klein, JPMorgan Chase (UI Package, build system, general development, extensions).
- Gonzalo Peña-Castellanos, QuanSight (general development, i18n, extensions).
- Fernando Perez, UC Berkeley (co-creator, vision).
- Isabela Presedo-Floyd, QuanSight Labs (design/UX).
- Steven Silvester, Apple (co-creator, release management, packaging,
  prolific contributions throughout the code base).
- Jeremy Tuloup, QuantStack (general development, extensions).

Maintainer emeritus:

- Chris Colbert, Project Jupyter (co-creator, application/low-level architecture,
  technical leadership, vision, PhosphorJS)
- Jessica Forde, Project Jupyter (demo, documentation)
- Tim George, Cal Poly (UI/UX design, strategy, management, user needs analysis).
- Cameron Oelsen, Cal Poly (UI/UX design).
- Ian Rose, Quansight/City of LA (general core development, extensions).
- Andrew Schlaepfer, Bloomberg (general development, extensions).
- Saul Shanabrook, Quansight (general development, extensions)

This list is provided to give the reader context on who we are and how our team functions.
To be listed, please submit a pull request with your information.

---

### Weekly Dev Meeting

We have videoconference meetings every week where we discuss what we have been working on and get feedback from one another.

Anyone is welcome to attend, if they would like to discuss a topic or just to listen in.

- When: Wednesdays [9AM Pacific Time](https://www.thetimezoneconverter.com/?t=9%3A00%20am&tz=San%20Francisco&)
- Where: [`jovyan` Zoom](https://zoom.us/my/jovyan?pwd=c0JZTHlNdS9Sek9vdzR3aTJ4SzFTQT09)
- What: [Meeting notes](https://hackmd.io/Y7fBMQPSQ1C08SDGI-fwtg?both)
