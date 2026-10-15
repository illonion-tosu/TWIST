import { loadBeatmaps } from "../_shared/core/beatmaps.js"
import { findTeam, loadTeams } from "../_shared/core/teams.js"
import { createTosuWsSocket } from "../_shared/core/websocket.js"

// Saved match state: read it before anything gets a chance to overwrite it
let savedState = null
try {
    savedState = JSON.parse(localStorage.getItem("data"))
} catch {
    savedState = null
}
let stateReady = false // saving is paused until the restore has run

// Human's Lucky! state waits here until its team has been set up by changeTeams
const pendingHuman = { red: null, blue: null }

// Round Name
const roundNameEl = document.getElementById("round-name")
let roundName

// Beatmaps
let allBeatmaps = []

// Select next picker
const autoPickButtonEl = document.getElementById("auto-pick-button")
const nextPickerEl = document.getElementById("next-picker")
const selectNextPickerButtonRedEl = document.getElementById("select-next-picker-button-red")
const selectNextPickerButtonBlueEl = document.getElementById("select-next-picker-button-blue")
const selectNextPickerButtonNoneEl = document.getElementById("select-next-picker-button-none")
let nextPicker = "red"

const capitalise = text => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()

function setNextPicker(team) {
    nextPickerEl.textContent = `Next: ${capitalise(team)}`
    nextPicker = team.toLowerCase()
}

// current picker
const currentPickerEl = document.getElementById("current-picker")
const selectCurrentPickerButtonRedEl = document.getElementById("select-current-picker-button-red")
const selectCurrentPickerButtonBlueEl = document.getElementById("select-current-picker-button-blue")
const selectCurrentPickerButtonNoneEl = document.getElementById("select-current-picker-button-none")
let currentPicker = "blue"

function setCurrentPicker(team) {
    currentPickerEl.textContent = `Current: ${capitalise(team)}`
    currentPicker = team.toLowerCase()
}

// The HTML says "None" until clicked, but the variables above start as red / blue: show what's really in effect
setNextPicker(nextPicker)
setCurrentPicker(currentPicker)

// Toggle HP
const toggleHpEl = document.getElementById("toggle-hp-button")

// Auto OBS Button
const autoObsButtonEl = document.getElementById("auto-obs-button")

// Max HP
const DEFAULT_MAX_HP = 300000
let maxHp = DEFAULT_MAX_HP
let playerData = {
    player1: {
        id: 123456,
        playerName: "",
        class: "",
        currentMaxHp: 300000,
        currentScore: 0,
        currentTarget: 6,
        currentScoreAgainst: 0,
        currentDeadRounds: 0,
    },
    player2: {
        id: 123456,
        playerName: "",
        class: "",
        currentMaxHp: 300000,
        currentScore: 0,
        currentTarget: 5,
        currentScoreAgainst: 0,
        currentDeadRounds: 0,
    },
    player3: {
        id: 123456,
        playerName: "",
        class: "",
        currentMaxHp: 300000,
        currentScore: 0,
        currentTarget: 4,
        currentScoreAgainst: 0,
        currentDeadRounds: 0,
    },
    player4: {
        id: 123456,
        playerName: "",
        class: "",
        currentMaxHp: 300000,
        currentScore: 0,
        currentTarget: 3,
        currentScoreAgainst: 0,
        currentDeadRounds: 0,
    },
    player5: {
        id: 123456,
        playerName: "",
        class: "",
        currentMaxHp: 300000,
        currentScore: 0,
        currentTarget: 2,
        currentScoreAgainst: 0,
        currentDeadRounds: 0,
    },
    player6: {
        id: 123456,
        playerName: "",
        class: "",
        currentMaxHp: 300000,
        currentScore: 0,
        currentTarget: 1,
        currentScoreAgainst: 0,
        currentDeadRounds: 0,
    },
}

// Mappool Select Container
const mappoolSelectContainerEl = document.getElementById("mappool-select-container")

loadBeatmaps().then(beatmaps => {
    // Set Round Name
    roundName = beatmaps.roundName
    roundNameEl.textContent = roundName
    allBeatmaps = beatmaps.beatmaps

    // Set Max HP
    switch (roundName.toLowerCase()) {
        case "quarterfinals": case "quarter finals": case "qf":
            maxHp = 400000
            break
        case "semifinals": case "sf": case "semi finals":
            maxHp = 600000
            break
        case "finals": case "f": case "gf": case "grand finals":
            maxHp = 800000
            break
        default:
            maxHp = DEFAULT_MAX_HP
            console.warn(`Unknown round name "${roundName}", using ${DEFAULT_MAX_HP} max HP. Set it with the Map Starting HP box.`)
    }

    // Set all input values to max hp
    for (let i = 0; i < teamHpIOnputNumberElements.length; i++) {
        teamHpIOnputNumberElements[i].value = maxHp
    }

    // Set all player's current max hp
    for (const key in playerData) {
        playerData[key].currentMaxHp = maxHp
    }

    mappoolSelectContainerEl.innerHTML = ""
    allBeatmaps.map(beatmap => {
        const button = document.createElement("button")
        button.classList.add("mappool-select-button")
        button.textContent = `${beatmap.mod}${beatmap.order}`
        button.setAttribute("id", beatmap.beatmap_id)
        button.addEventListener("mousedown", mapClickEvent)
        button.addEventListener("contextmenu", event => event.preventDefault())
        mappoolSelectContainerEl.append(button)
    })

    try {
        restoreSavedState()
    } catch (error) {
        console.error("Could not restore saved state:", error)
    }
    stateReady = true
}).catch(error => {
    console.error("Could not load beatmaps:", error)
    stateReady = true
})

