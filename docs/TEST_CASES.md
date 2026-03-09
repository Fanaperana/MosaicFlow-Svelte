# MosaicFlow — UI Test Cases

> **Date**: January 2025  
> **App Version**: Tauri v2 + Svelte 5  
> **Platform**: Windows (Desktop)  
> **Vault**: NewMosaicVault (`C:\Users\Prince\Desktop\OSINT\NewMosaicVault`)  
> **Test Method**: Automated UI testing via Tauri MCP Bridge (WebSocket on port 9223)

---

## 1. Landing / VaultPicker

| # | Test Case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 1.1 | App launches to Landing page | Launch app | Logo, "Create New Vault" button, "Open Existing Vault" button, Recent Vaults list visible | **PASS** |
| 1.2 | Recent Vaults display | Check Recent Vaults section | Shows previously opened vaults with name, path, and last-opened date | **PASS** |
| 1.3 | Open recent vault | Click on a recent vault entry | Navigates to canvas editor with vault loaded | **PASS** |
| 1.4 | Navigate Home from canvas | Click Home button (sidebar index 0) | Returns to Landing/VaultPicker page | **PASS** |
| 1.5 | Navigate back from VaultPicker | Click recent vault from Landing | Canvas editor loads with vault canvases | **PASS** |

---

## 2. Canvas Management

| # | Test Case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 2.1 | Canvas list display | Click Folder icon (sidebar index 3) | Canvas list panel shows with vault name, canvas count, and list of canvases | **PASS** |
| 2.2 | Create new canvas | Click "New Canvas" in canvas list | New canvas created with default name, count increments, canvas appears in list | **PASS** |
| 2.3 | Canvas rename (inline) | Click rename icon on canvas entry | Inline text input appears with current name, checkmark/cancel buttons shown | **PASS** |
| 2.4 | Canvas rename confirm | Type new name and click checkmark | Canvas name updates in list and header breadcrumb | **PASS** |
| 2.5 | Canvas rename cancel | Click cancel (X) during rename | Name reverts to original | **PASS** |
| 2.6 | Switch between canvases | Click different canvas in list | Canvas editor loads the selected canvas with its nodes/edges | **PASS** |
| 2.7 | Header breadcrumb display | Check header bar | Shows "VaultName > CanvasName" format | **PASS** |
| 2.8 | Header canvas name edit | Click canvas name in header breadcrumb | Inline input with confirm/cancel buttons appears | **PASS** |
| 2.9 | Canvas delete | Click delete icon on canvas entry | Canvas removed from list (not fully tested - avoided data loss) | **NOT TESTED** |

---

## 3. Node Creation

| # | Test Case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 3.1 | Create Note node via toolbar | Click Note icon in quick toolbar | Note node appears on canvas with "Double-click to edit..." placeholder | **PASS** |
| 3.2 | Create Image node via toolbar | Click Image icon in quick toolbar | Image node appears with Upload/URL buttons and "Drop image here" area | **PASS** |
| 3.3 | Create Person node via toolbar | Click Person icon in quick toolbar | Person node appears with avatar placeholder, NAME, and ROLE fields | **PASS** |
| 3.4 | Create Code Snippet via toolbar | Click Code icon in quick toolbar | Code Snippet node appears with language selector, line numbers, and copy button | **PASS** |
| 3.5 | Node palette dropdown | Click "+" button in quick toolbar | Dropdown shows 19 node types in 4 categories (Content, Entities, Data, Utility) | **PASS** |
| 3.6 | Content category nodes | Check node palette | Note, Image, Link, Code Snippet visible | **PASS** |
| 3.7 | Entities category nodes | Check node palette | Person, Organization visible | **PASS** |
| 3.8 | Data category nodes | Check node palette | Domain, IP Address, Hash, Email, Phone, Account, Crypto Wallet visible | **PASS** |
| 3.9 | Utility category nodes | Check node palette | Group, Annotation, Timeline, Timestamp, Location visible | **PASS** |

---

## 4. Node Editing

