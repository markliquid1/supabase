// Supabase configuration
const SUPABASE_URL = 'https://qnbekuaoweuteylitzvo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuYmVrdWFvd2V1dGV5bGl0enZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5NzY1MzUsImV4cCI6MjA2NzU1MjUzNX0.k2S_kzkdAyN1Azs_7enxLun9LouB1bA_q7Sw8x1Cp0o';

let currentDeviceUID = null;
let token = null;
let allSpeedData = [];

// Initialize on page load
async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    token = urlParams.get('token');

    if (!token) {
        document.querySelector('.container').innerHTML = '<div class="settings-card"><p style="color: #ff6b6b;">No authentication token provided</p></div>';
        return;
    }

    console.log('Initializing leaderboards with token:', token.substring(0, 10) + '...');

    // Load all leaderboards
    await Promise.all([
        // Exploration & Adventure
        loadCompactLeaderboard('countries_visited', 'lb-countries-visited', ''),
        loadCompactLeaderboard('ports_visited', 'lb-ports-visited', ''),
        loadCompactLeaderboard('total_distance_alltime', 'lb-total-distance', 'nm'),
        loadCompactLeaderboard('longest_streak_days', 'lb-longest-trip', 'nm'),
        loadCompactLeaderboard('max_24hr_distance', 'lb-max-24hr', 'nm'),
        loadCompactLeaderboard('days_at_sea_alltime', 'lb-days-cruising', 'days'),
        loadCompactLeaderboard('longest_streak_days', 'lb-longest-passage', 'days'),
        loadCompactLeaderboard('days_cruising_this_year', 'lb-days-this-year', 'days'),
        loadCompactLeaderboard('consecutive_days_under_sail', 'lb-consecutive-sail', 'days'),

        // Energy & Efficiency
        loadCompactLeaderboard('solar_kwh_alltime', 'lb-solar-kwh', 'kWh'),
        loadCompactLeaderboard('alt_kwh_alltime', 'lb-alt-kwh', 'kWh'),
        loadCompactLeaderboard('max_alt_amps', 'lb-max-alt-amps', 'A'),
        loadCompactLeaderboard('best_nm_per_gallon', 'lb-nm-per-gallon', 'mpg'),
        loadCompactLeaderboard('best_nm_per_kwh', 'lb-nm-per-kwh', 'nm/kWh'),

        // Engine & Maintenance
        loadCompactLeaderboard('engine_hours', 'lb-engine-hours', 'hrs'),

        // Weather Extremes
        loadCompactLeaderboard('board_temp_max_alltime', 'lb-max-temp', '°F'),
        loadCompactLeaderboard('board_temp_min_alltime', 'lb-min-temp', '°F'),
        loadCompactLeaderboard('baro_pressure_max_alltime', 'lb-max-pressure', 'mbar'),
        loadCompactLeaderboard('baro_pressure_min_alltime', 'lb-min-pressure', 'mbar'),

        // Anchoring
        loadCompactLeaderboard('deepest_anchorage_ft', 'lb-deepest-anchorage', 'ft'),
        loadCompactLeaderboard('consecutive_days_at_anchor', 'lb-consecutive-anchor', 'days'),

        // Speed data (for scatter plot)
        loadSpeedData()
    ]);

    // Initialize speed chart after data loads
    initSpeedChart();
}

