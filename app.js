let data = {
    periodStarts: [],     // array of YYYY-MM-DD strings (sorted)
    symptoms: {}          // optional: date -> array of symptoms (for future)
};

const STORAGE_KEY = 'sykli_data';

// Format date to Finnish dd.mm.yyyy
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

// Load data from localStorage
function loadData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        data = JSON.parse(saved);
        // Ensure sorted
        data.periodStarts.sort();
    }
}

// Save data
function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Calculate current cycle info
function getCycleInfo() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (data.periodStarts.length === 0) {
        return { hasData: false };
    }

    const lastStartStr = data.periodStarts[data.periodStarts.length - 1];
    const lastStart = new Date(lastStartStr);
    
    // Days since last period start
    const diffTime = today - lastStart;
    const cycleDay = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // Calculate average cycle length (if we have at least 2 periods)
    let avgLength = 28;
    if (data.periodStarts.length > 1) {
        let totalDays = 0;
        for (let i = 1; i < data.periodStarts.length; i++) {
            const prev = new Date(data.periodStarts[i - 1]);
            const curr = new Date(data.periodStarts[i]);
            totalDays += Math.floor((curr - prev) / (1000 * 60 * 60 * 24));
        }
        avgLength = Math.round(totalDays / (data.periodStarts.length - 1));
    }

    // Predict next period
    const predictedNext = new Date(lastStart);
    predictedNext.setDate(predictedNext.getDate() + avgLength);
    
    const daysToNext = Math.floor((predictedNext - today) / (1000 * 60 * 60 * 24));

    return {
        hasData: true,
        cycleDay,
        avgLength,
        daysToNext,
        nextStartStr: predictedNext.toISOString().split('T')[0],
        lastStartStr
    };
}