| # | Test Case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 4.1 | Note node markdown editing | Click on Note node, enter Edit mode, type text | Text appears in CodeMirror editor | **PASS** |
| 4.2 | Note Edit/View mode toggle | Toggle between Edit and View modes | Edit mode shows CodeMirror editor; View mode renders markdown | **PASS** |
| 4.3 | Image node structure | Click Image node | Shows camera icon, Upload button, URL button, drop zone | **PASS** |
| 4.4 | Code Snippet language selector | Check Code Snippet node | Language dropdown visible (Python, etc.) | **PASS** |
| 4.5 | Code Snippet copy button | Check Code Snippet node | Copy button present in header | **PASS** |
| 4.6 | Person node fields | Check Person node | Avatar area, NAME input, ROLE input visible | **PASS** |

---

## 5. Node Selection & Actions

| # | Test Case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 5.1 | Select node by clicking | Click on a node | Node shows blue selection border, context toolbar appears | **PASS** |
| 5.2 | Context toolbar display | Select a node | Shows icons: delete, copy, color, lock, zoom, more options | **PASS** |
| 5.3 | Duplicate node via Properties Panel | Select node → Properties Panel → click Duplicate | New node created as copy of selected node | **PASS** |
| 5.4 | Delete node via Delete key | Select node → press Delete key | Node removed from canvas | **FAIL** — Delete key did not remove the selected node |
| 5.5 | Delete node via context toolbar | Select node → click trash icon in toolbar | Node removed from canvas | **FAIL** — Trash icon click did not remove the node |
| 5.6 | Delete node via Properties Panel | Select node → Properties Panel → click Delete | Node removed from canvas | **NOT TESTED** |

---

## 6. Properties Panel

| # | Test Case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 6.1 | Open Properties Panel | Click on a node | Panel opens on right side showing node details | **PASS** |
| 6.2 | Properties header | Check panel header | Shows node type icon and name (e.g., "Image", "Note") with blue background | **PASS** |
| 6.3 | GENERAL section | Check section | Title (editable), ID (read-only UUID) displayed | **PASS** |
| 6.4 | Edit node title | Change title in Properties Panel input | Title updates on node header (when Show Header enabled) | **PASS** |
| 6.5 | APPEARANCE section | Check section | BG color picker, border color, border width/radius, border style dropdown | **PASS** |
| 6.6 | Contain within Group checkbox | Check option | Checkbox present and functional | **PASS** |
| 6.7 | Show Header checkbox | Toggle Show Header | Enables/disables header bar on the node | **PASS** |
| 6.8 | LAYOUT section | Expand Layout | Shows X, Y position fields and Width, Height dimension fields with lock buttons | **PASS** |
| 6.9 | Note-specific options | Select a Note node | Shows NOTE OPTIONS section with Edit/View mode toggle | **PASS** |
| 6.10 | ACTIONS section | Check section | Duplicate and Delete buttons present | **PASS** |
| 6.11 | Close Properties Panel | Click close button (X) | Panel closes, canvas returns to full width | **PASS** |
| 6.12 | Toggle via Settings button | Click Settings sidebar button (index 11) | Toggles Properties Panel open/closed | **PASS** |

---

## 7. Search

| # | Test Case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 7.1 | Open search modal | Click Search button (sidebar index 1) | Modal opens with "Search canvases and nodes..." input and RECENT CANVASES list | **PASS** |
| 7.2 | Search canvases | Type canvas name (e.g., "Test") | Filters results to matching canvases with result count | **PASS** |
| 7.3 | Search nodes | Type node-related text | Filters results to matching nodes showing canvas context | **PASS** |
| 7.4 | Search result highlighting | Search with keyword | Matching text highlighted in blue in results | **PASS** |
| 7.5 | Result count display | Perform a search | Shows "N RESULTS" count above results | **PASS** |
| 7.6 | Close search modal | Press Escape | Modal closes | **PASS** |
| 7.7 | Keyboard hints | Check search modal | Shows keyboard shortcut hints (e.g., ↑↓ to navigate, Enter to select) | **PASS** |

---

## 8. Sidebar Controls

