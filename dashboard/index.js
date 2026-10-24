import { constants } from "../_shared/js/constants.js"
import { loadBeatmaps } from "../_shared/core/beatmaps.js"
import { findTeam, loadTeams } from "../_shared/core/teams.js"
import { createTosuWsSocket } from "../_shared/core/websocket.js"
import { getRoundMaxHp, isPresent, isSlotFilled } from "../_shared/core/match.js"
import { fetchMatch, isApiConfigured, normaliseApiMatch } from "../_shared/core/api.js"

// Saved match state: read it before anything gets a chance to overwrite it
let savedState = null
try {
    savedState = JSON.parse(localStorage.getItem(constants.STORAGE_KEY))
} catch {
    savedState = null
}
let stateReady = false // saving is paused until the restore has run

// Match API (see the "Match API" section at the bottom of this file)
const apiToggleEl = document.getElementById("auto-api-button")
const matchIdInputEl = document.getElementById("match-id-input")
const matchIdButtonEl = document.getElementById("match-id-button")
const apiStatusEl = document.getElementById("api-status")
const apiWarningsEl = document.getElementById("api-warnings")
let apiActive = false // toggle on AND a match ID set AND an endpoint configured
let matchId = null // the number typed into the dashboard
let appliedMatchId = null // the match the current state came from (null = a local match)
let apiMultiplier = null // damage multiplier from the API (null = work it out from maps played)
let apiMatchStatus = null
let apiWinner = null
let lastAppliedCommit = null // "gameNumber:beatmapId" of the last commit applied
let previewBeatmapId = null // the map tosu is currently playing / last played (string id)
let previewLocked = false // true once the API has committed the previewed map: the damage preview stays empty until the next map
let awaitingCommitScene = false // a map ended and we're waiting for the API to commit it before changing scene
let mapDiscarded = false // Reset Match was pressed during a map: that map's damage is thrown away when it ends

// Round Name
const roundNameEl = document.getElementById("round-name")
let roundName
let defaultRoundName // the round as loaded at startup, which Reset Match goes back to

// Beatmaps
let allBeatmaps = []

// Select next picker
const autoPickButtonEl = document.getElementById("auto-pick-button")
const nextPickerEl = document.getElementById("next-picker")
const selectNextPickerButtonRedEl = document.getElementById("select-next-picker-button-red")
const selectNextPickerButtonBlueEl = document.getElementById("select-next-picker-button-blue")
const selectNextPickerButtonNoneEl = document.getElementById("select-next-picker-button-none")
let nextPicker = constants.DEFAULT_NEXT_PICKER

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
let currentPicker = constants.DEFAULT_CURRENT_PICKER

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

// hasRevived: a player only gets one revive; the second knockout is permanent.
const newPlayer = (target) => ({
    id: constants.DEFAULT_PLAYER_ID,
    playerName: "",
    class: "",
    currentMaxHp: constants.DEFAULT_MAX_HP,
    currentScore: 0,
    currentTarget: target,
    currentScoreAgainst: 0,
    currentDeadRounds: 0,
    hasRevived: false,
    // false = empty slot on a 2-player team: not in the match at all (no HP, no damage, no target)
    present: true,
})

let playerData = Object.fromEntries(
    constants.PLAYER_NUMBERS.map((n, i) => [`player${n}`, newPlayer(constants.DEFAULT_TARGETS[i])])
)

// Mappool Select Container
const mappoolSelectContainerEl = document.getElementById("mappool-select-container")

