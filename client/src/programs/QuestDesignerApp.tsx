import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import './QuestDesignerApp.css'

import type {
	BonusObjective,
	HackingToolId,
	QuestBranchingConfig,
	QuestBranchOutcome,
	QuestCompletionEmailConfig,
	CompletionEmailVariant,
	CompletionEmailVariantCondition,
	MailTemplateFields,
	QuestDefinition,
	QuestIntroEmailConfig,
	QuestRequirements,
	QuestReconDiscoveryTarget,
	QuestReconRequirements,
	QuestRewardsMatrix,
	QuestRiskProfile,
	QuestStepDefinition,
	QuestSystemDefinition,
	QuestType,
	SystemDifficulty
} from '../types/quest'
import { DEFAULT_MAIL_SENDER } from '../constants/mail'
import { generateId } from './quest-designer/id'
import { SystemDesignerStep } from './quest-designer/SystemDesignerStep'
import { createQuestStorageService, type QuestStorageService } from './quest-designer/storage'
import { createSystemTemplateService, type SystemTemplateService } from './quest-designer/systemTemplates'
import { createMailService } from '../services/mailService'
import { clearQuestMailPreviews, syncQuestMailPreviews } from '../services/questMailSync'
import {
	QUEST_WIZARD_STEPS,
	type QuestValidationErrors,
	type QuestWizardStep,
	validateQuest,
	validateQuestForStep
} from './quest-designer/validation'

const DIFFICULTY_LABELS: Record<SystemDifficulty, string> = {
	tutorial: 'Tutorial',
	easy: 'Easy',
	medium: 'Medium',
	hard: 'Hard',
	boss: 'Boss'
}

const TOOL_OPTION_DETAILS: Array<{ id: HackingToolId; label: string; description: string }> = [
	{ id: 'scan', label: 'Scan', description: 'Baseline host probe to confirm the system is online and expose doors.' },
	{ id: 'deep_scan', label: 'Deep Scan', description: 'Heavy probe that surfaces ports plus trace behavior and NPC chatter.' },
	{ id: 'bruteforce', label: 'Bruteforce', description: 'Password cannon used to break guarded or locked doors.' },
	{ id: 'clean_logs', label: 'Clean Logs', description: 'Scrubs log files to satisfy cleanup bonus objectives.' },
	{ id: 'backdoor_install', label: 'Backdoor Install', description: 'Plants persistent access for follow-up quests or branches.' }
]

const STEP_LABELS: Record<QuestWizardStep, { title: string; helper: string }> = {
	details: { title: 'Quest Details', helper: 'Describe the quest meta and difficulty.' },
	system: { title: 'System Designer', helper: 'Specify the target host players will infiltrate.' },
	recon: { title: 'Recon & Discovery', helper: 'Define scan requirements, discovery targets, and stealth hints.' },
	intro_email: { title: 'Intro Email', helper: 'Draft the in-universe quest briefing.' },
	steps: { title: 'Quest Steps', helper: 'Outline the actions players must complete.' },
	completion_email: { title: 'Completion Email', helper: 'Write the wrap-up mail after success.' },
	summary: { title: 'Summary & Save', helper: 'Review everything before publishing.' }
}

const STEP_TYPE_OPTIONS = ['scan', 'connect', 'read_file', 'delete_file', 'custom'] as const

const DIFFICULTY_ORDER: SystemDifficulty[] = ['tutorial', 'easy', 'medium', 'hard', 'boss']

const MAIL_PERSONAS = [
	'Atlas Control <atlas@ops>',
	'Agent Vega <vega@atlas.ops>',
	'Director Huxley <huxley@atlas.ops>',
	'Systems Watch <watch@atlas.ops>'
]

const INTRO_TOKEN_CATALOG = [
	{ label: 'Quest Title', token: '{QUEST_TITLE}' },
	{ label: 'Target System', token: '{SYSTEM_NAME}' },
	{ label: 'Difficulty', token: '{QUEST_DIFFICULTY}' },
	{ label: 'Player Codename', token: '{PLAYER_HANDLE}' }
]

const VARIANT_CONDITION_METADATA: Record<CompletionEmailVariantCondition['type'], { label: string; helper: string }> = {
	trace_below: {
		label: 'Trace below threshold',
		helper: 'Fire this mail when players finish under a specific trace amount.'
	},
	trace_between: {
		label: 'Trace between range',
		helper: 'Send when final trace is between min/max values.'
	},
	bonus_objective_completed: {
		label: 'Bonus objective completed',
		helper: 'Only send if a specific bonus objective succeeds.'
	},
	trap_triggered: {
		label: 'Trap triggered',
		helper: 'Send when a given trap ID was tripped.'
	},
	quest_outcome: {
		label: 'Quest outcome matches',
		helper: 'Target a specific success/stealth/failure outcome.'
	},
	world_flag: {
		label: 'World flag present',
		helper: 'Send when a given world flag is set (or not).'
	}
}

type QuestWorkspaceView = 'wizard' | 'overview' | 'systems' | 'recon' | 'steps' | 'mail' | 'rewards'

const WORKSPACE_TABS: Array<{ id: QuestWorkspaceView; label: string; helper: string }> = [
	{ id: 'wizard', label: 'Guided Wizard', helper: 'Step-by-step flow for new quests.' },
	{ id: 'overview', label: 'Overview', helper: 'Quick edits to title, description, and difficulty.' },
	{ id: 'systems', label: 'Systems', helper: 'Tweak the target host snapshot.' },
	{ id: 'recon', label: 'Recon', helper: 'Tune scan requirements, discovery targets, and stealth expectations.' },
	{ id: 'steps', label: 'Steps', helper: 'Adjust the quest beats and ordering.' },
	{ id: 'mail', label: 'Mail', helper: 'Craft intro and completion emails.' },
	{ id: 'rewards', label: 'Rewards', helper: 'Bonus objectives and reward hooks.' }
]

const QUEST_TYPE_OPTIONS: Array<{ id: QuestType; label: string; helper: string }> = [
	{ id: 'recon', label: 'Recon Run', helper: 'Map systems quietly, ideal for onboarding new hackers.' },
	{ id: 'data_theft', label: 'Data Theft', helper: 'Snatch sensitive files without leaving a trace.' },
	{ id: 'sabotage', label: 'Sabotage', helper: 'Break core infrastructure, usually louder runs.' },
	{ id: 'cleanup', label: 'Cleanup', helper: 'Erase footprints or patch damage from other ops.' },
	{ id: 'misdirection', label: 'Misdirection', helper: 'Trigger decoys or plant fake intel.' }
]

const DEFAULT_RISK_PROFILE: QuestRiskProfile = {
	maxRecommendedTrace: 60,
	failAboveTrace: 95,
	requiredTraceSpike: undefined,
	cleanupBeforeDisconnect: false
}

const BONUS_OBJECTIVE_TYPES: BonusObjective['type'][] = [
	'keep_trace_below',
	'avoid_trace_spike',
	'dont_delete_file',
	'exfiltrate_file',
	'dont_trigger_trap',
	'clean_logs',
	'sanitize_logs',
	'delete_logs',
	'retrieve_files'
]

const BONUS_TYPE_LABELS: Record<BonusObjective['type'], string> = {
	keep_trace_below: 'Keep Trace Below',
	avoid_trace_spike: 'Avoid Trace Spike',
	dont_delete_file: "Don't Delete File",
	exfiltrate_file: 'Exfiltrate File',
	dont_trigger_trap: "Don't Trigger Trap",
	clean_logs: 'Clean All Logs',
	sanitize_logs: 'Sanitize All Logs',
	delete_logs: 'Delete Evidence Logs',
	retrieve_files: 'Retrieve Tagged Files'
}

const createEmptyQuestDraft = (): QuestDefinition => ({
	id: generateId('quest'),
	title: '',
	shortDescription: '',
	recommendedOrder: undefined,
	difficulty: 'easy',
	questType: 'recon',
	riskProfile: { ...DEFAULT_RISK_PROFILE },
	system: undefined,
	requirements: { requiredTools: [] },
	bonusObjectives: [],
	introEmail: undefined,
	completionEmail: undefined,
	rewards: {},
	branching: {},
	steps: []
})

const cloneQuest = (quest: QuestDefinition): QuestDefinition => JSON.parse(JSON.stringify(quest))

const sortQuests = (quests: QuestDefinition[]) => {
	const copy = [...quests]
	copy.sort((a, b) => {
		const orderDiff = (a.recommendedOrder ?? Infinity) - (b.recommendedOrder ?? Infinity)
		if (orderDiff !== 0) return orderDiff
		return a.title.localeCompare(b.title)
	})
	return copy
}

const summarizeSteps = (steps: QuestStepDefinition[]) => {
	const counts = steps.reduce<Record<string, number>>((acc, step) => {
		acc[step.type] = (acc[step.type] || 0) + 1
		return acc
	}, {})
	return Object.entries(counts)
		.map(([type, count]) => `${count}x ${type}`)
		.join(', ')
}

