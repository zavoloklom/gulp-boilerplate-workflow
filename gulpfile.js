'use strict';

var gulp          = require('gulp'),
  through         = require('through2'),
  del             = require('del'),
  vinylPaths      = require('vinyl-paths'),
  fs              = require('fs'),
  eachFile        = require('each-file'),
  rigger          = require('gulp-rigger'),
  sass            = require('gulp-sass'),
  autoprefixer    = require('gulp-autoprefixer'),
  cleanCSS        = require('gulp-clean-css'),
  newer           = require('gulp-newer'),
  sourcemaps      = require('gulp-sourcemaps'),
  rename          = require('gulp-rename'),
  replace         = require('gulp-replace-task'),
  concat          = require('gulp-concat'),
  uglify          = require('gulp-uglify'),
  fontmin         = require('gulp-fontmin'),
  realFavicon     = require('gulp-real-favicon'),
  imagemin        = require('gulp-imagemin'),
  cssBase64       = require('gulp-inline-base64'),
  htmlBase64      = require('gulp-inline-image-html'),
  sitemap         = require('gulp-sitemap'),
  html5Lint       = require('html5-lint'),
  download        = require('gulp-download'),
  runSequence     = require('run-sequence'),
  environments    = require('gulp-environments'),
  browserSync     = require('browser-sync'),
  reload          = browserSync.reload;

// Application config
// -----------------------------
var CONFIGURATION = require('./gulp/configuration.json');

// Paths config
// -----------------------------
var PATHS = require('./gulp/paths.json');

// External components paths
// -----------------------------
var DEPENDENCIES = require('./gulp/dependencies.json');

// Server setup
// -----------------------------
var SERVER = {
  server: {
    baseDir: PATHS.build.server
  },
  host: 'localhost',
  port: 8090
};

// Environments
// -----------------------------
var development = environments.development;
var production = environments.production;

// Prepare dependencies concatenation
// -----------------------------
gulp.task('dependencies:js', function() {
  return gulp.src(DEPENDENCIES.js)
    .pipe(production(newer(PATHS.build.js + 'dependencies.min.js')))
    .pipe(concat('dependencies.js'))
    .pipe(uglify())
    .pipe(rename({suffix: '.min'}))
    .pipe(gulp.dest(PATHS.build.js))
    .pipe(through.obj(function (file, enc, cb) {
      gulp.start('cache-bust:dependencies:js');
      cb(null, file);
    }));
});
gulp.task('dependencies:css', function() {
  return gulp.src(DEPENDENCIES.css)
    .pipe(production(newer(PATHS.build.css + 'dependencies.min.css')))
    .pipe(concat('dependencies.css'))
    .pipe(cleanCSS())
    .pipe(rename({suffix: '.min'}))
    .pipe(gulp.dest(PATHS.build.css))
    .pipe(through.obj(function (file, enc, cb) {
      gulp.start('cache-bust:dependencies:css');
      cb(null, file);
    }));
});

// Yandex Metrika Counter
// It is better to use local script for cache effect
// -----------------------------
gulp.task('metrika:build', function() {
  return download('https://mc.yandex.ru/metrika/watch.js')
    .pipe(gulp.dest(PATHS.build.js+'metrika/'));
});

