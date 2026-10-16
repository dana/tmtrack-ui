describe('Task Name Autocomplete & Tab Completion', () => {
  const DANA_USERID = 'diederich@gmail.com';

  const mockTasks = [
    {
      task_id: 'task-1',
      userid: DANA_USERID,
      category: 'personal',
      task_name: '3 minute journal',
      expected_hours: 0.25,
      actual_hours: 0.25,
      description: 'Morning journal',
      date: '2026-10-15'
    },
    {
      task_id: 'task-2',
      userid: DANA_USERID,
      category: 'work',
      task_name: 'catchup on e-mail',
      expected_hours: 0.5,
      actual_hours: 0.5,
      description: '',
      date: '2026-10-15'
    },
    {
      task_id: 'task-3',
      userid: DANA_USERID,
      category: 'work',
      task_name: 'rma work',
      expected_hours: 1.0,
      actual_hours: 1.0,
      description: '',
      date: '2026-10-15'
    },
    {
      task_id: 'task-4',
      userid: DANA_USERID,
      category: 'personal',
      task_name: 'two duolingo lessons',
      expected_hours: 0.25,
      actual_hours: 0.25,
      description: '',
      date: '2026-10-15'
    }
  ];

  beforeEach(() => {
    cy.intercept('GET', '**/api/v1/users', {
      statusCode: 200,
      body: {
        userid: DANA_USERID,
        groups: ['Hunny Bunnies', 'Administrators'],
        users: [DANA_USERID],
        authenticated: true
      }
    }).as('getUsers');

    cy.intercept('GET', '**/api/v1/categories', {
      statusCode: 200,
      body: { categories: ['work', 'personal'] }
    }).as('getCategories');

    cy.intercept('GET', '**/api/v1/days*', {
      statusCode: 200,
      body: {
        userid: DANA_USERID,
        total_days: 1,
        total_incomplete_days: 0,
        incomplete_dates: [],
        days: [
          { date: '2026-10-15', task_count: 4, total_expected: 2.0, total_actual: 2.0, incomplete_count: 0, is_incomplete: false }
        ]
      }
    }).as('getDays');

    cy.intercept('GET', '**/api/v1/tasks*', (req) => {
      req.reply({
        statusCode: 200,
        body: { tasks: mockTasks }
      });
    }).as('getTasks');

    cy.visit('/');
    cy.wait(['@getUsers', '@getCategories', '@getDays']);
  });

  it('strictly isolates suggestions by Category: "3" under Work yields no suggestion, but yields "3 minute journal" under Personal', () => {
    cy.get('#add-task-btn').click();

    cy.get('#task-list-container .task-line').last().within(() => {
      // Default category is work
      cy.get('.task-input-category').should('have.value', 'work');

      // Type '3' into task name under work
      cy.get('.task-input-task_name').type('3');

      // Must NOT suggest '3 minute journal' because it belongs to personal
      cy.get('.task-name-dropdown').should('not.be.visible');
      cy.get('.task-name-ghost-text').should('be.empty');

      // Clear '3'
      cy.get('.task-input-task_name').clear();

      // Now switch Category to 'personal'
      cy.get('.task-input-category').select('personal');

      // Type '3' into task name under personal
      cy.get('.task-input-task_name').type('3');

      // Now it MUST suggest '3 minute journal'
      cy.get('.task-name-ghost-text').should('contain', 'minute journal');
      cy.get('.task-name-dropdown').should('be.visible');
      cy.get('.task-suggestion-item.active').should('contain', '3 minute journal');
      cy.get('.task-suggestion-item.active .suggestion-hours').should('contain', '1/4h');

      // Press Tab to complete
      cy.get('.task-input-task_name').trigger('keydown', { key: 'Tab', keyCode: 9, which: 9 });

      // Assert Task Name and Expected (hrs) completed
      cy.get('.task-input-task_name').should('have.value', '3 minute journal');
      cy.get('.task-input-expected_hours').should('have.value', '1/4');
      cy.get('.task-input-actual_hours').should('have.value', '');
      cy.get('.task-input-description').should('have.value', '');

      // Assert focus moved to Expected (hrs)
      cy.get('.task-input-expected_hours').should('be.focused');
      cy.get('.task-name-dropdown').should('not.be.visible');
    });
  });

  it('suggests "catchup on e-mail" under Work when typing "c" and completes on Tab', () => {
    cy.get('#add-task-btn').click();

    cy.get('#task-list-container .task-line').last().within(() => {
      cy.get('.task-input-category').should('have.value', 'work');

      // Type 'c'
      cy.get('.task-input-task_name').type('c');

      // Should suggest 'catchup on e-mail'
      cy.get('.task-name-dropdown').should('be.visible');
      cy.get('.task-suggestion-item.active').should('contain', 'catchup on e-mail');
      cy.get('.task-suggestion-item.active .suggestion-hours').should('contain', '1/2h');

      // Press Tab to complete
      cy.get('.task-input-task_name').trigger('keydown', { key: 'Tab', keyCode: 9, which: 9 });

      cy.get('.task-input-task_name').should('have.value', 'catchup on e-mail');
      cy.get('.task-input-expected_hours').should('have.value', '1/2');
    });
  });

  it('dismisses suggestions on Escape', () => {
    cy.get('#add-task-btn').click();

    cy.get('#task-list-container .task-line').last().within(() => {
      cy.get('.task-input-task_name').type('r');
      cy.get('.task-name-dropdown').should('be.visible');

      // Press Escape
      cy.get('.task-input-task_name').trigger('keydown', { key: 'Escape', keyCode: 27, which: 27 });

      cy.get('.task-name-dropdown').should('not.be.visible');
      cy.get('.task-name-ghost-text').should('be.empty');
      cy.get('.task-input-task_name').should('have.value', 'r');
    });
  });
});
