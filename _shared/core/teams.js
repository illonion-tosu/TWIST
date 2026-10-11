let allTeams = []

// Load teams
export async function loadTeams() {
    const response = await axios.get("../_data/teams.json")
    allTeams = response.data
    return allTeams
}

// Find beatmap from Id
export function findTeam(teamName) {
    return allTeams.find(t => t.teamName === teamName)
}
