// Analysis Page JavaScript

// Wait for DOM and Chart.js to be ready
document.addEventListener('DOMContentLoaded', function() {
    // Configure Chart.js defaults for better performance
    if (typeof Chart !== 'undefined') {
        Chart.defaults.animation.duration = 300;
        Chart.defaults.responsive = true;
        Chart.defaults.maintainAspectRatio = false;
        console.log('Chart.js configured successfully');
    } else {
        console.error('Chart.js not loaded when trying to configure defaults');
    }
});

class AnalysisPage {
    constructor() {
        this.charts = {
            trends: null,
            weekday: null,
            workTime: null,
            workloadBalance: null
        };
        this.selectedCalendars = [];
        this.currentPeriod = 'month';
        this.currentMonth = new Date().toISOString().slice(0, 7);
        this.loadingTimeout = null;
        this.currentMetric = 'hours';
        this.lastTrendsData = null;
        this.comparisonMode = false;
        this.comparisonPeriod = 'month';
        this.comparisonMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7);
        this.filters = {
            users: [],
            shiftType: '',
            duration: ''
        };
        this.cache = new Map();
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.initializeCalendarSelection();
        this.updateParticipantInfoVisibility();
        
        // Check if Chart.js is loaded
        if (typeof Chart === 'undefined') {
            console.error('Chart.js is not loaded!');
            return;
        }
        console.log('Chart.js version:', Chart.version);
        this.initializeCalendarSelection();
        // Test debug endpoint first
        this.testDebugEndpoint().then(() => {
            // Load user options after calendar selection
            this.loadUserOptions();
            this.loadShiftTypeOptions();
            // Initialize analysis page
            this.loadAnalysisData();
        });
    }

    async testDebugEndpoint() {
        try {
            const response = await fetch('/api/analysis-debug');
            if (!response.ok) {
                console.error('Debug endpoint failed:', response.status);
                return;
            }
            const data = await response.json();
            console.log('Debug endpoint success:', data);
            
            // Set default calendar selection based on available calendars
            if (data.owned_calendars && data.owned_calendars.length > 0) {
                this.selectedCalendars = [data.owned_calendars[0].id];
                console.log('Auto-selected calendar:', this.selectedCalendars);
            } else if (data.shared_calendars && data.shared_calendars.length > 0) {
                this.selectedCalendars = [data.shared_calendars[0].id];
                console.log('Auto-selected shared calendar:', this.selectedCalendars);
            }
        } catch (error) {
            console.error('Debug endpoint error:', error);
        }
    }

    bindEvents() {
        // Period selector changes
        document.getElementById('periodSelect').addEventListener('change', (e) => {
            this.currentPeriod = e.target.value;
            this.loadAnalysisData();
        });

        document.getElementById('monthPicker').addEventListener('change', (e) => {
            this.currentMonth = e.target.value;
            this.loadAnalysisData();
        });

        // Comparison mode toggle
        document.getElementById('comparisonMode').addEventListener('change', (e) => {
            this.comparisonMode = e.target.checked;
            const comparisonPeriod = document.getElementById('comparisonPeriod');
            if (this.comparisonMode) {
                comparisonPeriod.style.display = 'flex';
                document.getElementById('comparisonMonthPicker').value = this.comparisonMonth;
            } else {
                comparisonPeriod.style.display = 'none';
            }
            this.loadAnalysisData();
        });

        // Comparison period selectors
        document.getElementById('comparisonPeriodSelect').addEventListener('change', (e) => {
            this.comparisonPeriod = e.target.value;
            if (this.comparisonMode) this.loadAnalysisData();
        });

        document.getElementById('comparisonMonthPicker').addEventListener('change', (e) => {
            this.comparisonMonth = e.target.value;
            if (this.comparisonMode) this.loadAnalysisData();
        });

        // Calendar checkboxes
        document.querySelectorAll('.calendar-input').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateSelectedCalendars();
                this.updateParticipantInfoVisibility();
                this.loadUserOptions(); // Reload users when calendars change
                this.loadShiftTypeOptions(); // Reload shift types when calendars change
                this.loadAnalysisData();
            });
        });

        // Advanced filters toggle
        const filterToggle = document.getElementById('filterToggle');
        if (filterToggle) {
            filterToggle.addEventListener('click', () => {
                const filters = document.getElementById('advancedFilters');
                const isVisible = filters.style.display !== 'none';
                filters.style.display = isVisible ? 'none' : 'block';
                
                // Update toggle button text and icon
                const icon = filterToggle.querySelector('i');
                const text = filterToggle.querySelector('span');
                
                if (isVisible) {
                    icon.className = 'bi bi-chevron-down';
                    if (text) text.textContent = 'Расширенные фильтры';
                } else {
                    icon.className = 'bi bi-chevron-up';
                    if (text) text.textContent = 'Скрыть фильтры';
                }
            });
        }

        // Filter action buttons
        const resetBtn = document.getElementById('resetFilters');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                // Reset hidden selects
                const userFilter = document.getElementById('userFilter');
                const shiftTypeFilter = document.getElementById('shiftTypeFilter');
                const durationFilter = document.getElementById('durationFilter');
                
                if (userFilter) {
                    Array.from(userFilter.options).forEach(option => option.selected = false);
                    userFilter.options[0].selected = true; // Select "All participants"
                }
                if (shiftTypeFilter) {
                    Array.from(shiftTypeFilter.options).forEach(option => option.selected = false);
                    shiftTypeFilter.options[0].selected = true; // Select "All types"
                }
                if (durationFilter) durationFilter.value = '';
                
                // Reset custom dropdowns UI
                this.resetParticipantsDropdown();
                this.resetShiftTypesDropdown();
                
                // Update filters and reload data
                this.filters = {
                    users: [],
                    shiftType: [],
                    duration: ''
                };
                
                this.loadAnalysisData();
            });
        }

        const applyBtn = document.getElementById('applyFilters');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                this.loadAnalysisData();
            });
        }

        // Filter changes - only update filter state, don't load data
        ['userFilter', 'shiftTypeFilter', 'durationFilter'].forEach(filterId => {
            const element = document.getElementById(filterId);
            if (element) {
                element.addEventListener('change', (e) => {
                    this.updateFilters();
                });
            }
        });

        // Chart control buttons
        document.querySelectorAll('.chart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentMetric = e.target.dataset.metric;
                if (this.lastTrendsData) {
                    this.updateTrendsChart(this.currentMetric, this.lastTrendsData);
                }
            });
        });
    }

    initializeCalendarSelection() {
        const checkboxes = document.querySelectorAll('.calendar-input');
        this.selectedCalendars = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => parseInt(cb.value));
    }

    updateSelectedCalendars() {
        const checkboxes = document.querySelectorAll('.calendar-input');
        this.selectedCalendars = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => parseInt(cb.value));
    }

    updateParticipantInfoVisibility() {
        const checkboxes = document.querySelectorAll('.calendar-input:checked');
        const participantInfo = document.getElementById('participantInfo');
        const teamSection = document.getElementById('teamSection');
        const workTimeContainer = document.getElementById('workTimeContainer');
        const peopleBtn = document.getElementById('peopleBtn');
        
        if (!participantInfo) return;
        
        // Check if user is creator of any selected calendar
        let isCreatorOfAny = false;
        checkboxes.forEach(checkbox => {
            if (checkbox.dataset.role === 'creator') {
                isCreatorOfAny = true;
            }
        });
        
        // Show info panel only if user is not creator of any selected calendar
        if (checkboxes.length > 0 && !isCreatorOfAny) {
            participantInfo.style.display = 'block';
            // Hide team analysis section for participants
            if (teamSection) {
                teamSection.style.display = 'none';
            }
            // Hide work time distribution chart for participants
            if (workTimeContainer) {
                workTimeContainer.style.display = 'none';
            }
            // Hide participants button in trends chart
            if (peopleBtn) {
                peopleBtn.style.display = 'none';
                // If people metric is currently selected, switch to hours
                if (this.currentMetric === 'people') {
                    this.currentMetric = 'hours';
                    document.querySelector('.chart-btn[data-metric="hours"]').classList.add('active');
                    document.querySelector('.chart-btn[data-metric="people"]').classList.remove('active');
                    if (this.lastTrendsData) {
                        this.updateTrendsChart(this.currentMetric, this.lastTrendsData);
                    }
                }
            }
            // Add participant mode class to charts row for full width layout
            const chartsRow = document.querySelector('.charts-row');
            if (chartsRow) {
                chartsRow.classList.add('participant-mode');
            }
        } else {
            participantInfo.style.display = 'none';
            // Show team analysis section for creators
            if (teamSection) {
                teamSection.style.display = 'block';
            }
            // Show work time distribution chart for creators
            if (workTimeContainer) {
                workTimeContainer.style.display = 'block';
            }
            // Show participants button in trends chart
            if (peopleBtn) {
                peopleBtn.style.display = 'block';
            }
            // Remove participant mode class for normal layout
            const chartsRow = document.querySelector('.charts-row');
            if (chartsRow) {
                chartsRow.classList.remove('participant-mode');
            }
        }
    }

    showLoading() {
        document.getElementById('loadingOverlay').classList.add('show');
    }

    hideLoading() {
        document.getElementById('loadingOverlay').classList.remove('show');
    }

    async loadAnalysisData() {
        console.log('loadAnalysisData called with calendars:', this.selectedCalendars);
        
        // Clear any existing timeout
        if (this.loadingTimeout) {
            clearTimeout(this.loadingTimeout);
        }

        // Debounce the loading
        this.loadingTimeout = setTimeout(async () => {
            if (this.selectedCalendars.length === 0) {
                console.log('No calendars selected, showing error');
                this.showError('Выберите хотя бы один календарь');
                return;
            }

            console.log('Starting to load analysis data...');
            this.showLoading();

            try {
                const requestData = {
                    period: this.currentPeriod,
                    month: this.currentMonth,
                    calendar_ids: this.selectedCalendars,
                    filters: this.filters
                };

                if (this.comparisonMode) {
                    requestData.comparison = {
                        period: this.comparisonPeriod,
                        month: this.comparisonMonth
                    };
                }

                // Check cache first
                const cacheKey = JSON.stringify(requestData);
                if (this.cache.has(cacheKey)) {
                    const cachedData = this.cache.get(cacheKey);
                    this.updateAnalysisDisplay(cachedData);
                    this.hideLoading();
                    return;
                }

                const response = await fetch('/api/analysis-data', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestData)
                });

                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        // Authentication/authorization error - redirect to login
                        window.location.href = '/login';
                        return;
                    }
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                console.log('API Response data:', data);
                
                // Cache the result (limit cache size to 10 entries)
                if (this.cache.size >= 10) {
                    const firstKey = this.cache.keys().next().value;
                    this.cache.delete(firstKey);
                }
                this.cache.set(cacheKey, data);
                
                this.updateAnalysisDisplay(data);
            } catch (error) {
                console.error('Error loading analysis data:', error);
                
                // Check if it's an authentication error
                if (error.message.includes('Failed to load analysis data')) {
                    // Try to reload the page to re-authenticate
                    window.location.reload();
                } else {
                    this.showError('Ошибка загрузки данных');
                }
            } finally {
                this.hideLoading();
            }
        }, 300);
    }

    updateAnalysisDisplay(data) {
        console.log('Updating analysis display with data:', data);
        
        // Check all required DOM elements exist
        const requiredElements = [
            'totalHours', 'totalShifts', 'avgShiftDuration', 'topTemplate',
            'weekdayChart', 'workTimeChart', 'trendsChart'
        ];
        
        const missingElements = requiredElements.filter(id => !document.getElementById(id));
        if (missingElements.length > 0) {
            console.error('Missing DOM elements:', missingElements);
        }
        
        this.updateShiftStats(data.shift_stats);
        this.updateTeamAnalysis(data.team_analysis);
        this.updateTimeSlots(data.time_slots);
        this.updateWeekdayActivity(data.weekday_activity);
        this.updateWorkTimeDistribution(data.work_time_distribution);
        this.lastTrendsData = data.trends_data;
        this.updateCharts(data);
    }

    updateShiftStats(stats) {
        console.log('Updating shift stats:', stats);
        const totalHoursEl = document.getElementById('totalHours');
        const totalShiftsEl = document.getElementById('totalShifts');
        const avgShiftDurationEl = document.getElementById('avgShiftDuration');
        const topTemplateEl = document.getElementById('topTemplate');
        
        if (totalHoursEl) totalHoursEl.textContent = this.formatHours(stats.total_hours);
        if (totalShiftsEl) totalShiftsEl.textContent = stats.total_shifts;
        if (avgShiftDurationEl) avgShiftDurationEl.textContent = this.formatDuration(stats.avg_duration);
        if (topTemplateEl) topTemplateEl.textContent = stats.top_template || 'Нет данных';
    }

    updateTeamAnalysis(teamData) {
        this.updateActivityRanking(teamData.activity_ranking);
        this.updateCoverageGrid(teamData.coverage_data);
        this.updateWorkloadBalanceChart(teamData.workload_balance);
    }

    updateActivityRanking(ranking) {
        const container = document.getElementById('activityRanking');
        container.innerHTML = '';

        ranking.forEach((user, index) => {
            const item = document.createElement('div');
            item.className = 'ranking-item';
            
            const positionClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
            
            item.innerHTML = `
                <div class="ranking-position ${positionClass}">${index + 1}</div>
                <div class="ranking-user">
                    <img src="/static/images/${user.avatar}" class="ranking-avatar" 
                         onerror="this.src='/static/images/default_avatar.svg'">
                    <div class="ranking-info">
                        <h4>${user.first_name} ${user.last_name}</h4>
                        <p>@${user.username}</p>
                    </div>
                </div>
                <div class="ranking-stats">
                    <div class="ranking-hours">${this.formatHours(user.total_hours)}</div>
                    <div class="ranking-shifts">${user.total_shifts} смен</div>
                </div>
            `;
            
            container.appendChild(item);
        });
    }

    updateCoverageGrid(coverageData) {
        const container = document.getElementById('coverageGrid');
        container.innerHTML = '';

        // Add day headers
        const dayHeaders = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        dayHeaders.forEach(day => {
            const header = document.createElement('div');
            header.className = 'coverage-day-header';
            header.textContent = day;
            header.style.cssText = `
                text-align: center;
                font-weight: 600;
                color: #6b7280;
                padding: 0.5rem;
                font-size: 0.8rem;
            `;
            container.appendChild(header);
        });

        // Add coverage days
        coverageData.forEach(day => {
            const dayElement = document.createElement('div');
            dayElement.className = `coverage-day ${this.getCoverageClass(day.coverage_percent)}`;
            dayElement.textContent = day.day;
            dayElement.title = `${day.coverage_percent}% покрытие, ${day.shifts_count} смен`;
            container.appendChild(dayElement);
        });
    }

    getCoverageClass(percent) {
        if (percent >= 80) return 'excellent';
        if (percent >= 60) return 'good';
        if (percent >= 30) return 'fair';
        if (percent > 0) return 'poor';
        return 'empty';
    }

    updateTimeSlots(timeSlots) {
        const templatesContainer = document.getElementById('shiftTemplates');
        
        if (!templatesContainer) return;
        
        templatesContainer.innerHTML = '';
        
        if (!timeSlots.templates || timeSlots.templates.length === 0) {
            templatesContainer.innerHTML = '<div class="no-templates">Нет созданных смен с указанным временем</div>';
            return;
        }
        
        timeSlots.templates.forEach(template => {
            const templateElement = document.createElement('div');
            templateElement.className = 'template-item';
            
            templateElement.innerHTML = `
                <div class="template-header">
                    <div class="template-info">
                        <span class="template-title">${template.title}</span>
                        <span class="template-badge shift-badge ${template.color_class}">${template.time_range}</span>
                    </div>
                    <div class="template-stats">
                        <span class="template-count">${template.count} ${template.count === 1 ? 'смена' : 'смен'}</span>
                        <span class="template-percentage">${Math.round(template.percentage)}%</span>
                    </div>
                </div>
                <div class="template-bar">
                    <div class="template-fill" style="width: ${template.percentage}%"></div>
                </div>
            `;
            
            // Add click handler to show template details
            templateElement.addEventListener('click', () => {
                this.showTemplateDetails(template);
            });
            
            templatesContainer.appendChild(templateElement);
        });
    }
    
    showTemplateDetails(template) {
        const modal = document.createElement('div');
        modal.className = 'shifts-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Смены "${template.title}" (${template.time_range})</h3>
                    <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="template-summary">
                        <p><strong>Всего использований:</strong> ${template.count}</p>
                        <p><strong>Процент от всех смен:</strong> ${Math.round(template.percentage)}%</p>
                    </div>
                    <h4>Список смен:</h4>
                    ${template.shifts.map(shift => `
                        <div class="shift-item-full">
                            <div class="shift-main">
                                <span class="shift-title">${shift.title}</span>
                            </div>
                            <div class="shift-meta">
                                <span class="shift-date">${shift.date}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    updateCharts(data) {
        this.updateWorkTimeChart(data.work_time_distribution);
        this.updateWeekdayChart(data.weekday_activity);
        this.updateTrendsChart(this.currentMetric, data.trends_data);
    }

    updateWorkTimeChart(data) {
        const ctx = document.getElementById('workTimeChart').getContext('2d');
        
        if (this.charts.workTime) {
            this.charts.workTime.destroy();
        }

        this.charts.workTime = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.values,
                    backgroundColor: [
                        '#3b82f6',
                        '#10b981',
                        '#f59e0b',
                        '#ef4444',
                        '#8b5cf6',
                        '#06b6d4'
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 300
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }

    updateWeekdayChart(data) {
        const ctx = document.getElementById('weekdayChart').getContext('2d');
        
        if (this.charts.weekday) {
            this.charts.weekday.destroy();
        }

        this.charts.weekday = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
                datasets: [{
                    label: 'Часы работы',
                    data: data.hours,
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 300
                },
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + 'ч';
                            }
                        }
                    }
                }
            }
        });
    }

    updateWorkloadBalanceChart(data) {
        const ctx = document.getElementById('workloadBalanceChart').getContext('2d');
        
        if (this.charts.workloadBalance) {
            this.charts.workloadBalance.destroy();
        }

        this.charts.workloadBalance = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Часы работы',
                    data: data.values,
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(59, 130, 246, 1)',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 300
                },
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + 'ч';
                            }
                        }
                    }
                }
            }
        });
    }

    updateTrendsChart(metric, data) {
        const ctx = document.getElementById('trendsChart').getContext('2d');
        
        if (this.charts.trends) {
            this.charts.trends.destroy();
        }

        const metricData = data[metric] || { labels: [], values: [] };
        
        this.charts.trends = new Chart(ctx, {
            type: 'line',
            data: {
                labels: metricData.labels,
                datasets: [{
                    label: this.getMetricLabel(metric),
                    data: metricData.values,
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: 'rgba(59, 130, 246, 1)',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 300
                },
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return metric === 'hours' ? value + 'ч' : 
                                       metric === 'shifts' ? value : 
                                       value + ' чел.';
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    getMetricLabel(metric) {
        const labels = {
            hours: 'Часы',
            shifts: 'Смены',
            people: 'Участники'
        };
        return labels[metric] || metric;
    }

    formatHours(hours) {
        if (!hours) return '0ч';
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return m > 0 ? `${h}ч ${m}м` : `${h}ч`;
    }

    formatDuration(minutes) {
        if (!minutes) return '0ч 0м';
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}ч ${m}м`;
    }

    showEmptyState() {
        // Show empty state when no calendars selected
        const activityRanking = document.getElementById('activityRanking');
        if (activityRanking) {
            activityRanking.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #6b7280; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                    <i class="bi bi-calendar-x" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>Выберите календари для анализа</p>
                </div>
            `;
        }

        const coverageGrid = document.getElementById('coverageGrid');
        if (coverageGrid) {
            coverageGrid.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #6b7280; grid-column: 1 / -1;">
                    <i class="bi bi-calendar-x" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>Выберите календари для анализа</p>
                </div>
            `;
        }

        // Clear stats
        document.getElementById('totalHours').textContent = '0ч';
        document.getElementById('totalShifts').textContent = '0';
        document.getElementById('avgShiftDuration').textContent = '0ч 0м';
        document.getElementById('topTemplate').textContent = '-';

        // Clear shift templates
        const templatesContainer = document.getElementById('shiftTemplates');
        if (templatesContainer) {
            templatesContainer.innerHTML = '';
        }

        // Clear charts
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = {};
    }

    updateFilters() {
        const userFilter = document.getElementById('userFilter');
        const shiftTypeFilter = document.getElementById('shiftTypeFilter');
        const durationFilter = document.getElementById('durationFilter');
        
        this.filters = {
            users: Array.from(userFilter.selectedOptions).map(option => option.value).filter(v => v),
            shiftType: Array.from(shiftTypeFilter.selectedOptions).map(option => option.value).filter(v => v),
            duration: durationFilter.value
        };
    }

    async loadUserOptions() {
        try {
            console.log('Loading user options for calendars:', this.selectedCalendars);
            
            const response = await fetch('/api/calendar-users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    calendar_ids: this.selectedCalendars
                })
            });

            if (response.ok) {
                const users = await response.json();
                console.log('Loaded users:', users);
                
                this.updateParticipantsList(users);
                this.updateHiddenSelect(users);
                
                console.log('User options updated, total users:', users.length);
            } else {
                console.error('Failed to load users:', response.status);
            }
        } catch (error) {
            console.error('Error loading user options:', error);
        }
    }

    updateParticipantsList(users) {
        const participantsOptions = document.getElementById('participantsOptions');
        if (!participantsOptions) {
            console.error('participantsOptions element not found');
            return;
        }

        // Keep the "All participants" option and clear the rest
        const allOption = participantsOptions.querySelector('.all-option');
        participantsOptions.innerHTML = '';
        if (allOption) {
            participantsOptions.appendChild(allOption);
        }

        // Add user options
        users.forEach(user => {
            const option = document.createElement('div');
            option.className = 'participant-option';
            option.dataset.value = user.id;
            
            const avatarSrc = user.avatar && user.avatar !== 'default_avatar.svg' 
                ? `/static/images/${user.avatar}` 
                : null;
            
            option.innerHTML = `
                <div class="participant-checkbox">
                    <input type="checkbox" id="user-${user.id}">
                    <label for="user-${user.id}"></label>
                </div>
                <div class="participant-info">
                    <div class="participant-avatar">
                        ${avatarSrc ? 
                            `<img src="${avatarSrc}" alt="${user.first_name} ${user.last_name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                             <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--primary-color), var(--primary-hover)); border-radius: 50%; color: white; font-weight: 600;">
                                ${user.first_name.charAt(0)}${user.last_name.charAt(0)}
                             </div>` :
                            `<div style="display: flex; width: 100%; height: 100%; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--primary-color), var(--primary-hover)); border-radius: 50%; color: white; font-weight: 600;">
                                ${user.first_name.charAt(0)}${user.last_name.charAt(0)}
                             </div>`
                        }
                    </div>
                    <div class="participant-details">
                        <div class="participant-name">${user.first_name} ${user.last_name}</div>
                        <div class="participant-username">@${user.username}</div>
                    </div>
                </div>
            `;
            
            participantsOptions.appendChild(option);
        });

        // Initialize participant dropdown functionality
        this.initializeParticipantsDropdown();
    }

    updateHiddenSelect(users) {
        const userSelect = document.getElementById('userFilter');
        if (!userSelect) {
            console.error('userFilter element not found');
            return;
        }
        
        // Clear existing options except first one
        while (userSelect.children.length > 1) {
            userSelect.removeChild(userSelect.lastChild);
        }
        
        // Add user options
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.first_name} ${user.last_name}`;
            userSelect.appendChild(option);
        });
    }

    initializeParticipantsDropdown() {
        const trigger = document.getElementById('participantsTrigger');
        const list = document.getElementById('participantsList');
        const search = document.getElementById('participantsSearch');
        const options = document.getElementById('participantsOptions');
        const placeholder = document.querySelector('.participants-placeholder');
        const hiddenSelect = document.getElementById('userFilter');

        if (!trigger || !list || !search || !options) return;

        // Toggle dropdown
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = list.classList.contains('show');
            
            if (isOpen) {
                list.classList.remove('show');
                trigger.classList.remove('active');
            } else {
                list.classList.add('show');
                trigger.classList.add('active');
                search.focus();
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!trigger.contains(e.target) && !list.contains(e.target)) {
                list.classList.remove('show');
                trigger.classList.remove('active');
            }
        });

        // Search functionality
        search.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const participantOptions = options.querySelectorAll('.participant-option:not(.all-option)');
            
            participantOptions.forEach(option => {
                const name = option.querySelector('.participant-name').textContent.toLowerCase();
                const username = option.querySelector('.participant-username').textContent.toLowerCase();
                
                if (name.includes(searchTerm) || username.includes(searchTerm)) {
                    option.style.display = 'flex';
                } else {
                    option.style.display = 'none';
                }
            });
        });

        // Handle option selection
        options.addEventListener('click', (e) => {
            const option = e.target.closest('.participant-option');
            if (!option) return;

            const checkbox = option.querySelector('input[type="checkbox"]');
            const isAllOption = option.classList.contains('all-option');
            
            // Toggle checkbox when clicking anywhere on the option
            checkbox.checked = !checkbox.checked;
            
            if (isAllOption) {
                // Handle "All participants" selection
                const allCheckbox = option.querySelector('input[type="checkbox"]');
                const otherCheckboxes = options.querySelectorAll('.participant-option:not(.all-option) input[type="checkbox"]');
                
                if (allCheckbox.checked) {
                    // Uncheck all others
                    otherCheckboxes.forEach(cb => {
                        cb.checked = false;
                        cb.closest('.participant-option').classList.remove('selected');
                    });
                    option.classList.add('selected');
                } else {
                    option.classList.remove('selected');
                }
            } else {
                // Handle individual participant selection
                const allCheckbox = options.querySelector('.all-option input[type="checkbox"]');
                
                if (checkbox.checked) {
                    option.classList.add('selected');
                    // Uncheck "All participants"
                    if (allCheckbox) {
                        allCheckbox.checked = false;
                        allCheckbox.closest('.participant-option').classList.remove('selected');
                    }
                } else {
                    option.classList.remove('selected');
                    
                    // If no individual participants are selected, check "All participants"
                    const selectedIndividual = options.querySelectorAll('.participant-option:not(.all-option) input[type="checkbox"]:checked');
                    if (selectedIndividual.length === 0 && allCheckbox) {
                        allCheckbox.checked = true;
                        allCheckbox.closest('.participant-option').classList.add('selected');
                    }
                }
            }

            this.updatePlaceholderText();
            this.updateHiddenSelectValues();
            this.updateFilters();
        });

        // Prevent dropdown from closing when clicking inside
        list.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    updatePlaceholderText() {
        const placeholder = document.querySelector('.participants-placeholder');
        const options = document.getElementById('participantsOptions');
        const allOption = options.querySelector('.all-option input[type="checkbox"]');
        const selectedOptions = options.querySelectorAll('.participant-option:not(.all-option) input[type="checkbox"]:checked');

        if (!placeholder) return;

        if (allOption && allOption.checked) {
            placeholder.textContent = 'Все участники';
        } else if (selectedOptions.length === 0) {
            placeholder.textContent = 'Все участники';
        } else if (selectedOptions.length === 1) {
            const selectedOption = selectedOptions[0].closest('.participant-option');
            const name = selectedOption.querySelector('.participant-name').textContent;
            placeholder.textContent = name;
        } else {
            placeholder.textContent = `Выбрано: ${selectedOptions.length}`;
        }
    }

    updateHiddenSelectValues() {
        const hiddenSelect = document.getElementById('userFilter');
        const options = document.getElementById('participantsOptions');
        const allOption = options.querySelector('.all-option input[type="checkbox"]');
        const selectedOptions = options.querySelectorAll('.participant-option:not(.all-option) input[type="checkbox"]:checked');

        if (!hiddenSelect) return;

        // Clear all selections
        Array.from(hiddenSelect.options).forEach(option => option.selected = false);

        if (allOption && allOption.checked) {
            // Select the "All participants" option
            hiddenSelect.options[0].selected = true;
        } else {
            // Select individual participants
            selectedOptions.forEach(checkbox => {
                const userId = checkbox.closest('.participant-option').dataset.value;
                const option = hiddenSelect.querySelector(`option[value="${userId}"]`);
                if (option) option.selected = true;
            });
        }
    }

    async loadShiftTypeOptions() {
        try {
            console.log('Loading shift type options for calendars:', this.selectedCalendars);
            
            const response = await fetch('/api/calendar-shift-types', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    calendar_ids: this.selectedCalendars
                })
            });

            if (response.ok) {
                const shiftTypes = await response.json();
                console.log('Loaded shift types:', shiftTypes);
                
                this.updateShiftTypesList(shiftTypes);
                this.updateHiddenShiftTypeSelect(shiftTypes);
                
                console.log('Shift type options updated, total types:', shiftTypes.length);
            } else {
                console.error('Failed to load shift types:', response.status);
            }
        } catch (error) {
            console.error('Error loading shift type options:', error);
        }
    }

    updateShiftTypesList(shiftTypes) {
        const shiftTypesOptions = document.getElementById('shiftTypesOptions');
        if (!shiftTypesOptions) {
            console.error('shiftTypesOptions element not found');
            return;
        }

        // Keep the "All types" option and clear the rest
        const allOption = shiftTypesOptions.querySelector('.all-option');
        const allOptionHTML = allOption ? allOption.outerHTML : `
            <div class="shift-type-option all-option" data-value="">
                <div class="shift-type-checkbox">
                    <input type="checkbox" id="all-shift-types" checked>
                    <label for="all-shift-types"></label>
                </div>
                <div class="shift-type-info">
                    <div class="shift-type-color">
                        <i class="bi bi-palette-fill"></i>
                    </div>
                    <div class="shift-type-details">
                        <div class="shift-type-name">Все типы</div>
                        <div class="shift-type-description">Показать все</div>
                    </div>
                </div>
            </div>
        `;
        
        // Clear all options and add the "All types" option back
        shiftTypesOptions.innerHTML = allOptionHTML;

        // Add shift type options
        shiftTypes.forEach(shiftType => {
            const option = document.createElement('div');
            option.className = 'shift-type-option';
            option.dataset.value = shiftType.color_class;
            
            option.innerHTML = `
                <div class="shift-type-checkbox">
                    <input type="checkbox" id="shift-type-${shiftType.color_class}">
                    <label for="shift-type-${shiftType.color_class}"></label>
                </div>
                <div class="shift-type-info">
                    <div class="shift-type-color" style="background-color: ${shiftType.color};">
                        ${shiftType.color_name ? shiftType.color_name.charAt(0).toUpperCase() : shiftType.color_class.charAt(0).toUpperCase()}
                    </div>
                    <div class="shift-type-details">
                        <div class="shift-type-name">${shiftType.title}</div>
                    </div>
                </div>
            `;
            
            shiftTypesOptions.appendChild(option);
        });

        // Re-initialize shift types dropdown functionality after updating content
        setTimeout(() => {
            this.initializeShiftTypesDropdown();
        }, 0);
    }

    updateHiddenShiftTypeSelect(shiftTypes) {
        const shiftTypeSelect = document.getElementById('shiftTypeFilter');
        if (!shiftTypeSelect) {
            console.error('shiftTypeFilter element not found');
            return;
        }
        
        // Clear existing options except first one
        while (shiftTypeSelect.children.length > 1) {
            shiftTypeSelect.removeChild(shiftTypeSelect.lastChild);
        }
        
        // Add shift type options
        shiftTypes.forEach(shiftType => {
            const option = document.createElement('option');
            option.value = shiftType.color_class;
            option.textContent = `${shiftType.title} (${shiftType.color_name})`;
            shiftTypeSelect.appendChild(option);
        });
    }

    initializeShiftTypesDropdown() {
        const trigger = document.getElementById('shiftTypesTrigger');
        const list = document.getElementById('shiftTypesList');
        const search = document.getElementById('shiftTypesSearch');
        const options = document.getElementById('shiftTypesOptions');

        if (!trigger || !list || !search || !options) return;

        // Toggle dropdown
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = list.classList.contains('show');
            
            if (isOpen) {
                list.classList.remove('show');
                trigger.classList.remove('active');
            } else {
                list.classList.add('show');
                trigger.classList.add('active');
                search.focus();
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!trigger.contains(e.target) && !list.contains(e.target)) {
                list.classList.remove('show');
                trigger.classList.remove('active');
            }
        });

        // Search functionality
        search.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const shiftTypeOptions = options.querySelectorAll('.shift-type-option:not(.all-option)');
            
            shiftTypeOptions.forEach(option => {
                const name = option.querySelector('.shift-type-name').textContent.toLowerCase();
                
                if (name.includes(searchTerm)) {
                    option.style.display = 'flex';
                } else {
                    option.style.display = 'none';
                }
            });
        });

        // Handle option selection
        options.addEventListener('click', (e) => {
            const option = e.target.closest('.shift-type-option');
            if (!option) return;

            const checkbox = option.querySelector('input[type="checkbox"]');
            const isAllOption = option.classList.contains('all-option');
            
            // Toggle checkbox when clicking anywhere on the option
            checkbox.checked = !checkbox.checked;
            
            if (isAllOption) {
                // Handle "All types" selection
                const allCheckbox = option.querySelector('input[type="checkbox"]');
                const otherCheckboxes = options.querySelectorAll('.shift-type-option:not(.all-option) input[type="checkbox"]');
                
                if (allCheckbox.checked) {
                    // Uncheck all others
                    otherCheckboxes.forEach(cb => {
                        cb.checked = false;
                        cb.closest('.shift-type-option').classList.remove('selected');
                    });
                    option.classList.add('selected');
                } else {
                    option.classList.remove('selected');
                }
            } else {
                // Handle individual shift type selection
                const allCheckbox = options.querySelector('.all-option input[type="checkbox"]');
                
                if (checkbox.checked) {
                    option.classList.add('selected');
                    // Uncheck "All types"
                    if (allCheckbox) {
                        allCheckbox.checked = false;
                        allCheckbox.closest('.shift-type-option').classList.remove('selected');
                    }
                } else {
                    option.classList.remove('selected');
                    
                    // If no individual types are selected, check "All types"
                    const selectedIndividual = options.querySelectorAll('.shift-type-option:not(.all-option) input[type="checkbox"]:checked');
                    if (selectedIndividual.length === 0 && allCheckbox) {
                        allCheckbox.checked = true;
                        allCheckbox.closest('.shift-type-option').classList.add('selected');
                    }
                }
            }

            this.updateShiftTypePlaceholderText();
            this.updateHiddenShiftTypeSelectValues();
            this.updateFilters();
        });

        // Prevent dropdown from closing when clicking inside
        list.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    updateShiftTypePlaceholderText() {
        const placeholder = document.querySelector('.shift-types-placeholder');
        const options = document.getElementById('shiftTypesOptions');
        const allOption = options.querySelector('.all-option input[type="checkbox"]');
        const selectedOptions = options.querySelectorAll('.shift-type-option:not(.all-option) input[type="checkbox"]:checked');

        if (!placeholder) return;

        if (allOption && allOption.checked) {
            placeholder.textContent = 'Все типы';
        } else if (selectedOptions.length === 0) {
            placeholder.textContent = 'Все типы';
        } else if (selectedOptions.length === 1) {
            const selectedOption = selectedOptions[0].closest('.shift-type-option');
            const name = selectedOption.querySelector('.shift-type-name').textContent;
            placeholder.textContent = name;
        } else {
            placeholder.textContent = `Выбрано: ${selectedOptions.length}`;
        }
    }

    updateHiddenShiftTypeSelectValues() {
        const hiddenSelect = document.getElementById('shiftTypeFilter');
        const options = document.getElementById('shiftTypesOptions');
        const allOption = options.querySelector('.all-option input[type="checkbox"]');
        const selectedOptions = options.querySelectorAll('.shift-type-option:not(.all-option) input[type="checkbox"]:checked');

        if (!hiddenSelect) return;

        // Clear all selections
        Array.from(hiddenSelect.options).forEach(option => option.selected = false);

        if (allOption && allOption.checked) {
            // Select the "All types" option
            hiddenSelect.options[0].selected = true;
        } else {
            // Select individual shift types
            selectedOptions.forEach(checkbox => {
                const colorClass = checkbox.closest('.shift-type-option').dataset.value;
                const option = hiddenSelect.querySelector(`option[value="${colorClass}"]`);
                if (option) option.selected = true;
            });
        }
    }

    resetParticipantsDropdown() {
        const options = document.getElementById('participantsOptions');
        const placeholder = document.querySelector('.participants-placeholder');
        const allOption = options?.querySelector('.all-option input[type="checkbox"]');
        const individualOptions = options?.querySelectorAll('.participant-option:not(.all-option) input[type="checkbox"]');

        if (allOption) {
            allOption.checked = true;
            allOption.closest('.participant-option').classList.add('selected');
        }

        if (individualOptions) {
            individualOptions.forEach(checkbox => {
                checkbox.checked = false;
                checkbox.closest('.participant-option').classList.remove('selected');
            });
        }

        if (placeholder) {
            placeholder.textContent = 'Все участники';
        }
    }

    resetShiftTypesDropdown() {
        const options = document.getElementById('shiftTypesOptions');
        const placeholder = document.querySelector('.shift-types-placeholder');
        const allOption = options?.querySelector('.all-option input[type="checkbox"]');
        const individualOptions = options?.querySelectorAll('.shift-type-option:not(.all-option) input[type="checkbox"]');

        if (allOption) {
            allOption.checked = true;
            allOption.closest('.shift-type-option').classList.add('selected');
        }

        if (individualOptions) {
            individualOptions.forEach(checkbox => {
                checkbox.checked = false;
                checkbox.closest('.shift-type-option').classList.remove('selected');
            });
        }

        if (placeholder) {
            placeholder.textContent = 'Все типы';
        }
    }

    updateWeekdayActivity(data) {
        console.log('Updating weekday activity:', data);
        const canvas = document.getElementById('weekdayChart');
        if (!canvas) {
            console.error('weekdayChart canvas not found');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        if (this.charts.weekday) {
            this.charts.weekday.destroy();
        }

        this.charts.weekday = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
                datasets: [{
                    label: 'Часы работы',
                    data: data.hours,
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 300
                },
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + 'ч';
                            }
                        }
                    }
                }
            }
        });
    }

    updateWorkTimeDistribution(data) {
        console.log('Updating work time distribution:', data);
        const canvas = document.getElementById('workTimeChart');
        if (!canvas) {
            console.error('workTimeChart canvas not found');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        if (this.charts.workTime) {
            this.charts.workTime.destroy();
        }

        this.charts.workTime = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels || [],
                datasets: [{
                    data: data.values || [],
                    backgroundColor: [
                        'rgba(239, 68, 68, 0.8)',
                        'rgba(245, 158, 11, 0.8)',
                        'rgba(34, 197, 94, 0.8)',
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(168, 85, 247, 0.8)'
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 300
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
        
        console.log('Work time chart created successfully');
    }

    showError(message) {
        // Use the standard toast system from base.js
        console.error(message);
        
        if (window.toastManager) {
            window.toastManager.show(message, 'danger', 3000);
        } else {
            // Fallback if toastManager is not available
            const container = document.querySelector('.toast-container') || document.getElementById('toastContainer');
            if (container) {
                const toast = document.createElement('div');
                toast.className = 'toast toast-danger';
                toast.innerHTML = `
                    <div>${message}</div>
                    <button type="button" class="toast-close">&times;</button>
                `;
                
                container.appendChild(toast);
                
                // Add show class after a brief delay
                setTimeout(() => {
                    toast.classList.add('show');
                }, 10);
                
                // Auto remove after 3 seconds
                setTimeout(() => {
                    toast.classList.add('hide');
                    setTimeout(() => {
                        if (toast.parentNode) {
                            toast.parentNode.removeChild(toast);
                        }
                    }, 300);
                }, 3000);
                
                // Close button functionality
                const closeBtn = toast.querySelector('.toast-close');
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => {
                        toast.classList.add('hide');
                        setTimeout(() => {
                            if (toast.parentNode) {
                                toast.parentNode.removeChild(toast);
                            }
                        }, 300);
                    });
                }
            }
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for Chart.js to be fully loaded
    setTimeout(() => {
        if (typeof Chart === 'undefined') {
            console.error('Chart.js is still not loaded after timeout');
            return;
        }
        new AnalysisPage();
    }, 100);
});
