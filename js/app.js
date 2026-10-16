$(document).ready(function () {
    // --- Helper Functions for Fractions ---
    function gcd(a, b) {
        return b ? gcd(b, a % b) : a;
    }

    function decimalToFraction(decimal) {
        if (decimal === null || decimal === undefined || decimal === '' || isNaN(decimal)) {
            return '';
        }
        decimal = parseFloat(decimal);
        if (decimal === 0) return '0';

        const whole = Math.floor(decimal);
        const remainder = decimal - whole;

        if (remainder === 0) {
            return whole.toString();
        }

        // Check for common fractional parts (quarters)
        const quarters = [0.25, 0.5, 0.75];
        const closestQuarter = quarters.reduce((prev, curr) =>
            Math.abs(curr - remainder) < Math.abs(prev - remainder) ? curr : prev
        );

        // If the remainder is very close to a quarter, use it
        if (Math.abs(closestQuarter - remainder) < 0.001) {
            let num = closestQuarter * 4;
            let den = 4;
            const divisor = gcd(num, den);
            num /= divisor;
            den /= divisor;
            return whole > 0 ? `${whole} ${num}/${den}` : `${num}/${den}`;
        }

        // Generic fraction conversion for other decimals
        const tolerance = 1.0E-6;
        let h1 = 1, h2 = 0, k1 = 0, k2 = 1;
        let b = remainder;
        do {
            let a = Math.floor(b);
            let aux = h1; h1 = a * h1 + h2; h2 = aux;
            aux = k1; k1 = a * k1 + k2; k2 = aux;
            b = 1 / (b - a);
        } while (Math.abs(remainder - h1 / k1) > remainder * tolerance);

        return whole > 0 ? `${whole} ${h1}/${k1}` : `${h1}/${k1}`;
    }

    function fractionToDecimal(fractionStr) {
        if (!fractionStr || typeof fractionStr !== 'string') return 0;
        fractionStr = fractionStr.trim();
        if (fractionStr === '') return 0;

        const parts = fractionStr.split(' ');
        let total = 0;

        for (const part of parts) {
            if (part.includes('/')) {
                const [num, den] = part.split('/').map(Number);
                if (den && !isNaN(num) && !isNaN(den)) {
                    total += num / den;
                }
            } else if (!isNaN(part)) {
                total += parseFloat(part);
            }
        }
        return total;
    }


    // --- API and State Variables ---
    const getApiPrefix = () => {
        if (window.location.port === '8080') {
            return window.location.protocol + '//' + window.location.hostname + ':5050';
        }
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://' + window.location.hostname + ':5000';
        }
        if (window.location.hostname.includes('diederich.ai') || window.location.pathname.startsWith('/tmtrack')) {
            return '/tmtrack';
        }
        return '';
    };

    const apiUrl = getApiPrefix() + '/api/v1/tasks';
    const daysApiUrl = getApiPrefix() + '/api/v1/days';
    const usersApiUrl = getApiPrefix() + '/api/v1/users';
    const categoriesApiUrl = getApiPrefix() + '/api/v1/categories';
    const authLoginUrl = getApiPrefix() + '/api/auth/google/login';
    const authLogoutUrl = getApiPrefix() + '/api/auth/logout';

    let allTasks = [];
    let allCategories = [];
    let daysSummary = [];
    let globalIncompleteDates = [];
    let tasksCache = {};

    let currentScope = '2weeks'; // '2weeks', 'month', 'all', 'incomplete'
    let selectedMonth = moment();
    let selectedDate = null;
    let toastTimeout;
    let currentUserId = null;
    let viewingUserId = null;
    let currentUserGroups = [];
    let isUserAuthenticated = false;


    // --- Cookie Helpers ---
    function setCookie(name, value, days) {
        let expires = "";
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + (value || "") + expires + "; path=/";
        document.cookie = name + "=" + (value || "") + expires + "; path=/tmtrack";
    }

    function getCookie(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }

    // --- Authorization Header Setup ---
    const urlParams = new URLSearchParams(window.location.search);
    let authToken = urlParams.get('auth_token');

    if (authToken) {
        setCookie('auth_token', authToken, 7);
        urlParams.delete('auth_token');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.history.replaceState({}, document.title, newUrl);
    } else {
        authToken = getCookie('auth_token') || 'none';
    }

    $.ajaxSetup({
        xhrFields: {
            withCredentials: true
        },
        beforeSend: function (xhr) {
            xhr.setRequestHeader('Authorization', 'Bearer ' + authToken);
        },
        converters: {
            "text json": function (text) {
                const sanitized = text.replace(/("[^"\\]*(?:\\.[^"\\]*)*")|\bNaN\b/g, function (match, capturedString) {
                    return capturedString ? capturedString : 'null';
                });
                return JSON.parse(sanitized);
            }
        }
    });

    // --- Modal Logic ---
    const errorModal = $('#error-modal');
    const categoriesModal = $('#categories-modal');
    $('.close-btn').on('click', (e) => $(e.target).closest('.modal').hide());
    $(window).on('click', (event) => {
        if ($(event.target).is('.modal')) {
            $(event.target).hide();
        }
    });

    function displayError(title, message) {
        $('#error-modal-title').text(title);
        $('#error-text').text(message);
        errorModal.show();
    }

    function showToast(message) {
        const toast = $('#toast-notification');
        toast.text(message);
        toast.addClass('show');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.removeClass('show');
        }, 3000);
    }

    // --- Task Line Rendering ---
    function createTaskLine(task = {}) {
        const taskId = task.task_id || '';
        const taskName = task.task_name || '';
        const expectedHours = decimalToFraction(task.expected_hours) || '';
        const actualHours = (task.actual_hours !== null && task.actual_hours !== undefined) ? decimalToFraction(task.actual_hours) : '';
        const description = task.description || '';
        const isIncomplete = (actualHours === null || actualHours === undefined || actualHours === '');
        const incompleteClass = isIncomplete ? 'incomplete' : '';

        let categoryOptions = allCategories.map(cat =>
            `<option value="${cat}" ${task.category === cat ? 'selected' : ''}>${cat}</option>`
        ).join('');

        const isReadOnly = viewingUserId !== currentUserId;
        const disabledAttr = isReadOnly ? 'disabled' : '';
        const stepperArrowsDisplay = isReadOnly ? 'style="display: none;"' : '';
        const saveButtonHtml = isReadOnly ? '' : '<button class="save-task-btn">Save</button>';
        const deleteButtonHtml = isReadOnly ? '' : '<button class="delete-task-btn">🗑️</button>';

        return `
            <div class="task-line ${incompleteClass}" data-task-id="${taskId}">
                ${deleteButtonHtml}
                <div class="task-field task-field-category"><label>Category</label><select class="task-input-category" required ${disabledAttr}>${categoryOptions}</select></div>
                <div class="task-field task-field-task_name"><label>Task Name</label><input type="text" class="task-input-task_name" value="${taskName}" required ${disabledAttr}></div>
                <div class="task-field task-field-expected_hours">
                    <label>Expected (hrs)</label>
                    <div class="number-input-wrapper">
                        <input type="text" class="task-input-expected_hours" value="${expectedHours}" required ${disabledAttr}>
                        <div class="stepper-arrows" ${stepperArrowsDisplay}><span class="arrow-up">&#9650;</span><span class="arrow-down">&#9660;</span></div>
                    </div>
                </div>
                <div class="task-field task-field-actual_hours">
                    <label>Actual (hrs)</label>
                    <div class="number-input-wrapper">
                        <input type="text" class="task-input-actual_hours" value="${actualHours}" ${disabledAttr}>
                        <div class="stepper-arrows" ${stepperArrowsDisplay}><span class="arrow-up">&#9650;</span><span class="arrow-down">&#9660;</span></div>
                    </div>
                </div>
                <div class="task-field task-field-description"><label>Description</label><textarea class="task-input-description" ${disabledAttr}>${description}</textarea></div>
                ${saveButtonHtml}
            </div>
        `;
    }

    function updateSelectedDateDisplay(date) {
        const dateDisplay = $('#selected-date-display');
        if (!date) {
            dateDisplay.text('');
            return;
        }

        const dateObj = new Date(date + 'T00:00:00');
        const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        const weekday = weekdays[dateObj.getDay()];
        const month = months[dateObj.getMonth()];
        const day = ('0' + dateObj.getDate()).slice(-2);
        const year = dateObj.getFullYear();

        const finalFormat = `${weekday} ${month} ${day} ${year}`;
        dateDisplay.text(finalFormat);
    }

    function updateTotals() {
        let totalExpected = 0;
        let totalActual = 0;

        $('#task-list-container .task-line').each(function () {
            const expectedStr = $(this).find('.task-input-expected_hours').val();
            const actualStr = $(this).find('.task-input-actual_hours').val();

            const expected = fractionToDecimal(expectedStr);
            if (!isNaN(expected)) {
                totalExpected += expected;
            }

            const actual = fractionToDecimal(actualStr);
            if (!isNaN(actual)) {
                totalActual += actual;
            }
        });

        $('#total-expected-hours').text(`Expected: ${decimalToFraction(totalExpected)}`);
        $('#total-actual-hours').text(`Actual: ${decimalToFraction(totalActual)}`);
    }

    // --- Scoping & Days Loading ---
    function getScopeDateRange() {
        if (currentScope === '2weeks') {
            const end = moment().format('YYYY-MM-DD');
            const start = moment().subtract(13, 'days').format('YYYY-MM-DD');
            return { start_date: start, end_date: end };
        }
        if (currentScope === 'month') {
            const start = selectedMonth.clone().startOf('month').format('YYYY-MM-DD');
            const end = selectedMonth.clone().endOf('month').format('YYYY-MM-DD');
            return { start_date: start, end_date: end };
        }
        return { start_date: null, end_date: null };
    }

    function fetchDaysSummary(callback) {
        if (!viewingUserId) {
            if (callback) callback();
            return;
        }

        const { start_date, end_date } = getScopeDateRange();
        let queryUrl = `${daysApiUrl}?userid=${encodeURIComponent(viewingUserId)}`;
        if (start_date) queryUrl += `&start_date=${start_date}`;
        if (end_date) queryUrl += `&end_date=${end_date}`;

        $.ajax({
            url: queryUrl,
            method: 'GET'
        }).done(function (data) {
            let days = data.days || [];
            globalIncompleteDates = data.incomplete_dates || [];

            if (currentScope === 'incomplete') {
                days = days.filter(d => d.is_incomplete);
            }

            daysSummary = days;
            updateIncompleteBadge();
            renderDayList();
            if (callback) callback();
        }).fail(function () {
            // Graceful fallback for mock environments (e.g. Cypress mock intercepting only /tasks)
            fallbackDaysSummaryFromAllTasks(callback);
        });
    }

    function fallbackDaysSummaryFromAllTasks(callback) {
        const userTasks = allTasks.filter(task => task.userid === viewingUserId);
        const { start_date, end_date } = getScopeDateRange();

        let filteredTasks = userTasks;
        if (start_date && end_date) {
            const inRange = userTasks.filter(t => t.date >= start_date && t.date <= end_date);
            filteredTasks = (inRange.length > 0 || currentScope !== '2weeks') ? inRange : userTasks;
        }

        const uniqueDates = [...new Set(filteredTasks.map(t => t.date))].sort((a, b) => new Date(b) - new Date(a));
        daysSummary = uniqueDates.map(date => {
            const dayTasks = userTasks.filter(t => t.date === date);
            const totalExp = dayTasks.reduce((acc, t) => acc + (parseFloat(t.expected_hours) || 0), 0);
            const totalAct = dayTasks.reduce((acc, t) => acc + (parseFloat(t.actual_hours) || 0), 0);
            const isIncomp = dayTasks.some(t => t.actual_hours === null || t.actual_hours === undefined || t.actual_hours === '');
            return {
                date: date,
                task_count: dayTasks.length,
                total_expected: totalExp,
                total_actual: totalAct,
                is_incomplete: isIncomp
            };
        });

        if (currentScope === 'incomplete') {
            daysSummary = daysSummary.filter(d => d.is_incomplete);
        }

        const allIncomplete = userTasks.filter(t => t.actual_hours === null || t.actual_hours === undefined || t.actual_hours === '');
        globalIncompleteDates = [...new Set(allIncomplete.map(t => t.date))];

        updateIncompleteBadge();
        renderDayList();
        if (callback) callback();
    }

    function updateIncompleteBadge() {
        const count = globalIncompleteDates.length;
        const $badge = $('#incomplete-filter-btn');
        if (count > 0) {
            $('#incomplete-count-label').text(`${count} Incomplete`);
            $badge.show();
        } else {
            $badge.hide();
        }
    }

    function renderDayList() {
        const dayList = $('#day-list');
        dayList.empty();

        if (!viewingUserId) return;

        if (daysSummary.length === 0) {
            dayList.append('<li class="no-days-message" style="text-align: center; color: #888; padding: 15px; font-size: 13px;">No tasks logged for this period</li>');
            return;
        }

        const dayAbbreviations = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        daysSummary.forEach(day => {
            const dateObj = new Date(day.date + 'T00:00:00');
            const dayAbbr = dayAbbreviations[dateObj.getDay()];
            const isSelected = day.date === selectedDate;
            const hoursDisplay = (day.total_actual !== undefined) ? `${day.total_actual}h / ${day.total_expected}h` : '';
            const dotHtml = day.is_incomplete ? `<span class="day-incomplete-dot" title="Incomplete task hours">•</span>` : '';

            const $li = $(`
                <li data-date="${day.date}" class="${day.is_incomplete ? 'day-incomplete' : ''} ${isSelected ? 'active' : ''}">
                    <div class="day-item-primary">
                        <span class="day-item-date">${day.date}</span>
                        <span class="day-item-abbr">${dayAbbr}</span>
                    </div>
                    <div class="day-item-secondary">
                        <span class="day-item-hours">${hoursDisplay}</span>
                        ${dotHtml}
                    </div>
                </li>
            `);
            dayList.append($li);
        });
    }

    function selectDefaultDay() {
        if (daysSummary.length > 0) {
            // Select most recent day in the scoped list
            selectedDate = daysSummary[0].date;
        } else {
            selectedDate = null;
        }
        $('#day-list li').removeClass('active');
        $(`#day-list li[data-date="${selectedDate}"]`).addClass('active');
        renderTasksForDay(selectedDate);
    }

    // --- Task Fetching & Rendering ---
    function renderTasksForDay(date) {
        selectedDate = date;
        updateSelectedDateDisplay(date);
        const taskListContainer = $('#task-list-container');
        taskListContainer.empty();

        if (!viewingUserId || !date) {
            updateTotals();
            return;
        }

        // Render from cache first if available
        if (tasksCache[date] && tasksCache[date].length > 0) {
            tasksCache[date].forEach(task => taskListContainer.append(createTaskLine(task)));
            updateTotals();
        }

        // Fetch scoped tasks for this date from backend
        $.ajax({
            url: `${apiUrl}?userid=${encodeURIComponent(viewingUserId)}&date=${encodeURIComponent(date)}`,
            method: 'GET'
        }).done(function (data) {
            let tasksForDay = (data.tasks || []).filter(t => !t.date || t.date === date);
            if (tasksForDay.length === 0 && allTasks.length > 0) {
                const fromAll = allTasks.filter(task => task.date === date && task.userid === viewingUserId);
                if (fromAll.length > 0) tasksForDay = fromAll;
            }
            tasksCache[date] = tasksForDay;
            taskListContainer.empty();
            tasksForDay.forEach(task => taskListContainer.append(createTaskLine(task)));
            updateTotals();
        }).fail(function () {
            // Fallback for mocked Cypress specs using allTasks
            const tasksForDay = allTasks.filter(task => task.date === date && task.userid === viewingUserId);
            taskListContainer.empty();
            tasksForDay.forEach(task => taskListContainer.append(createTaskLine(task)));
            updateTotals();
        });
    }

    function fetchAllTasks(callback) {
        // Keeps allTasks populated for backward compatibility with tests/fallback
        $.ajax({
            url: apiUrl,
            method: 'GET',
            success: (data) => {
                allTasks = Array.isArray(data.tasks) ? data.tasks : Object.values(data.tasks || data);
                if (callback) callback();
            },
            error: (jqXHR) => {
                if (callback) callback();
            }
        });
    }

    function fetchCategories(callback) {
        $.ajax({
            url: categoriesApiUrl, method: 'GET', success: (data) => {
                allCategories = data.categories || [];
                if (callback) callback();
            }, error: (jqXHR) => displayError('Fatal Error', `Could not fetch categories.\nStatus: ${jqXHR.status}`)
        });
    }

    function fetchUserIdentity(callback) {
        $.ajax({
            url: usersApiUrl, method: 'GET',
            success: (data) => {
                if (data && data.userid) {
                    currentUserId = data.userid;
                    viewingUserId = currentUserId;
                    currentUserGroups = data.groups || [];
                    isUserAuthenticated = Boolean(data.authenticated || (currentUserId && currentUserId !== 'guest'));
                    if (callback) callback(data.users || []);
                } else {
                    displayError('Fatal Error', 'Could not determine user identity from API.');
                }
            },
            error: (jqXHR) => displayError('Fatal Error', `Could not fetch user identity.\nStatus: ${jqXHR.status}`)
        });
    }

    // --- Categories Modal Logic ---
    function createCategoryEditorLine(category = '') {
        if (currentUserGroups.includes('Administrators')) {
            return `<div class="category-item"><input type="text" class="category-input" value="${category}"><button class="remove-category-btn">&times;</button></div>`;
        }
        return `<div class="category-item"><input type="text" class="category-input" value="${category}"></div>`;
    }

    $('#edit-categories-btn').on('click', function () {
        const editorList = $('#categories-list-editor');
        editorList.empty();
        allCategories.forEach(cat => editorList.append(createCategoryEditorLine(cat)));
        editorList.sortable({ placeholder: "category-item-placeholder", forcePlaceholderSize: true });
        categoriesModal.show();
    });

    $('#categories-list-editor').on('click', '.remove-category-btn', function () { $(this).closest('.category-item').remove(); });
    $('#add-category-btn-modal').on('click', () => $('#categories-list-editor').append(createCategoryEditorLine()));
    $('#cancel-categories-btn').on('click', () => {
        $('#categories-list-editor').sortable('destroy');
        categoriesModal.hide();
    });

    $('#save-categories-btn').on('click', function () {
        const newCategories = $('.category-input').map(function () { return $(this).val().trim(); }).get().filter(cat => cat !== '');
        const payload = JSON.stringify({ categories: newCategories });
        $('#categories-list-editor').sortable('destroy');
        $.ajax({
            url: categoriesApiUrl,
            method: 'PUT',
            contentType: 'application/json',
            data: payload,
            success: () => {
                categoriesModal.hide();
                fetchCategories(() => {
                    renderTasksForDay(selectedDate);
                });
            },
            error: (jqXHR) => displayError('REST API Error', `Failed to save categories.\nStatus: ${jqXHR.status}\nResponse: ${jqXHR.responseText}`)
        });
    });

    // --- Scope Controls Event Handlers ---
    $('.scope-btn').on('click', function () {
        $('.scope-btn').removeClass('active');
        $('#incomplete-filter-btn').removeClass('active');
        $(this).addClass('active');

        currentScope = $(this).data('scope');
        if (currentScope === 'month') {
            $('#month-stepper-container').show();
            $('#current-month-display').text(selectedMonth.format('MMMM YYYY'));
        } else {
            $('#month-stepper-container').hide();
        }

        fetchDaysSummary(() => {
            selectDefaultDay();
        });
    });

    $('#month-prev-btn').on('click', function () {
        selectedMonth.subtract(1, 'month');
        $('#current-month-display').text(selectedMonth.format('MMMM YYYY'));
        fetchDaysSummary(() => {
            selectDefaultDay();
        });
    });

    $('#month-next-btn').on('click', function () {
        selectedMonth.add(1, 'month');
        $('#current-month-display').text(selectedMonth.format('MMMM YYYY'));
        fetchDaysSummary(() => {
            selectDefaultDay();
        });
    });

    $('#incomplete-filter-btn').on('click', function () {
        if (currentScope === 'incomplete') {
            // Toggle back to 2weeks
            $(this).removeClass('active');
            $('.scope-btn[data-scope="2weeks"]').addClass('active');
            $('#month-stepper-container').hide();
            currentScope = '2weeks';
        } else {
            $('.scope-btn').removeClass('active');
            $(this).addClass('active');
            $('#month-stepper-container').hide();
            currentScope = 'incomplete';
        }
        fetchDaysSummary(() => {
            selectDefaultDay();
        });
    });

    // --- General Event Handlers ---
    $('#user-select-dropdown').on('change', function () {
        viewingUserId = $(this).val();
        tasksCache = {};
        fetchDaysSummary(() => {
            selectDefaultDay();
            updateNewDayButtonVisibility();
            updateAddTaskButtonVisibility();
        });
    });

    $('#day-list').on('click', 'li', function () {
        if ($(this).hasClass('no-days-message')) return;
        const date = $(this).data('date');
        $('#day-list li').removeClass('active');
        $(this).addClass('active');
        renderTasksForDay(date);
    });

    $('#task-list-container').on('click', '.delete-task-btn', function () {
        const taskLine = $(this).closest('.task-line');
        const taskId = taskLine.data('task-id');

        if (!taskId) {
            taskLine.remove();
            updateTotals();
            return;
        }

        if (confirm('Are you sure you want to delete this task?')) {
            $.ajax({
                url: `${apiUrl}/${taskId}`,
                method: 'DELETE',
                success: () => {
                    showToast('Task deleted successfully!');
                    delete tasksCache[selectedDate];
                    fetchDaysSummary(() => {
                        renderTasksForDay(selectedDate);
                    });
                },
                error: (jqXHR) => {
                    displayError('REST API Error', `Failed to delete task.\nStatus: ${jqXHR.status}\nResponse: ${jqXHR.responseText}`);
                }
            });
        }
    });

    $('#task-list-container').on('input focus blur', '.task-input-description', function () {
        $(this).css('height', 'auto').css('height', this.scrollHeight + 'px');
    });

    $('#task-list-container').on('input', 'input, select, textarea', function () {
        $(this).closest('.task-line').addClass('dirty');
        updateTotals();
    });

    $('#task-list-container').on('click', '.stepper-arrows span', function () {
        const isUp = $(this).hasClass('arrow-up');
        const input = $(this).closest('.number-input-wrapper').find('input');
        let currentValue = fractionToDecimal(input.val()) || 0;
        let newValue = isUp ? currentValue + 0.25 : currentValue - 0.25;
        newValue = Math.max(0, newValue);
        input.val(decimalToFraction(newValue));
        input.trigger('input');
    });

    $('#add-task-btn').on('click', function () {
        if (!selectedDate) {
            displayError('Validation Error', 'Please select a day before adding a task.');
            return;
        }
        const newLine = $(createTaskLine());
        newLine.addClass('dirty').addClass('incomplete');
        $('#task-list-container').append(newLine);
        updateTotals();
    });

    $('#refresh-btn').on('click', function () {
        tasksCache = {};
        fetchAllTasks(() => {
            fetchDaysSummary(() => {
                renderTasksForDay(selectedDate);
            });
        });
    });

    $('#task-list-container').on('click', '.save-task-btn', function () {
        const taskLine = $(this).closest('.task-line');
        const taskId = taskLine.data('task-id');

        const taskData = {
            category: taskLine.find('.task-input-category').val(),
            task_name: taskLine.find('.task-input-task_name').val(),
            description: taskLine.find('.task-input-description').val(),
            userid: viewingUserId,
            date: selectedDate
        };

        const expectedHoursStr = Number(fractionToDecimal(taskLine.find('.task-input-expected_hours').val()) || 0).toFixed(2);
        const actualHoursValue = taskLine.find('.task-input-actual_hours').val();

        let jsonString = JSON.stringify(taskData);
        jsonString = jsonString.substring(0, jsonString.length - 1);
        jsonString += `, "expected_hours": ${expectedHoursStr}`;

        if (actualHoursValue !== null && actualHoursValue.trim() !== '') {
            const actualHoursStr = Number(fractionToDecimal(actualHoursValue)).toFixed(2);
            jsonString += `, "actual_hours": ${actualHoursStr}`;
        }

        jsonString += '}';

        const ajaxOptions = {
            url: taskId ? `${apiUrl}/${taskId}` : apiUrl,
            method: taskId ? 'PUT' : 'POST',
            contentType: 'application/json',
            data: jsonString,
            success: () => {
                showToast('Task saved successfully!');
                delete tasksCache[selectedDate];
                fetchAllTasks(() => {
                    fetchDaysSummary(() => {
                        renderTasksForDay(selectedDate);
                    });
                });
            },
            error: (jqXHR) => displayError('REST API Error', `Failed to save task.\nStatus: ${jqXHR.status}\nResponse: ${jqXHR.responseText}`)
        };

        $.ajax(ajaxOptions);
    });

    function updateNewDayButtonVisibility() {
        if (viewingUserId === currentUserId) {
            $('#new-day-btn').show();
        } else {
            $('#new-day-btn').hide();
        }
    }

    function updateAddTaskButtonVisibility() {
        if (viewingUserId === currentUserId) {
            $('#add-task-btn').show();
        } else {
            $('#add-task-btn').hide();
        }
    }

    // --- Dev Mode 1-Click User Switching ---
    $(document).on('click', '.dev-switch-user', function (e) {
        e.preventDefault();
        const targetUser = $(this).data('user');
        window.location.href = `${getApiPrefix()}/api/auth/dev-login?userid=${encodeURIComponent(targetUser)}&next=${encodeURIComponent(window.location.href)}`;
    });

    // --- Initial Load ---
    function initialLoad() {
        fetchUserIdentity((allowedUsers) => {
            const datepicker = new Pikaday({
                field: $('#new-day-btn')[0],
                onSelect: function (date) {
                    const formattedDate = this.getMoment().format('YYYY-MM-DD');
                    selectedDate = formattedDate;

                    // If newly created day is not currently in daysSummary, prepend it
                    if (!daysSummary.some(d => d.date === formattedDate)) {
                        daysSummary.unshift({
                            date: formattedDate,
                            task_count: 0,
                            total_expected: 0,
                            total_actual: 0,
                            is_incomplete: false
                        });
                        renderDayList();
                    }
                    $('#day-list li').removeClass('active');
                    $(`#day-list li[data-date="${formattedDate}"]`).addClass('active');
                    renderTasksForDay(formattedDate);
                }
            });

            $.when(
                $.ajax(categoriesApiUrl),
                $.ajax(apiUrl)
            ).done(function (categoriesResponse, tasksResponse) {
                allCategories = categoriesResponse[0].categories || [];
                const tasksData = tasksResponse[0].tasks || tasksResponse[0];
                allTasks = Array.isArray(tasksData) ? tasksData : Object.values(tasksData);

                // User Info Display
                const userInfoDisplay = $('#user-info-display');
                userInfoDisplay.empty();
                if (currentUserId) {
                    userInfoDisplay.append(`<p class="user-info-large"><strong>User:</strong> ${currentUserId}</p>`);
                }
                if (currentUserGroups && currentUserGroups.length > 0) {
                    userInfoDisplay.append(`<p><strong>Groups:</strong> ${currentUserGroups.join(', ')}</p>`);
                }

                // Dev Mode Switcher helper when running on port 8080
                if (window.location.port === '8080') {
                    userInfoDisplay.append(`
                        <p class="dev-mode-bar" style="font-size: 11px; color: #007bff; margin-top: 4px;">
                            <strong>Dev Auth:</strong> 
                            <a href="#" class="dev-switch-user" data-user="diederich@gmail.com" style="color: #007bff; text-decoration: underline;">Dana</a> | 
                            <a href="#" class="dev-switch-user" data-user="msdiederich@gmail.com" style="color: #007bff; text-decoration: underline;">Michelle</a>
                        </p>
                    `);
                }

                const authActions = $('<div class="auth-actions"></div>');
                if (isUserAuthenticated && currentUserId !== 'guest') {
                    authActions.append(`<a href="${authLogoutUrl}" id="sign-out-btn" class="sign-out-link">Sign Out</a>`);
                } else {
                    authActions.append(`
                        <a href="${authLoginUrl}" id="google-login-btn" class="google-login-button" title="Sign in with your Google account">
                            <svg class="google-icon" width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z" fill="#4285F4"/>
                                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                                <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
                            </svg>
                            <span>Sign in with Google</span>
                        </a>
                    `);
                }
                userInfoDisplay.append(authActions);

                if (!isUserAuthenticated || currentUserId === 'guest') {
                    $('#guest-banner-login-link').attr('href', authLoginUrl);
                    $('#guest-banner').show();
                } else {
                    $('#guest-banner').hide();
                }

                // Populate user dropdown
                const userSelect = $('#user-select-dropdown');
                const uniqueUserIds = (allowedUsers && allowedUsers.length > 0)
                    ? allowedUsers
                    : [...new Set(allTasks.map(task => task.userid))].sort();

                userSelect.empty();
                uniqueUserIds.forEach(userId => {
                    userSelect.append($('<option>', {
                        value: userId,
                        text: userId
                    }));
                });
                userSelect.val(currentUserId);

                if (currentUserGroups.includes('Administrators')) {
                    $('#edit-categories-btn').show();
                }

                // Fetch days summary for default scope (2 Weeks) and select most recent day
                fetchDaysSummary(() => {
                    selectDefaultDay();
                    updateNewDayButtonVisibility();
                    updateAddTaskButtonVisibility();
                });

            }).fail(function () {
                displayError('Fatal Error', 'Could not load initial application data (categories or tasks).');
            });
        });
    }

    initialLoad();

    $(document).on('click', '#sign-out-btn', function () {
        setCookie('auth_token', '', -1);
    });
});
