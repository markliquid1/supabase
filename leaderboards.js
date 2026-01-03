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

// Load energy production leaderboards with top 5 + user's actual rank
async function loadEnergyLeaderboard(column, tbodyId, unit) {
    try {
        // Fetch top 5
        const top5Response = await fetch(`${SUPABASE_URL}/functions/v1/get-leaderboards`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify({
                token: token,
                type: 'energy',
                column: column,
                limit: 5
            })
        });

        const top5Result = await top5Response.json();
        if (!top5Response.ok) throw new Error(top5Result.error);

        const { data: top5Data, currentDeviceUID: deviceUID } = top5Result;
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
        if (!userRankResponse.ok) throw new Error(userRankResult.error);

        const { rank: userRank, entry: userEntry } = userRankResult;

        const tbody = document.getElementById(tbodyId);
        if (!top5Data || top5Data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #999;">No data available</td></tr>';
            return;
        }

        // Check if user is in top 5
        const userInTop5 = top5Data.some(entry => entry.device_uid === currentDeviceUID);

        let html = '';

        // Render top 5
        html += top5Data
            .filter(entry => entry.user_profiles)
            .map((entry, index) => {
                const isCurrentUser = entry.device_uid === currentDeviceUID;
                const value = entry[column].toFixed(unit === 'A' ? 1 : 2);

                return `
                <tr style="${isCurrentUser ? 'background-color: #e3f2fd; font-weight: bold;' : ''}">
                    <td style="padding: 8px;">${index + 1}</td>
                    <td style="padding: 8px;">${entry.user_profiles.username}</td>
                    <td style="padding: 8px;">${entry.user_profiles.boat_type}</td>
                    <td style="padding: 8px;">${entry.user_profiles.boat_length} ft</td>
                    <td style="padding: 8px; text-align: right;">${value} ${unit}</td>
                </tr>
            `;
            }).join('');

        // Add user's row if not in top 5
        if (!userInTop5 && userEntry && userEntry.user_profiles) {
            const value = userEntry[column].toFixed(unit === 'A' ? 1 : 2);
            html += `
                <tr style="background-color: #e3f2fd; font-weight: bold; border-top: 2px solid #90caf9;">
                    <td style="padding: 8px;">${userRank} ★</td>
                    <td style="padding: 8px;">${userEntry.user_profiles.username}</td>
                    <td style="padding: 8px;">${userEntry.user_profiles.boat_type}</td>
                    <td style="padding: 8px;">${userEntry.user_profiles.boat_length} ft</td>
                    <td style="padding: 8px; text-align: right;">${value} ${unit}</td>
                </tr>
            `;
        }

        tbody.innerHTML = html;
    } catch (error) {
        console.error(`Error loading leaderboard:`, error);
        document.getElementById(tbodyId).innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #ff6b6b;">Error loading data</td></tr>';
    }
}