// Load compact leaderboard: top 3 + user + expandable "more"
async function loadCompactLeaderboard(column, containerId, unit) {
    console.log(`Loading compact leaderboard for ${column}`);

    try {
        // Fetch top 10 (top 3 visible, rest in "more")
        const top10Response = await fetch(`${SUPABASE_URL}/functions/v1/get-leaderboards`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify({
                token: token,
                type: 'energy',
                column: column,
                limit: 10
            })
        });

        const top10Result = await top10Response.json();

        if (!top10Response.ok) {
            throw new Error(top10Result.error || 'Failed to fetch leaderboard');
        }

        const { data: top10Data, currentDeviceUID: deviceUID } = top10Result;
        if (!currentDeviceUID) currentDeviceUID = deviceUID;

        // Fetch user's rank
        const userRankResponse = await fetch(`${SUPABASE_URL}/functions/v1/get-user-rank`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify({
                token: token,
                type: 'energy',
                column: column
            })
        });

        const userRankResult = await userRankResponse.json();

        if (!userRankResponse.ok) {
            throw new Error(userRankResult.error || 'Failed to fetch user rank');
        }

        const { rank: userRank, entry: userEntry } = userRankResult;

        const container = document.getElementById(containerId);
        if (!top10Data || top10Data.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">No data available</div>';
            return;
        }

        // Check if user is in top 3
        const userInTop3 = top10Data.slice(0, 3).some(entry => entry.device_uid === currentDeviceUID);

        // Build HTML
        let html = '';

        // Top 3
        const top3 = top10Data.slice(0, 3).filter(entry => entry.user_profiles);
        top3.forEach((entry, index) => {
            const isCurrentUser = entry.device_uid === currentDeviceUID;
            const value = formatValue(entry[column], unit);
            html += createLeaderboardRow(index + 1, entry, value, unit, isCurrentUser, true);
        });

        // User's row if not in top 3
        if (!userInTop3 && userEntry && userEntry.user_profiles) {
            const value = formatValue(userEntry[column], unit);
            html += createLeaderboardRow(userRank, userEntry, value, unit, true, false);
        }

        // Remaining rows (4-10) - hidden by default
        const remaining = top10Data.slice(3, 10).filter(entry => entry.user_profiles && entry.device_uid !== currentDeviceUID);
        if (remaining.length > 0) {
            html += '<div class="hidden-rows" id="' + containerId + '-hidden">';
            remaining.forEach((entry, index) => {
                const value = formatValue(entry[column], unit);
                html += createLeaderboardRow(index + 4, entry, value, unit, false, false);
            });
            html += '</div>';
            html += '<div class="show-more" onclick="toggleMore(\'' + containerId + '-hidden\', this)">More ↓</div>';
        }

        container.innerHTML = html;

    } catch (error) {
        console.error(`Error loading leaderboard for ${column}:`, error);
        const container = document.getElementById(containerId);
        container.innerHTML = `<div style="padding: 20px; text-align: center; color: #ff6b6b;">Error: ${error.message}</div>`;
    }
}

// Create a single leaderboard row
function createLeaderboardRow(rank, entry, value, unit, isCurrentUser, isTop3) {
    const rankClass = rank <= 3 ? 'top3' : '';
    const userClass = isCurrentUser ? 'user-highlight' : '';
    const rankDisplay = isCurrentUser && rank > 3 ? `#${rank}` : `#${rank}`;

    let html = `
        <div class="lb-row ${userClass}" onclick="toggleDetails(this)">
            <span class="rank ${rankClass}">${rankDisplay}</span>
            <span class="username">${entry.user_profiles.username}</span>
            <span class="chevron">›</span>
            <span class="value">${value}${unit ? ' ' + unit : ''}</span>
        </div>
        <div class="details">`;

    if (entry.user_profiles.boat_type && entry.user_profiles.boat_length) {
        html += `<span class="detail-item">${entry.user_profiles.boat_type} • ${entry.user_profiles.boat_length} ft</span>`;
    }
    if (entry.user_profiles.boat_year && entry.user_profiles.boat_make_model) {
        html += `<span class="detail-item">${entry.user_profiles.boat_year} ${entry.user_profiles.boat_make_model}</span>`;
    } else if (entry.user_profiles.boat_make_model) {
        html += `<span class="detail-item">${entry.user_profiles.boat_make_model}</span>`;
    }
    if (entry.user_profiles.home_port) {
        html += `<span class="detail-item">${entry.user_profiles.home_port}</span>`;
    }

    html += `</div>`;
    return html;
}

