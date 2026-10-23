import { constants } from "../js/constants.js"
import { sideOf } from "./match.js"

// Match API: a read-only GET. Nothing is ever sent back.
// This file only fetches and validates. It never touches the page or the dashboard's state, so it can be tested on its own.
// The response is shaped like what the dashboard saves (see sample-match-response.json); normaliseApiMatch() keeps only
// the fields the API is allowed to own and drops everything else (live scores, damage, tosu data...).

const CLASS_ABILITIES = ["demigod", "soulweaver", "witch", "human"]
const STATUSES = ["not_started", "in_progress", "completed"]
const PICKERS = ["red", "blue", "none"]
const PICK_BAN_KEYS = ["redBan", "blueBan", "redPick", "bluePick"] // same order the overlay checks them in

export const isApiConfigured = () => Boolean(constants.API_MATCH_URL)

export const matchUrl = id => constants.API_MATCH_URL.replace("{id}", encodeURIComponent(id))

export async function fetchMatch(id) {
    const response = await axios.get(matchUrl(id), {
        timeout: constants.API_TIMEOUT_MS,
        headers: constants.API_HEADERS,
    })
    return response.data
}

const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value)

// Whole numbers only (numeric strings are accepted too). Anything else is undefined.
function toInt(value) {
    if (typeof value === "number") return Number.isInteger(value) ? value : undefined
    if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value)
    return undefined
}

const toPlayerNumber = value => {
    const n = toInt(value)
    return n >= 1 && n <= 6 ? n : undefined
}

// An ability is on when it exists and has no endedTime yet
const isActive = ability => isObject(ability) && (ability.endedTime === null || ability.endedTime === undefined)
const timeOf = ability => (typeof ability?.appliedTime === "string" ? ability.appliedTime : null)

function readPlayers(raw, warn) {
    if (raw === undefined) return undefined
    if (!isObject(raw)) {
        warn("playerData ignored: it should be an object (player1 ... player6).")
        return undefined
    }

    const players = {}
    for (const n of constants.PLAYER_NUMBERS) {
        const key = `player${n}`
        if (raw[key] === undefined) continue
        if (!isObject(raw[key])) {
            warn(`${key} ignored: it should be an object.`)
            continue
        }

        const source = raw[key]
        const player = {}

        const id = toInt(source.id)
        if (id !== undefined && id >= 0) player.id = id
        if (typeof source.playerName === "string") player.playerName = source.playerName
        if (typeof source.class === "string") player.class = source.class.trim().toLowerCase()
        if (typeof source.present === "boolean") player.present = source.present
        if (typeof source.hasRevived === "boolean") player.hasRevived = source.hasRevived

        // currentMaxHp is the player's current HP (the dashboard's old name for it)
        if (typeof source.currentMaxHp === "number" && Number.isFinite(source.currentMaxHp) && source.currentMaxHp >= 0) {
            player.currentMaxHp = Math.round(source.currentMaxHp)
        } else if (source.currentMaxHp !== undefined) {
            warn(`${key}.currentMaxHp ignored: it should be a number of 0 or more.`)
        }

        const deadRounds = toInt(source.currentDeadRounds)
        if (deadRounds !== undefined && deadRounds >= 0) player.currentDeadRounds = deadRounds
        else if (source.currentDeadRounds !== undefined) warn(`${key}.currentDeadRounds ignored.`)

        const target = toPlayerNumber(source.currentTarget)
        if (target !== undefined) player.currentTarget = target
        else if (source.currentTarget !== undefined) warn(`${key}.currentTarget ignored: it should be a player number from 1 to 6.`)

        players[key] = player
    }
    return players
}

function readPickBan(raw, warn) {
    if (raw === undefined) return undefined
    if (!isObject(raw) || !PICK_BAN_KEYS.every(key => Array.isArray(raw[key]))) {
        warn("pickBanInfo ignored: it needs all four lists (redBan, blueBan, redPick, bluePick).")
        return undefined
    }

    const seen = new Map()
    const lists = {}
    for (const key of PICK_BAN_KEYS) {
        lists[key] = []
        for (const value of raw[key]) {
            const id = String(value ?? "").trim() // the dashboard identifies maps by their beatmap id as a string
            if (!id) continue
            if (seen.has(id)) {
                warn(`Map ${id} is in both ${seen.get(id)} and ${key}: using ${seen.get(id)}.`)
                continue
            }
            seen.set(id, key)
            lists[key].push(id)
        }
    }
    return lists
}

