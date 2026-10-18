import { constants } from "../_shared/js/constants.js"
import { deepEqual, readSavedData, startPolling } from "../_shared/core/utils.js"
import { getEffectiveHp, getHpBarWidth, getTeamHp, isPresent } from "../_shared/core/match.js"
import { createCounter } from "../_shared/core/overlay.js"

// Team names + scores
const teamEls = {
    red: {
        name: document.getElementById("team-name-left"),
        score: document.getElementById("team-score-left"),
    },
    blue: {
        name: document.getElementById("team-name-right"),
        score: document.getElementById("team-score-right"),
    },
}
const teamCounters = {
    red: createCounter(teamEls.red.score),
    blue: createCounter(teamEls.blue.score),
}
const currentTeamNames = { red: undefined, blue: undefined }

// Players: name, score and HP bar elements + their score counter
const players = {}
for (const n of constants.PLAYER_NUMBERS) {
    const scoreElement = document.getElementById(`player-${n}-score`)
    players[`player${n}`] = {
        currentName: undefined,
        nameElement: document.getElementById(`player-${n}-name`),
        scoreElement,
        hpBarElement: document.getElementById(`player-${n}-hp-bar`),
        counter: createCounter(scoreElement),
    }
}

let previousMaxHp
let previousPlayerData

function getData() {
    const data = readSavedData()
    if (!data || !data.tosuData || !data.playerData) return

    // Team names
    const teamNames = { red: data.teamName.redTeamName, blue: data.teamName.blueTeamName }
    for (const side of constants.SIDES) {
        if (currentTeamNames[side] !== teamNames[side]) {
            currentTeamNames[side] = teamNames[side]
            teamEls[side].name.textContent = teamNames[side]
        }
    }

    // Only redo the team totals when the max HP or any player changed
    const maxHp = data.maxHp
    const playerData = data.playerData
    if (previousMaxHp !== maxHp || !deepEqual(playerData, previousPlayerData)) {
        previousMaxHp = maxHp
        previousPlayerData = playerData

        for (const side of constants.SIDES) {
            teamCounters[side].update(getTeamHp(playerData, side))
        }
    }

    for (const [key, player] of Object.entries(playerData)) {
        const els = players[key]
        if (!els) continue

        // Empty slot (2-player team): hide the whole row
        const present = isPresent(player)
        els.nameElement.closest(".player-container").style.display = present ? "" : "none"
        if (!present) continue

        // Player name
        if (els.currentName !== player.playerName) {
            els.currentName = player.playerName
            els.nameElement.textContent = player.playerName
        }

        // Player score + HP bar
        const effectiveHp = getEffectiveHp(player)
        els.counter.update(effectiveHp)
        els.hpBarElement.style.width = `${getHpBarWidth(effectiveHp, maxHp, constants.PLAYER_HP_BAR_MAX_WIDTH)}px`
    }
}

startPolling(getData)
