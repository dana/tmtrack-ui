describe('Basic Application Load Test', () => {
  it('should load the main page successfully', () => {
    // Mock the essential API calls to prevent errors on load
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
        categories: ['General']
      }
    }).as('getCategories');

    cy.intercept('GET', '**/api/v1/tasks', {
      statusCode: 200,
      body: {
        tasks: []
      }
    }).as('getTasks');

    // Visit the root of the application
    cy.visit('/');

    // Wait for the initial API calls to finish
    cy.wait(['@getUsers', '@getCategories', '@getTasks']);

    // Assert that a key part of the application is visible
    cy.get('.container').should('be.visible');
    cy.get('#user-info-display').should('contain', 'testuser');
  });
});
