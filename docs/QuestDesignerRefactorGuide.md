# Quest Designer Refactor Implementation Guide

## Overview
This document outlines the complete refactoring plan to transform the Quest Designer into a professional, production-quality tool with a three-region layout (top bar, sidebar, main content with tabs).

## Current State Analysis

### Problems with Current Implementation
1. **Confusing Navigation**: Two overlapping systems (`workspaceView` tabs + wizard stepper)
2. **Collapsed Sidebar**: Adds complexity without clear benefit
3. **Wizard Layout Issues**: Two-column grid with `.wizard-main` / `.wizard-side` creates space issues
4. **Inconsistent Spacing**: Mixed button sizes, field layouts
5. **Unclear Mental Model**: Users don't know if they're in "wizard mode" vs "workspace mode"

### Current State Variables
- `workspaceView`: 'wizard' | 'overview' | 'systems' | 'recon' | 'steps' | 'mail' | 'rewards'
- `activeStep`: 'details' | 'system' | 'recon' | 'intro_email' | 'steps' | 'completion_email' | 'summary'
- `sidebarCollapsed`: boolean (should be removed)
- `draft`: QuestDefinition | null
- `dirty`: boolean
- `validationErrors`: QuestValidationErrors

## New Three-Region Layout

### HTML Structure
```tsx
<div className="quest-designer-app">
  {/* Top Bar */}
  <header className="quest-designer-topbar">
    <div className="quest-designer-topbar__brand">
      <h1>Quest Designer</h1>
      {draft && <span className="quest-designer-topbar__quest-name">{draft.title || 'Untitled Quest'}</span>}
    </div>
    <div className="quest-designer-topbar__status">
      <span className={`status-indicator ${dirty ? 'dirty' : ''}`}></span>
      <span>{dirty ? 'Unsaved changes' : 'Saved'}</span>
    </div>
    <div className="quest-designer-topbar__actions">
      <button className="quest-btn quest-btn-secondary" onClick={handleValidate}>Validate</button>
      <button className="quest-btn quest-btn-primary" onClick={handleSave} disabled={!dirty}>Save Quest</button>
    </div>
  </header>

  {/* Sidebar */}
  <aside className="quest-designer-sidebar">
    <div className="quest-designer-sidebar__header">
      <h2>Quests</h2>
      <input className="quest-designer-sidebar__search" placeholder="Search..." />
      <div className="quest-designer-sidebar__filters">
        {/* Difficulty filter chips */}
      </div>
    </div>
    <div className="quest-designer-sidebar__list">
      <ul>
        {/* Quest list items */}
      </ul>
    </div>
    <button className="quest-btn quest-btn-primary" onClick={handleCreateQuest}>+ New Quest</button>
  </aside>

  {/* Main Content */}
  <main className="quest-designer-main">
    {!draft ? (
      <EmptyState />
    ) : (
      <>
        <nav className="quest-designer-main__tabs">
          <button className={`quest-designer-tab ${activeTab === 'overview' ? 'active' : ''}`}>Overview</button>
          <button className={`quest-designer-tab ${activeTab === 'wizard' ? 'active' : ''}`}>Guided Wizard</button>
          <button className={`quest-designer-tab ${activeTab === 'steps' ? 'active' : ''}`}>Steps</button>
          <button className={`quest-designer-tab ${activeTab === 'systems' ? 'active' : ''}`}>Systems & Files</button>
          <button className={`quest-designer-tab ${activeTab === 'mail-rewards' ? 'active' : ''}`}>Mail & Rewards</button>
        </nav>
        <div className="quest-designer-main__content">
          {renderActiveTab()}
        </div>
      </>
    )}
  </main>
</div>
```

## New State Management

### Replace `workspaceView` with `activeTab`
```tsx
type QuestTab = 'overview' | 'wizard' | 'steps' | 'systems' | 'mail-rewards'
const [activeTab, setActiveTab] = useState<QuestTab>('overview')
```

### Remove `sidebarCollapsed`
```tsx
// DELETE: const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
```

### Keep wizard step tracking for Guided Wizard tab only
```tsx
// KEEP: const [activeStep, setActiveStep] = useState<QuestWizardStep>('details')
// This is ONLY used when activeTab === 'wizard'
```