function readPicker(value, name, warn) {
    if (value === undefined) return undefined
    const picker = String(value).toLowerCase()
    if (PICKERS.includes(picker)) return picker
    warn(`${name} ignored: it should be red, blue or none.`)
    return undefined
}

// Abilities: Demigod / Soulweaver are one-per-match singletons (and never together), Witch / Human are per team.
function readAbilities(raw, warn) {
    if (raw === undefined) return undefined
    if (!isObject(raw)) {
        warn("abilities ignored: it should be an object.")
        return undefined
    }

    const abilities = { demigod: null, soulweaver: null, witch: { red: null, blue: null }, human: { red: null, blue: null } }
    const shown = [] // active abilities, used to work out which class image each team shows if classImages isn't sent

    if (isActive(raw.demigod)) {
        const player = toPlayerNumber(raw.demigod.player)
        if (player === undefined) {
            warn("abilities.demigod ignored: player should be 1 to 6.")
        } else {
            let mode = raw.demigod.mode === "target" ? "target" : "split"
            let target = toPlayerNumber(raw.demigod.target)
            if (raw.demigod.mode !== undefined && raw.demigod.mode !== "target" && raw.demigod.mode !== "split") {
                warn(`abilities.demigod.mode "${raw.demigod.mode}" is not split or target: using split.`)
            }
            if (mode === "target" && (target === undefined || sideOf(target) === sideOf(player))) {
                warn("abilities.demigod targets nobody on the other team: using split instead.")
                mode = "split"
                target = undefined
            }
            abilities.demigod = { player, mode, target: mode === "target" ? target : null, appliedTime: timeOf(raw.demigod) }
            shown.push({ name: "demigod", side: sideOf(player), time: timeOf(raw.demigod) })
        }
    }

    if (isActive(raw.soulweaver)) {
        const challenger = toPlayerNumber(raw.soulweaver.challenger)
        const challenged = toPlayerNumber(raw.soulweaver.challenged)
        if (challenger === undefined || challenged === undefined) {
            warn("abilities.soulweaver ignored: challenger and challenged should be 1 to 6.")
        } else if (abilities.demigod) {
            warn("abilities.soulweaver ignored: Demigod and Soulweaver can't be active together.")
        } else {
            abilities.soulweaver = { challenger, challenged, appliedTime: timeOf(raw.soulweaver) }
            shown.push({ name: "soulweaver", side: sideOf(challenger), time: timeOf(raw.soulweaver) })
        }
    }

    for (const name of ["witch", "human"]) {
        if (raw[name] === undefined || raw[name] === null) continue
        if (!isObject(raw[name])) {
            warn(`abilities.${name} ignored: it should be { red, blue }.`)
            continue
        }
        for (const side of constants.SIDES) {
            const ability = raw[name][side]
            if (!isActive(ability)) continue
            const player = toPlayerNumber(ability.player)
            if (player === undefined || sideOf(player) !== side) {
                warn(`abilities.${name}.${side} ignored: player should be on the ${side} team.`)
                continue
            }
            abilities[name][side] = { player, appliedTime: timeOf(ability) }
            shown.push({ name, side, time: timeOf(ability) })
        }
    }

    return { abilities, shown }
}

// Which class image each team shows: the latest activation on that side wins (same rule as the dashboard)
function deriveClassImages(shown) {
    const images = { red: null, blue: null }
    const stamp = entry => (entry.time ? Date.parse(entry.time) || 0 : 0)
    shown.forEach((entry, order) => {
        const current = images[entry.side]
        if (!current || stamp(entry) >= stamp(current) ) images[entry.side] = { ...entry, order }
    })
    return { red: images.red?.name ?? null, blue: images.blue?.name ?? null }
}

function readClassImages(raw, warn) {
    if (raw === undefined) return undefined
    if (!isObject(raw)) {
        warn("classImages ignored: it should be { red, blue }.")
        return undefined
    }
    const images = {}
    for (const side of constants.SIDES) {
        const value = raw[side]
        if (value === null || value === undefined) images[side] = null
        else if (CLASS_ABILITIES.includes(String(value).toLowerCase())) images[side] = String(value).toLowerCase()
        else {
            warn(`classImages.${side} ignored: "${value}" is not a class.`)
            return undefined
        }
    }
    return images
}

