.PHONY: all test clean clean-all dev-up dev-down dev-status dev-screenshot

all: test

test:
	./run-tests.sh

dev-up:
	@if [ -x "../tmtrack/dev-stack.sh" ]; then ../tmtrack/dev-stack.sh up; else echo "tmtrack repo not found at ../tmtrack"; fi

dev-down:
	@if [ -x "../tmtrack/dev-stack.sh" ]; then ../tmtrack/dev-stack.sh down; else echo "tmtrack repo not found at ../tmtrack"; fi

dev-status:
	@if [ -x "../tmtrack/dev-stack.sh" ]; then ../tmtrack/dev-stack.sh status; else echo "tmtrack repo not found at ../tmtrack"; fi

dev-screenshot:
	@if [ -x "../tmtrack/dev-browser.py" ]; then python3 ../tmtrack/dev-browser.py screenshot; else echo "dev-browser.py not found at ../tmtrack/dev-browser.py"; fi

clean:
	@echo "Cleaning temporary test artifacts and debug logs..."
	rm -rf cypress/screenshots cypress/videos cypress/downloads cypress/logs
	rm -f cypress_output*.txt cypress_visual_*.txt cypress_toplevel_*.txt
	rm -f cypress_debug_log.txt cypress_console_debug.txt
	rm -f *.log
	@echo "Clean complete."

clean-all: clean
	@echo "Removing node_modules..."
	rm -rf node_modules
	@echo "Clean-all complete."