## Tab Content Rendering

### 1. Overview Tab (Read-Only Summary)
```tsx
const OverviewTab: React.FC<{ quest: QuestDefinition }> = ({ quest }) => (
  <div>
    <section className="quest-section">
      <div className="quest-section__header">
        <h2 className="quest-section__title">Quest Metadata</h2>
        <p className="quest-section__subtitle">Core information about this quest</p>
      </div>
      <div className="quest-section__body">
        <dl>
          <dt>Title:</dt>
          <dd>{quest.title || '—'}</dd>
          <dt>Difficulty:</dt>
          <dd>{DIFFICULTY_LABELS[quest.difficulty]}</dd>
          <dt>Type:</dt>
          <dd>{quest.questType}</dd>
          <dt>Short Description:</dt>
          <dd>{quest.shortDescription || '—'}</dd>
        </dl>
      </div>
    </section>
    
    <section className="quest-section">
      <div className="quest-section__header">
        <h2 className="quest-section__title">Target System</h2>
      </div>
      <div className="quest-section__body">
        {quest.system ? <SystemSummary system={quest.system} /> : <p className="muted">No system configured</p>}
      </div>
    </section>

    {/* More read-only sections */}
  </div>
)
```

### 2. Guided Wizard Tab
```tsx
const GuidedWizardTab: React.FC<GuidedWizardTabProps> = ({ quest, activeStep, onStepChange, onUpdate }) => (
  <div>
    {/* Stepper */}
    <div className="quest-wizard-stepper">
      {QUEST_WIZARD_STEPS.map((step, index) => (
        <button
          key={step}
          className={`quest-wizard-step ${activeStep === step ? 'active' : ''}`}
          onClick={() => onStepChange(step)}
        >
          <span className="quest-wizard-step__number">{index + 1}</span>
          <span>{STEP_LABELS[step].title}</span>
        </button>
      ))}
    </div>

    {/* Active Step Content */}
    <div className="quest-designer-main__content">
      {activeStep === 'details' && <DetailsStep quest={quest} onChange={onUpdate} />}
      {activeStep === 'system' && <SystemStep quest={quest} onChange={onUpdate} />}
      {/* etc */}
    </div>

    {/* Navigation Footer */}
    <div className="quest-btn-group">
      <button className="quest-btn quest-btn-secondary" onClick={handlePrevStep}>Back</button>
      <div className="spacer"></div>
      <button className="quest-btn quest-btn-primary" onClick={handleNextStep}>
        {isLastStep ? 'Finish' : 'Next'}
      </button>
    </div>
  </div>
)
```

### 3. Steps Tab (Power User Editor)
```tsx
const StepsTab: React.FC<{ quest: QuestDefinition; onChange: (steps: QuestStepDefinition[]) => void }> = ({ quest, onChange }) => (
  <div>
    <section className="quest-section">
      <div className="quest-section__header">
        <h2 className="quest-section__title">Quest Steps</h2>
        <p className="quest-section__subtitle">Define the sequence of actions players must complete</p>
      </div>
      <div className="quest-section__body">
        {/* Reuse existing QuestStepsStep component */}
        <QuestStepsStep steps={quest.steps || []} errors={[]} onChange={onChange} />
      </div>
    </section>
  </div>
)
```

### 4. Systems & Files Tab
```tsx
const SystemsTab: React.FC<SystemsTabProps> = ({ quest, onChange }) => (
  <div>
    <section className="quest-section">
      <div className="quest-section__header">
        <h2 className="quest-section__title">Target System Configuration</h2>
        <p className="quest-section__subtitle">Define the host, file system, and security settings</p>
      </div>
      <div className="quest-section__body">
        {/* Reuse existing SystemDesignerStep */}
        <SystemDesignerStep
          system={quest.system}
          errors={[]}
          onChange={(system) => onChange({ system })}
          systemTemplates={systemTemplates}
        />
      </div>
    </section>

    <section className="quest-section">
      <div className="quest-section__header">
        <h2 className="quest-section__title">Recon & Discovery</h2>
      </div>
      <div className="quest-section__body">
        {/* Recon config */}
      </div>
    </section>
  </div>
)
```

