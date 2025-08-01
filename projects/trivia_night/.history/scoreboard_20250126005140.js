let teams = {};
let roundHistory = [];
let currentRound = 1;

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function addTeam() {
    const teamNameInput = document.getElementById('teamNameInput');
    const teamImageInput = document.getElementById('teamImageInput');
    const imageUploadSuccess = document.getElementById('imageUploadSuccess');
    const teamName = teamNameInput.value.trim();
    
    // Hide success message when starting new team addition
    imageUploadSuccess.style.display = 'none';
    
    if (teamName && !(teamName in teams)) {
        const file = teamImageInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                teams[teamName] = {
                    score: 0,
                    image: e.target.result
                };
                teamNameInput.value = '';
                teamImageInput.value = '';
                imageUploadSuccess.style.display = 'none'; // Hide success message after team is added
                updateTeamList();
            };
            reader.readAsDataURL(file);
        } else {
            if (!confirm('No image selected for this team. Do you want to continue without an image?')) {
                return;
            }
            teams[teamName] = {
                score: 0,
                image: null
            };
            teamNameInput.value = '';
            teamImageInput.value = '';
            updateTeamList();
        }
    }
}

function updateTeamList() {
    const teamList = document.getElementById('teamList');
    teamList.innerHTML = '';
    Object.entries(teams).forEach(([team, data]) => {
        const div = document.createElement('div');
        div.className = 'team-list-item';
        div.innerHTML = `
            <div class="team-image-container">
                ${data.image ? 
                    `<img src="${data.image}" alt="${team}" class="team-image">` : 
                    `<div class="team-image-placeholder">${team[0].toUpperCase()}</div>`
                }
            </div>
            <span>${team}</span>
        `;
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
        ${Object.entries(teams).map(([team, data]) => `
            <div class="team-row">
                <div class="team-image-container">
                    ${data.image ? 
                        `<img src="${data.image}" alt="${team}" class="team-image">` : 
                        `<div class="team-image-placeholder">${team[0].toUpperCase()}</div>`
                    }
                </div>
                ${team}
            </div>
            <div class="team-score">${data.score}</div>
            <div><input type="number" class="score-input" data-team="${team}" value="0"></div>
        `).join('')}
    `;

    // Add stopwatch HTML
    const stopwatchHTML = `
        <div class="stopwatch-container">
            <div class="stopwatch">
                <div class="stopwatch-display">
                    <span id="minutes">05</span>:<span id="seconds">00</span>
                </div>
                <div class="controls-wrapper">
                    <div class="stopwatch-controls">
                        <button onclick="adjustTimer('minutes', 1)" class="control-btn up">▲</button>
                        <button onclick="adjustTimer('minutes', -1)" class="control-btn down">▼</button>
                        <button onclick="adjustTimer('seconds', 1)" class="control-btn up">▲</button>
                        <button onclick="adjustTimer('seconds', -1)" class="control-btn down">▼</button>
                    </div>
                    <button id="startRoundBtn" onclick="startRoundTimer()" class="start-btn">Start Round</button>
                </div>
            </div>
        </div>
    `;

    // Insert stopwatch
    document.body.insertAdjacentHTML('afterbegin', stopwatchHTML);
    
    showScreen('gameScreen');
}

function showResults() {
    const rankings = document.getElementById('rankings');
    
    // First, show previous round's standings
    const previousStandings = Object.entries(teams)
        .map(([team, data]) => ({
            team,
            previousScore: data.score,
            currentRoundScore: getCurrentRoundScore(team),
            totalScore: data.score + getCurrentRoundScore(team),
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
                    <div class="team-image-container">
                        ${teams[team].image ? 
                            `<img src="${teams[team].image}" alt="${team}" class="team-image">` : 
                            `<div class="team-image-placeholder">${team[0].toUpperCase()}</div>`
                        }
                    </div>
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
            if (currentRoundScore >= 0) {
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
                teams[team].score += points;
                input.value = '0';
            });

            // Calculate new standings with rank changes
            const newStandings = Object.entries(teams)
                .map(([team, data]) => {
                    const previousStanding = previousStandings.find(s => s.team === team);
                    const previousRank = previousStanding.initialRank;
                    return { team, score: data.score, previousRank };
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
                            <div class="team-image-container">
                                ${teams[team].image ? 
                                    `<img src="${teams[team].image}" alt="${team}" class="team-image">` : 
                                    `<div class="team-image-placeholder">${team[0].toUpperCase()}</div>`
                                }
                            </div>
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
        .map(([team, data], index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
            return `
                <div>
                    ${medal} ${index + 1}. ${team} - ${data.score} points
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
    
    // xScale: position each round from left to right
    const xScale = (pos) => 
        padding.left + (pos * (graphWidth / Math.max(1, roundHistory.length - 1)));

    // yScale: position ranks from top (best rank = 0) to bottom (worst rank = teamNames.length - 1)
    const yScale = (pos) => {
        const totalPositions = teamNames.length - 1;
        if (totalPositions === 0) return padding.top; 
        const spacing = graphHeight / totalPositions;
        return padding.top + (pos * spacing);
    };

    // Build the graph HTML
    let graphHTML = `
        <h3>Rankings History</h3>
        <div class="graph-grid">
            <!-- Empty y-axis div: we removed the label generation here -->
            <div class="graph-y-axis" style="padding: ${padding.top}px 10px ${padding.bottom}px 10px">
            </div>
            
            <svg class="graph-svg" viewBox="0 0 ${width} ${height}">
                ${teamNames.map((team, teamIndex) => {
                    // Create the line path for each team
                    const pathPoints = roundHistory.map((round, roundIndex) => {
                        const position = round.indexOf(team);
                        const x = xScale(roundIndex);
                        const y = yScale(position);
                        return roundIndex === 0 ? `M ${x},${y}` : `L ${x},${y}`;
                    }).join(' ');
                    
                    // Circles per round
                    const circles = roundHistory.map((round, roundIndex) => {
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
                    }).join('');

                    return `
                        <path 
                            d="${pathPoints}" 
                            stroke="${colors[teamIndex % colors.length]}"
                            class="team-line"
                        />
                        ${circles}
                    `;
                }).join('')}
                
                <!-- Horizontal grid lines -->
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
                
                <!-- Vertical grid lines (for each round) -->
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
            
            <!-- X-axis labels -->
            <div class="graph-x-axis">
                ${roundHistory.map((_, i) => `
                    <div class="x-label">Round ${i + 1}</div>
                `).join('')}
            </div>
        </div>
        
        <!-- Legend -->
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

// Add this new function
function handleImageUpload() {
    const imageUploadSuccess = document.getElementById('imageUploadSuccess');
    const file = document.getElementById('teamImageInput').files[0];
    if (file) {
        imageUploadSuccess.style.display = 'inline-flex';
    } else {
        imageUploadSuccess.style.display = 'none';
    }
}

// Add these new functions
let timerInterval;
let timeRemaining;

function adjustTimer(unit, amount) {
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');
    
    let minutes = parseInt(minutesEl.textContent);
    let seconds = parseInt(secondsEl.textContent);
    
    if (unit === 'minutes') {
        minutes += amount;
        if (minutes < 0) minutes = 0;
        if (minutes > 99) minutes = 99;
    } else {
        seconds += amount;
        if (seconds < 0) {
            if (minutes > 0) {
                minutes--;
                seconds = 59;
            } else {
                seconds = 0;
            }
        }
        if (seconds > 59) {
            if (minutes < 99) {
                minutes++;
                seconds = 0;
            } else {
                seconds = 59;
            }
        }
    }
    
    minutesEl.textContent = minutes.toString().padStart(2, '0');
    secondsEl.textContent = seconds.toString().padStart(2, '0');
}

function playBeep() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sine';
    oscillator.frequency.value = 800; // Frequency in hertz
    gainNode.gain.value = 0.5; // Volume control

    oscillator.start();
    
    // Stop the beep after 0.5 seconds
    setTimeout(() => {
        oscillator.stop();
        audioContext.close();
    }, 500);
}

function startRoundTimer() {
    const startBtn = document.getElementById('startRoundBtn');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');
    
    if (startBtn.textContent === 'Start Round') {
        timeRemaining = (parseInt(minutesEl.textContent) * 60 + parseInt(secondsEl.textContent)) * 1000;
        if (timeRemaining <= 0) return;
        
        startBtn.textContent = 'Stop Round';
        startBtn.classList.add('active');
        
        document.querySelectorAll('.timer-controls button').forEach(btn => btn.disabled = true);
        
        timerInterval = setInterval(() => {
            timeRemaining -= 1000;
            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                startBtn.textContent = 'Round Complete';
                startBtn.disabled = true;
                playBeep(); // Play beep when timer reaches zero
                return;
            }
            
            const minutes = Math.floor(timeRemaining / (60 * 1000));
            const seconds = Math.floor((timeRemaining % (60 * 1000)) / 1000);
            
            minutesEl.textContent = minutes.toString().padStart(2, '0');
            secondsEl.textContent = seconds.toString().padStart(2, '0');
        }, 1000);
    } else {
        clearInterval(timerInterval);
        startBtn.textContent = 'Start Round';
        startBtn.classList.remove('active');
        document.querySelectorAll('.timer-controls button').forEach(btn => btn.disabled = false);
    }
} 