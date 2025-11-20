import { DEFAULT_MAIL_SENDER, PLAYER_INBOX_ADDRESS, QUEST_MAIL_SYNC_EVENT } from '../constants/mail'
import type { MailFolder, MailService, GameMail } from '../types/mail'
import type { CompletionEmailVariant, CompletionEmailVariantCondition, QuestDefinition } from '../types/quest'
import { createMailService } from './mailService'

const PREVIEW_PREFIX = 'quest_preview'
const MAIL_FOLDERS: MailFolder[] = ['inbox', 'archive', 'sent']

const introMailId = (questId: string) => `${PREVIEW_PREFIX}_intro_${questId}`
const completionMailId = (questId: string) => `${PREVIEW_PREFIX}_completion_default_${questId}`
const completionVariantMailId = (questId: string, variantId: string) => `${PREVIEW_PREFIX}_completion_variant_${questId}_${variantId}`

interface ExistingMailMeta {
	folder: MailFolder
	read: boolean
	archived: boolean
	receivedAt: string
}

const withPreheader = (body: string, preheader?: string) => {
	const trimmed = preheader?.trim()
	if (!trimmed) return body
	return `${trimmed}\n\n${body}`
}

const buildAcceptHintBlock = (quest: QuestDefinition): string => {
	const override = quest.introEmail?.acceptHintOverride?.trim()
	if (override) return override
	return `To accept this contract, run:\n\nquest start ${quest.id}`
}

export const buildIntroMailBody = (quest: QuestDefinition): string => {
	if (!quest.introEmail) return ''
	const baseBody = withPreheader(quest.introEmail.body || '', quest.introEmail.preheader)
	const showHint = quest.introEmail.showAcceptHint ?? true
	if (!showHint) return baseBody || ''
	const hintBlock = buildAcceptHintBlock(quest)
	if (!baseBody) return hintBlock
	return `${baseBody.trimEnd()}\n\n${hintBlock}`.trim()
}

const describeCondition = (condition: CompletionEmailVariantCondition): string => {
	switch (condition.type) {
		case 'trace_below':
			return `Trace under ${condition.data?.threshold ?? 'configured threshold'}`
		case 'bonus_objective_completed':
			return `Bonus objective ${condition.data?.objectiveId || 'configured objective'} completed`
		case 'trap_triggered':
		default:
			return `Trap ${condition.data?.trapId || 'configured trap'} triggered`
	}
}

const describeConditionList = (conditions: CompletionEmailVariantCondition[]): string => {
	if (!conditions.length) return 'Always send (variant has no delivery conditions).'
	return conditions.map(condition => `• ${describeCondition(condition)}`).join('\n')
}

const buildVariantBody = (variant: CompletionEmailVariant): string => {
	const header = ['[Variant Preview]', describeConditionList(variant.conditions)]
	const previewBody = header.filter(Boolean).join('\n')
	const baseBody = withPreheader(variant.body || '', variant.preheader)
	return `${previewBody}\n\n${baseBody}`.trim()
}

const buildIntroMail = (quest: QuestDefinition): GameMail | null => {
	if (!quest.introEmail) return null
	return {
		id: introMailId(quest.id),
		from: quest.introEmail.from || DEFAULT_MAIL_SENDER,
		to: PLAYER_INBOX_ADDRESS,
		subject: quest.introEmail.subject || `${quest.title || 'Quest'} briefing`,
		body: buildIntroMailBody(quest),
		receivedAt: new Date().toISOString(),
		read: false,
		archived: false,
		tags: ['quest'],
		questId: quest.id,
		linkedQuestId: quest.id,
		type: 'intro',
		folder: 'inbox'
	}
}

