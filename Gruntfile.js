module.exports = function(grunt) {

    require('load-grunt-tasks')(grunt);
     
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        uglify: {
            options: {
                banner: '/*! <%= pkg.name %> JS Build v<%= pkg.version %> <%= grunt.template.today("yyyy-mm-dd") %> */\n',
                compress: {
                    drop_console: true
                }
            },
            dist: {
                src: "js/build.js",
                dest: "js/build.js",
            }
        },
        concat: {
            dist: {
                src: ['_js/_bower.js', '_js/**/*.js'],
                dest: 'js/build.js',
            },
        },
        sass: {
            options: {
                //style: 'compressed',
                sourceMap: true
            },
            dist: {
                files: {
                    'css/style.css': '_sass/main.scss'
                }
            }
        },
        bower_concat: {
          all: {
            dest: '_js/_bower.js',
            cssDest: 'css/_bower.css',
            bowerOptions: {
              relative: false
            }
          }
        },
        postcss: {
            options: {
                processors: [
                    require('autoprefixer')({browsers: 'last 2 versions'}), // add vendor prefixes
                    require('cssnano')() // minify the result
                ]
            },
            dist: {
                src: 'css/*.css'
            }
        },
        htmlmin: {
            dist: {
                options: {
                    removeComments: true,
                    collapseWhitespace: true,
                    minifyJS: true,
                    minifyCSS: true,
                },
                files: [
                    {
                        expand: true,     // Enable dynamic expansion.
                        cwd: '_site/',      // Src matches are relative to this path.
                        src: ['**/*.html'], // Actual pattern(s) to match.
                        dest: '_site/',   // Destination path prefix.
                    },
                ],
            },
        },
        watch: {
            js: {
                files: "_js/**/*.js",
                tasks: ['concat'],
            },
            css: {
                files: '**/*.scss',
                tasks: ['sass'],
                options: {
                    livereload: true,
                },
            },
        },
    });
     
    grunt.registerTask('default', ['bower_concat', 'watch']);
    grunt.registerTask('build', ['sass', 'postcss', 'bower_concat', 'concat', 'uglify', 'htmlmin']);

}