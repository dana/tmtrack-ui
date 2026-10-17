describe("Service Account Authentication UI & User Isolation", () => {
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

  it("should display discrete Service Login toggle in guest banner and open/close modal", () => {
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

    // Verify guest banner contains both Google login link and discrete Service Login toggle
    cy.get("#guest-banner").should("be.visible");
    cy.get("#guest-banner-login-link").should("be.visible");
    cy.get("#service-login-toggle")
      .should("be.visible")
      .should("contain", "Service Login");

    // Modal is initially hidden
    cy.get("#service-login-modal").should("not.be.visible");

    // Click toggle to open modal
    cy.get("#service-login-toggle").click();
    cy.get("#service-login-modal").should("be.visible");
    cy.get("#service-login-username").should("be.visible").and("have.focus");

    // Click cancel to close
    cy.get("#cancel-service-login-btn").click();
    cy.get("#service-login-modal").should("not.be.visible");

    // Reopen and close via close-btn
    cy.get("#service-login-toggle").click();
    cy.get("#service-login-modal").should("be.visible");
    cy.get("#close-service-login-btn").click();
    cy.get("#service-login-modal").should("not.be.visible");
  });

  it("should show error on invalid credentials", () => {
    cy.intercept("GET", "**/api/v1/users", {
      statusCode: 200,
      body: { authenticated: false, userid: "guest", groups: ["Guests"], users: ["guest"] }
    }).as("getUsersGuest");

    cy.intercept("POST", "**/api/auth/login", {
      statusCode: 401,
      body: { error: "Invalid account name or password" }
    }).as("loginFailed");

    cy.visit("/");
    cy.wait(["@getUsersGuest", "@getCategories", "@getTasks"]);

    cy.get("#service-login-toggle").click();
    cy.get("#service-login-username").type("wrong-account");
    cy.get("#service-login-password").type("bad-password");
    cy.get("#submit-service-login-btn").click();

    cy.wait("@loginFailed");
    cy.get("#service-login-error")
      .should("be.visible")
      .should("contain", "Invalid account name or password");
  });

  it("should isolate service account from regular users dropdown", () => {
    // When Dana is logged in:
    cy.intercept("GET", "**/api/v1/users", {
      statusCode: 200,
      body: {
        authenticated: true,
        userid: "diederich@gmail.com",
        groups: ["Hunny Bunnies", "Administrators"],
        users: ["diederich@gmail.com", "msdiederich@gmail.com"]
      }
    }).as("getUsersDana");

    cy.visit("/");
    cy.wait(["@getUsersDana", "@getCategories", "@getTasks"]);

    // Verify service-agent is NOT present in the user selection dropdown
    cy.get("#user-select-dropdown option").then(($options) => {
      const values = [...$options].map(o => o.value);
      expect(values).to.include("diederich@gmail.com");
      expect(values).to.not.include("service-agent");
      expect(values).to.not.include("service-automation");
    });

    // Guest banner and service login toggle are hidden when authenticated
    cy.get("#guest-banner").should("not.be.visible");
  });

  it("should display service account identity and groups when authenticated as service-agent", () => {
    cy.intercept("GET", "**/api/v1/users", {
      statusCode: 200,
      body: {
        authenticated: true,
        userid: "service-agent",
        groups: ["ServiceAccounts"],
        users: ["service-agent", "service-automation"]
      }
    }).as("getUsersServiceAgent");

    cy.visit("/");
    cy.wait(["@getUsersServiceAgent", "@getCategories", "@getTasks"]);

    // Verify header display
    cy.get("#user-info-display")
      .should("contain", "service-agent")
      .should("contain", "ServiceAccounts");
    cy.get("#sign-out-btn").should("be.visible");

    // Guest banner is hidden
    cy.get("#guest-banner").should("not.be.visible");

    // Dropdown only contains ServiceAccounts users
    cy.get("#user-select-dropdown option").then(($options) => {
      const values = [...$options].map(o => o.value);
      expect(values).to.include("service-agent");
      expect(values).to.not.include("diederich@gmail.com");
    });
  });
});