// Generate the icons
// -----------------------------
gulp.task('favicon:build', function(done) {
  return realFavicon.generateFavicon({
    masterPicture: PATHS.src.favicon,
    dest: PATHS.build.favicon,
    iconsPath: 'favicons',
    design: {
      ios: {
        pictureAspect: 'backgroundAndMargin',
        backgroundColor: CONFIGURATION.favicon.bgColor,
        margin: '14%',
        assets: {
          ios6AndPriorIcons: false,
          ios7AndLaterIcons: false,
          precomposedIcons: false,
          declareOnlyDefaultIcon: true
        },
        appName: CONFIGURATION.name
      },
      desktopBrowser: {},
      windows: {
        pictureAspect: 'noChange',
        backgroundColor: CONFIGURATION.favicon.color,
        onConflict: 'override',
        assets: {
          windows80Ie10Tile: false,
          windows10Ie11EdgeTiles: {
            small: false,
            medium: true,
            big: false,
            rectangle: false
          }
        },
        appName: CONFIGURATION.name
      },
      androidChrome: {
        pictureAspect: 'noChange',
        themeColor: CONFIGURATION.favicon.bgColor,
        manifest: {
          name: CONFIGURATION.name,
          display: 'standalone',
          orientation: 'notSet',
          onConflict: 'override',
          declared: true
        },
        assets: {
          legacyIcon: false,
          lowResolutionIcons: false
        }
      }
    },
    settings: {
      scalingAlgorithm: 'Mitchell',
      errorOnImageTooSmall: false
    },
    markupFile: 'src/favicon/faviconData.json'
  }, function() {
    done();
  });
});

// HTML Compilation
// -----------------------------
gulp.task('html:build', function () {
  var CACHE = require(PATHS.src.cache.file);
  return gulp.src(PATHS.src.html)
    .pipe(htmlBase64(PATHS.build.server))
    .pipe(replace({
      patterns: [
        {
          match: 'dependenciesCss',
          replacement: CACHE.dependenciesCss
        },
        {
          match: 'dependenciesJs',
          replacement: CACHE.dependenciesJs
        },
        {
          match: 'mainCss',
          replacement: CACHE.mainCss
        },
        {
          match: 'mainJs',
          replacement: CACHE.mainJs
        },
        {
          match: 'fontsCss',
          replacement: CACHE.fontsCss
        },
        {
          match: 'metaRights',
          replacement: CONFIGURATION.meta.rights
        },
        {
          match: 'metaCreator',
          replacement: CONFIGURATION.meta.creator
        }
      ]
    }))
    .pipe(gulp.dest(PATHS.build.html))
    .pipe(sitemap({
      siteUrl: CONFIGURATION.url
    }))
    .pipe(gulp.dest(PATHS.build.sitemap));
});

// Fonts Compilation
// -----------------------------
gulp.task('fonts:prepare', function () {
  return gulp.src(PATHS.src.fonts)
    .pipe(production(newer(PATHS.build.fonts)))
    .pipe(fontmin({
      fontPath: '../fonts/'
    }))
    .pipe(gulp.dest(PATHS.build.fonts));

});
gulp.task('fonts:css', function () {
  return gulp.src(PATHS.build.fonts + '**/*.css')
    .pipe(production(newer(PATHS.build.css + 'fonts.min.css')))
    .pipe(vinylPaths(del))
    .pipe(concat('fonts.css'))
    .pipe(cleanCSS())
    .pipe(rename({suffix: '.min'}))
    .pipe(gulp.dest(PATHS.build.css))
    .pipe(through.obj(function (file, enc, cb) {
      gulp.start('cache-bust:fonts:css');
      cb(null, file);
    }));
});
gulp.task('fonts:build', function() {
  runSequence(
    'fonts:prepare',
    'fonts:css'
  )
});

// CSS Compilation
// -----------------------------
gulp.task('css:build', function(){
  return gulp.src(PATHS.src.css)
  //.pipe(production(newer(PATHS.build.css + 'main.min.css')))
    .pipe(development(sourcemaps.init()))
    .pipe(sass({
      sourceMap: true,
      errLogToConsole: true
    }).on('error', sass.logError))
    .pipe(cssBase64({
      baseDir: PATHS.build.css,
      maxSize: 14 * 1024 // calculation in bytes
    }))
    .pipe(autoprefixer([
      "Android 2.3",
      "Android >= 4",
      "Chrome >= 20",
      "Firefox >= 24",
      "Explorer >= 8",
      "iOS >= 6",
      "Opera >= 12",
      "Safari >= 6"
    ], { cascade: true, flexbox: true }))
    .pipe(cleanCSS())
    .pipe(rename({suffix: '.min'}))
    .pipe(development(sourcemaps.write("/")))
    .pipe(gulp.dest(PATHS.build.css))
    .pipe(through.obj(function (file, enc, cb) {
      gulp.start('cache-bust:main:css');
      cb(null, file);
    }));
});

