import { constants } from "../js/constants.js"

let allTeams = []

// Load teams
export async function loadTeams() {
    const response = await axios.get(constants.TEAMS_PATH)
    allTeams = response.data
    return allTeams
}

// Find team from name
export function findTeam(teamName) {
    return allTeams.find(t => t.teamName === teamName)
}