// Map Click Event
let redBan = []
let redPick = []
let blueBan = []
let bluePick = []
function mapClickEvent(event) {
    // Team
    let team
    if (event.button === 0) team = "red"
    else if (event.button === 2) team = "blue"
    if (!team) return

    // Action
    let action = "pick"
    if (event.ctrlKey) action = "ban"
    if (event.shiftKey) action = "clear"

    // Filter it out of everything first
    redBan = redBan.filter(id => id !== this.getAttribute("id"))
    redPick = redPick.filter(id => id !== this.getAttribute("id"))
    blueBan = blueBan.filter(id => id !== this.getAttribute("id"))
    bluePick = bluePick.filter(id => id !== this.getAttribute("id"))

    // Remove all related classes to it
    this.classList.remove("mappool-select-button-red-ban")
    this.classList.remove("mappool-select-button-blue-ban")
    this.classList.remove("mappool-select-button-red-pick")
    this.classList.remove("mappool-select-button-blue-pick")

    // Add elements + classes
    if (team === "red" && action === "ban") {
        redBan.push(this.getAttribute("id"))
        this.classList.add("mappool-select-button-red-ban")
    }
    if (team === "red" && action === "pick") {
        redPick.push(this.getAttribute("id"))
        this.classList.add("mappool-select-button-red-pick")
        setCurrentPicker(team)
    }
    if (team === "blue" && action === "ban") {
        blueBan.push(this.getAttribute("id"))
        this.classList.add("mappool-select-button-blue-ban")
    }
    if (team === "blue" && action === "pick") {
        bluePick.push(this.getAttribute("id"))
        this.classList.add("mappool-select-button-blue-pick")
        setCurrentPicker(team)
    }
}

// Damage multiplier: +0.5x after every 2 maps (maps 1-2 = 1x, 3-4 = 1.5x, 5-6 = 2x, ...)
const DAMAGE_MULTIPLIER_STEP = 0.5
const MAPS_PER_MULTIPLIER_STEP = 2
const mapsPlayedInputEl = document.getElementById("maps-played-input")
const damageMultiplierEl = document.getElementById("damage-multiplier")
let mapsPlayed = 0

function getDamageMultiplier() {
    return 1 + DAMAGE_MULTIPLIER_STEP * Math.floor(mapsPlayed / MAPS_PER_MULTIPLIER_STEP)
}

function refreshDamageMultiplierUi() {
    mapsPlayedInputEl.value = mapsPlayed
    damageMultiplierEl.textContent = `${getDamageMultiplier()}x`
}
refreshDamageMultiplierUi()

// Class abilities
// Class of a player (lowercase). Stored in playerData, filled from currentTeam.playerX.class
const classOf = playerNumber => playerData[`player${playerNumber}`]?.class ?? ""

const defaultHuman = () => ({ lucky: false, poolSize: 0 })

const abilities = {
    // Human's Lucky!, keyed by player number 1-6
    human: Object.fromEntries([1, 2, 3, 4, 5, 6].map(n => [n, defaultHuman()])),
    demigod: null, // { player, mode, target }, cleared after every map
    soulweaver: null, // { challenger, challenged }, cleared after every map
}

const DEMIGOD_MULTIPLIERS = { 3: 4, 2: 3, 1: 2 } // keyed by opponents alive
const SOULWEAVER_CHALLENGED_MULTIPLIER = 1.4

const classPanelsEl = document.getElementById("class-panels")

const sideOf = playerNumber => playerNumber <= 3 ? "red" : "blue"
const playersOf = side => side === "red" ? [1, 2, 3] : [4, 5, 6]
const otherSide = side => side === "red" ? "blue" : "red"

const isAlive = playerNumber => playerData[`player${playerNumber}`]?.currentMaxHp > 0
const playerLabel = playerNumber =>
    playerData[`player${playerNumber}`]?.playerName || `Player ${playerNumber}`

// Apply the Human state waiting for this side (if it was saved for this team) or reset to defaults
function applyPendingHuman(side, teamName) {
    const pending = pendingHuman[side]
    pendingHuman[side] = null
    const state = pending && pending.teamName === teamName ? pending.state : null

    for (const n of playersOf(side)) {
        const s = state?.[n] ?? defaultHuman()
        abilities.human[n] = {
            lucky: Boolean(s.lucky),
            poolSize: Math.max(0, Number(s.poolSize) || 0),
        }
        document.getElementById(`human-${n}-lucky`).checked = abilities.human[n].lucky
        document.getElementById(`human-${n}-pool`).value = Math.max(0, abilities.human[n].poolSize - 1)
    }
}

