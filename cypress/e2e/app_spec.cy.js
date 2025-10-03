describe('Time Tracker UI', () => {

  beforeEach(() => {
    cy.visit('/');
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
