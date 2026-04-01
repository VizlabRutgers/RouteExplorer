
all: frontend
	python3 setup.py build

frontend:
	npx rollup --config rollup.config.mjs

clean:
	rm -rf build
	rm -f static/js/main.js
