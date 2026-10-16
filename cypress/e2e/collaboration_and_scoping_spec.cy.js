describe('Day Scoping and Group Collaboration UI', () => {
  const DANA_USERID = 'diederich@gmail.com';
  const MICHELLE_USERID = 'msdiederich@gmail.com';

  beforeEach(() => {
    // Mock user identity
    cy.intercept('GET', '**/api/v1/users', {
      statusCode: 200,
      body: {
        userid: DANA_USERID,
        groups: ['Hunny Bunnies', 'Administrators'],
        users: [DANA_USERID, MICHELLE_USERID],
        authenticated: true
      }
    }).as('getUsers');

    cy.intercept('GET', '**/api/v1/categories', {
      statusCode: 200,
      body: { categories: ['work', 'personal'] }
    }).as('getCategories');

    // Mock days summary
    cy.intercept('GET', '**/api/v1/days*', (req) => {
      const url = new URL(req.url);
      const user = url.searchParams.get('userid') || DANA_USERID;
      if (user === MICHELLE_USERID) {
        req.reply({
          statusCode: 200,
          body: {
            userid: MICHELLE_USERID,
            total_days: 2,
            total_incomplete_days: 1,
            incomplete_dates: ['2026-10-10'],
            days: [
              { date: '2026-10-14', task_count: 1, total_expected: 3.0, total_actual: 3.0, incomplete_count: 0, is_incomplete: false },
              { date: '2026-10-10', task_count: 1, total_expected: 2.0, total_actual: 0.0, incomplete_count: 1, is_incomplete: true }
            ]
          }
        });
      } else {
        req.reply({
          statusCode: 200,
          body: {
            userid: DANA_USERID,
            total_days: 3,
            total_incomplete_days: 1,
            incomplete_dates: ['2026-10-15'],
            days: [
              { date: '2026-10-15', task_count: 2, total_expected: 5.0, total_actual: 0.0, incomplete_count: 1, is_incomplete: true },
              { date: '2026-10-14', task_count: 2, total_expected: 6.0, total_actual: 6.0, incomplete_count: 0, is_incomplete: false },
              { date: '2026-10-13', task_count: 1, total_expected: 4.0, total_actual: 4.0, incomplete_count: 0, is_incomplete: false }
            ]
          }
        });
      }
    }).as('getDays');

    // Mock scoped tasks
    cy.intercept('GET', '**/api/v1/tasks*', (req) => {
      const url = new URL(req.url);
      const user = url.searchParams.get('userid');
      if (user === MICHELLE_USERID) {
        req.reply({
          statusCode: 200,
          body: {
            tasks: [{
              task_id: 'm1', userid: MICHELLE_USERID, date: '2026-10-14',
              task_name: "Michelle's Task", category: 'work',
              expected_hours: 3.0, actual_hours: 3.0, description: 'Notes'
            }]
          }
        });
      } else {
        req.reply({
          statusCode: 200,
          body: {
            tasks: [
              {
                task_id: 'd1', userid: DANA_USERID, date: '2026-10-15',
                task_name: 'Standup', category: 'work',
                expected_hours: 1.0, actual_hours: null, description: 'Daily standup'
              },
              {
                task_id: 'd2', userid: DANA_USERID, date: '2026-10-15',
                task_name: 'Core Architecture', category: 'work',
                expected_hours: 4.0, actual_hours: null, description: 'Scoping work'
              }
            ]
          }
        });
      }
    }).as('getTasks');

    cy.visit('/');
    cy.wait(['@getUsers', '@getCategories', '@getDays']);
  });

  it('should render 2 Weeks preset by default with active state', () => {
    cy.get('.scope-btn[data-scope="2weeks"]').should('have.class', 'active');
    cy.get('#month-stepper-container').should('not.be.visible');
    cy.get('#day-list li').should('have.length', 3);
    cy.get('#day-list li.active').should('contain', '2026-10-15');
    cy.get('#selected-date-display').should('contain', 'Thursday October 15 2026');
  });

  it('should show incomplete badge and allow filtering to incomplete days', () => {
    cy.get('#incomplete-filter-btn').should('be.visible').and('contain', '1 Incomplete');
    cy.get('#incomplete-filter-btn').click();
    cy.get('#incomplete-filter-btn').should('have.class', 'active');
    cy.get('.scope-btn[data-scope="2weeks"]').should('not.have.class', 'active');
  });

  it('should toggle month stepper when Month scope is clicked', () => {
    cy.get('.scope-btn[data-scope="month"]').click();
    cy.get('.scope-btn[data-scope="month"]').should('have.class', 'active');
    cy.get('#month-stepper-container').should('be.visible');
    cy.get('#current-month-display').should('not.be.empty');

    // Stepping backwards
    cy.get('#current-month-display').invoke('text').then((initialMonth) => {
      cy.get('#month-prev-btn').click();
      cy.get('#current-month-display').invoke('text').should('not.eq', initialMonth);
    });
  });

  it('should enforce read-only UI controls when viewing another user in group', () => {
    // Dana viewing Michelle
    cy.get('#user-select-dropdown').select(MICHELLE_USERID);
    cy.wait('@getDays');

    // Verification of read-only mode
    cy.get('#new-day-btn').should('not.be.visible');
    cy.get('#add-task-btn').should('not.be.visible');
    cy.get('.save-task-btn').should('not.exist');
    cy.get('.delete-task-btn').should('not.exist');
    cy.get('.task-input-task_name').should('be.disabled');
    cy.get('.task-input-category').should('be.disabled');
    cy.get('.task-input-expected_hours').should('be.disabled');

    // Switch back to Dana
    cy.get('#user-select-dropdown').select(DANA_USERID);
    cy.wait('@getDays');
    cy.get('#new-day-btn').should('be.visible');
    cy.get('#add-task-btn').should('be.visible');
    cy.get('.save-task-btn').should('be.visible');
    cy.get('.task-input-task_name').should('not.be.disabled');
  });
});
