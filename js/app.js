$(document).ready(function() {
    const apiUrl = 'http://localhost:5000/api/v1/tasks';

    // Modal elements
    const modal = $('#error-modal');
    const closeModalBtn = $('.close-btn');
    const errorTextContainer = $('#error-text');

    // Hide modal when the close button is clicked
    closeModalBtn.on('click', function() {
        modal.hide();
    });

    // Hide modal when clicking on the background (outside of the modal content)
    $(window).on('click', function(event) {
        if ($(event.target).is(modal)) {
            modal.hide();
        }
    });

    // Helper function to format and display detailed error messages in the modal
    function displayError(jqXHR, textStatus, errorThrown, context) {
        let errorMessage = `Error Context: ${context}\n\n`;
        errorMessage += `Status Code: ${jqXHR.status} (${jqXHR.statusText})\n`;
        errorMessage += `Text Status: ${textStatus}\n`;
        if (errorThrown) {
            errorMessage += `Error Thrown: ${errorThrown}\n`;
        }
        errorMessage += `\n--- Response Headers ---\n${jqXHR.getAllResponseHeaders()}`;
        errorMessage += `\n--- Response Body ---\n${jqXHR.responseText || '(No response body)'}`;
        
        errorTextContainer.text(errorMessage);
        modal.show();
    }

    function fetchTasks() {
        $.ajax({
            url: apiUrl,
            method: 'GET',
            success: function(data) {
                const dayList = $('#day-list');
                dayList.empty();

                const tasks = data.tasks || data;
                const tasksArray = Array.isArray(tasks) ? tasks : Object.values(tasks);
                const sortedTasks = tasksArray.sort((a, b) => new Date(b.date) - new Date(a.date));

                sortedTasks.forEach(task => {
                    if (task && task.date) {
                        const listItem = $(`<li data-task-id="${task.task_id}">${task.date}</li>`);
                        dayList.append(listItem);
                    }
                });
            },
            error: function(jqXHR, textStatus, errorThrown) {
                displayError(jqXHR, textStatus, errorThrown, 'Could not fetch tasks from the server.');
            }
        });
    }

    $('#day-list').on('click', 'li', function() {
        const taskId = $(this).data('task-id');
        $('#day-list li').removeClass('active');
        $(this).addClass('active');

        $.ajax({
            url: `${apiUrl}/${taskId}`,
            method: 'GET',
            success: function(data) {
                // **THE FIX**: Check if the task object is nested within a 'task' property.
                // If data.task exists, use it; otherwise, use the data object itself.
                const task = data.task || data;

                // Now the form will populate correctly.
                $('#task_id').val(task.task_id);
                $('#userid').val(task.userid);
                $('#date').val(task.date);
                $('#task_name').val(task.task_name);
                $('#category').val(task.category);
                $('#expected_hours').val(task.expected_hours);
                $('#actual_hours').val(task.actual_hours);
                $('#description').val(task.description);
            },
            error: function(jqXHR, textStatus, errorThrown) {
                displayError(jqXHR, textStatus, errorThrown, `Could not fetch details for task ID: ${taskId}.`);
            }
        });
    });

    $('#new-day-btn').on('click', function() {
        $('#task-form').find('input[type=text], input[type=date], input[type=number], textarea, input[type=hidden]').val('');
        $('#day-list li').removeClass('active');
    });

    $('#task-form').on('submit', function(event) {
        event.preventDefault();

        const expectedHoursStr = $('#expected_hours').val();
        const actualHoursStr = $('#actual_hours').val();

        let expectedHours = parseFloat(expectedHoursStr);
        if (isNaN(expectedHours)) {
            alert('Error: "Expected Hours" must be a valid number.');
            return;
        }

        let actualHours = null;
        if (actualHoursStr && actualHoursStr.trim() !== '') {
            actualHours = parseFloat(actualHoursStr);
            if (isNaN(actualHours)) {
                alert('Error: "Actual Hours" must be a valid number if provided.');
                return;
            }
        }
        
        const taskId = $('#task_id').val();
        const taskData = {
            userid: $('#userid').val(),
            date: $('#date').val(),
            task_name: $('#task_name').val(),
            category: $('#category').val(),
            expected_hours: expectedHours,
            description: $('#description').val()
        };
        
        if (actualHours !== null) {
            taskData.actual_hours = actualHours;
        }

        let method = 'POST';
        let url = apiUrl;

        if (taskId) {
            method = 'PUT';
            url = `${apiUrl}/${taskId}`;
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
                fetchTasks();
                if (method === 'POST') {
                    $('#new-day-btn').trigger('click');
                }
                alert('Task saved successfully!');
            },
            error: function(jqXHR, textStatus, errorThrown) {
                displayError(jqXHR, textStatus, errorThrown, 'Failed to save the task.');
            }
        });
    });

    fetchTasks();
});
