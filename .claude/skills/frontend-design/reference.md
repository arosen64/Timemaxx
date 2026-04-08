# Design Reference

## Visual Hierarchy

### Button Hierarchy

One primary action per view. Everything else is secondary or ghost:

```tsx
<Button>Save Changes</Button>                        // Primary (one per view)
<Button variant="outline">Cancel</Button>            // Secondary
<Button variant="destructive">Delete</Button>        // Destructive
<Button variant="ghost" size="icon">                  // Toolbar / navigation
  <Settings className="h-4 w-4" />
</Button>
```

### Borders and Shadows

```tsx
<div className="border-b">              // Flat surfaces — border only
<Card className="border shadow-sm">     // Cards — subtle
<div className="border shadow-md">      // Dropdowns, modals — more lift
```

Avoid `shadow-lg` and `shadow-xl` — rarely needed.

### Border Radius

```tsx
rounded - md; // Buttons, inputs, small elements
rounded - lg; // Cards, dialogs
rounded - full; // Avatars, icon buttons only
```

---

## Motion

Motion should be purposeful, fast, and rare.

### Transitions

```tsx
<div className="transition-colors duration-150 hover:bg-accent">  // Quick (hover, focus)
<div className="transition-all duration-200">                      // Standard state changes
```

Avoid `duration-500`+ — too sluggish for UI.

### Where to Use

| Context          | Approach                                 |
| ---------------- | ---------------------------------------- |
| Hover states     | `transition-colors hover:bg-*`           |
| Focus states     | Built-in `focus-visible:ring-*`          |
| Button press     | `active:scale-[0.98]`                    |
| Scroll to bottom | `scrollIntoView({ behavior: "smooth" })` |

### Where to Avoid

Forms, navigation, lists, tables, error messages.

---

## Accessibility

### Key Rules

- Use `<button>`, not `<div onClick>` — buttons are focusable by default
- Icon buttons need `aria-label`: `<Button size="icon" aria-label="Settings">`
- Don't rely on color alone — pair `border-destructive` with error text
- Respect reduced motion: `motion-reduce:animate-none`

### Semantic HTML

```tsx
<nav>       // Navigation
<main>      // Main content
<header>    // Page or section header
<ul> / <li> // Lists
<form>      // Forms
<label>     // Always pair with inputs
```

---

## Anti-Patterns

### Avoid

- Heavy shadows (`shadow-2xl`)
- Excessive border radius (`rounded-3xl` on rectangles)
- Multiple accent colors competing — use `bg-primary` consistently
- Decorative gradients
- Animation on standard UI elements (`animate-bounce`, `animate-pulse`)
- Asymmetric padding without reason

### Prefer

- Subtle elevation: `shadow-sm border`
- Consistent radii: `rounded-md`, `rounded-lg`
- Single accent via semantic tokens: `bg-primary`
- Targeted animation: `transition-colors hover:bg-accent`
- Symmetric padding: `p-4` or `px-4 py-3` (intentional asymmetry only)
