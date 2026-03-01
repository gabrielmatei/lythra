# Lythra VSCode Extension

This is the official syntax highlighting extension for the [Lythra](https://github.com/lythra) programming language.

## Features

- Syntax highlighting for `.lth` (source files) and `.lthx` (project config) files.
- Support for Lythra's unique LLM integration keywords (`vision`, `precise`, `fuzzy`, `wild`).
- Pipeline and Server DSL syntax highlighting.

## Installation

You can package and install this extension locally:

1. Install `vsce` globally: `npm install -g @vscode/vsce`
2. Run `vsce package` in this directory to generate a `.vsix` file.
3. In VS Code, go to the Extensions view.
4. Click the `...` menu and select "Install from VSIX...".
5. Select the generated `.vsix` file.
