import { updateChat } from "../_shared/core/chat.js"
import { constants } from "../_shared/js/constants.js"
import { deepEqual, getModColourVar, readSavedData, startPolling } from "../_shared/core/utils.js"
import { getHpBarWidth, getTeamHp, getTeamMaxHp } from "../_shared/core/match.js"
import { createCounter, setTeamName, setToggleHpVisible } from "../_shared/core/overlay.js"

// Round name
const roundNameEl = document.getElementById("round-name")
let currentRoundName

// Per team: name + HP (number + bar)
const teamEls = {
    red: {
        name: document.getElementById("team-name-left"),
        hp: document.getElementById("team-total-hp-left"),
        hpBar: document.getElementById("team-left-hp-bar"),
    },
    blue: {
        name: document.getElementById("team-name-right"),
        hp: document.getElementById("team-total-hp-right"),
        hpBar: document.getElementById("team-right-hp-bar"),
    },
}
const hpCounters = {
    red: createCounter(teamEls.red.hp),
    blue: createCounter(teamEls.blue.hp),
}
const currentTeamNames = { red: undefined, blue: undefined }

let previousMaxHp
let previousPlayerData

// Chat
const chatboxContainerEl = document.getElementById("chatbox-container")
let chatLen

// Mappool cards (built once from the dashboard's beatmaps) + their picks / bans
const mappoolMapWrapperEls = document.getElementsByClassName("mappool-map-wrapper")
let cardsBuilt = false
let currentPickBan = {}

// HP toggle
let currentToggleHp

// Which list of picks / bans a map is in (first match wins, like the dashboard shows it)
const PICK_BAN_ORDER = ["redBan", "blueBan", "redPick", "bluePick"]

function getData() {
    const data = readSavedData()

    // The dashboard hasn't saved anything (or hasn't heard from tosu) yet
    if (!data || !data.tosuData || !data.playerData) return

    const tourneyData = data.tosuData.tourney ?? {}
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
            hpCounters[side].update(hp)

            // A team's bar covers all 3 players' HP
            const barWidth = getHpBarWidth(hp, getTeamMaxHp(playerData, side, data.maxHp), constants.TEAM_HP_BAR_MAX_WIDTH)
            teamEls[side].hpBar.style.width = `${barWidth}px`
        }
    }

    // Team names
    const teamNames = { red: data.teamName?.redTeamName ?? "", blue: data.teamName?.blueTeamName ?? "" }
    for (const side of constants.SIDES) {
        if (currentTeamNames[side] !== teamNames[side]) {
            currentTeamNames[side] = teamNames[side]
            setTeamName(teamEls[side].name, teamNames[side])
        }
    }

    // Chat
    const chatData = tourneyData.chat ?? []
    if (chatLen !== chatData.length) {
        chatLen = updateChat(chatLen, chatData, chatboxContainerEl)
    }

    // Build the map cards once the dashboard has sent the beatmaps
    if (data.allBeatmaps?.length && !cardsBuilt) {
        cardsBuilt = true
        buildMapCards(data.allBeatmaps)
    }

    // Picks / bans
    const pickInfo = data.pickBanInfo ?? {}
    const pickBan = Object.fromEntries(PICK_BAN_ORDER.map(key => [key, pickInfo[key] ?? []]))
    if (!deepEqual(pickBan, currentPickBan)) {
        currentPickBan = pickBan
        updatePickBans()
    }

    // HP toggle
    if (currentToggleHp !== data.toggleHp) {
        currentToggleHp = data.toggleHp
        setToggleHpVisible(currentToggleHp)
    }
}

// One card per map, in pool order. Each card shows the map's label (B1, B2...) and is coloured by its mod.
function buildMapCards(beatmaps) {
    const container = document.getElementById("mappool-maps-container")
    container.replaceChildren(...beatmaps.map(createMapCard))
}

// Show "PICKED BY ..." / "BANNED BY ..." on each card
function updatePickBans() {
    for (const wrapper of mappoolMapWrapperEls) {
        const pickBanElement = wrapper.querySelector(".mappool-map-pick-ban")
        if (!pickBanElement) continue

        const mapId = wrapper.getAttribute("id")
        const key = PICK_BAN_ORDER.find(k => currentPickBan[k].includes(mapId))

        pickBanElement.style.display = key ? "block" : "none"
        if (!key) continue

        const isRight = key.startsWith("blue")
        pickBanElement.classList.toggle("mappool-map-pick-ban-left", !isRight)
        pickBanElement.classList.toggle("mappool-map-pick-ban-right", isRight)
        pickBanElement.textContent = constants.PICK_BAN_LABELS[key]
    }
}

// Small helpers to cut the boilerplate
function el(tag, className, text) {
    const node = document.createElement(tag)
    if (className) node.className = className
    if (text !== undefined) node.textContent = text
    return node
}

function svgEl(tag, attrs = {}) {
    const node = document.createElementNS(constants.SVG_NS, tag)
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
    return node
}

function createBorder(borderColor) {
    const svg = svgEl("svg", { viewBox: constants.MAP_BORDER_VIEWBOX, class: "mappool-map-border" })
    const g = svgEl("g", { transform: constants.MAP_BORDER_TRANSFORM })

    const common = {
        d: constants.MAP_BORDER_PATH,
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

function modChip(text, mod) {
    const chip = el("div", "mappool-map-mod", text)
    chip.style.backgroundColor = getModColourVar(mod)
    return chip
}

// Stats only exist for maps found in beatmaps.json; show a dash otherwise
function fmt(value, digits) {
    return value === undefined || value === "" || isNaN(Number(value)) ? "-" : Number(value).toFixed(digits)
}

function createMapCard({
    beatmap_id = "",
    label = "",
    mod = "",
    isTiebreaker = false,
    artist = "",
    title = "",
    version = "",
    diff_size,
    diff_approach,
    diff_overall,
    difficultyrating,
    beatmapset_id = "",
    borderColor = "red",
} = {}) {
    const wrapper = el("div", "mappool-map-wrapper")
    wrapper.setAttribute("id", beatmap_id)
    const container = el("div", "mappool-map-container")

    const bg = el("div", "mappool-map-background")
    bg.append(el("div", "mappool-map-background-overlay"))
    if (beatmapset_id) bg.style.backgroundImage = `url("${constants.BEATMAP_COVER_URL.replace("{id}", beatmapset_id)}")`

    const stats = el("div", "mappool-map-stats-container")
    stats.append(
        el("div", "mappool-map-stats-cs", `CS: ${fmt(diff_size, 1)}`),
        el("div", "mappool-map-stats-ar", `AR: ${fmt(diff_approach, 1)}`),
        el("div", "mappool-map-stats-od", `OD: ${fmt(diff_overall, 1)}`),
        el("div", "mappool-map-stats-star mappool-map-stats-sr", `SR: ${fmt(difficultyrating, 2)}`)
    )

    container.append(
        bg,
        modChip(label || mod, isTiebreaker ? "TB" : mod),
        el("div", "mappool-map-metadata mappool-map-artist-title", `${artist} - ${title}`),
        el("div", "mappool-map-metadata mappool-map-version", `[${version}]`),
        stats,
        el("div", "mappool-map-pick-ban mappool-map-pick-ban-right", constants.PICK_BAN_LABELS.bluePick)
    )

    wrapper.append(createBorder(borderColor), container)
    return wrapper
}

startPolling(getData)