export const QuestDesignerApp: React.FC = () => {
	const storage = useMemo<QuestStorageService>(() => createQuestStorageService(), [])
	const systemTemplates = useMemo<SystemTemplateService>(() => createSystemTemplateService(), [])
	const mailService = useMemo(() => createMailService(), [])
	const [quests, setQuests] = useState<QuestDefinition[]>([])
	const [loading, setLoading] = useState(true)
	const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null)
	const [draft, setDraft] = useState<QuestDefinition | null>(null)
	const [activeStep, setActiveStep] = useState<QuestWizardStep>('details')
	const [dirty, setDirty] = useState(false)
	const [validationErrors, setValidationErrors] = useState<QuestValidationErrors>({})
	const [search, setSearch] = useState('')
	const [difficultyFilters, setDifficultyFilters] = useState<Set<SystemDifficulty>>(new Set())
	const [unsavedPromptOpen, setUnsavedPromptOpen] = useState(false)
	const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
	const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
	const [workspaceView, setWorkspaceView] = useState<QuestWorkspaceView>('wizard')

	useEffect(() => {
		let mounted = true
		storage.listQuests().then(list => {
			if (!mounted) return
			setQuests(sortQuests(list))
			setLoading(false)
		})
		return () => {
			mounted = false
		}
	}, [storage])

	useEffect(() => {
		if (!dirty) return
		const handler = (event: BeforeUnloadEvent) => {
			event.preventDefault()
			event.returnValue = ''
		}
		window.addEventListener('beforeunload', handler)
		return () => window.removeEventListener('beforeunload', handler)
	}, [dirty])

	const applyDraftPatch = useCallback((patch: Partial<QuestDefinition>) => {
		setDraft(prev => {
			if (!prev) return prev
			const next = { ...prev, ...patch }
			setDirty(true)
			return next
		})
	}, [])

	const displayQuests = useMemo(() => {
		if (!draft) return quests
		const existingIndex = quests.findIndex(q => q.id === draft.id)
		if (existingIndex === -1) {
			return sortQuests([...quests, draft])
		}
		if (!dirty) return quests
		const copy = [...quests]
		copy[existingIndex] = draft
		return copy
	}, [draft, dirty, quests])

	const validationByQuestId = useMemo(() => {
		const map = new Map<string, boolean>()
		displayQuests.forEach(quest => {
			const errors = validateQuest(quest)
			const hasErrors = Object.values(errors).some(list => list && list.length > 0)
			map.set(quest.id, hasErrors)
		})
		return map
	}, [displayQuests])

	const filteredQuests = useMemo(() => {
		return displayQuests.filter(quest => {
			if (search.trim()) {
				const text = `${quest.title} ${quest.shortDescription}`.toLowerCase()
				if (!text.includes(search.trim().toLowerCase())) {
					return false
				}
			}
			if (difficultyFilters.size > 0 && !difficultyFilters.has(quest.difficulty)) {
				return false
			}
			return true
		})
	}, [difficultyFilters, displayQuests, search])

	const selectQuest = useCallback((quest: QuestDefinition | null) => {
		if (!quest) {
			setDraft(null)
			setSelectedQuestId(null)
			setDirty(false)
			setValidationErrors({})
			setActiveStep('details')
			setWorkspaceView('wizard')
			return
		}
		setDraft(cloneQuest(quest))
		setSelectedQuestId(quest.id)
		setDirty(false)
		setValidationErrors({})
		setActiveStep('details')
		setWorkspaceView('wizard')
	}, [])

	const confirmAndExecute = useCallback((action: () => void) => {
		if (!dirty) {
			action()
			return
		}
		setPendingAction(() => action)
		setUnsavedPromptOpen(true)
	}, [dirty])

	const handleSelectQuest = useCallback((questId: string) => {
		if (questId === selectedQuestId && draft) return
		confirmAndExecute(() => {
			storage.getQuest(questId).then(found => {
				if (found) {
					selectQuest(found)
				}
			})
		})
	}, [confirmAndExecute, draft, selectedQuestId, selectQuest, storage])

	const handleCreateQuest = useCallback(() => {
		confirmAndExecute(() => {
			const nextDraft = createEmptyQuestDraft()
			selectQuest(nextDraft)
			setDirty(true)
		})
	}, [confirmAndExecute, selectQuest])

	const handleDuplicateQuest = useCallback((questId: string) => {
		const base = displayQuests.find(q => q.id === questId)
		if (!base) return
		confirmAndExecute(() => {
			const copy = cloneQuest(base)
			copy.id = generateId('quest')
			copy.title = base.title ? `${base.title} (Copy)` : 'Quest Copy'
			selectQuest(copy)
			setDirty(true)
		})
	}, [confirmAndExecute, displayQuests, selectQuest])

	const handleDeleteQuest = useCallback((questId: string) => {
		setDeleteTargetId(questId)
	}, [])

	const confirmDeleteQuest = useCallback(() => {
		if (!deleteTargetId) return
		const targetId = deleteTargetId
		storage.deleteQuest(targetId).then(() => {
			setQuests(prev => sortQuests(prev.filter(q => q.id !== targetId)))
			if (draft && draft.id === targetId) {
				selectQuest(null)
			}
			setDeleteTargetId(null)
			clearQuestMailPreviews(targetId, { mailService }).catch(() => {})
		})
	}, [deleteTargetId, draft, mailService, selectQuest, storage])

	const cancelDeleteQuest = useCallback(() => setDeleteTargetId(null), [])

	const handleDiscardConfirm = useCallback(() => {
		setUnsavedPromptOpen(false)
		setDirty(false)
		const action = pendingAction
		setPendingAction(null)
		if (action) action()
	}, [pendingAction])

	const handleDiscardCancel = useCallback(() => {
		setUnsavedPromptOpen(false)
		setPendingAction(null)
	}, [])

	const handleSystemChange = useCallback((system: QuestSystemDefinition | undefined) => {
		applyDraftPatch({ system })
	}, [applyDraftPatch])

	const handleReconChange = useCallback((recon?: QuestReconRequirements) => {
		applyDraftPatch({ reconRequirements: recon })
	}, [applyDraftPatch])

	const handleIntroEmailChange = useCallback((email: QuestIntroEmailConfig | undefined) => {
		applyDraftPatch({ introEmail: email })
	}, [applyDraftPatch])

	const handleCompletionEmailChange = useCallback((email: QuestCompletionEmailConfig | undefined) => {
		applyDraftPatch({ completionEmail: email })
	}, [applyDraftPatch])

	const handleStepsChange = useCallback((steps: QuestStepDefinition[]) => {
		applyDraftPatch({ steps })
	}, [applyDraftPatch])

	const handleRequirementsChange = useCallback((requirements: QuestRequirements) => {
		applyDraftPatch({ requirements })
	}, [applyDraftPatch])

	const handleCancelDraft = useCallback(() => {
		if (!draft) return
		if (!dirty) {
			if (selectedQuestId) {
				storage.getQuest(selectedQuestId).then(found => {
					selectQuest(found)
				})
			} else {
				selectQuest(null)
			}
			return
		}
		setPendingAction(() => {
			if (selectedQuestId) {
				storage.getQuest(selectedQuestId).then(found => {
					selectQuest(found)
				})
			} else {
				selectQuest(null)
			}
		})
		setUnsavedPromptOpen(true)
	}, [dirty, draft, selectQuest, selectedQuestId, storage])

	const handleValidateStep = useCallback((step: QuestWizardStep) => {
		if (!draft) return []
		if (step === 'summary') {
			const aggregate = validateQuest(draft)
			setValidationErrors(aggregate)
			return Object.values(aggregate).flatMap(list => list || [])
		}
		const issues = validateQuestForStep(draft, step)
		setValidationErrors(prev => ({ ...prev, [step]: issues }))
		return issues
	}, [draft])

	const handleSaveQuest = useCallback(() => {
		if (!draft) return
		const errors = validateQuest(draft)
		setValidationErrors(errors)
		const hasErrors = Object.values(errors).some(list => list && list.length > 0)
		if (hasErrors) {
			setActiveStep('summary')
			return
		}
		storage.saveQuest(draft).then(() => {
			setQuests(prev => {
				const next = prev.filter(q => q.id !== draft.id)
				next.push(cloneQuest(draft))
				return sortQuests(next)
			})
			setDirty(false)
			setValidationErrors({})
			setActiveStep('summary')
			syncQuestMailPreviews({ quests: [draft], mailService }).catch(() => {})
		})
	}, [draft, mailService, storage])

	const toggleDifficultyFilter = (difficulty: SystemDifficulty) => {
		setDifficultyFilters(prev => {
			const next = new Set(prev)
			if (next.has(difficulty)) next.delete(difficulty)
			else next.add(difficulty)
			return next
		})
	}

	const selectedQuestTitle = draft?.title || 'Untitled Quest'
	const activeWorkspaceMeta = WORKSPACE_TABS.find(tab => tab.id === workspaceView) ?? WORKSPACE_TABS[0]

	return (
		<div className="quest-designer-app">
			<aside className="quest-designer-sidebar">
				<header className="quest-sidebar-header">
					<div>
						<h2>Quest Designer</h2>
						<p className="muted">Batch 2 • Guided rebuild</p>
					</div>
					<button type="button" className="primary" onClick={handleCreateQuest}>+ New Quest</button>
				</header>
				<div className="quest-sidebar-controls">
					<input
						className="quest-search"
						placeholder="Search quests"
						value={search}
						onChange={e => setSearch(e.target.value)}
					/>
					<div className="quest-filter-group" aria-label="Difficulty filters">
						{DIFFICULTY_ORDER.map(level => (
							<button
								key={level}
								type="button"
								className={`filter-chip ${difficultyFilters.has(level) ? 'active' : ''}`}
								onClick={() => toggleDifficultyFilter(level)}
							>
								{DIFFICULTY_LABELS[level]}
							</button>
						))}
					</div>
				</div>
				<div className="quest-list" role="region" aria-label="Quest list">
					{loading && <p className="muted">Loading quests…</p>}
					{!loading && filteredQuests.length === 0 && (
						<p className="muted empty-state">No quests match the current filters.</p>
					)}
					<ul>
						{filteredQuests.map(quest => {
							const selected = quest.id === selectedQuestId
							const hasErrors = validationByQuestId.get(quest.id)
							return (
								<li key={quest.id} className={`quest-row ${selected ? 'selected' : ''}`}>
									<button type="button" className="quest-row-main" onClick={() => handleSelectQuest(quest.id)}>
										<div>
											<div className="quest-row-title">
												<strong>{quest.title || 'Untitled Quest'}</strong>
												{dirty && draft?.id === quest.id && <span className="pill warning">Unsaved</span>}
												{hasErrors ? <span className="pill danger">Needs fixes</span> : <span className="pill success">Ready</span>}
											</div>
											<p className="muted quest-row-description">{quest.shortDescription || 'No description yet.'}</p>
										</div>
										<span className={`difficulty-badge ${quest.difficulty}`}>{DIFFICULTY_LABELS[quest.difficulty]}</span>
									</button>
									<div className="quest-row-actions">
										<button type="button" onClick={() => handleDuplicateQuest(quest.id)}>Duplicate</button>
										<button type="button" className="ghost danger" onClick={() => handleDeleteQuest(quest.id)}>Delete</button>
									</div>
								</li>
							)
						})}
					</ul>
				</div>
			</aside>
			<section className="quest-designer-workspace">
				{!draft && (
					<div className="quest-empty-state">
						<h3>No quest selected</h3>
						<p className="muted">Select a quest on the left or create a new one to begin.</p>
						<button type="button" className="primary" onClick={handleCreateQuest}>Start a new quest</button>
					</div>
				)}
				{draft && (
					<>
						<nav className="quest-workspace-tabs" aria-label="Quest workspace views">
							{WORKSPACE_TABS.map(tab => (
								<button
									key={tab.id}
									type="button"
									className={`workspace-tab ${workspaceView === tab.id ? 'active' : ''}`}
									onClick={() => setWorkspaceView(tab.id)}
								>
									{tab.label}
								</button>
							))}
						</nav>
						<p className="muted workspace-helper">{activeWorkspaceMeta.helper}</p>
						{workspaceView === 'wizard' ? (
							<QuestWizard
								quest={draft}
								dirty={dirty}
								activeStep={activeStep}
								validationErrors={validationErrors}
								questLabel={selectedQuestTitle}
								templateService={systemTemplates}
								onStepChange={setActiveStep}
								onValidateStep={handleValidateStep}
								onChange={applyDraftPatch}
								onSystemChange={handleSystemChange}
								onReconChange={handleReconChange}
								onIntroEmailChange={handleIntroEmailChange}
								onCompletionEmailChange={handleCompletionEmailChange}
								onStepsChange={handleStepsChange}
								onRequirementsChange={handleRequirementsChange}
								onCancel={handleCancelDraft}
								onSave={handleSaveQuest}
							/>
						) : (
							<QuestStandaloneEditor
								questLabel={selectedQuestTitle}
								dirty={dirty}
								title={activeWorkspaceMeta.label}
								helper={activeWorkspaceMeta.helper}
								onCancel={handleCancelDraft}
								onSave={handleSaveQuest}
							>
								{workspaceView === 'overview' && (
									<QuestDetailsStep
										quest={draft}
										onChange={applyDraftPatch}
										onRequirementsChange={handleRequirementsChange}
										errors={validationErrors.details || []}
									/>
								)}
								{workspaceView === 'systems' && (
									<SystemDesignerStep
										questId={draft.id}
										system={draft.system}
										onChange={handleSystemChange}
										errors={validationErrors.system || []}
										templateService={systemTemplates}
									/>
								)}
								{workspaceView === 'recon' && (
									<ReconDiscoveryStep
										quest={draft}
										errors={validationErrors.recon || []}
										onChange={handleReconChange}
									/>
								)}
								{workspaceView === 'steps' && (
									<QuestStepsStep steps={draft.steps} onChange={handleStepsChange} errors={validationErrors.steps || []} />
								)}
								{workspaceView === 'mail' && (
									<div className="quest-mail-panel">
										<IntroEmailStep
											quest={draft}
											email={draft.introEmail}
											onChange={handleIntroEmailChange}
											errors={validationErrors.intro_email || []}
										/>
										<CompletionEmailStep
											quest={draft}
											email={draft.completionEmail}
											onChange={handleCompletionEmailChange}
											errors={validationErrors.completion_email || []}
										/>
									</div>
								)}
								{workspaceView === 'rewards' && (
									<RewardsPanel
										quest={draft}
										bonusObjectives={draft.bonusObjectives || []}
										onBonusChange={(next: BonusObjective[]) => applyDraftPatch({ bonusObjectives: next })}
										onQuestChange={applyDraftPatch}
									/>
								)}
							</QuestStandaloneEditor>
						)}
					</>
				)}
			</section>

			{unsavedPromptOpen && (
				<ConfirmDialog
					title="Discard unsaved changes?"
					message="Leaving now will abandon your current quest edits."
					confirmLabel="Discard & Continue"
					cancelLabel="Stay Here"
					onConfirm={handleDiscardConfirm}
					onCancel={handleDiscardCancel}
				/>
			)}

			{deleteTargetId && (
				<ConfirmDialog
					title="Delete quest?"
					message="This removes the quest from local storage."
					confirmLabel="Delete"
					cancelLabel="Cancel"
					onConfirm={confirmDeleteQuest}
					onCancel={cancelDeleteQuest}
				/>
			)}
		</div>
	)
}

