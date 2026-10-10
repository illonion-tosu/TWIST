const textareaEl = document.getElementById("textarea")
let teams = []
async function submit() {
    const textareaElValue = textareaEl.value
    const textAreaElValueSplit = textareaElValue.split("\n")
    for (let i = 1; i < textAreaElValueSplit.length; i++) {
        const textAreaElValueSplitSplit = textAreaElValueSplit[i].split("\t")
        const teamStat = {
            "teamName": textAreaElValueSplitSplit[0],
            "player1": {
                "id": Number(textAreaElValueSplitSplit[1]),
                "playerName": textAreaElValueSplitSplit[2],
            },
            "player2": {
                "id": Number(textAreaElValueSplitSplit[3]),
                "playerName": textAreaElValueSplitSplit[4],
            },
            "player3": {
                "id": Number(textAreaElValueSplitSplit[5]),
                "playerName": textAreaElValueSplitSplit[6],
            },
            "class": textAreaElValueSplitSplit[7]
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