// Format value based on unit
function formatValue(value, unit) {
    if (value === null || value === undefined) return '---';

    if (unit === 'A' || unit === 'kts') {
        return value.toFixed(1);
    } else if (unit === 'days' || unit === 'hrs' || unit === '') {
        return Math.round(value).toString();
    } else if (unit === '%' || unit === 'mpg' || unit === 'nm/hr' || unit === 'nm/kWh') {
        return value.toFixed(1);
    } else if (unit === '°F' || unit === 'mbar') {
        return value.toFixed(1);
    } else if (unit === 'ft' || unit === 'nm') {
        return Math.round(value).toLocaleString();
    } else if (unit === 'kWh') {
        return Math.round(value).toLocaleString();
    } else {
        return value.toFixed(2);
    }
}

// Toggle details expansion
function toggleDetails(row) {
    const details = row.nextElementSibling;
    const isExpanded = details.classList.contains('expanded');

    // Close all other expanded rows
    document.querySelectorAll('.details.expanded').forEach(d => {
        d.classList.remove('expanded');
        d.previousElementSibling.classList.remove('expanded');
    });

    if (!isExpanded) {
        details.classList.add('expanded');
        row.classList.add('expanded');
    }
}

// Toggle "More" button
function toggleMore(hiddenId, button) {
    const hiddenRows = document.getElementById(hiddenId);
    const isVisible = hiddenRows.classList.contains('visible');

    if (isVisible) {
        hiddenRows.classList.remove('visible');
        button.textContent = 'More ↓';
    } else {
        hiddenRows.classList.add('visible');
        button.textContent = 'Hide ↑';
    }
}

// ===== SPEED SCATTER PLOT =====

let selectedSpeedFilter = 'overall';

// Load all speed data for scatter plot
async function loadSpeedData() {
    console.log('Loading speed data for scatter plot...');

    try {
        // Fetch all speed records (no limit, we need all for scatter plot)
        const response = await fetch(`${SUPABASE_URL}/functions/v1/get-leaderboards`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify({
                token: token,
                type: 'speed',
                boat_type: 'all',
                min_length: 0,
                max_length: 999,
                limit: 500 // Get lots of data for scatter plot
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to fetch speed data');
        }

        const { data, currentDeviceUID: deviceUID } = result;
        if (!currentDeviceUID) currentDeviceUID = deviceUID;

        // Store all speed data
        allSpeedData = data.filter(entry =>
            entry.user_profiles &&
            entry.max_speed &&
            entry.user_profiles.boat_length &&
            entry.user_profiles.boat_type
        ).map(entry => ({
            name: entry.user_profiles.username,
            length: entry.user_profiles.boat_length,
            speed: entry.max_speed,
            type: entry.user_profiles.boat_type,
            make: entry.user_profiles.boat_make_model || '',
            homePort: entry.user_profiles.home_port || '',
            isUser: entry.device_uid === currentDeviceUID
        }));

        console.log(`Loaded ${allSpeedData.length} speed records`);

    } catch (error) {
        console.error('Error loading speed data:', error);
        allSpeedData = [];
    }
}

// Initialize speed chart
function initSpeedChart() {
    const canvas = document.getElementById('speedChart');
    if (!canvas) return;

    // Add radio button listeners
    document.querySelectorAll('input[name="speedFilter"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            selectedSpeedFilter = e.target.value;
            drawSpeedChart();
        });
    });

    // Draw initial chart
    drawSpeedChart();

    // Add interaction handlers
    setupSpeedChartInteractions();
}

