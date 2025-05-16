const BASE_URL = ''; // Set to Render URL, e.g., 'https://ecoscan.onrender.com'

let points = parseInt(localStorage.getItem('points')) || 0;
let history = JSON.parse(localStorage.getItem('history')) || [];
let achievements = JSON.parse(localStorage.getItem('achievements')) || [];
let username = localStorage.getItem('username') || '';
let dailyChallenge = JSON.parse(localStorage.getItem('dailyChallenge')) || { completed: false, date: '', count: 0 };

const levels = [
  { name: 'Eco Novice', minPoints: 0 },
  { name: 'Eco Warrior', minPoints: 50 },
  { name: 'Eco Hero', minPoints: 100 },
  { name: 'Eco Legend', minPoints: 200 }
];

const tutorialSteps = [
  'Welcome to EcoScan! Upload an image to classify waste and earn points.',
  'Check your progress, level, and achievements on the Profile page.',
  'See how you rank against others on the Leaderboard.',
  'Use the Waste Guide to learn about proper disposal methods.',
  'Share your feedback to help us improve!',
  'Complete daily challenges to earn bonus points!',
  'View your full classification history on the History page.'
];

let currentTutorialStep = 0;

function updateLevel() {
  const level = levels.reduce((prev, curr) => 
    points >= curr.minPoints ? curr : prev, levels[0]);
  document.getElementById('level').textContent = level.name;
}

function checkAchievements() {
  const recycleCount = history.filter(h => h.action === 'Recycle').length;
  const compostCount = history.filter(h => h.action === 'Compost').length;
  if (recycleCount >= 5 && !achievements.includes('Recycle Master')) {
    achievements.push('Recycle Master');
    showAchievement('Recycle Master');
  }
  if (compostCount >= 3 && !achievements.includes('Compost King')) {
    achievements.push('Compost King');
    showAchievement('Compost King');
  }
  localStorage.setItem('achievements', JSON.stringify(achievements));
  updateAchievements();
}

function showAchievement(name) {
  const resultDiv = document.getElementById('result');
  resultDiv.innerHTML += `<p class="text-yellow-500 font-bold animate-pulse">Achievement Unlocked: ${name}!</p>`;
}

function updateAchievements() {
  const achievementsUl = document.getElementById('achievements');
  achievementsUl.innerHTML = achievements.map(a => `<li>${a}</li>`).join('');
}

async function updateLeaderboard() {
  try {
    const response = await fetch(`${BASE_URL}/leaderboard`);
    if (!response.ok) throw new Error('Failed to fetch leaderboard');
    const leaderboard = await response.json();
    const leaderboardList = document.getElementById('leaderboardList');
    leaderboardList.innerHTML = leaderboard.map((l, i) => 
      `<li class="flex justify-between"><span>${i + 1}. ${l.username}</span><span>${l.points} pts</span></li>`
    ).join('');
    const userRank = leaderboard.findIndex(l => l.username === username) + 1;
    document.getElementById('userRank').textContent = userRank > 0 ? userRank : 'N/A';
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
  }
}

function checkDailyChallenge() {
  const today = new Date().toDateString();
  if (dailyChallenge.date !== today) {
    dailyChallenge = { completed: false, date: today, count: 0 };
  }
  if (!dailyChallenge.completed && dailyChallenge.count >= 3) {
    dailyChallenge.completed = true;
    points += 50;
    document.getElementById('result').innerHTML += `<p class="text-purple-500 font-bold animate-pulse">Daily Challenge Completed! +50 Points!</p>`;
    localStorage.setItem('points', points);
    updatePoints();
  }
  localStorage.setItem('dailyChallenge', JSON.stringify(dailyChallenge));
}

