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

/**
 * Tidy up the server typed into the dashboard: "192.168.1.20", "my-pc", "10.0.0.5:9000", "[::1]",
 * or a pasted "http://192.168.1.20:8787/" all work. Adds API_DEFAULT_PORT when no port is given.
 * Returns "host:port", or null if it isn't a usable host.
 */
export function normaliseApiHost(value) {
    let text = String(value ?? "").trim()
    if (!text) text = constants.API_DEFAULT_HOST
    text = text.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/\/.*$/, "") // drop http:// and any path

    const match = text.match(/^(\[[0-9a-f:.]+\]|[a-z0-9]([a-z0-9.-]*[a-z0-9])?)(?::(\d{1,5}))?$/i)
    if (!match) return null
    const port = match[3] === undefined ? constants.API_DEFAULT_PORT : Number(match[3])
    if (!(port >= 1 && port <= 65535)) return null
    return `${match[1].toLowerCase()}:${port}`
}

export const matchUrl = (host, id) => constants.API_MATCH_URL
    .replace("{host}", host)
    .replace("{id}", encodeURIComponent(id))

export async function fetchMatch(host, id) {
    const response = await axios.get(matchUrl(host, id), {
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

// Match IDs are text (e.g. "48213" or "QF-03"). Numbers are accepted too and turned into text,
// so 48213 and "48213" are the same match. Anything empty or unusable is null.
export function toMatchId(value) {
    if (typeof value === "number") return Number.isInteger(value) && value >= 0 ? String(value) : null
    if (typeof value !== "string") return null
    const id = value.trim()
    return id ? id : null
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
    const gameNumber = toInt(raw.gameNumber ?? raw.mapNumber ?? raw.mapIndex)
    const beatmapId = String(raw.beatmapId ?? raw.beatmap_id ?? raw.mapId ?? "").trim()
    if (!isObject(raw) || gameNumber === undefined || gameNumber < 0 || !beatmapId) {
        warn("lastCommitted ignored: it needs a gameNumber and a beatmapId.")
        return undefined
    }
    return { gameNumber, beatmapId }
}

// ---------------------------------------------------------------------------------------------------------------
// Match server format (schemaVersion 2, GET /api/matches/{id}/state).
// The server's JSON is shaped differently from what the dashboard saves, so it is translated here into the
// dashboard's shape first, and then goes through the same validation below. Anything already in the dashboard's
// shape is left as it is, so the bundled sample-match-response.json still works.
// ---------------------------------------------------------------------------------------------------------------

const SIDE_NAMES = { red: "red", blue: "blue" }

// "red" / "blue", or a team id ("perihelion") / short name ("PHC") from redTeam / blueTeam. Anything else is undefined.
function sideFromTeam(value, raw) {
    if (value === null || value === undefined) return undefined
    const text = String(value).trim().toLowerCase()
    if (SIDE_NAMES[text]) return SIDE_NAMES[text]
    for (const side of constants.SIDES) {
        const team = raw[`${side}Team`]
        if (!isObject(team)) continue
        if ([team.id, team.shortName, team.name].some(v => v !== undefined && v !== null && String(v).toLowerCase() === text)) return side
    }
    return undefined
}

// Player number 1-6 from a number, or from a player id string like "bsb-1" / an osu! id
function makePlayerResolver(players) {
    const byKey = new Map()
    players.forEach((player, index) => {
        const n = toPlayerNumber(player?.player) ?? index + 1
        for (const key of [player?.id, player?.osuId]) {
            if (key !== undefined && key !== null) byKey.set(String(key), n)
        }
    })
    return value => {
        if (value === null || value === undefined) return undefined
        if (byKey.has(String(value))) return byKey.get(String(value))
        return toPlayerNumber(value)
    }
}

function adaptPlayers(list, resolvePlayer) {
    const players = {}
    list.forEach((source, index) => {
        if (!isObject(source)) return
        const n = toPlayerNumber(source.player) ?? index + 1
        const player = {}

        // The dashboard / overlays use the osu! id (chibis, avatars, tosu client lookup), not the server's "phc-1" id
        const osuId = toInt(source.osuId) ?? toInt(source.id)
        if (osuId !== undefined) player.id = osuId
        const name = source.playerName ?? source.name
        if (typeof name === "string") player.playerName = name
        if (typeof source.class === "string") player.class = source.class
        if (typeof source.hasRevived === "boolean") player.hasRevived = source.hasRevived
        if (typeof source.present === "boolean") player.present = source.present

        const hp = typeof source.hp === "number" ? source.hp : source.currentMaxHp
        if (hp !== undefined && hp !== null) player.currentMaxHp = hp

        const deadRounds = source.deadMapsRemaining ?? source.currentDeadRounds
        if (deadRounds !== undefined && deadRounds !== null) player.currentDeadRounds = deadRounds

        // null = no target set: leave the dashboard's target alone
        const target = resolvePlayer(source.currentTarget) ?? resolvePlayer(source.targetPlayerId)
        if (target !== undefined) player.currentTarget = target

        players[`player${n}`] = player
    })
    return players
}

// { picked: [...], banned: [...] } -> { redBan, blueBan, redPick, bluePick }
// Each entry needs a team and a map: { team | side | teamId | by | pickedBy | bannedBy, beatmapId | beatmap_id | mapId | id }
function adaptPickBan(raw, warn) {
    const info = isObject(raw.pickBanInfo) ? raw.pickBanInfo : {}
    const picked = Array.isArray(info.picked) ? info.picked : Array.isArray(raw.pickedMaps) ? raw.pickedMaps : undefined
    const banned = Array.isArray(info.banned) ? info.banned : Array.isArray(raw.bannedMaps) ? raw.bannedMaps : undefined
    if (picked === undefined && banned === undefined) return undefined

    const lists = { redBan: [], blueBan: [], redPick: [], bluePick: [] }
    const add = (entries, action) => {
        for (const entry of entries ?? []) {
            const teamValue = isObject(entry)
                ? entry.team ?? entry.side ?? entry.teamId ?? entry.by ?? entry[`${action === "Pick" ? "picked" : "banned"}By`]
                : undefined
            const mapValue = isObject(entry) ? entry.beatmapId ?? entry.beatmap_id ?? entry.mapId ?? entry.id : entry
            const side = sideFromTeam(teamValue, raw)
            const id = String(mapValue ?? "").trim()
            if (!id) {
                warn(`A ${action.toLowerCase()} entry has no beatmap id and was ignored.`)
            } else if (!side) {
                warn(`${action} of map ${id} ignored: it doesn't say which team (red / blue or a team id).`)
            } else {
                lists[`${side}${action}`].push(id)
            }
        }
    }
    add(picked, "Pick")
    add(banned, "Ban")
    return lists
}

// Ability entries can be a single object, null, or a list (history): the last one that hasn't ended is used.
// Player fields may be player numbers or player ids ("bsb-1").
function adaptAbility(value, resolvePlayer) {
    const entries = Array.isArray(value) ? value : [value]
    const active = entries.filter(isActive).at(-1)
    if (!active) return null
    const out = { ...active }
    for (const field of ["player", "target", "challenger", "challenged"]) {
        const idField = `${field}Id`
        const resolved = resolvePlayer(active[field]) ?? resolvePlayer(active[idField])
        if (resolved !== undefined) out[field] = resolved
    }
    return out
}

function adaptAbilities(raw, resolvePlayer) {
    if (!isObject(raw)) return raw
    const out = { ...raw }
    for (const name of ["demigod", "soulweaver"]) {
        if (raw[name] !== undefined) out[name] = adaptAbility(raw[name], resolvePlayer)
    }
    for (const name of ["witch", "human"]) {
        if (!isObject(raw[name])) continue
        out[name] = {}
        for (const side of constants.SIDES) out[name][side] = adaptAbility(raw[name][side], resolvePlayer)
    }
    return out
}

const pickerOrUndefined = value => (value === null || value === undefined ? undefined : value)

/**
 * Translate the match server's response into the dashboard's shape. Returns a new object; raw is not changed.
 */
export function adaptApiResponse(raw, warn = () => {}) {
    if (!isObject(raw)) return raw
    const out = { ...raw }

    // "version" is the schema version on this server (it never changes); "revision" goes up with every change
    if (toInt(raw.revision) !== undefined) out.version = toInt(raw.revision)

    // Team names: { red, blue }, or redTeam.name / blueTeam.name
    const teamName = isObject(raw.teamName) ? raw.teamName : {}
    const red = teamName.redTeamName ?? teamName.red ?? raw.redTeam?.name
    const blue = teamName.blueTeamName ?? teamName.blue ?? raw.blueTeam?.name
    if (red !== undefined || blue !== undefined) {
        out.teamName = {}
        if (red !== undefined) out.teamName.redTeamName = red
        if (blue !== undefined) out.teamName.blueTeamName = blue
    }

    // Players: a list with "player": 1-6 on each entry
    let resolvePlayer = toPlayerNumber
    if (Array.isArray(raw.playerData)) {
        resolvePlayer = makePlayerResolver(raw.playerData)
        out.playerData = adaptPlayers(raw.playerData, resolvePlayer)
    }

    // Picks / bans
    if (!(isObject(raw.pickBanInfo) && PICK_BAN_KEYS.every(key => Array.isArray(raw.pickBanInfo[key])))) {
        const lists = adaptPickBan(raw, warn)
        if (lists) out.pickBanInfo = lists
    }

    // Pickers: null = not decided yet, so the dashboard keeps what it shows. Top-level currentPicker is used too.
    const currentPicker = pickerOrUndefined(raw.mappoolInfo?.currentPicker) ?? pickerOrUndefined(raw.currentPicker)
    out.mappoolInfo = currentPicker === undefined ? undefined : { currentPicker: sideFromTeam(currentPicker, raw) ?? currentPicker }
    const nextPicker = pickerOrUndefined(raw.nextPicker)
    out.nextPicker = nextPicker === undefined ? undefined : sideFromTeam(nextPicker, raw) ?? nextPicker

    if (raw.abilities !== undefined) out.abilities = adaptAbilities(raw.abilities, resolvePlayer)

    // "lastCommited" (sic) on this server
    if (out.lastCommitted === undefined && raw.lastCommited !== undefined) out.lastCommitted = raw.lastCommited

    // Winner: "red" / "blue" / null, or a team id in winnerTeamId
    if ((raw.winner === null || raw.winner === undefined) && raw.winnerTeamId !== null && raw.winnerTeamId !== undefined) {
        const side = sideFromTeam(raw.winnerTeamId, raw)
        if (side) out.winner = side
        else warn(`winnerTeamId "${raw.winnerTeamId}" doesn't match either team.`)
    } else if (raw.winner !== null && raw.winner !== undefined && raw.winner !== "red" && raw.winner !== "blue") {
        const side = sideFromTeam(raw.winner, raw)
        if (side) out.winner = side
    }

    return out
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
    raw = adaptApiResponse(raw, warn)

    const matchId = toMatchId(raw.matchId)
    if (matchId === null) {
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