### 5. Mail & Rewards Tab
```tsx
const MailRewardsTab: React.FC<MailRewardsTabProps> = ({ quest, onChange }) => (
  <div>
    <section className="quest-section">
      <div className="quest-section__header">
        <h2 className="quest-section__title">Intro Email</h2>
        <p className="quest-section__subtitle">Quest briefing sent to players</p>
      </div>
      <div className="quest-section__body">
        {/* Intro email editor */}
      </div>
    </section>

    <section className="quest-section">
      <div className="quest-section__header">
        <h2 className="quest-section__title">Completion Email</h2>
      </div>
      <div className="quest-section__body">
        {/* Completion email editor */}
      </div>
    </section>

    <section className="quest-section">
      <div className="quest-section__header">
        <h2 className="quest-section__title">Rewards</h2>
      </div>
      <div className="quest-section__body">
        {/* Rewards editor */}
      </div>
    </section>
  </div>
)
```

## Implementation Steps

### Phase 1: CSS (DONE ✓)
- [x] Created new `QuestDesignerApp.css` with three-region grid layout
- [x] Removed collapsed sidebar styles
- [x] Standardized button styles (`.quest-btn`, `.quest-btn-primary`, `.quest-btn-secondary`)
- [x] Standardized form field styles (`.quest-form-field`, `.quest-form-row`)
- [x] Added tab navigation styles (`.quest-designer-tab`)
- [x] Added wizard stepper styles (`.quest-wizard-stepper`, `.quest-wizard-step`)

### Phase 2: Component Structure (IN PROGRESS)
1. Update main `QuestDesignerApp` component:
   - Replace `workspaceView` with `activeTab`
   - Remove `sidebarCollapsed` state and toggle logic
   - Restructure JSX to match new three-region layout
   - Move top bar actions to header
   - Simplify sidebar (no collapse button)
   - Add tab navigation
   
2. Create tab content components:
   - `OverviewTab` - read-only summary
   - `GuidedWizardTab` - linear stepper workflow
   - `StepsTab` - power user step editor
   - `SystemsTab` - system + recon config
   - `MailRewardsTab` - emails + rewards

3. Refactor existing wizard step components:
   - Keep logic intact
   - Update to use new `.quest-section` wrapper
   - Use new `.quest-form-row` / `.quest-form-field` classes
   - Update buttons to `.quest-btn` classes

### Phase 3: State Management
1. Remove workspace view logic
2. Simplify tab switching
3. Keep wizard step progression only for Guided Wizard tab
4. Ensure validation errors display correctly in all tabs

### Phase 4: Testing & Polish
1. Run integration tests
2. Verify all existing quest operations work
3. Test responsive behavior
4. Ensure accessibility (focus management, keyboard nav)

## Key Changes Summary

| Old Pattern | New Pattern |
|-------------|-------------|
| `workspaceView` + `activeStep` | `activeTab` (wizard step only used inside wizard tab) |
| Collapsed sidebar option | Always-visible sidebar |
| Multiple navigation systems | Single tab bar |
| `.wizard-main` / `.wizard-side` 2-col grid | Single scrollable content area with sections |
| `.primary` / `.ghost` buttons | `.quest-btn-primary` / `.quest-btn-secondary` |
| Mixed form layouts | Standardized `.quest-form-row` grid |

## Migration Notes for Developers

### Don't Break
- Quest data model (`QuestDefinition`)
- Validation logic (`validateQuest`, `validateQuestForStep`)
- Storage service (`QuestStorageService`)
- Mail sync (`syncQuestMailPreviews`)
- Existing step components (logic)

### Do Change
- Layout structure (HTML)
- CSS class names
- Navigation flow
- State management (remove workspace view)
- Button/form styling

### Testing Checklist
- [ ] Create new quest
- [ ] Edit existing quest
- [ ] Navigate through wizard steps
- [ ] Switch between tabs
- [ ] Save quest
- [ ] Validate quest
- [ ] Delete quest
- [ ] Duplicate quest
- [ ] Search/filter quests
- [ ] Responsive layout (mobile)
