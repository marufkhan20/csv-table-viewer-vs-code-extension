# Premium CSV Table Viewer

A beautiful, premium CSV table editor and viewer for Visual Studio Code. This extension replaces the default raw text `.csv` view with a high-performance, fully interactive spreadsheet layout natively integrated into your IDE.

## See the Difference

| Before (Raw Text) | After (Premium Table Interface) |
|:---:|:---:|
| <img src="https://i.imgur.com/YC4ddDM.png" width="400" alt="Before Screenshot"> | <img src="https://i.imgur.com/UcuZB7x.png" width="400" alt="After Screenshot"> |

## Features

- **Blazing Fast Parsing:** Uses strict RFC 4180 parsing logic for rapid load times directly inside VS Code's extension host. Wait less, view more.
- **Spreadsheet Editing:** Click on any cell or header to directly edit it. Edits instantly overwrite your underlying document leveraging the native VS Code Undo/Redo stack.
- **Dynamic Sorting & Filtering:** Native real-time column sorting and global file search filtering.
- **Sleek, Premium UI:** Inherits your VS Code editor theme dynamically. Features beautiful customized animations, sticky headers, and pixel-perfect smooth scrolling.
- **Bulk Row Deletion:** Multi-select rows with custom checkboxes to delete bulk items efficiently via a built-in confirmation overlay.

## Usage

1. Install the extension.
2. Open any `.csv` file in your workspace.
3. It will automagically open in the custom table view! (If you need to edit the raw text, simply right-click the file and select `Reopen With... -> Text Editor`).

## Release Notes

### 1.0.2
Initial release of CSV Table Viewer!