function restoreSavedState() {
    const saved = savedState
    savedState = null

    // Only restore the same round, so a new round never starts with last round's HP
    if (!saved || saved.roundName !== roundName) return

    // Players: HP, dead rounds, revive HP, targets (scores start fresh)
    Object.keys(playerData).forEach((key, i) => {
        const savedPlayer = saved.playerData?.[key]
        if (!savedPlayer) return
        Object.assign(playerData[key], savedPlayer)
        playerData[key].currentScore = 0
        playerData[key].effectiveScore = 0
        playerData[key].currentScoreAgainst = 0
        teamHpIOnputNumberElements[i].value = playerData[key].currentMaxHp
    })
    syncTargetSelects()

    // Maps played + multiplier display
    mapsPlayed = Math.max(0, Math.floor(Number(saved.mapsPlayed)) || 0)
    refreshDamageMultiplierUi()

    toggleHpEl.checked = Boolean(saved.toggleHp)

    // Picks and bans
    redBan = [...(saved.pickBanInfo?.redBan ?? [])]
    redPick = [...(saved.pickBanInfo?.redPick ?? [])]
    blueBan = [...(saved.pickBanInfo?.blueBan ?? [])]
    bluePick = [...(saved.pickBanInfo?.bluePick ?? [])]

    const classesFor = [
        [redBan, "mappool-select-button-red-ban"],
        [redPick, "mappool-select-button-red-pick"],
        [blueBan, "mappool-select-button-blue-ban"],
        [bluePick, "mappool-select-button-blue-pick"],
    ]
    mappoolSelectContainerEl.querySelectorAll(".mappool-select-button").forEach(button => {
        for (const [list, className] of classesFor) {
            if (list.includes(button.id)) button.classList.add(className)
        }
    })

    // Pickers
    if (saved.mappoolInfo?.currentPicker) setCurrentPicker(saved.mappoolInfo.currentPicker)
    if (saved.nextPicker) setNextPicker(saved.nextPicker)

    // Human's Lucky!: keep the saved values in memory straight away (so the autosave doesn't wipe them
    // before the teams load), then let changeTeams apply them to the UI once the matching team is set up
    const savedHuman = saved.abilities?.human
    if (savedHuman) {
        for (const n of [1, 2, 3, 4, 5, 6]) {
            const s = savedHuman[n]
            if (s) abilities.human[n] = { lucky: Boolean(s.lucky), poolSize: Math.max(0, Number(s.poolSize) || 0) }
        }

        for (const side of ["red", "blue"]) {
            const savedTeamName = saved.teamName?.[`${side}TeamName`]
            if (!savedTeamName) continue

            pendingHuman[side] = { teamName: savedTeamName, state: savedHuman }
            const currentTeamName = side === "red" ? redTeamName : blueTeamName
            if (currentTeamName === savedTeamName) applyPendingHuman(side, currentTeamName)
        }
    }
}

// Lets you correct the count by hand (e.g. a map was replayed)
mapsPlayedInputEl.addEventListener("input", () => {
    mapsPlayed = Math.max(0, Math.floor(Number(mapsPlayedInputEl.value)) || 0)
    damageMultiplierEl.textContent = `${getDamageMultiplier()}x`
})

function el(tag, props = {}, ...children) {
    const node = document.createElement(tag)
    const { className, dataset, ...rest } = props
    if (className) node.className = className
    if (dataset) Object.assign(node.dataset, dataset)
    Object.assign(node, rest)
    node.append(...children)
    return node
}

function buildClassPanel(side) {
    const colour = `team-${side}-colour`

    const select = (id, scope) =>
        el("select", {
            className: "class-player-select",
            id,
            dataset: { side, scope },
        })

    const row = (label, control) =>
        el("div", { className: "team-hp-container" },
            el("div", { className: `team-hp ${colour}`, textContent: label }),
            control
        )

    const checkbox = (id, label, perMap = false) =>
        el("label", { className: "auto-labels" },
            el("input", {
                type: "checkbox",
                id,
                className: perMap ? "per-map-ability" : "",
            }),
            el("span", { textContent: label })
        )

    const numberInput = (id) =>
        el("input", { type: "number", id, min: "0", value: "0" })

    const modeSelect = (id) =>
        el("select", { id },
            el("option", { value: "split", textContent: "Split" }),
            el("option", { value: "target", textContent: "Target" })
        )

    const controls = (n, name, ...children) =>
        el("div", {
            className: "class-controls",
            id: `class-controls-${n}-${name}`,
            hidden: true,
        }, ...children)

    // One block per player; only the controls for that player's own class are shown
    const playerBlock = n =>
        el("div", { className: "class-player", id: `class-player-${n}`, hidden: true },
            el("div", { className: `team-hp ${colour}`, id: `class-player-title-${n}` }),

            controls(n, "human",
                checkbox(`human-${n}-lucky`, "Lucky!"),
                row("Maps before Lucky!:", numberInput(`human-${n}-pool`))
            ),

            controls(n, "demigod",
                checkbox(`demigod-${n}-active`, "Go solo this map", true),
                row("Mode:", modeSelect(`demigod-${n}-mode`)),
                row("Target:", select(`demigod-${n}-target`, "opp"))
            ),

            controls(n, "soulweaver",
                checkbox(`soulweaver-${n}-active`, "Duel this map", true),
                row("Challenged:", select(`soulweaver-${n}-challenged`, "opp"))
            )
        )

    return el("div", { className: "class-panel" },
        el("div", {
            className: `class-panel-title ${colour}`,
            id: `class-title-${side}`,
        }),

        el("div", {
            className: "team-hp-wrapper",
            id: `class-wrapper-${side}`,
            hidden: true,
        },
            el("div", { className: "team-hp-wrapper-left" },
                ...playersOf(side).map(playerBlock)
            )
        ),

        // Validation errors from the Submit button show up here
        el("div", {
            className: "class-error",
            id: `class-error-${side}`,
            hidden: true,
            style: "color: #ff6b6b; font-size: 14px; margin-top: 6px;",
        })
    )
}

classPanelsEl.replaceChildren(...["red", "blue"].map(buildClassPanel))

// Fill every player select (value = player number 1-6, text = player name)
function refreshClassSelects() {
    document.querySelectorAll(".class-player-select").forEach(select => {
        const side = select.dataset.side
        const teamSide = select.dataset.scope === "own" ? side : otherSide(side)
        const offset = teamSide === "red" ? 0 : 3
        const previous = select.value

        select.innerHTML = ""
        for (let i = 1; i <= 3; i++) {
            const option = document.createElement("option")
            option.value = offset + i
            option.textContent = playerLabel(offset + i)
            select.append(option)
        }
        if (previous) select.value = previous
    })

}
refreshClassSelects()

