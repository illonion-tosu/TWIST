const textareaEl = document.getElementById("textarea")
const buttonEl = document.getElementById("button")
async function submit() {
    // Local, so pressing Submit twice doesn't download every team twice
    const teams = []
    const textareaElValue = textareaEl.value
    const textAreaElValueSplit = textareaElValue.split(/\r?\n/)
    for (let i = 1; i < textAreaElValueSplit.length; i++) {
        if (!textAreaElValueSplit[i].trim()) continue

        const textAreaElValueSplitSplit = textAreaElValueSplit[i].split("\t").map(cell => cell.trim())
        const cell = index => textAreaElValueSplitSplit[index] ?? ""
        const player = index => ({
            "id": Number(cell(index)) || 0,
            "playerName": cell(index + 1),
            "class": cell(index + 2)
        })
        const teamStat = {
            "teamName": cell(0),
            "player1": player(1),
            "player2": player(4),
            "player3": player(7)
        }
        teams.push(teamStat)
    }

    const jsonString = JSON.stringify(teams, null, 4)
    const blob = new Blob([jsonString], { type: "application/json" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "teams.json"
    link.click()
}

window.onload = () => {
    buttonEl.addEventListener("click", submit)
}