describe('Categories Management Modal', () => {
  it('should allow an Administrator to edit and save categories', () => {
    cy.intercept('GET', '**/api/v1/users', {
      statusCode: 200,
      body: { userid: 'dana', groups: ['Administrators', 'Hunny Bunnies'] }
    }).as('getUsers');

    cy.intercept('GET', '**/api/v1/categories', {
      statusCode: 200,
      body: { categories: ['Dev', 'Ops', 'Support'] }
    }).as('getCategories');

    cy.intercept('GET', '**/api/v1/tasks', {
      statusCode: 200,
      body: { tasks: [] }
    }).as('getTasks');

    cy.intercept('PUT', '**/api/v1/categories', (req) => {
      expect(req.body.categories).to.include('Dev');
      expect(req.body.categories).to.include('Ops');
      req.reply({ statusCode: 200, body: { status: 'success' } });
    }).as('putCategories');

    cy.visit('/');
    cy.wait(['@getUsers', '@getCategories', '@getTasks']);

    // Admin should see Categories button
    cy.get('#edit-categories-btn').should('be.visible').click();
    cy.get('#categories-modal').should('be.visible');

    // Admin should see remove category buttons
    cy.get('.remove-category-btn').should('have.length', 3);

    // Add a new category
    cy.get('#add-category-btn-modal').click();
    cy.get('.category-input').last().type('Documentation');

    // Save categories
    cy.get('#save-categories-btn').click();
    cy.wait('@putCategories');
    cy.get('#categories-modal').should('not.be.visible');
  });

  it('should not display categories button for non-administrators', () => {
    cy.intercept('GET', '**/api/v1/users', {
      statusCode: 200,
      body: { userid: 'guest', groups: ['Guests'] }
    }).as('getUsersNonAdmin');

    cy.intercept('GET', '**/api/v1/categories', {
      statusCode: 200,
      body: { categories: ['Dev', 'Ops'] }
    }).as('getCategoriesNonAdmin');

    cy.intercept('GET', '**/api/v1/tasks', {
      statusCode: 200,
      body: { tasks: [] }
    }).as('getTasksNonAdmin');

    cy.visit('/');
    cy.wait(['@getUsersNonAdmin', '@getCategoriesNonAdmin', '@getTasksNonAdmin']);

    // Non-admin should NOT see edit categories button
    cy.get('#edit-categories-btn').should('not.be.visible');
  });
});
