describe('Time Tracker UI (Live API)', () => {

  // This beforeEach block now simply visits the page before each test.
  // All cy.intercept() calls have been removed.
  beforeEach(() => {
    // Visit the application's base URL (http://localhost:8000)
    cy.visit('/');
  });

  // Test Case 1: Verify the app loads correctly against a live API.
  it('should load the application correctly', () => {
    // Check that key static elements are visible
    cy.contains('label', 'UserId').should('be.visible');
    cy.get('#new-day-btn').should('be.visible');
    cy.get('#add-task-btn').should('be.visible');

    // Assert that the user dropdown has loaded at least one user from the live API.
    // We check for more than 1 option because the first is "Select a User".
    cy.get('#userid').find('option').should('have.length.gt', 1);
  });

  // Test Case 2: Select a user and day, and verify tasks are shown.
  // This test is designed to be resilient and not depend on specific data.
  it('should display tasks when a user and a day are selected', () => {
    // 1. Wait for users to load and select the first available user.
    // The first option is the disabled "Select a User", so we select the second one.
    cy.get('#userid > option').eq(1).then(firstUserOption => {
      const firstUser = firstUserOption.val();
      cy.get('#userid').select(firstUser);
    });

    // 2. After selecting a user, the day list should populate.
    // We wait for at least one day to appear in the list.
    cy.get('#day-list li').should('have.length.gt', 0);

    // 3. Click the first day in the list.
    cy.get('#day-list li').first().click();

    // 4. The edit pane should now contain at least one task line.
    // This confirms that the core functionality of displaying tasks works.
    cy.get('#task-list-container').find('.task-line').should('have.length.gt', 0);

    // 5. Verify that one of the task lines contains the expected input fields.
    cy.get('.task-line').first().find('.task-input-task_name').should('exist');
    cy.get('.task-line').first().find('.task-input-expected_hours').should('exist');
  });

});
