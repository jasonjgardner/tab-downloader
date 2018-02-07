/**
 * Tab Downloader Browser Extension
 *
 * Initiates downloads for open tabs containing image URLs.
 *
 * @version 1.0.0
 * @author  Jason Gardner <im@jasongardner.co>
 * @link    http://jasongardner.co/tab-downloader/
 * @license MIT
 */
// @warning_level verbose
/** globals: chrome **/
(() => {
	'use strict';

	/**
	 * Default settings to merge with settings saved in local storage
	 * @type object
	 */
	const DEFAULTS = {
		closeAfterSave: true,
		conflictAction: 'uniquify', /// or 'overwrite', or 'prompt'
		fileTypes: [
			'apng',
			'avi',
			'bmp',
			'csv',
			'flac',
			'gif',
			'htm',
			'html',
			'jpeg',
			'jpg',
			'md',
			'mkv',
			'mp3',
			'mp4',
			'mpeg',
			'mpg',
			'oga',
			'ogg',
			'ogm',
			'ogv',
			'pdf',
			'png',
			'svg',
			'txt',
			'wav',
			'wbp',
			'webm',
			'webp',
			'xml'
		],
		saveAs: false
	};

	/**
	 * Default browser action tooltip text
	 * @type {string}
	 */
	const DEFAULT_TITLE = 'Download content from open tabs';

	/**
	 * Background colors to use in browser action label when the tab count is within a certain range
	 * @type {Array}
	 */
	const RANGE_COLORS = [
		{ // Blue 500 (For lighter 'loads) [Default]
			color: '#2196f3',
			min: 1,
			max: 12
		},
		{ // Indigo 500
			color: '#3f51b5',
			min: 13,
			max: 25
		},
		{ // Purple 600
			color: '#5e35b1',
			min: 26,
			max: 40
		},
		{ // Pink 500
			color: '#e91e63',
			min: 41,
			max: 59
		},
		{ // Orange 800
			color: '#ef6c00',
			min: 60,
			max: 9999
		}
	];

	const ERROR_COLOR = '#f44336';

	/**
	 * Attempts to retrieve a configuration value from local storage. Falls back to default values when the configuration has not been saved locally.
	 * @param key {String | Object} A string containing the configuration key to retrieve or an object containing configuration keys to retrieve with fallback values
	 * @param callback {Function} A callback function to pass onto `chrome.storage.local.get()`
	 */
	function getConfig(key, callback) {
		let keys = {};

		if (typeof key === 'object') { // Assume its key/default value pairs
			keys = key;
		} else if (DEFAULTS.hasOwnProperty(key)) {
			keys[key] = DEFAULTS[key];
		}

		chrome.storage.local.get(keys, callback);
	}

	/**
	 * Compiles URL patterns to download based on stored configuration values
	 * @param callback {Function} The function to invoke after compiling URL patterns. An array of URL patterns is passed to the first argument.
	 */
	function getUrlPatterns(callback) {
		getConfig({
			fileTypes: DEFAULTS.fileTypes
		}, (config) => {
			/**
			 * List of URL patterns to use in `chrome.tabs.query`
			 * @type {Array}
			 */
			let patterns = [];

			if (!chrome.runtime.lastError && Array.isArray(config.fileTypes)) {
				for (let itr = config.fileTypes.length - 1; itr >= 0; itr--) {
					/// Accepts URLs with or without parameters
					patterns.push(`*://*/*.${config.fileTypes[itr]}`, `*://*/*.${config.fileTypes[itr]}?*`);
				}
			}

			callback(patterns);
		});
	}

	/**
	 * Returns a function, that, as long as it continues to be invoked, will not be triggered.
	 * The function will be called after it stops being called for *n* milliseconds.
	 * If `immediate` is passed, trigger the function on the leading edge, instead of the trailing.
	 *
	 * @param func Function to regulate
	 * @param wait The number of milliseconds to wait before invoking the function
	 * @param immediate If `true` the function will be invoked without delay
	 * @returns {function()}
	 * @link https://davidwalsh.name/javascript-debounce-function
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
			return arr; /// Return as-is. Who knows? It might work out.
		}

		return null;
	}

	/**
	 * Checks if a number is within a number range
	 * @param value The number to test
	 * @param min The least number in the range
	 * @param max The greatest number in the range
	 * @returns {boolean}
	 */
	function isInRange(value, min, max) {
		return (value >= min && value <= max);
	}

	/**
	 * Removes error state from browser action icon
	 */
	function resetBrowserAction() {
		chrome.browserAction.setBadgeText({
			text: ''
		});

		chrome.browserAction.setTitle({
			title: DEFAULT_TITLE
		});
	}

	/**
	 * Selects tabs matching query in current window
	 * @param callback
	 */
	function queryTabs(callback) {
		getUrlPatterns((urlPatterns) => {
			chrome.windows.getCurrent((currentWindow) => { // Find the active tab in the current window
				chrome.tabs.query({
					audible: false,
					status: 'complete',
					url: urlPatterns,
					windowId: currentWindow.id
				}, callback);
			});
		});
	}

	/**
	 * Update browser action icon's label
	 * @param value Short text or tab count
	 * @param title Badge tooltip text
	 * @param backgroundColor Badge label background color
	 */
	function updateBadge(value, title, backgroundColor) {
		chrome.browserAction.setBadgeText({
			text: value
		});

		chrome.browserAction.setTitle({
			title: title || DEFAULT_TITLE
		});

		if (!backgroundColor) {
			return;
		}

		chrome.browserAction.setBadgeBackgroundColor({
			color: backgroundColor
		});
	}

	/**
	 * Update count in browser action icon
	 */
	function updateTotal() {
		queryTabs((Tabs) => {
			const count = Tabs.length;

			if (count <= 0) {
				resetBrowserAction();
				return;
			}

			const colors = RANGE_COLORS.length;

			let backgroundColor = RANGE_COLORS[0].color;

			for (let itr = 0; itr < colors; itr++) {
				if (isInRange(count, RANGE_COLORS[itr].min, RANGE_COLORS[itr].max)) {
					backgroundColor = RANGE_COLORS[itr].color;
					break;
				}
			}

			updateBadge(`${count}`, `Download ${count} item` + (count !== 1 ? 's' : '') + ' from open tabs', backgroundColor);
		});
	}

	/**
	 * Injects and triggers download links
	 * @param tabs Array of URLs to download and the corresponding tab IDs
	 */
	function downloadTabs(tabs) {
		getConfig({
			conflictAction: 'prompt',
			saveAs: DEFAULTS.saveAs || 'false'
		}, (items) => {
			for (let key in tabs) {
				if (!tabs.hasOwnProperty(key)) {
					continue;
				}

				chrome.downloads.download({
					url: tabs[key].url,
					conflictAction: items.conflictAction,
					saveAs: (items.saveAs && items.saveAs !== 'false')
				}, () => {
					if (tabs[key].close) {
						chrome.tabs.remove(parseInt(key, 10), debounce(updateTotal, 800));
					}

					updateTotal();
				});
			}
		});
	}

	/**
	 * Changes browser action title to a warning message and switches the label background to a dangerous color
	 * @param message Error message. The message will be prefixed by a random interjection
	 */
	function setError(message) {
		updateBadge(
			'!',
			random(['Woops!', 'Oh no!', 'Ah crud.', 'Yikes!', 'Aw shucks!', 'Bad news...']) + ` ${message}`,
			ERROR_COLOR
		);
	}

	/**
	 * Queries tabs to start download
	 */
	function collectDownloadableTabs() {
		let downloads = {};

		resetBrowserAction();

		queryTabs((Tabs) => {
			let itr = Tabs.length;

			--itr;

			getConfig({
				closeAfterSave: 'true'
			}, (stored) => {
				const closeAfterSave = stored.closeAfterSave !== 'false';

				for (itr; itr >= 0; itr--) {
					downloads[Tabs[itr].id] = {
						url: Tabs[itr].url,
						close: closeAfterSave && !(Tabs[itr].selected || Tabs[itr].active)
					};
				}

				if (downloads.length <= 0) {
					setError('There are no downloadable tabs in this window.');
					return;
				}

				downloadTabs(downloads);
			});
		});
	}

	chrome.browserAction.onClicked.addListener(debounce(collectDownloadableTabs, 1000));

	chrome.downloads.onDeterminingFilename.addListener((DownloadItem, suggest) => {
		getConfig({
			conflictAction: 'uniq',
		}, (stored) => {
			suggest({
				filename: DownloadItem.filename,
				conflictAction: stored.conflictAction
			});
		});
	});

	/// Create tab listeners
	chrome.tabs.onCreated.addEventListener(debounce(updateTotal, 600));
	chrome.tabs.onUpdated.addEventListener(debounce(updateTotal, 1000));
	chrome.tabs.onDetached.addEventListener(debounce(updateTotal, 1000));
	chrome.tabs.onAttached.addEventListener(debounce(updateTotal, 1000));
	chrome.tabs.onRemoved.addEventListener(debounce(updateTotal, 1000));
	chrome.runtime.onStartup.addListener(updateTotal);
})();
