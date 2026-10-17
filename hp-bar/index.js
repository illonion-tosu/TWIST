import { deepEqual, readSavedData, startPolling } from "../_shared/core/utils.js"

// Team Names
const teamNameLeftEl = document.getElementById("team-name-left")
const teamNameRightEl = document.getElementById("team-name-right")
let currentTeamNameLeft, currentTeamNameRight

// Player Names
const currentPlayers = {
    player1: {
        currentName: "",
        playerElement: document.getElementById("player-1-name"),
        scoreElement: document.getElementById("player-1-score"),
        hpBarElement: document.getElementById("player-1-hp-bar")
    },
    player2: {
        currentName: "",
        playerElement: document.getElementById("player-2-name"),
        scoreElement: document.getElementById("player-2-score"),
        hpBarElement: document.getElementById("player-2-hp-bar")
    },
    player3: {
        currentName: "",
        playerElement: document.getElementById("player-3-name"),
        scoreElement: document.getElementById("player-3-score"),
        hpBarElement: document.getElementById("player-3-hp-bar")
    },
    player4: {
        currentName: "",
        playerElement: document.getElementById("player-4-name"),
        scoreElement: document.getElementById("player-4-score"),
        hpBarElement: document.getElementById("player-4-hp-bar")
    },
    player5: {
        currentName: "",
        playerElement: document.getElementById("player-5-name"),
        scoreElement: document.getElementById("player-5-score"),
        hpBarElement: document.getElementById("player-5-hp-bar")
    },
    player6: {
        currentName: "",
        playerElement: document.getElementById("player-6-name"),
        scoreElement: document.getElementById("player-6-score"),
        hpBarElement: document.getElementById("player-6-hp-bar")
    }
}

// Scores
const teamScoreLeftEl = document.getElementById("team-score-left")
const teamScoreRightEl = document.getElementById("team-score-right")

// Player Scores

// Animation
const countUpOptions = { useEasing: true, useGrouping: true, separator: ",", decimal: ".", suffix: "" }
const animation = {
    hpLeft: new CountUp(teamScoreLeftEl, 0, 0, 0, 0.2, countUpOptions),
    hpRight: new CountUp(teamScoreRightEl, 0, 0, 0, 0.2, countUpOptions),
    player1: new CountUp(currentPlayers.player1.scoreElement, 0, 0, 0, 0.2, countUpOptions),
    player2: new CountUp(currentPlayers.player2.scoreElement, 0, 0, 0, 0.2, countUpOptions),
    player3: new CountUp(currentPlayers.player3.scoreElement, 0, 0, 0, 0.2, countUpOptions),
    player4: new CountUp(currentPlayers.player4.scoreElement, 0, 0, 0, 0.2, countUpOptions),
    player5: new CountUp(currentPlayers.player5.scoreElement, 0, 0, 0, 0.2, countUpOptions),
    player6: new CountUp(currentPlayers.player6.scoreElement, 0, 0, 0, 0.2, countUpOptions),
}
let previousMaxHp, currentMaxHp
let previousPlayerData, currentPlayerData
let setHpInfo = false

// Effective HP for a player: max HP minus incoming damage, floored at 0
const getEffectiveHp = player => Math.max(0, Math.round(player.currentMaxHp - player.currentScoreAgainst))

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
        // Left HP
        const currentLeftHp =
            getEffectiveHp(currentPlayerData.player1) +
            getEffectiveHp(currentPlayerData.player2) +
            getEffectiveHp(currentPlayerData.player3)
        animation.hpLeft.update(currentLeftHp)

        // Right HP
        const currentRightHp =
            getEffectiveHp(currentPlayerData.player4) +
            getEffectiveHp(currentPlayerData.player5) +
            getEffectiveHp(currentPlayerData.player6)
        animation.hpRight.update(currentRightHp)
    }

    for (const key of Object.keys(currentPlayerData)) {
        // Player Names
        if (currentPlayers[key].playerName !== currentPlayerData[key].playerName) {
            currentPlayers[key].playerName = currentPlayerData[key].playerName 
            currentPlayers[key].playerElement.textContent = currentPlayers[key].playerName
        }

        // Player scores
        const effectiveHp = getEffectiveHp(currentPlayerData[key])
        animation[key].update(effectiveHp)

        // Player Score Bars
        currentPlayers[key].hpBarElement.style.width = `${effectiveHp / currentMaxHp * 636}px`
    }
}

startPolling(getData, 100)