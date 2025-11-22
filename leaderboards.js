// Supabase configuration
const SUPABASE_URL = 'https://qnbekuaoweuteylitzvo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuYmVrdWFvd2V1dGV5bGl0enZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5NzY1MzUsImV4cCI6MjA2NzU1MjUzNX0.k2S_kzkdAyN1Azs_7enxLun9LouB1bA_q7Sw8x1Cp0o';

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
                user_id,
                ${column}
            `)
            .order(column, { ascending: false })
            .limit(10);

        if (error) throw error;
        
        // Get user profiles separately
        if (data && data.length > 0) {
            const userIds = data.map(d => d.user_id);
            const { data: profiles, error: profileError } = await supabase
                .from('user_profiles')
                .select('user_id, username, boat_name, boat_type, boat_length')
                .in('user_id', userIds);
            
            if (profileError) throw profileError;
            
            // Merge profiles into data
            data.forEach(entry => {
                const profile = profiles.find(p => p.user_id === entry.user_id);
                if (profile) {
                    entry.user_profiles = profile;
                }
            });
        }

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
        // First get matching user profiles
        const { data: profiles, error: profileError } = await supabase
            .from('user_profiles')
            .select('user_id, username, boat_name, boat_type, boat_length')
            .eq('boat_type', boatType)
            .gte('boat_length', minLength)
            .lte('boat_length', maxLength);

        if (profileError) throw profileError;
        if (!profiles || profiles.length === 0) return '---';

        const userIds = profiles.map(p => p.user_id);

        // Then get device stats for those users
        const { data, error } = await supabase
            .from('device_statistics')
            .select('device_uid, user_id, max_speed')
            .in('user_id', userIds)
            .order('max_speed', { ascending: false })
            .limit(rank);

        if (error) throw error;
        if (!data || data.length < rank) return '---';

        const entry = data[rank - 1];
        const profile = profiles.find(p => p.user_id === entry.user_id);
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
        console.error(`Error loading speed entry for ${boatType}:`, error);
        return '---';
    }
}

// Initialize when page loads
window.addEventListener('DOMContentLoaded', init);