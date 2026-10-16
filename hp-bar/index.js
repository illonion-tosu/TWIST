import { readSavedData, startPolling } from "../_shared/core/utils.js"

// Team Names
const teamNameLeftEl = document.getElementById("team-name-left")
const teamNameRightEl = document.getElementById("team-name-right")
let currentTeamNameLeft, currentTeamNameRight

// Get Data
function getData() {
    const data = readSavedData()
    console.log(data)

    if (!data || !data.tosuData || !data.playerData) return

    // Team names
    if (currentTeamNameLeft !== data.teamName.redTeamName) {
        currentTeamNameLeft = data.teamName.redTeamName
        teamNameLeftEl.textContent = currentTeamNameLeft
    }
    if (currentTeamNameRight !== data.teamName.blueTeamName) {
        currentTeamNameRight = data.teamName.blueTeamName
        teamNameRightEl.textContent = currentTeamNameRight
    }
}

startPolling(getData, 100)