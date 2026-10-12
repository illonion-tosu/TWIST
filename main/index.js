import { updateChat } from "../_shared/core/chat.js"
import { constants } from "../_shared/js/constants.js"
import { deepEqual, getModDetails, readSavedData, startPolling, truncateSVGText } from "../_shared/core/utils.js"

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

const countUpOptions = { useEasing: true, useGrouping: true, separator: ",", decimal: ".", suffix: "" }
const animation = {
    hpLeft: new CountUp(teamTotalHpLeftEl, 0, 0, 0, 0.2, countUpOptions),
    hpRight: new CountUp(teamTotalHpRightEl, 0, 0, 0, 0.2, countUpOptions),
    scoreLeft: new CountUp(teamScoreLeftEl, 0, 0, 0, 0.2, countUpOptions),
    scoreRight: new CountUp(teamScoreRightEl, 0, 0, 0, 0.2, countUpOptions)
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

// tosu needs a moment after a map change before the converted stats are correct
const STATS_DELAY_MS = 250
let statsUpdateAt = 0

// Score visibility
const chatContainerEl = document.getElementById("chat-container")
const scoresNowPlayingEl = document.getElementById("scores-now-playing")
let scoreVisible

// Chat
const chatboxContainerEl = document.getElementById("chatbox-container")
let chatLen

// Toggle HP
const toggleHpEls = document.getElementsByClassName("toggle-hp")
let currentToggleHp

// Width of an HP bar for `hp` out of a team's 3 x maxHp
function getHpBarWidth(hp, maxHp) {
    if (!(maxHp > 0)) return 0
    return Math.min(1, Math.max(0, hp / (maxHp * 3))) * MAX_HP_BAR_WIDTH
}

function getData() {
    const data = readSavedData()

    // The dashboard hasn't saved anything (or hasn't heard from tosu) yet
    if (!data || !data.tosuData || !data.playerData) return

    // Round Name
    currentRoundName = data.roundName
    if (previousRoundName !== currentRoundName) {
        previousRoundName = currentRoundName
        roundNameEl.textContent = currentRoundName ?? ""
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
        // Effective HP for a player: max HP minus incoming damage, floored at 0
        const effectiveHp = player => Math.max(0, Math.round(player.currentMaxHp - player.currentScoreAgainst))

        // Left HP
        const currentLeftHp =
            effectiveHp(currentPlayerData.player1) +
            effectiveHp(currentPlayerData.player2) +
            effectiveHp(currentPlayerData.player3)
        animation.hpLeft.update(currentLeftHp)
        teamLeftHpBarEl.style.width = `${getHpBarWidth(currentLeftHp, currentMaxHp)}px`

        // Right HP
        const currentRightHp =
            effectiveHp(currentPlayerData.player4) +
            effectiveHp(currentPlayerData.player5) +
            effectiveHp(currentPlayerData.player6)
        animation.hpRight.update(currentRightHp)
        teamRightHpBarEl.style.width = `${getHpBarWidth(currentRightHp, currentMaxHp)}px`
    }

    // Set score info
    currentLeftScore = currentPlayerData.player1.currentScore + currentPlayerData.player2.currentScore + currentPlayerData.player3.currentScore
    currentRightScore = currentPlayerData.player4.currentScore + currentPlayerData.player5.currentScore + currentPlayerData.player6.currentScore
    animation.scoreLeft.update(currentLeftScore)
    animation.scoreRight.update(currentRightScore)

    // Team Name
    const tosuData = data.tosuData
    const tourneyData = tosuData.tourney ?? {}
    const redTeamName = data.teamName?.redTeamName ?? ""
    const blueTeamName = data.teamName?.blueTeamName ?? ""
    if (currentTeamNameLeft !== redTeamName) {
        currentTeamNameLeft = redTeamName
        teamNameLeftEl.textContent = currentTeamNameLeft
        truncateSVGText(teamNameLeftEl, constants.GAMEPLAY_TEAM_NAME_MAX_WIDTH)
    }
    if (currentTeamNameRight !== blueTeamName) {
        currentTeamNameRight = blueTeamName
        teamNameRightEl.textContent = currentTeamNameRight
        truncateSVGText(teamNameRightEl, constants.GAMEPLAY_TEAM_NAME_MAX_WIDTH)
    }

    // Now Playing Information
    const beatmapData = tosuData.beatmap
    const mappoolInfo = data.mappoolInfo ?? {}
    if (beatmapData && (currentId !== beatmapData.id || currentChecksum !== beatmapData.checksum)) {
        currentId = beatmapData.id
        currentChecksum = beatmapData.checksum

        // Metadata
        const background = tosuData.directPath?.beatmapBackground
        if (background) {
            const url = `${window.location.origin}/Songs/${background}`
            const fixedUrl = encodeURI(url.replaceAll("\\", "/"))
            nowPlayingBackgroundEl.style.backgroundImage = `url("${fixedUrl}")`
        } else {
            nowPlayingBackgroundEl.style.backgroundImage = "none"
        }
        nowPlayingArtistTitleEl.textContent = `${beatmapData.artist} - ${beatmapData.title}`
        nowPlayingVersionEl.textContent = `[${beatmapData.version}]`

        // Mod info
        if (mappoolInfo.mappoolMapFound && mappoolInfo.currentBeatmap) {
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

            // Wait a moment, then take the stats from tosu (no await, so the rest of the overlay keeps updating)
            statsUpdateAt = Date.now() + STATS_DELAY_MS
            updateStats = true
        }
    }

    // Update Stats
    const tosuStats = beatmapData?.stats
    if (updateStats && Date.now() >= statsUpdateAt && tosuStats) {
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
    const chatData = tourneyData.chat ?? []
    if (chatLen !== chatData.length) {
        chatLen = updateChat(chatLen, chatData, chatboxContainerEl)
    }

    // Toggle HP
    if (currentToggleHp !== data.toggleHp) {
        currentToggleHp = data.toggleHp
        for (let i = 0; i < toggleHpEls.length; i++) {
            toggleHpEls[i].style.opacity = currentToggleHp ? 1 : 0
        }
    }
}

startPolling(getData, 100)