// Render the entire dashboard
function renderDashboard() {
    const info = getCycleInfo();
    const currentDateEl = document.getElementById('current-date');
    
    // Set today's date in header
    const today = new Date();
    currentDateEl.textContent = `${today.getDate()}.${today.getMonth() + 1}.${today.getFullYear()}`;

    // Status card
    const statusContainer = document.getElementById('cycle-status');
    if (!info.hasData) {
        statusContainer.innerHTML = `
            <p style="font-size: 1.3rem; color: #888; text-align: center; padding: 20px 0;">
                Tervetuloa Sykliin!<br>
                Merkitse ensimmäiset kuukautisesi aloituspäivä aloittaaksesi seurannan.
            </p>
            <button onclick="showLogModal()" class="btn-primary">Aloita seuranta nyt</button>
        `;
        document.getElementById('prediction-text').textContent = '—';
        document.getElementById('avg-length').textContent = '—';
        document.getElementById('history-list').innerHTML = '<li style="color:#888;text-align:center;padding:20px;">Ei vielä kiertoja</li>';
        return;
    }

    // Has data – show cycle status
    let phaseText = '';
    if (info.cycleDay <= 5) phaseText = 'Kuukautiset';
    else if (info.cycleDay <= 14) phaseText = 'Follikulaarivaihe';
    else if (info.cycleDay <= 21) phaseText = 'Hedelmällisyysikkuna';
    else phaseText = 'Luteaalivaihe';

    statusContainer.innerHTML = `
        <div style="text-align:center;">
            <span class="status-big">Päivä ${info.cycleDay}</span>
            <div class="phase">${phaseText}</div>
            <p style="margin-top: 12px; color: #6b4e4e;">Viimeinen aloitus: ${formatDate(info.lastStartStr)}</p>
        </div>
    `;

    // Prediction
    const predictionEl = document.getElementById('prediction-text');
    const subEl = document.getElementById('avg-length');
    subEl.textContent = info.avgLength;

    if (info.daysToNext > 0) {
        predictionEl.innerHTML = `${info.daysToNext} päivän päästä`;
        document.getElementById('prediction-sub').innerHTML = `Ennustettu: ${formatDate(info.nextStartStr)}`;
    } else if (info.daysToNext === 0) {
        predictionEl.innerHTML = `TÄNÄÄN! 🌙`;
    } else {
        predictionEl.innerHTML = `Myöhässä (${Math.abs(info.daysToNext)} pv)`;
    }

    // History
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';

    if (data.periodStarts.length < 2) {
        historyList.innerHTML = '<li style="color:#888;text-align:center;padding:20px;">Tarvitset vähintään kaksi kiertoa keskiarvon laskemiseen</li>';
    } else {
        for (let i = data.periodStarts.length - 1; i >= 1; i--) {
            const curr = new Date(data.periodStarts[i]);
            const prev = new Date(data.periodStarts[i - 1]);
            const length = Math.floor((curr - prev) / (1000 * 60 * 60 * 24));
            
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${formatDate(data.periodStarts[i - 1])} – ${formatDate(data.periodStarts[i])}</span>
                <span style="font-weight:600;color:#d46a4f;">${length} pv</span>
            `;
            historyList.appendChild(li);
        }
    }
}

// Show log modal
function showLogModal() {
    const modal = document.getElementById('log-modal');
    const dateInput = document.getElementById('period-start-date');
    
    // Default to today
    const todayStr = new Date().toISOString().split('T')[0];
    dateInput.value = todayStr;
    
    modal.style.display = 'flex';
}

// Hide modal
function hideLogModal() {
    document.getElementById('log-modal').style.display = 'none';
}

// Save new period start
function savePeriodStart() {
    const dateInput = document.getElementById('period-start-date').value;
    
    if (!dateInput) {
        alert('Valitse päivä!');
        return;
    }
    
    // Don't allow future dates
    if (new Date(dateInput) > new Date()) {
        alert('Tulevaisuuden päivää ei voi merkitä.');
        return;
    }
    
    // Prevent duplicate same-day entry
    if (data.periodStarts.includes(dateInput)) {
        alert('Tämä päivä on jo merkitty kuukautisten aloitukseksi.');
        hideLogModal();
        return;
    }
    
    data.periodStarts.push(dateInput);
    data.periodStarts.sort();
    saveData();
    hideLogModal();
    renderDashboard();
    
    // Small feedback
    const msg = document.createElement('div');
    msg.textContent = '✅ Tallennettu!';
    msg.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#d46a4f;color:white;padding:12px 24px;border-radius:9999px;font-weight:600;box-shadow:0 10px 20px rgba(0,0,0,0.2);';
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 2200);
}

// Quick symptom log (just console + visual feedback for now – easy to extend)
function quickLogSymptom(symptom) {
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (!data.symptoms[todayStr]) data.symptoms[todayStr] = [];
    if (!data.symptoms[todayStr].includes(symptom)) {
        data.symptoms[todayStr].push(symptom);
        saveData();
    }
    
    // Visual feedback
    const btns = document.querySelectorAll('.btn-secondary');
    btns.forEach(b => {
        if (b.textContent.includes(symptom)) {
            const originalText = b.textContent;
            b.style.transition = 'all 0.3s';
            b.textContent = '✅ ' + originalText;
            setTimeout(() => {
                b.textContent = originalText;
            }, 1200);
        }
    });
    
    console.log(`[Sykli] Symptom logged: ${symptom} on ${todayStr}`);
}

// Tab switching (future-proof – other tabs can be added easily)
function switchTab(tabIndex) {
    // For now only dashboard is implemented
    if (tabIndex === 0) {
        // Already on dashboard
        return;
    }
    
    const messages = [
        '', // home
        'Kirjaa-sivu tulossa pian – voit laajentaa app.js:ää!',
        'Kalenteri-näkymä tulossa pian!',
        'Asetukset (yksityisyys, vienti jne.) tulossa pian!'
    ];
    
    alert(messages[tabIndex]);
}

// Service Worker registration + initial render
async function initApp() {
    loadData();
    renderDashboard();
    
    // Register service worker for offline PWA
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('sw.js');
            console.log('✅ Sykli Service Worker rekisteröity', registration.scope);
        } catch (err) {
            console.log('Service Worker rekisteröinti epäonnistui:', err);
        }
    }
    
    // Optional: listen for appinstalled
    window.addEventListener('appinstalled', () => {
        console.log('🎉 Sykli asennettu onnistuneesti!');
    });
}

// Start the app
window.addEventListener('load', initApp);
