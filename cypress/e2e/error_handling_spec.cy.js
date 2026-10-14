describe('Error Handling and Fatal Error Modals', () => {
  it('should display error modal when user identity API fails', () => {
    cy.intercept('GET', '**/api/v1/users', {
      statusCode: 500,
      body: 'Internal Server Error'
    }).as('getUsersError');

    cy.visit('/');
    cy.wait('@getUsersError');

    cy.get('#error-modal').should('be.visible');
    cy.get('#error-modal-title').should('contain', 'Fatal Error');
    cy.get('#error-text').should('contain', '500');

    // Close modal
    cy.get('#error-modal .close-btn').click();
    cy.get('#error-modal').should('not.be.visible');
  });

  it('should display error modal when saving task fails with 500', () => {
    cy.intercept('GET', '**/api/v1/users', {
      statusCode: 200,
      body: { userid: 'testuser', groups: ['Users'] }
    }).as('getUsers');

    cy.intercept('GET', '**/api/v1/categories', {
      statusCode: 200,
      body: { categories: ['General'] }
    }).as('getCategories');

    cy.intercept('GET', '**/api/v1/tasks', {
      statusCode: 200,
      body: {
        tasks: [{
          task_id: 'task-err-1',
          category: 'General',
          task_name: 'Task before failure',
          expected_hours: 1.0,
          actual_hours: 1.0,
          description: '',
          date: '2025-10-06',
          userid: 'testuser'
        }]
      }
    }).as('getTasks');

    cy.intercept('PUT', '**/api/v1/tasks/*', {
      statusCode: 500,
      body: { status: 'error', message: 'Database connection failed' }
    }).as('putTaskError');

    const now = new Date('2025-10-06').getTime();
    cy.clock(now, ['Date']);

    cy.visit('/');
    cy.wait(['@getUsers', '@getCategories', '@getTasks']);

    // Select the day in the sidebar
    cy.get('#day-list li').first().click();

    // Edit task name and trigger save
    cy.get('.task-input-task_name').first().clear().type('Modified Name');
    cy.get('.save-task-btn').first().click();
    cy.wait('@putTaskError');

    cy.get('#error-modal').should('be.visible');
    cy.get('#error-modal-title').should('contain', 'REST API Error');
  });
});