function showClassError(side, messages) {
    const errorEl = document.getElementById(`class-error-${side}`)
    if (!errorEl) return
    errorEl.textContent = messages.join(" ")
    errorEl.hidden = messages.length === 0
}

// Show only the controls for each player's own class
const CLASSES_WITH_CONTROLS = ["human", "demigod", "soulweaver"]

function updateClassPanel(side) {
    const names = []

    for (const n of playersOf(side)) {
        const className = classOf(n)
        if (className) names.push(capitalise(className))

        document.getElementById(`class-player-${n}`).hidden = !CLASSES_WITH_CONTROLS.includes(className)
        document.getElementById(`class-player-title-${n}`).textContent =
            `${playerLabel(n)}: ${capitalise(className)}`

        for (const type of CLASSES_WITH_CONTROLS) {
            document.getElementById(`class-controls-${n}-${type}`).hidden = className !== type
        }
    }

    const classText = [...new Set(names)].join(" / ")
    document.getElementById(`${side}-class`).textContent = classText
    document.getElementById(`class-title-${side}`).textContent =
        `${side === "red" ? "Red" : "Blue"}: ${classText}`

    // Classes without controls (e.g. Witch) have nothing to submit
    document.getElementById(`class-wrapper-${side}`).hidden =
        !playersOf(side).some(n => CLASSES_WITH_CONTROLS.includes(classOf(n)))

    showClassError(side, [])
}

// Read the controls and validate them. Returns { errors, next } and changes nothing.
function evaluateClasses() {
    const errors = { red: [], blue: [] }
    const next = {
        human: { ...abilities.human },
        demigod: null,
        soulweaver: null,
    }
    let demigodSide = null
    let soulweaverSide = null

    const value = id => document.getElementById(id).value
    const checked = id => document.getElementById(id).checked

    for (const side of ["red", "blue"]) {
        const opp = playersOf(otherSide(side))

        for (const n of playersOf(side)) {
            const className = classOf(n)

            if (className === "human") {
                const mapsBefore = Math.max(0, Math.floor(Number(value(`human-${n}-pool`))) || 0)
                next.human[n] = {
                    lucky: checked(`human-${n}-lucky`),
                    poolSize: mapsBefore + 1,
                }
            }

            if (className === "demigod" && checked(`demigod-${n}-active`)) {
                const mode = value(`demigod-${n}-mode`)
                const target = Number(value(`demigod-${n}-target`))

                if (!isAlive(n)) {
                    errors[side].push(`${playerLabel(n)} is dead and can't go solo.`)
                }

                if (mode === "target") {
                    if (!opp.includes(target)) {
                        errors[side].push("Pick a target from the opposing team.")
                    } else if (!isAlive(target)) {
                        errors[side].push(`${playerLabel(target)} is dead and can't be targeted.`)
                    }
                } else if (!opp.some(isAlive)) {
                    errors[side].push("There are no opponents alive to hit.")
                }

                if (next.demigod) {
                    errors[side].push("Only one Demigod can go solo per map.")
                }
                next.demigod = { player: n, mode, target }
                demigodSide ??= side
            }

            if (className === "soulweaver" && checked(`soulweaver-${n}-active`)) {
                const challenged = Number(value(`soulweaver-${n}-challenged`))

                if (!isAlive(n)) {
                    errors[side].push(`${playerLabel(n)} is dead and can't duel.`)
                }

                if (!opp.includes(challenged)) {
                    errors[side].push("Pick a challenged player from the opposing team.")
                } else if (!isAlive(challenged)) {
                    errors[side].push(`${playerLabel(challenged)} is dead and can't be challenged.`)
                }

                if (next.soulweaver) {
                    errors[side].push("Only one duel can happen per map.")
                }
                next.soulweaver = { challenger: n, challenged }
                soulweaverSide ??= side
            }
        }
    }

    // Demigod and Soulweaver both zero out players, so they can't share a map
    if (next.demigod && next.soulweaver) {
        const message = "Demigod and Soulweaver can't both be active in the same map."
        errors[demigodSide].push(message)
        if (soulweaverSide !== demigodSide) errors[soulweaverSide].push(message)
    }

    return { errors, next }
}

// Runs whenever a class control changes. Toggles take effect straight away.
// If the new setting is invalid, the ability that was just switched on is switched back off,
// the errors are shown, and everything else stays as it was.
function applyClasses(changedBlock) {
    const hasErrors = ({ errors }) => errors.red.length > 0 || errors.blue.length > 0

    let result = evaluateClasses()
    const rejected = hasErrors(result)
    const shownErrors = result.errors

    if (rejected) {
        console.warn("Class change rejected:", shownErrors)
        changedBlock?.querySelectorAll(".per-map-ability").forEach(checkboxEl => { checkboxEl.checked = false })
        result = evaluateClasses()
    }

    if (!hasErrors(result)) {
        abilities.human = result.next.human
        abilities.demigod = result.next.demigod
        abilities.soulweaver = result.next.soulweaver
    }

    showClassError("red", rejected ? shownErrors.red : [])
    showClassError("blue", rejected ? shownErrors.blue : [])
}

// Demigod / Soulweaver only last one map. Human's Lucky! stays.
function resetMapAbilities() {
    abilities.demigod = null
    abilities.soulweaver = null
    document.querySelectorAll(".per-map-ability").forEach(checkboxEl => { checkboxEl.checked = false })
    showClassError("red", [])
    showClassError("blue", [])
}

