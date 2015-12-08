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
                src: ['css/**/*.css', '!css/main.css'],
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
                tasks: ['newer:concat'],
            },
            css: {
                files: '**/*.scss',
                tasks: ['newer:sass', 'newer:concat', 'newer:postcss'],
                options: {
                    livereload: true,
                },
            },
            tasks: ['newer:imagemin']
        },
        imagemin: {                          // Task 
            dynamic: {                         // Another target 
                files: [{
                    expand: true,                  // Enable dynamic expansion 
                    cwd: '_assets/',                   // Src matches are relative to this path 
                    src: ['**/*.{png,jpg,gif,svg}'],   // Actual patterns to match 
                    dest: 'assets/'                  // Destination path prefix 
                }]
            }
        }
    });
     
    grunt.registerTask('default', ['build', 'watch']);
    grunt.registerTask('build', ['sass', 'bowercopy', 'concat', 'postcss', 'uglify', 'imagemin']);

}