// Draw speed scatter plot
// Draw speed scatter plot
function drawSpeedChart() {
    const canvas = document.getElementById('speedChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = { top: 20, right: 30, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Filter boats by selected type
    const boats = getFilteredBoats();

    // Adjust scales based on boat type
    let minLength = 5;
    let maxLength = 60;
    let minSpeed = 0;
    let maxSpeed = 28;

    if (selectedSpeedFilter === 'sailboat') {
        minLength = 20;
        maxLength = 55;
        minSpeed = 0;
        maxSpeed = 15;  // Sailboats top out around 12-15 knots typically
    } else if (selectedSpeedFilter === 'catamaran') {
        minLength = 30;
        maxLength = 60;
        minSpeed = 0;
        maxSpeed = 25;  // Performance cats can hit 20-25 knots
    } else if (selectedSpeedFilter === 'powerboat') {
        minLength = 20;
        maxLength = 70;
        minSpeed = 0;
        maxSpeed = 50;  // Powerboats can be very fast
    } else if (selectedSpeedFilter === 'trawler') {
        minLength = 30;
        maxLength = 60;
        minSpeed = 0;
        maxSpeed = 15;  // Trawlers are slow displacement hulls
    } else {
        // Overall - wide range
        minLength = 5;
        maxLength = 70;
        minSpeed = 0;
        maxSpeed = 30;
    }

    const scaleX = (length) => padding.left + ((length - minLength) / (maxLength - minLength)) * chartWidth;
    const scaleY = (speed) => height - padding.bottom - ((speed - minSpeed) / (maxSpeed - minSpeed)) * chartHeight;

    // Declare speedStep once here
    const speedStep = maxSpeed <= 15 ? 2.5 : 5;

    // Hull speed calculation: 1.34 * sqrt(LWL), assuming LWL ≈ 0.9 * LOA
    const hullSpeed = (length) => 1.34 * Math.sqrt(length * 0.9);

    // Calculate pareto front
    const paretoFront = calculateParetoFront(boats);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;

    // Vertical gridlines (every 10 ft)
    for (let l = 30; l <= 50; l += 10) {
        const x = scaleX(l);
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, height - padding.bottom);
        ctx.stroke();
    }

    // Horizontal gridlines
     speedStep = maxSpeed <= 15 ? 2.5 : 5;
    for (let s = speedStep; s <= maxSpeed; s += speedStep) {
        const y = scaleY(s);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Draw hull speed curve
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    for (let l = minLength; l <= maxLength; l += 0.5) {
        const x = scaleX(l);
        const y = scaleY(hullSpeed(l));
        if (l === minLength) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw axis labels
    ctx.fillStyle = '#666';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'center';

    // X-axis labels
    for (let l = 30; l <= 50; l += 10) {
        ctx.fillText(`${l}`, scaleX(l), height - padding.bottom + 20);
    }

    // Y-axis labels - adjust step based on range
     speedStep = maxSpeed <= 15 ? 2.5 : 5;
    for (let s = speedStep; s <= maxSpeed; s += speedStep) {
        ctx.fillText(`${Math.round(s)}`, padding.left - 10, scaleY(s));
    }

    // Axis titles
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#888';
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillText('Boat Length (LOA)', width / 2, height - 8);

    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('knots', 0, 0);
    ctx.restore();

    // Draw boats
    boats.filter(b => !b.isUser).forEach(boat => {
        const x = scaleX(boat.length);
        const y = scaleY(boat.speed);
        const isPareto = paretoFront.includes(boat);

        if (isPareto) {
            ctx.fillStyle = 'rgba(100, 100, 100, 0.4)';
            ctx.beginPath();
            ctx.arc(x, y, 4.5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = 'rgba(100, 100, 100, 0.2)';
            ctx.beginPath();
            ctx.arc(x, y, 3.5, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    // Draw user's boat on top
    const userBoat = boats.find(b => b.isUser);
    if (userBoat) {
        const x = scaleX(userBoat.length);
        const y = scaleY(userBoat.speed);

        ctx.shadowColor = 'rgba(0, 102, 204, 0.5)';
        ctx.shadowBlur = 12;

        ctx.fillStyle = '#0066cc';
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;

        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Get filtered boats based on selected type
function getFilteredBoats() {
    if (selectedSpeedFilter === 'overall') {
        return allSpeedData;
    }
    return allSpeedData.filter(b => b.type.toLowerCase() === selectedSpeedFilter || b.isUser);
}

// Calculate pareto front
function calculateParetoFront(boats) {
    const paretoBoats = [];
    const sortedBoats = [...boats].sort((a, b) => a.length - b.length);

    for (const boat of sortedBoats) {
        const isDominated = sortedBoats.some(other =>
            other.length <= boat.length && other.speed > boat.speed
        );
        if (!isDominated) {
            paretoBoats.push(boat);
        }
    }
    return paretoBoats;
}

// Setup speed chart interactions
function setupSpeedChartInteractions() {
    const canvas = document.getElementById('speedChart');
    const tooltip = document.getElementById('speedTooltip');
    let hoveredBoat = null;

    const width = canvas.width;
    const height = canvas.height;
    const padding = { top: 20, right: 30, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const minLength = 25;
    const maxLength = 55;
    const minSpeed = 0;
    const maxSpeed = 28;

    const scaleX = (length) => padding.left + ((length - minLength) / (maxLength - minLength)) * chartWidth;
    const scaleY = (speed) => height - padding.bottom - ((speed - minSpeed) / (maxSpeed - minSpeed)) * chartHeight;

    function getBoatAtPoint(x, y) {
        const boats = getFilteredBoats();
        const paretoFront = calculateParetoFront(boats);

        const canvasRect = canvas.getBoundingClientRect();
        const scaleFactorX = canvas.width / canvasRect.width;
        const scaleFactorY = canvas.height / canvasRect.height;
        const canvasX = (x - canvasRect.left) * scaleFactorX;
        const canvasY = (y - canvasRect.top) * scaleFactorY;

        // Check user's boat first
        const userBoat = boats.find(b => b.isUser);
        if (userBoat) {
            const bx = scaleX(userBoat.length);
            const by = scaleY(userBoat.speed);
            const dist = Math.sqrt((canvasX - bx) ** 2 + (canvasY - by) ** 2);
            if (dist < 12) return userBoat;
        }

        // Check pareto front boats
        for (const boat of paretoFront.filter(b => !b.isUser)) {
            const bx = scaleX(boat.length);
            const by = scaleY(boat.speed);
            const dist = Math.sqrt((canvasX - bx) ** 2 + (canvasY - by) ** 2);
            if (dist < 10) return boat;
        }

        return null;
    }

    function showTooltip(boat, x, y) {
        let content = `<strong>${boat.name}</strong><br>`;
        content += `${boat.length}ft • ${boat.speed} knots<br>`;
        if (boat.type) content += `${boat.type}`;
        if (boat.make) content += `<br>${boat.make}`;
        if (boat.homePort) content += `<br>${boat.homePort}`;

        tooltip.innerHTML = content;
        tooltip.style.left = `${x + 15}px`;
        tooltip.style.top = `${y - 10}px`;
        tooltip.classList.add('visible');
    }

    function hideTooltip() {
        tooltip.classList.remove('visible');
    }

    canvas.addEventListener('mousemove', (e) => {
        const boat = getBoatAtPoint(e.clientX, e.clientY);
        if (boat !== hoveredBoat) {
            hoveredBoat = boat;
            if (boat) {
                canvas.style.cursor = 'pointer';
                showTooltip(boat, e.clientX, e.clientY);
            } else {
                canvas.style.cursor = 'crosshair';
                hideTooltip();
            }
        } else if (boat) {
            tooltip.style.left = `${e.clientX + 15}px`;
            tooltip.style.top = `${e.clientY - 10}px`;
        }
    });

    canvas.addEventListener('mouseleave', () => {
        hoveredBoat = null;
        hideTooltip();
    });

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const boat = getBoatAtPoint(touch.clientX, touch.clientY);
        if (boat) {
            showTooltip(boat, touch.clientX, touch.clientY);
        }
    });

    canvas.addEventListener('touchend', () => {
        hideTooltip();
    });
}

// Initialize when page loads
window.addEventListener('DOMContentLoaded', init);