// Lucky! bonus: 1 number = 77.7%, -7% per extra number, floor 7.7%
function getLuckyBonus(poolSize) {
    return Math.max(7.7, 77.7 - 7 * (Math.max(1, poolSize) - 1)) / 100
}

function countAlive(side) {
    const numbers = side === "red" ? [1, 2, 3] : [4, 5, 6]
    return numbers.filter(n => playerData[`player${n}`].currentMaxHp > 0).length
}

function getScoreMultiplier(playerNumber) {
    const side = sideOf(playerNumber)
    let multiplier = 1

    // Human: Lucky! bonus applies to that player only
    const human = abilities.human[playerNumber]
    if (classOf(playerNumber) === "human" && human?.lucky) {
        multiplier *= 1 + getLuckyBonus(human.poolSize)
    }

    // Soulweaver: challenged player gets 1.4x
    if (abilities.soulweaver?.challenged === playerNumber) {
        multiplier *= SOULWEAVER_CHALLENGED_MULTIPLIER
    }

    // Demigod: multiplier depends on opponents alive
    if (abilities.demigod?.player === playerNumber) {
        multiplier *= DEMIGOD_MULTIPLIERS[countAlive(otherSide(side))] ?? 1
    }

    return multiplier
}

// Lower effective score loses. Tie = nobody loses.
function getDuelLoser() {
    const duel = abilities.soulweaver
    if (!duel) return null

    const challengerScore = playerData[`player${duel.challenger}`].effectiveScore
    const challengedScore = playerData[`player${duel.challenged}`].effectiveScore
    if (challengerScore === challengedScore) return null

    return challengerScore > challengedScore
        ? `player${duel.challenged}`
        : `player${duel.challenger}`
}

// Load Teams
let teamsLoaded = false
// tosu messages are ignored for team names until this finishes; the next message then picks the teams up
loadTeams().then(() => {
    teamsLoaded = true
}).catch(error => console.error("Could not load teams:", error))

// Change Teams
function changeTeams(teamName, side) {
    // Find team
    const currentTeam = findTeam(teamName)
    if (!currentTeam) return

    // Reset Human state for this side (classes are set per player below)
    for (const n of playersOf(side)) {
        abilities.human[n] = defaultHuman()
        document.getElementById(`human-${n}-lucky`).checked = false
        document.getElementById(`human-${n}-pool`).value = 0
    }

    // Set up arrays
    let currentPlayers = []
    let teamHpPlayerElements = []
    let teamMapTargetSelectionPlayerElements = []
    let teamMapTargetSelectionPlayerSelectElements = []
    if (side === "red") {
        currentPlayers.push(playerData.player1, playerData.player2, playerData.player3)
        teamHpPlayerElements.push(
            document.getElementById("team-hp-player-1"),
            document.getElementById("team-hp-player-2"),
            document.getElementById("team-hp-player-3")
        )
        teamMapTargetSelectionPlayerElements.push(
            document.getElementById("map-target-selection-player-1"),
            document.getElementById("map-target-selection-player-2"),
            document.getElementById("map-target-selection-player-3")
        )
        teamMapTargetSelectionPlayerSelectElements.push(
            document.getElementById("map-target-selection-player-4-select"),
            document.getElementById("map-target-selection-player-5-select"),
            document.getElementById("map-target-selection-player-6-select")
        )
    } else {
        currentPlayers.push(playerData.player4, playerData.player5, playerData.player6)
        teamHpPlayerElements.push(
            document.getElementById("team-hp-player-4"),
            document.getElementById("team-hp-player-5"),
            document.getElementById("team-hp-player-6")
        )
        teamMapTargetSelectionPlayerElements.push(
            document.getElementById("map-target-selection-player-4"),
            document.getElementById("map-target-selection-player-5"),
            document.getElementById("map-target-selection-player-6")
        )
        teamMapTargetSelectionPlayerSelectElements.push(
            document.getElementById("map-target-selection-player-1-select"),
            document.getElementById("map-target-selection-player-2-select"),
            document.getElementById("map-target-selection-player-3-select")
        )
    }

    // Set players
    for (let i = 0; i < currentPlayers.length; i++) {
        const currentPlayer = currentTeam[`player${i + 1}`]
        const currentPlayerId = currentPlayer.id
        const currentPlayerName = currentPlayer.playerName
        currentPlayers[i].id = currentPlayerId
        currentPlayers[i].playerName = currentPlayerName

        // Class is stored on each player: currentTeam.playerX.class
        currentPlayers[i].class = String(currentPlayer.class ?? "").toLowerCase()

        teamHpPlayerElements[i].textContent = currentPlayerName
        teamMapTargetSelectionPlayerElements[i].textContent = currentPlayerName

        // Fill each select's options with the matching team player
        // Value = player number (1-6), since that's what currentTarget uses
        const playerNumberOffset = side === "red" ? 0 : 3
        const options = teamMapTargetSelectionPlayerSelectElements[i].children
        for (let j = 0; j < options.length; j++) {
            const optionPlayer = currentTeam[`player${j + 1}`]
            if (!optionPlayer) continue
            options[j].textContent = optionPlayer.playerName
            options[j].value = playerNumberOffset + j + 1
        }
    }

    refreshClassSelects()
    updateClassPanel(side)
    syncTargetSelects()

    // Restore saved Lucky! state if this is the team it was saved for
    applyPendingHuman(side, teamName)
}