| # | Test Case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 8.1 | Home button | Click Home (index 0) | Navigates to Landing/VaultPicker | **PASS** |
| 8.2 | Search button | Click Search (index 1) | Opens search modal | **PASS** |
| 8.3 | Add node button | Click Add (index 2) | Opens node palette dropdown | **PASS** |
| 8.4 | Canvas list button | Click Folder (index 3) | Opens canvas list panel | **PASS** |
| 8.5 | Export button | Click Export (index 4) | Shows export dropdown (JSON, PNG, SVG) | **PASS** |
| 8.6 | Undo button | Click Undo (index 5) | Undoes last action (enabled when undo history exists) | **PASS** |
| 8.7 | Redo button | Click Redo (index 6) | Redoes last undone action | **NOT TESTED** |
| 8.8 | Zoom In button | Click Zoom In (index 7) | Canvas zooms in | **PASS** |
| 8.9 | Zoom Out button | Click Zoom Out (index 8) | Canvas zooms out | **PASS** |
| 8.10 | Fit View button | Click Fit View (index 9) | Canvas adjusts to fit all nodes in viewport | **PASS** |
| 8.11 | Trash button | Click Trash (index 10) | Deletes selected node(s) | **NOT TESTED** (was disabled when no node selected) |
| 8.12 | Settings button | Click Settings (index 11) | Toggles Properties Panel | **PASS** |

---

## 9. Quick Toolbar (Top Center)

| # | Test Case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 9.1 | Toolbar visibility | Check top center | Toolbar shows selection, pan, and node type icons | **PASS** |
| 9.2 | Selection mode (pointer) | Click pointer icon | Selection mode active (default) | **PASS** |
| 9.3 | Pan mode (hand) | Click hand icon | Pan mode for canvas navigation | **NOT TESTED** |
| 9.4 | Node shortcut icons | Check toolbar | Note, Image, Link, Person, Timestamp, Code icons + "+" button | **PASS** |

---

## 10. Node List Sidebar

| # | Test Case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 10.1 | Open Node List | Click toggle button in header (≡ icon) | Node list panel opens on right side | **PASS** |
| 10.2 | Node list content | Check panel | Lists all nodes with type icons and names | **PASS** |
| 10.3 | Group hierarchy | Check groups | Groups show expand arrows and child count badges | **PASS** |
| 10.4 | Filter nodes | Type in "Filter nodes..." input | Filters list to matching nodes by name/type | **PASS** |
| 10.5 | Selected node highlight | Select a node on canvas | Corresponding item highlighted in blue in node list | **PASS** |
| 10.6 | Close Node List | Click X button on panel | Panel closes | **PASS** |

---

## 11. Export

| # | Test Case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 11.1 | Export menu display | Click Export sidebar button | Dropdown shows 3 options: JSON, PNG, SVG | **PASS** |
| 11.2 | Export as JSON | Click "Export as JSON" | Saves canvas state as JSON file | **NOT TESTED** (requires file dialog) |
| 11.3 | Export as PNG | Click "Export as PNG" | Saves canvas as PNG image | **NOT TESTED** (requires file dialog) |
| 11.4 | Export as SVG | Click "Export as SVG" | Saves canvas as SVG file | **NOT TESTED** (requires file dialog) |

---

## 12. Zoom & Navigation

| # | Test Case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 12.1 | Zoom In (sidebar) | Click Zoom In button | Canvas scale increases | **PASS** |
| 12.2 | Zoom Out (sidebar) | Click Zoom Out button | Canvas scale decreases | **PASS** |
| 12.3 | Fit View (sidebar) | Click Fit View button | All nodes fit within viewport | **PASS** |
| 12.4 | Zoom controls (bottom-right) | Check built-in SvelteFlow controls | +, −, fit, lock buttons present | **PASS** |
| 12.5 | Minimap | Check bottom-left corner | Minimap showing overview of all nodes | **PASS** |
| 12.6 | Canvas panning | Drag on empty canvas area | Canvas viewport moves | **NOT TESTED** (requires drag interaction) |

---

## 13. Edges

