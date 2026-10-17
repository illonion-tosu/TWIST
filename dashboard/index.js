import { loadBeatmaps } from "../_shared/core/beatmaps.js"
import { getRoundMaxHp, otherSide, playersOf, sideOf } from "../_shared/core/match.js"
import { findTeam, loadTeams } from "../_shared/core/teams.js"
import { capitalise } from "../_shared/core/utils.js"
import { createTosuWsSocket } from "../_shared/core/websocket.js"
import { constants } from "../_shared/js/constants.js"

const { IPC_STATE, OBS_SCENES, PLAYER_NUMBERS, SIDES } = constants

// Saved match state: read it before anything gets a chance to overwrite it
let savedState = null
try {
    savedState = JSON.parse(localStorage.getItem(constants.STORAGE_KEY))
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
let maxHp = constants.DEFAULT_MAX_HP

// player1 - player6. Each starts targeting the opposite player (see DEFAULT_TARGETS).
const playerData = Object.fromEntries(PLAYER_NUMBERS.map((n, i) => [`player${n}`, {
    id: constants.DEFAULT_PLAYER_ID,
    playerName: "",
    class: "",
    currentMaxHp: constants.DEFAULT_MAX_HP,
    currentScore: 0,
    currentTarget: constants.DEFAULT_TARGETS[i],
    currentScoreAgainst: 0,
    currentDeadRounds: 0,
}]))

// Mappool Select Container
const mappoolSelectContainerEl = document.getElementById("mappool-select-container")

loadBeatmaps().then(beatmaps => {
    // Set Round Name
    roundName = beatmaps.roundName
    roundNameEl.textContent = roundName
    allBeatmaps = beatmaps.beatmaps

    // Set Max HP
    const roundMaxHp = getRoundMaxHp(roundName)
    if (roundMaxHp === null) {
        maxHp = constants.DEFAULT_MAX_HP
        console.warn(`Unknown round name "${roundName}", using ${constants.DEFAULT_MAX_HP} max HP. Set it with the Map Starting HP box.`)
    } else {
        maxHp = roundMaxHp
    }

    // Set all input values to max hp
    teamHpInputEls.forEach(input => { input.value = maxHp })

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

// Damage multiplier grows every few maps (maps 1-2 = 1x, 3-4 = 1.5x, 5-6 = 2x, ...)
const mapsPlayedInputEl = document.getElementById("maps-played-input")
const damageMultiplierEl = document.getElementById("damage-multiplier")
let mapsPlayed = 0

function getDamageMultiplier() {
    return 1 + constants.DAMAGE_MULTIPLIER_STEP * Math.floor(mapsPlayed / constants.MAPS_PER_MULTIPLIER_STEP)
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
    human: Object.fromEntries(PLAYER_NUMBERS.map(n => [n, defaultHuman()])),
    demigod: null, // { player, mode, target }, cleared after every map
    soulweaver: null, // { challenger, challenged }, cleared after every map
}

const classPanelsEl = document.getElementById("class-panels")

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
        teamHpInputEls[i].value = playerData[key].currentMaxHp
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
        for (const n of PLAYER_NUMBERS) {
            const s = savedHuman[n]
            if (s) abilities.human[n] = { lucky: Boolean(s.lucky), poolSize: Math.max(0, Number(s.poolSize) || 0) }
        }

        for (const side of SIDES) {
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

classPanelsEl.replaceChildren(...SIDES.map(buildClassPanel))

// Fill every player select (value = player number 1-6, text = player name)
function refreshClassSelects() {
    document.querySelectorAll(".class-player-select").forEach(select => {
        const side = select.dataset.side
        const teamSide = select.dataset.scope === "own" ? side : otherSide(side)
        const offset = playersOf(teamSide)[0] - 1
        const previous = select.value

        select.innerHTML = ""
        for (let i = 1; i <= playersOf(teamSide).length; i++) {
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
const CLASSES_WITH_CONTROLS = constants.CLASSES_WITH_CONTROLS

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
        `${capitalise(side)}: ${classText}`

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

    for (const side of SIDES) {
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

// Lucky! bonus: starts high for 1 number, drops for every extra number, never below the minimum
function getLuckyBonus(poolSize) {
    const { LUCKY_BASE_BONUS_PERCENT, LUCKY_PENALTY_PERCENT, LUCKY_MIN_BONUS_PERCENT } = constants
    const extraNumbers = Math.max(1, poolSize) - 1
    return Math.max(LUCKY_MIN_BONUS_PERCENT, LUCKY_BASE_BONUS_PERCENT - LUCKY_PENALTY_PERCENT * extraNumbers) / 100
}

const countAlive = side => playersOf(side).filter(isAlive).length

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
        multiplier *= constants.SOULWEAVER_CHALLENGED_MULTIPLIER
    }

    // Demigod: multiplier depends on opponents alive
    if (abilities.demigod?.player === playerNumber) {
        multiplier *= constants.DEMIGOD_MULTIPLIERS[countAlive(otherSide(side))] ?? 1
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

    // This side's players, and the target selects (of the other side's players) that list this team
    const ownNumbers = playersOf(side)
    const opponentNumbers = playersOf(otherSide(side))
    const byId = id => document.getElementById(id)

    ownNumbers.forEach((playerNumber, i) => {
        const player = playerData[`player${playerNumber}`]
        const teamPlayer = currentTeam[`player${i + 1}`]

        player.id = teamPlayer.id
        player.playerName = teamPlayer.playerName

        // Class is stored on each player: currentTeam.playerX.class
        player.class = String(teamPlayer.class ?? "").toLowerCase()

        byId(`team-hp-player-${playerNumber}`).textContent = teamPlayer.playerName
        byId(`map-target-selection-player-${playerNumber}`).textContent = teamPlayer.playerName

        // Each opposing player's select lists this team's players
        // Value = player number (1-6), since that's what currentTarget uses
        const select = byId(`map-target-selection-player-${opponentNumbers[i]}-select`)
        for (let j = 0; j < select.children.length; j++) {
            const optionPlayer = currentTeam[`player${j + 1}`]
            if (!optionPlayer) continue
            select.children[j].textContent = optionPlayer.playerName
            select.children[j].value = ownNumbers[j]
        }
    })

    refreshClassSelects()
    updateClassPanel(side)
    syncTargetSelects()

    // Restore saved Lucky! state if this is the team it was saved for
    applyPendingHuman(side, teamName)
}

// Team HP Button
const teamHpButtonEl = document.getElementById("team-hp-button")
const teamHpInputEls = PLAYER_NUMBERS.map(n => document.getElementById(`team-hp-input-number-player-${n}`))

function setHpButton() {
    for (let i = 0; i < teamHpInputEls.length; i++) {
        const player = playerData[`player${i + 1}`]
        player.currentMaxHp = Number(teamHpInputEls[i].value)
        if (player.currentMaxHp > 0) {
            player.currentDeadRounds = 0
            player.reviveHp = null
        }
    }
}

// Map Target Button
const mapTargetButtonEl = document.getElementById("map-target-button")
const targetSelectElements = PLAYER_NUMBERS.map(n =>
    document.getElementById(`map-target-selection-player-${n}-select`)
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
const isMapInProgress = ipcState =>
    ipcState === IPC_STATE.WAITING_FOR_CLIENTS || ipcState === IPC_STATE.PLAYING || ipcState === IPC_STATE.RANKING
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
        if (isMapInProgress(currentIpcState)) {
            checkedWinner = false
            updatePlayerData(playerData, socketData)

            if (autoObsButtonEl.checked) {
                changeScene(OBS_SCENES.GAMEPLAY)
            }
        }

        // Reset information
        if (currentIpcState === IPC_STATE.IDLE && previousIpcState === IPC_STATE.RANKING && !checkedWinner) {
            checkedWinner = true

            if (toggleHpEl.checked) {
                applyDamage(playerData)

                if (autoObsButtonEl.checked) {
                    if (SIDES.some(isTeamEliminated)) {
                        changeScene(OBS_SCENES.WINNER)
                    } else {
                        changeScene(OBS_SCENES.MAPPOOL)
                    }
                }
            } else {
                clearScores()
                resetMapAbilities()
            }
        }

        // Handles aborting map
        if (currentIpcState === IPC_STATE.IDLE && (previousIpcState === IPC_STATE.WAITING_FOR_CLIENTS || previousIpcState === IPC_STATE.PLAYING)) {
            clearScores()
        }
    }

    // Keep scores updating live while the map is being played
    if (isMapInProgress(currentIpcState)) {
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
function isTeamEliminated(side) {
    return !playersOf(side).some(isAlive)
}

// Apply damage
function applyDamage(playerData) {
    // Decide the duel from final scores before anything is reset
    const duelLoser = getDuelLoser()

    Object.entries(playerData).forEach(([playerKey, player], i) => {
        const wasAlive = player.currentMaxHp > 0

        player.currentMaxHp = Math.max(0, Math.round(player.currentMaxHp - player.currentScoreAgainst))

        if (wasAlive && playerKey === duelLoser) {
            // Lost the duel: dies, returns at a share of the round max HP
            // (checked first so a duel loser who also hits 0 from damage still gets 50%)
            player.currentMaxHp = 0
            player.currentDeadRounds = constants.DEAD_ROUNDS
            player.reviveHp = Math.round(maxHp * constants.DUEL_LOSER_REVIVE_HP_RATIO)
        } else if (wasAlive && player.currentMaxHp === 0) {
            // Died to damage: returns at a share of the round max HP
            player.currentDeadRounds = constants.DEAD_ROUNDS
            player.reviveHp = null
        } else if (player.currentDeadRounds > 0) {
            player.currentDeadRounds--

            if (player.currentDeadRounds === 0) {
                // Duel losers return at the duel HP share, everyone else at the normal one
                player.currentMaxHp = player.reviveHp ?? Math.round(maxHp * constants.REVIVE_HP_RATIO)
                player.reviveHp = null
            }
        }

        // Damage is committed, so clear it
        player.currentScore = 0
        player.effectiveScore = 0
        player.currentScoreAgainst = 0

        teamHpInputEls[i].value = player.currentMaxHp
    })

    resetMapAbilities()

    // Only runs with HP toggled on: a map counts, and each Human's Lucky! count grows by one.
    // Once a player's Lucky! is on, their count is locked and no longer grows.
    // (Done after the damage above, so this map was still scored with the old counts.)
    mapsPlayed++
    refreshDamageMultiplierUi()

    for (const n of PLAYER_NUMBERS) {
        if (classOf(n) !== "human") continue
        const human = abilities.human[n]
        if (human.lucky) continue
        human.poolSize = Math.max(1, human.poolSize) + 1
        document.getElementById(`human-${n}-pool`).value = human.poolSize - 1
    }
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

    localStorage.setItem(constants.STORAGE_KEY, JSON.stringify(savedInfo))
}, constants.SAVE_INTERVAL_MS)


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

// Standard damage, based purely on who is targeting whom:
// averageScore = average effective score of the alive players targeting this player.
function setStandardDamage() {
    Object.entries(playerData).forEach(([playerKey, player]) => {
        const playerNumber = Number(playerKey.replace("player", ""))

        // Alive players targeting this player
        const attackers = Object.values(playerData).filter(
            other => other.currentTarget === playerNumber && other.currentMaxHp > 0
        )
        if (!attackers.length) return

        const averageScore = attackers.reduce((sum, attacker) => sum + attacker.effectiveScore, 0) / attackers.length

        player.currentScoreAgainst += Math.max(0, averageScore - player.effectiveScore)
    })
}

function setDemigodDamage() {
    const { player: demigodNumber, mode, target } = abilities.demigod
    const opponentNumbers = playersOf(otherSide(sideOf(demigodNumber)))

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
const sceneButtonsEl = document.getElementById('scene-buttons')

let obsConnected = false
let obsReconnectTimer = null

function scheduleObsReconnect() {
    if (!obs || obsReconnectTimer) return
    obsReconnectTimer = setTimeout(() => {
        obsReconnectTimer = null
        connectObs()
    }, constants.OBS_RECONNECT_MS)
}

async function connectObs() {
    try {
        await obs.connect(constants.OBS_ADDRESS)
        obsConnected = true
        console.log("Connected to OBS")
        refreshScenes()
    } catch {
        obsConnected = false
        console.warn(`OBS connection failed, retrying in ${constants.OBS_RECONNECT_MS / 1000}s`)
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