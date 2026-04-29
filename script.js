const mqttConfig = {
    broker: 'wss://broker.emqx.io:8084/mqtt',
    topics: ['adcd', 'efgh', 'ijkl', 'panasdek', 'meledakdek', 'menyaladek', 'panasmasputra', 'meledakduar', 'menyalaabangku']
};

let historyData = [];
let messageCount = 0;
let tempChart, gasChart;
let timeLabels = [];
let tempData = { rt1: [], rt2: [], rt3: [] };
let gasData = { rt1: [], rt2: [], rt3: [] };

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
    historyData.forEach(d => {
        csv += `${d.date},${d.time},RT ${d.rt},${d.type},"${d.value}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Log_MQTT_RT_Monitoring_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
}

function updateDisplay(id, val, isTemp) {
    const el = document.getElementById(id);
    el.textContent = isTemp ? `${parseFloat(val).toFixed(2)}°C` : val;
}

function updateLED(id, status) {
    const ind = document.getElementById(`ledIndicator${id}`);
    const txt = document.getElementById(`ledStatus${id}`);
    const isOn = status == "1" || status.toUpperCase() == "ON";
    ind.className = isOn ? 'led-indicator led-on' : 'led-indicator led-off';
    txt.textContent = isOn ? 'ON' : 'OFF';
    txt.style.color = isOn ? '#2ecc71' : '#95a5a6';
}

function connectMQTT() {
    const client = mqtt.connect(mqttConfig.broker, { clientId: 'web_monitor_' + Math.random().toString(16).substr(2, 8) });

    client.on('connect', () => {
        document.getElementById('statusDot').className = 'status-dot connected';
        document.getElementById('connectionText').textContent = 'TERHUBUNG';
        mqttConfig.topics.forEach(t => client.subscribe(t));
    });

    client.on('message', (topic, payload) => {
        const msg = payload.toString();
        messageCount++;
        document.getElementById('messageCount').textContent = messageCount;
        document.getElementById('lastUpdateTime').textContent = new Date().toLocaleTimeString();

        switch(topic) {
            case 'adcd': updateDisplay('temp1', msg, true); addToHistory(1, "Suhu", msg + "°C"); break;
            case 'efgh': updateDisplay('gas1', msg, false); addToHistory(1, "Gas", msg); break;
            case 'ijkl': updateLED(1, msg); addToHistory(1, "LED", msg == "1" ? "ON" : "OFF"); break;
            
            case 'panasdek': updateDisplay('temp2', msg, true); addToHistory(2, "Suhu", msg + "°C"); break;
            case 'meledakdek': updateDisplay('gas2', msg, false); addToHistory(2, "Gas", msg); break;
            case 'menyaladek': updateLED(2, msg); addToHistory(2, "LED", msg == "1" ? "ON" : "OFF"); break;

            case 'panasmasputra': updateDisplay('temp3', msg, true); addToHistory(3, "Suhu", msg + "°C"); break;
            case 'meledakduar': updateDisplay('gas3', msg, false); addToHistory(3, "Gas", msg); break;
            case 'menyalaabangku': updateLED(3, msg); addToHistory(3, "LED", msg == "1" ? "ON" : "OFF"); break;
        }
        updateChartsData();
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
        options: opt('Level Deteksi Gas')
    });
}

function updateChartsData() {
    const now = new Date().toLocaleTimeString();
    if (timeLabels.length > 15) {
        timeLabels.shift();
        tempData.rt1.shift(); tempData.rt2.shift(); tempData.rt3.shift();
        gasData.rt1.shift(); gasData.rt2.shift(); gasData.rt3.shift();
    }
    timeLabels.push(now);
    tempData.rt1.push(parseFloat(document.getElementById('temp1').innerText) || 0);
    tempData.rt2.push(parseFloat(document.getElementById('temp2').innerText) || 0);
    tempData.rt3.push(parseFloat(document.getElementById('temp3').innerText) || 0);
    gasData.rt1.push(parseInt(document.getElementById('gas1').innerText) || 0);
    gasData.rt2.push(parseInt(document.getElementById('gas2').innerText) || 0);
    gasData.rt3.push(parseInt(document.getElementById('gas3').innerText) || 0);
    tempChart.update('none');
    gasChart.update('none');
}

document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    connectMQTT();
});