let teams = {};
let roundHistory = [];
let currentRound = 1;

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
        <div class="round-header">Round ${currentRound}</div>
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

function showResults() {
    const rankings = document.getElementById('rankings');
    
    // First, show previous round's standings
    const previousStandings = Object.entries(teams)
        .map(([team, score]) => ({
            team,
            previousScore: score,
            currentRoundScore: getCurrentRoundScore(team),
            totalScore: score + getCurrentRoundScore(team),
            initialRank: 0
        }))
        .sort((a, b) => b.previousScore - a.previousScore);

    // Set initial rankings
    previousStandings.forEach((team, index) => {
        team.initialRank = index + 1;
    });

    // Display previous standings and add graph container
    rankings.innerHTML = `
        <div class="round-header">Round ${currentRound} Results</div>
        <div id="rankingsList">
            ${previousStandings.map(({ team, previousScore }, index) => `
                <div class="ranking-item" data-team="${team}">
                    ${index + 1}. ${team} - ${previousScore} points
                    <span class="score-addition"></span>
                </div>
            `).join('')}
        </div>
        <div id="rankingGraph" class="ranking-graph"></div>
    `;

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
            // Update the actual scores
            document.querySelectorAll('.score-input').forEach(input => {
                const team = input.dataset.team;
                const points = parseInt(input.value) || 0;
                teams[team] += points;
                input.value = '0';
            });

            // Calculate new standings with rank changes
            const newStandings = Object.entries(teams)
                .map(([team, score]) => {
                    const previousStanding = previousStandings.find(s => s.team === team);
                    const previousRank = previousStanding.initialRank;
                    return { team, score, previousRank };
                })
                .sort((a, b) => b.score - a.score);

            // Store round results
            const roundResults = newStandings.map(standing => standing.team);
            roundHistory.push(roundResults);

            // Update rankings display with rank changes
            document.getElementById('rankingsList').innerHTML = newStandings
                .map(({ team, score, previousRank }, currentRank) => {
                    const rankChange = previousRank - (currentRank + 1);
                    let rankIndicator = '';
                    
                    if (rankChange > 0) {
                        rankIndicator = `<span class="rank-change rank-up">↑${rankChange}</span>`;
                    } else if (rankChange < 0) {
                        rankIndicator = `<span class="rank-change rank-down">↓${Math.abs(rankChange)}</span>`;
                    } else {
                        rankIndicator = `<span class="rank-change rank-same">―</span>`;
                    }

                    return `
                        <div class="ranking-item" data-team="${team}">
                            ${currentRank + 1}. ${team} - ${score} points
                            ${rankIndicator}
                        </div>
                    `;
                }).join('');

            // Draw the graph after rankings are updated
            setTimeout(() => {
                drawRankingGraph();
            }, 500);

        }, 1500);
    }, 1000);

    showScreen('resultsScreen');
}

function getCurrentRoundScore(team) {
    const input = document.querySelector(`.score-input[data-team="${team}"]`);
    return parseInt(input.value) || 0;
}

function nextRound() {
    currentRound++;
    showScreen('gameScreen');
    startGame();
}

function endGame() {
    // Hide the modal first
    const modal = document.getElementById('confirmEndGameModal');
    modal.style.display = 'none';
    
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

function drawRankingGraph() {
    const graphContainer = document.getElementById('rankingGraph');
    const teamNames = Object.keys(teams);
    const numTeams = teamNames.length;
    const colors = [
        '#2ecc71', '#e74c3c', '#3498db', '#f39c12', 
        '#9b59b6', '#16a085', '#d35400', '#2c3e50'
    ];
    
    const width = 600;
    const height = 300;
    const padding = {
        top: 40,
        right: 40,
        bottom: 40,
        left: 40
    };
    
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;
    const ySpacingFactor = 1.0 + (0.1 * numTeams);
    
    // Calculate scales with adjusted spacing
    const xScale = (pos) => padding.left + (pos * (graphWidth / Math.max(1, roundHistory.length - 1)));
    const yScale = (pos) => {
        const totalPositions = numTeams - 1;
        if (totalPositions === 0) return padding.top;
        
        const spacing = (graphHeight / totalPositions) * ySpacingFactor;
        return padding.top + (pos * spacing);
    };
    
    let graphHTML = `
        <h3>Rankings History</h3>
        <div class="graph-grid">
            <svg class="graph-svg" viewBox="0 0 ${width} ${height}">
                ${teamNames.map((team, teamIndex) => {
                    const pathPoints = roundHistory.map((round, roundIndex) => {
                        const position = round.indexOf(team);
                        const x = xScale(roundIndex);
                        const y = yScale(position);
                        return roundIndex === 0 ? `M ${x},${y}` : `L ${x},${y}`;
                    }).join(' ');
                    
                    return `
                        <path 
                            d="${pathPoints}" 
                            stroke="${colors[teamIndex % colors.length]}"
                            class="team-line"
                        />
                        ${roundHistory.map((round, roundIndex) => {
                            const position = round.indexOf(team);
                            const x = xScale(roundIndex);
                            const y = yScale(position);
                            return `
                                <circle 
                                    cx="${x}" 
                                    cy="${y}" 
                                    r="4" 
                                    fill="${colors[teamIndex % colors.length]}"
                                />
                            `;
                        }).join('')}
                    `;
                }).join('')}
                
                <!-- Add grid lines -->
                ${teamNames.map((_, i) => `
                    <line 
                        x1="${padding.left}" 
                        y1="${yScale(i)}" 
                        x2="${width - padding.right}" 
                        y2="${yScale(i)}" 
                        stroke="#eee" 
                        stroke-width="1"
                    />
                `).join('')}
                ${roundHistory.map((_, i) => `
                    <line 
                        x1="${xScale(i)}" 
                        y1="${padding.top}" 
                        x2="${xScale(i)}" 
                        y2="${height - padding.bottom}" 
                        stroke="#eee" 
                        stroke-width="1"
                    />
                `).join('')}
            </svg>
            <div class="graph-x-axis">
                ${roundHistory.map((_, i) => `
                    <div class="x-label">Round ${i + 1}</div>
                `).join('')}
            </div>
        </div>
        <div class="graph-legend">
            ${teamNames.map((team, i) => `
                <div class="legend-item">
                    <span class="legend-color" style="background: ${colors[i % colors.length]}"></span>
                    ${team}
                </div>
            `).join('')}
        </div>
    `;
    
    graphContainer.innerHTML = graphHTML;
}

function confirmEndGame() {
    const modal = document.getElementById('confirmEndGameModal');
    modal.style.display = 'block';
}

function cancelEndGame() {
    const modal = document.getElementById('confirmEndGameModal');
    modal.style.display = 'none';
}

// Add click outside modal to close
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('confirmEndGameModal');
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            cancelEndGame();
        }
    });
}); 