interface QuestWizardProps {
	quest: QuestDefinition
	dirty: boolean
	activeStep: QuestWizardStep
	validationErrors: QuestValidationErrors
	questLabel: string
	templateService: SystemTemplateService
	onStepChange(step: QuestWizardStep): void
	onValidateStep(step: QuestWizardStep): string[]
	onChange(patch: Partial<QuestDefinition>): void
	onSystemChange(system: QuestSystemDefinition | undefined): void
	onReconChange(recon: QuestReconRequirements | undefined): void
	onIntroEmailChange(email: QuestIntroEmailConfig | undefined): void
	onCompletionEmailChange(email: QuestCompletionEmailConfig | undefined): void
	onStepsChange(steps: QuestStepDefinition[]): void
	onRequirementsChange(requirements: QuestRequirements): void
	onCancel(): void
	onSave(): void
}

const QuestWizard: React.FC<QuestWizardProps> = ({
	quest,
	dirty,
	activeStep,
	validationErrors,
	questLabel,
	templateService,
	onStepChange,
	onValidateStep,
	onChange,
	onSystemChange,
	onReconChange,
	onIntroEmailChange,
	onCompletionEmailChange,
	onStepsChange,
	onRequirementsChange,
	onCancel,
	onSave
}) => {
	const currentIndex = QUEST_WIZARD_STEPS.indexOf(activeStep)
	const isLastStep = activeStep === 'summary'

	const handleNext = () => {
		if (isLastStep) {
			onSave()
			return
		}
		const issues = onValidateStep(activeStep)
		if (issues.length > 0) return
		const nextStep = QUEST_WIZARD_STEPS[currentIndex + 1]
		if (nextStep) onStepChange(nextStep)
	}

	const handleBack = () => {
		if (currentIndex === 0) return
		const prevStep = QUEST_WIZARD_STEPS[currentIndex - 1]
		onStepChange(prevStep)
	}

	const renderStepContent = () => {
		switch (activeStep) {
			case 'details':
				return (
					<QuestDetailsStep
						quest={quest}
						onChange={onChange}
						onRequirementsChange={onRequirementsChange}
						errors={validationErrors.details || []}
					/>
				)
			case 'system':
				return (
					<SystemDesignerStep
						questId={quest.id}
						system={quest.system}
						onChange={onSystemChange}
						errors={validationErrors.system || []}
						templateService={templateService}
					/>
				)
			case 'recon':
				return (
					<ReconDiscoveryStep
						quest={quest}
						errors={validationErrors.recon || []}
						onChange={onReconChange}
					/>
				)
			case 'intro_email':
				return (
					<IntroEmailStep
						quest={quest}
						email={quest.introEmail}
						onChange={onIntroEmailChange}
						errors={validationErrors.intro_email || []}
					/>
				)
			case 'steps':
				return (
					<QuestStepsStep
						steps={quest.steps}
						onChange={onStepsChange}
						errors={validationErrors.steps || []}
					/>
				)
			case 'completion_email':
				return (
					<CompletionEmailStep
						quest={quest}
						email={quest.completionEmail}
						onChange={onCompletionEmailChange}
						errors={validationErrors.completion_email || []}
					/>
				)
			case 'summary':
			default:
				return <SummaryStep quest={quest} errors={validationErrors} />
		}
	}

	return (
		<div className="quest-wizard">
			<header className="quest-wizard-header">
				<div>
					<p className="muted">Editing • {questLabel}</p>
					{dirty && <span className="pill warning">Unsaved changes</span>}
				</div>
				<nav className="quest-stepper" aria-label="Quest wizard steps">
					{QUEST_WIZARD_STEPS.map((step, index) => {
						const label = STEP_LABELS[step]
						const state =
							index < currentIndex && !(validationErrors as any)[step]?.length
								? 'complete'
								: (validationErrors as any)[step]?.length
									? 'error'
									: index === currentIndex
										? 'active'
										: 'pending'
						return (
							<button
								key={step}
								type="button"
								className={`step-chip ${state}`}
								disabled={index > currentIndex + 1}
								onClick={() => {
									if (index <= currentIndex) onStepChange(step)
								}}
							>
								<span className="step-index">{index + 1}</span>
								<span>{label.title}</span>
							</button>
						)
					})}
				</nav>
				<p className="muted step-helper">{STEP_LABELS[activeStep].helper}</p>
			</header>
			<div className="quest-wizard-body">
				{renderStepContent()}
			</div>
			<footer className="quest-wizard-footer">
				<button type="button" className="ghost" onClick={onCancel}>Cancel</button>
				<div className="spacer" />
				<button type="button" className="ghost" onClick={handleBack} disabled={currentIndex === 0}>Back</button>
				<button type="button" className="primary" onClick={handleNext}>
					{isLastStep ? 'Save Quest' : 'Next'}
				</button>
			</footer>
		</div>
	)
}