// JS Compilation
// -----------------------------
gulp.task('js:build', function() {
  return gulp.src(PATHS.src.js)
    .pipe(production(newer(PATHS.build.js + 'main.min.js')))
    .pipe(rigger())
    .pipe(development(sourcemaps.init()))
    .pipe(uglify())
    .pipe(rename({suffix: '.min'}))
    .pipe(development(sourcemaps.write("/")))
    .pipe(gulp.dest(PATHS.build.js))
    .pipe(through.obj(function (file, enc, cb) {
      gulp.start('cache-bust:main:js');
      cb(null, file);
    }));
});

// Cache busting tasks
// -----------------------------
gulp.task('cache-bust:dependencies:js', function () {
  return gulp.src(PATHS.src.cache.file)
    .pipe(replace({
      patterns: [
        {
          match: /"dependenciesJs": "([?,0-9]*)"/g,
          replacement: '"dependenciesJs": "' + new Date().getTime() + '"'
        }
      ]
    }))
    .pipe(gulp.dest(PATHS.src.cache.path));
});
gulp.task('cache-bust:dependencies:css', function () {
  return gulp.src(PATHS.src.cache.file)
    .pipe(replace({
      patterns: [
        {
          match: /"dependenciesCss": "([?,0-9]*)"/g,
          replacement: '"dependenciesCss": "' + new Date().getTime() + '"'
        }
      ]
    }))
    .pipe(gulp.dest(PATHS.src.cache.path));
});
gulp.task('cache-bust:main:js', function () {
  return gulp.src(PATHS.src.cache.file)
    .pipe(replace({
      patterns: [
        {
          match: /"mainJs": "([?,0-9]*)"/g,
          replacement: '"mainJs": "' + new Date().getTime() + '"'
        }
      ]
    }))
    .pipe(gulp.dest(PATHS.src.cache.path));
});
gulp.task('cache-bust:main:css', function () {
  return gulp.src(PATHS.src.cache.file)
    .pipe(replace({
      patterns: [
        {
          match: /"mainCss": "([?,0-9]*)"/g,
          replacement: '"mainCss": "' + new Date().getTime() + '"'
        }
      ]
    }))
    .pipe(gulp.dest(PATHS.src.cache.path));
});
gulp.task('cache-bust:fonts:css', function () {
  return gulp.src(PATHS.src.cache.file)
    .pipe(replace({
      patterns: [
        {
          match: /"fontsCss": "([?,0-9]*)"/g,
          replacement: '"fontsCss": "' + new Date().getTime() + '"'
        }
      ]
    }))
    .pipe(gulp.dest(PATHS.src.cache.path));
});


// Images/sprites Compilation
// -----------------------------
gulp.task('image:minify', function() {
  return gulp.src(PATHS.src.images.original)
    .pipe(production(newer(PATHS.build.images)))
    .pipe(imagemin(
      [
        imagemin.jpegtran({progressive: true}),
        imagemin.optipng({optimizationLevel: 5}),
        imagemin.gifsicle({interlaced: true}),
        imagemin.svgo({plugins: [{removeViewBox: false}]})
      ],
      {
        verbose: true
      }))
    .pipe(gulp.dest(PATHS.build.images));
});
gulp.task('image:relocate', function() {
  return gulp.src(PATHS.src.images.optimized)
    .pipe(gulp.dest(PATHS.build.images));
});
gulp.task('image:build', function() {
  runSequence(
    'image:minify',
    'image:relocate'
  )
});

// Forms relocation
// -----------------------------
gulp.task('forms:phpmailer', function() {
  return gulp.src(PATHS.src.phpmailer)
    .pipe(newer(PATHS.build.forms))
    .pipe(gulp.dest(PATHS.build.forms));
});
gulp.task('forms:relocate', function() {
  return gulp.src(PATHS.src.forms)
    .pipe(production(newer(PATHS.build.forms)))
    .pipe(gulp.dest(PATHS.build.forms));
});
gulp.task('forms:build', ['forms:phpmailer', 'forms:relocate']);

