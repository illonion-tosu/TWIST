import { updateChat } from "../_shared/core/chat.js";
import { constants } from "../_shared/js/constants.js";
import { delay, getModDetails } from "../_shared/core/utils.js"

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

// Team Name
const teamNameLeftEl = document.getElementById("team-name-left")
const teamNameRightEl = document.getElementById("team-name-right")
let currentTeamNameLeft, currentTeamNameRight

// Now Playing Info
const nowPlayingBackgroundEl = document.getElementById("now-playing-background")
const nowPlayingModEl = document.getElementById("now-playing-mod")
const nowPlayingArtistTitleEl = document.getElementById("now-playing-artist-title")
const nowPlayingVersionEl = document.getElementById("now-playing-version")
const nowPlayingStatsCsEl = document.getElementById("now-playing-stats-cs")
const nowPlayingStatsArEl = document.getElementById("now-playing-stats-ar")
const nowPlayingStatsOdEl = document.getElementById("now-playing-stats-od")
const nowPlayingStatsSrEl = document.getElementById("now-playing-stats-sr")
let currentId, currentChecksum, updateStats = false

// Score visibility
const chatContainerEl = document.getElementById("chat-container")
const scoresNowPlayingEl = document.getElementById("scores-now-playing")
let scoreVisible

// Chat
const chatboxContainerEl = document.getElementById("chatbox-container")
let chatLen

async function getData() {
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
            currentPlayerData.player3.currentMaxHp - 
            currentPlayerData.player1.currentScoreAgainst -
            currentPlayerData.player2.currentScoreAgainst -
            currentPlayerData.player3.currentScoreAgainst 
        animation.hpLeft.update(currentLeftHp)
        teamLeftHpBarEl.style.width = `${currentLeftHp / (currentMaxHp * 3) * MAX_HP_BAR_WIDTH}px`

        // Right Score
        const currentRightHp =
            currentPlayerData.player4.currentMaxHp +
            currentPlayerData.player5.currentMaxHp +
            currentPlayerData.player6.currentMaxHp - 
            currentPlayerData.player1.currentScoreAgainst -
            currentPlayerData.player2.currentScoreAgainst -
            currentPlayerData.player3.currentScoreAgainst
        animation.hpRight.update(currentRightHp)
        teamRightHpBarEl.style.width = `${currentRightHp / (currentMaxHp * 3) * MAX_HP_BAR_WIDTH}px`
    }

    // Set score info
    currentLeftScore = currentPlayerData.player1.currentScore + currentPlayerData.player2.currentScore + currentPlayerData.player3.currentScore
    currentRightScore = currentPlayerData.player4.currentScore + currentPlayerData.player5.currentScore + currentPlayerData.player6.currentScore
    animation.scoreLeft.update(currentLeftScore)
    animation.scoreRight.update(currentRightScore)

    // Team Name
    const tosuData = data.tosuData
    const tourneyData = tosuData.tourney
    if (currentTeamNameLeft !== data.teamName.redTeamName) {
        currentTeamNameLeft = data.teamName.redTeamName
        teamNameLeftEl.textContent = currentTeamNameLeft
        truncateSVGTexts(document.getElementsByClassName("team-name-left")[0], constants.GAMEPLAY_TEAM_NAME_MAX_WIDTH)
    }
    if (currentTeamNameRight !== data.teamName.blueTeamName) {
        currentTeamNameRight = data.teamName.blueTeamName
        teamNameRightEl.textContent = currentTeamNameRight
        truncateSVGTexts(document.getElementsByClassName("team-name-right")[0], constants.GAMEPLAY_TEAM_NAME_MAX_WIDTH)
    }

    // Now Playing Information
    const beatmapData = tosuData.beatmap
    const mappoolInfo = data.mappoolInfo
    if (currentId !== beatmapData.id || currentChecksum !== beatmapData.checksum) {
        currentId = beatmapData.id
        currentChecksum = beatmapData.checksum

        // Metadata
        const url = `${window.location.origin}/Songs/${tosuData.directPath.beatmapBackground}`
        const fixedUrl = encodeURI(url.replaceAll("\\", "/"));
        nowPlayingBackgroundEl.style.backgroundImage = `url("${fixedUrl}")`
        nowPlayingArtistTitleEl.textContent = `${beatmapData.artist} - ${beatmapData.title}`
        nowPlayingVersionEl.textContent = `[${beatmapData.version}]`

        // Mod info
        if (mappoolInfo.mappoolMapFound) {
            nowPlayingModEl.style.backgroundColor = `var(--team-${mappoolInfo.currentPicker}-colour)`
            nowPlayingModEl.textContent = mappoolInfo.mappoolMapModId

            const currentBeatmap = mappoolInfo.currentBeatmap
            const getStats = getModDetails(
                currentBeatmap.diff_size,
                currentBeatmap.diff_approach,
                currentBeatmap.diff_overall,
                currentBeatmap.bpm,
                currentBeatmap.total_length,
                mappoolInfo.mappoolMapModId
            )

            nowPlayingStatsCsEl.textContent = `CS: ${Number(getStats.cs).toFixed(1)}`
            nowPlayingStatsArEl.textContent = `AR: ${Number(getStats.ar).toFixed(1)}`
            nowPlayingStatsOdEl.textContent = `OD: ${Number(getStats.od).toFixed(1)}`
            nowPlayingStatsSrEl.textContent = `SR: ${Number(currentBeatmap.difficultyrating).toFixed(2)}`
            updateStats = false
        } else {
            nowPlayingModEl.style.backgroundColor = `gray`
            nowPlayingModEl.textContent = ""

            await delay(250)
            updateStats = true
        }
    }

    // Update Stats
    if (updateStats) {
        const tosuStats = tosuData.beatmap.stats
        updateStats = false
        nowPlayingStatsCsEl.textContent = `CS: ${Number(tosuStats.cs.converted).toFixed(1)}`
        nowPlayingStatsArEl.textContent = `AR: ${Number(tosuStats.ar.converted).toFixed(1)}`
        nowPlayingStatsOdEl.textContent = `OD: ${Number(tosuStats.od.converted).toFixed(1)}`
        nowPlayingStatsSrEl.textContent = `SR: ${Number(tosuStats.stars.total).toFixed(2)}`
    }

    // Score Visible
    if (scoreVisible !== tourneyData.scoreVisible) {
        scoreVisible = tourneyData.scoreVisible
        if (scoreVisible) {
            scoresNowPlayingEl.style.opacity = 1
            chatContainerEl.style.opacity = 0
        } else {
            scoresNowPlayingEl.style.opacity = 0
            chatContainerEl.style.opacity = 1
        }
    }

    // Chatbox Container
    const chatData = tourneyData.chat
    if (chatLen !== chatData.length) {
        chatLen = updateChat(chatLen, chatData, chatboxContainerEl)
    }
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