// Team HP Button
const teamHpButtonEl = document.getElementById("team-hp-button")
const teamHpIOnputNumberElements = [
    document.getElementById("team-hp-input-number-player-1"),
    document.getElementById("team-hp-input-number-player-2"),
    document.getElementById("team-hp-input-number-player-3"),
    document.getElementById("team-hp-input-number-player-4"),
    document.getElementById("team-hp-input-number-player-5"),
    document.getElementById("team-hp-input-number-player-6")
]

function setHpButton() {
    for (let i = 0; i < teamHpIOnputNumberElements.length; i++) {
        const player = playerData[`player${i + 1}`]
        player.currentMaxHp = Number(teamHpIOnputNumberElements[i].value)
        if (player.currentMaxHp > 0) {
            player.currentDeadRounds = 0
            player.reviveHp = null
        }
    }
}

// Map Target Button
const mapTargetButtonEl = document.getElementById("map-target-button")
const targetSelectElements = [1, 2, 3, 4, 5, 6].map(i =>
    document.getElementById(`map-target-selection-player-${i}-select`)
)

function setTargetButton() {
    targetSelectElements.forEach((selectEl, i) => {
        const value = Number(selectEl.value)
        // Ignore placeholder options that haven't been filled with a player yet
        if (Number.isNaN(value)) return
        playerData[`player${i + 1}`].currentTarget = value
    })
}

// Make dropdowns reflect what's actually in playerData
function syncTargetSelects() {
    targetSelectElements.forEach((selectEl, i) => {
        const target = String(playerData[`player${i + 1}`].currentTarget)
        if ([...selectEl.options].some(option => option.value === target)) {
            selectEl.value = target
        }
    })
}

// IPC State
let previousIpcState, currentIpcState
let checkedWinner = false

// Mappool Map Found
let currentId, currentChecksum
let mappoolMapFound = false
let mappoolMapModId
let currentBeatmap

// Team Names
const teamRedNameEl = document.getElementById("team-red-name")
const teamBlueNameEl = document.getElementById("team-blue-name")
let redTeamName, blueTeamName

// Current map info
const currentMapEl = document.getElementById("current-map")
const currentModIdEl = document.getElementById("current-mod-id")

// Socket
const socket = createTosuWsSocket()
let socketData
socket.onmessage = event => {
    socketData = JSON.parse(event.data)

    // Team Names
    const teamNames = socketData.tourney?.team
    if (teamsLoaded && teamNames) {
        if (redTeamName !== teamNames.left) {
            redTeamName = teamNames.left
            changeTeams(redTeamName, "red")
        }

        if (blueTeamName !== teamNames.right) {
            blueTeamName = teamNames.right
            changeTeams(blueTeamName, "blue")
        }
    }

    // Set score against information
    if (currentIpcState !== socketData.tourney.ipcState) {
        previousIpcState = currentIpcState
        currentIpcState = socketData.tourney.ipcState

        // Calculate scores
        if (currentIpcState === 2 || currentIpcState === 3 || currentIpcState === 4) {
            checkedWinner = false
            updatePlayerData(playerData, socketData)

            if (autoObsButtonEl.checked) {
                changeScene("Gameplay")
            }
        }

        // Reset information
        if (currentIpcState === 1 && previousIpcState === 4 && !checkedWinner) {
            checkedWinner = true

            if (toggleHpEl.checked) {
                applyDamage(playerData)

                if (autoObsButtonEl.checked) {
                    if (isTeamEliminated(["player1", "player2", "player3"]) || isTeamEliminated(["player4", "player5", "player6"])) {
                        changeScene("Winner")
                    } else {
                        changeScene("Mappool")
                    }
                }
            } else {
                clearScores()
                resetMapAbilities()
            }
        }

        // Handles aborting map
        if (currentIpcState === 1 && (previousIpcState === 2 || previousIpcState === 3)) {
            clearScores()
        }
    }

    // Keep scores updating live while the map is being played
    if (currentIpcState === 2 || currentIpcState === 3 || currentIpcState === 4) {
        updatePlayerData(playerData, socketData)
    }


    if (socketData.beatmap && (currentId !== socketData.beatmap.id || currentChecksum !== socketData.beatmap.checksum)) {
        currentId = socketData.beatmap.id
        currentChecksum = socketData.beatmap.checksum

        currentBeatmap = allBeatmaps.find(beatmap => Number(beatmap.beatmap_id) === Number(socketData.beatmap.id))
        currentMapEl.textContent = `${socketData.beatmap.artist} - ${socketData.beatmap.title}`

        // Autopicking
        // (it used to check currentPicker here, so "None" as next picker still auto picked for blue)
        const targetElement = document.getElementById(`${currentId}`)
        if (currentBeatmap && targetElement && autoPickButtonEl.checked && nextPicker !== "none") {
            const event = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                view: window,
                button: nextPicker === "red" ? 0 : 2
            })
            targetElement.dispatchEvent(event)
            setCurrentPicker(nextPicker)
            setNextPicker(nextPicker === "red" ? "Blue" : "Red")
        }

        // Mappool map found
        if (currentBeatmap) {
            mappoolMapFound = true
            mappoolMapModId = `${currentBeatmap.mod.toUpperCase()}${currentBeatmap.order}`
            currentModIdEl.textContent = mappoolMapModId
        } else {
            // Not a pool map: previously the old flag stayed true and main/ crashed on the missing beatmap
            mappoolMapFound = false
            mappoolMapModId = undefined
            currentModIdEl.textContent = ""
        }
    }
}

// Clear scores
function clearScores() {
    Object.values(playerData).forEach(player => {
        player.currentScore = 0
        player.effectiveScore = 0
        player.currentScoreAgainst = 0
    })
}

// A team is out when none of its players have any HP left
function isTeamEliminated(playerKeys) {
    return playerKeys.every(key => playerData[key].currentMaxHp <= 0)
}