// Load speed leaderboards by boat type and size
async function loadSpeedLeaderboards() {
    const categories = [
        { id: 'overall', minLength: 0, maxLength: 999 },
        { id: 'under30', minLength: 0, maxLength: 30 },
        { id: 'under40', minLength: 0, maxLength: 40 },
        { id: 'under50', minLength: 0, maxLength: 50 },
        { id: 'under60', minLength: 0, maxLength: 60 }
    ];

    const boatTypes = ['sailboat', 'catamaran', 'powerboat', 'trawler', 'other'];

    // Fetch all data at once (5 categories × 5 boat types = 25 calls)
    const allPromises = [];
    for (const category of categories) {
        for (const boatType of boatTypes) {
            allPromises.push(
                fetch(`${SUPABASE_URL}/functions/v1/get-leaderboards`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_ANON_KEY
                    },
                    body: JSON.stringify({
                        token: token,
                        type: 'speed',
                        boat_type: boatType,
                        min_length: category.minLength,
                        max_length: category.maxLength,
                        limit: 5
                    })
                }).then(r => r.json()).then(result => ({
                    categoryId: category.id,
                    boatType: boatType,
                    data: result.data || []
                }))
            );
        }
    }

    // Fetch user ranks for each category/boat type combination
    for (const category of categories) {
        for (const boatType of boatTypes) {
            allPromises.push(
                fetch(`${SUPABASE_URL}/functions/v1/get-user-rank`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_ANON_KEY
                    },
                    body: JSON.stringify({
                        token: token,
                        type: 'speed',
                        boat_type: boatType,
                        min_length: category.minLength,
                        max_length: category.maxLength
                    })
                }).then(r => r.json()).then(result => ({
                    categoryId: category.id,
                    boatType: boatType,
                    rank: result.rank,
                    entry: result.entry,
                    isRankData: true
                }))
            );
        }
    }

    // Wait for all requests to complete in parallel
    const allResults = await Promise.all(allPromises);

    // Separate leaderboard data from rank data
    const leaderboardData = allResults.filter(r => !r.isRankData);
    const rankData = allResults.filter(r => r.isRankData);

    // Build tables from results
    for (const category of categories) {
        const tbody = document.getElementById(`leaderboard-speed-${category.id}`);
        let rows = '';

        for (let rank = 1; rank <= 5; rank++) {
            let rowHtml = '<tr>';

            for (const boatType of boatTypes) {
                const resultData = leaderboardData.find(r => r.categoryId === category.id && r.boatType === boatType);
                const userRankData = rankData.find(r => r.categoryId === category.id && r.boatType === boatType);
                
                const entries = resultData ? resultData.data : [];
                const entry = entries[rank - 1];

                if (!entry || !entry.user_profiles) {
                    rowHtml += `<td style="padding: 8px; border-right: 1px solid #eee;"><div class="speed-entry">---</div></td>`;
                } else {
                    const isCurrentUser = entry.device_uid === currentDeviceUID;
                    const style = isCurrentUser ? 'style="color: #00a19a; font-weight: bold;"' : '';
                    rowHtml += `<td style="padding: 8px; border-right: 1px solid #eee;"><div class="speed-entry" ${style}>
                    <strong>${entry.max_speed.toFixed(1)} kts</strong><br>
                    <small>${entry.user_profiles.username} (${entry.user_profiles.boat_length} ft)</small>
                </div></td>`;
                }
            }

            rowHtml += '</tr>';
            rows += rowHtml;
        }

        // Add user row for each boat type if not in top 5
        let userRowHtml = '<tr style="border-top: 2px solid #90caf9;">';
        for (const boatType of boatTypes) {
            const userRankData = rankData.find(r => r.categoryId === category.id && r.boatType === boatType);
            const leaderboardEntries = leaderboardData.find(r => r.categoryId === category.id && r.boatType === boatType);
            
            const userInTop5 = leaderboardEntries?.data?.some(e => e.device_uid === currentDeviceUID);
            
            if (!userInTop5 && userRankData?.entry && userRankData.entry.user_profiles) {
                const entry = userRankData.entry;
                userRowHtml += `<td style="padding: 8px; border-right: 1px solid #eee;"><div class="speed-entry" style="color: #00a19a; font-weight: bold;">
                    <strong>#${userRankData.rank}: ${entry.max_speed.toFixed(1)} kts</strong><br>
                    <small>${entry.user_profiles.username} (${entry.user_profiles.boat_length} ft)</small>
                </div></td>`;
            } else {
                userRowHtml += `<td style="padding: 8px; border-right: 1px solid #eee;"></td>`;
            }
        }
        userRowHtml += '</tr>';

        // Only add user row if at least one cell has content
        if (!userRowHtml.includes('></td>'.repeat(5))) {
            rows += userRowHtml;
        }

        tbody.innerHTML = rows;
    }
}

// Initialize when page loads
window.addEventListener('DOMContentLoaded', init);
