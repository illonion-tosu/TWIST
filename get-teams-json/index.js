// Builds teams.json from a pasted spreadsheet.
//
// Columns (tab separated, first row is a header and is skipped):
//   team name | p1 osu! id | p1 name | p1 element | p2 id | p2 name | p2 element | p3 id | p3 name | p3 element | short name (optional)
//
// Output is the same format the match server uses:
//   [{ id, name, shortName, players: [{ id, osuId, name, element }] }]
// A blank player (2-player team) is left out of `players`.

const words = text => String(text ?? "").match(/[\p{L}\p{N}]+/gu) ?? []

function slugify(text) {
    return String(text ?? "")
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
}

// "Perihelion Club" -> "PC", "Munchcost 4" -> "M4", "malay" -> "MAL"
function deriveShortName(name) {
    const parts = words(name)
    if (parts.length >= 2) return parts.slice(0, 4).map(part => Array.from(part)[0]).join("").toUpperCase()
    return Array.from(parts[0] ?? "").slice(0, 3).join("").toUpperCase()
}

// Returns `value` or `value2`, `value3`... if it is already taken
function unique(value, taken) {
    let candidate = value
    for (let n = 2; taken.has(candidate); n++) candidate = `${value}${n}`
    taken.add(candidate)
    return candidate
}

// teams: [{ name, shortName?, players: [{ osuId, name, element }] }] -> teams.json
export function buildTeams(teams) {
    const takenIds = new Set()
    const takenShortNames = new Set()

    return teams.map((team, index) => {
        const name = String(team.name ?? "").trim()
        const id = unique(slugify(name) || `team-${index + 1}`, takenIds)
        const shortName = unique(String(team.shortName ?? "").trim() || deriveShortName(name) || `T${index + 1}`, takenShortNames)

        const players = (team.players ?? [])
            .map(player => ({
                osuId: Number(player.osuId) || 0,
                name: String(player.name ?? "").trim(),
                element: String(player.element ?? "").trim().toLowerCase(),
            }))
            .filter(player => player.osuId && player.name)
            .map((player, playerIndex) => ({
                id: `${shortName.toLowerCase()}-${playerIndex + 1}`,
                osuId: player.osuId,
                name: player.name,
                element: player.element,
            }))

        return { id, name, shortName, players }
    })
}

// Pasted spreadsheet text -> teams.json
export function parseSheet(text) {
    const rows = text.split(/\r?\n/).slice(1).filter(row => row.trim())
    return buildTeams(rows.map(row => {
        const cells = row.split("\t").map(cell => cell.trim())
        const cell = index => cells[index] ?? ""
        return {
            name: cell(0),
            shortName: cell(10),
            players: [1, 4, 7].map(start => ({ osuId: cell(start), name: cell(start + 1), element: cell(start + 2) })),
        }
    }))
}

function submit() {
    const teams = parseSheet(document.getElementById("textarea").value)
    const blob = new Blob([JSON.stringify(teams, null, 2)], { type: "application/json" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "teams.json"
    link.click()
}

if (typeof window !== "undefined") {
    window.addEventListener("load", () => document.getElementById("button").addEventListener("click", submit))
}
