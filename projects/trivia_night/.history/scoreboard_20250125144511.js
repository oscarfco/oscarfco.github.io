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
    
    // First, show previous round's standings
    const previousStandings = Object.entries(teams)
        .map(([team, score]) => ({
            team,
            previousScore: score - getCurrentRoundScore(team),
            currentRoundScore: getCurrentRoundScore(team),
            totalScore: score
        }))
        .sort((a, b) => b.previousScore - a.previousScore);

    // Display previous standings
    rankings.innerHTML = previousStandings
        .map(({ team, previousScore }, index) => `
            <div class="ranking-item" data-team="${team}">
                ${index + 1}. ${team} - ${previousScore} points
                <span class="score-addition"></span>
            </div>
        `).join('');

    // Animate score additions after a short delay
    setTimeout(() => {
        previousStandings.forEach(({ team, currentRoundScore }) => {
            const teamElement = rankings.querySelector(`[data-team="${team}"] .score-addition`);
            if (currentRoundScore > 0) {
                teamElement.textContent = ` +${currentRoundScore}`;
                teamElement.classList.add('score-pop');
            }
        });

        // After showing score additions, update the scores and sort
        setTimeout(() => {
            // Update the actual scores first
            document.querySelectorAll('.score-input').forEach(input => {
                const team = input.dataset.team;
                const points = parseInt(input.value) || 0;
                teams[team] += points;
                input.value = '0';
            });

            // Then show the new sorted standings with updated scores
            const sortedTeams = Object.entries(teams)
                .sort(([,a], [,b]) => b - a);
            
            rankings.innerHTML = sortedTeams
                .map(([team, score], index) => `
                    <div class="ranking-item" data-team="${team}">
                        ${index + 1}. ${team} - ${score} points
                    </div>
                `).join('');
        }, 1500);
    }, 1000);

    showScreen('resultsScreen');
}

function getCurrentRoundScore(team) {
    const input = document.querySelector(`.score-input[data-team="${team}"]`);
    return parseInt(input.value) || 0;
}

function nextRound() {
    showScreen('gameScreen');
    startGame();
}

function endGame() {
    const finalRankings = document.getElementById('finalRankings');
    const sortedTeams = Object.entries(teams)
        .sort(([,a], [,b]) => b - a);
    
    finalRankings.innerHTML = sortedTeams
        .map(([team, score], index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
            return `
                <div>
                    ${medal} ${index + 1}. ${team} - ${score} points
                </div>
            `;
        }).join('');
    
    showScreen('finalScreen');
    createFireworks();
}

function restartGame() {
    teams = {};
    document.getElementById('teamList').innerHTML = '';
    document.getElementById('teamNameInput').value = '';
    showScreen('initialScreen');
}

function createFireworks() {
    const fireworks = document.querySelectorAll('.fireworks');
    fireworks.forEach(firework => {
        firework.style.left = Math.random() * 100 + '%';
        firework.style.top = Math.random() * 100 + '%';
    });
} 