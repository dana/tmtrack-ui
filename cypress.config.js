const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    // The base URL of your application running locally.
    // This must match the server you start with Python.
    baseUrl: 'http://localhost:8000',
    
    // **THE FIX**: Explicitly tell Cypress there is no support file.
    supportFile: false,
    
    // We are not using the setupNodeEvents function for this basic setup.
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    
    // Change the default spec pattern to look for files like `app_spec.cy.js`
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    
    // We can turn off video recording for headless runs to save space
    video: false,
  },
});
