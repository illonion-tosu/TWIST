import { updateChat } from "../_shared/core/chat.js"
import { constants } from "../_shared/js/constants.js"
import { deepEqual, getModDetails, readSavedData, startPolling } from "../_shared/core/utils.js"
import { getHpBarWidth, getTeamHp, getTeamMaxHp, playersOf } from "../_shared/core/match.js"
import {
    createCounter,
    getNowPlayingElements,
    setNowPlayingMetadata,
    setNowPlayingStats,
    setNowPlayingStatsFromTosu,
    setTeamName,
    setToggleHpVisible,
} from "../_shared/core/overlay.js"

// Round name
const roundNameEl = document.getElementById("round-name")
let currentRoundName

// Per team: name, HP (number + bar) and score
const teamEls = {
    red: {
        name: document.getElementById("team-name-left"),
        hp: document.getElementById("team-total-hp-left"),
        hpBar: document.getElementById("team-left-hp-bar"),
        score: document.getElementById("team-score-left"),
    },
    blue: {
        name: document.getElementById("team-name-right"),
        hp: document.getElementById("team-total-hp-right"),
        hpBar: document.getElementById("team-right-hp-bar"),
        score: document.getElementById("team-score-right"),
    },
}
const counters = {
    red: { hp: createCounter(teamEls.red.hp), score: createCounter(teamEls.red.score) },
    blue: { hp: createCounter(teamEls.blue.hp), score: createCounter(teamEls.blue.score) },
}
const currentTeamNames = { red: undefined, blue: undefined }

let previousMaxHp
let previousPlayerData

// Now playing
const nowPlayingEls = getNowPlayingElements()
let currentId, currentChecksum
let updateStats = false
let statsUpdateAt = 0

// Score / chat visibility
const chatContainerEl = document.getElementById("chat-container")
const scoresNowPlayingEl = document.getElementById("scores-now-playing")
let scoreVisible

// Chat
const chatboxContainerEl = document.getElementById("chatbox-container")
let chatLen

// HP toggle
let currentToggleHp

// Class activated image per team (no src when nothing is activated)
const classImageEls = {
    red: document.getElementById("team-left-class-activated"),
    blue: document.getElementById("team-right-class-activated"),
}
const currentClassImages = { red: undefined, blue: undefined }

const displayScore = player => player.effectiveScore ?? player.currentScore

function getTeamScore(playerData, side) {
    return playersOf(side).reduce((total, n) => total + displayScore(playerData[`player${n}`]), 0)
}

function getData() {
    const data = readSavedData()

    // The dashboard hasn't saved anything (or hasn't heard from tosu) yet
    if (!data || !data.tosuData || !data.playerData) return

    const tosuData = data.tosuData
    const tourneyData = tosuData.tourney ?? {}
    const playerData = data.playerData

    // Round name
    if (currentRoundName !== data.roundName) {
        currentRoundName = data.roundName
        roundNameEl.textContent = currentRoundName ?? ""
    }

    // HP: only redo it when the max HP or any player changed
    if (previousMaxHp !== data.maxHp || !deepEqual(playerData, previousPlayerData)) {
        previousMaxHp = data.maxHp
        previousPlayerData = playerData

        for (const side of constants.SIDES) {
            const hp = getTeamHp(playerData, side)
            counters[side].hp.update(hp)

            // A team's bar covers all 3 players' HP
            const barWidth = getHpBarWidth(hp, getTeamMaxHp(playerData, side, data.maxHp), constants.TEAM_HP_BAR_MAX_WIDTH)
            teamEls[side].hpBar.style.width = `${barWidth}px`
        }
    }

    // Score + team names
    const teamNames = { red: data.teamName?.redTeamName ?? "", blue: data.teamName?.blueTeamName ?? "" }
    for (const side of constants.SIDES) {
        counters[side].score.update(getTeamScore(playerData, side))

        if (currentTeamNames[side] !== teamNames[side]) {
            currentTeamNames[side] = teamNames[side]
            setTeamName(teamEls[side].name, teamNames[side])
        }
    }

    // Now playing
    const beatmapData = tosuData.beatmap
    const mappoolInfo = data.mappoolInfo ?? {}
    if (beatmapData && (currentId !== beatmapData.id || currentChecksum !== beatmapData.checksum)) {
        currentId = beatmapData.id
        currentChecksum = beatmapData.checksum

        setNowPlayingMetadata(nowPlayingEls, beatmapData, tosuData.directPath)

        if (mappoolInfo.mappoolMapFound && mappoolInfo.currentBeatmap) {
            // Pool map: stats come from the mappool data
            const currentBeatmap = mappoolInfo.currentBeatmap
            nowPlayingEls.mod.style.backgroundColor = `var(--team-${mappoolInfo.currentPicker}-colour)`
            nowPlayingEls.mod.textContent = mappoolInfo.mappoolMapLabel ?? currentBeatmap.label ?? ""

            const stats = getModDetails(
                currentBeatmap.diff_size,
                currentBeatmap.diff_approach,
                currentBeatmap.diff_overall,
                currentBeatmap.bpm,
                currentBeatmap.total_length,
                currentBeatmap.mod
            )
            setNowPlayingStats(nowPlayingEls, { ...stats, sr: currentBeatmap.difficultyrating })
            updateStats = false
        } else {
            nowPlayingEls.mod.style.backgroundColor = "gray"
            nowPlayingEls.mod.textContent = ""

            // Wait a moment, then take the stats from tosu (no await, so the rest of the overlay keeps updating)
            statsUpdateAt = Date.now() + constants.STATS_DELAY_MS
            updateStats = true
        }
    }

    // Stats from tosu
    const tosuStats = beatmapData?.stats
    if (updateStats && Date.now() >= statsUpdateAt && tosuStats) {
        updateStats = false
        setNowPlayingStatsFromTosu(nowPlayingEls, tosuStats)
    }

    // Score visible: scores replace the chat
    if (scoreVisible !== tourneyData.scoreVisible) {
        scoreVisible = tourneyData.scoreVisible
        scoresNowPlayingEl.style.opacity = scoreVisible ? 1 : 0
        chatContainerEl.style.opacity = scoreVisible ? 0 : 1
    }

    // Chat
    const chatData = tourneyData.chat ?? []
    if (chatLen !== chatData.length) {
        chatLen = updateChat(chatLen, chatData, chatboxContainerEl)
    }

    // Class activated images
    for (const side of constants.SIDES) {
        const className = data.classImages?.[side] ?? null
        if (currentClassImages[side] === className) continue
        currentClassImages[side] = className

        if (className) {
            classImageEls[side].src = `${constants.CLASS_IMAGE_FOLDER}/${className}.png`
        } else {
            classImageEls[side].removeAttribute("src")
        }
    }

    // HP toggle
    if (currentToggleHp !== data.toggleHp) {
        currentToggleHp = data.toggleHp
        setToggleHpVisible(currentToggleHp)
    }
}

startPolling(getData)
