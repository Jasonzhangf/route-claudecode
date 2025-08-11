#!/usr/bin/env node

/**
 * Claude Code Router - Timeline Visualizer Tool
 * 
 * 从日志数据生成HTML交互式时序图，显示完整的请求-响应时序关系
 * 
 * @author Jason Zhang
 * @version 1.0.0
 * @created 2025-08-07
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class TimelineVisualizer {
    constructor(configPath = '../config.json') {
        this.config = null;
        this.configPath = path.resolve(__dirname, configPath);
        this.timelineData = [];
        this.requestColors = new Map();
        this.colorPalette = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
            '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D2B4DE',
            '#AED6F1', '#A9DFBF', '#F9E79F', '#FADBD8', '#D5DBDB'
        ];
        this.colorIndex = 0;
        this.stats = {
            totalRequests: 0,
            totalEvents: 0,
            providers: new Set(),
            timeSpan: { start: null, end: null }
        };
    }

    async initialize() {
        await this.loadConfig();
        this.logInfo('Timeline Visualizer initialized');
    }

    async loadConfig() {
        try {
            const configContent = await fs.readFile(this.configPath, 'utf8');
            this.config = JSON.parse(configContent);
            this.logInfo(`Configuration loaded from ${this.configPath}`);
        } catch (error) {
            throw new Error(`Failed to load configuration: ${error.message}`);
        }
    }

    expandPath(filePath) {
        if (filePath.startsWith('~')) {
            return path.join(os.homedir(), filePath.slice(1));
        }
        return path.resolve(filePath);
    }

    async generateTimeline(logPattern = 'ccr-*.log', outputFile = 'timeline.html') {
        this.logInfo('Starting timeline generation...');
        
        // 1. 解析日志文件收集时序数据
        await this.collectTimelineData(logPattern);
        
        // 2. 处理和排序数据
        this.processTimelineData();
        
        // 3. 生成HTML可视化
        await this.generateHTMLVisualization(outputFile);
        
        this.printStats();
        this.logInfo(`Timeline generated: ${outputFile}`);
    }

    async collectTimelineData(logPattern) {
        const logsPath = this.expandPath(this.config.paths.inputLogs);
        
        try {
            const files = await fs.readdir(logsPath);
            const logFiles = files.filter(file => 
                file.match(logPattern.replace('*', '.*'))
            );

            this.logInfo(`Found ${logFiles.length} log files to analyze`);

            for (const logFile of logFiles) {
                const filePath = path.join(logsPath, logFile);
                await this.parseLogFileForTimeline(filePath);
            }

        } catch (error) {
            this.logError(`Failed to collect timeline data: ${error.message}`);
            throw error;
        }
    }

    async parseLogFileForTimeline(filePath) {
        this.logInfo(`Analyzing log file for timeline: ${filePath}`);
        
        const { createReadStream } = require('fs');
        const { createInterface } = require('readline');
        
        const fileStream = createReadStream(filePath);
        const rl = createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let currentRequest = null;
        let requestEvents = [];

        for await (const line of rl) {
            try {
                const logEntry = this.parseLogLine(line);
                if (!logEntry) continue;

                const event = this.createTimelineEvent(logEntry);
                if (!event) continue;

                if (event.type === 'request_start') {
                    // 保存前一个请求的事件
                    if (currentRequest && requestEvents.length > 0) {
                        this.processRequestTimeline(currentRequest, requestEvents);
                    }
                    currentRequest = event;
                    requestEvents = [event];
                } else if (currentRequest) {
                    requestEvents.push(event);
                }

            } catch (error) {
                this.logError(`Error parsing timeline entry: ${error.message}`);
            }
        }

        // 处理最后一个请求
        if (currentRequest && requestEvents.length > 0) {
            this.processRequestTimeline(currentRequest, requestEvents);
        }
    }

    parseLogLine(line) {
        try {
            if (line.includes('{') && line.includes('}')) {
                const jsonStart = line.indexOf('{');
                const jsonPart = line.substring(jsonStart);
                return JSON.parse(jsonPart);
            }
        } catch (error) {
            // 解析结构化日志
            const match = line.match(/\[(.*?)\] \[(.*?)\] \[(.*?)\] (.*)/);
            if (match) {
                const [, timestamp, level, component, message] = match;
                return {
                    timestamp,
                    level,
                    component,
                    message,
                    raw: line
                };
            }
        }
        return null;
    }

    createTimelineEvent(logEntry) {
        if (!logEntry) return null;

        const timestamp = this.extractTimestamp(logEntry);
        const requestId = this.extractRequestId(logEntry);
        const provider = this.extractProvider(logEntry);
        
        if (!timestamp || !requestId) return null;

        const eventType = this.determineEventType(logEntry);
        if (!eventType) return null;

        return {
            timestamp: new Date(timestamp),
            requestId,
            provider: provider || 'unknown',
            type: eventType,
            data: this.extractEventData(logEntry, eventType),
            level: logEntry.level || 'info',
            component: logEntry.component || 'unknown',
            raw: logEntry
        };
    }

    extractTimestamp(entry) {
        if (entry.timestamp) return entry.timestamp;
        if (entry['@timestamp']) return entry['@timestamp'];
        
        const timeMatch = JSON.stringify(entry).match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?)/);
        if (timeMatch) return timeMatch[1];
        
        return null;
    }

    extractRequestId(entry) {
        if (entry.requestId) return entry.requestId;
        
        const content = JSON.stringify(entry);
        const match = content.match(/["']?requestId["']?\s*:\s*["']?([^"',\s}]+)["']?/i);
        if (match) return match[1];
        
        return null;
    }

    extractProvider(entry) {
        if (entry.provider) return entry.provider.toLowerCase();
        
        const content = JSON.stringify(entry).toLowerCase();
        for (const provider of this.config.extraction.providers) {
            if (content.includes(provider.toLowerCase())) {
                return provider;
            }
        }
        
        return null;
    }

    determineEventType(entry) {
        const content = JSON.stringify(entry).toLowerCase();
        
        // 事件类型优先级检查
        if (content.includes('post /') || content.includes('request received')) {
            return 'request_start';
        }
        
        if (content.includes('routing') || content.includes('provider selected')) {
            return 'routing';
        }
        
        if (content.includes('transforming') || content.includes('format conversion')) {
            return 'transformation';
        }
        
        if (content.includes('api call') || content.includes('sending request')) {
            return 'api_request';
        }
        
        if (content.includes('api response') || content.includes('received response')) {
            return 'api_response';
        }
        
        if (content.includes('finish_reason') || content.includes('stop_reason')) {
            return 'finish_reason';
        }
        
        if (content.includes('response sent') || content.includes('request completed')) {
            return 'request_end';
        }
        
        if (content.includes('tool_calls') || content.includes('function_call')) {
            return 'tool_call';
        }
        
        if (content.includes('error') || content.includes('failed')) {
            return 'error';
        }
        
        return 'other';
    }

    extractEventData(entry, eventType) {
        const data = {
            message: entry.message || '',
            level: entry.level,
            component: entry.component
        };

        switch (eventType) {
            case 'api_response':
                data.responseData = this.extractResponseContent(entry);
                data.finishReason = this.extractFinishReason(entry);
                break;
                
            case 'tool_call':
                data.toolInfo = this.extractToolCallInfo(entry);
                break;
                
            case 'error':
                data.errorDetails = this.extractErrorDetails(entry);
                break;
                
            case 'finish_reason':
                data.finishReason = this.extractFinishReason(entry);
                data.details = this.extractFinishReasonDetails(entry);
                break;
        }

        return data;
    }

    extractResponseContent(entry) {
        try {
            const content = entry.response || entry.content || entry.data;
            if (content && typeof content === 'object') {
                return JSON.stringify(content).substring(0, 200) + '...';
            }
            return content || 'No response content';
        } catch (error) {
            return 'Failed to extract response content';
        }
    }

    extractFinishReason(entry) {
        const content = JSON.stringify(entry).toLowerCase();
        const match = content.match(/["']?(?:finish_reason|stop_reason)["']?\s*:\s*["']?([^"',\s}]+)["']?/);
        return match ? match[1] : 'unknown';
    }

    extractToolCallInfo(entry) {
        try {
            const content = JSON.stringify(entry);
            if (content.includes('tool_calls')) {
                const match = content.match(/"name"\s*:\s*"([^"]+)"/);
                return match ? match[1] : 'tool_call';
            }
            return 'function_call';
        } catch (error) {
            return 'unknown_tool';
        }
    }

    extractErrorDetails(entry) {
        return {
            error: entry.error || entry.message || 'Unknown error',
            stack: entry.stack || null
        };
    }

    extractFinishReasonDetails(entry) {
        return {
            reason: this.extractFinishReason(entry),
            timestamp: this.extractTimestamp(entry),
            context: entry.message || 'No additional context'
        };
    }

    processRequestTimeline(startEvent, events) {
        const requestId = startEvent.requestId;
        const provider = startEvent.provider;
        
        // 获取请求颜色
        const color = this.getRequestColor(requestId);
        
        // 计算时序数据
        const timeline = {
            requestId,
            provider,
            color,
            startTime: startEvent.timestamp,
            endTime: events[events.length - 1].timestamp,
            duration: events[events.length - 1].timestamp - startEvent.timestamp,
            events: events.map(event => ({
                ...event,
                relativeTime: event.timestamp - startEvent.timestamp
            }))
        };

        this.timelineData.push(timeline);
        this.updateStats(timeline);
    }

    getRequestColor(requestId) {
        if (!this.requestColors.has(requestId)) {
            const color = this.colorPalette[this.colorIndex % this.colorPalette.length];
            this.requestColors.set(requestId, color);
            this.colorIndex++;
        }
        return this.requestColors.get(requestId);
    }

    updateStats(timeline) {
        this.stats.totalRequests++;
        this.stats.totalEvents += timeline.events.length;
        this.stats.providers.add(timeline.provider);
        
        if (!this.stats.timeSpan.start || timeline.startTime < this.stats.timeSpan.start) {
            this.stats.timeSpan.start = timeline.startTime;
        }
        
        if (!this.stats.timeSpan.end || timeline.endTime > this.stats.timeSpan.end) {
            this.stats.timeSpan.end = timeline.endTime;
        }
    }

    processTimelineData() {
        // 按开始时间排序
        this.timelineData.sort((a, b) => a.startTime - b.startTime);
        
        this.logInfo(`Processed ${this.timelineData.length} request timelines`);
    }

    async generateHTMLVisualization(outputFile) {
        const htmlContent = this.generateHTMLContent();
        const outputPath = path.resolve(outputFile);
        
        await fs.writeFile(outputPath, htmlContent);
        this.logInfo(`HTML timeline generated: ${outputPath}`);
    }

    generateHTMLContent() {
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Claude Code Router - Request Timeline Visualization</title>
    <style>
        ${this.generateCSS()}
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>🕒 Claude Code Router - Request Timeline</h1>
            <div class="stats">
                <div class="stat-item">
                    <span class="label">Total Requests:</span>
                    <span class="value">${this.stats.totalRequests}</span>
                </div>
                <div class="stat-item">
                    <span class="label">Total Events:</span>
                    <span class="value">${this.stats.totalEvents}</span>
                </div>
                <div class="stat-item">
                    <span class="label">Providers:</span>
                    <span class="value">${Array.from(this.stats.providers).join(', ')}</span>
                </div>
                <div class="stat-item">
                    <span class="label">Time Span:</span>
                    <span class="value">${this.formatDuration(this.stats.timeSpan.end - this.stats.timeSpan.start)}</span>
                </div>
            </div>
        </header>

        <div class="controls">
            <div class="filter-section">
                <label>Provider Filter:</label>
                <select id="providerFilter">
                    <option value="">All Providers</option>
                    ${Array.from(this.stats.providers).map(p => 
                        `<option value="${p}">${p.toUpperCase()}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="filter-section">
                <label>Event Type Filter:</label>
                <select id="eventTypeFilter">
                    <option value="">All Events</option>
                    <option value="request_start">Request Start</option>
                    <option value="routing">Routing</option>
                    <option value="transformation">Transformation</option>
                    <option value="api_request">API Request</option>
                    <option value="api_response">API Response</option>
                    <option value="tool_call">Tool Call</option>
                    <option value="finish_reason">Finish Reason</option>
                    <option value="request_end">Request End</option>
                    <option value="error">Error</option>
                </select>
            </div>
            <div class="filter-section">
                <label>Time Range:</label>
                <input type="range" id="timeRange" min="0" max="100" value="100">
                <span id="timeRangeValue">100%</span>
            </div>
        </div>

        <div class="timeline-container">
            <div class="timeline" id="timeline">
                ${this.generateTimelineHTML()}
            </div>
        </div>

        <div class="legend">
            <h3>Event Types Legend</h3>
            <div class="legend-grid">
                ${this.generateLegendHTML()}
            </div>
        </div>

        <div class="details-panel" id="detailsPanel">
            <h3>Event Details</h3>
            <div id="detailsContent">Click on any event to see details</div>
        </div>
    </div>

    <script>
        ${this.generateJavaScript()}
    </script>
</body>
</html>`;
    }

    generateCSS() {
        return `
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f5f5f5;
                color: #333;
                line-height: 1.6;
            }

            .container {
                max-width: 1400px;
                margin: 0 auto;
                padding: 20px;
            }

            .header {
                background: white;
                padding: 20px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                margin-bottom: 20px;
            }

            .header h1 {
                color: #2c3e50;
                margin-bottom: 15px;
                font-size: 2.5em;
                text-align: center;
            }

            .stats {
                display: flex;
                justify-content: space-around;
                flex-wrap: wrap;
                gap: 15px;
            }

            .stat-item {
                text-align: center;
                padding: 10px;
                background: #f8f9fa;
                border-radius: 5px;
                min-width: 150px;
            }

            .stat-item .label {
                display: block;
                font-weight: bold;
                color: #6c757d;
                font-size: 0.9em;
            }

            .stat-item .value {
                display: block;
                font-size: 1.2em;
                color: #007bff;
                font-weight: bold;
                margin-top: 5px;
            }

            .controls {
                background: white;
                padding: 20px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                margin-bottom: 20px;
                display: flex;
                gap: 30px;
                flex-wrap: wrap;
                align-items: center;
            }

            .filter-section {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .filter-section label {
                font-weight: bold;
                color: #495057;
                min-width: 100px;
            }

            .filter-section select,
            .filter-section input {
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 5px;
                font-size: 14px;
            }

            .timeline-container {
                background: white;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                margin-bottom: 20px;
                overflow-x: auto;
                max-height: 600px;
                overflow-y: auto;
            }

            .timeline {
                padding: 20px;
                position: relative;
                min-width: 800px;
            }

            .timeline-request {
                margin-bottom: 30px;
                position: relative;
                padding: 15px;
                border-radius: 8px;
                background: #f8f9fa;
                border-left: 4px solid;
            }

            .request-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
                font-weight: bold;
            }

            .request-id {
                font-size: 0.9em;
                color: #6c757d;
            }

            .provider-badge {
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 0.8em;
                color: white;
                font-weight: bold;
                text-transform: uppercase;
            }

            .duration {
                font-size: 0.9em;
                color: #28a745;
            }

            .events-track {
                position: relative;
                height: 40px;
                margin: 10px 0;
                background: #e9ecef;
                border-radius: 20px;
                overflow: hidden;
            }

            .event-point {
                position: absolute;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                top: 50%;
                transform: translateY(-50%);
                cursor: pointer;
                transition: all 0.2s ease;
                border: 2px solid white;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            }

            .event-point:hover {
                transform: translateY(-50%) scale(1.5);
                z-index: 10;
            }

            .event-point.request_start { background: #28a745; }
            .event-point.routing { background: #17a2b8; }
            .event-point.transformation { background: #ffc107; }
            .event-point.api_request { background: #fd7e14; }
            .event-point.api_response { background: #6f42c1; }
            .event-point.tool_call { background: #e83e8c; }
            .event-point.finish_reason { background: #20c997; }
            .event-point.request_end { background: #dc3545; }
            .event-point.error { background: #dc3545; animation: pulse 1s infinite; }
            .event-point.other { background: #6c757d; }

            @keyframes pulse {
                0% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7); }
                70% { box-shadow: 0 0 0 10px rgba(220, 53, 69, 0); }
                100% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0); }
            }

            .legend {
                background: white;
                padding: 20px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                margin-bottom: 20px;
            }

            .legend h3 {
                margin-bottom: 15px;
                color: #2c3e50;
            }

            .legend-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 10px;
            }

            .legend-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 5px;
            }

            .legend-color {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                border: 2px solid white;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            }

            .details-panel {
                background: white;
                padding: 20px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                min-height: 200px;
            }

            .details-panel h3 {
                color: #2c3e50;
                margin-bottom: 15px;
            }

            .details-content {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 5px;
                white-space: pre-wrap;
                font-family: monospace;
                font-size: 0.9em;
            }

            .hidden {
                display: none !important;
            }

            @media (max-width: 768px) {
                .controls {
                    flex-direction: column;
                    align-items: stretch;
                }
                
                .stats {
                    flex-direction: column;
                }
                
                .request-header {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 5px;
                }
            }
        `;
    }

    generateTimelineHTML() {
        return this.timelineData.map(timeline => {
            const duration = timeline.duration;
            const durationMs = Math.max(duration, 1);
            
            return `
                <div class="timeline-request" style="border-left-color: ${timeline.color}" data-provider="${timeline.provider}">
                    <div class="request-header">
                        <div class="request-info">
                            <span class="request-id">${timeline.requestId}</span>
                            <span class="provider-badge" style="background-color: ${timeline.color}">${timeline.provider.toUpperCase()}</span>
                        </div>
                        <div class="timing-info">
                            <span class="duration">${this.formatDuration(duration)}</span>
                            <span class="timestamp">${timeline.startTime.toLocaleTimeString()}</span>
                        </div>
                    </div>
                    <div class="events-track">
                        ${timeline.events.map(event => {
                            const position = durationMs > 0 ? (event.relativeTime / durationMs) * 100 : 0;
                            return `
                                <div class="event-point ${event.type}" 
                                     style="left: ${Math.max(0, Math.min(95, position))}%"
                                     data-event='${JSON.stringify({
                                         requestId: timeline.requestId,
                                         type: event.type,
                                         timestamp: event.timestamp.toISOString(),
                                         relativeTime: event.relativeTime,
                                         provider: event.provider,
                                         data: event.data,
                                         component: event.component,
                                         level: event.level
                                     })}'
                                     title="${event.type} - ${event.timestamp.toLocaleTimeString()}">
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    generateLegendHTML() {
        const eventTypes = [
            { type: 'request_start', name: 'Request Start', color: '#28a745' },
            { type: 'routing', name: 'Routing', color: '#17a2b8' },
            { type: 'transformation', name: 'Transformation', color: '#ffc107' },
            { type: 'api_request', name: 'API Request', color: '#fd7e14' },
            { type: 'api_response', name: 'API Response', color: '#6f42c1' },
            { type: 'tool_call', name: 'Tool Call', color: '#e83e8c' },
            { type: 'finish_reason', name: 'Finish Reason', color: '#20c997' },
            { type: 'request_end', name: 'Request End', color: '#dc3545' },
            { type: 'error', name: 'Error', color: '#dc3545' },
            { type: 'other', name: 'Other', color: '#6c757d' }
        ];

        return eventTypes.map(item => `
            <div class="legend-item">
                <div class="legend-color" style="background-color: ${item.color}"></div>
                <span>${item.name}</span>
            </div>
        `).join('');
    }

    generateJavaScript() {
        return `
            document.addEventListener('DOMContentLoaded', function() {
                const timelineData = ${JSON.stringify(this.timelineData)};
                const providerFilter = document.getElementById('providerFilter');
                const eventTypeFilter = document.getElementById('eventTypeFilter');
                const timeRange = document.getElementById('timeRange');
                const timeRangeValue = document.getElementById('timeRangeValue');
                const detailsContent = document.getElementById('detailsContent');

                // 事件点击处理
                document.addEventListener('click', function(e) {
                    if (e.target.classList.contains('event-point')) {
                        const eventData = JSON.parse(e.target.getAttribute('data-event'));
                        showEventDetails(eventData);
                    }
                });

                // 过滤器事件
                providerFilter.addEventListener('change', applyFilters);
                eventTypeFilter.addEventListener('change', applyFilters);
                timeRange.addEventListener('input', function() {
                    timeRangeValue.textContent = this.value + '%';
                    applyFilters();
                });

                function applyFilters() {
                    const provider = providerFilter.value;
                    const eventType = eventTypeFilter.value;
                    const timePercent = parseInt(timeRange.value);

                    document.querySelectorAll('.timeline-request').forEach(request => {
                        const requestProvider = request.getAttribute('data-provider');
                        let showRequest = true;

                        // Provider过滤
                        if (provider && requestProvider !== provider) {
                            showRequest = false;
                        }

                        request.style.display = showRequest ? 'block' : 'none';

                        // 事件类型过滤
                        if (showRequest) {
                            const eventPoints = request.querySelectorAll('.event-point');
                            eventPoints.forEach(point => {
                                const pointType = Array.from(point.classList).find(cls => 
                                    cls !== 'event-point' && cls !== 'hidden'
                                );
                                
                                if (eventType && pointType !== eventType) {
                                    point.classList.add('hidden');
                                } else {
                                    point.classList.remove('hidden');
                                }
                            });
                        }
                    });
                }

                function showEventDetails(eventData) {
                    const details = \`
Event Type: \${eventData.type}
Request ID: \${eventData.requestId}
Provider: \${eventData.provider}
Timestamp: \${new Date(eventData.timestamp).toLocaleString()}
Relative Time: \${eventData.relativeTime}ms
Component: \${eventData.component}
Level: \${eventData.level}

Event Data:
\${JSON.stringify(eventData.data, null, 2)}
                    \`;
                    
                    detailsContent.innerHTML = \`<div class="details-content">\${details}</div>\`;
                }

                // 初始化
                applyFilters();
            });
        `;
    }

    formatDuration(duration) {
        if (duration < 1000) {
            return `${Math.round(duration)}ms`;
        } else if (duration < 60000) {
            return `${(duration / 1000).toFixed(2)}s`;
        } else {
            const minutes = Math.floor(duration / 60000);
            const seconds = ((duration % 60000) / 1000).toFixed(2);
            return `${minutes}m ${seconds}s`;
        }
    }

    printStats() {
        console.log('\n📊 Timeline Visualizer - Generation Statistics');
        console.log('═'.repeat(50));
        console.log(`Total requests: ${this.stats.totalRequests}`);
        console.log(`Total events: ${this.stats.totalEvents}`);
        console.log(`Providers: ${Array.from(this.stats.providers).join(', ')}`);
        console.log(`Time span: ${this.formatDuration(this.stats.timeSpan.end - this.stats.timeSpan.start)}`);
        console.log(`Average events per request: ${(this.stats.totalEvents / this.stats.totalRequests).toFixed(2)}`);
        console.log('═'.repeat(50));
    }

    logInfo(message) {
        if (this.config?.performance?.logLevel === 'info' || !this.config) {
            console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
        }
    }

    logError(message) {
        console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
    }
}

// CLI接口
if (require.main === module) {
    const visualizer = new TimelineVisualizer();
    
    const args = process.argv.slice(2);
    const logPattern = args[0] || 'ccr-*.log';
    const outputFile = args[1] || 'timeline.html';
    
    visualizer.initialize()
        .then(() => visualizer.generateTimeline(logPattern, outputFile))
        .then(() => {
            console.log('✅ Timeline visualization generated successfully');
            console.log(`📱 Open ${outputFile} in your browser to view the interactive timeline`);
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Timeline generation failed:', error.message);
            process.exit(1);
        });
}

module.exports = TimelineVisualizer;