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
    return round ? round.maxHp : null
}

// Effective HP for a player: max HP minus incoming damage, floored at 0
export const getEffectiveHp = player => Math.max(0, Math.round(player.currentMaxHp - player.currentScoreAgainst))

// Total effective HP of a side
export function getTeamHp(playerData, side) {
    return playersOf(side).reduce((total, n) => total + getEffectiveHp(playerData[`player${n}`]), 0)
}

// Width of an HP bar for `hp` out of `maxHp` (clamped to the bar's full width)
export function getHpBarWidth(hp, maxHp, fullWidth) {
    if (!(maxHp > 0)) return 0
    return Math.min(1, Math.max(0, hp / maxHp)) * fullWidth
}
