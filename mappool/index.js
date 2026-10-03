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

// Team Name
const teamNameLeftEl = document.getElementById("team-name-left")
const teamNameRightEl = document.getElementById("team-name-right")
let currentTeamNameLeft, currentTeamNameRight

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

    // Team Name
    const tosuData = data.tosuData
    const tourneyData = tosuData.tourney
    const teamNames = tourneyData.team
    if (currentTeamNameLeft !== teamNames.left) {
        currentTeamNameLeft = teamNames.left
        teamNameLeftEl.textContent = currentTeamNameLeft
    }
    if (currentTeamNameRight !== teamNames.right) {
        currentTeamNameRight = teamNames.right
        teamNameRightEl.textContent = currentTeamNameRight
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

const SVG_NS = "http://www.w3.org/2000/svg"

const MAP_BORDER_PATH = "M0 0 C9 -0.24 18 -0.39 27.01 -0.46 C28.1 -0.46 28.1 -0.46 29.21 -0.47 C52.13 -0.65 74.86 0.35 97.71 2.07 C98.97 2.16 100.23 2.26 101.53 2.35 C106.75 2.74 111.96 3.13 117.17 3.52 C176.29 7.95 234.01 7.79 293.24 3.87 C307.72 2.91 322.21 2.21 336.7 1.57 C341.24 1.37 345.77 1.15 350.3 0.92 C351.46 0.87 352.63 0.81 353.82 0.75 C355.88 0.65 357.94 0.54 359.99 0.44 C375.94 -0.32 391.87 0.15 407.81 0.83 C409.7 0.9 411.58 0.98 413.47 1.06 C418.54 1.26 423.6 1.48 428.67 1.69 C432.91 1.87 437.15 2.04 441.39 2.22 C451.38 2.63 461.38 3.05 471.37 3.47 C481.68 3.9 491.98 4.33 502.29 4.75 C511.16 5.12 520.04 5.49 528.91 5.86 C534.2 6.08 539.49 6.3 544.78 6.52 C549.74 6.72 554.69 6.93 559.65 7.14 C561.47 7.22 563.29 7.29 565.11 7.37 C567.59 7.47 570.07 7.58 572.55 7.68 C573.27 7.71 574 7.74 574.75 7.77 C577.75 7.9 580.2 8.15 583.07 9.11 C583.07 36.17 583.07 63.23 583.07 91.11 C360.32 91.11 137.57 91.11 -91.93 91.11 C-92.67 87.41 -93.15 84.12 -93.41 80.4 C-93.53 78.71 -93.53 78.71 -93.65 76.98 C-93.73 75.77 -93.82 74.55 -93.9 73.3 C-94.03 71.4 -94.03 71.4 -94.17 69.45 C-94.35 66.76 -94.53 64.06 -94.71 61.36 C-94.9 58.64 -95.08 55.92 -95.27 53.2 C-96.45 36.47 -97.22 19.88 -96.93 3.11 C-89.47 2.84 -82.01 2.57 -74.55 2.31 C-72.03 2.22 -69.52 2.13 -67 2.04 C-46.68 1.31 -26.37 0.68 -6.05 0.16 C-4.03 0.11 -2.02 0.05 0 0 Z"

// Small helpers to cut the boilerplate
function el(tag, className, text) {
    const node = document.createElement(tag)
    if (className) node.className = className
    if (text !== undefined) node.textContent = text
    return node
}

function svgEl(tag, attrs = {}) {
    const node = document.createElementNS(SVG_NS, tag)
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
    return node
}

function createBorder(borderColor) {
    const svg = svgEl("svg", { viewBox: "0 0 680 91" })
    svg.setAttribute("class", "mappool-map-border")

    const g = svgEl("g", {
        transform: "translate(96.92852783203125,-0.106964111328125)",
    })

    const common = {
        d: MAP_BORDER_PATH,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
    }

    g.append(
        svgEl("path", { ...common, fill: "white", stroke: "white", "stroke-width": 8 }),
        svgEl("path", { ...common, fill: borderColor, stroke: "black", "stroke-width": 4 })
    )

    svg.append(g)
    return svg
}

function createMapCard({
    mod = "",
    artist = "",
    title = "",
    version = "",
    cs = 0,
    ar = 0,
    od = 0,
    sr = 0,
    background = "",
    borderColor = "red",
} = {}) {
    const wrapper = el("div", "mappool-map-wrapper")
    const container = el("div", "mappool-map-container")

    const bg = el("div", "mappool-map-background")
    bg.append(el("div", "mappool-map-background-overlay"))
    if (background) bg.style.backgroundImage = `url("${background}")`

    const stats = el("div", "mappool-map-stats-container")
    stats.append(
        el("div", "mappool-map-stats-cs", `CS: ${cs}`),
        el("div", "mappool-map-stats-ar", `AR: ${ar}`),
        el("div", "mappool-map-stats-od", `OD: ${od}`),
        el("div", "mappool-map-stats-star mappool-map-stats-sr", `SR: ${sr}`)
    )

    container.append(
        bg,
        el("div", "mappool-map-mod", mod),
        el("div", "mappool-map-metadata mappool-map-artist-title", `${artist} - ${title}`),
        el("div", "mappool-map-metadata mappool-map-version", `[${version}]`),
        stats
    )

    wrapper.append(createBorder(borderColor), container)
    return wrapper
}

function renderMappool(maps, container) {
    container.replaceChildren(...maps.map(createMapCard))
}