loadBeatmaps().then(beatmaps => {
    // Set Round Name
    roundName = beatmaps.roundName
    defaultRoundName = roundName
    roundNameEl.textContent = roundName
    allBeatmaps = beatmaps.beatmaps

    // Set Max HP
    const normalisedRoundName = String(roundName ?? "").toLowerCase().trim()
    const roundConfig = constants.ROUND_MAX_HP.find(round =>
        round.names.includes(normalisedRoundName)
    )
    maxHp = roundConfig?.maxHp ?? constants.DEFAULT_MAX_HP
    if (!roundConfig) {
        console.warn(
            `Unknown round name "${roundName}", using ${maxHp} max HP.`
        )
    }

    // Set all input values to max hp
    // Empty slots (2-player teams) stay at 0
    Object.keys(playerData).forEach((key, i) => {
        playerData[key].currentMaxHp = isPresent(playerData[key]) ? maxHp : 0
        teamHpIOnputNumberElements[i].value = playerData[key].currentMaxHp
    })

    mappoolSelectContainerEl.innerHTML = ""
    allBeatmaps.map(beatmap => {
        const button = document.createElement("button")
        button.classList.add("mappool-select-button")
        button.textContent = `${beatmap.label}`
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
    syncApiMode()
}).catch(error => {
    console.error("Could not load beatmaps:", error)
    stateReady = true
})

// Map Click Event
let redBan = []
let redPick = []
let blueBan = []
let bluePick = []
// Put one map in a state. action: "pick" | "ban" | "clear". team: "red" | "blue".
// Shared by the mouse handler below and the API. `save` is false when the caller saves once at the end.
function setMapState(id, team, action, { save = true, setPicker = true } = {}) {
    id = String(id)
    const button = document.getElementById(id)

    // Filter it out of everything first
    redBan = redBan.filter(other => other !== id)
    redPick = redPick.filter(other => other !== id)
    blueBan = blueBan.filter(other => other !== id)
    bluePick = bluePick.filter(other => other !== id)

    // Remove all related classes to it
    if (button) {
        button.classList.remove("mappool-select-button-red-ban")
        button.classList.remove("mappool-select-button-blue-ban")
        button.classList.remove("mappool-select-button-red-pick")
        button.classList.remove("mappool-select-button-blue-pick")
    }

    // Add elements + classes
    if (action !== "clear" && (team === "red" || team === "blue")) {
        const list = { redban: redBan, redpick: redPick, blueban: blueBan, bluepick: bluePick }[`${team}${action}`]
        if (list) {
            list.push(id)
            button?.classList.add(`mappool-select-button-${team}-${action}`)
            if (action === "pick" && setPicker) setCurrentPicker(team)
        }
    }

    if (save) saveState(true)
}

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

    setMapState(this.getAttribute("id"), team, action)
}

const mapsPlayedInputEl = document.getElementById("maps-played-input")
const damageMultiplierEl = document.getElementById("damage-multiplier")
let mapsPlayed = 0

// +1.0x per map played (constants.DAMAGE_MULTIPLIER_STEP)
function localDamageMultiplier() {
    return 1 + constants.DAMAGE_MULTIPLIER_STEP
        * Math.floor(mapsPlayed / constants.MAPS_PER_MULTIPLIER_STEP)
}

// The API's number wins while it's on; otherwise it comes from maps played
function getDamageMultiplier() {
    return apiActive && apiMultiplier != null ? apiMultiplier : localDamageMultiplier()
}

function refreshDamageMultiplierUi() {
    mapsPlayedInputEl.value = mapsPlayed
    damageMultiplierEl.textContent = `${getDamageMultiplier()}x`
}
refreshDamageMultiplierUi()

// Class abilities
// Class of a player (lowercase). Stored in playerData, filled from currentTeam.playerX.class
const classOf = playerNumber => playerData[`player${playerNumber}`]?.class ?? ""

const abilities = {
    demigod: null, // { player, mode, target }, cleared after every map
    soulweaver: null, // { challenger, challenged }, cleared after every map
    witch: { red: null, blue: null }, // { player } per team (both teams can have one), cleared after every map. Display only: no effect on damage
}

// Which class image each team's overlay shows (the latest activation on that side wins).
// Cleared after every map. Human sets it when the heal button is used.
const classDisplay = { red: null, blue: null }

// Per-map abilities that are switched on, as { name, player } (Witch is per team, so it can appear twice)
const activeAbilities = state => [
    state.demigod && { name: "demigod", player: state.demigod.player },
    state.soulweaver && { name: "soulweaver", player: state.soulweaver.challenger },
    state.witch?.red && { name: "witch", player: state.witch.red.player },
    state.witch?.blue && { name: "witch", player: state.witch.blue.player },
].filter(Boolean)

// Compare the abilities before / after a change: anything newly activated takes over its team's image,
// anything switched off gives the image up (falling back to another ability still active on that team).
function syncClassDisplay(before) {
    const was = activeAbilities(before)
    const now = activeAbilities(abilities)
    const same = (a, b) => a.name === b.name && a.player === b.player

    for (const ability of now) {
        if (!was.some(other => same(other, ability))) classDisplay[sideOf(ability.player)] = ability.name
    }

    for (const ability of was) {
        if (now.some(other => same(other, ability))) continue
        const side = sideOf(ability.player)
        // Replaced by the same ability on another player of this team: the new one already took the image
        if (now.some(other => other.name === ability.name && sideOf(other.player) === side)) continue
        if (classDisplay[side] !== ability.name) continue
        classDisplay[side] = now.filter(other => sideOf(other.player) === side).at(-1)?.name ?? null
    }
}

const classPanelsEl = document.getElementById("class-panels")

const sideOf = playerNumber => constants.TEAM_PLAYER_NUMBERS.red.includes(playerNumber) ? "red" : "blue"
const playersOf = side => constants.TEAM_PLAYER_NUMBERS[side]
const otherSide = side => side === "red" ? "blue" : "red"

const isAlive = playerNumber => playerData[`player${playerNumber}`]?.currentMaxHp > 0
const playerLabel = playerNumber =>
    playerData[`player${playerNumber}`]?.playerName || `Player ${playerNumber}`

function restoreSavedState() {
    const saved = savedState
    savedState = null
    if (!saved) return

    // The match ID and the API toggle survive a reload whatever the round is
    const api = saved.api ?? {}
    if (api.matchId != null) {
        matchId = api.matchId
        matchIdInputEl.value = api.matchId
    }
    apiToggleEl.checked = Boolean(api.enabled)

    // A match that came from the API is identified by its match ID. A local match keeps the old rule:
    // only restore the same round, so a new round never starts with last round's HP.
    const fromApi = api.appliedMatchId != null
    if (!fromApi && saved.roundName !== roundName) return

    if (fromApi) {
        appliedMatchId = api.appliedMatchId
        lastAppliedCommit = api.lastCommit ?? null
        previewBeatmapId = api.previewBeatmapId ?? null
        previewLocked = Boolean(api.previewLocked)
        apiMatchStatus = api.status ?? null
        apiWinner = api.winner ?? null
        roundName = saved.roundName
        roundNameEl.textContent = roundName ?? ""
        if (Number(saved.maxHp) > 0) maxHp = Number(saved.maxHp)
        redTeamName = saved.teamName?.redTeamName
        blueTeamName = saved.teamName?.blueTeamName
    }

    // Players: HP, dead rounds, revive status, targets (scores start fresh)
    Object.keys(playerData).forEach((key, i) => {
        const savedPlayer = saved.playerData?.[key]
        if (!savedPlayer) return
        Object.assign(playerData[key], savedPlayer)
        playerData[key].hasRevived = Boolean(playerData[key].hasRevived)
        playerData[key].currentScore = 0
        playerData[key].effectiveScore = 0
        playerData[key].currentScoreAgainst = 0
        teamHpIOnputNumberElements[i].value = playerData[key].currentMaxHp
    })

    // Names, classes and empty slots back onto the panels
    for (const side of constants.SIDES) {
        applyRoster(side, playersOf(side).map(n => {
            const player = playerData[`player${n}`]
            return { id: player.id, playerName: player.playerName, class: player.class, present: isPresent(player) }
        }), { keepHp: true })
    }
    syncTargetSelects()

    // Maps played + multiplier display
    mapsPlayed = Math.max(0, Math.floor(Number(saved.mapsPlayed)) || 0)
    if (fromApi && Number(saved.damageMultiplier) > 0) apiMultiplier = Number(saved.damageMultiplier)
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

    // Abilities (a reload used to forget them)
    if (saved.abilities) {
        abilities.demigod = saved.abilities.demigod ?? null
        abilities.soulweaver = saved.abilities.soulweaver ?? null
        abilities.witch = { red: saved.abilities.witch?.red ?? null, blue: saved.abilities.witch?.blue ?? null }
        classDisplay.red = saved.classImages?.red ?? null
        classDisplay.blue = saved.classImages?.blue ?? null
        syncAbilityControls()
    }
}

// Lets you correct the count by hand (e.g. a map was replayed)
mapsPlayedInputEl.addEventListener("input", () => {
    mapsPlayed = Math.max(0, Math.floor(Number(mapsPlayedInputEl.value)) || 0)
    damageMultiplierEl.textContent = `${getDamageMultiplier()}x`
    refreshDamage()
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
                el("button", {
                    type: "button",
                    className: "team-hp-button human-heal-button",
                    textContent: `Heal team (+${constants.HUMAN_HEAL_AMOUNT / 1000}K)`,
                    dataset: { player: String(n) },
                })
            ),

            controls(n, "demigod",
                checkbox(`demigod-${n}-active`, "Go solo this map", true),
                row("Mode:", modeSelect(`demigod-${n}-mode`)),
                row("Target:", select(`demigod-${n}-target`, "opp"))
            ),

            controls(n, "soulweaver",
                checkbox(`soulweaver-${n}-active`, "Duel this map", true),
                row("Challenged:", select(`soulweaver-${n}-challenged`, "opp"))
            ),

            controls(n, "witch",
                checkbox(`witch-${n}-active`, "Activate this map", true)
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

        // Validation errors show up here
        el("div", {
            className: "class-error",
            id: `class-error-${side}`,
            hidden: true,
            style: "color: #ff6b6b; font-size: 14px; margin-top: 6px;",
        })
    )
}

classPanelsEl.replaceChildren(...constants.SIDES.map(buildClassPanel))

// Fill every player select (value = player number 1-6, text = player name)
function refreshClassSelects() {
    document.querySelectorAll(".class-player-select").forEach(select => {
        const side = select.dataset.side
        const teamSide = select.dataset.scope === "own" ? side : otherSide(side)
        const offset = teamSide === "red" ? 0 : 3
        const previous = select.value

        select.innerHTML = ""
        for (let i = 1; i <= 3; i++) {
            if (!isPresent(playerData[`player${offset + i}`])) continue
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
    errorEl.textContent = [...new Set(messages)].join(" ")
    errorEl.hidden = messages.length === 0
}

// Show only the controls for each player's own class
function updateClassPanel(side) {
    const names = []

    for (const n of playersOf(side)) {
        const className = classOf(n)
        if (className) names.push(capitalise(className))

        document.getElementById(`class-player-${n}`).hidden = !constants.CLASSES_WITH_CONTROLS.includes(className)
        document.getElementById(`class-player-title-${n}`).textContent =
            `${playerLabel(n)}: ${capitalise(className)}`

        for (const type of constants.CLASSES_WITH_CONTROLS) {
            document.getElementById(`class-controls-${n}-${type}`).hidden = className !== type
        }
    }

    const classText = [...new Set(names)].join(" / ")
    document.getElementById(`${side}-class`).textContent = classText
    document.getElementById(`class-title-${side}`).textContent =
        `${side === "red" ? "Red" : "Blue"}: ${classText}`

    // Classes without controls (e.g. Witch) have nothing to submit
    document.getElementById(`class-wrapper-${side}`).hidden =
        !playersOf(side).some(n => constants.CLASSES_WITH_CONTROLS.includes(classOf(n)))

    showClassError(side, [])
}

// Read the controls and validate them. Returns { errors, next } and changes nothing.
function evaluateClasses() {
    const errors = { red: [], blue: [] }
    const next = {
        demigod: null,
        soulweaver: null,
        witch: { red: null, blue: null }, // each team can have its own Witch
    }
    let demigodSide = null
    let soulweaverSide = null

    const value = id => document.getElementById(id).value
    const checked = id => document.getElementById(id).checked

    for (const side of constants.SIDES) {
        const opp = playersOf(otherSide(side))

        for (const n of playersOf(side)) {
            const className = classOf(n)

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

            // Witch: only shows her image on the overlay. Each team can have its own.
            if (className === "witch" && checked(`witch-${n}-active`)) {
                if (!isAlive(n)) {
                    errors[side].push(`${playerLabel(n)} is dead and can't activate.`)
                }
                if (next.witch[side]) {
                    errors[side].push("Only 1 ability per team per map.")
                }
                next.witch[side] = { player: n }
            }
        }
    }

    if (next.demigod && next.soulweaver) {
        next.soulweaver = null
        for (const n of constants.PLAYER_NUMBERS) {
            const box = document.getElementById(`soulweaver-${n}-active`)
            if (box) box.checked = false
        }
    }

    for (const side of constants.SIDES) {
        const used = [next.demigod, next.soulweaver, next.witch[side]]
            .filter(ability => ability && sideOf(ability.player ?? ability.challenger) === side)
        if (used.length > 1) errors[side].push("Only 1 ability per team per map.")
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
        const before = { ...abilities }
        abilities.demigod = result.next.demigod
        abilities.soulweaver = result.next.soulweaver
        abilities.witch = result.next.witch
        syncClassDisplay(before)
    }

    showClassError("red", rejected ? shownErrors.red : [])
    showClassError("blue", rejected ? shownErrors.blue : [])

    refreshDamage()
}

// Demigod / Soulweaver only last one map.
function resetMapAbilities() {
    abilities.demigod = null
    abilities.soulweaver = null
    abilities.witch = { red: null, blue: null }
    classDisplay.red = null
    classDisplay.blue = null
    document.querySelectorAll(".per-map-ability").forEach(checkboxEl => { checkboxEl.checked = false })
    showClassError("red", [])
    showClassError("blue", [])
}

// Human: the heal button heals every living teammate (the Human included) by HUMAN_HEAL_AMOUNT.
function healTeam(humanNumber) {
    if (apiActive) return // the API owns HP while it's on
    const side = sideOf(humanNumber)

    if (classOf(humanNumber) !== "human") return
    if (!isAlive(humanNumber)) {
        showClassError(side, [`${playerLabel(humanNumber)} is dead and can't heal the team.`])
        return
    }

    for (const n of playersOf(side)) {
        const player = playerData[`player${n}`]
        // Healing doesn't bring dead players back, and nobody goes above the round's max HP
        if (player.currentMaxHp <= 0) continue
        player.currentMaxHp = Math.min(maxHp, player.currentMaxHp + constants.HUMAN_HEAL_AMOUNT)
        teamHpIOnputNumberElements[n - 1].value = player.currentMaxHp
    }

    showClassError(side, [])

    // Human's image stays until the map ends or another class on this team takes over
    classDisplay[side] = "human"
    refreshDamage()
}

function countAlive(side) {
    return playersOf(side).filter(n => playerData[`player${n}`].currentMaxHp > 0).length
}

function getScoreMultiplier(playerNumber) {
    const side = sideOf(playerNumber)
    let multiplier = 1

    // Soulweaver: challenger gets 1.1x, the challenged player gets 0.9x
    if (abilities.soulweaver?.challenger === playerNumber) {
        multiplier *= constants.SOULWEAVER_CHALLENGER_MULTIPLIER
    }
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

// Change Teams: find the team in teams.json, then show its roster
function changeTeams(teamName, side) {
    const currentTeam = findTeam(teamName)
    if (!currentTeam) return

    applyRoster(side, [1, 2, 3].map(i => {
        const player = currentTeam[`player${i}`] ?? { id: 0, playerName: "", class: "" }
        return {
            id: player.id,
            playerName: player.playerName,
            class: player.class,
            present: isSlotFilled(player),
        }
    }))
}

// Put a side's three players (id, name, class, present) into playerData and onto every panel.
// Used by teams.json (changeTeams), the saved-state restore and the API.
// keepHp: true leaves HP alone for a slot that just became present (the API / restore already set it).
// Nobody is re-aimed: a target is whatever it was set to, even an empty slot.
function applyRoster(side, roster, { keepHp = false } = {}) {
    const offset = side === "red" ? 0 : 3
    const opposingOffset = side === "red" ? 3 : 0

    for (let i = 0; i < 3; i++) {
        const number = offset + i + 1
        const player = playerData[`player${number}`]
        const entry = roster[i] ?? { id: 0, playerName: "", class: "", present: false }
        const name = entry.playerName ?? ""
        const filled = entry.present !== false

        player.id = entry.id ?? 0
        player.playerName = name
        // Class is stored on each player
        player.class = String(entry.class ?? "").toLowerCase()

        document.getElementById(`team-hp-player-${number}`).textContent = name
        document.getElementById(`map-target-selection-player-${number}`).textContent = name

        // 2v2 / 2v3: an empty slot is out of the match entirely. HP / damage are never scaled, the team just has fewer players.
        const wasPresent = player.present
        player.present = filled
        if (!filled) {
            Object.assign(player, {
                currentMaxHp: 0, currentDeadRounds: 0, hasRevived: true,
                currentScore: 0, effectiveScore: 0, currentScoreAgainst: 0,
            })
        } else if (wasPresent === false && !keepHp) {
            // Slot filled again (a 3-player team after a 2-player one): fresh player
            Object.assign(player, { currentMaxHp: maxHp, currentDeadRounds: 0, hasRevived: false })
        }
        teamHpIOnputNumberElements[number - 1].value = player.currentMaxHp
        document.getElementById(`team-hp-player-${number}`).parentElement.style.display = filled ? "" : "none"
        document.getElementById(`map-target-selection-player-${number}`).parentElement.style.display = filled ? "" : "none"

        // The opposing team's target selects list this player (value = player number 1-6, since that's what currentTarget uses)
        for (let k = 1; k <= 3; k++) {
            const option = document.getElementById(`map-target-selection-player-${opposingOffset + k}-select`)?.children[i]
            if (!option) continue
            option.textContent = name
            option.value = number
            // Nobody can be picked in the dropdown while they're an empty slot
            option.disabled = !filled
            option.hidden = !filled
        }
    }

    refreshClassSelects()
    updateClassPanel(side)
    syncTargetSelects()
}

// Write the current abilities into the class controls without firing their change events
function syncAbilityControls() {
    document.querySelectorAll(".per-map-ability").forEach(box => { box.checked = false })
    const tick = id => { const box = document.getElementById(id); if (box) box.checked = true }
    const choose = (id, value) => {
        const select = document.getElementById(id)
        if (select && value !== null && value !== undefined) select.value = String(value)
    }

    if (abilities.demigod) {
        const { player, mode, target } = abilities.demigod
        tick(`demigod-${player}-active`)
        choose(`demigod-${player}-mode`, mode)
        choose(`demigod-${player}-target`, target)
    }
    if (abilities.soulweaver) {
        const { challenger, challenged } = abilities.soulweaver
        tick(`soulweaver-${challenger}-active`)
        choose(`soulweaver-${challenger}-challenged`, challenged)
    }
    for (const side of constants.SIDES) {
        if (abilities.witch[side]) tick(`witch-${abilities.witch[side].player}-active`)
        showClassError(side, [])
    }
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
    if (apiActive) return // the API owns HP while it's on
    for (let i = 0; i < teamHpIOnputNumberElements.length; i++) {
        const player = playerData[`player${i + 1}`]
        // Empty slots can't be given HP
        if (!isPresent(player)) {
            player.currentMaxHp = 0
            teamHpIOnputNumberElements[i].value = 0
            continue
        }
        player.currentMaxHp = Number(teamHpIOnputNumberElements[i].value)
        if (player.currentMaxHp > 0) {
            player.currentDeadRounds = 0
        }
    }
    refreshDamage()
}

// Map Target Button
const mapTargetButtonEl = document.getElementById("map-target-button")
const targetSelectElements = constants.PLAYER_NUMBERS.map(i =>
    document.getElementById(`map-target-selection-player-${i}-select`)
)

function setTargetButton() {
    if (apiActive) return // the API owns targets while it's on
    targetSelectElements.forEach((selectEl, i) => {
        const value = Number(selectEl.value)
        // Ignore placeholder options that haven't been filled with a player yet
        if (Number.isNaN(value)) return
        if (!isPresent(playerData[`player${value}`])) return
        playerData[`player${i + 1}`].currentTarget = value
    })
    refreshDamage()
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
const IPC = constants.IPC_STATE
const isMapRunning = state =>
    state === IPC.WAITING_FOR_CLIENTS || state === IPC.PLAYING || state === IPC.RANKING
let previousIpcState, currentIpcState
let checkedWinner = false

// Mappool Map Found
let currentId, currentChecksum
let mappoolMapFound = false
let mappoolMapLabel
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
    if (teamsLoaded && teamNames && !apiActive) {
        if (redTeamName !== teamNames.left) {
            redTeamName = teamNames.left
            changeTeams(redTeamName, "red")
        }

        if (blueTeamName !== teamNames.right) {
            blueTeamName = teamNames.right
            changeTeams(blueTeamName, "blue")
        }
    }

    // Beatmap first, so everything saved below already knows about the new map
    if (socketData.beatmap && (currentId !== socketData.beatmap.id || currentChecksum !== socketData.beatmap.checksum)) {
        currentId = socketData.beatmap.id
        currentChecksum = socketData.beatmap.checksum
        previewBeatmapId = String(socketData.beatmap.id)

        currentBeatmap = allBeatmaps.find(beatmap => Number(beatmap.beatmap_id) === Number(socketData.beatmap.id))
        currentMapEl.textContent = `${socketData.beatmap.artist} - ${socketData.beatmap.title}`

        // Autopicking
        // (it used to check currentPicker here, so "None" as next picker still auto picked for blue)
        const targetElement = document.getElementById(`${currentId}`)
        if (currentBeatmap && targetElement && autoPickButtonEl.checked && nextPicker !== "none" && !apiActive) {
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
            // Maps are identified by their label (B1, B2...) in the pool data
            mappoolMapLabel = currentBeatmap.label
            currentModIdEl.textContent = mappoolMapLabel
        } else {
            // Not a pool map: previously the old flag stayed true and main/ crashed on the missing beatmap
            mappoolMapFound = false
            mappoolMapLabel = undefined
            currentModIdEl.textContent = ""
        }
    }

    // Set score against information
    const incomingIpcState = socketData.tourney?.ipcState
    if (incomingIpcState !== undefined && currentIpcState !== incomingIpcState) {
        previousIpcState = currentIpcState
        currentIpcState = incomingIpcState

        // Calculate scores
        if (isMapRunning(currentIpcState)) {
            // A new map starting (not the next phase of the same one) brings the damage preview back after an API commit
            const starting = state => state === IPC.WAITING_FOR_CLIENTS || state === IPC.PLAYING
            if (starting(currentIpcState) && !starting(previousIpcState)) {
                previewLocked = false
                mapDiscarded = false
            }
            checkedWinner = false
            updatePlayerData(playerData, socketData)

            if (autoObsButtonEl.checked) {
                changeScene(constants.OBS_SCENES.GAMEPLAY)
            }
        }

        // Reset information
        if (currentIpcState === IPC.IDLE && previousIpcState === IPC.RANKING && !checkedWinner) {
            checkedWinner = true

            if (mapDiscarded) {
                // Reset Match was pressed while this map was running: its damage belongs to the match that no longer exists
                mapDiscarded = false
                clearScores()
                resetMapAbilities()
            } else if (apiActive) {
                // The API owns HP: nothing is applied here. The preview stays up until the API commits this map.
                if (previewLocked) finishMapScene()
                else awaitingCommitScene = true
            } else if (toggleHpEl.checked) {
                applyDamage(playerData)

                if (autoObsButtonEl.checked) {
                    if (constants.SIDES.some(side => isTeamEliminated(playersOf(side)))) {
                        changeScene(constants.OBS_SCENES.WINNER)
                    } else {
                        changeScene(constants.OBS_SCENES.MAPPOOL)
                    }
                }
            } else {
                clearScores()
                resetMapAbilities()
            }
        }

        // Handles aborting map
        if (currentIpcState === IPC.IDLE && (previousIpcState === IPC.WAITING_FOR_CLIENTS || previousIpcState === IPC.PLAYING)) {
            clearScores()
        }

        // A state change (map start / end, damage applied) always goes out immediately
        saveState(true)
    }

    // Keep scores updating live while the map is being played
    if (isMapRunning(currentIpcState)) {
        updatePlayerData(playerData, socketData)
    }

    // Straight to the overlays (throttled)
    saveState()

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
function isTeamEliminated(playerNumbers) {
    return playerNumbers
        .filter(n => isPresent(playerData[`player${n}`]))
        .every(n => playerData[`player${n}`].currentMaxHp <= 0)
}

// Apply damage
function applyDamage(playerData) {
    // Decide the duel from final scores before anything is reset
    const duelLoser = getDuelLoser()

    Object.entries(playerData).forEach(([playerKey, player], i) => {
        // Empty slot: never takes damage, never revives
        if (!isPresent(player)) {
            player.currentMaxHp = 0
            player.currentDeadRounds = 0
            player.currentScore = 0
            player.effectiveScore = 0
            player.currentScoreAgainst = 0
            teamHpIOnputNumberElements[i].value = 0
            return
        }

        const wasAlive = player.currentMaxHp > 0
        const hpBefore = player.currentMaxHp

        player.currentMaxHp = Math.max(0, Math.round(hpBefore - player.currentScoreAgainst))

        if (wasAlive && playerKey === duelLoser) {
            // Lost the duel: loses 75% of the HP they entered the duel with. No sitting out.
            player.currentMaxHp = Math.max(
                0,
                Math.round(hpBefore * (1 - constants.SOULWEAVER_LOSER_HP_LOSS_RATIO))
            )
        } else if (wasAlive && player.currentMaxHp === 0) {
            player.currentDeadRounds = (player.class === "human" && !player.hasRevived) ? constants.DEAD_ROUNDS : 0
        } else if (player.currentDeadRounds > 0) {
            player.currentDeadRounds--

            if (player.currentDeadRounds === 0) {
                player.currentMaxHp = Math.round(maxHp * constants.REVIVE_HP_RATIO)
                player.hasRevived = true
            }
        }

        // Damage is committed, so clear it
        player.currentScore = 0
        player.effectiveScore = 0
        player.currentScoreAgainst = 0

        teamHpIOnputNumberElements[i].value = player.currentMaxHp
    })

    resetMapAbilities()

    // Only runs with HP toggled on: this map now counts towards the damage multiplier
    mapsPlayed++
    refreshDamageMultiplierUi()
}

// Slim down the tosu data
function slimTosuData(data) {
    if (!data) return data
    const { scoreVisible, chat, ipcState, team } = data.tourney ?? {}
    return {
        beatmap: data.beatmap,
        directPath: data.directPath,
        tourney: { scoreVisible, chat, ipcState, team },
    }
}

// Write everything the overlays read to localStorage.
// Runs on a timer, right after every tosu message, and right after every change made in the dashboard,
// so the overlays don't have to wait for the next timer tick. `force` skips the throttle.
let lastSaveAt = 0
let lastSavedJson = null
function saveState(force = false) {
    teamRedNameEl.textContent = redTeamName ?? ""
    teamBlueNameEl.textContent = blueTeamName ?? ""

    if (!stateReady) return

    const now = performance.now()
    if (!force && now - lastSaveAt < constants.SAVE_THROTTLE_MS) return
    lastSaveAt = now

    // Save information
    const savedInfo = {
        tosuData: slimTosuData(socketData),
        maxHp: maxHp,
        playerData: playerData,
        roundName: roundName,
        teamName: {
            redTeamName: redTeamName,
            blueTeamName: blueTeamName
        },
        mappoolInfo: {
            mappoolMapFound: mappoolMapFound,
            mappoolMapLabel: mappoolMapLabel,
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
        // Class image shown per team on the main overlay (null = none)
        classImages: { red: classDisplay.red, blue: classDisplay.blue },
        // Per-map abilities (so a reload doesn't forget them)
        abilities: abilities,
        // Match API state: what a reload needs to carry on, and what the overlays can read
        api: {
            enabled: apiToggleEl.checked,
            matchId: matchId,
            appliedMatchId: appliedMatchId,
            lastCommit: lastAppliedCommit,
            previewBeatmapId: previewBeatmapId,
            previewLocked: previewLocked,
            status: apiMatchStatus,
            winner: apiWinner,
        },
    }

    try {
        const serialised = JSON.stringify(savedInfo)
        if (serialised !== lastSavedJson) {
            lastSavedJson = serialised
            localStorage.setItem(constants.STORAGE_KEY, serialised)
        }
    } catch (error) {
        console.error("Could not save dashboard data:", error)
    }
}
setInterval(saveState, constants.SAVE_INTERVAL_MS)

// Work out the damage again right now (instead of waiting for tosu's next message) and push it to the overlays.
// Used whenever something that feeds into damage changes in the dashboard.
function refreshDamage() {
    if (socketData && isMapRunning(currentIpcState)) updatePlayerData(playerData, socketData)
    saveState(true)
}


function updatePlayerData(playerData, data) {
    // The API already committed this map: its HP has the damage in it, so the preview stays empty until the next map
    if (previewLocked) {
        clearScores()
        return
    }

    // Raw scores
    Object.values(playerData).forEach(player => {
        const client = data.tourney?.clients?.find(
            client => client.user.id === player.id
        )

        // An empty slot has id 0, which could match an unused tosu client, so it never reads a score
        player.currentScore = isPresent(player) ? (client?.play?.score ?? 0) : 0
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
    Object.values(playerData).forEach(player => {
        player.currentScoreAgainst *= damageMultiplier
        if (!abilities.demigod) {
            player.currentScoreAgainst = Math.min(player.currentScoreAgainst, constants.MAX_STANDARD_DAMAGE)
        }
    })
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

        const scores = attackers.map(attacker => attacker.effectiveScore).sort((a, b) => b - a)
        const attackScore = scores[0]
            + scores.slice(1).reduce((sum, score) => sum + score * constants.SECONDARY_ATTACKER_RATIO, 0)

        player.currentScoreAgainst += Math.max(0, attackScore - player.effectiveScore)
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
    toggleHpEl.addEventListener("change", () => refreshDamage())
    mapTargetButtonEl.addEventListener("click", () => setTargetButton())
    // Class abilities apply as soon as a control changes (no Submit button)
    classPanelsEl.addEventListener("change", event => {
        if (!apiActive) applyClasses(event.target.closest(".class-player"))
    })
    classPanelsEl.addEventListener("input", event => {
        if (!apiActive && event.target.type === "number") applyClasses(null)
    })
    // Heal button heals the team
    classPanelsEl.addEventListener("click", event => {
        const button = event.target.closest(".human-heal-button")
        if (button) healTeam(Number(button.dataset.player))
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


// ---------------------------------------------------------------------------------------------------------------
// Match API
// While the toggle is on (and a match ID is set) the API is the source of truth for the round, max HP, team names,
// rosters, HP / dead rounds / revives, targets, picks and bans, pickers, maps played, damage multiplier and class abilities.
// tosu still owns live scores, the current map and chat, and the dashboard still previews damage from the live scores.
// Everything the API says goes into the same variables and controls manual mode uses, so turning the toggle off just
// stops polling: the match carries on from the last values and the controls become editable again.

let apiTimer = null
let apiPolling = false
let apiVersion = null
let apiLastOkAt = 0
let apiLastError = ""
let apiNotice = ""
let apiWarnings = []

// Everything the API owns can't be edited by hand while it's on
function setControlsLocked(locked) {
    document.body.classList.toggle("api-locked", locked)
    const controls = [
        teamHpButtonEl, mapTargetButtonEl, mapsPlayedInputEl, autoPickButtonEl,
        selectNextPickerButtonRedEl, selectNextPickerButtonBlueEl, selectNextPickerButtonNoneEl,
        selectCurrentPickerButtonRedEl, selectCurrentPickerButtonBlueEl, selectCurrentPickerButtonNoneEl,
        ...teamHpIOnputNumberElements,
        ...targetSelectElements,
        ...classPanelsEl.querySelectorAll("input, select, button"),
        ...mappoolSelectContainerEl.querySelectorAll("button"),
    ]
    for (const control of controls) control.disabled = locked
}

// A different match: start it from scratch (full HP, nothing picked, no abilities)
function resetMatchState() {
    Object.keys(playerData).forEach((key, i) => {
        const player = playerData[key]
        Object.assign(player, {
            currentMaxHp: isPresent(player) ? maxHp : 0,
            currentDeadRounds: 0,
            hasRevived: !isPresent(player),
            currentScore: 0, effectiveScore: 0, currentScoreAgainst: 0,
        })
        teamHpIOnputNumberElements[i].value = player.currentMaxHp
    })
    mappoolSelectContainerEl.querySelectorAll(".mappool-select-button").forEach(button => {
        setMapState(button.id, null, "clear", { save: false })
    })
    resetMapAbilities()
    mapsPlayed = 0
    apiMultiplier = null
    apiMatchStatus = null
    apiWinner = null
    lastAppliedCommit = null
    previewLocked = false
    awaitingCommitScene = false
    refreshDamageMultiplierUi()
}

// Abilities and the class image each team shows, exactly as the API says (no validation: the API decides)
function applyAbilitiesFromApi(next, images) {
    abilities.demigod = next.demigod
    abilities.soulweaver = next.soulweaver
    abilities.witch = next.witch
    if (images) {
        classDisplay.red = images.red ?? null
        classDisplay.blue = images.blue ?? null
    }
    syncAbilityControls()
}

// After a map the API has committed: change scene (only if the dashboard was waiting for it)
function finishMapScene() {
    awaitingCommitScene = false
    if (!autoObsButtonEl.checked) return
    const over = apiMatchStatus === "completed" || apiWinner != null
        || constants.SIDES.some(side => isTeamEliminated(playersOf(side)))
    changeScene(over ? constants.OBS_SCENES.WINNER : constants.OBS_SCENES.MAPPOOL)
}

// Write one validated snapshot into the dashboard. Fields the API left out (undefined) are left alone.
// Returns warnings. Saves once at the end so the overlays never see a half-applied snapshot.
function applyApiMatch(match) {
    const warnings = []

    // A different match: wipe the previous one first
    if (appliedMatchId != null && appliedMatchId !== match.matchId) resetMatchState()
    appliedMatchId = match.matchId
    if (match.status !== undefined) apiMatchStatus = match.status
    if (match.winner !== undefined) apiWinner = match.winner

    // Round + max HP (max HP comes from the round when the API doesn't send it)
    if (match.roundName !== undefined) {
        roundName = match.roundName
        roundNameEl.textContent = roundName
        if (match.maxHp === undefined) maxHp = getRoundMaxHp(roundName)
    }
    if (match.maxHp !== undefined) maxHp = match.maxHp

    // Team names
    if (match.teamName?.redTeamName !== undefined) redTeamName = match.teamName.redTeamName
    if (match.teamName?.blueTeamName !== undefined) blueTeamName = match.teamName.blueTeamName

    // A committed map: its damage is already in the HP below, so the live preview is cleared (once) and held
    // until the next map starts. A commit for some other map (a late one) only updates HP.
    const commit = match.lastCommitted
    if (commit) {
        const key = `${commit.gameNumber}:${commit.beatmapId}`
        if (key !== lastAppliedCommit) {
            lastAppliedCommit = key
            if (previewBeatmapId != null && commit.beatmapId === previewBeatmapId) {
                clearScores()
                previewLocked = true
                if (awaitingCommitScene) finishMapScene()
            }
        }
    }

    // Players: HP, dead rounds, revives and targets, then the roster on every panel
    for (const [key, incoming] of Object.entries(match.playerData ?? {})) {
        const player = playerData[key]
        if (!player) continue
        for (const field of ["currentMaxHp", "currentDeadRounds", "hasRevived", "currentTarget"]) {
            if (incoming[field] !== undefined) player[field] = incoming[field]
        }
    }
    if (match.playerData) {
        for (const side of constants.SIDES) {
            applyRoster(side, playersOf(side).map(n => {
                const current = playerData[`player${n}`]
                const incoming = match.playerData[`player${n}`] ?? {}
                return {
                    id: incoming.id ?? current.id,
                    playerName: incoming.playerName ?? current.playerName,
                    class: incoming.class ?? current.class,
                    present: incoming.present ?? isPresent(current),
                }
            }), { keepHp: true })
        }
    }

    // Maps played + damage multiplier
    if (match.mapsPlayed !== undefined) mapsPlayed = match.mapsPlayed
    if (match.damageMultiplier !== undefined) apiMultiplier = match.damageMultiplier
    else if (match.mapsPlayed !== undefined) apiMultiplier = null
    refreshDamageMultiplierUi()
    if (apiMultiplier != null && apiMultiplier !== localDamageMultiplier()) {
        warnings.push(`damageMultiplier is ${apiMultiplier}x but ${mapsPlayed} maps played works out to ${localDamageMultiplier()}x locally. The API's value is used while it's on.`)
    }

    // Picks and bans: everything the API lists is picked / banned, everything else is cleared (the same code a click uses)
    if (match.pickBanInfo) {
        const buttons = [...mappoolSelectContainerEl.querySelectorAll(".mappool-select-button")]
        const known = new Set(buttons.map(button => button.id))
        const options = { save: false, setPicker: false }

        buttons.forEach(button => setMapState(button.id, null, "clear", options))
        for (const [key, ids] of Object.entries(match.pickBanInfo)) {
            const team = key.startsWith("red") ? "red" : "blue"
            const action = key.endsWith("Ban") ? "ban" : "pick"
            for (const id of ids) {
                if (!known.has(id)) {
                    warnings.push(`Map ${id} isn't in the loaded mappool, so it was ignored.`)
                    continue
                }
                setMapState(id, team, action, options)
            }
        }
    }

    // Pickers (set directly: the API says who picks, nothing is worked out)
    if (match.currentPicker !== undefined) setCurrentPicker(match.currentPicker)
    if (match.nextPicker !== undefined) setNextPicker(match.nextPicker)

    // Abilities
    if (match.abilities) applyAbilitiesFromApi(match.abilities, match.classImages)
    else if (match.classImages) {
        classDisplay.red = match.classImages.red
        classDisplay.blue = match.classImages.blue
    }

    // Recompute the preview from the live scores and save everything in one go
    refreshDamage()
    return warnings
}

function describeApiError(error) {
    if (error?.response) return `The API answered HTTP ${error.response.status}.`
    if (error?.code === "ECONNABORTED") return "The API timed out."
    if (error?.request) return "Can't reach the API (offline, or blocked by CORS)."
    return error?.message ?? String(error)
}

async function pollApi() {
    clearTimeout(apiTimer)
    if (!apiActive || apiPolling) return

    apiPolling = true
    const requestedId = matchId
    let obsolete = false
    try {
        const raw = await fetchMatch(requestedId)
        if (!apiActive || requestedId !== matchId) {
            obsolete = true
            return
        }

        const result = normaliseApiMatch(raw)
        if (!result.ok) throw new Error(result.errors.join(" "))
        const { match } = result
        if (match.matchId !== requestedId) {
            throw new Error(`Asked for match ${requestedId} but the API sent match ${match.matchId}.`)
        }

        // Responses can arrive out of order: never go backwards, and skip a repeat of what we already have
        const sameMatch = appliedMatchId === match.matchId
        if (sameMatch && match.version !== null && apiVersion !== null && match.version <= apiVersion) {
            if (match.version < apiVersion) {
                apiWarnings = [`Ignored an older response (version ${match.version}, already have ${apiVersion}).`]
            }
        } else {
            apiWarnings = [...result.warnings, ...applyApiMatch(match)]
            apiVersion = match.version
        }
        apiLastOkAt = performance.now()
        apiLastError = ""
    } catch (error) {
        // Keep the last good data: nothing is blanked, the status line just turns red
        apiLastError = describeApiError(error)
        console.warn("Match API request failed:", error)
    } finally {
        apiPolling = false
        if (apiActive) apiTimer = setTimeout(pollApi, obsolete ? 0 : constants.API_POLL_MS)
        refreshApiStatus()
    }
}

// Start / stop the API according to the toggle and the match ID
function syncApiMode() {
    const wasActive = apiActive
    apiActive = apiToggleEl.checked && isApiConfigured() && matchId != null
    setControlsLocked(apiActive)
    clearTimeout(apiTimer)

    if (apiActive) {
        pollApi()
    } else if (wasActive) {
        // The match carries on locally from the last values. If the API already counted the map that is still
        // running, don't let the local rules count it again when it ends.
        if (previewLocked && isMapRunning(currentIpcState)) checkedWinner = true
        apiMultiplier = null
        awaitingCommitScene = false
        refreshDamageMultiplierUi()
    }

    refreshApiStatus()
    saveState(true)
}

// Match ID + Load. Loading a different match than the one on screen asks for a second press first.
let pendingSwitchId = null
let pendingSwitchTimer = null

function clearSwitchConfirm() {
    pendingSwitchId = null
    clearTimeout(pendingSwitchTimer)
    matchIdButtonEl.textContent = "Load"
    apiNotice = ""
}

function loadMatchId() {
    const text = matchIdInputEl.value.trim()
    if (!/^\d+$/.test(text)) {
        apiNotice = "The match ID has to be a whole number."
        refreshApiStatus()
        return
    }
    const id = Number(text)

    if (appliedMatchId != null && appliedMatchId !== id && pendingSwitchId !== id) {
        pendingSwitchId = id
        matchIdButtonEl.textContent = "Press again to switch"
        apiNotice = `Switching to match ${id} clears match ${appliedMatchId}'s HP, picks, bans and abilities. Press again to confirm.`
        refreshApiStatus()
        clearTimeout(pendingSwitchTimer)
        pendingSwitchTimer = setTimeout(() => {
            clearSwitchConfirm()
            refreshApiStatus()
        }, 6000)
        return
    }

    clearSwitchConfirm()
    matchId = id
    apiVersion = null
    apiLastOkAt = 0
    apiLastError = ""
    apiWarnings = []
    syncApiMode()
}

function refreshApiStatus() {
    let state = "off"
    let text = "API off. The dashboard is running on its own rules."

    if (apiToggleEl.checked) {
        if (!isApiConfigured()) {
            state = "error"
            text = "Set API_MATCH_URL in _shared/js/constants.js first."
        } else if (matchId == null) {
            state = "waiting"
            text = "Enter a match ID and press Load."
        } else if (apiLastError) {
            state = "error"
            const age = apiLastOkAt ? ` Showing the last good data from ${Math.round((performance.now() - apiLastOkAt) / 1000)}s ago.` : ""
            text = `${apiLastError}${age} Untick Use API to take over by hand.`
        } else if (!apiLastOkAt) {
            state = "waiting"
            text = `Loading match ${matchId}...`
        } else {
            const age = performance.now() - apiLastOkAt
            if (age > constants.API_STALE_MS) {
                state = "error"
                text = `Stale: no response for ${Math.round(age / 1000)}s. Untick Use API to take over by hand.`
            } else {
                state = "ok"
                const version = apiVersion === null ? "" : `, version ${apiVersion}`
                text = `Live: match ${appliedMatchId}${version}, updated ${Math.round(age / 1000)}s ago.`
            }
        }
    } else if (matchId != null) {
        text = `API off. Match ID ${matchId} is set.`
    }

    apiStatusEl.dataset.state = state
    apiStatusEl.textContent = text

    const lines = [apiNotice, ...apiWarnings].filter(Boolean).slice(0, 6)
    apiWarningsEl.textContent = lines.join("\n")
    apiWarningsEl.hidden = lines.length === 0
}

apiToggleEl.addEventListener("change", syncApiMode)
matchIdButtonEl.addEventListener("click", loadMatchId)
matchIdInputEl.addEventListener("keydown", event => {
    if (event.key === "Enter") loadMatchId()
})
setInterval(refreshApiStatus, 1000)
refreshApiStatus()

const resetMatchButtonEl = document.getElementById("reset-match-button")
let resetConfirmTimer = null

function clearResetConfirm() {
    clearTimeout(resetConfirmTimer)
    resetConfirmTimer = null
    resetMatchButtonEl.textContent = "Reset Match"
}

function resetEverything() {
    // The API goes first, so nothing it says can come back in
    apiToggleEl.checked = false
    matchId = null
    matchIdInputEl.value = ""
    appliedMatchId = null
    apiVersion = null
    apiLastOkAt = 0
    apiLastError = ""
    apiWarnings = []
    clearSwitchConfirm()

    // Round and max HP as loaded at startup
    roundName = defaultRoundName
    roundNameEl.textContent = roundName ?? ""
    maxHp = getRoundMaxHp(roundName)

    // Fresh players with the default targets, then full HP, no picks, no abilities, 0 maps played
    Object.keys(playerData).forEach((key, i) => Object.assign(playerData[key], newPlayer(constants.DEFAULT_TARGETS[i])))
    resetMatchState()

    // Blank rosters on every panel (the next tosu message fills the teams back in)
    redTeamName = undefined
    blueTeamName = undefined
    for (const side of constants.SIDES) {
        applyRoster(side, playersOf(side).map(() => ({ id: constants.DEFAULT_PLAYER_ID, playerName: "", class: "", present: true })), { keepHp: true })
    }

    setNextPicker(constants.DEFAULT_NEXT_PICKER)
    setCurrentPicker(constants.DEFAULT_CURRENT_PICKER)

    // A map that is running right now belongs to the old match: don't apply its damage when it ends
    mapDiscarded = isMapRunning(currentIpcState)
    checkedWinner = false

    syncApiMode() // unlocks the controls, stops polling and saves
}

resetMatchButtonEl.addEventListener("click", () => {
    if (!resetConfirmTimer) {
        resetMatchButtonEl.textContent = "Press again to reset everything"
        resetConfirmTimer = setTimeout(clearResetConfirm, 6000)
        return
    }
    clearResetConfirm()
    resetEverything()
})
