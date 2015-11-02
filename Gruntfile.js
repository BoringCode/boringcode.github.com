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
        bowercopy: {
            options: {
                // Task-specific options go here
            },
            prismjs: {
                src: 'prism/prism.js',
                dest: '_js/',
            },
            prismcss: {
                src: 'prism/themes/prism.css',
                dest: 'css/',
            },
            trianglify: {
                src: 'trianglify:main',
                dest: '_js/',
            }
        },
        concat: {
            dist: {
                src: ['_js/prism.js', '_js/trianglify.min.js', '_js/**/*.js'],
                dest: 'js/build.js',
            },
            css: {
                src: ['css/**/*.css'],
                dest: 'css/main.css',
            }
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
        postcss: {
            options: {
                processors: [
                    require('autoprefixer')({browsers: 'last 2 versions'}), // add vendor prefixes
                    require('cssnano')() // minify the result
                ]
            },
            dist: {
                src: 'css/main.css'
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
                tasks: ['sass', 'concat', 'postcss'],
                options: {
                    livereload: true,
                },
            },
        },
    });
     
    grunt.registerTask('default', ['build', 'watch']);
    grunt.registerTask('build', ['sass', 'bowercopy', 'concat', 'postcss', 'uglify']);

}