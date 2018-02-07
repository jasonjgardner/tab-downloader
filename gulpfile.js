#!/usr/bin/env node --harmony
/* jshint esversion: 6 */
'use strict';

const pkg          = require('./package.json');
const fs           = require('fs');
const path         = require('path');
const gulp         = require('gulp');
const connect      = require('gulp-connect');
const sass         = require('gulp-sass');
const autoprefixer = require('gulp-autoprefixer');
const csso         = require('gulp-csso');
const cmq          = require('gulp-combine-mq');
const uncss        = require('gulp-uncss');
const babel        = require('gulp-babel');
const mustache     = require('gulp-mustache');
const rename       = require('gulp-rename');
const marked       = require('marked');

marked.setOptions({
	gfm: true,
	tables: true
});

/**
 * The browser name and directory to target in build
 * @type {String}
 */
const BROWSER = 'chrome';

// Resolve directory paths before assigning constant's values

/**
 * Project directory paths
 */
const DIRS = {
	src: './src',
	dist: './dist',
	node: './node_modules'
};

/**
 * File type paths and targets
 * @type {Object}
 */
const FILES = {
	scss: [`${DIRS.src}/**/*.scss`],
	optionsJs: [`${DIRS.src}/options/**/*.js`],
	backgroundJs: [`${DIRS.src}/*.js`],
	mustache: [`${DIRS.src}/**/*.mustache`],
	data: path.normalize(`${DIRS.src}/data.json`),
	sprites: `${DIRS.src}/**/symbol-defs.svg`,
	attribution: './ATTRIBUTION.md',
	license: './LICENSE'
};

///
/// BUILD TASKS
///

gulp.task('default', ['mustache', 'css', 'js:options']);

gulp.task('build', ['default', 'js:background']);

/**
 * Watch targeted files in bulk
 */
gulp.task('watch', () => {
	gulp.watch(FILES.mustache.concat(FILES.data), ['mustache']);
	gulp.watch(FILES.scss, ['scss']);
	gulp.watch(FILES.backgroundJs, ['babel']);
	gulp.watch(FILES.optionsJs, ['js:options']);
});

/**
 * Compile ES6/ES2015 JavaScript
 * Babel compiles JavaScript in the browser extension and on the options page.
 */
gulp.task('js:background', () => {
	return gulp.src(`${DIRS.src}/*.js`, { base: DIRS.src })
		.pipe(babel({
			presets: [
				'es2015-script',
				'babili'
			]
		}))
		.pipe(gulp.dest(DIRS.dist));
});

//
// OPTIONS PAGE TASKS
//

/**
 * Serve options page over localhost during development
 */
gulp.task('connect', () => {
	connect.server({
		name: 'dev',
		root: `${DIRS.dist}/options`,
		livereload: true,
		port: 8080
	});
});

/**
 * Compile options page JavaScript
 */
gulp.task('js:options', () => {
	return gulp.src(`${DIRS.src}/options/assets/**/*.js`, { base: DIRS.src })
		.pipe(babel({
			presets: [
				'es2015-script',
				'babili',
				['env', {
					targets: {
						browsers: [`last 2 ${BROWSER} versions`]
					}
				}]
			]
		}))
		.pipe(gulp.dest(DIRS.dist));
});

/**
 * Compile Mustache template and trigger LiveReload
 */
gulp.task('mustache', () => {
	const markdown = fs.readFileSync(FILES.attribution, 'utf8'),
		license = fs.readFileSync(FILES.license, 'utf8');

	let lines = license.split('\n');

	const title = lines.shift(),
		body = lines.join('\n').trim();

	return gulp.src(FILES.mustache)
		.pipe(mustache(
			Object.assign(
				{
					basename: function() {
						return function(text, render) {
							const key = text.replace(/[}{]{2}/g, ''); // '{{href}}' -> 'href'

							if (!this.hasOwnProperty(key)) {
								return render(text);
							}

							// 'https://jgardner.s3.amazonaws.com/tab-downloader/demo/1.xml'-> '1.xml'
							return render(this[key].substr(this[key].lastIndexOf('/') + 1));
						};
					}
				},
				pkg, /// package.json data
				JSON.parse(fs.readFileSync(FILES.data)), /// Static data
				{ /// Dynamic data
					attribution: marked(markdown),
					licenseTitle: title,
					license: marked(body),
					year: (new Date()).getFullYear()
				}
			)
		))
		.pipe(rename({
			extname: '.html'
		}))
		.pipe(gulp.dest(DIRS.dist, { base: DIRS.src }))
		.pipe(connect.reload());
});

/**
 * Compile SCSS and trigger LiveReload
 * AutoPrefixer should not attempt to prefix CSS for other browsers
 */
gulp.task('scss', () => {
	return gulp.src(FILES.scss, { base: DIRS.src })
		.pipe(
			sass({
				outputStyle: 'compressed',
				precision: 6,
				includePaths: [
					DIRS.node
				]
			}).on('error', sass.logError)
		)
		.pipe(autoprefixer({
			browsers: [`last 2 ${BROWSER} versions`],
			cascade: false
		}))
		.pipe(gulp.dest(DIRS.dist))
		.pipe(connect.reload());
});

/**
 * Optimize CSS and output to `dist` directory
 * - Removes unused CSS
 * - Combines media queries
 * - Runs CSSO for additional optimization
 */
gulp.task('css', ['scss'], () => {
	return gulp.src([
		`${DIRS.dist}/**/*.css`
	])
		.pipe(cmq({
			beautify: false
		}))
		.pipe(gulp.dest(DIRS.dist));
});
