import { constants } from "../_shared/js/constants.js";

function truncateSVGTexts(element, maxWidth) {
    const originalText = element.textContent.trim()
    element.textContent = originalText

    if (element.getComputedTextLength() <= maxWidth) return
    let text = originalText
    while (text.length > 0) {
        text = text.slice(0, -1)
        element.textContent = text + "..."

        if (element.getComputedTextLength() <= maxWidth) break
    }
}

truncateSVGTexts(document.getElementsByClassName("team-name-left")[0], constants.GAMEPLAY_TEAM_NAME_MAX_WIDTH)
truncateSVGTexts(document.getElementsByClassName("team-name-left")[1], constants.GAMEPLAY_TEAM_NAME_MAX_WIDTH)
truncateSVGTexts(document.getElementsByClassName("team-name-right")[0], constants.GAMEPLAY_TEAM_NAME_MAX_WIDTH)
truncateSVGTexts(document.getElementsByClassName("team-name-right")[1], constants.GAMEPLAY_TEAM_NAME_MAX_WIDTH)

function schedule() {
    const now = Date.now()
    const delay = 100 - (now % 100)

    setTimeout(() => {
        getData()
        schedule()
    }, delay)
}

schedule()

// Round Name
const roundNameEl = document.getElementById("round-name")
let previousRoundName, currentRoundName

// HP related info
const MAX_HP_BAR_WIDTH = 238
const teamTotalHpLeftEl = document.getElementById("team-total-hp-left")
const teamTotalHpRightEl = document.getElementById("team-total-hp-right")
const teamLeftHpBarEl = document.getElementById("team-left-hp-bar")
const teamRightHpBarEl = document.getElementById("team-right-hp-bar")
let previousMaxHp, currentMaxHp
let previousPlayerData, currentPlayerData
let setHpInfo = false

// Score related info
const teamScoreLeftEl = document.getElementById("team-score-left")
const teamScoreRightEl = document.getElementById("team-score-right")
let currentLeftScore = 0, currentRightScore = 0

const animation = {
    hpLeft: new CountUp(teamTotalHpLeftEl, 0, 0, 0, 0.2, { useEasing: true, useGrouping: true, separator: ",", decimal: ".", suffix: ""}),
    hpRight: new CountUp(teamTotalHpRightEl, 0, 0, 0, 0.2, { useEasing: true, useGrouping: true, separator: ",", decimal: ".", suffix: ""}),
    scoreLeft: new CountUp(teamScoreLeftEl, 0, 0, 0, 0.2, { useEasing: true, useGrouping: true, separator: ",", decimal: ".", suffix: ""}),
    scoreRight: new CountUp(teamScoreRightEl, 0, 0, 0, 0.2, { useEasing: true, useGrouping: true, separator: ",", decimal: ".", suffix: ""})
}

function getData() {
    const data = JSON.parse(localStorage.getItem("data"))
    console.log(data)
    
    // Round Name
    currentRoundName = data.roundName
    if (previousRoundName !== currentRoundName) {
        previousRoundName = currentRoundName
        roundNameEl.textContent = currentRoundName
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

    if (setHpInfo) {
        // Left Score
        const currentLeftHp = 
            currentPlayerData.player1.currentMaxHp +
            currentPlayerData.player2.currentMaxHp +
            currentPlayerData.player3.currentMaxHp
        animation.hpLeft.update(currentLeftHp)
        teamLeftHpBarEl.style.width = `${currentLeftHp / (currentMaxHp * 3) * MAX_HP_BAR_WIDTH}px`

        // Right Score
        const currentRightHp =
            currentPlayerData.player4.currentMaxHp +
            currentPlayerData.player5.currentMaxHp +
            currentPlayerData.player6.currentMaxHp
        animation.hpRight.update(currentRightHp)
        teamRightHpBarEl.style.width = `${currentRightHp / (currentMaxHp * 3) * MAX_HP_BAR_WIDTH}px`
    }

    // Set score info
    currentLeftScore = 0
    currentRightScore = 0
    animation.scoreLeft.update(currentPlayerData.player1.currentScore + currentPlayerData.player2.currentScore + currentPlayerData.player3.currentScore)
    animation.scoreRight.update(currentPlayerData.player4.currentScore + currentPlayerData.player5.currentScore + currentPlayerData.player6.currentScore)
}

// Deep equal for object
function deepEqual(a, b) {
    if (a === b) return true
    if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
        return false
    }

    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    if (keysA.length !== keysB.length) return false

    return keysA.every(key => keysB.includes(key) && deepEqual(a[key], b[key]))
}