function updatePoints() {
  document.getElementById('points').textContent = points;
  updateLevel();
  updateLeaderboard();
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
    page.classList.add('hidden');
  });
  const targetPage = document.getElementById(pageId);
  targetPage.classList.remove('hidden');
  targetPage.classList.add('active');
  gsap.fromTo(targetPage, { x: 20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'power2.out' });
  if (pageId === 'guide') loadGuide();
  if (pageId === 'challenges') loadChallenges();
  if (pageId === 'profile') updateProfile();
  if (pageId === 'history') loadHistory();
}

async function classifyWaste() {
  if (!username) {
    alert('Please save a username in Profile first.');
    showPage('profile');
    return;
  }
  const fileInput = document.getElementById('wasteImage');
  const resultDiv = document.getElementById('result');
  if (!fileInput.files[0]) {
    resultDiv.innerHTML = '<p class="text-red-500">Please select an image.</p>';
    return;
  }
  const formData = new FormData();
  formData.append('image', fileInput.files[0]);
  formData.append('username', username);
  try {
    const response = await fetch(`${BASE_URL}/classify`, {
      method: 'POST',
      body: formData
    });
    if (!response.ok) throw new Error('Failed to classify image');
    const data = await response.json();
    if (data.error) {
      resultDiv.innerHTML = `<p class="text-red-500">${data.error}</p>`;
      return;
    }
    points += data.points;
    history.push({ action: data.classification, type: data.type, timestamp: new Date().toISOString(), disposal: data.disposal });
    dailyChallenge.count += 1;
    localStorage.setItem('points', points);
    localStorage.setItem('history', JSON.stringify(history));
    localStorage.setItem('dailyChallenge', JSON.stringify(dailyChallenge));
    resultDiv.innerHTML = `<p class="text-green-600">Classified as ${data.type} (${data.classification}). +${data.points} Points! Dispose in ${data.disposal}.</p>`;
    checkAchievements();
    checkDailyChallenge();
    updatePoints();
    updateHistory();
    fileInput.value = '';
  } catch (error) {
    resultDiv.innerHTML = '<p class="text-red-500">Error classifying image: ${error.message}</p>';
    console.error('Classification error:', error);
  }
}

async function saveUsername() {
  const newUsername = document.getElementById('username').value.trim();
  if (!newUsername) {
    alert('Please enter a username.');
    return;
  }
  try {
    const response = await fetch(`${BASE_URL}/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUsername, points })
    });
    if (!response.ok) throw new Error('Failed to save username');
    username = newUsername;
    localStorage.setItem('username', username);
    updateLeaderboard();
    updateProfile();
    alert('Username saved successfully!');
  } catch (error) {
    alert('Error saving username: ' + error.message);
    console.error('Username error:', error);
  }
}

async function submitFeedback() {
  const feedback = document.getElementById('feedbackText').value.trim();
  const feedbackMessage = document.getElementById('feedbackMessage');
  if (!feedback) {
    feedbackMessage.innerHTML = '<p class="text-red-500">Please enter feedback.</p>';
    return;
  }
  try {
    const response = await fetch(`${BASE_URL}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback, username })
    });
    if (!response.ok) throw new Error('Failed to submit feedback');
    feedbackMessage.innerHTML = '<p class="text-green-600">Feedback submitted successfully!</p>';
    document.getElementById('feedbackText').value = '';
    setTimeout(() => { feedbackMessage.innerHTML = ''; }, 3000);
  } catch (error) {
    feedbackMessage.innerHTML = `<p class="text-red-500">Error submitting feedback: ${error.message}</p>`;
    console.error('Feedback error:', error);
  }
}

async function updateHistory() {
  if (!username) return;
  try {
    const response = await fetch(`${BASE_URL}/history?username=${encodeURIComponent(username)}`);
    if (!response.ok) throw new Error('Failed to fetch history');
    const serverHistory = await response.json();
    history = serverHistory;
    localStorage.setItem('history', JSON.stringify(history));
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = history.slice(-5).reverse().map(h => 
      `<li>${h.type} (${h.action}) - Dispose in ${h.disposal} - ${new Date(h.timestamp).toLocaleString()}</li>`
    ).join('');
  } catch (error) {
    console.error('Error updating history:', error);
  }
}

