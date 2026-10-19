import { constants } from "../_shared/js/constants.js"
import { loadBeatmaps } from "../_shared/core/beatmaps.js"
import { findTeam, loadTeams } from "../_shared/core/teams.js"
import { createTosuWsSocket } from "../_shared/core/websocket.js"
import { isPresent, isSlotFilled } from "../_shared/core/match.js"

// Saved match state: read it before anything gets a chance to overwrite it
let savedState = null
try {
    savedState = JSON.parse(localStorage.getItem(constants.STORAGE_KEY))
} catch {
    savedState = null
}
let stateReady = false // saving is paused until the restore has run

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
    roundNameEl.textContent = roundName
    allBeatmaps = beatmaps.beatmaps

    // Set Max HP
    const normalisedRoundName = roundName.toLowerCase().trim()
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

    saveState(true)
}

const mapsPlayedInputEl = document.getElementById("maps-played-input")
const damageMultiplierEl = document.getElementById("damage-multiplier")
let mapsPlayed = 0

// +1.0x per map played (constants.DAMAGE_MULTIPLIER_STEP)
function getDamageMultiplier() {
    return 1 + constants.DAMAGE_MULTIPLIER_STEP
        * Math.floor(mapsPlayed / constants.MAPS_PER_MULTIPLIER_STEP)
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
    witch: null, // { player }, cleared after every map. Display only: it has no effect on damage
}

// Which class image each team's overlay shows (the latest activation on that side wins).
// Cleared after every map. Human sets it when the heal button is used.
const classDisplay = { red: null, blue: null }

// Who "owns" each per-map ability (the player that activated it)
const abilityOwner = {
    demigod: ability => ability.player,
    soulweaver: ability => ability.challenger,
    witch: ability => ability.player,
}