interface QuestStandaloneEditorProps {
	title: string
	helper: string
	questLabel: string
	dirty: boolean
	onCancel(): void
	onSave(): void
	children: React.ReactNode
}

const QuestStandaloneEditor: React.FC<QuestStandaloneEditorProps> = ({
	title,
	helper,
	questLabel,
	dirty,
	onCancel,
	onSave,
	children
}) => (
	<div className="quest-wizard quest-standalone">
		<header className="quest-wizard-header">
			<div>
				<p className="muted">Editing • {questLabel}</p>
				{dirty && <span className="pill warning">Unsaved changes</span>}
			</div>
			<h3>{title}</h3>
			<p className="muted step-helper">{helper}</p>
		</header>
		<div className="quest-wizard-body">{children}</div>
		<footer className="quest-wizard-footer">
			<button type="button" className="ghost" onClick={onCancel}>Cancel</button>
			<div className="spacer" />
			<button type="button" className="primary" onClick={onSave}>Save Quest</button>
		</footer>
	</div>
)

const createEmptyBonusObjective = (): BonusObjective => ({
	id: generateId('bonus'),
	title: '',
	description: '',
	category: 'stealth',
	type: 'keep_trace_below',
	params: {},
	rewardDescription: ''
})

interface RewardsPanelProps {
	quest: QuestDefinition
	bonusObjectives: BonusObjective[]
	onBonusChange(next: BonusObjective[]): void
	onQuestChange(patch: Partial<QuestDefinition>): void
}

type RewardOutcomeKey = 'success' | 'stealth' | 'failure'

const RewardsPanel: React.FC<RewardsPanelProps> = ({ quest, bonusObjectives, onBonusChange, onQuestChange }) => {
	const rewards = quest.rewards || {}
	const branching = quest.branching || {}

	const updateRewardField = (
		key: RewardOutcomeKey,
		field: keyof NonNullable<QuestRewardsMatrix[RewardOutcomeKey]>,
		value: any
	) => {
		const base = rewards[key] || {}
		const nextMatrix: QuestRewardsMatrix = { ...rewards, [key]: { ...base, [field]: value } }
		onQuestChange({ rewards: nextMatrix })
	}

	const updateBranching = (key: RewardOutcomeKey, patch: Partial<QuestBranchOutcome>) => {
		onQuestChange({ branching: { ...branching, [key]: { ...(branching[key] || {}), ...patch } } })
	}

	const updateObjective = (index: number, patch: Partial<BonusObjective>) => {
		onBonusChange(bonusObjectives.map((objective, idx) => (idx === index ? { ...objective, ...patch } : objective)))
	}

	const handleRemoveObjective = (index: number) => {
		onBonusChange(bonusObjectives.filter((_, idx) => idx !== index))
	}

	const handleAddObjective = () => {
		onBonusChange([...(bonusObjectives || []), createEmptyBonusObjective()])
	}

	const parseList = (value: string): string[] => value.split(',').map(token => token.trim()).filter(Boolean)
	const formatList = (value?: string[]) => value?.join(', ') ?? ''
	const serializeFlags = (flags?: { key: string; value?: string }[]) => flags?.map(flag => (flag.value ? `${flag.key}=${flag.value}` : flag.key)).join('\n') || ''
	const parseFlags = (value: string) => value.split(/\n+/).map(line => line.trim()).filter(Boolean).map(entry => {
		const [key, ...rest] = entry.split(/[:=]/)
		return { key: key.trim(), value: rest.length ? rest.join('=').trim() || undefined : undefined }
	})
	const formatReputation = (record?: Record<string, number>) => (
		record ? Object.entries(record).map(([faction, score]) => `${faction}:${score}`).join('\n') : ''
	)
	const parseReputation = (raw: string) => {
		const entries = raw.split(/\n+/).map(line => line.trim()).filter(Boolean)
		const result: Record<string, number> = {}
		entries.forEach(line => {
			const [faction, value] = line.split(/[:=]/)
			if (!faction) return
			const parsed = Number(value)
			if (Number.isFinite(parsed)) {
				result[faction.trim()] = parsed
			}
		})
		return result
	}

	const handleParamValueChange = (objectiveIndex: number, key: string, value: string) => {
		const params = { ...(bonusObjectives[objectiveIndex].params || {}) }
		params[key] = value
		updateObjective(objectiveIndex, { params })
	}

	const handleParamKeyChange = (objectiveIndex: number, originalKey: string, nextKey: string) => {
		const params = { ...(bonusObjectives[objectiveIndex].params || {}) }
		const existingValue = params[originalKey]
		delete params[originalKey]
		if (nextKey.trim()) {
			params[nextKey.trim()] = existingValue ?? ''
		}
		updateObjective(objectiveIndex, { params })
	}

	const handleAddParam = (objectiveIndex: number) => {
		const params = { ...(bonusObjectives[objectiveIndex].params || {}) }
		const placeholderKey = `param_${Object.keys(params).length + 1}`
		params[placeholderKey] = ''
		updateObjective(objectiveIndex, { params })
	}

	const handleRemoveParam = (objectiveIndex: number, key: string) => {
		const params = { ...(bonusObjectives[objectiveIndex].params || {}) }
		delete params[key]
		updateObjective(objectiveIndex, { params })
	}

	const OUTCOMES: Array<{ key: RewardOutcomeKey; label: string; helper: string }> = [
		{ key: 'success', label: 'Success', helper: 'Primary objectives complete.' },
		{ key: 'stealth', label: 'Stealth Success', helper: 'Primary + all stealth objectives.' },
		{ key: 'failure', label: 'Failure / Detected', helper: 'Trace blown or objectives missed.' }
	]

	return (
		<div className="wizard-form rewards-panel">
			<section>
				<header>
					<h4>Outcome rewards</h4>
					<p className="muted">Define payouts per outcome tier.</p>
				</header>
				<div className="reward-grid">
					{OUTCOMES.map(outcome => {
						const block = rewards[outcome.key] || {}
						return (
							<article key={outcome.key} className="reward-card">
								<header>
									<strong>{outcome.label}</strong>
									<p className="muted">{outcome.helper}</p>
								</header>
								<label>
									Credits
									<input
										type="number"
										value={block.credits ?? ''}
										onChange={e => updateRewardField(outcome.key, 'credits', e.target.value ? Number(e.target.value) : undefined)}
									/>
								</label>
								<label>
									Tools unlocked
									<input
										value={formatList(block.tools)}
										onChange={e => updateRewardField(outcome.key, 'tools', parseList(e.target.value))}
										placeholder="overclock, ghostscan"
									/>
								</label>
								<label>
									Access granted (hosts, creds)
									<input
										value={formatList(block.access)}
										onChange={e => updateRewardField(outcome.key, 'access', parseList(e.target.value))}
										placeholder="corp-internal, vpn-alpha"
									/>
								</label>
								<label>
									Unlock commands
									<input
										value={formatList(block.unlocks_commands)}
										onChange={e => updateRewardField(outcome.key, 'unlocks_commands', parseList(e.target.value))}
										placeholder="deep_scan"
									/>
								</label>
								<label>
									Reputation (faction:points per line)
									<textarea
										rows={3}
										value={formatReputation(block.reputation)}
										onChange={e => updateRewardField(outcome.key, 'reputation', parseReputation(e.target.value))}
									/>
								</label>
								<label>
									Flags set (one per line)
									<textarea
										rows={3}
										value={serializeFlags(block.flags)}
										onChange={e => updateRewardField(outcome.key, 'flags', parseFlags(e.target.value))}
									/>
								</label>
							</article>
						)
					})}
				</div>
			</section>
			<section>
				<header>
					<h4>Branching outcomes</h4>
					<p className="muted">Hook follow-up quests, world flags, and alternate emails per outcome.</p>
				</header>
				<div className="reward-grid">
					{OUTCOMES.map(outcome => {
						const block = branching[outcome.key] || {}
						return (
							<article key={`branch-${outcome.key}`} className="reward-card">
								<header>
									<strong>{outcome.label}</strong>
								</header>
								<label>
									Follow-up quest ID
									<input value={block.followUpQuestId || ''} onChange={e => updateBranching(outcome.key, { followUpQuestId: e.target.value })} />
								</label>
								<label>
									Completion email variant ID
									<input value={block.emailVariantId || ''} onChange={e => updateBranching(outcome.key, { emailVariantId: e.target.value })} />
								</label>
								<label>
									Set flags (one per line)
									<textarea
										rows={3}
										value={serializeFlags(block.setFlags)}
										onChange={e => updateBranching(outcome.key, { setFlags: parseFlags(e.target.value) })}
									/>
								</label>
								<label>
									Requires flags
									<textarea
										rows={3}
										value={serializeFlags(block.requireFlags)}
										onChange={e => updateBranching(outcome.key, { requireFlags: parseFlags(e.target.value) })}
									/>
								</label>
								<label>
									Outcome note
									<textarea rows={2} value={block.notes || ''} onChange={e => updateBranching(outcome.key, { notes: e.target.value })} />
								</label>
							</article>
						)
					})}
				</div>
			</section>
			<section>
				<header>
					<h4>Bonus & stealth objectives</h4>
					<p className="muted">Mark stealth goals to distinguish stealth completions.</p>
				</header>
				{bonusObjectives.length === 0 && <p className="muted">No bonus objectives yet. Add one to start experimenting.</p>}
				<ol className="step-list">
					{bonusObjectives.map((objective, index) => (
						<li key={objective.id} className="step-card">
							<div className="step-card-header">
								<span>Bonus {index + 1}</span>
								<button type="button" className="ghost" onClick={() => handleRemoveObjective(index)}>Remove</button>
							</div>
							<label>
								Title (optional)
								<input value={objective.title || ''} onChange={e => updateObjective(index, { title: e.target.value })} placeholder="Ghosted Trace" />
							</label>
							<label>
								Description
								<textarea
									rows={3}
									value={objective.description}
									onChange={e => updateObjective(index, { description: e.target.value })}
									placeholder="Keep trace meter below 40 for the entire run."
								/>
							</label>
							<label>
								Objective Category
								<select value={objective.category || 'stealth'} onChange={e => updateObjective(index, { category: e.target.value as BonusObjective['category'] })}>
									<option value="stealth">Stealth</option>
									<option value="optional">Optional</option>
									<option value="cleanup">Cleanup</option>
								</select>
							</label>
							<label>
								Bonus Type
								<select value={objective.type} onChange={e => updateObjective(index, { type: e.target.value as BonusObjective['type'] })}>
									{BONUS_OBJECTIVE_TYPES.map(type => (
										<option key={type} value={type}>{BONUS_TYPE_LABELS[type]}</option>
									))}
								</select>
							</label>
							<label>
								Reward Description (optional)
								<input
									value={objective.rewardDescription || ''}
									onChange={e => updateObjective(index, { rewardDescription: e.target.value })}
									placeholder="Atlas grants extra 200 credits."
								/>
							</label>
							<div className="param-list">
								<div className="param-list-header">
									<strong>Params</strong>
									<button type="button" className="ghost" onClick={() => handleAddParam(index)}>Add Param</button>
								</div>
								{Object.entries(objective.params || {}).map(([key, value]) => (
									<div key={key} className="param-row">
										<input
											value={key}
											onChange={e => handleParamKeyChange(index, key, e.target.value)}
											placeholder="Key"
										/>
										<input
											value={String(value ?? '')}
											onChange={e => handleParamValueChange(index, key, e.target.value)}
											placeholder="Value"
										/>
										<button type="button" className="ghost" onClick={() => handleRemoveParam(index, key)}>Remove</button>
									</div>
								))}
								{Object.keys(objective.params || {}).length === 0 && <p className="muted">No params assigned.</p>}
							</div>
						</li>
					))}
				</ol>
				<button type="button" className="ghost" onClick={handleAddObjective}>+ Add Bonus Objective</button>
			</section>
		</div>
	)
}

