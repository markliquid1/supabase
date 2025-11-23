// Supabase configuration
const SUPABASE_URL = 'https://qnbekuaoweuteylitzvo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuYmVrdWFvd2V1dGV5bGl0enZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5NzY1MzUsImV4cCI6MjA2NzU1MjUzNX0.k2S_kzkdAyN1Azs_7enxLun9LouB1bA_q7Sw8x1Cp0o';

let currentDeviceUID = null;
let token = null;

// Initialize on page load
async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    token = urlParams.get('token');

    if (!token) {
        document.querySelector('.container').innerHTML = '<div class="settings-card"><p style="color: #ff6b6b;">No authentication token provided</p></div>';
        return;
    }

    // Load all leaderboards
    await Promise.all([
        loadEnergyLeaderboard('alt_kwh_alltime', 'leaderboard-alt-wh-lifetime-body', 'kWh'),
        loadEnergyLeaderboard('solar_kwh_alltime', 'leaderboard-solar-wh-lifetime-body', 'kWh'),
        loadEnergyLeaderboard('max_alt_amps', 'leaderboard-max-alt-amps-body', 'A'),
        loadSpeedLeaderboards()
    ]);
}

// Load energy production leaderboards
async function loadEnergyLeaderboard(column, tbodyId, unit) {
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/get-leaderboards`, {
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

        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        const { data, currentDeviceUID: deviceUID } = result;
        if (!currentDeviceUID) currentDeviceUID = deviceUID;

        const tbody = document.getElementById(tbodyId);
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #999;">No data available</td></tr>';
            return;
        }

        tbody.innerHTML = data.map((entry, index) => {
            const isCurrentUser = entry.device_uid === currentDeviceUID;
            const value = entry[column].toFixed(unit === 'A' ? 1 : 2);
            
            return `
                <tr style="${isCurrentUser ? 'background-color: #e3f2fd; font-weight: bold;' : ''}">
                    <td style="padding: 8px;">${index + 1}</td>
                    <td style="padding: 8px;">${entry.user_profiles.username}</td>
                    <td style="padding: 8px;">${entry.user_profiles.boat_name}</td>
                    <td style="padding: 8px;">${entry.user_profiles.boat_type}</td>
                    <td style="padding: 8px;">${entry.user_profiles.boat_length} ft</td>
                    <td style="padding: 8px; text-align: right;">${value} ${unit}</td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error(`Error loading leaderboard:`, error);
        document.getElementById(tbodyId).innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #ff6b6b;">Error loading data</td></tr>';
    }
}

// Load speed leaderboards by boat type and size
async function loadSpeedLeaderboards() {
    const categories = [
        { id: 'overall', minLength: 0, maxLength: 999 },
        { id: 'under30', minLength: 0, maxLength: 29 },
        { id: '30-40', minLength: 30, maxLength: 40 },
        { id: '40-50', minLength: 40, maxLength: 50 },
        { id: 'over50', minLength: 50, maxLength: 999 }
    ];

    const boatTypes = ['Sailboat', 'Catamaran', 'Powerboat', 'Trawler'];

    for (const category of categories) {
        const tbody = document.getElementById(`leaderboard-speed-${category.id}`);
        let rows = '';

        for (let rank = 1; rank <= 5; rank++) {
            let rowHtml = '<tr>';
            
            for (const boatType of boatTypes) {
                const entry = await getSpeedEntry(boatType, category.minLength, category.maxLength, rank);
                rowHtml += `<td style="padding: 8px; border-right: 1px solid #eee;"><div class="speed-entry">${entry}</div></td>`;
            }
            
            rowHtml += '</tr>';
            rows += rowHtml;
        }

        tbody.innerHTML = rows;
    }
}

// Get a single speed entry for a specific boat type, size, and rank
async function getSpeedEntry(boatType, minLength, maxLength, rank) {
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/get-leaderboards`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify({
                token: token,
                type: 'speed',
                boat_type: boatType,
                min_length: minLength,
                max_length: maxLength,
                limit: rank
            })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        const { data, currentDeviceUID: deviceUID } = result;
        if (!currentDeviceUID) currentDeviceUID = deviceUID;

        if (!data || data.length < rank) return '---';

        const entry = data[rank - 1];
        const profile = entry.user_profiles;
        if (!profile) return '---';

        const isCurrentUser = entry.device_uid === currentDeviceUID;
        const style = isCurrentUser ? 'style="color: #00a19a; font-weight: bold;"' : '';

        return `
            <div ${style}>
                <strong>${entry.max_speed.toFixed(1)} kts</strong><br>
                <small>${profile.username}</small><br>
                <small style="color: #999;">${profile.boat_name} (${profile.boat_length} ft)</small>
            </div>
        `;
    } catch (error) {
        console.error(`Error loading speed entry:`, error);
        return '---';
    }
}

// Initialize when page loads
window.addEventListener('DOMContentLoaded', init);