// Apply damage
function applyDamage(playerData) {
    // Decide the duel from final scores before anything is reset
    const duelLoser = getDuelLoser()

    Object.entries(playerData).forEach(([playerKey, player], i) => {
        const wasAlive = player.currentMaxHp > 0

        player.currentMaxHp = Math.max(0, Math.round(player.currentMaxHp - player.currentScoreAgainst))

        if (wasAlive && playerKey === duelLoser) {
            // Lost the duel: dies, returns at 50% of round max HP
            // (checked first so a duel loser who also hits 0 from damage still gets 50%)
            player.currentMaxHp = 0
            player.currentDeadRounds = 2
            player.reviveHp = Math.round(maxHp * 0.5)
        } else if (wasAlive && player.currentMaxHp === 0) {
            // Died to damage: returns at 30% of round max HP
            player.currentDeadRounds = 2
            player.reviveHp = null
        } else if (player.currentDeadRounds > 0) {
            player.currentDeadRounds--

            if (player.currentDeadRounds === 0) {
                // Duel losers return at 50%, everyone else at 30% of round max HP
                player.currentMaxHp = player.reviveHp ?? Math.round(maxHp * 0.3)
                player.reviveHp = null
            }
        }

        // Damage is committed, so clear it
        player.currentScore = 0
        player.effectiveScore = 0
        player.currentScoreAgainst = 0

        teamHpIOnputNumberElements[i].value = player.currentMaxHp
    })

    resetMapAbilities()

    mapsPlayed++
    refreshDamageMultiplierUi()
}

setInterval(() => {
    teamRedNameEl.textContent = redTeamName ?? ""
    teamBlueNameEl.textContent = blueTeamName ?? ""

    if (!stateReady) return

    // Save information
    const savedInfo = {
        tosuData: socketData,
        maxHp: maxHp,
        playerData: playerData,
        roundName: roundName,
        teamName: {
            redTeamName: redTeamName,
            blueTeamName: blueTeamName
        },
        mappoolInfo: {
            mappoolMapFound: mappoolMapFound,
            mappoolMapModId: mappoolMapModId,
            currentPicker: currentPicker,
            currentBeatmap: currentBeatmap
        },
        allBeatmaps: allBeatmaps,
        pickBanInfo: {
            redBan: redBan,
            redPick: redPick,
            blueBan: blueBan,
            bluePick: bluePick
        },
        toggleHp: toggleHpEl.checked,
        mapsPlayed: mapsPlayed,
        damageMultiplier: getDamageMultiplier(),
        nextPicker: nextPicker,
        abilities: { human: abilities.human },
    }

    localStorage.setItem("data", JSON.stringify(savedInfo))
}, 100)


function updatePlayerData(playerData, data) {
    // Raw scores
    Object.values(playerData).forEach(player => {
        const client = data.tourney?.clients?.find(
            client => client.user.id === player.id
        )

        player.currentScore = client?.play.score ?? 0
    })

    // Effective scores (class bonuses applied, sit-outs zeroed)
    Object.entries(playerData).forEach(([playerKey, player]) => {
        const playerNumber = Number(playerKey.replace("player", ""))
        const demigod = abilities.demigod
        const duel = abilities.soulweaver

        // Demigod: the rest of the Demigod's team sits out
        const demigodSatOut = demigod
            && sideOf(playerNumber) === sideOf(demigod.player)
            && playerNumber !== demigod.player

        // Soulweaver: only the two duelists play, everyone else is 0
        const duelSatOut = duel
            && playerNumber !== duel.challenger
            && playerNumber !== duel.challenged

        player.effectiveScore = (demigodSatOut || duelSatOut)
            ? 0
            : player.currentScore * getScoreMultiplier(playerNumber)
    })

    // Reset damage, then build it up
    Object.values(playerData).forEach(player => { player.currentScoreAgainst = 0 })
    if (!toggleHpEl.checked) return

    if (abilities.demigod) {
        setDemigodDamage()
    } else if (!abilities.soulweaver) {
        // Duel: targeting is ignored and nobody takes damage this map.
        // The loser is decided in applyDamage via getDuelLoser().
        setStandardDamage()
    }

    // Damage scales up as the match goes on
    const damageMultiplier = getDamageMultiplier()
    Object.values(playerData).forEach(player => { player.currentScoreAgainst *= damageMultiplier })
}

// Standard damage, based on who is targeting whom.
// averageScore = average effective score of the alive players targeting this player.
function setStandardDamage() {
    Object.entries(playerData).forEach(([playerKey, player]) => {
        const playerNumber = Number(playerKey.replace("player", ""))

        const teamKeys = playerNumber <= 3
            ? ["player1", "player2", "player3"]
            : ["player4", "player5", "player6"]

        const alivePlayers = teamKeys.filter(key => playerData[key].currentMaxHp > 0)
        const isLastAlive = alivePlayers.length === 1 && player.currentMaxHp > 0

        // Alive players targeting this player
        const attackers = Object.values(playerData).filter(
            other => other.currentTarget === playerNumber && other.currentMaxHp > 0
        )
        if (!attackers.length) return

        const averageScore = attackers.reduce((sum, attacker) => sum + attacker.effectiveScore, 0) / attackers.length
        const ownScore = player.effectiveScore

        // Last alive on their team: attackers' average score, minus their own
        if (isLastAlive) {
            player.currentScoreAgainst += Math.max(0, averageScore - ownScore)
            return
        }

        if (averageScore > ownScore) {
            // Attackers out-score the target: target takes the difference
            player.currentScoreAgainst += Math.max(0, averageScore - ownScore)
        } else if (ownScore > averageScore && attackers.length >= 2) {
            // Target out-scores the attackers: only hits one of its own attackers (head-on)
            const targetPlayer = playerData[`player${player.currentTarget}`]
            if (attackers.includes(targetPlayer)) {
                targetPlayer.currentScoreAgainst += ownScore - averageScore
            }
        }
    })
}

