describe('New Day and Task Creation', () => {
  it('should allow a user to add a new day and a task to it', () => {
    // Mock initial load APIs with no pre-existing tasks
    cy.intercept('GET', '**/api/v1/users', {
      statusCode: 200,
      body: { userid: 'testuser', groups: ['Users'] }
    }).as('getUsers');

    cy.intercept('GET', '**/api/v1/categories', {
      statusCode: 200,
      body: { categories: ['General', 'Planning'] }
    }).as('getCategories');

    cy.intercept('GET', '**/api/v1/tasks', {
      statusCode: 200,
      body: { tasks: [] }
    }).as('getInitialTasks');

    cy.visit('/');
    cy.wait(['@getUsers', '@getCategories', '@getInitialTasks']);

    // Get today's date in YYYY-MM-DD format for mocking
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const formattedDate = `${yyyy}-${mm}-${dd}`;

    // Mock APIs for the "add task" action
    cy.intercept('POST', '**/api/v1/tasks', (req) => {
      expect(req.body.date).to.equal(formattedDate);
      req.reply({
        statusCode: 201,
        body: { id: 1 }
      });
    }).as('addTask');

    // Mock the GET request that happens after adding. It should return the new task.
    cy.intercept('GET', '**/api/v1/tasks', {
      statusCode: 200,
      body: {
        tasks: [{
          task_id: 1, category: 'Planning', task_name: 'Plan weekly goals',
          expected_hours: '2', actual_hours: '', description: 'Review and set goals for the week',
          date: formattedDate, userid: 'testuser'
        }]
      }
    }).as('getTasksAfterAdd');

    // --- User Actions ---
    // 1. Add a new day
    cy.get('#new-day-btn').click();

    // 2. The new day should be selected automatically, now add a task
    cy.get('#add-task-btn').click();

    // 3. Fill out the new task form and save
    cy.get('.task-line').last().within(() => {
      cy.get('.task-input-category').select('Planning');
      cy.get('.task-input-task_name').type('Plan weekly goals');
      cy.get('.task-input-expected_hours').clear().type('2');
      cy.get('.task-input-description').type('Review and set goals for the week');
      cy.get('.save-task-btn').click();
    });

    // --- Wait and Assert ---
    cy.wait('@addTask');
    cy.wait('@getTasksAfterAdd');

    // Verify the new task is displayed with the correct value
    cy.get('#task-list-container .task-input-task_name[value="Plan weekly goals"]').should('be.visible');
  });
});
