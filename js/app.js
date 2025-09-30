$(document).ready(function() {
    // --- API and State Variables ---
    const apiUrl = 'http://localhost:5000/api/v1/tasks';
    const usersApiUrl = 'http://localhost:5000/api/v1/users';
    const categoriesApiUrl = 'http://localhost:5000/api/v1/categories';
    let allTasks = [];
    let allCategories = [];
    let selectedDate = null;

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

    // --- Task & UI Rendering Logic ---
    function createTaskLine(task = {}) { /* ... unchanged ... */ 
        const taskId = task.task_id || '';
        const taskName = task.task_name || '';
        const expectedHours = task.expected_hours || '';
        const actualHours = task.actual_hours || '';
        const description = task.description || '';
        let categoryOptions = allCategories.map(cat => 
            `<option value="${cat}" ${task.category === cat ? 'selected' : ''}>${cat}</option>`
        ).join('');
        return `
            <div class="task-line" data-task-id="${taskId}">
                <div class="task-field task-field-category"><label>Category</label><select class="task-input-category" required>${categoryOptions}</select></div>
                <div class="task-field task-field-task_name"><label>Task Name</label><input type="text" class="task-input-task_name" value="${taskName}" required></div>
                <div class="task-field task-field-expected_hours"><label>Expected</label><input type="number" step="0.01" class="task-input-expected_hours" value="${expectedHours}" required></div>
                <div class="task-field task-field-actual_hours"><label>Actual</label><input type="number" step="0.01" class="task-input-actual_hours" value="${actualHours}"></div>
                <div class="task-field task-field-description"><label>Description</label><input type="text" class="task-input-description" value="${description}"></div>
                <button class="save-task-btn">Save</button>
            </div>
        `;
    }
    function renderTasksForDay(date) { /* ... unchanged ... */ 
        selectedDate = date;
        const taskListContainer = $('#task-list-container');
        taskListContainer.empty();
        const selectedUser = $('#userid').val();
        if (!selectedUser || !date) return;
        const tasksForDay = allTasks.filter(task => task.date === date && task.userid === selectedUser);
        tasksForDay.forEach(task => taskListContainer.append(createTaskLine(task)));
    }
    function renderDayList() { /* ... unchanged ... */ 
        const dayList = $('#day-list');
        dayList.empty();
        const selectedUser = $('#userid').val();
        if (!selectedUser) return;
        const tasksForUser = allTasks.filter(task => task.userid === selectedUser);
        const uniqueDates = [...new Set(tasksForUser.map(task => task.date))];
        uniqueDates.sort((a, b) => new Date(b) - new Date(a));
        uniqueDates.forEach(date => {
            const listItem = $(`<li data-date="${date}">${date}</li>`);
            if (date === selectedDate) listItem.addClass('active');
            dayList.append(listItem);
        });
    }

    // --- Data Fetching ---
    function fetchAllTasks(callback) { /* ... unchanged ... */ 
        $.ajax({ url: apiUrl, method: 'GET', success: (data) => {
                allTasks = Array.isArray(data.tasks) ? data.tasks : Object.values(data.tasks || data);
                if (callback) callback();
            }, error: (jqXHR) => displayError('REST API Error', `Could not fetch tasks.\nStatus: ${jqXHR.status}`)
        });
    }
    function populateUserDropdown(users) { /* ... unchanged ... */ 
        const userDropdown = $('#userid');
        userDropdown.empty();
        userDropdown.append('<option value="" selected disabled>Select a User</option>');
        users.forEach(user => userDropdown.append(`<option value="${user}">${user}</option>`));
    }
    function fetchCategories(callback) { /* ... unchanged ... */ 
        $.ajax({ url: categoriesApiUrl, method: 'GET', success: (data) => {
                allCategories = data.categories || [];
                if (callback) callback();
            }, error: (jqXHR) => displayError('Fatal Error', `Could not fetch categories.\nStatus: ${jqXHR.status}`)
        });
    }
    function fetchUsers() { /* ... unchanged ... */ 
        $.ajax({ url: usersApiUrl, method: 'GET', success: (data) => {
                populateUserDropdown(data.users || []);
                fetchCategories(fetchAllTasks);
            }, error: (jqXHR) => displayError('Fatal Error', `Could not fetch user list.\nStatus: ${jqXHR.status}`)
        });
    }

    // --- Categories Modal Logic ---
    function createCategoryEditorLine(category = '') { /* ... unchanged ... */ 
        return `<div class="category-item"><input type="text" class="category-input" value="${category}"><button class="remove-category-btn">&times;</button></div>`;
    }
    $('#edit-categories-btn').on('click', function() { /* ... unchanged ... */ 
        const editorList = $('#categories-list-editor');
        editorList.empty();
        allCategories.forEach(cat => editorList.append(createCategoryEditorLine(cat)));
        categoriesModal.show();
    });
    $('#categories-list-editor').on('click', '.remove-category-btn', function() { /* ... unchanged ... */ 
        $(this).closest('.category-item').remove();
    });
    $('#add-category-btn-modal').on('click', function() { /* ... unchanged ... */ 
        $('#categories-list-editor').append(createCategoryEditorLine());
    });
    $('#cancel-categories-btn').on('click', () => categoriesModal.hide());
    $('#save-categories-btn').on('click', function() { /* ... unchanged ... */ 
        const newCategories = $('.category-input').map(function() { return $(this).val().trim(); }).get().filter(cat => cat !== '');
        const payload = JSON.stringify({ categories: newCategories });
        $.ajax({
            url: categoriesApiUrl, method: 'PUT', contentType: 'application/json', data: payload,
            success: () => {
                categoriesModal.hide();
                fetchCategories(() => {
                    renderDayList();
                    renderTasksForDay(selectedDate);
                });
            },
            error: (jqXHR) => displayError('REST API Error', `Failed to save categories.\nStatus: ${jqXHR.status}\nResponse: ${jqXHR.responseText}`)
        });
    });

    // --- General Event Handlers ---
    
    // **NEW**: Highlight task lines when they are edited
    $('#task-list-container').on('input', 'input, select', function() {
        $(this).closest('.task-line').addClass('dirty');
    });

    $('#userid').on('change', function() { /* ... unchanged ... */ 
        const selectedUser = $(this).val();
        const incompleteTasks = allTasks.filter(task => task.userid === selectedUser && !task.actual_hours);
        if (incompleteTasks.length > 0) {
            incompleteTasks.sort((a, b) => new Date(a.date) - new Date(b.date));
            selectedDate = incompleteTasks[0].date;
        } else {
            const userTasks = allTasks.filter(task => task.userid === selectedUser);
            if (userTasks.length > 0) {
                userTasks.sort((a, b) => new Date(b.date) - new Date(a.date));
                selectedDate = userTasks[0].date;
            } else {
                selectedDate = null;
            }
        }
        renderDayList();
        renderTasksForDay(selectedDate);
    });
    $('#day-list').on('click', 'li', function() { /* ... unchanged ... */ 
        const date = $(this).data('date');
        $('#day-list li').removeClass('active');
        $(this).addClass('active');
        renderTasksForDay(date);
    });
    
    // **MODIFIED**: Highlight new tasks immediately upon creation
    $('#add-task-btn').on('click', function() {
        if (!selectedDate) {
            displayError('Validation Error', 'Please select a day before adding a task.');
            return;
        }
        const newLine = $(createTaskLine());
        newLine.addClass('dirty'); // Add highlight class
        $('#task-list-container').append(newLine);
    });
    
    $('#new-day-btn').on('click', function() { /* ... unchanged ... */ 
        const selectedUser = $('#userid').val();
        if (!selectedUser) {
            displayError('Validation Error', 'Please select a user before creating a new day.');
            return;
        }
        const today = new Date().toISOString().split('T')[0];
        $('#day-list li').removeClass('active');
        selectedDate = today;
        renderTasksForDay(today);
        renderDayList();
    });
    $('#task-list-container').on('click', '.save-task-btn', function() { /* ... unchanged ... */
        const taskLine = $(this).closest('.task-line');
        const taskId = taskLine.data('task-id');
        const userid = $('#userid').val();
        if (!userid) {
            displayError('Validation Error', 'A UserId must be selected.');
            return;
        }
        const taskData = {
            category: taskLine.find('.task-input-category').val(),
            task_name: taskLine.find('.task-input-task_name').val(),
            expected_hours: taskLine.find('.task-input-expected_hours').val(),
            actual_hours: taskLine.find('.task-input-actual_hours').val(),
            description: taskLine.find('.task-input-description').val(),
            userid: userid, date: selectedDate
        };
        if (!taskData.category || !taskData.task_name || !taskData.expected_hours) {
            displayError('Validation Error', 'Category, Task Name, and Expected Hours are required.');
            return;
        }
        const expectedHours = parseFloat(taskData.expected_hours);
        if (isNaN(expectedHours)) {
            displayError('Validation Error', '"Expected Hours" must be a number.');
            return;
        }
        taskData.expected_hours = expectedHours;
        if (taskData.actual_hours && taskData.actual_hours.trim() !== '') {
            const actualHours = parseFloat(taskData.actual_hours);
            if (isNaN(actualHours)) {
                displayError('Validation Error', '"Actual Hours" must be a number if provided.');
                return;
            }
            taskData.actual_hours = actualHours;
        } else {
            delete taskData.actual_hours;
        }
        const method = taskId ? 'PUT' : 'POST';
        const url = taskId ? `${apiUrl}/${taskId}` : apiUrl;
        if (taskId) taskData.task_id = taskId;
        let payload = JSON.stringify(taskData);
        payload = payload.replace(/"expected_hours":(\d+)([,}])/g, '"expected_hours":$1.0$2');
        payload = payload.replace(/"actual_hours":(\d+)([,}])/g, '"actual_hours":$1.0$2');
        $.ajax({
            url: url, method: method, contentType: 'application/json', data: payload,
            success: () => {
                alert('Task saved successfully!');
                fetchAllTasks(() => {
                    renderDayList();
                    renderTasksForDay(selectedDate);
                });
            },
            error: (jqXHR) => displayError('REST API Error', `Failed to save task.\nStatus: ${jqXHR.status}\nResponse: ${jqXHR.responseText}`)
        });
    });

    // --- Initial Load ---
    fetchUsers();
});
