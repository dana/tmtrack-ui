$(document).ready(function() {
    const apiUrl = 'http://localhost:5000/api/v1/tasks';
    let allTasks = []; // Cache for all tasks from the server
    let selectedDate = null; // Track the currently selected date

    // --- Modal Logic ---
    const modal = $('#error-modal');
    const closeModalBtn = $('.close-btn');

    closeModalBtn.on('click', () => modal.hide());
    $(window).on('click', (event) => {
        if ($(event.target).is(modal)) {
            modal.hide();
        }
    });

    function displayError(title, message) {
        $('#error-modal-title').text(title);
        $('#error-text').text(message);
        modal.show();
    }

    // --- Task Rendering Logic ---
    function createTaskLine(task = {}) {
        const taskId = task.task_id || '';
        const category = task.category || '';
        const taskName = task.task_name || '';
        const expectedHours = task.expected_hours || '';
        const actualHours = task.actual_hours || '';
        const description = task.description || '';

        return `
            <div class="task-line" data-task-id="${taskId}">
                <div class="task-field task-field-category">
                    <label>Category</label>
                    <input type="text" class="task-input-category" value="${category}" required>
                </div>
                <div class="task-field task-field-task_name">
                    <label>Task Name</label>
                    <input type="text" class="task-input-task_name" value="${taskName}" required>
                </div>
                <div class="task-field task-field-expected_hours">
                    <label>Expected</label>
                    <input type="number" step="0.01" class="task-input-expected_hours" value="${expectedHours}" required>
                </div>
                <div class="task-field task-field-actual_hours">
                    <label>Actual</label>
                    <input type="number" step="0.01" class="task-input-actual_hours" value="${actualHours}">
                </div>
                <div class="task-field task-field-description">
                    <label>Description</label>
                    <input type="text" class="task-input-description" value="${description}">
                </div>
                <button class="save-task-btn">Save</button>
            </div>
        `;
    }

    function renderTasksForDay(date) {
        selectedDate = date;
        const tasksForDay = allTasks.filter(task => task.date === date);
        const taskListContainer = $('#task-list-container');
        taskListContainer.empty();
        tasksForDay.forEach(task => {
            taskListContainer.append(createTaskLine(task));
        });
    }

    function renderDayList() {
        const dayList = $('#day-list');
        dayList.empty();
        const uniqueDates = [...new Set(allTasks.map(task => task.date))];
        uniqueDates.sort((a, b) => new Date(b) - new Date(a));

        uniqueDates.forEach(date => {
            const listItem = $(`<li data-date="${date}">${date}</li>`);
            if (date === selectedDate) {
                listItem.addClass('active');
            }
            dayList.append(listItem);
        });
    }

    // --- Data Fetching ---
    function fetchAllTasks() {
        $.ajax({
            url: apiUrl,
            method: 'GET',
            success: (data) => {
                const tasks = data.tasks || data;
                allTasks = Array.isArray(tasks) ? tasks : Object.values(tasks);
                renderDayList();
                if (selectedDate) {
                    renderTasksForDay(selectedDate);
                }
            },
            error: (jqXHR, textStatus, errorThrown) => {
                displayError('REST API Error', `Could not fetch tasks from the server.\n\nStatus: ${jqXHR.status}`);
            }
        });
    }

    // --- Event Handlers ---
    $('#day-list').on('click', 'li', function() {
        const date = $(this).data('date');
        $('#day-list li').removeClass('active');
        $(this).addClass('active');
        renderTasksForDay(date);
    });

    $('#add-task-btn').on('click', function() {
        if (!selectedDate) {
            displayError('Validation Error', 'Please select a day from the list before adding a task.');
            return;
        }
        $('#task-list-container').append(createTaskLine());
    });
    
    $('#new-day-btn').on('click', function() {
        const today = new Date().toISOString().split('T')[0];
        $('#day-list li').removeClass('active');
        $('#task-list-container').empty();
        selectedDate = today;
        renderTasksForDay(today); // Render empty list for a potentially new day
    });

    $('#task-list-container').on('click', '.save-task-btn', function() {
        const taskLine = $(this).closest('.task-line');
        const taskId = taskLine.data('task-id');
        
        // --- Gather and Validate Data ---
        const userid = $('#userid').val();
        if (!userid) {
            displayError('Validation Error', 'The UserId in the sidebar must be filled out before saving.');
            return;
        }
        
        const taskData = {
            category: taskLine.find('.task-input-category').val(),
            task_name: taskLine.find('.task-input-task_name').val(),
            expected_hours: taskLine.find('.task-input-expected_hours').val(),
            actual_hours: taskLine.find('.task-input-actual_hours').val(),
            description: taskLine.find('.task-input-description').val(),
            userid: userid,
            date: selectedDate
        };

        if (!taskData.category || !taskData.task_name || !taskData.expected_hours) {
            displayError('Validation Error', 'Category, Task Name, and Expected Hours are required fields.');
            return;
        }

        const expectedHours = parseFloat(taskData.expected_hours);
        if (isNaN(expectedHours)) {
            displayError('Validation Error', '"Expected Hours" must be a valid number.');
            return;
        }
        taskData.expected_hours = expectedHours;

        if (taskData.actual_hours && taskData.actual_hours.trim() !== '') {
            const actualHours = parseFloat(taskData.actual_hours);
            if (isNaN(actualHours)) {
                displayError('Validation Error', '"Actual Hours" must be a valid number if provided.');
                return;
            }
            taskData.actual_hours = actualHours;
        } else {
            delete taskData.actual_hours; // Omit if empty
        }

        // --- Prepare and Send AJAX Request ---
        const method = taskId ? 'PUT' : 'POST';
        const url = taskId ? `${apiUrl}/${taskId}` : apiUrl;
        if (taskId) {
            taskData.task_id = taskId;
        }

        let payload = JSON.stringify(taskData);
        payload = payload.replace(/"expected_hours":(\d+)([,}])/g, '"expected_hours":$1.0$2');
        payload = payload.replace(/"actual_hours":(\d+)([,}])/g, '"actual_hours":$1.0$2');

        $.ajax({
            url: url,
            method: method,
            contentType: 'application/json',
            data: payload,
            success: function() {
                alert('Task saved successfully!');
                fetchAllTasks(); // Refresh all data
            },
            error: function(jqXHR, textStatus, errorThrown) {
                 displayError('REST API Error', `Failed to save task.\nStatus: ${jqXHR.status}\nResponse: ${jqXHR.responseText}`);
            }
        });
    });

    // --- Initial Load ---
    fetchAllTasks();
});
