let teams = {};

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function addTeam() {
    const teamNameInput = document.getElementById('teamNameInput');
    const teamName = teamNameInput.value.trim();
    
    if (teamName && !(teamName in teams)) {
        teams[teamName] = 0;
        teamNameInput.value = '';
        updateTeamList();
    }
}

function updateTeamList() {
    const teamList = document.getElementById('teamList');
    teamList.innerHTML = '';
    Object.keys(teams).forEach(team => {
        const div = document.createElement('div');
        div.textContent = team;
        teamList.appendChild(div);
    });
}

function startGame() {
    if (Object.keys(teams).length < 2) {
        alert('Please add at least 2 teams to start the game');
        return;
    }
    
    const scoreBoard = document.getElementById('scoreBoard');
    scoreBoard.innerHTML = `
        <div><strong>Team</strong></div>
        <div><strong>Score</strong></div>
        <div><strong>Add Points</strong></div>
        ${Object.entries(teams).map(([team, score]) => `
            <div>${team}</div>
            <div class="team-score">${score}</div>
            <div><input type="number" class="score-input" data-team="${team}" value="0"></div>
        `).join('')}
    `;
    
    showScreen('gameScreen');
}

function updateScores() {
    document.querySelectorAll('.score-input').forEach(input => {
        const team = input.dataset.team;
        const points = parseInt(input.value) || 0;
        teams[team] += points;
        input.value = '0';
    });
    
    document.querySelectorAll('.team-score').forEach((scoreDiv, index) => {
        const team = Object.keys(teams)[index];
        scoreDiv.textContent = teams[team];
    });
}

function showResults() {
    const rankings = document.getElementById('rankings');
    const sortedTeams = Object.entries(teams)
        .sort(([,a], [,b]) => b - a);
    
    rankings.innerHTML = sortedTeams
        .map(([team, score], index) => `
            <div>
                ${index + 1}. ${team} - ${score} points
            </div>
        `).join('');
    
    showScreen('resultsScreen');
}

function nextRound() {
    showScreen('gameScreen');
    startGame();
} 