| # | Test Case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 13.1 | Edge visibility | Check canvas | Curved edges connecting nodes are visible | **PASS** |
| 13.2 | Edge count | Count edges | 10 edges present on test canvas | **PASS** |
| 13.3 | Edge creation | Drag from node handle to another node | New edge created between nodes | **NOT TESTED** (requires drag interaction) |
| 13.4 | Edge deletion | Select edge and press Delete | Edge removed | **NOT TESTED** |
| 13.5 | Edge styling | Check edge appearance | Edges rendered as smooth curves with appropriate color | **PASS** |

---

## 14. Undo/Redo

| # | Test Case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 14.1 | Undo button enabled | Make a change (e.g., duplicate node) | Undo button becomes enabled (not disabled) | **PASS** |
| 14.2 | Undo action | Click Undo button | Last action is reversed | **PASS** |
| 14.3 | Redo action | Click Redo button after Undo | Undone action is re-applied | **NOT TESTED** |
| 14.4 | Undo/Redo keyboard shortcuts | Press Ctrl+Z / Ctrl+Y | Undo/Redo actions triggered | **NOT TESTED** |

---

## Summary

| Category | Total | Passed | Failed | Not Tested |
|----------|-------|--------|--------|------------|
| 1. Landing/VaultPicker | 5 | 5 | 0 | 0 |
| 2. Canvas Management | 9 | 8 | 0 | 1 |
| 3. Node Creation | 9 | 9 | 0 | 0 |
| 4. Node Editing | 6 | 6 | 0 | 0 |
| 5. Node Selection & Actions | 6 | 3 | 2 | 1 |
| 6. Properties Panel | 12 | 12 | 0 | 0 |
| 7. Search | 7 | 7 | 0 | 0 |
| 8. Sidebar Controls | 12 | 10 | 0 | 2 |
| 9. Quick Toolbar | 4 | 3 | 0 | 1 |
| 10. Node List Sidebar | 6 | 6 | 0 | 0 |
| 11. Export | 4 | 1 | 0 | 3 |
| 12. Zoom & Navigation | 6 | 5 | 0 | 1 |
| 13. Edges | 5 | 3 | 0 | 2 |
| 14. Undo/Redo | 4 | 2 | 0 | 2 |
| **TOTAL** | **95** | **80** | **2** | **13** |

### Pass Rate: **84.2%** (80/95)

---

## Issues Found

### FAIL: Node Deletion via Delete Key (5.4)
- **Severity**: Medium
- **Description**: Pressing the Delete key while a node is selected does not delete the node.
- **Steps to Reproduce**: Select a node by clicking → Press Delete key
- **Expected**: Node is removed from canvas
- **Actual**: Nothing happens; node remains on canvas

### FAIL: Node Deletion via Context Toolbar Trash Icon (5.5)
- **Severity**: Medium
- **Description**: Clicking the trash icon in the floating context toolbar above a selected node does not delete the node.
- **Steps to Reproduce**: Select a node → Click the trash icon (leftmost icon) in the context toolbar
- **Expected**: Node is removed from canvas
- **Actual**: Nothing happens; node remains selected with toolbar visible

### Notes
- "NOT TESTED" items are primarily features requiring native OS dialogs (file save dialogs for export), complex drag-and-drop interactions, or keyboard shortcut testing that the MCP driver cannot easily automate.
- Edge creation testing was not performed since it requires precise mouse drag from source handle to target handle coordinates.
- The node deletion issue should be investigated — it may be related to event handling, focus management, or the `deleteKeyCode` configuration in SvelteFlow.

---

## Node Types Verified on Canvas

The following node types were observed and verified on the "Untitled" canvas:

| Node Type | Count | Functional |
|-----------|-------|------------|
| Note | 8+ | ✅ |
| Image | 7 (incl. duplicate) | ✅ |
| Group | 4 | ✅ |
| Code Snippet | 2 | ✅ |
| Person | 1+ | ✅ |
| Link | 2 | ✅ |
| Annotation | 2+ | ✅ |
| Timestamp | 2+ | ✅ |
| Location (Map) | 1 | ✅ |
