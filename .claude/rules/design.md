# Design Modularization Rules

## .pen File Conventions

### Design Tokens
- All colors, radii, and font families must be defined as variables and referenced via `$--variable-name`. Never use hardcoded hex values inside component definitions or screen frames.
- Token naming: `--primary`, `--accent`, `--background`, `--card`, `--border`, `--destructive`, `--success`, `--info`, `--muted-foreground`, `--radius-m`, `--font-primary`, etc.
- If a hardcoded value appears more than once, it must become a token first.

### Reusable Components
- Any UI element used in more than one screen must be a `reusable: true` component at the document root. Never duplicate raw frame structures across screens.
- Name child nodes consistently (`label`, `icon`, `input`, `placeholder`, `badge`, `priorityBar`) so instances can override them via the `descendants` path API.
- Variants (e.g. `Badge/Urgent`, `Badge/InProgress`) are separate reusable components under a shared `/` namespace, not copies with different fills.
- A button with an icon is a separate variant from one without (`Button/Primary` vs `Button/Primary/IconLeft` / `Button/Primary/IconRight`). Never bake a specific icon into a general-purpose component.

### Screen Frames
- Every screen frame must reference reusable components via `ref` nodes. Raw duplicated frame structures are not allowed.
- Content and state differences between instances belong in `descendants` overrides on the `ref` node, not in separate component copies.
- Active/selected state differences (e.g. nav items) are handled by swapping the `ref` target in a descendant override, not by creating a whole new sidebar component per screen.

### Canvas Layout
- Place the component library (all `reusable: true` nodes) at least 180px to the right of the last screen frame's right edge to avoid canvas overlap.
- Organize components into two columns with logical groups: brand/badges/buttons/nav in one column; forms/misc/cards/schedule/sidebar in the other. Separate groups with ~80px vertical gaps; items within a group with ~16px.
- The `⚙ Design System` frame displays documented instances of every component. When a new reusable component is created, add a `ref` instance of it to the appropriate section of that frame.

---

## React Component Generation

### Token → Tailwind Mapping
- Design token values map to named colors in `tailwind.config.js`. Never use `text-[#hex]` or `bg-[#hex]` — add the token as a named Tailwind color and use that class instead.
- Example mapping: `--primary` → `navy`, `--accent` → `teal`, `--info` → `sky-blue`, `--destructive` → `burnt-orange`.

### Component Structure
- Each reusable `.pen` component maps to exactly one React component file in `frontend/src/components/`.
- Component variants (e.g. `Badge/Urgent`, `Badge/InProgress`, `Badge/NotStarted`) map to a single React component with a `variant` prop, not three separate files.
- `Button/Primary`, `Button/Primary/IconLeft`, and `Button/Primary/IconRight` map to a single `Button` component with optional `icon` and `iconPosition` props (`"left" | "right" | undefined`).

### Props Mirror Descendants
- Any property overridden via `descendants` in a `.pen` instance becomes a prop in the React component.
- Named child slots in `.pen` (`label`, `icon`, `placeholder`) map to props of the same semantic meaning (`children`, `icon`, `placeholder`).

### No Raw Duplication
- Page components in `frontend/src/pages/` must import and use shared components from `frontend/src/components/`. Never copy component markup inline into a page.
- The sidebar, stat cards, task cards, schedule blocks, and nav items each have one canonical component. Any page that needs them uses that component with props — not a local copy.
