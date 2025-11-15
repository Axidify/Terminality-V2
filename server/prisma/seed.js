const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const bcrypt = require('bcryptjs')

async function main() {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin'
  const adminEmail = process.env.ADMIN_EMAIL || `${adminUsername}@example.local`
  // Ensure a default state row exists
  const existing = await prisma.state.findUnique({ where: { id: 1 } })
  if (!existing) {
    const defaultState = { version: 1, desktop: { icons: {}, isLocked: true, wallpaper: 'default' }, story: {} }
    await prisma.state.create({ data: { id: 1, data: JSON.stringify(defaultState) } })
  }
  // Add an admin user if none exists, or ensure the password is hashed
  let admin = await prisma.user.findUnique({ where: { username: adminUsername } })
  if (!admin) {
    const hashed = await bcrypt.hash(adminPassword, 10)
    await prisma.user.create({ data: { username: adminUsername, email: adminEmail, password: hashed, role: 'admin' } })
  } else {
    // If an admin exists and the password is stored in plaintext, replace it with a hash
    const isHashed = typeof admin.password === 'string' && admin.password.startsWith('$2')
    if (!isHashed) {
      const hashed = await bcrypt.hash(adminPassword, 10)
      await prisma.user.update({ where: { id: admin.id }, data: { password: hashed, email: admin.email || adminEmail } })
    }
  }

  if (prisma.questFlow) {
    const slug = 'operation-touchstone'
    const existingQuest = await prisma.questFlow.findUnique({ where: { slug } })
    if (!existingQuest) {
      const quest = {
        slug,
        codename: 'OPERATION TOUCHSTONE',
        tagline: 'Trace the phantom broker hopping between abandoned relays.',
        summary: 'Hack-for-hire broker using our sandbox as a dead-drop.',
        difficulty: 'standard',
        status: 'published',
        stageOrder: ['briefing', 'investigation', 'infiltration', 'decryption', 'complete'],
        objectives: [
          { id: 'brief', text: 'Review the briefing and accept the contract', stage: 'briefing' },
          { id: 'investigate', text: 'Map the relay chain and collect intel fragments', stage: 'investigation' },
          { id: 'breach', text: 'Pierce the broker\'s vault without triggering counter traces', stage: 'infiltration' },
          { id: 'decrypt', text: 'Solve the finale cipher and expose the broadcast target', stage: 'decryption' }
        ],
        nodes: [
          {
            id: 'ghost-relay',
            label: 'Ghost Relay',
            description: "Sealed telemetry repeater still mirroring citizens' data.",
            exposures: ['Telemetry bus bleeds keystream offsets', 'Operator left a diagnostic shell open'],
            requiredTool: 'pulse-scan',
            puzzleId: 'cipher-offset'
          },
          {
            id: 'midnight-cache',
            label: 'Midnight Cache',
            description: 'Encrypted message queue disguised as weather data.',
            exposures: ['Queue accepts malformed cron expressions', 'Messages stored with reversible obfuscation'],
            requiredTool: 'chrono-weave',
            puzzleId: 'logic-sequencer'
          },
          {
            id: 'vault-core',
            label: 'Vault Core',
            description: 'Final broker vault routing packets through a quantum decoy.',
            exposures: ['Fake TLS banner reveals a substitution key', 'Heartbeat includes ritual phrasing'],
            requiredTool: 'veiled-sigil',
            puzzleId: 'forensic-ritual'
          }
        ],
        puzzles: [
          {
            id: 'cipher-offset',
            type: 'cipher',
            prompt: 'Intercepted string: VCTXJ → shift by alternating offsets (1,3,1,3,...) to recover the access mnemonic.',
            solution: 'PHASE',
            hints: [
              'Write the alphabet twice and step backwards 1 then 3 positions repeatedly.',
              'Group the corrected characters into a common sci-fi security word.'
            ],
            reward: 'Intel: Telemetry offsets leak every eight seconds.'
          },
          {
            id: 'logic-sequencer',
            type: 'logic',
            prompt: 'Cron artifact: */7 3-6 ? * 2#1. Derive the only hour in which the queue opens and express it as HHMM (24h).',
            solution: '0314',
            hints: [
              '2#1 means the first Monday of the month.',
              'Queue opens at 03:14 once per week; combine digits without separators.'
            ],
            reward: 'Intel: Queue unlocks at 03:14 on first Mondays only.'
          },
          {
            id: 'forensic-ritual',
            type: 'forensics',
            prompt: 'TLS banner spells R G V B Y in sequence. Convert the color initials to keypad numbers and deliver the five-digit code.',
            solution: '74229',
            hints: [
              'Use phone keypad: R=7, G=4, V=8, B=2, Y=9.',
              'One letter repeats as you convert; do not remove duplicates.'
            ],
            reward: 'Intel: Broker handshake requires color keypad code 74229.'
          }
        ],
        finaleCipher: {
          id: 'finale',
          type: 'cipher',
          prompt: 'Combine your intel. Arrange the first letters of each intel reward to form the final passphrase.',
          solution: 'ITB',
          hints: [
            'Take each intel reward phrase and capture the first letter of the key noun.',
            "Three intel drops spell the broker's target acronym."
          ],
          reward: 'Reveals the broadcast coordinates for extraction.'
        },
        metadata: null
      }

      const questData = {
        slug: quest.slug,
        codename: quest.codename,
        tagline: quest.tagline,
        summary: quest.summary,
        difficulty: quest.difficulty,
        status: quest.status,
        stageOrder: JSON.stringify(quest.stageOrder),
        metadata: quest.metadata ? JSON.stringify(quest.metadata) : null,
        objectives: {
          create: quest.objectives.map((obj, idx) => ({
            objectiveId: obj.id,
            text: obj.text,
            stage: obj.stage,
            position: idx
          }))
        },
        nodes: {
          create: quest.nodes.map((node, idx) => ({
            nodeId: node.id,
            label: node.label,
            description: node.description,
            exposures: JSON.stringify(node.exposures || []),
            requiredTool: node.requiredTool,
            puzzleKey: node.puzzleId,
            position: idx
          }))
        },
        puzzles: {
          create: [
            ...quest.puzzles.map(puzzle => ({
              puzzleKey: puzzle.id,
              type: puzzle.type,
              prompt: puzzle.prompt,
              solution: puzzle.solution,
              hints: JSON.stringify(puzzle.hints || []),
              reward: puzzle.reward,
              isFinale: false
            })),
            {
              puzzleKey: quest.finaleCipher.id,
              type: quest.finaleCipher.type,
              prompt: quest.finaleCipher.prompt,
              solution: quest.finaleCipher.solution,
              hints: JSON.stringify(quest.finaleCipher.hints || []),
              reward: quest.finaleCipher.reward,
              isFinale: true
            }
          ]
        }
      }

      await prisma.questFlow.create({ data: questData })
    }
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})
