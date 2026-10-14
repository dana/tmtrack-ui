.PHONY: all test clean clean-all

all: test

test:
	./run-tests.sh

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
