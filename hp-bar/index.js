import { deepEqual, readSavedData, startPolling } from "../_shared/core/utils.js"

// Team Names
const teamNameLeftEl = document.getElementById("team-name-left")
const teamNameRightEl = document.getElementById("team-name-right")
let currentTeamNameLeft, currentTeamNameRight

// Scores
const teamScoreLeftEl = document.getElementById("team-score-left")
const teamScoreRightEl = document.getElementById("team-score-right")

const countUpOptions = { useEasing: true, useGrouping: true, separator: ",", decimal: ".", suffix: "" }
const animation = {
    hpLeft: new CountUp(teamScoreLeftEl, 0, 0, 0, 0.2, countUpOptions),
    hpRight: new CountUp(teamScoreRightEl, 0, 0, 0, 0.2, countUpOptions),
}
let previousMaxHp, currentMaxHp
let previousPlayerData, currentPlayerData
let setHpInfo = false

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

    // Max HP
    currentMaxHp = data.maxHp
    setHpInfo = false
    if (previousMaxHp !== currentMaxHp) {
        previousMaxHp = currentMaxHp
        setHpInfo = true
    }
    
    currentPlayerData = data.playerData
    if (!deepEqual(currentPlayerData, previousPlayerData)) {
        previousPlayerData = currentPlayerData
        setHpInfo = true
    }

    // Team sscore
    if (setHpInfo) {
        // Effective HP for a player: max HP minus incoming damage, floored at 0
        const effectiveHp = player => Math.max(0, Math.round(player.currentMaxHp - player.currentScoreAgainst))

        // Left HP
        const currentLeftHp =
            effectiveHp(currentPlayerData.player1) +
            effectiveHp(currentPlayerData.player2) +
            effectiveHp(currentPlayerData.player3)
        animation.hpLeft.update(currentLeftHp)

        // Right HP
        const currentRightHp =
            effectiveHp(currentPlayerData.player4) +
            effectiveHp(currentPlayerData.player5) +
            effectiveHp(currentPlayerData.player6)
        animation.hpRight.update(currentRightHp)
    }
}

startPolling(getData, 100)