import { constants } from "../_shared/js/constants.js";

function truncateSVGTexts(element, maxWidth) {
    const originalText = element.textContent.trim()
    element.textContent = originalText

    if (element.getComputedTextLength() <= maxWidth) return
    let text = originalText
    while (text.length > 0) {
        text = text.slice(0, -1)
        element.textContent = text + "..."

        if (element.getComputedTextLength() <= maxWidth) break
    }
}

truncateSVGTexts(document.getElementsByClassName("team-name-left")[0], constants.GAMEPLAY_TEAM_NAME_MAX_WIDTH)
truncateSVGTexts(document.getElementsByClassName("team-name-left")[1], constants.GAMEPLAY_TEAM_NAME_MAX_WIDTH)
truncateSVGTexts(document.getElementsByClassName("team-name-right")[0], constants.GAMEPLAY_TEAM_NAME_MAX_WIDTH)
truncateSVGTexts(document.getElementsByClassName("team-name-right")[1], constants.GAMEPLAY_TEAM_NAME_MAX_WIDTH)