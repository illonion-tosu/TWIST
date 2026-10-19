import { constants } from "../js/constants.js"

// Which side (red / blue) a player number (1-6) is on
export const sideOf = playerNumber => constants.TEAM_PLAYER_NUMBERS.red.includes(playerNumber) ? "red" : "blue"

// Player numbers on a side
export const playersOf = side => constants.TEAM_PLAYER_NUMBERS[side]

export const otherSide = side => side === "red" ? "blue" : "red"

// Max HP a round starts with (falls back to the default for unknown round names)
export function getRoundMaxHp(roundName) {
    const name = String(roundName ?? "").toLowerCase()
    const round = constants.ROUND_MAX_HP.find(({ names }) => names.includes(name))
    return round ? round.maxHp : constants.DEFAULT_MAX_HP
}

// Teams can be 2 or 3 players. A 2-player team leaves its third slot empty (id 0, no name) in teams.json.
export const isSlotFilled = teamPlayer => Boolean(teamPlayer?.id) && Boolean(String(teamPlayer?.playerName ?? "").trim())

// playerData entries carry `present`. Saves from before it existed (undefined) count as present.
export const isPresent = player => player?.present !== false

// Player numbers on a side who are actually playing
export const getPresentPlayers = (playerData, side) =>
    playersOf(side).filter(n => isPresent(playerData[`player${n}`]))

// Effective HP for a player: max HP minus incoming damage, floored at 0. Empty slots have none.
export const getEffectiveHp = player =>
    isPresent(player) ? Math.max(0, Math.round(player.currentMaxHp - player.currentScoreAgainst)) : 0

// Total effective HP of a side
export function getTeamHp(playerData, side) {
    return getPresentPlayers(playerData, side).reduce((total, n) => total + getEffectiveHp(playerData[`player${n}`]), 0)
}

// What a side's HP bar is measured against: max HP for each player actually playing (no bonus for a short team)
export const getTeamMaxHp = (playerData, side, maxHp) => getPresentPlayers(playerData, side).length * maxHp

// Width of an HP bar for `hp` out of `maxHp` (clamped to the bar's full width)
export function getHpBarWidth(hp, maxHp, fullWidth) {
    if (!(maxHp > 0)) return 0
    return Math.min(1, Math.max(0, hp / maxHp)) * fullWidth
}
