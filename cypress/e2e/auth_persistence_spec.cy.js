describe('Authentication Persistence', () => {
    // Helper to check for the cookie
    const getCookie = (name) => {
        return cy.getCookie(name).then(cookie => {
            return cookie ? cookie.value : null;
        });
    };

    it('should store auth_token in a cookie when provided in URL', () => {
        const testToken = 'test-token-123';

        // Visit with auth_token
        cy.visit(`/?auth_token=${testToken}`);

        // Verify URL is cleaned FIRST to ensure app logic has run
        cy.url().should('not.include', 'auth_token');

        // Verify cookie is set
        cy.getCookie('auth_token').should('have.property', 'value', testToken);
    });

    it('should use auth_token from cookie on subsequent visits', () => {
        const testToken = 'persistent-token-456';

        // Manually set the cookie before visiting
        cy.setCookie('auth_token', testToken);

        // Intercept API calls to check Authorization header
        cy.intercept('GET', '**/api/v1/tasks', (req) => {
            expect(req.headers['authorization']).to.equal(`Bearer ${testToken}`);
            req.reply({ statusCode: 200, body: { tasks: [] } });
        }).as('getTasks');

        cy.intercept('GET', '**/api/v1/users', { statusCode: 200, body: { userid: 'user', groups: [] } }).as('getUsers');
        cy.intercept('GET', '**/api/v1/categories', { statusCode: 200, body: { categories: [] } }).as('getCategories');

        cy.visit('/');

        // Wait for API call and verify header
        cy.wait('@getTasks');
    });

    it('should default to "none" if no cookie or URL param is present', () => {
        // Ensure no cookie
        cy.clearCookie('auth_token');

        // Intercept API to check for "Bearer none"
        cy.intercept('GET', '**/api/v1/tasks', (req) => {
            expect(req.headers['authorization']).to.equal('Bearer none');
            req.reply({ statusCode: 200, body: { tasks: [] } });
        }).as('getTasksDefault');

        cy.intercept('GET', '**/api/v1/users', { statusCode: 200, body: { userid: 'user', groups: [] } }).as('getUsers');
        cy.intercept('GET', '**/api/v1/categories', { statusCode: 200, body: { categories: [] } }).as('getCategories');

        cy.visit('/');

        cy.wait('@getTasksDefault');
    });
});
