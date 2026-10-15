console.log('APP.JS LOADED (Top Level)');
$(document).ready(function () {
    // --- Fraction/Decimal Conversion ---
    function decimalToFraction(decimal) {
        if (decimal === '' || decimal === null || isNaN(decimal)) {
            return '';
        }
        if (decimal === 0) {
            return '0';
        }

        const wholePart = Math.floor(decimal);
        const fractionalPart = decimal - wholePart;

        if (fractionalPart === 0) {
            return String(wholePart);
        }

        let fraction = '';
        if (fractionalPart === 0.25) {
            fraction = '1/4';
        } else if (fractionalPart === 0.5) {
            fraction = '1/2';
        } else if (fractionalPart === 0.75) {
            fraction = '3/4';
        } else {
            // Fallback for other decimals, though not expected with the stepper
            return decimal.toFixed(2);
        }

        if (wholePart === 0) {
            return fraction;
        } else {
            return `${wholePart} ${fraction}`;
        }
    }

    function fractionToDecimal(fractionStr) {
        if (fractionStr === '' || fractionStr === null) {
            return '';
        }
        if (!isNaN(fractionStr)) {
            return parseFloat(fractionStr);
        }

        const parts = fractionStr.trim().split(' ');
        let total = 0;

        for (const part of parts) {
            if (part.includes('/')) {
                const fractionParts = part.split('/');
                if (fractionParts.length === 2) {
                    const num = parseInt(fractionParts[0], 10);
                    const den = parseInt(fractionParts[1], 10);
                    if (den !== 0) {
                        total += num / den;
                    }
                }
            } else {
                total += parseInt(part, 10);
            }
        }
        return total;
    }


    // --- API and State Variables ---
    const getApiPrefix = () => {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            if (window.location.port === '8080') {
                return 'http://' + window.location.hostname + ':5050';
            }
            return 'http://localhost:5000';
        }
        if (window.location.hostname.includes('diederich.ai') || window.location.pathname.startsWith('/tmtrack')) {
            return '/tmtrack';
        }
        return '';
    };
    const apiUrl = getApiPrefix() + '/api/v1/tasks';
    const usersApiUrl = getApiPrefix() + '/api/v1/users';
    const categoriesApiUrl = getApiPrefix() + '/api/v1/categories';
    const authLoginUrl = getApiPrefix() + '/api/auth/google/login';
    const authLogoutUrl = getApiPrefix() + '/api/auth/logout';
    let allTasks = [];
    let allCategories = [];
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
        // If auth_token is provided in URL, save it to cookie and clean URL
        setCookie('auth_token', authToken, 7); // Save for 7 days
        urlParams.delete('auth_token');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.history.replaceState({}, document.title, newUrl);
    } else {
        // Check for auth_token in cookie
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
                // Replace NaN with null, but ignore NaN inside strings
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

    // --- Task & UI Rendering Logic ---
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

    function renderTasksForDay(date) {
        selectedDate = date;
        updateSelectedDateDisplay(date);
        const taskListContainer = $('#task-list-container');
        taskListContainer.empty();
        if (!viewingUserId || !date) return;
        const tasksForDay = allTasks.filter(task => task.date === date && task.userid === viewingUserId);
        tasksForDay.forEach(task => taskListContainer.append(createTaskLine(task)));
        updateTotals();
    }
    function renderDayList() {
        const dayList = $('#day-list');
        dayList.empty();
        if (!viewingUserId) return;
        const tasksForUser = allTasks.filter(task => task.userid === viewingUserId);
        const uniqueDates = [...new Set(tasksForUser.map(task => task.date))];
        uniqueDates.sort((a, b) => new Date(b) - new Date(a));
        const dayAbbreviations = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        uniqueDates.forEach(date => {
            const dateObj = new Date(date + 'T00:00:00');
            const dayAbbr = dayAbbreviations[dateObj.getDay()];
            const displayDate = `${date} ${dayAbbr}`;
            const listItem = $(`<li data-date="${date}">${displayDate}</li>`);
            const hasIncompleteTasks = tasksForUser.some(task =>
                task.date === date &&
                (task.actual_hours === null || task.actual_hours === undefined || task.actual_hours === '')
            );
            if (hasIncompleteTasks) listItem.addClass('day-incomplete');
            if (date === selectedDate) listItem.addClass('active');
            dayList.append(listItem);
        });
    }

    // --- Data Fetching ---
    function fetchAllTasks(callback) {
        $.ajax({
            url: apiUrl, method: 'GET', success: (data) => {
                allTasks = Array.isArray(data.tasks) ? data.tasks : Object.values(data.tasks || data);
                if (callback) callback();
            }, error: (jqXHR) => displayError('REST API Error', `Could not fetch tasks.\nStatus: ${jqXHR.status}`)
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
                    if (callback) callback();
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

    // --- General Event Handlers ---
    $('#user-select-dropdown').on('change', function () {
        viewingUserId = $(this).val();
        const userTasks = allTasks.filter(task => task.userid === viewingUserId);
        if (userTasks.length > 0) {
            userTasks.sort((a, b) => new Date(b.date) - new Date(a.date));
            selectedDate = userTasks[0].date;
        } else {
            selectedDate = null;
        }
        renderDayList();
        renderTasksForDay(selectedDate);
        updateNewDayButtonVisibility();
        updateAddTaskButtonVisibility();
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
                    fetchAllTasks(() => {
                        renderDayList();
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
    $('#day-list').on('click', 'li', function () {
        const date = $(this).data('date');
        $('#day-list li').removeClass('active');
        $(this).addClass('active');
        renderTasksForDay(date);
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
        fetchAllTasks(() => {
            renderDayList();
            renderTasksForDay(selectedDate);
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
                fetchAllTasks(() => {
                    renderDayList();
                    renderTasksForDay(selectedDate);
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

    // --- Initial Load ---
    function initialLoad() {
        fetchUserIdentity(() => {
            const datepicker = new Pikaday({
                field: $('#new-day-btn')[0],
                onSelect: function (date) {
                    const formattedDate = this.getMoment().format('YYYY-MM-DD');
                    $('#day-list li').removeClass('active');
                    selectedDate = formattedDate;
                    renderTasksForDay(formattedDate);
                    renderDayList();
                }
            });

            $.when(
                $.ajax(categoriesApiUrl),
                $.ajax(apiUrl)
            ).done(function (categoriesResponse, tasksResponse) {
                allCategories = categoriesResponse[0].categories || [];
                const tasksData = tasksResponse[0].tasks || tasksResponse[0];
                allTasks = Array.isArray(tasksData) ? tasksData : Object.values(tasksData);

                const userInfoDisplay = $('#user-info-display');
                userInfoDisplay.empty();
                if (currentUserId) {
                    userInfoDisplay.append(`<p class="user-info-large"><strong>User:</strong> ${currentUserId}</p>`);
                }
                if (currentUserGroups && currentUserGroups.length > 0) {
                    userInfoDisplay.append(`<p><strong>Groups:</strong> ${currentUserGroups.join(', ')}</p>`);
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

                const userSelect = $('#user-select-dropdown');
                const uniqueUserIds = [...new Set(allTasks.map(task => task.userid))];
                uniqueUserIds.sort();
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

                const incompleteTasks = allTasks.filter(task => task.userid === viewingUserId && !task.actual_hours);
                if (incompleteTasks.length > 0) {
                    incompleteTasks.sort((a, b) => new Date(a.date) - new Date(b.date));
                    selectedDate = incompleteTasks[0].date;
                } else {
                    const userTasks = allTasks.filter(task => task.userid === viewingUserId);
                    if (userTasks.length > 0) {
                        userTasks.sort((a, b) => new Date(b.date) - new Date(a.date));
                        selectedDate = userTasks[0].date;
                    } else {
                        selectedDate = null;
                    }
                }
                renderDayList();
                renderTasksForDay(selectedDate);
                updateNewDayButtonVisibility();
                updateAddTaskButtonVisibility();

            }).fail(function () {
                displayError('Fatal Error', 'Could not load initial application data (categories or tasks).');
            });
        });
    }
    initialLoad();

    // setInterval(backgroundRefresh, 10000);

    function backgroundRefresh() {
        fetchAllTasks(() => {
            renderDayList();
            const tasksForDay = allTasks.filter(task => task.date === selectedDate && task.userid === viewingUserId);
            const taskListContainer = $('#task-list-container');
            const existingTaskIds = [];

            // Update existing tasks and collect IDs
            taskListContainer.find('.task-line').each(function () {
                const taskLine = $(this);
                const taskId = taskLine.data('task-id');
                existingTaskIds.push(taskId);

                if (taskLine.hasClass('dirty')) {
                    return; // Skip dirty tasks
                }

                const taskData = tasksForDay.find(t => t.task_id === taskId);
                if (taskData) {
                    taskLine.find('.task-input-category').val(taskData.category);
                    taskLine.find('.task-input-task_name').val(taskData.task_name);
                    taskLine.find('.task-input-expected_hours').val(decimalToFraction(taskData.expected_hours));
                    taskLine.find('.task-input-actual_hours').val(decimalToFraction(taskData.actual_hours));
                    taskLine.find('.task-input-description').val(taskData.description);
                }
            });

            // Add new tasks
            tasksForDay.forEach(task => {
                if (!existingTaskIds.includes(task.task_id)) {
                    taskListContainer.append(createTaskLine(task));
                }
            });

            // Remove deleted tasks
            existingTaskIds.forEach(taskId => {
                if (taskId && !tasksForDay.some(t => t.task_id === taskId)) {
                    $(`.task-line[data-task-id="${taskId}"]`).remove();
                }
            });
        });
    }

    $(document).on('click', '#sign-out-btn', function () {
        setCookie('auth_token', '', -1);
    });

});
