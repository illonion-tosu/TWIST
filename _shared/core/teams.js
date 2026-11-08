import { constants } from "../js/constants.js"

let allTeams = []

// Load teams from teams.json: [{ id, name, shortName, players: [{ id, osuId, name, element }] }]
export async function loadTeams() {
    const response = await axios.get(constants.TEAMS_PATH)
    if (!Array.isArray(response.data)) throw new Error("teams.json should be a list of teams")
    allTeams = response.data
    return allTeams
}

// Find team from its name. Falls back to its short name or id, ignoring case.
export function findTeam(teamName) {
    const exact = allTeams.find(t => t.name === teamName)
    if (exact) return exact
    const text = String(teamName ?? "").trim().toLowerCase()
    if (!text) return undefined
    return allTeams.find(t => [t.name, t.shortName, t.id].some(v => String(v ?? "").toLowerCase() === text))
}

// A team's three roster slots in the shape the dashboard uses ({ id: osu! id, playerName, class }).
// A team with fewer than 3 players gets empty slots (id 0, no name) at the end.
export function getRoster(team) {
    return [0, 1, 2].map(i => {
        const player = team?.players?.[i]
        return {
            id: player?.osuId ?? 0,
            playerName: player?.name ?? "",
            class: player?.element ?? "",
        }
    })
}