interface QuestDetailsStepProps {
	quest: QuestDefinition
	errors: string[]
	onChange(patch: Partial<QuestDefinition>): void
	onRequirementsChange(requirements: QuestRequirements): void
}

interface ToolDropdownProps {
	selected: HackingToolId[]
	onChange(next: HackingToolId[]): void
}

const ToolDropdown: React.FC<ToolDropdownProps> = ({ selected, onChange }) => {
	const [open, setOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (!containerRef.current) return
			if (!containerRef.current.contains(event.target as Node)) {
				setOpen(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	const toggleTool = (toolId: HackingToolId) => {
		const next = selected.includes(toolId)
			? selected.filter(id => id !== toolId)
			: [...selected, toolId]
		onChange(next)
	}

	const summaryLabel = selected.length
		? `${selected.length} tool${selected.length === 1 ? '' : 's'} selected`
		: 'Select required tools'

	return (
		<div className={`tool-dropdown ${open ? 'open' : ''}`} ref={containerRef}>
			<button
				type="button"
				className="tool-dropdown-trigger"
				onClick={() => setOpen(value => !value)}
				aria-haspopup="listbox"
				aria-expanded={open}
			>
				{summaryLabel}
			</button>
			{open && (
				<div className="tool-dropdown-panel" role="listbox" aria-multiselectable>
					{TOOL_OPTION_DETAILS.map(option => {
						const checked = selected.includes(option.id)
						return (
							<label key={option.id} className="tool-dropdown-option">
								<input
									type="checkbox"
									checked={checked}
									onChange={() => toggleTool(option.id)}
								/>
								<div>
									<strong>{option.label}</strong>
									<p className="muted">{option.description}</p>
								</div>
							</label>
						)
					})}
				</div>
			)}
		</div>
	)
}

const QuestDetailsStep: React.FC<QuestDetailsStepProps> = ({ quest, errors, onChange, onRequirementsChange }) => {
	const currentRisk: QuestRiskProfile = quest.riskProfile || { ...DEFAULT_RISK_PROFILE }
	const updateRisk = (patch: Partial<QuestRiskProfile>) => {
		onChange({ riskProfile: { ...currentRisk, ...patch } })
	}

	const updateRequirements = (patch: Partial<QuestRequirements>) => {
		onRequirementsChange({ ...(quest.requirements || {}), ...patch })
	}

	const selectedTools = quest.requirements?.requiredTools || []

	const serializeFlagList = (flags?: { key: string; value?: string }[]) => (
		flags?.map(flag => (flag.value ? `${flag.key}=${flag.value}` : flag.key)).join('\n') || ''
	)

	const parseFlagList = (value: string) => (
		value
			.split(/\n+/)
			.map(line => line.trim())
			.filter(Boolean)
			.map(entry => {
				const [key, ...rest] = entry.split(/[:=]/)
				return { key: key.trim(), value: rest.length ? rest.join('=').trim() || undefined : undefined }
			})
	)

	return (
		<div className="wizard-form">
			{errors.length > 0 && (
				<div className="inline-alert error" role="alert">
					<strong>Fix these before continuing</strong>
					<ul>{errors.map(err => <li key={err}>{err}</li>)}</ul>
				</div>
			)}
			<label>
				Title
				<input value={quest.title} onChange={e => onChange({ title: e.target.value })} placeholder="Atlas needs help" />
			</label>
			<label>
				Short Description
				<textarea
					value={quest.shortDescription}
					rows={3}
					placeholder="Brief summary shown in quest lists."
					onChange={e => onChange({ shortDescription: e.target.value })}
				/>
			</label>
			<div className="field-row">
				<label>
					Difficulty
					<select value={quest.difficulty} onChange={e => onChange({ difficulty: e.target.value as SystemDifficulty })}>
						{DIFFICULTY_ORDER.map(level => (
							<option key={level} value={level}>{DIFFICULTY_LABELS[level]}</option>
						))}
					</select>
				</label>
				<label>
					Quest Type
					<select value={quest.questType || 'recon'} onChange={e => onChange({ questType: e.target.value as QuestType })}>
						{QUEST_TYPE_OPTIONS.map(option => (
							<option key={option.id} value={option.id}>{option.label}</option>
						))}
					</select>
					<small className="muted">{QUEST_TYPE_OPTIONS.find(opt => opt.id === (quest.questType || 'recon'))?.helper}</small>
				</label>
			</div>
			<div className="field-row">
				<label>
					Recommended Order
					<input
						type="number"
						value={quest.recommendedOrder ?? ''}
						onChange={e => onChange({ recommendedOrder: e.target.value ? Number(e.target.value) : undefined })}
						placeholder="Optional"
					/>
				</label>
				<fieldset className="tool-select-field">
					<legend>
						Required Tools
						<small className="muted">{TOOL_OPTION_DETAILS.length} tools available. Pick the utilities this quest expects.</small>
					</legend>
					<ToolDropdown selected={selectedTools} onChange={next => updateRequirements({ requiredTools: next })} />
					<small className="muted">Each option lists what the tool does so authors can set expectations.</small>
				</fieldset>
			</div>
			<section className="risk-profile">
				<header>
					<h4>Risk Profile</h4>
					<p className="muted">Trace guardrails and cleanup expectations.</p>
				</header>
				<div className="field-row">
					<label>
						Max recommended trace %
						<input
							type="number"
							min={0}
							max={100}
							value={currentRisk.maxRecommendedTrace ?? ''}
							onChange={e => updateRisk({ maxRecommendedTrace: e.target.value ? Number(e.target.value) : undefined })}
						/>
					</label>
					<label>
						Fail if trace exceeds %
						<input
							type="number"
							min={0}
							max={100}
							value={currentRisk.failAboveTrace ?? ''}
							onChange={e => updateRisk({ failAboveTrace: e.target.value ? Number(e.target.value) : undefined })}
						/>
					</label>
					<label>
						Required trace spike % (optional)
						<input
							type="number"
							min={0}
							max={100}
							value={currentRisk.requiredTraceSpike ?? ''}
							onChange={e => updateRisk({ requiredTraceSpike: e.target.value ? Number(e.target.value) : undefined })}
						/>
					</label>
				</div>
				<label className="checkbox">
					<input
						type="checkbox"
						checked={Boolean(currentRisk.cleanupBeforeDisconnect)}
						onChange={e => updateRisk({ cleanupBeforeDisconnect: e.target.checked })}
					/>
					<span>Require log cleanup before disconnecting</span>
				</label>
			</section>
			<section className="requirements-section">
				<header>
					<h4>World Flags</h4>
					<p className="muted">Gate quests or block them when certain flags exist.</p>
				</header>
				<div className="field-row">
					<label>
						Requires flags (one per line, key or key=value)
						<textarea
							rows={3}
							value={serializeFlagList(quest.requirements?.requiredFlags)}
							onChange={e => updateRequirements({ requiredFlags: parseFlagList(e.target.value) })}
						/>
					</label>
					<label>
						Blocked when flags present
						<textarea
							rows={3}
							value={serializeFlagList(quest.requirements?.blockedByFlags)}
							onChange={e => updateRequirements({ blockedByFlags: parseFlagList(e.target.value) })}
						/>
					</label>
				</div>
			</section>
		</div>
	)
}

interface ReconDiscoveryStepProps {
	quest: QuestDefinition
	errors: string[]
	onChange(recon: QuestReconRequirements | undefined): void
}

const serializeReconList = (list?: string[]) => list?.join('\n') ?? ''

const parseReconList = (value: string): string[] => (
	value
		.split(/\n+/)
		.map(entry => entry.trim())
		.filter(Boolean)
)

const buildDefaultRecon = (): QuestReconRequirements => ({
	enabled: true,
	mustUseScan: true,
	discoveryTargets: [],
	allowedRanges: [],
	forbiddenRanges: []
})

const ReconDiscoveryStep: React.FC<ReconDiscoveryStepProps> = ({ quest, errors, onChange }) => {
	const recon = quest.reconRequirements
	const enabled = recon?.enabled ?? false
	const targets = recon?.discoveryTargets ?? []

	const ensureRecon = (): QuestReconRequirements => recon ? { ...recon, discoveryTargets: [...(recon.discoveryTargets ?? [])] } : buildDefaultRecon()

	const updateRecon = (patch: Partial<QuestReconRequirements>) => {
		const base = ensureRecon()
		onChange({ ...base, ...patch, enabled: true })
	}

	const toggleEnabled = (checked: boolean) => {
		if (!checked) {
			onChange(undefined)
			return
		}
		if (recon?.enabled) {
			onChange({ ...recon, enabled: true })
			return
		}
		onChange(buildDefaultRecon())
	}

	const updateTargets = (nextTargets: QuestReconDiscoveryTarget[]) => {
		updateRecon({ discoveryTargets: nextTargets })
	}

	const addSystemTarget = () => {
		if (!quest.system) return
		if (targets.some(target => target.hostId === quest.system?.id)) return
		updateTargets([...targets, { hostId: quest.system.id, rangeHint: '' }])
	}

	const addManualTarget = () => {
		updateTargets([...targets, { hostId: '', rangeHint: '' }])
	}

	const updateTargetField = (index: number, field: keyof QuestReconDiscoveryTarget, value: string) => {
		const next = targets.map((target, targetIndex) => (
			targetIndex === index ? { ...target, [field]: value } : target
		))
		updateTargets(next)
	}

	const removeTarget = (index: number) => {
		const next = targets.filter((_, targetIndex) => targetIndex !== index)
		updateTargets(next)
	}

	const allowedRangesValue = serializeReconList(recon?.allowedRanges)
	const forbiddenRangesValue = serializeReconList(recon?.forbiddenRanges)
	const stealthConstraintsEnabled = Boolean(
		recon?.allowedRanges?.length || recon?.forbiddenRanges?.length || typeof recon?.maxReconTracePercent === 'number'
	)
	const hasRangeHints = targets.some(target => target.rangeHint?.trim())
	const needsHintWarning = enabled && stealthConstraintsEnabled && !hasRangeHints
	const maxTraceValue = typeof recon?.maxReconTracePercent === 'number' ? recon.maxReconTracePercent : undefined

	return (
		<div className="recon-step">
			{errors.length > 0 && (
				<div className="inline-alert error" role="alert">
					<strong>Fix these before continuing</strong>
					<ul>{errors.map(err => <li key={err}>{err}</li>)}</ul>
				</div>
			)}
			<label className="checkbox">
				<input type="checkbox" checked={enabled} onChange={e => toggleEnabled(e.target.checked)} />
				<span>Does this quest involve discovering a target via recon?</span>
			</label>
			<p className="muted">Enable this when players must run scan before progressing the quest.</p>
			{enabled && !quest.system && (
				<div className="inline-alert info">
					Add a system to surface real host targets. You can still add manual placeholders below.
				</div>
			)}
			{enabled && (
				<>
					<section className="recon-section">
						<header>
							<h4>Discovery Targets</h4>
							<p className="muted">Pick which hosts must appear in scan results and add optional range hints.</p>
						</header>
						<div className="recon-target-actions">
							<button type="button" className="ghost" onClick={addSystemTarget} disabled={!quest.system || targets.some(target => target.hostId === quest.system?.id)}>
								Add target system
							</button>
							<button type="button" className="ghost" onClick={addManualTarget}>Add manual target</button>
						</div>
						{targets.length === 0 && (
							<p className="muted">No discovery targets selected yet.</p>
						)}
						<div className="recon-target-list">
							{targets.map((target, index) => (
								<div key={`${target.hostId || 'manual'}-${index}`} className="recon-target-card">
									<label>
										Host ID
										<input value={target.hostId} onChange={e => updateTargetField(index, 'hostId', e.target.value)} placeholder="quest-system-id or hostname" />
									</label>
									<label>
										Range hint (optional)
										<input value={target.rangeHint ?? ''} onChange={e => updateTargetField(index, 'rangeHint', e.target.value)} placeholder="e.g. 10.0.5.0/24 lab" />
									</label>
									<button type="button" className="ghost danger" onClick={() => removeTarget(index)}>Remove</button>
								</div>
							))}
						</div>
					</section>
					<section className="recon-section">
						<header>
							<h4>Stealth Constraints</h4>
							<p className="muted">Optional guardrails that define where and how players may scan.</p>
						</header>
						<div className="recon-constraints-grid">
							<label>
								Allowed ranges (one per line)
								<textarea
									rows={3}
									value={allowedRangesValue}
									onChange={e => updateRecon({ allowedRanges: parseReconList(e.target.value) })}
								/>
							</label>
							<label>
								Forbidden ranges (one per line)
								<textarea
									rows={3}
									value={forbiddenRangesValue}
									onChange={e => updateRecon({ forbiddenRanges: parseReconList(e.target.value) })}
								/>
							</label>
							<div className="recon-trace-cap">
								<label>
									Max trace during recon (%): {typeof maxTraceValue === 'number' ? `${maxTraceValue}%` : 'No cap'}
								</label>
								<input
									type="range"
									min={10}
									max={100}
									step={5}
									value={typeof maxTraceValue === 'number' ? maxTraceValue : 60}
									onChange={e => updateRecon({ maxReconTracePercent: Number(e.target.value) })}
								/>
								<div className="recon-trace-actions">
									<button type="button" className="ghost" onClick={() => updateRecon({ maxReconTracePercent: undefined })}>
										Clear cap
									</button>
								</div>
							</div>
						</div>
						<label className="checkbox">
							<input
								type="checkbox"
								checked={Boolean(recon?.mustUseScan ?? true)}
								onChange={e => updateRecon({ mustUseScan: e.target.checked })}
							/>
							<span>Require players to use scan before other commands</span>
						</label>
						{needsHintWarning && (
							<div className="inline-alert warning">
								Add at least one range hint so players know where stealth scans are expected.
							</div>
						)}
					</section>
				</>
			)}
		</div>
	)
}

interface IntroEmailStepProps {
	quest: QuestDefinition
	email?: QuestIntroEmailConfig
	errors: string[]
	onChange(email: QuestIntroEmailConfig | undefined): void
}

const IntroEmailStep: React.FC<IntroEmailStepProps> = ({ quest, email, errors, onChange }) => {
	const subjectRef = useRef<HTMLInputElement | null>(null)
	const bodyRef = useRef<HTMLTextAreaElement | null>(null)
	const [focusedField, setFocusedField] = useState<'subject' | 'body'>('subject')
	const workingEmail: QuestIntroEmailConfig = {
		from: email?.from || DEFAULT_MAIL_SENDER,
		subject: email?.subject || '',
		body: email?.body || '',
		preheader: email?.preheader || ''
	}

	const patchEmail = (patch: Partial<QuestIntroEmailConfig>) => {
		onChange({ ...workingEmail, ...patch })
	}

	const handleUseTemplate = () => {
		const title = quest.title || 'Untitled operation'
		const systemName = quest.system?.label || 'unassigned system'
		patchEmail({
			from: workingEmail.from || DEFAULT_MAIL_SENDER,
			subject: `Atlas orders: ${title}`,
			preheader: `Target: ${systemName}`,
			body: `Operator,\n\nAtlas needs you on ${systemName}. ${quest.shortDescription || 'Describe the stakes and desired outcome.'}\n\n– Control`
		})
	}

	const handleInsertToken = (token: string) => {
		const field = focusedField
		const ref = field === 'subject' ? subjectRef.current : bodyRef.current
		if (!ref) {
			const fallback = (field === 'subject' ? workingEmail.subject : workingEmail.body) + token
			patchEmail(field === 'subject' ? { subject: fallback } : { body: fallback })
			return
		}
		const start = ref.selectionStart ?? ref.value.length
		const end = ref.selectionEnd ?? ref.value.length
		const base = ref.value
		const updated = `${base.slice(0, start)}${token}${base.slice(end)}`
		patchEmail(field === 'subject' ? { subject: updated } : { body: updated })
		requestAnimationFrame(() => {
			ref.selectionStart = ref.selectionEnd = start + token.length
		})
	}

	const questSystem = quest.system?.label || 'Unassigned system'
	const questDifficulty = DIFFICULTY_LABELS[quest.difficulty]
	const previewSnippet = workingEmail.preheader || workingEmail.body

	return (
		<div className="mail-step">
			{errors.length > 0 && (
				<div className="inline-alert error" role="alert">
					<strong>Intro email issues</strong>
					<ul>{errors.map(err => <li key={err}>{err}</li>)}</ul>
				</div>
			)}
			<div className="mail-step__grid">
				<aside className="mail-context-card">
					<p className="eyebrow">Mission context</p>
					<ul>
						<li><strong>Quest:</strong> {quest.title || 'Untitled quest'}</li>
						<li><strong>Target:</strong> {questSystem}</li>
						<li><strong>Difficulty:</strong> {questDifficulty}</li>
						<li><strong>Summary:</strong> {quest.shortDescription || 'Add a short description on the Details step.'}</li>
					</ul>
					<div className="mail-quick-actions">
						<p className="muted">Preferred handler</p>
						<div className="mail-chip-row">
							{MAIL_PERSONAS.map(persona => (
								<button
									key={persona}
									type="button"
									className={`mail-chip ${workingEmail.from === persona ? 'active' : ''}`}
									onClick={() => patchEmail({ from: persona })}
								>
									{persona.split('<')[0].trim()}
								</button>
							))}
						</div>
						<button type="button" className="ghost" onClick={handleUseTemplate}>Use briefing template</button>
						<button type="button" className="ghost danger" onClick={() => onChange(undefined)}>Clear intro email</button>
					</div>
				</aside>
				<section className="mail-step__composer">
					<label>
						From
						<input value={workingEmail.from || ''} onChange={e => patchEmail({ from: e.target.value })} />
					</label>
					<label>
						Subject
						<input
							ref={subjectRef}
							value={workingEmail.subject}
							onFocus={() => setFocusedField('subject')}
							onChange={e => patchEmail({ subject: e.target.value })}
						/>
					</label>
					<label>
						Preheader (optional)
						<input value={workingEmail.preheader || ''} onChange={e => patchEmail({ preheader: e.target.value })} />
					</label>
					<label>
						Body
						<textarea
							ref={bodyRef}
							rows={8}
							value={workingEmail.body}
							onFocus={() => setFocusedField('body')}
							onChange={e => patchEmail({ body: e.target.value })}
							placeholder={'Operator,\n\nIntel suggests…'}
						/>
					</label>
					<div className="mail-token-bar" role="toolbar" aria-label="Token shortcuts">
						<span>Insert token:</span>
						{INTRO_TOKEN_CATALOG.map(entry => (
							<button key={entry.token} type="button" className="mail-chip" onClick={() => handleInsertToken(entry.token)}>
								{entry.label}
							</button>
						))}
					</div>
					<EmailPreviewCard
						title="Inbox preview"
						from={workingEmail.from}
						subject={workingEmail.subject}
						snippet={previewSnippet}
					/>
				</section>
			</div>
		</div>
	)
}

interface EmailPreviewCardProps {
	title: string
	from?: string
	subject?: string
	snippet?: string
}

const EmailPreviewCard: React.FC<EmailPreviewCardProps> = ({ title, from, subject, snippet }) => (
	<div className="mail-preview-card">
		<header>
			<p className="eyebrow">{title}</p>
			<span className="muted">Player inbox</span>
		</header>
		<div className="mail-preview-card__body">
			<p className="mail-preview-from">{from || DEFAULT_MAIL_SENDER}</p>
			<p className="mail-preview-subject">{subject || 'Set a compelling subject'}</p>
			<p className="mail-preview-snippet">{snippet || 'Preheader or the first line of the body appears here.'}</p>
		</div>
	</div>
)

interface QuestStepsStepProps {
	steps: QuestStepDefinition[]
	errors: string[]
	onChange(steps: QuestStepDefinition[]): void
}

const QuestStepsStep: React.FC<QuestStepsStepProps> = ({ steps, errors, onChange }) => {
	const updateStep = (index: number, patch: Partial<QuestStepDefinition>) => {
		const next = steps.map((step, idx) => (idx === index ? { ...step, ...patch } : step))
		onChange(next)
	}

	const removeStep = (index: number) => {
		const next = steps.filter((_, idx) => idx !== index)
		onChange(next)
	}

	const addStep = () => {
		onChange([...(steps || []), { id: generateId('step'), type: 'scan', description: '' }])
	}

	return (
		<div className="wizard-form">
			{errors.length > 0 && (
				<div className="inline-alert error" role="alert">
					<strong>Step list incomplete</strong>
					<ul>{errors.map(err => <li key={err}>{err}</li>)}</ul>
				</div>
			)}
			<p className="muted">Map the high-level beats. Detailed mechanics arrive in Batch 4.</p>
			{steps.length === 0 && <p className="muted">No steps yet. Add your first step.</p>}
			<ol className="step-list">
				{steps.map((step, index) => (
					<li key={step.id} className="step-card">
						<div className="step-card-header">
							<span>Step {index + 1}</span>
							<button type="button" className="ghost" onClick={() => removeStep(index)}>Remove</button>
						</div>
						<label>
							Step Type
							<select value={step.type} onChange={e => updateStep(index, { type: e.target.value })}>
								{STEP_TYPE_OPTIONS.map(option => (
									<option key={option} value={option}>{option}</option>
								))}
							</select>
						</label>
						<label>
							Description
							<textarea
								rows={3}
								placeholder="Explain what the player must do."
								value={step.description || ''}
								onChange={e => updateStep(index, { description: e.target.value })}
							/>
						</label>
					</li>
				))}
			</ol>
			<button type="button" className="ghost" onClick={addStep}>+ Add Step</button>
		</div>
	)
}

interface CompletionEmailStepProps {
	quest: QuestDefinition
	email?: QuestCompletionEmailConfig
	errors: string[]
	onChange(email: QuestCompletionEmailConfig | undefined): void
}

const CompletionEmailStep: React.FC<CompletionEmailStepProps> = ({ quest, email, errors, onChange }) => {
	const defaultEmail: MailTemplateFields = {
		from: email?.default?.from || DEFAULT_MAIL_SENDER,
		subject: email?.default?.subject || '',
		preheader: email?.default?.preheader || '',
		body: email?.default?.body || ''
	}
	const variants = email?.variants ?? []

	const persist = (nextDefault: MailTemplateFields, nextVariants: CompletionEmailVariant[]) => {
		onChange({
			default: nextDefault,
			variants: nextVariants.length > 0 ? nextVariants : undefined
		})
	}

	const patchDefault = (patch: Partial<MailTemplateFields>) => {
		persist({ ...defaultEmail, ...patch }, variants)
	}

	const useCelebrationTemplate = () => {
		const questName = quest.title || 'this operation'
		patchDefault({
			subject: `Debrief: ${questName}`,
			preheader: 'Atlas confirms objective success.',
			body: `Operator,\n\nAtlas confirms the mission "${questName}" succeeded. Summarize the key outcomes and reward delivery.\n\nTrace stayed at {TRACE_RESULT}. ${quest.bonusObjectives?.length ? 'Bonus objectives summarized in {BONUS_SUMMARY}.' : ''}\n\n– Control`
		})
	}

	const handleClear = () => {
		onChange(undefined)
	}

	const createConditionTemplate = (
		type: CompletionEmailVariantCondition['type']
	): CompletionEmailVariantCondition => {
		switch (type) {
			case 'trace_below':
				return { type, data: { threshold: 30 } }
			case 'bonus_objective_completed': {
				const firstBonus = quest.bonusObjectives?.[0]?.id || ''
				return { type, data: { objectiveId: firstBonus } }
			}
			case 'trap_triggered':
			default:
				return { type: 'trap_triggered', data: { trapId: '' } }
		}
	}

	const mutateVariants = (mutator: (current: CompletionEmailVariant[]) => CompletionEmailVariant[]) => {
		persist(defaultEmail, mutator(variants))
	}

	const mutateVariant = (variantId: string, mutator: (variant: CompletionEmailVariant) => CompletionEmailVariant) => {
		mutateVariants(current =>
			current.map(variant => (variant.id === variantId ? mutator(variant) : variant))
		)
	}

	const addVariant = () => {
		const questName = quest.title || 'Untitled Operation'
		const newVariant: CompletionEmailVariant = {
			id: generateId('mail-variant'),
			from: defaultEmail.from,
			subject: `${questName} – Alt Outcome`,
			preheader: defaultEmail.preheader,
			body:
				defaultEmail.body ||
				`Operator,\n\nAtlas logged an alternate outcome for ${questName}. Use this slot to speak to that branch.\n\n– Control`,
			conditions: [createConditionTemplate('trace_below')]
		}
		mutateVariants(current => [...current, newVariant])
	}

	const removeVariant = (variantId: string) => {
		mutateVariants(current => current.filter(variant => variant.id !== variantId))
	}

	const updateVariantFields = (variantId: string, patch: Partial<CompletionEmailVariant>) => {
		mutateVariant(variantId, variant => ({ ...variant, ...patch }))
	}

	const addCondition = (variantId: string) => {
		mutateVariant(variantId, variant => ({
			...variant,
			conditions: [...variant.conditions, createConditionTemplate('trace_below')]
		}))
	}

	const updateCondition = (
		variantId: string,
		index: number,
		condition: CompletionEmailVariantCondition
	) => {
		mutateVariant(variantId, variant => ({
			...variant,
			conditions: variant.conditions.map((existing, existingIndex) => (existingIndex === index ? condition : existing))
		}))
	}

	const removeCondition = (variantId: string, index: number) => {
		mutateVariant(variantId, variant => ({
			...variant,
			conditions: variant.conditions.filter((_, conditionIndex) => conditionIndex !== index)
		}))
	}

	const handleConditionTypeChange = (
		variantId: string,
		index: number,
		type: CompletionEmailVariantCondition['type']
	) => {
		updateCondition(variantId, index, createConditionTemplate(type))
	}

	const questSummary = quest.shortDescription || 'Write a short description on the Details step to help ghostwriters.'
	const hasBonusObjectives = (quest.bonusObjectives?.length || 0) > 0

	return (
		<div className="mail-step">
			{errors.length > 0 && (
				<div className="inline-alert error" role="alert">
					<strong>Completion email issues</strong>
					<ul>{errors.map(err => <li key={err}>{err}</li>)}</ul>
				</div>
			)}
			<div className="mail-step__grid">
				<aside className="mail-context-card">
					<p className="eyebrow">Wrap-up context</p>
					<ul>
						<li><strong>Quest:</strong> {quest.title || 'Untitled quest'}</li>
						<li><strong>Summary:</strong> {questSummary}</li>
						<li><strong>Bonus objectives:</strong> {hasBonusObjectives ? quest.bonusObjectives!.length : 'None'}</li>
					</ul>
					<div className="mail-quick-actions">
						<button type="button" className="ghost" onClick={useCelebrationTemplate}>Use celebration template</button>
						<button type="button" className="ghost" onClick={addVariant}>+ Add conditional variant</button>
						<button type="button" className="ghost danger" onClick={handleClear}>Clear completion email</button>
					</div>
				</aside>
				<section className="mail-step__composer">
					<label>
						From
						<input value={defaultEmail.from} onChange={e => patchDefault({ from: e.target.value })} />
					</label>
					<label>
						Subject
						<input value={defaultEmail.subject} onChange={e => patchDefault({ subject: e.target.value })} />
					</label>
					<label>
						Preheader (optional)
						<input value={defaultEmail.preheader} onChange={e => patchDefault({ preheader: e.target.value })} />
					</label>
					<label>
						Body
						<textarea
							rows={8}
							value={defaultEmail.body}
							placeholder={'Operator,\n\nAtlas confirms the objective was completed.'}
							onChange={e => patchDefault({ body: e.target.value })}
						/>
					</label>
				</section>
			</div>
			{variants.length > 0 && (
				<section className="mail-variant-list">
					<header>
						<div>
							<h4>Conditional variants</h4>
							<p className="muted">Fire tailored wrap-ups when players meet bonus conditions.</p>
						</div>
						<p className="muted">{variants.length} active variant{variants.length === 1 ? '' : 's'}</p>
					</header>
					{variants.map((variant, index) => (
						<article key={variant.id} className="mail-variant-card">
							<header>
								<div>
									<p className="eyebrow">Variant {index + 1}</p>
									<strong>{variant.subject || 'Untitled variant subject'}</strong>
								</div>
								<div className="mail-variant-actions">
									<button type="button" className="ghost danger" onClick={() => removeVariant(variant.id)}>Remove</button>
								</div>
							</header>
							<div className="mail-variant-grid">
									<label>
										From
										<input value={variant.from || ''} onChange={e => updateVariantFields(variant.id, { from: e.target.value })} />
									</label>
								<label>
									Subject
									<input value={variant.subject} onChange={e => updateVariantFields(variant.id, { subject: e.target.value })} />
								</label>
								<label>
									Preheader
									<input value={variant.preheader || ''} onChange={e => updateVariantFields(variant.id, { preheader: e.target.value })} />
								</label>
								<label>
									Body
									<textarea
										rows={4}
										value={variant.body}
										onChange={e => updateVariantFields(variant.id, { body: e.target.value })}
									/>
								</label>
							</div>
							<div className="mail-condition-list">
								<p className="eyebrow">Delivery conditions</p>
								{variant.conditions.length === 0 && (
									<p className="muted">Add at least one rule so Atlas knows when to send this variant.</p>
								)}
								{variant.conditions.map((condition, conditionIndex) => (
									<div key={`${variant.id}-condition-${conditionIndex}`} className="mail-condition-row">
										<div className="mail-condition-inputs">
											<select
												value={condition.type}
												onChange={e => handleConditionTypeChange(variant.id, conditionIndex, e.target.value as CompletionEmailVariantCondition['type'])}
											>
												{Object.entries(VARIANT_CONDITION_METADATA).map(([type, meta]) => (
													<option key={type} value={type}>{meta.label}</option>
												))}
											</select>
											{condition.type === 'trace_below' && (
												<input
													type="number"
													min={0}
													max={150}
													value={condition.data.threshold ?? 0}
													onChange={e =>
														updateCondition(variant.id, conditionIndex, {
															type: 'trace_below',
															data: { threshold: Number(e.target.value) }
														})
													}
													/>
												)}
											{condition.type === 'bonus_objective_completed' && (
												<select
													value={condition.data.objectiveId || ''}
													onChange={e =>
														updateCondition(variant.id, conditionIndex, {
															type: 'bonus_objective_completed',
															data: { objectiveId: e.target.value }
														})
													}
													disabled={!hasBonusObjectives}
												>
													{hasBonusObjectives ? (
														quest.bonusObjectives!.map(objective => (
															<option key={objective.id} value={objective.id}>
																{objective.description || objective.id}
															</option>
														))
													) : (
														<option value="">Add bonus objectives in Rewards tab</option>
													)}
												</select>
											)}
											{condition.type === 'trap_triggered' && (
												<input
													placeholder="Trap ID"
													value={condition.data.trapId || ''}
													onChange={e =>
														updateCondition(variant.id, conditionIndex, {
															type: 'trap_triggered',
															data: { trapId: e.target.value }
														})
													}
													/>
												)}
										</div>
										<div className="mail-condition-actions">
											<button type="button" className="ghost danger" onClick={() => removeCondition(variant.id, conditionIndex)}>Remove</button>
										</div>
										<p className="muted">{VARIANT_CONDITION_METADATA[condition.type].helper}</p>
									</div>
								))}
								<button type="button" className="ghost" onClick={() => addCondition(variant.id)}>+ Add condition</button>
							</div>
						</article>
					))}
				</section>
			)}
		</div>
	)
}

interface SummaryStepProps {
	quest: QuestDefinition
	errors: QuestValidationErrors
}

const SummaryStep: React.FC<SummaryStepProps> = ({ quest, errors }) => {
	const errorEntries = Object.entries(errors).filter(([, value]) => value && value.length > 0)
	return (
		<div className="wizard-form summary">
			<section>
				<h4>Quest Overview</h4>
				<ul>
					<li><strong>Title:</strong> {quest.title || 'Untitled quest'}</li>
					<li><strong>Description:</strong> {quest.shortDescription || 'Add a short description.'}</li>
					<li><strong>Difficulty:</strong> {DIFFICULTY_LABELS[quest.difficulty]}</li>
				</ul>
			</section>
			<section>
				<h4>System</h4>
				{quest.system ? (
					<ul>
						<li><strong>Name:</strong> {quest.system.label || 'Unnamed system'}</li>
						<li><strong>Host/IP:</strong> {quest.system.ip || '—'}</li>
						<li><strong>Difficulty:</strong> {DIFFICULTY_LABELS[quest.system.difficulty]}</li>
					</ul>
				) : (
					<p className="muted">System not configured.</p>
				)}
			</section>
			<section>
				<h4>Intro Email</h4>
				{quest.introEmail ? (
					<ul>
						<li><strong>Subject:</strong> {quest.introEmail.subject}</li>
						<li><strong>Body Preview:</strong> {quest.introEmail.body.slice(0, 120) || '—'}</li>
					</ul>
				) : (
					<p className="muted">No intro email yet.</p>
				)}
			</section>
			<section>
				<h4>Steps</h4>
				{quest.steps.length === 0 ? (
					<p className="muted">No steps defined.</p>
				) : (
					<p>{quest.steps.length} steps • {summarizeSteps(quest.steps)}</p>
				)}
			</section>
			<section>
				<h4>Completion Email</h4>
				{quest.completionEmail ? (
					<>
						<p><strong>Default:</strong> {quest.completionEmail.default.subject || 'No subject set'}</p>
						{quest.completionEmail.variants?.length ? (
							<p>{quest.completionEmail.variants.length} conditional variant{quest.completionEmail.variants.length === 1 ? '' : 's'} configured.</p>
						) : (
							<p className="muted">No conditional variants.</p>
						)}
					</>
				) : (
					<p className="muted">No completion email yet.</p>
				)}
			</section>
			{errorEntries.length > 0 && (
				<section className="summary-errors" role="alert">
					<h4>Outstanding Issues</h4>
					{errorEntries.map(([step, issues]) => {
						const issueList = issues ?? []
						return (
							<div key={step}>
								<strong>{STEP_LABELS[step as QuestWizardStep]?.title || step}</strong>
								<ul>{issueList.map((issue: string) => <li key={issue}>{issue}</li>)}</ul>
							</div>
						)
					})}
				</section>
			)}
		</div>
	)
}

interface ConfirmDialogProps {
	title: string
	message: string
	confirmLabel: string
	cancelLabel: string
	onConfirm(): void
	onCancel(): void
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel }) => (
	<div className="quest-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="quest-confirm-title">
		<div className="quest-modal">
			<header>
				<h3 id="quest-confirm-title">{title}</h3>
			</header>
			<p>{message}</p>
			<footer>
				<button type="button" className="ghost" onClick={onCancel}>{cancelLabel}</button>
				<button type="button" className="danger" onClick={onConfirm}>{confirmLabel}</button>
			</footer>
		</div>
	</div>
)


