const mqttConfig = {
    broker: 'wss://broker.emqx.io:8084/mqtt',
    // Subscribe ke masing-masing topik RT
    topics: ['husnayan/rt1/data', 'husnayan/rt2/data'] 
};

let historyData = [];
let messageCount = 0;
let tempChart, gasChart;
let timeLabels = [];
let tempData = { rt1: [], rt2: [], rt3: [] };
let gasData = { rt1: [], rt2: [], rt3: [] };

let lastData = {
    rt1: { t: null, g: null, l: null },
    rt2: { t: null, g: null, l: null },
    rt3: { t: null, g: null, l: null }
};

function addToHistory(rt, type, value) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    const dateStr = now.toLocaleDateString();
    
    historyData.push({ date: dateStr, time: timeStr, rt: rt, type: type, value: value });

    const body = document.getElementById('historyBody');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${timeStr}</td>
        <td><span class="badge bg-secondary">RT ${rt}</span></td>
        <td>${type}</td>
        <td class="fw-bold">${value}</td>
    `;
    body.insertBefore(row, body.firstChild);
    if (body.children.length > 50) body.removeChild(body.lastChild);
}

function downloadCSV() {
    if (historyData.length === 0) return alert("Belum ada data rekaman!");
    let csv = "\uFEFFTanggal,Waktu,Sumber,Tipe,Nilai\n";
    historyData.forEach(d => { csv += `${d.date},${d.time},RT ${d.rt},${d.type},"${d.value}"\n`; });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = window.URL.createObjectURL(blob);
    a.download = `Log_MQTT_RT_Monitoring_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
}

function updateDisplay(id, val, isTemp) {
    const el = document.getElementById(id);
    el.textContent = isTemp ? `${parseFloat(val).toFixed(2)}°C` : parseFloat(val).toFixed(2);
}

function updateLED(id, status) {
    const ind = document.getElementById(`ledIndicator${id}`);
    const txt = document.getElementById(`ledStatus${id}`);
    const isOn = status === "1" || status === 1 || status.toString().toUpperCase() === "ON";
    ind.className = isOn ? 'led-indicator led-on' : 'led-indicator led-off';
    txt.textContent = isOn ? 'ON' : 'OFF';
    txt.style.color = isOn ? '#2ecc71' : '#95a5a6';
}

function connectMQTT() {
    const client = mqtt.connect(mqttConfig.broker, { clientId: 'web_monitor_' + Math.random().toString(16).substr(2, 8) });

    client.on('connect', () => {
        document.getElementById('statusDot').className = 'status-dot connected';
        document.getElementById('connectionText').textContent = 'TERHUBUNG KE MAIN.CPP';
        mqttConfig.topics.forEach(t => client.subscribe(t));
    });

    client.on('message', (topic, payload) => {
        try {
            const data = JSON.parse(payload.toString());
            
            messageCount++;
            document.getElementById('messageCount').textContent = messageCount;
            document.getElementById('lastUpdateTime').textContent = new Date().toLocaleTimeString();

            // Rute data berdasarkan topik alat mana yang mengirim
            if (topic === 'husnayan/rt1/data') {
                updateDisplay('temp1', data.temperature, true);
                updateDisplay('gas1', data.gas, false);
                updateLED(1, data.led);
                if(data.temperature !== lastData.rt1.t) { addToHistory(1, "Suhu", data.temperature + "°C"); lastData.rt1.t = data.temperature; }
                if(data.gas !== lastData.rt1.g) { addToHistory(1, "Gas", data.gas); lastData.rt1.g = data.gas; }
                if(data.led !== lastData.rt1.l) { addToHistory(1, "LED", data.led); lastData.rt1.l = data.led; }
            } 
            else if (topic === 'husnayan/rt2/data') {
                updateDisplay('temp2', data.temperature, true);
                updateDisplay('gas2', data.gas, false);
                updateLED(2, data.led);
                if(data.temperature !== lastData.rt2.t) { addToHistory(2, "Suhu", data.temperature + "°C"); lastData.rt2.t = data.temperature; }
                if(data.gas !== lastData.rt2.g) { addToHistory(2, "Gas", data.gas); lastData.rt2.g = data.gas; }
                if(data.led !== lastData.rt2.l) { addToHistory(2, "LED", data.led); lastData.rt2.l = data.led; }
            }

            updateChartsData();
        } catch (e) {
            console.error("Format payload tidak valid (Bukan JSON):", e);
        }
    });
}

function initCharts() {
    const opt = (title) => ({ responsive: true, plugins: { title: { display: true, text: title }}});
    tempChart = new Chart(document.getElementById('tempChart'), {
        type: 'line',
        data: { labels: timeLabels, datasets: [
            { label: 'RT 1', data: tempData.rt1, borderColor: '#e74c3c', tension: 0.3, fill: false },
            { label: 'RT 2', data: tempData.rt2, borderColor: '#2ecc71', tension: 0.3, fill: false },
            { label: 'RT 3', data: tempData.rt3, borderColor: '#f39c12', tension: 0.3, fill: false }
        ]},
        options: opt('Monitoring Suhu (°C)')
    });
    gasChart = new Chart(document.getElementById('gasChart'), {
        type: 'line',
        data: { labels: timeLabels, datasets: [
            { label: 'RT 1', data: gasData.rt1, borderColor: '#9b59b6', tension: 0.3, fill: false },
            { label: 'RT 2', data: gasData.rt2, borderColor: '#1abc9c', tension: 0.3, fill: false },
            { label: 'RT 3', data: gasData.rt3, borderColor: '#34495e', tension: 0.3, fill: false }
        ]},
        options: opt('Level Deteksi Gas (%)')
    });
}

function updateChartsData() {
    const now = new Date().toLocaleTimeString();
    if (timeLabels.length > 15) {
        timeLabels.shift();
        tempData.rt1.shift(); tempData.rt2.shift(); tempData.rt3.shift();
        gasData.rt1.shift(); gasData.rt2.shift(); gasData.rt3.shift();
    }
    
    // Pastikan label waktu tidak duplikat jika 2 perangkat ngirim di detik yang sama
    if (timeLabels[timeLabels.length - 1] !== now) {
        timeLabels.push(now);
    } else {
        // Timpa data chart terakhir (pop lalu push yang baru diparsing DOM)
        tempData.rt1.pop(); tempData.rt2.pop(); tempData.rt3.pop();
        gasData.rt1.pop(); gasData.rt2.pop(); gasData.rt3.pop();
    }
    
    tempData.rt1.push(parseFloat(document.getElementById('temp1').innerText) || 0);
    tempData.rt2.push(parseFloat(document.getElementById('temp2').innerText) || 0);
    tempData.rt3.push(parseFloat(document.getElementById('temp3').innerText) || 0);
    
    gasData.rt1.push(parseFloat(document.getElementById('gas1').innerText) || 0);
    gasData.rt2.push(parseFloat(document.getElementById('gas2').innerText) || 0);
    gasData.rt3.push(parseFloat(document.getElementById('gas3').innerText) || 0);
    
    tempChart.update('none');
    gasChart.update('none');
}

document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    connectMQTT();
});
