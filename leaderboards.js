// Supabase configuration
const SUPABASE_URL = 'https://nbuyfpclfguvqmbgrnny.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5idXlmcGNsZmd1dnFtYmdybm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU0NzI0ODMsImV4cCI6MjA1MTA0ODQ4M30.s4hqBmqZmCe4rw3P8OU7nYy9SDIL7rl9_hgMPTpMLrc';

let supabase;
let currentDeviceUID = null;

// Initialize on page load
async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        document.querySelector('.container').innerHTML = '<div class="settings-card"><p style="color: #ff6b6b;">No authentication token provided</p></div>';
        return;
    }

    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Get current device UID from token
    try {
        const { data, error } = await supabase
            .from('devices')
            .select('device_uid')
            .eq('auth_token', token)
            .single();

        if (error) throw error;
        currentDeviceUID = data.device_uid;
    } catch (error) {
        console.error('Error getting device UID:', error);
    }

    // Load all leaderboards
    await Promise.all([
        loadEnergyLeaderboard('alt', 'alt_kwh_alltime', 'leaderboard-alt-wh-lifetime-body'),
        loadEnergyLeaderboard('solar', 'solar_kwh_alltime', 'leaderboard-solar-wh-lifetime-body'),
        loadEnergyLeaderboard('amps', 'max_alt_amps', 'leaderboard-max-alt-amps-body'),
        loadSpeedLeaderboards()
    ]);
}

// Load energy production leaderboards
async function loadEnergyLeaderboard(type, column, tbodyId) {
    try {
        const { data, error } = await supabase
            .from('device_statistics')
            .select(`
                device_uid,
                ${column},
                user_profiles!inner(username, boat_name, boat_type, boat_length)
            `)
            .order(column, { ascending: false })
            .limit(10);

        if (error) throw error;

        const tbody = document.getElementById(tbodyId);
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #999;">No data available</td></tr>';
            return;
        }

        tbody.innerHTML = data.map((entry, index) => {
            const isCurrentUser = entry.device_uid === currentDeviceUID;
            const value = type === 'amps' 
                ? entry[column].toFixed(1) 
                : entry[column].toFixed(2);
            const unit = type === 'amps' ? 'A' : 'kWh';
            
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
        console.error(`Error loading ${type} leaderboard:`, error);
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
        const { data, error } = await supabase
            .from('device_statistics')
            .select(`
                device_uid,
                max_speed,
                user_profiles!inner(username, boat_name, boat_type, boat_length)
            `)
            .eq('user_profiles.boat_type', boatType)
            .gte('user_profiles.boat_length', minLength)
            .lte('user_profiles.boat_length', maxLength)
            .order('max_speed', { ascending: false })
            .limit(rank);

        if (error) throw error;
        if (!data || data.length < rank) return '---';

        const entry = data[rank - 1];
        const isCurrentUser = entry.device_uid === currentDeviceUID;
        const style = isCurrentUser ? 'style="color: #00a19a; font-weight: bold;"' : '';

        return `
            <div ${style}>
                <strong>${entry.max_speed.toFixed(1)} kts</strong><br>
                <small>${entry.user_profiles.username}</small><br>
                <small style="color: #999;">${entry.user_profiles.boat_name} (${entry.user_profiles.boat_length} ft)</small>
            </div>
        `;
    } catch (error) {
        console.error(`Error loading speed entry for ${boatType}:`, error);
        return '---';
    }
}

// Initialize when page loads
window.addEventListener('DOMContentLoaded', init);
