/**
 * Tab Downloader Browser Extension
 *
 * Options page
 *
 * @version 1.0.0
 * @author  Jason Gardner <im@jasongardner.co>
 * @link    http://jasongardner.co/tab-downloader/
 * @license MIT
 */

/** jshint esversion: 6 **/
(() => {
	'use strict';

	/**
	 * Prevents triggering a function multiple times within a certain time period
	 * @param func Function to debounce
	 * @param wait Milliseconds to wait before executing function
	 * @param immediate If true, function will be executed immediately
	 * @returns {function()}
	 */
	function debounce(func, wait, immediate) {
		let timeout;

		return () => {
			const context = this,
				args = arguments,
				later = function() {
					timeout = null;

					if (!immediate) {
						func.apply(context, args);
					}
				},
				callNow = (immediate && !timeout);

			clearTimeout(timeout);
			timeout = setTimeout(later, wait);

			if (callNow) {
				func.apply(context, args);
			}
		};
	}

	/**
	 * True if user has localStorage API enabled, otherwise false
	 * @type {Boolean}
	 */
	const HAS_STORAGE = (() => {
		try {
			window.localStorage.setItem('x', 'y');
			window.localStorage.removeItem('x');
			return true;
		} catch(e) {
			return false;
		}
	})();

	/**
	 * List of affirmative messages to display as snackbar confirm buttons
	 * @type {Array}
	 */
	const AFFIRMATIVE_TEXTS = ['Cool!', 'Neato', 'OK', 'Alrighty', 'Super', 'Sweet!', 'Rad'];

	/**
	 * Displays snackbar notification on page
	 */
	const showSnackbar = (() => {
			let previous = null;

			return (message, btnLabel, dismissAfter, callback) => {
				if (previous) {
					previous.dismiss();
				}

				const snackbar = document.createElement('div'),
					text = document.createTextNode(message);

				if (dismissAfter === undefined) {
					dismissAfter = 5000;
				}

				snackbar.className = 'snackbar';
				snackbar.dismiss = function() {
					this.style.opacity = 0;
				}.bind(snackbar);

				snackbar.appendChild(text);

				snackbar.addEventListener('transitionend', function(event) {
					if (event.propertyName !== 'opacity' || +this.style.opacity !== 0) {
						return;
					}

					this.parentElement.removeChild(this);

					if (previous === this) {
						previous = null;
					}
				}.bind(snackbar));

				if (btnLabel) {
					callback = callback || snackbar.dismiss.bind(snackbar);

					const btn = document.createElement('button');
					btn.className = 'snackbar__action';
					btn.innerHTML = btnLabel;

					btn.addEventListener('click', debounce(callback, 250), false);

					snackbar.appendChild(btn);
				}

				if (dismissAfter) {
					setTimeout(function() {
						if (previous !== this) {
							return;
						}

						previous.dismiss();
					}.bind(snackbar), +dismissAfter);
				}

				previous = snackbar;

				document.querySelector('.snackwrap').appendChild(snackbar);

				if (window.getComputedStyle(snackbar).bottom !== false) { /// Use getComputedStyle to trigger animation
					snackbar.style.transform = 'translateY(0)';
					snackbar.style.opacity = 1;
				}
			};
		})(),

		showDialog = (() => {
			let previous = null;

			return (targetId) => {
				let dialog;

				if (previous) {
					previous.dismiss();
				}

				if (targetId) {
					dialog = document.getElementById(targetId.replace(/^#/, ''));
				}

				if (!dialog) {
					/// TODO: Add createDialog() function
					return false;
				}

				document.body.classList.add('show-dialog');

				dialog.classList.add('dialog--open');
				dialog.setAttribute('aria-hidden', 'false');

				/// TODO: Accept more button callback functions ("Cancel", "Back", etc.)
				const button = dialog.querySelector('.dialog__footer button');

				dialog.dismiss = function() {
					this.setAttribute('aria-hidden', 'true');
					this.classList.remove('dialog--open');
					document.body.classList.remove('show-dialog');

					if (button) {
						button.autofocus = false;
					}
				};

				if (!button) { /// Hide dialog after five seconds if there are no buttons
					setTimeout(dialog.dismiss, 5000);
					return;
				}

				button.autofocus = true;
				button.addEventListener('click', dialog.dismiss, false);

				previous = dialog;
			};
		})();

	/**
	 * Selects a random item from an array
	 * @param arr Array from which item will be chosen.
	 * @returns {*} Returns a random item from array `arr`. If `arr` is not an array, the original value is returned
	 *              - unless `arr` is an object or function, in which case, the function returns `null`.
	 */
	function random(arr) {
		if (Array.isArray(arr)) {
			return arr[Math.floor(Math.random() * arr.length)];
		}

		if (arr !== undefined && typeof arr !== 'object' && typeof arr !== 'function') {
			return arr; // Return as-is. Who knows? It might work out.
		}

		return null;
	}

	/**
	 * Loads settings from localStorage and applies values to corresponding DOM elements
	 */
	function applySavedSettings() {
		const DEFAULTS = {
			fileTypes:      ['png,', 'gif', 'jpeg', 'pdf'],
			icon:           'icon',
			closeAfterSave: 'true',
			conflictAction: 'uniquify'
		};

		// Apply file type selection
		let fileTypes = DEFAULTS.fileTypes;

		const icon = window.localStorage.getItem('icon') || DEFAULTS.icon,
			iconInput = document.querySelector(`.settings__icon input[value="${icon}"]`);

		try {
			const selectedFileTypes = window.localStorage.getItem('fileTypes');

			if (selectedFileTypes) {
				fileTypes = JSON.parse(selectedFileTypes);
			}
		} catch (err) {
			fileTypes = DEFAULTS.fileTypes;
		}

		for (let i = 0, j = fileTypes.length; i < j; i++) {
			const checkbox = document.querySelector(`.filetype input[value*="${fileTypes[i]}"]`);

			if (!checkbox) {
				continue;
			}

			checkbox.checked = true;

			const card = checkbox.nextElementSibling,
				label = card.querySelector('.filetype__label');

			card.setAttribute('aria-pressed', 'true');

			if (label) {
				// Activate Test Run thumbnails
				document.querySelectorAll(`[data-label="${label.innerText}"]`).forEach((link) => {
					link.setAttribute('aria-hidden', 'false');
				});
			}
		}

		// Apply icon selection
		if (iconInput) {
			iconInput.checked = true;
		}

		// Apply settings selections
		document.getElementById('closeAfterSave').checked = ((window.localStorage.getItem('closeAfterSave') || DEFAULTS.closeAfterSave) === 'true');
		document.getElementById('conflictAction').checked = (window.localStorage.getItem('conflictAction') === DEFAULTS.conflictAction || DEFAULTS.conflictAction === 'true');
	}

	/**
	 * Saves a value to localStoage with optional callback
	 * @param key localStorage key name
	 * @param value String value to save to localStorage
	 * @param callback Optional callback function. If no callback is provided a snackbar will be shown
	 */
	function save(key, value, callback) {
		if (value === true || value === 'on' || value === 'true' || value === 1) {
			value = 'true';
		} else if (value === false || value === 'off' || value === 'false' || value === 0) {
			value = 'false';
		}

		window.localStorage.setItem(key, value);

		if (typeof callback !== 'function') {
			showSnackbar('Settings saved', random(AFFIRMATIVE_TEXTS));
			return;
		}

		callback();
	}

	/**
	 * File type selection save function
	 * @param callback Optional function to execute after saving
	 * @returns {*} Returns the value of the callback function if one is provided
	 */
	function saveFileTypes(callback) {
		const inputs = document.querySelectorAll('[name="download[]"]:not(:disabled)');

		if (inputs.length <= 0) {
			return;
		}

		const filterEmpty = (val) => {
			return (val !== undefined && val !== null && `${val}`.trim().length > 0);
		};

		let temp = [];

		inputs.forEach((element) => {
			if (!element.checked) {
				return;
			}

			temp = temp.concat(element.value.split(',').filter(filterEmpty));
		});

		if (temp.length <= 0) {
			return;
		}

		save('fileTypes', JSON.stringify(temp), callback);
	}

	function getElementByHash(str, context) {
		const parts = str.split('#');

		let id = parts[0];

		if (parts.length > 1) { // No hash found, attempt to find element from string as-is
			id = parts[1];
		}

		return (context || document).getElementById(id); // ID comes after '#' in hash string
	}

	///
	/// DOM ready
	///
	document.documentElement.classList.remove('no-js');
	document.documentElement.classList.add('has-js');

	document.addEventListener('DOMContentLoaded', () => {
		const noscript = document.getElementById('noscript');
		noscript.parentNode.removeChild(noscript);

		/**
		 * Changes a file type button to appear in its active state
		 * @param element Button to modify
		 * @param active Set to boolean value to determine if active state is applied or removed
		 */
		const activateFileType = (element, active) => {
				active = active || false;

				if (!active && document.querySelectorAll('[name="download[]"]:checked').length < 1) {
					element.checked = true;
					showDialog('download-requirements');
					return;
				}

				element.checked = active;

				saveFileTypes();

				const card = element.nextElementSibling,
					label = card.querySelector('.filetype__label');

				card.setAttribute('aria-pressed', `${active}`);

				// Update Test Run
				if (!label) {
					return;
				}

				document.querySelectorAll(`[data-label="${label.innerText}"]`).forEach((link) => {
					link.setAttribute('aria-hidden', `${!active}`);
				});
			},

			/**
			 * Lazy load images. Swap `src` attribute with `data-src` value, and remove `data-src` to prevent loading again.
			 * Removes the event listener once everything has been loaded
			 */
			lazyLoad = (tab) => {
				const lazies = tab.querySelectorAll('[data-src]');

				if (!lazies) {
					return false;
				}

				lazies.forEach((img) => {
					img.src = img.dataset.src;
					img.removeAttribute('data-src');
				});
			};

		if (navigator.onLine) {
			document.documentElement.classList.remove('offline');
		}

		/**
		 * Lazy load images upon navigation
		 */
		window.addEventListener('hashchange', debounce(lazyLoad, 100), false);

		/**
		 * On "change" delegation
		 */
		document.addEventListener('change', (event) => {
			if (event.target.matches('.settings input')) {
				debounce(
					save(event.target.name, event.target.checked ? (event.target.value || 'true') : 'false'),
					250
				);

				return;
			}

			if (event.target.name !== 'download[]') {
				return;
			}

			activateFileType(event.target, event.target.checked, true);
		}, false);

		/**
		 * Dialog delegation
		 */
		document.addEventListener('click', (event) => {
			if (!event.target.matches('[data-open="dialog"]')) {
				return true;
			}

			let target = event.target.getAttribute('data-target');

			if (!target && event.target.tagName.toLowerCase() === 'a') {
				event.preventDefault();
				target = event.target.hash;
			}

			if (target) {
				showDialog(target);
			}

			return false;
		}, false);

		document.querySelector('.settings').addEventListener('click', (event) => {
			let checkbox,
				parent;

			try {
				parent = event.target.closest('.checkbox');
				checkbox = parent.querySelector('[type="checkbox"]');
			} catch(err) {
				return;
			}

			checkbox.checked = !checkbox.checked;

			save(checkbox.name, checkbox.checked ? (checkbox.value || 'true') : 'false');
		}, false);

		if (!HAS_STORAGE) {
			showSnackbar(
				'Hang on! You can&rsquo;t customize your <i class="text--brand text--primary">Tab Downloader</i> ' +
				'settings until the <b class="text--accent">Web Storage API</b> is enabled in Chrome.'
			);

			document.querySelectorAll('[name="download[]"]').forEach((element) => {
				element.disabled = true;
			});
		}

		applySavedSettings();

		// Apply swap icons
		document.querySelectorAll('[data-swap]').forEach((element) => {
			let icon = element.querySelector('.icon');

			if (icon.length <= 0) {
				return;
			}

			icon.innerHTML += `<use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="${element.dataset.swap}"></use>`;
			element.setAttribute('data-swap', 'true');
		});

		// Activate first tab
		const nav = document.querySelector('.tabs__nav');

		if (!nav || nav.length <= 0) {
			return;
		}

		nav.addEventListener('click', (event) => {
			event.preventDefault();

			if (!event.target || event.target.classList.contains('active')) {
				return;
			}

			let item = event.target;

			if (event.target.tagName !== 'LI') {
				item = event.target.closest('.tabs__nav li');
			}

			if (!item) {
				return;
			}

			// Remove currently active navigation items
			document.querySelectorAll('.tabs__nav .active').forEach((element) => {
				element.classList.remove('active');
			});

			// Reset all tabs
			document.querySelectorAll('.tabs__tab.active').forEach((element) => {
				element.classList.remove('active');
				element.setAttribute('aria-selected', 'false');
				element.setAttribute('aria-hidden', 'true');
			});

			// Make the selected item active
			item.classList.add('active');

			const link = item.querySelector('a');

			if (link && link.dataset.title) {
				document.title = `${link.dataset.title} | Tab Downloader`;
			}

			const tab = getElementByHash(link.href);

			if (!tab) {
				return;
			}

			tab.classList.add('active');
			tab.setAttribute('aria-selected', 'true');
			tab.setAttribute('aria-hidden', 'false');

			if (link.hasAttribute('data-lazyload') && lazyLoad(tab) === false) {
				link.removeAttribute('data-lazyload');
			}

			history.pushState(null, '', `#${tab.id}`);
		});

		if (window.location.hash) {
			/**
			 * The window hash without the hash, which should correspond with a tab ID
			 * @type {string}
			 */
			const TARGET_ID = window.location.hash.substr(1),

				/**
				 * Navigation element which opens the tab
				 * @type {Element}
				 */
				controller = document.querySelector(`[aria-controls="${TARGET_ID}"]`),

				/**
				 * The open tab
				 * @type {Element}
				 */
				target = document.getElementById(TARGET_ID);

			if (!target && !controller) {
				return;
			}

			// Clear active navigation and tabs
			[].slice.call(document.querySelectorAll('.active')).map((elem) => {
				if (elem.nodeName === 'LI' || elem.classList.contains('tabs__tab')) {
					elem.classList.remove('active');
				}
			});

			if (controller) {
				controller.parentNode.classList.add('active');
			}

			if (target) {
				target.classList.add('active');
			}
		}

		try {
			getElementByHash(nav.querySelector('.active a').href).classList.add('active');
		} catch(err) {
			return false;
		}
	}); // end DOM ready
})();
