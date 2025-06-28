let teams = {};
let roundHistory = [];
let currentRound = 1;
let teamColors = {};

function showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show the target screen
    const nextScreen = document.getElementById(screenId);
    nextScreen.classList.add('active');
}

function addTeam() {
    const teamNameInput = document.getElementById('teamNameInput');
    const teamImageInput = document.getElementById('teamImageInput');
    const teamColorInput = document.getElementById('teamColorInput');
    const imageUploadSuccess = document.getElementById('imageUploadSuccess');
    const teamName = teamNameInput.value.trim();
    
    if (!teamName) {
        alert('Please enter a team name');
        return;
    }
    
    if (teamName in teams) {
        alert('Team name already exists');
        return;
    }
    
    const selectedColor = teamColorInput.value;
    console.log('Selected color:', selectedColor);
    const file = teamImageInput.files[0];
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            teams[teamName] = {
                score: 0,
                image: e.target.result
            };
            teamColors[teamName] = selectedColor;
            resetInputs();
            updateTeamList();
        };
        reader.readAsDataURL(file);
    } else {
        teams[teamName] = {
            score: 0,
            image: null
        };
        teamColors[teamName] = selectedColor;
        resetInputs();
        updateTeamList();
    }
}

function resetInputs() {
    const teamNameInput = document.getElementById('teamNameInput');
    const teamImageInput = document.getElementById('teamImageInput');
    const teamColorInput = document.getElementById('teamColorInput');
    const imageUploadSuccess = document.getElementById('imageUploadSuccess');
    
    teamNameInput.value = '';
    teamImageInput.value = '';
    teamColorInput.value = '#000000';
    imageUploadSuccess.style.display = 'none';
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
            <span style="color: ${teamColors[team]} !important">${team}</span>
            <div class="team-color-indicator" style="background-color: ${teamColors[team]}"></div>
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
                <span style="color: ${teamColors[team]} !important">${team}</span>
            </div>
            <div class="team-score">${data.score}</div>
            <div><input type="number" class="score-input" data-team="${team}" value="0"></div>
        `).join('')}
    `;

    // Add stopwatch HTML
    const stopwatchHTML = `
        <div class="stopwatch-container" style="position: fixed; top: 20px; right: 20px; z-index: 1000;">
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
    // Remove the stopwatch when showing results
    const stopwatch = document.querySelector('.stopwatch-container');
    if (stopwatch) {
        stopwatch.remove();
    }
    
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
    
    const xScale = (pos) => 
        padding.left + (pos * (graphWidth / Math.max(1, roundHistory.length - 1)));

    const yScale = (pos) => {
        const totalPositions = teamNames.length - 1;
        if (totalPositions === 0) return padding.top; 
        const spacing = graphHeight / totalPositions;
        return padding.top + (pos * spacing);
    };

    let graphHTML = `
        <h3>Rankings History</h3>
        <div class="graph-grid">
            <div class="graph-y-axis"></div>
            
            <svg class="graph-svg" viewBox="0 0 ${width} ${height}">
                ${teamNames.map((team) => {
                    const pathPoints = roundHistory.map((round, roundIndex) => {
                        const position = round.indexOf(team);
                        const x = xScale(roundIndex);
                        const y = yScale(position);
                        return roundIndex === 0 ? `M ${x},${y}` : `L ${x},${y}`;
                    }).join(' ');
                    
                    const circles = roundHistory.map((round, roundIndex) => {
                        const position = round.indexOf(team);
                        const x = xScale(roundIndex);
                        const y = yScale(position);
                        return `
                            <circle 
                                cx="${x}" 
                                cy="${y}" 
                                r="4" 
                                fill="${teamColors[team]}"
                            />
                        `;
                    }).join('');

                    return `
                        <path 
                            d="${pathPoints}" 
                            stroke="${teamColors[team]}"
                            fill="none"
                            stroke-width="2"
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
                
                <!-- Vertical grid lines -->
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
            ${teamNames.map(team => `
                <div class="legend-item">
                    <span class="legend-color" style="background: ${teamColors[team]}"></span>
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

function playBeep(count = 5) {
    let beepCount = 0;
    
    function singleBeep() {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = 'sine';
        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.5;

        oscillator.start();
        
        setTimeout(() => {
            oscillator.stop();
            audioContext.close();
            
            beepCount++;
            if (beepCount < count) {
                // Wait 300ms before playing next beep
                setTimeout(singleBeep, 300);
            }
        }, 200);
    }
    
    singleBeep();
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
            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                minutesEl.textContent = '00';
                secondsEl.textContent = '00';
                startBtn.textContent = 'Round Complete';
                startBtn.disabled = true;
                playBeep();
                return;
            }
            
            timeRemaining -= 1000;
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

// Add this function for round transitions
function animateRoundTransition(roundNumber) {
    const transitionOverlay = document.createElement('div');
    transitionOverlay.className = 'round-transition';
    transitionOverlay.innerHTML = `
        <div class="round-number">Round ${roundNumber}</div>
    `;
    document.body.appendChild(transitionOverlay);
    
    setTimeout(() => {
        transitionOverlay.classList.add('fade-out');
        setTimeout(() => {
            transitionOverlay.remove();
        }, 1000);
    }, 1500);
}

// Add these styles for the round transition
// You can add these styles in your CSS file
// For example:
/*
.round-transition {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.round-transition .round-number {
    background-color: white;
    padding: 20px;
    border-radius: 10px;
    font-size: 2em;
    font-weight: bold;
}

.round-transition.fade-out {
    opacity: 0;
    transition: opacity 1s ease;
}
*/ 