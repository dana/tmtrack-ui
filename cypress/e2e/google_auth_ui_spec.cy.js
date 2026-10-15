describe("Google Authentication UI", () => {
  beforeEach(() => {
    cy.intercept("GET", "**/api/v1/categories", {
      statusCode: 200,
      body: { categories: ["Work", "Personal"] }
    }).as("getCategories");

    cy.intercept("GET", "**/api/v1/tasks", {
      statusCode: 200,
      body: { tasks: [] }
    }).as("getTasks");
  });

  it("should display Sign in with Google button and guest banner when unauthenticated", () => {
    cy.intercept("GET", "**/api/v1/users", {
      statusCode: 200,
      body: {
        authenticated: false,
        userid: "guest",
        groups: ["Guests"],
        users: ["guest"]
      }
    }).as("getUsersGuest");

    cy.visit("/");
    cy.wait(["@getUsersGuest", "@getCategories", "@getTasks"]);

    // Verify user info display shows guest and Google sign in button
    cy.get("#user-info-display").should("contain", "guest");
    cy.get("#google-login-btn")
      .should("be.visible")
      .should("contain", "Sign in with Google")
      .should("have.attr", "href")
      .and("include", "/api/auth/google/login");

    // Verify guest banner is visible
    cy.get("#guest-banner")
      .should("be.visible")
      .should("contain", "read-only guest mode");
    cy.get("#guest-banner-login-link")
      .should("have.attr", "href")
      .and("include", "/api/auth/google/login");
  });

  it("should display user info, groups, and Sign Out button when authenticated", () => {
    cy.intercept("GET", "**/api/v1/users", {
      statusCode: 200,
      body: {
        authenticated: true,
        userid: "diederich@gmail.com",
        groups: ["Hunny Bunnies", "Administrators"],
        users: ["diederich@gmail.com", "msdiederich@gmail.com"]
      }
    }).as("getUsersAuth");

    cy.visit("/");
    cy.wait(["@getUsersAuth", "@getCategories", "@getTasks"]);

    // Verify user info shows email, groups, and Sign Out button
    cy.get("#user-info-display").should("contain", "diederich@gmail.com");
    cy.get("#user-info-display").should("contain", "Hunny Bunnies");
    cy.get("#sign-out-btn")
      .should("be.visible")
      .should("contain", "Sign Out")
      .should("have.attr", "href")
      .and("include", "/api/auth/logout");

    // Verify guest banner is hidden
    cy.get("#guest-banner").should("not.be.visible");
  });
});