function setDemigodDamage() {
    const { player: demigodNumber, mode, target } = abilities.demigod
    const opponentNumbers = sideOf(demigodNumber) === "red" ? [4, 5, 6] : [1, 2, 3]

    const demigodScore = playerData[`player${demigodNumber}`].effectiveScore
    const opponentTotal = opponentNumbers.reduce(
        (sum, n) => sum + playerData[`player${n}`].effectiveScore, 0
    )

    if (demigodScore > opponentTotal) {
        // Demigod wins: opponents take the difference
        const difference = demigodScore - opponentTotal

        if (mode === "target") {
            playerData[`player${target}`].currentScoreAgainst = difference
        } else {
            const alive = opponentNumbers.filter(n => playerData[`player${n}`].currentMaxHp > 0)
            alive.forEach(n => {
                playerData[`player${n}`].currentScoreAgainst = difference / alive.length
            })
        }
    } else if (opponentTotal > demigodScore) {
        // Opponents win: the Demigod takes the difference
        playerData[`player${demigodNumber}`].currentScoreAgainst = opponentTotal - demigodScore
    }
}

{
    selectNextPickerButtonRedEl.addEventListener("click", () => setNextPicker("Red"))
    selectNextPickerButtonBlueEl.addEventListener("click", () => setNextPicker("Blue"))
    selectNextPickerButtonNoneEl.addEventListener("click", () => setNextPicker("None"))
    selectCurrentPickerButtonRedEl.addEventListener("click", () => setCurrentPicker("Red"))
    selectCurrentPickerButtonBlueEl.addEventListener("click", () => setCurrentPicker("Blue"))
    selectCurrentPickerButtonNoneEl.addEventListener("click", () => setCurrentPicker("None"))
    teamHpButtonEl.addEventListener("click", () => setHpButton())
    mapTargetButtonEl.addEventListener("click", () => setTargetButton())
    // Class abilities apply as soon as a control changes (no Submit button)
    classPanelsEl.addEventListener("change", event => applyClasses(event.target.closest(".class-player")))
    classPanelsEl.addEventListener("input", event => {
        if (event.target.type === "number") applyClasses(null)
    })
}

// OBS stuff
const obs = typeof OBSWebSocket === "undefined" ? null : new OBSWebSocket()
const OBS_ADDRESS = 'ws://127.0.0.1:4455'
const sceneButtonsEl = document.getElementById('scene-buttons')

const OBS_RECONNECT_MS = 3000
let obsConnected = false
let obsReconnectTimer = null

function scheduleObsReconnect() {
    if (!obs || obsReconnectTimer) return
    obsReconnectTimer = setTimeout(() => {
        obsReconnectTimer = null
        connectObs()
    }, OBS_RECONNECT_MS)
}

async function connectObs() {
    try {
        await obs.connect(OBS_ADDRESS)
        obsConnected = true
        console.log("Connected to OBS")
        refreshScenes()
    } catch (error) {
        obsConnected = false
        console.warn(`OBS connection failed, retrying in ${OBS_RECONNECT_MS / 1000}s`)
        scheduleObsReconnect()
    }
}

// Fetch scenes and populate buttons
async function refreshScenes() {
    try {
        // Request the full scene list from OBS
        const response = await obs.call('GetSceneList')
        const scenes = response.scenes
        const currentProgramScene = response.currentProgramSceneName

        // Clear any existing buttons
        sceneButtonsEl.innerHTML = ''

        // Generate a button for each scene (reversing order if you want it to match OBS layout top-to-bottom)
        scenes.reverse().forEach(scene => {
            const button = document.createElement('button')
            button.className = 'team-hp-button'
            button.innerText = scene.sceneName

            // Highlight the currently active scene
            if (scene.sceneName === currentProgramScene) {
                button.classList.add('active-hp-button')
            }

            // Click event to switch scene
            button.addEventListener("click", () => changeScene(scene.sceneName))
            sceneButtonsEl.appendChild(button)
        })
    } catch (error) {
        console.error('Failed to grab scene list:', error)
    }
}

// Send command to switch scene
async function changeScene(sceneName) {
    if (!obs || !obsConnected) return
    try {
        await obs.call('SetCurrentProgramScene', { sceneName: sceneName })
    } catch (error) {
        console.error('Failed to change scene:', error)
    }
}

// Listen for live events so the dock updates if things change inside OBS
function setupListeners() {
    // Reconnect if connection is closed
    obs.on('ConnectionClosed', () => {
        if (obsConnected) console.warn("OBS connection lost")
        obsConnected = false
        scheduleObsReconnect()
    })

    // Update active button color when scene changes
    obs.on('CurrentProgramSceneChanged', (data) => {
        document.querySelectorAll('#scene-buttons .team-hp-button').forEach(btn => {
            btn.classList.toggle('active-hp-button', btn.innerText === data.sceneName)
        })
    })

    // Rebuild the buttons entirely if a scene is added, removed, or collection changes
    obs.on('SceneListChanged', refreshScenes)
}

// Start the OBS connection (connectObs retries on failure, setupListeners handles drops and live updates)
if (obs) {
    setupListeners()
    connectObs()
} else {
    console.warn("obs-websocket-js didn't load, OBS scene control is disabled")
}