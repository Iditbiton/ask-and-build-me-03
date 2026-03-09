

## Cleanup Plan: Remove Duplicates, Inconsistencies, and Dead Code

### Issues Found

1. **`DiagramCanvas.tsx` is completely unused** -- It duplicates all the drawing logic from `InlineDiagram.tsx` (nodes, connections, SVG export) but is never imported anywhere. The app only uses `InlineDiagram`.

2. **`TextEditor.tsx` is completely unused** -- A standalone textarea component never imported anywhere. The inline `contentEditable` in `InlineEditor.tsx` replaced it.

3. **`Toolbar.tsx` is completely unused** -- Contains generate/export/copy buttons that duplicate functionality already in `InlineEditor` + `InlineDiagram`. Never imported.

4. **`NavLink.tsx` is completely unused** -- A router NavLink wrapper, but the app has only one route and no navigation links.

5. **`App.css` is Vite boilerplate** -- Contains default Vite template styles (`.logo`, `.card`, `.read-the-docs`) that are never used.

6. **Duplicate `getNodeCenter` function** -- Defined identically in both `DiagramCanvas.tsx` and `InlineDiagram.tsx`.

7. **Duplicate drawing/rendering logic** -- Node drawing, connection drawing, SVG export code is copy-pasted between `DiagramCanvas` and `InlineDiagram`.

### Plan

1. **Delete unused files:**
   - `src/components/DiagramCanvas.tsx`
   - `src/components/TextEditor.tsx`
   - `src/components/Toolbar.tsx`
   - `src/components/NavLink.tsx`
   - `src/App.css`

2. **Remove `App.css` import** from `src/App.tsx` (if imported) or `src/main.tsx`.

3. **Verify no broken imports** after deletions.

No changes to core functionality -- `InlineEditor`, `InlineDiagram`, `GenerationModeToggle`, `ColorThemePicker`, `TemplateSelector`, the edge function, and the text selection + diagram generation flow all remain untouched.