function readCommit(raw, warn) {
    if (raw === undefined || raw === null) return undefined
    const gameNumber = toInt(raw.gameNumber)
    const beatmapId = String(raw.beatmapId ?? "").trim()
    if (!isObject(raw) || gameNumber === undefined || gameNumber < 0 || !beatmapId) {
        warn("lastCommitted ignored: it needs a gameNumber and a beatmapId.")
        return undefined
    }
    return { gameNumber, beatmapId }
}

/**
 * Validate a raw API response and keep only what the API owns.
 * Returns { ok: true, match, warnings } or { ok: false, errors, warnings }.
 * A field that is missing (undefined) means "no change": the dashboard keeps what it has.
 * A field that is present but invalid is dropped with a warning; the rest of the response is still used.
 * Only a response that is unusable as a whole (not an object, no matchId) is rejected.
 */
export function normaliseApiMatch(raw) {
    const warnings = []
    const warn = message => warnings.push(message)

    if (!isObject(raw)) return { ok: false, errors: ["The response isn't a JSON object."], warnings }

    const matchId = toInt(raw.matchId)
    if (matchId === undefined || matchId < 0) {
        return { ok: false, errors: ["The response has no valid matchId."], warnings }
    }

    const match = { matchId }

    const version = toInt(raw.version)
    match.version = version !== undefined && version >= 0 ? version : null
    if (match.version === null) warn("No version in the response: out-of-order protection is off.")

    if (STATUSES.includes(raw.status)) match.status = raw.status
    else if (raw.status !== undefined) warn(`status "${raw.status}" ignored.`)

    if (typeof raw.roundName === "string" && raw.roundName.trim()) match.roundName = raw.roundName.trim()
    else if (raw.roundName !== undefined) warn("roundName ignored: it should be a non-empty string.")

    if (typeof raw.maxHp === "number" && Number.isFinite(raw.maxHp) && raw.maxHp > 0) match.maxHp = Math.round(raw.maxHp)
    else if (raw.maxHp !== undefined && raw.maxHp !== null) warn("maxHp ignored: it should be a number above 0.")

    if (isObject(raw.teamName)) {
        match.teamName = {}
        for (const key of ["redTeamName", "blueTeamName"]) {
            if (typeof raw.teamName[key] === "string") match.teamName[key] = raw.teamName[key]
            else if (raw.teamName[key] !== undefined) warn(`teamName.${key} ignored: it should be a string.`)
        }
    } else if (raw.teamName !== undefined) warn("teamName ignored: it should be { redTeamName, blueTeamName }.")

    match.playerData = readPlayers(raw.playerData, warn)
    match.pickBanInfo = readPickBan(raw.pickBanInfo, warn)

    if (isObject(raw.mappoolInfo)) match.currentPicker = readPicker(raw.mappoolInfo.currentPicker, "mappoolInfo.currentPicker", warn)
    match.nextPicker = readPicker(raw.nextPicker, "nextPicker", warn)

    const mapsPlayed = toInt(raw.mapsPlayed)
    if (mapsPlayed !== undefined && mapsPlayed >= 0) match.mapsPlayed = mapsPlayed
    else if (raw.mapsPlayed !== undefined) warn("mapsPlayed ignored: it should be a whole number of 0 or more.")

    if (typeof raw.damageMultiplier === "number" && Number.isFinite(raw.damageMultiplier) && raw.damageMultiplier > 0) {
        match.damageMultiplier = raw.damageMultiplier
    } else if (raw.damageMultiplier !== undefined) warn("damageMultiplier ignored: it should be a number above 0.")

    const abilityResult = readAbilities(raw.abilities, warn)
    if (abilityResult) match.abilities = abilityResult.abilities

    const classImages = readClassImages(raw.classImages, warn)
    if (classImages) match.classImages = classImages
    else if (abilityResult) match.classImages = deriveClassImages(abilityResult.shown)

    match.lastCommitted = readCommit(raw.lastCommitted, warn)

    if (raw.winner === "red" || raw.winner === "blue" || raw.winner === null) match.winner = raw.winner
    else if (raw.winner !== undefined) warn("winner ignored: it should be red, blue or null.")

    return { ok: true, match, warnings }
}
