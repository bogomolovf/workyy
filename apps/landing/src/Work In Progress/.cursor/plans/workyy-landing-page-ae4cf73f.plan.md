<!-- ae4cf73f-5bd5-4d6d-a5ab-d1ea19b66f13 7b1158ac-dd53-46cb-bcd4-52eff18fafbc -->
# Workyy Landing Page - Phase 2 Enhancement Plan

## Overview

Enhance the landing page with dynamic interactions, improved navigation, gamified mini-games, lined visual themes (including developer-friendly variants), and a new marketing + comparison experience while preserving existing functionality.

## Step 1: Navigation & UX Improvements

### 1.1 Header Navigation Enhancements

**Files**: `src/components/Header.tsx`, `src/hooks/useScrollSpy.ts` (new), `src/hooks/useActiveRoute.ts` (new)

- Active route highlighting via custom hook
- Scroll spy for HomePage sections (Hero → Future)
- Intersection Observer hook to track visible sections
- Header reflects active section with underline/background indicator

### 1.2 Mobile Navigation Improvements

**Files**: `src/components/Header.tsx`, `src/components/ui/MobileMenu.tsx` (new, optional)

- Slide-over animation, outside-click + Escape close
- Larger tap targets (≥44px)
- Smooth open/close transitions

### 1.3 Back to Top Button

**Files**: `src/components/BackToTop.tsx` (new), `src/hooks/useScrollPosition.ts` (new)

- Floating button after 400px scroll
- Smooth scroll-to-top, respects prefers-reduced-motion

### 1.4 Breadcrumbs & Related Navigation

**Files**: `src/components/Breadcrumbs.tsx` (new), update key pages

- Home > Section > Subsection breadcrumbs
- Optional related links blocks

## Step 2: Dynamic Animations & Interactions

### 2.1 Scroll Animations

**Files**: `src/hooks/useScrollAnimation.ts` (new), `src/components/ui/AnimatedSection.tsx` (new), page updates

- Fade/translate entries with stagger
- Disabled under prefers-reduced-motion

### 2.2 Page Transition Animations

**Files**: `src/components/PageTransition.tsx` (new), `src/App.tsx`

- 200–300 ms fade between routes without layout shift

### 2.3 Hero Demo Enhancements

**Files**: `src/pages/HomePage.tsx`

- Animated SQL → Python → Result flow, loading micro-interactions

### 2.4 Playground Section Interactions

**Files**: `src/pages/HomePage.tsx`

- Active game highlighting, smooth transitions, hover scale

## Step 3: Enhanced Mini-Games

### 3.1 DecisionSimulator – “Budget vs KPI”

**Files**: `src/components/games/DecisionSimulator.tsx`

- Difficulty tabs, KPI targets, ROI scoring, feedback + best score persistence

### 3.2 MessyDataCleanup – “Multi-step Wizard”

**Files**: `src/components/games/MessyDataCleanup.tsx`

- Stepper flow, progress bar, data preview, success/error feedback

### 3.3 AnalyticsTarot – “Structured Insight Cards”

**Files**: `src/components/games/AnalyticsTarot.tsx`

- Mode selector (Growth/Cost/Experiment), Insight/Risk/Action cards, animations

### 3.4 ChartMemoryGame – “Memory + Stats”

**Files**: `src/components/games/ChartMemoryGame.tsx`

- Difficulty selector, timer, moves counter, best score storage, flip animations

## Step 4: Lined Theme Suite (Existing + New Variants)

### 4.1 Theme Context Updates

**Files**: `src/contexts/ThemeContext.tsx`

- Extend `Theme` type (dev-blue, dev-red, lined-green/red/blue/midnight/bluewhite)
- Update validation + localStorage migration

### 4.2 Global Grid System

**Files**: `src/index.css`

- Layered grid background via CSS gradients
- Per-theme variables `--grid-line-soft/strong` for contrast
- Prevent solid overrides hiding the grid

### 4.3 Theme Palettes

**Files**: `src/index.css`

- Define palettes and grid colors for aurora/pastel + new lined themes
- Developer palettes adopt grid system

### 4.4 Theme Toggle UX

**Files**: `src/components/ThemeToggle.tsx`

- Group themes (Aurora, Pastel, Lined, Developer)
- Preview chips showing background + line colors

### 4.5 Component Compatibility

**Files**: All themed components

- Remove hardcoded backgrounds
- Ensure cards, games, hero respect CSS variables + contrast

## Step 5: Final UX/QA Pass

### 5.1 Accessibility Audit

- Keyboard nav, focus-visible, ARIA, prefers-reduced-motion

### 5.2 Cross-Theme Testing

- Test all aurora/pastel/lined/dev themes for readability + persistence

### 5.3 Responsive Testing

- Mobile nav, games, back-to-top, animations performance

### 5.4 Functionality Verification

- i18n, routing, games state, theme switching, scroll spy

### 5.5 Build & Performance

- `npm run build`, bundle size, console warnings

## Step 6: Marketing + Comparison Integration

### 6.1 Content & IA

**Files**: `src/pages/HomePage.tsx`, nav components

- Implement new hero/value/template/social proof/pricing sections with provided copy
- Wire dropdown menus with descriptors and microcopy handling

### 6.2 Theme Tokens & Contrast Utilities

**Files**: `src/theme/tokens.ts`, `src/styles/theme.css`

- Add aurora/midnight/light tokens, contrast helper, focus + reduced motion handling

### 6.3 Home Page Grid Layout

**Files**: `src/pages/HomePage.tsx`, `src/styles/theme.css`

- Responsive CSS Grid for Value Grid & Templates using `repeat(auto-fit, minmax())`
- Theme switcher controlling CSS variables client-side
- Accessible buttons/cards referencing contrast utility

### 6.4 Comparison Page & Data

**Files**: `src/pages/ComparisonPage.tsx` (new), `public/feature-matrix.json`

- Minimalist table + narrative summary reusing theme system
- Drive matrix from JSON data (with schema + sample)

### 6.5 Competitive Analysis Assets

**Files**: docs/notes or Markdown

- Feature matrix table, narrative analysis, pricing references with “verify” checklist

## Implementation Order

1. Step 1 – Navigation & UX
2. Step 2 – Animations & interactions
3. Step 3 – Games
4. Step 4 – Theme overhaul + new lined themes
5. Step 5 – QA & build
6. Step 6 – Marketing + comparison overhaul

## Success Criteria

- Navigation is intuitive with scroll spy + breadcrumbs
- Animations feel lively yet respectful of user settings
- Mini-games provide deeper engagement
- All lined + developer themes selectable, eye-friendly, and persistent
- Marketing homepage reflects new IA with responsive grids and accessible CTAs
- Comparison page fairly represents competitors using JSON-driven matrix + narrative
- Accessibility + responsive requirements met; build passes without errors

### To-dos

- [ ] Draft IA, menus, microcopy
- [ ] Define theme tokens + contrast utility
- [ ] Implement Home page React component
- [ ] Implement Comparison page React component
- [ ] Create feature matrix table + narrative
- [ ] Define FeatureMatrix schema + sample
- [ ] Write verification checklist & SEO/accessibility notes