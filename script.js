let points = parseInt(localStorage.getItem('points')) || 0;
let history = JSON.parse(localStorage.getItem('history')) || [];
let achievements = JSON.parse(localStorage.getItem('achievements')) || [];
let username = localStorage.getItem('username') || '';
let dailyChallenge = JSON.parse(localStorage.getItem('dailyChallenge')) || { completed: false, date: '' };

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
  'Share your feedback to help us improve!'
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
  if (recycleCount >= 10 && !achievements.includes('Recycle Master')) {
    achievements.push('Recycle Master');
    showAchievement('Recycle Master');
  }
  if (compostCount >= 5 && !achievements.includes('Compost King')) {
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

function updateLeaderboard() {
  const leaderboard = JSON.parse(localStorage.getItem('leaderboard')) || [];
  if (username) {
    const userEntry = leaderboard.find(l => l.username === username) || { username, points };
    userEntry.points = points;
    if (!leaderboard.includes(userEntry)) leaderboard.push(userEntry);
    leaderboard.sort((a, b) => b.points - a.points);
    localStorage.setItem('leaderboard', JSON.stringify(leaderboard.slice(0, 5)));
  }
  const leaderboardList = document.getElementById('leaderboardList');
  leaderboardList.innerHTML = leaderboard.map((l, i) => 
    `<li class="flex justify-between"><span>${i + 1}. ${l.username}</span><span>${l.points} pts</span></li>`
  ).join('');
  const userRank = leaderboard.findIndex(l => l.username === username) + 1;
  document.getElementById('userRank').textContent = userRank > 0 ? userRank : 'N/A';
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
}