// Compare the abilities before / after a change: anything newly activated takes over its team's image,
// anything switched off gives the image up (falling back to another ability still active on that team).
function syncClassDisplay(before) {
    for (const name of Object.keys(abilityOwner)) {
        const was = before[name]
        const now = abilities[name]

        if (now && (!was || abilityOwner[name](now) !== abilityOwner[name](was))) {
            classDisplay[sideOf(abilityOwner[name](now))] = name
        } else if (!now && was) {
            const side = sideOf(abilityOwner[name](was))
            if (classDisplay[side] !== name) continue
            classDisplay[side] = Object.keys(abilityOwner).find(other =>
                abilities[other] && sideOf(abilityOwner[other](abilities[other])) === side
            ) ?? null
        }
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

    // Only restore the same round, so a new round never starts with last round's HP
    if (!saved || saved.roundName !== roundName) return

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
    errorEl.textContent = messages.join(" ")
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
        witch: null,
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

            // Witch: only shows her image on the overlay, nothing else to validate
            if (className === "witch" && checked(`witch-${n}-active`)) {
                if (!isAlive(n)) {
                    errors[side].push(`${playerLabel(n)} is dead and can't activate.`)
                }
                next.witch = { player: n }
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
    abilities.witch = null
    classDisplay.red = null
    classDisplay.blue = null
    document.querySelectorAll(".per-map-ability").forEach(checkboxEl => { checkboxEl.checked = false })
    showClassError("red", [])
    showClassError("blue", [])
}

// Human: the button heals every living teammate (the Human included) by HUMAN_HEAL_AMOUNT.
// No cooldown: press it as often as needed.
function healTeam(humanNumber) {
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

// Change Teams
function changeTeams(teamName, side) {
    // Find team
    const currentTeam = findTeam(teamName)
    if (!currentTeam) return

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

        // 2v2 / 2v3: an empty slot is out of the match entirely. HP / damage are never scaled, the team just has fewer players.
        const filled = isSlotFilled(currentPlayer)
        const wasPresent = currentPlayers[i].present
        currentPlayers[i].present = filled
        if (!filled) {
            Object.assign(currentPlayers[i], {
                currentMaxHp: 0, currentDeadRounds: 0, hasRevived: true,
                currentScore: 0, effectiveScore: 0, currentScoreAgainst: 0,
            })
        } else if (wasPresent === false) {
            // Slot filled again (a 3-player team after a 2-player one): fresh player
            Object.assign(currentPlayers[i], { currentMaxHp: maxHp, currentDeadRounds: 0, hasRevived: false })
        }
        teamHpIOnputNumberElements[(side === "red" ? 0 : 3) + i].value = currentPlayers[i].currentMaxHp
        teamHpPlayerElements[i].parentElement.style.display = filled ? "" : "none"
        teamMapTargetSelectionPlayerElements[i].parentElement.style.display = filled ? "" : "none"

        // Fill each select's options with the matching team player
        // Value = player number (1-6), since that's what currentTarget uses
        const playerNumberOffset = side === "red" ? 0 : 3
        const options = teamMapTargetSelectionPlayerSelectElements[i].children
        for (let j = 0; j < options.length; j++) {
            const optionPlayer = currentTeam[`player${j + 1}`]
            if (!optionPlayer) continue
            options[j].textContent = optionPlayer.playerName
            options[j].value = playerNumberOffset + j + 1
            // Nobody can target an empty slot
            const optionFilled = isSlotFilled(optionPlayer)
            options[j].disabled = !optionFilled
            options[j].hidden = !optionFilled
        }
    }

    retargetAbsentPlayers()
    refreshClassSelects()
    updateClassPanel(side)
    syncTargetSelects()
}

// Anyone aiming at an empty slot is pointed at the first opponent who is actually playing
function retargetAbsentPlayers() {
    for (const n of constants.PLAYER_NUMBERS) {
        const player = playerData[`player${n}`]
        const target = playerData[`player${player.currentTarget}`]
        if (isPresent(target)) continue

        const replacement = playersOf(otherSide(sideOf(n)))
            .find(m => isPresent(playerData[`player${m}`]))
        if (replacement) player.currentTarget = replacement
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
        if (isMapRunning(currentIpcState)) {
            checkedWinner = false
            updatePlayerData(playerData, socketData)

            if (autoObsButtonEl.checked) {
                changeScene(constants.OBS_SCENES.GAMEPLAY)
            }
        }

        // Reset information
        if (currentIpcState === IPC.IDLE && previousIpcState === IPC.RANKING && !checkedWinner) {
            checkedWinner = true

            if (toggleHpEl.checked) {
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
            // Maps are identified by their label (B1, B2...) in the pool data
            mappoolMapLabel = currentBeatmap.label ?? `${String(currentBeatmap.mod ?? "").toUpperCase()}${currentBeatmap.order ?? ""}`
            currentModIdEl.textContent = mappoolMapLabel
        } else {
            // Not a pool map: previously the old flag stayed true and main/ crashed on the missing beatmap
            mappoolMapFound = false
            mappoolMapLabel = undefined
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
            // Knocked out: sits out 2 rounds, then revives once at 10% of round max HP.
            // A player who has already revived stays down for good.
            player.currentDeadRounds = player.hasRevived ? 0 : constants.DEAD_ROUNDS
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

// Write everything the overlays read to localStorage.
// Runs on a timer, right after every tosu message, and right after every change made in the dashboard,
// so the overlays don't have to wait for the next timer tick. `force` skips the throttle.
let lastSaveAt = 0
function saveState(force = false) {
    teamRedNameEl.textContent = redTeamName ?? ""
    teamBlueNameEl.textContent = blueTeamName ?? ""

    if (!stateReady) return

    const now = performance.now()
    if (!force && now - lastSaveAt < constants.SAVE_THROTTLE_MS) return
    lastSaveAt = now

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
    }

    try {
        localStorage.setItem(constants.STORAGE_KEY, JSON.stringify(savedInfo))
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
    // Raw scores
    Object.values(playerData).forEach(player => {
        const client = data.tourney?.clients?.find(
            client => client.user.id === player.id
        )

        // An empty slot has id 0, which could match an unused tosu client, so it never reads a score
        player.currentScore = isPresent(player) ? (client?.play.score ?? 0) : 0
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
    toggleHpEl.addEventListener("change", () => refreshDamage())
    mapTargetButtonEl.addEventListener("click", () => setTargetButton())
    // Class abilities apply as soon as a control changes (no Submit button)
    classPanelsEl.addEventListener("change", event => applyClasses(event.target.closest(".class-player")))
    classPanelsEl.addEventListener("input", event => {
        if (event.target.type === "number") applyClasses(null)
    })
    // Human: "Rolled a pool number" heals the team
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