async function updateProfile() {
  document.getElementById('username').value = username;
  document.getElementById('points').textContent = points;
  await updateHistory();
  const profileHistory = document.getElementById('profileHistory');
  profileHistory.innerHTML = history.slice(0, 10).reverse().map(h => 
    `<li>${h.type} (${h.action}) - Dispose in ${h.disposal} - ${new Date(h.timestamp).toLocaleString()}</li>`
  ).join('');
}

async function loadGuide() {
  const searchTerm = document.getElementById('guideSearch').value.trim();
  try {
    const response = await fetch(`${BASE_URL}/guide${searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ''}`);
    if (!response.ok) throw new Error('Failed to load guide');
    const guides = await response.json();
    const guideList = document.getElementById('guideList');
    guideList.innerHTML = guides.length ? guides.map(g => 
      `<li>${g.type}: ${g.instructions}</li>`
    ).join('') : '<li>No results found.</li>';
  } catch (error) {
    console.error('Error loading guide:', error);
    document.getElementById('guideList').innerHTML = `<li>Error loading guide: ${error.message}</li>`;
  }
}

function searchGuide() {
  loadGuide();
}

async function loadChallenges() {
  if (!username) {
    document.getElementById('challengeList').innerHTML = '<li>Please save a username in Profile first.</li>';
    return;
  }
  try {
    const response = await fetch(`${BASE_URL}/challenges?username=${encodeURIComponent(username)}`);
    if (!response.ok) throw new Error('Failed to load challenges');
    const challenges = await response.json();
    const challengeList = document.getElementById('challengeList');
    challengeList.innerHTML = challenges.map(c => 
      `<li><input type="radio" name="challenge" value="${c.id}" ${c.completed ? 'disabled' : ''}> ${c.description} (+${c.points} Points)</li>`
    ).join('');
  } catch (error) {
    console.error('Error loading challenges:', error);
    document.getElementById('challengeList').innerHTML = `<li>Error loading challenges: ${error.message}</li>`;
  }
}

async function completeChallenge() {
  if (!username) {
    alert('Please save a username in Profile first.');
    showPage('profile');
    return;
  }
  const selected = document.querySelector('input[name="challenge"]:checked');
  if (!selected) {
    alert('Please select a challenge.');
    return;
  }
  const challengeId = selected.value;
  try {
    const response = await fetch(`${BASE_URL}/challenges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, username })
    });
    if (!response.ok) throw new Error('Failed to complete challenge');
    const data = await response.json();
    if (data.error) {
      alert(data.error);
      return;
    }
    points += data.points;
    localStorage.setItem('points', points);
    updatePoints();
    alert(`Challenge completed! +${data.points} Points`);
    loadChallenges();
  } catch (error) {
    alert('Error completing challenge: ' + error.message);
    console.error('Challenge error:', error);
  }
}

async function loadHistory() {
  if (!username) {
    document.getElementById('fullHistoryList').innerHTML = '<li>Please save a username in Profile first.</li>';
    return;
  }
  try {
    const response = await fetch(`${BASE_URL}/history?username=${encodeURIComponent(username)}`);
    if (!response.ok) throw new Error('Failed to load history');
    const serverHistory = await response.json();
    history = serverHistory;
    localStorage.setItem('history', JSON.stringify(history));
    const fullHistoryList = document.getElementById('fullHistoryList');
    fullHistoryList.innerHTML = history.reverse().map(h => 
      `<li>${h.type} (${h.action}) - Dispose in ${h.disposal} - ${new Date(h.timestamp).toLocaleString()}</li>`
    ).join('');
  } catch (error) {
    console.error('Error loading history:', error);
    document.getElementById('fullHistoryList').innerHTML = `<li>Error loading history: ${error.message}</li>`;
  }
}

// Initialize
updateHistory();
updateLeaderboard();