const buildCompletionMails = (quest: QuestDefinition): GameMail[] => {
	if (!quest.completionEmail) return []
	const mails: GameMail[] = []
	const defaultConfig = quest.completionEmail.default
	if (defaultConfig) {
		mails.push({
			id: completionMailId(quest.id),
			from: defaultConfig.from || DEFAULT_MAIL_SENDER,
			to: PLAYER_INBOX_ADDRESS,
			subject: defaultConfig.subject || `${quest.title || 'Quest'} – Completion`,
			body: withPreheader(defaultConfig.body || '', defaultConfig.preheader),
			receivedAt: new Date().toISOString(),
			read: false,
			archived: false,
			tags: ['quest'],
			questId: quest.id,
			linkedQuestId: quest.id,
			type: 'completion',
			folder: 'inbox'
		})
	}
	quest.completionEmail.variants?.forEach(variant => {
		mails.push({
			id: completionVariantMailId(quest.id, variant.id),
			from: variant.from || defaultConfig?.from || DEFAULT_MAIL_SENDER,
			to: PLAYER_INBOX_ADDRESS,
			subject: variant.subject ? `${variant.subject} • Variant Preview` : `${quest.title || 'Quest'} Variant Preview`,
			body: buildVariantBody(variant),
			receivedAt: new Date().toISOString(),
			read: false,
			archived: false,
			tags: ['quest'],
			questId: quest.id,
			linkedQuestId: quest.id,
			type: 'completion',
			folder: 'inbox'
		})
	})
	return mails
}

const collectExistingPreviewMail = async (service: MailService, questId: string) => {
	const map = new Map<string, ExistingMailMeta>()
	const lists = await Promise.all(MAIL_FOLDERS.map(folder => service.listMail(folder)))
	lists.forEach((list, index) => {
		const folder = MAIL_FOLDERS[index]
		list.forEach(mail => {
			if (mail.questId !== questId) return
			if (!mail.id?.startsWith(PREVIEW_PREFIX)) return
			map.set(mail.id, {
				folder,
				read: mail.read,
				archived: mail.archived,
				receivedAt: mail.receivedAt
			})
		})
	})
	return map
}

const upsertPreviewMail = async (service: MailService, mail: GameMail, existing?: ExistingMailMeta) => {
	const receivedAt = existing?.receivedAt || mail.receivedAt || new Date().toISOString()
	const folder = existing?.folder ?? mail.folder ?? 'inbox'
	await service.sendMail({
		...mail,
		receivedAt,
		read: existing?.read ?? mail.read ?? false,
		archived: existing?.archived ?? mail.archived ?? false,
		folder
	}, folder)
}

const syncQuestMailForQuest = async (service: MailService, quest: QuestDefinition) => {
	const existing = await collectExistingPreviewMail(service, quest.id)
	const retained = new Set<string>()
	const intro = buildIntroMail(quest)
	if (intro) {
		retained.add(intro.id)
		await upsertPreviewMail(service, intro, existing.get(intro.id))
	}
	const completionMails = buildCompletionMails(quest)
	for (const mail of completionMails) {
		retained.add(mail.id)
		await upsertPreviewMail(service, mail, existing.get(mail.id))
	}
	const staleIds = Array.from(existing.keys()).filter(id => !retained.has(id))
	if (staleIds.length) {
		await Promise.all(staleIds.map(id => service.deleteMail(id)))
	}
}

const emitMailSyncEvent = (questIds: string[]) => {
	if (typeof window === 'undefined' || questIds.length === 0) return
	window.dispatchEvent(new CustomEvent(QUEST_MAIL_SYNC_EVENT, { detail: { questIds } }))
}

export interface QuestMailSyncOptions {
	quests: QuestDefinition[]
	mailService?: MailService
}

export const syncQuestMailPreviews = async ({ quests, mailService }: QuestMailSyncOptions): Promise<void> => {
	if (!quests || quests.length === 0) return
	const service = mailService ?? createMailService()
	for (const quest of quests) {
		await syncQuestMailForQuest(service, quest)
	}
	emitMailSyncEvent(quests.map(q => q.id))
}

export const clearQuestMailPreviews = async (questId: string, options?: { mailService?: MailService }): Promise<void> => {
	if (!questId) return
	const service = options?.mailService ?? createMailService()
	const existing = await collectExistingPreviewMail(service, questId)
	if (existing.size === 0) return
	await Promise.all(Array.from(existing.keys()).map(id => service.deleteMail(id)))
	emitMailSyncEvent([questId])
}