// Lint
// -----------------------------
gulp.task('lint:js', function() {
  const jshint = require('gulp-jshint');
  return gulp.src(PATHS.lint.js)
    .pipe(jshint({
      lookup: PATHS.lint.configs + '.jshintrc'
    }))
    .pipe(jshint.reporter('default'))
    .pipe(jshint.reporter('fail'));
});
gulp.task('lint:scss', function() {
  const gulpStylelint = require('gulp-stylelint');
  return gulp.src(PATHS.lint.scss)
    .pipe(gulpStylelint({
      configFile: PATHS.lint.configs + '.stylelintrc',
      failAfterError: false,
      reporters: [
        {formatter: 'string', console: true}
      ]
    }));
});
gulp.task('lint:html', function() {
  const htmlhint = require('gulp-htmlhint');
  return gulp.src(PATHS.lint.html)
    .pipe(htmlhint(PATHS.lint.configs + '.htmlhintrc'))
    .pipe(htmlhint.reporter())
    .pipe(htmlhint.failReporter({ suppress: true }));
});
gulp.task('lint:html5', function() {
  eachFile(PATHS.lint.html, function withFile(file, cb) {
    fs.readFile(file.path, 'utf8', function( err, html ) {
      if ( err )
        throw err;
      html5Lint(html, function( err, results ) {
        results.messages.forEach( function( msg ) {
          var type = msg.type, // error or warning
            message = msg.message;
          console.log( "Mozilla HTML5 Lint [%s] [%s]: %s", file.path, type, message );
        });
      });
    });
    cb(null);
  }, function onDone() {});
});

// Relocate static files
// -----------------------------
gulp.task('relocate-static-files', function() {
  return gulp.src(PATHS.src.static)
    .pipe(production(newer(PATHS.build.static)))
    .pipe(gulp.dest(PATHS.build.static));
});

// Webserver
// -----------------------------
gulp.task('webserver', function () {
  browserSync(SERVER);
  return gulp.watch(PATHS.watch.server).on('change', reload);
});

// Who watch the watchers
// -----------------------------
gulp.task('watch', function(){
  environments.current(development);
  gulp.watch([PATHS.watch.html], ['html:build']);
  gulp.watch([PATHS.watch.fonts], ['fonts:build']);
  gulp.watch([PATHS.watch.css], ['css:build']);
  gulp.watch([PATHS.watch.js], ['js:build']);
  gulp.watch([PATHS.watch.images.original], ['image:build']);
  gulp.watch([PATHS.watch.images.optimized], ['image:build']);
  gulp.watch([PATHS.watch.favicon], ['favicon:build']);
  gulp.watch([PATHS.watch.forms], ['forms:build']);
  gulp.watch([PATHS.watch.static], ['relocate-static-files']);
});

// Main section
// -----------------------------

// @see https://github.com/gulpjs/gulp/blob/master/docs/recipes/delete-files-folder.md
gulp.task('clean', function() {
  return gulp.src(PATHS.clean)
    .pipe(vinylPaths(del));
});

gulp.task('lint', ['lint:html', 'lint:html5', 'lint:css', 'lint:js']);

gulp.task('clean-build', function() {
  runSequence(
    'clean',
    'build'
  )
});

gulp.task('build', function() {
  environments.current(production);
  runSequence(
    'image:build',
    //'metrika:build', // For those who use Yandex.Metrika counter
    'dependencies:js',
    'dependencies:css',
    'js:build',
    'css:build',
    [
      'fonts:build',
      'favicon:build',
      'forms:build',
      'relocate-static-files'
    ],
    'html:build'
  )
});

// That thing does'n work as expected
/**
 gulp.task('start', function() {
  runSequence(
    'clean',
    'build',
    'webserver',
    'watch'
  );
});
 **/
