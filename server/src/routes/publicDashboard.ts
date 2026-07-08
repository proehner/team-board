import { Router } from 'express'
import { dbAll } from '../db'

const router = Router()

interface TeamRow { id: string; name: string }
interface TypeRow { id: string; name: string; teamId: string; color: string; sortOrder: number }
interface ActiveRow { teamId: string; type: string; endDate: string; memberName: string; avatarColor: string }

// GET /api/public/dashboard
// Public, read-only, cross-team summary of *current* rotation responsibilities.
// Hand-picks fields instead of reusing the members/assignments DTOs, which
// include email addresses and other data not meant for anonymous visitors.
router.get('/', (_req, res) => {
  const teams = dbAll<TeamRow>('SELECT id, name FROM teams ORDER BY name')
  const types = dbAll<TypeRow>(
    'SELECT id, name, teamId, color, sortOrder FROM responsibility_types ORDER BY teamId, sortOrder',
  )
  const today = new Date().toISOString().split('T')[0]
  const active = dbAll<ActiveRow>(
    `SELECT a.teamId as teamId, a.type as type, a.endDate as endDate,
            m.name as memberName, m.avatarColor as avatarColor
     FROM assignments a
     JOIN members m ON m.id = a.memberId
     WHERE a.isSynthetic = 0 AND a.isArchived = 0
       AND a.startDate <= ? AND a.endDate >= ?
     ORDER BY a.startDate DESC`,
    [today, today],
  )

  res.json(teams.map((team) => ({
    teamId: team.id,
    teamName: team.name,
    responsibilities: types
      .filter((rt) => rt.teamId === team.id)
      .map((rt) => {
        const current = active.find((a) => a.teamId === team.id && a.type === rt.name)
        return {
          typeId: rt.id,
          typeName: rt.name,
          color: rt.color,
          current: current
            ? { memberName: current.memberName, avatarColor: current.avatarColor, endDate: current.endDate }
            : null,
        }
      }),
  })))
})

export default router
