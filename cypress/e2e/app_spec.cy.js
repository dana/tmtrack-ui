describe('Time Tracker UI', () => {

  beforeEach(() => {
    cy.visit('/');
  });

  it('should display the list of dates on the left sidebar', () => {
    // Intercept API calls to provide mock data
    cy.intercept('GET', '**/api/v1/users', {
      statusCode: 200,
      body: {
        userid: 'testuser',
        groups: ['Users']
      }
    }).as('getUsers');

    cy.intercept('GET', '**/api/v1/categories', {
      statusCode: 200,
      body: {
        categories: ['Category 1', 'Category 2']
      }
    }).as('getCategories');

    cy.intercept('GET', '**/api/v1/tasks', {
      statusCode: 200,
      body: {
        tasks: [
          { task_id: 1, date: '2025-10-01', userid: 'testuser', category: 'Category 1', task_name: 'Task 1', expected_hours: 1, actual_hours: 1 },
          { task_id: 2, date: '2025-10-02', userid: 'testuser', category: 'Category 2', task_name: 'Task 2', expected_hours: 2, actual_hours: 2 }
        ]
      }
    }).as('getTasks');

    // Wait for all API calls to complete
    cy.wait(['@getUsers', '@getCategories', '@getTasks']);

    // Check that the day list is visible
    cy.get('#day-list').should('be.visible');

    // Check that the day list contains at least one date
    cy.get('#day-list li').should('have.length.greaterThan', 0);
  });

  it('should allow a user to add a new day, add a task, save, and see the task after reload', () => {
    // Add a new day
    cy.get('#new-day-btn').click();

    // Get the text of the new day, which will be the last one in the list
    cy.get('#day-list li').last().then(newDay => {
      const newDayText = newDay.text();

      // Add a new task
      cy.get('#add-task-btn').click();

      // Fill in the task details for the new task
      cy.get('.task-line').last().find('.task-input-category').select(1);
      cy.get('.task-line').last().find('.task-input-task_name').type('New Task');
      cy.get('.task-line').last().find('.task-input-expected_hours').type('2');
      cy.get('.task-line').last().find('.task-input-actual_hours').type('1.5');
      cy.get('.task-line').last().find('.save-task-btn').click();

      // Reload the page
      cy.reload();

      // Find and click the new day
      cy.contains('#day-list li', newDayText).click();

      // Verify the new task is there
      cy.get('.task-line').last().find('.task-input-task_name').should('have.value', 'New Task');
      cy.get('.task-line').last().find('.task-input-expected_hours').should('have.value', '2');
      cy.get('.task-line').last().find('.task-input-actual_hours').should('have.value', '1.5');
    });
  });

});
