describe('Fraction Steppers and Hours Calculation', () => {
  beforeEach(() => {
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
          task_id: 'task-100',
          category: 'General',
          task_name: 'Stepper Task',
          expected_hours: 1.0,
          actual_hours: 0.0,
          description: '',
          date: '2025-10-06',
          userid: 'testuser'
        }]
      }
    }).as('getTasks');

    const now = new Date('2025-10-06').getTime();
    cy.clock(now, ['Date']);

    cy.visit('/');
    cy.wait(['@getUsers', '@getCategories', '@getTasks']);
  });

  it('should step expected hours in 1/4 increments using up/down arrows', () => {
    const expectedInput = cy.get('.task-input-expected_hours').first();
    expectedInput.should('have.value', '1');

    // Click arrow up -> 1 1/4
    cy.get('.task-line .number-input-wrapper').first().find('.arrow-up').click();
    cy.get('.task-input-expected_hours').first().should('have.value', '1 1/4');

    // Click arrow up -> 1 1/2
    cy.get('.task-line .number-input-wrapper').first().find('.arrow-up').click();
    cy.get('.task-input-expected_hours').first().should('have.value', '1 1/2');

    // Click arrow down -> 1 1/4
    cy.get('.task-line .number-input-wrapper').first().find('.arrow-down').click();
    cy.get('.task-input-expected_hours').first().should('have.value', '1 1/4');
  });
});
