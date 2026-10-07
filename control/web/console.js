const $ = id => document.getElementById(id);
const terminal = new Set(['verified', 'failed', 'interrupted']);
const states = {queued: '指令已入队', sent: '正在下发', acknowledged: '设备已应答，正在读回', verified: '读回一致', failed: '执行失败', interrupted: '执行中断'};
const qualities = {good: '正常', bad: '通信异常', stale: '数据过期', unavailable: '未采集'};
let metadata, telemetry, eventCursor = 0, pending = false, apiConnected = false;
const time = timestamp => timestamp ? new Date(timestamp * 1000).toLocaleTimeString('zh-CN', {hour12: false}) : '—';
const format = value => Number.isFinite(value) ? new Intl.NumberFormat('zh-CN', {maximumFractionDigits: 3}).format(value) : '—';

async function request(path, options = {}) {
  const response = await fetch(path, {...options, signal: AbortSignal.timeout(6000)});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `服务响应 ${response.status}`);
  return data;
}
function option(value, label) {
  const node = document.createElement('option'); node.value = value; node.textContent = label; return node;
}
function selectedDevice() { return metadata?.devices[$('device').value]; }
function updateControls() {
  const device = selectedDevice(), point = device?.points[$('point').value];
  if (!point) { $('submit').disabled = true; return; }
  $('value').min = point.min; $('value').max = point.max;
  $('value').step = point.bank === 'coil' ? 1 : point.type === 'float32' ? 'any' : point.scale;
  $('limits').textContent = `${point.min}—${point.max} ${point.unit || ''}${device.writeEnabled ? '' : ' · 写入未启用'}`;
  const state = telemetry?.devices[$('device').value];
  $('submit').disabled = pending || !apiConnected || !device.writeEnabled || !state?.connected || state.points[$('point').value]?.quality !== 'good' || Boolean(telemetry?.serviceError);
}
function rebuild() {
  const device = selectedDevice(); if (!device) return;
  $('readings').replaceChildren(); $('point').replaceChildren(); $('trend-point').replaceChildren();
  for (const [key, point] of Object.entries(device.points)) {
    const card = document.createElement('article'); card.className = 'reading'; card.dataset.point = key;
    const name = document.createElement('span'); name.className = 'name'; name.textContent = point.label || key;
    const value = document.createElement('strong'); value.className = 'value'; value.textContent = '—';
    const status = document.createElement('span'); status.className = 'quality muted'; status.textContent = '未采集';
    card.append(name, value, status); $('readings').append(card);
    $('trend-point').append(option(key, point.label || key));
    if (point.writable) $('point').append(option(key, point.label || key));
  }
  $('value').value = ''; render(); void drawHistory();
}
function render() {
  const state = telemetry?.devices[$('device').value], device = selectedDevice();
  if (!device) return;
  $('connection').textContent = !apiConnected ? '服务连接中断' : state?.connected ? '设备在线' : '设备未连接';
  $('connection').className = apiConnected && state?.connected ? 'good' : 'muted';
  $('telemetry-time').textContent = telemetry ? `接收 ${time(telemetry.timestamp)}` : '等待设备数据';
  $('error').textContent = telemetry?.serviceError || state?.error || '';
  for (const card of $('readings').children) {
    const key = card.dataset.point, point = device.points[key], reading = state?.points[key];
    const quality = reading?.quality || 'unavailable';
    const value = card.querySelector('.value'); value.replaceChildren(document.createTextNode(format(reading?.value)));
    const unit = document.createElement('small'); unit.textContent = point.unit || ''; value.append(unit);
    value.className = `value ${quality === 'good' && apiConnected ? '' : 'muted'}`;
    const label = card.querySelector('.quality'); label.textContent = `${apiConnected ? qualities[quality] : '连接中断'} · ${time(reading?.timestamp)}`;
    label.className = `quality ${quality === 'good' && apiConnected ? 'good' : 'muted'}`;
  }
  updateControls();
}
async function readEvents() {
  try {
    const data = await request(`/api/v1/events?after=${eventCursor}&limit=100`);
    for (const event of data.events) {
      eventCursor = event.id;
      const item = document.createElement('li'), stamp = document.createElement('time'), content = document.createElement('span');
      stamp.textContent = time(event.timestamp);
      const detail = event.payload;
      content.textContent = event.kind === 'connection' ? `${detail.device} · ${detail.connected ? '连接建立' : detail.error || '连接中断'}` : `${detail.device ? `${detail.device} / ${detail.point} · ${detail.value} · ` : ''}${states[detail.status] || detail.status}${detail.feedback != null ? ` · 读回 ${format(detail.feedback)}` : ''}${detail.error ? ` · ${detail.error}` : ''}`;
      if (detail.status === 'verified') content.className = 'feedback';
      if (detail.status === 'failed') content.className = 'failed';
      item.append(stamp, content); $('events').prepend(item);
    }
    while ($('events').children.length > 60) $('events').lastChild.remove();
  } catch { /* The connection indicator carries transport status. */ }
}
const svgNode = (name, attributes, text) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text != null) node.textContent = text;
  return node;
};
async function drawHistory() {
  const device = $('device').value, point = $('trend-point').value; if (!device || !point) return;
  try {
    const data = await request(`/api/v1/history?device=${encodeURIComponent(device)}&since=${Date.now() / 1000 - 600}&limit=1000`);
    if (device !== $('device').value || point !== $('trend-point').value) return;
    const rows = data.samples.filter(row => Number.isFinite(row.points[point]));
    const chart = $('trend'); chart.replaceChildren();
    if (!rows.length) { $('trend-note').textContent = '尚无有效采集记录'; return; }
    const values = rows.map(row => row.points[point]), min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
    const first = Date.now() / 1000 - 600, last = Date.now() / 1000;
    const positions = rows.map(row => [46 + (row.timestamp - first) / (last - first) * 540, 158 - (row.points[point] - min) / span * 125]);
    for (const y of [33, 96, 158]) chart.append(svgNode('line', {x1: 46, x2: 586, y1: y, y2: y, stroke: '#2a3538'}));
    chart.append(svgNode('text', {x: 0, y: 37}, format(max)), svgNode('text', {x: 0, y: 162}, format(min)), svgNode('text', {x: 46, y: 181}, time(first)), svgNode('text', {x: 526, y: 181}, time(last)));
    // Separate gaps rather than draw a continuous signal across a device outage.
    let section = [];
    const flush = () => { if (section.length) chart.append(svgNode('polyline', {points: section.map(p => p.join(',')).join(' '), fill: 'none', stroke: '#8bb59c', 'stroke-width': 2})); section = []; };
    for (let i = 0; i < rows.length; i++) { if (i && rows[i].timestamp - rows[i - 1].timestamp > 15) flush(); section.push(positions[i]); }
    flush();
    const end = positions.at(-1); chart.append(svgNode('circle', {cx: end[0], cy: end[1], r: 3, fill: '#8bb59c'}));
    $('trend-note').textContent = `${selectedDevice().points[point].label || point} · ${rows.length} 次采集 · 最近 ${time(rows.at(-1).timestamp)}`;
  } catch { $('trend-note').textContent = '历史数据暂不可用'; }
}
$('device').addEventListener('change', rebuild);
$('point').addEventListener('change', () => { $('value').value = ''; updateControls(); });
$('trend-point').addEventListener('change', () => { void drawHistory(); });
$('command-form').addEventListener('submit', async event => {
  event.preventDefault(); if (pending || $('submit').disabled) return;
  pending = true; updateControls(); $('receipt').textContent = '正在提交';
  try {
    const command = await request('/api/v1/commands', {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${$('token').value}`}, body: JSON.stringify({device: $('device').value, point: $('point').value, value: Number($('value').value), requestId: crypto.randomUUID()})});
    const until = Date.now() + 120000; let receipt = command;
    while (true) {
      $('receipt').textContent = `${states[receipt.status] || receipt.status}${receipt.feedback != null ? ` · 读回 ${format(receipt.feedback)}` : ''}${receipt.error ? ` · ${receipt.error}` : ''}\n${receipt.id}`;
      $('receipt').className = receipt.status === 'verified' ? 'good' : receipt.status === 'failed' ? 'failed' : '';
      if (terminal.has(receipt.status)) break;
      if (Date.now() > until) throw new Error(`等待回执超时，指令编号 ${command.id}`);
      await new Promise(resolve => setTimeout(resolve, 300));
      receipt = await request(`/api/v1/commands/${command.id}`);
    }
    void readEvents();
  } catch (error) { $('receipt').className = 'failed'; $('receipt').textContent = error.message; }
  finally { pending = false; updateControls(); }
});
async function start() {
  try {
    metadata = await request('/api/v1/metadata');
    for (const [id, device] of Object.entries(metadata.devices)) $('device').append(option(id, device.label));
    rebuild();
    const stream = new EventSource('/api/v1/stream');
    stream.addEventListener('telemetry', event => { telemetry = JSON.parse(event.data); apiConnected = true; render(); });
    stream.addEventListener('error', () => { apiConnected = false; render(); });
    void readEvents(); setInterval(readEvents, 1500); setInterval(drawHistory, 5000);
  } catch (error) { $('connection').textContent = '服务不可用'; $('error').textContent = error.message; setTimeout(start, 3000); }
}
void start();
