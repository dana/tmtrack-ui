describe('Task Management', () => {
  beforeEach(() => {
    // Mock initial load APIs
    cy.intercept('GET', '**/api/v1/users', {
      statusCode: 200,
      body: { userid: 'testuser', groups: ['Users'] }
    }).as('getUsers');

    cy.intercept('GET', '**/api/v1/categories', {
      statusCode: 200,
      body: { categories: ['General'] }
    }).as('getCategories');

    // Initial task list has one task
    cy.intercept('GET', '**/api/v1/tasks', {
      statusCode: 200,
      body: {
        tasks: [{
          task_id: 1, category: 'General', task_name: 'Initial task',
          expected_hours: '1', actual_hours: '1', description: 'Initial task description',
          date: '2025-10-06', userid: 'testuser'
        }]
      }
    }).as('getTasks');

    cy.visit('/');
    cy.wait(['@getUsers', '@getCategories', '@getTasks']);
  });

  it('should allow a user to add a new task', () => {
    // Mock APIs for the "add" action
    cy.intercept('POST', '**/api/v1/tasks', { statusCode: 201, body: { id: 2 } }).as('addTask');

    // Mock the GET request that happens after adding. It should return the initial task AND the new one.
    cy.intercept('GET', '**/api/v1/tasks', {
      statusCode: 200,
      body: {
        tasks: [
          { task_id: 1, category: 'General', task_name: 'Initial task', expected_hours: '1', actual_hours: '1', description: 'Initial task description', date: '2025-10-06', userid: 'testuser' },
          { task_id: 2, category: 'General', task_name: 'A new task', expected_hours: '2', actual_hours: '2', description: 'A new task description', date: '2025-10-06', userid: 'testuser' }
        ]
      }
    }).as('getTasksAfterAdd');

    // User actions
    cy.get('#day-list li').first().click();
    cy.get('#add-task-btn').click();
    cy.get('.task-line').last().within(() => {
      cy.get('.task-input-category').select('General');
      cy.get('.task-input-task_name').type('A new task');
      cy.get('.task-input-expected_hours').clear().type('2');
      cy.get('.task-input-actual_hours').clear().type('2');
      cy.get('.task-input-description').type('A new task description');
      cy.get('.save-task-btn').click();
    });

    // Wait and assert
    cy.wait('@addTask');
    cy.wait('@getTasksAfterAdd');
    cy.get('#task-list-container .task-input-task_name[value="A new task"]').should('be.visible');
  });

  it('should allow a user to edit an existing task', () => {
    // Mock APIs for the "edit" action
    cy.intercept('PUT', '**/api/v1/tasks/1', { statusCode: 200, body: { id: 1 } }).as('editTask');

    // Mock the GET request that happens after editing. It should return the edited task.
    cy.intercept('GET', '**/api/v1/tasks', {
      statusCode: 200,
      body: {
        tasks: [{
          task_id: 1, category: 'General', task_name: 'An edited task',
          expected_hours: '1', actual_hours: '1', description: 'An edited task description',
          date: '2025-10-06', userid: 'testuser'
        }]
      }
    }).as('getTasksAfterEdit');

    // User actions
    cy.get('#day-list li').first().click();
    cy.get('.task-line').first().within(() => {
      cy.get('.task-input-task_name').clear().type('An edited task');
      cy.get('.task-input-description').clear().type('An edited task description');
      cy.get('.save-task-btn').click();
    });

    // Wait and assert
    cy.wait('@editTask');
    cy.wait('@getTasksAfterEdit');
    cy.get('#task-list-container .task-input-task_name[value="An edited task"]').should('be.visible');
  });
});